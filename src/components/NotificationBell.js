import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, ActivityIndicator
} from "react-native";
import { getNotifications, markNotifRead, markAllNotifsRead } from "../api";

export default function NotificationBell() {
  const [notifs, setNotifs]     = useState([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);

  const unread = notifs.filter((n) => !n.read).length;

  const load = useCallback(async () => {
    try {
      const { data } = await getNotifications();
      setNotifs(data);
    } catch {}
  }, []);

  // Poll every 30s for new notifications
  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const handleOpen = () => { setOpen(true); load(); };

  const handleMarkAll = async () => {
    setLoading(true);
    try {
      await markAllNotifsRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
    setLoading(false);
  };

  const handleMarkOne = async (id) => {
    try {
      await markNotifRead(id);
      setNotifs((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n));
    } catch {}
  };

  return (
    <>
      <TouchableOpacity style={s.bell} onPress={handleOpen}>
        <Text style={s.bellIcon}>🔔</Text>
        {unread > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>🔔 Notifications</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={s.close}>✕</Text>
              </TouchableOpacity>
            </View>

            {notifs.length > 0 && (
              <TouchableOpacity style={s.markAllBtn} onPress={handleMarkAll} disabled={loading}>
                {loading
                  ? <ActivityIndicator size="small" color="#6366f1" />
                  : <Text style={s.markAllTxt}>Mark all as read</Text>
                }
              </TouchableOpacity>
            )}

            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              {notifs.length === 0 ? (
                <Text style={s.empty}>No notifications yet.</Text>
              ) : (
                notifs.map((n) => (
                  <TouchableOpacity
                    key={n._id}
                    style={[s.notifCard, !n.read && s.unreadCard]}
                    onPress={() => handleMarkOne(n._id)}
                  >
                    <Text style={s.notifIcon}>
                      {n.type === "printed" ? "✅" : "❌"}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.notifMsg, !n.read && s.unreadMsg]}>{n.message}</Text>
                      <Text style={s.notifTime}>
                        {new Date(n.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    {!n.read && <View style={s.dot} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  bell: { padding: 6, position: "relative" },
  bellIcon: { fontSize: 22 },
  badge: {
    position: "absolute", top: 0, right: 0,
    backgroundColor: "#ef4444", borderRadius: 10,
    minWidth: 18, height: 18, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeTxt: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 20, maxHeight: "75%",
  },
  sheetHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  close: { fontSize: 18, color: "#94a3b8", padding: 4 },
  markAllBtn: { alignSelf: "flex-end", marginBottom: 8 },
  markAllTxt: { color: "#6366f1", fontWeight: "600", fontSize: 13 },
  notifCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 14, borderRadius: 12, marginBottom: 8,
    backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0",
  },
  unreadCard: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  notifIcon: { fontSize: 20, marginTop: 2 },
  notifMsg: { fontSize: 14, color: "#475569", lineHeight: 20 },
  unreadMsg: { color: "#1e293b", fontWeight: "600" },
  notifTime: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#6366f1", marginTop: 6,
  },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40, fontSize: 15 },
});