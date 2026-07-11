# Handoff — Web-based "emulator" for agent visual/logic testing of UnFocus

> **Audience:** a Claude Code session picking this up cold. This document is
> self-contained — you should not need prior conversation context. Read it
> top-to-bottom, then execute. Do the **`EMULATOR_TESTING_SPIKE.md`** task FIRST
> (it de-risks the one unknown); come back here for the full build.

---

## 0. TL;DR of the goal

Let an agent *see* UnFocus run from inside the remote container: verify that
screens look right, flows make sense, and behaviour follows the app's logic —
without a device or an EAS build.

**Mechanism:** run the real app as **Expo Web** (`react-native-web`) and drive it
headlessly with **Playwright** (Chromium is pre-installed) to screenshot and
interact. Full app on web — not a mocked component harness.

**Why not an Android emulator:** this container has **no hardware virtualization**
(`/dev/kvm` absent, no `vmx`/`svm` CPU flags) and **no Android SDK**. A software‑
translated AVD would be unusably slow and is not an option. Chromium + Playwright
under `/opt/pw-browsers` are the ready path.

**Fidelity caveat (state this in any report you write):** react-native-web renders
layout, navigation and store logic faithfully, but is **not pixel-identical to
native**. Shadows/elevation (`SHADOW_ELEVATION_LIBRARY.md`), some font metrics, and
Reanimated timing differ from the Android/iOS build. Use this for
"layout/flow/logic correct," **not** pixel-perfect native sign-off — that still
goes through a device/EAS build.

---

## 1. Environment facts (verified, don't re-check from scratch)

- Remote **ephemeral Linux** container; repo cloned fresh; commit+push to persist.
- No `/dev/kvm`, no `vmx`/`svm`. ~4 CPU, ~15 GB RAM, ~30 GB free disk.
- **No Android SDK** (`ANDROID_HOME`/`ANDROID_SDK_ROOT` unset).
- **Chromium + Playwright pre-installed:** `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`
  (contains `chromium`, `chromium-1194`, `chromium_headless_shell-1194`, `ffmpeg`).
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` is set. **Do NOT run `playwright install`** —
  point Playwright at the pre-installed binary via `executablePath`/env.
- Outbound HTTPS goes through an agent proxy. If a tool hits 403/407/TLS issues,
  see `/root/.ccr/README.md`; never disable TLS or unset `HTTPS_PROXY`.

## 2. App facts

- Expo **SDK 56** (`expo ~56.0.9`), `react-native 0.85.3`, `react 19.2.3`,
  `expo-router ~56.2.13`, TypeScript. Local-only, no backend. Bilingual EN/NO.
- `app.json` **already has a `web` block** (`"bundler": "metro"`) — no native-surface
  change is needed for web. `slug` is `unfocus`, `runtimeVersion` `1.3.0`. Do **not**
  edit `runtimeVersion`, plugins, or permissions — this task is JS-only and ships OTA.
- **Web deps are NOT installed:** `react-native-web`, `react-dom` absent;
  `@expo/metro-runtime` present transitively (`56.0.16`) but not declared.
- Existing tests: 3 Jest unit tests in `lib/__tests__/` (pure logic). No Playwright,
  no Storybook, no e2e. `CLAUDE.md` currently says "no live-app verification" — this
  task changes that; update that note (see step 6).
- **Read the JSDoc header block at the top of every file before editing it** — it's
  the fastest orientation and lists callers/imports. Update both ends of a
  `Connections:` block when you change imports/callers (repo rule).

## 3. Why the app can't run on web yet — the exact blockers

The app hard-crashes at web boot/bundle because native-only modules load at
startup, and there is **not a single `Platform.OS === 'web'` guard** in the repo.
Metro resolves `file.web.ts(x)` over `file.ts(x)` on web, so we fix each by adding
a **sibling `.web` file** — no `Platform.OS` sprinkling, no change to native paths.

| # | Blocker | File:line | Native module (no web build unless noted) | Fix |
|---|---------|-----------|-------------------------------------------|-----|
| 1 | SQLite opened at import | `lib/db.ts:38` `SQLite.openDatabaseSync('unfocus.db')` | `expo-sqlite` (web = wa-sqlite/WASM, needs COOP/COEP) | Extract handle → `lib/sqlite.ts`; SQLite-web per the **spike** |
| 2 | LAN sync transport | `lib/lanTransport.ts:49-50` (reached at startup via `lib/syncService.ts` ← `_layout.tsx`) | `react-native-zeroconf`, `react-native-tcp-socket` | `lib/lanTransport.web.ts` stub |
| 3 | Android widgets | `lib/widgets/sync.ts` (reached at startup via `syncWidgetsAndOverview()` ← `_layout.tsx`) | `react-native-android-widget` | `lib/widgets/sync.web.ts` no-op |
| 4 | OCR / camera screens | `app/(tabs)/scan.tsx`, `app/pair-device.tsx` (in router tree → bundled) | `@react-native-ml-kit/text-recognition` (camera/image-picker DO have web support) | `app/(tabs)/scan.web.tsx`, `app/pair-device.web.tsx` placeholders |
| 5 | Notifications | `lib/notifications.ts:62-71` (`setNotificationHandler()` at module scope) | `expo-notifications` (partial web support) | Verify first; add `lib/notifications.web.ts` no-op **only if it throws** |

**DB surface the whole app uses (small, closed set):** `execSync`, `runSync`,
`getAllSync`, `getFirstSync`, `withTransactionSync`. Every store reaches it via
`import db from '@/lib/db'` → `lib/dataAccess.ts`. Any web DB backing must expose
exactly these.

## 4. Execution steps

> Do steps in order. **Step A (the spike) gates everything** — resolve it before
> writing shims/server/driver. It has its own doc: `EMULATOR_TESTING_SPIKE.md`.

### A. Resolve SQLite-on-web (the spike) — do `EMULATOR_TESTING_SPIKE.md` first
Outcome is one of:
- **Primary:** `expo-sqlite` web (wa-sqlite) works with COOP/COEP headers →
  **no `lib/sqlite.web.ts` needed**, `expo-sqlite` stays the engine on web.
- **Fallback:** sync-on-web/COOP-COEP unworkable under SDK 56 → add
  `lib/sqlite.web.ts` backed by an in-memory SQLite WASM (`sql.js`) implementing the
  five methods above. No store changes (identical interface). In-memory is fine —
  a preview harness needs no persistence.

Regardless of outcome, do the **handle extraction** so `.web` resolution is possible:
- Create `lib/sqlite.ts`: `import * as SQLite from 'expo-sqlite'; export const db = SQLite.openDatabaseSync('unfocus.db');`
- Edit `lib/db.ts`: replace line 38's inline open with `import { db } from '@/lib/sqlite';`; keep `export default db`. Leave all schema/`initDb()`/`pruneOldData()`/migrations untouched. Update the `lib/db.ts` header's `Imports →` line to add `lib/sqlite`.

### B. Add web runtime deps
Use `npx expo install` (matches SDK-pinned versions — NOT plain `npm install`):
```
npx expo install react-native-web react-dom @expo/metro-runtime
```

### C. Add the `.web` shims (blockers 2-5)
Create sibling files; each must satisfy the **same TypeScript exports** as its
native sibling so `tsc --noEmit` passes and importers don't break:
- `lib/lanTransport.web.ts` — `isTransportAvailable() => false`; no-op `LanTransport`
  class; re-export the same consts/types (`SERVICE_TYPE`, `DEFAULT_PORT`, `LanPeer`,
  `LanEnvelope`, `LanConnection`, etc.). (See native file for the full export list.)
- `lib/widgets/sync.web.ts` — no-op `syncWidgetsAndOverview()` and any siblings
  `_layout.tsx` / callers import, so the `react-native-android-widget` subtree
  (`handler.tsx`, `WidgetViews.tsx`) never enters the web bundle.
- `app/(tabs)/scan.web.tsx`, `app/pair-device.web.tsx` — minimal placeholder screens
  ("Not available in web preview"), using `useT()` for any text (repo rule: no
  hardcoded UI strings; add keys to both `en`/`no` in `lib/i18n.ts` if needed).
- `lib/notifications.web.ts` — **only if** the export in step E surfaces an
  expo-notifications web error; then mirror all ~20 exports (`requestPermissions`,
  `scheduleWeeklyReminder`, `scheduleTaskNotification`, `scheduleDailyReminder`,
  `onNotificationAction`, etc.) as async/sync no-ops.
- Add a `Connections:` header to each new `.web` file noting it's the web shim of
  its sibling.

### D. Static server with COOP/COEP
- `scripts/serve-web.mjs` — ~20-line Node static server for `dist/`, binding
  localhost, sending `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` on every response (required if the
  spike landed on the expo-sqlite-web primary path). A static export + our own
  server is more reproducible than the Metro dev server and gives full header control.

### E. Build the web bundle (iterate until it resolves)
```
npx expo export --platform web
```
Each "Unable to resolve module …" names the next native module to shim (add its
`.web` sibling). The table in §3 is the known set; the export loop confirms
completeness. Output lands in `dist/`.

### F. Playwright driver the agent runs
- Add dev dep: `npm i -D @playwright/test` (do NOT `playwright install`).
- Configure Chromium via the pre-installed binary — pass
  `executablePath` pointing under `/opt/pw-browsers` (honor `PLAYWRIGHT_BROWSERS_PATH`),
  `headless: true`.
- `scripts/preview.mjs` (or a spec): start `serve-web.mjs`, open the app, walk the
  onboarding flow (`/onboarding/language` → … → home) and each of the 5 tabs
  (Home/Shopping/Plans/Health + secondary screens like Notes/Budget), capture
  full-page screenshots to a **gitignored** `preview-shots/` (or the session
  scratchpad). Support a single-route argument for focused re-checks after a change.
  Optionally drive "add a task / add a shopping item" to prove store logic, not just
  static render.

### G. Scripts, gitignore, docs
- `package.json` scripts: `preview:build` (expo export), `preview:serve`
  (serve-web), `preview` (build + serve + run driver).
- `.gitignore`: add `dist/` and `preview-shots/`.
- Docs: update the **Testing** note in `CLAUDE.md` (drop "no live-app verification";
  describe the web preview), and add a short "Web preview for agent testing"
  subsection to `AGENTS.md` (the command, the `.web` shim pattern, the
  not-pixel-native caveat).
- Fix `Connections:` headers on every touched file (both ends).

## 5. Verification (must all pass before opening the PR)

1. `npx expo export --platform web` — **zero** unresolved-module errors.
2. Serve `dist/`, open `/` in Playwright — app boots **past** the SQLite/LAN/widget
   startup chain to onboarding or Home (proves the DB layer works on web).
3. Drive onboarding + all 5 tabs; screenshots render with sensible layout + data.
   Add a task/shopping item → confirm it persists in-session (proves logic).
4. `npx tsc --noEmit` clean (the `.web` shims must type-match their siblings).
   *(Typecheck is local-only; run it — do not assume.)*
5. Write a short report: what renders correctly vs. any web-only rendering gaps.

## 6. Publishing (standing repo rule — do not skip, do not hand back)

Work on branch **`claude/app-emulator-testing-p8rdpu`**. Commit with clear messages,
`git push -u origin <branch>` (retry on network errors: 2s/4s/8s/16s backoff).
Then **open a PR into `main` and merge it yourself** — a change isn't finished at
"pushed the branch." This diff is **JS-only** (web deps + `.web` shims + scripts +
docs); it rides OTA and needs **no new native build**, so no maintainer gate applies.

## 7. Guardrails / gotchas

- **Do NOT** touch `app.json` `runtimeVersion`/plugins/permissions, change `slug`
  from `unfocus`, run `playwright install`, or add web-specific `Platform.OS`
  branches inside native files (use `.web` siblings instead).
- Keep native-module versions SDK-pinned (`npx expo install`, not `npm install`);
  `react-native-web`/`react-dom`/`@expo/metro-runtime` must match SDK 56.
- Reanimated v4 + worklets may render oddly on web — that's a preview artifact, not
  a native bug; note it, don't chase it.
- Disk is a fixed allowance; if you hit "no space left," delete `dist/` and caches
  (deletes still succeed) rather than declaring the container broken.
