/**
 * share-modal.tsx — QR share sheet
 *
 * Screen that lets the user pick shopping items or upcoming tasks (kind 's' / 't'
 * from the route param) and encodes the selection into a QR payload for another
 * user to scan. Also records the selection as outbound shared items locally.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/Surface, components/Button,
 *             components/QRCodeDisplay, components/PressableScale, constants/theme,
 *             lib/date (todayStr, formatDisplayDate), lib/i18n, lib/share, lib/useAppTheme,
 *             store/useSettingsStore, store/useSharedStore, store/useShoppingStore,
 *             store/useTaskStore
 *   Used by → Expo Router route "/share-modal"; entry points push it with a `kind`
 *             param — app/shopping.tsx ('s'), app/plans.tsx ('t'), app/index.tsx ('t')
 *   Data    → reads useShoppingStore (shopping_items) / useTaskStore (tasks) / useSettingsStore
 *             (language for date formatting); writes outbound rows to useSharedStore
 *             (shared_shopping_items / shared_tasks)
 *
 * Edit notes:
 *   - All visible strings go through useT(); kind param ('t' = tasks, anything else = shopping) drives the whole sheet.
 *   - Source lists are filtered to unchecked shopping / future-dated undone tasks (today via todayStr()); payload built with encodeSharePayload.
 *   - Task dates in the UI are rendered via formatDisplayDate (Norwegian date display,
 *     code-only, no ledger number — see Decision 028's numbering note) — DD.MM.YYYY in Norwegian, ISO in English.
 *   - The post-share "Done" button uses dismissAll() + push('/shared') so the result matches
 *     the app's <=2-deep site-stack invariant regardless of which site screen opened it.
 *   - Decision 001 tier='sub' scaffold; Decision 006 tokens only (accent/good/textMuted).
 *   - OB-3 resolved (Decision 023): a per-kind explanation line + the "one-time copy for now"
 *     caveat render under the selection-card title (t.shareExplain{Shopping,Tasks} +
 *     t.shareExplainLaterBuild — pre-existing bilingual keys reused).
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useSharedStore } from '@/store/useSharedStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useT } from '@/lib/i18n';
import { encodeSharePayload } from '@/lib/share';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import Surface from '@/components/Surface';
import Button from '@/components/Button';
import ScreenScaffold from '@/components/ScreenScaffold';
import PressableScale from '@/components/PressableScale';
import { todayStr, formatDisplayDate } from '@/lib/date';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

export default function ShareModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = params.kind === 't' ? 't' : 's';

  const t = useT();
  const userName = useSettingsStore((s) => s.userName);
  const lang = useSettingsStore((s) => s.language);
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);

  const shoppingItems = useShoppingStore((s) => s.items);
  const tasks = useTaskStore((s) => s.tasks);
  const addSharedShopping = useSharedStore((s) => s.addSharedShopping);
  const addSharedTasks = useSharedStore((s) => s.addSharedTasks);

  const today = todayStr();

  const sourceItems = useMemo(() => {
    if (kind === 's') {
      return shoppingItems
        .filter((i) => !i.checked)
        .map((i) => ({ id: i.id, label: `${i.amount} ${i.unit} ${i.name}`.trim(), sub: '' }));
    }
    return tasks
      .filter((task) => task.date >= today && !task.done)
      .map((task) => ({ id: task.id, label: task.title, sub: formatDisplayDate(task.date, lang) }));
  }, [kind, shoppingItems, tasks, today, lang]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(sourceItems.map((i) => i.id)));
  const [shared, setShared] = useState(false);

  const allSelected = selected.size === sourceItems.length;

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sourceItems.map((i) => i.id)));
    }
  }

  const qrPayload = useMemo(() => {
    const by = userName || 'UnFocus';
    if (kind === 's') {
      const selectedItems = shoppingItems
        .filter((i) => selected.has(i.id))
        .map((i) => ({ n: i.name, a: i.amount, u: i.unit }));
      if (selectedItems.length === 0) return '';
      return encodeSharePayload({ v: 1, k: 's', b: by, i: selectedItems });
    }
    const selectedTasks = tasks
      .filter((task) => selected.has(task.id))
      .map((task) => ({ n: task.title, d: task.date }));
    if (selectedTasks.length === 0) return '';
    return encodeSharePayload({ v: 1, k: 't', b: by, i: selectedTasks });
  }, [kind, selected, shoppingItems, tasks, userName]);

  function confirmShare() {
    if (!qrPayload || shared) return;
    const by = userName || 'UnFocus';
    if (kind === 's') {
      const selectedItems = shoppingItems.filter((i) => selected.has(i.id));
      addSharedShopping(
        selectedItems.map((i) => ({
          sourceItemId: i.id,
          name: i.name,
          amount: i.amount,
          unit: i.unit,
          direction: 'out',
          sharedBy: by,
        }))
      );
    } else {
      const selectedTasks = tasks.filter((task) => selected.has(task.id));
      addSharedTasks(
        selectedTasks.map((task) => ({
          sourceTaskId: task.id,
          title: task.title,
          date: task.date,
          direction: 'out',
          sharedBy: by,
        }))
      );
    }
    setShared(true);
  }

  const title = kind === 's' ? t.sharedShopping : t.sharedTasks;

  return (
    <ScreenScaffold title={t.shareTitle} tier="sub" onBack={() => router.back()}>
      <View style={styles.content}>
        {!shared ? (
          <>
            <Surface style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
                <PressableScale onPress={toggleAll} scaleTo={0.97}>
                  <Text style={[styles.toggleAll, { color: theme.accent }]}>
                    {allSelected ? t.deselectAll : t.selectAll}
                  </Text>
                </PressableScale>
              </View>
              <Text style={[styles.explain, { color: theme.textMuted }]}>
                {kind === 's' ? t.shareExplainShopping : t.shareExplainTasks}
                {' '}
                {t.shareExplainLaterBuild}
              </Text>
              {sourceItems.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.noSharedItems}</Text>
              ) : (
                sourceItems.map((item) => (
                  <PressableScale
                    key={item.id}
                    style={styles.itemRow}
                    onPress={() => toggleItem(item.id)}
                    scaleTo={0.97}
                  >
                    <View style={[
                      styles.checkbox,
                      { borderColor: theme.accent },
                      selected.has(item.id) && { backgroundColor: theme.accent },
                    ]}>
                      {selected.has(item.id) && <Text style={[styles.checkMark, { color: theme.accentInk }]}>✓</Text>}
                    </View>
                    <View style={styles.itemText}>
                      <Text style={[styles.itemLabel, { color: theme.text }]}>{item.label}</Text>
                      {item.sub ? <Text style={[styles.itemSub, { color: theme.textMuted }]}>{item.sub}</Text> : null}
                    </View>
                  </PressableScale>
                ))
              )}
            </Surface>

            {selected.size > 0 && qrPayload ? (
              <Button
                label={`${t.shareSelected} (${selected.size})`}
                onPress={confirmShare}
              />
            ) : null}
          </>
        ) : (
          <>
            <Surface style={styles.qrCard}>
              <Text style={[styles.qrTitle, { color: theme.text }]}>{t.shareTitle}</Text>
              <Text style={[styles.qrInstructions, { color: theme.textMuted }]}>{t.shareInstructions}</Text>
              <View style={styles.qrWrap}>
                <QRCodeDisplay data={qrPayload} size={260} />
              </View>
            </Surface>

            <PressableScale
              style={[styles.doneBtn, { backgroundColor: theme.goodSoft }]}
              onPress={() => { router.dismissAll(); router.push('/shared'); }}
              scaleTo={0.95}
            >
              <Text style={[styles.doneBtnText, { color: theme.good }]}>{t.sharedTitle} →</Text>
            </PressableScale>
          </>
        )}

        <View style={{ height: 40 }} />
      </View>
    </ScreenScaffold>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.md },
  card: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700' },
  toggleAll: { fontSize: FontSize.sm, fontWeight: '600' },
  explain: { fontSize: FontSize.xs, lineHeight: 17, marginBottom: Spacing.xs },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  checkbox: {
    width: 22, height: 22, borderRadius: Radius.full, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { fontSize: FontSize.xs, fontWeight: '700' },
  itemText: { flex: 1 },
  itemLabel: { fontSize: FontSize.md },
  itemSub: { fontSize: FontSize.xs, marginTop: 1 },
  qrCard: {
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
  },
  qrTitle: { fontSize: FontSize.xl, fontWeight: '700' },
  qrInstructions: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  qrWrap: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginVertical: Spacing.sm,
  },
  doneBtn: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: FontSize.md, fontWeight: '700' },
});
