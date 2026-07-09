/**
 * CatalogueTab.tsx — the Shopping screen's in-place "Catalogue" tab.
 *
 * The master list of known items (store_items via useCatalogStore), grouped into
 * sections by item type (category). A top "add new item" section reveals a small
 * form — name, price, save — for authoring a brand-new catalogue item. Each existing
 * row shows name + price, is tappable to edit in place (name/price/save), and has a
 * delete button. The catalogue is the single basis both the week lists and the Food
 * tab draw item names/prices from (autocomplete), so edits here flow everywhere.
 *
 * Connections:
 *   Imports → constants/theme (tokens), lib/useAppTheme, lib/i18n, lib/haptics,
 *             lib/money (formatKr), components/Surface, store/useCatalogStore, @expo/vector-icons
 *   Used by → app/(tabs)/shopping.tsx (rendered when the Catalogue tab is active)
 *   Data    → useCatalogStore.addItem/updateItem/removeItem (+ items list)
 *
 * Edit notes:
 *   - Renders no ScrollView of its own — it lives inside the Shopping screen scaffold's
 *     ScrollView.
 *   - New items are authored into the 'other' category (no picker in the add form, per the
 *     spec's "name, price, delete, save"); their type can be changed later only by re-adding.
 *   - removeItem soft-deletes (see useCatalogStore) so deleting a seeded item sticks across
 *     the per-load re-seed.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import { useCatalogStore } from '@/store/useCatalogStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { success, heavy } from '@/lib/haptics';
import { formatKr } from '@/lib/money';

type Props = {
  onNotify: (msg: string) => void;
};

const CATEGORY_ORDER = [
  'produce', 'dairy', 'meat', 'fish', 'bread', 'frozen', 'canned',
  'dry', 'snacks', 'drinks', 'cleaning', 'personal', 'other',
];

export default function CatalogueTab({ onNotify }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  const items = useCatalogStore((s) => s.items);
  const addItem = useCatalogStore((s) => s.addItem);
  const updateItem = useCatalogStore((s) => s.updateItem);
  const removeItem = useCatalogStore((s) => s.removeItem);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPrice, setAddPrice] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const cat = item.category || 'other';
      const arr = map.get(cat) ?? [];
      arr.push(item);
      map.set(cat, arr);
    }
    const known = CATEGORY_ORDER.filter((c) => map.has(c));
    const extra = [...map.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort();
    return [...known, ...extra].map((cat) => ({
      cat,
      label: (t.shoppingCategories as Record<string, string>)[cat] ?? cat,
      rows: (map.get(cat) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, 'no')),
    }));
  }, [items, t]);

  function handleAdd() {
    const name = addName.trim();
    if (!name) return;
    addItem({ name, price: parseFloat(addPrice.replace(',', '.')) || 0, category: 'other' });
    success();
    onNotify(t.catalogueItemAdded(name));
    setAddName('');
    setAddPrice('');
    setAddOpen(false);
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
      {/* ── Top: add-new-item section ── */}
      <Surface style={styles.addCard}>
        <Pressable
          style={styles.addHeader}
          onPress={() => setAddOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={t.catalogueAddNewBtn}
        >
          <View style={[styles.addPlus, { backgroundColor: theme.accent }]}>
            <Ionicons name={addOpen ? 'remove' : 'add'} size={18} color={theme.accentInk} />
          </View>
          <Text style={[styles.addHeaderText, { color: theme.text }]}>{t.catalogueAddNewBtn}</Text>
        </Pressable>

        {addOpen && (
          <View style={styles.addForm}>
            <TextInput
              style={[styles.addNameInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
              value={addName}
              onChangeText={setAddName}
              placeholder={t.catalogueItemNamePlaceholder}
              placeholderTextColor={theme.textMuted}
              autoFocus
            />
            <TextInput
              style={[styles.addPriceInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
              value={addPrice}
              onChangeText={setAddPrice}
              placeholder={t.catalogueItemPricePlaceholder}
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
              onSubmitEditing={handleAdd}
            />
            <Pressable
              style={[styles.saveBtn, { backgroundColor: addName.trim() ? theme.good : theme.surfaceMuted }]}
              onPress={handleAdd}
              disabled={!addName.trim()}
            >
              <Text style={[styles.saveBtnText, { color: addName.trim() ? theme.textInverse : theme.textMuted }]}>
                {t.catalogueSaveItemBtn}
              </Text>
            </Pressable>
          </View>
        )}
      </Surface>

      {/* ── Sections by item type ── */}
      {grouped.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>{t.catalogueEmpty}</Text>
      ) : (
        grouped.map(({ cat, label, rows }) => (
          <View key={cat} style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{label}</Text>
              <View style={[styles.sectionRule, { backgroundColor: theme.textMuted }]} />
            </View>
            <Surface style={styles.rowsCard}>
              {rows.map((item, idx) => {
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
                        <Pressable style={[styles.iconBtn, { backgroundColor: theme.good }]} onPress={commitEdit} hitSlop={4}>
                          <Ionicons name="checkmark" size={16} color={theme.textInverse} />
                        </Pressable>
                        <Pressable
                          style={[styles.iconBtn, { backgroundColor: theme.badSoft }]}
                          onPress={() => { removeItem(item.id); heavy(); setEditingId(null); }}
                          hitSlop={4}
                          accessibilityLabel={t.catalogueDeleteItemLabel}
                        >
                          <Ionicons name="trash-outline" size={16} color={theme.bad} />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable style={styles.itemRow} onPress={() => startEdit(item.id, item.name, item.price)}>
                        <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                        {item.price > 0 && (
                          <Text style={[styles.itemPrice, { color: theme.textMuted }]}>{formatKr(item.price, 0)}</Text>
                        )}
                        <Pressable
                          onPress={() => { removeItem(item.id); heavy(); }}
                          hitSlop={8}
                          accessibilityLabel={t.catalogueDeleteItemLabel}
                        >
                          <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
                        </Pressable>
                      </Pressable>
                    )}
                    {idx < rows.length - 1 && <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />}
                  </View>
                );
              })}
            </Surface>
          </View>
        ))
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  root: { gap: Spacing.md },
  addCard: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  addHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  addPlus: { width: 30, height: 30, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  addHeaderText: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  addForm: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  addNameInput: { flex: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8, fontSize: FontSize.sm },
  addPriceInput: { width: 76, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8, fontSize: FontSize.sm },
  saveBtn: { borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', minHeight: 36 },
  saveBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  empty: { fontSize: FontSize.sm, paddingVertical: Spacing.md, textAlign: 'center' },
  section: { gap: Spacing.xs },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionRule: { flex: 1, height: 2, borderRadius: Radius.full, opacity: 0.4 },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
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
