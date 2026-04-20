import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Platform, Modal, TextInput, ScrollView
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { BASE_URL, searchUsers, sharePDF, submitPrintRequest, getPrintShops } from "../api";
import { useAuth } from "../context/AuthContext";

const TIME_OPTIONS = [
  { label: "5 mins",   value: 5 },
  { label: "15 mins",  value: 15 },
  { label: "30 mins",  value: 30 },
  { label: "1 Hour",   value: 60 },
  { label: "6 Hours",  value: 360 },
  { label: "1 Day",    value: 1440 },
  { label: "7 Days",   value: 10080 },
  { label: "Custom",   value: "custom" },
  { label: "No Limit", value: null },
];

export default function PDFDetailScreen({ route }) {
  const { pdf } = route.params;
  const { token } = useAuth();

  // Share modal state
  const [downloading, setDownloading]       = useState(false);
  const [printing, setPrinting]             = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [searchEmail, setSearchEmail]       = useState("");
  const [searchResults, setSearchResults]   = useState([]);
  const [searching, setSearching]           = useState(false);
  const [sharing, setSharing]               = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState(60);
  const [selectedUser, setSelectedUser]     = useState(null);
  const [customHours, setCustomHours]       = useState("");

  // Print request state
  const [showPrintModal, setShowPrintModal]           = useState(false);
  const [printStep, setPrintStep]                     = useState(1);
  const [shops, setShops]                             = useState([]);
  const [shopsLoading, setShopsLoading]               = useState(false);
  const [selectedShop, setSelectedShop]               = useState(null);
  const [copies, setCopies]                           = useState("1");
  const [colorMode, setColorMode]                     = useState("bw");
  const [disappearAfterPrint, setDisappearAfterPrint] = useState(false);
  const [submitting, setSubmitting]                   = useState(false);

  // ── Download to local cache (native only) ────────────────────
  const downloadToLocal = async () => {
  const storedToken = await AsyncStorage.getItem("token");

  if (!storedToken) {
    throw new Error("Missing auth token");
  }

  const url = `${BASE_URL}/pdfs/${pdf._id}/download?token=${storedToken}`;

  const sanitizedName = (pdf.originalName || "file.pdf").replace(
    /[^a-zA-Z0-9.]/g,
    "_"
  );

  const localUri = FileSystem.documentDirectory + sanitizedName;

  // Remove old cached file
  const existing = await FileSystem.getInfoAsync(localUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(localUri, { idempotent: true });
  }

  const download = await FileSystem.downloadAsync(url, localUri);

  // Validate file
  const fileInfo = await FileSystem.getInfoAsync(download.uri);
  if (!fileInfo.exists || fileInfo.size === 0) {
    throw new Error("Downloaded file is empty or missing");
  }

  return download.uri;
};

  const handleShare = async () => {
    if (Platform.OS === "web") {
      try {
        const res = await fetch(`${BASE_URL}/pdfs/${pdf._id}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Download failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = pdf.originalName || "document.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        Alert.alert("Download Error", e.message || "Could not download PDF");
      }
      return;
    }
    const uri = await downloadToLocal();
    if (!uri) return;
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return Alert.alert("Error", "Sharing not available on this device");
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `Share ${pdf.originalName}`,
      UTI: "com.adobe.pdf",
    });
  };

const handlePrint = async () => {
  try {
    setPrinting(true);

    const localUri = await downloadToLocal();

    await Print.printAsync({ uri: localUri });

  } catch (err) {
    console.log("PRINT ERROR:", err);

    Alert.alert(
      "Print Failed",
      err.message === "Downloaded file is empty or missing"
        ? "Server is waking up, please wait 15 seconds and try again."
        : err.message || "Could not prepare PDF for printing."
    );
  } finally {
    setPrinting(false);
  }
};
  // ── Share modal handlers ──────────────────────────────────────
  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setSelectedUser(null);
    try {
      const { data } = await searchUsers(searchEmail.trim());
      setSearchResults(data);
      if (data.length === 0) Alert.alert("No users found", "Try a different email");
    } catch {
      Alert.alert("Error", "Could not search users");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchResults([]);
    setSearchEmail(user.email);
    if (user.email?.endsWith("@print.com")) {
      setShowShareModal(false);
      openPrintModal();
    }
  };

  const handleShareWithUser = async () => {
    if (!selectedUser) return Alert.alert("No user selected", "Search and select a user first");
    let expiryHours = selectedExpiry;
    if (selectedExpiry === "custom") {
      const parsed = parseFloat(customHours);
      if (!customHours || isNaN(parsed) || parsed <= 0)
        return Alert.alert("Invalid time", "Please enter a valid number of hours");
      expiryHours = parsed;
    }
    setSharing(true);
    try {
      const { data } = await sharePDF(pdf._id, selectedUser._id, expiryHours);
      Alert.alert("Shared! 🎉", data.message);
      closeShareModal();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || "Could not share PDF");
    } finally {
      setSharing(false);
    }
  };

  const closeShareModal = () => {
    setShowShareModal(false);
    setSearchEmail("");
    setSearchResults([]);
    setSelectedUser(null);
    setSelectedExpiry(24);
    setCustomHours("");
  };

  // ── Print modal handlers ──────────────────────────────────────
const openPrintModal = async () => {
  setShowPrintModal(true);
  setPrintStep(1);
  setSelectedShop(null);
  setCopies("1");
  setDisappearAfterPrint(false);
  setShopsLoading(true);

  try {
    console.log("Fetching print shops...");

    const response = await getPrintShops();

    console.log("PRINT SHOPS RESPONSE:", response?.data);

    if (!response?.data) {
      throw new Error("No data received");
    }

    setShops(response.data);

  } catch (err) {
    console.log("ERROR:", err.message);
    console.log("FULL ERROR:", err);

    Alert.alert(
      "Could Not Load Shops",
      err.code === "ECONNABORTED"
        ? "Server took too long to respond. Try again."
        : "Server might be waking up. Please wait a few seconds and retry."
    );

  } finally {
    setShopsLoading(false); // 🔥 VERY IMPORTANT
  }
};
  const closePrintModal = () => {
    setShowPrintModal(false);
    setPrintStep(1);
    setCopies("1");
    setColorMode("bw");
    setDisappearAfterPrint(false);
    setSelectedShop(null);
    setShops([]);
  };

  const handleSubmitPrint = async () => {
    const num = parseInt(copies, 10);
    if (!copies || isNaN(num) || num < 1)
      return Alert.alert("Invalid", "Please enter a valid number of copies (min 1)");
    setSubmitting(true);
    try {
      await submitPrintRequest(pdf._id, num, selectedShop._id, disappearAfterPrint, colorMode);
      Alert.alert(
        "Sent! 🖨️",
        `Print request submitted to ${selectedShop.name} for ${num} cop${num === 1 ? "y" : "ies"}.` +
        (disappearAfterPrint ? "\n\n🗑 PDF will be deleted after printing." : "")
      );
      closePrintModal();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || "Could not submit print request");
    } finally {
      setSubmitting(false);
    }
  };

  const formatSize = (bytes) => (bytes / 1024 / 1024).toFixed(2) + " MB";

  const expiryInfoText = () => {
    if (selectedExpiry === null) return "♾ PDF will stay until manually removed";
    if (selectedExpiry === "custom")
      return customHours ? `📅 PDF will disappear after ${customHours} minute(s)` : "Enter custom minutes above";
    return `📅 PDF will disappear after ${TIME_OPTIONS.find(o => o.value === selectedExpiry)?.label}`;
  };

  return (
    <View style={s.container}>
      <View style={s.iconBox}>
        <Text style={s.icon}>📄</Text>
      </View>
      <Text style={s.title} numberOfLines={2}>{pdf.originalName}</Text>

      <View style={s.card}>
        <Row label="Uploaded by" value={pdf.uploaderName} />
        <Row label="File size" value={formatSize(pdf.size)} />
        <Row label="Upload date" value={new Date(pdf.createdAt).toLocaleDateString()} />
        {pdf.expiresAt && (
          <Row label="Access expires" value={new Date(pdf.expiresAt).toLocaleString()} />
        )}
      </View>

      <TouchableOpacity style={s.btn} onPress={() => setShowShareModal(true)}>
        <Text style={s.btnTxt}>👤 Share with User</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.btn, s.printReqBtn]} onPress={openPrintModal}>
        <Text style={s.btnTxt}>🖨️ Send to Print</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.btn, s.shareBtn]} onPress={handleShare} disabled={downloading}>
        {downloading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>⬇️ Download PDF</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={[s.btn, s.printBtn]} onPress={handlePrint} disabled={printing}>
        {printing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>🖨 Print PDF</Text>}
      </TouchableOpacity>

      {/* ── Share with User Modal ─────────────────────────────── */}
      <Modal visible={showShareModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>👤 Share with User</Text>
            <View style={s.searchRow}>
              <TextInput
                style={s.searchInput}
                placeholder="Search by email..."
                value={searchEmail}
                onChangeText={(t) => { setSearchEmail(t); setSelectedUser(null); }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity style={s.searchBtn} onPress={handleSearch} disabled={searching}>
                {searching
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.searchBtnTxt}>Search</Text>}
              </TouchableOpacity>
            </View>

            {searchResults.length > 0 && (
              <View style={s.resultsList}>
                {searchResults.map((item) => (
                  <TouchableOpacity key={item._id} style={s.userRow} onPress={() => handleSelectUser(item)}>
                    <Text style={s.userName}>{item.name}</Text>
                    <Text style={s.userEmail}>{item.email}</Text>
                    {item.email?.endsWith("@print.com") && (
                      <Text style={s.printBadge}>🖨️ Print Admin</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedUser && !selectedUser.email?.endsWith("@print.com") && (
              <View style={s.selectedUser}>
                <Text style={s.selectedUserTxt}>✅ {selectedUser.name} ({selectedUser.email})</Text>
              </View>
            )}

            {selectedUser && !selectedUser.email?.endsWith("@print.com") && (
              <>
                <Text style={s.expiryLabel}>⏱ Access Time Limit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.timeScroll}>
                  {TIME_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={String(opt.value)}
                      style={[s.timeChip, selectedExpiry === opt.value && s.timeChipActive]}
                      onPress={() => { setSelectedExpiry(opt.value); setCustomHours(""); }}
                    >
                      <Text style={[s.timeChipTxt, selectedExpiry === opt.value && s.timeChipTxtActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {selectedExpiry === "custom" && (
                  <View style={s.customRow}>
                    <TextInput
                      style={s.customInput}
                      placeholder="e.g. 45 for 45 minutes"
                      value={customHours}
                      onChangeText={setCustomHours}
                      keyboardType="numeric"
                    />
                    <Text style={s.customUnit}>mins</Text>
                  </View>
                )}

                <Text style={s.expiryInfo}>{expiryInfoText()}</Text>

                <TouchableOpacity
                  style={[s.shareConfirmBtn, (!selectedUser || sharing) && s.btnDisabled]}
                  onPress={handleShareWithUser}
                  disabled={!selectedUser || sharing}
                >
                  {sharing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>🚀 Send PDF</Text>}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={s.closeBtn} onPress={closeShareModal}>
              <Text style={s.closeBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Send to Print Modal ───────────────────────────────── */}
      <Modal visible={showPrintModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modal}>

            {/* Step 1 — Choose a print shop */}
            {printStep === 1 && (
              <>
                <Text style={s.modalTitle}>🖨️ Choose Print Shop</Text>
                <View style={s.printFileInfo}>
                  <Text style={s.printFileName} numberOfLines={2}>📄 {pdf.originalName}</Text>
                </View>

                {shopsLoading ? (
                  <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 32 }} />
                ) : shops.length === 0 ? (
                  <Text style={s.emptyShops}>No print shops available right now.</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 320 }}>
                    {shops.map((shop) => (
                      <TouchableOpacity
                        key={shop._id}
                        style={[s.shopCard, selectedShop?._id === shop._id && s.shopCardActive]}
                        onPress={() => setSelectedShop(shop)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.shopName}>🏪 {shop.name}</Text>
                          <Text style={s.shopEmail}>{shop.email}</Text>
                        </View>
                        <View style={[s.queueChip, shop.queueCount === 0 && s.queueChipFree]}>
                          <Text style={s.queueChipTxt}>
                            {shop.queueCount === 0 ? "Free" : `#${shop.queueCount} in queue`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <TouchableOpacity
                  style={[s.shareConfirmBtn, !selectedShop && s.btnDisabled]}
                  onPress={() => selectedShop && setPrintStep(2)}
                  disabled={!selectedShop}
                >
                  <Text style={s.btnTxt}>Next: Set Copies →</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.closeBtn} onPress={closePrintModal}>
                  <Text style={s.closeBtnTxt}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 2 — Enter copies + disappear toggle */}
            {printStep === 2 && (
              <>
                <Text style={s.modalTitle}>🖨️ Send to Print</Text>
                <View style={s.printFileInfo}>
                  <Text style={s.printFileName} numberOfLines={2}>📄 {pdf.originalName}</Text>
                </View>
                <View style={s.selectedShopRow}>
                  <Text style={s.selectedShopTxt}>🏪 {selectedShop?.name}</Text>
                  <Text style={s.selectedShopQueue}>
                    {selectedShop?.queueCount === 0
                      ? "Queue is free"
                      : `You'll be #${selectedShop.queueCount + 1} in queue`}
                  </Text>
                </View>

                <Text style={s.expiryLabel}>Number of Copies</Text>
                <View style={s.copiesRow}>
                  <TouchableOpacity
                    style={s.copiesBtn}
                    onPress={() => setCopies((v) => String(Math.max(1, parseInt(v || "1") - 1)))}
                  >
                    <Text style={s.copiesBtnTxt}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={s.copiesInput}
                    value={copies}
                    onChangeText={(v) => setCopies(v.replace(/[^0-9]/g, ""))}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={s.copiesBtn}
                    onPress={() => setCopies((v) => String((parseInt(v || "1") || 0) + 1))}
                  >
                    <Text style={s.copiesBtnTxt}>+</Text>
                  </TouchableOpacity>
                </View>

                <Text style={s.expiryLabel}>Print Mode</Text>
                <View style={s.colorModeRow}>
                  <TouchableOpacity
                    style={[s.colorChip, colorMode === "bw" && s.colorChipActive]}
                    onPress={() => setColorMode("bw")}
                  >
                    <Text style={[s.colorChipTxt, colorMode === "bw" && s.colorChipTxtActive]}>
                      ⬛ Black & White  ₹1/page
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.colorChip, colorMode === "color" && s.colorChipColorActive]}
                    onPress={() => setColorMode("color")}
                  >
                    <Text style={[s.colorChipTxt, colorMode === "color" && s.colorChipTxtActive]}>
                      🌈 Color  ₹5/page
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={s.expiryInfo}>
                  📋 Request will be added to {selectedShop?.name}'s queue in FCFS order.
                </Text>

                <TouchableOpacity
                  style={[s.toggleRow, disappearAfterPrint && s.toggleRowActive]}
                  onPress={() => setDisappearAfterPrint(v => !v)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.toggleLabel}>🗑 Disappear after print</Text>
                    <Text style={s.toggleSub}>PDF will be deleted from your library once printed</Text>
                  </View>
                  <View style={[s.toggleKnob, disappearAfterPrint && s.toggleKnobActive]}>
                    <Text style={s.toggleKnobTxt}>{disappearAfterPrint ? "ON" : "OFF"}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.shareConfirmBtn, submitting && s.btnDisabled]}
                  onPress={handleSubmitPrint}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.btnTxt}>🚀 Submit Print Request</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={s.closeBtn} onPress={() => setPrintStep(1)}>
                  <Text style={s.closeBtnTxt}>← Back</Text>
                </TouchableOpacity>
              </>
            )}

          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#f8fafc" },
  iconBox: { alignItems: "center", marginBottom: 12 },
  icon: { fontSize: 64 },
  title: { fontSize: 20, fontWeight: "bold", color: "#1e293b", textAlign: "center", marginBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 24, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderColor: "#f1f5f9" },
  label: { color: "#64748b", fontSize: 15 },
  value: { color: "#1e293b", fontWeight: "600", fontSize: 15, flexShrink: 1, textAlign: "right", marginLeft: 8 },
  btn: { backgroundColor: "#6366f1", padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  shareBtn: { backgroundColor: "#10b981" },
  printBtn: { backgroundColor: "#f59e0b" },
  printReqBtn: { backgroundColor: "#0ea5e9" },
  btnTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 320 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#1e293b", marginBottom: 16, textAlign: "center" },
  searchRow: { flexDirection: "row", marginBottom: 12 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#f8fafc" },
  searchBtn: { backgroundColor: "#6366f1", paddingHorizontal: 16, borderRadius: 10, justifyContent: "center", marginLeft: 8 },
  searchBtnTxt: { color: "#fff", fontWeight: "bold" },
  resultsList: { backgroundColor: "#f8fafc", borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  userRow: { padding: 12, borderBottomWidth: 1, borderColor: "#e2e8f0" },
  userName: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  userEmail: { fontSize: 13, color: "#64748b" },
  printBadge: { fontSize: 12, color: "#0ea5e9", fontWeight: "600", marginTop: 2 },
  selectedUser: { backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#bbf7d0" },
  selectedUserTxt: { color: "#16a34a", fontWeight: "600", fontSize: 14 },
  expiryLabel: { fontSize: 15, fontWeight: "600", color: "#1e293b", marginBottom: 10 },
  timeScroll: { marginBottom: 12 },
  timeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#e2e8f0", marginRight: 8, backgroundColor: "#f8fafc" },
  timeChipActive: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
  timeChipTxt: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  timeChipTxtActive: { color: "#fff" },
  customRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#6366f1", borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, backgroundColor: "#f8fafc" },
  customInput: { flex: 1, padding: 12, fontSize: 15 },
  customUnit: { color: "#6366f1", fontWeight: "bold", fontSize: 15 },
  expiryInfo: { fontSize: 13, color: "#64748b", marginBottom: 16, textAlign: "center" },
  shareConfirmBtn: { backgroundColor: "#6366f1", padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 8 },
  closeBtn: { alignItems: "center", padding: 12 },
  closeBtnTxt: { color: "#ef4444", fontWeight: "600", fontSize: 15 },
  printFileInfo: { backgroundColor: "#f0f9ff", borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#bae6fd" },
  printFileName: { fontSize: 14, fontWeight: "600", color: "#0369a1" },
  shopCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", marginBottom: 10 },
  shopCardActive: { borderColor: "#6366f1", backgroundColor: "#eff6ff" },
  shopName: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  shopEmail: { fontSize: 12, color: "#64748b", marginTop: 2 },
  queueChip: { backgroundColor: "#f59e0b", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  queueChipFree: { backgroundColor: "#10b981" },
  queueChipTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  emptyShops: { textAlign: "center", color: "#94a3b8", fontSize: 15, marginVertical: 32 },
  selectedShopRow: { backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#bbf7d0" },
  selectedShopTxt: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  selectedShopQueue: { fontSize: 12, color: "#16a34a", marginTop: 2 },
  copiesRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16, gap: 12 },
  copiesBtn: { backgroundColor: "#6366f1", width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  copiesBtnTxt: { color: "#fff", fontSize: 22, fontWeight: "bold", lineHeight: 26 },
  copiesInput: { width: 64, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10, fontSize: 20, fontWeight: "bold", color: "#1e293b", backgroundColor: "#f8fafc" },
  colorModeRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  colorChip: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", alignItems: "center" },
  colorChipActive: { borderColor: "#1e293b", backgroundColor: "#1e293b" },
  colorChipColorActive: { borderColor: "#f59e0b", backgroundColor: "#f59e0b" },
  colorChipTxt: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  colorChipTxtActive: { color: "#fff" },
  toggleRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", marginBottom: 16 },
  toggleRowActive: { borderColor: "#ef4444", backgroundColor: "#fff5f5" },
  toggleLabel: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  toggleSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  toggleKnob: { backgroundColor: "#94a3b8", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginLeft: 10 },
  toggleKnobActive: { backgroundColor: "#ef4444" },
  toggleKnobTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
});