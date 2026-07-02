/**
 * DayTimeline.tsx — "Plans" agenda strip (anytime + timed tasks for one day)
 *
 * Renders a day's tasks as a single vertical agenda: untimed ("anytime") tasks
 * first with no time column, followed by time-anchored tasks in chronological
 * order along a vertical line with a live "now" marker inserted at its correct
 * position. The caller decides which slice of the day to pass in (a short
 * preview or the full day) — this component is purely presentational and just
 * renders whatever task list it's given.
 *
 * Connections:
 *   Imports → constants/theme, lib/i18n, lib/useAppTheme, store/useTaskStore (Task type only)
 *   Used by → (not yet mounted — ported ahead of the Home/Plans phases per REBUILD_PLAN.md 3d)
 *   Data    → pure presentational component; reads no stores directly; scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - Tasks without a `time` render first, in array order (no time column, just
 *     a plain dot) — they're "anytime today" items, not absent from the agenda.
 *   - Tasks with a `time` are sorted chronologically; the live "now" marker
 *     (re-rendered on a 60s interval, see useNowMinutes) is inserted only among
 *     the timed entries, right before the first one that hasn't started yet.
 *   - Time-box tasks show their start–end span as one "08:00–09:30" line (not stacked
 *     start/end lines — that was hard to read); start-at tasks show a single time. Both
 *     always use the dimmed-aware color (text vs textMuted), never a hardcoded
 *     textMuted, so done/past rows dim consistently with the title.
 *   - Essential tasks get a small star indicator — regular tasks get none. Done
 *     tasks are muted (not hidden) so the day's shape stays visible.
 *   - onToggle is optional: when passed, the dot becomes its own tappable check
 *     target (mirrors TaskItem's checkbox) so tasks can be checked off inline.
 *     Without onToggle the whole row falls back to onPress only.
 *   - `done`/`importance` were part of the Decision 015 `Task` stub's minimal
 *     contract for this component; Phase 5's real store (store/useTaskStore.ts,
 *     2026-07-02) keeps both fields — confirmed, no changes needed here.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Task } from '@/store/useTaskStore';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';

type Props = {
  tasks: Task[];
  onPress: (task: Task) => void;
  onToggle?: (task: Task) => void;
};

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

/** Re-renders every 60s so the "now" marker drifts along the timeline live. */
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

export default function DayTimeline({ tasks, onPress, onToggle }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const nowMinutes = useNowMinutes();

  const anytimeEntries = useMemo(() => tasks.filter((task) => !task.time), [tasks]);

  const timedEntries = useMemo(() => {
    return tasks
      .filter((task) => !!task.time)
      .map((task) => {
        const start = toMinutes(task.time!) ?? 0;
        const end = task.taskType === 'time-box' ? start + (task.durationMinutes ?? 30) : start;
        return { task, start, end };
      })
      .sort((a, b) => a.start - b.start);
  }, [tasks]);

  if (anytimeEntries.length === 0 && timedEntries.length === 0) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: theme.surfaceMuted }]}>
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.timelineEmpty}</Text>
      </View>
    );
  }

  // Index of the first timed entry that hasn't started yet — the "now" marker
  // is inserted right before it (or at the end if the whole day has started).
  const nowInsertIndex = timedEntries.findIndex((e) => e.start > nowMinutes);
  const insertAt = nowInsertIndex === -1 ? timedEntries.length : nowInsertIndex;

  function renderTaskRow(task: Task, opts: { showLine: boolean; isLast: boolean; start?: number; end?: number }) {
    const { showLine, isLast } = opts;
    const start = opts.start ?? 0;
    const end = opts.end ?? start;
    const isHappeningNow = showLine && !task.done && nowMinutes >= start && nowMinutes < end;
    const isPast = showLine && !isHappeningNow && nowMinutes >= end;
    const isEssential = task.importance === 'essential';
    const dimmed = task.done || isPast;

    return (
      <Pressable key={task.id} style={styles.row} onPress={() => onPress(task)}>
        <View style={styles.timeCol}>
          {showLine && (
            <Text style={[styles.timeText, { color: dimmed ? theme.textMuted : theme.text }]} numberOfLines={1}>
              {task.taskType === 'time-box' ? `${task.time}–${minutesToLabel(end)}` : task.time}
            </Text>
          )}
        </View>
        <View style={styles.lineCol}>
          <Pressable
            disabled={!onToggle}
            hitSlop={8}
            onPress={onToggle ? (e) => { e.stopPropagation(); onToggle(task); } : undefined}
          >
            <View
              style={[
                styles.dot,
                { borderColor: isHappeningNow ? theme.accent : theme.border },
                (isHappeningNow || task.done) && { backgroundColor: theme.accent },
              ]}
            />
          </Pressable>
          {!isLast && <View style={[styles.connector, { backgroundColor: theme.border }]} />}
        </View>
        <View style={styles.contentCol}>
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
            {isEssential && !task.done && (
              <Ionicons name="star" size={12} color={theme.accent} />
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  const nowMarker = (
    <View style={styles.nowRow}>
      <View style={[styles.nowDot, { backgroundColor: theme.accent }]} />
      <View style={[styles.nowLine, { backgroundColor: theme.accent }]} />
      <Text style={[styles.nowLabel, { color: theme.accent }]}>
        {t.timelineNow} · {minutesToLabel(nowMinutes)}
      </Text>
    </View>
  );

  return (
    <View style={styles.wrap}>
      {anytimeEntries.map((task, idx) =>
        renderTaskRow(task, { showLine: false, isLast: idx === anytimeEntries.length - 1 && timedEntries.length === 0 })
      )}
      {timedEntries.map((entry, idx) => (
        <React.Fragment key={entry.task.id}>
          {idx === insertAt && nowMarker}
          {renderTaskRow(entry.task, {
            showLine: true,
            isLast: idx === timedEntries.length - 1,
            start: entry.start,
            end: entry.task.taskType === 'time-box' ? entry.end : entry.start + 30,
          })}
        </React.Fragment>
      ))}
      {insertAt === timedEntries.length && timedEntries.length > 0 && nowMarker}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  wrap: { paddingVertical: Spacing.xs },
  emptyCard: { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  timeCol: { width: 68, alignItems: 'flex-end', paddingTop: 1, paddingRight: Spacing.sm },
  timeText: { fontSize: FontSize.sm, fontWeight: '700' },
  lineCol: { alignItems: 'center', width: 16 },
  dot: { width: 10, height: 10, borderRadius: Radius.full, borderWidth: 2 },
  connector: { width: 2, flex: 1, minHeight: Spacing.lg, marginVertical: 2 },
  contentCol: { flex: 1, paddingLeft: Spacing.sm, paddingBottom: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  title: { fontSize: FontSize.md, fontWeight: '500', flexShrink: 1 },
  nowRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 68 + Spacing.sm, marginVertical: 2 },
  nowDot: { width: 6, height: 6, borderRadius: Radius.full, marginRight: 6 },
  nowLine: { flex: 1, height: 1.5, opacity: 0.6 },
  nowLabel: { fontSize: FontSize.xs, fontWeight: '700', marginLeft: 6 },
});
