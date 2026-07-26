/**
 * DayGridLines.tsx — the background of a fixed-hour calendar grid: 24 evenly-spaced
 * horizontal hour lines with "HH:00" labels in a left gutter, plus an optional live "now"
 * line spanning the full width. Pure background, no tasks — shared by DayHourScale (empty
 * day) and PlanTaskCard (populated day) so both draw literally the same grid (2026-07-26,
 * "make the timeline look more like a regular calendar" — Google Calendar's day view was
 * the explicit reference; two earlier passes that kept the proportional/clamped rail and
 * only added borders/ticks didn't land).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, lib/dayGrid
 *   Used by → components/DayHourScale.tsx, components/PlanTaskCard.tsx
 *   Data    → none (pure presentational); `now` optional, minutes since midnight — omit to
 *             hide the now-line entirely (not currently used that way, but supported)
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { GRID_START_HOUR, GRID_END_HOUR, GRID_TOTAL_HEIGHT, GUTTER_WIDTH, minutesToY } from '@/lib/dayGrid';

type Props = {
  now?: number;
};

export default function DayGridLines({ now }: Props) {
  const theme = useAppTheme();
  const hours = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i);
  const nowY = now !== undefined ? minutesToY(now) : null;
  const nowLabel = now !== undefined
    ? `${String(Math.floor(now / 60) % 24).padStart(2, '0')}:${String(now % 60).padStart(2, '0')}`
    : '';

  return (
    <View style={[styles.wrap, { height: GRID_TOTAL_HEIGHT }]}>
      {hours.map((h) => (
        <View key={h} style={[styles.hourRow, { top: minutesToY(h * 60) }]}>
          <Text style={[styles.hourLabel, { color: theme.textMuted }]}>{String(h).padStart(2, '0')}:00</Text>
          <View style={[styles.hourLine, { backgroundColor: theme.border }]} />
        </View>
      ))}
      {nowY !== null && (
        <View style={[styles.nowRow, { top: nowY }]} pointerEvents="none">
          <Text style={[styles.nowLabel, { color: theme.accent }]}>{nowLabel}</Text>
          <View style={styles.nowLineWrap}>
            <View style={[styles.nowDot, { backgroundColor: theme.accent }]} />
            <View style={[styles.nowBar, { backgroundColor: theme.accent }]} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', width: '100%' },
  hourRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  hourLabel: { width: GUTTER_WIDTH, fontSize: FontSize.xs, fontFamily: Fonts.medium, textAlign: 'right', paddingRight: Spacing.xs },
  hourLine: { flex: 1, height: 1 },
  // marginTop centers the line/dot on `top` (nowY) instead of starting there.
  nowRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', marginTop: -7, zIndex: 1 },
  nowLabel: { width: GUTTER_WIDTH, fontSize: FontSize.xs, fontFamily: Fonts.bold, textAlign: 'right', paddingRight: Spacing.xs },
  nowLineWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  nowDot: { width: 8, height: 8, borderRadius: 4 },
  nowBar: { flex: 1, height: 1.5, marginLeft: 4 },
});
