import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/auth'
import { driverApi } from '../lib/api'
import { COLORS } from '../constants'

// Replaces a long manual form with two document photos + a short confirm step —
// see the onboarding redesign (panel review, 2026-11-22). PDP is deliberately NOT
// part of this flow — not required for informal drivers at launch. Bank details are
// a third, skippable step: not required to reach the queue, but asked for right away
// so "get paid quickly" is something we can actually promise.
//
// 2026-11-22 — hardened for our actual users, not a generic smartphone owner:
// minibus taxi drivers in SA have historically had zero app support specifically
// because of data cost, not literacy (confirmed via research into the sector).
// So: compress photos before upload, save progress locally so a dropped connection
// or interruption never costs a driver a redo, and let a failed upload retry with
// the same photo instead of forcing a reshoot. None of this adds a single extra
// tap to the normal path — it only shows up if something actually goes wrong.
type Step = 'license' | 'vehicle' | 'bank'

const DRAFT_KEY = 'onboarding_draft_v1'
const isValidDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value).getTime())

// Document photos only need to be legible, not full camera resolution — this is
// the single biggest lever on data cost, which research names as the actual
// barrier for this user base (more so than literacy or device quality).
const compressForUpload = async (uri: string) => {
  const result = await manipulateAsync(uri, [{ resize: { width: 1400 } }], { compress: 0.5, format: SaveFormat.JPEG })
  return result.uri
}

export default function OnboardingScreen() {
  const { refresh, user } = useAuth()
  // Scoped per-account — AsyncStorage is device-wide, and a shared/test device with
  // multiple drivers logging in and out must never show one person's draft to another.
  const draftKey = user?.id ? `${DRAFT_KEY}_${user.id}` : null
  const router = useRouter()
  const [step, setStep] = useState<Step>('license')
  const [restored, setRestored] = useState(false)

  // License step state
  const [licenseUri, setLicenseUri] = useState('')
  const [licenseDocUrl, setLicenseDocUrl] = useState('')
  const [extractingLicense, setExtractingLicense] = useState(false)
  const [licenseNumber, setLicenseNumber] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [licenseExpiry, setLicenseExpiry] = useState('')

  // Vehicle step state
  const [natisUri, setNatisUri] = useState('')
  const [natisDocUrl, setNatisDocUrl] = useState('')
  const [extractingNatis, setExtractingNatis] = useState(false)
  const [regNumber, setRegNumber] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [color, setColor] = useState('')
  const [vin, setVin] = useState('')
  const [capacity, setCapacity] = useState('')

  // Bank step state — optional, skippable
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')

  const [saving, setSaving] = useState(false)

  // Restore any in-progress draft on mount — a dropped connection or an interrupted
  // app shouldn't cost a driver a full redo (and the data it took to get there).
  useEffect(() => {
    if (!draftKey) return
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(draftKey)
        if (raw) {
          const d = JSON.parse(raw)
          setStep(d.step || 'license')
          setLicenseUri(d.licenseUri || ''); setLicenseDocUrl(d.licenseDocUrl || '')
          setLicenseNumber(d.licenseNumber || ''); setIdNumber(d.idNumber || ''); setLicenseExpiry(d.licenseExpiry || '')
          setNatisUri(d.natisUri || ''); setNatisDocUrl(d.natisDocUrl || '')
          setRegNumber(d.regNumber || ''); setMake(d.make || ''); setModel(d.model || '')
          setYear(d.year || ''); setColor(d.color || ''); setVin(d.vin || ''); setCapacity(d.capacity || '')
        }
      } catch {}
      setRestored(true)
    })()
  }, [draftKey])

  // Autosave the draft as the driver progresses — deliberately not on bank fields,
  // those aren't worth re-prompting for if lost and clear on finish regardless.
  useEffect(() => {
    if (!restored || !draftKey) return // don't overwrite a saved draft with blank initial state
    AsyncStorage.setItem(draftKey, JSON.stringify({
      step, licenseUri, licenseDocUrl, licenseNumber, idNumber, licenseExpiry,
      natisUri, natisDocUrl, regNumber, make, model, year, color, vin, capacity,
    })).catch(() => {})
  }, [restored, draftKey, step, licenseUri, licenseDocUrl, licenseNumber, idNumber, licenseExpiry,
      natisUri, natisDocUrl, regNumber, make, model, year, color, vin, capacity])

  const clearDraft = () => { if (draftKey) AsyncStorage.removeItem(draftKey).catch(() => {}) }

  // Runs the extraction call against whatever photo is currently set for this
  // document — used both right after capture and by "Retry" on a failed attempt,
  // so a transient network error never forces a reshoot.
  const runExtraction = async (
    documentType: 'license' | 'natis',
    uri: string,
    setExtracting: (b: boolean) => void,
    onFields: (fields: any, documentUrl: string) => void,
  ) => {
    setExtracting(true)
    try {
      const { data } = await driverApi.extractDocument(documentType, uri, 'image/jpeg')
      onFields(data.data.fields, data.data.document_url)
    } catch (err: any) {
      Alert.alert(
        "Couldn't process that",
        err.response?.data?.message || 'Check your connection and try again.',
        [
          { text: 'Retake Photo', style: 'cancel' },
          { text: 'Retry', onPress: () => runExtraction(documentType, uri, setExtracting, onFields) },
        ],
      )
    } finally {
      setExtracting(false)
    }
  }

  const captureAndExtract = async (
    documentType: 'license' | 'natis',
    fromCamera: boolean,
    setUri: (u: string) => void,
    setExtracting: (b: boolean) => void,
    onFields: (fields: any, documentUrl: string) => void,
  ) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', `Allow access to your ${fromCamera ? 'camera' : 'photos'} to continue.`)
      return
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (result.canceled || !result.assets?.[0]) return

    const compressedUri = await compressForUpload(result.assets[0].uri)
    setUri(compressedUri)
    await runExtraction(documentType, compressedUri, setExtracting, onFields)
  }

  const pickLicense = (fromCamera: boolean) =>
    captureAndExtract('license', fromCamera, setLicenseUri, setExtractingLicense, (fields, url) => {
      setLicenseDocUrl(url)
      if (fields?.license_number) setLicenseNumber(fields.license_number)
      if (fields?.id_number) setIdNumber(fields.id_number)
      if (fields?.license_expiry) setLicenseExpiry(fields.license_expiry)
      if (!fields?.license_number && !fields?.id_number && !fields?.license_expiry) {
        Alert.alert("Couldn't read this clearly", 'Please check the fields below and fill in anything missing.')
      }
    })

  const pickNatis = (fromCamera: boolean) =>
    captureAndExtract('natis', fromCamera, setNatisUri, setExtractingNatis, (fields, url) => {
      setNatisDocUrl(url)
      if (fields?.registration_number) setRegNumber(fields.registration_number)
      if (fields?.make) setMake(fields.make)
      if (fields?.model) setModel(fields.model)
      if (fields?.year) setYear(String(fields.year))
      if (fields?.color) setColor(fields.color)
      if (fields?.vin) setVin(fields.vin)
      if (!fields?.registration_number && !fields?.make && !fields?.model) {
        Alert.alert("Couldn't read this clearly", 'Please check the fields below and fill in anything missing.')
      }
    })

  const continueFromLicense = () => {
    if (!licenseNumber.trim() || !idNumber.trim() || !licenseExpiry.trim()) {
      Alert.alert('Missing info', 'License number, ID number and license expiry are all required.')
      return
    }
    if (!isValidDateString(licenseExpiry.trim())) {
      Alert.alert('Invalid date', 'License expiry must be in YYYY-MM-DD format, e.g. 2028-06-15.')
      return
    }
    setStep('vehicle')
  }

  const continueFromVehicle = async () => {
    if (!regNumber.trim() || !make.trim() || !model.trim() || !year.trim() || !color.trim() || !capacity.trim()) {
      Alert.alert('Missing info', 'Registration number, make, model, year, color and seat capacity are all required.')
      return
    }
    const cap = parseInt(capacity, 10)
    if (isNaN(cap) || cap < 2 || cap > 35) {
      Alert.alert('Invalid capacity', 'Seat capacity must be between 2 and 35.')
      return
    }

    setSaving(true)
    try {
      const profileFd = new FormData()
      profileFd.append('license_number', licenseNumber)
      profileFd.append('id_number', idNumber)
      profileFd.append('license_expiry', licenseExpiry)
      if (licenseDocUrl) profileFd.append('license_document', licenseDocUrl)
      await driverApi.createProfile(profileFd)

      const vehicleFd = new FormData()
      vehicleFd.append('make', make.trim())
      vehicleFd.append('model', model.trim())
      vehicleFd.append('year', year.trim())
      vehicleFd.append('color', color.trim())
      vehicleFd.append('registration_number', regNumber.trim().toUpperCase())
      vehicleFd.append('capacity', String(cap))
      if (vin.trim()) vehicleFd.append('vin', vin.trim())
      if (natisDocUrl) vehicleFd.append('natis_document', natisDocUrl)
      await driverApi.addVehicle(vehicleFd)

      // Don't refresh() yet — that would flip has_vehicle to true and the root
      // layout would redirect straight to the tabs, skipping the bank step below.
      setStep('bank')
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not complete setup — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const goToTabs = async () => {
    clearDraft()
    await refresh()
    router.replace('/(tabs)')
  }

  const saveBankAndFinish = async () => {
    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) {
      Alert.alert('Missing info', 'Fill in all three fields, or tap "Skip for now" instead.')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('bank_name', bankName.trim())
      fd.append('bank_account', accountNumber.trim())
      fd.append('account_holder_name', accountHolder.trim())
      await driverApi.updateProfile(fd)
      await goToTabs()
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save bank details — you can add them later from your Profile.')
    } finally {
      setSaving(false)
    }
  }

  const skipBank = () => { goToTabs() }

  if (!restored) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={COLORS.gold} size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.stepIndicator}>Step {step === 'license' ? 1 : step === 'vehicle' ? 2 : 3} of 3</Text>
        <Text style={styles.title}>
          {step === 'license' ? "Your driver's licence" : step === 'vehicle' ? 'Your vehicle' : 'Get paid faster'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'license' && 'Take a photo of your licence and we’ll fill in the details for you.'}
          {step === 'vehicle' && 'Take a photo of your NATIS registration certificate and we’ll fill in the details for you.'}
          {step === 'bank' && 'Add your bank details now and we can pay you as soon as you start driving — no waiting around after your first trip. You can always add this later from your Profile.'}
        </Text>

        {step === 'license' ? (
          <>
            {licenseUri ? <Image source={{ uri: licenseUri }} style={styles.preview} /> : null}
            <TouchableOpacity style={styles.photoBtn} onPress={() => pickLicense(true)} disabled={extractingLicense}>
              <Text style={styles.photoBtnText}>📷 {licenseUri ? 'Retake Photo' : 'Take Photo'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.libraryLink} onPress={() => pickLicense(false)} disabled={extractingLicense}>
              <Text style={styles.libraryLinkText}>or choose from your photos</Text>
            </TouchableOpacity>
            {extractingLicense && (
              <View style={styles.extractingRow}>
                <ActivityIndicator color={COLORS.gold} />
                <Text style={styles.extractingText}>Reading your licence…</Text>
              </View>
            )}

            <View style={styles.card}>
              <Field label="License Number" value={licenseNumber} onChangeText={setLicenseNumber} autoCapitalize="characters" />
              <Field label="ID Number" value={idNumber} onChangeText={setIdNumber} keyboardType="numeric" />
              <Field label="License Expiry (YYYY-MM-DD)" value={licenseExpiry} onChangeText={setLicenseExpiry} placeholder="e.g. 2028-06-15" />
            </View>

            <TouchableOpacity style={styles.continueBtn} onPress={continueFromLicense}>
              <Text style={styles.continueBtnText}>Continue</Text>
            </TouchableOpacity>
          </>
        ) : step === 'vehicle' ? (
          <>
            {natisUri ? <Image source={{ uri: natisUri }} style={styles.preview} /> : null}
            <TouchableOpacity style={styles.photoBtn} onPress={() => pickNatis(true)} disabled={extractingNatis}>
              <Text style={styles.photoBtnText}>📷 {natisUri ? 'Retake Photo' : 'Take Photo'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.libraryLink} onPress={() => pickNatis(false)} disabled={extractingNatis}>
              <Text style={styles.libraryLinkText}>or choose from your photos</Text>
            </TouchableOpacity>
            {extractingNatis && (
              <View style={styles.extractingRow}>
                <ActivityIndicator color={COLORS.gold} />
                <Text style={styles.extractingText}>Reading your NATIS certificate…</Text>
              </View>
            )}

            <View style={styles.card}>
              <Field label="Registration Number" value={regNumber} onChangeText={setRegNumber} autoCapitalize="characters" />
              <Field label="Make" value={make} onChangeText={setMake} />
              <Field label="Model" value={model} onChangeText={setModel} />
              <Field label="Year" value={year} onChangeText={setYear} keyboardType="numeric" />
              <Field label="Color" value={color} onChangeText={setColor} />
              <Field label="Seat Capacity" value={capacity} onChangeText={setCapacity} keyboardType="numeric" placeholder="e.g. 15" />
            </View>

            <TouchableOpacity style={styles.continueBtn} onPress={continueFromVehicle} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.navy} /> : <Text style={styles.continueBtnText}>Continue</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep('license')}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.card}>
              <Field label="Bank Name" value={bankName} onChangeText={setBankName} placeholder="e.g. Capitec" />
              <Field label="Account Number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" />
              <Field label="Account Holder Name" value={accountHolder} onChangeText={setAccountHolder} />
            </View>

            <TouchableOpacity style={styles.continueBtn} onPress={saveBankAndFinish} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.navy} /> : <Text style={styles.continueBtnText}>Save & Finish</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={skipBank} disabled={saving}>
              <Text style={styles.backBtnText}>Skip for now</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Field({ label, ...props }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={COLORS.textMuted} {...props} />
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 60 },
  stepIndicator: { fontSize: 13, fontWeight: '700', color: COLORS.gold, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
  preview: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12, backgroundColor: COLORS.border },
  photoBtn: { backgroundColor: COLORS.navy, borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  photoBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  libraryLink: { paddingVertical: 10, alignItems: 'center' },
  libraryLinkText: { color: COLORS.textSecondary, fontSize: 13, textDecorationLine: 'underline' },
  extractingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10 },
  extractingText: { color: COLORS.textSecondary, fontSize: 13 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: COLORS.text },
  continueBtn: { backgroundColor: COLORS.gold, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  continueBtnText: { color: COLORS.navy, fontWeight: '800', fontSize: 16 },
  backBtn: { paddingVertical: 14, alignItems: 'center' },
  backBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
})
