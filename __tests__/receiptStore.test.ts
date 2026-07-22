/**
 * receiptStore.test.ts — unit tests for store/useReceiptStore.ts's monthlyListId tagging
 * (Shopping — Monthly redesign, 2026-07-22): a receipt now optionally records which
 * Monthly list its spend counts against.
 *
 * Mocks '@/lib/db' (lib/dataAccess.ts's insertRow/loadAll write through db.runSync/
 * getAllSync), same headless idiom as settingsStore.test.ts.
 */
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

import db from '@/lib/db';
import { useReceiptStore } from '@/store/useReceiptStore';

afterEach(() => {
  useReceiptStore.setState({ receipts: [] });
  jest.clearAllMocks();
});

describe('addReceipt', () => {
  it('persists and returns the given monthlyListId', () => {
    const receipt = useReceiptStore.getState().addReceipt({
      date: '2026-07-22',
      store: 'Kiwi',
      total: 250,
      monthlyListId: 'M1',
    });
    expect(receipt.monthlyListId).toBe('M1');
    expect(useReceiptStore.getState().receipts[0].monthlyListId).toBe('M1');

    const insertCall = (db.runSync as jest.Mock).mock.calls.find(([sql]: [string]) => sql.includes('INSERT INTO receipts'));
    expect(insertCall).toBeDefined();
    const [, params] = insertCall!;
    expect(params).toContain('M1');
  });

  it('writes NULL when monthlyListId is omitted, so an older-shaped receipt still round-trips', () => {
    const receipt = useReceiptStore.getState().addReceipt({ date: '2026-07-22', store: 'Kiwi', total: 100 });
    expect(receipt.monthlyListId).toBeUndefined();

    const insertCall = (db.runSync as jest.Mock).mock.calls.find(([sql]: [string]) => sql.includes('INSERT INTO receipts'));
    const [, params] = insertCall!;
    expect(params).toContain(null);
  });
});
