/**
 * medicineSchedule.test.ts — unit tests for lib/medicineSchedule.ts.
 *
 * Covers the four things the medicine card's correctness rests on: which tray "now" falls
 * in, which past trays are still due (a forgotten morning dose must stay visible all day,
 * without ever being called missed), the (medicine, date, tray) dose identity, and the
 * as-needed interval/daily-cap guard. Pure functions — no store, no DB, no mocks.
 */
import {
  asNeededMedicines,
  asNeededState,
  currentTray,
  DEFAULT_TRAY_TIMES,
  formatMinutes,
  isDoseTaken,
  medicinesForTray,
  nextTray,
  normalizeTrayTimes,
  parseTrayTime,
  pendingTrays,
  sortedTrays,
  toTrayIds,
  trayMinutes,
  trayProgress,
  traysInUse,
  TrayId,
  type LoggedDose,
  type SchedulableMedicine,
} from '@/lib/medicineSchedule';

function med(overrides: Partial<SchedulableMedicine> & { id: string }): SchedulableMedicine {
  return {
    trays: [],
    asNeeded: false,
    minIntervalMin: 0,
    maxPerDay: 0,
    childName: '',
    active: true,
    ...overrides,
  };
}

function dose(medicineId: string, tray: string, takenAt: string, date = '2026-07-27'): LoggedDose {
  return { medicineId, date, tray, takenAt };
}

const TIMES = DEFAULT_TRAY_TIMES; // 08:00 / 12:00 / 18:00 / 21:00

describe('tray times', () => {
  it('orders trays by their configured time, not by name', () => {
    expect(sortedTrays(TIMES)).toEqual(['morning', 'midday', 'evening', 'night']);
    // A user who works nights can put the night tray first; ordering must follow the clock.
    const shifted = { ...TIMES, night: '05:00' };
    expect(sortedTrays(shifted)[0]).toBe('night');
  });

  it('converts a tray time to [hour, minute] for the scheduler', () => {
    expect(parseTrayTime(TIMES, 'midday')).toEqual([12, 0]);
    expect(parseTrayTime({ ...TIMES, night: '21:45' }, 'night')).toEqual([21, 45]);
  });

  it('falls back to the default when a stored time is unparseable', () => {
    expect(trayMinutes({ ...TIMES, morning: 'nonsense' }, 'morning')).toBe(8 * 60);
  });

  it('normalizes a partial or corrupt JSON column into a complete map', () => {
    expect(normalizeTrayTimes({ morning: '07:15' })).toEqual({ ...TIMES, morning: '07:15' });
    expect(normalizeTrayTimes(null)).toEqual(TIMES);
    expect(normalizeTrayTimes({ midday: '99:99' })).toEqual(TIMES);
  });

  it('keeps only real tray ids from an untrusted list', () => {
    expect(toTrayIds(['morning', 'lunch', 'night', 'morning'])).toEqual(['morning', 'night']);
    expect(toTrayIds('morning')).toEqual([]);
  });
});

describe('currentTray / nextTray', () => {
  it('picks the last tray at or before now', () => {
    expect(currentTray(TIMES, 7 * 60)).toBeNull(); // before the first tray
    expect(currentTray(TIMES, 8 * 60)).toBe('morning'); // exactly on it
    expect(currentTray(TIMES, 11 * 60 + 59)).toBe('morning');
    expect(currentTray(TIMES, 12 * 60)).toBe('midday');
    expect(currentTray(TIMES, 23 * 60)).toBe('night');
  });

  it('picks the first tray still ahead, and nothing after the last one', () => {
    expect(nextTray(TIMES, 7 * 60)).toBe('morning');
    expect(nextTray(TIMES, 12 * 60)).toBe('evening'); // strictly after now
    expect(nextTray(TIMES, 22 * 60)).toBeNull();
  });
});

describe('tray membership and the person filter', () => {
  const meds = [
    med({ id: 'a', trays: ['morning'] }),
    med({ id: 'b', trays: ['morning', 'night'] }),
    med({ id: 'c', trays: ['morning'], childName: 'Ada' }),
    med({ id: 'd', trays: ['midday'], active: false }),
    med({ id: 'e', asNeeded: true, minIntervalMin: 360 }),
  ];

  it('lists a tray\'s active, scheduled medicines', () => {
    expect(medicinesForTray(meds, 'morning').map((m) => m.id)).toEqual(['a', 'b', 'c']);
    // Inactive medicines leave the card entirely; as-needed ones are never in a tray.
    expect(medicinesForTray(meds, 'midday')).toEqual([]);
  });

  it('treats an undefined person as "everyone" and \'\' as "me"', () => {
    expect(medicinesForTray(meds, 'morning', null).map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(medicinesForTray(meds, 'morning', '').map((m) => m.id)).toEqual(['a', 'b']);
    expect(medicinesForTray(meds, 'morning', 'Ada').map((m) => m.id)).toEqual(['c']);
  });

  it('separates as-needed medicines from the trays', () => {
    expect(asNeededMedicines(meds).map((m) => m.id)).toEqual(['e']);
    expect(traysInUse(meds, TIMES)).toEqual(['morning', 'night']);
  });
});

describe('dose identity and tray progress', () => {
  const meds = [med({ id: 'a', trays: ['morning'] }), med({ id: 'b', trays: ['morning'] })];

  it('matches a dose on (medicine, date, tray)', () => {
    const doses = [dose('a', 'morning', '08:10')];
    expect(isDoseTaken(doses, 'a', 'morning', '2026-07-27')).toBe(true);
    // Same medicine, different tray or different day — a separate dose.
    expect(isDoseTaken(doses, 'a', 'night', '2026-07-27')).toBe(false);
    expect(isDoseTaken(doses, 'a', 'morning', '2026-07-28')).toBe(false);
  });

  it('counts taken vs total for a tray', () => {
    expect(trayProgress(meds, [dose('a', 'morning', '08:10')], 'morning', '2026-07-27')).toEqual({
      total: 2,
      taken: 1,
    });
  });
});

describe('pendingTrays — "still due", never "missed"', () => {
  const meds = [med({ id: 'a', trays: ['morning'] }), med({ id: 'b', trays: ['night'] })];

  it('keeps a forgotten earlier tray visible later in the day', () => {
    // 14:00, morning untaken: the morning tray is still due, the night tray is not yet.
    expect(pendingTrays(meds, [], TIMES, '2026-07-27', 14 * 60)).toEqual(['morning']);
  });

  it('drops a tray once everything in it is logged', () => {
    const doses = [dose('a', 'morning', '11:40')];
    expect(pendingTrays(meds, doses, TIMES, '2026-07-27', 14 * 60)).toEqual([]);
  });

  it('never reports a tray whose time has not arrived', () => {
    expect(pendingTrays(meds, [], TIMES, '2026-07-27', 7 * 60)).toEqual([]);
  });

  it('reports every past unfinished tray, in time order', () => {
    expect(pendingTrays(meds, [], TIMES, '2026-07-27', 23 * 60)).toEqual(['morning', 'night']);
  });
});

describe('asNeededState — the interval / daily-cap guard', () => {
  const painkiller = med({ id: 'p', asNeeded: true, minIntervalMin: 360, maxPerDay: 3 });

  it('allows a first dose with nothing logged', () => {
    const state = asNeededState(painkiller, [], '2026-07-27', 9 * 60);
    expect(state).toMatchObject({ takenToday: 0, canTake: true, nextAllowedMinutes: null, atDailyLimit: false });
  });

  it('blocks until the minimum gap has passed, and reports when that is', () => {
    const doses = [dose('p', '', '08:20')];
    const blocked = asNeededState(painkiller, doses, '2026-07-27', 12 * 60);
    expect(blocked.canTake).toBe(false);
    expect(blocked.nextAllowedMinutes).toBe(8 * 60 + 20 + 360); // 14:20
    expect(formatMinutes(blocked.nextAllowedMinutes!)).toBe('14:20');

    const allowed = asNeededState(painkiller, doses, '2026-07-27', 14 * 60 + 20);
    expect(allowed).toMatchObject({ canTake: true, nextAllowedMinutes: null });
  });

  it('measures the gap from the most recent dose, not the first', () => {
    const doses = [dose('p', '', '08:00'), dose('p', '', '13:00')];
    const state = asNeededState(painkiller, doses, '2026-07-27', 14 * 60);
    expect(state.nextAllowedMinutes).toBe(13 * 60 + 360); // from 13:00, not 08:00
    expect(state.canTake).toBe(false);
  });

  it('blocks at the daily cap even once the gap has passed', () => {
    const doses = [dose('p', '', '02:00'), dose('p', '', '08:00'), dose('p', '', '14:00')];
    const state = asNeededState(painkiller, doses, '2026-07-27', 22 * 60);
    expect(state).toMatchObject({ takenToday: 3, atDailyLimit: true, canTake: false });
  });

  it('has no cap and no gap when both are 0', () => {
    const free = med({ id: 'f', asNeeded: true });
    const doses = [dose('f', '', '08:00'), dose('f', '', '08:05')];
    expect(asNeededState(free, doses, '2026-07-27', 8 * 60 + 6)).toMatchObject({
      canTake: true,
      atDailyLimit: false,
      nextAllowedMinutes: null,
    });
  });

  it('ignores other days and other medicines', () => {
    const doses = [dose('p', '', '08:00', '2026-07-26'), dose('other', '', '08:00')];
    expect(asNeededState(painkiller, doses, '2026-07-27', 9 * 60)).toMatchObject({
      takenToday: 0,
      canTake: true,
    });
  });
});

describe('formatMinutes', () => {
  it('pads and wraps past midnight', () => {
    expect(formatMinutes(0)).toBe('00:00');
    expect(formatMinutes(9 * 60 + 5)).toBe('09:05');
    expect(formatMinutes(25 * 60)).toBe('01:00'); // a gap that crosses midnight
  });
});

describe('tray id typing', () => {
  it('keeps TrayId assignable from the exported tuple', () => {
    const tray: TrayId = 'evening';
    expect(sortedTrays(TIMES)).toContain(tray);
  });
});
