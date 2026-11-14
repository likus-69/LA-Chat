'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError, isAuthenticated, logout } from '@/lib/api';
import { getMessagingSocket } from '@/lib/ws';
import type { ConversationListItemDto, UserProfileDto } from '@la-chat/shared-types';

export default function ChatListPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [conversations, setConversations] = useState<ConversationListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    Promise.all([
      apiFetch<UserProfileDto>('/users/me'),
      apiFetch<{ items: ConversationListItemDto[] }>('/conversations'),
    ])
      .then(([p, c]) => {
        setProfile(p);
        setConversations(c.items);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load');
        setLoading(false);
      });

    // Listen for new messages to update the conversation list preview
    const socket = getMessagingSocket();
    socket.connect();
    const unsub = socket.on('message.new' as any, () => {
      // Refresh the conversation list when a new message arrives
      apiFetch<{ items: ConversationListItemDto[] }>('/conversations')
        .then((c) => setConversations(c.items))
        .catch(() => {});
    });

    return () => {
      unsub();
    };
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
      <div style={styles.container}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <div>
              <h1 style={styles.title}>LA Chat</h1>
              <p style={styles.subtitle}>{profile?.fullName}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <Link href="/announcements" style={styles.iconButton} title="Announcements">📢</Link>
              <Link href="/notifications" style={styles.iconButton} title="Notifications">🔔</Link>
              <button onClick={handleLogout} style={styles.iconButton} title="Sign out">⎋</button>
            </div>
          </div>

          <div style={styles.conversationList}>
            {conversations.length === 0 ? (
              <div style={styles.empty}>
                <p style={styles.emptyTitle}>No conversations yet</p>
                <p style={styles.emptyHint}>
                  Conversations appear here once you start messaging. Use the &quot;New chat&quot; button below.
                </p>
              </div>
            ) : (
              conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/chat/${c.id}`}
                  style={styles.conversationItem}
                >
                  <div style={styles.conversationAvatar}>
                    {c.type === 'GROUP' ? '👥' : '💬'}
                  </div>
                  <div style={styles.conversationBody}>
                    <div style={styles.conversationTopRow}>
                      <span style={styles.conversationTitle}>
                        {c.title ?? (c.type === 'GROUP' ? 'Group chat' : 'Private chat')}
                      </span>
                      {c.unreadCount > 0 && (
                        <span style={styles.unreadBadge}>{c.unreadCount}</span>
                      )}
                    </div>
                    <div style={styles.conversationPreview}>
                      {c.lastMessagePreview ?? 'No messages yet'}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </aside>

        {/* Main panel — empty state */}
        <section style={styles.mainPanel}>
          <div style={styles.welcomeState}>
            <div style={styles.welcomeLogo}>LA</div>
            <h2 style={styles.welcomeTitle}>Welcome to LA Chat</h2>
            <p style={styles.welcomeText}>
              Select a conversation from the sidebar, or start a new one.
            </p>
            <p className="brand-motto" style={styles.motto}>
              A Different Approach to Education
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f0f2f5', display: 'flex' },
  container: { display: 'flex', width: '100%', height: '100vh' },
  sidebar: { width: '340px', background: 'white', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  sidebarHeader: { padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1e3a5f', color: 'white' },
  title: { margin: 0, fontSize: '1.25rem', fontWeight: 700 },
  subtitle: { margin: 0, fontSize: '0.8rem', opacity: 0.8 },
  iconButton: { background: 'transparent', border: 'none', color: 'white', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem 0.5rem' },
  conversationList: { flex: 1, overflow: 'auto' },
  conversationItem: { display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', textDecoration: 'none', color: 'inherit', cursor: 'pointer' },
  conversationAvatar: { width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', display: 'grid', placeItems: 'center', fontSize: '1.25rem', flexShrink: 0 },
  conversationBody: { flex: 1, minWidth: 0 },
  conversationTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' },
  conversationTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  conversationPreview: { fontSize: '0.85rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  unreadBadge: { background: '#1e3a5f', color: 'white', fontSize: '0.7rem', fontWeight: 700, borderRadius: '10px', padding: '0.1rem 0.45rem', minWidth: '20px', textAlign: 'center' },
  empty: { padding: '2rem 1rem', textAlign: 'center', color: '#64748b' },
  emptyTitle: { fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.5rem' },
  emptyHint: { fontSize: '0.8rem', lineHeight: 1.4 },
  mainPanel: { flex: 1, display: 'grid', placeItems: 'center', background: '#f0f2f5' },
  welcomeState: { textAlign: 'center', padding: '2rem' },
  welcomeLogo: { width: '72px', height: '72px', borderRadius: '16px', background: '#1e3a5f', color: '#d4a017', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '2rem', margin: '0 auto 1rem' },
  welcomeTitle: { fontSize: '1.5rem', color: '#1e3a5f', margin: '0 0 0.5rem' },
  welcomeText: { color: '#64748b', margin: '0 0 1rem' },
  motto: { fontStyle: 'italic', color: '#94a3b8', fontSize: '0.85rem' },
  card: { background: 'white', padding: '2rem', borderRadius: '12px', maxWidth: '420px' },
  button: { padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: '#1e3a5f', color: 'white', cursor: 'pointer' },
};
