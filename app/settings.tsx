/**
 * settings.tsx — app settings
 *
 * Tabbed settings screen (Decision 001 tier='sub') — a non-scrolling 3-tab bar
 * (General | Personal | Advanced) sits directly under the header as ScreenScaffold's
 * `stickyBelowHeader`; each tab is its own scroll of cards (local `tab` state, no
 * router routes).
 *
 * - General — what you'd expect in any app: [Profil (name + language) / Utseende (dark
 *   mode, photo format) / Tilgjengelighet (reduced motion, particles, glass surfaces,
 *   font size, left-handed)] one merged panel → Data group (Send Feedback, then [Local
 *   account (Decision 039 — device-only profile: name + create date, auto-backup toggle,
 *   backup/restore via lib/backup [share excludes user name]) / version & updates] one
 *   merged panel, then the destructive Reset data card last).
 * - Personal — how it behaves for you: [Ukentlig (weekly reminder + time) / Generelle
 *   (independent plan-notification and habit-reminder toggles, persistent daily overview,
 *   quiet hours)] one merged panel → Shopping (weekly reset weekday, monthly reset date)
 *   → Layout (horizontal plans timeline) → Device features (voice/contacts/location/calendar).
 * - Advanced — modes and opt-ins: Features card (Energy system + its mode/capacities, then
 *   the five FEATURE_ROWS flags, then the Automations link when that flag is on) →
 *   [Personer-familie / Paired devices] one merged panel → Freyr-modus → Debug mode.
 *
 * **Reorganization (2026-07-25)**: was four tabs (Generelt | Handle | Varsler | Modi) where
 * Generelt alone carried eight unrelated groups and Handle carried exactly two settings.
 * Two things changed beyond the regrouping:
 *   1. **Dead settings removed.** Work mode (active/auto-activate/hours/work days/Norwegian
 *      holidays), School mode and Parent (child) mode all had switches writing settings
 *      columns that NOTHING in the app read. Their UI is gone; the columns stay (this repo
 *      never drops columns) — see store/useSettingsStore.ts's "Inert columns" note.
 *   2. **Feature opt-ins added.** Goals, Sharing & QR, Scan & receipts, Food & recipes and
 *      Automations became flags (FEATURE_ROWS below), joining the Energy system, and are all
 *      off on a fresh install so a first-time user isn't met with every surface at once.
 *      Only purely ADDITIVE things got a toggle — anything whose absence would break app
 *      logic (data pruning, widget/overview sync, catalog seeding, the automation store's
 *      boot load) is deliberately still unconditional.
 *
 * Every setting applies immediately via applyAndSync() — no buffered/dirty save step (matches
 * hints.settings.text: "Changes apply immediately.").
 *
 * **Layering pass (2026-07-13)**: related setting groups that used to each float in their own
 * bordered/shadowed Surface card are now merged into ONE shared Surface holding several
 * `ExpandableCard` rows (Profil+Utseende+Tilgjengelighet; Local account+Version & updates;
 * Personer/familie+Paired devices; Ukentlig+Generelle) — fewer separate
 * floating "islands" reads as one cohesive panel instead of a stack of unrelated boxes. This
 * is exactly the grouping pattern ExpandableCard's own header already documents (Decision 043
 * rule 1 / WeekListCard's dish-group rows) — multiple ExpandableCards as siblings inside one
 * caller-owned Surface, each getting its own hairline top divider for separation. Destructive
 * (Reset data) and single-toggle cards with no accordion body (Debug mode, Freyr-modus, the
 * Layout row) stay their own standalone card — folding a warning-red destructive card into a
 * neutral panel would bury its visual distinctiveness, and a plain toggle has nothing to
 * collapse.
 *
 * **Visual-audit pass (2026-07-23)**: the top-level merged-panel `ExpandableCard`s above now
 * pass `rounded` — each row gets its own rounded, sunken (theme.surfaceMuted) tile with a small
 * gap instead of the flush hairline divider, reading as a stack of rows rather than one flat
 * slab (screenshot feedback: "setting rows not rounded"). Also: the tab bar (`tabBar`/`tabsGlass`)
 * now floats with the same side margins + Radius.lg rounding as the header's own floated card
 * (was edge-to-edge/square, mismatched once the header started floating — read as a glitchy seam);
 * `stickyGapColor` switched from an opaque `theme.surface` to `"transparent"` to match the
 * header's own transparent float gaps; the lone `SectionDivider` before the Data group now zeroes
 * its own margin (content's `gap` was double-stacking with the divider's default margin, reading
 * as a huge blank band); and the tab labels pass `radius={Radius.md}` to TabSlider for a squarer
 * segmented-control shape instead of a full pill (Plans/Shopping keep the default pill).
 *
 * Connections:
 *   Imports → components/AppModal, components/ConfirmationBanner, components/FormControls,
 *             components/ScreenScaffold, components/SectionDivider, components/Surface,
 *             components/ExpandableCard, components/PressableScale, components/TabSlider,
 *             constants/theme, lib/domainColor, lib/backup
 *             (exportBackup/exportBackupToDevice/pickAndParseBackup/restoreBackup/reloadApp/
 *             saveAutoBackup/chooseAutoBackupLocation), lib/feedbackMail, lib/freyrModeSeed,
 *             lib/haptics, lib/i18n, lib/notifications, lib/reminders, lib/syncService, lib/widgets/sync
 *             (syncWidgetsAndOverview — the persistent-overview toggle refreshes/cancels it, and
 *             the Freyr-mode toggle re-syncs after seeding/unseeding today's tasks + shopping),
 *             lib/useAppTheme, store/useFeedbackStore, store/useHabitStore, store/useSettingsStore,
 *             store/useShoppingStore, store/useTaskStore
 *   Used by → Expo Router route "/settings" (linked from ScreenHeader's gear icon, tier='site')
 *   Data    → useSettingsStore (settings table; incl. energySystemEnabled/energy*Capacity, quietHours*,
 *             monthlyResetDate, taskNotificationsEnabled, habitNotificationsEnabled,
 *             persistentNotifEnabled, voiceNotesEnabled/contactsEnabled/locationEnabled/
 *             calendarSyncEnabled — the "Device features" card — and the featureGoals/
 *             featureSharing/featureScan/featureFood/featureAutomations opt-ins); reset actions touch
 *             useTaskStore (tasks) and useShoppingStore (shopping_items via monthlyReset);
 *             re-syncs notifications via syncReminders / syncAllTaskNotifications /
 *             syncAllTaskCalendarEvents / syncAllHabitReminders / syncNotificationCategories
 *
 * Edit notes:
 *   - **Monthly budget moved out (2026-07-22)**: the "handle" tab used to have a Monthly
 *     budget Input here, writing the single global `monthlyBudgetNok` setting. Budget is per
 *     Monthly list now (store/useMonthlyListStore.ts) — edited from that list's own Budget
 *     pill on the Shopping screen's Monthly tab (→ app/budget.tsx), not from Settings. The
 *     `monthlyResetDate` field just above it is unaffected (still one global payday-boundary
 *     date, shared by every list).
 *   - **Tab bar (updated 2026-07-25, never scrollable)**: the 3-tab bar is
 *     `components/TabSlider.tsx` — a single accent pill SLIDES to sit behind whichever
 *     category tab is active (same motion as the Day/Week/Month `SlideSelector`), replacing
 *     the old per-tab `TabBoxHighlight` boxes. TabSlider has no scroll mode at all (by design
 *     — see its own header), so all three tabs must fit in one row: keep `config.tabs.*`
 *     labels to single short words in BOTH languages ("Personal"/"Personlig",
 *     "Advanced"/"Avansert") so they never need to scroll. Each segment always sizes to its own label
 *     (TabSlider no longer has a fixed-equal-width mode — see its "No `sizing` prop" edit
 *     note), so a translation coming out longer than expected (Norwegian's "Generelt" vs.
 *     English's "General") no longer truncates one tab while the others sit with unused
 *     space. Same shared component as app/(tabs)/shopping.tsx and app/(tabs)/plans.tsx.
 *   - applyAndSync() is the single write path: updates settings AND fires the right notification
 *     re-sync based on which keys changed — route every settings change through it, never
 *     settings.update() directly. Quiet-hours keys re-sync task notifications; language or
 *     habitNotificationsEnabled changes re-sync habit reminders; a language change also
 *     re-registers the interactive notification action button labels via syncNotificationCategories.
 *   - Plan notifications (taskNotificationsEnabled) and Habit reminders
 *     (habitNotificationsEnabled) are now INDEPENDENT toggles — turning one off no longer
 *     silences the other. (Superseded the Decision 029b merge, which drove both flags from a
 *     single switch and left no way to keep task reminders while muting habit ones.)
 *   - Quiet-hours hint copy (Decision 016 Q4): habit occurrences inside quiet hours are SKIPPED,
 *     not deferred — task reminders still shift past the window. See lib/i18n.ts's
 *     settings.quietHours.hint.
 *   - TimePickerWheel was never ported into this repo — all HH:MM entry uses FormControls.Input
 *     (free-text, matching the precedent set by task-form.tsx / habit-form.tsx).
 *   - The Energy system (energySystemEnabled + energyDailyCapacity/energyWeeklyCapacity) leads
 *     the Advanced tab's Features card; when on it reveals a Daily/Weekly/Custom
 *     energyMode SegmentedControl. Daily/Weekly reveal their one flat capacity stepper;
 *     Custom reveals a Mon..Sun stepper row (energyCustomCapacities) instead, with the
 *     week capacity derived as their sum. Per-period overrides live on the Home Energy
 *     meter (components/EnergyMeter.tsx), which also hides whichever meter energyMode
 *     doesn't apply to.
 *   - Send Feedback card (2026-07-13): always visible (not gated on debugModeEnabled) — a
 *     free-text composer that builds a mailto: URL (lib/feedbackMail's buildFeedbackMailUrl,
 *     addressed to Unfocus@hlynsson.no, footer includes app/runtime version + platform) and
 *     opens it via Linking.openURL, falling back to RN's Share.share if no mail client is
 *     configured. Separate from the debug-notes export directly below — that's the testers'
 *     anchor-note tool, this is the general "type a message and email it" feature.
 *   - Debug section (2026-07-13 redesign): the toggle, plus — only while it's on — a how-to-use
 *     explainer and a "Reset all notes" button (useFeedbackStore.clearAll(), disabled when there
 *     are none). The actual notes are created elsewhere via components/DebugNoteAnchor.tsx
 *     (long-press any annotated card/header), not from this screen. permissionTests.ts does not
 *     exist in this repo yet — its buttons are NOT wired here; see the commented placeholder below.
 *   - "Reset weekly list" and the Test-data load/clear actions from the pre-rebuild app are NOT
 *     ported: this repo's shopping architecture replaced the single global weekly list with
 *     per-week ShoppingList rows (store/useShoppingListStore.ts, auto-rolling by date), so there
 *     is no equivalent "reset the current weekly list" store action to bind to; lib/seedTestData.ts
 *     also does not exist in this repo. Flagged in PROGRESS_LOG rather than inventing either.
 *   - LAN live sync (Decision 038 app integration): this screen only owns the entry-point card
 *     (description + link) on the Advanced tab — the sync toggle, QR pairing wizard, and paired-
 *     devices list all live on app/pair-device.tsx. syncAvailable (lib/syncService's
 *     isSyncAvailable()) gates whether the card shows the link or an "unavailable" note, since
 *     the native transport modules aren't linked outside a real build.
 *   - **Device features card (2026-07-17)**: four toggles (voice/contacts/location/calendar)
 *     for the reserve-only native surface — all default off, so components/TaskCard.tsx's
 *     mic/contact/location blocks (was app/task-form.tsx's, retired 2026-07-23) stay hidden
 *     and calendar mirroring stays inert until a user opts in here. The other three toggles
 *     were previously unreachable (fully wired in
 *     useSettingsStore but no UI anywhere) — this card is what makes them reachable.
 *   - **Card spacing (2026-07-21)**: `baseStyles.content`'s gap dropped from `Spacing.xl` (32,
 *     Decision 043 rule 2) to `Spacing.lg` (24) — it read as too much dead air between cards
 *     vs. every other screen's `Spacing.md`/`lg` content gap, per direct feedback.
 *   - **Contrast fixes inside `rounded` panels (2026-07-25)**: `langChip` (Profil language
 *     picker) and `dayChip` (the weekly-reset-day picker) filled their
 *     inactive state with `theme.surfaceMuted` and no border — invisible once the row's parent
 *     `ExpandableCard` itself went `rounded` (also `theme.surfaceMuted`-backed), since chip and
 *     container became the same colour. Both now carry a `theme.border` (or `theme.accent` when
 *     active) outline, matching the border `peopleChip`/`peopleAddBtn` already had.
 *   - **Feature opt-ins live in ONE place (2026-07-25)**: `FEATURE_ROWS` below is the whole
 *     list of plain on/off features. To add one: add the flag to store/useSettingsStore.ts,
 *     append its `ALTER TABLE` + back-fill to lib/db.ts's migrations array, add a
 *     `config.features.*` entry in BOTH languages, add a line to `FEATURE_ROWS`, list it in
 *     app/onboarding/features.tsx, and gate the surface it owns at its call site. Only add a
 *     flag for something ADDITIVE — if the app misbehaves with it off, it does not get a toggle.
 */
import React, { useState } from 'react';
import { Linking, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import SectionDivider from '@/components/SectionDivider';
import ExpandableCard from '@/components/ExpandableCard';
import { Input, Switch as FormSwitch, SegmentedControl } from '@/components/FormControls';
import { showAppModal } from '@/components/AppModal';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import PressableScale from '@/components/PressableScale';
import Stepper from '@/components/Stepper';
import {
  useSettingsStore,
  Settings,
  FontSizePref,
  DarkMode,
  EnergyMode,
} from '@/store/useSettingsStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import { useFeedbackStore } from '@/store/useFeedbackStore';
import { syncReminders } from '@/lib/reminders';
import { syncNotificationCategories } from '@/lib/notifications';
import { syncWidgetsAndOverview } from '@/lib/widgets/sync';
import { seedFreyrMode, unseedFreyrMode, parseFreyrSeedIds } from '@/lib/freyrModeSeed';
import { exportBackup, exportBackupToDevice, pickAndParseBackup, restoreBackup, reloadApp, saveAutoBackup, chooseAutoBackupLocation } from '@/lib/backup';
import { isSyncAvailable } from '@/lib/syncService';
import { buildFeedbackMailUrl } from '@/lib/feedbackMail';
import { useT, getTranslations } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { getDomainColor } from '@/lib/domainColor';
import { selection, warning, heavy } from '@/lib/haptics';
import { AspectRatioKey, FontSize, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import TabSlider from '@/components/TabSlider';

type SettingsTab = 'general' | 'personal' | 'advanced';
const TAB_BAR_HEIGHT = 48;

/**
 * The plain on/off feature opt-ins rendered by Advanced → Features. Each `key` is a
 * boolean on Settings that gates a purely ADDITIVE surface — see the per-field docs in
 * store/useSettingsStore.ts for what each one hides, and lib/db.ts for the migration
 * that leaves them off on fresh installs but on for existing users.
 *
 * `copy` takes the translations object rather than a resolved string because this array
 * is module-level (evaluated once) while `useT()` re-runs on every language change —
 * resolving here would freeze the labels in whatever language loaded first.
 *
 * The Energy system is deliberately NOT in this list: it's the one feature flag with its
 * own configuration (mode + capacities), so it's rendered by hand above these rows.
 * app/onboarding/features.tsx offers the same set during onboarding.
 */
type FeatureFlagKey = 'featureGoals' | 'featureSharing' | 'featureScan' | 'featureFood' | 'featureAutomations';
const FEATURE_ROWS: { key: FeatureFlagKey; copy: (t: ReturnType<typeof useT>) => { label: string; hint: string } }[] = [
  { key: 'featureGoals', copy: (t) => t.config.features.goals },
  { key: 'featureSharing', copy: (t) => t.config.features.sharing },
  { key: 'featureScan', copy: (t) => t.config.features.scan },
  { key: 'featureFood', copy: (t) => t.config.features.food },
  { key: 'featureAutomations', copy: (t) => t.config.features.automations },
];

/** Format an ISO auto-backup timestamp as "YYYY-MM-DD HH:MM" (local time). */
function formatBackupTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const syncTaskNotifs = useTaskStore((s) => s.syncAllTaskNotifications);
  const syncTaskCalendarEvents = useTaskStore((s) => s.syncAllTaskCalendarEvents);
  const syncHabitNotifs = useHabitStore((s) => s.syncAllHabitReminders);
  const clearTasks = useTaskStore((s) => s.clearAll);
  const feedbackNoteCount = useFeedbackStore((s) => s.notes.length);
  const clearFeedbackNotes = useFeedbackStore((s) => s.clearAll);
  const monthlyReset = useShoppingStore((s) => s.monthlyReset);
  const syncAvailable = isSyncAvailable();

  const [tab, setTab] = useState<SettingsTab>('general');
  const [name, setName] = useState(settings.userName);
  const [accountNameInput, setAccountNameInput] = useState(settings.accountName);
  const [monthlyDateInput, setMonthlyDateInput] = useState(String(settings.monthlyResetDate));
  // Send Feedback (2026-07-13) — free-text composer, mailed via mailto:.
  const [feedbackText, setFeedbackText] = useState('');
  const [newChildName, setNewChildName] = useState('');
  const [inputWarning, setInputWarning] = useState<string | null>(null);

  // People / family mode — profile management (moved here from the Health screen so
  // Tasks + Habits share one list). Adds/removes entries in settings.childProfiles.
  function addProfile() {
    const nm = newChildName.trim();
    if (!nm || settings.childProfiles.includes(nm)) { setNewChildName(''); return; }
    selection();
    settings.update({ childProfiles: [...settings.childProfiles, nm] });
    setNewChildName('');
  }
  function removeProfile(nm: string) {
    warning();
    showAppModal(t.peopleMode.removeTitle(nm), t.peopleMode.removeBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.resetConfirmBtn, style: 'destructive',
        onPress: () => { heavy(); settings.update({ childProfiles: settings.childProfiles.filter((c) => c !== nm) }); },
      },
    ]);
  }

  // Freyr-mode toggle — on: seed a starter set of rows and remember exactly which
  // ids it created; off: remove only those ids (never anything the user added).
  function handleToggleFreyrMode(v: boolean) {
    selection();
    if (v) {
      const ids = seedFreyrMode();
      settings.update({ freyrModeEnabled: true, freyrSeedIds: JSON.stringify(ids) });
    } else {
      unseedFreyrMode(parseFreyrSeedIds(settings.freyrSeedIds));
      settings.update({ freyrModeEnabled: false, freyrSeedIds: '' });
    }
    // Seeding/unseeding mutates today's tasks + shopping — refresh the home-screen
    // widgets + persistent overview immediately, rather than waiting for the next
    // app foreground/background sync (otherwise the widget shows stale/empty content).
    void syncWidgetsAndOverview();
  }

  // Manually check the EAS preview channel for a newer OTA, fetch it, and reload.
  // In debug builds Updates.isEnabled is false (expo-updates is off), so this
  // reports that OTA is unavailable rather than silently doing nothing.
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  // isUpdatePending: an update already finished downloading (expo-updates auto-downloads on
  // launch but applies only on the next cold start) and is waiting for a reload. Without this
  // branch, checkForUpdateAsync returns isAvailable:false for it and we'd wrongly report
  // "up to date" while the app is still running the old bundle.
  const { isUpdatePending } = Updates.useUpdates();
  async function handleCheckUpdates() {
    if (!Updates.isEnabled) {
      showAppModal(t.version.title, t.version.disabled);
      return;
    }
    setCheckingUpdate(true);
    try {
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        await Updates.fetchUpdateAsync();
        showAppModal(t.version.title, t.version.downloaded);
        await Updates.reloadAsync();
      } else if (isUpdatePending) {
        // Newest update already downloaded on a prior launch — just apply it.
        showAppModal(t.version.title, t.version.downloaded);
        await Updates.reloadAsync();
      } else {
        showAppModal(t.version.title, t.version.upToDate);
      }
    } catch {
      showAppModal(t.version.title, t.version.failed);
    } finally {
      setCheckingUpdate(false);
    }
  }

  const TABS: { key: SettingsTab; label: string }[] = [
    { key: 'general', label: t.config.tabs.general },
    { key: 'personal', label: t.config.tabs.personal },
    { key: 'advanced', label: t.config.tabs.advanced },
  ];

  const DAY_LABELS = t.dayFull;

  // Version / update diagnostics (expo-updates + expo-constants). All are plain
  // module constants for the running JS, so reading them at render is cheap.
  const appVersion = Constants.expoConfig?.version ?? '—';
  const runtimeVersion = String(Updates.runtimeVersion ?? '—');
  const updateChannel = Updates.channel ?? '—';
  const runningEmbedded = Updates.isEmbeddedLaunch;
  const updateSource = runningEmbedded ? t.version.sourceEmbedded : t.version.sourceOta;
  const updateIdShort = Updates.updateId ? Updates.updateId.slice(0, 8) : t.version.embedded;
  const updatePublished = Updates.createdAt ? Updates.createdAt.toLocaleString() : '—';

  function applyAndSync(patch: Partial<Settings>) {
    settings.update(patch);
    const keys = Object.keys(patch);
    if (keys.some((k) => ['remindersEnabled', 'reminderTime', 'weeklyResetDay', 'monthlyResetDate', 'language'].includes(k))) {
      void syncReminders();
    }
    if (keys.some((k) => ['taskNotificationsEnabled', 'language', 'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd'].includes(k))) {
      syncTaskNotifs();
    }
    if (keys.includes('calendarSyncEnabled')) {
      syncTaskCalendarEvents();
    }
    if (keys.includes('language') || keys.includes('habitNotificationsEnabled')) {
      syncHabitNotifs();
      if (keys.includes('language')) {
        const tNew = getTranslations(useSettingsStore.getState().language);
        void syncNotificationCategories(tNew.notif.actionDone, tNew.notif.actionRemindLater);
      }
    }
  }

  function confirmReset(label: string, action: () => void) {
    warning();
    showAppModal(
      t.resetConfirmTitle(label),
      t.resetConfirmBody,
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.resetConfirmBtn, style: 'destructive', onPress: () => { heavy(); action(); } },
      ]
    );
  }

  // Send Feedback (2026-07-13) — mailto: via Linking, falling back to the OS
  // share sheet if no mail client is configured on this device.
  async function handleSendFeedback() {
    selection();
    const url = buildFeedbackMailUrl(
      feedbackText,
      { appVersion, runtimeVersion, platform: Platform.OS, osVersion: Platform.Version },
      'Unfocus@hlynsson.no',
      t.feedback.subject,
    );
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      setFeedbackText('');
      return;
    }
    try {
      await Share.share({ message: feedbackText.trim() });
      setFeedbackText('');
    } catch {
      showAppModal(t.feedback.cardTitle, t.feedback.mailUnavailable);
    }
  }

  // Local backup & restore (Decision 036) — device-only, no upload.
  async function handleSaveToDevice() {
    selection();
    try {
      const result = await exportBackupToDevice();
      if (result.status === 'saved') {
        showAppModal(t.backup.title, t.backup.savedToDevice(result.location));
      } else if (result.status === 'unavailable') {
        showAppModal(t.backup.title, t.backup.saveUnavailable);
      }
      // 'canceled' → no modal
    } catch {
      showAppModal(t.backup.title, t.backup.exportError);
    }
  }

  async function handleExport() {
    selection();
    try {
      const result = await exportBackup();
      if (result === 'unavailable') {
        showAppModal(t.backup.title, t.backup.sharingUnavailable);
      }
    } catch {
      showAppModal(t.backup.title, t.backup.exportError);
    }
  }

  // Local account (Decision 039) — create a device-only profile. No server, no
  // credentials: this only stamps a name + creation date into the settings row,
  // which the local backup file already carries.
  function handleCreateAccount() {
    selection();
    const nm = (accountNameInput || settings.userName).trim();
    setAccountNameInput(nm);
    applyAndSync({ accountName: nm, accountCreated: todayStr() });
  }

  // Auto-backup: enabling it first asks the user WHERE the single self-updating
  // backup file should live (Android SAF folder pick; iOS uses a fixed Files
  // location). Backing out of the picker leaves auto-backup off, so the toggle
  // never claims to protect data it can't actually reach.
  async function handleAutoBackupToggle(v: boolean) {
    selection();
    if (!v) {
      applyAndSync({ autoBackupEnabled: false });
      return;
    }
    try {
      const loc = await chooseAutoBackupLocation();
      if (!loc) {
        showAppModal(t.backup.title, t.config.autoBackup.locationCanceled);
        return;
      }
      applyAndSync({ autoBackupEnabled: true, autoBackupUri: loc.uri, autoBackupLabel: loc.label });
      void saveAutoBackup();
    } catch {
      showAppModal(t.backup.title, t.backup.exportError);
    }
  }

  // Force an immediate auto-backup write. saveAutoBackup() is best-effort/silent,
  // so confirm success by checking whether it stamped a fresh autoBackupLastAt.
  async function handleBackupNow() {
    selection();
    // Android installs that had auto-backup on before the persistent-location
    // change have no folder yet — pick one first (a no-op write otherwise).
    if (Platform.OS === 'android' && !settings.autoBackupUri) {
      await handleAutoBackupToggle(true);
      return;
    }
    const before = useSettingsStore.getState().autoBackupLastAt;
    await saveAutoBackup();
    const after = useSettingsStore.getState().autoBackupLastAt;
    showAppModal(t.backup.title, after !== before ? t.config.autoBackup.backedUpNow : t.backup.exportError);
  }

  async function handleImport() {
    selection();
    const parsed = await pickAndParseBackup();
    if (parsed.status === 'canceled') return;
    if (parsed.status === 'invalid') {
      showAppModal(t.backup.title, t.backup.invalidFile);
      return;
    }
    if (parsed.status === 'tooNew') {
      showAppModal(t.backup.title, t.backup.tooNew);
      return;
    }
    warning();
    showAppModal(t.backup.importConfirmTitle, t.backup.importConfirmBody(parsed.rowCount), [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.backup.importConfirmBtn,
        style: 'destructive',
        onPress: () => {
          heavy();
          try {
            restoreBackup(parsed.data);
          } catch {
            showAppModal(t.backup.title, t.backup.restoreError);
            return;
          }
          showAppModal(t.backup.title, t.backup.restoreDone, [
            { text: t.ok, onPress: () => { void reloadApp(); } },
          ]);
        },
      },
    ]);
  }

  const tabBar = (
    // No outer glass card (removed 2026-07-24): TabSlider already draws its own bordered/
    // filled track, so wrapping it in a second Surface card stacked a third layer (outer
    // card + TabSlider's own box + the sliding pill) that read as nested boxes. TabSlider
    // now floats directly, styled with the same side margins as ScreenHeader's own card.
    <TabSlider
      value={tab}
      onChange={setTab}
      options={TABS.map((tb) => ({ value: tb.key, label: tb.label }))}
      radius={Radius.md}
      style={styles.tabsGlass}
    />
  );

  return (
    <>
    <ScreenScaffold
      title={t.settingsTitle}
      tier="sub"
      onBack={() => router.back()}
      // Transparent, not theme.surface: the header now floats with transparent gaps around
      // its rounded card (2026-07-23 pass) showing ScreenBackground through — an opaque
      // filler here read as a mismatched solid box sitting under a floating card. Matching
      // the header's own treatment removes that artifact.
      stickyGapColor="transparent"
      stickyBelowHeader={tabBar}
      stickyBelowHeaderHeight={TAB_BAR_HEIGHT}
    >
      <View style={styles.content}>
        {tab === 'general' && (
          <>
            {/* PROFIL / UTSEENDE / TILGJENGELIGHET — one panel (2026-07-13 layering pass:
                these three used to be three separate floating Surface cards; merged into
                one shared Surface with ExpandableCard rows, matching the grouping pattern
                ExpandableCard's own header already documents — see its "Decision 043 rule 1"
                note). */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <ExpandableCard title={t.sectionProfile} accentColor={theme.accent} first rounded>
                  <Input
                    label={t.yourName}
                    value={name}
                    onChangeText={(v) => setName(v)}
                    onBlur={() => applyAndSync({ userName: name })}
                    placeholder={t.namePlaceholder}
                    returnKeyType="done"
                  />
                  <Text style={[styles.descText, { color: theme.textMuted }]}>{t.config.desc.name}</Text>

                  <View style={[styles.divider, { backgroundColor: theme.border }]} />

                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.sectionLanguage}</Text>
                  <View style={styles.langRow}>
                    {(['no', 'en'] as const).map((lang) => (
                      <PressableScale
                        key={lang}
                        style={[
                          styles.langChip,
                          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                          settings.language === lang && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}
                        onPress={() => applyAndSync({ language: lang })}
                        scaleTo={0.97}
                      >
                        <Text style={styles.langFlag}>{lang === 'no' ? '🇳🇴' : '🇬🇧'}</Text>
                        <Text style={[
                          styles.langText,
                          { color: theme.text },
                          settings.language === lang && { color: theme.accentInk },
                        ]}>
                          {lang === 'no' ? t.norwegian : t.english}
                        </Text>
                      </PressableScale>
                    ))}
                  </View>
                  <Text style={[styles.descText, { color: theme.textMuted }]}>{t.config.desc.language}</Text>
                </ExpandableCard>

                {/* UTSEENDE — merged into the same panel as Profil/Tilgjengelighet
                    (2026-07-13 layering pass: fewer separate floating cards). */}
                <ExpandableCard title={t.config.sections.appearance} accentColor={theme.accent} rounded>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.lightDarkModeLabel}</Text>
                  <SegmentedControl
                    value={settings.darkMode}
                    onChange={(v) => settings.update({ darkMode: v as DarkMode })}
                    options={[
                      { value: 'off', label: t.darkModeOff },
                      { value: 'system', label: t.darkModeSystem },
                      { value: 'on', label: t.darkModeOn },
                    ]}
                  />
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.settings.photoFormat.title}</Text>
                  <SegmentedControl
                    value={settings.photoAspectRatio}
                    onChange={(v) => settings.update({ photoAspectRatio: v as AspectRatioKey })}
                    options={[
                      { value: 'fit', label: t.settings.photoFormat.fit },
                      { value: 'square', label: t.settings.photoFormat.square },
                      { value: 'classic', label: t.settings.photoFormat.classic },
                      { value: 'widescreen', label: t.settings.photoFormat.widescreen },
                      { value: 'golden', label: t.settings.photoFormat.golden },
                    ]}
                  />
                  <Text style={[styles.descText, { color: theme.textMuted }]}>{t.settings.photoFormat.hint}</Text>
                </ExpandableCard>

                {/* TILGJENGELIGHET — same merged panel. */}
                <ExpandableCard title={t.settings.accessibility.title} accentColor={theme.accent} rounded>
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.accessibility.reducedMotion}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.settings.accessibility.reducedMotionHint}</Text>
                    </View>
                    <FormSwitch checked={settings.reducedMotion} onChange={(v) => settings.update({ reducedMotion: v })} />
                  </View>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.accessibility.particles}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.settings.accessibility.particlesHint}</Text>
                    </View>
                    <FormSwitch checked={settings.particlesEnabled} onChange={(v) => settings.update({ particlesEnabled: v })} />
                  </View>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.accessibility.glassSurfaces}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.settings.accessibility.glassSurfacesHint}</Text>
                    </View>
                    <FormSwitch checked={settings.glassSurfaces} onChange={(v) => settings.update({ glassSurfaces: v })} />
                  </View>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.settings.accessibility.fontSize}</Text>
                  <SegmentedControl
                    value={settings.fontSize}
                    onChange={(v) => settings.update({ fontSize: v as FontSizePref })}
                    options={[
                      { value: 'small', label: t.settings.accessibility.fontSizeSmall },
                      { value: 'default', label: t.settings.accessibility.fontSizeDefault },
                      { value: 'large', label: t.settings.accessibility.fontSizeLarge },
                    ]}
                  />
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.accessibility.leftHanded}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.settings.accessibility.leftHandedHint}</Text>
                    </View>
                    <FormSwitch checked={settings.leftHanded} onChange={(v) => settings.update({ leftHanded: v })} />
                  </View>
                  {/* The horizontal-plans-timeline switch used to sit here; it moved to
                      Personal → Layout in the 2026-07-25 reorganization. It's a taste
                      preference about how the Plans rail is drawn, not an accessibility
                      aid, and keeping it here made this card read as a grab bag. */}
                </ExpandableCard>
              </Surface>
            </View>

            {/* ===== DATA ===== */}
            {/* marginVertical:0 — content's own `gap:Spacing.lg` already spaces this from its
                neighbors; the divider's default margin on top of that gap doubled the blank
                band here (2026-07-23 fix). */}
            <SectionDivider style={{ marginVertical: 0 }} />
            {/* Neutral (not danger-red): this group leads with the non-destructive Send
                Feedback + debug cards; the genuinely destructive resets deeper in the group
                keep their own red styling (dangerBtnText/theme.bad + badSoft card border). */}
            <Text style={[styles.groupHeader, { color: theme.text, marginTop: 0 }]}>{t.config.sections.data}</Text>

            {/* Send Feedback (2026-07-13) — always visible, not gated on debug mode.
                Free-text composer → mailto: via Linking, falling back to the OS share
                sheet if no mail client is configured. Separate from the debug-notes
                export below, which is a testers' anchor-note tool. */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <Text style={[styles.switchLabel, { color: theme.text }]}>{t.feedback.cardTitle}</Text>
                <Text style={[styles.descText, { color: theme.textMuted, marginTop: Spacing.xs }]}>{t.feedback.cardDesc}</Text>
                <View style={{ marginTop: Spacing.sm }}>
                  <Input
                    value={feedbackText}
                    onChangeText={setFeedbackText}
                    placeholder={t.feedback.placeholder}
                    multiline
                    numberOfLines={4}
                  />
                </View>
                <PressableScale
                  style={[styles.dangerBtn, feedbackText.trim() === '' && { opacity: 0.4 }]}
                  onPress={handleSendFeedback}
                  disabled={feedbackText.trim() === ''}
                  scaleTo={0.97}
                >
                  <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.feedback.sendButton}</Text>
                </PressableScale>
              </Surface>
            </View>

            {/* Debug mode moved to Advanced, and Device features to Personal
                (2026-07-25 reorganization) — this group is now just Send Feedback plus
                the account/backup/version panel and the destructive resets. */}

            {/* Local account / LAN sync / Version & updates — one panel (2026-07-13
                layering pass: these three used to each float in their own Surface card).
                Decision 039: device-only, user-held profile. No server, no credentials;
                the account rides along in the local backup file below. */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <ExpandableCard title={t.account.title} accentColor={theme.accent} first rounded>
                  <Text style={[styles.descText, { color: theme.textMuted, marginTop: 0, marginBottom: Spacing.sm }]}>
                    {settings.accountCreated ? t.account.descActive : t.account.descNone}
                  </Text>
                  <Input
                    label={t.account.nameLabel}
                    value={accountNameInput}
                    onChangeText={setAccountNameInput}
                    onBlur={() => { if (settings.accountCreated) applyAndSync({ accountName: accountNameInput.trim() }); }}
                    placeholder={t.account.namePlaceholder}
                    returnKeyType="done"
                  />
                  {settings.accountCreated ? (
                    <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.account.createdOn(settings.accountCreated)}</Text>
                  ) : (
                    <PressableScale style={styles.dangerBtn} onPress={handleCreateAccount} scaleTo={0.97}>
                      <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.account.createButton}</Text>
                    </PressableScale>
                  )}
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  {/* Auto-backup toggle */}
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.config.autoBackup.label}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.config.autoBackup.hint}</Text>
                    </View>
                    <FormSwitch
                      checked={settings.autoBackupEnabled}
                      onChange={(v) => { void handleAutoBackupToggle(v); }}
                    />
                  </View>
                  {settings.autoBackupEnabled && (
                    <>
                      <Text style={[styles.descText, { color: theme.textMuted, marginTop: Spacing.xs, marginBottom: 0 }]}>
                        {t.config.autoBackup.pathLabel} {settings.autoBackupLabel || t.config.autoBackup.locationUnknown}
                      </Text>
                      <Text style={[styles.descText, { color: theme.textMuted, marginTop: Spacing.xs, marginBottom: 0 }]}>
                        {settings.autoBackupLastAt
                          ? t.config.autoBackup.lastBackedUp(formatBackupTime(settings.autoBackupLastAt))
                          : t.config.autoBackup.never}
                      </Text>
                      <PressableScale style={[styles.dangerBtn, { marginTop: Spacing.xs }]} onPress={handleBackupNow} scaleTo={0.97}>
                        <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.config.autoBackup.backUpNow}</Text>
                      </PressableScale>
                    </>
                  )}
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale style={styles.dangerBtn} onPress={handleSaveToDevice} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.backup.saveToDevice}</Text>
                  </PressableScale>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale style={styles.dangerBtn} onPress={handleExport} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.backup.shareCopy}</Text>
                  </PressableScale>
                  <Text style={[styles.descText, { color: theme.textMuted, marginTop: Spacing.xs, marginBottom: 0 }]}>
                    {t.config.autoBackup.shareNote}
                  </Text>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale style={styles.dangerBtn} onPress={handleImport} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.account.restoreButton}</Text>
                  </PressableScale>
                  <Text style={[styles.descText, { color: theme.textMuted, marginBottom: 0 }]}>{t.account.deviceOnlyNote}</Text>
                </ExpandableCard>

                {/* LAN live sync moved to the Advanced tab (2026-07-25) — pairing a second
                    device is a power-user setup step, not part of "your data lives here". */}

                {/* Version & updates — lets the user see exactly which build/OTA is
                    running and force an OTA check. Runtime + updateId here are the
                    fastest way to diagnose "I haven't received the update". */}
                <ExpandableCard title={t.version.title} accentColor={theme.accent} rounded>
                  {[
                    [t.version.appVersion, appVersion],
                    [t.version.runtime, runtimeVersion],
                    [t.version.channel, updateChannel],
                    [t.version.source, updateSource],
                    [t.version.updateId, updateIdShort],
                    [t.version.published, updatePublished],
                  ].map(([label, value], i) => (
                    <View key={label} style={[styles.switchRow, i > 0 && { marginTop: Spacing.sm }]}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{label}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]} selectable>{value}</Text>
                    </View>
                  ))}
                  {!Updates.isEnabled && (
                    <Text style={[styles.descText, { color: theme.warn, marginBottom: Spacing.sm }]}>
                      {t.version.disabled}
                    </Text>
                  )}
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale style={styles.dangerBtn} onPress={handleCheckUpdates} disabled={checkingUpdate} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>
                      {checkingUpdate ? t.version.checking : t.version.checkButton}
                    </Text>
                  </PressableScale>
                </ExpandableCard>
              </Surface>
            </View>

            {/* Reset data — kept as its own red-bordered card (not folded into the merged
                panel above) so the destructive action stays visually distinct; moved to the
                end of the tab as a "danger zone at the bottom" (2026-07-13 layering pass). */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderWidth: 1, borderColor: theme.badSoft }]}>
                <ExpandableCard title={t.sectionReset} accentColor={theme.bad} first>
                  <Text style={[styles.descText, { color: theme.bad, marginBottom: Spacing.sm, marginTop: 0 }]}>{t.config.desc.dataNote}</Text>
                  <PressableScale style={styles.dangerBtn} onPress={() => confirmReset(t.resetMonthly.toLowerCase(), monthlyReset)} scaleTo={0.93}>
                    <Text style={[styles.dangerBtnText, { color: theme.bad }]}>{t.resetMonthly}</Text>
                  </PressableScale>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale style={styles.dangerBtn} onPress={() => confirmReset(t.resetTasks.toLowerCase(), clearTasks)} scaleTo={0.93}>
                    <Text style={[styles.dangerBtnText, { color: theme.bad }]}>{t.resetTasks}</Text>
                  </PressableScale>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <PressableScale
                    style={styles.dangerBtn}
                    onPress={() =>
                      confirmReset(t.resetOnboarding.toLowerCase(), () => {
                        settings.update({ setupComplete: false });
                        router.replace('/onboarding/language');
                      })
                    }
                    scaleTo={0.93}
                  >
                    <Text style={[styles.dangerBtnText, { color: theme.bad }]}>{t.resetOnboarding}</Text>
                  </PressableScale>
                </ExpandableCard>
              </Surface>
            </View>
          </>
        )}

        {tab === 'personal' && (
          <>
            {/* PERSONAL (2026-07-25 reorganization) — the "how do you want it to behave"
                settings, gathered from the old Varsler + Handle tabs plus two groups that
                were stranded elsewhere. Notifications lead because they're what a user
                actually comes here to change; Layout and Device features are rarer taste /
                permission choices and sit below. */}
            {/* UKENTLIG / GENERELLE — one panel (2026-07-13 layering pass: these two used
                to each float in their own Surface card). */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <ExpandableCard title={t.weeklyReminders} accentColor={theme.accent} first rounded>
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.weeklyReminders}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.config.desc.weeklyReminders}</Text>
                    </View>
                    <FormSwitch checked={settings.remindersEnabled} onChange={(v) => applyAndSync({ remindersEnabled: v })} />
                  </View>
                  {settings.remindersEnabled && (
                    <>
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      <Input
                        label={t.reminderTimeLabel}
                        value={settings.reminderTime}
                        onChangeText={(v) => applyAndSync({ reminderTime: v })}
                        placeholder="08:00"
                        keyboardType="numbers-and-punctuation"
                      />
                    </>
                  )}
                </ExpandableCard>

                {/* GENERELLE — same merged panel. */}
                <ExpandableCard title={t.config.sections.notifications} accentColor={theme.accent} rounded>
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.taskNotifications}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.taskNotificationsHint}</Text>
                    </View>
                    <FormSwitch
                      checked={settings.taskNotificationsEnabled}
                      onChange={(v) => applyAndSync({ taskNotificationsEnabled: v })}
                    />
                  </View>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.habitNotifications}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.habitNotificationsHint}</Text>
                    </View>
                    <FormSwitch
                      checked={settings.habitNotificationsEnabled}
                      onChange={(v) => applyAndSync({ habitNotificationsEnabled: v })}
                    />
                  </View>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.persistentNotifLabel}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.persistentNotifHint}</Text>
                    </View>
                    <FormSwitch checked={settings.persistentNotifEnabled} onChange={(v) => { settings.update({ persistentNotifEnabled: v }); void syncWidgetsAndOverview({ persistentOnly: true }); }} />
                  </View>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.quietHours.label}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.settings.quietHours.hint}</Text>
                    </View>
                    <FormSwitch checked={settings.quietHoursEnabled} onChange={(v) => applyAndSync({ quietHoursEnabled: v })} />
                  </View>
                  {settings.quietHoursEnabled && (
                    <>
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      <View style={styles.workHoursRow}>
                        <View style={styles.workHoursCol}>
                          <Input
                            label={t.workHoursFrom}
                            value={settings.quietHoursStart}
                            onChangeText={(v) => applyAndSync({ quietHoursStart: v })}
                            placeholder="21:00"
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                        <View style={styles.workHoursCol}>
                          <Input
                            label={t.workHoursTo}
                            value={settings.quietHoursEnd}
                            onChangeText={(v) => applyAndSync({ quietHoursEnd: v })}
                            placeholder="08:00"
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                      </View>
                    </>
                  )}
                </ExpandableCard>
              </Surface>
            </View>
            {/* SHOPPING — the whole of the old Handle tab, which only ever held these two
                settings and did not justify a tab of its own. */}
          <View style={styles.section}>
            <Surface style={[styles.card, { borderColor: theme.border }]}>
              <ExpandableCard title={t.sectionShopping} accentColor={getDomainColor(theme, 'shop').accent} first>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.weeklyResetDay}</Text>
                <View style={styles.dayRow}>
                  {DAY_LABELS.map((label, i) => (
                    <PressableScale
                      key={i}
                      style={[
                        styles.dayChip,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                        settings.weeklyResetDay === i && { backgroundColor: theme.accent, borderColor: theme.accent },
                      ]}
                      onPress={() => applyAndSync({ weeklyResetDay: i })}
                      scaleTo={0.97}
                    >
                      <Text style={[
                        styles.dayText,
                        { color: theme.text },
                        settings.weeklyResetDay === i && { color: theme.accentInk },
                      ]}>
                        {label.slice(0, 3)}
                      </Text>
                    </PressableScale>
                  ))}
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <Input
                  label={t.monthlyResetDate}
                  value={monthlyDateInput}
                  onChangeText={setMonthlyDateInput}
                  onBlur={() => {
                    const n = parseInt(monthlyDateInput, 10);
                    if (!isNaN(n) && n >= 1 && n <= 31) {
                      applyAndSync({ monthlyResetDate: n });
                    } else {
                      setMonthlyDateInput(String(settings.monthlyResetDate));
                      setInputWarning(t.invalidMonthlyDateMsg);
                    }
                  }}
                  keyboardType="number-pad"
                  placeholder="1–31"
                  maxLength={2}
                />
                <Text style={[styles.paydayHint, { color: theme.textMuted }]}>{t.monthlyDateInputHint}</Text>
              </ExpandableCard>
            </Surface>
          </View>
            {/* LAYOUT — taste preferences about how things are drawn. Currently just the
                Plans rail orientation, moved out of General → Accessibility (2026-07-25),
                where it read as an accessibility aid rather than the preference it is. */}
            <View style={styles.section}>
              <Text style={[styles.groupHeader, { color: theme.text, marginTop: 0 }]}>{t.config.sections.layout}</Text>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.accessibility.timelineHorizontal}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.settings.accessibility.timelineHorizontalHint}</Text>
                  </View>
                  <FormSwitch checked={settings.planTimelineHorizontal} onChange={(v) => settings.update({ planTimelineHorizontal: v })} />
                </View>
              </Surface>
            </View>

            {/* Device features (2026-07-17, moved here from the General tab 2026-07-25) —
                toggles for the reserve-only native surface: voice dictation (title mic),
                contacts (attach-to-task), location (tag-with-my-location), calendar (mirror
                timed tasks). All four default off; each gates its own editor/store wiring —
                see components/TaskCard.tsx and store/useTaskStore.ts. Calendar goes through
                applyAndSync so toggling it immediately re-syncs every eligible task; the
                other three are read directly by TaskCard at render time, no background job
                to kick. */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <Text style={[styles.groupHeader, { color: theme.text, marginTop: 0 }]}>{t.permissions.sectionTitle}</Text>
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.permissions.voiceNotes.label}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.permissions.voiceNotes.hint}</Text>
                  </View>
                  <FormSwitch
                    checked={settings.voiceNotesEnabled}
                    onChange={(v) => { selection(); settings.update({ voiceNotesEnabled: v }); }}
                  />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.permissions.contacts.label}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.permissions.contacts.hint}</Text>
                  </View>
                  <FormSwitch
                    checked={settings.contactsEnabled}
                    onChange={(v) => { selection(); settings.update({ contactsEnabled: v }); }}
                  />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.permissions.location.label}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.permissions.location.hint}</Text>
                  </View>
                  <FormSwitch
                    checked={settings.locationEnabled}
                    onChange={(v) => { selection(); settings.update({ locationEnabled: v }); }}
                  />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.permissions.calendar.label}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.permissions.calendar.hint}</Text>
                  </View>
                  <FormSwitch
                    checked={settings.calendarSyncEnabled}
                    onChange={(v) => { selection(); applyAndSync({ calendarSyncEnabled: v }); }}
                  />
                </View>
              </Surface>
            </View>
          </>
        )}

        {tab === 'advanced' && (
          <>
            {/* FEATURES (2026-07-25 reorganization) — the opt-in switches for everything
                that isn't part of the basics. Every flag here hides a purely ADDITIVE
                surface: turning one off never breaks app logic, which is exactly why
                these got a toggle and things like data pruning, widget/overview sync or
                catalog seeding deliberately did not. All are off on a fresh install (so a
                first-time user meets the basics first) and were back-filled to on for
                existing users — see the `WHERE setup_complete = 1` migration in lib/db.ts.
                The same list is offered during onboarding by app/onboarding/features.tsx. */}
            <View style={styles.section}>
              <Text style={[styles.groupHeader, { color: theme.text, marginTop: 0 }]}>{t.config.sections.features}</Text>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <Text style={[styles.descText, { color: theme.textMuted, marginTop: 0 }]}>{t.config.features.intro}</Text>

                {/* Energy system leads: it predates this card and is the only feature flag
                    with its own configuration, so it keeps the mode/capacity controls it
                    reveals when on. (Was the first card on the old Generelt tab.) */}
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.energy.label}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.settings.energy.hint}</Text>
                  </View>
                  <FormSwitch
                    checked={settings.energySystemEnabled}
                    onChange={(v) => { selection(); settings.update({ energySystemEnabled: v }); }}
                  />
                </View>
                {settings.energySystemEnabled && (
                  <View style={styles.energyCapacityRows}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.settings.energy.modeLabel}</Text>
                    <SegmentedControl
                      value={settings.energyMode}
                      onChange={(v) => settings.update({ energyMode: v as EnergyMode })}
                      options={[
                        { value: 'daily', label: t.settings.energy.modeDaily },
                        { value: 'weekly', label: t.settings.energy.modeWeekly },
                        { value: 'custom', label: t.settings.energy.modeCustom },
                      ]}
                    />
                    {settings.energyMode === 'daily' && (
                      <View style={styles.energyCapacityRow}>
                        <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.energy.dailyCapacity}</Text>
                        <Stepper
                          value={settings.energyDailyCapacity}
                          onChange={(n) => settings.update({ energyDailyCapacity: n })}
                          min={0}
                        />
                      </View>
                    )}
                    {settings.energyMode === 'weekly' && (
                      <View style={styles.energyCapacityRow}>
                        <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.energy.weeklyCapacity}</Text>
                        <Stepper
                          value={settings.energyWeeklyCapacity}
                          onChange={(n) => settings.update({ energyWeeklyCapacity: n })}
                          min={0}
                        />
                      </View>
                    )}
                    {settings.energyMode === 'custom' && (
                      <>
                        <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.settings.energy.customHint}</Text>
                        {DAY_LABELS.map((label, i) => (
                          <View key={i} style={styles.energyCapacityRow}>
                            <Text style={[styles.switchLabel, { color: theme.text }]}>{label}</Text>
                            <Stepper
                              value={settings.energyCustomCapacities[i]}
                              onChange={(n) => {
                                const next = [...settings.energyCustomCapacities];
                                next[i] = n;
                                settings.update({ energyCustomCapacities: next });
                              }}
                              min={0}
                            />
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}

                {/* The five plain on/off features. Driven off one list so the rows stay
                    identical — each is a bare boolean with no configuration of its own.
                    Adding a feature = add the flag (store + lib/db.ts migration), add a
                    config.features entry in both languages, add a line here, and gate the
                    surface it owns at its call site. */}
                {FEATURE_ROWS.map(({ key, copy }) => (
                  <React.Fragment key={key}>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <View style={styles.switchRow}>
                      <View style={styles.switchTextCol}>
                        <Text style={[styles.switchLabel, { color: theme.text }]}>{copy(t).label}</Text>
                        <Text style={[styles.switchHint, { color: theme.textMuted }]}>{copy(t).hint}</Text>
                      </View>
                      <FormSwitch
                        checked={settings[key]}
                        onChange={(v) => { selection(); settings.update({ [key]: v } as Partial<Settings>); }}
                      />
                    </View>
                  </React.Fragment>
                ))}

                {/* Automations' own screen — revealed right under its switch so the
                    feature and its entry point stay together. This is still the only way
                    into app/automations.tsx (it was a standalone card on the old Varsler
                    tab). Rules the user already made keep running when the flag is off;
                    only the door is hidden. */}
                {settings.featureAutomations && (
                  <>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <PressableScale style={styles.switchRow} onPress={() => router.push('/automations')} scaleTo={0.97}>
                      <View style={styles.switchTextCol}>
                        <Text style={[styles.switchLabel, { color: theme.text }]}>{t.nav.automations}</Text>
                        <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.hints.automations.text}</Text>
                      </View>
                      <Text style={[styles.switchLabel, { color: theme.accent }]}>{'→'}</Text>
                    </PressableScale>
                  </>
                )}
              </Surface>
            </View>

            {/* PERSONER/FAMILIE + PAIRED DEVICES — one panel.
                Work mode, School mode and Parent (child) mode used to live on this tab and
                were REMOVED (2026-07-25): every switch in all three wrote a settings column
                that nothing in the app ever read, so they promised behaviour that did not
                exist. The columns themselves survive (this repo never drops columns) — see
                store/useSettingsStore.ts's "Inert columns" note — so the features can be
                built later without a migration dance. lib/childLock.ts is likewise kept as
                reserve. Do not re-add UI for any of them without the behaviour behind it. */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <ExpandableCard title={t.peopleMode.label} accentColor={theme.accent} first rounded>
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.peopleMode.label}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.peopleMode.hint}</Text>
                    </View>
                    <FormSwitch
                      checked={settings.peopleModeEnabled}
                      onChange={(v) => { selection(); settings.update({ peopleModeEnabled: v }); }}
                    />
                  </View>

                  {settings.peopleModeEnabled && (
                    <>
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      <Text style={[styles.descText, { color: theme.textMuted, marginTop: 0, marginBottom: Spacing.sm }]}>{t.peopleMode.profilesHint}</Text>
                      {settings.childProfiles.length > 0 && (
                        <View style={styles.peopleChipRow}>
                          {settings.childProfiles.map((nm) => (
                            <PressableScale
                              key={nm}
                              style={[styles.peopleChip, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                              onPress={() => removeProfile(nm)}
                              accessibilityRole="button"
                              accessibilityLabel={t.peopleMode.removeTitle(nm)}
                              scaleTo={0.96}
                            >
                              <Text style={[styles.peopleChipText, { color: theme.text }]}>{nm}</Text>
                              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                            </PressableScale>
                          ))}
                        </View>
                      )}
                      <View style={styles.peopleAddRow}>
                        <View style={styles.peopleAddInput}>
                          <Input
                            value={newChildName}
                            onChangeText={setNewChildName}
                            placeholder={t.peopleMode.addPlaceholder}
                            onSubmitEditing={addProfile}
                            returnKeyType="done"
                          />
                        </View>
                        <PressableScale
                          style={[styles.peopleAddBtn, { backgroundColor: newChildName.trim() ? theme.accent : theme.surfaceMuted, borderColor: theme.border }]}
                          onPress={addProfile}
                          disabled={!newChildName.trim()}
                          accessibilityRole="button"
                          accessibilityLabel={t.peopleMode.addButton}
                          scaleTo={0.96}
                        >
                          <Ionicons name="add" size={22} color={newChildName.trim() ? theme.accentInk : theme.textMuted} />
                        </PressableScale>
                      </View>
                    </>
                  )}
                </ExpandableCard>

                {/* LAN live sync (Decision 038) — moved here from the General tab's Data
                    group (2026-07-25): pairing a second device is a power-user setup step.
                    The toggle, QR pairing wizard and paired-device list all live on
                    app/pair-device.tsx; this is just the entry point. syncAvailable
                    (lib/syncService's isSyncAvailable()) only changes the copy — the link
                    always shows, since the native transport isn't linked outside a build. */}
                <ExpandableCard title={t.peers.title} accentColor={theme.accent} rounded>
                  <Text style={[styles.descText, { color: theme.textMuted, marginTop: 0, marginBottom: Spacing.sm }]}>
                    {syncAvailable ? t.peers.settingsCardDesc : t.peers.syncUnavailable}
                  </Text>
                  <PressableScale style={styles.dangerBtn} onPress={() => router.push('/pair-device')} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.peers.manageLink}</Text>
                  </PressableScale>
                </ExpandableCard>
              </Surface>
            </View>

            {/* FREYR-MODUS — standalone single-toggle card (nothing to collapse, and its
                seed/unseed is the most side-effect-heavy switch on the screen). */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.config.freyrMode.label}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.config.freyrMode.hint}</Text>
                  </View>
                  <FormSwitch checked={settings.freyrModeEnabled} onChange={handleToggleFreyrMode} />
                </View>
              </Surface>
            </View>

            {/* DEBUG MODE — moved here from the General tab's Data group (2026-07-25).
                This is now the ONLY way to turn debug on: components/ScreenHeader.tsx's
                bug icon used to be on every site-tier header and flipped this flag from
                anywhere, which meant a brand-new user could switch on the tester
                annotation tooling by accident. That icon now only renders while debug is
                already on, as the way back out. */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.debug.toggleLabel}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.debug.toggleHint}</Text>
                  </View>
                  <FormSwitch
                    checked={settings.debugModeEnabled}
                    onChange={(v) => { selection(); settings.update({ debugModeEnabled: v }); }}
                  />
                </View>
                {settings.debugModeEnabled && (
                  <>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <Text style={[styles.descText, { color: theme.textMuted, marginTop: 0 }]}>{t.debug.howToUse}</Text>
                    <PressableScale
                      style={[styles.dangerBtn, feedbackNoteCount === 0 && { opacity: 0.4 }]}
                      onPress={() => confirmReset(t.debug.resetNotes.toLowerCase(), clearFeedbackNotes)}
                      disabled={feedbackNoteCount === 0}
                      scaleTo={0.93}
                    >
                      <Text style={[styles.dangerBtnText, { color: theme.bad }]}>{t.debug.resetNotes}</Text>
                    </PressableScale>
                  </>
                )}
                {/*
                  Placeholder — permission test buttons (lib/permissionTests.ts) mount here once
                  that utility exists. It does not exist anywhere in this repo yet (native
                  permission-testing is blocked on a dev/APK build), so nothing is wired below
                  the toggle above. Do not wire this until permissionTests.ts lands.
                */}
              </Surface>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </View>
    </ScreenScaffold>
    <ConfirmationBanner message={inputWarning} onDismiss={() => setInputWarning(null)} variant="warn" />
    </>
  );
}

const baseStyles = StyleSheet.create({
  // Was Spacing.xl (32) per Decision 043 rule 2 — read as too much dead air between cards
  // vs. every other screen's content gap (Spacing.md/lg); brought down to match (2026-07-21).
  content: { padding: Spacing.md, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  // Decision 043 rule 2 fixed anatomy: Fonts.semibold/FontSize.lg; below-spacing comes
  // from `section`'s own gap:Spacing.sm, so neither header style carries its own margin.
  // (Most former sectionTitle/tabSectionLabel headers are now ExpandableCard's own title —
  // tabSectionLabel survives for the few single-toggle cards that stayed plain, uncollapsed.)
  groupHeader: { fontFamily: Type.heading.fontFamily, fontSize: Type.heading.size, lineHeight: Math.round(Type.heading.size * Type.heading.line), marginTop: Spacing.sm },
  descText: { fontSize: FontSize.xs, marginTop: Spacing.sm, lineHeight: 18 },
  energyCapacityRows: { marginTop: Spacing.md, gap: Spacing.sm },
  energyCapacityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  // Each settings group reads as one rounded, bordered block — the whole lined-up set of
  // rows shares 4 rounded corners + a crisp 1px edge, matching Plans' "New task" card
  // (debug-note 2026-07-21). borderColor is applied inline (theme-dependent).
  card: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  fieldLabel: { fontFamily: Type.label.fontFamily, fontSize: Type.label.size, marginBottom: Spacing.xs },
  divider: { height: 1, marginVertical: Spacing.md },
  workHoursRow: { flexDirection: 'row', gap: Spacing.md },
  workHoursCol: { flex: 1 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  dayChip: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  dayText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  paydayHint: { fontSize: FontSize.xs, marginTop: Spacing.xs, fontStyle: 'italic' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchTextCol: { flex: 1, marginRight: Spacing.md },
  switchLabel: { fontSize: FontSize.md, fontFamily: Fonts.medium },
  switchHint: { fontSize: FontSize.xs, marginTop: Spacing.xs },
  dangerBtn: { paddingVertical: Spacing.sm },
  dangerBtnText: { fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
  peopleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  peopleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.full, borderWidth: 1,
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm,
  },
  peopleChipText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
  peopleAddRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  peopleAddInput: { flex: 1 },
  peopleAddBtn: {
    width: 48, height: 48, borderRadius: Radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  langRow: { flexDirection: 'row', gap: Spacing.md },
  langChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.md, justifyContent: 'center',
    borderWidth: 1,
  },
  langFlag: { fontSize: 24 },
  langText: { fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
  // Styles TabSlider directly (no wrapping card, see the 2026-07-24 tabBar edit note) —
  // side margins match ScreenHeader's own floated card (headerFloatH, Spacing.sm as of the
  // header/bottom-nav width-alignment pass) so the two read as one consistent floating-chrome
  // language; flex:1 + justifyContent:'center' fill and vertically center it within the sticky
  // strip's reserved height (TAB_BAR_HEIGHT).
  tabsGlass: { flex: 1, marginHorizontal: Spacing.sm, justifyContent: 'center' },
});
