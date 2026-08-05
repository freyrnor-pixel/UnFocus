/**
 * sharingVisibility.ts — the one switch that hides every sharing-with-other-people surface.
 *
 * **2026-08-05, maintainer instruction: "Everything that has to do with sharing with other
 * users" is hidden while the single-user basics are being reworked** ("I'll get back to it
 * later when the basics works for a single user"). This is a VISIBILITY flag, not a feature
 * removal: no table, column, store, setting or code path was deleted, and nothing stops
 * syncing that was syncing before. Flip the constant below to `true` and every surface listed
 * here comes back exactly as it was.
 *
 * **Why a build constant and not a user setting.** The app already has two user-facing
 * settings in this area — `settings.featureSharing` (Sharing & QR) and
 * `settings.peopleModeEnabled` (People/family) — and both already default to OFF, so a fresh
 * install never saw these surfaces anyway. What was still visible was the way IN: the
 * Settings rows that turn them on. A user setting can't hide its own toggle without becoming
 * unreachable, so the switch has to sit above them. Both settings are untouched and still
 * read normally; this constant just gates the entry points that reveal them.
 *
 * Connections:
 *   Imports → nothing (deliberately dependency-free, like lib/cardLayout.ts — it must be safe
 *             to read from any component without pulling a store in)
 *   Used by → app/settings.tsx (the People/family card, the paired-devices card, and the
 *             `featureSharing` row in FEATURE_ROWS), app/(tabs)/plans.tsx +
 *             app/(tabs)/shopping.tsx (the header share icon and the shared sections),
 *             app/(tabs)/index.tsx (Home's shared card)
 *   Data    → none
 *
 * Edit notes:
 *   - **Gate the SURFACE, never the data.** Every call site should hide a component or a
 *     button; none should skip a store load, a migration, a sync pass or a reminder. The
 *     repo's standing rule for feature flags applies here unchanged (AGENTS.md, "For a feature
 *     flag specifically") — turning this back on must restore everything untouched, which it
 *     can only do if nothing was ever prevented from being written.
 *   - Live sync (`lib/liveSync`) and the `people` table keep working while this is false. A
 *     user who had already paired a device does not lose their pairing; they lose the screen
 *     that manages it. That is the intended trade — this is a hide, and an un-hide restores
 *     the same state.
 *   - When this comes back, it should probably come back as the real Sharing feature flag
 *     rather than as a second layer on top of it. Deleting this file and restoring the plain
 *     `featureSharing`/`peopleModeEnabled` reads is the intended end state, not keeping three
 *     switches.
 */

/**
 * Whether any sharing-with-other-people surface renders. `false` while the single-user basics
 * are being reworked — see the header. One line to reverse.
 */
export const SHARING_VISIBLE = false;
