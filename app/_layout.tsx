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
    const inOnboarding = segments[0] === 'onboarding'
    // Onboarding-completeness is one computed check, not several — matches
    // /auth/me's driver_profile_id + has_vehicle (panel review, 2026-11-22).
    const onboardingIncomplete = user?.role === 'driver' && (!user.driver_profile_id || !user.has_vehicle)

    if (!user && !inAuth) router.replace('/(auth)/welcome')
    else if (user && inAuth) router.replace(onboardingIncomplete ? '/onboarding' : '/(tabs)')
    else if (user && onboardingIncomplete && !inOnboarding) router.replace('/onboarding')
    else if (user && !onboardingIncomplete && inOnboarding) router.replace('/(tabs)')
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
      <Stack.Screen name="onboarding" />
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
