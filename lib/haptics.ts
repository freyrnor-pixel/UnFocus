/**
 * haptics.ts — thin, safe wrapper over expo-haptics for tactile feedback.
 *
 * Exposes intent-named helpers (tap / success / selection / warning) so callers
 * don't import expo-haptics directly. Every call is wrapped so a missing native
 * module or unsupported platform (web) silently no-ops instead of throwing.
 *
 * Connections:
 *   Imports → expo-haptics
 *   Used by → components/BubbleMenu, components/PressableScale, components/Pet, components/SharedRequestsSection, task/habit
 *             completion flows, app/shopping.tsx (sheet swipe-to-close), destructive
 *             confirmations in app/automations.tsx, app/habit-form.tsx, app/settings.tsx,
 *             app/habits.tsx
 *   Data    → none
 *
 * Edit notes:
 *   - Keep every public function fire-and-forget and crash-proof (try/catch);
 *     haptics are an enhancement, never a hard dependency.
 *   - These are NOT gated by reduced-motion (that flag is about visual motion).
 *     If a "reduce haptics" setting is ever added, gate here.
 */
import * as Haptics from 'expo-haptics';

/** Light tap — button presses, bubble taps. */
export function tap(): void {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // no-op: haptics unavailable on this platform/device
  }
}

/** Success buzz — task/habit completion. */
export function success(): void {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // no-op
  }
}

/** Selection tick — toggles, segmented controls, picker changes. */
export function selection(): void {
  try {
    Haptics.selectionAsync();
  } catch {
    // no-op
  }
}

/** Warning buzz — destructive confirmations. */
export function warning(): void {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // no-op
  }
}

/** Tug — wheel reached its end boundary. */
export function tug(): void {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // no-op
  }
}

/** Firm tap — primary/confirm actions, entering a distinct mode (e.g. Focus). */
export function confirm(): void {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // no-op
  }
}

/** Solid thud — lands right after a destructive action is confirmed. Pair with warning() beforehand. */
export function heavy(): void {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // no-op
  }
}

export default { tap, success, selection, warning, tug, confirm, heavy };
