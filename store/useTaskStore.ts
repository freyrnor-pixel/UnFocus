/**
 * useTaskStore.ts — tasks (one-off + weekly recurring), their steps, and the
 * Decision 019/020 additions (a display-only hint note and a one-to-one
 * "then" follower link).
 *
 * Zustand store for to-do tasks: one-off and weekly-recurring, start-at and
 * time-box types, with an optional per-task Energy value (energyEnabled/energyValue,
 * 2026-07-20 — a signed value applied to the day/week budget on completion; see
 * lib/energy.ts), a
 * manual sortOrder, and a backlog view. Real Phase 5 port replacing the
 * Decision 015 notImplemented stub.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id, lib/date, lib/notifications, lib/taskNotifications,
 *             lib/taskRecurrence (taskOccursOn — re-exported here for existing callers/tests),
 *             lib/taskCalendar (reserve-only calendar mirroring), lib/liveSync, lib/syncService,
 *             store/useAutomationStore, store/useSettingsStore (also lifetimeCompletedTasks,
 *             incremented/decremented here — see Edit notes),
 *             store/useSharedStore (setSharedOut emits an outgoing shared_tasks row)
 *   Used by → components/PlanTaskCard.tsx (Task type), components/DraggableTaskRow.tsx (Task type),
 *             components/TaskCard.tsx, app/task-form.tsx, app/(tabs)/plans.tsx, app/_layout.tsx
 *             (syncMonthlyTaskNotifications, on boot + every foreground)
 *
 *   Recurrence (Tasks/Oppgaver redesign): `recurring` is 'none'|'daily'|'weekly'|'monthly';
 *   taskOccursOn(task, date) (lib/taskRecurrence.ts) resolves an occurrence (weekly
 *   week-interval parity, monthly day-of-month clamp or nth/last weekday, has_start_date
 *   as a start boundary). Start/Finish time-box → duration_minutes is derived on save so
 *   PlanTaskCard is unchanged.
 *   Data    → defines a Zustand store; owns SQLite tables `tasks` and `task_steps`; fires the
 *             'task_completed' automation trigger on toggle-to-done / completeDirect
 *
 * Edit notes:
 *   - **LAN live-sync wiring (Decision 038, app integration) — WIRED.** `add`/`update`
 *     stamp the row via lib/liveSync's touchRow then lib/syncService's broadcastRow;
 *     `remove` soft-deletes (tombstone) instead of a hard DELETE so a peer sees the
 *     delete instead of a stale copy reviving it. `load()` filters `deleted_at IS
 *     NULL`. `clearAll()` (bulk local reset) is deliberately NOT broadcast — see its
 *     own comment. Both no-op safely when sync isn't running (broadcastRow) or a
 *     peer isn't connected.
 *   - **'task_completed' automation trigger — WIRED (Phase 6).** toggle() (only when the
 *     task transitions to done) and completeDirect() call
 *     `useAutomationStore.getState().fireTrigger('task_completed')`, matching the old store.
 *   - **Per-task notification scheduling — WIRED.** `add`/`update` reschedule via
 *     `syncTaskNotification` (which passes the current settings to
 *     `lib/taskNotifications.ts`); `remove`/`clearAll` cancel via
 *     `lib/notifications.ts`'s `cancelTaskNotification`. Notification copy is baked in
 *     at schedule time, so call `syncAllTaskNotifications()` after a settings/language
 *     change to re-schedule every task. Quiet hours SHIFT a task reminder past the
 *     window (habits skip instead — see lib/habitNotifications.ts). Daily-recurring
 *     tasks get a real repeating native trigger (like weekly); monthly-recurring tasks
 *     don't have one (no native "day-of-month, clamped"/"nth weekday" repeat), so
 *     they're scheduled as a one-off for their next occurrence and re-armed via
 *     `syncMonthlyTaskNotifications()` — called from app/_layout.tsx on boot and on
 *     every foreground, not just once ever.
 *   - **All-time completed-task counter (2026-07-20).** `completedCount()` was removed
 *     (single UI consumer, app/(tabs)/index.tsx, now reads `settings.lifetimeCompletedTasks`
 *     directly) because it used to be a live `tasks.filter(t => t.done).length` scan —
 *     unsafe now that `pruneOldData()` (lib/db.ts) actually prunes old completed dated
 *     tasks. `toggle()`/`completeDirect()` increment `settings.lifetimeCompletedTasks` on
 *     a not-done→done transition; `toggle()` (the reverse) and `remove()` (of a done task)
 *     decrement it (clamped at 0); `clearAll()` resets it to 0 — same observable behaviour
 *     as the old live scan, just no longer tied to row presence.
 *   - **Calendar mirroring (reserve-only, 2026-07-17) — WIRED.** `add`/`update` call the
 *     local `syncTaskCalendar(task)` wrapper (mirrors `syncTaskNotification`'s shape),
 *     which delegates to `lib/taskCalendar.ts`'s `syncTaskCalendarEvent` and writes the
 *     resolved `calendar_event_id` back once the native call resolves; `remove`/`clearAll`
 *     cancel via `cancelTaskCalendarEvent`. Gated on `settings.calendarSyncEnabled`; only
 *     one-off, dated, timed tasks are eligible (see `isCalendarEligible`). Call
 *     `syncAllTaskCalendarEvents()` after the setting is toggled on to re-sync every task.
 *     `contactName`/`contactPhone`/`locationLat`/`locationLng` (reserve-only contacts/
 *     location) are plain fields through the normal add/update payload — no sync wrapper.
 *   - `task.steps` persist straight to SQLite on every change (addStep/removeStep/
 *     toggleStep/reorderStep) — no draft/save gate. load() loads all task_steps in
 *     one query and groups them onto their owning task in JS (one query, not N+1).
 *   - **Task ↔ steps done-cascade**: toggle()/completeDirect() set every step to match
 *     the task (cascadeStepsDone); toggleStep() auto-completes the task once all steps
 *     are done and re-opens it when any is unchecked. The two flags never disagree.
 *   - **Decision 019 (`hint`)**: freeform optional note, display-only. Part of the
 *     regular add/update payload like any other field — no separate write path.
 *   - **Decision 020 (`followsTaskId` / `then` link)**: one-to-one, surfacing-only,
 *     NOT a notification. The column lives on the FOLLOWER row and points at its
 *     predecessor's id (`t.followsTaskId === predecessorId` means "t follows
 *     predecessor"). Set via the dedicated `setFollower(predecessorId, followerId)`
 *     action — never write `followsTaskId` through the generic `update()` patch,
 *     since a follower change can touch a SECOND row (clearing whoever previously
 *     followed the same predecessor, to keep the 1:1 invariant). `followerCycleChain(id)`
 *     walks the predecessor chain from `id` backward (self included) — the task-form's
 *     "then → pick a task" picker must exclude every id in that chain from its
 *     candidate list, or picking one would create a cycle (A→B→…→A). `remove()`
 *     clears any row's `followsTaskId` that pointed at the deleted task in the same
 *     transaction as the delete (SQLite can't ALTER TABLE to add a real FK here — see
 *     lib/db.ts's header). Recurrence interaction (open sub-question (a) in Decision
 *     020): resolved — the link lives on the task definition row, same one recurring
 *     tasks already use for every generated occurrence, so it persists across
 *     recurrence instances by construction, no extra code. Cross-date surfacing (open
 *     sub-question (b)): resolved as "pull the follower into today's view" — that's
 *     Home-phase day-view work (not this session's scope); not built here.
 *   - New columns (hint, follows_task_id, and everything else) go through the
 *     migrations array in lib/db.ts; never recreate tables.
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
  readReal,
  readBool,
  readJson,
  logDbError,
  tx,
} from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { dateStr } from '@/lib/date';
import { taskOccursOn } from '@/lib/taskRecurrence';
import { useAutomationStore } from '@/store/useAutomationStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSharedStore } from '@/store/useSharedStore';
import { cancelTaskNotification } from '@/lib/notifications';
import { syncTaskNotification as scheduleTaskReminder } from '@/lib/taskNotifications';
import { syncTaskCalendarEvent, cancelTaskCalendarEvent } from '@/lib/taskCalendar';
import { touchRow, softDelete } from '@/lib/liveSync';
import { broadcastRow } from '@/lib/syncService';

export type TaskType = 'start-at' | 'time-box';
export type Recurring = 'none' | 'daily' | 'weekly' | 'monthly';
/** Monthly recurrence: pinned to a day-of-month, or an nth/last weekday. */
export type MonthlyMode = 'day' | 'ordinal';
export type MonthOrdinal = 'first' | 'second' | 'third' | 'fourth' | 'last';

export type TaskStep = { id: string; taskId: string; title: string; done: boolean; orderIndex: number };

export type Task = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM — Start time
  /** HH:MM — Finish time for a non-Whenever time-box; Start stays `time`. */
  finishTime?: string;
  taskType: TaskType;
  durationMinutes?: number;
  done: boolean;
  recurring: Recurring;
  recurringDays: number[]; // 0=Mon … 6=Sun (weekly)
  /** Weekly interval: 1 = every week, 2 = every 2nd, 3 = every 3rd. */
  weekInterval: number;
  /** Monthly: pin to a day-of-month ('day') or an nth/last weekday ('ordinal'). */
  monthlyMode: MonthlyMode;
  monthDay: number; // 1–31 (monthlyMode 'day')
  monthOrdinal: MonthOrdinal; // (monthlyMode 'ordinal')
  monthWeekday: number; // 0=Mon … 6=Sun (monthlyMode 'ordinal')
  /** Energy system (2026-07-20) — when energyEnabled, completing this task applies a
   *  SIGNED energyValue to the day/week budget (positive restores, negative drains;
   *  lib/energy.ts). Both persist regardless of the master toggle; they only affect
   *  anything when settings.energySystemEnabled. */
  energyEnabled: boolean;
  energyValue: number;
  /** Manual drag-sort position within the task's section. */
  sortOrder: number;
  /** Decision 019 — freeform "makes it easier next time" note. Display-only. */
  hint: string;
  /** Decision 020 — id of the task THIS task follows (its predecessor), or null. */
  followsTaskId: string | null;
  /** "Start specific date" toggle; when false the task is undated / Whenever-anchored. */
  hasStartDate: boolean;
  /** "Shared out" flag — an outgoing shared_tasks row exists for this task. */
  sharedOut: boolean;
  /** People/family mode — assigned profile name ('' = Me / self). Surfaced only when
   *  settings.peopleModeEnabled and at least one childProfiles entry exists. */
  assignee: string;
  /** Contacts (reserve-only) — name+phone snapshot from expo-contacts' picker at attach
   *  time; no live device-contact-id link (see TASK_COLUMNS below for why). */
  contactName?: string;
  contactPhone?: string;
  /** Location (reserve-only) — foreground-tagged lat/lng at save time; no reverse
   *  geocoding. location_radius_m/geofence_id (lib/db.ts) stay unwired — reserved for
   *  future background geofencing, not this pass. */
  locationLat?: number;
  locationLng?: number;
  /** Calendar (reserve-only) — the mirrored device calendar event's id. System-managed
   *  by lib/taskCalendar.ts's syncTaskCalendar wrapper; never set through the normal
   *  add/update payload (same rationale as followsTaskId — see TASK_COLUMNS below). */
  calendarEventId?: string;
  steps: TaskStep[];
};

export type TaskInput = {
  title: string;
  date: string;
  time?: string;
  finishTime?: string;
  taskType: TaskType;
  durationMinutes?: number;
  done: boolean;
  recurring: Recurring;
  recurringDays: number[];
  weekInterval?: number;
  monthlyMode?: MonthlyMode;
  monthDay?: number;
  monthOrdinal?: MonthOrdinal;
  monthWeekday?: number;
  energyEnabled?: boolean;
  energyValue?: number;
  sortOrder: number;
  hint?: string;
  followsTaskId?: string | null;
  hasStartDate?: boolean;
  sharedOut?: boolean;
  assignee?: string;
  contactName?: string;
  contactPhone?: string;
  locationLat?: number;
  locationLng?: number;
  // calendarEventId is deliberately absent — system-managed only, see Task's own comment.
};

// taskOccursOn lives in lib/taskRecurrence.ts (extracted 2026-07-20 so
// lib/taskNotifications.ts can also use it, for monthly reminders, without a
// store→notifications→store import cycle) — re-exported here so existing
// callers/tests (__tests__/taskOccursOn.test.ts) importing it from this file
// keep working unchanged.
export { taskOccursOn };

/** Derive time-box duration (minutes) from Start→Finish; undefined when either is unset or the span is non-positive. */
function deriveDurationMinutes(time?: string, finishTime?: string): number | undefined {
  if (!time || !finishTime) return undefined;
  const [h1, m1] = time.split(':').map((n) => parseInt(n, 10));
  const [h2, m2] = finishTime.split(':').map((n) => parseInt(n, 10));
  if ([h1, m1, h2, m2].some((n) => !Number.isFinite(n))) return undefined;
  const diff = h2 * 60 + m2 - (h1 * 60 + m1);
  return diff > 0 ? diff : undefined;
}

type TaskStore = {
  tasks: Task[];
  load: () => void;
  add: (t: TaskInput) => Task;
  // followsTaskId excluded — only setFollower() may change it (see TASK_COLUMNS'
  // comment above for why routing it through here would silently desync DB vs. state).
  update: (id: string, patch: Partial<Omit<Task, 'id' | 'followsTaskId'>>) => void;
  toggle: (id: string) => void;
  /** Mark a task done immediately — same write path as toggle(), kept distinct for callers with no toggle state. */
  completeDirect: (id: string) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  tasksForDate: (date: string) => Task[];
  /** Per-weekday occurrences for the 7 days from `weekStartDate` (Mon), excluding undated Whenever tasks. */
  tasksForWeek: (weekStartDate: string) => { date: string; tasks: Task[] }[];
  /** Toggle the "shared out" flag; turning it on also emits an outgoing shared_tasks row. */
  setSharedOut: (id: string, on: boolean) => void;
  backlogTasks: (today: string) => Task[];
  /** First pending task for the focus view, respecting work-mode filter. */
  focusTask: (date: string, workModeActive: boolean) => Task | null;
  /** Re-schedule every task's reminder (after a settings/language change). */
  syncAllTaskNotifications: () => void;
  /** Re-arm monthly-recurring tasks' reminders for their next occurrence (no native
   *  repeating trigger covers "day-of-month, clamped"/"nth weekday") — called from
   *  app/_layout.tsx on boot and on every foreground. */
  syncMonthlyTaskNotifications: () => void;
  /** Re-sync every eligible task's mirrored calendar event (after calendarSyncEnabled flips on). */
  syncAllTaskCalendarEvents: () => void;
  /** Write a new sort_order (by array position) for every id in orderedIds. */
  reorderTasks: (orderedIds: string[]) => void;
  /** Steps persist straight to SQLite on every change — no draft/save gate. */
  addStep: (taskId: string, title: string) => TaskStep;
  removeStep: (id: string) => void;
  toggleStep: (id: string) => void;
  reorderStep: (id: string, direction: 'up' | 'down') => void;
  /** Decision 020 — set (or clear, with `followerId: null`) predecessorId's follower. */
  setFollower: (predecessorId: string, followerId: string | null) => void;
  /** Decision 020 cycle guard — ids reachable walking followsTaskId backward from `id` (self included). */
  followerCycleChain: (id: string) => string[];
};

/** Schedule (or cancel) a single task's reminder using the current settings. */
function syncTaskNotification(task: Task): void {
  scheduleTaskReminder(task, useSettingsStore.getState());
}

/** Stamp + broadcast a local mutation (Decision 038b/038 wiring) — call after every write. */
function syncTaskRow(id: string): void {
  touchRow('tasks', id, useSettingsStore.getState().deviceId);
  broadcastRow('tasks', id);
}

/**
 * Adjust the all-time completed-task counter (settings.lifetimeCompletedTasks),
 * clamped at 0. Call sites: toggle() (+1/-1 either direction), completeDirect()
 * (+1), remove() (-1, only if the removed task was done). See the file header's
 * "All-time completed-task counter" edit note for why this exists instead of
 * scanning `tasks` for `done`.
 */
function bumpLifetimeCompletedTasks(delta: 1 | -1): void {
  const settings = useSettingsStore.getState();
  settings.update({ lifetimeCompletedTasks: Math.max(0, settings.lifetimeCompletedTasks + delta) });
}

function rowToTask(row: Row): Task {
  return {
    id: readStr(row, 'id'),
    title: readStr(row, 'title'),
    date: readStr(row, 'task_date'),
    time: readStr(row, 'task_time') || undefined,
    finishTime: readStr(row, 'finish_time') || undefined,
    taskType: readStr(row, 'task_type', 'start-at') as TaskType,
    durationMinutes: readInt(row, 'duration_minutes') || undefined,
    done: readBool(row, 'done'),
    recurring: readStr(row, 'recurring', 'none') as Recurring,
    recurringDays: readJson<number[]>(row, 'recurring_days', []),
    weekInterval: readInt(row, 'recurring_week_interval', 1) || 1,
    monthlyMode: readStr(row, 'recurring_monthly_mode', 'day') as MonthlyMode,
    monthDay: readInt(row, 'recurring_month_day', 1) || 1,
    monthOrdinal: readStr(row, 'recurring_month_ordinal', 'first') as MonthOrdinal,
    monthWeekday: readInt(row, 'recurring_month_weekday', 0),
    energyEnabled: readBool(row, 'energy_enabled'),
    energyValue: readInt(row, 'energy_value', 1),
    sortOrder: readInt(row, 'sort_order'),
    hint: readStr(row, 'hint', ''),
    followsTaskId: readStr(row, 'follows_task_id') || null,
    hasStartDate: readBool(row, 'has_start_date'),
    sharedOut: readBool(row, 'shared_out'),
    assignee: readStr(row, 'assignee', ''),
    contactName: readStr(row, 'contact_name') || undefined,
    contactPhone: readStr(row, 'contact_phone') || undefined,
    locationLat: readReal(row, 'location_lat') || undefined,
    locationLng: readReal(row, 'location_lng') || undefined,
    calendarEventId: readStr(row, 'calendar_event_id') || undefined,
    steps: [],
  };
}

/** Field → column mapping for tasks (serialisers preserve the old INSERT/UPDATE defaults). */
const TASK_COLUMNS: FieldMap<Task> = {
  id: { col: 'id' },
  title: { col: 'title' },
  date: { col: 'task_date' },
  time: { col: 'task_time', to: (v) => v ?? null },
  finishTime: { col: 'finish_time', to: (v) => v ?? null },
  taskType: { col: 'task_type' },
  durationMinutes: { col: 'duration_minutes', to: (v) => v ?? null },
  done: { col: 'done', to: (v) => (v ? 1 : 0) },
  recurring: { col: 'recurring' },
  recurringDays: { col: 'recurring_days', to: (v) => JSON.stringify(v ?? []) },
  weekInterval: { col: 'recurring_week_interval', to: (v) => v ?? 1 },
  monthlyMode: { col: 'recurring_monthly_mode', to: (v) => v ?? 'day' },
  monthDay: { col: 'recurring_month_day', to: (v) => v ?? 1 },
  monthOrdinal: { col: 'recurring_month_ordinal', to: (v) => v ?? 'first' },
  monthWeekday: { col: 'recurring_month_weekday', to: (v) => v ?? 0 },
  energyEnabled: { col: 'energy_enabled', to: (v) => (v ? 1 : 0) },
  energyValue: { col: 'energy_value', to: (v) => v ?? 1 },
  sortOrder: { col: 'sort_order', to: (v) => v ?? 0 },
  hint: { col: 'hint', to: (v) => v ?? '' },
  hasStartDate: { col: 'has_start_date', to: (v) => (v ? 1 : 0) },
  sharedOut: { col: 'shared_out', to: (v) => (v ? 1 : 0) },
  assignee: { col: 'assignee', to: (v) => v ?? '' },
  contactName: { col: 'contact_name', to: (v) => v ?? null },
  contactPhone: { col: 'contact_phone', to: (v) => v ?? null },
  locationLat: { col: 'location_lat', to: (v) => v ?? null },
  locationLng: { col: 'location_lng', to: (v) => v ?? null },
  // followsTaskId is deliberately ABSENT from this map — rowValues() only ever
  // serialises keys present in the map, so neither add()'s insertRow nor update()'s
  // patch can accidentally write follows_task_id. All writes to it go through
  // setFollower(), which issues its own raw SQL so it can touch a second row
  // atomically (see below). A brand-new task's follower always starts unset anyway
  // (the tasks table's DEFAULT NULL), matching the form's own gating (the "then"
  // picker only appears once a task already exists to be a predecessor).
  // calendarEventId is likewise ABSENT — only lib/taskCalendar.ts's syncTaskCalendar
  // wrapper (below) writes calendar_event_id, via its own raw updateRow call after
  // the native create/update resolves. Never write it through the generic add/update.
};

function rowToTaskStep(row: Row): TaskStep {
  return {
    id: readStr(row, 'id'),
    taskId: readStr(row, 'task_id'),
    title: readStr(row, 'title'),
    done: readBool(row, 'done'),
    orderIndex: readInt(row, 'order_index'),
  };
}

/** Field → column mapping for task steps. */
const TASK_STEP_COLUMNS: FieldMap<TaskStep> = {
  id: { col: 'id' },
  taskId: { col: 'task_id' },
  title: { col: 'title' },
  done: { col: 'done', to: (v) => (v ? 1 : 0) },
  orderIndex: { col: 'order_index' },
};

export const useTaskStore = create<TaskStore>((set, get) => {
  /** Mirror (create/update/cancel) a task's device calendar event; fire-and-forget, writes
   *  calendar_event_id back once the native call resolves. Never throws (see lib/taskCalendar.ts). */
  function syncTaskCalendar(task: Task): void {
    const settings = useSettingsStore.getState();
    syncTaskCalendarEvent(task, { calendarSyncEnabled: settings.calendarSyncEnabled })
      .then((eventId) => {
        if ((eventId ?? undefined) === task.calendarEventId) return;
        updateRow('tasks', { calendar_event_id: eventId }, 'id = ?', [task.id]);
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, calendarEventId: eventId ?? undefined } : t)),
        }));
      })
      .catch((e) => logDbError(`syncTaskCalendar(${task.id})`, e));
  }

  return {
  tasks: [],

  load() {
    const tasks = loadAll('tasks', rowToTask, { orderBy: 'task_date, task_time', where: 'deleted_at IS NULL' });

    // Group steps onto their owning task in a single pass (one query, not N+1).
    const byTask = new Map<string, TaskStep[]>();
    for (const step of loadAll('task_steps', rowToTaskStep, { orderBy: 'order_index' })) {
      const list = byTask.get(step.taskId);
      if (list) list.push(step);
      else byTask.set(step.taskId, [step]);
    }

    set({ tasks: tasks.map((t) => ({ ...t, steps: byTask.get(t.id) ?? [] })) });
  },

  add(t) {
    const id = generateId();
    const task: Task = {
      ...t,
      id,
      done: false,
      hint: t.hint ?? '',
      followsTaskId: t.followsTaskId ?? null,
      weekInterval: t.weekInterval ?? 1,
      monthlyMode: t.monthlyMode ?? 'day',
      monthDay: t.monthDay ?? 1,
      monthOrdinal: t.monthOrdinal ?? 'first',
      monthWeekday: t.monthWeekday ?? 0,
      energyEnabled: t.energyEnabled ?? false,
      energyValue: t.energyValue ?? 1,
      hasStartDate: t.hasStartDate ?? false,
      sharedOut: t.sharedOut ?? false,
      assignee: t.assignee ?? '',
      // duration_minutes is derived from Start→Finish so the Home day-view keeps working.
      durationMinutes: deriveDurationMinutes(t.time, t.finishTime) ?? t.durationMinutes,
      steps: [],
    };
    insertRow('tasks', rowValues(task, TASK_COLUMNS));
    set((s) => ({ tasks: [...s.tasks, task] }));
    syncTaskNotification(task);
    syncTaskRow(id);
    syncTaskCalendar(task);
    return task;
  },

  update(id, patch) {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const next = { ...task, ...patch };
    // Re-derive duration whenever Start or Finish changed, and persist it alongside
    // the patch so the Home day-view's start–end rendering stays in sync.
    const writePatch: Partial<Omit<Task, 'id' | 'followsTaskId'>> = { ...patch };
    if ('time' in patch || 'finishTime' in patch) {
      next.durationMinutes = deriveDurationMinutes(next.time, next.finishTime) ?? next.durationMinutes;
      writePatch.durationMinutes = next.durationMinutes;
    }
    updateRow('tasks', rowValues(writePatch, TASK_COLUMNS), 'id = ?', [id]);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? next : t)) }));
    syncTaskNotification(next);
    syncTaskRow(id);
    syncTaskCalendar(next);
  },

  toggle(id) {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const willBeDone = !task.done;
    // Cascade (task ↔ steps): marking a task done/undone marks all its steps to
    // match, so the two never disagree. Persist the steps first, then the task row via
    // update() (which keeps notification + live-sync wiring intact and preserves the
    // just-updated step state, since update() re-reads the task from current state).
    db.runSync('UPDATE task_steps SET done = ? WHERE task_id = ?', [willBeDone ? 1 : 0, id]);
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, steps: t.steps.map((st) => ({ ...st, done: willBeDone })) } : t
      ),
    }));
    get().update(id, { done: willBeDone });
    bumpLifetimeCompletedTasks(willBeDone ? 1 : -1);
    if (willBeDone) {
      useAutomationStore.getState().fireTrigger('task_completed');
    }
  },

  completeDirect(id) {
    const task = get().tasks.find((t) => t.id === id);
    if (!task || task.done) return;
    db.runSync('UPDATE task_steps SET done = 1 WHERE task_id = ?', [id]);
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, steps: t.steps.map((st) => ({ ...st, done: true })) } : t
      ),
    }));
    get().update(id, { done: true });
    bumpLifetimeCompletedTasks(1);
    useAutomationStore.getState().fireTrigger('task_completed');
  },

  remove(id) {
    const task = get().tasks.find((t) => t.id === id);
    tx(() => {
      // Decision 020 ON DELETE SET NULL, enforced here since SQLite can't ALTER
      // TABLE to add a real FK: any row that followed this task loses the link.
      db.runSync('UPDATE tasks SET follows_task_id = NULL WHERE follows_task_id = ?', [id]);
      // Soft-delete (Decision 038b tombstone), not a hard DELETE: a synced row must
      // stay long enough to tell a peer it's gone, or a stale peer copy would undo
      // the delete on next sync. pruneOldData() only hard-deletes non-recurring,
      // dated (has_start_date=1), DONE tasks past task_date (lib/db.ts) — a
      // tombstoned recurring/undone/undated task can sit around longer; harmless
      // (still filtered out of every read via `deleted_at IS NULL`), just not
      // swept as promptly.
      softDelete('tasks', id, useSettingsStore.getState().deviceId);
    });
    void cancelTaskNotification(id);
    if (task?.calendarEventId) void cancelTaskCalendarEvent(task.calendarEventId);
    broadcastRow('tasks', id);
    if (task?.done) bumpLifetimeCompletedTasks(-1);
    set((s) => ({
      tasks: s.tasks
        .filter((t) => t.id !== id)
        .map((t) => (t.followsTaskId === id ? { ...t, followsTaskId: null } : t)),
    }));
  },

  reorderTasks(orderedIds) {
    const order = new Map(orderedIds.map((id, i) => [id, i]));
    orderedIds.forEach((id, i) => updateRow('tasks', { sort_order: i }, 'id = ?', [id]));
    set((s) => ({
      tasks: s.tasks.map((t) => (order.has(t.id) ? { ...t, sortOrder: order.get(t.id)! } : t)),
    }));
    // sort_order is a synced field (lib/liveSync's TABLE_COLUMNS) — stamp + broadcast
    // every reordered row, same as add/update.
    orderedIds.forEach(syncTaskRow);
  },

  setFollower(predecessorId, followerId) {
    // Capture who (if anyone) currently follows predecessorId BEFORE the writes below,
    // so both affected rows can be stamped + broadcast — follows_task_id is a synced
    // field and this can touch two rows (the old follower losing the link, the new one
    // gaining it), same as remove()'s follower-link cleanup.
    const previousFollowerId = get().tasks.find((t) => t.followsTaskId === predecessorId)?.id ?? null;
    tx(() => {
      // Enforce the 1:1 invariant: whoever currently follows predecessorId loses
      // the link first (a predecessor has at most one follower at a time).
      db.runSync('UPDATE tasks SET follows_task_id = NULL WHERE follows_task_id = ?', [predecessorId]);
      if (followerId) {
        db.runSync('UPDATE tasks SET follows_task_id = ? WHERE id = ?', [predecessorId, followerId]);
      }
    });
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id === followerId) return { ...t, followsTaskId: predecessorId };
        if (t.followsTaskId === predecessorId && t.id !== followerId) return { ...t, followsTaskId: null };
        return t;
      }),
    }));
    if (previousFollowerId && previousFollowerId !== followerId) syncTaskRow(previousFollowerId);
    if (followerId) syncTaskRow(followerId);
  },

  followerCycleChain(id) {
    const chain: string[] = [];
    const seen = new Set<string>();
    let current: string | null = id;
    while (current && !seen.has(current)) {
      chain.push(current);
      seen.add(current);
      current = get().tasks.find((t) => t.id === current)?.followsTaskId ?? null;
    }
    return chain;
  },

  addStep(taskId, title) {
    const existingSteps = get().tasks.find((t) => t.id === taskId)?.steps ?? [];
    const orderIndex = existingSteps.length === 0 ? 0 : Math.max(...existingSteps.map((s) => s.orderIndex)) + 1;
    const step: TaskStep = { id: generateId(), taskId, title, done: false, orderIndex };
    insertRow('task_steps', rowValues(step, TASK_STEP_COLUMNS));
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, steps: [...t.steps, step] } : t)),
    }));
    return step;
  },

  removeStep(id) {
    db.runSync('DELETE FROM task_steps WHERE id = ?', [id]);
    set((s) => ({
      tasks: s.tasks.map((t) => ({ ...t, steps: t.steps.filter((step) => step.id !== id) })),
    }));
  },

  toggleStep(id) {
    const owner = get().tasks.find((t) => t.steps.some((step) => step.id === id));
    const step = owner?.steps.find((s) => s.id === id);
    if (!owner || !step) return;
    const done = !step.done;
    updateRow('task_steps', { done: done ? 1 : 0 }, 'id = ?', [id]);
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === owner.id ? { ...t, steps: t.steps.map((st) => (st.id === id ? { ...st, done } : st)) } : t
      ),
    }));
    // Reverse cascade: once every step is done the task auto-completes; unchecking any
    // step re-opens it. Only writes when the derived state actually differs from now.
    const nextSteps = owner.steps.map((st) => (st.id === id ? { ...st, done } : st));
    const allDone = nextSteps.length > 0 && nextSteps.every((st) => st.done);
    if (allDone !== owner.done) {
      get().update(owner.id, { done: allDone });
      if (allDone) useAutomationStore.getState().fireTrigger('task_completed');
    }
  },

  reorderStep(id, direction) {
    const owner = get().tasks.find((t) => t.steps.some((step) => step.id === id));
    if (!owner) return;
    const sorted = [...owner.steps].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = sorted.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    updateRow('task_steps', { order_index: b.orderIndex }, 'id = ?', [a.id]);
    updateRow('task_steps', { order_index: a.orderIndex }, 'id = ?', [b.id]);
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === owner.id
          ? {
              ...t,
              steps: t.steps.map((step) => {
                if (step.id === a.id) return { ...step, orderIndex: b.orderIndex };
                if (step.id === b.id) return { ...step, orderIndex: a.orderIndex };
                return step;
              }),
            }
          : t
      ),
    }));
  },

  clearAll() {
    // Deliberately NOT broadcast: this is a local bulk reset (settings.tsx "Reset
    // tasks"), not a per-row user delete — propagating it would wipe a paired
    // partner's tasks too, which Decision 038b never asked for.
    const ids = get().tasks.map((t) => t.id);
    const calendarEventIds = get()
      .tasks.map((t) => t.calendarEventId)
      .filter((x): x is string => !!x);
    db.runSync('DELETE FROM tasks');
    ids.forEach((id) => void cancelTaskNotification(id));
    calendarEventIds.forEach((eventId) => void cancelTaskCalendarEvent(eventId));
    useSettingsStore.getState().update({ lifetimeCompletedTasks: 0 });
    set({ tasks: [] });
  },

  tasksForDate(date) {
    return get().tasks.filter((t) => taskOccursOn(t, date));
  },

  tasksForWeek(weekStartDate) {
    const start = new Date(weekStartDate + 'T12:00:00');
    const { tasks } = get();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = dateStr(d);
      // Group only dated / recurring occurrences per weekday; undated Whenever tasks
      // are surfaced by the screen's own Whenever section instead.
      return {
        date: ds,
        tasks: tasks.filter((t) => taskOccursOn(t, ds) && (t.hasStartDate || t.recurring !== 'none')),
      };
    });
  },

  setSharedOut(id, on) {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    updateRow('tasks', { shared_out: on ? 1 : 0 }, 'id = ?', [id]);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, sharedOut: on } : t)) }));
    syncTaskRow(id);
    if (on) {
      useSharedStore.getState().addSharedTasks([
        { direction: 'out', sourceTaskId: id, title: task.title, date: task.date, sharedBy: '' },
      ]);
    }
  },

  backlogTasks(today) {
    const { tasks } = get();
    return tasks
      .filter((t) => t.date < today && !t.done && t.recurring === 'none')
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  focusTask(date, workModeActive) {
    // workModeActive is retained in the signature for callers, but no longer
    // narrows the candidate set — task Importance (its former filter) was removed.
    void workModeActive;
    const candidates = get().tasksForDate(date).filter((t) => {
      if (t.done) return false;
      return true;
    });
    const sorted = candidates.sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return a.id.localeCompare(b.id);
    });
    return sorted[0] ?? null;
  },

  syncAllTaskNotifications() {
    get().tasks.forEach(syncTaskNotification);
  },

  syncMonthlyTaskNotifications() {
    get()
      .tasks.filter((t) => t.recurring === 'monthly')
      .forEach(syncTaskNotification);
  },

  syncAllTaskCalendarEvents() {
    get().tasks.forEach(syncTaskCalendar);
  },
  };
});
