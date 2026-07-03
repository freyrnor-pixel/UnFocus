/**
 * ScreenHeader.tsx — the standard screen top bar with tier-aware chrome.
 *
 * Tier 'site': Settings (gear) left, title centered, Focus-mode right.
 * Tier 'sub': back link left (iOS only), title centered, right slot for
 * screen-specific action. Wrapped in a translucent Surface that picks up
 * the user's bubbleMaterial setting.
 *
 * Connections:
 *   Imports → constants/theme, lib/i18n, lib/useAppTheme, components/Surface, expo-router
 *   Used by → ScreenScaffold (composition layer)
 *   Data    → none (presentational; press handlers navigate)
 *
 * Edit notes:
 *   - tier='site' is for top-level screens (Shopping, Plans, Home, Health, Scan)
 *   - tier='sub' is for sub-screens (forms, editors, modals)
 *   - **Focus-mode toggle (Decisions 009 #4 / 001a / 018)**: the right-slot eye is a live
 *     toggle ONLY when the screen passes `onToggleFocus` (Home does). `focusActive` drives
 *     the filled ('eye') vs outline ('eye-outline') glyph and the accent tint. Focus mode is
 *     Home-only + ephemeral, so every other site screen omits both props and the eye stays a
 *     harmless no-op placeholder (its historical Phase-1 state) rather than showing an active
 *     control that does nothing.
 *   - Settings press navigates to /settings; flag for resolution in phase 2
 *   - iOS-only back link on sub-screens; Android uses system back
 */
import React, { Platform } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import Surface from '@/components/Surface';

type Tier = 'site' | 'sub';

type Props = {
  title: string;
  tier: Tier;
  onBack?: () => void;
  headerRight?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Focus-mode toggle (Home only). When provided, the right-slot eye toggles focus. */
  focusActive?: boolean;
  onToggleFocus?: () => void;
};

export default function ScreenHeader({ title, tier, onBack, headerRight, style, focusActive, onToggleFocus }: Props) {
  const t = useT();
  const theme = useAppTheme();
  const router = useRouter();

  const handleSettingsPress = () => {
    router.push('/settings');
  };

  const handleFocusPress = () => {
    // Live only when a screen wires it (Home, per Decisions 009 #4 / 018). Elsewhere a no-op.
    onToggleFocus?.();
  };

  return (
    <Surface style={[styles.header, style]}>
      <View style={styles.leftSlot}>
        {tier === 'site' ? (
          <Pressable onPress={handleSettingsPress} hitSlop={8}>
            <Ionicons name="settings-outline" size={24} color={theme.text} />
          </Pressable>
        ) : Platform.OS === 'ios' && onBack ? (
          <Pressable onPress={onBack} hitSlop={8}>
            <Text style={[styles.back, { color: theme.orange }]}>{t.back}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.rightSlot}>
        {tier === 'site' ? (
          <Pressable
            onPress={handleFocusPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ selected: !!focusActive }}
            accessibilityLabel={focusActive ? t.focusActive : t.focusInactive}
          >
            <Ionicons
              name={focusActive ? 'eye' : 'eye-outline'}
              size={24}
              color={focusActive ? theme.accent : theme.text}
            />
          </Pressable>
        ) : (
          headerRight
        )}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  leftSlot: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  rightSlot: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
