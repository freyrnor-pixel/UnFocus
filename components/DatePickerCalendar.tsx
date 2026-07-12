/**
 * DatePickerCalendar.tsx — month-grid calendar for picking a YYYY-MM-DD date.
 *
 * Self-contained month calendar with prev/next navigation that highlights the
 * selected day and today. Day/month names are injected via props so the
 * parent owns localization; theming reads from useAppTheme() internally.
 *
 * Connections:
 *   Imports → constants/theme, lib/date, lib/useAppTheme, components/PressableScale
 *   Used by → app/task-form.tsx, app/health-form.tsx
 *   Data    → none (presentational); value/onChange/labels all come from props; scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - dayLabels must be Mon–Sun ordered (7 entries); the grid offsets weeks so Monday is column 0.
 *   - Dates are handled as YYYY-MM-DD strings via toDateStr/parseDateParts — avoid raw Date math to dodge timezone shifts.
 *   - "today" comes from lib/date.ts's todayStr() (shared local-time helper) — don't reintroduce a local copy.
 *   - calendarLabels is optional so existing callers keep compiling without changes; pass it for
 *     screen-reader support and the "jump to today" button (see lib/i18n.ts's `calendar` block for usage).
 *   - "jump to today" only re-centers the visible month; it never calls onChange itself, so it
 *     can't silently overwrite a date the user already picked while browsing other months.
 *   - Theming reads useAppTheme() internally (token remap: white→surface, orange→accent,
 *     text→text, textLight→textMuted, selected-day text '#FFFFFF'→accentInk).
'#FFFFFF'→accentInk.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { todayStr } from '@/lib/date';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import PressableScale from '@/components/PressableScale';

interface CalendarLabels {
  prevMonth: string;
  nextMonth: string;
  jumpToToday: string;
  jumpToTodayHint: string;
  selectedSuffix: string;
  todaySuffix: string;
}

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  dayLabels: string[]; // Mon–Sun (7 entries)
  monthLabels: string[]; // 12 month names
  calendarLabels?: CalendarLabels; // a11y strings + "jump to today" button copy
}

function parseDateParts(s: string): [number, number, number] {
  const parts = s.split('-').map(Number);
  return [parts[0] ?? new Date().getFullYear(), (parts[1] ?? 1) - 1, parts[2] ?? 1];
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function DatePickerCalendar({ value, onChange, dayLabels, monthLabels, calendarLabels }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const [selY, selM, selD] = parseDateParts(value);
  const [viewYear, setViewYear] = useState(selY);
  const [viewMonth, setViewMonth] = useState(selM);

  const today = todayStr();

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  // Navigates the visible month back to today WITHOUT changing the selected date — tapping a day
  // cell is still the only way to select a date, so browsing here never silently discards a pick.
  function jumpToToday() {
    const [ty, tm] = parseDateParts(today);
    setViewYear(ty);
    setViewMonth(tm);
  }

  const isViewingCurrentMonth = (() => {
    const [ty, tm] = parseDateParts(today);
    return viewYear === ty && viewMonth === tm;
  })();

  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const offset = (firstDow + 6) % 7; // shift so Mon=0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <PressableScale
          onPress={prevMonth}
          hitSlop={12}
          style={styles.navBtn}
          accessibilityRole="button"
          accessibilityLabel={calendarLabels?.prevMonth}
          scaleTo={0.9}
        >
          <Text style={[styles.navArrow, { color: theme.accent }]}>‹</Text>
        </PressableScale>
        <Text style={[styles.monthYear, { color: theme.text }]}>
          {monthLabels[viewMonth]} {viewYear}
        </Text>
        <PressableScale
          onPress={nextMonth}
          hitSlop={12}
          style={styles.navBtn}
          accessibilityRole="button"
          accessibilityLabel={calendarLabels?.nextMonth}
          scaleTo={0.9}
        >
          <Text style={[styles.navArrow, { color: theme.accent }]}>›</Text>
        </PressableScale>
      </View>

      {calendarLabels && (
        <PressableScale
          onPress={jumpToToday}
          disabled={isViewingCurrentMonth}
          hitSlop={6}
          style={styles.todayBtn}
          accessibilityRole="button"
          accessibilityLabel={calendarLabels.jumpToTodayHint}
          scaleTo={0.97}
        >
          <Text
            style={[
              styles.todayBtnText,
              { color: theme.accent },
              isViewingCurrentMonth && { color: theme.textMuted },
            ]}
          >
            {calendarLabels.jumpToToday}
          </Text>
        </PressableScale>
      )}

      <View style={styles.weekRow}>
        {dayLabels.map((label, i) => (
          <View key={i} style={styles.cell}>
            <Text style={[styles.weekLabel, { color: theme.textMuted }]}>{label.slice(0, 2)}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.cell} />;
            const ds = toDateStr(viewYear, viewMonth, day);
            const isSelected = ds === value;
            const isToday = ds === today;
            const fullLabel = `${day} ${monthLabels[viewMonth]} ${viewYear}`;
            const suffix = isSelected
              ? calendarLabels?.selectedSuffix
              : isToday
              ? calendarLabels?.todaySuffix
              : undefined;
            return (
              <PressableScale
                key={di}
                style={styles.cell}
                onPress={() => onChange(ds)}
                hitSlop={2}
                accessibilityRole="button"
                accessibilityLabel={suffix ? `${fullLabel}, ${suffix}` : fullLabel}
                accessibilityState={{ selected: isSelected }}
                scaleTo={0.97}
              >
                <View style={[
                  styles.dayCircle,
                  isSelected && { backgroundColor: theme.accent },
                  !isSelected && isToday && { borderWidth: 1.5, borderColor: theme.accent },
                ]}>
                  <Text style={[
                    styles.dayText,
                    { color: theme.text },
                    isSelected && { color: theme.accentInk, fontWeight: '700' },
                    !isSelected && isToday && { color: theme.accent, fontWeight: '600' },
                  ]}>
                    {day}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const CELL = 40;

const baseStyles = StyleSheet.create({
  container: {
    borderRadius: Radius.md,
    padding: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  navBtn: { padding: Spacing.sm },
  navArrow: { fontSize: 26, lineHeight: 30, fontWeight: '300' },
  monthYear: { fontSize: FontSize.md, fontWeight: '700' },
  todayBtn: { alignSelf: 'center', paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, marginBottom: Spacing.xs },
  todayBtnText: { fontSize: FontSize.xs, fontWeight: '600' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around' },
  cell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  weekLabel: { fontSize: FontSize.xs, fontWeight: '600' },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: FontSize.sm },
});
