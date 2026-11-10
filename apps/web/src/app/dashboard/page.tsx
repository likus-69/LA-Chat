'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, logout, isAuthenticated } from '@/lib/api';
import type { UserProfileDto } from '@la-chat/shared-types';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    apiFetch<UserProfileDto>('/users/me')
      .then((p) => {
        setProfile(p);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        setLoading(false);
      });
  }, [router]);

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

  if (error) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <h1>Something went wrong</h1>
          <p>{error}</p>
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
            <h1 style={styles.title}>Welcome, {profile?.fullName}</h1>
            <p style={styles.subtitle}>Light Academy Secondary School</p>
          </div>
          <button onClick={handleLogout} style={styles.outlineButton}>Sign out</button>
        </div>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Your account</h2>
          <dl style={styles.dl}>
            <dt>Email</dt><dd>{profile?.email ?? '—'}</dd>
            <dt>Phone</dt><dd>{profile?.phone ?? '—'}</dd>
            <dt>Roles</dt><dd>{profile?.roles.join(', ')}</dd>
            <dt>Status</dt><dd>{profile?.status}</dd>
            {profile?.admissionNo && (<><dt>Admission No</dt><dd>{profile.admissionNo}</dd></>)}
            {profile?.staffNo && (<><dt>Staff No</dt><dd>{profile.staffNo}</dd></>)}
            {profile?.className && (<><dt>Class</dt><dd>{profile.className} ({profile.streamName})</dd></>)}
            {profile?.department && (<><dt>Department</dt><dd>{profile.department}</dd></>)}
          </dl>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>What's next</h2>
          <p style={styles.muted}>
            This is a Phase 1 dashboard stub. Messaging, groups, announcements and
            the administration console arrive in Phases 3–6. See
            {' '}<code>documentation/deployment/roadmap.md</code>.
          </p>
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '1.5rem', color: '#1e3a5f' },
  subtitle: { margin: 0, fontSize: '0.85rem', color: '#475569' },
  section: { marginBottom: '2rem' },
  sectionTitle: { fontSize: '1.05rem', color: '#1e3a5f', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' },
  dl: { display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '0.5rem 1rem', margin: 0 },
  button: { padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: '#1e3a5f', color: 'white', cursor: 'pointer' },
  outlineButton: { padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#1e3a5f', cursor: 'pointer' },
  muted: { color: '#475569', lineHeight: 1.5 },
};
