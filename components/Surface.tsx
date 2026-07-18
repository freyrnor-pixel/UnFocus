/**
 * Surface.tsx — material-aware card surface.
 *
 * Wraps children in a two-layer pattern (outer view carries border +
 * shadow, inner overflow:hidden mask carries the frost+wash fill) so any card uses
 * the glass surface finish — frosted glass over the ambient ScreenBackground.
 * Drop-in replacement for `<View style={[styles.card, {backgroundColor:
 * theme.surface}]}>` — pass the same `style` (radius/margin/padding all still
 * work; padding is automatically moved to the inner content so the fill
 * still spans the full card).
 *
 * Connections:
 *   Imports → constants/theme (getElevation, getLayeredShadow), lib/useAppTheme,
 *             store/useSettingsStore (glassSurfaces), components/GlassFill
 *   Used by → app screens that render a "card" surface (see grep for `<Surface`)
 *   Data    → reads `glassSurfaces` from the settings store
 *
 * Edit notes:
 *   - The glass finish (frost + wash + scrim + specular) lives in the shared
 *     components/GlassFill.tsx; Surface owns the outer view (layered shadow + layout), the
 *     raised-keycap EDGE (a thick hue-tinted rim gradient padding-ring + a crisp inner line),
 *     the overflow:hidden mask, and the style-splitting contract. The `surfaceContext` prop
 *     (`'ambient'` default | `'overlay'`) selects GlassFill's blur intensity AND wash alpha —
 *     ambient cards get NO BlurView (wash-only, cheapest path); overlay surfaces
 *     (sheets/modals/nav) get a real frost. What sits *behind* the card (ScreenBackground
 *     colour field for ambient, live scrolling content for overlay) is decided by where the
 *     caller mounts the Surface, not here.
 *   - **Colour-architecture inversion (2026-07-18)**: the FILL is neutral frost (base =
 *     theme.surface), NOT tinted with the screen hue; the COLOUR lives in the keycap EDGE,
 *     keyed to the screen hue via `useScreenColor()` (edgeMat). So a card is a neutral glass
 *     keycap with a strong colored edge, floating over the colorful ScreenBackground field.
 *   - Glass-off path: `settings.glassSurfaces` false renders a plain opaque card
 *     (mat.contrastBase fill, themed border, legacy single shadow) — the demo's non-glass
 *     fallback, exposed to users as a reduce-transparency toggle. GlassFill isn't mounted
 *     at all in that mode.
 *   - Depth: glass-on uses getLayeredShadow(theme.shadow) — a three-pass
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
 *   - Glass-off card edge is `theme.border` (opaque) so a plain card keeps a visible calm
 *     edge (2026-07-12 redesign); light mode keeps the material's brighter `borderTopColor`
 *     as a top-lit highlight, dark mode a uniform themed edge. Glass-ON is a strong raised
 *     keycap (double): a thick hue-tinted rim gradient padding-ring (bright top lip → soft dark
 *     bottom, from the screen-hue edgeMat) PLUS a crisp inner line (edgeMat.innerLine) — the two
 *     edges read as a physically raised, colored key. A `borderColor` prop (domain-coded card)
 *     collapses the ring to a solid coloured edge.
 *   - shadowColor comes from the active theme's `shadow` token (not a fixed
 *     black), so depth itself shifts hue with the colour theme.
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
import { LinearGradient } from 'expo-linear-gradient';
import { darken, getElevation, getLayeredShadow, getMaterialStyle, lighten, Radius, rgba } from '@/constants/theme';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useScreenColor } from '@/lib/screenColor';
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

// Blur strength per context (2026-07-18 simplification: frost is reserved for floating
// chrome). Ambient cards get NO BlurView at all — ambient-context callers pass
// blurIntensity 0 into GlassFill, which skips mounting it entirely. Overlay surfaces
// (sheets/modals/nav) sit over live scrolling content, so they get a real frost.
const GLASS_BLUR_INTENSITY: Record<SurfaceContext, number> = {
  ambient: 0,
  overlay: 64,
};

// The glass colour wash sits on top of the (optional) BlurView, carrying the theme hue.
// AMBIENT cards have no BlurView, so the wash alone is the entire finish — a translucent
// tint over the calm ScreenBackground backdrop reads as frosted without per-frame blur.
// OVERLAY surfaces sit over live scrolling content where legible text/shapes must NOT read
// through, so they stay denser. GlassFill additionally floors the wash on Android, where
// the backdrop blur is unavailable and opacity is the only contrast lever.
const GLASS_WASH_ALPHA: Record<SurfaceContext, number> = {
  // Ambient at 0.72 (2026-07-18 vision tune): a denser, opaque-leaning NEUTRAL frost so the card
  // reads as a solid frosted-glass keycap — the colour comes from the keycap EDGE and the field
  // in the gaps, not from the field bleeding through a thin fill. Still lets a whisper of the
  // field tint the pane. (GlassFill floors at 0.56 on Android; 0.72 clears it.)
  ambient: 0.72,
  overlay: 0.8,
};

// Raised-keycap edge geometry (2026-07-18 vision tune): a THICK hue-tinted rim padding-ring plus
// a crisp inner line = the "double keycap" that pops off the field with real depth. Thicker than
// the old 1.5 so the colored edge reads as a strong typewriter-key bevel, not a hairline.
const KEYCAP_BORDER_WIDTH = 2.5;
const KEYCAP_INNER_LINE_WIDTH = 1.5;

// Strong colored keycap edge, built from the screen/domain hue. Deliberately SATURATED (not the
// generic material rim, whose near-white top lip vanishes when the hue matches the field behind —
// e.g. a blue card on the blue Home field). Top = a bright-but-saturated lit lip, mid = the true
// hue, bottom = a dark hue-shadow, so the edge both POPS against a same-hue field and keeps the
// top-light→bottom-dark bevel that reads as a raised key.
function keycapRim(hue: string, isDark: boolean): { colors: readonly [string, string, ...string[]]; locations: readonly [number, number, ...number[]] } {
  return isDark
    ? { colors: [rgba(lighten(hue, 0.20), 0.90), rgba(hue, 0.55), rgba('#000000', 0.45)], locations: [0, 0.5, 1] }
    : { colors: [rgba(lighten(hue, 0.12), 0.95), rgba(hue, 0.80), rgba(darken(hue, 0.22), 0.70)], locations: [0, 0.5, 1] };
}
// The "double" inner edge — a saturated colored line just inside the rim chamfer.
function keycapInner(hue: string, isDark: boolean): string {
  return isDark ? rgba(lighten(hue, 0.10), 0.50) : rgba(darken(hue, 0.04), 0.55);
}

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
  const mode = isDark ? 'dark' : 'light';
  const glass = useSettingsStore((s) => s.glassSurfaces);
  const screenHue = useScreenColor();
  // Colour-architecture inversion (2026-07-18): the FILL is neutral frosted glass (near-white /
  // near-navy), NOT tinted with the screen hue — a denser, opaque-leaning frosted pane. The
  // COLOUR lives in the raised-keycap EDGE instead: a strong hue-tinted rim + inner line, keyed
  // to the screen's dominant hue (lib/screenColor.ts). So a card reads as a neutral glass keycap
  // with a colored edge that pops, floating over the colorful ScreenBackground field. An explicit
  // `tint` overrides the fill; `borderColor` overrides the edge with a solid coloured ring.
  const base = tint ?? theme.surface;
  const mat = getMaterialStyle(base, 'card', mode);
  // Edge (keycap) colour source: the screen hue by default, so every card on a screen carries
  // that screen's colored keycap edge. Sub-tier screens (no hue) fall back to theme.border → a
  // calm neutral keycap. `tint`/`borderColor` still win (handled below).
  const edgeHue = tint ?? (glass && screenHue ? screenHue : theme.border);
  // Glass-off (reduce-transparency) path uses the legacy single shadow; glass-on uses the
  // three-pass layered shadow. Both deepen to the `floating` tier when `elevated`.
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

  // Glass-off (reduce-transparency): plain opaque card — flat themed border, single shadow,
  // mat.contrastBase fill, and NONE of the take-two rim/scrim/specular layers mounted.
  if (!glass) {
    return (
      <View
        style={[
          outer,
          {
            borderRadius: radius,
            borderWidth: mat.borderWidth,
            // Opaque themed edge (2026-07-12 redesign): the material's default border is a
            // translucent white (rgba('#FFFFFF',0.5)) that vanishes on light-mode cards,
            // leaving them edgeless. Use theme.border so every card has a visible, calm edge.
            borderColor: borderColor ?? theme.border,
            borderTopColor: borderColor ?? (isDark ? theme.border : mat.borderTopColor),
            borderBottomColor: borderColor ?? theme.border,
          },
          shadowStyle,
        ]}
      >
        <View style={[styles.mask, { borderRadius: radius, backgroundColor: mat.contrastBase }]}>
          <View style={[content, padding]}>{children}</View>
        </View>
      </View>
    );
  }

  // Glass-on: a raised typewriter-keycap edge — a THICK, hue-tinted rim gradient padding-ring
  // (bright lit top lip → soft dark bottom, from the screen-hue edgeMat) PLUS a crisp inner line
  // (edgeMat.innerLine), so the card reads as a physically raised, colored key that pops off the
  // field with real depth/layering. The FILL inside stays neutral frost (mat = neutral base). A
  // `borderColor` prop (domain-coded card) collapses the ring to a solid coloured edge.
  const innerRadius = Math.max(0, radius - KEYCAP_BORDER_WIDTH);
  const rim = keycapRim(edgeHue, isDark);
  const rimColors = borderColor ? ([borderColor, borderColor] as const) : rim.colors;
  return (
    <View style={[outer, { borderRadius: radius }, shadowStyle]}>
      <LinearGradient
        colors={rimColors}
        locations={borderColor ? undefined : rim.locations}
        // Vertical (top → bottom): light on the top edge, shadow on the bottom edge — the keycap
        // bevel. A solid `borderColor` override collapses to a flat coloured ring.
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.ring, { borderRadius: radius, padding: KEYCAP_BORDER_WIDTH }]}
      >
        <View
          style={[
            styles.mask,
            // Inner line = the second edge of the raised-keycap "double": a saturated colored line
            // just inside the rim chamfer. `borderColor` (domain card) wins.
            { borderRadius: innerRadius, borderWidth: KEYCAP_INNER_LINE_WIDTH, borderColor: borderColor ?? keycapInner(edgeHue, isDark) },
          ]}
        >
          <GlassFill
            mat={mat}
            radius={innerRadius}
            blurIntensity={GLASS_BLUR_INTENSITY[surfaceContext]}
            washAlpha={GLASS_WASH_ALPHA[surfaceContext]}
            tint={isDark ? 'dark' : 'light'}
          />
          <View style={[content, padding]}>{children}</View>
        </View>
      </LinearGradient>
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
  // The keycap rim gradient ring sits between the outer shadow view and the mask, taking over
  // the mask's "stretch to the outer view" role so width/height still fill the card (incl. the
  // minHeight case — see mask's note). Its `padding` (= KEYCAP_BORDER_WIDTH) is the ring gap.
  ring: { alignSelf: 'stretch', flexGrow: 1 },
});
