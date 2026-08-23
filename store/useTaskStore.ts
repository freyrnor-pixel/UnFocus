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
 *   Imports → lib/db, lib/dataAccess, lib/storeCrud (the guarded by-id update),
 *             lib/id, lib/date, lib/cardType (the per-item card type
 *             + the isCompletable rule a 'note' turns on), lib/notifications, lib/taskNotifications,
 *             lib/taskRecurrence (taskOccursOn — re-exported here for existing callers/tests),
 *             lib/taskReset (the state-based reset — recurringResetPatch/notTodayDate/
 *             canPostpone/isWashedAway, all pure),
 *             lib/taskCalendar (reserve-only calendar mirroring), lib/liveSync, lib/syncService,
 *             lib/widgets/sync (scheduleWidgetSync — debounced widget/notification refresh on
 *             add/update/remove/clearAll, so live widgets don't wait for foreground/background),
 *             store/useAutomationStore, store/useSettingsStore (also lifetimeCompletedTasks,
 *             incremented/decremented here — see Edit notes),
 *             store/useSharedStore (setSharedOut emits an outgoing shared_tasks row),
 *             store/useGoalStore (registerProgress on toggle-to-done when a task has a goalId)
 *   Used by → components/PlanTaskCard.tsx (Task type), components/DraggableTaskRow.tsx (Task type),
 *             components/TaskCard.tsx (the one task editor — app/task-form.tsx retired
 *             2026-07-23, UX audit B1), app/plans.tsx, app/_layout.tsx
 *             (syncMonthlyTaskNotifications, on boot + every foreground),
 *             store/usePeopleStore.ts (clearPerson, call-time only, when a person is removed),
 *             store/useTagStore.ts (clearTag, call-time only, when a tag is removed)
 *
 *   Recurrence (Tasks/Oppgaver redesign): `recurring` is 'none'|'daily'|'weekly'|'monthly';
 *   taskOccursOn(task, date) (lib/taskRecurrence.ts) resolves an occurrence (weekly
 *   week-interval parity, monthly day-of-month clamp or nth/last weekday, has_start_date
 *   as a start boundary). Start/Finish time-box → duration_minutes is derived on save so
 *   PlanTaskCard is unchanged.
 *   Data    → defines a Zustand store; owns SQLite tables `tasks` and `task_steps`; fires the
 *             'task_completed' automation trigger on toggle-to-done / completeDirect; `tasks.goal_id`
 *             is a nullable app-enforced pointer to a `goals` row (store/useGoalStore.ts);
 *             `tasks.assignee_id` / `created_by_person_id` point at `people` rows
 *             (store/usePeopleStore.ts) and are cleared there on remove; `tasks.tag_ids`
 *             is a comma-separated list of `tags` ids (store/useTagStore.ts), cleared
 *             there on remove
 *
 * Edit notes:
 *   - **LAN live-sync wiring (Decision 038, app integration) — WIRED.** `add`/`update`
 *     stamp the row via lib/liveSync's touchRow then lib/syncService's broadcastRow —
 *     as one call, lib/syncRow.ts's `syncRow`, which `syncTaskRow` below wraps;
 *     `remove` soft-deletes (tombstone) instead of a hard DELETE so a peer sees the
 *     delete instead of a stale copy reviving it. `load()` filters `deleted_at IS
 *     NULL`. `clearAll()` (bulk local reset) is deliberately NOT broadcast — see its
 *     own comment. Both no-op safely when sync isn't running (broadcastRow) or a
 *     peer isn't connected.
 *   - ⚠️ **`remove()` also nulls SOMEONE ELSE'S `follows_task_id`, and that row needs the pair
 *     as well.** `setFollower()` has stamped both ends of that link since it was written;
 *     `remove()` nulled the same synced column with raw SQL and told nobody, so a peer kept a
 *     link to a deleted task and handed it back on its next edit. The orphaned follower ids are
 *     read before the tx and pushed with `syncRows` after it — __tests__/relatedRowSync.test.ts.
 *   - **Undoable delete (2026-07-27, user report: "no apparent way to delete and recover
 *     deleted tasks").** The tombstone above was already the whole mechanism — `restore(id)`
 *     just clears `deleted_at` (stamping updated_at/origin_device_id and broadcasting, since
 *     un-deleting is itself a synced mutation a peer must learn about) and reloads.
 *     `loadDeleted()` reads the tombstones into `deletedTasks` so a delete from an earlier
 *     session is still restorable; app/_layout.tsx calls it on boot. The undo window is
 *     bounded by `pruneOldData()` (lib/db.ts), which hard-deletes old tombstones — nothing
 *     extra expires them here. UI: components/PlanTaskCard.tsx's "Recently deleted" zone.
 *   - **`setTasksDated(ids, dated)` — "reset the day" (2026-08-20).** Parks a day's
 *     unfinished leftovers in Whenever instead of deleting them, which is what lets the
 *     button that calls it skip the confirm dialog entirely: nothing is destroyed, so a
 *     mis-tap costs one Undo and no data. **It is NOT a bulk `remove()` and must not become
 *     one**, and it is not `clearAll()` either — that one is a hard `DELETE FROM tasks` that
 *     also clears `deletedTasks`, i.e. deliberately unrecoverable, and belongs to Settings'
 *     "Reset tasks" alone. Recurring rows are refused (their `hasStartDate` is a start
 *     boundary, not a per-day flag); see the implementation for the full contract.
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
 *     walks the predecessor chain from `id` backward (self included) — TaskCard's "Then"
 *     "pick a task" picker must exclude every id in that chain from its
 *     candidate list, or picking one would create a cycle (A→B→…→A). `remove()`
 *     clears any row's `followsTaskId` that pointed at the deleted task in the same
 *     transaction as the delete (SQLite can't ALTER TABLE to add a real FK here — see
 *     lib/db.ts's header). Recurrence interaction (open sub-question (a) in Decision
 *     020): resolved — the link lives on the task definition row, same one recurring
 *     tasks already use for every generated occurrence, so it persists across
 *     recurrence instances by construction, no extra code. Cross-date surfacing (open
 *     sub-question (b)): resolved as "pull the follower into today's view" — that's
 *     Home-phase day-view work (not this session's scope); not built here.
 *   - **Card types (2026-08-01, phase 1)**: `cardType` is 'standard' | 'simple' | 'note' |
 *     'stepped' — a property of the ITEM (lib/cardType.ts holds the rules; lib/cardLayout.ts
 *     is the per-surface one, don't confuse them). It rides the normal add/update payload
 *     like any other field. Three things about it belong here rather than in a component:
 *       1. **'note' has no completion state.** `toggle`/`completeDirect`/`toggleStep`'s
 *          cascade all bail on one, so no path can give a note a done flag, a
 *          `lifetimeCompletedTasks` increment or a 'task_completed' trigger. Everything that
 *          COUNTS tasks asks `isCompletable(cardType)` instead of reading `done` raw.
 *       2. **Switching type is lossless.** Nothing is cleared on a switch — not steps, not
 *          `done`, not energy. A stepped card turned simple keeps every task_steps row with
 *          its done flags, and switching back restores it exactly. That is also why a
 *          previously-completed task switched to 'note' keeps its stored `done`: it simply
 *          stops being counted, and reverting brings it back. (Its historical
 *          `lifetimeCompletedTasks` increment stays too — that counter only ever moves on a
 *          real transition, so a type switch can't drift it in either direction.)
 *       3. **Stepped stores no current-step pointer.** The visible step is derived as the
 *          first not-done one (lib/cardType.ts's `currentStepIndex`), so it can't disagree
 *          with the done flags the widget, the cascade or a peer might have changed.
 *   - **The state-based reset (2026-08-17, lib/taskReset.ts)** — three actions, one rule
 *     each, and the rules themselves are pure functions in that file, not here:
 *       1. `normalizeRecurringTasks(today)` rolls a recurring daily/weekly task's row
 *          forward and clears a completion that belonged to an earlier day. It is the one
 *          write path that deliberately does NOT stamp `lastActedAt` — the app tidying up
 *          on its own is not the user touching the task — which is why it writes raw
 *          instead of through `update()`. It DOES stamp `updated_at` and broadcast, because
 *          `task_date`/`done` are both synced columns (the 2026-08-10 gotcha).
 *       2. `notToday(id, today)` writes a date and nothing else. There is no counter to
 *          increment and no place to record that it happened, deliberately —
 *          `__tests__/taskStateReset.test.ts` asserts the write is exactly two fields.
 *       3. `washedAwayTasks`/`bringBack` are a derived filter and a stamp. A task washing
 *          out of the active list writes NOTHING, so bringing it back cannot need to undo
 *          anything.
 *   - New columns (hint, follows_task_id, card_type, and everything else) go through the
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
import { replaceById, updateById } from '@/lib/storeCrud';
import { generateId } from '@/lib/id';
import { dateStr, nowHHMM } from '@/lib/date';
import { taskOccursOn } from '@/lib/taskRecurrence';
import {
  canPostpone,
  hoursSinceStamp,
  isWashedAway,
  notTodayDate,
  recurringResetPatch,
} from '@/lib/taskReset';
import { parseTagIds, serializeTagIds } from '@/lib/tags';
import { sanitizeRotationMode, type RotationMode } from '@/lib/taskRotation';
import { sanitizeCardType, isCompletable, type CardType } from '@/lib/cardType';
import { useAutomationStore } from '@/store/useAutomationStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSharedStore } from '@/store/useSharedStore';
import { useGoalStore } from '@/store/useGoalStore';
import { cancelTaskNotification } from '@/lib/notifications';
import { syncTaskNotification as scheduleTaskReminder } from '@/lib/taskNotifications';
import { syncTaskCalendarEvent, cancelTaskCalendarEvent } from '@/lib/taskCalendar';
import { softDelete } from '@/lib/liveSync';
import { broadcastRow } from '@/lib/syncService';
import { syncRow, syncRows } from '@/lib/syncRow';
import { scheduleWidgetSync } from '@/lib/widgets/sync';

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
  /**
   * HH:MM (local) the task was actually ticked — the day log's only proof a task
   * happened at a time (lib/dayLog.ts). '' means "no honest time": either it predates
   * this column, or `done` arrived from a paired device (`done_at` is deliberately not
   * a synced column), or the task isn't done. Never derive this from `updated_at`,
   * which moves on any edit by any device.
   */
  doneAt: string;
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
   *  anything when non-zero (Energy is always on as of 2026-07-26). */
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
  /** People/family mode — assigned profile NAME ('' = Me / self).
   *  @deprecated since 2026-07-28 — superseded by `assigneeId`, which survives a rename
   *  and means the same person on a paired phone. Still written as a denormalised mirror
   *  (never dropped, per lib/db.ts's rule) so a backup stays readable; do not read it to
   *  decide who a task is for. */
  assignee: string;
  /** People registry (2026-07-28) — id of the Person this task is FOR ('' = unassigned /
   *  me). Authoritative; `assignee` is kept in step with it as a display mirror. Synced. */
  assigneeId: string;
  /** People registry (2026-07-28) — id of the Person this task came FROM, for "shared with
   *  you by X". Distinct from `origin_device_id`, which is the LAST WRITER and so flips the
   *  moment the other person ticks the task. Synced. */
  createdByPersonId: string;
  /** Tags (2026-07-28) — ids of the `tags` rows this task carries, in the order they were
   *  added. Persisted as the comma-separated `tasks.tag_ids` column and synced as one
   *  opaque string; see lib/tags.ts for the parse/serialise rules and lib/db.ts's
   *  migration for why membership isn't a join table. */
  tagIds: string[];
  /** Rotation (2026-07-28) — 'none' | 'daily' | 'weekly' | 'monthly'. Whose turn it is is
   *  DERIVED from the date by lib/taskRotation.ts, never stored: both phones compute the
   *  same answer, so no periodic "advance the turn" write exists for LWW to lose. */
  rotation: RotationMode;
  /** Rotation roster — ordered person ids taking turns. A removed person keeps their slot;
   *  dropping it would re-index everyone after them and change every future turn. */
  rotationPersonIds: string[];
  /** Rotation anchor — the 'YYYY-MM-DD' that turn 0 belongs to, captured when rotation is
   *  switched on. Never recompute it for an existing task (see lib/taskRotation.ts). */
  rotationAnchor: string;
  /** Goals (2026-07-23) — id of the Goal this task is connected to, or null. Set through
   *  the normal add/update payload (a plain nullable pointer, like a form field). Completing
   *  the task nudges that goal's strength up — see toggle()/completeDirect(). */
  goalId: string | null;
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
  /** Card types (2026-08-01) — how THIS item draws itself: 'standard' | 'simple' | 'note'
   *  | 'stepped'. A property of the item, not of the list (lib/cardLayout.ts is the
   *  per-surface one) and not a global setting. Presentation only, except that a 'note'
   *  has no completion state at all — see lib/cardType.ts's `isCompletable` for every
   *  count that follows from that. Switching type never deletes anything: a stepped card
   *  turned simple keeps its task_steps rows, done flags included. Synced. */
  cardType: CardType;
  /**
   * State-based reset (2026-08-17, lib/taskReset.ts) — ISO-8601 UTC instant of the last time
   * the person on THIS phone acted on the task: created it, edited it, ticked it, pushed it
   * to tomorrow, or brought it back out of the archive. It is what the wash-away filter
   * measures; `updated_at` cannot stand in for it (it moves on any write by any device,
   * including this store's own automatic normalization) and `created_at` never moves.
   * Deliberately not synced — see lib/db.ts's migration comment.
   */
  lastActedAt: string;
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
  doneAt?: string;
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
  assigneeId?: string;
  createdByPersonId?: string;
  tagIds?: string[];
  rotation?: RotationMode;
  rotationPersonIds?: string[];
  rotationAnchor?: string;
  goalId?: string | null;
  contactName?: string;
  contactPhone?: string;
  locationLat?: number;
  locationLng?: number;
  /** Defaults to 'standard' in add() — a new item is NEVER prompted for its type. */
  cardType?: CardType;
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

/** How many tombstoned tasks the "Recently deleted" zone keeps offering to restore. */
export const RECENTLY_DELETED_LIMIT = 10;

type TaskStore = {
  /**
   * True once load() has run. Distinguishes "no tasks" from "not read yet" — the gate
   * lib/useNewSinceSeen.ts needs, since seeding the seen-watermark against a not-yet-loaded
   * list would mark genuinely-unseen tasks as already seen and kill the glow.
   */
  loaded: boolean;
  tasks: Task[];
  /**
   * Tombstoned tasks still eligible for one-tap restore, newest first (capped at
   * `RECENTLY_DELETED_LIMIT`). Deleting has always been a soft delete (Decision 038b) —
   * this just surfaces those rows so a delete is undoable instead of silently final
   * (2026-07-27, user report: "no apparent way to delete and recover deleted tasks").
   * Populated by `remove()` and by `loadDeleted()`, which is what makes a delete from an
   * earlier session still restorable.
   */
  deletedTasks: Task[];
  load: () => void;
  /** Read tombstoned rows (`deleted_at IS NOT NULL`) into `deletedTasks`. */
  loadDeleted: () => void;
  /** Undo a `remove()` — clears the tombstone and brings the task back into `tasks`. */
  restore: (id: string) => void;
  add: (t: TaskInput) => Task;
  // followsTaskId excluded — only setFollower() may change it (see TASK_COLUMNS'
  // comment above for why routing it through here would silently desync DB vs. state).
  update: (id: string, patch: Partial<Omit<Task, 'id' | 'followsTaskId'>>) => void;
  toggle: (id: string) => void;
  /** Mark a task done immediately — same write path as toggle(), kept distinct for callers with no toggle state. */
  completeDirect: (id: string) => void;
  /**
   * State-based reset (2026-08-17, lib/taskReset.ts rule 1) — roll every recurring
   * daily/weekly task whose row still carries an earlier day forward to `today`, clearing a
   * completion that belonged to that earlier day. Idempotent: a list that is already current
   * writes nothing, which is what lets app/_layout.tsx call it on boot and every foreground.
   */
  normalizeRecurringTasks: (today: string) => void;
  /**
   * "Not today" (lib/taskReset.ts rule 2) — push a task to tomorrow and nothing else. No
   * skip count, no streak break, no metadata of any kind is written; the task simply has a
   * different date. A no-op for a recurring or finished task (`canPostpone`).
   */
  notToday: (id: string, today: string) => void;
  /**
   * The washed-away archive (lib/taskReset.ts rule 3) — non-recurring tasks nobody has
   * touched for over 72 hours. A derived FILTER over the same `tasks` array, oldest touch
   * first; nothing was written when they washed away and nothing is written by asking.
   */
  washedAwayTasks: (today: string, nowMs?: number) => Task[];
  /** Bring a washed-away task back into the active list — a fresh `lastActedAt`, nothing else. */
  bringBack: (id: string) => void;
  remove: (id: string) => void;
  /**
   * "Reset the day" (2026-08-20) — park `ids` in Whenever (`dated: false`), or put them
   * back on their day (`dated: true`). NOT a delete: see the implementation for why.
   */
  setTasksDated: (ids: string[], dated: boolean) => void;
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
  /**
   * Commit a drag-reorder of the Whenever list: `orderedIds` is the rows the user could SEE,
   * in their new order. Had no caller at all until 2026-08-01 (app/plans.tsx's drag) —
   * see the implementation for why it slots rather than renumbering the subset 0…n-1.
   */
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
  /** Goals — clear a deleted goal's id from any task's in-memory goalId (DB nulling is done
   *  by useGoalStore.remove() in the same transaction as the delete). */
  clearGoal: (goalId: string) => void;
  /** People — clear a removed person's id from any task's in-memory assigneeId (the DB
   *  columns are cleared by usePeopleStore.remove() in the same transaction as the delete). */
  clearPerson: (personId: string) => void;
  /** Tags — drop a removed tag's id from any task's in-memory tagIds (the DB column is
   *  rewritten by store/useTagStore.ts's remove(), inside the same transaction). */
  clearTag: (tagId: string) => void;
};

/** Schedule (or cancel) a single task's reminder using the current settings. */
function syncTaskNotification(task: Task): void {
  scheduleTaskReminder(task, useSettingsStore.getState());
}

/** Stamp + broadcast a local mutation (Decision 038b/038 wiring) — call after every write. */
function syncTaskRow(id: string): void {
  syncRow('tasks', id);
}

/**
 * Now, as the ISO-8601 UTC instant `tasks.last_acted_at` stores (lib/taskReset.ts).
 *
 * Every USER-driven write goes through it — add(), update() (and so toggle(),
 * completeDirect(), notToday() and every editor field), restore() and bringBack(). The two
 * automatic paths deliberately do NOT stamp it: `normalizeRecurringTasks` (the app tidying
 * up on its own is not the user touching the task) and an inbound sync row (a peer's clock
 * must not decide what disappears from this phone's archive).
 */
function actedNow(): string {
  return new Date().toISOString();
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
    doneAt: readStr(row, 'done_at'),
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
    assigneeId: readStr(row, 'assignee_id', ''),
    createdByPersonId: readStr(row, 'created_by_person_id', ''),
    tagIds: parseTagIds(readStr(row, 'tag_ids', '')),
    rotation: sanitizeRotationMode(readStr(row, 'rotation', 'none')),
    // The roster reuses the tag-id list format — same comma-separated column shape, same
    // total-by-design parse, and it arrives from another device just as tag_ids does.
    rotationPersonIds: parseTagIds(readStr(row, 'rotation_person_ids', '')),
    rotationAnchor: readStr(row, 'rotation_anchor', ''),
    goalId: readStr(row, 'goal_id') || null,
    contactName: readStr(row, 'contact_name') || undefined,
    contactPhone: readStr(row, 'contact_phone') || undefined,
    locationLat: readReal(row, 'location_lat') || undefined,
    locationLng: readReal(row, 'location_lng') || undefined,
    calendarEventId: readStr(row, 'calendar_event_id') || undefined,
    // Total by design (sanitizeCardType): a row written by a newer build, or one an
    // out-of-band write left blank, reads back as an ordinary 'standard' card.
    cardType: sanitizeCardType(readStr(row, 'card_type', 'standard')),
    lastActedAt: readStr(row, 'last_acted_at', ''),
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
  doneAt: { col: 'done_at', to: (v) => v ?? '' },
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
  assigneeId: { col: 'assignee_id', to: (v) => v ?? '' },
  createdByPersonId: { col: 'created_by_person_id', to: (v) => v ?? '' },
  tagIds: { col: 'tag_ids', to: (v) => serializeTagIds((v as string[]) ?? []) },
  rotation: { col: 'rotation', to: (v) => sanitizeRotationMode(v) },
  rotationPersonIds: { col: 'rotation_person_ids', to: (v) => serializeTagIds((v as string[]) ?? []) },
  rotationAnchor: { col: 'rotation_anchor', to: (v) => v ?? '' },
  goalId: { col: 'goal_id', to: (v) => v ?? null },
  contactName: { col: 'contact_name', to: (v) => v ?? null },
  contactPhone: { col: 'contact_phone', to: (v) => v ?? null },
  locationLat: { col: 'location_lat', to: (v) => v ?? null },
  locationLng: { col: 'location_lng', to: (v) => v ?? null },
  cardType: { col: 'card_type', to: (v) => sanitizeCardType(v) },
  lastActedAt: { col: 'last_acted_at', to: (v) => v ?? '' },
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
  loaded: false,
  tasks: [],
  deletedTasks: [],

  loadDeleted() {
    // Newest tombstone first. `deleted_at` is an ISO string, so a plain DESC string sort
    // is chronological. pruneOldData() eventually hard-deletes these, which is exactly the
    // right expiry for an undo affordance — nothing extra to sweep here.
    const deleted = loadAll('tasks', rowToTask, { orderBy: 'deleted_at DESC', where: 'deleted_at IS NOT NULL' });
    set({ deletedTasks: deleted.slice(0, RECENTLY_DELETED_LIMIT) });
  },

  restore(id) {
    const now = new Date().toISOString();
    // Clearing the tombstone is itself a synced mutation (a peer holding the delete must
    // learn the row is back), so stamp updated_at/origin_device_id exactly like touchRow
    // does and broadcast afterwards.
    // `last_acted_at` rides along: pulling a task back out of the bin is the user acting on
    // it, and without this a restored task could wash straight back out of the active list
    // (lib/taskReset.ts) for having been created four days ago.
    db.runSync(
      'UPDATE tasks SET deleted_at = NULL, updated_at = ?, last_acted_at = ?, origin_device_id = ? WHERE id = ?',
      [now, now, useSettingsStore.getState().deviceId, id]
    );
    // Full reload rather than splicing the row back into state by hand: the task's steps
    // have to be regrouped onto it anyway, and load() is one query for each.
    get().load();
    get().loadDeleted();
    const task = get().tasks.find((t) => t.id === id);
    if (task) {
      syncTaskNotification(task);
      syncTaskCalendar(task);
      if (task.done) bumpLifetimeCompletedTasks(1);
    }
    broadcastRow('tasks', id);
    scheduleWidgetSync();
  },

  load() {
    const tasks = loadAll('tasks', rowToTask, { orderBy: 'task_date, task_time', where: 'deleted_at IS NULL' });

    // Group steps onto their owning task in a single pass (one query, not N+1).
    const byTask = new Map<string, TaskStep[]>();
    for (const step of loadAll('task_steps', rowToTaskStep, { orderBy: 'order_index' })) {
      const list = byTask.get(step.taskId);
      if (list) list.push(step);
      else byTask.set(step.taskId, [step]);
    }

    set({ tasks: tasks.map((t) => ({ ...t, steps: byTask.get(t.id) ?? [] })), loaded: true });
  },

  add(t) {
    const id = generateId();
    const task: Task = {
      ...t,
      id,
      done: false,
      // A brand-new task is never done, so it has no completion time. toggle() /
      // completeDirect() are the only writers.
      doneAt: '',
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
      assigneeId: t.assigneeId ?? '',
      createdByPersonId: t.createdByPersonId ?? '',
      tagIds: parseTagIds((t.tagIds ?? []).join(',')),
      rotation: sanitizeRotationMode(t.rotation),
      rotationPersonIds: parseTagIds((t.rotationPersonIds ?? []).join(',')),
      rotationAnchor: t.rotationAnchor ?? '',
      goalId: t.goalId ?? null,
      // Always 'standard' unless a caller deliberately says otherwise. Creation never asks
      // for a card type — the type is changed afterwards, from the item's own editor.
      cardType: sanitizeCardType(t.cardType),
      // Writing a task down IS acting on it, so the 72-hour wash-away window starts here
      // rather than at whatever `created_at` the DB default happens to stamp.
      lastActedAt: actedNow(),
      // duration_minutes is derived from Start→Finish so the Home day-view keeps working.
      durationMinutes: deriveDurationMinutes(t.time, t.finishTime) ?? t.durationMinutes,
      steps: [],
    };
    insertRow('tasks', rowValues(task, TASK_COLUMNS));
    set((s) => ({ tasks: [...s.tasks, task] }));
    syncTaskNotification(task);
    syncTaskRow(id);
    syncTaskCalendar(task);
    scheduleWidgetSync();
    return task;
  },

  update(id, patch) {
    // The patch is a function of the row because Start/Finish decide a THIRD column:
    // whatever this returns is both written and merged, so the duration in memory and the
    // duration in SQLite cannot come apart. See lib/storeCrud.ts.
    const next = updateById('tasks', TASK_COLUMNS, get().tasks, id, (task) => {
      // Every edit through this action is the user acting on the task, which is what resets
      // the wash-away window (lib/taskReset.ts). A caller that has already decided the stamp
      // — bringBack() — keeps its own; the automatic paths bypass update() entirely rather
      // than passing a flag, so there is no way to edit a task here without it counting.
      const acted = { lastActedAt: patch.lastActedAt ?? actedNow() };
      // Re-derive duration whenever Start or Finish changed, and persist it alongside
      // the patch so the Home day-view's start–end rendering stays in sync.
      if (!('time' in patch) && !('finishTime' in patch)) return { ...patch, ...acted };
      const merged = { ...task, ...patch };
      return {
        ...patch,
        ...acted,
        durationMinutes: deriveDurationMinutes(merged.time, merged.finishTime) ?? merged.durationMinutes,
      };
    });
    if (!next) return;
    set((s) => ({ tasks: replaceById(s.tasks, next) }));
    syncTaskNotification(next);
    syncTaskRow(id);
    syncTaskCalendar(next);
    scheduleWidgetSync();
  },

  toggle(id) {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    // A 'note' card has no completion state (lib/cardType.ts). Its row draws no check, so
    // this is normally unreachable — it's here so a call from anywhere else (an automation,
    // a widget action, a future surface) can't quietly give a note a done flag, a lifetime
    // count and a 'task_completed' trigger. Any `done` it already carries from before the
    // switch is left untouched: type changes are lossless, and every count asks
    // isCompletable() rather than reading the flag raw.
    if (!isCompletable(task.cardType)) return;
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
    // `doneAt` (2026-08-02) is what puts this task in the day log — see lib/dayLog.ts.
    // Stamped here and in completeDirect() only, so it means "ticked", not "touched"
    // (which is all `updated_at` can ever mean). Cleared on un-tick: an entry the user
    // took back should leave no trace in a record of what happened.
    get().update(id, { done: willBeDone, doneAt: willBeDone ? nowHHMM() : '' });
    bumpLifetimeCompletedTasks(willBeDone ? 1 : -1);
    if (willBeDone) {
      useAutomationStore.getState().fireTrigger('task_completed');
      // Goals: completing a linked task nudges its goal's "living glow" up. Un-completing
      // does nothing — decay handles the fade, there's no punishment (see useGoalStore).
      if (task.goalId) useGoalStore.getState().registerProgress(task.goalId);
    }
  },

  completeDirect(id) {
    const task = get().tasks.find((t) => t.id === id);
    if (!task || task.done) return;
    // See toggle() — a note cannot be completed by any path.
    if (!isCompletable(task.cardType)) return;
    db.runSync('UPDATE task_steps SET done = 1 WHERE task_id = ?', [id]);
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, steps: t.steps.map((st) => ({ ...st, done: true })) } : t
      ),
    }));
    get().update(id, { done: true, doneAt: nowHHMM() });
    bumpLifetimeCompletedTasks(1);
    useAutomationStore.getState().fireTrigger('task_completed');
    if (task.goalId) useGoalStore.getState().registerProgress(task.goalId);
  },

  normalizeRecurringTasks(today) {
    // Two reasons this writes raw rather than going through update(): it must NOT stamp
    // `lastActedAt` (the app tidying up is not the user touching the task), and it runs over
    // every task on every foreground, where one set() per changed row would re-render the
    // whole list n times. Only rows that actually move are written.
    const changed: Task[] = [];
    for (const task of get().tasks) {
      const patch = recurringResetPatch(task, today);
      if (!patch) continue;
      updateRow('tasks', rowValues(patch, TASK_COLUMNS), 'id = ?', [task.id]);
      changed.push({ ...task, ...patch });
    }
    if (changed.length === 0) return;
    const byId = new Map(changed.map((t) => [t.id, t]));
    set((s) => ({ tasks: s.tasks.map((t) => byId.get(t.id) ?? t) }));
    // `task_date` and `done` are both on lib/liveSync's whitelist, so these rows MUST be
    // stamped and broadcast — an unstamped bulk write leaves a paired phone's stale copy
    // winning the LWW tiebreak and reverting the roll-forward, which is exactly the shape of
    // the monthly-reset bug AGENTS.md's 2026-08-10 gotcha records. Both phones compute the
    // same answer from the same rule, so the broadcast is a tiebreak, never a source of truth.
    changed.forEach((t) => syncTaskRow(t.id));
    scheduleWidgetSync();
  },

  notToday(id, today) {
    const task = get().tasks.find((t) => t.id === id);
    if (!task || !canPostpone(task)) return;
    // The whole write. `hasStartDate` comes along because an undated Whenever task pushed to
    // tomorrow has to actually BE dated tomorrow — otherwise it stays undated and the date it
    // now carries means nothing (lib/taskRecurrence.ts ignores `date` for an undated row).
    // Nothing else is recorded: no skip count, no "postponed" flag, no log entry. A task the
    // user moved on from should leave no evidence that it was ever late.
    get().update(id, { date: notTodayDate(today), hasStartDate: true });
  },

  washedAwayTasks(today, nowMs = Date.now()) {
    return get()
      .tasks.filter((t) => isWashedAway(t, today, nowMs))
      // Longest untouched first — the order the list was already in, not a ranking. Nothing
      // here counts how long that is, and nothing draws it.
      .sort((a, b) => (hoursSinceStamp(b.lastActedAt, nowMs) ?? 0) - (hoursSinceStamp(a.lastActedAt, nowMs) ?? 0));
  },

  bringBack(id) {
    // Un-washing is a stamp and nothing else: the task's date, steps, reminders and every
    // other field are exactly as they were, because washing away never wrote anything.
    get().update(id, { lastActedAt: actedNow() });
  },

  remove(id) {
    const task = get().tasks.find((t) => t.id === id);
    // Whoever follows this task loses the link in the tx below. `follows_task_id` is a
    // whitelisted synced column, so those rows have to be STAMPED and broadcast, not just
    // mutated — collected here because the UPDATE is what makes the predicate stop matching.
    // setFollower() has done exactly this since it was written; remove() nulled the same
    // column and told nobody, so a peer kept the dangling link and handed it back on its next
    // edit to that row.
    const orphanedFollowerIds = get()
      .tasks.filter((t) => t.followsTaskId === id)
      .map((t) => t.id);
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
    syncRows('tasks', orphanedFollowerIds);
    if (task?.done) bumpLifetimeCompletedTasks(-1);
    set((s) => ({
      tasks: s.tasks
        .filter((t) => t.id !== id)
        .map((t) => (t.followsTaskId === id ? { ...t, followsTaskId: null } : t)),
      // Offer the delete back for a while (see `deletedTasks`' doc). Held in memory here so
      // the zone updates instantly; loadDeleted() re-reads the same rows from SQLite on a
      // later launch, so an undo survives a restart too.
      deletedTasks: task
        ? [task, ...s.deletedTasks.filter((t) => t.id !== id)].slice(0, RECENTLY_DELETED_LIMIT)
        : s.deletedTasks,
    }));
    scheduleWidgetSync();
  },

  /**
   * "Reset the day" — park a whole day's leftovers in Whenever, or put them back.
   *
   * **It is not a delete, and that is the design.** The button this serves clears a day
   * with no confirmation, so whatever it does has to be something a mis-tap can survive
   * intact. Un-scheduling loses nothing: the task keeps its title, steps, time, energy,
   * goal, tags and its own stored `date`, and lands in the Whenever backlog the To-do tab
   * already draws under the day.
   *
   * **The patch is `hasStartDate` ALONE, and `date` is deliberately untouched** — the same
   * shape components/TaskCard.tsx's "Move to Whenever" shortcut writes (see its
   * `handleMoveSection`, which documents why the two directions aren't symmetrical). A task
   * parked from next Thursday keeps Thursday, so putting it back restores the day rather
   * than silently reading "today". `dated: true` is the undo, and for the same reason it
   * writes no date either: every id passed here already had one.
   *
   * **Recurring tasks must never be passed in.** A recurring task is ONE row, not a row per
   * day (lib/taskRecurrence.ts), so `hasStartDate` is its START BOUNDARY, not "is it on
   * today" — flipping it would silently re-open every past occurrence of the series. The
   * caller filters; this guards anyway, because the cost of getting it wrong is invisible
   * until someone looks at last month.
   *
   * Routed through `update()` per id rather than one bulk UPDATE: that is what re-schedules
   * each task's reminder for its new state, stamps the row for live-sync and mirrors the
   * calendar event. A bulk SQL write would skip all three (see store/useShoppingStore.ts's
   * header for what that cost the monthly reset), and a day's worth of tasks is ~10 rows —
   * `scheduleWidgetSync()` is debounced, so the repeat is genuinely cheap.
   */
  setTasksDated(ids, dated) {
    const byId = new Map(get().tasks.map((t) => [t.id, t]));
    for (const id of ids) {
      const task = byId.get(id);
      if (!task || task.recurring !== 'none') continue;
      if (task.hasStartDate === dated) continue;
      get().update(id, { hasStartDate: dated });
    }
  },

  reorderTasks(orderedIds) {
    const { tasks } = get();
    // What the user was looking at: the Whenever list's order, which is sort_order with the
    // load order (task_date, task_time) as the tie-break every task starts life on.
    const sorted = tasks.map((t, i) => ({ t, i })).sort((a, b) => a.t.sortOrder - b.t.sortOrder || a.i - b.i);
    const queue = orderedIds.filter((id) => tasks.some((t) => t.id === id));
    if (queue.length < 2) return;
    const moving = new Set(queue);
    // The moved rows go back into the SLOTS they already occupied, in their new order, so a
    // task the list was filtering out (another person's, a tag filter, a dated one on a tab
    // that hides those) keeps whichever visible tasks it sat between instead of being shoved
    // to one end by a drag it had no part in. Same contract as useHabitStore.reorder.
    const nextIds = sorted.map(({ t }) => (moving.has(t.id) ? queue.shift()! : t.id));
    const position = new Map(nextIds.map((id, i) => [id, i]));

    // Renumbering everything is what makes this work at all on rows that have never been
    // reordered (every sort_order starts at 0, so slot arithmetic alone would be a no-op) —
    // but only rows whose number actually MOVES are written and broadcast. sort_order is a
    // synced field (lib/liveSync's TABLE_COLUMNS), so writing all of them every time would
    // put the whole task table on the wire for a two-row swap.
    const changed = tasks.filter((t) => position.get(t.id) !== t.sortOrder);
    changed.forEach((t) => updateRow('tasks', { sort_order: position.get(t.id)! }, 'id = ?', [t.id]));
    set((s) => ({
      tasks: s.tasks.map((t) => (position.has(t.id) ? { ...t, sortOrder: position.get(t.id)! } : t)),
    }));
    changed.forEach((t) => syncTaskRow(t.id));
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
    // A 'note' has no completion state to cascade into (it keeps whatever steps a stepped
    // card left it, but draws none of them) — bail before the cascade rather than after,
    // since it writes `done` through update(), which toggle()'s own guard never sees.
    if (!isCompletable(owner.cardType)) return;
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
    // The DELETE above is a real hard delete of every row, tombstones included, so the
    // restore zone has nothing left to offer — clear it rather than leave rows that would
    // fail to come back.
    set({ tasks: [], deletedTasks: [] });
    scheduleWidgetSync();
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

  clearGoal(goalId) {
    set((s) => ({ tasks: s.tasks.map((t) => (t.goalId === goalId ? { ...t, goalId: null } : t)) }));
  },

  clearPerson(personId) {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        // Clear the name mirror alongside the id, or the row would still render the
        // removed person's name under the collapsed row's assignee chip.
        t.assigneeId === personId ? { ...t, assigneeId: '', assignee: '' } : t
      ),
    }));
  },

  clearTag(tagId) {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.tagIds.includes(tagId) ? { ...t, tagIds: t.tagIds.filter((x) => x !== tagId) } : t
      ),
    }));
  },
  };
});
