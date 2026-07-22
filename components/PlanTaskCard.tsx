/**
 * PlanTaskCard.tsx — the day-view: a proportional time rail of one day's tasks.
 *
 * This is the single shared "time now + rest of day" surface (Decisions 009 / 009a /
 * 009b). The full /plans screen renders it interactively; the Home preview renders the
 * SAME component with `readOnly` (Decision 009a — "the preview IS the day-view,
 * rendered read-only"). There is intentionally no Home-specific variant.
 *
 * Layout is the proportional rail (day-view "Option C"): the connector between two
 * consecutive timed tasks is proportional to the real time between them (clamped to a
 * legible min/max), so a glance conveys how the day is paced. Collapsed shows the
 * current/in-progress task + next + 2 after (4 rows); done tasks live in a dimmed,
 * collapsed "Done today" zone; a proportional tail (10% of the visible span, 009b) sits
 * below/after the last unfinished task so it isn't jammed against the rail's end.
 *
 * Two rail orientations (toggle: settings.accessibility "Horizontal plans timeline"):
 * `horizontal=false` (default) is a top-to-bottom rail — a left-hand line of rounded
 * time-start boxes, task content in the middle, and a column of checkmark-circle
 * toggles on the right, all vertically aligned. `horizontal=true` rotates the same
 * data into a left-to-right rail (horizontally scrollable) — time boxes connected by a
 * horizontal line on top, task titles below them, and checkmark-circles in a row
 * underneath, all horizontally aligned. Both share every computation (collapse window,
 * proportional gaps, now/gap markers, follower surfacing) — only `renderRow` vs
 * `renderColumn` (and the gap/now marker JSX) differ.
 *
 * **Rail geometry (Decision 042a)**: each task row/column *owns* its own rail segment —
 * the marker (time box / anytime dot) sits between two `railLine` segments (top+bottom
 * in the vertical rail) that are `flex:1`, so they stretch to fill exactly this row's
 * real content height and the marker lands dead-center by flexbox construction, not
 * measurement. The proportional time-gap between two rows is a separate `renderSpacer`
 * element inserted between them (own fixed/min height = the clamped `PX_PER_MIN` gap) —
 * it never has to be squeezed inside a row of variable height. The now-marker and
 * "Nothing until HH:MM" gap marker render as that spacer's content. This replaced an
 * earlier version where the connector was drawn *inside* the preceding row, sized from
 * the time gap alone with no reconciliation against that row's actual (variable) height
 * — the mismatch pushed dots/lines out of alignment on tall rows (long titles, hints,
 * follower badges).
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, components/ProgressBar,
 *             components/HomePreviewEmpty, components/Collapsible + components/AnimatedChevron
 *             (done-zone reveal + chevron), react-native-reanimated (FadeInDown/FadeOutDown/
 *             LinearTransition for rail rows revealed by the Show more/less toggle — rail,
 *             done-zone, and footer all share one `containerLayout` LinearTransition so the
 *             whole card reflows together instead of siblings snapping ahead of the rows),
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
 *             passed in. Live "now" marker re-renders on a 60s interval (useNowMinutes).
 *
 * Edit notes:
 *   - **Collapsed sizing + slimmer rows (2026-07-13, padding restored 2026-07-15)**:
 *     `cardCollapsed` (minHeight: `HOME_PREVIEW_CARD_MIN_HEIGHT`, constants/theme.ts) is a
 *     compact shared *resting* floor applied only while `!expanded`, so this card reads the
 *     same size as HomeNotesCard/HomeShoppingCard on a light day — it's a floor, not a cap, so
 *     an expanded task's steps or a widely time-spaced day still grows taller. Rail tuning
 *     (`PX_PER_MIN`/`MIN_GAP`/`MAX_GAP`) stays trimmed for a slimmer rail; this is Home-only
 *     now (see below), so retuning these constants has no other caller to break. `rowCard`
 *     vertical padding and `title`'s font size were bumped back up on 2026-07-15 (user
 *     feedback: text/spacing read as too tight) — the slimness now comes from the rail-gap
 *     tuning alone, not from cramped row content.
 *   - **Empty state**: an empty day (`showEmpty`) renders the shared `HomePreviewEmpty`
 *     (left-aligned `t.timelineEmpty`) plus, in the read-only Home preview, a dashed "add a
 *     plan" ghost row that deep-links to /plans. The distinct "all done" state keeps its own
 *     `t.dayViewAllDone` line — it's a reward, not an empty card.
 *   - **Decision 014 (revised 2026-07-14)**: the card face is a `<Surface>` with a
 *     domain-colored border (`borderColor={getDomainColor(theme,'plan').accent}`) on a plain
 *     `theme.surface` fill, so the section reads as belonging to Plans without washing the
 *     whole card in a tint (2026-07-13's whole-card blend read as muddy — see domainColor.ts).
 *     Still don't set Surface's fill/sheen directly — pass `borderColor`/`tint` and let the
 *     material compute the finish (Surface owns border/sheen/blur since Decision 008).
 *   - **Decision 009b tail**: `railTailMinutes()` = 10% of the visible span (axis-start →
 *     last unfinished task's end), floored at 15 min so a near-empty day still gets a
 *     visible tail. Start from pure 10%; the floor is the 009b-sanctioned execution guard
 *     since on-device measurement isn't available in this environment.
 *   - **Decision 020 follower surfacing (surfacing-only, NOT notifying)**: when a
 *     predecessor is done, its pending follower is highlighted AND — per Session 1's
 *     resolution of open sub-question (b), "pull the follower into today's view" (which
 *     supersedes Decision 020's own "highlight in place" leaning) — a cross-date follower
 *     is pulled into this day-view. Pass `allTasks` (the full store list) so cross-date
 *     followers can be found; without it, only same-list followers surface.
 *   - **Decision 019 hint**: a task's `hint` renders under its title (display-only) while
 *     the task is "up" (current or next), so the reminder shows exactly when it's useful.
 *     Vertical rail only — the horizontal rail's columns are too narrow for it.
 *   - `readOnly` (Home preview) disables row tap-through only — structure, rail,
 *     collapse/expand, and done zone are identical (Decision 009a). The done-toggle is
 *     independently gated on whether `onToggleTask` is passed (not on `readOnly`), so the
 *     Home preview's checkbox stays interactive while row tap-through into the editor
 *     stays disabled. Pass `onSeeMore` to show a "See everything →" link routing to the
 *     full screen.
 *   - Anytime (untimed) tasks have no rail position; they render as plain dotted rows
 *     above the timed rail (same as DayTimeline). Only timed→timed gaps are proportional.
 *     **Anytime badge (2026-07-15)**: the dashed `anytimeDot` rail marker on its own read as
 *     an unexplained blank circle (user report), so untimed rows also carry a small "Anytime"
 *     text pill in `titleRow` (vertical `renderRow` only — horizontal columns are too narrow,
 *     same reasoning as the hint row above). The dot itself stays — it's still the rail's
 *     required centered marker (Decision 042a) — this only adds a label alongside it.
 *   - **Completion feedback (2026-07-11, visual-audit)**: no card-level glow/bloom on
 *     completion — user feedback called the whole-card colour flash "too much"; the
 *     checkbox fill + strikethrough (plus the success() haptic in handleToggle) IS the
 *     feedback. The habit-card glow (app/(tabs)/health.tsx) is untouched — this was
 *     Home/Plans-specific.
 *   - **Purposeful glow (2026-07-18, breathing 2026-07-22)**: the "happening now" row's
 *     `rowCard` (vertical rail only, `renderRow`) gets a breathing `GlowPulse` halo
 *     (mode="breathe", domainColor.accent) alongside its accent tint fill — `isHappeningNow`
 *     is true for at most one entry at a time, so only a single row ever breathes.
 *     `renderColumn` (horizontal rail) is left as-is.
 *   - `styles.dot` is now the checkmark-circle toggle ONLY (moved to the row's own fixed-
 *     width `doneCol`/`hDoneRow`, right of / below the content, so it lines up across every
 *     row regardless of title length). `styles.timeBox` is the rail's position marker —
 *     a rounded box holding the task's start time — replacing the old plain dot; it keeps
 *     the "happening now" / follower-surfaced highlight that the dot used to carry. Done
 *     zone rows (the collapsed history list) always use the vertical `renderRow`, even in
 *     horizontal mode — it's a secondary dropdown, not the primary glance surface.
 *   - **Touch target (2026-07-11)**: the done-toggle `dot` is visually 16x16 but
 *     `hitSlop={16}` brings the tappable area to ~48dp, meeting Android's minimum
 *     touch-target size.
 *   - **Purposeful Depth System (2026-07-14)**: passes Surface's `elevated` when
 *     `expanded` — the card the user has actively opened to see the full day becomes
 *     the deepest surface (focus-pop). Per-row cards (`styles.rowCard`) aren't Surface
 *     instances here, so the surfaced-follower/"happening now" highlight stays a
 *     border/fill cue (unchanged) rather than a per-row elevation bump.
 *   - **Collapse feel (2026-07-15)**: rows exit with `FadeOutDown` (not a plain in-place
 *     `FadeOut`) — this app's motion goal for a neurodivergent audience is that things read
 *     as *retreating to somewhere*, never blinking out of existence. A directional exit also
 *     fixes a real bug: with a static fade, the "Done today" zone's `containerLayout` snap
 *     into its new (shorter) position visually overlapped the still-fading row above it
 *     ("covers half the task" — user report); sliding the exiting row down and out of the
 *     way removes that overlap instead of just papering over it with a longer fade. Rail,
 *     done-zone, and footer all sharing `containerLayout` (see Connections) is what makes the
 *     whole card reflow as one card rather than several pieces animating on their own clocks.
 *   - **Done-zone frame + calmer toggle (2026-07-16)**: `styles.doneZone` now carries a real
 *     border + `theme.surfaceMuted` background (was a transparent top border only) so the
 *     "Done today" header and its collapsed rows read as one card — a step subtler than the
 *     outer `Surface` so it doesn't stack two heavy card looks. Its (and the footer show-more
 *     toggle's) `PressableScale` now passes `releaseSpring={Spring.calm}` (constants/motion) —
 *     a near-critically-damped spring instead of the default bouncy release, since these are
 *     repeatedly-tapped toggles, not one-off button presses.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import ProgressBar from '@/components/ProgressBar';
import HomePreviewEmpty from '@/components/HomePreviewEmpty';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import { Task } from '@/store/useTaskStore';
import { FontSize, Fonts, HOME_PREVIEW_CARD_MIN_HEIGHT, Radius, Spacing, rgba } from '@/constants/theme';
import { Duration, Ease, Spring } from '@/constants/motion';
import { useAppTheme, useScaledStyles, useAccessibility } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { getDomainColor } from '@/lib/domainColor';
import { CardAccentBadge, CardAccentWash } from '@/components/CardAccent';
import GlowPulse from '@/components/GlowPulse';

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
  /** Read-only preview: shows a "See everything →" link in the section header. */
  onSeeMore?: () => void;
  /** Test/preview override for the live clock (minutes since midnight). */
  now?: number;
  /** Rail orientation — settings.planTimelineHorizontal. Default false (vertical rail). */
  horizontal?: boolean;
};

// Proportional rail tuning. Connector size between two timed tasks = the real gap in
// minutes × PX_PER_MIN, clamped legible. Keeps distance ∝ time without letting a long
// empty afternoon push the whole card off-screen. Shared by both orientations (height
// in the vertical rail, width in the horizontal one).
const PX_PER_MIN = 0.45;
const MIN_GAP = 10;
const MAX_GAP = 56;
const DEFAULT_BOX_MIN = 30; // start-at tasks get a nominal span so "happening now" works

// Vertical rail column widths.
const LINE_COL_WIDTH = 56;
const DONE_COL_WIDTH = 40;

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

// Decision 042(a) — shared opts for both renderRow (vertical) and renderColumn
// (horizontal); hasTopLine/hasBottomLine are vertical-only (ignored by renderColumn,
// which has no rail-line-through-the-row concept since its rail rows are fixed height).
type RailItemOpts = {
  timed?: TimedEntry;
  isHappeningNow?: boolean;
  isPast?: boolean;
  hasTopLine?: boolean;
  hasBottomLine?: boolean;
  /** vertical rail rows fade/slide in + reflow when the "Show more/less" toggle mounts/unmounts
   *  them; done-zone rows omit this (their reveal is owned by the Collapsible wrapper). */
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

/** Decision 009b — proportional tail = 10% of the visible span, floored at 15 min. */
function railTailMinutes(spanMinutes: number): number {
  return Math.max(spanMinutes * 0.1, 15);
}

/** Re-renders every 60s so the "now" marker drifts along the rail live. */
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

const COLLAPSED_COUNT = 5; // current + next + 3 after (Decision 009a)

export default function PlanTaskCard({
  tasks,
  allTasks,
  readOnly = false,
  onPressTask,
  onToggleTask,
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
  const doneTasks = useMemo(() => dayTasks.filter((task) => task.done), [dayTasks]);

  const pendingCount = anytimePending.length + timedPending.length;

  // Current = the timed task happening right now; otherwise the next one leads.
  const currentTimedIndex = timedPending.findIndex((e) => now >= e.start && now < e.end);
  const nextTimedIndex = currentTimedIndex >= 0 ? currentTimedIndex : timedPending.findIndex((e) => e.start > now);

  // Visible-span for the proportional tail: axis-start (first timed start) → last
  // unfinished end. Anytime tasks don't participate in the span.
  const spanMinutes = timedPending.length > 0
    ? Math.max(1, timedPending[timedPending.length - 1].end - timedPending[0].start)
    : 0;
  const tailPx = timedPending.length > 0 ? clamp(railTailMinutes(spanMinutes) * PX_PER_MIN, 10, MAX_GAP) : 0;

  // Collapse window: the current/in-progress task always leads, then next + 2 after
  // (Decision 009a). Overdue-but-pending timed tasks before "current" collapse away.
  const timedStart = nextTimedIndex >= 0 ? nextTimedIndex : 0;
  const collapsedVisible = useMemo(() => {
    const ids = [
      ...anytimePending.map((task) => task.id),
      ...timedPending.slice(timedStart).map((e) => e.task.id),
    ].slice(0, COLLAPSED_COUNT);
    return new Set(ids);
  }, [anytimePending, timedPending, timedStart]);
  const showToggle = pendingCount > collapsedVisible.size && !readOnly;

  function isVisible(id: string): boolean {
    return expanded || readOnly || collapsedVisible.has(id);
  }

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

  function renderRow(task: Task, opts: RailItemOpts) {
    const { timed, isHappeningNow, isPast, hasTopLine, hasBottomLine, animateIn } = opts;
    const dimmed = !!(task.done || isPast);
    const surfaced = surfacedIds.has(task.id);
    const isUp = task.id === upNextId;
    const showHint = isUp && !!task.hint && !task.done;
    // Rows the "Show more/less" toggle adds/removes glide in/out and reflow (ShoppingRow §
    // house pattern); reducedMotion, done-zone rows (animateIn omitted), and the first mount
    // (hasMounted false) stay static so the collapsed set doesn't fade in on every mount.
    const anim = animateIn && !reducedMotion && hasMounted.current;

    return (
      <Animated.View
        key={task.id}
        style={styles.row}
        entering={anim ? FadeInDown.duration(Duration.listIn).easing(Ease.enter) : undefined}
        exiting={anim ? FadeOutDown.duration(Duration.cardOut).easing(Ease.exit) : undefined}
        layout={anim ? LinearTransition.duration(Duration.listMove).easing(Ease.move) : undefined}
      >
        <View style={styles.lineCol}>
          <View style={[styles.railLine, { backgroundColor: hasTopLine ? theme.border : 'transparent' }]} />
          {timeMarker(task, timed, dimmed, isHappeningNow, surfaced)}
          <View style={[styles.railLine, { backgroundColor: hasBottomLine ? theme.border : 'transparent' }]} />
        </View>
        <PressableScale style={styles.contentCol} onPress={() => handlePress(task)} disabled={readOnly || !onPressTask} scaleTo={0.97}>
          <View
            style={[
              styles.rowCard,
              // Ordinary rows: a soft accent wash instead of drab grey (debug-note 2026-07-21)
              // — still clearly set apart from plain-surface cards, but warmer. The
              // happening-now row keeps the stronger tint + glow so hierarchy is preserved.
              { backgroundColor: isHappeningNow ? rgba(theme.accent, 0.1) : rgba(theme.accent, 0.05) },
            ]}
          >
            <GlowPulse active={!!isHappeningNow} color={domainColor.accent} mode="breathe" radius={Radius.sm} />
            <View style={styles.titleRow}>
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
              {!timed && !task.done ? (
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
          </View>
        </PressableScale>
        <View style={styles.doneCol}>{doneToggle(task, isHappeningNow)}</View>
      </Animated.View>
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

  /** Decision 042(a) — the connector between two rows/columns is its own dedicated
   * spacer element (never embedded inside a row/column of variable content height),
   * so its size never has to fight a neighbor's real content height. */
  function renderSpacer(key: string, sizePx: number, content?: React.ReactNode) {
    return (
      <View key={key} style={[styles.spacerRow, { minHeight: sizePx }]}>
        <View style={styles.lineCol}>
          <View style={[styles.railLine, { backgroundColor: theme.border }]} />
        </View>
        {content ? <View style={styles.spacerContent}>{content}</View> : null}
      </View>
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

  const renderItem: (task: Task, opts: RailItemOpts) => React.ReactNode = horizontal ? renderColumn : renderRow;
  const renderSpacerItem: (key: string, sizePx: number, content?: React.ReactNode) => React.ReactNode = horizontal
    ? renderHSpacer
    : renderSpacer;

  const nowMarker = (
    <View style={styles.nowRow}>
      <View style={[styles.nowDot, { backgroundColor: theme.accent }]} />
      <View style={[styles.nowLine, { backgroundColor: theme.accent }]} />
      <Text style={[styles.nowLabel, { color: theme.accent }]}>
        {t.timelineNow} · {minutesToLabel(now)}
      </Text>
    </View>
  );
  const hNowMarker = (
    <View style={styles.hNowMarker}>
      <View style={[styles.hNowLine, { backgroundColor: theme.accent }]} />
      <Text numberOfLines={1} style={[styles.hNowLabel, { color: theme.accent }]}>
        {t.timelineNow}
      </Text>
    </View>
  );

  // Gap state (Decision 009a): no task happening now, but one is coming — "Nothing until HH:MM".
  const hasGap = currentTimedIndex < 0 && nextTimedIndex >= 0 && timedPending[nextTimedIndex].start > now;
  const gapMarker = hasGap ? (
    <View style={styles.gapRow}>
      <View style={[styles.gapDot, { borderColor: theme.border }]} />
      <Text style={[styles.gapText, { color: theme.textMuted }]}>
        {t.dayViewGapUntil(minutesToLabel(timedPending[nextTimedIndex].start))}
      </Text>
    </View>
  ) : null;
  const hGapMarker = hasGap ? (
    <View style={styles.hGapMarker}>
      <View style={[styles.hGapDot, { borderColor: theme.border }]} />
      <Text style={[styles.hGapText, { color: theme.textMuted }]} numberOfLines={2}>
        {t.dayViewGapUntil(minutesToLabel(timedPending[nextTimedIndex].start))}
      </Text>
    </View>
  ) : null;

  // Decision 042(a) — a single "is this the first rail item overall" flag tracked
  // across both loops, since anytime rows (if any) always precede timed rows: the
  // very first visible row gets no line above it, every row after gets one.
  let isFirstItem = true;

  const visibleAnytime = anytimePending.filter((task) => isVisible(task.id));
  const visibleTimed = timedPending.filter((e) => isVisible(e.task.id));

  const anytimeItems: React.ReactNode[] = [];
  visibleAnytime.forEach((task, idx) => {
    const hasTopLine = !isFirstItem;
    isFirstItem = false;
    const hasNext = idx < visibleAnytime.length - 1 || timedPending.length > 0;
    anytimeItems.push(renderItem(task, { hasTopLine, hasBottomLine: hasNext, animateIn: true }));
    if (hasNext) anytimeItems.push(renderSpacerItem(`gap-any-${task.id}`, MIN_GAP));
  });

  const timedItems: React.ReactNode[] = [];
  visibleTimed.forEach((entry, idx) => {
    const hasTopLine = !isFirstItem;
    isFirstItem = false;
    const isHappeningNow = now >= entry.start && now < entry.end;
    const isPast = !isHappeningNow && now >= entry.end;
    const isLast = idx === visibleTimed.length - 1;
    const nextEntry = visibleTimed[idx + 1];
    const gapMin = nextEntry ? nextEntry.start - entry.end : 0;
    const connectorPx = nextEntry ? clamp(gapMin * PX_PER_MIN, MIN_GAP, MAX_GAP) : tailPx;
    const hasBottomLine = !isLast || tailPx > 0;
    timedItems.push(renderItem(entry.task, { timed: entry, isHappeningNow, isPast, hasTopLine, hasBottomLine, animateIn: true }));
    if (hasBottomLine) {
      // Insert the live "now" marker into the connector whose time-window contains it —
      // it renders as the spacer's content, not a dangling extra sibling row.
      const nowInThisGap = !!nextEntry && now >= entry.end && now < nextEntry.start;
      const marker = nowInThisGap ? (horizontal ? hNowMarker : nowMarker) : undefined;
      timedItems.push(renderSpacerItem(`gap-${entry.task.id}`, connectorPx, marker));
    }
  });

  const showEmpty = pendingCount === 0 && doneTasks.length === 0;
  const allDone = pendingCount === 0 && doneTasks.length > 0;

  // Shared with the rail/doneZone/footer so the whole card reflows in sync with the row-level
  // layout transition above — otherwise these siblings snap instantly while rows are still
  // fading, which is what made the done-zone appear to get "covered" by an exiting row.
  const containerLayout = reducedMotion ? undefined : LinearTransition.duration(Duration.listMove).easing(Ease.move);

  return (
    <Surface
      surfaceContext="ambient"
      borderColor={domainColor.accent}
      elevated={expanded}
      style={[styles.card, !expanded && styles.cardCollapsed]}
    >
      <View style={styles.cardContent}>

        {/* Section header — only in read-only (Home preview) mode */}
        {readOnly && (
          <>
          <CardAccentWash domain="plan" style={styles.headerWash} />
          <PressableScale onPress={() => router.push('/plans')} style={styles.headerRowPressable} scaleTo={0.97}>
            <View style={styles.headerRow}>
              <CardAccentBadge domain="plan" size={32} />
              <Text style={[styles.headerTitle, { color: theme.text }]}>{t.home.todaysPlans}</Text>
              {pendingCount > 0 && (
                <View style={[styles.badge, { backgroundColor: domainColor.soft }]}>
                  <Text style={[styles.badgeText, { color: domainColor.accent }]}>{pendingCount}</Text>
                </View>
              )}
              <View style={styles.nowChip}>
                <View style={[styles.nowChipDot, { backgroundColor: theme.accent }]} />
                <Text style={[styles.nowChipText, { color: theme.accent }]}>{minutesToLabel(now)}</Text>
              </View>
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
          </>
        )}

        {showEmpty ? (
          <View style={styles.emptyWrap}>
            <HomePreviewEmpty text={t.timelineEmpty} domainColor={domainColor} />
            {/* Ghost "add" row (debug-note 2026-07-21) — an empty day should still offer a
                place to add something. The Home preview is read-only, so it deep-links to
                the Plans tab rather than creating inline. */}
            {readOnly && (
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
            {anytimeItems}
            {timedItems}
          </ScrollView>
        ) : (
          <Animated.View style={styles.rail} layout={containerLayout}>
            {gapMarker}
            {anytimeItems}
            {timedItems}
          </Animated.View>
        )}

        {/* Done zone — dimmed, collapsed by default (Decision 009a). Always the vertical
            row layout, even in horizontal mode — this is a secondary dropdown list, not
            the primary glance rail. */}
        {doneTasks.length > 0 ? (
          <Animated.View style={[styles.doneZone, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} layout={containerLayout}>
            <PressableScale style={styles.doneHeader} onPress={() => { tap(); setDoneOpen((v) => !v); }} scaleTo={0.97} releaseSpring={Spring.calm}>
              <Text style={[styles.doneHeaderText, { color: theme.textMuted }]}>{t.dayViewDoneZone(doneTasks.length)}</Text>
              <AnimatedChevron open={doneOpen} size={14} color={theme.textMuted} />
            </PressableScale>
            <Collapsible open={doneOpen}>
              <View style={styles.doneRows}>
                {doneTasks.map((task) =>
                  renderRow(task, {
                    timed: task.time ? timedEntryOf(task) : undefined,
                    isPast: true,
                    hasTopLine: false,
                    hasBottomLine: false,
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
  // few tasks (or how compact the time gaps) today has — see constants/theme.ts. Content can
  // still grow taller than this floor (e.g. widely time-spaced tasks) — it's a min, not a cap.
  cardCollapsed: { minHeight: HOME_PREVIEW_CARD_MIN_HEIGHT },
  // Tighter top padding (Spacing.sm) so the header hugs the card's top edge and sits high in
  // the wash band, away from the white fade — matches the dot-header cards (SectionCard).
  cardContent: { flex: 1, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, paddingTop: Spacing.sm, position: 'relative' },
  rail: { paddingVertical: Spacing.xs },
  emptyText: { fontSize: FontSize.sm, fontStyle: 'italic', textAlign: 'center', paddingVertical: Spacing.sm },
  // Empty-day ghost add row: fills the resting height, add affordance pinned below the message.
  emptyWrap: { flex: 1 },
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

  // Vertical rail row: [lineCol][contentCol][doneCol], alignItems 'stretch' so each
  // column's height matches the row's real (content-driven) height. lineCol's own
  // top/bottom rail-line segments are flex:1 either side of the marker, so the marker
  // (and doneCol's toggle, also flex-centered) land at the row's true vertical center
  // by construction — no measurement pass needed (Decision 042a).
  row: { flexDirection: 'row', alignItems: 'stretch' },
  lineCol: { width: LINE_COL_WIDTH, alignItems: 'center' },
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
  // The rail line: flex:1 so it stretches to fill whatever space lineCol/spacerRow's
  // stretched height gives it — either half of a row (above/below its marker) or the
  // whole of a spacer row (Decision 042a).
  railLine: { width: 2, flex: 1 },
  contentCol: { flex: 1, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },
  // Decision (visual-audit 2026-07-11): a subtle card behind each row's title/hint so
  // the rail reads as distinct items rather than text floating on the background.
  rowCard: { borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  doneCol: { width: DONE_COL_WIDTH, alignItems: 'center', justifyContent: 'center' },
  // Dedicated connector row between two task rows — owns the proportional time-gap
  // height so it never has to be squeezed inside a row of variable content height.
  spacerRow: { flexDirection: 'row', alignItems: 'stretch' },
  spacerContent: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.semibold, flexShrink: 1 },
  durationText: { fontSize: FontSize.xs },
  followerBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 1 },
  followerBadgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, marginTop: 2 },
  hintText: { fontSize: FontSize.xs, flexShrink: 1, fontStyle: 'italic' },
  nowRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  nowDot: { width: 6, height: 6, borderRadius: Radius.full, marginRight: 6 },
  nowLine: { flex: 1, height: 1.5, opacity: 0.6 },
  nowLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, marginLeft: 6 },
  gapRow: { flexDirection: 'row', alignItems: 'center', marginLeft: LINE_COL_WIDTH, marginBottom: Spacing.sm, gap: Spacing.sm },
  gapDot: { width: 8, height: 8, borderRadius: Radius.full, borderWidth: 2, borderStyle: 'dashed' },
  gapText: { fontSize: FontSize.sm, fontStyle: 'italic' },

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
  // connector wider than its proportional width (Decision 042a: marker lives inside
  // the spacer, not as an extra sibling that dangled the rail further apart).
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
  headerWash: { top: -Spacing.sm, left: -Spacing.md, right: -Spacing.md },
  headerRowPressable: { marginBottom: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // Persistent "now" indicator (visual-audit 2026-07-11) — always visible in the header,
  // not just when a gap connector happens to render one.
  nowChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  nowChipDot: { width: 6, height: 6, borderRadius: Radius.full },
  nowChipText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  progressBar: { marginTop: Spacing.xs },
  headerTitle: { fontSize: 20, lineHeight: 25, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.8 },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
});
