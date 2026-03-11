import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import api from '../api';

export default function RequestAccessScreen({ navigation }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', about: ''
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    const { name, email, password, about } = form;
    if (!name || !email || !password || !about) {
      if (window.alert) window.alert('Please fill in all fields.');
      else Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      if (window.alert) window.alert('Password must be at least 6 characters.');
      else Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/request-access', form);
      // Alert.alert buttons don't work on web — use window.alert instead
      if (window.alert) {
        window.alert("✅ Request submitted! We'll notify you by email once approved.");
        navigation.navigate('Login');
      } else {
        Alert.alert(
          '✅ Request Submitted',
          "We'll review your request and notify you by email once approved.",
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong.';
      if (window.alert) window.alert(`Error: ${msg}`);
      else Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Request Access</Text>
      <Text style={s.subtitle}>
        Fill in your details and we'll review your request manually.
      </Text>

      <TextInput
        style={s.input}
        placeholder="Full Name"
        placeholderTextColor="#9ca3af"
        value={form.name}
        onChangeText={v => set('name', v)}
      />
      <TextInput
        style={s.input}
        placeholder="Email Address"
        placeholderTextColor="#9ca3af"
        keyboardType="email-address"
        autoCapitalize="none"
        value={form.email}
        onChangeText={v => set('email', v)}
      />
      <TextInput
        style={s.input}
        placeholder="Password"
        placeholderTextColor="#9ca3af"
        secureTextEntry
        value={form.password}
        onChangeText={v => set('password', v)}
      />
      <TextInput
        style={[s.input, s.textarea]}
        placeholder="Tell us about yourself"
        placeholderTextColor="#9ca3af"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        value={form.about}
        onChangeText={v => set('about', v)}
      />

      <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnText}>Submit Request</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={s.back}>← Back to Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}


const s = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#f7f8fa', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: '#0f0f0f', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#0d0d0d', marginBottom: 28, lineHeight: 20 },
  input: {
    backgroundColor: '#f8fafd', color: '#0f0f0f', borderRadius: 10, // ✅ fixed: was '#f1f5f9' (near white, invisible)
    padding: 14, marginBottom: 14, fontSize: 15, borderWidth: 1, borderColor: '#0f0f0f',
  },
  textarea: { height: 110 },
  btn: {
    backgroundColor: '#ffffff', borderRadius: 10, padding: 15,
    alignItems: 'center', marginTop: 4, marginBottom: 16,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  btnText: { color: '#121212', fontWeight: '700', fontSize: 16 },
  back: { color: '#0f0f0f', textAlign: 'center', fontSize: 14 },
});