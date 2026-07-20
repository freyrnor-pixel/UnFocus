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
 *  Tuned (2026-07-20) to damping 26 (was 18) — the old value was underdamped enough to
 *  visibly overshoot and settle in a couple of oscillations ("bobbing"), most noticeable
 *  on small header icon buttons held/pressed repeatedly. 26/320 keeps a quick, tactile
 *  settle with only a faint overshoot instead of a multi-cycle wobble. */
export const Spring = {
  snappy: { damping: 26, stiffness: 320 },
  /** Near-critically-damped — settles with almost no overshoot. Use for section/accordion
   *  toggle headers (Tasks "Done" zone, ExpandableCard) where even the calmer `snappy`
   *  spring's bounce reads as too energetic for a repeatedly-tapped list control. */
  calm: { damping: 34, stiffness: 280 },
} as const;
