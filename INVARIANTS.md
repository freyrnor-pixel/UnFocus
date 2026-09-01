# Invariants

Rules a session must hold **before touching anything**. Terse by design — each row states the
rule and where to verify or read more; the reasoning and incident history live in
`docs/archive/AGENTS_HISTORY.md` or in the test/comment named. Do not restate a rule's reasoning
here if it already lives at one of those destinations — this file points, it does not narrate.

Session S0.1 (2026-09-01) relocated this from `AGENTS.md`. See
`docs/audit/INSTRUCTION_SURFACE_AUDIT.md` for per-claim verification status.

---

## Registration / build identity

- `slug` in `app.json` must stay `unfocus` — EAS project ID `9c7c7e82-8c6e-4be7-aae1-e588b4ebc495`
  is registered under this slug.
- Migrations in `lib/db.ts`'s `migrations` array are **append-only**. `PRAGMA user_version`
  indexes into the array — never edit, reorder, or remove an already-merged line. A correction is
  a new appended `UPDATE`.
- New DB columns are added via `ALTER TABLE … ADD COLUMN` in a new migration — never drop or
  recreate a table.
- `runtimeVersion` in `app.json` names the build an OTA update targets. Bump it whenever a native
  surface changes, in the same PR as the change. See "Publish / build" below for sequencing.

## Data flow

- All UI text goes through `useT()` from `lib/i18n.ts`. Add new keys to **all three** of `en`,
  `no`, `is` in the same edit — `no`/`is` are typed `typeof en`, so `tsc` fails on a missing key.
- Date format is always `YYYY-MM-DD` strings (`todayStr()`/`dateStr(d)` from `lib/date.ts` — don't
  re-implement).
- SQLite file name is `unfocus.db`, set in `lib/db.ts`.
- Stores read/write rows via `lib/dataAccess.ts` (`loadFirst`/`loadAll`/`updateRow` + `FieldMap`).
  A by-id `update`/`remove` goes through `lib/storeCrud.ts` (`updateById`/`deleteById`), whose
  guard makes an id-not-found call a **complete no-op** — verified by
  `__tests__/storeUpdateGuard.test.ts` + `lib/__tests__/storeCrud.test.ts`.
- A raw SQL `UPDATE` against a table in `lib/liveSync.ts`'s `TABLE_COLUMNS` whitelist (bypassing a
  store's normal write path) must stamp `updated_at` and call `syncRows()`/`broadcastRow()`+
  `touchRow()` on every affected row, or a paired device's stale copy wins the LWW race and can
  resurrect deleted data. See `__tests__/relatedRowSync.test.ts` (verified present) before writing
  any bulk/raw-SQL mutation against a synced table.
- A header/comment asserting "this doesn't touch a synced column" is a claim to verify against
  `lib/liveSync.ts`'s `TABLE_COLUMNS`, not a fact to trust — this has been wrong before (see
  history).

## Card system

- A card is declared once in `lib/cardRegistry.ts` (`CardId`/`ExpandableCardId` are derived from
  it — an unregistered card is a `tsc` error). A caller names a card
  (`<Card id="todoToday">`); it does not describe one.
- `CardCollapseToggle` and `CardExpandButton` may be imported **only** from `components/Card.tsx`
  — verified: the sole exception is `components/CardExpandHost.tsx` importing
  `CardExpandButton` for the expanded pane's own close control, which is the documented case.
  `lib/__tests__/cardAnatomy.test.ts` enforces this.
- A card header carries the fold toggle, the ⤢, and **at most one** caller-specific control
  (`controls` prop) — a `<>fragment</>` is the tell a caller is trying to pass more than one.
  `lib/__tests__/cardAnatomy.test.ts`.
- The boundary between a CARD (registry-named, gets a `Surface`/fold/⤢) and a SECTION (drawn
  one-per-row of a parent's own data, no `Surface`, no ⤢, local fold) is mechanical: is it inside
  a `.map()` over user data?

## Copy tone

- No guilt/urgency copy in `lib/i18n.ts` — never "missed", "overdue", "forgot", "behind"
  (`lib/__tests__/copyTone.test.ts` fails the PR). A tray is "still due", never "missed".
- `glem*`/`forgot`/`gleym*` stems are banned except in an explicit allowlist of narrator lines
  that are themselves anti-shame copy — see `lib/__tests__/narratorQuotes.test.ts`.
- `VOICE.md` records the app's one deliberate first-person exception (day log's empty state,
  extended to the narrator quotes 2026-08-19). Read it before adding first-person copy elsewhere
  or "correcting" that string.
- No italics anywhere except `components/NarratorQuote.tsx` (one file, asserted) — the
  2026-08-18 blueprint pass banned `fontStyle: 'italic'` app-wide; the narrator's exception uses a
  real font face (`Fonts.italic`), never the style property (which no-ops on Android).

## Tap targets / motion tokens

- No bare `48`/`44` or `hitSlop: 8` or `duration: 220` — use `MIN_TAP_TARGET`/`HitSlop`
  (`constants/theme.ts`, verified `MIN_TAP_TARGET = 48`) and `Duration.*`
  (`constants/motion.ts`). Guarded by `lib/__tests__/designTokens.test.ts`.
- Every destructive confirm goes through `confirmDestructive()` (`components/AppModal.tsx`):
  Cancel + one red button, `warning()` on open, `heavy()` on confirm. Not for a ⋯ menu with a red
  row; not for a two-way choice where red is one of two ways forward.
  `lib/__tests__/destructiveConfirm.test.ts` distinguishes both exceptions by button count.

## Publishing

- **Every change ends with a PR from the `claude/**` branch into `main`, merged by the agent
  itself.** OTA (`.github/workflows/update.yml`) publishes only on push to `main` — a
  `claude/**` push alone reaches nobody. See `PUBLISHING.md`.
- Merging to `main` reaches the `preview` EAS channel (testers), not the Play Store `production`
  channel — promoting to production is a separate, deliberate `workflow_dispatch`
  (`promote-production.yml`).
- Native-surface change → bump `runtimeVersion`/`version` in the same/a following commit, merge,
  then trigger `eas-build-android.yml` (agent-triggerable, non-interactive, stored token) —
  **bump before triggering** for this path. The debug-gradle build, production AAB, and
  TestFlight stay maintainer-only (real signing/store credentials).
- Native module versions stay pinned to the current Expo SDK's bundled set (`~X.Y.Z`, not
  `^X.Y.Z`) — upgrade the whole SDK together, not individual native packages.

## Known crash-class traps (verified present as source-scan tests — read before writing in this area)

- **Worklet safety**: a plain JS function called from an auto-workletized callback (any
  `Gesture.*` builder method, Reanimated hooks, `withTiming`/`withSpring`/etc.'s completion
  callback, `runOnUI`) crashes on device with zero symptom on web (worklets run JS-thread there).
  Hop with `runOnJS(fn)(args)`. Guard: `__tests__/workletSafety.test.ts` (verified present).
- **`useRef` read inside a worklet is frozen at its first value** (`__DEV__` freezes the object;
  release builds don't) — use `useSharedValue` for anything a worklet mutates and reads back.
- **`flex: N` + `flexBasis: 'auto'` in one composed style resolves to basis 0 on native** (Yoga;
  `useWebDefaults` is false in RN) — invisible on web (RNW emits basis:auto). State
  `flexGrow`/`flexShrink`/`flexBasis` explicitly, or `flex` alone, never both together. Guard:
  `lib/__tests__/dialogButtonLayout.test.ts` (verified present).
- **A composer's own controls (a `<Modal>`, a bottom sheet, a pushed route) can steal focus**,
  and a blur handler that tears down UI on "the user left" must first ask whether its own control
  took the focus. Guard: `lib/__tests__/composerFocusSteal.test.ts`.
- **A backgrounded long-lived process (`cmd &`) that inherits stdout hangs any pipe/tool waiting
  on that fd, forever, even after the real work is done.** Always redirect
  (`cmd > /tmp/x.log 2>&1 &`) and kill explicitly.
- **Metro's cache in `/tmp` can serve a stale bundle** even when `tsc` is clean and the build
  "succeeds" with 0 errors — confirm with a unique literal + grep the built bundle before
  debugging a component that looks unchanged. `rm -rf /tmp/metro-* /tmp/haste-* .expo dist` fixes
  it; `node_modules/.cache` alone does not (worktrees share one `node_modules`/`/tmp`).

## Feature flags

- A flag gates the **surface only**, never the data/store — turning it back on must restore
  everything untouched.
- `SHARING_VISIBLE` in `lib/sharingVisibility.ts` currently hides all sharing/people surfaces
  app-wide (maintainer instruction, not deleted). Check it before assuming a sharing surface is
  absent for another reason.

## AI setup guide / whitelists

- A new SQLite column on an AI-setup-imported domain: add to `lib/aiSetupGuide.ts` +
  `lib/aiSetupApply.ts` validation + the guide text, and bump `AI_SETUP_SCHEMA_VERSION`, in the
  same edit — only if the field is safe to accept from an untrusted AI-generated file.
- A new setting toggle safe for AI-driven config: add to the whitelist in both
  `lib/aiSetupGuide.ts` and `lib/aiSetupApply.ts`'s `SETTINGS_WHITELIST` + `validateSettingValue`,
  same edit, same version bump. Presentation-only settings (hidden/reordered/collapsed cards,
  design lab, layout) are deliberately **excluded** — an AI-authored file must not be able to
  restyle or hide the app's own surfaces.

## Cookbook — binding steps, condensed

- **New screen**: `app/my-screen.tsx` + an entry point (BottomNav tab or a link) + `hints.myScreen`
  i18n keys + a `HintCard`/`StarterCard` per the empty-state convention.
- **New i18n string**: add under `en`, then `no`, then `is` in `lib/i18n.ts` (tsc enforces parity).
- **New SQLite column**: migration in `lib/db.ts` → store's FieldMap/`update()` → TypeScript field
  → AI-setup-guide entry only if importable and safe (see above).
- **New setting toggle**: `Settings` type + `defaultSettings` in `store/useSettingsStore.ts` →
  migration → `load()`/`update()` → `app/settings.tsx` UI → i18n → AI-setup whitelist only if safe.
- **New feature flag**: copy under `config.features.*` in all three languages; gate the surface at
  its call site, never the store; pick on/off-by-default shape per `AGENTS.md`'s pointer to the
  full cookbook entry in the archive.

## Verification gate before calling a change done

- `npx tsc --noEmit` must be clean (also enforces i18n key parity).
- `scripts/test-changed.sh` (or `--all`) for any behavioral change; `tsc` alone for a pure
  move/rename/comment.
- See `HARNESS.md` for what the four visual/geometry harnesses can and cannot see — none of them
  substitute for a device on gesture/haptics/pixel-perfect native rendering.
