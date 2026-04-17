import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { driverApi, tripsApi } from '../../lib/api'
import { COLORS } from '../../constants'

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
      const today = new Date().toISOString().split('T')[0]
      const [profRes, tripsRes, earningsRes] = await Promise.allSettled([
        driverApi.getProfile(),
        tripsApi.getMyTrips({ limit: 10 }),
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
        setEarnings({ total: summary.today || 0 })
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  const onRefresh = () => { setRefreshing(true); loadAll() }

  const activeTrip = todayTrips.find(t => t.status === 'in_progress')
  const nextTrip = todayTrips.find(t => t.status === 'scheduled' || t.status === 'confirmed')

  const statusColor = (s: string) => {
    if (s === 'in_progress') return COLORS.success
    if (s === 'scheduled' || s === 'confirmed') return COLORS.warning
    if (s === 'completed') return COLORS.textMuted
    return COLORS.textMuted
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
            <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
          </View>
          <View style={[
            styles.statusDot,
            { backgroundColor: profile?.status === 'approved' ? COLORS.success : COLORS.warning }
          ]} />
        </View>

        {/* Account status banner */}
        {profile && profile.status !== 'approved' && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {profile.status === 'pending'
                ? '⏳ Your account is pending approval. You can set up your profile while you wait.'
                : profile.status === 'suspended'
                ? '⚠️ Your account is suspended. Check your documents in Profile → Documents.'
                : '❌ Account rejected. Contact support for details.'}
            </Text>
          </View>
        )}

        {/* Today stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              R{Number(earnings?.total || 0).toFixed(0)}
            </Text>
            <Text style={styles.statLabel}>Today's Earnings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{todayTrips.filter(t => t.status === 'completed').length}</Text>
            <Text style={styles.statLabel}>Trips Done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{todayTrips.filter(t => ['scheduled','confirmed'].includes(t.status)).length}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
        </View>

        {/* Active trip */}
        {activeTrip && (
          <TouchableOpacity style={styles.activeCard} onPress={() => router.push(`/trip/${activeTrip.id}`)}>
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>● IN PROGRESS</Text>
            </View>
            <Text style={styles.activeRoute}>
              {activeTrip.origin_city} → {activeTrip.destination_city}
            </Text>
            <Text style={styles.activeMeta}>
              {activeTrip.booked_seats} passengers · Tap to manage
            </Text>
          </TouchableOpacity>
        )}

        {/* Next trip */}
        {!activeTrip && nextTrip && (
          <TouchableOpacity style={styles.nextCard} onPress={() => router.push(`/trip/${nextTrip.id}`)}>
            <Text style={styles.nextLabel}>Next trip</Text>
            <Text style={styles.nextRoute}>
              {nextTrip.origin_city} → {nextTrip.destination_city}
            </Text>
            <Text style={styles.nextTime}>
              {new Date(nextTrip.departure_time).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
              {' · '}
              {nextTrip.booked_seats || 0} passengers booked
            </Text>
          </TouchableOpacity>
        )}

        {/* Today's trips list */}
        {todayTrips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Trips</Text>
            {todayTrips.map(t => (
              <TouchableOpacity key={t.id} style={styles.tripRow} onPress={() => router.push(`/trip/${t.id}`)}>
                <View style={styles.tripLeft}>
                  <Text style={styles.tripRoute}>{t.origin_city} → {t.destination_city}</Text>
                  <Text style={styles.tripTime}>
                    {new Date(t.departure_time).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    {' · '}{t.seats_sold || 0} pax
                  </Text>
                </View>
                <View style={[styles.tripStatus, { backgroundColor: statusColor(t.status) + '22' }]}>
                  <Text style={[styles.tripStatusText, { color: statusColor(t.status) }]}>
                    {t.status.replace('_', ' ')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/queue')}>
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionLabel}>Join Queue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/trips')}>
              <Text style={styles.actionIcon}>🚗</Text>
              <Text style={styles.actionLabel}>My Trips</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/earnings')}>
              <Text style={styles.actionIcon}>💰</Text>
              <Text style={styles.actionLabel}>Earnings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/profile')}>
              <Text style={styles.actionIcon}>📄</Text>
              <Text style={styles.actionLabel}>Documents</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 28 : 0,
  },
  greeting: { fontSize: 14, color: COLORS.textSecondary },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.navy },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  banner: {
    backgroundColor: COLORS.warningLight, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.warning + '44',
  },
  bannerText: { fontSize: 13, color: '#92400e', lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: COLORS.navy, borderRadius: 14,
    padding: 14, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.gold },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  activeCard: {
    backgroundColor: COLORS.navy, borderRadius: 16, padding: 18,
    borderWidth: 2, borderColor: COLORS.success, gap: 6,
  },
  activePill: {
    backgroundColor: COLORS.success + '22', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
  },
  activePillText: { fontSize: 11, fontWeight: '700', color: COLORS.success, letterSpacing: 0.5 },
  activeRoute: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  activeMeta: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  nextCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 18, gap: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  nextLabel: { fontSize: 11, fontWeight: '700', color: COLORS.warning, textTransform: 'uppercase', letterSpacing: 0.5 },
  nextRoute: { fontSize: 17, fontWeight: '800', color: COLORS.navy },
  nextTime: { fontSize: 13, color: COLORS.textSecondary },
  section: { gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  tripRow: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.border,
  },
  tripLeft: { gap: 2 },
  tripRoute: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  tripTime: { fontSize: 12, color: COLORS.textSecondary },
  tripStatus: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tripStatusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    width: '47%', backgroundColor: COLORS.white, borderRadius: 14,
    padding: 16, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  actionIcon: { fontSize: 26 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.navy },
})
