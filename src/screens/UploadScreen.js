import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { BASE_URL } from "../api";

export default function UploadScreen({ navigation, route }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { token } = useAuth();

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      console.log("Picked file:", JSON.stringify(res));
      if (!res.canceled && res.assets?.length > 0) {
        setFile(res.assets[0]);
        setError("");
      }
    } catch (e) {
      console.log("Pick error:", e);
      Alert.alert("Error", "Could not pick file");
    }
  };

  const handleUpload = async () => {
    if (!file) return Alert.alert("No file", "Please select a PDF first");
    setLoading(true);
    setError("");
    try {
      console.log("Uploading file:", file.name, file.uri);
      const form = new FormData();
      form.append("file", {
        uri: file.uri,
        name: file.name,
        type: "application/pdf",
      });

      const res = await axios.post(`${BASE_URL}/pdfs/upload`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
          Accept: "application/json",
        },
      });

      console.log("Upload success:", res.data);
      Alert.alert("Success", "PDF uploaded successfully!");
      navigation.goBack();
    } catch (e) {
      console.log("Upload error:", JSON.stringify(e?.response?.data || e?.message));
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "Upload failed. Check connection.";
      setError(msg);
      Alert.alert("Upload Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.heading}>Select a PDF to Upload</Text>

      {error ? <Text style={s.error}>⚠ {error}</Text> : null}

      <TouchableOpacity style={s.picker} onPress={pickFile}>
        <Text style={s.pickerIcon}>📂</Text>
        <Text style={s.pickerTxt}>
          {file ? file.name : "Tap to browse files"}
        </Text>
        {file && (
          <Text style={s.size}>{(file.size / 1024 / 1024).toFixed(2)} MB</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.btn, loading && s.btnDisabled]}
        onPress={handleUpload}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnTxt}>⬆ Upload PDF</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={s.cancelTxt}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f8fafc" },
  heading: { fontSize: 22, fontWeight: "bold", color: "#1e293b", textAlign: "center", marginBottom: 32 },
  error: { backgroundColor: "#fee2e2", color: "#ef4444", padding: 12, borderRadius: 8, marginBottom: 16, textAlign: "center" },
  picker: { borderWidth: 2, borderColor: "#6366f1", borderStyle: "dashed", borderRadius: 16, padding: 40, alignItems: "center", marginBottom: 24, backgroundColor: "#fff" },
  pickerIcon: { fontSize: 40, marginBottom: 12 },
  pickerTxt: { color: "#6366f1", fontSize: 16, textAlign: "center", fontWeight: "500" },
  size: { color: "#64748b", marginTop: 8, fontSize: 13 },
  btn: { backgroundColor: "#6366f1", padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  btnDisabled: { opacity: 0.6 },
  btnTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  cancelBtn: { alignItems: "center", padding: 12 },
  cancelTxt: { color: "#94a3b8", fontSize: 15 },
});