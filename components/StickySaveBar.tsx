/**
 * StickySaveBar.tsx — Sticky bottom save bar for day-pill groups.
 *
 * Animates up from the bottom (translateY 100%→0) over 200ms when any pill in a group
 * is toggled. Contains a label, an undo button to revert changes, and a save button to
 * confirm. Position is sticky within a scroll container.
 *
 * Connections:
 *   Imports → react-native-reanimated, constants/theme, lib/useAppTheme
 *   Used by → app/settings.tsx (work days, reset days) — not ported yet; this is a
 *             leaf ahead of its screen
 *   Data    → controlled via `visible`; fires `onSave` and `onRevert` callbacks
 *
 * Edit notes:
 *   - Filename corrected from the old repo's `SticklySaveBar.tsx` typo to
 *     `StickySaveBar.tsx` (REBUILD_PLAN.md's 3e list already uses the correct name).
 *   - Uses react-native-reanimated v4 (withTiming for translateY + opacity)
 *   - Appears at bottom of scrollable content (parent handles positioning)
 *   - Label text is muted (secondary color)
 *   - `label`/`saveLabel`/`undoLabel` are required — caller passes i18n strings (no
 *     hardcoded Norwegian fallback text).
 *   - Undo is a ghost button (no background); Save is accent-filled.
 *   - `theme` prop dropped in favor of internal useAppTheme() — established Phase 3
 *     convention. Token remap: offWhite→surfaceMuted, grayLight→border,
 *     textLight→textMuted, orange→accent, hardcoded white save-text→accentInk.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  withTiming,
  useSharedValue,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { FontSize, Fonts } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

export interface StickySaveBarProps {
  visible: boolean;
  onSave: () => void;
  onRevert: () => void;
  label: string;
  saveLabel: string;
  undoLabel: string;
}

const ANIMATION_DURATION = 200; // 200ms per spec

const AnimatedView = Animated.createAnimatedComponent(View);

export function StickySaveBar({
  visible,
  onSave,
  onRevert,
  label,
  saveLabel,
  undoLabel,
}: StickySaveBarProps) {
  const theme = useAppTheme();
  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: ANIMATION_DURATION,
        easing: Easing.ease,
      });
      opacity.value = withTiming(1, {
        duration: ANIMATION_DURATION,
        easing: Easing.ease,
      });
    } else {
      translateY.value = withTiming(100, {
        duration: ANIMATION_DURATION,
        easing: Easing.ease,
      });
      opacity.value = withTiming(0, {
        duration: ANIMATION_DURATION,
        easing: Easing.ease,
      });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <AnimatedView
      style={[
        styles.bar,
        animatedStyle,
        { backgroundColor: theme.surfaceMuted, borderTopColor: theme.border },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
      <Pressable style={styles.ghostButton} onPress={onRevert} hitSlop={6}>
        <Text style={[styles.ghostText, { color: theme.textMuted }]}>{undoLabel}</Text>
      </Pressable>
      <Pressable
        style={[styles.primaryButton, { backgroundColor: theme.accent }]}
        onPress={onSave}
        hitSlop={6}
      >
        <Text style={[styles.primaryText, { color: theme.accentInk }]}>{saveLabel}</Text>
      </Pressable>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
  },
  label: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
  },
  ghostButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ghostText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semibold,
  },
});
