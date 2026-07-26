/**
 * TaskCard.tsx — one task as an expandable row for the Tasks/Oppgaver screen; the app's
 * ONE task editor (UX audit B1, 2026-07-23 — app/task-form.tsx is retired).
 *
 * Two variants:
 *   - variant="full" (All-tasks): tap the row to open an inline editor. While the
 *     editor is open the card is in *edit mode* — small Discard / Save buttons sit at the
 *     BOTTOM of the expanded editor (next to Delete) and edits are buffered in a local
 *     draft (nothing persists until Save). The editor holds: an editable title (+ optional
 *     voice-dictation mic), a "For" assignee row (People/family mode), a steps checklist,
 *     a "Repeat" switch + per-mode recurrence options, a **When** day picker, a **Time of
 *     day** toggle + Start/Finish pair, an **Energy give / take** stepper, and a
 *     collapsed-by-default **Advanced options** reveal (a recurring task's Start-from
 *     boundary, a freeform Hint, an attached Contact, a tagged Location, a Goal link, a
 *     one-to-one "Then" follower, and the Shared-out toggle). For an existing task, Steps, Then, Shared-out,
 *     and Delete persist immediately (they bypass the draft). A card with `isNew` starts
 *     expanded, has no title autoFocus (keeps the keyboard down on creation), and its
 *     steps live on `draft.steps` instead — there's no store row yet to write them to —
 *     until Save calls `onCommitNew(draft)`, whose caller (plans.tsx) creates the task then
 *     replays the buffered steps via `addStep`. Discard on a new card calls `onDiscardNew()`
 *     and drops any buffered steps. `autoExpand` (distinct from `isNew`) starts an
 *     already-committed task's editor open without changing save semantics — used when
 *     arriving from elsewhere with a specific task to edit (e.g. app/notes.tsx's "Add to
 *     plans", which creates the task then lands here instead of pushing the old task-form).
 *   - variant="steps" (Today / This week): the row expands to show ONLY the steps
 *     checklist — no settings. A task with no steps has a card but no expand arrow.
 *
 * **Field order + the When/Time split (2026-07-26 clarity pass, maintainer-specified)**:
 * Name → For → Steps → Repeat → When → Time of day → Energy → Advanced → Delete·Discard·Save.
 * Three things were wrong before and are fixed here:
 *   1. `hasStartDate` carries TWO meanings and the UI showed one label for both. On a
 *      non-recurring task it decides whether the task lives in the WHENEVER bucket or on a
 *      day; on a recurring task it's only a "no occurrences before this date" boundary
 *      (lib/taskRecurrence.ts). `renderDayPicker()` renders the same control with wording
 *      that matches the current meaning — "When: Whenever / On a day" in the main flow for
 *      one-off tasks, "Start from" inside Advanced options for recurring ones. It is
 *      deliberately never shown twice.
 *   2. The switch was labelled "Set time" (`t.taskStartSpecificDate`) but set a DATE, and
 *      the actual calendar hid behind an unlabelled 📅 IconButton. Both gone — the day
 *      picker is a two-option SlideSelector plus a labelled "Pick a day: <date>" button.
 *   3. Start/Finish used to appear whenever `hasStartDate || isRecurring` — switching
 *      Repeat on produced two empty time boxes nobody asked for. Time of day is now its own
 *      opt-in (`timeOpen`), seeded from whether the task actually has a time, and switching
 *      it off clears `time`/`finishTime` rather than leaving stale values hidden.
 * Energy also moved OUT of Advanced into the main flow and collapsed from a switch + value
 * stepper to one signed stepper — 0 already meant "no effect" to lib/energy.ts, so
 * `energyEnabled` is derived in handleSave(). Stored data is unchanged either way.
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
 *             components/IconButton, components/Stepper, components/Button, components/GoalPicker,
 *             components/FormControls (Switch), components/AppModal,
 *             components/PressableScale, components/Collapsible + components/AnimatedChevron (animated
 *             steps/editor/advanced reveal + rotating chevrons), components/GlowPulse (breathing editing halo),
 *             constants/theme (incl. getElevation, rgba), lib/date, lib/haptics, lib/i18n, lib/id,
 *             lib/useAppTheme, lib/useVoiceCapture, lib/location (getCurrentTaskLocation),
 *             expo-contacts, components/GoalGlowDot + components/GoalPicker (both gated on
 *             settings.featureGoals), store/useTaskStore, store/useGoalStore,
 *             store/useSettingsStore (People/family mode: peopleModeEnabled + childProfiles gate
 *             the "For" assignee chip row; voiceNotesEnabled/contactsEnabled/locationEnabled/
 *             gate the matching Advanced-options rows; Energy is no longer gated at all)
 *   Used by → app/(tabs)/plans.tsx; app/notes.tsx (indirectly — creates the task, then this
 *             screen's `autoExpand` opens its editor, replacing the old push to /task-form)
 *   Data    → reads the passed `task` + its linked goal (useGoalStore, for the glow dot) +
 *             the full task list (useTaskStore, for the Then-follower picker's candidates/
 *             cycle-guard); writes via useTaskStore (update/steps/remove/setSharedOut/
 *             setFollower) for committed tasks; a new (draft) card writes nothing until
 *             onCommitNew fires.
 *
 * Edit notes:
 *   - There is no lock and no per-field immediate save for settings: the Discard/Save bar
 *     is the commit point. Only Shared-out, Then, and Delete bypass the draft outright;
 *     Steps bypass the draft for an existing task but are draft-buffered for `isNew`.
 *   - Day↔Week promote/demote: selecting all 7 weekdays promotes Week→Day; unselecting any
 *     weekday in Day demotes to Week with the remaining days (all in the draft).
 *   - Save is disabled while the title is blank, so blank tasks can't be created.
 *   - **`durationMinutes` fix (2026-07-23, discovered while consolidating the editor)**:
 *     `lib/taskNotifications.ts`'s end-of-timebox reminder, `lib/taskCalendar.ts`'s mirrored
 *     event, and `PlanTaskCard`'s day-view rail all read `task.durationMinutes` for a
 *     time-box task's length — NOT `finishTime` (this card's own display-only "10:00–10:30"
 *     label). `handleSave` now derives `durationMinutes` from `time`/`finishTime` so those
 *     three consumers get the right value regardless of which editor set it — previously
 *     only the retired task-form ever wrote `durationMinutes` (via a separate duration-chip
 *     picker), so a time-box task saved through THIS card's Start/Finish fields silently
 *     kept a stale or default (30min) duration everywhere except its own row label.
 *   - **Collapse = keep-as-unfinished (2026-07-12)**: tapping the chevron to close an open
 *     editor SAVES whatever's there (the task is simply not-done until ticked) rather than
 *     discarding — the up-arrow is never a destructive X. Only a brand-new card with no
 *     title is dropped (nothing to keep). Explicit Discard stays the deliberate abandon path.
 *   - **Purposeful Depth System (2026-07-14)**: the card's elevation stays
 *     `getElevation('raised', theme.shadow)` in both resting and editing states.
 *   - **Purposeful glow (2026-07-18, breathing 2026-07-22)**: `editing` marks focus with a
 *     breathing `GlowPulse` (mode="breathe", theme.accent) alongside `borderColor: theme.accent`.
 *     The two cues (border + breath) replaced the earlier floating-elevation bump + static glow
 *     stack — same focus signal, less visual load.
 */
import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Contact, ContactField } from 'expo-contacts';
import * as Contacts from 'expo-contacts';
import { Fonts, FontSize, Radius, Spacing, Type, contrastOn, getElevation, rgba } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { dayOfWeekMon0, formatDisplayDate } from '@/lib/date';
import { energyStepperValue, energyFieldsFromStepper } from '@/lib/energy';
import { tap, warning } from '@/lib/haptics';
import { generateId } from '@/lib/id';
import { Task, TaskStep, useTaskStore } from '@/store/useTaskStore';
import { useGoalStore } from '@/store/useGoalStore';
import { GoalGlowDot } from '@/components/GoalGlowDot';
import { GoalPicker } from '@/components/GoalPicker';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useVoiceCapture } from '@/lib/useVoiceCapture';
import { getCurrentTaskLocation } from '@/lib/location';
import SlideSelector from '@/components/SlideSelector';
import TimeBoxInput from '@/components/TimeBoxInput';
import DatePickerCalendar from '@/components/DatePickerCalendar';
import IconButton from '@/components/IconButton';
import Stepper from '@/components/Stepper';
import Button from '@/components/Button';
import { Switch } from '@/components/FormControls';
import { showAppModal } from '@/components/AppModal';
import PressableScale from '@/components/PressableScale';
import GlowPulse from '@/components/GlowPulse';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** HH:MM -> minutes since midnight, or null if unparseable. Same convention as
 *  components/PlanTaskCard.tsx's own (unexported) helper of the same name. */
function toMinutes(time: string): number | null {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

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
  /** Start this existing (already-committed) task's editor open — e.g. arriving from
   *  Notes' "Add to plans" (app/notes.tsx), which creates the task then lands here.
   *  Unlike `isNew`, this doesn't change save semantics, just the initial expand state. */
  autoExpand?: boolean;
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
  autoExpand,
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
  const setFollower = useTaskStore((s) => s.setFollower);
  const followerCycleChain = useTaskStore((s) => s.followerCycleChain);
  const allTasks = useTaskStore((s) => s.tasks);
  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled);
  const childProfiles = useSettingsStore((s) => s.childProfiles);
  const voiceNotesEnabled = useSettingsStore((s) => s.voiceNotesEnabled);
  const contactsEnabled = useSettingsStore((s) => s.contactsEnabled);
  const locationEnabled = useSettingsStore((s) => s.locationEnabled);
  const lang = useSettingsStore((s) => s.language);
  const showPeople = peopleModeEnabled && childProfiles.length > 0;
  // Goals — the linked goal (if any), for the living-glow dot next to the title. Gated on
  // settings.featureGoals (opt-in, off for fresh installs): when off, both the dot and the
  // GoalPicker below stay hidden. An existing task's goalId is left alone either way, so
  // turning the feature back on restores every link — nothing is destroyed by hiding it.
  const featureGoals = useSettingsStore((s) => s.featureGoals);
  const linkedGoal = useGoalStore((s) => (task.goalId ? s.goals.find((g) => g.id === task.goalId) ?? null : null));
  const goal = featureGoals ? linkedGoal : null;

  const stepsOnly = variant === 'steps';

  const [expanded, setExpanded] = useState(!!isNew || !!autoExpand);
  const [showCalendar, setShowCalendar] = useState(false);
  // "Time of day" is its own opt-in (2026-07-26 clarity pass). It used to be implied by
  // `hasStartDate || isRecurring`, so switching Repeat on silently produced two empty
  // Start/Finish boxes nobody asked for. Seeded from whether the task actually has a time.
  const [timeOpen, setTimeOpen] = useState(!!task.time || !!task.finishTime);
  const [newStep, setNewStep] = useState('');
  // Buffered edits (full variant only). Initialised from the task on first expand.
  const [draft, setDraft] = useState<Task>(task);
  // Advanced options (Energy/Hint/Contact/Location/Goal/Then — ported from the retired
  // app/task-form.tsx, UX audit B1/F3, 2026-07-23): collapsed by default, one reveal
  // toggle, same progressive-disclosure pattern as the rest of this editor.
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [thenPickerOpen, setThenPickerOpen] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const { listening: titleListening, toggle: toggleTitleVoice } = useVoiceCapture((text) => patch({ title: text }));

  // A new (unsaved) card has no store row yet, so its steps live on the local draft
  // (buffered into task_steps by the parent's onCommitNew, alongside the task itself).
  const sortedSteps = [...(isNew ? draft.steps : task.steps)].sort((a, b) => a.orderIndex - b.orderIndex);
  const hasSteps = sortedSteps.length > 0;
  // Steps variant only expands when there ARE steps (no arrow otherwise); full always can.
  const canExpand = stepsOnly ? hasSteps : true;

  const editing = !stepsOnly && expanded;
  const recurring = draft.recurring;
  const isRecurring = recurring !== 'none';
  const modeValue = recurring === 'daily' ? 'daily' : recurring === 'monthly' ? 'monthly' : 'weekly';
  const canSave = draft.title.trim().length > 0;
  // `energyValue` defaults to 1 in the store while `energyEnabled` defaults to false, so the
  // raw value is meaningless until the flag is on. The single-stepper UI has to show 0 for a
  // task that doesn't participate — otherwise every new task would read (and save) as +1.
  const energyShown = energyStepperValue(draft.energyEnabled, draft.energyValue);

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
    setTimeOpen(!!task.time || !!task.finishTime);
    setExpanded(true);
  }

  /** Time of day is opt-in; switching it off clears the times rather than hiding stale ones. */
  function toggleTimeOfDay(on: boolean) {
    setTimeOpen(on);
    if (!on) patch({ time: undefined, finishTime: undefined });
  }

  /**
   * The day control. `hasStartDate` carries two meanings depending on `recurring`, so this
   * renders with the wording that matches the current one:
   *   - non-recurring → false puts the task in the WHENEVER bucket, true pins it to a day
   *   - recurring     → the schedule decides the days; this is only a "don't start before"
   *                     boundary (lib/taskRecurrence.ts), so it lives in Advanced options
   */
  function renderDayPicker(label: string, offLabel: string) {
    return (
      <View style={styles.field}>
        <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{label}</Text>
        <SlideSelector
          compact
          options={[
            { value: 'off', label: offLabel },
            { value: 'on', label: t.taskWhenOnDay },
          ]}
          value={draft.hasStartDate ? 'on' : 'off'}
          onChange={(v) => {
            const on = v === 'on';
            patch({ hasStartDate: on });
            setShowCalendar(on);
          }}
        />
        {draft.hasStartDate && (
          <View style={styles.dateWrap}>
            <Button
              label={`${t.taskWhenPickDay}: ${formatDisplayDate(draft.date, lang)}`}
              variant="secondary"
              size="sm"
              onPress={() => { tap(); setShowCalendar((v) => !v); }}
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
      </View>
    );
  }

  function handleSave() {
    tap();
    const trimmed = draft.title.trim();
    if (!trimmed) return;
    const taskType = draft.time && draft.finishTime ? 'time-box' : 'start-at';
    // durationMinutes is the field lib/taskNotifications.ts, lib/taskCalendar.ts, and
    // PlanTaskCard's day-view rail actually read for a time-box task's end — finishTime
    // is this card's own display convenience (the collapsed row's "10:00–10:30" label).
    // Without this, a time-box task saved here would silently keep whatever stale
    // durationMinutes it had (or default to 30) regardless of the finish time just picked.
    const startMin = draft.time ? toMinutes(draft.time) : null;
    const endMin = draft.finishTime ? toMinutes(draft.finishTime) : null;
    const durationMinutes = taskType === 'time-box' && startMin != null && endMin != null
      ? Math.max(1, endMin - startMin)
      : draft.durationMinutes;
    // Energy is one signed stepper now (2026-07-26): 0 means "no effect", which is exactly
    // what energyEnabled=false already meant to lib/energy.ts (it sums `enabled && value`).
    // Deriving the flag here keeps the stored data identical to the old two-control version.
    const energy = energyFieldsFromStepper(energyShown);
    const committed: Task = { ...draft, title: trimmed, taskType, durationMinutes, ...energy };
    if (isNew) {
      onCommitNew?.(committed);
      return;
    }
    update(task.id, {
      title: trimmed,
      hasStartDate: draft.hasStartDate,
      date: draft.date,
      time: draft.time,
      finishTime: draft.finishTime,
      taskType,
      durationMinutes,
      recurring: draft.recurring,
      recurringDays: draft.recurringDays,
      weekInterval: draft.weekInterval,
      monthlyMode: draft.monthlyMode,
      monthDay: draft.monthDay,
      monthOrdinal: draft.monthOrdinal,
      monthWeekday: draft.monthWeekday,
      assignee: draft.assignee,
      energyEnabled: energy.energyEnabled,
      energyValue: energy.energyValue,
      hint: draft.hint,
      goalId: draft.goalId,
      contactName: draft.contactName,
      contactPhone: draft.contactPhone,
      locationLat: draft.locationLat,
      locationLng: draft.locationLng,
    });
    setExpanded(false);
    setShowCalendar(false);
    setAdvancedOpen(false);
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
    setAdvancedOpen(false);
  }

  // Contact (reserve-only) — snapshot only, no live device-contact-id link (UnFocus is
  // local-only; a device contact id isn't portable across devices/LAN live-sync). Ported
  // from app/task-form.tsx (UX audit B1); buffered on the draft like every other field here.
  async function handlePickContact() {
    tap();
    await Contacts.requestPermissionsAsync();
    const picked = await Contact.presentPicker();
    if (!picked) return;
    const details = await picked.getDetails([
      ContactField.FULL_NAME,
      ContactField.GIVEN_NAME,
      ContactField.FAMILY_NAME,
      ContactField.PHONES,
    ]);
    const name = details.fullName || [details.givenName, details.familyName].filter(Boolean).join(' ');
    if (!name) return;
    patch({ contactName: name, contactPhone: details.phones?.[0]?.number ?? '' });
  }

  function handleRemoveContact() {
    tap();
    patch({ contactName: '', contactPhone: '' });
  }

  function handleCallContact() {
    if (draft.contactPhone) Linking.openURL(`tel:${draft.contactPhone}`);
  }

  // Location (reserve-only) — foreground one-shot fix only; no reverse geocoding.
  async function handleAddLocation() {
    tap();
    setLocationBusy(true);
    const result = await getCurrentTaskLocation();
    setLocationBusy(false);
    if (result.status === 'denied') {
      showAppModal(t.permissionTitle, t.taskLocationPermissionBody);
      return;
    }
    if (result.status === 'error') {
      showAppModal(t.permissionTitle, t.taskLocationErrorBody);
      return;
    }
    patch({ locationLat: result.location.lat, locationLng: result.location.lng });
  }

  function handleRemoveLocation() {
    tap();
    patch({ locationLat: undefined, locationLng: undefined });
  }

  // "Then" — Decision 020, one-to-one follower link. Bypasses the draft and persists
  // immediately (same immediate-persist convention as Steps/Shared-out above), since it
  // reads/writes a DIFFERENT task row (the follower's followsTaskId), not this one's draft.
  const currentFollower = !isNew ? allTasks.find((tk) => tk.followsTaskId === task.id) : undefined;
  const followerCandidates = useMemo(() => {
    if (isNew) return [];
    const excluded = new Set(followerCycleChain(task.id));
    return allTasks.filter((tk) => !excluded.has(tk.id));
  }, [isNew, task.id, allTasks, followerCycleChain]);

  function pickFollower(followerId: string) {
    tap();
    setFollower(task.id, followerId);
    setThenPickerOpen(false);
  }

  function removeFollower() {
    if (!currentFollower) return;
    tap();
    setFollower(task.id, null);
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
          getElevation('raised', theme.shadow),
          { backgroundColor: tinted ? theme.accentSoft : theme.surface, borderColor: editing ? theme.accent : theme.border },
          railColor && { borderLeftWidth: 4, borderLeftColor: railColor },
        ]}
      >
        <GlowPulse active={editing} color={theme.accent} mode="breathe" radius={Radius.md} />
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

          {goal ? (
            <GoalGlowDot
              color={goal.color}
              strength={goal.strength}
              strengthUpdatedAt={goal.strengthUpdatedAt}
              size={10}
            />
          ) : null}

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
            {/* Editable title — mic button (reserve-only voice dictation, ported from
                app/task-form.tsx per UX audit B1) sits beside it when enabled; same
                bordered-chip style as components/HomeNotesCard.tsx's mic (UX audit D2). */}
            <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.taskNameLabel}</Text>
            <View style={styles.titleFieldRow}>
              <TextInput
                style={[styles.titleInput, { color: theme.text, backgroundColor: theme.surfaceMuted }]}
                value={draft.title}
                onChangeText={(v) => patch({ title: v })}
                placeholder={t.taskTitlePlaceholder}
                placeholderTextColor={theme.textMuted}
                returnKeyType="done"
              />
              {voiceNotesEnabled && (
                <PressableScale
                  onPress={toggleTitleVoice}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={titleListening ? t.taskVoiceTitleStop : t.taskVoiceTitleLabel}
                  scaleTo={0.9}
                >
                  <View
                    style={[
                      styles.micButton,
                      {
                        backgroundColor: titleListening ? theme.badSoft : theme.surfaceMuted,
                        borderColor: rgba(titleListening ? theme.bad : theme.accent, 0.4),
                      },
                    ]}
                  >
                    <Ionicons name={titleListening ? 'stop' : 'mic'} size={15} color={titleListening ? theme.bad : theme.accent} />
                  </View>
                </PressableScale>
              )}
            </View>

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
                <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.taskHowOftenLabel}</Text>
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

            {/* When — which DAY. Only meaningful for a non-recurring task: a recurring one
                gets its days from the schedule above, and its `hasStartDate` means something
                different entirely (a start boundary), so that lives in Advanced options. */}
            {!isRecurring && renderDayPicker(t.taskWhenLabel, t.taskWhenWhenever)}

            {/* Time of day — opt-in. Independent of the day: "sometime Tuesday" and
                "17:00, whenever" are both real, so neither implies the other. */}
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.taskTimeOfDayLabel}</Text>
              <Switch checked={timeOpen} onChange={toggleTimeOfDay} />
            </View>
            {timeOpen && (
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

            {/* Energy give / take — promoted out of Advanced options (2026-07-26): it changes
                whether the task shows up as affordable on the Home meter, which is a main-flow
                decision, not a power-user one. One signed stepper; 0 means no effect, which is
                also why this is no longer gated on a setting — an untouched task costs nothing,
                so the system stays out of the way without needing an opt-out. */}
            <View style={styles.field}>
              <View style={styles.energyCostRow}>
                <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.energyGiveTakeLabel}</Text>
                <Stepper
                  value={energyShown}
                  onChange={(v) => patch(energyFieldsFromStepper(v))}
                  signed
                  accessibilityLabel={t.energyGiveTakeLabel}
                />
              </View>
              <Text style={[styles.wheneverHint, { color: theme.textMuted }]}>{t.energyGiveTakeHint}</Text>
            </View>

            {/* Advanced options — Energy/Hint/Contact/Location/Goal/Then, ported from the
                retired app/task-form.tsx (UX audit B1: one canonical task editor) behind a
                progressive-disclosure reveal (UX audit F3) so the common case (title/date/
                time/repeat) stays the whole editor for most tasks. */}
            <PressableScale
              style={styles.advancedToggle}
              onPress={() => { tap(); setAdvancedOpen((v) => !v); }}
              accessibilityRole="button"
              accessibilityLabel={t.taskAdvancedOptions}
              accessibilityState={{ expanded: advancedOpen }}
              scaleTo={0.98}
            >
              <Text style={[styles.toggleLabel, { color: theme.accent }]}>{t.taskAdvancedOptions}</Text>
              <AnimatedChevron open={advancedOpen} size={16} color={theme.accent} />
            </PressableScale>
            <Collapsible open={advancedOpen}>
              <View style={styles.advancedWrap}>
                {/* Start from — a recurring task's `hasStartDate` is a "no occurrences before
                    this date" boundary (lib/taskRecurrence.ts), NOT the task's day. Niche, so
                    it sits here rather than in the main When slot a one-off task gets. */}
                {isRecurring && renderDayPicker(t.taskStartFromLabel, t.taskStartFromNone)}

                {/* Hint — Decision 019, freeform "next time" note, display-only */}
                <View style={styles.field}>
                  <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.taskHintLabel}</Text>
                  <TextInput
                    style={[styles.hintInput, { color: theme.text, backgroundColor: theme.surfaceMuted }]}
                    value={draft.hint}
                    onChangeText={(v) => patch({ hint: v })}
                    placeholder={t.taskHintPlaceholder}
                    placeholderTextColor={theme.textMuted}
                    multiline
                  />
                </View>

                {/* Contact — reserve-only, attach a name+phone snapshot, tap-to-call */}
                {contactsEnabled && (
                  <View style={styles.field}>
                    <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.taskContactLabel}</Text>
                    {draft.contactName ? (
                      <View style={[styles.thenRow, { backgroundColor: theme.surfaceMuted }]}>
                        <PressableScale onPress={handleCallContact} disabled={!draft.contactPhone} style={{ flex: 1 }} scaleTo={0.98}>
                          <Text style={[styles.thenRowText, { color: theme.text }]} numberOfLines={1}>
                            {draft.contactName}
                            {draft.contactPhone ? ` · ${draft.contactPhone}` : ''}
                          </Text>
                        </PressableScale>
                        <IconButton icon="close-circle" label={t.taskContactRemove} onPress={handleRemoveContact} size={26} />
                      </View>
                    ) : (
                      <>
                        <Text style={[styles.wheneverHint, { color: theme.textMuted }]}>{t.taskContactNone}</Text>
                        <Button label={t.taskContactPick} variant="secondary" size="sm" onPress={handlePickContact} style={styles.thenPickBtn} />
                      </>
                    )}
                  </View>
                )}

                {/* Location — reserve-only, foreground "tag my current location", no reverse geocoding */}
                {locationEnabled && (
                  <View style={styles.field}>
                    <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.taskLocationLabel}</Text>
                    {draft.locationLat != null && draft.locationLng != null ? (
                      <View style={[styles.thenRow, { backgroundColor: theme.surfaceMuted }]}>
                        <View style={styles.locationRowContent}>
                          <Ionicons name="location" size={16} color={theme.accent} />
                          <Text style={[styles.thenRowText, { color: theme.text }]}>{t.taskLocationTagged}</Text>
                        </View>
                        <IconButton icon="close-circle" label={t.taskLocationRemove} onPress={handleRemoveLocation} size={26} />
                      </View>
                    ) : (
                      <>
                        <Text style={[styles.wheneverHint, { color: theme.textMuted }]}>{t.taskLocationNone}</Text>
                        <Button
                          label={t.taskLocationAdd}
                          variant="secondary"
                          size="sm"
                          onPress={handleAddLocation}
                          loading={locationBusy}
                          style={styles.thenPickBtn}
                        />
                      </>
                    )}
                  </View>
                )}

                {/* Goal — connect this task to a Goal (create/select/delete inline).
                    Opt-in via settings.featureGoals (Settings → Advanced → Features). */}
                {featureGoals && (
                  <View style={styles.field}>
                    <GoalPicker value={draft.goalId} onChange={(id) => patch({ goalId: id })} />
                  </View>
                )}

                {/* Then — Decision 020, one-to-one follower link, immediate-persist (see
                    pickFollower/removeFollower above) — gated on an existing task, same as Steps. */}
                {!isNew && (
                  <View style={styles.field}>
                    <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.thenTaskLabel}</Text>
                    {currentFollower ? (
                      <View style={[styles.thenRow, { backgroundColor: theme.surfaceMuted }]}>
                        <Text style={[styles.thenRowText, { color: theme.text }]} numberOfLines={1}>
                          {currentFollower.title}
                        </Text>
                        <IconButton icon="close-circle" label={t.thenTaskRemove} onPress={removeFollower} size={26} />
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
                            <PressableScale
                              key={candidate.id}
                              style={[
                                styles.thenPickerRow,
                                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                              ]}
                              onPress={() => pickFollower(candidate.id)}
                              scaleTo={0.97}
                            >
                              <Text style={[styles.thenPickerRowText, { color: theme.text }]} numberOfLines={1}>
                                {candidate.title}
                              </Text>
                            </PressableScale>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Shared out toggle (persists immediately — emits an outgoing shared row) */}
                {showShareOut && !isNew && (
                  <View style={styles.toggleRow}>
                    <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.taskSharedOut}</Text>
                    <Switch checked={task.sharedOut} onChange={(on) => setSharedOut(task.id, on)} />
                  </View>
                )}
              </View>
            </Collapsible>

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
  forChipText: { fontFamily: Type.label.fontFamily, fontSize: Type.label.size },
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
  title: { fontFamily: Type.bodyStrong.fontFamily, fontSize: Type.bodyStrong.size },
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
    fontFamily: Type.bodyStrong.fontFamily,
    fontSize: Type.bodyStrong.size,
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
  toggleLabel: { fontFamily: Type.label.fontFamily, fontSize: Type.label.size },
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
  titleFieldRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  micButton: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  advancedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  advancedWrap: { gap: Spacing.md },
  field: { gap: Spacing.xs },
  hintInput: {
    minHeight: 40,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: FontSize.sm,
  },
  energyCostRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs },
  wheneverHint: { fontSize: FontSize.sm },
  locationRowContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
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
});

// React.memo: re-render only on own prop changes, not every parent-list render (perf sweep 2026-07-15).
export default React.memo(TaskCard);
