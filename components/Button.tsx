/**
 * Button.tsx — soft, rounded, shame-free action button. Variants: primary (filled), secondary (soft tint), danger (destructive), ghost (text).
 *
 * Sentence-case labels; no copy is baked in. Leading/trailing icons supported. Resolves
 * fill/text colours from the active theme (Decision 006 tokens). Minimum touch target is 44px tall.
 *
 * Connections:
 *   Imports → constants/theme (getMaterialStyle), lib/useAppTheme, store/useSettingsStore
 *             (glassSurfaces), components/PressableScale, components/GlassFill
 *   Used by → all screens for standard action buttons
 *   Data    → reads `glassSurfaces` from the settings store
 *
 * Edit notes:
 *   - Size sm=36, md=44-48, lg=56. All meet 44px minimum touch target (md,lg exceed it; sm is inset slightly for small/secondary uses).
 *   - BorderRadius.full (999) for buttons (fully rounded pills).
 *   - Secondary is soft-tint fill (accentSoft), NOT border.
 *   - Disabled state is opacity 0.45 applied over the variant's own colours — never swap fill for disabled.
 *   - Glass: primary/secondary/danger render components/GlassFill (frost + wash, ≤2 layers)
 *     over a transparent PressableScale (so the frost blurs the screen, not a solid fill) with the
 *     near-opaque `'button'` material for CTA contrast; `ghost` (no fill) is never glass. Off when
 *     settings.glassSurfaces is false — back to the solid `colors.bg` pill. PressableScale still owns
 *     the animated press depth in both modes.
 *   - Purposeful Depth System (2026-07-14): primary/secondary/danger pass PressableScale's
 *     `depth="raised"` (solid-fill, physical — reads as tappable); `ghost` (text-only) stays
 *     flat/unset since it has no fill to cast a shadow from.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, getMaterialStyle, Radius, Spacing } from '@/constants/theme';
import { useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import PressableScale from '@/components/PressableScale';
import GlassFill from '@/components/GlassFill';

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
  const isDark = useIsDark();
  const glass = useSettingsStore((s) => s.glassSurfaces);
  const [vertPad, horizPad] = SIZE_PADDING[size];

  const variantColors = {
    primary: { bg: theme.accent, text: theme.accentInk },
    secondary: { bg: theme.accentSoft, text: theme.text },
    danger: { bg: theme.bad, text: theme.textInverse },
    ghost: { bg: 'transparent', text: theme.accent },
  };
  const colors = variantColors[variant];
  // Ghost is text-only (no fill) → never glass. Others render the take-two glass fill when
  // enabled: the near-opaque `'button'` material keeps the CTA's ink contrast (see
  // getMaterialStyle) while adding rim/specular/drift. When glass is on the PressableScale's
  // own backgroundColor drops to transparent so the frost blurs the screen (not a solid fill
  // sitting under it); the glass wash provides the colour.
  const useGlass = glass && variant !== 'ghost';
  const mat = getMaterialStyle(colors.bg, 'button');

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      scaleTo={variant === 'danger' ? 0.93 : size === 'sm' ? 0.97 : 0.95}
      depth={variant === 'ghost' ? undefined : 'raised'}
      style={[
        styles.base,
        {
          height: SIZE_HEIGHT[size],
          paddingVertical: vertPad,
          paddingHorizontal: horizPad,
          backgroundColor: useGlass ? 'transparent' : colors.bg,
          overflow: useGlass ? 'hidden' : undefined,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {useGlass && (
        <GlassFill
          mat={mat}
          radius={Radius.full}
          blurIntensity={20}
          tint={isDark ? 'dark' : 'light'}
        />
      )}
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
