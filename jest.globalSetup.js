/**
 * jest.globalSetup.js — pins the test process to Norway's timezone.
 *
 * Runs in the REAL Node process before any worker is forked, which is the only place a
 * TZ change actually takes: inside a test file `process.env` is jest's sandboxed copy, so
 * assigning TZ there sets a string nobody reads and Date keeps the runner's zone. Workers
 * inherit this env, and --runInBand picks it up directly.
 *
 * Why Europe/Oslo and not UTC: this app is Norwegian-first, every date key is a LOCAL
 * `YYYY-MM-DD` (lib/date.ts), and a UTC runner cannot tell a correct local-date helper from
 * one that reads `toISOString().slice(0, 10)` — the two agree exactly when the offset is
 * zero. Two shipped bugs hid in that blind spot (the health sparkline's day keys and the
 * monthly-reset summary's purchase dates, both fixed 2026-09-12). Oslo has a non-zero offset
 * in both halves of the year (+1/+2), so the difference is observable year-round.
 *
 * `__tests__/dateLocalUtc.test.ts` opens with a guard asserting this actually took effect —
 * if this file ever stops being wired up, that guard fails rather than the TZ-sensitive
 * assertions silently going vacuous.
 */
module.exports = async () => {
  process.env.TZ = 'Europe/Oslo';
};
