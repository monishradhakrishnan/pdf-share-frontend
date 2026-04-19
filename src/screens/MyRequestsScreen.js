import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  Platform, ScrollView
} from "react-native";
import { getMyPrintRequests } from "../api";

const STATUS_CONFIG = {
  pending:  { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", icon: "⏳", label: "Pending" },
  printed:  { color: "#10b981", bg: "#f0fdf4", border: "#bbf7d0", icon: "✅", label: "Printed" },
  rejected: { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", icon: "❌", label: "Rejected" },
};

export default function MyRequestsScreen() {
  const [requests, setRequests]   = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await getMyPrintRequests();
      setRequests(data);
    } catch {}
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    return (
      <View style={[s.card, { borderColor: cfg.border, backgroundColor: cfg.bg }]}>
        <View style={s.cardHeader}>
          <Text style={s.pdfName} numberOfLines={2}>📄 {item.pdfName}</Text>
          <View style={[s.badge, { backgroundColor: cfg.color }]}>
            <Text style={s.badgeTxt}>{cfg.icon} {cfg.label}</Text>
          </View>
        </View>
        {item.orderId && <Text style={s.orderId}>🆔 {item.orderId}</Text>}
        <Text style={s.meta}>🗂 {item.copies} cop{item.copies === 1 ? "y" : "ies"} · {item.colorMode === "color" ? "🌈 Color" : "⬛ B&W"}</Text>
        {item.billAmount > 0 && <Text style={s.bill}>💰 Bill: ₹{item.billAmount}</Text>}
        <Text style={s.time}>🕐 {new Date(item.createdAt).toLocaleString()}</Text>
        {item.status === "rejected" && item.rejectionReason && (
          <View style={s.reasonBox}>
            <Text style={s.reasonLabel}>Rejection reason:</Text>
            <Text style={s.reasonTxt}>{item.rejectionReason}</Text>
          </View>
        )}
      </View>
    );
  };

  const header = (
    <>
      <Text style={s.heading}>📋 My Print Requests</Text>
      <Text style={s.subheading}>
        {requests.length === 0 ? "No requests yet." : `${requests.length} total request${requests.length > 1 ? "s" : ""}`}
      </Text>
    </>
  );

  if (Platform.OS === "web") {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.webContent}>
        {header}
        {requests.length === 0
          ? <Text style={s.empty}>You haven't submitted any print requests yet.</Text>
          : requests.map((item) => <View key={item._id}>{renderItem({ item })}</View>)
        }
      </ScrollView>
    );
  }

  return (
    <View style={s.container}>
      <FlatList
        data={requests}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={s.empty}>You haven't submitted any print requests yet.</Text>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  webContent: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: "700", color: "#1e293b", marginTop: 16, marginHorizontal: 16 },
  subheading: { fontSize: 13, color: "#64748b", marginBottom: 12, marginHorizontal: 16 },
  card: {
    margin: 8, marginHorizontal: 16, padding: 16,
    borderRadius: 14, borderWidth: 1,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  pdfName: { fontSize: 15, fontWeight: "600", color: "#1e293b", flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  meta: { fontSize: 13, color: "#475569", marginBottom: 2 },
  time: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  orderId: { fontSize: 12, fontWeight: "700", color: "#6366f1", marginBottom: 4 },
  bill: { fontSize: 13, fontWeight: "700", color: "#10b981", marginTop: 2, marginTop: 10, backgroundColor: "#fff5f5", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#fecaca" },
  reasonLabel: { fontSize: 12, fontWeight: "700", color: "#dc2626", marginBottom: 2 },
  reasonTxt: { fontSize: 13, color: "#7f1d1d" },
  empty: { textAlign: "center", marginTop: 60, color: "#94a3b8", fontSize: 16 },
}
);