import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, ClipboardList, Car, Wallet, User, Ticket } from 'lucide-react-native'
import { COLORS } from '../../constants'

export default function TabsLayout() {
  // app.json has edgeToEdgeEnabled: true, so on Android the app draws behind the
  // system nav bar — a hardcoded paddingBottom put the tab bar under it on phones
  // with gesture navigation (reported as "tabs don't show" on a real device,
  // 2026-11-22). insets.bottom is the actual reserved system-bar height per device.
  const insets = useSafeAreaInsets()
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarStyle: {
          backgroundColor: COLORS.navy,
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          paddingBottom: (Platform.OS === 'ios' ? 22 : 10) + bottomInset,
          paddingTop: 8,
          height: (Platform.OS === 'ios' ? 86 : 66) + bottomInset,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 0,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size ?? 22} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Queue',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size ?? 22} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarIcon: ({ color, size }) => <Car color={color} size={size ?? 22} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="travel"
        options={{
          title: 'Travel',
          tabBarIcon: ({ color, size }) => <Ticket color={color} size={size ?? 22} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, size }) => <Wallet color={color} size={size ?? 22} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size ?? 22} strokeWidth={2} />,
        }}
      />
    </Tabs>
  )
}
