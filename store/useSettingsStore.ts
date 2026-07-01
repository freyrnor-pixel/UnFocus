/**
 * useSettingsStore.ts — single-row app settings / preferences
 *
 * Zustand store mirroring the one settings row: user name, language, theme,
 * dark mode, reminder/notification toggles (including quiet hours, task/habit notification toggles), reset cadence,
 * work/essentials modes, onboarding state, accessibility flags, companion pet
 * settings, monthly grocery budget (monthlyBudgetNok), and the debug overlay's
 * enable flag + bubble-wheel tuning values.
 * persistentNotifEnabled toggles the always-current "today's overview" notification
 * (refreshed by app/_layout.tsx, see lib/notifications.ts's refreshPersistentNotification).
 * habitNotificationsEnabled gates all habit reminders.
 *
 * Connections:
 *   Imports → lib/dataAccess
 *   Used by → app/_layout.tsx, app/budget.tsx, app/habit-form.tsx, app/habits.tsx, app/index.tsx, app/onboarding/* , app/scan.tsx, app/settings.tsx, app/share-modal.tsx, app/shared.tsx, components/BubbleMenu.tsx, components/DebugOverlay.tsx, components/HintCard.tsx, components/ParticleBackground.tsx, components/QuickAddSheet.tsx, components/SharedRequestsSection.tsx, lib/i18n.ts, lib/reminders.ts, lib/useAppTheme.ts, store/useAutomationStore.ts, store/useHabitStore.ts, store/useTaskStore.ts
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

export type ColorTheme = 'default' | 'tech' | 'gothic' | 'nature' | 'fluffy' | 'custom';
export type Language = 'en' | 'no';
export type DarkMode = 'system' | 'on' | 'off';
export type FontSizePref = 'small' | 'default' | 'large';
export type PetType = 'cat' | 'dog' | 'bird' | 'fox' | 'bunny';
/** Surface finish for bubbles/FAB and, via Surface/ScreenBackground, cards and screen backdrops app-wide — see getMaterialStyle() in constants/theme.ts. */
export type BubbleMaterial = 'glass' | 'metal' | 'rock' | 'paper' | 'plain';

export type Settings = {
  userName: string;
  weeklyResetDay: number;
  monthlyResetDate: number;
  remindersEnabled: boolean;
  reminderTime: string;
  taskNotificationsEnabled: boolean;
  setupComplete: boolean;
  colorTheme: ColorTheme;
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
  // Companion pet (Proposal 6)
  petEnabled: boolean;
  petName: string;
  petType: PetType;
  petColor: string;
  // Left-handed mode
  leftHanded: boolean;
  // Custom theme colors
  customPrimaryColor: string;
  customSecondaryColor: string;
  // Custom theme accent hue (0-360); primary/secondary colors above are derived from this
  customHue: number;
  // Bubble menu surface finish
  bubbleMaterial: BubbleMaterial;
  // Persistent "today's overview" notification
  persistentNotifEnabled: boolean;
  // Notification quiet hours (AP-05)
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  // Monthly grocery budget (AP-06B), shown against receipts in app/budget.tsx
  monthlyBudgetNok: number;
  // Debug mode — feedback pins + bubble-wheel tuning overlay
  debugModeEnabled: boolean;
  bubbleSize: number;
  bubbleSpacing: number;
  bubbleSpringIntensity: number;
  bubbleAnimSpeed: number;
  // Last payday-boundary monthly reset, as YYYY-MM-DD; drives the automatic reset check in app/shopping.tsx
  lastMonthlyReset: string;
  // Habit reminders toggle
  habitNotificationsEnabled: boolean;
  // Permission toggles (permission pre-bake)
  locationEnabled: boolean;
  backgroundLocationEnabled: boolean;
  calendarSyncEnabled: boolean;
  voiceNotesEnabled: boolean;
};

type SettingsStore = Settings & {
  // Session-only (not persisted)
  loaded: boolean;
  workModeSessionOverride: boolean;
  load: () => void;
  update: (patch: Partial<Settings>) => void;
  setWorkModeSessionOverride: (v: boolean) => void;
};

/** Maps old theme names (1.0.0) to new ones (1.1.0). Returns null if name is already valid. */
function migrateThemeName(name: string | null): ColorTheme {
  if (!name) return 'default';
  const map: Record<string, ColorTheme> = {
    warm: 'default', cool: 'tech', forest: 'nature', rose: 'nature', highcontrast: 'default',
  };
  if (name in map) return map[name];
  const valid: ColorTheme[] = ['default', 'tech', 'gothic', 'nature', 'fluffy', 'custom'];
  return valid.includes(name as ColorTheme) ? (name as ColorTheme) : 'default';
}

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
    colorTheme: migrateThemeName(readStr(row, 'color_theme') || null),
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
    petEnabled: readBool(row, 'pet_enabled'),
    petName: readStr(row, 'pet_name'),
    petType: readStr(row, 'pet_type', 'cat') as PetType,
    petColor: readStr(row, 'pet_color', '#A78BFA'),
    leftHanded: readBool(row, 'left_handed'),
    customPrimaryColor: readStr(row, 'custom_primary_color', '#3B82F6'),
    customSecondaryColor: readStr(row, 'custom_secondary_color', '#10B981'),
    customHue: readInt(row, 'custom_hue', 217),
    bubbleMaterial: readStr(row, 'bubble_material', 'glass') as BubbleMaterial,
    persistentNotifEnabled: readBool(row, 'persistent_notif_enabled'),
    quietHoursEnabled: readBool(row, 'quiet_hours_enabled'),
    quietHoursStart: readStr(row, 'quiet_hours_start', '21:00'),
    quietHoursEnd: readStr(row, 'quiet_hours_end', '08:00'),
    monthlyBudgetNok: readReal(row, 'monthly_budget_nok'),
    debugModeEnabled: readBool(row, 'debug_mode_enabled'),
    bubbleSize: readReal(row, 'bubble_size', 50),
    bubbleSpacing: readReal(row, 'bubble_spacing', 78),
    bubbleSpringIntensity: readReal(row, 'bubble_spring_intensity', 50),
    bubbleAnimSpeed: readReal(row, 'bubble_anim_speed', 50),
    lastMonthlyReset: readStr(row, 'last_monthly_reset'),
    habitNotificationsEnabled: readBool(row, 'habit_notifications_enabled'),
    locationEnabled: readBool(row, 'location_enabled'),
    backgroundLocationEnabled: readBool(row, 'background_location_enabled'),
    calendarSyncEnabled: readBool(row, 'calendar_sync_enabled'),
    voiceNotesEnabled: readBool(row, 'voice_notes_enabled'),
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
  colorTheme: { col: 'color_theme' },
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
  petEnabled: { col: 'pet_enabled', to: bool },
  petName: { col: 'pet_name' },
  petType: { col: 'pet_type' },
  petColor: { col: 'pet_color' },
  leftHanded: { col: 'left_handed', to: bool },
  customPrimaryColor: { col: 'custom_primary_color' },
  customSecondaryColor: { col: 'custom_secondary_color' },
  customHue: { col: 'custom_hue' },
  bubbleMaterial: { col: 'bubble_material' },
  persistentNotifEnabled: { col: 'persistent_notif_enabled', to: bool },
  quietHoursEnabled: { col: 'quiet_hours_enabled', to: bool },
  quietHoursStart: { col: 'quiet_hours_start' },
  quietHoursEnd: { col: 'quiet_hours_end' },
  monthlyBudgetNok: { col: 'monthly_budget_nok' },
  debugModeEnabled: { col: 'debug_mode_enabled', to: bool },
  bubbleSize: { col: 'bubble_size' },
  bubbleSpacing: { col: 'bubble_spacing' },
  bubbleSpringIntensity: { col: 'bubble_spring_intensity' },
  bubbleAnimSpeed: { col: 'bubble_anim_speed' },
  lastMonthlyReset: { col: 'last_monthly_reset' },
  habitNotificationsEnabled: { col: 'habit_notifications_enabled', to: bool },
  locationEnabled: { col: 'location_enabled', to: bool },
  backgroundLocationEnabled: { col: 'background_location_enabled', to: bool },
  calendarSyncEnabled: { col: 'calendar_sync_enabled', to: bool },
  voiceNotesEnabled: { col: 'voice_notes_enabled', to: bool },
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  userName: '',
  weeklyResetDay: 1,
  monthlyResetDate: 1,
  remindersEnabled: true,
  reminderTime: '08:00',
  taskNotificationsEnabled: true,
  setupComplete: false,
  colorTheme: 'default',
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
  darkMode: 'system' as DarkMode,
  childProfiles: [],
  reducedMotion: false,
  particlesEnabled: true,
  fontSize: 'default' as FontSizePref,
  petEnabled: false,
  petName: '',
  petType: 'cat' as PetType,
  petColor: '#A78BFA',
  leftHanded: false,
  customPrimaryColor: '#3B82F6',
  customSecondaryColor: '#10B981',
  customHue: 217,
  bubbleMaterial: 'glass' as BubbleMaterial,
  persistentNotifEnabled: false,
  quietHoursEnabled: false,
  quietHoursStart: '21:00',
  quietHoursEnd: '08:00',
  monthlyBudgetNok: 0,
  debugModeEnabled: false,
  bubbleSize: 50,
  bubbleSpacing: 78,
  bubbleSpringIntensity: 50,
  bubbleAnimSpeed: 50,
  lastMonthlyReset: '',
  habitNotificationsEnabled: true,
  locationEnabled: false,
  backgroundLocationEnabled: false,
  calendarSyncEnabled: false,
  voiceNotesEnabled: false,
  loaded: false,
  workModeSessionOverride: false,

  load() {
    const settings = loadFirst('settings', rowToSettings, { where: 'id = 1' });
    set(settings ? { ...settings, loaded: true } : { loaded: true });
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
