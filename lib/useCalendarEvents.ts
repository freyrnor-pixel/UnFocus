/**
 * useCalendarEvents.ts — the device calendar's events for one day, loaded on focus.
 *
 * The store/effect half of lib/deviceCalendar.ts, kept separate for the same reason
 * lib/useDayLog.ts is separate from lib/dayLog.ts: the module stays a pure(ish) wrapper
 * over the native API, and everything stateful lives here.
 *
 * This hook owns the **contextual permission prompt** — the one and only time the app asks
 * for calendar access, at the moment the timeline is first opened. Never during onboarding,
 * and never again after an answer.
 *
 * Connections:
 *   Imports → react, lib/deviceCalendar, store/useSettingsStore (featureDayLog,
 *             dayLogCalendarIds)
 *   Used by → app/(tabs)/plans.tsx (the timeline layout)
 *   Data    → reads device calendars. Writes nothing.
 *
 * Edit notes:
 *   - **Declining is permanent and silent.** `askedRef` makes the request at most once per
 *     mount, `requestCalendarAccessOnce` refuses to re-prompt once the OS says the question
 *     is settled, and a `false` answer results in an empty array and NOTHING else — no
 *     banner, no "enable calendar access" row, no badge, no second chance later. The
 *     timeline is complete without it.
 *   - Reloads when the date, the visible-calendar selection, or the screen's focus changes
 *     — NOT on a timer. An event the user just added elsewhere appears when they come back
 *     to the tab, which is soon enough, and polling the calendar on an interval is exactly
 *     the kind of background work this app doesn't do.
 *   - Every path is failure-tolerant by construction: lib/deviceCalendar.ts returns [] for
 *     anything that goes wrong, so a revoked permission mid-session degrades to "no
 *     calendar events" rather than an error state.
 */
import { useEffect, useRef, useState } from 'react';
import { DeviceCalendarEvent, loadCalendarEvents, requestCalendarAccessOnce } from '@/lib/deviceCalendar';
import { useSettingsStore } from '@/store/useSettingsStore';

/**
 * `date` is `YYYY-MM-DD`. `focused` should be the screen's focus state — pass `true` from a
 * screen that's always mounted, or a `useIsFocused()` value to reload on return.
 *
 * Take that hook from **`expo-router`**, not `@react-navigation/native`: as of SDK 56
 * expo-router is no longer compatible with react-navigation and importing from it fails
 * the bundle outright ("expo-router is no longer compatible with react-navigation").
 */
export function useCalendarEvents(date: string, focused: boolean): DeviceCalendarEvent[] {
  const enabled = useSettingsStore((s) => s.featureDayLog);
  const calendarIds = useSettingsStore((s) => s.dayLogCalendarIds);
  const [events, setEvents] = useState<DeviceCalendarEvent[]>([]);
  // At most one permission request per mount. The module refuses to re-prompt across
  // sessions too; this guards the within-session case.
  const askedRef = useRef(false);

  useEffect(() => {
    if (!focused) return;
    let cancelled = false;
    // `cancelled` guards the async setState: a tab swipe can unmount this before the
    // native call returns, and setting state on a gone component is a warning nobody
    // can action.
    (async () => {
      if (!enabled) {
        if (!cancelled) setEvents([]);
        return;
      }
      if (!askedRef.current) {
        askedRef.current = true;
        // The contextual ask — the one and only time. A decline lands here as `false`
        // and we simply carry on with an empty list: that is the supported permanent
        // state, not an error, and nothing anywhere mentions it again.
        const granted = await requestCalendarAccessOnce();
        if (!granted) {
          if (!cancelled) setEvents([]);
          return;
        }
      }
      const next = await loadCalendarEvents(date, calendarIds);
      if (!cancelled) setEvents(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [focused, enabled, date, calendarIds]);

  return events;
}

export default useCalendarEvents;
