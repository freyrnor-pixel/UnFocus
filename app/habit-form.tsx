/**
 * habit-form.tsx — add / edit a habit
 *
 * Sub-screen (Decision 001 tier='sub') for one habit: icon, title, category, daily
 * goal, recurrence, an optional child-profile assignment, and the three-mode daily
 * reminder picker (Once / Several times / Every…, Decision 016). An `id` route param
 * switches it to edit mode (with delete).
 *
 * **Field order + labelling (2026-07-26 clarity pass, maintainer-specified)**:
 * Name → For → **Reminder** (optional) → Energy → Goal → More options → Delete · Discard · Save.
 *   - A habit is recurring BY DEFINITION, so there is no repeat switch — unlike a task,
 *     the only question is *which days*. The picker label was "Interval", which named
 *     nothing; it's now "How often" (`t.habitHowOften`).
 *   - **Most of the time logic is skipped by default** (maintainer: "habits should just be
 *     every day with today as start by default... we skip most of the time logic"). The
 *     schedule — How often + its weekday/monthly options + Times per day — lives inside
 *     "More options" alongside icon/category, because the default (every day, 1x, starting
 *     the day you create it) is already right for most habits. There's no start-date field
 *     at all: a habit simply starts existing when you add it (`createdAt`).
 *   - The collapsed disclosure shows a live one-line summary (`scheduleSummary`, e.g.
 *     "Daily · 1x") so skipping the schedule never means not knowing what it's set to.
 *   - Picking Weekly seeds today's weekday, and `toggleWeekDay` refuses to empty the set:
 *     lib/habitRecurrence.ts reads zero days as "every day", so an empty chip row would
 *     silently mean the opposite of what it looks like.
 *   - `t.habitNotification` ("Daily reminder") no longer labels anything — the section is
 *     `t.habitReminderLabel` ("Reminder", since a habit can be weekly/monthly) and the
 *     single-mode time field is `t.habitReminderTimeLabel` ("Time"). The key is kept in
 *     lib/i18n.ts for other callers.
 *   - Energy is ONE signed stepper (`t.energyGiveTakeLabel`), not a switch plus a value:
 *     0 already meant "no effect" to lib/energy.ts, so `energyEnabled` is derived in save().
 *     It is not gated on a setting either — Energy stopped being a toggle the same day.
 *   - Save/Discard/Delete is the same icon+label row components/TaskCard.tsx uses, so
 *     making a habit and making a task end identically. The header keeps a save button but
 *     it reads "✓ Save" — a bare checkmark didn't say what it did.
 *
 * **Field dividers + Opt tags (2026-07-30)**: a hairline `FieldDivider` now separates every
 * field block (matching app/settings.tsx's in-card divider convention), and For/Energy/Goal/
 * the whole "More options" disclosure (How often, Daily goal, Icon, Category — all four
 * already sensible-default fields per the field-order note above) carry
 * `OptionalTag`/`Input`'s `optional` prop — only Title actually blocks save().
 *
 * Build/break kind and the cue→craving→response→reward "atomic habits" steps were
 * removed (habits are now simple, task-shaped) — `kind` is written as 'neutral' and the
 * step columns are saved empty; the DB columns are retained (never dropped).
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/Surface, components/FormControls,
 *             components/Collapsible (animated "More options" disclosure),
 *             components/HintCard, components/HabitIcon, components/AppModal,
 *             components/PressableScale, components/Stepper, components/GoalPicker (gated on
 *             settings.featureGoals), components/FieldDivider, components/OptionalTag,
 *             lib/haptics, lib/i18n, lib/useAppTheme, store/useHabitStore, store/useSettingsStore
 *   Used by → Expo Router route "/habit-form"; reached from app/(tabs)/habits.tsx (its own
 *             bottom-nav tab as of 2026-07-23 — was embedded in health.tsx before that;
 *             each habit card's settings-gear IconButton, 2026-07-21 — replaced the old
 *             long-press-to-edit gesture)
 *   Data    → useHabitStore (habits table) via add/update/remove; toggling the notification
 *             (or editing its recipe) reschedules the habit's reminders through the store
 *
 * Edit notes:
 *   - All visible strings go through useT(); colour theme comes from useAppTheme().
 *   - **Recurrence (2026-07-20)**: Daily/Weekly/Monthly/Flexible picker, matching
 *     lib/habitRecurrence.ts's habitOccursOn. Weekly saves `recurrenceDays` as the
 *     selected weekday indices (same dayLabels-driven chip picker as task-form.tsx's
 *     weekly recurrence); Monthly saves it as a single-element `[dayOfMonth]` (1–28,
 *     via Stepper). 'one-time' stays out of the picker — habits.tsx currently treats
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
 *     hidden"); reordered and trimmed 2026-07-26 (see the field-order block above). The
 *     "more options" disclosure (t.habits.moreOptions/fewerOptions) now holds the schedule
 *     as well as icon/category, and carries a one-line summary + hint so it isn't a
 *     mystery box. Note this partly reverses the 2026-07-21 change, deliberately: that
 *     pass promoted Recurrence/Daily goal on the theory they were the most load-bearing
 *     settings, but with sensible every-day defaults most people never need to touch them.
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
import { usePeopleStore } from '@/store/usePeopleStore';
import PersonChip from '@/components/PersonChip';
import { personColor } from '@/lib/personColor';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { dayOfWeekMon0 } from '@/lib/date';
import { energyStepperValue, energyFieldsFromStepper } from '@/lib/energy';
import { tap, warning, heavy } from '@/lib/haptics';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import { Input, SegmentedControl, Switch } from '@/components/FormControls';
import HintCard from '@/components/HintCard';
import { GoalPicker } from '@/components/GoalPicker';
import HabitIcon, { HABIT_ICON_NAMES } from '@/components/HabitIcon';
import { showAppModal } from '@/components/AppModal';
import PressableScale from '@/components/PressableScale';
import Stepper from '@/components/Stepper';
import Collapsible from '@/components/Collapsible';
import FieldDivider from '@/components/FieldDivider';
import OptionalTag from '@/components/OptionalTag';
import { AspectRatio, FontSize, Fonts, Radius, Spacing } from '@/constants/theme';

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
  const people = usePeopleStore((s) => s.people);
  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled);
  const featureGoals = useSettingsStore((s) => s.featureGoals);

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
  // One signed stepper (2026-07-26): 0 = no effect, so there is no separate enabled flag in
  // the form any more — save() derives energyEnabled from this value. A habit that isn't in
  // the Energy system seeds to 0 regardless of its stored energyValue: that column defaults
  // to a meaningless 1 while energyEnabled is false, and showing it would silently opt every
  // existing habit in on the next save.
  const [energyValue, setEnergyValue] = useState(energyStepperValue(existing?.energyEnabled ?? false, existing?.energyValue ?? 0));
  const [goalId, setGoalId] = useState<string | null>(existing?.goalId ?? null);

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
    // Never let the set go empty: lib/habitRecurrence.ts reads zero days as "every day",
    // so an empty chip row would silently mean the opposite of what it looks like.
    setWeekDays((prev) => (prev.includes(d) ? (prev.length === 1 ? prev : prev.filter((x) => x !== d)) : [...prev, d]));
  }

  /**
   * Switching to Weekly seeds today's weekday (same as components/TaskCard.tsx does for a
   * repeating task) rather than leaving all seven chips unselected — which reads as "not
   * chosen yet" while actually meaning "every day" (lib/habitRecurrence.ts).
   */
  function changeRecurrence(next: HabitRecurrence) {
    if (next === 'weekly' && weekDays.length === 0) setWeekDays([dayOfWeekMon0(new Date())]);
    setRecurrence(next);
  }

  /** One-line "Every day · 1x per day" summary, so the collapsed disclosure isn't a mystery. */
  const scheduleSummary = [
    recurrence === 'daily' ? t.habitRecurrenceDaily
      : recurrence === 'weekly' ? weekDays.slice().sort((a, b) => a - b).map((d) => t.dayLabels[d].slice(0, 2)).join(' ')
      : recurrence === 'monthly' ? `${t.taskMonthlyByDay} ${monthDay}`
      : t.habitRecurrenceWeeklyFlexible,
    recurrence === 'weekly-flexible' ? t.habitWeeklyGoal.toLowerCase() : `${dailyGoal}x`,
  ].join(' · ');

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
      // Energy is one signed stepper now (2026-07-26) — 0 means "no effect", which is what
      // energyEnabled=false already meant to lib/energy.ts (it sums `enabled && value`).
      ...energyFieldsFromStepper(energyValue),
      goalId,
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
  const canSave = title.trim().length > 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
    <ScreenScaffold
      title={isEdit ? t.habitFormEdit : t.habitFormTitle}
      tier="sub"
      onBack={() => router.back()}
      headerRight={
        // Icon + text, not a bare ✓ (2026-07-26): a lone checkmark in a header doesn't say
        // what it does. The bottom Discard/Save row is the primary affordance; this stays
        // so a long form can be saved without scrolling back down.
        <PressableScale onPress={save} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.save} scaleTo={0.9}>
          <View style={styles.headerSaveBtn}>
            <Ionicons name="checkmark" size={16} color={theme.accent} />
            <Text style={[styles.headerSaveText, { color: theme.accent }]}>{t.save}</Text>
          </View>
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

        {/* For — person assignment. The roster comes from the People registry now, but
            habits still STORE a name (`childName`): they don't sync between devices, so a
            name is sufficient here and avoids a second id migration. See the People note
            in store/usePeopleStore.ts. */}
        {peopleModeEnabled && people.length > 1 && (
          <>
          <FieldDivider />
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.textMuted }]}>{t.habitForLabel}</Text>
              <OptionalTag />
            </View>
            <View style={styles.chipRow}>
              {people.map((person, index) => {
                const value = person.isSelf ? '' : person.name;
                return (
                  <PersonChip
                    key={person.id}
                    label={person.isSelf ? person.name || t.habitForMe : person.name}
                    name={person.name}
                    color={personColor(person.color, index)}
                    selected={childName === value}
                    onPress={() => { tap(); setChildName(value); }}
                  />
                );
              })}
            </View>
          </View>
          </>
        )}

        <FieldDivider />

        {/* ── Reminder (moved below the schedule, 2026-07-26): you decide WHEN the habit
               happens before you decide whether to be nudged about it. ── */}
        <Surface style={styles.notifRow}>
          <Text style={[styles.notifLabel, { color: theme.text }]}>{t.habitReminderLabel}</Text>
          <Switch checked={notificationEnabled} onChange={setNotificationEnabled} />
        </Surface>
        {!notificationEnabled && (
          <Text style={[styles.reminderPreview, { color: theme.textMuted }]}>{t.habitReminderOffHint}</Text>
        )}

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
                  label={t.habitReminderTimeLabel}
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

        <FieldDivider />

        {/* Energy give / take — one signed stepper (2026-07-26): the old "Affects energy"
            switch + separate value stepper were two controls for one number, and 0 already
            means "no effect" to lib/energy.ts. energyEnabled is derived on save. Not gated on
            a setting any more — 0 by default means it costs nothing until you say otherwise. */}
        <View style={styles.field}>
          <View style={styles.energyStepperRow}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.textMuted }]}>{t.energyGiveTakeLabel}</Text>
              <OptionalTag />
            </View>
            <Stepper value={energyValue} onChange={setEnergyValue} signed accessibilityLabel={t.energyGiveTakeLabel} />
          </View>
          <Text style={[styles.reminderPreview, { color: theme.textMuted }]}>{t.energyGiveTakeHint}</Text>
        </View>

        {/* Goal — connect this habit to a Goal (create/select/delete inline).
            Opt-in via settings.featureGoals (Settings → Advanced → Features). */}
        {featureGoals && (
          <>
            <FieldDivider />
            <GoalPicker value={goalId} onChange={setGoalId} />
          </>
        )}

        <FieldDivider />

        {/* More options disclosure — icon/category only now; both are cosmetic/organizational,
            not load-bearing, so they stay tucked away by default. The schedule (How often/
            Daily goal) inside is covered by the same "Opt" tag: sensible defaults already
            apply, per the header comment above. */}
        <PressableScale
          style={[styles.disclosure, { borderColor: theme.border }]}
          onPress={() => {
            tap();
            setShowMore((v) => !v);
          }}
          scaleTo={0.97}
        >
          <View style={styles.labelRow}>
            <Text style={[styles.disclosureText, { color: theme.textMuted }]}>
              {showMore ? `${t.habits.fewerOptions} ↑` : `${t.habits.moreOptions} ↓`}
            </Text>
            <OptionalTag />
          </View>
        </PressableScale>
        {!showMore && (
          <Text style={[styles.reminderPreview, { color: theme.textMuted }]}>{`${scheduleSummary} — ${t.habitMoreOptionsHint}`}</Text>
        )}

        <Collapsible open={showMore}>
          <>
        {/* ── Schedule — WHEN the habit happens. A habit is recurring by definition, so
               there is deliberately no repeat switch here (unlike a task): the only real
               question is which days. Was labelled "Interval", which said nothing; renamed
               to "How often" in the 2026-07-26 clarity pass and moved above the reminder,
               since the reminder is a nudge ABOUT this schedule, not a separate schedule. ── */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textMuted }]}>{t.habitHowOften}</Text>
          <SegmentedControl
            options={[
              { value: 'daily', label: t.habitRecurrenceDaily },
              { value: 'weekly', label: t.habitRecurrenceWeekly },
              { value: 'monthly', label: t.habitRecurrenceMonthly },
              { value: 'weekly-flexible', label: t.habitRecurrenceWeeklyFlexible },
            ]}
            value={recurrence}
            onChange={(v) => changeRecurrence(v as HabitRecurrence)}
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

        <FieldDivider />

        {/* Daily/weekly goal stepper — shown by default alongside Recurrence, same reasoning.
            Reuses the same `dailyGoal` field as a per-week target when recurrence is
            'weekly-flexible' (lib/habitRecurrence.ts) — only the label changes. */}
        <View style={[styles.field, styles.energyStepperRow]}>
          <Text style={[styles.label, { color: theme.textMuted }]}>
            {recurrence === 'weekly-flexible' ? t.habitWeeklyGoal : t.habitDailyGoal}
          </Text>
          <Stepper value={dailyGoal} onChange={setDailyGoal} min={1} max={20} accessibilityLabel={t.habitDailyGoal} />
        </View>

        <FieldDivider />

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

            <FieldDivider />

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

        {/* ── Bottom actions: Delete (left) · Discard / Save (right) — same icon+label row
               as components/TaskCard.tsx's editor, so making a habit and making a task end
               the same way (2026-07-26 consistency pass). Discard = leave without saving,
               which is what backing out of this screen has always done. ── */}
        <View style={styles.bottomActionsRow}>
          {isEdit ? (
            <PressableScale style={styles.smallActionBtn} onPress={confirmDelete} scaleTo={0.93} accessibilityRole="button" accessibilityLabel={t.habitDeleteLabel}>
              <Ionicons name="trash-outline" size={14} color={theme.bad} />
              <Text style={[styles.smallActionText, { color: theme.bad }]}>{t.habitDeleteLabel}</Text>
            </PressableScale>
          ) : (
            <View />
          )}
          <View style={styles.bottomActionsRight}>
            <PressableScale
              style={[styles.smallActionBtn, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5 }]}
              onPress={() => { tap(); router.back(); }}
              accessibilityRole="button"
              accessibilityLabel={t.taskDiscard}
              scaleTo={0.97}
            >
              <Ionicons name="close" size={14} color={theme.bad} />
              <Text style={[styles.smallActionText, { color: theme.bad }]}>{t.taskDiscard}</Text>
            </PressableScale>
            <PressableScale
              style={[styles.smallActionBtn, { backgroundColor: canSave ? theme.accent : theme.surfaceMuted, borderColor: canSave ? theme.accent : theme.border, borderWidth: 1.5, opacity: canSave ? 1 : 0.7 }]}
              onPress={save}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel={t.taskSave}
              scaleTo={0.97}
            >
              <Ionicons name="checkmark" size={14} color={canSave ? theme.accentInk : theme.textMuted} />
              <Text style={[styles.smallActionText, { color: canSave ? theme.accentInk : theme.textMuted }]}>{t.taskSave}</Text>
            </PressableScale>
          </View>
        </View>
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
  dayChip: { flex: 1, aspectRatio: AspectRatio.square, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  dayText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
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
  // Header "✓ Save" + the bottom Delete/Discard/Save row — deliberately the same shapes as
  // components/TaskCard.tsx's editor so both creation surfaces end identically.
  headerSaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerSaveText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  bottomActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md },
  bottomActionsRight: { flexDirection: 'row', gap: Spacing.xs },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
  },
  smallActionText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
});
