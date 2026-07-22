/**
 * budget.ts — shared spend-pace calculation (Decision 026).
 *
 * Computes "money spent per day since last Monthly reset" vs. "budget per day for the
 * payday-to-payday period" — the default spend-vs-budget figure shown on app/budget.tsx,
 * the Shopping screen's Monthly tab, and the Home Shopping preview card. Extracted to one
 * place so all three surfaces share a single calculation instead of three copies.
 *
 * Connections:
 *   Imports → lib/date (parseDateStr, todayStr)
 *   Used by → app/budget.tsx, app/(tabs)/shopping.tsx, app/(tabs)/index.tsx (feeds
 *             components/HomeShoppingCard)
 *   Data    → pure function; callers pass in receipts/settings, no store access here
 *
 * Edit notes:
 *   - periodLength is payday-to-payday: lastMonthlyReset's date → the same reset day in the
 *     following month (option B from the original Decision 026 note).
 *   - daysElapsed is inclusive of both the reset day and today.
 *   - Returns null when there's no budget set or no reset boundary yet (nothing to pace against).
 */
import { parseDateStr, todayStr } from '@/lib/date';

export type SpendPace = {
  actualPerDay: number;
  budgetedPerDay: number;
  overPace: boolean;
};

export function computeSpendPace(
  receipts: { date: string; total: number }[],
  monthlyBudgetNok: number,
  monthlyResetDate: number,
  lastMonthlyReset: string,
  today: string = todayStr()
): SpendPace | null {
  if (monthlyBudgetNok <= 0 || !lastMonthlyReset) return null;

  const MS_PER_DAY = 86400000;
  const resetD = parseDateStr(lastMonthlyReset);
  const todayD = parseDateStr(today);
  const daysElapsed = Math.max(1, Math.round((todayD.getTime() - resetD.getTime()) / MS_PER_DAY) + 1);

  const nextResetD = new Date(resetD.getFullYear(), resetD.getMonth() + 1, monthlyResetDate);
  const periodLength = Math.max(1, Math.round((nextResetD.getTime() - resetD.getTime()) / MS_PER_DAY));

  const spendSinceReset = receipts
    .filter((r) => r.date >= lastMonthlyReset)
    .reduce((sum, r) => sum + r.total, 0);

  const actualPerDay = spendSinceReset / daysElapsed;
  const budgetedPerDay = monthlyBudgetNok / periodLength;
  return { actualPerDay, budgetedPerDay, overPace: actualPerDay > budgetedPerDay };
}
