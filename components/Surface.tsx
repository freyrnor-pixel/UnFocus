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
 *   Imports → constants/theme, lib/useAppTheme, expo-blur, expo-linear-gradient
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
 *     Android wires
 *     `experimentalBlurMethod="dimezisBlurView"` (Decision 008 (2)).
 *   - The top sheen highlight is a single `<LinearGradient>` (expo-linear-gradient)
 *     fading mat.sheenColor to transparent — a real continuous gradient, not two
 *     overlapping flat-opacity Views. Two stacked flat rectangles read as a visible
 *     hard-edged step/band where they overlap instead of a smooth fade; don't
 *     reintroduce that pattern here.
 *   - `style` is split three ways: padding keys AND content-layout keys
 *     (alignItems/justifyContent/flexDirection/gap...) move to the inner content
 *     view; everything else non-owned (margin, width, flex, borderRadius...) stays
 *     on the outer shadow-casting view; the mask always `alignSelf:'stretch'`es to
 *     full width. Routing content-layout inward (not onto the outer view) is what
 *     stops the fill from shrink-wrapping its children and floating as a narrower
 *     "box inside the box". Any backgroundColor, border colors/width, or
 *     shadow/elevation in `style` is intentionally dropped — owned by the material.
 *   - shadowColor comes from the active theme's `shadow` token (not a fixed
 *     black), so depth itself shifts hue with the colour theme.
 *   - The sheen is suppressed in dark mode (useIsDark) — over near-black surfaces
 *     it reads as bright streaks and contradicts sunken wells; dark depth comes
 *     from border + shadow instead. Light mode keeps the sheen.
 *   - Pass `tint` for a non-default base (e.g. theme.offWhite for empty
 *     states, or an accent colour for a coloured card) — material shading is
 *     computed from this base.
 */
import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { getMaterialStyle, Radius } from '@/constants/theme';
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

export default function Surface({ surfaceContext = 'ambient', tint, style, children }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const base = tint ?? theme.surface;
  const mat = getMaterialStyle(base);
  const isGlass = true;

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
          borderColor: mat.borderColor,
          borderTopColor: mat.borderTopColor,
          borderBottomColor: mat.borderBottomColor,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: mat.shadowOpacity,
          shadowRadius: mat.shadowRadius,
          elevation: mat.elevation,
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
              experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
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
  // alignSelf:'stretch' so the fill always spans the full card even when the caller's
  // style centers content on the outer view (otherwise the mask shrink-wraps its children
  // and floats as a narrower box inside the bordered card).
  mask: { overflow: 'hidden', alignSelf: 'stretch' },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 30 },
});
