/**
 * inventory-edit.tsx — standalone add/edit/remove screen for one Monthly list's
 * permanent inventory (its `shopping_items` rows at status === 'catalog').
 *
 * Sub-screen (Decision 001 tier='sub'), scoped by a `listId` route param (Shopping/Monthly
 * redesign, 2026-07-22, made catalog items per-list). Reached from that list's "Manage
 * inventory" header button on app/(tabs)/shopping.tsx's Monthly tab (UX audit C2, 2026-07-23
 * — resurrected after a prior pass deleted this screen as an unwired duplicate; this pass
 * wires it up AND removes the duplication by sharing lib/shoppingGroups.ts's
 * catalogItemsForList() with shopping.tsx's own Monthly view instead of each filtering/
 * sorting the same rows independently). Tap a row to edit/delete via UpdateSheet; a bordered
 * trigger pill above the list opens the inline add form for a new staple.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/MonthlyTableRow, components/AnimatedListItem
 *             (catalog row add/remove fade), components/UpdateSheet, components/InlineAddItem,
 *             components/EmptyState, constants/theme, lib/haptics, lib/i18n, lib/shoppingGroups
 *             (catalogItemsForList), lib/useAppTheme, store/useShoppingStore,
 *             store/useMonthlyListStore (list name, for the title)
 *   Used by → Expo Router route "/inventory-edit" — pushed from app/(tabs)/shopping.tsx's
 *             Monthly list header ("Manage inventory" button), with a `listId` param
 *   Data    → useShoppingStore (shopping_items, status === 'catalog' rows for this listId)
 *
 * Edit notes:
 *   - All visible strings go through useT().
 *   - Decision 001: mounts via ScreenScaffold (tier='sub' — back link left, iOS-only; no
 *     bottom block).
 *   - The checkbox toggles `item.pendingRestock` directly via `update()` — a personal
 *     "flag for later" the user can tick, same as the row always offered. Nothing else in
 *     the app reads this flag (Monthly's own inline rows use the checkbox for a different
 *     job — moving the item to the focused weekly list — which needs a "focused list"
 *     concept this standalone screen doesn't have); it's an intentionally simple
 *     bookkeeping toggle here, not restoring the old dedicated `setPendingRestock` store
 *     method (removed as dead code — this screen now calls `update` directly, its one-line
 *     former implementation).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useShoppingStore, ShoppingItem } from '@/store/useShoppingStore';
import { useMonthlyListStore } from '@/store/useMonthlyListStore';
import { catalogItemsForList } from '@/lib/shoppingGroups';
import ScreenScaffold from '@/components/ScreenScaffold';
import MonthlyTableRow from '@/components/MonthlyTableRow';
import AnimatedListItem from '@/components/AnimatedListItem';
import UpdateSheet from '@/components/UpdateSheet';
import InlineAddItem from '@/components/InlineAddItem';
import EmptyState from '@/components/EmptyState';
import { success, heavy } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';

export default function InventoryEditScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const { listId } = useLocalSearchParams<{ listId?: string }>();

  const items = useShoppingStore((s) => s.items);
  const add = useShoppingStore((s) => s.add);
  const update = useShoppingStore((s) => s.update);
  const removeWithSource = useShoppingStore((s) => s.removeWithSource);
  const monthlyLists = useMonthlyListStore((s) => s.lists);
  const list = monthlyLists.find((l) => l.id === listId) ?? monthlyLists[0];

  // Gate row entrance so only catalog items added after mount fade in (not the whole list).
  const hasMounted = useRef(false);
  useEffect(() => {
    hasMounted.current = true;
  }, []);
  const [updateItem, setUpdateItem] = useState<ShoppingItem | null>(null);

  const catalogItems = useMemo(
    () => (list ? catalogItemsForList(items, list.id) : []),
    [items, list]
  );

  function handleAddItem(input: { name: string; price: number; targetQuantity: number; isTemporary: boolean }) {
    if (!list) return;
    add({
      name: input.name,
      amount: '1',
      unit: '',
      listType: 'monthly',
      store: '',
      price: input.price,
      inventoryQty: 0,
      isTemporary: input.isTemporary,
      targetQuantity: input.targetQuantity,
      status: 'catalog',
      monthlyListId: list.id,
    });
    success();
  }

  function handleUpdateSave(patch: { name: string; price: number; targetQuantity: number; isTemporary: boolean }) {
    if (!updateItem) return;
    update(updateItem.id, patch);
    setUpdateItem(null);
    success();
  }

  function handleUpdateDelete() {
    if (!updateItem) return;
    removeWithSource(updateItem.id);
    setUpdateItem(null);
    heavy();
  }

  return (
    <>
      <ScreenScaffold title={list ? t.inventoryEditTitle + ' — ' + list.name : t.inventoryEditTitle} tier="sub" onBack={() => router.back()}>
        <View style={styles.content}>
          {/* "+ Add item" collapses to a bar and expands into the full add form IN PLACE
              (no modal) — the multi-field catalog-add counterpart to components/AddRow. */}
          <InlineAddItem label={t.addItemBtn} onAdd={handleAddItem} />

          {catalogItems.length === 0 ? (
            <EmptyState title={t.emptyMonthlyList} />
          ) : (
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              {catalogItems.map((item, idx) => (
                <AnimatedListItem key={item.id} enabled={hasMounted.current}>
                  <MonthlyTableRow
                    item={item}
                    onCheckboxPress={() => update(item.id, { pendingRestock: !item.pendingRestock })}
                    onPress={() => setUpdateItem(item)}
                    temporaryLabel={t.temporaryBadge}
                  />
                  {idx < catalogItems.length - 1 && (
                    <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                  )}
                </AnimatedListItem>
              ))}
            </View>
          )}
          <View style={styles.bottomSpacer} />
        </View>
      </ScreenScaffold>

      <UpdateSheet
        visible={updateItem !== null}
        item={updateItem}
        onClose={() => setUpdateItem(null)}
        onSave={handleUpdateSave}
        onDelete={handleUpdateDelete}
      />
    </>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md, gap: Spacing.sm },
  card: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, ...Shadow.card },
  rowDivider: { height: 1 },
  bottomSpacer: { height: 24 },
});
