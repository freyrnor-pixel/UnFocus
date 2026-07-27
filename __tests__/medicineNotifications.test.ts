/**
 * medicineNotifications.test.ts — unit tests for lib/medicineNotifications.ts.
 *
 * The tray reminders' contract: one notification per tray (never one per medicine), only
 * for trays that hold something, cancelling exactly the trays that shouldn't fire (never
 * the one it's about to schedule — that's the cancel/schedule race), and carrying the tray
 * id + the 'medicine-reminder' category so the notification's Taken button can log the tray.
 * Quiet hours SKIP a tray rather than shifting it (same as habits, Decision 016 Q4).
 *
 * Only the scheduling primitives and i18n are mocked; the real tray math
 * (lib/medicineSchedule) and quiet-hours math (lib/notifications) are kept.
 */
import * as notif from '@/lib/notifications';
import { syncTrayReminders, MedicineNotifSettings, NotifiableMedicine } from '@/lib/medicineNotifications';
import { DEFAULT_TRAY_TIMES } from '@/lib/medicineSchedule';

jest.mock('@/lib/notifications', () => {
  const actual = jest.requireActual('@/lib/notifications');
  return {
    __esModule: true,
    ...actual,
    scheduleDailyReminder: jest.fn(),
    cancelDailyReminder: jest.fn().mockResolvedValue(undefined),
    syncMedicineCategories: jest.fn().mockResolvedValue(undefined),
    scheduleTrayReNudge: jest.fn().mockResolvedValue(undefined),
  };
});
jest.mock('@/lib/i18n', () => ({
  getTranslations: () => ({
    notif: {
      actionTaken: 'Taken',
      actionRemindLater: 'Later',
      medicineTrayTitle: (tray: string) => `${tray} medicine`,
      medicineTrayMore: (n: number) => `+${n} more`,
      medicineSnoozeBody: 'later body',
    },
    medicine: {
      trays: { morning: 'Morning', midday: 'Midday', evening: 'Evening', night: 'Night' },
    },
  }),
}));

const schedule = notif.scheduleDailyReminder as jest.Mock;
const cancel = notif.cancelDailyReminder as jest.Mock;

const baseSettings: MedicineNotifSettings = {
  featureMedicine: true,
  medicineRemindersEnabled: true,
  medicineTrayTimes: DEFAULT_TRAY_TIMES,
  language: 'en',
  quietHoursEnabled: false,
  quietHoursStart: '21:00',
  quietHoursEnd: '08:00',
};

function med(overrides: Partial<NotifiableMedicine> & { id: string }): NotifiableMedicine {
  return {
    name: 'Elvanse',
    dose: '30 mg',
    trays: ['morning'],
    asNeeded: false,
    minIntervalMin: 0,
    maxPerDay: 0,
    childName: '',
    active: true,
    ...overrides,
  };
}

beforeEach(() => {
  schedule.mockClear();
  cancel.mockClear();
});

/** The scheduled keys, e.g. ['medtray-morning']. */
function scheduledKeys(): string[] {
  return schedule.mock.calls.map((c) => c[0] as string);
}

describe('syncTrayReminders', () => {
  it('schedules one reminder per non-empty tray at that tray\'s time', () => {
    syncTrayReminders([med({ id: 'a', trays: ['morning', 'night'] })], baseSettings);
    expect(scheduledKeys()).toEqual(['medtray-morning', 'medtray-night']);
    const [, hour, minute] = schedule.mock.calls[0];
    expect([hour, minute]).toEqual([8, 0]);
  });

  it('schedules ONE reminder for a tray holding several medicines, listing them', () => {
    syncTrayReminders(
      [med({ id: 'a' }), med({ id: 'b', name: 'Omega-3', dose: '' })],
      baseSettings
    );
    expect(scheduledKeys()).toEqual(['medtray-morning']);
    expect(schedule.mock.calls[0][3].body).toBe('Elvanse 30 mg, Omega-3');
  });

  it('collapses a long tray to "+N more"', () => {
    const meds = ['a', 'b', 'c', 'd', 'e'].map((id) => med({ id, name: id.toUpperCase(), dose: '' }));
    syncTrayReminders(meds, baseSettings);
    expect(schedule.mock.calls[0][3].body).toBe('A, B, C +2 more');
  });

  it('does NOT blanket-cancel a tray it is about to schedule (the cancel/schedule race)', () => {
    syncTrayReminders([med({ id: 'a', trays: ['morning'] })], baseSettings);
    // scheduleDailyReminder cancels its own identifier internally; an extra cancel here could
    // resolve after the schedule landed and silently un-schedule it.
    expect(cancel).not.toHaveBeenCalledWith('medtray-morning');
    expect(cancel).toHaveBeenCalledWith('medtray-midday');
  });

  it('carries the tray id + medicine category so the Taken button works', () => {
    syncTrayReminders([med({ id: 'a' })], baseSettings);
    expect(schedule.mock.calls[0][4]).toEqual({
      data: { medicineTray: 'morning' },
      categoryIdentifier: 'medicine-reminder',
    });
  });

  it('cancels every tray when nothing is scheduled, so an emptied tray stops firing', () => {
    syncTrayReminders([], baseSettings);
    expect(cancel).toHaveBeenCalledWith('medtray-morning');
    expect(cancel).toHaveBeenCalledWith('medtray-midday');
    expect(cancel).toHaveBeenCalledWith('medtray-evening');
    expect(cancel).toHaveBeenCalledWith('medtray-night');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('never schedules an as-needed medicine — nothing should nudge you to take one', () => {
    syncTrayReminders([med({ id: 'p', asNeeded: true, trays: [] })], baseSettings);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('ignores inactive medicines', () => {
    syncTrayReminders([med({ id: 'a', active: false })], baseSettings);
    expect(schedule).not.toHaveBeenCalled();
  });

  it('covers every person\'s medicine in a shared tray', () => {
    syncTrayReminders([med({ id: 'a' }), med({ id: 'k', name: 'Vitamin D', dose: '', childName: 'Ada' })], baseSettings);
    expect(scheduledKeys()).toEqual(['medtray-morning']);
    expect(schedule.mock.calls[0][3].body).toContain('Vitamin D');
  });

  it('schedules nothing when reminders or the feature are off', () => {
    syncTrayReminders([med({ id: 'a' })], { ...baseSettings, medicineRemindersEnabled: false });
    expect(schedule).not.toHaveBeenCalled();
    syncTrayReminders([med({ id: 'a' })], { ...baseSettings, featureMedicine: false });
    expect(schedule).not.toHaveBeenCalled();
    // Cancels ran either way — the reminders must actually go away, not just stay hidden.
    expect(cancel).toHaveBeenCalledWith('medtray-morning');
  });

  it('SKIPS a tray inside quiet hours rather than shifting it past the window', () => {
    // Night tray at 21:00 falls inside 21:00–08:00; morning at 08:00 is outside (end-exclusive).
    syncTrayReminders([med({ id: 'a', trays: ['morning', 'night'] })], {
      ...baseSettings,
      quietHoursEnabled: true,
    });
    expect(scheduledKeys()).toEqual(['medtray-morning']);
  });

  it('uses a custom tray time', () => {
    syncTrayReminders([med({ id: 'a', trays: ['midday'] })], {
      ...baseSettings,
      medicineTrayTimes: { ...DEFAULT_TRAY_TIMES, midday: '13:45' },
    });
    const [key, hour, minute] = schedule.mock.calls[0];
    expect([key, hour, minute]).toEqual(['medtray-midday', 13, 45]);
  });
});
