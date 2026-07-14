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
 *   Imports → constants/theme (incl. getElevation), lib/useAppTheme, expo-blur, expo-linear-gradient
 *   Used by → app screens that render a "card" surface (see grep for `<Surface`)
 *   Data    → —
 *
 * Edit notes:
 *   - Glass (and only glass) is built around a real `<BlurView>` (expo-blur) per
 *     Decision 008: the fill is an absolutely-positioned BlurView frosting whatever
 *     sits behind the card, plus a colour wash (mat.backgroundColor's hue re-applied
 *     at GLASS_WASH_ALPHA, context-specific and close to opaque) so text on the card
 *     keeps the same contrast guarantees as every other material regardless of what's
 *     blurred behind it. The `surfaceContext` prop (`'ambient'` default | `'overlay'`)
 *     selects the blur intensity AND the wash alpha — one shared code path; what sits
 *     *behind* the card (ScreenBackground backdrop for ambient, live scrolling content
 *     for overlay) is decided by where the caller mounts the Surface, not here.
 *   - Android's BlurView renders with `experimentalBlurMethod="none"` (2026-07-13 fix,
 *     superseding Decision 008 (2)'s `"dimezisBlurView"`): as of expo-blur's SDK 55+
 *     implementation, `dimezisBlurView` requires wrapping the blurred backdrop in a
 *     `BlurTargetView` and passing its ref to `BlurView` — Surface never did this, so the
 *     blur was silently misconfigured. Worse, it's documented broken inside a React
 *     Native `<Modal>` (expo/expo#44165 — BlurTargetView can't cross the Modal's separate
 *     native window), and in practice the misconfigured native view was intercepting
 *     touches meant for children underneath it (PressableScale headers going dead —
 *     e.g. ExpandableCard rows in Settings not responding to taps). The colour wash
 *     below is already GLASS_WASH_ALPHA (0.92–0.97, near-opaque), so disabling the
 *     native blur on Android is visually near-invisible while removing a broken native
 *     view from the tree entirely. iOS is unaffected (`undefined` uses its native blur,
 *     which never had this requirement).
 *   - The top sheen highlight is a single `<LinearGradient>` (expo-linear-gradient)
 *     fading mat.sheenColor to transparent — a real continuous gradient, not two
 *     overlapping flat-opacity Views. Two stacked flat rectangles read as a visible
 *     hard-edged step/band where they overlap instead of a smooth fade; don't
 *     reintroduce that pattern here.
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
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { getElevation, getMaterialStyle, Radius } from '@/constants/theme';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';

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

// Rewrites the alpha channel of an `rgba(r, g, b, a)` string, keeping its hue.
function withAlpha(color: string, alpha: number): string {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return color;
  const [r, g, b] = match[1].split(',').map((p) => p.trim());
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  const base = tint ?? theme.surface;
  const mat = getMaterialStyle(base);
  const isGlass = true;
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

  // The raised-material sheen reads as bright streaks over near-black dark surfaces (and
  // contradicts a sunken well), so suppress it in dark mode and lean on border + shadow for
  // depth. Light mode keeps the sheen.
  const showSheen = !isDark;

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
          shadowColor: theme.shadow,
          shadowOffset: elevation ? elevation.shadowOffset : { width: 0, height: 2 },
          shadowOpacity: elevation ? elevation.shadowOpacity : mat.shadowOpacity,
          shadowRadius: elevation ? elevation.shadowRadius : mat.shadowRadius,
          elevation: elevation ? elevation.elevation : mat.elevation,
        },
      ]}
    >
      <View style={[styles.mask, { borderRadius: radius }, isGlass ? null : { backgroundColor: mat.backgroundColor }]}>
        {isGlass && (
          <>
            {/* Real frost: blurs whatever the caller mounted behind this card
                (ScreenBackground backdrop for ambient, live content for overlay). */}
            <BlurView
              pointerEvents="none"
              tint={isDark ? 'dark' : 'light'}
              intensity={GLASS_BLUR_INTENSITY[surfaceContext]}
              experimentalBlurMethod={Platform.OS === 'android' ? 'none' : undefined}
              style={StyleSheet.absoluteFill}
            />
            {/* Colour wash so the glass carries the theme/tint hue while staying opaque
                enough for the card's text to hit the same contrast ratios as every
                other material (see GLASS_WASH_ALPHA above). */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(mat.backgroundColor, GLASS_WASH_ALPHA[surfaceContext]) }]} />
          </>
        )}
        {showSheen && (
          <LinearGradient
            pointerEvents="none"
            colors={[mat.sheenColor, 'transparent']}
            style={[styles.sheen, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]}
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
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 30 },
});
