/**
 * ListSettingsSheet.tsx — per-list recurring toggle + interval picker.
 *
 * Opened from WeekListCard's settings icon (Ukeliste tab). Lets the user
 * turn "repeat this list" on/off and, when on, pick the cadence (1-4 weeks) —
 * mirrors app/settings.tsx's weeklyResetDay chip-row look. Changes apply
 * immediately via onSetRecurring (useShoppingListStore.setRecurring), no
 * separate save step — same immediate-apply pattern as every other Switch in
 * app/settings.tsx.
 *
 * Connections:
 *   Imports → components/FormControls, components/PressableScale, components/Surface,
 *             constants/theme, lib/i18n, lib/useAppTheme,
 *             store/useShoppingListStore (ShoppingList type only)
 *   Used by → (not yet mounted — Phase 5 screen: app/shopping.tsx)
 *   Data    → none directly — `list` and `onSetRecurring` are owned by the parent
 *
 * Edit notes:
 *   - Decision 008: the sheet is a glass Surface in `overlay` context. Blur comes from
 *     Surface's BlurView; this file never imports expo-blur directly.
 *   - Governs list settings, not shopping row layout — not entangled with Decision 011.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ShoppingList } from '@/store/useShoppingListStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { Switch } from '@/components/FormControls';

const INTERVAL_OPTIONS = [1, 2, 3, 4];

type Props = {
  visible: boolean;
  list: ShoppingList | undefined;
  onClose: () => void;
  onSetRecurring: (isRecurring: boolean, intervalWeeks?: number) => void;
};

export default function ListSettingsSheet({ visible, list, onClose, onSetRecurring }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  if (!list) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]}>{t.listSettingsTitle}</Text>

        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: theme.text }]}>{t.listRecurringToggleLabel}</Text>
          <Switch
            checked={list.isRecurring}
            onChange={(v) => onSetRecurring(v, list.recurrenceIntervalWeeks)}
          />
        </View>

        {list.isRecurring && (
          <View style={styles.intervalBlock}>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.listRecurringIntervalLabel}</Text>
            <View style={styles.chipRow}>
              {INTERVAL_OPTIONS.map((n) => {
                const active = list.recurrenceIntervalWeeks === n;
                return (
                  <PressableScale
                    key={n}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? theme.accent : theme.surfaceMuted },
                    ]}
                    onPress={() => onSetRecurring(true, n)}
                  >
                    <Text style={[styles.chipText, { color: active ? theme.accentInk : theme.text }]}>
                      {t.listRecurringWeeksOption(n)}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        )}

        <PressableScale style={[styles.doneBtn, { backgroundColor: theme.accent }]} onPress={onClose}>
          <Text style={[styles.doneBtnText, { color: theme.accentInk }]}>{t.save}</Text>
        </PressableScale>
      </Surface>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: FontSize.md, fontFamily: Fonts.medium },
  intervalBlock: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  chipRow: { flexDirection: 'row', gap: Spacing.xs },
  chip: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full, paddingHorizontal: Spacing.xs },
  chipText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  doneBtn: { borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  doneBtnText: { fontFamily: Fonts.bold, fontSize: FontSize.md },
});
