import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { tripsApi } from '../../lib/api'
import { COLORS } from '../../constants'

const STATUS_FLOW: Record<string, { next: string; label: string }> = {
  scheduled:   { next: 'in_progress', label: 'Start Trip' },
  confirmed:   { next: 'in_progress', label: 'Start Trip' },
  in_progress: { next: 'completed',   label: 'Complete Trip' },
}

function statusColor(s: string) {
  if (s === 'in_progress') return COLORS.success
  if (s === 'scheduled' || s === 'confirmed') return COLORS.warning
  return COLORS.textMuted
}

function statusLabel(s: string) {
  if (s === 'in_progress') return 'In Progress'
  if (s === 'scheduled') return 'Scheduled'
  if (s === 'confirmed') return 'Confirmed'
  if (s === 'completed') return 'Completed'
  return s
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
    const isStart = transition.next === 'in_progress'
    Alert.alert(
      transition.label,
      isStart
        ? 'Confirm all passengers are aboard before starting.'
        : 'Mark this trip as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: transition.label,
          style: isStart ? 'default' : 'destructive',
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
        <Text style={styles.loadingText}>Loading trip...</Text>
      </View>
    )
  }

  if (!trip) return null

  const dep = new Date(trip.departure_time)
  const transition = STATUS_FLOW[trip.status]
  const confirmedPax = passengers.filter(p => p.payment_status === 'paid')
  const pendingPax = passengers.filter(p => p.payment_status !== 'paid')
  const sc = statusColor(trip.status)
  const isActive = trip.status === 'in_progress'
  const isCompleted = trip.status === 'completed'

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Trip Details</Text>
        <View style={[styles.statusPill, { backgroundColor: sc + '22' }]}>
          <Text style={[styles.statusPillText, { color: sc }]}>{statusLabel(trip.status)}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, transition && { paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={[styles.heroCard, isActive && { borderColor: COLORS.success, borderWidth: 2 }]}>
          {isActive && (
            <View style={styles.liveRow}>
              <View style={styles.liveBlip} />
              <Text style={styles.liveText}>TRIP IN PROGRESS</Text>
            </View>
          )}

          <View style={styles.heroRoute}>
            <View style={styles.heroCity}>
              <View style={styles.dotGreen} />
              <Text style={styles.heroCityText}>{trip.origin_city}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroCity}>
              <View style={styles.dotGold} />
              <Text style={styles.heroCityText}>{trip.destination_city}</Text>
            </View>
          </View>

          <Text style={styles.heroDate}>
            {dep.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
            {'  ·  '}
            {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </Text>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{trip.available_seats}</Text>
              <Text style={styles.heroStatLbl}>Capacity</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatVal, { color: COLORS.success }]}>{confirmedPax.length}</Text>
              <Text style={styles.heroStatLbl}>Confirmed</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatVal, { color: COLORS.gold }]}>
                R{Number(trip.driver_earnings || 0).toFixed(0)}
              </Text>
              <Text style={styles.heroStatLbl}>Earnings</Text>
            </View>
          </View>
        </View>

        {/* Completed banner */}
        {isCompleted && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedIcon}>✓</Text>
            <Text style={styles.completedText}>Trip completed</Text>
          </View>
        )}

        {/* Confirmed passengers */}
        {confirmedPax.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Confirmed Passengers ({confirmedPax.length})
            </Text>
            {confirmedPax.map(p => (
              <View key={p.id} style={styles.paxCard}>
                <View style={styles.paxAvatar}>
                  <Text style={styles.paxAvatarText}>{p.first_name?.[0]}{p.last_name?.[0]}</Text>
                </View>
                <View style={styles.paxInfo}>
                  <Text style={styles.paxName}>{p.first_name} {p.last_name}</Text>
                  <Text style={styles.paxMeta}>{p.seats_booked} seat{p.seats_booked !== 1 ? 's' : ''}</Text>
                  {p.pickup_address && (
                    <Text style={styles.paxPickup} numberOfLines={1}>📍 {p.pickup_address}</Text>
                  )}
                </View>
                <View style={styles.codeTag}>
                  <Text style={styles.codeTagLabel}>CODE</Text>
                  <Text style={styles.codeTagVal}>{p.pickup_code || '—'}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Chat shortcuts — only during trip */}
        {isActive && confirmedPax.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Message Passengers</Text>
            <View style={styles.chatGrid}>
              {confirmedPax.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.chatBtn}
                  onPress={() => router.push(`/messages/${p.id}`)}
                  activeOpacity={0.85}
                >
                  <View style={styles.chatAvatar}>
                    <Text style={styles.chatAvatarText}>{p.first_name?.[0]}{p.last_name?.[0]}</Text>
                  </View>
                  <Text style={styles.chatName} numberOfLines={1}>{p.first_name}</Text>
                  <Text style={styles.chatIcon}>💬</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Pending (unpaid) passengers */}
        {pendingPax.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Payment ({pendingPax.length})</Text>
            {pendingPax.map(p => (
              <View key={p.id} style={[styles.paxCard, styles.paxCardPending]}>
                <View style={[styles.paxAvatar, { backgroundColor: COLORS.border }]}>
                  <Text style={[styles.paxAvatarText, { color: COLORS.textMuted }]}>
                    {p.first_name?.[0]}{p.last_name?.[0]}
                  </Text>
                </View>
                <View style={styles.paxInfo}>
                  <Text style={[styles.paxName, { color: COLORS.textSecondary }]}>{p.first_name} {p.last_name}</Text>
                  <Text style={[styles.paxMeta, { color: COLORS.warning }]}>⏳ Awaiting payment</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {passengers.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No passengers yet</Text>
            <Text style={styles.emptyText}>Passengers will appear here once they book and pay.</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky action bar */}
      {transition && (
        <View style={styles.actionBar}>
          <View style={styles.actionBarLeft}>
            <Text style={styles.actionBarLabel}>
              {transition.next === 'in_progress'
                ? `${confirmedPax.length} passenger${confirmedPax.length !== 1 ? 's' : ''} confirmed`
                : `R${Number(trip.driver_earnings || 0).toFixed(0)} earned`}
            </Text>
            <Text style={styles.actionBarSub}>
              {transition.next === 'in_progress' ? 'Ready to depart?' : 'Mark the trip as done'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: transition.next === 'in_progress' ? COLORS.success : COLORS.navy },
              updating && { opacity: 0.7 },
            ]}
            onPress={handleStatusUpdate}
            disabled={updating}
            activeOpacity={0.85}
          >
            {updating
              ? <ActivityIndicator color="white" />
              : <Text style={styles.actionBtnText}>{transition.label}</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: COLORS.offWhite },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? 44 : 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backArrow: { fontSize: 22, color: COLORS.navy, fontWeight: '600' },
  topTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navy },
  statusPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  scroll: { padding: 16, gap: 16, paddingBottom: 40 },

  heroCard: {
    backgroundColor: COLORS.navy, borderRadius: 20, padding: 20, gap: 14,
    borderWidth: 1, borderColor: 'transparent',
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveBlip: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  liveText: { fontSize: 11, fontWeight: '800', color: COLORS.success, letterSpacing: 0.5 },

  heroRoute: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroCity: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  heroCityText: { fontSize: 17, fontWeight: '900', color: COLORS.white },
  heroDivider: { width: 16, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#34d399' },
  dotGold: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },

  heroDate: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },

  heroStats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 14 },
  heroStat: { flex: 1, alignItems: 'center', gap: 3 },
  heroStatVal: { fontSize: 22, fontWeight: '900', color: COLORS.white },
  heroStatLbl: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  heroStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },

  completedBanner: {
    backgroundColor: COLORS.successLight, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: COLORS.success + '44',
  },
  completedIcon: { fontSize: 18, color: COLORS.success },
  completedText: { fontSize: 15, fontWeight: '700', color: COLORS.success },

  section: { gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  paxCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  paxCardPending: { opacity: 0.65 },
  paxAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  paxAvatarText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  paxInfo: { flex: 1, gap: 2 },
  paxName: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  paxMeta: { fontSize: 12, color: COLORS.textSecondary },
  paxPickup: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  codeTag: {
    backgroundColor: COLORS.gold, borderRadius: 10, padding: 10, alignItems: 'center', minWidth: 60,
  },
  codeTagLabel: { fontSize: 8, fontWeight: '700', color: COLORS.navy, letterSpacing: 1, textTransform: 'uppercase' },
  codeTagVal: { fontSize: 15, fontWeight: '900', color: COLORS.navy, letterSpacing: 2 },

  chatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.border, flex: 1, minWidth: '45%',
  },
  chatAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  chatName: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.navy },
  chatIcon: { fontSize: 16 },

  empty: { alignItems: 'center', padding: 50, gap: 8 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },

  // Sticky action bar
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 16,
  },
  actionBarLeft: { flex: 1 },
  actionBarLabel: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  actionBarSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  actionBtn: {
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center', minWidth: 150,
  },
  actionBtnText: { fontSize: 15, fontWeight: '800', color: 'white' },
})
