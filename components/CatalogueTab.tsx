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
 *   Used by → app/(tabs)/shopping.tsx (rendered when the Catalogue tab is active, with
 *             ScreenScaffold in scrollable={false} mode so THIS FlatList owns scrolling)
 *   Data    → useCatalogStore.addItem/updateItem/removeItem (+ items list)
 *
 * Edit notes:
 *   - **Virtualised (perf, 2026-07-15)**: renders a real FlatList, so only ~15 rows mount
 *     at a time instead of all ~286 at once. The old version was a `.map()` inside the
 *     Shopping scaffold's shared ScrollView (a FlatList there would be a nested same-axis
 *     VirtualizedList), which fully mounted every row — each a PressableScale carrying its
 *     own Reanimated shared-value/animated-style, so ~570 animated nodes mounted per open
 *     and re-mounted on every tab switch. Now app/(tabs)/shopping.tsx passes
 *     `scrollable={false}` to ScreenScaffold on the Catalogue tab so this FlatList is the
 *     scroller. The old CATALOGUE_INITIAL_WINDOW / visibleCount / InteractionManager
 *     deferral is gone — virtualization caps the mounted-row count directly instead of just
 *     deferring the full expansion past the first frame.
 *   - **Rows are plain `Pressable`, not `PressableScale`**: at list scale the per-row spring
 *     bounce isn't worth a Reanimated node per row. The small check/trash action buttons keep
 *     PressableScale (only a handful mounted at once). `CatalogueRow` is `React.memo`'d with
 *     stable callbacks (onStartEdit/onRemove from useCallback) so typing in the add row or
 *     entering edit mode only re-renders the affected row, not the whole visible window.
 *   - **`header` prop**: the Shopping screen's hint card + SharedRequestsSection are handed in
 *     as the FlatList's ListHeaderComponent (above the add row) so they still scroll with the
 *     list — the Catalogue tab renders outside the screen's normal padded content View.
 *   - New items are still authored into the 'other' category (no picker in the add row,
 *     per the spec's "name, price, delete, save") — `category` is kept on the row (used
 *     by autocomplete elsewhere) even though this tab no longer groups/displays by it.
 *   - The add row sits at the TOP of this list (unlike Plans/Shopping's bottom-of-list
 *     AddRow) — deliberate exception: this is a long, alphabetized reference list, not a
 *     short append-order list, so a bottom add row would require scrolling on every add.
 *   - removeItem soft-deletes (see useCatalogStore) so deleting a seeded item sticks across
 *     a seed re-run (seeding is now version-gated, not per-load).
 *   - **No domain border on the cards (2026-07-13, updated 2026-07-14)**: unlike
 *     WeekListCard, the rows don't carry the shop-domain green edge — this list is one long,
 *     continuous card, so a full-screen outline would read as a loud frame at this scale.
 *     `domainColor.accent` is still used for the small AddRow confirm-button fill.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import AddRow from '@/components/AddRow';
import { useCatalogStore, StoreItem } from '@/store/useCatalogStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { ThemePalette } from '@/constants/colors';
import { useT } from '@/lib/i18n';
import { success, heavy } from '@/lib/haptics';
import { formatKr } from '@/lib/money';
import { getDomainColor } from '@/lib/domainColor';

type Props = {
  onNotify: (msg: string) => void;
  /** Screen-owned chrome (hint card + shared requests) rendered above the add row. */
  header?: React.ReactNode;
};

type Styles = ReturnType<typeof useScaledStyles<typeof baseStyles>>;

/**
 * One display-mode catalogue row. Memoised + fed stable callbacks so typing in the add
 * row / entering edit mode doesn't re-render every visible row. Plain Pressable (no
 * per-row Reanimated node); only the small trash button keeps PressableScale.
 */
const CatalogueRow = React.memo(function CatalogueRow({
  item,
  isFirst,
  isLast,
  onStartEdit,
  onRemove,
  theme,
  styles,
  deleteLabel,
}: {
  item: StoreItem;
  isFirst: boolean;
  isLast: boolean;
  onStartEdit: (item: StoreItem) => void;
  onRemove: (id: string) => void;
  theme: ThemePalette;
  styles: Styles;
  deleteLabel: string;
}) {
  return (
    <View
      style={[
        styles.itemRow,
        { backgroundColor: theme.surface },
        isFirst && styles.rowFirst,
        isLast && styles.rowLast,
      ]}
    >
      <Text
        style={[styles.itemNameTouch, { color: theme.text }]}
        numberOfLines={1}
        onPress={() => onStartEdit(item)}
        suppressHighlighting
      >
        {item.name}
      </Text>
      {item.price > 0 && (
        <Text style={[styles.itemPrice, { color: theme.textMuted }]} onPress={() => onStartEdit(item)}>
          {formatKr(item.price, 0)}
        </Text>
      )}
      <PressableScale
        onPress={() => onRemove(item.id)}
        hitSlop={8}
        accessibilityLabel={deleteLabel}
        scaleTo={0.93}
      >
        <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
      </PressableScale>
    </View>
  );
});

export default function CatalogueTab({ onNotify, header }: Props) {
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
  // memoised on `items`, so it's cheap.
  const sortedItems = useMemo(
    () => items.slice().sort((a, b) => a.name.localeCompare(b.name, 'no')),
    [items]
  );

  function handleAdd() {
    const name = addName.trim();
    if (!name) return;
    addItem({ name, price: parseFloat(addPrice.replace(',', '.')) || 0, category: 'other' });
    success();
    onNotify(t.catalogueItemAdded(name));
    setAddName('');
    setAddPrice('');
  }

  const startEdit = useCallback((item: StoreItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(item.price > 0 ? String(item.price) : '');
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      removeItem(id);
      heavy();
    },
    [removeItem]
  );

  function commitEdit() {
    if (!editingId) return;
    const name = editName.trim();
    if (name) updateItem(editingId, { name, price: parseFloat(editPrice.replace(',', '.')) || 0 });
    setEditingId(null);
  }

  const renderItem = ({ item, index }: { item: StoreItem; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === sortedItems.length - 1;
    if (editingId === item.id) {
      return (
        <View
          style={[
            styles.editRow,
            { backgroundColor: theme.surface },
            isFirst && styles.rowFirst,
            isLast && styles.rowLast,
          ]}
        >
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
      );
    }
    return (
      <CatalogueRow
        item={item}
        isFirst={isFirst}
        isLast={isLast}
        onStartEdit={startEdit}
        onRemove={handleRemove}
        theme={theme}
        styles={styles}
        deleteLabel={t.catalogueDeleteItemLabel}
      />
    );
  };

  const listHeader = (
    <View style={styles.listHeader}>
      {header}
      {/* ── Top: add-new-item row ── the shared AddRow (name input + price extra), always
          visible at the top of this long, alphabetized reference list. */}
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
      {sortedItems.length === 0 && (
        <Text style={[styles.empty, { color: theme.textMuted }]}>{t.catalogueEmpty}</Text>
      )}
    </View>
  );

  return (
    <FlatList
      style={styles.flatList}
      data={sortedItems}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      // extraData: re-render rows when edit mode toggles (editingId) or the theme changes,
      // since CatalogueRow is memoised and otherwise only re-renders on its own prop changes.
      extraData={`${editingId}|${theme.surface}`}
      ListHeaderComponent={listHeader}
      ItemSeparatorComponent={() => <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={15}
      windowSize={11}
      maxToRenderPerBatch={20}
      removeClippedSubviews
    />
  );
}

const baseStyles = StyleSheet.create({
  flatList: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  listHeader: { gap: Spacing.md, paddingBottom: Spacing.md },
  addRowCard: { paddingHorizontal: Spacing.md },
  addPriceInput: { width: 76, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8, fontSize: FontSize.sm },
  empty: { fontSize: FontSize.sm, paddingVertical: Spacing.md, textAlign: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: 44 },
  rowFirst: { borderTopLeftRadius: Radius.md, borderTopRightRadius: Radius.md },
  rowLast: { borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md },
  itemNameTouch: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.medium },
  itemPrice: { fontSize: FontSize.sm },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md },
  editNameInput: { flex: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6, fontSize: FontSize.sm },
  editPriceInput: { width: 64, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 6, fontSize: FontSize.sm },
  iconBtn: { width: 30, height: 30, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  rowDivider: { height: 1 },
});
