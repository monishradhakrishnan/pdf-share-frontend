import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { login } from "../api";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert("Error", "All fields are required");
    try {
      const { data } = await login({ email, password });
      await signIn(data.token, data.user);
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || "Login failed");
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>📄 PDF Share</Text>
      <Text style={s.subtitle}>Sign in to your account</Text>

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

      <TouchableOpacity style={s.btn} onPress={handleLogin}>
        <Text style={s.btnTxt}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
        <Text style={s.link}>Don't have an account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f8fafc" },
  title: { fontSize: 36, fontWeight: "bold", textAlign: "center", color: "#6366f1", marginBottom: 8 },
  subtitle: { fontSize: 15, textAlign: "center", color: "#64748b", marginBottom: 32 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 14, marginBottom: 14, backgroundColor: "#fff", fontSize: 16 },
  btn: { backgroundColor: "#6366f1", padding: 16, borderRadius: 10, alignItems: "center", marginBottom: 12 },
  btnTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  link: { textAlign: "center", color: "#6366f1", marginTop: 8, fontSize: 15 },
});