/**
 * create-grouping.tsx — full screen for building a "grouping" (dish) and adding its
 * ingredients to the Monthly list in one step.
 *
 * Reached by the floating "Create grouping" button in the bottom-right corner of both
 * the Weekly and Monthly tabs of app/(tabs)/shopping.tsx (router.push('/create-grouping')).
 * Replaces the old AddDishSheet modal. Two entry modes toggled at the top: "New dish"
 * (blank name) or "From Meals" (pick an existing useMealStore dish; its name + ingredients
 * seed the draft, still editable). Ingredients are added by searching the product catalog
 * (useCatalogStore) with a +/qty stepper — the same interaction as AddSourceChooser's
 * inventory picker — plus a custom-ingredient fallback for anything not in the catalog.
 * On save, each ingredient becomes a status:'catalog' shopping_items row carrying the
 * shared dishName (useShoppingStore.add — its dedup bumps quantity for repeats), then the
 * screen pops back to the shopping tab.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/Surface, components/PressableScale,
 *             constants/theme, lib/haptics, lib/i18n, lib/useAppTheme,
 *             store/useCatalogStore, store/useMealStore, store/useShoppingStore,
 *             expo-router (useRouter), @expo/vector-icons
 *   Used by → Expo Router route "/create-grouping" (pushed from app/(tabs)/shopping.tsx's FAB)
 *   Data    → writes shopping_items (status:'catalog', dishName) via useShoppingStore.add;
 *             reads useMealStore.dishes (From-Meals picker) + useCatalogStore.items (search)
 *
 * Edit notes:
 *   - Save is gated on a non-empty trimmed dishName AND at least one ingredient
 *     (draftIngredients + picks). Same rule the old AddDishSheet used.
 *   - `picks` (catalog id → qty) mirrors AddSourceChooser's picker state; merged with
 *     draftIngredients only at save time.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenScaffold from '@/components/ScreenScaffold';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useMealStore } from '@/store/useMealStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { success } from '@/lib/haptics';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';

type DraftIngredient = { name: string; amount: string; unit: string; price: number };
type Mode = 'new' | 'fromMeals';

export default function CreateGroupingScreen() {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const router = useRouter();

  const catalogItems = useCatalogStore((s) => s.items);
  const dishes = useMealStore((s) => s.dishes);
  const add = useShoppingStore((s) => s.add);

  const [mode, setMode] = useState<Mode>('new');
  const [dishName, setDishName] = useState('');
  const [dishSearch, setDishSearch] = useState('');
  const [draftIngredients, setDraftIngredients] = useState<DraftIngredient[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [picks, setPicks] = useState<Record<string, number>>({});

  const dishMatches = useMemo(() => {
    const q = dishSearch.trim().toLowerCase();
    return q ? dishes.filter((d) => d.name.toLowerCase().includes(q)) : dishes;
  }, [dishes, dishSearch]);

  const filteredCatalogItems = useMemo(() => {
    const q = ingredientSearch.trim().toLowerCase();
    const sorted = [...catalogItems].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter((i) => i.name.toLowerCase().includes(q));
  }, [catalogItems, ingredientSearch]);

  function pickMealsDish(dishId: string) {
    const dish = dishes.find((d) => d.id === dishId);
    if (!dish) return;
    setDishName(dish.name);
    setDraftIngredients(dish.ingredients.map((ing) => ({ name: ing.name, amount: ing.amount, unit: ing.unit, price: 0 })));
  }

  function removeDraftIngredient(idx: number) {
    setDraftIngredients((prev) => prev.filter((_, i) => i !== idx));
  }
  function selectIngredient(id: string) {
    setPicks((p) => ({ ...p, [id]: 1 }));
  }
  function incrementIngredient(id: string) {
    setPicks((p) => ({ ...p, [id]: (p[id] ?? 1) + 1 }));
  }
  function decrementIngredient(id: string) {
    setPicks((p) => {
      const next = (p[id] ?? 1) - 1;
      if (next <= 0) {
        const { [id]: _removed, ...rest } = p;
        return rest;
      }
      return { ...p, [id]: next };
    });
  }
  function removePick(id: string) {
    setPicks((p) => {
      const { [id]: _removed, ...rest } = p;
      return rest;
    });
  }
  function addCustomIngredient() {
    const name = ingredientSearch.trim();
    if (!name) return;
    setDraftIngredients((prev) => [...prev, { name, amount: '1', unit: '', price: 0 }]);
    setIngredientSearch('');
  }

  const pickCount = Object.keys(picks).length;
  const canSave = !!dishName.trim() && (draftIngredients.length > 0 || pickCount > 0);

  function handleSave() {
    if (!canSave) return;
    const manual = draftIngredients.map((ing) => ({ name: ing.name, amount: ing.amount, unit: ing.unit, price: ing.price }));
    const picked = Object.entries(picks)
      .map(([id, qty]) => {
        const item = catalogItems.find((i) => i.id === id);
        return item ? { name: item.name, amount: String(qty), unit: '', price: item.price } : null;
      })
      .filter((ing): ing is { name: string; amount: string; unit: string; price: number } => ing !== null);
    const ingredients = [...manual, ...picked];
    if (ingredients.length === 0) return;
    const trimmed = dishName.trim();
    for (const ing of ingredients) {
      add({ name: ing.name, amount: ing.amount, unit: ing.unit, listType: 'monthly', store: '', price: ing.price, inventoryQty: 0, status: 'catalog', dishName: trimmed });
    }
    success();
    router.back();
  }

  return (
    <ScreenScaffold title={t.createGroupingTitle} tier="sub" onBack={() => router.back()}>
      <View style={styles.content}>
        <Surface style={styles.card}>
          <View style={styles.modeRow}>
            <PressableScale
              style={[styles.modePill, { backgroundColor: mode === 'new' ? theme.accent : theme.surfaceMuted }]}
              onPress={() => setMode('new')}
            >
              <Text style={[styles.modePillText, { color: mode === 'new' ? theme.accentInk : theme.text }]}>{t.newDishToggle}</Text>
            </PressableScale>
            <PressableScale
              style={[styles.modePill, { backgroundColor: mode === 'fromMeals' ? theme.accent : theme.surfaceMuted }]}
              onPress={() => setMode('fromMeals')}
            >
              <Text style={[styles.modePillText, { color: mode === 'fromMeals' ? theme.accentInk : theme.text }]}>{t.fromMealsToggle}</Text>
            </PressableScale>
          </View>

          {mode === 'fromMeals' && (
            <>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                value={dishSearch}
                onChangeText={setDishSearch}
                placeholder={t.pickDishSearchPlaceholder}
                placeholderTextColor={theme.textMuted}
              />
              {dishMatches.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.noDishesAvailable}</Text>
              ) : (
                <View style={[styles.pickBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                  <ScrollView keyboardShouldPersistTaps="handled" style={styles.dishPickScroll} nestedScrollEnabled>
                    {dishMatches.map((d) => (
                      <Pressable
                        key={d.id}
                        style={[styles.pickRow, dishName === d.name && { backgroundColor: theme.accentSoft }]}
                        onPress={() => pickMealsDish(d.id)}
                      >
                        <Text style={[styles.pickName, { color: theme.text }]} numberOfLines={1}>{d.name}</Text>
                        <Text style={[styles.pickMeta, { color: theme.textMuted }]}>{t.ingredientsCount(d.ingredients.length)}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}

          <Text style={[styles.label, { color: theme.textMuted }]}>{t.dishNamePlaceholder}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
            value={dishName}
            onChangeText={setDishName}
            placeholder={t.dishNamePlaceholder}
            placeholderTextColor={theme.textMuted}
          />

          {draftIngredients.map((ing, idx) => (
            <View key={`manual-${idx}`} style={[styles.draftRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.draftText, { color: theme.text }]} numberOfLines={1}>
                {ing.amount} {ing.unit} {ing.name}
                {ing.price > 0 ? ` · ${ing.price.toFixed(0)} kr` : ''}
              </Text>
              <Pressable onPress={() => removeDraftIngredient(idx)} hitSlop={8}>
                <Text style={[styles.removeText, { color: theme.textMuted }]}>−</Text>
              </Pressable>
            </View>
          ))}
          {Object.entries(picks).map(([id, qty]) => {
            const item = catalogItems.find((i) => i.id === id);
            if (!item) return null;
            return (
              <View key={`pick-${id}`} style={[styles.draftRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.draftText, { color: theme.text }]} numberOfLines={1}>
                  {qty} × {item.name}
                  {item.price > 0 ? ` · ${item.price.toFixed(0)} kr` : ''}
                </Text>
                <Pressable onPress={() => removePick(id)} hitSlop={8}>
                  <Text style={[styles.removeText, { color: theme.textMuted }]}>−</Text>
                </Pressable>
              </View>
            );
          })}

          <Text style={[styles.label, { color: theme.textMuted }]}>{t.ingredientPlaceholder}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
            value={ingredientSearch}
            onChangeText={setIngredientSearch}
            placeholder={t.ingredientSearchPlaceholder}
            placeholderTextColor={theme.textMuted}
          />
          <View style={[styles.pickBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.catalogPickScroll} nestedScrollEnabled>
              {filteredCatalogItems.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.noCatalogMatches}</Text>
              ) : (
                filteredCatalogItems.map((item) => {
                  const qty = picks[item.id];
                  const isSelected = qty !== undefined;
                  return (
                    <View key={item.id} style={[styles.pickRow, isSelected && { backgroundColor: theme.accentSoft }]}>
                      <View style={styles.pickNameWrap}>
                        <Text style={[styles.pickName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                        {item.price > 0 && (
                          <Text style={[styles.pickMeta, { color: theme.textMuted }]}>{item.price.toFixed(0)} kr</Text>
                        )}
                      </View>
                      {isSelected ? (
                        <View style={styles.stepperRow}>
                          <Pressable style={[styles.stepBtn, { backgroundColor: theme.surface }]} onPress={() => decrementIngredient(item.id)} hitSlop={6}>
                            <Text style={[styles.stepText, { color: theme.text }]}>−</Text>
                          </Pressable>
                          <Text style={[styles.qtyText, { color: theme.text }]}>{qty}</Text>
                          <Pressable style={[styles.stepBtn, { backgroundColor: theme.accent }]} onPress={() => incrementIngredient(item.id)} hitSlop={6}>
                            <Text style={[styles.stepText, { color: theme.accentInk }]}>+</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable style={[styles.addBtn, { backgroundColor: theme.accentSoft }]} onPress={() => selectIngredient(item.id)} hitSlop={6}>
                          <Text style={[styles.addBtnText, { color: theme.accent }]}>+</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>

          {ingredientSearch.trim().length > 0 && (
            <Pressable style={styles.addCustomRow} onPress={addCustomIngredient} hitSlop={4}>
              <Text style={[styles.addCustomText, { color: theme.accent }]}>{t.addCustomIngredientOption(ingredientSearch.trim())}</Text>
            </Pressable>
          )}

          <View style={styles.actionsRow}>
            <PressableScale style={styles.ghostBtn} onPress={() => router.back()}>
              <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>{t.cancelBtn}</Text>
            </PressableScale>
            <PressableScale
              style={[styles.primaryBtn, { backgroundColor: theme.accent }, !canSave && { opacity: 0.4 }]}
              onPress={handleSave}
              disabled={!canSave}
            >
              <Ionicons name="checkmark" size={18} color={theme.accentInk} />
              <Text style={[styles.primaryBtnText, { color: theme.accentInk }]}>{t.addDishBtn}</Text>
            </PressableScale>
          </View>
        </Surface>
      </View>
    </ScreenScaffold>
  );
}

const baseStyles = StyleSheet.create({
  content: { padding: Spacing.md },
  card: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.xs },
  modeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  modePill: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center' },
  modePillText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  label: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, marginTop: Spacing.sm, marginBottom: 4 },
  input: { borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.md, marginBottom: Spacing.xs },
  emptyText: { fontSize: FontSize.sm, marginBottom: Spacing.sm },
  pickBox: { borderRadius: Radius.sm, borderWidth: 1, marginBottom: Spacing.sm, overflow: 'hidden' },
  dishPickScroll: { maxHeight: 160 },
  catalogPickScroll: { maxHeight: 240 },
  pickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  pickNameWrap: { flex: 1, minWidth: 0, marginRight: Spacing.sm },
  pickName: { flex: 1, fontSize: FontSize.sm },
  pickMeta: { fontSize: FontSize.xs },
  draftRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1 },
  draftText: { flex: 1, fontSize: FontSize.sm },
  removeText: { fontSize: 20 },
  addBtn: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: FontSize.md, fontFamily: Fonts.bold, lineHeight: 20 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  stepBtn: { width: 26, height: 26, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  qtyText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, minWidth: 20, textAlign: 'center' },
  addCustomRow: { paddingVertical: Spacing.sm },
  addCustomText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  ghostBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  ghostBtnText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  primaryBtn: { flex: 1, flexDirection: 'row', gap: Spacing.xs, paddingVertical: Spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  primaryBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
