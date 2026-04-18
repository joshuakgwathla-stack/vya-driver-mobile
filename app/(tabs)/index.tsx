import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { driverApi, tripsApi } from '../../lib/api'
import { COLORS } from '../../constants'

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function statusColor(s: string) {
  if (s === 'in_progress') return COLORS.success
  if (s === 'scheduled' || s === 'confirmed') return COLORS.warning
  if (s === 'completed') return COLORS.textMuted
  return COLORS.textMuted
}

function statusLabel(s: string) {
  if (s === 'in_progress') return 'In Progress'
  if (s === 'scheduled') return 'Scheduled'
  if (s === 'confirmed') return 'Confirmed'
  if (s === 'completed') return 'Completed'
  return s
}

export default function HomeScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [todayTrips, setTodayTrips] = useState<any[]>([])
  const [earnings, setEarnings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [profRes, tripsRes, earningsRes] = await Promise.allSettled([
        driverApi.getProfile(),
        tripsApi.getMyTrips({ limit: 20 }),
        driverApi.getEarnings(),
      ])
      if (profRes.status === 'fulfilled') setProfile(profRes.value.data.data)
      if (tripsRes.status === 'fulfilled') {
        const all = tripsRes.value.data.data || []
        const todayStr = new Date().toISOString().split('T')[0]
        setTodayTrips(all.filter((t: any) => t.departure_time?.startsWith(todayStr)))
      }
      if (earningsRes.status === 'fulfilled') {
        const summary = earningsRes.value.data.data?.summary || {}
        setEarnings({
          today: summary.today || 0,
          week: summary.this_week || 0,
        })
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  const onRefresh = () => { setRefreshing(true); loadAll() }

  const activeTrip = todayTrips.find(t => t.status === 'in_progress')
  const nextTrip = todayTrips.find(t => t.status === 'scheduled' || t.status === 'confirmed')
  const doneToday = todayTrips.filter(t => t.status === 'completed').length
  const upcomingCount = todayTrips.filter(t => ['scheduled', 'confirmed'].includes(t.status)).length
  const isApproved = profile?.status === 'approved'

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Navy header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {getTimeOfDay()}</Text>
            <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: isApproved ? COLORS.success : COLORS.warning }]} />
            <Text style={styles.statusText}>{isApproved ? 'Active' : profile?.status || 'Pending'}</Text>
          </View>
        </View>

        {/* Account status banner */}
        {profile && !isApproved && (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>
              {profile.status === 'pending' ? '⏳ Awaiting approval' :
               profile.status === 'suspended' ? '⚠️ Account suspended' : '❌ Account rejected'}
            </Text>
            <Text style={styles.bannerBody}>
              {profile.status === 'pending'
                ? 'Set up your profile and documents while you wait. You\'ll be notified when approved.'
                : profile.status === 'suspended'
                ? 'Check your documents in Profile → Documents or contact support.'
                : 'Please contact support for details.'}
            </Text>
          </View>
        )}

        {/* Today stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>R{Number(earnings?.today || 0).toFixed(0)}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{doneToday}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{upcomingCount}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
          <View style={[styles.statCard, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' }]}>
            <Text style={styles.statValue}>R{Number(earnings?.week || 0).toFixed(0)}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
        </View>

        {/* Active trip — most prominent */}
        {activeTrip && (
          <TouchableOpacity
            style={styles.activeTripCard}
            onPress={() => router.push(`/trip/${activeTrip.id}`)}
            activeOpacity={0.88}
          >
            <View style={styles.activePillRow}>
              <View style={styles.activePill}>
                <View style={styles.activeBlip} />
                <Text style={styles.activePillText}>TRIP IN PROGRESS</Text>
              </View>
              <Text style={styles.activeTapHint}>Tap to manage →</Text>
            </View>
            <Text style={styles.activeRoute}>
              {activeTrip.origin_city} → {activeTrip.destination_city}
            </Text>
            <View style={styles.activeMeta}>
              <Text style={styles.activeMetaText}>
                {new Date(activeTrip.departure_time).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </Text>
              <Text style={styles.activeMetaDot}>·</Text>
              <Text style={styles.activeMetaText}>{activeTrip.seats_sold || 0} passengers aboard</Text>
              <Text style={styles.activeMetaDot}>·</Text>
              <Text style={[styles.activeMetaText, { color: COLORS.gold }]}>
                R{Number(activeTrip.driver_earnings || 0).toFixed(0)} earned
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Next scheduled trip */}
        {!activeTrip && nextTrip && (
          <TouchableOpacity
            style={styles.nextTripCard}
            onPress={() => router.push(`/trip/${nextTrip.id}`)}
            activeOpacity={0.88}
          >
            <View style={styles.nextTripTop}>
              <View style={styles.nextTripLabel}>
                <Text style={styles.nextTripLabelText}>NEXT TRIP</Text>
              </View>
              <Text style={styles.nextTripTime}>
                {new Date(nextTrip.departure_time).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </Text>
            </View>
            <Text style={styles.nextTripRoute}>
              {nextTrip.origin_city} → {nextTrip.destination_city}
            </Text>
            <Text style={styles.nextTripMeta}>
              {nextTrip.seats_sold || 0} passenger{nextTrip.seats_sold !== 1 ? 's' : ''} booked · Tap for details
            </Text>
          </TouchableOpacity>
        )}

        {/* Today's full schedule */}
        {todayTrips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            {todayTrips.map(t => {
              const dep = new Date(t.departure_time)
              const sc = statusColor(t.status)
              const isActive = t.status === 'in_progress'
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.scheduleRow, isActive && styles.scheduleRowActive]}
                  onPress={() => router.push(`/trip/${t.id}`)}
                  activeOpacity={0.85}
                >
                  <View style={styles.scheduleTime}>
                    <Text style={[styles.scheduleTimeText, isActive && { color: COLORS.gold }]}>
                      {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                  </View>
                  <View style={[styles.scheduleBar, { backgroundColor: sc }]} />
                  <View style={styles.scheduleInfo}>
                    <Text style={styles.scheduleRoute}>{t.origin_city} → {t.destination_city}</Text>
                    <Text style={styles.scheduleMeta}>{t.seats_sold || 0} pax · R{Number(t.driver_earnings || 0).toFixed(0)}</Text>
                  </View>
                  <View style={[styles.scheduleBadge, { backgroundColor: sc + '22' }]}>
                    <Text style={[styles.scheduleBadgeText, { color: sc }]}>{statusLabel(t.status)}</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {todayTrips.length === 0 && !loading && (
          <View style={styles.noTripsCard}>
            <Text style={styles.noTripsIcon}>📋</Text>
            <Text style={styles.noTripsTitle}>No trips today</Text>
            <Text style={styles.noTripsBody}>Join the queue to get assigned a trip for today or upcoming days.</Text>
            <TouchableOpacity style={styles.queueCta} onPress={() => router.push('/(tabs)/queue')}>
              <Text style={styles.queueCtaText}>Join Queue →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {[
              { icon: '📋', label: 'Join Queue', route: '/(tabs)/queue' },
              { icon: '🚗', label: 'All Trips', route: '/(tabs)/trips' },
              { icon: '💰', label: 'Earnings', route: '/(tabs)/earnings' },
              { icon: '📄', label: 'Documents', route: '/(tabs)/profile' },
            ].map(a => (
              <TouchableOpacity
                key={a.label}
                style={styles.actionBtn}
                onPress={() => router.push(a.route as any)}
                activeOpacity={0.85}
              >
                <Text style={styles.actionIcon}>{a.icon}</Text>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  scroll: { gap: 16, paddingBottom: 40 },

  header: {
    backgroundColor: COLORS.navy,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 20,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
  },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  name: { fontSize: 22, fontWeight: '900', color: COLORS.white, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  banner: {
    marginHorizontal: 16, backgroundColor: COLORS.warningLight, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.warning + '55', gap: 4,
  },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  bannerBody: { fontSize: 13, color: '#78350f', lineHeight: 18 },

  statsRow: {
    flexDirection: 'row', backgroundColor: COLORS.navy,
    paddingHorizontal: 20, paddingBottom: 20, gap: 0,
  },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '900', color: COLORS.gold },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.3 },

  activeTripCard: {
    marginHorizontal: 16, backgroundColor: COLORS.navy, borderRadius: 18, padding: 20,
    borderWidth: 2, borderColor: COLORS.success, gap: 8,
  },
  activePillRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.success + '22', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  activeBlip: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success },
  activePillText: { fontSize: 11, fontWeight: '800', color: COLORS.success, letterSpacing: 0.5 },
  activeTapHint: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  activeRoute: { fontSize: 20, fontWeight: '900', color: COLORS.white },
  activeMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  activeMetaText: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  activeMetaDot: { fontSize: 13, color: 'rgba(255,255,255,0.25)' },

  nextTripCard: {
    marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 16, padding: 18, gap: 6,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  nextTripTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nextTripLabel: {
    backgroundColor: COLORS.warning + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  nextTripLabelText: { fontSize: 10, fontWeight: '800', color: COLORS.warning, letterSpacing: 0.5 },
  nextTripTime: { fontSize: 22, fontWeight: '900', color: COLORS.navy },
  nextTripRoute: { fontSize: 16, fontWeight: '800', color: COLORS.navy },
  nextTripMeta: { fontSize: 13, color: COLORS.textSecondary },

  section: { paddingHorizontal: 16, gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  scheduleRow: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  scheduleRowActive: { borderColor: COLORS.success, borderWidth: 1.5 },
  scheduleTime: { width: 46 },
  scheduleTimeText: { fontSize: 15, fontWeight: '800', color: COLORS.navy },
  scheduleBar: { width: 3, height: 32, borderRadius: 2 },
  scheduleInfo: { flex: 1 },
  scheduleRoute: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  scheduleMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  scheduleBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  scheduleBadgeText: { fontSize: 10, fontWeight: '700' },

  noTripsCard: {
    marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 16, padding: 28,
    alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  noTripsIcon: { fontSize: 40, marginBottom: 4 },
  noTripsTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  noTripsBody: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  queueCta: {
    marginTop: 8, backgroundColor: COLORS.navy,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  queueCtaText: { fontSize: 14, fontWeight: '700', color: COLORS.white },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    width: '47%', backgroundColor: COLORS.white, borderRadius: 14,
    padding: 18, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  actionIcon: { fontSize: 28 },
  actionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
})
