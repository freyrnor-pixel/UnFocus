/**
 * habit-form.tsx — add / edit a habit
 *
 * Sub-screen (Decision 001 tier='sub') for one habit: icon, title, category, daily
 * goal, recurrence, an optional child-profile assignment, and the three-mode daily
 * reminder picker (Once / Several times / Every…, Decision 016). An `id` route param
 * switches it to edit mode (with delete).
 *
 * Build/break kind and the cue→craving→response→reward "atomic habits" steps were
 * removed (habits are now simple, task-shaped) — `kind` is written as 'neutral' and the
 * step columns are saved empty; the DB columns are retained (never dropped).
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/Surface, components/FormControls,
 *             components/Collapsible (animated "More options" disclosure),
 *             components/HintCard, components/HabitIcon, components/Button, components/AppModal,
 *             components/PressableScale, components/Stepper, lib/haptics, lib/i18n, lib/useAppTheme,
 *             store/useHabitStore, store/useSettingsStore
 *   Used by → Expo Router route "/habit-form"; reached from app/(tabs)/health.tsx's
 *             embedded Habits section (AddFAB "+" and each habit card's settings-gear
 *             IconButton, 2026-07-21 — replaced the old long-press-to-edit gesture)
 *   Data    → useHabitStore (habits table) via add/update/remove; toggling the notification
 *             (or editing its recipe) reschedules the habit's reminders through the store
 *
 * Edit notes:
 *   - All visible strings go through useT(); colour theme comes from useAppTheme().
 *   - **Recurrence (2026-07-20)**: Daily/Weekly/Monthly/Flexible picker, matching
 *     lib/habitRecurrence.ts's habitOccursOn. Weekly saves `recurrenceDays` as the
 *     selected weekday indices (same dayLabels-driven chip picker as task-form.tsx's
 *     weekly recurrence); Monthly saves it as a single-element `[dayOfMonth]` (1–28,
 *     via Stepper). 'one-time' stays out of the picker — health.tsx currently treats
 *     it identically to 'daily' with no distinct behaviour, so exposing it would be a
 *     no-op that reads as broken.
 *   - **'weekly-flexible' (2026-07-22, "Flexible")**: "N times this week, any day" —
 *     due every day (no weekday chips shown), met once the week's cumulative logged
 *     count reaches the goal. Reuses the `dailyGoal` field as a per-week target in
 *     this mode (only its label switches to habitWeeklyGoal) rather than adding a new
 *     DB column — see lib/habitRecurrence.ts.
 *   - **Keyboard fix (2026-07-20)**: the whole screen is wrapped in a `KeyboardAvoidingView`
 *     (iOS `padding` only — Android already resizes the window via
 *     `windowSoftInputMode=resize`, so a second RN-level shrink would double up and misplace
 *     content, see ScreenScaffold's header note). Fixes the title input (and any lower field,
 *     e.g. the notification start/end times) being covered by the keyboard on iOS, since
 *     ScreenScaffold itself has no keyboard-avoidance for a plain sub-screen ScrollView (only
 *     components/AddRow.tsx's `ScrollIntoViewContext` handles that, for list-row inputs).
 *   - **Decision 016 Q2 (drop mirror)**: no `notificationTime` field anywhere in this
 *     form or its save payload — `notificationTimes` is the sole source of truth.
 *   - **Decision 016 Q3 (recipe columns, 3B-ii)**: `reminderMode`/`reminderCount`/
 *     `reminderIntervalMin`/`reminderStart`/`reminderEnd` are saved alongside
 *     `notificationTimes` so re-opening a habit restores the exact mode that created it,
 *     instead of inferring "Several times" for anything with >1 saved time. Only the
 *     fields relevant to the current mode are persisted (others null) — see save().
 *     Legacy habits (or ones saved before this session) have `reminderMode === null` and
 *     fall back to the old length-based inference.
 *   - Essentials shown by default (2026-07-21, tester feedback "most important settings
 *     hidden"): Title → Notification → Recurrence → Daily goal. Only icon and category
 *     (cosmetic/organizational, not load-bearing) live behind a "more options" disclosure
 *     (t.habits.moreOptions/fewerOptions).
 *   - No TimePickerWheel (never ported into this repo, same precedent as task-form.tsx) —
 *     every time field is a plain FormControls.Input (HH:MM text).
 *   - **Style consistency pass (2026-07-21)**: the daily-goal and reminder-count steppers
 *     now use the shared `Stepper` component (already used here for energy/monthDay)
 *     instead of hand-rolled −/+ circles, and the chip/dayChip/iconBtn pill selectors all
 *     got a `theme.border` (active: `theme.accent`) outline to match the "raised keycap"
 *     border convention IconButton/Surface use elsewhere — the flat, borderless fills
 *     read as visually inconsistent with the rest of the app. `dayChip` also switched from
 *     a fixed 44px circle + wrap to `flex:1`/`aspectRatio:1` so all 7 weekday chips fit on
 *     one row (was dropping "Sø" to its own row on typical phone widths) — same fix applied
 *     to task-form.tsx's identical weekly picker. The recurrence-picker label was renamed
 *     from "Resets"/"Nullstilles" to "Interval"/"Intervall" — "Resets" read as a settings
 *     action, not a description of the Daily/Weekly/Monthly cadence picker below it.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useHabitStore,
  HabitCategory,
  HabitRecurrence,
  HabitReminderMode,
} from '@/store/useHabitStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { tap, warning, heavy } from '@/lib/haptics';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import { Input, SegmentedControl, Switch } from '@/components/FormControls';
import HintCard from '@/components/HintCard';
import HabitIcon, { HABIT_ICON_NAMES } from '@/components/HabitIcon';
import Button from '@/components/Button';
import { showAppModal } from '@/components/AppModal';
import PressableScale from '@/components/PressableScale';
import Stepper from '@/components/Stepper';
import Collapsible from '@/components/Collapsible';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';

const INTERVAL_OPTIONS = [30, 60, 90, 120, 180, 240];

function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map((n) => parseInt(n, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function minToHhmm(min: number): string {
  const v = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

/**
 * Turn the reminder inputs into the concrete list of HH:MM times we store.
 *   single   → just the picked time
 *   count    → N times evenly spaced across [start, end] (inclusive)
 *   interval → one every `intervalMin` from start up to end
 * An inverted window (end before start) collapses to a single reminder at start
 * (Decision 016 Q5, ratified shipped default).
 */
function computeReminderTimes(
  mode: HabitReminderMode,
  single: string,
  count: number,
  intervalMin: number,
  start: string,
  end: string
): string[] {
  if (mode === 'single') return [single];
  const s = hhmmToMin(start);
  const e = hhmmToMin(end);
  if (e <= s) return [minToHhmm(s)];
  if (mode === 'count') {
    const n = Math.max(1, count);
    if (n === 1) return [minToHhmm(s)];
    const step = (e - s) / (n - 1);
    return Array.from({ length: n }, (_, i) => minToHhmm(s + step * i));
  }
  const step = Math.max(15, intervalMin);
  const times: string[] = [];
  for (let t = s; t <= e && times.length < 24; t += step) times.push(minToHhmm(t));
  return times.length ? times : [minToHhmm(s)];
}

export default function HabitForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; childName?: string }>();
  const isEdit = !!params.id;

  const habits = useHabitStore((s) => s.habits);
  const addHabit = useHabitStore((s) => s.add);
  const updateHabit = useHabitStore((s) => s.update);
  const removeHabit = useHabitStore((s) => s.remove);
  const childProfiles = useSettingsStore((s) => s.childProfiles);
  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled);
  const energySystemEnabled = useSettingsStore((s) => s.energySystemEnabled);

  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  const existing = isEdit ? habits.find((h) => h.id === params.id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'ellipse-outline');
  const [category, setCategory] = useState<HabitCategory>(existing?.category ?? 'other');
  const [dailyGoal, setDailyGoal] = useState(existing?.dailyGoal ?? 1);
  const [recurrence, setRecurrence] = useState<HabitRecurrence>(existing?.recurrence ?? 'daily');
  const [weekDays, setWeekDays] = useState<number[]>(
    existing?.recurrence === 'weekly' ? existing.recurrenceDays : []
  );
  const [monthDay, setMonthDay] = useState(
    existing?.recurrence === 'monthly' ? (existing.recurrenceDays[0] ?? 1) : 1
  );
  const [childName, setChildName] = useState(existing?.childName ?? (params.childName ?? ''));
  const [energyEnabled, setEnergyEnabled] = useState(existing?.energyEnabled ?? false);
  const [energyValue, setEnergyValue] = useState(existing?.energyValue ?? 1);

  const [notificationEnabled, setNotificationEnabled] = useState(existing?.notificationEnabled ?? false);
  // Recipe fields: prefer the persisted recipe (Decision 016 Q3); fall back to the old
  // length-based inference for a habit saved before recipe columns existed.
  const [reminderMode, setReminderMode] = useState<HabitReminderMode>(
    existing?.reminderMode ?? ((existing?.notificationTimes?.length ?? 0) > 1 ? 'count' : 'single')
  );
  const [singleTime, setSingleTime] = useState(existing?.notificationTimes?.[0] ?? '08:00');
  const [reminderCount, setReminderCount] = useState(
    existing?.reminderCount ?? Math.min(12, Math.max(2, existing?.notificationTimes?.length ?? 3))
  );
  const [reminderIntervalMin, setReminderIntervalMin] = useState(existing?.reminderIntervalMin ?? 120);
  const [reminderStart, setReminderStart] = useState(
    existing?.reminderStart ?? existing?.notificationTimes?.[0] ?? '08:00'
  );
  const [reminderEnd, setReminderEnd] = useState(
    existing?.reminderEnd ??
      ((existing?.notificationTimes?.length ?? 0) > 1
        ? existing!.notificationTimes[existing!.notificationTimes.length - 1]
        : '20:00')
  );

  const reminderTimes = computeReminderTimes(
    reminderMode,
    singleTime,
    reminderCount,
    reminderIntervalMin,
    reminderStart,
    reminderEnd
  );

  function toggleWeekDay(d: number) {
    setWeekDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  // Advanced fields (icon/category only, see below) start collapsed; open by default in edit
  // mode if either already holds a non-default value.
  const [showMore, setShowMore] = useState<boolean>(
    isEdit && !!(existing && (existing.category !== 'other' || (existing.icon !== 'ellipse-outline' && existing.icon !== '⭐')))
  );

  function save() {
    if (!title.trim()) return;
    const notificationTimes = notificationEnabled ? reminderTimes : [];
    const payload = {
      title: title.trim(),
      icon,
      // build/break removed — habits are a single neutral kind now.
      kind: 'neutral' as const,
      category,
      cue: '',
      craving: '',
      response: '',
      reward: '',
      dailyGoal,
      recurrence,
      recurrenceDays: recurrence === 'weekly' ? weekDays : recurrence === 'monthly' ? [monthDay] : [],
      notificationEnabled,
      notificationTimes,
      reminderMode: notificationEnabled ? reminderMode : null,
      reminderCount: notificationEnabled && reminderMode === 'count' ? reminderCount : null,
      reminderIntervalMin: notificationEnabled && reminderMode === 'interval' ? reminderIntervalMin : null,
      reminderStart: notificationEnabled && reminderMode !== 'single' ? reminderStart : null,
      reminderEnd: notificationEnabled && reminderMode !== 'single' ? reminderEnd : null,
      childName,
      energyEnabled,
      energyValue,
    };
    if (isEdit && params.id) {
      updateHabit(params.id, payload);
    } else {
      // routineOrder satisfies Omit<Habit,'id'|'createdAt'|'active'>; the store
      // replaces a falsy 0 with Date.now() so new habits append to the end.
      addHabit({ ...payload, routineOrder: 0 });
    }
    router.back();
  }

  function performDelete() {
    if (params.id) removeHabit(params.id);
    router.back();
  }

  function confirmDelete() {
    warning();
    showAppModal(t.resetConfirmTitle(title || t.habitTitlePlaceholder), t.resetConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.resetConfirmBtn, style: 'destructive', onPress: () => { heavy(); performDelete(); } },
    ]);
  }

  const categoryKeys: HabitCategory[] = ['physical', 'mental', 'health', 'nutrition', 'sleep', 'work', 'wellbeing', 'other'];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
    <ScreenScaffold
      title={isEdit ? t.habitFormEdit : t.habitFormTitle}
      tier="sub"
      onBack={() => router.back()}
      headerRight={
        <PressableScale onPress={save} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.save} scaleTo={0.9}>
          <Ionicons name="checkmark" size={24} color={theme.accent} />
        </PressableScale>
      }
    >
      <View style={styles.content}>
        <HintCard text={t.hints.habitForm.text} example={t.hints.habitForm.example} />

        {/* Title */}
        <View style={styles.field}>
          <Input
            label={t.habitTitleLabel}
            value={title}
            onChangeText={setTitle}
            placeholder={t.habitTitlePlaceholder}
            returnKeyType="next"
          />
        </View>

        {/* Energy — optional signed per-habit value (only when the Energy system is on) */}
        {energySystemEnabled && (
          <>
            <Surface style={styles.notifRow}>
              <Text style={[styles.notifLabel, { color: theme.text }]}>{t.energyConsumeLabel}</Text>
              <Switch checked={energyEnabled} onChange={setEnergyEnabled} />
            </Surface>
            {energyEnabled && (
              <View style={[styles.field, styles.energyStepperRow]}>
                <Text style={[styles.label, { color: theme.textMuted }]}>{t.energyCostLabel}</Text>
                <Stepper value={energyValue} onChange={setEnergyValue} signed accessibilityLabel={t.energyCostLabel} />
              </View>
            )}
          </>
        )}

        {/* For — profile assignment */}
        {peopleModeEnabled && childProfiles.length > 0 && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.habitForLabel}</Text>
            <View style={styles.chipRow}>
              {(['', ...childProfiles] as string[]).map((name) => {
                const active = childName === name;
                return (
                  <PressableScale
                    key={name || '__me__'}
                    style={[
                      styles.chip,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      active && { backgroundColor: theme.accent, borderColor: theme.accent },
                    ]}
                    onPress={() => {
                      tap();
                      setChildName(name);
                    }}
                    scaleTo={0.97}
                  >
                    <Text style={[styles.chipText, { color: theme.text }, active && { color: theme.accentInk }]}>
                      {name || t.habitForMe}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        )}

        {/* Notification */}
        <Surface style={styles.notifRow}>
          <Text style={[styles.notifLabel, { color: theme.text }]}>{t.habitNotification}</Text>
          <Switch checked={notificationEnabled} onChange={setNotificationEnabled} />
        </Surface>

        {notificationEnabled && (
          <View style={styles.field}>
            {/* Mode: once a day, several evenly-spaced times, or every N minutes/hours */}
            <SegmentedControl
              options={[
                { value: 'single', label: t.habitReminderModeSingle },
                { value: 'count', label: t.habitReminderModeCount },
                { value: 'interval', label: t.habitReminderModeInterval },
              ]}
              value={reminderMode}
              onChange={(v) => setReminderMode(v as HabitReminderMode)}
            />

            {reminderMode === 'single' && (
              <View style={styles.timeFieldWrap}>
                <Input
                  label={t.habitNotification}
                  value={singleTime}
                  onChangeText={setSingleTime}
                  placeholder={t.timeInputPlaceholder}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            )}

            {reminderMode === 'count' && (
              <View style={styles.timeFieldWrap}>
                <Text style={[styles.label, { color: theme.textMuted }]}>{t.habitReminderCountLabel}</Text>
                <Stepper value={reminderCount} onChange={setReminderCount} min={2} max={12} accessibilityLabel={t.habitReminderCountLabel} />
              </View>
            )}

            {reminderMode === 'interval' && (
              <View style={styles.timeFieldWrap}>
                <Text style={[styles.label, { color: theme.textMuted }]}>{t.habitReminderIntervalLabel}</Text>
                <View style={styles.chipRow}>
                  {INTERVAL_OPTIONS.map((min) => {
                    const active = reminderIntervalMin === min;
                    return (
                      <PressableScale
                        key={min}
                        style={[
                          styles.chip,
                          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                          active && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}
                        onPress={() => {
                          tap();
                          setReminderIntervalMin(min);
                        }}
                        scaleTo={0.97}
                      >
                        <Text style={[styles.chipText, { color: theme.text }, active && { color: theme.accentInk }]}>
                          {min % 60 === 0 ? t.habitReminderEveryHours(min / 60) : t.habitReminderEveryMinutes(min)}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            )}

            {reminderMode !== 'single' && (
              <View style={styles.timeFieldWrap}>
                <Input
                  label={t.habitReminderStartLabel}
                  value={reminderStart}
                  onChangeText={setReminderStart}
                  placeholder={t.timeInputPlaceholder}
                  keyboardType="numbers-and-punctuation"
                />
                <Input
                  label={t.habitReminderEndLabel}
                  value={reminderEnd}
                  onChangeText={setReminderEnd}
                  placeholder={t.timeInputPlaceholder}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={[styles.reminderPreview, { color: theme.textMuted }]}>
                  {t.habitReminderTimesPreview(reminderTimes.length)} · {reminderTimes.join(' · ')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Recurrence — how often the habit resets/shows up. Shown by default (not behind
            "more options"): together with Daily goal below, this is what actually determines
            whether the habit shows up and when — arguably more load-bearing than the title
            itself, so hiding it read as the form skipping its most important settings. */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textMuted }]}>{t.habitRecurrence}</Text>
          <SegmentedControl
            options={[
              { value: 'daily', label: t.habitRecurrenceDaily },
              { value: 'weekly', label: t.habitRecurrenceWeekly },
              { value: 'monthly', label: t.habitRecurrenceMonthly },
              { value: 'weekly-flexible', label: t.habitRecurrenceWeeklyFlexible },
            ]}
            value={recurrence}
            onChange={(v) => setRecurrence(v as HabitRecurrence)}
          />
          {recurrence === 'weekly-flexible' && (
            <Text style={[styles.reminderPreview, { color: theme.textMuted }]}>{t.habitRecurrenceWeeklyFlexibleHint}</Text>
          )}
          {recurrence === 'weekly' && (
            <View style={styles.daysRow}>
              {t.dayLabels.map((label, i) => {
                const active = weekDays.includes(i);
                return (
                  <PressableScale
                    key={i}
                    style={[
                      styles.dayChip,
                      { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                      active && { backgroundColor: theme.accent, borderColor: theme.accent },
                    ]}
                    onPress={() => {
                      tap();
                      toggleWeekDay(i);
                    }}
                    scaleTo={0.97}
                  >
                    <Text style={[styles.dayText, { color: theme.text }, active && { color: theme.accentInk }]}>
                      {label.slice(0, 2)}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          )}
          {recurrence === 'monthly' && (
            <View style={[styles.energyStepperRow, { marginTop: Spacing.sm }]}>
              <Text style={[styles.label, { color: theme.textMuted }]}>{t.taskMonthlyByDay}</Text>
              <Stepper value={monthDay} onChange={setMonthDay} min={1} max={28} accessibilityLabel={t.taskMonthlyByDay} />
            </View>
          )}
        </View>

        {/* Daily/weekly goal stepper — shown by default alongside Recurrence, same reasoning.
            Reuses the same `dailyGoal` field as a per-week target when recurrence is
            'weekly-flexible' (lib/habitRecurrence.ts) — only the label changes. */}
        <View style={[styles.field, styles.energyStepperRow]}>
          <Text style={[styles.label, { color: theme.textMuted }]}>
            {recurrence === 'weekly-flexible' ? t.habitWeeklyGoal : t.habitDailyGoal}
          </Text>
          <Stepper value={dailyGoal} onChange={setDailyGoal} min={1} max={20} accessibilityLabel={t.habitDailyGoal} />
        </View>

        {/* More options disclosure — icon/category only now; both are cosmetic/organizational,
            not load-bearing, so they stay tucked away by default. */}
        <PressableScale
          style={[styles.disclosure, { borderColor: theme.border }]}
          onPress={() => {
            tap();
            setShowMore((v) => !v);
          }}
          scaleTo={0.97}
        >
          <Text style={[styles.disclosureText, { color: theme.textMuted }]}>
            {showMore ? `${t.habits.fewerOptions} ↑` : `${t.habits.moreOptions} ↓`}
          </Text>
        </PressableScale>

        <Collapsible open={showMore}>
          <>
            {/* Icon picker */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textMuted }]}>{t.habitIconLabel}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.iconRow}>
                  {HABIT_ICON_NAMES.map((iconName) => {
                    const active = icon === iconName;
                    return (
                      <PressableScale
                        key={iconName}
                        style={[
                          styles.iconBtn,
                          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                          active && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}
                        onPress={() => {
                          tap();
                          setIcon(iconName);
                        }}
                        scaleTo={0.9}
                      >
                        <HabitIcon icon={iconName} size={22} color={active ? theme.accentInk : theme.text} />
                      </PressableScale>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textMuted }]}>{t.category}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {categoryKeys.map((cat) => {
                    const active = category === cat;
                    return (
                      <PressableScale
                        key={cat}
                        style={[
                          styles.chip,
                          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                          active && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}
                        onPress={() => {
                          tap();
                          setCategory(cat);
                        }}
                        scaleTo={0.97}
                      >
                        <Text style={[styles.chipText, { color: theme.text }, active && { color: theme.accentInk }]}>
                          {t.habitCategories[cat]}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </>
        </Collapsible>

        {isEdit && (
          <Button label={t.habitDeleteLabel} variant="danger" onPress={confirmDelete} style={styles.deleteBtn} />
        )}
      </View>
    </ScreenScaffold>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.lg },
  field: { gap: Spacing.xs, paddingVertical: Spacing.sm },
  daysRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  dayChip: { flex: 1, aspectRatio: 1, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  dayText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1.5 },
  chipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  notifLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  energyStepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeFieldWrap: { gap: Spacing.sm, marginTop: Spacing.sm },
  reminderPreview: { fontSize: FontSize.xs, fontStyle: 'italic', marginTop: Spacing.xs },
  disclosure: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  disclosureText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  iconRow: { flexDirection: 'row', gap: Spacing.xs, paddingVertical: Spacing.xs },
  iconBtn: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  deleteBtn: { marginTop: Spacing.md },
});
