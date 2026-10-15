/**
 * timeBoxInput.test.ts — the hour/minute typing rules behind components/TimeBoxInput.tsx.
 *
 * Maintainer, 2026-10-15: *"hour should only go from 00 to 23"* and the hour box could not be
 * reached again once filled. The reachability half is UI; this pins the typing half.
 */
import { composeTime, typeDigit } from '@/components/TimeBoxInput';

jest.mock('@/lib/useKeyboardLift', () => ({ useKeyboardLift: () => ({ ref: { current: null }, onFocus: () => {}, onBlur: () => {} }) }));

describe('typeDigit', () => {
  it('a leading hour digit 3–9 means 03–09 and completes the box', () => {
    expect(typeDigit('hour', '', '7')).toEqual({ buffer: '07', done: true });
  });
  it('refuses an hour past 23 instead of clamping it', () => {
    expect(typeDigit('hour', '2', '7')).toEqual({ buffer: '2', done: false });
    expect(typeDigit('hour', '2', '3')).toEqual({ buffer: '23', done: true });
  });
  it('allows 00–19', () => {
    expect(typeDigit('hour', '0', '0')).toEqual({ buffer: '00', done: true });
    expect(typeDigit('hour', '1', '9')).toEqual({ buffer: '19', done: true });
  });
  it('minute: leading 6–9 completes as 06–09; 59 is the ceiling', () => {
    expect(typeDigit('minute', '', '8')).toEqual({ buffer: '08', done: true });
    expect(typeDigit('minute', '5', '9')).toEqual({ buffer: '59', done: true });
  });
  it('a full buffer starts over (re-typing a selected box replaces it)', () => {
    expect(typeDigit('hour', '14', '1')).toEqual({ buffer: '1', done: false });
  });
});

describe('composeTime', () => {
  it('pads, and treats a missing minute as :00', () => {
    expect(composeTime('7', '')).toBe('07:00');
    expect(composeTime('23', '05')).toBe('23:05');
    expect(composeTime('', '30')).toBe('');
  });
});
