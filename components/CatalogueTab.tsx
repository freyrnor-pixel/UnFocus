/**
 * CatalogueTab.tsx — the Shopping screen's in-place "Catalogue" tab.
 *
 * The master list of known items (store_items via useCatalogStore), rendered as one
 * flat list sorted alphabetically by name (Decision, visual-audit 2026-07-11 —
 * previously sectioned by item type; flattened since a single glance-sorted list is
 * faster to scan than hunting through category headers). A top AddRow (name + a price
 * extra input) authors a brand-new catalogue item — always visible, no expand/collapse
 * toggle (design-consistency pass: one shared "add a row" shape app-wide instead of a
 * bespoke toggle-open form). Each existing row shows name + price, is tappable to edit
 * in place (name/price/save), and has a delete button. The catalogue is the single basis
 * both the week lists and the Food tab draw item names/prices from (autocomplete), so
 * edits here flow everywhere.
 *
 * Connections:
 *   Imports → constants/theme (tokens), lib/useAppTheme, lib/i18n, lib/haptics,
 *             lib/money (formatKr), lib/domainColor, components/Surface,
 *             components/PressableScale, components/AddRow, store/useCatalogStore,
 *             @expo/vector-icons
 *   Used by → app/(tabs)/shopping.tsx (rendered when the Catalogue tab is active)
 *   Data    → useCatalogStore.addItem/updateItem/removeItem (+ items list)
 *
 * Edit notes:
 *   - Renders no ScrollView of its own — it lives inside the Shopping screen scaffold's
 *     ScrollView. Because of that it can't virtualise with a FlatList (nested same-axis
 *     VirtualizedList); instead it renders a small initial window synchronously and fills
 *     the rest after the tab-transition interaction settles (see CATALOGUE_INITIAL_WINDOW /
 *     visibleCount) so opening the tab stays snappy despite the ~286-row catalogue.
 *   - New items are still authored into the 'other' category (no picker in the add row,
 *     per the spec's "name, price, delete, save") — `category` is kept on the row (used
 *     by autocomplete elsewhere) even though this tab no longer groups/displays by it.
 *   - The add row sits at the TOP of this list (unlike Plans/Shopping's bottom-of-list
 *     AddRow) — deliberate exception: this is a long, alphabetized reference list, not a
 *     short append-order list, so a bottom add row would require scrolling on every add.
 *   - removeItem soft-deletes (see useCatalogStore) so deleting a seeded item sticks across
 *     a seed re-run (seeding is now version-gated, not per-load).
 *   - **No domain tint on the cards (2026-07-13)**: unlike WeekListCard, the add-row and
 *     rows Surfaces here don't pass `tint={domainColor.tint}` — this list is one long,
 *     continuous card holding the whole ~286-row catalogue, so the same shop-domain rose
 *     wash that reads as a subtle accent on a small weekly-list card reads as a loud,
 *     "red" full-screen tint at this scale. `domainColor.accent` is still used for the
 *     small AddRow confirm-button fill, which stays a domain-consistent touch.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { InteractionManager, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import AddRow from '@/components/AddRow';
import { useCatalogStore } from '@/store/useCatalogStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { success, heavy } from '@/lib/haptics';
import { formatKr } from '@/lib/money';
import { getDomainColor } from '@/lib/domainColor';

/** Rows mounted synchronously on tab open; the rest fill in after the transition settles. */
const CATALOGUE_INITIAL_WINDOW = 30;

type Props = {
  onNotify: (msg: string) => void;
};

export default function CatalogueTab({ onNotify }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  const items = useCatalogStore((s) => s.items);
  const addItem = useCatalogStore((s) => s.addItem);
  const updateItem = useCatalogStore((s) => s.updateItem);
  const removeItem = useCatalogStore((s) => s.removeItem);

  const [addName, setAddName] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const domainColor = getDomainColor(theme, 'shop');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Keep the Norwegian-collated sort (SQL orderBy 'name' doesn't order æ/ø/å correctly);
  // it's memoised on `items`, so it's cheap.
  const sortedItems = useMemo(
    () => items.slice().sort((a, b) => a.name.localeCompare(b.name, 'no')),
    [items]
  );

  // Incremental render (perf): this tab mounts fresh on every switch, and mounting all
  // ~286 rows synchronously is what made the Catalogue feel "slow to load". Render a small
  // window instantly so the tab opens without a hitch, then fill the rest after the
  // tab-transition interaction settles (off the critical frame).
  const [visibleCount, setVisibleCount] = useState(CATALOGUE_INITIAL_WINDOW);
  useEffect(() => {
    if (visibleCount >= sortedItems.length) return;
    const task = InteractionManager.runAfterInteractions(() => setVisibleCount(sortedItems.length));
    return () => task.cancel();
  }, [sortedItems.length, visibleCount]);
  const visibleItems = useMemo(() => sortedItems.slice(0, visibleCount), [sortedItems, visibleCount]);

  function handleAdd() {
    const name = addName.trim();
    if (!name) return;
    addItem({ name, price: parseFloat(addPrice.replace(',', '.')) || 0, category: 'other' });
    success();
    onNotify(t.catalogueItemAdded(name));
    setAddName('');
    setAddPrice('');
  }

  function startEdit(id: string, name: string, price: number) {
    setEditingId(id);
    setEditName(name);
    setEditPrice(price > 0 ? String(price) : '');
  }

  function commitEdit() {
    if (!editingId) return;
    const name = editName.trim();
    if (name) updateItem(editingId, { name, price: parseFloat(editPrice.replace(',', '.')) || 0 });
    setEditingId(null);
  }

  return (
    <View style={styles.root}>
      {/* ── Top: add-new-item row ── the shared AddRow (name input + price extra), always
          visible at the top of this long, alphabetized reference list — mirrors WeekListCard's
          inline-add shape but sits at the top here (not the bottom) since this list is a
          scrollable catalogue, not a short append-order list like Plans/Shopping's weekly list. */}
      <Surface style={styles.addRowCard}>
        <AddRow
          placeholder={t.catalogueItemNamePlaceholder}
          value={addName}
          onChangeText={setAddName}
          onSubmit={handleAdd}
          accent={domainColor.accent}
          showDivider={false}
          accessibilityLabel={t.catalogueAddNewBtn}
          extras={
            <TextInput
              style={[styles.addPriceInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
              value={addPrice}
              onChangeText={setAddPrice}
              placeholder={t.catalogueItemPricePlaceholder}
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
              onSubmitEditing={handleAdd}
            />
          }
        />
      </Surface>

      {/* ── Flat, name-sorted list ── */}
      {sortedItems.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>{t.catalogueEmpty}</Text>
      ) : (
        <Surface style={styles.rowsCard}>
          {visibleItems.map((item, idx) => {
            const isEditing = editingId === item.id;
            return (
              <View key={item.id}>
                {isEditing ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={[styles.editNameInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder={t.catalogueItemNamePlaceholder}
                      placeholderTextColor={theme.textMuted}
                      autoFocus
                    />
                    <TextInput
                      style={[styles.editPriceInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                      value={editPrice}
                      onChangeText={setEditPrice}
                      placeholder={t.catalogueItemPricePlaceholder}
                      placeholderTextColor={theme.textMuted}
                      keyboardType="decimal-pad"
                      onSubmitEditing={commitEdit}
                    />
                    <PressableScale style={[styles.iconBtn, { backgroundColor: theme.good }]} onPress={commitEdit} hitSlop={4} scaleTo={0.9}>
                      <Ionicons name="checkmark" size={16} color={theme.textInverse} />
                    </PressableScale>
                    <PressableScale
                      style={[styles.iconBtn, { backgroundColor: theme.badSoft }]}
                      onPress={() => { removeItem(item.id); heavy(); setEditingId(null); }}
                      hitSlop={4}
                      accessibilityLabel={t.catalogueDeleteItemLabel}
                      scaleTo={0.93}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.bad} />
                    </PressableScale>
                  </View>
                ) : (
                  <PressableScale style={styles.itemRow} onPress={() => startEdit(item.id, item.name, item.price)} scaleTo={0.97}>
                    <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                    {item.price > 0 && (
                      <Text style={[styles.itemPrice, { color: theme.textMuted }]}>{formatKr(item.price, 0)}</Text>
                    )}
                    <PressableScale
                      onPress={() => { removeItem(item.id); heavy(); }}
                      hitSlop={8}
                      accessibilityLabel={t.catalogueDeleteItemLabel}
                      scaleTo={0.93}
                    >
                      <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
                    </PressableScale>
                  </PressableScale>
                )}
                {idx < visibleItems.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
              </View>
            );
          })}
        </Surface>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  root: { gap: Spacing.md },
  addRowCard: { paddingHorizontal: Spacing.md },
  addPriceInput: { width: 76, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8, fontSize: FontSize.sm },
  empty: { fontSize: FontSize.sm, paddingVertical: Spacing.md, textAlign: 'center' },
  rowsCard: { borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, minHeight: 44 },
  itemName: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.medium },
  itemPrice: { fontSize: FontSize.sm },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
  editNameInput: { flex: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6, fontSize: FontSize.sm },
  editPriceInput: { width: 64, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 6, fontSize: FontSize.sm },
  iconBtn: { width: 30, height: 30, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  rowDivider: { height: 1 },
});
