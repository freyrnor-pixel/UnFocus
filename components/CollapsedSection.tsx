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
 *   - `count` is optional and should be omitted where a tally reads as a score rather than a
 *     size (see the app's standing no-scoreboard rule) — Earlier days passes none. Food and
 *     Catalogue do pass one: how many dishes or known items a library holds is a size.
 *   - `Spring.calm` on the header press is inherited from the original: a repeatedly-tapped
 *     accordion header wants the least energetic release available. It is inert while
 *     PressableScale is in key mode, kept so a caller switching to `press="scale"` still gets it.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Surface from '@/components/Surface';
import SectionRail from '@/components/SectionRail';
import AnimatedChevron from '@/components/AnimatedChevron';
import Collapsible from '@/components/Collapsible';
import PressableScale from '@/components/PressableScale';
import { HitSlop, MIN_TAP_TARGET, Radius, Spacing } from '@/constants/theme';
import { Spring } from '@/constants/motion';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';

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
  const [open, setOpen] = useState(false);
  const toggle = () => { tap(); setOpen((v) => !v); };

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
    <Surface style={[styles.section, open ? styles.sectionOpen : styles.sectionClosed]}>
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
      {/* No gap between the header and the clip — SectionRail carries its own marginBottom, and
          a gap would leave a phantom blank strip while collapsed (same reason plans.tsx's
          doneZone has none). The card's own bottom padding is switched on `open` for the same
          reason: collapsed, the body clips to 0 and a full Spacing.md under the header rule
          reads as an empty card rather than a folded one. */}
      <Collapsible open={open}>
        <View style={styles.body}>{children}</View>
      </Collapsible>
    </Surface>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  sectionOpen: { paddingBottom: Spacing.md },
  sectionClosed: { paddingBottom: Spacing.xs },
  chevronBtn: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  body: { gap: Spacing.sm },
});
