/**
 * SlideSelector.tsx — the segmented "slider" control for the Tasks/Oppgaver screen.
 *
 * N options in a pill track: a solid accent fill sits on the selected segment, the
 * rest keep a muted, recessed background. Distinct from FormControls.SegmentedControl
 * (which raises the active segment to a light surface) — this is the darker-fill look
 * the Tasks redesign spec calls for. Used for Day/Week/Month, the monthly day|ordinal
 * sub-toggle, the week-interval (1/2/3), and Normal/Important.
 *
 * The accent fill is a single absolutely-positioned pill that SLIDES between segments
 * (Reanimated translateX, ~150ms ease-out) instead of hard-jumping — the shared motion
 * for every SlideSelector instance. Snaps instantly under reducedMotion (§7). A
 * `selection()` haptic fires on each change (ANIMATION_GUIDELINES §4: segmented controls).
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme (useAppTheme, useAccessibility), lib/haptics,
 *             components/PressableScale, react-native-reanimated
 *   Used by → components/TaskCard.tsx, app/(tabs)/health.tsx (Today/Week/Month view tabs)
 *   Data    → none (controlled; value/options/onChange from props)
 *
 * Edit notes:
 *   - Values are compared with ===; label is caller-localized.
 *   - `compact` shrinks padding/font for the tight week-interval / ordinal rows.
 *   - The sliding pill is sized from the track's measured width/height (onLayout): segments
 *     are flex:1 so segW = (trackW - padding*2 - gap*(n-1)) / n, and translateX steps by
 *     (segW + gap). The pill renders as the FIRST child so RN paints it BELOW the label
 *     segments (paint order = document order) — labels stay on top, no zIndex needed.
 */
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';
import { selection } from '@/lib/haptics';
import PressableScale from '@/components/PressableScale';

export type SlideOption<T extends string | number> = { value: T; label: string };

type Props<T extends string | number> = {
  options: SlideOption<T>[];
  value: T;
  onChange: (next: T) => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  compact?: boolean;
};

const TRACK_PAD = 3;
const TRACK_GAP = 3;

export default function SlideSelector<T extends string | number>({
  options,
  value,
  onChange,
  style,
  disabled,
  compact,
}: Props<T>) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const [track, setTrack] = useState({ w: 0, h: 0 });

  const n = options.length;
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = track.w > 0 ? (track.w - TRACK_PAD * 2 - TRACK_GAP * (n - 1)) / n : 0;
  const pillH = Math.max(0, track.h - TRACK_PAD * 2);

  const tx = useSharedValue(0);
  useEffect(() => {
    const to = activeIndex * (segW + TRACK_GAP);
    tx.value = reducedMotion ? to : withTiming(to, { duration: 150, easing: Easing.out(Easing.cubic) });
  }, [activeIndex, segW, reducedMotion, tx]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setTrack((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };

  return (
    <View
      style={[styles.wrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, opacity: disabled ? 0.5 : 1 }, style]}
      onLayout={onLayout}
    >
      {segW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            { width: segW, height: pillH, top: TRACK_PAD, left: TRACK_PAD, backgroundColor: theme.accent },
            pillStyle,
          ]}
        />
      )}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <PressableScale
            key={String(opt.value)}
            style={[styles.segment, compact && styles.segmentCompact]}
            onPress={() => {
              if (disabled) return;
              if (opt.value !== value) selection();
              onChange(opt.value);
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            scaleTo={0.97}
          >
            <Text
              numberOfLines={1}
              style={[
                compact ? styles.labelCompact : styles.label,
                { color: active ? theme.accentInk : theme.textMuted },
              ]}
            >
              {opt.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    borderWidth: 1,
    padding: TRACK_PAD,
    gap: TRACK_GAP,
  },
  // Absolutely-positioned sliding accent fill. Rendered first so it paints beneath the labels.
  pill: {
    position: 'absolute',
    borderRadius: Radius.full,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  segmentCompact: {
    minHeight: 32,
  },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  labelCompact: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
});
