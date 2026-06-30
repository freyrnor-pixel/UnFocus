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
| `slug` in `app.json` MUST stay `all-the-small-things` | EAS project is registered under this slug; changing it breaks builds |
| All strings through `useT()` from `lib/i18n.ts` | Bilingual app — never hardcode UI text |
| Date format is always `YYYY-MM-DD` strings | Used as keys throughout the stores |
| `todayStr()` / `dateStr(d)` from `lib/date.ts` | Shared helpers — do not re-implement locally |
| SQLite file name: `unfocus.db` | Set in `lib/db.ts` |
| New DB columns: `ALTER TABLE … ADD COLUMN` in migrations array | Runs once on upgrade; never drop or recreate tables |
| Stores read/write rows via `lib/dataAccess.ts` (`loadFirst`/`loadAll`/`updateRow` + `FieldMap`) | Used by 13 of 14 stores; don't hand-roll row mapping in a new store |

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

## Current deployment state

- Runtime 1.0.0 is in Preview — all updates deploy here
- This is the current target for all OTA updates and APK builds going forward

## Builds and updates

### OTA updates (normal flow)
- Workflow: `.github/workflows/update.yml` — triggers on every push to `main` only (deliberately NOT on `claude/**` branches — parallel session branches all publishing to the one shared `preview` channel caused a real incident where a later, older-tree push silently clobbered a newer one; see git history around June 2026). Push your branch and merge into `main` to publish.
- Runs `eas update --branch preview --message "..."` — always publishes to EAS branch `preview`
- Runtime version is read from `runtimeVersion` in `app.json` (currently hardcoded `"1.0.0"` to target build 148977ec)
- Apps pick it up automatically on next launch — no download needed
- Takes ~1–2 min on CI

### New APK build (only when native code changes)
- Workflow: `.github/workflows/build-android.yml` — **manual trigger only** (`workflow_dispatch`)
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
- `runtimeVersion` in `app.json` is hardcoded to `"1.0.0"` (not derived from `version` via policy)
- This targets the installed APK (build 148977ec, runtime `1.0.0`) — do NOT change it without a new APK build
- When native changes require a new APK: bump BOTH `version` AND `runtimeVersion` in `app.json` to the same new value, build the APK, then OTA updates will automatically target the new runtime

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
