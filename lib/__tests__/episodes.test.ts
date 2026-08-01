/**
 * episodes.test.ts — the ongoing-episode helpers, and the two product promises they carry.
 *
 * Most of this is ordinary branch coverage over pure functions. Two blocks are not:
 *
 *   1. **`isOpen` must be false for a legacy-shaped row** (`episodeState: 'point'` with an
 *      empty `endDate`). `end_date = ''` was the app's implicit "ongoing" sentinel for months
 *      and means three different things; the whole migration decision rests on never reading
 *      it that way again. A regression here would reclassify years of history as open episodes
 *      and greet the user with a wall of prompts.
 *   2. **The no-notification guarantee.** Nothing in this feature may ever schedule anything —
 *      a push about an open illness episode is a nag about being unwell. That is a product
 *      promise with no other enforcement, so it is asserted structurally, by reading the source
 *      of the module and both episode components. Same technique as
 *      lib/__tests__/cardLayout.test.ts's "layouts are presentation only" block.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  backdatedStart,
  closePatch,
  describeDuration,
  episodeDurationMinutes,
  isOpen,
  openEpisodes,
  reliefCandidates,
  toEpisodeState,
} from '@/lib/episodes';

describe('toEpisodeState', () => {
  it('round-trips the three real states', () => {
    expect(toEpisodeState('point')).toBe('point');
    expect(toEpisodeState('ongoing')).toBe('ongoing');
    expect(toEpisodeState('closed')).toBe('closed');
  });

  // The DIRECTION is the point: unknown input must never open an episode.
  it.each(['', 'POINT', 'Ongoing', 'weird', ' ongoing'])('degrades %p to point', (raw) => {
    expect(toEpisodeState(raw)).toBe('point');
  });

  it('degrades a missing value (read as an empty string) to point', () => {
    expect(toEpisodeState(undefined as unknown as string)).toBe('point');
  });
});

describe('isOpen / openEpisodes', () => {
  it('is true only for ongoing', () => {
    expect(isOpen({ episodeState: 'ongoing' })).toBe(true);
    expect(isOpen({ episodeState: 'point' })).toBe(false);
    expect(isOpen({ episodeState: 'closed' })).toBe(false);
  });

  // THE regression test for the migration decision (EPISODES.md §1.5). A blank end date is
  // "no end recorded", not "still happening".
  it('does NOT treat a point entry with a blank end date as open', () => {
    expect(isOpen({ episodeState: 'point', endDate: '' } as never)).toBe(false);
  });

  it('returns nothing for a list of legacy-shaped rows', () => {
    const legacy = [
      { id: 'a', episodeState: 'point' as const, endDate: '' },
      { id: 'b', episodeState: 'point' as const, endDate: '' },
    ];
    expect(openEpisodes(legacy)).toEqual([]);
  });

  it('filters by state alone and preserves input order', () => {
    const logs = [
      { id: 'a', episodeState: 'ongoing' as const },
      { id: 'b', episodeState: 'point' as const },
      { id: 'c', episodeState: 'ongoing' as const },
      { id: 'd', episodeState: 'closed' as const },
    ];
    expect(openEpisodes(logs).map((l) => l.id)).toEqual(['a', 'c']);
  });
});

describe('backdatedStart', () => {
  // `now` is injected, so none of this needs fake timers.
  const now = new Date(2026, 7, 1, 9, 5); // 2026-08-01 09:05 local

  it('resolves "now" to today and the current zero-padded HH:MM', () => {
    expect(backdatedStart('now', now)).toEqual({ date: '2026-08-01', time: '09:05' });
  });

  it('resolves "thisMorning" to today at 08:00', () => {
    expect(backdatedStart('thisMorning', now)).toEqual({ date: '2026-08-01', time: '08:00' });
  });

  it('resolves "lastNight" to the PREVIOUS day at 21:00', () => {
    expect(backdatedStart('lastNight', now)).toEqual({ date: '2026-07-31', time: '21:00' });
  });

  it('rolls "lastNight" back over a month boundary', () => {
    expect(backdatedStart('lastNight', new Date(2026, 8, 1, 0, 30))).toEqual({
      date: '2026-08-31',
      time: '21:00',
    });
  });

  it('rolls "lastNight" back over a year boundary', () => {
    expect(backdatedStart('lastNight', new Date(2026, 0, 1, 2, 0))).toEqual({
      date: '2025-12-31',
      time: '21:00',
    });
  });
});

describe('episodeDurationMinutes', () => {
  const log = (date: string, startTime: string, endDate: string, endTime: string) => ({
    date,
    startTime,
    endDate,
    endTime,
  });

  it('measures a same-day span', () => {
    expect(episodeDurationMinutes(log('2026-08-01', '09:00', '2026-08-01', '11:30'))).toBe(150);
  });

  it('measures a span crossing midnight', () => {
    expect(episodeDurationMinutes(log('2026-08-01', '23:30', '2026-08-02', '00:30'))).toBe(60);
  });

  it('measures a multi-day span', () => {
    expect(episodeDurationMinutes(log('2026-08-01', '08:00', '2026-08-04', '08:00'))).toBe(3 * 1440);
  });

  it.each([
    ['a missing start time', log('2026-08-01', '', '2026-08-01', '11:30')],
    ['a missing end time', log('2026-08-01', '09:00', '2026-08-01', '')],
    ['a missing end date', log('2026-08-01', '09:00', '', '11:30')],
    ['a malformed time', log('2026-08-01', '9am', '2026-08-01', '11:30')],
    ['an out-of-range time', log('2026-08-01', '25:00', '2026-08-01', '11:30')],
  ])('returns null for %s', (_label, entry) => {
    expect(episodeDurationMinutes(entry)).toBeNull();
  });

  // An end typed before the start is a typo, not a negative duration. No error state, no
  // correction prompt — the row simply carries no value.
  it('returns null for a negative span rather than a bogus value', () => {
    expect(episodeDurationMinutes(log('2026-08-01', '11:00', '2026-08-01', '09:00'))).toBeNull();
    expect(episodeDurationMinutes(log('2026-08-02', '09:00', '2026-08-01', '09:00'))).toBeNull();
  });
});

describe('describeDuration', () => {
  it.each([
    [0, { kind: 'underHour' }],
    [59, { kind: 'underHour' }],
    [60, { kind: 'aboutAnHour' }],
    [89, { kind: 'aboutAnHour' }],
    [90, { kind: 'hours', n: 2 }],
    [599, { kind: 'hours', n: 10 }],
    [600, { kind: 'mostOfADay' }],
    [1079, { kind: 'mostOfADay' }],
    [1080, { kind: 'aboutADay' }],
    [2159, { kind: 'aboutADay' }],
    [2160, { kind: 'days', n: 2 }],
    [4320, { kind: 'days', n: 3 }],
  ])('buckets %i minutes', (minutes, expected) => {
    expect(describeDuration(minutes as number)).toEqual(expected);
  });

  it('passes null through', () => {
    expect(describeDuration(null)).toBeNull();
  });

  // Nothing may leak `3h 47m`. Every branch returns a bucket key, and the only numbers that
  // escape are the rounded hour/day counts the bucket itself names.
  it('never returns a raw minutes value from any branch', () => {
    for (let minutes = 0; minutes <= 6000; minutes += 7) {
      const described = describeDuration(minutes);
      expect(described).not.toBeNull();
      if ('n' in described!) {
        expect(described.n).toBe(Math.round(minutes / (described.kind === 'hours' ? 60 : 1440)));
        expect(described.n).not.toBe(minutes);
      }
    }
  });
});

describe('reliefCandidates', () => {
  const medicines = [
    { id: 'm1', name: 'Ibuprofen' },
    { id: 'm2', name: 'Paracetamol' },
    { id: 'm3', name: 'Melatonin' },
  ];
  const episode = { date: '2026-08-01', startTime: '09:00' };
  const stop = { date: '2026-08-01', time: '17:00' };

  it('includes a medicine dosed inside the window', () => {
    const doses = [{ medicineId: 'm1', date: '2026-08-01', takenAt: '12:00' }];
    expect(reliefCandidates(medicines, doses, episode, stop).map((m) => m.id)).toEqual(['m1']);
  });

  it('excludes a dose before the start and one after the stop', () => {
    const doses = [
      { medicineId: 'm1', date: '2026-08-01', takenAt: '08:59' },
      { medicineId: 'm2', date: '2026-08-01', takenAt: '17:01' },
    ];
    expect(reliefCandidates(medicines, doses, episode, stop)).toEqual([]);
  });

  it('includes doses exactly at the start and stop minutes (inclusive bounds)', () => {
    const doses = [
      { medicineId: 'm1', date: '2026-08-01', takenAt: '09:00' },
      { medicineId: 'm2', date: '2026-08-01', takenAt: '17:00' },
    ];
    expect(reliefCandidates(medicines, doses, episode, stop).map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('handles a window crossing midnight', () => {
    const nightEpisode = { date: '2026-08-01', startTime: '22:00' };
    const nightStop = { date: '2026-08-02', time: '06:00' };
    const doses = [
      { medicineId: 'm3', date: '2026-08-01', takenAt: '23:30' },
      { medicineId: 'm1', date: '2026-08-02', takenAt: '07:00' },
    ];
    expect(reliefCandidates(medicines, doses, nightEpisode, nightStop).map((m) => m.id)).toEqual(['m3']);
  });

  it('returns nothing when there are no doses', () => {
    expect(reliefCandidates(medicines, [], episode, stop)).toEqual([]);
  });

  it('ignores a dose whose medicine no longer exists', () => {
    const doses = [{ medicineId: 'deleted', date: '2026-08-01', takenAt: '12:00' }];
    expect(reliefCandidates(medicines, doses, episode, stop)).toEqual([]);
  });

  it('returns nothing when the episode has no parseable start', () => {
    const doses = [{ medicineId: 'm1', date: '2026-08-01', takenAt: '12:00' }];
    expect(reliefCandidates(medicines, doses, { date: '2026-08-01', startTime: '' }, stop)).toEqual([]);
  });
});

describe('closePatch', () => {
  const stop = { date: '2026-08-01', time: '17:00' };

  it('always sets the state and BOTH end fields together', () => {
    expect(closePatch({ stop })).toEqual({
      episodeState: 'closed',
      endDate: '2026-08-01',
      endTime: '17:00',
      reliefNote: '',
      reliefMedicineId: '',
    });
  });

  it('carries the optional relief fields through, trimmed', () => {
    expect(closePatch({ stop, reliefNote: '  dark room  ', reliefMedicineId: 'm1' })).toMatchObject({
      reliefNote: 'dark room',
      reliefMedicineId: 'm1',
    });
  });

  // `rowValues` skips undefined keys, so an undefined here would silently leave a previous
  // value in place on a re-close.
  it('never emits undefined for an omitted relief field', () => {
    const patch = closePatch({ stop });
    expect(patch.reliefNote).not.toBeUndefined();
    expect(patch.reliefMedicineId).not.toBeUndefined();
  });

  it('cannot produce a closed patch with an empty end date', () => {
    // The only input is `stop`, and both end fields are copied from it — there is no branch
    // that sets the state without them.
    for (const time of ['00:00', '17:00', '23:59']) {
      const patch = closePatch({ stop: { date: '2026-08-01', time } });
      expect(patch.episodeState).toBe('closed');
      expect(patch.endDate).not.toBe('');
      expect(patch.endTime).not.toBe('');
    }
  });
});

describe('module boundaries', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');
  /** Strip JSDoc so prose *describing* a rule doesn't trip the scan. */
  const code = (rel: string) => read(rel).replace(/\/\*\*[\s\S]*?\*\//g, '');

  it('lib/episodes.ts reaches no DB, store, notification or widget module', () => {
    const source = code('lib/episodes.ts');
    for (const forbidden of [
      '@/lib/db',
      '@/store/',
      '@/lib/notifications',
      '@/lib/reminders',
      '@/lib/widgets',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  // §5 is a product promise — nothing in this feature ever produces a notification, at any
  // horizon. This is the only thing keeping it true.
  it.each([
    'lib/episodes.ts',
    'components/OpenEpisodeCard.tsx',
    'components/EpisodeCloseSheet.tsx',
  ])('%s schedules nothing', (file) => {
    const source = code(file);
    for (const api of [
      'scheduleDailyReminder',
      'scheduleNotification',
      'syncReminders',
      'expo-notifications',
      'lib/notifications',
      'lib/medicineNotifications',
    ]) {
      expect(source).not.toContain(api);
    }
  });
});
