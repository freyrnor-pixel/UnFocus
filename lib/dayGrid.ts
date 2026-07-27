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
 *   Used by → components/DayGridLines.tsx, components/DayHourScale.tsx (EMPTY_GRID_HEIGHT),
 *             components/PlanTaskCard.tsx (COLLAPSED_GRID_HEIGHT)
 *   Data    → none — pure constants + geometry helpers
 *
 * Edit notes:
 *   - Full 24h window (GRID_START_HOUR 0 → GRID_END_HOUR 24), not a "waking hours" subset
 *     — a task at 05:30 or 23:45 still needs a real position on the grid. The COLLAPSED
 *     viewport (`COLLAPSED_GRID_HEIGHT`) is what keeps the resting card compact; callers
 *     auto-scroll that viewport to the current hour so the visible window is relevant
 *     without needing a narrower grid.
 *   - **Overlap layout (2026-07-26, user report: "not clean, make sure things don't
 *     overlap")**: `layoutGridEntries()` is the Google Calendar/Outlook side-by-side-columns
 *     answer to two distinct causes of visually overlapping cards — (1) genuinely
 *     overlapping tasks (two real time ranges that intersect) get split into side-by-side
 *     lanes instead of stacking on top of each other, and (2) a short/undurationed task's
 *     `minHeightPx` floor (needed so its title stays legible) can otherwise visually run
 *     past the top of whichever card starts next in the same horizontal slice, even when
 *     the two tasks don't truly overlap in time — this clamps that floor so it never
 *     encroaches. PlanTaskCard is the only caller; keep this pure/geometry-only so it stays
 *     easy to unit test without mounting the component.
 */
export const GRID_START_HOUR = 0;
export const GRID_END_HOUR = 24;
export const HOUR_HEIGHT = 52; // px per hour
export const PX_PER_MIN = HOUR_HEIGHT / 60;
export const GUTTER_WIDTH = 48; // left column width for "HH:00" hour labels
export const GRID_TOTAL_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT;
// Resting (collapsed) viewport height — ~4 hours visible before the grid needs scrolling.
export const COLLAPSED_GRID_HEIGHT = HOUR_HEIGHT * 4;
// Empty-day viewport height (DayHourScale only) — ~2 hours. A day with nothing on it doesn't
// need the same 4-hour window a populated day reserves room for tasks within; a shorter grid
// here keeps the Home preview card's resting height slimmer on a light/empty day.
export const EMPTY_GRID_HEIGHT = HOUR_HEIGHT * 2;

/** Minutes-since-midnight → y position (px) within the grid. */
export function minutesToY(minutes: number): number {
  return (minutes - GRID_START_HOUR * 60) * PX_PER_MIN;
}

export type GridEntryLayout = {
  top: number;
  height: number;
  /** Left offset as a percentage of the card's available (post-gutter) width. */
  leftPct: number;
  /** Width as a percentage of the card's available (post-gutter) width. */
  widthPct: number;
};

/**
 * Lays out timed grid entries (each with a real `start`/`end` in minutes-since-midnight)
 * so overlapping tasks sit in side-by-side columns rather than stacking on top of each
 * other, and clamps each card's rendered height so a short task's `minHeightPx` floor
 * can't visually run into whichever later entry shares any horizontal overlap with it.
 *
 * `entries` MUST already be sorted by `start` ascending.
 */
export function layoutGridEntries<T extends { start: number; end: number }>(
  entries: T[],
  opts: { minHeightPx: number; gapPx: number }
): GridEntryLayout[] {
  const n = entries.length;
  const columns = new Array<number>(n);
  const columnCounts = new Array<number>(n);

  // 1) Cluster transitively-overlapping entries, greedily assigning each a column
  //    within its cluster (the first column whose last occupant has already ended).
  let clusterIndices: number[] = [];
  let clusterEnd = -Infinity;
  const flushCluster = () => {
    if (clusterIndices.length === 0) return;
    const laneEnds: number[] = [];
    for (const idx of clusterIndices) {
      const e = entries[idx];
      let lane = laneEnds.findIndex((end) => end <= e.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(e.end);
      } else {
        laneEnds[lane] = e.end;
      }
      columns[idx] = lane;
    }
    for (const idx of clusterIndices) columnCounts[idx] = laneEnds.length;
  };
  entries.forEach((e, idx) => {
    if (clusterIndices.length > 0 && e.start >= clusterEnd) {
      flushCluster();
      clusterIndices = [];
      clusterEnd = -Infinity;
    }
    clusterIndices.push(idx);
    clusterEnd = Math.max(clusterEnd, e.end);
  });
  flushCluster();

  // 2) Raw pixel/percentage geometry per entry, before the height clamp.
  const tops = entries.map((e) => minutesToY(e.start));
  const rawHeights = entries.map((e, i) => Math.max(opts.minHeightPx, minutesToY(e.end) - tops[i]));
  const widthPcts = columnCounts.map((count) => 100 / count);
  const leftPcts = columns.map((col, i) => widthPcts[i] * col);

  const overlapsHorizontally = (i: number, j: number) =>
    leftPcts[i] < leftPcts[j] + widthPcts[j] && leftPcts[j] < leftPcts[i] + widthPcts[i];

  // 3) Clamp each entry's height so it can't run past whichever later entry is the first
  //    (i.e. nearest, since entries are start-sorted) to share horizontal space with it.
  return entries.map((_, i) => {
    let bottomCap = Infinity;
    for (let j = i + 1; j < n; j++) {
      if (overlapsHorizontally(i, j)) {
        bottomCap = tops[j] - opts.gapPx;
        break;
      }
    }
    const height = bottomCap === Infinity ? rawHeights[i] : Math.max(6, Math.min(rawHeights[i], bottomCap - tops[i]));
    return { top: tops[i], height, leftPct: leftPcts[i], widthPct: widthPcts[i] };
  });
}
