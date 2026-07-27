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
 *   Used by → components/DayGridLines.tsx (DayScale), components/PlanTaskCard.tsx
 *             (buildDayScale + layoutGridEntries + COLLAPSED_GRID_HEIGHT)
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
 *   - **Elastic (compressed) axis (2026-07-27, user report: "timeline should be more
 *     compressed — empty periods more compressed, while things to do stand out and give a
 *     visual feel for how long in between")**: `buildDayScale()` replaces the single uniform
 *     `minutesToY` mapping with a piecewise one. Minutes that are NEAR something (a task's
 *     span padded by `DENSE_PAD_MIN`, plus a window around `now`) stay at the full
 *     `HOUR_HEIGHT` scale, so a task's card size still reads as its real duration and two
 *     tasks 20 minutes apart still look 20 minutes apart. Everything in between collapses to
 *     a single short band whose height is a LOG curve of the real gap (`gapHeightPx`) —
 *     strictly increasing, so a 6-hour hole is visibly taller than a 1-hour one without
 *     costing 6× the pixels. `y()` is monotonic over the whole axis, so ordering and
 *     overlap maths are unchanged; `layoutGridEntries` takes the scale's `y` via `opts.y`.
 *   - `minutesToY` (the old uniform mapping) is still exported and is what `buildDayScale`
 *     falls back to internally for its dense segments — it is NOT dead. Prefer the scale in
 *     new UI code so hour lines, task cards, and the now-line can never disagree.
 */
export const GRID_START_HOUR = 0;
export const GRID_END_HOUR = 24;
export const HOUR_HEIGHT = 52; // px per hour
export const PX_PER_MIN = HOUR_HEIGHT / 60;
export const GUTTER_WIDTH = 48; // left column width for "HH:00" hour labels
// Right column reserved for the now-line's "HH:MM" label (2026-07-27, user report: the grey hour
// lines ran the full width and the blue current-time reading sat on top of them). Both the grey
// hour lines and the now-line's bar stop short by this much, so the live time always has clear
// space of its own. Wide enough for "00:00" at FontSize.xs bold plus its leading gap.
export const NOW_LABEL_WIDTH = 46;
export const GRID_TOTAL_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT;
// Resting (collapsed) viewport height. Raised from HOUR_HEIGHT*4 (208px, i.e. "4 uniform
// hours") to 280 alongside the elastic axis: on the compressed scale a typical day is roughly
// 90px per task window plus ~50px per fold, so 208 cut off the third thing on the day. 280
// fits a normal two-or-three-item day whole while keeping the Home card compact; anything
// longer scrolls, with the "Show full day" toggle for the rest.
export const COLLAPSED_GRID_HEIGHT = 280;

/** Minutes-since-midnight → y position (px) on the UNIFORM (uncompressed) scale. */
export function minutesToY(minutes: number): number {
  return (minutes - GRID_START_HOUR * 60) * PX_PER_MIN;
}

// ── Elastic axis (2026-07-27) ───────────────────────────────────────────────────────
// Minutes around real content render at full scale; the empty stretches between them
// collapse to a short, duration-proportional band. See the file header.

/** Context kept at full scale on each side of a task's own span. */
export const DENSE_PAD_MIN = 20;
/** Full-scale padding kept around `now`, so the live line always has readable context. */
export const NOW_WINDOW_MIN = 30;
/**
 * `now`'s window is snapped to this granularity before being padded. Without the snap the
 * axis would grow by a minute on each side every 60s tick, sliding every card a fraction of
 * a pixel — a calendar whose now-LINE creeps is correct, one whose task cards creep is not.
 */
export const NOW_SNAP_MIN = 30;
/** Shortest a compressed empty band can be. */
export const GAP_MIN_HEIGHT = 16;
/** Tallest a compressed empty band can be, however long the hole is. */
export const GAP_MAX_HEIGHT = 68;
/** Growth per e-fold of gap length — a log curve, so longer always reads taller. */
const GAP_LOG_K = 14;

/**
 * Height (px) of a compressed empty stretch. Strictly increasing in `minutes` between
 * the two clamps, so "how long in between" stays readable at a glance: ~24px for half an
 * hour, ~37px for an hour, ~50px for three, ~59px for six.
 */
export function gapHeightPx(minutes: number): number {
  const raw = GAP_MIN_HEIGHT + GAP_LOG_K * Math.log1p(Math.max(0, minutes) / 15);
  return Math.max(GAP_MIN_HEIGHT, Math.min(GAP_MAX_HEIGHT, raw));
}

export type ScaleSegment = {
  /** Minutes-since-midnight covered by this segment. */
  startMin: number;
  endMin: number;
  /** Segment's own y offset + height on the elastic axis. */
  y: number;
  height: number;
  /** true = full-scale (real content nearby); false = compressed empty stretch. */
  dense: boolean;
};

export type DayScale = {
  segments: ScaleSegment[];
  /** Total axis height (px) — what an "expanded, show the whole day" viewport should be. */
  totalHeight: number;
  /** First/last minute the axis covers. */
  startMin: number;
  endMin: number;
  /** Minutes-since-midnight → y on the elastic axis (clamped to the axis' own range). */
  y: (minutes: number) => number;
  /** The compressed stretches, for drawing "nothing here for N hours" bands. */
  gaps: ScaleSegment[];
  /** Whole hours that land inside a dense segment — the only ones worth an hour line. */
  hourMarks: { hour: number; y: number }[];
};

type Range = { start: number; end: number };

/** Merge overlapping/touching ranges (input need not be sorted). */
function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ start: r.start, end: r.end });
  }
  return out;
}

/**
 * Builds the elastic axis for one day from the timed entries on it.
 *
 * `entries` are the day's timed task spans (minutes since midnight). `now`, when given,
 * gets its own full-scale window so the live now-line never lands inside a compressed
 * band. With no entries and no `now` the result is an empty axis (height 0) — callers
 * showing an empty day should render their own empty state rather than a bare axis.
 */
export function buildDayScale(entries: Range[], opts: { now?: number } = {}): DayScale {
  const windows: Range[] = entries.map((e) => ({
    start: Math.max(0, e.start - DENSE_PAD_MIN),
    end: Math.min(GRID_END_HOUR * 60, Math.max(e.end, e.start + 1) + DENSE_PAD_MIN),
  }));
  if (opts.now !== undefined) {
    const block = Math.floor(opts.now / NOW_SNAP_MIN) * NOW_SNAP_MIN;
    windows.push({
      start: Math.max(0, block - NOW_WINDOW_MIN),
      end: Math.min(GRID_END_HOUR * 60, block + NOW_SNAP_MIN + NOW_WINDOW_MIN),
    });
  }
  const dense = mergeRanges(windows);

  const segments: ScaleSegment[] = [];
  let y = 0;
  dense.forEach((d, i) => {
    const prev = dense[i - 1];
    if (prev) {
      const gapMinutes = d.start - prev.end;
      const height = gapHeightPx(gapMinutes);
      segments.push({ startMin: prev.end, endMin: d.start, y, height, dense: false });
      y += height;
    }
    const height = (d.end - d.start) * PX_PER_MIN;
    segments.push({ startMin: d.start, endMin: d.end, y, height, dense: true });
    y += height;
  });

  const startMin = segments.length > 0 ? segments[0].startMin : 0;
  const endMin = segments.length > 0 ? segments[segments.length - 1].endMin : 0;

  const yOf = (minutes: number): number => {
    if (segments.length === 0) return 0;
    if (minutes <= startMin) return 0;
    if (minutes >= endMin) return y;
    // Segments are contiguous and start-sorted, so the first one that ends after
    // `minutes` is the one containing it.
    for (const seg of segments) {
      if (minutes < seg.endMin) {
        const span = seg.endMin - seg.startMin;
        const frac = span > 0 ? (minutes - seg.startMin) / span : 0;
        return seg.y + frac * seg.height;
      }
    }
    return y;
  };

  const hourMarks: { hour: number; y: number }[] = [];
  for (const seg of segments) {
    if (!seg.dense) continue;
    const firstHour = Math.ceil(seg.startMin / 60);
    const lastHour = Math.floor(seg.endMin / 60);
    for (let h = firstHour; h <= lastHour; h++) hourMarks.push({ hour: h % 24, y: yOf(h * 60) });
  }

  return {
    segments,
    totalHeight: y,
    startMin,
    endMin,
    y: yOf,
    gaps: segments.filter((s) => !s.dense),
    hourMarks,
  };
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
 *
 * `opts.y` is the minutes→px mapping to lay out against — pass a `buildDayScale()` axis'
 * `y` to position cards on the compressed timeline. Defaults to the uniform `minutesToY`.
 */
export function layoutGridEntries<T extends { start: number; end: number }>(
  entries: T[],
  opts: { minHeightPx: number; gapPx: number; y?: (minutes: number) => number }
): GridEntryLayout[] {
  const toY = opts.y ?? minutesToY;
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
  const tops = entries.map((e) => toY(e.start));
  const rawHeights = entries.map((e, i) => Math.max(opts.minHeightPx, toY(e.end) - tops[i]));
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
