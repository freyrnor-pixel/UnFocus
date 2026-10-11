/**
 * budgetBar.test.ts — the Budget card's bar fractions, and the period fields computeSpendPace
 * now returns for it (V2, 2026-10-11).
 *
 * Connections:
 *   Imports → components/BudgetBar (budgetBarFractions), lib/budget (computeSpendPace)
 *   Used by → jest
 *   Data    → none
 */
jest.mock('@/lib/useAppTheme', () => ({ useAppTheme: () => ({}) }));
jest.mock('@/lib/i18n', () => ({ useT: () => ({}) }));

import { budgetBarFractions } from '@/components/BudgetBar';
import { computeSpendPace } from '@/lib/budget';

describe('budgetBarFractions', () => {
  it('fills by spent ÷ budget and marks today by elapsed ÷ period', () => {
    expect(budgetBarFractions(250, 1000, 15, 30)).toEqual({ fill: 0.25, today: 0.5 });
  });
  it('clamps an over-budget month to a full bar', () => {
    expect(budgetBarFractions(1500, 1000, 40, 30)).toEqual({ fill: 1, today: 1 });
  });
  it('draws nothing for no budget', () => {
    expect(budgetBarFractions(100, 0, 1, 0)).toEqual({ fill: 0, today: 0 });
  });
});

describe('computeSpendPace period fields', () => {
  it('reports days elapsed (inclusive) and the payday-to-payday length', () => {
    const pace = computeSpendPace([{ date: '2026-10-05', total: 100 }], 3000, 1, '2026-10-01', '2026-10-10');
    expect(pace?.daysElapsed).toBe(10);
    expect(pace?.periodLength).toBe(31);
  });
});
