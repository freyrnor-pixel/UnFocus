/**
 * plans.tsx — the "Tasks" / "Oppgaver" screen: a tabbed, inline-editable list.
 *
 * A sticky tab bar (Today · This week · All tasks) over sectioned lists. Editing is
 * always available (no lock): tapping a task in the All-tasks tab opens its inline
 * editor with a Discard / Save bar (see TaskCard). New tasks are made through the shared
 * inline AddRow at the bottom of the Whenever section — the one add-a-row affordance on
 * this screen — which creates an undated task on submit (optionally with a time and/or a
 * recurrence, since 2026-08-04, via the same Time/Repeat options panel PlanTaskCard's own
 * quick-add uses — see commitWhenever's header note); the editor can then promote it further
 * (date / steps). Today / This week expand a task to its steps
 * only (no settings); the Today section sits inside its own card. The Home "Today's plans"
 * preview keeps the unchanged PlanTaskCard day-view. On Today and This week the undated
 * **Whenever** section sits BELOW the dated content as a collapsed drawer (see `CollapsedSection`
 * and the Edit note); on All tasks it stays expanded at the top. Every section (Shared out /
 * Whenever / Recurring on All tasks; Whenever on Today/This week; each weekday on This week) always
 * renders, showing an empty message instead of disappearing when it has no tasks — kept
 * consistent with Shopping's always-visible list layout (app/(tabs)/shopping.tsx). Within
 * every Today/This-week section, `<DoneSplitList>` splits tasks into unfinished (shown
 * plainly) + finished (collapsed behind a "Finished (n)" zone), mirroring the Home-preview
 * done zone in components/PlanTaskCard.tsx.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/SharedTasksSection,
 *             components/SectionRail, components/SectionCard, components/TaskCard, components/AddRow,
 *             components/QuickAddOptionsPanel + components/QuickAddOptionRow +
 *             components/TimeBoxInput (2026-08-04 — the Whenever AddRow's Time/Repeat panel;
 *             Repeat became a picker over components/AppModal's showAppModal on 2026-08-05,
 *             replacing a tap-cycle — see PlanTaskCard's pickRecurring for the reasoning),
 *             components/DraggableTaskRow (the Whenever list's long-press-drag),
 *             components/PressableScale, components/Surface (the local CollapsedSection's card
 *             shell), components/Collapsible + components/AnimatedChevron
 *             (animated "Finished (n)" done-zone reveal, and the collapsed Whenever drawer),
 *             components/TabSlider,
 *             components/StarterCard (first-run explainer, shown while there are no tasks at
 *             all; `collapsible` as of 2026-08-06 v3 — its example row collapses to a
 *             trigger row rather than always showing),
 *             components/StarterExampleRow (its "Tidy up"/"Rydde" example row — a real daily,
 *             time-boxed, 5-step task its "+" button writes via useTaskStore), lib/taskStarters
 *             (that example's structural data — time box + step order), constants/theme,
 *             expo-router (useLocalSearchParams — `tab`/`expandTaskId`, see below; useRouter —
 *             the header share icon's push to /share-modal), lib/date,
 *             lib/domainColor, lib/haptics,
 *             lib/i18n, lib/useAppTheme, lib/useFirstVisitHint, lib/useDragReorder (that drag's
 *             shared bookkeeping), lib/useEnergyPause (2026-08-02 — which card "I'll decide"
 *             pinned; drives the Today list's head and every Today TaskCard's pinned/dimmed
 *             pair), lib/prefill (usePrefill — a note
 *             sent here seeds the Whenever add row), store/useTaskStore,
 *             store/useSettingsStore, store/usePeopleStore + components/PersonChip (the person
 *             filter row), store/useTagStore + components/TagChip + lib/tags (the tag filter
 *             row — multi-select, "any of"), components/EnergyBalanceCard (the shared-load
 *             comparison, People mode only, day/week tabs only),
 *             lib/useDayLog + lib/dayLog (2026-08-02 — the day log, i.e. what already
 *             happened today, passed into PlanTaskCard so its now-line becomes the boundary
 *             between that and the day ahead), lib/useNowMinutes (the shared 60s tick both
 *             the log's cutoff and the grid's now-line read, so they can't disagree),
 *             lib/useCalendarEvents + lib/deviceCalendar (READ-ONLY device-calendar events on
 *             the timeline; the hook owns the ONE contextual permission prompt — take
 *             `useIsFocused` from expo-router, never @react-navigation/native, which fails the
 *             bundle outright on SDK 56), store/useMomentsStore (manual capture + delete),
 *             components/CollapsedSection (the shared drawer — Whenever, plus "Goals"
 *             (2026-07-29, Goals dropped its own Home card; 2026-08-12, its own screen) and
 *             "Earlier days", both of which became drawers on 2026-08-10; they were two
 *             floating link cards, then rows in one `SubScreenLinkButton` card, and that
 *             component is now deleted), components/GoalsEditor (the Goals drawer's body —
 *             add/edit/delete happens in the drawer itself as of 2026-08-12;
 *             components/GoalsSheet.tsx, the popup its title used to open, is deleted),
 *             components/DayPickerSheet (`RecentDaysList` body + the pop-up its title opens)
 *   Used by → Expo Router route "/plans" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx;
 *             also reached with `?tab=all&expandTaskId=…` from app/notes.tsx's "Add to plans"
 *             (UX audit B1, 2026-07-23 — creates the task, then lands here with its editor open)
 *   Data    → reads/writes useTaskStore (tasks/steps); SharedTasksSection reads useSharedStore
 *             (gated on settings.featureSharing — opt-in, off for fresh installs)
 *             internally for incoming shares + accepts the sharedOut tasks as its "sent" half
 *
 * Edit notes:
 *   - **The "I'll decide" pin, Today only (2026-08-02, lib/useEnergyPause.ts)**: when the day is
 *     over budget the user can settle on ONE card; it lifts to the head of `todayList` and every
 *     other card on the tab drops to secondary weight (`pinned`/`dimmed` on TaskCard). Four
 *     things to keep intact: (1) the lift lives **inside the `todayList` memo**, not in a render
 *     branch — this tab has four of them (by-person, timeline, "One thing at a time", the plain
 *     section list) and they must not disagree about which card is first; (2) `dimmed` is
 *     opacity and nothing else — a dimmed card keeps its height, its check, its steps, its
 *     reminders and its counts, exactly like a lib/cardLayout.ts layout may de-emphasise but
 *     never remove; (3) **This week / All tasks / Whenever are deliberately untouched** — they
 *     are not "today"; (4) `pinnedTaskId` re-checks that the pinned card is still on the list,
 *     because nothing clears a pin when its task is finished, rescheduled or filtered out by
 *     the person/tag rows, and a pin with no visible badge would dim the day with no way back.
 *     The timeline branch handles its own pin inside components/PlanTaskCard.tsx — and there
 *     the pinned card keeps its clock position, for the same reason this tab isn't draggable.
 *   - **Drag to reorder, on the Whenever list only (2026-08-01)**: hold a card ~400ms and drag,
 *     the same gesture Home's cards, the shopping list, notes and habits use
 *     (lib/useDragReorder.ts). It is wired on the **All tasks** tab's Whenever section and
 *     nowhere else on this screen, deliberately: that is the one list here whose rows have no
 *     time to order them by, and it is the widest view of them — Today and This week show the
 *     same backlog through a narrower filter and in the same order, as a collapsed drawer.
 *     Every other list on this screen is ordered by the clock (`byTime`), where dragging a
 *     09:00 task below a 14:00 one would either lie about the order or silently retime the
 *     task. Three things to keep intact: render from `wheneverDragged` (the drag's live order),
 *     not `wheneverAll`; keep `openEditorIds` fed by TaskCard's `onExpandedChange`, or a
 *     long-press inside an open editor's text field grabs the row instead of placing the
 *     caret; and both Whenever selectors must keep sorting by `sortOrder`, or the drawer on
 *     Today/This week shows the same rows in a different order from where they were dropped.
 *   - **Whenever moved below the day + collapsed (2026-08-01, DESIGN_RULES.md rule 7 —
 *     "order by what's needed first")**: on **Today** and **This week** the undated backlog used
 *     to render FIRST, above the tab's own content — the least time-sensitive section holding the
 *     highest-priority slot on a tab literally called Today. It now renders LAST (before the
 *     Goals drawer) as a `<CollapsedSection>` drawer, default closed, header + count still visible.
 *     Three things to keep intact if you touch this: (1) **All tasks is deliberately unchanged** —
 *     Whenever stays expanded at the top there, where it is a real section of the content rather
 *     than an interruption; (2) "One thing at a time" (`focusFirst`) still drops the section from
 *     Today entirely — that exclusion predates this change and is not the same thing as
 *     collapsing it; (3) the drawer's rows are OUT of `visibleTaskIds`, for the same reason
 *     finished rows are (see that memo's comment). Order per tab is now Today/week content →
 *     Whenever drawer → Goals link, with each section's own "Done (n)" zone last inside it.
 *   - **Header share icon wired (2026-07-28)**: `onSharePress` (gated on `featureSharing`,
 *     same flag as SharedTasksSection above) pushes `/share-modal?kind=t` — mirrors
 *     Shopping's `kind=s` wiring (app/(tabs)/shopping.tsx, restored 2026-07-23). Previously
 *     this screen had no header share icon at all; share-modal now also offers a "Send as
 *     text" action (lib/shareText.ts) alongside its QR code, so this is the entry point for
 *     texting a plain-text checklist of upcoming tasks, not just QR-to-QR device sharing.
 *   - **Tab bar (2026-07-23, shared component)**: the sticky Today/This week/All tasks
 *     switcher is `components/TabSlider.tsx` — a single accent pill SLIDES between the
 *     three equal-width segments (Reanimated), replacing the old per-tab `TabBoxHighlight`
 *     boxes. Same shared component as app/(tabs)/shopping.tsx and app/settings.tsx's tab
 *     bars. **TabSlider is the SCREEN tier and owns the accent pill** — a picker nested
 *     inside a card/form is the FORM tier and uses `FormControls`' `SegmentedControl`
 *     (raised pill) instead; see TabSlider's header for the two-tier rule (2026-08-09).
 *   - **Tab order (2026-07-14)**: Today → This week → All tasks (was All → Today → Week).
 *   - **Unfinished/finished split (2026-07-14)**: the local `<DoneSplitList>` component
 *     (defined just above `TasksScreen`) filters a section's tasks into unfinished (always
 *     shown) + finished (behind a collapsible "Done" header, default collapsed) —
 *     applied to the Today section, each This-week weekday group, and both Whenever sections.
 *     The All-tasks tab is untouched — its sections still render flat.
 *   - **Boxed sections (2026-07-17)**: every task section (Today / Whenever / Recurring on
 *     All; Today + Whenever; each This-week day + Whenever) is now wrapped in a single
 *     `<SectionCard>` — a bordered glass card, hue-edged to the section's domain color, that
 *     holds the `<SectionRail>` header AND the section's rows as one clearly-bounded group.
 *     This replaces the earlier "loose cards on the shared backdrop" treatment, which read as
 *     a run of separated, unrelated boxes. Because the card edge now carries the section hue,
 *     the rows inside no longer pass a per-card `railColor` (that would double-code the color).
 *   - **"Done" sub-header (2026-07-16)**: the finished zone's header is the same
 *     `<SectionRail>` pill as the Whenever/Recurring/day headers (hue = `theme.good` status
 *     green), with the collapse `AnimatedChevron` in its right slot — so "Done" reads as a
 *     peer sub-header, not a bare text row. Reveal is a clip/unveil (see Collapsible), not a fade.
 *     The zone is framed (`styles.doneZone` — border + `theme.surface` background) so the
 *     header and its rows read as one card that grows/shrinks together, and its toggle press
 *     uses `Spring.calm` (constants/motion) instead of the default bouncy release — a
 *     repeatedly-tapped section toggle shouldn't overshoot as much as a one-off button press.
 *   - **Per-day add (2026-07-16)**: `<InlineTaskAdd>` (defined above `TasksScreen`) puts an
 *     AddRow in the Today section (dates the task today) and each This-week day group (dates it
 *     that weekday), so tasks can be made from Today/This week — not only as undated Whenever
 *     tasks from the All tab. All tabs read the one store, so a new task shows everywhere at
 *     once (its day group, Today, and the All tab's Whenever) with no extra sync. The add row
 *     is passed to `<DoneSplitList footer=…>` (not rendered after it), so within a section the
 *     order is unfinished tasks → add row → collapsed "Done" zone — the active/white containers
 *     stay grouped and the green "Done" zone always sits last, instead of green being sandwiched
 *     between the tasks and the add row (2026-07-16 color-order fix).
 *   - **Color-rail redesign (2026-07-13)**: section order is now **Whenever → Repeating →
 *     Shared**. Headers are `<SectionRail>` (a hue dot + label + count); each section's cards
 *     wear a matching `railColor` left edge (TaskCard's `railColor` prop) so a card visibly
 *     belongs to its section. Hues are domain accents via lib/domainColor: Whenever = task
 *     (blue), Repeating = meal (orange — was plan/indigo, too close to Whenever's blue;
 *     2026-07-14), Shared = shop (green) — all with light+dark variants, so `red` stays
 *     reserved for STATUS (the done circle is `theme.good`, never a hue).
 *   - **Merged Shared section**: the old top-of-screen incoming `SharedRequestsSection` +
 *     standalone "Shared out" section are replaced by one `<SharedTasksSection>` (last section)
 *     combining received (↓ Accept/Dismiss) and sent (↑ TaskCard) rows with per-row direction
 *     indicators. It takes `sentTasks={sharedOutAll}` and reads incoming shares itself.
 *   - No lock: the old module-session `taskLockedSession` is gone. TaskCard's Discard/Save
 *     bar is the commit point for edits; creation goes through the Whenever AddRow, which
 *     calls addTask() directly on submit (no local draft rows). TaskCard still supports an
 *     `isNew` draft mode but plans no longer uses it (candidate for later cleanup).
 *   - **`expandTaskId` (UX audit B1, 2026-07-23; first real caller 2026-08-01)**: built for
 *     app/notes.tsx's "Add to plans" (create the task, then navigate here with its id so its
 *     editor opens automatically), but that flow now uses `lib/prefill.ts` instead and never
 *     called it — Home's To-do quick-add "…" (`app/(tabs)/index.tsx`'s `handleAddTaskAndEdit`)
 *     is the first actual caller. Both the Whenever AND Repeating sections' TaskCard pass
 *     `autoExpand={tk.id === expandTaskId}` (a quick-added task lands in whichever one its
 *     recurring setting puts it in) so that ONE card's editor opens automatically. Distinct
 *     from `isNew`: the task is already a real store row by the time it arrives, just handed
 *     a "start open" cue.
 *     **It is now also how you OPEN an existing task's editor from elsewhere (2026-08-08)** —
 *     the day-log rows here and on Home, and the timeline's `onPressTask`, all pushed
 *     `/task-form` until then, a route retired 2026-07-23, so all three simply went nowhere.
 *     From within this screen use `router.setParams`, not `push`: pushing /plans onto itself
 *     stacks a second copy of a pager tab.
 *   - Section selectors: Whenever = recurring 'none' & !sharedOut (All tab includes dated
 *     one-offs); Recurring = recurring !== 'none' & !sharedOut; Shared = sharedOut (sent) +
 *     useSharedStore 'in' rows (received). In Today / This week the "Whenever" section is
 *     undated tasks only, and shared tasks are tinted instead of getting their own section.
 *   - New tasks are always created in Whenever (undated, non-recurring); the editor can
 *     then promote them (date / repeat).
 *   - **Always-visible sections**: every named section always renders with a
 *     `styles.sectionEmpty` placeholder (i18n keys `tasksSection*Empty` / `tasksDayEmpty`).
 *   - **Add affordance**: the shared `AddRow` (empty row + "+") sits in a plain bordered card
 *     (not a translucent Surface) at the bottom of Whenever, with the Whenever-blue rail so its
 *     full edge is visible over the particle background.
 *   - Store hydration happens once at startup in app/_layout.tsx; this screen's focus effect
 *     only seeds the first-run blank draft (see below).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import TourTarget from '@/components/TourTarget';
import SharedTasksSection from '@/components/SharedTasksSection';
import SectionRail from '@/components/SectionRail';
import SectionCard from '@/components/SectionCard';
import TaskCard from '@/components/TaskCard';
import PlanTaskCard from '@/components/PlanTaskCard';
import LayoutPickerSheet from '@/components/LayoutPickerSheet';
import { useSurfaceLayout } from '@/lib/useSurfaceLayout';
import { useDayLog } from '@/lib/useDayLog';
import { useCalendarEvents } from '@/lib/useCalendarEvents';
import { useNowMinutes } from '@/lib/useNowMinutes';
import { DayEntry } from '@/lib/dayLog';
import { useMomentsStore } from '@/store/useMomentsStore';
import { useCardState } from '@/lib/useCardState';
import { useNewSinceSeen } from '@/lib/useNewSinceSeen';
import AddRow from '@/components/AddRow';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import PressableScale from '@/components/PressableScale';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import TabSlider, { TAB_SLIDER_HEIGHT } from '@/components/TabSlider';
import CollapsedSection from '@/components/CollapsedSection';
import GoalsEditor from '@/components/GoalsEditor';
import DayPickerSheet, { RecentDaysList } from '@/components/DayPickerSheet';
import StarterCard from '@/components/StarterCard';
import StarterExampleRow from '@/components/StarterExampleRow';
import { todayStr, getWeekDates, dayOfWeekMon0 } from '@/lib/date';
import TimeBoxInput from '@/components/TimeBoxInput';
import QuickAddOptionsPanel from '@/components/QuickAddOptionsPanel';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
import { showAppModal } from '@/components/AppModal';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { usePrefill } from '@/lib/prefill';
import { useDragReorder } from '@/lib/useDragReorder';
import { useEnergyPause } from '@/lib/useEnergyPause';
import { tap, success } from '@/lib/haptics';
import { PLAN_STARTER_STEPS, PLAN_STARTER_TIME, PLAN_STARTER_FINISH_TIME } from '@/lib/taskStarters';
import { Recurring, Task, useTaskStore } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SHARING_VISIBLE } from '@/lib/sharingVisibility';
import { usePeopleStore } from '@/store/usePeopleStore';
import PersonChip from '@/components/PersonChip';
import TagChip from '@/components/TagChip';
import EnergyBalanceCard from '@/components/EnergyBalanceCard';
import { useTagStore } from '@/store/useTagStore';
import { matchesTagFilter, toggleTagId } from '@/lib/tags';
import { effectiveAssigneeId } from '@/lib/taskRotation';
import { personColor } from '@/lib/personColor';
import { FontSize, Radius, SCREEN_GAP, Spacing, TabularNums, Type } from '@/constants/theme';
import { Spring } from '@/constants/motion';
import type { LayoutSpec } from '@/lib/cardLayout';
import { isCompletable } from '@/lib/cardType';
import { getDomainColor } from '@/lib/domainColor';
import { getScreenColor } from '@/lib/screenColor';

type Tab = 'all' | 'today' | 'week';

/** Time-order comparator: timed tasks first (by HH:MM), then untimed by title. */
function byTime(a: Task, b: Task): number {
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return a.title.localeCompare(b.title);
}


/**
 * How many unfinished tasks "Now and next" leaves on screen: the one you're on and the one
 * after it. Two is the point of the layout — three would just be a shorter list.
 */
const FOCUS_VISIBLE = 2;
/** How many rows "One thing at a time" draws under its hero. Small on purpose — the layout
 *  exists so the day doesn't look like a wall; anything past this is one tap away via Later. */
const FOCUS_THEN_VISIBLE = 2;

/**
 * Splits a task list into unfinished (shown plainly) + finished (collapsed behind a
 * "Finished (n)" zone, same convention as PlanTaskCard's Home-preview done zone). Falls
 * back to `emptyText` only when the whole list is empty — an all-finished list still
 * shows the (collapsed) finished zone rather than the empty placeholder.
 */
function DoneSplitList({
  tasks,
  emptyText,
  renderCard,
  footer,
  focusMode,
}: {
  tasks: Task[];
  emptyText: string;
  renderCard: (tk: Task) => React.ReactNode;
  /**
   * Rendered right after the unfinished cards and *before* the collapsed "Done" zone
   * (e.g. the inline add-a-task row). Keeps the active/white containers grouped together
   * so the green "Done" zone always sits at the bottom of the section, not sandwiched
   * between the tasks and the add row. Also shown in the empty state (below the placeholder).
   */
  footer?: React.ReactNode;
  /**
   * "Now and next" (lib/cardLayout.ts's `focusMode`): show only the first two unfinished
   * tasks and tuck the rest behind a count the user can open. Nothing is removed from the
   * data or from the section's own totals — this is purely how many rows are drawn, and the
   * hidden tasks keep every reminder they already had.
   */
  focusMode?: boolean;
}) {
  const theme = useAppTheme();
  const t = useT();
  const [doneOpen, setDoneOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const unfinished = useMemo(() => tasks.filter((tk) => !tk.done), [tasks]);
  const finished = useMemo(() => tasks.filter((tk) => tk.done), [tasks]);
  // A 'note' card is never done, so it always lands in `unfinished` — correct for an
  // ordinary layout, where it should simply be in the list. In a FOCUS layout, which shows
  // only the next few things, it must not take one of those slots: a note isn't work, and
  // "what's next" answered with a note is a wrong answer. Notes go to "The rest" instead.
  // Outside focus mode this is inert — `focused` is still the whole unfinished list and
  // `rest` is still empty, exactly as before card types existed.
  const actionable = useMemo(() => unfinished.filter((tk) => isCompletable(tk.cardType)), [unfinished]);
  const unfinishedNotes = useMemo(() => unfinished.filter((tk) => !isCompletable(tk.cardType)), [unfinished]);
  const focused = focusMode ? actionable.slice(0, FOCUS_VISIBLE) : unfinished;
  const rest = focusMode ? [...actionable.slice(FOCUS_VISIBLE), ...unfinishedNotes] : [];

  if (tasks.length === 0) {
    return (
      <>
        <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          {emptyText}
        </Text>
        {footer}
      </>
    );
  }

  return (
    <>
      {focused.length > 0 && <View style={styles.cardStack}>{focused.map(renderCard)}</View>}
      {rest.length > 0 && (
        <View style={styles.cardStack}>
          <PressableScale onPress={() => { tap(); setRestOpen((v) => !v); }} scaleTo={0.97} releaseSpring={Spring.calm}>
            <SectionRail
              hue={theme.textMuted}
              label={t.config.layouts.moreLabel}
              count={rest.length}
              right={<AnimatedChevron open={restOpen} size={16} color={theme.textMuted} />}
            />
          </PressableScale>
          <Collapsible open={restOpen}>
            <View style={styles.cardStack}>{rest.map(renderCard)}</View>
          </Collapsible>
        </View>
      )}
      {footer}
      {finished.length > 0 && (
        <View style={[styles.doneZone, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* "Done" reads as a peer of the Whenever / Recurring / day sub-headers — same
              SectionRail pill (hue = status green), with the collapse chevron in its right slot.
              The zone itself is framed (border/background) so header + rows read as one card
              that grows/shrinks together, not a header floating over bare rows. */}
          <PressableScale onPress={() => { tap(); setDoneOpen((v) => !v); }} scaleTo={0.97} releaseSpring={Spring.calm}>
            <SectionRail
              hue={theme.good}
              label={t.tasksDoneLabel}
              count={finished.length}
              right={<AnimatedChevron open={doneOpen} size={16} color={theme.good} />}
            />
          </PressableScale>
          <Collapsible open={doneOpen}>
            <View style={styles.cardStack}>{finished.map(renderCard)}</View>
          </Collapsible>
        </View>
      )}
    </>
  );
}

/**
 * Inline "add a task" row scoped to a specific date — the Today card and each This-week day
 * group get their own so a task can be made straight into that day (not only as an undated
 * Whenever task from the All tab). Owns its own input state; on submit it creates a dated,
 * non-recurring task (hasStartDate=true) via useTaskStore.add — so it immediately shows in
 * this day's list, in Today, and under the All tab's Whenever, all reading the same store.
 * `wrapped` renders it inside a bordered card (for the Today section and each This-week day
 * group, which all sit loose on the particle background); bare (default) appends the row
 * directly, for a caller that already provides its own surrounding card.
 */
function InlineTaskAdd({
  date,
  accent,
  assigneeId = '',
  assignee = '',
  wrapped,
}: {
  date: string;
  accent: string;
  /** Person the new task belongs to — the active filter, so adding while filtered to
   *  someone puts the row where the user is looking rather than back on themselves. */
  assigneeId?: string;
  /** Denormalised name mirror written alongside assigneeId (see Task.assignee). */
  assignee?: string;
  wrapped?: boolean;
}) {
  const theme = useAppTheme();
  const t = useT();
  const addTask = useTaskStore((s) => s.add);
  const [value, setValue] = useState('');

  const commit = useCallback(() => {
    const title = value.trim();
    if (!title) return;
    addTask({
      title,
      date,
      taskType: 'start-at',
      done: false,
      recurring: 'none',
      recurringDays: [],
      weekInterval: 1,
      monthlyMode: 'day',
      monthDay: 1,
      monthOrdinal: 'first',
      monthWeekday: 0,
      sortOrder: 0,
      hasStartDate: true,
      assigneeId,
      assignee,
    });
    setValue('');
  }, [value, date, assigneeId, assignee, addTask]);

  const row = (
    <AddRow
      placeholder={t.newTask}
      value={value}
      onChangeText={setValue}
      onSubmit={commit}
      accent={accent}
      showDivider={!wrapped}
      accessibilityLabel={t.newTask}
    />
  );

  if (wrapped) {
    return (
      <View style={[styles.addRowCard, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: accent }]}>
        {row}
      </View>
    );
  }
  return row;
}

/**
 * "One thing at a time" (lib/cardLayout.ts's `focusFirst`) — the Today tab's 1c shape from
 * design-system v6's `Focus First (1c)`.
 *
 * Order is the whole point of this layout, and it goes: the ONE thing you're on → the couple
 * of things after it → add → what you already did. Everything a normal Today shows is still
 * there; it is drawn in a different order and with everything past the first two collapsed.
 *
 * The mock's "Later" row of count chips is NOT here. It duplicated the tab bar sitting a few
 * pixels above it — same three destinations, same tap behaviour — so the counts moved onto
 * the tab bar's own `accessory` slot instead (see the TabSlider call below) and the second
 * control went away. One control, and it stays where the user already knows it is.
 *
 * Presentation only, like every other layout: nothing here filters, reschedules or reorders
 * the underlying tasks — `tasks` arrives already sorted by time from the screen, and the hero
 * is simply its first unfinished row.
 */
function FocusFirstToday({
  tasks,
  onToggleDone,
  spec,
  newSinceIds,
  newFields,
  pinProps,
  footer,
}: {
  tasks: Task[];
  onToggleDone: (task: Task) => void;
  spec: LayoutSpec;
  newSinceIds: ReadonlySet<string>;
  newFields: { meta: boolean; price: boolean; extras: boolean };
  /** Energy's "I'll decide" pin/dim pair for one card — see the screen's `pinProps`. */
  pinProps: (task: Task) => { pinned: boolean; dimmed: boolean };
  footer: React.ReactNode;
}) {
  const theme = useAppTheme();
  const t = useT();
  // 'note' cards are excluded outright here: this layout is "the one thing to do next", and
  // a note has nothing to do. `doneCount` is counted directly rather than as a remainder of
  // the list length, which would otherwise now count every note as finished.
  const unfinished = useMemo(() => tasks.filter((tk) => !tk.done && isCompletable(tk.cardType)), [tasks]);
  const doneCount = useMemo(() => tasks.filter((tk) => tk.done).length, [tasks]);
  const hero = unfinished[0];
  // "Then" is deliberately a SHORT list, not the remainder — the point of this layout is that
  // the day doesn't look like a wall. Anything past it is reachable one tap away via Later.
  const then = unfinished.slice(1, 1 + FOCUS_THEN_VISIBLE);
  const overflow = Math.max(0, unfinished.length - 1 - then.length);

  return (
    <View style={styles.focusWrap}>
      {hero ? (
        <View style={styles.focusHero}>
          <Text style={[styles.focusLabel, { color: theme.accent }]}>{t.focusFirst.nextUp}</Text>
          {/* The hero is a normal TaskCard, not a bespoke card: it has to keep the steps
              expansion, the done circle, the person/tag meta line and the reminders that
              every other task row has. Only its surroundings change. */}
          <TaskCard
            task={hero}
            variant="steps"
            tinted={hero.sharedOut}
            spec={spec}
            isNewSince={newSinceIds.has(hero.id)}
            newFields={newFields}
            onToggleDone={onToggleDone}
            {...pinProps(hero)}
          />
        </View>
      ) : (
        <Text style={[styles.focusAllClear, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          {t.focusFirst.allClear}
        </Text>
      )}

      {then.length > 0 && (
        <View style={styles.focusThen}>
          <Text style={[styles.focusLabel, { color: theme.textMuted }]}>{t.focusFirst.then}</Text>
          <View style={styles.cardStack}>
            {then.map((tk) => (
              <TaskCard
                key={tk.id}
                task={tk}
                variant="steps"
                tinted={tk.sharedOut}
                spec={spec}
                isNewSince={newSinceIds.has(tk.id)}
                newFields={newFields}
                onToggleDone={onToggleDone}
                {...pinProps(tk)}
              />
            ))}
          </View>
          {overflow > 0 && (
            <Text style={[styles.focusOverflow, { color: theme.textMuted }]}>
              {t.focusFirst.andMore(overflow)}
            </Text>
          )}
        </View>
      )}

      {footer}

      {doneCount > 0 && (
        <Text style={[styles.focusDone, { color: theme.good }]}>{t.focusFirst.doneToday(doneCount)}</Text>
      )}
    </View>
  );
}

// The reserved sticky-bar height comes FROM TabSlider now (2026-08-10) — it was a hand-copied
// 46 here, another in shopping.tsx, and two more (48, 56) in settings.tsx and the design lab.
// Any surplus becomes leftover space that `stickyBar`'s justifyContent:'center' splits
// top/bottom only, making the blue pill's vertical inset bigger than its horizontal one
// (visual bug fixed 2026-07-24: this was 56, a 10px surplus). Four copies of a number that
// must equal a fifth is how that happens, so there is one number now — don't restate it.
const STICKY_HEIGHT = TAB_SLIDER_HEIGHT;

export default function TasksScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  // Section hues (color-rail redesign): each list section carries a stable domain accent —
  // Whenever = task (blue). Both tokens have light + dark variants, so the rail/dot/label
  // stay distinct and legible in both modes. Shared handles its own (shop/green) hue inside
  // SharedTasksSection.
  // Repeating = health (rose), changed 2026-08-04 (design-comparison task 06, the named
  // "recurring and habits" colour complaint). It was `meal` (a real, distinct orange) until
  // the 2026-07-31 four-hue identity collapse (addendum A.3) aliased `cardMeal` onto
  // `cardShop`'s gold — so this section had been silently rendering in the exact hue of the
  // Shopping tab ever since, despite having nothing to do with shopping. Health is the one
  // card-identity hue nothing else on this screen uses, so it costs nothing else its own
  // distinctiveness. See DESIGN_COMPARISON/06-which-colour-system.md and the addendum note
  // in constants/colors.ts for the full reasoning (including why Habits' hue was NOT touched
  // the same way).
  // NOTE (2026-07-27, still true): `repeatingHue` borrows a colour token only — the section
  // has no health identity. Its SectionCard therefore passes domain="health" (so the badge
  // gradient matches this hue) together with an explicit icon="repeat" override, because the
  // badge glyph otherwise comes from the domain and would draw a heart on Recurring tasks.
  // Don't drop the icon override, and don't "fix" it by switching the domain alone — that
  // would desync the badge colour from the label/divider, which both follow `hue`.
  // This screen's own blue (2026-08-06) — was lib/domainColor's 'task' identity, a close but
  // not identical blue to the screen's own (featTask), which is what the card edge already
  // draws everywhere on this tab. `repeatingHue` stays on the domain palette below: it's a
  // deliberate borrowed colour to set Recurring apart from Whenever (see the note there).
  const wheneverHue = getScreenColor(theme, 'plans').base;
  const repeatingHue = getDomainColor(theme, 'health').accent;

  const tasks = useTaskStore((s) => s.tasks);
  const tasksLoaded = useTaskStore((s) => s.loaded);

  // Card layout (2026-07-27). Read-only, presentation-only: `focusMode` changes how many
  // rows DoneSplitList draws, and `spec` gates the collapsed row's at-a-glance cues. A task
  // that the layout doesn't draw is still a live task — it keeps its reminders, still counts
  // in every section header, and is one tap away behind "The rest".
  const layoutSpec = useSurfaceLayout('plans');
  // Card size for the timeline layout's day card (2026-07-30). Keyed to 'plans', so the To-do
  // tab remembers its own size independently of Home's to-do card ('homeTodo').
  const [todayCardState, setTodayCardState] = useCardState('plans');
  const planTimelineHorizontal = useSettingsStore((s) => s.planTimelineHorizontal);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const tasksForDate = useTaskStore((s) => s.tasksForDate);
  const tasksForWeek = useTaskStore((s) => s.tasksForWeek);
  const toggle = useTaskStore((s) => s.toggle);
  const addTask = useTaskStore((s) => s.add);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);
  const addTaskStep = useTaskStore((s) => s.addStep);
  // Stable handler so the memoised TaskCards / SharedTasksSection don't get a fresh
  // onToggleDone closure every render (which would defeat their React.memo).
  const handleToggleDone = useCallback((task: Task) => toggle(task.id), [toggle]);

  // People/family is part of the sharing surface that's hidden while the single-user basics
  // are reworked (2026-08-05) — see lib/sharingVisibility.ts. The setting keeps its stored
  // value and every person row stays in the DB, so an existing multi-person setup returns
  // intact when the switch flips back; only the UI stands down.
  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled) && SHARING_VISIBLE;
  // People registry (2026-07-28) — the self row always exists, so >1 is what actually means
  // "there is somebody else to filter by".
  const people = usePeopleStore((s) => s.people);
  const showPeople = peopleModeEnabled && people.length > 1;
  const allTags = useTagStore((s) => s.tags);
  // Sharing is opt-in (Settings → Advanced → Features), off on a fresh install — it hides
  // the shared-tasks section below. Tasks already shared stay in the store untouched.
  // Sharing is hidden wholesale while the single-user basics are reworked (2026-08-05) —
  // see lib/sharingVisibility.ts. The setting is still read so nothing else changes shape.
  const featureSharing = useSettingsStore((s) => s.featureSharing) && SHARING_VISIBLE;
  // Energy is a real toggle again (2026-07-31) — gates the shared-load card below.
  const energySystemEnabled = useSettingsStore((s) => s.energySystemEnabled);
  // Gates the "Goals" link button below (2026-07-29) — same flag TaskCard's own GoalPicker
  // field already reads, so turning Goals off hides both at once.
  const featureGoals = useSettingsStore((s) => s.featureGoals);
  const featureDayLog = useSettingsStore((s) => s.featureDayLog);

  const [tab, setTab] = useState<Tab>('today');
  // The ⓘ hint is collapsed until tapped (2026-07-31 — the first-visit auto-open, and the
  // per-screen `autoOpen` arg that used to switch it off here, are both gone). This screen's
  // StarterCard already teaches the same thing WITH a tappable example row.
  const [hintOpen, dismissHint] = useFirstVisitHint('plans');
  // Person filter (People/family mode): null = Everyone, otherwise a person id.
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  // Tag filter (2026-07-28) — selected tag ids; empty means "All tags". Unlike the person
  // filter this is multi-select, because tags are not mutually exclusive the way people are.
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  // Inline "add a row" input for the Whenever section — the one add affordance on this screen.
  const [wheneverInput, setWheneverInput] = useState('');
  // Whenever's Time + Repeat options panel (2026-08-04) — closes the parity gap with
  // PlanTaskCard's own quick-add, which already has both; same state/cycle shape.
  const [wheneverTime, setWheneverTime] = useState('');
  const [wheneverRecurring, setWheneverRecurring] = useState<Recurring>('none');
  const [wheneverRecurringDays, setWheneverRecurringDays] = useState<number[]>([]);
  // A picker, not a tap-cycle (2026-08-05) — mirrors components/PlanTaskCard.tsx's
  // pickRecurring, whose copy of this function carries the full reasoning.
  function pickWheneverRecurring() {
    tap();
    const options: Recurring[] = ['none', 'daily', 'weekly', 'monthly'];
    showAppModal(
      t.pad.recurrencePicker,
      undefined,
      [
        ...options.map((mode) => ({
          text: mode === wheneverRecurring ? `• ${wheneverRecurringLabel(mode)}` : wheneverRecurringLabel(mode),
          onPress: () => {
            if (mode === 'weekly') {
              setWheneverRecurringDays((days) => (days.length ? days : [dayOfWeekMon0(new Date())]));
            }
            setWheneverRecurring(mode);
          },
        })),
        { text: t.cancel, style: 'cancel' as const },
      ]
    );
  }
  function wheneverRecurringLabel(mode: Recurring): string {
    if (mode === 'daily') return t.taskRecurDay;
    if (mode === 'weekly') return t.taskRecurWeek;
    if (mode === 'monthly') return t.taskRecurMonth;
    return t.taskRecurNever;
  }
  // Screen-level StarterCard's example (2026-07-31, user report: it vanished with no feedback
  // the instant its "+" was pressed, since that write flips `tasks.length` off zero). Keeps the
  // card mounted, dimmed, for the rest of this visit instead — see addPlanStarterTask below and
  // components/StarterExampleRow's `added` Edit note.
  const [planStarterAdded, setPlanStarterAdded] = useState(false);

  // Arriving from app/notes.tsx's "Add to plans" (UX audit B1, 2026-07-23): it creates
  // the task then navigates here with the new task's id so its TaskCard editor opens
  // automatically (see the Whenever section's `autoExpand` prop below). This pager tab
  // stays mounted (lazy:false), so a param change alone won't remount TaskCard — but the
  // task itself is brand new, so its TaskCard is always a fresh mount the first time it
  // appears in `wheneverAll`, which is what actually seeds `autoExpand` correctly.
  const { tab: tabParam, expandTaskId } = useLocalSearchParams<{ tab?: Tab; expandTaskId?: string }>();
  useEffect(() => {
    if (tabParam) setTab(tabParam);
  }, [tabParam]);

  // Arrived from a note's ⋯ → Send it to… → To-do (2026-07-30): seed the Whenever add row
  // with the note's text (lib/prefill.ts). Distinct from `expandTaskId` above, which arrives
  // AFTER a task already exists — here the task hasn't been created yet, and the user gets to
  // adjust the wording before it is.
  const prefill = usePrefill();
  useEffect(() => {
    if (prefill) setWheneverInput(prefill);
  }, [prefill]);

  const today = todayStr();

  // The day log (2026-08-02) — what already happened today, cut at the now-line so a task
  // due later never reads as already done. `useNowMinutes` is the same shared 60s tick the
  // timeline's now-line runs on, so the log and the grid can't disagree about where "now"
  // is. Returns undefined when settings.featureDayLog is off, which is what PlanTaskCard's
  // dayLog prop gates itself on below.
  const nowMinutes = useNowMinutes();
  const dayLog = useDayLog(today, nowMinutes);
  const removeMoment = useMomentsStore((s) => s.remove);
  const addMoment = useMomentsStore((s) => s.add);
  // Device calendar (2026-08-02). The hook owns the contextual permission prompt — asked
  // once, here, the first time the timeline is opened, never during onboarding. A decline
  // yields [] permanently and is never mentioned again; the timeline is complete without it.
  // All five tab screens are mounted at once (`lazy: false`), so "is this screen mounted"
  // is not "is the user looking at it" — hence a real focus check, which is also what makes
  // the permission prompt land when the timeline is first OPENED rather than at app launch.
  const isFocused = useIsFocused();
  const calendarEvents = useCalendarEvents(today, isFocused);
  // A log row opens the record it came from. Only tasks have an in-app editor to open;
  // doses and health entries live on the Health tab, and a moment IS its own record, so
  // those simply aren't pressable rather than pretending to navigate somewhere.
  //
  // A task's editor is an expanded TaskCard on a saved row, not a route — app/task-form.tsx
  // was retired 2026-07-23 (UX audit B1). This pushed that dead route until 2026-08-08 and
  // simply went nowhere. `setParams`, not `push`, for the same reason
  // handleTimelineAddTaskAndEdit gives below: this screen already IS /plans, and pushing it
  // onto itself stacks a second copy of a pager tab.
  const handlePressLogEntry = useCallback(
    (entry: DayEntry) => {
      if (entry.kind !== 'task' || !entry.sourceId) return;
      router.setParams({ tab: 'all', expandTaskId: entry.sourceId });
    },
    [router]
  );

  // Person filter predicate — identity unless People/family mode is on AND a specific
  // person (not "Everyone") is selected. An empty assigneeId means "mine": that covers
  // rows written before the People back-fill, rows a peer created without assigning, and
  // rows whose person was removed — none of which should vanish from every filter.
  const selfPersonId = people.find((p) => p.isSelf)?.id ?? '';
  // What a row added while filtered should be assigned to. The name mirror stays '' for
  // the self person, matching the pre-registry convention that '' meant "me".
  const filterPerson = personFilter ? people.find((p) => p.id === personFilter) ?? null : null;
  const addAssigneeName = filterPerson && !filterPerson.isSelf ? filterPerson.name : '';

  // The timeline layout's own quick-add (2026-07-30, energy field dropped 2026-08-01 — see
  // PlanTaskCard's header). Unlike InlineTaskAdd's title-only create, PlanTaskCard's type line
  // also carries a start time and a repeat cycle — so a task typed straight onto the timeline
  // can land at a real hour, which is the whole point of being on a timeline. `hasStartDate:
  // true` because this IS the dated Today list, not Whenever.
  const handleTimelineAddTask = useCallback(
    (
      title: string,
      extra: { time?: string; recurring: Recurring; recurringDays: number[] }
    ) => {
      // Returns the created Task so handleTimelineAddTaskAndEdit below can open it.
      return addTask({
        title,
        date: today,
        time: extra.time,
        taskType: 'start-at',
        done: false,
        recurring: extra.recurring,
        recurringDays: extra.recurringDays,
        weekInterval: 1,
        monthlyMode: 'day',
        monthDay: new Date().getDate(),
        monthOrdinal: 'first',
        monthWeekday: 0,
        sortOrder: 0,
        hasStartDate: true,
        assigneeId: personFilter ?? '',
        assignee: addAssigneeName,
      });
    },
    [addTask, today, personFilter, addAssigneeName]
  );
  /**
   * "More options" on the timeline's quick-add (2026-08-05). This screen mounts the same
   * `PlanTaskCard` Home does but never passed this, so the identical card showed the button
   * on Home and silently omitted it here — DESIGN_RULES.md rule 8, "same element, same
   * position, every screen".
   *
   * Creates the task (a task's editor is an expanded TaskCard on a saved row — see
   * PlanTaskCard's `commitAddAndEdit`) and switches to the All tab, where `expandTaskId`'s
   * autoExpand lives. An empty line creates nothing and just switches tabs, so the press
   * always leads somewhere.
   */
  const handleTimelineAddTaskAndEdit = useCallback(
    (
      title: string,
      extra: { time?: string; recurring: Recurring; recurringDays: number[] }
    ) => {
      // `setParams`, not `push` — Home pushes to /plans because it is somewhere else, but
      // this screen already IS /plans, and pushing it onto itself would stack a second copy
      // of a pager tab. Setting the params feeds the same `tab`/`expandTaskId` effect below.
      if (!title) {
        router.setParams({ tab: 'all' });
        return;
      }
      const task = handleTimelineAddTask(title, extra);
      router.setParams({ tab: 'all', expandTaskId: task.id });
    },
    [handleTimelineAddTask, router]
  );
  // Both filter rows in one predicate: a task has to pass the person filter AND the tag
  // filter to show. (Within the TAG row, multiple chips are "any of" — see lib/tags.ts's
  // matchesTagFilter for why intersecting there reads as a broken filter.)
  // `effectiveAssigneeId` rather than `assigneeId`: a rotating chore belongs to whoever
  // has the turn on that date, so filtering by the raw column would hide it from the
  // person who actually has to do it today and show it to someone who doesn't.
  const matchFilters = useCallback(
    (tk: Task) =>
      (!showPeople ||
        personFilter === null ||
        (effectiveAssigneeId(tk, tk.date || today) || selfPersonId) === personFilter) &&
      matchesTagFilter(tk.tagIds, tagFilter),
    [showPeople, personFilter, selfPersonId, tagFilter, today]
  );

  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const weekStart = weekDates[0];

  // ── Section selectors ──
  // Sorted by the manual drag order (2026-08-01). Array.prototype.sort is stable, so until
  // somebody actually drags a row every sortOrder is still 0 and this is exactly the load
  // order (task_date, task_time) it has always been.
  const wheneverAll = useMemo(
    () =>
      tasks
        .filter((tk) => tk.recurring === 'none' && !tk.sharedOut && matchFilters(tk))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [tasks, matchFilters]
  );
  const recurringAll = useMemo(
    () => tasks.filter((tk) => tk.recurring !== 'none' && !tk.sharedOut && matchFilters(tk)),
    [tasks, matchFilters]
  );
  const sharedOutAll = useMemo(() => tasks.filter((tk) => tk.sharedOut && matchFilters(tk)), [tasks, matchFilters]);
  // Same manual order as the All tab's Whenever section — this is the same backlog seen
  // through a narrower filter, so it must not come out in a different order. The drag itself
  // lives on the All tab only; here the section is a collapsed drawer under the day's list.
  const undatedWhenever = useMemo(
    () =>
      tasks
        .filter((tk) => tk.recurring === 'none' && !tk.hasStartDate && !tk.sharedOut && matchFilters(tk))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [tasks, matchFilters]
  );

  // Energy's "I'll decide" (2026-08-02, lib/useEnergyPause.ts). Null in Rewards mode, so the
  // `pinnedTaskId === tk.id` tests below are already mode-safe and nothing here needs a second
  // gate. Only the Today tab responds to it — this week and the backlog are not "today".
  const energyPause = useEnergyPause();

  // The day's list, clock-ordered as always, with the pinned card lifted to the head.
  //
  // Applied INSIDE this memo on purpose: Today has four render branches (by-person, timeline,
  // "One thing at a time", and the plain section list) and they all read this one list, so
  // ordering it here is the only way they can't disagree about which card came first. It is
  // also the only list on this screen that reorders — This week, All tasks and Whenever are
  // deliberately untouched.
  const todayList = useMemo(() => {
    const list = tasksForDate(today)
      .filter((tk) => (tk.hasStartDate || tk.recurring !== 'none') && matchFilters(tk))
      .sort(byTime);
    const id = energyPause.pinnedTaskId;
    if (!id) return list;
    const at = list.findIndex((tk) => tk.id === id);
    if (at <= 0) return list;
    return [list[at], ...list.slice(0, at), ...list.slice(at + 1)];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tasks` drives recompute (tasksForDate reads the store, not this var), not read directly
  }, [tasksForDate, today, tasks, matchFilters, energyPause.pinnedTaskId]);

  // The pin only applies while the pinned card is actually on today's list. Nothing clears a
  // pin when its task is finished, rescheduled or filtered out by the person/tag rows, and a
  // pin with no visible badge would dim the whole day with no way back — so it simply stops
  // applying instead, and comes back with its row. Presentation only, like every layout here.
  const pinnedTaskId = useMemo(
    () =>
      energyPause.pinnedTaskId && todayList.some((tk) => tk.id === energyPause.pinnedTaskId)
        ? energyPause.pinnedTaskId
        : null,
    [energyPause.pinnedTaskId, todayList]
  );
  /**
   * The two presentation props every Today-tab `<TaskCard>` gets. `dimmed` is opacity only —
   * a dimmed row keeps its height, its check, its steps, its reminders and its counts, and is
   * still one tap from its editor (see TaskCard's own prop docs).
   */
  const pinProps = useCallback(
    (tk: Task) => ({ pinned: tk.id === pinnedTaskId, dimmed: !!pinnedTaskId && tk.id !== pinnedTaskId }),
    [pinnedTaskId]
  );
  const weekGroups = useMemo(
    () => tasksForWeek(weekStart).map((g) => ({ ...g, tasks: g.tasks.filter(matchFilters) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tasks` drives recompute (tasksForWeek reads the store, not this var), not read directly
    [tasksForWeek, weekStart, tasks, matchFilters]
  );

  // Unfinished counts per tab, for the "One thing at a time" tab-bar accessories. Only
  // computed when that layout is on — every other layout's tab bar shows no counts, so
  // there's nothing to keep up to date.
  const tabCounts = useMemo(() => {
    if (layoutSpec.id !== 'focusFirst') return { today: 0, week: 0, all: 0 };
    // "How many are left" — a note is never left to do, so it never counts here.
    const open = (list: Task[]) => list.filter((tk) => !tk.done && isCompletable(tk.cardType)).length;
    return {
      today: open(todayList),
      week: weekGroups.reduce((n, g) => n + open(g.tasks), 0),
      all: open(undatedWhenever),
    };
  }, [layoutSpec.id, todayList, weekGroups, undatedWhenever]);

  // ── Drag to reorder the backlog ──
  // The Whenever section on the All tab is where the manual order of the backlog is authored:
  // it is the one list of tasks with no time to put them in order, and it is the widest view
  // of them (Today and This week show the same rows through a narrower filter, in the same
  // order, as a collapsed drawer). Everything else on this screen is ordered by the clock —
  // dragging a 09:00 task under a 14:00 one would either lie or silently retime it — so those
  // lists deliberately do not drag. See lib/useDragReorder.ts for the shared mechanic.
  const wheneverDrag = useDragReorder(
    useMemo(() => wheneverAll.map((tk) => tk.id), [wheneverAll]),
    reorderTasks
  );
  const wheneverDragged = useMemo(
    () =>
      wheneverDrag.order
        .map((id) => wheneverAll.find((tk) => tk.id === id))
        .filter((tk): tk is Task => !!tk),
    [wheneverDrag.order, wheneverAll]
  );
  // Which cards have their editor open: a drag has to stand down for those, or a long-press
  // inside a text field grabs the row instead of placing the caret (DraggableTaskRow.isOpen).
  const [openEditorIds, setOpenEditorIds] = useState<Set<string>>(new Set());
  const setEditorOpen = useCallback((id: string, open: boolean) => {
    setOpenEditorIds((prev) => {
      if (prev.has(id) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // "By person" layout — only meaningful once there's more than one person to group under,
  // so it degrades to the normal single-section list rather than drawing one card labelled
  // with your own name.
  const groupByPerson = !!layoutSpec.groupByPerson && showPeople;
  const todayByPerson = useMemo(() => {
    if (!groupByPerson) return [];
    const groups = people.map((person, index) => ({
      personId: person.id,
      label: person.isSelf ? person.name || t.habitForMe : person.name,
      hue: personColor(person.color, index),
      // What a row added inside this group is assigned to. '' for the self person, matching
      // the pre-registry convention that an empty name mirror meant "me".
      addName: person.isSelf ? '' : person.name,
      tasks: todayList.filter(
        (tk) => (effectiveAssigneeId(tk, tk.date || today) || selfPersonId) === person.id
      ),
    }));
    // Anything whose person is gone (removed mid-week, or a peer id we don't have a row
    // for) would otherwise be invisible in this layout — it gets its own trailing section.
    const claimed = new Set(groups.flatMap((g) => g.tasks.map((tk) => tk.id)));
    const orphans = todayList.filter((tk) => !claimed.has(tk.id));
    return orphans.length
      ? [...groups, { personId: '', label: t.rotation.unassigned, hue: theme.textMuted, addName: '', tasks: orphans }]
      : groups;
  }, [groupByPerson, people, todayList, selfPersonId, today, t, theme.textMuted]);


  // ── "What was this view hiding" glow (2026-07-27) ────────────────────────────
  // The ids the CURRENT layout actually draws, section by section, mirroring what
  // DoneSplitList renders: unfinished tasks only (finished ones live in a collapsed zone
  // in every layout, so they can never be a difference between two views), truncated to
  // FOCUS_VISIBLE when "Now and next" is on. Switching layout re-diffs this against the
  // saved view, and whatever the previous layout was collapsing glows.
  const visibleTaskIds = useMemo(() => {
    // Mirrors SectionCard's own split exactly, notes included — a snapshot that disagrees
    // with what was drawn either glows a row that was visible all along or can never glow
    // one that wasn't (see lib/viewSnapshot.ts).
    const drawn = (list: Task[]) => {
      const unfinished = list.filter((tk) => !tk.done);
      if (!layoutSpec.focusMode) return unfinished;
      return unfinished.filter((tk) => isCompletable(tk.cardType)).slice(0, FOCUS_VISIBLE);
    };
    if (tab === 'today') {
      // "One thing at a time" draws its hero + a short Then list and nothing else — no
      // Whenever section at all. Pass exactly that, or a row it collapses could never glow
      // when the user switches back to a layout that shows it.
      if (layoutSpec.id === 'focusFirst') {
        return todayList
          .filter((tk) => !tk.done && isCompletable(tk.cardType))
          .slice(0, 1 + FOCUS_THEN_VISIBLE)
          .map((tk) => tk.id);
      }
      // Whenever is a collapsed drawer on this tab as of 2026-08-01, in every layout that
      // draws it at all — so, exactly like the finished rows inside a "Done (n)" zone, it can
      // never be a difference between two views and its ids stay out of the snapshot. Leaving
      // them in would make a switch out of "One thing at a time" glow rows that are folded
      // away behind a chevron and can't be seen glowing.
      return drawn(todayList).map((tk) => tk.id);
    }
    if (tab === 'week') {
      return weekGroups.flatMap((g) => drawn(g.tasks)).map((tk) => tk.id);
    }
    // The All tab renders flat and takes no layout, so it has nothing to reveal or hide.
    return [];
  }, [tab, layoutSpec.focusMode, layoutSpec.id, todayList, weekGroups]);

  // Snapshot key is per TAB, not just per screen: Today and This week draw different sets,
  // and sharing one saved view between them would make every tab switch glow half the list.
  // Each tab diffs against its own last state instead.
  const {
    ids: newSinceIds,
    fields: newFields,
  } = useNewSinceSeen(
    `plans:${tab}`,
    visibleTaskIds,
    useMemo(
      () => ({ meta: layoutSpec.showMeta, price: layoutSpec.showPrice, extras: layoutSpec.showExtras }),
      [layoutSpec]
    ),
    layoutSpec.id,
    tasksLoaded
  );

  // Quick-add: create an undated "Whenever" task from the inline AddRow — optionally with a
  // time and/or a recurrence set via the Time/Repeat options panel (2026-08-04, mirrors
  // PlanTaskCard's own quick-add exactly, including staying `hasStartDate: false` even when a
  // time is set: see app/(tabs)/index.tsx's `buildQuickAddTaskInput` note — a time doesn't
  // move a task out of Whenever, only the editor's own date field does that). The editor (tap
  // the task) can then promote it further (date / steps).
  const commitWhenever = useCallback(() => {
    const title = wheneverInput.trim();
    if (!title) return;
    addTask({
      title,
      date: today,
      time: wheneverTime || undefined,
      taskType: 'start-at',
      done: false,
      recurring: wheneverRecurring,
      recurringDays: wheneverRecurring === 'weekly' ? wheneverRecurringDays : [],
      weekInterval: 1,
      monthlyMode: 'day',
      monthDay: new Date().getDate(),
      monthOrdinal: 'first',
      monthWeekday: 0,
      sortOrder: 0,
      hasStartDate: false,
      assignee: '',
    });
    setWheneverInput('');
    setWheneverTime('');
    setWheneverRecurring('none');
    setWheneverRecurringDays([]);
  }, [wheneverInput, wheneverTime, wheneverRecurring, wheneverRecurringDays, addTask, today]);

  // Section headers are the reusable <SectionRail> (hue dot + label + count) — the color-rail
  // redesign (2026-07-13). Each section's rows carry a matching `railColor` left edge; the
  // shared domain hue binds a header to its list. Whenever = task blue, Repeating = meal orange,
  // Shared = shop green (inside SharedTasksSection); Today/Week day groups use the neutral accent.

  // Empty-state example (2026-07-27): "Tidy up"/"Rydde" — a daily, time-boxed task with
  // steps, chosen over a flat one-liner because it actually demonstrates recurrence +
  // time-boxing + steps, the three things starters.plans.text talks about. Real store
  // write (not a preview) — tasks.length flips to 1 right after. This card also has an
  // `onAddExample` copy mounted inside PlanTaskCard's own empty day (see the render block
  // below); that one is left alone since adding there swaps the placeholder for the real
  // task list rather than leaving a dead card on screen.
  function addPlanStarterTask() {
    const newTask = addTask({
      title: t.starters.plans.exampleTitle,
      date: todayStr(),
      time: PLAN_STARTER_TIME,
      finishTime: PLAN_STARTER_FINISH_TIME,
      taskType: 'time-box',
      done: false,
      recurring: 'daily',
      recurringDays: [],
      sortOrder: 0,
      hasStartDate: true,
    });
    PLAN_STARTER_STEPS.forEach((key) => addTaskStep(newTask.id, t.starters.plans.exampleSteps[key]));
    setPlanStarterAdded(true);
    success();
  }

  const stickyBelowHeader = (
    // No outer glass card (removed 2026-07-24): TabSlider already draws its own bordered/
    // filled track, so wrapping it in a second Surface card stacked a third layer (outer
    // card + TabSlider's own box + the sliding pill) that read as nested boxes. TabSlider
    // now floats directly, styled with the same side margins as ScreenHeader's own card.
    <TabSlider
      attachedTop
      value={tab}
      onChange={setTab}
      options={(['today', 'week', 'all'] as Tab[]).map((tabOption) => ({
        value: tabOption,
        label: tabOption === 'all' ? t.tasksTabAll : tabOption === 'today' ? t.tasksTabToday : t.tasksTabWeek,
        // "One thing at a time" wants a count of everything it isn't drawing. That belongs
        // on the ONE control that already switches between these lists, not on a second row
        // of chips below the hero duplicating it — TabSlider's `accessory` slot exists for
        // exactly this. Only this layout asks for the counts, so only this layout gets them;
        // every other layout's tab bar is untouched.
        // The active-state colour has to be baked in here — TabSlider's `accessory` is a
        // plain node that doesn't know whether its segment is selected (see that file's
        // edit note). Without this the count sits in muted grey ON the accent pill, which
        // is the one place muted grey has no contrast.
        accessory:
          layoutSpec.id === 'focusFirst' ? (
            <Text
              style={[
                styles.tabCount,
                TabularNums,
                { color: tab === tabOption ? theme.accentInk : theme.textMuted },
              ]}
            >
              {tabCounts[tabOption]}
            </Text>
          ) : undefined,
      }))}
      style={styles.stickyBar}
    />
  );

  return (
    <ScreenScaffold
      title={t.tasksTitle}
      tier="site"
      screenKey="plans"
      bottomNav={false}
      pagerFloatingNav
      ownBackground={false}
      stickyGapColor="transparent"
      stickyBelowHeader={stickyBelowHeader}
      stickyBelowHeaderHeight={STICKY_HEIGHT}
      onSharePress={featureSharing ? () => router.push('/share-modal?kind=t') : undefined}
      onLayoutPress={() => setLayoutPickerOpen(true)}
    >
      <View style={styles.content}>
        {/* Plain hint, no embedded setting. This used to carry a "start with work mode"
            Switch (the first-run teaching slot for the old onboarding wizard's work-mode
            step) — removed 2026-07-25 along with the Work mode card in Settings, because
            `workModeEnabled` was never read by anything: the switch promised to hide
            personal plans and did nothing at all. */}
        <HintCard text={t.hints.plans.text} open={hintOpen} noPill onDismiss={dismissHint} />

        {/* First-run explainer (2026-07-26): what a to-do is for here, plus an example.
            Shown only while there is not a single task on any tab, so it costs nothing once
            the list is in use — and comes back if every task is later deleted.
            **Suppressed on Today's timeline layout (2026-07-30 fix)**: since the "on a
            timeline" default (see `layoutSpec.timeline` below) mounts PlanTaskCard directly
            on this tab, an empty day already draws its OWN "Break it into smaller pieces"
            explainer + example row inline where the list would be — this screen-level card
            used to stack a second, near-identical explainer above it (user report, preview
            screenshot: the same bulb text and example twice in a row).
            **Stays mounted through `planStarterAdded` (2026-07-31)**: pressing the example's
            "+" writes a real task, which flips `tasks.length` off zero in the same tick — without
            the OR below the card would unmount itself the instant it was used, reading as the
            example just disappearing. See components/StarterExampleRow's `added` Edit note.
            **`collapsible` (2026-08-06 v3)**: the example row now sits behind StarterCard's
            shared collapse-to-row drop-down (open by default) instead of always being drawn —
            same mechanism Habits/Goals/Health now use. This screen's own mount condition above
            is unchanged; `collapsible` only changes the card's shape while it's mounted.
            **Today only (2026-08-13)**, maintainer: "Example container can be removed from
            'This week' and 'All' in to-do." It used to sit OUTSIDE all three `tab === …` blocks
            and so drew on every tab; its only tab reference was the negative one below. Today
            is where a new user starts and where the teaching belongs — and note the two halves
            of "Today" split cleanly: under the DEFAULT timeline layout this card stays
            suppressed and components/PlanTaskCard draws the example inline instead, so the gate
            below only puts it on screen for Today under a non-timeline layout. */}
        {tab === 'today' && (tasks.length === 0 || planStarterAdded) && !layoutSpec.timeline && (
          <StarterCard
            text={t.starters.plans.text}
            collapsible
            exampleHeaderLabel={t.starters.plans.tapToAdd}
            example={
              <StarterExampleRow
                icon="ellipse-outline"
                title={t.starters.plans.exampleTitle}
                meta="17:00–17:20"
                accent={wheneverHue}
                onAdd={planStarterAdded ? undefined : addPlanStarterTask}
                addLabel={t.starters.addExample}
                added={planStarterAdded}
              />
            }
          />
        )}

        {/* The two filter rows + the shared-load card, as ONE slot in the screen's stack
            (2026-08-08). Each `Collapsible` stays mounted at zero height when closed, so as
            direct children of a `gap`-ed container they each booked a full SCREEN_GAP for
            nothing — on the common case (no People mode, no tags) that was 32px of blank
            backdrop between the day card and the Whenever drawer. Wrapping them means at most
            one slot, and only while at least one filter actually exists. */}
        {(showPeople || allTags.length > 0) && (
        <View>
        {/* Person filter (People/family mode) — Everyone + one chip per person, each in
            that person's own colour so the row doubles as a legend for the list below. */}
        <Collapsible open={showPeople}>
          <View style={styles.personFilterRow}>
            <PersonChip
              label={t.peopleMode.filterAll}
              selected={personFilter === null}
              onPress={() => setPersonFilter(null)}
            />
            {people.map((person, index) => (
              <PersonChip
                key={person.id}
                label={person.isSelf ? person.name || t.habitForMe : person.name}
                name={person.name}
                color={personColor(person.color, index)}
                selected={personFilter === person.id}
                onPress={() => setPersonFilter(person.id)}
              />
            ))}
          </View>
        </Collapsible>

        {/* Tag filter — only worth a row once tags exist, so it stays out of the way on a
            list that doesn't use them. Multi-select ("any of"), unlike the person row. */}
        <Collapsible open={allTags.length > 0}>
          <View style={styles.personFilterRow}>
            <TagChip
              label={t.tags.filterAll}
              selected={tagFilter.length === 0}
              onPress={() => setTagFilter([])}
            />
            {allTags.map((tag) => (
              <TagChip
                key={tag.id}
                label={tag.name}
                selected={tagFilter.includes(tag.id)}
                onPress={() => setTagFilter((prev) => toggleTagId(prev, tag.id))}
              />
            ))}
          </View>
        </Collapsible>
        </View>
        )}

        {/* Shared load (2026-07-28) — only once there's somebody to compare against, and
            only on the day/week tabs it actually reports on ("All" spans no period). Sits
            BELOW both filter rows since 2026-08-08 (it was between them): it is a card, not
            a control, so it belongs in the card stack where the screen's own gap spaces it —
            inside the filter wrapper it would have sat flush against the tag row, having
            given up its `marginBottom` in the same pass. */}
        {energySystemEnabled && showPeople && tab !== 'all' && <EnergyBalanceCard date={today} />}

        {/* ── ALL TASKS (order: Whenever → Repeating → Shared) ── */}
        {tab === 'all' && (
          <>
            <SectionCard hue={wheneverHue} domain="task" label={t.tasksSectionWhenever} count={wheneverAll.length} collapseKey="plansWhenever">
              {wheneverAll.length > 0 && (
                <View style={styles.cardStack}>
                  {wheneverDragged.map((tk) => (
                    <DraggableTaskRow key={tk.id} isOpen={openEditorIds.has(tk.id)} {...wheneverDrag.rowProps(tk.id)}>
                      <TaskCard
                        task={tk}
                        showDelete
                        showShareOut
                        autoExpand={tk.id === expandTaskId}
                        onToggleDone={handleToggleDone}
                        onExpandedChange={(open) => setEditorOpen(tk.id, open)}
                      />
                    </DraggableTaskRow>
                  ))}
                </View>
              )}
              {/* The one add-a-row affordance: an inline empty row with a "+" that saves a new
                  Whenever task into this section. Keeps its Whenever-hue accent as a functional
                  "add" cue (the section box already carries membership color). Time + Repeat
                  panel (2026-08-04) mirrors PlanTaskCard's own quick-add, closing the parity
                  gap this row used to have (see commitWhenever's header note). */}
              <View style={[styles.addRowCard, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: wheneverHue }]}>
                <AddRow
                  placeholder={t.newTask}
                  value={wheneverInput}
                  onChangeText={setWheneverInput}
                  onSubmit={commitWhenever}
                  accent={wheneverHue}
                  showDivider={false}
                  accessibilityLabel={t.newTask}
                  panel={
                    <QuickAddOptionsPanel>
                      <QuickAddOptionRow
                        icon="time-outline"
                        label={t.timeLabel}
                        value={<TimeBoxInput value={wheneverTime} onChange={setWheneverTime} />}
                        accent={wheneverHue}
                      />
                      <QuickAddOptionRow
                        icon="repeat"
                        label={t.taskRecurringToggle}
                        value={wheneverRecurringLabel(wheneverRecurring)}
                        isSet={wheneverRecurring !== 'none'}
                        accent={wheneverHue}
                        onPress={pickWheneverRecurring}
                        showsMore
                        accessibilityLabel={`${t.taskRecurringToggle}: ${wheneverRecurringLabel(wheneverRecurring)}`}
                      />
                    </QuickAddOptionsPanel>
                  }
                />
              </View>
            </SectionCard>

            {/* Debug notes: one anchor per region — wrap the section card, not its inner rows. */}
            <DebugNoteAnchor id="plans.recurring" label="Plans — Recurring">
              <SectionCard hue={repeatingHue} domain="health" icon="repeat" label={t.tasksSectionRecurring} count={recurringAll.length} collapseKey="plansRecurring">
                {recurringAll.length === 0 ? (
                  <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>{t.tasksSectionRecurringEmpty}</Text>
                ) : (
                  <View style={styles.cardStack}>
                    {recurringAll.map((tk) => (
                      <TaskCard
                        key={tk.id}
                        task={tk}
                        showDelete
                        showShareOut
                        autoExpand={tk.id === expandTaskId}
                        onToggleDone={handleToggleDone}
                      />
                    ))}
                  </View>
                )}
              </SectionCard>
            </DebugNoteAnchor>

            {featureSharing && <SharedTasksSection sentTasks={sharedOutAll} onToggleDone={handleToggleDone} />}
          </>
        )}

        {/* ── TODAY ── */}
        {tab === 'today' && (
          <>
            {/* Debug notes: anchor the day-view section (not its inner task rows). */}
            <TourTarget id="tour.plans.list">
              <DebugNoteAnchor id="plans.dayView" label="Plans — Today">
                {groupByPerson ? (
                  // "By person" layout — one section per person, in that person's own hue.
                  // A SectionCard hue is the one place lib/personColor.ts permits the identity
                  // colour beyond an avatar dot, precisely for this grouping. A person with
                  // nothing today still gets their card, so an empty column is visible as
                  // "nothing assigned" rather than the person silently disappearing.
                  todayByPerson.map((group) => (
                    <SectionCard
                      key={group.personId || 'unassigned'}
                      hue={group.hue}
                      label={group.label}
                      count={group.tasks.length}
                    >
                      <DoneSplitList
                        tasks={group.tasks}
                        emptyText={t.noPlansToday}
                        focusMode={layoutSpec.focusMode}
                        footer={
                          <InlineTaskAdd
                            date={today}
                            accent={group.hue}
                            assigneeId={group.personId}
                            assignee={group.addName}
                            wrapped
                          />
                        }
                        renderCard={(tk) => (
                          <TaskCard key={tk.id} task={tk} variant="steps" tinted={tk.sharedOut} spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} newFields={newFields} onToggleDone={handleToggleDone} {...pinProps(tk)} />
                        )}
                      />
                    </SectionCard>
                  ))
                ) : layoutSpec.timeline ? (
                  /* "On a timeline" — the day as a clock-time calendar grid (2026-07-30). This is
                     the To-do tab's DEFAULT (seeded in lib/db.ts's migrations), because a full
                     screen is the only place a 24h grid is actually readable; Home's card defaults
                     to the ruled list instead. The grid lives in components/PlanTaskCard.tsx, the
                     same component Home mounts — there is deliberately no second implementation.
                     Not read-only here: rows open their editor, and the card owns its own add. */
                  <PlanTaskCard
                    tasks={todayList}
                    allTasks={tasks}
                    spec={layoutSpec}
                    padState={todayCardState}
                    onPadStateChange={setTodayCardState}
                    horizontal={planTimelineHorizontal}
                    /* The All tab's expanded TaskCard IS the editor — see handlePressLogEntry
                       above for why this is setParams to /plans rather than a push to the
                       retired /task-form route. */
                    onPressTask={(task: Task) => router.setParams({ tab: 'all', expandTaskId: task.id })}
                    onToggleTask={handleToggleDone}
                    onAddTask={handleTimelineAddTask}
                    onAddTaskAndEdit={handleTimelineAddTaskAndEdit}
                    // Same one-tap "Tidy up" example the screen-level StarterCard offered before
                    // it was suppressed for this layout (see that card's gate above) — without
                    // this, an empty day on the timeline default would lose the quick-add
                    // affordance entirely, not just the redundant second copy of the explainer.
                    onAddExample={addPlanStarterTask}
                    // The day log (2026-08-02) — what already happened, above the now-line.
                    // Passing it is what makes the now-line this card's boundary; the hook
                    // returns undefined when settings.featureDayLog is off, and PlanTaskCard
                    // treats an absent log as "draw the day the way it always was".
                    dayLog={dayLog}
                    onPressEntry={handlePressLogEntry}
                    onRemoveMoment={removeMoment}
                    onCaptureMoment={addMoment}
                    // Device-calendar events (2026-08-02) — the fixed things that aren't in
                    // this app. Read-only, and only on the To-do tab's full-screen timeline:
                    // Home's card is a preview of YOUR day, and a meeting is structure
                    // rather than something you did.
                    calendarEvents={calendarEvents}
                  />
                ) : layoutSpec.id === 'focusFirst' ? (
                  /* "One thing at a time" — a different SHAPE for the same tasks, so it replaces
                     the Today SectionCard rather than sitting inside it. Every task the layout
                     doesn't draw is still a live row: it keeps its reminders, still counts in
                     the Later chips, and is one tap away. */
                  <FocusFirstToday
                    tasks={todayList}
                    onToggleDone={handleToggleDone}
                    spec={layoutSpec}
                    newSinceIds={newSinceIds}
                    newFields={newFields}
                    pinProps={pinProps}
                    footer={<InlineTaskAdd date={today} accent={theme.accent} assigneeId={personFilter ?? ''} assignee={addAssigneeName} wrapped />}
                  />
                ) : (
                  <SectionCard hue={theme.accent} label={t.tasksTabToday} count={todayList.length} collapseKey="plansToday">
                    {/* Add row sits between the tasks and the collapsed "Done" zone (DoneSplitList
                        footer) so the active/white containers stay grouped and green "Done" is last. */}
                    <DoneSplitList
                      tasks={todayList}
                      emptyText={t.noPlansToday}
                      focusMode={layoutSpec.focusMode}
                      footer={<InlineTaskAdd date={today} accent={theme.accent} assigneeId={personFilter ?? ''} assignee={addAssigneeName} wrapped />}
                      renderCard={(tk) => (
                        <TaskCard key={tk.id} task={tk} variant="steps" tinted={tk.sharedOut} spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} newFields={newFields} onToggleDone={handleToggleDone} {...pinProps(tk)} />
                      )}
                    />
                  </SectionCard>
                )}
              </DebugNoteAnchor>
            </TourTarget>

            {/* Whenever, BELOW the day and collapsed (2026-08-01, DESIGN_RULES.md rule 7 —
                previously the first thing on the tab). The undated backlog is the least
                time-sensitive thing on a screen whose first tab is "Today", so it no longer
                takes the top slot; the drawer keeps its count in reach and is one tap from
                the rows themselves. Nothing is filtered out — this is presentation only, and
                every task in here keeps its reminders and still counts in the header.
                "One thing at a time" stays the exception and drops the section entirely: a
                second list under the hero is the opposite of one thing at a time, and its
                count is already on that layout's tab-bar accessory, which taps through to it. */}
            {layoutSpec.id !== 'focusFirst' && (
              <CollapsedSection hue={wheneverHue} domain="task" label={t.tasksSectionWhenever} count={undatedWhenever.length}>
                <DoneSplitList
                  tasks={undatedWhenever}
                  emptyText={t.tasksSectionWheneverEmpty}
                  focusMode={layoutSpec.focusMode}
                  renderCard={(tk) => (
                    <TaskCard key={tk.id} task={tk} variant="steps" spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} newFields={newFields} onToggleDone={handleToggleDone} />
                  )}
                />
              </CollapsedSection>
            )}
          </>
        )}

        {/* ── THIS WEEK ── */}
        {tab === 'week' && (
          <>
            {weekGroups.map((group, i) => (
              <SectionCard key={group.date} hue={theme.accent} label={t.dayFull[i]} count={group.tasks.length}>
                {/* Add row between tasks and the collapsed "Done" zone — same grouping as Today. */}
                <DoneSplitList
                  tasks={[...group.tasks].sort(byTime)}
                  emptyText={t.tasksDayEmpty}
                  focusMode={layoutSpec.focusMode}
                  footer={<InlineTaskAdd date={group.date} accent={theme.accent} assigneeId={personFilter ?? ''} assignee={addAssigneeName} wrapped />}
                  renderCard={(tk) => (
                    <TaskCard key={tk.id + group.date} task={tk} variant="steps" tinted={tk.sharedOut} spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} newFields={newFields} onToggleDone={handleToggleDone} />
                  )}
                />
              </SectionCard>
            ))}

            {/* Whenever, BELOW the week and collapsed — same rule-7 reordering as the Today
                tab above (2026-08-01); the weekday groups are what this tab is for. */}
            <CollapsedSection hue={wheneverHue} domain="task" label={t.tasksSectionWhenever} count={undatedWhenever.length}>
              <DoneSplitList
                tasks={undatedWhenever}
                emptyText={t.tasksSectionWheneverEmpty}
                focusMode={layoutSpec.focusMode}
                renderCard={(tk) => (
                  <TaskCard key={tk.id} task={tk} variant="steps" spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} newFields={newFields} onToggleDone={handleToggleDone} />
                )}
              />
            </CollapsedSection>
          </>
        )}

        {/* Where else this screen goes — one DRAWER each, the same shape as Whenever above
            (2026-08-10, maintainer: "Goals and Previous days should be like the 'Whenever' card
            with expandability, and pressing the name gives you a pop-up. This is to stay
            consistent across app"). Expanding shows what's behind the door; pressing the name
            opened a pop-up under that instruction. See components/CollapsedSection.tsx for why
            a section header carries two tap targets here.

            **Goals reversed the "pressing the name opens a pop-up" half on 2026-08-12**
            (maintainer: "This should not be a pop-up. Examples included in card just like
            other cards, and making, editing and deleting in the card, not a pop up.") — its
            CollapsedSection now passes no `onTitlePress`, so it has only the one tap target,
            same as Whenever. Earlier days is UNCHANGED and still carries `onTitlePress` — a
            day picker is genuinely a pop-up-shaped job (pick one → navigate), not an editor
            you'd want to do in place.

            History worth keeping, because this is the second reshaping of the same two links:
            they were two separate full-width `SubScreenLinkButton` cards with gradient badges
            and no chevrons, which read as three same-sized white cards of which the first was a
            section of this screen and the other two were doors out of it. 2026-08-08 grouped
            them into one card of small chevron ROWS to make them visibly not-sections. That
            fixed the confusion and introduced the opposite problem — a link that can only be
            followed, never glanced at. A drawer is both, so `SubScreenLinkButton` is deleted.

            Goals (2026-07-29, moved to the bottom; popup dropped 2026-08-12) — Goals dropped
            its own Home card (too many lists on Home); this is one of its two entry points,
            alongside Habits. It no longer opens a popup — expanding the drawer IS the editor
            (components/GoalsEditor.tsx), so adding/editing/deleting a goal never leaves this
            tab, and there's no separate sheet to push to /goals for either. Earlier days
            (2026-08-02) — the day log itself lives in the card above; this is only the way
            back through previous days, and its pop-up is components/DayPickerSheet.tsx (that
            one is unchanged — a picker genuinely is a pop-up-shaped job, unlike Goals' CRUD).
            Each is gated on its own feature flag, so turning one off removes its drawer
            entirely. Neither carries a `count`: a tally of goals reads as a score, and a
            tally of past days is meaningless. */}
        {featureGoals && (
          <CollapsedSection
            hue={wheneverHue}
            domain="task"
            icon="flag"
            label={t.goals.editLinkPractical}
          >
            <GoalsEditor accent={wheneverHue} />
          </CollapsedSection>
        )}
        {featureDayLog && (
          <CollapsedSection
            hue={wheneverHue}
            domain="task"
            icon="time-outline"
            label={t.dayLog.earlierDays}
            onTitlePress={() => { tap(); setDayPickerOpen(true); }}
          >
            <RecentDaysList accent={wheneverHue} />
          </CollapsedSection>
        )}
      </View>
      <LayoutPickerSheet
        visible={layoutPickerOpen}
        surface="plans"
        onClose={() => setLayoutPickerOpen(false)}
      />
      <DayPickerSheet visible={dayPickerOpen} onClose={() => setDayPickerOpen(false)} accent={wheneverHue} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  // The screen owns the vertical rhythm (2026-08-08). `gap` here, and NO vertical margin on
  // any card in the stack — see SCREEN_GAP's doc in constants/theme.ts for the five different
  // gaps this replaced. A child that is always mounted but sometimes zero-height (a closed
  // Collapsible) must be grouped or conditionally rendered, or it books a gap slot for nothing.
  content: { padding: Spacing.md, gap: SCREEN_GAP },
  // ── "One thing at a time" (focusFirst) ──────────────────────────────────────
  // No SectionCard around any of it, deliberately: the whole point of this layout is that the
  // day stops looking like a stack of boxes. The hero, the Later chips and the Then list sit
  // directly on the screen backdrop and are separated by space, not by borders.
  focusWrap: { gap: Spacing.lg },
  focusHero: { gap: Spacing.xs },
  focusThen: { gap: Spacing.xs },
  // Count badge in a tab-bar segment ("One thing at a time" only). Deliberately smaller and
  // muted rather than a filled pill: the segment already has the sliding accent pill behind
  // it, and a second filled shape inside that would read as two competing highlights.
  tabCount: { fontSize: FontSize.xs, fontFamily: Type.label.fontFamily },
  focusLabel: {
    fontSize: FontSize.xs,
    fontFamily: Type.label.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  focusOverflow: { fontSize: FontSize.xs, paddingHorizontal: Spacing.xs },
  focusDone: { fontSize: FontSize.sm, fontFamily: Type.label.fontFamily, textAlign: 'center' },
  focusAllClear: {
    fontSize: FontSize.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    textAlign: 'center',
  },
  // Styles TabSlider directly (no wrapping card, see the 2026-07-24 stickyBelowHeader edit
  // note) — side margin matches ScreenHeader's own floated card (headerFloatH, Spacing.sm as
  // of the header/bottom-nav width-alignment pass); flex:1 + justifyContent:'center' fill and
  // vertically center it within the reserved sticky height.
  stickyBar: { flex: 1, marginHorizontal: Spacing.sm, justifyContent: 'center' },
  // Visual-audit 2026-07-11: was bare muted text floating on the particle background
  // (low contrast in practice even though the token itself passes AA) — a card behind
  // it, matching HomeNotesCard's empty-state treatment, gives it real footing. Every
  // section (Today included, as of 2026-07-16) sits directly on the backdrop, so this
  // card is what gives an empty section its footing.
  sectionEmpty: {
    fontSize: FontSize.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardStack: { gap: Spacing.sm },
  // Frames the "Done" pill + its collapsed rows as one card (2026-07-16) — previously bare
  // spacing, so the header floated over the rows with nothing tying them together visually.
  // `theme.surface` reads as a raised card on the bare particle background (every section now
  // sits directly on it). No `gap` here — SectionRail already carries its own marginBottom, so
  // a gap would leave a phantom blank strip under the header while collapsed (Collapsible's
  // outer clip wrapper stays mounted at 0 height). Collapsible's own reveal already resizes
  // this View smoothly — no extra layout-animation needed here.
  doneZone: { marginTop: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm },
  personFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  personChip: { borderRadius: Radius.full, borderWidth: 1, paddingVertical: 6, paddingHorizontal: Spacing.md, minHeight: 34, justifyContent: 'center' },
  personChipText: { fontFamily: Type.label.fontFamily, fontSize: Type.label.size },
  // The Whenever "New task" card — a plain bordered card (not a translucent Surface) so its
  // full edge stays visible, with the Whenever-blue rail matching the section's task cards.
  addRowCard: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
});
