/**
 * bonsai.ts — pure helpers for the optional Bonsai/points reward system (2026-07-31).
 *
 * A companion to the Energy system's "balance" framing (lib/energy.ts): where Energy asks
 * "do I have enough for today," Bonsai is pure reward — an all-time points total
 * (settings.lifetimeBonsaiPoints, never decremented, no punishment — see AGENTS.md's "no
 * shame" precedents: goalStrength floors at 0, a medicine tray is "still due") that grows a
 * small bonsai tree through six fixed stages, plus a HEALTH value in [0, 1] reflecting
 * recent tending (has any habit been met lately). Health decays toward 0 the longer it's
 * been since — the tree greys, it never dies, resets, or loses a stage — and meeting any
 * habit brings it straight back to 1.
 *
 * Points are awarded once per habit per qualifying day/week — the same "met" definition
 * Energy's per-habit delta uses (lib/habitRecurrence.ts's habitMetOn) — by
 * store/useHabitStore.ts's increment(), on the transition from not-met to met.
 *
 * Connections:
 *   Imports → lib/date (dateStr), lib/habitRecurrence (habitMetOn), store type imports
 *             (Habit/HabitLog from store/useHabitStore)
 *   Used by → store/useHabitStore.ts (awards points), components/BonsaiCard.tsx +
 *             components/BonsaiTree.tsx (stage/health), lib/__tests__/bonsai.test.ts
 *   Data    → none (pure functions)
 */
import { dateStr } from '@/lib/date';
import { habitMetOn } from '@/lib/habitRecurrence';
import type { Habit, HabitLog } from '@/store/useHabitStore';

/** Points awarded once per habit per qualifying "met" day/week (see habitMetOn). */
export const BONSAI_POINTS_PER_HABIT = 5;

export type BonsaiStageKey = 'seed' | 'sprout' | 'sapling' | 'young' | 'mature' | 'flourishing';

/** Ordered stages with the all-time point total each one opens at. Tune freely — these are
 *  the only numbers that set the growth pace. */
export const BONSAI_STAGES: { key: BonsaiStageKey; threshold: number }[] = [
  { key: 'seed', threshold: 0 },
  { key: 'sprout', threshold: 25 },
  { key: 'sapling', threshold: 100 },
  { key: 'young', threshold: 250 },
  { key: 'mature', threshold: 600 },
  { key: 'flourishing', threshold: 1250 },
];

/** The highest stage whose threshold `points` has reached. */
export function bonsaiStageIndex(points: number): number {
  let index = 0;
  for (let i = 0; i < BONSAI_STAGES.length; i++) {
    if (points >= BONSAI_STAGES[i].threshold) index = i;
  }
  return index;
}

/** Current stage plus progress toward the next one — `ratio` is null at the final stage
 *  (nothing left to reach). */
export function bonsaiStageProgress(points: number): { index: number; key: BonsaiStageKey; ratio: number | null } {
  const index = bonsaiStageIndex(points);
  const stage = BONSAI_STAGES[index];
  const next = BONSAI_STAGES[index + 1];
  if (!next) return { index, key: stage.key, ratio: null };
  const span = next.threshold - stage.threshold;
  const ratio = span > 0 ? Math.min(1, Math.max(0, (points - stage.threshold) / span)) : 1;
  return { index, key: stage.key, ratio };
}

/** Idle days after which health has fully decayed to 0 (grey, but never gone/reset). */
export const BONSAI_HEALTH_DECAY_DAYS = 10;

/** Health for a given "days since any habit was last met" — null (outside the decay window,
 *  see daysSinceLastTended) reads the same as fully decayed. */
export function bonsaiHealth(daysSinceTended: number | null): number {
  if (daysSinceTended == null) return 0;
  return Math.min(1, Math.max(0, 1 - daysSinceTended / BONSAI_HEALTH_DECAY_DAYS));
}

/**
 * How many days ago (0 = today) any habit was last met, scanning back up to
 * BONSAI_HEALTH_DECAY_DAYS days — health is already 0 past that point, so there's nothing to
 * gain by looking further. Returns null if nothing was met within the window.
 */
export function daysSinceLastTended(habits: Habit[], logs: HabitLog[], today: string): number | null {
  const start = new Date(today + 'T12:00:00');
  for (let i = 0; i <= BONSAI_HEALTH_DECAY_DAYS; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    const date = dateStr(d);
    if (habits.some((h) => habitMetOn(h, logs, date))) return i;
  }
  return null;
}

export type BonsaiState = {
  points: number;
  stageIndex: number;
  stageKey: BonsaiStageKey;
  /** Progress toward the next stage, null at the final stage. */
  stageRatio: number | null;
  health: number;
};

/** Convenience bundle for components/BonsaiCard.tsx — everything it needs to render in one call. */
export function bonsaiState(habits: Habit[], logs: HabitLog[], points: number, today: string): BonsaiState {
  const { index, key, ratio } = bonsaiStageProgress(points);
  const health = bonsaiHealth(daysSinceLastTended(habits, logs, today));
  return { points, stageIndex: index, stageKey: key, stageRatio: ratio, health };
}
