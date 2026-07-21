/**
 * motion.ts — shared animation duration + easing tokens.
 *
 * Single source of truth for the timing/easing values that ANIMATION_GUIDELINES.md §1/§9
 * prescribe, so new animated code stops re-hardcoding magic numbers (220/200/320…) that
 * were previously copy-pasted across ~15 components. Import these instead of literals.
 *
 * Connections:
 *   Imports → react-native-reanimated (Easing)
 *   Used by → components/Collapsible, components/AnimatedChevron, lib/useToggleProgress,
 *             and any new animated surface (older files may migrate opportunistically)
 *   Data    → none (pure constants)
 *
 * Edit notes:
 *   - Values mirror ANIMATION_GUIDELINES.md §1: exits are faster than entrances.
 *   - `Ease` is named to avoid shadowing reanimated's own `Easing` export at call sites.
 *   - reducedMotion is handled per-call-site (run the same timing with duration 0), not here.
 */
import { Easing } from 'react-native-reanimated';

/** Durations in ms, grouped by the §1 bands. */
export const Duration = {
  /** micro interactions (icon/checkbox pop) */
  micro: 120,
  /** toggles, segmented controls, chevrons */
  control: 150,
  /** card/panel expand (enter) */
  card: 220,
  /** card/panel collapse (exit — faster than enter) */
  cardOut: 200,
  /** list row entrance */
  listIn: 250,
  /** list reflow (LinearTransition) */
  listMove: 220,
  /** modal/sheet enter */
  modalIn: 320,
  /** modal/sheet exit */
  modalOut: 220,
  /** celebration bloom */
  celebration: 650,
} as const;

/** Easing presets: ease-out for entrances/taps, ease-in for exits, ease-in-out for travel. */
export const Ease = {
  enter: Easing.out(Easing.cubic),
  exit: Easing.in(Easing.cubic),
  move: Easing.inOut(Easing.cubic),
};

/** The proven snappy spring (from PressableScale) for tactile press/toggle spring-backs.
 *  Tuned (2026-07-20) to damping 26 (was 18), then again (2026-07-21, tester feedback "still
 *  too bobbing") to damping 36. Reanimated's spring model is a standard mass-spring-damper
 *  with mass 1, so critical damping = 2*sqrt(stiffness) — for stiffness 320 that's ~35.8.
 *  Damping 26 was a ratio of ~0.73 (still meaningfully underdamped: a real, visible overshoot
 *  and a couple of settle oscillations, not just a slow perceptual fade) — 36 lands right at
 *  critical (~1.0), which removes the bounce entirely while keeping the same high stiffness
 *  for a fast settle. Don't lower this back below ~34 without re-verifying on device.
 *  (2026-07-21, same day: a separate report that "buttons don't feel animated" landed around
 *  the same time as the above — resolved as press-in duration, not release bounce; see
 *  PressableScale's 80ms press-in. Release stays critically damped; don't reintroduce overshoot
 *  here without fresh on-device confirmation, since the 36 value above was tester-validated.) */
export const Spring = {
  snappy: { damping: 36, stiffness: 320 },
  /** Near-critically-damped — settles with almost no overshoot. Use for section/accordion
   *  toggle headers (Tasks "Done" zone, ExpandableCard) where even the calmer `snappy`
   *  spring's bounce reads as too energetic for a repeatedly-tapped list control. */
  calm: { damping: 34, stiffness: 280 },
} as const;
