/**
 * useMountedTransition.ts — shared mounted-state/exit-animation hook for modals & sheets.
 *
 * Decouples "is this component in the tree" (`mounted`) from "should it be visible"
 * (`visible`) so an exit animation can finish playing before the underlying <Modal>
 * actually unmounts — the pattern components/AddItemSheet.tsx and components/AppModal.tsx
 * each hand-rolled independently. Extracted here by Decision 044b's modal-motion audit so
 * components/UpdateSheet.tsx, components/SavedListsModal.tsx, and
 * components/ListSettingsSheet.tsx (previously bare `animationType="slide"` with no exit
 * animation, and in UpdateSheet/ListSettingsSheet's case an `if (!item) return null` guard
 * that unmounted the Modal instantly on close, skipping even RN's own native slide-out)
 * share one implementation instead of three near-identical copies.
 *
 * Connections:
 *   Imports → react-native-reanimated
 *   Used by → components/UpdateSheet.tsx, components/SavedListsModal.tsx,
 *             components/ListSettingsSheet.tsx
 *   Data    → none — pure animation-timing state
 *
 * Edit notes:
 *   - Timing matches ANIMATION_GUIDELINES.md §1's modal band: 320ms ease-out in, 220ms
 *     ease-in out (same constants AddItemSheet/AppModal already use).
 *   - `progress` is a Reanimated shared value (0 → hidden, 1 → shown); callers derive their
 *     own `useAnimatedStyle` from it (opacity, translateY, scale — whatever fits the shape).
 *   - `reducedMotion`: skips the tween, jumps straight to the end value; haptics (if any)
 *     are the caller's concern, unaffected by this hook.
 *   - Callers whose JSX reads fields off a prop that can go null/undefined right as `visible`
 *     flips false (e.g. `list` in ListSettingsSheet) must cache the last non-null value
 *     themselves — this hook only guards *whether* to render, not *what* to render.
 */
import { useEffect, useState } from 'react';
import { Easing, runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';

export function useMountedTransition(visible: boolean, reducedMotion: boolean) {
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = reducedMotion
        ? 1
        : withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
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

  return { mounted, progress };
}
