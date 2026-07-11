# Spike — De-risk SQLite-on-web (do this FIRST)

> **Audience:** a Claude Code session, cold start. This is the **gating task** for
> the web-preview "emulator" work described in `EMULATOR_TESTING_HANDOFF.md`. Its
> only job is to answer one question **cheaply, in ~30 min**, and record the answer.
> Do NOT build the whole preview harness here — just decide the DB path.

---

## The one question

**Can the real app's SQLite layer run under `react-native-web`, and how?**

Every UnFocus store reads/writes SQLite through `import db from '@/lib/db'` →
`lib/dataAccess.ts`, using a closed set of five synchronous methods: `execSync`,
`runSync`, `getAllSync`, `getFirstSync`, `withTransactionSync`. The handle is opened
at import time in `lib/db.ts:38` (`SQLite.openDatabaseSync('unfocus.db')`), with **no
web guard** — so on web the whole app dies at boot unless SQLite has a working web
backing. There are two candidate answers; this spike picks one.

- **Primary — `expo-sqlite` web (wa-sqlite/WASM):** keep `expo-sqlite` as the engine
  on web too. Its web backend supports the sync API but needs `SharedArrayBuffer`,
  which requires the page be served with COOP/COEP headers
  (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy:
  require-corp`). If this works → **no `lib/sqlite.web.ts` needed.**
- **Fallback — `sql.js` shim:** if sync-on-web/COOP-COEP is unworkable under SDK 56,
  add `lib/sqlite.web.ts` backed by in-memory SQLite WASM (`sql.js`) exposing the
  same five methods. In-memory is fine (a preview needs no persistence).

## Environment (verified — don't re-derive)

- Expo **SDK 56** (`expo ~56.0.9`, `react-native 0.85.3`, `react 19.2.3`,
  `expo-router ~56.2.13`). `app.json` already has `"web": { "bundler": "metro" }`.
- Web deps **not installed**: `react-native-web`, `react-dom` absent;
  `@expo/metro-runtime` present transitively (`56.0.16`).
- Remote ephemeral Linux; Chromium + Playwright at `/opt/pw-browsers`
  (`PLAYWRIGHT_BROWSERS_PATH` set, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`) — **never run
  `playwright install`**. HTTPS via agent proxy.
- **Docs note:** `https://docs.expo.dev/versions/v56.0.0/sdk/sqlite/` may 403 through
  the proxy via WebFetch. If so, try WebSearch, or read the installed package's own
  README/`web`/`package.json` under `node_modules/expo-sqlite/` to confirm which
  web entry points and methods exist for SDK 56.

## Steps

1. **Handle extraction (needed either way — keeps the 600-line schema un-duplicated):**
   - Create `lib/sqlite.ts`:
     `import * as SQLite from 'expo-sqlite'; export const db = SQLite.openDatabaseSync('unfocus.db');`
   - Edit `lib/db.ts`: replace the inline open (line 38) with
     `import { db } from '@/lib/sqlite';`; keep `export default db`; leave schema/
     `initDb()`/`pruneOldData()`/migrations untouched. Add `lib/sqlite` to the
     `lib/db.ts` header `Imports →` line.

2. **Install web deps** (SDK-pinned): `npx expo install react-native-web react-dom @expo/metro-runtime`

3. **Confirm expo-sqlite's web support for SDK 56:** inspect
   `node_modules/expo-sqlite/` for a web build (e.g. `*.web.js`, wa-sqlite / WASM
   assets) and whether `openDatabaseSync` + the five sync methods exist on web. Note
   what you find.

4. **Minimal boot probe (fastest signal):** produce a static web bundle and load it
   with COOP/COEP headers to see if the DB initializes. Two cheap options — pick one:
   - `npx expo export --platform web` then serve `dist/` with a ~15-line Node static
     server that sets `Cross-Origin-Opener-Policy: same-origin` +
     `Cross-Origin-Embedder-Policy: require-corp`, and open `/` in Playwright
     (Chromium via `executablePath` under `/opt/pw-browsers`, headless).
   - **Note:** the export may fail on the *other* native blockers (zeroconf,
     tcp-socket, android-widget, ml-kit — see the handoff §3). For a pure SQLite
     probe you may temporarily stub just those imports, or write a tiny throwaway web
     entry that calls `initDb()` + one `db.runSync`/`getAllSync` round-trip. Keep the
     probe disposable — it is not the deliverable.
   - Success = `initDb()` runs and a write→read round-trips with no
     `SharedArrayBuffer`/WASM/OPFS error in the console.

5. **Decide and record** (see Deliverable). If the primary path fails or is
   flaky/slow, switch to the `sql.js` fallback and confirm the same round-trip
   through `lib/sqlite.web.ts`.

## Deliverable (the whole point of this spike)

Write the decision into **`EMULATOR_TESTING_HANDOFF.md` §4-A** (or a short
`SPIKE_RESULT` note at the top of it) so the build session doesn't re-investigate:

- **Chosen path:** expo-sqlite-web (primary) **or** sql.js shim (fallback).
- **Exact enabling config** that worked (COOP/COEP header values, any
  `metro.config.js` change, any WASM asset handling) — or, for the fallback, the
  `lib/sqlite.web.ts` approach and any init/timing caveat (`sql.js` init is async;
  note how you exposed a synchronous handle).
- **Any gotcha** the next session must know (e.g. sync methods needing headers,
  version pins).

## Scope guardrails

- **Only** answer the SQLite question + land the `lib/sqlite.ts` handle extraction +
  web deps. Do **not** build the LAN/widget/scan shims, the production static server,
  the Playwright driver, or the docs — those are the full handoff.
- Keep any probe code throwaway (scratchpad or a clearly-temporary file); don't
  commit dead scaffolding.
- **Do NOT** touch `app.json` native surface, change `slug`, run `playwright install`,
  or add `Platform.OS` web branches inside native files.
- Branch: `claude/app-emulator-testing-p8rdpu`. Committing the handle extraction +
  web deps + recorded decision is fine; the PR-to-`main` merge happens with the full
  build (handoff §6), not from this spike alone — unless you're told otherwise.
