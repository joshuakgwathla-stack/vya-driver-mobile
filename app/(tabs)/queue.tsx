import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform, Alert, RefreshControl, Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import { queueApi, routesApi, driverApi } from '../../lib/api'
import { COLORS, TIME_SLOTS } from '../../constants'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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
  const diff = Math.round((d.getTime() - today.setHours(0, 0, 0, 0)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function QueueScreen() {
  const router = useRouter()
  const [routes, setRoutes] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [selectedRoute, setSelectedRoute] = useState<any>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState(DATES[0])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slotOccupancy, setSlotOccupancy] = useState<any[]>([])
  const [myQueue, setMyQueue] = useState<any[]>([])
  const [loadingOccupancy, setLoadingOccupancy] = useState(false)
  const [joining, setJoining] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Standing orders state
  const [recurringSlots, setRecurringSlots] = useState<any[]>([])
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [recurringRoute, setRecurringRoute] = useState<any>(null)
  const [recurringVehicle, setRecurringVehicle] = useState<any>(null)
  const [recurringDay, setRecurringDay] = useState<number>(1) // Mon default
  const [recurringTime, setRecurringTime] = useState('')
  const [savingRecurring, setSavingRecurring] = useState(false)

  useEffect(() => { loadRoutes(); loadMyQueue(); loadVehicles(); loadRecurring() }, [])

  useEffect(() => {
    if (selectedRoute && selectedDate) loadOccupancy()
  }, [selectedRoute, selectedDate])

  const loadRoutes = async () => {
    try {
      const { data } = await routesApi.getAll()
      setRoutes(data.data || [])
      if (data.data?.length > 0) {
        setSelectedRoute(data.data[0])
        setRecurringRoute(data.data[0])
      }
    } catch {}
  }

  const loadVehicles = async () => {
    try {
      const { data } = await driverApi.getVehicles()
      const veh = data.data || []
      setVehicles(veh)
      if (veh.length > 0) {
        setSelectedVehicle(veh[0])
        setRecurringVehicle(veh[0])
      }
    } catch {}
  }

  const loadRecurring = async () => {
    try {
      const { data } = await queueApi.getMyRecurring()
      setRecurringSlots(data.data || [])
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
    setLoadingOccupancy(true)
    try {
      const { data } = await queueApi.getSlotOccupancy({
        route_id: selectedRoute.id,
        date: formatDate(selectedDate),
      })
      setSlotOccupancy(data.data || [])
    } catch { setSlotOccupancy([]) }
    finally { setLoadingOccupancy(false) }
  }

  const handleJoin = async () => {
    if (!selectedRoute || !selectedSlot) {
      Alert.alert('Select a slot', 'Choose a route, date, and time slot first.')
      return
    }
    if (!selectedVehicle) {
      Alert.alert('No vehicle', 'Add a vehicle on the web driver platform first.')
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
      Alert.alert('Queued!', `You're set for ${selectedRoute.origin_city} → ${selectedRoute.destination_city} at ${selectedSlot}.`)
      await Promise.all([loadOccupancy(), loadMyQueue()])
      setSelectedSlot('')
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not join queue')
    } finally { setJoining(false) }
  }

  const handleSaveRecurring = async () => {
    if (!recurringRoute || !recurringVehicle || !recurringTime) {
      Alert.alert('Incomplete', 'Select a route, vehicle, day and time slot.')
      return
    }
    setSavingRecurring(true)
    try {
      await queueApi.createRecurring({
        route_id: recurringRoute.id,
        vehicle_id: recurringVehicle.id,
        day_of_week: recurringDay,
        slot_time: recurringTime,
        weeks_ahead: 4,
      })
      await loadRecurring()
      setShowRecurringModal(false)
      setRecurringTime('')
      Alert.alert('Standing order set!', `Every ${DAY_FULL[recurringDay]} at ${recurringTime} on ${recurringRoute.origin_city} → ${recurringRoute.destination_city} has been reserved for the next 4 weeks.`)
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not create standing reservation')
    } finally {
      setSavingRecurring(false)
    }
  }

  const handleDeleteRecurring = (id: string, label: string) => {
    Alert.alert('Cancel Standing Order', `Stop auto-queuing for ${label}?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Order', style: 'destructive', onPress: async () => {
          try {
            await queueApi.deleteRecurring(id)
            await loadRecurring()
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to cancel')
          }
        }
      }
    ])
  }

  const handleLeave = async (tripId: string) => {
    Alert.alert('Cancel Trip', 'Remove yourself from this slot?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel', style: 'destructive', onPress: async () => {
          try {
            await queueApi.cancelTrip(tripId)
            await Promise.all([loadOccupancy(), loadMyQueue()])
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to cancel')
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

  // A slot is closed if departure is within 2 hours from now
  const slotIsClosed = (slot: string) => {
    const [h, m] = slot.split(':').map(Number)
    const dep = new Date(selectedDate)
    dep.setHours(h, m, 0, 0)
    return (dep.getTime() - Date.now()) < 2 * 60 * 60 * 1000
  }

  const canJoin = selectedSlot && !alreadyQueued(selectedSlot) && !slotIsClosed(selectedSlot) && vehicles.length > 0
  const slotIsQueued = selectedSlot && alreadyQueued(selectedSlot)

  return (
    <SafeAreaView style={styles.safe}>
      {/* Navy header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Join Queue</Text>
          <Text style={styles.headerSub}>Select a slot to get assigned passengers</Text>
        </View>
        <TouchableOpacity
          style={styles.requestRouteBtn}
          onPress={() => router.push('/route-request')}
          activeOpacity={0.85}
        >
          <Text style={styles.requestRouteBtnText}>+ Request Route</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, (canJoin || slotIsQueued) && { paddingBottom: 110 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMyQueue() }} tintColor={COLORS.gold} />}
        showsVerticalScrollIndicator={false}
      >
        {vehicles.length === 0 && (
          <View style={styles.noVehicleBanner}>
            <Text style={styles.noVehicleIcon}>🚗</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.noVehicleTitle}>No vehicle registered</Text>
              <Text style={styles.noVehicleText}>Go to Profile → Documents to add your vehicle before joining the queue.</Text>
            </View>
          </View>
        )}

        {/* Route selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Route</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.pillRow}>
              {routes.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.pill, selectedRoute?.id === r.id && styles.pillActive]}
                  onPress={() => { setSelectedRoute(r); setSelectedSlot('') }}
                >
                  <Text style={[styles.pillText, selectedRoute?.id === r.id && styles.pillTextActive]}>
                    {r.origin_city} → {r.destination_city}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Date selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.pillRow}>
              {DATES.map(d => {
                const active = formatDate(d) === formatDate(selectedDate)
                return (
                  <TouchableOpacity
                    key={d.toISOString()}
                    style={[styles.datePill, active && styles.datePillActive]}
                    onPress={() => { setSelectedDate(d); setSelectedSlot('') }}
                  >
                    <Text style={[styles.datePillText, active && styles.datePillTextActive]}>
                      {labelDate(d)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>
        </View>

        {/* Vehicle selector (if multiple) */}
        {vehicles.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Vehicle</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.pillRow}>
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
              </View>
            </ScrollView>
          </View>
        )}

        {/* Time slot grid */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>Time Slot</Text>
            {loadingOccupancy && <ActivityIndicator color={COLORS.navy} size="small" />}
          </View>
          <Text style={styles.slotHint}>Queue open anytime · closes 2 hours before departure · 🟡 = passengers waiting</Text>
          <View style={styles.slotGrid}>
            {TIME_SLOTS.map(slot => {
              const info = getSlotInfo(slot)
              const isSelected = selectedSlot === slot
              const isQueued = alreadyQueued(slot)
              const isClosed = slotIsClosed(slot)
              const paxWaiting = info.passengers_waiting || 0
              return (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.slotBtn,
                    isSelected && styles.slotBtnSelected,
                    isQueued && styles.slotBtnQueued,
                    isClosed && styles.slotBtnClosed,
                  ]}
                  onPress={() => !isClosed && setSelectedSlot(isSelected ? '' : slot)}
                  activeOpacity={isClosed ? 1 : 0.8}
                >
                  <Text style={[styles.slotTime, isSelected && styles.slotTimeSelected, isClosed && styles.slotTimeClosed]}>
                    {slot}
                  </Text>
                  {isClosed && <Text style={styles.closedLabel}>Closed</Text>}
                  {!isClosed && paxWaiting > 0 && (
                    <View style={styles.paxBadge}>
                      <Text style={styles.paxBadgeText}>{paxWaiting} waiting</Text>
                    </View>
                  )}
                  {isQueued && (
                    <View style={styles.queuedBadge}>
                      <Text style={styles.queuedBadgeText}>✓ Queued</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Standing Orders section */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>Standing Orders</Text>
            <TouchableOpacity style={styles.addRecurringBtn} onPress={() => setShowRecurringModal(true)}>
              <Text style={styles.addRecurringBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {recurringSlots.length === 0 ? (
            <View style={styles.recurringEmpty}>
              <Text style={styles.recurringEmptyText}>No standing orders yet. Add one to auto-queue every week.</Text>
            </View>
          ) : (
            recurringSlots.map((rs: any) => (
              <View key={rs.id} style={styles.recurringCard}>
                <View style={styles.recurringLeft}>
                  <Text style={styles.recurringDay}>{DAY_FULL[rs.day_of_week]}</Text>
                  <Text style={styles.recurringTime}>{rs.slot_time}</Text>
                </View>
                <View style={styles.recurringDivider} />
                <View style={styles.recurringInfo}>
                  <Text style={styles.recurringRoute}>{rs.origin_city} → {rs.destination_city}</Text>
                  <Text style={styles.recurringMeta}>{rs.make} {rs.model} · {rs.weeks_ahead}wk rolling</Text>
                </View>
                <TouchableOpacity
                  style={styles.recurringDeleteBtn}
                  onPress={() => handleDeleteRecurring(rs.id, `${DAY_FULL[rs.day_of_week]} ${rs.slot_time}`)}
                >
                  <Text style={styles.recurringDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* My upcoming queued trips */}
        {myQueue.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>My Upcoming Trips</Text>
            {myQueue.map((q: any) => {
              const dep = new Date(q.departure_time)
              return (
                <View key={q.trip_id} style={styles.myQueueCard}>
                  <View style={styles.myQueueLeft}>
                    <Text style={styles.myQueueTime}>
                      {dep.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                    <Text style={styles.myQueueDay}>
                      {dep.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <View style={styles.myQueueDivider} />
                  <View style={styles.myQueueInfo}>
                    <Text style={styles.myQueueRoute}>{q.origin_city} → {q.destination_city}</Text>
                    <Text style={styles.myQueueMeta}>{q.seats_booked || 0} booked</Text>
                  </View>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => handleLeave(q.trip_id)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* Sticky join bar */}
      {canJoin && (
        <View style={styles.joinBar}>
          <View style={styles.joinBarLeft}>
            <Text style={styles.joinBarRoute}>
              {selectedRoute?.origin_city} → {selectedRoute?.destination_city}
            </Text>
            <Text style={styles.joinBarSlot}>{labelDate(selectedDate)} · {selectedSlot}</Text>
          </View>
          <TouchableOpacity
            style={[styles.joinBtn, joining && { opacity: 0.7 }]}
            onPress={handleJoin}
            disabled={joining}
            activeOpacity={0.85}
          >
            {joining
              ? <ActivityIndicator color={COLORS.navy} />
              : <Text style={styles.joinBtnText}>Join Queue →</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {slotIsQueued && (
        <View style={styles.alreadyQueuedBar}>
          <Text style={styles.alreadyQueuedText}>✓ You're already queued for this slot</Text>
        </View>
      )}

      {/* Standing order creation modal */}
      <Modal visible={showRecurringModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowRecurringModal(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Standing Order</Text>
            <TouchableOpacity onPress={() => setShowRecurringModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalHint}>
              A standing order auto-queues you on this route every week — no manual re-queuing needed.
            </Text>

            {/* Route */}
            <Text style={styles.modalLabel}>Route</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.pillRow}>
                {routes.map(r => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.pill, recurringRoute?.id === r.id && styles.pillActive]}
                    onPress={() => setRecurringRoute(r)}
                  >
                    <Text style={[styles.pillText, recurringRoute?.id === r.id && styles.pillTextActive]}>
                      {r.origin_city} → {r.destination_city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Vehicle (if multiple) */}
            {vehicles.length > 1 && (
              <>
                <Text style={[styles.modalLabel, { marginTop: 16 }]}>Vehicle</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.pillRow}>
                    {vehicles.map(v => (
                      <TouchableOpacity
                        key={v.id}
                        style={[styles.pill, recurringVehicle?.id === v.id && styles.pillActive]}
                        onPress={() => setRecurringVehicle(v)}
                      >
                        <Text style={[styles.pillText, recurringVehicle?.id === v.id && styles.pillTextActive]}>
                          {v.make} {v.model} · {v.registration_number}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {/* Day of week */}
            <Text style={[styles.modalLabel, { marginTop: 16 }]}>Day of week</Text>
            <View style={styles.dayRow}>
              {DAYS.map((d, i) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayBtn, recurringDay === i && styles.dayBtnActive]}
                  onPress={() => setRecurringDay(i)}
                >
                  <Text style={[styles.dayBtnText, recurringDay === i && styles.dayBtnTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Time slot */}
            <Text style={[styles.modalLabel, { marginTop: 16 }]}>Time slot</Text>
            <View style={styles.slotGrid}>
              {TIME_SLOTS.map(slot => (
                <TouchableOpacity
                  key={slot}
                  style={[styles.slotBtn, recurringTime === slot && styles.slotBtnSelected]}
                  onPress={() => setRecurringTime(slot === recurringTime ? '' : slot)}
                >
                  <Text style={[styles.slotTime, recurringTime === slot && styles.slotTimeSelected]}>{slot}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveRecurringBtn, (!recurringRoute || !recurringTime || savingRecurring) && { opacity: 0.5 }]}
              onPress={handleSaveRecurring}
              disabled={!recurringRoute || !recurringTime || savingRecurring}
              activeOpacity={0.85}
            >
              {savingRecurring
                ? <ActivityIndicator color={COLORS.navy} />
                : <Text style={styles.saveRecurringBtnText}>Save Standing Order</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.offWhite },

  header: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 20, paddingBottom: 20,
    paddingTop: Platform.OS === 'android' ? 48 : 20,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  requestRouteBtn: {
    backgroundColor: COLORS.gold, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  requestRouteBtnText: { fontSize: 12, fontWeight: '800', color: COLORS.navy },

  scroll: { padding: 16, gap: 20, paddingBottom: 40 },

  noVehicleBanner: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: COLORS.warningLight, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.warning + '55',
  },
  noVehicleIcon: { fontSize: 24 },
  noVehicleTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  noVehicleText: { fontSize: 13, color: '#78350f', lineHeight: 18, marginTop: 2 },

  section: { gap: 10 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  slotHint: { fontSize: 12, color: COLORS.textMuted },

  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  pillActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  pillText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  pillTextActive: { color: COLORS.white, fontWeight: '700' },

  datePill: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  datePillActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  datePillText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  datePillTextActive: { color: COLORS.navy, fontWeight: '800' },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotBtn: {
    width: '30%', paddingVertical: 14, paddingHorizontal: 8, borderRadius: 14,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', gap: 6,
  },
  slotBtnSelected: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  slotBtnQueued: { borderColor: COLORS.success, borderWidth: 2 },
  slotBtnClosed: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', opacity: 0.6 },
  slotTime: { fontSize: 15, fontWeight: '800', color: COLORS.navy },
  slotTimeSelected: { color: COLORS.white },
  slotTimeClosed: { color: COLORS.textMuted },
  closedLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  paxBadge: {
    backgroundColor: COLORS.gold, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  paxBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.navy },
  queuedBadge: {
    backgroundColor: COLORS.success + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  queuedBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.success },

  myQueueCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  myQueueLeft: { alignItems: 'center', width: 52 },
  myQueueTime: { fontSize: 16, fontWeight: '900', color: COLORS.navy },
  myQueueDay: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginTop: 1 },
  myQueueDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
  myQueueInfo: { flex: 1 },
  myQueueRoute: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  myQueueMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cancelBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: '#fca5a5',
  },
  cancelBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.danger },

  joinBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 16,
  },
  joinBarLeft: { flex: 1 },
  joinBarRoute: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  joinBarSlot: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  joinBtn: {
    backgroundColor: COLORS.gold, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  joinBtnText: { color: COLORS.navy, fontWeight: '800', fontSize: 14 },

  alreadyQueuedBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.successLight,
    borderTopWidth: 1, borderTopColor: COLORS.success + '55',
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 18,
    alignItems: 'center',
  },
  alreadyQueuedText: { fontSize: 14, fontWeight: '700', color: COLORS.success },

  // Standing Orders
  addRecurringBtn: {
    backgroundColor: COLORS.navy, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  addRecurringBtnText: { fontSize: 11, fontWeight: '800', color: COLORS.white },
  recurringEmpty: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  recurringEmptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  recurringCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  recurringLeft: { alignItems: 'center', width: 58 },
  recurringDay: { fontSize: 12, fontWeight: '800', color: COLORS.navy, textAlign: 'center' },
  recurringTime: { fontSize: 16, fontWeight: '900', color: COLORS.gold, marginTop: 2 },
  recurringDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
  recurringInfo: { flex: 1 },
  recurringRoute: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  recurringMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  recurringDeleteBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: COLORS.dangerLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#fca5a5',
  },
  recurringDeleteText: { fontSize: 12, fontWeight: '800', color: COLORS.danger },

  // Modal
  modalSafe: { flex: 1, backgroundColor: COLORS.offWhite },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: COLORS.navy },
  modalClose: { fontSize: 18, color: COLORS.textMuted, fontWeight: '600', paddingHorizontal: 4 },
  modalScroll: { padding: 20, gap: 4, paddingBottom: 40 },
  modalHint: {
    fontSize: 13, color: COLORS.textSecondary, lineHeight: 19,
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 12,
  },
  modalLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  dayRow: { flexDirection: 'row', gap: 6 },
  dayBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  dayBtnActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  dayBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  dayBtnTextActive: { color: COLORS.white },
  saveRecurringBtn: {
    backgroundColor: COLORS.gold, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 24,
  },
  saveRecurringBtnText: { fontSize: 15, fontWeight: '900', color: COLORS.navy },
})
