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
 *     hint, the first-run StarterCard, the person/tag filter rows, the shared-load card, all
 *     four to-do cards, and the Goals/Earlier-days/Washed-away drawers — i.e. everything the
 *     old tabbed screen drew across its three tabs, now stacked instead of switched. Set to one
 *     of `'whenever' | 'today' | 'week' | 'recurring'` (an expanded card's body, mounted by
 *     CardExpandHost): renders ONLY that card's content, with none of the screen chrome around
 *     it — CardExpandHost's own pane already supplies a title bar, so a second one here would
 *     be a duplicate. Every OTHER piece of state below (filters, layout, drag order, energy
 *     pause) is still computed in section mode, cheaply, so an expanded card's filter/sort
 *     behaviour can never disagree with the tab's.
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
 *     through each shape — the same reasoning `collapseKey="plansToday"` already accepted
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
import SectionCard from '@/components/SectionCard';
import Surface from '@/components/Surface';
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
import CardExpandButton from '@/components/CardExpandButton';
import CardCollapseToggle from '@/components/CardCollapseToggle';
import { useCardExpand } from '@/lib/useCardExpand';
import { useCollapsedCard } from '@/lib/useCollapsedCard';
import { DayEntry } from '@/lib/dayLog';
import { useMomentsStore } from '@/store/useMomentsStore';
import { useCardState } from '@/lib/useCardState';
import { useNewSinceSeen } from '@/lib/useNewSinceSeen';
import AddRow from '@/components/AddRow';
import DraggableTaskRow from '@/components/DraggableTaskRow';
import PressableScale from '@/components/PressableScale';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import CollapsedSection from '@/components/CollapsedSection';
import GoalsEditor from '@/components/GoalsEditor';
import DayPickerSheet, { RecentDaysList } from '@/components/DayPickerSheet';
import NarratorQuote from '@/components/NarratorQuote';
import StarterCard from '@/components/StarterCard';
import StarterExampleRow from '@/components/StarterExampleRow';
import { todayStr, getWeekDates, dayOfWeekMon0 } from '@/lib/date';
import TimeBoxInput from '@/components/TimeBoxInput';
import QuickAddOptionsPanel from '@/components/QuickAddOptionsPanel';
import QuickAddOptionRow from '@/components/QuickAddOptionRow';
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
import { getDomainColor } from '@/lib/domainColor';
import { getScreenColor } from '@/lib/screenColor';

export type TodoSection = 'whenever' | 'today' | 'week' | 'recurring';

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

/** Inline "add a task" row scoped to a specific date. */
function InlineTaskAdd({
  date,
  accent,
  assigneeId = '',
  assignee = '',
  wrapped,
}: {
  date: string;
  accent: string;
  assigneeId?: string;
  assignee?: string;
  wrapped?: boolean;
}) {
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

  const wheneverHue = getScreenColor(theme, 'plans').base;
  const repeatingHue = getDomainColor(theme, 'health').accent;

  const tasks = useTaskStore((s) => s.tasks);
  const tasksLoaded = useTaskStore((s) => s.loaded);

  const layoutSpec = useSurfaceLayout('plans');
  const [todayCardState, setTodayCardState] = useCardState('plans');
  const planTimelineHorizontal = useSettingsStore((s) => s.planTimelineHorizontal);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
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

  // Expansion — one hook per card. Each card's outer View carries the `ref`; the header (or,
  // for Today's three non-SectionCard shapes, a small header row above the content) carries
  // the button. See lib/useCardExpand.ts.
  const wheneverExpand = useCardExpand('todoWhenever');
  const todayExpand = useCardExpand('todoToday');
  const weekExpand = useCardExpand('todoWeek');
  const recurringExpand = useCardExpand('todoRecurring');

  // The Week card folds as ONE thing, remembered across launches (2026-08-19, maintainer:
  // *"Mon-sun in to-do should also be collapsable together"*). Its seven weekday sections keep
  // their own local per-day fold above — this is the third axis (lib/collapsedCards.ts), the
  // card's body drawn at all, and the only one of the two that persists. Whenever/Today/
  // Recurring get theirs from `SectionCard`'s `collapseKey`; this card isn't a SectionCard (it
  // is a header row over a stack of seven), so it wires the same hook and chevron by hand.
  const [weekCollapsed, toggleWeekCollapsed] = useCollapsedCard('plansWeek');

  const showWhenever = full || section === 'whenever';
  const showToday = full || section === 'today';
  const showWeek = full || section === 'week';
  const showRecurring = full || section === 'recurring';

  const wheneverCard = showWhenever && (
    <View ref={wheneverExpand.ref} key="whenever">
      <SectionCard
        hue={wheneverHue}
        domain="task"
        label={t.tasksSectionWhenever}
        count={wheneverAll.length}
        collapseKey="plansWhenever"
        right={
          full ? (
            <CardExpandButton expanded={wheneverExpand.expanded} onExpand={wheneverExpand.onExpand} onCollapse={wheneverExpand.onCollapse} />
          ) : undefined
        }
      >
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
              </QuickAddOptionsPanel>
            }
          />
        </View>
      </SectionCard>
    </View>
  );

  // The Today card's ⤢, and the header that carries it.
  //
  // ⚠️ **The header goes INSIDE whichever card the active layout draws (2026-08-21,
  // CONSISTENCY_AUDIT.md §8/§9: *"Text and buttons must never be outside a card"* and *"The
  // fullscreen button has to be in the top right corner for each card"*).** It used to sit on
  // the screen backdrop ABOVE all four shapes — the exact defect the Week card's own note
  // records as having been fixed for Week, still shipping here: its ⤢ was in the corner of
  // nothing, and on the default (timeline) layout the word "Today" floated over a card that
  // began below it.
  //
  // It is still ONE header for all four shapes — the same node, hosted differently, because
  // each shape already draws a different container:
  //   · timeline   → passed to PlanTaskCard, which IS the card
  //   · default    → the SectionCard's OWN rail already says "Today"; it takes the ⤢ and there
  //                  is no second header (there were two on this layout before)
  //   · byPerson / focusFirst → wrapped in a Surface, the same shape the Week card uses
  const todayExpandButton = full ? (
    <CardExpandButton expanded={todayExpand.expanded} onExpand={todayExpand.onExpand} onCollapse={todayExpand.onCollapse} />
  ) : undefined;
  // Same badge/glyph pairing as Week and Whenever — see the Week card's rail below for why the
  // glyph carries the distinction and the hue does not.
  const todayHeader = <SectionRail hue={theme.accent} domain="task" icon="today" label={t.tasksTabToday} count={todayList.length} right={todayExpandButton} />;

  const todayCard = showToday && (
    <View ref={todayExpand.ref} key="today">
      <DebugNoteAnchor id="plans.dayView" label="Plans — Today">
        {groupByPerson ? (
          <Surface style={styles.weekCard}>
          {todayHeader}
          <View style={styles.cardStack}>
            {/* `embedded`: these sit inside the Today card's own Surface now, and a Surface
                inside a Surface is the nested panel the blueprint pass banned. Same shape the
                Week card's seven weekday sections take. */}
            {todayByPerson.map((group) => (
              <SectionCard key={group.personId || 'unassigned'} embedded hue={group.hue} label={group.label} count={group.tasks.length}>
                <DoneSplitList
                  tasks={group.tasks}
                  focusMode={layoutSpec.focusMode}
                  emptyQuoteKey={dayResetNonce}
                  footer={
                    <InlineTaskAdd date={today} accent={group.hue} assigneeId={group.personId} assignee={group.addName} wrapped />
                  }
                  renderCard={(tk) => (
                    <TaskCard key={tk.id} task={tk} variant="steps" tinted={tk.sharedOut} spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} newFields={newFields} onToggleDone={handleToggleDone} {...pinProps(tk)} />
                  )}
                />
              </SectionCard>
            ))}
          </View>
          </Surface>
        ) : layoutSpec.timeline ? (
          <PlanTaskCard
            header={todayHeader}
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
          <Surface style={styles.weekCard}>
          {todayHeader}
          <FocusFirstToday
            tasks={todayList}
            onToggleDone={handleToggleDone}
            spec={layoutSpec}
            newSinceIds={newSinceIds}
            newFields={newFields}
            pinProps={pinProps}
            footer={<InlineTaskAdd date={today} accent={theme.accent} assigneeId={personFilter ?? ''} assignee={addAssigneeName} wrapped />}
          />
          </Surface>
        ) : (
          // No `todayHeader` here — this card's OWN rail is the header, and it already says
          // "Today". The floating one above made this the single layout that said it twice.
          <SectionCard hue={theme.accent} domain="task" icon="today" label={t.tasksTabToday} count={todayList.length} collapseKey="plansToday" right={todayExpandButton}>
            <DoneSplitList
              tasks={todayList}
              focusMode={layoutSpec.focusMode}
              emptyQuoteKey={dayResetNonce}
              footer={<InlineTaskAdd date={today} accent={theme.accent} assigneeId={personFilter ?? ''} assignee={addAssigneeName} wrapped />}
              renderCard={(tk) => (
                <TaskCard key={tk.id} task={tk} variant="steps" tinted={tk.sharedOut} spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} newFields={newFields} onToggleDone={handleToggleDone} {...pinProps(tk)} />
              )}
            />
          </SectionCard>
        )}
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
    // The ref goes on a plain wrapper, not on the Surface: components/Surface.tsx does not
    // forward refs, and lib/useCardExpand needs a measurable OUTERMOST node. The wrapper has no
    // margin of its own, so the rect it measures is the card's own box.
    <View ref={weekExpand.ref} key="week" collapsable={false}>
      {/* Closed, the card is its header and nothing else — the same tight box `SectionCard` and
          `CollapsedSection` draw. This style is a hand-rolled copy of `SectionCard`'s `card`
          (the Week card can't BE a SectionCard: its Collapsible has to wrap seven embedded
          ones), so it needs the closed inset copied with it. */}
      <Surface style={[styles.weekCard, weekCollapsed && styles.weekCardCollapsed]}>
      {/* ⚠️ **`SectionRail`, not a hand-rolled row (2026-08-21, CONSISTENCY_AUDIT.md §2).**
          This drew its title at `Type.title.fontFamily` + `FontSize.lg` — extrabold 20 — while
          Whenever, Today and Recurring are `SectionCard`s, whose rail draws 24. So four peer
          cards on one screen shipped two title sizes, which is the report (*"some of them have
          different text size"*) at its most visible: they are stacked one under another.
            The controls are unchanged and still in the same order — chevron, then ⤢ — because
          `SectionCard` puts the fold first in its own `right` slot too. This card cannot simply
          BE a SectionCard: its body is seven embedded ones, and its `Collapsible` has to wrap
          that stack rather than a single content view. */}
      <SectionRail
        hue={theme.accent}
        // ⚠️ **A badge and a count, like its three peers (2026-08-21, CONSISTENCY_AUDIT.md §2's
        // *"some have icon while others not"*).** The rail conversion above fixed the ANATOMY
        // and left the arguments alone, so this card went on drawing a bare 10px dot and no
        // tally directly above Recurring's badge and tally — the same divergence the pass was
        // closing, one card lower. `domain="task"` is Whenever's badge; the glyph is what tells
        // the three To-do cards apart (see CardAccent.tsx's DOMAIN_ICON note), never the hue.
        domain="task"
        icon="calendar"
        label={t.todoWeekTitle}
        count={weekTaskCount}
        divider={!weekCollapsed}
        right={
          <>
            <CardCollapseToggle collapsed={weekCollapsed} onToggle={toggleWeekCollapsed} cardLabel={t.todoWeekTitle} />
            {full && (
              <CardExpandButton expanded={weekExpand.expanded} onExpand={weekExpand.onExpand} onCollapse={weekExpand.onCollapse} />
            )}
          </>
        }
      />
      <Collapsible open={!weekCollapsed}>
        <View style={styles.weekDays}>
          {weekGroups.map((group, i) => (
            <SectionCard
              key={group.date}
              embedded
              hue={theme.accent}
              label={t.dayFull[i]}
              count={group.tasks.length}
              collapsed={collapsedWeekdays.has(group.date)}
              onToggleCollapse={() => toggleWeekday(group.date)}
            >
              <DoneSplitList
                tasks={[...group.tasks].sort(byTime)}
                focusMode={layoutSpec.focusMode}
                footer={<InlineTaskAdd date={group.date} accent={theme.accent} assigneeId={personFilter ?? ''} assignee={addAssigneeName} wrapped />}
                renderCard={(tk) => (
                  <TaskCard key={tk.id + group.date} task={tk} variant="steps" tinted={tk.sharedOut} spec={layoutSpec} isNewSince={newSinceIds.has(tk.id)} newFields={newFields} onToggleDone={handleToggleDone} />
                )}
              />
            </SectionCard>
          ))}
        </View>
      </Collapsible>
      </Surface>
    </View>
  );

  const recurringCard = showRecurring && (
    <View ref={recurringExpand.ref} key="recurring">
      <DebugNoteAnchor id="plans.recurring" label="Plans — Recurring">
        <SectionCard
          hue={repeatingHue}
          domain="health"
          icon="repeat"
          label={t.tasksSectionRecurring}
          count={recurringAll.length}
          collapseKey="plansRecurring"
          right={
            full ? (
              <CardExpandButton expanded={recurringExpand.expanded} onExpand={recurringExpand.onExpand} onCollapse={recurringExpand.onCollapse} />
            ) : undefined
          }
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
        </SectionCard>
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

      {wheneverCard}
      {todayCard}
      {weekCard}
      {recurringCard}

      {full && featureSharing && <SharedTasksSection sentTasks={sharedOutAll} onToggleDone={handleToggleDone} />}

      {full && featureGoals && (
        <CollapsedSection hue={wheneverHue} domain="task" icon="flag" label={t.goals.editLinkPractical}>
          <GoalsEditor accent={wheneverHue} />
        </CollapsedSection>
      )}
      {full && featureDayLog && (
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

      {full && washedAway.length > 0 && (
        <CollapsedSection hue={wheneverHue} domain="task" icon="water-outline" label={t.tasksSectionWashedAway} count={washedAway.length}>
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
        </CollapsedSection>
      )}

      {full && <DayPickerSheet visible={dayPickerOpen} onClose={() => setDayPickerOpen(false)} accent={wheneverHue} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // No horizontal padding here, on purpose — this component is mounted two ways (the tab
  // wrapper and CardExpandHost's expanded body) and each caller already supplies its own
  // horizontal inset, the same convention components/FoodTab.tsx's `root` follows.
  content: { gap: SCREEN_GAP },
  cardStack: { gap: Spacing.sm },
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
