import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

const STATUS_COLOR = { pending: '#F59E0B', approved: '#10B981', rejected: '#EF4444' };

export default function AdminScreen() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const { signOut } = useAuth();

  const fetchRequests = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const { data } = await api.get('/auth/access-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchRequests(); }, []));

  const action = async (id, type) => {
    // Alert.alert buttons don't work on web — use window.confirm instead
    const confirmed = window.confirm
      ? window.confirm(`Are you sure you want to ${type} this request?`)
      : true;

    if (!confirmed) return;

    try {
      const token = await AsyncStorage.getItem('token');
      await api.post(
        `/auth/access-requests/${id}/${type}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.alert
        ? window.alert(`Request ${type}d and user notified via email.`)
        : Alert.alert('Done', `Request ${type}d and user notified via email.`);
      fetchRequests();
    } catch (err) {
      const msg = err.response?.data?.error || 'Action failed.';
      window.alert ? window.alert(msg) : Alert.alert('Error', msg);
    }
  };

  const renderItem = ({ item }) => {
    const isOpen = expanded === item._id;
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => setExpanded(isOpen ? null : item._id)}
        activeOpacity={0.85}
      >
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{item.name}</Text>
            <Text style={s.email}>{item.email}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: STATUS_COLOR[item.status] + '22' }]}>
            <Text style={[s.badgeText, { color: STATUS_COLOR[item.status] }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {isOpen && (
          <View style={s.detail}>
            <Detail label="Organization" value={item.organization} />
            <Detail label="About" value={item.about} />
            <Detail label="Submitted" value={new Date(item.createdAt).toLocaleString()} />
            {item.status === 'pending' && (
              <View style={s.actions}>
                <TouchableOpacity style={s.approveBtn} onPress={() => action(item._id, 'approve')}>
                  <Text style={s.actionText}>✓ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.rejectBtn} onPress={() => action(item._id, 'reject')}>
                  <Text style={s.actionText}>✕ Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <ActivityIndicator style={{ flex: 1, backgroundColor: '#0f172a' }} color="#4F46E5" />;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Access Requests</Text>
          <Text style={s.count}>
            {requests.length} total · {requests.filter(r => r.status === 'pending').length} pending
          </Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={signOut}>
          <Text style={s.logoutText}>⏻ Logout</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={requests}
        keyExtractor={i => i._id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchRequests(); }}
            tintColor="#4F46E5"
          />
        }
        ListEmptyComponent={<Text style={s.empty}>No requests yet.</Text>}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </View>
  );
}

function Detail({ label, value }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#f1f5f9', marginBottom: 2 },
  count: { fontSize: 13, color: '#64748b' },
  logoutBtn: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#EF4444', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
  card: {
    backgroundColor: '#1e293b', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#334155',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: '#f1f5f9' },
  email: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  detail: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 12 },
  label: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  value: { fontSize: 14, color: '#cbd5e1', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  approveBtn: { flex: 1, backgroundColor: '#10B981', borderRadius: 8, padding: 12, alignItems: 'center' },
  rejectBtn: { flex: 1, backgroundColor: '#EF4444', borderRadius: 8, padding: 12, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 15 },

});