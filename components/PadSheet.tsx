/**
 * PadSheet.tsx — the ruled sheet: rows sitting on notepad lines, plus spare lines to write on.
 *
 * The shared body of every list-bearing card (2026-07-30, user report: "look like notepads",
 * "related cards/things in other screens should look practically the same", "the feel of 1,
 * 2, 3, everything inside a card is connected and in orderly fashion feels like it's not
 * there"). One child per row; this component owns the hairline under each one, so no card
 * hand-rolls dividers any more and every list in the app is ruled identically.
 *
 * Rules span the pad's full writing area. They used to be inset 30px (ShoppingRow's old
 * `ROW_DIVIDER_INSET`) to clear a leading check column — the check moved to the right margin
 * in the same pass, so there is nothing left on the left to inset past, and a rule that
 * crosses the whole line is what actually reads as paper.
 *
 * Connections:
 *   Imports → constants/theme (PAD_ROW_HEIGHT, PAD_ROW_MIN_HEIGHT), components/Collapsible,
 *             lib/padState (PadState, padSpareLines), lib/useAppTheme
 *   Used by → components/{HomeNotesCard,HomeHabitsCard,HomeShoppingCard,PlanTaskCard}.tsx,
 *             app/(tabs)/{plans,habits,shopping}.tsx
 *   Data    → none (presentational; the caller slices rows via lib/padState's padVisibleRows)
 *
 * Edit notes:
 *   - **The caller slices, this draws.** Pass only the rows the current state actually shows
 *     (`padVisibleRows(rows, state)`); this component does not filter. That keeps the "what is
 *     visible" answer in one place — the same value a caller hands to lib/viewSnapshot for
 *     the what-was-hidden glow.
 *   - `typeRow` is pinned above the rows and drawn in EVERY state, including closed — it is
 *     the pad's first line, and losing it when you fold a card away would cost the fastest
 *     capture path in the app.
 *   - Rows animate open/shut through components/Collapsible (measured-height clip, no fade)
 *     so folding a card reads as "still there, just folded", matching the done zones. Do not
 *     swap in an opacity fade — see Collapsible's header for why.
 *   - Spare lines are inert — tapping empty paper does nothing, the type line is the way in.
 *     They exist so a short list still reads as a page rather than as a card that ran out.
 *     They used to each carry their own faint ghost-check ring (2026-07-30) — moved to a
 *     single occurrence on the type line instead (2026-07-31, user report: several identical
 *     ghost circles in a row read as noise; there's only one "next thing to check" and it
 *     belongs on the row actually being typed into). See `components/PadTypeRow.tsx`.
 *   - This draws the rules as child views INSIDE the card, never as border styles on a
 *     Surface's `style` — Surface silently drops every border/background key you pass it
 *     (see Surface.tsx's style-splitting contract).
 *   - **Boxed rows declined, 2026-08-04** (DESIGN_COMPARISON/10-boxed-vs-ruled-rows.md,
 *     DESIGN_RULES_AUDIT.md item 12): the design project's "every row its own bordered box"
 *     was reviewed and rejected — boxed rows are cards inside a card, which is exactly what
 *     PR #483 ("Habits: ruled rows on one sheet, not cards inside a card") moved away from a
 *     day earlier, and re-adopting it here would also mean converting `ShoppingRow` /
 *     `MonthlyTableRow` and `TaskCard` the *other* direction mid-conversion. Don't re-propose
 *     boxing without re-reading that file first.
 *     **The COMPOSER is boxed (2026-08-05) and that is not this decision.** `PadTypeRow`'s
 *     input is now a bordered, filled field with a focus border — but it is one CONTROL, the
 *     one you type into, not a row. Rows on this sheet are still flush and gap-free with
 *     nothing but a rule between them. The `typeLine` wrapper below is unchanged; the field's
 *     own vertical padding lives in PadTypeRow so this component never has to know that one
 *     of its lines hosts a bordered control.
 *   - **Rule colour fixed in the same review**: this component's own divider was drawing with
 *     `theme.border` (the ≥3:1 control-boundary token) since the day it was written — before
 *     `theme.rule` (a token built specifically for "decorative row divider, deliberately BELOW
 *     3:1", see constants/colors.ts) existed. `app/(tabs)/habits.tsx`'s hand-rolled divider
 *     already used `theme.rule` correctly (PR #483); this file was the one straggler still on
 *     `theme.border`, which is why the notepad rule under every Home card read closer to a
 *     hairline border than to faint ruled paper. Now uses `theme.rule` — no value changed, no
 *     new token, just wiring the shared component to the token that was already built for it.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Collapsible from '@/components/Collapsible';
import { PAD_ROW_HEIGHT, PAD_ROW_MIN_HEIGHT } from '@/constants/theme';
import { PadState, padSpareLines } from '@/lib/padState';
import { useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** Which of the three sizes to draw. Drives the rows' reveal and the spare-line count. */
  state: PadState;
  /**
   * The pad's first line — the always-open "Type note"/"Type task" field. Shown in every
   * state, including closed.
   */
  typeRow?: React.ReactNode;
  /**
   * One child per row, already sliced to what `state` shows (see padVisibleRows). A rule is
   * drawn under each.
   */
  children?: React.ReactNode;
  /**
   * Content below the rows and spare lines, inside the sheet but un-ruled — the done/checked
   * zone, a total, a pace line. Only drawn when `state === 'open'`.
   */
  footer?: React.ReactNode;
  /** Override the spare-line count (0 suppresses them). Defaults to padSpareLines(state). */
  spareLines?: number;
  style?: StyleProp<ViewStyle>;
};

export default function PadSheet({
  state,
  typeRow,
  children,
  footer,
  spareLines,
  style,
}: Props) {
  const theme = useAppTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  const spare = spareLines ?? padSpareLines(state);
  // theme.rule, not theme.border — see the 2026-08-04 header note. theme.border is the ≥3:1
  // control-boundary token; a notepad line is decorative and belongs on theme.rule instead.
  const rule = { backgroundColor: theme.rule };

  return (
    <View style={[styles.sheet, style]}>
      {typeRow ? (
        <>
          <View style={styles.typeLine}>{typeRow}</View>
          <View style={[styles.rule, rule]} />
        </>
      ) : null}

      {/* Clip-reveal rather than a mount/unmount pop, so folding a card away reads as the
          rows being covered edge-by-edge — the same motion as the done zones. */}
      <Collapsible open={state !== 'closed'}>
        {rows.map((row, i) => (
          <React.Fragment key={i}>
            <View style={styles.line}>{row}</View>
            <View style={[styles.rule, rule]} />
          </React.Fragment>
        ))}
        {Array.from({ length: spare }, (_, i) => (
          <React.Fragment key={`spare-${i}`}>
            <View style={styles.spare} />
            <View style={[styles.rule, rule]} />
          </React.Fragment>
        ))}
      </Collapsible>

      {state === 'open' && footer ? footer : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // No padding of its own: the card's own PAD_GUTTER already insets the sheet, and the rules
  // are meant to reach both edges of that gutter.
  sheet: { width: '100%' },
  // The always-open type line keeps the fuller rhythm (its own 44px minHeight, PadTypeRow) —
  // this wrapper just needs to not clip it short.
  typeLine: { minHeight: PAD_ROW_MIN_HEIGHT, justifyContent: 'center' },
  // Real rows and the blank lines after them share the shorter, compressed rhythm
  // (2026-07-30, user report — see PAD_ROW_HEIGHT's own comment in constants/theme.ts).
  line: { minHeight: PAD_ROW_HEIGHT, justifyContent: 'center' },
  // Blank paper. Inert on purpose (see the header) — the type line is the way to add a row.
  // No ghost check here any more (2026-07-31) — that preview lives on the type line now, once,
  // instead of repeating identically on every spare line below it (see PadTypeRow.tsx).
  spare: { height: PAD_ROW_HEIGHT },
  // Spans the pad's whole writing area (gutter edge to gutter edge) but deliberately does NOT
  // bleed to the card's outer edge: the accent rim is the binding, and a rule running into it
  // is exactly the "text/lines too close to a border" complaint this pass is fixing.
  rule: { height: StyleSheet.hairlineWidth },
});
