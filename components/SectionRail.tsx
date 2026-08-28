/**
 * SectionRail.tsx — section header: a hue dot (or domain gradient badge) + label
 * (+ optional count / right slot), underlined by a hue hairline rule.
 *
 * **Two tiers since 2026-08-21, and that is what makes it the only section header in the app.**
 * `tier="group"` (the default) is the 24px extrabold heading over a stack of cards;
 * `tier="sub"` is the small uppercase heading over a stack of rows INSIDE such a group. The sub
 * tier exists because the Shop tab had a third header idiom — a bare `<Text>` pair over each of
 * the four week sections (`CONSISTENCY_AUDIT.md` §13, from the report *"Use of sub-headers to
 * show user what is what, and to seperate different things"*). It was not wrong about its SIZE
 * — a heading inside a group genuinely should be smaller than the group's — it was wrong about
 * being hand-rolled, so nothing tied its anatomy to the header one level up. Two tiers of one
 * component, rather than two components or one size.
 *
 * The header half of the 2026-07-13 "color rail" list redesign (Tasks screen first, meant as
 * the reusable section primitive for the other list screens too). Pairs with a stack of cards
 * that each carry a matching `railColor` left edge — the shared hue is what binds a header to
 * its rows, replacing the old flat-color pill (`sectionHeader()` in plans.tsx). The `hue` is a
 * domain accent from lib/domainColor.getDomainColor(theme, domain).accent, which has both a
 * light and a dark variant, so the label/dot stay distinct and legible in both modes.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, components/CardAccent (CardAccentBadge)
 *   Used by → app/plans.tsx, app/habits.tsx (via SectionCard), app/(tabs)/shopping.tsx
 *             (both tiers — the two group headers and the four week sub-headers),
 *             components/SharedTasksSection.tsx
 *   Data    → none — presentational
 *
 * Edit notes:
 *   - `hue` should be a solid domain accent (works on any surface, both modes). The header is
 *     the app-wide unified card/section style (2026-07-19): a small dot + sentence-case
 *     title (20px, bold — was ALL-CAPS with letterSpacing 0.8 until the 2026-07-28 design
 *     review moved uppercase back to ≤13px labels only) — NOT a filled pill (that soft-plate
 *     look was dropped). Pass a solid accent, not an already-translucent colour.
 *     ⚠️ **The hairline rule under the naming row is GONE (2026-08-27, round 20)** — it was
 *     `rgba(hue, 0.25)` at hairlineWidth, and it is on the mockup's "stray artefacts" list
 *     with the loose dots. The header is separated from its body by SPACE now — `container`'s
 *     own `marginBottom`, and nothing else since 2026-08-28; see the note on that style.
 *   - **(2026-07-31, addendum A.4 rule 1) The LABEL is `theme.text`, never the hue.** It was
 *     pure `hue` (a same-hue-on-same-hue pairing that read low-contrast), then `mix(hue, text,
 *     0.3)` — but a 70% blend of an identity hue is still that hue used as TEXT colour, which
 *     the identity hues are not for: they are a fill channel (the badge, the card edge). The
 *     Shopping gold shows the cost — `mix(#D9A441, #1B2432, 0.3)` = `#A07E3D`, 3.79:1 on the
 *     light surface: it scrapes past the 3:1 large-text floor at this size and fails AA's 4.5,
 *     while every other hue's label sat at 7.5–8.9:1. That spread is the giveaway that the
 *     colour was never carrying meaning here. The hue is still on this header twice, as the
 *     dot/badge and the hairline rule; the words don't need to carry it a third time.
 *   - **(2026-07-26) Optional `domain` prop**: when the section has a real domain identity (not
 *     just an arbitrary hue like "Today" or a weekday group), pass `domain` to swap the plain
 *     10px dot for a small `CardAccentBadge` gradient badge — part of the same "bring the card
 *     colour back" pass that widened Surface's edge and restored Home's badge gradient. `hue`
 *     is still required (drives the label/divider tint) even when `domain` is set.
 *   - **(2026-08-10) `badgeHue`** paints the badge in `hue` instead of the domain's identity
 *     colour, via `CardAccentBadge`'s existing `accentOverride`. For a rail whose `hue` IS the
 *     screen hue — every `components/CollapsedSection.tsx` drawer — the badge otherwise
 *     disagreed with the divider it sits on and the card edge around it. See that prop's doc.
 *   - The header is always full-width (`container` alignSelf:'stretch') so the rule spans the
 *     header width; the right-slot control's `marginLeft:'auto'` still pushes it to the edge.
 *   - `count` is optional; omit it for sections where a tally adds noise (e.g. weekday groups).
 *   - **`divider` (2026-08-12), default true.** `components/CollapsedSection.tsx` passes
 *     `divider={open}` so a closed drawer's hairline rule disappears along with its body —
 *     the rule ties the header to the content under it, and a closed drawer has none. Every
 *     other caller (`SectionCard`, always-open sections) leaves it at the default.
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Fonts, FontSize, MIN_TAP_TARGET, Spacing, TabularNums, Type } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useT } from '@/lib/i18n';
import PressableScale from '@/components/PressableScale';
import { CardAccentBadge } from '@/components/CardAccent';
import { Domain } from '@/lib/domainColor';

type Props = {
  /** Solid domain accent (getDomainColor(theme, domain).accent). Colors the dot/badge + label. */
  hue: string;
  /** Section's domain identity, if any — swaps the flat dot for a small gradient badge. */
  domain?: Domain;
  /**
   * Override the badge glyph while keeping `domain`'s colour. For a section that borrows
   * another domain's hue to stay visually distinct (see Plans' Recurring section) — passing
   * that domain alone would also borrow its icon, which is rarely what's meant.
   */
  icon?: React.ComponentProps<typeof CardAccentBadge>['icon'];
  label: string;
  /**
   * Optional item tally shown after the label — a SIZE, never a score (AGENTS.md).
   *
   * `{ left, total }` renders as `left/total`, which is what the Me tab's pad cards drew as a
   * hand-rolled `Badge` beside their hand-rolled titles (2026-08-21). Folding it in here is what
   * lets those cards go through components/Card.tsx with nothing left over: a tally is part of
   * a header, not one of the card's controls, and putting it in the controls slot would have put
   * a read-only pill inside the run of tap targets.
   */
  count?: number | { left: number; total: number };
  /** Optional control rendered flush-right (e.g. a toggle). */
  right?: React.ReactNode;
  /**
   * Paint the badge in `hue` instead of `domain`'s own identity colour (2026-08-10).
   *
   * The two colour systems split by CHANNEL — the screen hue owns every edge, the domain hue
   * owns the badge — but a rail whose `hue` IS the screen hue then disagreed with its own
   * badge: the Goals drawer on Habits drew a `#218432` green flag inside a `#22A7E0` sky card,
   * over a sky-tinted divider, and the identical drawer on To-do drew it indigo. Set this and
   * the badge, the divider and the card's edge are one colour, which is what the 2026-08-06
   * `accentOverride` pass already did for the Home preview cards and the Medicine card. Leave
   * it off wherever the badge is genuinely marking a domain (a section of mixed-domain rows).
   */
  badgeHue?: boolean;
  /**
   * Make the badge + label + count its own tap target (2026-08-10). Used by
   * components/CollapsedSection.tsx when a section both EXPANDS (the chevron in `right`) and
   * LEADS SOMEWHERE (pressing its name opens the surface it summarises). Two targets on one
   * row is a deliberate exception to DESIGN_RULES rule 4 — see that component's header.
   * Omit it and the rail is inert, exactly as before, so a caller that wraps the whole header
   * in its own pressable is unaffected.
   */
  onLabelPress?: () => void;
  /** a11y label for `onLabelPress`. Defaults to `label`. */
  labelPressHint?: string;
  /**
   * Ref onto the rendered `count`, so a caller can MEASURE it (2026-08-22). One caller:
   * components/HomeShoppingCard.tsx flies a ticked row to this figure. It is not a styling or
   * content hook and nothing else should reach for it — a card's header is drawn from the
   * registry, and this hands out a node, not a decision.
   */
  countRef?: React.Ref<Text>;
  /**
   * Floor for the naming row's height (2026-08-10). Without it the row is only as tall as its
   * content, which made a rail whose name IS a tap target (`onLabelPress`, so the cluster
   * carries `MIN_TAP_TARGET`) permanently taller than one whose name is inert — visible as
   * components/CollapsedSection.tsx drawers sitting at two different closed heights on the same
   * screen (Whenever 50px next to Goals 73px). A caller that draws several rails as peers passes
   * one value for all of them; omit it and the row hugs its content exactly as before.
   */
  rowMinHeight?: number;
  /**
   * Separate the naming row from the body under it (2026-08-12; **the rule it used to draw is
   * deleted as of 2026-08-27**, so this is now spacing only — see the render site). Defaults to
   * true — every caller except a closed card/drawer wants it, since it is what holds the header
   * off the content it labels. Set false while that content isn't there to be held off from (a
   * folded card): the space was being reserved over nothing, which sat the title above the
   * centre of a closed card. The NAME is kept rather than renamed to `spaced` — every caller
   * reads correctly either way, and a rename would churn call sites for a word.
   */
  divider?: boolean;
  /**
   * Which level of heading this is (2026-08-21). See the header.
   *
   *   'group' (default) — over a stack of CARDS. 24px extrabold, and **no badge**: a heading
   *                       over cards that carries one reads as a card itself, which is what
   *                       every drawer and group header in the app did.
   *   'card'            — a CARD's own title. 20px, with the card's badge. Drawn only by
   *                       components/Card.tsx.
   *   'sub'             — over a stack of ROWS inside a card. 17px, a 6px dot; a badge here
   *                       would be a second badge inside a card that already has one.
   *
   * The three-rung ladder is decision (a) of the 2026-08-21 card pass. It existed as prose in
   * `subLabel`'s own note — *"17 is the rung below the 20 a CARD title takes and the 24 a GROUP
   * heading takes"* — while only two tiers existed, so every card title actually rendered at 24
   * and a group heading was indistinguishable from the cards under it.
   *
   * The tier changes only the naming row's WEIGHT. Everything else — the hue, the count, the
   * right slot, the divider, `onLabelPress` — behaves identically, which is the point: a
   * sub-header that gains a control later gains it in the same place as its parent.
   */
  tier?: 'group' | 'card' | 'sub';
  /**
   * One line under the title saying what is inside — "3 igjen · 1 gjort", "Ingen ennå denne
   * uken" (2026-08-27, round 20). **CARD tier only**, and ignored anywhere else.
   *
   * It replaces the bare `count` as the thing a CLOSED card tells you. A card resting shut with
   * a `0` beside its name reads as a score of zero on a surface the user has not filled in yet;
   * the same card saying "Ingen ennå denne uken" says what it is FOR. That is the round 20
   * mockup's own framing ("counts read as failure") and it is why this is content, not chrome.
   *
   * ⚠️ **It is a PROP, not registry data, and the distinction is the registry's own.** The
   * registry holds what a card LOOKS like — hue, badge, glyph, title, whether it folds. A peek
   * is live state, the same kind of thing `count` already is, so it arrives the same way. A
   * caller still cannot describe a card; it can only tell one what it currently holds.
   *
   * ⚠️ **There is a width budget and it is tight: ~180px at 360px.** The mockups this came from
   * truncated 7 of their 8 peeks in English, which is the shorter language — see
   * `DESIGN_COMPARISON/20-MEASUREMENTS.md`. Author to the budget and let
   * `scripts/measure-wraps.mjs` tell you; it fails on a truncating peek.
   */
  peek?: string;
  style?: StyleProp<ViewStyle>;
};

export default function SectionRail({ hue, domain, icon, label, count, countRef, right, badgeHue, onLabelPress, labelPressHint, rowMinHeight, divider = true, tier = 'group', peek, style }: Props) {
  const theme = useAppTheme();
  const t = useT();
  // A.4 rule 1 (2026-07-31): an identity hue is a FILL, never text. The dot/badge and the
  // hairline rule below already carry it; the heading itself is plain `text` so it is legible
  // at every hue, including the light Shopping gold. See the header note.
  const labelColor = theme.text;
  const sub = tier === 'sub';
  const isCard = tier === 'card';
  // ⚠️ **A peek belongs to the CARD rung and to a card that is CLOSED** — see the prop's doc.
  // Gating it here rather than at the call site is what stops a caller from putting a summary
  // line under a group heading or under a `sub` section's dot, neither of which has room for a
  // second storey.
  const showPeek = isCard && !!peek;
  /**
   * ⚠️ **A zero count is not drawn beside a peek (2026-08-27, round 20).**
   *
   * The peek exists because a card resting shut with a bare `0` scores the user zero on a
   * surface they have not filled in yet — round 20's own words, *"counts read as failure"*.
   * Drawing both put "Today 0" directly above "Nothing due today", which is the same number
   * twice: once as a verdict and once in words. Only the verdict goes.
   *
   * A NON-zero count stays, beside the peek, because that is a size and the rule has always been
   * "a size yes, a score no". And with no peek the count is drawn whatever it is — a card that
   * has opted out of saying what it holds has nothing else to say.
   */
  const countIsZero =
    count === 0 || (typeof count === 'object' && count !== null && count.left === 0 && count.total === 0);
  const showCount = count != null && !(showPeek && countIsZero);
  const titleLine = (
    <>
      <Text style={[sub ? styles.subLabel : isCard ? styles.cardLabel : styles.label, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
      {showCount && (
        // `countRef` is a MEASUREMENT hook, not anatomy — the one caller that needs it is
        // components/HomeShoppingCard.tsx, whose tick animation flies the row to this figure.
        // Nothing may style or replace the count through it.
        <Text
          ref={countRef}
          style={[styles.count, TabularNums, { color: theme.textMuted }]}
          // A sighted reader takes the noun from the title beside it; a screen reader
          // announcing a bare "3/7" has lost it. `t.pad.summary` is the wording the count
          // pills carried before they moved into the card header, kept for exactly this.
          // A plain total needs no gloss — it is a size, and the title says of what.
          accessibilityLabel={typeof count === 'number' ? undefined : t.pad.summary(count.left, count.total)}
        >
          {typeof count === 'number' ? count : `${count.left}/${count.total}`}
        </Text>
      )}
    </>
  );
  const naming = (
    <>
      {/* A badge belongs to the CARD rung only — a group heading over a stack of cards that
          carries one reads as a card itself, which is what every drawer in the app did. A `sub`
          section takes a 6px dot; a group heading takes nothing at all. */}
      {domain && isCard ? (
        <CardAccentBadge domain={domain} icon={icon} size={24} accentOverride={badgeHue ? hue : undefined} />
      ) : sub ? (
        <View style={[styles.subDot, { backgroundColor: hue }]} />
      ) : null}
      {/* ⚠️ **One line (2026-08-21), which REVERSES the "let it wrap" note that stood here.**
          The old reasoning was that a section's name must never be clipped, so it should wrap
          and let `flexShrink` keep it off the trailing controls. Measured against the Catalogue
          card — badge, title, count, camera, lock, fold and ⤢ in one row — wrapping is the
          worse of the two failures: the header becomes two storeys and the card's rhythm breaks,
          where an ellipsis costs a few characters of a name the card is already showing the
          contents of.
            It also makes this agree with the app's own card titles: HomeHealthCard,
          HomeMedicineCard, HomeHabitsCard and HomeNotesCard all pass `numberOfLines={1}`, so
          SectionRail was the one header that behaved differently. `flexShrink: 1` +
          `minWidth: 0` on the label style is still what lets it yield at all — without that pair
          it pushes the controls off the row instead of truncating (AGENTS.md's wrap-audit note:
          flexShrink alone does not do it). */}
      {showPeek ? (
        // ⚠️ **Two storeys ONLY when there is a peek to draw.** With no peek the title and the
        // count stay bare children of `row` — byte-for-byte the layout every card had before
        // this existed. A column wrapper around a single line is not free: it changes how
        // `flexShrink` reaches the label, and every card's header geometry was settled against
        // the flat arrangement (see the one-line note above, which was measured on Katalog).
        <View style={styles.titles}>
          <View style={styles.titleLine}>{titleLine}</View>
          {/* `testID` is how `scripts/measure-wraps.mjs` finds a peek to measure it. The width
              budget here is ~28 characters and the mockups this came from broke it 7 times in 8,
              so the guard has to be able to name the element rather than guess at it by size. */}
          <Text testID="card-peek" style={[styles.peek, { color: theme.textMuted }]} numberOfLines={1}>
            {peek}
          </Text>
        </View>
      ) : (
        titleLine
      )}
    </>
  );
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.row, rowMinHeight != null && { minHeight: rowMinHeight }]}>
        {onLabelPress ? (
          // `flexShrink` so the naming cluster yields to the right-hand control rather than
          // pushing it off the row — the chevron/toggle has a fixed width and none to give.
          <PressableScale
            onPress={onLabelPress}
            style={styles.naming}
            accessibilityRole="button"
            accessibilityLabel={labelPressHint ?? label}
          >
            {naming}
          </PressableScale>
        ) : (
          naming
        )}
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {/* **No hairline under a card header (2026-08-27, round 20).** The rule used to be drawn
          here in `rgba(hue, 0.25)`; the mockup's "stray artefacts" list has it alongside the
          loose dots, and the replacement is spacing rather than another line: *"separation comes
          from the body's offset, not a line"*. Deleting the View is the whole change — the
          header→body gap becomes `container`'s own `marginBottom` (Spacing.sm, 8px, against the
          mockup's 9), where it was 4 + 1 + 8 = 13 with the rule in it.
            `divider` SURVIVES as a prop, and that is deliberate: components/Card.tsx passes
          `divider={!isClosed}`, which is what still cancels that gap on a folded card, and
          "closed is a bare header" is a construction the card system depends on
          (lib/__tests__/cardAnatomy.test.ts). What changed is that the prop now controls only
          the space, not a rule — see `container`'s note below. */}

    </View>
  );
}

const styles = StyleSheet.create({
  // Full-width so the hairline rule spans the header; the tighter gap keeps the header
  // close to the card stack it labels instead of floating detached above it.
  container: { alignSelf: 'stretch', marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // The badge+label+count cluster when it is its own tap target (`onLabelPress`). minWidth:0
  // is what actually lets the label truncate instead of shoving the chevron off the row —
  // flexShrink alone doesn't (AGENTS.md's wrap-audit note).
  naming: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
    minWidth: 0,
    minHeight: MIN_TAP_TARGET,
  },
  // The 10px `dot` is gone (2026-08-21): it was the group tier's badge-less fallback, and the
  // group tier draws no mark at all now. A card takes a badge, a section takes `subDot`.
  // Unified card/section header title (2026-07-19): sentence case, bold — reads unmistakably
  // as a header. Was a hardcoded 20/25 until 2026-08-15.
  //
  // ── Tactile Glass, 2026-08-15 ─────────────────────────────────────────────────────────────
  // Promoted to `FontSize.xl` (24) extrabold, and moved onto the TOKEN — a bare 20 in a
  // StyleSheet was invisible to the type scale and to the design lab's font pass alike. The
  // brief: *"Use a massive, bold font weight for section headers (iOS style) to guide the eye,
  // rather than drawing boxes around lists."* That second clause is why this is part of the
  // same change as PadSheet's de-boxing rather than a cosmetic bump — the boxes that used to
  // group rows are gone, so the header has to be strong enough to do the grouping on its own.
  // Against 17px body this is a real step; at 20 it was not.
  //
  // ⚠️ The SCREEN title (`HEADER_TITLE_BASE_SIZE`) deliberately did NOT move with it, so this
  // now equals it at 24. That is not an oversight and not a hierarchy inversion: the two live
  // on different planes — the screen title sits in the floating header chrome, extrabold, in
  // its own band, while this sits in content. Raising the screen title is what re-creates a
  // MEASURED bug: it was dialled 28 → 24 on 2026-07-24 specifically so Shopping's 11-character
  // extrabold "HANDLELISTE" fits on one line beside that screen's 5-icon control row without
  // the per-screen autosize shrink hack that pass deleted. Anything above 24 walks back into
  // it. See constants/theme.ts's note above that constant before trying.
  label: {
    fontSize: FontSize.xl,
    lineHeight: 30,
    fontFamily: Fonts.extrabold,
    // ⚠️ **`flexShrink` + `minWidth: 0`, or the right-hand controls get pushed off the row**
    // (2026-08-21). The `naming` CLUSTER carries this pair when `onLabelPress` makes it a
    // pressable, but without that prop the badge/label/count are bare children of `row` and
    // nothing yielded — so the Catalogue card, whose header carries four controls (camera,
    // lock, fold, ⤢), drew its ⤢ sliced off at the card's edge the moment the fold chevron
    // joined. `flexShrink` alone does not do it; the `minWidth: 0` is what actually lets a
    // text box narrow below its content — AGENTS.md's wrap-audit note, learned on the task
    // editor's title field.
    flexShrink: 1,
    minWidth: 0,
  },
  /**
   * The card-title rung: `Type.heading` (20), with the card's badge beside it.
   *
   * It is the middle of the three, and it is the size four of the Me tab's cards were already
   * hand-rolling at (`fontSize: 20, lineHeight: 25`, spelled out in five files) while the four
   * `SectionCard`s on To-do drew 24 for the same job. Both are through here now.
   */
  cardLabel: {
    fontSize: Type.heading.size,
    lineHeight: Type.heading.size * Type.heading.line,
    fontFamily: Type.heading.fontFamily,
    flexShrink: 1,
    minWidth: 0,
  },
  count: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  /**
   * The two-storey naming column — title line over peek line. Mounted ONLY when a peek exists.
   *
   * It carries the `flexShrink: 1` + `minWidth: 0` pair that the label carries in the flat
   * arrangement, because with the column in place the label's own pair now only lets it yield
   * inside `titleLine`; without it here the COLUMN is what refuses to narrow and shoves the
   * trailing controls off the row — the same failure the one-line note above describes, one
   * level out.
   */
  titles: { flexShrink: 1, minWidth: 0, gap: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minWidth: 0 },
  /**
   * ⚠️ `FontSize.xs` (13), not the mockup's 12.5 — a half-pixel is not on the type scale, and
   * the caption rung is what this is. One line, always: a peek that wrapped would make the card
   * header a variable height and undo `Card`'s `rowMinHeight`, which exists so every header is
   * the same height whether or not its title is pressable.
   */
  peek: { fontSize: FontSize.xs, lineHeight: 17, fontFamily: Fonts.medium },
  subDot: { width: 6, height: 6, borderRadius: 3 },
  /**
   * The sub tier's heading: `Type.subheading`, sentence case.
   *
   * ⚠️ **This is the ONE in-card section heading, and the value was picked by counting rather
   * than by taste** (2026-08-21, CONSISTENCY_AUDIT.md §2). A heading over a stack of rows
   * INSIDE a card shipped at four sizes — 17 in `HealthSurface`'s "This week" and
   * `HabitsSurface`, 20 in `FoodTab`'s meal sections, 13 uppercase on Shop's week sections.
   * 17 is the rung below the 20 a CARD title takes and the 24 a GROUP heading takes, and two
   * of the four were already on it, so it is where the others come to rather than a fifth
   * value invented to split the difference.
   *
   * Sentence case, not the uppercase the week sections had: the 2026-07-28 design review put
   * ALL-CAPS back to ≤13px labels only, and this is 17.
   */
  subLabel: {
    fontSize: Type.subheading.size,
    lineHeight: Type.subheading.size * Type.subheading.line,
    fontFamily: Type.subheading.fontFamily,
    flexShrink: 1,
    minWidth: 0,
  },
  // ⚠️ **A ROW, not a bare View (2026-08-20).** This was `{ marginLeft: 'auto' }` alone, so a
  // slot given more than one control stacked them vertically — a card header with the camera,
  // the lock and ⤢ came out as a three-storey column with the title beside the top one.
  // components/SectionCard.tsx had hit this already and worked around it locally, wrapping its
  // fold chevron and the caller's control in a row of its own; that workaround is deleted now
  // that the slot itself lays out correctly, and the fix reaches every other caller too.
  // `alignItems: 'center'` so a short control lines up with a tall one rather than stretching.
  // `flexShrink: 0` so the control cluster keeps its size and the LABEL yields instead — a
  // stepper/icon row has no width to give, which is the rule the 2026-07-28 wrap pass settled
  // (let the label yield, never the fixed-size control).
  right: { marginLeft: 'auto', flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  // ⚠️ **The header→body gap is `container`'s `marginBottom` and nothing else (2026-08-28).**
  // Until now a `spacer` View added `Spacing.xs` on top of it whenever `divider` was true, so
  // the real gap was 12px — while round 20's own note claimed it was already "the container's
  // marginBottom alone (8, against the mockup's 9)". The View was left behind when that pass
  // deleted the hairline it used to carry; this deletes it, which is what makes the code agree
  // with the sentence written about it, and takes 4px off every card AND every embedded section
  // on every screen.
  //   `divider` SURVIVES as a prop and still means "is a body drawn below this header": it is
  // what `styles.railClosed` in components/Card.tsx keys off to cancel the gap entirely on a
  // folded card, so "closed is a bare header" stays true by construction.
});
