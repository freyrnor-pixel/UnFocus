/**
 * medicineStock.test.ts — pill count (2026-10-26): the pure days-left helpers in
 * lib/medicineSchedule.ts, and the store's take/undo bookkeeping + one-shot low-stock notice.
 *
 * Connections:
 *   Imports → lib/medicineSchedule, store/useMedicineStore, lib/medicineNotifications (mocked),
 *             lib/db (mocked), lib/widgets/sync (mocked)
 *   Used by → jest
 *   Data    → none (db mocked)
 */
import { crossedLowStock, isLowStock, stockDaysLeft, unitsPerDay, LOW_STOCK_DAYS, type StockedMedicine } from '@/lib/medicineSchedule';
import { useMedicineStore, Medicine } from '@/store/useMedicineStore';
import { notifyLowStock } from '@/lib/medicineNotifications';

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(),
    runSync: jest.fn(),
    execSync: jest.fn(),
    withTransactionSync: jest.fn((fn: () => void) => fn()),
  },
}));
jest.mock('@/lib/widgets/sync', () => ({ scheduleWidgetSync: jest.fn() }));
jest.mock('@/lib/medicineNotifications', () => ({ syncTrayReminders: jest.fn(), notifyLowStock: jest.fn() }));

const notify = notifyLowStock as jest.Mock;

function med(over: Partial<Medicine> = {}): Medicine {
  return {
    id: 'm1',
    name: 'Elvanse',
    dose: '30 mg',
    trays: ['morning', 'evening'],
    asNeeded: false,
    minIntervalMin: 0,
    maxPerDay: 0,
    childName: '',
    notes: '',
    active: true,
    sortOrder: 0,
    createdAt: '2026-10-01T09:00:00.000Z',
    stockCount: null,
    stockPerDose: 1,
    ...over,
  };
}

describe('pure helpers', () => {
  it('not counted → null, nothing low', () => {
    expect(stockDaysLeft(med(), [], '2026-10-26')).toBeNull();
    expect(isLowStock(null)).toBe(false);
  });

  it('scheduled: trays × per-dose per day', () => {
    const m: StockedMedicine = med({ stockCount: 30, stockPerDose: 1 });
    expect(unitsPerDay(m, [], '2026-10-26')).toBe(2);
    expect(stockDaysLeft(m, [], '2026-10-26')).toBe(15);
    expect(stockDaysLeft(med({ stockCount: 30, stockPerDose: 2 }), [], '2026-10-26')).toBe(7);
  });

  it('as-needed: averaged over the last 14 days of logged doses', () => {
    const m = med({ asNeeded: true, trays: [], stockCount: 10 });
    const doses = Array.from({ length: 7 }, (_, i) => ({
      medicineId: 'm1',
      date: `2026-10-${String(20 + i).padStart(2, '0')}`,
      tray: '',
      takenAt: '10:00',
    }));
    expect(unitsPerDay(m, doses, '2026-10-26')).toBeCloseTo(0.5);
    expect(stockDaysLeft(m, doses, '2026-10-26')).toBe(20);
    expect(stockDaysLeft(m, [], '2026-10-26')).toBeNull();
  });

  it('crossing fires once, at the line', () => {
    expect(crossedLowStock(LOW_STOCK_DAYS + 1, LOW_STOCK_DAYS)).toBe(true);
    expect(crossedLowStock(LOW_STOCK_DAYS, LOW_STOCK_DAYS - 1)).toBe(false);
    expect(crossedLowStock(null, 3)).toBe(true);
    expect(crossedLowStock(20, 19)).toBe(false);
  });
});

describe('store bookkeeping', () => {
  beforeEach(() => notify.mockClear());

  it('a counted medicine counts down on take and back up on undo', () => {
    useMedicineStore.setState({ medicines: [med({ stockCount: 40 })], doses: [] });
    useMedicineStore.getState().takeDose('m1', 'morning', '2026-10-26');
    expect(useMedicineStore.getState().medicines[0].stockCount).toBe(39);
    useMedicineStore.getState().untakeDose('m1', 'morning', '2026-10-26');
    expect(useMedicineStore.getState().medicines[0].stockCount).toBe(40);
  });

  it('an uncounted medicine is untouched', () => {
    useMedicineStore.setState({ medicines: [med()], doses: [] });
    useMedicineStore.getState().takeDose('m1', 'morning', '2026-10-26');
    expect(useMedicineStore.getState().medicines[0].stockCount).toBeNull();
  });

  it('a repeat tap on a taken tray does not count twice', () => {
    useMedicineStore.setState({ medicines: [med({ stockCount: 40 })], doses: [] });
    useMedicineStore.getState().takeDose('m1', 'morning', '2026-10-26');
    useMedicineStore.getState().takeDose('m1', 'morning', '2026-10-26');
    expect(useMedicineStore.getState().medicines[0].stockCount).toBe(39);
  });

  it('the dose that crosses LOW_STOCK_DAYS notifies once; undo never does', () => {
    // 2 a day: 16 left = 8 days; one dose → 15 = 7 days (crosses); next → 14 = 7 days (no).
    useMedicineStore.setState({ medicines: [med({ stockCount: 16 })], doses: [] });
    useMedicineStore.getState().takeDose('m1', 'morning', '2026-10-26');
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][2]).toBe(7);
    useMedicineStore.getState().takeDose('m1', 'evening', '2026-10-26');
    expect(notify).toHaveBeenCalledTimes(1);
    useMedicineStore.getState().untakeDose('m1', 'evening', '2026-10-26');
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('never goes below zero', () => {
    useMedicineStore.setState({ medicines: [med({ stockCount: 0 })], doses: [] });
    useMedicineStore.getState().takeDose('m1', 'morning', '2026-10-26');
    expect(useMedicineStore.getState().medicines[0].stockCount).toBe(0);
  });
});
