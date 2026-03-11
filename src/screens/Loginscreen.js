import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar
} from "react-native";
import { login } from "../api";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn } = useAuth();

  const handleLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("All fields are required");
      return;
    }
    setLoading(true);
    try {
      const { data } = await login({ email, password });
      await signIn(data.token, data.user);
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "Login failed. Check your connection.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <Text style={s.title}>📄 PDF Share</Text>
      <Text style={s.subtitle}>Sign in to your account</Text>

      {error ? <Text style={s.error}>⚠ {error}</Text> : null}

      <TextInput
        style={s.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={s.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnTxt}>Login</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("RequestAccess")}>
        <Text style={s.link}>Don't have access? Request Access</Text>
      </TouchableOpacity>
    </View>
  );
}


const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f8fafc" },
  title: { fontSize: 36, fontWeight: "bold", textAlign: "center", color: "#6366f1", marginBottom: 8 },
  subtitle: { fontSize: 15, textAlign: "center", color: "#64748b", marginBottom: 32 },
  error: { backgroundColor: "#fee2e2", color: "#ef4444", padding: 12, borderRadius: 8, marginBottom: 16, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 14, marginBottom: 14, backgroundColor: "#fff", fontSize: 16 },
  btn: { backgroundColor: "#6366f1", padding: 16, borderRadius: 10, alignItems: "center", marginBottom: 20 },
  btnTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  link: { textAlign: "center", color: "#6366f1", fontSize: 15 },
});