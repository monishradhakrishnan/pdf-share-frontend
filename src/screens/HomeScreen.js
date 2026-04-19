import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, Alert, Platform, ScrollView
} from "react-native";
import { getPDFs, deletePDF, getSharedWithMe, removeSharedPDF } from "../api";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "../components/NotificationBell";

export default function HomeScreen({ navigation }) {
  const [tab, setTab] = useState("all");
  const [pdfs, setPdfs] = useState([]);
  const [sharedPdfs, setSharedPdfs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();

  const isPrintAdmin = user?.role === "print_admin";

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const allRes = await getPDFs();
      setPdfs(allRes.data);
    } catch (e) {
      console.log("getPDFs error:", e?.response?.status, e?.message);
      Alert.alert("Error", "Could not load PDFs");
    }
    try {
      const sharedRes = await getSharedWithMe();
      setSharedPdfs(sharedRes.data);
    } catch (e) {
      console.log("getSharedWithMe error:", e?.response?.status, e?.message);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener("focus", load);
    return unsub;
  }, [load, navigation]);

  const handleDelete = (id) => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to delete this PDF?")) {
        deletePDF(id).then(() => load()).catch(() => Alert.alert("Error", "Could not delete PDF"));
      }
      return;
    }
    Alert.alert("Delete PDF", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deletePDF(id); load(); } },
    ]);
  };

  const handleRemoveShared = (id) => {
    if (Platform.OS === "web") {
      if (window.confirm("Remove this PDF from your shared list?")) {
        removeSharedPDF(id)
          .then(() => getSharedWithMe())
          .then((res) => setSharedPdfs(res.data))
          .catch(() => Alert.alert("Error", "Could not remove PDF"));
      }
      return;
    }
    Alert.alert("Remove PDF", "Remove this PDF from your shared list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          try {
            await removeSharedPDF(id);
            const sharedRes = await getSharedWithMe();
            setSharedPdfs(sharedRes.data);
          } catch (e) {
            Alert.alert("Error", e?.response?.data?.error || e?.message || "Could not remove PDF");
          }
        }
      },
    ]);
  };

  const formatSize = (bytes) => (bytes / 1024 / 1024).toFixed(2) + " MB";
  const data = tab === "all" ? pdfs : sharedPdfs;

  const renderItem = ({ item }) => (
    <TouchableOpacity style={s.card} onPress={() => navigation.navigate("PDFDetail", { pdf: item })}>
      <Text style={s.name} numberOfLines={1}>📄 {item.originalName}</Text>
      <Text style={s.meta}>{item.uploaderName} · {formatSize(item.size)}</Text>
      <Text style={s.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      {tab === "all" && item.uploadedBy?.toString() === user?.id?.toString() && (
        <TouchableOpacity onPress={() => handleDelete(item._id)}>
          <Text style={s.del}>🗑 Delete</Text>
        </TouchableOpacity>
      )}
      {tab === "shared" && (
        <View style={s.sharedFooter}>
          <Text style={s.sharedBadge}>
            {item.expiresAt ? `⏱ Expires: ${new Date(item.expiresAt).toLocaleString()}` : "♾ No expiry"}
          </Text>
          <TouchableOpacity style={s.removeBtn} onPress={() => handleRemoveShared(item._id)}>
            <Text style={s.removeBtnTxt}>🗑 Remove</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  const content = (
    <>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.hello}>Hello, {user?.name} 👋</Text>
        <View style={s.headerRight}>
          {/* Notification bell — hidden for print_admin (they use PrintQueue) */}
          {!isPrintAdmin && <NotificationBell />}
          <TouchableOpacity onPress={() => setMenuOpen(o => !o)} style={s.menuBtn}>
            <Text style={s.menuIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dropdown */}
      {menuOpen && (
        <>
          <TouchableOpacity style={s.overlay} onPress={() => setMenuOpen(false)} activeOpacity={1} />
          <View style={s.dropdown}>
            <TouchableOpacity
              style={s.dropdownItem}
              onPress={() => { setMenuOpen(false); navigation.navigate("ChangePassword"); }}
            >
              <Text style={s.dropdownTxt}>🔐 Change Password</Text>
            </TouchableOpacity>

            {user?.role === "admin" && (
              <>
                <View style={s.divider} />
                <TouchableOpacity
                  style={s.dropdownItem}
                  onPress={() => { setMenuOpen(false); navigation.navigate("Admin"); }}
                >
                  <Text style={s.dropdownTxt}>🛡️ Admin Panel</Text>
                </TouchableOpacity>
              </>
            )}

            {isPrintAdmin && (
              <>
                <View style={s.divider} />
                <TouchableOpacity
                  style={s.dropdownItem}
                  onPress={() => { setMenuOpen(false); navigation.navigate("PrintQueue"); }}
                >
                  <Text style={s.dropdownTxt}>🖨️ Print Queue</Text>
                </TouchableOpacity>
              </>
            )}

            {!isPrintAdmin && (
              <>
                <View style={s.divider} />
                <TouchableOpacity
                  style={s.dropdownItem}
                  onPress={() => { setMenuOpen(false); navigation.navigate("MyRequests"); }}
                >
                  <Text style={s.dropdownTxt}>📋 My Print Requests</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={s.divider} />
            <TouchableOpacity
              style={s.dropdownItem}
              onPress={() => { setMenuOpen(false); signOut(); }}
            >
              <Text style={[s.dropdownTxt, { color: "#ef4444" }]}>⏻ Logout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Action Buttons — hidden for print_admin */}
      {!isPrintAdmin && (
        <View style={s.actionRow}>
          <TouchableOpacity style={s.uploadBtn} onPress={() => navigation.navigate("Upload")}>
            <Text style={s.uploadTxt}>⬆ Upload PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.createBtn} onPress={() => navigation.navigate("CreatePDF")}>
            <Text style={s.uploadTxt}>📝 Create PDF</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Print Admin shortcut banner */}
      {isPrintAdmin && (
        <TouchableOpacity
          style={s.printAdminBanner}
          onPress={() => navigation.navigate("PrintQueue")}
        >
          <Text style={s.printAdminBannerTxt}>🖨️ Go to Print Queue →</Text>
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === "all" && s.activeTab]} onPress={() => setTab("all")}>
          <Text style={[s.tabTxt, tab === "all" && s.activeTabTxt]}>
            All PDFs {pdfs.length > 0 ? `(${pdfs.length})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === "shared" && s.activeTab]} onPress={() => setTab("shared")}>
          <Text style={[s.tabTxt, tab === "shared" && s.activeTabTxt]}>
            Shared with Me {sharedPdfs.length > 0 ? `(${sharedPdfs.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView style={s.container} contentContainerStyle={s.webContent} showsVerticalScrollIndicator={false}>
          {content}
          {data.length === 0 ? (
            <Text style={s.empty}>
              {tab === "all" ? "No PDFs yet. Upload one!" : "No PDFs shared with you yet."}
            </Text>
          ) : (
            data.map((item) => <View key={item._id}>{renderItem({ item })}</View>)
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {content}
      <FlatList
        data={data}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={s.empty}>
            {tab === "all" ? "No PDFs yet. Upload one!" : "No PDFs shared with you yet."}
          </Text>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  webContent: { paddingBottom: 40 },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    padding: 16, alignItems: "center",
    borderBottomWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff",
  },
  hello: { fontSize: 18, fontWeight: "600", color: "#1e293b" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  menuBtn: { padding: 6 },
  menuIcon: { fontSize: 22 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 },
  dropdown: {
    position: "absolute", top: 58, right: 12,
    backgroundColor: "#fff", borderRadius: 12,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, elevation: 8,
    minWidth: 200, zIndex: 999, borderWidth: 1, borderColor: "#e2e8f0",
  },
  dropdownItem: { padding: 16 },
  dropdownTxt: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  divider: { height: 1, backgroundColor: "#e2e8f0" },
  actionRow: { flexDirection: "row", marginHorizontal: 16, marginTop: 16, marginBottom: 8, gap: 8 },
  uploadBtn: { flex: 1, backgroundColor: "#6366f1", padding: 14, borderRadius: 12, alignItems: "center" },
  createBtn: { flex: 1, backgroundColor: "#10b981", padding: 14, borderRadius: 12, alignItems: "center" },
  uploadTxt: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  printAdminBanner: {
    margin: 16, backgroundColor: "#f0fdf4", borderRadius: 12,
    padding: 14, alignItems: "center",
    borderWidth: 1, borderColor: "#bbf7d0",
  },
  printAdminBannerTxt: { color: "#16a34a", fontWeight: "700", fontSize: 15 },
  tabs: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 8,
    backgroundColor: "#e2e8f0", borderRadius: 12, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  activeTab: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabTxt: { fontSize: 13, fontWeight: "600", color: "#94a3b8" },
  activeTabTxt: { color: "#6366f1" },
  card: {
    backgroundColor: "#fff", margin: 8, marginHorizontal: 16,
    padding: 16, borderRadius: 12, shadowColor: "#000",
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  name: { fontSize: 16, fontWeight: "600", color: "#1e293b", marginBottom: 4 },
  meta: { fontSize: 13, color: "#64748b" },
  date: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  del: { color: "#ef4444", marginTop: 8, fontSize: 13 },
  sharedFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  sharedBadge: { color: "#6366f1", fontSize: 12, fontWeight: "600", flex: 1, flexWrap: "wrap" },
  removeBtn: { backgroundColor: "#ef4444", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginLeft: 8 },
  removeBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  empty: { textAlign: "center", marginTop: 60, color: "#94a3b8", fontSize: 16 },
});