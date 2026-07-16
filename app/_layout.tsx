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
 *             @expo-google-fonts/nunito, @expo/vector-icons (Ionicons/MaterialCommunityIcons —
 *             .font preloaded into useFonts so icons don't pop in on cold load),
 *             expo-asset (Asset.loadAsync warms the bundled-image cache at boot),
 *             expo-splash-screen (held until the app is fully painted, then hidden),
 *             expo-system-ui + expo-navigation-bar (theme the Android system chrome),
 *             lib/backup (saveAutoBackup), lib/db, lib/syncService,
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
 *   - Settings + all stores hydrate in one mount effect (see the effect comment):
 *       - Tier A (synchronous, same tick): Automation, Task, Shopping,
 *         ShoppingList, Shared, Habit, Health, plus Notes, Meal and Catalog —
 *         the stores read by content on the FIRST screens (Notes → the Home notes
 *         preview; Meal + Catalog → the Shopping tab), so they must be ready before
 *         first paint or that content pops in a beat late. Includes
 *         useAutomationStore so `shopping_opened` / `task_completed` triggers are
 *         live from launch, not only after a screen self-loads that store.
 *       - Tier B (deferred via InteractionManager.runAfterInteractions):
 *         Feedback, Inbox, Peers, Receipt — only back screens 2+ swipes from Home
 *         (Scan's receipt parsing) or non-tab screens, so a beat of extra latency
 *         is imperceptible.
 *   - Cold-load asset warming (2026-07-16): the icon glyph fonts (Ionicons +
 *     MaterialCommunityIcons `.font`) are preloaded via useFonts alongside Nunito so
 *     icons paint on the first frame instead of loading their font on first mount and
 *     popping in. The bundled images (bg-light/dark, icon, monochrome) are decoded into
 *     cache via Asset.loadAsync in the boot effect; `assetsReady` flips on settle (with a
 *     1.5s timeout floor) so the backdrop is ready before the splash hides.
 *   - Native splash "one clean reveal" (2026-07-16, needs the 1.4.0 build): the native
 *     splash is HELD via SplashScreen.preventAutoHideAsync() at module scope, and hidden
 *     in onLayoutRootView only once fonts + settings + assets are all ready. Until then
 *     the component returns `null` (the splash covers the screen), so launch goes
 *     splash → fully-painted app in one step — never a plain backdrop or half-empty frame.
 *     expo-splash-screen/expo-system-ui/expo-navigation-bar are native modules that only
 *     exist in the 1.4.0+ build; the module-scope preventAutoHideAsync would throw on the
 *     old 1.3.0 runtime, which is why this ships in a build (runtimeVersion bumped), not OTA.
 *   - Native chrome (Android): a theme-keyed effect sets SystemUI.setBackgroundColorAsync
 *     + NavigationBar.setStyle so the system window/nav-bar match the app theme once JS is
 *     live; app.json's splash + backgroundColor cover the pre-JS window.
 *   - loadSettings() flips `loaded` only after Tier A has hydrated in the same effect, so
 *     once the gate passes the first screens mount with their data already in memory rather
 *     than empty-then-fill. Screens keep their guarded focus-loads as redundant safety nets.
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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, InteractionManager, Platform, Text as RNText, TextInput as RNTextInput } from 'react-native';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as NavigationBar from 'expo-navigation-bar';
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

// Hold the native splash screen up (instead of letting it auto-hide on the first JS
// frame) so the app reveals ONCE, fully painted — fonts, icon glyphs and the decoded
// backdrop image all ready — rather than flashing a half-built frame. Called in global
// scope without awaiting, per expo-splash-screen's guidance; RootLayout hides it in an
// onLayout callback once fonts + settings + image assets are ready. No-op on web.
void SplashScreen.preventAutoHideAsync().catch(() => { /* already hidden / unsupported */ });
// iOS gets a short cross-fade out; Android hides instantly (fade is iOS-only here).
SplashScreen.setOptions({ duration: 220, fade: true });

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
    // Preload the icon glyph fonts alongside Nunito so icons render on the first
    // frame instead of loading their font on first mount and popping in a beat late
    // (the "icons appear when triggered" cold-load symptom). These are small,
    // bundled TTFs — negligible added time to the font gate the app already waits on.
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  // Gates hiding the splash (below) until the backdrop image is decoded, so the very
  // first screen — and every pushed sub-screen after it — paints its backdrop from a
  // warm cache instead of decoding + fading in. Held behind the splash (already on
  // screen), so this reads as launch, not a block. A timeout floor guarantees we never
  // hang on a slow/failed decode.
  const [assetsReady, setAssetsReady] = useState(false);

  // One-shot cold-start bootstrap in a single mount effect: initDb(), settings,
  // then the Tier A stores that back the first screens (synchronous getAllSync
  // scans), then Tier B deferred behind InteractionManager. loadSettings() flips
  // `loaded`, and render is gated on `loaded` below, so Tier A finishes before the
  // tabs mount and no first screen renders empty. useAutomationStore is included so
  // `shopping_opened` / `task_completed` triggers are live from launch. Per-screen
  // focus-loads stay as safety nets.
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
    // Notes → Home's notes preview; Meal + Catalog → the Shopping tab. These back
    // content on the FIRST screens, so they load synchronously here (not Tier B)
    // or that content visibly pops in a beat after first paint.
    useNotesStore.getState().load();
    useMealStore.getState().load();
    useCatalogStore.getState().load();
    // Today's tasks/shopping are ready now: push them to the home-screen widgets
    // + the persistent overview notification.
    void syncWidgetsAndOverview();
    // Decode the backdrop image (+ icons/logos) into cache before we hide the splash,
    // so the first screen and every pushed sub-screen paint their ImageBackground from
    // a warm cache instead of decoding + fading in ("each screen loads in"). Flip
    // `assetsReady` on settle — success OR failure — with a 1.5s timeout floor so a
    // slow/failed decode never strands us behind the splash. This runs while the splash
    // is still up, so it reads as launch, not an added block.
    let settled = false;
    const markAssetsReady = () => { if (!settled) { settled = true; setAssetsReady(true); } };
    const assetTimeout = setTimeout(markAssetsReady, 1500);
    void Asset.loadAsync([
      require('../assets/bg-light.png'),
      require('../assets/bg-dark.png'),
      require('../assets/icon.png'),
      require('../assets/android-icon-monochrome.png'),
    ]).then(markAssetsReady).catch(markAssetsReady);
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[perf] cold-start sync boot (initDb + Tier A store loads): ${Date.now() - t0}ms`);
    }
    // Tier B: only back screens 2+ swipes from Home (Scan's receipts) or non-tab
    // screens — deferred a beat so they don't compete with the first paint.
    InteractionManager.runAfterInteractions(() => {
      useFeedbackStore.getState().load();
      useInboxStore.getState().load();
      usePeersStore.getState().load();
      useReceiptStore.getState().load();
    });
    return () => clearTimeout(assetTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Native chrome (Android): paint the system window + navigation-bar to match the
  // active theme so there's no white/mismatched flash around the app's own background,
  // and the nav-bar icons stay legible in both themes. app.json's splash + backgroundColor
  // cover the pre-JS window; this keeps it correct once JS is live and on theme changes.
  // Android-only — these modules are no-ops/unsupported elsewhere.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void SystemUI.setBackgroundColorAsync(theme.bg).catch(() => { /* unsupported — ignore */ });
    try { NavigationBar.setStyle(isDark ? 'light' : 'dark'); } catch { /* unsupported — ignore */ }
  }, [theme.bg, isDark]);

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

  // Gate on fonts AND settings hydration AND the decoded backdrop image. The boot
  // effect finishes every store load before it flips `loaded`, so once this gate
  // passes all five pre-mounted tab screens mount with their data (and the backdrop)
  // already in memory — no empty-then-fill flicker. The native splash (held up above
  // via preventAutoHideAsync) stays on screen the whole time and is hidden in
  // onLayoutRootView once the real tree has laid out — so the cold launch goes
  // splash → fully-painted app in one clean step, never through a half-built frame.
  const appReady = fontsLoaded && loaded && assetsReady;
  const onLayoutRootView = useCallback(() => {
    if (appReady) {
      void SplashScreen.hideAsync().catch(() => { /* already hidden */ });
    }
  }, [appReady]);

  if (!appReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
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
