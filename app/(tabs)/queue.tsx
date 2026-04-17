import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform, Alert, RefreshControl,
} from 'react-native'
import { queueApi, routesApi, driverApi } from '../../lib/api'
import { COLORS, TIME_SLOTS } from '../../constants'

const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i)
  return d
})

function formatDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function labelDate(d: Date) {
  const today = new Date()
  const diff = Math.round((d.getTime() - today.setHours(0,0,0,0)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function QueueScreen() {
  const [routes, setRoutes] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [selectedRoute, setSelectedRoute] = useState<any>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState(DATES[0])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slotOccupancy, setSlotOccupancy] = useState<any[]>([])
  const [myQueue, setMyQueue] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadRoutes(); loadMyQueue(); loadVehicles() }, [])

  useEffect(() => {
    if (selectedRoute && selectedDate) loadOccupancy()
  }, [selectedRoute, selectedDate])

  const loadRoutes = async () => {
    try {
      const { data } = await routesApi.getAll()
      setRoutes(data.data || [])
      if (data.data?.length > 0) setSelectedRoute(data.data[0])
    } catch {}
  }

  const loadVehicles = async () => {
    try {
      const { data } = await driverApi.getVehicles()
      const veh = data.data || []
      setVehicles(veh)
      if (veh.length > 0) setSelectedVehicle(veh[0])
    } catch {}
  }

  const loadMyQueue = async () => {
    try {
      const { data } = await queueApi.getMyQueue()
      setMyQueue(data.data || [])
    } catch {}
    finally { setRefreshing(false) }
  }

  const loadOccupancy = async () => {
    if (!selectedRoute) return
    setLoading(true)
    try {
      const { data } = await queueApi.getSlotOccupancy({
        route_id: selectedRoute.id,
        date: formatDate(selectedDate),
      })
      setSlotOccupancy(data.data || [])
    } catch { setSlotOccupancy([]) }
    finally { setLoading(false) }
  }

  const handleJoin = async () => {
    if (!selectedRoute || !selectedSlot) {
      Alert.alert('Select a route, date and time slot first')
      return
    }
    if (!selectedVehicle) {
      Alert.alert('No Vehicle', 'You need a registered vehicle to join the queue. Please add one in your profile on the web platform.')
      return
    }
    setJoining(true)
    try {
      await queueApi.join({
        route_id: selectedRoute.id,
        vehicle_id: selectedVehicle.id,
        slot_date: formatDate(selectedDate),
        slot_time: selectedSlot,
      })
      Alert.alert('Queued!', 'You are now queued for this slot. A trip has been created.')
      await Promise.all([loadOccupancy(), loadMyQueue()])
      setSelectedSlot('')
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not join queue')
    } finally { setJoining(false) }
  }

  const handleLeave = async (tripId: string) => {
    Alert.alert('Cancel Trip', 'Remove yourself from this slot? The trip will be cancelled.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Trip', style: 'destructive', onPress: async () => {
          try {
            await queueApi.cancelTrip(tripId)
            await Promise.all([loadOccupancy(), loadMyQueue()])
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to cancel trip')
          }
        }
      }
    ])
  }

  const getSlotInfo = (slot: string) => slotOccupancy.find((s: any) => s.slot_time === slot) || {}
  const alreadyQueued = (slot: string) => myQueue.some(q =>
    q.origin_city === selectedRoute?.origin_city &&
    q.destination_city === selectedRoute?.destination_city &&
    formatDate(new Date(q.departure_time)) === formatDate(selectedDate) &&
    new Date(q.departure_time).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }) === slot
  )

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMyQueue() }} tintColor={COLORS.gold} />}
      >
        <Text style={styles.pageTitle}>Queue</Text>
        <Text style={styles.pageSubtitle}>Join a slot to get assigned a trip</Text>

        {/* Route picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Route</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {routes.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[styles.pill, selectedRoute?.id === r.id && styles.pillActive]}
                onPress={() => setSelectedRoute(r)}
              >
                <Text style={[styles.pillText, selectedRoute?.id === r.id && styles.pillTextActive]}>
                  {r.origin_city} → {r.destination_city}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Date picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {DATES.map(d => (
              <TouchableOpacity
                key={d.toISOString()}
                style={[styles.datePill, formatDate(d) === formatDate(selectedDate) && styles.datePillActive]}
                onPress={() => setSelectedDate(d)}
              >
                <Text style={[styles.datePillText, formatDate(d) === formatDate(selectedDate) && styles.datePillTextActive]}>
                  {labelDate(d)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Vehicle picker (if multiple) */}
        {vehicles.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Vehicle</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              {vehicles.map(v => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.pill, selectedVehicle?.id === v.id && styles.pillActive]}
                  onPress={() => setSelectedVehicle(v)}
                >
                  <Text style={[styles.pillText, selectedVehicle?.id === v.id && styles.pillTextActive]}>
                    {v.make} {v.model} · {v.registration_number}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {vehicles.length === 0 && (
          <View style={styles.noVehicleBanner}>
            <Text style={styles.noVehicleText}>⚠️ No vehicle registered. Add your vehicle on the web driver platform first.</Text>
          </View>
        )}

        {/* Time slot picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Time Slot</Text>
          {loading && <ActivityIndicator color={COLORS.navy} style={{ marginVertical: 4 }} />}
          <View style={styles.slotGrid}>
            {TIME_SLOTS.map(slot => {
              const info = getSlotInfo(slot)
              const queued = alreadyQueued(slot)
              return (
                <TouchableOpacity
                  key={slot}
                  style={[styles.slotBtn, selectedSlot === slot && styles.slotBtnActive, queued && styles.slotBtnQueued]}
                  onPress={() => setSelectedSlot(slot)}
                >
                  <Text style={[styles.slotText, selectedSlot === slot && styles.slotTextActive]}>{slot}</Text>
                  {info.passengers_waiting > 0 && (
                    <Text style={styles.slotPax}>👥 {info.passengers_waiting}</Text>
                  )}
                  {queued && <Text style={styles.slotQueued}>✓</Text>}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Join button */}
        {selectedSlot && !alreadyQueued(selectedSlot) && vehicles.length > 0 && (
          <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} disabled={joining}>
            {joining
              ? <ActivityIndicator color={COLORS.navy} />
              : <Text style={styles.joinBtnText}>Queue for {selectedSlot} →</Text>
            }
          </TouchableOpacity>
        )}

        {selectedSlot && alreadyQueued(selectedSlot) && (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>You're queued for this slot</Text>
            <Text style={styles.statusSub}>Check "My Upcoming Trips" below to manage it</Text>
          </View>
        )}

        {/* My upcoming queued trips */}
        {myQueue.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>My Upcoming Trips</Text>
            {myQueue.map((q: any) => {
              const dep = new Date(q.departure_time)
              return (
                <View key={q.trip_id} style={styles.myQueueCard}>
                  <View style={styles.myQueueInfo}>
                    <Text style={styles.myQueueRoute}>{q.origin_city} → {q.destination_city}</Text>
                    <Text style={styles.myQueueMeta}>
                      {dep.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {' · '}
                      {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                    <Text style={styles.assignedSmall}>✓ Trip created · {q.seats_booked || 0} booked</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.leaveBtn}
                    onPress={() => handleLeave(q.trip_id)}
                  >
                    <Text style={styles.leaveBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: COLORS.navy, paddingTop: Platform.OS === 'android' ? 28 : 0 },
  pageSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: -8 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  pillRow: { flexDirection: 'row' },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, marginRight: 8,
  },
  pillActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  pillText: { fontSize: 13, color: COLORS.text },
  pillTextActive: { color: COLORS.white, fontWeight: '700' },
  datePill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, marginRight: 8,
  },
  datePillActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  datePillText: { fontSize: 13, color: COLORS.text },
  datePillTextActive: { color: COLORS.navy, fontWeight: '700' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  slotBtnActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  slotText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  slotTextActive: { color: COLORS.white },
  statusCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 18, gap: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statusTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  statusSub: { fontSize: 13, color: COLORS.textSecondary },
  assignedBadge: {
    backgroundColor: COLORS.successLight, borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4,
  },
  assignedText: { fontSize: 12, fontWeight: '700', color: COLORS.success },
  joinBtn: {
    backgroundColor: COLORS.gold, borderRadius: 14, padding: 16, alignItems: 'center',
  },
  joinBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  myQueueCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.border,
  },
  myQueueInfo: { gap: 2, flex: 1 },
  myQueueRoute: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  myQueueMeta: { fontSize: 12, color: COLORS.textSecondary },
  assignedSmall: { fontSize: 11, color: COLORS.success, fontWeight: '600' },
  noVehicleBanner: {
    backgroundColor: COLORS.warningLight, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.warning + '44',
  },
  noVehicleText: { fontSize: 13, color: '#92400e', lineHeight: 18 },
  slotBtnQueued: { borderColor: COLORS.success, borderWidth: 2 },
  slotPax: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center' },
  slotQueued: { fontSize: 10, color: COLORS.success, fontWeight: '700', textAlign: 'center' },
  leaveBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: '#fca5a5',
  },
  leaveBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.danger },
})
