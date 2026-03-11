import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1); // 1 = verify old password, 2 = enter OTP + new password
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const showAlert = (msg) => {
    if (typeof window !== 'undefined' && window.alert) window.alert(msg);
  };

  // Step 1 — verify old password then send OTP
  const handleVerifyAndSend = async () => {
    setError('');
    if (!oldPassword) { setError('Please enter your current password.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/verify-password', { email: user.email, password: oldPassword });
      await api.post('/auth/send-otp', { email: user.email });
      setSuccess(`OTP sent to ${user.email}. Check your inbox.`);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect password.');
      console.log("Sending verify with:", { email: user.email, password: oldPassword });
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify OTP + set new password
  const handleChangePassword = async () => {
    setError('');
    if (!otp || !newPassword) { setError('Please fill in all fields.'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { email: user.email, otp, newPassword });
      showAlert('✅ Password changed successfully! Please log in again.');
      await signOut();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>🔐 Change Password</Text>
      <Text style={s.subtitle}>
        {step === 1
          ? `Verify your identity, ${user?.name}.`
          : `OTP sent to ${user?.email}. Enter it with your new password.`}
      </Text>

      {error ? <Text style={s.error}>⚠ {error}</Text> : null}
      {success ? <Text style={s.successTxt}>✅ {success}</Text> : null}

      {/* Step 1 — old password */}
      {step === 1 && (
        <>
          <View style={s.emailBox}>
            <Text style={s.emailLabel}>Logged in as</Text>
            <Text style={s.emailValue}>{user?.email}</Text>
          </View>
          <TextInput
            style={s.input}
            placeholder="Current Password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={oldPassword}
            onChangeText={setOldPassword}
          />
          <TouchableOpacity style={s.btn} onPress={handleVerifyAndSend} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnTxt}>Verify & Send OTP</Text>}
              
          </TouchableOpacity>
        </>
      )
      }

      {/* Step 2 — OTP + new password */}
      {step === 2 && (
        <>
          <TextInput
            style={s.input}
            placeholder="Enter OTP"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
            maxLength={6}
          />
          <TextInput
            style={s.input}
            placeholder="New Password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TouchableOpacity style={s.btn} onPress={handleChangePassword} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnTxt}>Change Password</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setStep(1); setSuccess(''); setError(''); setOtp(''); }}>
            <Text style={s.resend}>← Try again</Text>
          </TouchableOpacity>
        </>
      )}
      

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={s.back}>← Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#0f172a', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 28, lineHeight: 20 },
  emailBox: {
    backgroundColor: '#1e293b', borderRadius: 10, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: '#334155',
  },
  emailLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  emailValue: { fontSize: 15, color: '#f1f5f9', fontWeight: '600' },
  error: { backgroundColor: '#450a0a', color: '#ef4444', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 },
  successTxt: { backgroundColor: '#052e16', color: '#10b981', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 },
  input: {
    backgroundColor: '#1e293b', color: '#f1f5f9', borderRadius: 10,
    padding: 14, marginBottom: 14, fontSize: 15, borderWidth: 1, borderColor: '#334155',
  },
  btn: { backgroundColor: '#4F46E5', borderRadius: 10, padding: 15, alignItems: 'center', marginBottom: 12 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resend: { color: '#6366f1', textAlign: 'center', fontSize: 14, marginBottom: 16 },
  back: { color: '#94a3b8', textAlign: 'center', fontSize: 14, marginTop: 8 },
});