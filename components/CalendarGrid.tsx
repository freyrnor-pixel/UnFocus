/**
 * CalendarGrid.tsx — a plain calendar: weekday initials over a grid of day numbers (2026-10-15).
 *
 * Maintainer, 2026-10-15: *"The planner should just look like a normal calendar … Monday,
 * Tuesday, Wednesday and so on seems excessive. It just becomes a lot when you expand it."*
 * The Planner's Calendar section drew one foldable row per weekday (seven tall rows for a week,
 * up to thirty-one for a month). This draws the range as a calendar does — one line for a week,
 * a month as weeks under a Mon–Sun header — and the caller shows the SELECTED day's tasks below.
 *
 * Connections:
 *   Imports → constants/theme, lib/date (dayOfWeekMon0, parseDateStr), lib/useAppTheme,
 *             components/PressableScale
 *   Used by → components/TodoSurface.tsx (the Planner card's Calendar section)
 *   Data    → none; controlled (dates, counts, selected, onSelect from props)
 *
 * Edit notes:
 *   - A month's first row is padded with blank cells up to its first weekday, so every column
 *     is one weekday. A week is already Mon-first (lib/date.ts's getWeekDates) and needs none.
 *   - A dot under the number says "something is planned"; the number itself carries no count.
 *     The selected day's list under the grid is where the count lives.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PressableScale from '@/components/PressableScale';
import { Fonts, FontSize, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { dayOfWeekMon0, parseDateStr } from '@/lib/date';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** Every date in the range, in order (a week's seven or a month's days). */
  dates: string[];
  /** Tasks per date — a dot is drawn where this is > 0. */
  counts: Record<string, number>;
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  /** Short weekday names, Monday first. */
  dayLabels: string[];
  /** Full weekday names, Monday first — the cell's accessibility label. */
  dayFull: string[];
  hue: string;
};

export default function CalendarGrid({ dates, counts, today, selected, onSelect, dayLabels, dayFull, hue }: Props) {
  const theme = useAppTheme();
  if (dates.length === 0) return null;
  const lead = dayOfWeekMon0(parseDateStr(dates[0]));
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...dates];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        {dayLabels.map((label, i) => (
          <Text key={i} style={[styles.head, { color: theme.textMuted }]} numberOfLines={1}>
            {label.slice(0, 2)}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((date, di) => {
            if (!date) return <View key={di} style={styles.cell} />;
            const isSel = date === selected;
            const isToday = date === today;
            const has = (counts[date] ?? 0) > 0;
            return (
              <PressableScale
                key={date}
                style={styles.cell}
                onPress={() => onSelect(date)}
                scaleTo={0.94}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={`${dayFull[di]} ${Number(date.slice(8, 10))}`}
              >
                <View
                  style={[
                    styles.dayDisc,
                    isSel && { backgroundColor: hue },
                    !isSel && isToday && { borderColor: hue, borderWidth: 1.5 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      { color: isSel ? theme.accentInk : theme.text },
                      isToday && styles.dayNumToday,
                    ]}
                  >
                    {Number(date.slice(8, 10))}
                  </Text>
                </View>
                <View style={[styles.dot, { backgroundColor: has ? hue : 'transparent' }]} />
              </PressableScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const DISC = 34;

const styles = StyleSheet.create({
  grid: { gap: 2 },
  row: { flexDirection: 'row' },
  head: { flex: 1, textAlign: 'center', fontSize: FontSize.xs, fontFamily: Fonts.semibold, paddingBottom: Spacing.xs },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: MIN_TAP_TARGET },
  dayDisc: { width: DISC, height: DISC, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
  dayNumToday: { fontFamily: Fonts.bold },
  dot: { width: 5, height: 5, borderRadius: Radius.full, marginTop: 1 },
});
