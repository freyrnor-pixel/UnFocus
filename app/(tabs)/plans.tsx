/**
 * plans.tsx — the "Tasks" / "Oppgaver" screen: a tabbed, lock-gated, inline-editable list.
 *
 * Rebuilt (2026-07-08) from the old day-view rail into a Shopping-style screen: a sticky
 * tab bar (All tasks · Today · This week) with a global edit lock, sectioned lists, and
 * inline expand-to-edit task cards (no pop-up editor, no "+" FAB). The Home "Today's plans"
 * preview keeps rendering the unchanged PlanTaskCard day-view — only this screen changed.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/SharedRequestsSection,
 *             components/TaskCard, components/IconButton, constants/theme, lib/db, lib/date,
 *             lib/i18n, lib/useAppTheme, store/useTaskStore, store/useSettingsStore, store/useSharedStore
 *   Used by → Expo Router route "/plans" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx
 *   Data    → reads/writes useTaskStore (tasks/steps); reads useSharedStore (incoming shares);
 *             reads useSettingsStore for theme hydration
 *
 * Edit notes:
 *   - Lock: `taskLockedSession` is a module-level session lock (mirrors shopping.tsx's
 *     catalogLockedSession) — survives in-session navigation, re-locks on cold start. It gates
 *     editing in the All-tasks tab only; Today / This week stay expand-to-edit.
 *   - Section selectors: Whenever = recurring 'none' & !sharedOut (All tab includes dated
 *     one-offs); Recurring = recurring !== 'none' & !sharedOut; Shared out = sharedOut. In
 *     Today / This week the "Whenever" section is undated tasks only, and shared tasks are
 *     tinted instead of getting their own section.
 *   - New tasks are always created in Whenever (undated, non-recurring).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import SharedRequestsSection from '@/components/SharedRequestsSection';
import TaskCard from '@/components/TaskCard';
import IconButton from '@/components/IconButton';
import { initDb } from '@/lib/db';
import { todayStr, getWeekDates } from '@/lib/date';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { Task, useTaskStore } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSharedStore } from '@/store/useSharedStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';

let dbBootstrapped = false;

/**
 * Module-session edit lock (Decision 029 pattern, mirrors shopping.tsx's
 * catalogLockedSession): survives navigating away and back within a session, but a
 * fresh module evaluation on cold start re-locks it. Not persisted to SQLite on
 * purpose — a persisted lock would wrongly survive an app restart.
 */
let taskLockedSession = true;

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
  const loadTasks = useTaskStore((s) => s.load);
  const loadShared = useSharedStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);

  const [tab, setTab] = useState<Tab>('all');
  const [hintOpen, setHintOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [locked, setLockedState] = useState(taskLockedSession);
  const setLocked = useCallback((next: boolean | ((v: boolean) => boolean)) => {
    setLockedState((prev) => {
      const resolved = typeof next === 'function' ? (next as (v: boolean) => boolean)(prev) : next;
      taskLockedSession = resolved;
      return resolved;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!dbBootstrapped) {
        initDb();
        dbBootstrapped = true;
      }
      loadSettings();
      loadTasks();
      loadShared();
      return () => setHintOpen(false);
    }, [loadSettings, loadTasks, loadShared])
  );

  const today = todayStr();
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

  const editable = tab === 'all' ? !locked : true;

  function handleAddWhenever() {
    const title = newTitle.trim();
    if (!title) return;
    addTask({
      title,
      date: today,
      taskType: 'start-at',
      done: false,
      recurring: 'none',
      recurringDays: [],
      importance: 'regular',
      sortOrder: 0,
      hasStartDate: false,
    });
    setNewTitle('');
  }

  function sectionHeader(label: string, color: string) {
    return (
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
        <View style={[styles.sectionRule, { backgroundColor: color }]} />
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
            <Pressable
              key={tabOption}
              style={[styles.tab, isActive && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
              onPress={() => setTab(tabOption)}
            >
              <Text style={[styles.tabText, { color: isActive ? theme.accent : theme.textMuted }]}>{label}</Text>
            </Pressable>
          );
        })}
        {tab === 'all' && (
          <IconButton
            icon={locked ? 'lock-closed' : 'lock-open-outline'}
            label={locked ? t.unlockListButtonLabel : t.lockListButtonLabel}
            onPress={() => setLocked((v) => !v)}
            active={locked}
            size={30}
          />
        )}
      </View>
    </View>
  );

  const isEmpty = tasks.length === 0;

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

        {isEmpty ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{t.tasksEmptyTitle}</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>{t.tasksEmptySubtitle}</Text>
          </View>
        ) : null}

        {/* ── ALL TASKS ── */}
        {tab === 'all' && (
          <>
            <SharedRequestsSection kind="task" />

            {sharedOutAll.length > 0 && (
              <View style={styles.section}>
                {sectionHeader(t.tasksSectionSharedOut, theme.textMuted)}
                <View style={styles.cardStack}>
                  {sharedOutAll.map((tk) => (
                    <TaskCard key={tk.id} task={tk} editable={editable} tinted onToggleDone={(x) => toggle(x.id)} />
                  ))}
                </View>
              </View>
            )}

            {!isEmpty && (
              <View style={styles.section}>
                {sectionHeader(t.tasksSectionWhenever, theme.good)}
                <View style={styles.cardStack}>
                  {wheneverAll.map((tk) => (
                    <TaskCard
                      key={tk.id}
                      task={tk}
                      editable={editable}
                      showDelete
                      showShareOut
                      onToggleDone={(x) => toggle(x.id)}
                    />
                  ))}
                </View>
                {!locked && (
                  <View style={styles.addRow}>
                    <TextInput
                      style={[styles.addInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                      value={newTitle}
                      onChangeText={setNewTitle}
                      placeholder={t.tasksAddPlaceholder}
                      placeholderTextColor={theme.textMuted}
                      returnKeyType="done"
                      onSubmitEditing={handleAddWhenever}
                    />
                    <IconButton icon="add" label={t.newTask} onPress={handleAddWhenever} size={34} />
                  </View>
                )}
              </View>
            )}

            {recurringAll.length > 0 && (
              <View style={styles.section}>
                {sectionHeader(t.tasksSectionRecurring, theme.accent)}
                <View style={styles.cardStack}>
                  {recurringAll.map((tk) => (
                    <TaskCard
                      key={tk.id}
                      task={tk}
                      editable={editable}
                      showDelete
                      showShareOut
                      onToggleDone={(x) => toggle(x.id)}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* ── TODAY ── */}
        {tab === 'today' && (
          <>
            <View style={styles.section}>
              {sectionHeader(t.tasksTabToday, theme.accent)}
              {todayList.length === 0 ? (
                <Text style={[styles.sectionEmpty, { color: theme.textMuted }]}>{t.noPlansToday}</Text>
              ) : (
                <View style={styles.cardStack}>
                  {todayList.map((tk) => (
                    <TaskCard
                      key={tk.id}
                      task={tk}
                      editable={editable}
                      tinted={tk.sharedOut}
                      onToggleDone={(x) => toggle(x.id)}
                    />
                  ))}
                </View>
              )}
            </View>

            {undatedWhenever.length > 0 && (
              <View style={styles.section}>
                {sectionHeader(t.tasksSectionWhenever, theme.good)}
                <View style={styles.cardStack}>
                  {undatedWhenever.map((tk) => (
                    <TaskCard key={tk.id} task={tk} editable={editable} onToggleDone={(x) => toggle(x.id)} />
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* ── THIS WEEK ── */}
        {tab === 'week' && (
          <>
            {weekGroups.map((group, i) =>
              group.tasks.length > 0 ? (
                <View key={group.date} style={styles.section}>
                  {sectionHeader(t.dayFull[i], theme.accent)}
                  <View style={styles.cardStack}>
                    {group.tasks.sort(byTime).map((tk) => (
                      <TaskCard
                        key={tk.id + group.date}
                        task={tk}
                        editable={editable}
                        tinted={tk.sharedOut}
                        onToggleDone={(x) => toggle(x.id)}
                      />
                    ))}
                  </View>
                </View>
              ) : null
            )}

            {undatedWhenever.length > 0 && (
              <View style={styles.section}>
                {sectionHeader(t.tasksSectionWhenever, theme.good)}
                <View style={styles.cardStack}>
                  {undatedWhenever.map((tk) => (
                    <TaskCard key={tk.id} task={tk} editable={editable} onToggleDone={(x) => toggle(x.id)} />
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
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
  section: { gap: Spacing.xs },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionRule: { flex: 1, height: 2, borderRadius: Radius.full, opacity: 0.4 },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionEmpty: { fontSize: FontSize.sm, paddingVertical: Spacing.sm },
  cardStack: { gap: Spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  addInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.sm,
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  emptySubtitle: { fontSize: FontSize.sm, textAlign: 'center' },
});
