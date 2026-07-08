/**
 * ConfirmationBanner.tsx — large, friendly, auto-dismissing confirmation toast.
 *
 * Controlled overlay: pass a `message` string to show it; it fades/slides in near
 * the top, stays for `duration` ms, then calls `onDismiss`. `variant` (Decision 013)
 * picks fill/glyph/icon for success (default), danger, or warn feedback. Honours
 * reduce-motion (appears/disappears without sliding). Tapping it dismisses early.
 *
 * Usage:
 *   const [msg, setMsg] = useState<string | null>(null);
 *   ...
 *   <ConfirmationBanner message={msg} onDismiss={() => setMsg(null)} />
 *   // call setMsg('Reminder set ✓') to show it
 *
 * Connections:
 *   Imports → react-native-reanimated, react-native-safe-area-context, constants/theme, lib/useAppTheme
 *   Used by → app/task-form, app/meals, app/shopping (save/add confirmations, remove-with-Undo)
 *   Data    → reads reducedMotion via useAccessibility(); colours from useAppTheme(); scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - Controlled: parent owns the message string and clears it in onDismiss.
 *   - Render once near the root of a screen so it overlays content (zIndex high).
 *   - variant default 'success' keeps existing callers unchanged (no churn).
 *   - shadowColor stays '#000' — a shadow treatment, not a themed fill.
 *   - Optional `actionLabel`/`onAction` render a trailing text button (e.g. "Undo").
 *     Tapping it calls onAction() then dismisses immediately; the auto-dismiss timer
 *     still fires normally if the user doesn't tap it.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAppTheme, useAccessibility, useScaledStyles } from '@/lib/useAppTheme';

type Variant = 'success' | 'danger' | 'warn';

type Props = {
  /** The confirmation text; null/empty hides the banner. */
  message: string | null;
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. Default 2200. */
  duration?: number;
  /** Feedback tone. Default 'success'. */
  variant?: Variant;
  /** Label for an optional trailing action button (e.g. "Undo"). Omit to hide it. */
  actionLabel?: string;
  /** Called when the action button is tapped; the banner dismisses right after. */
  onAction?: () => void;
};

const VARIANT_ICON: Record<Variant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  danger: 'alert-circle',
  warn: 'warning',
};

export default function ConfirmationBanner({ message, onDismiss, duration = 2200, variant = 'success', actionLabel, onAction }: Props) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const styles = useScaledStyles(baseStyles);
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!message) return;
    progress.value = reducedMotion ? 1 : withTiming(1, { duration: 220 });
    const id = setTimeout(() => {
      if (reducedMotion) {
        runOnJS(onDismiss)();
      } else {
        progress.value = withTiming(0, { duration: 200 }, (done) => {
          if (done) runOnJS(onDismiss)();
        });
      }
    }, duration);
    return () => clearTimeout(id);
  }, [message, reducedMotion, duration]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -16 }],
  }));

  if (!message) return null;

  const fill = variant === 'danger' ? theme.bad : variant === 'warn' ? theme.warn : theme.good;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + Spacing.sm }, animStyle]}
    >
      <Pressable
        onPress={onDismiss}
        style={[styles.banner, { backgroundColor: fill, shadowColor: '#000' }]}
      >
        <Ionicons name={VARIANT_ICON[variant]} size={22} color={theme.textInverse} />
        <Text style={[styles.text, { color: theme.textInverse }]} numberOfLines={2}>
          {message}
        </Text>
        {actionLabel && onAction && (
          <Pressable
            onPress={() => { onAction(); onDismiss(); }}
            hitSlop={8}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={[styles.actionText, { color: theme.textInverse }]}>{actionLabel}</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

const baseStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 1000,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    maxWidth: 520,
    ...Shadow.card,
  },
  text: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
  },
  actionText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    textDecorationLine: 'underline',
  },
});
