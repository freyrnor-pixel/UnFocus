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
 * preview keeps the unchanged PlanTaskCard day-view. Every section (Shared out / Whenever /
 * Recurring on All tasks; Whenever on Today/This week; each weekday on This week) always
 * renders, showing an empty message instead of disappearing when it has no tasks — kept
 * consistent with Shopping's always-visible list layout (app/(tabs)/shopping.tsx). Within
 * every Today/This-week section, `<DoneSplitList>` splits tasks into unfinished (shown
 * plainly) + finished (collapsed behind a "Finished (n)" zone), mirroring the Home-preview
 * done zone in components/PlanTaskCard.tsx.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/SharedTasksSection,
 *             components/SectionRail, components/SectionCard, components/TaskCard, components/AddRow,
 *             components/PressableScale, components/Collapsible + components/AnimatedChevron
 *             (animated "Finished (n)" done-zone reveal), components/TabBoxHighlight, constants/theme,
 *             expo-router (useLocalSearchParams — `tab`/`expandTaskId`, see below), lib/date,
 *             lib/domainColor, lib/haptics,
 *             lib/i18n, lib/useAppTheme, lib/useFirstVisitHint, lib/screenColor, store/useTaskStore,
 *             store/useSettingsStore
 *   Used by → Expo Router route "/plans" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx;
 *             also reached with `?tab=all&expandTaskId=…` from app/notes.tsx's "Add to plans"
 *             (UX audit B1, 2026-07-23 — creates the task, then lands here with its editor open)
 *   Data    → reads/writes useTaskStore (tasks/steps); SharedTasksSection reads useSharedStore
 *             internally for incoming shares + accepts the sharedOut tasks as its "sent" half
 *
 * Edit notes:
 *   - **Tab bar (2026-07-20, shared component)**: the sticky Today/This week/All tasks
 *     switcher's active indicator is `components/TabBoxHighlight.tsx` — always renders a
 *     bordered box behind the label (white `theme.surface` fill + `theme.border` edge at
 *     rest, crossfading to a tinted `theme.accent` fill + border when active) instead of the
 *     old "box only appears when active" look. Same shared component as
 *     app/(tabs)/shopping.tsx and app/settings.tsx's tab bars.
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
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import HintCard from '@/components/HintCard';
import DebugNoteAnchor from '@/components/DebugNoteAnchor';
import SharedTasksSection from '@/components/SharedTasksSection';
import SectionRail from '@/components/SectionRail';
import SectionCard from '@/components/SectionCard';
import TaskCard from '@/components/TaskCard';
import AddRow from '@/components/AddRow';
import PressableScale from '@/components/PressableScale';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import TabBoxHighlight from '@/components/TabBoxHighlight';
import { todayStr, getWeekDates } from '@/lib/date';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useFirstVisitHint } from '@/lib/useFirstVisitHint';
import { tap } from '@/lib/haptics';
import { Task, useTaskStore } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Fonts, FontSize, Radius, Spacing, Type } from '@/constants/theme';
import { Spring } from '@/constants/motion';
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
}) {
  const theme = useAppTheme();
  const t = useT();
  const [doneOpen, setDoneOpen] = useState(false);
  const unfinished = useMemo(() => tasks.filter((tk) => !tk.done), [tasks]);
  const finished = useMemo(() => tasks.filter((tk) => tk.done), [tasks]);

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
      {unfinished.length > 0 && <View style={styles.cardStack}>{unfinished.map(renderCard)}</View>}
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
  assignee = '',
  wrapped,
}: {
  date: string;
  accent: string;
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
      assignee,
    });
    setValue('');
  }, [value, date, assignee, addTask]);

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

const STICKY_HEIGHT = 56;

export default function TasksScreen() {
  const theme = useAppTheme();
  const t = useT();
  // Section hues (color-rail redesign): each list section carries a stable domain accent —
  // Whenever = task (blue), Repeating = meal (orange — was plan/indigo, too close to
  // Whenever's blue to tell apart at a glance; 2026-07-14). Both tokens have light + dark
  // variants, so the rail/dot/label stay distinct and legible in both modes. Shared handles
  // its own (shop/green) hue inside SharedTasksSection.
  const wheneverHue = getDomainColor(theme, 'task').accent;
  const repeatingHue = getDomainColor(theme, 'meal').accent;

  const tasks = useTaskStore((s) => s.tasks);
  const tasksForDate = useTaskStore((s) => s.tasksForDate);
  const tasksForWeek = useTaskStore((s) => s.tasksForWeek);
  const toggle = useTaskStore((s) => s.toggle);
  const addTask = useTaskStore((s) => s.add);
  // Stable handler so the memoised TaskCards / SharedTasksSection don't get a fresh
  // onToggleDone closure every render (which would defeat their React.memo).
  const handleToggleDone = useCallback((task: Task) => toggle(task.id), [toggle]);

  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled);
  const childProfiles = useSettingsStore((s) => s.childProfiles);
  const showPeople = peopleModeEnabled && childProfiles.length > 0;
  // First-run hint embeds the work-mode toggle the old wizard step 2 collected.
  const workModeEnabled = useSettingsStore((s) => s.workModeEnabled);
  const updateSettings = useSettingsStore((s) => s.update);

  const [tab, setTab] = useState<Tab>('today');
  const [hintOpen, setHintOpen] = useFirstVisitHint('plans');
  // Person filter (People/family mode): null = Everyone, '' = Me, name = that profile.
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  // Inline "add a row" input for the Whenever section — the one add affordance on this screen.
  const [wheneverInput, setWheneverInput] = useState('');

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

  const today = todayStr();

  // Person filter predicate — identity unless People/family mode is on AND a specific
  // person (not "Everyone") is selected.
  const matchPerson = useCallback(
    (tk: Task) => !showPeople || personFilter === null || (tk.assignee || '') === personFilter,
    [showPeople, personFilter]
  );

  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const weekStart = weekDates[0];

  // ── Section selectors ──
  const wheneverAll = useMemo(
    () => tasks.filter((tk) => tk.recurring === 'none' && !tk.sharedOut && matchPerson(tk)),
    [tasks, matchPerson]
  );
  const recurringAll = useMemo(
    () => tasks.filter((tk) => tk.recurring !== 'none' && !tk.sharedOut && matchPerson(tk)),
    [tasks, matchPerson]
  );
  const sharedOutAll = useMemo(() => tasks.filter((tk) => tk.sharedOut && matchPerson(tk)), [tasks, matchPerson]);
  const undatedWhenever = useMemo(
    () => tasks.filter((tk) => tk.recurring === 'none' && !tk.hasStartDate && !tk.sharedOut && matchPerson(tk)),
    [tasks, matchPerson]
  );

  const todayList = useMemo(
    () => tasksForDate(today).filter((tk) => (tk.hasStartDate || tk.recurring !== 'none') && matchPerson(tk)).sort(byTime),
    [tasksForDate, today, tasks, matchPerson]
  );
  const weekGroups = useMemo(
    () => tasksForWeek(weekStart).map((g) => ({ ...g, tasks: g.tasks.filter(matchPerson) })),
    [tasksForWeek, weekStart, tasks, matchPerson]
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

  const stickyBelowHeader = (
    // Frosted-glass strip (same overlay Surface as the header): the ambient background reads
    // softly through the frost AROUND the opaque tab chips, and content scrolling behind the
    // sticky strip blurs instead of showing through raw (2026-07-20). borderRadius:0 = edge-to-edge.
    <Surface surfaceContext="overlay" style={[styles.stickyBar, styles.stickyGlass]}>
      <View style={styles.tabsRow}>
        {(['today', 'week', 'all'] as Tab[]).map((tabOption) => {
          const isActive = tab === tabOption;
          const label =
            tabOption === 'all' ? t.tasksTabAll : tabOption === 'today' ? t.tasksTabToday : t.tasksTabWeek;
          return (
            <PressableScale
              key={tabOption}
              style={styles.tab}
              onPress={() => setTab(tabOption)}
              scaleTo={0.97}
            >
              <TabBoxHighlight active={isActive} />
              <Text style={[styles.tabText, { color: isActive ? theme.accent : theme.textMuted }]}>{label}</Text>
            </PressableScale>
          );
        })}
      </View>
    </Surface>
  );

  return (
    <ScreenScaffold
      title={t.tasksTitle}
      tier="site"
      bottomNav={false}
      ownBackground={false}
      screenColor={getScreenColor(theme, 'plans').base}
      stickyGapColor={theme.surface}
      stickyBelowHeader={stickyBelowHeader}
      stickyBelowHeaderHeight={STICKY_HEIGHT}
      infoActive={hintOpen}
      onInfoToggle={() => setHintOpen((v) => !v)}
    >
      <View style={styles.content}>
        <HintCard text={t.hints.plans.text} open={hintOpen} noPill>
          <View style={[styles.hintSetting, { borderTopColor: theme.hintBorder }]}>
            <View style={styles.hintSettingText}>
              <Text style={[styles.hintSettingLabel, { color: theme.text }]}>{t.startWithWorkMode}</Text>
              <Text style={[styles.hintSettingHint, { color: theme.textMuted }]}>{t.canChangeAnytime}</Text>
            </View>
            <Switch
              value={workModeEnabled}
              onValueChange={(v) => updateSettings({ workModeEnabled: v })}
              trackColor={{ false: theme.border, true: theme.accentSoft }}
              thumbColor={workModeEnabled ? theme.accent : theme.textMuted}
            />
          </View>
        </HintCard>

        {/* Person filter (People/family mode) — Everyone + Me + each profile. */}
        <Collapsible open={showPeople}>
          <View style={styles.personFilterRow}>
            {([null, '', ...childProfiles] as (string | null)[]).map((p) => {
              const active = personFilter === p;
              const label = p === null ? t.peopleMode.filterAll : p === '' ? t.habitForMe : p;
              return (
                <PressableScale
                  key={p === null ? '__all__' : p || '__me__'}
                  style={[styles.personChip, { backgroundColor: active ? theme.accent : theme.surfaceMuted, borderColor: active ? theme.accent : theme.border }]}
                  onPress={() => setPersonFilter(p)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  scaleTo={0.96}
                >
                  <Text style={[styles.personChipText, { color: active ? theme.accentInk : theme.text }]}>{label}</Text>
                </PressableScale>
              );
            })}
          </View>
        </Collapsible>

        {/* ── ALL TASKS (order: Whenever → Repeating → Shared) ── */}
        {tab === 'all' && (
          <>
            <SectionCard hue={wheneverHue} label={t.tasksSectionWhenever} count={wheneverAll.length}>
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
              <SectionCard hue={repeatingHue} label={t.tasksSectionRecurring} count={recurringAll.length}>
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

            <SharedTasksSection sentTasks={sharedOutAll} onToggleDone={handleToggleDone} />
          </>
        )}

        {/* ── TODAY ── */}
        {tab === 'today' && (
          <>
            {/* Whenever always sits on top (debug-note 2026-07-21) — undated tasks lead, the
                dated Today section follows. */}
            <SectionCard hue={wheneverHue} label={t.tasksSectionWhenever} count={undatedWhenever.length}>
              <DoneSplitList
                tasks={undatedWhenever}
                emptyText={t.tasksSectionWheneverEmpty}
                renderCard={(tk) => (
                  <TaskCard key={tk.id} task={tk} variant="steps" onToggleDone={handleToggleDone} />
                )}
              />
            </SectionCard>

            {/* Debug notes: anchor the day-view section (not its inner task rows). */}
            <DebugNoteAnchor id="plans.dayView" label="Plans — Today">
              <SectionCard hue={theme.accent} label={t.tasksTabToday} count={todayList.length}>
                {/* Add row sits between the tasks and the collapsed "Done" zone (DoneSplitList
                    footer) so the active/white containers stay grouped and green "Done" is last. */}
                <DoneSplitList
                  tasks={todayList}
                  emptyText={t.noPlansToday}
                  footer={<InlineTaskAdd date={today} accent={theme.accent} assignee={personFilter ?? ''} wrapped />}
                  renderCard={(tk) => (
                    <TaskCard key={tk.id} task={tk} variant="steps" tinted={tk.sharedOut} onToggleDone={handleToggleDone} />
                  )}
                />
              </SectionCard>
            </DebugNoteAnchor>
          </>
        )}

        {/* ── THIS WEEK ── */}
        {tab === 'week' && (
          <>
            {/* Whenever always sits on top (debug-note 2026-07-21) — before the weekday groups. */}
            <SectionCard hue={wheneverHue} label={t.tasksSectionWhenever} count={undatedWhenever.length}>
              <DoneSplitList
                tasks={undatedWhenever}
                emptyText={t.tasksSectionWheneverEmpty}
                renderCard={(tk) => (
                  <TaskCard key={tk.id} task={tk} variant="steps" onToggleDone={handleToggleDone} />
                )}
              />
            </SectionCard>

            {weekGroups.map((group, i) => (
              <SectionCard key={group.date} hue={theme.accent} label={t.dayFull[i]} count={group.tasks.length}>
                {/* Add row between tasks and the collapsed "Done" zone — same grouping as Today. */}
                <DoneSplitList
                  tasks={[...group.tasks].sort(byTime)}
                  emptyText={t.tasksDayEmpty}
                  footer={<InlineTaskAdd date={group.date} accent={theme.accent} assignee={personFilter ?? ''} wrapped />}
                  renderCard={(tk) => (
                    <TaskCard key={tk.id + group.date} task={tk} variant="steps" tinted={tk.sharedOut} onToggleDone={handleToggleDone} />
                  )}
                />
              </SectionCard>
            ))}
          </>
        )}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md },
  // Embedded first-run setting inside the ⓘ hint (work mode).
  hintSetting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
  hintSettingText: { flex: 1 },
  hintSettingLabel: { fontFamily: Type.label.fontFamily, fontSize: Type.label.size },
  hintSettingHint: { fontSize: FontSize.xs, marginTop: 2 },
  stickyBar: { flex: 1, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  // Edge-to-edge frosted strip (Surface overlay) — square corners, no floating-card rounding.
  stickyGlass: { borderRadius: 0 },
  tabsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: Radius.sm,
  },
  // Bumped from Type.label.size (14) — read as too small once the tab got a visible
  // rounded frame around it (2026-07-19 visual-audit). includeFontPadding/textAlignVertical
  // fix Android's Nunito vertical-centering offset inside the line box (same fix as
  // ScreenHeader.tsx's title — see HEADER_CLIP_DEBUG.md).
  tabText: {
    fontFamily: Type.label.fontFamily,
    fontSize: FontSize.md,
    lineHeight: Math.round(FontSize.md * Type.label.line),
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
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
