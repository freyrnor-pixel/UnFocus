/**
 * useSettingsStore.ts — single-row app settings / preferences
 *
 * Zustand store mirroring the one settings row: user name, language,
 * dark mode, reminder/notification toggles (including quiet hours, task/habit notification toggles), reset cadence,
 * work/essentials modes, onboarding state, accessibility flags, monthly
 * grocery budget (monthlyBudgetNok), the local account
 * (accountName/accountCreated — device-only profile, Decision 039), and the debug
 * overlay's enable flag.
 * persistentNotifEnabled toggles the always-current "today's overview" notification
 * (refreshed by app/_layout.tsx, see lib/notifications.ts's refreshPersistentNotification).
 * habitNotificationsEnabled gates all habit reminders.
 * childMode/childModePasswordSet are Decision 038c FLAGS only — the parent password
 * itself lives in expo-secure-store (lib/childLock), never in this row. deviceId is
 * this install's stable identity for LAN live-sync (self-healed on load() if empty);
 * lanSyncEnabled gates whether lib/syncService's transport runs (Decision 038 wiring).
 *
 * Connections:
 *   Imports → lib/dataAccess, lib/id
 *   Used by → app/_layout.tsx, app/budget.tsx, app/habit-form.tsx, app/habits.tsx, app/index.tsx, app/onboarding/* , app/pair-device.tsx, app/scan.tsx, app/settings.tsx, app/share-modal.tsx, app/shared.tsx, components/DebugOverlay.tsx, components/HintCard.tsx, components/ParticleBackground.tsx, components/SharedRequestsSection.tsx, lib/i18n.ts, lib/reminders.ts, lib/syncService.ts, lib/useAppTheme.ts, store/useAutomationStore.ts, store/useHabitStore.ts, store/useShoppingStore.ts, store/useTaskStore.ts
 *   Data    → defines a Zustand store; owns the single-row SQLite table settings (id = 1)
 *
 * Edit notes:
 *   - Settings live in ONE row (id = 1, inserted by initDb); update() always rewrites every column WHERE id = 1.
 *   - `loaded` and `workModeSessionOverride` are session-only (never persisted to SQLite).
 *   - update() updates in-memory state even if the DB write throws (e.g. column not yet migrated), so the UI stays responsive.
 *   - New settings columns go through the migrations array in lib/db.ts; add to Settings type, load() mapping, and update()'s column list.
 */
import { create } from 'zustand';
import {
  Row,
  FieldMap,
  loadFirst,
  updateRow,
  rowValues,
  readStr,
  readInt,
  readReal,
  readBool,
  readJson,
} from '@/lib/dataAccess';
import { generateId } from '@/lib/id';

// The app ships a single palette ("Default"). The union is kept as a type so
// existing casts (`as ColorTheme`) still compile; only 'default' is ever stored.
export type ColorTheme = 'default';
export type Language = 'en' | 'no';
export type DarkMode = 'system' | 'on' | 'off';
export type FontSizePref = 'small' | 'default' | 'large';

export type Settings = {
  userName: string;
  weeklyResetDay: number;
  monthlyResetDate: number;
  remindersEnabled: boolean;
  reminderTime: string;
  taskNotificationsEnabled: boolean;
  setupComplete: boolean;
  workModeEnabled: boolean;
  workHoursStart: string;
  workHoursEnd: string;
  enforceWorkHours: boolean;
  workDays: number[];
  essentialsModeEnabled: boolean;
  showPoints: boolean;
  showHints: boolean;
  language: Language;
  holidaysEnabled: boolean;
  darkMode: DarkMode;
  childProfiles: string[];
  // Accessibility (Proposal 4)
  reducedMotion: boolean;
  particlesEnabled: boolean;
  fontSize: FontSizePref;
  // Left-handed mode
  leftHanded: boolean;
  // Persistent "today's overview" notification
  persistentNotifEnabled: boolean;
  // Notification quiet hours (AP-05)
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  // Monthly grocery budget (AP-06B), shown against receipts in app/budget.tsx
  monthlyBudgetNok: number;
  // Debug mode — feedback pins
  debugModeEnabled: boolean;
  // Last payday-boundary monthly reset, as YYYY-MM-DD; drives the automatic reset check in app/shopping.tsx
  lastMonthlyReset: string;
  // Habit reminders toggle
  habitNotificationsEnabled: boolean;
  // Permission toggles (permission pre-bake)
  locationEnabled: boolean;
  backgroundLocationEnabled: boolean;
  calendarSyncEnabled: boolean;
  voiceNotesEnabled: boolean;
  // Local account (Decision 039) — device-only, user-held profile. No server, no
  // credentials. accountName is a display label; accountCreated (YYYY-MM-DD) is
  // stamped when the user creates their local account (empty = none yet). Both ride
  // along in the local backup file via lib/backup.ts (they live in the settings row).
  accountName: string;
  accountCreated: string;
  // Child-mode variant (Decision 038c) — locked-down mode gated by a parent
  // password. Only flags persist here; the password lives in expo-secure-store
  // (lib/childLock.ts), never in this row.
  childMode: boolean;
  childModePasswordSet: boolean;
  // LAN live-sync (Decision 038 app integration). deviceId is this install's stable
  // identity (self-healed by load() if empty — see below); lanSyncEnabled gates
  // whether lib/syncService's transport runs.
  deviceId: string;
  lanSyncEnabled: boolean;
  // Auto-backup to a fixed local path, updated on every change when enabled.
  autoBackupEnabled: boolean;
  // School mode placeholder — no feature logic yet, toggle persisted for future use.
  schoolModeEnabled: boolean;
};

type SettingsStore = Settings & {
  // Session-only (not persisted)
  loaded: boolean;
  workModeSessionOverride: boolean;
  load: () => void;
  update: (patch: Partial<Settings>) => void;
  setWorkModeSessionOverride: (v: boolean) => void;
};

/** Map the single settings row to the persisted Settings (defaults mirror the old load()). */
function rowToSettings(row: Row): Settings {
  return {
    userName: readStr(row, 'user_name'),
    weeklyResetDay: readInt(row, 'weekly_reset_day', 1),
    monthlyResetDate: readInt(row, 'monthly_reset_date', 1),
    remindersEnabled: readBool(row, 'reminders_enabled'),
    reminderTime: readStr(row, 'reminder_time', '08:00'),
    taskNotificationsEnabled: readBool(row, 'task_notifications_enabled'),
    setupComplete: readBool(row, 'setup_complete'),
    workModeEnabled: readBool(row, 'work_mode_enabled'),
    workHoursStart: readStr(row, 'work_hours_start', '07:00'),
    workHoursEnd: readStr(row, 'work_hours_end', '17:00'),
    enforceWorkHours: readBool(row, 'enforce_work_hours'),
    workDays: readJson<number[]>(row, 'work_days', [0, 1, 2, 3, 4]),
    essentialsModeEnabled: readBool(row, 'essentials_mode_enabled'),
    showPoints: readBool(row, 'show_points'),
    showHints: readInt(row, 'show_hints', 1) !== 0,
    language: readStr(row, 'language', 'no') as Language,
    holidaysEnabled: readInt(row, 'holidays_enabled', 1) !== 0,
    darkMode: readStr(row, 'dark_mode', 'off') as DarkMode,
    childProfiles: readJson<string[]>(row, 'child_profiles', []),
    reducedMotion: readBool(row, 'reduced_motion'),
    particlesEnabled: readInt(row, 'particles_enabled', 1) !== 0,
    fontSize: readStr(row, 'font_size', 'default') as FontSizePref,
    leftHanded: readBool(row, 'left_handed'),
    persistentNotifEnabled: readBool(row, 'persistent_notif_enabled'),
    quietHoursEnabled: readBool(row, 'quiet_hours_enabled'),
    quietHoursStart: readStr(row, 'quiet_hours_start', '21:00'),
    quietHoursEnd: readStr(row, 'quiet_hours_end', '08:00'),
    monthlyBudgetNok: readReal(row, 'monthly_budget_nok'),
    debugModeEnabled: readBool(row, 'debug_mode_enabled'),
    lastMonthlyReset: readStr(row, 'last_monthly_reset'),
    habitNotificationsEnabled: readBool(row, 'habit_notifications_enabled'),
    locationEnabled: readBool(row, 'location_enabled'),
    backgroundLocationEnabled: readBool(row, 'background_location_enabled'),
    calendarSyncEnabled: readBool(row, 'calendar_sync_enabled'),
    voiceNotesEnabled: readBool(row, 'voice_notes_enabled'),
    accountName: readStr(row, 'account_name'),
    accountCreated: readStr(row, 'account_created'),
    childMode: readBool(row, 'child_mode'),
    childModePasswordSet: readBool(row, 'child_mode_password_set'),
    deviceId: readStr(row, 'device_id'),
    lanSyncEnabled: readBool(row, 'lan_sync_enabled'),
    autoBackupEnabled: readBool(row, 'auto_backup_enabled'),
    schoolModeEnabled: readBool(row, 'school_mode_enabled'),
  };
}

/** Settings field → column mapping; booleans/arrays serialised, so update() writes only changed columns. */
const bool = (v: boolean) => (v ? 1 : 0);
const SETTINGS_COLUMNS: FieldMap<Settings> = {
  userName: { col: 'user_name' },
  weeklyResetDay: { col: 'weekly_reset_day' },
  monthlyResetDate: { col: 'monthly_reset_date' },
  remindersEnabled: { col: 'reminders_enabled', to: bool },
  reminderTime: { col: 'reminder_time' },
  taskNotificationsEnabled: { col: 'task_notifications_enabled', to: bool },
  setupComplete: { col: 'setup_complete', to: bool },
  workModeEnabled: { col: 'work_mode_enabled', to: bool },
  workHoursStart: { col: 'work_hours_start' },
  workHoursEnd: { col: 'work_hours_end' },
  enforceWorkHours: { col: 'enforce_work_hours', to: bool },
  workDays: { col: 'work_days', to: (v) => JSON.stringify(v) },
  essentialsModeEnabled: { col: 'essentials_mode_enabled', to: bool },
  showPoints: { col: 'show_points', to: bool },
  showHints: { col: 'show_hints', to: bool },
  language: { col: 'language' },
  holidaysEnabled: { col: 'holidays_enabled', to: bool },
  darkMode: { col: 'dark_mode' },
  childProfiles: { col: 'child_profiles', to: (v) => JSON.stringify(v) },
  reducedMotion: { col: 'reduced_motion', to: bool },
  particlesEnabled: { col: 'particles_enabled', to: bool },
  fontSize: { col: 'font_size' },
  leftHanded: { col: 'left_handed', to: bool },
  persistentNotifEnabled: { col: 'persistent_notif_enabled', to: bool },
  quietHoursEnabled: { col: 'quiet_hours_enabled', to: bool },
  quietHoursStart: { col: 'quiet_hours_start' },
  quietHoursEnd: { col: 'quiet_hours_end' },
  monthlyBudgetNok: { col: 'monthly_budget_nok' },
  debugModeEnabled: { col: 'debug_mode_enabled', to: bool },
  lastMonthlyReset: { col: 'last_monthly_reset' },
  habitNotificationsEnabled: { col: 'habit_notifications_enabled', to: bool },
  locationEnabled: { col: 'location_enabled', to: bool },
  backgroundLocationEnabled: { col: 'background_location_enabled', to: bool },
  calendarSyncEnabled: { col: 'calendar_sync_enabled', to: bool },
  voiceNotesEnabled: { col: 'voice_notes_enabled', to: bool },
  accountName: { col: 'account_name' },
  accountCreated: { col: 'account_created' },
  childMode: { col: 'child_mode', to: bool },
  childModePasswordSet: { col: 'child_mode_password_set', to: bool },
  deviceId: { col: 'device_id' },
  lanSyncEnabled: { col: 'lan_sync_enabled', to: bool },
  autoBackupEnabled: { col: 'auto_backup_enabled', to: bool },
  schoolModeEnabled: { col: 'school_mode_enabled', to: bool },
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  userName: '',
  weeklyResetDay: 1,
  monthlyResetDate: 1,
  remindersEnabled: true,
  reminderTime: '08:00',
  taskNotificationsEnabled: true,
  setupComplete: false,
  workModeEnabled: false,
  workHoursStart: '07:00',
  workHoursEnd: '17:00',
  enforceWorkHours: false,
  workDays: [0, 1, 2, 3, 4],
  essentialsModeEnabled: false,
  showPoints: false,
  showHints: true,
  language: 'no' as Language,
  holidaysEnabled: true,
  // Decision 035: fresh-install default is light ('off'); 'system'/'on' are opt-in.
  // Stored user choices are preserved — load() reads dark_mode with an 'off' fallback,
  // so this default only applies when there's no settings row yet.
  darkMode: 'off' as DarkMode,
  childProfiles: [],
  reducedMotion: false,
  particlesEnabled: true,
  fontSize: 'default' as FontSizePref,
  leftHanded: false,
  persistentNotifEnabled: false,
  quietHoursEnabled: false,
  quietHoursStart: '21:00',
  quietHoursEnd: '08:00',
  monthlyBudgetNok: 0,
  debugModeEnabled: false,
  lastMonthlyReset: '',
  habitNotificationsEnabled: true,
  locationEnabled: false,
  backgroundLocationEnabled: false,
  calendarSyncEnabled: false,
  voiceNotesEnabled: false,
  accountName: '',
  accountCreated: '',
  childMode: false,
  childModePasswordSet: false,
  deviceId: '',
  lanSyncEnabled: false,
  autoBackupEnabled: false,
  schoolModeEnabled: false,
  loaded: false,
  workModeSessionOverride: false,

  load() {
    const settings = loadFirst('settings', rowToSettings, { where: 'id = 1' });
    set(settings ? { ...settings, loaded: true } : { loaded: true });
    // Self-heal: a fresh install (or one that predates Decision 038 wiring) has no
    // device_id yet. Generate one once and persist it immediately so it's stable
    // across relaunches — every peer that pairs with this install remembers THIS id.
    if (settings && !settings.deviceId) {
      const deviceId = generateId();
      set({ deviceId });
      try {
        updateRow('settings', rowValues({ deviceId }, SETTINGS_COLUMNS), 'id = 1');
      } catch {
        // DB write failed — deviceId still set in memory for this session
      }
    }
  },

  update(patch) {
    set((s) => {
      const next = { ...s, ...patch };
      try {
        // Writes only the columns present in `patch` (was a 43-column rewrite per call).
        updateRow('settings', rowValues(patch, SETTINGS_COLUMNS), 'id = 1');
      } catch {
        // DB write failed (e.g. column not yet migrated) — state still updates in memory
      }
      return next;
    });
  },

  setWorkModeSessionOverride(v) {
    set({ workModeSessionOverride: v });
  },
}));
