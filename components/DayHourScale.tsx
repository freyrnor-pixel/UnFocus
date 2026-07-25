/**
 * DayHourScale.tsx — compact hour-of-day ruler shown in PlanTaskCard's empty state.
 *
 * A day with zero tasks used to render as pure blank space (HomePreviewEmpty) — which reads
 * as "broken" rather than "empty calendar," since nothing on the card conveyed that this is a
 * day-view at all (user report, 2026-07-25: the Home "Today's Tasks" card showed nothing but
 * the header and the add row). This renders a slim ruler — a line, four evenly-spaced hour
 * labels, and a live "now" marker — so the card reads as a timeline waiting for tasks, not an
 * empty box, even before anything is added.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme
 *   Used by → components/PlanTaskCard.tsx (showEmpty branch, replacing HomePreviewEmpty there)
 *   Data    → none — pure presentational; `now` (minutes since midnight) passed in by the caller
 *
 * Edit notes:
 *   - Only four labels (evenly spaced via `justifyContent: 'space-between'`, not absolute
 *     percentage math) — keeps the ruler legible at Home-preview-card width without per-hour
 *     ticks crowding into unreadable text at large accessibility font sizes.
 *   - The "now" dot is the one element positioned by percentage (`left`), since it can land
 *     anywhere between two labels; it's hidden outside the [startHour, endHour) window (e.g.
 *     the small hours) rather than clamped to an edge, which would misrepresent the time.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** Minutes since midnight — used to place the live "now" marker. */
  now: number;
  /** Ruler window start/end hour (default: typical waking day, 06:00–24:00). */
  startHour?: number;
  endHour?: number;
};

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

  return (
    <View style={styles.wrap}>
      <View style={styles.lineRow}>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
        {nowPct !== null && (
          <View style={[styles.nowMarker, { left: `${nowPct}%` }]}>
            <View style={[styles.nowDot, { backgroundColor: theme.accent }]} />
          </View>
        )}
      </View>
      <View style={styles.labelsRow}>
        {labels.map((label, i) => (
          <Text key={`${label}-${i}`} style={[styles.label, { color: theme.textMuted }]}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: Spacing.xl + Spacing.sm, justifyContent: 'center', gap: Spacing.sm },
  lineRow: { justifyContent: 'center' },
  line: { height: 1.5, borderRadius: 1 },
  nowMarker: { position: 'absolute', top: -4, marginLeft: -4 },
  nowDot: { width: 8, height: 8, borderRadius: 4 },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
});
