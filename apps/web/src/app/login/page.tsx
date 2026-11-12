'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
      router.push('/chat');
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { message?: string };
        setError(body?.message ?? `Login failed (HTTP ${err.status})`);
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <div style={styles.logo}>LA</div>
          <div>
            <h1 style={styles.title}>LA Chat</h1>
            <p style={styles.subtitle}>Light Academy Secondary School</p>
          </div>
        </div>
        <p className="brand-motto" style={styles.motto}>A Different Approach to Education</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            <span style={styles.labelText}>Admission No / Staff No / Email</span>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
              style={styles.input}
              disabled={submitting}
            />
          </label>
          <label style={styles.label}>
            <span style={styles.labelText}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={styles.input}
              disabled={submitting}
            />
          </label>

          {error && <div role="alert" style={styles.error}>{error}</div>}

          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={styles.hint}>
          Test accounts (password: <code>Password1</code>) are listed in <code>STATUS.md</code> after seeding.
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #15294a 100%)',
    padding: '1rem',
  },
  card: {
    background: 'white',
    padding: '2.5rem',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
    width: '100%',
    maxWidth: '420px',
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' },
  logo: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    background: '#1e3a5f',
    color: '#d4a017',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: '1.25rem',
  },
  title: { margin: 0, fontSize: '1.5rem', color: '#1e3a5f' },
  subtitle: { margin: 0, fontSize: '0.85rem', color: '#475569' },
  motto: { margin: '0.5rem 0 1.5rem', fontSize: '0.85rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  labelText: { fontSize: '0.85rem', color: '#475569', fontWeight: 500 },
  input: {
    padding: '0.65rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '1rem',
    outline: 'none',
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.75rem',
    borderRadius: '6px',
    border: 'none',
    background: '#1e3a5f',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    background: '#fef2f2',
    color: '#b91c1c',
    padding: '0.65rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.9rem',
    border: '1px solid #fecaca',
  },
  hint: { marginTop: '1.5rem', fontSize: '0.8rem', color: '#475569', textAlign: 'center' },
};
