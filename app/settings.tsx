/**
 * settings.tsx — app settings
 *
 * Tabbed settings screen (Decision 001 tier='sub') — a horizontally-scrollable tab bar
 * (Generelt | Planer | Handle | Varsler) sits directly under the header as
 * ScreenScaffold's `stickyBelowHeader`; each tab is its own scroll of cards
 * (local `tab` state, no router routes).
 *
 * - Generelt: Energy system toggle → [Profil (name + language) / Utseende (dark mode) /
 *   Tilgjengelighet (reduced motion, particles, glass surfaces, font size, left-handed,
 *   horizontal plans timeline)] one merged panel → Data group (debug mode toggle, then [Local account
 *   (Decision 039 — device-only profile: name + create date, auto-backup toggle,
 *   backup/restore via lib/backup [share excludes user name]) / LAN sync / version &
 *   updates] one merged panel, then destructive Reset data card last).
 * - Modi (Additional modes): [Jobb-modus (work mode, auto-activate + hours + work days,
 *   Norske helligdager) / Foreldremodus (child-mode, password, enter/exit) / Personer-familie]
 *   one merged panel → Skolemodus toggle → Freyr-modus toggle (seeds/unseeds a starter data
 *   set via lib/freyrModeSeed.ts).
 * - Handle: shopping list settings (weekly reset weekday, monthly reset date, monthly budget).
 * - Varsler: [Ukentlig (weekly reminder + time) / Generelle (independent plan-notifications
 *   and habit-reminders toggles, persistent daily overview, quiet hours)] one merged panel →
 *   Automatisering nav-link.
 *
 * Every setting applies immediately via applyAndSync() — no buffered/dirty save step (matches
 * hints.settings.text: "Changes apply immediately.").
 *
 * **Layering pass (2026-07-13)**: related setting groups that used to each float in their own
 * bordered/shadowed Surface card are now merged into ONE shared Surface holding several
 * `ExpandableCard` rows (Profil+Utseende+Tilgjengelighet; Local account+LAN sync+Version &
 * updates; Jobb-modus+Foreldremodus+Personer/familie; Ukentlig+Generelle) — fewer separate
 * floating "islands" reads as one cohesive panel instead of a stack of unrelated boxes. This
 * is exactly the grouping pattern ExpandableCard's own header already documents (Decision 043
 * rule 1 / WeekListCard's dish-group rows) — multiple ExpandableCards as siblings inside one
 * caller-owned Surface, each getting its own hairline top divider for separation. Destructive
 * (Reset data) and single-toggle cards with no accordion body (Energy system, Debug mode,
 * Skolemodus, Freyr-modus) stay their own standalone card — folding a warning-red destructive
 * card into a neutral panel would bury its visual distinctiveness, and a plain toggle has
 * nothing to collapse.
 *
 * Connections:
 *   Imports → components/AppModal, components/ConfirmationBanner, components/FormControls,
 *             components/ScreenScaffold, components/SectionDivider, components/Surface,
 *             components/ExpandableCard, components/PressableScale, components/TabBoxHighlight,
 *             constants/theme, lib/domainColor, lib/backup
 *             (exportBackup/exportBackupToDevice/pickAndParseBackup/restoreBackup/reloadApp/
 *             saveAutoBackup/chooseAutoBackupLocation), lib/childLock, lib/feedbackMail, lib/freyrModeSeed,
 *             lib/haptics, lib/i18n, lib/notifications, lib/reminders, lib/syncService, lib/widgets/sync
 *             (syncWidgetsAndOverview — the persistent-overview toggle refreshes/cancels it, and
 *             the Freyr-mode toggle re-syncs after seeding/unseeding today's tasks + shopping),
 *             lib/useAppTheme, store/useFeedbackStore, store/useHabitStore, store/useSettingsStore,
 *             store/useShoppingStore, store/useTaskStore
 *   Used by → Expo Router route "/settings" (linked from ScreenHeader's gear icon, tier='site')
 *   Data    → useSettingsStore (settings table; incl. energySystemEnabled/energy*Capacity, quietHours*,
 *             monthlyResetDate, taskNotificationsEnabled, habitNotificationsEnabled,
 *             persistentNotifEnabled, voiceNotesEnabled/contactsEnabled/locationEnabled/
 *             calendarSyncEnabled — the "Device features" card); reset actions touch
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
 *   - **Tab bar (2026-07-20, shared component)**: the horizontally-scrollable tab bar's
 *     active indicator is `components/TabBoxHighlight.tsx` — always renders a bordered box
 *     behind the label (white `theme.surface` fill + `theme.border` edge at rest, crossfading
 *     to a tinted `theme.accent` fill + border when active) instead of the old "box only
 *     appears when active" look, which left inactive tabs looking bare. Same shared component
 *     as app/(tabs)/shopping.tsx and app/(tabs)/plans.tsx's tab bars.
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
 *   - The Energy system (energySystemEnabled + energyDailyCapacity/energyWeeklyCapacity) is
 *     the first card on the Generelt tab; when on it reveals the default day/week capacity
 *     steppers. Per-period overrides live on the Home Energy meter (components/EnergyMeter.tsx).
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
 *     (description + link) in the Data group — the sync toggle, QR pairing wizard, and paired-
 *     devices list all live on app/pair-device.tsx. syncAvailable (lib/syncService's
 *     isSyncAvailable()) gates whether the card shows the link or an "unavailable" note, since
 *     the native transport modules aren't linked outside a real build.
 *   - **Device features card (2026-07-17)**: four toggles (voice/contacts/location/calendar)
 *     for the reserve-only native surface — all default off, so app/task-form.tsx's mic/
 *     contact/location blocks stay hidden and calendar mirroring stays inert until a user
 *     opts in here. The other three toggles were previously unreachable (fully wired in
 *     useSettingsStore but no UI anywhere) — this card is what makes them reachable.
 *   - **Card spacing (2026-07-21)**: `baseStyles.content`'s gap dropped from `Spacing.xl` (32,
 *     Decision 043 rule 2) to `Spacing.lg` (24) — it read as too much dead air between cards
 *     vs. every other screen's `Spacing.md`/`lg` content gap, per direct feedback.
 */
import React, { useState } from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
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
import { setPassword as setChildPassword, verifyPassword as verifyChildPassword } from '@/lib/childLock';
import { isSyncAvailable } from '@/lib/syncService';
import { buildFeedbackMailUrl } from '@/lib/feedbackMail';
import { useT, getTranslations } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { getDomainColor } from '@/lib/domainColor';
import { selection, warning, heavy } from '@/lib/haptics';
import { FontSize, Fonts, Radius, Spacing, Type } from '@/constants/theme';
import TabBoxHighlight from '@/components/TabBoxHighlight';

type SettingsTab = 'generelt' | 'handle' | 'varsler' | 'moduser';
const TAB_BAR_HEIGHT = 48;

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

  const [tab, setTab] = useState<SettingsTab>('generelt');
  const [name, setName] = useState(settings.userName);
  const [accountNameInput, setAccountNameInput] = useState(settings.accountName);
  const [monthlyDateInput, setMonthlyDateInput] = useState(String(settings.monthlyResetDate));
  // Send Feedback (2026-07-13) — free-text composer, mailed via mailto:.
  const [feedbackText, setFeedbackText] = useState('');
  // Child mode (Decision 038c) — local input for the parent password entry/exit.
  const [childPwInput, setChildPwInput] = useState('');
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

  // Set (or change) the parent password, then flip the persisted flag. The secret
  // itself only ever lives in expo-secure-store (lib/childLock), never in settings.
  async function handleSetChildPassword() {
    const pw = childPwInput.trim();
    if (!pw) return;
    await setChildPassword(pw);
    settings.update({ childModePasswordSet: true });
    setChildPwInput('');
    selection();
    showAppModal(t.childModeTitle, t.childModeSetPassword);
  }

  // Enter child mode. Requires a password to exist so the child can't get stuck.
  function handleEnableChildMode() {
    if (!settings.childModePasswordSet) {
      showAppModal(t.childModeTitle, t.childModeNeedPassword);
      return;
    }
    warning();
    settings.update({ childMode: true });
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

  // Exit child mode — gated by the parent password.
  async function handleExitChildMode() {
    const ok = await verifyChildPassword(childPwInput.trim());
    setChildPwInput('');
    if (!ok) {
      showAppModal(t.childModeTitle, t.childModeWrongPassword);
      return;
    }
    selection();
    settings.update({ childMode: false });
  }

  const TABS: { key: SettingsTab; label: string }[] = [
    { key: 'generelt', label: t.config.tabs.general },
    { key: 'handle', label: t.nav.shop },
    { key: 'varsler', label: t.config.tabs.notifications },
    { key: 'moduser', label: t.config.tabs.additionalModes },
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
    // Frosted-glass strip (same overlay Surface as the header): the flat backdrop reads through
    // the frost AROUND the opaque tab chips, and content scrolling behind the sticky strip blurs
    // instead of showing through raw (2026-07-20). borderRadius:0 = edge-to-edge.
    <Surface surfaceContext="overlay" style={styles.tabsGlass}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsRow}
      >
        {TABS.map((tb) => {
        const active = tab === tb.key;
        return (
          <PressableScale
            key={tb.key}
            style={styles.tabItem}
            onPress={() => setTab(tb.key)}
            scaleTo={0.97}
          >
            <TabBoxHighlight active={active} />
            <Text style={[
              styles.tabLabel,
              { color: active ? theme.accent : theme.textMuted },
              active && { fontFamily: Fonts.bold },
            ]}>
              {tb.label}
            </Text>
          </PressableScale>
        );
      })}
      </ScrollView>
    </Surface>
  );

  return (
    <>
    <ScreenScaffold
      title={t.settingsTitle}
      tier="sub"
      onBack={() => router.back()}
      stickyGapColor={theme.surface}
      stickyBelowHeader={tabBar}
      stickyBelowHeaderHeight={TAB_BAR_HEIGHT}
    >
      <View style={styles.content}>
        {tab === 'generelt' && (
          <>
            {/* Energy system — optional per-task energy budget (replaces Focus mode).
                Master toggle + default day/week capacity (revealed when on). */}
            <View style={styles.section}>
              <Surface style={styles.essentialsCard} borderColor={theme.accent}>
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.essentialsLabel, { color: theme.text }]}>{t.settings.energy.label}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.settings.energy.hint}</Text>
                  </View>
                  <FormSwitch
                    checked={settings.energySystemEnabled}
                    onChange={(v) => { selection(); settings.update({ energySystemEnabled: v }); }}
                  />
                </View>
                {settings.energySystemEnabled && (
                  <View style={styles.energyCapacityRows}>
                    <View style={styles.energyCapacityRow}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.energy.dailyCapacity}</Text>
                      <Stepper
                        value={settings.energyDailyCapacity}
                        onChange={(n) => settings.update({ energyDailyCapacity: n })}
                        min={0}
                      />
                    </View>
                    <View style={styles.energyCapacityRow}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.energy.weeklyCapacity}</Text>
                      <Stepper
                        value={settings.energyWeeklyCapacity}
                        onChange={(n) => settings.update({ energyWeeklyCapacity: n })}
                        min={0}
                      />
                    </View>
                  </View>
                )}
              </Surface>
            </View>

            {/* PROFIL / UTSEENDE / TILGJENGELIGHET — one panel (2026-07-13 layering pass:
                these three used to be three separate floating Surface cards; merged into
                one shared Surface with ExpandableCard rows, matching the grouping pattern
                ExpandableCard's own header already documents — see its "Decision 043 rule 1"
                note). */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <ExpandableCard title={t.sectionProfile} accentColor={theme.accent} first>
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
                          { backgroundColor: theme.surfaceMuted },
                          settings.language === lang && { backgroundColor: theme.accent },
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
                <ExpandableCard title={t.config.sections.appearance} accentColor={theme.accent}>
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
                </ExpandableCard>

                {/* TILGJENGELIGHET — same merged panel. */}
                <ExpandableCard title={t.settings.accessibility.title} accentColor={theme.accent}>
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
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.accessibility.timelineHorizontal}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.settings.accessibility.timelineHorizontalHint}</Text>
                    </View>
                    <FormSwitch checked={settings.planTimelineHorizontal} onChange={(v) => settings.update({ planTimelineHorizontal: v })} />
                  </View>
                </ExpandableCard>
              </Surface>
            </View>

            {/* ===== DATA ===== */}
            <SectionDivider />
            {/* Neutral (not danger-red): this group leads with the non-destructive Send
                Feedback + debug cards; the genuinely destructive resets deeper in the group
                keep their own red styling (dangerBtnText/theme.bad + badSoft card border). */}
            <Text style={[styles.groupHeader, { color: theme.text }]}>{t.config.sections.data}</Text>

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

            {/* Debug mode */}
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

            {/* Device features (2026-07-17) — Settings toggles for the reserve-only native
                surface: voice dictation (task-form mic), contacts (attach-to-task), location
                (tag-with-my-location), calendar (mirror timed tasks). All four default off;
                each gates its own task-form/store wiring — see app/task-form.tsx and
                store/useTaskStore.ts. Calendar goes through applyAndSync so toggling it
                immediately re-syncs every eligible task; the other three are read directly
                by task-form.tsx at render time, no background job to kick. */}
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

            {/* Local account / LAN sync / Version & updates — one panel (2026-07-13
                layering pass: these three used to each float in their own Surface card).
                Decision 039: device-only, user-held profile. No server, no credentials;
                the account rides along in the local backup file below. */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <ExpandableCard title={t.account.title} accentColor={theme.accent} first>
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

                {/* LAN live sync (Decision 038 app integration) — pairing lives on its own
                    screen (app/pair-device.tsx); this card is just the entry point + toggle. */}
                <ExpandableCard title={t.peers.title} accentColor={theme.accent}>
                  <Text style={[styles.descText, { color: theme.textMuted, marginTop: 0, marginBottom: Spacing.sm }]}>
                    {syncAvailable ? t.peers.settingsCardDesc : t.peers.syncUnavailable}
                  </Text>
                  <PressableScale style={styles.dangerBtn} onPress={() => router.push('/pair-device')} scaleTo={0.97}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.peers.manageLink}</Text>
                  </PressableScale>
                </ExpandableCard>

                {/* Version & updates — lets the user see exactly which build/OTA is
                    running and force an OTA check. Runtime + updateId here are the
                    fastest way to diagnose "I haven't received the update". */}
                <ExpandableCard title={t.version.title} accentColor={theme.accent}>
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

        {tab === 'moduser' && (
          <>
            {/* JOBB-MODUS stays top-level (most commonly used of these modes); FORELDREMODUS /
                PERSONER / SKOLEMODUS / FREYR-MODUS move behind an "Advanced" accordion (UX audit
                F2, 2026-07-23) — rare/power-user modes that don't need to compete with Work
                mode for first-screen attention. Was: all three (Jobb/Foreldre/Personer) as
                siblings in one panel (2026-07-13 layering pass), Skolemodus/Freyr-modus each
                their own standalone single-toggle card below. */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <ExpandableCard title={t.config.sections.workMode} accentColor={theme.accent} first>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.workModeDesc}</Text>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.workModeActive}</Text>
                    <FormSwitch checked={settings.workModeEnabled} onChange={(v) => settings.update({ workModeEnabled: v })} />
                  </View>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.autoActivate}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.autoActivateHint}</Text>
                    </View>
                    <FormSwitch checked={settings.enforceWorkHours} onChange={(v) => settings.update({ enforceWorkHours: v })} />
                  </View>
                  {settings.enforceWorkHours && (
                    <>
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      <View style={styles.workHoursRow}>
                        <View style={styles.workHoursCol}>
                          <Input
                            label={t.workHoursFrom}
                            value={settings.workHoursStart}
                            onChangeText={(v) => settings.update({ workHoursStart: v })}
                            placeholder="09:00"
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                        <View style={styles.workHoursCol}>
                          <Input
                            label={t.workHoursTo}
                            value={settings.workHoursEnd}
                            onChangeText={(v) => settings.update({ workHoursEnd: v })}
                            placeholder="17:00"
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                      </View>
                    </>
                  )}
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.workDaysLabel}</Text>
                  <View style={[styles.dayRow, styles.workDayRow]}>
                    {DAY_LABELS.map((label, i) => {
                      const active = settings.workDays.includes(i);
                      return (
                        <PressableScale
                          key={i}
                          style={[
                            styles.dayChip,
                            styles.workDayChip,
                            { backgroundColor: theme.surfaceMuted },
                            active && { backgroundColor: theme.accent },
                          ]}
                          onPress={() => {
                            const next = active
                              ? settings.workDays.filter((d) => d !== i)
                              : [...settings.workDays, i].sort();
                            settings.update({ workDays: next });
                          }}
                          scaleTo={0.97}
                        >
                          <Text style={[
                            styles.dayText,
                            { color: theme.text },
                            active && { color: theme.accentInk },
                          ]}>
                            {label.slice(0, 3)}
                          </Text>
                        </PressableScale>
                      );
                    })}
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <View style={styles.switchRow}>
                    <View style={styles.switchTextCol}>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>{t.holidaysEnabledLabel}</Text>
                      <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.holidaysHint}</Text>
                    </View>
                    <FormSwitch checked={settings.holidaysEnabled} onChange={(v) => settings.update({ holidaysEnabled: v })} />
                  </View>
                </ExpandableCard>

                {/* ADVANCED (UX audit F2, 2026-07-23) — Foreldremodus/Personer/Skolemodus/
                    Freyr-modus grouped behind one collapsed-by-default accordion, so the
                    first screen stays scannable and Work mode (kept top-level above) doesn't
                    have to compete with four rarer/power-user modes for attention. */}
                <ExpandableCard title={t.config.sections.advanced} accentColor={theme.textMuted}>
                {/* FORELDREMODUS (Parent mode / Child mode) */}
                <ExpandableCard title={t.childModeTitle} accentColor={theme.accent} first>
                  <Text style={[styles.descText, { color: theme.textMuted, marginTop: 0, marginBottom: Spacing.sm }]}>{t.childModeDesc}</Text>
                  {settings.childMode ? (
                    <>
                      <Text style={[styles.descText, { color: theme.bad, marginTop: 0, marginBottom: Spacing.sm }]}>{t.childModeLockedNotice}</Text>
                      <Input
                        value={childPwInput}
                        onChangeText={setChildPwInput}
                        secureTextEntry
                        placeholder={t.childModeEnterPassword}
                        autoCapitalize="none"
                      />
                      <PressableScale style={styles.dangerBtn} onPress={handleExitChildMode} scaleTo={0.97}>
                        <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.childModeExit}</Text>
                      </PressableScale>
                    </>
                  ) : (
                    <>
                      <Input
                        value={childPwInput}
                        onChangeText={setChildPwInput}
                        secureTextEntry
                        placeholder={t.childModeNewPassword}
                        autoCapitalize="none"
                      />
                      <PressableScale style={styles.dangerBtn} onPress={handleSetChildPassword} scaleTo={0.97}>
                        <Text style={[styles.dangerBtnText, { color: theme.accent }]}>
                          {settings.childModePasswordSet ? t.childModeChangePassword : t.childModeSetPassword}
                        </Text>
                      </PressableScale>
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      <PressableScale style={styles.dangerBtn} onPress={handleEnableChildMode} scaleTo={0.97}>
                        <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.childModeEnable}</Text>
                      </PressableScale>
                    </>
                  )}
                </ExpandableCard>

                {/* PERSONER / FAMILIE (People / family mode) — same merged panel. */}
                <ExpandableCard title={t.peopleMode.label} accentColor={theme.accent}>
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

                {/* SKOLEMODUS — single-toggle, no accordion body of its own; just a row
                    inside Advanced now (was its own standalone Surface card). */}
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.config.schoolMode.label}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.config.schoolMode.hint}</Text>
                  </View>
                  <FormSwitch
                    checked={settings.schoolModeEnabled}
                    onChange={(v) => { selection(); settings.update({ schoolModeEnabled: v }); }}
                  />
                </View>

                {/* FREYR-MODUS — same treatment as Skolemodus above. */}
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.config.freyrMode.label}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.config.freyrMode.hint}</Text>
                  </View>
                  <FormSwitch checked={settings.freyrModeEnabled} onChange={handleToggleFreyrMode} />
                </View>
                </ExpandableCard>
              </Surface>
            </View>
          </>
        )}

        {tab === 'handle' && (
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
                        { backgroundColor: theme.surfaceMuted },
                        settings.weeklyResetDay === i && { backgroundColor: theme.accent },
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
        )}

        {tab === 'varsler' && (
          <>
            {/* UKENTLIG / GENERELLE — one panel (2026-07-13 layering pass: these two used
                to each float in their own Surface card). */}
            <View style={styles.section}>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <ExpandableCard title={t.weeklyReminders} accentColor={theme.accent} first>
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
                <ExpandableCard title={t.config.sections.notifications} accentColor={theme.accent}>
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

            {/* AUTOMATISERING — the only entry point to the automations screen (Decision 036). */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.nav.automations}</Text>
              <Surface style={[styles.card, { borderColor: theme.border }]}>
                <PressableScale style={styles.switchRow} onPress={() => router.push('/automations')} scaleTo={0.97}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.nav.automations}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.hints.automations.text}</Text>
                  </View>
                  <Text style={[styles.switchLabel, { color: theme.accent }]}>{'→'}</Text>
                </PressableScale>
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
  essentialsCard: { padding: Spacing.md, borderWidth: 2 },
  essentialsLabel: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
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
  },
  workDayRow: { flexWrap: 'nowrap', gap: Spacing.xs },
  workDayChip: { flex: 1, minWidth: 0, minHeight: 36, paddingHorizontal: Spacing.xs },
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
  },
  langFlag: { fontSize: 24 },
  langText: { fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
  // Edge-to-edge frosted strip (Surface overlay) wraps this horizontal tab scroller — square
  // corners, no floating-card rounding. The Surface owns the edge, so no border here.
  tabsGlass: { flex: 1, borderRadius: 0 },
  tabsScroll: {
    flexGrow: 0,
  },
  tabsRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.xs,
  },
  tabItem: {
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
  },
  // Bumped from FontSize.sm (14) — read as too small once the tab got a visible rounded
  // frame around it (2026-07-19 visual-audit). includeFontPadding/textAlignVertical fix
  // Android's Nunito vertical-centering offset inside the line box (same fix as
  // ScreenHeader.tsx's title — see HEADER_CLIP_DEBUG.md).
  tabLabel: {
    fontSize: FontSize.md,
    lineHeight: Math.round(FontSize.md * Type.label.line),
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  tabSectionLabel: { fontFamily: Type.subheading.fontFamily, fontSize: Type.subheading.size },
});
