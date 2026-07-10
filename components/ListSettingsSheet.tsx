/**
 * ListSettingsSheet.tsx — per-list recurring toggle + active-weeks multi-select.
 *
 * Opened from WeekListCard's settings icon (Ukeliste tab). Lets the user
 * turn "repeat this list" on/off and, when on, pick which weeks (1–4) of the
 * monthly reset cycle the list is active on (multi-select, one or more) —
 * mirrors app/settings.tsx's weeklyResetDay chip-row look. The recurring toggle
 * applies via onSetRecurring (useShoppingListStore.setRecurring); the week chips
 * apply via onSetActiveWeeks (useShoppingListStore.setActiveWeeks). No
 * separate save step — same immediate-apply pattern as every other Switch in
 * app/settings.tsx.
 *
 * Connections:
 *   Imports → components/FormControls, components/PressableScale, components/Surface,
 *             constants/theme, lib/i18n, lib/useAppTheme,
 *             store/useShoppingListStore (ShoppingList type only)
 *   Used by → app/shopping.tsx (weekly list's recurring-toggle sheet)
 *   Data    → none directly — `list` and `onSetRecurring` are owned by the parent
 *
 * Edit notes:
 *   - Decision 008: the sheet is a glass Surface in `overlay` context. Blur comes from
 *     Surface's BlurView; this file never imports expo-blur directly.
 *   - Governs list settings, not shopping row layout — not entangled with Decision 011.
 *   - **Decision 044b (2026-07-09):** was a bare `<Modal animationType="slide">` gated by
 *     `if (!list) return null` — closing sets the parent's `listSettingsListId` to null in
 *     the same tick `visible` goes false, so `list` (a `.find()` result) goes undefined and
 *     the whole tree unmounted instantly, skipping RN's own native slide-out. Switched to
 *     `lib/useMountedTransition`; since this component's JSX reads `list.isRecurring`/
 *     `list.activeWeeks`/`list.recurrenceIntervalWeeks` directly (unlike UpdateSheet, which
 *     only reads its item through local state), it caches the last non-null `list` in
 *     `cachedList` so those reads stay valid while the exit animation plays.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { ShoppingList } from '@/store/useShoppingListStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles, useAccessibility } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import { useMountedTransition } from '@/lib/useMountedTransition';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import { Switch } from '@/components/FormControls';

const WEEK_OPTIONS = [1, 2, 3, 4];

type Props = {
  visible: boolean;
  list: ShoppingList | undefined;
  onClose: () => void;
  onSetRecurring: (isRecurring: boolean, intervalWeeks?: number) => void;
  /** Toggle which weeks (1–4) of the monthly cycle this list is active on; [] = every week. */
  onSetActiveWeeks: (weeks: number[]) => void;
};

export default function ListSettingsSheet({ visible, list, onClose, onSetRecurring, onSetActiveWeeks }: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const { mounted, progress } = useMountedTransition(visible, reducedMotion);

  // Decision 044b — `list` goes undefined the instant the parent closes this sheet
  // (a `.find()` result), but the exit animation needs valid fields to keep rendering
  // for another ~220ms, so cache the last non-null value.
  const [cachedList, setCachedList] = useState(list);
  useEffect(() => {
    if (list) setCachedList(list);
  }, [list]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 24 }],
  }));

  if (!mounted || !cachedList) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, backdropStyle]} />
      </Pressable>
      <Animated.View style={[styles.sheetPositioner, sheetStyle]}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]}>{t.listSettingsTitle}</Text>

        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: theme.text }]}>{t.listRecurringToggleLabel}</Text>
          <Switch
            checked={cachedList.isRecurring}
            onChange={(v) => onSetRecurring(v, cachedList.recurrenceIntervalWeeks)}
          />
        </View>

        {cachedList.isRecurring && (
          <View style={styles.intervalBlock}>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.listActiveWeeksLabel}</Text>
            <View style={styles.chipRow}>
              {WEEK_OPTIONS.map((n) => {
                const active = cachedList.activeWeeks.includes(n);
                return (
                  <PressableScale
                    key={n}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? theme.accent : theme.surfaceMuted },
                    ]}
                    onPress={() => {
                      const next = active
                        ? cachedList.activeWeeks.filter((w) => w !== n)
                        : [...cachedList.activeWeeks, n];
                      onSetActiveWeeks(next);
                    }}
                  >
                    <Text style={[styles.chipText, { color: active ? theme.accentInk : theme.text }]}>
                      {t.weekNumberChip(n)}
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
      </Animated.View>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  sheetPositioner: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
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
