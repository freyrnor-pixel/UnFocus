/**
 * plans.tsx — the "Tasks" / "Oppgaver" screen: a tabbed, inline-editable list.
 *
 * A sticky tab bar (All tasks · Today · This week) over sectioned lists. Editing is
 * always available (no lock): tapping a task in the All-tasks tab opens its inline
 * editor with a Discard / Save bar (see TaskCard). New tasks are made through blank
 * *draft* cards — a "+" bubble sits under every task, and brand-new users start with one
 * empty draft row already open — and only become real store rows on Save. Today / This
 * week expand a task to its steps only (no settings); the Today section sits inside its
 * own card. The Home "Today's plans" preview keeps the unchanged PlanTaskCard day-view.
 * Every section (Shared out / Whenever / Recurring on All tasks; Whenever on Today/This
 * week; each weekday on This week) always renders, showing an empty message instead of
 * disappearing when it has no tasks — kept consistent with Shopping's always-visible
 * list layout (app/(tabs)/shopping.tsx). The Whenever section also carries a dashed
 * "Make New" card matching Shopping's styles.newListCard look.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/SharedRequestsSection,
 *             components/TaskCard, components/AddDivider, components/PressableScale,
 *             constants/theme, lib/date, lib/i18n, lib/useAppTheme, store/useTaskStore
 *   Used by → Expo Router route "/plans" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → reads/writes useTaskStore (tasks/steps); SharedRequestsSection reads
 *             useSharedStore internally for incoming shares
 *
 * Edit notes:
 *   - No lock: the old module-session `taskLockedSession` is gone. TaskCard's Discard/Save
 *     bar is the commit point for edits; creation goes through local `drafts` (temp ids),
 *     persisted via addTask() only on Save.
 *   - Section selectors: Whenever = recurring 'none' & !sharedOut (All tab includes dated
 *     one-offs); Recurring = recurring !== 'none' & !sharedOut; Shared out = sharedOut. In
 *     Today / This week the "Whenever" section is undated tasks only, and shared tasks are
 *     tinted instead of getting their own section.
 *   - New tasks are always created in Whenever (undated, non-recurring); the editor can
 *     then promote them (date / repeat).
 *   - **Always-visible sections + Make New card (2026-07-09)**: sections used to
 *     conditionally hide when empty (`.length > 0 && ...`); now every named section
 *     always renders with a `styles.sectionEmpty` placeholder (new i18n keys
 *     `tasksSection*Empty` / `tasksDayEmpty`). The Whenever section's bottom "+ New task"
 *     dashed card (`styles.newTaskCard`) started as a byte-for-byte match of Shopping's
 *     `styles.newListCard`; it now has a shorter `paddingVertical` (2/3 the height) per the
 *     "New task" card resize — border/radius/font sizes are unchanged, so it still reads as
 *     the same dashed-card family. Shopping's card is untouched.
 *   - **Section header cards**: `sectionHeader()`'s row now sits on a `theme.surfaceMuted`
 *     card (padding + radius) so the label/rule stay legible over the particle background —
 *     matches the same fix in app/(tabs)/shopping.tsx.
 *   - Store hydration happens once at startup in app/_layout.tsx; this screen's focus effect
 *     only seeds the first-run blank draft (see below).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import SharedRequestsSection from '@/components/SharedRequestsSection';
import TaskCard from '@/components/TaskCard';
import AddDivider from '@/components/AddDivider';
import PressableScale from '@/components/PressableScale';
import { todayStr, getWeekDates } from '@/lib/date';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { Task, useTaskStore } from '@/store/useTaskStore';
import { generateId } from '@/lib/id';
import { Fonts, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';

type Tab = 'all' | 'today' | 'week';

/** Time-order comparator: timed tasks first (by HH:MM), then untimed by title. */
function byTime(a: Task, b: Task): number {
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return a.title.localeCompare(b.title);
}

/** A blank, undated, non-recurring "Whenever" draft — a local editing card, not yet a store row. */
function blankDraft(date: string): Task {
  return {
    id: 'draft-' + generateId(),
    title: '',
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
    importance: 'regular',
    sortOrder: 0,
    hint: '',
    followsTaskId: null,
    hasStartDate: false,
    sharedOut: false,
    steps: [],
  };
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
  const addStep = useTaskStore((s) => s.addStep);

  const [tab, setTab] = useState<Tab>('all');
  const [hintOpen, setHintOpen] = useState(false);
  // Local blank draft cards awaiting a first Save (creation flow — no store row yet).
  const [drafts, setDrafts] = useState<Task[]>([]);
  const didSeedRef = useRef(false);

  const today = todayStr();

  useFocusEffect(
    useCallback(() => {
      // "Empty row to begin with": brand-new users (no tasks after load) get one open
      // draft. Seed at most once per mount so discarding it doesn't loop it back.
      if (!didSeedRef.current && useTaskStore.getState().tasks.length === 0) {
        didSeedRef.current = true;
        setDrafts([blankDraft(todayStr())]);
      }
      return () => setHintOpen(false);
    }, [])
  );

  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const weekStart = weekDates[0];

  // ── Section selectors ──
  const wheneverAll = useMemo(
    () => tasks.filter((tk) => tk.recurring === 'none' && !tk.sharedOut),
    [tasks]
  );
  const recurringAll = useMemo(
    () => tasks.filter((tk) => tk.recurring !== 'none' && !tk.sharedOut),
    [tasks]
  );
  const sharedOutAll = useMemo(() => tasks.filter((tk) => tk.sharedOut), [tasks]);
  const undatedWhenever = useMemo(
    () => tasks.filter((tk) => tk.recurring === 'none' && !tk.hasStartDate && !tk.sharedOut),
    [tasks]
  );

  const todayList = useMemo(
    () => tasksForDate(today).filter((tk) => tk.hasStartDate || tk.recurring !== 'none').sort(byTime),
    [tasksForDate, today, tasks]
  );
  const weekGroups = useMemo(() => tasksForWeek(weekStart), [tasksForWeek, weekStart, tasks]);

  const addDraft = useCallback(() => setDrafts((d) => [...d, blankDraft(today)]), [today]);
  const discardDraft = useCallback((id: string) => setDrafts((d) => d.filter((x) => x.id !== id)), []);
  const commitDraft = useCallback(
    (committed: Task) => {
      const created = addTask({
        title: committed.title,
        date: committed.date,
        time: committed.time,
        finishTime: committed.finishTime,
        taskType: committed.taskType,
        done: false,
        recurring: committed.recurring,
        recurringDays: committed.recurringDays,
        weekInterval: committed.weekInterval,
        monthlyMode: committed.monthlyMode,
        monthDay: committed.monthDay,
        monthOrdinal: committed.monthOrdinal,
        monthWeekday: committed.monthWeekday,
        importance: committed.importance,
        sortOrder: 0,
        hasStartDate: committed.hasStartDate,
      });
      // Steps added while the draft was still local (isNew) buffer onto committed.steps —
      // they can't hit SQLite until the real task row (with a real id) exists.
      committed.steps.forEach((step) => addStep(created.id, step.title));
      setDrafts((d) => d.filter((x) => x.id !== committed.id));
    },
    [addTask, addStep]
  );

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

        {/* ── ALL TASKS ── */}
        {tab === 'all' && (
          <>
            <SharedRequestsSection kind="task" />

            <View style={styles.section}>
              {sectionHeader(t.tasksSectionSharedOut, theme.textMuted)}
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
              {wheneverAll.length === 0 && drafts.length === 0 && (
                <Text style={[styles.sectionEmpty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>{t.tasksSectionWheneverEmpty}</Text>
              )}
              <View style={styles.cardStack}>
                {wheneverAll.map((tk) => (
                  <View key={tk.id}>
                    <TaskCard task={tk} showDelete showShareOut onToggleDone={(x) => toggle(x.id)} />
                    <AddDivider onPress={addDraft} />
                  </View>
                ))}
                {drafts.map((d) => (
                  <TaskCard
                    key={d.id}
                    task={d}
                    isNew
                    onCommitNew={commitDraft}
                    onDiscardNew={() => discardDraft(d.id)}
                    onToggleDone={() => {}}
                  />
                ))}
              </View>
              {/* "Make New" card — same dashed-card affordance as Shopping's "Create a new
                  list" (app/(tabs)/shopping.tsx styles.newListCard), always visible so the
                  two list-style screens stay consistent. */}
              <PressableScale
                style={[styles.newTaskCard, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}
                onPress={addDraft}
                scaleTo={0.97}
              >
                <Text style={[styles.newTaskPlus, { color: theme.accent }]}>+</Text>
                <Text style={[styles.newTaskText, { color: theme.accent }]}>{t.newTask}</Text>
              </PressableScale>
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
  // 2/3 the height of shopping.tsx's styles.newListCard (padding only — same border/radius/
  // font sizes) — intentionally diverges from the old byte-for-byte match per the "New task"
  // card resize; keep shopping's newListCard untouched.
  newTaskCard: { borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.lg, paddingVertical: Spacing.sm, alignItems: 'center', gap: 4, marginTop: Spacing.sm },
  newTaskPlus: { fontSize: FontSize.xl, fontFamily: Fonts.bold },
  newTaskText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  todayCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
});
