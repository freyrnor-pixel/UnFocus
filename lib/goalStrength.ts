/**
 * goalStrength.ts — the "living glow" maths for Goals (pure, headless, no DB/native).
 *
 * A Goal has a `strength` in [0, 1] that rises a little each time one of its linked
 * tasks/habits is worked, and gently decays back toward 0 (a neutral baseline) as
 * time passes with no activity. There is no punishment: strength floors at 0 and is
 * never driven negative — an untouched goal simply cools back to neutral, it is never
 * pushed below it. Decay is computed lazily from a single timestamp (no timers), so
 * these functions are the whole mechanic and are unit-tested in isolation.
 *
 * Connections:
 *   Imports → — (pure)
 *   Used by → store/useGoalStore.ts (persist bumped strength), components/GoalPicker.tsx
 *             and components/GoalGlowDot.tsx (render the decayed strength as a glow)
 *   Data    → none; pure functions over (raw strength, ISO timestamp, now)
 *
 * Edit notes:
 *   - raw strength + `strengthUpdatedAt` are what's stored; the *effective* strength
 *     shown/used at any moment is decayedStrength(raw, updatedAt, now). Persist a new
 *     value only on a positive event, via bumpedStrength() (which decays-then-adds).
 *   - Tunable constants below. STEP is intentionally gentle (~7 events to reach full)
 *     and DECAY_PER_DAY gentle too (~10 idle days from full back to neutral).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Added to a goal's strength each time a linked task/habit is worked (clamped to 1). */
export const GOAL_STRENGTH_STEP = 0.15;

/** Linear strength lost per idle day, decaying toward the 0 baseline (never below). */
export const GOAL_STRENGTH_DECAY_PER_DAY = 0.1;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Whole/fractional days elapsed between `updatedAt` and `now`; 0 if unset/invalid/future. */
function daysElapsed(updatedAt: string | null | undefined, now: number): number {
  if (!updatedAt) return 0;
  const then = Date.parse(updatedAt);
  if (!Number.isFinite(then)) return 0;
  const diff = (now - then) / MS_PER_DAY;
  return diff > 0 ? diff : 0;
}

/**
 * Current effective strength given the stored raw value and when it was last touched.
 * Decays linearly toward 0 with elapsed time and floors there — no punishment.
 */
export function decayedStrength(raw: number, updatedAt: string | null | undefined, now: number): number {
  const base = clamp01(raw);
  const decayed = base - GOAL_STRENGTH_DECAY_PER_DAY * daysElapsed(updatedAt, now);
  return clamp01(decayed);
}

/**
 * The value to persist when a linked item is worked: decay the stored value to `now`
 * first (so idle time is honoured), then add one gentle step, clamped to [0, 1].
 */
export function bumpedStrength(raw: number, updatedAt: string | null | undefined, now: number): number {
  return clamp01(decayedStrength(raw, updatedAt, now) + GOAL_STRENGTH_STEP);
}
