/**
 * _layout.tsx — root layout & minimal app bootstrap
 *
 * Loads the rounded Nunito font (gating render until ready), initialises SQLite,
 * loads the settings store, then once settings are loaded fires the app-wide
 * startup loads for every other store, and defines the Expo Router Stack.
 * Redirects to the onboarding flow until setup is complete, mounts the global
 * AppModalHost (unconditionally).
 *
 * Connections:
 *   Imports → expo-router, expo-status-bar, react-native (AppState), react-native-gesture-handler,
 *             react-native-safe-area-context (SafeAreaProvider — supplies insets to every
 *             screen's SafeAreaView so content clears the status bar on Android too),
 *             @expo-google-fonts/nunito, lib/backup (saveAutoBackup), lib/db, lib/syncService,
 *             lib/widgets/sync (syncWidgetsAndOverview — pushes today to the home-screen widgets
 *             + persistent overview notification), lib/useAppTheme,
 *             store/useSettingsStore, store/useAutomationStore, store/useCatalogStore,
 *             store/useFeedbackStore, store/useHabitStore, store/useHealthStore, store/useInboxStore,
 *             store/useMealStore, store/useNotesStore, store/usePeersStore, store/useReceiptStore,
 *             store/useSharedStore, store/useShoppingListStore, store/useShoppingStore,
 *             store/useTaskStore, components/AppModal
 *   Used by → router layout — defines the Stack
 *
 * Edit notes:
 *   - Cold-start hydration (2026-07-16): ALL 14 stores load EAGERLY and
 *     synchronously in one mount effect, right after initDb() + loadSettings().
 *     The old Tier A / Tier B split (Tier B deferred via
 *     InteractionManager.runAfterInteractions) was removed: the pager now mounts
 *     all five tab screens up front (lazy:false — see app/(tabs)/_layout.tsx),
 *     so EVERY screen needs its data in memory before first paint, or content
 *     visibly "loads in" the first time you navigate to a screen. Deferring
 *     Catalog/Meal in particular stranded Shopping (a PRIMARY tab, not "2+ swipes
 *     from Home") with an empty catalogue/food list on first visit — the exact
 *     pop-in this eager load fixes. All loads are synchronous getAllSync scans
 *     over small local tables, and they run behind the render gate below, so
 *     they cost a few ms of the launch window, not an interactive-frame stall.
 *   - Render is gated on BOTH fonts AND settings `loaded` (see the return near the
 *     bottom): until both are ready we paint a plain themed backdrop, not `null`
 *     and not a half-empty app. Because the load effect flips `loaded` only after
 *     it has finished hydrating every store, the gate guarantees no tab screen
 *     mounts before its data exists — killing the first-navigation flicker at the
 *     source rather than masking it. Screens keep their guarded focus-loads as
 *     redundant safety nets.
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
 *     Everything else (onboarding, inventory-edit, budget, shared, health-detail,
 *     health-form, health-log, automations, notes, the 4 modals) still pushes on top
 *     of it exactly as before —
 *     the pager only replaced how the 5 main sites relate to each other.
 *   - Stack `screenOptions.animation: 'default'` (Decision 033) turns on platform-native
 *     push/pop transitions; the modal screens keep their explicit `slide_from_bottom`.
 *   - <AppModalHost/> mounted here (Session A2·2) so showAppModal() works from any screen.
 *   - useFeedbackStore (debug notes) loads here like every other store; the debug-mode
 *     gate now lives per-anchor in components/DebugNoteAnchor.tsx / ScreenHeader instead
 *     of a single global overlay mount.
 */
import React, { useEffect, useRef } from 'react';
import { AppState, Text as RNText, TextInput as RNTextInput, View } from 'react-native';
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
import { MAX_FONT_SCALE } from '@/constants/theme';
import { initDb } from '@/lib/db';
import { saveAutoBackup } from '@/lib/backup';
import { syncWidgetsAndOverview } from '@/lib/widgets/sync';
import { startSync, stopSync } from '@/lib/syncService';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAutomationStore } from '@/store/useAutomationStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useFeedbackStore } from '@/store/useFeedbackStore';
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

// Cap OS-level font scaling (Dynamic Type / Android font size) so it can't overflow the
// app's chrome — BottomNav, FAB, chips, etc. (MAX_FONT_SCALE lives in constants/theme.ts,
// shared with getHeaderMetrics so the header band that DOES scale with this cap uses the
// exact same value.) The in-app font-size setting (small/default/large, applied via
// useScaledStyles) still scales text on top of this; the cap only bounds the OS multiplier
// that stacks over it. 1.4 keeps a meaningful accessibility zoom while preventing the worst
// clipping/overflow.
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

  // One-shot cold-start bootstrap. initDb() first, then settings, then EVERY
  // other store — all synchronous SQLite scans, all eager (no InteractionManager
  // defer, no Tier A/B split). The pager mounts all five tab screens up front
  // (lazy:false), so each screen must have its data in memory before it mounts or
  // content visibly "loads in" on first navigation. loadSettings() flips `loaded`
  // (batched with the store sets into a single re-render), and render is gated on
  // `loaded` below, so this whole block finishes before any tab screen mounts.
  // useAutomationStore is included so `shopping_opened` / `task_completed`
  // triggers are live from launch. Per-screen focus-loads stay as safety nets.
  useEffect(() => {
    const t0 = __DEV__ ? Date.now() : 0;
    try { initDb(); } catch { /* DB init failed — proceed anyway */ }
    loadSettings();
    useAutomationStore.getState().load();
    useTaskStore.getState().load();
    useShoppingStore.getState().load();
    useShoppingListStore.getState().load();
    useSharedStore.getState().load();
    useHabitStore.getState().load();
    useHealthStore.getState().load();
    useCatalogStore.getState().load();
    useMealStore.getState().load();
    useNotesStore.getState().load();
    useInboxStore.getState().load();
    useReceiptStore.getState().load();
    usePeersStore.getState().load();
    useFeedbackStore.getState().load();
    // Today's tasks/shopping are ready now: push them to the home-screen widgets
    // + the persistent overview notification.
    void syncWidgetsAndOverview();
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[perf] cold-start boot (initDb + 14 store loads): ${Date.now() - t0}ms`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Auto-backup on background; keep the widgets + persistent overview notification
  // current on every foreground/background transition (they show "today", which the
  // user may have changed elsewhere or which may have rolled over to a new day).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && autoBackupRef.current) {
        void saveAutoBackup();
      }
      if (state === 'active') {
        // A home-screen widget tap may have written straight to SQLite while we were
        // backgrounded or dead (lib/widgets/widgetActions.ts). Reload the widget-writable
        // stores from the DB so the app reflects it AND the sync below re-pushes the
        // reconciled state instead of clobbering it with stale in-memory rows.
        useTaskStore.getState().load();
        useShoppingStore.getState().load();
        useNotesStore.getState().load();
      }
      if (state === 'active' || state === 'background') {
        void syncWidgetsAndOverview();
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

  // Gate render on fonts AND settings hydration. The boot effect above finishes
  // loading every store before it flips `loaded`, so once this gate passes, all
  // five pre-mounted tab screens mount with their data already in memory — no
  // empty-then-fill flicker. Until then we paint a plain themed backdrop (not a
  // blank/`null` frame and not a half-empty app) so the cold launch reveals a
  // fully-populated app in one step.
  if (!fontsLoaded || !loaded) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

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
        <Stack.Screen name="health-detail" />
        <Stack.Screen name="health-form" />
        <Stack.Screen name="health-log" />
        <Stack.Screen name="automations" />
        <Stack.Screen name="notes" />
        <Stack.Screen name="capture" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="task-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="habit-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="share-modal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <AppModalHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
