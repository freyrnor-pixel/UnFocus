/**
 * FoodTab.tsx — the Shopping screen's in-place "Food" tab (dish library + push-to-list).
 *
 * Renders one glass Surface section per meal type (breakfast/lunch/dinner/snack/kveldsmat),
 * each tinted with that meal's colour ("a touch of colour by type"). A dish shows as a
 * collapsed row (name · total price · "+"); the "+" opens a small popup with two choices —
 * "Add to week list" (ingredients go to the weekly Unallocated bucket, listId
 * UNALLOCATED_LIST_ID) and "Add to monthly list" (ingredients become status='catalog'
 * rows) — plus an X. Expanding a dish reveals its ingredient rows (name · amount · line
 * price), the same shape as task steps, with an inline add-ingredient row and per-dish
 * delete. Dish creation lives here (per-section "add dish" modal) — this replaces the old
 * standalone /meals screen and the "Create grouping" screen.
 *
 * Connections:
 *   Imports → constants/theme (getMaterialStyle, contrastOn, tokens), lib/useAppTheme,
 *             lib/i18n, lib/haptics, lib/money (formatKr), components/Surface,
 *             store/useMealStore (Dish/MealType/dishTotalPrice + CRUD),
 *             store/useCatalogStore (suggest, StoreItem), store/useShoppingStore
 *             (add + UNALLOCATED_LIST_ID), @expo/vector-icons
 *   Used by → app/(tabs)/shopping.tsx (rendered when the Food tab is active)
 *   Data    → useMealStore (dishes/ingredients), useShoppingStore.add (weekly/monthly pushes),
 *             useCatalogStore.suggest (ingredient price autocomplete)
 *
 * Edit notes:
 *   - Renders no ScrollView of its own — it lives inside the Shopping screen's scaffold
 *     ScrollView. The new-dish + "add to list" popups are RN <Modal>s (own layers).
 *   - A dish's total price is dishTotalPrice() = Σ ingredient.priceNok (NOT dish.estimatedPriceNok).
 *   - Pushes carry dishName so the Unallocated card and the Monthly list can group by dish.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import { useMealStore, MealType, Dish, dishTotalPrice } from '@/store/useMealStore';
import { useCatalogStore, StoreItem } from '@/store/useCatalogStore';
import { useShoppingStore, UNALLOCATED_LIST_ID } from '@/store/useShoppingStore';
import { getMaterialStyle, contrastOn, Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { success, heavy } from '@/lib/haptics';
import { formatKr } from '@/lib/money';

type Props = {
  /** Show a transient confirmation banner in the parent screen. */
  onNotify: (msg: string) => void;
};

const MEAL_ORDER: { value: MealType; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'breakfast', icon: 'sunny-outline' },
  { value: 'lunch', icon: 'fast-food-outline' },
  { value: 'dinner', icon: 'restaurant-outline' },
  { value: 'snack', icon: 'nutrition-outline' },
  { value: 'kveldsmat', icon: 'moon-outline' },
];

/** "A touch of colour based on the type of meal" — the glass tint per meal section. */
const MEAL_COLORS: Record<MealType, string> = {
  breakfast: '#F59E0B',
  lunch: '#10B981',
  dinner: '#EF4444',
  snack: '#8B5CF6',
  kveldsmat: '#6366F1',
};

type DraftIngredient = { name: string; amount: string; unit: string; price: number };

export default function FoodTab({ onNotify }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  const dishes = useMealStore((s) => s.dishes);
  const loadDishes = useMealStore((s) => s.load);
  const addDish = useMealStore((s) => s.addDish);
  const removeDish = useMealStore((s) => s.removeDish);
  const addIngredient = useMealStore((s) => s.addIngredient);
  const removeIngredient = useMealStore((s) => s.removeIngredient);
  const suggest = useCatalogStore((s) => s.suggest);
  const shoppingAdd = useShoppingStore((s) => s.add);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [popupDish, setPopupDish] = useState<Dish | null>(null);

  // New-dish modal state
  const [modalMealType, setModalMealType] = useState<MealType | null>(null);
  const [dishName, setDishName] = useState('');
  const [draftIngredients, setDraftIngredients] = useState<DraftIngredient[]>([]);
  const [ingName, setIngName] = useState('');
  const [ingAmount, setIngAmount] = useState('1');
  const [ingUnit, setIngUnit] = useState('');
  const [ingPrice, setIngPrice] = useState('');
  const [suggestions, setSuggestions] = useState<StoreItem[]>([]);

  // Inline "add ingredient to existing dish" state (keyed by dish id)
  const [inlineIng, setInlineIng] = useState<Record<string, { name: string; amount: string; price: string }>>({});

  useEffect(() => {
    loadDishes();
  }, [loadDishes]);

  const byMeal = useMemo(() => {
    const map = new Map<MealType, Dish[]>();
    for (const d of dishes) {
      const arr = map.get(d.mealType) ?? [];
      arr.push(d);
      map.set(d.mealType, arr);
    }
    return map;
  }, [dishes]);

  function openNewDishModal(mealType: MealType) {
    setModalMealType(mealType);
    setDishName('');
    setDraftIngredients([]);
    setIngName('');
    setIngAmount('1');
    setIngUnit('');
    setIngPrice('');
    setSuggestions([]);
  }

  function onIngNameChange(text: string) {
    setIngName(text);
    setSuggestions(text.trim().length >= 2 ? suggest(text, 5) : []);
  }

  function addDraftIngredient() {
    const name = ingName.trim();
    if (!name) return;
    setDraftIngredients((prev) => [...prev, { name, amount: ingAmount || '1', unit: ingUnit, price: parseFloat(ingPrice.replace(',', '.')) || 0 }]);
    setIngName('');
    setIngAmount('1');
    setIngUnit('');
    setIngPrice('');
    setSuggestions([]);
  }

  function removeDraftIngredient(idx: number) {
    setDraftIngredients((prev) => prev.filter((_, i) => i !== idx));
  }

  function saveDish() {
    if (!dishName.trim() || !modalMealType) return;
    const dish = addDish({ name: dishName.trim(), mealType: modalMealType });
    for (const ing of draftIngredients) {
      addIngredient({ dishId: dish.id, name: ing.name, amount: ing.amount, unit: ing.unit, priceNok: ing.price });
    }
    success();
    setModalMealType(null);
  }

  function handleInlineAdd(dish: Dish) {
    const draft = inlineIng[dish.id];
    const name = draft?.name?.trim();
    if (!name) return;
    addIngredient({
      dishId: dish.id,
      name,
      amount: draft.amount?.trim() || '1',
      unit: '',
      priceNok: parseFloat((draft.price ?? '').replace(',', '.')) || 0,
    });
    setInlineIng((prev) => ({ ...prev, [dish.id]: { name: '', amount: '1', price: '' } }));
    success();
  }

  function handleAddToWeek(dish: Dish) {
    if (dish.ingredients.length === 0) {
      onNotify(t.addToListNoIngredients);
      setPopupDish(null);
      return;
    }
    for (const ing of dish.ingredients) {
      shoppingAdd({
        name: ing.name,
        amount: ing.amount || '1',
        unit: ing.unit,
        listType: 'weekly',
        store: '',
        price: ing.priceNok,
        inventoryQty: 0,
        status: 'inWeeklyList',
        listId: UNALLOCATED_LIST_ID,
        dishName: dish.name,
      });
    }
    success();
    setPopupDish(null);
    onNotify(t.dishAddedToWeek(dish.name));
  }

  function handleAddToMonthly(dish: Dish) {
    if (dish.ingredients.length === 0) {
      onNotify(t.addToListNoIngredients);
      setPopupDish(null);
      return;
    }
    for (const ing of dish.ingredients) {
      shoppingAdd({
        name: ing.name,
        amount: '1',
        unit: ing.unit,
        listType: 'monthly',
        store: '',
        price: ing.priceNok,
        inventoryQty: 0,
        status: 'catalog',
        targetQuantity: parseInt(ing.amount, 10) || 1,
        dishName: dish.name,
      });
    }
    success();
    setPopupDish(null);
    onNotify(t.dishAddedToMonthly(dish.name));
  }

  const canSaveDish = !!dishName.trim();

  return (
    <View style={styles.root}>
      {MEAL_ORDER.map(({ value: mealType, icon }) => {
        const color = MEAL_COLORS[mealType];
        const mat = getMaterialStyle(color);
        const ink = contrastOn(mat.contrastBase);
        const mealDishes = byMeal.get(mealType) ?? [];
        return (
          <Surface key={mealType} tint={color} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={icon} size={20} color={ink} />
              <Text style={[styles.sectionTitle, { color: ink }]}>{t.mealTypes[mealType]}</Text>
              <Pressable
                style={[styles.addDishBtn, { borderColor: ink }]}
                onPress={() => openNewDishModal(mealType)}
                accessibilityRole="button"
                accessibilityLabel={t.addDishToMealBtn}
                hitSlop={6}
              >
                <Ionicons name="add" size={18} color={ink} />
              </Pressable>
            </View>

            {mealDishes.length === 0 ? (
              <Text style={[styles.sectionEmpty, { color: ink }]}>{t.foodEmptyHint}</Text>
            ) : (
              <View style={styles.dishList}>
                {mealDishes.map((dish) => {
                  const isOpen = !!expanded[dish.id];
                  const total = dishTotalPrice(dish);
                  const draft = inlineIng[dish.id] ?? { name: '', amount: '1', price: '' };
                  return (
                    <View key={dish.id} style={[styles.dishCard, { backgroundColor: theme.surface }]}>
                      {/* Collapsed row: expand toggle · name · total price · "+" */}
                      <View style={styles.dishRow}>
                        <Pressable style={styles.dishNameTap} onPress={() => setExpanded((p) => ({ ...p, [dish.id]: !p[dish.id] }))} hitSlop={4}>
                          <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={16} color={theme.textMuted} />
                          <Text style={[styles.dishName, { color: theme.text }]} numberOfLines={1}>{dish.name}</Text>
                        </Pressable>
                        {total > 0 && (
                          <Text style={[styles.dishPrice, { color: theme.textMuted }]}>{formatKr(total, 0)}</Text>
                        )}
                        <Pressable
                          style={[styles.dishAddBtn, { backgroundColor: color }]}
                          onPress={() => setPopupDish(dish)}
                          accessibilityRole="button"
                          accessibilityLabel={t.addDishPopupTitle(dish.name)}
                          hitSlop={6}
                        >
                          <Ionicons name="add" size={18} color={contrastOn(color)} />
                        </Pressable>
                      </View>

                      {/* Expanded: ingredient rows (name · amount · line price) + inline add + delete dish */}
                      {isOpen && (
                        <View style={styles.ingBody}>
                          {dish.ingredients.map((ing) => (
                            <View key={ing.id} style={[styles.ingRow, { borderTopColor: theme.border }]}>
                              <Text style={[styles.ingName, { color: theme.text }]} numberOfLines={1}>{ing.name}</Text>
                              <Text style={[styles.ingAmount, { color: theme.textMuted }]} numberOfLines={1}>
                                {ing.amount}{ing.unit ? ` ${ing.unit}` : ''}
                              </Text>
                              {ing.priceNok > 0 && (
                                <Text style={[styles.ingPrice, { color: theme.textMuted }]}>{formatKr(ing.priceNok, 0)}</Text>
                              )}
                              <Pressable onPress={() => removeIngredient(ing.id)} hitSlop={8} accessibilityLabel={t.removeItemLabel}>
                                <Ionicons name="remove-circle-outline" size={18} color={theme.textMuted} />
                              </Pressable>
                            </View>
                          ))}

                          {/* Inline add-ingredient row */}
                          <View style={[styles.ingAddRow, { borderTopColor: theme.border }]}>
                            <TextInput
                              style={[styles.ingAddName, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                              value={draft.name}
                              onChangeText={(v) => setInlineIng((p) => ({ ...p, [dish.id]: { ...draft, name: v } }))}
                              placeholder={t.ingredientPlaceholder}
                              placeholderTextColor={theme.textMuted}
                            />
                            <TextInput
                              style={[styles.ingAddQty, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                              value={draft.amount}
                              onChangeText={(v) => setInlineIng((p) => ({ ...p, [dish.id]: { ...draft, amount: v } }))}
                              placeholder="1"
                              placeholderTextColor={theme.textMuted}
                            />
                            <TextInput
                              style={[styles.ingAddPrice, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                              value={draft.price}
                              onChangeText={(v) => setInlineIng((p) => ({ ...p, [dish.id]: { ...draft, price: v } }))}
                              placeholder={t.catalogueItemPricePlaceholder}
                              placeholderTextColor={theme.textMuted}
                              keyboardType="decimal-pad"
                            />
                            <Pressable
                              style={[styles.ingAddBtn, { backgroundColor: draft.name.trim() ? color : theme.surfaceMuted }]}
                              onPress={() => handleInlineAdd(dish)}
                              disabled={!draft.name.trim()}
                              hitSlop={4}
                            >
                              <Ionicons name="add" size={16} color={draft.name.trim() ? contrastOn(color) : theme.textMuted} />
                            </Pressable>
                          </View>

                          <Pressable style={styles.deleteDishRow} onPress={() => { removeDish(dish.id); heavy(); }} hitSlop={6}>
                            <Ionicons name="trash-outline" size={14} color={theme.bad} />
                            <Text style={[styles.deleteDishText, { color: theme.bad }]}>{t.deleteDish}</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </Surface>
        );
      })}

      {/* ── Dish "+" popup: Add to week list / Add to monthly list, X to close ── */}
      <Modal visible={popupDish !== null} transparent animationType="fade" onRequestClose={() => setPopupDish(null)}>
        <Pressable style={[styles.popupOverlay, { backgroundColor: theme.overlay }]} onPress={() => setPopupDish(null)} />
        <View style={styles.popupWrapper} pointerEvents="box-none">
          <Surface surfaceContext="overlay" style={styles.popupCard}>
            <View style={styles.popupHeader}>
              <Text style={[styles.popupTitle, { color: theme.text }]} numberOfLines={1}>{popupDish?.name}</Text>
              <Pressable onPress={() => setPopupDish(null)} hitSlop={8} accessibilityLabel={t.closePopupLabel}>
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </Pressable>
            </View>
            <Pressable
              style={[styles.popupBtn, { backgroundColor: theme.good }]}
              onPress={() => popupDish && handleAddToWeek(popupDish)}
            >
              <Ionicons name="cart-outline" size={18} color={theme.textInverse} />
              <Text style={[styles.popupBtnText, { color: theme.textInverse }]}>{t.addToWeekListBtn}</Text>
            </Pressable>
            <Pressable
              style={[styles.popupBtn, { backgroundColor: theme.accent }]}
              onPress={() => popupDish && handleAddToMonthly(popupDish)}
            >
              <Ionicons name="calendar-outline" size={18} color={theme.accentInk} />
              <Text style={[styles.popupBtnText, { color: theme.accentInk }]}>{t.addToMonthlyListBtn}</Text>
            </Pressable>
          </Surface>
        </View>
      </Modal>

      {/* ── New-dish modal ── */}
      <Modal visible={modalMealType !== null} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={() => setModalMealType(null)}>
        <Pressable style={[styles.popupOverlay, { backgroundColor: theme.overlay }]} onPress={() => setModalMealType(null)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrapper}>
          <Surface surfaceContext="overlay" style={styles.sheet}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <Pressable onPress={() => setModalMealType(null)}>
                <Text style={[styles.sheetCancel, { color: theme.textMuted }]}>{t.cancel}</Text>
              </Pressable>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                {modalMealType ? t.mealTypes[modalMealType] : ''} · {t.newDishTrigger}
              </Text>
              <Pressable onPress={saveDish} disabled={!canSaveDish}>
                <Text style={[styles.sheetSave, { color: theme.accent }, !canSaveDish && { opacity: 0.4 }]}>{t.save}</Text>
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent}>
              <TextInput
                style={[styles.nameInput, { backgroundColor: theme.surfaceMuted, color: theme.text, borderColor: theme.accent }]}
                value={dishName}
                onChangeText={setDishName}
                placeholder={t.dishNamePlaceholder}
                placeholderTextColor={theme.textMuted}
              />

              {draftIngredients.map((ing, idx) => (
                <View key={idx} style={[styles.draftRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.draftText, { color: theme.text }]} numberOfLines={1}>
                    {ing.amount}{ing.unit ? ` ${ing.unit}` : ''} {ing.name}
                    {ing.price > 0 ? ` · ${formatKr(ing.price, 0)}` : ''}
                  </Text>
                  <Pressable onPress={() => removeDraftIngredient(idx)} hitSlop={8}>
                    <Ionicons name="remove-circle-outline" size={18} color={theme.textMuted} />
                  </Pressable>
                </View>
              ))}

              <View style={styles.ingAddRow}>
                <TextInput
                  style={[styles.amountInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                  value={ingAmount}
                  onChangeText={setIngAmount}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={theme.textMuted}
                />
                <TextInput
                  style={[styles.unitInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                  value={ingUnit}
                  onChangeText={setIngUnit}
                  placeholder={t.shoppingUnitPlaceholder}
                  placeholderTextColor={theme.textMuted}
                />
                <TextInput
                  style={[styles.ingNameInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                  value={ingName}
                  onChangeText={onIngNameChange}
                  placeholder={t.ingredientPlaceholder}
                  placeholderTextColor={theme.textMuted}
                />
                <TextInput
                  style={[styles.priceInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                  value={ingPrice}
                  onChangeText={setIngPrice}
                  keyboardType="decimal-pad"
                  placeholder={t.catalogueItemPricePlaceholder}
                  placeholderTextColor={theme.textMuted}
                  onSubmitEditing={addDraftIngredient}
                />
                <Pressable style={[styles.addIngBtn, { backgroundColor: theme.accent }]} onPress={addDraftIngredient}>
                  <Ionicons name="add" size={18} color={theme.accentInk} />
                </Pressable>
              </View>

              {suggestions.length > 0 && (
                <View style={[styles.suggestList, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {suggestions.map((item) => (
                    <Pressable
                      key={item.id}
                      style={[styles.suggestRow, { borderBottomColor: theme.border }]}
                      onPress={() => {
                        setIngName(item.name);
                        if (item.price > 0) setIngPrice(String(item.price));
                        setSuggestions([]);
                      }}
                    >
                      <Text style={[styles.suggestText, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                      {item.price > 0 && <Text style={[styles.suggestMeta, { color: theme.textMuted }]}>{formatKr(item.price, 0)}</Text>}
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          </Surface>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  root: { gap: Spacing.md },
  section: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { flex: 1, fontSize: FontSize.lg, fontFamily: Fonts.bold },
  addDishBtn: { width: 30, height: 30, borderRadius: Radius.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sectionEmpty: { fontSize: FontSize.sm, opacity: 0.85, paddingVertical: Spacing.xs },
  dishList: { gap: Spacing.xs },
  dishCard: { borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  dishRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 44 },
  dishNameTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dishName: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.semibold },
  dishPrice: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  dishAddBtn: { width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  ingBody: { paddingBottom: Spacing.xs },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
  ingName: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.medium },
  ingAmount: { fontSize: FontSize.xs, minWidth: 40, textAlign: 'right' },
  ingPrice: { fontSize: FontSize.xs, minWidth: 48, textAlign: 'right' },
  ingAddRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingTop: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
  ingAddName: { flex: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6, fontSize: FontSize.sm },
  ingAddQty: { width: 40, borderRadius: Radius.sm, paddingHorizontal: 4, paddingVertical: 6, fontSize: FontSize.sm, textAlign: 'center' },
  ingAddPrice: { width: 64, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 6, fontSize: FontSize.sm },
  ingAddBtn: { width: 30, height: 30, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  deleteDishRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: Spacing.xs },
  deleteDishText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },

  // Popup
  popupOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  popupWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  popupCard: { width: '100%', maxWidth: 360, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  popupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  popupTitle: { flex: 1, fontSize: FontSize.lg, fontFamily: Fonts.bold, marginRight: Spacing.sm },
  popupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.md, paddingVertical: Spacing.md, minHeight: 48 },
  popupBtnText: { fontSize: FontSize.md, fontFamily: Fonts.bold },

  // New-dish sheet
  sheetWrapper: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl, maxHeight: '90%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.sm, borderBottomWidth: 1 },
  sheetTitle: { fontSize: FontSize.md, fontFamily: Fonts.bold, flex: 1, textAlign: 'center' },
  sheetCancel: { fontSize: FontSize.md },
  sheetSave: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  sheetScroll: { flexGrow: 0 },
  sheetScrollContent: { gap: Spacing.md },
  nameInput: { borderWidth: 2, borderRadius: Radius.sm, padding: Spacing.md, fontSize: FontSize.md },
  draftRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  draftText: { flex: 1, fontSize: FontSize.sm },
  amountInput: { width: 44, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm, textAlign: 'center' },
  unitInput: { width: 52, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm },
  ingNameInput: { flex: 1, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm },
  priceInput: { width: 60, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm },
  addIngBtn: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  suggestList: { maxHeight: 160, borderWidth: 1, borderRadius: Radius.sm },
  suggestRow: { padding: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  suggestText: { flex: 1, fontSize: FontSize.sm },
  suggestMeta: { fontSize: FontSize.xs },
});
