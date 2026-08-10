/**
 * DayPickerSheet.tsx — "which earlier day?" as a pop-up, plus the shared list of recent days.
 *
 * A short list of the days just gone, newest first. Picking one opens app/day-log.tsx on that
 * date. That screen still works exactly as it did — this only replaces "get there, then chevron
 * backwards until you find the day you meant".
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/Surface, components/PadSheet,
 *             components/PadRow, constants/theme, lib/date (dateStr, formatDisplayDate,
 *             parseDateStr, todayStr), lib/haptics, lib/i18n, lib/useAppTheme,
 *             store/useSettingsStore (language, for the date format)
 *   Used by → app/(tabs)/plans.tsx — both the "Earlier days" drawer's inline preview
 *             (`RecentDaysList`) and the pop-up its title opens (`DayPickerSheet`)
 *   Data    → none of its own. It lists DATES, not entries: reading each day's log here would
 *             mean N `useDayLog` passes to render a menu, and the counts would turn a picker
 *             into a scoreboard of how much each day contained — which the day log deliberately
 *             refuses to be (see lib/dayLog.ts).
 *
 * Edit notes:
 *   - **Two exports, one row shape, on purpose.** `RecentDaysList` is what the drawer shows
 *     inline; `DayPickerSheet` is the same list in a sheet with more of it. A day row therefore
 *     looks identical whether you glanced at it or opened the pop-up — which is the whole point
 *     of the 2026-08-10 "expand shows a preview, the name opens the pop-up" pattern
 *     (components/CollapsedSection.tsx).
 *   - **No counts, no emphasis, no "empty day" marker.** Every row is the same weight. A day
 *     with nothing in it is not a worse day, and a menu that says so before you have opened it
 *     is a verdict — the exact thing lib/dayLog.ts's header rules out. Keep it a list of dates.
 *   - `DAYS_IN_PREVIEW` is small deliberately: the drawer sits under the whole To-do screen, and
 *     a preview that needs its own scroll is not a preview. The sheet shows `DAYS_IN_SHEET`,
 *     still far short of the 365-day retention window — going further back is what the day-log
 *     screen's own chevrons are for.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import Surface from '@/components/Surface';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import { Radius, Spacing } from '@/constants/theme';
import { dateStr, formatDisplayDate, parseDateStr, todayStr } from '@/lib/date';
import { tap } from '@/lib/haptics';
import { useAppTheme } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';

const DAYS_IN_PREVIEW = 5;
const DAYS_IN_SHEET = 14;

/** The `count` days before today, newest first, as YYYY-MM-DD. */
function recentDays(count: number): string[] {
  const today = parseDateStr(todayStr());
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (i + 1));
    return dateStr(d);
  });
}

function useOpenDay() {
  const router = useRouter();
  return (date: string) => {
    tap();
    router.push(`/day-log?date=${date}`);
  };
}

/** One day row, identical in the preview and in the sheet — see the Edit notes. */
function DayRow({ day, accent, onPress }: { day: string; accent: string; onPress: () => void }) {
  const theme = useAppTheme();
  const language = useSettingsStore((s) => s.language);
  return (
    <PadRow
      title={formatDisplayDate(day, language)}
      accent={accent}
      onPress={onPress}
      trailing={<Ionicons name="chevron-forward" size={16} color={theme.textMuted} />}
    />
  );
}

/** The inline preview — the last few days, as rows that open that day. */
export function RecentDaysList({ accent }: { accent: string }) {
  const openDay = useOpenDay();
  const days = useMemo(() => recentDays(DAYS_IN_PREVIEW), []);
  return (
    <PadSheet state="open">
      {days.map((day) => (
        <DayRow key={day} day={day} accent={accent} onPress={() => openDay(day)} />
      ))}
    </PadSheet>
  );
}

export default function DayPickerSheet({
  visible,
  onClose,
  accent,
}: {
  visible: boolean;
  onClose: () => void;
  accent: string;
}) {
  const theme = useAppTheme();
  const openDay = useOpenDay();
  const days = useMemo(() => recentDays(DAYS_IN_SHEET), []);

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <PadSheet state="open">
            {days.map((day) => (
              <DayRow
                key={day}
                day={day}
                accent={accent}
                onPress={() => { openDay(day); onClose(); }}
              />
            ))}
          </PadSheet>
        </ScrollView>
      </Surface>
    </AnimatedBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.md },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: Spacing.md },
});
