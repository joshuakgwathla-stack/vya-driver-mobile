import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { useSegments, useRouter } from 'expo-router'
import { AuthProvider, useAuth } from '../lib/auth'
import { ActivityIndicator, View } from 'react-native'
import { COLORS } from '../constants'
import { useFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display'

function RootNavigator() {
  const { user, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const [fontsLoaded] = useFonts({ PlayfairDisplay_700Bold })

  useEffect(() => {
    if (loading || !fontsLoaded) return
    const inAuth = segments[0] === '(auth)'
    if (!user && !inAuth) router.replace('/(auth)/welcome')
    else if (user && inAuth) router.replace('/(tabs)')
  }, [user, loading, fontsLoaded, segments])

  if (loading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.navy }}>
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="trip/[id]" />
      <Stack.Screen name="messages/[bookingId]" />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  )
}
