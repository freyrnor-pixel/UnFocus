/**
 * ScreenHeader.tsx — the standard screen top bar with tier-aware chrome.
 *
 * Tier 'site' (Decision 034): title left-aligned; Settings (gear) + Focus-mode (eye)
 * grouped in the opposite corner. Right-handed (default): title upper-left, controls
 * upper-right (Focus then gear outermost). Left-handed mirrors the whole row — controls
 * upper-left (gear outermost), title upper-right — so the controls stay thumb-reachable.
 * Tier 'sub': back link left (iOS only), title immediately right of it and left-aligned,
 * right slot for the screen-specific action (not mirrored). Wrapped in a translucent
 * Surface that picks up the user's bubbleMaterial setting.
 *
 * Connections:
 *   Imports → constants/theme, lib/i18n, lib/useAppTheme, store/useSettingsStore,
 *             components/Surface, expo-router
 *   Used by → ScreenScaffold (composition layer)
 *   Data    → reads `leftHanded` from the settings store to pick gear/eye corners
 *
 * Edit notes:
 *   - tier='site' is for top-level screens (Shopping, Plans, Home, Health, Scan)
 *   - tier='sub' is for sub-screens (forms, editors, modals)
 *   - **Focus-mode toggle (Decisions 009 #4 / 001a / 018)**: the right-slot eye is a live
 *     toggle ONLY when the screen passes `onToggleFocus` (Home does). Its user-facing label
 *     is "Calm view" (`t.calmView*`) — deliberately distinct from the persisted Settings
 *     "Focus mode" (`config.essentials`) so the two names don't collide (Point 2). `focusActive` drives
 *     the filled ('eye') vs outline ('eye-outline') glyph and the accent tint. Focus mode is
 *     Home-only + ephemeral, so every other site screen omits both props and the eye stays a
 *     harmless no-op placeholder (its historical Phase-1 state) rather than showing an active
 *     control that does nothing.
 *   - Settings (gear) press navigates to /settings. Site-tier chrome placement is
 *     handedness-aware (reads `leftHanded`, Decision 034): title + the grouped gear/eye
 *     controls swap sides together — controls right (title left) by default, both left
 *     (title right) when left-handed. gear is always the outermost control.
 *   - iOS-only back link on sub-screens; Android uses system back
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme } from '@/lib/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
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
  const leftHanded = useSettingsStore((s) => s.leftHanded);

  const handleSettingsPress = () => {
    router.push('/settings');
  };

  const handleFocusPress = () => {
    // Live only when a screen wires it (Home, per Decisions 009 #4 / 018). Elsewhere a no-op.
    onToggleFocus?.();
  };

  // Site-tier chrome: the settings gear and the Focus-mode eye. Their corners follow
  // the `leftHanded` setting (whose label promises it "moves the menu button to the
  // left side"): gear sits top-right by default, and swaps to top-left when left-handed.
  const gearButton = (
    <Pressable onPress={handleSettingsPress} hitSlop={8} accessibilityRole="button">
      <Ionicons name="settings-outline" size={24} color={theme.text} />
    </Pressable>
  );
  const focusButton = (
    <Pressable
      onPress={handleFocusPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: !!focusActive }}
      accessibilityLabel={focusActive ? t.calmViewActive : t.calmViewInactive}
    >
      <Ionicons
        name={focusActive ? 'eye' : 'eye-outline'}
        size={24}
        color={focusActive ? theme.accent : theme.text}
      />
    </Pressable>
  );

  const titleNode = (align: 'left' | 'right') => (
    <Text
      style={[styles.title, { color: theme.text, textAlign: align }]}
      numberOfLines={1}
    >
      {title}
    </Text>
  );

  if (tier === 'site') {
    // Grouped gear + eye. Order is Focus then gear so gear is outermost on whichever
    // side the group sits (Decision 034). Left-handed mirrors the whole row.
    const controls = leftHanded
      ? [gearButton, focusButton] // group sits left → gear outermost (far left)
      : [focusButton, gearButton]; // group sits right → gear outermost (far right)
    const controlsGroup = (
      <View style={styles.controls}>
        {controls.map((c, i) => (
          <View key={i}>{c}</View>
        ))}
      </View>
    );
    return (
      <Surface style={[styles.header, style]}>
        {leftHanded ? (
          <>
            {controlsGroup}
            {titleNode('right')}
          </>
        ) : (
          <>
            {titleNode('left')}
            {controlsGroup}
          </>
        )}
      </Surface>
    );
  }

  // Sub tier: back link (iOS) leftmost, title immediately right of it and left-aligned,
  // right slot for the screen-specific action. Not mirrored (back link is platform-fixed).
  return (
    <Surface style={[styles.header, style]}>
      {Platform.OS === 'ios' && onBack ? (
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={[styles.back, { color: theme.accent }]}>{t.back}</Text>
        </Pressable>
      ) : null}

      {titleNode('left')}

      <View style={styles.rightSlot}>{headerRight}</View>
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
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  rightSlot: {
    minWidth: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  back: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
