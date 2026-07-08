/**
 * task-form.tsx — add / edit a task
 *
 * Sub-screen (Decision 001 tier='sub') for creating or editing a single task: title,
 * date, time (or "Whenever"), type (start-at / time-box with duration), General/
 * Essential mode (Decision 018), weekly recurrence, steps, a freeform "next time"
 * hint (Decision 019), and a one-to-one "then → pick a task" follow-up link
 * (Decision 020). Presence of an `id` route param switches it into edit mode (with
 * a confirm-gated delete action).
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/Surface, components/FormControls,
 *             components/HintCard, components/ConfirmationBanner, components/DatePickerCalendar,
 *             components/IconButton, components/AppModal, lib/date, lib/haptics, lib/i18n,
 *             lib/useAppTheme, store/useTaskStore
 *   Used by → Expo Router route "/task-form"; pushed from anywhere that needs to add/edit a
 *             task (e.g. a future "+" affordance, plans rows) — no caller wired yet, this
 *             session ports the screen itself, per REBUILD_PLAN.md's "port ahead of mount" pattern
 *   Data    → useTaskStore (tasks table) via add/update/remove/setFollower; task_steps via
 *             addStep/toggleStep/removeStep/reorderStep (gated on an existing task,
 *             immediate-persist, no draft/save gate)
 *
 * Edit notes:
 *   - All visible strings go through useT(); date defaults to todayStr() (YYYY-MM-DD).
 *   - Edit vs. add is keyed off the `id` param resolved against the store; save()/performDelete()
 *     then router.back().
 *   - recurringDays is only persisted when recurring === 'weekly' (cleared to [] otherwise).
 *   - **No TimePickerWheel** — that component was never ported into this repo (Phase 3d's
 *     scope didn't include it). Time entry uses a plain FormControls.Input (HH:MM text),
 *     per this session's own instruction to use FormControls for all inputs, rather than
 *     porting a new bottom-sheet wheel component.
 *   - **Decision 020 "then" picker** is gated on `existing` (like Steps) — a predecessor
 *     must already have an id to link a follower to. Candidates exclude
 *     `useTaskStore.followerCycleChain(existing.id)` (self + every transitive predecessor)
 *     so picking one can never create a cycle. Follower changes call `setFollower()`
 *     immediately on tap — same immediate-persist pattern as Steps, not gated behind Save.
 *   - Decision 018: Importance is presented as General/Essential (existing `importance`
 *     field) — no energy/battery picker.
 *   - On save a ConfirmationBanner is shown, then navigation is briefly delayed (~900ms) so
 *     it's visible. Delete is confirm-gated via confirmDelete()/showAppModal.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTaskStore, TaskType, Recurring, Importance } from '@/store/useTaskStore';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { todayStr, dateStr, dayOfWeekMon0 } from '@/lib/date';
import { tap, warning } from '@/lib/haptics';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import { Checkbox, Input, SegmentedControl, Switch } from '@/components/FormControls';
import HintCard from '@/components/HintCard';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import DatePickerCalendar from '@/components/DatePickerCalendar';
import IconButton from '@/components/IconButton';
import Button from '@/components/Button';
import { showAppModal } from '@/components/AppModal';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';

function nextHourStr(): string {
  const h = (new Date().getHours() + 1) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}

const DURATION_CHIPS = [15, 20, 30, 45, 60, 90];

export default function TaskFormScreen() {
  const router = useRouter();
  const { id, title: titleParam } = useLocalSearchParams<{ id?: string; title?: string }>();
  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.add);
  const updateTask = useTaskStore((s) => s.update);
  const removeTask = useTaskStore((s) => s.remove);
  const setFollower = useTaskStore((s) => s.setFollower);
  const followerCycleChain = useTaskStore((s) => s.followerCycleChain);
  const addStep = useTaskStore((s) => s.addStep);
  const toggleStep = useTaskStore((s) => s.toggleStep);
  const removeStep = useTaskStore((s) => s.removeStep);
  const reorderStep = useTaskStore((s) => s.reorderStep);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  const existing = id ? tasks.find((task) => task.id === id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? titleParam ?? '');
  const [date, setDate] = useState(existing?.date ?? todayStr());
  const [timeEnabled, setTimeEnabled] = useState(existing ? !!existing.time : true);
  const [time, setTime] = useState(existing?.time ?? nextHourStr());
  const [taskType, setTaskType] = useState<TaskType>(existing?.taskType ?? 'start-at');
  const [duration, setDuration] = useState(String(existing?.durationMinutes ?? '30'));
  const [recurring, setRecurring] = useState<Recurring>(existing?.recurring ?? 'none');
  const [recurringDays, setRecurringDays] = useState<number[]>(existing?.recurringDays ?? []);
  const [importance, setImportance] = useState<Importance>(existing?.importance ?? 'regular');
  const [hint, setHint] = useState(existing?.hint ?? '');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [calExpanded, setCalExpanded] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState('');
  const [thenPickerOpen, setThenPickerOpen] = useState(false);

  const { dayLabels } = t;
  const sortedSteps = [...(existing?.steps ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);

  // Decision 020 — the task (if any) currently following this one. followsTaskId
  // lives on the FOLLOWER row, so this task's own follower is looked up by scanning
  // for whoever points back at it, not read off `existing` itself.
  const currentFollower = existing ? tasks.find((tk) => tk.followsTaskId === existing.id) : undefined;
  const followerCandidates = useMemo(() => {
    if (!existing) return [];
    const excluded = new Set(followerCycleChain(existing.id));
    return tasks.filter((tk) => !excluded.has(tk.id));
  }, [existing, tasks, followerCycleChain]);

  // Mon–Sun of the current calendar week, for one-tap date selection.
  const weekDays = useMemo(() => {
    const today = new Date();
    const mon0 = dayOfWeekMon0(today);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - mon0 + i);
      return { value: dateStr(d), dayIdx: i, dayNum: d.getDate() };
    });
  }, []);

  function toggleDay(d: number) {
    setRecurringDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  /** Build the localized "Reminder set …" / "Saved ✓" confirmation from the saved values. */
  function confirmationMessage(savedDate: string, savedTime: string | undefined): string {
    if (!savedTime) return t.taskSavedSimple;
    if (savedDate === todayStr()) return t.taskSavedReminderToday(savedTime);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (savedDate === dateStr(tomorrow)) {
      return t.taskSavedReminder(savedTime, t.tomorrow);
    }
    const mon0 = dayOfWeekMon0(new Date(savedDate + 'T12:00:00'));
    return t.taskSavedReminder(savedTime, t.dayFull[mon0]);
  }

  function save() {
    if (!title.trim()) return;
    const savedTime = timeEnabled ? time.trim() || undefined : undefined;
    const payload = {
      title: title.trim(),
      date,
      time: savedTime,
      taskType,
      durationMinutes: taskType === 'time-box' ? Number(duration) || 30 : undefined,
      done: existing?.done ?? false,
      recurring,
      recurringDays: recurring === 'weekly' ? recurringDays : [],
      importance,
      sortOrder: existing?.sortOrder ?? 0,
      hint: hint.trim(),
    };
    if (existing) {
      updateTask(existing.id, payload);
    } else {
      addTask(payload);
    }
    setConfirm(confirmationMessage(date, savedTime));
    // Let the banner land before leaving the form.
    setTimeout(() => router.back(), 900);
  }

  function performDelete() {
    if (existing) removeTask(existing.id);
    router.back();
  }

  function confirmDelete() {
    warning();
    showAppModal(t.deleteConfirmTitle(title || t.taskTitlePlaceholder), t.deleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deleteConfirmBtn, style: 'destructive', onPress: performDelete },
    ]);
  }

  function handleAddStep() {
    const stepTitle = newStepTitle.trim();
    if (!stepTitle || !existing) return;
    addStep(existing.id, stepTitle);
    setNewStepTitle('');
  }

  function pickFollower(followerId: string) {
    if (!existing) return;
    tap();
    setFollower(existing.id, followerId);
    setThenPickerOpen(false);
  }

  function removeFollower() {
    if (!existing || !currentFollower) return;
    tap();
    setFollower(existing.id, null);
  }

  return (
    <ScreenScaffold
      title={existing ? t.editTask : t.newTask}
      tier="sub"
      onBack={() => router.back()}
      headerRight={
        <Pressable onPress={save} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.save}>
          <Ionicons name="checkmark" size={24} color={theme.accent} />
        </Pressable>
      }
    >
      <View style={styles.content}>
        <HintCard text={t.hints.taskForm.text} example={t.hints.taskForm.example} />

        {/* Title */}
        <View style={styles.field}>
          <Input
            label={t.taskTitleLabel}
            value={title}
            onChangeText={setTitle}
            placeholder={t.taskTitlePlaceholder}
            returnKeyType="next"
          />
        </View>

        {/* Date — Mon–Sun chip row, with the full calendar collapsed behind a toggle */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textMuted }]}>{t.dateLabel}</Text>
          <View style={styles.weekRow}>
            {weekDays.map((wd) => {
              const active = date === wd.value;
              return (
                <Pressable
                  key={wd.value}
                  style={[
                    styles.weekChip,
                    { backgroundColor: theme.surfaceMuted },
                    active && { backgroundColor: theme.accent },
                  ]}
                  onPress={() => {
                    tap();
                    setDate(wd.value);
                    setCalExpanded(false);
                  }}
                >
                  <Text style={[styles.weekChipDay, { color: theme.textMuted }, active && { color: theme.accentInk }]}>
                    {dayLabels[wd.dayIdx].slice(0, 2)}
                  </Text>
                  <Text
                    style={[
                      styles.weekChipNum,
                      { color: theme.text },
                      active && { color: theme.accentInk, fontWeight: '700' },
                    ]}
                  >
                    {wd.dayNum}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <IconButton
            icon="calendar-outline"
            label={calExpanded ? t.hideCalendar : t.pickOtherDate(date)}
            active={calExpanded}
            style={styles.calToggleBtn}
            onPress={() => {
              tap();
              setCalExpanded((v) => !v);
            }}
          />
          {calExpanded && (
            <DatePickerCalendar
              value={date}
              onChange={(d) => {
                setDate(d);
                setCalExpanded(false);
              }}
              dayLabels={t.dayLabels}
              monthLabels={t.months}
              calendarLabels={t.calendar}
            />
          )}
        </View>

        {/* Time + Type — grouped in one card */}
        <Surface style={styles.card}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.timeLabel}</Text>
            <SegmentedControl
              options={[
                { value: 'set', label: t.timeModeSet },
                { value: 'whenever', label: t.timeModeWhenever },
              ]}
              value={timeEnabled ? 'set' : 'whenever'}
              onChange={(v) => {
                const isSet = v === 'set';
                setTimeEnabled(isSet);
                if (!isSet) setTime(nextHourStr());
              }}
            />
            {timeEnabled ? (
              <Input value={time} onChangeText={setTime} placeholder={t.timeInputPlaceholder} keyboardType="numbers-and-punctuation" />
            ) : (
              <Text style={[styles.wheneverHint, { color: theme.textMuted }]}>{t.wheneverHint}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.typeLabel}</Text>
            <SegmentedControl
              options={[
                { value: 'start-at', label: t.typeStartAt },
                { value: 'time-box', label: t.typeTimeBox },
              ]}
              value={taskType}
              onChange={(v) => setTaskType(v as TaskType)}
            />
          </View>
        </Surface>

        {/* Duration */}
        {taskType === 'time-box' && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.durationLabel}</Text>
            <View style={styles.durationRow}>
              {DURATION_CHIPS.map((m) => {
                const active = duration === String(m);
                return (
                  <Pressable
                    key={m}
                    style={[
                      styles.durationChip,
                      { backgroundColor: theme.surfaceMuted },
                      active && { backgroundColor: theme.accent },
                    ]}
                    onPress={() => {
                      tap();
                      setDuration(String(m));
                    }}
                  >
                    <Text style={[styles.durationText, { color: theme.text }, active && { color: theme.accentInk, fontWeight: '700' }]}>
                      {m}m
                    </Text>
                  </Pressable>
                );
              })}
              <View style={styles.durationInputWrap}>
                <Input
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="number-pad"
                  placeholder={t.durationPlaceholder}
                />
              </View>
            </View>
          </View>
        )}

        {/* Mode — Decision 018 (General/Essential, no energy picker) */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textMuted }]}>{t.importanceLabel}</Text>
          <SegmentedControl
            options={[
              { value: 'regular', label: t.importanceRegular },
              { value: 'essential', label: t.importanceEssential },
            ]}
            value={importance}
            onChange={(v) => setImportance(v as Importance)}
          />
        </View>

        {/* Recurring */}
        <View style={styles.field}>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.textMuted }]}>{t.repeatWeekly}</Text>
            <Switch checked={recurring === 'weekly'} onChange={(v) => setRecurring(v ? 'weekly' : 'none')} />
          </View>
          {recurring === 'weekly' && (
            <View style={styles.daysRow}>
              {dayLabels.map((label, i) => {
                const active = recurringDays.includes(i);
                return (
                  <Pressable
                    key={i}
                    style={[
                      styles.dayChip,
                      { backgroundColor: theme.surfaceMuted },
                      active && { backgroundColor: theme.accent },
                    ]}
                    onPress={() => toggleDay(i)}
                  >
                    <Text style={[styles.dayText, { color: theme.text }, active && { color: theme.accentInk }]}>
                      {label.slice(0, 2)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Hint — Decision 019, freeform "next time" note, display-only */}
        <View style={styles.field}>
          <Input
            label={t.taskHintLabel}
            value={hint}
            onChangeText={setHint}
            placeholder={t.taskHintPlaceholder}
            multiline
          />
        </View>

        {/* Then — Decision 020, one-to-one follower link, surfacing-only */}
        {existing && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.thenTaskLabel}</Text>
            {currentFollower ? (
              <View style={[styles.thenRow, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.thenRowText, { color: theme.text }]} numberOfLines={1}>
                  {currentFollower.title}
                </Text>
                <IconButton icon="close-circle" label={t.thenTaskRemove} onPress={removeFollower} size={28} />
              </View>
            ) : (
              <>
                <Text style={[styles.wheneverHint, { color: theme.textMuted }]}>{t.thenTaskNone}</Text>
                <Button
                  label={t.thenTaskPick}
                  variant="secondary"
                  size="sm"
                  onPress={() => setThenPickerOpen((v) => !v)}
                  style={styles.thenPickBtn}
                />
              </>
            )}
            {thenPickerOpen && !currentFollower && (
              <View style={[styles.thenPickerList, { backgroundColor: theme.surfaceMuted }]}>
                {followerCandidates.length === 0 ? (
                  <Text style={[styles.wheneverHint, { color: theme.textMuted }]}>{t.thenTaskEmptyList}</Text>
                ) : (
                  followerCandidates.map((candidate, i) => (
                    <Pressable
                      key={candidate.id}
                      style={[
                        styles.thenPickerRow,
                        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                      ]}
                      onPress={() => pickFollower(candidate.id)}
                    >
                      <Text style={[styles.thenPickerRowText, { color: theme.text }]} numberOfLines={1}>
                        {candidate.title}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* Steps — immediate-persist checklist */}
        {existing && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textMuted }]}>{t.stepsLabel}</Text>
            {sortedSteps.map((step, i) => (
              <View
                key={step.id}
                style={[
                  styles.stepRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                ]}
              >
                <Checkbox checked={step.done} onChange={() => toggleStep(step.id)} label={step.title} />
                <View style={styles.stepActions}>
                  <Pressable
                    onPress={() => reorderStep(step.id, 'up')}
                    disabled={i === 0}
                    hitSlop={8}
                    style={i === 0 && { opacity: 0.3 }}
                  >
                    <Ionicons name="chevron-up" size={16} color={theme.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => reorderStep(step.id, 'down')}
                    disabled={i === sortedSteps.length - 1}
                    hitSlop={8}
                    style={i === sortedSteps.length - 1 && { opacity: 0.3 }}
                  >
                    <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
                  </Pressable>
                  <Pressable onPress={() => removeStep(step.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={theme.bad} />
                  </Pressable>
                </View>
              </View>
            ))}
            <View
              style={[
                styles.addStepRow,
                sortedSteps.length > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
              ]}
            >
              <View style={styles.addStepInputWrap}>
                <Input
                  value={newStepTitle}
                  onChangeText={setNewStepTitle}
                  placeholder={t.stepPlaceholder}
                  returnKeyType="done"
                  onSubmitEditing={handleAddStep}
                />
              </View>
              <IconButton icon="add" label={t.stepPlaceholder} onPress={handleAddStep} />
            </View>
          </View>
        )}

        {existing && (
          <Button label={t.deleteTask} variant="danger" onPress={confirmDelete} style={styles.deleteBtn} />
        )}
      </View>

      <ConfirmationBanner message={confirm} onDismiss={() => setConfirm(null)} />
    </ScreenScaffold>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.lg },
  field: { gap: Spacing.xs, paddingVertical: Spacing.sm },
  card: { gap: Spacing.md, padding: Spacing.md },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  wheneverHint: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' },
  durationChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  durationText: { fontSize: FontSize.sm },
  durationInputWrap: { width: 70 },
  weekRow: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'space-between' },
  weekChip: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', gap: 2 },
  weekChipDay: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  weekChipNum: { fontSize: FontSize.sm },
  calToggleBtn: { alignSelf: 'flex-start' },
  daysRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
  dayChip: { width: 44, height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  thenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  thenRowText: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.medium },
  thenPickBtn: { alignSelf: 'flex-start' },
  thenPickerList: { borderRadius: Radius.md, marginTop: Spacing.xs, overflow: 'hidden' },
  thenPickerRow: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  thenPickerRowText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
  deleteBtn: { marginTop: Spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  stepActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  addStepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  addStepInputWrap: { flex: 1 },
});
