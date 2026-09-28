/**
 * useOtaAutoApply.ts — make a published OTA reach the user without them having to find it.
 *
 * Maintainer, 2026-09-28: *"The latest updates have not reached me."* The install was on the
 * right runtime and every publish had succeeded — it was one update behind, because of how
 * expo-updates applies: it downloads on cold start and swaps the bundle only on the NEXT cold
 * start, and Android rarely cold-starts an app that is merely backgrounded. The only other path
 * was Home's cloud icon, which has to be noticed and tapped.
 *
 * Two things, both silent:
 *   1. **Download as soon as a newer update is seen.** ScreenHeader's poll (mount / foreground /
 *      10 min) only CHECKS, which flips `isUpdateAvailable` but downloads nothing.
 *   2. **Apply it on the way back in.** When the app returns to the foreground after at least
 *      `AWAY_MS` in the background with an update downloaded, reload. The user was away, so
 *      there is no half-done gesture to lose; a short trip (copying a code from another app,
 *      answering a notification) stays under the threshold and keeps its unsaved input.
 *
 * Connections:
 *   Imports → expo-updates (useUpdates, fetchUpdateAsync, reloadAsync, isEnabled),
 *             react-native (AppState)
 *   Used by → app/_layout.tsx (RootLayout, once)
 *   Data    → none
 *
 * Edit notes:
 *   - `Updates.isEnabled` is false in dev/debug builds and on web, so both effects are inert there.
 *   - Errors are swallowed on purpose: a failed download or reload leaves the user on a working
 *     bundle, and Home's cloud icon (ScreenHeader) is still there as the manual path.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

/** Minimum time in the background before a pending update is applied on return. */
export const AWAY_MS = 60_000;

export function useOtaAutoApply() {
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();
  const pendingRef = useRef(isUpdatePending);

  // 1. Download whatever the poll found.
  useEffect(() => {
    pendingRef.current = isUpdatePending;
    if (!Updates.isEnabled || !isUpdateAvailable || isUpdatePending) return;
    Updates.fetchUpdateAsync().catch(() => {});
  }, [isUpdateAvailable, isUpdatePending]);

  // 2. Apply on return from a real absence.
  useEffect(() => {
    if (!Updates.isEnabled) return;
    let leftAt: number | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        leftAt = Date.now();
        return;
      }
      if (state !== 'active' || leftAt === null) return;
      const away = Date.now() - leftAt;
      leftAt = null;
      if (away >= AWAY_MS && pendingRef.current) {
        Updates.reloadAsync().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);
}
