/**
 * inventory-edit.tsx — standalone Katalog (inventory) add/edit/remove screen.
 *
 * Self-contained sub-screen (Decision 001 tier='sub') for managing the permanent
 * household inventory: the `shopping_items` rows at status === 'catalog'. Tap a row
 * to edit/delete via UpdateSheet; the FAB opens AddItemSheet to add a new staple.
 * Reachable via the `/inventory-edit` route; no in-app entry point is wired yet
 * (the shopping screen's Monthly Container folds the same logic in-place), matching
 * the old app's orphaned-but-kept status.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/MonthlyTableRow, components/UpdateSheet,
 *             components/AddItemSheet, components/EmptyState, components/AddFAB, constants/theme,
 *             lib/haptics, lib/i18n, lib/useAppTheme, store/useShoppingStore
 *   Used by → Expo Router route "/inventory-edit"
 *   Data    → useShoppingStore (shopping_items, status === 'catalog' rows only)
 *
 * Edit notes:
 *   - All visible strings go through useT().
 *   - Decision 001: mounts via ScreenScaffold (tier='sub' — back link left, iOS-only;
 *     no bottom block). The FAB and the two <Modal>-based sheets render as siblings of
 *     ScreenScaffold (its children live inside an internal ScrollView), same pattern
 *     app/shopping.tsx documents for its ConfirmationBanner overlay.
 *   - Colours use Decision 006 tokens only (surface/border) — the old theme.white/
 *     theme.grayLight names are retired.
 *   - The store is loaded globally (deferred to the future _layout bootstrap phase),
 *     same as every other Phase 5 screen so far — this screen does not self-load.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useShoppingStore, ShoppingItem } from '@/store/useShoppingStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import MonthlyTableRow from '@/components/MonthlyTableRow';
import UpdateSheet from '@/components/UpdateSheet';
import AddItemSheet from '@/components/AddItemSheet';
import EmptyState from '@/components/EmptyState';
import AddFAB from '@/components/AddFAB';
import { success, heavy } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { Radius, Shadow, Spacing } from '@/constants/theme';

export default function InventoryEditScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  const items = useShoppingStore((s) => s.items);
  const add = useShoppingStore((s) => s.add);
  const update = useShoppingStore((s) => s.update);
  const removeWithSource = useShoppingStore((s) => s.removeWithSource);
  const setPendingRestock = useShoppingStore((s) => s.setPendingRestock);

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [updateItem, setUpdateItem] = useState<ShoppingItem | null>(null);

  const catalogItems = useMemo(
    () => items.filter((i) => i.status === 'catalog').sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );

  function handleAddItem(input: { name: string; price: number; targetQuantity: number; isTemporary: boolean; alsoAddToCatalog: boolean }) {
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
    });
    setShowAddSheet(false);
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
      <ScreenScaffold title={t.inventoryEditTitle} tier="sub" onBack={() => router.back()}>
        <View style={styles.content}>
          {catalogItems.length === 0 ? (
            <EmptyState title={t.emptyMonthlyList} />
          ) : (
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              {catalogItems.map((item, idx) => (
                <View key={item.id}>
                  <MonthlyTableRow
                    item={item}
                    onTogglePending={() => setPendingRestock(item.id, !item.pendingRestock)}
                    onPress={() => setUpdateItem(item)}
                    temporaryLabel={t.temporaryBadge}
                  />
                  {idx < catalogItems.length - 1 && (
                    <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}
            </View>
          )}
          <View style={styles.bottomSpacer} />
        </View>
      </ScreenScaffold>

      <AddFAB onPress={() => setShowAddSheet(true)} bottom={Spacing.xl} accessibilityLabel={t.addItemBtn} />

      <AddItemSheet
        visible={showAddSheet}
        origin="catalog"
        onClose={() => setShowAddSheet(false)}
        onAdd={handleAddItem}
      />

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
  content: { padding: Spacing.md },
  card: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, ...Shadow.card },
  rowDivider: { height: 1 },
  bottomSpacer: { height: 100 },
});
