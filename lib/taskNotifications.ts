/**
 * taskNotifications.ts — build & (re)schedule a single task's reminders.
 *
 * Extracted from store/useTaskStore.ts so the scheduling logic no longer reaches
 * into the settings store directly: callers pass the relevant settings in, which
 * decouples the store and makes the quiet-hours / weekly-occurrence math testable.
 * Content strings are localised here (the notifications primitives layer stays
 * language-agnostic) and scheduled via lib/notifications.
 *
 * Connections:
 *   Imports → lib/date, lib/notifications, lib/time, lib/i18n (+ Task/Language types)
 *   Used by → store/useTaskStore.ts, app/_layout.tsx (snoozeTaskReminder, from the
 *             "Remind me later" notification action)
 *   Data    → schedules OS notifications (no SQLite/store access)
 *
 * Edit notes:
 *   - Quiet hours only defer the *reminder*, never the task's own date/time/duration.
 *     Tasks SHIFT past the window (pushPastQuietHours); habits SKIP (see
 *     lib/habitNotifications.ts, Decision 016 Q4) — the two behaviours are
 *     deliberately different.
 *   - One-off tasks fire once (skipped if done/past); weekly-recurring tasks fire on
 *     every selected weekday; time-box tasks additionally get an "end" reminder.
 *   - Daily-recurring tasks (2026-07-20) get a real repeating native DAILY trigger,
 *     same idea as weekly. Monthly-recurring tasks have no native trigger that
 *     expresses "day-of-month, clamped" or "nth/last weekday", so they're scheduled
 *     as a one-off for their NEXT occurrence only (lib/taskRecurrence.ts's
 *     nextOccurrenceDate) — the caller (useTaskStore's syncMonthlyTaskNotifications,
 *     called from app/_layout.tsx on boot + every foreground) re-arms it for the
 *     following occurrence once the current one has passed. Every-n-weeks (n > 1) tasks
 *     and daily/weekly tasks whose start date is still ahead take the same path
 *     (`usesNextOccurrenceReminder`) — a native repeating trigger can express neither.
 *   - The one-off path never schedules a past instant: a past DATE trigger fires at once
 *     on Android, so an occurrence whose time has gone is skipped for the next one.
 *   - `snoozeTaskReminder` (2026-07-27) is the "Remind me later" half of the interactive
 *     notification actions. It deliberately does NOT respect quiet hours: the user just
 *     asked to be reminded in 15 minutes, so deferring that to the morning would ignore an
 *     explicit request — unlike a scheduled reminder, which the user never opted into at
 *     that exact moment.
 */
import type { Task } from '@/store/useTaskStore';
import type { Language } from '@/store/useSettingsStore';
import { addDays, toExpoWeekday, dateStr } from '@/lib/date';
import { parseTimeStrict } from '@/lib/time';
import { getTranslations } from '@/lib/i18n';
import { nextOccurrenceDate } from '@/lib/taskRecurrence';
import {
  scheduleTaskNotification,
  scheduleWeeklyTaskNotifications,
  scheduleDailyTaskNotification,
  cancelTaskNotification,
  pushPastQuietHours,
  scheduleReNudge,
  WeeklyTaskOccurrence,
  type QuietHoursSettings,
} from '@/lib/notifications';

/** The settings a task reminder depends on (a structural subset of the settings store). */
export type TaskNotifSettings = {
  taskNotificationsEnabled: boolean;
} & QuietHoursSettings;

/** Pushes a notification's fire time past quiet hours, if enabled — the task itself keeps its real time, only the reminder is deferred. */
function deferPastQuietHours(date: Date, s: TaskNotifSettings): Date {
  if (!s.quietHoursEnabled) return date;
  const pushed = pushPastQuietHours(date.getHours(), date.getMinutes(), s.quietHoursStart, s.quietHoursEnd);
  const out = new Date(date);
  out.setHours(pushed.hour, pushed.minute, 0, 0);
  if (pushed.rolledOver) out.setDate(out.getDate() + 1);
  return out;
}

/** Same idea as deferPastQuietHours but for a weekly occurrence's hour/minute/weekday (no absolute Date to work with). */
function deferOccurrencePastQuietHours(o: WeeklyTaskOccurrence, s: TaskNotifSettings): WeeklyTaskOccurrence {
  if (!s.quietHoursEnabled) return o;
  const pushed = pushPastQuietHours(o.hour, o.minute, s.quietHoursStart, s.quietHoursEnd);
  if (!pushed.rolledOver && pushed.hour === o.hour && pushed.minute === o.minute) return o;
  return {
    ...o,
    hour: pushed.hour,
    minute: pushed.minute,
    weekday: pushed.rolledOver ? (o.weekday === 7 ? 1 : o.weekday + 1) : o.weekday,
  };
}

/**
 * Does this recurring task need its reminder armed as a one-off for the NEXT occurrence
 * (and re-armed on every foreground), rather than a native repeating trigger?
 *
 *   - monthly — no native trigger says "day-of-month, clamped" or "nth/last weekday".
 *   - weekly every n > 1 weeks — a native WEEKLY trigger fires every week, so an
 *     every-other-week task used to ring on its off weeks too.
 *   - daily/weekly with a start date still ahead — a repeating trigger would start
 *     ringing now, before the series has begun.
 *
 * The store's `syncMonthlyTaskNotifications` re-arms exactly this set.
 */
export function usesNextOccurrenceReminder(task: Task, today: string = dateStr(new Date())): boolean {
  if (task.recurring === 'monthly') return true;
  if (task.recurring === 'weekly' && task.weekInterval > 1) return true;
  if ((task.recurring === 'daily' || task.recurring === 'weekly') && task.hasStartDate && task.date > today) return true;
  return false;
}

/**
 * The start instant of the task's next occurrence that is still in the future, or null.
 *
 * `nextOccurrenceDate` is inclusive of today, so on an occurrence day whose reminder time
 * has already passed it hands back today — and a DATE trigger in the past fires
 * IMMEDIATELY on Android. Since this is re-armed on every foreground, that meant the same
 * stale reminder popping each time the app was opened for the rest of that day. Step past
 * it to the following occurrence instead.
 */
function nextFutureOccurrenceStart(task: Task, time: string, nowMs: number = Date.now()): Date | null {
  let from = dateStr(new Date(nowMs));
  // Two looks are enough: today's occurrence (possibly past), then the next one after it.
  for (let i = 0; i < 2; i++) {
    const next = nextOccurrenceDate(task, from);
    if (!next) return null;
    const start = new Date(`${next}T${time}:00`);
    if (isNaN(start.getTime())) return null;
    if (start.getTime() > nowMs) return start;
    from = addDays(next, 1);
  }
  return null;
}

/**
 * Schedule (or cancel) the reminder(s) for a single task, honouring the given
 * notification setting and language. Both task kinds are covered:
 *   - one-off tasks fire once at their date/time (skipped if done or in the past)
 *   - weekly-recurring tasks fire on every selected weekday at their time
 * Time-box tasks additionally get an "end" reminder after their duration.
 */
export function syncTaskNotification(task: Task, s: TaskNotifSettings): void {
  if (!s.taskNotificationsEnabled || !task.time) {
    void cancelTaskNotification(task.id);
    return;
  }
  const parsed = parseTimeStrict(task.time);
  if (!parsed) {
    void cancelTaskNotification(task.id);
    return;
  }
  const [hour, minute] = parsed;
  const t = getTranslations(s.language);

  // Option C: Minimal notification — title is task name only, body is queue status only
  const minimalContent = {
    title: task.title,
    body: t.notif.overviewNothingElse,
  };

  if (usesNextOccurrenceReminder(task)) {
    const start = nextFutureOccurrenceStart(task, task.time);
    if (!start) {
      void cancelTaskNotification(task.id);
      return;
    }
    if (task.taskType === 'time-box') {
      const dur = task.durationMinutes ?? 30;
      const end = new Date(start.getTime() + dur * 60 * 1000);
      void scheduleTaskNotification(
        task.id,
        deferPastQuietHours(start, s),
        minimalContent,
        { date: deferPastQuietHours(end, s), content: minimalContent }
      );
    } else {
      void scheduleTaskNotification(task.id, deferPastQuietHours(start, s), minimalContent);
    }
    return;
  }

  if (task.recurring === 'weekly') {
    if (task.recurringDays.length === 0) {
      void cancelTaskNotification(task.id);
      return;
    }
    const occurrences: WeeklyTaskOccurrence[] = [];
    for (const day of task.recurringDays) {
      if (task.taskType === 'time-box') {
        occurrences.push({
          suffix: `s${day}`,
          weekday: toExpoWeekday(day),
          hour,
          minute,
          content: minimalContent,
        });
        // The end reminder may land later the same day or roll into the next.
        const endTotal = hour * 60 + minute + (task.durationMinutes ?? 30);
        const endDay = (day + Math.floor(endTotal / 1440)) % 7;
        occurrences.push({
          suffix: `e${day}`,
          weekday: toExpoWeekday(endDay),
          hour: Math.floor((endTotal % 1440) / 60),
          minute: endTotal % 60,
          content: minimalContent,
        });
      } else {
        occurrences.push({
          suffix: `s${day}`,
          weekday: toExpoWeekday(day),
          hour,
          minute,
          content: minimalContent,
        });
      }
    }
    void scheduleWeeklyTaskNotifications(
      task.id,
      occurrences.map((o) => deferOccurrencePastQuietHours(o, s))
    );
    return;
  }

  if (task.recurring === 'daily') {
    const pushed = s.quietHoursEnabled
      ? pushPastQuietHours(hour, minute, s.quietHoursStart, s.quietHoursEnd)
      : { hour, minute };
    if (task.taskType === 'time-box') {
      const endTotal = pushed.hour * 60 + pushed.minute + (task.durationMinutes ?? 30);
      void scheduleDailyTaskNotification(task.id, pushed.hour, pushed.minute, minimalContent, {
        hour: Math.floor((endTotal % 1440) / 60),
        minute: endTotal % 60,
        content: minimalContent,
      });
    } else {
      void scheduleDailyTaskNotification(task.id, pushed.hour, pushed.minute, minimalContent);
    }
    return;
  }

  // One-off task: only schedule if not done and still in the future.
  if (task.done) {
    void cancelTaskNotification(task.id);
    return;
  }
  const start = new Date(`${task.date}T${task.time}:00`);
  if (isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    void cancelTaskNotification(task.id);
    return;
  }
  if (task.taskType === 'time-box') {
    const dur = task.durationMinutes ?? 30;
    const end = new Date(start.getTime() + dur * 60 * 1000);
    void scheduleTaskNotification(
      task.id,
      deferPastQuietHours(start, s),
      minimalContent,
      { date: deferPastQuietHours(end, s), content: minimalContent }
    );
  } else {
    void scheduleTaskNotification(task.id, deferPastQuietHours(start, s), minimalContent);
  }
}

// ── Notification action handling (Done / Remind me later) ──────────────────
/**
 * How long "Remind me later" pushes a task reminder out. 15 minutes is short enough that the
 * task doesn't fall off the day, long enough that the nudge isn't the same interruption again.
 */
export const RENUDGE_DELAY_MS = 15 * 60 * 1000;

/**
 * Schedule the snooze follow-up for a task whose reminder the user tapped "Remind me later"
 * on. Content is localised here for the same reason the rest of this file is — lib/notifications
 * only takes already-localised strings.
 */
export function snoozeTaskReminder(task: Task, lang?: Language) {
  const t = getTranslations(lang);
  void scheduleReNudge(task.id, RENUDGE_DELAY_MS, {
    title: t.notif.renudgeTitle(task.title),
    body: t.notif.renudgeBody,
  });
}
