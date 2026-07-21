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
 *   Imports → constants/theme (getElevation, getLayeredShadow, getMaterialStyle,
 *             computeRimGradient), lib/useAppTheme, store/useSettingsStore (glassSurfaces),
 *             components/GlassFill, expo-linear-gradient
 *   Used by → app screens that render a "card" surface (see grep for `<Surface`)
 *   Data    → reads `glassSurfaces` from the settings store
 *
 * Edit notes:
 *   - The glass finish (frost + wash + scrim + specular) lives in the shared
 *     components/GlassFill.tsx; Surface owns the outer view (layered shadow + layout), the THIN
 *     beveled EDGE (a translucent gradient ring, ~1.5px thick), the overflow:hidden mask, and the
 *     style-splitting contract. The `surfaceContext` prop (`'ambient'` default | `'overlay'`)
 *     selects GlassFill's blur intensity AND wash alpha — ambient cards get NO BlurView
 *     (wash-only, cheapest path); overlay surfaces (sheets/modals/nav) get a real frost. What
 *     sits *behind* the card (ScreenBackground colour field for ambient, live scrolling content
 *     for overlay) is decided by where the caller mounts the Surface, not here.
 *   - **Colour-architecture inversion (2026-07-18, retuned)**: the translucent FILL frosts the
 *     ScreenBackground FIELD showing through behind the card, so every card on a screen shares
 *     one uniform frosted hue; the domain/screen COLOUR lives ONLY in the thin beveled EDGE. The
 *     edge is a translucent gradient ring (not an opaque full-rect gradient behind the fill) —
 *     that's what stops each card bleeding its own edge colour through the fill (the earlier
 *     thick opaque-ring version tinted every card's whole face, reading as a multi-hue screen).
 *     (2026-07-21: the ring moved from a single View's per-side-coloured border to a
 *     `LinearGradient` fill — see the EDGE_WIDTH comment below for why.)
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
 *     edge (2026-07-12 redesign), uniformly on all sides in both light and dark mode (2026-07-21:
 *     dropped the light-mode-only `borderTopColor` highlight override — same per-side-colour +
 *     borderRadius corner-rendering risk as the glass-on edge, not worth it for a subtle
 *     highlight in the already-lower-priority reduce-transparency fallback). Glass-ON is a THIN
 *     beveled edge (~1.5px, `computeRimGradient()`): a vertical gradient ring, lit top → true-hue
 *     mid → darker bottom, in the edge hue (screen hue, or the `borderColor`/`tint` override) — a
 *     raised key without the old thick-ring heft, and thin enough that the colour reads as an
 *     accent, not a frame.
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
import { computeRimGradient, getElevation, getLayeredShadow, getMaterialStyle, Radius } from '@/constants/theme';
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
  // Ambient at 0.85 (2026-07-18 "looks like flat white, not frosted glass"). The previous 0.94
  // read as an opaque white/navy tile — the specular/scrim highlights alone weren't enough to
  // sell "glass". Dropping ~9pts lets a gentle wash of the colorful ScreenBackground field show
  // through the neutral fill, so a card reads as a genuinely translucent frosted pane over the
  // field (the whole point of the finish) while still staying neutral enough that text keeps its
  // contrast and cards don't fully take on the screen hue. The colour identity still lives in the
  // keycap EDGE (domain/screen hue) and the CTAs; this is just enough translucency to look like glass.
  ambient: 0.85,
  overlay: 0.8,
};

// Thin beveled edge (2026-07-18 "make borders thinner"; 2026-07-21 "fix corner rendering"): a
// single thin ring, still just `EDGE_WIDTH` thick — no heftier than before. It's now a translucent
// vertical gradient (computeRimGradient, keyed on the domain/screen edge hue, not the neutral fill)
// drawn as a `LinearGradient` fill clipped by `borderRadius`, rather than a single `View`'s border
// with three different per-side colours (top/side/bottom). RN's native border renderer doesn't
// reliably curve/blend different border colours around a rounded corner (worse on Android) — the
// corner can render as a flat cut even though the card's fill looks properly rounded. A gradient
// FILL clipped by borderRadius has no such issue on any platform, since there's no per-side border
// colour blending involved at all. Same technique Button.tsx already uses for its rim (see
// getMaterialStyle's `rim`/computeRimGradient in constants/theme.ts) — Surface just needed its own
// hue input (`edgeHue`, not the fill's `base`) since its edge and fill colours are deliberately
// different (see the colour-architecture inversion note above).
const EDGE_WIDTH = 1.5;

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
  // Colour-architecture (2026-07-18, retuned): the translucent FILL frosts the ScreenBackground
  // FIELD behind the card (base = theme.surface, near-white/near-navy), so cards on one screen all
  // read as a single uniform frosted hue. The domain/screen COLOUR lives ONLY in the thin beveled
  // EDGE, keyed to the screen's dominant hue (lib/screenColor.ts). An explicit `tint` overrides the
  // fill base; `borderColor` overrides the edge hue.
  const base = tint ?? theme.surface;
  const mat = getMaterialStyle(base, 'card', mode);
  // Edge colour source, in priority order: an explicit `borderColor` (a domain-coded card — e.g.
  // the green shopping preview, indigo plans, note-coloured notes — so the edge matches that card's
  // own icon/badge instead of the generic screen hue), then `tint`, then the screen hue (so an
  // un-coded card on a tab carries that screen's edge colour), then a calm neutral edge for
  // sub-tier screens (no hue). Whatever wins becomes the thin beveled ring's hue (computeRimGradient).
  const edgeHue = borderColor ?? tint ?? (glass && screenHue ? screenHue : theme.border);
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
  // The mask's flexGrow:1 (below) only exists to let the fill reach the floor of an outer
  // view the CALLER has explicitly forced taller than its content (minHeight/height/flex —
  // e.g. Home's cardCollapsed minHeight, or ScreenScaffold's headerFill flex:1). For a
  // hug-content card (no such key — e.g. a small alignSelf:'center' pill/chip), the outer
  // view has no definite main-axis size of its own to distribute, and on Android this can
  // resolve the "available space" as the ScrollView's effectively-unbounded measure spec
  // instead of the CSS-spec content-hug behavior web/iOS give it — growing the chip into a
  // full-height bar (2026-07-20 bug: the Habits "X / Y goals met today" summary chip).
  // Gating flexGrow on an explicit forced-height key keeps the legitimate stretch cases
  // working while stopping hug-content chips from growing unbounded.
  const growsToFillOuter = 'minHeight' in flat || 'height' in flat || 'flex' in flat || 'flexGrow' in flat;
  const maskGrowStyle = { flexGrow: growsToFillOuter ? 1 : 0 };

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
            // Uniform on every side (2026-07-21: dropped the light-mode-only borderTopColor
            // highlight — a different top color than the sides/bottom hits the same
            // borderRadius-corner-blend risk as the glass-on edge; see the EDGE_WIDTH comment).
            borderColor: borderColor ?? theme.border,
            borderTopColor: borderColor ?? theme.border,
            borderBottomColor: borderColor ?? theme.border,
          },
          shadowStyle,
        ]}
      >
        <View style={[styles.mask, maskGrowStyle, { borderRadius: radius, backgroundColor: mat.contrastBase }]}>
          <View style={[content, padding]}>{children}</View>
        </View>
      </View>
    );
  }

  // Glass-on: a THIN beveled edge (top-light → bottom-shadow), drawn as a TRANSLUCENT
  // `LinearGradient` fill clipped by `borderRadius` — not a single View's border with three
  // different per-side colours (the old approach): RN's native border renderer doesn't reliably
  // curve/blend different border colours around a rounded corner (worse on Android), which could
  // render the corner as a flat cut even though the fill looks properly rounded. A gradient FILL
  // respecting borderRadius has no such issue on any platform. Because the gradient's colours are
  // themselves translucent (computeRimGradient's alphas), the fill still frosts the SCREEN FIELD
  // showing through the ring itself — so every card on a screen shares one uniform frosted hue and
  // the colour lives only in this thin edge (2026-07-18: thinner borders + fix the per-card
  // multi-hue frost bleed; 2026-07-21: fix the corner-rendering bug).
  const rim = computeRimGradient(edgeHue, isDark);
  const innerRadius = Math.max(0, radius - EDGE_WIDTH);
  return (
    <View style={[outer, { borderRadius: radius }, shadowStyle]}>
      <LinearGradient
        colors={rim.colors}
        locations={rim.locations}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.ring, maskGrowStyle, { borderRadius: radius, padding: EDGE_WIDTH }]}
      >
        <View style={[styles.mask, maskGrowStyle, { borderRadius: innerRadius }]}>
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
  // Glass-on only: the gradient ring (the LinearGradient in the render above) sits between the
  // outer shadow-casting view and the mask, `padding: EDGE_WIDTH` revealing itself as a thin ring
  // around the mask. alignSelf:'stretch' so it spans the full card width; the HEIGHT counterpart
  // (flexGrow) is applied conditionally via `maskGrowStyle`, same as `mask` below.
  ring: { alignSelf: 'stretch' },
  // alignSelf:'stretch' so the fill always spans the full card WIDTH even when the caller's
  // style centers content on the outer view (otherwise the mask shrink-wraps its children
  // and floats as a narrower box inside the bordered card). The HEIGHT counterpart
  // (flexGrow) is applied conditionally via `maskGrowStyle` above, not baked in here — see
  // that comment for why.
  mask: { overflow: 'hidden', alignSelf: 'stretch' },
});
