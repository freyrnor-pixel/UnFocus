/**
 * shared.tsx — items shared between users
 *
 * Tabbed view (shopping / tasks) of items shared in or out between users. Each
 * row can be checked off or removed; completing a shared item also acts on its
 * linked source task/shopping item when one exists (sourceTaskId / sourceItemId).
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/Surface, constants/theme, lib/date,
 *             lib/db, lib/i18n, lib/useAppTheme, store/useSettingsStore, store/useSharedStore,
 *             store/useShoppingStore, store/useTaskStore
 *   Used by → Expo Router route "/shared" (reached from /share-modal's Done button and
 *             app/scan.tsx's post-scan prompt — scan.tsx not ported yet)
 *   Data    → useSharedStore (shared_tasks + shared_shopping_items tables); mirrors actions
 *             to useTaskStore (tasks) / useShoppingStore (shopping_items) via the source ids
 *
 * Edit notes:
 *   - All visible strings go through useT(); direction 'in'/'out' decides the "from X" vs "shared by you" meta label.
 *   - Checking a shared shopping item removes its source item; checking a shared task toggles its source task only when not already done.
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome). The tab switcher renders
 *     as the first (non-sticky) row of the scroll content — the old fixed-tab bar is inlined,
 *     since ScreenScaffold owns the header/nav chrome.
 *   - Decision 006 tokens only. The inline row helpers read useAppTheme() directly rather than
 *     taking the retired `theme: AppColors` prop (same precedent as every other ported screen).
 *   - Loads shared + source stores on focus so cross-store mirrors stay fresh; initDb() is
 *     idempotent but guarded by a module flag.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSharedStore, SharedTask, SharedShoppingItem } from '@/store/useSharedStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useT } from '@/lib/i18n';
import { useSettingsStore } from '@/store/useSettingsStore';
import { formatDisplayDate } from '@/lib/date';
import { initDb } from '@/lib/db';
import Surface from '@/components/Surface';
import ScreenScaffold from '@/components/ScreenScaffold';
import { FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Tab = 'tasks' | 'shopping';

let dbBootstrapped = false;

export default function SharedScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('shopping');

  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  const sharedTasks = useSharedStore((s) => s.tasks);
  const sharedShopping = useSharedStore((s) => s.shoppingItems);
  const toggleSharedTask = useSharedStore((s) => s.toggleTask);
  const toggleSharedShopping = useSharedStore((s) => s.toggleShopping);
  const removeSharedTask = useSharedStore((s) => s.removeTask);
  const removeSharedShopping = useSharedStore((s) => s.removeShopping);
  const loadShared = useSharedStore((s) => s.load);

  const toggleSourceTask = useTaskStore((s) => s.toggle);
  const loadTasks = useTaskStore((s) => s.load);
  const removeSourceShopping = useShoppingStore((s) => s.remove);
  const loadShopping = useShoppingStore((s) => s.load);

  useFocusEffect(
    useCallback(() => {
      if (!dbBootstrapped) {
        initDb();
        dbBootstrapped = true;
      }
      loadShared();
      loadTasks();
      loadShopping();
    }, [loadShared, loadTasks, loadShopping])
  );

  function handleToggleTask(item: SharedTask) {
    toggleSharedTask(item.id);
    if (!item.done && item.sourceTaskId) {
      toggleSourceTask(item.sourceTaskId);
    }
  }

  function handleToggleShopping(item: SharedShoppingItem) {
    const becomingDone = !item.done;
    toggleSharedShopping(item.id);
    if (becomingDone && item.sourceItemId) {
      removeSourceShopping(item.sourceItemId);
    }
  }

  const activeTasks = sharedTasks.filter((x) => !x.done);
  const doneTasks = sharedTasks.filter((x) => x.done);
  const activeShopping = sharedShopping.filter((i) => !i.done);
  const doneShopping = sharedShopping.filter((i) => i.done);

  return (
    <ScreenScaffold title={t.sharedTitle} tier="site">
      <View style={styles.content}>
        <View style={[styles.tabs, { backgroundColor: theme.surfaceMuted }]}>
          {(['shopping', 'tasks'] as Tab[]).map((tabOpt) => (
            <Pressable
              key={tabOpt}
              style={[styles.tab, tab === tabOpt && { backgroundColor: theme.surface, ...Shadow.card }]}
              onPress={() => setTab(tabOpt)}
            >
              <Text style={[styles.tabText, { color: theme.textMuted }, tab === tabOpt && { color: theme.text }]}>
                {tabOpt === 'shopping' ? t.sharedShoppingTab : t.sharedTasksTab}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'shopping' ? (
          sharedShopping.length === 0 ? (
            <Surface tint={theme.surfaceMuted} style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.noSharedItems}</Text>
            </Surface>
          ) : (
            <>
              {activeShopping.length > 0 && (
                <View style={styles.section}>
                  <Surface style={styles.card}>
                    {activeShopping.map((item) => (
                      <SharedShoppingRow
                        key={item.id}
                        item={item}
                        onToggle={() => handleToggleShopping(item)}
                        onRemove={() => removeSharedShopping(item.id)}
                      />
                    ))}
                  </Surface>
                </View>
              )}
              {doneShopping.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.sharedDone}</Text>
                  <Surface tint={theme.surfaceMuted} style={styles.card}>
                    {doneShopping.map((item) => (
                      <SharedShoppingRow
                        key={item.id}
                        item={item}
                        onToggle={() => handleToggleShopping(item)}
                        onRemove={() => removeSharedShopping(item.id)}
                      />
                    ))}
                  </Surface>
                </View>
              )}
            </>
          )
        ) : (
          sharedTasks.length === 0 ? (
            <Surface tint={theme.surfaceMuted} style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.noSharedItems}</Text>
            </Surface>
          ) : (
            <>
              {activeTasks.length > 0 && (
                <View style={styles.section}>
                  <Surface style={styles.card}>
                    {activeTasks.map((item) => (
                      <SharedTaskRow
                        key={item.id}
                        item={item}
                        onToggle={() => handleToggleTask(item)}
                        onRemove={() => removeSharedTask(item.id)}
                      />
                    ))}
                  </Surface>
                </View>
              )}
              {doneTasks.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.sharedDone}</Text>
                  <Surface tint={theme.surfaceMuted} style={styles.card}>
                    {doneTasks.map((item) => (
                      <SharedTaskRow
                        key={item.id}
                        item={item}
                        onToggle={() => handleToggleTask(item)}
                        onRemove={() => removeSharedTask(item.id)}
                      />
                    ))}
                  </Surface>
                </View>
              )}
            </>
          )
        )}

        <View style={{ height: 100 }} />
      </View>
    </ScreenScaffold>
  );
}

function SharedShoppingRow({
  item, onToggle, onRemove,
}: {
  item: SharedShoppingItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const theme = useAppTheme();
  const t = useT();
  const styles = useScaledStyles(baseStyles);
  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.doneBtn, { borderColor: theme.accent }, item.done && { backgroundColor: theme.accent }]}
        onPress={onToggle}
      >
        {item.done && <Text style={[styles.doneMark, { color: theme.accentInk }]}>✓</Text>}
      </Pressable>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: theme.text }, item.done && styles.strikethrough]}>
          {item.amount} {item.unit} {item.name}
        </Text>
        <Text style={[styles.rowMeta, { color: theme.textMuted }]}>
          {item.direction === 'out' ? t.sharedBySelf : t.sharedFromLabel(item.sharedBy)}
        </Text>
      </View>
      <Pressable onPress={onRemove} style={styles.removeBtn}>
        <Text style={[styles.removeText, { color: theme.textMuted }]}>✕</Text>
      </Pressable>
    </View>
  );
}

function SharedTaskRow({
  item, onToggle, onRemove,
}: {
  item: SharedTask;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const theme = useAppTheme();
  const t = useT();
  const lang = useSettingsStore((s) => s.language);
  const styles = useScaledStyles(baseStyles);
  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.doneBtn, { borderColor: theme.accent }, item.done && { backgroundColor: theme.accent }]}
        onPress={onToggle}
      >
        {item.done && <Text style={[styles.doneMark, { color: theme.accentInk }]}>✓</Text>}
      </Pressable>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: theme.text }, item.done && styles.strikethrough]}>
          {item.title}
        </Text>
        <Text style={[styles.rowMeta, { color: theme.textMuted }]}>
          {formatDisplayDate(item.date, lang)} · {item.direction === 'out' ? t.sharedBySelf : t.sharedFromLabel(item.sharedBy)}
        </Text>
      </View>
      <Pressable onPress={onRemove} style={styles.removeBtn}>
        <Text style={[styles.removeText, { color: theme.textMuted }]}>✕</Text>
      </Pressable>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  tabs: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 3,
    gap: 3,
  },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, alignItems: 'center' },
  tabText: { fontSize: FontSize.sm, fontWeight: '600' },
  emptyCard: { borderRadius: Radius.md, padding: Spacing.lg, alignItems: 'center' },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  section: { gap: Spacing.xs },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: '600' },
  card: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 2 },
  doneBtn: {
    width: 24, height: 24, borderRadius: Radius.full, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  doneMark: { fontSize: FontSize.xs, fontWeight: '700' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: FontSize.md },
  rowMeta: { fontSize: FontSize.xs, marginTop: 1 },
  strikethrough: { textDecorationLine: 'line-through', opacity: 0.5 },
  removeBtn: { paddingHorizontal: Spacing.xs },
  removeText: { fontSize: FontSize.md },
});
