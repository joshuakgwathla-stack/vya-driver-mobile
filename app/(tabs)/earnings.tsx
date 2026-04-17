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
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { load() }, [period])

  const load = async () => {
    try {
      const { data: res } = await driverApi.getEarnings()
      // Backend returns { summary, monthly, recent_trips } — map to period-based view
      const summary = res.data?.summary || {}
      const periodTotal =
        period === 'today' ? summary.today :
        period === 'week' ? summary.this_week :
        period === 'month' ? summary.this_month :
        summary.total_earnings
      setData({
        total_earnings: periodTotal || 0,
        trip_count: period === 'all' ? summary.total_trips : undefined,
        passenger_count: period === 'all' ? summary.total_bookings : undefined,
        trips: res.data?.recent_trips?.map((t: any) => ({
          ...t,
          earnings: t.trip_earnings,
          passenger_count: t.passengers,
        })) || [],
        monthly: res.data?.monthly || [],
      })
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  const onRefresh = () => { setRefreshing(true); load() }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      >
        <Text style={styles.pageTitle}>Earnings</Text>

        {/* Period tabs */}
        <View style={styles.tabs}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.tab, period === p.key && styles.tabActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.tabText, period === p.key && styles.tabTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.navy} />
          </View>
        ) : (
          <>
            {/* Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Earned</Text>
              <Text style={styles.summaryAmount}>R{Number(data?.total_earnings || 0).toFixed(2)}</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemValue}>{data?.trip_count || 0}</Text>
                  <Text style={styles.summaryItemLabel}>Trips</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemValue}>{data?.passenger_count || 0}</Text>
                  <Text style={styles.summaryItemLabel}>Passengers</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryItemValue}>
                    R{data?.trip_count ? (Number(data.total_earnings) / data.trip_count).toFixed(0) : '0'}
                  </Text>
                  <Text style={styles.summaryItemLabel}>Avg/Trip</Text>
                </View>
              </View>
            </View>

            {/* Per-trip breakdown */}
            {data?.trips?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Trip Breakdown</Text>
                {data.trips.map((t: any) => {
                  const dep = new Date(t.departure_time)
                  return (
                    <View key={t.id} style={styles.tripCard}>
                      <View style={styles.tripLeft}>
                        <Text style={styles.tripRoute}>{t.origin_city} → {t.destination_city}</Text>
                        <Text style={styles.tripDate}>
                          {dep.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                          {' · '}
                          {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </Text>
                        <Text style={styles.tripPax}>👥 {t.passenger_count || 0} passengers</Text>
                      </View>
                      <Text style={styles.tripEarnings}>R{Number(t.earnings || 0).toFixed(2)}</Text>
                    </View>
                  )
                })}
              </View>
            )}

            {(!data?.trips || data.trips.length === 0) && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>💰</Text>
                <Text style={styles.emptyText}>No earnings yet</Text>
                <Text style={styles.emptyHint}>Complete trips to see your earnings here</Text>
              </View>
            )}

            {/* Payout info */}
            <View style={styles.payoutCard}>
              <Text style={styles.payoutTitle}>Payouts</Text>
              <Text style={styles.payoutText}>
                Earnings are paid out weekly via EFT to your registered bank account. Contact support to update banking details.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: COLORS.navy, paddingTop: Platform.OS === 'android' ? 28 : 0 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },
  center: { paddingVertical: 40, alignItems: 'center' },
  summaryCard: {
    backgroundColor: COLORS.navy, borderRadius: 20, padding: 22, gap: 12,
  },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryAmount: { fontSize: 38, fontWeight: '900', color: COLORS.gold },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryItemValue: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  summaryItemLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  summaryDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.15)' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  tripCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.border,
  },
  tripLeft: { gap: 3, flex: 1 },
  tripRoute: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  tripDate: { fontSize: 12, color: COLORS.textSecondary },
  tripPax: { fontSize: 12, color: COLORS.textMuted },
  tripEarnings: { fontSize: 16, fontWeight: '800', color: COLORS.success },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  emptyHint: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  payoutCard: {
    backgroundColor: COLORS.warningLight, borderRadius: 14, padding: 16, gap: 8,
    borderWidth: 1, borderColor: COLORS.warning + '44',
  },
  payoutTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  payoutText: { fontSize: 13, color: '#78350f', lineHeight: 18 },
})
