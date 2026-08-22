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
 *             components/LaunchReveal (launchName/launchHold/launchOut),
 *             components/BottomNav (tabSwitch), components/AppModal, AnimatedBottomSheet,
 *             AddDishSheet, AddFromMonthlyModal, ConfirmationBanner, DraggableTaskRow,
 *             EnergyMeter, FlightOverlay, FormControls, GlowPulse, PressableScale,
 *             ProgressBar, ShoppingRow, TabSlider, CardExpandHost (cardExpand/cardExpandOut),
 *             lib/useMountedTransition,
 *             app/scan.tsx, app/(tabs)/shopping.tsx — i.e. every animated surface
 *   Data    → none (pure constants)
 *
 * Edit notes:
 *   - Values mirror ANIMATION_GUIDELINES.md §1: exits are faster than entrances.
 *   - `Ease` is named to avoid shadowing reanimated's own `Easing` export at call sites.
 *   - reducedMotion is handled per-call-site (run the same timing with duration 0), not here.
 *   - **No raw millisecond literals in animated code** (DESIGN_RULES.md rule 21) — if a
 *     duration you need isn't here, add a named token rather than inlining the number.
 *     Two tokens deliberately share a value with another (`value`/`listIn` both 250,
 *     `card`/`modalOut`/`listMove` all 220): they're independent knobs that happen to
 *     agree today, so don't collapse them. The remaining literals are
 *     components/ParticleBackground.tsx's per-particle 7000-10500ms drifts, which are
 *     ambient scenery data rather than an interaction's timing.
 */
import { Easing } from 'react-native-reanimated';

/** Durations in ms, grouped by the §1 bands. */
export const Duration = {
  /** micro interactions (icon/checkbox pop) */
  micro: 120,
  /** toggles, segmented controls, chevrons */
  control: 150,
  /** bottom-nav pill sliding to the tapped/swiped-to tab (§1 "Tab switch": 150-200ms) */
  tabSwitch: 200,
  /** card/panel expand (enter) */
  card: 220,
  /** card/panel collapse (exit — faster than enter) */
  cardOut: 200,
  /** a card GROWING to fill the screen (components/CardExpandHost.tsx). Deliberately above
   *  `card`'s 200-300ms "expanding cards" band and inside §1's 300-400ms "hero transitions:
   *  modals, screen navigation, full panels" one: this travels the whole viewport, and at
   *  220ms the growth reads as a flash-cut to a new screen rather than as the card itself
   *  getting bigger — which is the entire point of the mechanism. */
  cardExpand: 320,
  /** the same growth in reverse (exit — faster than enter, §1). */
  cardExpandOut: 260,
  /** list row entrance */
  listIn: 250,
  /** a displayed number/bar travelling to a new value (ProgressBar's fill). Same 250 as
   *  `listIn` by coincidence, not by relation — don't collapse them. */
  value: 250,
  /** list reflow (LinearTransition) */
  listMove: 220,
  /** modal/sheet enter */
  modalIn: 320,
  /** modal/sheet exit */
  modalOut: 220,
  /** celebration bloom */
  celebration: 650,
  /** the launch handoff — the app name rising in under the logo the native splash was already
   *  showing (components/LaunchReveal.tsx). §1's 300-400ms "hero transitions" band: this is the
   *  whole viewport introducing the app, and under ~250ms the name reads as popping in. */
  launchName: 360,
  /** how long the finished brand mark holds before the field starts dissolving. Deliberately
   *  short — it is a beat that lets the name be READ, not a wait. */
  launchHold: 100,
  /** the launch field dissolving into the app's own background colour. Faster than
   *  `launchName` per §1 (exits are faster than entrances) and the reason the reveal reads as
   *  one screen: the field ENDS on theme.bg, so the unmount has nothing left to show. */
  launchOut: 340,
  /** a cap sinking under the finger in PressableScale's *scale* mode — 80, not
   *  PRESS_DURATION's 90, which is the `travel` mode's curve. Both are tester-validated
   *  (2026-07-21, "buttons don't feel animated" resolved as press-in duration); don't
   *  collapse them into one number without re-checking on device. */
  pressIn: 80,
  /** a slow ambient pulse's half-cycle (the scan viewfinder breathing) */
  pulse: 600,
  /** how long a transient highlight *holds* at full strength before it fades — the
   *  quantity-changed wash on a shopping row, the Energy pulse. Not an entrance: it is
   *  dwell time, which is why it sits far above the §1 bands. */
  hold: 900,
  /** the fade-out after a `hold` — longer than a normal exit so the wash recedes rather
   *  than blinking off. */
  holdOut: 400,
  /** an ambient backdrop crossfade — components/ScreenBackground.tsx's growth tint and
   *  branch reveal. Deliberately an order of magnitude above every band above: this is
   *  scenery reacting to something that took days to earn, and it must never read as a
   *  reward animation firing off a tap. Sits alongside ParticleBackground's multi-second
   *  drifts rather than the §1 interaction bands. */
  ambient: 2400,
  /** Half of the stage tree's idle sway cycle (components/StageTree.tsx) — the design
   *  system's "Natural tree" card specifies ±1.1° over ~6s, and the sway is one
   *  `withRepeat(..., -1, true)` so a 3000ms leg is a 6000ms round trip. Above `ambient`
   *  for the same reason `ambient` is above the §1 bands, only more so: this is scenery
   *  breathing, bound to nothing, and must never look like a response to a tap. */
  sway: 3000,
} as const;

/** Easing presets: ease-out for entrances/taps, ease-in for exits, ease-in-out for travel. */
export const Ease = {
  enter: Easing.out(Easing.cubic),
  exit: Easing.in(Easing.cubic),
  move: Easing.inOut(Easing.cubic),
  /** The key-press curve — design-system v6 `handoff/BUTTONS.md`: 90ms
   *  `cubic-bezier(.2,.85,.3,1)`. Fast off the mark then settling, so a cap reads as
   *  hitting the bottom of its travel rather than easing into it. Used by
   *  components/PressableScale.tsx's `travel` mode. */
  press: Easing.bezier(0.2, 0.85, 0.3, 1),
};

/** Cap travel per control size — how far a pressable sinks into its base
 *  (design-system v6 `handoff/BUTTONS.md`). Bigger controls travel further, which is what
 *  keeps a FAB from feeling as twitchy as a chip. */
export const Travel = {
  /** chips, small pills, checkboxes */
  sm: 3,
  /** icon buttons, medium buttons, counters */
  md: 4,
  /** full-width / lg text buttons */
  lg: 5,
  /** the FAB */
  fab: 6,
} as const;

/** How long a cap takes to sink. 1ms under reduced motion (v6: "1ms under reduced motion"). */
export const PRESS_DURATION = 90;

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
