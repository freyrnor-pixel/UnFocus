/**
 * AnimatedBottomSheet.tsx — shared backdrop-fade + slide-up shell for bottom sheets.
 *
 * Decision 044b ("every add/edit sheet... uses the AddItemSheet/AppModal mounted-state +
 * exit-animation pattern — nothing 'just pops'"). Before this, ListSettingsSheet,
 * SavedListsModal, MonthlyResetSummaryModal, and UpdateSheet each used a raw
 * `<Modal transparent animationType="slide">` — and since every caller nulls its "which
 * item/list is open" state in the same update that flips `visible` to false, React unmounts
 * the whole subtree in one commit before RN's native slide-out transition ever gets to run.
 * Net effect: opens animate, closes don't. This component fixes that by decoupling "mounted
 * in the tree" from "visible" (same trick AddItemSheet.tsx/AppModal.tsx already use for their
 * centered-card variant) — the sheet stays mounted and plays a timed exit animation before
 * actually unmounting. It does NOT solve the "cache the last non-null item so its content is
 * still there to show during the exit" half — callers whose content is a nullable prop
 * (list/item/summary) still need their own last-known-value cache, since this component only
 * owns the shell, not the data.
 *
 * Connections:
 *   Imports → lib/useAppTheme, react-native-reanimated
 *   Used by → components/ListSettingsSheet.tsx, components/SavedListsModal.tsx,
 *             components/MonthlyResetSummaryModal.tsx, components/UpdateSheet.tsx
 *   Data    → none — purely presentational shell; `children` renders the actual sheet
 *             Surface (bottom-pinned via its own `position:'absolute', bottom:0` style,
 *             unchanged from before this component existed)
 *
 * Edit notes:
 *   - Timing/easing matches AddItemSheet.tsx/AppModal.tsx exactly (320ms ease-out in /
 *     220ms ease-in out, per ANIMATION_GUIDELINES.md's modal band) — don't invent new values.
 *   - Slides from translateY(40) rather than AddItemSheet's centered scale-down, since these
 *     four sheets are all bottom-pinned cards (matching their pre-existing `sheet` style),
 *     not centered ones — this only fixes the motion, not their layout.
 *   - `pointerEvents="box-none"` on the animated wrapper lets taps in the empty area above
 *     the sheet fall through to the backdrop Pressable behind it.
 *   - Respects reducedMotion (skips straight to the end state, no interpolation).
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAccessibility, useAppTheme } from '@/lib/useAppTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function AnimatedBottomSheet({ visible, onClose, children }: Props) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reducedMotion) {
        progress.value = 1;
      } else {
        progress.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
      }
    } else if (mounted) {
      if (reducedMotion) {
        progress.value = 0;
        setMounted(false);
      } else {
        progress.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
          if (done) runOnJS(setMounted)(false);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reducedMotion]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 40 }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, backdropStyle]} />
      </Pressable>
      <Animated.View style={[StyleSheet.absoluteFill, sheetStyle]} pointerEvents="box-none">
        {children}
      </Animated.View>
    </Modal>
  );
}
