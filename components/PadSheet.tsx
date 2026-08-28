/**
 * PadSheet.tsx — the shared body of every list-bearing card: **one connected list**, a single
 * rounded surface with a hairline between rows and the card's own hue as a 2px rail down its
 * left edge.
 *
 * ⚠️ **Rows stopped being separate boxes on 2026-08-28, and this is the mockup's own headline
 * fix rather than a fifth swing of the boxed/ruled pendulum.** `DESIGN_COMPARISON/20-corrected-
 * screens.html` opens its "what was wrong, globally" list with exactly this:
 *
 *   > *"Rows were separate floating pills with 7px of air between them, so four tasks read as
 *   > four cards. Rows now share one surface with hairline separators and an accent rail down
 *   > the left edge — a single object with parts."*
 *
 * Round 20 built the mockup's chrome, header, hint and groups and never touched the rows, so
 * the app went on drawing four pills where the approved screen draws one list. That is most of
 * what "still not like the mockups" was pointing at, and it is also the largest single density
 * win available: a boxed row measured **45px + a 4px gap = 49px** of stack per row (its own
 * `Spacing.sm` vertical padding plus two 1.25px borders on top of a 27px line); a listed row is
 * `PAD_ROW_HEIGHT` **38px + a hairline**. Measured on Home's Today card, three tasks: 143px of
 * rows → 116px, with nothing removed from the screen.
 *
 * **The history is still worth knowing, because this is not a return to any of it.** Ruled lines
 * (2026-07-30 notepad pass) → bordered boxes (2026-08-05 card reset) → flush (2026-08-15 Tactile
 * Glass) → boxed again (2026-08-26) → **listed (now)**. The first four were four answers to
 * *"how is one row separated from the next"*; this one answers a different question — *"do these
 * rows read as one object or as several"* — and it keeps the winner of the old argument (there
 * IS a fill and an edge, the 2026-08-26 ruling) while spending it **once, on the list**, instead
 * of once per row. `DESIGN_COMPARISON/10-boxed-vs-ruled-rows.md` and `19-card-surface-reset.md`
 * have the reasoning for each swing.
 *
 * **The rail is a colour element, not a pane wash, and the distinction is the 2026-08-20
 * ruling's own.** That pass deleted the 5% identity-hue wash over the whole card
 * (*"I do not like the yellow card glass look. White glass with color elements might be
 * better."*) — a 2px rail beside a list is the second half of that sentence, not a reopening of
 * the first. `__tests__/glassMaterial.test.ts` still pins the absence of the pane wash and is
 * untouched by this.
 *
 * **The fill/edge recipe is unchanged and still neutral** — one step away from the CARD's own
 * surface, in whichever direction has room: a dark card lifts (a lit-white wash reads as raised
 * on near-black), a light card recesses (a dark wash reads as sunk). Same pair on every screen
 * regardless of hue, because that edge is a container boundary, not a control boundary.
 *
 * **What did NOT change**: the composer keeps its own, separately-justified box
 * (`components/PadTypeRow.tsx` / `FormControls`' `Input`, a rule-18 focus fix) and sits OUTSIDE
 * the list, because it is not one of the list's rows — it is what makes them. Spare lines are
 * still gone; `padSpareLines` is still exported from lib/padState for its tests and still not
 * called here.
 *
 * Connections:
 *   Imports → constants/theme (PAD_ROW_HEIGHT, PAD_ROW_MIN_HEIGHT, Radius, Spacing, rgba),
 *             lib/rowList (the shared list recipe), lib/padState (PadState),
 *             lib/screenColor (useScreenColor), lib/useAppTheme,
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
 *   - ⚠️ **A listed row carries NO vertical padding, and that is where the 7px came from.** Its
 *     height is `PAD_ROW_HEIGHT` (38) alone, which is above the 27px a `PadRow` line actually
 *     measures, so nothing is clipped and nothing moved: `justifyContent: 'center'` keeps a
 *     short row centred exactly as the box used to. Adding `paddingVertical` back re-inflates
 *     every list in the app by ~18%.
 *   - ⚠️ **The rail is a sibling View, never `borderLeftWidth`.** Mixed per-side border WIDTHS
 *     on a rounded box render inconsistently on Android — the same finding that stopped
 *     `constants/theme.ts`'s `glassKey` taking the button brief's per-side widths. A 2px column
 *     beside the rows is the one shape that is the same on both platforms.
 *   - **`typeRow` is the pad's LAST line as of 2026-08-13, not its first.** It is drawn in EVERY
 *     state, including closed — losing it when you fold a card away would cost the fastest
 *     capture path in the app. It sat above the rows from the 2026-07-30 notepad pass until
 *     Home's four cards and the Habits/Health/Goals surfaces disagreed about where the same
 *     field lives (maintainer, 2026-08-13, with screenshots); the app's own rule settles it —
 *     *"an add-new-row trigger lives at the bottom of the list it appends to"*. **Above the
 *     `footer`**, which is the done/checked zone this field does not append to.
 *   - Rows animate open/shut through components/Collapsible one level up (components/Card.tsx's
 *     fold). There is no Collapsible here — see the note in the JSX.
 *   - **The row fill/edge is neutral and theme-derived, not screen-hued** — `ROW_LIST_*` from
 *     lib/rowList.ts, picked by `isDark`. Only the RAIL takes the hue.
 *   - **The design lab's `rowShape` knob (2026-08-06) still has every previous answer**, and
 *     that is the point of it: `listed` (shipped) · `boxed` · `ruled` · `flush` are the four
 *     answers this one question has been given across five passes, each argued in prose. If a
 *     future pass wants to move off the list, flip the knob on the real screens rather than
 *     re-arguing it. Row height and the field border's width/strength come from the lab too.
 *   - ⚠️ **Two other files draw rows and neither goes through this component** —
 *     components/HabitsSurface.tsx (its rows are wrapped in `DraggableTaskRow`) and
 *     components/PlanTaskCard.tsx (its rows carry enter/exit animations). Both now take the same
 *     recipe from lib/rowList.ts, which is what stopped the app having three row shapes; neither
 *     can use this component's `overflow: 'hidden'` list, and that file's header says why.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { PAD_ROW_HEIGHT, PAD_ROW_MIN_HEIGHT, Radius, Spacing, rgba } from '@/constants/theme';
import { useLabControl, useLabShape } from '@/lib/useDesignLab';
import { PadState } from '@/lib/padState';
import { useScreenColor } from '@/lib/screenColor';
import {
  ROW_LIST_EDGE_DARK, ROW_LIST_EDGE_LIGHT, ROW_LIST_FILL_DARK, ROW_LIST_FILL_LIGHT,
  ROW_LIST_RAIL_ALPHA, ROW_LIST_RAIL_WIDTH, ROW_LIST_SEP_DARK, ROW_LIST_SEP_LIGHT,
} from '@/lib/rowList';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';

// ⚠️ **The list's fill, edge, separator and rail all live in lib/rowList.ts now.** They were
// four literals in this file and four hand-copied twins in components/HabitsSurface.tsx, with a
// test comparing the two strings across files — and a THIRD row shape in
// components/PlanTaskCard.tsx that neither of them knew about. One module, three callers; see
// that file's header for why the corners are per-row rather than a clip.

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
  /**
   * The rail's colour. Defaults to the SCREEN's hue, which is right for every tab card — but
   * Home draws previews of four different screens' cards side by side, so those callers pass
   * their own source screen's hue, exactly as they already do for the badge and the count
   * (`CardAccentBadge accentOverride`).
   */
  hue?: string;
  style?: StyleProp<ViewStyle>;
};

export default function PadSheet({
  state,
  typeRow,
  children,
  footer,
  hue,
  style,
}: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const screenHue = useScreenColor();
  const rows = React.Children.toArray(children).filter(Boolean);
  // Design lab (lib/designLab.ts). `rowShape` re-answers the question this pass answers with a
  // connected list. All four previous answers are still reachable from it — see the header.
  const shape = useLabShape();
  const rowShape = useLabControl('rowShape');
  const fieldWidth = shape.borderFieldWidth * shape.borderScale;
  const radius = Radius.sm * shape.radiusScale;
  const gutter = Spacing.sm * shape.spacingScale;
  const railHue = hue ?? screenHue ?? theme.border;

  // ── The four shapes ──────────────────────────────────────────────────────────────────────
  // 'listed' (shipped) — ONE surface, hairlines between rows, a hue rail down the left edge.
  // 'boxed'  — the 2026-08-26 answer: a fill+edge per row, 4px apart.
  // 'ruled'  — the 2026-07-30 notepad: one hairline under each row, no box.
  // 'flush'  — the 2026-08-15 answer: whitespace alone.
  const listed = rowShape === 'listed';
  const separator = isDark ? ROW_LIST_SEP_DARK : ROW_LIST_SEP_LIGHT;
  const listFill = isDark ? ROW_LIST_FILL_DARK : ROW_LIST_FILL_LIGHT;
  const listEdge = isDark ? ROW_LIST_EDGE_DARK : ROW_LIST_EDGE_LIGHT;

  const perRowBox =
    rowShape === 'ruled'
      ? { borderBottomWidth: fieldWidth, borderColor: theme.rule }
      : rowShape === 'boxed'
        ? {
            borderWidth: fieldWidth,
            borderColor: listEdge,
            backgroundColor: listFill,
            borderRadius: radius,
          }
        : null;
  // Only the non-listed shapes stack with a gap. Boxed needs `Spacing.xs` so two 1.25px borders
  // don't butt into a 2.5px line heavier than the card's own edge; flush needs `Spacing.sm`,
  // because with no border the whitespace IS the separation (DESIGN_RULES.md rule 5). A LISTED
  // row needs neither: the hairline separates, and a gap would break the single surface.
  const stackGap = listed
    ? null
    : { marginTop: (perRowBox && rowShape === 'boxed' ? Spacing.xs : Spacing.sm) * shape.spacingScale };

  const lines = rows.map((row, i) => (
    <View
      key={i}
      style={[
        styles.line,
        { paddingHorizontal: gutter, minHeight: shape.rowHeight },
        // ⚠️ A LISTED row has no vertical padding — its height is `minHeight` alone. See the
        // header's note; putting padding back inflates every list in the app by ~18%.
        perRowBox,
        i > 0 && (listed ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: separator } : stackGap),
      ]}
    >
      {row}
    </View>
  ));

  return (
    <View style={[styles.sheet, style]}>
      {/* ⚠️ **No `Collapsible` here as of 2026-08-21.** It clip-revealed the rows when the pad
          went to 'closed', and 'closed' is not a pad state any more — folding a card away is
          components/Card.tsx's own `Collapsible`, one level up, for every card in the app. Two
          of them on one card is two animations for one gesture. */}
      {listed && rows.length > 0 ? (
        // One object with parts: the rail, then the rows, clipped to the list's own radius so
        // the first and last row's corners follow it. `overflow: 'hidden'` is what makes the
        // rail a rounded column rather than a square tab poking out at the top.
        <View style={[styles.list, { borderRadius: radius, borderWidth: fieldWidth, borderColor: listEdge, backgroundColor: listFill }]}>
          <View style={[styles.rail, { width: ROW_LIST_RAIL_WIDTH, backgroundColor: rgba(railHue, ROW_LIST_RAIL_ALPHA) }]} />
          <View style={styles.listRows}>{lines}</View>
        </View>
      ) : (
        lines
      )}

      {/* The composer, at the foot of the list it appends to (2026-08-13 — see the header's
          `typeRow` note), and OUTSIDE the list's surface: it is not one of the rows, it is what
          makes them, and it brings its own bordered field. The gap above it is spent only when
          there is actually something above to be separated from. */}
      {typeRow ? (
        <View style={[styles.typeLine, rows.length > 0 && styles.typeLineStacked]}>{typeRow}</View>
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
  /** The one connected surface. A row, so the rail sits beside the rows rather than under them. */
  list: { flexDirection: 'row', overflow: 'hidden' },
  /** The card's hue down the left edge — `alignSelf: 'stretch'` so it is exactly as tall as the list. */
  rail: { alignSelf: 'stretch' },
  listRows: { flex: 1, minWidth: 0 },
  // The always-open type line keeps the fuller rhythm (its own 48px minHeight, from
  // PadTypeRow) — this wrapper just needs to not clip it short. Deliberately unboxed and
  // outside the list.
  typeLine: { minHeight: PAD_ROW_MIN_HEIGHT, justifyContent: 'center' },
  // One gap between the list and the field that appends to it — `Spacing.xs`, the tighter of
  // the two the rows used to stack at, because there is only ever one of these and the field
  // draws its own border to be separated by.
  typeLineStacked: { marginTop: Spacing.xs },
  /**
   * A row. `justifyContent: 'center'` keeps a short row vertically centred exactly as it was
   * when it had its own box, so converting to a list shifted no row's content. The horizontal
   * padding stops a row's first glyph sitting on the list's own edge — the complaint the
   * 2026-07-30 gutter pass was originally fixing.
   *
   * ⚠️ **No `paddingVertical`.** `PAD_ROW_HEIGHT` (38) is above the 27px a PadRow line
   * measures, so the height is the minHeight alone and nothing is clipped.
   */
  line: {
    minHeight: PAD_ROW_HEIGHT,
    justifyContent: 'center',
  },
});
