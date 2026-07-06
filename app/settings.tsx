/**
 * settings.tsx — app settings
 *
 * Tabbed settings screen (Decision 001 tier='sub') — a tab bar (Generelt | Lister | Varsler |
 * Utseende) sits directly under the header as ScreenScaffold's `stickyBelowHeader`; each tab is
 * its own scroll of cards (local `tab` state, no router routes).
 *
 * - Generelt: Focus mode toggle → Profil (name + language) → Jobb-modus (work mode, auto-activate
 *   + hours + work days, Norske helligdager) → Tilgjengelighet (reduced motion, particles, font
 *   size, left-handed) → Motivasjon (points, hints, Følgeven/pet-enable toggle) → Companion Pet
 *   config (shown when pet enabled) → Data group (debug mode toggle, Local account card
 *   (Decision 039 — device-only profile: name + create date, backup/restore via lib/backup),
 *   destructive resets).
 * - Lister: shopping list settings (weekly reset weekday, monthly reset date, monthly budget).
 * - Varsler: Ukentlig (weekly reminder + time) → Generelle (independent plan-notifications and
 *   habit-reminders toggles, persistent daily overview, quiet hours).
 * - Utseende: Fargetema (colour theme swatches), Materiale (bubble material), Mørk modus (3-way).
 *
 * Every setting applies immediately via applyAndSync() — no buffered/dirty save step (matches
 * hints.settings.text: "Changes apply immediately.").
 *
 * Connections:
 *   Imports → components/AppModal, components/FormControls, components/GradientSwatch,
 *             components/ScreenScaffold, components/SectionDivider, components/Surface,
 *             components/SwatchPicker, constants/theme, lib/backup, lib/childLock, lib/haptics,
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
 *   - `essentialsModeEnabled` is the underlying field/DB column name (unchanged) — its user-facing
 *     label is "Focus mode" / "Fokus-modus".
 *   - Colour-theme swatches now read their preview colour from the SAME canonical palette
 *     that drives chrome — getThemePalette(key).accent in constants/colors.ts — so the
 *     picker options, the swatch previews, and the runtime chrome can never disagree. (They
 *     used to be sourced from constants/theme.ts's legacy AppColors THEMES, whose theme set
 *     — tech/fluffy, no summer/blackWhite — did not match colors.ts, so Tech/Fluffy rendered
 *     as Default and Black & White was unreachable.) All chrome here goes through useAppTheme()
 *     tokens (Decision 006) — no raw hex except the fixed pet-colour swatch options.
 *   - 'custom' theme is deliberately excluded from the colour-theme picker: constants/colors.ts's
 *     ThemePalette (Decision 006) has no 'custom' variant yet (Decision 006/007 explicitly defer
 *     it), so offering it would silently render as 'default' via getThemePalette()'s fallback.
 *     HuePicker is not wired for the same reason (see its own header note).
 *   - Debug section only exposes the debugModeEnabled toggle. permissionTests.ts does not exist
 *     in this repo yet — its buttons are NOT wired here; see the commented placeholder below.
 *   - "Reset weekly list" and the Test-data load/clear actions from the pre-rebuild app are NOT
 *     ported: this repo's shopping architecture replaced the single global weekly list with
 *     per-week ShoppingList rows (store/useShoppingListStore.ts, auto-rolling by date), so there
 *     is no equivalent "reset the current weekly list" store action to bind to; lib/seedTestData.ts
 *     also does not exist in this repo. Flagged in PROGRESS_LOG rather than inventing either.
 *   - Companion pet is configured during onboarding step6 by default; this screen lets returning
 *     users change it later.
 *   - LAN live sync (Decision 038 app integration): this screen only owns the entry-point card
 *     (description + link) in the Data group — the sync toggle, QR pairing wizard, and paired-
 *     devices list all live on app/pair-device.tsx. syncAvailable (lib/syncService's
 *     isSyncAvailable()) gates whether the card shows the link or an "unavailable" note, since
 *     the native transport modules aren't linked outside a real build.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import SectionDivider from '@/components/SectionDivider';
import SwatchPicker from '@/components/SwatchPicker';
import { RadialSwatch } from '@/components/GradientSwatch';
import { Input, Switch as FormSwitch, SegmentedControl } from '@/components/FormControls';
import { showAppModal } from '@/components/AppModal';
import {
  useSettingsStore,
  Settings,
  ColorTheme,
  FontSizePref,
  PetType,
  DarkMode,
} from '@/store/useSettingsStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useHabitStore } from '@/store/useHabitStore';
import { syncReminders } from '@/lib/reminders';
import { syncNotificationCategories } from '@/lib/notifications';
import { exportBackup, exportBackupToDevice, pickAndParseBackup, restoreBackup, reloadApp } from '@/lib/backup';
import { setPassword as setChildPassword, verifyPassword as verifyChildPassword } from '@/lib/childLock';
import { isSyncAvailable } from '@/lib/syncService';
import { useT, getTranslations } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { useAppTheme } from '@/lib/useAppTheme';
import { selection, warning, heavy } from '@/lib/haptics';
import {
  FontSize,
  Fonts,
  Radius,
  Spacing,
  MATERIAL_META,
  MaterialName,
  getMaterialStyle,
} from '@/constants/theme';
import { getThemePalette } from '@/constants/colors';

const PET_TYPES: PetType[] = ['cat', 'dog', 'bird', 'fox', 'bunny'];
const PET_EMOJIS: Record<PetType, string> = { cat: '🐱', dog: '🐶', bird: '🐦', fox: '🦊', bunny: '🐰' };
// Canonical colors.ts theme set (see constants/colors.ts ThemeName). 'custom'
// excluded — no Decision-006 palette variant for it yet (file header).
const COLOR_THEME_KEYS: ColorTheme[] = ['default', 'summer', 'nature', 'fluffyPink', 'gothic', 'blackWhite'];

type SettingsTab = 'generelt' | 'lister' | 'varsler' | 'utseende';
const TAB_BAR_HEIGHT = 48;

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettingsStore();
  const theme = useAppTheme();
  const t = useT();
  const syncTaskNotifs = useTaskStore((s) => s.syncAllTaskNotifications);
  const syncHabitNotifs = useHabitStore((s) => s.syncAllHabitReminders);
  const clearTasks = useTaskStore((s) => s.clearAll);
  const monthlyReset = useShoppingStore((s) => s.monthlyReset);
  const syncAvailable = isSyncAvailable();

  const [tab, setTab] = useState<SettingsTab>('generelt');
  const [name, setName] = useState(settings.userName);
  const [accountNameInput, setAccountNameInput] = useState(settings.accountName);
  const [petNameInput, setPetNameInput] = useState(settings.petName);
  const [monthlyDateInput, setMonthlyDateInput] = useState(String(settings.monthlyResetDate));
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState(
    settings.monthlyBudgetNok > 0 ? String(settings.monthlyBudgetNok) : ''
  );
  // Child mode (Decision 038c) — local input for the parent password entry/exit.
  const [childPwInput, setChildPwInput] = useState('');

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
    { key: 'lister', label: t.config.tabs.lists },
    { key: 'varsler', label: t.config.tabs.notifications },
    { key: 'utseende', label: t.config.tabs.appearance },
  ];

  const DAY_LABELS = t.dayFull;
  // Fixed pet-colour options — data, not chrome (same precedent as colour-theme swatch data).
  const petSwatches = [theme.accent, theme.good, '#A78BFA', '#F472B6', '#60A5FA', '#34D399'];

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
    <View style={[styles.tabsRow, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
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
    </View>
  );

  return (
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
              </Surface>
            </View>

            {/* MOTIVASJON */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.sectionMotivation}</Text>
              <Surface style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.showPointsLabel}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.config.desc.points}</Text>
                  </View>
                  <FormSwitch checked={settings.showPoints} onChange={(v) => settings.update({ showPoints: v })} />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.showHintsLabel}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.config.desc.hints}</Text>
                  </View>
                  <FormSwitch checked={settings.showHints} onChange={(v) => settings.update({ showHints: v })} />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={[styles.switchLabel, { color: theme.text }]}>{t.settings.pet.toggle}</Text>
                    <Text style={[styles.switchHint, { color: theme.textMuted }]}>{t.settings.pet.toggleSubtitle}</Text>
                  </View>
                  <FormSwitch checked={settings.petEnabled} onChange={(v) => settings.update({ petEnabled: v })} />
                </View>
              </Surface>
            </View>

            {/* Companion pet config */}
            {settings.petEnabled && (
              <View style={styles.section}>
                <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.settings.pet.toggle}</Text>
                <Surface style={styles.card}>
                  <Input
                    label={t.settings.pet.name}
                    value={petNameInput}
                    onChangeText={setPetNameInput}
                    placeholder={t.settings.pet.namePlaceholder}
                    onBlur={() => settings.update({ petName: petNameInput.trim() })}
                    returnKeyType="done"
                  />

                  <View style={[styles.divider, { backgroundColor: theme.border }]} />

                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.settings.pet.type}</Text>
                  <View style={styles.petTypeRow}>
                    {PET_TYPES.map((pt) => (
                      <Pressable
                        key={pt}
                        style={[
                          styles.petTypeCard,
                          { borderColor: settings.petType === pt ? theme.accent : theme.border },
                          { backgroundColor: settings.petType === pt ? theme.accentSoft : theme.surfaceMuted },
                        ]}
                        onPress={() => settings.update({ petType: pt })}
                      >
                        <Text style={styles.petTypeEmoji}>{PET_EMOJIS[pt]}</Text>
                        <Text style={[styles.petTypeLabel, { color: settings.petType === pt ? theme.accent : theme.textMuted }]}>
                          {t.settings.pet.typeLabels[pt]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.border }]} />

                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.settings.pet.colour}</Text>
                  <View style={styles.swatchRow}>
                    {petSwatches.map((color) => (
                      <Pressable
                        key={color}
                        style={[
                          styles.petSwatch,
                          { backgroundColor: color },
                          settings.petColor === color && [styles.petSwatchActive, { borderColor: theme.text }],
                        ]}
                        onPress={() => settings.update({ petColor: color })}
                      />
                    ))}
                  </View>
                </Surface>
              </View>
            )}

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
                <Pressable style={styles.dangerBtn} onPress={handleSaveToDevice}>
                  <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.backup.saveToDevice}</Text>
                </Pressable>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <Pressable style={styles.dangerBtn} onPress={handleExport}>
                  <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.backup.shareCopy}</Text>
                </Pressable>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <Pressable style={styles.dangerBtn} onPress={handleImport}>
                  <Text style={[styles.dangerBtnText, { color: theme.accent }]}>{t.account.restoreButton}</Text>
                </Pressable>
                <Text style={[styles.descText, { color: theme.textMuted, marginBottom: 0 }]}>{t.account.deviceOnlyNote}</Text>
              </Surface>
            </View>

            {/* Child mode (Decision 038c) — locked variant gated by a parent password.
                The password lives in expo-secure-store (lib/childLock); only the flags
                are in settings. Full app-shell locking (hiding nav/sharing while childMode
                is on) is wired at the shell level — this card owns set-password + enter/exit. */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.childModeTitle}</Text>
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

        {tab === 'lister' && (
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

        {tab === 'utseende' && (
          <>
            {/* FARGETEMA */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.sectionColorTheme}</Text>
              <Surface style={styles.card}>
                <SwatchPicker
                  items={COLOR_THEME_KEYS.map((key) => ({ key, label: t.themeNames[key] }))}
                  value={settings.colorTheme}
                  onChange={(key) => settings.update({ colorTheme: key as ColorTheme })}
                  renderSwatch={(key) => <RadialSwatch color={getThemePalette(key as any, false).accent} size={54} />}
                />
              </Surface>
            </View>

            {/* MATERIALE */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.sectionBubbleMaterial}</Text>
              <Surface style={styles.card}>
                <SwatchPicker
                  items={(Object.keys(MATERIAL_META) as MaterialName[]).map((key) => ({ key, label: t.materialNames[key] }))}
                  value={settings.bubbleMaterial}
                  onChange={(key) => settings.update({ bubbleMaterial: key as MaterialName })}
                  renderSwatch={(key) => {
                    const preview = getMaterialStyle(theme.accent, key as MaterialName);
                    return (
                      <View
                        style={[
                          styles.materialSwatch,
                          {
                            backgroundColor: preview.backgroundColor,
                            borderWidth: preview.borderWidth,
                            borderColor: preview.borderColor,
                            borderTopColor: preview.borderTopColor,
                            borderBottomColor: preview.borderBottomColor,
                            shadowOpacity: preview.shadowOpacity,
                            shadowRadius: preview.shadowRadius,
                            elevation: preview.elevation,
                          },
                        ]}
                      >
                        <View style={[styles.materialSheen, { backgroundColor: preview.sheenColor }]} />
                      </View>
                    );
                  }}
                />
              </Surface>
            </View>

            {/* LIGHT/DARK MODE */}
            <View style={styles.section}>
              <Text style={[styles.tabSectionLabel, { color: theme.textMuted }]}>{t.lightDarkModeLabel}</Text>
              <Surface style={styles.card}>
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
          </>
        )}

        <View style={{ height: 40 }} />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
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
  materialSwatch: { width: '100%', height: '100%', borderRadius: Radius.full, overflow: 'hidden' },
  materialSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%', borderRadius: Radius.full },
  langRow: { flexDirection: 'row', gap: Spacing.md },
  langChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.md, justifyContent: 'center',
  },
  langFlag: { fontSize: 24 },
  langText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  tabsRow: {
    flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: Spacing.md,
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
  petTypeRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  petTypeCard: {
    flex: 1, minWidth: 56, borderWidth: 2, borderRadius: Radius.md,
    padding: Spacing.xs, alignItems: 'center', gap: 2,
  },
  petTypeEmoji: { fontSize: 28 },
  petTypeLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  swatchRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  petSwatch: {
    width: 36, height: 36, borderRadius: Radius.full, borderWidth: 2,
    borderColor: 'transparent',
  },
  petSwatchActive: { borderWidth: 3 },
});
