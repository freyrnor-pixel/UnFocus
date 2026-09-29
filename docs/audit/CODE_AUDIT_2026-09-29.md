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

## Open — real defects, not fixed here

| # | Severity | Where | Issue | Suggested fix |
|---|---|---|---|---|
| O1 | High | `lib/taskReset.ts` (documented gap) | A **monthly recurring task, once ticked, stays done forever**. `recurringResetPatch` only covers daily/weekly, and the row has no completion date. | Store a done **date** (e.g. `done_on`) and clear `done` when the last occurrence ≤ today is after it. |
| O2 | High (privacy) | `lib/backup.ts` `buildBackup` | The share-sheet export only redacts `user_name`. It still contains `peers.secret` (the LAN HMAC pairing keys) and `settings.device_id`. Anyone holding the file can sign sync envelopes as a paired device on the same network. Restoring on a second phone also clones the first phone's `device_id`, which breaks the LWW tiebreak between the two. | Drop the `peers` table from both exports, and do not restore `device_id` (keep the live one). |
| O3 | Medium | `lib/syncService.ts` `onEnvelope` | `applyDelta` writes SQLite but no store reloads. An inbound peer change stays invisible until the next foreground (tasks/shopping) or the next cold start (people, tags). | After `applyDelta` returns true, debounce-reload the store for `delta.table`. |
| O4 | Medium | `lib/notifications.ts` `scheduleMonthlyReminder` | The monthly-reset reminder uses a native MONTHLY trigger with `day: monthlyResetDate`. With 29–31 it is skipped in shorter months, which contradicts the Settings copy. | Schedule it as a one-off for `monthlyResetDayIn(...)` and re-arm on foreground, the same pattern as F4. |
| O5 | Medium | `lib/db.ts` migration runner | `user_version` is advanced to `migrations.length` even when a migration fails with a non-"duplicate column" error. That migration is never retried. | Stop at the first real failure: set `user_version = i` and break. |
| O6 | Low–Med | `lib/lanTransport.ts` socket `data` | The frame buffer is unbounded and filled **before** any authentication. Any host on the LAN can grow it without a newline until the app runs out of memory, whenever sync is on. | Cap the buffer (e.g. 1 MB) and destroy the socket past it. |
| O7 | Low | `lib/notifications.ts` `scheduleWeeklyTaskNotifications` / `cancelTaskNotification` | Cancel-then-schedule is async and runs unawaited from store actions. Two quick edits that change a weekly task's days can interleave and leave a stale `task-<id>-sN` armed. | Serialise per task id (a promise chain keyed by id). |
| O8 | Low | `lib/peerAuth.ts` | No nonce or timestamp, so a captured envelope can be replayed. LWW limits this to re-applying an equal-or-newer state. The HMAC compare is also not constant-time. | Include `updatedAt` freshness in the signed body. Use a constant-time compare. |
| O9 | Low | `lib/liveSync.ts` | LWW uses each phone's wall clock (`updatedAt`), so clock skew between phones silently discards the "later" edit. Inherent to the design. Noted because nothing surfaces it. | Hybrid logical clock, or at least a skew check at pairing. |
| O10 | Low | `lib/db.ts` `pruneOldData` | All the DELETEs share one `try`, so one failing statement skips every prune after it. | One try per statement. |
| O11 | Low | `components/DateChipRow.tsx` | The week strip is computed in `useMemo([])`, so it goes stale when the app stays open across midnight or a week boundary. | Key the memo on `todayStr()` / `useNowMinutes`. |
| O12 | Info | `store/useTaskStore.ts` | `task_steps` are not synced, so a shared task arrives without its steps. | Add `task_steps` as a sync table if shared checklists matter. |

## Verification

- `npx tsc --noEmit`: clean.
- `npx jest`: 143 suites, 2700 passed, 1 skipped (was 142 / 2684). The 16 new tests cover F1, F4–F6 and F8.
- F7 is lifecycle wiring with no unit test. It needs a device check: tick a habit from the widget, reopen the app, tap the habit once, and the count should be widget + 1.
