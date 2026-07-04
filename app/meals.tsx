/**
 * meals.tsx — dish library
 *
 * Library of dishes grouped by meal type. Entry shows category tiles; tapping a
 * tile drills into that category's dish list. Dish creation via modal sheet with
 * ingredient rows and catalog autocomplete.
 *
 * Connections:
 *   Imports → components/ScreenScaffold, components/HintCard, components/AppModal,
 *             components/ConfirmationBanner, components/ExpandableCard, components/PressableScale,
 *             components/Surface, components/AddFAB, constants/theme, lib/db, lib/haptics,
 *             lib/i18n, lib/useAppTheme, store/useMealStore, store/useShoppingStore, store/useCatalogStore
 *   Used by → Expo Router route "/meals"; reached via Home's "More → Food" link
 *             (not a BottomNav tab — Decision 036)
 *   Data    → useMealStore (dishes + ingredients tables); writes to useShoppingStore when
 *             pushing a dish to shopping; useCatalogStore.suggest() for ingredient autocomplete
 *
 * Edit notes:
 *   - Decision 001 tier='site' scaffold with a dynamic title (category name when drilled in).
 *     The old ScreenHeader back/right slots are replaced by an in-content toolbar row shown only
 *     in the category-list view (back chevron → grid; shuffle → random dish).
 *   - **Decision 024 — meal colours:** all meal types use the single `featMeal` accent (icon +
 *     label already distinguish them). The "Surprise me" button uses the primary `accent` to
 *     stay visually distinct from the featMeal tiles.
 *   - New dish modal collects name + mealType + estimated price + ingredients (catalog
 *     autocomplete). Kept hand-rolled rather than reusing AddDishSheet — that sheet is the
 *     shopping-catalog variant and collects neither mealType nor an estimated dish price.
 *   - pushDishToShopping adds ingredients as listType 'weekly', tags them with dishName so
 *     app/shopping.tsx can group by dish, and surfaces a ConfirmationBanner.
 *   - Loads its stores on focus; initDb() is idempotent, guarded by a module flag.
 */
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMealStore, MealType, Dish } from '@/store/useMealStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useCatalogStore, StoreItem } from '@/store/useCatalogStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import ScreenScaffold from '@/components/ScreenScaffold';
import HintCard from '@/components/HintCard';
import ExpandableCard from '@/components/ExpandableCard';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import { showAppModal } from '@/components/AppModal';
import PressableScale from '@/components/PressableScale';
import Surface from '@/components/Surface';
import AddFAB from '@/components/AddFAB';
import { success } from '@/lib/haptics';
import { initDb } from '@/lib/db';
import { useT } from '@/lib/i18n';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

const MEAL_TYPES: { value: MealType; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'breakfast', icon: 'sunny-outline' },
  { value: 'lunch', icon: 'fast-food-outline' },
  { value: 'dinner', icon: 'restaurant-outline' },
  { value: 'snack', icon: 'nutrition-outline' },
  { value: 'kveldsmat', icon: 'moon-outline' },
];

type DraftIngredient = { name: string; amount: string; unit: string };

let dbBootstrapped = false;

export default function MealsScreen() {
  const router = useRouter();
  const dishes = useMealStore((s) => s.dishes);
  const addDish = useMealStore((s) => s.addDish);
  const removeDish = useMealStore((s) => s.removeDish);
  const addIngredient = useMealStore((s) => s.addIngredient);
  const removeIngredient = useMealStore((s) => s.removeIngredient);
  const randomDish = useMealStore((s) => s.randomDish);
  const loadDishes = useMealStore((s) => s.load);
  const suggest = useCatalogStore((s) => s.suggest);
  const loadCatalog = useCatalogStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  const t = useT();
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const addToShopping = useShoppingStore((s) => s.add);
  const mealLabel = (v: MealType) => t.mealTypes[v];

  const [activeCategory, setActiveCategory] = useState<MealType | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  // New dish modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [dishName, setDishName] = useState('');
  const [dishType, setDishType] = useState<MealType>('dinner');
  const [draftIngredients, setDraftIngredients] = useState<DraftIngredient[]>([]);
  const [ingName, setIngName] = useState('');
  const [ingAmount, setIngAmount] = useState('1');
  const [ingUnit, setIngUnit] = useState('');
  const [suggestions, setSuggestions] = useState<StoreItem[]>([]);
  const [dishPrice, setDishPrice] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!dbBootstrapped) {
        initDb();
        dbBootstrapped = true;
      }
      loadSettings();
      loadDishes();
      loadCatalog();
    }, [loadSettings, loadDishes, loadCatalog])
  );

  function openModal(type: MealType) {
    setDishType(type);
    setDishName('');
    setDraftIngredients([]);
    setIngName('');
    setIngAmount('1');
    setIngUnit('');
    setSuggestions([]);
    setDishPrice('');
    setModalVisible(true);
  }

  function addDraftIngredient() {
    if (!ingName.trim()) return;
    setDraftIngredients((prev) => [...prev, { name: ingName.trim(), amount: ingAmount, unit: ingUnit }]);
    setIngName('');
    setIngAmount('1');
    setIngUnit('');
    setSuggestions([]);
  }

  function removeDraftIngredient(idx: number) {
    setDraftIngredients((prev) => prev.filter((_, i) => i !== idx));
  }

  function saveDish() {
    if (!dishName.trim()) return;
    const dish = addDish({ name: dishName.trim(), mealType: dishType, estimatedPriceNok: parseFloat(dishPrice.replace(',', '.')) || 0 });
    draftIngredients.forEach((ing) => {
      addIngredient({ dishId: dish.id, name: ing.name, amount: ing.amount, unit: ing.unit });
    });
    setModalVisible(false);
    setConfirm(t.taskSavedSimple);
  }

  function onIngNameChange(text: string) {
    setIngName(text);
    setSuggestions(text.length >= 2 ? suggest(text, 5) : []);
  }

  function pushDishToShopping(dish: Dish) {
    dish.ingredients.forEach((ing) => {
      addToShopping({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        listType: 'weekly',
        store: '',
        price: 0,
        inventoryQty: 0,
        dishName: dish.name,
        status: 'inWeeklyList',
      });
    });
    success();
    setConfirm(t.addedToShoppingConfirm);
  }

  function pickRandom(mealType?: MealType) {
    const dish = randomDish(mealType);
    if (!dish) {
      showAppModal(
        t.noDishesTitle,
        mealType ? t.noDishesBody(mealLabel(mealType).toLowerCase()) : t.noDishesBodyGeneric
      );
      return;
    }
    showAppModal(
      dish.name,
      dish.ingredients.length > 0
        ? t.randomIngredientsLabel(dish.ingredients.map((i) => `${i.amount} ${i.unit} ${i.name}`).join(', '))
        : t.randomNoIngredients,
      [
        { text: t.addToShoppingList, onPress: () => pushDishToShopping(dish) },
        { text: t.ok },
      ]
    );
  }

  const categoryDishes = activeCategory ? dishes.filter((d) => d.mealType === activeCategory) : [];
  const activeMeta = MEAL_TYPES.find((m) => m.value === activeCategory);

  return (
    <>
      <ScreenScaffold title={activeCategory ? mealLabel(activeCategory) : t.mealsTitle} tier="site">
        {/* Category tile view */}
        {!activeCategory && (
          <View style={styles.tileGrid}>
            <HintCard text={t.hints.meals.text} example={t.hints.meals.example} />
            <PressableScale
              style={[styles.surpriseBtn, { backgroundColor: theme.accent }]}
              onPress={() => pickRandom()}
              scaleTo={0.96}
            >
              <Ionicons name="shuffle" size={26} color={theme.accentInk} style={styles.surpriseIconView} />
              <Text style={[styles.surpriseTitle, { color: theme.accentInk }]}>{t.surpriseMe}</Text>
              <Text style={[styles.surpriseSub, { color: theme.accentInk }]}>{t.pickRandomDishSub}</Text>
            </PressableScale>

            <View style={styles.tilesRow}>
              {MEAL_TYPES.map((mt) => {
                const count = dishes.filter((d) => d.mealType === mt.value).length;
                return (
                  <Pressable
                    key={mt.value}
                    style={[styles.tile, { backgroundColor: theme.featMeal }]}
                    onPress={() => setActiveCategory(mt.value)}
                  >
                    <Ionicons name={mt.icon} size={28} color={theme.accentInk} style={styles.tileIconView} />
                    <Text style={[styles.tileLabel, { color: theme.accentInk }]}>{mealLabel(mt.value)}</Text>
                    <Text style={[styles.tileCount, { color: theme.accentInk }]}>{count} {t.ingredientsCount(count).replace(/\d+\s*/, '')}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Category dish list */}
        {activeCategory && (
          <View style={styles.content}>
            <View style={styles.toolbar}>
              <Pressable onPress={() => setActiveCategory(null)} hitSlop={8} style={styles.toolbarBtn}>
                <Ionicons name="chevron-back" size={22} color={theme.text} />
              </Pressable>
              <Pressable
                style={[styles.randomBtn, { backgroundColor: theme.surface }]}
                onPress={() => pickRandom(activeCategory ?? undefined)}
                hitSlop={8}
              >
                <Ionicons name="shuffle" size={18} color={theme.accent} />
              </Pressable>
            </View>

            {categoryDishes.length === 0 && (
              <Surface style={styles.emptyState}>
                {activeMeta && (
                  <Ionicons name={activeMeta.icon} size={40} color={theme.featMeal} style={styles.emptyEmoji} />
                )}
                <Text style={[styles.emptyTitle, { color: theme.text }]}>{t.noDishesTitle}</Text>
                <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
                  {t.noDishesBody(mealLabel(activeCategory).toLowerCase())}
                </Text>
              </Surface>
            )}

            {categoryDishes.map((dish) => (
              <ExpandableCard
                key={dish.id}
                title={dish.name}
                subtitle={
                  dish.estimatedPriceNok > 0
                    ? `${mealLabel(dish.mealType)} · ${t.dishPriceLabel(String(dish.estimatedPriceNok))}`
                    : mealLabel(dish.mealType)
                }
                badge={t.ingredientsCount(dish.ingredients.length)}
                accentColor={theme.featMeal}
                rightAction={
                  <Pressable
                    onPress={() => pushDishToShopping(dish)}
                    style={[styles.shoppingBtn, { backgroundColor: theme.surfaceMuted }]}
                    hitSlop={8}
                  >
                    <Ionicons name="cart-outline" size={16} color={theme.text} />
                  </Pressable>
                }
              >
                {dish.ingredients.map((ing, i) => (
                  <View
                    key={ing.id}
                    style={[
                      styles.ingRow,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.ingText, { color: theme.text }]}>
                      {ing.amount} {ing.unit} {ing.name}
                    </Text>
                    <Pressable onPress={() => removeIngredient(ing.id)} hitSlop={8}>
                      <Text style={[styles.removeText, { color: theme.textMuted }]}>−</Text>
                    </Pressable>
                  </View>
                ))}
                <View style={styles.ingFooter}>
                  <Pressable style={styles.deleteBtn} onPress={() => removeDish(dish.id)}>
                    <Ionicons name="trash-outline" size={14} color={theme.bad} />
                    <Text style={[styles.deleteText, { color: theme.bad }]}>{t.deleteDish}</Text>
                  </Pressable>
                </View>
              </ExpandableCard>
            ))}

            <View style={{ height: 96 }} />
          </View>
        )}
      </ScreenScaffold>

      {activeCategory && <AddFAB onPress={() => openModal(activeCategory)} accessibilityLabel={t.addDishBtn} />}

      <ConfirmationBanner message={confirm} onDismiss={() => setConfirm(null)} />

      {/* New dish modal */}
      <Modal visible={modalVisible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} onPress={() => setModalVisible(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrapper}>
          <Surface surfaceContext="overlay" style={styles.sheet}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />

            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={[styles.sheetCancel, { color: theme.textMuted }]}>{t.cancel}</Text>
              </Pressable>
              <Text style={[styles.sheetHeaderTitle, { color: theme.text }]}>{t.newDishTrigger}</Text>
              <Pressable onPress={saveDish} disabled={!dishName.trim()}>
                <Text style={[styles.sheetSave, { color: theme.accent }, !dishName.trim() && { opacity: 0.4 }]}>{t.save}</Text>
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent}>
              {/* Meal type picker */}
              <View style={styles.typeRow}>
                {MEAL_TYPES.map((mt) => (
                  <Pressable
                    key={mt.value}
                    style={[styles.typePill, { backgroundColor: dishType === mt.value ? theme.featMeal : theme.surfaceMuted }]}
                    onPress={() => setDishType(mt.value)}
                  >
                    <Ionicons
                      name={mt.icon}
                      size={16}
                      color={dishType === mt.value ? theme.accentInk : theme.text}
                      style={styles.typePillIconView}
                    />
                    <Text style={[styles.typePillLabel, { color: dishType === mt.value ? theme.accentInk : theme.text }]}>
                      {mealLabel(mt.value)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Dish name */}
              <TextInput
                style={[styles.nameInput, { backgroundColor: theme.surfaceMuted, color: theme.text, borderColor: theme.accent }]}
                value={dishName}
                onChangeText={setDishName}
                placeholder={t.dishNamePlaceholder}
                placeholderTextColor={theme.textMuted}
                autoFocus
                returnKeyType="next"
              />

              {/* Estimated price */}
              <TextInput
                style={[styles.nameInput, { backgroundColor: theme.surfaceMuted, color: theme.text, borderColor: theme.accent }]}
                value={dishPrice}
                onChangeText={setDishPrice}
                placeholder={t.dishPricePlaceholder}
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
              />

              {/* Draft ingredients */}
              {draftIngredients.map((ing, idx) => (
                <View key={idx} style={[styles.draftRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.draftText, { color: theme.text }]}>{ing.amount} {ing.unit} {ing.name}</Text>
                  <Pressable onPress={() => removeDraftIngredient(idx)} hitSlop={8}>
                    <Text style={[styles.removeText, { color: theme.textMuted }]}>−</Text>
                  </Pressable>
                </View>
              ))}

              {/* Add ingredient row */}
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
                  returnKeyType="done"
                  onSubmitEditing={addDraftIngredient}
                />
                <Pressable style={[styles.addIngBtn, { backgroundColor: theme.accent }]} onPress={addDraftIngredient}>
                  <Text style={[styles.addIngBtnText, { color: theme.accentInk }]}>+</Text>
                </Pressable>
              </View>

              {/* Autocomplete suggestions */}
              {suggestions.length > 0 && (
                <FlatList
                  data={suggestions}
                  keyExtractor={(item) => item.name}
                  style={[styles.suggestList, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.suggestRow, { borderBottomColor: theme.border }]}
                      onPress={() => {
                        setIngName(item.name);
                        setSuggestions([]);
                      }}
                    >
                      <Text style={[styles.suggestText, { color: theme.text }]}>{item.name}</Text>
                      {item.price > 0 && (
                        <Text style={[styles.suggestMeta, { color: theme.textMuted }]}>{item.price} kr</Text>
                      )}
                    </Pressable>
                  )}
                />
              )}
            </ScrollView>
          </Surface>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const baseStyles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  toolbarBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  randomBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  tileGrid: { padding: Spacing.md, gap: Spacing.md },
  tilesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  tile: {
    width: '47%', flexGrow: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  tileIconView: { marginBottom: 2 },
  tileLabel: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  tileCount: { fontSize: FontSize.xs, opacity: 0.85 },
  surpriseBtn: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  surpriseIconView: { marginBottom: 2 },
  surpriseTitle: { fontFamily: Fonts.bold, fontSize: FontSize.xl, marginTop: 4 },
  surpriseSub: { fontSize: FontSize.sm, opacity: 0.9 },
  content: { padding: Spacing.md, gap: Spacing.sm },
  shoppingBtn: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  ingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  ingText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
  removeText: { fontSize: 18 },
  ingFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.sm },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteText: { fontSize: FontSize.sm },
  emptyState: { borderRadius: Radius.md, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm },
  emptyEmoji: { marginBottom: 2 },
  emptyTitle: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  emptyBody: { fontSize: FontSize.sm, textAlign: 'center' },

  // Modal / sheet
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheetWrapper: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
    maxHeight: '90%',
  },
  sheetScroll: { flexGrow: 0 },
  sheetScrollContent: { gap: Spacing.md },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  sheetHeaderTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  sheetCancel: { fontSize: FontSize.md },
  sheetSave: { fontSize: FontSize.md, fontFamily: Fonts.bold },
  typeRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  typePill: { flexGrow: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, borderRadius: Radius.sm, alignItems: 'center', gap: 2 },
  typePillIconView: {},
  typePillLabel: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
  nameInput: {
    borderWidth: 2, borderRadius: Radius.sm,
    padding: Spacing.md,
    fontSize: FontSize.md,
  },
  draftRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  draftText: { fontSize: FontSize.sm },
  ingAddRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  amountInput: { width: 48, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm, textAlign: 'center' },
  unitInput: { width: 56, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm },
  ingNameInput: { flex: 1, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm },
  addIngBtn: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  addIngBtnText: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  suggestList: { maxHeight: 160, borderWidth: 1, borderRadius: Radius.sm },
  suggestRow: { padding: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between' },
  suggestText: { fontSize: FontSize.sm },
  suggestMeta: { fontSize: FontSize.xs },
});
