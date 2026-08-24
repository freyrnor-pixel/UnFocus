/**
 * updateHealth.ts — tell a STRANDED install apart from an up-to-date one.
 *
 * An OTA only reaches installs whose runtime matches app.json's `runtimeVersion`. When a
 * native change bumps that value, every install still on the old runtime silently stops
 * receiving updates: the app checks, the server has nothing for its runtime, and it reports
 * "you're on the latest update." That is true and useless — the fix is a new APK, not an
 * update, and nothing on screen said so. Reported 2026-08-24 against 1.6.0 / runtime
 * 01a025dc, three weeks after runtimeVersion went 1.6.0 -> 1.7.0.
 *
 * ⚠️ **A stranded install cannot be TOLD anything new, and that constraint shapes this whole
 * module.** Every channel that could carry "a newer runtime exists" — an OTA payload, a
 * newer i18n string, a constant in the JS bundle — is the exact channel that has stopped
 * reaching it. `checkForUpdateAsync()` is no help either: the server filters by runtime
 * before it answers, so a stranded device and a genuinely current one get the same
 * `isAvailable: false`. So the signal has to be derivable from what the device ALREADY
 * holds, and the only one there is: **how old the running bundle is.**
 *
 * That makes this a heuristic, and the copy it drives says "may" rather than "is" for
 * exactly that reason. It is a good heuristic — `update.yml` publishes on every merge to
 * main (596 runs by 2026-08-23), so a healthy install refreshes every few days and a bundle
 * past STALE_AFTER_DAYS is far more likely stranded than merely quiet. It must never be
 * upgraded to a claim without a real signal to hang it on.
 *
 * Connections:
 *   Imports → none (dependency-free by design, like lib/cardLayout.ts and lib/growth.ts)
 *   Used by → app/settings.tsx (the Version & updates card + its check-for-updates result),
 *             lib/__tests__/updateHealth.test.ts
 *   Data    → none (pure; the caller reads expo-updates and passes the values in)
 *
 * Edit notes:
 *   - **Fails toward silence.** Anything unknown — no publish date, updates disabled in a
 *     debug build, a clock behind the bundle's own timestamp — returns 'unknown', never
 *     'stale'. A wrong "reinstall the app" is a worse outcome than saying nothing, since
 *     the honest state of a quiet week and a stranded runtime look identical from here.
 *   - An EMBEDDED launch counts. `createdAt` is the build's own commit time there, so an
 *     old embedded bundle means either an old APK was just installed or OTA has never
 *     landed — both are the same conversation.
 *   - Keep it dependency-free: it is called at render on a screen that already mounts a lot.
 */

/** Days a running bundle may age before the app offers the runtime-mismatch explanation.
 *  Two weeks is ~4x the observed gap between merges to main, so a normal quiet stretch
 *  does not reach it, while the reported case (three weeks) clears it comfortably. */
export const STALE_AFTER_DAYS = 14;

export type UpdateHealthKind =
  /** Running a recent bundle — OTA is reaching this install. */
  | 'ok'
  /** Not enough information to judge (no publish date, or OTA is off in a debug build). */
  | 'unknown'
  /** The running bundle is old enough that a runtime mismatch is the likely explanation. */
  | 'stale';

export type UpdateHealth = {
  kind: UpdateHealthKind;
  /** Whole days since the running bundle was published, or null when unknown. */
  ageDays: number | null;
};

export type UpdateHealthInput = {
  /** `Updates.createdAt` — when the running bundle was published (build time if embedded). */
  publishedAt: Date | null | undefined;
  /** `Updates.isEnabled` — false in a debug build, where OTA is compiled out entirely. */
  updatesEnabled: boolean;
  /** Injected so the pure function stays testable; callers pass `new Date()`. */
  now: Date;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Classify the running bundle. See the header for why age is the only available signal and
 * why every uncertain case returns 'unknown'.
 */
export function updateHealth({ publishedAt, updatesEnabled, now }: UpdateHealthInput): UpdateHealth {
  // A debug build has no OTA at all, so "old bundle" says nothing about a runtime mismatch.
  // app/settings.tsx already shows its own `t.version.disabled` line for this case.
  if (!updatesEnabled) return { kind: 'unknown', ageDays: null };

  const ms = publishedAt instanceof Date ? publishedAt.getTime() : NaN;
  if (!Number.isFinite(ms)) return { kind: 'unknown', ageDays: null };

  const elapsed = now.getTime() - ms;
  // A bundle published in the future means the device clock is wrong, not that the bundle is
  // fresh — either way there is nothing honest to say about it.
  if (!Number.isFinite(elapsed) || elapsed < 0) return { kind: 'unknown', ageDays: null };

  const ageDays = Math.floor(elapsed / MS_PER_DAY);
  return { kind: ageDays >= STALE_AFTER_DAYS ? 'stale' : 'ok', ageDays };
}
