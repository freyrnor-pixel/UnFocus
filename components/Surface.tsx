/**
 * Surface.tsx — material-aware card surface.
 *
 * Wraps children in a two-layer pattern (outer view carries border +
 * shadow, inner overflow:hidden mask carries fill + sheen) so any card uses
 * the glass surface finish — frosted glass over the ambient ScreenBackground.
 * Drop-in replacement for `<View style={[styles.card, {backgroundColor:
 * theme.surface}]}>` — pass the same `style` (radius/margin/padding all still
 * work; padding is automatically moved to the inner content so the sheen
 * still spans the full card).
 *
 * Connections:
 *   Imports → constants/theme (getElevation, getLayeredShadow), lib/useAppTheme,
 *             store/useSettingsStore (glassSurfaces), components/GlassFill
 *   Used by → app screens that render a "card" surface (see grep for `<Surface`)
 *   Data    → reads `glassSurfaces` from the settings store
 *
 * Edit notes:
 *   - The glass finish (frost + wash + rim + specular + scrim + drifting sheen) now lives
 *     in the shared components/GlassFill.tsx ("Glass, take two", 2026-07-17); Surface owns
 *     only the outer view (border + layered shadow), the overflow:hidden mask, and the
 *     style-splitting contract. The `surfaceContext` prop (`'ambient'` default | `'overlay'`)
 *     still selects GlassFill's blur intensity AND wash alpha — one shared code path; what
 *     sits *behind* the card (ScreenBackground backdrop for ambient, live scrolling content
 *     for overlay) is decided by where the caller mounts the Surface, not here.
 *   - Glass-off path: `settings.glassSurfaces` false renders a plain opaque card
 *     (mat.contrastBase fill, themed border, legacy single shadow) — the demo's non-glass
 *     fallback, exposed to users as a reduce-transparency toggle. GlassFill isn't mounted
 *     at all in that mode.
 *   - Depth (fix 3): glass-on uses getLayeredShadow(theme.shadow) — a three-pass
 *     `boxShadow` (RN New-Arch) — and must NOT also set the shadow/elevation keys on the
 *     same view (they'd double up). Glass-off keeps the legacy single shadow. `elevated`
 *     deepens either to the `floating` tier.
 *   - `style` is split three ways: padding keys AND content-layout keys
 *     (alignItems/justifyContent/flexDirection/gap...) move to the inner content
 *     view; everything else non-owned (margin, width, flex, minHeight, borderRadius...)
 *     stays on the outer shadow-casting view; the mask `alignSelf:'stretch'`es to full
 *     width AND `flexGrow:1`s to full height. Routing content-layout inward (not onto the
 *     outer view) is what stops the fill from shrink-wrapping its children and floating as
 *     a narrower "box inside the box" (width case); `flexGrow:1` is the height counterpart —
 *     without it, a card whose outer view is taller than its content (e.g. a collapsed Home
 *     preview card with `minHeight`) leaves a bare transparent band inside the border below
 *     the content, since the fill (absoluteFill inside the mask) only covered the content
 *     height. Any backgroundColor, border colors/width, or
 *     shadow/elevation in `style` is intentionally dropped — owned by the material.
 *   - The card edge is `theme.border` (opaque), not the material's translucent-white
 *     border, so cards keep a visible calm edge in light mode (2026-07-12 redesign).
 *     Light mode still keeps the material's brighter `borderTopColor` as a top-lit glass
 *     highlight; dark mode uses a uniform themed edge (sheen is off there anyway).
 *   - shadowColor comes from the active theme's `shadow` token (not a fixed
 *     black), so depth itself shifts hue with the colour theme.
 *   - The sheen is suppressed in dark mode (useIsDark) — over near-black surfaces
 *     it reads as bright streaks and contradicts sunken wells; dark depth comes
 *     from border + shadow instead. Light mode keeps the sheen.
 *   - Pass `tint` for a non-default base (e.g. theme.offWhite for empty
 *     states, or an accent colour for a coloured card) — material shading is
 *     computed from this base. For a domain-coded card, prefer `borderColor`
 *     (colored edge, neutral fill) over `tint` (whole-card colour wash) — see its
 *     own doc comment on the Props type (2026-07-14).
 *   - **Purposeful Depth System (2026-07-14)**: `elevated` swaps the outer view's
 *     shadow keys from the material's own (`mat.shadowOpacity/Radius/elevation`, ≈
 *     `raised`) to `getElevation('floating', theme.shadow)` — same themed shadowColor,
 *     just deeper. This is the focus-pop path for Surface-based (glass) cards; see
 *     PlanTaskCard.tsx for the caller.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { getElevation, getLayeredShadow, getMaterialStyle, Radius } from '@/constants/theme';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import GlassFill from '@/components/GlassFill';

/**
 * Which backdrop a glass Surface frosts (Decision 008). 'ambient' (default) sits
 * over the calm ScreenBackground backdrop and uses a lighter blur; 'overlay' sits
 * over live scrolling content (sticky headers, sheets, nav bar) and blurs harder so
 * the moving content behind stays unreadable-but-present.
 */
export type SurfaceContext = 'ambient' | 'overlay';

type Props = {
  surfaceContext?: SurfaceContext;
  tint?: string;
  /**
   * Overrides the card edge color on all four sides (including the light-mode glass
   * top highlight) — e.g. a domain accent for a colored-border/neutral-fill card
   * (2026-07-14: replaces the old whole-card `tint` wash pattern). Omit for the
   * default calm `theme.border` edge.
   */
  borderColor?: string;
  /**
   * Purposeful Depth System (2026-07-14): boosts this card's shadow to the `floating`
   * tier (getElevation('floating', theme.shadow)) on top of the material's own themed
   * shadowColor — the focus/active pop for material (glass) cards. Omit for the
   * default material shadow (≈ `raised`).
   */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

// Blur strength per context. Overlay frosts busier (live) content, so it leans
// stronger to keep that content from reading through as legible detail.
const GLASS_BLUR_INTENSITY: Record<SurfaceContext, number> = {
  ambient: 25,
  overlay: 45,
};

// The glass colour wash sits on top of the BlurView to keep the theme hue and
// block the blurred backdrop from reading as legible shapes/text through the
// card. Expressed as the *final* alpha the wash renders at (not multiplied
// against mat.backgroundColor's own 0.84 — that compounding used to land
// around 0.42 effective alpha, translucent enough that scrolled text (under
// ScreenHeader/BottomNav/sheets) and busy backdrops (under content cards)
// stayed legible through the card, breaking the app's validated text/surface
// contrast guarantees (see constants/colors.ts). Overlay sits over live
// scrolling content, so it leans closer to opaque than ambient (which only
// frosts the calm, text-free ScreenBackground backdrop).
const GLASS_WASH_ALPHA: Record<SurfaceContext, number> = {
  ambient: 0.92,
  overlay: 0.97,
};

const PADDING_KEYS = new Set([
  'padding', 'paddingHorizontal', 'paddingVertical',
  'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingStart', 'paddingEnd',
]);

// How the caller wants its *children* laid out — belongs on the inner content view,
// not the outer shadow/border view. Putting these on the outer view made the inner
// mask shrink-wrap its content and float as a narrower "box inside the box".
const CONTENT_LAYOUT_KEYS = new Set([
  'alignItems', 'justifyContent', 'flexDirection', 'gap', 'rowGap', 'columnGap', 'flexWrap',
]);

// Owned by the material, not the caller — silently dropped from any passed-in style.
const OWNED_KEYS = new Set([
  'backgroundColor', 'borderWidth', 'borderColor', 'borderTopColor', 'borderBottomColor',
  'borderLeftColor', 'borderRightColor', 'borderStyle',
  'shadowColor', 'shadowOpacity', 'shadowRadius', 'shadowOffset', 'elevation',
]);

export default function Surface({ surfaceContext = 'ambient', tint, borderColor, elevated, style, children }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const glass = useSettingsStore((s) => s.glassSurfaces);
  const base = tint ?? theme.surface;
  const mat = getMaterialStyle(base);
  // Glass-off (reduce-transparency) path uses the legacy single shadow; glass-on uses the
  // take-two three-pass shadow (fix 3). Both deepen to the `floating` tier when `elevated`.
  const shadowLevel = elevated ? 'floating' : 'raised';
  const elevation = elevated ? getElevation('floating', theme.shadow) : null;

  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const padding: Record<string, unknown> = {};
  const content: Record<string, unknown> = {};
  for (const key of Object.keys(flat)) {
    if (PADDING_KEYS.has(key)) padding[key] = flat[key];
    else if (CONTENT_LAYOUT_KEYS.has(key)) content[key] = flat[key];
    else if (!OWNED_KEYS.has(key)) outer[key] = flat[key];
  }
  const radius = (flat.borderRadius as number | undefined) ?? Radius.md;

  // The raised-material sheen/specular reads as bright streaks over near-black dark surfaces
  // (and contradicts a sunken well), so suppress the light-mode lift layers in dark mode and
  // lean on border + shadow for depth. Light mode keeps them.
  const showSheen = !isDark;

  // Glass-on: the layered box-shadow OWNS depth on the outer view (don't also set the single
  // shadow*/elevation keys — they'd double up). Glass-off: keep the legacy single shadow.
  const shadowStyle = glass
    ? { boxShadow: getLayeredShadow(theme.shadow, shadowLevel) }
    : {
        shadowColor: theme.shadow,
        shadowOffset: elevation ? elevation.shadowOffset : { width: 0, height: 2 },
        shadowOpacity: elevation ? elevation.shadowOpacity : mat.shadowOpacity,
        shadowRadius: elevation ? elevation.shadowRadius : mat.shadowRadius,
        elevation: elevation ? elevation.elevation : mat.elevation,
      };

  return (
    <View
      style={[
        outer,
        {
          borderRadius: radius,
          borderWidth: mat.borderWidth,
          // Opaque themed edge (2026-07-12 redesign): the material's default border is a
          // translucent white (rgba('#FFFFFF',0.5)) that vanishes on light-mode cards,
          // leaving them edgeless. Use theme.border so every card has a visible, calm edge
          // in both modes. In light mode keep the material's brighter top edge as the glass
          // top-lit highlight (depth); in dark mode the sheen is off, so a uniform themed
          // edge reads cleaner than a white top-line.
          borderColor: borderColor ?? theme.border,
          borderTopColor: borderColor ?? (isDark ? theme.border : mat.borderTopColor),
          borderBottomColor: borderColor ?? theme.border,
        },
        shadowStyle,
      ]}
    >
      <View style={[styles.mask, { borderRadius: radius }, glass ? null : { backgroundColor: mat.contrastBase }]}>
        {glass && (
          <GlassFill
            mat={mat}
            radius={radius}
            blurIntensity={GLASS_BLUR_INTENSITY[surfaceContext]}
            washAlpha={GLASS_WASH_ALPHA[surfaceContext]}
            tint={isDark ? 'dark' : 'light'}
            showSheen={showSheen}
          />
        )}
        <View style={[content, padding]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // alignSelf:'stretch' so the fill always spans the full card WIDTH even when the caller's
  // style centers content on the outer view (otherwise the mask shrink-wraps its children
  // and floats as a narrower box inside the bordered card). flexGrow:1 does the same for the
  // main axis (HEIGHT): when the outer view is forced taller than its content — e.g. Home's
  // collapsed preview cards with minHeight:HOME_PREVIEW_CARD_MIN_HEIGHT — the mask grows to
  // fill the floor so the fill (blur + wash) covers the whole card instead of leaving a bare,
  // transparent band inside the border below the content. No-op for content-sized cards
  // (zero free space to distribute).
  mask: { overflow: 'hidden', alignSelf: 'stretch', flexGrow: 1 },
});
