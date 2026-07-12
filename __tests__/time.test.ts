/**
 * time.test.ts — unit tests for lib/time.ts (HH:MM parsers).
 *
 * The two parsers have deliberately different contracts: strict returns null on
 * bad input (caller cancels the reminder), default clamps/falls back to 08:00
 * (caller must still fire). Pure functions, no mocks.
 */
import { parseTimeStrict, parseTimeOrDefault } from '@/lib/time';

describe('parseTimeStrict', () => {
  it('parses a valid 24h time', () => {
    expect(parseTimeStrict('08:30')).toEqual([8, 30]);
    expect(parseTimeStrict('00:00')).toEqual([0, 0]);
    expect(parseTimeStrict('23:59')).toEqual([23, 59]);
  });
  it('returns null for out-of-range values', () => {
    expect(parseTimeStrict('24:00')).toBeNull();
    expect(parseTimeStrict('12:60')).toBeNull();
    expect(parseTimeStrict('-1:00')).toBeNull();
  });
  it('returns null for non-numeric / empty input', () => {
    expect(parseTimeStrict('abc')).toBeNull();
    expect(parseTimeStrict('')).toBeNull();
  });
});

describe('parseTimeOrDefault', () => {
  it('parses a valid time', () => {
    expect(parseTimeOrDefault('09:15')).toEqual([9, 15]);
  });
  it('falls back to 08:00 on empty / non-numeric input', () => {
    expect(parseTimeOrDefault('')).toEqual([8, 0]);
    expect(parseTimeOrDefault('nonsense')).toEqual([8, 0]);
  });
  it('clamps out-of-range numbers into valid ranges', () => {
    expect(parseTimeOrDefault('25:99')).toEqual([23, 59]);
    expect(parseTimeOrDefault('-1:-1')).toEqual([0, 0]);
  });
});
