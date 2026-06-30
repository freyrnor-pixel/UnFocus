/**
 * Surface.tsx — material-aware card surface, the general-purpose sibling of
 * BubbleMenu's bubble/FAB rendering.
 *
 * Wraps children in the same two-layer pattern (outer view carries border +
 * shadow, inner overflow:hidden mask carries fill + sheen) so any card can
 * pick up the user's chosen glass/metal/rock/paper/plain finish instead of a
 * flat fill — this is what makes "backgrounds and the material things are
 * made of" actually track the Settings → Material choice outside the bubble
 * menu. Drop-in replacement for `<View style={[styles.card, {backgroundColor:
 * theme.white}]}>` — pass the same `style` (radius/margin/padding all still
 * work; padding is automatically moved to the inner content so the sheen
 * still spans the full card).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, store/useSettingsStore
 *   Used by → app screens that render a "card" surface (see grep for `<Surface`)
 *   Data    → reads bubbleMaterial from useSettingsStore when `material` prop is omitted
 *
 * Edit notes:
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
 *   - The top sheen highlight is suppressed in dark mode (useIsDark) — over
 *     near-black surfaces it reads as bright streaks and contradicts sunken wells;
 *     dark depth comes from border + shadow instead. Light mode keeps the sheen.
 *   - Pass `tint` for a non-default base (e.g. theme.offWhite for empty
 *     states, or an accent colour for a coloured card) — material shading is
 *     computed from this base.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { getMaterialStyle, MaterialName, Radius } from '@/constants/theme';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';

type Props = {
  material?: MaterialName;
  tint?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
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

export default function Surface({ material, tint, style, children }: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const settingsMaterial = useSettingsStore((s) => s.bubbleMaterial);
  const finish = material ?? settingsMaterial;
  const base = tint ?? theme.white;
  const mat = getMaterialStyle(base, finish);

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
  // depth. Light mode keeps the full sheen.
  const sheenOuterOpacity = isDark ? 0 : 0.3;
  const sheenInnerOpacity = isDark ? 0 : 0.55;

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
      <View style={[styles.mask, { borderRadius: radius, backgroundColor: mat.backgroundColor }]}>
        {sheenOuterOpacity > 0 && (
          <View pointerEvents="none" style={[styles.sheenOuter, { backgroundColor: mat.sheenColor, opacity: sheenOuterOpacity, borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
        )}
        {sheenInnerOpacity > 0 && (
          <View pointerEvents="none" style={[styles.sheenInner, { backgroundColor: mat.sheenColor, opacity: sheenInnerOpacity, borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
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
  sheenOuter: { position: 'absolute', top: 0, left: 0, right: 0, height: 30 },
  sheenInner: { position: 'absolute', top: 0, left: 0, right: 0, height: 14 },
});
