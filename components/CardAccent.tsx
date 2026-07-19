/**
 * CardAccent.tsx — the "one gradient move" for a domain-coded card (2026-07-19 Card accent system).
 *
 * A card borrows its identity colour from the blue→violet `card*` ramp (lib/domainColor.ts), keyed to
 * its life area, and expresses it as ONE gradient move: a gradient icon BADGE + a soft header WASH
 * band. Never a full-card fill — the wash is a top band only, so it doesn't reopen the 2026-07-14
 * "muddy whole-card tint" issue (see Surface.tsx / domainColor.ts). Action colour (Save=primary,
 * Delete=danger) is deliberately NOT here — it stays constant across every card so it never competes
 * with identity colour.
 *
 * Two parts, used together or apart:
 *   - <CardAccentBadge domain icon? size? /> — the rounded gradient badge with a white glyph. Drop it
 *     as a leading element in any card/section header (e.g. ExpandableCard's leadingAction).
 *   - <CardAccentWash domain height? radius? /> — an absolutely-positioned wash band for the TOP of a
 *     card's content (mount as the first child inside a Surface, above text). Fades to the surface.
 *
 * Connections:
 *   Imports → expo-linear-gradient, @expo/vector-icons (Ionicons), constants/theme (Radius, Spacing,
 *             getGlow), lib/useAppTheme, lib/domainColor (Domain, getDomainColor, DOMAIN_ICON)
 *   Used by → components/ExpandableCard, components/HomeShoppingCard, components/HomeNotesCard, and
 *             other header-bearing card surfaces that colour-code by domain
 *   Data    → none (presentational; colour derived from the active palette)
 *
 * Edit notes:
 *   - The domain→icon map lives here (DOMAIN_ICON) — filled Ionicons, reusing the nav's per-section
 *     glyphs where they overlap (cart/calendar/heart). White glyph on the gradient badge.
 *   - Badge glow: a single soft `getGlow(accent)` — the badge is a small purposeful accent, applied
 *     per ANIMATION_GUIDELINES.md's "sparingly" rule; don't stack it on top of a card-level glow.
 *   - Wash is `pointerEvents:'none'` and absolutely filled to the top band so it never intercepts
 *     taps or shifts layout; the caller gives the card its own paddingTop for the title to clear it.
 */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Radius, getGlow } from '@/constants/theme';
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
  /** Soft colored halo behind the badge (purposeful; off by default). */
  glow?: boolean;
  style?: ViewStyle;
};

/** The gradient icon badge — a rounded square with a white glyph, from the domain's badgeGradient. */
export function CardAccentBadge({ domain, icon, size = 44, glow = false, style }: BadgeProps) {
  const theme = useAppTheme();
  const { badgeGradient, accent } = getDomainColor(theme, domain);
  const glyph = icon ?? DOMAIN_ICON[domain];
  return (
    <LinearGradient
      colors={badgeGradient}
      start={GRAD_START}
      end={GRAD_END}
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: Radius.sm },
        glow ? getGlow(accent, 'soft') : null,
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

/**
 * Composed default: a card header region = a wash band with the badge floating over its lower-left
 * edge (the DS card's anatomy). Use directly for cards whose header is a plain title/meta stack; for
 * cards with a bespoke header row, compose CardAccentBadge / CardAccentWash yourself.
 */
export default function CardAccent({ domain, icon }: { domain: Domain; icon?: IoniconsName }) {
  return (
    <>
      <CardAccentWash domain={domain} />
      <View style={styles.floatBadge}>
        <CardAccentBadge domain={domain} icon={icon} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    // A light rim so the badge reads as a lifted key against a light wash (DS: 1.5px white .55).
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  // Badge floats at the wash/body boundary, inset from the left edge (DS: left 14, bottom -18).
  floatBadge: {
    position: 'absolute',
    top: 40,
    left: 14,
  },
});
