/**
 * overviewSplit.test.ts — what the pinned/lock-screen notification says.
 *
 * lib/widgets/sync.ts builds today's overview ONCE and the persistent notification posts it
 * verbatim, lock screen included (that channel is PUBLIC as of 2026-08-15). A redacted second
 * rendering — health dropped, medicine reduced to a count — shipped for a few hours the same
 * day and was reversed on the maintainer's ruling: a summary you have to unlock to read is one
 * you will not read, and half a summary is worse than none. The privacy control is
 * `persistentNotifEnabled`, which turns the whole notification off.
 *
 * So what is pinned here is the OPPOSITE of what the file name suggests, and the name is kept
 * so the history is findable: the overview must carry every domain, and a future pass must not
 * quietly re-redact it. The tray derivation is tested alongside, because the two are computed
 * together and a wrong tray count leaks into both.
 */
import { todayStr } from '@/lib/date';

const TODAY = '2026-08-15';

jest.mock('@/lib/date', () => ({
  ...jest.requireActual('@/lib/date'),
  todayStr: jest.fn(() => '2026-08-15'),
  // 14:00 — after the morning and midday trays, before evening/night.
  localMinutesOf: jest.fn(() => 14 * 60),
}));
jest.mock('@/lib/widgets/WidgetViews', () => ({
  __esModule: true,
  WIDGET_NAMES: [],
  renderWidgetByName: jest.fn(),
}));
jest.mock('@/lib/notifications', () => ({
  __esModule: true,
  refreshPersistentNotification: jest.fn(),
  cancelPersistentNotification: jest.fn(),
}));

const state = {
  tasks: [] as { id: string; title: string; done: boolean; time: string; cardType: string }[],
  habits: [] as { id: string; title: string; active: boolean }[],
  health: [] as { id: string; ailment: string; severity: number; date: string; episodeState: string }[],
  medicines: [] as { id: string; name: string; trays: string[]; asNeeded: boolean; active: boolean; childName: string }[],
  doses: [] as { id: string; medicineId: string; date: string; tray: string }[],
  featureMedicine: true,
};

jest.mock('@/store/useTaskStore', () => ({
  useTaskStore: { getState: () => ({ tasksForDate: () => state.tasks }) },
}));
jest.mock('@/store/useShoppingStore', () => ({
  useShoppingStore: { getState: () => ({ items: [] }) },
}));
jest.mock('@/store/useShoppingListStore', () => ({
  useShoppingListStore: { getState: () => ({ currentList: () => null }) },
}));
jest.mock('@/store/useNotesStore', () => ({
  useNotesStore: { getState: () => ({ notes: [] }) },
}));
jest.mock('@/store/useHabitStore', () => ({
  useHabitStore: { getState: () => ({ habits: state.habits, logs: [] }) },
}));
jest.mock('@/store/useHealthStore', () => ({
  useHealthStore: { getState: () => ({ logs: state.health }) },
}));
jest.mock('@/store/useMedicineStore', () => ({
  useMedicineStore: { getState: () => ({ medicines: state.medicines, doses: state.doses }) },
}));
jest.mock('@/store/useSettingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      language: 'en',
      persistentNotifEnabled: true,
      featureMedicine: state.featureMedicine,
      medicineTrayTimes: { morning: '08:00', midday: '12:00', evening: '18:00', night: '21:00' },
    }),
  },
}));

// Imported after the mocks so the store handles it closes over are the mocked ones.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildWidgetSnapshot } = require('@/lib/widgets/sync') as typeof import('@/lib/widgets/sync');

function med(id: string, trays: string[]) {
  return { id, name: id, trays, asNeeded: false, active: true, childName: '' };
}

beforeEach(() => {
  state.tasks = [];
  state.habits = [];
  state.health = [];
  state.medicines = [];
  state.doses = [];
  state.featureMedicine = true;
});

describe('the pinned overview carries the whole day', () => {
  it('has exactly one rendering — no redacted variant survives', () => {
    state.health = [{ id: 'h1', ailment: 'Migraine', severity: 3, date: TODAY, episodeState: 'ongoing' }];
    const snap = buildWidgetSnapshot();
    expect(snap.overview).not.toHaveProperty('safeLines');
  });

  it('carries an open health episode, as a bare count', () => {
    state.health = [{ id: 'h1', ailment: 'Migraine', severity: 3, date: TODAY, episodeState: 'ongoing' }];
    const snap = buildWidgetSnapshot();
    expect(snap.overview.lines).toContain('1 ongoing');
    // A count and nothing else: no day tally, no escalation, and never the ailment itself —
    // lib/episodes.ts's promise is that a week-old episode reads like an hour-old one.
    expect(JSON.stringify(snap.overview.lines)).not.toContain('Migraine');
  });

  it('names the medicine trays still due, in the app\'s own tray-card words', () => {
    state.medicines = [med('m1', ['morning']), med('m2', ['midday'])];
    const snap = buildWidgetSnapshot();
    expect(snap.overview.lines).toContain('Still due: Morning, Midday');
  });

  it('never names a medicine itself — the tray is the unit, here as everywhere', () => {
    state.medicines = [{ ...med('m1', ['morning']), name: 'Elvanse' }];
    expect(JSON.stringify(buildWidgetSnapshot().overview.lines)).not.toContain('Elvanse');
  });

  it('orders the day as counts, then medicine, then health, then the next task', () => {
    state.tasks = [{ id: 't1', title: 'Standup', done: false, time: '09:00', cardType: 'standard' }];
    state.habits = [{ id: 'hab1', title: 'Water', active: true }];
    state.medicines = [med('m1', ['morning'])];
    state.health = [{ id: 'h1', ailment: 'Migraine', severity: 3, date: TODAY, episodeState: 'ongoing' }];
    expect(buildWidgetSnapshot().overview.lines).toEqual([
      '1 task left',
      '1 habit left',
      'Still due: Morning',
      '1 ongoing',
      '09:00 · Standup',
    ]);
  });
});

describe('medicine trays on the Health widget', () => {
  it('marks a passed tray with something untaken as still due, and a future one as neither', () => {
    state.medicines = [med('m1', ['morning']), med('m2', ['night'])];
    const trays = buildWidgetSnapshot().health.trays!;
    expect(trays.map((t) => [t.id, t.due, t.taken])).toEqual([
      ['morning', true, false], // 08:00 has passed at 14:00
      ['night', false, false], // 21:00 has not
    ]);
  });

  it('a fully-logged tray is taken and no longer due', () => {
    state.medicines = [med('m1', ['morning'])];
    state.doses = [{ id: 'd1', medicineId: 'm1', date: TODAY, tray: 'morning' }];
    const trays = buildWidgetSnapshot().health.trays!;
    expect(trays[0]).toMatchObject({ id: 'morning', taken: true, due: false, detail: '1 of 1' });
    expect(buildWidgetSnapshot().overview.lines).toEqual([]);
  });

  it('counts only the untaken half of a partly-logged tray', () => {
    state.medicines = [med('m1', ['morning']), med('m2', ['morning']), med('m3', ['morning'])];
    state.doses = [{ id: 'd1', medicineId: 'm1', date: TODAY, tray: 'morning' }];
    const snap = buildWidgetSnapshot();
    expect(snap.health.trays![0].detail).toBe('1 of 3');
    // The tray is named on the overview; the untaken COUNT is what the Health widget's
    // subtitle carries, so both numbers are exercised here.
    expect(snap.overview.lines).toEqual(['Still due: Morning']);
    expect(snap.health.subtitle).toBe('2 medicines still due');
  });

  it('ignores as-needed medicines — nothing in this app nudges a PRN dose', () => {
    state.medicines = [{ ...med('m1', []), asNeeded: true }];
    expect(buildWidgetSnapshot().health.trays).toEqual([]);
    expect(buildWidgetSnapshot().overview.lines).toEqual([]);
  });

  it('goes silent everywhere when featureMedicine is off', () => {
    state.medicines = [med('m1', ['morning'])];
    state.featureMedicine = false;
    const snap = buildWidgetSnapshot();
    expect(snap.health.trays).toEqual([]);
    expect(snap.health.subtitle).toBe('');
    expect(snap.overview.lines).toEqual([]);
  });

  it('gives the Health widget content on a day with trays and no symptom entries', () => {
    state.medicines = [med('m1', ['morning'])];
    const snap = buildWidgetSnapshot();
    expect(snap.health.items).toEqual([]);
    expect(snap.health.hasContent).toBe(true);
  });
});

it('todayStr is the mocked date (guards the fixtures above)', () => {
  expect(todayStr()).toBe(TODAY);
});
