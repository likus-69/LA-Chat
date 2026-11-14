import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch, logout } from '../api';
import { getSocket } from '../ws';
import type { ConversationListItemDto, UserProfileDto } from '@la-chat/shared-types';
import type { RootStackParamList } from '../../App';

interface Props {
  user: UserProfileDto;
  onLogout: () => void;
}

export function ChatListScreen({ user, onLogout }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [conversations, setConversations] = useState<ConversationListItemDto[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: ConversationListItemDto[] }>('/conversations');
      setConversations(data.items);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadConversations();
    const socket = getSocket();
    socket.connect();
    const unsub = socket.on('message.new', () => { loadConversations(); });
    return () => { unsub(); };
  }, [loadConversations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, [loadConversations]);

  async function handleLogout() {
    await logout();
    onLogout();
  }

  function renderItem({ item }: { item: ConversationListItemDto }) {
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate('Chat', { conversationId: item.id, title: item.title ?? undefined })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.type === 'GROUP' ? '👥' : '💬'}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text style={styles.title} numberOfLines={1}>{item.title || (item.type === 'GROUP' ? 'Group' : 'Private')}</Text>
            {item.unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{item.unreadCount}</Text></View>}
          </View>
          <Text style={styles.preview} numberOfLines={1}>{item.lastMessagePreview || 'No messages yet'}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>LA Chat</Text>
          <Text style={styles.headerSubtitle}>{user.fullName}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Announcements')}>
            <Text style={styles.iconBtn}>📢</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.iconBtn}>⎋</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyHint}>Start a chat from the web app first.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1e3a5f' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  iconBtn: { fontSize: 22, color: '#fff', paddingHorizontal: 8 },
  item: { flexDirection: 'row', padding: 16, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 20 },
  body: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  title: { fontSize: 16, fontWeight: '600', color: '#0f172a', flex: 1 },
  badge: { backgroundColor: '#1e3a5f', borderRadius: 10, minWidth: 20, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  preview: { fontSize: 14, color: '#64748b' },
  separator: { height: 1, backgroundColor: '#f1f5f9', marginLeft: 72 },
  empty: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginBottom: 4 },
  emptyHint: { fontSize: 14, color: '#94a3b8' },
});
