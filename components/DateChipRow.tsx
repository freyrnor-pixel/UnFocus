/**
 * DateChipRow.tsx — Mon–Sun quick-pick chips + a collapsible full calendar
 *
 * The compact date field this app uses inside forms: seven day chips for the current week
 * (the overwhelmingly common case), plus a toggle that reveals the full DatePickerCalendar
 * for anything else. Lifted verbatim out of app/health-form.tsx (2026-08-01) when
 * components/EpisodeCloseSheet.tsx needed the same control — it had been a local
 * subcomponent there, itself copied from app/task-form.tsx's inline date UI.
 *
 * Connections:
 *   Imports → components/PressableScale, components/IconButton, components/Collapsible,
 *             components/DatePickerCalendar, constants/theme, lib/date (dateStr,
 *             dayOfWeekMon0), lib/haptics (tap), lib/i18n, lib/useAppTheme
 *   Used by → app/health-form.tsx (start + end date fields),
 *             components/EpisodeCloseSheet.tsx ("Pick a time" → the stop date)
 *   Data    → none — controlled; the caller owns the `YYYY-MM-DD` value
 *
 * Edit notes:
 *   - `expanded` is lifted so a screen with TWO of these (health-form's start and end) can
 *     keep them independent; don't move it inside.
 *   - The week shown is always the week containing TODAY, not the week containing `value` —
 *     picking a date three weeks back leaves the chips on this week with none active, which
 *     is correct: the calendar below is where that date is visible.
 *   - app/task-form.tsx still has its own inline copy. Folding that one in too is a fine
 *     follow-up, but it was out of scope for the change that extracted this.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PressableScale from '@/components/PressableScale';
import IconButton from '@/components/IconButton';
import Collapsible from '@/components/Collapsible';
import DatePickerCalendar from '@/components/DatePickerCalendar';
import { dateStr, dayOfWeekMon0 } from '@/lib/date';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';

type Props = {
  value: string;
  onChange: (d: string) => void;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
};

export default function DateChipRow({ value, onChange, expanded, setExpanded }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const { dayLabels } = t;

  const weekDays = useMemo(() => {
    const today = new Date();
    const mon0 = dayOfWeekMon0(today);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - mon0 + i);
      return { value: dateStr(d), dayIdx: i, dayNum: d.getDate() };
    });
  }, []);

  return (
    <>
      <View style={styles.weekRow}>
        {weekDays.map((wd) => {
          const active = value === wd.value;
          return (
            <PressableScale
              key={wd.value}
              style={[
                styles.weekChip,
                { backgroundColor: theme.surfaceMuted },
                active && { backgroundColor: theme.accent },
              ]}
              onPress={() => {
                tap();
                onChange(wd.value);
                setExpanded(false);
              }}
              scaleTo={0.97}
            >
              <Text style={[styles.weekChipDay, { color: theme.textMuted }, active && { color: theme.accentInk }]}>
                {dayLabels[wd.dayIdx].slice(0, 2)}
              </Text>
              <Text
                style={[
                  styles.weekChipNum,
                  { color: theme.text },
                  active && { color: theme.accentInk, fontFamily: Fonts.bold },
                ]}
              >
                {wd.dayNum}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <IconButton
        icon="calendar-outline"
        label={expanded ? t.hideCalendar : t.pickOtherDate(value)}
        active={expanded}
        style={styles.calToggleBtn}
        onPress={() => {
          tap();
          setExpanded(!expanded);
        }}
      />
      <Collapsible open={expanded}>
        <DatePickerCalendar
          value={value}
          onChange={(d) => {
            onChange(d);
            setExpanded(false);
          }}
          dayLabels={t.dayLabels}
          monthLabels={t.months}
          calendarLabels={t.calendar}
        />
      </Collapsible>
    </>
  );
}

const baseStyles = StyleSheet.create({
  weekRow: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'space-between' },
  weekChip: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', gap: 2 },
  weekChipDay: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  weekChipNum: { fontSize: FontSize.sm },
  calToggleBtn: { alignSelf: 'flex-start' },
});
