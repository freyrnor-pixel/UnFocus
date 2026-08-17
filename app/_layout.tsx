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
 *             lib/backup (saveAutoBackup), lib/db, lib/syncService, lib/i18n (getTranslations),
 *             lib/notifications (syncNotificationCategories/onNotificationAction/cancelReNudge,
 *             plus onMedicineAction/cancelTrayReNudge for the medicine tray reminders),
 *             lib/taskNotifications (snoozeTaskReminder),
 *             lib/medicineNotifications (registerMedicineCategory/snoozeTrayReminder) +
 *             lib/medicineSchedule (isTrayId — guards the tray id off a notification payload),
 *             lib/widgets/sync (syncWidgetsAndOverview — pushes today to the home-screen widgets
 *             + persistent overview notification), lib/useAppTheme,
 *             store/useSettingsStore, store/useAutomationStore, store/useCatalogStore,
 *             store/useEnergyStore, store/useFeedbackStore, store/useGoalStore, store/useHabitStore, store/useHealthStore,
 *             store/useMealStore, store/useMedicineStore, store/useMonthlyListStore, store/useNotesStore, store/usePeersStore, store/useReceiptStore,
 *             store/useSharedStore, store/useShoppingListStore, store/useShoppingStore,
 *             store/useTagStore, store/useTaskStore, components/AppModal
 *   Used by → router layout — defines the Stack
 *
 * Edit notes:
 *   - **Interactive notification actions (2026-07-27) — WIRED.** Task reminders have always
 *     been scheduled with `categoryIdentifier: 'task-reminder'`, but the category itself was
 *     only ever registered from app/settings.tsx's language-change branch (so a user who never
 *     switched language saw no buttons), and `onNotificationAction` was never called at all (so
 *     the buttons did nothing when they did appear). Both now live here: registration in the
 *     boot effect's Tier B block, the tap listener in its own effect. Settings keeps its
 *     language-change re-sync to relabel the buttons — don't remove it.
 *   - **Retention pruning (2026-07-20) — WIRED.** `pruneOldData()` (lib/db.ts) now
 *     actually runs, right after `initDb()` in the boot effect. Monthly recurring
 *     tasks' reminders are re-armed for their next occurrence in the same boot
 *     effect and again on every foreground (see `useTaskStore.getState().syncMonthlyTaskNotifications()`
 *     call sites below) since there's no native repeating trigger that expresses
 *     "day-of-month, clamped"/"nth weekday" — see lib/taskNotifications.ts.
 *   - Settings + all stores hydrate in one mount effect (see the effect comment):
 *       - Tier A (synchronous, same tick): Automation, Task, Shopping,
 *         ShoppingList, Shared, Habit, Health, plus Notes, Meal and Catalog —
 *         the stores read by content on the FIRST screens (Notes → the Home notes
 *         preview; Meal + Catalog → the Shopping tab), so they must be ready before
 *         first paint or that content pops in a beat late. Includes
 *         useAutomationStore so `shopping_opened` / `task_completed` triggers are
 *         live from launch, not only after a screen self-loads that store.
 *       - Tier B (deferred via InteractionManager.runAfterInteractions):
 *         Feedback, Peers, Receipt — only back screens 2+ swipes from Home
 *         (Scan's receipt parsing) or non-tab screens, so a beat of extra latency
 *         is imperceptible. syncWidgetsAndOverview() also runs here (not inline in
 *         the boot tick): its buildWidgetSnapshot() does synchronous store walks +
 *         a DB write before its first await, which used to block the held splash /
 *         first paint for work that never needs to be ready before the app is visible.
 *         Joined 2026-07-28 by loadDeleted() (tombstones — nothing on a first paint
 *         draws one) and syncMonthlyTaskNotifications() (per-task native scheduling
 *         calls that nothing painted depends on, and the foreground handler re-runs
 *         them anyway). Rule of thumb for this list: if first paint doesn't READ it,
 *         it belongs in Tier B.
 *   - Cold-load asset warming (2026-07-16, un-gated 2026-07-28): the icon glyph fonts
 *     (Ionicons + MaterialCommunityIcons `.font`) are preloaded via useFonts alongside
 *     Nunito so icons paint on the first frame instead of popping in a beat late. The one
 *     bundled image the app draws (icon.png) is still warmed via Asset.loadAsync in the boot
 *     effect, but launch is no longer GATED on that decode — it used to hold the splash for
 *     up to 1.5s (its own timeout floor) so a decorative watermark wouldn't fade in. It
 *     doesn't appear on Home, so that cost bought nothing on the launch path. (Every backdrop
 *     is pure SVG — components/ScreenBackground and components/Motif — so there is no
 *     backdrop image to decode at all.)
 *   - **Launch is ONE screen, not two (2026-07-28).** Cold start is: held native splash →
 *     the app. It used to be splash → a full-screen WelcomeReveal overlay (the same tree
 *     logo the splash had just shown, plus name + tagline, on a fixed ~1.5s timeline) →
 *     the app, which the maintainer reported as "two screens before I land in home".
 *     That component is deleted, along with its `welcomeHeading`/`welcomeTagline` keys.
 *     Don't reintroduce a JS-rendered launch screen: the native splash already shows the
 *     brand, so a second one is a duplicate the user waits through on every single launch.
 *   - Native splash "one clean reveal" (2026-07-16, needs the 1.4.0 build): the native
 *     splash is HELD via SplashScreen.preventAutoHideAsync() at module scope and hidden by
 *     `revealApp` once fonts + settings are ready AND the destination route is settled.
 *     Until fonts/settings land the component returns `null` (the splash covers the
 *     screen). The route-settled half matters for a NEW user: the Stack's initial route is
 *     the tabs, so without it they'd get one frame of Home before the onboarding redirect
 *     replaced it. The tree deliberately still RENDERS during that window (so effects run
 *     and the router has real navigation state for router.replace to act on) — the splash
 *     just stays up over it. WelcomeReveal used to mask this window incidentally.
 *     expo-splash-screen/expo-system-ui/expo-navigation-bar are native modules that only
 *     exist in the 1.4.0+ build; the module-scope preventAutoHideAsync would throw on the
 *     old 1.3.0 runtime, which is why this ships in a build (runtimeVersion bumped), not OTA.
 *   - Native chrome (Android): a theme-keyed effect sets SystemUI.setBackgroundColorAsync
 *     + NavigationBar.setStyle so the system window/nav-bar match the app theme once JS is
 *     live; app.json's splash + backgroundColor cover the pre-JS window.
 *   - loadSettings() flips `loaded` only after Tier A has hydrated in the same effect, so
 *     once the gate passes the first screens mount with their data already in memory rather
 *     than empty-then-fill. Screens keep their guarded focus-loads as redundant safety nets.
 *   - First-run guard (2026-07-30): after setupComplete, an install with firstRunComplete
 *     still false is sent to /onboarding/basics. This is a SAFETY NET only —
 *     onboarding's own finish()/Explore handlers route there directly, so it normally
 *     never fires. Both gates are satisfied by skipping, so neither can trap a user.
 *   - Onboarding guard: once settings.loaded is true and setupComplete is false, and we
 *     aren't already under /onboarding, redirect to /onboarding/basics. segments are
 *     read inside the effect as a guard, intentionally kept out of its deps.
 *   - LAN live-sync (Decision 038 app integration): a dedicated effect starts/stops
 *     lib/syncService's transport as settings.lanSyncEnabled flips, once settings have
 *     hydrated a deviceId. See app/pair-device.tsx for the pairing UI and
 *     app/settings.tsx's Data group for the on/off toggle.
 *   - The 5 main sites (Home/Shopping/Plans/Health/Habits, was .../Scan before the
 *     2026-07-23 E1/E2 nav swap) are no longer separate Stack.Screen entries — they're
 *     one <Stack.Screen name="(tabs)" /> covering app/(tabs)/_layout.tsx's material-top-tabs
 *     pager (see that file + lib/siteNav.ts).
 *     Everything else (onboarding, inventory-edit, scan, food, catalogue, budget, shared,
 *     health-detail, health-form, health-log, automations, notes, the 3 remaining modals
 *     — capture/habit-form/share-modal; task-form was the 4th until it was retired,
 *     2026-07-23, UX audit B1 — see components/TaskCard.tsx) still pushes on top of it
 *     exactly as before — the pager only replaced how the 5 main sites relate to each
 *     other. Scan moved from being one of those 5 to one of this
 *     "everything else" group (2026-07-23) when it dropped off the bottom nav; food/
 *     catalogue joined the same group the same day when they dropped off Shopping's
 *     sticky tab row (UX audit F1) in favor of button-launched sub-screens.
 *   - Stack `screenOptions.animation` (Decision 033, amended 2026-07-19): iOS keeps the
 *     native `default` horizontal push; Android uses `slide_from_right` instead of its
 *     abrupt fade+slide `default`, so sub-screens open with one calm horizontal slide on
 *     both platforms (smoother, not slower, no bob). Modal screens keep `slide_from_bottom`.
 *   - <AppModalHost/> mounted here (Session A2·2) so showAppModal() works from any screen.
 *   - <WelcomeReveal/> (2026-07-19): animated tree brand-reveal overlaid above the Stack,
 *     gated on `showWelcome` (starts true, flipped off by its onDone). Plays once per cold
 *     launch — it bridges the native splash and the app (same themed bg → tree bloom →
 *     dissolve). OTA-safe (pure JS/Reanimated); the native splash it hands off from is
 *     tuned separately in app.json (build-gated).
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
  Nunito_400Regular_Italic,
} from '@expo-google-fonts/nunito';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as NavigationBar from 'expo-navigation-bar';
import { Fonts, MAX_FONT_SCALE } from '@/constants/theme';
import { Duration } from '@/constants/motion';
import { initDb, pruneOldData } from '@/lib/db';
import { getTranslations } from '@/lib/i18n';
import { cancelHabitReNudge, cancelReNudge, cancelTrayReNudge, onHabitAction, onMedicineAction, onNotificationAction, syncNotificationCategories } from '@/lib/notifications';
import { registerMedicineCategory, snoozeTrayReminder } from '@/lib/medicineNotifications';
import { registerHabitCategory, snoozeHabitReminder } from '@/lib/habitNotifications';
import { todayStr } from '@/lib/date';
import { isTrayId } from '@/lib/medicineSchedule';
import { snoozeTaskReminder } from '@/lib/taskNotifications';
import { saveAutoBackup } from '@/lib/backup';
import { syncWidgetsAndOverview } from '@/lib/widgets/sync';
import { startSync, stopSync } from '@/lib/syncService';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAutomationStore } from '@/store/useAutomationStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import { useGoalStore } from '@/store/useGoalStore';
import { useHabitStore } from '@/store/useHabitStore';
import { useEnergyStore } from '@/store/useEnergyStore';
import { useHealthStore } from '@/store/useHealthStore';
import { useMedicineStore } from '@/store/useMedicineStore';
import { useMealStore } from '@/store/useMealStore';
import { useNotesStore } from '@/store/useNotesStore';
import { useMomentsStore } from '@/store/useMomentsStore';
import { usePeersStore } from '@/store/usePeersStore';
import { usePeopleStore } from '@/store/usePeopleStore';
import { useTagStore } from '@/store/useTagStore';
import { useReceiptStore } from '@/store/useReceiptStore';
import { useSharedStore } from '@/store/useSharedStore';
import { useShoppingListStore } from '@/store/useShoppingListStore';
import { useMonthlyListStore } from '@/store/useMonthlyListStore';
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

// Global rounded-Nunito default for EVERY <Text>/<TextInput> — even ones that pass their own
// `style` (2026-07-18 "font varies where it should be identical" fix). This was the app-wide root
// cause: React only applies `defaultProps.style` when a component passes NO style prop, so the
// ~170 text styles that set only size/colour (no `fontFamily`) fell through to the platform system
// face (Roboto/SF) while their neighbours that DID name a Fonts.* family rendered Nunito — the
// visible drift. (Styles that set only `fontWeight` were a second cause, now converted to
// Fonts.*; Nunito is a static multi-weight family, so weight comes from the family name, not
// `fontWeight`.) Prepending the default family into the rendered element's style array — the
// standard RN "global font" technique — means an explicit `fontFamily` in a component's own style
// STILL wins (later entries override), while everything else finally lands on Nunito regular.
function patchDefaultFontFamily(Component: any) {
  if (!Component?.render || Component.__nunitoPatched) return;
  const originalRender = Component.render;
  Component.render = function nunitoPatchedRender(...args: any[]) {
    const element = originalRender.apply(this, args);
    if (!element) return element;
    return React.cloneElement(element, {
      style: [{ fontFamily: Fonts.regular }, (element.props as any)?.style],
    });
  };
  Component.__nunitoPatched = true;
}
patchDefaultFontFamily(RNText);
patchDefaultFontFamily(RNTextInput);

// Upper bound on how long the held splash may wait for the launch gates below. Generous
// enough that it never pre-empts a normal cold start (which clears them in well under a
// second), short enough that a wedged gate costs a blink rather than the whole app.
const SPLASH_FAILSAFE_MS = 2500;

// Hold the native splash screen up (instead of letting it auto-hide on the first JS
// frame) so the app reveals ONCE, fully painted — fonts, icon glyphs and the decoded
// backdrop image all ready — rather than flashing a half-built frame. Called in global
// scope without awaiting, per expo-splash-screen's guidance; RootLayout hides it in an
// onLayout callback once fonts + settings + image assets are ready. No-op on web.
void SplashScreen.preventAutoHideAsync().catch(() => { /* already hidden / unsupported */ });
// iOS gets a short cross-fade out; Android hides instantly (fade is iOS-only here).
SplashScreen.setOptions({ duration: Duration.modalOut, fade: true });

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const theme = useAppTheme();
  const isDark = useIsDark();
  const loadSettings = useSettingsStore((s) => s.load);
  const loaded = useSettingsStore((s) => s.loaded);
  const setupComplete = useSettingsStore((s) => s.setupComplete);
  const firstRunComplete = useSettingsStore((s) => s.firstRunComplete);
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
    // The app's ONE italic (2026-08-19) — components/NarratorQuote.tsx, and nothing else; see
    // DESIGN_RULES.md 22a. It is a REAL FACE rather than `fontStyle: 'italic'` because RN does
    // not map a style onto a named custom family: with only the upright faces loaded, that
    // property is synthesised on web and iOS and silently does NOTHING on Android, i.e. the
    // instruction would have looked delivered in every harness this repo can run and been
    // missing on the platform the app actually ships to first.
    Nunito_400Regular_Italic,
    // Preload the icon glyph fonts alongside Nunito so icons render on the first
    // frame instead of loading their font on first mount and popping in a beat late
    // (the "icons appear when triggered" cold-load symptom). These are small,
    // bundled TTFs — negligible added time to the font gate the app already waits on.
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

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
    try { pruneOldData(); } catch { /* never block startup on cleanup */ }
    loadSettings();
    useAutomationStore.getState().load();
    useGoalStore.getState().load(); // before tasks/habits so their goal links resolve on first paint
    // AFTER loadSettings (its one-time childProfiles back-fill reads userName/childProfiles
    // off the settings store) and BEFORE tasks — that back-fill writes tasks.assignee_id, so
    // loading tasks first would leave every row unassigned in memory until the next launch.
    usePeopleStore.getState().load();
    // Before tasks, for the same reason as goals: a task's tag_ids resolve to names on
    // first paint instead of rendering as nothing until the roster arrives.
    useTagStore.getState().load();
    useTaskStore.getState().load();
    useShoppingStore.getState().load();
    useShoppingListStore.getState().load();
    useMonthlyListStore.getState().load();
    useSharedStore.getState().load();
    useHabitStore.getState().load();
    useHealthStore.getState().load();
    // Medicine trays: load() also re-arms the four per-tray daily reminders, the same way
    // syncMonthlyTaskNotifications above re-arms its one-off monthly triggers.
    useMedicineStore.getState().load();
    useEnergyStore.getState().load(); // Home Energy meter — per-period capacity overrides
    // Notes → Home's notes preview; Meal + Catalog → the Shopping tab. These back
    // content on the FIRST screens, so they load synchronously here (not Tier B)
    // or that content visibly pops in a beat after first paint.
    useNotesStore.getState().load();
    useMealStore.getState().load();
    useCatalogStore.getState().load();
    // Moments back the day log, which is rendered by the day-view card on BOTH Home and
    // the To-do tab — a first screen either way, so it belongs in this tier rather than
    // Tier B. Loads unconditionally: `settings.featureDayLog` gates the SURFACE, never
    // the data, so turning the flag on shows a complete history rather than one that
    // starts at the moment you flipped it.
    useMomentsStore.getState().load();
    // Warm the one bundled image the app itself draws — icon.png, onboarding's hero.
    // Fire-and-forget: launch is deliberately NOT gated on this. It used to block the held
    // splash for up to 1.5s (its own timeout floor) so a decorative watermark wouldn't fade
    // in — a bad trade that every cold start paid. It isn't on Home at all, so warming it a
    // beat after first paint is invisible.
    // android-icon-monochrome.png dropped off this list on 2026-07-31 along with
    // components/TreeWatermark, its only consumer. The file stays in assets/ because
    // app.json still points Android's monochrome adaptive icon at it — but that is drawn by
    // the launcher, not by us, so there is nothing for us to warm.
    void Asset.loadAsync([
      require('../assets/icon.png'),
    ]).catch(() => { /* a cold decode on first use is fine */ });
    if (__DEV__) {
      console.log(`[perf] cold-start sync boot (initDb + Tier A store loads): ${Date.now() - t0}ms`);
    }
    // Tier B: only back screens 2+ swipes from Home (Scan's receipts) or non-tab
    // screens — deferred a beat so they don't compete with the first paint.
    InteractionManager.runAfterInteractions(() => {
      useFeedbackStore.getState().load();
      usePeersStore.getState().load();
      useReceiptStore.getState().load();
      // Tombstoned tasks, for the day-view's "Recently deleted" restore zone (2026-07-27).
      // Tier B since 2026-07-28: nothing on any first paint draws a tombstone — the zone
      // only appears once you open the day view's restore affordance.
      useTaskStore.getState().loadDeleted();
      // Monthly recurring tasks have no native "day-of-month, clamped"/"nth weekday"
      // repeating trigger, so their reminder is scheduled as a one-off for the next
      // occurrence and re-armed on boot + every foreground rather than once ever.
      // Tier B since 2026-07-28: this is a per-task native scheduling call that nothing
      // painted depends on, and the foreground handler re-runs it anyway.
      useTaskStore.getState().syncMonthlyTaskNotifications();
      // Register the 'task-reminder' category's Done / Remind-me-later buttons. Every task
      // reminder is scheduled with categoryIdentifier: 'task-reminder', but until 2026-07-27
      // this only ran from app/settings.tsx's language-change branch — so a user who never
      // switched language never got the buttons at all. Settings still re-syncs on a language
      // change to relabel them; this is the baseline registration. getTranslations() (not
      // useT()) because we're outside the component tree here.
      {
        const tNotif = getTranslations();
        void syncNotificationCategories(tNotif.notif.actionDone, tNotif.notif.actionRemindLater);
        // The medicine tray reminders' own Taken / Remind-me-later category (separate from
        // 'task-reminder' — different payload, different meaning). app/settings.tsx re-registers
        // all three on a language change to relabel the OS-level buttons.
        registerMedicineCategory(useSettingsStore.getState().language);
        // Habit reminders' Done / Remind-me-later. They were the one reminder type in the app
        // with no buttons at all until 2026-08-15 — a habit nudge could only be dismissed or
        // tapped through, which is the wrong ask for the reminder most likely to arrive while
        // your hands are full.
        registerHabitCategory(useSettingsStore.getState().language);
      }
      // Push today's tasks/shopping to the home-screen widgets + persistent overview
      // notification. Deferred to Tier B (was synchronous in the boot tick): its
      // buildWidgetSnapshot() walks every store, localises strings, and writes the
      // widget_snapshot row — all synchronously before the first `await`, so calling
      // it inline blocked the held splash / first paint. The widgets already render
      // from the last saved snapshot via the headless handler, so refreshing them a
      // beat after the app is visible is imperceptible and off the cold-start critical path.
      void syncWidgetsAndOverview();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Interactive notification actions (2026-07-27). The 'task-reminder' category's buttons
  // were registered but nothing ever listened for the taps, so "Done" and "Remind me later"
  // did nothing. 'done' completes the task through the store's normal write path
  // (completeDirect — the same one a tap in the UI takes, so widgets/sync/energy all stay
  // consistent) and drops any pending snooze; 'snooze' arms the 15-minute follow-up.
  // Mounted once for the app's lifetime; the listener also fires for taps that woke the app
  // from cold, so the store read happens inside the handler rather than over a captured value.
  useEffect(() => {
    return onNotificationAction((action, taskId) => {
      if (action === 'done') {
        useTaskStore.getState().completeDirect(taskId);
        void cancelReNudge(taskId);
        return;
      }
      const task = useTaskStore.getState().tasks.find((tk) => tk.id === taskId);
      if (task) snoozeTaskReminder(task);
    });
  }, []);

  // Medicine tray reminders' action buttons (2026-07-27). 'med-taken' logs EVERY not-yet-taken
  // medicine in that tray — a tray notification is about the window as a whole, which is also
  // why this is the store's takeTray() rather than a per-medicine call. 'med-snooze' re-nudges
  // in 15 minutes. Mounted for the app's lifetime and reading the store inside the handler, so
  // it works for a tap that woke the app from cold. Kept a separate listener from the task one
  // above: each filters on its own notification payload key.
  useEffect(() => {
    return onMedicineAction((action, tray) => {
      if (!isTrayId(tray)) return;
      if (action === 'med-taken') {
        useMedicineStore.getState().takeTray(tray);
        void cancelTrayReNudge(tray);
        return;
      }
      snoozeTrayReminder(tray, useSettingsStore.getState().language);
    });
  }, []);

  // Habit reminders' action buttons (2026-08-15). 'habit-done' counts the habit for today
  // through the store's normal increment() — the same write a tap on the card takes, so the
  // goal-strength bump, the widget sync and the day log all still happen. Deliberately an
  // INCREMENT, not a "mark met": a counter habit nudged three times a day should count three
  // times, and for the daily-goal-of-1 case (almost every real habit) the two are identical.
  // 'habit-snooze' re-nudges in 15 minutes. Same cold-start-safe shape as the two above.
  useEffect(() => {
    return onHabitAction((action, habitId) => {
      if (action === 'habit-done') {
        useHabitStore.getState().increment(habitId, todayStr());
        void cancelHabitReNudge(habitId);
        return;
      }
      const habit = useHabitStore.getState().habits.find((h) => h.id === habitId);
      if (habit) snoozeHabitReminder(habit, useSettingsStore.getState().language);
    });
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
        // Re-arm any monthly recurring task's reminder for its next occurrence
        // (see the boot-effect call site's comment above).
        useTaskStore.getState().syncMonthlyTaskNotifications();
      }
      if (state === 'active' || state === 'background') {
        void syncWidgetsAndOverview();
      }
    });
    return () => sub.remove();
  }, []);

  // Onboarding guard: send new users to the flow until setup is complete, then through the
  // Basics screen until that's been seen once. Basics is the FIRST onboarding screen
  // (app/onboarding/basics.tsx), so on a fresh install the first leg covers both; the second
  // leg is a SAFETY NET for an install that somehow reaches the tabs with firstRunComplete
  // still false — most plausibly one that finished onboarding under an older build, before
  // the four-step first-run flow was folded into Basics. Both gates are one-way and both are
  // satisfied by skipping, so neither can trap a user.
  useEffect(() => {
    if (!loaded) return;
    if (!setupComplete) {
      if (segments[0] !== 'onboarding') router.replace('/onboarding/basics');
      return;
    }
    if (!firstRunComplete && segments[0] !== 'onboarding') {
      router.replace('/onboarding/basics');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, setupComplete, firstRunComplete]);

  // Gate rendering on fonts AND settings hydration. The boot effect finishes every
  // Tier A store load before it flips `loaded`, so once this gate passes all five
  // pre-mounted tab screens mount with their data already in memory — no
  // empty-then-fill flicker. (Image decoding is deliberately NOT part of this gate —
  // see the Asset.loadAsync call in the boot effect.)
  const appReady = fontsLoaded && loaded;

  // Which route we land on is only settled once we know the user finished setup — or,
  // for one who hasn't, once the onboarding redirect below has actually landed. Until
  // then the Stack's initial route is the tabs, so a brand-new user would otherwise get
  // one frame of Home before being replaced onto onboarding/basics. The held native
  // splash covers that frame: the tree still RENDERS underneath (so effects run, the
  // router has real navigation state, and the redirect can fire) — we just don't reveal
  // it until the destination is real. Until 2026-07-28 the WelcomeReveal overlay was
  // incidentally hiding this window; with that gone the splash has to do it explicitly.
  // FAILSAFE: never let a condition above be the only thing standing between the user and
  // their app. This ships OTA, and a splash that never hides is an app that never opens —
  // unrecoverable without a reinstall, on installs we can't debug. So the reveal is also
  // armed on a timer: if `canReveal` hasn't gone true within SPLASH_FAILSAFE_MS, show
  // whatever we've got. Worst case that's the one frame of Home the routeSettled gate
  // exists to avoid, which is a cosmetic blemish — categorically better than a dead launch.
  const [failsafeElapsed, setFailsafeElapsed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFailsafeElapsed(true), SPLASH_FAILSAFE_MS);
    return () => clearTimeout(id);
  }, []);

  const routeSettled =
    (setupComplete && firstRunComplete) ||
    segments[0] === 'onboarding';
  const canReveal = appReady && (routeSettled || failsafeElapsed);

  const revealApp = useCallback(() => {
    if (canReveal) {
      void SplashScreen.hideAsync().catch(() => { /* already hidden */ });
    }
  }, [canReveal]);

  // onLayout covers the common case (destination already settled when the tree lays
  // out); this covers the new-user case, where `canReveal` only flips true after the
  // redirect lands — i.e. after layout has already happened, so onLayout won't re-fire.
  // hideAsync is idempotent, so the two overlapping is harmless.
  useEffect(() => { revealApp(); }, [revealApp]);

  if (!appReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={revealApp}>
      <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.bg },
          headerShown: false,
          // Decision 033 (amended 2026-07-19): smooth horizontal push for sub-screens.
          // iOS `default` is ALREADY the decelerating horizontal card push, so it's kept
          // as-is. Android `default` is a fast fade+slide that reads as an abrupt "clicky"
          // pop — swapped to `slide_from_right`, the same horizontal translate with a
          // decelerate interpolator, so both platforms now open sub-screens with one calm
          // slide (smoother, NOT slower, and no spring/overshoot "bob"). OS reduce-motion is
          // honoured by the native stack; the in-app reducedMotion setting does NOT gate this
          // (it governs Reanimated only). NB: the 5 main tabs are a separate surface — a
          // react-native-pager-view native slide in app/(tabs)/_layout.tsx, not this Stack.
          animation: Platform.OS === 'android' ? 'slide_from_right' : 'default',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="inventory-edit" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="food" />
        <Stack.Screen name="catalogue" />
        <Stack.Screen name="budget" />
        <Stack.Screen name="shared" />
        <Stack.Screen name="pair-device" />
        <Stack.Screen name="health-detail" />
        <Stack.Screen name="health-form" />
        <Stack.Screen name="health-log" />
        <Stack.Screen name="automations" />
        <Stack.Screen name="notes" />
        <Stack.Screen name="capture" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="habit-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="share-modal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <AppModalHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
