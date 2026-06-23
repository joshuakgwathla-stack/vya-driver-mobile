import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, ScrollView, Linking,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { COLORS } from '../../constants'
import { VyaIcon } from '../../components/VyaLogo'

export default function RegisterScreen() {
  const { register } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [consent, setConsent] = useState(false)
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
    if (!consent) {
      Alert.alert('Consent required', 'Please accept the Privacy Policy and Terms of Service to continue.')
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
        consent: true,
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
            <VyaIcon size={56} />
            <Text style={styles.brandName}>vya</Text>
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

            {/* POPIA consent */}
            <TouchableOpacity style={styles.consentRow} onPress={() => setConsent(c => !c)} activeOpacity={0.7}>
              <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
                {consent && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.consentText}>
                I agree to Vya&apos;s{' '}
                <Text style={styles.consentLink} onPress={() => Linking.openURL('https://vya-gae.com/privacy-policy')}>Privacy Policy</Text>
                {' '}and{' '}
                <Text style={styles.consentLink} onPress={() => Linking.openURL('https://vya-gae.com/terms')}>Terms of Service</Text>
                . I consent to my personal information being used to facilitate shuttle operations.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, !consent && { opacity: 0.5 }]} onPress={handleRegister} disabled={loading || !consent}>
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
  hero: { alignItems: 'center', gap: 6 },
  brandName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 6,
    marginTop: 8,
  },
  logoSub: { fontSize: 12, fontWeight: '700', color: COLORS.gold, letterSpacing: 4, textTransform: 'uppercase' },
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
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  checkmark: { color: COLORS.navy, fontSize: 12, fontWeight: '800' },
  consentText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  consentLink: { color: COLORS.gold, fontWeight: '700', textDecorationLine: 'underline' },
})
