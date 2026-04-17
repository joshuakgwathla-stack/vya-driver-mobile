import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ActivityIndicator, Platform, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { tripsApi } from '../../lib/api'
import { COLORS } from '../../constants'

const FILTERS = ['upcoming', 'in_progress', 'completed', 'all'] as const
type Filter = typeof FILTERS[number]

function statusColor(s: string) {
  if (s === 'in_progress') return COLORS.success
  if (s === 'scheduled' || s === 'confirmed') return COLORS.warning
  if (s === 'completed') return COLORS.textMuted
  return COLORS.textMuted
}

export default function TripsScreen() {
  const router = useRouter()
  const [trips, setTrips] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { load() }, [filter])

  const load = async () => {
    try {
      const params: any = { limit: 30 }
      if (filter === 'upcoming') params.status = 'scheduled,confirmed'
      else if (filter === 'in_progress') params.status = 'in_progress'
      else if (filter === 'completed') params.status = 'completed'
      const { data } = await tripsApi.getMyTrips(params)
      setTrips(data.data || [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  const onRefresh = () => { setRefreshing(true); load() }

  const renderTrip = ({ item: t }: { item: any }) => {
    const dep = new Date(t.departure_time)
    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/trip/${t.id}`)}>
        <View style={styles.cardTop}>
          <View style={styles.routeBlock}>
            <Text style={styles.route}>{t.origin_city} → {t.destination_city}</Text>
            <Text style={styles.meta}>
              {dep.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
              {' · '}
              {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor(t.status) + '22' }]}>
            <Text style={[styles.badgeText, { color: statusColor(t.status) }]}>
              {t.status.replace('_', ' ')}
            </Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.pax}>👥 {t.seats_sold || 0} passenger{t.seats_sold !== 1 ? 's' : ''}</Text>
          <Text style={styles.earnings}>R{Number(t.driver_earnings || 0).toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Trips</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.tabs}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.tab, filter === f && styles.tabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>
              {f === 'upcoming' ? 'Upcoming' : f === 'in_progress' ? 'Active' : f === 'completed' ? 'Done' : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.navy} />
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={t => t.id}
          renderItem={renderTrip}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🚗</Text>
              <Text style={styles.emptyText}>No trips found</Text>
              <Text style={styles.emptyHint}>
                {filter === 'upcoming' ? 'Join the queue to get your next trip assigned' : 'No trips in this category'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 44 : 16,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pageTitle: { fontSize: 22, fontWeight: '800', color: COLORS.navy },
  tabs: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    paddingHorizontal: 16, paddingBottom: 12, gap: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.offWhite, borderWidth: 1, borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    gap: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  routeBlock: { gap: 3, flex: 1 },
  route: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  meta: { fontSize: 13, color: COLORS.textSecondary },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pax: { fontSize: 13, color: COLORS.textSecondary },
  earnings: { fontSize: 15, fontWeight: '700', color: COLORS.success },
  empty: { alignItems: 'center', padding: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  emptyHint: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
})
