'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError, isAuthenticated } from '@/lib/api';
import type { NotificationDto, NotificationPreferencesDto, UserProfileDto } from '@la-chat/shared-types';

interface NotificationList {
  items: NotificationDto[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefs] = useState<NotificationPreferencesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, list, preferences] = await Promise.all([
        apiFetch<UserProfileDto>('/users/me'),
        apiFetch<NotificationList>('/notifications'),
        apiFetch<NotificationPreferencesDto>('/notifications/preferences'),
      ]);
      setProfile(p);
      setNotifications(list.items);
      setUnread(list.unread);
      setPrefs(preferences);
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

  async function handleMarkAllRead() {
    try {
      await apiFetch('/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
      setUnread(0);
    } catch { /* ignore */ }
  }

  async function handleMarkRead(id: string) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch { /* ignore */ }
  }

  async function handleTogglePref() {
    if (!prefs) return;
    const updated = { ...prefs, enabled: !prefs.enabled };
    setPrefs(updated);
    try {
      await apiFetch('/notifications/preferences', { method: 'PATCH', body: JSON.stringify({ enabled: updated.enabled }) });
    } catch { setPrefs(prefs); }
  }

  if (loading) return <main style={styles.page}><p style={styles.loading}>Loading notifications…</p></main>;
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
          <h1 style={styles.title}>Notifications</h1>
          <div style={styles.headerActions}>
            {unread > 0 && <button style={styles.outlineButton} onClick={handleMarkAllRead}>Mark all read</button>}
          </div>
        </header>

        <section style={styles.section}>
          <div style={styles.prefRow}>
            <div>
              <span style={styles.prefLabel}>Push notifications</span>
              <span style={styles.prefValue}>{prefs?.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <button style={{ ...styles.toggleButton, ...(prefs?.enabled ? styles.toggleOn : styles.toggleOff) }} onClick={handleTogglePref}>
              {prefs?.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <p style={styles.prefHint}>Per-type preferences and quiet hours can be configured here in a future update.</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Recent ({notifications.length})</h2>
          {notifications.length === 0 ? (
            <div style={styles.empty}>
              <p style={styles.emptyTitle}>No notifications yet</p>
              <p style={styles.emptyHint}>You'll see message notifications, announcements and account updates here.</p>
            </div>
          ) : (
            <div style={styles.notifList}>
              {notifications.map((n) => (
                <div key={n.id} style={{ ...styles.notifItem, ...(n.readAt ? styles.notifRead : styles.notifUnread) }} onClick={() => !n.readAt && handleMarkRead(n.id)}>
                  <div style={styles.notifIcon}>{iconForType(n.type)}</div>
                  <div style={styles.notifBody}>
                    <div style={styles.notifTitle}>{titleForType(n.type)}</div>
                    <div style={styles.notifPreview}>{previewForPayload(n.payload)}</div>
                    <div style={styles.notifTime}>{formatTime(n.createdAt)}</div>
                  </div>
                  {!n.readAt && <span style={styles.unreadDot} />}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function iconForType(type: string): string {
  switch (type) {
    case 'message.new': return '💬';
    case 'announcement.new': return '📢';
    case 'report.status': return '🚩';
    case 'account.approved': return '✓';
    case 'account.suspended': return '⚠';
    default: return '🔔';
  }
}

function titleForType(type: string): string {
  switch (type) {
    case 'message.new': return 'New message';
    case 'announcement.new': return 'New announcement';
    case 'report.status': return 'Report status update';
    case 'account.approved': return 'Account approved';
    case 'account.suspended': return 'Account suspended';
    default: return 'Notification';
  }
}

function previewForPayload(payload: Record<string, unknown>): string {
  const sender = payload.senderName as string | undefined;
  if (sender) return `From ${sender}`;
  return '';
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f0f2f5' },
  container: { maxWidth: '640px', margin: '0 auto', padding: '0' },
  header: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#1e3a5f', color: 'white' },
  backLink: { color: 'white', textDecoration: 'none', fontSize: '1.1rem' },
  title: { flex: 1, margin: 0, fontSize: '1.25rem', fontWeight: 700 },
  headerActions: { display: 'flex', gap: '0.5rem' },
  outlineButton: { padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', cursor: 'pointer', fontSize: '0.8rem' },
  section: { background: 'white', margin: '0.75rem', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  sectionTitle: { margin: 0, padding: '0.75rem 1rem', fontSize: '0.95rem', color: '#1e3a5f', borderBottom: '1px solid #e2e8f0' },
  prefRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' },
  prefLabel: { display: 'block', fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' },
  prefValue: { display: 'block', fontSize: '0.8rem', color: '#64748b' },
  prefHint: { margin: 0, padding: '0 1rem 1rem', fontSize: '0.8rem', color: '#64748b' },
  toggleButton: { padding: '0.4rem 1rem', borderRadius: '20px', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' },
  toggleOn: { background: '#22c55e', color: 'white' },
  toggleOff: { background: '#e2e8f0', color: '#64748b' },
  notifList: { display: 'flex', flexDirection: 'column' },
  notifItem: { display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', alignItems: 'flex-start' },
  notifRead: { background: 'white' },
  notifUnread: { background: '#eff6ff' },
  notifIcon: { fontSize: '1.5rem', flexShrink: 0 },
  notifBody: { flex: 1, minWidth: 0 },
  notifTitle: { fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' },
  notifPreview: { fontSize: '0.85rem', color: '#64748b', marginTop: '0.15rem' },
  notifTime: { fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' },
  unreadDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#1e3a5f', flexShrink: 0, marginTop: '0.4rem' },
  empty: { padding: '2rem 1rem', textAlign: 'center', color: '#64748b' },
  emptyTitle: { fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.5rem' },
  emptyHint: { fontSize: '0.8rem', lineHeight: 1.4 },
  loading: { padding: '2rem', textAlign: 'center', color: '#64748b' },
  errorCard: { background: 'white', padding: '2rem', borderRadius: '12px', maxWidth: '420px', margin: '2rem auto', textAlign: 'center' },
  link: { color: '#1e3a5f', textDecoration: 'none', display: 'inline-block', marginTop: '1rem' },
};
