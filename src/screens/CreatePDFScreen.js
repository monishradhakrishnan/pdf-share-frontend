import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
  Platform, Image, TextInput
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { BASE_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

export default function CreatePDFScreen({ navigation }) {
  const [title, setTitle] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { token } = useAuth();

  // ── Convert image uri to base64 ──────────────────────────────
  const toBase64 = async (img) => {
    if (Platform.OS === "web") {
      // On web, img.webFile is a native File object
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(img.webFile);
      });
    }
    const base64 = await FileSystem.readAsStringAsync(img.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  };

  // ── Pick images ──────────────────────────────────────────────
  const pickImages = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.multiple = true;
      input.onchange = (e) => {
        const files = Array.from(e.target.files);
        const newImages = files.map((f) => ({
          uri: URL.createObjectURL(f),
          name: f.name,
          webFile: f,
        }));
        setImages((prev) => [...prev, ...newImages]);
      };
      input.click();
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photo library");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets]);
    }
  };

  const removeImage = (index) => setImages((prev) => prev.filter((_, i) => i !== index));

  const moveUp = (index) => {
    if (index === 0) return;
    const arr = [...images];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    setImages(arr);
  };

  const moveDown = (index) => {
    if (index === images.length - 1) return;
    const arr = [...images];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    setImages(arr);
  };

  // ── Generate HTML ────────────────────────────────────────────
  const generateHTML = async () => {
    const imgTags = await Promise.all(
      images.map(async (img) => {
        const base64 = await toBase64(img);
        return `
          <div class="page">
            <img src="${base64}" style="max-width:100%; max-height:100vh; object-fit:contain;" />
          </div>
        `;
      })
    );
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <title></title>
          <style>
            @page { margin: 0; size: auto; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { background: #fff; -webkit-print-color-adjust: exact; }
            h1 { color: #6366f1; font-size: 24px; text-align: center; padding: 20px; border-bottom: 2px solid #6366f1; margin-bottom: 20px; }
            .page {
              display: flex;
              justify-content: center;
              align-items: center;
              page-break-inside: avoid;
              page-break-after: always;
              width: 100%;
            }
            .page img {
              display: block;
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          ${title ? `<h1>${title}</h1>` : ""}
          ${imgTags.join("")}
        </body>
      </html>
    `;
  };

  // ── Upload to backend (native only) ─────────────────────────
  const uploadToBackend = async (fileUri, filename) => {
    const form = new FormData();
    form.append("file", { uri: fileUri, name: filename, type: "application/pdf" });
    const res = await axios.post(`${BASE_URL}/pdfs/upload`, form, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
    });
    return res.data;
  };

  // ── Create PDF — unified handler for both platforms ──────────
  const handleCreatePDF = async () => {
    if (images.length === 0) return Alert.alert("No images", "Please add at least one image");
    setLoading(true);
    setError("");
    try {
      const html = await generateHTML();

      if (Platform.OS === "web") {
        // On web: open print dialog (user can Save as PDF from there)
        const printWindow = window.open("", "_blank");
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
      } else {
        // On native: generate PDF file then offer Upload / Share
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        const filename = `${title || "images"}.pdf`;
        const dest = FileSystem.documentDirectory + filename;
        // Delete existing file at dest if it exists, to avoid rename conflicts
        const existing = await FileSystem.getInfoAsync(dest);
        if (existing.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
        await FileSystem.moveAsync({ from: uri, to: dest });

        Alert.alert("PDF Created! 🎉", "What would you like to do?", [
          {
            text: "Upload to App",
            onPress: async () => {
              try {
                await uploadToBackend(dest, filename);
                Alert.alert("Success", "PDF uploaded!");
                navigation.goBack();
              } catch {
                Alert.alert("Error", "Could not upload PDF");
              }
            },
          },
          {
            text: "Share",
            onPress: async () => {
              await Sharing.shareAsync(dest, { mimeType: "application/pdf" });
            },
          },
          { text: "Cancel", style: "cancel" },
        ]);
      }
    } catch (e) {
      console.log("Create error:", e.message);
      setError("Could not create PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>🖼 Images to PDF</Text>
      <Text style={s.subheading}>Add images and combine them into a PDF</Text>

      {error ? <Text style={s.error}>⚠ {error}</Text> : null}

      <Text style={s.label}>Document Title (optional)</Text>
      <TextInput
        style={s.titleInput}
        placeholder="e.g. My Photo Album"
        value={title}
        onChangeText={setTitle}
      />

      <TouchableOpacity style={s.addBtn} onPress={pickImages}>
        <Text style={s.addBtnTxt}>＋ Add Images</Text>
        <Text style={s.addBtnSub}>JPG, PNG supported</Text>
      </TouchableOpacity>

      {images.length > 0 && (
        <View style={s.imageList}>
          <Text style={s.imageCount}>{images.length} image{images.length > 1 ? "s" : ""} added</Text>
          {images.map((img, index) => (
            <View key={index} style={s.imageRow}>
              <Image source={{ uri: img.uri }} style={s.thumb} />
              <View style={s.imageInfo}>
                <Text style={s.imageName} numberOfLines={1}>
                  {img.fileName || img.name || `Image ${index + 1}`}
                </Text>
                <Text style={s.imagePage}>Page {index + 1}</Text>
              </View>
              <View style={s.imageActions}>
                <TouchableOpacity style={s.iconBtn} onPress={() => moveUp(index)}>
                  <Text style={s.iconBtnTxt}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.iconBtn} onPress={() => moveDown(index)}>
                  <Text style={s.iconBtnTxt}>↓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.iconBtn, s.removeIconBtn]} onPress={() => removeImage(index)}>
                  <Text style={s.iconBtnTxt}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {images.length > 0 && (
        <View style={s.infoBox}>
          <Text style={s.infoTxt}>
            📋 {images.length} image{images.length > 1 ? "s" : ""} · Each image = 1 page · Use ↑↓ to reorder
          </Text>
        </View>
      )}

      {/* Single Create PDF button for all platforms */}
      <TouchableOpacity
        style={[s.createBtn, (loading || images.length === 0) && s.btnDisabled]}
        onPress={handleCreatePDF}
        disabled={loading || images.length === 0}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.createBtnTxt}>📄 Create PDF</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={s.cancelTxt}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 24 },
  heading: { fontSize: 24, fontWeight: "bold", color: "#1e293b", marginBottom: 4 },
  subheading: { fontSize: 14, color: "#64748b", marginBottom: 24 },
  error: { backgroundColor: "#fee2e2", color: "#ef4444", padding: 12, borderRadius: 8, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6 },
  titleInput: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: "#fff", marginBottom: 16 },
  addBtn: { borderWidth: 2, borderColor: "#6366f1", borderStyle: "dashed", borderRadius: 16, padding: 32, alignItems: "center", marginBottom: 20, backgroundColor: "#fff" },
  addBtnTxt: { color: "#6366f1", fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  addBtnSub: { color: "#94a3b8", fontSize: 13 },
  imageList: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  imageCount: { fontSize: 13, color: "#64748b", marginBottom: 12, fontWeight: "600" },
  imageRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderColor: "#f1f5f9" },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#e2e8f0", marginRight: 12 },
  imageInfo: { flex: 1 },
  imageName: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  imagePage: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  imageActions: { flexDirection: "row", gap: 6 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  removeIconBtn: { backgroundColor: "#fee2e2" },
  iconBtnTxt: { fontSize: 14, fontWeight: "bold", color: "#475569" },
  infoBox: { backgroundColor: "#f0f9ff", borderRadius: 10, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: "#bae6fd" },
  infoTxt: { fontSize: 13, color: "#0369a1", textAlign: "center" },
  createBtn: { backgroundColor: "#6366f1", padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  createBtnTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  cancelBtn: { alignItems: "center", padding: 12, marginBottom: 32 },
  cancelTxt: { color: "#94a3b8", fontSize: 15 },
});