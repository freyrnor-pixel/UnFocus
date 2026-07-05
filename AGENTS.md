# Repo status — UnFocus is the LIVE app (2026-07-03)

**This repo (`UnFocus`) is the current, canonical version of the app. All new
builds — OTA updates and APKs/AABs — come from here.**

The sibling repo `All-the-small-things` is the **outdated predecessor and is no
longer in use.** It survives only as a read-only reference for porting old source
during the rebuild. Its OTA/APK rules, `runtimeVersion`, and "current deployment
state" notes **no longer apply to anything** — do not target it for builds, do not
publish OTA updates from it, and do not treat its deployment docs as live.

---

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

---

# Claude / Agent context

Quick-start guide for future Claude sessions on this codebase.

## App summary

**UnFocus** — ADHD life-management app (React Native / Expo SDK 56, TypeScript, Expo Router, Zustand + SQLite). Local-only, no backend. Norwegian-first but fully bilingual (EN/NO). Target: iOS + Android.

## Read the file header first

Every `.ts`/`.tsx` file starts with a JSDoc header block. **Read it before editing — it is the fastest way to orient.** Format:

```
/**
 * <filename> — <one-line purpose>
 *
 * <1–3 sentence description>
 *
 * Connections:
 *   Imports → <local @/ deps>
 *   Used by → <files that import this, or the Expo Router route>
 *   Data    → <SQLite tables / Zustand store / notifications>
 *
 * Edit notes:
 *   - <file-specific gotchas>
 * /
```

- **Use by → / Imports →** are a hand-maintained dependency map. To find every caller of a module, open the module and read its `Used by →` line (or grep `from '@/<path>'`). When you add/remove an import or change who consumes a file, **update the affected headers** (both ends) so the map stays true.
- **Edit notes** capture the real traps for that file — honour them.
- The real entry point is `index.ts` → `expo-router/entry` (file-based routing under `app/`); there is no `App.tsx`. The live shopping-catalog seeder is `lib/catalogSeed.ts` (`CATALOG_SEED`), consumed by `useCatalogStore`.

## Key invariants — do NOT break these

| Rule | Why |
|---|---|
| `slug` in `app.json` MUST stay `unfocus` | EAS project ID `9c7c7e82-8c6e-4be7-aae1-e588b4ebc495` is registered under this slug; changing it breaks builds |
| All strings through `useT()` from `lib/i18n.ts` | Bilingual app — never hardcode UI text |
| Date format is always `YYYY-MM-DD` strings | Used as keys throughout the stores |
| `todayStr()` / `dateStr(d)` from `lib/date.ts` | Shared helpers — do not re-implement locally |
| SQLite file name: `unfocus.db` | Set in `lib/db.ts` |
| New DB columns: `ALTER TABLE … ADD COLUMN` in migrations array | Runs once on upgrade; never drop or recreate tables |
| Stores read/write rows via `lib/dataAccess.ts` (`loadFirst`/`loadAll`/`updateRow` + `FieldMap`) | Used by 13 of 14 stores; don't hand-roll row mapping in a new store |
| **To ship a change to users, MERGE it to `main`** | OTA (`.github/workflows/update.yml`) publishes ONLY on push to `main`. A `claude/**` branch push publishes nothing — the fix stays invisible to installed apps until merged. This is the #1 "why isn't my fix live?" cause. See `PUBLISHING.md`. |

## Architecture at a glance

```
Screens (app/)  →  Zustand stores (store/)  →  SQLite (lib/db.ts)
                                               ↑
                       lib/i18n.ts (useT)  ───┘
                       lib/date.ts (dateStr, todayStr)
                       constants/theme.ts (getTheme, Colors)
```

- **Navigation**: file-based Expo Router. Primary nav is `components/BottomNav.tsx` (Home/Shopping/Meals/Health/Habits); other screens are reached via links/buttons from those 5. `BubbleMenu` (radial FAB) is currently disabled — commented out at its mount in `app/index.tsx`, code kept intact for a future redesign. Don't wire new screens through it; see its header before touching either file.
- **Onboarding** (`app/onboarding/*`, in file order): language → privacy → guided/explore → index (name) → step2 (work mode) → step3 (shopping days) → step4 (notification confirm) → step5 (theme + handedness) → step6 (pet naming) → home
- **i18n**: `const t = useT()` in any component; `t.someKey`; add new keys to both `en` and `no` objects in `lib/i18n.ts`

## Common tasks

### Add a new screen
1. Create `app/my-screen.tsx`
2. Add an entry point: a tab in `components/BottomNav.tsx` if it's a main section, otherwise a link/button from whichever screen owns it (`BubbleMenu`'s `WHEEL_ITEMS` is disabled — don't add new screens there)
3. Add hint strings to `lib/i18n.ts` under `hints.myScreen`
4. Add `HintCard` at the top of the scroll content

### Add a new i18n string
1. Add the key under `en` in `lib/i18n.ts`
2. Add the Norwegian equivalent under `no` (TypeScript will error if missing)
3. Use `t.myNewKey` in the component

### Add a new SQLite column
1. Add to the `migrations` array in `lib/db.ts`:
   ```ts
   "ALTER TABLE my_table ADD COLUMN new_col TEXT DEFAULT ''"
   ```
2. Add it to the store's FieldMap and `update()` values — most stores go through `lib/dataAccess.ts` (`loadFirst`/`loadAll`/`updateRow`); check the target store's header for its exact pattern
3. Add the TypeScript field to the Settings/Task/etc. type

### Add a new setting toggle
1. Add field to `Settings` type and `defaultSettings` in `store/useSettingsStore.ts`
2. Add migration (see above)
3. Update `load()` and `update()` in the store
4. Add to `app/settings.tsx` UI
5. Add i18n labels

## Known gotchas

- **`StyleSheet.absoluteFill`** (not `.absoluteFillObject`) for full-screen overlays
- `useT()` depends on `useSettingsStore`, so it re-renders when language changes — this is intentional. Outside components (stores, schedulers) use `getTranslations(lang?)` instead — it reads the current language from the store when no arg is given.
- `QuickAddSheet` day options are memoized on `t.today`/`t.tomorrow` — they'll update when language changes
- The scan uses on-device OCR via `@react-native-ml-kit/text-recognition` (`parseReceiptText` in `app/scan.tsx`). Confirmed items are added to the shopping list, logged to `purchase_log`, and upserted into the `store_items` catalog (powers shopping autocomplete).
- `BubbleMenu` and `BottomNav` labels both read from `t.nav` — add new entries there when adding a bubble or tab.
- `completedCount` in `useTaskStore` counts all-time done tasks (intentional — cumulative "small things add up" philosophy)
- `backlogTasks(today)` only returns non-recurring tasks; recurring tasks reappear by date schedule
- **Notifications**: `lib/notifications.ts` only takes already-localised content. Per-task reminders live in `useTaskStore` and cover both kinds — one-off tasks fire once (skipped if done/past), weekly-recurring tasks fire on every selected weekday (via `scheduleWeeklyTaskNotifications`); time-box tasks also get an "end" reminder. Habit daily reminders in `useHabitStore`; weekly/monthly reminders in `lib/reminders.ts` (`syncReminders`). `settings.tsx` re-syncs on relevant changes; `_layout.tsx` and onboarding step 6 sync on startup/finish.
- **Retention**: `pruneOldData()` in `lib/db.ts` trims dated history to the last `RETENTION_DAYS` (365) on startup; config tables are left untouched.
- **`BubbleMenu.tsx` merge risk**: this file has been independently rewritten by parallel `claude/*` branches more than once (see commits `96891b4`, `9b02162`). Always hand-diff this file against the target branch on merge — do not auto-resolve conflicts here.
- **Materials**: `bubbleMaterial` (settings) + `getMaterialStyle()` in `constants/theme.ts` give the FAB/bubbles a surface finish (glass/metal/rock/paper) independent of colour theme — a bubble's hue and its finish vary separately. Rendered via a two-layer view (outer = border + shadow, inner `overflow:'hidden'` mask = fill + sheen) so shadows aren't clipped.
- **Animation, button-press, and haptics**: read `ANIMATION_GUIDELINES.md` (repo root) before writing or editing any of these — it has the real timing/easing/spring values and the `lib/haptics.ts` contract this codebase actually uses. Paste its §8 block at the top of any animation/interaction/haptics prompt.
- **Biometric authentication**: `expo-local-authentication` is already in `package.json` and `app.json`'s `plugins` array (Decision 040, reserve-only — module ships in the build, no feature code uses it yet). Once the maintainer cuts the build with this dependency, the lock/unlock UI can ship as a normal OTA change — no further native work needed for that feature. See `REBUILD_DECISIONS.md` Decision 040 and `REBUILD_PLAN.md` §1 for the rest of the reserve-only native surface (`expo-location`, `expo-calendar`, `expo-contacts`, `expo-sensors`, `expo-speech-recognition`) that's ready the same way.

## Current deployment state

- **UnFocus is the sole source of all live builds** (see the repo-status banner at
  the top of this file). The retired `All-the-small-things` repo is never a build
  target; its runtime/OTA rules are dead.
- OTA updates always publish to the EAS `preview` channel, and target whatever
  `runtimeVersion` is set in `app.json`. A given OTA is only picked up by an
  installed build whose runtime matches.
- **Native builds are human-gated.** When native surface changes (new package,
  plugin, permission, or an `app.json`/`eas.json` build-config change), do NOT cut
  a build from an agent session — land the config on `main` and hand off to the
  maintainer, who cuts the new preview build. Once that build exists, bump
  `runtimeVersion` to match it so subsequent OTA updates flow to the new preview.

## Builds and updates

### OTA updates (normal flow)
- **⚠️ PUBLISH = MERGE TO `main`.** Nothing reaches users until the change is on `main`. Pushing your `claude/**` branch is only step 1; you must open a PR into `main` and merge it. Full step-by-step: `PUBLISHING.md`.
- Workflow: `.github/workflows/update.yml` — triggers on every push to `main` only (deliberately NOT on `claude/**` branches — parallel session branches all publishing to the one shared `preview` channel caused a real incident where a later, older-tree push silently clobbered a newer one; see git history around June 2026). Push your branch and merge into `main` to publish.
- Runs `eas update --branch preview --message "..."` — always publishes to EAS branch `preview`
- Runtime version is read from `runtimeVersion` in `app.json` — an OTA reaches only installs whose runtime matches that value
- Apps pick it up automatically on next launch — no download needed
- Takes ~1–2 min on CI

### New APK build (only when native code changes)
- Workflow: `.github/workflows/build-android.yml` — **manual trigger only** (`workflow_dispatch`), and **maintainer-run** — an agent session prepares the config and lands it on `main`, but does not kick off the build
- **After the build exists**, bump `runtimeVersion` in `app.json` to that build's value so OTA updates retarget the new preview (see "Runtime version" below)
- Use when: new native package added, `app.json` plugin changed, `eas.json` build config changed
- Runs `npx expo prebuild` + a local `./gradlew assembleDebug` on the runner — this is a debug-signed APK, downloadable from the **GitHub Actions run's Artifacts** (not expo.dev; this workflow never calls EAS Build). For a real signed release build, see "Production release" below.
- Takes ~20–30 min on CI

### Production release (Play Store AAB)
- This is a managed Expo project — there is no checked-in `android/` folder and no hand-edited Gradle signing config. Release signing and building is handled entirely by **EAS Build**, via `eas.json`'s `production` profile (`buildType: app-bundle`, `distribution: store`, `autoIncrement: true`).
- **Upload keystore (one-time, Play App Signing)**: run interactively from your own Expo account session, not from an agent session — `eas credentials -p android --profile production` → "Set up a new keystore" → let EAS generate and store it. Google holds the actual app signing key (Play App Signing); this upload key can be re-issued by Google's account-recovery process if lost.
- **Versioning**: `cli.appVersionSource: "remote"` + `production.autoIncrement: true` means EAS tracks and auto-bumps the Android `versionCode` on its own servers on every production build. Do **not** manually bump `android.versionCode` in `app.json` before a release build — it's unused by this profile. The human-facing `version` string in `app.json` (e.g. `"1.1.0"`) is still manual; bump it whenever it makes sense.
- **Build**: `eas build --platform android --profile production` → produces a signed `.aab`, listed under **expo.dev → project → Builds**.
- **Sanity-check before submitting**: AABs can't be installed directly. Use Google's `bundletool` (`build-apks --bundle=app.aab --output=app.apks --mode=universal`, then `install-apks --apks=app.apks`) to confirm it launches without a red-screen "Unable to load script" error.
- **Submit**: once a Play Console app + service account key exist, save the key as `google-play-service-account.json` at the repo root (gitignored) — it already matches `submit.production.android.serviceAccountKeyPath` in `eas.json` — then run `eas submit -p android --profile production --latest`. First upload should go to the `internal` track (already set in `eas.json`) before promoting to production in Play Console.

### When to do a new build vs. OTA update
| Change type | Need new build? |
|---|---|
| UI text, styles, logic | No — OTA handles it |
| New screen, new store | No — OTA handles it |
| Add a native package (expo install) | Yes |
| Change `app.json` plugins | Yes |
| Camera/permission changes | Yes |

### Runtime version
- `runtimeVersion` in `app.json` is set explicitly (not derived from `version` via policy). It names the build that OTA updates target; an OTA only reaches installs on the matching runtime.
- **New builds go through the maintainer.** Agent sessions may land native-surface changes on `main` and prepare the config, but the actual APK/AAB is cut by the human — not from a session.
- **Sequencing when native surface changes** (so live installs aren't stranded on a runtime with no matching build):
  1. Land the native config change on `main` with `runtimeVersion` **unchanged** — the current preview build keeps receiving OTA updates.
  2. Maintainer cuts the new preview build (its runtime = the intended new value).
  3. Once that build exists, bump `runtimeVersion` (and usually `version`) in `app.json` to that value — from then on OTA updates flow to the new preview.
- Do not bump `runtimeVersion` ahead of the build existing; doing so publishes OTA updates to a runtime nothing is installed on yet.

### Dependency pinning — SDK-bundled versions
- **Expo SDK is a curated set**, not a normal npm project. SDK 56 ships a specific native binary, and `bundledNativeModules.json` states exactly which JS version of each native package matches that binary. "Newest" JS packages mean *newer than your build's native code* — the failure mode.
- **Native modules** (gesture-handler, reanimated, camera, sqlite, all `expo-*`) must stay pinned to the SDK's versions. If the bundle says `react-native-gesture-handler 2.31.1`, that's the current + safe version for SDK 56 — never jump to 3.0.2 (JS 3, native 2.31), which causes the exact "major version mismatch" errors you've seen.
- **To get newer safely**: don't chase individual packages. Upgrade the whole SDK together (SDK 56 → 57), which re-pins every native module to its new matched set, then cut a new native build. That's a deliberate, tested migration.
- **Ranges**: use `~X.Y.Z` (allows patches) not `^X.Y.Z` (allows minor/major) for native modules and Expo packages, to prevent silent drift between SDK bumps. Pure-JS packages (zustand, qrcode-generator) can stay loose.

## Token policy

- **Trust the header, don't re-derive it.** Every file's `Connections:` block
  already states its imports and callers. Don't grep the whole repo to map
  dependencies that are already written down — read the header first, and
  only fall back to grep if the header looks stale.
- **Open only what the task touches.** For a cookbook task (add screen, add
  i18n string, add SQLite column, add setting), read just the files named in
  that task's steps in `AGENTS.md` — not the whole `app/`, `store/`, or `lib/`
  directory. The map in "Architecture at a glance" plus the per-file headers
  should make full-directory scans unnecessary.
- **Update headers as you go, not in a separate sweep.** When you change a
  file's imports or callers, fix both ends of the `Connections:` block in the
  same edit. This is cheap now and expensive later — a stale map forces the
  next session to re-derive it from scratch via grep/read.
- **No multi-agent delegation for this repo.** It's a single-branch,
  single-dev, cookbook-task codebase — splitting trivial steps across
  subagents adds coordination overhead with no payoff at this size. Do the
  task directly.
- **Don't re-read docs you already pulled this session.** If you've already
  fetched the SDK 56 docs for a given API in this conversation, reuse that
  context instead of re-fetching on a later turn in the same session.
- **`/clear` after a completed, committed cookbook task** (new screen, new
  migration, new setting) before starting an unrelated one — but not
  mid-task. Carry forward only: which file(s) changed, and any new i18n
  keys/migration lines added, so the next step doesn't need to re-read what
  was just written.
- **Skip the architecture-at-a-glance diagram re-derivation.** It's already
  correct in this file. Only revisit it if you've actually restructured
  `app/`, `store/`, or `lib/`.
