/**
 * dateLocalUtc.test.ts — the UTC/local boundary, pinned in Norway's timezone.
 *
 * lib/date.ts's header states the rule ("these are LOCAL-time formatters; do not switch
 * to toISOString()"), but nothing enforced it, and two call sites broke it — the health
 * sparkline's day keys (app/health-detail.tsx) and the monthly-reset summary's purchase
 * dates (components/MonthlyResetSummaryModal.tsx). Both read a UTC date where a local one
 * was meant, so in Norway (UTC+1/+2) they named the wrong day for part of every day.
 *
 * Every case below is chosen so the naive `toISOString().slice(0, 10)` gives a DIFFERENT
 * answer than the correct one — a test that passes under the old code proves nothing.
 * TZ is pinned to Europe/Oslo (jest.globalSetup.js) rather than trusting the runner's, since
 * the whole point is an offset-dependent bug: on a UTC runner, where the offset is zero, the
 * correct implementation and the broken one return identical answers for every input.
 */
import { dateStr, todayStr, utcStampToLocalDate } from '@/lib/date';

/**
 * Guard: the TZ pin lives in jest.globalSetup.js, because a test file cannot set it —
 * `process.env` inside a test is jest's sandboxed copy and assigning TZ there is a no-op
 * (tried first, 2026-09-12). If that wiring is ever dropped, this fails loudly instead of
 * letting every assertion below go vacuous on a UTC runner.
 */
describe('the timezone pin itself', () => {
  it('actually puts the process in Europe/Oslo (UTC+2 in September)', () => {
    // 2026-09-11T22:30Z is 00:30 on the 12th in Oslo. If this reads 2026-09-11, the TZ
    // change did not take and every assertion below is meaningless.
    expect(dateStr(new Date('2026-09-11T22:30:00.000Z'))).toBe('2026-09-12');
  });
});

describe('utcStampToLocalDate', () => {
  it('returns the LOCAL day, not the stamp\'s UTC day', () => {
    // 00:30 local on the 12th — the slice says the 11th.
    const stamp = '2026-09-11T22:30:00.000Z';
    expect(utcStampToLocalDate(stamp)).toBe('2026-09-12');
    expect(stamp.slice(0, 10)).toBe('2026-09-11'); // the bug, for contrast
  });

  it('handles the SQLite `datetime(\'now\')` shape, which carries no Z', () => {
    // `YYYY-MM-DD HH:MM:SS` is UTC by the schema's convention but parses as LOCAL if
    // handed to Date raw — same normalisation utcStampToLocalMinutes does.
    expect(utcStampToLocalDate('2026-09-11 22:30:00')).toBe('2026-09-12');
  });

  it('keeps the same day when the offset does not cross midnight', () => {
    expect(utcStampToLocalDate('2026-09-11T09:00:00.000Z')).toBe('2026-09-11');
  });

  it('crosses a month and a year boundary correctly', () => {
    expect(utcStampToLocalDate('2026-09-30T22:00:00.000Z')).toBe('2026-10-01');
    expect(utcStampToLocalDate('2026-12-31T23:00:00.000Z')).toBe('2027-01-01');
  });

  it('respects the winter offset (UTC+1), not a hardcoded +2', () => {
    // 2026-01-15T23:30Z is 00:30 on the 16th in Oslo — one hour, not two.
    expect(utcStampToLocalDate('2026-01-15T23:30:00.000Z')).toBe('2026-01-16');
    expect(utcStampToLocalDate('2026-01-15T22:30:00.000Z')).toBe('2026-01-15');
  });

  it('returns null on absent or unparseable input rather than a wrong day', () => {
    expect(utcStampToLocalDate(undefined)).toBeNull();
    expect(utcStampToLocalDate(null)).toBeNull();
    expect(utcStampToLocalDate('')).toBeNull();
    expect(utcStampToLocalDate('   ')).toBeNull();
    expect(utcStampToLocalDate('not a date')).toBeNull();
  });
});

/**
 * The health sparkline's key generator, reproduced exactly as app/health-detail.tsx has it.
 * The screen builds 90 of these and looks each up in a store keyed by `todayStr()`, so the
 * newest key MUST equal todayStr() at every hour of the day — including the small hours,
 * where the old `toISOString().slice(0, 10)` version was a day behind.
 */
function lastNDates(n: number, now: Date): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const cur = new Date(now);
    cur.setDate(now.getDate() - i);
    out.push(dateStr(cur));
  }
  return out;
}

describe('health sparkline day keys', () => {
  it('ends on the local date even at 00:30, when UTC is still yesterday', () => {
    const atHalfPastMidnight = new Date('2026-09-11T22:30:00.000Z'); // 00:30 local, 12 Sept
    const keys = lastNDates(7, atHalfPastMidnight);
    expect(keys[keys.length - 1]).toBe('2026-09-12');
    expect(keys[keys.length - 1]).not.toBe(atHalfPastMidnight.toISOString().slice(0, 10));
  });

  it('returns n consecutive days, oldest first, with no gap or repeat', () => {
    const keys = lastNDates(5, new Date('2026-03-03T12:00:00.000Z'));
    expect(keys).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02', '2026-03-03']);
  });

  it('agrees with todayStr() for the newest key, whatever the current instant', () => {
    const keys = lastNDates(3, new Date());
    expect(keys[keys.length - 1]).toBe(todayStr());
  });
});
