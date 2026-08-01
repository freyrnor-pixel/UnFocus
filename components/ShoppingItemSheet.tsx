/**
 * ShoppingItemSheet.tsx — the detail editor for one shopping item.
 *
 * Opened by tapping a row's body on the Shopping screen (and Home's shopping preview).
 * This is where a weekly item's quantity, unit, per-unit price and category are changed —
 * before this existed there was no editor for those fields at all: the row carried an
 * inline −/+ stepper for quantity and nothing whatsoever for unit, price or category.
 *
 * **Why the stepper lives here and not in the row** (row rule, 2026-07-28, design-system v6
 * `Checklist Redesign Options`): "quantity is an input, not a value". An input inside a list
 * row makes the row reflow as the number grows and forces the money column to give up its
 * clean right edge. Quantity now *reads* in the row's leading cluster next to the check and
 * is *edited* here.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/PressableScale, components/Stepper,
 *             components/Surface, components/FormControls (Input), constants/theme,
 *             lib/haptics, lib/i18n, lib/shoppingCategories, lib/useAppTheme,
 *             store/useShoppingStore (ShoppingItem type + update)
 *   Used by → components/WeekListCard.tsx, app/(tabs)/shopping.tsx,
 *             components/HomeShoppingCard.tsx
 *   Data    → writes shopping_items via useShoppingStore.update() (name/amount/unit/
 *             price/category). Schedules nothing, and touches no other table.
 *
 * Edit notes:
 *   - **Quantity applies immediately; the text fields commit on close.** The stepper is a
 *     discrete tap so there's no half-typed state to protect, and it's the field people came
 *     here for — making it wait behind a Done button would be worse than the inline stepper
 *     it replaced. Name/unit/price are free text and commit in `commit()`, which the Done
 *     button and the backdrop dismiss both run, so a swipe-down never silently drops an edit.
 *   - `amount` is a TEXT column that usually holds a number but is allowed to hold anything
 *     ("2-3", "a bunch") — same as the row, which falls back to MIN_QTY when it isn't
 *     numeric. The stepper is therefore only offered for numeric amounts; a non-numeric one
 *     is edited as text instead of being silently rounded into a number.
 *   - `item` is nullable so the parent can keep the sheet mounted while it animates out
 *     (Decision 044b) — the last non-null item is cached in a ref and rendered during the
 *     exit, exactly like ListSettingsSheet. Read `shown`, never `item`, in the body.
 *   - **Wrapped in a KeyboardAvoidingView** (same fix as components/UpdateSheet.tsx) because
 *     RN's `<Modal>` — which AnimatedBottomSheet renders into — sits outside the screen's own
 *     KeyboardAvoidingView subtree. Without this the keyboard covered the name/unit/price
 *     fields and the category chips/Done button below them (2026-08-01 fix).
 */
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import PressableScale from '@/components/PressableScale';
import Stepper from '@/components/Stepper';
import Surface from '@/components/Surface';
import { Input } from '@/components/FormControls';
import { Fonts, FontSize, Radius, Spacing, MIN_TAP_TARGET } from '@/constants/theme';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { categoryPresets } from '@/lib/shoppingCategories';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useShoppingStore, ShoppingItem } from '@/store/useShoppingStore';

/** Same clamps the row used for its inline stepper, kept in step deliberately. */
const MIN_QTY = 1;
const MAX_QTY = 99;

type Props = {
  visible: boolean;
  item: ShoppingItem | null;
  onClose: () => void;
};

export default function ShoppingItemSheet({ visible, item, onClose }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const update = useShoppingStore((s) => s.update);

  // Keep the last real item so the sheet still has something to draw while it animates out.
  const cached = useRef<ShoppingItem | null>(item);
  if (item) cached.current = item;
  const shown = item ?? cached.current;

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [amountText, setAmountText] = useState('');

  // Re-seed every time a (different) item opens the sheet — not on every render, or typing
  // would be overwritten by the store row on the next store notification.
  useEffect(() => {
    if (!visible || !shown) return;
    setName(shown.name);
    setUnit(shown.unit);
    setPrice(shown.price > 0 ? String(shown.price) : '');
    setAmountText(shown.amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, shown?.id]);

  if (!shown) return null;

  const qty = Number(shown.amount);
  const isNumericAmount = shown.amount.trim() !== '' && Number.isFinite(qty);
  const safeQty = isNumericAmount ? Math.round(qty) : MIN_QTY;
  const categories = categoryPresets(t);

  function setQuantity(next: number) {
    if (!shown) return;
    update(shown.id, { amount: String(next) });
  }

  /** Commit the free-text fields. Runs on Done AND on dismiss, so nothing typed is lost. */
  function commit() {
    if (!shown) return;
    const trimmedName = name.trim();
    // Same comma-tolerant parse the add form uses (components/InlineAddItem.tsx) — a
    // Norwegian keyboard gives "12,50", and Number() would turn that into NaN.
    const parsedPrice = parseFloat(price.replace(',', '.')) || 0;
    update(shown.id, {
      // A blank name would render an unidentifiable row, so an empty field keeps the old one.
      name: trimmedName || shown.name,
      unit: unit.trim(),
      price: parsedPrice,
      ...(isNumericAmount ? {} : { amount: amountText }),
    });
  }

  function close() {
    commit();
    onClose();
  }

  function chooseCategory(value: string) {
    if (!shown) return;
    selection();
    update(shown.id, { category: value });
  }

  return (
    <AnimatedBottomSheet visible={visible} onClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flexFill}
      >
        <Surface surfaceContext="overlay" style={styles.sheet}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {shown.name}
          </Text>

          {/* Quantity — the field this sheet exists for, so it sits first. */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
              {t.shoppingItemSheet.quantity}
            </Text>
            {isNumericAmount ? (
              <Stepper
                value={safeQty}
                onChange={setQuantity}
                min={MIN_QTY}
                max={MAX_QTY}
                accessibilityLabel={t.shoppingItemSheet.quantity}
              />
            ) : (
              // Free-text amounts ("2-3", "a bunch") stay free text rather than being rounded.
              <Input
                value={amountText}
                onChangeText={setAmountText}
                placeholder={t.shoppingItemSheet.quantityPlaceholder}
                style={styles.input}
              />
            )}
          </View>

          <Input
            label={t.shoppingItemSheet.name}
            value={name}
            onChangeText={setName}
            style={styles.input}
          />

          <View style={styles.pair}>
            <View style={styles.pairCol}>
              <Input
                label={t.shoppingItemSheet.unit}
                value={unit}
                onChangeText={setUnit}
                placeholder={t.shoppingItemSheet.unitPlaceholder}
                style={styles.input}
              />
            </View>
            <View style={styles.pairCol}>
              <Input
                label={t.shoppingItemSheet.price}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="0"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
              {t.shoppingItemSheet.category}
            </Text>
            <View style={styles.chips}>
              {categories.map((c) => {
                const active = (shown.category ?? 'other') === c.value;
                return (
                  <PressableScale
                    key={c.value}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? theme.accent : theme.border,
                        backgroundColor: active ? theme.accentSoft : theme.surfaceMuted,
                      },
                    ]}
                    onPress={() => chooseCategory(c.value)}
                    scaleTo={0.95}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[styles.chipText, { color: active ? theme.accent : theme.textMuted }]}
                    >
                      {c.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {shown.inventoryQty > 0 ? (
            <Text style={[styles.stock, { color: theme.good }]}>
              {t.inStockLabel}: {shown.inventoryQty}
            </Text>
          ) : null}

          <PressableScale
            style={[styles.doneBtn, { backgroundColor: theme.accent }]}
            onPress={close}
            scaleTo={0.95}
          >
            <Text style={[styles.doneBtnText, { color: theme.accentInk }]}>
              {t.shoppingItemSheet.done}
            </Text>
          </PressableScale>
        </Surface>
      </KeyboardAvoidingView>
    </AnimatedBottomSheet>
  );
}

const baseStyles = StyleSheet.create({
  flexFill: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  field: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  input: { minHeight: MIN_TAP_TARGET },
  // Two half-width fields. `flex: 1` with no minWidth on purpose — a minWidth pair is what
  // breaks at 360px (see AGENTS.md's wrap-audit lessons).
  pair: { flexDirection: 'row', gap: Spacing.sm },
  pairCol: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  stock: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  doneBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  doneBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
