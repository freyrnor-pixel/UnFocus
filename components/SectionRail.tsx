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
 *     review moved uppercase back to ≤13px labels only) over a hairline rule tinted
 *     `rgba(hue, 0.25)` — NOT a filled pill (that soft-plate look was dropped). Pass a solid
 *     accent, not an already-translucent colour.
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
import { Fonts, FontSize, MIN_TAP_TARGET, rgba, Spacing, TabularNums } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
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
  /** Optional item tally shown after the label. */
  count?: number;
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
   * Floor for the naming row's height (2026-08-10). Without it the row is only as tall as its
   * content, which made a rail whose name IS a tap target (`onLabelPress`, so the cluster
   * carries `MIN_TAP_TARGET`) permanently taller than one whose name is inert — visible as
   * components/CollapsedSection.tsx drawers sitting at two different closed heights on the same
   * screen (Whenever 50px next to Goals 73px). A caller that draws several rails as peers passes
   * one value for all of them; omit it and the row hugs its content exactly as before.
   */
  rowMinHeight?: number;
  /**
   * Draw the hairline rule under the naming row (2026-08-12). Defaults to true — every
   * caller except a closed `components/CollapsedSection.tsx` wants it, since it's what ties
   * the header to the content it labels. Set false while that content isn't there to be tied
   * to (a collapsed drawer): the rule was rendering over nothing, right above the drawer's
   * own closed-state padding, which read as a stray line under a header with no card below it.
   */
  divider?: boolean;
  /**
   * Which level of heading this is (2026-08-21). See the header.
   *
   *   'group' (default) — over a stack of CARDS. 24px extrabold, a 24px badge or a 10px dot.
   *   'sub'             — over a stack of ROWS inside one of those groups. Small, uppercase,
   *                       a 6px dot; a badge here would be a second badge inside a card that
   *                       already has one.
   *
   * The tier changes only the naming row's WEIGHT. Everything else — the hue, the count, the
   * right slot, the divider, `onLabelPress` — behaves identically, which is the point: a
   * sub-header that gains a control later gains it in the same place as its parent.
   */
  tier?: 'group' | 'sub';
  style?: StyleProp<ViewStyle>;
};

export default function SectionRail({ hue, domain, icon, label, count, right, badgeHue, onLabelPress, labelPressHint, rowMinHeight, divider = true, tier = 'group', style }: Props) {
  const theme = useAppTheme();
  // A.4 rule 1 (2026-07-31): an identity hue is a FILL, never text. The dot/badge and the
  // hairline rule below already carry it; the heading itself is plain `text` so it is legible
  // at every hue, including the light Shopping gold. See the header note.
  const labelColor = theme.text;
  const sub = tier === 'sub';
  const naming = (
    <>
      {domain && !sub ? (
        <CardAccentBadge domain={domain} icon={icon} size={24} accentOverride={badgeHue ? hue : undefined} />
      ) : (
        <View style={[sub ? styles.subDot : styles.dot, { backgroundColor: hue }]} />
      )}
      {/* No `numberOfLines` — a section's own NAME is the one thing on the row that must not be
          clipped, so it wraps instead. `naming`'s `flexShrink: 1` + `minWidth: 0` is what keeps
          it from pushing the right-hand control off the row, which is the job a 1-line cap
          would otherwise be doing. (It was briefly capped at 1 line when `onLabelPress` landed
          on 2026-08-10 — an unforced change, reverted the same day.) */}
      <Text style={[sub ? styles.subLabel : styles.label, { color: labelColor }]}>{label}</Text>
      {count != null && (
        <Text style={[styles.count, TabularNums, { color: theme.textMuted }]}>{count}</Text>
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
      {divider && <View style={[styles.divider, { backgroundColor: rgba(hue, 0.25) }]} />}
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
  dot: { width: 10, height: 10, borderRadius: 5 },
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
  count: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  subDot: { width: 6, height: 6, borderRadius: 3 },
  // The sub tier's heading. Uppercase at this size is the app's own rule — the 2026-07-28
  // design review moved ALL-CAPS back to ≤13px labels only, which is exactly this row and
  // exactly not the one above it.
  subLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  divider: { height: StyleSheet.hairlineWidth, marginTop: Spacing.xs },
});
