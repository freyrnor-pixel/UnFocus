/**
 * PadSheet.tsx — the shared body of every list-bearing card: one bordered box per row.
 *
 * **Boxed rows, 2026-08-05 (card design reset, maintainer brief points 3 + 9: "no lines, just
 * rows for user to type in", "borders around cards, buttons, text-boxes, options and so on for
 * separating them").** Each row is its own bordered rectangle in the screen's hue family,
 * stacked with a hairline-thin gap so two adjacent borders never double into a fat line. There
 * are no ruled notepad lines and no blank spare lines.
 *
 * **This deliberately reverses two earlier decisions, and both were re-put to the maintainer
 * before it was written** — don't revert either by citing its original file:
 *   - `DESIGN_COMPARISON/10-boxed-vs-ruled-rows.md` + `DESIGN_RULES_AUDIT.md` item 12
 *     (2026-08-04) rejected boxed rows as "cards inside a card". The counter-argument then was
 *     PR #483, which had moved Habits the other way a day earlier. What changed is that a card
 *     is no longer a glass pane with a beveled rim — it is a flat white page with one thin
 *     border (see components/Surface.tsx), so a bordered row inside it no longer reads as a
 *     second card competing with the first. The "cards inside a card" objection was about the
 *     old material, and the old material is gone.
 *   - The 2026-07-30 notepad pass drew full-width rules on every list card, which is
 *     `DESIGN_RULES.md`'s open conflict #8. That conflict is now **resolved in favour of rule
 *     5** ("whitespace over lines") rather than against it: the rules are gone. The notepad
 *     feel the maintainer asked for is carried by the card's own shape and white page, not by
 *     printed lines.
 *
 * Spare lines are gone with them. They existed so a short list still read as a page rather than
 * as a card that ran out; a page of empty *boxes* reads as broken UI rather than as blank paper,
 * so the mechanism doesn't survive the change of shape. `padSpareLines` is still exported from
 * lib/padState for its tests, but this component no longer calls it.
 *
 * Connections:
 *   Imports → constants/theme (computeBorderTone, PAD_ROW_HEIGHT,
 *             PAD_ROW_MIN_HEIGHT, Radius, Spacing), components/Collapsible, lib/padState
 *             (PadState), lib/screenColor (useScreenColor), lib/useAppTheme,
 *             lib/useDesignLab (useLabControl, useLabShape — the `rowShape` knob below)
 *   Used by → components/{HomeNotesCard,HomeHabitsCard,HomeShoppingCard,PlanTaskCard}.tsx,
 *             app/(tabs)/{plans,habits,shopping}.tsx
 *   Data    → none (presentational; the caller slices rows via lib/padState's padVisibleRows)
 *
 * Edit notes:
 *   - **The caller slices, this draws.** Pass only the rows the current state actually shows
 *     (`padVisibleRows(rows, state)`); this component does not filter. That keeps the "what is
 *     visible" answer in one place — the same value a caller hands to lib/viewSnapshot for the
 *     what-was-hidden glow.
 *   - `typeRow` is pinned above the rows and drawn in EVERY state, including closed — it is the
 *     pad's first line, and losing it when you fold a card away would cost the fastest capture
 *     path in the app. It gets NO box of its own: `components/PadTypeRow.tsx` already draws a
 *     bordered field, and wrapping a bordered field in a bordered box is the doubled-border
 *     mistake this whole pass exists to avoid.
 *   - Rows animate open/shut through components/Collapsible (measured-height clip, no fade) so
 *     folding a card reads as "still there, just folded". Do not swap in an opacity fade — see
 *     Collapsible's header for why.
 *   - The row border is `computeBorderTone(hue, isDark, 'field')` — the screen's hue at the
 *     FIELD rung, one step lighter than the card's own edge. That gradation is the whole reason
 *     a card full of boxes doesn't read as a grid: the card's border is the strong line, the
 *     rows are quieter lines inside it. Don't reach for `theme.border` here; it's a fixed grey
 *     that would ignore the screen it's on.
 *   - **The design lab's `rowShape` knob (2026-08-06) can put the rules back**, and that is the
 *     point of it: boxed · ruled · flush are the three answers this one question has been given
 *     across three passes, and each was argued in prose. `boxed` is the shipped fallback, so
 *     nothing changes until the lab says otherwise — but if a future pass wants to move off
 *     boxes, the way to decide is to flip this on the real screens rather than to re-argue it.
 *     Row height and the field border's width/strength come from the lab too.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Collapsible from '@/components/Collapsible';
import { computeBorderTone, PAD_ROW_HEIGHT, PAD_ROW_MIN_HEIGHT, Radius, Spacing } from '@/constants/theme';
import { useLabControl, useLabShape } from '@/lib/useDesignLab';
import { PadState } from '@/lib/padState';
import { useScreenColor } from '@/lib/screenColor';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';

type Props = {
  /** Which of the three sizes to draw. Drives the rows' reveal. */
  state: PadState;
  /**
   * The pad's first line — the always-open "Type note"/"Type task" field. Shown in every
   * state, including closed. Drawn unboxed; it brings its own border.
   */
  typeRow?: React.ReactNode;
  /** One child per row, already sliced to what `state` shows (see padVisibleRows). */
  children?: React.ReactNode;
  /**
   * Content below the rows, inside the sheet but unboxed — the done/checked zone, a total, a
   * pace line. Only drawn when `state === 'open'`.
   */
  footer?: React.ReactNode;
  /**
   * Retained for call-site compatibility and ignored. Spare lines were removed in the
   * 2026-08-05 boxed-rows pass — see the header. Callers still passing it are harmless; the
   * prop is kept rather than removed so this pass didn't have to touch every one of them.
   */
  spareLines?: number;
  style?: StyleProp<ViewStyle>;
};

export default function PadSheet({
  state,
  typeRow,
  children,
  footer,
  style,
}: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const hue = useScreenColor() ?? theme.border;
  const rows = React.Children.toArray(children).filter(Boolean);
  // Design lab (lib/designLab.ts). `rowShape` is the one knob that re-answers the question the
  // 2026-08-05 pass answered with boxes — and that DESIGN_COMPARISON/10 had answered with rules
  // before it. Both answers were right for the card they were asked about, which is exactly why
  // it is worth being able to flip between them on the real screens rather than in prose.
  const shape = useLabShape();
  const rowShape = useLabControl('rowShape');
  const fieldWidth = shape.borderFieldWidth * shape.borderScale;
  const tone = computeBorderTone(hue, isDark, 'field', shape.borderRampStrength);
  // 'ruled' is the pre-reset notepad: one hairline under each row, no box. 'flush' is neither —
  // rows separated by whitespace alone, which is what DESIGN_RULES.md rule 5 asks for and the
  // reset explicitly overruled.
  const box =
    rowShape === 'ruled'
      ? { borderBottomWidth: fieldWidth, borderColor: theme.rule }
      : rowShape === 'flush'
        ? null
        : {
            borderWidth: fieldWidth,
            borderColor: tone,
            borderRadius: Radius.sm * shape.radiusScale,
          };
  // This file's `styles` are NOT run through useScaledStyles, so it owns its own geometry
  // outright — no double-application risk, unlike a caller-supplied radius (see Surface).
  const gutter = { paddingHorizontal: Spacing.sm * shape.spacingScale };
  const stackGap = { marginTop: Spacing.xs * shape.spacingScale };

  return (
    <View style={[styles.sheet, style]}>
      {typeRow ? <View style={styles.typeLine}>{typeRow}</View> : null}

      {/* Clip-reveal rather than a mount/unmount pop, so folding a card away reads as the rows
          being covered edge-by-edge — the same motion as the done zones. */}
      <Collapsible open={state !== 'closed'}>
        {rows.map((row, i) => (
          <View key={i} style={[styles.line, gutter, { minHeight: shape.rowHeight }, box, i > 0 && stackGap]}>
            {row}
          </View>
        ))}
      </Collapsible>

      {state === 'open' && footer ? footer : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // No padding of its own: the card's own PAD_GUTTER already insets the sheet.
  sheet: { width: '100%' },
  // The always-open type line keeps the fuller rhythm (its own 44px minHeight, from
  // PadTypeRow) — this wrapper just needs to not clip it short. It is deliberately unboxed.
  typeLine: { minHeight: PAD_ROW_MIN_HEIGHT, justifyContent: 'center' },
  // A row box. `justifyContent:'center'` keeps a short row vertically centred in its box the
  // way it used to be centred on its ruled line, so converting to boxes didn't shift any
  // row's content up. The horizontal padding is what stops a row's first glyph sitting on its
  // own border — the complaint the 2026-07-30 gutter pass was originally fixing.
  line: {
    minHeight: PAD_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  // Boxes stack with a 4px gap rather than flush. Flush would put two 1.25px borders against
  // each other and paint a 2.5px line between every pair of rows — heavier than the CARD's own
  // border, which inverts the hierarchy the tone ramp is there to establish.
  stacked: { marginTop: Spacing.xs },
});
