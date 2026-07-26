/**
 * dayGrid.ts — shared fixed-hour calendar-grid geometry for PlanTaskCard's day-view.
 *
 * One pixel-per-minute scale (Google Calendar's day view was the explicit reference,
 * 2026-07-26 user feedback after two earlier "calendar-style" passes on the old
 * proportional/clamped rail still didn't read as a calendar) so real clock time maps
 * directly to vertical position — an hour is always the same height, wherever it falls
 * in the day. Shared by DayGridLines (the background hour lines + now-line, reused by
 * both the empty-day ruler and the populated grid) and PlanTaskCard (task-card
 * positioning) so nothing computes its own competing scale.
 *
 * Connections:
 *   Imports → none
 *   Used by → components/DayGridLines.tsx, components/DayHourScale.tsx,
 *             components/PlanTaskCard.tsx
 *   Data    → none — pure constants + geometry helpers
 *
 * Edit notes:
 *   - Full 24h window (GRID_START_HOUR 0 → GRID_END_HOUR 24), not a "waking hours" subset
 *     — a task at 05:30 or 23:45 still needs a real position on the grid. The COLLAPSED
 *     viewport (`COLLAPSED_GRID_HEIGHT`) is what keeps the resting card compact; callers
 *     auto-scroll that viewport to the current hour so the visible window is relevant
 *     without needing a narrower grid.
 */
export const GRID_START_HOUR = 0;
export const GRID_END_HOUR = 24;
export const HOUR_HEIGHT = 52; // px per hour
export const PX_PER_MIN = HOUR_HEIGHT / 60;
export const GUTTER_WIDTH = 48; // left column width for "HH:00" hour labels
export const GRID_TOTAL_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT;
// Resting (collapsed) viewport height — ~4 hours visible before the grid needs scrolling.
export const COLLAPSED_GRID_HEIGHT = HOUR_HEIGHT * 4;

/** Minutes-since-midnight → y position (px) within the grid. */
export function minutesToY(minutes: number): number {
  return (minutes - GRID_START_HOUR * 60) * PX_PER_MIN;
}
