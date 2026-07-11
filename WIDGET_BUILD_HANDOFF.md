# Handoff — Android home-screen widgets: next native build

**Purpose:** Give the next Claude Code session everything needed to cut the next
Android build **with the widget picker preview fixed**, plus the context of what
was already fixed via OTA this session. Read `AGENTS.md` and `OTA_BUILD_WORKFLOW.md`
first — this doc only covers the widget-specific delta.

_Last updated: 2026-07-11. Branch used this session: `claude/widget-button-availability-5ufvpc` (merged to `main`)._

---

## ⏩ STATUS UPDATE (PR #127, branch `claude/expo-full-widget-apk-nx3do2`, runtime 1.3.0)

The picker-preview item below (§2) is **DONE**, and the widgets were extended into a
full interactive suite in the same PR. All of the following is **awaiting the next EAS
Android preview build** (native surface changed → maintainer cuts it from `main`):

- **Picker previews** — real `previewImage` PNGs for all widgets
  (`assets/widget-previews/{shopping,tasks,overview,notes}.png`), wired in `app.json`. §2 is resolved.
- **Interactive rows** — Tasks tap = done/not-done; Shopping tap = cycle *in list → in
  cart (`checked`) → purchased*; Notes tap = check off. Rows live in a scrollable `ListWidget`.
- **New Notes widget** — note previews + a mic button that deep-links into voice capture
  (`unfocus:///notes?capture=voice` → `VoiceNoteFAB` autoStart).
- **Headless write-back + auto-sync** — `lib/widgets/widgetActions.ts` writes taps to SQLite;
  `app/_layout.tsx` reloads task/shopping/notes stores on foreground before re-syncing.
- **Version** — `runtimeVersion` + `version` bumped to `1.3.0`.

Known limitation: a widget-completed **task** is a plain `done` flip — the `task_completed`
automation and notification reschedule only run on the next in-app open (they live in
`useTaskStore.toggle()`). On-device spot-checks still needed: picker previews, ListWidget
scroll + per-row taps, the voice deep-link path form.

The sections below are retained for historical context; §2's "what to add" is now implemented.

---

## 1. Current state (what already works — do NOT redo)

All three Android widgets (**Shopping**, **Tasks**, **Overview**) are implemented and
**live on `main`**. The following were fixed this session and shipped via OTA (pure JS):

| Fix | File | Commit/PR |
|---|---|---|
| Removed the "+" Add-task FAB from Home | `app/(tabs)/index.tsx` | PR #124 |
| Tasks widget empty ("Nothing planned today") — WAL cross-process stale read | `lib/widgets/snapshot.ts` (`PRAGMA wal_checkpoint(TRUNCATE)` after write) | PR #125 |
| Tasks widget rendered fully transparent once it had items — Unicode `☑`/`☐` glyphs blank the RemoteViews bitmap | `lib/widgets/WidgetViews.tsx` (glyph → `FlexWidget` dot/ring) | PR #125 |
| Freyr-mode toggle didn't refresh widgets after seeding | `app/settings.tsx` (`syncWidgetsAndOverview()` after seed/unseed) | PR #125 |

The widget **receivers** are already compiled into the current preview build
(EAS Android preview, built from `main` @ `b29859b`, runtime `1.2.0`). Widgets
appear in the picker and can be planted.

## 2. ~~The ONE remaining item~~ — DONE in PR #127 (kept for context)

> **Resolved.** `previewImage` is now set for all four widgets in `app.json`, with PNGs
> under `assets/widget-previews/`. The description below explains the original problem.

**Problem:** In the Android widget picker (before adding to the home screen), all
three widgets show a generic preview — the app icon (the "Tree" launcher icon) on a
plain block — instead of a representative preview.

**Cause:** No `previewImage` is set for any widget in the `react-native-android-widget`
plugin config in `app.json`. Without it, Android falls back to the app icon.

**Why it needs a build:** `previewImage` points to a PNG asset that the config plugin
bakes into the native `res/drawable` at prebuild time. It is **not** an OTA-deliverable
change. It must ride a new APK/AAB.

### 2a. What to add

For **each** of the three widgets in `app.json` → `expo.plugins` →
`["react-native-android-widget", { "widgets": [...] }]`, add a `previewImage` field:

```jsonc
{
  "name": "Tasks",
  "label": "UnFocus Tasks",
  "description": "Today's tasks",
  "minWidth": "180dp",
  "minHeight": "110dp",
  "targetCellWidth": 3,
  "targetCellHeight": 2,
  "resizeMode": "horizontal|vertical",
  "updatePeriodMillis": 1800000,
  "previewImage": "./assets/widget-previews/tasks.png"   // <-- ADD
}
```

- Field type is `ResourcePath` = `` `./${string}` `` (see
  `node_modules/react-native-android-widget/src/config-plugin.type.ts`).
- Do the same for `Shopping` → `shopping.png` and `Overview` → `overview.png`.

### 2b. Producing the preview PNGs

Best previews are **real screenshots of the rendered widget** (now that they render
correctly). Options, in order of preference:

1. **Screenshot the live widgets** on a device (light mode), crop to the widget bounds,
   save as `assets/widget-previews/{tasks,shopping,overview}.png` (~360×220 px is fine).
2. **Generate with the library's `WidgetPreview`** component (`react-native-android-widget`
   exports `WidgetPreview`) rendered in a scratch screen, then screenshot.
3. **Design a static PNG** matching each layout (dark card, title + a few rows).

> Note: this environment had **no image tooling** (no PIL / ImageMagick / sharp) and
> can't screenshot a device, which is why this was deferred to a build session with a
> real device/emulator. Verify the PNGs exist at the referenced paths before building.

## 3. Build & release sequence (follow `OTA_BUILD_WORKFLOW.md` exactly)

Because this is a **native-surface change** (new drawable assets + `app.json` config),
follow the human-gated sequence from `AGENTS.md` → "Runtime version":

1. Land the `app.json` `previewImage` changes + the PNG assets on `main` with
   `runtimeVersion` **unchanged** (still `1.2.0`) — the current preview build keeps
   receiving OTA updates.
2. **Maintainer** cuts the new preview build:
   - Workflow: **EAS Build Android (Preview APK)** (`.github/workflows/eas-build-android.yml`,
     `workflow_dispatch`). It runs `eas build -p android --profile preview`.
   - (An agent can trigger it via the GitHub Actions API, as was done this session, but
     the build itself and install verification are the maintainer's call.)
3. After that build exists, bump `runtimeVersion` (and usually `version`) in `app.json`
   to the new build's value so subsequent OTA updates flow to the new preview.
4. Do **not** bump `runtimeVersion` before the build exists (would strand OTA on a runtime
   nothing is installed on).

`slug` must stay `unfocus` (EAS project ID `9c7c7e82-8c6e-4be7-aae1-e588b4ebc495`).
`app.json` is validated in CI by `.github/scripts/check-app-config.js`.

## 4. Widget architecture — gotchas to respect (so you don't regress fixes)

Files: `lib/widgets/{snapshot.ts, sync.ts, handler.tsx, WidgetViews.tsx}`,
registered in `index.ts` (Android-only, guarded). Read each file's header block.

- **Data flow:** the app computes today's tasks/shopping once, localises every string,
  and writes ONE JSON row to the `widget_snapshot` SQLite table (`saveWidgetSnapshot`).
  The **headless task handler runs in a separate process** (app may be dead) and only
  READS that row — it never re-derives store logic or touches i18n.
- **WAL:** the DB is WAL-mode. `saveWidgetSnapshot()` MUST checkpoint
  (`PRAGMA wal_checkpoint(TRUNCATE)`) after writing, or the headless reader can see a
  stale snapshot. Do not remove this.
- **No Unicode symbol glyphs in `TextWidget`** (☑ ☐ • → …). They can fail to rasterise
  into the RemoteViews bitmap and blank the ENTIRE widget. Use `FlexWidget` shapes
  (dots/rings/bars) for iconography instead.
- **Colours must be `#RRGGBB`** literals (the lib's `ColorProp`). Avoid 8-digit alpha
  hex; for a "hollow" shape omit `backgroundColor` and use `borderWidth`/`borderColor`.
- **`WIDGET_NAMES`** in `WidgetViews.tsx` must stay in lockstep with the `name` fields in
  `app.json` and the `requestWidgetUpdate` calls in `sync.ts`.
- **Refresh points:** `syncWidgetsAndOverview()` is called on app startup (after store
  load) and every foreground/background (`app/_layout.tsx`), on the Freyr-mode toggle and
  the persistent-notif toggle (`app/settings.tsx`), and passively by the 30-min
  `updatePeriodMillis` OS tick. It is NOT called on every individual task mutation.
- **iOS widgets are not implemented** — `@bacons/apple-targets` + the App Group entitlement
  are scaffolding only (see `AGENTS.md`). This handoff is Android-only.

## 5. Quick verification checklist for the build session

- [ ] `assets/widget-previews/{tasks,shopping,overview}.png` exist and look right.
- [ ] `app.json` has `previewImage` on all three widgets; `slug` still `unfocus`;
      `runtimeVersion` unchanged for the build step.
- [ ] `node .github/scripts/check-app-config.js` passes.
- [ ] Maintainer runs EAS Android preview build; install on device.
- [ ] Widget picker shows the new previews (not the Tree icon).
- [ ] Plant each widget; confirm Tasks shows dot/ring rows (no transparency), Shopping and
      Overview populate after opening the app once.
- [ ] After build is confirmed, bump `runtimeVersion` (+ `version`) on `main`.
