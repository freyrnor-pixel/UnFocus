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
 *   Imports → components/AnimatedBottomSheet, components/FormControls,
 *             components/PressableScale, components/Surface, constants/theme, lib/i18n,
 *             lib/useAppTheme, store/useShoppingStore (type only)
 *   Used by → app/(tabs)/shopping.tsx (Monthly catalog row edit)
 *   Data    → none directly — all mutations flow out via onSave/onDelete callbacks; the
 *             parent calls useShoppingStore.update()/removeWithSource() (Phase 5)
 *
 * Edit notes:
 *   - visible/item are controlled by the parent; internal field state resets via the useEffect keyed on item.id whenever a different item opens.
 *   - deleteArmed is local state for the inline "Er du sikker?" confirm step — resets whenever the sheet closes or a different item opens.
 *   - Wrapped in a KeyboardAvoidingView because RN's <Modal> renders outside the
 *     screen's own KeyboardAvoidingView subtree — without this, the keyboard covers
 *     the name input on short screens. Now nested inside AnimatedBottomSheet's children
 *     slot (that component owns the Modal itself) rather than wrapping a raw `<Modal>`.
 *   - **Decision 044b (2026-07-09):** shell moved to components/AnimatedBottomSheet.tsx
 *     for a real timed exit animation (see that component's header, and
 *     ListSettingsSheet.tsx's header for the same fix). `lastItem` caches the last
 *     non-null `item` prop so the sheet still has content to render while it plays the
 *     exit animation after the parent nulls `item` on close — separate from the
 *     `item.id`-keyed field-reset effect below, which still reads `item` directly.
 *   - Decision 008: the sheet is a glass Surface in `overlay` context. Blur comes from
 *     Surface's BlurView; this file never imports expo-blur directly.
 *   - **The quantity stepper's "+" is muted, not accent (2026-08-01, addendum B.1)** — it
 *     matches its own "−" now, and the sheet's one accent fill is the primary "Save" button.
 *     Keep it in step with components/Stepper.tsx (read its edit note first) and the other
 *     hand-rolled copies in MonthlyTableRow / InlineAddItem / MonthlyResetReviewSheet.
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingItem } from '@/store/useShoppingStore';
import { Fonts, FontSize, glassKey, HitSlop, Radius, Spacing, OpticalCenter } from '@/constants/theme';
import { useAppTheme, useIsDark, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import { Input, Switch } from '@/components/FormControls';

type Props = {
  visible: boolean;
  item: ShoppingItem | null;
  onClose: () => void;
  onSave: (patch: { name: string; price: number; targetQuantity: number; isTemporary: boolean }) => void;
  onDelete: () => void;
};

export default function UpdateSheet({ visible, item, onClose, onSave, onDelete }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [targetQty, setTargetQty] = useState(1);
  const [temporary, setTemporary] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);

  // Decision 044b: `item` goes null in the same update that flips `visible` false (the
  // parent nulls its "which item" state on close) — cache the last non-null value so the
  // sheet still has content to render while AnimatedBottomSheet plays its exit animation.
  const [lastItem, setLastItem] = useState(item);
  useEffect(() => {
    if (item) setLastItem(item);
  }, [item]);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setPrice(item.price > 0 ? String(item.price) : '0');
      setTargetQty(item.targetQuantity || 1);
      setTemporary(item.isTemporary);
      setDeleteArmed(false);
    }
  // Deliberately depends on item's id, not `item` itself, so this only re-syncs form fields
  // when the identity actually changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (!lastItem) return null;

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flexFill}>
        <Surface
          surfaceContext="overlay"
          style={[styles.sheet, { paddingBottom: Math.max(Spacing.xl, bottomInset + Spacing.md) }]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>{t.updateSheetTitle}</Text>

          {/* ⚠️ **The shared `Input` (2026-08-21, CONSISTENCY_AUDIT.md §1).** These were the only
              fields in the app with NO BORDER AT ALL — a `surfaceMuted` fill and nothing else —
              which on the opaque overlay this sheet paints is a boundary the WCAG 1.4.11 rule
              for a control requires and this had dropped. `Input` also owns the label, so the
              `<Text>` above each one goes with it: a label that is a sibling of its field rather
              than part of it is how the two drift. */}
          <Input label={t.varenavnLabel} value={name} onChangeText={setName} />

          <Input
            label={t.estimertPrisLabel}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.label, { color: theme.textMuted }]}>{t.onsketAntallLabel}</Text>
          <View style={styles.stepperRow}>
            <PressableScale
              style={[styles.stepBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
              onPress={() => setTargetQty((q) => Math.max(1, q - 1))}
              hitSlop={HitSlop.snug}
              scaleTo={0.90}
            >
              <Text style={[styles.stepText, { color: theme.text }]}>−</Text>
            </PressableScale>
            <Text style={[styles.qtyText, { color: theme.text }]}>{targetQty}</Text>
            <PressableScale
              style={[styles.stepBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
              onPress={() => setTargetQty((q) => q + 1)}
              hitSlop={HitSlop.snug}
              scaleTo={0.90}
            >
              <Text style={[styles.stepText, { color: theme.text }]}>+</Text>
            </PressableScale>
          </View>

          <View style={styles.toggleRow}>
            <Text style={[styles.label, { color: theme.textMuted, marginBottom: 0 }]}>{t.midlertidigToggleLabel}</Text>
            <Switch checked={temporary} onChange={setTemporary} />
          </View>

          <View style={styles.actionsRow}>
            <PressableScale style={styles.ghostBtn} onPress={onClose} scaleTo={0.97}>
              <Text style={[styles.ghostBtnText, { color: theme.textMuted }]}>{t.cancelBtn}</Text>
            </PressableScale>
            <PressableScale style={[styles.primaryBtn, glassKey(theme.accent, isDark)]} onPress={handleSave} scaleTo={0.95}>
              <Text style={[styles.primaryBtnText, { color: theme.text }]}>{t.saveBtn}</Text>
            </PressableScale>
          </View>

          <PressableScale
            style={[
              styles.deleteBtn,
              { backgroundColor: deleteArmed ? theme.bad : theme.badSoft },
            ]}
            onPress={handleDeletePress}
            scaleTo={0.93}
          >
            <Text style={[styles.deleteBtnText, { color: deleteArmed ? theme.textInverse : theme.bad }]}>
              {deleteArmed ? t.deleteConfirmText : t.deleteFromCatalogBtn}
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
    left: 0, right: 0, bottom: 0,
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
  // `input` is DELETED (2026-08-21) — components/FormControls.tsx's `Input` draws the two text
  // fields. `label` survives: the quantity stepper below still needs one, and it is not a field.
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // Both halves muted + bordered — see components/Stepper.tsx's edit note (addendum B.1,
  // 2026-08-01): a stepper is a paired control, so filling only the "+" in the app's action
  // colour made an increment button compete with this sheet's own primary button.
  stepBtn: { width: 34, height: 34, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // `OpticalCenter` (2026-08-21): a Text whose box height is pinned by the circle around it,
  // which is the condition Android's asymmetric font padding breaks. Guarded by
  // lib/__tests__/designTokens.test.ts.
  stepText: { fontSize: FontSize.lg, fontFamily: Fonts.bold, lineHeight: 22, ...OpticalCenter },
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
