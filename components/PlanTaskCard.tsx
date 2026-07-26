/**
 * PlanTaskCard.tsx — the day-view: a fixed-hour calendar grid of one day's tasks.
 *
 * This is the single shared "time now + rest of day" surface (Decisions 009 / 009a /
 * 009b). The full /plans screen renders it interactively; the Home preview renders the
 * SAME component with `readOnly` (Decision 009a — "the preview IS the day-view,
 * rendered read-only"). There is intentionally no Home-specific variant.
 *
 * **Fixed-hour grid (2026-07-26 rebuild)**: the vertical (default) rail now positions
 * every timed task by real clock time on a fixed pixel-per-minute scale (`lib/dayGrid.ts`
 * + `components/DayGridLines.tsx`) — an hour is always the same height, wherever it falls
 * in the day, with full-width hour lines and a live "now" line, the way Google Calendar's
 * day view works. This replaced an earlier "proportional" rail (connector size between
 * two tasks ∝ the real gap, clamped to a legible min/max) that went through two more
 * calendar-styling passes (borders/lines-only, then hour-label repositioning) before user
 * feedback made clear the fix was the underlying model, not more decoration on top of it.
 * The grid's resting height shows ~4 hours (`COLLAPSED_GRID_HEIGHT`), auto-scrolled to the
 * current hour, with an internal scroll for the rest; the expand toggle grows the viewport
 * to the full 24h grid (`GRID_TOTAL_HEIGHT`) instead of an internal scroll, so "show the
 * whole day" is literal. Untimed ("Anytime") tasks have no clock position, so they stay a
 * plain flat list above the grid, capped at `COLLAPSED_COUNT` and expanded by the same
 * toggle. The "Done today" zone is unchanged — a separate dimmed, collapsed flat list
 * below the grid (Decision 009a); done tasks don't render on the grid itself.
 *
 * Two rail orientations (toggle: settings.accessibility "Horizontal plans timeline"):
 * `horizontal=false` (default) is the fixed-hour grid described above. `horizontal=true`
 * is untouched by the 2026-07-26 rebuild — it keeps the older left-to-right proportional
 * rail (time boxes connected by a horizontal line, clamped gap sizing) since a horizontal
 * fixed-hour axis wasn't part of what was asked for and the accessibility setting is a
 * secondary, opt-in mode. `renderColumn`/`renderHSpacer`/`hNowMarker`/`hGapMarker` and the
 * `PX_PER_MIN`/`MIN_GAP`/`MAX_GAP`/`railTailMinutes` tuning are horizontal-only now.
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, components/ProgressBar,
 *             components/DayHourScale (empty-state grid), components/DayGridLines (populated
 *             grid's hour lines + now-line), lib/dayGrid (shared grid geometry +
 *             layoutGridEntries, the overlap-aware column layout — see its file header),
 *             components/AddRow (inline "add a task" quick-create, gated on the optional
 *             onAddTask callback — Home preview passes it) + components/TimeBoxInput
 *             (quick-add's inline time field), components/Collapsible + components/AnimatedChevron
 *             (done-zone reveal + chevron), react-native-reanimated (FadeInDown/FadeOutDown/
 *             LinearTransition for the anytime list + done-zone + footer, which share one
 *             `containerLayout` LinearTransition so the whole card reflows together),
 *             constants/theme, constants/motion, lib/haptics, lib/i18n,
 *             lib/useAppTheme (incl. useAccessibility), lib/domainColor, components/CardAccent
 *             (badge+wash gradient move, read-only Home header), components/GlowPulse
 *             (breathing "happening now" halo), store/useTaskStore (Task type only)
 *   Used by → app/(tabs)/index.tsx (Home — read-only day-view preview per Decision 009a). Reads
 *             settings.planTimelineHorizontal there and passes it down as the `horizontal`
 *             prop — this component stays store-free/presentational. NOTE: the full /plans
 *             (Tasks/Oppgaver) screen no longer renders this day-view — it was rebuilt into
 *             a tabbed inline-list (2026-07-08); Home is now the sole caller.
 *   Data    → pure presentational; reads no stores. Tasks + callbacks + orientation are
 *             passed in. Live "now" line re-renders on a 60s interval (useNowMinutes).
 *
 * Edit notes:
 *   - **Overlap-safe grid cards (2026-07-26, user report: "not clean, make sure things don't
 *     overlap" — Outlook/Google Calendar as reference)**: `renderGridEntry` used to position
 *     every timed card at full slot width regardless of other tasks, so two overlapping tasks
 *     (or a short task's `MIN_TASK_HEIGHT` floor bleeding into whatever started next) visually
 *     stacked on top of each other. `timedLayout` (`layoutGridEntries`, lib/dayGrid.ts) now
 *     computes a column + height clamp per entry; a new `gridCardColumn` wrapper (nested inside
 *     the existing `gridCardWrap` slot) applies that as percentage left/width, with a hairline
 *     `gridCardColumnGapped` inset only when genuinely side-by-side, so the common
 *     no-overlap case renders pixel-identical to before.
 *   - **Collapse/expand toggle fixed (2026-07-26, user report: "lacks capability to expand and
 *     show the whole day")**: `isVisible`/`showToggle` used to short-circuit on `readOnly` —
 *     every pending task was ALWAYS visible (readOnly is always true, Home being the sole
 *     caller) and the "Show more" footer button NEVER rendered. Both now ignore `readOnly`.
 *     Superseded in spirit by the grid rebuild right after it (expand now grows the grid's
 *     viewport to the full day rather than revealing more rows of a flow-list), but the
 *     underlying bug — a toggle that could never appear — was real and is fixed either way.
 *   - **Collapsed sizing (2026-07-13, padding restored 2026-07-15)**: `cardCollapsed`
 *     (minHeight: `HOME_PREVIEW_CARD_MIN_HEIGHT`, constants/theme.ts) is a compact shared
 *     *resting* floor applied only while `!expanded`, so this card reads the same size as
 *     HomeNotesCard/HomeShoppingCard on a light day — it's a floor, not a cap; the grid's own
 *     `COLLAPSED_GRID_HEIGHT` (lib/dayGrid.ts) does the real height budgeting for the timed
 *     portion now.
 *   - **Empty state (2026-07-24, text removed; 2026-07-25, blank row → hour ruler; 2026-07-26,
 *     ruler → real grid)**: an empty day (`showEmpty`) renders `DayHourScale` — the same fixed-
 *     hour grid as a populated day, just with nothing on it, inside the same collapsed-height
 *     auto-scrolled viewport — instead of the shared `HomePreviewEmpty` blank row other Home
 *     preview cards use. A dashed "add a plan" ghost row that deep-links to /plans shows only
 *     as a FALLBACK when no inline add is wired (`readOnly && !onAddTask`); when `onAddTask` IS
 *     passed the trailing AddRow (below) does inline creation instead. The distinct "all done"
 *     state keeps its own `t.dayViewAllDone` line — it's a reward, not an empty card.
 *   - **Decision 014 (revised 2026-07-14)**: the card face is a `<Surface>` with a
 *     domain-colored border (`borderColor={getDomainColor(theme,'plan').accent}`) on a plain
 *     `theme.surface` fill, so the section reads as belonging to Plans without washing the
 *     whole card in a tint (2026-07-13's whole-card blend read as muddy — see domainColor.ts).
 *     Still don't set Surface's fill/sheen directly — pass `borderColor`/`tint` and let the
 *     material compute the finish (Surface owns border/sheen/blur since Decision 008).
 *   - **Decision 020 follower surfacing (surfacing-only, NOT notifying)**: when a
 *     predecessor is done, its pending follower is highlighted AND — per Session 1's
 *     resolution of open sub-question (b), "pull the follower into today's view" (which
 *     supersedes Decision 020's own "highlight in place" leaning) — a cross-date follower
 *     is pulled into this day-view. Pass `allTasks` (the full store list) so cross-date
 *     followers can be found; without it, only same-list followers surface.
 *   - **Decision 019 hint**: a task's `hint` renders under its title (display-only) while
 *     the task is "up" (current or next), so the reminder shows exactly when it's useful.
 *   - `readOnly` (Home preview) disables row tap-through only — structure, grid,
 *     collapse/expand, and done zone are identical (Decision 009a). The done-toggle is
 *     independently gated on whether `onToggleTask` is passed (not on `readOnly`), so the
 *     Home preview's checkbox stays interactive while row tap-through into the editor
 *     stays disabled. `onAddTask` follows the same "gate on callback, not readOnly" rule —
 *     pass it to render the trailing inline AddRow so a task can be created from the
 *     read-only Home preview without navigating to /plans (2026-07-24).
 *   - **Quick-add essential settings (2026-07-24)**: the trailing AddRow's `extras` carry three
 *     compact inline controls beyond the title — a `TimeBoxInput` (start time, optional), a
 *     repeat chip that cycles none→daily→weekly→monthly (defaults `recurringDays` to today's
 *     weekday the first time it lands on weekly, mirroring TaskCard's own toggleRepeat), and an
 *     energy chip (always rendered — Energy stopped being a toggle 2026-07-26) that cycles
 *     off→+1→−1→off. All three reset to their defaults after each commit. `onAddTask`'s second
 *     argument carries whichever of these the user touched; the caller (Home) owns turning that
 *     into a full `TaskInput` the same way it already does for the title-only case.
 *   - **Anytime badge (2026-07-15)**: untimed rows carry a small "Anytime" text pill in
 *     `titleRow` — they have no clock position (no grid row/dot to mark them anymore since
 *     the 2026-07-26 rebuild dropped the old dashed rail marker along with the flow-list
 *     rail), so the pill is now the only "this is untimed" cue.
 *   - **Completion feedback (2026-07-11, visual-audit)**: no card-level glow/bloom on
 *     completion — user feedback called the whole-card colour flash "too much"; the
 *     checkbox fill + strikethrough (plus the success() haptic in handleToggle) IS the
 *     feedback. The habit-card glow (app/(tabs)/health.tsx) is untouched — this was
 *     Home/Plans-specific.
 *   - **"Selects" the happening-now task (2026-07-26, user report)**: the grid card whose
 *     [start,end) contains `now` gets a stronger tint, a thicker border, and a slight
 *     `transform: scale` bump on top of the existing breathing `GlowPulse` halo — so the one
 *     task the live now-line touches reads as clearly larger/selected, not just differently
 *     tinted. This is unconditional now (no longer suppresses a separate "now" indicator —
 *     the grid's own now-line, drawn by `DayGridLines`, always shows regardless of whether a
 *     task is happening, exactly like Google Calendar's red line does).
 *   - `styles.dot` is the checkmark-circle toggle — a small `PressableScale` rendered as a
 *     sibling (never nested inside) the tappable content, positioned as a trailing column in
 *     flat rows (anytime list, done zone) or pinned to a grid card's top-right corner.
 *   - **Touch target (2026-07-11)**: the done-toggle `dot` is visually 16x16 but
 *     `hitSlop={16}` brings the tappable area to ~48dp, meeting Android's minimum
 *     touch-target size.
 *   - **Purposeful Depth System (2026-07-14)**: passes Surface's `elevated` when
 *     `expanded` — the card the user has actively opened to see the full day becomes
 *     the deepest surface (focus-pop).
 *   - **Collapse feel (2026-07-15)**: the anytime list's rows exit with `FadeOutDown` (not a
 *     plain in-place `FadeOut`) — this app's motion goal for a neurodivergent audience is that
 *     things read as *retreating to somewhere*, never blinking out of existence. The anytime
 *     list, done-zone, and footer all share `containerLayout` (see Connections) so the whole
 *     card reflows as one card rather than several pieces animating on their own clocks. Grid
 *     cards (absolute-positioned by time) don't participate in this — their position is a
 *     direct function of `now`/task time, not list order, so there's no "reflow" for them to
 *     animate.
 *   - **Done-zone frame + calmer toggle (2026-07-16)**: `styles.doneZone` carries a real
 *     border + `theme.surfaceMuted` background so the "Done today" header and its collapsed
 *     rows read as one card — a step subtler than the outer `Surface` so it doesn't stack two
 *     heavy card looks. Its (and the footer show-more toggle's) `PressableScale` passes
 *     `releaseSpring={Spring.calm}` (constants/motion) — a near-critically-damped spring
 *     instead of the default bouncy release, since these are repeatedly-tapped toggles.
 *   - **Badge pinned + header tightened (2026-07-24, tightened 2026-07-26)**: the header's
 *     `CardAccentBadge` is absolutely positioned (`badgeFixed`) instead of inline in the title
 *     row, so it can't drift toward the wash/surface seam when a sibling grows the row taller.
 *     `headerTopRow`'s paddingLeft is 52 (badge 32 + a 4px gap) so the title sits close to the
 *     badge (user report: "more closely linked with the badge"), and `badgeFixed`/`cardContent`
 *     both carry a matching +4 top/paddingTop bump ("move it a bit down"). The header's old
 *     live-clock chip is gone — the grid's own now-line (via `DayGridLines`) is the live clock
 *     now, since this component IS the calendar.
 *   - **Badge/wash moved outside cardContent's padding (2026-07-24, follow-up — user report,
 *     screenshot)**: `badgeFixed`'s `top`/`left` used to be plain `0`, with `cardContent`'s own
 *     padding relied on to inset it — except React Native's real (native) behavior is that an
 *     absolutely-positioned child DOES inherit its parent's padding as part of its origin
 *     (confirmed by `CardAccentWash`'s pre-existing `-Spacing.md` bleed, which exists purely to
 *     cancel that same inheritance) — while react-native-web (this repo's headless preview
 *     tooling) does NOT reproduce that inheritance, since it compiles straight to CSS, where the
 *     absolute containing block is the padding *edge*, not the content box. Testing changes here
 *     against the web preview alone is actively misleading for this exact interaction. Fix:
 *     `CardAccentWash` and `CardAccentBadge` mount as siblings of `cardContent` (not children of
 *     it), directly inside `Surface` (still gated on `readOnly`) — `Surface` itself adds no
 *     padding of its own — so their `top`/`left` offsets are unambiguous on both platforms.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import ProgressBar from '@/components/ProgressBar';
import DayHourScale from '@/components/DayHourScale';
import DayGridLines from '@/components/DayGridLines';
import AddRow from '@/components/AddRow';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import TimeBoxInput from '@/components/TimeBoxInput';
import { Task, Recurring } from '@/store/useTaskStore';
import { FontSize, Fonts, HOME_PREVIEW_CARD_MIN_HEIGHT, Radius, Spacing, rgba } from '@/constants/theme';
import { Duration, Ease, Spring } from '@/constants/motion';
import { useAppTheme, useScaledStyles, useAccessibility } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { getDomainColor } from '@/lib/domainColor';
import { dayOfWeekMon0 } from '@/lib/date';
import { CardAccentBadge, CardAccentWash } from '@/components/CardAccent';
import GlowPulse from '@/components/GlowPulse';
import { COLLAPSED_GRID_HEIGHT, GRID_TOTAL_HEIGHT, GUTTER_WIDTH, GridEntryLayout, layoutGridEntries, minutesToY } from '@/lib/dayGrid';

type Props = {
  /** Tasks scheduled for the viewed date (already filtered by the caller). */
  tasks: Task[];
  /** Full store list — lets cross-date followers surface into this view (Decision 020). Defaults to `tasks`. */
  allTasks?: Task[];
  /** Home preview: disables row tap-through only (Decision 009a). Done-toggle is
   *  independently gated on whether `onToggleTask` is passed — pass it to keep the
   *  checkbox interactive even when `readOnly` is set. */
  readOnly?: boolean;
  onPressTask?: (task: Task) => void;
  onToggleTask?: (task: Task) => void;
  /** Inline quick-add: when passed, an AddRow renders at the bottom of the card and calls this
   *  with the typed title (plus whichever of the extras row's essential settings the user set)
   *  to create an undated task dated today. Gated on the callback's presence, NOT on `readOnly`
   *  — so the read-only Home preview can still add a task (same "gate on callback, not
   *  readOnly" pattern as the done-toggle). */
  onAddTask?: (
    title: string,
    extra: { time?: string; recurring: Recurring; recurringDays: number[]; energyEnabled: boolean; energyValue: number }
  ) => void;
  /** Read-only preview: shows a "See everything →" link in the section header. */
  onSeeMore?: () => void;
  /** Test/preview override for the live clock (minutes since midnight). */
  now?: number;
  /** Rail orientation — settings.planTimelineHorizontal. Default false (fixed-hour grid). */
  horizontal?: boolean;
};

// Horizontal-only proportional rail tuning (2026-07-26: the vertical/default rail moved to
// the fixed-hour grid, lib/dayGrid.ts — these only tune the opt-in horizontal accessibility
// mode now). Connector size between two timed tasks = the real gap in minutes × PX_PER_MIN,
// clamped legible.
const PX_PER_MIN = 0.45;
const MIN_GAP = 10;
const MAX_GAP = 56;
const DEFAULT_BOX_MIN = 30; // start-at tasks get a nominal span so "happening now" works

const DONE_COL_WIDTH = 40;
// Grid task-card floor (lib/dayGrid.ts's HOUR_HEIGHT=52 means a 30min default span is only
// ~26px — too short for a title + padding to sit comfortably) so short/undurationed tasks
// stay legible and tappable.
const MIN_TASK_HEIGHT = 40;
// Hairline gap between two grid cards that would otherwise touch (same-lane clamp, or
// side-by-side columns) — enough to read as separate cards without wasting grid space.
const GRID_CARD_GAP = 2;

// Horizontal rail column sizing.
const H_COLUMN_WIDTH = 92;
const H_RAIL_HEIGHT = 30;
const H_CONTENT_HEIGHT = 40;

function toMinutes(time: string): number | null {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToLabel(mins: number): string {
  const h = Math.floor((((mins % 1440) + 1440) % 1440) / 60);
  const m = ((mins % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

type TimedEntry = { task: Task; start: number; end: number };

type RailItemOpts = {
  timed?: TimedEntry;
  isHappeningNow?: boolean;
  isPast?: boolean;
  /** Flat rows (anytime list, done zone) fade/slide in + reflow when the "Show more/less"
   *  toggle mounts/unmounts them; done-zone rows omit this (their reveal is owned by the
   *  Collapsible wrapper). */
  animateIn?: boolean;
};

function timedEntryOf(task: Task): TimedEntry {
  const start = toMinutes(task.time!) ?? 0;
  const end = task.taskType === 'time-box' ? start + (task.durationMinutes ?? DEFAULT_BOX_MIN) : start + DEFAULT_BOX_MIN;
  return { task, start, end };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Horizontal-only (Decision 009b) — proportional tail = 10% of the visible span, floored at 15 min. */
function railTailMinutes(spanMinutes: number): number {
  return Math.max(spanMinutes * 0.1, 15);
}

/** Re-renders every 60s so the "now" line drifts along the grid live. */
function useNowMinutes(): number {
  const [now, setNow] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNow(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const COLLAPSED_COUNT = 5; // anytime-list cap, and (horizontal-only) current+next+3 after

export default function PlanTaskCard({
  tasks,
  allTasks,
  readOnly = false,
  onPressTask,
  onToggleTask,
  onAddTask,
  onSeeMore,
  now: nowOverride,
  horizontal = false,
}: Props) {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const styles = useScaledStyles(baseStyles);
  const domainColor = getDomainColor(theme, 'plan');
  const liveNow = useNowMinutes();
  const now = nowOverride ?? liveNow;

  // Gate row entrance animations to genuine post-mount reveals (the "Show more" toggle),
  // so the initially-visible collapsed rows don't all fade in on every navigation to Home.
  const hasMounted = useRef(false);
  useEffect(() => {
    hasMounted.current = true;
  }, []);

  const [expanded, setExpanded] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [addDraft, setAddDraft] = useState('');
  const [addTime, setAddTime] = useState('');
  const [addRecurring, setAddRecurring] = useState<Recurring>('none');
  const [addRecurringDays, setAddRecurringDays] = useState<number[]>([]);
  const [addEnergyValue, setAddEnergyValue] = useState(0);

  const gridScrollRef = useRef<ScrollView>(null);

  function cycleRecurring() {
    tap();
    setAddRecurring((current) => {
      if (current === 'none') return 'daily';
      if (current === 'daily') {
        setAddRecurringDays((days) => (days.length ? days : [dayOfWeekMon0(new Date())]));
        return 'weekly';
      }
      if (current === 'weekly') return 'monthly';
      return 'none';
    });
  }

  function cycleEnergy() {
    tap();
    setAddEnergyValue((current) => (current === 0 ? 1 : current > 0 ? -1 : 0));
  }

  function recurringLabel(mode: Recurring): string {
    if (mode === 'daily') return t.taskRecurDay;
    if (mode === 'weekly') return t.taskRecurWeek;
    if (mode === 'monthly') return t.taskRecurMonth;
    return t.off;
  }

  function commitAdd() {
    const title = addDraft.trim();
    if (!title || !onAddTask) return;
    onAddTask(title, {
      time: addTime || undefined,
      recurring: addRecurring,
      recurringDays: addRecurring === 'weekly' ? addRecurringDays : [],
      energyEnabled: addEnergyValue !== 0,
      energyValue: addEnergyValue,
    });
    setAddDraft('');
    setAddTime('');
    setAddRecurring('none');
    setAddRecurringDays([]);
    setAddEnergyValue(0);
  }

  // Decision 020 — surfaced followers: for each DONE task, its pending follower is
  // highlighted and (sub-question b) pulled into this view even if it lives on another
  // date. The pointer lives on the follower row (follower.followsTaskId === done.id).
  const { dayTasks, surfacedIds } = useMemo(() => {
    const source = allTasks ?? tasks;
    const surfaced = new Set<string>();
    const extra: Task[] = [];
    const present = new Set(tasks.map((task) => task.id));
    for (const done of source) {
      if (!done.done) continue;
      const follower = source.find((f) => f.followsTaskId === done.id && !f.done);
      if (!follower) continue;
      surfaced.add(follower.id);
      if (!present.has(follower.id)) {
        extra.push(follower);
        present.add(follower.id);
      }
    }
    return { dayTasks: [...tasks, ...extra], surfacedIds: surfaced };
  }, [tasks, allTasks]);

  const anytimePending = useMemo(() => dayTasks.filter((task) => !task.time && !task.done), [dayTasks]);
  const timedPending = useMemo(
    () => dayTasks.filter((task) => !!task.time && !task.done).map(timedEntryOf).sort((a, b) => a.start - b.start),
    [dayTasks]
  );
  // Vertical/default rail only — side-by-side columns for genuinely overlapping tasks,
  // plus a height clamp so the MIN_TASK_HEIGHT floor can't visually run into whatever
  // starts next (see lib/dayGrid.ts's file header for why both are needed).
  const timedLayout = useMemo(
    () => layoutGridEntries(timedPending, { minHeightPx: MIN_TASK_HEIGHT, gapPx: GRID_CARD_GAP }),
    [timedPending]
  );
  const doneTasks = useMemo(() => dayTasks.filter((task) => task.done), [dayTasks]);

  const pendingCount = anytimePending.length + timedPending.length;

  // Auto-scrolls the grid's collapsed viewport to the current hour — on mount, whenever the
  // card collapses back down, and whenever the grid's own task count changes (e.g. a task is
  // added/removed, which is also when the ScrollView node underneath `gridScrollRef` first
  // mounts, since the grid isn't rendered at all until `timedPending.length > 0`). Deliberately
  // NOT re-run on every `now` tick (every 60s) alone — that would yank a manual scroll away
  // from wherever the user was looking.
  useEffect(() => {
    if (expanded) return;
    const y = Math.max(0, minutesToY(now) - COLLAPSED_GRID_HEIGHT / 3);
    gridScrollRef.current?.scrollTo({ y, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, timedPending.length]);

  // Current = the timed task happening right now; otherwise the next one leads.
  const currentTimedIndex = timedPending.findIndex((e) => now >= e.start && now < e.end);
  const nextTimedIndex = currentTimedIndex >= 0 ? currentTimedIndex : timedPending.findIndex((e) => e.start > now);

  // Horizontal-only (Decision 009b tail): visible-span for the proportional tail —
  // axis-start (first timed start) → last unfinished end.
  const spanMinutes = timedPending.length > 0
    ? Math.max(1, timedPending[timedPending.length - 1].end - timedPending[0].start)
    : 0;
  const tailPx = timedPending.length > 0 ? clamp(railTailMinutes(spanMinutes) * PX_PER_MIN, 10, MAX_GAP) : 0;

  // Horizontal-only collapse window: the current/in-progress task always leads, then next + 2
  // after (Decision 009a). The vertical grid always renders every timed task (its viewport
  // height/scroll, not task filtering, is what "collapsed" means there — see showToggle).
  const timedStart = nextTimedIndex >= 0 ? nextTimedIndex : 0;
  const collapsedVisibleH = useMemo(() => {
    const ids = [
      ...anytimePending.map((task) => task.id),
      ...timedPending.slice(timedStart).map((e) => e.task.id),
    ].slice(0, COLLAPSED_COUNT);
    return new Set(ids);
  }, [anytimePending, timedPending, timedStart]);

  function isVisibleH(id: string): boolean {
    return expanded || collapsedVisibleH.has(id);
  }

  // Vertical: the anytime list caps independently of the grid (which always shows every
  // timed task) — same "current + next + a few more" spirit, just not mixed with timed IDs.
  const visibleAnytime = horizontal
    ? anytimePending.filter((task) => isVisibleH(task.id))
    : expanded
      ? anytimePending
      : anytimePending.slice(0, COLLAPSED_COUNT);

  const showToggle = horizontal
    ? pendingCount > collapsedVisibleH.size
    : timedPending.length > 0 || anytimePending.length > COLLAPSED_COUNT;

  // The single task considered "up" (current or next) — the one whose hint is worth
  // showing right now (Decision 019).
  const upNextId = currentTimedIndex >= 0
    ? timedPending[currentTimedIndex].task.id
    : nextTimedIndex >= 0
      ? timedPending[nextTimedIndex].task.id
      : anytimePending[0]?.id;

  function handleToggle(task: Task) {
    if (!onToggleTask) return;
    if (!task.done) success();
    onToggleTask(task);
  }

  function handlePress(task: Task) {
    if (readOnly || !onPressTask) return;
    onPressTask(task);
  }

  function doneToggle(task: Task, isHappeningNow?: boolean) {
    return (
      <PressableScale
        disabled={!onToggleTask}
        hitSlop={16}
        onPress={() => handleToggle(task)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        scaleTo={0.97}
      >
        <View
          style={[
            styles.dot,
            // Idle checkbox ring uses textMuted so the unchecked dot reads clearly (the
            // border token is too faint for a tap target); happening-now/done fill = accent.
            { borderColor: isHappeningNow ? theme.accent : theme.textMuted },
            (isHappeningNow || task.done) && { backgroundColor: theme.accent, borderColor: theme.accent },
          ]}
        >
          {task.done && <Ionicons name="checkmark" size={10} color={theme.accentInk} />}
        </View>
      </PressableScale>
    );
  }

  // Horizontal-only — the vertical grid draws its own time boxes as part of each grid card.
  function timeMarker(task: Task, timed: TimedEntry | undefined, dimmed: boolean, isHappeningNow: boolean | undefined, surfaced: boolean) {
    if (!timed) return <View style={[styles.anytimeDot, { borderColor: theme.border }]} />;
    return (
      <View
        style={[
          styles.timeBox,
          { borderColor: isHappeningNow ? theme.accent : theme.border },
          isHappeningNow && { backgroundColor: rgba(theme.accent, 0.14) },
          surfaced && !task.done && { borderColor: theme.accent, borderWidth: 2.5 },
          task.done && { opacity: 0.55 },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.timeBoxText, { color: isHappeningNow ? theme.accent : dimmed ? theme.textMuted : theme.text }]}
        >
          {task.time}
        </Text>
      </View>
    );
  }

  /** The shared title-row + hint content, used by both flat rows (anytime/done) and grid
   *  cards — only the outer wrapper (flow row vs. absolute-positioned card) differs. */
  function taskCardContent(task: Task, opts: { timed?: TimedEntry; dimmed: boolean; showHint: boolean; surfaced: boolean; showAnytimeBadge: boolean }) {
    const { timed, dimmed, showHint, surfaced, showAnytimeBadge } = opts;
    return (
      <>
        <View style={styles.titleRow}>
          {timed && (
            <Text style={[styles.flatTimeText, { color: theme.textMuted }]}>{task.time}</Text>
          )}
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: dimmed ? theme.textMuted : theme.text },
              task.done && { textDecorationLine: 'line-through' },
            ]}
          >
            {task.title}
          </Text>
          {timed && task.taskType === 'time-box' && (
            <Text style={[styles.durationText, { color: theme.textMuted }]}>–{minutesToLabel(timed.end)}</Text>
          )}
          {showAnytimeBadge ? (
            <View style={[styles.followerBadge, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1 }]}>
              <Text style={[styles.followerBadgeText, { color: theme.textMuted }]}>{t.dayViewAnytimeBadge}</Text>
            </View>
          ) : null}
          {surfaced && !task.done ? (
            <View style={[styles.followerBadge, { backgroundColor: domainColor.soft }]}>
              <Text style={[styles.followerBadgeText, { color: domainColor.accent }]}>{t.dayViewFollowerBadge}</Text>
            </View>
          ) : null}
        </View>
        {showHint ? (
          <View style={styles.hintRow}>
            <Ionicons name="bulb-outline" size={12} color={theme.textMuted} />
            <Text style={[styles.hintText, { color: theme.textMuted }]} numberOfLines={2}>
              {task.hint}
            </Text>
          </View>
        ) : null}
      </>
    );
  }

  /** Flat (non-grid) row — the anytime list and the "Done today" zone, both orientations.
   *  No rail/gutter marker any more (2026-07-26 rebuild dropped it with the old flow rail) —
   *  an inline time reading (if timed) plus the "Anytime" pill are the only position cues. */
  function renderFlatRow(task: Task, opts: RailItemOpts) {
    const { timed, isPast, animateIn } = opts;
    const dimmed = !!(task.done || isPast);
    const surfaced = surfacedIds.has(task.id);
    const isUp = task.id === upNextId;
    const showHint = isUp && !!task.hint && !task.done;
    const anim = animateIn && !reducedMotion && hasMounted.current;

    return (
      <Animated.View
        key={task.id}
        style={styles.flatRow}
        entering={anim ? FadeInDown.duration(Duration.listIn).easing(Ease.enter) : undefined}
        exiting={anim ? FadeOutDown.duration(Duration.cardOut).easing(Ease.exit) : undefined}
        layout={anim ? LinearTransition.duration(Duration.listMove).easing(Ease.move) : undefined}
      >
        <PressableScale style={styles.flatContent} onPress={() => handlePress(task)} disabled={readOnly || !onPressTask} scaleTo={0.97}>
          <View
            style={[
              styles.rowCard,
              { backgroundColor: rgba(theme.accent, 0.05) },
              { borderColor: rgba(domainColor.accent, 0.2) },
            ]}
          >
            {taskCardContent(task, { timed, dimmed, showHint, surfaced, showAnytimeBadge: !timed && !task.done })}
          </View>
        </PressableScale>
        <View style={styles.doneCol}>{doneToggle(task, false)}</View>
      </Animated.View>
    );
  }

  /** Grid card — a timed pending task, absolutely positioned on the fixed-hour grid by its
   *  real start/end time (lib/dayGrid.ts). Vertical/default orientation only. `layout` carries
   *  the overlap-aware column + height clamp from `layoutGridEntries` so genuinely-overlapping
   *  tasks render side-by-side (Google Calendar style) instead of stacking on top of each other. */
  function renderGridEntry(entry: TimedEntry, layout: GridEntryLayout) {
    const { task, start, end } = entry;
    const isHappeningNow = now >= start && now < end;
    const isPast = !isHappeningNow && now >= end;
    const surfaced = surfacedIds.has(task.id);
    const isUp = task.id === upNextId;
    const showHint = isUp && !!task.hint;
    const { top, height, leftPct, widthPct } = layout;
    const sideBySide = widthPct < 100;

    return (
      <View key={task.id} style={[styles.gridCardWrap, { top, height, left: GUTTER_WIDTH + Spacing.xs, right: Spacing.xs }]}>
        <View style={[styles.gridCardColumn, { left: `${leftPct}%`, width: `${widthPct}%` }, sideBySide && styles.gridCardColumnGapped]}>
          <PressableScale style={styles.gridCardPressable} onPress={() => handlePress(task)} disabled={readOnly || !onPressTask} scaleTo={0.97}>
            <View
              style={[
                styles.rowCard,
                styles.gridCardInner,
                // Ordinary cards: a soft accent wash instead of drab grey (debug-note 2026-07-21)
                // — still clearly set apart from plain-surface cards, but warmer. The
                // happening-now card keeps the stronger tint + glow so hierarchy is preserved.
                { backgroundColor: isHappeningNow ? rgba(theme.accent, 0.1) : rgba(theme.accent, 0.05) },
                { borderColor: rgba(domainColor.accent, isHappeningNow ? 0.5 : 0.2) },
                // "Selects" the happening-now task (2026-07-26, user report) — see file header.
                isHappeningNow && { borderWidth: 2, transform: [{ scale: 1.03 }] },
              ]}
            >
              <GlowPulse active={isHappeningNow} color={domainColor.accent} mode="breathe" radius={Radius.sm} />
              {taskCardContent(task, { dimmed: isPast, showHint, surfaced, showAnytimeBadge: false })}
            </View>
          </PressableScale>
          <View style={styles.gridDoneToggle}>{doneToggle(task, isHappeningNow)}</View>
        </View>
      </View>
    );
  }

  function renderColumn(task: Task, opts: RailItemOpts) {
    const { timed, isHappeningNow, isPast } = opts;
    const dimmed = !!(task.done || isPast);
    const surfaced = surfacedIds.has(task.id);

    return (
      <PressableScale
        key={task.id}
        style={styles.hColumn}
        onPress={() => handlePress(task)}
        disabled={readOnly || !onPressTask}
        scaleTo={0.97}
      >
        <View style={styles.hRailRow}>{timeMarker(task, timed, dimmed, isHappeningNow, surfaced)}</View>
        <View style={styles.hContent}>
          <Text
            numberOfLines={2}
            style={[
              styles.hTitle,
              { color: dimmed ? theme.textMuted : theme.text },
              task.done && { textDecorationLine: 'line-through' },
            ]}
          >
            {task.title}
          </Text>
        </View>
        <View style={styles.hDoneRow}>{doneToggle(task, isHappeningNow)}</View>
      </PressableScale>
    );
  }

  function renderHSpacer(key: string, sizePx: number, content?: React.ReactNode) {
    return (
      <View key={key} style={[styles.hConnectorWrap, { minWidth: sizePx }]}>
        <View style={[styles.hConnector, { width: sizePx, backgroundColor: theme.border }]} />
        {content ? <View style={styles.hSpacerContent}>{content}</View> : null}
      </View>
    );
  }

  const hNowMarker = (
    <View style={styles.hNowMarker}>
      <View style={[styles.hNowLine, { backgroundColor: theme.accent }]} />
      <Text numberOfLines={1} style={[styles.hNowLabel, { color: theme.accent }]}>
        {t.timelineNow}
      </Text>
    </View>
  );

  // Horizontal-only gap state (Decision 009a): no task happening now, but one is coming.
  // The vertical grid doesn't need this — empty grid space between the now-line and the
  // next card already communicates it.
  const hasGap = currentTimedIndex < 0 && nextTimedIndex >= 0 && timedPending[nextTimedIndex].start > now;
  const hGapMarker = hasGap ? (
    <View style={styles.hGapMarker}>
      <View style={[styles.hGapDot, { borderColor: theme.border }]} />
      <Text style={[styles.hGapText, { color: theme.textMuted }]} numberOfLines={2}>
        {t.dayViewGapUntil(minutesToLabel(timedPending[nextTimedIndex].start))}
      </Text>
    </View>
  ) : null;

  // Horizontal-only item building (unchanged proportional layout — see file header).
  const visibleAnytimeH = anytimePending.filter((task) => isVisibleH(task.id));
  const visibleTimedH = timedPending.filter((e) => isVisibleH(e.task.id));

  const hAnytimeItems: React.ReactNode[] = [];
  visibleAnytimeH.forEach((task, idx) => {
    const hasNext = idx < visibleAnytimeH.length - 1 || timedPending.length > 0;
    hAnytimeItems.push(renderColumn(task, { animateIn: true }));
    if (hasNext) hAnytimeItems.push(renderHSpacer(`gap-any-${task.id}`, MIN_GAP));
  });

  const hTimedItems: React.ReactNode[] = [];
  visibleTimedH.forEach((entry, idx) => {
    const isHappeningNow = now >= entry.start && now < entry.end;
    const isPast = !isHappeningNow && now >= entry.end;
    const isLast = idx === visibleTimedH.length - 1;
    const nextEntry = visibleTimedH[idx + 1];
    const gapMin = nextEntry ? nextEntry.start - entry.end : 0;
    const connectorPx = nextEntry ? clamp(gapMin * PX_PER_MIN, MIN_GAP, MAX_GAP) : tailPx;
    hTimedItems.push(renderColumn(entry.task, { timed: entry, isHappeningNow, isPast, animateIn: true }));
    if (nextEntry || (isLast && tailPx > 0)) {
      const nowInThisGap = !!nextEntry && now >= entry.end && now < nextEntry.start;
      const marker = nowInThisGap ? hNowMarker : undefined;
      hTimedItems.push(renderHSpacer(`gap-${entry.task.id}`, connectorPx, marker));
    }
  });

  const showEmpty = pendingCount === 0 && doneTasks.length === 0;
  const allDone = pendingCount === 0 && doneTasks.length > 0;

  // Shared with the anytime list/doneZone/footer so the whole card reflows in sync — otherwise
  // these siblings snap instantly while rows are still fading, which used to make the done-zone
  // appear to get "covered" by an exiting row.
  const containerLayout = reducedMotion ? undefined : LinearTransition.duration(Duration.listMove).easing(Ease.move);

  return (
    <Surface
      surfaceContext="ambient"
      borderColor={domainColor.accent}
      elevated={expanded}
      style={[styles.card, !expanded && styles.cardCollapsed]}
    >
      {/* Header wash + badge mount OUTSIDE cardContent, directly in Surface (only in
          read-only/Home-preview mode) — see the "Badge/wash moved outside cardContent's
          padding" edit note below for why. */}
      {readOnly && (
        <>
          <CardAccentWash domain="plan" />
          <CardAccentBadge domain="plan" size={32} style={styles.badgeFixed} />
        </>
      )}
      <View style={styles.cardContent}>

        {/* Section header — only in read-only (Home preview) mode */}
        {readOnly && (
          <PressableScale onPress={() => router.push('/plans')} style={styles.headerRowPressable} scaleTo={0.97}>
            <View style={styles.headerTopRow}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>{t.home.todaysPlans}</Text>
              {pendingCount > 0 && (
                <View style={[styles.badge, { backgroundColor: domainColor.soft }]}>
                  <Text style={[styles.badgeText, { color: domainColor.accent }]}>{pendingCount}</Text>
                </View>
              )}
            </View>
            {dayTasks.length > 0 && (
              <ProgressBar
                value={doneTasks.length / dayTasks.length}
                color={domainColor.accent}
                height={4}
                style={styles.progressBar}
              />
            )}
          </PressableScale>
        )}

        {showEmpty ? (
          <View style={styles.emptyWrap}>
            {/* Fixed-hour calendar grid, empty (2026-07-25, user report: an empty day showed
                pure blank space; 2026-07-26, rebuilt from a sparse ruler into the same real
                grid a populated day uses). */}
            <DayHourScale now={now} />
            {/* Ghost "add" row (debug-note 2026-07-21) — an empty day should still offer a
                place to add something. Deep-links to the Plans tab; only shown as a FALLBACK
                when no inline add is wired (`onAddTask` absent). When onAddTask IS passed
                (Home preview, 2026-07-24) the trailing AddRow handles inline creation, so this
                redundant deep-link ghost is suppressed. */}
            {readOnly && !onAddTask && (
              <PressableScale
                onPress={() => router.push('/plans')}
                style={[styles.emptyAddRow, { borderColor: theme.border }]}
                scaleTo={0.97}
                accessibilityRole="button"
                accessibilityLabel={t.timelineEmptyAdd}
              >
                <Ionicons name="add" size={16} color={domainColor.accent} />
                <Text style={[styles.emptyAddText, { color: theme.textMuted }]}>{t.timelineEmptyAdd}</Text>
              </PressableScale>
            )}
          </View>
        ) : allDone ? (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.dayViewAllDone}</Text>
        ) : horizontal ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRail}>
            {hGapMarker}
            {hAnytimeItems}
            {hTimedItems}
          </ScrollView>
        ) : (
          <>
            {visibleAnytime.length > 0 && (
              <Animated.View style={styles.anytimeList} layout={containerLayout}>
                {visibleAnytime.map((task) => renderFlatRow(task, { animateIn: true }))}
              </Animated.View>
            )}
            {timedPending.length > 0 && (
              <View style={[styles.gridViewport, { height: expanded ? GRID_TOTAL_HEIGHT : COLLAPSED_GRID_HEIGHT }]}>
                <ScrollView ref={gridScrollRef} scrollEnabled={!expanded} showsVerticalScrollIndicator={false}>
                  <View style={styles.gridInner}>
                    <DayGridLines now={now} />
                    {timedPending.map((entry, i) => renderGridEntry(entry, timedLayout[i]))}
                  </View>
                </ScrollView>
              </View>
            )}
          </>
        )}

        {/* Inline quick-add (debug-note 2026-07-24) — gated on `onAddTask` (not on `readOnly`,
            same pattern as the done-toggle), so the read-only Home preview can create a task
            directly instead of forcing a trip to /plans. Renders whether the day is empty or
            full. Mirrors the Whenever AddRow on app/(tabs)/plans.tsx: an undated, non-recurring
            task dated today (the caller's onAddTask owns the store shape). */}
        {onAddTask ? (
          <AddRow
            placeholder={t.newTask}
            value={addDraft}
            onChangeText={setAddDraft}
            onSubmit={commitAdd}
            accent={domainColor.accent}
            accessibilityLabel={t.newTask}
            extras={
              <>
                <TimeBoxInput value={addTime} onChange={setAddTime} />
                <PressableScale
                  style={[
                    styles.quickChip,
                    { borderColor: addRecurring !== 'none' ? domainColor.accent : theme.border },
                    addRecurring !== 'none' && { backgroundColor: domainColor.soft },
                  ]}
                  onPress={cycleRecurring}
                  hitSlop={8}
                  scaleTo={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.taskRecurringToggle}: ${recurringLabel(addRecurring)}`}
                >
                  <Ionicons name="repeat" size={14} color={addRecurring !== 'none' ? domainColor.accent : theme.textMuted} />
                  {addRecurring !== 'none' && (
                    <Text style={[styles.quickChipText, { color: domainColor.accent }]}>
                      {recurringLabel(addRecurring).charAt(0)}
                    </Text>
                  )}
                </PressableScale>
                {(
                  <PressableScale
                    style={[
                      styles.quickChip,
                      { borderColor: addEnergyValue !== 0 ? domainColor.accent : theme.border },
                      addEnergyValue !== 0 && { backgroundColor: domainColor.soft },
                    ]}
                    onPress={cycleEnergy}
                    hitSlop={8}
                    scaleTo={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.energyConsumeLabel}: ${addEnergyValue === 0 ? t.off : addEnergyValue > 0 ? '+1' : '-1'}`}
                  >
                    <Ionicons
                      name={addEnergyValue === 0 ? 'flash-outline' : addEnergyValue > 0 ? 'flash' : 'flash-off'}
                      size={14}
                      color={addEnergyValue > 0 ? theme.good : addEnergyValue < 0 ? theme.warn : theme.textMuted}
                    />
                  </PressableScale>
                )}
              </>
            }
          />
        ) : null}

        {/* Done zone — dimmed, collapsed by default (Decision 009a). Always the flat-row
            layout, even in horizontal mode — this is a secondary dropdown list, not the
            primary glance surface. */}
        {doneTasks.length > 0 ? (
          <Animated.View style={[styles.doneZone, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} layout={containerLayout}>
            <PressableScale style={styles.doneHeader} onPress={() => { tap(); setDoneOpen((v) => !v); }} scaleTo={0.97} releaseSpring={Spring.calm}>
              <Text style={[styles.doneHeaderText, { color: theme.textMuted }]}>{t.dayViewDoneZone(doneTasks.length)}</Text>
              <AnimatedChevron open={doneOpen} size={14} color={theme.textMuted} />
            </PressableScale>
            <Collapsible open={doneOpen}>
              <View style={styles.doneRows}>
                {doneTasks.map((task) =>
                  renderFlatRow(task, {
                    timed: task.time ? timedEntryOf(task) : undefined,
                    isPast: true,
                  })
                )}
              </View>
            </Collapsible>
          </Animated.View>
        ) : null}

        {showToggle ? (
          <PressableScale
            style={styles.footerBtn}
            layout={containerLayout}
            onPress={() => { tap(); setExpanded((v) => !v); }}
            scaleTo={0.97}
            releaseSpring={Spring.calm}
          >
            <Text style={[styles.footerBtnText, { color: theme.accent }]}>
              {expanded ? t.plansCollapse : t.plansExpand}
            </Text>
          </PressableScale>
        ) : null}

      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  // Collapsed-only floor so Notes/Plans/Shopping read as the same size regardless of how
  // few tasks today has — see constants/theme.ts. Content can still grow taller than this
  // floor (e.g. the expanded full-day grid) — it's a min, not a cap.
  cardCollapsed: { minHeight: HOME_PREVIEW_CARD_MIN_HEIGHT },
  // paddingTop Spacing.md (was Spacing.sm) so the header sits VERTICALLY CENTERED in the 64px
  // CardAccentWash band instead of hugging the top edge (2026-07-24: the old "hug the top / sit
  // high in the band" tuning read as "title too high, not centered between the top border and the
  // wash divider" — user report). The 32px badge now centers at ~y=32 in the [0,64] band.
  // Bumped +4 (2026-07-26, user report: header sat too high) — nudges the whole badge+title
  // header down a touch; see badgeFixed's matching top offset below.
  cardContent: { flex: 1, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, paddingTop: Spacing.md + 4, position: 'relative' },
  // Quick-add extras (2026-07-24) — compact repeat/energy toggle chips beside TimeBoxInput.
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 30,
    height: 30,
    paddingHorizontal: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  quickChipText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  emptyText: { fontSize: FontSize.sm, fontStyle: 'italic', textAlign: 'center', paddingVertical: Spacing.sm },
  emptyWrap: { gap: Spacing.sm },
  emptyAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyAddText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },

  // Anytime list — a plain flat list above the grid (untimed tasks have no clock position).
  anytimeList: { gap: Spacing.xs, marginBottom: Spacing.sm },
  // Flat row: [content][doneCol] — used by the anytime list and the "Done today" zone.
  flatRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: Spacing.xs },
  flatContent: { flex: 1 },
  flatTimeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  timeBox: {
    minWidth: 44,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBoxText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  anytimeDot: { width: 10, height: 10, borderRadius: Radius.full, borderWidth: 2, borderStyle: 'dashed' },
  dot: { width: 16, height: 16, borderRadius: Radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  // Decision (visual-audit 2026-07-11): a subtle card behind each row's title/hint so
  // tasks read as distinct items rather than text floating on the background. borderWidth
  // added 2026-07-26 (calendar-style pass) — see the inline borderColor overrides.
  rowCard: { borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  doneCol: { width: DONE_COL_WIDTH, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.semibold, flexShrink: 1 },
  durationText: { fontSize: FontSize.xs },
  followerBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 1 },
  followerBadgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, marginTop: 2 },
  hintText: { fontSize: FontSize.xs, flexShrink: 1, fontStyle: 'italic' },

  // Fixed-hour grid viewport (2026-07-26 rebuild — see file header). Height is set inline
  // (collapsed vs. expanded); rounded + clipped so the grid's hour lines don't bleed past
  // the card's own corner radius.
  gridViewport: { borderRadius: Radius.sm, overflow: 'hidden' },
  // No explicit height — DayGridLines (the only non-absolute child) sets its own height to
  // the full 24h grid, and that's exactly what this wrapper's auto height should be too;
  // absolutely-positioned grid cards (siblings) don't contribute to that auto height.
  gridInner: { position: 'relative', width: '100%' },
  gridCardWrap: { position: 'absolute' },
  // Column sub-wrapper (overlap layout, lib/dayGrid.ts) — left/width are set inline as
  // percentages of gridCardWrap's own width so RN resolves them relative to the slot,
  // not the whole card. A small horizontal inset only when genuinely side-by-side with
  // another task, so the common single-column case is pixel-identical to before.
  gridCardColumn: { position: 'absolute', top: 0, bottom: 0 },
  gridCardColumnGapped: { paddingHorizontal: 1.5 },
  gridCardPressable: { flex: 1 },
  // Tighter vertical padding than the shared `rowCard` (short time-slots), and room on the
  // right for the corner done-toggle overlay.
  gridCardInner: { flex: 1, paddingVertical: 4, paddingRight: 28 },
  gridDoneToggle: { position: 'absolute', top: 4, right: 4 },

  // Horizontal rail: a row of [hColumn][hConnectorWrap][hColumn]... — time box + line on
  // top, title in the middle, checkmark-circle toggle in a fixed-height row underneath,
  // so it lines up across every column regardless of title length.
  hRail: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.xs, paddingRight: Spacing.md },
  hColumn: { width: H_COLUMN_WIDTH, alignItems: 'center' },
  hRailRow: { height: H_RAIL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  hContent: { height: H_CONTENT_HEIGHT, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 2 },
  hTitle: { fontSize: FontSize.sm, fontFamily: Fonts.medium, textAlign: 'center' },
  hDoneRow: { paddingTop: Spacing.xs },
  hConnectorWrap: { height: H_RAIL_HEIGHT, justifyContent: 'center' },
  hConnector: { height: 2 },
  // Now-marker overlay for a horizontal connector — absolute so it doesn't force the
  // connector wider than its proportional width.
  hSpacerContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  hNowMarker: { width: 44, height: H_RAIL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  hNowLine: { width: 1.5, height: '100%', opacity: 0.6 },
  hNowLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, position: 'absolute', top: -2 },
  hGapMarker: { width: 72, alignItems: 'center', paddingTop: 2 },
  hGapDot: { width: 8, height: 8, borderRadius: Radius.full, borderWidth: 2, borderStyle: 'dashed', marginBottom: 4 },
  hGapText: { fontSize: FontSize.xs, fontStyle: 'italic', textAlign: 'center' },

  // Frames the done header + its collapsed rows as one card (2026-07-16) — previously a
  // transparent top border (no real frame). This card already sits inside the outer Surface,
  // so it uses `theme.surfaceMuted` (a step subtler than the card's own surface) rather than
  // a second elevated Surface, to avoid stacking two heavy card looks.
  doneZone: { marginTop: Spacing.xs, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm },
  doneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  doneHeaderText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  // Only rendered while the done zone is open (inside Collapsible's children), so this
  // padding never shows up as phantom height while collapsed.
  doneRows: { paddingBottom: Spacing.sm },
  footerBtn: { alignItems: 'center', paddingTop: Spacing.sm },
  footerBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  // marginBottom Spacing.md (was .sm) so the content starts close to the 64px wash divider
  // (paddingTop 20 + badge 32 + 16 = 68 as of the 2026-07-26 +4 header nudge — see cardContent's
  // paddingTop comment above; 4px past the divider reads fine, not worth chasing exactly).
  headerRowPressable: { marginBottom: Spacing.md },
  // Badge is pinned absolute (badgeFixed below) — headerTopRow's paddingLeft is what actually
  // clears it, not flex order. Tightened 56 → 52 (2026-07-26, user report: "more closely
  // linked with the badge") — badge offset 16 + badge size 32 + a 4px gap (was 8px).
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: 52 },
  // Takes the badge out of flex flow so its position is fixed regardless of sibling content
  // height (e.g. a scaled-up title at large accessibility text sizes) — see edit note above.
  // Mounts as a sibling of cardContent now (not a child of it), directly in the unpadded
  // Surface — see the "Badge/wash moved outside cardContent's padding" file-header note for
  // why. left Spacing.md is an unambiguous single inset on both platforms; top bumped +4
  // alongside cardContent's paddingTop (2026-07-26, "move it a bit down") so it stays level
  // with the title.
  badgeFixed: { position: 'absolute', top: Spacing.md + 4, left: Spacing.md, zIndex: 2 },
  progressBar: { marginTop: Spacing.xs },
  // includeFontPadding:false + textAlignVertical:'center' so the title optically centers against
  // the round CardAccentBadge on Android (same font-padding fix as TabSlider/ScreenHeader).
  headerTitle: { fontSize: 20, lineHeight: 25, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.8, includeFontPadding: false, textAlignVertical: 'center' },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
});
