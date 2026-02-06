import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';

import api from '../utils/config';

export default function LoginScreen({ navigation }: any) {
  // CHANGED: Replaced Location/Number state with a single username state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // CHANGED: Validation now checks simple username
    if(!username || !password) return Alert.alert("Error", "Missing fields");

    // Note: The constructed 'username' variable is now just the state value
    const finalUsername = username.trim();

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('username', finalUsername);
      formData.append('password', password);

      const response = await api.post('/auth/token', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.status === 200) {
        try {
          const checkResponse = await api.get(`/household/check/${finalUsername}`);

          if (checkResponse.data.exists) {
            navigation.replace('Dashboard', { username: finalUsername });
          } else {
            navigation.replace('CreateHousehold', { username: finalUsername });
          }
        } catch (checkError) {
          console.error(checkError);
          navigation.replace('Dashboard', { username: finalUsername });
        }
      }
    } catch (error) {
      Alert.alert('Login Failed', 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.header}>User Login</Text>

        {/* CHANGED: Replaced the Row/Modal UI with a standard TextInput */}
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Enter Username"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>No Account? Register Here</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e1f5fe' },
  content: { flex: 1, justifyContent: 'center', padding: 30 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#0277bd', textAlign: 'center', marginBottom: 40 },
  label: { marginBottom: 5, fontWeight: 'bold', color: '#555' },
  // Removed 'row', 'prefix', 'sep', 'box', 'modalBg', 'modalBox' etc. styles as they are no longer needed
  input: { height: 50, borderWidth: 1, borderColor: '#0277bd', borderRadius: 8, paddingHorizontal: 10, backgroundColor: '#fff', marginBottom: 20 },
  button: { height: 50, backgroundColor: '#0277bd', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  link: { textAlign: 'center', marginTop: 20, color: '#01579b', textDecorationLine: 'underline' },
});