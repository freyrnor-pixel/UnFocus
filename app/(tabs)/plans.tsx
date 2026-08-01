/**
 * plans.tsx — the "Tasks" / "Oppgaver" screen: a tabbed, inline-editable list.
 *
 * A sticky tab bar (Today · This week · All tasks) over sectioned lists. Editing is
 * always available (no lock): tapping a task in the All-tasks tab opens its inline
 * editor with a Discard / Save bar (see TaskCard). New tasks are made through the shared
 * inline AddRow at the bottom of the Whenever section — the one add-a-row affordance on
 * this screen — which creates an undated, non-recurring task on submit; the editor can
 * then promote it (date / repeat / steps). Today / This week expand a task to its steps
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
 *             components/PressableScale, components/Surface (the local CollapsedSection's card
 *             shell), components/Collapsible + components/AnimatedChevron
 *             (animated "Finished (n)" done-zone reveal, and the collapsed Whenever drawer),
 *             components/TabSlider,
 *             components/StarterCard (first-run explainer, shown while there are no tasks at all),
 *             components/StarterExampleRow (its "Tidy up"/"Rydde" example row — a real daily,
 *             time-boxed, 5-step task its "+" button writes via useTaskStore), lib/taskStarters
 *             (that example's structural data — time box + step order), constants/theme,
 *             expo-router (useLocalSearchParams — `tab`/`expandTaskId`, see below; useRouter —
 *             the header share icon's push to /share-modal), lib/date,
 *             lib/domainColor, lib/haptics,
 *             lib/i18n, lib/useAppTheme, lib/useFirstVisitHint, lib/prefill (usePrefill — a note
 *             sent here seeds the Whenever add row), store/useTaskStore,
 *             store/useSettingsStore, store/usePeopleStore + components/PersonChip (the person
 *             filter row), store/useTagStore + components/TagChip + lib/tags (the tag filter
 *             row — multi-select, "any of"), components/EnergyBalanceCard (the shared-load
 *             comparison, People mode only, day/week tabs only), components/SubScreenLinkButton
 *             (2026-07-29, the "Edit Goals" link at the bottom of the screen — Goals dropped
 *             its own Home card; see app/goals.tsx's header), components/GoalsSheet (2026-07-31,
 *             the popup that link opens)
 *   Used by → Expo Router route "/plans" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx;
 *             also reached with `?tab=all&expandTaskId=…` from app/notes.tsx's "Add to plans"
 *             (UX audit B1, 2026-07-23 — creates the task, then lands here with its editor open)
 *   Data    → reads/writes useTaskStore (tasks/steps); SharedTasksSection reads useSharedStore
 *             (gated on settings.featureSharing — opt-in, off for fresh installs)
 *             internally for incoming shares + accepts the sharedOut tasks as its "sent" half
 *
 * Edit notes:
 *   - **Whenever moved below the day + collapsed (2026-08-01, DESIGN_RULES.md rule 7 —
 *     "order by what's needed first")**: on **Today** and **This week** the undated backlog used
 *     to render FIRST, above the tab's own content — the least time-sensitive section holding the
 *     highest-priority slot on a tab literally called Today. It now renders LAST (before the
 *     Goals link) as a `<CollapsedSection>` drawer, default closed, header + count still visible.
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
 *     three equal-width segments (Reanimated, same motion as the Day/Week/Month
 *     `SlideSelector`), replacing the old per-tab `TabBoxHighlight` boxes. Same shared
 *     component as app/(tabs)/shopping.tsx and app/settings.tsx's tab bars.
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
 *   - **`expandTaskId` (UX audit B1, 2026-07-23)**: app/notes.tsx's "Add to plans" creates
 *     the task the same way the Whenever AddRow does, then navigates here with the new
 *     task's id — the Whenever section's TaskCard passes `autoExpand={tk.id === expandTaskId}`
 *     so that ONE card's editor opens automatically. Distinct from `isNew`: the task is
 *     already a real store row by the time it arrives, just handed a "start open" cue.
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
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useCardState } from '@/lib/useCardState';
import { useNewSinceSeen } from '@/lib/useNewSinceSeen';
import AddRow from '@/components/AddRow';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import TabSlider from '@/components/TabSlider';
import StarterCard from '@/components/StarterCard';
import StarterExampleRow from '@/components/StarterExampleRow';
import SubScreenLinkButton from '@/components/SubScreenLinkButton';
import GoalsSheet from '@/components/GoalsSheet';
import { todayStr, getWeekDates } from '@/lib/date';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { usePrefill } from '@/lib/prefill';
import { tap, success } from '@/lib/haptics';
import { PLAN_STARTER_STEPS, PLAN_STARTER_TIME, PLAN_STARTER_FINISH_TIME } from '@/lib/taskStarters';
import { Recurring, Task, useTaskStore } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { usePeopleStore } from '@/store/usePeopleStore';
import PersonChip from '@/components/PersonChip';
import TagChip from '@/components/TagChip';
import EnergyBalanceCard from '@/components/EnergyBalanceCard';
import { useTagStore } from '@/store/useTagStore';
import { matchesTagFilter, toggleTagId } from '@/lib/tags';
import { effectiveAssigneeId } from '@/lib/taskRotation';
import { personColor } from '@/lib/personColor';
import { FontSize, Radius, Spacing, TabularNums, Type } from '@/constants/theme';
import { Spring } from '@/constants/motion';
import type { LayoutSpec } from '@/lib/cardLayout';
import { getDomainColor } from '@/lib/domainColor';

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
  // Focus mode splits the unfinished rows; without it `rest` is empty and `focused` is the
  // whole list, so the render below is identical to what it was before this feature.
  const focused = focusMode ? unfinished.slice(0, FOCUS_VISIBLE) : unfinished;
  const rest = focusMode ? unfinished.slice(FOCUS_VISIBLE) : [];

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
 * A section drawn as a DRAWER: its `<SectionRail>` header (hue badge + label + count) stays
 * visible and its body collapses behind a chevron, default closed.
 *
 * Mechanism is deliberately the same one `DoneSplitList`'s "Done (n)" zone uses —
 * `PressableScale` + `SectionRail` + `AnimatedChevron` + `components/Collapsible` — so the two
 * read as the same kind of drawer rather than two different ways of folding a list away. The
 * only difference is the shell: this one keeps `Surface`'s hue-edged card (matching the
 * `<SectionCard>` sections it sits among) instead of the Done zone's inner frame, because it is
 * a top-level section of the screen, not a zone inside one.
 *
 * Used for **Whenever** on the Today / This week tabs (2026-08-01, DESIGN_RULES.md rule 7): the
 * undated backlog is by definition the least time-sensitive thing on a tab called "Today", so it
 * moved below the day's own list — and once it is below, a drawer keeps its count in reach
 * without the section spending a screenful on rows nobody came here for. The All-tasks tab keeps
 * Whenever expanded at the top, where it is a real section of the content.
 */
function CollapsedSection({
  hue,
  domain,
  label,
  count,
  children,
}: {
  hue: string;
  domain?: React.ComponentProps<typeof SectionRail>['domain'];
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);
  return (
    <Surface borderColor={hue} style={styles.collapsedSection}>
      <PressableScale
        onPress={() => { tap(); setOpen((v) => !v); }}
        scaleTo={0.97}
        releaseSpring={Spring.calm}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
      >
        <SectionRail
          hue={hue}
          domain={domain}
          label={label}
          count={count}
          right={<AnimatedChevron open={open} size={16} color={theme.textMuted} />}
        />
      </PressableScale>
      {/* No gap between the header and the clip — SectionRail carries its own marginBottom, and
          a gap would leave a phantom blank strip while collapsed (same reason styles.doneZone
          has none). */}
      <Collapsible open={open}>
        <View style={styles.cardStack}>{children}</View>
      </Collapsible>
    </Surface>
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
  footer,
}: {
  tasks: Task[];
  onToggleDone: (task: Task) => void;
  spec: LayoutSpec;
  newSinceIds: ReadonlySet<string>;
  footer: React.ReactNode;
}) {
  const theme = useAppTheme();
  const t = useT();
  const unfinished = useMemo(() => tasks.filter((tk) => !tk.done), [tasks]);
  const doneCount = tasks.length - unfinished.length;
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
            onToggleDone={onToggleDone}
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
                onToggleDone={onToggleDone}
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

// Must equal TabSlider's own natural content height (border 1×2 + TRACK_PAD 3×2 + segment
// minHeight 38 = 46) — any surplus here becomes leftover space that `stickyBar`'s
// justifyContent:'center' splits top/bottom only, making the blue pill's vertical inset
// bigger than its horizontal inset (visual bug fixed 2026-07-24: was 56, a 10px surplus,
// giving 9px top/bottom vs 4px left/right around the pill instead of equal insets).
const STICKY_HEIGHT = 46;

export default function TasksScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  // Section hues (color-rail redesign): each list section carries a stable domain accent —
  // Whenever = task (blue), Repeating = meal (orange — was plan/indigo, too close to
  // Whenever's blue to tell apart at a glance; 2026-07-14). Both tokens have light + dark
  // variants, so the rail/dot/label stay distinct and legible in both modes. Shared handles
  // its own (shop/green) hue inside SharedTasksSection.
  // NOTE (2026-07-27): `repeatingHue` borrows the meal *colour token* only — the section has
  // no meal identity. Its SectionCard therefore passes domain="meal" (so the badge gradient
  // matches this hue) together with an explicit icon="repeat" override, because the badge
  // glyph otherwise comes from the domain and drew a knife-and-fork on Recurring tasks.
  // Don't drop the icon override, and don't "fix" it by switching the domain — that would
  // desync the badge colour from the label/divider, which both follow `hue`.
  const wheneverHue = getDomainColor(theme, 'task').accent;
  const repeatingHue = getDomainColor(theme, 'meal').accent;

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
  const [goalsSheetOpen, setGoalsSheetOpen] = useState(false);
  const tasksForDate = useTaskStore((s) => s.tasksForDate);
  const tasksForWeek = useTaskStore((s) => s.tasksForWeek);
  const toggle = useTaskStore((s) => s.toggle);
  const addTask = useTaskStore((s) => s.add);
  const addTaskStep = useTaskStore((s) => s.addStep);
  // Stable handler so the memoised TaskCards / SharedTasksSection don't get a fresh
  // onToggleDone closure every render (which would defeat their React.memo).
  const handleToggleDone = useCallback((task: Task) => toggle(task.id), [toggle]);

  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled);
  // People registry (2026-07-28) — the self row always exists, so >1 is what actually means
  // "there is somebody else to filter by".
  const people = usePeopleStore((s) => s.people);
  const showPeople = peopleModeEnabled && people.length > 1;
  const allTags = useTagStore((s) => s.tags);
  // Sharing is opt-in (Settings → Advanced → Features), off on a fresh install — it hides
  // the shared-tasks section below. Tasks already shared stay in the store untouched.
  const featureSharing = useSettingsStore((s) => s.featureSharing);
  // Energy is a real toggle again (2026-07-31) — gates the shared-load card below.
  const energySystemEnabled = useSettingsStore((s) => s.energySystemEnabled);
  // Gates the "Goals" link button below (2026-07-29) — same flag TaskCard's own GoalPicker
  // field already reads, so turning Goals off hides both at once.
  const featureGoals = useSettingsStore((s) => s.featureGoals);

  const [tab, setTab] = useState<Tab>('today');
  // The ⓘ hint is collapsed until tapped (2026-07-31 — the first-visit auto-open, and the
  // per-screen `autoOpen` arg that used to switch it off here, are both gone). This screen's
  // StarterCard already teaches the same thing WITH a tappable example row.
  const [hintOpen, setHintOpen] = useFirstVisitHint('plans');
  // Person filter (People/family mode): null = Everyone, otherwise a person id.
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  // Tag filter (2026-07-28) — selected tag ids; empty means "All tags". Unlike the person
  // filter this is multi-select, because tags are not mutually exclusive the way people are.
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  // Inline "add a row" input for the Whenever section — the one add affordance on this screen.
  const [wheneverInput, setWheneverInput] = useState('');
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

  // Person filter predicate — identity unless People/family mode is on AND a specific
  // person (not "Everyone") is selected. An empty assigneeId means "mine": that covers
  // rows written before the People back-fill, rows a peer created without assigning, and
  // rows whose person was removed — none of which should vanish from every filter.
  const selfPersonId = people.find((p) => p.isSelf)?.id ?? '';
  // What a row added while filtered should be assigned to. The name mirror stays '' for
  // the self person, matching the pre-registry convention that '' meant "me".
  const filterPerson = personFilter ? people.find((p) => p.id === personFilter) ?? null : null;
  const addAssigneeName = filterPerson && !filterPerson.isSelf ? filterPerson.name : '';

  // The timeline layout's own quick-add (2026-07-30). Unlike InlineTaskAdd's title-only create,
  // PlanTaskCard's type line also carries a start time, a repeat cycle and an energy cost — so a
  // task typed straight onto the timeline can land at a real hour, which is the whole point of
  // being on a timeline. `hasStartDate: true` because this IS the dated Today list, not Whenever.
  const handleTimelineAddTask = useCallback(
    (
      title: string,
      extra: { time?: string; recurring: Recurring; recurringDays: number[]; energyEnabled: boolean; energyValue: number }
    ) => {
      addTask({
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
        energyEnabled: extra.energyEnabled,
        energyValue: extra.energyValue,
        sortOrder: 0,
        hasStartDate: true,
        assigneeId: personFilter ?? '',
        assignee: addAssigneeName,
      });
    },
    [addTask, today, personFilter, addAssigneeName]
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
  const wheneverAll = useMemo(
    () => tasks.filter((tk) => tk.recurring === 'none' && !tk.sharedOut && matchFilters(tk)),
    [tasks, matchFilters]
  );
  const recurringAll = useMemo(
    () => tasks.filter((tk) => tk.recurring !== 'none' && !tk.sharedOut && matchFilters(tk)),
    [tasks, matchFilters]
  );
  const sharedOutAll = useMemo(() => tasks.filter((tk) => tk.sharedOut && matchFilters(tk)), [tasks, matchFilters]);
  const undatedWhenever = useMemo(
    () => tasks.filter((tk) => tk.recurring === 'none' && !tk.hasStartDate && !tk.sharedOut && matchFilters(tk)),
    [tasks, matchFilters]
  );

  const todayList = useMemo(
    () => tasksForDate(today).filter((tk) => (tk.hasStartDate || tk.recurring !== 'none') && matchFilters(tk)).sort(byTime),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tasks` drives recompute (tasksForDate reads the store, not this var), not read directly
    [tasksForDate, today, tasks, matchFilters]
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
    const open = (list: Task[]) => list.filter((tk) => !tk.done).length;
    return {
      today: open(todayList),
      week: weekGroups.reduce((n, g) => n + open(g.tasks), 0),
      all: open(undatedWhenever),
    };
  }, [layoutSpec.id, todayList, weekGroups, undatedWhenever]);

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
    const drawn = (list: Task[]) => {
      const unfinished = list.filter((tk) => !tk.done);
      return layoutSpec.focusMode ? unfinished.slice(0, FOCUS_VISIBLE) : unfinished;
    };
    if (tab === 'today') {
      // "One thing at a time" draws its hero + a short Then list and nothing else — no
      // Whenever section at all. Pass exactly that, or a row it collapses could never glow
      // when the user switches back to a layout that shows it.
      if (layoutSpec.id === 'focusFirst') {
        return todayList.filter((tk) => !tk.done).slice(0, 1 + FOCUS_THEN_VISIBLE).map((tk) => tk.id);
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

  // Quick-add: create an undated, non-recurring "Whenever" task from the inline AddRow.
  // The editor (tap the task) can then promote it (date / repeat / steps).
  const commitWhenever = useCallback(() => {
    const title = wheneverInput.trim();
    if (!title) return;
    addTask({
      title,
      date: today,
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
      hasStartDate: false,
      assignee: '',
    });
    setWheneverInput('');
  }, [wheneverInput, addTask, today]);

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
      bottomNav={false}
      pagerFloatingNav
      ownBackground={false}
      stickyGapColor="transparent"
      stickyBelowHeader={stickyBelowHeader}
      stickyBelowHeaderHeight={STICKY_HEIGHT}
      infoActive={hintOpen}
      onInfoToggle={() => setHintOpen((v) => !v)}
      onSharePress={featureSharing ? () => router.push('/share-modal?kind=t') : undefined}
      onLayoutPress={() => setLayoutPickerOpen(true)}
    >
      <View style={styles.content}>
        {/* Plain hint, no embedded setting. This used to carry a "start with work mode"
            Switch (the first-run teaching slot for the old onboarding wizard's work-mode
            step) — removed 2026-07-25 along with the Work mode card in Settings, because
            `workModeEnabled` was never read by anything: the switch promised to hide
            personal plans and did nothing at all. */}
        <HintCard text={t.hints.plans.text} example={t.hints.plans.example} open={hintOpen} noPill />

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
            example just disappearing. See components/StarterExampleRow's `added` Edit note. */}
        {(tasks.length === 0 || planStarterAdded) && !(tab === 'today' && layoutSpec.timeline) && (
          <StarterCard
            text={t.starters.plans.text}
            example={
              <StarterExampleRow
                icon="ellipse-outline"
                title={t.starters.plans.exampleTitle}
                tag={t.starters.exampleLabel}
                meta="17:00–17:20"
                accent={wheneverHue}
                onAdd={planStarterAdded ? undefined : addPlanStarterTask}
                addLabel={t.starters.addExample}
                added={planStarterAdded}
              />
            }
          />
        )}

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

        {/* Shared load (2026-07-28) — only once there's somebody to compare against, and
            only on the day/week tabs it actually reports on ("All" spans no period). */}
        {energySystemEnabled && showPeople && tab !== 'all' && <EnergyBalanceCard date={today} />}

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

        {/* ── ALL TASKS (order: Whenever → Repeating → Shared) ── */}
        {tab === 'all' && (
          <>
            <SectionCard hue={wheneverHue} domain="task" label={t.tasksSectionWhenever} count={wheneverAll.length}>
              {wheneverAll.length > 0 && (
                <View style={styles.cardStack}>
                  {wheneverAll.map((tk) => (
                    <TaskCard key={tk.id} task={tk} showDelete showShareOut autoExpand={tk.id === expandTaskId} onToggleDone={handleToggleDone} />
                  ))}
                </View>
              )}
              {/* The one add-a-row affordance: an inline empty row with a "+" that saves a new
                  Whenever task into this section. Keeps its Whenever-hue accent as a functional
                  "add" cue (the section box already carries membership color). */}
              <View style={[styles.addRowCard, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: wheneverHue }]}>
                <AddRow
                  placeholder={t.newTask}
                  value={wheneverInput}
                  onChangeText={setWheneverInput}
                  onSubmit={commitWhenever}
                  accent={wheneverHue}
                  showDivider={false}
                  accessibilityLabel={t.newTask}
                />
              </View>
            </SectionCard>

            {/* Debug notes: one anchor per region — wrap the section card, not its inner rows. */}
            <DebugNoteAnchor id="plans.recurring" label="Plans — Recurring">
              <SectionCard hue={repeatingHue} domain="meal" icon="repeat" label={t.tasksSectionRecurring} count={recurringAll.length}>
                {recurringAll.length === 0 ? (
                  <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>{t.tasksSectionRecurringEmpty}</Text>
                ) : (
                  <View style={styles.cardStack}>
                    {recurringAll.map((tk) => (
                      <TaskCard key={tk.id} task={tk} showDelete showShareOut onToggleDone={handleToggleDone} />
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
                          <TaskCard key={tk.id} task={tk} variant="steps" tinted={tk.sharedOut} spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} onToggleDone={handleToggleDone} />
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
                    onPressTask={(task: Task) => router.push({ pathname: '/task-form', params: { id: task.id } })}
                    onToggleTask={handleToggleDone}
                    onAddTask={handleTimelineAddTask}
                    // Same one-tap "Tidy up" example the screen-level StarterCard offered before
                    // it was suppressed for this layout (see that card's gate above) — without
                    // this, an empty day on the timeline default would lose the quick-add
                    // affordance entirely, not just the redundant second copy of the explainer.
                    onAddExample={addPlanStarterTask}
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
                    footer={<InlineTaskAdd date={today} accent={theme.accent} assigneeId={personFilter ?? ''} assignee={addAssigneeName} wrapped />}
                  />
                ) : (
                  <SectionCard hue={theme.accent} label={t.tasksTabToday} count={todayList.length}>
                    {/* Add row sits between the tasks and the collapsed "Done" zone (DoneSplitList
                        footer) so the active/white containers stay grouped and green "Done" is last. */}
                    <DoneSplitList
                      tasks={todayList}
                      emptyText={t.noPlansToday}
                      focusMode={layoutSpec.focusMode}
                      footer={<InlineTaskAdd date={today} accent={theme.accent} assigneeId={personFilter ?? ''} assignee={addAssigneeName} wrapped />}
                      renderCard={(tk) => (
                        <TaskCard key={tk.id} task={tk} variant="steps" tinted={tk.sharedOut} spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} onToggleDone={handleToggleDone} />
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
                    <TaskCard key={tk.id} task={tk} variant="steps" spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} onToggleDone={handleToggleDone} />
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
                    <TaskCard key={tk.id + group.date} task={tk} variant="steps" tinted={tk.sharedOut} spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} onToggleDone={handleToggleDone} />
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
                  <TaskCard key={tk.id} task={tk} variant="steps" spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} onToggleDone={handleToggleDone} />
                )}
              />
            </CollapsedSection>
          </>
        )}

        {/* Edit Goals link (2026-07-29, moved to the bottom + renamed + popup 2026-07-31) —
            Goals dropped its own Home card (too many lists on Home); this is now one of its
            two entry points, alongside Habits. Sits below the task list rather than above it
            (under HintCard, its original spot) since it's an occasional edit action, not
            something that should outrank the day's tasks on every visit. Opens GoalsSheet as
            a popup instead of pushing to /goals, so editing goals doesn't leave this tab.
            Gated on featureGoals so turning the feature off removes the link, not just the
            sheet it opens. */}
        {featureGoals && (
          <SubScreenLinkButton
            domain="task"
            icon="flag"
            label={t.goals.editLink}
            onPress={() => setGoalsSheetOpen(true)}
          />
        )}
      </View>
      <LayoutPickerSheet
        visible={layoutPickerOpen}
        surface="plans"
        onClose={() => setLayoutPickerOpen(false)}
      />
      <GoalsSheet visible={goalsSheetOpen} onClose={() => setGoalsSheetOpen(false)} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md },
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
  // CollapsedSection's shell — deliberately the same box SectionCard draws (Decision 043 rule 2:
  // Spacing.xl above every section, padding routed inward by Surface), so a drawer section sits
  // in the same rhythm as the expanded sections above it and only the chevron marks it apart.
  collapsedSection: {
    marginTop: Spacing.xl,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.sm,
  },
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
