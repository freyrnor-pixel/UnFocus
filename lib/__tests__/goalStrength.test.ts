/**
 * goalStrength.test.ts — unit tests for lib/goalStrength.ts (the Goals "living glow").
 *
 * Pure functions, no mocks. Verifies: a bump climbs by STEP and clamps at 1; strength
 * decays linearly toward 0 and floors there (no punishment); decay-then-bump composes;
 * and a null/invalid/future timestamp means "no elapsed time" (no decay).
 */
import {
  decayedStrength,
  bumpedStrength,
  GOAL_STRENGTH_STEP,
  GOAL_STRENGTH_DECAY_PER_DAY,
} from '@/lib/goalStrength';

const NOW = Date.parse('2026-07-23T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

describe('decayedStrength', () => {
  it('returns the raw value when just touched (no elapsed time)', () => {
    expect(decayedStrength(0.5, daysAgo(0), NOW)).toBeCloseTo(0.5, 5);
  });

  it('decays linearly by DECAY_PER_DAY per idle day', () => {
    expect(decayedStrength(0.8, daysAgo(3), NOW)).toBeCloseTo(0.8 - 3 * GOAL_STRENGTH_DECAY_PER_DAY, 5);
  });

  it('floors at 0 — an old goal cools to neutral, never negative (no punishment)', () => {
    expect(decayedStrength(0.5, daysAgo(365), NOW)).toBe(0);
  });

  it('clamps a corrupt raw value into [0, 1]', () => {
    expect(decayedStrength(5, daysAgo(0), NOW)).toBe(1);
    expect(decayedStrength(-2, daysAgo(0), NOW)).toBe(0);
  });

  it('treats a null / invalid / future timestamp as no elapsed time', () => {
    expect(decayedStrength(0.6, null, NOW)).toBeCloseTo(0.6, 5);
    expect(decayedStrength(0.6, 'not-a-date', NOW)).toBeCloseTo(0.6, 5);
    expect(decayedStrength(0.6, daysAgo(-5), NOW)).toBeCloseTo(0.6, 5);
  });
});

describe('bumpedStrength', () => {
  it('adds one gentle step from a fresh (0) goal', () => {
    expect(bumpedStrength(0, null, NOW)).toBeCloseTo(GOAL_STRENGTH_STEP, 5);
  });

  it('clamps at 1 once repeatedly worked', () => {
    let s = 0;
    for (let i = 0; i < 20; i++) s = bumpedStrength(s, daysAgo(0), NOW);
    expect(s).toBe(1);
  });

  it('decays to now before adding the step (idle time is honoured)', () => {
    // raw 0.8, 3 idle days → 0.5, then +STEP.
    expect(bumpedStrength(0.8, daysAgo(3), NOW)).toBeCloseTo(0.5 + GOAL_STRENGTH_STEP, 5);
  });

  it('bumping a long-cold goal starts from the neutral floor', () => {
    expect(bumpedStrength(0.9, daysAgo(365), NOW)).toBeCloseTo(GOAL_STRENGTH_STEP, 5);
  });
});
