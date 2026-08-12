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
- **Assert the no-op, not just the change.** A guard whose failure mode is "an extra write
  that happens to change nothing" leaves no wrong value for a normal assertion to catch —
  which is how two stores went their whole lives without the one every other store had (see
  AGENTS.md's "8 of 10 sites is a habit, not an invariant" gotcha). Pin it from the other
  side: the collection comes back as the **same array reference** (a new array is a
  re-render), the mocked `db.runSync` was not called, and the action's side effects
  (`scheduleWidgetSync`, a notification scheduler) did NOT fire.
  `__tests__/storeUpdateGuard.test.ts` is the worked example.

## Where coverage is strong vs. thin

**Covered** — the pure helpers (`date`, `time`, `dataAccess`, `storeCrud`, `receipt`, `domainColor`,
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

## Component checklist — match the check to what actually changed

Most bugs here aren't caught by `tsc`/Jest at all (they're native-rendering or
layout bugs), but they ARE catchable by inspection/grep without a device. Check the
row that matches what you touched — don't run the whole list for a one-line change.

| You added/changed... | Check this |
|---|---|
| A new `TextInput`/`Input` (FormControls) on a **sub-screen** (`ScreenScaffold tier="sub"`, e.g. a `*-form.tsx`) | The screen must be wrapped in `KeyboardAvoidingView` (`behavior={Platform.OS === 'ios' ? 'padding' : undefined}`) — `ScreenScaffold`'s ScrollView has **no built-in keyboard avoidance** outside `AddRow`'s own `scrollIntoView` (see its header note). Grep `KeyboardAvoidingView` in the file; if it's missing and the field isn't the very first thing on screen, add it — pattern lives in `app/habit-form.tsx` / `app/medicine-form.tsx` / `app/health-form.tsx`. Found and fixed missing wrappers on `app/health-form.tsx` and `app/settings.tsx` this way (2026-07-31) — both had `Input` fields hundreds of lines into a long scroll with zero keyboard handling.
| A new `TextInput`/`Input` on a **site-tier tab screen** (`app/(tabs)/*.tsx`) | Same risk exists (`Input` never calls `scrollIntoView`), but wrapping a pager tab in `KeyboardAvoidingView` touches the shared pager layout — verify on device/emulator before changing, don't blind-patch. Known unverified cases: `app/(tabs)/shopping.tsx`'s monthly-list rename `TextInput` (can be far down a long list) and `app/(tabs)/health.tsx`'s quick-log start-time/duration fields (lower risk — they render directly below the already-scrolled-into-view `AddRow`).
| A new `AddRow` inline input | Confirm it's inside a scrollable `ScreenScaffold` (not `scrollable={false}`) so `ScrollIntoViewContext` is actually provided — a self-scrolling `FlatList` screen (Catalogue) must handle its own scroll-into-view instead.
| A new tap target (button/icon/chip) | Use `MIN_TAP_TARGET`/`HitSlop` from `constants/theme` — never a bare `44`/`hitSlop: 8`. Enforced by `lib/__tests__/designTokens.test.ts`.
| A new animation/transition duration | Use `Duration.*` from `constants/motion` — never a bare `duration: 220`. Same test file enforces it.
| New user-facing copy (either language) | Add both `en` and `no` keys — `tsc` catches a missing one via `no: typeof en`. If the copy touches a due/undone state, `lib/__tests__/copyTone.test.ts` fails on "missed"/"overdue"/"forgot"/"behind".
| A new row/label on a list-bearing surface | Run `npm run wraps` (check `--lang=no` too — it consistently finds far more near-misses than English at the same width).
| A new SQLite column/store field | Migration in `lib/db.ts` + FieldMap/`update()`, per AGENTS.md's "Add a new SQLite column" cookbook step; add a headless store test if it's a new logic branch.
| A new modal/sheet/flow reachable from a button | Exercise it via `npm run preview` (Playwright). If it's gated behind `Alert.alert`, it can't be driven in the web preview at all (react-native-web doesn't render `Alert`) — needs a device check instead.
| A new pure helper (date/time/recurrence/reminder math) | Ship a unit test in the same PR — see the standing rule above.
