/**
 * buildInfo.ts — which commit the running JS was built from
 *
 * `Updates.updateId` identifies an OTA to EAS, and to nobody else: it maps to no commit
 * that a maintainer or a later session can look up. So a bug report has always opened with
 * an unanswerable question — "is the fix even in the build you are holding?" — and answering
 * it cost a session's worth of guessing at least twice (see the 2026-08-29 report, where
 * everything WAS merged and published and the real finding was a decision parked in prose).
 *
 * This module closes that. `.github/workflows/update.yml` rewrites the file from the merge
 * commit immediately before `eas update`, so the stamp travels inside the bundle it describes
 * and cannot drift from it. `app/settings.tsx` draws it in the Version & updates card.
 *
 * Connections:
 *   Imports → (none — deliberately dependency-free, see below)
 *   Used by → app/settings.tsx (Version & updates card + the debug-note export header),
 *             scripts/stamp-build-info.mjs (rewrites this file in CI),
 *             lib/__tests__/buildInfo.test.ts
 *   Data    → none
 *
 * Edit notes:
 *   - ⚠️ **The committed values are the DEV placeholder and must stay that way.** Never
 *     hand-write a real SHA here: the point is that the stamp is generated, and a committed
 *     one would be wrong for every build after the commit that wrote it — the exact "a
 *     hand-copied constant with a comment telling you to keep it in step is not a mechanism"
 *     failure the widget palette entry in AGENTS.md records.
 *   - **Dependency-free on purpose.** It is read during render on Settings and is written by a
 *     plain node script in CI; an import here would make the generator need the module graph.
 *   - The generator rewrites this file by regex on the three `export const` lines, so keep
 *     them single-line and literal. `lib/__tests__/buildInfo.test.ts` asserts the shapes match
 *     what the script writes, which is what stops a refactor here silently breaking the stamp.
 */

/**
 * Full 40-char commit SHA the bundle was built from, or `DEV_SHA` when this file has not been
 * stamped (any local run, and any build made outside `update.yml`).
 */
export const BUILD_COMMIT = 'development';

/**
 * The commit's subject line — the merge title, e.g. `Merge pull request #652 — add "Reduce
 * visual effects"`. Truncated by the generator to `MAX_SUBJECT` so a long title cannot make
 * the Settings row unreadable.
 */
export const BUILD_SUBJECT = 'Local development build';

/** ISO-8601 timestamp of the stamping run, or `''` when unstamped. */
export const BUILD_TIME = '';

/** The value `BUILD_COMMIT` carries when nothing has stamped this file. */
export const DEV_SHA = 'development';

/** Longest subject the generator will write. Keeps the Settings row to a readable length. */
export const MAX_SUBJECT = 72;

/** True when the running JS was built by CI rather than locally. */
export function isStamped(): boolean {
  return BUILD_COMMIT !== DEV_SHA;
}

/**
 * What the Version card shows for the commit: the short SHA when stamped, and an explicit
 * "not stamped" word otherwise. Deliberately NOT falling back to a blank — an empty row reads
 * as a rendering bug, where "development" reads as the true answer.
 */
export function shortCommit(): string {
  return isStamped() ? BUILD_COMMIT.slice(0, 7) : DEV_SHA;
}
