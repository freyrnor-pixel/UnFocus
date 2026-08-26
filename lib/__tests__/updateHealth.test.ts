/**
 * updateHealth.test.ts — the classifier, and the two properties that make it safe to ship.
 *
 * The first is that it fails toward SILENCE: every uncertain input returns 'unknown', because
 * a wrongly-shown "install a new build" is worse than saying nothing. The second is a source
 * scan pinning the module dependency-free — it runs at render on the Settings screen, and the
 * reason it can is that it touches nothing.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { STALE_AFTER_DAYS, updateHealth } from '../updateHealth';

const NOW = new Date('2026-08-24T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const check = (publishedAt: Date | null | undefined, updatesEnabled = true) =>
  updateHealth({ publishedAt, updatesEnabled, now: NOW });

describe('updateHealth — classifying the running bundle', () => {
  test('a bundle from today is ok', () => {
    expect(check(daysAgo(0))).toEqual({ kind: 'ok', ageDays: 0 });
  });

  test('a bundle inside the window is ok, and reports its age', () => {
    expect(check(daysAgo(6))).toEqual({ kind: 'ok', ageDays: 6 });
  });

  test('the boundary day is stale, not ok', () => {
    // >= rather than >, so the threshold means "at two weeks", not "after two weeks".
    expect(check(daysAgo(STALE_AFTER_DAYS)).kind).toBe('stale');
    expect(check(daysAgo(STALE_AFTER_DAYS - 1)).kind).toBe('ok');
  });

  test('the reported case is stale', () => {
    // 1.6.0 was stranded when runtimeVersion went to 1.7.0 on 2026-08-23; the install had
    // been on its last reachable bundle for weeks by the time it was noticed.
    const health = check(daysAgo(22));
    expect(health).toEqual({ kind: 'stale', ageDays: 22 });
  });

  test('age is whole days, so a part-day never rounds up into staleness', () => {
    const justUnder = new Date(NOW.getTime() - (STALE_AFTER_DAYS * 24 - 1) * 60 * 60 * 1000);
    expect(updateHealth({ publishedAt: justUnder, updatesEnabled: true, now: NOW })).toEqual({
      kind: 'ok',
      ageDays: STALE_AFTER_DAYS - 1,
    });
  });
});

describe('updateHealth — every uncertain input fails toward silence', () => {
  test.each([
    ['no publish date', null],
    ['an undefined publish date', undefined],
    ['an unparseable date', new Date('nonsense')],
  ])('%s is unknown, never stale', (_label, publishedAt) => {
    expect(check(publishedAt as Date | null | undefined)).toEqual({ kind: 'unknown', ageDays: null });
  });

  test('a debug build is unknown however old its bundle is', () => {
    // OTA is compiled out there, so bundle age says nothing about a runtime mismatch — and
    // app/settings.tsx already shows t.version.disabled for this case.
    expect(check(daysAgo(400), false)).toEqual({ kind: 'unknown', ageDays: null });
  });

  test('a bundle dated in the future is unknown, not fresh', () => {
    // A device clock set wrong, not a bundle from tomorrow.
    expect(check(new Date(NOW.getTime() + 60_000))).toEqual({ kind: 'unknown', ageDays: null });
  });
});

describe('updateHealth — the module stays cheap enough to call at render', () => {
  const SRC = readFileSync(join(__dirname, '..', 'updateHealth.ts'), 'utf8');

  test('imports nothing at all', () => {
    // Same discipline as lib/cardLayout.ts and lib/designLab.ts: a render-path helper that
    // reaches a store, the DB or expo-updates itself stops being safe to call per frame, and
    // stops being testable without mocking the thing it exists to describe.
    expect(SRC).not.toMatch(/^\s*import\s/m);
    expect(SRC).not.toMatch(/require\(/);
  });

  test('reads no clock and no global of its own', () => {
    // `now` is injected precisely so the classification is a pure function of its arguments.
    // Comments are stripped first — this file's own prose names the calls it is banning.
    const body = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(body).not.toMatch(/Date\.now\(\)/);
    expect(body).not.toMatch(/new Date\(\)/);
  });
});
