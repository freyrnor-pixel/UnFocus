/**
 * CardAccent.tsx — the "one colour move" for a domain-coded card (2026-07-19 Card accent system;
 * badge flattened 2026-07-24, re-gradiented 2026-07-26, wash DELETED 2026-07-31 — see Edit notes).
 *
 * A card borrows its identity colour from the four-hue identity set (lib/domainColor.ts), keyed to
 * its life area, and expresses it as ONE colour move: a gradient icon BADGE. The card's own
 * low-alpha edge (Surface's `borderColor`) is the only other place that hue appears. Action colour
 * (Save=primary, Delete=danger) is deliberately NOT here — it stays constant across every card so it
 * never competes with identity colour.
 *
 * One part now:
 *   - <CardAccentBadge domain icon? size? /> — a round two-stop gradient badge (the domain's
 *     `badgeGradient`) with the palette's declared ink for the glyph and a light rim. Drop it as a
 *     leading element in any card/section header.
 *
 * Connections:
 *   Imports → @expo/vector-icons (Ionicons), expo-linear-gradient, constants/theme (Radius),
 *             lib/useAppTheme, lib/domainColor (Domain, getDomainColor, badgeGradientFor,
 *             BADGE_ICON_INK)
 *   Used by → components/HomeShoppingCard, components/HomeNotesCard, components/HomeHabitsCard,
 *             components/PlanTaskCard, components/WeekListCard, components/MedicineTrayCard,
 *             components/SectionRail, app/(tabs)/health.tsx,
 *             app/(tabs)/shopping.tsx (all import CardAccentBadge as a named export)
 *   Data    → none (presentational; colour derived from the active palette)
 *
 * Edit notes:
 *   - The domain→icon map lives here (DOMAIN_ICON) — filled Ionicons, reusing the nav's per-section
 *     glyphs where they overlap (cart/calendar/heart). With identity collapsed to FOUR hues
 *     (2026-07-31, addendum A.3) the GLYPH is what tells two same-hue cards apart, so domains
 *     sharing a hue must keep clearly different silhouettes: shop=cart vs meal=restaurant vs
 *     budget=wallet all ride the Shopping gold; task=checkmark-circle vs plan=calendar both ride
 *     the To-do blue. Never assign two same-hue domains near-identical glyphs.
 *   - (2026-07-24) Badge flattened to a flat `domainColor.soft` circle + `accent` glyph/border — the
 *     complaint was the gradient sticker reading as a separate object stacked on the wash.
 *   - **(2026-07-26) Re-gradiented**: as part of a broader "bring the card colour back" pass (Surface's
 *     EDGE_WIDTH also widened 1.5→2.5 the same day), the flat badge was judged too colourless — it and
 *     the thin card edge were the two places the 2026-07-18→07-24 redesign sprint had progressively
 *     drained identity colour out of cards. Badge is back to the pre-07-24 two-stop `badgeGradient`
 *     fill with a translucent white rim (the original 2026-07-19 recipe, not a new design).
 *   - **(2026-07-31, addendum A.4) The glyph is `ink`, never a hardcoded `#FFFFFF`.** The badge glyph
 *     used to be literal white regardless of the fill under it. On the Shopping identity hue
 *     (#D9A441) that is **2.25:1** — below even the 3:1 non-text-contrast floor (WCAG 1.4.11) — which
 *     is precisely why `IDENTITY_HUES.shopping` declared DARK ink for years. **Superseded
 *     2026-08-11 — see the addendum below: `ink` is white again, but this time because the FILL
 *     was changed to support it, not because contrast was ignored again.** Still never put a
 *     literal colour on the glyph without a `badgeGradientFor()` fill under it.
 *   - **(2026-07-31, addendum A.4 rule 3) `CardAccentWash` is DELETED.** A card was carrying its hue
 *     three times — badge + header wash + edge — for one idea. Badge and edge stay; the wash and its
 *     four call sites (HomeNotesCard, HomeHabitsCard, HomeShoppingCard, PlanTaskCard) are gone, along
 *     with the mask-corner math (`radius - GLASS_EDGE_WIDTH`, 2026-07-27) that existed only to hide
 *     the band's corner crescent, and this file's imports of `components/Surface` and
 *     `store/useSettingsStore` with it. `getDomainColor().washTop` still exists in lib/domainColor.ts
 *     with no consumers because an existing CI test pins it — do NOT wire it back to anything.
 *   - Also removed (2026-07-26) the unused default `CardAccent` export — it had zero importers.
 *   - **(2026-08-10) The two-tone badge was proposed AGAIN and declined again — maintainer's
 *     call.** The proposal: a 10–15% opacity hue fill with the glyph in the 100% solid hue. That
 *     is the 2026-07-24 design in the note above, near enough verbatim — `domainColor.soft` IS
 *     `rgba(accent, 0.14)` — and it was reverted two days later as "too colourless". Read that
 *     note before proposing it a fourth time.
 *     There is now a second, independent reason on the record: **a fixed opacity cannot hold
 *     across eight hues and two modes.** Measured at a 12% fill, the glyph clears 3:1 on three
 *     of five sample hues and fails on the rest — amber 2.81:1 in light, sapphire 2.68:1 in
 *     dark. Deriving the ink with `contrastOn()` against the actual fill, which is what this
 *     file already does, is not a stylistic preference over the two-tone recipe; it is the part
 *     that makes the badge legible at all. Any future two-tone attempt must derive its fill
 *     opacity per hue AND per mode, and must add itself to `lib/__tests__/colors.test.ts`.
 *     (The same 2026-08-10 ruling DID adopt the proposal's palette direction — the eight `feat*`
 *     screen hues went a step deeper. That is a border change and does not reach this file.)
 *   - **(2026-08-11) The glyph is white on EVERY badge, including Shopping's gold.** Maintainer
 *     report: badges read inconsistent card to card ("some color and black, some color and
 *     white"). The three prior attempts at an all-white badge (2026-07-31's original bug,
 *     2026-08-10's decline above) hardcoded white and left the FILL alone, which is exactly the
 *     defect A.4 fixed. This time the fill moves instead: `lib/domainColor.ts`'s
 *     `badgeGradientFor()` walks a hue's badge gradient further toward the navy deep-stop until
 *     white clears the same 3:1 floor A.4 introduced. To-do/Habits/Health/Notes already cleared
 *     it unmixed, so their gradient is untouched; only Shopping (and its shop/meal/budget/scan
 *     aliases) actually deepens — the badge on those cards is now a darker gold-to-navy blend
 *     than it used to be, which is the visible, intentional cost of the fix. `getDomainColor().ink`
 *     is `BADGE_ICON_INK` (`'#FFFFFF'`) unconditionally; `accentOverride` (Home's preview cards,
 *     which pass a `feat*` screen hue instead of a `card*` domain hue) routes through the same
 *     `badgeGradientFor()`, so Notes' yellow and Food's orange get the identical treatment.
 */
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { Domain, getDomainColor, badgeGradientFor, BADGE_ICON_INK } from '@/lib/domainColor';

type IoniconsName = keyof typeof Ionicons.glyphMap;

/**
 * Filled Ionicons per domain — reuses the nav's per-section glyphs where they overlap.
 * These are load-bearing since A.3 collapsed nine identity hues to four: several domains now
 * share a hue, so the glyph is the only thing separating them. Keep the silhouettes distinct.
 */
const DOMAIN_ICON: Record<Domain, IoniconsName> = {
  task: 'checkmark-circle',
  plan: 'calendar',
  habit: 'repeat',
  health: 'heart',
  meal: 'restaurant',
  shop: 'cart',
  budget: 'wallet',
  note: 'document-text',
};

// 135° diagonal (top-left → bottom-right), matching the DS card's linear-gradient(135deg,…).
const GRAD_START = { x: 0, y: 0 } as const;
const GRAD_END = { x: 1, y: 1 } as const;

type BadgeProps = {
  domain: Domain;
  /** Override the domain's default glyph. */
  icon?: IoniconsName;
  /** Badge edge length (default 44, matching the DS card). */
  size?: number;
  style?: ViewStyle;
  /**
   * Override the domain's identity hue for this badge's gradient + ink (2026-08-06). Home's
   * preview cards pass their card's own screenColor here — with the border, buttons and every
   * other accent on the card already pulled from screenColor, a badge still drawing the
   * (different) domain hue read as the one piece that didn't get the memo ("upper left icons
   * still wrong color"). Domain identity survives as the GLYPH silhouette (DOMAIN_ICON) even
   * when its colour is overridden, so same-hue domains (e.g. shop/meal/budget on the Shopping
   * hue) are still told apart. Omit to keep the default domain-hue badge (health.tsx,
   * shopping.tsx, MedicineTrayCard, SectionRail).
   */
  accentOverride?: string;
};

/**
 * The icon badge — a round two-stop gradient fill (the domain's `badgeGradient`, or
 * `accentOverride`'s when given) with a legible ink for the glyph and a light translucent rim,
 * so the badge itself carries colour rather than just tinting a neutral circle. This is the ONE
 * place an identity/screen hue appears as a fill on a card (the card's low-alpha edge is the
 * other channel); it is never text or icon colour anywhere else — see addendum A.4 rule 1.
 */
export function CardAccentBadge({ domain, icon, size = 44, style, accentOverride }: BadgeProps) {
  const theme = useAppTheme();
  const domainColor = getDomainColor(theme, domain);
  const badgeGradient = accentOverride ? badgeGradientFor(accentOverride) : domainColor.badgeGradient;
  const glyph = icon ?? DOMAIN_ICON[domain];
  return (
    <LinearGradient
      colors={badgeGradient}
      start={GRAD_START}
      end={GRAD_END}
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: Radius.full,
        },
        style,
      ]}
    >
      {/* Always white (2026-08-11) — badgeGradient is deepened per-hue so this stays legible. */}
      <Ionicons name={glyph} size={Math.round(size * 0.44)} color={BADGE_ICON_INK} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    // A light rim so the badge reads as a lifted key against the card (DS: 1.5px white .55).
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
});
