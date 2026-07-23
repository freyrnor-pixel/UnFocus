/**
 * FoodTab.tsx — dish library + push-to-list list UI.
 *
 * Renders one glass Surface section per meal type (breakfast/lunch/dinner/snack/kveldsmat),
 * each tinted with that meal's colour ("a touch of colour by type"). Each meal-type section
 * is itself a collapsible container (header row toggles it, collapsed by default — see Edit
 * notes) holding that meal's dishes. A dish shows as a collapsed row (name · total price ·
 * "+"); the "+" opens a small popup with two choices — "Add to week list" (ingredients go to
 * the weekly Unallocated bucket, listId UNALLOCATED_LIST_ID) and "Add to monthly list"
 * (ingredients become status='catalog' rows) — plus an X. Expanding a dish reveals its
 * ingredient rows (name · amount · line price), the same shape as task steps, with an inline
 * add-ingredient row and per-dish delete. Dish creation lives here (per-section "add dish"
 * modal) — this replaces the old standalone /meals screen and the "Create grouping" screen.
 *
 * Connections:
 *   Imports → constants/theme (contrastOn, tokens), constants/motion (Spring),
 *             lib/useAppTheme, lib/i18n, lib/haptics, lib/money (formatKr), lib/domainColor,
 *             components/Surface, components/PressableScale, components/AddRow,
 *             components/Badge (difficulty pill), components/SlideSelector (difficulty picker),
 *             components/Collapsible + components/AnimatedChevron (meal-section collapse),
 *             store/useMealStore (Dish/MealType/Difficulty/dishTotalPrice + CRUD incl.
 *             duplicateDish), store/useCatalogStore (suggest, StoreItem),
 *             store/useShoppingStore (add + UNALLOCATED_LIST_ID), @expo/vector-icons
 *   Used by → app/food.tsx (its own button-launched sub-screen as of 2026-07-23, UX audit
 *             F1 — was app/(tabs)/shopping.tsx's in-place "Food" tab before that)
 *   Data    → useMealStore (dishes/ingredients), useShoppingStore.add (weekly/monthly pushes),
 *             useCatalogStore.suggest (ingredient price autocomplete)
 *
 * Edit notes:
 *   - **Collapsible meal sections (visual-audit, 2026-07-17)**: `openSections` (one bool per
 *     MealType, all false initially) gates each section's body via `Collapsible` — five
 *     always-open sections used to push the actually-useful dish rows far down the screen on
 *     first open. The header row (icon + title + chevron) is now a `PressableScale` that
 *     toggles the section; the "add dish" button inside it is a nested `PressableScale` with
 *     `e.stopPropagation()` (same pattern ExpandableCard.tsx uses for its leading/right
 *     actions) so tapping "+" opens the new-dish modal without also toggling the section.
 *     `AnimatedChevron` mirrors the per-dish row's chevron for a consistent expand affordance.
 *     No persistence — every section re-collapses on next mount, matching the per-dish
 *     `expanded` state below.
 *   - Renders no ScrollView of its own — it lives inside the Shopping screen's scaffold
 *     ScrollView. The new-dish + "add to list" popups are RN <Modal>s (own layers).
 *   - Both ingredient composers (the per-dish inline add row and the new-dish modal's
 *     ingredient row) use the shared AddRow, accented with domainColor('meal') — amount/
 *     unit/price stay as AddRow `extras` inputs, matching CatalogueTab's pattern.
 *   - A dish's total price is dishTotalPrice() = Σ ingredient.priceNok (NOT dish.estimatedPriceNok).
 *   - Pushes carry dishName so the Unallocated card and the Monthly list can group by dish.
 *   - **Decision 044b (2026-07-09):** `handleAddToWeek` now collects the ids `shoppingAdd`
 *     returns and reports them via the optional `onAddedToWeek` prop, so the parent screen
 *     can play the new-row entrance/highlight on the Weekly tab's Unallocated card and
 *     pulse the Weekly tab label — the push itself never navigates the user there.
 *   - Difficulty (easy/normal): shown as a `Badge` on the collapsed dish row, set via a
 *     compact `SlideSelector` in the new-dish modal (defaults to 'normal'). Duplicating a
 *     dish (copy button in the expanded body, next to delete) calls useMealStore's
 *     duplicateDish — the copy keeps the same difficulty/ingredients and gets a localized
 *     "(copy)" name suffix so users can create edited variants without losing the original.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import AddRow from '@/components/AddRow';
import { Badge } from '@/components/Badge';
import SlideSelector from '@/components/SlideSelector';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import { useMealStore, MealType, Difficulty, Dish, dishTotalPrice } from '@/store/useMealStore';
import { useCatalogStore, StoreItem } from '@/store/useCatalogStore';
import { useShoppingStore, UNALLOCATED_LIST_ID } from '@/store/useShoppingStore';
import { useMonthlyListStore } from '@/store/useMonthlyListStore';
import { showAppModal } from '@/components/AppModal';
import { contrastOn, Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles, useAccessibility } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { useMountedTransition } from '@/lib/useMountedTransition';
import { Spring } from '@/constants/motion';
import { success, heavy } from '@/lib/haptics';
import { formatKr } from '@/lib/money';
import { getDomainColor } from '@/lib/domainColor';

type Props = {
  /** Show a transient confirmation banner in the parent screen. */
  onNotify: (msg: string) => void;
  /** Decision 044b — reports the ids just pushed to the weekly Unallocated bucket, so the
   *  parent can play their entrance/highlight animation and pulse the Weekly tab. */
  onAddedToWeek?: (ids: string[]) => void;
};

const MEAL_ORDER: { value: MealType; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'breakfast', icon: 'sunny-outline' },
  { value: 'lunch', icon: 'fast-food-outline' },
  { value: 'dinner', icon: 'restaurant-outline' },
  { value: 'snack', icon: 'nutrition-outline' },
  { value: 'kveldsmat', icon: 'moon-outline' },
];

/**
 * "A touch of colour based on the type of meal" — the frosted glass tint per meal section.
 * (2026-07-18) Retuned to a calm, low-saturation set that steers CLEAR of semantic red/green:
 * lunch was `#10B981` (collided with `good`/done) and dinner `#EF4444` (collided with `bad`/
 * delete), which read as status signals on a food card. The new set keeps a warm→cool meal
 * progression without ever landing on a pure success-green or error-red.
 */
const MEAL_COLORS: Record<MealType, string> = {
  breakfast: '#E0A85A', // soft morning amber
  lunch: '#4FB3A6',     // muted teal (was collision-green)
  dinner: '#D9825A',    // warm terracotta (was collision-red)
  snack: '#9B87D6',     // soft lavender
  kveldsmat: '#7A80D6', // calm indigo
};

type DraftIngredient = { name: string; amount: string; unit: string; price: number };

export default function FoodTab({ onNotify, onAddedToWeek }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const domainColor = getDomainColor(theme, 'meal');

  const dishes = useMealStore((s) => s.dishes);
  const loadDishes = useMealStore((s) => s.load);
  const addDish = useMealStore((s) => s.addDish);
  const removeDish = useMealStore((s) => s.removeDish);
  const duplicateDish = useMealStore((s) => s.duplicateDish);
  const addIngredient = useMealStore((s) => s.addIngredient);
  const removeIngredient = useMealStore((s) => s.removeIngredient);
  const suggest = useCatalogStore((s) => s.suggest);
  const shoppingAdd = useShoppingStore((s) => s.add);
  const monthlyLists = useMonthlyListStore((s) => s.lists);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Meal-type sections (the dish-list containers) collapse independently, collapsed by
  // default (visual-audit 2026-07-17: five always-open sections pushed the actually-useful
  // dish rows far down the screen on first open). No persistence — re-collapses on next
  // mount, matching the per-dish `expanded` state above.
  const [openSections, setOpenSections] = useState<Record<MealType, boolean>>({
    breakfast: false,
    lunch: false,
    dinner: false,
    snack: false,
    kveldsmat: false,
  });
  const toggleSection = useCallback((mealType: MealType) => {
    setOpenSections((prev) => ({ ...prev, [mealType]: !prev[mealType] }));
  }, []);
  const [popupDish, setPopupDish] = useState<Dish | null>(null);
  // Decision 044b — mounted-state/exit-animation pattern (both popups already read their
  // nullable state via `?.`/`&&` guards, so no value-caching is needed, unlike ListSettingsSheet).
  const popupTransition = useMountedTransition(popupDish !== null, reducedMotion);
  const popupBackdropStyle = useAnimatedStyle(() => ({ opacity: popupTransition.progress.value }));
  const popupCardStyle = useAnimatedStyle(() => ({
    opacity: popupTransition.progress.value,
    transform: [{ scale: 0.92 + popupTransition.progress.value * 0.08 }],
  }));

  // New-dish modal state
  const [modalMealType, setModalMealType] = useState<MealType | null>(null);
  const dishModalTransition = useMountedTransition(modalMealType !== null, reducedMotion);
  const dishModalBackdropStyle = useAnimatedStyle(() => ({ opacity: dishModalTransition.progress.value }));
  const dishModalSheetStyle = useAnimatedStyle(() => ({
    opacity: dishModalTransition.progress.value,
    transform: [{ translateY: (1 - dishModalTransition.progress.value) * 24 }],
  }));
  const [dishName, setDishName] = useState('');
  const [dishDifficulty, setDishDifficulty] = useState<Difficulty>('normal');
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
    setDishDifficulty('normal');
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
    const dish = addDish({ name: dishName.trim(), mealType: modalMealType, difficulty: dishDifficulty });
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
    const addedIds: string[] = [];
    for (const ing of dish.ingredients) {
      addedIds.push(shoppingAdd({
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
      }));
    }
    success();
    setPopupDish(null);
    onNotify(t.dishAddedToWeek(dish.name));
    onAddedToWeek?.(addedIds);
  }

  // Shopping — Monthly redesign (2026-07-22): a dish's ingredients now need a target
  // Monthly list, not just "the" catalog. Auto-picks the only list in the common
  // single-list case (no extra tap); with 2+ lists, asks which one via the same lightweight
  // showAppModal chooser app/(tabs)/shopping.tsx's handleAllocate uses for weekly lists.
  function pushDishToMonthlyList(dish: Dish, monthlyListId: string) {
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
        monthlyListId,
      });
    }
    success();
    setPopupDish(null);
    onNotify(t.dishAddedToMonthly(dish.name));
  }

  function handleAddToMonthly(dish: Dish) {
    if (dish.ingredients.length === 0) {
      onNotify(t.addToListNoIngredients);
      setPopupDish(null);
      return;
    }
    if (monthlyLists.length === 0) {
      onNotify(t.monthlyListsEmpty);
      setPopupDish(null);
      return;
    }
    if (monthlyLists.length === 1) {
      pushDishToMonthlyList(dish, monthlyLists[0].id);
      return;
    }
    setPopupDish(null);
    showAppModal(t.allocateToListTitle, '', [
      ...monthlyLists.map((l) => ({ text: l.name, onPress: () => pushDishToMonthlyList(dish, l.id) })),
      { text: t.cancel, style: 'cancel' as const },
    ]);
  }

  const canSaveDish = !!dishName.trim();

  return (
    <View style={styles.root}>
      {MEAL_ORDER.map(({ value: mealType, icon }) => {
        const color = MEAL_COLORS[mealType];
        const mealDishes = byMeal.get(mealType) ?? [];
        const sectionOpen = openSections[mealType];
        return (
          <Surface key={mealType} borderColor={color} style={styles.section}>
            <PressableScale
              style={styles.sectionHeader}
              onPress={() => toggleSection(mealType)}
              accessibilityRole="button"
              accessibilityLabel={t.mealTypes[mealType]}
              accessibilityState={{ expanded: sectionOpen }}
              scaleTo={0.99}
              releaseSpring={Spring.calm}
            >
              <Ionicons name={icon} size={20} color={color} />
              <Text style={[styles.sectionTitle, { color }]}>{t.mealTypes[mealType]}</Text>
              <AnimatedChevron open={sectionOpen} color={color} size={18} />
              <PressableScale
                style={[styles.addDishBtn, { borderColor: color }]}
                onPress={(e) => { e.stopPropagation(); openNewDishModal(mealType); }}
                accessibilityRole="button"
                accessibilityLabel={t.addDishToMealBtn}
                hitSlop={6}
                scaleTo={0.9}
              >
                <Ionicons name="add" size={18} color={color} />
              </PressableScale>
            </PressableScale>

            <Collapsible open={sectionOpen}>
            {mealDishes.length === 0 ? (
              <Text style={[styles.sectionEmpty, { color: theme.textMuted }]}>{t.foodEmptyHint}</Text>
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
                        <PressableScale style={styles.dishNameTap} onPress={() => setExpanded((p) => ({ ...p, [dish.id]: !p[dish.id] }))} hitSlop={4} scaleTo={0.97}>
                          <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={16} color={theme.textMuted} />
                          <Text style={[styles.dishName, { color: theme.text }]} numberOfLines={1}>{dish.name}</Text>
                          <Badge
                            label={t.mealDifficulty[dish.difficulty]}
                            variant={dish.difficulty === 'easy' ? 'success' : 'neutral'}
                          />
                        </PressableScale>
                        {total > 0 && (
                          <Text style={[styles.dishPrice, { color: theme.textMuted }]}>{formatKr(total, 0)}</Text>
                        )}
                        <PressableScale
                          style={[styles.dishAddBtn, { backgroundColor: color }]}
                          onPress={() => setPopupDish(dish)}
                          accessibilityRole="button"
                          accessibilityLabel={t.addDishPopupTitle(dish.name)}
                          hitSlop={6}
                          scaleTo={0.9}
                        >
                          <Ionicons name="add" size={18} color={contrastOn(color)} />
                        </PressableScale>
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
                              <PressableScale onPress={() => removeIngredient(ing.id)} hitSlop={8} accessibilityLabel={t.removeItemLabel} scaleTo={0.9}>
                                <Ionicons name="remove-circle-outline" size={18} color={theme.textMuted} />
                              </PressableScale>
                            </View>
                          ))}

                          {/* Inline add-ingredient row — shared AddRow (name input + amount/price extras). */}
                          <AddRow
                            placeholder={t.ingredientPlaceholder}
                            value={draft.name}
                            onChangeText={(v) => setInlineIng((p) => ({ ...p, [dish.id]: { ...draft, name: v } }))}
                            onSubmit={() => handleInlineAdd(dish)}
                            accent={color}
                            accessibilityLabel={t.ingredientPlaceholder}
                            extras={
                              <>
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
                                  onSubmitEditing={() => handleInlineAdd(dish)}
                                />
                              </>
                            }
                          />

                          <View style={styles.dishFooterActions}>
                            <PressableScale
                              style={styles.deleteDishRow}
                              onPress={() => { duplicateDish(dish.id); success(); }}
                              hitSlop={6}
                              scaleTo={0.93}
                              accessibilityLabel={t.duplicateDishBtn}
                            >
                              <Ionicons name="copy-outline" size={14} color={theme.textMuted} />
                              <Text style={[styles.deleteDishText, { color: theme.textMuted }]}>{t.duplicateDishBtn}</Text>
                            </PressableScale>
                            <PressableScale style={styles.deleteDishRow} onPress={() => { removeDish(dish.id); heavy(); }} hitSlop={6} scaleTo={0.93}>
                              <Ionicons name="trash-outline" size={14} color={theme.bad} />
                              <Text style={[styles.deleteDishText, { color: theme.bad }]}>{t.deleteDish}</Text>
                            </PressableScale>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
            </Collapsible>
          </Surface>
        );
      })}

      {/* ── Dish "+" popup: Add to week list / Add to monthly list, X to close ── */}
      {/* Decision 044b: mounted-state pattern (see popupTransition above) — was a bare
          animationType="fade" with no exit animation. */}
      {popupTransition.mounted && (
        <Modal visible transparent animationType="none" onRequestClose={() => setPopupDish(null)}>
          <Pressable style={styles.popupOverlay} onPress={() => setPopupDish(null)}>
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, popupBackdropStyle]} />
          </Pressable>
          <Animated.View style={[styles.popupWrapper, popupCardStyle]} pointerEvents="box-none">
            <Surface surfaceContext="overlay" style={styles.popupCard}>
              <View style={styles.popupHeader}>
                <Text style={[styles.popupTitle, { color: theme.text }]} numberOfLines={1}>{popupDish?.name}</Text>
                <PressableScale onPress={() => setPopupDish(null)} hitSlop={8} accessibilityLabel={t.closePopupLabel} scaleTo={0.9}>
                  <Ionicons name="close" size={22} color={theme.textMuted} />
                </PressableScale>
              </View>
              <PressableScale
                style={[styles.popupBtn, { backgroundColor: theme.good }]}
                onPress={() => popupDish && handleAddToWeek(popupDish)}
                scaleTo={0.95}
              >
                <Ionicons name="cart-outline" size={18} color={theme.textInverse} />
                <Text style={[styles.popupBtnText, { color: theme.textInverse }]}>{t.addToWeekListBtn}</Text>
              </PressableScale>
              <PressableScale
                style={[styles.popupBtn, { backgroundColor: theme.accent }]}
                onPress={() => popupDish && handleAddToMonthly(popupDish)}
                scaleTo={0.95}
              >
                <Ionicons name="calendar-outline" size={18} color={theme.accentInk} />
                <Text style={[styles.popupBtnText, { color: theme.accentInk }]}>{t.addToMonthlyListBtn}</Text>
              </PressableScale>
            </Surface>
          </Animated.View>
        </Modal>
      )}

      {/* ── New-dish modal ── */}
      {/* Decision 044b: mounted-state pattern (see dishModalTransition above) — was a bare
          animationType="slide" with no exit animation. */}
      {dishModalTransition.mounted && (
      <Modal visible transparent animationType="none" presentationStyle="overFullScreen" onRequestClose={() => setModalMealType(null)}>
        <Pressable style={styles.popupOverlay} onPress={() => setModalMealType(null)}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, dishModalBackdropStyle]} />
        </Pressable>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrapper}>
          <Animated.View style={dishModalSheetStyle}>
          <Surface surfaceContext="overlay" style={styles.sheet}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <PressableScale onPress={() => setModalMealType(null)} scaleTo={0.97}>
                <Text style={[styles.sheetCancel, { color: theme.textMuted }]}>{t.cancel}</Text>
              </PressableScale>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                {modalMealType ? t.mealTypes[modalMealType] : ''} · {t.newDishTrigger}
              </Text>
              <PressableScale onPress={saveDish} disabled={!canSaveDish} scaleTo={0.95}>
                <Text style={[styles.sheetSave, { color: theme.accent }, !canSaveDish && { opacity: 0.4 }]}>{t.save}</Text>
              </PressableScale>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent}>
              <TextInput
                style={[styles.nameInput, { backgroundColor: theme.surfaceMuted, color: theme.text, borderColor: theme.accent }]}
                value={dishName}
                onChangeText={setDishName}
                placeholder={t.dishNamePlaceholder}
                placeholderTextColor={theme.textMuted}
              />

              <View style={styles.difficultyPicker}>
                <Text style={[styles.difficultyLabel, { color: theme.textMuted }]}>{t.dishDifficultyPickerLabel}</Text>
                <SlideSelector
                  compact
                  options={[
                    { value: 'easy' as Difficulty, label: t.mealDifficulty.easy },
                    { value: 'normal' as Difficulty, label: t.mealDifficulty.normal },
                  ]}
                  value={dishDifficulty}
                  onChange={setDishDifficulty}
                />
              </View>

              {draftIngredients.map((ing, idx) => (
                <View key={idx} style={[styles.draftRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.draftText, { color: theme.text }]} numberOfLines={1}>
                    {ing.amount}{ing.unit ? ` ${ing.unit}` : ''} {ing.name}
                    {ing.price > 0 ? ` · ${formatKr(ing.price, 0)}` : ''}
                  </Text>
                  <PressableScale onPress={() => removeDraftIngredient(idx)} hitSlop={8} scaleTo={0.9}>
                    <Ionicons name="remove-circle-outline" size={18} color={theme.textMuted} />
                  </PressableScale>
                </View>
              ))}

              <AddRow
                placeholder={t.ingredientPlaceholder}
                value={ingName}
                onChangeText={onIngNameChange}
                onSubmit={addDraftIngredient}
                accent={domainColor.accent}
                showDivider={false}
                accessibilityLabel={t.ingredientPlaceholder}
                extras={
                  <>
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
                      style={[styles.priceInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                      value={ingPrice}
                      onChangeText={setIngPrice}
                      keyboardType="decimal-pad"
                      placeholder={t.catalogueItemPricePlaceholder}
                      placeholderTextColor={theme.textMuted}
                      onSubmitEditing={addDraftIngredient}
                    />
                  </>
                }
              />

              {suggestions.length > 0 && (
                <View style={[styles.suggestList, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {suggestions.map((item) => (
                    <PressableScale
                      key={item.id}
                      style={[styles.suggestRow, { borderBottomColor: theme.border }]}
                      onPress={() => {
                        setIngName(item.name);
                        if (item.price > 0) setIngPrice(String(item.price));
                        setSuggestions([]);
                      }}
                      scaleTo={0.97}
                    >
                      <Text style={[styles.suggestText, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                      {item.price > 0 && <Text style={[styles.suggestMeta, { color: theme.textMuted }]}>{formatKr(item.price, 0)}</Text>}
                    </PressableScale>
                  ))}
                </View>
              )}
            </ScrollView>
          </Surface>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  root: { gap: Spacing.md },
  section: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
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
  ingAddQty: { width: 40, borderRadius: Radius.sm, paddingHorizontal: 4, paddingVertical: 6, fontSize: FontSize.sm, textAlign: 'center' },
  ingAddPrice: { width: 64, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 6, fontSize: FontSize.sm },
  dishFooterActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.md, marginTop: Spacing.xs },
  deleteDishRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
  difficultyPicker: { gap: Spacing.xs },
  difficultyLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  draftRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  draftText: { flex: 1, fontSize: FontSize.sm },
  amountInput: { width: 44, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm, textAlign: 'center' },
  unitInput: { width: 52, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm },
  priceInput: { width: 60, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm },
  suggestList: { maxHeight: 160, borderWidth: 1, borderRadius: Radius.sm },
  suggestRow: { padding: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  suggestText: { flex: 1, fontSize: FontSize.sm },
  suggestMeta: { fontSize: FontSize.xs },
});
