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
 *   - Spare lines are inert `View`s at PAD_ROW_MIN_HEIGHT, not pressables: tapping empty
 *     paper does nothing, the type line is the way in. They exist so a short list still
 *     reads as a page rather than as a card that ran out.
 *   - This draws the rules as child views INSIDE the card, never as border styles on a
 *     Surface's `style` — Surface silently drops every border/background key you pass it
 *     (see Surface.tsx's style-splitting contract).
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
  const rule = { backgroundColor: theme.border };

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
  spare: { height: PAD_ROW_HEIGHT },
  // Spans the pad's whole writing area (gutter edge to gutter edge) but deliberately does NOT
  // bleed to the card's outer edge: the accent rim is the binding, and a rule running into it
  // is exactly the "text/lines too close to a border" complaint this pass is fixing.
  rule: { height: StyleSheet.hairlineWidth },
});
