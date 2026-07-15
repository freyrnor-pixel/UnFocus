# Testing & app quality — what we test and keep improving

UnFocus is a local-first React Native / Expo app with **no backend** (SQLite on
device, peer-to-peer LAN sync, no server). That shapes what's worth testing: the
value is in the **logic/data layer**, and the test pyramid is deliberately
bottom-heavy. Real users are on `main` now (a merge publishes an OTA update on
next launch — see `PUBLISHING.md`), so a regression that reaches `main` reaches
installs. This doc is the map for keeping that from happening.

## The layers (and where each runs)

| Layer               | What it means here                                                                   | Runs in the remote/CI env?      | Command                             |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------- | ----------------------------------- |
| **Static**          | `tsc --noEmit` (+ the `no: typeof en` i18n-parity guard in `lib/i18n.ts`) and ESLint | ✅ cheapest gate, run always    | `npm run typecheck`, `npm run lint` |
| **Unit**            | Pure helpers + Zustand store logic, native modules mocked                            | ✅ the bulk of the value        | `npm test`                          |
| **Integration**     | store → SQLite write/read via the `sql.js` web fallback                              | ⚠️ partial, via the web preview | `npm run preview`                   |
| **E2E / flow**      | Real app as Expo Web, driven by Playwright                                           | ✅ flow/logic only              | `npm run preview`                   |
| **Native / visual** | gestures, haptics, camera OCR, widgets, LAN sync, pixel-perfect render               | ❌ needs a device               | maintainer / local emulator         |

CI (`.github/workflows/ci.yml`) runs the **Static + Unit** layers on every PR into
`main` and blocks the merge if they fail. The preview/E2E layer is run on demand
(it needs a web build); it is not yet in CI.

## The standing rule — keep improving

> **Add a test with every pure helper, every new store branch, and every bug fix.**

- A **pure helper** (in `lib/`) ships with a unit test in the same PR.
- A **new store method or a new branch** in existing store logic gets a headless
  test (mock `@/lib/db`; seed state with `setState`, assert the resulting state).
- A **bug fix** ships with a **regression test** that fails before the fix — this is
  how `lib/shoppingGroups.ts` and `useShoppingListStore.advanceRecurringLists`
  earned their suites.
- Coverage has a **ratcheting floor** (`coverageThreshold` in `jest.config.js`).
  Raise it as coverage grows; never lower it to make a red run pass — fix the test.
  Check current numbers with `npm run test:coverage`.

## How to write a headless test here

- **Config file**: `jest.config.js` (preset `jest-expo`, node env). `jest.setup.js`
  globally stubs `components/AppModal` and the native LAN-transport leaves
  (`react-native-tcp-socket`, `react-native-zeroconf`) so importing a store doesn't
  drag in reanimated/worklets or a native `NativeEventEmitter`.
- **Mock the DB**, don't hit it: `jest.mock('@/lib/db', () => ({ default: { getAllSync,
getFirstSync, runSync, execSync, withTransactionSync } }))`. Most store methods
  mirror their SQL writes into in-memory state via `set()`, so a no-op DB still
  exercises the real JS logic (see `__tests__/shoppingStore.test.ts`,
  `catalogStore.test.ts`).
- **Notifications / i18n**: pass settings in and mock the primitives. The schedulers
  (`lib/taskNotifications.ts`, `lib/habitNotifications.ts`) take a settings object,
  so mock `@/lib/notifications`' schedule/cancel fns (keep the real quiet-hours math
  via `jest.requireActual`) and stub `@/lib/i18n`'s `getTranslations`.
- **Run only what changed**: `scripts/test-changed.sh` (wraps `jest --findRelatedTests`
  over the git diff). Full suite: `scripts/test-changed.sh --all` or `npm test`.
- Test files live in `__tests__/` and `lib/__tests__/`.

## Where coverage is strong vs. thin

**Covered** — the pure helpers (`date`, `time`, `dataAccess`, `receipt`, `domainColor`,
`feedbackMail`, `hmac`, `liveSync`, `share`, `shoppingGroups`), the notification
schedulers (`reminders`, `taskNotifications`, `habitNotifications`, quiet-hours math),
the task recurrence resolver (`taskOccursOn`), and the highest-risk store paths
(`useShoppingStore` done/reset, `useCatalogStore` price-learning/suggest,
`useShoppingListStore` advance, `backup` restore).

**Still thin (good next targets)** — `lib/db.ts` migrations + `pruneOldData()`
retention boundary; `lib/peerAuth.ts` envelope sign/verify; the widget
`headlessSnapshot`/`sync` recurrence duplication; `lib/freyrModeSeed.ts` cross-store
seed/unseed; and deeper `useTaskStore`/`useHabitStore` flows beyond the resolver
(follower links, streak windows).

## Explicitly out of scope here (device/maintainer only)

Pixel-perfect native rendering, gestures/haptics, camera OCR
(`@react-native-ml-kit/text-recognition`), Android/iOS home-screen widgets, and LAN
peer sync. There is no KVM/native runtime in the remote env, so these are verified on
a real device by the maintainer (or a local emulator where KVM exists). The web
preview is faithful for layout/navigation/store logic but differs from native in
shadows, some font metrics, and Reanimated timing — use it for "does the flow work,"
not final visual sign-off.
