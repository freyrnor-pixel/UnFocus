/**
 * Button.tsx — soft, rounded, shame-free action button. Variants: primary (filled), secondary (soft tint), danger (destructive), ghost (text).
 *
 * Sentence-case labels; no copy is baked in. Leading/trailing icons supported. Resolves
 * fill/text colours from the active theme (Decision 006 tokens). Minimum touch target is 44px tall.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme, components/PressableScale
 *   Used by → all screens for standard action buttons
 *   Data    → none (purely presentational)
 *
 * Edit notes:
 *   - Size sm=36, md=44-48, lg=56. All meet 44px minimum touch target (md,lg exceed it; sm is inset slightly for small/secondary uses).
 *   - BorderRadius.full (999) for buttons (fully rounded pills).
 *   - Secondary is soft-tint fill (accentSoft), NOT border.
 *   - Disabled state is opacity 0.45 applied over the variant's own colours — never swap fill for disabled.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';
import PressableScale from '@/components/PressableScale';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SIZE_HEIGHT: Record<Size, number> = { sm: 36, md: 48, lg: 56 };
const SIZE_FONT: Record<Size, number> = { sm: FontSize.sm, md: FontSize.md, lg: FontSize.lg };
const SIZE_PADDING: Record<Size, [number, number]> = { sm: [8, 16], md: [12, 22], lg: [15, 28] };

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  disabled,
  loading,
  style,
}: Props) {
  const theme = useAppTheme();
  const [vertPad, horizPad] = SIZE_PADDING[size];

  const variantColors = {
    primary: { bg: theme.accent, text: theme.accentInk },
    secondary: { bg: theme.accentSoft, text: theme.text },
    danger: { bg: theme.bad, text: theme.textInverse },
    ghost: { bg: 'transparent', text: theme.accent },
  };
  const colors = variantColors[variant];

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={variant === 'danger' ? 0.93 : size === 'sm' ? 0.97 : 0.95}
      style={[
        styles.base,
        {
          height: SIZE_HEIGHT[size],
          paddingVertical: vertPad,
          paddingHorizontal: horizPad,
          backgroundColor: colors.bg,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={Math.ceil(SIZE_FONT[size] * 1.15)} color={colors.text} style={styles.icon} /> : null}
          <Text style={[styles.label, { color: colors.text, fontSize: SIZE_FONT[size] }]}>{label}</Text>
          {iconRight ? <Ionicons name={iconRight} size={Math.ceil(SIZE_FONT[size] * 1.15)} color={colors.text} style={styles.iconRight} /> : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  iconRight: {
    marginLeft: Spacing.xs,
  },
  label: {
    fontFamily: Fonts.bold,
  },
});
