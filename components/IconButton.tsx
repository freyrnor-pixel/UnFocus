/**
 * IconButton.tsx — circular icon-only button. Round affordance for settings, focus, etc.
 *
 * Defaults to soft chip fill; pass `tint` for background override. `active` state shows
 * accent background + border. Always pass `label` for accessibility.
 *
 * Connections:
 *   Imports → constants/theme (incl. computeRimGradient), lib/useAppTheme, lib/useToggleColor
 *             (animated active-state background/border crossfade), store/useSettingsStore
 *             (glassSurfaces), react-native-reanimated, expo-linear-gradient,
 *             components/PressableScale
 *   Used by → header actions, focus toggles, standalone icon controls
 *   Data    → reads `glassSurfaces` from the settings store
 *
 * Edit notes:
 *   - `size` controls outer button size (default 36); hit target always >=44px (achieved via Pressable wrapper).
 *   - Icon size is automatically 50% of button size.
 *   - `active` crossfades the background (→ accentSoft) and border (transparent → accent) via
 *     useToggleColor; icon colour swaps instantly to accent on top. Border is always 1.5px
 *     (transparent when inactive) so toggling active never shifts the icon by the border width.
 *   - Default (inactive, enabled) icon colour is `text`; disabled icon colour is `textMuted`.
 *   - **Keycap bevel ring (2026-07-21)**: when `settings.glassSurfaces` is on, the circular fill
 *     is wrapped in the same rim-gradient technique Button.tsx/Surface.tsx already use
 *     (`computeRimGradient`, light-top/dark-bottom, 3 gradient stops) — a `LinearGradient` ring
 *     (`padding: EDGE_WIDTH`) around the existing fill+border `Animated.View`, which becomes the
 *     inner "double keycap" line. Rim hue follows the same base the fill is already crossfading
 *     toward/from (`inactiveBg` → `theme.accent`), snapped instantly on `active` change (not
 *     animated — LinearGradient colors aren't cheaply tweenable; only the inner fill/border keep
 *     crossfading via useToggleColor). Glass-off renders exactly the pre-2026-07-21 flat circle,
 *     unchanged.
 */
import React from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Radius, computeRimGradient } from '@/constants/theme';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useToggleColor } from '@/lib/useToggleColor';
import { useSettingsStore } from '@/store/useSettingsStore';
import PressableScale from '@/components/PressableScale';

const EDGE_WIDTH = 1.5;

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  size?: number;
  tint?: string;
  color?: string;
  active?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function IconButton({
  icon,
  label,
  onPress,
  size = 36,
  tint,
  color,
  active = false,
  disabled,
  style,
}: Props) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const glass = useSettingsStore((s) => s.glassSurfaces);
  const iconSize = Math.round(size * 0.5);
  const hitTarget = Math.max(44, size + 8);

  const inactiveBg = tint ?? theme.surfaceMuted;
  const fgColor = color ?? (disabled ? theme.textMuted : active ? theme.accent : theme.text);

  // Background + border crossfade between inactive and active as `active` flips (the icon
  // colour swaps instantly on top, matching the SlideSelector convention). Inactive keeps a
  // VISIBLE thin edge (theme.border) — matching the cards' thin beveled edge so icon-buttons read
  // as the same family of raised keys (2026-07-18 "border around icons and buttons") — rather than
  // the old fully-transparent inactive border that left them edgeless.
  const animatedStyle = useToggleColor(active, {
    backgroundColor: [inactiveBg, theme.accentSoft],
    borderColor: [theme.border, theme.accent],
  });

  // Ring adds EDGE_WIDTH padding around the fill, so the fill shrinks to match when the ring
  // is showing — the overall button footprint (and hit target) stays exactly `size`, no layout
  // shift versus the glass-off circle.
  const innerSize = glass ? size - EDGE_WIDTH * 2 : size;
  const rim = computeRimGradient(active ? theme.accent : inactiveBg, isDark);
  const fill = (
    <Animated.View style={[
      styles.base,
      { width: innerSize, height: innerSize, borderWidth: 1.5 },
      animatedStyle,
    ]}>
      <Ionicons name={icon} size={iconSize} color={fgColor} />
    </Animated.View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.9}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      style={[
        styles.hit,
        { width: hitTarget, height: hitTarget, opacity: disabled ? 0.45 : 1 },
        style,
      ]}
    >
      {glass ? (
        <LinearGradient
          colors={rim.colors}
          locations={rim.locations}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ width: size, height: size, borderRadius: Radius.full, padding: EDGE_WIDTH, alignItems: 'center', justifyContent: 'center' }}
        >
          {fill}
        </LinearGradient>
      ) : fill}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  base: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
