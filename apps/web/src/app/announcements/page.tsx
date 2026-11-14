'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError, isAuthenticated } from '@/lib/api';
import { RoleName } from '@la-chat/shared-types';
import type { AnnouncementDto, UserProfileDto } from '@la-chat/shared-types';

interface AnnouncementList {
  items: AnnouncementDto[];
  total: number;
  page: number;
  pageSize: number;
}

const PUBLISHER_ROLES: RoleName[] = [
  RoleName.HEADTEACHER,
  RoleName.SCHOOL_ADMINISTRATOR,
  RoleName.TEACHER,
  RoleName.CLASS_TEACHER,
  RoleName.SCHOOL_SECRETARY,
  RoleName.DEPUTY_HEADTEACHER,
];

const CATEGORY_OPTIONS = ['SCHOOL_WIDE', 'CLASS', 'EXAM', 'TIMETABLE', 'ACADEMIC', 'EVENT', 'EMERGENCY', 'ADMINISTRATIVE'];
const PRIORITY_OPTIONS = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
const AUDIENCE_OPTIONS = ['ALL', 'CLASS', 'STREAM', 'STAFF', 'PARENTS'];

interface NewAnnouncementForm {
  title: string;
  body: string;
  category: string;
  priority: string;
  audience: string;
}

const EMPTY_FORM: NewAnnouncementForm = {
  title: '',
  body: '',
  category: 'SCHOOL_WIDE',
  priority: 'NORMAL',
  audience: 'ALL',
};

export default function AnnouncementsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewAnnouncementForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, list] = await Promise.all([
        apiFetch<UserProfileDto>('/users/me'),
        apiFetch<AnnouncementList>('/announcements'),
      ]);
      setProfile(p);
      setAnnouncements(list.items);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { router.replace('/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to load');
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    load();
  }, [load, router]);

  const canPublish = profile?.roles?.some((r) => PUBLISHER_ROLES.includes(r)) ?? false;

  async function handleCreate() {
    setFormError(null);
    if (form.title.trim().length < 2) { setFormError('Title must be at least 2 characters'); return; }
    if (form.body.trim().length < 1) { setFormError('Body cannot be empty'); return; }
    setSubmitting(true);
    try {
      const created = await apiFetch<AnnouncementDto>('/announcements', {
        method: 'POST',
        body: JSON.stringify({
          category: form.category,
          priority: form.priority,
          audience: form.audience,
          title: form.title,
          body: form.body,
        }),
      });
      setAnnouncements((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as any;
        setFormError(body?.message ?? `Request failed (${err.status})`);
      } else {
        setFormError(err instanceof Error ? err.message : 'Failed to create announcement');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAcknowledge(id: string) {
    setAcknowledgingId(id);
    try {
      await apiFetch(`/announcements/${id}/acknowledge`, { method: 'POST' });
      setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true, acknowledgementCount: a.acknowledgementCount + 1 } : a)));
    } catch { /* ignore */ } finally {
      setAcknowledgingId(null);
    }
  }

  if (loading) return <main style={styles.page}><p style={styles.loading}>Loading announcements…</p></main>;
  if (error) return (
    <main style={styles.page}>
      <div style={styles.errorCard}>
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <Link href="/chat" style={styles.link}>← Back to chat</Link>
      </div>
    </main>
  );

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <Link href="/chat" style={styles.backLink}>← Chat</Link>
          <h1 style={styles.title}>Announcements</h1>
          <div style={styles.headerActions}>
            {canPublish && !showForm && (
              <button style={styles.primaryButton} onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setFormError(null); }}>
                + New
              </button>
            )}
            {showForm && (
              <button style={styles.outlineButton} onClick={() => setShowForm(false)}>Cancel</button>
            )}
          </div>
        </header>

        {showForm && canPublish && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>New announcement</h2>
            <div style={styles.form}>
              <label style={styles.field}>
                <span style={styles.label}>Title</span>
                <input
                  style={styles.input}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. End of term schedule"
                  maxLength={200}
                />
              </label>

              <div style={styles.row}>
                <label style={styles.field}>
                  <span style={styles.label}>Category</span>
                  <select style={styles.select} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </select>
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Priority</span>
                  <select style={styles.select} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label style={styles.field}>
                  <span style={styles.label}>Audience</span>
                  <select style={styles.select} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                    {AUDIENCE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
              </div>

              <label style={styles.field}>
                <span style={styles.label}>Body</span>
                <textarea
                  style={{ ...styles.input, minHeight: '120px', resize: 'vertical' }}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Write the announcement…"
                  maxLength={10000}
                />
              </label>

              {formError && <p style={styles.formError}>{formError}</p>}

              <div style={styles.formActions}>
                <button style={{ ...styles.primaryButton, opacity: submitting ? 0.6 : 1 }} onClick={handleCreate} disabled={submitting}>
                  {submitting ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
          </section>
        )}

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>All announcements ({announcements.length})</h2>
          {announcements.length === 0 ? (
            <div style={styles.empty}>
              <p style={styles.emptyTitle}>No announcements yet</p>
              <p style={styles.emptyHint}>School-wide and class announcements will appear here. Check back soon.</p>
            </div>
          ) : (
            <div style={styles.annList}>
              {announcements.map((a) => (
                <article key={a.id} style={styles.annCard}>
                  <div style={styles.annHeader}>
                    <div style={styles.badgeRow}>
                      <span style={{ ...styles.priorityBadge, ...priorityStyle(a.priority) }}>{a.priority}</span>
                      <span style={styles.categoryBadge}>{a.category.replace(/_/g, ' ')}</span>
                      <span style={styles.audienceBadge}>{a.audience}</span>
                    </div>
                    <span style={styles.annDate}>{formatDate(a.publishedAt)}</span>
                  </div>
                  <h3 style={styles.annTitle}>{a.title}</h3>
                  <p style={styles.annBody}>{a.body}</p>
                  <div style={styles.annFooter}>
                    <span style={styles.annAuthor}>By {a.authorName || 'Unknown'}{a.targetClassName ? ` · ${a.targetClassName}` : ''}{a.targetStreamName ? ` · ${a.targetStreamName}` : ''}</span>
                    <div style={styles.ackRow}>
                      <span style={styles.ackCount}>✓ {a.acknowledgementCount} acknowledged</span>
                      {a.acknowledged ? (
                        <span style={styles.ackDone}>Acknowledged ✓</span>
                      ) : (
                        <button
                          style={{ ...styles.ackButton, opacity: acknowledgingId === a.id ? 0.6 : 1 }}
                          onClick={() => handleAcknowledge(a.id)}
                          disabled={acknowledgingId === a.id}
                        >
                          {acknowledgingId === a.id ? 'Acknowledging…' : 'Acknowledge'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function priorityStyle(priority: string): React.CSSProperties {
  switch (priority) {
    case 'CRITICAL': return { background: '#dc2626', color: 'white' };
    case 'HIGH': return { background: '#ea580c', color: 'white' };
    case 'NORMAL': return { background: '#1e3a5f', color: 'white' };
    case 'LOW': return { background: '#e2e8f0', color: '#475569' };
    default: return { background: '#1e3a5f', color: 'white' };
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return ''; }
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f0f2f5' },
  container: { maxWidth: '720px', margin: '0 auto', padding: '0' },
  header: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#1e3a5f', color: 'white' },
  backLink: { color: 'white', textDecoration: 'none', fontSize: '1.1rem' },
  title: { flex: 1, margin: 0, fontSize: '1.25rem', fontWeight: 700 },
  headerActions: { display: 'flex', gap: '0.5rem' },
  primaryButton: { padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: '#d4a017', color: '#1e3a5f', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' },
  outlineButton: { padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: 'white', cursor: 'pointer', fontSize: '0.85rem' },
  section: { background: 'white', margin: '0.75rem', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  sectionTitle: { margin: 0, padding: '0.75rem 1rem', fontSize: '0.95rem', color: '#1e3a5f', borderBottom: '1px solid #e2e8f0', fontWeight: 700 },
  form: { padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  row: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '120px' },
  label: { fontSize: '0.8rem', color: '#475569', fontWeight: 600 },
  input: { padding: '0.55rem 0.7rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontFamily: 'inherit', background: 'white', color: '#0f172a' },
  select: { padding: '0.55rem 0.7rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontFamily: 'inherit', background: 'white', color: '#0f172a' },
  formActions: { display: 'flex', justifyContent: 'flex-end' },
  formError: { margin: 0, padding: '0.5rem 0.75rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.85rem' },
  annList: { display: 'flex', flexDirection: 'column' },
  annCard: { padding: '1rem', borderBottom: '1px solid #f1f5f9' },
  annHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' },
  badgeRow: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  priorityBadge: { fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', letterSpacing: '0.04em' },
  categoryBadge: { fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '4px', background: '#eef2ff', color: '#3730a3', textTransform: 'uppercase' },
  audienceBadge: { fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '4px', background: '#f0f9ff', color: '#0369a1' },
  annDate: { fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 },
  annTitle: { margin: '0 0 0.4rem', fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 },
  annBody: { margin: '0 0 0.6rem', fontSize: '0.9rem', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  annFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  annAuthor: { fontSize: '0.78rem', color: '#64748b' },
  ackRow: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  ackCount: { fontSize: '0.75rem', color: '#94a3b8' },
  ackButton: { padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #1e3a5f', background: 'white', color: '#1e3a5f', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem' },
  ackDone: { fontSize: '0.78rem', color: '#22c55e', fontWeight: 700 },
  empty: { padding: '2rem 1rem', textAlign: 'center', color: '#64748b' },
  emptyTitle: { fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.5rem' },
  emptyHint: { fontSize: '0.8rem', lineHeight: 1.4 },
  loading: { padding: '2rem', textAlign: 'center', color: '#64748b' },
  errorCard: { background: 'white', padding: '2rem', borderRadius: '12px', maxWidth: '420px', margin: '2rem auto', textAlign: 'center' },
  link: { color: '#1e3a5f', textDecoration: 'none', display: 'inline-block', marginTop: '1rem' },
};
