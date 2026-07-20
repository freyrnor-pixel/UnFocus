/**
 * useHabitStore.ts — habits and their daily completion logs
 *
 * Zustand store for habits (with optional per-habit daily reminders) and the per-day
 * count logs that drive streaks. Schedules each habit's notification when added/updated
 * and exposes syncAllHabitReminders for re-scheduling. NOTE: the build/break `kind`
 * distinction and the cue/craving/response/reward fields are no longer used by the UI
 * (habits are now simple/task-shaped) — the columns and type members are retained for
 * back-compat, but new habits are written with kind='neutral' and empty step fields.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id, lib/habitNotifications, store/useSettingsStore,
 *             store/useTaskStore (Importance type only)
 *   Used by → app/habit-form.tsx, app/(tabs)/health.tsx (embedded Habits section — the former
 *             standalone app/habits.tsx was folded directly into it, no separate route anymore);
 *             app/_layout.tsx, app/settings.tsx
 *   Data    → defines a Zustand store; owns SQLite tables habits and habit_logs; schedules per-habit daily notifications
 *
 * Edit notes:
 *   - Per-habit daily reminders are scheduled here via syncHabitReminder() (ids `habit-<id>-<i>`, one per time in notificationTimes); call syncAllHabitReminders() after a language change since strings are baked in.
 *   - load() only fetches active habits and the last 35 days of logs (streak window) — not full history.
 *   - User-facing notification strings go through getTranslations(useSettingsStore.getState().language), NOT useT.
 *   - New columns go through the migrations array in lib/db.ts; never recreate tables.
 *   - markRestDay() toggles the rest_day flag on a habit_logs row (upserting one if it doesn't
 *     exist yet) — a no-shame opt-out, framed as "Resting today" in app/(tabs)/health.tsx, never
 *     "skipped". computeStreak() there treats a rest day like a met day so the streak survives it.
 *   - **`energyEnabled`/`energyValue`** (2026-07-20) — optional Energy-system participation.
 *     When energyEnabled, MEETING the habit on a day applies the signed energyValue (positive
 *     restores energy, negative drains) to that day's/week's budget (lib/energy.ts,
 *     components/EnergyMeter.tsx). Only matters when settings.energySystemEnabled.
 *   - **Decision 016 Q2 — no legacy `notificationTime` field.** `notificationTimes` is the
 *     sole live source of truth; the `notification_time` DB column is dead (never read/written
 *     here — see lib/db.ts's header for the precedent).
 *   - **Decision 016 Q3 (3B-ii) — `reminderMode`/`reminderCount`/`reminderIntervalMin`/
 *     `reminderStart`/`reminderEnd` are editing metadata only.** They exist purely so
 *     app/habit-form.tsx can reopen a habit in the mode that created it; scheduling always
 *     reads `notificationTimes`, never recomputes it from these. If they ever disagree, the
 *     list wins.
 */
import { create } from 'zustand';
import db from '@/lib/db';
import {
  Row,
  FieldMap,
  loadAll,
  insertRow,
  updateRow,
  rowValues,
  readStr,
  readInt,
  readBool,
  readJson,
} from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { dateStr } from '@/lib/date';
import { useSettingsStore } from '@/store/useSettingsStore';
import { syncHabitReminder as scheduleHabitReminder, cancelHabitReminders } from '@/lib/habitNotifications';

export type HabitKind = 'build' | 'break' | 'neutral';
export type HabitRecurrence = 'daily' | 'weekly' | 'monthly' | 'one-time';
export type HabitCategory =
  | 'physical' | 'mental' | 'health' | 'nutrition'
  | 'sleep' | 'work' | 'wellbeing' | 'other';
/** The three-mode reminder picker in app/habit-form.tsx (Decision 016 Q1 — ported as-is). */
export type HabitReminderMode = 'single' | 'count' | 'interval';

export type Habit = {
  id: string;
  title: string;
  icon: string;
  kind: HabitKind;
  category: HabitCategory;
  cue: string;
  craving: string;
  response: string;
  reward: string;
  dailyGoal: number;
  recurrence: HabitRecurrence;
  recurrenceDays: number[];
  notificationEnabled: boolean;
  /** All daily reminder times (HH:MM). Empty = no reminders. Sole source of truth for scheduling. */
  notificationTimes: string[];
  /** Editing recipe that produced notificationTimes (Decision 016 Q3) — metadata only, null when never set or notifications are off. */
  reminderMode: HabitReminderMode | null;
  reminderCount: number | null;
  reminderIntervalMin: number | null;
  reminderStart: string | null;
  reminderEnd: string | null;
  routineOrder: number;
  active: boolean;
  createdAt: string;
  childName: string;
  /** Energy system (2026-07-20) — when energyEnabled, MEETING this habit on a day
   *  applies a SIGNED energyValue to that day's/week's budget (positive restores,
   *  e.g. drinking water = +1; negative drains). Only affects anything when
   *  settings.energySystemEnabled. See lib/energy.ts. */
  energyEnabled: boolean;
  energyValue: number;
};

export type HabitLog = {
  id: string;
  habitId: string;
  logDate: string;
  count: number;
  restDay: boolean;
};

type HabitStore = {
  habits: Habit[];
  logs: HabitLog[];
  load: () => void;
  add: (h: Omit<Habit, 'id' | 'createdAt' | 'active'>) => void;
  update: (id: string, patch: Partial<Omit<Habit, 'id'>>) => void;
  remove: (id: string) => void;
  reorder: (id: string, direction: 'up' | 'down') => void;
  increment: (habitId: string, date: string) => void;
  decrement: (habitId: string, date: string) => void;
  /** Toggle a day between "resting" and normal — no-shame opt-out that keeps the streak alive. */
  markRestDay: (habitId: string, date: string) => void;
  /** Re-schedule every habit's daily reminder (after a language or quiet-hours change). */
  syncAllHabitReminders: () => void;
};

/** Schedule (or cancel) a habit's daily reminder using the current language/quiet-hours settings. */
function syncHabitReminder(habit: Habit): void {
  const s = useSettingsStore.getState();
  scheduleHabitReminder(habit, {
    habitNotificationsEnabled: s.habitNotificationsEnabled,
    language: s.language,
    quietHoursEnabled: s.quietHoursEnabled,
    quietHoursStart: s.quietHoursStart,
    quietHoursEnd: s.quietHoursEnd,
  });
}

function rowToHabit(row: Row): Habit {
  const reminderCountRaw = row['reminder_count'];
  const reminderIntervalRaw = row['reminder_interval_min'];
  return {
    id: readStr(row, 'id'),
    title: readStr(row, 'title'),
    icon: readStr(row, 'icon') || '⭐',
    kind: (readStr(row, 'kind') || 'build') as HabitKind,
    category: (readStr(row, 'category') || 'other') as HabitCategory,
    cue: readStr(row, 'cue'),
    craving: readStr(row, 'craving'),
    response: readStr(row, 'response'),
    reward: readStr(row, 'reward'),
    dailyGoal: readInt(row, 'daily_goal') || 1,
    recurrence: (readStr(row, 'recurrence') || 'daily') as HabitRecurrence,
    recurrenceDays: readJson<number[]>(row, 'recurrence_days', []),
    notificationEnabled: readBool(row, 'notification_enabled'),
    notificationTimes: readJson<string[]>(row, 'notification_times', []),
    reminderMode: (readStr(row, 'reminder_mode') || null) as HabitReminderMode | null,
    reminderCount: reminderCountRaw == null ? null : Number(reminderCountRaw),
    reminderIntervalMin: reminderIntervalRaw == null ? null : Number(reminderIntervalRaw),
    reminderStart: readStr(row, 'reminder_start') || null,
    reminderEnd: readStr(row, 'reminder_end') || null,
    routineOrder: readInt(row, 'routine_order'),
    active: readInt(row, 'active', 1) !== 0,
    createdAt: readStr(row, 'created_at'),
    childName: readStr(row, 'child_name'),
    energyEnabled: readBool(row, 'energy_enabled'),
    energyValue: readInt(row, 'energy_value', 1),
  };
}

function rowToLog(row: Row): HabitLog {
  return {
    id: readStr(row, 'id'),
    habitId: readStr(row, 'habit_id'),
    logDate: readStr(row, 'log_date'),
    count: readInt(row, 'count'),
    restDay: readBool(row, 'rest_day'),
  };
}

/** Field → column mapping for habits (serialisers preserve the old INSERT/UPDATE defaults). */
const HABIT_COLUMNS: FieldMap<Habit> = {
  id: { col: 'id' },
  title: { col: 'title' },
  icon: { col: 'icon' },
  kind: { col: 'kind' },
  category: { col: 'category' },
  cue: { col: 'cue' },
  craving: { col: 'craving' },
  response: { col: 'response' },
  reward: { col: 'reward' },
  dailyGoal: { col: 'daily_goal' },
  recurrence: { col: 'recurrence' },
  recurrenceDays: { col: 'recurrence_days', to: (v) => JSON.stringify(v ?? []) },
  notificationEnabled: { col: 'notification_enabled', to: (v) => (v ? 1 : 0) },
  notificationTimes: { col: 'notification_times', to: (v) => JSON.stringify(v ?? []) },
  reminderMode: { col: 'reminder_mode' },
  reminderCount: { col: 'reminder_count' },
  reminderIntervalMin: { col: 'reminder_interval_min' },
  reminderStart: { col: 'reminder_start' },
  reminderEnd: { col: 'reminder_end' },
  routineOrder: { col: 'routine_order' },
  active: { col: 'active', to: (v) => (v ? 1 : 0) },
  createdAt: { col: 'created_at' },
  childName: { col: 'child_name', to: (v) => v || '' },
  energyEnabled: { col: 'energy_enabled', to: (v) => (v ? 1 : 0) },
  energyValue: { col: 'energy_value', to: (v) => v ?? 1 },
};

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  logs: [],

  load() {
    const since = new Date();
    since.setDate(since.getDate() - 35);
    const sinceStr = dateStr(since); // local date, matching log_date storage (see lib/db.ts pruneOldData)
    set({
      habits: loadAll('habits', rowToHabit, { where: 'active = 1', orderBy: 'routine_order, created_at' }),
      logs: loadAll('habit_logs', rowToLog, { where: 'log_date >= ?', params: [sinceStr] }),
    });
  },

  add(h) {
    const id = generateId();
    const now = new Date().toISOString();
    const routineOrder = h.routineOrder || Date.now();
    const habit: Habit = { ...h, id, routineOrder, active: true, createdAt: now };
    insertRow('habits', rowValues(habit, HABIT_COLUMNS));
    set((s) => ({ habits: [...s.habits, habit].sort((a, b) => a.routineOrder - b.routineOrder) }));
    syncHabitReminder(habit);
  },

  update(id, patch) {
    const habit = get().habits.find((h) => h.id === id);
    if (!habit) return;
    const next = { ...habit, ...patch };
    updateRow('habits', rowValues(patch, HABIT_COLUMNS), 'id = ?', [id]);
    set((s) => ({
      habits: s.habits.map((h) => (h.id === id ? next : h)).sort((a, b) => a.routineOrder - b.routineOrder),
    }));
    syncHabitReminder(next);
  },

  remove(id) {
    db.runSync('DELETE FROM habits WHERE id = ?', [id]);
    db.runSync('DELETE FROM habit_logs WHERE habit_id = ?', [id]);
    void cancelHabitReminders(id);
    set((s) => ({
      habits: s.habits.filter((h) => h.id !== id),
      logs: s.logs.filter((l) => l.habitId !== id),
    }));
  },

  reorder(id, direction) {
    const { habits } = get();
    const sorted = [...habits].sort((a, b) => a.routineOrder - b.routineOrder);
    const idx = sorted.findIndex((h) => h.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const aOrder = a.routineOrder;
    const bOrder = b.routineOrder;
    updateRow('habits', { routine_order: bOrder }, 'id = ?', [a.id]);
    updateRow('habits', { routine_order: aOrder }, 'id = ?', [b.id]);
    set((s) => ({
      habits: s.habits.map((h) => {
        if (h.id === a.id) return { ...h, routineOrder: bOrder };
        if (h.id === b.id) return { ...h, routineOrder: aOrder };
        return h;
      }).sort((x, y) => x.routineOrder - y.routineOrder),
    }));
  },

  increment(habitId, date) {
    const { logs } = get();
    const existing = logs.find((l) => l.habitId === habitId && l.logDate === date);
    if (existing) {
      const newCount = existing.count + 1;
      updateRow('habit_logs', { count: newCount }, 'id = ?', [existing.id]);
      set((s) => ({
        logs: s.logs.map((l) => (l.id === existing.id ? { ...l, count: newCount } : l)),
      }));
    } else {
      const id = generateId();
      insertRow('habit_logs', { id, habit_id: habitId, log_date: date, count: 1 });
      set((s) => ({ logs: [...s.logs, { id, habitId, logDate: date, count: 1, restDay: false }] }));
    }
  },

  decrement(habitId, date) {
    const { logs } = get();
    const existing = logs.find((l) => l.habitId === habitId && l.logDate === date);
    if (!existing || existing.count <= 0) return;
    const newCount = existing.count - 1;
    updateRow('habit_logs', { count: newCount }, 'id = ?', [existing.id]);
    set((s) => ({
      logs: s.logs.map((l) => (l.id === existing.id ? { ...l, count: newCount } : l)),
    }));
  },

  markRestDay(habitId, date) {
    const { logs } = get();
    const existing = logs.find((l) => l.habitId === habitId && l.logDate === date);
    if (existing) {
      const restDay = !existing.restDay;
      updateRow('habit_logs', { rest_day: restDay ? 1 : 0 }, 'id = ?', [existing.id]);
      set((s) => ({
        logs: s.logs.map((l) => (l.id === existing.id ? { ...l, restDay } : l)),
      }));
    } else {
      const id = generateId();
      insertRow('habit_logs', { id, habit_id: habitId, log_date: date, count: 0, rest_day: 1 });
      set((s) => ({ logs: [...s.logs, { id, habitId, logDate: date, count: 0, restDay: true }] }));
    }
  },

  syncAllHabitReminders() {
    get().habits.forEach(syncHabitReminder);
  },
}));
