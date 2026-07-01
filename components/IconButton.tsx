/**
 * IconButton.tsx — circular icon-only button. Round affordance for settings, focus, etc.
 *
 * Defaults to soft chip fill; pass `tint` for background override. `active` state shows
 * accent background + border. Always pass `label` for accessibility.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, components/PressableScale
 *   Used by → header actions, focus toggles, standalone icon controls
 *   Data    → none (purely presentational)
 *
 * Edit notes:
 *   - `size` controls outer button size (default 36); hit target always >=44px (achieved via Pressable wrapper).
 *   - Icon size is automatically 50% of button size.
 *   - `active` adds accentSoft background + accent border, icon colour accent.
 *   - Default (inactive, enabled) icon colour is `text`; disabled icon colour is `textMuted`.
 */
import React from 'react';
import { StyleSheet, StyleProp, ViewStyle, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
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

  const bgColor = active ? theme.accentSoft : (tint ?? theme.surfaceMuted);
  const fgColor = color ?? (disabled ? theme.textMuted : active ? theme.accent : theme.text);
  const borderColor = active ? theme.accent : 'transparent';

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
      <View style={[
        styles.base,
        {
          width: size,
          height: size,
          backgroundColor: bgColor,
          borderWidth: active ? 1.5 : 0,
          borderColor: borderColor,
        },
      ]}>
        <Ionicons name={icon} size={iconSize} color={fgColor} />
      </View>
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
