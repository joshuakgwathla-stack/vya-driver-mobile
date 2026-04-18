import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform, RefreshControl,
} from 'react-native'
import { driverApi } from '../../lib/api'
import { COLORS } from '../../constants'

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
] as const

type Period = typeof PERIODS[number]['key']

export default function EarningsScreen() {
  const [period, setPeriod] = useState<Period>('week')
  const [rawData, setRawData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const { data: res } = await driverApi.getEarnings()
      setRawData(res.data || {})
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  const onRefresh = () => { setRefreshing(true); load() }

  const summary = rawData?.summary || {}
  const recentTrips = (rawData?.recent_trips || []).map((t: any) => ({
    ...t,
    earnings: t.trip_earnings,
    passenger_count: t.passengers,
  }))

  const periodTotal = (() => {
    if (period === 'today') return summary.today || 0
    if (period === 'week') return summary.this_week || 0
    if (period === 'month') return summary.this_month || 0
    return summary.total_earnings || 0
  })()

  const totalTrips = summary.total_trips || 0
  const totalPassengers = summary.total_bookings || 0
  const avgPerTrip = totalTrips > 0
    ? (Number(summary.total_earnings || 0) / totalTrips).toFixed(0)
    : '0'

  return (
    <SafeAreaView style={styles.safe}>
      {/* Navy header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Earnings</Text>
        <Text style={styles.headerSub}>Your income breakdown</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Period pills */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.navy} size="large" />
          </View>
        ) : (
          <>
            {/* Hero earnings card */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>
                {period === 'today' ? 'Earned Today' :
                 period === 'week' ? 'Earned This Week' :
                 period === 'month' ? 'Earned This Month' : 'Total Earned'}
              </Text>
              <Text style={styles.heroAmount}>
                R{Number(periodTotal).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>

              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{totalTrips}</Text>
                  <Text style={styles.heroStatLabel}>Trips</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{totalPassengers}</Text>
                  <Text style={styles.heroStatLabel}>Passengers</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>R{avgPerTrip}</Text>
                  <Text style={styles.heroStatLabel}>Avg / Trip</Text>
                </View>
              </View>
            </View>

            {/* Payout info strip */}
            <View style={styles.payoutStrip}>
              <Text style={styles.payoutIcon}>🏦</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.payoutTitle}>Weekly EFT Payouts</Text>
                <Text style={styles.payoutBody}>Paid to your registered bank account every week. Contact support to update banking details.</Text>
              </View>
            </View>

            {/* Recent trip breakdown */}
            {recentTrips.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Trips</Text>
                {recentTrips.map((t: any) => {
                  const dep = new Date(t.departure_time)
                  const today = new Date().toISOString().split('T')[0]
                  const isToday = dep.toISOString().split('T')[0] === today
                  return (
                    <View key={t.id} style={styles.tripRow}>
                      <View style={styles.tripTimeCol}>
                        <Text style={styles.tripTime}>
                          {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </Text>
                        <Text style={styles.tripDay}>
                          {isToday ? 'Today' : dep.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                      <View style={styles.tripDivider} />
                      <View style={styles.tripInfo}>
                        <Text style={styles.tripRoute}>{t.origin_city} → {t.destination_city}</Text>
                        <Text style={styles.tripPax}>👥 {t.passenger_count || 0} passengers</Text>
                      </View>
                      <Text style={styles.tripEarnings}>
                        R{Number(t.earnings || 0).toFixed(0)}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}

            {recentTrips.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>💰</Text>
                <Text style={styles.emptyTitle}>No earnings yet</Text>
                <Text style={styles.emptyText}>Complete trips to see your earnings here</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },

  header: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 20, paddingBottom: 20,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  scroll: { padding: 16, gap: 16, paddingBottom: 40 },

  periodRow: { flexDirection: 'row', gap: 8 },
  periodBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 22, alignItems: 'center',
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  periodBtnActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  periodText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  periodTextActive: { color: COLORS.white, fontWeight: '700' },

  center: { paddingVertical: 60, alignItems: 'center' },

  heroCard: {
    backgroundColor: COLORS.navy, borderRadius: 20, padding: 22, gap: 14,
  },
  heroLabel: {
    fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  heroAmount: { fontSize: 40, fontWeight: '900', color: COLORS.gold, letterSpacing: -1 },
  heroStats: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 14 },
  heroStat: { flex: 1, alignItems: 'center', gap: 3 },
  heroStatValue: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)' },
  heroStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },

  payoutStrip: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: COLORS.warningLight, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.warning + '55',
  },
  payoutIcon: { fontSize: 22 },
  payoutTitle: { fontSize: 13, fontWeight: '700', color: '#92400e' },
  payoutBody: { fontSize: 12, color: '#78350f', lineHeight: 18, marginTop: 2 },

  section: { gap: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  tripRow: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tripTimeCol: { alignItems: 'center', width: 46 },
  tripTime: { fontSize: 14, fontWeight: '900', color: COLORS.navy },
  tripDay: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  tripDivider: { width: 1, height: 32, backgroundColor: COLORS.border },
  tripInfo: { flex: 1 },
  tripRoute: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  tripPax: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  tripEarnings: { fontSize: 17, fontWeight: '900', color: COLORS.success },

  empty: { alignItems: 'center', padding: 50, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.navy },
  emptyText: { fontSize: 13, color: COLORS.textSecondary },
})
