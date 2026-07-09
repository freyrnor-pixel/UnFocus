/**
 * health.tsx — health / symptom log (this-week overview) + embedded Habits section
 *
 * Shows only the current Mon–Sun week's symptom activity, grouped by catalog
 * symptom (predefined + custom) with a per-day severity strip. Tapping a
 * symptom's row opens its full history (app/health-detail.tsx). A "Health-log"
 * link opens the sectioned overview of every issue ever logged
 * (app/health-log.tsx), which is also where new entries are added — this
 * screen itself has no symptom-log add affordance (Decision: the old inline "+ Log
 * symptom" FAB + editable card list were removed in favour of a dedicated form).
 *
 * Below the weekly symptom summary sits a full Habits section (today/week/month
 * views, an optional child-profile selector, per-habit cards) — the former
 * standalone /habits screen folded in directly rather than linked out to, so
 * there's no "another site" to navigate to for habits.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/Surface,
 *             components/AddFAB, components/CompletionGlow, components/HabitIcon,
 *             components/EmptyState, components/AppModal,
 *             constants/theme, constants/colors, lib/date, lib/db, lib/haptics, lib/i18n,
 *             lib/severity, lib/useAppTheme, store/useHealthStore, store/useHabitStore,
 *             store/useSettingsStore
 *   Used by → Expo Router route "/health" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx (BottomNav "Health" tab)
 *   Data    → useHealthStore (health_logs + symptoms catalog, read-only here — add/edit/delete
 *             live in app/health-form.tsx); useHabitStore (habits + habit_logs) via
 *             increment/decrement/markRestDay; colour theme + language + child profiles from
 *             useSettingsStore
 *
 * Edit notes:
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome).
 *   - "This week" replaces the old "last 30 days" window — grouping/counting/severity-strip
 *     logic is unchanged, just windowed to `getWeekDates(today)` instead of a 30-day cutoff.
 *   - Grouping key is the symptom id when present, else the (lowercased) ailment string for
 *     legacy rows — same convention as health-log.tsx/health-detail.tsx.
 *   - Add/edit/delete + the per-symptom 90-day history view live in app/health-form.tsx and
 *     app/health-detail.tsx respectively, so the symptom half of this screen is a pure
 *     read-only weekly summary.
 *   - Loads its stores on focus; initDb() is idempotent, guarded by a module flag.
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
 *     (doing the habit is the point, not input). The symptom summary above is NOT filtered
 *     by focus mode — this screen's focus toggle only narrows Habits, since symptoms have
 *     no importance concept.
 *   - **Habit importance** mirrors Task's Decision 018 field (`regular`/`essential`,
 *     app/habit-form.tsx) — an essential habit shows a small star next to its title, same
 *     as PlanTaskCard's task star. It also gates habit *notifications* (see
 *     lib/habitNotifications.ts) via the same persisted `essentialsModeEnabled` setting.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHealthStore, HealthLog } from '@/store/useHealthStore';
import { useHabitStore, Habit, HabitKind, HabitLog } from '@/store/useHabitStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import Surface from '@/components/Surface';
import AddFAB from '@/components/AddFAB';
import CompletionGlow from '@/components/CompletionGlow';
import HabitIcon from '@/components/HabitIcon';
import EmptyState from '@/components/EmptyState';
import { showAppModal } from '@/components/AppModal';
import { useT } from '@/lib/i18n';
import { initDb } from '@/lib/db';
import { todayStr, dateStr, getWeekDates, getMonthDates } from '@/lib/date';
import { SEVERITY_COLORS, severities } from '@/lib/severity';
import { FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import type { ThemePalette } from '@/constants/colors';
import { useAppTheme, useAccessibility, useScaledStyles } from '@/lib/useAppTheme';
import { warning, success, heavy, selection } from '@/lib/haptics';

let dbBootstrapped = false;

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
  const loadLogs = useHealthStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);

  const habits = useHabitStore((s) => s.habits);
  const habitLogs = useHabitStore((s) => s.logs);
  const loadHabits = useHabitStore((s) => s.load);

  const lang = useSettingsStore((s) => s.language);
  const childProfiles = useSettingsStore((s) => s.childProfiles);
  const updateSettings = useSettingsStore((s) => s.update);

  const [hintOpen, setHintOpen] = useState(false);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const SEVERITIES = severities();

  // Habits section state (ported from the removed app/habits.tsx).
  const [habitTab, setHabitTab] = useState<HabitViewTab>('today');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [addingChild, setAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');

  // Focus mode: Health-only, ephemeral, scoped to the Habits section (see header notes).
  const [focusMode, setFocusMode] = useState(false);

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
      return () => { setHintOpen(false); setFocusMode(defaultFocus); };
    }, [loadSettings, loadLogs, loadHabits])
  );

  const today = todayStr();
  const weekDates = getWeekDates(today);

  // Symptoms with at least one entry this week + a per-(symptom,date) max-severity index.
  const { thisWeekSymptoms, severityAt } = useMemo(() => {
    const weekSet = new Set(weekDates);
    const counts: Record<string, { name: string; symptomId: string; ailment: string; count: number }> = {};
    const sevByKey = new Map<string, number>(); // `${groupKey}|${date}` -> max severity
    const groupKeyFor = (l: HealthLog) => l.symptomId || l.ailment.trim().toLowerCase();
    for (const l of logs) {
      const key = groupKeyFor(l);
      if (weekSet.has(l.date)) {
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
      .map(([key, v]) => ({ key, ...v }));
    const severityAt = (key: string, d: string): number | null => sevByKey.get(`${key}|${d}`) ?? null;
    return { thisWeekSymptoms: top, severityAt };
  }, [logs, weekDates]);

  function openDetail(symptomId: string, ailment: string, name: string) {
    router.push({ pathname: '/health-detail', params: { symptomId, ailment, name } });
  }

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
        <View style={styles.content}>
          <HintCard text={t.hints.health.text} open={hintOpen} noPill />

          {/* This week */}
          <Surface style={styles.overviewCardRow}>
            <View style={[styles.overviewAccent, { backgroundColor: theme.featHealth }]} />
            <View style={styles.overviewCardContent}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.thisWeekLabel}</Text>
              {thisWeekSymptoms.length === 0 && (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.noLogsThisWeek}</Text>
              )}
              {thisWeekSymptoms.map((s) => {
                const weekSeverities = weekDates.map((d) => severityAt(s.key, d));
                const maxCount = thisWeekSymptoms[0]?.count ?? 1;
                return (
                  <Pressable
                    key={s.key}
                    style={styles.overviewAilment}
                    onPress={() => openDetail(s.symptomId, s.ailment, s.name)}
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

          {/* Health-log — sectioned overview of every issue ever logged, and where new entries are added */}
          <Pressable
            onPress={() => router.push('/health-log')}
            accessibilityRole="button"
            accessibilityLabel={t.healthLogTitle}
            style={[styles.navLink, { borderTopColor: theme.border }]}
          >
            <Text style={[styles.navLinkText, { color: theme.text }]}>{t.healthLogTitle}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>

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
      </ScreenScaffold>
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  overviewCardRow: { borderRadius: Radius.md, flexDirection: 'row' },
  overviewAccent: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: Radius.md, borderBottomLeftRadius: Radius.md },
  overviewCardContent: { flex: 1, padding: Spacing.md },
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
  emptyText: { fontSize: FontSize.sm },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.sm,
  },
  navLinkText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },

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
