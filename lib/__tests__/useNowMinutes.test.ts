/**
 * useNowMinutes.test.ts — pins the minute-boundary alignment of lib/useNowMinutes.ts.
 *
 * The hook used to be a bare `setInterval(…, 60000)` started at mount, so its tick landed at
 * whatever offset into the minute the caller happened to mount at, and the value it returned
 * was up to 59 seconds stale — a whole minute behind the real clock minute for most of every
 * minute. lib/dayLog.ts cuts the day log at this value and a completion is stamped `done_at`
 * at the current minute, so a task ticked at 12:01:05 while the hook still said 12:00 fell
 * outside the cutoff and disappeared from the day-view card (which suppresses the timeline's
 * done zone) until the next tick. lib/__tests__/dayLog.test.ts pins the other end of the same
 * failure — the cutoff being inclusive at the boundary minute; this pins being ON the right
 * minute to begin with.
 *
 * The arithmetic is tested through the exported pure helper rather than by driving the hook
 * with real timers, which could only prove the same thing a minute at a time.
 */
import { msUntilNextMinute } from '@/lib/useNowMinutes';
import { localMinutesOf } from '@/lib/date';

/** Local-time constructor — the hook reads a local clock, so the test must build one too. */
const at = (h: number, m: number, s: number, ms = 0) => new Date(2026, 7, 13, h, m, s, ms);

describe('msUntilNextMinute', () => {
  it('lands just PAST the next boundary, never on or before it', () => {
    // A timer is allowed to fire a hair early. Landing at 11:59.998 would read the minute the
    // tick is trying to leave, and then hold that stale value for the whole next minute —
    // exactly the bug the alignment exists to remove. The overshoot is the guard.
    for (const now of [at(9, 30, 0), at(9, 30, 12, 500), at(9, 30, 59, 999)]) {
      const landing = new Date(now.getTime() + msUntilNextMinute(now));
      expect(localMinutesOf(landing)).toBe(localMinutesOf(now) + 1);
      expect(landing.getSeconds()).toBe(0);
    }
  });

  it('waits less the further into the minute it already is', () => {
    expect(msUntilNextMinute(at(9, 30, 0))).toBeGreaterThan(msUntilNextMinute(at(9, 30, 30)));
    expect(msUntilNextMinute(at(9, 30, 30))).toBeGreaterThan(msUntilNextMinute(at(9, 30, 59)));
  });

  it('asks for a positive delay of about a minute at most, from anywhere in the minute', () => {
    for (let second = 0; second < 60; second += 1) {
      for (const ms of [0, 500, 999]) {
        const delay = msUntilNextMinute(at(9, 30, second, ms));
        expect(delay).toBeGreaterThan(0);
        // A minute plus the overshoot — never a second tick's worth of waiting.
        expect(delay).toBeLessThan(61_000);
      }
    }
  });

  it('carries across an hour, and across midnight', () => {
    const overHour = at(9, 59, 40);
    expect(localMinutesOf(new Date(overHour.getTime() + msUntilNextMinute(overHour)))).toBe(10 * 60);

    // 23:59 → 00:00: minutes-since-midnight wraps to 0, which is what the day-view's now-line
    // and the medicine trays both expect at the top of a new day.
    const overMidnight = at(23, 59, 40);
    expect(localMinutesOf(new Date(overMidnight.getTime() + msUntilNextMinute(overMidnight)))).toBe(0);
  });

  /**
   * REGRESSION (2026-08-13). The scenario in one assertion: a task ticked partway through a
   * minute is stamped at that minute, so a "now" that is still on the previous minute puts it
   * AFTER the day log's cutoff and hides it. An aligned tick is one that has already moved on
   * by the time any part of that minute can be stamped.
   */
  it('is never still on the previous minute once a new minute has begun', () => {
    const mountedAt = at(12, 0, 5);
    const firstTick = new Date(mountedAt.getTime() + msUntilNextMinute(mountedAt));

    // The completion the old code lost: stamped at 12:01, while an unaligned tick started at
    // 12:00:05 would not have moved off 12:00 until 12:01:05.
    const stampedAt = localMinutesOf(at(12, 1, 4));
    expect(localMinutesOf(firstTick)).toBeGreaterThanOrEqual(stampedAt);
    expect(firstTick.getTime()).toBeLessThan(at(12, 1, 4).getTime());
  });
});
