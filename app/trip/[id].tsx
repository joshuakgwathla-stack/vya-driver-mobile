import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { tripsApi } from '../../lib/api'
import { COLORS } from '../../constants'

const STATUS_FLOW: Record<string, { next: string; label: string; color: string }> = {
  scheduled: { next: 'in_progress', label: 'Start Trip', color: COLORS.success },
  confirmed: { next: 'in_progress', label: 'Start Trip', color: COLORS.success },
  in_progress: { next: 'completed', label: 'Complete Trip', color: COLORS.navy },
}

function statusColor(s: string) {
  if (s === 'in_progress') return COLORS.success
  if (s === 'scheduled' || s === 'confirmed') return COLORS.warning
  if (s === 'completed') return COLORS.textMuted
  return COLORS.textMuted
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [trip, setTrip] = useState<any>(null)
  const [passengers, setPassengers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => { loadAll() }, [id])

  const loadAll = async () => {
    try {
      const [tripRes, paxRes] = await Promise.allSettled([
        tripsApi.getTrip(id),
        tripsApi.getPassengers(id),
      ])
      if (tripRes.status === 'fulfilled') setTrip(tripRes.value.data.data)
      if (paxRes.status === 'fulfilled') setPassengers(paxRes.value.data.data || [])
    } catch {}
    finally { setLoading(false) }
  }

  const handleStatusUpdate = async () => {
    const transition = STATUS_FLOW[trip.status]
    if (!transition) return
    Alert.alert(
      transition.label,
      `Are you sure you want to ${transition.label.toLowerCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: transition.label,
          onPress: async () => {
            setUpdating(true)
            try {
              await tripsApi.updateStatus(id, transition.next)
              await loadAll()
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Status update failed')
            } finally { setUpdating(false) }
          }
        }
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.navy} size="large" />
      </View>
    )
  }

  if (!trip) return null

  const dep = new Date(trip.departure_time)
  const transition = STATUS_FLOW[trip.status]
  const confirmedPax = passengers.filter(p => p.payment_status === 'paid')
  const pendingPax = passengers.filter(p => p.payment_status !== 'paid')

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip Details</Text>
        </View>

        {/* Trip card */}
        <View style={styles.tripCard}>
          <View style={styles.tripCardTop}>
            <View>
              <Text style={styles.route}>{trip.origin_city} → {trip.destination_city}</Text>
              <Text style={styles.tripDate}>
                {dep.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' · '}
                {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(trip.status) + '22' }]}>
              <Text style={[styles.statusText, { color: statusColor(trip.status) }]}>
                {trip.status.replace('_', ' ')}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{trip.available_seats}</Text>
              <Text style={styles.statLbl}>Capacity</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{confirmedPax.length}</Text>
              <Text style={styles.statLbl}>Confirmed</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statVal, { color: COLORS.success }]}>
                R{Number(trip.driver_earnings || 0).toFixed(0)}
              </Text>
              <Text style={styles.statLbl}>Earnings</Text>
            </View>
          </View>
        </View>

        {/* Action button */}
        {transition && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: transition.color }]}
            onPress={handleStatusUpdate}
            disabled={updating}
          >
            {updating
              ? <ActivityIndicator color="white" />
              : <Text style={styles.actionBtnText}>{transition.label}</Text>
            }
          </TouchableOpacity>
        )}

        {trip.status === 'completed' && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedText}>✓ Trip completed</Text>
          </View>
        )}

        {/* Confirmed passengers */}
        {confirmedPax.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirmed Passengers ({confirmedPax.length})</Text>
            {confirmedPax.map(p => (
              <View key={p.id} style={styles.paxCard}>
                <View style={styles.paxAvatar}>
                  <Text style={styles.paxAvatarText}>
                    {p.first_name?.[0]}{p.last_name?.[0]}
                  </Text>
                </View>
                <View style={styles.paxInfo}>
                  <Text style={styles.paxName}>{p.first_name} {p.last_name}</Text>
                  <Text style={styles.paxMeta}>{p.seats_booked} seat{p.seats_booked !== 1 ? 's' : ''}</Text>
                  {p.pickup_address && <Text style={styles.paxPickup}>📍 {p.pickup_address}</Text>}
                </View>
                <View style={styles.paxCode}>
                  <Text style={styles.paxCodeLabel}>CODE</Text>
                  <Text style={styles.paxCodeVal}>{p.pickup_code}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Chat shortcut per booking */}
        {trip.status === 'in_progress' && confirmedPax.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Message Passengers</Text>
            {confirmedPax.map(p => (
              <TouchableOpacity
                key={p.id}
                style={styles.chatBtn}
                onPress={() => router.push(`/messages/${p.id}`)}
              >
                <Text style={styles.chatBtnText}>
                  💬 {p.first_name} {p.last_name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Pending (unpaid) passengers */}
        {pendingPax.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Payment ({pendingPax.length})</Text>
            {pendingPax.map(p => (
              <View key={p.id} style={[styles.paxCard, { opacity: 0.6 }]}>
                <View style={[styles.paxAvatar, { backgroundColor: COLORS.textMuted }]}>
                  <Text style={styles.paxAvatarText}>
                    {p.first_name?.[0]}{p.last_name?.[0]}
                  </Text>
                </View>
                <View style={styles.paxInfo}>
                  <Text style={styles.paxName}>{p.first_name} {p.last_name}</Text>
                  <Text style={[styles.paxMeta, { color: COLORS.warning }]}>Awaiting payment</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {passengers.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>No passengers booked yet</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.offWhite },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingTop: Platform.OS === 'android' ? 28 : 0,
  },
  back: { padding: 4 },
  backText: { fontSize: 15, color: COLORS.navy, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  tripCard: {
    backgroundColor: COLORS.navy, borderRadius: 16, padding: 18, gap: 16,
  },
  tripCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  route: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  tripDate: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 22, fontWeight: '800', color: COLORS.gold },
  statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  actionBtn: { borderRadius: 14, padding: 16, alignItems: 'center' },
  actionBtnText: { fontSize: 16, fontWeight: '800', color: 'white' },
  completedBanner: {
    backgroundColor: COLORS.successLight, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.success + '44',
  },
  completedText: { fontSize: 15, fontWeight: '700', color: COLORS.success },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  paxCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  paxAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  paxAvatarText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  paxInfo: { flex: 1, gap: 2 },
  paxName: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  paxMeta: { fontSize: 12, color: COLORS.textSecondary },
  paxPickup: { fontSize: 11, color: COLORS.textMuted },
  paxCode: {
    backgroundColor: COLORS.gold, borderRadius: 8, padding: 8, alignItems: 'center',
  },
  paxCodeLabel: { fontSize: 9, fontWeight: '700', color: COLORS.navy, letterSpacing: 1 },
  paxCodeVal: { fontSize: 14, fontWeight: '900', color: COLORS.navy, letterSpacing: 2 },
  chatBtn: {
    backgroundColor: COLORS.white, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chatBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.navy },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
})
