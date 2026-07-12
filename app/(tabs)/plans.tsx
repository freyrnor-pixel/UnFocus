/**
 * plans.tsx — the "Tasks" / "Oppgaver" screen: a tabbed, inline-editable list.
 *
 * A sticky tab bar (All tasks · Today · This week) over sectioned lists. Editing is
 * always available (no lock): tapping a task in the All-tasks tab opens its inline
 * editor with a Discard / Save bar (see TaskCard). New tasks are made through the shared
 * inline AddRow at the bottom of the Whenever section — the one add-a-row affordance on
 * this screen — which creates an undated, non-recurring task on submit; the editor can
 * then promote it (date / repeat / steps). Today / This week expand a task to its steps
 * only (no settings); the Today section sits inside its own card. The Home "Today's plans"
 * preview keeps the unchanged PlanTaskCard day-view. Every section (Shared out / Whenever /
 * Recurring on All tasks; Whenever on Today/This week; each weekday on This week) always
 * renders, showing an empty message instead of disappearing when it has no tasks — kept
 * consistent with Shopping's always-visible list layout (app/(tabs)/shopping.tsx).
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/SharedRequestsSection,
 *             components/TaskCard, components/AddRow, components/Surface, components/PressableScale,
 *             constants/theme, lib/date, lib/i18n, lib/useAppTheme, store/useTaskStore
 *   Used by → Expo Router route "/plans" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → reads/writes useTaskStore (tasks/steps); SharedRequestsSection reads
 *             useSharedStore internally for incoming shares
 *
 * Edit notes:
 *   - No lock: the old module-session `taskLockedSession` is gone. TaskCard's Discard/Save
 *     bar is the commit point for edits; creation goes through the Whenever AddRow, which
 *     calls addTask() directly on submit (no local draft rows). TaskCard still supports an
 *     `isNew` draft mode but plans no longer uses it (candidate for later cleanup).
 *   - Section selectors: Whenever = recurring 'none' & !sharedOut (All tab includes dated
 *     one-offs); Recurring = recurring !== 'none' & !sharedOut; Shared out = sharedOut. In
 *     Today / This week the "Whenever" section is undated tasks only, and shared tasks are
 *     tinted instead of getting their own section.
 *   - New tasks are always created in Whenever (undated, non-recurring); the editor can
 *     then promote them (date / repeat).
 *   - **Always-visible sections**: sections used to conditionally hide when empty
 *     (`.length > 0 && ...`); now every named section always renders with a
 *     `styles.sectionEmpty` placeholder (i18n keys `tasksSection*Empty` / `tasksDayEmpty`).
 *   - **Add affordance (design-consistency pass)**: the old per-row `AddDivider` and the
 *     dashed "Make New" card were replaced by a single shared `AddRow` (empty row + "+")
 *     in a Surface at the bottom of the Whenever section — one add-a-row shape app-wide.
 *   - **Section header cards**: `sectionHeader()`'s row now sits on a `theme.surfaceMuted`
 *     card (padding + radius) so the label/rule stay legible over the particle background —
 *     matches the same fix in app/(tabs)/shopping.tsx.
 *   - Store hydration happens once at startup in app/_layout.tsx; this screen's focus effect
 *     only seeds the first-run blank draft (see below).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import SharedRequestsSection from '@/components/SharedRequestsSection';
import TaskCard from '@/components/TaskCard';
import AddRow from '@/components/AddRow';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { todayStr, getWeekDates } from '@/lib/date';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { Task, useTaskStore } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Fonts, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';

type Tab = 'all' | 'today' | 'week';

/** Time-order comparator: timed tasks first (by HH:MM), then untimed by title. */
function byTime(a: Task, b: Task): number {
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return a.title.localeCompare(b.title);
}


const STICKY_HEIGHT = 56;

export default function TasksScreen() {
  const theme = useAppTheme();
  const t = useT();

  const tasks = useTaskStore((s) => s.tasks);
  const tasksForDate = useTaskStore((s) => s.tasksForDate);
  const tasksForWeek = useTaskStore((s) => s.tasksForWeek);
  const toggle = useTaskStore((s) => s.toggle);
  const addTask = useTaskStore((s) => s.add);

  const peopleModeEnabled = useSettingsStore((s) => s.peopleModeEnabled);
  const childProfiles = useSettingsStore((s) => s.childProfiles);
  const showPeople = peopleModeEnabled && childProfiles.length > 0;

  const [tab, setTab] = useState<Tab>('all');
  const [hintOpen, setHintOpen] = useState(false);
  // Person filter (People/family mode): null = Everyone, '' = Me, name = that profile.
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  // Inline "add a row" input for the Whenever section — the one add affordance on this screen.
  const [wheneverInput, setWheneverInput] = useState('');

  const today = todayStr();

  // Person filter predicate — identity unless People/family mode is on AND a specific
  // person (not "Everyone") is selected.
  const matchPerson = useCallback(
    (tk: Task) => !showPeople || personFilter === null || (tk.assignee || '') === personFilter,
    [showPeople, personFilter]
  );

  useFocusEffect(
    useCallback(() => {
      return () => setHintOpen(false);
    }, [])
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
      importance: 'regular',
      sortOrder: 0,
      hasStartDate: false,
      assignee: '',
    });
    setWheneverInput('');
  }, [wheneverInput, addTask, today]);

  // Decision 043 rule 2 fixed anatomy: Fonts.semibold/FontSize.lg title, Spacing.xl above
  // (styles.section's marginTop) / Spacing.sm below (sectionHeaderRow's marginBottom).
  // `bare` skips the legibility pill when the caller already sits on an opaque card
  // (Today tab's todayCard) — two overlapping flat-color backgrounds would be redundant.
  // `strongBg` (Whenever/Recurring only, 2026-07-12) swaps the near-invisible surfaceMuted
  // pill for the label colour's tinted "Soft" token plus a matching border and Shadow.card —
  // those two sections needed more contrast/depth than the rest to stand out as the screen's
  // primary lists.
  function sectionHeader(label: string, color: string, bare = false, strongBg?: string) {
    return (
      <View
        style={[
          styles.sectionHeaderRow,
          !bare && { backgroundColor: theme.surfaceMuted, marginBottom: Spacing.sm },
          strongBg && { backgroundColor: strongBg, borderWidth: 1, borderColor: color, ...Shadow.card },
        ]}
      >
        <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
      </View>
    );
  }

  const stickyBelowHeader = (
    <View style={[styles.stickyBar, { backgroundColor: theme.bg }]}>
      <View style={styles.tabsRow}>
        {(['all', 'today', 'week'] as Tab[]).map((tabOption) => {
          const isActive = tab === tabOption;
          const label =
            tabOption === 'all' ? t.tasksTabAll : tabOption === 'today' ? t.tasksTabToday : t.tasksTabWeek;
          return (
            <PressableScale
              key={tabOption}
              style={[styles.tab, isActive && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
              onPress={() => setTab(tabOption)}
              scaleTo={0.97}
            >
              <Text style={[styles.tabText, { color: isActive ? theme.accent : theme.textMuted }]}>{label}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );

  return (
    <ScreenScaffold
      title={t.tasksTitle}
      tier="site"
      bottomNav={false}
      ownBackground={false}
      stickyBelowHeader={stickyBelowHeader}
      stickyBelowHeaderHeight={STICKY_HEIGHT}
      infoActive={hintOpen}
      onInfoToggle={() => setHintOpen((v) => !v)}
    >
      <View style={styles.content}>
        <HintCard text={t.hints.plans.text} open={hintOpen} noPill />

        {/* Person filter (People/family mode) — Everyone + Me + each profile. */}
        {showPeople && (
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
        )}

        {/* ── ALL TASKS ── */}
        {tab === 'all' && (
          <>
            <SharedRequestsSection kind="task" />

            <View style={styles.section}>
              {sectionHeader(t.tasksSectionSharedOut, theme.featShop, false, theme.surfaceMuted)}
              {sharedOutAll.length === 0 ? (
                <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>{t.tasksSectionSharedOutEmpty}</Text>
              ) : (
                <View style={styles.cardStack}>
                  {sharedOutAll.map((tk) => (
                    <TaskCard key={tk.id} task={tk} tinted onToggleDone={(x) => toggle(x.id)} />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              {sectionHeader(t.tasksSectionWhenever, theme.good, false, theme.goodSoft)}
              {wheneverAll.length === 0 && (
                <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>{t.tasksSectionWheneverEmpty}</Text>
              )}
              {wheneverAll.length > 0 && (
                <View style={styles.cardStack}>
                  {wheneverAll.map((tk) => (
                    <TaskCard key={tk.id} task={tk} showDelete showShareOut onToggleDone={(x) => toggle(x.id)} />
                  ))}
                </View>
              )}
              {/* The one add-a-row affordance: an inline empty row with a "+" that saves a new
                  Whenever task into this section (replaces the old per-row AddDivider + the
                  dashed "Make New" card). Mounted in a Surface so it reads as a card of the
                  Whenever list rather than floating on the particle background. */}
              <Surface style={styles.addRowCard}>
                <AddRow
                  placeholder={t.newTask}
                  value={wheneverInput}
                  onChangeText={setWheneverInput}
                  onSubmit={commitWhenever}
                  accent={theme.good}
                  showDivider={false}
                  accessibilityLabel={t.newTask}
                />
              </Surface>
            </View>

            <View style={styles.section}>
              {sectionHeader(t.tasksSectionRecurring, theme.accent, false, theme.accentSoft)}
              {recurringAll.length === 0 ? (
                <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>{t.tasksSectionRecurringEmpty}</Text>
              ) : (
                <View style={styles.cardStack}>
                  {recurringAll.map((tk) => (
                    <TaskCard key={tk.id} task={tk} showDelete showShareOut onToggleDone={(x) => toggle(x.id)} />
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {/* ── TODAY ── */}
        {tab === 'today' && (
          <>
            <View style={[styles.todayCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
              {sectionHeader(t.tasksTabToday, theme.accent, true)}
              {todayList.length === 0 ? (
                <Text style={[styles.sectionEmpty, { color: theme.textMuted }]}>{t.noPlansToday}</Text>
              ) : (
                <View style={styles.cardStack}>
                  {todayList.map((tk) => (
                    <TaskCard key={tk.id} task={tk} variant="steps" tinted={tk.sharedOut} onToggleDone={(x) => toggle(x.id)} />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              {sectionHeader(t.tasksSectionWhenever, theme.good, false, theme.goodSoft)}
              {undatedWhenever.length === 0 ? (
                <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>{t.tasksSectionWheneverEmpty}</Text>
              ) : (
                <View style={styles.cardStack}>
                  {undatedWhenever.map((tk) => (
                    <TaskCard key={tk.id} task={tk} variant="steps" onToggleDone={(x) => toggle(x.id)} />
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {/* ── THIS WEEK ── */}
        {tab === 'week' && (
          <>
            {weekGroups.map((group, i) => (
              <View key={group.date} style={styles.section}>
                {sectionHeader(t.dayFull[i], theme.accent)}
                {group.tasks.length === 0 ? (
                  <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>{t.tasksDayEmpty}</Text>
                ) : (
                  <View style={styles.cardStack}>
                    {group.tasks.sort(byTime).map((tk) => (
                      <TaskCard key={tk.id + group.date} task={tk} variant="steps" tinted={tk.sharedOut} onToggleDone={(x) => toggle(x.id)} />
                    ))}
                  </View>
                )}
              </View>
            ))}

            <View style={styles.section}>
              {sectionHeader(t.tasksSectionWhenever, theme.good, false, theme.goodSoft)}
              {undatedWhenever.length === 0 ? (
                <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>{t.tasksSectionWheneverEmpty}</Text>
              ) : (
                <View style={styles.cardStack}>
                  {undatedWhenever.map((tk) => (
                    <TaskCard key={tk.id} task={tk} variant="steps" onToggleDone={(x) => toggle(x.id)} />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md },
  stickyBar: { flex: 1, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  tabsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  // Decision 043 rule 2: Spacing.xl above every section; below-header spacing comes from
  // sectionHeader()'s own marginBottom (non-bare) or the caller's card gap (bare), so this
  // wrapper carries no gap of its own (avoids doubling up with either).
  section: { marginTop: Spacing.xl },
  // Card behind the label so it stays legible over the busy background (skipped via
  // `bare` when the caller already provides an opaque card, e.g. todayCard).
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.sm },
  sectionLabel: { fontSize: FontSize.lg, fontFamily: Fonts.semibold },
  // Visual-audit 2026-07-11: was bare muted text floating on the particle background
  // (low contrast in practice even though the token itself passes AA) — a card behind
  // it, matching HomeNotesCard's empty-state treatment, gives it real footing. The
  // Today tab's own instance (inside todayCard) stays bare — that one already sits on
  // a card, so a second background would double up (Decision 043 rule 1).
  sectionEmpty: {
    fontSize: FontSize.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardStack: { gap: Spacing.sm },
  personFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  personChip: { borderRadius: Radius.full, borderWidth: 1, paddingVertical: 6, paddingHorizontal: Spacing.md, minHeight: 34, justifyContent: 'center' },
  personChipText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  // Surface wrapper for the Whenever AddRow — Spacing.md inner padding so the input isn't
  // edge-to-edge; sits just under the task list (marginTop) as its appended add-a-row.
  addRowCard: { paddingHorizontal: Spacing.md, marginTop: Spacing.sm },
  todayCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
});
