/**
 * taskCalendar.ts — mirror a task to the device calendar and keep it in sync.
 *
 * Reserve-only (expo-calendar, already installed + plugin-registered). Scope:
 * only one-off, dated, timed tasks (recurring === 'none' && task.time set) get a
 * mirrored event — recurring-task mirroring is out of scope for this pass.
 * Mirrors lib/taskNotifications.ts's shape: pure eligibility/detail-building
 * helpers are exported and unit tested; the native-calling glue swallows
 * failures so a calendar-sync error never blocks a task save.
 *
 * Connections:
 *   Imports → expo-calendar, store/useSettingsStore (deviceCalendarId cache)
 *   Used by → store/useTaskStore.ts (add/update/remove/clearAll/syncAllTaskCalendarEvents)
 *   Data    → creates/updates/deletes device calendar events; caches the target
 *             "UnFocus" calendar's id in settings.deviceCalendarId
 *
 * Edit notes:
 *   - .web.ts stub always no-ops — expo-calendar has no web implementation.
 *   - SDK 56's expo-calendar migrated its default export to a class-based API
 *     (ExpoCalendar/ExpoCalendarEvent); the OLD flat createEventAsync/
 *     updateEventAsync/deleteEventAsync now THROW at runtime unless imported
 *     from 'expo-calendar/legacy' — this file deliberately uses the new API.
 *   - Android has no single "default" calendar (getDefaultCalendarSync is
 *     iOS-only) — ensureCalendar() creates/reuses a dedicated local "UnFocus"
 *     calendar via an isLocalAccount source, like most calendar-writing apps do.
 */
import { Platform } from 'react-native';
import {
  ExpoCalendar,
  ExpoCalendarEvent,
  getCalendars,
  createCalendar,
  getDefaultCalendarSync,
  requestCalendarPermissions,
  EntityTypes,
  CalendarAccessLevel,
} from 'expo-calendar';
import type { Task } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';

export type TaskCalendarSettings = { calendarSyncEnabled: boolean };
const UNFOCUS_CALENDAR_TITLE = 'UnFocus';

/** Pure — only one-off, dated, timed tasks get a mirrored event. */
export function isCalendarEligible(task: Pick<Task, 'recurring' | 'time'>): boolean {
  return task.recurring === 'none' && !!task.time;
}

/** Pure — event window: time-box uses its own duration, everything else defaults to 30 min. */
export function buildEventDetails(
  task: Pick<Task, 'title' | 'date' | 'time' | 'taskType' | 'durationMinutes' | 'hint'>
): { title: string; startDate: Date; endDate: Date; notes?: string } | null {
  if (!task.time) return null;
  const start = new Date(`${task.date}T${task.time}:00`);
  if (isNaN(start.getTime())) return null;
  const durationMin = task.taskType === 'time-box' ? (task.durationMinutes ?? 30) : 30;
  const end = new Date(start.getTime() + durationMin * 60000);
  return { title: task.title, startDate: start, endDate: end, notes: task.hint || undefined };
}

/** Finds (or creates) the dedicated "UnFocus" device calendar, caching its id in settings. */
async function ensureCalendar(): Promise<ExpoCalendar | null> {
  const perm = await requestCalendarPermissions();
  if (perm.status !== 'granted') return null;

  const cachedId = useSettingsStore.getState().deviceCalendarId;
  if (cachedId) {
    try {
      return await ExpoCalendar.get(cachedId);
    } catch {
      // stale — fall through and recreate below
    }
  }
  const calendars = await getCalendars(EntityTypes.EVENT);
  const existing = calendars.find((c) => c.title === UNFOCUS_CALENDAR_TITLE);
  if (existing) {
    useSettingsStore.getState().update({ deviceCalendarId: existing.id });
    return existing;
  }
  const source =
    Platform.OS === 'ios'
      ? getDefaultCalendarSync().source
      : { isLocalAccount: true, name: UNFOCUS_CALENDAR_TITLE, type: 'LOCAL' };
  const created = await createCalendar({
    title: UNFOCUS_CALENDAR_TITLE,
    color: '#F4A261',
    entityType: EntityTypes.EVENT,
    source,
    name: UNFOCUS_CALENDAR_TITLE,
    ownerAccount: UNFOCUS_CALENDAR_TITLE,
    accessLevel: CalendarAccessLevel.OWNER,
  });
  useSettingsStore.getState().update({ deviceCalendarId: created.id });
  return created;
}

/** Create/update/cancel a task's mirrored event; returns the id to persist (null = none). Never throws. */
export async function syncTaskCalendarEvent(task: Task, s: TaskCalendarSettings): Promise<string | null> {
  if (!s.calendarSyncEnabled || !isCalendarEligible(task)) {
    if (task.calendarEventId) await cancelTaskCalendarEvent(task.calendarEventId);
    return null;
  }
  const details = buildEventDetails(task);
  if (!details) return null;
  if (task.calendarEventId) {
    try {
      const event = await ExpoCalendarEvent.get(task.calendarEventId);
      await event.update(details);
      return task.calendarEventId;
    } catch {
      // deleted externally — fall through to recreate
    }
  }
  try {
    const calendar = await ensureCalendar();
    if (!calendar) return null;
    const created = await calendar.createEvent(details);
    return created.id;
  } catch {
    return null;
  }
}

/** Delete a mirrored event; swallows errors (already gone / permission revoked). */
export async function cancelTaskCalendarEvent(eventId: string): Promise<void> {
  try {
    const event = await ExpoCalendarEvent.get(eventId);
    await event.delete();
  } catch {
    // already gone
  }
}
