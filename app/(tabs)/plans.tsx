/**
 * plans.tsx — the full "Plans" screen: today's day-view rail.
 *
 * Rebuilt against the day-view spec (Decisions 009 / 009a / 009b), NOT ported from the
 * old two-section drag stack. Renders the single shared PlanTaskCard day-view
 * interactively (the Home preview renders the same component read-only). Tasks tap
 * through to the task-form editor; the dot checks them off inline; the FAB adds a new
 * task. Follower surfacing (Decision 020) and hint display (Decision 019) are handled
 * inside PlanTaskCard.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/PlanTaskCard, components/HintCard,
 *             components/AddFAB, lib/db, lib/date, lib/i18n, store/useTaskStore, store/useSettingsStore
 *   Used by → Expo Router route "/plans" — one of 5 co-mounted pager tabs under app/(tabs)/_layout.tsx (BottomNav "Plans" tab)
 *   Data    → reads/writes useTaskStore (tasks) on toggle; reads useSettingsStore for theme hydration
 *
 * Edit notes:
 *   - Site tier: mounts via ScreenScaffold tier="site" (BottomNav + header chrome). No
 *     Focus mode here — Focus mode is Home-only (Decision 009 #4 / 018).
 *   - Passes both `tasks` (today) and `allTasks` (full store) to PlanTaskCard so
 *     cross-date followers can surface into today's view (Decision 020 sub-question b).
 *   - Loads the store on focus (useFocusEffect) so edits made in task-form are reflected
 *     on return; initDb() is idempotent but guarded by a module flag like other screens.
 */
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import ScreenScaffold from '@/components/ScreenScaffold';
import PlanTaskCard from '@/components/PlanTaskCard';
import HintCard from '@/components/HintCard';
import AddFAB from '@/components/AddFAB';
import { initDb } from '@/lib/db';
import { todayStr } from '@/lib/date';
import { useT } from '@/lib/i18n';
import { Task, useTaskStore } from '@/store/useTaskStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Spacing } from '@/constants/theme';

let dbBootstrapped = false;

export default function PlansScreen() {
  const t = useT();
  const router = useRouter();
  const tasks = useTaskStore((s) => s.tasks);
  const tasksForDate = useTaskStore((s) => s.tasksForDate);
  const toggle = useTaskStore((s) => s.toggle);
  const loadTasks = useTaskStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);

  useFocusEffect(
    useCallback(() => {
      if (!dbBootstrapped) {
        initDb();
        dbBootstrapped = true;
      }
      loadSettings();
      loadTasks();
    }, [loadSettings, loadTasks])
  );

  const today = todayStr();
  const todayTasks = tasksForDate(today);

  function handlePressTask(task: Task) {
    router.push({ pathname: '/task-form', params: { id: task.id } });
  }

  return (
    <>
      <ScreenScaffold title={t.plansTitle} tier="site" bottomNav={false} ownBackground={false}>
        <View style={styles.content}>
          <HintCard text={t.hints.plans.text} />
          <PlanTaskCard
            tasks={todayTasks}
            allTasks={tasks}
            onPressTask={handlePressTask}
            onToggleTask={(task) => toggle(task.id)}
          />
        </View>
      </ScreenScaffold>
      <AddFAB onPress={() => router.push('/task-form')} accessibilityLabel={t.newTask} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
});
