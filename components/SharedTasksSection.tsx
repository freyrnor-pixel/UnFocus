/**
 * SharedTasksSection.tsx — the merged "Shared" section for the Tasks screen (2026-07-13 redesign).
 *
 * One section that combines BOTH directions of task sharing, each row carrying a direction
 * indicator, replacing the old split (a top-of-screen incoming `SharedRequestsSection` + a
 * separate "Shared out" section):
 *   - Received (↓): incoming shared rows (useSharedStore, direction 'in', not done) — a card
 *     with a "Received" chip, "From {name}: {title}", and Accept / Dismiss. Accept creates a
 *     local undated Whenever task and marks the shared row done; Dismiss removes the row. (Logic
 *     lifted from the retired plans.tsx usage of SharedRequestsSection.)
 *   - Sent (↑): local tasks flagged `sharedOut` — rendered via TaskCard with the shop-hue rail
 *     and a leading "Sent" chip.
 * Sort: received-pending first, then sent; each group newest/earliest by date then title.
 * All cards wear the shop-domain hue (rail + chips) so the section reads as one group.
 *
 * Connections:
 *   Imports → components/TaskCard, components/SectionCard, components/PressableScale,
 *             constants/theme, lib/domainColor, lib/date, lib/haptics, lib/i18n, lib/useAppTheme,
 *             store/useSharedStore, store/useTaskStore
 *   Used by → app/(tabs)/plans.tsx (All-tasks tab, last section)
 *   Data    → reads/removes useSharedStore rows; creates/toggles useTaskStore tasks
 *
 * Edit notes:
 *   - The shop hue is arbitrary-but-stable for "shared" (rose); green/red stay reserved for
 *     status, so a received/sent chip never reads as done/overdue.
 *   - Received cards are plain Views (not TaskCard) — they aren't real local tasks yet.
 *   - Wrapped in `<SectionCard>` (2026-07-18) so this section reads as one bordered glass
 *     card like its All-tasks siblings (Whenever/Recurring) instead of a loose header floating
 *     over unbounded rows — it was the one section still missing the boxed-section treatment.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TaskCard from '@/components/TaskCard';
import SectionCard from '@/components/SectionCard';
import PressableScale from '@/components/PressableScale';
import { Fonts, FontSize, Radius, Spacing, contrastOn } from '@/constants/theme';
import { getDomainColor } from '@/lib/domainColor';
import { todayStr } from '@/lib/date';
import { success } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useSharedStore } from '@/store/useSharedStore';
import { Task, useTaskStore } from '@/store/useTaskStore';

type Props = {
  /** Local tasks flagged sharedOut (the "sent" half). */
  sentTasks: Task[];
  /** Toggle a sent task's done state (from the parent's store binding). */
  onToggleDone: (task: Task) => void;
};

export default function SharedTasksSection({ sentTasks, onToggleDone }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const hue = getDomainColor(theme, 'shop').accent;

  const sharedTasks = useSharedStore((s) => s.tasks);
  const toggleShared = useSharedStore((s) => s.toggleTask);
  const removeShared = useSharedStore((s) => s.removeTask);
  const addTask = useTaskStore((s) => s.add);

  const received = useMemo(
    () =>
      sharedTasks
        .filter((i) => i.direction === 'in' && !i.done)
        .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)),
    [sharedTasks]
  );
  const sent = useMemo(
    () => [...sentTasks].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)),
    [sentTasks]
  );

  const count = received.length + sent.length;

  function accept(id: string, title: string) {
    success();
    addTask({
      title,
      date: todayStr(),
      taskType: 'start-at',
      done: false,
      recurring: 'none',
      recurringDays: [],
      sortOrder: 0,
      hasStartDate: false,
    });
    toggleShared(id);
  }

  return (
    <SectionCard hue={hue} label={t.tasksSectionShared} count={count}>
      {count === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted, backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          {t.tasksSectionSharedEmpty}
        </Text>
      ) : (
        <>
          {/* Received (↓) */}
          {received.map((item) => (
            <View
              key={item.id}
              style={[styles.recvCard, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: hue }]}
            >
              <View style={styles.recvHead}>
                <View style={[styles.dirChip, { backgroundColor: getDomainColor(theme, 'shop').soft }]}>
                  <Ionicons name="arrow-down" size={11} color={hue} />
                  <Text style={[styles.dirChipText, { color: hue }]}>{t.tasksSharedReceived}</Text>
                </View>
                <Text style={[styles.fromLabel, { color: theme.textMuted }]} numberOfLines={1}>
                  {t.sharedRequests.fromLabel(item.sharedBy)}
                </Text>
              </View>
              <Text style={[styles.recvTitle, { color: theme.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.actions}>
                <PressableScale
                  style={[styles.actionBtn, { backgroundColor: hue }]}
                  onPress={() => accept(item.id, item.title)}
                  haptic={false}
                  scaleTo={0.97}
                >
                  <Text style={[styles.actionBtnText, { color: contrastOn(hue) }]}>{t.sharedRequests.accept}</Text>
                </PressableScale>
                <PressableScale
                  style={[styles.actionBtn, { backgroundColor: theme.surfaceMuted }]}
                  onPress={() => removeShared(item.id)}
                  scaleTo={0.97}
                >
                  <Text style={[styles.actionBtnText, { color: theme.textMuted }]}>{t.sharedRequests.dismiss}</Text>
                </PressableScale>
              </View>
            </View>
          ))}

          {/* Sent (↑) */}
          {sent.map((tk) => (
            <TaskCard
              key={tk.id}
              task={tk}
              railColor={hue}
              sharedDirection="out"
              showDelete
              showShareOut
              onToggleDone={onToggleDone}
            />
          ))}
        </>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontSize: FontSize.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  recvCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  recvHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dirChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.full,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
  },
  dirChipText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  fromLabel: { fontSize: FontSize.xs, fontFamily: Fonts.medium, flex: 1 },
  recvTitle: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: Spacing.md, borderRadius: Radius.full },
  actionBtnText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
});
