/**
 * DraggableTaskRow.tsx — long-press-and-drag wrapper for one reorderable row.
 *
 * Wraps an arbitrary row (a collapsed card) so it can be manually reordered
 * by long-press-then-drag. This component owns no task/row data and persists
 * nothing — it only reports gesture state up to the parent (onRowLayout/
 * onDragStart/onDragMove/onDragEnd); the parent screen does the hit-testing
 * (against row layouts it collects via onRowLayout) and the actual reorder
 * persistence on drop.
 *
 * Connections:
 *   Imports → lib/haptics, lib/useAppTheme, react-native-gesture-handler, react-native-reanimated
 *   Used by → app/shopping.tsx (wraps ShoppingRow for the reorderable "Shopping list"
 *             section, Decision 011 R1 — see app/shopping.tsx's own header for the
 *             screen-owned hit-testing/live-reflow it drives); Decision 009 Session B
 *             (Plans phase) will also wrap PlanTaskCard rows once that's built
 *   Data    → none directly — callbacks drive the parent's drag/livePreview state
 *
 * Edit notes:
 *   - Pan only activates after a ~180ms hold (`activateAfterLongPress`), not on a bare vertical
 *     offset — deliberate, so a quick vertical swipe still scrolls the parent's ScrollView
 *     normally; only a held-then-dragged touch claims the row for reordering. `failOffsetX`
 *     still lets a fast horizontal swipe fall through to a swipe-nav view immediately.
 *   - Disabled outright (`.enabled(!isOpen)`) while the wrapped row is expanded — dragging only
 *     ever applies to collapsed rows, so an open card's scrolling/typing is never contested.
 *   - The dragged row lifts (scale + shadow, via the `lifted` shared value) and follows the
 *     finger via translateY; siblings are NOT animated here — the parent reflows them itself
 *     via LayoutAnimation when the live preview order changes, same idiom ExpandableCard.tsx
 *     already uses for expand/collapse (relies on that file's module-level Android enable).
 *   - onDragMove reports the dragged row's current **window-space** (absolute screen) center Y,
 *     throttled to firing only once movement exceeds a small pixel delta — the parent does the
 *     actual index/section hit-test and decides whether anything changed; this component only
 *     fires tap() once, on lift. Window coords (measured via measureInWindow at drag-start, plus
 *     the live translationY) are what make cross-section hit-testing possible: the ungrouped
 *     reorder rows and the "From meals" dish-group cards live under different parents, so their
 *     onLayout (parent-relative) coordinates aren't comparable — only absolute window coords are.
 *     The parent measures its sibling rows + dish-group cards in the same window space at
 *     drag-start (Decision 022 drag-to-merge; see app/shopping.tsx's header).
 *   - `registerNode` hands the parent this row's native node so it can measureInWindow() the
 *     sibling reorder rows at drag-start (the dragged row measures itself here). Optional — a
 *     consumer that doesn't do cross-section hit-testing can omit it.
 *   - **Generalized from the old repo's version during the port (2026-07-02, Phase 3d):**
 *     the old `DraggableTaskRow.tsx` hardcoded `<PlanTaskCard task={task} {...cardProps} />`
 *     as its rendered child. `PlanTaskCard` doesn't exist in this repo yet — it's a BUILD,
 *     not a port, scoped to Decision 009's Session B (Plans phase, much later than this
 *     port). Porting the hardcoded version here would either fail to compile or force
 *     building a throwaway PlanTaskCard early against the old (pre-009a/009b) visual
 *     design. This version takes `children` instead of a `task`/`cardProps` pair — the
 *     gesture logic is byte-for-byte identical to the old file; only the rendered content
 *     is now caller-supplied. Session B wraps its own row in `children`; Session A2·1
 *     (ShoppingRow) does the same. See PROGRESS_LOG.md's Phase 3d entry.
 */
import React, { useRef } from 'react';
import { LayoutChangeEvent, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { tap } from '@/lib/haptics';
import { useAccessibility } from '@/lib/useAppTheme';

type Props = {
  children: React.ReactNode;
  isOpen: boolean;
  onRowLayout?: (layout: { y: number; height: number }) => void;
  registerNode?: (node: any) => void;
  onDragStart: () => void;
  onDragMove: (centerY: number) => void;
  onDragEnd: () => void;
};

const MOVE_REPORT_THRESHOLD = 6;

export default function DraggableTaskRow({
  children,
  isOpen,
  onRowLayout,
  registerNode,
  onDragStart,
  onDragMove,
  onDragEnd,
}: Props) {
  const { reducedMotion } = useAccessibility();
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const lifted = useSharedValue(0);
  const viewRef = useRef<any>(null);
  const rowHeightRef = useRef(0);
  const startWinTopRef = useRef(0);
  const lastReportedY = useSharedValue(0);

  function handleLayout(e: LayoutChangeEvent) {
    rowHeightRef.current = e.nativeEvent.layout.height;
    onRowLayout?.({ y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height });
  }

  // Combined ref: keep our own handle for measureInWindow AND hand it to the parent
  // so it can measure sibling rows in the same window space.
  const setViewRef = (node: any) => {
    viewRef.current = node;
    registerNode?.(node);
  };

  // Capture this row's absolute window position at drag-start; onDragMove then reports
  // window centerY = startWinTop + live translationY + height/2. measureInWindow's callback
  // runs on the JS thread — safe to read the refs here (not on the UI thread).
  function captureStart() {
    viewRef.current?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
      startWinTopRef.current = y;
      if (h) rowHeightRef.current = h;
    });
  }

  function reportMove(translationY: number) {
    onDragMove(startWinTopRef.current + translationY + rowHeightRef.current / 2);
  }

  const pan = Gesture.Pan()
    .activateAfterLongPress(180)
    .failOffsetX([-12, 12])
    .enabled(!isOpen)
    .onStart(() => {
      lifted.value = 1;
      scale.value = reducedMotion ? 1.03 : withSpring(1.03, { damping: 18, stiffness: 320 });
      lastReportedY.value = 0;
      runOnJS(tap)();
      runOnJS(captureStart)();
      runOnJS(onDragStart)();
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      if (Math.abs(e.translationY - lastReportedY.value) > MOVE_REPORT_THRESHOLD) {
        lastReportedY.value = e.translationY;
        runOnJS(reportMove)(e.translationY);
      }
    })
    .onEnd(() => {
      lifted.value = 0;
      translateY.value = reducedMotion ? 0 : withTiming(0, { duration: 200 });
      scale.value = reducedMotion ? 1 : withTiming(1, { duration: 150 });
      runOnJS(onDragEnd)();
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    zIndex: lifted.value ? 10 : 0,
    shadowOpacity: lifted.value ? 0.25 : 0,
    shadowRadius: lifted.value ? 12 : 0,
    shadowOffset: { width: 0, height: lifted.value ? 6 : 0 },
    elevation: lifted.value ? 8 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View ref={setViewRef} style={[styles.row, animStyle]} onLayout={handleLayout}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: 'transparent' },
});
