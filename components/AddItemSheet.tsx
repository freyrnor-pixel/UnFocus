/**
 * AddItemSheet.tsx — shared floating modal for free-adding an item to Katalog or Ukeliste.
 *
 * Opened from the FAB on either the Katalog screen (creates a catalog item) or
 * the Ukeliste screen (creates a weekly working-list item, with an extra
 * "Legg også til i katalog" toggle so the user can optionally persist it as a
 * permanent catalog item too). Fields: Varenavn (required, with a live
 * catalog-search dropdown), Estimert pris (optional, auto-filled when a
 * suggestion is picked), Ønsket antall (stepper, default 1), and a "Midlertidig"
 * toggle (defaults to true on both screens — most free-adds are one-off needs).
 *
 * Renders as a centered, scale+fade card over a dimmed backdrop (not a bottom
 * sheet) — see Edit notes.
 *
 * Connections:
 *   Imports → components/FormControls, components/PressableScale, components/Surface,
 *             constants/theme, lib/i18n, lib/useAppTheme, store/useCatalogStore,
 *             react-native-reanimated
 *   Used by → (not yet mounted — Phase 5 screens: app/shopping.tsx, app/inventory-edit.tsx)
 *   Data    → none directly — creation flows out via onAdd; the parent calls
 *             useShoppingStore.add(). Reads useCatalogStore.suggest() (read-only,
 *             Phase 5 stub per Decision 015/015a) for the name-field autocomplete.
 *
 * Edit notes:
 *   - `origin` controls whether the "Legg også til i katalog" toggle renders at all
 *     (only meaningful when adding from the weekly/Ukeliste screen).
 *   - Resets all fields on close via the useEffect keyed on `visible`.
 *   - Tracks its own `mounted` state (decoupled from `visible`) so Cancel/backdrop-tap/
 *     Android-back can play the exit animation before unmounting — same pattern as
 *     components/AppModal.tsx. Don't pass `visible` straight to <Modal visible={...}>,
 *     that would skip the exit animation entirely.
 *   - No drag-to-dismiss — that was specific to the bottom sheet this replaced; a
 *     centered modal has no natural drag affordance.
 *   - Suggestions come from useCatalogStore.suggest(name, limit), which already does
 *     case-insensitive substring matching with startsWith-priority ordering — don't
 *     duplicate that logic here, just render its result. Dismissed once a suggestion
 *     is picked or the name is cleared. Rendered as a plain themed list (not a nested
 *     Surface) since it sits inside this sheet's own overlay glass — a second glass
 *     layer here would double-frost.
 *   - Decision 008: the card is a glass Surface in `overlay` context (this sheet sits
 *     over live screen content). Blur comes from Surface's BlurView; this file never
 *     imports expo-blur directly.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useAccessibility, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { useCatalogStore } from '@/store/useCatalogStore';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { Input, Switch } from '@/components/FormControls';

type Props = {
  visible: boolean;
  origin: 'catalog' | 'weekly';
  onClose: () => void;
  onAdd: (input: {
    name: string;
    price: number;
    targetQuantity: number;
    isTemporary: boolean;
    alsoAddToCatalog: boolean;
  }) => void;
};

export default function AddItemSheet({ visible, origin, onClose, onAdd }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const catalogSuggest = useCatalogStore((s) => s.suggest);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [targetQty, setTargetQty] = useState(1);
  const [temporary, setTemporary] = useState(origin !== 'catalog');
  const [alsoAddToCatalog, setAlsoAddToCatalog] = useState(false);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);

  const [mounted, setMounted] = useState(visible);
  const opacity = useSharedValue(visible ? 1 : 0);
  const scale = useSharedValue(visible ? 1 : 0.82);

  useEffect(() => {
    if (visible) {
      setName('');
      setPrice('');
      setTargetQty(1);
      setTemporary(origin !== 'catalog');
      setAlsoAddToCatalog(false);
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
  }, [visible, origin, reducedMotion]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const suggestions = useMemo(
    () => (suggestionsDismissed ? [] : catalogSuggest(name, 5)),
    [catalogSuggest, name, suggestionsDismissed]
  );

  function handlePickSuggestion(item: { name: string; price: number }) {
    setName(item.name);
    if (item.price > 0) setPrice(String(item.price));
    setSuggestionsDismissed(true);
  }

  function handleAdd() {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      price: parseFloat(price.replace(',', '.')) || 0,
      targetQuantity: Math.max(1, targetQty),
      isTemporary: temporary,
      alsoAddToCatalog,
    });
  }

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, backdropStyle]} />
        </Pressable>

        <Animated.View style={[styles.cardWrap, cardStyle]}>
          <Surface surfaceContext="overlay" style={styles.card}>
            <Text style={[styles.title, { color: theme.text }]}>{t.addSheetTitle}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.scrollView}>
              <Input
                label={t.varenavnLabel}
                value={name}
                onChangeText={(v) => { setName(v); setSuggestionsDismissed(false); }}
                placeholder={t.shoppingItemPlaceholder}
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />
              {suggestions.length > 0 && (
                <View style={[styles.suggestionsBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                  <ScrollView keyboardShouldPersistTaps="handled" style={styles.suggestionsScroll}>
                    {suggestions.map((s) => (
                      <Pressable key={s.id} style={styles.suggestionRow} onPress={() => handlePickSuggestion(s)}>
                        <Text style={[styles.suggestionName, { color: theme.text }]} numberOfLines={1}>{s.name}</Text>
                        {s.price > 0 && (
                          <Text style={[styles.suggestionPrice, { color: theme.textMuted }]}>{s.price.toFixed(0)} kr</Text>
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>
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

              <Text style={[styles.label, { color: theme.textMuted }]}>{t.onsketAntallLabel}</Text>
              <View style={styles.stepperRow}>
                <PressableScale
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceMuted }]}
                  onPress={() => setTargetQty((q) => Math.max(1, q - 1))}
                  hitSlop={6}
                >
                  <Text style={[styles.stepText, { color: theme.text }]}>−</Text>
                </PressableScale>
                <Text style={[styles.qtyText, { color: theme.text }]}>{targetQty}</Text>
                <PressableScale
                  style={[styles.stepBtn, { backgroundColor: theme.accent }]}
                  onPress={() => setTargetQty((q) => q + 1)}
                  hitSlop={6}
                >
                  <Text style={[styles.stepText, { color: theme.accentInk }]}>+</Text>
                </PressableScale>
              </View>

              <View style={styles.toggleRow}>
                <Text style={[styles.label, { color: theme.textMuted, marginBottom: 0 }]}>{t.midlertidigToggleLabel}</Text>
                <Switch checked={temporary} onChange={setTemporary} />
              </View>

              {origin === 'weekly' && (
                <View style={styles.toggleRow}>
                  <Text style={[styles.label, { color: theme.textMuted, marginBottom: 0 }]}>{t.addAlsoToCatalogToggle}</Text>
                  <Switch checked={alsoAddToCatalog} onChange={setAlsoAddToCatalog} />
                </View>
              )}

              <View style={styles.actionsRow}>
                <PressableScale style={styles.ghostBtn} onPress={onClose}>
                  <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>{t.cancelBtn}</Text>
                </PressableScale>
                <PressableScale style={[styles.primaryBtn, { backgroundColor: theme.accent }]} onPress={handleAdd}>
                  <Text style={[styles.primaryBtnText, { color: theme.accentInk }]}>{t.addItemBtn}</Text>
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
  label: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, marginTop: Spacing.sm, marginBottom: 4 },
  priceInputSpacing: { marginTop: Spacing.sm },
  suggestionsBox: { borderRadius: Radius.sm, marginTop: 4, borderWidth: 1 },
  suggestionsScroll: { maxHeight: 160 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  suggestionName: { flex: 1, fontSize: FontSize.sm },
  suggestionPrice: { fontSize: FontSize.xs },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: { width: 34, height: 34, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: FontSize.lg, fontFamily: Fonts.bold, lineHeight: 22 },
  qtyText: { fontSize: FontSize.md, fontFamily: Fonts.bold, minWidth: 28, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  ghostBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  ghostBtnText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  primaryBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  primaryBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
