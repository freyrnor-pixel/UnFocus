/**
 * TaskCard.tsx — one task as an expandable row for the Tasks/Oppgaver screen.
 *
 * Two variants:
 *   - variant="full" (All-tasks): tap the row to open an inline editor. While the
 *     editor is open the card is in *edit mode* — a Discard / Save bar sits ABOVE the
 *     card and edits are buffered in a local draft (nothing persists until Save). The
 *     editor holds: an editable title, importance, a steps checklist, a "Repeat" switch
 *     + per-mode recurrence options, a "Start specific date" toggle + calendar, and an
 *     optional Start/Finish time-box pair. For an existing task, Steps and the
 *     Shared-out / Delete affordances persist immediately (they bypass the draft). A
 *     card with `isNew` starts expanded, has no title autoFocus (keeps the keyboard down
 *     on creation), and its steps live on `draft.steps` instead — there's no store row
 *     yet to write them to — until Save calls `onCommitNew(draft)`, whose caller
 *     (plans.tsx) creates the task then replays the buffered steps via `addStep`.
 *     Discard on a new card calls `onDiscardNew()` and drops any buffered steps.
 *   - variant="steps" (Today / This week): the row expands to show ONLY the steps
 *     checklist — no settings. A task with no steps has a card but no expand arrow.
 *
 * Every task and every step carries a checkmark circle. The task ↔ steps done-cascade
 * lives in useTaskStore (toggle / toggleStep), so tapping a circle here keeps them in
 * lockstep automatically for an existing task; a new card's steps just toggle in the draft.
 *
 * Connections:
 *   Imports → components/SlideSelector, components/TimeBoxInput, components/DatePickerCalendar,
 *             components/IconButton, components/FormControls (Switch), components/AppModal,
 *             components/PressableScale, constants/theme, lib/date, lib/haptics, lib/i18n, lib/id,
 *             lib/useAppTheme, store/useTaskStore
 *   Used by → app/(tabs)/plans.tsx
 *   Data    → reads the passed `task`; writes via useTaskStore (update/steps/remove/setSharedOut)
 *             for committed tasks; a new (draft) card writes nothing until onCommitNew fires.
 *
 * Edit notes:
 *   - There is no lock and no per-field immediate save for settings: the Discard/Save bar
 *     is the commit point. Only Shared-out and Delete bypass the draft outright; Steps
 *     bypass the draft for an existing task but are draft-buffered for `isNew`.
 *   - Day↔Week promote/demote: selecting all 7 weekdays promotes Week→Day; unselecting any
 *     weekday in Day demotes to Week with the remaining days (all in the draft).
 *   - Save is disabled while the title is blank, so blank tasks can't be created.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { dayOfWeekMon0 } from '@/lib/date';
import { tap, warning } from '@/lib/haptics';
import { generateId } from '@/lib/id';
import { Task, TaskStep, useTaskStore } from '@/store/useTaskStore';
import SlideSelector from '@/components/SlideSelector';
import TimeBoxInput from '@/components/TimeBoxInput';
import DatePickerCalendar from '@/components/DatePickerCalendar';
import IconButton from '@/components/IconButton';
import { Switch } from '@/components/FormControls';
import { showAppModal } from '@/components/AppModal';
import PressableScale from '@/components/PressableScale';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

type Props = {
  task: Task;
  /** "full" = All-tasks settings editor (Discard/Save); "steps" = Today/Week steps-only. */
  variant?: 'full' | 'steps';
  /** All-tasks-only: show the delete action in the editor. */
  showDelete?: boolean;
  /** All-tasks-only: show the "Shared out" toggle in the editor. */
  showShareOut?: boolean;
  /** Shared color cue (Today / This week views). */
  tinted?: boolean;
  /** Draft card for a not-yet-created task: starts expanded; Save → onCommitNew. */
  isNew?: boolean;
  /** New-card Save: hand the assembled draft back to the parent to persist. */
  onCommitNew?: (draft: Task) => void;
  /** New-card Discard: drop the draft in the parent. */
  onDiscardNew?: () => void;
  onToggleDone: (task: Task) => void;
};

export default function TaskCard({
  task,
  variant = 'full',
  showDelete,
  showShareOut,
  tinted,
  isNew,
  onCommitNew,
  onDiscardNew,
  onToggleDone,
}: Props) {
  const theme = useAppTheme();
  const t = useT();
  const update = useTaskStore((s) => s.update);
  const removeTask = useTaskStore((s) => s.remove);
  const addStep = useTaskStore((s) => s.addStep);
  const toggleStep = useTaskStore((s) => s.toggleStep);
  const removeStep = useTaskStore((s) => s.removeStep);
  const setSharedOut = useTaskStore((s) => s.setSharedOut);

  const stepsOnly = variant === 'steps';

  const [expanded, setExpanded] = useState(!!isNew);
  const [showCalendar, setShowCalendar] = useState(false);
  const [newStep, setNewStep] = useState('');
  // Buffered edits (full variant only). Initialised from the task on first expand.
  const [draft, setDraft] = useState<Task>(task);

  // A new (unsaved) card has no store row yet, so its steps live on the local draft
  // (buffered into task_steps by the parent's onCommitNew, alongside the task itself).
  const sortedSteps = [...(isNew ? draft.steps : task.steps)].sort((a, b) => a.orderIndex - b.orderIndex);
  const hasSteps = sortedSteps.length > 0;
  // Steps variant only expands when there ARE steps (no arrow otherwise); full always can.
  const canExpand = stepsOnly ? hasSteps : true;

  const editing = !stepsOnly && expanded;
  const recurring = draft.recurring;
  const isRecurring = recurring !== 'none';
  const showTimes = draft.hasStartDate || isRecurring;
  const modeValue = recurring === 'daily' ? 'daily' : recurring === 'monthly' ? 'monthly' : 'weekly';
  const canSave = draft.title.trim().length > 0;

  function patch(next: Partial<Task>) {
    setDraft((d) => ({ ...d, ...next }));
  }

  function openEditor() {
    if (!canExpand) return;
    if (stepsOnly) {
      setExpanded((v) => !v);
      return;
    }
    // Collapsing an open editor is a Discard (revert / drop the draft), so the only way
    // to keep edits is the Save button — never a silent partial write.
    if (expanded) {
      handleDiscard();
      return;
    }
    setDraft(task); // re-seed the draft from the latest persisted task
    setExpanded(true);
  }

  function handleSave() {
    tap();
    const trimmed = draft.title.trim();
    if (!trimmed) return;
    const taskType = draft.time && draft.finishTime ? 'time-box' : 'start-at';
    const committed: Task = { ...draft, title: trimmed, taskType };
    if (isNew) {
      onCommitNew?.(committed);
      return;
    }
    update(task.id, {
      title: trimmed,
      importance: draft.importance,
      hasStartDate: draft.hasStartDate,
      date: draft.date,
      time: draft.time,
      finishTime: draft.finishTime,
      taskType,
      recurring: draft.recurring,
      recurringDays: draft.recurringDays,
      weekInterval: draft.weekInterval,
      monthlyMode: draft.monthlyMode,
      monthDay: draft.monthDay,
      monthOrdinal: draft.monthOrdinal,
      monthWeekday: draft.monthWeekday,
    });
    setExpanded(false);
    setShowCalendar(false);
  }

  function handleDiscard() {
    tap();
    if (isNew) {
      onDiscardNew?.();
      return;
    }
    setDraft(task);
    setExpanded(false);
    setShowCalendar(false);
  }

  function toggleRepeat(on: boolean) {
    if (on) patch({ recurring: 'weekly', recurringDays: draft.recurringDays.length ? draft.recurringDays : [dayOfWeekMon0(new Date())] });
    else patch({ recurring: 'none' });
  }

  function setMode(mode: string) {
    if (mode === 'daily') patch({ recurring: 'daily' });
    else if (mode === 'weekly') {
      const days = draft.recurringDays.length ? draft.recurringDays : [dayOfWeekMon0(new Date())];
      patch({ recurring: 'weekly', recurringDays: days });
    } else patch({ recurring: 'monthly' });
  }

  function toggleWeekday(i: number) {
    if (recurring === 'daily') {
      patch({ recurring: 'weekly', recurringDays: ALL_DAYS.filter((d) => d !== i) });
      return;
    }
    const has = draft.recurringDays.includes(i);
    let days = has ? draft.recurringDays.filter((d) => d !== i) : [...draft.recurringDays, i];
    if (days.length === 0) return; // keep at least one weekday
    days = days.sort((a, b) => a - b);
    if (days.length === 7) {
      patch({ recurring: 'daily', recurringDays: days });
      return;
    }
    patch({ recurringDays: days });
  }

  function handleAddStep() {
    const title = newStep.trim();
    if (!title) return;
    if (isNew) {
      const orderIndex = draft.steps.length === 0 ? 0 : Math.max(...draft.steps.map((s) => s.orderIndex)) + 1;
      const step: TaskStep = { id: generateId(), taskId: draft.id, title, done: false, orderIndex };
      patch({ steps: [...draft.steps, step] });
    } else {
      addStep(task.id, title);
    }
    setNewStep('');
  }

  function handleToggleStep(id: string) {
    if (isNew) {
      patch({ steps: draft.steps.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) });
    } else {
      toggleStep(id);
    }
  }

  function handleRemoveStep(id: string) {
    if (isNew) {
      patch({ steps: draft.steps.filter((s) => s.id !== id) });
    } else {
      removeStep(id);
    }
  }

  function handleDelete() {
    warning();
    showAppModal(t.deleteConfirmTitle(task.title || t.taskTitlePlaceholder), t.deleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deleteConfirmBtn, style: 'destructive', onPress: () => removeTask(task.id) },
    ]);
  }

  return (
    <View style={styles.wrap}>
      {/* ── Discard / Save bar (edit mode, above the card) ── */}
      {editing && (
        <View style={styles.saveBar}>
          <PressableScale
            style={[styles.saveBtn, { backgroundColor: theme.surfaceMuted }]}
            onPress={handleDiscard}
            accessibilityRole="button"
            scaleTo={0.97}
          >
            <Text style={[styles.saveBtnText, { color: theme.textMuted }]}>{t.taskDiscard}</Text>
          </PressableScale>
          <PressableScale
            style={[styles.saveBtn, { backgroundColor: canSave ? theme.accent : theme.surfaceMuted, opacity: canSave ? 1 : 0.6 }]}
            onPress={handleSave}
            disabled={!canSave}
            accessibilityRole="button"
            scaleTo={0.95}
          >
            <Text style={[styles.saveBtnText, { color: canSave ? theme.accentInk : theme.textMuted }]}>{t.taskSave}</Text>
          </PressableScale>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: tinted ? theme.accentSoft : theme.surface, borderColor: editing ? theme.accent : theme.border }]}>
        {/* ── Collapsed row ── */}
        <View style={styles.row}>
          <PressableScale
            hitSlop={8}
            onPress={() => onToggleDone(task)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.done }}
            scaleTo={0.97}
          >
            <View
              style={[
                styles.circle,
                { borderColor: theme.border },
                task.done && { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}
            >
              {task.done && <Ionicons name="checkmark" size={14} color={theme.accentInk} />}
            </View>
          </PressableScale>

          <PressableScale style={styles.titleTap} onPress={openEditor} disabled={!canExpand} scaleTo={0.97}>
            <Text
              style={[
                styles.title,
                { color: theme.text },
                task.done && { textDecorationLine: 'line-through', color: theme.textMuted },
              ]}
              numberOfLines={1}
            >
              {task.title || t.taskTitlePlaceholder}
            </Text>
          </PressableScale>

          {task.time ? (
            <Text style={[styles.timeLabel, { color: theme.textMuted }]}>
              {task.finishTime ? `${task.time}–${task.finishTime}` : task.time}
            </Text>
          ) : null}

          {canExpand && (
            <PressableScale hitSlop={6} onPress={openEditor} style={styles.chevronBtn} scaleTo={0.9}>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted} />
            </PressableScale>
          )}
        </View>

        {/* ── Steps-only expansion (Today / This week) ── */}
        {stepsOnly && expanded && hasSteps && (
          <View style={styles.stepsWrap}>
            {sortedSteps.map((step) => (
              <PressableScale key={step.id} hitSlop={6} onPress={() => toggleStep(step.id)} style={styles.stepCheckTap} scaleTo={0.97}>
                <View
                  style={[
                    styles.stepCheck,
                    { borderColor: theme.border },
                    step.done && { backgroundColor: theme.accent, borderColor: theme.accent },
                  ]}
                >
                  {step.done && <Ionicons name="checkmark" size={12} color={theme.accentInk} />}
                </View>
                <Text
                  style={[
                    styles.stepText,
                    { color: theme.text },
                    step.done && { textDecorationLine: 'line-through', color: theme.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {step.title}
                </Text>
              </PressableScale>
            ))}
          </View>
        )}

        {/* ── Full editor (All tasks) ── */}
        {editing && (
          <View style={styles.editor}>
            {/* Editable title */}
            <TextInput
              style={[styles.titleInput, { color: theme.text, backgroundColor: theme.surfaceMuted }]}
              value={draft.title}
              onChangeText={(v) => patch({ title: v })}
              placeholder={t.taskTitlePlaceholder}
              placeholderTextColor={theme.textMuted}
              returnKeyType="done"
            />

            {/* Importance */}
            <SlideSelector
              options={[
                { value: 'regular', label: t.taskNormal },
                { value: 'essential', label: t.taskImportant },
              ]}
              value={draft.importance}
              onChange={(v) => patch({ importance: v as Task['importance'] })}
            />

            {/* Steps — persist immediately for existing tasks; buffered on the local draft
                for a new (isNew) card until Save creates the real task row. */}
            {hasSteps && (
              <View style={styles.stepsWrap}>
                {sortedSteps.map((step) => (
                  <View key={step.id} style={styles.stepRow}>
                    <PressableScale hitSlop={6} onPress={() => handleToggleStep(step.id)} style={styles.stepCheckTap} scaleTo={0.97}>
                      <View
                        style={[
                          styles.stepCheck,
                          { borderColor: theme.border },
                          step.done && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}
                      >
                        {step.done && <Ionicons name="checkmark" size={12} color={theme.accentInk} />}
                      </View>
                      <Text
                        style={[
                          styles.stepText,
                          { color: theme.text },
                          step.done && { textDecorationLine: 'line-through', color: theme.textMuted },
                        ]}
                        numberOfLines={1}
                      >
                        {step.title}
                      </Text>
                    </PressableScale>
                    <PressableScale hitSlop={6} onPress={() => handleRemoveStep(step.id)} scaleTo={0.9}>
                      <Ionicons name="close" size={16} color={theme.textMuted} />
                    </PressableScale>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.addStepRow}>
              <TextInput
                style={[styles.addStepInput, { color: theme.text, backgroundColor: theme.surfaceMuted }]}
                value={newStep}
                onChangeText={setNewStep}
                placeholder={t.stepPlaceholder}
                placeholderTextColor={theme.textMuted}
                returnKeyType="done"
                onSubmitEditing={handleAddStep}
              />
              <IconButton icon="add" label={t.stepPlaceholder} onPress={handleAddStep} size={30} />
            </View>

            {/* Repeat */}
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.taskRecurringToggle}</Text>
              <Switch checked={isRecurring} onChange={toggleRepeat} />
            </View>

            {/* Recurrence options */}
            {isRecurring && (
              <View style={styles.recurWrap}>
                <SlideSelector
                  options={[
                    { value: 'daily', label: t.taskRecurDay },
                    { value: 'weekly', label: t.taskRecurWeek },
                    { value: 'monthly', label: t.taskRecurMonth },
                  ]}
                  value={modeValue}
                  onChange={setMode}
                />

                {(recurring === 'daily' || recurring === 'weekly') && (
                  <View style={styles.weekdayRow}>
                    {t.dayLabels.map((label, i) => {
                      const active = recurring === 'daily' || draft.recurringDays.includes(i);
                      return (
                        <PressableScale
                          key={i}
                          style={[styles.weekdayChip, { backgroundColor: active ? theme.accent : theme.surfaceMuted }]}
                          onPress={() => toggleWeekday(i)}
                          scaleTo={0.97}
                        >
                          <Text style={[styles.weekdayText, { color: active ? theme.accentInk : theme.textMuted }]}>
                            {label.slice(0, 2)}
                          </Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                )}

                {recurring === 'weekly' && (
                  <SlideSelector
                    compact
                    options={[
                      { value: '1', label: t.taskWeekInterval1 },
                      { value: '2', label: t.taskWeekInterval2 },
                      { value: '3', label: t.taskWeekInterval3 },
                    ]}
                    value={String(draft.weekInterval || 1)}
                    onChange={(v) => patch({ weekInterval: Number(v) })}
                  />
                )}

                {recurring === 'monthly' && (
                  <View style={styles.monthWrap}>
                    <SlideSelector
                      compact
                      options={[
                        { value: 'day', label: t.taskMonthlyByDay },
                        { value: 'ordinal', label: t.taskMonthlyByWeekday },
                      ]}
                      value={draft.monthlyMode}
                      onChange={(v) => patch({ monthlyMode: v as Task['monthlyMode'] })}
                    />
                    {draft.monthlyMode === 'day' ? (
                      <View style={styles.monthDayRow}>
                        <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.taskMonthDayLabel}</Text>
                        <TextInput
                          style={[styles.monthDayInput, { color: theme.text, backgroundColor: theme.surfaceMuted }]}
                          value={String(draft.monthDay)}
                          onChangeText={(txt) => {
                            const n = Math.min(31, Math.max(1, parseInt(txt.replace(/\D/g, ''), 10) || 1));
                            patch({ monthDay: n });
                          }}
                          keyboardType="number-pad"
                          maxLength={2}
                        />
                      </View>
                    ) : (
                      <>
                        <SlideSelector
                          compact
                          options={[
                            { value: 'first', label: t.taskOrdFirst },
                            { value: 'second', label: t.taskOrdSecond },
                            { value: 'third', label: t.taskOrdThird },
                            { value: 'fourth', label: t.taskOrdFourth },
                            { value: 'last', label: t.taskOrdLast },
                          ]}
                          value={draft.monthOrdinal}
                          onChange={(v) => patch({ monthOrdinal: v as Task['monthOrdinal'] })}
                        />
                        <View style={styles.weekdayRow}>
                          {t.dayLabels.map((label, i) => {
                            const active = draft.monthWeekday === i;
                            return (
                              <PressableScale
                                key={i}
                                style={[styles.weekdayChip, { backgroundColor: active ? theme.accent : theme.surfaceMuted }]}
                                onPress={() => patch({ monthWeekday: i })}
                                scaleTo={0.97}
                              >
                                <Text style={[styles.weekdayText, { color: active ? theme.accentInk : theme.textMuted }]}>
                                  {label.slice(0, 2)}
                                </Text>
                              </PressableScale>
                            );
                          })}
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Start specific date */}
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.taskStartSpecificDate}</Text>
              <Switch checked={draft.hasStartDate} onChange={(on) => patch({ hasStartDate: on })} />
            </View>
            {draft.hasStartDate && (
              <View style={styles.dateWrap}>
                <IconButton
                  icon="calendar-outline"
                  label={t.dateLabel}
                  active={showCalendar}
                  onPress={() => setShowCalendar((v) => !v)}
                />
                {showCalendar && (
                  <DatePickerCalendar
                    value={draft.date}
                    onChange={(d) => {
                      patch({ date: d });
                      setShowCalendar(false);
                    }}
                    dayLabels={t.dayLabels}
                    monthLabels={t.months}
                    calendarLabels={t.calendar}
                  />
                )}
              </View>
            )}

            {/* Start / Finish */}
            {showTimes && (
              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
                  <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.taskStartLabel}</Text>
                  <TimeBoxInput value={draft.time} onChange={(v) => patch({ time: v || undefined })} />
                </View>
                <View style={styles.timeCol}>
                  <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.taskFinishLabel}</Text>
                  <TimeBoxInput value={draft.finishTime} onChange={(v) => patch({ finishTime: v || undefined })} />
                </View>
              </View>
            )}

            {/* Shared out toggle (persists immediately — emits an outgoing shared row) */}
            {showShareOut && !isNew && (
              <View style={styles.toggleRow}>
                <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.taskSharedOut}</Text>
                <Switch checked={task.sharedOut} onChange={(on) => setSharedOut(task.id, on)} />
              </View>
            )}

            {/* Delete (All tasks) */}
            {showDelete && !isNew && (
              <PressableScale style={styles.deleteRow} onPress={handleDelete} scaleTo={0.93}>
                <Ionicons name="trash-outline" size={16} color={theme.bad} />
                <Text style={[styles.deleteText, { color: theme.bad }]}>{t.deleteTask}</Text>
              </PressableScale>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  saveBar: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  saveBtn: {
    minHeight: 36,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  card: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 40 },
  circle: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTap: { flex: 1, paddingVertical: 4 },
  title: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  timeLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  chevronBtn: { padding: 2 },
  editor: { gap: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  titleInput: {
    minHeight: 44,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    fontFamily: Fonts.semibold,
  },
  stepsWrap: { gap: Spacing.xs, paddingTop: Spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  stepCheckTap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  stepCheck: {
    width: 18,
    height: 18,
    borderRadius: Radius.sm / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: FontSize.sm, flexShrink: 1 },
  addStepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  addStepInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.sm,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  dateWrap: { gap: Spacing.sm },
  timeRow: { flexDirection: 'row', gap: Spacing.lg },
  timeCol: { gap: 4 },
  miniLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  recurWrap: { gap: Spacing.sm },
  weekdayRow: { flexDirection: 'row', gap: 4, justifyContent: 'space-between' },
  weekdayChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  monthWrap: { gap: Spacing.sm },
  monthDayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  monthDayInput: {
    minWidth: 56,
    minHeight: 40,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
  deleteText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
