/**
 * _layout.tsx — root layout & minimal app bootstrap
 *
 * Loads the rounded Nunito font (gating render until ready), initialises SQLite,
 * loads the settings store, then once settings are loaded fires the app-wide
 * startup loads for every other store, and defines the Expo Router Stack.
 * Redirects to the onboarding flow until setup is complete, mounts the global
 * AppModalHost (unconditionally) and the DebugOverlay (gated on settings.loaded &&
 * settings.debugModeEnabled).
 *
 * Connections:
 *   Imports → expo-router, expo-status-bar, react-native (AppState), react-native-gesture-handler,
 *             react-native-safe-area-context (SafeAreaProvider — supplies insets to every
 *             screen's SafeAreaView so content clears the status bar on Android too),
 *             @expo-google-fonts/nunito, lib/backup (saveAutoBackup), lib/db, lib/syncService, lib/useAppTheme,
 *             store/useSettingsStore, store/useAutomationStore, store/useCatalogStore,
 *             store/useHabitStore, store/useHealthStore, store/useInboxStore,
 *             store/useMealStore, store/useNotesStore, store/usePeersStore, store/useReceiptStore,
 *             store/useSharedStore, store/useShoppingListStore, store/useShoppingStore,
 *             store/useTaskStore, components/AppModal, components/DebugOverlay
 *   Used by → router layout — defines the Stack
 *
 * Edit notes:
 *   - Settings load first (own effect, mount-only); a second effect keyed on
 *     `loaded` fires every other store's `load()` once settings have hydrated —
 *     this is the app-wide bootstrap referenced by the old "still deferred" note.
 *     Crucially includes useAutomationStore.load() so `shopping_opened` /
 *     `task_completed` triggers are live from launch, not only after the user
 *     visits a screen that happens to load that store first.
 *   - Render is NOT gated on these loads (unlike the font load) — screens already
 *     tolerate hydrating stores via their own guarded focus-loads, which stay in
 *     place as redundant safety nets, not dead code.
 *   - Onboarding guard: once settings.loaded is true and setupComplete is false, and we
 *     aren't already under /onboarding, redirect to /onboarding/language. segments are
 *     read inside the effect as a guard, intentionally kept out of its deps.
 *   - LAN live-sync (Decision 038 app integration): a dedicated effect starts/stops
 *     lib/syncService's transport as settings.lanSyncEnabled flips, once settings have
 *     hydrated a deviceId. See app/pair-device.tsx for the pairing UI and
 *     app/settings.tsx's Data group for the on/off toggle.
 *   - The 5 main sites (Home/Shopping/Plans/Health/Scan) are no longer separate
 *     Stack.Screen entries — they're one <Stack.Screen name="(tabs)" /> covering
 *     app/(tabs)/_layout.tsx's material-top-tabs pager (see that file + lib/siteNav.ts).
 *     Everything else (onboarding, inventory-edit, budget, shared, habits,
 *     automations, notes, the 4 modals) still pushes on top of it exactly as before —
 *     the pager only replaced how the 5 main sites relate to each other.
 *   - Stack `screenOptions.animation: 'default'` (Decision 033) turns on platform-native
 *     push/pop transitions; the modal screens keep their explicit `slide_from_bottom`.
 *   - <AppModalHost/> mounted here (Session A2·2) so showAppModal() works from any screen.
 *   - DebugOverlay is gated on `loaded && debugModeEnabled` so it never flashes before
 *     settings load and is absent for users who haven't enabled it.
 */
import React, { useEffect, useRef } from 'react';
import { AppState, Text as RNText, TextInput as RNTextInput } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { initDb } from '@/lib/db';
import { saveAutoBackup } from '@/lib/backup';
import { startSync, stopSync } from '@/lib/syncService';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAutomationStore } from '@/store/useAutomationStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useHabitStore } from '@/store/useHabitStore';
import { useHealthStore } from '@/store/useHealthStore';
import { useInboxStore } from '@/store/useInboxStore';
import { useMealStore } from '@/store/useMealStore';
import { useNotesStore } from '@/store/useNotesStore';
import { usePeersStore } from '@/store/usePeersStore';
import { useReceiptStore } from '@/store/useReceiptStore';
import { useSharedStore } from '@/store/useSharedStore';
import { useShoppingListStore } from '@/store/useShoppingListStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useTaskStore } from '@/store/useTaskStore';
import AppModalHost from '@/components/AppModal';
import DebugOverlay from '@/components/DebugOverlay';

// Cap OS-level font scaling (Dynamic Type / Android font size) so it can't
// overflow the app's fixed-height chrome — the header (56px), BottomNav (72px),
// FAB, chips, etc. The in-app font-size setting (small/default/large, applied
// via useScaledStyles) still scales text on top of this; the cap only bounds the
// OS multiplier that stacks over it, which was previously uncapped. 1.4 keeps a
// meaningful accessibility zoom while preventing the worst clipping/overflow.
const MAX_FONT_SCALE = 1.4;
(RNText as any).defaultProps = { ...(RNText as any).defaultProps, maxFontSizeMultiplier: MAX_FONT_SCALE };
(RNTextInput as any).defaultProps = { ...(RNTextInput as any).defaultProps, maxFontSizeMultiplier: MAX_FONT_SCALE };

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const theme = useAppTheme();
  const isDark = useIsDark();
  const loadSettings = useSettingsStore((s) => s.load);
  const loaded = useSettingsStore((s) => s.loaded);
  const setupComplete = useSettingsStore((s) => s.setupComplete);
  const debugModeEnabled = useSettingsStore((s) => s.debugModeEnabled);
  const lanSyncEnabled = useSettingsStore((s) => s.lanSyncEnabled);
  const deviceId = useSettingsStore((s) => s.deviceId);
  const userName = useSettingsStore((s) => s.userName);
  const autoBackupEnabled = useSettingsStore((s) => s.autoBackupEnabled);
  const autoBackupRef = useRef(autoBackupEnabled);
  autoBackupRef.current = autoBackupEnabled;

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

  // App-wide startup store loads, once settings have hydrated. Includes
  // useAutomationStore so triggers (shopping_opened, task_completed) are live
  // from launch instead of only after visiting a screen that self-loads them.
  // Per-screen focus-loads remain as redundant safety nets.
  useEffect(() => {
    if (!loaded) return;
    useAutomationStore.getState().load();
    useCatalogStore.getState().load();
    useHabitStore.getState().load();
    useHealthStore.getState().load();
    useInboxStore.getState().load();
    useMealStore.getState().load();
    useNotesStore.getState().load();
    usePeersStore.getState().load();
    useReceiptStore.getState().load();
    useSharedStore.getState().load();
    useShoppingListStore.getState().load();
    useShoppingStore.getState().load();
    useTaskStore.getState().load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // LAN live-sync (Decision 038 app integration): start/stop lib/syncService's
  // transport as the settings toggle flips, once a stable deviceId exists (settings
  // store self-heals it on load()). No-op (isSyncAvailable() false) outside a real
  // build with the native transport modules linked. Stopped on unmount as a safety
  // net, though the root layout normally lives for the app's whole lifetime.
  // Deliberately NOT keyed on userName: startSync() is idempotent while already
  // running, so a rename wouldn't actually re-advertise the new name anyway — the
  // advertised name only updates on the next real stop/start (toggle off-on or
  // relaunch), rather than every dependent's name edit dropping every live peer
  // connection to force a restart that wouldn't have picked up the change either.
  useEffect(() => {
    if (!loaded || !deviceId) return;
    if (lanSyncEnabled) {
      startSync({ deviceId, name: userName || 'UnFocus' });
    } else {
      stopSync();
    }
    return () => stopSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, lanSyncEnabled, deviceId]);

  // Auto-backup: save to the fixed local path whenever the app goes to background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && autoBackupRef.current) {
        void saveAutoBackup();
      }
    });
    return () => sub.remove();
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
      <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.bg },
          headerShown: false,
          // Decision 033: platform-default native stack transitions (iOS horizontal push,
          // Android slide/fade). OS reduce-motion is honoured by the native stack; the in-app
          // reducedMotion setting does NOT gate this (it governs Reanimated only).
          animation: 'default',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="inventory-edit" />
        <Stack.Screen name="budget" />
        <Stack.Screen name="shared" />
        <Stack.Screen name="pair-device" />
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
