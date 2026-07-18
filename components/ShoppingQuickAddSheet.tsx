/**
 * ShoppingQuickAddSheet.tsx — bottom-sheet for quickly adding a shopping item without leaving the screen.
 *
 * Same Modal/backdrop/KeyboardAvoidingView/sheet shape as components/QuickAddSheet.tsx
 * (the home screen's quick-add-task sheet), stripped to a single item-name field —
 * this is the "seamless" path from app/notes.tsx's shopping button: tap, type, save,
 * back to the note, no navigation away from the screen that opened it.
 *
 * Connections:
 *   Imports → components/ConfirmationBanner, components/Surface, constants/theme,
 *             lib/date, lib/i18n, lib/useAppTheme, store/useShoppingListStore,
 *             store/useShoppingStore, react-native-safe-area-context
 *   Used by → (not yet mounted — Phase 5 screen: app/notes.tsx)
 *   Data    → calls useShoppingStore.add() (Phase 5 stub per Decision 015) to insert an
 *             item into the current week's list (useShoppingListStore.currentList(),
 *             also a Phase 5 stub); scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - Item lands directly in the active weekly list (status 'inWeeklyList'), same as
 *     adding from app/shopping.tsx — amount defaults to '1', no store/price/category set.
 *   - State resets each time the sheet becomes visible, mirroring QuickAddSheet.tsx.
 *   - save() shows a ConfirmationBanner and delays onClose() by 300ms so there's always
 *     positive proof the item was added, even though the sheet closes back into Notes.
 *   - Decision 011 (A2-5): this sheet is a faithful port, not a redesign target for the
 *     shopping-screen readability work — layout/fields unchanged from old source.
 *   - Decision 008: the sheet is a glass Surface in `overlay` context. Blur comes from
 *     Surface's BlurView; this file never imports expo-blur directly.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShoppingStore } from '@/store/useShoppingStore';
import { useShoppingListStore } from '@/store/useShoppingListStore';
import { useT } from '@/lib/i18n';
import { todayStr } from '@/lib/date';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import ConfirmationBanner from '@/components/ConfirmationBanner';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ShoppingQuickAddSheet({ visible, onClose }: Props) {
  const addItem = useShoppingStore((s) => s.add);
  const currentList = useShoppingListStore((s) => s.currentList);
  const theme = useAppTheme();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const t = useT();
  const styles = useScaledStyles(baseStyles);

  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setConfirm(null);
    }
  }, [visible]);

  // Clear the pending onClose() if the sheet unmounts before the 300ms delay elapses.
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    addItem({
      name: trimmed,
      amount: '1',
      unit: '',
      listType: 'weekly',
      store: '',
      price: 0,
      inventoryQty: 0,
      status: 'inWeeklyList',
      listId: currentList(todayStr())?.id,
    });
    setConfirm(t.itemAddedToList(trimmed));
    // Let the confirmation land before the sheet closes — mirrors QuickAddSheet.tsx.
    closeTimerRef.current = setTimeout(onClose, 300);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kvWrapper}
      >
        <Surface
          surfaceContext="overlay"
          style={[styles.sheet, { paddingBottom: Math.max(Spacing.xl, bottomInset + Spacing.md) }]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <Text style={[styles.title, { color: theme.text }]}>{t.notes.shoppingQuickAddTitle}</Text>

          <TextInput
            style={[styles.nameInput, { color: theme.text, borderBottomColor: theme.border }]}
            placeholder={t.shoppingItemPlaceholder}
            placeholderTextColor={theme.textMuted}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            onSubmitEditing={save}
          />

          <PressableScale
            style={[
              styles.saveBtn,
              { backgroundColor: theme.accent },
              (!name.trim() || !!confirm) && styles.saveBtnDisabled,
            ]}
            onPress={save}
            disabled={!name.trim() || !!confirm}
            scaleTo={0.95}
          >
            <Text style={[styles.saveBtnText, { color: theme.accentInk }]}>{t.save}</Text>
          </PressableScale>
        </Surface>
      </KeyboardAvoidingView>

      <ConfirmationBanner message={confirm} onDismiss={() => setConfirm(null)} />
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  kvWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
  },
  nameInput: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.medium,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  saveBtn: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
