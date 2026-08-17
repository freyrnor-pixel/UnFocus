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
 *   Imports → react-native-reanimated, react-native-safe-area-context, constants/theme,
 *             lib/useAppTheme, components/PressableScale
 *   Used by → app/(tabs)/shopping.tsx (save/add confirmations), app/settings
 *             (rejected numeric input, variant='warn'), app/health-form,
 *             app/(tabs)/plans.tsx (2026-08-20 — "Put the day away" + its Undo)
 *   Data    → reads reducedMotion via useAccessibility(); colours from useAppTheme(); scaled fontSize via useScaledStyles()
 *
 * Edit notes:
 *   - Controlled: parent owns the message string and clears it in onDismiss.
 *   - Render once near the root of a screen so it overlays content (zIndex high).
 *   - variant default 'success' keeps existing callers unchanged (no churn).
 *   - shadowColor stays '#000' — a shadow treatment, not a themed fill.
 *   - **Decision 044a (2026-07-09):** added optional `actionLabel`/`onAction` — an
 *     inline "Undo" button rendered beside the message, its own Pressable so it
 *     doesn't trigger the message's dismiss-on-tap. Both optional; existing callers
 *     with neither are unaffected. First use: app/(tabs)/shopping.tsx's Monthly-tab
 *     "add to weekly" toast (undoes via putBackToInventory).
 *   - **The action button carries `accessibilityRole="button"` (2026-08-20).** It had none,
 *     so the only way to take back a just-completed action announced as plain text to a
 *     screen reader — and was untargetable by `getByRole` in the preview harness, which is
 *     how it surfaced. The message Pressable is deliberately left roleless: it is a
 *     dismiss-on-tap convenience over a label, not a control with its own name.
 *   - **`duration` is worth raising when you pass an action.** The 2200ms default is tuned
 *     for a toast you only read; an Undo the user has to notice, aim at and hit wants more
 *     (app/(tabs)/plans.tsx passes 5000, matching lib/useGhostTimeout.ts's undo window).
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, Fonts, Radius, Shadow, Spacing, HitSlop } from '@/constants/theme';
import { useAppTheme, useAccessibility, useScaledStyles } from '@/lib/useAppTheme';
import PressableScale from '@/components/PressableScale';
import { Duration } from '@/constants/motion';

type Variant = 'success' | 'danger' | 'warn';

type Props = {
  /** The confirmation text; null/empty hides the banner. */
  message: string | null;
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. Default 2200. */
  duration?: number;
  /** Feedback tone. Default 'success'. */
  variant?: Variant;
  /** Optional inline action button label (e.g. "Undo"). Renders only when both this and `onAction` are set. */
  actionLabel?: string;
  /** Fires when the action button is tapped; the banner then dismisses immediately. */
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
    progress.value = reducedMotion ? 1 : withTiming(1, { duration: Duration.card });
    const id = setTimeout(() => {
      if (reducedMotion) {
        runOnJS(onDismiss)();
      } else {
        progress.value = withTiming(0, { duration: Duration.cardOut }, (done) => {
          if (done) runOnJS(onDismiss)();
        });
      }
    }, duration);
    return () => clearTimeout(id);
  // `onDismiss` intentionally omitted: callers often pass a fresh closure each render, and
  // including it would reset this auto-dismiss timer before it fires.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, reducedMotion, duration, progress]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -16 }],
  }));

  if (!message) return null;

  const fill = variant === 'danger' ? theme.bad : variant === 'warn' ? theme.warn : theme.good;

  const showAction = !!actionLabel && !!onAction;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + Spacing.sm }, animStyle]}
    >
      <View style={[styles.banner, { backgroundColor: fill, shadowColor: '#000' }]}>
        <Pressable onPress={onDismiss} style={styles.bannerMain}>
          <Ionicons name={VARIANT_ICON[variant]} size={22} color={theme.textInverse} />
          <Text style={[styles.text, { color: theme.textInverse }]} numberOfLines={2}>
            {message}
          </Text>
        </Pressable>
        {showAction && (
          <PressableScale
            onPress={() => {
              onAction!();
              onDismiss();
            }}
            hitSlop={HitSlop.base}
            style={styles.actionBtn}
            scaleTo={0.97}
            // Without a role this announces as plain text, so the one way to take back a
            // just-completed action is invisible to a screen reader — and untargetable by
            // the preview harness, which is how the gap surfaced.
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={[styles.actionText, { color: theme.textInverse }]}>{actionLabel}</Text>
          </PressableScale>
        )}
      </View>
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
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    maxWidth: 520,
    ...Shadow.card,
  },
  bannerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
  },
  actionBtn: {
    paddingLeft: Spacing.md,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    textDecorationLine: 'underline',
  },
});
