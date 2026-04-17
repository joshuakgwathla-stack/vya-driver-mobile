import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator,
  Platform,
} from 'react-native'
import { useAuth } from '../../lib/auth'
import { driverApi, usersApi } from '../../lib/api'
import { COLORS } from '../../constants'

type Tab = 'profile' | 'documents'

function DocStatusBadge({ expiry }: { expiry?: string }) {
  if (!expiry) return <View style={[badge.wrap, { backgroundColor: '#f1f5f9' }]}><Text style={[badge.text, { color: COLORS.textMuted }]}>Missing</Text></View>
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000)
  if (days < 0) return <View style={[badge.wrap, { backgroundColor: COLORS.dangerLight }]}><Text style={[badge.text, { color: COLORS.danger }]}>Expired</Text></View>
  if (days <= 30) return <View style={[badge.wrap, { backgroundColor: COLORS.warningLight }]}><Text style={[badge.text, { color: '#92400e' }]}>Expires in {days}d</Text></View>
  return <View style={[badge.wrap, { backgroundColor: COLORS.successLight }]}><Text style={[badge.text, { color: COLORS.success }]}>Valid</Text></View>
}

const badge = StyleSheet.create({
  wrap: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 11, fontWeight: '700' },
})

export default function ProfileScreen() {
  const { user, logout, refresh } = useAuth()
  const [tab, setTab] = useState<Tab>('profile')
  const [profile, setProfile] = useState<any>(null)
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Profile form
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [pdpNumber, setPdpNumber] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')

  // Doc expiry fields
  const [licenseExpiry, setLicenseExpiry] = useState('')
  const [pdpExpiry, setPdpExpiry] = useState('')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [profRes, vehRes] = await Promise.allSettled([
        driverApi.getProfile(),
        driverApi.getVehicles(),
      ])
      if (profRes.status === 'fulfilled') {
        const p = profRes.value.data.data
        setProfile(p)
        setFirstName(user?.first_name || '')
        setLastName(user?.last_name || '')
        setPhone(user?.phone || '')
        setLicenseNumber(p?.license_number || '')
        setIdNumber(p?.id_number || '')
        setPdpNumber(p?.pdp_number || '')
        setBankName(p?.bank_name || '')
        setAccountNumber(p?.account_number || '')
        setAccountHolder(p?.account_holder || '')
        setLicenseExpiry(p?.license_expiry ? p.license_expiry.split('T')[0] : '')
        setPdpExpiry(p?.pdp_expiry ? p.pdp_expiry.split('T')[0] : '')
      }
      if (vehRes.status === 'fulfilled') setVehicles(vehRes.value.data.data || [])
    } catch {}
    finally { setLoading(false) }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('license_number', licenseNumber)
      fd.append('id_number', idNumber)
      fd.append('pdp_number', pdpNumber)
      fd.append('bank_name', bankName)
      fd.append('account_number', accountNumber)
      fd.append('account_holder', accountHolder)
      await Promise.all([
        driverApi.updateProfile(fd),
        usersApi.updateProfile((() => {
          const ufd = new FormData()
          ufd.append('first_name', firstName)
          ufd.append('last_name', lastName)
          ufd.append('phone', phone)
          return ufd
        })()),
      ])
      await refresh()
      Alert.alert('Saved', 'Profile updated successfully.')
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  const saveDocs = async () => {
    setSaving(true)
    try {
      const fd = new FormData()
      if (licenseExpiry) fd.append('license_expiry', licenseExpiry)
      if (pdpExpiry) fd.append('pdp_expiry', pdpExpiry)
      await driverApi.updateProfile(fd)
      await loadAll()
      Alert.alert('Saved', 'Document dates updated.')
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.navy} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'profile' && styles.tabBtnActive]}
          onPress={() => setTab('profile')}
        >
          <Text style={[styles.tabBtnText, tab === 'profile' && styles.tabBtnTextActive]}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'documents' && styles.tabBtnActive]}
          onPress={() => setTab('documents')}
        >
          <Text style={[styles.tabBtnText, tab === 'documents' && styles.tabBtnTextActive]}>Documents</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {tab === 'profile' && (
          <>
            {/* Avatar */}
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </Text>
              </View>
              <View>
                <Text style={styles.userName}>{user?.first_name} {user?.last_name}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
                <View style={[styles.statusBadge, {
                  backgroundColor: profile?.status === 'approved' ? COLORS.successLight : COLORS.warningLight
                }]}>
                  <Text style={[styles.statusText, {
                    color: profile?.status === 'approved' ? COLORS.success : '#92400e'
                  }]}>
                    {profile?.status || 'pending'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Personal Info</Text>
              {[
                { label: 'First Name', value: firstName, set: setFirstName },
                { label: 'Last Name', value: lastName, set: setLastName },
                { label: 'Phone', value: phone, set: setPhone, keyboard: 'phone-pad' },
              ].map(f => (
                <View key={f.label} style={styles.field}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={f.value}
                    onChangeText={f.set}
                    keyboardType={(f as any).keyboard || 'default'}
                    autoCapitalize="words"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Driver Details</Text>
              {[
                { label: 'License Number', value: licenseNumber, set: setLicenseNumber, caps: 'characters' },
                { label: 'ID Number', value: idNumber, set: setIdNumber, keyboard: 'numeric' },
                { label: 'PDP Number', value: pdpNumber, set: setPdpNumber, caps: 'characters' },
              ].map(f => (
                <View key={f.label} style={styles.field}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={f.value}
                    onChangeText={f.set}
                    keyboardType={(f as any).keyboard || 'default'}
                    autoCapitalize={(f as any).caps || 'none'}
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Banking Details</Text>
              <Text style={styles.cardHint}>Used for weekly payout transfers</Text>
              {[
                { label: 'Bank Name', value: bankName, set: setBankName },
                { label: 'Account Number', value: accountNumber, set: setAccountNumber, keyboard: 'numeric' },
                { label: 'Account Holder Name', value: accountHolder, set: setAccountHolder },
              ].map(f => (
                <View key={f.label} style={styles.field}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={f.value}
                    onChangeText={f.set}
                    keyboardType={(f as any).keyboard || 'default'}
                    autoCapitalize="words"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
              {saving
                ? <ActivityIndicator color={COLORS.navy} />
                : <Text style={styles.saveBtnText}>Save Profile</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        )}

        {tab === 'documents' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Driver Compliance</Text>
              <Text style={styles.cardHint}>Keep these up to date to avoid account suspension</Text>

              {/* Driving Licence */}
              <View style={styles.docRow}>
                <View style={styles.docInfo}>
                  <Text style={styles.docName}>Driving Licence</Text>
                  <DocStatusBadge expiry={profile?.license_expiry} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Expiry Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={licenseExpiry}
                    onChangeText={setLicenseExpiry}
                    placeholder="e.g. 2026-08-15"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              {/* PDP */}
              <View style={styles.docRow}>
                <View style={styles.docInfo}>
                  <Text style={styles.docName}>PDP (Professional Driving Permit)</Text>
                  <DocStatusBadge expiry={profile?.pdp_expiry} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Expiry Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={pdpExpiry}
                    onChangeText={setPdpExpiry}
                    placeholder="e.g. 2026-03-01"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={saveDocs} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={COLORS.navy} />
                  : <Text style={styles.saveBtnText}>Save Driver Documents</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Vehicle docs */}
            {vehicles.map(v => (
              <VehicleDocCard key={v.id} vehicle={v} onSaved={loadAll} />
            ))}

            {vehicles.length === 0 && (
              <View style={styles.emptyDocs}>
                <Text style={styles.emptyDocsText}>No vehicle registered yet. Complete your driver profile on the web platform first.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function VehicleDocCard({ vehicle: v, onSaved }: { vehicle: any; onSaved: () => void }) {
  const [roadworthyExpiry, setRoadworthyExpiry] = useState(v.roadworthy_expiry ? v.roadworthy_expiry.split('T')[0] : '')
  const [licenseDiskExpiry, setLicenseDiskExpiry] = useState(v.license_disk_expiry ? v.license_disk_expiry.split('T')[0] : '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const fd = new FormData()
      if (roadworthyExpiry) fd.append('roadworthy_expiry', roadworthyExpiry)
      if (licenseDiskExpiry) fd.append('license_disk_expiry', licenseDiskExpiry)
      await driverApi.updateVehicle(v.id, fd)
      onSaved()
      Alert.alert('Saved', 'Vehicle documents updated.')
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{v.make} {v.model} — {v.color}</Text>
      <Text style={styles.cardHint}>{v.registration_number}</Text>

      {/* Roadworthy */}
      <View style={styles.docRow}>
        <View style={styles.docInfo}>
          <Text style={styles.docName}>Roadworthy Certificate</Text>
          <DocStatusBadge expiry={v.roadworthy_expiry} />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Expiry Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={roadworthyExpiry}
            onChangeText={setRoadworthyExpiry}
            placeholder="e.g. 2026-12-01"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      {/* License Disk */}
      <View style={styles.docRow}>
        <View style={styles.docInfo}>
          <Text style={styles.docName}>License Disk</Text>
          <DocStatusBadge expiry={v.license_disk_expiry} />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Expiry Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={licenseDiskExpiry}
            onChangeText={setLicenseDiskExpiry}
            placeholder="e.g. 2026-09-30"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
        {saving
          ? <ActivityIndicator color={COLORS.navy} />
          : <Text style={styles.saveBtnText}>Save Vehicle Documents</Text>
        }
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.offWhite },
  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 44 : 16, paddingBottom: 0,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 4,
  },
  tabBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: COLORS.navy },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  tabBtnTextActive: { color: COLORS.navy },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: COLORS.white },
  userName: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  userEmail: { fontSize: 13, color: COLORS.textSecondary },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  card: { backgroundColor: COLORS.white, borderRadius: 14, padding: 18, gap: 14, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  cardHint: { fontSize: 12, color: COLORS.textMuted, marginTop: -8 },
  field: { gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.offWhite,
  },
  docRow: { gap: 8 },
  docInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  docName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  saveBtn: {
    backgroundColor: COLORS.gold, borderRadius: 12, padding: 14, alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  logoutBtn: {
    borderRadius: 12, padding: 14, alignItems: 'center',
    backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: '#fca5a5',
  },
  logoutBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.danger },
  emptyDocs: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  emptyDocsText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
})
