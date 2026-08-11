/**
 * useHabitStore.ts — habits and their daily completion logs
 *
 * Zustand store for habits (with optional per-habit daily reminders) and the per-day
 * count logs the UI reads for progress dots/week strip/energy. Schedules each habit's
 * notification when added/updated
 * and exposes syncAllHabitReminders for re-scheduling. NOTE: the build/break `kind`
 * distinction and the cue/craving/response/reward fields are no longer used by the UI
 * (habits are now simple/task-shaped) — the columns and type members are retained for
 * back-compat, but new habits are written with kind='neutral' and empty step fields.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id, lib/habitNotifications, store/useSettingsStore,
 *             store/useGoalStore (registerProgress on increment when a habit has a goalId),
 *             lib/widgets/sync (scheduleWidgetSync — debounced widget/notification refresh on
 *             add/update/remove/increment/decrement/markRestDay, so live widgets don't wait for
 *             foreground/background)
 *   Used by → app/habit-form.tsx, app/(tabs)/habits.tsx (its own bottom-nav tab again as of
 *             2026-07-23 — see that file's header for the fold-in/split-out history);
 *             app/_layout.tsx, app/settings.tsx, lib/useGhostTimeout.ts (indirectly, via
 *             habits.tsx's use of `lastDeleted`/`restoreLastDeleted`/`dismissLastDeleted`)
 *   Data    → defines a Zustand store; owns SQLite tables habits and habit_logs; schedules per-habit
 *             daily notifications; `habits.goal_id` is a nullable app-enforced pointer to a `goals` row
 *
 * Edit notes:
 *   - Per-habit daily reminders are scheduled here via syncHabitReminder() (ids `habit-<id>-<i>`, one per time in notificationTimes); call syncAllHabitReminders() after a language change since strings are baked in.
 *   - load() only fetches active habits (`deleted_at IS NULL`) and the last 35 days of logs — not full history.
 *   - **Undoable delete (2026-08-01, user report: "no way to recover a deleted habit").**
 *     `remove()` is a device-local soft-delete (tombstone) rather than a hard DELETE — habits
 *     aren't a SyncTable, so this is a plain column update, not lib/liveSync's touchRow/
 *     softDelete. habit_logs are left untouched (see remove()'s own comment for why that's
 *     safe). `lastDeleted` holds the removed habit in memory so app/(tabs)/habits.tsx can show
 *     an inline "ghost" row (components/GhostRow.tsx) with a restore action for a few seconds
 *     (lib/useGhostTimeout.ts) — replaces the old confirm-then-irreversible-delete flow in
 *     app/habit-form.tsx, mirroring useTaskStore's tombstone-instead-of-confirm precedent.
 *     Tombstoned habits are never purged (no pruneOldData() entry) — same as shopping_items.
 *   - User-facing notification strings go through getTranslations(useSettingsStore.getState().language), NOT useT.
 *   - New columns go through the migrations array in lib/db.ts; never recreate tables.
 *   - markRestDay() toggles the rest_day flag on a habit_logs row (upserting one if it doesn't
 *     exist yet) — a no-shame opt-out, framed as "Resting today" in app/(tabs)/habits.tsx, never
 *     "skipped". No streak system exists to protect (removed 2026-07-20) — a rest day is purely
 *     neutral: lib/habitRecurrence.ts's habitMetOn excludes it from that day's Energy delta entirely, so
 *     it's neither a reward nor a penalty, just a day the habit's energy sits still.
 *   - **`energyEnabled`/`energyValue`** (2026-07-20) — optional Energy-system participation.
 *     When energyEnabled, MEETING the habit on a day (and not resting) applies the signed
 *     energyValue (positive restores energy, negative drains) to that day's/week's budget
 *     (lib/energy.ts, components/EnergyMeter.tsx). Also shown directly on the habit card as a
 *     small +/- pill (app/(tabs)/habits.tsx's EnergyBadge) — replaced the old streak badge.
 *     Always active — Energy stopped being a toggle (2026-07-26); a 0 value means no effect.
 *   - **This store awards nothing (2026-07-31).** A Bonsai/points counter briefly lived in
 *     increment() and was removed the same day along with the rest of that system. The
 *     replacement reward (lib/growth.ts) DERIVES its streak by reading habit_logs after the
 *     fact, so there is no award hook here to keep in sync and no counter that a failed
 *     write could desynchronise. Don't reintroduce one: if the reward needs to know about a
 *     habit, it can read the logs.
 *   - **Decision 016 Q2 — no legacy `notificationTime` field.** `notificationTimes` is the
 *     sole live source of truth; the `notification_time` DB column is dead (never read/written
 *     here — see lib/db.ts's header for the precedent).
 *   - **Decision 016 Q3 (3B-ii) — `reminderMode`/`reminderCount`/`reminderIntervalMin`/
 *     `reminderStart`/`reminderEnd` are editing metadata only.** They exist purely so
 *     app/habit-form.tsx can reopen a habit in the mode that created it; scheduling always
 *     reads `notificationTimes`, never recomputes it from these. If they ever disagree, the
 *     list wins.
 *   - **`recurrenceInterval` (2026-08-11) — a multiplier on `recurrence`, not a new kind.**
 *     "Every N days" ('daily') or "every N weeks" ('weekly'); `monthly`/`one-time`/
 *     `weekly-flexible` ignore it. This store only reads/writes the raw number — the actual
 *     "is this habit due today" decision (including the phase anchor, derived from
 *     `createdAt` rather than a stored column) lives entirely in lib/habitRecurrence.ts's
 *     `habitOccursOn`. Don't duplicate that logic here.
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
import { dateStr, nowHHMM } from '@/lib/date';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useGoalStore } from '@/store/useGoalStore';
import { syncHabitReminder as scheduleHabitReminder, cancelHabitReminders } from '@/lib/habitNotifications';
import { scheduleWidgetSync } from '@/lib/widgets/sync';

export type HabitKind = 'build' | 'break' | 'neutral';
/** 'weekly-flexible' (2026-07-22) — due every day of the week; met once the week's
 *  cumulative logged count reaches dailyGoal (reused as a per-week target in this
 *  mode), regardless of which specific days it happened on. See lib/habitRecurrence.ts. */
export type HabitRecurrence = 'daily' | 'weekly' | 'monthly' | 'one-time' | 'weekly-flexible';
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
  /** "Every N days"/"every N weeks" multiplier on 'daily'/'weekly' recurrence (2026-08-11) —
   *  NOT a new recurrence kind. `monthly`/`one-time`/`weekly-flexible` ignore it. N<=1 is
   *  today's plain-daily/weekly behaviour, byte-identical. See lib/habitRecurrence.ts, which
   *  is the ONLY place this is read for scheduling — derives the phase anchor from
   *  `createdAt` rather than storing a second column. Modeled on useTaskStore's
   *  `weekInterval` (`tasks.recurring_week_interval`). */
  recurrenceInterval: number;
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
   *  a non-zero value. See lib/energy.ts. */
  energyEnabled: boolean;
  energyValue: number;
  /** Goals (2026-07-23) — id of the Goal this habit is connected to, or null. Logging the
   *  habit (increment) nudges that goal's strength up. Set through the normal add/update
   *  payload (a plain nullable pointer). */
  goalId: string | null;
};

export type HabitLog = {
  id: string;
  habitId: string;
  logDate: string;
  count: number;
  restDay: boolean;
  /**
   * Local 'HH:MM' the habit was FIRST logged that day — what places it in the day log
   * (lib/dayLog.ts). '' means no honest time: the log predates this column, or the count
   * has been taken back to 0.
   *
   * Deliberately the first log rather than the moment `dailyGoal` was reached — see the
   * migration's note in lib/db.ts. Do not "improve" this into a met-ness check.
   */
  firstAt: string;
};

type HabitStore = {
  habits: Habit[];
  logs: HabitLog[];
  /**
   * The most recently removed habit, held in memory only — not persisted, not synced.
   * Lets app/(tabs)/habits.tsx render an inline "ghost" row with a restore action for a few
   * seconds after a delete made anywhere (the list itself, or the full-screen editor's
   * Delete button), via lib/useGhostTimeout.ts. Only one at a time: a second delete simply
   * replaces it, same as useTaskStore's `deletedTasks` zone holding a rolling set rather
   * than this hook needing a queue.
   */
  lastDeleted: Habit | null;
  /**
   * Has `load()` run at least once? (2026-08-03.) Mirrors `useTaskStore.loaded` and
   * `useEnergyStore.loaded`, and exists for the same reason they do: an unloaded store is
   * indistinguishable from an empty one, so a consumer that draws different UI for "the user
   * has nothing" needs to know which it is looking at. Added for
   * components/EnergyMeter.tsx's tutorial state, which would otherwise flash two sentences of
   * teaching copy at anyone whose energy items are all habits.
   */
  loaded: boolean;
  load: () => void;
  // goalId is optional here (defaults to null) so habit seeders/quick-adds needn't set it.
  // recurrenceInterval is likewise optional (defaults to 1, same as the column's own
  // DEFAULT) so every pre-existing caller — freyrModeSeed.ts's ten habits, the quick-adds
  // before this feature — keeps compiling unchanged; mirrors useTaskStore.add()'s
  // `weekInterval?: number`.
  // Returns the created Habit (mirrors useTaskStore's add) so a caller can act on its id
  // right away — e.g. HomeHabitsCard's quick-add "…" button, which navigates straight to
  // that same habit's full editor without waiting for a re-render.
  add: (
    h: Omit<Habit, 'id' | 'createdAt' | 'active' | 'goalId' | 'recurrenceInterval'> & {
      goalId?: string | null;
      recurrenceInterval?: number;
    }
  ) => Habit;
  update: (id: string, patch: Partial<Omit<Habit, 'id'>>) => void;
  /** Soft-deletes (tombstone) — see `lastDeleted`'s doc. habit_logs are left untouched so a
   *  restore brings back full history, not just the habit shell. */
  remove: (id: string) => void;
  /** Undo a `remove()` — clears the tombstone, reloads, and re-arms the habit's reminder. */
  restoreLastDeleted: () => void;
  /** Drop the pending ghost without restoring — called once its undo window closes
   *  (lib/useGhostTimeout.ts). The habit stays tombstoned; this only ends the offer to
   *  bring it back. */
  dismissLastDeleted: () => void;
  /**
   * Commit a drag-reorder: `orderedIds` is the rows the user could SEE, in their new order.
   * Replaced a neighbour-swapping `reorder(id, 'up' | 'down')` on 2026-08-01 — that one had
   * no caller anywhere in the app, and the gesture the app actually uses is a drag.
   */
  reorder: (orderedIds: string[]) => void;
  increment: (habitId: string, date: string) => void;
  decrement: (habitId: string, date: string) => void;
  /** Toggle a day between "resting" and normal — no-shame opt-out; neutral for Energy (lib/energy.ts). */
  markRestDay: (habitId: string, date: string) => void;
  /** Re-schedule every habit's daily reminder (after a language or quiet-hours change). */
  syncAllHabitReminders: () => void;
  /** Goals — clear a deleted goal's id from any habit's in-memory goalId (DB nulling is done
   *  by useGoalStore.remove() in the same transaction as the delete). */
  clearGoal: (goalId: string) => void;
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
    icon: readStr(row, 'icon') || 'ellipse-outline',
    kind: (readStr(row, 'kind') || 'build') as HabitKind,
    category: (readStr(row, 'category') || 'other') as HabitCategory,
    cue: readStr(row, 'cue'),
    craving: readStr(row, 'craving'),
    response: readStr(row, 'response'),
    reward: readStr(row, 'reward'),
    dailyGoal: readInt(row, 'daily_goal') || 1,
    recurrence: (readStr(row, 'recurrence') || 'daily') as HabitRecurrence,
    recurrenceDays: readJson<number[]>(row, 'recurrence_days', []),
    recurrenceInterval: readInt(row, 'recurrence_interval', 1) || 1,
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
    goalId: readStr(row, 'goal_id') || null,
  };
}

function rowToLog(row: Row): HabitLog {
  return {
    id: readStr(row, 'id'),
    habitId: readStr(row, 'habit_id'),
    logDate: readStr(row, 'log_date'),
    count: readInt(row, 'count'),
    restDay: readBool(row, 'rest_day'),
    firstAt: readStr(row, 'first_at'),
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
  recurrenceInterval: { col: 'recurrence_interval', to: (v) => v ?? 1 },
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
  goalId: { col: 'goal_id', to: (v) => v ?? null },
};

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  logs: [],
  lastDeleted: null,
  loaded: false,

  load() {
    const since = new Date();
    since.setDate(since.getDate() - 35);
    const sinceStr = dateStr(since); // local date, matching log_date storage (see lib/db.ts pruneOldData)
    set({
      habits: loadAll('habits', rowToHabit, { where: 'active = 1 AND deleted_at IS NULL', orderBy: 'routine_order, created_at' }),
      logs: loadAll('habit_logs', rowToLog, { where: 'log_date >= ?', params: [sinceStr] }),
      loaded: true,
    });
  },

  add(h) {
    const id = generateId();
    const now = new Date().toISOString();
    const routineOrder = h.routineOrder || Date.now();
    const habit: Habit = {
      ...h,
      id,
      routineOrder,
      active: true,
      createdAt: now,
      goalId: h.goalId ?? null,
      recurrenceInterval: h.recurrenceInterval ?? 1,
    };
    insertRow('habits', rowValues(habit, HABIT_COLUMNS));
    set((s) => ({ habits: [...s.habits, habit].sort((a, b) => a.routineOrder - b.routineOrder) }));
    syncHabitReminder(habit);
    scheduleWidgetSync();
    return habit;
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
    scheduleWidgetSync();
  },

  remove(id) {
    const habit = get().habits.find((h) => h.id === id);
    if (!habit) return;
    // Soft-delete (tombstone), not a hard DELETE — see `lastDeleted`'s doc. habit_logs are
    // deliberately left in place: nothing reads them independent of an active habit (see
    // lib/growth.ts/lib/widgets/sync.ts, which both iterate `habits` and look up logs from
    // there), so an orphaned log is inert, and keeping it is what lets a restore bring back
    // full history instead of a blank habit.
    db.runSync('UPDATE habits SET deleted_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    void cancelHabitReminders(id);
    set((s) => ({
      habits: s.habits.filter((h) => h.id !== id),
      lastDeleted: habit,
    }));
    scheduleWidgetSync();
  },

  restoreLastDeleted() {
    const habit = get().lastDeleted;
    if (!habit) return;
    db.runSync('UPDATE habits SET deleted_at = NULL WHERE id = ?', [habit.id]);
    get().load();
    const restored = get().habits.find((h) => h.id === habit.id);
    if (restored) syncHabitReminder(restored);
    set({ lastDeleted: null });
    scheduleWidgetSync();
  },

  dismissLastDeleted() {
    set({ lastDeleted: null });
  },

  /**
   * Drag-reorder commit (app/(tabs)/habits.tsx, via lib/useDragReorder).
   *
   * `orderedIds` is only what the screen was DRAWING — the Today list is filtered by person
   * and by whether the habit is due today, so most of the time it is a subset. The rows the
   * user couldn't see must not move relative to the ones they could, so this doesn't renumber
   * the subset 0…n-1: it takes the full list in its current order, drops the moved ids back
   * into the SLOTS they already occupied (in the caller's new order), and renumbers everything
   * from that. A hidden habit therefore keeps whichever visible habits it sat between.
   *
   * Renumbering all of them each time is also what makes this safe on a fresh install, where
   * every `routine_order` is still 0 and a swap of two equal numbers would be a no-op.
   */
  reorder(orderedIds) {
    const { habits } = get();
    // load()'s ordering, so "current order" here means what the screen was showing.
    const sorted = [...habits].sort(
      (a, b) => a.routineOrder - b.routineOrder || a.createdAt.localeCompare(b.createdAt)
    );
    const queue = orderedIds.filter((id) => habits.some((h) => h.id === id));
    if (queue.length < 2) return;
    const moving = new Set(queue);
    const nextIds = sorted.map((h) => (moving.has(h.id) ? queue.shift()! : h.id));
    const position = new Map(nextIds.map((id, i) => [id, i]));
    nextIds.forEach((id, i) => updateRow('habits', { routine_order: i }, 'id = ?', [id]));
    set((s) => ({
      habits: [...s.habits]
        .map((h) => ({ ...h, routineOrder: position.get(h.id) ?? h.routineOrder }))
        .sort((a, b) => a.routineOrder - b.routineOrder),
    }));
  },

  increment(habitId, date) {
    const { logs, habits } = get();
    const habit = habits.find((h) => h.id === habitId);
    const existing = logs.find((l) => l.habitId === habitId && l.logDate === date);
    if (existing) {
      const newCount = existing.count + 1;
      // Stamp only when there isn't one yet — this is the FIRST time today, so a second
      // and third log of the same habit must not move it. An existing row can legitimately
      // arrive here with `firstAt: ''`: it was decremented back to 0, or it predates the
      // column, or it was created by markRestDay(). See lib/db.ts's migration note.
      const firstAt = existing.firstAt || nowHHMM();
      updateRow('habit_logs', { count: newCount, first_at: firstAt }, 'id = ?', [existing.id]);
      set((s) => ({
        logs: s.logs.map((l) => (l.id === existing.id ? { ...l, count: newCount, firstAt } : l)),
      }));
    } else {
      const id = generateId();
      const firstAt = nowHHMM();
      insertRow('habit_logs', { id, habit_id: habitId, log_date: date, count: 1, first_at: firstAt });
      set((s) => ({
        logs: [...s.logs, { id, habitId, logDate: date, count: 1, restDay: false, firstAt }],
      }));
    }
    // Goals: logging a linked habit nudges its goal's "living glow" up (decrement never
    // lowers it — no punishment; decay handles the fade). See store/useGoalStore.ts.
    if (habit?.goalId) useGoalStore.getState().registerProgress(habit.goalId);
    scheduleWidgetSync();
  },

  decrement(habitId, date) {
    const { logs } = get();
    const existing = logs.find((l) => l.habitId === habitId && l.logDate === date);
    if (!existing || existing.count <= 0) return;
    const newCount = existing.count - 1;
    // Back to zero means it didn't happen after all — clear the stamp so the day log holds
    // no trace of it, exactly as un-ticking a task clears tasks.done_at. Above zero the
    // original first-log time still stands.
    const firstAt = newCount === 0 ? '' : existing.firstAt;
    updateRow('habit_logs', { count: newCount, first_at: firstAt }, 'id = ?', [existing.id]);
    set((s) => ({
      logs: s.logs.map((l) => (l.id === existing.id ? { ...l, count: newCount, firstAt } : l)),
    }));
    scheduleWidgetSync();
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
      // No `first_at`: a rest day is not something you did, so it never enters the day log
      // (which also excludes rest days at read time — the two agree by construction).
      const id = generateId();
      insertRow('habit_logs', { id, habit_id: habitId, log_date: date, count: 0, rest_day: 1 });
      set((s) => ({
        logs: [...s.logs, { id, habitId, logDate: date, count: 0, restDay: true, firstAt: '' }],
      }));
    }
    scheduleWidgetSync();
  },

  syncAllHabitReminders() {
    get().habits.forEach(syncHabitReminder);
  },

  clearGoal(goalId) {
    set((s) => ({ habits: s.habits.map((h) => (h.goalId === goalId ? { ...h, goalId: null } : h)) }));
  },
}));
