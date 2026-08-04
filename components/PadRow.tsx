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
 *   Imports → components/PressableScale, constants/theme (PAD_ROW_HEIGHT,
 *             DONE_ROW_OPACITY, FontSize, Fonts, Radius, Spacing, TabularNums, contrastOn),
 *             lib/i18n, lib/useAppTheme, @expo/vector-icons
 *   Used by → components/{HomeNotesCard,HomeHabitsCard,HomeShoppingCard,PlanTaskCard}.tsx
 *             (the four HOME cards), and app/(tabs)/habits.tsx (2026-08-01).
 *             **This line used to also claim app/(tabs)/{plans,shopping}.tsx and it was never
 *             true** — an audit (AUDIT.md §0.4.2e) found this file imported by the Home cards
 *             and by NO tab screen at all, which inverted a whole planned task (B2-3 was
 *             written to convert Home to match the tabs; the tabs were what had drifted).
 *             `plans.tsx` reaches this only indirectly, by mounting PlanTaskCard in the
 *             timeline layout. **components/NoteRow.tsx joined on 2026-08-01** (the notes
 *             screen's own rows, via `titleInput` — see below); `shopping.tsx` still
 *             hand-rolls ShoppingRow / MonthlyTableRow and is the one remaining conversion.
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
 *   - **The action and the check live in their own cluster with their own gap** (`RowTrailing`
 *     in constants/theme.ts), not the row's. Until 2026-08-01 they sat `Spacing.sm` apart with
 *     symmetric slops that overlapped by 15px, and because RN hit-tests siblings in reverse
 *     order the check won — the right edge of the visible ⋯ fired "complete". The slops are now
 *     asymmetric (clipped on the shared side) and the gap is sized to leave 8px belonging to
 *     neither control. Don't swap them back to a symmetric `HitSlop.*` token to tidy this up,
 *     and don't shrink the gap: either one restores the misfire.
 *   - **`titleInput` is for a row that edits itself in place**, and only that: components/
 *     NoteRow.tsx, where the header field IS the note. It swaps the title Text for the
 *     caller's TextInput and changes nothing else, so a screen full of editable rows still
 *     has the same anatomy, gutters and trailing cluster as a screen of read-only ones.
 *     Match `styles.title` (FontSize.md / Fonts.semibold) in the input you pass, and keep
 *     the `done` strike on it — the rest of the finished-row treatment comes from the row.
 *   - `leading` is for an icon or a quantity — never a second check. StarterExampleRow's own
 *     leading circle is an icon and stays where it is, so an example still reads as a row of
 *     the list it sits in.
 *   - **The check ring is NEUTRAL when empty and hued only when ticked** (2026-08-04,
 *     DESIGN_COMPARISON/11, DESIGN_RULES_AUDIT.md item 13). It used to take `accent` in both
 *     states, which put a control boundary on a token never tuned to be one: an empty ring on
 *     the shopping/meal gold (`#D9A441`) measured **2.249:1 on surface / 1.855:1 on bg**,
 *     under WCAG 1.4.11's 3:1 floor for a control boundary. The other three identity hues
 *     pass (todo 6.806, habits 5.410, health 5.507), so this read as fine on every screen
 *     except the app's highest-volume checkbox surface. Empty now uses `theme.border`
 *     (3.792/3.128, the token contrast-tuned for exactly this job); the hue arrives on the
 *     tick, as a FILL, which is what A.4 rule 1 says an identity hue is for.
 *   - **The ticked glyph takes `contrastOn(accent)`, not `theme.accentInk`.** `accentInk` is
 *     the ink for `theme.accent` (the app accent) — on a domain fill it was the wrong ink
 *     entirely, and on gold it was the same 2.249:1 failure moved from the ring to the
 *     checkmark. `contrastOn(accent)` is how `lib/domainColor.ts` derives its own `ink`, so
 *     the glyph now matches the badge's contract and `colors.test.ts`'s ≥3:1 assertion.
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/PressableScale';
import {
  DONE_ROW_OPACITY,
  FontSize,
  Fonts,
  PAD_ROW_HEIGHT,
  Radius,
  RowTrailing,
  Spacing,
  TabularNums,
  contrastOn,
} from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  title: string;
  /**
   * The domain accent this row belongs to (lib/domainColor). Fills the check once it is
   * TICKED — an empty ring stays on `theme.border`, see the header note. Never a ring colour
   * in the empty state: the identity hues are not tuned as control boundaries.
   */
  accent: string;
  /** Struck through + faded. The row does NOT move — that's the surface's own logic. */
  done?: boolean;
  /** Optional icon or quantity before the title. Never a second check. */
  leading?: React.ReactNode;
  /**
   * An editable title, for a row that IS its own editor (app/notes.tsx, where typing the
   * header is the whole point of the screen). Replaces the rendered `title` Text and takes
   * its place in the layout exactly — `title` is still required and still carries the row's
   * accessible name. Pass a bare TextInput styled by the caller; everything else about the
   * row is unchanged, including `done` striking and fading it.
   *
   * Not a general escape hatch: the anatomy is still one title line, one meta line, one
   * right-hand value. A surface that wants a *different shape* of title wants a different row.
   */
  titleInput?: React.ReactNode;
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
  titleInput,
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
  // Same discipline for the cluster: an empty wrapper would still draw the row's own gap,
  // padding the right edge of every row that has neither an action nor a check.
  const hasTrailingCluster = !!onAction || !!trailing || !!onToggle;

  const body = (
    <View style={styles.body}>
      {titleInput ?? (
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
      )}
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

      {hasTrailingCluster ? (
        <View style={styles.trailingCluster}>
          {onAction ? (
            <PressableScale
              style={styles.action}
              onPress={onAction}
              hitSlop={RowTrailing.actionSlop}
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
                  // Neutral while empty, hue only on the tick — see the header note. An empty
                  // ring is a control boundary and belongs on the contrast-tuned token.
                  { borderColor: done ? accent : theme.border },
                  done && { backgroundColor: accent },
                ]}
                onPress={onToggle}
                hitSlop={RowTrailing.checkSlop}
                scaleTo={0.9}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!done }}
                accessibilityLabel={toggleLabel ?? title}
              >
                {done ? <Ionicons name="checkmark" size={12} color={contrastOn(accent)} /> : null}
              </PressableScale>
            ) : null)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: PAD_ROW_HEIGHT,
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
  // The action and the check are the app's only side-by-side pair of independent targets,
  // so they get their own gap rather than the row's — see RowTrailing in constants/theme.ts.
  trailingCluster: { flexDirection: 'row', alignItems: 'center', gap: RowTrailing.gap },
  action: {
    width: RowTrailing.actionSize,
    height: RowTrailing.actionSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: RowTrailing.checkSize,
    height: RowTrailing.checkSize,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
