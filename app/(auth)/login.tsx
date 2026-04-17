import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { COLORS } from '../../constants'

export default function LoginScreen() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter your email and password')
      return
    }
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login failed. Check your credentials.'
      Alert.alert('Login Failed', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.logo}>VYA</Text>
            <Text style={styles.logoSub}>Driver</Text>
            <Text style={styles.tagline}>Move people. Earn more.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your driver account</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
              />
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.navy} />
                : <Text style={styles.btnText}>Sign In</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.link} onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.linkText}>New driver? <Text style={styles.linkBold}>Create an account</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 24 },
  hero: { alignItems: 'center', gap: 4 },
  logo: { fontSize: 52, fontWeight: '900', color: COLORS.gold, letterSpacing: 6 },
  logoSub: { fontSize: 16, fontWeight: '700', color: COLORS.white, letterSpacing: 4, textTransform: 'uppercase', marginTop: -8 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8 },
  card: { backgroundColor: COLORS.white, borderRadius: 20, padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.navy },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: -8 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 14, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.offWhite,
  },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 4,
  },
  btnText: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  link: { alignItems: 'center' },
  linkText: { fontSize: 14, color: COLORS.textSecondary },
  linkBold: { color: COLORS.navy, fontWeight: '700' },
})
