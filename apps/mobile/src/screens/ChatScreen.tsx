import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { apiFetch } from '../api';
import { getSocket } from '../ws';
import type { MessageDto, ConversationDto } from '@la-chat/shared-types';
import { WsServerEvent } from '@la-chat/shared-types';

export function ChatScreen() {
  const route = useRoute<any>();
  const conversationId = route.params?.conversationId as string;
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [draft, setDraft] = useState('');
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      try {
        const history = await apiFetch<{ items: MessageDto[] }>(`/conversations/${conversationId}/messages?limit=50`);
        setMessages(history.items.slice().reverse());
        // Mark newest as read
        const newest = history.items[0];
        if (newest) {
          apiFetch(`/conversations/${conversationId}/read`, { method: 'POST', body: JSON.stringify({ lastReadMessageId: newest.id }) }).catch(() => {});
        }
      } catch { /* ignore */ }
    })();

    const socket = getSocket();
    socket.connect();
    const unsubAuth = socket.on(WsServerEvent.AUTHORIZED, () => { setConnected(true); socket.joinConversation(conversationId); });
    const unsubNew = socket.on(WsServerEvent.MESSAGE_NEW, ({ message }: { message: MessageDto }) => {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => prev.some((m) => m.id === message.id) ? prev : [...prev, message]);
      socket.markRead(conversationId, message.id);
    });
    const unsubEdit = socket.on(WsServerEvent.MESSAGE_EDITED, ({ message }: { message: MessageDto }) => {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
    });
    const unsubDel = socket.on(WsServerEvent.MESSAGE_DELETED, ({ id }: { id: string }) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deletedAt: new Date().toISOString(), body: null } : m)));
    });
    const unsubTyping = socket.on(WsServerEvent.TYPING_UPDATE, ({ userId, fullName, typing }: any) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (typing) next.set(userId, fullName || '');
        else next.delete(userId);
        return next;
      });
    });

    return () => { unsubAuth(); unsubNew(); unsubEdit(); unsubDel(); unsubTyping(); socket.leaveConversation(conversationId); };
  }, [conversationId]);

  const handleSend = useCallback(() => {
    if (!draft.trim()) return;
    const body = draft.trim();
    const clientMessageId = `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setMessages((prev) => [...prev, {
      id: `pending-${clientMessageId}`, conversationId, senderId: '', senderName: 'You',
      clientMessageId, type: 'TEXT', body, replyTo: null, reactions: [], attachments: [],
      editedAt: null, deletedAt: null, createdAt: new Date().toISOString(), myDeliveryState: null,
    }]);
    setDraft('');
    getSocket().sendMessage({ conversationId, clientMessageId, type: 'TEXT', body });
    getSocket().typingStop(conversationId);
  }, [draft, conversationId]);

  function renderMessage({ item }: { item: MessageDto }) {
    const isOwn = item.senderName === 'You' || item.id.startsWith('pending-');
    return (
      <View style={[styles.msgRow, isOwn ? styles.msgOwn : styles.msgTheirs]}>
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleTheirs]}>
          {!isOwn && <Text style={styles.senderName}>{item.senderName}</Text>}
          {item.deletedAt ? (
            <Text style={styles.deletedText}>This message was deleted</Text>
          ) : (
            <Text style={styles.msgBody}>{item.body}</Text>
          )}
          <Text style={styles.timestamp}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      </View>
    );
  }

  const typingNames = Array.from(typingUsers.values());

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No messages yet. Say hello!</Text></View>}
        ListFooterComponent={typingNames.length > 0 ? <Text style={styles.typing}>{typingNames.join(', ')} typing…</Text> : null}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          value={draft}
          onChangeText={(v) => { setDraft(v); if (v) getSocket().typingStart(conversationId); else getSocket().typingStop(conversationId); }}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]} onPress={handleSend} disabled={!draft.trim()}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  msgRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 4 },
  msgOwn: { justifyContent: 'flex-end' },
  msgTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', padding: 10, borderRadius: 12 },
  bubbleOwn: { backgroundColor: '#1e3a5f', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  senderName: { fontSize: 12, fontWeight: '600', color: '#1e3a5f', marginBottom: 2 },
  msgBody: { fontSize: 15, lineHeight: 20, color: '#0f172a' },
  deletedText: { fontSize: 14, fontStyle: 'italic', color: '#94a3b8' },
  timestamp: { fontSize: 11, color: '#94a3b8', marginTop: 4, textAlign: 'right' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { color: '#94a3b8' },
  typing: { fontSize: 13, color: '#64748b', fontStyle: 'italic', paddingHorizontal: 16, paddingVertical: 4 },
  composer: { flexDirection: 'row', padding: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  input: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16 },
  sendBtn: { backgroundColor: '#1e3a5f', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center', marginLeft: 8 },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontWeight: '600' },
});
