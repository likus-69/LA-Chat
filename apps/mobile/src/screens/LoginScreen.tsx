import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { login } from '../api';
import { ApiError } from '../api';
import type { UserProfileDto } from '@la-chat/shared-types';

interface Props {
  onLogin: (profile: UserProfileDto) => void;
}

export function LoginScreen({ onLogin }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!identifier.trim() || !password) return;
    setLoading(true);
    try {
      const data = await login(identifier.trim(), password);
      onLogin(data.user);
    } catch (err) {
      const msg = err instanceof ApiError ? `Login failed (${err.status})` : 'Network error';
      Alert.alert('Login failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <View style={styles.logoRow}>
          <View style={styles.logo}><Text style={styles.logoText}>LA</Text></View>
          <View>
            <Text style={styles.title}>LA Chat</Text>
            <Text style={styles.subtitle}>Light Academy Secondary School</Text>
          </View>
        </View>
        <Text style={styles.motto}>A Different Approach to Education</Text>

        <TextInput
          style={styles.input}
          placeholder="Admission No / Staff No / Email"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: '#1e3a5f', padding: 20 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 28 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  logo: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#1e3a5f', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#d4a017', fontSize: 20, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '700', color: '#1e3a5f' },
  subtitle: { fontSize: 13, color: '#64748b' },
  motto: { fontStyle: 'italic', color: '#94a3b8', fontSize: 13, marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  button: { backgroundColor: '#1e3a5f', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
