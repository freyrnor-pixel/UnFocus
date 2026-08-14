/**
 * TourTarget.tsx — marks a card as something the guided tour can point at.
 *
 * Wraps a card so the tour knows where it is on screen. It measures its child on layout and
 * publishes the rect to a module-level registry that components/TourSpotlight.tsx reads to cut
 * its hole. When no tour is running this is a plain `<View>` with the caller's style and
 * nothing else — no listeners, no measuring, no cost.
 *
 * The wrap-a-card-by-stable-id shape is lifted from components/DebugNoteAnchor.tsx, which
 * solves the same problem for debug notes. Two of its rules apply here for the same reasons:
 *
 *   - **`id` must be a STABLE, language-neutral key.** Progress is persisted against step ids
 *     (lib/tourSteps.ts) and targets are matched by id, so keying off translated title text
 *     would break the tour on a language switch.
 *   - **One target per visual region.** Never wrap a section AND a child inside it: the
 *     spotlight would have two overlapping holes for the same content.
 *
 * Unlike DebugNoteAnchor this does NOT intercept touches. The spotlight's scrim sits above
 * everything and owns the interaction, so the wrapped card keeps working normally — which
 * matters, because most tour steps ask the user to actually use the card being pointed at.
 *
 * Connections:
 *   Imports → react-native, store/useSettingsStore, lib/tourSteps
 *   Used by → the five tab screens (app/(tabs)/index.tsx, plans.tsx, shopping.tsx,
 *             habits.tsx, health.tsx), one target each; read by components/TourSpotlight.tsx
 *   Data    → none — the measured rects are in-memory only and deliberately not persisted
 *             (they are screen positions; they are wrong the moment anything scrolls)
 *
 * Edit notes:
 *   - **These are WINDOW coordinates and the spotlight subtracts its own origin from them.**
 *     `measureInWindow`, not `onLayout` (which gives an offset inside the scroll parent, and so
 *     stops being the card's position the moment the list scrolls) — but window space is NOT the
 *     space components/TourSpotlight.tsx draws in. Its scrim is a `StyleSheet.absoluteFill`
 *     inside the tabs root view, and on Android those two differ: Fabric adds
 *     `includeViewportOffset` to measureInWindow (ReactCommon/react/renderer/dom/DOM.cpp), which
 *     on Android is `rootView.getLocationInWindow() − getWindowVisibleDisplayFrame().top`
 *     (uimanager/RootViewUtil.kt) — under the edge-to-edge window Expo enforces, the root spans
 *     the whole window while the visible frame starts below the status bar, so the offset is
 *     exactly `−statusBarHeight`. That shipped, and every hole landed one status bar too high:
 *     each step ringed the card ABOVE its target, and Shopping ringed the header instead of the
 *     tab bar (2026-08-14, from five real-device screenshots).
 *     **The fix is the SUBTRACTION, not a different call** — the spotlight measures its own
 *     absoluteFill the same way and takes the delta, so whatever a platform folds into "window"
 *     cancels out and no status-bar constant is hardcoded anywhere. `measure()`'s root-relative
 *     pageX/pageY look like the obvious one-line answer and were tried first: they are correct
 *     on native and WRONG on web, where react-native-web implements `measure` as an
 *     `offsetParent` walk that never subtracts the pager's `scrollLeft`
 *     (exports/UIManager/index.js). Home's target came back at x=802 on a 393px screen, failed
 *     the on-screen filter below, and the whole tour silently stopped rendering in
 *     `npm run preview` — i.e. it would have traded a device bug for a permanent hole in the
 *     one harness that can see this component at all. Measure both ends the same way instead.
 *   - **A rect goes stale silently, so the spotlight re-measures on a cadence** (2026-08-05).
 *     mount/focus/onLayout all miss the commonest way a card moves — something above it
 *     resizing, especially a Collapsible reveal, which animates from a Reanimated worklet and
 *     shifts its siblings with no layout pass of their own. `remeasureTargets()` below is what
 *     components/TourSpotlight.tsx calls for that; read its doc comment before adding another
 *     event listener here, because the event you want probably doesn't exist.
 *   - A target that unmounts unregisters itself. The spotlight treats a missing rect as "skip
 *     this step" rather than drawing a hole at (0,0), so a step whose screen isn't mounted
 *     degrades to nothing rather than to a black rectangle.
 *   - The registry is module-level rather than a React context on purpose: targets live on
 *     five different screens inside a pager, and the spotlight is mounted above all of them.
 *     A context would have to wrap the whole navigator to reach both.
 *   - **It works out for itself whether a tour is running**, rather than taking an `active`
 *     prop from each screen. Five call sites each deriving the same boolean is five chances to
 *     get it wrong, and the failure is silent: a target that thinks no tour is running never
 *     measures, so its step points at nothing and is skipped. The `active` override exists for
 *     tests only.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSettingsStore } from '@/store/useSettingsStore';
import { TOUR_DISMISSED, nextStep, parseProgress } from '@/lib/tourSteps';
import { Duration } from '@/constants/motion';

/** A measured target, in WINDOW coordinates — see the coordinate-space note above. */
export type TargetRect = { x: number; y: number; width: number; height: number };

type Listener = () => void;

const rects = new Map<string, TargetRect>();
const listeners = new Set<Listener>();
/**
 * Each mounted target's own measure function, so the spotlight can ask everything to
 * re-measure without holding a ref to any of it. See remeasureTargets() below.
 */
const measurers = new Map<string, () => void>();

function emit() {
  for (const l of listeners) l();
}

/** Subscribe to registry changes. Returns an unsubscribe function. */
export function subscribeTargets(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The current rect for a target id, or undefined if it isn't mounted/measured yet. */
export function getTargetRect(id: string): TargetRect | undefined {
  return rects.get(id);
}

/**
 * Ask every mounted target to re-measure itself. Called on a cadence by
 * components/TourSpotlight.tsx for as long as a step is on screen (2026-08-05).
 *
 * **The registered rect goes stale in ways nothing here can observe.** The events this
 * component listens for — mount, focus, `onLayout` — all fire when the target's own layout
 * changes. But a card moves whenever anything ABOVE it resizes, and the commonest such thing
 * is a `components/Collapsible.tsx` reveal: it animates its wrapper height from a Reanimated
 * worklet, which shifts every sibling below it without a React layout pass for them. On a
 * fresh install the Shopping tab's first-visit HintCard does exactly that a beat after the
 * tour starts, which put the spotlight ring ~130px above the card it was pointing at.
 *
 * Async store loads, a scroll, and the user tapping the live card the tour deliberately
 * leaves interactive all do the same thing by different routes. Re-measuring on a cadence
 * answers all of them at once instead of chasing each; it costs one `measureInWindow` per
 * mounted target and `measure()` below already no-ops (no `emit`, so no re-render) whenever
 * the rect is unchanged, which is almost always.
 */
export function remeasureTargets(): void {
  for (const m of measurers.values()) m();
}

type Props = {
  /** Stable, language-neutral id — must match a TOUR_STEPS entry's `targetId`. */
  id: string;
  /** Test-only override. Left undefined, this is derived from the tour's own state. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export default function TourTarget({ id, active, style, children }: Props) {
  const ref = useRef<View>(null);
  const tourProgress = useSettingsStore((s) => s.tourProgress);
  const setupComplete = useSettingsStore((s) => s.setupComplete);

  const running = (() => {
    if (active !== undefined) return active;
    if (!setupComplete) return false;
    const done = parseProgress(tourProgress);
    return !done.has(TOUR_DISMISSED) && nextStep(done) !== null;
  })();

  const measure = useCallback(() => {
    if (!running) return;
    // Window coordinates, translated into the overlay's space by TourSpotlight — see the
    // header's coordinate-space note. measureInWindow can fire before layout settles and hand
    // back zeros; a zero-size target would draw a hole around nothing, so treat it as "not
    // ready" and wait for the next pass.
    ref.current?.measureInWindow((x, y, width, height) => {
      if (!width || !height) return;
      const prev = rects.get(id);
      if (prev && prev.x === x && prev.y === y && prev.width === width && prev.height === height) return;
      rects.set(id, { x, y, width, height });
      emit();
    });
  }, [id, running]);

  useEffect(() => {
    if (!running) return;
    // Registered alongside the rect and torn down with it, so remeasureTargets() can only ever
    // reach targets that are mounted and actually measuring.
    measurers.set(id, measure);
    measure();
    return () => {
      measurers.delete(id);
      rects.delete(id);
      emit();
    };
  }, [id, running, measure]);

  // Re-measure when this screen gains focus. Without it the rect is whatever it was at MOUNT
  // time, and app/(tabs)/_layout.tsx mounts all five tab screens up front (`lazy: false`) —
  // so four of the five recorded a position from while they were swiped off-screen, and never
  // corrected it. The pager moves pages by transform, which fires no onLayout, so nothing else
  // would ever trigger a re-measure. The delayed second pass catches the settle: measuring on
  // the focus frame reads the position mid-slide.
  useFocusEffect(
    useCallback(() => {
      if (!running) return;
      measure();
      const id2 = setTimeout(measure, Duration.card);
      return () => clearTimeout(id2);
    }, [running, measure]),
  );

  return (
    <View ref={ref} style={style} onLayout={running ? measure : undefined} collapsable={false}>
      {children}
    </View>
  );
}
