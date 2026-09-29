# Code audit — 2026-09-29

Scope: logic, data and state layers (stores, `lib/`, boot/foreground lifecycle, notifications,
LAN sync, backup/restore). No visual/rendering changes, so no blind-class concerns (CLAUDE.md
A2). Baseline before this pass: `tsc` clean, 142 suites / 2684 tests passing.

Legend: **Fixed** = fixed in this pass, with a regression test. **Open** = reported, not changed.

## Fixed

| # | Where | Defect | Test |
|---|---|---|---|
| F1 | `lib/date.ts` `weekOfMonthlyCycle` / `dateRangeForCycleWeek` | A reset day of 29–31 overflowed a short month (`setDate(31)` in a 30-day month rolls into the next one). In any month after a shorter one the cycle boundary landed days late, or in the future: on 2026-03-01 with reset day 30, "week 1" came back as Mar 2–8. Now uses one clamped `monthlyBoundaryOnOrBefore()`. Also rounds instead of floors day spans, so a DST change can't land a week early. | `__tests__/date.test.ts` |
| F2 | `app/(tabs)/shopping.tsx` `runShoppingDateChecks` | The monthly-reset review was due only when `getDate() >= monthlyResetDate` within the calendar month. So (a) a reset day of 31 **never** fired in a 30-day month or February, even though Settings says "a short month resets on its last day", and (b) a period the app wasn't opened in after payday was skipped (payday the 28th, next open the 2nd → no reset until the 28th). Now compares against the clamped last boundary. It keeps the old rule that a reset earlier in the same calendar month counts, and the old first-run wait. | via F1's helper |
| F3 | `lib/budget.ts` `computeSpendPace` | `new Date(y, m+1, 31)` made a February pay period run into March, which stretched `periodLength`. Now clamped. | `__tests__/budget.test.ts` (existing) |
| F4 | `lib/taskNotifications.ts` monthly path | `nextOccurrenceDate` includes today, so on an occurrence day after the reminder time it scheduled a **past** DATE trigger. On Android that fires immediately. Because this runs on every foreground, the same stale reminder popped every time the app was opened for the rest of that day. Now it steps to the next future occurrence. | `__tests__/taskNotifications.test.ts` |
| F5 | `lib/taskNotifications.ts` weekly/daily | Every-n-weeks (n > 1) tasks got a native WEEKLY trigger, so an every-other-week task rang on its off weeks too. Daily/weekly series with a start date still ahead started ringing immediately. Both now take the one-off next-occurrence path (`usesNextOccurrenceReminder`), which the foreground re-arm covers. The re-arm also covers a series on its start day, so it switches to the repeating trigger. | same |
| F6 | `lib/liveSync.ts` task whitelist | `has_start_date`, `finish_time` and the five `recurring_*` shape columns never synced. A task created on one phone arrived on the peer with the column defaults: dated tasks landed undated (Whenever), every-other-week became weekly, a monthly task moved to the 1st, and a time-box lost its finish. Added. Older peers just omit the columns (applyDelta only writes the keys it receives). | `lib/__tests__/liveSyncTaskColumns.test.ts` |
| F7 | `app/_layout.tsx` foreground | The widget writes habit ticks (`toggleHabitDone`) and tray doses (`takeTray`) straight to SQLite, but only tasks, shopping and notes were reloaded on foreground. So `useHabitStore.increment()` wrote an absolute count from stale memory, or inserted a **second** `habit_logs` row for the same day, and `takeDose()` de-duplicated against stale memory, so a widget "Taken" followed by an in-app tap logged the dose **twice**. Both stores are now reloaded. | — (lifecycle wiring; tsc) |
| F8 | `lib/backup.ts` `restoreBackup` | Restoring an **older** backup inserted pre-migration rows but left `user_version` at the current value, so no data migration ran over them. For example: no default Monthly list, un-migrated shopping statuses, empty `last_acted_at`. `user_version` is now wound back to the backup's version, and the reload's `initDb()` replays those migrations just like a real upgrade. | `__tests__/backup.test.ts` |

## Round 2 — the open items, all fixed (same day)

| # | Where | Fix | Test |
|---|---|---|---|
| O1 | `lib/taskReset.ts`, `store/useTaskStore.ts`, `lib/db.ts` | New `tasks.done_on` (local date ticked). `update()` stamps it whenever `done` changes, so every completion path gets it, and the widget's direct write sets it too. A monthly task's `done` clears once an occurrence later than `done_on` has arrived (`previousOccurrenceDate`), and its `date` (start boundary) never moves. Existing done rows are back-filled from `updated_at`. Synced. | `lib/__tests__/taskReset.test.ts`, `__tests__/taskStateReset.test.ts` |
| O2 | `lib/backup.ts` | `peers` is left out of every export, and a restore neither clears nor refills it. A restore keeps this phone's `settings.device_id`. | `__tests__/backup.test.ts` |
| O3 | `lib/syncService.ts`, `app/_layout.tsx` | New `onRemoteRowApplied()`. The root layout reloads the store an inbound delta changed, batched on a 300 ms timer. | — (lifecycle wiring) |
| O4 | `lib/reminders.ts`, `lib/notifications.ts` | A reset day of 29–31 is armed as a one-off for the next clamped date (`nextMonthlyReminderDate`) and re-armed on every foreground. Days 1–28 keep the native MONTHLY trigger. | `lib/__tests__/monthlyReminderDate.test.ts` |
| O5 | `lib/db.ts` `initDb` | Stops at the first real failure and records only what was applied, so a failed migration is retried next launch. Checked against a real SQLite engine (sql.js): the whole log applies cleanly on a fresh DB and when replayed from version 0 (the restore path). | `lib/__tests__/migrationsRealSqlite.test.ts` |
| O6 | `lib/lanTransport.ts` | Caps the partial frame at `MAX_FRAME_CHARS` (1 MB) and drops the connection past it. | — |
| O7 | `lib/notifications.ts` | Per-task-id operation queue around schedule/cancel. The test fails without the queue and passes with it. | `lib/__tests__/taskNotificationQueue.test.ts` |
| O8 | `lib/liveSync.ts` | **Correction:** `peerAuth` already compared tags in constant time, so round 1 was wrong about that. Replay of a delta for a row we hold was already a no-op, because an equal stamp never wins. What remained was resurrecting a pruned row, so `applyDelta` now refuses to *create* a row from a delta older than the retention window. | `lib/__tests__/liveSyncTaskColumns.test.ts` |
| O9 | `lib/liveSync.ts` | `touchRow`/`softDelete` stamp `max(now, row.updated_at + 1 ms)` (`monotonicStamp`), so a local edit always beats the version it edited even when this phone's clock runs behind. Concurrent edits still resolve by timestamp. | same |
| O10 | `lib/db.ts` `pruneOldData` | One try per statement. Tombstones (tasks, steps) older than the window are now pruned too; they used to stay forever. | — |
| O11 | `components/DateChipRow.tsx` | The week strip is keyed on `todayStr()` and re-renders via `useNowMinutes()`. | — |
| O12 | `lib/liveSync.ts`, `store/useTaskStore.ts`, `lib/db.ts` | `task_steps` is a sync table (bookkeeping columns migrated in). Add, toggle, reorder and the task↔step cascade stamp and broadcast, and remove is a tombstone. | `lib/__tests__/liveSyncTaskColumns.test.ts` |

Known limits left as-is:
- Home-screen widget writes to SQLite directly and can't broadcast. A widget tick reaches a paired phone only with the next in-app edit of that row. It is stamped, so it wins that merge.
- An inbound task delta reloads the store but doesn't re-arm that task's reminder on this phone. It is re-armed on the next local edit or on the settings-driven full re-sync.

## Verification

- Round 1: `tsc` clean; jest 143 suites / 2700 passed (was 142 / 2684).
- Round 2: `tsc` clean; jest numbers in the PR.
- Device checks (lifecycle wiring no unit test can see):
  1. F7: tick a habit from the widget, reopen the app, tap the habit once. The count should be widget + 1.
  2. O3: with two paired phones, edit a task on one. It should appear on the other within a second, without reopening the app.
  3. O1: tick a monthly task, move the phone's date past the next occurrence, and reopen. The task should be back to not done.
