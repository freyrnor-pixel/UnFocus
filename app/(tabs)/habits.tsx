/**
 * habits.tsx — Habits (today/week/month tracking), its own bottom-nav tab.
 *
 * Today/week/month view tabs, an optional child-profile selector, and per-habit cards
 * (progress dots, week strip, rest-day toggle, quick-add).
 *
 * **Split out of app/(tabs)/health.tsx (2026-07-23, UX audit finding E1)**: Habits used
 * to be embedded inside the Health tab — but Health's tab name/icon promised symptom
 * tracking, and a whole separate habit-building system living inside it was a
 * name-vs-content mismatch a user had to learn by accident. This file is that embedded
 * section, unchanged in behavior, promoted back to its own bottom-nav tab (replacing
 * Scan — see lib/siteNav.ts's Edit notes for the full E1/E2 rationale). Health keeps
 * only its symptom-tracking content.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/Surface,
 *             components/SectionCard, components/AddRow, components/AnimatedListItem (habit
 *             add/remove fade), components/GlowPulse (done-state static halo),
 *             components/HabitIcon, components/EmptyState, components/SlideSelector,
 *             components/PressableScale, components/IconButton (per-row habit edit button),
 *             components/GoalGlowDot (goal glow), components/DebugNoteAnchor,
 *             constants/theme, lib/date, lib/haptics, lib/i18n, lib/useAppTheme,
 *             lib/useFirstVisitHint, lib/domainColor, lib/screenColor, lib/habitRecurrence,
 *             store/useHabitStore, store/useGoalStore, store/useSettingsStore
 *   - Habit Today/Week/Month uses the shared SlideSelector; the person filter row +
 *     habit-form "For" chips are gated on settings.peopleModeEnabled (People/family
 *     mode). Profile add/remove lives in app/settings.tsx, not here.
 *   Used by → Expo Router route "/habits" — one of 5 co-mounted pager tabs under
 *             app/(tabs)/_layout.tsx (BottomNav "Habits" tab)
 *   Data    → useHabitStore (habits + habit_logs) via increment/decrement/markRestDay/add;
 *             colour theme + language + child profiles from useSettingsStore; useGoalStore
 *             (linked goal glow only)
 *
 * Edit notes:
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome).
 *   - **No streaks (2026-07-20)**: the habit card shows an Energy badge (habit.energyValue,
 *     from the optional Energy system, lib/energy.ts) instead of a streak counter — only
 *     for habits with `energyEnabled`. Rest day no longer needs to "protect" anything (it
 *     never drove Energy) — see lib/energy.ts's habitMetOn for the exemption.
 *   - **Add-habit affordance (2026-07-13 rows pass)**: an inline `AddRow` at the bottom of
 *     the Today habit list is the add-habit trigger — a title-only quick-create with sensible
 *     defaults (icon/goal/recurrence via `commitHabit` → useHabitStore.add), matching Plans'
 *     AddRow → addTask flow; tap a habit card's settings-gear icon (2026-07-21, replaced
 *     long-press) to edit the rest in /habit-form. This
 *     replaced the old header "+" AddFAB (which navigated straight to the form). Week/Month
 *     views show plain, non-interactive empty-state text (they dropped their `onAddHabit` prop).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHabitStore, Habit, HabitKind } from '@/store/useHabitStore';
import { useGoalStore } from '@/store/useGoalStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import Surface from '@/components/Surface';
import SectionCard from '@/components/SectionCard';
import AddRow from '@/components/AddRow';
import AnimatedListItem from '@/components/AnimatedListItem';
import Collapsible from '@/components/Collapsible';
import GlowPulse from '@/components/GlowPulse';
import HabitIcon from '@/components/HabitIcon';
import { GoalGlowDot } from '@/components/GoalGlowDot';
import EmptyState from '@/components/EmptyState';
import SlideSelector from '@/components/SlideSelector';
import PressableScale from '@/components/PressableScale';
import IconButton from '@/components/IconButton';
import { useT } from '@/lib/i18n';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { todayStr, getWeekDates, getMonthDates } from '@/lib/date';
import { habitOccursOn, habitProgress } from '@/lib/habitRecurrence';
import { FontSize, Radius, Shadow, Spacing, Fonts, Type } from '@/constants/theme';
import type { ThemePalette } from '@/constants/colors';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { getDomainColor } from '@/lib/domainColor';
import { getScreenColor } from '@/lib/screenColor';
import { success, selection } from '@/lib/haptics';

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

// shouldShowHabitOnDate lived here; now lib/habitRecurrence.ts's habitOccursOn (also
// used by lib/energy.ts and lib/widgets/sync.ts, so the "is this due" logic exists
// in exactly one place, including 'weekly-flexible' support).

/**
 * A single day's dot-fill ratio for the Week/Month grids and WeekStrip. For a
 * `weekly-flexible` habit each day is binary (did anything get logged that day?) —
 * dividing by the weekly goal would leave every day's dot barely filled. Fixed-
 * schedule habits keep the existing count/dailyGoal ratio.
 */
function dotRatio(habit: Habit, count: number): number {
  if (habit.recurrence === 'weekly-flexible') return count > 0 ? 1 : 0;
  return habit.dailyGoal > 0 ? Math.min(count / habit.dailyGoal, 1) : 0;
}

const DAY_ABBR = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_ABBR_NO = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

// No streaks (2026-07-20) — habits with the optional Energy system enabled show their
// signed energy value instead (positive restores the day's/week's budget, negative drains
// it — lib/energy.ts). Habits without energyEnabled show nothing here.
function EnergyBadge({ value, theme }: { value: number; theme: ThemePalette }) {
  const styles = useScaledStyles(baseStyles);
  const positive = value >= 0;
  const color = positive ? theme.good : theme.bad;
  return (
    <View style={[styles.energyPill, { borderColor: color }]}>
      <Ionicons name="battery-charging-outline" size={11} color={color} />
      <Text style={[styles.energyPillText, { color }]}>{positive ? `+${value}` : `${value}`}</Text>
    </View>
  );
}

function WeekStrip({
  habit, today, kind, lang, theme,
}: {
  habit: Habit; today: string; kind: HabitKind; lang: string; theme: ThemePalette;
}) {
  const logs = useHabitStore((s) => s.logs);
  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const abbr = lang === 'no' ? DAY_ABBR_NO : DAY_ABBR;
  const styles = useScaledStyles(baseStyles);

  return (
    <View style={styles.weekStrip}>
      {weekDates.map((date, i) => {
        const log = logs.find((l) => l.habitId === habit.id && l.logDate === date);
        const count = log?.count ?? 0;
        const ratio = dotRatio(habit, count);
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
  // Goals — the linked goal (if any), for the living-glow dot next to the title.
  const linkedGoal = useGoalStore((s) => (habit.goalId ? s.goals.find((g) => g.id === habit.goalId) ?? null : null));
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  const log = logs.find((l) => l.habitId === habit.id && l.logDate === today);
  const isRestToday = log?.restDay ?? false;
  const { count, goal, ratio, isDone } = habitProgress(habit, logs, today);
  const isWeeklyFlexible = habit.recurrence === 'weekly-flexible';

  const accent = habitColor(habit.kind, theme);

  const prevDone = useRef(isDone);
  useEffect(() => {
    if (isDone && !prevDone.current) {
      success();
    }
    prevDone.current = isDone;
  }, [isDone]);

  // Decision 043 rule 3 / Decision 014 downstream to-do: progress/done state reads from
  // the 4px accent bar only — the card body stays theme.surface regardless of state
  // (donePill/checkmark already carry the "done" signal).
  const barColor = isDone ? accent : progressColor(ratio, habit.kind, theme);

  return (
    <PressableScale
      onPress={() => setExpanded((v) => !v)}
      scaleTo={0.97}
    >
      <View style={styles.habitGlowWrap}>
      <GlowPulse active={isDone} color={accent} mode="static" radius={Radius.md} />
      <View style={[styles.habitCard, { backgroundColor: theme.surface }]}>
        <View style={[styles.habitAccent, { backgroundColor: barColor }]} />
        <View style={styles.habitCardContent}>

        <View style={styles.cardHeader}>
          <View style={styles.habitIcon}>
            {isDone
              ? <Ionicons name="checkmark" size={22} color={accent} />
              : <HabitIcon icon={habit.icon} size={22} color={accent} />}
          </View>
          <View style={styles.habitTitleWrap}>
            <View style={styles.habitTitleRow}>
              <Text style={[styles.habitTitle, { color: theme.text }]} numberOfLines={1}>{habit.title}</Text>
              {linkedGoal ? (
                <GoalGlowDot color={linkedGoal.color} strength={linkedGoal.strength} strengthUpdatedAt={linkedGoal.strengthUpdatedAt} size={9} />
              ) : null}
            </View>
            <View style={styles.titleMetaRow}>
              {isWeeklyFlexible && (
                <Text style={[styles.weeklyProgressText, { color: theme.textMuted }]}>
                  {t.habits.weeklyProgress(count, goal)}
                </Text>
              )}
              {isDone && (
                <View style={[styles.donePill, { backgroundColor: accent }]}>
                  <Text style={[styles.donePillText, { color: theme.accentInk }]}>{t.habits.doneToday}</Text>
                </View>
              )}
            </View>
          </View>
          <IconButton
            icon="settings-outline"
            label={t.habits.editButtonLabel}
            onPress={() => onEdit(habit.id)}
            size={26}
            tint="transparent"
            color={theme.textMuted}
          />
          {/* Small progress-dots circle replaced with the Energy +/- indicator (debug-note
              2026-07-21) — informational, shown only when this habit opts into Energy. */}
          {habit.energyEnabled && <EnergyBadge value={habit.energyValue} theme={theme} />}
          <PressableScale
            style={[styles.adjBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => decrement(habit.id, today)}
            hitSlop={8}
            scaleTo={0.9}
          >
            <Text style={[styles.adjBtnText, { color: theme.textMuted }]}>−</Text>
          </PressableScale>
          <PressableScale
            style={[styles.adjBtn, styles.adjBtnPlus, { backgroundColor: barColor }]}
            onPress={() => increment(habit.id, today)}
            hitSlop={8}
            scaleTo={0.9}
          >
            <Text style={[styles.adjBtnPlusText, { color: theme.accentInk }]}>+</Text>
          </PressableScale>
        </View>

        {expanded && (
          <View style={styles.expanded}>
            <View style={[styles.weekStripWrap, { borderTopColor: theme.border }]}>
              <WeekStrip
                habit={habit}
                today={today}
                kind={habit.kind}
                lang={lang}
                theme={theme}
              />
            </View>
            <PressableScale
              style={[
                styles.restDayBtn,
                { borderColor: theme.border },
                isRestToday && { backgroundColor: theme.textMuted, borderColor: theme.textMuted },
              ]}
              onPress={() => {
                selection();
                markRestDay(habit.id, today);
              }}
              scaleTo={0.97}
            >
              <Ionicons name="moon" size={14} color={isRestToday ? theme.textInverse : theme.textMuted} />
              <Text style={[styles.restDayText, { color: isRestToday ? theme.textInverse : theme.textMuted }]}>
                {isRestToday ? t.habits.restingToday : t.habits.restDay}
              </Text>
            </PressableScale>
            {isRestToday && (
              <Text style={[styles.restDayHint, { color: theme.textMuted }]}>{t.habits.restDayHint}</Text>
            )}
          </View>
        )}
        </View>
      </View>
      </View>
    </PressableScale>
  );
}

// ─── Week overview ───────────────────────────────────────────────────────────

function WeekView({
  habits, today, lang, theme,
}: {
  habits: Habit[]; today: string; lang: string; theme: ThemePalette;
}) {
  const logs = useHabitStore((s) => s.logs);
  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const abbr = lang === 'no' ? DAY_ABBR_NO : DAY_ABBR;
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  const visibleHabits = useMemo(
    () => habits.filter((h) => weekDates.some((d) => habitOccursOn(h, d))),
    [habits, weekDates]
  );

  if (visibleHabits.length === 0) {
    return (
      <Surface style={styles.habitsEmptyCard} borderColor={theme.border}>
        <EmptyState title={t.noHabitsYet} />
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
            const ratio = dotRatio(habit, log?.count ?? 0);
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
  habits, today, theme,
}: {
  habits: Habit[]; today: string; theme: ThemePalette;
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
    () => habits.filter((h) => dates.some((d) => habitOccursOn(h, d))),
    [habits, dates]
  );

  if (visibleHabits.length === 0) {
    return (
      <Surface style={styles.habitsEmptyCard} borderColor={theme.border}>
        <EmptyState title={t.noHabitsYet} />
      </Surface>
    );
  }

  return (
    <View>
      <View style={styles.monthNav}>
        <PressableScale
          onPress={() => setOffset((o) => Math.max(minOffset, o - 1))}
          style={[styles.monthNavBtn, offset <= minOffset && { opacity: 0.3 }]}
          disabled={offset <= minOffset}
          scaleTo={0.9}
        >
          <Text style={[styles.monthNavText, { color: theme.accent }]}>‹</Text>
        </PressableScale>
        <Text style={[styles.monthLabel, { color: theme.text }]}>{label}</Text>
        <PressableScale
          onPress={() => setOffset((o) => Math.min(0, o + 1))}
          style={[styles.monthNavBtn, offset >= 0 && { opacity: 0.3 }]}
          disabled={offset >= 0}
          scaleTo={0.9}
        >
          <Text style={[styles.monthNavText, { color: theme.accent }]}>›</Text>
        </PressableScale>
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
                const ratio = dotRatio(habit, log?.count ?? 0);
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

export default function HabitsScreen() {
  const router = useRouter();
  const habits = useHabitStore((s) => s.habits);

  const lang = useSettingsStore((s) => s.language);
  const childProfiles = useSettingsStore((s) => s.childProfiles);
  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled);

  const [hintOpen, setHintOpen] = useFirstVisitHint('habits');
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const habitDomainColor = getDomainColor(theme, 'habit');

  const [habitTab, setHabitTab] = useState<HabitViewTab>('today');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  // Inline quick-add (replaces the old "+" bubble → form nav): create a habit from just a
  // title with sensible defaults; the rest (icon/goal/recurrence) is edited later via
  // the card's settings-gear icon → /habit-form. Mirrors Plans' AddRow → addTask flow.
  const addHabitQuick = useHabitStore((s) => s.add);
  const [habitDraft, setHabitDraft] = useState('');

  useFocusEffect(
    useCallback(() => {
      return () => { setHintOpen(false); };
    }, [])
  );

  const today = todayStr();

  // Profile filter row shows only in People/family mode with at least one profile
  // (management moved to Settings — this screen only *filters* by person now).
  const showHabitProfiles = peopleModeEnabled && childProfiles.length > 0;
  // Memoise the habit filter chain (perf sweep 2026-07-15): this used to re-filter the
  // full habits array on every render of this large screen. Only recompute on real input
  // changes. Only filter by person when the filter UI is actually shown; otherwise (People mode
  // off) show every habit so profile-assigned habits don't silently disappear.
  const profileHabits = useMemo(
    () => (showHabitProfiles ? habits.filter((h) => h.childName === selectedProfile) : habits),
    [showHabitProfiles, habits, selectedProfile]
  );
  const visibleHabits = useMemo(
    () => profileHabits.filter((h) => habitOccursOn(h, today)),
    [profileHabits, today]
  );

  // Gate habit-card entrance so only habits added after mount fade in (not the whole list).
  const hasMountedHabits = useRef(false);
  useEffect(() => {
    hasMountedHabits.current = true;
  }, []);

  const onEditHabit = useCallback((id: string) => {
    router.push({ pathname: '/habit-form', params: { id } });
  }, [router]);

  const habitTabs: { key: HabitViewTab; label: string }[] = [
    { key: 'today', label: t.habitToday },
    { key: 'week', label: t.habitWeekView },
    { key: 'month', label: t.habitMonthView },
  ];

  function commitHabit() {
    const title = habitDraft.trim();
    if (!title) return;
    // Same new-habit shape app/habit-form.tsx writes, minus the fields the quick-add leaves
    // at their defaults (icon/goal/recurrence/notifications) — editable later via the form.
    addHabitQuick({
      title,
      // Neutral "to-do" marker default (debug-note 2026-07-21) — a star reads as a
      // reward/rating, against the app's no-shame framing. Custom icons still pickable.
      icon: 'ellipse-outline',
      kind: 'neutral',
      category: 'other',
      cue: '', craving: '', response: '', reward: '',
      dailyGoal: 1,
      recurrence: 'daily',
      recurrenceDays: [],
      notificationEnabled: false,
      notificationTimes: [],
      reminderMode: null,
      reminderCount: null,
      reminderIntervalMin: null,
      reminderStart: null,
      reminderEnd: null,
      routineOrder: 0,
      childName: selectedProfile || '',
      energyEnabled: false,
      energyValue: 1,
      goalId: null,
    });
    setHabitDraft('');
    success();
  }

  return (
    <>
      <ScreenScaffold
        title={t.habitsTitle}
        tier="site"
        bottomNav={false}
        ownBackground={false}
        screenColor={getScreenColor(theme, 'habits').base}
        infoActive={hintOpen}
        onInfoToggle={() => setHintOpen((v) => !v)}
      >
        <View style={styles.content}>
          <HintCard text={t.hints.habits.text} open={hintOpen} noPill />

          {/* Habits — boxed in a single hue-edged SectionCard so the whole section (filter ·
              view tabs · cards · add row) reads as one group instead of loose controls on the
              backdrop (2026-07-17). Debug notes: anchor the whole section, not the inner
              habit cards/add row. */}
          <DebugNoteAnchor id="habits.section" label="Habits">
          <SectionCard hue={habitDomainColor.accent} label={t.habitsTitle} contentStyle={styles.habitsSectionContent}>
            {/* Person filter (People/family mode) — Me + each profile. Management is in Settings. */}
            <Collapsible open={showHabitProfiles}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.profileRow}
              >
                {(['', ...childProfiles] as string[]).map((name) => {
                  const isActive = selectedProfile === name;
                  return (
                    <PressableScale
                      key={name || '__me__'}
                      style={[
                        styles.profileChip,
                        { backgroundColor: isActive ? theme.accent : theme.surfaceMuted, borderColor: isActive ? theme.accent : theme.border },
                      ]}
                      onPress={() => setSelectedProfile(name)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      scaleTo={0.97}
                    >
                      <Text style={[styles.profileChipText, { color: isActive ? theme.accentInk : theme.text }]}>
                        {name || t.habitForMe}
                      </Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            </Collapsible>

            {/* View tabs — shared bordered segmented control (SlideSelector). */}
            <SlideSelector
              options={habitTabs.map(({ key, label }) => ({ value: key, label }))}
              value={habitTab}
              onChange={(v) => setHabitTab(v as HabitViewTab)}
            />

            {/* Kept mounted (hidden via display:none, not unmounted) when another view tab is
                active — 2026-07-23 fix: unmounting this block on tab switch made every
                AnimatedListItem card play its FadeOutDown exit animation at once, overlapping
                visually with the Week/Month view mounting in the same spot (only visible when
                there was at least one habit card to exit — see AGENTS.md's "habits animation"
                debug note). Staying mounted means AnimatedListItem's enter/exit only fires for
                genuine habit add/remove, matching ANIMATION_GUIDELINES.md §6's "never animate
                tab switches" rule. */}
            <View style={habitTab === 'today' ? undefined : styles.hiddenTab}>
              {/* "X / Y done" tally removed (debug-note 2026-07-21): a score reintroduces
                  the shame/reward framing the app deliberately avoids. */}
              <View style={styles.section}>
                {visibleHabits.length === 0 ? (
                  // Neutral edge to match the Week/Month empty placeholders (theme.border,
                  // not the habit domain hue) — quiet "nothing here yet", not a coded surface.
                  <Surface borderColor={theme.border} style={styles.sectionCard}>
                    <Text style={[styles.dashedAddText, { color: theme.textMuted }]}>{t.noHabitsYet}</Text>
                  </Surface>
                ) : (
                  visibleHabits.map((h) => (
                    <AnimatedListItem key={h.id} enabled={hasMountedHabits.current}>
                      <HabitCard habit={h} today={today} onEdit={onEditHabit} lang={lang} theme={theme} />
                    </AnimatedListItem>
                  ))
                )}
              </View>

              {/* Inline quick-add row (replaces the old "+" bubble). Title-only create with
                  defaults; tap a habit's settings-gear icon to edit the rest. */}
              <Surface borderColor={habitDomainColor.accent} style={styles.habitAddRowCard}>
                <AddRow
                  placeholder={t.health.addHabit}
                  value={habitDraft}
                  onChangeText={setHabitDraft}
                  onSubmit={commitHabit}
                  accent={habitDomainColor.accent}
                  showDivider={false}
                  accessibilityLabel={t.health.addHabit}
                />
              </Surface>
            </View>

            {habitTab === 'week' && (
              <WeekView
                habits={profileHabits}
                today={today}
                lang={lang}
                theme={theme}
              />
            )}
            {habitTab === 'month' && (
              <MonthView
                habits={profileHabits}
                today={today}
                theme={theme}
              />
            )}
          </SectionCard>
          </DebugNoteAnchor>

          <View style={{ height: Spacing.xl + Spacing.xxl }} />
        </View>
      </ScreenScaffold>
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md },

  // ─── Habits section ───────────────────────────────────────────────────────
  // Boxed in a <SectionCard> (2026-07-17): the section's inner controls stack with a
  // Spacing.md gap below the card's SectionRail header (overrides SectionCard's default
  // Spacing.sm content gap, keeping the habits sub-controls' original breathing room).
  habitsSectionContent: { gap: Spacing.md },
  profileRow: {
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  profileChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  profileChipText: { fontFamily: Type.label.fontFamily, fontSize: Type.label.size },
  section: { gap: Spacing.sm },
  // Hides the Today section without unmounting it when Week/Month is active — see the
  // 2026-07-23 fix note above the view-tab render block.
  hiddenTab: { display: 'none' },
  habitsEmptyCard: { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  sectionCard: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  // Inline habit quick-add row card (mirrors Plans' addRowCard).
  habitAddRowCard: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, marginTop: Spacing.sm },
  dashedAddText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },

  // Wraps the (overflow-clipped) habit card so the done-state GlowPulse halo, whose boxShadow
  // extends beyond the card box, isn't clipped. Position:relative for the absolute-fill halo.
  habitGlowWrap: { position: 'relative', borderRadius: Radius.md },
  // Habit card — Decision 043 rule 3: progress/done state lives on the 4px accent bar
  // only (habitAccent); the card body/border never recolors (see barColor in HabitCard).
  habitCard: {
    borderRadius: Radius.md,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  habitAccent: { width: 4, alignSelf: 'stretch' },
  habitCardContent: { flex: 1, padding: Spacing.md, position: 'relative' },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  habitIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  habitTitleWrap: { flex: 1 },
  habitTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  habitTitle: { fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
  titleMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2, flexWrap: 'wrap' },
  energyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  energyPillText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  donePill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  donePillText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  weeklyProgressText: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
  adjBtn: {
    width: 30, height: 30,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    // Raised, pressable-looking adjusters (depth toward the user) — see Shadow.button.
    // 2026-07-24 contrast pass: the "−" button's fill (theme.surface) matches its parent
    // habitCard's own background exactly, so the shadow-only/top-highlight-only edge it had
    // was the button's ENTIRE visible boundary — added a real borderWidth, defaulted to
    // transparent (the "+" button's colored fill already has its own contrast and shouldn't
    // gain a stray default border) and overridden to theme.border at the "−" button's call site.
    borderWidth: 1,
    borderColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.6)',
    ...Shadow.button,
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
