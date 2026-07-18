/**
 * IconButton.tsx — circular icon-only button. Round affordance for settings, focus, etc.
 *
 * Defaults to soft chip fill; pass `tint` for background override. `active` state shows
 * accent background + border. Always pass `label` for accessibility.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, lib/useToggleColor (animated active-state
 *             background/border crossfade), react-native-reanimated, components/PressableScale
 *   Used by → header actions, focus toggles, standalone icon controls
 *   Data    → none (purely presentational)
 *
 * Edit notes:
 *   - `size` controls outer button size (default 36); hit target always >=44px (achieved via Pressable wrapper).
 *   - Icon size is automatically 50% of button size.
 *   - `active` crossfades the background (→ accentSoft) and border (transparent → accent) via
 *     useToggleColor; icon colour swaps instantly to accent on top. Border is always 1.5px
 *     (transparent when inactive) so toggling active never shifts the icon by the border width.
 *   - Default (inactive, enabled) icon colour is `text`; disabled icon colour is `textMuted`.
 */
import React from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import { useToggleColor } from '@/lib/useToggleColor';
import PressableScale from '@/components/PressableScale';

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
      <Animated.View style={[
        styles.base,
        { width: size, height: size, borderWidth: 1.5 },
        animatedStyle,
      ]}>
        <Ionicons name={icon} size={iconSize} color={fgColor} />
      </Animated.View>
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
