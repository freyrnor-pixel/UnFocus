/**
 * habit-form.tsx — add / edit a habit
 *
 * Sub-screen (Decision 001 tier='sub') for one habit: build/break kind, icon, title,
 * category, the four cue→craving→response→reward steps, daily goal, recurrence, an
 * optional child-profile assignment, and the three-mode daily reminder picker (Once /
 * Several times / Every…, Decision 016). An `id` route param switches it to edit mode
 * (with delete); a `kind` param pre-seeds build vs. break for new habits.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/Surface, components/FormControls,
 *             components/HintCard, components/HabitIcon, components/Button, components/AppModal,
 *             lib/haptics, lib/i18n, lib/useAppTheme, store/useHabitStore, store/useSettingsStore
 *   Used by → Expo Router route "/habit-form"; no caller wired yet (ported ahead of its
 *             mount, same pattern as every other Phase 5/6 screen so far — a future
 *             app/habits.tsx "+" affordance is the eventual entry point)
 *   Data    → useHabitStore (habits table) via add/update/remove; toggling the notification
 *             (or editing its recipe) reschedules the habit's reminders through the store
 *
 * Edit notes:
 *   - All visible strings go through useT(); colour theme comes from useAppTheme().
 *   - recurrenceDays is always saved as [] here (weekday selection not exposed in this
 *     form) — matches the old app; only 'daily' is offered since nothing else is enforced
 *     anywhere in the app yet.
 *   - **Decision 016 Q2 (drop mirror)**: no `notificationTime` field anywhere in this
 *     form or its save payload — `notificationTimes` is the sole source of truth.
 *   - **Decision 016 Q3 (recipe columns, 3B-ii)**: `reminderMode`/`reminderCount`/
 *     `reminderIntervalMin`/`reminderStart`/`reminderEnd` are saved alongside
 *     `notificationTimes` so re-opening a habit restores the exact mode that created it,
 *     instead of inferring "Several times" for anything with >1 saved time. Only the
 *     fields relevant to the current mode are persisted (others null) — see save().
 *     Legacy habits (or ones saved before this session) have `reminderMode === null` and
 *     fall back to the old length-based inference.
 *   - Essentials shown by default: Kind → Title → Notification. Icon, category, the four
 *     cue→craving→response→reward steps, daily goal, and recurrence live behind a "more
 *     options" disclosure (t.habits.moreOptions/fewerOptions) — same disclosure pattern
 *     as the old app.
 *   - No TimePickerWheel (never ported into this repo, same precedent as task-form.tsx) —
 *     every time field is a plain FormControls.Input (HH:MM text).
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useHabitStore,
  HabitKind,
  HabitCategory,
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
  const params = useLocalSearchParams<{ id?: string; kind?: string; childName?: string }>();
  const isEdit = !!params.id;

  const habits = useHabitStore((s) => s.habits);
  const addHabit = useHabitStore((s) => s.add);
  const updateHabit = useHabitStore((s) => s.update);
  const removeHabit = useHabitStore((s) => s.remove);
  const childProfiles = useSettingsStore((s) => s.childProfiles);

  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  const existing = isEdit ? habits.find((h) => h.id === params.id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'star-outline');
  const [kind, setKind] = useState<HabitKind>(existing?.kind ?? (params.kind === 'break' ? 'break' : 'build'));
  const [category, setCategory] = useState<HabitCategory>(existing?.category ?? 'other');
  const [cue, setCue] = useState(existing?.cue ?? '');
  const [craving, setCraving] = useState(existing?.craving ?? '');
  const [response, setResponse] = useState(existing?.response ?? '');
  const [reward, setReward] = useState(existing?.reward ?? '');
  const [dailyGoal, setDailyGoal] = useState(existing?.dailyGoal ?? 1);
  const [childName, setChildName] = useState(existing?.childName ?? (params.childName ?? ''));

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

  // Advanced fields start collapsed; open by default in edit mode if any already hold a value.
  const [showMore, setShowMore] = useState<boolean>(
    isEdit && !!(existing && (existing.cue || existing.craving || existing.response || existing.reward || existing.dailyGoal > 1 || existing.category !== 'other'))
  );

  function save() {
    if (!title.trim()) return;
    const notificationTimes = notificationEnabled ? reminderTimes : [];
    const payload = {
      title: title.trim(),
      icon,
      kind,
      category,
      cue,
      craving,
      response,
      reward,
      dailyGoal,
      recurrence: 'daily' as const,
      recurrenceDays: [],
      notificationEnabled,
      notificationTimes,
      reminderMode: notificationEnabled ? reminderMode : null,
      reminderCount: notificationEnabled && reminderMode === 'count' ? reminderCount : null,
      reminderIntervalMin: notificationEnabled && reminderMode === 'interval' ? reminderIntervalMin : null,
      reminderStart: notificationEnabled && reminderMode !== 'single' ? reminderStart : null,
      reminderEnd: notificationEnabled && reminderMode !== 'single' ? reminderEnd : null,
      childName,
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
    <ScreenScaffold
      title={isEdit ? t.habitFormEdit : t.habitFormTitle}
      tier="sub"
      onBack={() => router.back()}
      headerRight={
        <Pressable onPress={save} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.save}>
          <Ionicons name="checkmark" size={24} color={theme.accent} />
        </Pressable>
      }
    >
      <View style={styles.content}>
        <HintCard text={t.hints.habitForm.text} example={t.hints.habitForm.example} />

        {/* Kind */}
        <View style={styles.field}>
          <SegmentedControl
            options={[
              { value: 'build', label: `${t.habitKindBuild} ↑` },
              { value: 'break', label: `${t.habitKindBreak} ↓` },
            ]}
            value={kind}
            onChange={(v) => setKind(v as HabitKind)}
          />
        </View>

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

        {/* For — profile assignment */}
        {childProfiles.length > 0 && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.habitForLabel}</Text>
            <View style={styles.chipRow}>
              {(['', ...childProfiles] as string[]).map((name) => {
                const active = childName === name;
                return (
                  <Pressable
                    key={name || '__me__'}
                    style={[
                      styles.chip,
                      { backgroundColor: theme.surfaceMuted },
                      active && { backgroundColor: theme.accent },
                    ]}
                    onPress={() => {
                      tap();
                      setChildName(name);
                    }}
                  >
                    <Text style={[styles.chipText, { color: theme.text }, active && { color: theme.accentInk }]}>
                      {name || t.habitForMe}
                    </Text>
                  </Pressable>
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
                  placeholder="HH:MM"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            )}

            {reminderMode === 'count' && (
              <View style={styles.timeFieldWrap}>
                <Text style={[styles.label, { color: theme.textMuted }]}>{t.habitReminderCountLabel}</Text>
                <View style={styles.stepper}>
                  <Pressable
                    style={[styles.stepperBtn, { backgroundColor: theme.surfaceMuted }]}
                    onPress={() => setReminderCount((c) => Math.max(2, c - 1))}
                  >
                    <Text style={[styles.stepperBtnText, { color: theme.text }]}>−</Text>
                  </Pressable>
                  <Text style={[styles.stepperValue, { color: theme.text }]}>{reminderCount}</Text>
                  <Pressable
                    style={[styles.stepperBtn, { backgroundColor: theme.accent }]}
                    onPress={() => setReminderCount((c) => Math.min(12, c + 1))}
                  >
                    <Text style={[styles.stepperBtnText, { color: theme.accentInk }]}>+</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {reminderMode === 'interval' && (
              <View style={styles.timeFieldWrap}>
                <Text style={[styles.label, { color: theme.textMuted }]}>{t.habitReminderIntervalLabel}</Text>
                <View style={styles.chipRow}>
                  {INTERVAL_OPTIONS.map((min) => {
                    const active = reminderIntervalMin === min;
                    return (
                      <Pressable
                        key={min}
                        style={[
                          styles.chip,
                          { backgroundColor: theme.surfaceMuted },
                          active && { backgroundColor: theme.accent },
                        ]}
                        onPress={() => {
                          tap();
                          setReminderIntervalMin(min);
                        }}
                      >
                        <Text style={[styles.chipText, { color: theme.text }, active && { color: theme.accentInk }]}>
                          {min % 60 === 0 ? t.habitReminderEveryHours(min / 60) : t.habitReminderEveryMinutes(min)}
                        </Text>
                      </Pressable>
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
                  placeholder="HH:MM"
                  keyboardType="numbers-and-punctuation"
                />
                <Input
                  label={t.habitReminderEndLabel}
                  value={reminderEnd}
                  onChangeText={setReminderEnd}
                  placeholder="HH:MM"
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={[styles.reminderPreview, { color: theme.textMuted }]}>
                  {t.habitReminderTimesPreview(reminderTimes.length)} · {reminderTimes.join(' · ')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* More options disclosure */}
        <Pressable
          style={[styles.disclosure, { borderColor: theme.border }]}
          onPress={() => {
            tap();
            setShowMore((v) => !v);
          }}
        >
          <Text style={[styles.disclosureText, { color: theme.textMuted }]}>
            {showMore ? `${t.habits.fewerOptions} ↑` : `${t.habits.moreOptions} ↓`}
          </Text>
        </Pressable>

        {showMore && (
          <>
            {/* Icon picker */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textMuted }]}>{t.habitIconLabel}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.iconRow}>
                  {HABIT_ICON_NAMES.map((iconName) => {
                    const active = icon === iconName;
                    return (
                      <Pressable
                        key={iconName}
                        style={[
                          styles.iconBtn,
                          { backgroundColor: theme.surfaceMuted },
                          active && { backgroundColor: theme.accent },
                        ]}
                        onPress={() => {
                          tap();
                          setIcon(iconName);
                        }}
                      >
                        <HabitIcon icon={iconName} size={22} color={active ? theme.accentInk : theme.text} />
                      </Pressable>
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
                      <Pressable
                        key={cat}
                        style={[
                          styles.chip,
                          { backgroundColor: theme.surfaceMuted },
                          active && { backgroundColor: theme.accent },
                        ]}
                        onPress={() => {
                          tap();
                          setCategory(cat);
                        }}
                      >
                        <Text style={[styles.chipText, { color: theme.text }, active && { color: theme.accentInk }]}>
                          {t.habitCategories[cat]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Recurrence — only 'daily' behaves as labelled today; nothing else is enforced. */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textMuted }]}>{t.habitRecurrence}</Text>
              <SegmentedControl options={[{ value: 'daily', label: t.habitRecurrenceDaily }]} value="daily" onChange={() => {}} />
            </View>

            {/* Four steps: cue → craving → response → reward */}
            {([
              { key: 'cue', label: t.habitCue, placeholder: t.habitCuePlaceholder, value: cue, set: setCue },
              { key: 'craving', label: t.habitCraving, placeholder: t.habitCravingPlaceholder, value: craving, set: setCraving },
              { key: 'response', label: t.habitResponse, placeholder: t.habitResponsePlaceholder, value: response, set: setResponse },
              { key: 'reward', label: t.habitReward, placeholder: t.habitRewardPlaceholder, value: reward, set: setReward },
            ] as const).map(({ key, label, placeholder, value, set }) => (
              <View key={key} style={styles.field}>
                <Input label={label} value={value} onChangeText={set} placeholder={placeholder} returnKeyType="next" />
              </View>
            ))}

            {/* Daily goal stepper */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textMuted }]}>{t.habitDailyGoal}</Text>
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepperBtn, { backgroundColor: theme.surfaceMuted }]}
                  onPress={() => setDailyGoal((g) => Math.max(1, g - 1))}
                >
                  <Text style={[styles.stepperBtnText, { color: theme.text }]}>−</Text>
                </Pressable>
                <Text style={[styles.stepperValue, { color: theme.text }]}>{dailyGoal}</Text>
                <Pressable
                  style={[styles.stepperBtn, { backgroundColor: theme.accent }]}
                  onPress={() => setDailyGoal((g) => Math.min(20, g + 1))}
                >
                  <Text style={[styles.stepperBtnText, { color: theme.accentInk }]}>+</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {isEdit && (
          <Button label={t.habitDeleteLabel} variant="danger" onPress={confirmDelete} style={styles.deleteBtn} />
        )}
      </View>
    </ScreenScaffold>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.lg },
  field: { gap: Spacing.xs, paddingVertical: Spacing.sm },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full },
  chipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  notifLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  timeFieldWrap: { gap: Spacing.sm, marginTop: Spacing.sm },
  reminderPreview: { fontSize: FontSize.xs, fontStyle: 'italic', marginTop: Spacing.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepperBtn: { width: 40, height: 40, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { fontSize: FontSize.xl, fontWeight: '300', lineHeight: 40 },
  stepperValue: { fontSize: FontSize.xl, fontFamily: Fonts.bold, minWidth: 30, textAlign: 'center' },
  disclosure: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  disclosureText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  iconRow: { flexDirection: 'row', gap: Spacing.xs, paddingVertical: Spacing.xs },
  iconBtn: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { marginTop: Spacing.md },
});
