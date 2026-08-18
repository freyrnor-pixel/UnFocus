/**
 * KeepAwakeInStore.tsx — holds the screen awake while the "In the store" layout is showing.
 *
 * Renders nothing. Its entire job is to own an `expo-keep-awake` lock for exactly as long as
 * the shopping screen is drawn in the in-store chip layout — the one surface in this app you
 * stand in front of for twenty minutes with your hands full, where a screen timeout mid-aisle
 * costs a re-unlock and your place in the list.
 *
 * Inherited from components/ShoppingStoreMode.tsx, which was retired 2026-08-20 when the chip
 * layout became the single in-store surface. That component held the same lock; this is the
 * part of it worth keeping.
 *
 * Connections:
 *   Imports → expo-keep-awake
 *   Used by → app/(tabs)/shopping.tsx (mounted only while `layoutSpec.chips` is set)
 *   Data    → none. Holds an expo-keep-awake lock while mounted; no store, no DB.
 *
 * Edit notes:
 *   - **The conditional MOUNT is the whole contract, and it has to stay at the call site.**
 *     `useKeepAwake()` acquires on mount and releases on unmount, so the lock can only be
 *     scoped correctly by rendering this component conditionally. Calling the hook inside
 *     app/(tabs)/shopping.tsx directly would run it for the lifetime of that screen and hold
 *     the phone awake for a user who never opened the in-store layout — a battery bug with no
 *     visible symptom, which is why __tests__/shoppingStoreMode.test.ts asserts the hook is
 *     not called at the top level of the shopping screen.
 *   - **Mount it ONCE, at screen level, never per list card.** The layout is a per-SURFACE
 *     setting (lib/useSurfaceLayout.ts reads `cardLayouts['shopping']`), so every week list on
 *     screen shares one spec — and `useKeepAwake` defaults to a single shared tag, so three
 *     cards each mounting their own would release the lock as soon as the first one unmounted.
 *   - Deliberately NOT gated on `list.locked`, unlike the button that used to open store mode.
 *     The lock gated an ACTION ("nothing to stand in a shop with while you are still
 *     planning"); choosing the in-store layout is itself the statement that you are in a shop,
 *     and a list you never locked is still one you walk an aisle with.
 *   - `expo-keep-awake` needs no new native build — `expo@56` already depends on it, so this
 *     is an ordinary OTA-safe JS change.
 */
import { useKeepAwake } from 'expo-keep-awake';

/** Screen stays awake for as long as this is mounted. Renders nothing. */
export default function KeepAwakeInStore() {
  useKeepAwake();
  return null;
}
