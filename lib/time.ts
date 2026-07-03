/**
 * time.ts — shared "HH:MM" time-of-day parsing helpers.
 *
 * Two parsers with deliberately different contracts, previously duplicated as
 * private functions in store/useTaskStore.ts (parseTime) and lib/reminders.ts
 * (parseHM):
 *   - parseTimeStrict: returns null on malformed input — callers cancel the
 *     reminder rather than fire at a wrong time (per-task notifications).
 *   - parseTimeOrDefault: clamps/falls back to 08:00 — callers (weekly/monthly
 *     reminders) must fire even if the stored time is somehow bad.
 *
 * Connections:
 *   Imports → —
 *   Used by → lib/taskNotifications.ts, lib/reminders.ts
 *   Data    → none (pure functions)
 */

/** Parse "HH:MM" into [hour, minute], or null if it isn't a valid 24h time. */
export function parseTimeStrict(time: string): [number, number] | null {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return [h, m];
}

/** Parse "HH:MM" into [hour, minute], clamping to range and falling back to 08:00 on bad input. */
export function parseTimeOrDefault(time: string): [number, number] {
  const [h, m] = (time || '').split(':').map((n) => parseInt(n, 10));
  const hour = Number.isFinite(h) ? Math.min(Math.max(h, 0), 23) : 8;
  const minute = Number.isFinite(m) ? Math.min(Math.max(m, 0), 59) : 0;
  return [hour, minute];
}
