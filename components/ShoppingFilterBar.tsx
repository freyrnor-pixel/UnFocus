/**
 * ShoppingFilterBar.tsx — shared "search by name + filter by category" bar for shopping lists.
 *
 * A `TextInput` (name search) plus a category-picker button that reuses the existing
 * `showAppModal` chooser idiom (same pattern as WeekListCard's kebab "list options" menu)
 * instead of a new dropdown/menu component. Purely controlled — the caller owns
 * search/category state and does its own `.filter()` over its item list; this component
 * only renders the bar and the category chooser.
 *
 * Connections:
 *   Imports → components/AppModal (showAppModal), components/FormControls (Input),
 *             components/PressableScale, constants/theme (BORDER_WIDTH, computeBorderTone),
 *             lib/i18n (useT), lib/screenColor (useScreenColor),
 *             lib/shoppingCategories (categoryPresets, categoryLabel),
 *             lib/useAppTheme, lib/useKeyboardLift, @expo/vector-icons
 *   Used by → components/WeekListCard.tsx (per-list Weekly filter), components/AddFromMonthlyModal.tsx,
 *             app/(tabs)/shopping.tsx (Monthly tab filter)
 *   Data    → none — fully controlled by the caller's search/category state
 *
 * Edit notes:
 *   - **Keyboard-avoidance (2026-07-31)**: `useKeyboardLift` lifts the search field above the
 *     keyboard when this bar sits mid-screen (an expanded WeekListCard scrolled down).
 *   - **The search box is `FormControls`' `Input`, not a hand-rolled `TextInput` (2026-08-08).**
 *     It used to be a bare `surfaceMuted` box with NO border at all, which the 2026-08-05 card
 *     reset ("borders around cards, buttons, text-boxes, options") left behind — and it sat
 *     directly beside this bar's own bordered category button, so the two halves of one control
 *     row disagreed. `Input` gained `forwardRef` in the same change so `useKeyboardLift` can
 *     still reach the underlying `TextInput`; that ref is the only reason this was hand-rolled.
 *     It also brings the shared focus state (rule 18) the old box never had.
 *   - The category button wears the screen hue at the BUTTON rung, one step lighter than the
 *     field beside it (`BORDER_WIDTH.button` + `computeBorderTone(..., 'button')`) — the same
 *     card → field → button ramp `constants/theme.ts` documents. It was a bare `borderWidth: 1`
 *     in `theme.border` before, which read heavier than the field it pairs with.
 */
import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_WIDTH, computeBorderTone, FontSize, Radius, Spacing, MIN_TAP_TARGET } from '@/constants/theme';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useScreenColor } from '@/lib/screenColor';
import { useT } from '@/lib/i18n';
import { categoryLabel, categoryPresets } from '@/lib/shoppingCategories';
import { showAppModal } from '@/components/AppModal';
import { Input } from '@/components/FormControls';
import PressableScale from '@/components/PressableScale';
import { useKeyboardLift } from '@/lib/useKeyboardLift';

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  category: string | null;
  onCategoryChange: (v: string | null) => void;
  placeholder: string;
};

export default function ShoppingFilterBar({ search, onSearchChange, category, onCategoryChange, placeholder }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const t = useT();
  const searchLift = useKeyboardLift<TextInput>();
  // Shopping's own green, one rung lighter than the field it sits beside — see the header.
  const screenHue = useScreenColor() ?? theme.border;
  const buttonEdge = computeBorderTone(screenHue, isDark, 'button');

  function openCategoryChooser() {
    showAppModal(t.categoryPickerLabel, undefined, [
      { text: t.categoryFilterAllLabel, onPress: () => onCategoryChange(null) },
      ...categoryPresets(t).map((preset) => ({ text: preset.label, onPress: () => onCategoryChange(preset.value) })),
      { text: t.cancel, style: 'cancel' as const },
    ]);
  }

  const categoryText = category ? categoryLabel(t, category) : t.categoryFilterAllLabel;

  return (
    <View style={styles.row}>
      {/* `Input` renders its own label/error wrapper View, and that View is what sits in this
          row — so the flex lives here, not in the Input's `style` (which lands on the
          TextInput inside it). `minWidth: 0` alongside `flex: 1` is what actually lets it
          shrink; `flex: 1` on its own does not (AGENTS.md's wrap-audit lesson). */}
      <View style={styles.searchWrap}>
        {/* `recessed` (consistency audit, 2026-08-21): all three of this bar's mount sites are
            INSIDE a card — components/WeekListCard.tsx, app/(tabs)/shopping.tsx's monthly cards
            and components/AddFromMonthlyModal.tsx — which is exactly the condition `recessed`
            documents itself for. Without it this drew a bordered box beside `InlineAddItem`'s
            recessed well in the same card, i.e. two field shapes one row apart. */}
        <Input
          ref={searchLift.ref}
          recessed
          style={styles.search}
          value={search}
          onChangeText={onSearchChange}
          onFocus={searchLift.onFocus}
          onBlur={searchLift.onBlur}
          placeholder={placeholder}
        />
      </View>
      <PressableScale
        style={[styles.categoryBtn, { backgroundColor: theme.surfaceMuted, borderColor: buttonEdge }]}
        onPress={openCategoryChooser}
        scaleTo={0.97}
        accessibilityRole="button"
        accessibilityLabel={t.categoryFilterAccessibilityLabel}
      >
        <Text style={[styles.categoryBtnText, { color: theme.text }]} numberOfLines={1}>
          {categoryText}
        </Text>
        <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  searchWrap: { flex: 1, minWidth: 0 },
  // Everything shaping this box — border, radius, fill, focus state, min height — now comes
  // from `Input`. The one deliberate override is the smaller type: this is a compact filter
  // bar sitting beside a FontSize.sm button, and the shared field's FontSize.md would
  // truncate the placeholder at 360px in Norwegian.
  search: { fontSize: FontSize.sm },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: BORDER_WIDTH.button,
    minHeight: MIN_TAP_TARGET,
    maxWidth: 140,
  },
  categoryBtnText: { fontSize: FontSize.sm },
});
