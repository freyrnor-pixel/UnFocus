/**
 * useEnergyStore.test.ts — unit tests for capacityForDay/capacityForWeek under each
 * energyMode (2026-07-24): 'daily'/'weekly' use the flat settings capacity, 'custom'
 * picks/sums the per-weekday energyCustomCapacities. A period override still wins
 * over any mode default.
 *
 * Also covers the today-only BOOST (2026-08-02): a 'b:YYYY-MM-DD' row in the same
 * energy_budgets table that is ADDED to the day's base capacity rather than replacing it.
 * The separation is the whole design — a "+3 because today is a good day" must not silently
 * redefine the user's usual capacity — so the tests below pin that a boost leaves the base
 * override untouched, doesn't leak to another date, and doesn't touch the week.
 *
 * Mocks '@/lib/db' (same headless idiom as settingsStore.test.ts) since useEnergyStore
 * persists overrides through lib/dataAccess.
 */
import { useEnergyStore } from '@/store/useEnergyStore';
import { useSettingsStore, EnergyMode } from '@/store/useSettingsStore';
import { boostKey } from '@/lib/energy';

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

function setMode(mode: EnergyMode, custom = [1, 2, 3, 4, 5, 6, 7]) {
  useSettingsStore.setState({
    energyMode: mode,
    energyDailyCapacity: 10,
    energyWeeklyCapacity: 50,
    energyCustomCapacities: custom,
  });
}

beforeEach(() => {
  useEnergyStore.setState({ overrides: {}, dayStates: {}, loaded: false });
});

describe('capacityForDay', () => {
  it('daily mode: falls back to the flat energyDailyCapacity', () => {
    setMode('daily');
    expect(useEnergyStore.getState().capacityForDay('2026-07-20')).toBe(10);
  });

  it("custom mode: picks that weekday's amount from energyCustomCapacities", () => {
    setMode('custom');
    // 2026-07-20 is a Monday (index 0), 2026-07-21 a Tuesday (index 1).
    expect(useEnergyStore.getState().capacityForDay('2026-07-20')).toBe(1);
    expect(useEnergyStore.getState().capacityForDay('2026-07-21')).toBe(2);
  });

  it('a per-day override wins over the mode default', () => {
    setMode('custom');
    useEnergyStore.setState({ overrides: { '2026-07-20': 99 } });
    expect(useEnergyStore.getState().capacityForDay('2026-07-20')).toBe(99);
  });
});

describe('capacityForWeek', () => {
  it('weekly mode: falls back to the flat energyWeeklyCapacity', () => {
    setMode('weekly');
    expect(useEnergyStore.getState().capacityForWeek('2026-07-20')).toBe(50);
  });

  it('custom mode: sums the seven per-weekday amounts', () => {
    setMode('custom', [1, 2, 3, 4, 5, 6, 7]);
    expect(useEnergyStore.getState().capacityForWeek('2026-07-20')).toBe(28);
  });

  it('a week override wins over the mode default', () => {
    setMode('custom');
    useEnergyStore.setState({ overrides: { 'w:2026-07-20': 5 } });
    expect(useEnergyStore.getState().capacityForWeek('2026-07-20')).toBe(5);
  });
});

describe('today-only boost', () => {
  const MON = '2026-07-20';
  const TUE = '2026-07-21';

  it('is zero for a day nothing has been added to', () => {
    setMode('daily');
    expect(useEnergyStore.getState().boostForDay(MON)).toBe(0);
  });

  it('adds to the settings default capacity', () => {
    setMode('daily'); // energyDailyCapacity = 10
    useEnergyStore.getState().setDayBoost(MON, 3);
    expect(useEnergyStore.getState().boostForDay(MON)).toBe(3);
    expect(useEnergyStore.getState().capacityForDay(MON)).toBe(13);
  });

  it('adds to a per-day OVERRIDE rather than replacing it', () => {
    setMode('daily');
    useEnergyStore.getState().setDayCapacity(MON, 6);
    useEnergyStore.getState().setDayBoost(MON, 2);
    expect(useEnergyStore.getState().capacityForDay(MON)).toBe(8);
  });

  // The reason the boost is a separate ROW: the user's usual capacity has to survive it, so
  // that clearing the boost returns the day to exactly what it was.
  it('leaves the base override untouched, and clearing the boost restores it exactly', () => {
    setMode('daily');
    useEnergyStore.getState().setDayCapacity(MON, 6);
    useEnergyStore.getState().setDayBoost(MON, 4);
    expect(useEnergyStore.getState().overrides[MON]).toBe(6); // the base row is unmoved
    expect(useEnergyStore.getState().overrides[boostKey(MON)]).toBe(4); // a DIFFERENT row
    useEnergyStore.getState().setDayBoost(MON, 0);
    expect(useEnergyStore.getState().capacityForDay(MON)).toBe(6);
  });

  it('applies to that date alone — tomorrow is back to normal', () => {
    setMode('daily');
    useEnergyStore.getState().setDayBoost(MON, 5);
    expect(useEnergyStore.getState().capacityForDay(MON)).toBe(15);
    expect(useEnergyStore.getState().boostForDay(TUE)).toBe(0);
    expect(useEnergyStore.getState().capacityForDay(TUE)).toBe(10);
  });

  // A "just for today" adjustment that quietly raised the week's ceiling would be the same
  // silent redefinition the separate row exists to prevent.
  it('does not touch the week capacity', () => {
    setMode('weekly'); // energyWeeklyCapacity = 50
    useEnergyStore.getState().setDayBoost(MON, 7);
    expect(useEnergyStore.getState().capacityForWeek(MON)).toBe(50);
  });

  it('re-setting a boost updates it rather than stacking', () => {
    setMode('daily');
    useEnergyStore.getState().setDayBoost(MON, 2);
    useEnergyStore.getState().setDayBoost(MON, 5);
    expect(useEnergyStore.getState().boostForDay(MON)).toBe(5);
    expect(useEnergyStore.getState().capacityForDay(MON)).toBe(15);
  });
});

/**
 * Per-day pause/pin state. The store is a synchronous mirror of lib/energyDayState.ts's
 * `app_meta` rows — reads happen inside a render pass, so they must never be async.
 */
describe('dayState', () => {
  const MON = '2026-07-20';
  const TUE = '2026-07-21';

  it('defaults to nothing-has-happened for an untouched day', () => {
    expect(useEnergyStore.getState().dayState(MON)).toEqual({
      autoShown: false,
      paused: false,
      pinnedTaskId: null,
    });
  });

  it('markAutoShown stamps only that flag', () => {
    useEnergyStore.getState().markAutoShown(MON);
    expect(useEnergyStore.getState().dayState(MON)).toEqual({
      autoShown: true,
      paused: false,
      pinnedTaskId: null,
    });
  });

  it('pauseDay pauses AND stamps shown, so the sheet cannot re-offer itself', () => {
    useEnergyStore.getState().pauseDay(MON);
    const state = useEnergyStore.getState().dayState(MON);
    expect(state.paused).toBe(true);
    expect(state.autoShown).toBe(true);
  });

  it('pinTask records the one card, and un-pinning leaves the day answered', () => {
    useEnergyStore.getState().pinTask(MON, 'task-1');
    expect(useEnergyStore.getState().dayState(MON).pinnedTaskId).toBe('task-1');
    useEnergyStore.getState().pinTask(MON, 'task-2'); // replaces, never accumulates
    expect(useEnergyStore.getState().dayState(MON).pinnedTaskId).toBe('task-2');
    useEnergyStore.getState().unpinTask(MON);
    expect(useEnergyStore.getState().dayState(MON).pinnedTaskId).toBeNull();
    expect(useEnergyStore.getState().dayState(MON).autoShown).toBe(true);
  });

  it('is per-date — pausing today says nothing about tomorrow', () => {
    useEnergyStore.getState().pauseDay(MON);
    expect(useEnergyStore.getState().dayState(TUE).paused).toBe(false);
  });
});
