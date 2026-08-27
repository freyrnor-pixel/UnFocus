/**
 * NewSinceGlow.tsx — the "the view you just left was hiding this" marker.
 *
 * Marks what became visible when the user changed layout: a row a previous layout was
 * collapsing, or — in `tight` mode — a single value a previous layout wasn't drawing. It is
 * NOT a novelty cue. A glowing row is usually something the user has used for months; it
 * glows because it wasn't on screen a moment ago, not because it is new.
 *
 * The marker is an absolutely-positioned, non-interactive overlay, so it never touches the
 * wrapped content's layout and can't change a row's height — which matters, because
 * DraggableTaskRow and lib/reorder.ts measure real row geometry.
 *
 * Deliberately NOT the same cue as the transient "just added" flash that ShoppingRow already
 * plays (a self-decaying `withSequence` highlight driven by useShoppingStore's
 * `recentlyAddedIds`). That one means "you did this, a second ago" and fades on its own; this
 * one means "your last view was hiding this" and stays until acknowledged. Two persistent
 * glows on one row would make both meaningless, so the caller passes `suppressed` while the
 * transient cue owns the row — see the arbitration note below.
 *
 * Connections:
 *   Imports → constants/theme (getGlow, Radius), lib/useAppTheme (useAppTheme/useAccessibility),
 *             react-native-reanimated
 *   Used by → components/ShoppingRow.tsx (row + field-level), components/TaskCard.tsx (row +
 *             field-level, 2026-08-01 — time label, assignee cue, tag pills, goal dot)
 *   Data    → none — `active`/`suppressed` are decided by lib/useNewSinceSeen.ts upstream
 *
 * Edit notes:
 *   - **Stacking differs by mode, deliberately.** A row wrapper draws the overlay ON TOP of
 *     its children, because the row underneath has its own opaque `theme.surface` background
 *     that would completely hide anything painted behind it. A `tight` field wrapper draws it
 *     BEHIND, because there it sits directly against a number or label with no background of
 *     its own — painting a tinted wash over live text just makes the text harder to read,
 *     which is the opposite of pointing at it.
 *   - **Arbitration rule:** the transient just-added cue wins while it is running. In
 *     practice the two rarely collide (a row the user added themselves during this visit is
 *     never in the frozen reveal set — see lib/useNewSinceSeen.ts), but a LAN-synced row that
 *     lands while the surface is open can hit both, hence the explicit prop.
 *   - **Reduced motion** (`settings.reducedMotion`) drops the breathing pulse and renders a
 *     flat, fully-opaque marker. It must stay *visible* in that mode — this is an
 *     information cue, not decoration, so it degrades to static rather than disappearing.
 *   - `pointerEvents="none"` is load-bearing: the overlay sits above the row, and without it
 *     it would swallow taps on the row's own checkbox and delete button.
 *   - The pulse is intentionally slow (~2.4s) and shallow. A fast blink on a list of rows in
 *     an ADHD app is the wrong instinct — it competes for attention with the content instead
 *     of pointing at it.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { getGlow, Radius, rgba } from '@/constants/theme';
import { useAccessibility, useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useControlHue } from '@/lib/screenColor';

/** The mark's fill: the same 0.14 `soft` step lib/screenColor.ts derives, matched by hand here
 *  because that helper returns a whole ScreenHue and this needs one wash off the resolved hue. */
const MARK_WASH = 0.14;

/** One breath. Slow enough to read as "look here", not as an alarm. */
const PULSE_MS = 2400;
/**
 * Opacity floor/ceiling of the pulse — shallow on purpose, and capped well below 1 so the
 * wash reads as "tinted" rather than "selected" (selection uses a stronger accent fill
 * elsewhere; the two must not be confusable). These are the overlay's ONLY opacity source —
 * a static `opacity` in the stylesheet would be silently overridden by the animated style.
 */
const PULSE_MIN = 0.25;
const PULSE_MAX = 0.55;
/** Width of the leading edge bar. */
const EDGE_WIDTH = 3;

type Props = {
  /** The previous view was hiding this row (or this value). */
  active: boolean;
  /**
   * Hug a single value rather than a whole row. Used for field-level reveals — coming from
   * "Just the basics", the quantity that just appeared glows, not the row it sits on.
   * Tighter radius, no leading edge bar (a 3px rail either side of a two-character number
   * reads as a UI seam, not a highlight).
   */
  tight?: boolean;
  /** A transient cue already owns this row — stand down (see the arbitration note). */
  suppressed?: boolean;
  children: React.ReactNode;
};

export default function NewSinceGlow({ active, suppressed = false, tight = false, children }: Props) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const pulse = useSharedValue(PULSE_MAX);
  const on = active && !suppressed;

  useEffect(() => {
    if (!on || reducedMotion) {
      // Park at full strength rather than 0: under reduced motion the marker is static but
      // must still be plainly visible.
      pulse.value = PULSE_MAX;
      return;
    }
    pulse.value = PULSE_MAX;
    pulse.value = withRepeat(
      withTiming(PULSE_MIN, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => {
      // Cancel by reassigning — a repeating animation left running on an unmounted row's
      // shared value keeps the UI thread busy for nothing.
      pulse.value = PULSE_MAX;
    };
  }, [on, reducedMotion, pulse]);

  const edgeStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // **The mark wears the SCREEN's hue in dark (2026-08-27, round 20's "never blue on a pink or
  // cyan screen").** It had no colour of its own — it borrowed `accent`/`accentSoft` because
  // those were simply the app's one highlight pair — so unlike the recording red on
  // components/VoiceNoteFAB.tsx there is nothing semantic to preserve here: this marks rows on
  // THIS screen, so it belongs to this screen. Nothing is written on the wash (it sits behind a
  // row that keeps its own `theme.text`), so recolouring it raises no ink question, which is
  // exactly why it could move when components/AddFAB.tsx's solid fill could not.
  const isDark = useIsDark();
  const hue = useControlHue(theme, isDark);

  const overlay = on ? (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        tight ? styles.overlayTight : styles.overlay,
        { borderColor: hue, backgroundColor: rgba(hue, MARK_WASH) },
        getGlow(hue, 'soft'),
        edgeStyle,
      ]}
    >
      {tight ? null : <View style={[styles.edge, { backgroundColor: hue }]} />}
    </Animated.View>
  ) : null;

  // See the stacking note in the header: behind the content for a field, over it for a row.
  return (
    <View style={tight ? styles.wrapTight : styles.wrap}>
      {tight ? overlay : null}
      {children}
      {tight ? null : overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  // Field wrappers sit inside a flex row of values; without this they'd stretch.
  wrapTight: { position: 'relative', alignSelf: 'center' },
  overlay: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Field-level: sits directly behind a number/label, so it needs a small radius and no
  // border (a hairline around a single value reads as an input box).
  overlayTight: {
    borderRadius: Radius.sm,
    // Extend past the text box so the wash reads as a highlight around the value rather
    // than a box cropped to its glyph bounds.
    marginHorizontal: -4,
    marginVertical: -2,
  },
  edge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: EDGE_WIDTH,
    borderTopLeftRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
  },
});
