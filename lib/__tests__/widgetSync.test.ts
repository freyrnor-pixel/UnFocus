/**
 * widgetSync.test.ts — unit tests for lib/widgets/sync.ts's scheduleWidgetSync debounce.
 *
 * Verifies that a burst of scheduleWidgetSync() calls collapses into a single
 * syncWidgetsAndOverview() run (observed via the mocked saveWidgetSnapshot), and that
 * calls spaced further apart than the delay each produce their own run. Every store the
 * real buildWidgetSnapshot() reads is mocked to an empty/neutral state, along with
 * lib/notifications and lib/widgets/snapshot — only '@/lib/db' is not needed since all
 * stores that would otherwise touch it are mocked outright.
 */
import { scheduleWidgetSync } from '@/lib/widgets/sync';
import { saveWidgetSnapshot } from '@/lib/widgets/snapshot';

jest.mock('@/lib/widgets/snapshot', () => ({ saveWidgetSnapshot: jest.fn() }));
jest.mock('@/lib/notifications', () => ({
  refreshPersistentNotification: jest.fn().mockResolvedValue(undefined),
  cancelPersistentNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/store/useSettingsStore', () => ({
  useSettingsStore: { getState: () => ({ persistentNotifEnabled: false, language: 'en' }) },
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
