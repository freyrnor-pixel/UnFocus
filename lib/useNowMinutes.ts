/**
 * useNowMinutes.ts — "what time is it, live" as minutes since midnight.
 *
 * Re-renders the caller once a minute so anything pinned to the current clock time
 * drifts along on its own: the Plans day-view's now-line, and the Health tab's medicine
 * card (which tray is due, when an as-needed dose becomes allowed again).
 *
 * Extracted from components/PlanTaskCard.tsx (2026-07-27) when the medicine card needed
 * the same tick — one shared interval-backed hook instead of two copies drifting apart.
 *
 * Connections:
 *   Imports → react
 *   Used by → components/PlanTaskCard.tsx (day-grid now-line),
 *             components/MedicineTrayCard.tsx (current/next tray, as-needed guard)
 *   Data    → none — reads the system clock only
 *
 * Edit notes:
 *   - 60s cadence is deliberate: everything reading this is minute-granular, so a
 *     shorter interval would only add re-renders. Nothing here needs seconds.
 *   - Returns a plain number (not a Date) so consumers compare against the same
 *     minutes-since-midnight scale lib/dayGrid.ts and lib/medicineSchedule.ts use.
 */
import { useEffect, useState } from 'react';
import { localMinutesOf } from '@/lib/date';

const currentMinutes = () => localMinutesOf(new Date());

export function useNowMinutes(): number {
  const [now, setNow] = useState(currentMinutes);
  useEffect(() => {
    const id = setInterval(() => setNow(currentMinutes()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default useNowMinutes;
