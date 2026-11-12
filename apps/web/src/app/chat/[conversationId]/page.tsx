'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError, isAuthenticated } from '@/lib/api';
import { getMessagingSocket } from '@/lib/ws';
import type {
  ConversationDto,
  MessageDto,
  UserProfileDto,
} from '@la-chat/shared-types';
import {
  WsServerEvent,
} from '@la-chat/shared-types';

export default function ConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const router = useRouter();
  const conversationId = params.conversationId;

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [conversation, setConversation] = useState<ConversationDto | null>(null);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [connected, setConnected] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastReadMessageId = useRef<string | null>(null);

  // -----------------------------------------------------------------------
  // Load profile + conversation + initial message history
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [p, conv] = await Promise.all([
          apiFetch<UserProfileDto>('/users/me'),
          apiFetch<ConversationDto>(`/conversations/${conversationId}`),
        ]);
        if (cancelled) return;
        setProfile(p);
        setConversation(conv);

        const history = await apiFetch<{ items: MessageDto[] }>(
          `/conversations/${conversationId}/messages?limit=50`,
        );
        if (cancelled) return;
        // History comes newest-first; reverse for display (oldest at top)
        setMessages(history.items.slice().reverse());

        // Mark the newest message as read
        const newest = history.items[0];
        if (newest) {
          lastReadMessageId.current = newest.id;
          apiFetch(`/conversations/${conversationId}/read`, {
            method: 'POST',
            body: JSON.stringify({ lastReadMessageId: newest.id }),
          }).catch(() => {});
        }

        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [conversationId, router]);

  // -----------------------------------------------------------------------
  // WebSocket: join conversation, listen for real-time events
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!profile) return;

    const socket = getMessagingSocket();
    socket.connect();

    const unsubAuthorized = socket.on(WsServerEvent.AUTHORIZED, () => {
      setConnected(true);
      socket.joinConversation(conversationId);
    });
    const unsubNew = socket.on(WsServerEvent.MESSAGE_NEW, ({ message }) => {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => {
        // Deduplicate by id — the server may echo our own message back
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // If the new message is from someone else, mark it read (since we're
      // looking at the conversation)
      if (message.senderId !== profile.id) {
        lastReadMessageId.current = message.id;
        socket.markRead(conversationId, message.id);
      }
    });
    const unsubEdited = socket.on(WsServerEvent.MESSAGE_EDITED, ({ message }) => {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
    });
    const unsubDeleted = socket.on(WsServerEvent.MESSAGE_DELETED, ({ id }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, deletedAt: new Date().toISOString(), body: null } : m)),
      );
    });
    const unsubReactionAdded = socket.on(WsServerEvent.MESSAGE_REACTION_ADDED, ({ messageId, emoji, userId, reactions }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: reactions as any } : m)));
    });
    const unsubReactionRemoved = socket.on(WsServerEvent.MESSAGE_REACTION_REMOVED, ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: reactions as any } : m)));
    });
    const unsubTyping = socket.on(WsServerEvent.TYPING_UPDATE, ({ userId, fullName, typing }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (typing && userId !== profile.id) {
          next.set(userId, fullName ?? '');
        } else {
          next.delete(userId);
        }
        return next;
      });
    });
    const unsubReceipt = socket.on(WsServerEvent.READ_RECEIPT, () => {
      // Could update per-message read state; deferred for now
    });

    return () => {
      unsubAuthorized();
      unsubNew();
      unsubEdited();
      unsubDeleted();
      unsubReactionAdded();
      unsubReactionRemoved();
      unsubTyping();
      unsubReceipt();
      socket.leaveConversation(conversationId);
    };
  }, [conversationId, profile]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleSend = useCallback(() => {
    if (!draft.trim() || !profile) return;
    const body = draft.trim();
    const clientMessageId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Optimistic: show the message immediately with a pending indicator
    const optimistic: MessageDto = {
      id: `pending-${clientMessageId}`,
      conversationId,
      senderId: profile.id,
      senderName: profile.fullName,
      clientMessageId,
      type: 'TEXT',
      body,
      replyTo: null,
      reactions: [],
      attachments: [],
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      myDeliveryState: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');

    // Send via WebSocket (will be queued if not yet connected)
    const socket = getMessagingSocket();
    socket.sendMessage({
      conversationId,
      clientMessageId,
      type: 'TEXT',
      body,
    });
  }, [draft, conversationId, profile]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = (value: string) => {
    setDraft(value);
    const socket = getMessagingSocket();
    if (value.length > 0) {
      socket.typingStart(conversationId);
    } else {
      socket.typingStop(conversationId);
    }
  };

  if (loading) {
    return <main style={styles.page}><p style={styles.loading}>Loading conversation…</p></main>;
  }

  if (error) {
    return (
      <main style={styles.page}>
        <div style={styles.errorCard}>
          <h2>Cannot open conversation</h2>
          <p>{error}</p>
          <Link href="/chat" style={styles.link}>← Back to conversations</Link>
        </div>
      </main>
    );
  }

  const typingNames = Array.from(typingUsers.values());

  return (
    <main style={styles.page}>
      <div style={styles.chatShell}>
        {/* Header */}
        <header style={styles.header}>
          <Link href="/chat" style={styles.backLink}>←</Link>
          <div style={styles.headerTitleBlock}>
            <h1 style={styles.headerTitle}>
              {conversation?.title ?? (conversation?.type === 'GROUP' ? 'Group chat' : 'Private chat')}
            </h1>
            <span style={styles.headerSubtitle}>
              {conversation?.participants.map((p) => p.fullName).join(', ')}
            </span>
          </div>
          <span style={{ ...styles.connectionDot, background: connected ? '#22c55e' : '#94a3b8' }} title={connected ? 'Connected' : 'Reconnecting…'} />
        </header>

        {/* Messages */}
        <div style={styles.messagesArea}>
          {messages.length === 0 ? (
            <div style={styles.emptyMessages}>
              <p>No messages yet. Say hello!</p>
            </div>
          ) : (
            messages.map((m) => {
              const isOwn = m.senderId === profile?.id;
              return (
                <div key={m.id} style={{ ...styles.messageRow, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                  <div style={{ ...styles.bubble, ...(isOwn ? styles.bubbleOwn : styles.bubbleTheirs) }}>
                    {!isOwn && <div style={styles.senderName}>{m.senderName}</div>}
                    {m.deletedAt ? (
                      <span style={styles.deletedText}>This message was deleted</span>
                    ) : (
                      <span style={styles.messageBody}>{m.body}</span>
                    )}
                    {m.editedAt && !m.deletedAt && <span style={styles.editedTag}> (edited)</span>}
                    <div style={styles.metaRow}>
                      <span style={styles.timestamp}>{formatTime(m.createdAt)}</span>
                      {m.reactions.length > 0 && (
                        <span style={styles.reactionsRow}>
                          {Array.from(new Set(m.reactions.map((r) => r.emoji))).map((emoji) => (
                            <span key={emoji} style={styles.reactionChip}>
                              {emoji} {m.reactions.filter((r) => r.emoji === emoji).length}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {typingNames.length > 0 && (
            <div style={styles.typingIndicator}>
              {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <footer style={styles.composer}>
          <textarea
            style={styles.textarea}
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            value={draft}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={!connected}
          />
          <button
            style={{ ...styles.sendButton, opacity: draft.trim() && connected ? 1 : 0.4 }}
            onClick={handleSend}
            disabled={!draft.trim() || !connected}
          >
            Send
          </button>
        </footer>
      </div>
    </main>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f0f2f5', display: 'flex' },
  chatShell: { display: 'flex', flexDirection: 'column', width: '100%', height: '100vh' },
  header: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#1e3a5f', color: 'white', borderBottom: '1px solid #15294a' },
  backLink: { color: 'white', textDecoration: 'none', fontSize: '1.25rem', fontWeight: 700 },
  headerTitleBlock: { flex: 1, minWidth: 0 },
  headerTitle: { margin: 0, fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  headerSubtitle: { fontSize: '0.75rem', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  connectionDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  messagesArea: { flex: 1, overflow: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  messageRow: { display: 'flex', width: '100%' },
  bubble: { maxWidth: '70%', padding: '0.5rem 0.75rem', borderRadius: '12px', wordBreak: 'break-word' },
  bubbleOwn: { background: '#1e3a5f', color: 'white', borderBottomRightRadius: '4px' },
  bubbleTheirs: { background: 'white', color: '#0f172a', borderBottomLeftRadius: '4px', border: '1px solid #e2e8f0' },
  senderName: { fontSize: '0.75rem', fontWeight: 600, color: '#1e3a5f', marginBottom: '0.15rem' },
  messageBody: { fontSize: '0.95rem', lineHeight: 1.4, whiteSpace: 'pre-wrap' },
  deletedText: { fontSize: '0.9rem', fontStyle: 'italic', color: '#94a3b8' },
  editedTag: { fontSize: '0.7rem', color: '#94a3b8', marginLeft: '0.25rem' },
  metaRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', justifyContent: 'flex-end' },
  timestamp: { fontSize: '0.7rem', opacity: 0.6 },
  reactionsRow: { display: 'flex', gap: '0.15rem' },
  reactionChip: { background: 'rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.05rem 0.35rem', fontSize: '0.7rem' },
  typingIndicator: { fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', padding: '0 0.5rem' },
  emptyMessages: { textAlign: 'center', color: '#94a3b8', padding: '2rem', margin: 'auto' },
  composer: { display: 'flex', gap: '0.5rem', padding: '0.75rem', background: 'white', borderTop: '1px solid #e2e8f0' },
  textarea: { flex: 1, padding: '0.6rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'none', outline: 'none', minHeight: '40px', maxHeight: '120px' },
  sendButton: { padding: '0.6rem 1.25rem', background: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' },
  loading: { padding: '2rem', textAlign: 'center', color: '#64748b', margin: 'auto' },
  errorCard: { background: 'white', padding: '2rem', borderRadius: '12px', maxWidth: '420px', margin: 'auto', textAlign: 'center' },
  link: { color: '#1e3a5f', textDecoration: 'none', display: 'inline-block', marginTop: '1rem' },
};
