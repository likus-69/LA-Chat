import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { apiFetch } from '../api';
import type { AnnouncementDto } from '@la-chat/shared-types';

export function AnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: AnnouncementDto[] }>('/announcements');
      setAnnouncements(data.items);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  function renderItem({ item }: { item: AnnouncementDto }) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={[styles.priorityBadge, item.priority === 'CRITICAL' ? styles.critical : item.priority === 'HIGH' ? styles.high : styles.normal]}>
            <Text style={styles.priorityText}>{item.priority}</Text>
          </View>
          <Text style={styles.category}>{item.category.replace('_', ' ')}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body} numberOfLines={4}>{item.body}</Text>
        <View style={styles.footer}>
          <Text style={styles.author}>{item.authorName}</Text>
          <Text style={styles.date}>{new Date(item.publishedAt).toLocaleDateString()}</Text>
          {!item.acknowledged && (
            <TouchableOpacity onPress={() => apiFetch(`/announcements/${item.id}/acknowledge`, { method: 'POST' }).then(load)}>
              <Text style={styles.ackBtn}>Acknowledge</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={announcements}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No announcements</Text></View>}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 12 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 },
  headerRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  priorityText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  critical: { backgroundColor: '#b91c1c' },
  high: { backgroundColor: '#d97706' },
  normal: { backgroundColor: '#1e3a5f' },
  category: { fontSize: 12, color: '#64748b', textTransform: 'capitalize' },
  title: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  body: { fontSize: 14, color: '#475569', lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  author: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  date: { fontSize: 12, color: '#94a3b8' },
  ackBtn: { marginLeft: 'auto', color: '#1e3a5f', fontSize: 13, fontWeight: '600' },
  empty: { paddingTop: 100, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontSize: 16 },
});
