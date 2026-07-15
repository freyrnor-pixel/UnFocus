/**
 * notificationsQuietHours.test.ts — unit tests for the pure quiet-hours math in
 * lib/notifications.ts (isWithinQuietHours / pushPastQuietHours).
 *
 * These two functions decide whether a reminder falls in the quiet window and,
 * if so, how far to defer it — the shared primitive under both task ("shift")
 * and habit ("skip") schedulers. Same-day, midnight-crossing, and zero-width
 * windows all have to behave, so they're each covered here.
 */
import { isWithinQuietHours, pushPastQuietHours } from '@/lib/notifications';

describe('isWithinQuietHours', () => {
  it('handles a same-day window [13:00, 15:00)', () => {
    expect(isWithinQuietHours(12, 59, '13:00', '15:00')).toBe(false);
    expect(isWithinQuietHours(13, 0, '13:00', '15:00')).toBe(true); // inclusive start
    expect(isWithinQuietHours(14, 30, '13:00', '15:00')).toBe(true);
    expect(isWithinQuietHours(15, 0, '13:00', '15:00')).toBe(false); // exclusive end
  });

  it('handles a window that crosses midnight [21:00, 08:00)', () => {
    expect(isWithinQuietHours(22, 0, '21:00', '08:00')).toBe(true); // evening side
    expect(isWithinQuietHours(3, 0, '21:00', '08:00')).toBe(true); // morning side
    expect(isWithinQuietHours(8, 0, '21:00', '08:00')).toBe(false); // exclusive end
    expect(isWithinQuietHours(12, 0, '21:00', '08:00')).toBe(false); // midday
  });

  it('treats a zero-width window as always off', () => {
    expect(isWithinQuietHours(12, 0, '09:00', '09:00')).toBe(false);
  });
});

describe('pushPastQuietHours', () => {
  it('leaves a time outside the window unchanged', () => {
    expect(pushPastQuietHours(12, 0, '21:00', '08:00')).toEqual({
      hour: 12,
      minute: 0,
      rolledOver: false,
    });
  });

  it('defers a morning-side time to the window end (same day)', () => {
    // 03:00 is inside [21:00, 08:00) on the morning side → pushed to 08:00, same day.
    expect(pushPastQuietHours(3, 0, '21:00', '08:00')).toEqual({
      hour: 8,
      minute: 0,
      rolledOver: false,
    });
  });

  it('defers an evening-side time to the window end and rolls over to next day', () => {
    // 22:00 is inside [21:00, 08:00) on the evening side → pushed to 08:00 next day.
    expect(pushPastQuietHours(22, 0, '21:00', '08:00')).toEqual({
      hour: 8,
      minute: 0,
      rolledOver: true,
    });
  });
});
