import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, Alert
} from "react-native";
import { getPDFs, deletePDF, getSharedWithMe } from "../api";
import { useAuth } from "../context/AuthContext";

export default function HomeScreen({ navigation }) {
  const [tab, setTab] = useState("all"); // "all" | "shared"
  const [pdfs, setPdfs] = useState([]);
  const [sharedPdfs, setSharedPdfs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { user, signOut } = useAuth();

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
    Alert.alert("Delete PDF", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => { await deletePDF(id); load(); }
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
        <Text style={s.sharedBadge}>
          {item.expiresAt
            ? `⏱ Expires: ${new Date(item.expiresAt).toLocaleString()}`
            : "♾ No expiry"}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.hello}>Hello, {user?.name} 👋</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={s.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Upload Button */}
      <TouchableOpacity style={s.uploadBtn} onPress={() => navigation.navigate("Upload")}>
        <Text style={s.uploadTxt}>＋ Upload PDF</Text>
      </TouchableOpacity>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, tab === "all" && s.activeTab]}
          onPress={() => setTab("all")}
        >
          <Text style={[s.tabTxt, tab === "all" && s.activeTabTxt]}>
            All PDFs {pdfs.length > 0 ? `(${pdfs.length})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === "shared" && s.activeTab]}
          onPress={() => setTab("shared")}
        >
          <Text style={[s.tabTxt, tab === "shared" && s.activeTabTxt]}>
            Shared with Me {sharedPdfs.length > 0 ? `(${sharedPdfs.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* PDF List */}
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
  header: { flexDirection: "row", justifyContent: "space-between", padding: 16, alignItems: "center" },
  hello: { fontSize: 18, fontWeight: "600", color: "#1e293b" },
  logout: { color: "#ef4444", fontWeight: "600" },
  uploadBtn: { margin: 16, marginTop: 0, backgroundColor: "#6366f1", padding: 14, borderRadius: 12, alignItems: "center" },
  uploadTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 8, backgroundColor: "#e2e8f0", borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  activeTab: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabTxt: { fontSize: 13, fontWeight: "600", color: "#94a3b8" },
  activeTabTxt: { color: "#6366f1" },
  card: { backgroundColor: "#fff", margin: 8, marginHorizontal: 16, padding: 16, borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  name: { fontSize: 16, fontWeight: "600", color: "#1e293b", marginBottom: 4 },
  meta: { fontSize: 13, color: "#64748b" },
  date: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  del: { color: "#ef4444", marginTop: 8, fontSize: 13 },
  sharedBadge: { color: "#6366f1", marginTop: 8, fontSize: 13, fontWeight: "600" },
  empty: { textAlign: "center", marginTop: 60, color: "#94a3b8", fontSize: 16 },
});