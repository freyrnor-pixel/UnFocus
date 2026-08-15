/**
 * widgetSync.test.ts — unit tests for lib/widgets/sync.ts's scheduleWidgetSync debounce.
 *
 * Verifies that a burst of scheduleWidgetSync() calls collapses into a single
 * syncWidgetsAndOverview() run (observed via the mocked saveWidgetSnapshot), and that
 * calls spaced further apart than the delay each produce their own run. Every store the
 * real buildWidgetSnapshot() reads is mocked to an empty/neutral state, along with
 * lib/notifications and lib/widgets/snapshot's write.
 *
 * ⚠️ The store mock list has to GROW with buildWidgetSnapshot's reads — an unmocked store is
 * not a failed assertion here, it is a worker crash with a stack pointing at sync.ts. That is
 * what adding useMedicineStore looked like in 2026-08-15.
 */
import { scheduleWidgetSync } from '@/lib/widgets/sync';
import { saveWidgetSnapshot } from '@/lib/widgets/snapshot';

// Spread the real module rather than replacing it: WIDGET_ACCENT lives here too (2026-08-15)
// and buildWidgetSnapshot reads it, so a bare `{ saveWidgetSnapshot }` mock crashes the sync
// it is trying to observe. Only the write is stubbed.
jest.mock('@/lib/widgets/snapshot', () => ({
  ...jest.requireActual('@/lib/widgets/snapshot'),
  saveWidgetSnapshot: jest.fn(),
}));
jest.mock('@/lib/notifications', () => ({
  refreshPersistentNotification: jest.fn().mockResolvedValue(undefined),
  cancelPersistentNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/store/useSettingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      persistentNotifEnabled: false,
      language: 'en',
      featureMedicine: false,
      medicineTrayTimes: { morning: '08:00', midday: '12:00', evening: '18:00', night: '21:00' },
    }),
  },
}));
jest.mock('@/store/useTaskStore', () => ({
  useTaskStore: { getState: () => ({ tasksForDate: () => [] }) },
}));
jest.mock('@/store/useShoppingStore', () => ({
  useShoppingStore: { getState: () => ({ items: [] }) },
}));
jest.mock('@/store/useShoppingListStore', () => ({
  useShoppingListStore: { getState: () => ({ currentList: () => undefined }) },
}));
jest.mock('@/store/useNotesStore', () => ({
  useNotesStore: { getState: () => ({ notes: [] }) },
}));
jest.mock('@/store/useHabitStore', () => ({
  useHabitStore: { getState: () => ({ habits: [], logs: [] }) },
}));
jest.mock('@/store/useHealthStore', () => ({
  useHealthStore: { getState: () => ({ logs: [] }) },
}));
jest.mock('@/store/useMedicineStore', () => ({
  useMedicineStore: { getState: () => ({ medicines: [], doses: [] }) },
}));

const save = saveWidgetSnapshot as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  save.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('scheduleWidgetSync', () => {
  it('coalesces a burst of calls into a single sync', () => {
    scheduleWidgetSync();
    scheduleWidgetSync();
    scheduleWidgetSync();
    expect(save).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('runs a fresh sync for calls spaced further apart than the delay', () => {
    scheduleWidgetSync(1000);
    jest.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1);

    scheduleWidgetSync(1000);
    jest.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
