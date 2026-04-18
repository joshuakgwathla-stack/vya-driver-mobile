import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ActivityIndicator, Platform, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { tripsApi } from '../../lib/api'
import { COLORS } from '../../constants'

const FILTERS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'in_progress', label: 'Active' },
  { key: 'completed', label: 'Done' },
  { key: 'all', label: 'All' },
] as const

type Filter = typeof FILTERS[number]['key']

function statusColor(s: string) {
  if (s === 'in_progress') return COLORS.success
  if (s === 'scheduled' || s === 'confirmed') return COLORS.warning
  return COLORS.textMuted
}

function statusLabel(s: string) {
  if (s === 'in_progress') return 'Active'
  if (s === 'scheduled') return 'Scheduled'
  if (s === 'confirmed') return 'Confirmed'
  if (s === 'completed') return 'Done'
  if (s === 'cancelled') return 'Cancelled'
  return s
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
    const sc = statusColor(t.status)
    const isActive = t.status === 'in_progress'
    const today = new Date().toISOString().split('T')[0]
    const depDay = dep.toISOString().split('T')[0]
    const isToday = depDay === today

    return (
      <TouchableOpacity
        style={[styles.card, isActive && styles.cardActive]}
        onPress={() => router.push(`/trip/${t.id}`)}
        activeOpacity={0.88}
      >
        <View style={styles.cardTop}>
          {/* Time + route */}
          <View style={styles.timeCol}>
            <Text style={[styles.depTime, isActive && { color: COLORS.gold }]}>
              {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </Text>
            <Text style={styles.depDay}>
              {isToday ? 'Today' : dep.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
          </View>
          <View style={[styles.statusBar, { backgroundColor: sc }]} />
          <View style={styles.routeCol}>
            <Text style={styles.origin}>{t.origin_city}</Text>
            <Text style={styles.routeArrow}>↓</Text>
            <Text style={styles.dest}>{t.destination_city}</Text>
          </View>
          <View style={styles.rightCol}>
            <View style={[styles.badge, { backgroundColor: sc + '22' }]}>
              <Text style={[styles.badgeText, { color: sc }]}>{statusLabel(t.status)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Text style={styles.footerValue}>{t.seats_sold || 0}</Text>
            <Text style={styles.footerLabel}>passengers</Text>
          </View>
          <View style={styles.footerDivider} />
          <View style={styles.footerItem}>
            <Text style={[styles.footerValue, { color: COLORS.success }]}>
              R{Number(t.driver_earnings || 0).toFixed(0)}
            </Text>
            <Text style={styles.footerLabel}>earnings</Text>
          </View>
          {isActive && (
            <>
              <View style={styles.footerDivider} />
              <View style={styles.footerItem}>
                <Text style={[styles.footerValue, { color: COLORS.success, fontSize: 12 }]}>● LIVE</Text>
                <Text style={styles.footerLabel}>tap to manage</Text>
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>My Trips</Text>
        <Text style={styles.pageSub}>Your scheduled and past trips</Text>
      </View>

      <View style={styles.filterBar}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.navy} size="large" />
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
              <Text style={styles.emptyTitle}>No trips</Text>
              <Text style={styles.emptyHint}>
                {filter === 'upcoming'
                  ? 'Join the queue to get your next trip assigned.'
                  : 'No trips in this category.'}
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
    backgroundColor: COLORS.navy,
    paddingHorizontal: 20, paddingBottom: 16,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
  },
  pageTitle: { fontSize: 24, fontWeight: '900', color: COLORS.white },
  pageSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  filterBar: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 22,
    backgroundColor: COLORS.offWhite, borderWidth: 1, borderColor: COLORS.border,
  },
  filterBtnActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.white, fontWeight: '700' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12, paddingBottom: 32 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardActive: { borderColor: COLORS.success, borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },

  timeCol: { width: 54 },
  depTime: { fontSize: 16, fontWeight: '900', color: COLORS.navy },
  depDay: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },

  statusBar: { width: 3, height: 44, borderRadius: 2 },

  routeCol: { flex: 1 },
  origin: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  routeArrow: { fontSize: 12, color: COLORS.textMuted, lineHeight: 16 },
  dest: { fontSize: 14, fontWeight: '700', color: COLORS.navy },

  rightCol: { alignItems: 'flex-end' },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  footerItem: { flex: 1, alignItems: 'center', gap: 1 },
  footerValue: { fontSize: 15, fontWeight: '800', color: COLORS.navy },
  footerLabel: { fontSize: 10, color: COLORS.textMuted },
  footerDivider: { width: 1, height: 24, backgroundColor: COLORS.border },

  empty: { alignItems: 'center', padding: 60, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.navy },
  emptyHint: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
})
