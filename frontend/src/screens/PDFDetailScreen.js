import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Platform, Modal, TextInput, ScrollView
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { BASE_URL, searchUsers, sharePDF } from "../api";
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

  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState(60);
  const [selectedUser, setSelectedUser] = useState(null);
  const [customHours, setCustomHours] = useState("");

  // ── Download to local cache (native only) ───────────────────
  const downloadToLocal = async () => {
    setDownloading(true);
    try {
      const safeFilename = pdf.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const localUri = FileSystem.documentDirectory + safeFilename;
      const result = await FileSystem.downloadAsync(
        `${BASE_URL}/pdfs/${pdf._id}/download`,
        localUri,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (result.status !== 200) {
        Alert.alert("Error", `Server returned status ${result.status}`);
        return null;
      }
      return result.uri;
    } catch (e) {
      Alert.alert("Download Error", e.message || "Could not download PDF");
      return null;
    } finally {
      setDownloading(false);
    }
  };

  // ── Download PDF (web: anchor download, native: share sheet) ─
  const handleShare = async () => {
    if (Platform.OS === "web") {
      // Trigger a proper file download via <a download> on web
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
    // Native: download then share
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

  // ── Print PDF (web: iframe print, native: expo-print) ───────
  const handlePrint = async () => {
    setPrinting(true);
    try {
      if (Platform.OS === "web") {
        // Fetch the PDF as a blob, embed in hidden iframe, then print
        const res = await fetch(`${BASE_URL}/pdfs/${pdf._id}/download`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Could not load PDF for printing");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = url;
        document.body.appendChild(iframe);

        iframe.onload = () => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (e) {
            // Fallback: open in new tab so user can print manually
            window.open(url, "_blank");
          }
          // Cleanup after a short delay
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
          }, 5000);
        };
      } else {
        // Native
        const uri = await downloadToLocal();
        if (!uri) return;
        await Print.printAsync({ uri });
      }
    } catch (e) {
      Alert.alert("Error", e.message || "Could not print PDF");
    } finally {
      setPrinting(false);
    }
  };

  // ── Search users ─────────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setSelectedUser(null);
    try {
      const { data } = await searchUsers(searchEmail.trim());
      setSearchResults(data);
      if (data.length === 0) Alert.alert("No users found", "Try a different email");
    } catch (e) {
      Alert.alert("Error", "Could not search users");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchResults([]);
    setSearchEmail(user.email);
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
      closeModal();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || "Could not share PDF");
    } finally {
      setSharing(false);
    }
  };

  const closeModal = () => {
    setShowShareModal(false);
    setSearchEmail("");
    setSearchResults([]);
    setSelectedUser(null);
    setSelectedExpiry(24);
    setCustomHours("");
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

      <TouchableOpacity style={[s.btn, s.shareBtn]} onPress={handleShare} disabled={downloading}>
        {downloading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>⬇️ Download PDF</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={[s.btn, s.printBtn]} onPress={handlePrint} disabled={printing}>
        {printing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>🖨 Print PDF</Text>}
      </TouchableOpacity>

      {/* ── Share with User Modal ────────────────────────────── */}
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
                  : <Text style={s.searchBtnTxt}>Search</Text>
                }
              </TouchableOpacity>
            </View>

            {searchResults.length > 0 && (
              <View style={s.resultsList}>
                {searchResults.map((item) => (
                  <TouchableOpacity key={item._id} style={s.userRow} onPress={() => handleSelectUser(item)}>
                    <Text style={s.userName}>{item.name}</Text>
                    <Text style={s.userEmail}>{item.email}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedUser && (
              <View style={s.selectedUser}>
                <Text style={s.selectedUserTxt}>✅ {selectedUser.name} ({selectedUser.email})</Text>
              </View>
            )}

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
              {sharing
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnTxt}>🚀 Send PDF</Text>
              }
            </TouchableOpacity>


            <TouchableOpacity style={s.closeBtn} onPress={closeModal}>
              <Text style={s.closeBtnTxt}>Cancel</Text>
            </TouchableOpacity>
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
  btnTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 420 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#1e293b", marginBottom: 16, textAlign: "center" },
  searchRow: { flexDirection: "row", marginBottom: 12 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#f8fafc" },
  searchBtn: { backgroundColor: "#6366f1", paddingHorizontal: 16, borderRadius: 10, justifyContent: "center", marginLeft: 8 },
  searchBtnTxt: { color: "#fff", fontWeight: "bold" },
  resultsList: { backgroundColor: "#f8fafc", borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  userRow: { padding: 12, borderBottomWidth: 1, borderColor: "#e2e8f0" },
  userName: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  userEmail: { fontSize: 13, color: "#64748b" },
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
});