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
 * Connections:
 *   Imports → components/Surface, components/CompletionGlow, constants/theme, lib/haptics,
 *             lib/i18n, lib/useAppTheme, store/useTaskStore (Task type only)
 *   Used by → app/(tabs)/index.tsx (Home — read-only preview off-focus per Decision 009a, and
 *             non-readOnly essential-filtered surface in Focus mode per 009 #4). Reads
 *             settings.planTimelineHorizontal there and passes it down as the `horizontal`
 *             prop — this component stays store-free/presentational. NOTE: the full /plans
 *             (Tasks/Oppgaver) screen no longer renders this day-view — it was rebuilt into
 *             a tabbed inline-list (2026-07-08); Home is now the sole caller.
 *   Data    → pure presentational; reads no stores. Tasks + callbacks + orientation are
 *             passed in. Live "now" marker re-renders on a 60s interval (useNowMinutes).
 *
 * Edit notes:
 *   - **Decision 014**: the card face is a `<Surface>`; `accentColor` (default `featPlan`)
 *     tints the 4px left accent BAR ONLY — never the Surface border/sheen/fill. Do not
 *     reintroduce border-tint here (Surface owns border/sheen/blur since Decision 008).
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
 *   - `readOnly` (Home preview) disables the done-toggle and row tap-through only —
 *     structure, rail, collapse/expand, and done zone are identical (Decision 009a). Pass
 *     `onSeeMore` to show a "See everything →" link routing to the full screen.
 *   - Anytime (untimed) tasks have no rail position; they render as plain dotted rows
 *     above the timed rail (same as DayTimeline). Only timed→timed gaps are proportional.
 *   - **Completion feedback**: a completed task immediately leaves the pending rail for
 *     the (collapsed) done zone, so a per-row animation would unmount before it plays.
 *     Instead a card-level `CompletionGlow` blooms when the done count rises (tracked via
 *     `completionPulse`) — the card stays mounted, so the "small win" reward shows. This
 *     mirrors the habit-card glow (app/(tabs)/health.tsx). The success() haptic is in handleToggle.
 *   - `styles.dot` is now the checkmark-circle toggle ONLY (moved to the row's own fixed-
 *     width `doneCol`/`hDoneRow`, right of / below the content, so it lines up across every
 *     row regardless of title length). `styles.timeBox` is the rail's position marker —
 *     a rounded box holding the task's start time — replacing the old plain dot; it keeps
 *     the "happening now" / follower-surfaced highlight that the dot used to carry. Done
 *     zone rows (the collapsed history list) always use the vertical `renderRow`, even in
 *     horizontal mode — it's a secondary dropdown, not the primary glance surface.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import CompletionGlow from '@/components/CompletionGlow';
import ProgressBar from '@/components/ProgressBar';
import { Task } from '@/store/useTaskStore';
import { FontSize, Fonts, Radius, Spacing, rgba } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';

type Props = {
  /** Tasks scheduled for the viewed date (already filtered by the caller). */
  tasks: Task[];
  /** Full store list — lets cross-date followers surface into this view (Decision 020). Defaults to `tasks`. */
  allTasks?: Task[];
  /** Home preview: disables done-toggle + row tap-through only (Decision 009a). */
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
const PX_PER_MIN = 0.55;
const MIN_GAP = 14;
const MAX_GAP = 72;
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
  const styles = useScaledStyles(baseStyles);
  const liveNow = useNowMinutes();
  const now = nowOverride ?? liveNow;

  const [expanded, setExpanded] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  // Completion reward: a task marked done leaves the pending rail and drops into the
  // (collapsed) done zone on the same render, so a per-row animation would unmount
  // before it could play. Instead bloom a card-level CompletionGlow when the done count
  // rises — the card stays mounted, so the "small win" reward is actually visible.
  // Mirrors the habit-card glow pattern (app/(tabs)/health.tsx). success() haptic fires in
  // handleToggle; the glow self-skips under reduce-motion.
  const [completionPulse, setCompletionPulse] = useState(0);

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

  // Pulse the card glow whenever the done count rises (a task was just completed).
  const prevDoneCount = useRef(doneTasks.length);
  useEffect(() => {
    if (doneTasks.length > prevDoneCount.current) setCompletionPulse((n) => n + 1);
    prevDoneCount.current = doneTasks.length;
  }, [doneTasks.length]);

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
    if (readOnly || !onToggleTask) return;
    if (!task.done) success();
    onToggleTask(task);
  }

  function handlePress(task: Task) {
    if (readOnly || !onPressTask) return;
    onPressTask(task);
  }

  function doneToggle(task: Task, isHappeningNow?: boolean) {
    return (
      <Pressable
        disabled={readOnly || !onToggleTask}
        hitSlop={8}
        onPress={() => handleToggle(task)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
      >
        <View
          style={[
            styles.dot,
            { borderColor: isHappeningNow ? theme.accent : theme.border },
            (isHappeningNow || task.done) && { backgroundColor: theme.accent, borderColor: theme.accent },
          ]}
        >
          {task.done && <Ionicons name="checkmark" size={10} color={theme.accentInk} />}
        </View>
      </Pressable>
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

  function renderRow(
    task: Task,
    opts: { timed?: TimedEntry; isHappeningNow?: boolean; isPast?: boolean; showConnector: boolean; connectorPx: number }
  ) {
    const { timed, isHappeningNow, isPast, showConnector, connectorPx } = opts;
    const dimmed = !!(task.done || isPast);
    const surfaced = surfacedIds.has(task.id);
    const isUp = task.id === upNextId;
    const showHint = isUp && !!task.hint && !task.done;

    return (
      <View key={task.id} style={styles.row}>
        <View style={styles.lineCol}>
          {timeMarker(task, timed, dimmed, isHappeningNow, surfaced)}
          {showConnector && <View style={[styles.connector, { height: connectorPx, backgroundColor: theme.border }]} />}
        </View>
        <Pressable style={styles.contentCol} onPress={() => handlePress(task)} disabled={readOnly || !onPressTask}>
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
            {task.importance === 'essential' && !task.done && <Ionicons name="star" size={12} color={theme.accent} />}
            {surfaced && !task.done ? (
              <View style={[styles.followerBadge, { backgroundColor: rgba(theme.featPlan, 0.16) }]}>
                <Text style={[styles.followerBadgeText, { color: theme.featPlan }]}>{t.dayViewFollowerBadge}</Text>
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
        </Pressable>
        <View style={styles.doneCol}>{doneToggle(task, isHappeningNow)}</View>
      </View>
    );
  }

  function renderColumn(
    task: Task,
    opts: { timed?: TimedEntry; isHappeningNow?: boolean; isPast?: boolean; showConnector: boolean; connectorPx: number }
  ) {
    const { timed, isHappeningNow, isPast, showConnector, connectorPx } = opts;
    const dimmed = !!(task.done || isPast);
    const surfaced = surfacedIds.has(task.id);

    return (
      <React.Fragment key={task.id}>
        <Pressable
          style={styles.hColumn}
          onPress={() => handlePress(task)}
          disabled={readOnly || !onPressTask}
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
            {task.importance === 'essential' && !task.done && (
              <Ionicons name="star" size={11} color={theme.accent} style={styles.hStar} />
            )}
          </View>
          <View style={styles.hDoneRow}>{doneToggle(task, isHappeningNow)}</View>
        </Pressable>
        {showConnector && (
          <View style={styles.hConnectorWrap}>
            <View style={[styles.hConnector, { width: connectorPx, backgroundColor: theme.border }]} />
          </View>
        )}
      </React.Fragment>
    );
  }

  const renderItem = horizontal ? renderColumn : renderRow;

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

  const anytimeItems = anytimePending
    .filter((task) => isVisible(task.id))
    .map((task, idx, arr) =>
      renderItem(task, { showConnector: idx < arr.length - 1 || timedPending.length > 0, connectorPx: MIN_GAP })
    );

  const timedItems: React.ReactNode[] = [];
  const visibleTimed = timedPending.filter((e) => isVisible(e.task.id));
  visibleTimed.forEach((entry, idx) => {
    const isHappeningNow = now >= entry.start && now < entry.end;
    const isPast = !isHappeningNow && now >= entry.end;
    const isLast = idx === visibleTimed.length - 1;
    const nextEntry = visibleTimed[idx + 1];
    const gapMin = nextEntry ? nextEntry.start - entry.end : 0;
    const connectorPx = nextEntry ? clamp(gapMin * PX_PER_MIN, MIN_GAP, MAX_GAP) : tailPx;
    // Insert the live "now" marker into the connector whose time-window contains it.
    const nowInThisGap = nextEntry && now >= entry.end && now < nextEntry.start;
    timedItems.push(
      <React.Fragment key={entry.task.id}>
        {renderItem(entry.task, {
          timed: entry,
          isHappeningNow,
          isPast,
          showConnector: !isLast || tailPx > 0,
          connectorPx,
        })}
        {nowInThisGap ? (horizontal ? hNowMarker : nowMarker) : null}
      </React.Fragment>
    );
  });

  const showEmpty = pendingCount === 0 && doneTasks.length === 0;
  const allDone = pendingCount === 0 && doneTasks.length > 0;

  return (
    <Surface surfaceContext="ambient" style={[styles.card, styles.cardRow]}>
      <View style={[styles.accent, { backgroundColor: theme.featPlan }]} />
      <View style={styles.cardContent}>
        <CompletionGlow trigger={completionPulse} color={theme.accent} radius={Radius.md} />

        {/* Section header — only in read-only (Home preview) mode */}
        {readOnly && (
          <Pressable onPress={() => router.push('/plans')} style={styles.headerRowPressable}>
            <View style={styles.headerRow}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>{t.home.todaysPlans}</Text>
              {pendingCount > 0 && (
                <View style={[styles.badge, { backgroundColor: rgba(theme.featPlan, 0.16) }]}>
                  <Text style={[styles.badgeText, { color: theme.featPlan }]}>{pendingCount}</Text>
                </View>
              )}
            </View>
            {dayTasks.length > 0 && (
              <ProgressBar
                value={doneTasks.length / dayTasks.length}
                color={theme.featPlan}
                height={4}
                style={styles.progressBar}
              />
            )}
          </Pressable>
        )}

        {showEmpty ? (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.timelineEmpty}</Text>
        ) : allDone ? (
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.dayViewAllDone}</Text>
        ) : horizontal ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRail}>
            {hGapMarker}
            {anytimeItems}
            {timedItems}
          </ScrollView>
        ) : (
          <View style={styles.rail}>
            {gapMarker}
            {anytimeItems}
            {timedItems}
          </View>
        )}

        {/* Done zone — dimmed, collapsed by default (Decision 009a). Always the vertical
            row layout, even in horizontal mode — this is a secondary dropdown list, not
            the primary glance rail. */}
        {doneTasks.length > 0 ? (
          <View style={styles.doneZone}>
            <Pressable style={styles.doneHeader} onPress={() => { tap(); setDoneOpen((v) => !v); }}>
              <Text style={[styles.doneHeaderText, { color: theme.textMuted }]}>{t.dayViewDoneZone(doneTasks.length)}</Text>
              <Ionicons name={doneOpen ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textMuted} />
            </Pressable>
            {doneOpen
              ? doneTasks.map((task) =>
                  renderRow(task, {
                    timed: task.time ? timedEntryOf(task) : undefined,
                    isPast: true,
                    showConnector: false,
                    connectorPx: 0,
                  })
                )
              : null}
          </View>
        ) : null}

        {showToggle ? (
          <Pressable style={styles.footerBtn} onPress={() => { tap(); setExpanded((v) => !v); }}>
            <Text style={[styles.footerBtnText, { color: theme.accent }]}>
              {expanded ? t.plansCollapse : t.plansExpand}
            </Text>
          </Pressable>
        ) : null}

      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  cardRow: { flexDirection: 'row' },
  accent: { width: 4, alignSelf: 'stretch' },
  cardContent: { flex: 1, padding: Spacing.md, position: 'relative' },
  rail: { paddingVertical: Spacing.xs },
  emptyText: { fontSize: FontSize.sm, fontStyle: 'italic', textAlign: 'center', paddingVertical: Spacing.sm },

  // Vertical rail row: [lineCol][contentCol][doneCol] — the line sits at the row's
  // left edge, the checkmark-circle toggle in a fixed-width column at the right edge,
  // so it lines up across every row regardless of title length.
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  lineCol: { width: LINE_COL_WIDTH, alignItems: 'center', paddingTop: 1 },
  timeBox: {
    minWidth: 44,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBoxText: { fontSize: FontSize.xs, fontWeight: '700' },
  anytimeDot: { width: 10, height: 10, borderRadius: Radius.full, borderWidth: 2, borderStyle: 'dashed' },
  dot: { width: 16, height: 16, borderRadius: Radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  connector: { width: 2, marginVertical: 2 },
  contentCol: { flex: 1, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.md },
  doneCol: { width: DONE_COL_WIDTH, alignItems: 'center', paddingTop: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  title: { fontSize: FontSize.md, fontWeight: '500', flexShrink: 1 },
  durationText: { fontSize: FontSize.xs },
  followerBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 1 },
  followerBadgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, marginTop: 2 },
  hintText: { fontSize: FontSize.xs, flexShrink: 1, fontStyle: 'italic' },
  nowRow: { flexDirection: 'row', alignItems: 'center', marginLeft: LINE_COL_WIDTH, marginVertical: 2 },
  nowDot: { width: 6, height: 6, borderRadius: Radius.full, marginRight: 6 },
  nowLine: { flex: 1, height: 1.5, opacity: 0.6 },
  nowLabel: { fontSize: FontSize.xs, fontWeight: '700', marginLeft: 6 },
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
  hTitle: { fontSize: FontSize.sm, fontWeight: '500', textAlign: 'center' },
  hStar: { marginTop: 2 },
  hDoneRow: { paddingTop: Spacing.xs },
  hConnectorWrap: { height: H_RAIL_HEIGHT, justifyContent: 'center' },
  hConnector: { height: 2 },
  hNowMarker: { width: 44, height: H_RAIL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  hNowLine: { width: 1.5, height: '100%', opacity: 0.6 },
  hNowLabel: { fontSize: FontSize.xs, fontWeight: '700', position: 'absolute', top: -2 },
  hGapMarker: { width: 72, alignItems: 'center', paddingTop: 2 },
  hGapDot: { width: 8, height: 8, borderRadius: Radius.full, borderWidth: 2, borderStyle: 'dashed', marginBottom: 4 },
  hGapText: { fontSize: FontSize.xs, fontStyle: 'italic', textAlign: 'center' },

  doneZone: { marginTop: Spacing.xs, borderTopWidth: 1, borderTopColor: 'transparent' },
  doneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  doneHeaderText: { fontSize: FontSize.sm, fontWeight: '600' },
  footerBtn: { alignItems: 'center', paddingTop: Spacing.sm },
  footerBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  headerRowPressable: { marginBottom: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressBar: { marginTop: Spacing.xs },
  headerTitle: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
});
