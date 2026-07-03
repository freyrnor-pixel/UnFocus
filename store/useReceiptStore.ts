/**
 * useReceiptStore.ts — scanned/manual receipts (AP-06B budget tracking)
 *
 * Zustand store for the `receipts` table: one row per confirmed scan/manual
 * grocery trip (date, store, total, category, month). Feeds app/budget.tsx's
 * spend-vs-budget view and per-month/per-store breakdowns; app/scan.tsx creates
 * a receipt right before logging its items via useCatalogStore.recordPurchases(purchases, receipt.id).
 *
 * Connections:
 *   Imports → lib/date, lib/dataAccess, lib/id
 *   Used by → app/budget.tsx, app/scan.tsx
 *   Data    → defines a Zustand store; owns SQLite table receipts; purchase_log rows link back via the optional receipt_id passed into useCatalogStore.recordPurchases
 *
 * Edit notes:
 *   - month is stored as `YYYY-MM` (lib/date.ts's currentMonthStr()) so receiptsForMonth/totalForMonth/receiptsByStore are simple filters.
 *   - months() returns distinct month values sorted descending (newest first); receiptsByStore(month) sums receipts per store for a given month.
 *   - load() fetches all receipts into memory — same small-table assumption as useEnergyStore; revisit if receipt volume grows beyond a year of history (pruneOldData() already trims rows past RETENTION_DAYS).
 *   - New columns go through the migrations array in lib/db.ts; never recreate tables.
 */
import { create } from 'zustand';
import { Row, loadAll, insertRow, readStr, readReal } from '@/lib/dataAccess';
import { generateId } from '@/lib/id';
import { currentMonthStr } from '@/lib/date';

export type Receipt = {
  id: string;
  date: string; // YYYY-MM-DD
  store: string;
  total: number;
  category: string;
  month: string; // YYYY-MM
};

export type ReceiptInput = {
  date: string;
  store: string;
  total: number;
  category?: string;
};

type ReceiptStore = {
  receipts: Receipt[];
  load: () => void;
  addReceipt: (input: ReceiptInput) => Receipt;
  receiptsForMonth: (month: string) => Receipt[];
  totalForMonth: (month: string) => number;
  months: () => string[];
  receiptsByStore: (month: string) => Record<string, number>;
};

function rowToReceipt(row: Row): Receipt {
  return {
    id: readStr(row, 'id'),
    date: readStr(row, 'receipt_date'),
    store: readStr(row, 'store'),
    total: readReal(row, 'total'),
    category: readStr(row, 'category') || 'other',
    month: readStr(row, 'month'),
  };
}

export const useReceiptStore = create<ReceiptStore>((set, get) => ({
  receipts: [],

  load() {
    set({ receipts: loadAll('receipts', rowToReceipt, { orderBy: 'receipt_date DESC' }) });
  },

  addReceipt(input) {
    const id = generateId();
    const month = input.date.slice(0, 7) || currentMonthStr();
    insertRow('receipts', {
      id,
      receipt_date: input.date,
      store: input.store,
      total: input.total,
      category: input.category ?? 'other',
      month,
    });
    const receipt: Receipt = {
      id,
      date: input.date,
      store: input.store,
      total: input.total,
      category: input.category ?? 'other',
      month,
    };
    set((s) => ({ receipts: [receipt, ...s.receipts] }));
    return receipt;
  },

  receiptsForMonth(month) {
    return get().receipts.filter((r) => r.month === month);
  },

  totalForMonth(month) {
    return get().receipts.filter((r) => r.month === month).reduce((sum, r) => sum + r.total, 0);
  },

  months() {
    const monthSet = new Set(get().receipts.map((r) => r.month));
    return Array.from(monthSet).sort().reverse();
  },

  receiptsByStore(month) {
    const byStore: Record<string, number> = {};
    get().receipts
      .filter((r) => r.month === month)
      .forEach((r) => {
        byStore[r.store] = (byStore[r.store] || 0) + r.total;
      });
    return byStore;
  },
}));
