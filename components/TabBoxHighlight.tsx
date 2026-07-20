/**
 * TabBoxHighlight.tsx — the "keycap" box behind an in-screen tab-bar item (Settings'
 * category tabs, Plans/Tasks' Today|Week|All, Shopping's Weekly|Monthly|Food|Catalogue).
 *
 * Always renders — `theme.surface` (white/near-white) fill + `theme.border` edge at rest,
 * crossfading via `useToggleColor` to a tinted `accent` fill + border when active. Distinct
 * from `components/BottomNav.tsx`'s own inline `NavTabItem` (same idea, kept local there
 * since it's a single call site); this one exists because the identical "box only appears
 * when active" pattern was previously hand-duplicated across three screens.
 *
 * Connections:
 *   Imports → react-native-reanimated (Animated.View), constants/theme (Radius, rgba),
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
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Radius, rgba } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useToggleColor } from '@/lib/useToggleColor';

type Props = {
  active: boolean;
  accent?: string;
};

export default function TabBoxHighlight({ active, accent }: Props) {
  const theme = useAppTheme();
  const tint = accent ?? theme.accent;
  const boxStyle = useToggleColor(active, {
    backgroundColor: [theme.surface, rgba(tint, 0.14)],
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
