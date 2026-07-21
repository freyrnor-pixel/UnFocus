/**
 * TabBoxHighlight.tsx — the "keycap" box behind an in-screen tab-bar item (Settings'
 * category tabs, Plans/Tasks' Today|Week|All, Shopping's Weekly|Monthly|Food|Catalogue).
 *
 * Always renders a FILLED box — `theme.surface` (white/near-white) fill + `theme.border` edge
 * at rest, crossfading via `useToggleColor` to a tinted `accent` fill + border when active.
 * The box itself is opaque so the ambient background does NOT show through it; the surrounding
 * tab-bar strip is transparent instead (each screen's sticky tab-bar container has no fill),
 * so the ambient background shows AROUND these chips but not inside them (2026-07-20). Distinct
 * from `components/BottomNav.tsx`'s own inline `NavTabItem` (same box idea, kept local there
 * since it's a single call site); this one exists because the pattern was previously
 * hand-duplicated across three screens' tab bars.
 *
 * Connections:
 *   Imports → react-native-reanimated (Animated.View), constants/theme (Radius, mix, rgba),
 *             lib/useAppTheme, lib/useToggleColor
 *   Used by → app/settings.tsx, app/(tabs)/plans.tsx, app/(tabs)/shopping.tsx (each screen's
 *             sticky tab bar, absolutely filled behind the tab's label/icon)
 *   Data    → none (presentational)
 *
 * Edit notes:
 *   - Render as the FIRST child of the tab's Pressable so it paints below the label
 *     (absoluteFill + pointerEvents="none").
 *   - `accent` defaults to `theme.accent`; pass a per-tab domain colour (e.g. Shopping's
 *     per-tab accent) for a tab bar where each tab has its own hue.
 *   - Caller owns layout (flex/minHeight/padding) on the Pressable itself — this component
 *     only owns the box's fill/border/radius.
 *   - **Active fill must stay opaque (2026-07-21 fix)**: it's `mix(theme.surface, tint, 0.35)`
 *     (an opaque blend), not `rgba(tint, alpha)`. rgba is translucent, so it let the frosted
 *     tab-bar strip behind it — and anything scrolling under that strip — show through the
 *     selected chip, reading as "text visible through the active tab." Don't swap this back to
 *     rgba without re-checking that against the frosted `overlay` strip it always sits on.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Radius, mix, rgba } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useToggleColor } from '@/lib/useToggleColor';

type Props = {
  active: boolean;
  accent?: string;
};

export default function TabBoxHighlight({ active, accent }: Props) {
  const theme = useAppTheme();
  const tint = accent ?? theme.accent;
  // Filled box: opaque fill + border both crossfade (surface→tinted, neutral→accent) so the
  // chip stays solid and the ambient background shows only in the strip AROUND it, not inside.
  // Active fill is `mix()` (opaque blend of surface+tint), NOT `rgba(tint, alpha)` — an rgba
  // fill is translucent and let the frosted tab-bar strip (and any content scrolling behind
  // it) show through the "selected" chip, reading as text bleeding through the active tab.
  const boxStyle = useToggleColor(active, {
    backgroundColor: [theme.surface, mix(theme.surface, tint, 0.35)],
    borderColor: [theme.border, rgba(tint, 0.4)],
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.box, boxStyle]} />
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
});
