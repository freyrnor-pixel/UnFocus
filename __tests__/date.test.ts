/**
 * date.test.ts — unit tests for lib/date.ts (pure local-date helpers).
 *
 * These helpers produce the canonical YYYY-MM-DD keys used across every store,
 * so an off-by-one here silently corrupts many screens. Pure functions, no mocks.
 */
import {
  dateStr,
  currentMonthStr,
  todayStr,
  dayOfWeekMon0,
  toExpoWeekday,
  getWeekDates,
  getMonthDates,
  getWeekRangeContaining,
  weekOfMonthlyCycle,
  dateRangeForCycleWeek,
  formatDisplayDate,
  formatDateRange,
  nowHHMM,
  utcStampToLocalMinutes,
  parseTimeToMinutes,
  addDurationToTime,
} from '@/lib/date';

describe('dateStr / todayStr', () => {
  it('formats a local Date as zero-padded YYYY-MM-DD', () => {
    expect(dateStr(new Date(2026, 0, 5))).toBe('2026-01-05'); // month 0 = January
    expect(dateStr(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
  it('todayStr matches the YYYY-MM-DD shape', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('currentMonthStr', () => {
  it('is the first 7 chars of todayStr (YYYY-MM)', () => {
    expect(currentMonthStr()).toBe(todayStr().slice(0, 7));
    expect(currentMonthStr()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('dayOfWeekMon0 / toExpoWeekday', () => {
  it('maps Sun=0..Sat=6 into Mon=0..Sun=6', () => {
    expect(dayOfWeekMon0(new Date(2026, 0, 5))).toBe(0); // Mon 2026-01-05
    expect(dayOfWeekMon0(new Date(2026, 0, 4))).toBe(6); // Sun 2026-01-04
  });
  it('converts app weekday (Mon=0) to Expo weekday (Sun=1..Sat=7)', () => {
    expect(toExpoWeekday(0)).toBe(2); // Monday
    expect(toExpoWeekday(6)).toBe(1); // Sunday
  });
});

describe('getWeekDates', () => {
  it('returns the Mon–Sun week containing the date', () => {
    expect(getWeekDates('2026-01-07')).toEqual([
      '2026-01-05', '2026-01-06', '2026-01-07',
      '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11',
    ]);
  });
  it('handles a date that is itself Monday', () => {
    expect(getWeekDates('2026-01-05')[0]).toBe('2026-01-05');
  });
});

describe('getMonthDates', () => {
  it('lists every day of a 28-day February (non-leap)', () => {
    const feb = getMonthDates(2026, 2);
    expect(feb).toHaveLength(28);
    expect(feb[0]).toBe('2026-02-01');
    expect(feb[27]).toBe('2026-02-28');
  });
  it('handles leap-year February (29 days)', () => {
    expect(getMonthDates(2024, 2)).toHaveLength(29);
  });
});

describe('getWeekRangeContaining', () => {
  it('names the active period by its own Mon–Sun span', () => {
    expect(getWeekRangeContaining('2026-01-07', 0)).toEqual({
      startDate: '2026-01-05',
      endDate: '2026-01-11',
    });
  });
  it('before the reset weekday, the active period is still last week', () => {
    // resetDay = Tuesday(1); on Monday the period is the previous Mon–Sun week
    expect(getWeekRangeContaining('2026-01-05', 1)).toEqual({
      startDate: '2025-12-29',
      endDate: '2026-01-04',
    });
  });
  it('from the reset weekday on, the active period is the current week', () => {
    expect(getWeekRangeContaining('2026-01-06', 1)).toEqual({
      startDate: '2026-01-05',
      endDate: '2026-01-11',
    });
  });
});

describe('weekOfMonthlyCycle', () => {
  it('is week 1 on the reset day itself', () => {
    expect(weekOfMonthlyCycle('2026-01-01', 1)).toBe(1);
  });
  it('advances one week every 7 days from the boundary', () => {
    expect(weekOfMonthlyCycle('2026-01-10', 1)).toBe(2); // 9 days in
    expect(weekOfMonthlyCycle('2026-01-15', 1)).toBe(3); // 14 days in
  });
  it('clamps a 5th week back into week 4', () => {
    expect(weekOfMonthlyCycle('2026-01-31', 1)).toBe(4); // 30 days in
  });
});

describe('dateRangeForCycleWeek', () => {
  it('is the inverse of weekOfMonthlyCycle: week 3 lands back in the same Mon–Sun span', () => {
    // '2026-01-15' is week 3 of the reset-day-1 cycle per the weekOfMonthlyCycle test above,
    // and its own Mon–Sun (resetDay=0) week is 2026-01-12..18.
    expect(dateRangeForCycleWeek('2026-01-15', 1, 3, 0)).toEqual({
      startDate: '2026-01-12',
      endDate: '2026-01-18',
    });
  });
  it('week 1 is the boundary week itself', () => {
    expect(dateRangeForCycleWeek('2026-01-01', 1, 1, 0)).toEqual({
      startDate: '2025-12-29',
      endDate: '2026-01-04',
    });
  });
  it('steps forward 7 days per week number', () => {
    expect(dateRangeForCycleWeek('2026-01-01', 1, 2, 0)).toEqual({
      startDate: '2026-01-05',
      endDate: '2026-01-11',
    });
  });
  it('respects weeklyResetDay when naming the returned span', () => {
    // monthlyResetDate=15, today already past it this month, so the boundary stays this
    // month; weeklyResetDay=1 (Tuesday) still names the week by its own Mon–Sun span.
    expect(dateRangeForCycleWeek('2026-01-20', 15, 1, 1)).toEqual({
      startDate: '2026-01-12',
      endDate: '2026-01-18',
    });
  });
});

describe('formatDisplayDate', () => {
  it('renders DD.MM.YYYY in Norwegian, keeps ISO in English', () => {
    expect(formatDisplayDate('2026-01-05', 'no')).toBe('05.01.2026');
    expect(formatDisplayDate('2026-01-05', 'en')).toBe('2026-01-05');
  });
  it('returns non-3-part input unchanged (never crashes a render)', () => {
    // The guard only rejects strings that don't split into exactly 3 non-empty
    // parts on '-'; real inputs are always ISO keys, so this is display-only safety.
    expect(formatDisplayDate('abc', 'no')).toBe('abc');
    expect(formatDisplayDate('2026-01', 'no')).toBe('2026-01');
    expect(formatDisplayDate('2026--05', 'no')).toBe('2026--05'); // empty middle part
  });
});

describe('parseTimeToMinutes', () => {
  it('parses valid H:MM/HH:MM into minutes since midnight', () => {
    expect(parseTimeToMinutes('09:30')).toBe(570);
    expect(parseTimeToMinutes('9:30')).toBe(570);
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
  });
  it('rejects malformed or out-of-range input', () => {
    expect(parseTimeToMinutes('24:00')).toBeNull();
    expect(parseTimeToMinutes('12:60')).toBeNull();
    expect(parseTimeToMinutes('not a time')).toBeNull();
    expect(parseTimeToMinutes('')).toBeNull();
  });
});

describe('addDurationToTime', () => {
  it('adds a same-day duration without rolling the date', () => {
    expect(addDurationToTime('2026-01-05', '09:00', 30)).toEqual({
      endDate: '2026-01-05',
      endTime: '09:30',
    });
  });
  it('rolls the date forward once when the duration crosses one midnight', () => {
    expect(addDurationToTime('2026-01-05', '23:30', 90)).toEqual({
      endDate: '2026-01-06',
      endTime: '01:00',
    });
  });
  it('rolls the date forward multiple days for a multi-day duration', () => {
    expect(addDurationToTime('2026-01-05', '10:00', 60 * 24 * 2 + 30)).toEqual({
      endDate: '2026-01-07',
      endTime: '10:30',
    });
  });
  it('returns null when the start time is malformed', () => {
    expect(addDurationToTime('2026-01-05', 'bad', 30)).toBeNull();
    expect(addDurationToTime('2026-01-05', '', 30)).toBeNull();
  });
  it('returns null when the duration is missing, zero, or negative', () => {
    expect(addDurationToTime('2026-01-05', '09:00', NaN)).toBeNull();
    expect(addDurationToTime('2026-01-05', '09:00', 0)).toBeNull();
    expect(addDurationToTime('2026-01-05', '09:00', -5)).toBeNull();
  });
});

describe('formatDateRange', () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  it('formats a same-month range', () => {
    expect(formatDateRange('2026-05-01', '2026-05-07', months, 'en')).toBe('May 1 – 7');
    expect(formatDateRange('2026-05-01', '2026-05-07', months, 'no')).toBe('1.–7. May');
  });
  it('formats a range crossing a month boundary', () => {
    expect(formatDateRange('2026-04-29', '2026-05-05', months, 'en')).toBe('Apr 29 – May 5');
    expect(formatDateRange('2026-04-29', '2026-05-05', months, 'no')).toBe('29. Apr–5. May');
  });
});

/**
 * `nowHHMM` and `utcStampToLocalMinutes` (2026-08-02) back the day log (lib/dayLog.ts).
 *
 * These assertions are deliberately DERIVED from the runtime's own clock rather than
 * written against fixed strings: jest here runs in whatever timezone the machine is in
 * (there is no TZ pin in jest.config.js), and a UTC↔local test with hard-coded expectations
 * would pass in Norway and fail in CI. Every case below builds its input from a local Date
 * and asserts the round trip, which holds at any offset.
 */
describe('nowHHMM', () => {
  it('renders the current local time, zero-padded', () => {
    const d = new Date();
    const expected = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    // Allow for the minute rolling over between the two reads.
    const alt = new Date(d.getTime() + 60000);
    const altStr = `${String(alt.getHours()).padStart(2, '0')}:${String(alt.getMinutes()).padStart(2, '0')}`;
    expect([expected, altStr]).toContain(nowHHMM());
  });

  it('always produces a value parseTimeToMinutes accepts', () => {
    expect(parseTimeToMinutes(nowHHMM())).not.toBeNull();
  });
});

describe('utcStampToLocalMinutes', () => {
  /** The UTC stamp SQLite's `datetime('now')` would have written for a given local Date. */
  const sqliteStamp = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);

  it('converts a SQLite datetime(\'now\') stamp back to the local minutes it was written at', () => {
    const local = new Date(2026, 5, 15, 14, 37, 0); // 15 June 2026, 14:37 local
    expect(utcStampToLocalMinutes(sqliteStamp(local), dateStr(local))).toBe(14 * 60 + 37);
  });

  // The bug this function exists to prevent: `YYYY-MM-DD HH:MM:SS` has no timezone
  // designator, so a bare `new Date(stamp)` reads it as LOCAL and the value is silently
  // off by the UTC offset — 1–2 hours in Norway, which would misplace every health entry.
  it('does not read a bare SQLite stamp as local time', () => {
    const local = new Date(2026, 0, 15, 9, 0, 0);
    const stamp = sqliteStamp(local);
    const naive = new Date(stamp);
    const naiveMinutes = naive.getHours() * 60 + naive.getMinutes();
    const actual = utcStampToLocalMinutes(stamp, dateStr(local));
    expect(actual).toBe(9 * 60);
    // Only meaningful off UTC; where the offset is zero the two agree and there's nothing
    // to catch. The assertion above is the real one either way.
    if (local.getTimezoneOffset() !== 0) expect(actual).not.toBe(naiveMinutes);
  });

  it('accepts an ISO stamp too — the in-memory copy of a just-added row uses that shape', () => {
    const local = new Date(2026, 2, 3, 22, 5, 0);
    expect(utcStampToLocalMinutes(local.toISOString(), dateStr(local))).toBe(22 * 60 + 5);
  });

  // The null-on-a-different-day rule. A stamp that lands on another LOCAL day must be
  // dropped by the caller, not folded into the wrong day's log — see lib/dayLog.ts's
  // "absence beats invention".
  it('returns null when the instant belongs to a different local day', () => {
    const local = new Date(2026, 5, 15, 14, 37, 0);
    const stamp = sqliteStamp(local);
    expect(utcStampToLocalMinutes(stamp, '2026-06-14')).toBeNull();
    expect(utcStampToLocalMinutes(stamp, '2026-06-16')).toBeNull();
  });

  it.each([
    ['an empty string', ''],
    ['whitespace', '   '],
    ['a date with no time', 'not-a-date'],
    ['a malformed stamp', '2026-13-45 99:99:99'],
  ])('returns null for %s', (_label, stamp) => {
    expect(utcStampToLocalMinutes(stamp, '2026-06-15')).toBeNull();
  });
});
