/**
 * PadRow.tsx — one line of a pad, and the app's row anatomy.
 *
 * The single row shell every list-bearing surface draws through (2026-07-30). Anatomy, left
 * to right:
 *
 *     [leading?]  title            [right value] [⋯ action] [○ check]
 *                 ⟨one meta line⟩
 *
 * **The check is on the RIGHT** as of this pass (maintainer's call, applied app-wide — see
 * AGENTS.md's row rule). It used to lead every row. On a paper checklist the ticks live in the
 * right margin, and moving them there is also what let the notepad rules run the whole line
 * instead of being inset past a check column (ShoppingRow's retired `ROW_DIVIDER_INSET`).
 *
 * The ⋯ action sits immediately inside the check: one row-level "do something with this"
 * button, replacing the assorted per-surface trailing trash/send/put-back buttons.
 *
 * Connections:
 *   Imports → components/PressableScale, constants/theme (PAD_ROW_MIN_HEIGHT,
 *             DONE_ROW_OPACITY, FontSize, Fonts, Radius, Spacing, TabularNums),
 *             lib/i18n, lib/useAppTheme, @expo/vector-icons
 *   Used by → components/{HomeNotesCard,HomeHabitsCard,HomeShoppingCard,PlanTaskCard}.tsx,
 *             app/(tabs)/{plans,habits,shopping}.tsx
 *   Data    → none (presentational; every callback is the caller's)
 *
 * Edit notes:
 *   - **One meta line, one right-hand value.** That cap is the row rule and the reason a row
 *     stays readable at 360px in Norwegian. If a surface wants to show a fifth thing, it goes
 *     on the meta line or into the detail sheet — not into a third row line.
 *   - `hasMetaLine` **must mirror the JSX gate exactly** (the trap TaskCard documents): if the
 *     boolean and the render condition drift, a row with exactly one meta item silently loses
 *     its line.
 *   - `rightValue` carries `TabularNums` so a column of times/prices/counts lines up row to
 *     row. Pass the value only — never a whole node with its own layout.
 *   - `done` strikes AND fades the WHOLE row (`DONE_ROW_OPACITY`), not just the title: the
 *     shared finished-row treatment, so a ticked note, task, shopping item and completed habit
 *     all look the same. The row stays in place; whether and when it moves is the surface's
 *     own logic (notes move the next day, shopping/to-do keep their existing zones, a habit
 *     only strikes once the day's full count is met).
 *   - Check is visually 22×22 with `hitSlop={13}` → ~48dp, Android's minimum touch target.
 *     Don't shrink the hitSlop to "tidy up" the trailing cluster.
 *   - `leading` is for an icon or a quantity — never a second check. StarterExampleRow's own
 *     leading circle is an icon and stays where it is, so an example still reads as a row of
 *     the list it sits in.
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import {
  DONE_ROW_OPACITY,
  FontSize,
  Fonts,
  PAD_ROW_MIN_HEIGHT,
  Radius,
  Spacing,
  TabularNums,
} from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  title: string;
  /** The domain accent this row belongs to (lib/domainColor). Tints the check and the ⋯. */
  accent: string;
  /** Struck through + faded. The row does NOT move — that's the surface's own logic. */
  done?: boolean;
  /** Optional icon or quantity before the title. Never a second check. */
  leading?: React.ReactNode;
  /** The ONE secondary line. Omit for a single-line row. */
  meta?: React.ReactNode;
  /** The ONE right-hand value — a time, a price, a count. Rendered in tabular figures. */
  rightValue?: string;
  /** Tap the title/body block (opens the editor, the detail sheet, …). */
  onPress?: () => void;
  /** The ⋯ button. Omitted entirely when not passed. */
  onAction?: () => void;
  actionLabel?: string;
  /** The check circle. Omitted entirely when not passed (e.g. a habit with a −/+ counter). */
  onToggle?: () => void;
  toggleLabel?: string;
  /**
   * Replaces the check circle with the caller's own trailing control — the habits −/+ pair,
   * where a `dailyGoal > 1` means a single tap can't mean "done".
   */
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function PadRow({
  title,
  accent,
  done,
  leading,
  meta,
  rightValue,
  onPress,
  onAction,
  actionLabel,
  onToggle,
  toggleLabel,
  trailing,
  style,
}: Props) {
  const theme = useAppTheme();
  const t = useT();

  // Mirrors the JSX gate below exactly — see the edit note.
  const hasMetaLine = meta !== undefined && meta !== null && meta !== false;

  const body = (
    <View style={styles.body}>
      <Text
        style={[
          styles.title,
          { color: done ? theme.textMuted : theme.text },
          done && styles.titleDone,
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {hasMetaLine ? <View style={styles.metaLine}>{meta}</View> : null}
    </View>
  );

  return (
    <View style={[styles.row, done && styles.rowDone, style]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}

      {onPress ? (
        <PressableScale style={styles.bodyPressable} onPress={onPress} scaleTo={0.99}>
          {body}
        </PressableScale>
      ) : (
        body
      )}

      {rightValue ? (
        <Text style={[styles.rightValue, { color: theme.textMuted }]} numberOfLines={1}>
          {rightValue}
        </Text>
      ) : null}

      {onAction ? (
        <PressableScale
          style={styles.action}
          onPress={onAction}
          hitSlop={10}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel={actionLabel ?? t.padRow.actionLabel}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={theme.textMuted} />
        </PressableScale>
      ) : null}

      {trailing ??
        (onToggle ? (
          <PressableScale
            style={[
              styles.check,
              { borderColor: accent },
              done && { backgroundColor: accent },
            ]}
            onPress={onToggle}
            hitSlop={13}
            scaleTo={0.9}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!done }}
            accessibilityLabel={toggleLabel ?? title}
          >
            {done ? <Ionicons name="checkmark" size={12} color={theme.accentInk} /> : null}
          </PressableScale>
        ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: PAD_ROW_MIN_HEIGHT,
  },
  // Fades the whole row, not just the title — the shared finished-row look (see header).
  rowDone: { opacity: DONE_ROW_OPACITY },
  leading: { justifyContent: 'center' },
  // minWidth:0 lets the title actually shrink instead of pushing the trailing cluster off the
  // card — react-native-web gives a flex child an intrinsic minimum without it.
  bodyPressable: { flex: 1, minWidth: 0 },
  body: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  titleDone: { textDecorationLine: 'line-through' },
  // Never wraps: one line, and whatever doesn't fit is the surface's problem to trim.
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rightValue: { fontSize: FontSize.sm, fontFamily: Fonts.semibold, ...TabularNums },
  action: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
