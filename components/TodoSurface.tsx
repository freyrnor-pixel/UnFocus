/**
 * TodoSurface.tsx — the To-do tab's real content: four always-visible cards, each independently
 * expandable to fill the screen.
 *
 * Extracted from app/(tabs)/plans.tsx (2026-08-20, "full-screen card expansion") when that
 * screen dropped its sticky Today/This week/All tasks `TabSlider` in favour of four stacked
 * cards — **Whenever → Today → Week → Recurring** — so the deep planning surface Home's To-do
 * preview can't show gets its own tab again, without re-introducing a tab-switch to get from
 * "today" to "this week". A card's own header carries a components/CardExpandButton.tsx (via
 * lib/useCardExpand.ts) that grows it to fill the screen — the same "expansion in place"
 * mechanism every other card in the app now offers, replacing what used to be a tab switch.
 *
 * Connections:
 *   Imports → components/SectionCard, components/CollapsedSection, components/TaskCard,
 *             components/PlanTaskCard, components/DraggableTaskRow, components/CardExpandButton,
 *             lib/useCardExpand, lib/useSurfaceLayout, lib/useDayLog, lib/useCalendarEvents,
 *             lib/useNowMinutes, lib/taskReset, lib/useEnergyPause, lib/useDragReorder,
 *             lib/prefill, lib/tags, lib/taskRotation, lib/personColor, lib/domainColor,
 *             lib/screenColor, store/useTaskStore, store/useSettingsStore, store/usePeopleStore,
 *             store/useTagStore, store/useMomentsStore — the same set app/(tabs)/plans.tsx's
 *             predecessor (app/plans.tsx) imported; this file IS that logic, moved
 *   Used by → app/(tabs)/plans.tsx (the To-do tab, `section` omitted — the full stack) and
 *             components/CardExpandHost.tsx's registry, one entry per card id
 *             (`todoWhenever`/`todoToday`/`todoWeek`/`todoRecurring`, each passing `section`)
 *   Data    → reads/writes useTaskStore (tasks/steps); SharedTasksSection reads useSharedStore
 *             internally (gated on settings.featureSharing)
 *
 * Edit notes:
 *   - **`section` is the whole extraction contract.** Omitted (the tab itself): renders the
 *     hint, the first-run StarterCard, the person/tag filter rows, the shared-load card, and
 *     all five to-do cards — i.e. everything the old tabbed screen drew across its three tabs,
 *     now stacked instead of switched. Set to one of `'whenever' | 'today' | 'week' | 'month' |
 *     'recurring'` (an expanded card's body, mounted by CardExpandHost): renders ONLY that
 *     card's content, with none of the screen chrome around it — CardExpandHost's own pane
 *     already supplies a title bar, so a second one here would be a duplicate. Every OTHER
 *     piece of state below (filters, layout, drag order, energy pause) is still computed in
 *     section mode, cheaply, so an expanded card's filter/sort behaviour can never disagree
 *     with the tab's.
 *   - ⚠️ **Goals, Earlier days and Washed away are SECTIONS, not cards, as of 2026-08-26**
 *     (phase 5 of DESIGN_COMPARISON/19-IMPLEMENTATION.md) — Goals and Earlier days are drawn
 *     `embedded` inside the Today card's body (below whichever of its four shapes is active),
 *     Washed away inside the Whenever card's body. They were `todoGoals`/`todoEarlierDays`/
 *     `todoWashedAway`, ordinary registry cards under one "Elsewhere" group rail, until this
 *     pass — see lib/cardRegistry.ts's note at their old position for why. Each keeps its own
 *     LOCAL (unpersisted) fold, the same shape the Week card's seven weekday sections already
 *     use — a section has nothing stable to key a persisted fold on. Because they are drawn
 *     inside `showToday`/`showWhenever`, an expanded Today or Whenever pane carries them for
 *     free with no separate CardExpandHost entry.
 *   - **The "Whenever inside Today/This week" nested drawer is GONE.** The pre-extraction
 *     screen drew the undated backlog twice: once as the All tab's real (draggable) section,
 *     and again as a narrower, non-draggable `CollapsedSection` tucked under Today/This week.
 *     With Whenever promoted to its own always-visible top-level card, the second copy is
 *     redundant — delete it rather than keep two views of the same list in one stack.
 *   - **"Put the day away" (the day reset) needs a ConfirmationBanner, and a banner must be a
 *     SIBLING of ScreenScaffold, never a child** (see app/(tabs)/plans.tsx's own note, and
 *     lib/__tests__/toastPlacement.test.ts, which asserts this for every caller) — nested here
 *     it would land inside ScreenScaffold's clipped scroll viewport. So this component does NOT
 *     own that banner's state; it calls `onDayReset(ids, message)` and the tab screen (the only
 *     caller in a position to render a scaffold-sibling) owns the banner and the undo. The
 *     button itself — and the callback — are only offered in full-screen mode
 *     (`!section || section === 'today'`); an expanded Today card, mounted inside
 *     CardExpandHost's own pane rather than a ScreenScaffold, has nowhere safe to put the toast,
 *     so it simply omits the action rather than fighting that constraint. Nothing about the
 *     underlying reset logic is otherwise different.
 *   - **The Today card has FOUR shapes** (by-person / on-a-timeline / "One thing at a time" /
 *     plain list — see `layoutSpec`), and only the plain-list one is a `SectionCard` with a
 *     header to attach the expand button to. The other three get one uniform header row
 *     (title + CardExpandButton) ABOVE the branch content instead of threading the button
 *     through each shape — the same reasoning `collapseKey="todoToday"` already accepted
 *     (it too only applies inside the plain-list branch).
 *   - **The Week card has NO `collapseKey` and its per-weekday sections get neither a
 *     `collapseKey` nor an expand id** (lib/collapsedCards.ts's / lib/expandableCards.ts's
 *     singleton rule: a section drawn once per weekday has nothing stable to store since it's
 *     data-generated, not a fixed id). Only the Week card's own outer wrapper expands.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import SharedTasksSection from '@/components/SharedTasksSection';
import SectionRail from '@/components/SectionRail';
import Card from '@/components/Card';
import SectionCard from '@/components/SectionCard';
import TaskCard from '@/components/TaskCard';
import PlanTaskCard from '@/components/PlanTaskCard';
import { useSurfaceLayout } from '@/lib/useSurfaceLayout';
import { useDayLog } from '@/lib/useDayLog';
import { useCalendarEvents } from '@/lib/useCalendarEvents';
import { useNowMinutes } from '@/lib/useNowMinutes';
import { isWashedAway, canPostpone } from '@/lib/taskReset';
import PadRow from '@/components/PadRow';
import AnimatedListItem from '@/components/AnimatedListItem';
import Button from '@/components/Button';
import { DayEntry } from '@/lib/dayLog';
import { useMomentsStore } from '@/store/useMomentsStore';
import { useCardState } from '@/lib/useCardState';
import { useNewSinceSeen } from '@/lib/useNewSinceSeen';
import AddRow from '@/components/AddRow';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import PressableScale from '@/components/PressableScale';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import GoalsEditor from '@/components/GoalsEditor';
import { RecentDaysList } from '@/components/DayPickerSheet';
import NarratorQuote from '@/components/NarratorQuote';
import StarterCard from '@/components/StarterCard';
import StarterExampleRow from '@/components/StarterExampleRow';
import { todayStr, getWeekDates, getMonthDates, dayOfWeekMon0 } from '@/lib/date';
import TimeBoxInput from '@/components/TimeBoxInput';
import QuickAddOptionsPanel from '@/components/QuickAddOptionsPanel';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
import Stepper from '@/components/Stepper';
import GoalQuickCell from '@/components/GoalQuickCell';
import { energyFieldsFromStepper } from '@/lib/energy';
import { showAppModal } from '@/components/AppModal';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { usePrefill } from '@/lib/prefill';
import { useDragReorder } from '@/lib/useDragReorder';
import { useEnergyPause } from '@/lib/useEnergyPause';
import { tap, success, confirm } from '@/lib/haptics';
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
import { FontSize, Radius, SCREEN_GAP, Spacing, Type } from '@/constants/theme';
import { Spring } from '@/constants/motion';
import type { LayoutSpec } from '@/lib/cardLayout';
import { isCompletable } from '@/lib/cardType';
import { getScreenColor } from '@/lib/screenColor';

export type TodoSection = 'whenever' | 'today' | 'week' | 'month' | 'recurring';

/** Time-order comparator: timed tasks first (by HH:MM), then untimed by title. */
function byTime(a: Task, b: Task): number {
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return a.title.localeCompare(b.title);
}

/** How many unfinished tasks "Now and next" leaves on screen. */
const FOCUS_VISIBLE = 2;
/** How many rows "One thing at a time" draws under its hero. */
const FOCUS_THEN_VISIBLE = 2;

/**
 * Splits a task list into unfinished (shown plainly) + finished (collapsed behind a
 * "Finished (n)" zone). Falls back to the narrator only when the whole list is empty.
 */
function DoneSplitList({
  tasks,
  renderCard,
  footer,
  focusMode,
  emptyQuoteKey,
}: {
  tasks: Task[];
  renderCard: (tk: Task) => React.ReactNode;
  footer?: React.ReactNode;
  focusMode?: boolean;
  emptyQuoteKey?: number;
}) {
  const theme = useAppTheme();
  const t = useT();
  const [doneOpen, setDoneOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const unfinished = useMemo(() => tasks.filter((tk) => !tk.done), [tasks]);
  const finished = useMemo(() => tasks.filter((tk) => tk.done), [tasks]);
  const actionable = useMemo(() => unfinished.filter((tk) => isCompletable(tk.cardType)), [unfinished]);
  const unfinishedNotes = useMemo(() => unfinished.filter((tk) => !isCompletable(tk.cardType)), [unfinished]);
  const focused = focusMode ? actionable.slice(0, FOCUS_VISIBLE) : unfinished;
  const rest = focusMode ? [...actionable.slice(FOCUS_VISIBLE), ...unfinishedNotes] : [];

  const renderAnimated = (tk: Task) => (
    <AnimatedListItem key={tk.id} enabled>
      {renderCard(tk)}
    </AnimatedListItem>
  );

  if (tasks.length === 0) {
    return (
      <>
        <NarratorQuote key={emptyQuoteKey} category="todo" />
        {footer}
      </>
    );
  }

  return (
    <>
      {focused.length > 0 && <View style={styles.cardStack}>{focused.map(renderAnimated)}</View>}
      {rest.length > 0 && (
        <View style={styles.cardStack}>
          <PressableScale onPress={() => { tap(); setRestOpen((v) => !v); }} scaleTo={0.97} releaseSpring={Spring.calm}>
            {/* ⚠️ **`tier="sub"`, and the rule follows the fold (2026-08-21,
                CONSISTENCY_AUDIT.md §2/§13).** These two are headings over ROWS inside a card
                whose own header is already a 24px group rail, so drawing them at the group tier
                put two 24px extrabolds in one card — the heading ladder (group 24 / card 20 /
                in-card section 17) that §2's second pass introduced and then did not apply
                here. And both are collapsible, so their hairline is subject to the same rule
                `SectionCard` and `CollapsedSection` follow: a closed section's rule ties its
                header to nothing. */}
            <SectionRail
              tier="sub"
              hue={theme.textMuted}
              label={t.config.layouts.moreLabel}
              count={rest.length}
              divider={restOpen}
              right={<AnimatedChevron open={restOpen} />}
            />
          </PressableScale>
          <Collapsible open={restOpen}>
            <View style={styles.cardStack}>{rest.map(renderAnimated)}</View>
          </Collapsible>
        </View>
      )}
      {footer}
      {finished.length > 0 && (
        <View style={[styles.doneZone, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <PressableScale onPress={() => { tap(); setDoneOpen((v) => !v); }} scaleTo={0.97} releaseSpring={Spring.calm}>
            <SectionRail
              tier="sub"
              hue={theme.good}
              label={t.tasksDoneLabel}
              count={finished.length}
              divider={doneOpen}
              right={<AnimatedChevron open={doneOpen} />}
            />
          </PressableScale>
          <Collapsible open={doneOpen}>
            <View style={styles.cardStack}>{finished.map(renderAnimated)}</View>
          </Collapsible>
        </View>
      )}
    </>
  );
}

/** A pickable date for the Day/Date option — see `InlineTaskAdd`'s `dateChoices`. */
type DateChoice = { date: string; short: string; label: string };

/**
 * Inline "add a task" row scoped to a specific date.
 *
 * **`compose` is this mount's slice of `lib/cardRegistry.ts`'s per-card options table
 * (DESIGN_COMPARISON/19-IMPLEMENTATION.md phase 7)** — Today gets Time·Effort·Goal, This week
 * gets Day·Time·Goal, This month gets Date·Goal. One composer, three option sets, because all
 * three cards commit through the identical `addTask` shape and differ only in which cells show.
 * Tier 1 (the line, committing alone) is unchanged in every case — none of these options is
 * required to add a row.
 */
function InlineTaskAdd({
  date,
  accent,
  assigneeId = '',
  assignee = '',
  wrapped,
  compose,
  dateChoices,
}: {
  date: string;
  accent: string;
  assigneeId?: string;
  assignee?: string;
  wrapped?: boolean;
  /** Which options panel this mount offers — omit for a bare line with no options at all. */
  compose?: 'today' | 'week' | 'month';
  /** The Day/Date option's pickable dates (`'week'`/`'month'` only) — the composer's own `date`
   *  is the default selection. */
  dateChoices?: DateChoice[];
}) {
  const t = useT();
  const addTask = useTaskStore((s) => s.add);
  const energySystemEnabled = useSettingsStore((s) => s.energySystemEnabled);
  const featureGoals = useSettingsStore((s) => s.featureGoals);
  const [value, setValue] = useState('');
  const [time, setTime] = useState('');
  const [energyValue, setEnergyValue] = useState(0);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [chosenDate, setChosenDate] = useState(date);

  const commitDate = compose === 'week' || compose === 'month' ? chosenDate || date : date;

  const commit = useCallback(() => {
    const title = value.trim();
    if (!title) return;
    const energy = energyFieldsFromStepper(energyValue);
    addTask({
      title,
      date: commitDate,
      time: (compose === 'today' || compose === 'week') && time ? time : undefined,
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
      energyEnabled: energy.energyEnabled,
      energyValue: energy.energyValue,
      goalId,
    });
    setValue('');
    setTime('');
    setEnergyValue(0);
    setGoalId(null);
    setChosenDate(date);
  }, [value, commitDate, time, energyValue, goalId, date, compose, assigneeId, assignee, addTask]);

  function pickDate() {
    if (!dateChoices || dateChoices.length === 0) return;
    tap();
    showAppModal(compose === 'week' ? t.pad.dayOption : t.dateLabel, undefined, [
      ...dateChoices.map((d) => ({
        text: d.date === commitDate ? `• ${d.label}` : d.label,
        onPress: () => setChosenDate(d.date),
      })),
      { text: t.cancel, style: 'cancel' as const },
    ]);
  }

  const chosen = dateChoices?.find((d) => d.date === commitDate);

  const panel = compose ? (
    <QuickAddOptionsPanel>
      {(compose === 'week' || compose === 'month') && dateChoices && dateChoices.length > 0 && (
        <QuickAddOptionRow
          icon="calendar-outline"
          label={compose === 'week' ? t.pad.dayOption : t.dateLabel}
          value={chosen?.short ?? ''}
          isSet={!!chosen}
          accent={accent}
          onPress={pickDate}
          showsMore
          accessibilityLabel={`${compose === 'week' ? t.pad.dayOption : t.dateLabel}: ${chosen?.label ?? ''}`}
        />
      )}
      {(compose === 'today' || compose === 'week') && (
        <QuickAddOptionRow
          icon="time-outline"
          label={t.timeLabel}
          value={<TimeBoxInput value={time} onChange={setTime} />}
          accent={accent}
        />
      )}
      {compose === 'today' && energySystemEnabled && (
        <QuickAddOptionRow
          icon={energyValue === 0 ? 'flash-outline' : energyValue > 0 ? 'flash' : 'flash-off'}
          label={t.energyGiveTakeLabel}
          value={<Stepper value={energyValue} onChange={setEnergyValue} signed accessibilityLabel={t.energyGiveTakeLabel} />}
          accent={accent}
        />
      )}
      {featureGoals && <GoalQuickCell value={goalId} onChange={setGoalId} accent={accent} />}
    </QuickAddOptionsPanel>
  ) : undefined;

  const row = (
    <AddRow
      placeholder={t.newTask}
      value={value}
      onChangeText={setValue}
      onSubmit={commit}
      accent={accent}
      showDivider={!wrapped}
      accessibilityLabel={t.newTask}
      panel={panel}
    />
  );

  // `wrapped` = mounted as a list's footer rather than appended under a divider. It used to
  // also mean "draw a card around it" — see styles.addRowSlot for why that card is gone.
  if (wrapped) return <View style={styles.addRowSlot}>{row}</View>;
  return row;
}

/** "One thing at a time" (lib/cardLayout.ts's `focusFirst`) — the Today card's 1c shape. */
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
  pinProps: (task: Task) => { pinned: boolean; dimmed: boolean };
  footer: React.ReactNode;
}) {
  const theme = useAppTheme();
  const t = useT();
  const unfinished = useMemo(() => tasks.filter((tk) => !tk.done && isCompletable(tk.cardType)), [tasks]);
  const doneCount = useMemo(() => tasks.filter((tk) => tk.done).length, [tasks]);
  const hero = unfinished[0];
  const then = unfinished.slice(1, 1 + FOCUS_THEN_VISIBLE);
  const overflow = Math.max(0, unfinished.length - 1 - then.length);

  return (
    <View style={styles.focusWrap}>
      {hero ? (
        <View style={styles.focusHero}>
          <Text style={[styles.focusLabel, { color: theme.accent }]}>{t.focusFirst.nextUp}</Text>
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

type Props = {
  /** Omit for the full tab (every card + chrome). Set for one expanded card's body. */
  section?: TodoSection;
  /** "Put the day away"'s toast — see the header note. Only used in full/`'today'` mode. */
  onDayReset?: (ids: string[], message: string) => void;
};

export default function TodoSurface({ section, onDayReset }: Props) {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const full = !section;

  // The To-do screen's own categorical hue — gold (`featTask`, IDENTITY_HUES.todo). EVERY rail
  // on this surface takes it.
  //
  // ⚠️ **`theme.accent` is NOT this screen's colour and never was (2026-08-21).** It is the app's
  // generic blue `#1E88FF`; the screen is `#FFD700`. Today, Week and the seven weekday sections
  // passed the blue, so their dot and their hairline were blue on a gold screen — visible in the
  // Today card as a blue rule sitting directly above its own gold-ringed composer, with a gold
  // badge on the other side of it. Colour is this app's section-navigation channel
  // (CONSISTENCY_AUDIT.md §16), so a card wearing the wrong one is not a small mismatch.
  // `accent={...}` props passed to the rows and composers below are a different question and are
  // deliberately untouched here.
  const screenHue = getScreenColor(theme, 'plans').base;
  const wheneverHue = screenHue;

  const tasks = useTaskStore((s) => s.tasks);
  const tasksLoaded = useTaskStore((s) => s.loaded);

  const layoutSpec = useSurfaceLayout('plans');
  const [todayCardState, setTodayCardState] = useCardState('plans');
  const planTimelineHorizontal = useSettingsStore((s) => s.planTimelineHorizontal);
  const tasksForDate = useTaskStore((s) => s.tasksForDate);
  const tasksForWeek = useTaskStore((s) => s.tasksForWeek);
  const toggle = useTaskStore((s) => s.toggle);
  const addTask = useTaskStore((s) => s.add);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);
  const setTasksDated = useTaskStore((s) => s.setTasksDated);
  const washedAwayTasks = useTaskStore((s) => s.washedAwayTasks);
  const bringBack = useTaskStore((s) => s.bringBack);
  const addTaskStep = useTaskStore((s) => s.addStep);
  const handleToggleDone = useCallback((task: Task) => toggle(task.id), [toggle]);

  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled) && SHARING_VISIBLE;
  const people = usePeopleStore((s) => s.people);
  const showPeople = peopleModeEnabled && people.length > 1;
  const allTags = useTagStore((s) => s.tags);
  const featureSharing = useSettingsStore((s) => s.featureSharing) && SHARING_VISIBLE;
  const energySystemEnabled = useSettingsStore((s) => s.energySystemEnabled);
  const featureGoals = useSettingsStore((s) => s.featureGoals);
  const featureDayLog = useSettingsStore((s) => s.featureDayLog);
  const taskDecayOn = useSettingsStore((s) => s.featureTaskDecay);

  const [personFilter, setPersonFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [wheneverInput, setWheneverInput] = useState('');
  const [wheneverTime, setWheneverTime] = useState('');
  const [wheneverRecurring, setWheneverRecurring] = useState<Recurring>('none');
  const [wheneverRecurringDays, setWheneverRecurringDays] = useState<number[]>([]);
  // Effort · Goal (phase 7's table for Whenever) — added ALONGSIDE the existing Time/Repeat
  // cells rather than replacing them: this composer already doubles as the general "add any
  // task" line (setting Repeat here creates a genuinely recurring task, which is why it isn't
  // filtered out of `wheneverAll` by mistake — recurring tasks just leave this list once
  // committed), and that was shipped, tested behaviour worth keeping rather than deleting to
  // match the table's minimal two-option read of "Whenever".
  const [wheneverEnergyValue, setWheneverEnergyValue] = useState(0);
  const [wheneverGoalId, setWheneverGoalId] = useState<string | null>(null);
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

  // ── Recurring's own composer: Repeat · On · Time (phase 7's table) ─────────────────────────
  // **`recurringDays` (the "On" cell) is the dependent option the phase-7 handoff calls out by
  // name** — it only exists once Repeat says Weekly, and its own picker is exactly the shape
  // that froze the shipped app before `engaged` existed (a `showAppModal` Repeat picker takes
  // window focus, blurring the composer; without `engaged` the whole panel — On included — would
  // unmount behind the dialog). Nothing new is needed here to be safe: `PadTypeRow`/`AddRow`'s
  // panel slot already spreads `controlsResponderProps` around whatever this returns, so a cell
  // that appears/disappears with `recurringMode` is just ordinary conditional JSX inside it.
  const [recurringInput, setRecurringInput] = useState('');
  const [recurringMode, setRecurringMode] = useState<Recurring>('daily');
  const [recurringDays, setRecurringDays] = useState<number[]>([dayOfWeekMon0(new Date())]);
  const [recurringTime, setRecurringTime] = useState('');
  function pickRecurringMode() {
    tap();
    const options: Recurring[] = ['daily', 'weekly', 'monthly'];
    showAppModal(
      t.pad.recurrencePicker,
      undefined,
      [
        ...options.map((mode) => ({
          text: mode === recurringMode ? `• ${wheneverRecurringLabel(mode)}` : wheneverRecurringLabel(mode),
          onPress: () => {
            if (mode === 'weekly') {
              setRecurringDays((days) => (days.length ? days : [dayOfWeekMon0(new Date())]));
            }
            setRecurringMode(mode);
          },
        })),
        { text: t.cancel, style: 'cancel' as const },
      ]
    );
  }
  function toggleRecurringDay(i: number) {
    tap();
    setRecurringDays((days) => (days.includes(i) ? days.filter((d) => d !== i) : [...days, i].sort((a, b) => a - b)));
  }
  // commitRecurring itself is defined further down, once `addAssigneeName` exists — see there.

  const [planStarterAdded, setPlanStarterAdded] = useState(false);

  const { expandTaskId } = useLocalSearchParams<{ expandTaskId?: string }>();

  const prefill = usePrefill();
  useEffect(() => {
    if (prefill) setWheneverInput(prefill);
  }, [prefill]);

  const today = todayStr();

  const nowMinutes = useNowMinutes();
  const dayLog = useDayLog(today, nowMinutes);
  const removeMoment = useMomentsStore((s) => s.remove);
  const addMoment = useMomentsStore((s) => s.add);
  const isFocused = useIsFocused();
  const calendarEvents = useCalendarEvents(today, isFocused);
  const handlePressLogEntry = useCallback(
    (entry: DayEntry) => {
      if (entry.kind !== 'task' || !entry.sourceId) return;
      router.setParams({ expandTaskId: entry.sourceId });
    },
    [router]
  );

  const selfPersonId = people.find((p) => p.isSelf)?.id ?? '';
  const filterPerson = personFilter ? people.find((p) => p.id === personFilter) ?? null : null;
  const addAssigneeName = filterPerson && !filterPerson.isSelf ? filterPerson.name : '';

  const commitRecurring = useCallback(() => {
    const title = recurringInput.trim();
    if (!title) return;
    addTask({
      title,
      date: today,
      time: recurringTime || undefined,
      taskType: 'start-at',
      done: false,
      recurring: recurringMode,
      recurringDays: recurringMode === 'weekly' ? recurringDays : [],
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
    setRecurringInput('');
    setRecurringTime('');
    setRecurringMode('daily');
    setRecurringDays([dayOfWeekMon0(new Date())]);
  }, [recurringInput, recurringTime, recurringMode, recurringDays, addTask, today, personFilter, addAssigneeName]);

  const handleTimelineAddTask = useCallback(
    (title: string, extra: { time?: string; recurring: Recurring; recurringDays: number[] }) =>
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
        sortOrder: 0,
        hasStartDate: true,
        assigneeId: personFilter ?? '',
        assignee: addAssigneeName,
      }),
    [addTask, today, personFilter, addAssigneeName]
  );
  const handleTimelineAddTaskAndEdit = useCallback(
    (title: string, extra: { time?: string; recurring: Recurring; recurringDays: number[] }) => {
      if (!title) return;
      const task = handleTimelineAddTask(title, extra);
      router.setParams({ expandTaskId: task.id });
    },
    [handleTimelineAddTask, router]
  );

  const matchFilters = useCallback(
    (tk: Task) =>
      (!showPeople ||
        personFilter === null ||
        (effectiveAssigneeId(tk, tk.date || today) || selfPersonId) === personFilter) &&
      matchesTagFilter(tk.tagIds, tagFilter) &&
      !(taskDecayOn && isWashedAway(tk, today, Date.now())),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `nowMinutes` is the recompute signal for the wash-away cutoff, which reads the clock at call time
    [showPeople, personFilter, selfPersonId, tagFilter, today, taskDecayOn, nowMinutes]
  );

  const washedAway = useMemo(
    () => (taskDecayOn ? washedAwayTasks(today, Date.now()) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tasks`/`nowMinutes` drive the recompute; washedAwayTasks reads the store and the clock at call time
    [washedAwayTasks, taskDecayOn, today, tasks, nowMinutes]
  );

  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const weekStart = weekDates[0];

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

  const energyPause = useEnergyPause();

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

  // The peek line's two numbers (2026-08-27, round 20). A card resting shut used to say `0`,
  // which on a day nobody has filled in yet reads as a score; this says what the card is for.
  // `isCompletable` is what keeps a 'note' card out of both halves — it has no completion state
  // at all, so counting it as "left" would promise a tick the row does not have.
  const todayDone = useMemo(
    () => todayList.filter((tk) => isCompletable(tk.cardType) && tk.done).length,
    [todayList]
  );
  const todayLeft = useMemo(
    () => todayList.filter((tk) => isCompletable(tk.cardType) && !tk.done).length,
    [todayList]
  );

  const dayResetTasks = useMemo(() => todayList.filter(canPostpone), [todayList]);
  const [dayResetNonce, setDayResetNonce] = useState(0);

  const handleDayReset = useCallback(() => {
    const ids = dayResetTasks.map((tk) => tk.id);
    if (ids.length === 0) return;
    confirm();
    setTasksDated(ids, false);
    setDayResetNonce((n) => n + 1);
    onDayReset?.(ids, t.dayResetDone(ids.length));
  }, [dayResetTasks, setTasksDated, onDayReset, t]);

  const pinnedTaskId = useMemo(
    () =>
      energyPause.pinnedTaskId && todayList.some((tk) => tk.id === energyPause.pinnedTaskId)
        ? energyPause.pinnedTaskId
        : null,
    [energyPause.pinnedTaskId, todayList]
  );
  const pinProps = useCallback(
    (tk: Task) => ({ pinned: tk.id === pinnedTaskId, dimmed: !!pinnedTaskId && tk.id !== pinnedTaskId }),
    [pinnedTaskId]
  );
  const weekGroups = useMemo(
    () => tasksForWeek(weekStart).map((g) => ({ ...g, tasks: g.tasks.filter(matchFilters) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tasks` drives recompute (tasksForWeek reads the store, not this var), not read directly
    [tasksForWeek, weekStart, tasks, matchFilters]
  );

  // The Week card's own tally — the seven days' filtered tasks, so the count on the rail is the
  // count of what the card would draw, exactly as `count={group.tasks.length}` is per day.
  const weekTaskCount = useMemo(
    () => weekGroups.reduce((n, g) => n + g.tasks.length, 0),
    [weekGroups]
  );

  // The Week composer's "Day" option (phase 7) — one choice per date the card actually draws,
  // short for the cell, full for the picker's own list.
  const weekDateChoices = useMemo(
    () => weekGroups.map((g, i): DateChoice => ({ date: g.date, short: t.dayLabels[i], label: t.dayFull[i] })),
    [weekGroups, t]
  );

  // Per-weekday fold state for the Week card (2026-08-20, card-element standardization pass —
  // "avoid always having 7 days showing"). Local and NOT persisted: a day's own SectionCard is
  // data-generated (one per date in the current week), and lib/collapsedCards.ts's singleton
  // rule is exactly why a per-day id can't take a `collapseKey` — see SectionCard.tsx's edit
  // note.
  //
  // **EVERY day starts folded, today's included** (2026-08-19, maintainer: *"the current day
  // does not need to be open. The days are just for an overview, while 'Today' and 'Whenever'
  // at the top is for use."*). The card above this one is already today, in full, with its own
  // composer — so auto-opening today here drew the same day twice and made the one card that is
  // meant to read as a seven-row overview open at whatever height today happens to be. This
  // used to be `.filter((d) => d !== today)`; don't restore it.
  const [collapsedWeekdays, setCollapsedWeekdays] = useState<Set<string>>(
    () => new Set(weekGroups.map((g) => g.date))
  );
  const toggleWeekday = useCallback((date: string) => {
    setCollapsedWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  // **The Month card — a DATE FILTER, not monthly recurrence** (2026-08-26, new). Every date in
  // the current calendar month, minus the seven Week already draws — the same question
  // `todoWeek` already asks, one rung out, so it reads `taskOccursOn` the identical way
  // `tasksForWeek` does rather than adding a second occurrence engine. Recurring tasks stay out
  // (they belong to `todoRecurring`); this is only the dated, non-recurring backlog for later
  // this month.
  const monthDates = useMemo(() => {
    const [y, m] = today.slice(0, 7).split('-').map(Number);
    return getMonthDates(y, m);
  }, [today]);
  // New tasks composed on this card default to the month's last day, so committing on the line
  // alone (tier 1's rule) always lands a row this card actually draws.
  const monthDefaultDate = monthDates[monthDates.length - 1] ?? today;
  // The Month composer's "Date" option (phase 7) — every date this card draws, labelled by day
  // number (there's no room in a half-width cell for a full "26 August").
  const monthDateChoices = useMemo(
    () => monthDates.map((d): DateChoice => ({ date: d, short: String(Number(d.slice(8, 10))), label: d })),
    [monthDates]
  );
  const monthAll = useMemo(() => {
    const weekSet = new Set(weekDates);
    return tasks
      .filter(
        (tk) =>
          tk.hasStartDate &&
          tk.recurring === 'none' &&
          !tk.sharedOut &&
          monthDates.includes(tk.date) &&
          !weekSet.has(tk.date) &&
          matchFilters(tk)
      )
      .sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b));
  }, [tasks, monthDates, weekDates, matchFilters]);

  // Goals/Earlier days (inside Today) and Washed away (inside Whenever) are SECTIONS now, not
  // registry cards — see lib/cardRegistry.ts's note at their old position. A section's fold is
  // LOCAL and unpersisted, the same shape the Week card's seven weekday sections already use;
  // there is nothing stable here to key a persisted `collapseKey` on.
  const [todayGoalsOpen, setTodayGoalsOpen] = useState(false);
  const [todayEarlierOpen, setTodayEarlierOpen] = useState(false);
  const [wheneverWashedOpen, setWheneverWashedOpen] = useState(false);

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

  const groupByPerson = !!layoutSpec.groupByPerson && showPeople;
  const todayByPerson = useMemo(() => {
    if (!groupByPerson) return [];
    const groups = people.map((person, index) => ({
      personId: person.id,
      label: person.isSelf ? person.name || t.habitForMe : person.name,
      hue: personColor(person.color, index),
      addName: person.isSelf ? '' : person.name,
      tasks: todayList.filter(
        (tk) => (effectiveAssigneeId(tk, tk.date || today) || selfPersonId) === person.id
      ),
    }));
    const claimed = new Set(groups.flatMap((g) => g.tasks.map((tk) => tk.id)));
    const orphans = todayList.filter((tk) => !claimed.has(tk.id));
    return orphans.length
      ? [...groups, { personId: '', label: t.rotation.unassigned, hue: theme.textMuted, addName: '', tasks: orphans }]
      : groups;
  }, [groupByPerson, people, todayList, selfPersonId, today, t, theme.textMuted]);

  const visibleTaskIds = useMemo(() => {
    const drawn = (list: Task[]) => {
      const unfinished = list.filter((tk) => !tk.done);
      if (!layoutSpec.focusMode) return unfinished;
      return unfinished.filter((tk) => isCompletable(tk.cardType)).slice(0, FOCUS_VISIBLE);
    };
    if (layoutSpec.id === 'focusFirst') {
      return todayList
        .filter((tk) => !tk.done && isCompletable(tk.cardType))
        .slice(0, 1 + FOCUS_THEN_VISIBLE)
        .map((tk) => tk.id);
    }
    return drawn(todayList).map((tk) => tk.id);
  }, [layoutSpec.focusMode, layoutSpec.id, todayList]);

  const { ids: newSinceIds, fields: newFields } = useNewSinceSeen(
    'plans:today',
    visibleTaskIds,
    useMemo(
      () => ({ meta: layoutSpec.showMeta, price: layoutSpec.showPrice, extras: layoutSpec.showExtras }),
      [layoutSpec]
    ),
    layoutSpec.id,
    tasksLoaded
  );

  const commitWhenever = useCallback(() => {
    const title = wheneverInput.trim();
    if (!title) return;
    const energy = energyFieldsFromStepper(wheneverEnergyValue);
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
      energyEnabled: energy.energyEnabled,
      energyValue: energy.energyValue,
      goalId: wheneverGoalId,
    });
    setWheneverInput('');
    setWheneverTime('');
    setWheneverRecurring('none');
    setWheneverRecurringDays([]);
    setWheneverEnergyValue(0);
    setWheneverGoalId(null);
  }, [wheneverInput, wheneverTime, wheneverRecurring, wheneverRecurringDays, wheneverEnergyValue, wheneverGoalId, addTask, today]);

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






  const showWhenever = full || section === 'whenever';
  const showToday = full || section === 'today';
  const showWeek = full || section === 'week';
  const showMonth = full || section === 'month';
  const showRecurring = full || section === 'recurring';

  // The washed-away rows, drawn as a section inside the Whenever card's own body (2026-08-26 —
  // was its own registry card, `todoWashedAway`; see lib/cardRegistry.ts's note). Defined ahead
  // of `wheneverCard` because it is now a CHILD of it rather than a sibling.
  const washedAwayRows = (
    <View style={styles.cardStack}>
      {washedAway.map((tk) => (
        <PadRow
          key={tk.id}
          title={tk.title}
          accent={wheneverHue}
          trailing={<Button label={t.washedAwayBringBack} variant="secondary" size="sm" onPress={() => { tap(); bringBack(tk.id); }} />}
        />
      ))}
    </View>
  );

  const wheneverCard = showWhenever && (
    <View key="whenever">
      <Card id="todoWhenever" count={wheneverAll.length} peek={t.peek.todoWhenever(wheneverAll.length)}>
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
        <View style={styles.addRowSlot}>
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
                {/* Effort · Goal — phase 7's table entry for this card. */}
                {energySystemEnabled && (
                  <QuickAddOptionRow
                    icon={wheneverEnergyValue === 0 ? 'flash-outline' : wheneverEnergyValue > 0 ? 'flash' : 'flash-off'}
                    label={t.energyGiveTakeLabel}
                    value={
                      <Stepper
                        value={wheneverEnergyValue}
                        onChange={setWheneverEnergyValue}
                        signed
                        accessibilityLabel={t.energyGiveTakeLabel}
                      />
                    }
                    accent={wheneverHue}
                  />
                )}
                {featureGoals && (
                  <GoalQuickCell value={wheneverGoalId} onChange={setWheneverGoalId} accent={wheneverHue} />
                )}
              </QuickAddOptionsPanel>
            }
          />
        </View>
        {washedAway.length > 0 && (
          <SectionCard
            embedded
            hue={wheneverHue}
            icon="water-outline"
            label={t.tasksSectionWashedAway}
            count={washedAway.length}
            collapsed={!wheneverWashedOpen}
            onToggleCollapse={() => setWheneverWashedOpen((v) => !v)}
          >
            {washedAwayRows}
          </SectionCard>
        )}
      </Card>
    </View>
  );

  // ⚠️ **Today is ONE card with four possible bodies (2026-08-21).** It used to be four
  // differently-shaped things that happened to be called Today: a `SectionCard` on the plain
  // layout (the only one with a fold), a `PlanTaskCard` drawing its own card on the timeline
  // layout, and two hand-wrapped `Surface`s — each with its own idea of where the header went.
  // That is why this card had no fold chevron on the tab's DEFAULT layout while its three
  // neighbours did, which is the *"not all cards can be collapsed"* report at its most visible.
  //
  // `components/Card.tsx` draws the card, the rail, the fold and the ⤢ now; each shape supplies
  // only its body, unwrapped. The per-shape header node is gone with the shapes.

  const todayCard = showToday && (
    <View key="today">
      <DebugNoteAnchor id="plans.dayView" label="Plans — Today">
        <Card
          id="todoToday"
          count={todayList.length}
          peek={t.peek.todoToday(todayLeft, todayDone)}
          // Only while the card has rows — an empty Today already speaks through NarratorQuote,
          // and two muted italic lines stacked is what the 2026-08-17 deletion was about.
          hint={todayList.length > 0 ? t.cardHint.todoToday : undefined}
        >
          {groupByPerson ? (
            <View style={styles.cardStack}>
              {/* `embedded`: these sit inside the Today card, and a Surface inside a Surface is
                  the nested panel the blueprint pass banned. Same shape the Week card's seven
                  weekday sections take. */}
              {todayByPerson.map((group) => (
                <SectionCard key={group.personId || 'unassigned'} embedded hue={group.hue} label={group.label} count={group.tasks.length}>
                  <DoneSplitList
                    tasks={group.tasks}
                    focusMode={layoutSpec.focusMode}
                    emptyQuoteKey={dayResetNonce}
                    footer={
                      <InlineTaskAdd date={today} accent={group.hue} assigneeId={group.personId} assignee={group.addName} wrapped compose="today" />
                    }
                    renderCard={(tk) => (
                      <TaskCard key={tk.id} task={tk} variant="steps" tinted={tk.sharedOut} spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} newFields={newFields} onToggleDone={handleToggleDone} {...pinProps(tk)} />
                    )}
                  />
                </SectionCard>
              ))}
            </View>
          ) : layoutSpec.timeline ? (
            <PlanTaskCard
              embedded
              tasks={todayList}
              allTasks={tasks}
              spec={layoutSpec}
              padState={todayCardState}
              onPadStateChange={setTodayCardState}
              horizontal={planTimelineHorizontal}
              onPressTask={(task: Task) => router.setParams({ expandTaskId: task.id })}
              onToggleTask={handleToggleDone}
              onAddTask={handleTimelineAddTask}
              onAddTaskAndEdit={handleTimelineAddTaskAndEdit}
              onAddExample={addPlanStarterTask}
              dayLog={dayLog}
              onPressEntry={handlePressLogEntry}
              onRemoveMoment={removeMoment}
              onCaptureMoment={addMoment}
              calendarEvents={calendarEvents}
            />
          ) : layoutSpec.id === 'focusFirst' ? (
            <FocusFirstToday
              tasks={todayList}
              onToggleDone={handleToggleDone}
              spec={layoutSpec}
              newSinceIds={newSinceIds}
              newFields={newFields}
              pinProps={pinProps}
              footer={<InlineTaskAdd date={today} accent={theme.accent} assigneeId={personFilter ?? ''} assignee={addAssigneeName} wrapped compose="today" />}
            />
          ) : (
            <DoneSplitList
              tasks={todayList}
              focusMode={layoutSpec.focusMode}
              emptyQuoteKey={dayResetNonce}
              footer={<InlineTaskAdd date={today} accent={theme.accent} assigneeId={personFilter ?? ''} assignee={addAssigneeName} wrapped compose="today" />}
              renderCard={(tk) => (
                <TaskCard key={tk.id} task={tk} variant="steps" tinted={tk.sharedOut} spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} newFields={newFields} onToggleDone={handleToggleDone} {...pinProps(tk)} />
              )}
            />
          )}

          {/* Goals and Earlier days — SECTIONS inside Today's own body since 2026-08-26 (were
              `todoGoals`/`todoEarlierDays`, ordinary registry cards under one "Elsewhere" group
              rail; see lib/cardRegistry.ts's note at their old position). Drawn below whichever
              of the four shapes above is active, so an expanded Today pane carries them too. */}
          {featureGoals && (
            <SectionCard
              embedded
              hue={screenHue}
              icon="flag"
              label={t.goals.editLinkPractical}
              collapsed={!todayGoalsOpen}
              onToggleCollapse={() => setTodayGoalsOpen((v) => !v)}
            >
              <GoalsEditor accent={screenHue} />
            </SectionCard>
          )}
          {featureDayLog && (
            <SectionCard
              embedded
              hue={screenHue}
              icon="time-outline"
              label={t.dayLog.earlierDays}
              collapsed={!todayEarlierOpen}
              onToggleCollapse={() => setTodayEarlierOpen((v) => !v)}
            >
              <RecentDaysList accent={screenHue} />
            </SectionCard>
          )}
        </Card>
      </DebugNoteAnchor>

      {full && dayResetTasks.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          icon="archive-outline"
          label={t.dayResetAction}
          onPress={handleDayReset}
          style={styles.dayResetBtn}
        />
      )}
    </View>
  );

  const weekCard = showWeek && (
    // **One card holding all seven days (2026-08-20)**, maintainer: *"The fullscreen button has
    // to be in the top right corner for each card. To fix this for the week the cards themselves
    // can be inside a larger card covering them all."* The header used to be a bare row sitting
    // on the screen backdrop above seven loose cards, so its ⤢ was in the corner of nothing.
    // Now the header is this card's own top-right corner and the days are `embedded`
    // SectionCards — rails and folds, no Surface each — because a Surface inside a Surface
    // reads as a nested panel.
    // ⚠️ **This is a `Card` like its three neighbours (2026-08-21).** It was the last hand-rolled
    // card header on the tab — its own `Surface`, its own `SectionRail`, its own closed-state
    // inset copied from `SectionCard`, its own fold chevron — kept that way on the reasoning
    // that its `Collapsible` has to wrap SEVEN embedded sections rather than one content view.
    // That was never a reason: `Card`'s body is whatever the caller passes, and seven embedded
    // `SectionCard`s are one child like any other.
    <View key="week">
      <Card
        id="todoWeek"
        count={weekTaskCount}
        peek={t.peek.todoWeek(weekTaskCount)}
        hint={weekTaskCount > 0 ? t.cardHint.todoWeek : undefined}
      >
        <View style={styles.weekDays}>
          {weekGroups.map((group, i) => (
            <SectionCard
              key={group.date}
              embedded
              hue={screenHue}
              label={t.dayFull[i]}
              count={group.tasks.length}
              collapsed={collapsedWeekdays.has(group.date)}
              onToggleCollapse={() => toggleWeekday(group.date)}
            >
              <DoneSplitList
                tasks={[...group.tasks].sort(byTime)}
                focusMode={layoutSpec.focusMode}
                footer={<InlineTaskAdd date={group.date} accent={theme.accent} assigneeId={personFilter ?? ''} assignee={addAssigneeName} wrapped compose="week" dateChoices={weekDateChoices} />}
                renderCard={(tk) => (
                  <TaskCard key={tk.id + group.date} task={tk} variant="steps" tinted={tk.sharedOut} spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} newFields={newFields} onToggleDone={handleToggleDone} />
                )}
              />
            </SectionCard>
          ))}
        </View>
      </Card>
    </View>
  );

  const monthCard = showMonth && (
    <View key="month">
      <Card id="todoMonth" count={monthAll.length} peek={t.peek.todoMonth(monthAll.length)}>
        <DoneSplitList
          tasks={monthAll}
          footer={<InlineTaskAdd date={monthDefaultDate} accent={screenHue} assigneeId={personFilter ?? ''} assignee={addAssigneeName} wrapped compose="month" dateChoices={monthDateChoices} />}
          renderCard={(tk) => (
            <TaskCard
              key={tk.id}
              task={tk}
              showDelete
              showShareOut
              autoExpand={tk.id === expandTaskId}
              onToggleDone={handleToggleDone}
            />
          )}
        />
      </Card>
    </View>
  );

  const recurringCard = showRecurring && (
    <View key="recurring">
      <DebugNoteAnchor id="plans.recurring" label="Plans — Recurring">
        <Card
          id="todoRecurring"
          count={recurringAll.length}
          peek={t.peek.todoRecurring(recurringAll.length)}
        >
          {recurringAll.length === 0 ? (
            <NarratorQuote category="todo" />
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
          {/* Repeat · On · Time (phase 7's table) — commits a genuinely recurring task
              directly, rather than sending the user to the full editor for what is this
              card's own primary action. "On" is the dependent cell: it only renders once
              Repeat says Weekly, see the state block above for why that's safe. */}
          <View style={styles.addRowSlot}>
            <AddRow
              placeholder={t.newTask}
              value={recurringInput}
              onChangeText={setRecurringInput}
              onSubmit={commitRecurring}
              accent={screenHue}
              showDivider={recurringAll.length > 0}
              accessibilityLabel={t.newTask}
              panel={
                <QuickAddOptionsPanel>
                  <QuickAddOptionRow
                    icon="repeat"
                    label={t.taskRecurringToggle}
                    value={wheneverRecurringLabel(recurringMode)}
                    isSet
                    accent={screenHue}
                    onPress={pickRecurringMode}
                    showsMore
                    accessibilityLabel={`${t.taskRecurringToggle}: ${wheneverRecurringLabel(recurringMode)}`}
                  />
                  {recurringMode === 'weekly' && (
                    <QuickAddOptionRow
                      icon="calendar-outline"
                      label={t.pad.onDays}
                      wide
                      accent={screenHue}
                      value={
                        <View style={styles.recurringDaysRow}>
                          {t.dayLabels.map((label, i) => {
                            const active = recurringDays.includes(i);
                            return (
                              <PressableScale
                                key={i}
                                style={[
                                  styles.recurringDayChip,
                                  {
                                    backgroundColor: active ? screenHue : theme.surfaceMuted,
                                    borderColor: active ? screenHue : theme.border,
                                  },
                                ]}
                                onPress={() => toggleRecurringDay(i)}
                                scaleTo={0.97}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                accessibilityLabel={t.dayFull[i]}
                              >
                                <Text style={[styles.recurringDayChipText, { color: active ? theme.accentInk : theme.textMuted }]}>
                                  {label.slice(0, 2)}
                                </Text>
                              </PressableScale>
                            );
                          })}
                        </View>
                      }
                    />
                  )}
                  <QuickAddOptionRow
                    icon="time-outline"
                    label={t.timeLabel}
                    value={<TimeBoxInput value={recurringTime} onChange={setRecurringTime} />}
                    accent={screenHue}
                  />
                </QuickAddOptionsPanel>
              }
            />
          </View>
        </Card>
      </DebugNoteAnchor>
    </View>
  );

  return (
    <View style={styles.content}>
      {/* ⚠️ No ⓘ banner here since 2026-08-20 — see components/StarterCard.tsx below, which is
          where this screen's explanation lives now. `hints.plans.text` ("Everything to do, by
          day and week.") was not moved into it: `starters.plans.text` was already the same
          sentence's job, one card lower, next to a real example row. */}
      {full && (tasks.length === 0 || planStarterAdded) && !layoutSpec.timeline && (
        <StarterCard
          text={t.starters.plans.text}
          collapsible
          example={
            <StarterExampleRow
              icon="ellipse-outline"
              title={t.starters.plans.exampleTitle}
              meta="17:00–17:20"
              onAdd={planStarterAdded ? undefined : addPlanStarterTask}
              addLabel={t.starters.addExample}
              added={planStarterAdded}
            />
          }
        />
      )}

      {full && (showPeople || allTags.length > 0) && (
        <View>
          <Collapsible open={showPeople}>
            <View style={styles.personFilterRow}>
              <PersonChip label={t.peopleMode.filterAll} selected={personFilter === null} onPress={() => setPersonFilter(null)} />
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

          <Collapsible open={allTags.length > 0}>
            <View style={styles.personFilterRow}>
              <TagChip label={t.tags.filterAll} selected={tagFilter.length === 0} onPress={() => setTagFilter([])} />
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

      {energySystemEnabled && full && showPeople && <EnergyBalanceCard date={today} />}

      {/* ⚠️ **The order is the registry's, and it is deliberate (2026-08-21, revised
          2026-08-26).** Time horizon narrowing to widening, then what repeats: Today → Week →
          Month → Whenever → Recurring. Goals, Earlier days and Washed away are no longer
          top-level cards here — they are sections drawn INSIDE Today and Whenever's own bodies
          (see those two cards above), so there is no "Elsewhere" group rail left to draw.
          lib/__tests__/cardRegistry.test.ts pins the numbering; this is where it is spent. */}
      {todayCard}
      {weekCard}
      {monthCard}
      {wheneverCard}
      {recurringCard}

      {full && featureSharing && <SharedTasksSection sentTasks={sharedOutAll} onToggleDone={handleToggleDone} />}

    </View>
  );
}

const styles = StyleSheet.create({
  // No horizontal padding here, on purpose — this component is mounted two ways (the tab
  // wrapper and CardExpandHost's expanded body) and each caller already supplies its own
  // horizontal inset, the same convention components/FoodTab.tsx's `root` follows.
  content: { gap: SCREEN_GAP },
  cardStack: { gap: Spacing.sm },
  // The Recurring composer's "On" cell (phase 7) — a compact weekday multi-select, same
  // geometry as components/TaskCard.tsx's own `weekdayChip` row (a smaller version of the same
  // control, since this one lives inside a half-height quick-add cell rather than a full form).
  recurringDaysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  recurringDayChip: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurringDayChipText: { fontSize: FontSize.xs, fontFamily: Type.label.fontFamily },
  // `cardHeaderRow`/`cardHeaderTitle` are DELETED (2026-08-21): both headers that used them are
  // `SectionRail`s now, which owns the row, the title token and the trailing cluster. See the
  // call sites. Their `flex: 1` + `minWidth: 0` note lives on SectionRail's `label` style, where
  // it does the same job for every rail in the app rather than for these two.
  // The Week card's own box (2026-08-20). Same shape SectionCard draws for every other card on
  // this screen, spelled out here because this one's header is hand-rolled rather than a
  // SectionRail — the seven days inside supply their own rails.
  weekCard: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  weekCardCollapsed: { paddingBottom: Spacing.sm },
  // Tighter than `cardStack`'s SCREEN_GAP: these seven are sections of ONE card, not seven
  // cards on a screen, and the screen's rhythm between cards would make the card read as a
  // list of cards again — the exact thing this wrapper exists to stop.
  weekDays: { gap: Spacing.sm },
  // `flex: 1` + `minWidth: 0` so the title takes the slack and the header's trailing controls
  // stay CLUSTERED at the right edge. Without it, `space-between` spreads two controls across
  // the row and the Week card's chevron floats in the middle of the line, reading as unrelated
  // to the expand button beside it. `minWidth: 0` is the half that does nothing on its own and
  // is required anyway — see components/TaskCard.tsx's note on `flex: 1` not shrinking a child.
  dayResetBtn: { alignSelf: 'center', marginTop: Spacing.sm },
  focusWrap: { gap: Spacing.lg },
  focusHero: { gap: Spacing.xs },
  focusThen: { gap: Spacing.xs },
  focusLabel: { fontSize: FontSize.xs, fontFamily: Type.label.fontFamily, textTransform: 'uppercase', letterSpacing: 0.6 },
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
  doneZone: { marginTop: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm },
  personFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  // Spacing only. It was a `theme.surface` card with a 1px border and a 4px accent left bar
  // (2026-08-21, user report + screenshot: "text-boxes have still not been fixed"). Inside a
  // SectionCard that drew a box around a box — the composer's own well, an outline around it,
  // and a coloured rail down its left edge, three edges for one control — which is exactly the
  // "no borders or separate background boxes inside of main cards" the 2026-08-18 blueprint
  // pass deleted everywhere else. The screen's hue is already on the card's badge, the field's
  // focus ring and its halo; it does not also need a rail. Don't re-add either.
  addRowSlot: { marginTop: Spacing.sm },
});
