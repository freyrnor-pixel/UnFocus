/**
 * day-log.tsx — earlier days: the day log for a date that isn't today.
 *
 * The day log itself lives where the day lives — inside the day-view card on Home and the
 * To-do tab, above the now-line (lib/dayLog.ts, components/PlanTaskCard.tsx). This screen
 * exists only for the one thing that card can't hold: stepping back through previous days.
 *
 * It is deliberately the smallest possible surface for that. One day at a time, back and
 * forward, and nothing else:
 *   - **No aggregation across days.** No week view, no month view, no "you did more on
 *     Tuesdays", no chart, no trend, no comparison between days. A day is the unit; two
 *     days compared is a scoreboard, which is the thing this feature is the opposite of.
 *   - **No counting**, here or anywhere in the feature. No total, no "9 things", no rate.
 *   - **No evaluation.** No praise, no summary, no verdict on a quiet day.
 *   - **Nothing to maintain.** Nothing expires, degrades or asks to be tidied. There is no
 *     edit flow: a moment can be deleted and that is the entire mutation surface.
 * If you are about to add a "week" tab here, read the handoff's out-of-scope list first.
 *
 * A past day passes `1440` as the cutoff rather than the current minute — every minute of
 * a day that is over is behind you, so there is no now-line and no forward half to draw.
 * That is the whole reason lib/useDayLog.ts takes the date and the cutoff separately.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/PadSheet + components/PadRow (the same
 *             flush row the in-card log draws, so a past day is not a second visual
 *             language), components/PressableScale, components/Surface, constants/theme,
 *             lib/dayLog (DayEntry/formatEntryTime), lib/useDayLog, lib/date (todayStr,
 *             dateStr, parseDateStr, formatDisplayDate), lib/haptics, lib/i18n,
 *             lib/useAppTheme, lib/domainColor, store/useMomentsStore
 *   Used by → Expo Router route "/day-log", pushed from the day-view card's footer link
 *   Data    → reads through lib/useDayLog (tasks, medicine_doses, health_logs, moments);
 *             writes only useMomentsStore.remove. Schedules nothing.
 *
 * Edit notes:
 *   - **Retention bounds how far back this can usefully go.** pruneOldData() trims dated
 *     history to RETENTION_DAYS (365) on startup, so days beyond that render empty rather
 *     than missing — which is correct and needs no special case, but is worth knowing
 *     before someone "fixes" an empty screen from 2024.
 *   - Forward navigation stops at today: this screen is for days that are over, and the
 *     live day belongs to the card that has the now-line.
 *   - `settings.featureDayLog` gates the log itself (lib/useDayLog returns `undefined`
 *     when it's off, coalesced to `[]` here), so with the flag off this screen renders
 *     its empty state rather than 404ing. That matches app/goals.tsx's rule — a direct
 *     deep link never dead-ends.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import PressableScale from '@/components/PressableScale';
import { FontSize, Fonts, HitSlop, Spacing } from '@/constants/theme';
import { DayEntry, formatEntryTime } from '@/lib/dayLog';
import { useDayLog } from '@/lib/useDayLog';
import { dateStr, formatDisplayDate, parseDateStr, todayStr } from '@/lib/date';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { getDomainColor } from '@/lib/domainColor';
import { useMomentsStore } from '@/store/useMomentsStore';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Every minute of a day that is over is behind you — see the file header. */
const WHOLE_DAY = 1440;

/** Same glyph-per-kind map PlanTaskCard uses, so a past day reads identically to today's. */
const DAY_LOG_ICONS: Record<DayEntry['kind'], keyof typeof Ionicons.glyphMap> = {
  task: 'checkmark-circle-outline',
  habit: 'repeat',
  medicine: 'medkit-outline',
  health: 'pulse-outline',
  moment: 'ellipse-outline',
  calendar: 'calendar-outline',
};

export default function DayLogScreen() {
  const t = useT();
  const theme = useAppTheme();
  const router = useRouter();
  const domainColor = getDomainColor(theme, 'plan');
  const removeMoment = useMomentsStore((s) => s.remove);
  // formatDisplayDate renders DD.MM.YYYY in Norwegian and keeps ISO in English.
  const language = useSettingsStore((s) => s.language);

  const today = todayStr();
  // Opens on yesterday: today already has a home, and this screen is for what's over.
  const [date, setDate] = useState(() => {
    const d = parseDateStr(today);
    d.setDate(d.getDate() - 1);
    return dateStr(d);
  });

  // useDayLog returns undefined (not []) when the flag is off — this screen doesn't
  // care about that distinction, only PlanTaskCard's dayLog-presence gate does.
  const entries = useDayLog(date, WHOLE_DAY) ?? [];

  const step = useCallback((days: number) => {
    tap();
    setDate((current) => {
      const d = parseDateStr(current);
      d.setDate(d.getDate() + days);
      const next = dateStr(d);
      // Forward stops at yesterday — the live day belongs to the card with the now-line.
      return next >= todayStr() ? current : next;
    });
  }, []);

  const canGoForward = useMemo(() => {
    const d = parseDateStr(date);
    d.setDate(d.getDate() + 1);
    return dateStr(d) < today;
  }, [date, today]);

  return (
    <ScreenScaffold title={t.dayLog.earlierDays} tier="site" onBack={() => router.back()}>
      <View style={styles.content}>
        {/* Date stepper. Deliberately a plain back/forward pair rather than a calendar
            picker or a week strip — a grid of days invites comparing them, and this
            feature has no opinion about which day was better. */}
        <View style={styles.dateRow}>
          <PressableScale
            onPress={() => step(-1)}
            hitSlop={HitSlop.base}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel={t.dayLog.earlierDays}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </PressableScale>
          <Text style={[styles.dateLabel, { color: theme.text }]}>
            {formatDisplayDate(date, language)}
          </Text>
          <PressableScale
            onPress={() => step(1)}
            hitSlop={HitSlop.base}
            scaleTo={0.9}
            disabled={!canGoForward}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canGoForward }}
            accessibilityLabel={t.dayLog.title}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              // Rule 11 — the disabled state is carried by opacity AND by the button being
              // genuinely non-pressable + flagged to the screen reader, never colour alone.
              color={canGoForward ? theme.text : theme.textMuted}
              style={canGoForward ? undefined : styles.disabledChevron}
            />
          </PressableScale>
        </View>

        {entries.length === 0 ? (
          // The one first-person line in the app — see VOICE.md. It says why the record
          // exists rather than instructing, which is the only useful thing an empty day
          // can say. No "add something", no encouragement, no verdict on a quiet day.
          <Text style={[styles.empty, { color: theme.textMuted }]}>{t.dayLog.empty}</Text>
        ) : (
          <PadSheet state="open">
            {entries.map((entry) => (
              <PadRow
                key={entry.id}
                title={entry.label}
                accent={domainColor.accent}
                leading={
                  <Ionicons name={DAY_LOG_ICONS[entry.kind]} size={14} color={theme.textMuted} />
                }
                rightValue={formatEntryTime(entry.atMinutes)}
                // No onToggle and no onPress: these already happened, and on a past day
                // there is nothing to tick and nowhere useful to navigate.
                onAction={
                  entry.kind === 'moment'
                    ? () => { tap(); removeMoment(entry.id.replace(/^moment:/, '')); }
                    : undefined
                }
                actionLabel={t.dayLog.deleteMoment}
              />
            ))}
          </PadSheet>
        )}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.lg },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  // flex + minWidth:0 so a long localised date yields before the two chevrons, which have
  // no width to give (the lesson from the task editor's wrap pass, 2026-08-01).
  dateLabel: { flex: 1, minWidth: 0, textAlign: 'center', fontSize: FontSize.md, fontFamily: Fonts.medium },
  disabledChevron: { opacity: 0.4 },
  empty: { fontSize: FontSize.sm, fontFamily: Fonts.regular, lineHeight: 20, paddingVertical: Spacing.lg },
});
