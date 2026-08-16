/**
 * shared.tsx — items shared between users
 *
 * Tabbed view (shopping / tasks) of items shared in or out between users. Each
 * row can be checked off or removed; completing a shared item also acts on its
 * linked source task/shopping item when one exists (sourceTaskId / sourceItemId).
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/Surface, components/PressableScale,
 *             components/TabSlider (the shopping/tasks switcher — screen tier),
 *             constants/theme, lib/date, lib/db, lib/i18n, lib/useAppTheme,
 *             store/useSettingsStore, store/useSharedStore, store/useShoppingStore,
 *             store/useTaskStore
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
 *     since ScreenScaffold owns the header/nav chrome. It is `components/TabSlider` as of
 *     2026-08-10 (screen tier, per TabSlider's two-tier rule); it was hand-rolled before that
 *     and was the last such bar in the app. No `attachedTop` — it is scroll content here, not
 *     a sticky row welded to the header.
 *   - Decision 006 tokens only; reads useAppTheme() internally.
 *   - Store hydration happens once at startup in app/_layout.tsx; this screen has no
 *     per-screen focus-load.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSharedStore, SharedTask, SharedShoppingItem } from '@/store/useSharedStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useT } from '@/lib/i18n';
import { useSettingsStore } from '@/store/useSettingsStore';
import { formatDisplayDate } from '@/lib/date';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import ScreenScaffold from '@/components/ScreenScaffold';
import TabSlider from '@/components/TabSlider';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Tab = 'tasks' | 'shopping';

export default function SharedScreen() {
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

  const toggleSourceTask = useTaskStore((s) => s.toggle);
  const removeSourceShopping = useShoppingStore((s) => s.remove);

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
        <TabSlider
          options={[
            { value: 'shopping' as Tab, label: t.sharedShoppingTab },
            { value: 'tasks' as Tab, label: t.sharedTasksTab },
          ]}
          value={tab}
          onChange={setTab}
        />

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
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.sharedDone}</Text>
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
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>{t.sharedDone}</Text>
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
      <PressableScale
        style={[styles.doneBtn, { borderColor: theme.accent }, item.done && { backgroundColor: theme.accent }]}
        onPress={onToggle}
        scaleTo={0.97}
      >
        {item.done && <Text style={[styles.doneMark, { color: theme.accentInk }]}>✓</Text>}
      </PressableScale>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: theme.text }, item.done && styles.strikethrough]}>
          {item.amount} {item.unit} {item.name}
        </Text>
        <Text style={[styles.rowMeta, { color: theme.textMuted }]}>
          {item.direction === 'out' ? t.sharedBySelf : t.sharedFromLabel(item.sharedBy)}
        </Text>
      </View>
      <PressableScale onPress={onRemove} style={styles.removeBtn} scaleTo={0.93}>
        <Text style={[styles.removeText, { color: theme.textMuted }]}>✕</Text>
      </PressableScale>
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
      <PressableScale
        style={[styles.doneBtn, { borderColor: theme.accent }, item.done && { backgroundColor: theme.accent }]}
        onPress={onToggle}
        scaleTo={0.97}
      >
        {item.done && <Text style={[styles.doneMark, { color: theme.accentInk }]}>✓</Text>}
      </PressableScale>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: theme.text }, item.done && styles.strikethrough]}>
          {item.title}
        </Text>
        <Text style={[styles.rowMeta, { color: theme.textMuted }]}>
          {formatDisplayDate(item.date, lang)} · {item.direction === 'out' ? t.sharedBySelf : t.sharedFromLabel(item.sharedBy)}
        </Text>
      </View>
      <PressableScale onPress={onRemove} style={styles.removeBtn} scaleTo={0.93}>
        <Text style={[styles.removeText, { color: theme.textMuted }]}>✕</Text>
      </PressableScale>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  // No paddingTop (2026-08-19): the first card meets the header's glass flush, the way
  // components/ScreenScaffold.tsx now clips every screen. The BOTTOM keeps its margin —
  // this screen reserves no nav, so that edge is the safe area, not chrome.
  content: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.md },
  // `tabs`/`tab`/`tabText` deleted 2026-08-10 — this screen's switcher is `TabSlider` now.
  // It was the app's last hand-rolled tab bar, and it predated TabSlider: same raised-white
  // active treatment, but hard-swapped instead of slid, with no track border, no haptic and
  // no accessibilityRole="radio". See TabSlider's header for the two-tier rule.
  emptyCard: { borderRadius: Radius.md, padding: Spacing.lg, alignItems: 'center' },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  section: { gap: Spacing.xs },
  sectionLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  card: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 2 },
  doneBtn: {
    width: 24, height: 24, borderRadius: Radius.full, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  doneMark: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: FontSize.md },
  rowMeta: { fontSize: FontSize.xs, marginTop: 1 },
  strikethrough: { textDecorationLine: 'line-through', opacity: 0.5 },
  removeBtn: { paddingHorizontal: Spacing.xs },
  removeText: { fontSize: FontSize.md },
});
