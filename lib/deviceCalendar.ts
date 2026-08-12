/**
 * deviceCalendar.ts — READ the device calendar, so the day ahead includes what's already
 * fixed in it.
 *
 * The timeline can only answer "how much runway before the next fixed thing" if it knows
 * about the fixed things. Most of those aren't in this app — they're the appointment, the
 * meeting, the pickup, already sitting in the phone's own calendar.
 *
 * **Read-only, and that is the boundary.** Nothing here creates, updates or deletes an
 * event. (The app does write events elsewhere — lib/taskCalendar.ts mirrors a timed task
 * out to a dedicated "UnFocus" calendar, gated on `settings.calendarSyncEnabled`. That is a
 * separate feature with a separate switch; do not merge the two, and do not add a write
 * path to this file.)
 *
 * A calendar event is **structure, not achievement**. It renders as a timeline item ahead
 * of the now-line and never enters the day log behind it: the log is a record of what YOU
 * did, and a meeting existing in a calendar is not something you did. It is also never
 * completable and never editable — see lib/dayLog.ts.
 *
 * Connections:
 *   Imports → expo-calendar, lib/date (dateStr)
 *   Used by → lib/useDayLog.ts is NOT a caller (calendar events are ahead of now, not
 *             behind it); components/PlanTaskCard.tsx receives them through
 *             app/(tabs)/plans.tsx, which owns the permission prompt
 *   Data    → reads device calendars + events. Writes nothing, anywhere, ever.
 *
 * Edit notes:
 *   - **SDK 56's class-based API only.** The old flat `getEventsAsync`/`getCalendarsAsync`
 *     now THROW at runtime unless imported from 'expo-calendar/legacy'. Use `listEvents`
 *     and `getCalendars`, as lib/taskCalendar.ts's header also warns.
 *   - **No native build needed.** `expo-calendar` is already a dependency AND already
 *     registered in app.json's `plugins` with its permission string (it has been since the
 *     reserve-only pass), and lib/taskCalendar.ts already calls into it. Reading events is
 *     pure JS on top of a module that already ships, so this is OTA-deployable — no
 *     `runtimeVersion` bump.
 *   - **Declining is a supported permanent state.** `loadCalendarEvents` asks ONCE, via
 *     `requestOnce`; after that it only ever checks the existing grant. There is no
 *     re-prompt, no nag, no banner, and no degraded-mode warning — the timeline works
 *     perfectly well on in-app items alone. Do not add a "grant access" call to action.
 *   - Every call swallows its own failures and returns [] — a calendar that's unavailable,
 *     revoked mid-session or throwing must never take the day-view down with it.
 *   - All-day events are skipped deliberately: they have no clock position, so placing one
 *     on a proportional axis would mean inventing a time for it.
 */
import { getCalendars, getCalendarPermissions, listEvents, requestCalendarPermissions, EntityTypes } from 'expo-calendar';
import { dateStr, localMinutesOf } from '@/lib/date';

/** One device-calendar event, narrowed to what a timeline row needs. */
export type DeviceCalendarEvent = {
  id: string;
  title: string;
  /** Local minutes since midnight. */
  startMinutes: number;
  endMinutes: number;
};

/** A device calendar, for the "which of these should show" picker in Settings. */
export type DeviceCalendarInfo = { id: string; title: string };



/** Coerce the SDK's `Date | string` event bounds into a real Date, or null. */
function toDate(value: Date | string | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Whether we already hold calendar permission. Never prompts — this is what the UI should
 * ask before deciding whether to render anything calendar-shaped.
 */
export async function hasCalendarAccess(): Promise<boolean> {
  try {
    const perm = await getCalendarPermissions();
    return perm.status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Ask for calendar access, once, at the moment the user first opens the timeline —
 * contextually, never during onboarding.
 *
 * Returns whether access is now held. A decline is final: the OS itself stops showing the
 * system dialog after the first refusal, and this module deliberately adds nothing on top
 * of that. The caller's only correct response to `false` is to carry on without calendar
 * events.
 */
export async function requestCalendarAccessOnce(): Promise<boolean> {
  try {
    const existing = await getCalendarPermissions();
    if (existing.status === 'granted') return true;
    // `canAskAgain === false` means the user has settled the question. Asking anyway is
    // the nag this feature promises not to be.
    if (!existing.canAskAgain) return false;
    const perm = await requestCalendarPermissions();
    return perm.status === 'granted';
  } catch {
    return false;
  }
}

/** Every calendar on the device, for the visibility picker. [] when access isn't held. */
export async function listDeviceCalendars(): Promise<DeviceCalendarInfo[]> {
  try {
    if (!(await hasCalendarAccess())) return [];
    const calendars = await getCalendars(EntityTypes.EVENT);
    return calendars.map((c) => ({ id: c.id, title: c.title }));
  } catch {
    return [];
  }
}

/**
 * The timed events on `date` (`YYYY-MM-DD`), oldest first.
 *
 * `visibleCalendarIds` is `settings.dayLogCalendarIds`: an EMPTY array means "all of them",
 * which is the default and the only sane one — a picker that starts empty would show
 * nothing and read as broken. An id that no longer exists is simply skipped.
 */
export async function loadCalendarEvents(
  date: string,
  visibleCalendarIds: string[]
): Promise<DeviceCalendarEvent[]> {
  try {
    if (!(await hasCalendarAccess())) return [];
    const calendars = await getCalendars(EntityTypes.EVENT);
    const wanted =
      visibleCalendarIds.length === 0
        ? calendars
        : calendars.filter((c) => visibleCalendarIds.includes(c.id));
    if (wanted.length === 0) return [];

    // Query the whole local day, then keep only what actually falls on it: a multi-day
    // event overlaps this window without belonging to this day's clock.
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const events = await listEvents(wanted, dayStart, dayEnd);

    const out: DeviceCalendarEvent[] = [];
    for (const event of events) {
      // An all-day event has no clock position — see the header. Skipped, not floated.
      if (event.allDay) continue;
      const start = toDate(event.startDate);
      const end = toDate(event.endDate);
      if (!start || dateStr(start) !== date) continue;
      out.push({
        id: event.id,
        title: event.title ?? '',
        startMinutes: localMinutesOf(start),
        // An event ending on a later day is clamped to the end of this one, so it draws as
        // "runs to the end of today" rather than wrapping to a smaller number than it
        // started at and inverting on the axis.
        endMinutes: end && dateStr(end) === date ? localMinutesOf(end) : 24 * 60,
      });
    }
    return out.sort((a, b) => a.startMinutes - b.startMinutes || a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}
