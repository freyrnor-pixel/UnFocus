/**
 * useTaskStore.ts — tasks (one-off + weekly recurring), their steps, and the
 * Decision 019/020 additions (a display-only hint note and a one-to-one
 * "then" follower link).
 *
 * Zustand store for to-do tasks: one-off and weekly-recurring, start-at and
 * time-box types, with importance (General/Essential — Decision 018), a
 * manual sortOrder, and a backlog view. Real Phase 5 port replacing the
 * Decision 015 notImplemented stub.
 *
 * Connections:
 *   Imports → lib/db, lib/dataAccess, lib/id, lib/date, lib/notifications, lib/taskNotifications,
 *             lib/liveSync, lib/syncService, store/useAutomationStore, store/useSettingsStore
 *   Used by → components/QuickAddSheet.tsx, components/NextTaskCard.tsx, components/DayTimeline.tsx,
 *             components/PlanTaskCard.tsx (Task type), components/DraggableTaskRow.tsx (Task type),
 *             app/task-form.tsx, app/plans.tsx
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
 *     window (habits skip instead — see lib/habitNotifications.ts).
 *   - `task.steps` persist straight to SQLite on every change (addStep/removeStep/
 *     toggleStep/reorderStep) — no draft/save gate. load() loads all task_steps in
 *     one query and groups them onto their owning task in JS (one query, not N+1).
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
  readBool,
  readJson,
  tx,
} from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { dayOfWeekMon0 } from '@/lib/date';
import { useAutomationStore } from '@/store/useAutomationStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { cancelTaskNotification } from '@/lib/notifications';
import { syncTaskNotification as scheduleTaskReminder } from '@/lib/taskNotifications';
import { touchRow, softDelete } from '@/lib/liveSync';
import { broadcastRow } from '@/lib/syncService';

export type TaskType = 'start-at' | 'time-box';
export type Recurring = 'none' | 'weekly';
export type Importance = 'regular' | 'essential';

export type TaskStep = { id: string; taskId: string; title: string; done: boolean; orderIndex: number };

export type Task = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  taskType: TaskType;
  durationMinutes?: number;
  done: boolean;
  recurring: Recurring;
  recurringDays: number[]; // 0=Mon … 6=Sun
  importance: Importance;
  /** Manual drag-sort position within the task's Important/General section. */
  sortOrder: number;
  /** Decision 019 — freeform "makes it easier next time" note. Display-only. */
  hint: string;
  /** Decision 020 — id of the task THIS task follows (its predecessor), or null. */
  followsTaskId: string | null;
  steps: TaskStep[];
};

export type TaskInput = {
  title: string;
  date: string;
  time?: string;
  taskType: TaskType;
  durationMinutes?: number;
  done: boolean;
  recurring: Recurring;
  recurringDays: number[];
  importance: Importance;
  sortOrder: number;
  hint?: string;
  followsTaskId?: string | null;
};

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
  backlogTasks: (today: string) => Task[];
  completedCount: () => number;
  /** First pending task for the focus view, respecting work-mode filter. */
  focusTask: (date: string, workModeActive: boolean) => Task | null;
  /** Re-schedule every task's reminder (after a settings/language change). */
  syncAllTaskNotifications: () => void;
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

function rowToTask(row: Row): Task {
  return {
    id: readStr(row, 'id'),
    title: readStr(row, 'title'),
    date: readStr(row, 'task_date'),
    time: readStr(row, 'task_time') || undefined,
    taskType: readStr(row, 'task_type', 'start-at') as TaskType,
    durationMinutes: readInt(row, 'duration_minutes') || undefined,
    done: readBool(row, 'done'),
    recurring: readStr(row, 'recurring', 'none') as Recurring,
    recurringDays: readJson<number[]>(row, 'recurring_days', []),
    importance: readStr(row, 'importance', 'regular') as Importance,
    sortOrder: readInt(row, 'sort_order'),
    hint: readStr(row, 'hint', ''),
    followsTaskId: readStr(row, 'follows_task_id') || null,
    steps: [],
  };
}

/** Field → column mapping for tasks (serialisers preserve the old INSERT/UPDATE defaults). */
const TASK_COLUMNS: FieldMap<Task> = {
  id: { col: 'id' },
  title: { col: 'title' },
  date: { col: 'task_date' },
  time: { col: 'task_time', to: (v) => v ?? null },
  taskType: { col: 'task_type' },
  durationMinutes: { col: 'duration_minutes', to: (v) => v ?? null },
  done: { col: 'done', to: (v) => (v ? 1 : 0) },
  recurring: { col: 'recurring' },
  recurringDays: { col: 'recurring_days', to: (v) => JSON.stringify(v ?? []) },
  importance: { col: 'importance', to: (v) => v ?? 'regular' },
  sortOrder: { col: 'sort_order', to: (v) => v ?? 0 },
  hint: { col: 'hint', to: (v) => v ?? '' },
  // followsTaskId is deliberately ABSENT from this map — rowValues() only ever
  // serialises keys present in the map, so neither add()'s insertRow nor update()'s
  // patch can accidentally write follows_task_id. All writes to it go through
  // setFollower(), which issues its own raw SQL so it can touch a second row
  // atomically (see below). A brand-new task's follower always starts unset anyway
  // (the tasks table's DEFAULT NULL), matching the form's own gating (the "then"
  // picker only appears once a task already exists to be a predecessor).
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

export const useTaskStore = create<TaskStore>((set, get) => ({
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
      steps: [],
    };
    insertRow('tasks', rowValues(task, TASK_COLUMNS));
    set((s) => ({ tasks: [...s.tasks, task] }));
    syncTaskNotification(task);
    syncTaskRow(id);
    return task;
  },

  update(id, patch) {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const next = { ...task, ...patch };
    updateRow('tasks', rowValues(patch, TASK_COLUMNS), 'id = ?', [id]);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? next : t)) }));
    syncTaskNotification(next);
    syncTaskRow(id);
  },

  toggle(id) {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const willBeDone = !task.done;
    get().update(id, { done: willBeDone });
    if (willBeDone) {
      useAutomationStore.getState().fireTrigger('task_completed');
    }
  },

  completeDirect(id) {
    const task = get().tasks.find((t) => t.id === id);
    if (!task || task.done) return;
    get().update(id, { done: true });
    useAutomationStore.getState().fireTrigger('task_completed');
  },

  remove(id) {
    tx(() => {
      // Decision 020 ON DELETE SET NULL, enforced here since SQLite can't ALTER
      // TABLE to add a real FK: any row that followed this task loses the link.
      db.runSync('UPDATE tasks SET follows_task_id = NULL WHERE follows_task_id = ?', [id]);
      // Soft-delete (Decision 038b tombstone), not a hard DELETE: a synced row must
      // stay long enough to tell a peer it's gone, or a stale peer copy would undo
      // the delete on next sync. pruneOldData() eventually hard-deletes old rows
      // regardless of this flag, same as any other dated row.
      softDelete('tasks', id, useSettingsStore.getState().deviceId);
    });
    void cancelTaskNotification(id);
    broadcastRow('tasks', id);
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
  },

  setFollower(predecessorId, followerId) {
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
    db.runSync('DELETE FROM tasks');
    ids.forEach((id) => void cancelTaskNotification(id));
    set({ tasks: [] });
  },

  tasksForDate(date) {
    const { tasks } = get();
    const mon0 = dayOfWeekMon0(new Date(date + 'T12:00:00'));
    return tasks.filter((t) => {
      if (t.date === date) return true;
      if (t.recurring === 'weekly' && t.recurringDays.includes(mon0)) return true;
      return false;
    });
  },

  backlogTasks(today) {
    const { tasks } = get();
    return tasks
      .filter((t) => t.date < today && !t.done && t.recurring === 'none')
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  completedCount() {
    return get().tasks.filter((t) => t.done).length;
  },

  focusTask(date, workModeActive) {
    const candidates = get().tasksForDate(date).filter((t) => {
      if (t.done) return false;
      if (workModeActive && t.importance !== 'essential') return false;
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
}));
