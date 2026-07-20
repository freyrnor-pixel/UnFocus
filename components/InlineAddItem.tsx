/**
 * InlineAddItem.tsx — inline "add a catalog item" panel (replaces the AddItemSheet modal).
 *
 * The collapse/expand sibling of components/AddRow for the richer catalog-add flow that needs
 * more than one field. Collapsed it's a "+ <label>" bar (matching AddRow); tapping it expands
 * IN PLACE — no modal — into the full form: Varenavn (required, with a live catalog-search
 * dropdown), Estimert pris (optional, auto-filled when a suggestion is picked), an optional
 * category chip row (only rendered when the `categories` prop is passed), Ønsket antall
 * (stepper, default 1), and an optional "Midlertidig" toggle (gated by `showTemporaryToggle`).
 * Two explicit actions close it: **Add** (Save) commits via onAdd and collapses back to the "+"
 * bar; **Discard** drops the in-progress row and collapses. Blurring the name field while
 * everything is still empty also collapses.
 *
 * Extracted from components/AddItemSheet.tsx (deleted) so the monthly-catalog add and the
 * inventory (staples) add stop opening a centered modal and instead use the same on-page
 * collapse→expand "+ makes a new row" affordance as everything else (2026-07-19). Extended
 * (2026-07-20 shopping-cleanup pass) to also replace WeekListCard's previously hand-rolled,
 * separately-styled inline add row — `showTemporaryToggle`/`categories` are optional so the two
 * older callers (Monthly tab, inventory-edit) are unaffected by default.
 *
 * Connections:
 *   Imports → components/FormControls (Input, Switch), components/PressableScale,
 *             constants/theme, lib/i18n, lib/money, lib/useAppTheme, lib/haptics,
 *             store/useCatalogStore, @expo/vector-icons
 *   Used by → app/(tabs)/shopping.tsx (Monthly tab catalog add), app/inventory-edit.tsx,
 *             components/WeekListCard.tsx (Weekly tab's "In list" add row)
 *   Data    → none directly — creation flows out via onAdd (payload now optionally carries
 *             `category`); the parent calls useShoppingStore.add()/update(). Reads
 *             useCatalogStore.suggest() (read-only) for the name-field autocomplete, including
 *             each suggestion's own `category` for one-tap auto-fill.
 *
 * Edit notes:
 *   - Mount it attached to the list it feeds (like AddRow) — it sizes itself; don't wrap it
 *     in its own modal/overlay.
 *   - Suggestions come from useCatalogStore.suggest(name, limit) (case-insensitive substring,
 *     startsWith-priority) — just render its result; dismissed once a suggestion is picked or
 *     the name is cleared.
 *   - Resets every field on collapse (Add or Discard), so re-expanding starts clean.
 *   - `categories` (from lib/shoppingCategories.ts's categoryPresets()) drives the chip row;
 *     omitting it renders nothing — no layout gap, no forced choice.
 */
import React, { useMemo, useState } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Spacing, contrastOn } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { formatKr } from '@/lib/money';
import { confirm as hapticConfirm } from '@/lib/haptics';
import { useCatalogStore } from '@/store/useCatalogStore';
import PressableScale from '@/components/PressableScale';
import { Input, Switch } from '@/components/FormControls';

type Props = {
  label: string;
  onAdd: (input: {
    name: string;
    price: number;
    targetQuantity: number;
    isTemporary: boolean;
    category?: string;
  }) => void;
  accent?: string;
  style?: StyleProp<ViewStyle>;
  /** Hide the "Midlertidig" toggle — Weekly items aren't temporary catalog rows. Default true. */
  showTemporaryToggle?: boolean;
  /** Optional preset category chips (value+label). Omit to render no category row at all —
   *  the default, unchanged behavior for callers that don't pass this (e.g. inventory-edit). */
  categories?: { value: string; label: string }[];
};

export default function InlineAddItem({
  label,
  onAdd,
  accent,
  style,
  showTemporaryToggle = true,
  categories,
}: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const catalogSuggest = useCatalogStore((s) => s.suggest);

  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [targetQty, setTargetQty] = useState(1);
  const [temporary, setTemporary] = useState(false);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);

  const fill = accent ?? theme.accent;

  const suggestions = useMemo(
    () => (suggestionsDismissed ? [] : catalogSuggest(name, 5)),
    [catalogSuggest, name, suggestionsDismissed]
  );

  function reset() {
    setName('');
    setPrice('');
    setTargetQty(1);
    setTemporary(false);
    setCategory(undefined);
    setSuggestionsDismissed(false);
  }

  function collapse() {
    reset();
    setExpanded(false);
  }

  function handlePickSuggestion(item: { name: string; price: number; category?: string }) {
    setName(item.name);
    if (item.price > 0) setPrice(String(item.price));
    if (item.category) setCategory(item.category);
    setSuggestionsDismissed(true);
  }

  function handleAdd() {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      price: parseFloat(price.replace(',', '.')) || 0,
      targetQuantity: Math.max(1, targetQty),
      isTemporary: temporary,
      category,
    });
    hapticConfirm();
    collapse(); // discrete: back to the "+" bar after each save
  }

  // ── Collapsed: "+ <label>" bar ──
  if (!expanded) {
    return (
      <PressableScale
        style={[styles.addBar, { borderColor: fill, backgroundColor: theme.accentSoft }, style]}
        onPress={() => setExpanded(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        scaleTo={0.97}
      >
        <Ionicons name="add-circle-outline" size={18} color={fill} />
        <Text style={[styles.addBarLabel, { color: fill }]} numberOfLines={1}>{label}</Text>
      </PressableScale>
    );
  }

  // ── Expanded: the full add-item form, inline ──
  const canAdd = name.trim().length > 0;
  return (
    <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      <Input
        label={t.varenavnLabel}
        value={name}
        onChangeText={(v) => { setName(v); setSuggestionsDismissed(false); }}
        placeholder={t.shoppingItemPlaceholder}
        returnKeyType="done"
        autoFocus
        onSubmitEditing={handleAdd}
        onBlur={() => { if (!name.trim() && !price && targetQty === 1 && !temporary && !category) setExpanded(false); }}
      />
      {suggestions.length > 0 && (
        <View style={[styles.suggestionsBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          {suggestions.map((s) => (
            <PressableScale key={s.id} style={styles.suggestionRow} onPress={() => handlePickSuggestion(s)} scaleTo={0.97}>
              <Text style={[styles.suggestionName, { color: theme.text }]} numberOfLines={1}>{s.name}</Text>
              {s.price > 0 && (
                <Text style={[styles.suggestionPrice, { color: theme.textMuted }]}>{formatKr(s.price, 0)}</Text>
              )}
            </PressableScale>
          ))}
        </View>
      )}

      <Input
        label={t.estimertPrisLabel}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        placeholder="0"
        style={styles.priceInputSpacing}
      />

      {categories && categories.length > 0 && (
        <>
          <Text style={[styles.label, { color: theme.textMuted }]}>{t.categoryPickerLabel}</Text>
          <View style={styles.categoryRow}>
            {categories.map((c) => {
              const selected = category === c.value;
              return (
                <PressableScale
                  key={c.value}
                  style={[
                    styles.categoryChip,
                    { borderColor: fill, backgroundColor: selected ? fill : 'transparent' },
                  ]}
                  onPress={() => setCategory(selected ? undefined : c.value)}
                  scaleTo={0.95}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.categoryChipText, { color: selected ? contrastOn(fill) : fill }]} numberOfLines={1}>
                    {c.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </>
      )}

      <Text style={[styles.label, { color: theme.textMuted }]}>{t.onsketAntallLabel}</Text>
      <View style={styles.stepperRow}>
        <PressableScale
          style={[styles.stepBtn, { backgroundColor: theme.surfaceMuted }]}
          onPress={() => setTargetQty((q) => Math.max(1, q - 1))}
          hitSlop={6}
          scaleTo={0.90}
        >
          <Text style={[styles.stepText, { color: theme.text }]}>−</Text>
        </PressableScale>
        <Text style={[styles.qtyText, { color: theme.text }]}>{targetQty}</Text>
        <PressableScale
          style={[styles.stepBtn, { backgroundColor: theme.accent }]}
          onPress={() => setTargetQty((q) => q + 1)}
          hitSlop={6}
          scaleTo={0.90}
        >
          <Text style={[styles.stepText, { color: theme.accentInk }]}>+</Text>
        </PressableScale>
      </View>

      {showTemporaryToggle && (
        <View style={styles.toggleRow}>
          <Text style={[styles.label, { color: theme.textMuted, marginBottom: 0 }]}>{t.midlertidigToggleLabel}</Text>
          <Switch checked={temporary} onChange={setTemporary} />
        </View>
      )}

      <View style={styles.actionsRow}>
        <PressableScale
          style={styles.ghostBtn}
          onPress={collapse}
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={t.a11yDiscardRow}
        >
          <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>{t.cancelBtn}</Text>
        </PressableScale>
        <PressableScale
          style={[styles.primaryBtn, { backgroundColor: canAdd ? fill : theme.surfaceMuted }]}
          onPress={handleAdd}
          disabled={!canAdd}
          scaleTo={0.95}
          haptic={false}
        >
          <Text style={[styles.primaryBtnText, { color: canAdd ? contrastOn(fill) : theme.textMuted }]}>{t.addItemBtn}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  addBarLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  panel: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  label: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, marginTop: Spacing.sm, marginBottom: 4 },
  priceInputSpacing: { marginTop: Spacing.sm },
  suggestionsBox: { borderRadius: Radius.sm, marginTop: 4, borderWidth: 1, overflow: 'hidden' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  suggestionName: { flex: 1, fontSize: FontSize.sm },
  suggestionPrice: { fontSize: FontSize.xs },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  categoryChip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
  },
  categoryChipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: { width: 34, height: 34, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: FontSize.lg, fontFamily: Fonts.bold, lineHeight: 22 },
  qtyText: { fontSize: FontSize.md, fontFamily: Fonts.bold, minWidth: 28, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, marginBottom: Spacing.xs },
  ghostBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  ghostBtnText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  primaryBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  primaryBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
