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
 *      picker is a two-option SegmentedControl plus a labelled "Pick a day: <date>" button.
 *   3. Start/Finish used to appear whenever `hasStartDate || isRecurring` — switching
 *      Repeat on produced two empty time boxes nobody asked for. Time of day is now its own
 *      opt-in (`timeOpen`), seeded from whether the task actually has a time, and switching
 *      it off clears `time`/`finishTime` rather than leaving stale values hidden.
 * Energy also moved OUT of Advanced into the main flow and collapsed from a switch + value
 * stepper to one signed stepper — 0 already meant "no effect" to lib/energy.ts, so
 * `energyEnabled` is derived in handleSave(). Stored data is unchanged either way.
 *
 * **Card types (2026-08-01, phase 1)** — `task.cardType` picks one of four renderings of the
 * ONE row anatomy below; this is a switch inside this component, never four components.
 * The rules live in lib/cardType.ts (per ITEM — not to be confused with lib/cardLayout.ts,
 * which is per SURFACE; they stack as filters and only ever subtract).
 *   - `standard` — untouched. Everything below describes it.
 *   - `simple`   — title + tick. No right-hand value, no meta line, even when those fields
 *                  hold values: they stay stored and their reminders still fire.
 *   - `note`     — no tick at all and no completion state; the title wraps to
 *                  NOTE_MAX_LINES because the text IS the content. Excluded from every
 *                  count in the app (see lib/cardType.ts's `isCompletable`).
 *   - `stepped`  — ONE step on screen at a time, with progress in the right-hand value slot
 *                  and a "back a step" undo. The visible step is DERIVED (first not-done),
 *                  never stored, so it survives a remount for free and can't drift from the
 *                  done flags. Ticking it advances; unticking the one behind steps back.
 * The type is picked from a labelled four-option SegmentedControl in the editor (visible words,
 * not icons), buffered on the draft like every other field so Discard reverts it. It is
 * deliberately never asked for at creation time. Switching is lossless in both directions —
 * nothing is cleared, so switching back restores the card exactly, steps and done flags and all.
 *
 * Every task and every step carries a checkmark circle. The task ↔ steps done-cascade
 * lives in useTaskStore (toggle / toggleStep), so tapping a circle here keeps them in
 * lockstep automatically for an existing task; a new card's steps just toggle in the draft.
 *
 * Row anatomy (2026-07-13 color-rail redesign): the collapsed row is
 * `[sent chip?] · [pin?] · title · assignee · time · ◯ circle · ⌄ chevron` — the done-circle sits to
 * the RIGHT of the title and LEFT of the chevron (was far-left). A `railColor` prop paints a
 * 4px domain-hue left rail so a card reads as belonging to its section; `sharedDirection="out"`
 * adds a leading ↑ "Sent" chip in the merged Shared section. The done circle/steps fill with
 * `theme.good` (status green, both modes) — never the section hue — so "done" never collides
 * with a domain color.
 *
 * Connections:
 *   Imports → components/NewSinceGlow ("your last view was hiding this" marker),
 *             lib/cardLayout (LayoutSpec — gates the COLLAPSED row's cues only, never the editor),
 *             lib/cardType (the four per-ITEM card types — see the block below),
 *             react-native-reanimated (FadeIn/FadeOut/LinearTransition — the stepped card's
 *             step-to-step transition, the same pair components/PlanTaskCard.tsx uses),
 *             components/TimeBoxInput, components/DatePickerCalendar,
 *             components/IconButton, components/Stepper, components/Button, components/GoalPicker,
 *             components/FormControls (Switch + SegmentedControl + Input), components/AppModal,
 *             components/OptionalTag,
 *             components/PressableScale, components/Collapsible + components/AnimatedChevron (animated
 *             steps/editor/advanced reveal + rotating chevrons), components/GlowPulse (breathing editing halo),
 *             constants/theme (incl. getElevation, rgba), lib/date, lib/haptics, lib/i18n, lib/id,
 *             lib/useAppTheme, lib/useVoiceCapture, lib/useKeyboardLift, lib/location (getCurrentTaskLocation),
 *             expo-contacts, components/GoalGlowDot + components/GoalPicker (both gated on
 *             settings.featureGoals), store/useTaskStore, store/useGoalStore,
 *             lib/useEnergyPause (2026-08-02 — the `unpin` action behind the pin badge; the
 *             `pinned`/`dimmed` states themselves arrive as props from the surface, which is
 *             what decides which row won "I'll decide"),
 *             store/useSettingsStore (peopleModeEnabled gates the "For" assignee chip row;
 *             voiceNotesEnabled/contactsEnabled/locationEnabled gate the matching
 *             Advanced-options rows; Energy is no longer gated at all),
 *             store/usePeopleStore + components/PersonChip + lib/personColor (2026-07-28 —
 *             the "For" row's roster and the collapsed row's assignee dot),
 *             store/useTagStore + components/TagChip + components/TagPickerRow + lib/tags
 *             (2026-07-28 — the editor's Tags row and the collapsed row's tag pills)
 *   Used by → app/(tabs)/plans.tsx; app/notes.tsx (indirectly — creates the task, then this
 *             screen's `autoExpand` opens its editor, replacing the old push to /task-form)
 *   Data    → reads the passed `task` + its linked goal (useGoalStore, for the glow dot) +
 *             the full task list (useTaskStore, for the Then-follower picker's candidates/
 *             cycle-guard); writes via useTaskStore (update/steps/remove/setSharedOut/
 *             setFollower) for committed tasks; a new (draft) card writes nothing until
 *             onCommitNew fires.
 *
 * Edit notes:
 *   - **The editor's four fields are `FormControls`' `Input` now (2026-08-09)**: title,
 *     add-step, month-day and hint were hand-rolled `TextInput`s — `surfaceMuted`-filled with
 *     NO border, no focus state, and three of them below the tap-target floor at 40px. They
 *     were the last unbordered controls in an editor where `TimeBoxInput`, `SegmentedControl`
 *     and the weekday chips all carry edges, so a field read as a hole rather than as the one
 *     thing you type into (`DESIGN_RULES.md` rule 18). `Input` gained `containerStyle` in the
 *     same pass — its `style` lands on the inner `TextInput`, so the `flex: 1` + `minWidth: 0`
 *     pair that keeps the voice mic inside the card had to move to the WRAPPER
 *     (`styles.titleFieldGrow`). Don't put positional style on `style`; it will silently do
 *     nothing to the row.
 *   - **Weekday chips got a border (task 16, 2026-08-04)**: `styles.weekdayChip` (the recurring-
 *     days row and the monthly weekday picker) had no border at all — a solid fill only, unlike
 *     every other chip in the app (PersonChip/TagChip/OptionalTag already had one). Now
 *     `theme.accent` when active, `theme.border` when not, matching that convention.
 *   - **Field-level glow (2026-08-01, STALE_CODE_AUDIT.md)**: `newFields` drives `tight`
 *     `NewSinceGlow` wraps on the time label, the assignee cue, each tag pill, and the goal
 *     dot — mirroring `ShoppingRow`'s meta/price field glow so switching Plans into a richer
 *     layout marks exactly which values just appeared, not just that the row did. Callers
 *     pass the same `{ meta, price, extras }` object `useNewSinceSeen` returns; `price` is
 *     accepted for type parity with `ShoppingRow` but never true here (a task has no price).
 *   - **Field dividers are GONE (2026-08-09); Opt tags stay.** 14 hairline `FieldDivider`s
 *     used to separate every field group in the expanded editor, and `components/FieldDivider.tsx`
 *     is deleted along with its other three callers (habit/medicine/health forms). Two of them
 *     sat directly under a text field, which is what made an unbordered input read as floating
 *     over a ruled line; the rest were re-stating a boundary the 2026-08-05 card reset had
 *     already assigned to borders — "separate with boundaries, not with lines between things".
 *     `styles.editor`'s `gap: Spacing.md` does the separating now, so **don't reintroduce a
 *     rule to fix a tight-looking field — check the container's gap instead.**
 *     For/Rotation/Tags/When/Start-from/Hint/Contact/Location/Then all carry
 *     `OptionalTag` (Goal's lives inside components/GoalPicker.tsx, Tags' inside
 *     components/TagPickerRow.tsx, since both are shared with app/habit-form.tsx) — only
 *     Title actually blocks save. Toggle rows (Repeat, Time of day, Shared-out) are left
 *     untagged: the switch itself already reads as optional/binary.
 *   - **Row rule (2026-07-28, design-system v6 `Checklist Redesign Options`)**: the collapsed
 *     row is title + ONE right-hand value (the time, in `TabularNums` so the right edge lines
 *     up row to row) on line 1, and ONE meta line (person · tags · goal dot) on line 2. Those
 *     three used to sit inline with the title, competing with it for width — which is what
 *     made a tagged, assigned task's name truncate at 360px. `hasMetaLine` gates line 2 and
 *     its conditions MUST mirror the JSX gates below; add a meta element without adding it
 *     there and the line silently won't render for a task that only has that one thing.
 *     The meta line deliberately does NOT wrap (every child is width-capped) — a row must
 *     never become three lines. The check circle and chevron stay on the right: they are
 *     controls, not values, and moving them was explicitly out of that pass's scope.
 *   - **The pin badge (2026-08-02, energy's "I'll decide")**: `pinned` draws a pin in the row's
 *     LEADING slot and `dimmed` fades every other row on the day to `DONE_ROW_OPACITY`. Both are
 *     presentation only — a dimmed row keeps its height, its controls, its reminders and its
 *     counts, exactly like a lib/cardLayout.ts layout is allowed to de-emphasise but never
 *     remove. The badge deliberately sits on line 1 and NOT on the meta line: `hasMetaLine`
 *     gates that line on person/tags/goal, and a 'simple' or 'note' card draws no meta line at
 *     all, so a pin hung there would vanish on two of the four card types. Line 1 also means
 *     `hasMetaLine` needs no new condition — if you ever move the badge down there, add one.
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
 *   - **Keyboard-avoidance (2026-07-31)**: Title, the add-step field, the month-day field, and
 *     Hint each get their own `useKeyboardLift` — the expanded editor is tall, so a field deep
 *     in Advanced options (Hint) or far down a long task list is easily hidden behind the
 *     keyboard on Android's `windowSoftInputMode=resize`. See lib/useKeyboardLift.ts.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Contact, ContactField } from 'expo-contacts';
import * as Contacts from 'expo-contacts';
import { DONE_ROW_OPACITY, Fonts, FontSize, Radius, RowTrailing, Spacing, TabularNums, Type, contrastOn, getElevation, rgba, HitSlop } from '@/constants/theme';
import { Duration, Ease } from '@/constants/motion';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import {
  CARD_TYPES,
  currentStepIndex,
  isCompletable,
  orderedSteps,
  visibleStepNumber,
  type CardType,
} from '@/lib/cardType';
import { dayOfWeekMon0, formatDisplayDate, todayStr } from '@/lib/date';
import { energyStepperValue, energyFieldsFromStepper } from '@/lib/energy';
import { tap, warning } from '@/lib/haptics';
import { generateId } from '@/lib/id';
import { Task, TaskStep, useTaskStore } from '@/store/useTaskStore';
import { useGoalStore } from '@/store/useGoalStore';
import { usePeopleStore } from '@/store/usePeopleStore';
import PersonChip, { PersonDot } from '@/components/PersonChip';
import TagChip from '@/components/TagChip';
import TagPickerRow from '@/components/TagPickerRow';
import { resolveTags, toggleTagId } from '@/lib/tags';
import { useTagStore } from '@/store/useTagStore';
import { isRotating, rotationAssigneeFor, type RotationMode } from '@/lib/taskRotation';
import { personColor } from '@/lib/personColor';
import { GoalGlowDot } from '@/components/GoalGlowDot';
import NewSinceGlow from '@/components/NewSinceGlow';
import { LAYOUT_SPECS, type LayoutSpec } from '@/lib/cardLayout';
import { GoalPicker } from '@/components/GoalPicker';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import { useEnergyPause } from '@/lib/useEnergyPause';
import { useVoiceCapture } from '@/lib/useVoiceCapture';
import { getCurrentTaskLocation } from '@/lib/location';
import TimeBoxInput from '@/components/TimeBoxInput';
import DatePickerCalendar from '@/components/DatePickerCalendar';
import IconButton from '@/components/IconButton';
import Stepper from '@/components/Stepper';
import Button from '@/components/Button';
import { Input, SegmentedControl, Switch } from '@/components/FormControls';
import { showAppModal } from '@/components/AppModal';
import PressableScale from '@/components/PressableScale';
import GlowPulse from '@/components/GlowPulse';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import OptionalTag from '@/components/OptionalTag';
import { useKeyboardLift } from '@/lib/useKeyboardLift';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * How many tag pills a collapsed row draws before the rest collapse into a "+N". Two is
 * what fits beside a person cue and a time label at 360px without the title reflowing —
 * the row already competes for width (see AGENTS.md's wrap audit).
 */
const ROW_TAG_LIMIT = 2;

/**
 * How many lines a 'note' card's text wraps to before it clips. A note's text IS its
 * content, so it must wrap rather than be cut to one line like a task title — but an
 * unbounded note would push every row under it off the screen, and the full text is one
 * tap away in the editor either way.
 */
const NOTE_MAX_LINES = 4;

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
  /**
   * Resolved card layout (lib/cardLayout.ts) for the COLLAPSED row only — it gates the
   * at-a-glance cues (assignee, time, goal dot), never the expanded editor. Hiding a field
   * from a summary row is a display choice; hiding it from the editor would remove the
   * ability to set it, which no layout is allowed to do. Omit for the historical row.
   */
  spec?: LayoutSpec;
  /** Task arrived since the user last opened this surface (lib/useNewSinceSeen.ts). */
  isNewSince?: boolean;
  /**
   * Which collapsed-row fields a layout switch just revealed (lib/useNewSinceSeen.ts) — the
   * per-value "tight" sibling of `isNewSince`'s whole-row glow. `meta` covers the time label
   * and the meta line's assignee/tag chips (all gated by `spec.showMeta`); `extras` covers the
   * goal dot (`spec.showExtras`). `price` never applies here — a task has no price — but is
   * kept in the type so callers can pass the same object `ShoppingRow` takes.
   */
  newFields?: { meta: boolean; price: boolean; extras: boolean };
  /**
   * Reports the editor opening and closing. Only a parent that has to KNOW needs it — today
   * that is app/(tabs)/plans.tsx's drag-reorder, which stands the gesture down while a card's
   * editor is open (components/DraggableTaskRow's `isOpen`), so a long-press inside a text
   * field can't grab the row. The expand state itself stays this component's.
   */
  onExpandedChange?: (open: boolean) => void;
  /**
   * Energy's "I'll decide" settled on THIS card (lib/useEnergyPause.ts). Draws a small pin
   * badge in the row's LEADING slot — and that badge IS the un-pin control, since this app has
   * no row context menu to hang one off (long-press is drag-reorder) and `TaskCard` has no ⋯.
   * One labelled, visible, one-tap control, which is what INTERACTION_HANDOFF §2.4 asks for.
   *
   * Always false in Rewards mode: `useEnergyPause()` reports a null `pinnedTaskId` there, so
   * the caller's `pinnedTaskId === task.id` test is already mode-safe.
   */
  pinned?: boolean;
  /**
   * Secondary visual weight while a DIFFERENT card is pinned. **Opacity and nothing else.**
   * A dimmed row keeps its full height, its layout, every control, its reminders and its
   * counts; it is still tappable, still completable, still one tap from its editor. Same rule
   * every layout in lib/cardLayout.ts follows — presentation may de-emphasise, never remove.
   * Reuses `DONE_ROW_OPACITY`, the app's one shared "this row is in the background" amount.
   */
  dimmed?: boolean;
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
  spec = LAYOUT_SPECS.normal,
  isNewSince = false,
  newFields,
  onExpandedChange,
  pinned = false,
  dimmed = false,
}: Props) {
  const theme = useAppTheme();
  // Union of the in-app toggle and the OS setting (ANIMATION_GUIDELINES §7) — under it the
  // stepped card swaps steps with no transition at all rather than a shortened one.
  const { reducedMotion } = useAccessibility();
  const anim = !reducedMotion;
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
  // People/family is part of the sharing surface that's hidden while the single-user basics
  // are reworked (2026-08-05) — see lib/sharingVisibility.ts. The setting keeps its stored
  // value and every person row stays in the DB, so an existing multi-person setup returns
  // intact when the switch flips back; only the UI stands down.
  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled) && SHARING_VISIBLE;
  // Energy is a real toggle again (2026-07-31) — gates the energy stepper in the editor.
  const energySystemEnabled = useSettingsStore((s) => s.energySystemEnabled);
  // The pin badge's un-pin action (2026-08-02). Read here rather than threaded down as a
  // callback: the hook is the one place that knows about the day's pause, and it returns a
  // frozen inert object (`unpin` a no-op) in Rewards mode, so this costs nothing there.
  const { unpin } = useEnergyPause();
  const voiceNotesEnabled = useSettingsStore((s) => s.voiceNotesEnabled);
  const contactsEnabled = useSettingsStore((s) => s.contactsEnabled);
  // Keyboard-avoidance (2026-07-31) for the editor's raw TextInputs — each field lifts itself
  // independently since they sit at different depths inside the expanded editor.
  const titleLift = useKeyboardLift<TextInput>();
  const addStepLift = useKeyboardLift<TextInput>();
  const monthDayLift = useKeyboardLift<TextInput>();
  const hintLift = useKeyboardLift<TextInput>();
  const locationEnabled = useSettingsStore((s) => s.locationEnabled);
  const lang = useSettingsStore((s) => s.language);
  // People registry (2026-07-28) — the roster is `people` rows now, not childProfiles
  // names. The self row always exists, so "more than one person" is the real signal that
  // there is anyone to assign TO; a household of one gets no picker, same as before.
  const people = usePeopleStore((s) => s.people);
  const showPeople = peopleModeEnabled && people.length > 1;
  const assignedPerson = people.find((p) => p.id === task.assigneeId) ?? null;
  // Tags (2026-07-28) — resolved against the shared roster, so an id whose row hasn't
  // synced yet simply doesn't draw rather than showing a raw id. See lib/tags.ts.
  const allTags = useTagStore((s) => s.tags);
  const rowTags = resolveTags(task.tagIds, allTags);
  // Rotation (2026-07-28) — whose turn it is on the task's own date. Derived, never
  // stored: see lib/taskRotation.ts for why nothing writes an "advance the turn".
  const turnPersonId = rotationAssigneeFor(task, task.date || todayStr());
  const turnPerson = people.find((p) => p.id === turnPersonId) ?? null;
  const rotating = isRotating(task);
  // The row draws the turn-holder when rotating, the fixed assignee otherwise.
  const cuePerson = rotating ? turnPerson : assignedPerson;
  // Goals — the linked goal (if any), for the living-glow dot next to the title. Gated on
  // settings.featureGoals (opt-in, off for fresh installs): when off, both the dot and the
  // GoalPicker below stay hidden. An existing task's goalId is left alone either way, so
  // turning the feature back on restores every link — nothing is destroyed by hiding it.
  const featureGoals = useSettingsStore((s) => s.featureGoals);
  const linkedGoal = useGoalStore((s) => (task.goalId ? s.goals.find((g) => g.id === task.goalId) ?? null : null));
  const goal = featureGoals ? linkedGoal : null;

  // The row rule's ONE meta line (2026-07-28): person · tags · goal dot, rendered under the
  // title only when at least one of them has something to draw — a plain task keeps its
  // single-line row. Each condition mirrors the matching JSX gate exactly; if you add a
  // meta element below, add it here too or the line won't render for a task that only has
  // that one thing.
  //
  // Card types stack ON TOP of that as a second, per-ITEM filter (2026-08-01): `showsMeta`
  // below is false for 'simple' and 'note', which draw no meta line at all no matter what
  // the surface's layout allows. The two only ever subtract — neither can add a cue back.
  const cardType = task.cardType;
  const completable = isCompletable(cardType);
  // 'simple' is title + tick, deliberately nothing else even when the fields hold values
  // (the values stay stored and their reminders still fire — this is presentation, the
  // same rule lib/cardLayout.ts follows). 'note' has no metadata to show either.
  const showsMeta = cardType === 'standard' || cardType === 'stepped';
  const hasMetaLine =
    showsMeta &&
    ((showPeople && spec.showMeta && !!cuePerson) ||
      (spec.showMeta && rowTags.length > 0) ||
      (!!goal && spec.showExtras));

  const stepsOnly = variant === 'steps';

  const [expanded, setExpanded] = useState(!!isNew || !!autoExpand);
  // Report the editor's open/closed state up, for the one parent that needs it (see the prop).
  // Through a ref so an inline closure in the caller can't re-fire this every render, and with
  // `expanded` as the only dependency — setExpanded is called from several places.
  const reportExpanded = useRef(onExpandedChange);
  reportExpanded.current = onExpandedChange;
  useEffect(() => {
    reportExpanded.current?.(expanded);
  }, [expanded]);
  const [showCalendar, setShowCalendar] = useState(false);
  // "Time of day" is its own opt-in (2026-07-26 clarity pass). It used to be implied by
  // `hasStartDate || isRecurring`, so switching Repeat on silently produced two empty
  // Start/Finish boxes nobody asked for. Seeded from whether the task actually has a time.
  const [timeOpen, setTimeOpen] = useState(!!task.time || !!task.finishTime);
  const [newStep, setNewStep] = useState('');
  // Buffered edits (full variant only). Initialised from the task on first expand.
  const [draft, setDraft] = useState<Task>(task);
  // The EDITOR previews the draft's rotation, not the saved row's — switching "Take turns"
  // on would otherwise show a nameless turn until Save, since `task` is still un-rotated.
  const draftTurnPerson =
    people.find((p) => p.id === rotationAssigneeFor(draft, draft.date || todayStr())) ?? null;
  // Your own turn gets its own sentence: feeding the "Me" fallback into `turn(name)`
  // produces "Me's turn", which is not a sentence in either language.
  const turnLine = !draftTurnPerson
    ? ''
    : draftTurnPerson.isSelf
      ? t.rotation.turnYou
      : t.rotation.turn(draftTurnPerson.name);
  // Advanced options (Energy/Hint/Contact/Location/Goal/Then — ported from the retired
  // app/task-form.tsx, UX audit B1/F3, 2026-07-23): collapsed by default, one reveal
  // toggle, same progressive-disclosure pattern as the rest of this editor.
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [thenPickerOpen, setThenPickerOpen] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const { listening: titleListening, toggle: toggleTitleVoice } = useVoiceCapture((text) => patch({ title: text }));

  // A new (unsaved) card has no store row yet, so its steps live on the local draft
  // (buffered into task_steps by the parent's onCommitNew, alongside the task itself).
  const sortedSteps = orderedSteps(isNew ? draft.steps : task.steps);
  const hasSteps = sortedSteps.length > 0;
  // ── Stepped card (2026-08-01) ──
  // The visible step is DERIVED — the first not-done one — never stored. See lib/cardType.ts
  // for why: a stored pointer drifts the moment a step is ticked by the done-cascade, the
  // widget or a peer. Deriving it also makes "step backwards" free (untick = step back) and
  // makes progress survive a remount for nothing, since task_steps already writes straight
  // to SQLite on every change.
  const stepped = cardType === 'stepped';
  const stepIndex = currentStepIndex(sortedSteps);
  const currentStep = stepped && stepIndex < sortedSteps.length ? sortedSteps[stepIndex] : null;
  // 1-based number of the step on screen (null once all are done) — the row's right-hand
  // value. Deliberately not a done-count; see visibleStepNumber's note on why "Step 0 of 2"
  // is the wrong label for a card that is showing its first step.
  const stepNumber = visibleStepNumber(sortedSteps);
  // The step BEHIND the current one — unticking it is how an accidental completion is undone.
  const previousStep = stepped && stepIndex > 0 ? sortedSteps[stepIndex - 1] : null;
  // Steps variant only expands when there ARE steps (no arrow otherwise); full always can.
  // A stepped card in the steps variant has no expansion of its own: it already shows its
  // step inline, and the full checklist behind a chevron would be the second copy of it.
  const canExpand = stepsOnly ? hasSteps && !stepped : true;

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
        <View style={styles.labelRow}>
          <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{label}</Text>
          <OptionalTag />
        </View>
        <SegmentedControl
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
      // Nothing else is cleared alongside it — switching type is lossless by design, so a
      // stepped card turned simple keeps every task_steps row, done flags included.
      cardType: draft.cardType,
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
    <View style={[styles.wrap, dimmed && styles.dimmed]}>
      {/* The glow sits inside `wrap` so it tracks the card's own bounds; it is a
          non-interactive overlay, so it never intercepts taps on the row or its editor. */}
      <NewSinceGlow active={isNewSince}>
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
        {/* Anatomy (row rule, 2026-07-28 — design-system v6 `Checklist Redesign Options`):
              line 1  [sent chip?] · title (flex) · time (the ONE right-hand value) · ◯ circle · ⌄ chevron
              line 2  the ONE meta line — assignee · tags · goal dot
            Everything that used to compete with the title on line 1 (person chip, up to
            three tag pills, the goal dot) now sits on its own meta line, so the title has
            the width it needs and the right edge is a single tabular-figure column that
            lines up row to row. The done-circle stays to the RIGHT of the title and to the
            LEFT of the chevron (2026-07-13 redesign) — those are controls, not values, and
            moving them was not part of this pass.

            The four CARD TYPES (2026-08-01) are variations on this one anatomy, never four
            parallel rows: 'standard' is exactly the above and is untouched; 'simple' keeps
            the title and the tick and drops the right-hand value and the meta line; 'note'
            additionally drops the tick (it has no completion state at all) and lets its
            title wrap, since the text IS the content; 'stepped' puts its progress in the
            right-hand value slot and draws its one current step below. */}
        <View style={styles.row}>
          {sharedDirection === 'out' && (
            <View style={[styles.dirChip, { backgroundColor: railColor ? railColor : theme.surfaceMuted }]}>
              <Ionicons name="arrow-up" size={11} color={railColor ? contrastOn(railColor) : theme.textMuted} />
              <Text style={[styles.dirChipText, { color: railColor ? contrastOn(railColor) : theme.textMuted }]}>{t.tasksSharedSent}</Text>
            </View>
          )}

          {/* The pin badge — the row's leading slot, the same place components/PadRow.tsx puts
              `leading` and the same place components/PlanTaskCard.tsx draws it, so one item
              carries the same mark on every surface it appears on. It is a CONTROL, not a
              decoration: tapping it drops the pin, which is the only un-pin route on this card
              (no ⋯ here, and long-press is already drag-reorder). It carries the pin GLYPH as
              well as the accent, so the pinned state never rests on colour alone.

              Touch-area note (DESIGN_RULES rule 17 / RowTrailing): this sits `Spacing.sm` +
              `Spacing.xs` from the title's own tap block and borrows `RowTrailing.actionSlop`,
              which is clipped on the right — the side it shares. The badge is also the EARLIER
              sibling, and RN resolves an overlap to the LATER one, so any residual overhang
              loses to the row body rather than the badge stealing a tap on the title. Its own
              drawn box is always its own. */}
          {pinned && (
            <PressableScale
              hitSlop={RowTrailing.actionSlop}
              onPress={() => { tap(); unpin(); }}
              accessibilityRole="button"
              accessibilityLabel={t.energyPause.pinnedLabel}
              style={[styles.pinBadge, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
              scaleTo={0.9}
            >
              <Ionicons name="pin" size={14} color={theme.accent} />
            </PressableScale>
          )}

          <PressableScale style={styles.titleTap} onPress={openEditor} disabled={!canExpand} scaleTo={0.97}>
            <Text
              style={[
                styles.title,
                { color: theme.text },
                // A note is never done, so it never strikes through — there is no state to strike.
                completable && task.done && { textDecorationLine: 'line-through', color: theme.textMuted },
              ]}
              // A note's text is the whole content, so it wraps instead of being clipped to
              // one line. Capped so a long note still can't crowd out the rows under it.
              numberOfLines={cardType === 'note' ? NOTE_MAX_LINES : 1}
            >
              {task.title || (editing ? '' : t.taskTitlePlaceholder)}
            </Text>
          </PressableScale>

          {/* The ONE right-hand value. A stepped card spends it on its progress rather than
              its time: two values would break the row rule, and "which step am I on" is the
              question that card exists to answer. */}
          {stepped && hasSteps ? (
            <Text style={[styles.timeLabel, TabularNums, { color: theme.textMuted }]}>
              {stepNumber === null ? t.cardTypes.allDone : t.cardTypes.progress(stepNumber, sortedSteps.length)}
            </Text>
          ) : task.time && spec.showMeta && showsMeta ? (
            <NewSinceGlow active={!!newFields?.meta} tight>
              <Text style={[styles.timeLabel, TabularNums, { color: theme.textMuted }]}>
                {task.finishTime ? `${task.time}–${task.finishTime}` : task.time}
              </Text>
            </NewSinceGlow>
          ) : null}

          {/* No tick on a note — it cannot be completed, so the control must not exist
              rather than exist and be inert. */}
          {completable && (
          <PressableScale
            hitSlop={HitSlop.base}
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
          )}

          {canExpand && (
            <PressableScale hitSlop={HitSlop.snug} onPress={openEditor} style={styles.chevronBtn} scaleTo={0.9}>
              <AnimatedChevron open={expanded} size={18} color={theme.textMuted} />
            </PressableScale>
          )}
        </View>

        {/* ── The one meta line ── */}
        {/* Renders only when it has something to say, so a bare task stays a single-line
            row. Never wraps: the person chip has its own maxWidth, tags are capped at
            ROW_TAG_LIMIT with a "+N" overflow pill, and the whole line is one non-wrapping
            row — a task with a long name, three tags and an assignee must not grow a
            third line. */}
        {hasMetaLine && (
          <View style={styles.metaLine}>
            {/* Who it's for — the person's own colour as a dot, never as this card's border
                (that channel is the domain hue). See lib/personColor.ts's header.
                A rotating chore shows WHOSE TURN it is on this task's date, which is the
                only honest answer: its fixed assigneeId is not who does it. The little
                sync-ish glyph marks it as a turn rather than a permanent assignment. */}
            {showPeople && spec.showMeta && cuePerson ? (
              <NewSinceGlow active={!!newFields?.meta} tight>
                <View style={[styles.assigneeCue, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                  <PersonDot
                    color={personColor(cuePerson.color, people.indexOf(cuePerson))}
                    name={cuePerson.name}
                    size={14}
                  />
                  <Text style={[styles.assigneeCueText, { color: theme.textMuted }]} numberOfLines={1}>{cuePerson.name}</Text>
                  {rotating ? <Ionicons name="repeat" size={12} color={theme.textMuted} /> : null}
                </View>
              </NewSinceGlow>
            ) : null}

            {/* Tags — word-only pills, capped at two so a heavily-tagged task can't push the
                meta line onto a second row; the rest collapse into a "+N". See lib/tags.ts.
                Each pill gets its own tight glow (rather than one glow around the whole
                cluster) so it stays a per-value marker even when several tags reveal at once. */}
            {spec.showMeta && rowTags.length ? (
              <>
                {rowTags.slice(0, ROW_TAG_LIMIT).map((tag) => (
                  <NewSinceGlow key={tag.id} active={!!newFields?.meta} tight>
                    <TagChip label={tag.name} small />
                  </NewSinceGlow>
                ))}
                {rowTags.length > ROW_TAG_LIMIT ? (
                  <NewSinceGlow active={!!newFields?.meta} tight>
                    <TagChip label={t.tags.more(rowTags.length - ROW_TAG_LIMIT)} small />
                  </NewSinceGlow>
                ) : null}
              </>
            ) : null}

            {goal && spec.showExtras ? (
              <NewSinceGlow active={!!newFields?.extras} tight>
                <GoalGlowDot
                  color={goal.color}
                  strength={goal.strength}
                  strengthUpdatedAt={goal.strengthUpdatedAt}
                  size={10}
                />
              </NewSinceGlow>
            ) : null}
          </View>
        )}

        {/* ── Stepped card: the ONE visible step (2026-08-01) ── */}
        {/* Exactly one step is on screen at a time — that is the point of the type. Ticking
            it advances to the next, because "the current step" is just the first not-done
            one; nothing here writes a pointer.

            Motion: the outgoing step fades out and the incoming one fades in, with the card
            reflowing under them via LinearTransition — the same Reanimated pair
            components/PlanTaskCard.tsx already uses for its rows, at the same Duration.*
            tokens. No new animation was invented for this (ANIMATION_GUIDELINES §1/§9), and
            nothing here fires a celebration haptic: `success()` belongs to completing the
            TASK and already fires from the row's tick via the done-cascade, so a second one
            per step would be exactly the double-fire §9 forbids. */}
        {stepped && (
          <View style={styles.steppedWrap}>
            {currentStep ? (
              <Animated.View
                key={currentStep.id}
                entering={anim ? FadeIn.duration(Duration.card).easing(Ease.enter) : undefined}
                exiting={anim ? FadeOut.duration(Duration.cardOut).easing(Ease.exit) : undefined}
                layout={anim ? LinearTransition.duration(Duration.listMove).easing(Ease.move) : undefined}
              >
                <PressableScale
                  hitSlop={HitSlop.snug}
                  onPress={() => handleToggleStep(currentStep.id)}
                  style={styles.stepCheckTap}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: false }}
                  scaleTo={0.97}
                >
                  <View style={[styles.stepCheck, { borderColor: theme.textMuted }]} />
                  <Text style={[styles.stepText, { color: theme.text }]} numberOfLines={2}>
                    {currentStep.title}
                  </Text>
                </PressableScale>
              </Animated.View>
            ) : hasSteps ? (
              // Every step done. The card says so plainly and stops — no celebration here,
              // for the same reason as above: the task's own completion already carries one.
              <Text style={[styles.steppedNote, { color: theme.textMuted }]}>{t.cardTypes.allDone}</Text>
            ) : (
              // A stepped card with no steps yet behaves like an ordinary one. This points at
              // the fix rather than reporting a fault (DESIGN_RULES rule 23, copy tone).
              <Text style={[styles.steppedNote, { color: theme.textMuted }]}>{t.cardTypes.noSteps}</Text>
            )}

            {/* Undo an accidental tick: unticking the step behind the current one IS stepping
                back, and it persists like any other step write. Only offered when there is a
                step to go back to. */}
            {previousStep && (
              <PressableScale
                hitSlop={HitSlop.snug}
                onPress={() => handleToggleStep(previousStep.id)}
                accessibilityRole="button"
                accessibilityLabel={t.cardTypes.back}
                style={styles.steppedBack}
                scaleTo={0.97}
              >
                <Ionicons name="arrow-undo-outline" size={13} color={theme.textMuted} />
                <Text style={[styles.steppedBackText, { color: theme.textMuted }]}>{t.cardTypes.back}</Text>
              </PressableScale>
            )}
          </View>
        )}

        {/* ── Steps-only expansion (Today / This week) ── */}
        {stepsOnly && hasSteps && !stepped && (
          <Collapsible open={expanded}>
          <View style={styles.stepsWrap}>
            {sortedSteps.map((step) => (
              <PressableScale key={step.id} hitSlop={HitSlop.snug} onPress={() => toggleStep(step.id)} style={styles.stepCheckTap} scaleTo={0.97}>
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
              <Input
                ref={titleLift.ref}
                containerStyle={styles.titleFieldGrow}
                style={styles.titleInput}
                value={draft.title}
                onChangeText={(v) => patch({ title: v })}
                onFocus={titleLift.onFocus}
                onBlur={titleLift.onBlur}
                placeholder={t.taskTitlePlaceholder}
                returnKeyType="done"
              />
              {voiceNotesEnabled && (
                <PressableScale
                  onPress={toggleTitleVoice}
                  hitSlop={HitSlop.base}
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
              <>
              <View style={styles.forRow}>
                <View style={styles.labelRow}>
                  <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.habitForLabel}</Text>
                  <OptionalTag />
                </View>
                <View style={styles.forChips}>
                  {people.map((person, index) => (
                    <PersonChip
                      key={person.id}
                      label={person.isSelf ? person.name || t.habitForMe : person.name}
                      name={person.name}
                      color={personColor(person.color, index)}
                      selected={draft.assigneeId === person.id}
                      // `assignee` rides along as the denormalised name mirror — see the
                      // deprecation note on Task.assignee in store/useTaskStore.ts.
                      onPress={() => { tap(); patch({ assigneeId: person.id, assignee: person.isSelf ? '' : person.name }); }}
                    />
                  ))}
                </View>
              </View>


              {/* Take turns — a chore that rotates instead of belonging to one person. Only
                  offered when there IS somebody to rotate with. Turning it on captures
                  today as the anchor; it is never recomputed afterwards, because moving the
                  anchor reshuffles every past and future turn (lib/taskRotation.ts). */}
              <View style={styles.forRow}>
                <View style={styles.labelRow}>
                  <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.rotation.label}</Text>
                  <OptionalTag />
                </View>
                <View style={styles.forChips}>
                  {(['none', 'daily', 'weekly', 'monthly'] as RotationMode[]).map((mode) => (
                    <PersonChip
                      key={mode}
                      label={t.rotation[mode === 'none' ? 'off' : mode]}
                      selected={(draft.rotation ?? 'none') === mode}
                      onPress={() => {
                        tap();
                        patch({
                          rotation: mode,
                          rotationAnchor: draft.rotationAnchor || todayStr(),
                          // Seed the roster with everyone, so switching it on does
                          // something visible instead of needing a second step.
                          rotationPersonIds:
                            draft.rotationPersonIds?.length
                              ? draft.rotationPersonIds
                              : people.map((p) => p.id),
                        });
                      }}
                    />
                  ))}
                </View>
                {(draft.rotation ?? 'none') !== 'none' && (
                  <>
                    <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.rotation.rosterLabel}</Text>
                    <View style={styles.forChips}>
                      {people.map((person, index) => (
                        <PersonChip
                          key={person.id}
                          label={person.isSelf ? person.name || t.habitForMe : person.name}
                          name={person.name}
                          color={personColor(person.color, index)}
                          selected={(draft.rotationPersonIds ?? []).includes(person.id)}
                          onPress={() => {
                            tap();
                            patch({ rotationPersonIds: toggleTagId(draft.rotationPersonIds ?? [], person.id) });
                          }}
                        />
                      ))}
                    </View>
                    <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>
                      {(draft.rotationPersonIds ?? []).length > 1
                        ? turnLine
                        : t.rotation.needsTwo}
                    </Text>
                  </>
                )}
              </View>
              </>
            )}


            {/* Card — how THIS one draws itself (2026-08-01). A labelled row of four
                options with visible words, never icons: the difference between them is
                what they show, which an icon can't say.

                It is buffered on the draft like every other field here, so Discard reverts
                it, and it is deliberately NOT asked for at creation time — a new item is
                always a full card, and the type is something you change once you know what
                the item turned out to be. Switching is lossless in both directions: steps,
                energy, time and tags all stay stored whatever type is picked, so switching
                back restores the card exactly, done flags included. */}
            <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.cardTypes.label}</Text>
            <SegmentedControl
              options={CARD_TYPES.map((value) => ({ value, label: t.cardTypes[value] }))}
              value={draft.cardType}
              onChange={(value: CardType) => patch({ cardType: value })}
            />
            <Text style={[styles.miniLabel, { color: theme.textMuted }]}>
              {t.cardTypes[`${draft.cardType}Desc`]}
            </Text>


            {/* Tags — what kind of thing this is, the counterpart to "For" above. Always
                offered: a tag is useful on a solo list too, unlike an assignee. */}
            <TagPickerRow
              value={draft.tagIds ?? []}
              onChange={(tagIds) => patch({ tagIds })}
            />


            {/* Steps — persist immediately for existing tasks; buffered on the local draft
                for a new (isNew) card until Save creates the real task row. */}
            {hasSteps && (
              <View style={styles.stepsWrap}>
                {sortedSteps.map((step) => (
                  <View key={step.id} style={styles.stepRow}>
                    <PressableScale hitSlop={HitSlop.snug} onPress={() => handleToggleStep(step.id)} style={styles.stepCheckTap} scaleTo={0.97}>
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
                    <PressableScale hitSlop={HitSlop.snug} onPress={() => handleRemoveStep(step.id)} scaleTo={0.9}>
                      <Ionicons name="close" size={16} color={theme.textMuted} />
                    </PressableScale>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.addStepRow}>
              <Input
                ref={addStepLift.ref}
                containerStyle={styles.titleFieldGrow}
                style={styles.addStepInput}
                value={newStep}
                onChangeText={setNewStep}
                onFocus={addStepLift.onFocus}
                onBlur={addStepLift.onBlur}
                placeholder={t.stepPlaceholder}
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
                <SegmentedControl
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
                          style={[styles.weekdayChip, { backgroundColor: active ? theme.accent : theme.surfaceMuted, borderColor: active ? theme.accent : theme.border }]}
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
                  <SegmentedControl
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
                    <SegmentedControl
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
                        <Input
                          ref={monthDayLift.ref}
                          style={styles.monthDayInput}
                          value={String(draft.monthDay)}
                          onChangeText={(txt) => {
                            const n = Math.min(31, Math.max(1, parseInt(txt.replace(/\D/g, ''), 10) || 1));
                            patch({ monthDay: n });
                          }}
                          onFocus={monthDayLift.onFocus}
                          onBlur={monthDayLift.onBlur}
                          keyboardType="number-pad"
                          maxLength={2}
                        />
                      </View>
                    ) : (
                      <>
                        <SegmentedControl
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
                                style={[styles.weekdayChip, { backgroundColor: active ? theme.accent : theme.surfaceMuted, borderColor: active ? theme.accent : theme.border }]}
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
                decision, not a power-user one. One signed stepper; 0 means no effect. Gated on
                settings.energySystemEnabled again as of 2026-07-31 — hiding the CONTROL only:
                a task keeps whatever energy value it already had, so switching Energy back on
                restores every number untouched. */}
            {energySystemEnabled && (
              <View style={styles.field}>
                <View style={styles.energyCostRow}>
                  {/* The label side takes the leftover width and the Stepper keeps its own:
                      a stepper is a fixed-size control (28 + 36 + 28 plus gaps) with nothing
                      to give, so when the row runs out of room the LABEL is what must yield.
                      Without this the whole stepper was pushed 22px out through the card's
                      overflow mask at 327px — the `large` font setting on a 393pt phone. */}
                  <View style={[styles.labelRow, styles.energyLabelWrap]}>
                    <Text style={[styles.toggleLabel, styles.energyLabelText, { color: theme.textMuted }]}>
                      {t.energyGiveTakeLabel}
                    </Text>
                    <OptionalTag />
                  </View>
                  <Stepper
                    value={energyShown}
                    onChange={(v) => patch(energyFieldsFromStepper(v))}
                    signed
                    accessibilityLabel={t.energyGiveTakeLabel}
                  />
                </View>
                <Text style={[styles.wheneverHint, { color: theme.textMuted }]}>{t.energyGiveTakeHint}</Text>
              </View>
            )}

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
              <View style={styles.labelRow}>
                <Text style={[styles.toggleLabel, { color: theme.accent }]}>{t.taskAdvancedOptions}</Text>
                <OptionalTag />
              </View>
              <AnimatedChevron open={advancedOpen} size={16} color={theme.accent} />
            </PressableScale>
            <Collapsible open={advancedOpen}>
              <View style={styles.advancedWrap}>
                {/* Start from — a recurring task's `hasStartDate` is a "no occurrences before
                    this date" boundary (lib/taskRecurrence.ts), NOT the task's day. Niche, so
                    it sits here rather than in the main When slot a one-off task gets. */}
                {isRecurring && (
                  <>
                    {renderDayPicker(t.taskStartFromLabel, t.taskStartFromNone)}
                  </>
                )}

                {/* Hint — Decision 019, freeform "next time" note, display-only */}
                <View style={styles.field}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.taskHintLabel}</Text>
                    <OptionalTag />
                  </View>
                  <Input
                    ref={hintLift.ref}
                    style={styles.hintInput}
                    value={draft.hint}
                    onChangeText={(v) => patch({ hint: v })}
                    onFocus={hintLift.onFocus}
                    onBlur={hintLift.onBlur}
                    placeholder={t.taskHintPlaceholder}
                    multiline
                  />
                </View>

                {/* Contact — reserve-only, attach a name+phone snapshot, tap-to-call */}
                {contactsEnabled && (
                  <>
                  <View style={styles.field}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.taskContactLabel}</Text>
                      <OptionalTag />
                    </View>
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
                  </>
                )}

                {/* Location — reserve-only, foreground "tag my current location", no reverse geocoding */}
                {locationEnabled && (
                  <>
                  <View style={styles.field}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.taskLocationLabel}</Text>
                      <OptionalTag />
                    </View>
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
                  </>
                )}

                {/* Goal — connect this task to a Goal (create/select/delete inline).
                    Opt-in via settings.featureGoals (Settings → Advanced → Features). */}
                {featureGoals && (
                  <>
                  <View style={styles.field}>
                    <GoalPicker value={draft.goalId} onChange={(id) => patch({ goalId: id })} />
                  </View>
                  </>
                )}

                {/* Then — Decision 020, one-to-one follower link, immediate-persist (see
                    pickFollower/removeFollower above) — gated on an existing task, same as Steps. */}
                {!isNew && (
                  <>
                  <View style={styles.field}>
                    <View style={styles.labelRow}>
                      <Text style={[styles.miniLabel, { color: theme.textMuted }]}>{t.thenTaskLabel}</Text>
                      <OptionalTag />
                    </View>
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
                  </>
                )}

                {/* Shared out toggle (persists immediately — emits an outgoing shared row) */}
                {showShareOut && !isNew && (
                  <>
                  <View style={styles.toggleRow}>
                    <Text style={[styles.toggleLabel, { color: theme.textMuted }]}>{t.taskSharedOut}</Text>
                    <Switch checked={task.sharedOut} onChange={(on) => setSharedOut(task.id, on)} />
                  </View>
                  </>
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
      </NewSinceGlow>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  // Secondary weight while another card is pinned (`dimmed`). Opacity only, at the same shared
  // amount a finished row uses — nothing is hidden, resized or made unreachable.
  dimmed: { opacity: DONE_ROW_OPACITY },
  // The "I'll decide" pin badge / un-pin button. Sized to RowTrailing.actionSize so it matches
  // the ⋯ button every other row draws; the extra marginRight pads the gap to the title's tap
  // block past the slop it spreads that way (see the JSX note).
  pinBadge: {
    width: RowTrailing.actionSize,
    height: RowTrailing.actionSize,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  // Delete · Discard · Save. Unlike the two fixes above this row has nothing left to give:
  // three labelled buttons at FontSize.xs genuinely need more width than a 224px card at the
  // `large` font setting, and shrinking them further would truncate the words off the two
  // that confirm or discard the edit. So it WRAPS instead of clipping — the audit's own
  // "wrapped control rows cannot be fixed by shortening copy" case, answered honestly.
  // `marginLeft: 'auto'` keeps Discard/Save hard right on whichever line they land on;
  // `justify-content: space-between` alone would left-align them once they wrap.
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  bottomActionsRight: { flexDirection: 'row', gap: Spacing.xs, marginLeft: 'auto' },
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
  // The one meta line. No flexWrap on purpose — see the JSX comment: every child is
  // individually width-capped, so this must clip rather than grow a third line.
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingBottom: 4, overflow: 'hidden' },
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
  // `flex: 1` + `minWidth: 0` — and BOTH are load-bearing. `titleFieldRow` is a row, and
  // without these the field keeps its intrinsic 237px instead of taking what's left, which
  // pushes the voice mic past the card's edge to be sliced in half by its overflow mask.
  // Measured at 360px (small Android): input 51.5→288.5, +8 gap, +28 mic = 324.5 against a
  // card whose content box ends at 308.5 — 16px over. Invisible at 393/430px, which is how
  // it survived this long.
  //
  // `minWidth: 0` is the half that isn't obvious: `flex: 1` alone measured as
  // `flex-grow/shrink/basis = 1/1/0%` and STILL rendered 237px, because a flex item's
  // default `min-width: auto` floors it at its automatic minimum size — and for a replaced
  // element like RN-web's <input>, that floor is its intrinsic width. flex-shrink can't go
  // below it. Don't drop either line; each on its own leaves the row overflowing.
  //
  // This pair moved to the WRAPPER when the field became FormControls' `Input` (2026-08-09) —
  // `Input`'s `style` lands on the inner TextInput, which is no longer the row's flex child.
  titleFieldGrow: { flex: 1, minWidth: 0 },
  titleInput: {
    // The inner field still needs its own `minWidth: 0` for the same RN-web reason — the
    // wrapper can only shrink as far as its content lets it.
    minWidth: 0,
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
  // Stepped card's inline current-step block. Same paddingTop as stepsWrap so a stepped
  // card and an expanded steps checklist sit at the same distance below the row.
  steppedWrap: { gap: Spacing.xs, paddingTop: Spacing.sm },
  steppedNote: { fontSize: FontSize.sm },
  steppedBack: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start' },
  steppedBackText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  addStepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  addStepInput: {
    // `minWidth: 0` for the same reason as `titleInput` above — and it is the same bug,
    // found by the same audit one width further down (327px, the `large` font proxy). `flex: 1`
    // alone cannot shrink an <input> below its automatic minimum size, so the add-step
    // button beside it was pushed 21px out through the card's overflow mask. The `flex: 1`
    // half lives on `titleFieldGrow` (the wrapper) since 2026-08-09; see the note there.
    minWidth: 0,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.sm,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontFamily: Type.label.fontFamily, fontSize: Type.label.size },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  monthWrap: { gap: Spacing.sm },
  monthDayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  monthDayInput: {
    minWidth: 56,
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: FontSize.sm,
  },
  energyCostRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs },
  // Applied ON TOP of the shared `labelRow` (10 call sites — don't add flex there), so only
  // this row's label yields to its stepper. `minWidth: 0` is the half that does the work:
  // without it the row's automatic minimum size still floors at the label's intrinsic width.
  energyLabelWrap: { flex: 1, minWidth: 0 },
  // And the Text itself has to be allowed to shrink inside that wrapper, or it just pushes
  // the wrapper back out to its natural width and nothing has been gained.
  energyLabelText: { flexShrink: 1 },
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
