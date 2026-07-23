/**
 * TabSlider.tsx — in-screen tab bar styled like the Day/Week/Month slider
 * (`components/SlideSelector.tsx`): a single accent pill SLIDES to sit behind
 * whichever tab is active, instead of each tab carrying its own independent
 * highlight box (the old `components/TabBoxHighlight.tsx` pattern, retired
 * 2026-07-23 in favour of this).
 *
 * Unlike SlideSelector (fixed N equal-width options, a pure value picker),
 * this is meant for navigation tab bars: options can carry a per-tab accent
 * colour and an arbitrary `accessory` node (a count badge, a cue dot), and
 * the track supports three width modes via `sizing` — see below. The pill's
 * position AND width are driven off each segment's own measured layout
 * (`onLayout`), not analytic math, so it works whether segments are
 * equal-flex, content-sized, or inside a horizontal scroller.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme (useAppTheme, useAccessibility), lib/haptics,
 *             components/PressableScale, react-native-reanimated
 *   Used by → app/(tabs)/plans.tsx (Today/This week/All tasks), app/(tabs)/shopping.tsx
 *             (Weekly/Monthly), app/settings.tsx (category tabs)
 *   Data    → none (controlled; value/options/onChange from props)
 *
 * Edit notes:
 *   - `sizing`: 'equal' (flex:1, all segments same width — Plans' 3 tabs), 'content'
 *     (flexGrow/flexShrink, each segment sized to its own label — Shopping's 2 tabs),
 *     or 'scroll' (no flex, wrapped in a horizontal ScrollView — Settings' 4+ tabs,
 *     which can overflow with long Norwegian labels).
 *   - The pill is the FIRST child of the row/content-container so it paints below the
 *     segment labels (paint order = document order) — same convention as SlideSelector.
 *   - Same haptic contract as SlideSelector: PressableScale's own `tap()` fires on every
 *     press, plus an extra `selection()` when the value actually changes.
 *   - `options[].accessory` is a plain ReactNode the caller builds per-render (e.g. a
 *     count badge or an animated cue) — it doesn't know about `active` state itself, so
 *     the caller must bake `isActive`-dependent styling into the node before passing it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';
import { selection } from '@/lib/haptics';
import PressableScale from '@/components/PressableScale';

export type TabSliderOption<T extends string | number> = {
  value: T;
  label: string;
  color?: string;
  accessory?: React.ReactNode;
};

type Props<T extends string | number> = {
  options: TabSliderOption<T>[];
  value: T;
  onChange: (next: T) => void;
  sizing?: 'equal' | 'content' | 'scroll';
  style?: StyleProp<ViewStyle>;
};

const TRACK_PAD = 3;
const TRACK_GAP = 3;

export default function TabSlider<T extends string | number>({
  options,
  value,
  onChange,
  sizing = 'equal',
  style,
}: Props<T>) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const [trackH, setTrackH] = useState(0);
  const [segLayouts, setSegLayouts] = useState<{ x: number; width: number }[]>([]);

  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const active = segLayouts[activeIndex];

  const tx = useSharedValue(0);
  const pw = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    if (reducedMotion) {
      tx.value = active.x;
      pw.value = active.width;
    } else {
      tx.value = withTiming(active.x, { duration: 150, easing: Easing.out(Easing.cubic) });
      pw.value = withTiming(active.width, { duration: 150, easing: Easing.out(Easing.cubic) });
    }
  }, [active?.x, active?.width, reducedMotion, tx, pw]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    width: pw.value,
  }));

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setTrackH((prev) => (prev === h ? prev : h));
  };

  const setSegLayout = useCallback((index: number, x: number, width: number) => {
    setSegLayouts((prev) => {
      const cur = prev[index];
      if (cur && cur.x === x && cur.width === width) return prev;
      const next = [...prev];
      next[index] = { x, width };
      return next;
    });
  }, []);

  const pillH = Math.max(0, trackH - TRACK_PAD * 2);
  const segmentSizing = sizing === 'equal' ? styles.segmentEqual : sizing === 'content' ? styles.segmentContent : undefined;

  const content = (
    <>
      {active && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            { height: pillH, top: TRACK_PAD, backgroundColor: options[activeIndex]?.color ?? theme.accent },
            pillStyle,
          ]}
        />
      )}
      {options.map((opt, i) => {
        const isActive = opt.value === value;
        return (
          <PressableScale
            key={String(opt.value)}
            style={[styles.segment, segmentSizing]}
            onLayout={(e: LayoutChangeEvent) => {
              const { x, width } = e.nativeEvent.layout;
              setSegLayout(i, x, width);
            }}
            onPress={() => {
              if (opt.value !== value) selection();
              onChange(opt.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            scaleTo={0.97}
          >
            <Text style={[styles.label, { color: isActive ? theme.accentInk : theme.textMuted }]} numberOfLines={1}>
              {opt.label}
            </Text>
            {opt.accessory}
          </PressableScale>
        );
      })}
    </>
  );

  return (
    <View
      style={[styles.wrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }, style]}
      onLayout={onTrackLayout}
    >
      {sizing === 'scroll' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {content}
        </ScrollView>
      ) : (
        <View style={styles.row}>{content}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    padding: TRACK_PAD,
    gap: TRACK_GAP,
  },
  // Absolutely-positioned sliding accent fill. Rendered first so it paints beneath the labels.
  pill: {
    position: 'absolute',
    left: 0,
    borderRadius: Radius.full,
  },
  segment: {
    flexDirection: 'row',
    minHeight: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  segmentEqual: { flex: 1 },
  segmentContent: { flexGrow: 1, flexShrink: 1 },
  label: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
