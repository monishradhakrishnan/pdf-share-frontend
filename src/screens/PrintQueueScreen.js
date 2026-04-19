import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, Modal, TextInput, Platform, ScrollView
} from "react-native";
import { getPrintQueue, getPrintBills, markAsPrinted, rejectPrintRequest, BASE_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export default function PrintQueueScreen() {
  const [tab, setTab]               = useState("queue");
  const [queue, setQueue]           = useState([]);
  const [bills, setBills]           = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectModal, setRejectModal]   = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [reason, setReason]         = useState("");
  const [acting, setActing]         = useState(false);
  const { token } = useAuth();

  const loadQueue = useCallback(async () => {
    try {
      const { data } = await getPrintQueue();
      setQueue(data);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || "Could not load queue");
    }
  }, []);

  const loadBills = useCallback(async () => {
    try {
      const { data } = await getPrintBills();
      setBills(data);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || "Could not load bills");
    }
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadQueue(), loadBills()]);
    setRefreshing(false);
  }, [loadQueue, loadBills]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = (item) => {
    const confirm = () =>
      markAsPrinted(item._id)
        .then(() => load())
        .catch((e) => Alert.alert("Error", e?.response?.data?.error || "Could not mark as printed"));

    if (Platform.OS === "web") {
      window.confirm(`Mark "${item.pdfName}" as printed?`) && confirm();
    } else {
      Alert.alert("Confirm Print", `Mark "${item.pdfName}" as printed?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Print ✅", onPress: confirm },
      ]);
    }
  };

  const openRejectModal = (item) => {
    setRejectTarget(item);
    setReason("");
    setRejectModal(true);
  };

  const handleReject = async () => {
    if (!reason.trim()) return Alert.alert("Required", "Please enter a rejection reason.");
    setActing(true);
    try {
      await rejectPrintRequest(rejectTarget._id, reason.trim());
      setRejectModal(false);
      load();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || "Could not reject request");
    } finally {
      setActing(false);
    }
  };

  const handleViewPDF = async (item) => {
    const pdfId = item.pdfId?._id || item.pdfId;
    const url = `${BASE_URL}/pdfs/${pdfId}/download?token=${token}`;
    if (Platform.OS === "web") {
      window.open(url, "_blank");
      return;
    }
    try {
      const safeFilename = item.pdfName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const localUri = FileSystem.documentDirectory + safeFilename;
      const result = await FileSystem.downloadAsync(url, localUri);
      if (result.status !== 200) return Alert.alert("Error", "Could not load PDF");
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(result.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    } catch (e) {
      Alert.alert("Error", e.message || "Could not open PDF");
    }
  };

  // ── Queue card ────────────────────────────────────────────────
  const renderQueueItem = ({ item, index }) => (
    <View style={s.card}>
      <View style={s.cardTopRow}>
        <View style={s.queueBadge}>
          <Text style={s.queueBadgeTxt}>#{index + 1}</Text>
        </View>
        <Text style={s.orderId}>{item.orderId}</Text>
        <View style={[s.colorBadge, item.colorMode === "color" ? s.colorBadgeColor : s.colorBadgeBW]}>
          <Text style={s.colorBadgeTxt}>
            {item.colorMode === "color" ? "🌈 Color" : "⬛ B&W"}
          </Text>
        </View>
      </View>

      <Text style={s.pdfName} numberOfLines={2}>📄 {item.pdfName}</Text>
      <Text style={s.meta}>👤 {item.senderName || item.sender?.name}</Text>
      <Text style={s.meta}>🗂 {item.copies} cop{item.copies === 1 ? "y" : "ies"} · {item.pageCount} page{item.pageCount !== 1 ? "s" : ""}</Text>
      {item.disappearAfterPrint && (
        <Text style={s.disappearBadge}>🗑 Disappears after print</Text>
      )}
      <Text style={s.time}>🕐 {new Date(item.createdAt).toLocaleString()}</Text>

      <TouchableOpacity style={s.viewBtn} onPress={() => handleViewPDF(item)}>
        <Text style={s.viewBtnTxt}>👁 View PDF</Text>
      </TouchableOpacity>

      <View style={s.actions}>
        <TouchableOpacity style={s.printBtn} onPress={() => handlePrint(item)}>
          <Text style={s.actionTxt}>✅ Print</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.rejectBtn} onPress={() => openRejectModal(item)}>
          <Text style={s.actionTxt}>❌ Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Bill card ─────────────────────────────────────────────────
  const renderBillItem = ({ item }) => {
    const rate = item.colorMode === "color" ? 5 : 1;
    return (
      <View style={s.billCard}>
        <View style={s.billHeader}>
          <Text style={s.billOrderId}>{item.orderId}</Text>
          <Text style={s.billAmount}>₹{item.billAmount}</Text>
        </View>
        <Text style={s.billPdfName} numberOfLines={1}>📄 {item.pdfName}</Text>
        <Text style={s.billMeta}>👤 {item.senderName || item.sender?.name}</Text>
        <View style={s.billBreakdown}>
          <View style={[s.colorBadge, item.colorMode === "color" ? s.colorBadgeColor : s.colorBadgeBW]}>
            <Text style={s.colorBadgeTxt}>{item.colorMode === "color" ? "🌈 Color" : "⬛ B&W"}</Text>
          </View>
          <Text style={s.billFormula}>
            {item.pageCount}p × {item.copies}c × ₹{rate} = ₹{item.billAmount}
          </Text>
        </View>
        <Text style={s.billTime}>🕐 {new Date(item.updatedAt).toLocaleString()}</Text>
      </View>
    );
  };

  const totalRevenue = bills.reduce((sum, b) => sum + (b.billAmount || 0), 0);

  const listHeader = (
    <>
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tabBtn, tab === "queue" && s.tabBtnActive]}
          onPress={() => setTab("queue")}
        >
          <Text style={[s.tabBtnTxt, tab === "queue" && s.tabBtnTxtActive]}>
            🖨️ Queue {queue.length > 0 ? `(${queue.length})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === "bills" && s.tabBtnActive]}
          onPress={() => setTab("bills")}
        >
          <Text style={[s.tabBtnTxt, tab === "bills" && s.tabBtnTxtActive]}>
            🧾 Bills {bills.length > 0 ? `(${bills.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "queue" && (
        <Text style={s.subheading}>
          {queue.length === 0
            ? "No pending requests."
            : `${queue.length} pending request${queue.length > 1 ? "s" : ""} — FCFS order`}
        </Text>
      )}

      {tab === "bills" && (
        <View style={s.revenueCard}>
          <Text style={s.revenueLabel}>Total Revenue</Text>
          <Text style={s.revenueAmount}>₹{totalRevenue}</Text>
          <Text style={s.revenueCount}>{bills.length} order{bills.length !== 1 ? "s" : ""} completed</Text>
        </View>
      )}
    </>
  );

  const currentData = tab === "queue" ? queue : bills;
  const renderItem  = tab === "queue" ? renderQueueItem : renderBillItem;
  const emptyText   = tab === "queue" ? "Queue is empty 🎉" : "No bills yet.";

  return (
    <View style={s.container}>
      {Platform.OS === "web" ? (
        <ScrollView contentContainerStyle={s.webContent}>
          {listHeader}
          {currentData.length === 0
            ? <Text style={s.empty}>{emptyText}</Text>
            : currentData.map((item, index) => (
                <View key={item._id}>{renderItem({ item, index })}</View>
              ))
          }
        </ScrollView>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={listHeader}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={s.empty}>{emptyText}</Text>}
        />
      )}

      <Modal visible={rejectModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>❌ Reject Request</Text>
            {rejectTarget && (
              <Text style={s.modalSub}>
                "{rejectTarget.pdfName}" from {rejectTarget.senderName}
              </Text>
            )}
            <Text style={s.reasonLabel}>Reason for rejection</Text>
            <TextInput
              style={s.reasonInput}
              placeholder="e.g. Out of paper, low ink, duplicate request..."
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[s.rejectConfirmBtn, acting && s.btnDisabled]}
              onPress={handleReject}
              disabled={acting}
            >
              <Text style={s.actionTxt}>Confirm Rejection</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setRejectModal(false)}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  webContent: { padding: 16, paddingBottom: 40 },
  tabs: {
    flexDirection: "row", margin: 16, marginBottom: 4,
    backgroundColor: "#e2e8f0", borderRadius: 12, padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabBtnTxt: { fontSize: 13, fontWeight: "600", color: "#94a3b8" },
  tabBtnTxtActive: { color: "#6366f1" },
  subheading: { fontSize: 13, color: "#64748b", marginBottom: 8, marginHorizontal: 16 },
  card: {
    backgroundColor: "#fff", margin: 8, marginHorizontal: 16,
    padding: 16, borderRadius: 14, shadowColor: "#000",
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  queueBadge: { backgroundColor: "#6366f1", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  queueBadgeTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  orderId: { flex: 1, fontSize: 13, fontWeight: "700", color: "#475569" },
  colorBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  colorBadgeBW: { backgroundColor: "#1e293b" },
  colorBadgeColor: { backgroundColor: "#f59e0b" },
  colorBadgeTxt: { color: "#fff", fontWeight: "700", fontSize: 11 },
  pdfName: { fontSize: 16, fontWeight: "600", color: "#1e293b", marginBottom: 6 },
  meta: { fontSize: 13, color: "#475569", marginBottom: 2 },
  disappearBadge: { fontSize: 12, color: "#ef4444", fontWeight: "600", marginTop: 2 },
  time: { fontSize: 12, color: "#94a3b8", marginTop: 4, marginBottom: 12 },
  viewBtn: { backgroundColor: "#6366f1", padding: 10, borderRadius: 10, alignItems: "center", marginBottom: 10 },
  viewBtnTxt: { color: "#fff", fontWeight: "600", fontSize: 13 },
  actions: { flexDirection: "row", gap: 10 },
  printBtn: { flex: 1, backgroundColor: "#10b981", padding: 12, borderRadius: 10, alignItems: "center" },
  rejectBtn: { flex: 1, backgroundColor: "#ef4444", padding: 12, borderRadius: 10, alignItems: "center" },
  actionTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  empty: { textAlign: "center", marginTop: 60, color: "#94a3b8", fontSize: 16 },
  revenueCard: {
    margin: 16, marginBottom: 8, backgroundColor: "#6366f1",
    borderRadius: 16, padding: 20, alignItems: "center",
  },
  revenueLabel: { color: "#c7d2fe", fontSize: 13, fontWeight: "600" },
  revenueAmount: { color: "#fff", fontSize: 36, fontWeight: "800", marginVertical: 4 },
  revenueCount: { color: "#c7d2fe", fontSize: 13 },
  billCard: {
    backgroundColor: "#fff", margin: 8, marginHorizontal: 16,
    padding: 16, borderRadius: 14, shadowColor: "#000",
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  billHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  billOrderId: { fontSize: 14, fontWeight: "700", color: "#6366f1" },
  billAmount: { fontSize: 20, fontWeight: "800", color: "#10b981" },
  billPdfName: { fontSize: 14, fontWeight: "600", color: "#1e293b", marginBottom: 4 },
  billMeta: { fontSize: 13, color: "#475569", marginBottom: 8 },
  billBreakdown: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  billFormula: { fontSize: 13, color: "#64748b", fontWeight: "600" },
  billTime: { fontSize: 11, color: "#94a3b8" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#1e293b", marginBottom: 6, textAlign: "center" },
  modalSub: { fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 16 },
  reasonLabel: { fontSize: 15, fontWeight: "600", color: "#1e293b", marginBottom: 8 },
  reasonInput: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10,
    padding: 12, fontSize: 14, backgroundColor: "#f8fafc",
    minHeight: 80, marginBottom: 16,
  },
  rejectConfirmBtn: { backgroundColor: "#ef4444", padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 8 },
  btnDisabled: { opacity: 0.5 },
  cancelBtn: { alignItems: "center", padding: 12 },
  cancelTxt: { color: "#64748b", fontWeight: "600", fontSize: 15 },
});