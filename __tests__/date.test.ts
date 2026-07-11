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
  formatDisplayDate,
  formatDateRange,
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
