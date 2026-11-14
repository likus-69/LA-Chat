import { getTokens, setTokens, clearTokens, StoredTokens } from './storage';
import type { UserProfileDto, AuthResponseDto } from '@la-chat/shared-types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(typeof body === 'string' ? body : 'API error');
  }
}

let cachedTokens: StoredTokens | null = null;

async function loadTokens(): Promise<StoredTokens | null> {
  if (!cachedTokens) cachedTokens = await getTokens();
  return cachedTokens;
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const tokens = await loadTokens();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (tokens?.accessToken) headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && tokens?.refreshToken) {
      const refreshed = await tryRefresh(tokens.refreshToken);
      if (refreshed) {
        headers['Authorization'] = `Bearer ${refreshed.accessToken}`;
        const retry = await fetch(`${API_BASE}${path}`, { ...init, headers });
        const retryBody = (retry.headers.get('content-type') || '').includes('application/json')
          ? await retry.json().catch(() => null)
          : await retry.text().catch(() => null);
        if (!retry.ok) throw new ApiError(retry.status, retryBody);
        return retryBody as T;
      }
      await clearTokens();
      cachedTokens = null;
    }
    throw new ApiError(res.status, body);
  }
  return body as T;
}

async function tryRefresh(refreshToken: string): Promise<StoredTokens | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AuthResponseDto;
    const newTokens = data.tokens;
    await setTokens(newTokens);
    cachedTokens = newTokens;
    return newTokens;
  } catch {
    return null;
  }
}

export async function login(identifier: string, password: string): Promise<AuthResponseDto> {
  const data = await apiFetch<AuthResponseDto>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  await setTokens(data.tokens);
  cachedTokens = data.tokens;
  return data;
}

export async function logout(): Promise<void> {
  const tokens = await loadTokens();
  if (tokens?.refreshToken) {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
    } catch { /* ignore */ }
  }
  await clearTokens();
  cachedTokens = null;
}

export async function getProfile(): Promise<UserProfileDto> {
  return apiFetch<UserProfileDto>('/users/me');
}
