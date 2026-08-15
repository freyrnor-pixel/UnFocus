/**
 * DayGridLines.tsx — the background of the day timeline: hour lines with "HH:00" labels in
 * a left gutter, compressed "nothing here" bands for the empty stretches between them, and
 * a live "now" line. Pure background, no tasks.
 *
 * Built on the ELASTIC axis (lib/dayGrid.ts's `buildDayScale`), not a uniform 24h ruler:
 * hours near real content get their own line at full spacing, while an empty stretch
 * collapses into one short dashed band labelled with how long it actually is (2026-07-27,
 * user report: "timeline should be more compressed — empty periods more compressed, while
 * things to do stand out and give a more visual feel for how long in between"). The caller
 * builds the scale once and passes it here AND to its own card positioning, so the lines and
 * the cards can never disagree about where a minute lands.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, lib/dayGrid (DayScale + GUTTER_WIDTH +
 *             NOW_LABEL_WIDTH), lib/i18n (the gap bands' "2 h 30 min" duration label)
 *   Used by → components/PlanTaskCard.tsx (the day timeline's background)
 *   Data    → none (pure presentational); `now` optional, minutes since midnight — omit to
 *             hide the now-line entirely
 *
 * Edit notes:
 *   - **Scale is a prop, never recomputed here (2026-07-27)**: this used to derive every
 *     line from `minutesToY` on its own. With a compressed axis that would be a second,
 *     independently-built scale — one stale rebuild away from lines that don't match the
 *     task cards drawn over them. The caller owns the single `buildDayScale()` result.
 *   - **Now-line order (2026-07-27, user report)**: [line][dot] leading (starting flush with
 *     the grey hour lines via `nowGutterSpacer`, an empty stand-in for the label that used to
 *     occupy that space) with the time label trailing at the line's end.
 *   - **Trailing label column reserved (2026-07-27, user report)**: the hour rows
 *     (`paddingRight`) and the now-label (fixed `width`) both use `NOW_LABEL_WIDTH` from
 *     lib/dayGrid, so every grey line and the blue now-bar stop at the same x and the live
 *     time has that column to itself. Keep the two in sync.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontSize, Fonts, Radius, Spacing, TabularNums } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { DayScale, GUTTER_WIDTH, NOW_LABEL_WIDTH } from '@/lib/dayGrid';

type Props = {
  scale: DayScale;
  now?: number;
};

export default function DayGridLines({ scale, now }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const nowY = now !== undefined ? scale.y(now) : null;
  const nowLabel = now !== undefined
    ? `${String(Math.floor(now / 60) % 24).padStart(2, '0')}:${String(now % 60).padStart(2, '0')}`
    : '';

  return (
    <View style={[styles.wrap, { height: scale.totalHeight }]}>
      {/* Compressed empty stretches — one dashed band each, labelled with the real gap so
          "how long in between" survives the compression. Drawn under the hour lines. */}
      {scale.gaps.map((gap) => (
        <View
          key={`gap-${gap.startMin}`}
          style={[styles.gapBand, { top: gap.y, height: gap.height, borderColor: theme.border }]}
        >
          <Text style={[styles.gapText, { color: theme.textMuted }]} numberOfLines={1}>
            {t.dayViewGapLength(gap.endMin - gap.startMin)}
          </Text>
        </View>
      ))}
      {scale.hourMarks.map((mark) => (
        <View key={`h-${mark.hour}-${Math.round(mark.y)}`} style={[styles.hourRow, { top: mark.y }]}>
          <Text style={[styles.hourLabel, TabularNums, { color: theme.textMuted }]}>{String(mark.hour).padStart(2, '0')}:00</Text>
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
  // A compressed stretch reads as a dashed, inset band rather than a line — visibly "time was
  // folded away here", with its real length spelled out in the middle.
  gapBand: {
    position: 'absolute',
    left: GUTTER_WIDTH,
    right: NOW_LABEL_WIDTH,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  },
  gapText: { fontSize: FontSize.xs },
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
