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
 *   Used by → store/useTaskStore.ts
 *   Data    → schedules OS notifications (no SQLite/store access)
 *
 * Edit notes:
 *   - Quiet hours only defer the *reminder*, never the task's own date/time/duration.
 *     Tasks SHIFT past the window (pushPastQuietHours); habits SKIP (see
 *     lib/habitNotifications.ts, Decision 016 Q4) — the two behaviours are
 *     deliberately different.
 *   - One-off tasks fire once (skipped if done/past); weekly-recurring tasks fire on
 *     every selected weekday; time-box tasks additionally get an "end" reminder.
 *   - **Focus mode gating**: `essentialsModeEnabled` (the persisted "Focus mode" default,
 *     not the Home screen's ephemeral session toggle) suppresses notifications for any
 *     task whose `importance !== 'essential'` — mirrors the same field's Home-preview
 *     visibility filtering (app/(tabs)/index.tsx), applied to scheduling instead.
 */
import type { Task } from '@/store/useTaskStore';
import type { Language } from '@/store/useSettingsStore';
import { toExpoWeekday } from '@/lib/date';
import { parseTimeStrict } from '@/lib/time';
import { getTranslations } from '@/lib/i18n';
import {
  scheduleTaskNotification,
  scheduleWeeklyTaskNotifications,
  cancelTaskNotification,
  pushPastQuietHours,
  WeeklyTaskOccurrence,
} from '@/lib/notifications';

/** The settings a task reminder depends on (a structural subset of the settings store). */
export type TaskNotifSettings = {
  taskNotificationsEnabled: boolean;
  language: Language;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  /** Focus mode's persisted default — when on, only essential tasks get notified (mirrors visibility filtering). */
  essentialsModeEnabled: boolean;
};

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
  // Focus mode (persisted default): only essential tasks get notified.
  if (s.essentialsModeEnabled && task.importance !== 'essential') {
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
