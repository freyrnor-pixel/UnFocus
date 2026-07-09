/**
 * settings.tsx — app settings
 *
 * Tabbed settings screen (Decision 001 tier='sub') — a horizontally-scrollable tab bar
 * (Generelt | Planer | Handle | Varsler) sits directly under the header as
 * ScreenScaffold's `stickyBelowHeader`; each tab is its own scroll of cards
 * (local `tab` state, no router routes).
 *
 * - Generelt: Focus mode toggle → Profil (name + language) → Utseende (dark mode) →
 *   Tilgjengelighet (reduced motion, particles, font size, left-handed, horizontal plans timeline) →
 *   Data group (debug mode toggle, Local account card (Decision 039 —
 *   device-only profile: name + create date, auto-backup toggle, backup/restore via
 *   lib/backup [share excludes user name]), LAN sync, destructive resets, version & updates).
 * - Modi (Additional modes): Jobb-modus (work mode, auto-activate + hours + work days,
 *   Norske helligdager) → Foreldremodus (child-mode, password, enter/exit) → Skolemodus toggle →
 *   Freyr-modus toggle (seeds/unseeds a starter data set via lib/freyrModeSeed.ts).
 * - Handle: shopping list settings (weekly reset weekday, monthly reset date, monthly budget).
 * - Varsler: Ukentlig (weekly reminder + time) → Generelle (independent plan-notifications and
 *   habit-reminders toggles, persistent daily overview, quiet hours).
 *
 * Every setting applies immediately via applyAndSync() — no buffered/dirty save step (matches
 * hints.settings.text: "Changes apply immediately.").
 *
 * Connections:
 *   Imports → components/AppModal, components/ConfirmationBanner, components/FormControls,
 *             components/ScreenScaffold, components/SectionDivider, components/Surface,
 *             constants/theme, lib/backup
 *             (exportBackup/exportBackupToDevice/pickAndParseBackup/restoreBackup/reloadApp/
 *             getAutoBackupLabel/saveAutoBackup), lib/childLock, lib/freyrModeSeed, lib/haptics,
 *             lib/i18n, lib/notifications, lib/reminders, lib/syncService, lib/useAppTheme,
 *             store/useHabitStore, store/useSettingsStore, store/useShoppingStore, store/useTaskStore
 *   Used by → Expo Router route "/settings" (linked from ScreenHeader's gear icon, tier='site')
 *   Data    → useSettingsStore (settings table; incl. essentialsModeEnabled, quietHours*,
 *             monthlyBudgetNok, taskNotificationsEnabled, habitNotificationsEnabled,
 *             persistentNotifEnabled); reset actions touch useTaskStore (tasks) and
 *             useShoppingStore (shopping_items via monthlyReset); re-syncs notifications via
 *             syncReminders / syncAllTaskNotifications / syncAllHabitReminders /
 *             syncNotificationCategories
 *
 * Edit notes:
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
 *   - essentialsModeEnabled is the underlying field/DB column name (unchanged) — its user-facing
 *     label is "Focus mode" / "Fokus-modus".
 *   - Debug section only exposes the debugModeEnabled toggle. permissionTests.ts does not exist
 *     in this repo yet — its buttons are NOT wired here; see the commented placeholder below.
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
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import SectionDivider from '@/components/SectionDivider';
import { Input, Switch as FormSwitch, SegmentedControl } from '@/components/FormControls';
import { showAppModal } from '@/components/AppModal';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import {
  useSettingsStore,
  Settings,
  FontSizePref,
  DarkMode,
} from '@/store/useSettingsStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import { syncReminders } from '@/lib/reminders';
import { syncNotificationCategories } from '@/lib/notifications';
import { seedFreyrMode, unseedFreyrMode, parseFreyrSeedIds } from '@/lib/freyrModeSeed';
import { exportBackup, exportBackupToDevice, pickAndParseBackup, restoreBackup, reloadApp, getAutoBackupLabel, saveAutoBackup } from '@/lib/backup';
import { setPassword as setChildPassword, verifyPassword as verifyChildPassword } from '@/lib/childLock';
import { isSyncAvailable } from '@/lib/syncService';
import { useT, getTranslations } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { selection, warning, heavy } from '@/lib/haptics';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';

type SettingsTab = 'generelt' | 'handle' | 'varsler' | 'moduser';
const TAB_BAR_HEIGHT = 48;

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const syncTaskNotifs = useTaskStore((s) => s.syncAllTaskNotifications);
  const syncHabitNotifs = useHabitStore((s) => s.syncAllHabitReminders);
  const clearTasks = useTaskStore((s) => s.clearAll);
  const monthlyReset = useShoppingStore((s) => s.monthlyReset);
  const syncAvailable = isSyncAvailable();

  const [tab, setTab] = useState<SettingsTab>('generelt');
  const [name, setName] = useState(settings.userName);
  const [accountNameInput, setAccountNameInput] = useState(settings.accountName);
  const [monthlyDateInput, setMonthlyDateInput] = useState(String(settings.monthlyResetDate));
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState(
    settings.monthlyBudgetNok > 0 ? String(settings.monthlyBudgetNok) : ''
  );
  // Child mode (Decision 038c) — local input for the parent password entry/exit.
  const [childPwInput, setChildPwInput] = useState('');
  const [inputWarning, setInputWarning] = useState<string | null>(null);

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
  }

  // Manually check the EAS preview channel for a newer OTA, fetch it, and reload.
  // In debug builds Updates.isEnabled is false (expo-updates is off), so this
  // reports that OTA is unavailable rather than silently doing nothing.
  const [checkingUpdate, setCheckingUpdate] = useState(false);
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
    if (keys.some((k) => ['taskNotificationsEnabled', 'language', 'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd', 'essentialsModeEnabled'].includes(k))) {
      syncTaskNotifs();
    }
    if (keys.includes('language') || keys.includes('habitNotificationsEnabled') || keys.includes('essentialsModeEnabled')) {
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.tabsScroll, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
      contentContainerStyle={styles.tabsRow}
    >
      {TABS.map((tb) => {
        const active = tab === tb.key;
        return (
          <Pressable
            key={tb.key}
            style={[styles.tabItem, active && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
            onPress={() => setTab(tb.key)}
          >
            <Text style={[
              styles.tabLabel,
              { color: active ? theme.accent : theme.textMuted },
              active && { fontFamily: Fonts.bold },
            ]}>
              {tb.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <>
    <ScreenScaffold
      title={t.settingsTitle}
      tier="sub"
      onBack={() => router.back()}
      stickyBelowHeader={tabBar}
      stickyBelowHeaderHeight={TAB_BAR_HEIGHT}
    >
      <View style={styles.content}>
        {tab === 'generelt' && (
          <>
            {/* Focus mode */}
            <View style={styles.section}>
              <Surface style={[styles.essentialsCard, { borderColor: theme.accent }]} tint={theme.accentSoft}>
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.essentialsLabel, { color: theme.text }]}>{t.config.essentials.label}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.config.essentials.hint}</Text>
                  </View>
                  <FormSwitch
                    checked={settings.essentialsModeEnabled}
                    onChange={(v) => { selection(); settings.update({ essentialsModeEnabled: v }); }}
                  />
                </View>
              </Surface>
            </View>

            {/* PROFIL */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.sectionProfile}</Text>
              <Surface style={styles.card}>
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
                    <Pressable
                      key={lang}
                      style={[
                        styles.langChip,
                        { backgroundColor: theme.surfaceMuted },
                        settings.language === lang && { backgroundColor: theme.accent },
                      ]}
                      onPress={() => applyAndSync({ language: lang })}
                    >
                      <Text style={styles.langFlag}>{lang === 'no' ? '🇳🇴' : '🇬🇧'}</Text>
                      <Text style={[
                        styles.langText,
                        { color: theme.text },
                        settings.language === lang && { color: theme.accentInk },
                      ]}>
                        {lang === 'no' ? t.norwegian : t.english}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.descText, { color: theme.textMuted }]}>{t.config.desc.language}</Text>
              </Surface>
            </View>

            {/* UTSEENDE */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.config.sections.appearance}</Text>
              <Surface style={styles.card}>
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
              </Surface>
            </View>

            {/* TILGJENGELIGHET */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.settings.accessibility.title}</Text>
              <Surface style={styles.card}>
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
              </Surface>
            </View>

            {/* ===== DATA ===== */}
            <SectionDivider />
            <Text style={[styles.groupHeader, { color: theme.bad }]}>{t.config.sections.data}</Text>

            {/* Debug mode */}
            <View style={styles.section}>
              <Surface style={styles.card}>
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
                {/*
                  Placeholder — permission test buttons (lib/permissionTests.ts) mount here once
                  that utility exists. It does not exist anywhere in this repo yet (native
                  permission-testing is blocked on a dev/APK build), so nothing is wired below
                  the toggle above. Do not wire this until permissionTests.ts lands.
                */}
              </Surface>
            </View>

            {/* Local account (Decision 039) — device-only, user-held profile. No server,
                no credentials; the account rides along in the local backup file below. */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.account.title}</Text>
              <Surface style={styles.card}>
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
                  <Pressable style={styles.dangerBtn} onPress={handleCreateAccount}>
                    <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.account.createButton}</Text>
                  </Pressable>
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
                    onChange={(v) => {
                      selection();
                      applyAndSync({ autoBackupEnabled: v });
                      if (v) void saveAutoBackup();
                    }}
                  />
                </View>
                {settings.autoBackupEnabled && (
                  <Text style={[styles.descText, { color: theme.textMuted, marginTop: Spacing.xs, marginBottom: 0 }]}>
                    {t.config.autoBackup.pathLabel} {getAutoBackupLabel()}
                  </Text>
                )}
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <Pressable style={styles.dangerBtn} onPress={handleSaveToDevice}>
                  <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.backup.saveToDevice}</Text>
                </Pressable>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <Pressable style={styles.dangerBtn} onPress={handleExport}>
                  <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.backup.shareCopy}</Text>
                </Pressable>
                <Text style={[styles.descText, { color: theme.textMuted, marginTop: Spacing.xs, marginBottom: 0 }]}>
                  {t.config.autoBackup.shareNote}
                </Text>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <Pressable style={styles.dangerBtn} onPress={handleImport}>
                  <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.account.restoreButton}</Text>
                </Pressable>
                <Text style={[styles.descText, { color: theme.textMuted, marginBottom: 0 }]}>{t.account.deviceOnlyNote}</Text>
              </Surface>
            </View>

            {/* LAN live sync (Decision 038 app integration) — pairing lives on its own
                screen (app/pair-device.tsx); this card is just the entry point + toggle. */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.peers.title}</Text>
              <Surface style={styles.card}>
                <Text style={[styles.descText, { color: theme.textMuted, marginTop: 0, marginBottom: Spacing.sm }]}>
                  {syncAvailable ? t.peers.settingsCardDesc : t.peers.syncUnavailable}
                </Text>
                <Pressable style={styles.dangerBtn} onPress={() => router.push('/pair-device')}>
                  <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.peers.manageLink}</Text>
                </Pressable>
              </Surface>
            </View>

            {/* Reset data */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.sectionReset}</Text>
              <Surface style={[styles.card, { borderWidth: 1, borderColor: theme.badSoft }]}>
                <Text style={[styles.descText, { color: theme.bad, marginBottom: Spacing.sm, marginTop: 0 }]}>{t.config.desc.dataNote}</Text>
                <Pressable style={styles.dangerBtn} onPress={() => confirmReset(t.resetMonthly.toLowerCase(), monthlyReset)}>
                  <Text style={[styles.dangerBtnText, { color: theme.bad }]}>{t.resetMonthly}</Text>
                </Pressable>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <Pressable style={styles.dangerBtn} onPress={() => confirmReset(t.resetTasks.toLowerCase(), clearTasks)}>
                  <Text style={[styles.dangerBtnText, { color: theme.bad }]}>{t.resetTasks}</Text>
                </Pressable>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <Pressable
                  style={styles.dangerBtn}
                  onPress={() =>
                    confirmReset(t.resetOnboarding.toLowerCase(), () => {
                      settings.update({ setupComplete: false });
                      router.replace('/onboarding/language');
                    })
                  }
                >
                  <Text style={[styles.dangerBtnText, { color: theme.bad }]}>{t.resetOnboarding}</Text>
                </Pressable>
              </Surface>
            </View>

            {/* Version & updates — lets the user see exactly which build/OTA is
                running and force an OTA check. Runtime + updateId here are the
                fastest way to diagnose "I haven't received the update". */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.version.title}</Text>
              <Surface style={styles.card}>
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
                <Pressable style={styles.dangerBtn} onPress={handleCheckUpdates} disabled={checkingUpdate}>
                  <Text style={[styles.dangerBtnText, { color: theme.accent }]}>
                    {checkingUpdate ? t.version.checking : t.version.checkButton}
                  </Text>
                </Pressable>
              </Surface>
            </View>
          </>
        )}

        {tab === 'moduser' && (
          <>
            {/* JOBB-MODUS */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.config.sections.workMode}</Text>
              <Surface style={styles.card}>
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
                      <Pressable
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
                      >
                        <Text style={[
                          styles.dayText,
                          { color: theme.text },
                          active && { color: theme.accentInk },
                        ]}>
                          {label.slice(0, 3)}
                        </Text>
                      </Pressable>
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
              </Surface>
            </View>

            {/* FORELDREMODUS (Parent mode / Child mode) */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.childModeTitle}</Text>
              <Surface style={styles.card}>
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
                    <Pressable style={styles.dangerBtn} onPress={handleExitChildMode}>
                      <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.childModeExit}</Text>
                    </Pressable>
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
                    <Pressable style={styles.dangerBtn} onPress={handleSetChildPassword}>
                      <Text style={[styles.dangerBtnText, { color: theme.accent }]}>
                        {settings.childModePasswordSet ? t.childModeChangePassword : t.childModeSetPassword}
                      </Text>
                    </Pressable>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <Pressable style={styles.dangerBtn} onPress={handleEnableChildMode}>
                      <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.childModeEnable}</Text>
                    </Pressable>
                  </>
                )}
              </Surface>
            </View>

            {/* SKOLEMODUS */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.config.schoolMode.label}</Text>
              <Surface style={styles.card}>
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
              </Surface>
            </View>

            {/* FREYR-MODUS */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.config.freyrMode.label}</Text>
              <Surface style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.config.freyrMode.label}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.config.freyrMode.hint}</Text>
                  </View>
                  <FormSwitch checked={settings.freyrModeEnabled} onChange={handleToggleFreyrMode} />
                </View>
              </Surface>
            </View>
          </>
        )}

        {tab === 'handle' && (
          <View style={styles.section}>
            <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.sectionShopping}</Text>
            <Surface style={styles.card}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.weeklyResetDay}</Text>
              <View style={styles.dayRow}>
                {DAY_LABELS.map((label, i) => (
                  <Pressable
                    key={i}
                    style={[
                      styles.dayChip,
                      { backgroundColor: theme.surfaceMuted },
                      settings.weeklyResetDay === i && { backgroundColor: theme.accent },
                    ]}
                    onPress={() => applyAndSync({ weeklyResetDay: i })}
                  >
                    <Text style={[
                      styles.dayText,
                      { color: theme.text },
                      settings.weeklyResetDay === i && { color: theme.accentInk },
                    ]}>
                      {label.slice(0, 3)}
                    </Text>
                  </Pressable>
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

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <Input
                label={t.settings.monthlyBudget.label}
                value={monthlyBudgetInput}
                onChangeText={setMonthlyBudgetInput}
                onBlur={() => {
                  if (monthlyBudgetInput.trim() === '') {
                    settings.update({ monthlyBudgetNok: 0 });
                    return;
                  }
                  const n = parseFloat(monthlyBudgetInput.replace(',', '.'));
                  if (!isNaN(n) && n >= 0) {
                    settings.update({ monthlyBudgetNok: n });
                  } else {
                    setMonthlyBudgetInput(settings.monthlyBudgetNok > 0 ? String(settings.monthlyBudgetNok) : '');
                    setInputWarning(t.invalidMonthlyBudgetMsg);
                  }
                }}
                keyboardType="number-pad"
                placeholder={t.settings.monthlyBudget.placeholder}
                maxLength={6}
              />
              <Text style={[styles.paydayHint, { color: theme.textMuted }]}>{t.settings.monthlyBudget.hint}</Text>
            </Surface>
          </View>
        )}

        {tab === 'varsler' && (
          <>
            {/* UKENTLIG */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.weeklyReminders}</Text>
              <Surface style={styles.card}>
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
              </Surface>
            </View>

            {/* GENERELLE */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.config.sections.notifications}</Text>
              <Surface style={styles.card}>
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
                  <FormSwitch checked={settings.persistentNotifEnabled} onChange={(v) => settings.update({ persistentNotifEnabled: v })} />
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
              </Surface>
            </View>

            {/* AUTOMATISERING — the only entry point to the automations screen (Decision 036). */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.nav.automations}</Text>
              <Surface style={styles.card}>
                <Pressable style={styles.switchRow} onPress={() => router.push('/automations')}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.nav.automations}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.hints.automations.text}</Text>
                  </View>
                  <Text style={[styles.switchLabel, { color: theme.accent }]}>{'→'}</Text>
                </Pressable>
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
  content: { padding: Spacing.md, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  groupHeader: { fontSize: FontSize.xl, fontFamily: Fonts.bold, marginTop: Spacing.sm },
  descText: { fontSize: FontSize.xs, marginTop: Spacing.sm, lineHeight: 18 },
  essentialsCard: { padding: Spacing.md, borderWidth: 2 },
  essentialsLabel: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  card: { padding: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, marginBottom: Spacing.xs },
  divider: { height: 1, marginVertical: Spacing.md },
  workHoursRow: { flexDirection: 'row', gap: Spacing.md },
  workHoursCol: { flex: 1 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dayChip: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  workDayRow: { flexWrap: 'nowrap', gap: 2 },
  workDayChip: { flex: 1, minWidth: 0, minHeight: 36, paddingHorizontal: 2 },
  dayText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  paydayHint: { fontSize: FontSize.xs, marginTop: Spacing.xs, fontStyle: 'italic' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchTextCol: { flex: 1, marginRight: Spacing.md },
  switchLabel: { fontSize: FontSize.md, fontFamily: Fonts.medium },
  switchHint: { fontSize: FontSize.xs, marginTop: 2 },
  dangerBtn: { paddingVertical: Spacing.sm },
  dangerBtnText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  langRow: { flexDirection: 'row', gap: Spacing.md },
  langChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.md, justifyContent: 'center',
  },
  langFlag: { fontSize: 24 },
  langText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  tabsScroll: {
    borderBottomWidth: 1,
  },
  tabsRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.md,
  },
  tabItem: {
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: FontSize.sm },
  tabSectionLabel: {
    fontSize: FontSize.xs, fontFamily: Fonts.semibold, letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: Spacing.sm,
  },
});
