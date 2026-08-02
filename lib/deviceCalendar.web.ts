/**
 * deviceCalendar.web.ts — web preview stub for lib/deviceCalendar.ts.
 *
 * expo-calendar has no web implementation, so every call here reports "no access" and
 * returns nothing. That is not a degraded mode needing a warning: declining calendar
 * access is a fully supported permanent state on device too (see the native file's
 * header), so the web preview simply exercises the same no-calendar path a real user who
 * said no would get.
 *
 * Connections:
 *   Imports → none
 *   Used by → components/PlanTaskCard.tsx's callers (Metro resolves this over
 *             lib/deviceCalendar.ts on web), same `.web` sibling pattern as
 *             lib/taskCalendar.web.ts and lib/lanTransport.web.ts
 *   Data    → none
 */
export type DeviceCalendarEvent = {
  id: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
};

export type DeviceCalendarInfo = { id: string; title: string };

export async function hasCalendarAccess(): Promise<boolean> {
  return false;
}

export async function requestCalendarAccessOnce(): Promise<boolean> {
  return false;
}

export async function listDeviceCalendars(): Promise<DeviceCalendarInfo[]> {
  return [];
}

export async function loadCalendarEvents(
  _date: string,
  _visibleCalendarIds: string[]
): Promise<DeviceCalendarEvent[]> {
  return [];
}
