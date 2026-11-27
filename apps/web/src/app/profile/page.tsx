'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError, isAuthenticated, logout } from '@/lib/api';
import type { SessionDto, UserProfileDto } from '@la-chat/shared-types';

export default function ProfilePage(): React.JSX.Element {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Profile form
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const loadSessions = useCallback(async () => {
    const res = await apiFetch<{ items: SessionDto[] }>('/users/me/sessions');
    setSessions(res.items);
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    Promise.all([apiFetch<UserProfileDto>('/users/me'), apiFetch<{ items: SessionDto[] }>('/users/me/sessions')])
      .then(([p, s]) => {
        setProfile(p);
        setFullName(p.fullName);
        setEmail(p.email ?? '');
        setPhone(p.phone ?? '');
        setSessions(s.items);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setPageError(err instanceof Error ? err.message : 'Failed to load profile');
        setLoading(false);
      });
  }, [router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMessage(null);
    setProfileError(null);
    setSavingProfile(true);
    try {
      const updated = await apiFetch<UserProfileDto>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ fullName, email, phone }),
      });
      setProfile(updated);
      setFullName(updated.fullName);
      setEmail(updated.email ?? '');
      setPhone(updated.phone ?? '');
      setProfileMessage('Profile updated.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not save your profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Password changed. Other devices have been signed out.');
      await loadSessions();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change your password');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleRevokeSession(id: string) {
    if (!window.confirm('Sign this device out of LA Chat?')) return;
    try {
      await apiFetch(`/users/me/sessions/${id}`, { method: 'DELETE' });
      await loadSessions();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Could not sign that device out');
    }
  }

  async function handleRevokeOthers() {
    if (!window.confirm('Sign out every device except this one?')) return;
    try {
      await apiFetch('/users/me/sessions', { method: 'DELETE' });
      await loadSessions();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Could not sign the other devices out');
    }
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <p>Loading…</p>
      </main>
    );
  }

  if (pageError && !profile) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <h1>Something went wrong</h1>
          <p>{pageError}</p>
          <button onClick={handleLogout} style={styles.button}>Back to login</button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Your profile</h1>
            <p style={styles.subtitle}>{profile?.fullName} · {profile?.roles.join(', ')}</p>
          </div>
          <div style={styles.headerActions}>
            <Link href="/chat" style={styles.outlineButton}>Back to chat</Link>
            <button onClick={handleLogout} style={styles.outlineButton}>Sign out</button>
          </div>
        </div>

        {pageError && <p style={styles.error}>{pageError}</p>}

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Account details</h2>
          <dl style={styles.dl}>
            {profile?.admissionNo && (<><dt>Admission No</dt><dd>{profile.admissionNo}</dd></>)}
            {profile?.staffNo && (<><dt>Staff No</dt><dd>{profile.staffNo}</dd></>)}
            {profile?.className && (<><dt>Class</dt><dd>{profile.className} ({profile.streamName})</dd></>)}
            {profile?.department && (<><dt>Department</dt><dd>{profile.department}</dd></>)}
            <dt>Status</dt><dd>{profile?.status}</dd>
          </dl>
          <p style={styles.hint}>Your name and class are maintained by the school office.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Edit contact details</h2>
          <form onSubmit={handleSaveProfile} style={styles.form}>
            <label style={styles.label}>
              Full name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={styles.input}
                required
              />
            </label>
            <label style={styles.label}>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                placeholder="Optional"
              />
            </label>
            <label style={styles.label}>
              Phone
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={styles.input}
                placeholder="Optional"
              />
            </label>
            {profileError && <p style={styles.error}>{profileError}</p>}
            {profileMessage && <p style={styles.success}>{profileMessage}</p>}
            <button type="submit" style={styles.button} disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Change password</h2>
          <form onSubmit={handleChangePassword} style={styles.form}>
            <label style={styles.label}>
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={styles.input}
                required
              />
            </label>
            <label style={styles.label}>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={styles.input}
                minLength={8}
                required
              />
            </label>
            <label style={styles.label}>
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={styles.input}
                minLength={8}
                required
              />
            </label>
            <p style={styles.hint}>
              At least 8 characters, with an uppercase letter, a lowercase letter and a number.
            </p>
            {passwordError && <p style={styles.error}>{passwordError}</p>}
            {passwordMessage && <p style={styles.success}>{passwordMessage}</p>}
            <button type="submit" style={styles.button} disabled={savingPassword}>
              {savingPassword ? 'Changing…' : 'Change password'}
            </button>
          </form>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeaderRow}>
            <h2 style={{ ...styles.sectionTitle, borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
              Signed-in devices
            </h2>
            {sessions.length > 1 && (
              <button onClick={handleRevokeOthers} style={styles.outlineButton}>
                Sign out other devices
              </button>
            )}
          </div>
          {sessions.length === 0 ? (
            <p style={styles.hint}>No active sessions.</p>
          ) : (
            <ul style={styles.sessionList}>
              {sessions.map((s) => (
                <li key={s.id} style={styles.sessionItem}>
                  <div>
                    <div style={styles.sessionTitle}>
                      {s.userAgent ? s.userAgent.split(' ')[0] : 'Unknown device'}
                      {s.current && <span style={styles.badge}>This device</span>}
                    </div>
                    <div style={styles.sessionMeta}>
                      {s.ipAddress ?? 'Unknown IP'} · signed in {new Date(s.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {!s.current && (
                    <button onClick={() => handleRevokeSession(s.id)} style={styles.dangerButton}>
                      Sign out
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f7f9fc',
    padding: '2rem 1rem',
    display: 'flex',
    justifyContent: 'center',
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '2rem',
    width: '100%',
    maxWidth: '720px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '2rem',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  headerActions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '1.5rem', color: '#1e3a5f' },
  subtitle: { margin: 0, fontSize: '0.85rem', color: '#475569' },
  section: { marginBottom: '2rem' },
  sectionHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '0.5rem',
    marginBottom: '0.75rem',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: '1.05rem',
    color: '#1e3a5f',
    marginBottom: '0.75rem',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '0.5rem',
  },
  dl: { display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '0.5rem 1rem', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '420px' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: '#334155' },
  input: {
    padding: '0.55rem 0.7rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.95rem',
  },
  button: {
    alignSelf: 'flex-start',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: 'none',
    background: '#1e3a5f',
    color: 'white',
    cursor: 'pointer',
  },
  outlineButton: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: 'white',
    color: '#1e3a5f',
    cursor: 'pointer',
    textDecoration: 'none',
    fontSize: '0.9rem',
  },
  dangerButton: {
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  hint: { color: '#64748b', fontSize: '0.8rem', margin: '0.5rem 0 0' },
  error: { color: '#b91c1c', fontSize: '0.85rem', margin: 0 },
  success: { color: '#15803d', fontSize: '0.85rem', margin: 0 },
  sessionList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  sessionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.6rem 0.75rem',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
  },
  sessionTitle: { fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' },
  sessionMeta: { fontSize: '0.78rem', color: '#64748b' },
  badge: {
    fontSize: '0.7rem',
    background: '#dcfce7',
    color: '#166534',
    padding: '0.1rem 0.4rem',
    borderRadius: '999px',
  },
};
