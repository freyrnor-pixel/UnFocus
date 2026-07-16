/**
 * TaskCard.tsx — one task as an expandable row for the Tasks/Oppgaver screen.
 *
 * Two variants:
 *   - variant="full" (All-tasks): tap the row to open an inline editor. While the
 *     editor is open the card is in *edit mode* — small Discard / Save buttons sit at the
 *     BOTTOM of the expanded editor (next to Delete) and edits are buffered in a local
 *     draft (nothing persists until Save). The editor holds: an editable title, importance,
 *     a steps checklist, a "Repeat" switch + per-mode recurrence options, a "Set time"
 *     toggle + calendar, and an
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
 * Row anatomy (2026-07-13 color-rail redesign): the collapsed row is
 * `[sent chip?] · title · assignee · time · ◯ circle · ⌄ chevron` — the done-circle sits to
 * the RIGHT of the title and LEFT of the chevron (was far-left). A `railColor` prop paints a
 * 4px domain-hue left rail so a card reads as belonging to its section; `sharedDirection="out"`
 * adds a leading ↑ "Sent" chip in the merged Shared section. The done circle/steps fill with
 * `theme.good` (status green, both modes) — never the section hue — so "done" never collides
 * with a domain color.
 *
 * Connections:
 *   Imports → components/SlideSelector, components/TimeBoxInput, components/DatePickerCalendar,
 *             components/IconButton, components/FormControls (Switch), components/AppModal,
 *             components/PressableScale, components/Collapsible + components/AnimatedChevron (animated
 *             steps/editor reveal + rotating chevron), constants/theme (incl. getElevation), lib/date, lib/haptics, lib/i18n, lib/id,
 *             lib/useAppTheme, store/useTaskStore, store/useSettingsStore (People/family mode:
 *             peopleModeEnabled + childProfiles gate the "For" assignee chip row)
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
 *   - **Collapse = keep-as-unfinished (2026-07-12)**: tapping the chevron to close an open
 *     editor SAVES whatever's there (the task is simply not-done until ticked) rather than
 *     discarding — the up-arrow is never a destructive X. Only a brand-new card with no
 *     title is dropped (nothing to keep). Explicit Discard stays the deliberate abandon path.
 *   - **Purposeful Depth System (2026-07-14)**: the card's static resting elevation is
 *     `getElevation('raised', theme.shadow)`; while `editing` it bumps to `'floating'` —
 *     the deepest thing on screen, anchoring attention on the card being worked on
 *     (focus-pop). Reuses the already-tracked `editing` boolean, no new state.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, FontSize, Radius, Spacing, contrastOn, getElevation } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { dayOfWeekMon0 } from '@/lib/date';
import { tap, warning } from '@/lib/haptics';
import { generateId } from '@/lib/id';
import { Task, TaskStep, useTaskStore } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import SlideSelector from '@/components/SlideSelector';
import TimeBoxInput from '@/components/TimeBoxInput';
import DatePickerCalendar from '@/components/DatePickerCalendar';
import IconButton from '@/components/IconButton';
import { Switch } from '@/components/FormControls';
import { showAppModal } from '@/components/AppModal';
import PressableScale from '@/components/PressableScale';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';

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
  /** Domain-hue left rail (color-rail layout — 2026-07-13 redesign). 4px left border. */
  railColor?: string;
  /** Shared-section direction cue: 'out' shows a leading ↑ "Sent" chip on the collapsed row. */
  sharedDirection?: 'in' | 'out';
  /** Draft card for a not-yet-created task: starts expanded; Save → onCommitNew. */
  isNew?: boolean;
  /** New-card Save: hand the assembled draft back to the parent to persist. */
  onCommitNew?: (draft: Task) => void;
  /** New-card Discard: drop the draft in the parent. */
  onDiscardNew?: () => void;
  onToggleDone: (task: Task) => void;
};

function TaskCard({
  task,
  variant = 'full',
  showDelete,
  showShareOut,
  tinted,
  railColor,
  sharedDirection,
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
  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled);
  const childProfiles = useSettingsStore((s) => s.childProfiles);
  const showPeople = peopleModeEnabled && childProfiles.length > 0;

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
    // Collapsing an open editor KEEPS the task as unfinished (2026-07-12 redesign):
    // the up-arrow saves whatever's there and closes, rather than destroying it. A task
    // is simply not-done until its circle is ticked, so "collapse" never means "discard".
    // The only exception is a brand-new card with no title (nothing to keep) — that's
    // dropped. Explicit Discard stays the deliberate way to abandon edits/delete a draft.
    if (expanded) {
      if (canSave) handleSave();
      else if (isNew) onDiscardNew?.();
      else handleDiscard();
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
      assignee: draft.assignee,
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
      <View
        style={[
          styles.card,
          getElevation(editing ? 'floating' : 'raised', theme.shadow),
          { backgroundColor: tinted ? theme.accentSoft : theme.surface, borderColor: editing ? theme.accent : theme.border },
          railColor && { borderLeftWidth: 4, borderLeftColor: railColor },
        ]}
      >
        {/* ── Collapsed row ── */}
        {/* Anatomy (2026-07-13 redesign): [sent chip?] · title (flex) · assignee · time · ◯ circle · ⌄ chevron.
            The done-circle sits to the RIGHT of the title and to the LEFT of the expand chevron. */}
        <View style={styles.row}>
          {sharedDirection === 'out' && (
            <View style={[styles.dirChip, { backgroundColor: railColor ? railColor : theme.surfaceMuted }]}>
              <Ionicons name="arrow-up" size={11} color={railColor ? contrastOn(railColor) : theme.textMuted} />
              <Text style={[styles.dirChipText, { color: railColor ? contrastOn(railColor) : theme.textMuted }]}>{t.tasksSharedSent}</Text>
            </View>
          )}

          <PressableScale style={styles.titleTap} onPress={openEditor} disabled={!canExpand} scaleTo={0.97}>
            <Text
              style={[
                styles.title,
                { color: theme.text },
                task.done && { textDecorationLine: 'line-through', color: theme.textMuted },
              ]}
              numberOfLines={1}
            >
              {task.title || (editing ? '' : t.taskTitlePlaceholder)}
            </Text>
          </PressableScale>

          {showPeople && task.assignee ? (
            <View style={[styles.assigneeCue, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
              <Ionicons name="person" size={11} color={theme.textMuted} />
              <Text style={[styles.assigneeCueText, { color: theme.textMuted }]} numberOfLines={1}>{task.assignee}</Text>
            </View>
          ) : null}

          {task.time ? (
            <Text style={[styles.timeLabel, { color: theme.textMuted }]}>
              {task.finishTime ? `${task.time}–${task.finishTime}` : task.time}
            </Text>
          ) : null}

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
                // Idle ring uses textMuted (not the near-invisible border token) so the
                // unchecked circle clearly reads as a tappable target. Done = good fill.
                { borderColor: theme.textMuted },
                task.done && { backgroundColor: theme.good, borderColor: theme.good },
              ]}
            >
              {task.done && <Ionicons name="checkmark" size={14} color={contrastOn(theme.good)} />}
            </View>
          </PressableScale>

          {canExpand && (
            <PressableScale hitSlop={6} onPress={openEditor} style={styles.chevronBtn} scaleTo={0.9}>
              <AnimatedChevron open={expanded} size={18} color={theme.textMuted} />
            </PressableScale>
          )}
        </View>

        {/* ── Steps-only expansion (Today / This week) ── */}
        {stepsOnly && hasSteps && (
          <Collapsible open={expanded}>
          <View style={styles.stepsWrap}>
            {sortedSteps.map((step) => (
              <PressableScale key={step.id} hitSlop={6} onPress={() => toggleStep(step.id)} style={styles.stepCheckTap} scaleTo={0.97}>
                <View
                  style={[
                    styles.stepCheck,
                    { borderColor: theme.textMuted },
                    step.done && { backgroundColor: theme.good, borderColor: theme.good },
                  ]}
                >
                  {step.done && <Ionicons name="checkmark" size={12} color={contrastOn(theme.good)} />}
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
          </Collapsible>
        )}

        {/* ── Full editor (All tasks) ── */}
        {!stepsOnly && (
          <Collapsible open={editing}>
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

            {/* For — person/profile assignment (People/family mode). Mirrors habit-form. */}
            {showPeople && (
              <View style={styles.forRow}>
                <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.habitForLabel}</Text>
                <View style={styles.forChips}>
                  {(['', ...childProfiles] as string[]).map((name) => {
                    const active = draft.assignee === name;
                    return (
                      <PressableScale
                        key={name || '__me__'}
                        style={[
                          styles.forChip,
                          { backgroundColor: active ? theme.accent : theme.surfaceMuted, borderColor: active ? theme.accent : theme.border },
                        ]}
                        onPress={() => { tap(); patch({ assignee: name }); }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        scaleTo={0.96}
                      >
                        <Text style={[styles.forChipText, { color: active ? theme.accentInk : theme.text }]}>
                          {name || t.habitForMe}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            )}

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
                          { borderColor: theme.textMuted },
                          step.done && { backgroundColor: theme.good, borderColor: theme.good },
                        ]}
                      >
                        {step.done && <Ionicons name="checkmark" size={12} color={contrastOn(theme.good)} />}
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

            {/* ── Bottom actions: Delete (left) · Discard / Save (right) — small, icon + label ── */}
            <View style={styles.bottomActionsRow}>
              {showDelete && !isNew ? (
                <PressableScale style={styles.smallActionBtn} onPress={handleDelete} scaleTo={0.93} accessibilityRole="button" accessibilityLabel={t.deleteTask}>
                  <Ionicons name="trash-outline" size={14} color={theme.bad} />
                  <Text style={[styles.smallActionText, { color: theme.bad }]}>{t.deleteTask}</Text>
                </PressableScale>
              ) : (
                <View />
              )}
              <View style={styles.bottomActionsRight}>
                <PressableScale
                  style={[styles.smallActionBtn, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5 }]}
                  onPress={handleDiscard}
                  accessibilityRole="button"
                  accessibilityLabel={t.taskDiscard}
                  scaleTo={0.97}
                >
                  <Ionicons name="close" size={14} color={theme.bad} />
                  <Text style={[styles.smallActionText, { color: theme.bad }]}>{t.taskDiscard}</Text>
                </PressableScale>
                <PressableScale
                  style={[styles.smallActionBtn, { backgroundColor: canSave ? theme.accent : theme.surfaceMuted, borderColor: canSave ? theme.accent : theme.border, borderWidth: 1.5, opacity: canSave ? 1 : 0.7 }]}
                  onPress={handleSave}
                  disabled={!canSave}
                  accessibilityRole="button"
                  accessibilityLabel={t.taskSave}
                  scaleTo={0.95}
                >
                  <Ionicons name="checkmark" size={14} color={canSave ? theme.accentInk : theme.textMuted} />
                  <Text style={[styles.smallActionText, { color: canSave ? theme.accentInk : theme.textMuted }]}>{t.taskSave}</Text>
                </PressableScale>
              </View>
            </View>
          </View>
          </Collapsible>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  bottomActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.xs },
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
  forRow: { gap: Spacing.sm },
  forChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  forChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    minHeight: 36,
    justifyContent: 'center',
  },
  forChipText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  assigneeCue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    maxWidth: 110,
  },
  assigneeCueText: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
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
  // Leading "Sent" indicator on shared-out rows (merged Shared section).
  dirChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.full,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
  },
  dirChipText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
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
});

// React.memo: re-render only on own prop changes, not every parent-list render (perf sweep 2026-07-15).
export default React.memo(TaskCard);
