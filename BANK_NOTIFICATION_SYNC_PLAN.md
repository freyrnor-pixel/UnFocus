# Plan (parked) — Android notification-listener spend capture ("passive bank sync")

**Status: not started.** This was scoped out in a planning session but implementation was
deferred. Pick this back up by reading this doc in full before writing any code.

## Context

The goal is to help UnFocus users (ADHD-focused) stop losing track of "spend here and
there." True automatic sync of bank data is impossible without a secret-holder the app
can't be (every PSD2 aggregator — Neonomics, Enable Banking — requires a confidential
credential + a backend + a native build; research confirmed no public-PKCE/backend-free
path exists). Manual file/CSV import was rejected as too high-friction — no ADHD user
re-exports weekly.

**Chosen direction: passive, real-time capture of the bank's own Android push
notifications** ("You spent 250 kr at REMA 1000"). The phone already receives these; a
`NotificationListenerService` reads them on-device as they arrive and logs the spend into
the existing budget view. This is the closest thing to zero-friction "sync":

- No backend, no aggregator account, no OAuth, no consent renewal, no rate limits.
- **No secret to store anywhere** — nothing in SecureStore, no tokens. Simpler than every
  alternative.
- Captures spending *as it happens*, which fits the "lose track" problem best.

Honest limits (baked into the design): **Android-only** (iOS forbids reading other apps'
notifications — the feature is simply absent there), needs a **native build** (new native
module + the sensitive notification-access permission), captures **forward-only** (no
historical backfill, no balance reconciliation), and parsing quality **varies per bank**
(handled with a "needs review" fallback, like receipt OCR).

## Key constraints from the codebase

- Single SQLite DB (`lib/db.ts`), Zustand stores over `lib/dataAccess.ts` (`loadAll`/
  `loadFirst`/`insertRow`/`updateRow` + `FieldMap`). New columns/tables = append-only
  `migrations` array. Retention prunes dated tables in `pruneOldData()`.
- Settings toggles follow the 5-step recipe in `store/useSettingsStore.ts` (type +
  `rowToSettings` + `SETTINGS_COLUMNS` + default + migration).
- Native-module additions are **maintainer-build-gated**: land config on `main` with
  `runtimeVersion` UNCHANGED, maintainer cuts the Android build, *then* bump
  `runtimeVersion` (AGENTS.md "Runtime version"). All JS is OTA-safe and must degrade to a
  no-op until that build exists — mirror the `isTransportAvailable()` feature-detect in
  `lib/lanTransport.ts` and the `.web` no-op sibling pattern (`lib/lanTransport.web.ts`,
  `lib/widgets/sync.web.ts`).
- Budget surface: `app/budget.tsx` already sums `receipts` per month vs `monthlyBudgetNok`.
  Captured spends fold into that same monthly view (the chosen surface).

## Native module

`expo-android-notification-listener-service` (SeokyoungYou) — Expo module, SDK 52+, Android
only. API: `setAllowedPackages(string[])`, `addListener("onNotificationReceived", cb)`
delivering a `NotificationData` (package name, title, text, timestamp), a permission-check
hook, and an open-settings path. **Its SDK-56 / RN-0.85 / New-Architecture build must be
verified by the maintainer at build time**; if it fails to build, fallback is a small
custom Expo native module wrapping `NotificationListenerService` (larger, out of scope for
this branch's JS work).

## Deliverable split

**Ships via OTA now (all guarded behind `isSupported()` → false until the build exists, so
nothing breaks pre-build):** DB migration, store, parser, bank registry, settings UI,
budget surfacing, i18n, iOS/web no-op stubs.

**Maintainer-build-gated (land config, do NOT bump `runtimeVersion`):** add the dependency +
its config plugin, cut the Android build, then bump `runtimeVersion`. Only then does real
capture work on-device.

## Implementation

### 1. Data model — `lib/db.ts` (append to `migrations`)
```
CREATE TABLE IF NOT EXISTS captured_spends (
  id TEXT PRIMARY KEY,
  source_package TEXT DEFAULT '',
  raw_title TEXT DEFAULT '',
  raw_text TEXT DEFAULT '',
  amount REAL DEFAULT 0,
  merchant TEXT DEFAULT '',
  direction TEXT DEFAULT 'debit',      -- 'debit' | 'credit'
  status TEXT DEFAULT 'parsed',        -- 'parsed' | 'needs_review' | 'ignored'
  occurred_at TEXT DEFAULT '',
  captured_at TEXT DEFAULT (datetime('now')),
  month TEXT DEFAULT ''                -- YYYY-MM, for budget aggregation
)
-- plus index on month:
CREATE INDEX IF NOT EXISTS idx_captured_spends_month ON captured_spends(month)
-- settings toggles:
ALTER TABLE settings ADD COLUMN bank_capture_enabled INTEGER DEFAULT 0
ALTER TABLE settings ADD COLUMN bank_capture_packages TEXT DEFAULT ''   -- JSON string[]
ALTER TABLE settings ADD COLUMN bank_capture_permission_seen INTEGER DEFAULT 0
```
Add `captured_spends` to the DELETE list in `pruneOldData()` (dated, >365d, `GLOB` on a
day-shaped column isn't needed — prune by `month` or `captured_at`).

### 2. Store — `store/useSpendCaptureStore.ts` (new; `dataAccess` pattern)
`CapturedSpend` type + `rowToCapturedSpend` + `const SPEND_COLUMNS: FieldMap<CapturedSpend>`.
Actions: `load()` (`loadAll('captured_spends', …, { orderBy: 'occurred_at DESC' })`),
`add(input)` (`insertRow`), `update(id, patch)`, `remove(id)`, and selectors
`spendsForMonth(month)`, `totalForMonth(month)` (sum of `debit`, excluding `ignored`),
`needsReview()`. Dedupe in `add()` by `(source_package, amount, occurred_at within ~2 min)`
to drop duplicate/updated notifications.

### 3. Parser — `lib/bankNotification.ts` (new, pure/testable)
`parseBankNotification({ packageName, title, text }): { amount, merchant, direction,
currency } | null`. Reuse the amount-detection style from `lib/receipt.ts` (Norwegian
`NNN,NN kr` / `kr NNN,NN`). Merchant via common patterns ("hos X", "til X", "Betaling X",
"Kjøp X"). Per-package heuristics with a generic NO fallback. Returns `null` → store logs
the raw notification as `status:'needs_review'`.

### 4. Bank registry — `lib/banks.ts` (new)
Known NO bank/payment app package names + display names (DNB, Sbanken, Nordea,
SpareBank 1, Bank Norwegian, Vipps, Handelsbanken…). **Exact package names verified against
real devices by the maintainer.** User picks which to watch → `settings.bankCapturePackages`.

### 5. Native wrapper — `lib/spendCapture.ts` (+ `lib/spendCapture.web.ts` no-op sibling)
Thin, feature-detected wrapper around the native module (lazy-require + `Platform.OS ===
'android'` guard, mirroring `lib/widgets/sync.ts`):
- `isSupported()` — false on iOS/web/Expo Go/until the build ships.
- `hasPermission()`, `openPermissionSettings()`.
- `start(packages, onSpend)` — `setAllowedPackages`, subscribe, parse each event, call
  `useSpendCaptureStore.getState().add(...)`.
- `stop()`.
`.web.ts` returns `isSupported()=false` and no-ops everything (so `npm run preview` and iOS
render cleanly).

### 6. Lifecycle — `app/_layout.tsx`
Gate `spendCapture.start(...)` on `settings.bankCaptureEnabled && isSupported() &&
hasPermission()` at launch and on relevant settings changes — exactly how `startSync` is
gated on `lanSyncEnabled`.

### 7. UI
- **Settings** (`app/settings.tsx`, Data section): a "Bank spending capture (Android)" card,
  rendered only when `isSupported()`. Enable toggle → "Grant notification access" button
  (`openPermissionSettings()`) → bank/app checklist from `lib/banks.ts`. Privacy line:
  notifications are read on-device and never leave the phone.
- **Budget** (`app/budget.tsx`): fold `useSpendCaptureStore.totalForMonth(month)` into the
  month's spend picture alongside receipts — show receipts subtotal + captured subtotal +
  combined total against `monthlyBudgetNok`, keeping the no-shame `warn` color rule. A small
  "N to review" affordance for `needs_review` items (tap → set amount/merchant, or ignore).

### 8. i18n — `lib/i18n.ts`
New `spendCapture` section in both `en` and `no` (typecheck enforces parity via `no: typeof
en`).

## Native/config to land (maintainer-build-gated)
- `package.json`: add `expo-android-notification-listener-service`.
- `app.json`: add its config plugin to `plugins` (injects the `<service>` +
  `BIND_NOTIFICATION_LISTENER_SERVICE`). Keep `runtimeVersion` unchanged.
- Update file headers' `Connections:` blocks for every touched file.

## Verification
- **`npx tsc --noEmit`** — gate; also enforces i18n parity.
- **Jest** (`scripts/test-changed.sh`): parser tests with real-shaped NO bank notification
  strings → amount/merchant/direction; store tests (add/dedupe/load/`totalForMonth`) with
  mocked `@/lib/db`; budget month-aggregation. (Repo rule: add a test with every helper/store.)
- **Web preview** (`npm run preview`): confirms Settings + Budget render with capture
  `unsupported` (web stub) and no crashes in the guarded states.
- **On-device (maintainer, after the Android build):** grant notification access, trigger a
  real bank notification, confirm a captured spend appears in Budget. Verify the module
  builds against SDK 56 / RN 0.85 / New Arch; verify background/killed delivery on target
  OEMs (NotificationListenerService reliability is device-dependent).

## Risks / honest caveats
- Module SDK-56/New-Arch build unverified → maintainer confirms at build; fallback is a
  custom native module.
- Play Store: notification access is sensitive — needs a clear in-app disclosure + privacy
  policy + possibly a Play declaration. Reading financial notifications must be justified.
- Forward-only (no backfill/balances); OEM battery-killers can delay delivery; per-bank
  parsing varies (mitigated by "needs review").

## Publishing (per CLAUDE.md standing rule, once implemented)
Commit + push `claude/open-banking-aggregator-sync-bsna82`, open a PR into `main`, and merge
it — the OTA JS ships on that merge (guarded, harmless pre-build). The dependency/plugin
lands on `main` with `runtimeVersion` unchanged; the maintainer cuts the Android build and
then bumps `runtimeVersion`.

---

## Unrelated backlog item — parked in the same session

**Research an Expo module/pattern for an animated app bootup (splash → app transition).**
Not scoped or explored yet — just a pointer for a future session. Likely candidates to
evaluate: Expo's own "animated splash screen" recipe (`expo-splash-screen` +
`SplashScreen.hideAsync()` gated behind a custom `Animated`/Reanimated-driven transition
component that fades/morphs from the static native splash into the live app, rather than a
hard cut), vs. a dedicated third-party lib if one fits SDK 56 + New Architecture better.
Whoever picks this up should search current (2026) Expo SDK 56 docs and npm for options,
check New Architecture compatibility, and cross-reference `ANIMATION_GUIDELINES.md` for the
timing/easing conventions this codebase already uses before choosing an approach.
