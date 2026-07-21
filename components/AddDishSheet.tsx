/**
 * AddDishSheet.tsx — pick saved dishes and add them to the Monthly list, or a specific
 * week list, in place.
 *
 * Centered modal opened from the Monthly tab's "Add dish" trigger, or from a Weekly
 * WeekListCard's add-chooser ("From a dish"). Lists every saved dish grouped by meal type;
 * tapping one pushes its ingredients onto the `target` (Monthly's status:'catalog' rows, or
 * directly into a given week list's status:'inWeeklyList' rows), both carrying dishName so
 * shopping.tsx's groupByDish() renders it as one expandable dish container. The sheet stays
 * open so several dishes can be added in one pass — added dishes show a checkmark; "Close"
 * dismisses.
 *
 * This is the in-place counterpart to FoodTab's "Add to week list"/"Add to monthly list"
 * popup — same push shape, but reachable directly from the tab you're already adding items
 * in, without switching to the Food tab. For weekly targets it writes straight into the given
 * listId — it does NOT go through the Unallocated bucket (UNALLOCATED_LIST_ID) or need a
 * manual-allocate step; that Food-tab → Unallocated → allocate path is untouched and still
 * exists as a separate, valid way to stage a dish before a dated list exists.
 *
 * Connections:
 *   Imports → components/Surface, components/PressableScale, constants/theme,
 *             constants/motion (Spring), lib/i18n, lib/money (formatKr), lib/haptics (success),
 *             lib/useAppTheme, store/useMealStore (dishes + dishTotalPrice),
 *             store/useShoppingStore (add), @expo/vector-icons, react-native-reanimated
 *   Used by → app/(tabs)/shopping.tsx (Monthly tab "Add dish" trigger, mounts one shared
 *             instance whose `target` switches based on which tab/list opened it),
 *             components/WeekListCard.tsx (indirectly, via the "From a dish" add-chooser
 *             option calling the onOpenDishSheet prop up to shopping.tsx)
 *   Data    → none directly — reads useMealStore.dishes, writes via useShoppingStore.add()
 *             (status:'catalog' rows for target.mode==='monthly', status:'inWeeklyList' rows
 *             for target.mode==='weekly'). Calls loadDishes() on open (idempotent; seeds).
 *
 * Edit notes:
 *   - Same centered scale+fade modal shell as AddItemSheet (mounted-state decoupled from
 *     `visible` so the exit animation plays before unmount). Honors reducedMotion.
 *   - `addedIds` is per-open session feedback only (reset each open); re-tapping a dish
 *     adds it again — useShoppingStore.add() increments matching catalog/weekly rows, so a
 *     second tap bumps quantities rather than creating duplicate rows (Decision 021 increment).
 *   - No new i18n keys — reuses addDishSheetTitle / noDishesAvailable / mealTypes /
 *     ingredientsCount / dishAddedToMonthly / dishAddedToWeek / closePopupLabel.
 *   - Renamed from AddDishToMonthlySheet.tsx (2026-07-20 shopping-cleanup pass) when the
 *     `target` prop was added to generalize it beyond Monthly-only.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useAccessibility, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { formatKr } from '@/lib/money';
import { success } from '@/lib/haptics';
import { Spring } from '@/constants/motion';
import { useMealStore, MealType, Dish, dishTotalPrice } from '@/store/useMealStore';
import { useShoppingStore } from '@/store/useShoppingStore';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';

/** Meal-type render order — mirrors FoodTab's MEAL_ORDER so sections read the same everywhere. */
const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'kveldsmat'];

/** Where a picked dish's ingredients get pushed. */
export type AddDishTarget = { mode: 'monthly' } | { mode: 'weekly'; listId: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Reports the dish name just added, so the parent can show its confirmation banner. */
  onAdded: (dishName: string) => void;
  target: AddDishTarget;
};

export default function AddDishSheet({ visible, onClose, onAdded, target }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const { reducedMotion } = useAccessibility();
  // Explicit pixel cap for the dish list so it scrolls internally and the fixed Close footer
  // stays on-screen — percentage maxHeight is unreliable inside a Modal on react-native-web.
  const { height: windowHeight } = useWindowDimensions();

  const dishes = useMealStore((s) => s.dishes);
  const loadDishes = useMealStore((s) => s.load);
  const shoppingAdd = useShoppingStore((s) => s.add);

  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(visible);
  const opacity = useSharedValue(visible ? 1 : 0);
  const scale = useSharedValue(visible ? 1 : 0.82);

  useEffect(() => {
    if (visible) {
      loadDishes();
      setAddedIds(new Set());
      setMounted(true);
      if (reducedMotion) {
        opacity.value = 1;
        scale.value = 1;
      } else {
        opacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
        scale.value = withSpring(1, Spring.snappy);
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

  const byMeal = useMemo(() => {
    const map = new Map<MealType, Dish[]>();
    for (const d of dishes) {
      const arr = map.get(d.mealType) ?? [];
      arr.push(d);
      map.set(d.mealType, arr);
    }
    return map;
  }, [dishes]);

  // Push a dish's ingredients onto the Monthly list (status:'catalog') or directly into a
  // given week list (status:'inWeeklyList', listId set immediately — no Unallocated detour),
  // carrying dishName so shopping.tsx's groupByDish() buckets them into one expandable dish
  // container either way. Monthly branch mirrors FoodTab.handleAddToMonthly.
  function handleAddDish(dish: Dish) {
    if (dish.ingredients.length === 0) return; // no ingredients to add — nothing to plan
    for (const ing of dish.ingredients) {
      if (target.mode === 'weekly') {
        shoppingAdd({
          name: ing.name,
          amount: ing.amount || '1',
          unit: ing.unit,
          listType: 'weekly',
          store: '',
          price: ing.priceNok,
          inventoryQty: 0,
          status: 'inWeeklyList',
          listId: target.listId,
          dishName: dish.name,
        });
      } else {
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
    }
    success();
    setAddedIds((prev) => new Set(prev).add(dish.id));
    onAdded(dish.name);
  }

  if (!mounted) return null;

  const hasDishes = dishes.length > 0;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, backdropStyle]} />
        </Pressable>

        <Animated.View style={[styles.cardWrap, cardStyle]}>
          <Surface surfaceContext="overlay" style={styles.card}>
            <Text style={[styles.title, { color: theme.text }]}>{t.addDishSheetTitle}</Text>

            {!hasDishes ? (
              <Text style={[styles.empty, { color: theme.textMuted }]}>{t.noDishesAvailable}</Text>
            ) : (
              <ScrollView style={[styles.scrollView, { maxHeight: windowHeight * 0.68 }]} contentContainerStyle={styles.scrollContent}>
                {MEAL_ORDER.map((mealType) => {
                  const list = byMeal.get(mealType);
                  if (!list || list.length === 0) return null;
                  return (
                    <View key={mealType} style={styles.section}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t.mealTypes[mealType]}</Text>
                      {list.map((dish) => {
                        const total = dishTotalPrice(dish);
                        const added = addedIds.has(dish.id);
                        return (
                          <PressableScale
                            key={dish.id}
                            style={[styles.dishRow, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                            onPress={() => handleAddDish(dish)}
                            scaleTo={0.97}
                            accessibilityRole="button"
                            accessibilityLabel={dish.name}
                          >
                            <View style={styles.dishInfo}>
                              <Text style={[styles.dishName, { color: theme.text }]} numberOfLines={1}>{dish.name}</Text>
                              <Text style={[styles.dishMeta, { color: theme.textMuted }]}>
                                {t.ingredientsCount(dish.ingredients.length)}
                                {total > 0 ? ` · ${formatKr(total, 0)}` : ''}
                              </Text>
                            </View>
                            <Ionicons
                              name={added ? 'checkmark-circle' : 'add-circle-outline'}
                              size={24}
                              color={theme.accent}
                            />
                          </PressableScale>
                        );
                      })}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <PressableScale style={[styles.doneBtn, { backgroundColor: theme.accent }]} onPress={onClose} scaleTo={0.96}>
              <Text style={[styles.doneBtnText, { color: theme.accentInk }]}>{t.closePopupLabel}</Text>
            </PressableScale>
          </Surface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  cardWrap: { width: '100%', maxWidth: 420, maxHeight: '85%' },
  card: { borderRadius: Radius.lg, padding: Spacing.lg },
  title: { fontSize: FontSize.xl, fontFamily: Fonts.bold, marginBottom: Spacing.sm },
  empty: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.lg },
  // maxHeight is applied inline from useWindowDimensions (see render) — a definite pixel cap
  // so the list scrolls internally and the fixed Close footer stays visible.
  scrollView: {},
  scrollContent: { paddingBottom: Spacing.sm },
  section: { marginTop: Spacing.sm },
  sectionLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  dishInfo: { flex: 1 },
  dishName: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  dishMeta: { fontSize: FontSize.xs, marginTop: 2 },
  doneBtn: { marginTop: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  doneBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
