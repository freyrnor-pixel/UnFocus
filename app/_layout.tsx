/**
 * _layout.tsx — root layout & minimal app bootstrap
 *
 * Loads the rounded Nunito font (gating render until ready), initialises SQLite,
 * loads the settings store, and defines the Expo Router Stack. Redirects to the
 * onboarding flow until setup is complete, mounts the global AppModalHost
 * (unconditionally) and the DebugOverlay (gated on settings.loaded &&
 * settings.debugModeEnabled).
 *
 * Connections:
 *   Imports → expo-router, expo-status-bar, react-native-gesture-handler,
 *             @expo-google-fonts/nunito, lib/db, lib/useAppTheme,
 *             store/useSettingsStore, components/AppModal, components/DebugOverlay
 *   Used by → router layout — defines the Stack
 *
 * Edit notes:
 *   - Minimal bootstrap only: settings load + onboarding redirect + DB init. The full
 *     multi-store notification bootstrap (all stores, syncReminders, task/habit notif
 *     sync, persistent overview) is still deferred — see PROGRESS_LOG Phase 6 flags.
 *     Each screen self-loads its own store on focus in the meantime.
 *   - Onboarding guard: once settings.loaded is true and setupComplete is false, and we
 *     aren't already under /onboarding, redirect to /onboarding/language. segments are
 *     read inside the effect as a guard, intentionally kept out of its deps.
 *   - <AppModalHost/> mounted here (Session A2·2) so showAppModal() works from any screen.
 *   - DebugOverlay is gated on `loaded && debugModeEnabled` so it never flashes before
 *     settings load and is absent for users who haven't enabled it.
 */
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { initDb } from '@/lib/db';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import AppModalHost from '@/components/AppModal';
import DebugOverlay from '@/components/DebugOverlay';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const theme = useAppTheme();
  const isDark = useIsDark();
  const loadSettings = useSettingsStore((s) => s.load);
  const loaded = useSettingsStore((s) => s.loaded);
  const setupComplete = useSettingsStore((s) => s.setupComplete);
  const debugModeEnabled = useSettingsStore((s) => s.debugModeEnabled);

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    try { initDb(); } catch { /* DB init failed — proceed anyway */ }
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Onboarding guard: send new users to the flow until setup is complete.
  useEffect(() => {
    if (!loaded || setupComplete) return;
    if (segments[0] !== 'onboarding') {
      router.replace('/onboarding/language');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, setupComplete]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.bg },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="plans" />
        <Stack.Screen name="shopping" />
        <Stack.Screen name="inventory-edit" />
        <Stack.Screen name="meals" />
        <Stack.Screen name="health" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="budget" />
        <Stack.Screen name="shared" />
        <Stack.Screen name="habits" />
        <Stack.Screen name="automations" />
        <Stack.Screen name="notes" />
        <Stack.Screen name="capture" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="task-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="habit-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="share-modal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      {loaded && debugModeEnabled && <DebugOverlay />}
      <AppModalHost />
    </GestureHandlerRootView>
  );
}
