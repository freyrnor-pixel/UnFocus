/**
 * UpdateSheet.tsx — bottom sheet for editing a single Katalog item.
 *
 * Opens when a Katalog row body (not its checkbox) is tapped. Edits name,
 * estimated price, target quantity (the "Ønsket antall ved reset" stepper —
 * the ONLY place targetQuantity is mutated, replacing the old inline +/-
 * steppers on the main row), and the isTemporary toggle. "Slett fra katalog"
 * uses an inline two-step confirm (no native Alert) since this is a sheet.
 *
 * Connections:
 *   Imports → components/FormControls, components/PressableScale, components/Surface,
 *             constants/theme, lib/i18n, lib/useAppTheme, store/useShoppingStore (type only)
 *   Used by → app/shopping.tsx (Monthly catalog row edit); app/inventory-edit.tsx not yet ported
 *   Data    → none directly — all mutations flow out via onSave/onDelete callbacks; the
 *             parent calls useShoppingStore.update()/removeWithSource() (Phase 5)
 *
 * Edit notes:
 *   - visible/item are controlled by the parent; internal field state resets via the useEffect keyed on item.id whenever a different item opens.
 *   - deleteArmed is local state for the inline "Er du sikker?" confirm step — resets whenever the sheet closes or a different item opens.
 *   - Wrapped in a KeyboardAvoidingView because RN's <Modal> renders outside the
 *     screen's own KeyboardAvoidingView subtree — without this, the keyboard covers
 *     the name input on short screens.
 *   - Decision 008: the sheet is a glass Surface in `overlay` context. Blur comes from
 *     Surface's BlurView; this file never imports expo-blur directly.
 *   - **Decision 044b (2026-07-09):** was a bare `<Modal animationType="slide">` gated by
 *     `if (!item) return null` — closing set `item` to null in the same tick `visible`
 *     went false, so the whole tree (including the Modal) unmounted instantly, skipping
 *     even RN's own native slide-out. Switched to `lib/useMountedTransition` (the
 *     AddItemSheet/AppModal mounted-state pattern): `mounted` now gates the early return
 *     instead of `item`, and a Reanimated backdrop-fade + sheet-slide plays both ways.
 *     Safe to keep reading `item` only inside the field-reset effect (never in JSX) since
 *     nothing here renders `item.*` directly.
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { ShoppingItem } from '@/store/useShoppingStore';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles, useAccessibility } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { useMountedTransition } from '@/lib/useMountedTransition';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { Switch } from '@/components/FormControls';

type Props = {
  visible: boolean;
  item: ShoppingItem | null;
  onClose: () => void;
  onSave: (patch: { name: string; price: number; targetQuantity: number; isTemporary: boolean }) => void;
  onDelete: () => void;
};

export default function UpdateSheet({ visible, item, onClose, onSave, onDelete }: Props) {
  const theme = useAppTheme();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const { mounted, progress } = useMountedTransition(visible, reducedMotion);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [targetQty, setTargetQty] = useState(1);
  const [temporary, setTemporary] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setPrice(item.price > 0 ? String(item.price) : '0');
      setTargetQty(item.targetQuantity || 1);
      setTemporary(item.isTemporary);
      setDeleteArmed(false);
    }
  }, [item?.id]);

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      price: parseFloat(price.replace(',', '.')) || 0,
      targetQuantity: Math.max(1, targetQty),
      isTemporary: temporary,
    });
  }

  function handleDeletePress() {
    if (deleteArmed) {
      onDelete();
    } else {
      setDeleteArmed(true);
    }
  }

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 24 }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flexFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, backdropStyle]} />
        </Pressable>
        <Animated.View style={[styles.sheetPositioner, sheetStyle]}>
        <Surface
          surfaceContext="overlay"
          style={[styles.sheet, { paddingBottom: Math.max(Spacing.xl, bottomInset + Spacing.md) }]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>{t.updateSheetTitle}</Text>

          <Text style={[styles.label, { color: theme.textMuted }]}>{t.varenavnLabel}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
            value={name}
            onChangeText={setName}
          />

          <Text style={[styles.label, { color: theme.textMuted }]}>{t.estimertPrisLabel}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surfaceMuted, color: theme.text }]}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
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

          <View style={styles.actionsRow}>
            <PressableScale style={styles.ghostBtn} onPress={onClose}>
              <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>{t.cancelBtn}</Text>
            </PressableScale>
            <PressableScale style={[styles.primaryBtn, { backgroundColor: theme.accent }]} onPress={handleSave}>
              <Text style={[styles.primaryBtnText, { color: theme.accentInk }]}>{t.saveBtn}</Text>
            </PressableScale>
          </View>

          <PressableScale
            style={[
              styles.deleteBtn,
              { backgroundColor: deleteArmed ? theme.bad : theme.badSoft },
            ]}
            onPress={handleDeletePress}
          >
            <Text style={[styles.deleteBtnText, { color: deleteArmed ? theme.textInverse : theme.bad }]}>
              {deleteArmed ? t.deleteConfirmText : t.deleteFromCatalogBtn}
            </Text>
          </PressableScale>
        </Surface>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  flexFill: { flex: 1 },
  sheetPositioner: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.sm },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold, marginBottom: Spacing.sm },
  label: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, marginTop: Spacing.sm, marginBottom: 4 },
  input: { borderRadius: Radius.sm, padding: Spacing.sm, fontSize: FontSize.md },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: { width: 34, height: 34, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: FontSize.lg, fontFamily: Fonts.bold, lineHeight: 22 },
  qtyText: { fontSize: FontSize.md, fontFamily: Fonts.bold, minWidth: 28, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  ghostBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  ghostBtnText: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  primaryBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  primaryBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
  deleteBtn: { marginTop: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md },
  deleteBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
