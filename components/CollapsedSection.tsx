/**
 * CollapsedSection.tsx — a section drawn as a DRAWER: a `<SectionRail>` header (hue badge +
 * label + count) that stays visible, with its body collapsing behind a chevron. Default closed.
 *
 * Mechanism is deliberately the same one `DoneSplitList`'s "Done (n)" zone uses —
 * `PressableScale` + `SectionRail` + `AnimatedChevron` + `components/Collapsible` — so the two
 * read as the same kind of drawer rather than two different ways of folding a list away. The
 * only difference is the shell: this one keeps `Surface`'s hue-edged card (matching the
 * `<SectionCard>` sections it sits among) instead of the Done zone's inner frame, because it is
 * a top-level section of a screen, not a zone inside one.
 *
 * Connections:
 *   Imports → components/Surface, components/SectionRail, components/AnimatedChevron,
 *             components/Collapsible, components/PressableScale, constants/theme,
 *             constants/motion (Spring.calm), lib/haptics, lib/i18n, lib/useAppTheme
 *   Used by → app/(tabs)/plans.tsx (Whenever, Goals, Earlier days),
 *             app/(tabs)/habits.tsx (Goals), app/(tabs)/shopping.tsx (Food, Catalogue)
 *   Data    → none — presentational; the caller owns the body and both press handlers.
 *
 * Edit notes:
 *   - **Lifted out of app/(tabs)/plans.tsx on 2026-08-10.** It was a local function component
 *     there, used only for **Whenever** (2026-08-01, DESIGN_RULES.md rule 7: the undated backlog
 *     is by definition the least time-sensitive thing on a tab called "Today", so it moved below
 *     the day's own list — and once below, a drawer keeps its count in reach without spending a
 *     screenful on rows nobody came here for). The All-tasks tab still keeps Whenever expanded
 *     at the top, where it is a real section of the content. Whenever's rendering is unchanged
 *     by the move — it passes no `onTitlePress`, which is the pre-2026-08-10 shape exactly.
 *   - **`onTitlePress` — why a section header has TWO tap targets.** Maintainer, 2026-08-10:
 *     *"Goals and Previous days should be like the 'Whenever' card with expandability, and
 *     pressing the name gives you a pop-up. This is to stay consistent across app."* So the
 *     naming cluster (badge + label + count) opens the surface this section summarises, and the
 *     chevron expands a preview of it in place. Both are ≥ `MIN_TAP_TARGET`; the chevron is a
 *     real button rather than a decoration whenever `onTitlePress` is set.
 *     This is a deliberate, instructed exception to **DESIGN_RULES rule 4** ("one idea per
 *     row") — and a narrow one: the two targets are the same idea at two depths (look at it
 *     here / go to it), not two unrelated controls sharing a line. Don't generalise it into
 *     "section headers can carry a second control".
 *     **Goals dropped its half of this on 2026-08-12** (maintainer: "This should not be a
 *     pop-up. Examples included in card just like other cards, and making, editing and
 *     deleting in the card, not a pop up.") — its two callers now pass no `onTitlePress`, so
 *     the Goals drawer has one tap target like Whenever; only Earlier days still opens a
 *     pop-up (a day picker, genuinely a "pick one and navigate" job). `onTitlePress` itself
 *     is untouched — it's still there for any surface whose destination really is a pop-up.
 *   - **It replaced components/SubScreenLinkButton.tsx** (deleted 2026-08-10), which drew the
 *     same job as a small icon + label + chevron ROW inside a grouping card. That shape was
 *     added 2026-08-08 to stop three same-sized white cards reading as three sections of the
 *     screen — a real problem, solved by making the links visibly smaller than a section. The
 *     complaint now is the other end of the same axis: a link that is only a row can't show you
 *     anything, so a destination you visit often is a permanent round trip. A drawer answers
 *     both — it is unmistakably a door (chevron + a name that goes somewhere) AND it can show
 *     what's behind it. `app/(tabs)/shopping.tsx`'s hand-rolled two-tile Food/Catalogue row was
 *     a THIRD shape for the same job; it is gone too. One shape now — keep it that way.
 *   - **The badge wears `hue`, not `domain`'s identity colour (2026-08-10, `badgeHue`).** Every
 *     caller passes the SCREEN's hue, so the rail used to disagree with its own badge: Goals on
 *     Habits was a green flag in a sky card over a sky divider, and the same drawer on To-do
 *     was indigo. Card, rule and badge are one colour here; `domain` still picks the glyph.
 *   - **The body can be the destination itself, not a summary of it (2026-08-10).** Shopping's
 *     two drawers mount the real `components/FoodTab.tsx` / `components/CatalogueTab.tsx` in
 *     their `embedded` mode; `components/SubScreenPreviewList.tsx`, which drew names-only rows
 *     for both, is deleted. That is a change to what callers PASS, not to this component — the
 *     card, the rail, the chevron and the two tap targets are untouched, and "one shape now"
 *     still holds. Two things a caller owes the drawer if it mounts a real surface: the body
 *     must not bring its own scroll (this sits inside the screen's), and it should unwrap any
 *     `Surface` of its own, since a Surface inside this one reads as a nested panel.
 *   - **One closed height, and the header centred in it (2026-08-10).** Maintainer: make
 *     unexpanded cards the same size, and centre the thing inside the thing. Measured on the
 *     To-do tab, the closed drawers were **50px (Whenever) next to 73px (Goals, Earlier days)**
 *     — same shape, same screen, two sizes — because `SectionRail`'s naming cluster only claims
 *     `MIN_TAP_TARGET` when it IS a tap target (`onLabelPress`). The drawer that leads nowhere
 *     was simply shorter. `rowMinHeight` puts that floor on the rail's row for every drawer, so
 *     the six read as peers; the tappable ones are unchanged, the inert one grows to match.
 *     Whenever grows rather than the others shrinking — the tappable name is a real button and
 *     cannot go under `MIN_TAP_TARGET` (DESIGN_RULES rule 17).
 *     Two spacing faults fell out of the same measurement, both only in the CLOSED state:
 *     the card was padded `Spacing.sm` top against `Spacing.xs` bottom, and `SectionRail`'s
 *     `marginBottom` hung 8px of blank card under the hairline rule with the body clipped to 0.
 *     Closed, the header is the card's ONLY content, so it is centred: matching vertical padding
 *     and no trailing margin. **The open state deliberately keeps its asymmetry** — open, this
 *     is a header above a body and follows `components/SectionCard.tsx`'s documented
 *     top-hugging convention (`Spacing.sm` above, `Spacing.md` below). Don't "fix" that one to
 *     match; a header with content under it is not a thing centred in a box.
 *   - **The closed↔open padding/margin swap from the note above is now ANIMATED, on the same
 *     clock as the Collapsible body (2026-08-11, user report: "movement of buttons while
 *     expanding and closing, and its not smooth").** Both `section`'s paddingBottom and the
 *     rail's marginBottom used to switch instantly the moment `open` flipped — a plain
 *     `open ? A : B` — while the body took a full Duration.card/cardOut to actually reveal, so
 *     the header/chevron visibly jumped ahead of the content it's paired with. Fix: `section`'s
 *     paddingBottom is now a constant (the old closed value); the delta that used to live in
 *     `sectionOpen` moved onto `body`'s own paddingBottom, so it reveals WITH the content
 *     because it's inside the same Collapsible; and the rail's marginBottom is driven by a
 *     locally-owned `railProgress` shared value (`useSharedValue`+`withTiming`, same
 *     Duration/Ease tokens Collapsible.tsx uses internally) via a wrapping `Animated.View`,
 *     rather than switching on the `SectionRail`'s own `style` prop. Same bug shape TaskCard's
 *     Advanced-options toggle/Save-row and PadFooterToggle's pad-state cycle had — see their
 *     own edit notes.
 *   - `count` is optional and should be omitted where a tally reads as a score rather than a
 *     size (see the app's standing no-scoreboard rule) — Earlier days passes none. Food and
 *     Catalogue do pass one: how many dishes or known items a library holds is a size.
 *   - `Spring.calm` on the header press is inherited from the original: a repeatedly-tapped
 *     accordion header wants the least energetic release available. It is inert while
 *     PressableScale is in key mode, kept so a caller switching to `press="scale"` still gets it.
 *   - **The rail's hairline rule is hidden while closed (2026-08-12).** `SectionRail`'s
 *     `divider` prop defaults to true and drew unconditionally, so a closed drawer showed a
 *     rule under its header with nothing below it — the body is 0 height when `!open`. Passed
 *     as `divider={open}` now, so it reappears with the rest of the reveal.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Surface from '@/components/Surface';
import SectionRail from '@/components/SectionRail';
import AnimatedChevron from '@/components/AnimatedChevron';
import Collapsible from '@/components/Collapsible';
import PressableScale from '@/components/PressableScale';
import { HitSlop, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { Duration, Ease, Spring } from '@/constants/motion';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';

type Props = {
  /** Solid hue for the rail's badge/dot and hairline rule. */
  hue: string;
  /** Domain identity — swaps the flat dot for a gradient badge. */
  domain?: React.ComponentProps<typeof SectionRail>['domain'];
  /** Override the badge glyph while keeping `domain`'s colour. */
  icon?: React.ComponentProps<typeof SectionRail>['icon'];
  label: string;
  /** Optional tally after the label. Omit where a number would read as a score. */
  count?: number;
  /**
   * Pressing the section's NAME opens the surface it summarises (a sheet, or a pushed screen
   * where the destination is a whole library). When set, the chevron becomes the expand
   * control on its own; when omitted, the whole header toggles — see the Edit notes.
   */
  onTitlePress?: () => void;
  /** a11y label for `onTitlePress`, e.g. "Open Goals". Defaults to `label`. */
  titlePressHint?: string;
  children: React.ReactNode;
};

export default function CollapsedSection({
  hue,
  domain,
  icon,
  label,
  count,
  onTitlePress,
  titlePressHint,
  children,
}: Props) {
  const theme = useAppTheme();
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const [open, setOpen] = useState(false);
  const toggle = () => { tap(); setOpen((v) => !v); };

  // Drives the rail's own bottom margin on the SAME clock the Collapsible body below it
  // animates on (2026-08-11, user report: "movement of buttons while expanding and closing,
  // and its not smooth"). Both used to be independent: this margin snapped to its new value
  // the instant `open` flipped, while the body took ~Duration.card/cardOut to actually reveal
  // — so the header/chevron jumped ahead of (or lagged behind) the content it's paired with.
  // Same Duration/Ease tokens Collapsible.tsx uses internally, so the two tracks move together
  // even though they're two separate shared values.
  const railProgress = useSharedValue(open ? 1 : 0);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (reducedMotion) { railProgress.value = open ? 1 : 0; return; }
    railProgress.value = withTiming(open ? 1 : 0, {
      duration: open ? Duration.card : Duration.cardOut,
      easing: open ? Ease.enter : Ease.exit,
    });
  }, [open, reducedMotion, railProgress]);
  const railAnimStyle = useAnimatedStyle(() => ({ marginBottom: railProgress.value * Spacing.sm }));

  const chevron = <AnimatedChevron open={open} size={16} color={theme.textMuted} />;
  const header = (
    <SectionRail
      hue={hue}
      domain={domain}
      // The badge wears `hue` — which every caller sets to the SCREEN's hue — not the domain's
      // own identity colour (2026-08-10, user report "wrong coloring" against the Goals drawer
      // on Habits). It was drawing a `#218432` green flag inside a `#22A7E0` sky card, above a
      // sky-tinted divider; the identical Goals drawer on To-do drew the same flag indigo, so
      // one destination had two colours depending on where you opened it from. This is a
      // drawer onto another surface, not a domain-coded row, so the card, its rule and its
      // badge are one colour — the same call the 2026-08-06 `accentOverride` pass already made
      // for the Home preview cards, WeekListCard and the Medicine card. `domain` is still what
      // chooses the default GLYPH.
      badgeHue
      icon={icon}
      label={label}
      count={count}
      onLabelPress={onTitlePress}
      labelPressHint={titlePressHint}
      // Every drawer's naming row is one height whether or not its name is a tap target, so
      // the closed cards on a screen are peers. See the "one closed height" edit note.
      rowMinHeight={MIN_TAP_TARGET}
      // Closed, the drawer's body is 0 height — the hairline rule would sit right above
      // nothing, reading as a stray line under a header with no card below it. It comes back
      // the moment the body opens, in step with the rest of the reveal (see railAnimStyle).
      divider={open}
      // The rail's own bottom margin is always killed now — the wrapping Animated.View below
      // supplies it instead, animated in step with the Collapsible reveal (see railAnimStyle).
      // It used to switch here directly (`open ? undefined : styles.railClosed`), which is
      // exactly the instant-snap-beside-a-smooth-reveal mismatch this pass fixes.
      style={styles.railClosed}
      right={
        onTitlePress ? (
          // A real button, not a glyph: with the name taking its own presses, this is the only
          // thing left that expands the drawer.
          <PressableScale
            onPress={toggle}
            hitSlop={HitSlop.base}
            style={styles.chevronBtn}
            accessibilityRole="button"
            accessibilityLabel={open ? t.collapseListLabel : t.expandListLabel}
            accessibilityState={{ expanded: open }}
          >
            {chevron}
          </PressableScale>
        ) : (
          chevron
        )
      }
    />
  );

  return (
    // No `borderColor` — same reasoning as components/SectionCard.tsx: the card edge is the
    // screen's one hue now, and `hue` stops at the rail header (2026-08-05). A collapsed section
    // and an open one have to wear the same border, or folding one would change its colour.
    // paddingBottom is now a CONSTANT Spacing.sm regardless of `open` (was `sectionOpen`/
    // `sectionClosed`, switching instantly on toggle) — the extra room open needs lives inside
    // the Collapsible's own body now (see `body`'s paddingBottom), so it reveals with the
    // content instead of snapping ahead of it.
    <Surface style={styles.section}>
      <Animated.View style={railAnimStyle}>
        {onTitlePress ? (
          header
        ) : (
          <PressableScale
            onPress={toggle}
            scaleTo={0.97}
            releaseSpring={Spring.calm}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ expanded: open }}
          >
            {header}
          </PressableScale>
        )}
      </Animated.View>
      <Collapsible open={open}>
        <View style={styles.body}>{children}</View>
      </Collapsible>
    </Surface>
  );
}

const styles = StyleSheet.create({
  // paddingBottom is the CLOSED value always (Spacing.sm, matching paddingTop so a closed
  // drawer is centred) — see the return statement's note for why open's extra room moved
  // inside the Collapsible body instead of switching here.
  section: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  // Always-on now — the animated wrapper (railAnimStyle) supplies the open-state margin back,
  // in step with the Collapsible reveal. See the "one closed height" edit note for why this
  // margin exists at all (a dead strip under the hairline rule with the body clipped to 0).
  railClosed: { marginBottom: 0 },
  chevronBtn: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  // paddingBottom carries the delta between the old closed (Spacing.sm) and open (Spacing.md)
  // card padding — Spacing.sm of it lives on `section` unconditionally, this makes up the rest.
  // Because it's inside the Collapsible, it reveals/hides WITH the content instead of the card
  // snapping to its full open padding the instant `open` flips (2026-08-11 fix).
  body: { gap: Spacing.sm, paddingBottom: Spacing.md - Spacing.sm },
});
