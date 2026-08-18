/**
 * StarterExampleRow.tsx — a single "preview row" shown while a list is empty: the SHAPE of a row
 * from that list (leading icon + title + trailing meta pill) drawn as a **provisional sketch**,
 * so it reads as a suggestion rather than as something already in the list. Optionally carries a
 * real "+" add button (`onAdd`) so the example is an actual opt-in try-it, not just an
 * illustration.
 *
 * Connections:
 *   Imports → components/Badge, components/PressableScale, constants/theme, lib/useAppTheme
 *   Used by → app/plans.tsx, app/(tabs)/health.tsx, components/PlanTaskCard.tsx and
 *             components/GoalsEditor.tsx (2026-08-13 — its four goal suggestions moved off
 *             components/StarterSuggestionChip: sentence-length labels at Radius.full wrapped
 *             into a ragged staircase, and a row list's even left edge is worth more than the
 *             pill there). All four render it inside a components/StarterCard `example` slot.
 *             **Two corrections to what this line claimed until 2026-08-13**: app/habits.tsx
 *             has passed chips, not rows, since 2026-07-30, and components/HomeHabitsCard.tsx
 *             the same — its read-only row was deleted then for rendering the same suggestion
 *             twice. Neither has imported this since. (app/(tabs)/shopping.tsx dropped its own
 *             two example rows 2026-07-28, see that file's StarterCard call; HomeShoppingCard
 *             dropped its use the same day, for the same reason as its full /shopping screen.)
 *   Data    → none — pure presentation; callers pass already-localized strings, a
 *             domain/semantic accent color (e.g. getDomainColor(theme, 'shop').accent),
 *             and (optionally) an `onAdd` callback that writes the example into the
 *             real store
 *
 * Edit notes:
 *   - **⚠️ BORDERLESS AND UPRIGHT since 2026-08-18 — read this before the two notes below it.**
 *     Maintainer: *"Do NOT place borders, `<Divider/>` lines, or separate background boxes
 *     inside of main cards… List items, text inputs, and suggestion chips must sit seamlessly on
 *     the main card's background… Remove all italicized text."* So the dashed field-rung edge,
 *     the icon ring's stroke, the "+" button's stroke and the italic title are all gone. What is
 *     LEFT saying "provisional" is muted ink on every part of the row, a recessive `getMatte()`
 *     disc under the two marks, and the accent on the "+" glyph alone — and the row's geometry
 *     is unchanged, which is what still makes it an example OF the rows around it.
 *     The 2026-08-10 reversal below is not undone: this is still not a real row, and nothing
 *     here should be given a fill, a hue or a finished-looking weight. Only the CHANNELS
 *     changed, from an edge to ink.
 *   - **This finish is shared with components/StarterSuggestionChip (2026-08-12).** The app has
 *     exactly TWO empty-state example shapes — this row (one illustration of a row in the list
 *     below it) and that chip (one of N pick-one suggestions, which has to wrap) — and since
 *     2026-08-12 they have ONE finish: dashed, unfilled, muted italic, neutral, accent on the
 *     "+" alone. The shapes stay different on purpose (`Radius.sm` here, `Radius.full` there);
 *     the finish must not. Maintainer: *"Examples are placed the same throughout app, but does
 *     not look the same … I prefer the visual in the to-do preview card."* Change a channel
 *     here and change it there in the same edit, or the split reopens.
 *   - **⚠️ REVERSED 2026-08-10 — this row is deliberately NOT a real row any more.** User
 *     report: "Examples are not visible examples, they look like a part of the card or an
 *     active task, not as a temporary thing."
 *     The previous rule (2026-07-27, from the opposite report — "designed the same as other
 *     rows in app") made the fill the same `rgba(accent, 0.05)` wash and the border the same
 *     `rgba(accent, 0.2)` that components/PlanTaskCard's `rowCard` uses for a LIVE task, at the
 *     same padding, with a full-strength `theme.text` semibold title. That succeeded completely:
 *     it became indistinguishable from a real row, and the only thing left saying otherwise was
 *     a 10px "Example" pill competing for width with the title at 360px.
 *     What it is now — every channel says provisional, and none of them says "content":
 *       • **dashed** border in neutral `theme.border` (the same `borderStyle: 'dashed'` treatment
 *         PlanTaskCard's own ghost add-row already uses for "this isn't here yet")
 *       • **no fill** — transparent, so it never reads as a filled row on the card
 *       • title in `theme.textMuted`, **italic** — matching StarterCard's own explainer voice
 *       • icon ring in `theme.border`, not the accent
 *     `accent` survives for exactly two things: the "+" button (a real action, in the app's one
 *     action colour). The tag chip that used to carry the second half of it is gone (2026-08-13).
 *     **Don't "restore" the real-row styling by citing the 2026-07-27 note** — that note is
 *     kept above precisely so the reversal is legible as a decision, not as drift.
 *   - **(2026-07-31, addendum A.4 rule 1) `accent` is a FILL/EDGE colour here, never ink.** The
 *     leading glyph and the "example" tag word used to be drawn in it; both are `textMuted`
 *     now, and the "+" is `theme.accent` (it is an action, and the app has one action colour).
 *     The row kept every hue it had at the time — wash, row edge, icon circle, tag chip, "+"
 *     button — so it still read as belonging to its list; only the "+" carries one now. The reason is legibility at the collapsed
 *     four-hue set: Shopping's gold is 2.25:1 on white, so a 13px glyph and an 11px word drawn
 *     in it were the two least readable things on an empty screen.
 *   - `onAdd` is optional — omit it for a purely read-only preview (Habits' row does
 *     this: its four *real* one-tap add chips, rendered separately in StarterCard's
 *     `children`, already cover the same item, so a second "+" here would just be a
 *     redundant second way to do the same thing). When provided, the caller owns the
 *     actual store write AND its own haptic (`success()`) — this component only calls
 *     it, matching the house pattern (see app/habits.tsx's createHabit).
 *   - `meta`/`metaVariant` reuse components/Badge — keep meta text short (a count,
 *     a signed number, a recurrence word) so it reads as a pill, not a second sentence.
 *   - **The "Example" chip is GONE (2026-08-13) — don't reintroduce it.** History, because it
 *     is a marker that has now been tried in two shapes and dropped: a full-width uppercase
 *     "EXAMPLE TASKS" caption line above the row (2026-07-30, cut for costing a whole line on
 *     a card whose problem was already too much teaching before any content), then a one-word
 *     `tag` chip on the row itself, cut now. Both were answering "is this a real row?" — a
 *     question the 2026-08-10 provisional finish (dashed, unfilled, muted italic) already
 *     answers, and which the trigger row above the box now answers a second time in words
 *     ("Eksempler:" / "Examples:", `StarterCard`'s `exampleHeaderLabel`). Maintainer: "Remove
 *     the 'Eksempel' in the example row since the 'Eksempler:' already shows user that these
 *     are examples." Three markers for one idea is two too many.
 *   - There used to be a `compact` chip variant for a `compact` StarterCard. Its only caller
 *     was components/EnergyMeter's disappearing empty-state explainer, which became a
 *     permanent one-line hint with no examples (2026-07-27) — the variant went with it.
 *   - `added` (2026-07-31, user report: tapping the "+" made the whole example vanish with no
 *     feedback of what happened): callers used to gate their StarterCard/example on a plain
 *     `list.length === 0`, so writing the example into the real store flipped that count to 1
 *     and unmounted the row in the same tick — see StarterCard's Edit notes for why that read
 *     as the example just disappearing rather than "added". Callers now keep the row mounted
 *     for the rest of that visit and pass `added` instead: the row dims (`opacity: 0.5`) and
 *     the "+" is replaced with a static, non-pressable checkmark — same geometry, so nothing
 *     reflows. `onAdd` is ignored while `added` is true (the row has nothing left to add).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '@/components/Badge';
import PressableScale from '@/components/PressableScale';
import { Fonts, FontSize, getMatte, Radius, Spacing, HitSlop } from '@/constants/theme';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';

type Props = {
  /** Leading glyph, shown inside a thin circle matching the app's row-checkbox sizing. */
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Row title — the example item itself (e.g. "Milk", "Headache"). */
  title: string;
  /** Optional trailing pill (e.g. "Weekly", "+1", "3/5"). */
  meta?: string;
  metaVariant?: 'neutral' | 'success' | 'warning' | 'danger';
  /** When provided, renders a trailing "+" button that writes this example into the
   *  real store — omit for a read-only preview (see Edit notes). */
  onAdd?: () => void;
  /** Accessibility-label prefix for the add button, e.g. "Add" → "Add Milk". */
  addLabel?: string;
  /** Already written to the real store this visit — dims the row and swaps the "+" for a
   *  static checkmark instead of unmounting (see Edit notes). */
  added?: boolean;
};

export default function StarterExampleRow({ icon, title, meta, metaVariant = 'neutral', onAdd, addLabel, added }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const matte = getMatte(isDark);
  // Borderless: the row sits straight on the card it is an example inside, and says
  // "provisional" through muted ink and a recessive matte "+" rather than through a stroke.
  // See the 2026-08-18 note in the Edit notes before drawing an edge here again.
  return (
    <View style={[styles.row, added && styles.rowAdded]}>
      {/* A.4 rule 1: the glyph is neutral ink. Its ring is a matte disc rather than a drawn
          circle — same mark, no edge. */}
      <View style={[styles.iconWrap, { backgroundColor: matte }]}>
        <Ionicons name={icon} size={13} color={theme.textMuted} />
      </View>
      <Text style={[styles.title, { color: theme.textMuted }]} numberOfLines={1}>
        {title}
      </Text>
      {/* Sized to MARK like the row's other three marks — Badge's own pill is a couple of px
          taller, which put four different heights on one short line. `style` only, so no other
          Badge in the app moves. */}
      {meta ? <Badge label={meta} variant={metaVariant} style={styles.metaMark} /> : null}
      {added ? (
        <View style={[styles.addBtn, { backgroundColor: matte }]}>
          <Ionicons name="checkmark" size={14} color={theme.textMuted} />
        </View>
      ) : onAdd ? (
        <PressableScale
          onPress={onAdd}
          scaleTo={0.9}
          hitSlop={HitSlop.base}
          accessibilityRole="button"
          accessibilityLabel={addLabel ? `${addLabel} ${title}` : title}
          // A matte disc, not an outlined one. The accent is still spent here and nowhere else
          // on the row — on the GLYPH, which is the part that has to be seen.
          style={[styles.addBtn, { backgroundColor: matte }]}
        >
          <Ionicons name="add" size={14} color={theme.accent} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/**
 * One height for every small mark on the row — the icon ring, the "Example" chip, the meta pill
 * and the "+" (2026-08-10, maintainer: make boxes the same size where it makes sense). Measured,
 * these were 22 / 18 / 26 / 22: four marks doing the same weight of job at three sizes on one
 * short line. 22 is the ring's existing size, which is the app's row-checkbox sizing.
 *
 * **It is a `height` on the two icon marks and a `minHeight` on the two text marks, and that
 * split is deliberate (2026-08-13).** An Ionicons glyph is drawn at an explicit `size` and never
 * font-scales, so its box can be pinned exactly. The "Example" chip and the meta pill contain a
 * <Text>, which DOES grow with the OS display-size setting — and both are `Radius.full`, which
 * masks children on Android — so pinning those clips the letters instead of cramping them. Equal
 * heights are the intent, not the invariant: let a text mark grow rather than slice it.
 */
const MARK = 22;

const styles = StyleSheet.create({
  // Geometry + padding still mirror PlanTaskCard's `rowCard` — the example has to be the same
  // SHAPE as the thing it's an example of, or it stops teaching anything. What changed
  // 2026-08-10 is the finish: `dashed` and no `backgroundColor`, so the shape reads as an
  // outline waiting to be filled rather than as a row that already exists.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    // **No border, no fill, no radius (2026-08-18).** The dashed field-rung edge that lived
    // here is gone: an example row sits seamlessly on the card that lists it, like every other
    // list item. Only the horizontal padding is gone with it — the vertical padding stays,
    // because it is what keeps the row the same HEIGHT as the thing it is an example of, which
    // is the one property this component has always had to keep.
    paddingVertical: Spacing.sm,
  },
  // Already added this visit — dimmed, not a fifth row style, just a faded version of the
  // same one (see the `added` Edit note).
  rowAdded: {
    opacity: 0.5,
  },
  iconWrap: {
    width: MARK,
    height: MARK,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The meta pill at MARK too. Badge keeps its own horizontal padding — only the height is
  // pinned, so a long value still gets the room it needs.
  //
  // **`minHeight`, never `height` (2026-08-13).** User report, with a screenshot of the day
  // card's "17:00–17:20" example: the digits were sliced off along the bottom. `height: 22` is
  // a hard box, and Badge does NOT run through useScaledStyles — its label is a plain <Text>
  // with RN's default `allowFontScaling`, so the OS display-size setting grows the glyph while
  // this box stays at 22. Badge's own pill is `FontSize.xs` + `paddingVertical: 4`, i.e. ~24pt
  // of content at OS scale 1.0 already, and its `Radius.full` masks its children on Android —
  // so the overflow is CLIPPED rather than spilling, which is why it read as a rendering bug
  // and not as a cramped pill. minHeight keeps the "one height for every mark" intent at the
  // sizes where it fits and simply lets the pill grow at the sizes where it doesn't.
  metaMark: { minHeight: MARK, justifyContent: 'center' },
  title: {
    flex: 1,
    // minWidth:0 so the title yields to the tag/meta/add cluster instead of pushing them off
    // the row — see AGENTS.md's wrap-audit lesson about minWidth on flex children.
    minWidth: 0,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semibold,
    // **Upright (2026-08-18)** — *"Remove all italicized text."* Muted ink, set at the call
    // site, is what still says "this one isn't yours yet"; a slanted face was the app saying it
    // twice, in the one channel the maintainer ruled out.
  },
  addBtn: {
    width: MARK,
    height: MARK,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
