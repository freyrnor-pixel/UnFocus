/**
 * useKeyboardAwareScroll.ts — the one "keep the field being typed into above the keyboard"
 * implementation, shared by every vertical scroll surface that hosts text fields.
 *
 * Why this exists (2026-10-03, "make sure the keyboard never covers what is being typed"):
 * the lift used to live inside components/ScreenScaffold.tsx alone, so it only worked on tab
 * and pushed screens. The two other scroll surfaces that hold fields had none:
 *   - components/CenterModalScreen.tsx — every editor pop-up (habit, medicine, health, budget,
 *     notes, food, goals, inventory…). Its KeyboardAvoidingView shrinks the pane, but nothing
 *     scrolled the pane's body, so a field low in the form sat under the pane's bottom edge.
 *   - components/CardExpandHost.tsx — an expanded card fills the screen with NO keyboard
 *     handling at all, so its lower AddRows/TaskCards were simply covered.
 * And ScreenScaffold's own lift could not reach a field near the END of its content: under the
 * edge-to-edge window Expo enforces, the window does not shrink for the keyboard, so there was
 * no scroll room left to lift into.
 *
 * What it does, for a ScrollView it is handed:
 *   1. `scrollIntoView(node)` — measures the node and the ScrollView in window coords and
 *      scrolls by exactly how much the node's bottom overlaps the visible area (the lower of the
 *      keyboard's top and the ScrollView's own bottom). Never scrolls the node's top out of view.
 *      Remembers the node as the current target until the keyboard hides.
 *   2. `keyboardPad` — extra bottom padding equal to how far the keyboard overlaps the
 *      ScrollView's frame. 0 whenever something else already moved the frame clear (a resized
 *      window, a KeyboardAvoidingView), so it never double-counts. This is the scroll room.
 *   3. `onLayout` — re-lifts the current target when the ScrollView's frame changes while the
 *      keyboard is up (a KeyboardAvoidingView shrinking the pane AFTER keyboardDidShow).
 *
 * Connections:
 *   Imports → react-native (Keyboard), lib/scrollIntoView (Measurable)
 *   Used by → components/ScreenScaffold.tsx, components/KeyboardAwareScrollView.tsx
 *   Data    → none — presentational
 *
 * Edit notes:
 *   - ⚠️ Blind class (CLAUDE.md A2): react-native-web has no soft keyboard, so no harness here can
 *     see this work — `Keyboard.metrics()` is undefined on web and every lift is a no-op there.
 *   - The caller owns `scrollY` (ScreenScaffold already tracked it for its other scroll helper);
 *     pass the hook's `onScroll` only if you don't track it yourself.
 */
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from 'react-native';
import type { Measurable } from '@/lib/scrollIntoView';

/** Gap left between the lifted field's bottom and the keyboard / visible bottom edge. */
export const KEYBOARD_MARGIN = 16;

type Rect = { top: number; bottom: number };

function measure(node: Measurable | null | undefined, cb: (r: Rect | null) => void) {
  if (!node?.measureInWindow) {
    cb(null);
    return;
  }
  node.measureInWindow((_x, y, _w, h) => cb({ top: y, bottom: y + h }));
}

/**
 * Pure: how far to scroll so `field` clears `visibleBottom`, without pushing its top above
 * `visibleTop`. Exported for the unit test.
 */
export function liftDelta(field: Rect, visibleTop: number, visibleBottom: number, margin = KEYBOARD_MARGIN): number {
  const overlap = field.bottom + margin - visibleBottom;
  if (overlap <= 0) return 0;
  // A field taller than the visible band (a long multiline note) keeps its top in view —
  // the caret is usually near the top of what was just tapped.
  const room = field.top - visibleTop - margin;
  return Math.max(0, Math.min(overlap, room));
}

export function useKeyboardAwareScroll(
  scrollRef: RefObject<ScrollView | null>,
  externalScrollY?: RefObject<number>,
) {
  const ownScrollY = useRef(0);
  const scrollY = externalScrollY ?? ownScrollY;
  const target = useRef<Measurable | null>(null);
  const [keyboardPad, setKeyboardPad] = useState(0);

  const lift = useCallback(
    (node: Measurable | null) => {
      const sv = scrollRef.current;
      if (!sv || !node) return;
      // Keyboard top in window coords while it's up; unknown (web, or not yet shown) → only the
      // ScrollView's own bottom edge counts, so a field half off-screen still comes into view.
      const kbTop = Keyboard.metrics?.()?.screenY ?? Number.POSITIVE_INFINITY;
      measure(sv as unknown as Measurable, (svRect) => {
        measure(node, (field) => {
          if (!field) return;
          const visibleTop = svRect?.top ?? 0;
          const visibleBottom = Math.min(kbTop, svRect?.bottom ?? Number.POSITIVE_INFINITY);
          if (!Number.isFinite(visibleBottom)) return;
          const delta = liftDelta(field, visibleTop, visibleBottom);
          if (delta > 0) scrollRef.current?.scrollTo({ y: (scrollY.current ?? 0) + delta, animated: true });
        });
      });
    },
    [scrollRef, scrollY],
  );

  const scrollIntoView = useCallback(
    (node: Measurable | null) => {
      if (!node?.measureInWindow) {
        // Legacy contract: an unmeasurable node means "the end of the list".
        scrollRef.current?.scrollToEnd({ animated: true });
        return;
      }
      target.current = node;
      lift(node);
    },
    [lift, scrollRef],
  );

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const kbTop = e?.endCoordinates?.screenY;
      measure(scrollRef.current as unknown as Measurable, (svRect) => {
        const pad = svRect && typeof kbTop === 'number' ? Math.max(0, Math.round(svRect.bottom - kbTop)) : 0;
        setKeyboardPad(pad);
        // Pad unchanged → the effect below won't fire, so lift now. Pad changed → the effect
        // lifts once the new scroll room has rendered.
        if (target.current) lift(target.current);
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      target.current = null;
      setKeyboardPad(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [lift, scrollRef]);

  useEffect(() => {
    if (keyboardPad > 0 && target.current) lift(target.current);
  }, [keyboardPad, lift]);

  const onLayout = useCallback(
    (_e?: LayoutChangeEvent) => {
      if (target.current && Keyboard.isVisible?.()) lift(target.current);
    },
    [lift],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      ownScrollY.current = e.nativeEvent.contentOffset.y;
    },
    [],
  );

  return { scrollIntoView, keyboardPad, onLayout, onScroll };
}
