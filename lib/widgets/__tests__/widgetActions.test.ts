/**
 * widgetActions.test.ts — takeTray, the widget's one write into medicine data.
 *
 * Added with the 2026-08-15 medicine fold-in. This runs headless, in a process that may be
 * the ONLY one alive, so it re-implements useMedicineStore.takeTray()'s rules in raw SQL —
 * and the rule that matters is idempotency: a scheduled dose's identity is
 * (medicine_id, log_date, tray), so a widget tap landing while the notification's "Taken"
 * button is pressed on the same tray must not produce two rows. Nothing about that is
 * visible in the app (a duplicate dose just makes a tray read as over-taken), which is why
 * it is asserted rather than trusted.
 *
 * '@/lib/db' is mocked directly rather than through the expo-sqlite stub, which returns []
 * for every query and so cannot express "this dose already exists".
 */
import { takeTray } from '@/lib/widgets/widgetActions';

const mockRows = {
  medicines: [] as { id: string; trays: string }[],
  doses: [] as { medicine_id: string; log_date: string; tray: string }[],
};
const mockRunSync = jest.fn();

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    execSync: jest.fn(),
    runSync: (...args: unknown[]) => mockRunSync(...args),
    getAllSync: (sql: string) => (sql.includes('FROM medicines') ? mockRows.medicines : []),
    getFirstSync: (sql: string, params: string[]) => {
      if (!sql.includes('FROM medicine_doses')) return null;
      const [medicineId, date, tray] = params;
      return mockRows.doses.find((d) => d.medicine_id === medicineId && d.log_date === date && d.tray === tray)
        ? { id: 'existing' }
        : null;
    },
  },
}));
jest.mock('@/lib/date', () => ({ ...jest.requireActual('@/lib/date'), todayStr: () => '2026-08-15' }));

/** The INSERTs takeTray issued, as [medicineId, tray] pairs. */
function inserted(): [string, string][] {
  return mockRunSync.mock.calls
    .filter((c) => String(c[0]).startsWith('INSERT INTO medicine_doses'))
    .map((c) => [c[1][1] as string, c[1][3] as string]);
}

beforeEach(() => {
  mockRows.medicines = [];
  mockRows.doses = [];
  mockRunSync.mockClear();
});

describe('takeTray', () => {
  it('logs every medicine in the tray, and nothing outside it', () => {
    mockRows.medicines = [
      { id: 'm1', trays: '["morning","evening"]' },
      { id: 'm2', trays: '["morning"]' },
      { id: 'm3', trays: '["night"]' },
    ];
    expect(takeTray('morning')).toEqual({ taken: 2, total: 2 });
    expect(inserted()).toEqual([
      ['m1', 'morning'],
      ['m2', 'morning'],
    ]);
  });

  it('skips a medicine already logged for that tray today — a repeat tap writes nothing', () => {
    mockRows.medicines = [{ id: 'm1', trays: '["morning"]' }, { id: 'm2', trays: '["morning"]' }];
    mockRows.doses = [{ medicine_id: 'm1', log_date: '2026-08-15', tray: 'morning' }];
    takeTray('morning');
    expect(inserted()).toEqual([['m2', 'morning']]);
  });

  it('matches tray membership exactly, not as a substring of the JSON column', () => {
    // A LIKE '%night%' would also match '["midnight"]'. The column is a JSON array and is
    // parsed as one; this is the case that would silently over-log.
    mockRows.medicines = [{ id: 'm1', trays: '["midnight"]' }];
    expect(takeTray('night')).toBeNull();
    expect(inserted()).toEqual([]);
  });

  it('returns null for a tray nothing is scheduled in, rather than writing an empty log', () => {
    mockRows.medicines = [{ id: 'm1', trays: '["morning"]' }];
    expect(takeTray('evening')).toBeNull();
    expect(inserted()).toEqual([]);
  });

  it('survives a malformed trays column instead of taking down the headless task', () => {
    mockRows.medicines = [{ id: 'm1', trays: 'not json' }, { id: 'm2', trays: '["morning"]' }];
    expect(takeTray('morning')).toEqual({ taken: 1, total: 1 });
    expect(inserted()).toEqual([['m2', 'morning']]);
  });

  it('stamps a local HH:MM time, matching medicine_doses.taken_at everywhere else', () => {
    mockRows.medicines = [{ id: 'm1', trays: '["morning"]' }];
    takeTray('morning');
    const insert = mockRunSync.mock.calls.find((c) => String(c[0]).startsWith('INSERT INTO medicine_doses'));
    expect(insert![1][4]).toMatch(/^\d{2}:\d{2}$/);
  });
});
