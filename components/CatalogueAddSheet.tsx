/**
 * CatalogueAddSheet.tsx — the "new catalogue item" pop-up: a name, an optional price.
 *
 * Opened by the "+" beside the catalogue's search field (2026-08-14, maintainer: *"one search
 * box and the plus sign to the right. Pressing the plus sign shows a pop-up that gives user
 * option to enter Name and (optionally) price, save or discard."*). It replaced the inline
 * `components/AddRow.tsx` composer that used to sit as a third box in that screen's header —
 * the catalogue is a long alphabetized reference list, so a composer parked permanently above
 * it spent a full box on something used once in a while, and a new row never appears where the
 * composer is anyway (it lands under its own letter).
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/Button, components/Surface,
 *             components/FormControls (Input), constants/theme, lib/i18n, lib/useAppTheme
 *   Used by → components/CatalogueTab.tsx (both the /catalogue screen and Shopping's
 *             Catalogue drawer — the sheet is a Modal, so it works from inside the drawer too)
 *   Data    → none. It hands `{ name, price }` back through `onSave`; the caller owns the
 *             useCatalogStore write, its haptic and its toast.
 *
 * Edit notes:
 *   - **Name is the only required field**, matching the composers' tier-1 rule (AGENTS.md,
 *     "the hierarchy of settings when making a row"): committing on the name alone must always
 *     produce a valid row, so price defaults to 0 and carries an "Opt" tag rather than a
 *     validation error. Save is disabled while the name is blank — there is nothing to save,
 *     and a button that can act is better than one that reports a failure.
 *   - Fields are re-seeded to blank on each OPEN, not on every render, so the store's own
 *     notifications can't wipe half-typed text. Discard and a backdrop dismiss are the same
 *     path (`onClose`) — nothing is written until Save.
 *   - Price is parsed comma-tolerantly (`12,50` on a Norwegian keyboard), same as
 *     components/ShoppingItemSheet.tsx and components/InlineAddItem.tsx.
 *   - **Wrapped in a KeyboardAvoidingView** for the same reason ShoppingItemSheet is: RN's
 *     `<Modal>`, which AnimatedBottomSheet renders into, sits outside the screen's own
 *     keyboard-avoiding subtree, and this sheet is nothing but two fields and two buttons.
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import Button from '@/components/Button';
import Surface from '@/components/Surface';
import { Input } from '@/components/FormControls';
import { Fonts, FontSize, Radius, Spacing, MIN_TAP_TARGET } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Price is already parsed; 0 means "no price given". */
  onSave: (item: { name: string; price: number }) => void;
};

export default function CatalogueAddSheet({ visible, onClose, onSave }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  // Blank on every open — this sheet only ever creates, so there is no row to seed from, and
  // leaving the last attempt in the fields would make a second add look like an edit.
  useEffect(() => {
    if (!visible) return;
    setName('');
    setPrice('');
  }, [visible]);

  const canSave = name.trim().length > 0;

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, price: parseFloat(price.replace(',', '.')) || 0 });
    onClose();
  }

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flexFill}
      >
        <Surface surfaceContext="overlay" style={styles.sheet}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>{t.catalogueAddSheetTitle}</Text>

          <Input
            label={t.catalogueAddSheetName}
            value={name}
            onChangeText={setName}
            placeholder={t.catalogueItemNamePlaceholder}
            autoFocus
            style={styles.input}
          />
          <Input
            label={t.catalogueAddSheetPrice}
            optional
            value={price}
            onChangeText={setPrice}
            placeholder={t.catalogueItemPricePlaceholder}
            keyboardType="decimal-pad"
            onSubmitEditing={save}
            style={styles.input}
          />

          <View style={styles.actions}>
            <Button label={t.discard} onPress={onClose} variant="ghost" />
            <Button label={t.save} onPress={save} disabled={!canSave} style={styles.saveBtn} />
          </View>
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
  input: { minHeight: MIN_TAP_TARGET },
  // Discard sits left as a ghost, Save right as the one filled action. `flexWrap` + `rowGap`
  // is the wrap-audit's answer for a labelled button pair that can't shorten its words.
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.sm,
    rowGap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  saveBtn: { minWidth: 120 },
});
