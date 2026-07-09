/**
 * health.tsx — health / symptom log + embedded Habits section
 *
 * Logs symptoms with a date, 1–5 severity and notes, each linked to a catalog
 * symptom (predefined + custom) so trend review groups by symptom rather than
 * free text. Shows a last-30-days overview (top symptoms by frequency, each with a
 * current-week severity strip); tapping a symptom opens its own 90-day history.
 * Below the symptom log sits a full Habits section (today/week/month views, an
 * optional child-profile selector, per-habit cards) — the former standalone /habits
 * screen folded in directly rather than linked out to, so there's no "another site"
 * to navigate to for habits.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/ConfirmationBanner,
 *             components/ExpandableCard, components/AddFAB, components/PressableScale,
 *             components/Surface, components/AppModal, components/CompletionGlow,
 *             components/HabitIcon, components/EmptyState,
 *             constants/theme, constants/colors, lib/date, lib/db, lib/haptics, lib/i18n,
 *             lib/useAppTheme, store/useHealthStore, store/useHabitStore, store/useSettingsStore
 *   Used by → Expo Router route "/health" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx (BottomNav "Health" tab)
 *   Data    → useHealthStore (health_logs + symptoms catalog, incl. add/update/suggest/ensureSymptom);
 *             useHabitStore (habits + habit_logs) via increment/decrement/markRestDay; colour theme +
 *             language + child profiles from useSettingsStore
 *
 * Edit notes:
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome). ConfirmationBanner + a single
 *     floating AddFAB (handleAddLog) for symptom logs — the Habits section gets its own small
 *     inline AddFAB (size="sm") in its own header instead of a second floating FAB.
 *   - **Decision 024 — severity ramp:** SEVERITY_COLORS is a fixed purple→blue 5-step data-viz
 *     ramp, deliberately NOT red/green (no alarm connotation) and theme-independent. Documented
 *     raw-hex exception to Decision 006; paired inks (SEV_INK_DARK/SEV_INK_LIGHT) are fixed too.
 *   - Symptom field is a catalog picker (typeahead over useHealthStore.suggest() + recent chips);
 *     picking/creating sets both `ailment` (display name) and `symptomId` (stable trend key).
 *   - Log list is per-log lifted edit state (`edits`/`openIds`) with no durable draft buffer —
 *     a half-edited log commits straight to useHealthStore.update() on Save.
 *   - `detail` state swaps the whole content for a single-symptom 90-day history + entry list.
 *     The Habits section is hidden while `detail` is shown (it's a health-log drill-down only).
 *   - The date field is a free-text TextInput (no picker) — trusts the YYYY-MM-DD string entered.
 *   - Loads its stores on focus; initDb() is idempotent, guarded by a module flag.
 *   - "Last 30 days" overview card has a 4px `theme.featHealth` left accent stripe
 *     (Surface split into `overviewCardRow`/`overviewAccent`/`overviewCardContent`),
 *     matching the same pattern used by Home's preview cards and Shopping's weekly
 *     card. Section labels ("Last 30/90 days", "Log") render as plain semibold text
 *     (`sectionLabel`), not a pill/chip — kept consistent with Home/Shopping headers.
 *   - **Habits section (ported from the removed app/habits.tsx)**: today/week/month view
 *     tabs, an optional child-profile selector, and per-habit cards (streak, progress dots,
 *     week strip, rest-day toggle) — the same sub-components/helpers habits.tsx used
 *     (HabitCard/WeekView/MonthView, shouldShowHabitOnDate/computeStreak/habitColor/
 *     progressColor), now module-scope in this file instead of their own screen.
 *   - **Focus mode (mirrors Home's Decision 009 #4 / 018 pattern, scoped to Habits only)**:
 *     Health-only, session-ephemeral — its default is seeded from the persisted
 *     `essentialsModeEnabled` setting on every focus-in and resets back to that default on
 *     blur, same as Home. ON: habit cards (today/week/month) are filtered to
 *     `importance === 'essential'`; the "add habit" AddFAB and "add child profile"
 *     affordances hide (no input surfaces in focus, matching Home); a habit card's
 *     long-press-to-edit is disabled but the done/increment/rest-day actions stay live
 *     (doing the habit is the point, not input). The symptom log above is NOT filtered by
 *     focus mode — this screen's focus toggle only narrows Habits, since symptoms have no
 *     importance concept.
 *   - **Habit importance** mirrors Task's Decision 018 field (`regular`/`essential`,
 *     app/habit-form.tsx) — an essential habit shows a small star next to its title, same
 *     as PlanTaskCard's task star. It also gates habit *notifications* (see
 *     lib/habitNotifications.ts) via the same persisted `essentialsModeEnabled` setting.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHealthStore, HealthLog, Symptom } from '@/store/useHealthStore';
import { useHabitStore, Habit, HabitKind, HabitLog } from '@/store/useHabitStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import PressableScale from '@/components/PressableScale';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import Surface from '@/components/Surface';
import ExpandableCard from '@/components/ExpandableCard';
import AddFAB from '@/components/AddFAB';
import CompletionGlow from '@/components/CompletionGlow';
import HabitIcon from '@/components/HabitIcon';
import EmptyState from '@/components/EmptyState';
import { showAppModal } from '@/components/AppModal';
import { useT } from '@/lib/i18n';
import { initDb } from '@/lib/db';
import { todayStr, dateStr, getWeekDates, getMonthDates } from '@/lib/date';
import { FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import type { ThemePalette } from '@/constants/colors';
import { useAppTheme, useAccessibility, useScaledStyles } from '@/lib/useAppTheme';
import { warning, success, heavy, selection } from '@/lib/haptics';

// Decision 024: fixed purple→blue severity family, theme-independent, NOT red/green (no alarm).
const SEVERITY_COLORS = ['#C9D4F0', '#A9B8E8', '#8C9AE0', '#7C82D6', '#6E6BC8'];
const SEV_INK_DARK = '#2A2A3A';
const SEV_INK_LIGHT = '#FFFFFF';

let dbBootstrapped = false;

function severities() {
  return SEVERITY_COLORS.map((color, i) => ({ value: i + 1, color }));
}

type HealthEditFields = { date: string; ailment: string; symptomId: string; severity: number; notes: string };
type HealthEditState = { fields: HealthEditFields; dirty: boolean };
type DetailTarget = { symptomId: string; ailment: string; name: string };

function fieldsFromLog(log: HealthLog): HealthEditFields {
  return { date: log.date, ailment: log.ailment, symptomId: log.symptomId, severity: log.severity, notes: log.notes };
}

/** Last N calendar dates (oldest→newest) as YYYY-MM-DD, for the history sparkline. */
function lastNDates(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const cur = new Date(d);
    cur.setDate(d.getDate() - i);
    out.push(cur.toISOString().slice(0, 10));
  }
  return out;
}

// ─── Habits (ported from the removed app/habits.tsx) ──────────────────────────

// Habits are no longer split into build/break — a single calm "met" colour (good),
// with accent for in-progress and a neutral border for not-yet-started. The `kind`
// param is retained only so existing call sites compile; it no longer affects colour.
function habitColor(_kind: HabitKind, theme: ThemePalette): string {
  return theme.good;
}

function progressColor(ratio: number, _kind: HabitKind, theme: ThemePalette): string {
  if (ratio >= 1) return theme.good;
  if (ratio > 0) return theme.accent;
  // No-shame: zero progress uses a calm neutral border — no red punishment colour.
  return theme.border;
}

/** Determine whether a habit should be shown on a given date based on its recurrence setting. */
function shouldShowHabitOnDate(habit: Habit, dateStr: string): boolean {
  if (habit.recurrence === 'daily') return true;
  if (habit.recurrence === 'one-time') return true;
  if (habit.recurrence === 'weekly') {
    if (habit.recurrenceDays.length === 0) return true;
    const date = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = (date.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
    return habit.recurrenceDays.includes(dayOfWeek);
  }
  if (habit.recurrence === 'monthly') {
    if (habit.recurrenceDays.length === 0) return true;
    const date = new Date(dateStr + 'T12:00:00');
    return date.getDate() === habit.recurrenceDays[0];
  }
  return true;
}

/**
 * Current streak: consecutive met days (count ≥ dailyGoal, or marked as a rest day)
 * ending today (or yesterday if today isn't met yet). Rest days count as met.
 */
function computeStreak(habitId: string, goal: number, today: string, logs: HabitLog[]): number {
  if (goal <= 0) return 0;
  const byDate = new Map<string, HabitLog>();
  for (const l of logs) if (l.habitId === habitId) byDate.set(l.logDate, l);
  const metOn = (date: string) => {
    const log = byDate.get(date);
    if (!log) return false;
    return log.restDay || log.count >= goal;
  };
  let streak = 0;
  const cursor = new Date(today + 'T12:00:00');
  if (!metOn(today)) cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 35; i++) {
    if (metOn(dateStr(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

const DAY_ABBR = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_ABBR_NO = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

function ProgressDots({ count, goal, kind, theme }: { count: number; goal: number; kind: HabitKind; theme: ThemePalette }) {
  const styles = useScaledStyles(baseStyles);
  const dots = Math.min(goal, 8);
  const filled = Math.min(count, dots);
  return (
    <View style={styles.dots}>
      {Array.from({ length: dots }, (_, i) => {
        const isDone = i < filled;
        const color = progressColor(filled / dots, kind, theme);
        return (
          <View
            key={i}
            style={[
              styles.dot,
              { borderColor: color, backgroundColor: isDone ? color : 'transparent' },
            ]}
          />
        );
      })}
    </View>
  );
}

function StreakBadge({ streak, color, theme }: { streak: number; color: string; theme: ThemePalette }) {
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const dots = Math.min(streak, 7);
  return (
    <View style={styles.streakWrap}>
      <View style={styles.streakHead}>
        <Text style={[styles.streakNum, { color }]}>{streak}</Text>
        <Text style={[styles.streakLabel, { color: theme.textMuted }]}>{t.habits.streakLabel}</Text>
      </View>
      {streak > 0 && (
        <View style={styles.streakDots}>
          {Array.from({ length: dots }, (_, i) => (
            <View key={i} style={[styles.streakDot, { backgroundColor: color }]} />
          ))}
        </View>
      )}
    </View>
  );
}

function WeekStrip({
  habitId, today, goal, kind, lang, theme,
}: {
  habitId: string; today: string; goal: number; kind: HabitKind; lang: string; theme: ThemePalette;
}) {
  const logs = useHabitStore((s) => s.logs);
  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const abbr = lang === 'no' ? DAY_ABBR_NO : DAY_ABBR;
  const styles = useScaledStyles(baseStyles);

  return (
    <View style={styles.weekStrip}>
      {weekDates.map((date, i) => {
        const log = logs.find((l) => l.habitId === habitId && l.logDate === date);
        const count = log?.count ?? 0;
        const ratio = goal > 0 ? Math.min(count / goal, 1) : 0;
        const isFuture = date > today;
        const isRest = !!log?.restDay;
        // Rest days get a solid textMuted fill — distinct from both "met" and "missed".
        const color = isFuture ? theme.border : isRest ? theme.textMuted : progressColor(ratio, kind, theme);
        const filled = !isFuture && (isRest || ratio > 0);
        const isToday = date === today;
        return (
          <View key={date} style={styles.dayCol}>
            <Text style={[styles.dayAbbr, { color: theme.textMuted }, isToday && { color: theme.accent, fontFamily: Fonts.bold }]}>{abbr[i]}</Text>
            <View
              style={[
                styles.weekDot,
                { borderColor: color, backgroundColor: filled ? color : 'transparent' },
                isToday && styles.weekDotToday,
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

function HabitCard({
  habit, today, onEdit, lang, theme,
}: {
  habit: Habit; today: string; onEdit: (id: string) => void; lang: string; theme: ThemePalette;
}) {
  const [expanded, setExpanded] = useState(false);
  const logs = useHabitStore((s) => s.logs);
  const increment = useHabitStore((s) => s.increment);
  const decrement = useHabitStore((s) => s.decrement);
  const markRestDay = useHabitStore((s) => s.markRestDay);
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const styles = useScaledStyles(baseStyles);

  const log = logs.find((l) => l.habitId === habit.id && l.logDate === today);
  const count = log?.count ?? 0;
  const isRestToday = log?.restDay ?? false;
  const ratio = habit.dailyGoal > 0 ? Math.min(count / habit.dailyGoal, 1) : 0;
  const isDone = ratio >= 1;

  const accent = habitColor(habit.kind, theme);
  const doneFill = theme.goodSoft;
  const streak = useMemo(
    () => computeStreak(habit.id, habit.dailyGoal, today, logs),
    [habit.id, habit.dailyGoal, today, logs],
  );

  const prevDone = useRef(isDone);
  const [glow, setGlow] = useState(0);
  useEffect(() => {
    if (isDone && !prevDone.current) {
      success();
      setGlow((g) => g + 1);
    }
    prevDone.current = isDone;
  }, [isDone]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isDone && !reducedMotion) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 650, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
        ])
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => { pulseRef.current?.stop(); };
  }, [isDone, reducedMotion]);

  const borderColor = progressColor(ratio, habit.kind, theme);

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      onLongPress={() => onEdit(habit.id)}
    >
      <View
        style={[
          styles.habitCard,
          { borderLeftColor: borderColor, backgroundColor: theme.surface },
          isDone && { backgroundColor: doneFill, borderLeftColor: accent },
        ]}
      >
        <CompletionGlow trigger={glow} color={accent} />

        <View style={styles.cardHeader}>
          <Animated.View style={[styles.habitIcon, { transform: [{ scale: pulseAnim }] }]}>
            {isDone
              ? <Ionicons name="checkmark" size={22} color={accent} />
              : <HabitIcon icon={habit.icon} size={22} color={accent} />}
          </Animated.View>
          <View style={styles.habitTitleWrap}>
            <View style={styles.habitTitleRow}>
              <Text style={[styles.habitTitle, { color: theme.text }]} numberOfLines={1}>{habit.title}</Text>
              {habit.importance === 'essential' && <Ionicons name="star" size={12} color={accent} />}
            </View>
            <View style={styles.titleMetaRow}>
              <StreakBadge streak={streak} color={accent} theme={theme} />
              {isDone && (
                <View style={[styles.donePill, { backgroundColor: accent }]}>
                  <Text style={[styles.donePillText, { color: theme.accentInk }]}>{t.habits.doneToday}</Text>
                </View>
              )}
            </View>
          </View>
          <ProgressDots count={count} goal={habit.dailyGoal} kind={habit.kind} theme={theme} />
          <Pressable
            style={[styles.adjBtn, { backgroundColor: theme.surfaceMuted }]}
            onPress={() => decrement(habit.id, today)}
            hitSlop={8}
          >
            <Text style={[styles.adjBtnText, { color: theme.textMuted }]}>−</Text>
          </Pressable>
          <Pressable
            style={[styles.adjBtn, styles.adjBtnPlus, { backgroundColor: borderColor }]}
            onPress={() => increment(habit.id, today)}
            hitSlop={8}
          >
            <Text style={[styles.adjBtnPlusText, { color: theme.accentInk }]}>+</Text>
          </Pressable>
        </View>

        {expanded && (
          <View style={styles.expanded}>
            <View style={[styles.weekStripWrap, { borderTopColor: theme.border }]}>
              <WeekStrip
                habitId={habit.id}
                today={today}
                goal={habit.dailyGoal}
                kind={habit.kind}
                lang={lang}
                theme={theme}
              />
            </View>
            <Pressable
              style={[
                styles.restDayBtn,
                { borderColor: theme.border },
                isRestToday && { backgroundColor: theme.textMuted, borderColor: theme.textMuted },
              ]}
              onPress={() => {
                selection();
                markRestDay(habit.id, today);
              }}
            >
              <Ionicons name="moon" size={14} color={isRestToday ? theme.textInverse : theme.textMuted} />
              <Text style={[styles.restDayText, { color: isRestToday ? theme.textInverse : theme.textMuted }]}>
                {isRestToday ? t.habits.restingToday : t.habits.restDay}
              </Text>
            </Pressable>
            {isRestToday && (
              <Text style={[styles.restDayHint, { color: theme.textMuted }]}>{t.habits.restDayHint}</Text>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Week overview ───────────────────────────────────────────────────────────

function WeekView({
  habits, today, lang, theme, onAddHabit,
}: {
  habits: Habit[]; today: string; lang: string; theme: ThemePalette; onAddHabit: () => void;
}) {
  const logs = useHabitStore((s) => s.logs);
  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const abbr = lang === 'no' ? DAY_ABBR_NO : DAY_ABBR;
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  const visibleHabits = useMemo(
    () => habits.filter((h) => weekDates.some((d) => shouldShowHabitOnDate(h, d))),
    [habits, weekDates]
  );

  if (visibleHabits.length === 0) {
    return (
      <Surface style={styles.habitsEmptyCard}>
        <EmptyState title={t.noHabitsYet} action={{ label: t.health.addHabit, onPress: onAddHabit }} />
      </Surface>
    );
  }

  return (
    <View style={styles.weekGrid}>
      <View style={styles.weekGridRow}>
        <View style={styles.weekGridLabel} />
        {weekDates.map((date, i) => (
          <View key={date} style={styles.weekGridCell}>
            <Text style={[styles.weekGridDayAbbr, { color: theme.textMuted }, date === today && { color: theme.accent, fontFamily: Fonts.bold }]}>
              {abbr[i]}
            </Text>
            <Text style={[styles.weekGridDate, { color: theme.textMuted }, date === today && { fontFamily: Fonts.bold }]}>
              {date.slice(8)}
            </Text>
          </View>
        ))}
      </View>

      {visibleHabits.map((habit) => (
        <View key={habit.id} style={styles.weekGridRow}>
          <View style={styles.weekGridLabel}>
            <HabitIcon icon={habit.icon} size={16} color={theme.textMuted} />
            <Text style={[styles.weekGridTitle, { color: theme.text }]} numberOfLines={1}>{habit.title}</Text>
          </View>
          {weekDates.map((date) => {
            const log = logs.find((l) => l.habitId === habit.id && l.logDate === date);
            const ratio = habit.dailyGoal > 0 ? Math.min((log?.count ?? 0) / habit.dailyGoal, 1) : 0;
            const isFuture = date > today;
            const color = isFuture ? theme.border : progressColor(ratio, habit.kind, theme);
            const filled = !isFuture && ratio > 0;
            return (
              <View key={date} style={styles.weekGridCell}>
                <View style={[
                  styles.weekGridDot,
                  { backgroundColor: filled ? color : 'transparent', borderColor: isFuture ? theme.border : color },
                ]} />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Month overview ───────────────────────────────────────────────────────────

function MonthView({
  habits, today, theme, onAddHabit,
}: {
  habits: Habit[]; today: string; theme: ThemePalette; onAddHabit: () => void;
}) {
  const logs = useHabitStore((s) => s.logs);
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  const [offset, setOffset] = useState(0);

  const { label, dates } = useMemo(() => {
    const base = new Date(today + 'T12:00:00');
    base.setMonth(base.getMonth() + offset);
    const y = base.getFullYear();
    const m = base.getMonth() + 1;
    return {
      label: `${String(m).padStart(2, '0')} / ${y}`,
      dates: getMonthDates(y, m),
    };
  }, [today, offset]);

  const minOffset = useMemo(() => {
    const cutoff = new Date(today + 'T12:00:00');
    cutoff.setDate(cutoff.getDate() - 35);
    const base = new Date(today + 'T12:00:00');
    return (cutoff.getFullYear() - base.getFullYear()) * 12 + (cutoff.getMonth() - base.getMonth());
  }, [today]);

  const visibleHabits = useMemo(
    () => habits.filter((h) => dates.some((d) => shouldShowHabitOnDate(h, d))),
    [habits, dates]
  );

  if (visibleHabits.length === 0) {
    return (
      <Surface style={styles.habitsEmptyCard}>
        <EmptyState title={t.noHabitsYet} action={{ label: t.health.addHabit, onPress: onAddHabit }} />
      </Surface>
    );
  }

  return (
    <View>
      <View style={styles.monthNav}>
        <Pressable
          onPress={() => setOffset((o) => Math.max(minOffset, o - 1))}
          style={[styles.monthNavBtn, offset <= minOffset && { opacity: 0.3 }]}
          disabled={offset <= minOffset}
        >
          <Text style={[styles.monthNavText, { color: theme.accent }]}>‹</Text>
        </Pressable>
        <Text style={[styles.monthLabel, { color: theme.text }]}>{label}</Text>
        <Pressable
          onPress={() => setOffset((o) => Math.min(0, o + 1))}
          style={[styles.monthNavBtn, offset >= 0 && { opacity: 0.3 }]}
          disabled={offset >= 0}
        >
          <Text style={[styles.monthNavText, { color: theme.accent }]}>›</Text>
        </Pressable>
      </View>

      {visibleHabits.map((habit) => (
        <View key={habit.id} style={[styles.monthRow, { borderBottomColor: theme.border }]}>
          <View style={styles.monthRowLabel}>
            <HabitIcon icon={habit.icon} size={14} color={theme.textMuted} />
            <Text style={[styles.monthRowTitle, { color: theme.text }]} numberOfLines={1}>{habit.title}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.monthDots}>
              {dates.map((date) => {
                const log = logs.find((l) => l.habitId === habit.id && l.logDate === date);
                const ratio = habit.dailyGoal > 0 ? Math.min((log?.count ?? 0) / habit.dailyGoal, 1) : 0;
                const isFuture = date > today;
                const color = isFuture ? theme.border : progressColor(ratio, habit.kind, theme);
                const filled = !isFuture && ratio > 0;
                return (
                  <View key={date} style={styles.monthDotWrap}>
                    <Text style={[styles.monthDotDate, { color: theme.textMuted }]}>{date.slice(8)}</Text>
                    <View style={[
                      styles.monthDot,
                      { borderColor: color, backgroundColor: filled ? color : 'transparent' },
                    ]} />
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

type HabitViewTab = 'today' | 'week' | 'month';

export default function HealthScreen() {
  const router = useRouter();
  const logs = useHealthStore((s) => s.logs);
  const add = useHealthStore((s) => s.add);
  const update = useHealthStore((s) => s.update);
  const remove = useHealthStore((s) => s.remove);
  const loadLogs = useHealthStore((s) => s.load);
  const suggest = useHealthStore((s) => s.suggest);
  const ensureSymptom = useHealthStore((s) => s.ensureSymptom);
  const logsForSymptom = useHealthStore((s) => s.logsForSymptom);

  const habits = useHabitStore((s) => s.habits);
  const habitLogs = useHabitStore((s) => s.logs);
  const loadHabits = useHabitStore((s) => s.load);

  const loadSettings = useSettingsStore((s) => s.load);
  const lang = useSettingsStore((s) => s.language);
  const childProfiles = useSettingsStore((s) => s.childProfiles);
  const updateSettings = useSettingsStore((s) => s.update);

  const [edits, setEdits] = useState<Record<string, HealthEditState>>({});
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [detail, setDetail] = useState<DetailTarget | null>(null);

  // Habits section state (ported from the removed app/habits.tsx).
  const [habitTab, setHabitTab] = useState<HabitViewTab>('today');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [addingChild, setAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');

  // Focus mode: Health-only, ephemeral, scoped to the Habits section (see header notes).
  const [focusMode, setFocusMode] = useState(false);

  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const SEVERITIES = severities();
  const severityLabel = (value: number) => t.severityLabels[value - 1] ?? '';

  useFocusEffect(
    useCallback(() => {
      if (!dbBootstrapped) {
        initDb();
        dbBootstrapped = true;
      }
      loadSettings();
      loadLogs();
      loadHabits();
      // Focus mode's default is the persisted "Focus mode" setting (essentialsModeEnabled),
      // same seeding pattern as Home (app/(tabs)/index.tsx).
      const defaultFocus = useSettingsStore.getState().essentialsModeEnabled;
      setFocusMode(defaultFocus);
      return () => { setHintOpen(false); setDetail(null); setFocusMode(defaultFocus); };
    }, [loadSettings, loadLogs, loadHabits])
  );

  const today = todayStr();
  const weekDates = getWeekDates(today);

  function ensureEdit(logId: string) {
    if (edits[logId]) return;
    const log = logs.find((l) => l.id === logId);
    if (!log) return;
    setEdits((prev) => ({ ...prev, [logId]: { fields: fieldsFromLog(log), dirty: false } }));
  }

  function toggleOpen(logId: string) {
    const wasOpen = !!openIds[logId];
    if (!wasOpen) ensureEdit(logId);
    setOpenIds((prev) => ({ ...prev, [logId]: !wasOpen }));
  }

  function handleFieldChange<K extends keyof HealthEditFields>(logId: string, field: K, value: HealthEditFields[K]) {
    setEdits((prev) => {
      const edit = prev[logId];
      if (!edit) return prev;
      return { ...prev, [logId]: { fields: { ...edit.fields, [field]: value }, dirty: true } };
    });
  }

  /** Picking/typing a symptom sets both the display name and the stable trend key. */
  function handleSymptomText(logId: string, text: string) {
    setEdits((prev) => {
      const edit = prev[logId];
      if (!edit) return prev;
      // Free typing clears the catalog link until a suggestion/new symptom is committed.
      return { ...prev, [logId]: { fields: { ...edit.fields, ailment: text, symptomId: '' }, dirty: true } };
    });
  }

  function handlePickSymptom(logId: string, sym: Symptom) {
    setEdits((prev) => {
      const edit = prev[logId];
      if (!edit) return prev;
      return { ...prev, [logId]: { fields: { ...edit.fields, ailment: sym.name, symptomId: sym.id }, dirty: true } };
    });
  }

  function handleSave(logId: string) {
    const edit = edits[logId];
    if (!edit) return;
    let fields = edit.fields;
    // Commit the symptom to the catalog if the user typed a new name without picking a suggestion.
    if (fields.ailment.trim() && !fields.symptomId) {
      const sym = ensureSymptom(fields.ailment.trim());
      fields = { ...fields, ailment: sym.name, symptomId: sym.id };
    }
    update(logId, fields);
    setEdits((prev) => ({ ...prev, [logId]: { fields, dirty: false } }));
    setConfirm(t.taskSavedSimple);
  }

  function handleDelete(logId: string) {
    remove(logId);
    setEdits((prev) => {
      const next = { ...prev };
      delete next[logId];
      return next;
    });
    setOpenIds((prev) => {
      const next = { ...prev };
      delete next[logId];
      return next;
    });
  }

  function confirmDelete(logId: string, ailment: string) {
    warning();
    showAppModal(t.deleteConfirmTitle(ailment || t.ailmentPlaceholder), t.deleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deleteConfirmBtn, style: 'destructive', onPress: () => handleDelete(logId) },
    ]);
  }

  function handleAddLog() {
    const log = add({ date: todayStr(), ailment: '', symptomId: '', severity: 2, notes: '' });
    setEdits((prev) => ({ ...prev, [log.id]: { fields: fieldsFromLog(log), dirty: false } }));
    setOpenIds((prev) => ({ ...prev, [log.id]: true }));
  }

  // Top symptoms over the last 30 days + a per-(symptom,date) max-severity index, in one pass.
  // Grouping key is the symptom id when present, else the (lowercased) ailment string for legacy rows.
  const { topSymptoms, severityAt } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const counts: Record<string, { name: string; symptomId: string; ailment: string; count: number }> = {};
    const sevByKey = new Map<string, number>(); // `${groupKey}|${date}` -> max severity
    const groupKeyFor = (l: HealthLog) => l.symptomId || l.ailment.trim().toLowerCase();
    for (const l of logs) {
      const key = groupKeyFor(l);
      if (new Date(l.date) >= cutoff) {
        const entry = counts[key] ?? { name: l.ailment, symptomId: l.symptomId, ailment: l.ailment, count: 0 };
        entry.count += 1;
        counts[key] = entry;
      }
      const sk = `${key}|${l.date}`;
      const prev = sevByKey.get(sk);
      sevByKey.set(sk, prev === undefined ? l.severity : Math.max(prev, l.severity));
    }
    const top = Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([key, v]) => ({ key, ...v }));
    const severityAt = (key: string, d: string): number | null => sevByKey.get(`${key}|${d}`) ?? null;
    return { topSymptoms: top, severityAt };
  }, [logs]);

  // ---- Per-symptom history (detail view) ----
  const detailData = useMemo(() => {
    if (!detail) return null;
    const entries = logsForSymptom(detail.symptomId, detail.ailment); // newest-first
    const byDate = new Map<string, number>();
    for (const e of entries) {
      const prev = byDate.get(e.date);
      byDate.set(e.date, prev === undefined ? e.severity : Math.max(prev, e.severity));
    }
    const days = lastNDates(90).map((d) => ({ date: d, sev: byDate.get(d) ?? null }));
    return { entries, days };
  }, [detail, logs, logsForSymptom]);

  // ---- Habits section derived state ----
  const profileHabits = habits.filter((h) => h.childName === selectedProfile);
  // Focus mode narrows every Habits view (today/week/month) to essential habits only.
  const focusFilteredHabits = focusMode ? profileHabits.filter((h) => h.importance === 'essential') : profileHabits;
  const visibleHabits = focusFilteredHabits.filter((h) => shouldShowHabitOnDate(h, today));
  const showHabitProfiles = childProfiles.length > 0 || (addingChild && !focusMode);

  const metCount = visibleHabits.filter((h) => {
    const log = habitLogs.find((l) => l.habitId === h.id && l.logDate === today);
    return (log?.count ?? 0) >= h.dailyGoal;
  }).length;

  const onEditHabit = useCallback((id: string) => {
    // Long-press-to-edit is an input action — disabled in Focus mode, same as
    // Home's Plans preview (Decision 009 #4): only the done/increment actions stay live.
    if (focusMode) return;
    router.push({ pathname: '/habit-form', params: { id } });
  }, [router, focusMode]);

  const habitTabs: { key: HabitViewTab; label: string }[] = [
    { key: 'today', label: t.habitToday },
    { key: 'week', label: t.habitWeekView },
    { key: 'month', label: t.habitMonthView },
  ];

  function addChild() {
    const name = newChildName.trim();
    if (!name) return;
    updateSettings({ childProfiles: [...childProfiles, name] });
    setNewChildName('');
    setAddingChild(false);
  }

  function removeChild(name: string) {
    warning();
    showAppModal(t.habitRemoveChild(name), t.habitRemoveChildBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.resetConfirmBtn, style: 'destructive',
        onPress: () => {
          heavy();
          updateSettings({ childProfiles: childProfiles.filter((c) => c !== name) });
          if (selectedProfile === name) setSelectedProfile('');
        },
      },
    ]);
  }

  function goToHabitForm() {
    router.push({ pathname: '/habit-form', params: selectedProfile ? { childName: selectedProfile } : {} });
  }

  function renderDetail(d: DetailTarget) {
    const data = detailData;
    if (!data) return null;
    return (
      <View style={styles.content}>
        <Pressable onPress={() => setDetail(null)} style={styles.backRow} accessibilityRole="button">
          <Ionicons name="chevron-back" size={18} color={theme.accent} />
          <Text style={[styles.backText, { color: theme.accent }]}>{t.backToLog}</Text>
        </Pressable>

        <Text style={[styles.detailTitle, { color: theme.text }]}>{t.symptomHistoryTitle(d.name)}</Text>
        <Text style={[styles.detailSub, { color: theme.textMuted }]}>{t.symptomEntriesCount(data.entries.length)}</Text>

        {/* 90-day severity sparkline */}
        <Surface style={styles.overviewCard}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.last90Days}</Text>
          <View style={styles.sparkRow}>
            {data.days.map((day) => {
              const color = day.sev ? SEVERITY_COLORS[day.sev - 1] : 'transparent';
              const h = day.sev ? 6 + day.sev * 6 : 3;
              return (
                <View
                  key={day.date}
                  style={[
                    styles.sparkBar,
                    { height: h, backgroundColor: day.sev ? color : theme.surfaceMuted },
                  ]}
                />
              );
            })}
          </View>
        </Surface>

        {/* Entry list */}
        {data.entries.map((e) => {
          const sev = SEVERITIES.find((s) => s.value === e.severity);
          return (
            <Surface key={e.id} style={styles.detailEntry}>
              <View style={styles.detailEntryHead}>
                <Text style={[styles.detailEntryDate, { color: theme.text }]}>{e.date}</Text>
                <View style={[styles.severityBadge, { backgroundColor: sev?.color }]}>
                  <Text style={[styles.severityBadgeText, { color: e.severity >= 3 ? SEV_INK_LIGHT : SEV_INK_DARK }]}>
                    {severityLabel(e.severity)}
                  </Text>
                </View>
              </View>
              {e.notes ? <Text style={[styles.detailEntryNotes, { color: theme.textMuted }]}>{e.notes}</Text> : null}
            </Surface>
          );
        })}
        <View style={{ height: 40 }} />
      </View>
    );
  }

  return (
    <>
      <ScreenScaffold
        title={t.healthTitle}
        tier="site"
        bottomNav={false}
        ownBackground={false}
        focusActive={focusMode}
        onToggleFocus={() => setFocusMode((v) => !v)}
        infoActive={hintOpen}
        onInfoToggle={() => setHintOpen((v) => !v)}
      >
        {detail ? renderDetail(detail) : (
        <View style={styles.content}>
          <HintCard text={t.hints.health.text} open={hintOpen} noPill />
          {/* Overview */}
          {topSymptoms.length > 0 && (
            <Surface style={styles.overviewCardRow}>
              <View style={[styles.overviewAccent, { backgroundColor: theme.featHealth }]} />
              <View style={styles.overviewCardContent}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.last30Days}</Text>
              {topSymptoms.map((s) => {
                const weekSeverities = weekDates.map((d) => severityAt(s.key, d));
                const maxCount = topSymptoms[0]?.count ?? 1;
                return (
                  <Pressable
                    key={s.key}
                    style={styles.overviewAilment}
                    onPress={() => setDetail({ symptomId: s.symptomId, ailment: s.ailment, name: s.name })}
                    accessibilityRole="button"
                    accessibilityLabel={t.symptomHistoryTitle(s.name)}
                  >
                    <View style={styles.overviewRow}>
                      <Text style={[styles.overviewName, { color: theme.text }]}>{s.name}</Text>
                      <View style={[styles.overviewBar, { backgroundColor: theme.surfaceMuted }]}>
                        <View
                          style={[
                            styles.overviewFill,
                            { backgroundColor: SEVERITY_COLORS[2], width: `${Math.min((s.count / maxCount) * 100, 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={[styles.overviewCount, { color: theme.textMuted }]}>{s.count}×</Text>
                      <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                    </View>
                    <View style={styles.ailmentWeekStrip}>
                      {weekDates.map((d, i) => {
                        const sev = weekSeverities[i];
                        const sevColor = sev ? (SEVERITIES.find((x) => x.value === sev)?.color ?? theme.border) : 'transparent';
                        const isFuture = d > today;
                        return (
                          <View key={d} style={styles.ailmentDotCol}>
                            <Text style={[styles.ailmentDayAbbr, { color: theme.textMuted }]}>{t.dayLabels[i][0]}</Text>
                            <View style={[
                              styles.ailmentDot,
                              {
                                backgroundColor: sev ? sevColor : 'transparent',
                                borderColor: isFuture ? theme.border : (sev ? sevColor : theme.border),
                                opacity: isFuture ? 0.3 : 1,
                              },
                            ]} />
                          </View>
                        );
                      })}
                    </View>
                  </Pressable>
                );
              })}
              </View>
            </Surface>
          )}

          {/* Log list */}
          <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.logSection}</Text>
          {logs.length === 0 && (
            <Surface tint={theme.surfaceMuted} style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.noLogsGentle}</Text>
            </Surface>
          )}
          {logs.map((log) => {
            const sev = SEVERITIES.find((s) => s.value === log.severity);
            const fields = edits[log.id]?.fields ?? fieldsFromLog(log);
            const query = fields.symptomId ? '' : fields.ailment;
            const suggestions = query.trim() ? suggest(query) : [];
            const exactMatch = suggestions.some((x) => x.name.toLowerCase() === query.trim().toLowerCase());
            return (
              <ExpandableCard
                key={log.id}
                title={log.ailment || t.ailmentPlaceholder}
                open={!!openIds[log.id]}
                onToggle={() => toggleOpen(log.id)}
                leadingAction={
                  <View style={[styles.severityBadge, { backgroundColor: sev?.color }]}>
                    <Text style={[styles.severityBadgeText, { color: log.severity >= 3 ? SEV_INK_LIGHT : SEV_INK_DARK }]}>
                      {severityLabel(log.severity)}
                    </Text>
                  </View>
                }
              >
                <View style={styles.fieldsWrap}>
                  <View style={styles.field}>
                    <Text style={[styles.formLabel, { color: theme.textMuted }]}>{t.dateLabel}</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                      value={fields.date}
                      onChangeText={(v) => handleFieldChange(log.id, 'date', v)}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.formLabel, { color: theme.textMuted }]}>{t.ailmentLabel}</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                      value={fields.ailment}
                      onChangeText={(v) => handleSymptomText(log.id, v)}
                      placeholder={t.symptomSearchPlaceholder}
                      placeholderTextColor={theme.textMuted}
                    />
                    {/* Typeahead over the catalog + "Add new" when no exact match */}
                    {suggestions.length > 0 && (
                      <View style={styles.suggestList}>
                        {suggestions.map((sug) => (
                          <Pressable
                            key={sug.id}
                            style={[styles.suggestRow, { borderTopColor: theme.border }]}
                            onPress={() => handlePickSymptom(log.id, sug)}
                          >
                            <Text style={[styles.suggestName, { color: theme.text }]}>{sug.name}</Text>
                            <Text style={[styles.suggestCat, { color: theme.textMuted }]}>
                              {t.symptomCategories[sug.category] ?? sug.category}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    {query.trim() && !exactMatch && (
                      <Pressable
                        style={[styles.addSymptomRow, { backgroundColor: theme.surfaceMuted }]}
                        onPress={() => handlePickSymptom(log.id, ensureSymptom(query.trim()))}
                      >
                        <Ionicons name="add" size={16} color={theme.accent} />
                        <Text style={[styles.addSymptomText, { color: theme.accent }]}>{t.addSymptomOption(query.trim())}</Text>
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.formLabel, { color: theme.textMuted }]}>{t.severityLabel}</Text>
                    <View style={styles.severityRow}>
                      {SEVERITIES.map((s) => {
                        const active = fields.severity === s.value;
                        const fg = s.value >= 3 ? SEV_INK_LIGHT : SEV_INK_DARK;
                        return (
                          <PressableScale
                            key={s.value}
                            style={[
                              styles.severityTarget,
                              { backgroundColor: s.color },
                              active && [styles.severityActive, { borderColor: theme.text }],
                            ]}
                            onPress={() => handleFieldChange(log.id, 'severity', s.value)}
                          >
                            <Text style={[styles.severityNum, { color: fg }]}>{s.value}</Text>
                            <Text style={[styles.severityTargetLabel, { color: fg }]} numberOfLines={1}>
                              {severityLabel(s.value)}
                            </Text>
                          </PressableScale>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.formLabel, { color: theme.textMuted }]}>{t.notesLabel}</Text>
                    <TextInput
                      style={[styles.input, styles.notesInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                      value={fields.notes}
                      onChangeText={(v) => handleFieldChange(log.id, 'notes', v)}
                      placeholder={t.notesPlaceholder}
                      placeholderTextColor={theme.textMuted}
                      multiline
                    />
                  </View>

                  {edits[log.id]?.dirty ? (
                    <Pressable style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={() => handleSave(log.id)}>
                      <Text style={[styles.saveBtnText, { color: theme.accentInk }]}>{t.save}</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={[styles.deleteBtn, { backgroundColor: theme.badSoft }]}
                    onPress={() => confirmDelete(log.id, fields.ailment)}
                  >
                    <Text style={[styles.deleteBtnText, { color: theme.bad }]}>{t.deleteLogBtn}</Text>
                  </Pressable>
                </View>
              </ExpandableCard>
            );
          })}

          {/* Habits — embedded section (no separate /habits screen; ported in full). */}
          <View style={styles.habitsSection}>
            <View style={styles.habitsSectionHeader}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.habitsTitle}</Text>
              {!focusMode && (
                <AddFAB size="sm" onPress={goToHabitForm} accessibilityLabel={t.health.addHabit} />
              )}
            </View>

            {showHabitProfiles && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.profileRow}
              >
                {(['', ...childProfiles] as string[]).map((name) => {
                  const isActive = selectedProfile === name;
                  return (
                    <Pressable
                      key={name || '__me__'}
                      style={[
                        styles.profileChip,
                        { backgroundColor: isActive ? theme.accent : theme.surfaceMuted },
                      ]}
                      onPress={() => setSelectedProfile(name)}
                      onLongPress={() => !focusMode && name && removeChild(name)}
                    >
                      <Text style={[styles.profileChipText, { color: isActive ? theme.accentInk : theme.text }]}>
                        {name || t.habitForMe}
                      </Text>
                    </Pressable>
                  );
                })}
                {!focusMode && (addingChild ? (
                  <View style={[styles.profileChip, styles.addChildRow, { backgroundColor: theme.surface }]}>
                    <TextInput
                      style={[styles.addChildInput, { color: theme.text }]}
                      value={newChildName}
                      onChangeText={setNewChildName}
                      placeholder={t.habitAddChildPlaceholder}
                      placeholderTextColor={theme.textMuted}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={addChild}
                    />
                    <Pressable onPress={addChild}>
                      <Text style={[styles.addChildConfirm, { color: theme.accent }]}>✓</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.profileChip, { backgroundColor: theme.surfaceMuted, borderStyle: 'dashed', borderWidth: 1, borderColor: theme.border }]}
                    onPress={() => setAddingChild(true)}
                  >
                    <Text style={[styles.profileChipText, { color: theme.textMuted }]}>{t.habitAddChild}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {!showHabitProfiles && !focusMode && (
              <Pressable style={styles.addChildBtn} onPress={() => setAddingChild(true)}>
                <Text style={[styles.addChildBtnText, { color: theme.textMuted }]}>{t.habitAddChild}</Text>
              </Pressable>
            )}

            {/* View tabs */}
            <View style={[styles.tabs, { backgroundColor: theme.surfaceMuted }]}>
              {habitTabs.map(({ key, label }) => (
                <Pressable
                  key={key}
                  style={[styles.tab, habitTab === key && { backgroundColor: theme.surface }]}
                  onPress={() => setHabitTab(key)}
                >
                  <Text style={[styles.tabText, { color: theme.textMuted }, habitTab === key && { color: theme.text }]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {habitTab === 'today' && (
              <>
                {visibleHabits.length > 0 && (
                  <Surface style={styles.summaryChip}>
                    <Text style={[styles.summaryChipText, { color: metCount === visibleHabits.length ? theme.good : theme.textMuted }]}>
                      {metCount} / {visibleHabits.length} {t.habitSummaryLabel}
                    </Text>
                  </Surface>
                )}

                <View style={styles.section}>
                  {visibleHabits.length === 0 ? (
                    <Surface style={styles.sectionCard}>
                      {focusMode ? (
                        <Text style={[styles.dashedAddText, { color: theme.textMuted }]}>{t.noHabitsYet}</Text>
                      ) : (
                        <Pressable style={[styles.dashedAdd, { borderColor: theme.border }]} onPress={goToHabitForm}>
                          <Text style={[styles.dashedAddText, { color: theme.textMuted }]}>{t.noHabitsYet}</Text>
                        </Pressable>
                      )}
                    </Surface>
                  ) : (
                    visibleHabits.map((h) => (
                      <HabitCard key={h.id} habit={h} today={today} onEdit={onEditHabit} lang={lang} theme={theme} />
                    ))
                  )}
                </View>
              </>
            )}

            {habitTab === 'week' && (
              <WeekView
                habits={focusFilteredHabits}
                today={today}
                lang={lang}
                theme={theme}
                onAddHabit={goToHabitForm}
              />
            )}
            {habitTab === 'month' && (
              <MonthView
                habits={focusFilteredHabits}
                today={today}
                theme={theme}
                onAddHabit={goToHabitForm}
              />
            )}
          </View>

          <View style={{ height: 80 }} />
        </View>
        )}
      </ScreenScaffold>

      {!detail && <AddFAB onPress={handleAddLog} accessibilityLabel={t.logSymptomTrigger} />}
      <ConfirmationBanner message={confirm} onDismiss={() => setConfirm(null)} />
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  overviewCardRow: { borderRadius: Radius.md, flexDirection: 'row' },
  overviewAccent: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: Radius.md, borderBottomLeftRadius: Radius.md },
  overviewCardContent: { flex: 1, padding: Spacing.md },
  overviewCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  sectionLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold, marginBottom: Spacing.xs },
  overviewAilment: { marginTop: Spacing.sm },
  overviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  ailmentWeekStrip: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 5,
    paddingLeft: 2,
  },
  ailmentDotCol: { alignItems: 'center', gap: 2 },
  ailmentDayAbbr: { fontSize: 7, fontFamily: Fonts.semibold },
  ailmentDot: { width: 9, height: 9, borderRadius: Radius.full, borderWidth: 1.5 },
  overviewName: { fontSize: FontSize.sm, width: 100 },
  overviewBar: {
    flex: 1,
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  overviewFill: { height: 8, borderRadius: Radius.full },
  overviewCount: { fontSize: FontSize.xs, width: 28, textAlign: 'right' },
  fieldsWrap: { gap: Spacing.md },
  field: { gap: Spacing.xs },
  formLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  input: {
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    fontSize: FontSize.md,
    marginTop: 4,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  suggestList: { marginTop: 4, borderRadius: Radius.sm, overflow: 'hidden' },
  suggestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  suggestName: { fontSize: FontSize.md },
  suggestCat: { fontSize: FontSize.xs },
  addSymptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 4,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  addSymptomText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  severityRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  severityTarget: {
    flex: 1,
    minHeight: 60,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: 2,
    gap: 2,
  },
  severityActive: { borderWidth: 2 },
  severityNum: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  severityTargetLabel: { fontSize: 11, fontFamily: Fonts.semibold, textAlign: 'center' },
  saveBtn: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  saveBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
  deleteBtn: { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  deleteBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
  emptyCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  emptyText: { fontSize: FontSize.sm },
  severityBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  severityBadgeText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  // Detail (per-symptom history)
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  detailTitle: { fontSize: FontSize.xl, fontFamily: Fonts.bold },
  detailSub: { fontSize: FontSize.sm, marginTop: -Spacing.xs },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    marginTop: Spacing.sm,
    minHeight: 40,
  },
  sparkBar: { flex: 1, borderRadius: 1 },
  detailEntry: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  detailEntryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailEntryDate: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  detailEntryNotes: { fontSize: FontSize.sm },

  // ─── Habits section (ported from the removed app/habits.tsx) ─────────────────
  habitsSection: { gap: Spacing.md, marginTop: Spacing.sm },
  habitsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileRow: {
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  profileChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  profileChipText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  addChildRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  addChildInput: { fontSize: FontSize.sm, minWidth: 80 },
  addChildConfirm: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  addChildBtn: {
    paddingBottom: Spacing.xs,
  },
  addChildBtnText: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
  tabs: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 3,
    gap: 3,
  },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, alignItems: 'center' },
  tabText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  section: { gap: Spacing.sm },
  habitsEmptyCard: { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  sectionCard: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  summaryChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    alignSelf: 'center',
  },
  summaryChipText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  dashedAdd: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  dashedAddText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },

  // Habit card
  habitCard: {
    borderRadius: Radius.md,
    borderLeftWidth: 5,
    padding: Spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  habitIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  habitTitleWrap: { flex: 1 },
  habitTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  habitTitle: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  titleMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2, flexWrap: 'wrap' },
  streakWrap: { gap: 2 },
  streakHead: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  streakNum: { fontSize: FontSize.lg, fontFamily: Fonts.extrabold },
  streakLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  streakDots: { flexDirection: 'row', gap: 3 },
  streakDot: { width: 6, height: 6, borderRadius: Radius.full },
  donePill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  donePillText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  dots: { flexDirection: 'row', gap: 3 },
  dot: {
    width: 9, height: 9,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  adjBtn: {
    width: 30, height: 30,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjBtnText: { fontSize: FontSize.lg, lineHeight: 30 },
  adjBtnPlus: {},
  adjBtnPlusText: { fontSize: FontSize.lg, fontFamily: Fonts.bold, lineHeight: 30 },

  // Expanded content
  expanded: { marginTop: Spacing.sm, gap: Spacing.xs },
  weekStripWrap: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  restDayBtn: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  restDayText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  restDayHint: { fontSize: FontSize.xs, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
  dayCol: { alignItems: 'center', gap: 3 },
  dayAbbr: { fontSize: 9, fontFamily: Fonts.semibold },
  weekDot: {
    width: 12, height: 12, borderRadius: Radius.full, borderWidth: 1.5,
  },
  weekDotToday: { borderWidth: 2 },

  // Week grid view
  weekGrid: { gap: 2 },
  weekGridRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  weekGridLabel: {
    width: 110, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: Spacing.xs,
  },
  weekGridTitle: { flex: 1, fontSize: FontSize.xs, fontFamily: Fonts.medium },
  weekGridCell: { flex: 1, alignItems: 'center', gap: 2 },
  weekGridDayAbbr: { fontSize: 9 },
  weekGridDate: { fontSize: 9 },
  weekGridDot: {
    width: 14, height: 14, borderRadius: Radius.full, borderWidth: 1.5,
  },

  // Month view
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  monthNavBtn: { padding: Spacing.sm },
  monthNavText: { fontSize: FontSize.xl, fontFamily: Fonts.bold },
  monthLabel: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  monthRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
  },
  monthRowLabel: { width: 90, flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthRowTitle: { flex: 1, fontSize: FontSize.xs, fontFamily: Fonts.medium },
  monthDots: { flexDirection: 'row', gap: 3, paddingHorizontal: Spacing.xs },
  monthDotWrap: { alignItems: 'center', gap: 2 },
  monthDotDate: { fontSize: 7 },
  monthDot: { width: 8, height: 8, borderRadius: Radius.full, borderWidth: 1 },
});
