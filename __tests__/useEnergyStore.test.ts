/**
 * useEnergyStore.test.ts — unit tests for capacityForDay/capacityForWeek under each
 * energyMode (2026-07-24): 'daily'/'weekly' use the flat settings capacity, 'custom'
 * picks/sums the per-weekday energyCustomCapacities. A period override still wins
 * over any mode default.
 *
 * Mocks '@/lib/db' (same headless idiom as settingsStore.test.ts) since useEnergyStore
 * persists overrides through lib/dataAccess.
 */
import db from '@/lib/db';
import { useEnergyStore } from '@/store/useEnergyStore';
import { useSettingsStore, EnergyMode } from '@/store/useSettingsStore';

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
  useEnergyStore.setState({ overrides: {}, loaded: false });
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
