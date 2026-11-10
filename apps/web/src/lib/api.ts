/**
 * Minimal API client for the LA Chat web app.
 * Wraps fetch with credentials, JSON parsing, and error normalisation.
 */

const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(typeof body === 'string' ? body : 'API error');
  }
}

function getStoredTokens() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('la-chat-tokens');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { accessToken: string; refreshToken: string };
  } catch {
    return null;
  }
}

function setStoredTokens(tokens: { accessToken: string; refreshToken: string } | null) {
  if (typeof window === 'undefined') return;
  if (tokens) {
    window.localStorage.setItem('la-chat-tokens', JSON.stringify(tokens));
  } else {
    window.localStorage.removeItem('la-chat-tokens');
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const tokens = getStoredTokens();
  const headers = new Headers(init.headers);
  if (tokens?.accessToken) {
    headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && tokens?.refreshToken) {
      // Try one refresh, then retry the original request.
      const refreshed = await tryRefresh(tokens.refreshToken);
      if (refreshed) {
        headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
        const retry = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
        const retryBody = (retry.headers.get('content-type') || '').includes('application/json')
          ? await retry.json().catch(() => null)
          : await retry.text().catch(() => null);
        if (!retry.ok) throw new ApiError(retry.status, retryBody);
        return retryBody as T;
      }
    }
    throw new ApiError(res.status, body);
  }
  return body as T;
}

async function tryRefresh(refreshToken: string) {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      credentials: 'include',
    });
    if (!res.ok) {
      setStoredTokens(null);
      return null;
    }
    const data = (await res.json()) as { tokens: { accessToken: string; refreshToken: string } };
    setStoredTokens(data.tokens);
    return data.tokens;
  } catch {
    setStoredTokens(null);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export async function login(identifier: string, password: string) {
  const data = await apiFetch<{ user: unknown; tokens: { accessToken: string; refreshToken: string } }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ identifier, password }) },
  );
  setStoredTokens(data.tokens);
  return data;
}

export async function logout() {
  const tokens = getStoredTokens();
  if (tokens?.refreshToken) {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
    } catch {
      /* ignore — we clear local state anyway */
    }
  }
  setStoredTokens(null);
}

export function isAuthenticated(): boolean {
  return getStoredTokens() !== null;
}
