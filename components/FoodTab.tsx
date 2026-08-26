/**
 * FoodTab.tsx — dish library + push-to-list list UI.
 *
 * Renders one Surface section per meal type (breakfast/lunch/dinner/snack/kveldsmat). "A touch
 * of colour by type" survives as a soft hue PLATE under each section's glyph — the section card
 * itself wears the screen hue like every other card, and the title and chevron are plain ink
 * (2026-08-10; see MEAL_COLORS' note for the 2.12:1 title that prompted it). Each meal-type section
 * is itself a collapsible container (header row toggles it, collapsed by default — see Edit
 * notes) holding that meal's dishes. A dish shows as a collapsed row (name · total price ·
 * "+"); the "+" opens a small popup with two choices — "Add to week list" (ingredients go to
 * the weekly Unallocated bucket, listId UNALLOCATED_LIST_ID) and "Add to monthly list"
 * (ingredients become status='catalog' rows) — plus an X. Expanding a dish reveals its
 * ingredient rows (name · amount · line price), the same shape as task steps, with an inline
 * add-ingredient row and per-dish delete. Dish creation lives here — a labelled "Add dish" row
 * at the BOTTOM of each expanded meal section (2026-08-06 — see Edit notes), the same
 * "+ makes a new row" idiom as `components/NewMonthlyListRow.tsx` — replaces the old
 * standalone /meals screen and the "Create grouping" screen.
 *
 * Connections:
 *   Imports → constants/theme (contrastOn, tokens), constants/motion (Spring),
 *             lib/useAppTheme, lib/i18n, lib/haptics, lib/money (formatKr), lib/screenColor,
 *             components/Surface, components/PressableScale, components/Button (the per-meal
 *             "Add dish" trigger — ghost), components/AddRow,
 *             components/Badge (difficulty pill), components/FormControls (SegmentedControl — difficulty picker),
 *             components/Collapsible + components/AnimatedChevron (meal-section collapse),
 *             store/useMealStore (Dish/MealType/Difficulty/dishTotalPrice + CRUD incl.
 *             duplicateDish), store/useCatalogStore (suggest, StoreItem),
 *             store/useShoppingStore (add + UNALLOCATED_LIST_ID), store/useMonthlyListStore
 *             (lists + `monthlyListLabel` for the add-to-list picker), @expo/vector-icons
 *   Used by → app/food.tsx (its own button-launched sub-screen as of 2026-07-23, UX audit
 *             F1 — was app/(tabs)/shopping.tsx's in-place "Food" tab before that),
 *             app/(tabs)/shopping.tsx (the Food drawer, `embedded` — 2026-08-10)
 *   Data    → useMealStore (dishes/ingredients), useShoppingStore.add (weekly/monthly pushes),
 *             useCatalogStore.suggest (ingredient price autocomplete)
 *
 * Edit notes:
 *   - **Each dish is a bordered box (2026-08-06, user report)**: `dishCard` carries a
 *     `computeBorderTone(color, isDark, 'card')` border in that dish's meal colour — 'card'
 *     weight, not the lighter 'field' rung the row-anatomy convention would default to, because
 *     a lighter tone read as too weak to actually separate one dish from the next. The same View
 *     wraps both the collapsed name row and (when `isOpen`) the ingredient/edit body below it,
 *     so the border encloses the whole dish — ingredients, the inline add row, duplicate/delete
 *     — once expanded, with no separate collapsed/expanded styling needed.
 *   - **Collapsible meal sections (visual-audit, 2026-07-17)**: `openSections` (one bool per
 *     MealType, all false initially) gates each section's body via `Collapsible` — five
 *     always-open sections used to push the actually-useful dish rows far down the screen on
 *     first open. The header row (icon + title + chevron) is a plain `PressableScale` that
 *     only toggles the section — it carries no other action. `AnimatedChevron` mirrors the
 *     per-dish row's chevron for a consistent expand affordance. No persistence — every
 *     section re-collapses on next mount, matching the per-dish `expanded` state below.
 *   - **"Add dish" moved to the bottom of the expanded body (2026-08-06, user report)**: it used
 *     to be a small circular "+" wedged into the header next to the chevron — close enough to
 *     the expand toggle that the two read as one crowded control and were easy to mis-tap. It's
 *     now a labelled bordered row (`addDishRow`, icon + "Add dish") at the end of the
 *     `Collapsible` body, below the dish list (or below the empty hint on a dish-less section)
 *     — same shape as `components/NewMonthlyListRow.tsx`'s "+ New list" trigger and
 *     `InlineAddItem`'s bottom-of-list placement elsewhere in the app: a "+" that creates a new
 *     row lives where the new row would land, not beside an unrelated expand/collapse control.
 *     Only visible while the section is open, since the list it appends to isn't visible while
 *     closed. **This is the general rule for this app, not a one-off**: an "add new row" trigger
 *     belongs at the bottom of the (expanded) list it adds to, never crowded next to a card's
 *     expand/collapse toggle. It does NOT apply to a per-row action button (e.g. this file's
 *     per-dish "+" that opens the add-to-list popup, or a save/checkmark on a row being edited)
 *     — those stay wherever the row rule already puts them; only "creates a whole new row"
 *     triggers follow this placement.
 *   - Renders no ScrollView of its own — it lives inside the Shopping screen's scaffold
 *     ScrollView. The new-dish + "add to list" popups are RN <Modal>s (own layers).
 *   - **`embedded` (2026-08-10) — mounted inside Shopping's Food drawer, not only on /food.**
 *     Maintainer, against the drawer's old names-only preview: *"Shows no extra information or
 *     has the 'Add' button … I would rather just the expanded state be like the screens."* So
 *     the drawer mounts THIS, and `components/SubScreenPreviewList.tsx` is deleted. The prop is
 *     presentation only and changes exactly one thing: a meal section draws as a bordered
 *     `View` instead of a `Surface`, because the drawer is itself a Surface and a Surface in a
 *     Surface reads as a nested panel. Same colour, radius and 'card'-rung weight; no ramp
 *     gradient, no shadow. **Every behaviour is shared** — the per-dish "+" week-or-monthly
 *     popup, "Add dish", the ingredient editor — which is the point: a second implementation
 *     is what would drift, not a second mount. Don't add behaviour behind this flag.
 *     Mount cost is nothing while the drawer is shut: `components/Collapsible.tsx` lazy-mounts,
 *     and an open drawer builds five collapsed section headers, not every dish.
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
 *     compact `SegmentedControl` in the new-dish modal (defaults to 'normal'). Duplicating a
 *     dish (copy button in the expanded body, next to delete) calls useMealStore's
 *     duplicateDish — the copy keeps the same difficulty/ingredients and gets a localized
 *     "(copy)" name suffix so users can create edited variants without losing the original.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import { CardAccentBadge } from '@/components/CardAccent';
import PressableScale from '@/components/PressableScale';
import Button from '@/components/Button';
import AddRow from '@/components/AddRow';
import { Badge } from '@/components/Badge';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import Stepper from '@/components/Stepper';
import { Input, SegmentedControl } from '@/components/FormControls';
import { useMealStore, MealType, Difficulty, Dish, Ingredient, dishTotalPrice } from '@/store/useMealStore';
import { useCatalogStore, StoreItem } from '@/store/useCatalogStore';
import { useShoppingStore, UNALLOCATED_LIST_ID } from '@/store/useShoppingStore';
import { useMonthlyListStore, monthlyListLabel } from '@/store/useMonthlyListStore';
import { showAppModal } from '@/components/AppModal';
import { BORDER_WIDTH, computeBorderTone, contrastOn, Fonts, FontSize, glassKey, HitSlop, MIN_TAP_TARGET, OpticalCenter, Radius, Spacing, TabularNums, Type } from '@/constants/theme';
import { useAppTheme, useIsDark, useScaledStyles, useAccessibility } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { useMountedTransition } from '@/lib/useMountedTransition';
import { Spring } from '@/constants/motion';
import { success, heavy } from '@/lib/haptics';
import { formatKr } from '@/lib/money';
import { useScreenColor } from '@/lib/screenColor';

type Props = {
  /** Show a transient confirmation banner in the parent screen. */
  onNotify: (msg: string) => void;
  /** Decision 044b — reports the ids just pushed to the weekly Unallocated bucket, so the
   *  parent can play their entrance/highlight animation and pulse the Weekly tab. */
  onAddedToWeek?: (ids: string[]) => void;
  /**
   * Drawn inside a card rather than on a screen — Shopping's Food drawer
   * (components/CollapsedSection.tsx). Presentation only: it swaps each meal section's
   * `Surface` for a bordered `View` so the drawer's own card isn't wrapping five more cards.
   * Every behaviour — the per-dish "+" popup, "Add dish", the ingredient editor — is the same
   * code either way, which is the whole point of mounting this component instead of
   * summarising it.
   */
  embedded?: boolean;
};

const MEAL_ORDER: { value: MealType; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'breakfast', icon: 'sunny-outline' },
  { value: 'lunch', icon: 'fast-food-outline' },
  { value: 'dinner', icon: 'restaurant-outline' },
  { value: 'snack', icon: 'nutrition-outline' },
  { value: 'kveldsmat', icon: 'moon-outline' },
];

/**
 * "A touch of colour based on the type of meal" — one hue per meal section.
 * (2026-07-18) Retuned to a calm, low-saturation set that steers CLEAR of semantic red/green:
 * lunch was `#10B981` (collided with `good`/done) and dinner `#EF4444` (collided with `bad`/
 * delete), which read as status signals on a food card. The new set keeps a warm→cool meal
 * progression without ever landing on a pure success-green or error-red — **still true below,
 * keep it true.**
 *
 * **Deliberately OUTSIDE `ThemePalette`** — reviewed in the 2026-08-10 hardcoded-colour sweep
 * and kept, on the same grounds as `IDENTITY_HUES`, `lib/severity.ts` and `lib/personColor.ts`:
 * this is a fixed identity set separating one axis of meaning, not a theme decision. Promoting
 * ten hues into the palette would put ten tokens into `colors.test.ts` for one component's
 * section headers. (It is no longer mode-INVARIANT — see below — but it stays out of the
 * palette; the test reaches in for the values instead, which is the cheaper half of the trade.)
 *
 * ✅ **(2026-08-10, later the same day) The two deviations the sweep raised are RESOLVED.**
 * That sweep measured both, called them "raised, not resolved", and declined the fix on the
 * grounds that it needed a per-mode meal set. It needed exactly that, and this is it:
 *  1. **Mode-aware pairs.** The old set was one hex serving both themes, tuned for the dark
 *     surface, painted straight onto the section TITLE — which on white failed the 4.5:1
 *     body-text floor on all five (breakfast #E0A85A at **2.12:1**, lunch 2.52, dinner 2.88,
 *     snack 3.07, kveldsmat 3.57). DESIGN_RULES rule 10 calls that a hard floor.
 *  2. **The hue is a FILL now, and no longer an edge.** It was passed to `<Surface borderColor>`,
 *     putting a non-screen hue on a card EDGE — the pattern the 2026-08-05 reset names as the
 *     bug it fixed, and visible from 2026-08-10 when this component started mounting inside
 *     Shopping's Food drawer: five differently-hued cards inside a green Shopping card.
 * Both land where addendum A.4 rule 1 already pointed — **an identity hue is a FILL, never text
 * and never an icon colour.** The hue survives as the round plate behind the meal glyph
 * (`mealPlate`); the title is `theme.text`, the chevron `theme.textMuted`, and the section card
 * inherits the screen hue like every other card. Same device as CardAccentBadge and the header
 * count pill, so this adds no new vocabulary — and it is why "redesigns the screen" turned out
 * to be a smaller cost than it looked.
 *
 * ── 2026-08-21: ON A LIGHTNESS LADDER, AND DRAWN AT FULL OPACITY ────────────────────────────
 *
 * `CONSISTENCY_AUDIT.md` §15, from *"Dishes color coding is weak/pale"*. Two causes, and the
 * second one mattered more than the hexes:
 *
 *  1. **The plate was the declined shape.** The badge was `rgba(hue, 0.16)` with a `theme.text`
 *     glyph — a hue fill at a FIXED opacity under a neutral glyph, which is exactly what
 *     `components/CardAccent.tsx`'s header records as DECLINED on 2026-08-10 and replaced
 *     app-wide on 2026-08-15: *"one opacity cannot serve eight hues in two modes."* A 16% wash
 *     of an already-pale hue was the whole of what reached the eye. It draws through
 *     `CardAccentBadge` now — neutral frost, hue as a fully opaque glyph, contrast derived per
 *     hue by `badgeGlyphFor` against the real composited plate — so this file has no private
 *     badge left and the colour arrives at full strength.
 *  2. **The values were pastels.** The dark set (`#D49B70`, `#79B2AE`, `#C8917F`, `#B27AE2`,
 *     `#8E88DF`) sat at saturation 0.27–0.64 against a palette whose identity hues run C* 43–93.
 *
 * ⚠️ **The five sit on a LIGHTNESS LADDER, the same device `IDENTITY_HUES` uses, and that is
 * the load-bearing half — saturating them alone makes the set WORSE for a colour-blind reader.**
 * That was measured, not assumed. At full chroma with the hues where they were, the amber and
 * the red — the two most saturated colours in the set — collapsed under deuteranopia to a
 * worst-pair ΔE2000 of **4.0**, and a purple/indigo pair to **9.8**. Both are "these two are the
 * same colour" territory.
 *
 * So the rung ORDER is not decorative and not alphabetical: it is the assignment that maximises
 * the worst dichromat pair across BOTH deuteranopia and protanopia in BOTH modes, searched over
 * rung permutations and a few degrees of hue either side of each family. Shipped worst pair (as
 * of the 2026-08-26 retune below): **15.17** (dark deutan; protan 23.77) and **18.3 / 18.9** in
 * light (unaffected) — against the 4.0 that saturating alone produced.
 *
 *   L* rung   1 (darkest in dark mode) … 5        dark on #242424   light on #F9FBFE
 *   dinner    1                                    57.5              18
 *   snack     2                                    64.7              25
 *   lunch     3                                    72                33
 *   breakfast 4                                    80                40
 *   kveldsmat 5                                    88                48
 *
 * Rung order is the same in both modes, so a meal's relative position does not flip when the
 * theme does. Each value is the most chromatic sRGB colour at its hue and rung — nothing is
 * desaturated to hit a number — and every one clears 4.5:1 on its own mode's `surface`, which is
 * what makes it safe as a fully opaque glyph on the frost plate.
 *
 * ── Retuned 2026-08-26 (DESIGN_COMPARISON/19 phase 1's `surface` correction, `#1E1E1E` →
 * `#242424` via a rejected `#2C2C2C` first attempt) — `dinner`/`dark` dropped from 4.57:1 to
 * 3.83:1 at the same universal L* ≥ 57.5 floor `constants/colors.ts`'s identity hues hit (see
 * that file's `IDENTITY_HUES` comment, and `lib/__tests__/colors.test.ts`'s `CHROMATIC_FLOOR`
 * comment, for the derivation). `dinner` lifted `#EE4F00` → `#F55200` (L* 57.514, 4.501:1 — the
 * tightest margin here), which forced `snack` (its ≥7-L*-apart neighbour) to lift too:
 * `#D073FF` → `#CF77FE` (chroma −4%, same hue), landing at L* 64.657. `breakfast`/`lunch`/
 * `kveldsmat` are untouched, and none of the LIGHT values moved.
 *
 * `lib/__tests__/colors.test.ts` pins the contrast, the ≥7 L* ladder and the dichromat floor,
 * and **reads these values out of this file rather than keeping a copy** — it held a hand-typed
 * duplicate until 2026-08-21 that was already stale, so every assertion was green against five
 * values the app had stopped drawing. Re-measure before changing one; the search script is
 * ordinary CIEDE2000 plus a Viénot/Brettel/Mollon projection, the same two the identity ladder
 * was picked with.
 */
const MEAL_COLORS: Record<MealType, { light: string; dark: string }> = {
  breakfast: { light: '#795B00', dark: '#FBBC00' }, // morning amber   — rung 4
  lunch:     { light: '#00594D', dark: '#00C6AC' }, // teal            — rung 3
  dinner:    { light: '#511B00', dark: '#F55200' }, // terracotta      — rung 1 (darkest)
  snack:     { light: '#600091', dark: '#CF77FE' }, // purple          — rung 2
  kveldsmat: { light: '#0068FA', dark: '#C7DEFF' }, // night blue      — rung 5 (lightest)
};

type DraftIngredient = { name: string; amount: string; unit: string; price: number };

export default function FoodTab({ onNotify, onAddedToWeek, embedded = false }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const { reducedMotion } = useAccessibility();
  // This screen's own orange (2026-08-06) — was lib/domainColor's 'meal' identity, which the
  // 2026-07-31 hue collapse turned to gold (the shopping hue), mismatching the Food screen.
  const screenHue = useScreenColor() ?? theme.border;

  const dishes = useMealStore((s) => s.dishes);
  const loadDishes = useMealStore((s) => s.load);
  const addDish = useMealStore((s) => s.addDish);
  const removeDish = useMealStore((s) => s.removeDish);
  const duplicateDish = useMealStore((s) => s.duplicateDish);
  const addIngredient = useMealStore((s) => s.addIngredient);
  const updateIngredient = useMealStore((s) => s.updateIngredient);
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

  // Tap-to-edit an EXISTING ingredient's quantity/price (2026-08-06) — only one open at a
  // time, ids are globally unique so a bare id is enough (no per-dish keying needed). The
  // price field needs its own text-buffer state (a Stepper commits live on each tap, but a
  // free-typed number needs somewhere to live mid-edit before it's parsed and committed).
  const [editingIngId, setEditingIngId] = useState<string | null>(null);
  const [editPriceDraft, setEditPriceDraft] = useState('');

  function toggleIngredientEdit(ing: Ingredient) {
    if (editingIngId === ing.id) {
      setEditingIngId(null);
      return;
    }
    setEditingIngId(ing.id);
    setEditPriceDraft(ing.priceNok > 0 ? String(ing.priceNok) : '');
  }

  function commitIngredientPrice(id: string) {
    const parsed = parseFloat(editPriceDraft.replace(',', '.'));
    updateIngredient(id, { priceNok: isNaN(parsed) ? 0 : parsed });
  }

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
      ...monthlyLists.map((l) => ({ text: monthlyListLabel(l, t.defaultMonthlyListName), onPress: () => pushDishToMonthlyList(dish, l.id) })),
      { text: t.cancel, style: 'cancel' as const },
    ]);
  }

  const canSaveDish = !!dishName.trim();

  return (
    <View style={styles.root}>
      {MEAL_ORDER.map(({ value: mealType, icon }) => {
        const color = MEAL_COLORS[mealType][isDark ? 'dark' : 'light'];
        const mealDishes = byMeal.get(mealType) ?? [];
        const sectionOpen = openSections[mealType];
        const sectionInner = (
          <>
            <PressableScale
              style={styles.sectionHeader}
              onPress={() => toggleSection(mealType)}
              accessibilityRole="button"
              accessibilityLabel={t.mealTypes[mealType]}
              accessibilityState={{ expanded: sectionOpen }}
              scaleTo={0.99}
              releaseSpring={Spring.calm}
            >
              {/* ⚠️ **`CardAccentBadge`, not a private plate (2026-08-21).** This was a
                  `rgba(color, 0.16)` disc with a `theme.text` glyph — a hue fill at a fixed
                  opacity under a neutral glyph, i.e. the shape components/CardAccent.tsx
                  declined in 2026-08-10 and the app inverted away from in 2026-08-15. The
                  badge is neutral-plate-with-an-opaque-hue-glyph everywhere else; it is here
                  now too, which is both what makes the colour arrive at full strength and the
                  reason this file no longer owns a badge. `accentOverride` is how a meal hue
                  reaches it — the same door Home's preview cards and the Dishes card use. */}
              <CardAccentBadge domain="meal" icon={icon} size={32} accentOverride={color} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.mealTypes[mealType]}</Text>
              <AnimatedChevron open={sectionOpen} />
            </PressableScale>

            <Collapsible open={sectionOpen}>
            <View style={styles.sectionBody}>
            {mealDishes.length === 0 ? (
              <Text style={[styles.sectionEmpty, { color: theme.textMuted }]}>{t.foodEmptyHint}</Text>
            ) : (
              <View style={styles.dishList}>
                {mealDishes.map((dish) => {
                  const isOpen = !!expanded[dish.id];
                  const total = dishTotalPrice(dish);
                  const draft = inlineIng[dish.id] ?? { name: '', amount: '1', price: '' };
                  // A strong, dish-coloured border separates one dish from the next (2026-08-06,
                  // user report). This View already wraps BOTH the collapsed name row AND the
                  // expanded ingredient/edit body below, so one border on the card is all that's
                  // needed for it to enclose the whole dish once expanded — no separate
                  // collapsed/expanded border logic. `computeBorderTone` at 'card' weight (not
                  // the lighter 'field' rung) is deliberate: a lighter tone read as too weak to
                  // actually separate adjacent dishes.
                  const dishBorderColor = computeBorderTone(color, isDark, 'card');
                  return (
                    <View key={dish.id} style={[styles.dishCard, { backgroundColor: theme.surface, borderColor: dishBorderColor }]}>
                      {/* Collapsed row: expand toggle · name · total price · "+" */}
                      <View style={styles.dishRow}>
                        <PressableScale style={styles.dishNameTap} onPress={() => setExpanded((p) => ({ ...p, [dish.id]: !p[dish.id] }))} hitSlop={HitSlop.tight} scaleTo={0.97}>
                          <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={16} color={theme.textMuted} />
                          <Text style={[styles.dishName, { color: theme.text }]} numberOfLines={1}>{dish.name}</Text>
                          <Badge
                            label={t.mealDifficulty[dish.difficulty]}
                            variant={dish.difficulty === 'easy' ? 'success' : 'neutral'}
                          />
                        </PressableScale>
                        {total > 0 && (
                          <Text style={[styles.dishPrice, TabularNums, { color: theme.textMuted }]}>{formatKr(total, 0)}</Text>
                        )}
                        <PressableScale
                          style={[styles.dishAddBtn, { backgroundColor: color }]}
                          onPress={() => setPopupDish(dish)}
                          accessibilityRole="button"
                          accessibilityLabel={t.addDishPopupTitle(dish.name)}
                          hitSlop={HitSlop.snug}
                          scaleTo={0.9}
                        >
                          <Ionicons name="add" size={18} color={contrastOn(color)} />
                        </PressableScale>
                      </View>

                      {/* Expanded: ingredient rows (name · amount · line price) + inline add + delete dish */}
                      {isOpen && (
                        <View style={styles.ingBody}>
                          {dish.ingredients.map((ing) => {
                            const ingEditing = editingIngId === ing.id;
                            return (
                              <View key={ing.id} style={[styles.ingRow, { borderTopColor: theme.border }]}>
                                {/* Viewing state: one clean line — tap to open the quantity/price
                                    editor below it. No per-row delete visible here (2026-08-06) —
                                    it moved into the edit line so a merely-viewed row stays quiet
                                    and uses its full width for name/amount/price. */}
                                <PressableScale
                                  style={styles.ingViewRow}
                                  onPress={() => toggleIngredientEdit(ing)}
                                  scaleTo={0.98}
                                  accessibilityRole="button"
                                  accessibilityLabel={t.editIngredientLabel(ing.name)}
                                  accessibilityState={{ expanded: ingEditing }}
                                >
                                  <Text style={[styles.ingName, { color: theme.text }]} numberOfLines={1}>{ing.name}</Text>
                                  <Text style={[styles.ingAmount, { color: theme.textMuted }]} numberOfLines={1}>
                                    {ing.amount}{ing.unit ? ` ${ing.unit}` : ''}
                                  </Text>
                                  {ing.priceNok > 0 && (
                                    <Text style={[styles.ingPrice, TabularNums, { color: theme.textMuted }]}>{formatKr(ing.priceNok, 0)}</Text>
                                  )}
                                  <Ionicons name={ingEditing ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textMuted} />
                                </PressableScale>
                                {/* Editing state: revealed one line under the row it belongs to —
                                    quantity stepper, a numbers-only price field, and the "X" that
                                    removes this ingredient (was always-visible; now lives here so
                                    it can't be mis-tapped while just scanning the list). */}
                                {ingEditing && (
                                  <View style={styles.ingEditRow}>
                                    <Stepper
                                      value={parseInt(ing.amount, 10) || 1}
                                      onChange={(next) => updateIngredient(ing.id, { amount: String(next) })}
                                      min={1}
                                      suffix={ing.unit || undefined}
                                      accessibilityLabel={t.ingredientQuantityLabel}
                                    />
                                    <Input
                                      recessed
                                      containerStyle={styles.ingEditPriceContainer}
                                      value={editPriceDraft}
                                      onChangeText={(v) => setEditPriceDraft(v.replace(/[^0-9.,]/g, ''))}
                                      placeholder={t.catalogueItemPricePlaceholder}
                                      keyboardType="decimal-pad"
                                      onBlur={() => commitIngredientPrice(ing.id)}
                                      onSubmitEditing={() => commitIngredientPrice(ing.id)}
                                    />
                                    <PressableScale
                                      onPress={() => { removeIngredient(ing.id); setEditingIngId(null); }}
                                      hitSlop={HitSlop.base}
                                      accessibilityLabel={t.removeItemLabel}
                                      scaleTo={0.9}
                                    >
                                      <Ionicons name="close-circle-outline" size={20} color={theme.bad} />
                                    </PressableScale>
                                  </View>
                                )}
                              </View>
                            );
                          })}

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
                                <Input
                                  recessed
                                  containerStyle={styles.ingAddQtyContainer}
                                  value={draft.amount}
                                  onChangeText={(v) => setInlineIng((p) => ({ ...p, [dish.id]: { ...draft, amount: v } }))}
                                  placeholder="1"
                                />
                                <Input
                                  recessed
                                  containerStyle={styles.ingAddPriceContainer}
                                  value={draft.price}
                                  onChangeText={(v) => setInlineIng((p) => ({ ...p, [dish.id]: { ...draft, price: v } }))}
                                  placeholder={t.catalogueItemPricePlaceholder}
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
                              hitSlop={HitSlop.snug}
                              scaleTo={0.93}
                              accessibilityLabel={t.duplicateDishBtn}
                            >
                              <Ionicons name="copy-outline" size={14} color={theme.textMuted} />
                              <Text style={[styles.deleteDishText, { color: theme.textMuted }]}>{t.duplicateDishBtn}</Text>
                            </PressableScale>
                            <PressableScale style={styles.deleteDishRow} onPress={() => { removeDish(dish.id); heavy(); }} hitSlop={HitSlop.snug} scaleTo={0.93}>
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
            {/* "Add dish" — moved out of the header (2026-08-06, user report: it sat too
                close to the expand chevron there) to a labelled row at the bottom of the
                expanded body, same "+ makes a new row" idiom as NewMonthlyListRow's
                "+ New list" trigger. Only reachable while the section is open, since the
                list it appends to isn't visible while closed. */}
            {/* `Button variant="ghost"` since 2026-08-10 — this was one of four hand-rolled
                spellings of exactly that (transparent fill, 1.5px hued edge, accent label),
                alongside WeekListCard's `addOptionBtn` and shopping.tsx's `budgetPill` /
                `addTrigger`. Consequence worth knowing: ghost takes its edge from the SCREEN
                hue and its label from `theme.accent`, so this no longer wears the per-meal
                colour. That is the intent — five differently-coloured buttons on one screen is
                the same deviation as five differently-coloured card edges (see MEAL_COLORS'
                note), and the meal identity is still carried by the section's icon, title and
                chevron right above it. */}
            <Button
              label={t.addDishToMealBtn}
              icon="add"
              variant="ghost"
              onPress={() => openNewDishModal(mealType)}
              style={styles.addDishRow}
            />
            </View>
            </Collapsible>
          </>
        );
        // Embedded (Shopping's Food drawer): a meal section is a bordered View, not a Surface.
        // The drawer is itself a Surface, and a Surface inside a Surface reads as a nested
        // panel — the trap components/StarterCard.tsx is warned off. The View keeps the radius
        // and the 'card'-rung weight (the same weight the dishCard boxes one level in already
        // use, exactly as on the real screen) and loses only the ramp gradient and the shadow,
        // which are what make it read as a second card. The pushed /food screen is untouched.
        //
        // (2026-08-10) Both edges take the SCREEN hue, not the meal hue. Per the card reset,
        // the screen owns every edge — and this component now mounts in two places, so a meal
        // hue here drew five differently-coloured cards inside Shopping's green drawer. The
        // Surface below passes no borderColor at all and simply inherits.
        // ⚠️ **No box when embedded (2026-08-21).** This drew each meal section as a bordered,
        // filled box INSIDE the card that already contains all five — the nested panel the
        // 2026-08-18 blueprint pass banned outright (*"Do NOT place borders … or separate
        // background boxes inside of main cards"*), and visible as five outlined rectangles in
        // the Food card's screenshot. It was right when it was written and the premise expired:
        // this was a DRAWER's content then, sitting on the screen backdrop, where an edge was
        // the only thing separating one meal from the next. Inside a card the gap does that.
        //   Same shape `SectionCard embedded` takes for the Week card's seven days —
        // `Shell = embedded ? View : Surface` — so nothing new is invented here.
        return embedded ? (
          <View key={mealType} style={[styles.section, styles.sectionEmbedded]}>
            {sectionInner}
          </View>
        ) : (
          <Surface key={mealType} style={styles.section}>
            {sectionInner}
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
                <PressableScale onPress={() => setPopupDish(null)} hitSlop={HitSlop.base} accessibilityLabel={t.closePopupLabel} scaleTo={0.9}>
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
                style={[styles.popupBtn, glassKey(theme.accent, isDark)]}
                onPress={() => popupDish && handleAddToMonthly(popupDish)}
                scaleTo={0.95}
              >
                <Ionicons name="calendar-outline" size={18} color={theme.text} />
                <Text style={[styles.popupBtnText, { color: theme.text }]}>{t.addToMonthlyListBtn}</Text>
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
              <Input
                value={dishName}
                onChangeText={setDishName}
                placeholder={t.dishNamePlaceholder}
              />

              <View style={styles.difficultyPicker}>
                <Text style={[styles.difficultyLabel, { color: theme.textMuted }]}>{t.dishDifficultyPickerLabel}</Text>
                <SegmentedControl
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
                  <PressableScale onPress={() => removeDraftIngredient(idx)} hitSlop={HitSlop.base} scaleTo={0.9}>
                    <Ionicons name="remove-circle-outline" size={18} color={theme.textMuted} />
                  </PressableScale>
                </View>
              ))}

              <AddRow
                placeholder={t.ingredientPlaceholder}
                value={ingName}
                onChangeText={onIngNameChange}
                onSubmit={addDraftIngredient}
                accent={screenHue}
                showDivider={false}
                accessibilityLabel={t.ingredientPlaceholder}
                extras={
                  <>
                    <Input
                      containerStyle={styles.amountInputContainer}
                      style={styles.amountInputField}
                      value={ingAmount}
                      onChangeText={setIngAmount}
                      keyboardType="decimal-pad"
                      placeholder="1"
                    />
                    <Input
                      containerStyle={styles.unitInputContainer}
                      value={ingUnit}
                      onChangeText={setIngUnit}
                      placeholder={t.shoppingUnitPlaceholder}
                    />
                    <Input
                      containerStyle={styles.priceInputContainer}
                      value={ingPrice}
                      onChangeText={setIngPrice}
                      keyboardType="decimal-pad"
                      placeholder={t.catalogueItemPricePlaceholder}
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
  // Only the edge Surface would have drawn — see the embedded branch at the map site — plus a
  // tighter gutter. Horizontal chrome stacks: on /food a dish name is inset by the screen's
  // padding + the section's + the dish card's, and the drawer adds its own Spacing.md pair on
  // top, which measurably chopped names ("Alt-i-ett-form med laks…" → "Alt-i-ett-form …").
  // Spacing.sm here buys back half of that; the drawer's own padding supplies the rest.
  // Spacing only since 2026-08-21 — the border and the fill came off with the box; see the map
  // site. The tighter gutter stays and is the reason this style still exists: horizontal chrome
  // stacks, and on /food a dish name is inset by the screen's padding + the section's + the dish
  // card's, which measurably chopped names ("Alt-i-ett-form med laks…" → "Alt-i-ett-form …").
  sectionEmbedded: { paddingHorizontal: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // The meal hue's only expression — a round soft plate under the glyph (A.4 rule 1). Sized to
  // match CardAccentBadge's small form so a meal section and a card header read as one family.
  // `mealPlate` is DELETED (2026-08-21) — components/CardAccent.tsx's CardAccentBadge draws it.
  // `Type.subheading`, the app's one in-card section heading (2026-08-21) — see
  // components/SectionRail.tsx's `subLabel` for why 17. This was `FontSize.lg` + bold (20),
  // one of the four sizes CONSISTENCY_AUDIT.md §2 counted for the same job.
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: Type.subheading.size,
    lineHeight: Type.subheading.size * Type.subheading.line,
    fontFamily: Type.subheading.fontFamily,
    ...OpticalCenter,
  },
  sectionBody: { gap: Spacing.sm },
  sectionEmpty: { fontSize: FontSize.sm, opacity: 0.85, paddingVertical: Spacing.xs, ...OpticalCenter },
  dishList: { gap: Spacing.xs },
  // "Add dish" trigger, bottom of the expanded section body (2026-08-06) — labelled bordered
  // row, same idiom as NewMonthlyListRow's "+ New list" pill. Was a small circular "+" in the
  // header next to the chevron; moved here so it reads as "add a new row to this list" rather
  // than crowding the expand/collapse control.
  // All the geometry moved into `Button` (2026-08-10) — it already draws a full-width ghost
  // at `MIN_TAP_TARGET` with its own radius, edge and centred icon+label. What is left is the
  // one thing Button does not decide: that this trigger spans the section.
  // `addDishRowText` is deleted with it.
  addDishRow: { alignSelf: 'stretch' },
  // Bordered box, not a bare row (2026-08-06) — see the inline comment at the map site for why
  // the border lives on this outer View rather than being conditional on `isOpen`.
  dishCard: { borderRadius: Radius.md, borderWidth: BORDER_WIDTH.card, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  dishRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: MIN_TAP_TARGET },
  dishNameTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dishName: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.semibold, ...OpticalCenter },
  dishPrice: { fontSize: FontSize.sm, fontFamily: Fonts.bold, ...OpticalCenter },
  dishAddBtn: { width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  ingBody: { paddingBottom: Spacing.xs },
  // Column now (2026-08-06): a row is the tap-to-edit view line, plus an optional edit line
  // revealed under it — was a single flat row with an always-visible delete button.
  ingRow: { paddingVertical: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
  ingViewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: MIN_TAP_TARGET },
  ingName: { flex: 1, fontSize: FontSize.sm, fontFamily: Fonts.medium, ...OpticalCenter },
  ingAmount: { fontSize: FontSize.xs, minWidth: 40, textAlign: 'right', ...OpticalCenter },
  ingPrice: { fontSize: FontSize.xs, minWidth: 48, textAlign: 'right', ...OpticalCenter },
  // Edit line (2026-08-06): quantity stepper + numbers-only price field + "X" to remove —
  // revealed by tapping the view row above; this is where the per-ingredient delete now lives.
  ingEditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xs, paddingLeft: Spacing.md },
  // Sizing only (2026-08-20) — these three plus amountInput/unitInput/priceInput below used
  // to be bare TextInputs with a flat `theme.surfaceMuted` fill and no border/glow, unlike
  // every other field in the app. The ambient-card ones (this trio) now go through
  // FormControls' `Input` with `recessed` — the same recessed-well style
  // components/InlineAddItem.tsx uses — since they live inside the dish card, same as that
  // caller. Field look (fill/border/radius/glow) comes from `Input` now, not from here.
  //
  // minWidth: 0 alongside flex: 1 (2026-08-06) — flex: 1 alone does not let a TextInput
  // shrink (same gotcha as TaskCard's titleInput/addStepInput, see AGENTS.md's wrap-audit
  // notes): without it this field refused to shrink below its content width and pushed the
  // trailing "X" remove button clean off the right edge of the card, clipped invisible.
  ingEditPriceContainer: { flex: 1, minWidth: 0 },
  ingAddQtyContainer: { width: 52 },
  ingAddPriceContainer: { width: 76 },
  dishFooterActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.md, marginTop: Spacing.xs },
  deleteDishRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteDishText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, ...OpticalCenter },

  // Popup
  popupOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  popupWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  popupCard: { width: '100%', maxWidth: 360, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  popupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  popupTitle: { flex: 1, fontSize: FontSize.lg, fontFamily: Fonts.bold, marginRight: Spacing.sm, ...OpticalCenter },
  popupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.md, paddingVertical: Spacing.md, minHeight: 48 },
  popupBtnText: { fontSize: FontSize.md, fontFamily: Fonts.bold, ...OpticalCenter },

  // New-dish sheet
  sheetWrapper: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl, maxHeight: '90%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.sm, borderBottomWidth: 1 },
  sheetTitle: { fontSize: FontSize.md, fontFamily: Fonts.bold, flex: 1, textAlign: 'center', ...OpticalCenter },
  sheetCancel: { fontSize: FontSize.md, ...OpticalCenter },
  sheetSave: { fontSize: FontSize.md, fontFamily: Fonts.bold, ...OpticalCenter },
  sheetScroll: { flexGrow: 0 },
  sheetScrollContent: { gap: Spacing.md },
  difficultyPicker: { gap: Spacing.xs },
  difficultyLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  draftRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  draftText: { flex: 1, fontSize: FontSize.sm, ...OpticalCenter },
  // Sizing only (2026-08-20) — these three sit inside the New-dish overlay sheet, not an
  // ambient card, so they go through the plain (non-recessed) `Input`, matching every other
  // editor field in the app (medicine-form, health-form, …) rather than `recessed`, which is
  // scoped to fields sunk into a card — see FormControls.tsx's `recessed` prop doc.
  amountInputContainer: { width: 56 },
  amountInputField: { textAlign: 'center' },
  unitInputContainer: { width: 64 },
  priceInputContainer: { width: 72 },
  suggestList: { maxHeight: 160, borderWidth: 1, borderRadius: Radius.sm },
  // alignItems is NOT optional here (2026-08-13): without it the row defaults to 'stretch',
  // so the FontSize.sm name and the FontSize.xs price top-aligned instead of sharing a centre
  // line. Unlike the OpticalCenter fixes around it, this one was visible on every platform.
  suggestRow: { padding: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  suggestText: { flex: 1, fontSize: FontSize.sm, ...OpticalCenter },
  suggestMeta: { fontSize: FontSize.xs, ...OpticalCenter },
});
