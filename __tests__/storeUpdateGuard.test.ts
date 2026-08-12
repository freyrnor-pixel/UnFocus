/**
 * storeUpdateGuard.test.ts — a store's update()/remove() must be a complete no-op for an id
 * it does not hold.
 *
 * Every store's `update(id, patch)` opens by looking the id up in its own array and
 * returning if it isn't there. Eight of the ten did; **useHealthStore and useMedicineStore
 * never had it**, from the day each was written until 2026-08-12. Nothing pointed at the
 * gap: the SQL is a no-op either way (an UPDATE whose WHERE matches nothing changes
 * nothing), and the two stores read exactly like their eight neighbours at the call site.
 * What the missing guard actually cost was everything AROUND the write:
 *
 *   - `set()` was handed a freshly `.map()`ped array, so every component subscribed to the
 *     collection re-rendered for a change that did not happen;
 *   - the action's tail ran anyway — `scheduleWidgetSync()` for both, and for medicines
 *     `syncTrayReminders()`, a cancel-and-re-arm of all four tray notifications through the
 *     path lib/medicineNotifications.ts's header warns can silently un-schedule what it
 *     just armed.
 *
 * A stale id is not exotic: `closeEpisode()` is called from a sheet holding an id that
 * /health-log can delete underneath it, and app/medicine-form.tsx holds one across a delete.
 *
 * The fix routes both through lib/storeCrud.ts, where the guard is not omittable — so the
 * assertions below are the store-level half of lib/__tests__/storeCrud.test.ts. Notes is
 * here as a control: it always had the guard, and this pins that the shared helper did not
 * change what it does.
 *
 * Headless: '@/lib/db' is mocked (lib/dataAccess and lib/storeCrud both write through it),
 * and the two native-facing side effects — widget sync and the tray reminder scheduler —
 * are mocked so the test can assert they did NOT fire.
 */
import { useHealthStore, HealthLog } from '@/store/useHealthStore';
import { useMedicineStore, Medicine } from '@/store/useMedicineStore';
import { useNotesStore, Note } from '@/store/useNotesStore';
import { syncTrayReminders } from '@/lib/medicineNotifications';
import { scheduleWidgetSync } from '@/lib/widgets/sync';
import db from '@/lib/db';

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
jest.mock('@/lib/medicineNotifications', () => ({ syncTrayReminders: jest.fn() }));

const runSync = db.runSync as jest.Mock;
const widgetSync = scheduleWidgetSync as jest.Mock;
const traySync = syncTrayReminders as jest.Mock;

function makeLog(over: Partial<HealthLog> = {}): HealthLog {
  return {
    id: 'h1',
    date: '2026-08-12',
    startTime: '',
    endDate: '',
    endTime: '',
    ailment: 'Hodepine',
    symptomId: 'sym_hodepine',
    severity: 3,
    notes: '',
    medicineId: '',
    episodeState: 'point',
    reliefNote: '',
    reliefMedicineId: '',
    createdAt: '2026-08-12T09:00:00.000Z',
    ...over,
  };
}

function makeMedicine(over: Partial<Medicine> = {}): Medicine {
  return {
    id: 'm1',
    name: 'Elvanse',
    dose: '30 mg',
    trays: ['morning'],
    asNeeded: false,
    minIntervalMin: 0,
    maxPerDay: 0,
    childName: '',
    notes: '',
    active: true,
    sortOrder: 0,
    createdAt: '2026-08-12T09:00:00.000Z',
    ...over,
  };
}

function makeNote(over: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    header: 'Handleliste',
    body: '',
    checked: false,
    checkedAt: '',
    sortOrder: 0,
    createdAt: '2026-08-12T09:00:00.000Z',
    ...over,
  };
}

beforeEach(() => {
  useHealthStore.setState({ logs: [makeLog()], symptoms: [] });
  useMedicineStore.setState({ medicines: [makeMedicine()], doses: [] });
  useNotesStore.setState({ notes: [makeNote()], lastDeleted: null });
  runSync.mockClear();
  widgetSync.mockClear();
  traySync.mockClear();
});

afterAll(() => {
  useHealthStore.setState({ logs: [], symptoms: [] });
  useMedicineStore.setState({ medicines: [], doses: [] });
  useNotesStore.setState({ notes: [], lastDeleted: null });
});

describe('useHealthStore — an id the store does not hold', () => {
  it('update() writes nothing, replaces nothing and syncs nothing', () => {
    const before = useHealthStore.getState().logs;

    useHealthStore.getState().update('gone', { severity: 5, notes: 'edited' });

    expect(runSync).not.toHaveBeenCalled();
    // Same array REFERENCE, not merely equal contents: a new array is a re-render for
    // every subscriber, which is the visible half of the bug.
    expect(useHealthStore.getState().logs).toBe(before);
    expect(widgetSync).not.toHaveBeenCalled();
  });

  it('closeEpisode() on a stale id writes nothing — the sheet outliving its entry', () => {
    useHealthStore.getState().closeEpisode('gone', { stop: { date: '2026-08-12', time: '14:30' } });

    expect(runSync).not.toHaveBeenCalled();
    expect(widgetSync).not.toHaveBeenCalled();
  });

  it('remove() deletes nothing and syncs nothing', () => {
    const before = useHealthStore.getState().logs;

    useHealthStore.getState().remove('gone');

    expect(runSync).not.toHaveBeenCalled();
    expect(useHealthStore.getState().logs).toBe(before);
    expect(widgetSync).not.toHaveBeenCalled();
  });

  it('still does all of it for an id it DOES hold', () => {
    useHealthStore.getState().update('h1', { severity: 5 });

    expect(runSync).toHaveBeenCalledWith('UPDATE health_logs SET severity = ? WHERE id = ?', [5, 'h1']);
    expect(useHealthStore.getState().logs[0].severity).toBe(5);
    expect(widgetSync).toHaveBeenCalledTimes(1);
  });

  it('remove() still deletes the row it does hold', () => {
    useHealthStore.getState().remove('h1');

    expect(runSync).toHaveBeenCalledWith('DELETE FROM health_logs WHERE id = ?', ['h1']);
    expect(useHealthStore.getState().logs).toEqual([]);
    expect(widgetSync).toHaveBeenCalledTimes(1);
  });
});

describe('useMedicineStore — an id the store does not hold', () => {
  it('update() writes nothing and does NOT re-arm the tray reminders', () => {
    const before = useMedicineStore.getState().medicines;

    useMedicineStore.getState().update('gone', { name: 'Renamed', active: false });

    expect(runSync).not.toHaveBeenCalled();
    expect(useMedicineStore.getState().medicines).toBe(before);
    expect(traySync).not.toHaveBeenCalled();
    expect(widgetSync).not.toHaveBeenCalled();
  });

  it('does not clear trays on the way past the guard either', () => {
    // `asNeeded: true` clears `trays` before the write. That rewrite must not be a reason
    // to reach SQLite for a row that isn't there.
    useMedicineStore.getState().update('gone', { asNeeded: true });

    expect(runSync).not.toHaveBeenCalled();
    expect(traySync).not.toHaveBeenCalled();
  });

  it('still writes, clears trays and re-arms for an id it DOES hold', () => {
    useMedicineStore.getState().update('m1', { asNeeded: true });

    const med = useMedicineStore.getState().medicines[0];
    expect(med.asNeeded).toBe(true);
    expect(med.trays).toEqual([]);
    expect(runSync).toHaveBeenCalledWith('UPDATE medicines SET as_needed = ?, trays = ? WHERE id = ?', [
      1,
      '[]',
      'm1',
    ]);
    expect(traySync).toHaveBeenCalledTimes(1);
    expect(widgetSync).toHaveBeenCalledTimes(1);
  });
});

describe('useNotesStore — the control that always had the guard', () => {
  it('update() is still a no-op for an unknown id', () => {
    const before = useNotesStore.getState().notes;

    useNotesStore.getState().update('gone', { header: 'edited' });

    expect(runSync).not.toHaveBeenCalled();
    expect(useNotesStore.getState().notes).toBe(before);
    expect(widgetSync).not.toHaveBeenCalled();
  });

  it('and still writes for a known one', () => {
    useNotesStore.getState().update('n1', { header: 'edited' });

    expect(runSync).toHaveBeenCalledWith('UPDATE notes SET header = ? WHERE id = ?', ['edited', 'n1']);
    expect(useNotesStore.getState().notes[0].header).toBe('edited');
    expect(widgetSync).toHaveBeenCalledTimes(1);
  });
});
