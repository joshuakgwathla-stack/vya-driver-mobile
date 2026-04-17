import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { COLORS } from '../../constants'

export default function RegisterScreen() {
  const { register } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    phone: '', password: '', confirm_password: '',
  })

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleRegister = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.phone || !form.password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }
    if (form.password !== form.confirm_password) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await register({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
        role: 'driver',
      })
    } catch (err: any) {
      Alert.alert('Registration Failed', err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.logo}>VYA</Text>
            <Text style={styles.logoSub}>Driver</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Create driver account</Text>
            <Text style={styles.subtitle}>You'll complete your driver profile after signing up</Text>

            {([
              { key: 'first_name', label: 'First name', placeholder: 'John' },
              { key: 'last_name', label: 'Last name', placeholder: 'Doe' },
              { key: 'email', label: 'Email', placeholder: 'you@example.com', keyboard: 'email-address', caps: 'none' },
              { key: 'phone', label: 'Phone number', placeholder: '+27 81 234 5678', keyboard: 'phone-pad' },
              { key: 'password', label: 'Password', placeholder: '8+ characters', secure: true },
              { key: 'confirm_password', label: 'Confirm password', placeholder: 'Re-enter password', secure: true },
            ] as any[]).map(f => (
              <View key={f.key} style={styles.field}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  value={(form as any)[f.key]}
                  onChangeText={v => set(f.key, v)}
                  placeholder={f.placeholder}
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType={f.keyboard || 'default'}
                  autoCapitalize={f.caps || 'words'}
                  secureTextEntry={f.secure}
                  autoCorrect={false}
                />
              </View>
            ))}

            <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.navy} />
                : <Text style={styles.btnText}>Create Account</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.link} onPress={() => router.back()}>
              <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
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
  card: { backgroundColor: COLORS.white, borderRadius: 20, padding: 24, gap: 14 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.navy },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: -6 },
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
