import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator,
  Modal, FlatList, RefreshControl, Alert, Platform,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { COLORS, ORIGIN_CITIES, DESTINATION_CITIES, API_URL } from '../../constants'
import { passengerTripsApi, passengerBookingsApi } from '../../lib/api'

// ── Helpers ────────────────────────────────────────────────────
function buildDateOptions() {
  const opts = []
  const now = new Date()
  for (let i = 0; i < 14; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const iso = d.toISOString().split('T')[0]
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
    opts.push({ iso, label })
  }
  return opts
}

const DATE_OPTIONS = buildDateOptions()

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ── Trip search + booking ──────────────────────────────────────
function FindTrip() {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [dateIso, setDateIso] = useState(DATE_OPTIONS[0].iso)
  const [trips, setTrips] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  // Booking modal
  const [selectedTrip, setSelectedTrip] = useState<any>(null)
  const [seats, setSeats] = useState(1)
  const [pickupAddress, setPickupAddress] = useState('')
  const [booking, setBooking] = useState(false)
  const [confirmed, setConfirmed] = useState<any>(null)

  const search = async () => {
    if (!origin || !destination) {
      Alert.alert('Missing details', 'Please select an origin and destination.')
      return
    }
    setLoading(true)
    setSearched(true)
    setTrips([])
    try {
      const { data } = await passengerTripsApi.search({ origin, destination, date: dateIso })
      setTrips(data.data || [])
    } catch {
      Alert.alert('Search failed', 'Could not load trips. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const confirmBooking = async () => {
    if (!pickupAddress.trim()) {
      Alert.alert('Pickup address required', 'Enter where you need to be collected.')
      return
    }
    setBooking(true)
    try {
      const payload: any = {
        trip_id: selectedTrip.id,
        seats_booked: seats,
        pickup_address: pickupAddress.trim(),
        dropoff_address: selectedTrip.destination_city,
      }
      const { data } = await passengerBookingsApi.create(payload)
      setConfirmed(data.data)
      setSelectedTrip(null)
      setPickupAddress('')
      setSeats(1)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Booking failed. Please try again.'
      Alert.alert('Could not book', msg)
    } finally {
      setBooking(false)
    }
  }

  const openPayment = async (bookingId: string) => {
    await WebBrowser.openBrowserAsync(`${API_URL}/api/payments/checkout/${bookingId}`)
  }

  return (
    <ScrollView contentContainerStyle={styles.section} keyboardShouldPersistTaps="handled">
      {/* ── Origin ── */}
      <Text style={styles.label}>From</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {ORIGIN_CITIES.map(c => (
          <TouchableOpacity
            key={c}
            onPress={() => setOrigin(c)}
            style={[styles.chip, origin === c && styles.chipActive]}
          >
            <Text style={[styles.chipText, origin === c && styles.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Destination ── */}
      <Text style={[styles.label, { marginTop: 16 }]}>To</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {DESTINATION_CITIES.map(c => (
          <TouchableOpacity
            key={c}
            onPress={() => setDestination(c)}
            style={[styles.chip, destination === c && styles.chipActive]}
          >
            <Text style={[styles.chipText, destination === c && styles.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Date ── */}
      <Text style={[styles.label, { marginTop: 16 }]}>Date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {DATE_OPTIONS.map(d => (
          <TouchableOpacity
            key={d.iso}
            onPress={() => setDateIso(d.iso)}
            style={[styles.chip, dateIso === d.iso && styles.chipActive]}
          >
            <Text style={[styles.chipText, dateIso === d.iso && styles.chipTextActive]}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Search button ── */}
      <TouchableOpacity style={styles.searchBtn} onPress={search} activeOpacity={0.85}>
        <Text style={styles.searchBtnText}>Search trips</Text>
      </TouchableOpacity>

      {/* ── Results ── */}
      {loading && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 24 }} />}

      {!loading && searched && trips.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No trips found</Text>
          <Text style={styles.emptyText}>Try a different date or route.</Text>
        </View>
      )}

      {trips.map(t => (
        <TouchableOpacity
          key={t.id}
          style={styles.tripCard}
          onPress={() => setSelectedTrip(t)}
          activeOpacity={0.85}
        >
          <View style={styles.tripRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripRoute}>{t.origin_city} → {t.destination_city}</Text>
              <Text style={styles.tripTime}>{fmtDate(t.departure_time)} · {fmtTime(t.departure_time)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.tripPrice}>R{Number(t.price_per_seat).toFixed(0)}</Text>
              <Text style={styles.tripSeats}>{t.available_seats} seats</Text>
            </View>
          </View>
          {!t.driver_id && (
            <Text style={styles.phantomBadge}>No driver yet — books your slot</Text>
          )}
        </TouchableOpacity>
      ))}

      {/* ── Booking confirmed card ── */}
      {confirmed && (
        <View style={styles.confirmedCard}>
          <Text style={styles.confirmedTitle}>Seat booked!</Text>
          <Text style={styles.confirmedCode}>Code: {confirmed.pickup_code}</Text>
          <Text style={styles.confirmedSub}>
            {confirmed.seats_booked} seat{confirmed.seats_booked > 1 ? 's' : ''} · R{Number(confirmed.total_price).toFixed(0)}
          </Text>
          <TouchableOpacity
            style={styles.payBtn}
            onPress={() => { openPayment(confirmed.id); setConfirmed(null) }}
            activeOpacity={0.85}
          >
            <Text style={styles.payBtnText}>Pay now →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setConfirmed(null)} style={{ marginTop: 8 }}>
            <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>Pay later</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Booking modal ── */}
      <Modal visible={!!selectedTrip} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedTrip && (
              <>
                <Text style={styles.modalTitle}>
                  {selectedTrip.origin_city} → {selectedTrip.destination_city}
                </Text>
                <Text style={styles.modalSub}>
                  {fmtDate(selectedTrip.departure_time)} · {fmtTime(selectedTrip.departure_time)}
                  {'  ·  '}R{Number(selectedTrip.price_per_seat).toFixed(0)}/seat
                </Text>

                {/* Seats */}
                <Text style={styles.modalLabel}>Seats</Text>
                <View style={styles.seatsRow}>
                  {[1, 2, 3, 4].map(n => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setSeats(n)}
                      style={[styles.seatBtn, seats === n && styles.seatBtnActive]}
                    >
                      <Text style={[styles.seatBtnText, seats === n && styles.seatBtnTextActive]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Pickup */}
                <Text style={styles.modalLabel}>Your pickup address</Text>
                <TextInput
                  style={styles.addressInput}
                  value={pickupAddress}
                  onChangeText={setPickupAddress}
                  placeholder="e.g. 14 Oak St, Sandton"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                />

                <Text style={styles.totalLine}>
                  Total: R{(Number(selectedTrip.price_per_seat) * seats).toFixed(0)}
                </Text>

                <TouchableOpacity
                  style={[styles.confirmBtn, booking && { opacity: 0.6 }]}
                  onPress={confirmBooking}
                  disabled={booking}
                  activeOpacity={0.85}
                >
                  {booking
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.confirmBtnText}>Confirm booking</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setSelectedTrip(null); setPickupAddress(''); setSeats(1) }}
                  style={{ marginTop: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

// ── My passenger bookings ──────────────────────────────────────
function MyBookings() {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data } = await passengerBookingsApi.getMyBookings({ limit: 20 })
      setBookings(data.data || [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openPayment = async (id: string) => {
    await WebBrowser.openBrowserAsync(`${API_URL}/api/payments/checkout/${id}`)
  }

  if (loading) {
    return <ActivityIndicator color={COLORS.gold} style={{ marginTop: 48 }} />
  }

  if (!bookings.length) {
    return (
      <View style={[styles.emptyBox, { marginTop: 48 }]}>
        <Text style={styles.emptyTitle}>No bookings yet</Text>
        <Text style={styles.emptyText}>Use Find a Trip to book a seat as a passenger.</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={bookings}
      keyExtractor={b => b.id}
      contentContainerStyle={styles.section}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={COLORS.gold} />}
      renderItem={({ item: b }) => (
        <View style={styles.bookingCard}>
          <View style={styles.tripRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripRoute}>{b.origin_city} → {b.destination_city}</Text>
              <Text style={styles.tripTime}>{fmtDate(b.departure_time)} · {fmtTime(b.departure_time)}</Text>
              <Text style={styles.bookingCode}>Code: {b.pickup_code}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={[styles.statusBadge,
                b.payment_status === 'paid' ? styles.statusPaid
                  : b.status === 'cancelled' ? styles.statusCancelled
                  : styles.statusPending
              ]}>
                <Text style={styles.statusText}>
                  {b.payment_status === 'paid' ? 'Paid' : b.status === 'cancelled' ? 'Cancelled' : 'Unpaid'}
                </Text>
              </View>
              <Text style={styles.tripPrice}>R{Number(b.total_price).toFixed(0)}</Text>
            </View>
          </View>
          {b.payment_status !== 'paid' && b.status !== 'cancelled' && (
            <TouchableOpacity style={styles.payBtnSmall} onPress={() => openPayment(b.id)} activeOpacity={0.85}>
              <Text style={styles.payBtnSmallText}>Pay now</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    />
  )
}

// ── Screen ─────────────────────────────────────────────────────
export default function TravelScreen() {
  const [tab, setTab] = useState<'find' | 'bookings'>('find')

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Travel as Passenger</Text>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'find' && styles.tabBtnActive]}
            onPress={() => setTab('find')}
          >
            <Text style={[styles.tabBtnText, tab === 'find' && styles.tabBtnTextActive]}>Find a trip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'bookings' && styles.tabBtnActive]}
            onPress={() => setTab('bookings')}
          >
            <Text style={[styles.tabBtnText, tab === 'bookings' && styles.tabBtnTextActive]}>My bookings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab === 'find' ? <FindTrip /> : <MyBookings />}
    </SafeAreaView>
  )
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },

  header: {
    backgroundColor: COLORS.navy,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 12 },

  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#fff' },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  tabBtnTextActive: { color: COLORS.navy },

  section: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 },

  chipRow: { flexDirection: 'row' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  chipTextActive: { color: '#fff' },

  searchBtn: {
    backgroundColor: COLORS.gold, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  searchBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  emptyText: { fontSize: 13, color: COLORS.textSecondary },

  tripCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginTop: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  bookingCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginTop: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  tripRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tripRoute: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 3 },
  tripTime: { fontSize: 12, color: COLORS.textSecondary },
  tripPrice: { fontSize: 16, fontWeight: '800', color: COLORS.navy },
  tripSeats: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  phantomBadge: { fontSize: 11, color: COLORS.gold, fontWeight: '600', marginTop: 6 },

  bookingCode: { fontSize: 11, color: COLORS.textMuted, marginTop: 3, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 4 },
  statusPaid: { backgroundColor: COLORS.successLight },
  statusCancelled: { backgroundColor: COLORS.dangerLight },
  statusPending: { backgroundColor: COLORS.warningLight },
  statusText: { fontSize: 11, fontWeight: '700', color: COLORS.text },

  payBtnSmall: {
    marginTop: 10, paddingVertical: 8, borderRadius: 8,
    backgroundColor: COLORS.gold, alignItems: 'center',
  },
  payBtnSmallText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  confirmedCard: {
    backgroundColor: COLORS.successLight, borderRadius: 14,
    padding: 20, marginTop: 20, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.success,
  },
  confirmedTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  confirmedCode: { fontSize: 22, fontWeight: '900', color: COLORS.navy, letterSpacing: 3, marginVertical: 6 },
  confirmedSub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  payBtn: {
    backgroundColor: COLORS.gold, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 32,
  },
  payBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 },

  seatsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  seatBtn: {
    width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#fff',
  },
  seatBtnActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  seatBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  seatBtnTextActive: { color: '#fff' },

  addressInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: COLORS.text,
    minHeight: 56, textAlignVertical: 'top', marginBottom: 16,
  },
  totalLine: { fontSize: 15, fontWeight: '800', color: COLORS.navy, marginBottom: 16 },

  confirmBtn: {
    backgroundColor: COLORS.gold, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
})
