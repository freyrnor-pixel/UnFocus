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
 *     components/GlassFill.tsx; Surface owns the outer view (layered shadow + layout), the THIN
 *     beveled EDGE (a single ~1.5px border with per-side top-light/bottom-shadow bevel colours),
 *     the overflow:hidden mask, and the style-splitting contract. The `surfaceContext` prop
 *     (`'ambient'` default | `'overlay'`) selects GlassFill's blur intensity AND wash alpha —
 *     ambient cards get NO BlurView (wash-only, cheapest path); overlay surfaces
 *     (sheets/modals/nav) get a real frost. What sits *behind* the card (ScreenBackground
 *     colour field for ambient, live scrolling content for overlay) is decided by where the
 *     caller mounts the Surface, not here.
 *   - **Colour-architecture inversion (2026-07-18, retuned)**: the translucent FILL frosts the
 *     ScreenBackground FIELD showing through behind the card, so every card on a screen shares
 *     one uniform frosted hue; the domain/screen COLOUR lives ONLY in the thin beveled EDGE. The
 *     border is a real RN border on the mask (NOT a full-rect gradient ring behind the fill) —
 *     that's what stops each card bleeding its own edge colour through the fill (the earlier
 *     thick-ring version tinted every card's whole face, reading as a multi-hue screen).
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
 *     as a top-lit highlight, dark mode a uniform themed edge. Glass-ON is a THIN beveled edge
 *     (~1.5px, `bevelEdge()`): one border line with a lit top / true-hue sides / darker bottom,
 *     in the edge hue (screen hue, or the `borderColor`/`tint` override) — a raised key without
 *     the old thick-ring heft, and thin enough that the colour reads as an accent, not a frame.
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
import { darken, getElevation, getLayeredShadow, getMaterialStyle, lighten, Radius } from '@/constants/theme';
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

// Thin beveled edge (2026-07-18 "make borders thinner"): a single hairline-ish border, not the old
// thick gradient padding-ring + inner line. `EDGE_WIDTH` is the whole border now — one crisp line
// with a top-light/bottom-shadow bevel (per-side colours) that still reads as a raised key without
// the heft. Kept as a real RN border on the mask (not a full-rect LinearGradient) precisely so the
// translucent fill frosts the SCREEN FIELD behind the card — colour only in this thin edge — which
// is what keeps every card on a screen a single, uniform frosted hue instead of each bleeding its
// own domain colour through the fill (the multi-hue "some screens one hue, others more" report).
const EDGE_WIDTH = 1.5;

// Per-side bevel colours from one hue: a lit top lip, the true hue on the sides, a darker shadow at
// the bottom — a thin shaded edge that reads as a raised key. Opaque so a domain edge stays crisp
// against a same-hue field (e.g. a blue-edged card on the blue Home field).
function bevelEdge(hue: string, isDark: boolean): { top: string; side: string; bottom: string } {
  return isDark
    ? { top: lighten(hue, 0.24), side: hue, bottom: darken(hue, 0.20) }
    : { top: lighten(hue, 0.14), side: hue, bottom: darken(hue, 0.22) };
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
  // sub-tier screens (no hue). Whatever wins becomes the thin beveled border's hue (bevelEdge).
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

  // Glass-on: a THIN beveled edge (top-light → bottom-shadow) drawn as a real border on the
  // overflow-hidden mask, over a TRANSLUCENT frosted fill. Because the border is a real RN border
  // (not a full-rect gradient ring behind the fill), the fill frosts the SCREEN FIELD showing
  // through — so every card on a screen shares one uniform frosted hue and the colour lives only in
  // this thin edge (2026-07-18: thinner borders + fix the per-card multi-hue frost bleed).
  const rim = bevelEdge(edgeHue, isDark);
  const innerRadius = Math.max(0, radius - EDGE_WIDTH);
  return (
    <View style={[outer, { borderRadius: radius }, shadowStyle]}>
      <View
        style={[
          styles.mask,
          {
            borderRadius: radius,
            borderWidth: EDGE_WIDTH,
            borderColor: rim.side,
            borderTopColor: rim.top,
            borderBottomColor: rim.bottom,
          },
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
