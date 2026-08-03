# Repo status — UnFocus is the LIVE app (2026-07-13)

**This repo (`UnFocus`) is the current, canonical version of the app. All new
builds — OTA updates and APKs/AABs — come from here.**

**Real users are now testing the app (as of 2026-07-13)** — this is no longer a
solo-dev sandbox. Treat OTA publishes accordingly: a broken `main` merge reaches
real installs on next launch, not just a test device. This is also why Debug mode
(`settings.debugModeEnabled` → components/DebugNoteAnchor.tsx) exists — testers can
long-press any annotated card/header to leave a note in place, then export/send it
in.

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
| **Any screen or visual change is checked against `DESIGN_RULES.md`** | 25 numbered invariants (spacing, placement & order, colour, hierarchy, tap targets, motion, copy tone). Three of them are enforced in CI: tap targets/motion tokens (`lib/__tests__/designTokens.test.ts`), palette contrast (`colors.test.ts`), copy tone (`copyTone.test.ts`). **Eight rules have open conflicts with shipped decisions and are NOT binding yet** — read the audit before "fixing" one: `DESIGN_RULES_AUDIT.md`. Tap targets go through `MIN_TAP_TARGET`/`HitSlop`, motion through `Duration.*` — never a bare `44`/`hitSlop: 8`/`duration: 220` |
| Copy tone is `DESIGN_RULES.md` §7 (rules 22–25); `VOICE.md` records the ONE deliberate exception | The day log's empty state is the app's only first-person line. `VOICE.md` says why it is allowed, and why there is not a second — read it before "correcting" that string, and before adding any first-person copy of your own |
| **ALWAYS open a PR and merge it to `main`** | Standing rule: every change ends with a PR from the `claude/**` branch into `main` that the agent merges itself — never stop at "pushed the branch," never hand the merge back to the user. OTA (`.github/workflows/update.yml`) publishes ONLY on push to `main`; a `claude/**` branch push publishes nothing. Only *cutting the APK/AAB build* stays human-gated — never the PR or the merge. See `PUBLISHING.md`. |
| `AI_SETUP_SCHEMA_VERSION` in `lib/aiSetupGuide.ts` bumps whenever the AI setup guide's schema/content changes | The downloadable "AI setup guide" (Settings + the guided tour's closing card) embeds this version; on upload, an older version is a 'stale' warning (import still proceeds) and a newer version is 'invalid' (this build can't safely interpret fields it doesn't know about yet) — see that file's header and the cookbook steps below |

## Architecture at a glance

```
Screens (app/)  →  Zustand stores (store/)  →  SQLite (lib/db.ts)
                                               ↑
                       lib/i18n.ts (useT)  ───┘
                       lib/date.ts (dateStr, todayStr)
                       lib/useAppTheme.ts (useAppTheme → ThemePalette)
                         ├─ constants/colors.ts  (colours: getThemePalette, ThemePalette)
                         ├─ constants/theme.ts   (dimensions/finish: Spacing, Radius,
                         │                        FontSize, Fonts, getMaterialStyle, getGlow)
                         └─ constants/motion.ts  (timing: Duration, Ease, Spring, Travel)
```

`constants/theme.ts` does **not** re-export `constants/colors.ts` — colours and dimensions
are separate modules. (This line read `constants/theme.ts (getTheme, Colors)` until
2026-08-01; neither export has ever existed. See `DESIGN_SYSTEM_LIBRARY_INDEX.md` for which
file owns which token.)

- **Navigation**: file-based Expo Router. Primary nav is `components/BottomNav.tsx` (**Shopping/Plans/Home/Habits/Health** — that is the real `<TopTabs.Screen>` order in `app/(tabs)/_layout.tsx`; this line said Health/Habits for months and building against it put every tab's backdrop panel on its neighbour, so trust the navigator, not the prose. Decision 036, amended 2026-07-23 — UX audit E1/E2 swapped Scan out for Habits, its own tab again); other screens are reached via links/buttons from those 5. Notes and Food/Meals are NOT tabs — reached via Home's "More" links (Notes) and Shopping's Food button (F1, 2026-07-23). Scan is also not a tab anymore — it's a pushed sub-screen (`app/scan.tsx`) reached via a "Scan" button on Shopping's header; its idle screen still offers both receipt OCR and QR import. A radial-FAB `BubbleMenu` was planned in the pre-rebuild spec but was **dropped** (Decision 008 #5) before ever being ported — `components/BubbleMenu.tsx` does not exist in this repo; don't hunt for it or treat it as disabled-but-present code.
- **Onboarding** (`app/onboarding/*`, rebuilt 2026-07-31): **basics → restore → privacy →
  guided/explore → energy → index (name) → home**, then the guided tour. It was ~18
  screens, then 7, and is now **6** (B1-1 deleted the feature picker).
  - **The order is NOT declared anywhere.** `_layout.tsx` renders a bare `<Stack>`; the real
    order lives in hard-coded `router.push` literals across the screens, with a PARALLEL
    `STEPS` array (`_layout.tsx`) driving only the backdrop. Nothing keeps the two in sync
    except `__tests__/onboardingFlow.test.ts` — run it after touching either.
  - `basics.tsx` is screen ONE and replaced both `language.tsx` and the old four-step
    `app/first-run.tsx` wizard (both deleted): six rows of pills on one screen — language,
    appearance, text size, movement, menu side, starting screen. Every value already has a
    working default, so the screen only ever ADJUSTS; skipping it is a no-op. It writes ONE
    atomic patch including `firstRunComplete`. Language is row one and previews live, which is
    why it no longer needs a screen ahead of everything else. Values live in
    `lib/firstRunOptions.ts`; the old "four steps" cap is now "one screen — a seventh thing
    goes to Settings".
  - `energy.tsx` explained Energy AND Quiet growth — the two systems that sound like scoring
    and aren't — until B1-2 (2026-07-31) cut it to **Energy alone**, relaid out as one centred
    explanation. Quiet growth still exists and still works; it is just no longer pre-taught,
    on the reasoning that a numberless, ambient, off-by-default reward doesn't need it.
    `showGrowth` is now Settings-only. **Its `title` is a placeholder** ("One thing worth
    explaining") and `sub`/`note` were deleted rather than rewritten, because both said
    "Both" — so the screen currently has a heading with no sub-heading, the only onboarding
    screen like that. Awaiting the maintainer's wording; don't treat the placeholder as final.
  - **The 8-page `intro.tsx` slideshow is deleted.** Its job — teaching the features — is done
    by the guided tour on the real app (see below). Its "experimental build" note and the AI
    setup guide download moved to the tour's closing card; `t.introPrinciples` moved to Settings.
  - The Explore path skips energy/picker/name and goes straight to home on the same defaults.
  - **`guided.tsx` is a THREE-way branch since 2026-08-02**: Guided, Explore, and **AI setup**
    — the AI setup guide is a peer way to start, not only a Settings/tour-closing-card
    afterthought. The AI card downloads the guide (`exportAiSetupGuide()`) and then finishes
    setup exactly like Explore, via that screen's single `finishSetup()`; a failed export
    reports through `showAppModal` and leaves the user on the branch screen rather than
    stranded. Both non-guided branches MUST go through `finishSetup()` — two hand-written
    completions drift, and `__tests__/onboardingFlow.test.ts` pins the single write site.
    Three cards is the cap here; a fourth option or a sub-step is not in scope.
  - The backdrop is one continuous `onboarding-triptych` motif (seed → sprout → tree) slid
    across the steps, which doubles as the progress indicator — deliberately not a filling bar.
  - Old setup steps (work mode / shopping days / notifications) are still taught in context via
    each tab's ⓘ hint (`lib/useFirstVisitHint.ts` + `settings.seenScreenHints`).
- **Guided tour** (2026-07-31, `lib/tourSteps.ts` + `components/TourSpotlight.tsx` +
  `components/TourTarget.tsx`): runs on the real app after onboarding — one spotlight step per
  tab, dimming everything but one card, which stays live and tappable through the hole. Every
  step is skippable on its own and the whole tour can be dismissed from any step; progress is a
  SET of ids in `settings.tourProgress`, so a skipped step and a finished one are
  indistinguishable and reordering can't strand anyone. Existing installs were back-filled to
  `dismissed`. Two traps worth knowing before editing it: the pager runs `lazy: false` so ALL
  five screens are mounted and every target measures immediately (a rect being present does not
  mean its screen is visible — check it is on screen), and the pager moves pages by transform,
  which fires no `onLayout`, so targets must re-measure on focus or they keep their mount-time
  position.
- **Empty-state explainers** (`components/StarterCard.tsx`, 2026-07-26; extended 2026-07-27): a second, more visible teaching layer than the ⓘ hint — a short explanation plus one concrete example row, rendered inline where content would be while a surface is empty, and gone once the user has their own (emptiness is the gate, so it also returns if they delete everything). **The gate is a plain `length === 0` on only one of the callers** (`app/goals.tsx`) — don't copy that shape blindly (measured 2026-07-31, AUDIT.md): Habits counts the *person-filtered* `profileHabits`, Shopping needs `lists.length === 0 && items.length === 0` (a migration seeds one empty monthly list, so a monthly count is never 0 and would suppress the card for every new user), and Health and Plans both OR in a just-added flag (`healthStarterAdded` / `planStarterAdded`) so pressing the example's "+" doesn't unmount the card in the same tick that the write lands — Plans additionally suppresses it on the timeline layout, where `PlanTaskCard` already draws its own inline explainer. Live on Habits (plus four one-tap starter habits from `lib/habitStarters.ts`), Plans, Shopping and Health, and — since 2026-07-27 — on the **Home preview cards** too: the day-view card (`components/PlanTaskCard.tsx`) and the shopping card (`components/HomeShoppingCard.tsx`) each render their own explainer + suggested-add row *inside* the card, without a StarterCard wrapper (a Surface inside a Surface reads as a nested panel). Copy lives under `starters.*` in `lib/i18n.ts`; each one's core message is also in the matching `hints.*.example`, which is where it stays reachable after the card disappears. The StarterCard shell is styled with a **neutral** `theme.border` Surface, deliberately NOT the accent-barred HintCard look — on a first visit both are on screen at once and twins would read as a duplicate — while `components/StarterExampleRow.tsx` (the suggestion itself) deliberately DOES copy the surrounding list's real row styling (accent wash + accent edge), so a suggestion reads as a row of that list rather than a callout about one. **The Energy meter is the exception**: its explainer is a permanent one-line hint inside its own card (`t.energyMeter.hint`), not a disappearing StarterCard — as a separate card between Energy and the to-do card it read as belonging to the to-do card, and an explanation that self-destructs isn't there when you come back to the number months later.
- **Medicine trays** (2026-07-27, `components/MedicineTrayCard.tsx` + `app/medicine-form.tsx` + `store/useMedicineStore.ts` + `lib/medicineSchedule.ts` + `lib/medicineNotifications.ts`): the Health tab's first card. Medicine is organised into four **trays** — morning/midday/evening/night — deliberately NOT exact per-medicine clock times: a tray is a *window*, so a dose taken at 11:40 is still a morning dose and an untaken one reads "still due", never "missed" (the same no-shame framing as habits' rest days; keep any new copy on that side of it). One reminder per tray, shared by its medicines, with a **Taken** action button that logs the whole tray from the notification shade (`'medicine-reminder'` category, next to the existing `'task-reminder'` one). As-needed (PRN) medicines belong to no tray and are guarded by a minimum gap + optional daily cap instead (`asNeededState`) — nothing ever nudges you to take one. Per-person via People/family mode (`child_name`, same convention as tasks/habits). `health_logs.medicine_id` optionally attributes a symptom entry to a medicine ("this ADHD med gives me stomach issues"), picked in `app/health-form.tsx`'s "Possibly from" row and surfaced on that medicine's own page. Gated on `settings.featureMedicine` (on by default, still a real toggle). **Deliberately NOT in the AI setup guide** — medicine names/doses are the most sensitive rows in the DB, and the guide already refuses health-log data. Stock/refill tracking is a known follow-up, not built.
- **The row rule + matte buttons** (2026-07-28, from design-system v6's `Checklist Redesign
  Options` / `Focus First (1c)` / `handoff/BUTTONS.md` — the only parts of that bundle that
  post-date the rebuild; the rest of it describes the pre-rebuild app and is dead).
  - **Row anatomy (amended 2026-07-30 — the check moved to the RIGHT)**:
    `[leading?] title → ONE meta line → ONE right-hand value → [⋯ action] → [○ check]`.
    `components/PadRow.tsx` is the shared implementation; a list-bearing surface should
    draw through it rather than hand-rolling a row. **Adoption is partial, and the gap ran
    the opposite way to what you'd guess** (measured 2026-07-31, AUDIT.md §0.4.2e): `PadRow`
    was imported by exactly four files — `HomeNotesCard`, `HomeHabitsCard`, `HomeShoppingCard`
    and `PlanTaskCard`, i.e. the four **Home** cards — and by NO tab screen at all, which
    inverted the conversion task written against it. **The Home cards are the newer code** —
    don't "fix" a Home card by converting it to match its tab; convert the tab.
    Two have been, so far: `app/(tabs)/habits.tsx`'s in-file `HabitCard` (2026-08-01) and
    `components/NoteRow.tsx`, the notes screen's row (2026-08-01, via PadRow's `titleInput`
    prop — a row whose title is EDITED IN PLACE, which is what that screen is for). Left:
    `shopping.tsx` (`ShoppingRow`/`MonthlyTableRow`, much the largest); `plans.tsx` still
    uses `TaskCard` except in the timeline layout, where it mounts `PlanTaskCard`.
    The check led every row until this pass;
    the maintainer's call was to move it app-wide, on the reasoning that a paper checklist
    puts its ticks in the right margin. `TaskCard` already ended its line 1 that way, so it
    was the model. The ⋯ is ONE row-level action button, replacing the assorted trailing
    trash/send/put-back buttons.
    `TaskCard`'s person chip, tags and goal dot live on the meta line (gated by
    `hasMetaLine`, **which must mirror the JSX gates exactly** — if they drift, a row with
    one meta item silently loses its line; `app/(tabs)/habits.tsx`'s `HabitCard` carries the
    same gate); the right-hand value carries `TabularNums` (`constants/theme.ts`) so a column
    of times/prices/counts lines up row to row.
    Row dividers are **full-width** now — `ROW_DIVIDER_INSET` is deleted. It existed to clear
    the leading check; with the check on the right there is nothing to clear, and a rule that
    crosses the whole line is what reads as ruled paper. Prefer letting
    `components/PadSheet.tsx` draw the rules rather than drawing your own.
    **NOT taken from that spec**: dropping the accent stripe / category-as-a-dot — the
    gradient badge, keycap edge and domain ramp stay (maintainer's call, #390/#393/#410).
  - **Shopping quantity is an input, not a value**: it READS in the row's leading cluster and
    is EDITED in `components/ShoppingItemSheet.tsx` (a row-body tap). That sheet is also the
    only editor for a weekly item's unit/price/category. `onIncrement`/`onDecrement` on
    `ShoppingRow` are gone — `onOpenDetail` replaced them.
  - **Matte finish**: there is no specular highlight any more (removed — it read as gloss;
    `__tests__/glassMaterial.test.ts` asserts the token is GONE, not merely dimmed). The face
    lift is 10% white gone by 42% plus a 4% bottom shade; the rim is a flat white .22 that
    stops at 12%. Don't raise these back — that is exactly the "too glossy, too rounded
    towards the user" state the maintainer rejected.
  - **Press = sink, not shrink**: `PressableScale`'s `travel` (px, from `Travel.*` in
    `constants/motion.ts`) translates a cap down into a base; `sunk` is the stays-pressed
    "on" state (active tab, active IconButton). A caller passing `travel` must also draw a
    base — see `Button.tsx`'s `keyBase` — or the cap sinks into nothing. Note `style` moves
    to the wrapper on that path.
- **Ongoing symptom episodes** (2026-08-01, `lib/episodes.ts` + `components/OpenEpisodeCard.tsx`
  + `components/EpisodeCloseSheet.tsx`, over `health_logs`' new `episode_state` / `relief_note` /
  `relief_medicine_id` columns). A symptom entry that is STILL HAPPENING, as opposed to one
  logged after the fact. Full design record: `EPISODES.md`.
  - **It is not a stopwatch, and that is the whole design.** No live elapsed counter anywhere,
    ever — an episode is a STATE, not a stretch of time. Duration is computed on read, rounded
    into plain language (`About 4 hours`, never `3h 47m`), shown in exactly ONE place
    (`app/health-detail.tsx`'s entry rows), and never stored, totalled or averaged. Same family
    as a medicine tray being a window and a goal's strength flooring at neutral.
  - **`episode_state` is the single source of truth; `end_date = ''` is NOT "ongoing".** That
    sentinel already meant three different things, so every pre-existing row migrated to
    `'point'` regardless of its end date — deliberately, because back-filling `'ongoing'` would
    have opened an episode for every headache ever logged. `episodeState === 'ongoing'` implies
    a blank end pair; **the converse is not true.** Ask `isOpen()`/`openEpisodes()`, never the
    end pair. The two widget derivations were switched over with it, which makes the widget's
    `healthOngoing` count correct for the first time (expect it to drop to 0 on existing
    installs — intended, not a regression).
  - **No auto-close, no notification, no escalation — at any horizon.** An episode open for
    days is normal. The prompt card renders byte-for-byte identically on day 1 and day 9: no
    day counter, no colour change, no second prompt, no badge or count anywhere else. It is
    flat and neutral-bordered on purpose, unlike every other card on that tab. "Still going"
    **writes nothing at all** — dismissal is in-memory, because storing "I asked at 14:02" is a
    timestamp about being unwell. Recoverability is the answer to staleness instead: closing
    always allows backdating, so a week's forgetting loses nothing.
    `lib/__tests__/episodes.test.ts` source-scans the module and both components for
    notification APIs and asserts zero hits — that test is what keeps the promise true.
  - **Relief data is displayed and never interpreted.** No correlation, no ranking, no "this
    usually helps", never aggregated across entries. The close sheet's medicine chips are a
    filter ("you took this while it was happening"), not a claim. Read `lib/episodes.ts`'s
    header before adding anything that reads these columns.
  - Not synced (`health_logs` isn't in `SyncTable` and must not be added), not in the AI setup
    guide (health is not an importable domain — **no `AI_SETUP_SCHEMA_VERSION` bump**), no
    person column (§9 — a bigger privacy decision than this feature).
  - Fixed a pre-existing bug while it was in there: `pruneOldData()` filtered `log_date` alone,
    so an episode open past the 365-day window was silently deleted on the next cold start. It
    now carries `episode_state != 'ongoing'`, NULL-unsafe by design — a NULL state fails the
    predicate and is KEPT, because failing safe means not deleting.
- **The day log — the now-line as a boundary** (2026-08-02, `lib/dayLog.ts` + `lib/useDayLog.ts`,
  drawn by `components/PlanTaskCard.tsx`, over the new `tasks.done_at` and `moments` table).
  The day-view card is split by the current minute, and the two halves get deliberately
  OPPOSITE treatment: **ahead of now** is the elastic timeline that already existed (real
  durations, visible gaps — gaps read as room); **behind now** the same day collapses into a
  flush, spacing-free list of what actually happened. A gap ahead of you is room; the
  identical gap behind you is an accusation. That collapse is the entire feature — don't
  "tidy" the log by giving it spacing, an hour rule, or a header.
  - **It is a record, not a productivity surface.** No count, total, percentage, rate or
    progress bar anywhere in it; no evaluation, no praise, no verdict on a quiet day; no
    notification, ever, at any horizon. `lib/__tests__/dayLog.test.ts` source-scans the
    module for aggregate derivations and notification APIs and asserts zero hits — same
    mechanism that keeps the equivalent promise true for episodes.
  - **Phase 2 of the handoff was already built.** `lib/dayGrid.ts`'s elastic axis, live
    now-line and log-curve gap compression predate this by a week and are the To-do tab's
    DEFAULT layout. The only change to them is `buildDayScale({ startMinutes })`, which lets
    the axis span `[now → end of day]`; omit it and the axis is byte-identical to before.
  - **The premise the handoff was specced on was false.** The app did not timestamp
    completions: `tasks.done` was a bare flag and `updated_at` is the sync LWW stamp, which
    moves on ANY edit by ANY device. Hence `tasks.done_at` (local `HH:MM`), stamped only by
    `toggle()`/`completeDirect()`. It is deliberately **NOT** in `lib/liveSync`'s
    `TABLE_COLUMNS.tasks`: the log is a record of what YOU did, so a peer ticking a shared
    task lands `done` without writing a line into your day.
  - **Absence beats invention.** No back-fill: a completion from before the column has no
    honest time and is simply absent. Health entries reuse `health_logs.created_at`, which
    has carried a wall clock since the first schema and was never read — it is **UTC** while
    everything else in the app is local, so `lib/date.ts`'s `utcStampToLocalMinutes` is the
    one place that crosses that line, and it returns null rather than filing an entry under
    the wrong day. Sources are tasks, **habits**, medicine doses, health entries and manual
    moments; shopping and notes are deliberately out (see `lib/dayLog.ts`'s header —
    `monthlyReset()` NULLs every `purchased_at` and deletes trips, so shopping would vanish
    from past days after a reset).
  - **A habit enters the log on the FIRST log of the day, NOT on "met"** (`habit_logs.first_at`).
    A habit is a standing commitment the user set up, so doing it is exactly the evidence
    this log is for. Gating on `habitMetOn` would import a pass/fail threshold into a
    surface that deliberately has none — 5 of 7 glasses of water would leave no trace at
    all, reading as "you did nothing" on precisely the kind of day this exists for.
    `dailyGoal` is 1 for almost every real habit anyway, so the two rules only differ on
    counters. **Don't "unify" this with `habitMetOn`** — the codebase already has four
    competing "done" definitions and this is deliberately not a fifth; it asks the simpler
    question "did this happen at all today". Rest days and a count back at 0 are excluded.
    Habits are the ONE source the log person-filters (only when People mode is on and
    there's somebody else, mirroring `app/(tabs)/habits.tsx`). Note habits reach back only
    **35 days** in `app/day-log.tsx` — `useHabitStore.load()`'s in-memory window — while
    everything else reaches 365.
  - **The cutoff is INCLUSIVE and that is load-bearing.** Everything here is minute-granular,
    so the thing you just did is stamped at exactly the current minute. A strict `<` made the
    log render empty for up to 60 seconds after every action — i.e. exactly when you'd look
    at it. Pinned by a named regression test.
  - **No new Home card.** Home already renders `PlanTaskCard` read-only, so its day-view
    preview carries the log and the capture for free. (`HomeGoalsCard` shipped as a fifth
    Home card on 2026-07-28 and was deleted the next day — "Home had too many lists".)
    Capture goes through the existing pad type-line (`components/PadTypeRow.tsx`), not a new
    input: a chip in its extras row switches whether a submit commits a task or a moment. The
    standalone quick-capture inbox was removed 2026-07-27 and `inbox_items` is a dead table —
    don't revive it.
  - Device-calendar events (`lib/deviceCalendar.ts`) are **read-only** and are *structure,
    not achievement*: they draw ahead of the now-line and never enter the log behind it. They
    share ONE `layoutGridEntries` pass with tasks, or an overlapping meeting and task would
    stack instead of going side by side. Permission is asked once, contextually, when the
    timeline is first opened; declining is a supported permanent state with no nag and no
    re-prompt. **This needed no native build** — `expo-calendar` was already a dependency and
    already plugin-registered, and `lib/taskCalendar.ts` (a separate feature, which *writes*)
    already called it.
  - Gated on `settings.featureDayLog` — on by default, still a real toggle. It gates the
    SURFACE only: `done_at` keeps being stamped while off, so switching it on shows a
    complete history. `app/day-log.tsx` is the earlier-days screen (one day at a time, no
    aggregation, no week view — two days compared is a scoreboard).
  - Copy: `VOICE.md`. The empty state is **the only first-person line in the app**, and it is
    deliberate — read that file before "correcting" it.
- **Drag to reorder is universal** (2026-08-01, `lib/useDragReorder.ts` over the pre-existing
  `components/DraggableTaskRow.tsx` + `lib/reorder.ts`). Hold a row ~400ms, drag, drop: the list
  reflows under the finger and the new order is committed ONCE, on drop. It was already the
  gesture on Home's preview cards, the shopping list, saved lists and the monthly-reset sheet;
  the mechanic around it (measure at drag-start → `reorderByDrag` → LayoutAnimation → commit)
  was hand-rolled in `HomeCardManager` and is now one hook, with the notes screen, the Habits
  tab and Plans' Whenever list added as callers. Two rules worth keeping:
  - **A list gets a manual order only if it has no natural one.** Notes, habits, shopping rows,
    Home's cards and the undated Whenever backlog do. Plans' Today/This week lists do NOT —
    they are ordered by the clock (`byTime`), and dragging a 09:00 task under a 14:00 one would
    either lie about the order or silently retime the task. Habits' Week/Month views are a
    calendar, same reasoning.
  - **The committed ids are usually a SUBSET of the table** (the Today habit list is filtered by
    person and by due-today; Whenever by person and tag). `useHabitStore.reorder` and
    `useTaskStore.reorderTasks` therefore slot the moved rows back into the positions they
    already occupied rather than renumbering the visible ones 0…n-1 — a row the user couldn't
    see keeps whichever visible rows it sat between. `useNotesStore.reorder` is the exception
    and renumbers per section, because notes are ordered `checked, sort_order`: the two
    sections' number ranges may overlap and the checked flag still separates them.
  Render from the hook's `order`, never from the store array, or nothing moves under the finger.
- **Card layouts + the "what was hidden" glow** (2026-07-27, `lib/cardLayout.ts` +
  `lib/useSurfaceLayout.ts` + `lib/viewSnapshot.ts` + `lib/useNewSinceSeen.ts` +
  `components/LayoutPickerSheet.tsx` + `components/NewSinceGlow.tsx`): list-bearing surfaces
  can be drawn at three shared detail levels — **Just the basics / Normal / Show everything**
  (`settings.layoutDetail`, the global default in Settings → Personal → Layout) — plus
  surface-specific shapes: **In the store** (Shopping: big rows, names only, no money, and
  since 2026-07-28 grouped by aisle — a `groupByAisle` flag that a test pins to this layout
  alone, because every other layout keeps the order the user dragged rows into), **Now and
  next** (Plans: only the current + next task, rest behind "The rest") and **One thing at a
  time** (Plans, 2026-07-28 — v6's `Focus First (1c)`: a Next up hero, a short Then list, then
  the day's done count; it also hides the Whenever section). The mock's "Later" row of count
  chips is deliberately NOT built: it duplicated the tab bar sitting a few pixels above it, so
  the counts live in `TabSlider`'s own `accessory` slot instead (that slot exists for exactly
  this) and there is one control, not two. `accessory` nodes don't know their own active
  state — the caller must bake the active colour in, or the count sits muted-grey on the
  accent pill.
  Per-surface overrides live in `settings.cardLayouts` (JSON `{surface: layoutId}`, same
  storage shape as `home_card_order`) and are picked from the surface's own header icon, not
  from Settings. Layout names describe the *situation* you'd want them in, never the
  typography — "In the store", not "Compact".
  - **Layouts are presentation only, and this is enforced.** A row the active layout doesn't
    draw is still a live row: it keeps its reminders, still counts in section headers, and is
    one tap away. `lib/cardLayout.ts` is deliberately dependency-free and
    `lib/__tests__/cardLayout.test.ts` asserts neither it nor `useNewSinceSeen` can reach
    `lib/notifications`/`lib/reminders`/any store. If you need store state there, pass it in.
  - **The glow marks VISIBILITY, not novelty.** When the user switches layout, whatever the
    *previous* view was hiding glows — a row it was collapsing, or a value it wasn't drawing
    (`NewSinceGlow`'s `tight` mode, e.g. a quantity that appears going basics → normal). A
    glowing row is usually something they've used for months; nothing anywhere looks at when
    a row was created. `lib/viewSnapshot.ts` stores the *set of visible ids + which fields
    were drawn* per surface in `app_meta` (`view:<surface>`), device-local — never add
    `app_meta` to `syncService`'s `SyncTable`, or two people in family mode would clear each
    other's glows. Snapshot keys are per TAB (`plans:today`, `shopping:weekly`) so switching
    tabs doesn't glow half the list.
  - Gotchas that bite: pass the ids the layout **actually draws** (a collapsed row must be
    absent, or it can never glow later); pass the store's real `loaded` flag as `ready`
    (snapshotting an unloaded store saves "nothing visible" and then glows everything); and
    add any new layout/glow prop to `ShoppingRow`'s `React.memo` comparator, or a layout
    change won't repaint the list.
- **Per-item card types** (2026-08-01 phase 1, `lib/cardType.ts` + the switch inside
  `components/TaskCard.tsx`, over the new `tasks.card_type` column). Four ways ONE to-do item
  can draw itself: **standard** (the existing card, deliberately unchanged), **simple**
  (title + tick, so a trivial task costs nothing to capture), **note** (free text, no tick,
  no completion state) and **stepped** (an ordered list of steps, exactly one visible).
  - **It is a property of the ITEM, and that is the whole distinction from
    `lib/cardLayout.ts`**, which is per-surface and a user setting. The two stack as filters
    on a row and only ever SUBTRACT: the card type decides what the item may show, the layout
    may hide more, neither adds a cue back. Two files, two scopes, similar names — check which
    one you mean before editing either.
  - **One component, not four.** `TaskCard` switches on `cardType` over the same row anatomy,
    container, press behaviour and shadows. `PlanTaskCard` carries only the minimum the types
    require of a second surface (no checkbox on a note, progress on a stepped row); the full
    rendering and the type picker live in `TaskCard` alone. Don't add a third renderer.
  - **Steps were already built** — `task_steps` + the task↔steps done-cascade predate this by
    months. Stepped reuses them wholesale and adds **no** step storage and, deliberately, **no
    `currentStepIndex`**: the visible step is DERIVED as the first not-done one, so it can't
    drift from flags the widget, the cascade or a peer might change, progress survives a
    remount for free, and "back a step" is just unticking. Same derived-not-stored discipline
    as `lib/taskRotation.ts` and `episode_state`.
  - **'note' is the one type that isn't purely presentational.** It has no completion state at
    all, so `isCompletable()` gates every count in the app: `toggle`/`completeDirect`/the step
    cascade all bail, and it's excluded from `lifetimeCompletedTasks`, the growth streak, the
    day summary + progress bar, the focus layouts' hero, the tab counts, Energy (current AND
    planned) and the widget's task list — including the headless snapshot's raw SQL. Every
    other type hides things in the row while the values stay stored and their reminders keep
    firing, exactly like a layout.
  - **Energy on a stepped card is spent proportionally per step**, not all at completion —
    `lib/energy.ts`'s `energyDeltaForDay` now multiplies by `energySpentFraction`. Scoped to
    stepped cards, so nothing that predates this changes; PLANNED energy still counts the full
    value ("if everything happens" includes every step). Day/week totals round to 1 decimal
    because `EnergyMeter` prints `current` raw.
  - **Switching type is lossless and reversible** — nothing is cleared, ever. A stepped card
    turned simple keeps every `task_steps` row with its done flags; a completed task turned
    note keeps its `done` and simply stops being counted. Picked from a labelled four-option
    row in the item's own editor (visible words, not icons), buffered on the draft so Discard
    reverts it. **Never prompted at creation time**, and there is no long-press entry point:
    long-press is already the drag-reorder gesture (`lib/useDragReorder.ts`) and the app has no
    row context menu to add to. `card_type` syncs and is importable via the AI setup guide
    (`AI_SETUP_SCHEMA_VERSION` 4).
- **To-do sharing: People, tags, shared load, rotation** (2026-07-28, phases 1–4). Four
  pieces that together make a to-do list something two phones can actually divide.
  - **People registry** (`store/usePeopleStore.ts` + `lib/personColor.ts` +
    `components/PersonChip.tsx`) — the synced `people` table replaced
    `settings.childProfiles` (a `string[]` of names that a rename silently orphaned).
    `tasks.assignee_id` is who a task is FOR, `created_by_person_id` who it came FROM;
    both sync, and neither is `origin_device_id`, which is the LAST WRITER and so flips
    the moment the other person ticks the task. **`is_self` is deliberately NOT syncable**
    — a peer's self row arriving with `is_self=1` gives the receiver two "me" rows. The
    `childProfiles` back-fill is a one-shot gated on `app_meta` and **cannot be re-run**.
  - **Tags** (`lib/tags.ts` + `store/useTagStore.ts` + `components/TagChip.tsx`) — a synced
    `tags` table; membership is `tasks.tag_ids`, one comma-separated column, **not a join
    table** (liveSync replicates a row+column, so a join table would need its own
    SyncTable, tombstones and per-pair LWW race). **A tag has no colour**: the card border,
    the status rail, the person dot and the goal glow have already claimed every channel a
    task row can carry — tags are told apart by their word. Create only via `ensure()`,
    which name-matches case/spacing-insensitively.
  - **Shared load** (`lib/personEnergy.ts` + `components/EnergyBalanceCard.tsx`) — per-person
    Energy on the To-do tab. It compares **pressure (load ÷ that person's OWN capacity)**,
    never raw point totals: capacities differ on purpose, so ranking by absolute load would
    punish whoever set an honest lower number. **Habits don't sync**, so a person with their
    own paired phone is `tasksOnly` and their row says so rather than under-counting
    silently. There is deliberately no "you're behind" state.
  - **Rotation** (`lib/taskRotation.ts`) — `rotation` / `rotation_person_ids` /
    `rotation_anchor` on tasks, per day/week/month. **Whose turn it is is DERIVED from the
    date, never stored**: both phones compute the same answer, so no device ever writes
    "advance the turn" for LWW to lose or double-apply. Never recompute `rotation_anchor`
    on an existing task — it reshuffles every past and future turn. Ask
    `effectiveAssigneeId(task, date)`, never `task.assigneeId`, or rotation is ignored.
    A removed person keeps their roster slot (dropping it re-indexes everyone after them).
  - **"By person" layout** — a `plans`-only layout id in `lib/cardLayout.ts` whose
    `groupByPerson` flag regroups **the Today tab** into one person-hued `SectionCard` each
    (This week groups by day and All tasks by kind, so both keep their own grouping). A
    `SectionCard` hue is the one place `lib/personColor.ts` permits the identity colour
    beyond an avatar dot.
- **Goals — and where "cutting back" lives** (2026-07-28, `app/goals.tsx` +
  `lib/goalStarters.ts`, over the pre-existing `store/useGoalStore.ts` +
  `lib/goalStrength.ts`). Design-system v6 proposed a "Cutting
  back" section on Habits (negative habits, a "Log a slip" button, a best-stretch counter).
  **That was rejected**: habits stay positive-only — no negative kind, no slip logging, no
  broken streak — and something you want to do LESS of is expressed as a **Goal** ("Less time
  on my phone") whose linked tasks/habits are the replacement behaviour. This needs no new
  column: the title carries the direction, and the existing strength mechanic already rises
  on progress and cools back toward neutral, **never below** (`goalStrength.ts` floors at 0),
  so there is no state in which a goal is failing. Goals previously had no surface at all
  (picker-only, plus a glow dot); they got a screen + Home card showing three
  fine-to-be-in strength bands, what's linked, and when it was last worked — deliberately no
  fourth, worse band. One starter goal is a cutting-back one and a test asserts it stays,
  with wording on the aiming-at side, since that's the only place the pattern is taught.
  **The Home card was dropped again one day later (2026-07-29, user report: Home had too
  many lists)** — `components/HomeGoalsCard.tsx` is deleted, `'goals'` came out of
  `HOME_CARD_KINDS`/`homeCardOrder` (`app/(tabs)/index.tsx`, `store/useSettingsStore.ts`),
  and the screen's two entry points are now a `components/SubScreenLinkButton.tsx` ("Goals",
  gated on `featureGoals`) on `app/(tabs)/habits.tsx` and `app/(tabs)/plans.tsx` — the same
  button-launched-sub-screen pattern as Shopping's Food/Catalogue links. The screen itself
  (`app/goals.tsx`), the strength mechanic, and the per-item `GoalPicker` in `TaskCard`/
  `habit-form.tsx` are all unchanged — only Home's standing presence went away.
- **The decorative motif system** (2026-07-31, `constants/motifs.ts` + `components/Motif.tsx`,
  generated by `scripts/build-motifs.mjs` from `assets/decorative/*.svg`). The design system's
  tree vocabulary — halo ring, brush-daub canopy, forking trunk, ground arc, floating dots.
  - **`constants/motifs.ts` is GENERATED — never hand-edit it.** Every `-light`/`-dark` SVG
    pair is geometrically identical and differs only in colour and opacity, so one entry holds
    the shared geometry plus BOTH opacities and NO colour; the consumer passes a theme token.
    That is what keeps raw hex out of components. Re-run the script after changing an SVG.
  - **The tab backdrop is ONE continuous 1950×844 strip** (`screen-bg-strip`, five 390-wide
    panels) slid by the pager's index, not five pictures crossfaded — so a swipe travels along
    one branch. `scripts/author-screen-bgs.mjs` builds it from a shared spine, which is what
    makes continuity structural. **Panel order must match `<TopTabs.Screen>` order**;
    `lib/__tests__/motifs.test.ts` checks it, because getting it wrong shows every tab its
    neighbour's art with no crash and nothing visible in review.
  - **The centre box (x 84–306, y 236–612 per panel) stays clear** — that's where cards live,
    and it is why the art is edge-anchored and why `assets/bg-light.png` was retired. Soft
    `wash` fills are exempt: the design system files them under "holders", meant to sit behind
    content. Pinned by test.
  - `screen-bg-calm` is the standalone sub-tier backdrop; `trunk-divider` is `SectionDivider`;
    `empty-branch` is `StarterCard`'s watermark; `onboarding-triptych` is onboarding's
    growing-tree backdrop. `fab-halo` is filled circles meant to sit BEHIND something — do not
    use it over content you want to stay untinted.
- **The reward system is the backdrop** (2026-07-31, `lib/growth.ts` + `lib/useGrowth.ts`,
  drawn by `components/ScreenBackground.tsx`). A Bonsai/points card shipped and was replaced
  the same day; `lib/bonsai.ts`, `components/BonsaiCard.tsx` and `components/BonsaiTree.tsx`
  are **deleted** — don't look for them. The replacement shows the user **no number at all**:
  no streak count, no total, no level, nowhere.
  - **Two channels, deliberately different in kind.** `intensity` [0,1] tints the whole branch
    cluster from the neutral blue toward green as a streak climbs, and fades back; `level`
    grows extra branches in around the screen border (starting with the bottom-right corner
    the original art left empty) from a **high-water mark**, so branches never un-grow.
  - **Neutral is the floor, and that's the whole point.** A lapsed streak returns the backdrop
    to exactly the art the app always had — never to a visibly worse one. Same shape as
    `lib/goalStrength.ts` flooring at 0. There is no "you broke it" state, and the streak
    doesn't break at midnight either: decay runs off *days since the last active day*, so an
    untouched morning costs a sliver of tint rather than the streak.
  - **A day is active from a habit met OR a task completed** — the whole app, not just Habits.
  - `lib/growth.ts` is dependency-free (plain arrays in, numbers out) like `lib/cardLayout.ts`;
    all store access lives in `lib/useGrowth.ts`. Gated on `settings.showGrowth` (off by
    default) whose DB column is still `show_points`; the high-water mark persists to
    `settings.lifetimeGrowth` over the `lifetime_bonsai_points` column, and keeps accruing
    while the feature is off. **No store awards anything** — the streak is derived by reading
    `habit_logs`/`tasks` after the fact, so there's no award hook to keep in sync.
  - Only the tint animates (`Duration.ambient`, 2400ms). A `level` change is deliberately
    un-animated: it's derived from a streak that turns over between sessions, so nobody is
    watching. Adding a growth stroke? Keep it out of the centre box (x 60–220, y 170–440).
- **First-run personalization** (2026-07-30; folded into `app/onboarding/basics.tsx` on
  2026-07-31 — `app/first-run.tsx` is deleted. Values still live in `lib/firstRunOptions.ts`):
  six rows on ONE screen — **language / appearance / text size / movement / menu side /
  starting screen** — shown once on a fresh install (`settings.firstRunComplete`). It is now
  the FIRST onboarding screen rather than a wizard after it; `app/_layout.tsx`'s second guard
  is a safety net for an install that finished onboarding under an older build. It is **not** more setup: every value it
  writes already has a working default applied before it renders, so it only ADJUSTS —
  skipping it, or force-quitting mid-flow, leaves an app that behaves identically.
  - **One atomic write.** Selections live in local state until commit;
    `settingsPatchFromPicks()` returns ONE patch holding all six rows *plus*
    `firstRunComplete: true`, so the gate can never be set without the selections landing
    with it. That also makes "Run setup again" (Settings → Personal → Layout, which now re-enters onboarding's Basics screen) idempotent:
    it seeds from current settings, so pressing straight through writes them back unchanged.
    A test pins the picks ⇄ settings round-trip over all 324 combinations.
  - **Live preview means changing the actual screen**, which is why the flow resolves its
    own palette and text scale from local state via the *pure* `buildTheme` /
    `resolveIsDark` / `scaleStyles` helpers in `lib/useAppTheme.ts` — and why it can't use
    `Surface`/`Button` (they read the store, so they'd sit at the committed appearance
    while everything around them previewed the new one). Hand-rolled cards are deliberate.
  - **Motion is a three-rung ladder over two existing booleans** — full → reduced
    (`particlesEnabled` off) → none (also `reducedMotion`). Monotonic on purpose: the OS
    reduce-motion flag is OR'd in by `useAccessibility()`, so picking "Full" can never give
    a phone more movement than it asked for; when the OS flag is on the flow pre-selects
    "Reduced" and says why. There is deliberately no new motion setting.
  - **Starting screen** (`settings.startScreen`, home/plans/shopping) is the navigator's
    `initialRouteName`, frozen at mount in `app/(tabs)/_layout.tsx` — NOT the same thing as
    the `unstable_settings.initialRouteName` beside it, which is the static deep-link back
    target and stays `index`. Presentation only; every tab is one tap away regardless, and
    a change from Settings applies at the next launch rather than yanking the tab mid-session.
  - ONE SCREEN is the cap — the old "four steps" cap encoded the same anti-overwhelm rule.
  A seventh row goes to Settings.
- **Settings** (`app/settings.tsx`): three tabs — **General** (profile, appearance, accessibility, account/backup, version, reset), **Personal** (notifications, shopping cadence, layout, device features), **Advanced** (the Features card, People/family, paired devices, Freyr-mode, debug). Reorganized 2026-07-25 from four tabs; see that file's header for the full before/after.
- **Feature flags** (2026-07-25, defaults revised same day): three states, not one.
  - **On by default, still a real toggle** (Settings → Advanced → Features): `energySystemEnabled` (Energy system), `featureGoals` (Goals) and `featureMedicine` (Medicine trays, 2026-07-27). Not offered in the onboarding picker — "opt in from nothing" doesn't fit a feature that's already on. Turning `featureMedicine` off must actually CANCEL its four tray reminders, not just hide the card — `app/settings.tsx`'s `applyAndSync` re-syncs them on that key. `energySystemEnabled` is the one flag that has flip-flopped: a toggle → inert/always-on (2026-07-26) → **a real toggle again (2026-07-31)**, gating `EnergyMeter`, `EnergyBalanceCard`, both editors' energy steppers and `PlanTaskCard`'s quick-add chip. It gates SURFACES only — per-task/habit `energyEnabled`/`energyValue` keep their stored values while off, so switching back on restores every number.
  - **Off by default, still opt-in** (Settings → Advanced → Features — **and nowhere else since 2026-07-31, B1-1**): `featureSharing` (Sharing & QR) and `featureAutomations` (Automations). The onboarding feature picker (`app/onboarding/features.tsx`) is **deleted** — don't look for it, and don't add a new flag to it. Onboarding no longer offers ANY feature opt-in: a new install now gets the defaults and nothing to choose, which is the point. `showGrowth` (Quiet growth — the ambient reward; the DB column is still `show_points` from the Bonsai/points system it replaced within a day) is off by default too, and was offered on `app/onboarding/energy.tsx` until B1-2 removed the Quiet growth half of that screen; it is now Settings-only as well.
  - **Permanently on, no longer a toggle at all**: `featureScan` (Scan & receipts) and `featureFood` (Food & recipes) — removed from both Settings and the onboarding picker; the DB columns and Settings-type fields survive (this repo never drops columns) but nothing reads them for gating any more — see `store/useSettingsStore.ts`'s "Inert columns" note.
  - All defaults are set via migrations in `lib/db.ts` (append-only — corrections are new `UPDATE` statements, never edits to an already-merged line). Only gate something ADDITIVE this way — data pruning, widget/overview sync, foreground store reload, catalog/dish/symptom seeding, the automation store's boot load and the monthly reminder re-arm are load-bearing and stay unconditional.
- **i18n**: `const t = useT()` in any component; `t.someKey`; add new keys to both `en` and `no` objects in `lib/i18n.ts`
- **AI setup guide** (`lib/aiSetupGuide.ts` + `lib/aiSetupApply.ts`, 2026-07-26): the app has no in-app AI/automation-builder, so this lets a user download a technical `.txt` (Settings → General → Local account, and a link on the guided tour's closing card) documenting the data model, hand it to an external AI, and upload the AI's filled-in reply back into Settings. The reply embeds one JSON block between fixed markers; `previewAiSetupConfig()`/`applyAiSetupConfig()` share one validation pass so the confirm-before-apply preview (`components/AiSetupPreviewModal.tsx`) can never disagree with what's actually written. v1 covers settings (a fixed whitelist), tasks, habits, goals, notes, shopping lists/items, household inventory, Catalogue-tab items, meals, and monthly lists — deliberately NOT automations (IFTTT rules), health-log data, or medicines/doses (too risky to validate / too sensitive — see that file's "out of scope" edit note before adding a medicine domain). See "Add a new SQLite column" / "Add a new setting toggle" below for the process rule that keeps the guide from drifting out of date.

## Common tasks

### Add a new screen
1. Create `app/my-screen.tsx`
2. Add an entry point: a tab in `components/BottomNav.tsx` if it's a main section, otherwise a link/button from whichever screen owns it
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
4. If this column is on a store/domain the AI setup guide already imports (tasks,
   habits, goals, notes, shopping lists/items, household inventory, Catalogue items,
   meals, monthly lists — see `lib/aiSetupGuide.ts`) AND the new field is safe to
   accept from an untrusted AI-generated file, add it to that domain's draft type +
   validation in `lib/aiSetupGuide.ts`/`lib/aiSetupApply.ts` and to the guide text's
   schema section for that domain, in the same edit — bump `AI_SETUP_SCHEMA_VERSION`.
   If the column shouldn't be importable (system-managed, like a `calendarEventId` or
   a synced/internal id), no change needed there — just don't add it to the draft
   type by habit-copying the store's real type.

### Add a new setting toggle
1. Add field to `Settings` type and `defaultSettings` in `store/useSettingsStore.ts`
2. Add migration (see above)
3. Update `load()` and `update()` in the store
4. Add to `app/settings.tsx` UI
5. Add i18n labels
6. If the setting is safe for AI-driven configuration (not device/identity-specific,
   and not an OS permission gate like `locationEnabled`/`calendarSyncEnabled`), add it
   to the whitelist in `lib/aiSetupGuide.ts`'s `AiSettingsPatch` type + the guide
   text's settings schema section, AND to `lib/aiSetupApply.ts`'s `SETTINGS_WHITELIST`
   + `validateSettingValue()` — bump `AI_SETUP_SCHEMA_VERSION` in the same edit.

For a **feature flag** specifically (a switch that hides a whole surface), also: put its
copy under `config.features.*` in BOTH languages, and gate the surface at its call site —
never the data or the store — so turning the flag back on always restores everything
untouched. Then pick which of the three shapes it needs:
- **Off-by-default opt-in** (most common): add the row to `FEATURE_ROWS` in
  `app/settings.tsx` — that is now the ONLY place (the onboarding picker was deleted
  2026-07-31, B1-1; there is no `ROWS` array to add to any more). Back-fill existing
  users with `UPDATE settings SET <col> = 1 WHERE setup_complete = 1` so nobody who's
  already using the surface loses it.
- **On-by-default toggle** (like Energy/Goals): add the row to `FEATURE_ROWS` only —
  the onboarding picker doesn't fit something already on. Set the column's own
  `DEFAULT 1` in its `ALTER TABLE`, or migrate existing rows separately if it started
  off-by-default and is switching over (see `lib/db.ts`'s 2026-07-25 follow-up
  migrations for the pattern).
- **Permanently on, no toggle** (retiring a flag, like Scan/Food): remove it from both
  `FEATURE_ROWS` and the onboarding `ROWS`, un-gate every call site, and append a
  migration setting the column to 1 unconditionally. Keep the field in `Settings` and
  the DB column (never dropped) — note it under "Inert columns" in
  `store/useSettingsStore.ts` so a later session doesn't wire new UI to it by mistake.

Migrations in `lib/db.ts` are an append-only log — `PRAGMA user_version` indexes into the
array, so an already-merged line must never be edited, reordered, or removed. Fixing a
migration's behaviour after the fact means appending a new corrective `UPDATE`, not
touching the old line.

### Verify a change (headless — no device)
A full emulator isn't feasible in the remote env (no KVM/virtualization; the app is
deeply native), so verification is headless and covers the **logic/data layer** only —
not visual/gesture behavior, which still needs a real device.

> **See `TESTING.md`** for the full quality strategy — the test-pyramid layers, the
> "add a test with every helper/branch/bug fix" rule, how to write a headless store
> test, the coverage ratchet, and the CI gate (`.github/workflows/ci.yml` runs
> typecheck + lint + jest on every PR into `main`).

1. `npx tsc --noEmit` — first-pass gate. Runs & passes in the remote env now (the
   session-start hook installs deps). Also enforces i18n key parity via `no: typeof en`.
2. `scripts/test-changed.sh` — runs only the Jest suites a change affects
   (`jest --findRelatedTests` over the git diff). Full suite: `scripts/test-changed.sh --all`.
3. **Only test behavioral changes.** A pure move/rename/comment/header edit gets step 1
   only — there's nothing to re-test.
4. Test files live in `__tests__/` (+ `lib/__tests__/`); native modules are mocked
   (`__mocks__/expo-sqlite.js` is auto-applied; mock `@/lib/db` directly for store logic).
   Add a test when you add a pure helper or store logic; keep them DB-free/headless.

### Web preview for agent testing (visual/logic — not pixel-perfect native)
`EMULATOR_TESTING_SPIKE.md` / `EMULATOR_TESTING_HANDOFF.md` describe the original plan;
this is the outcome. Runs the real app as Expo Web (`react-native-web`) and drives it
headlessly with Playwright (Chromium pre-installed under `PLAYWRIGHT_BROWSERS_PATH` —
never `playwright install`) so an agent can actually *see* screens and flows without a
device or EAS build.

- **Run it:** `npm run preview` — builds (`expo export --platform web` + wires the
  sql.js fallback), serves `dist/` with COOP/COEP headers, and walks onboarding + all 5
  tabs with Playwright, screenshotting to `preview-shots/` (gitignored). Also exercises three
  real write paths — add a task (To-do), add a habit (Habits), and add a medicine + log a dose
  (Health) — each confirmed to survive a tab round-trip, proving the store→DB path actually
  works, not just static render, plus a render pass over the pushed sub-screens reachable
  without data setup (Settings, the medicine editor).
  - `npm run preview:build` / `npm run preview:serve` run the two steps standalone.
  - `node scripts/preview.mjs --route=/some/path` for a focused single-screen recheck.
- **What the preview genuinely CANNOT reach** (learned the hard way 2026-07-28 — check here
  before writing a driver script):
  - ~~**Anything behind `Alert.alert`.**~~ **Stale as of 2026-08-01 — the weekly shopping list
    IS reachable.** This entry claimed "Create a new list" opened a native Alert that
    react-native-web won't render, making `components/ShoppingRow.tsx` unreachable in the
    preview at all. That stopped being true when the app moved off native alerts:
    `app/(tabs)/shopping.tsx` uses `showAppModal` (components/AppModal.tsx), which is a plain
    in-app `<Modal>` and renders fine on web. Driven end-to-end 2026-08-01: Shop → "Create a
    new list" → "Start empty" → expand → add an item → a real `ShoppingRow` with a live
    trailing cluster. The whole app now has **zero** `Alert.alert` call sites (the last two,
    goals' delete confirms, went to `showAppModal` the same day), so nothing is blocked this
    way any more. `scripts/preview.mjs` still doesn't walk it — that's a coverage gap in the
    driver, not a limit of the preview.
  - **A multi-button `showAppModal` was unreadable on web until 2026-08-01** — worth knowing
    because it looks like a broken app rather than a rendering artifact. `AppModal`'s stacked
    (≥3 button) layout used `flex: 0`, which Yoga reads as basis `auto` and CSS reads as
    `0 1 0%`: on web every button collapsed to its padding with the label spilling over the
    fill. Native was always correct. Fixed by spelling out `flexGrow/flexShrink/flexBasis`.
    If a dialog ever looks collapsed in a screenshot again, suspect a `flex: N` shorthand
    before suspecting the dialog.
  - Onboarding button labels differ per language and are easy to get wrong — a driver script
    that hangs on `getByRole('button', …)` is usually a wrong label, not a broken app. The
    Norwegian path is: `Norsk` → `Nei, jeg er ny her` → `Skjønner →` → `Vis meg rundt` →
    `Neste →` ×N → `Kom i gang →` → `Neste →` → `Kom i gang! 🌿`.
  - Driving a **layout switch**: the header icon's accessible name is `t.config.layouts.title`
    ("How lists look" / "Hvordan lister ser ut"), and the sheet closes on **Done**, not Close.
  - Start the server with `nohup … & disown` when running a one-off script by hand —
    `(cmd &)` inherits stdout and hangs the tool call (see the "Background HTTP servers"
    gotcha below).
- **SQLite-on-web (the gating decision):** `expo-sqlite`'s web backend (wa-sqlite/WASM)
  needs a growable `SharedArrayBuffer`-backed WASM memory for its worker bridge — this
  reliably fails with `RangeError: Out of memory: Cannot allocate Wasm memory for new
  instance` in this container (`RLIMIT_MEMLOCK` fixed at 8MB, no permission to raise it —
  confirmed unfixable from app code). **Fallback in use: `sql.js`** (in-memory,
  single-threaded, no worker/shared memory). `scripts/build-web.mjs` loads it via a plain
  `<script>` bootstrap injected into `dist/index.html` that finishes BEFORE the app
  bundle's own `<script>` tag is even inserted, so `lib/sqlite.web.ts` can read the ready
  `SQL.Database` off `window.__unfocusSqlJsDb__` synchronously at module-eval time — no
  top-level-await, no queuing tricks needed. **In-memory only — no persistence across a
  full page reload/`page.goto()`.** Navigate between tabs via BottomNav clicks (client-side
  route change), not `page.goto()`, or the DB (and onboarding state) resets.
### Wrap audit — `npm run wraps` (2026-07-28)
Finds the "why is that on two lines when it nearly fits?" class of bug by measurement
instead of eyeballing. `scripts/measure-wraps.mjs` walks the same preview build and, for
every text node, forces `white-space: nowrap` to compare natural width against the box it
actually got. Reports four separate failure modes:
- **Clipped controls** (added 2026-08-01) — a NON-text element (icon button, chip, avatar)
  whose box runs past the horizontal edge of the nearest overflow-clipping ancestor, so part
  of it is physically sliced off. Added after the task editor's voice mic shipped cut in half
  at 360px (#465) and was found *by eye in a screenshot* — none of the three modes below can
  see it, since the mic has no text to wrap or truncate and its row has only two children
  (under the ≥3 that wrapped-rows needs). Two filters keep it honest, and don't remove
  either: anything inside an `<svg>` is skipped (the backdrop motifs are *supposed* to bleed
  past their mask), and a child WIDER than its clipper is skipped as a sliding track (the tab
  pager is 1800px of five screens in a 360px window — being clipped is the design). What's
  left is the real shape of the bug: something that would fit comfortably, shoved out anyway.
- **Near-miss wrapped text** — `+Npx` = how much more width would collapse it to one line.
  A small N means the *container* is the problem, not the copy.
- **Truncated single-line text** — how tabs/chips fail instead of wrapping. **⚠️ Confirm
  these on a device**: react-native-web implements neither `adjustsFontSizeToFit` nor
  `minimumFontScale`, so an auto-shrinking label (BottomNav's "Handleliste") is reported
  here but is fine natively. Wrapped text and wrapped rows ARE faithful on web.
- **Wrapped control rows** — a horizontal row (Mon–Sun weekday chips, a tab bar) whose
  children spill to a second line. These can't be fixed by shortening copy; the row has a
  hard minimum width. Rows are only reported when the children genuinely need more width
  than the row has — absolutely-positioned children (BottomNav's sliding pill) are excluded
  because they sit at their own `top` and otherwise fake a wrap on every single-line row.

`npm run wraps -- --lang=no --width=360` (also `--json`). **Always check Norwegian** — it
ran ~7x more near-misses than English at the same width (28 vs 4 instances at 393px) before
the 2026-07-28 pass. Widths worth checking: 430 (Pro Max), 393 (iPhone 15/Pixel 8), 360
(small Android), and 327 as a proxy for the `large` font setting (1.2x) at 393. Set
`FORCE_BUILD=1` to rebuild `dist/` first; otherwise it reuses the existing bundle.

**Coverage — and its one big hole, now half-closed.** The walk measures onboarding, the tour
card, all five tabs, Settings, and (2026-08-01) the **task editor**, which it reaches by
creating a task and tapping it — a fresh profile has none. Until then the audit had never
opened an editor or a pushed sub-screen *at all*, so the app's densest forms were the one
place it couldn't see, which is exactly where the mic bug lived. **`--lang=en` was also
broken outright** until the same pass: it waited on a "Language: English." radio that never
exists, because Basics renders in Norwegian until that very row is tapped. Both are worth
knowing before trusting a clean run — a mode this audit doesn't walk is not a mode it
passes. When you add a surface with tight horizontal pressure, add a step for it.

The task editor's own `--width=327` findings (Energy stepper, add-step button,
Delete·Discard·Save) were **fixed** the same day; the audit is clean at 327/360/393/430 in
both languages. Three different causes, and the fix depended on which:
- a flex row whose input wouldn't shrink → `flex: 1` **plus `minWidth: 0`** (`titleInput`,
  `addStepInput`). `flex: 1` alone does nothing here — see the note in `components/TaskCard.tsx`.
- a label competing with a fixed-size control → let the **label** yield (`flex: 1` +
  `minWidth: 0` on the label side, `flexShrink` on its Text), never the stepper, which has
  no width to give.
- three labelled buttons that genuinely don't fit → **wrap the row** (`flexWrap` + `rowGap`,
  `marginLeft: 'auto'` to keep the right-hand cluster right-aligned once it wraps). This is
  the audit's own "cannot be fixed by shortening copy" case; shrinking further would have
  truncated the words off the confirm/discard buttons.

Two structural lessons from that pass, worth not re-learning: horizontal chrome **stacks**
(three nested 16px paddings plus an icon gutter left text 306 of 393px, and onboarding's
`Spacing.xl` screen padding left one card just 238px — 40% of the screen); and a control
row built from `minWidth` + `flexWrap` has a hard floor that silently breaks on smaller
phones (7 chips x 40 + 6 x 4 gap = 304px, vs ~295px available at 360px). Prefer `flex: 1`
children with no minWidth, the way `components/TaskCard.tsx`'s `weekdayChip` always has.

- **The `.web` sibling pattern** (Metro resolves `file.web.ts(x)` over `file.ts(x)` on
  web — no `Platform.OS` branches in native files): `lib/sqlite.ts`/`lib/sqlite.web.ts`
  (DB handle), `lib/lanTransport.web.ts` (LAN sync stub — `isTransportAvailable()` false),
  `lib/widgets/sync.web.ts` (Android widgets no-op), `app/(tabs)/scan.web.tsx` (OCR
  placeholder screen — `@react-native-ml-kit/text-recognition` has no web build).
  `metro.config.js` adds `.wasm` to `resolver.assetExts` (harmless leftover from the
  rejected wa-sqlite path; costs nothing to keep).
- **Not pixel-perfect native.** react-native-web renders layout/navigation/store logic
  faithfully but differs from native in shadows/elevation, some font metrics, and
  Reanimated timing. Use this for "does the flow/logic work," not final visual sign-off —
  that still goes through a device/EAS build.

## Known gotchas

- **⚠️ Background HTTP servers that inherit stdout hang the whole shell/tool call — this is why "the task just keeps running" (root-caused 2026-07-27).**
  `npm run preview` used to be `npm run preview:build && (npm run preview:serve &) && sleep 1 && node scripts/preview.mjs`.
  `(cmd &)` backgrounds `serve-web.mjs` — a static HTTP server that runs forever — but does
  **not** redirect its stdout/stderr, so it keeps inheriting the same fd as the invoking
  shell. `preview.mjs` (the actual test) finishes in under a minute, but the server keeps
  that fd open forever. Any caller that waits for the output stream to reach EOF before
  it considers the command "done" — a `| tail`/`| tee` pipe, or an agent harness capturing
  a command's output through a pipe/file — blocks **indefinitely**, even though the real
  work is long since finished. Reproduced directly in an agent session: `npm run preview
  2>&1 | tail -60` sat past its 5-minute timeout with `preview.mjs` and Chromium already
  exited — `ps aux` showed only the orphaned `node scripts/serve-web.mjs` still alive,
  holding the pipe's write end (`ls -la /proc/<pid>/fd` confirmed fd 1/2 pointed at the
  same output file the wrapper was reading). Killing that one process let the "hung"
  command complete instantly. It also meant a second `npm run preview` in the same
  session hit `EADDRINUSE` and silently served the *first* run's stale `dist/`.
  **Fixed** in `scripts/run-preview.sh` (now what `npm run preview` calls): the server's
  stdout/stderr are redirected to a log file (`/tmp/unfocus-preview-serve.log`), its PID
  is captured, and a `trap ... EXIT` kills it once `preview.mjs` returns — so the fd never
  leaks and nothing lingers for the next run.
  **The general lesson, not just for this script**: never background a long-lived process
  (`cmd &`, `(cmd &)`, a dev server, a watcher) without redirecting its stdout/stderr away
  from the shell you (or a pipe/tool) are waiting on (`cmd > /tmp/x.log 2>&1 &`), and kill
  it explicitly when you're done with it (capture `$!`, `trap ... EXIT`, or `run_in_background`
  + an explicit stop). A command that "won't finish" after its real work is visibly done is
  almost always an orphaned child still holding a pipe/fd open, not a genuine infinite loop —
  check `ps aux` for a stray `node`/server process before assuming the tool itself hung.
- **`StyleSheet.absoluteFill`** (not `.absoluteFillObject`) for full-screen overlays
- `useT()` depends on `useSettingsStore`, so it re-renders when language changes — this is intentional. Outside components (stores, schedulers) use `getTranslations(lang?)` instead — it reads the current language from the store when no arg is given.
- The scan uses on-device OCR via `@react-native-ml-kit/text-recognition` (`parseReceiptText` in `app/scan.tsx`). Confirmed items are added to the shopping list, logged to `purchase_log`, and upserted into the `store_items` catalog (powers shopping autocomplete).
- `BottomNav` labels read from `t.nav` — add new entries there when adding a tab.
- `completedCount` in `useTaskStore` counts all-time done tasks (intentional — cumulative "small things add up" philosophy)
- `backlogTasks(today)` only returns non-recurring tasks; recurring tasks reappear by date schedule
- **Notifications**: `lib/notifications.ts` only takes already-localised content. Medicine tray reminders live in `lib/medicineNotifications.ts` (one daily reminder per tray, re-synced from `store/useMedicineStore.ts` on every mutation; quiet hours SKIP a tray like habits, never shift it) — and note its "decide first, then cancel only what isn't being rescheduled" rule: a blanket cancel-then-schedule races with `scheduleDailyReminder`'s own internal cancel and can silently un-schedule what it just armed. Per-task reminders live in `useTaskStore` and cover both kinds — one-off tasks fire once (skipped if done/past), weekly-recurring tasks fire on every selected weekday (via `scheduleWeeklyTaskNotifications`); time-box tasks also get an "end" reminder. Habit daily reminders in `useHabitStore`; weekly/monthly reminders in `lib/reminders.ts` (`syncReminders`). `settings.tsx` re-syncs on relevant changes; `_layout.tsx` and onboarding step 6 sync on startup/finish.
- **Retention**: `pruneOldData()` in `lib/db.ts` trims dated history to the last `RETENTION_DAYS` (365) on startup; config tables are left untouched.
- **Materials (frost + wash + glow, 2026-07-18)**: `getMaterialStyle()` in `constants/theme.ts` computes the glass surface finish from a single base colour — a translucent tinted `backgroundColor` wash plus a calm border, consumed by `components/GlassFill.tsx` (≤2 render layers: an optional `BlurView` frost for overlay/chrome contexts, then the colour wash; ambient content cards get no `BlurView` at all). Rendered via a two-layer view (outer = border + `getLayeredShadow`, inner `overflow:'hidden'` mask = the fill) so shadows aren't clipped. There is no `bubbleMaterial` metal/rock/paper/stone finish system — that never existed in code, only in earlier prose; `settings.glassSurfaces` (reduce-transparency a11y toggle) is the only material-related setting. Purposeful active/focus glow is a separate, sparingly-applied halo — `getGlow(color, level)` — not part of the material itself.
- **Animation, button-press, and haptics**: read `ANIMATION_GUIDELINES.md` (repo root) before writing or editing any of these — it has the real timing/easing/spring values and the `lib/haptics.ts` contract this codebase actually uses. Paste its §8 block at the top of any animation/interaction/haptics prompt.
- **Biometric authentication**: `expo-local-authentication` is already in `package.json` and `app.json`'s `plugins` array (Decision 040, reserve-only — module ships in the build, no feature code uses it yet). Once the maintainer cuts the build with this dependency, the lock/unlock UI can ship as a normal OTA change — no further native work needed for that feature. See `REBUILD_DECISIONS.md` Decision 040 and `REBUILD_PLAN.md` §1 for the rest of the reserve-only native surface (`expo-location`, `expo-calendar`, `expo-contacts`, `expo-sensors`, `expo-speech-recognition`) that's ready the same way.
- **Debug notes (2026-07-13)**: `settings.debugModeEnabled` turns on long-press-to-annotate — `components/DebugNoteAnchor.tsx` wraps a card/header; holding it opens a text note, saved notes show a small bubble badge (tap to edit, clear the text to delete). Currently wired onto every screen's header title (`components/ScreenHeader.tsx`) and Home's cards (`app/(tabs)/index.tsx`); wrap more screens' cards the same way as needed. `store/useFeedbackStore.ts` owns the data (table `feedback_notes`); export (Share sheet, top header icon) and "Reset all notes" (Settings → Data, same card as the toggle) both read/clear that store. Replaced the old flat DebugOverlay panel (deleted).
- **OTA "update available" indicator**: Home's header (`components/ScreenHeader.tsx`, gated on `isHome`) checks `expo-updates` on mount and on every app-foreground and shows a small cloud icon when an update is ready — tapping it fetches and reloads. Silent no-op in dev/debug builds (`Updates.isEnabled` is false there). This is a convenience wrapper around the same `Updates.checkForUpdateAsync`/`fetchUpdateAsync`/`reloadAsync` flow Settings → Version & updates already exposes manually.

## Current deployment state

- **UnFocus is the sole source of all live builds** (see the repo-status banner at
  the top of this file). The retired `All-the-small-things` repo is never a build
  target; its runtime/OTA rules are dead.
- OTA updates always publish to the EAS `preview` channel, and target whatever
  `runtimeVersion` is set in `app.json`. A given OTA is only picked up by an
  installed build whose runtime matches.
- **Native builds: the EAS preview-APK workflow is agent-triggerable; the
  production/TestFlight/signing paths are not.** When native surface changes (new
  package, plugin, permission, or an `app.json`/`eas.json` build-config change),
  land the config on `main`, bump `runtimeVersion`/`version` in the same or a
  follow-up commit, merge, then trigger **`.github/workflows/eas-build-android.yml`**
  ("EAS Build Android (Preview APK)") yourself — see "New preview APK build"
  below. It's fully non-interactive (a stored `EXPO_TOKEN` secret; the one-time
  `eas login` keystore setup already happened), it's been run this way dozens of
  times (history: `gh run list -w eas-build-android.yml`), and it's the *only*
  build that actually receives OTA (a debug APK from `build-android.yml` does
  not — see PUBLISHING.md). What stays maintainer-only: the local debug-gradle
  `build-android.yml` (rarely useful — no OTA), the production Play Store AAB, and
  TestFlight/iOS — all three touch real signing credentials or store submission
  that need an interactive `eas login`/`eas credentials` session or Apple/Play
  Console setup, not just a workflow_dispatch call.

## Builds and updates

### OTA updates (normal flow)
- **⚠️ PUBLISH = MERGE TO `main`, and you ALWAYS do it.** Standing rule: every change finishes with a PR from the `claude/**` branch into `main` that you merge yourself — automatically, without being asked, and without handing the merge back to the user. Pushing the branch is only step 1. Full step-by-step: `PUBLISHING.md`.
- Workflow: `.github/workflows/update.yml` — triggers on every push to `main` only (deliberately NOT on `claude/**` branches — parallel session branches all publishing to the one shared `preview` channel caused a real incident where a later, older-tree push silently clobbered a newer one; see git history around June 2026). Push your branch and merge into `main` to publish.
- Runs `eas update --branch preview --message "..."` — always publishes to EAS branch `preview`
- Runtime version is read from `runtimeVersion` in `app.json` — an OTA reaches only installs whose runtime matches that value
- Apps pick it up automatically on next launch — no download needed
- Takes ~1–2 min on CI

### New preview APK build (the actual go-to path — agent-triggerable)
- Workflow: `.github/workflows/eas-build-android.yml` ("EAS Build Android (Preview
  APK)") — `workflow_dispatch`, **triggerable directly from an agent session, no
  need to ask first** (see the bullet above for why: non-interactive, stored
  `EXPO_TOKEN`, dozens of prior runs). Runs `eas build --platform android --profile
  preview --non-interactive --wait`, i.e. `eas.json`'s `preview` profile:
  `channel: preview` (same channel `update.yml` publishes OTA to), `distribution:
  internal` (installs from a link/QR, no Play Store), `buildType: apk`.
- **Sequencing — bump *before* triggering, not after:** land the native config
  change AND the `version`/`runtimeVersion` bump together (same PR or a same-session
  follow-up), merge to `main`, **then immediately** trigger this workflow from
  `main`. The build reads `app.json` at build time, so it must already have the new
  runtime baked in — this is the opposite order from the old debug-build guidance
  below. Because the bump-merge-trigger happens back-to-back in one session, the
  "phantom runtime with no matching build yet" window the old sequencing worried
  about (see "Runtime version") is seconds, not days.
- Use when: new native package added, `app.json` plugin changed, `eas.json` build
  config changed — same triggers as any native-surface change.
- Result: an **OTA-capable, release-signed** APK — this is the build real users/
  testers should actually install (see PUBLISHING.md "Test builds that actually
  receive OTA"). Download link/QR is on the run's step summary and the printed
  `expo.dev` build page.
- Takes ~15–25 min on CI (`--wait` blocks until the EAS cloud build finishes, not
  just until the workflow dispatches it).
- Trigger via `gh workflow run eas-build-android.yml --ref main -f message="..."`
  or the GitHub MCP `actions_run_trigger` tool (`method: run_workflow`,
  `workflow_id: eas-build-android.yml`, `ref: main`).

### Debug local-gradle APK (rarely useful — does NOT receive OTA)
- Workflow: `.github/workflows/build-android.yml` — **manual trigger only** (`workflow_dispatch`), and **maintainer-run** (no established agent-triggered precedent for this one, unlike the EAS preview workflow above)
- Runs `npx expo prebuild` + a local `./gradlew assembleDebug` on the runner — this is a debug-signed APK with `expo-updates` disabled, downloadable from the **GitHub Actions run's Artifacts** (not expo.dev; this workflow never calls EAS Build). **It never receives OTA updates** (see PUBLISHING.md) — don't distribute it as a test build. Its only real use is a quick "does it even compile natively" sanity check.
- Takes ~20–30 min on CI

### iOS build → TestFlight (EAS)
- Workflow: `.github/workflows/eas-build-ios.yml` — **manual trigger only** (`workflow_dispatch`, maintainer-run). Runs `eas build --platform ios --profile testflight` and then (unless the `submit` input is off) `eas submit --platform ios --profile testflight --latest`.
- **The `testflight` profile** (`eas.json`) is `distribution: store` + `channel: preview` + `autoIncrement: true`. Store distribution is what TestFlight requires; pinning the **`preview` channel** keeps iOS on the *same OTA stream as Android* (`update.yml` publishes to `preview`), so JS/UI changes reach iOS testers via OTA exactly like Android. The older ad-hoc `preview` profile (`distribution: internal`) is still there for UDID-registered device installs, but TestFlight is the beta path.
- **One-time prerequisites, maintainer-run** (interactive, NOT from an agent session):
  1. Apple Developer Program membership.
  2. App record in App Store Connect (bundle id `com.freyrnorpixel.unfocus`).
  3. `eas credentials -p ios --profile testflight` → distribution cert + provisioning profile on the EAS project.
  4. Add **`ios.appleTeamId`** to `app.json` (Apple Developer Team ID) — `@bacons/apple-targets` warns and iOS builds can fail without it.
  5. For auto-submit: App Store Connect **API key** — save the `.p8`, set the repo secret `ASC_API_KEY_P8`, and fill the `submit.testflight.ios` placeholders in `eas.json` (`ascApiKeyId` / `ascApiKeyIssuerId` / `appleTeamId` / `ascAppId`). Until then, run the workflow with `submit` off and submit manually.
  6. Fill TestFlight "Test Information" in App Store Connect (contact, "what to test", export-compliance answer) — required for the first build's light beta review.
- **How testers install it**: Apple TestFlight app → accept an email invite or a public TestFlight link → Install. No UDID registration, no cables. OTA JS updates then flow automatically (same runtime/channel rules as Android).
- **iOS-readiness is verified** at the config-plugin level: `npx expo prebuild -p ios --no-install` succeeds, and the cross-platform native deps that matter for parity have real iOS podspecs — `react-native-tcp-socket` + `react-native-zeroconf` (LAN sync) and `@react-native-ml-kit/text-recognition` (receipt OCR; pulls `GoogleMLKit/TextRecognition` 8.0.0 pods — the heaviest first-build dependency). `react-native-android-widget` has **no iOS podspec** (cleanly skipped on iOS) and its JS calls are `Platform.OS`-guarded + lazy-required in `lib/widgets/sync.ts`, so they no-op on iOS.
- iOS home-screen widgets are **not yet implemented** — `@bacons/apple-targets` is installed and registered as a plugin, and the `group.com.freyrnorpixel.unfocus` App Group entitlement is declared (Decision Q3, `REBUILD_DECISIONS.md`), but no actual WidgetKit/SwiftUI target exists yet (no `expo-target.config` / `targets/` dir). That's scaffolding only; the first iOS beta ships without widgets. Building the real widget UI is a separate, larger task requiring Xcode to verify.
- **Other iOS behavioural differences (not crashes)**: the persistent "today's overview" notification is a normal notification on iOS (no Android-style ongoing/sticky notification); iOS background refresh (`expo-background-task`) is more restricted than Android, so widget/notification refresh cadence differs; LAN sync triggers the iOS local-network permission prompt (`NSLocalNetworkUsageDescription`, already declared).

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
- **Two different sequencing rules, depending on which build path you're using** — don't mix them up:
  1. **EAS preview-APK path (`eas-build-android.yml`, agent-triggerable, the normal case):**
     bump `runtimeVersion`/`version` in `app.json` FIRST (same PR as the native config
     change, or immediately after), merge to `main`, **then immediately** trigger the
     workflow from `main` — see "New preview APK build" above. The build reads
     `app.json` at build time, so the bump has to land before the build runs, not
     after. Precedent: PR #210 (2026-07-16) bumped `runtimeVersion`/`version` 1.3.0→1.4.0
     in the same commit that added the native splash/expo-image work, merged, then
     the EAS build ran one minute later off that commit.
  2. **Debug-gradle / production AAB / TestFlight paths (maintainer-run, build timing
     unknown/delayed):** land the native config change on `main` with `runtimeVersion`
     **unchanged** first — the current preview build keeps receiving OTA updates while
     you wait an indeterminate amount of time for the maintainer to get to it. Only
     once that build actually exists do you bump `runtimeVersion` (and usually
     `version`) to match it. Bumping ahead of an uncertain, possibly-days-away build
     publishes OTA updates to a runtime nothing is installed on yet — this is the
     scenario the "never bump ahead of the build" caution is about.
- The distinguishing question: is the build going to happen in the next few minutes
  from a commit you control (path 1), or at some indeterminate later point from a
  human (path 2)? Pick the matching order.

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
