/**
 * PadSheet.tsx — the shared body of every list-bearing card: a filled, bordered row at
 * `Radius.sm`, separated by space.
 *
 * **Boxed rows are back, 2026-08-26 — the THIRD reversal of this one question, and the second
 * time boxes have been the answer.** Ruled lines (2026-07-30 notepad pass) → bordered boxes
 * (2026-08-05 card reset) → flush (2026-08-15 Tactile Glass) → **boxed again (now)**. All four
 * rulings are the maintainer's own; none was drift. `DESIGN_RULES.md` rule 5 and its open
 * conflict #8 are rewritten in the same edit as this file, so the docs stop contradicting the
 * shipped app — see those files rather than trusting this comment's account to stay current.
 * `DESIGN_COMPARISON/10-boxed-vs-ruled-rows.md` and `19-card-surface-reset.md` have the
 * reasoning for each swing.
 *
 * **The recipe is one step away from the card, in whichever direction has room.** A row is not
 * a THEME-hued line any more (the 2026-08-05 boxes used `computeBorderTone(hue, …)`, the
 * screen's own colour at the field rung) — it is a neutral wash of the row's OWN surface: a dark
 * card lifts (a lit-white fill reads as raised on near-black), a light card is already close to
 * white so the same white wash would vanish, and recesses instead (a dark wash reads as sunk).
 * Same fill/edge pair on every screen regardless of the card's categorical hue — this is a
 * container edge, not a control boundary, and the identity hue stays reserved for the badge,
 * a focused field's halo and a primary key, per the "text/borders/backgrounds never glow"
 * glow-budget rule. The values are inlined here (not a `constants/theme.ts` token) — this pass
 * runs alongside another touching that file's card/glow tokens, and a literal two-value pair
 * with nothing else deriving from it doesn't need a shared home yet.
 *
 * **What did NOT change**: the composer keeps its own, separately-justified box
 * (`components/PadTypeRow.tsx` / `FormControls`' `Input`, a rule-18 focus fix, not a rows
 * decision) — de-boxing rows never argued for un-boxing the field, and boxing rows back up
 * doesn't argue for giving the field a *different* box either.
 *
 * Spare lines are still gone (see the 2026-08-15 note this replaced) — a page of empty boxes
 * reads as broken UI rather than as blank paper, so the mechanism doesn't come back with the
 * border. `padSpareLines` is still exported from lib/padState for its tests, but this
 * component still doesn't call it.
 *
 * Connections:
 *   Imports → constants/theme (PAD_ROW_HEIGHT, PAD_ROW_MIN_HEIGHT, Radius, Spacing),
 *             components/Collapsible, lib/padState (PadState), lib/useAppTheme,
 *             lib/useDesignLab (useLabControl, useLabShape — the `rowShape` knob below)
 *   Used by → components/{HomeNotesCard,HomeHabitsCard,PlanTaskCard}.tsx,
 *             app/(tabs)/{plans,habits,shopping}.tsx
 *   Data    → none (presentational; the caller slices rows via lib/padState's padVisibleRows)
 *
 * Edit notes:
 *   - **The caller slices, this draws.** Pass only the rows the current state actually shows
 *     (`padVisibleRows(rows, state)`); this component does not filter. That keeps the "what is
 *     visible" answer in one place — the same value a caller hands to lib/viewSnapshot for the
 *     what-was-hidden glow.
 *   - **`typeRow` is the pad's LAST line as of 2026-08-13, not its first.** It is still drawn in
 *     EVERY state, including closed — losing it when you fold a card away would cost the fastest
 *     capture path in the app, and that half is the reason it is a named slot rather than just
 *     another child. What moved is only WHERE. It sat above the rows from the 2026-07-30 notepad
 *     pass onward, on the reasoning that the type line IS the notepad's first rule; the cost was
 *     that Home's four cards put their composer at the top while the Habits tab, the Health tab
 *     and the Goals drawer put theirs at the foot, so the same field lived in two places
 *     depending on which surface you asked (maintainer, 2026-08-13, with screenshots: "cards
 *     still differ when it comes to where new and empty row sits"). The app's own rule already
 *     said which way to settle it — "an add-new-row trigger lives at the bottom of the list it
 *     appends to" (AGENTS.md) — so the pad follows it now and the split is closed.
 *     **Above the `footer`, not below it**: the footer is the done/checked zone, and this field
 *     appends to the ACTIVE list, not to that one.
 *     It gets NO box of its own beyond what it already draws: `components/PadTypeRow.tsx`
 *     already draws a bordered field, and wrapping a bordered field in a bordered box is the
 *     doubled-border mistake this component still avoids even with the rows boxed again.
 *   - Rows animate open/shut through components/Collapsible (measured-height clip, no fade) so
 *     folding a card reads as "still there, just folded". Do not swap in an opacity fade — see
 *     Collapsible's header for why.
 *   - **The row fill/edge is neutral and theme-derived, not screen-hued** — `ROW_BOX_*` below,
 *     picked by `isDark`, never by `useScreenColor()`. Don't reach for the screen's hue here;
 *     see the header note on why that's a deliberate change from the 2026-08-05 boxes.
 *   - **The design lab's `rowShape` knob (2026-08-06) can put ruled or flush back**, and that is
 *     the point of it: boxed · ruled · flush are the three answers this one question has been
 *     given across four passes, and each was argued in prose. `boxed` is the shipped fallback
 *     again (`lib/designLab.ts`'s `CONTROL_KNOBS` entry) — but if a future pass wants to move
 *     off boxes, the way to decide is to flip this on the real screens rather than re-argue it.
 *     Row height and the field border's width/strength come from the lab too.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { PAD_ROW_HEIGHT, PAD_ROW_MIN_HEIGHT, Radius, Spacing } from '@/constants/theme';
import { useLabControl, useLabShape } from '@/lib/useDesignLab';
import { PadState } from '@/lib/padState';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';

// A row's box is one step away from the CARD's own surface, not the screen's categorical hue —
// see the header note. Inlined rather than a constants/theme.ts token: a two-value pair with
// nothing else deriving from it, alongside another pass touching that file's own card/glow
// tokens this session. Keep the two pairs in step if the card surface (Phase 1, constants/
// colors.ts) moves again — "one step away from the card" is the invariant, not these literals.
const ROW_BOX_FILL_DARK = 'rgba(255,255,255,0.055)';
const ROW_BOX_EDGE_DARK = 'rgba(255,255,255,0.10)';
const ROW_BOX_FILL_LIGHT = 'rgba(27,36,50,0.045)';
const ROW_BOX_EDGE_LIGHT = 'rgba(27,36,50,0.10)';

type Props = {
  /** Which of the three sizes to draw. Drives the rows' reveal. */
  state: PadState;
  /**
   * The pad's last line — the always-open "Type note"/"Type task" field, drawn under the rows
   * and above the `footer`'s done zone. Shown in every state, including closed. Drawn unboxed;
   * it brings its own border. See the "`typeRow` is the pad's LAST line" Edit note for why it
   * is not the first any more.
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
  const rows = React.Children.toArray(children).filter(Boolean);
  // Design lab (lib/designLab.ts). `rowShape` is the one knob that re-answers the question
  // this pass answers with boxes again — DESIGN_COMPARISON/10 answered it with rules once, and
  // the 2026-08-15 pass answered it with neither. All three are worth being able to flip
  // between on the real screens rather than re-arguing in prose.
  const shape = useLabShape();
  const rowShape = useLabControl('rowShape');
  const fieldWidth = shape.borderFieldWidth * shape.borderScale;
  // 'ruled' is the pre-reset notepad: one hairline under each row, no box. 'flush' is the
  // 2026-08-15 answer — rows separated by whitespace alone. 'boxed' (the fallback again) is a
  // neutral fill+edge one step off the card's own surface — see the header note for why it is
  // no longer the screen's categorical hue.
  const box =
    rowShape === 'ruled'
      ? { borderBottomWidth: fieldWidth, borderColor: theme.rule }
      : rowShape === 'flush'
        ? null
        : {
            borderWidth: fieldWidth,
            borderColor: isDark ? ROW_BOX_EDGE_DARK : ROW_BOX_EDGE_LIGHT,
            backgroundColor: isDark ? ROW_BOX_FILL_DARK : ROW_BOX_FILL_LIGHT,
            borderRadius: Radius.sm * shape.radiusScale,
          };
  // This file's `styles` are NOT run through useScaledStyles, so it owns its own geometry
  // outright — no double-application risk, unlike a caller-supplied radius (see Surface).
  const gutter = { paddingHorizontal: Spacing.sm * shape.spacingScale };
  // ── The gap only shrinks back down when there's no border to collide with ────────────────
  // Boxed: `Spacing.xs` (4) — enough to keep two 1.25px borders from butting into a 2.5px line
  // heavier than the card's own 1.5px edge. Flush (no `box`): `Spacing.sm` (8) — with no
  // borders to keep apart, the whitespace itself has to be the separation, per DESIGN_RULES.md
  // rule 5's flush-mode case.
  const stackGap = { marginTop: (box ? Spacing.xs : Spacing.sm) * shape.spacingScale };

  return (
    <View style={[styles.sheet, style]}>
      {/* ⚠️ **No `Collapsible` here as of 2026-08-21.** It clip-revealed the rows when the pad
          went to 'closed', and 'closed' is not a pad state any more — folding a card away is
          components/Card.tsx's own `Collapsible`, one level up, for every card in the app. Two
          of them on one card is two animations for one gesture. What is left is a plain list. */}
      {rows.map((row, i) => (
        <View key={i} style={[styles.line, gutter, { minHeight: shape.rowHeight }, box, i > 0 && stackGap]}>
          {row}
        </View>
      ))}

      {/* The composer, at the foot of the list it appends to (2026-08-13 — see the header's
          `typeRow` note). The gap above it is the same one the rows stack at, and it is spent
          only when there is actually a row above to be separated FROM — an unconditional
          marginTop would hang the field off a card with nothing over it. */}
      {typeRow ? (
        <View style={[styles.typeLine, rows.length > 0 && stackGap]}>{typeRow}</View>
      ) : null}

      {/* Below the composer: the done/checked zone belongs under the thing that creates rows,
          not between the list and its own add line. */}
      {state === 'open' && footer ? footer : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // No padding of its own: the card's own PAD_GUTTER already insets the sheet.
  sheet: { width: '100%' },
  // The always-open type line keeps the fuller rhythm (its own 44px minHeight, from
  // PadTypeRow) — this wrapper just needs to not clip it short. It is deliberately unboxed.
  // No margin of its own: the gap to the rows above is applied at the call site from the same
  // `stackGap` the rows use, so the pad has one number for "space between two lines".
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
  // each other and paint a 2.5px line between every pair of rows — heavier than either the
  // card's own edge or the row's own neutral one, which inverts the hierarchy the fill/edge
  // pair is there to establish.
  stacked: { marginTop: Spacing.xs },
});
