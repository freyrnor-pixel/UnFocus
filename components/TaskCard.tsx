/**
 * TaskCard.tsx — one task as an expandable, inline-editable row (Tasks/Oppgaver screen).
 *
 * Collapsed: a circle checkbox, the title, a read-only start-time label, and a
 * recurring-toggle icon. Tapping the body expands an inline editor (gated by the
 * section's `editable` flag): importance, a steps checklist, a "Start specific date"
 * toggle with calendar, an optional Start/Finish time-box pair, and — when the task
 * recurs — a Day/Week/Month selector with per-mode options (weekday multi-select +
 * week-interval, or day-of-month / nth-weekday). All edits persist immediately via
 * useTaskStore; there is no separate save step (mirrors the Shopping inline pattern).
 *
 * Connections:
 *   Imports → components/SlideSelector, components/TimeBoxInput, components/DatePickerCalendar,
 *             components/IconButton, components/FormControls (Switch, Checkbox), components/AppModal,
 *             constants/theme, lib/date, lib/haptics, lib/i18n, lib/useAppTheme, store/useTaskStore
 *   Used by → app/(tabs)/plans.tsx
 *   Data    → reads the passed `task`; writes via useTaskStore (update/steps/remove/setSharedOut)
 *
 * Edit notes:
 *   - Day↔Week promote/demote: selecting all 7 weekdays promotes Week→Day; unselecting any
 *     weekday in Day demotes to Week with the remaining days (store stays the source of truth).
 *   - Start/Finish only appears once the task is dated or recurring (a pure "Whenever" task has
 *     no fixed time). Setting a Finish flips taskType to 'time-box'; the store derives duration.
 *   - `editable` is the lock/tab gate; `showDelete`/`showShareOut` are All-tasks-only affordances.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { todayStr, dayOfWeekMon0 } from '@/lib/date';
import { tap, warning } from '@/lib/haptics';
import { Task, useTaskStore } from '@/store/useTaskStore';
import SlideSelector from '@/components/SlideSelector';
import TimeBoxInput from '@/components/TimeBoxInput';
import DatePickerCalendar from '@/components/DatePickerCalendar';
import IconButton from '@/components/IconButton';
import { Switch } from '@/components/FormControls';
import { showAppModal } from '@/components/AppModal';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

type Props = {
  task: Task;
  /** Lock/tab gate — when false the expanded editors are read-only. */
  editable: boolean;
  /** Whether the row can expand to the inline editor (default true). */
  expandable?: boolean;
  /** All-tasks-only: show the delete action in the editor. */
  showDelete?: boolean;
  /** All-tasks-only: show the "Shared out" toggle in the editor. */
  showShareOut?: boolean;
  /** Shared color cue (Today / This week views). */
  tinted?: boolean;
  onToggleDone: (task: Task) => void;
};

export default function TaskCard({
  task,
  editable,
  expandable = true,
  showDelete,
  showShareOut,
  tinted,
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

  const [expanded, setExpanded] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [newStep, setNewStep] = useState('');

  const recurring = task.recurring;
  const isRecurring = recurring !== 'none';
  const showTimes = task.hasStartDate || isRecurring;
  const sortedSteps = [...task.steps].sort((a, b) => a.orderIndex - b.orderIndex);

  function toggleRecurring() {
    if (!editable) return;
    tap();
    if (recurring === 'none') {
      update(task.id, { recurring: 'weekly', recurringDays: [dayOfWeekMon0(new Date())] });
    } else {
      update(task.id, { recurring: 'none' });
    }
  }

  function setMode(mode: string) {
    if (!editable) return;
    if (mode === 'daily') update(task.id, { recurring: 'daily' });
    else if (mode === 'weekly') {
      const days = task.recurringDays.length ? task.recurringDays : [dayOfWeekMon0(new Date())];
      update(task.id, { recurring: 'weekly', recurringDays: days });
    } else {
      update(task.id, { recurring: 'monthly' });
    }
  }

  function toggleWeekday(i: number) {
    if (!editable) return;
    if (recurring === 'daily') {
      // Unselecting a day in "Day" demotes to "Week" with the remaining days.
      update(task.id, { recurring: 'weekly', recurringDays: ALL_DAYS.filter((d) => d !== i) });
      return;
    }
    const has = task.recurringDays.includes(i);
    let days = has ? task.recurringDays.filter((d) => d !== i) : [...task.recurringDays, i];
    if (days.length === 0) return; // keep at least one weekday
    days = days.sort((a, b) => a - b);
    if (days.length === 7) {
      update(task.id, { recurring: 'daily', recurringDays: days });
      return;
    }
    update(task.id, { recurringDays: days });
  }

  function handleAddStep() {
    const title = newStep.trim();
    if (!title) return;
    addStep(task.id, title);
    setNewStep('');
  }

  function handleDelete() {
    warning();
    showAppModal(t.deleteConfirmTitle(task.title || t.taskTitlePlaceholder), t.deleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deleteConfirmBtn, style: 'destructive', onPress: () => removeTask(task.id) },
    ]);
  }

  const modeValue = recurring === 'daily' ? 'daily' : recurring === 'monthly' ? 'monthly' : 'weekly';

  return (
    <View style={[styles.card, { backgroundColor: tinted ? theme.accentSoft : theme.surface, borderColor: theme.border }]}>
      {/* ── Collapsed row ── */}
      <View style={styles.row}>
        <Pressable
          hitSlop={8}
          onPress={() => onToggleDone(task)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done }}
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
        </Pressable>

        <Pressable
          style={styles.titleTap}
          onPress={() => expandable && setExpanded((v) => !v)}
          disabled={!expandable}
        >
          <Text
            style={[
              styles.title,
              { color: theme.text },
              task.done && { textDecorationLine: 'line-through', color: theme.textMuted },
            ]}
            numberOfLines={1}
          >
            {task.title}
          </Text>
        </Pressable>

        {task.time ? (
          <Text style={[styles.timeLabel, { color: theme.textMuted }]}>
            {task.finishTime ? `${task.time}–${task.finishTime}` : task.time}
          </Text>
        ) : null}

        <IconButton
          icon="repeat"
          label={t.taskRecurringToggle}
          onPress={toggleRecurring}
          size={30}
          active={isRecurring}
          disabled={!editable}
        />

        {expandable && (
          <Pressable hitSlop={6} onPress={() => setExpanded((v) => !v)} style={styles.chevronBtn}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted} />
          </Pressable>
        )}
      </View>

      {/* ── Expanded editor ── */}
      {expanded && expandable && (
        <View style={styles.editor}>
          {/* Importance */}
          <SlideSelector
            options={[
              { value: 'regular', label: t.taskNormal },
              { value: 'essential', label: t.taskImportant },
            ]}
            value={task.importance}
            onChange={(v) => editable && update(task.id, { importance: v as Task['importance'] })}
            disabled={!editable}
          />

          {/* Steps */}
          {sortedSteps.length > 0 && (
            <View style={styles.stepsWrap}>
              {sortedSteps.map((step) => (
                <View key={step.id} style={styles.stepRow}>
                  <Pressable hitSlop={6} onPress={() => toggleStep(step.id)} style={styles.stepCheckTap}>
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
                  </Pressable>
                  {editable && (
                    <Pressable hitSlop={6} onPress={() => removeStep(step.id)}>
                      <Ionicons name="close" size={16} color={theme.textMuted} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}
          {editable && (
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
          )}

          {/* Start specific date */}
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.taskStartSpecificDate}</Text>
            <Switch
              checked={task.hasStartDate}
              onChange={(on) => editable && update(task.id, { hasStartDate: on })}
              disabled={!editable}
            />
          </View>
          {task.hasStartDate && (
            <View style={styles.dateWrap}>
              <IconButton
                icon="calendar-outline"
                label={t.dateLabel}
                active={showCalendar}
                onPress={() => setShowCalendar((v) => !v)}
              />
              {showCalendar && (
                <DatePickerCalendar
                  value={task.date}
                  onChange={(d) => {
                    if (editable) update(task.id, { date: d });
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
                <TimeBoxInput
                  value={task.time}
                  readOnly={!editable}
                  onChange={(v) =>
                    update(task.id, {
                      time: v || undefined,
                      taskType: task.finishTime && v ? 'time-box' : 'start-at',
                    })
                  }
                />
              </View>
              <View style={styles.timeCol}>
                <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.taskFinishLabel}</Text>
                <TimeBoxInput
                  value={task.finishTime}
                  readOnly={!editable}
                  onChange={(v) =>
                    update(task.id, {
                      finishTime: v || undefined,
                      taskType: v ? 'time-box' : 'start-at',
                    })
                  }
                />
              </View>
            </View>
          )}

          {/* Recurrence editor */}
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
                disabled={!editable}
              />

              {/* Day / Week → weekday multi-select */}
              {(recurring === 'daily' || recurring === 'weekly') && (
                <View style={styles.weekdayRow}>
                  {t.dayLabels.map((label, i) => {
                    const active = recurring === 'daily' || task.recurringDays.includes(i);
                    return (
                      <Pressable
                        key={i}
                        style={[
                          styles.weekdayChip,
                          { backgroundColor: active ? theme.accent : theme.surfaceMuted },
                        ]}
                        onPress={() => toggleWeekday(i)}
                        disabled={!editable}
                      >
                        <Text style={[styles.weekdayText, { color: active ? theme.accentInk : theme.textMuted }]}>
                          {label.slice(0, 2)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Week → interval */}
              {recurring === 'weekly' && (
                <SlideSelector
                  compact
                  options={[
                    { value: '1', label: t.taskWeekInterval1 },
                    { value: '2', label: t.taskWeekInterval2 },
                    { value: '3', label: t.taskWeekInterval3 },
                  ]}
                  value={String(task.weekInterval || 1)}
                  onChange={(v) => editable && update(task.id, { weekInterval: Number(v) })}
                  disabled={!editable}
                />
              )}

              {/* Month → day-of-month or nth-weekday */}
              {recurring === 'monthly' && (
                <View style={styles.monthWrap}>
                  <SlideSelector
                    compact
                    options={[
                      { value: 'day', label: t.taskMonthlyByDay },
                      { value: 'ordinal', label: t.taskMonthlyByWeekday },
                    ]}
                    value={task.monthlyMode}
                    onChange={(v) => editable && update(task.id, { monthlyMode: v as Task['monthlyMode'] })}
                    disabled={!editable}
                  />
                  {task.monthlyMode === 'day' ? (
                    <View style={styles.monthDayRow}>
                      <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.taskMonthDayLabel}</Text>
                      <TextInput
                        style={[styles.monthDayInput, { color: theme.text, backgroundColor: theme.surfaceMuted }]}
                        value={String(task.monthDay)}
                        onChangeText={(txt) => {
                          if (!editable) return;
                          const n = Math.min(31, Math.max(1, parseInt(txt.replace(/\D/g, ''), 10) || 1));
                          update(task.id, { monthDay: n });
                        }}
                        keyboardType="number-pad"
                        maxLength={2}
                        editable={editable}
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
                        value={task.monthOrdinal}
                        onChange={(v) => editable && update(task.id, { monthOrdinal: v as Task['monthOrdinal'] })}
                        disabled={!editable}
                      />
                      <View style={styles.weekdayRow}>
                        {t.dayLabels.map((label, i) => {
                          const active = task.monthWeekday === i;
                          return (
                            <Pressable
                              key={i}
                              style={[
                                styles.weekdayChip,
                                { backgroundColor: active ? theme.accent : theme.surfaceMuted },
                              ]}
                              onPress={() => editable && update(task.id, { monthWeekday: i })}
                              disabled={!editable}
                            >
                              <Text style={[styles.weekdayText, { color: active ? theme.accentInk : theme.textMuted }]}>
                                {label.slice(0, 2)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Shared out toggle (All tasks) */}
          {showShareOut && (
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.taskSharedOut}</Text>
              <Switch
                checked={task.sharedOut}
                onChange={(on) => editable && setSharedOut(task.id, on)}
                disabled={!editable}
              />
            </View>
          )}

          {/* Delete (All tasks) */}
          {showDelete && editable && (
            <Pressable style={styles.deleteRow} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={16} color={theme.bad} />
              <Text style={[styles.deleteText, { color: theme.bad }]}>{t.deleteTask}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 40 },
  circle: {
    width: 24,
    height: 24,
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
  stepsWrap: { gap: Spacing.xs },
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
