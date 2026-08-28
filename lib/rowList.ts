/**
 * rowList.ts — the ONE recipe for "a run of rows that reads as one object".
 *
 * `DESIGN_COMPARISON/20-corrected-screens.html` opens its list of what was globally wrong with
 * exactly this:
 *
 *   > *"Rows were separate floating pills with 7px of air between them, so four tasks read as
 *   > four cards. Rows now share one surface with hairline separators and an accent rail down
 *   > the left edge — a single object with parts."*
 *
 * **Three files were drawing three different rows when that was written, and none of them was
 * this.** `components/PadSheet.tsx` drew a bordered box per row with a 4px gap;
 * `components/HabitsSurface.tsx` hand-rolled the same recipe by hand, because it never adopted
 * PadSheet, and had drifted from it in both directions before; and
 * `components/PlanTaskCard.tsx` — the day view, i.e. the app's single most-seen card — drew a
 * third shape again, `rgba(theme.accent, 0.05)` inside `rgba(screenHue, 0.2)`, which is also the
 * only place a categorical hue was still washing a row's whole body after the 2026-08-20 ruling
 * took that wash off the card.
 *
 * So this is a module rather than a style in one component: the property that keeps breaking is
 * *"do these three agree"*, and prose in three headers telling each other to stay in step is
 * precisely what did not work — `lib/__tests__/screenRhythm.test.ts` had a whole describe block
 * comparing literals across two of the files, and the third was never in it.
 *
 * ## The shape
 *
 * One surface: a neutral fill one step off the CARD's own (a dark card lifts, a light card
 * recesses), a 1px edge around the whole run, a quieter hairline where two rows meet, the first
 * and last rows carrying the corners, and — where a caller wants it — a 2px rail in the card's
 * own hue down the left edge.
 *
 * **The rail is a colour element, not a pane wash.** The 2026-08-20 ruling deleted the 5%
 * identity-hue wash over the whole card (*"I do not like the yellow card glass look. White glass
 * with color elements might be better."*); a 2px rail beside a list is the second half of that
 * sentence, not a reopening of the first. `__tests__/glassMaterial.test.ts` still pins the
 * absence of the pane wash and is untouched by this.
 *
 * ## Why the corners are per-row and not a clip
 *
 * The obvious implementation is one wrapper with `overflow: 'hidden'`, and `PadSheet` can afford
 * it. The other two cannot: a Habits row is wrapped in `DraggableTaskRow` (a row lifted by a drag
 * out of a clipping parent is a row sliced in half mid-gesture) and a day-view row carries
 * `FadeInDown`/`FadeOutDown` (a row would be cut off as it left rather than fading). So the list
 * is built FROM THE ROWS — every row takes the side edges, the first takes the top edge and the
 * top corners, the last takes the bottom edge and the bottom corners, and the ones in between
 * take the separator. `rowListStyle()` returns exactly that, given where the row sits.
 *
 * Connections:
 *   Imports → constants/theme (Radius)
 *   Used by → components/PadSheet.tsx, components/HabitsSurface.tsx, components/PlanTaskCard.tsx
 *   Data    → none (pure; no store, no DB — same discipline as lib/cardLayout.ts)
 *
 * Edit notes:
 *   - ⚠️ **A listed row pays no vertical padding of its own beyond what its content needs.** The
 *     boxed row it replaced spent `Spacing.sm` above and below a 27px line, which is where
 *     45px-per-row — and, with the 4px gap, 49px of stack — came from. A row's height should be
 *     its `minHeight` (`PAD_ROW_HEIGHT`, 38). Putting `paddingVertical` back inflates every list
 *     in the app by ~18% with nothing visible to show for it, and it is exactly the kind of edit
 *     that looks like a tidy-up.
 *   - ⚠️ **The separator is lighter than the edge, deliberately.** The edge says where the object
 *     stops; the separator only says where one of its parts ends. Equal weights make the run read
 *     as a grid of cells again, which is the failure mode this replaced.
 *   - **A single-row list takes both sets of corners** (`first && last`), so a list does not
 *     change shape as it fills up.
 *   - The values are literals here rather than `constants/theme.ts` tokens because they are
 *     defined *against the card's surface*, which is a composite (see components/Surface.tsx's
 *     `surfaceGlass`/`surface` pair). If that surface moves again, move these with it — "one step
 *     away from the card" is the invariant, not the numbers.
 */
import { Radius, rgba } from '@/constants/theme';

/** The list's own fill — one step off the card's surface, in whichever direction has room. */
export const ROW_LIST_FILL_DARK = 'rgba(255,255,255,0.055)';
export const ROW_LIST_FILL_LIGHT = 'rgba(27,36,50,0.045)';
/** The edge around the whole run. */
export const ROW_LIST_EDGE_DARK = 'rgba(255,255,255,0.10)';
export const ROW_LIST_EDGE_LIGHT = 'rgba(27,36,50,0.10)';
/** The hairline where two rows meet — quieter than the edge. The mockup's `rgba(255,255,255,.07)`. */
export const ROW_LIST_SEP_DARK = 'rgba(255,255,255,0.07)';
export const ROW_LIST_SEP_LIGHT = 'rgba(27,36,50,0.07)';

/**
 * The rail's width and how much of the card's hue it carries — the mockup's
 * `inset 2px 0 0 color-mix(in srgb, var(--f) 62%, transparent)`. A hard edge, never a wash.
 */
export const ROW_LIST_RAIL_WIDTH = 2;
export const ROW_LIST_RAIL_ALPHA = 0.62;

export type RowListPosition = {
  isDark: boolean;
  /** First row in the run — takes the top edge and the top corners. */
  first: boolean;
  /** Last row in the run — takes the bottom edge and the bottom corners. */
  last: boolean;
  /** The list's corner radius. Defaults to `Radius.sm`; pass the lab-scaled value where there is one. */
  radius?: number;
  /**
   * The card's hue, to draw the rail. Omit for a list with no identity to carry.
   *
   * ⚠️ **There are two rail mechanisms and the split is structural, not taste.** A caller that
   * can afford an `overflow: 'hidden'` wrapper (`components/PadSheet.tsx`) draws the rail as a
   * SIBLING View beside the rows, which is the shape that is identical on both platforms. A
   * caller that cannot — because a clip would slice a dragged or animating row in half — has no
   * wrapper to hang it on, so its rail is this row's own left border, widened to
   * `ROW_LIST_RAIL_WIDTH`. That is a mixed per-side border width, which is the thing
   * `constants/theme.ts`'s `glassKey` refuses; the difference is that `glassKey` is a
   * `Radius.full` PILL, where a 2px side meeting a 1px side mid-arc is visible, and this is a
   * `Radius.sm` box whose left corners are rounded on the first and last rows only.
   */
  rail?: string;
};

/**
 * The style one row of a connected list carries, given where it sits in the run.
 *
 * Returns a plain object (no `StyleSheet.create`) because `first`/`last` are per-render values —
 * a registered style would need one entry per combination and would still be composed at the
 * call site.
 */
export function rowListStyle({ isDark, first, last, radius = Radius.sm, rail }: RowListPosition) {
  const edge = isDark ? ROW_LIST_EDGE_DARK : ROW_LIST_EDGE_LIGHT;
  return {
    backgroundColor: isDark ? ROW_LIST_FILL_DARK : ROW_LIST_FILL_LIGHT,
    borderColor: edge,
    // The rail, where this caller has no wrapper to hang a sibling View on — see `rail`'s doc.
    // Every row draws it, and with the rows flush that is one continuous line.
    borderLeftColor: rail ? rgba(rail, ROW_LIST_RAIL_ALPHA) : edge,
    borderLeftWidth: rail ? ROW_LIST_RAIL_WIDTH : 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
    // Only the last row draws a bottom edge; every other row's bottom IS the next row's
    // separator, and drawing both paints a double line between every pair.
    borderBottomWidth: last ? 1 : 0,
    // The top edge of a row that is not the first is the separator between it and the one above.
    borderTopColor: first ? edge : (isDark ? ROW_LIST_SEP_DARK : ROW_LIST_SEP_LIGHT),
    borderTopLeftRadius: first ? radius : 0,
    borderTopRightRadius: first ? radius : 0,
    borderBottomLeftRadius: last ? radius : 0,
    borderBottomRightRadius: last ? radius : 0,
  } as const;
}
