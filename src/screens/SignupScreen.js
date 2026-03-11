import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { signup } from "../api";
import { useAuth } from "../context/AuthContext";

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn } = useAuth();

  const handleSignup = async () => {
    if (!name || !email || !password) return Alert.alert("Error", "All fields are required");
    try {
      const { data } = await signup({ name, email, password });
      await signIn(data.token, data.user);
    } catch (e) {
      Alert.alert("Error", e.response?.data?.error || "Signup failed");
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>📄 PDF Share</Text>
      <Text style={s.subtitle}>Create a new account</Text>

      <TextInput
        style={s.input}
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
      />
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

      <TouchableOpacity style={s.btn} onPress={handleSignup}>
        <Text style={s.btnTxt}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Login")}>
        <Text style={s.link}>Already have an account? Login</Text>
        
<View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
  <View style={{ flex: 1, height: 1, backgroundColor: '#334155' }} />
  <Text style={{ color: '#64748b', marginHorizontal: 10, fontSize: 13 }}>or</Text>
  <View style={{ flex: 1, height: 1, backgroundColor: '#334155' }} />
</View>


<TouchableOpacity
  style={{
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  }}
  onPress={() => navigation.navigate('RequestAccess')}
>
  <Text style={{ color: '#4F46E5', fontWeight: '700', fontSize: 15 }}>
    🔐 Request Access
  </Text>
  <Text style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>
    Don't have an invite? Submit a request.
  </Text>
</TouchableOpacity>
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
