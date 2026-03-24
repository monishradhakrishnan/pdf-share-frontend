import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, StatusBar, Platform, useWindowDimensions
} from "react-native";
import { login } from "../api";
import { useAuth } from "../context/AuthContext";
import { Platform } from "react-native";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn } = useAuth();

  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const isDesktop = isWeb && width >= 1024;
  const isTablet = isWeb && width >= 768 && width < 1024;

  const handleLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("All fields are required");
      return;
    }
    setLoading(true);
    try {
      console.log("Attempting login with:", { email });
      const { data } = await login({ email, password });
      console.log("Login success:", data);
      await signIn(data.token, data.user);
    } catch (e) {
      console.log("Login error:", JSON.stringify(e));
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "Login failed. Check your connection.";
      setError(msg);
      if (Platform.OS !== "web") Alert.alert("Login Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Card wrapper — constrained on desktop/tablet */}
      <View style={[
        s.card,
        isDesktop && s.cardDesktop,
        isTablet && s.cardTablet,
      ]}>
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
          onSubmitEditing={handleLogin}  
          returnKeyType="go"            
/>

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnTxt}>Login</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={s.requestBtn}
          onPress={() => navigation.navigate('RequestAccess')}
        >
          <Text style={s.requestBtnTxt}>🔐 Request Access</Text>
          <Text style={s.requestBtnSub}>Don't have an invite? Submit a request.</Text>
        </TouchableOpacity>
     
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",         // centers the card horizontally
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  card: {
    width: "100%",                // full width on mobile (native)
  },
 cardDesktop: {
  width: 420,
  backgroundColor: "#fff",
  borderRadius: 16,
  padding: 40,
  ...Platform.select({
    web: {
      boxShadow: "0px 4px 24px rgba(0, 0, 0, 0.08)",
    },
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  }),
},
cardTablet: {
  width: 380,
  backgroundColor: "#fff",
  borderRadius: 16,
  padding: 32,
  ...Platform.select({
    web: {
      boxShadow: "0px 4px 16px rgba(0, 0, 0, 0.06)",
    },
    default: {
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
  }),
},
  title: { fontSize: 36, fontWeight: "bold", textAlign: "center", color: "#6366f1", marginBottom: 8 },
  subtitle: { fontSize: 15, textAlign: "center", color: "#64748b", marginBottom: 32 },
  error: { backgroundColor: "#fee2e2", color: "#ef4444", padding: 12, borderRadius: 8, marginBottom: 16, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 14, marginBottom: 14, backgroundColor: "#fff", fontSize: 16 },
  btn: { backgroundColor: "#6366f1", padding: 16, borderRadius: 10, alignItems: "center", marginBottom: 12 },
  btnTxt: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  requestBtn: {
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  requestBtnTxt: { color: '#4F46E5', fontWeight: '700', fontSize: 15 },
  requestBtnSub: { color: '#64748b', fontSize: 12, marginTop: 3 },
});