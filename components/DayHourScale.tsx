/**
 * DayHourScale.tsx — compact vertical hour-of-day scale shown in PlanTaskCard's empty state.
 *
 * A day with zero tasks used to render as pure blank space (HomePreviewEmpty) — which reads
 * as "broken" rather than "empty checklist," since nothing on the card conveyed that this is a
 * day-view at all (user report, 2026-07-25: the Home "Today's Tasks" card showed nothing but
 * the header and the add row). This renders a top-to-bottom scale — a vertical line, four
 * evenly-spaced hour labels, and a live "now" marker — so the card reads as a timeline waiting
 * for tasks, not an empty box, even before anything is added.
 *
 * **Vertical, not horizontal (2026-07-25, user report)**: the first version of this component
 * was a horizontal ruler (line + labels left-to-right). Feedback: it should read as the start
 * of a *checklist* — task names + checkmark circles stacked top-to-bottom, the same shape
 * PlanTaskCard's real vertical rail uses — not a side-scrolling axis. Rebuilt around the same
 * `lineCol` (left line, width matches the real rail's `LINE_COL_WIDTH`) so an empty day's scale
 * lines up with the actual time-box column once a task is added, instead of the layout jumping
 * from a horizontal ruler to a vertical rail.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme
 *   Used by → components/PlanTaskCard.tsx (showEmpty branch, replacing HomePreviewEmpty there)
 *   Data    → none — pure presentational; `now` (minutes since midnight) passed in by the caller
 *
 * Edit notes:
 *   - Only four labels (evenly spaced via `justifyContent: 'space-between'` in the label
 *     column, not absolute percentage math) — keeps the scale legible without per-hour ticks
 *     crowding into unreadable text at large accessibility font sizes.
 *   - The "now" dot is the one element positioned by percentage (`top`), since it can land
 *     anywhere between two labels; it's hidden outside the [startHour, endHour) window (e.g.
 *     the small hours) rather than clamped to an edge, which would misrepresent the time.
 *   - **Calendar-style ticks + time label (2026-07-26, "make the timeline look more like a
 *     regular calendar")**: each hour label now gets a short horizontal tick running off the
 *     vertical line, reading as a ruled calendar sheet instead of a bare axis + floating text.
 *     `lineCol` also grew a `borderRightWidth` matching PlanTaskCard's rail `lineCol` so the
 *     gutter divider look doesn't change the moment the first task lands and this component is
 *     swapped for the real rail. The "now" dot gained a live "HH:MM" text label (absolutely
 *     positioned at the same `top`, just right of the dot) — this is where PlanTaskCard's own
 *     `topNowStrip` time text lands once the day isn't empty, so the empty state carries the
 *     same live-clock cue instead of a silent dot.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** Minutes since midnight — used to place the live "now" marker. */
  now: number;
  /** Scale window start/end hour (default: typical waking day, 06:00–24:00). */
  startHour?: number;
  endHour?: number;
};

const SCALE_HEIGHT = 96;
// Matches PlanTaskCard's LINE_COL_WIDTH so this empty-state line sits exactly where the real
// rail's time-box column will land once a task is added.
const LINE_COL_WIDTH = 56;

export default function DayHourScale({ now, startHour = 6, endHour = 24 }: Props) {
  const theme = useAppTheme();
  const spanMin = (endHour - startHour) * 60;
  const nowMin = now - startHour * 60;
  const nowPct = spanMin > 0 && nowMin >= 0 && nowMin <= spanMin ? (nowMin / spanMin) * 100 : null;

  const labelCount = 4;
  const labels = Array.from({ length: labelCount }, (_, i) => {
    const h = Math.round(startHour + (i * (endHour - startHour)) / (labelCount - 1)) % 24;
    return String(h).padStart(2, '0');
  });

  const nowLabel = `${String(Math.floor(now / 60) % 24).padStart(2, '0')}:${String(now % 60).padStart(2, '0')}`;

  return (
    <View style={styles.wrap}>
      <View style={[styles.lineCol, { borderRightColor: theme.border }]}>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
        {nowPct !== null && (
          <View style={[styles.nowMarker, { top: `${nowPct}%` }]}>
            <View style={[styles.nowDot, { backgroundColor: theme.accent }]} />
          </View>
        )}
      </View>
      <View style={styles.labelsCol}>
        {labels.map((label, i) => (
          <View key={`${label}-${i}`} style={styles.labelRow}>
            <View style={[styles.tick, { backgroundColor: theme.border }]} />
            <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
          </View>
        ))}
      </View>
      {nowPct !== null && (
        <Text style={[styles.nowLabel, { top: `${nowPct}%`, color: theme.accent }]}>{nowLabel}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', height: SCALE_HEIGHT },
  // No explicit height — stretches to `wrap`'s height via the row's default alignItems:'stretch'
  // (same technique PlanTaskCard's own lineCol/railLine pair uses).
  lineCol: { width: LINE_COL_WIDTH, alignItems: 'center', borderRightWidth: 1 },
  line: { width: 2, flex: 1, borderRadius: 1 },
  nowMarker: { position: 'absolute', left: 0, right: 0, alignItems: 'center', marginTop: -4 },
  nowDot: { width: 8, height: 8, borderRadius: 4 },
  labelsCol: { flex: 1, justifyContent: 'space-between', paddingLeft: Spacing.xs, paddingVertical: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  tick: { width: 6, height: 1 },
  label: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
  // Absolutely positioned over the whole row (RN views are position:'relative' by default, so
  // this anchors to `wrap`) — lands just right of the now-dot without needing lineCol/labelsCol
  // to negotiate width for it.
  nowLabel: { position: 'absolute', left: LINE_COL_WIDTH + Spacing.xs, marginTop: -7, fontSize: FontSize.xs, fontFamily: Fonts.bold },
});
