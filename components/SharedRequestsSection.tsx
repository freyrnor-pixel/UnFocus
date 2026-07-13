/**
 * SharedRequestsSection.tsx — inline "incoming shared item" prompts (replaces the bubble-wheel Shared entry)
 *
 * Shows whatever's been scanned in from a partner (store/useSharedStore.ts, direction='in',
 * not yet done) right inside the screen the item actually belongs to: shopping requests on
 * app/shopping.tsx, task requests on app/index.tsx. Accept adds a real local item and marks
 * the shared row done; Dismiss removes the shared row outright. Renders nothing when there's
 * nothing pending — mirrors components/InboxSection.tsx's pattern.
 *
 * Connections:
 *   Imports → components/PressableScale, components/Surface, constants/theme, lib/haptics,
 *             lib/i18n, lib/date, lib/useAppTheme, store/useSharedStore, store/useShoppingStore,
 *             store/useTaskStore
 *   Used by → app/(tabs)/shopping.tsx (kind='shopping'). The Tasks screen no longer uses this —
 *             its incoming shares moved into components/SharedTasksSection.tsx (merged Shared
 *             section, 2026-07-13). The kind='task' code path is kept for reference/reuse.
 *   Data    → reads/removes useSharedStore rows; writes useShoppingStore/useTaskStore on accept
 *
 * Edit notes:
 *   - This is the per-screen replacement for the old "Shared" bubble — full history (sent +
 *     received, done or not) would live at a future app/shared.tsx; out of scope here.
 *   - Accept defaults are deliberately minimal (today's date / weekly list / undated Whenever
 *     task) so there's no intermediate form, same rationale as InboxSection's task defaults.
 *   - Ported (2026-07-02, Session A2·2, expanded scope — see PROGRESS_LOG) from the old repo's
 *     SharedRequestsSection.tsx. Token remap (Decision 006): theme.offWhite (Surface tint) →
 *     surfaceMuted, orange/orangeLight → accent/accentSoft, grayLight → surfaceMuted, textLight
 *     → textMuted, hardcoded fontWeight → Fonts.semibold/bold. `theme` prop dropped in favor of
 *     internal useAppTheme(), matching the established Phase 3c/3d convention. The `kind='task'`
 *     branch was re-added with the Tasks/Oppgaver redesign (2026-07-08): Accept creates a local
 *     Whenever task; Dismiss removes the shared row.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { success } from '@/lib/haptics';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useSharedStore } from '@/store/useSharedStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useTaskStore } from '@/store/useTaskStore';

type Props = {
  kind: 'shopping' | 'task';
};

export default function SharedRequestsSection({ kind }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const sharedShoppingItems = useSharedStore((s) => s.shoppingItems);
  const sharedTasks = useSharedStore((s) => s.tasks);
  const toggleShopping = useSharedStore((s) => s.toggleShopping);
  const removeShopping = useSharedStore((s) => s.removeShopping);
  const toggleTask = useSharedStore((s) => s.toggleTask);
  const removeTask = useSharedStore((s) => s.removeTask);
  const addShoppingItem = useShoppingStore((s) => s.add);
  const addTask = useTaskStore((s) => s.add);

  const pending =
    kind === 'shopping'
      ? sharedShoppingItems.filter((i) => i.direction === 'in' && !i.done)
      : sharedTasks.filter((i) => i.direction === 'in' && !i.done);

  if (pending.length === 0) return null;

  function acceptShopping(id: string, name: string, amount: string, unit: string) {
    success();
    addShoppingItem({ name, amount, unit, listType: 'weekly', store: '', price: 0, inventoryQty: 0, status: 'inWeeklyList' });
    toggleShopping(id);
  }

  function acceptTask(id: string, title: string) {
    success();
    addTask({
      title,
      date: todayStr(),
      taskType: 'start-at',
      done: false,
      recurring: 'none',
      recurringDays: [],
      importance: 'regular',
      sortOrder: 0,
      hasStartDate: false,
    });
    toggleTask(id);
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.sharedRequests.sectionTitle}</Text>
      <Surface tint={theme.surfaceMuted} style={styles.card}>
        {pending.map((item, i) => {
          const label = kind === 'shopping'
            ? (item as { name: string }).name
            : (item as { title: string }).title;
          return (
            <View key={item.id} style={[styles.row, i > 0 && { borderTopColor: theme.border, borderTopWidth: 1, paddingTop: Spacing.sm }]}>
              <Text style={[styles.itemText, { color: theme.text }]} numberOfLines={2}>
                {t.sharedRequests.fromLabel(item.sharedBy)} {label}
              </Text>
              <View style={styles.actions}>
                <PressableScale
                  style={[styles.actionBtn, { backgroundColor: theme.accentSoft }]}
                  onPress={() =>
                    kind === 'shopping'
                      ? acceptShopping(item.id, (item as { name: string }).name, (item as { amount: string }).amount, (item as { unit: string }).unit)
                      : acceptTask(item.id, (item as { title: string }).title)
                  }
                  haptic={false}
                  scaleTo={0.97}
                >
                  <Text style={[styles.actionBtnText, { color: theme.accent }]}>{t.sharedRequests.accept}</Text>
                </PressableScale>
                <PressableScale
                  style={[styles.actionBtn, { backgroundColor: theme.surfaceMuted }]}
                  onPress={() => (kind === 'shopping' ? removeShopping(item.id) : removeTask(item.id))}
                  scaleTo={0.97}
                >
                  <Text style={[styles.actionBtnText, { color: theme.textMuted }]}>{t.sharedRequests.dismiss}</Text>
                </PressableScale>
              </View>
            </View>
          );
        })}
      </Surface>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  section: { marginBottom: Spacing.md, gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  card: { borderRadius: Radius.md, padding: Spacing.sm, gap: Spacing.sm },
  row: { gap: Spacing.xs },
  itemText: { fontSize: FontSize.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { paddingVertical: 6, paddingHorizontal: Spacing.sm, borderRadius: Radius.full },
  actionBtnText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
});
