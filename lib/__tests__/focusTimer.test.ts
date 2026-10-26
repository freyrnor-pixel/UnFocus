/**
 * focusTimer.test.ts — pins lib/focusTimer.ts (the countdown's state machine).
 *
 * Connections:
 *   Imports → lib/focusTimer
 *   Used by → jest
 *   Data    → none
 */
import { formatClock, IDLE, pause, presetsFor, progress, remainingMs, resume, settle, start } from '@/lib/focusTimer';

const MIN = 60_000;

describe('focusTimer', () => {
  it('counts down from timestamps, not ticks', () => {
    const s = start(10, 0);
    expect(remainingMs(s, 0)).toBe(10 * MIN);
    expect(remainingMs(s, 4 * MIN)).toBe(6 * MIN);
    expect(progress(s, 5 * MIN)).toBeCloseTo(0.5);
  });

  it('pause freezes, resume continues from what was left', () => {
    const p = pause(start(10, 0), 3 * MIN);
    expect(remainingMs(p, 999 * MIN)).toBe(7 * MIN);
    const r = resume(p, 100 * MIN);
    expect(remainingMs(r, 102 * MIN)).toBe(5 * MIN);
  });

  it('settles into done at the end, and only then', () => {
    const s = start(1, 0);
    expect(settle(s, MIN - 1).phase).toBe('running');
    expect(settle(s, MIN).phase).toBe('done');
    expect(settle(IDLE, MIN)).toBe(IDLE);
  });

  it('formats mm:ss rounding up', () => {
    expect(formatClock(25 * MIN)).toBe('25:00');
    expect(formatClock(61_001)).toBe('1:02');
    expect(formatClock(1)).toBe('0:01');
    expect(formatClock(0)).toBe('0:00');
  });

  it("offers a task's own duration first", () => {
    expect(presetsFor(45)).toEqual([45, 5, 10, 15, 25]);
    expect(presetsFor(25)).toEqual([5, 10, 15, 25]);
    expect(presetsFor(null)).toEqual([5, 10, 15, 25]);
  });
});
