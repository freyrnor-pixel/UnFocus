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
 *
 * Edit notes:
 *   - **Now-line order flipped (2026-07-27, user report)**: was [time label][dot][line];
 *     the time label used to sit in the same gutter column as the grey hour labels, reading
 *     as just another hour mark instead of a distinct "now" indicator. Flipped to [line][dot]
 *     leading (still starting flush with the grey hour lines via `nowGutterSpacer`, an empty
 *     stand-in for the label that used to occupy that space) with the time label trailing at
 *     the line's end.
 *   - **Trailing label column reserved (2026-07-27, user report)**: the grey hour lines used to
 *     run the full remaining width, so the trailing blue "HH:MM" reading sat on top of them. The
 *     hour rows (`paddingRight`) and the now-label (fixed `width`) now both use `NOW_LABEL_WIDTH`
 *     from lib/dayGrid, so every grey line and the blue now-bar stop at the same x and the live
 *     time has that column to itself. Keep the two in sync.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontSize, Fonts, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { GRID_START_HOUR, GRID_END_HOUR, GRID_TOTAL_HEIGHT, GUTTER_WIDTH, NOW_LABEL_WIDTH, minutesToY } from '@/lib/dayGrid';

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
          <View style={styles.nowGutterSpacer} />
          <View style={styles.nowLineWrap}>
            <View style={[styles.nowDot, { backgroundColor: theme.accent }]} />
            <View style={[styles.nowBar, { backgroundColor: theme.accent }]} />
          </View>
          <Text numberOfLines={1} style={[styles.nowLabel, { color: theme.accent }]}>{nowLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', width: '100%' },
  // paddingRight reserves the now-label column so a grey hour line stops before the live "HH:MM"
  // reading instead of running underneath it (2026-07-27, user report: "the grey lines are too
  // long, and will overlap with the time showing current time").
  hourRow: { position: 'absolute', left: 0, right: 0, paddingRight: NOW_LABEL_WIDTH, flexDirection: 'row', alignItems: 'center' },
  hourLabel: { width: GUTTER_WIDTH, fontSize: FontSize.xs, fontFamily: Fonts.medium, textAlign: 'right', paddingRight: Spacing.xs },
  hourLine: { flex: 1, height: 1 },
  // marginTop centers the line/dot on `top` (nowY) instead of starting there.
  nowRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', marginTop: -7, zIndex: 1 },
  // Empty spacer matching the hour-label gutter, so the now-line still starts flush with
  // the grey hour lines even though the time label itself moved to the trailing end.
  nowGutterSpacer: { width: GUTTER_WIDTH },
  nowLineWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  nowDot: { width: 8, height: 8, borderRadius: 4 },
  nowBar: { flex: 1, height: 1.5, marginLeft: 4 },
  // Fixed width matching the hour rows' reserved paddingRight, so the blue now-bar ends flush
  // with every grey hour line and the live reading always has that column to itself.
  nowLabel: { width: NOW_LABEL_WIDTH, fontSize: FontSize.xs, fontFamily: Fonts.bold, paddingLeft: Spacing.xs },
});
