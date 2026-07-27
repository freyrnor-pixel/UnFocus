/**
 * CardAccent.tsx — the "one colour move" for a domain-coded card (2026-07-19 Card accent system;
 * badge flattened 2026-07-24, re-gradiented 2026-07-26 — see Edit notes).
 *
 * A card borrows its identity colour from the blue→violet `card*` ramp (lib/domainColor.ts), keyed to
 * its life area, and expresses it as ONE colour move: a gradient icon BADGE + a soft header WASH
 * band, both built from the domain's palette so they read as one system. Never a full-card
 * fill — the wash is a top band only, so it doesn't reopen the 2026-07-14 "muddy whole-card tint"
 * issue (see Surface.tsx / domainColor.ts). Action colour (Save=primary, Delete=danger) is
 * deliberately NOT here — it stays constant across every card so it never competes with identity
 * colour.
 *
 * Two parts, used together:
 *   - <CardAccentBadge domain icon? size? /> — a round two-stop gradient badge (domain's
 *     `badgeGradient`, white glyph, light rim). Drop it as a leading element in any card/section header.
 *   - <CardAccentWash domain height? radius? /> — an absolutely-positioned wash band for the TOP of a
 *     card's content (mount as the first child inside a Surface, above text). Fades to the surface.
 *
 * Connections:
 *   Imports → @expo/vector-icons (Ionicons), expo-linear-gradient, constants/theme (Radius),
 *             lib/useAppTheme, lib/domainColor (Domain, getDomainColor, DOMAIN_ICON),
 *             components/Surface (GLASS_EDGE_WIDTH — the wash's inner-corner math),
 *             store/useSettingsStore (glassSurfaces, same reason)
 *   Used by → components/HomeShoppingCard, components/HomeNotesCard, components/PlanTaskCard (all
 *             three import CardAccentBadge + CardAccentWash as named exports, size=32)
 *   Data    → none (presentational; colour derived from the active palette)
 *
 * Edit notes:
 *   - The domain→icon map lives here (DOMAIN_ICON) — filled Ionicons, reusing the nav's per-section
 *     glyphs where they overlap (cart/calendar/heart).
 *   - (2026-07-24) Badge flattened to a flat `domainColor.soft` circle + `accent` glyph/border — the
 *     complaint was the gradient sticker reading as a separate object stacked on the wash.
 *   - **(2026-07-26) Re-gradiented**: as part of a broader "bring the card colour back" pass (Surface's
 *     EDGE_WIDTH also widened 1.5→2.5 the same day), the flat badge was judged too colourless — it and
 *     the thin card edge were the two places the 2026-07-18→07-24 redesign sprint had progressively
 *     drained identity colour out of cards. Badge is back to the pre-07-24 two-stop `badgeGradient`
 *     fill with a white glyph and a translucent white rim (same recipe as the original 2026-07-19 Card
 *     accent system, not a new design). `lib/domainColor.ts`'s `badgeGradient`/`CARD_BADGE_DEEP` are
 *     live again (previously unused-but-kept for exactly this reason).
 *   - Also removed the unused default `CardAccent` export (badge absolutely floated across the
 *     wash/body boundary via `floatBadge`) — it had zero importers and was the exact floating-over-
 *     the-band composition the 2026-07-24 flatten moved away from (still true post-re-gradient).
 *     Compose `CardAccentBadge` + `CardAccentWash` directly, as every current caller already does.
 *   - Wash is `pointerEvents:'none'` and absolutely filled to the top band so it never intercepts
 *     taps or shifts layout; the caller gives the card its own paddingTop for the title to clear it.
 *   - **(2026-07-27) The wash's top corners round by the MASK's radius, not the card's.** Callers pass
 *     (or default to) the card's outer radius, but the band paints inside Surface's overflow-hidden
 *     mask, which is inset by the beveled edge in glass mode — rounding by the outer radius left a
 *     visible unpainted crescent of plain surface in each top corner (user report + screenshot). Keep
 *     the `radius - GLASS_EDGE_WIDTH` (glass-on) math in sync if Surface's edge/mask geometry changes.
 */
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { Domain, getDomainColor } from '@/lib/domainColor';
import { GLASS_EDGE_WIDTH } from '@/components/Surface';
import { useSettingsStore } from '@/store/useSettingsStore';

type IoniconsName = keyof typeof Ionicons.glyphMap;

/** Filled Ionicons per domain — reuses the nav's per-section glyphs where they overlap. */
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
};

/**
 * The icon badge — a round two-stop gradient fill (domain's `badgeGradient`) with a white glyph
 * and a light translucent rim, so the badge itself carries the domain colour rather than just
 * tinting a neutral circle (2026-07-26: restores the pre-2026-07-24 gradient look — the flat
 * soft-tint circle read as too colourless next to the rest of the "bring the colour back" pass).
 */
export function CardAccentBadge({ domain, icon, size = 44, style }: BadgeProps) {
  const theme = useAppTheme();
  const { badgeGradient } = getDomainColor(theme, domain);
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
      <Ionicons name={glyph} size={Math.round(size * 0.44)} color="#FFFFFF" />
    </LinearGradient>
  );
}

type WashProps = {
  domain: Domain;
  /** Height of the wash band from the top of the card (default 64). */
  height?: number;
  /** Match the card's corner radius so the band's top corners stay rounded. */
  radius?: number;
  /**
   * Positioning override — e.g. negative `top`/`left`/`right` to bleed the band past a padded
   * content view to the card's own edge. Merged after the default absolute-top-band placement.
   */
  style?: ViewStyle;
};

/**
 * The header wash — a soft `[washTop → surface]` gradient band pinned to the TOP of a card's content.
 * Mount it as the first child inside a Surface (before the header row) so it sits above the frosted
 * fill and below the text. Absolutely positioned + non-interactive; give the card paddingTop to clear it.
 */
export function CardAccentWash({ domain, height = 64, radius = Radius.md, style }: WashProps) {
  const theme = useAppTheme();
  const glass = useSettingsStore((s) => s.glassSurfaces);
  const { washTop } = getDomainColor(theme, domain);
  // `radius` is the CARD's outer radius, but this band is painted inside Surface's mask, whose
  // corners are inset by the beveled edge when glass is on (Surface: `radius - GLASS_EDGE_WIDTH`).
  // Rounding the band by the outer radius therefore curved it away from the mask's own corner and
  // left a small unpainted crescent of plain surface in the card's top corners (2026-07-27 user
  // report, screenshot). Match the mask exactly instead.
  const innerRadius = Math.max(0, radius - (glass ? GLASS_EDGE_WIDTH : 0));
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[washTop, theme.surface]}
      start={GRAD_START}
      end={GRAD_END}
      style={[styles.wash, { height, borderTopLeftRadius: innerRadius, borderTopRightRadius: innerRadius }, style]}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    // A light rim so the badge reads as a lifted key against the wash (DS: 1.5px white .55).
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
