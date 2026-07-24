/**
 * CardAccent.tsx — the "one colour move" for a domain-coded card (2026-07-19 Card accent system;
 * badge flattened 2026-07-24 — see Edit notes).
 *
 * A card borrows its identity colour from the blue→violet `card*` ramp (lib/domainColor.ts), keyed to
 * its life area, and expresses it as ONE colour move: a flat-token icon BADGE + a soft header WASH
 * band, both built from the same {accent, soft} pair so they read as one system. Never a full-card
 * fill — the wash is a top band only, so it doesn't reopen the 2026-07-14 "muddy whole-card tint"
 * issue (see Surface.tsx / domainColor.ts). Action colour (Save=primary, Delete=danger) is
 * deliberately NOT here — it stays constant across every card so it never competes with identity
 * colour.
 *
 * Two parts, used together:
 *   - <CardAccentBadge domain icon? size? /> — a flat circular badge (soft-tint fill, accent glyph
 *     + border). Drop it as a leading element in any card/section header.
 *   - <CardAccentWash domain height? radius? /> — an absolutely-positioned wash band for the TOP of a
 *     card's content (mount as the first child inside a Surface, above text). Fades to the surface.
 *
 * Connections:
 *   Imports → @expo/vector-icons (Ionicons), expo-linear-gradient (CardAccentWash only),
 *             constants/theme (Radius), lib/useAppTheme, lib/domainColor (Domain, getDomainColor,
 *             DOMAIN_ICON)
 *   Used by → components/HomeShoppingCard, components/HomeNotesCard, components/PlanTaskCard (all
 *             three import CardAccentBadge + CardAccentWash as named exports, size=32)
 *   Data    → none (presentational; colour derived from the active palette)
 *
 * Edit notes:
 *   - The domain→icon map lives here (DOMAIN_ICON) — filled Ionicons, reusing the nav's per-section
 *     glyphs where they overlap (cart/calendar/heart).
 *   - (2026-07-24) Badge flattened: was a two-stop `badgeGradient` fill with a white rim — read as a
 *     separate sticker stacked on top of the wash band instead of part of the same colour system, and
 *     the exact complaint was awkward placement/overlap. Now a flat `domainColor.soft` circle with an
 *     `accent`-coloured glyph + border — the same token trio the sibling item-count badge already uses
 *     (e.g. HomeShoppingCard's header count pill) — so the badge, the wash, the count pill, and the
 *     card border all pull from one {accent, soft} pair instead of the badge carrying its own gradient.
 *     Dropped the `glow` prop with it (no caller used it; it was part of the same "separate object"
 *     look). `lib/domainColor.ts`'s `badgeGradient`/`CARD_BADGE_DEEP` are left as-is (unused by this
 *     component now, still covered by lib/__tests__/domainColor.test.ts) — out of scope here.
 *   - Also removed the unused default `CardAccent` export (badge absolutely floated across the
 *     wash/body boundary via `floatBadge`) — it had zero importers and was the exact floating-over-
 *     the-band composition the flatten above moves away from. Compose `CardAccentBadge` +
 *     `CardAccentWash` directly, as every current caller already does.
 *   - Wash is `pointerEvents:'none'` and absolutely filled to the top band so it never intercepts
 *     taps or shifts layout; the caller gives the card its own paddingTop for the title to clear it.
 */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Radius, rgba } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { Domain, getDomainColor } from '@/lib/domainColor';

type IoniconsName = keyof typeof Ionicons.glyphMap;

/** Filled Ionicons per domain — reuses the nav's per-section glyphs where they overlap. */
export const DOMAIN_ICON: Record<Domain, IoniconsName> = {
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
 * The icon badge — a flat circle in the domain's {soft, accent} pair (soft fill, accent glyph +
 * border), the same token trio the sibling item-count badge uses, so it reads as part of the card's
 * colour system rather than a separately-coloured object.
 */
export function CardAccentBadge({ domain, icon, size = 44, style }: BadgeProps) {
  const theme = useAppTheme();
  const { accent, soft } = getDomainColor(theme, domain);
  const glyph = icon ?? DOMAIN_ICON[domain];
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: Radius.full,
          backgroundColor: soft,
          borderColor: rgba(accent, 0.4),
        },
        style,
      ]}
    >
      <Ionicons name={glyph} size={Math.round(size * 0.44)} color={accent} />
    </View>
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
  const { washTop } = getDomainColor(theme, domain);
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[washTop, theme.surface]}
      start={GRAD_START}
      end={GRAD_END}
      style={[styles.wash, { height, borderTopLeftRadius: radius, borderTopRightRadius: radius }, style]}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
