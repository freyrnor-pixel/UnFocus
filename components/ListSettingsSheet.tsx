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
 *   Imports → components/AnimatedBottomSheet, components/FormControls,
 *             components/PressableScale, components/Surface, constants/theme, lib/i18n,
 *             lib/useAppTheme, store/useShoppingListStore (ShoppingList type only)
 *   Used by → app/(tabs)/shopping.tsx (weekly list's recurring-toggle sheet)
 *   Data    → none directly — `list` and `onSetRecurring` are owned by the parent
 *
 * Edit notes:
 *   - Decision 008: the sheet is a glass Surface in `overlay` context. Blur comes from
 *     Surface's BlurView; this file never imports expo-blur directly.
 *   - Governs list settings, not shopping row layout — not entangled with Decision 011.
 *   - **Decision 044b (2026-07-09):** shell moved to components/AnimatedBottomSheet.tsx
 *     (real timed exit animation, not just an open one — see that component's header).
 *     `lastList` caches the last non-null `list` prop so the sheet still has content to
 *     render while it plays its exit animation after the parent nulls `list` on close.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ShoppingList } from '@/store/useShoppingListStore';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
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

  // Decision 044b: `list` goes null in the same update that flips `visible` false (the
  // parent nulls its "which list" state on close), which would otherwise blank the sheet
  // out from under AnimatedBottomSheet's exit animation. Cache the last real value so the
  // closing sheet still has content to show while it animates out.
  const [lastList, setLastList] = useState(list);
  useEffect(() => {
    if (list) setLastList(list);
  }, [list]);

  if (!lastList) return null;

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <Text style={[styles.title, { color: theme.text }]}>{t.listSettingsTitle}</Text>

        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: theme.text }]}>{t.listRecurringToggleLabel}</Text>
          <Switch
            checked={lastList.isRecurring}
            onChange={(v) => onSetRecurring(v, lastList.recurrenceIntervalWeeks)}
          />
        </View>

        {lastList.isRecurring && (
          <View style={styles.intervalBlock}>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t.listActiveWeeksLabel}</Text>
            <View style={styles.chipRow}>
              {WEEK_OPTIONS.map((n) => {
                const active = lastList.activeWeeks.includes(n);
                return (
                  <PressableScale
                    key={n}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? theme.accent : theme.surfaceMuted },
                    ]}
                    onPress={() => {
                      const next = active
                        ? lastList.activeWeeks.filter((w) => w !== n)
                        : [...lastList.activeWeeks, n];
                      onSetActiveWeeks(next);
                    }}
                    scaleTo={0.97}
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

        <PressableScale style={[styles.doneBtn, { backgroundColor: theme.accent }]} onPress={onClose} scaleTo={0.95}>
          <Text style={[styles.doneBtnText, { color: theme.accentInk }]}>{t.save}</Text>
        </PressableScale>
      </Surface>
    </AnimatedBottomSheet>
  );
}

const baseStyles = StyleSheet.create({
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
