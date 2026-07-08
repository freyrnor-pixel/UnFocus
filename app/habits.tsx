/**
 * habits.tsx — habit tracker
 *
 * Tracks simple habits with daily-goal counters and three views (today / week grid
 * / month grid). Today view is a single unified list (build/break split removed);
 * tapping a card expands a week strip + rest-day toggle. Long-press opens the habit
 * form. The cue→craving→response→reward "atomic habits" steps were removed.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/AppModal,
 *             components/CompletionGlow, components/HabitIcon, components/EmptyState,
 *             components/AddFAB, components/Surface, constants/theme, constants/colors,
 *             lib/date, lib/db, lib/haptics, lib/i18n, lib/useAppTheme,
 *             store/useHabitStore, store/useSettingsStore
 *   Used by → Expo Router route "/habits"; reached via the Health screen's inline
 *             "Habits →" section header (not a BottomNav tab — Decision 036)
 *   Data    → useHabitStore (habits + habit_logs) via increment/decrement/markRestDay;
 *             colour theme + language + child profiles from useSettingsStore
 *
 * Edit notes:
 *   - Decision 001 tier='site' scaffold. The profile selector + view tabs scroll at the top of
 *     the content (the old fixed-below-header placement isn't needed under the scaffold).
 *   - **Habit colours:** single calm palette (build/break removed) — met → `good`,
 *     in-progress → `accent`, empty/zero-progress → `border`, rest-day solid → `textMuted`.
 *     Done-card soft fill → `goodSoft`. Never red. `habitColor()`/`progressColor()` keep a
 *     `kind` param for call-site compatibility but no longer branch on it.
 *   - Several sub-components share one module baseStyles; each calls useScaledStyles itself.
 *   - increment/decrement key off (habitId, today); counts clamp against dailyGoal for ratio.
 *   - No-shame: past zero-progress days show an empty circle in `border`; rest days a solid
 *     `textMuted` dot — computeStreak() treats a rest day as met so resting never breaks a streak.
 *   - Loads its stores on focus; initDb() is idempotent, guarded by a module flag.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useHabitStore, Habit, HabitKind, HabitLog } from '@/store/useHabitStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import CompletionGlow from '@/components/CompletionGlow';
import HabitIcon from '@/components/HabitIcon';
import EmptyState from '@/components/EmptyState';
import { showAppModal } from '@/components/AppModal';
import AddFAB from '@/components/AddFAB';
import Surface from '@/components/Surface';
import { Ionicons } from '@expo/vector-icons';
import { success, warning, heavy, selection } from '@/lib/haptics';
import { initDb } from '@/lib/db';
import { todayStr, dateStr, getWeekDates, getMonthDates } from '@/lib/date';
import { FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import type { ThemePalette } from '@/constants/colors';
import { useAppTheme, useAccessibility, useScaledStyles } from '@/lib/useAppTheme';

let dbBootstrapped = false;

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

// ─── Sub-components ──────────────────────────────────────────────────────────

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
            <Text style={[styles.habitTitle, { color: theme.text }]} numberOfLines={1}>{habit.title}</Text>
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
      <Surface style={styles.emptyCard}>
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
      <Surface style={styles.emptyCard}>
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

// ─── Main screen ──────────────────────────────────────────────────────────────

type ViewTab = 'today' | 'week' | 'month';

export default function HabitsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<ViewTab>('today');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [addingChild, setAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const today = todayStr();

  const habits = useHabitStore((s) => s.habits);
  const logs = useHabitStore((s) => s.logs);
  const loadHabits = useHabitStore((s) => s.load);
  const lang = useSettingsStore((s) => s.language);
  const childProfiles = useSettingsStore((s) => s.childProfiles);
  const updateSettings = useSettingsStore((s) => s.update);
  const loadSettings = useSettingsStore((s) => s.load);
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  useFocusEffect(
    useCallback(() => {
      if (!dbBootstrapped) {
        initDb();
        dbBootstrapped = true;
      }
      loadSettings();
      loadHabits();
    }, [loadSettings, loadHabits])
  );

  const profileHabits = habits.filter((h) => h.childName === selectedProfile);
  const visibleHabits = profileHabits.filter((h) => shouldShowHabitOnDate(h, today));

  const metCount = visibleHabits.filter((h) => {
    const log = logs.find((l) => l.habitId === h.id && l.logDate === today);
    return (log?.count ?? 0) >= h.dailyGoal;
  }).length;

  const onEdit = useCallback((id: string) => {
    router.push({ pathname: '/habit-form', params: { id } });
  }, [router]);

  const tabs: { key: ViewTab; label: string }[] = [
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

  const showProfiles = childProfiles.length > 0 || addingChild;

  return (
    <>
      <ScreenScaffold title={t.habitsTitle} tier="site">
        <View style={styles.content}>
          <HintCard text={t.hints.habits.text} example={t.hints.habits.example} />

          {/* Profile selector */}
          {showProfiles && (
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
                    onLongPress={() => name && removeChild(name)}
                  >
                    <Text style={[styles.profileChipText, { color: isActive ? theme.accentInk : theme.text }]}>
                      {name || t.habitForMe}
                    </Text>
                  </Pressable>
                );
              })}
              {addingChild ? (
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
              )}
            </ScrollView>
          )}
          {!showProfiles && (
            <Pressable style={styles.addChildBtn} onPress={() => setAddingChild(true)}>
              <Text style={[styles.addChildBtnText, { color: theme.textMuted }]}>{t.habitAddChild}</Text>
            </Pressable>
          )}

          {/* View tabs */}
          <View style={[styles.tabs, { backgroundColor: theme.surfaceMuted }]}>
            {tabs.map(({ key, label }) => (
              <Pressable
                key={key}
                style={[styles.tab, tab === key && { backgroundColor: theme.surface }]}
                onPress={() => setTab(key)}
              >
                <Text style={[styles.tabText, { color: theme.textMuted }, tab === key && { color: theme.text }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'today' && (
            <>
              {visibleHabits.length > 0 && (
                <Surface style={styles.summaryChip}>
                  <Text style={[styles.summaryChipText, { color: metCount === visibleHabits.length ? theme.good : theme.textMuted }]}>
                    {metCount} / {visibleHabits.length} {t.habitSummaryLabel}
                  </Text>
                </Surface>
              )}

              {/* Single unified habit list (build/break split removed) */}
              <View style={styles.section}>
                {visibleHabits.length === 0 ? (
                  <Surface style={styles.sectionCard}>
                    <Pressable
                      style={[styles.dashedAdd, { borderColor: theme.border }]}
                      onPress={() => router.push({ pathname: '/habit-form', params: { ...(selectedProfile ? { childName: selectedProfile } : {}) } })}
                    >
                      <Text style={[styles.dashedAddText, { color: theme.textMuted }]}>{t.noHabitsYet}</Text>
                    </Pressable>
                  </Surface>
                ) : (
                  visibleHabits.map((h) => (
                    <HabitCard key={h.id} habit={h} today={today} onEdit={onEdit} lang={lang} theme={theme} />
                  ))
                )}
              </View>
            </>
          )}

          {tab === 'week' && (
            <WeekView
              habits={profileHabits}
              today={today}
              lang={lang}
              theme={theme}
              onAddHabit={() => router.push({ pathname: '/habit-form', params: selectedProfile ? { childName: selectedProfile } : {} })}
            />
          )}
          {tab === 'month' && (
            <MonthView
              habits={profileHabits}
              today={today}
              theme={theme}
              onAddHabit={() => router.push({ pathname: '/habit-form', params: selectedProfile ? { childName: selectedProfile } : {} })}
            />
          )}

          <View style={{ height: 80 }} />
        </View>
      </ScreenScaffold>

      <AddFAB
        onPress={() => router.push({
          pathname: '/habit-form',
          params: selectedProfile ? { childName: selectedProfile } : {},
        })}
        accessibilityLabel={t.health.addHabit}
      />
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
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
  sectionTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  emptyCard: { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', justifyContent: 'center' },
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
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  stepLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    width: 70,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingTop: 1,
  },
  stepArrow: { fontSize: FontSize.xs, paddingTop: 1 },
  stepValue: { flex: 1, fontSize: FontSize.sm, lineHeight: 19 },
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
