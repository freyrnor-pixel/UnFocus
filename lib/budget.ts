/**
 * budget.ts — shared spend-pace calculation (Decision 026).
 *
 * Computes "money spent per day since last Monthly reset" vs. "budget per day for the
 * payday-to-payday period" — the default spend-vs-budget figure shown on app/budget.tsx,
 * the Shopping screen's Monthly tab, and the Home Shopping preview card. Extracted to one
 * place so all three surfaces share a single calculation instead of three copies.
 *
 * Connections:
 *   Imports → lib/date (dateStr, monthlyBoundaryOnOrBefore, monthlyResetDayIn, parseDateStr, todayStr)
 *   Used by → app/budget.tsx, app/(tabs)/shopping.tsx, components/BudgetFields.tsx (hasSecondPayday)
 *   Data    → pure function; callers pass in receipts/settings, no store access here
 *
 * Edit notes:
 *   - periodLength is payday-to-payday: lastMonthlyReset's date → the same reset day in the
 *     following month (option B from the original Decision 026 note).
 *   - daysElapsed is inclusive of both the reset day and today.
 *   - Returns null when there's no budget set or no reset boundary yet (nothing to pace against).
 *   - **Two paydays a month (2026-10-12).** With `secondPayday` set, the period is the HALF the
 *     day is in (`payPeriod`), spend counts from that half's payday, and the per-day budget is
 *     the monthly budget over the whole month — so `periodBudget` is that half's share. One
 *     payday keeps the original monthly behaviour exactly.
 */
import { dateStr, monthlyBoundaryOnOrBefore, monthlyResetDayIn, parseDateStr, todayStr } from '@/lib/date';

export type SpendPace = {
  actualPerDay: number;
  budgetedPerDay: number;
  overPace: boolean;
  /** Days since payday, inclusive of both ends (≥ 1). The card's "today" mark sits at daysElapsed / periodLength. */
  daysElapsed: number;
  /** Payday to the next payday, in days (≥ 1). */
  periodLength: number;
  /** What this period may spend — the whole monthly budget, or a half's share with two paydays. */
  periodBudget: number;
  /** Spent since this period's payday. */
  periodSpent: number;
};

const MS_PER_DAY = 86400000;
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);

/** A usable second payday: 1–31 and not the first one. Anything else means "paid once". */
export function hasSecondPayday(firstPayday: number, secondPayday: number): boolean {
  return Number.isInteger(secondPayday) && secondPayday >= 1 && secondPayday <= 31 && secondPayday !== firstPayday;
}

/**
 * The payday-to-payday window `today` falls in: its start (the latest payday on or before
 * today) and the next payday after it. One payday → a month; two → whichever half today is in.
 * Paydays past a short month's end clamp to its last day, like `monthlyResetDayIn`.
 */
export function payPeriod(
  today: string,
  firstPayday: number,
  secondPayday = 0
): { start: string; next: string; length: number } {
  const days = hasSecondPayday(firstPayday, secondPayday) ? [firstPayday, secondPayday] : [firstPayday];
  const start = days.map((d) => monthlyBoundaryOnOrBefore(today, d)).sort().pop()!;
  const s = parseDateStr(start);
  const next = days
    .map((d) => {
      const here = monthlyResetDayIn(s.getFullYear(), s.getMonth(), d);
      return here.getTime() > s.getTime() ? here : monthlyResetDayIn(s.getFullYear(), s.getMonth() + 1, d);
    })
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return { start, next: dateStr(next), length: Math.max(1, daysBetween(s, next)) };
}

export function computeSpendPace(
  receipts: { date: string; total: number }[],
  monthlyBudgetNok: number,
  monthlyResetDate: number,
  lastMonthlyReset: string,
  today: string = todayStr(),
  secondPayday = 0
): SpendPace | null {
  if (monthlyBudgetNok <= 0) return null;

  if (hasSecondPayday(monthlyResetDate, secondPayday)) {
    const half = payPeriod(today, monthlyResetDate, secondPayday);
    const month = payPeriod(today, monthlyResetDate);
    const daysElapsed = Math.max(1, daysBetween(parseDateStr(half.start), parseDateStr(today)) + 1);
    const periodSpent = receipts
      .filter((r) => r.date >= half.start && r.date <= today)
      .reduce((sum, r) => sum + r.total, 0);
    const budgetedPerDay = monthlyBudgetNok / month.length;
    const actualPerDay = periodSpent / daysElapsed;
    return {
      actualPerDay,
      budgetedPerDay,
      overPace: actualPerDay > budgetedPerDay,
      daysElapsed,
      periodLength: half.length,
      periodBudget: budgetedPerDay * half.length,
      periodSpent,
    };
  }

  if (!lastMonthlyReset) return null;
  const resetD = parseDateStr(lastMonthlyReset);
  const todayD = parseDateStr(today);
  const daysElapsed = Math.max(1, Math.round((todayD.getTime() - resetD.getTime()) / MS_PER_DAY) + 1);

  // Clamped: `new Date(y, m + 1, 31)` for a February rolls into March and stretches the period.
  const nextResetD = monthlyResetDayIn(resetD.getFullYear(), resetD.getMonth() + 1, monthlyResetDate);
  const periodLength = Math.max(1, Math.round((nextResetD.getTime() - resetD.getTime()) / MS_PER_DAY));

  const spendSinceReset = receipts
    .filter((r) => r.date >= lastMonthlyReset)
    .reduce((sum, r) => sum + r.total, 0);

  const actualPerDay = spendSinceReset / daysElapsed;
  const budgetedPerDay = monthlyBudgetNok / periodLength;
  return {
    actualPerDay,
    budgetedPerDay,
    overPace: actualPerDay > budgetedPerDay,
    daysElapsed,
    periodLength,
    periodBudget: monthlyBudgetNok,
    periodSpent: spendSinceReset,
  };
}
