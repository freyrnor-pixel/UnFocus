/**
 * AddDishSheet.tsx — floating modal for adding a dish (and its ingredients) to the
 * Monthly catalog in one step.
 *
 * Opened from Monthly's second AddDivider in app/shopping.tsx. Two entry modes,
 * switched by a small toggle at the top: "New dish" (blank dish name + manually
 * typed ingredients, same field set as app/meals.tsx's dish modal) or "From Meals"
 * (pick an existing useMealStore dish; its name and ingredients seed the draft,
 * still editable/removable before saving). Each draft ingredient row also carries a
 * price, since Meals' Ingredient type has none — defaults to 0 when prefilled from a
 * Meals dish.
 *
 * Renders as a centered, scale+fade card over a dimmed backdrop — same animation
 * scaffolding as components/AddItemSheet.tsx.
 *
 * Connections:
 *   Imports → components/PressableScale, components/Surface, constants/theme,
 *             lib/i18n, lib/useAppTheme, store/useCatalogStore, store/useMealStore,
 *             react-native-reanimated
 *   Used by → (not yet mounted — Phase 5 screen: app/shopping.tsx, Monthly tab)
 *   Data    → none directly — onSave hands the parent a dishName + ingredient list; the
 *             parent loops useShoppingStore.add() once per ingredient (status:'catalog',
 *             listType:'monthly', dishName). Reads useMealStore.dishes (read-only, "From
 *             Meals" picker) and useCatalogStore.suggest() (read-only, ingredient-name
 *             autocomplete in "New dish" mode) — both Phase 5 stubs per Decision 015/015a.
 *
 * Edit notes:
 *   - Tracks its own `mounted` state decoupled from `visible` so Cancel/backdrop-tap can
 *     play the exit animation before unmounting — same pattern as AddItemSheet/AppModal.
 *     Don't pass `visible` straight to <Modal visible={...}>.
 *   - Resets all fields (mode, dishName, draftIngredients, search) on every open via the
 *     useEffect keyed on `visible`.
 *   - Picking a "From Meals" dish seeds draftIngredients with price '0' for every row
 *     (Ingredient has no price) — still editable before save, matching
 *     MonthlyTableRow's existing price===0 → '—' display for whatever isn't filled in.
 *   - Save is gated on a non-empty trimmed dishName AND at least one draft ingredient.
 *   - Decision 008: the card is a glass Surface in `overlay` context. Blur comes from
 *     Surface's BlurView; this file never imports expo-blur directly.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useScaledStyles, useAccessibility, useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useMealStore } from '@/store/useMealStore';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';

type DraftIngredient = { name: string; amount: string; unit: string; price: string };
type Mode = 'new' | 'fromMeals';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (input: { dishName: string; ingredients: { name: string; amount: string; unit: string; price: number }[] }) => void;
};

export default function AddDishSheet({ visible, onClose, onSave }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const catalogSuggest = useCatalogStore((s) => s.suggest);
  const dishes = useMealStore((s) => s.dishes);

  const [mode, setMode] = useState<Mode>('new');
  const [dishName, setDishName] = useState('');
  const [dishSearch, setDishSearch] = useState('');
  const [draftIngredients, setDraftIngredients] = useState<DraftIngredient[]>([]);
  const [ingName, setIngName] = useState('');
  const [ingAmount, setIngAmount] = useState('1');
  const [ingUnit, setIngUnit] = useState('');
  const [ingPrice, setIngPrice] = useState('');
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);

  const [mounted, setMounted] = useState(visible);
  const opacity = useSharedValue(visible ? 1 : 0);
  const scale = useSharedValue(visible ? 1 : 0.82);

  useEffect(() => {
    if (visible) {
      setMode('new');
      setDishName('');
      setDishSearch('');
      setDraftIngredients([]);
      setIngName('');
      setIngAmount('1');
      setIngUnit('');
      setIngPrice('');
      setSuggestionsDismissed(false);
      setMounted(true);
      if (reducedMotion) {
        opacity.value = 1;
        scale.value = 1;
      } else {
        opacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
        scale.value = withSpring(1, { damping: 18, stiffness: 320 });
      }
    } else if (mounted) {
      if (reducedMotion) {
        opacity.value = 0;
        scale.value = 0.82;
        setMounted(false);
      } else {
        scale.value = withTiming(0.92, { duration: 220, easing: Easing.in(Easing.cubic) });
        opacity.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
          if (done) runOnJS(setMounted)(false);
        });
      }
    }
  }, [visible, reducedMotion]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const ingredientSuggestions = useMemo(
    () => (suggestionsDismissed ? [] : catalogSuggest(ingName, 5)),
    [catalogSuggest, ingName, suggestionsDismissed]
  );

  const dishMatches = useMemo(() => {
    const q = dishSearch.trim().toLowerCase();
    return q ? dishes.filter((d) => d.name.toLowerCase().includes(q)) : dishes;
  }, [dishes, dishSearch]);

  function pickMealsDish(dishId: string) {
    const dish = dishes.find((d) => d.id === dishId);
    if (!dish) return;
    setDishName(dish.name);
    setDraftIngredients(dish.ingredients.map((ing) => ({ name: ing.name, amount: ing.amount, unit: ing.unit, price: '0' })));
  }

  function addDraftIngredient() {
    if (!ingName.trim()) return;
    setDraftIngredients((prev) => [
      ...prev,
      { name: ingName.trim(), amount: ingAmount, unit: ingUnit, price: ingPrice },
    ]);
    setIngName('');
    setIngAmount('1');
    setIngUnit('');
    setIngPrice('');
    setSuggestionsDismissed(false);
  }

  function removeDraftIngredient(idx: number) {
    setDraftIngredients((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (!dishName.trim() || draftIngredients.length === 0) return;
    onSave({
      dishName: dishName.trim(),
      ingredients: draftIngredients.map((ing) => ({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        price: parseFloat(ing.price.replace(',', '.')) || 0,
      })),
    });
  }

  if (!mounted) return null;

  const canSave = !!dishName.trim() && draftIngredients.length > 0;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, backdropStyle]} />
        </Pressable>

        <Animated.View style={[styles.cardWrap, cardStyle]}>
          <Surface surfaceContext="overlay" style={styles.card}>
            <Text style={[styles.title, { color: theme.text }]}>{t.addDishSheetTitle}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.scrollView}>
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
                    <Text style={[styles.emptyDishesText, { color: theme.textMuted }]}>{t.noDishesAvailable}</Text>
                  ) : (
                    <View style={[styles.dishPickBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                      <ScrollView keyboardShouldPersistTaps="handled" style={styles.dishPickScroll}>
                        {dishMatches.map((d) => (
                          <Pressable
                            key={d.id}
                            style={[styles.dishPickRow, dishName === d.name && { backgroundColor: theme.accentSoft }]}
                            onPress={() => pickMealsDish(d.id)}
                          >
                            <Text style={[styles.dishPickName, { color: theme.text }]} numberOfLines={1}>{d.name}</Text>
                            <Text style={[styles.dishPickMeta, { color: theme.textMuted }]}>{t.ingredientsCount(d.ingredients.length)}</Text>
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
                <View key={idx} style={[styles.draftRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.draftText, { color: theme.text }]} numberOfLines={1}>
                    {ing.amount} {ing.unit} {ing.name}
                    {parseFloat(ing.price) > 0 ? ` · ${ing.price} kr` : ''}
                  </Text>
                  <Pressable onPress={() => removeDraftIngredient(idx)} hitSlop={8}>
                    <Text style={[styles.removeText, { color: theme.textMuted }]}>−</Text>
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
                  onChangeText={(v) => { setIngName(v); setSuggestionsDismissed(false); }}
                  placeholder={t.ingredientPlaceholder}
                  placeholderTextColor={theme.textMuted}
                />
              </View>
              <View style={styles.ingAddRow}>
                <TextInput
                  style={[styles.priceInput, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
                  value={ingPrice}
                  onChangeText={setIngPrice}
                  keyboardType="decimal-pad"
                  placeholder={t.ingredientPricePlaceholder}
                  placeholderTextColor={theme.textMuted}
                />
                <PressableScale style={[styles.addIngBtn, { backgroundColor: theme.accent }]} onPress={addDraftIngredient}>
                  <Text style={[styles.addIngBtnText, { color: theme.accentInk }]}>+</Text>
                </PressableScale>
              </View>

              {ingredientSuggestions.length > 0 && (
                <View style={[styles.suggestionsBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                  <ScrollView keyboardShouldPersistTaps="handled" style={styles.suggestionsScroll}>
                    {ingredientSuggestions.map((s) => (
                      <Pressable
                        key={s.id}
                        style={styles.suggestionRow}
                        onPress={() => { setIngName(s.name); setSuggestionsDismissed(true); }}
                      >
                        <Text style={[styles.suggestionName, { color: theme.text }]} numberOfLines={1}>{s.name}</Text>
                        {s.price > 0 && (
                          <Text style={[styles.suggestionPrice, { color: theme.textMuted }]}>{s.price.toFixed(0)} kr</Text>
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.actionsRow}>
                <PressableScale style={styles.ghostBtn} onPress={onClose}>
                  <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>{t.cancelBtn}</Text>
                </PressableScale>
                <PressableScale
                  style={[styles.primaryBtn, { backgroundColor: theme.accent }, !canSave && { opacity: 0.4 }]}
                  onPress={handleSave}
                  disabled={!canSave}
                >
                  <Text style={[styles.primaryBtnText, { color: theme.accentInk }]}>{t.addDishBtn}</Text>
                </PressableScale>
              </View>
            </ScrollView>
          </Surface>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  cardWrap: { width: '100%', maxWidth: 420, maxHeight: '85%' },
  card: { borderRadius: Radius.lg, padding: Spacing.lg },
  title: { fontSize: FontSize.xl, fontFamily: Fonts.bold, marginBottom: Spacing.sm },
  scrollView: { flex: 1 },
  modeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  modePill: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center' },
  modePillText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  label: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, marginTop: Spacing.sm, marginBottom: 4 },
  input: { borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.md, marginBottom: Spacing.xs },
  emptyDishesText: { fontSize: FontSize.sm, marginBottom: Spacing.sm },
  dishPickBox: { borderRadius: Radius.sm, borderWidth: 1, marginBottom: Spacing.sm, overflow: 'hidden' },
  dishPickScroll: { maxHeight: 140 },
  dishPickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  dishPickName: { flex: 1, fontSize: FontSize.sm },
  dishPickMeta: { fontSize: FontSize.xs },
  draftRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1 },
  draftText: { flex: 1, fontSize: FontSize.sm },
  removeText: { fontSize: 20 },
  ingAddRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs, alignItems: 'center' },
  amountInput: { width: 50, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm },
  unitInput: { width: 70, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm },
  ingNameInput: { flex: 1, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm },
  priceInput: { flex: 1, borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.sm },
  addIngBtn: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  addIngBtnText: { fontSize: FontSize.lg, fontFamily: Fonts.bold, lineHeight: 22 },
  suggestionsBox: { borderRadius: Radius.sm, borderWidth: 1, marginTop: 4, overflow: 'hidden' },
  suggestionsScroll: { maxHeight: 160 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  suggestionName: { flex: 1, fontSize: FontSize.sm },
  suggestionPrice: { fontSize: FontSize.xs },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  ghostBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  ghostBtnText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  primaryBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  primaryBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
