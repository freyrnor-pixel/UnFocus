/**
 * budget.test.ts — unit tests for lib/budget.ts's computeSpendPace().
 *
 * Pure function, no mocks needed — verifies the null-guard branches (no budget, no reset
 * boundary), the inclusive days-elapsed count, the payday-to-payday period length, and the
 * overPace boundary (equal-to-budget is NOT over).
 */
import { computeSpendPace, payPeriod } from '@/lib/budget';

describe('computeSpendPace', () => {
  it('returns null when no budget is set', () => {
    expect(computeSpendPace([], 0, 1, '2026-07-01', '2026-07-10')).toBeNull();
  });

  it('returns null when there is no monthly reset boundary yet', () => {
    expect(computeSpendPace([], 3000, 1, '', '2026-07-10')).toBeNull();
  });

  it('computes actual/budgeted per-day figures over the inclusive elapsed period', () => {
    // Reset on the 1st, today the 10th → 10 inclusive days elapsed.
    const receipts = [
      { date: '2026-07-02', total: 200 },
      { date: '2026-07-05', total: 300 },
      { date: '2026-06-28', total: 999 }, // before the reset — excluded
    ];
    const pace = computeSpendPace(receipts, 3000, 1, '2026-07-01', '2026-07-10');
    expect(pace).not.toBeNull();
    // spend = 500 over 10 days
    expect(pace!.actualPerDay).toBeCloseTo(50, 5);
    // period = 2026-07-01 → 2026-08-01 = 31 days; 3000 / 31
    expect(pace!.budgetedPerDay).toBeCloseTo(3000 / 31, 5);
    expect(pace!.overPace).toBe(false);
  });

  it('flags overPace when actual exceeds budgeted, and not when exactly equal', () => {
    const over = computeSpendPace([{ date: '2026-07-01', total: 3100 }], 3000, 1, '2026-07-01', '2026-07-01');
    expect(over!.overPace).toBe(true);

    // 1 day elapsed, budgetedPerDay = 3000/31; make actual exactly equal to it.
    const exact = computeSpendPace([{ date: '2026-07-01', total: 3000 / 31 }], 3000, 1, '2026-07-01', '2026-07-01');
    expect(exact!.overPace).toBe(false);
  });
});

describe('two paydays a month (2026-10-12)', () => {
  it('payPeriod picks the half today is in', () => {
    expect(payPeriod('2026-07-10', 1, 15)).toEqual({ start: '2026-07-01', next: '2026-07-15', length: 14 });
    expect(payPeriod('2026-07-20', 1, 15)).toEqual({ start: '2026-07-15', next: '2026-08-01', length: 17 });
    // Second payday earlier in the month than the first works the same.
    expect(payPeriod('2026-07-03', 20, 5)).toEqual({ start: '2026-06-20', next: '2026-07-05', length: 15 });
  });

  it('one payday (or a second equal to the first) is the plain month', () => {
    expect(payPeriod('2026-07-10', 1)).toEqual({ start: '2026-07-01', next: '2026-08-01', length: 31 });
    expect(payPeriod('2026-07-10', 1, 1)).toEqual(payPeriod('2026-07-10', 1));
  });

  it('paces the half-month: spend since its payday, a share of the monthly budget', () => {
    const receipts = [
      { date: '2026-07-10', total: 999 }, // previous half — not counted
      { date: '2026-07-16', total: 300 },
    ];
    const pace = computeSpendPace(receipts, 3100, 1, '', '2026-07-20', 15)!;
    expect(pace.periodLength).toBe(17);
    expect(pace.daysElapsed).toBe(6);
    expect(pace.periodSpent).toBe(300);
    expect(pace.budgetedPerDay).toBe(100); // 3100 / 31-day month
    expect(pace.periodBudget).toBe(1700);
  });

  it('single payday reports the whole month as the period', () => {
    const pace = computeSpendPace([{ date: '2026-07-05', total: 500 }], 3000, 1, '2026-07-01', '2026-07-10')!;
    expect(pace.periodBudget).toBe(3000);
    expect(pace.periodSpent).toBe(500);
  });
});
