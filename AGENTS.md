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

**UnFocus** — ADHD life-management app (React Native / Expo SDK 56, TypeScript, Expo Router, Zustand + SQLite). Local-only, no backend. Norwegian-first, and fully translated into English and **Icelandic** (added 2026-08-15). Target: iOS + Android.

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
| All strings through `useT()` from `lib/i18n.ts` | Multilingual app (EN/NO/IS) — never hardcode UI text. `no` and `is` are both typed `typeof en`, so a missing key is a compile error |
| Date format is always `YYYY-MM-DD` strings | Used as keys throughout the stores |
| `todayStr()` / `dateStr(d)` from `lib/date.ts` | Shared helpers — do not re-implement locally |
| SQLite file name: `unfocus.db` | Set in `lib/db.ts` |
| New DB columns: `ALTER TABLE … ADD COLUMN` in migrations array | Runs once on upgrade; never drop or recreate tables |
| Stores read/write rows via `lib/dataAccess.ts` (`loadFirst`/`loadAll`/`updateRow` + `FieldMap`) | Used by **all 21** stores — there is no outlier (this line said "13 of 14" until 2026-08-12; both halves were stale). `useSettingsStore` is the odd shape rather than the exception: one row, so `loadFirst` + partial `updateRow` and no `insertRow`/`add`/`remove`. Don't hand-roll row mapping in a new store |
| **A by-id `update`/`remove` goes through `lib/storeCrud.ts`** (`updateById`/`deleteById` + `replaceById`/`withoutId`) | One rung above dataAccess: the store's own shape, an array of rows with a string id mirrored into SQLite. The guard is why it's shared, not the lines — `update(id, patch)` must be a **complete** no-op for an id the store doesn't hold, and 2 of the 10 hand-rolled copies never checked, so a stale id still re-rendered every subscriber and still ran the action's tail (for medicines, a cancel-and-re-arm of all four tray reminders). Hard deletes only — tombstones and cascading deletes stay explicit. `__tests__/storeUpdateGuard.test.ts` + `lib/__tests__/storeCrud.test.ts` |
| **Any screen or visual change is checked against `DESIGN_RULES.md`** | **33** numbered invariants. §1–7 are values (spacing, placement, colour, hierarchy, tap targets, motion, copy tone); **§8 "Component identity" (26–33, added 2026-08-21) is which COMPONENT owns a thing** — the field, the card header, the fold control, the card's granularity, a repeated glyph's meaning and place. §8 exists because a maintainer audit found sixteen recurring defects in exactly that gap (`CONSISTENCY_AUDIT.md`): the values were all correct and every surface still hand-rolled its own field and its own header. Six of the rules are CI-enforced — tap targets/motion (`designTokens`), palette contrast (`colors`), copy tone (`copyTone`), screen rhythm (`screenRhythm`), and the two new scans `fieldAnatomy` + `cardAnatomy`. **Eight rules have open conflicts with shipped decisions and are NOT binding yet** — read the audit before "fixing" one: `DESIGN_RULES_AUDIT.md`. Tap targets go through `MIN_TAP_TARGET`/`HitSlop`, motion through `Duration.*` — never a bare `48`/`44`/`hitSlop: 8`/`duration: 220`. **`MIN_TAP_TARGET` is 48 as of 2026-08-08** (Material Design 3, up from WCAG's 44 — the one thing taken from MD3; its *look* is deliberately not adopted). `lib/designLab.ts`'s `MIN_TAP_TARGET_FLOOR` stays 44 on purpose — the accessibility floor the lab may tune down to, not the app's default |
| Copy tone is `DESIGN_RULES.md` §7 (rules 22–25); `VOICE.md` records the ONE deliberate exception | The day log's empty state is the app's only first-person line. `VOICE.md` says why it is allowed, and why there is not a second — read it before "correcting" that string, and before adding any first-person copy of your own |
| **Every destructive confirm goes through `confirmDestructive()`** (`components/AppModal.tsx`) | A delete/reset/restore dialog is Cancel + one red button, `warning()` on open and `heavy()` on confirm (ANIMATION_GUIDELINES.md §5). It was hand-rolled at 16 sites until 2026-08-12 and the haptics had drifted at 13 of them — invisible to tsc, to a screenshot and to the web preview, which has no haptics at all. Not for a ⋯ menu that happens to contain a red row, and not for a choice whose red button is one of two ways forward (Shopping's Save-or-discard); `lib/__tests__/destructiveConfirm.test.ts` tells them apart by button COUNT and names both exceptions |
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
2026-08-01; neither export has ever existed. See `docs/archive/DESIGN_SYSTEM_LIBRARY_INDEX.md` for which
file owns which token.)

- **Navigation**: file-based Expo Router. Primary nav is `components/BottomNav.tsx` — **five tabs since 2026-08-22**: Shop · To-do · **Home (CENTRE)** · Habits · Health (`Handle` · `Gjøremål` · `Hjem` · `Vaner` · `Helse`). The real `<TopTabs.Screen>` order is in `app/(tabs)/_layout.tsx`; a prose ordering here was once wrong for months and building against it put every tab's backdrop panel on its neighbour, so **trust the navigator, not this line**. Maintainer: *"The logic was sound before. 'Home' had easy access to todays tasks, Notes, and shopping. I think 5 screens might be needed again, so we can split at least into Shopping, To-do, Home, Habits and Health."*
  - **This REVERSES both the 2026-08-20 5→3 merge and the 2026-08-19 "To-do to the middle, Home becomes Meg" pass**, which rested on one argument — *a preview card for a neighbouring tab is a second, shorter copy of that tab*. It is **overruled for Home's three cards** (seeing three surfaces at once without swiping to any of them is what a hub is FOR) and **kept for Habits and Health** (a card AND a tab for one surface is the duplication worth avoiding). Full lineage: Shopping/Plans/Home/Habits/Health (Decision 036) → Shopping/Home/Health (5→3 merge) → Shopping/Home/To-do → Shopping/To-do/Home → **this, which is Decision 036 again**.
  - **Home is 3 cards: Today, Notes, Shopping** (`lib/homeCards.ts`'s `HOME_CARD_KINDS` = `['plans','notes','shopping']`), and they are the app's only three `openAtRest` cards — so the maintainer's rule *"All card start in closed state, except 'Today' 'Notes' and 'Shopping' in middle screen"* is now literally true rather than approximately. `sanitizeHomeCardOrder()` FILTERS the three departed kinds and REPAIRS a legacy row by appending the two returning ones; a `lib/db.ts` migration additionally empties `home_card_order` and `collapsed_cards`, because appending would land Today and Shopping *after* Notes. ⚠️ **That append is scoped to rows naming a `LEGACY_KIND` since 2026-08-23, and the scoping is the fix for a real bug.** It ran on EVERY order — inherited from 2026-08-20, when the list held `habits`/`health`/`medicine`, cards with no other surface in the app, where "it comes back" was the deliberate trade. Every kind here previews a TAB now, so the unconditional append meant the ⋮ menu's **Hide** on Today or Shopping wrote an order the next read undid: the card reappeared at the BOTTOM of Home instead of in the Retired shelf, i.e. two of the three cards had a menu row that visibly did the wrong thing. The rule to carry forward is that *put it back* and *leave it where the user put it* are two questions, and the answer turns on whether the kind has another home — not on the kind's name. `components/HomeShoppingCard.tsx` is restored (from `7ad9e9d^`) and now goes through `components/Card.tsx`; `HomeHabitsCard.tsx` and `HomeHealthCard.tsx` are **deleted** — their content is `HabitsSurface`/`HealthSurface`, mounted by a screen.
  - ⚠️ **`'home'` is still the KEY and `/` is still the route.** Only the label, the icon and the position have ever moved. Because `/` is the CENTRE tab again, `START_TAB_ROUTE_PATH` (`lib/siteNav.ts`) is `/` — but for the opposite reason it used to be: not because `settings.startScreen` says so (still inert, still no picker), but because the centre tab happens to be Home. The cold-start redirect in `app/_layout.tsx` is now a no-op and is kept deliberately.
  - **`app/habits.tsx` and `app/health.tsx` moved into `app/(tabs)/`** as thin `tier="site"` `ScreenScaffold` wrappers around `HabitsSurface`/`HealthSurface` — the same shape `app/(tabs)/plans.tsx` has around `TodoSurface`. Those surfaces exist BECAUSE of the merge (they were extracted when the tabs were folded away), which is most of why restoring the tabs cost so little. **Medicine moved to the Health tab** as a peer card (`components/MedicineCard.tsx`, was `HomeMedicineCard`), never inside Health's own `Surface`.
  - ⚠️ **The 2026-07-23 E1 finding is live again**: Habits once lived INSIDE the Health tab and had to be split back out, because a tab whose name promised symptom tracking hid a whole habit system. Don't fold either into the other for tidiness. Medicine on Health is not that case — it is health, and it is a visible peer card.
  - The backdrop strip is **1950×844 / 5 panels** again (`scripts/author-screen-bgs.mjs`; `PANELS` and the 11-waypoint `SPINE_Y` are the pre-merge values verbatim). Regenerate with that script then `scripts/build-motifs.mjs`; `lib/__tests__/motifs.test.ts` pins panel order against the navigator.
  - **`nav.home` and `nav.health` both read "Me"** from 2026-08-19 to 2026-08-22 and now name their own surfaces. Two nav entries sharing one word was survivable only while one of them was off the bar.

  *History below this line describes the 3-tab era and is kept for its reasoning, not as current state.* Home was **4 cards**: Habits, Notes, Health, **Medicine** (`lib/homeCards.ts`'s
`HOME_CARD_KINDS`). Medicine joined on 2026-08-21 (`CONSISTENCY_AUDIT.md` §11, maintainer: *"Yes."*)
— it had been a full `Surface` drawn INSIDE `HomeHealthCard`'s `Surface`, the card-in-a-card the
blueprint pass banned. It is the one kind behind a feature flag (`featureMedicine`), gated at the
render site so the stored order keeps it while the flag is off. **'plans' and 'shopping' were DROPPED from it in the same pass** — each is a whole tab one swipe away, so a preview card for either was a shorter second copy of a neighbouring tab, and `components/HomeShoppingCard.tsx` was deleted with the card (its only mount site). `sanitizeHomeCardOrder()` handles a stored order on READ: unknown kinds are filtered (which is all a removal ever needs), while `habits` and `health` are APPENDED whenever missing, because neither has anywhere else to be — the consequence, worth knowing before debugging a card that "comes back", is that those two cannot be permanently hidden. History this replaced: five tabs → three on 2026-08-20 (To-do and Habits folded onto Home), then the same-day "full-screen card expansion" pass, which made To-do a real tab again (`app/(tabs)/plans.tsx`, a thin `ScreenScaffold` wrapper mounting `components/TodoSurface.tsx`), restored Habits as a first-class card, and took **Health off the bottom nav entirely** — it is a card now (`components/HomeHealthCard.tsx` mounting `components/HealthSurface.tsx` `embedded`; `app/health.tsx` survives only as a back-compat pushed route nothing in the UI links to). Energy deliberately did NOT move to Health: it is a planning budget computed from tasks and habits, and Health's stated contract is that nothing on it is a scoreboard — it stays a fixed strip on Me. Notes and Food/Meals are NOT tabs — reached via Me's Notes card and Shopping's Food section. Scan is also not a tab — it's a pushed sub-screen (`app/scan.tsx`) reached via a "Scan" button on Shopping's header; its idle screen still offers both receipt OCR and QR import. A radial-FAB `BubbleMenu` was planned in the pre-rebuild spec but was **dropped** (Decision 008 #5) before ever being ported — `components/BubbleMenu.tsx` does not exist in this repo; don't hunt for it or treat it as disabled-but-present code.
  - **Cards expand to fill the screen IN PLACE, instead of pushing a route** — the mechanism
    this same pass introduced (`lib/expandableCards.ts` + `components/CardExpandHost.tsx` +
    `components/CardExpandButton.tsx` + `lib/useCardExpand.ts`), mirroring
    `components/AppModal.tsx`'s imperative-API shape: `expandCard(id, rect)`/`collapseCard()`
    are plain exported functions (a module-level listener, no context/provider), and
    `useCardExpand(id)` is what a card actually calls — it hands back a `ref` for the card's
    OUTERMOST View (measure a wrong box otherwise), an `onExpand` that `measureInWindow`s that
    ref and calls `expandCard`, and `expanded`/`onCollapse` for a `CardExpandButton` in the
    card's header. `CardExpandHost` is mounted ONCE, in `app/_layout.tsx` beside
    `<AppModalHost/>` — a single overlay, `zIndex: 100`, that every expandable card shares.
    `lib/expandableCards.ts`'s `EXPANDABLE_CARD_IDS` is the one list to keep in step with
    `CardExpandHost`'s own `CARD_BODIES` registry — `lib/__tests__/expandableCards.test.ts`
    asserts they match. **Ten ids today** (2026-08-21): two Shop cards (`shopDishes`/
    `shopCatalogue`), Me's four (`homeHabits`/`homeNotes`/`homeHealth`/`homeMedicine`), and To-do's
    four (`todoWhenever`/`todoToday`/`todoWeek`/`todoRecurring`). `shopLists` left and `homeMedicine`
    arrived in the same pass — see below and the Medicine bullet. **`homeTodo` and `homeShopping`
    were removed on 2026-08-19** — their cards left the Me tab, and an id whose card does not
    exist keeps a `CARD_BODIES` entry alive that nothing can reach while the test that pins the
    two lists together goes on passing over it.
    **`shopLists` is GONE from `EXPANDABLE_CARD_IDS` as of 2026-08-21** — declined, not deferred:
    Shopping's lists are the Shop tab's primary content, so a full-screen copy of them is a second
    rendering of the screen you are already on. What that group needed was a way to be put AWAY,
    which `lib/collapsedCards.ts`'s `shopLists` fold now gives it (same string, different axis).
    `ComingSoonBody` is deleted with it, so there are no placeholder bodies left, and
    `lib/__tests__/expandableCards.test.ts` fails on a new one and on any id with no
    `useCardExpand` caller. The paragraph that follows is the reasoning that made it a gap:
    `app/(tabs)/shopping.tsx`'s Weekly/Monthly list content is ~2000 lines of window-coordinate
    drag/merge state and flight-animation refs, none of which any headless harness here can
    exercise, so it has no standalone surface component the way To-do/Health/Notes do. Its
    `CardExpandHost` entry stays a `ComingSoonBody` with **no `CardExpandButton` wired to it
    anywhere in the UI** — unreachable rather than shipping a button that opens a stub.
    **`homeHabits` was fixed rather than documented**: `components/HabitsSurface.tsx` was
    extracted out of `app/habits.tsx` (which is now a thin `ScreenScaffold` wrapper, same shape
    as `app/(tabs)/plans.tsx` around `TodoSurface`), the registry entry mounts it `embedded`,
    and `components/HomeHabitsCard.tsx` draws a real `CardExpandButton` again — it had shipped
    one from 2026-08-20 until 2026-08-19, when the stub behind it stopped being easy to miss on
    a three-card Me tab. The maintainer's call on the split: extract Habits, leave Shopping.
    A future pass can do `ShoppingListsSurface.tsx` the same way.
    The underlying card stays mounted (not unmounted) behind the opaque overlay while expanded
    — `useCardExpand`'s `expanded` flag exists for a caller that wants to skip its own heavy
    content in that state, but nothing does yet; know this if you ever see a control's own
    match count double while a card is expanded (Home's preview card and the expanded pane's
    copy both exist in the DOM at once).
  - **The `embedded` prop convention (established by `FoodTab`/`CatalogueTab`) is how the same
    content mounts both as a full tab/screen and inside another card's expansion**:
    `components/TodoSurface.tsx`, `components/HealthSurface.tsx` and `components/NotesSurface.tsx`
    all follow it — unwrap only the chrome that assumes a screen backdrop (own `Surface`, own
    ⓘ `HintCard`), never the content or its own scrolling. `TodoSurface` additionally takes a
    `section?: 'whenever' | 'today' | 'week' | 'recurring'` prop for the single-card expansions
    (render just that one card's content) versus `full` mode (all four, mounted by the tab
    wrapper) — the Goals drawer and the washed-away/earlier-days drawers are gated on `full`
    only, since they're chrome for the whole tab, not any one card.
  - **Shop's Food and Catalogue are always-open peer `SectionCard`s now, not fold-away
    `CollapsedSection` drawers** — `app/(tabs)/shopping.tsx`'s `foodCatalogueLinks` mounts the
    real `FoodTab`/`CatalogueTab` unconditionally (same `embedded` idea) with a
    `CardExpandButton` in each card's header rather than a chevron toggle.
  - **The To-do tab dropped its Today/This week/All tasks `TabSlider`** for four
    always-visible, independently-expandable cards — Whenever, Today, Week (new — Mon–Sun,
    `t.todoWeekTitle`), Recurring — each its own `SectionCard` stack in `TodoSurface.tsx`. A
    "New task" `InlineTaskAdd` composer exists on more than one of these cards (each day of the
    Week card gets its own), all sharing the literal placeholder/label `t.newTask` — a script
    driving this tab by role+name alone needs to disambiguate by position, not assume `.first()`
    is the Whenever composer (see `scripts/measure-wraps.mjs`'s To-do pass for the walk that
    found this the hard way).
- **⚠️ A `useRef` read from inside a worklet is FROZEN at its first value — the dead-pane bug
  (2026-08-19, `components/CardExpandHost.tsx` + `components/AppModal.tsx`, pinned by
  `__tests__/workletSafety.test.ts`).** User report: *"Full screen bug that happens when you go
  full screen, and back, full screen, and back."* On the SECOND collapse the expanded pane stayed
  on screen at its pre-animation size — the card's original rect, its body at opacity 0, eating
  every touch aimed at the card underneath, with its own close button equally dead.
  - **The mechanism, from the library's own source.** Both hosts guarded their exit animation's
    completion callback with `if (done && seq.current === mySeq) runOnJS(setRequest)(null)`, where
    `seq` was a `useRef`. That callback is auto-workletized (no `'worklet'` directive in the
    source — see the Reanimated gotcha below), so it reads `seq` on the UI thread — and
    `react-native-worklets` serializes a captured plain object ONCE and caches the clone
    (`serializableMappingCache`, keyed by the object). A ref is a plain object, so from the second
    `dismiss()` onward the UI-thread copy still held `current: 1` while JS had incremented to 2:
    the guard failed, `setRequest(null)` never ran, and nothing ever unmounted the overlay.
  - **Every harness in this repo says the old code is fine, and that is the reusable half.** In
    `__DEV__` the library FREEZES the captured object, so `seq.current += 1` is a silent no-op,
    both sides stay at 1 and the guard passes; on web (`npm run preview`, `npm run wraps`, every
    screenshot) worklets run on the JS thread and there is no clone at all. Only a release build
    diverges. Same shape as the widget-palette and the `flex`-with-`flexBasis:'auto'` lessons: a
    difference no local check can see, so the guard has to be a source scan.
  - **The fix is `useSharedValue`, always** — the library's own comment on that freeze says so:
    *"If the user really wants some objects to be mutable they should use shared values instead."*
    `__tests__/workletSafety.test.ts` now scans every workletized body for a `X.current` read where
    `X` is a `useRef` in the same file, alongside its existing runOnJS rule, and proves the
    detector fires on the exact shape that shipped.
  - ⚠️ **`AppModal` had the identical latent defect** and was fixed in the same pass. There it
    would have left `<Modal visible>` mounted with an invisible card over a full-screen
    `Pressable` — an app that reads as frozen rather than as a stuck card.
- **The To-do tab's Week card folds as ONE thing, and every day starts folded (2026-08-19).**
  Maintainer: *"Mon-sun in to-do should also be collapsable together, and the current day does not
  need to be open. The days are just for an overview, while 'Today' and 'Whenever' at the top is
  for use."* Two changes, on two different axes, and the split is the point:
  - **The card**: a `CardCollapseToggle` in the Week header over the new `'plansWeek'` id in
    `lib/collapsedCards.ts` — the third axis (is the body drawn at all), persisted in
    `settings.collapsed_cards`. The Week card is not a `SectionCard`, so it wires the hook and the
    chevron by hand rather than passing `collapseKey`.
  - **The days**: `collapsedWeekdays` stays local, unpersisted state, and now starts with EVERY
    date in it rather than every date except today's. Today is already on screen in full, in the
    card directly above, with its own composer — auto-opening it here drew the same day twice and
    made the one card meant to read as a seven-row overview open at whatever height today
    happened to be. `lib/collapsedCards.ts`'s singleton rule is why the per-day folds can't be
    persisted: a bag keyed by date grows forever.
  - `components/TodoSurface.tsx`'s `cardHeaderTitle` took `flex: 1` + `minWidth: 0` in the same
    edit, so the header's trailing controls stay clustered at the right edge instead of
    `space-between` spreading the chevron into the middle of the line.
- **The Energy tutorial card draws no tree, and the branch divider is gone (2026-08-19).**
  Maintainer: *"remove the Tree in Energy, and the wavy lines that have been used as dividers."*
  - `components/StarterCard.tsx` gained `noTree`, and `components/EnergyMeter.tsx` is its only
    caller. It drops ONLY the watermark — `embedded` would have taken the Surface and the padding
    with it, and a `stage` value cannot express "none" — so that card keeps everything else. Its
    `stage="sapling"` went with the drawing rather than staying as a prop that does nothing.
    `components/StageTree.tsx` is untouched and every other StarterCard keeps its tree.
  - **`components/SectionDivider.tsx` is DELETED**, along with both of its call sites on the
    Shopping tab (above the Weekly rail, and between each UKE section). It drew a `trunk-divider`
    motif — a forking branch spanning the whole width — between major sections. Not replaced by a
    hairline: the gap between two cards is `SCREEN_GAP`, owned by the screen's own scroll
    container (the 2026-08-08 spacing pass), and a rule drawn on top of that gap is a second
    answer to a settled question. `lib/__tests__/screenRhythm.test.ts` asserts the component is
    gone AND that nothing draws the motif directly — the art itself still exists in
    `constants/motifs.ts`, which is how it would come back.
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
  - **The `onboarding-triptych` tree backdrop is basics-only as of 2026-08-09.** It used to
    slide across all three onboarding screens as a seed→sprout→tree progress indicator; the
    full-tree panel read badly behind privacy's and restore's real controls (a trunk line
    running through the Start button), so those two now render the app's ordinary
    `components/ScreenBackground` instead, same as every other screen. `basics.tsx` keeps the
    triptych's branch panel, faded well back behind that screen's own real app-icon hero (see
    its header) — the icon carries the brand identity now, not the generated line art.
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
  - **Where the hole GOES was wrong in two independent ways until 2026-08-14** (five real-device
    screenshots: every step ringing the card above its target, Shopping ringing the header
    instead of the tab bar, Home's ring cutting across a fully-lit bottom nav). Both fixes are
    load-bearing and neither is obvious from the call site:
    - **A target's rect and the overlay's origin must be measured the SAME way**, because the
      spotlight subtracts one from the other. `measureInWindow` alone put every hole one status
      bar too high on Android — Fabric folds `includeViewportOffset` into "window", which on
      Android is `rootView.getLocationInWindow() − getWindowVisibleDisplayFrame().top`, i.e.
      `−statusBarHeight` under the edge-to-edge window Expo enforces, while the scrim is an
      `absoluteFill` in ROOT coordinates. **Don't "fix" this by switching to `measure()`**: its
      root-relative pageX/pageY are correct on native and wrong on web (react-native-web
      implements `measure` as an `offsetParent` walk that never subtracts the pager's
      `scrollLeft`), and taking it silently stopped the tour rendering in `npm run preview` at
      all — trading a device bug for a permanent blind spot in the only harness that can see
      this component. That was measured, not reasoned about.
    - **A measured rect is a LAYOUT box, not what you can see.** Content scrolls under the
      floating header and nav cards and is hidden BY them, so a hole cut over that part of the
      rect un-dims the CHROME. `lib/tourSpotlight.ts` clamps both hole and ring to
      `tabChromeBand()` — exported from `components/ScreenScaffold.tsx`, which positions that
      chrome, so the two can't drift.
    Neither is visible to tsc or to a screenshot, so both are pinned by source scan +
    pure-function tests in `lib/__tests__/tourSpotlight.test.ts`. Note also that the overlay's
    OUTERMOST view carries the `zIndex: 100` — `PagerFloatingNav` is a `zIndex: 100` sibling, so
    a wrapper without it lets the bar paint over the scrim and the coach card.
- **Empty-state explainers** (`components/StarterCard.tsx`, 2026-07-26; extended 2026-07-27): a second, more visible teaching layer than the ⓘ hint — a short explanation plus one concrete example row, rendered inline where content would be while a surface is empty, and gone once the user has their own (emptiness is the gate, so it also returns if they delete everything). **The gate is a plain `length === 0` on only one of the callers** (`components/GoalsEditor.tsx`; it was `app/goals.tsx` until that screen was retired 2026-08-12) — don't copy that shape blindly (measured 2026-07-31, AUDIT.md): Habits counts the *person-filtered* `profileHabits`, Shopping needs `lists.length === 0 && items.length === 0` (a migration seeds one empty monthly list, so a monthly count is never 0 and would suppress the card for every new user), and Health and Plans both OR in a just-added flag (`healthStarterAdded` / `planStarterAdded`) so pressing the example's "+" doesn't unmount the card in the same tick that the write lands — Plans additionally suppresses it on the timeline layout, where `PlanTaskCard` already draws its own inline explainer. Live on Habits (plus four one-tap starter habits from `lib/habitStarters.ts`), Plans, Shopping and Health, and — since 2026-07-27 — on the **Home preview cards** too: the day-view card (`components/PlanTaskCard.tsx`) and — until it was deleted on 2026-08-19 — the shopping card each render their own explainer + suggested-add row *inside* the card, never as a nested Surface (a Surface inside a Surface reads as a nested panel) — since 2026-08-12 that means `StarterCard`'s `embedded` prop rather than hand-rolling the block; see the placement paragraph at the end of this bullet. Copy lives under `starters.*` in `lib/i18n.ts`; each one's core message is also in the matching `hints.*.example`, which is where it stays reachable after the card disappears. The StarterCard shell is styled with a **neutral** `theme.border` Surface, deliberately NOT the accent-barred HintCard look — on a first visit both are on screen at once and twins would read as a duplicate — while `components/StarterExampleRow.tsx` (the suggestion itself) is drawn as a **provisional sketch** — dashed neutral border, no fill, muted italic title, accent only on its "+" and its "Example" chip. **That reversed on 2026-08-10** ("Examples are not visible examples, they look like a part of the card or an active task, not as a temporary thing"); until then it deliberately DID copy the surrounding list's real row styling (accent wash + accent edge) on the opposite 2026-07-27 report, and succeeded so completely that a one-word chip was the only thing left telling the two apart. It keeps the row's GEOMETRY — an example has to be the same shape as the thing it's an example of — and changes only the finish. Read that file's Edit notes before restoring any of it. **The Energy strip is the half-exception**: its explainer is a permanent one-line hint under the meter (`t.energyMeter.hint`), *not* a disappearing StarterCard — as a separate card between Energy and the to-do card it read as belonging to the to-do card, and an explanation that self-destructs isn't there when you come back to the number months later. **But since 2026-08-03 it ALSO has a StarterCard tutorial** (`starters.energy`), and the two coexist deliberately: the tutorial *replaces the meter itself* while nothing carries an energy value and no capacity has been set (a full ten-pip bar with nothing able to spend it is the "reads as a score" problem at its worst, on the first screen a new user sees), with nothing above it to be confused with, and the permanent hint comes back attached to the meter the moment there's a number worth naming. Its gate is a third shape again — `!hasEnergyItems && !hasSetCapacity`, AND all three source stores `loaded`, because an unloaded store looks exactly like an empty one and the wrong answer flashes teaching copy at a long-time user. See `components/EnergyMeter.tsx`'s "Tutorial state" note.
  ⚠️ **The explainer line came BACK on 2026-08-27 (round 20), narrowly — read this whole
  paragraph before either restoring more of it or deleting it again.** Round 20's drawn screens
  put an italic, bulb-prefixed line under every card that has content, and the maintainer ruled
  for the mockup. What returned is one component (`components/CardHintLine.tsx`) with one mount
  site (`Card`'s `hint` prop), five strings, and a rule that it draws **only while the card has
  content** — an empty card still speaks through `StarterCard`'s line or `NarratorQuote`'s aside,
  and both at once stacks two muted italic lines, which is the failure the 2026-08-17 pass was
  actually about. Everything else below stays deleted: `HintCard`, `CardHintNote`, the ⓘ banner
  tier, and any second `bulb-outline` anywhere in the app (asserted). The italic exception is
  **two files wide** now, both using `Fonts.italic` and never `fontStyle: 'italic'`.
    Also from that round, on the same cards: **a card header carries a `peek` line** — one line
  under the title saying what a CLOSED card holds, drawn instead of a bare count, because a `0`
  beside a name on a surface nobody has filled in yet reads as a verdict. A zero count is no
  longer drawn beside a peek; a non-zero one is, because that is a size. ⚠️ **Its slot is ~190px,
  and only ~67–91px on a card that also passes header controls** — measured, and it is why
  `shopCatalogue` reads "286 varer". `npm run wraps` has a CARD PEEK gate that fails the run.

  **The explainer LINE was deleted — the "no manual" pass (2026-08-17).** Maintainer: *"A native
  app should not read like a manual. You are placing way too much text on the screen. Delete all
  lightbulb (💡) sections entirely."* `components/CardHintNote.tsx` — the shared bulb + italic
  sentence that eight cards mounted — **does not exist any more**, and neither do the strings it
  drew (`starters.{habits,health,notes,medicine}.text`, `starters.energy.text`,
  `energyMeter.hint`, `healthIssues.cardSubtitle`). They were deleted rather than unmounted, so
  nothing can be quietly rewired. The bulb glyph came off `StarterCard` and `PlanTaskCard`'s
  task-hint row too, and `app/scan.tsx`'s tip banner took the ⓘ glyph instead.
  Three things this did NOT do, so the gaps read as decisions:
  - **`StarterCard` keeps its one short line**, minus the bulb, minus the italic, clamped to
    three lines. It is what an EMPTY surface says instead of being blank — deleting it leaves a
    blank card, which is not "lighter", it is broken.
  - **A task's OWN hint survives** (`PlanTaskCard`'s `task.hint` row) — that is user content, not
    app teaching. Only the glyph went.
  - **The ⓘ banner is now the one place a screen explains itself**, and it was trimmed in the same
    pass: `HintCard`'s `example` prop and every `hints.*.example` string are gone (the italic
    "e.g. milk weekly, washing powder monthly." tier), each `hints.*.text` is cut to one short
    instruction, and the card clamps to `HINT_LINES` (2) with real padding on all four sides.
  **The placement rule this replaced, kept because it is still right if a short explainer is ever
  wanted again**: an explanation sits directly under the card's HEADER (*"Explanation always sits
  underneath sub-header"*, 2026-08-12), and whether it disappears once the card fills up is each
  caller's separate decision. `lib/__tests__/exampleRows.test.ts` §4 now asserts the ABSENCE
  across all eight former callers plus that nothing hand-rolls a bulb-and-italic replacement.
  Unrelated to the deletion and still true: `PlanTaskCard`'s example is wrapped in the shared
  `StarterCard collapsible` trigger row (`embedded`, and deliberately **no `text`**), so the card
  that was the model for the others is not the one surface whose example can't be folded away.
  Its ghost add-row stays OUTSIDE that wrapper: on the `readOnly && !onAddTask` branch it is the
  only way in, and a collapse must never take away the last "add something" affordance.
- **Medicine trays** (2026-07-27; `components/MedicineSurface.tsx` + `components/HomeMedicineCard.tsx` + `components/MedicineReminderBell.tsx` + `app/medicine-form.tsx` + `store/useMedicineStore.ts` + `lib/medicineSchedule.ts` + `lib/medicineNotifications.ts`): **its own top-level card on the Me tab since 2026-08-21** — it was the Health tab's first card, then a card drawn inside the Health card, which is the card-in-a-card `CONSISTENCY_AUDIT.md` §11 measured. Medicine is organised into four **trays** — morning/midday/evening/night — deliberately NOT exact per-medicine clock times: a tray is a *window*, so a dose taken at 11:40 is still a morning dose and an untaken one reads "still due", never "missed" (the same no-shame framing as habits' rest days; keep any new copy on that side of it). One reminder per tray, shared by its medicines, with a **Taken** action button that logs the whole tray from the notification shade (`'medicine-reminder'` category, next to the existing `'task-reminder'` one). As-needed (PRN) medicines belong to no tray and are guarded by a minimum gap + optional daily cap instead (`asNeededState`) — nothing ever nudges you to take one. Per-person via People/family mode (`child_name`, same convention as tasks/habits). `health_logs.medicine_id` optionally attributes a symptom entry to a medicine ("this ADHD med gives me stomach issues"), picked in `app/health-form.tsx`'s "Possibly from" row and surfaced on that medicine's own page. Gated on `settings.featureMedicine` (on by default, still a real toggle). **Deliberately NOT in the AI setup guide** — medicine names/doses are the most sensitive rows in the DB, and the guide already refuses health-log data. Stock/refill tracking is a known follow-up, not built.
  **The reminder bell is `components/ReminderBell.tsx` (2026-08-10), shared with
  `app/habit-form.tsx`, and it IS the switch.** It used to open the times panel while drawing
  `settings.medicineRemindersEnabled` — a *different* value, flipped by a `Switch` inside that
  panel — so pressing it changed nothing about it ("Reminder bell button looks the same in both
  states"). It toggles reminders directly now, the panel opens on that same boolean (so the
  panel IS the confirmation), and the duplicate `Switch` is gone. On/off is carried on four
  channels — glyph, colour, `accentSoft` plate, and resting sunk — because two wasn't enough to
  read at a glance. This is the documented exception to `DESIGN_RULES.md` rule 19a ("a boolean
  is always a slider"): the maintainer restyled the habit reminder off a plain `Switch` on
  2026-08-06, and this consolidates that rather than reopening it. Don't extend the exception
  to other settings. The card also has **no "nothing scheduled today" line** any more — it sat
  above the starter card saying less than the card did (and, when every medicine is as-needed,
  above nothing at all).
- **The widgets are drawn like the app's CARD — 2026-08-28** (`lib/widgets/WidgetViews.tsx` +
  `scripts/build-widget-previews.mjs`; pinned by `lib/widgets/__tests__/widgetPalette.test.ts`).
  The colour half of the 2026-08-15 entry below worked: the palette test caught the 2026-08-26
  `surface` retune and has kept every hue in step since. What it could not see is that the app's
  **card was rebuilt twice underneath it** — round 19's surface reset and round 20's corrected
  screens — and none of that reached the one surface that renders with the app process dead. So
  the widgets were the right colours in the wrong shape: a 10px hue dot for a header, an
  accent-coloured subtitle hung off the right edge, flush rows with the marker on the LEFT, and a
  solid accent pill with contrast-derived ink on it. Five things came across, each named against
  the app component that owns it, and the same "recompute it, don't copy it" mechanism now covers
  the material as well as the colour:
  - **A lit edge** (`components/Surface.tsx`, round 20's per-side border): white lip top-left,
    `theme.border` bottom-right. The one app treatment a widget wants MORE than a screen does — a
    widget has no page behind it, only a wallpaper, and the edge is what separates the two. It
    ports at all only because the lib renders through React Native's own `CSSBackgroundDrawable`,
    so per-side border colours on a rounded box are the same code path a `<View>` takes.
  - **A badge + a two-storey naming column** (`components/SectionRail.tsx`, `card` tier): the
    2026-08-15 inverted badge (neutral frosted plate, hue fully opaque on top) and the subtitle
    moved UNDER the title as a `peek` — muted, not the hue. ⚠️ **The snapshot still calls that
    string `subtitle`** and must keep doing so: renaming the wire field strands every
    `widget_snapshot` row an older build persisted. The slot it lands in is the peek; the name is
    the format.
  - **Boxed rows** (`components/PadSheet.tsx`, round 19) and **the check on the RIGHT**
    (`components/PadRow.tsx`, the 2026-07-30 row rule — which the widgets never got at all). An
    empty check is a neutral ring on the boundary token, a ticked one is filled with the hue,
    exactly as in the app. Health's read-only symptom rows keep a LEADING mark instead, which is
    the row rule's other slot: a state the row carries, not a control.
  - **Nothing is written on a hue** (`constants/theme.ts`'s `glassKey`, 2026-08-17). Notes' mic
    button is a matte key — a flat wash of its own hue, a lit edge, a plain `text` label — and
    `onInk()` is **deleted** with the solid pill it existed to serve.
  - ⚠️ **SHAPE is the app's, RHYTHM is scaled, and the split is load-bearing.** Radii and edge
    widths are `Radius.md`/`Radius.sm`/`BORDER_WIDTH.card`/`.field` outright — a 16px corner with
    a 1.5px lip reads as the same object at any size. Padding is NOT: measured on the real
    declared minimum (180×110dp, `app.json`), the app's own `Spacing.md` insets plus this anatomy
    leave a widget room for exactly ONE row where the flat header and unboxed rows fit two. The
    peek line and the boxes are the app's decisions and they cost real height; the padding is
    where that height is found. The rungs are the app's scale stepped down one — 12/8/6/3 against
    16/8/8/4 — which is what this file has always done with type (13px rows against `FontSize.md`'s
    17). A test asserts both halves, so "make it match the app exactly" cannot quietly undo it.
  - **Three app layers deliberately did NOT come across**, so the gaps read as decisions: the
    `getGlow` halo (a two-pass shadow; RemoteViews has no view shadow at all), the card hint line
    (teaching copy for a screen you are standing on — a widget is glanced at), and the badge's
    domain GLYPH (drawing an icon font in a headless render is the failure this file's own edit
    notes warn about: a glyph that fails to rasterise blanks the whole widget). The plate carries
    a hue dot instead — the badge's construction without the risk, and a widget needs no glyph to
    say which surface it is.
  - ⚠️ **Every translucent app layer is COMPOSITED into the palette table, never passed as an
    alpha.** The lib's `ColorProp` does admit `rgba()`, so this is a choice: the app's glass
    composites over its own backdrop and a widget has no backdrop, only someone's wallpaper — a
    translucent row box would let a photo through the pane and make "one step off the card" depend
    on what that photo is. `plate`/`rowFill`/`rowEdge`/`edgeLit` are each baked, and the test
    recomputes each from the app source that owns the recipe (`getBadgeFrost`, `getGlassEdge`,
    `PadSheet`'s `ROW_BOX_*`). There is no fifth: `GLASS_EDGE.card` carries no `shadeDark`, so the
    shaded side IS `theme.border` — asserted, so it stops being true loudly.
  - ⚠️ **An empty widget says something, and it says it UPRIGHT.** `habits` and `health` were the
    only two surfaces in the app passing `empty: ''`, so those widgets drew a header over a blank
    body; `t.widgets.noHabits`/`.noHealth` close that at both producers (`sync.ts` AND
    `headlessSnapshot.ts`, which carry separate string tables — a widget renders from whichever
    last wrote the row). **An italic shipped on that line for a few hours the same day and was
    reverted**, and the reasoning is worth keeping because the obvious argument is the wrong one:
    a widget CAN draw synthesised italic — it names no font family, so the Android limitation
    behind the app's ban genuinely does not reach it — but these strings are plain statements,
    which is `StarterCard`'s register and is drawn upright. The app's one italic is
    `NarratorQuote`'s FIRST-PERSON aside; copying the slant without the voice is the decorative
    use the 2026-08-18 ban was about. Both `widgetPalette.test.ts` and
    `lib/__tests__/narratorQuotes.test.ts` assert the absence, because nothing else would: the
    app-wide italic guards walk `app/`, `components/` and `lib/` by explicit file list.
  - **The picker previews were regenerated** (`npm run widget-previews`) and their scale
    corrected: `K` 1.8 → 1.6, i.e. a 240×135dp widget rather than a 213×120dp one, which is what a
    3×2 placement actually measures. The sample budget is TWO rows now, not three — the honest
    consequence of a taller header and boxed rows. The "drop the subtitle so the title fits" hack
    is **gone**, and its absence is the point: it existed because the header was one row and the
    two strings competed for it, which a peek on its own line makes impossible. ⚠️ **`previewImage`
    is bundled into the APK as a drawable, so the PNGs reach nobody over OTA** — they need a new
    preview build. The widget layouts themselves are JS and ship over OTA like everything else.

- **The outside surfaces caught up with the app — 2026-08-15** (`lib/widgets/*` +
  `lib/notifications.ts`'s persistent channel). The widgets and the pinned "today's overview"
  notification are the only parts of this app that render with the app process DEAD, which is
  also why they are the only parts nothing in the review loop ever looks at: they are invisible
  to `tsc`, to the Jest suite, to `npm run preview` (Android widgets no-op on web — see
  `lib/widgets/sync.web.ts`) and to every screenshot in `review-bundle/`. They had drifted about
  a year behind on colour and a full feature-set behind on content. Four things changed, and the
  first is the general lesson.
  - **A hand-copied constant with a comment telling you to keep it in step is not a mechanism.**
    `WidgetViews.tsx`'s palette carried exactly that comment and sat frozen at the 2026-07-14
    values through true-black dark mode (2026-08-10), dark becoming the DEFAULT (2026-08-16) and
    two categorical-hue recalibrations — so the surface most users saw first, on their home
    screen, was drawn in a navy that no longer existed. The six widget accents were worse than
    stale: `#0891B2`/`#2563EB`/`#F4A261`/`#8B5CF6`/`#16A34A`/`#E11D48` were invented before the
    categorical system and matched nothing in the app at all. The copies are still copies —
    importing `constants/colors.ts` into a headless context pulls a react-native module graph
    that has no business being evaluated there — but `lib/widgets/__tests__/widgetPalette.test.ts`
    now recomputes every one of them from `IDENTITY_HUES`/`getThemePalette` and fails the PR on a
    drift. **Do the same for any new baked-in copy; do NOT "tidy" these into imports.**
  - **The frame paints `surface`, not `bg`, and light mode needs its own ink.** A widget floats
    on a wallpaper with no page behind it, so `surface` is what it structurally is — and
    `#000000` would dissolve it into any dark wallpaper. (`Palette.card` had been declared and
    never referenced, which is how the frame ended up in the page colour.) The five identity
    hues are tuned for a black card and measure **1.35–3.42:1** on the light one, so `LIGHT_INK`
    darkens each until it clears 4.5:1 — the same walk `lib/domainColor.ts`'s `badgeGlyphFor()`
    does at runtime, baked because this file cannot call it. The test asserts the FAILURE too,
    so nobody removes `ink()` on the assumption a neon is fine on white.
  - **The pinned notification shows the WHOLE day, lock screen included.** Its channel is
    `PUBLIC` now (it had never set a visibility, so Android's `PRIVATE` default showed "contents
    hidden" on a locked screen — the one place a pinned overview earns its keep), and
    `overview.lines` is the single rendering it posts verbatim: task/shopping/habit counts, the
    named trays still due, a count of open episodes, then the next task.
    ⚠️ **A redacted second rendering (`safeLines`) shipped for a few hours the same day and was
    reversed** — health dropped, medicine reduced to a count. The maintainer's ruling: a summary
    you have to unlock to read is one you will not read, and half a summary is worse than none.
    The privacy control is `persistentNotifEnabled`, which turns the whole notification off.
    **Don't reintroduce a redacted variant without asking**; `lib/widgets/__tests__/overviewSplit.test.ts`
    keeps its now-misleading name so the history stays findable, and asserts the absence.
    ⚠️ **The `-v2` in `persistent-overview-v2` is load-bearing** — Android freezes a channel's
    importance/visibility/sound at creation and silently ignores a later change, so on every
    install that had already posted an overview, setting this on the old id would have been a
    no-op. Bump to `-v3` the same way if one of those fields moves again.
  - **Every notification can be ANSWERED from the shade, not just read.** Two were read-only.
    A **habit reminder** had no buttons at all — tasks had Done from AP-05 and trays got Taken
    with the tray system, but the reminder most likely to arrive while your hands are full could
    only be dismissed or tapped through. It has its own `'habit-reminder'` category now
    (Done/Remind me later, payload `data.habitId`), and Done is an **`increment()`**, not a
    "mark met": a counter habit nudged three times should count three times, and for a
    daily-goal-of-1 — almost every real habit — the two are identical. And the **pinned
    overview** had none, because a day summary has no single "Done" that means anything. It
    nominates the most answerable item instead (a tray still due, else the next undone task) and
    **borrows that item's own category** rather than minting an `'overview'` one — so the button
    reads as the verb for something the body names, and acting from the overview takes the exact
    same store path as acting from the reminder itself. There are now three categories and three
    listeners mounted at once, each filtering on its own payload key (`taskId` / `medicineTray` /
    `habitId`); **a missing payload is a silent button, not a broken one**, which is why the
    tests assert the payload rather than the label. `refreshPersistentNotification`'s dedupe key
    includes the action, or finishing the 09:00 task would leave the button pointed at it while
    the body moved on. Still deliberately actionless: the weekly/monthly nudges (no single act
    to take) and an open episode (closing one asks when it ended and what helped; "Still going"
    writes nothing at all — a shade button can express neither).
  - **Every notification switch lives in Settings → Personal, and turning one ON asks for the OS
    permission.** Two gaps closed on 2026-08-15. `medicineRemindersEnabled` existed ONLY as the
    bell on the Health tab's medicine card, so the one screen a user goes to to manage
    notifications did not list the app's most time-critical one (both write the same value; the
    bell is the in-context control, Settings is the inventory, and the row is hidden with
    `featureMedicine` like every other medicine surface). And `applyAndSync` never called
    `requestPermissions()` — permission was only ever asked at onboarding and from Home's ⓘ
    toggles, so anyone who declined there, or who revoked it in Android settings later, flipped a
    switch here that read as on while `scheduleNotificationAsync` failed silently (lib/
    notifications.ts swallows those by design). `NOTIF_SWITCHES` in `app/settings.tsx` is the
    list; **add a new notification toggle to it in the same edit that adds the row.**
  - **The picker previews are generated from source, not drawn** (`scripts/build-widget-previews.mjs`,
    `npm run widget-previews`). `assets/widget-previews/*.png` is what Android shows when you
    long-press the home screen and browse widgets — the first and often only look anyone gets
    before placing one — and they were hand-drawn one-offs in the retired navy, with the
    pre-categorical accents, English-only titles, and a "Today's tasks" heading the widget never
    rendered. The generator EXTRACTS every colour and every title from `WidgetViews.tsx` /
    `snapshot.ts` / `headlessSnapshot.ts` at run time and rasterises through the pre-installed
    Chromium; only the sample row text is invented, because a preview has no real data. The
    palette test asserts the script contains **no hex literal at all**, so the one way it could
    drift is closed. ⚠️ **These are NATIVE — `previewImage` is bundled into the APK as a
    drawable, so regenerating them reaches nobody over OTA and needs a new build.** It does not
    change the JS↔native contract, so it does not by itself need a `runtimeVersion` bump.
  - **Medicine reached the outside for the first time**, folded into the Health widget rather
    than given a sixth receiver (a new widget means `app.json`, a `runtimeVersion` bump and a
    native build; this ships over OTA). That makes the Health widget's tray rows its first write
    into health data — `TAKE_TRAY` logs the whole window, the same unit the notification's Taken
    button uses, idempotent on `(medicine_id, log_date, tray)` because a widget tap and that
    button can land from two processes at once. Its symptom rows stay read-only on purpose:
    un-logging one deletes a dated entry with a severity and maybe a note on it. The tray's
    no-shame contract survives the trip — a passed-but-untaken tray reads exactly like an
    upcoming one apart from where the eye lands, with no red, no lateness, no escalation — and
    every medicine read is gated on `featureMedicine`, because **a flag that hides a surface has
    to hide it outside the app too.** Habits and open episodes joined the overview in the same
    pass; the episode line is a count and stays one (`lib/episodes.ts`'s promise is that a
    week-old episode reads like an hour-old one).
- **The row rule + matte buttons** (2026-07-28, from design-system v6's `Checklist Redesign
  Options` / `Focus First (1c)` / `handoff/BUTTONS.md` — the only parts of that bundle that
  post-date the rebuild; the rest of it describes the pre-rebuild app and is dead).
  - ⚠️ **How a run of rows is DRAWN is `lib/rowList.ts` since 2026-08-28 — one connected list,
    not a stack of boxes.** See the "One connected list" bullet below; three files were drawing
    three different rows before it existed. What follows is the row's ANATOMY (which slot holds
    what), which is a separate question and is unchanged.
  - **Row anatomy (amended 2026-07-30 — the check moved to the RIGHT)**:
    `[leading?] title → ONE meta line → ONE right-hand value → [⋯ action] → [○ check]`.
    `components/PadRow.tsx` is the shared implementation; a list-bearing surface should
    draw through it rather than hand-rolling a row. **Adoption is partial, and the gap ran
    the opposite way to what you'd guess** (measured 2026-07-31, AUDIT.md §0.4.2e): `PadRow`
    was imported by exactly four files — `HomeNotesCard`, `HomeHabitsCard`, `HomeShoppingCard`
    (deleted 2026-08-19) and `PlanTaskCard`, i.e. the four **Home** cards of the day — and by NO tab screen at all, which
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
  - **The quick-add is one shape everywhere, and the composer is a real FIELD (2026-08-05)**,
    from a user report on Home's Habits and Notes cards: *"Not visible where user is typing,
    looks unnatural"*, *"The 'av' does not make sense to me"*, *"The three dots don't do
    anything"*. All three lived in `components/PadTypeRow.tsx`, so all four Home cards, the
    Habits tab, the To-do timeline and Shopping were affected at once.
    - **The input is bordered, filled and shows focus** — the same shape as
      `components/FormControls.tsx`'s `Input`, so the app has ONE field. It had no border,
      fill, radius or focus state, and its prompt was a hand-rolled layer that unmounted on
      focus, so tapping the line left a bare caret on blank card. `components/AddRow.tsx`, the
      other composer, got the same treatment. **This is not the boxed-ROWS design
      `DESIGN_COMPARISON/10` rejected** — rows are still flush and ruled; only the one control
      you type into is boxed. Don't cite it as precedent for boxing rows.
    - **Every surface uses the labelled `panel`, not the inline `extras` row.** Notes' Details
      field and Shopping's quantity/list controls used to share the input's 44px line; they are
      labelled `QuickAddOptionRow`s below it now, which is also what gave the input room to
      look like a field.
    - **No blind tap-cycles.** A row that cycled forward through its options on tap — energy
      (`off→+1→−1`), repeat (`none→daily→weekly→monthly`), Shopping's destination list — showed
      one value, gave no sign it cycled and had no way back. Energy is a signed `Stepper` now;
      the other two open a picker and carry a `showsMore` chevron. Prefer a stepper for a
      number and a picker for a choice; a cycle is fine only where every stop is visible.
    - **A button that can't act doesn't render.** "More options" (was a bare "…") is worded and
      live in every state, including an empty line — its handlers must never open with an early
      `return`. Where a surface has nothing more to open, pass no handler at all: that is why
      Notes has no such button (a note is a title and a body, both already on the quick-add).
  - **The hierarchy of settings when making a row — THREE TIERS (written down 2026-08-08).**
    The rule was already obeyed in code and nowhere stated, so each new surface re-derived it.
    Every composer sorts its settings into exactly these, and nothing else:
    - **Tier 1 — the line.** The name, and nothing else. **Committing at tier 1 must always
      produce a valid row.** This is what makes capture cost one gesture; if a surface needs a
      second field before a row is legal, that is a bug in the row's defaults, not a reason to
      grow the line.
    - **Tier 2 — the options.** The 2–4 settings that change *what the row is* on this surface,
      visible while typing, never before. Two slots exist and a caller passes **one or the
      other, never both**: `panel` (a `QuickAddOptionsPanel` of labelled `QuickAddOptionRow`
      cells — **the preferred shape**, from the 2026-08-04 report *"I cannot understand small,
      barely visible icons"*) or `extras` (inline chips on the input's own line — the older
      shape, kept only for surfaces that haven't moved). No blind tap-cycles here: stepper for
      a number, picker for a choice, per the bullet above.
    - **Tier 3 — the editor.** Everything else, behind the worded "More options" (`onMore`),
      which must be live in every state including an empty line, or absent entirely.
    **Three composers implement this, and they are more converged than they look.** All three
    already draw the same field — `AddRow` and `InlineAddItem` both got it in the 2026-08-05/06
    passes, `InlineAddItem` by using `FormControls`' `Input` outright — so "converge the field"
    is **done**; don't re-propose it. Since 2026-08-16 (brief §8) that shared field is a
    **recessed well**: a translucent black wash sunk into the card, no stroke at rest, and a
    focus ring in the card's own categorical colour plus a `getGlow` halo. `PadTypeRow` also
    carries the one trailing SUBMIT arrow, inside the field's right edge, muted until there is
    text and then filled with that same hue.
    ⚠️ **A composer's COLLAPSED state is that same well, and nothing may be drawn around it**
    (2026-08-21, user report + screenshot of the To-do tab: *"Text-boxes have still not been
    fixed. Even with 2 or 3 tries."*). The field had been converged for months and the report was
    still right, because two things sat outside it. `AddRow`'s collapsed "+ label" bar was a
    1.5px `theme.border` pill at `Radius.md` and 32px tall — its own 2026-07-25 fix, from back
    when the bar was bare text — so the To-do tab's two composers, one card apart, were an
    outlined pill and a recessed well; it takes `getFieldGlow` + `getRecessedField` now, so
    tapping it changes only what is inside the box. And `components/TodoSurface.tsx` wrapped it
    in `addRowCard`, a `theme.surface` box with a 1px border and a **4px accent left rail** —
    three edges around one control, i.e. the box-inside-a-card the 2026-08-18 blueprint pass
    deleted everywhere else, with the screen's hue restated on a rail when it is already on the
    badge, the focus ring and the halo. The slot is spacing-only now. Both halves are pinned by
    `lib/__tests__/chromeRhythm.test.ts` §5, because a wrapper `View` is invisible to `tsc` and
    a resting outline reads as intentional in isolation — it is only wrong beside the other
    composer, which no unit test looks at.
    ⚠️ **The recess is scoped to composers that are contractually inside a card**, which is why
    `FormControls`' `recessed` is opt-in and `InlineAddItem` is its only caller. An editor's
    fields sit on the screen backdrop, and there a black wash on near-black with no resting
    stroke makes the field *vanish* — measured in the preview on `app/medicine-form.tsx`, not
    theorised. What still differs between the three is the TIERING:
    | Composer | Tier 1 | Tier 2 | Tier 3 | Used by |
    |---|---|---|---|---|
    | `PadTypeRow` | always-open line | `panel` + `extras` | `onMore` ✓ | the 4 Home cards, Habits tab, To-do timeline |
    | `AddRow` | collapsed `+` pill → line | `panel` + `extras` | **none** | Plans, Health, health-log, Goals, GoalsEditor, Food, Medicine |
    | `InlineAddItem` | collapsed `+` bar → **whole panel** | **not separated** — name, catalog autocomplete, price, category, qty and Temporary all at once | n/a | Shopping, inventory |
    ⚠️ **`components/DraftComposer.tsx` is NOT a fourth composer — it is a `PadTypeRow` that
    owns its own text** (2026-08-28), so the rule below is intact. It exists for a performance
    reason, not a design one: five surfaces held their composer's `value`/`onChangeText` in the
    component that draws the WHOLE surface (`PlanTaskCard` is ~2 000 lines of timeline, rows and
    day log), and since React re-renders from where state lives downward and nothing in those
    trees is memoised, **one character typed re-rendered the entire card stack**, re-running
    `Surface`'s work for every card in it. Measured with the CDP profiler, JS busy time per ten
    keystrokes, median of three, on one build A/B: Home's "I dag" **57ms → 18ms**, the Habits
    card **64ms → 15ms**. `components/TodoSurface.tsx`'s `InlineTaskAdd` and `InlineAddItem` had
    always owned their drafts; this is that pattern named once rather than copied per surface.
    **Only the TEXT belongs in it** — option state (energy, target, remind, recurrence, the
    task-vs-moment switch) changes on a TAP, not a character, and arrives as the already-built
    `panel` NODE, so a keystroke re-renders the composer while the caller does not and React
    bails out of that subtree. Splitting on "what changes per keystroke" is the point; splitting
    on "what belongs to the composer" would be slower. `MedicineSurface` has a local equivalent
    over `AddRow` (different props, different resting state — a union of both prop sets to save
    fifteen lines was not worth it). **`components/FoodTab.tsx`'s two `AddRow`s still have the
    defect** and need a real restructure: one is keyed by dish id into a `Record` held by the
    parent, the other takes its value from props.
    Two known gaps, stated so they are decisions rather than drift: **`AddRow` has no tier 3**,
    so a surface on it cannot offer a fuller editor from the composer; and **`InlineAddItem`
    does not separate tiers at all** — it is one flat panel, which is why it is the only
    composer that feels like a form. Its tier 2 is genuinely richer than the others (a catalog
    lookup is the point of that surface), so folding it in is a real design question, not a
    tidy-up. **Do not add a fourth composer**, and do not "fix" `InlineAddItem` by flattening
    the others toward it.
  - **Shopping quantity is an input, not a value**: it READS in the row's leading cluster and
    is EDITED in `components/ShoppingItemSheet.tsx` (a row-body tap). That sheet is also the
    only editor for a weekly item's unit/price/category. `onIncrement`/`onDecrement` on
    `ShoppingRow` are gone — `onOpenDetail` replaced them.
  - **An "add new row" trigger lives at the bottom of the list it appends to, never crowded
    next to a card's expand/collapse toggle** (2026-08-06, user report on `FoodTab.tsx`: the
    per-meal-section "Add dish" button was a small "+" wedged into the header right beside the
    chevron — close enough that the two read as one crowded control and were easy to mis-tap).
    Same idiom already established by `components/NewMonthlyListRow.tsx`'s labelled "+ New
    list" trigger and `InlineAddItem`'s bottom-of-list placement — a "+" that creates a whole
    new row belongs where that row will land, ideally visible only once the list it adds to is
    itself visible (so it's naturally absent while a section is collapsed, not doubled up with
    the toggle). This does **not** apply to a per-row action button — `FoodTab`'s per-dish "+"
    that opens the add-to-list popup, or a save/checkmark/X on a row currently being edited —
    those stay wherever the row rule already puts them (right-hand action cluster); only
    "creates a brand-new row" triggers follow this bottom-of-list placement.
  - ~~**Matte finish**~~ — **superseded by the card design reset (2026-08-05). There is no
    material any more.** See "One card design" below; the matte/rim/face-lift tuning this
    bullet described was deleted rather than adjusted. `__tests__/glassMaterial.test.ts` still
    asserts the specular token is gone, and that is still the rule — but the layers it was a
    highlight ON no longer exist either.
  - **Press = sink, not shrink — and it is the DEFAULT now (2026-08-10).** `PressableScale`
    translates a cap down by `travel` (px, from `Travel.*` in `constants/motion.ts`) and comes
    straight back: no spring, no overshoot, no opacity dip. `sunk` is the stays-pressed "on"
    state (active tab, active IconButton, active nav tab including **Home**). Until this pass
    only `Button`, `IconButton` and a tappable `Surface` opted in and the other ~330
    `<PressableScale>` call sites still used the old scale-and-dim bounce, which is what the
    maintainer read as *"too much bob, like something floating instead of a keyboard Key"*.
    The mode is now `press` (default `'key'`), `travel` defaults to `Travel.sm`, and `scaleTo`
    only applies when a caller explicitly passes `press="scale"` — **three do, all
    structural**: `ghost` variants of `Button`/`IconButton` (no fill, so no base to sink onto)
    and `Surface`'s reduced-motion branch. Don't add a fourth to make something "feel softer".
    A caller with a real fill should also draw a base (`Button.tsx`'s `keyBase`) so the cap has
    something to meet; a fill-less row or chip sinks against the surface behind it.
    Note `style` moves to the wrapper on the keyBase path.
    **The bob had a second, separate cause**, fixed in the same pass: RN only defers
    `onPressOut` past `onPress` for taps under 130ms, so on a slower tap the release read a
    stale `sunk`, animated the cap UP, and the effect animated it back down. The release reads
    `sunkRef` a tick later now. Pinned by `lib/__tests__/chromeRhythm.test.ts`.
  - **Matte glass, not plastic — the 2026-08-17 button pass** (`glassKey()` in
    `constants/theme.ts` + `components/Button.tsx` + `components/PressableScale.tsx`; pinned by
    `lib/__tests__/chromeRhythm.test.ts` §4). Maintainer: *"the primary buttons look like glossy
    Web 2.0 plastic pills… FORBIDDEN: Do NOT use LinearGradient, inner shadows, or solid heavy
    colors for the background of primary buttons."* A key is now exactly three layers:
    - **Body** — a flat translucent wash of the key's own hue, `glassKey`'s `KEY_BODY_ALPHA`
      (14% dark / 16% light for `primary`, **24% for `danger`**, 8/10% for `secondary`).
    - **Edge** — ONE stroke with per-side COLOURS: white on the top and left, a quiet shade on
      the bottom and right. Deliberately not the brief's per-side *widths* — RN renders mixed
      border widths on a `Radius.full` pill inconsistently, and dropping two sides takes away the
      WCAG 1.4.11 control boundary a button (unlike a card, see `getGlassEdge`'s `shadeDark`
      note) cannot afford to lose.
    - **Halo** — `getGlow` in the screen's categorical hue, projecting OUTWARD, `primary`/`danger`
      only, going out well before the cap lands on press.
    **Deleted, and none of it comes back piecemeal:** the `keyBase` housing (a
    `darken(fill, 0.22)` slab — "solid heavy colors" exactly), `depth="raised"`'s black cast
    shadow, PressableScale's `face` gradients (the resting top-edge highlight AND the pressed
    inner shade — "LinearGradient" and "inner shadows" exactly), `pressFill`/`PRESS_DARKEN`, and
    `getTopHighlight`/`getInnerShade`/`KEY_FACE_STOPS` from `constants/theme.ts`. **The SINK
    survives** — it is a motion, not a finish, and it is what still makes a press physical.
    Three things worth knowing before touching it:
    - **`glassKey()` is shared, and that is the point.** `Button` was never where most of the
      plastic was: ~18 action pills draw themselves — every bottom sheet's Done, `AppModal`'s
      dialog buttons (**"Start empty" is one of them**, which the brief named), scan's confirm
      bar, `FoodTab`'s popup, `budget`, `ErrorBoundary`, onboarding's footer. They all set
      `backgroundColor: theme.accent` directly. They go through the helper now; fixing `Button`
      alone would have left the app in two materials with no rule saying which was which.
    - **Nothing is written ON a hue any more**, which is what freed the body to be categorical.
      The label is `theme.text` on every filled variant. That REVERSES the 2026-08-16 rule that a
      primary button's fill must stay `theme.accent` — that rule existed only because
      `accentInk` had to be re-derived per screen.
    - **`danger`'s label is `theme.text` too, and that was measured, not assumed.** Keeping it red
      was tried: `bad` on a wash of itself runs 4.62 → 3.59:1 across the usable alpha range in
      light and 4.33 → 3.59 in dark, i.e. it fails AA at every alpha worth having. Hence the
      opposite trade — plain ink plus the deepest wash in the band, so the red is what the eye
      lands on rather than what it has to read. The test asserts BOTH halves, including the
      failure, so the next session cannot "restore" it.
    Everything is invisible to a screenshot in isolation and the web preview runs worklets on the
    JS thread, so the source scan is the only guard that holds.
- **The blueprint pass — 2026-08-18** (a third maintainer brief, written after the previous two
  were only partly carried out: *"You have been falling back on standard CSS habits (nested
  boxes, gradients, and text bloat). Stop guessing."*). Four instructions, each a reversal of
  something shipped, plus one addition. Pinned by `lib/__tests__/chromeRhythm.test.ts` §3/§4 and
  `lib/__tests__/exampleRows.test.ts` §2.
  - **The bottom nav is FIVE EQUAL SLOTS** (`components/BottomNav.tsx`): *"Do not use massive
    asymmetrical background circles for the active Bottom Nav icon… the active state should just
    be a filled icon in the active color with no background shape."* The sliding pill/ring AND
    the 56px centre FAB are both **deleted** — Home is an ordinary tab in the ordinary row — and
    with them went three measured tracks, the `absoluteFill` probe, `PILL_*`/`HOME_RING`, both
    clamps, every shared value in the file and the last `LinearGradient`. The bar has no
    animation left because it has nothing to move. Active = the filled Ionicons variant in the
    section's categorical hue (`navTabHue`, still dark-mode only); inactive = the outline glyph
    in `textMuted`. **That makes the hue load-bearing**, not decorative — it is now the only
    channel, so don't collapse it back to one accent. This supersedes the whole 2026-07-24 →
    2026-08-12 pill lineage below; the component's header keeps that history so it isn't
    rebuilt from a stale note.
  - **A top tab's active pill is a SOFT TRANSLUCENT WASH** (`components/TabSlider.tsx`):
    *"Active Top Tabs should use a soft, translucent pill strictly behind the text/icon."*
    `rgba(hue, PILL_ALPHA)` instead of a solid `theme.accent` fill, the label in `theme.text`
    instead of `accentInk`, and the track's border painted `transparent` (kept at width 1 so
    `TAB_SLIDER_HEIGHT`, which five callers reserve, does not move). ⚠️ **This edits the
    two-shapes rule, it does not break it**: the tier is still carried by the ACTIVE TREATMENT
    (screen tier = hued wash, form tier = raised white pill), and the two are further apart now
    than a fill opacity ever made them.
  - **No box inside a card** (`StarterCard`'s accordion, `StarterExampleRow`,
    `StarterSuggestionChip`, `PlanTaskCard`'s ghost add-row): *"Do NOT place borders,
    `<Divider/>` lines, or separate background boxes inside of main cards… Suggestion chips
    should be simple, borderless, matte shapes."* Every edge in that family is gone — the
    accordion's `collapsibleBox` border and its hairline divider, the example row's dashed
    field rung, its icon ring and "+" strokes, the chip's dashed pill, the ghost row's dashed
    box — replaced by padding, muted ink and one shared `getMatte()` plate (`constants/theme.ts`,
    new). **The row's GEOMETRY is untouched**, which is what still makes an example an example
    of the rows around it. This supersedes the 2026-08-12 "one box, not two" pass and half of
    the 2026-08-10 provisional-finish reversal — the finish is ink-only now — but not their
    conclusions: the two example shapes still share ONE finish, and an example still must not
    look finished.
  - **No italics anywhere, and no "e.g."**: *"Remove all italicized text and 'e.g.' (example)
    explanations."* `fontStyle: 'italic'` is gone from all 14 files that carried it, and the
    `e.g.`/`f.eks.` prefix is off every placeholder in `lib/i18n.ts`. The ⓘ banners were already
    one short sentence each (2026-08-17); the two that were two sentences are now one.
  - **⚠️ THE ADDITION, and it reverses a load-bearing 2026-08-11 decision**: *"even though
    things are translucent, things like header and bottom nav should still not show elements
    behind it when user is scrolling, or have scrolled. Only the backdrop."*
    `components/ScreenScaffold.tsx`'s clip window moved from the chrome's OUTER footprint to its
    INNER edges — content is now bounded by the header's (or an attached sticky bar's) bottom
    edge and the nav card's top edge, and `contentPad` is `{0, 0}` because the viewport's own
    margins are the whole clearance. The old arithmetic was correct and rested on a premise that
    expired silently: it let content scroll behind the chrome "hidden BY" it, which was true
    while every Surface was opaque and false from 2026-08-15, when the header and bar became
    frosted glass. **What this knowingly gives up is the corner peek** ("cards … visible in the
    bottom nav's cut corners at the top") — that request and this one are the same question with
    opposite answers, and this is both the later and the more general ruling. The surviving rule
    is unchanged: **one clearance each — the clip is margin on the wrapper, never also padding on
    the content.**
- **The UI-consistency pass — 2026-08-20** (a maintainer brief against the shipped app, with a
  screenshot of the Shop tab). Seven instructions; the four with the longest reach are new
  standing rules, so they are stated as rules rather than as history.
  - **⚠️ There is no ⓘ banner anywhere, and a tip belongs to an EMPTY STATE.**
    `components/HintCard.tsx` and `lib/useFirstVisitHint.ts` are DELETED, not unmounted, across
    twelve call sites (*"The top text box can be removed"*, *"Tips/explanation goes in the card
    for empty states"*). The surviving sentences are the `text` prop on that surface's
    `components/StarterCard.tsx`, which is the slot the rule names — so an explanation is on
    screen exactly while the surface it explains is empty, and needs no dismissing and no
    restoring. Settings' "Show tips again" button went with it; `dismissedHints`/`restoreHints`
    survive as inert columns. **Nine `hints.*` keys were deleted rather than re-homed** — a
    duplicate of a starter card one card lower (`plans`), a manual over a form whose fields are
    already labelled (the three `*Form`s), or a line about a screen that says it better itself.
    Home's banner was the awkward one: its BODY held the only copy of two notification opt-ins,
    and deleting them lost nothing because both are in `app/settings.tsx`'s `NOTIF_SWITCHES`,
    where `applyAndSync` additionally asks for the OS permission that the hand-rolled pair only
    half did.
  - **⚠️ A card never navigates away — it opens a centre pop-up** (*"Never go to another page,
    pop-up from the middle of the screen instead"*). `components/CenterModalScreen.tsx` is the
    shell; twelve routes use it (`habit-form`, `medicine-form`, `health-form`, `health-detail`,
    `health-log`, `day-log`, `notes`, `food`, `catalogue`, `habits`, `budget`,
    `inventory-edit`), listed as `CENTRE_MODAL_ROUTES` in `app/_layout.tsx`.
    **The route is unchanged; only its presentation is** — `presentation: 'transparentModal'`
    keeps the screen underneath mounted and visible, `router.back()` still closes it, and
    `useLocalSearchParams` still works, which is why this was a shell swap and not a refactor.
    `animation: 'fade'`, because a pane already in the middle has nowhere to slide in from.
    The pane is the **`overlay`** surface tier, so it is OPAQUE and mounts no blur — it is
    guaranteed to have the app's own cards behind it (the 2026-08-18 rule), and it keeps each
    screen's `screenKey`, so every editor still wears its domain hue through `ScreenColorContext`.
    **Deliberately NOT converted**: `settings` (a destination you go to on purpose), `scan` (a
    full-screen camera), `onboarding`, and `shared`/`pair-device`/`automations`.
    ⚠️ **A converted screen must NOT pad its own content** — the pane pads its body, so a
    screen-edge inset there is a second one stacked inside the first.
    `lib/__tests__/screenRhythm.test.ts` asserts that inverted rule over `CENTRE_MODAL_SCREENS`,
    and `screenHeaderContract`'s sub-screen list shrank to the two routes still genuinely pushed.
  - **⚠️ The full-screen ⤢ is the RIGHT-MOST control in a card header, on every surface.** After
    the caller's own controls AND after the fold chevron — which reverses `SectionCard`'s older
    "the fold sits outermost". *(This is true again as of 2026-08-27, round 20, after being
    reversed twice in between — see the cluster note below for the full lineage.)* Two things followed from making that universal: `SectionRail`'s
    `right` slot is a ROW now (it was a bare View, i.e. a COLUMN, so any caller passing two
    controls stacked them silently — the Katalog card came out as a three-storey column), and
    the To-do **Week** card is one outer `Surface` holding seven `embedded` `SectionCard`s, since
    its header was previously a bare row on the backdrop and its ⤢ was in the corner of nothing.
    `SectionCard`'s new `embedded` prop is what lets a section drop its own Surface — a Surface
    inside a Surface is the nested panel the blueprint pass banned.
  - **`components/HabitsSurface.tsx` exists** (extracted from `app/habits.tsx`, which is now a
    thin wrapper), so `homeHabits` mounts a real body and its card has a ⤢ again.
    **There are no placeholders left** — `shopLists`' expand id was deleted on 2026-08-21 rather
    than given a surface; see the expandable-cards bullet above.
    ⚠️ It has **no `embedded` prop**, unlike its three sibling surfaces: both of its callers are
    panes, so the flag would vary nothing. Its foot `StageTree` went for the same reason — a
    watermark sized for the bottom of a screen is blank space under the last card in a pane.
  - **Shop's Katalog card**: the sort slider is gone (name-collated always), the camera and lock
    are `CatalogueHeaderControls` in the card's HEADER (so `locked` is owned by each of the three
    hosts), the search field is ONE recessed well in both modes rather than a box inside a box,
    and the list is rounded and scrolls in place — which deleted the "and N more →" tail row,
    this card's last navigate-away. A plain `ScrollView`, not a FlatList: nested same-axis
    virtualization is what forced the old row cap in the first place.
  - **The Me tab** has no greeting and no "Edit cards" mode; a hidden card falls to a **Retired**
    `CollapsedSection` at the foot of the stack, one tap from coming back. The floor of one card
    went with the mode — it existed because hiding the last card left "no visible way back", and
    both halves of that reason expired in the same pass.
  - **`components/NarratorQuote.tsx` has no refresh button**, and with nothing to cycle its whole
    Reanimated surface came off. The random MOUNT index stays; a caller wanting a fresh line
    remounts with a new `key`.
  - **Contrast**: `rule`, `border` and `textMuted` up one step in both modes, and **no surface
    moved** — lifting a surface is what re-opens rule 10b's mutual exclusion. The widget's baked
    palette copies moved in step, caught by their own test exactly as designed.

- **Round 20's stray artefacts, and the density they were hiding — 2026-08-27.** The mockup's
  *"Stray artefacts"* box: *"Loose 2px dots, a hard black rule inside **I dag**, and hairline
  dividers under every header. All removed — separation comes from the body's offset, not a
  line."* All three were found by MEASURING the DOM in the web preview rather than by reading
  screenshots, which matters because two of them turned out not to be what they looked like.
  - **The hairline is `SectionRail`'s `divider`** — a `rgba(hue, 0.25)` rule at hairlineWidth,
    one per card. The View is deleted; **the PROP survives and now controls only the space**,
    because `components/Card.tsx` passes `divider={!isClosed}` and that is what still cancels the
    gap on a folded card — "closed is a bare header" is a construction the card system depends on
    (`lib/__tests__/cardAnatomy.test.ts`), not a coincidence. Header→body was 4 + 1 + 8 = 13px and
    is now `container`'s own `marginBottom` alone (8, against the mockup's 9).
  - ⚠️ **The "hard black rule" was `ProgressBar`, and its blackness was a side effect of a palette
    change nobody re-checked.** Measured: a 332×4 box of `rgb(18,18,18)` inside the Today card.
    The track was `theme.surfaceMuted`, an OPAQUE "sunken surface" token — which was 12 steps
    under a `#1E1E1E` surface when that default was written, and is **18 steps under the
    `#242424` surface** since the 2026-08-26 lift. So the track stopped being one step down and
    became a hole cut in the card, app-wide, silently. It is a translucent wash of `theme.text`
    now (`TRACK_ALPHA`), which is defined against its own ground and cannot drift that way.
    **The reusable half: an opaque "one step down" token stops meaning one step down the moment
    the step above it moves.** `components/PlanTaskCard.tsx` additionally passes a TRANSPARENT
    track when nothing is countable — the bar stays MOUNTED (rule 9 and the 2026-08-03 fix are
    not reopened; the height is still reserved) and only the ink goes, because a 0-of-0 bar was
    the only thing drawn inside an otherwise empty card.
  - ⚠️ **The loose dots were `components/ParticleBackground.tsx`, and deleting it cost an
    onboarding rung — read this before reviving either.** Five drifting 2.6–4px dots at
    `rgba(110,175,255,0.7)`, the app's one ambient particle field. It is DELETED, both mounts with
    it, and `settings.particlesEnabled` is an inert column (never dropped — see
    `store/useSettingsStore.ts`). **`lib/firstRunOptions.ts`'s motion ladder is TWO rungs now**
    (full/none): `'reduced'` was defined as exactly `particlesEnabled: false`, so with the field
    gone it wrote nothing and its shipped copy ("Transitions stay, moving background goes")
    described a no-op. The app's other two backdrop animations do not save it — a growth crossfade
    (off by default) and a hue crossfade on tab change, and the latter is a TRANSITION, which is
    what the middle rung promised to KEEP. **The OS reduce-motion path costs nothing, and that is
    measured**: `useAccessibility()` ORs the OS flag into `reducedMotion`, so on such a phone all
    three rungs already behaved identically and the pre-selection was cosmetic (it floors at
    `'none'` now instead of a rung that no longer exists). Reviving the flag means giving a middle
    rung something real to turn off FIRST; `firstRunOptions.test.ts`'s "no rung is offered that
    changes nothing" is what fails if you don't.
  - **Density: the mockup fits five cards per frame, the app about three — and it is not the
    padding.** Measured on Home at 430×932: Energy 80, **Today 359**, Notes 151, Shopping 239.
    The mockup's own prescription (card 13→11, body 11→9, row 44→42, stack 12→10) is a 2px trim
    on a 352px frame, i.e. ~2.5px at this width — it cannot account for a 359px empty card.
    What did: **`PlanTaskCard`'s `headerTopRow` reserved `minHeight: 32` for a count pill that
    moved to `Card`'s own header in the 2026-08-22 registry pass**, leaving a View holding one
    comment and 32px of nothing on every day-view card; and `headerRowPressable` kept a
    `Spacing.lg` (24px) margin sized for that block, so the card's largest gap sat under its
    smallest element (a 4px bar). Both fixed — Today is **330** — and the same lesson as the
    track above: *a number that was correct because of what sat next to it does not announce
    itself when that neighbour moves.*
    ⚠️ **SETTLED 2026-08-29 — the rung was added, and the way this note sat here unanswered is
    itself the lesson.** This paragraph used to end "that is a design-system decision (add a rung,
    or don't), not a defect", which was correct on the rules as they stood and was **never put to
    the maintainer**. The symptom ("visual condensing has not landed") was re-reported two days
    later and a whole session went on proving the code was on `main` and the OTA had published.
    `DECISIONS_OPEN.md` exists so that cannot happen again: a pass that stops because it needs a
    ruling files the ruling there, in the same PR that stops.
      Asked and answered: *"12px, but also focus on where and how things are placed as well. Just
    decreasing pure space is not the entire thing."* So `Spacing` gained **`smd: 12`** between
    `sm` and `md`, and `SCREEN_GAP` (16) and `CHROME_REST_GAP` (8) both take it. `Card`'s padding
    is deliberately still `Spacing.md` horizontal / `Spacing.sm` vertical — the mockup's "13 even"
    would make every card 8px TALLER, which is the opposite of the ask.
      **And the "where things are placed" half went to the chrome, which is where the density
    actually was**: `BOTTOM_NAV_HEIGHT` **72 → 56** (`components/BottomNav.tsx`). The item's
    `minHeight` was a magic 56 and is now exactly `MIN_TAP_TARGET`; the bar's `paddingVertical`
    was `Spacing.sm` around a box that already had its own. 16px on every screen, against the
    ~2.5px this pass found in card padding. ⚠️ **56, not the mockup's 54** — `MIN_TAP_TARGET` (48)
    is the CI-enforced accessibility floor and 54 means either a sub-48 target or 3px of padding,
    which is not a rung. 56 = 48 + `Spacing.xs` × 2, every number a token.
    ⚠️ **The bigger conclusion of this bullet — *"it is not the padding"* — was RIGHT and
    INCOMPLETE, and the next bullet is what it was missing.** The pass looked at the card's own
    box and at one dead 32px block, found the trim worth ~2.5px, and stopped. It never looked at
    the ROWS, which is where a list-bearing card actually spends its height and which is also the
    mockup's own first global finding. Read them together.

- **One connected list, and a pane that draws one header — 2026-08-28** (`lib/rowList.ts` +
  `lib/cardPane.ts`, both new; `components/{PadSheet,PlanTaskCard,HabitsSurface,Card,CardExpandHost,
  SectionRail}.tsx`). Maintainer, against the shipped app: *"Visual is still not like mockups, and
  the 'Make things condensed' and cards more compact when expanded has not worked."* Three
  findings, each measured in the web preview rather than read off a screenshot.
  - ⚠️ **Round 20 built the mockup's chrome, header, hint and groups and never touched the
    ROWS — which is what its own "what was wrong, globally" list opens with**: *"Rows were
    separate floating pills with 7px of air between them, so four tasks read as four cards. Rows
    now share one surface with hairline separators and an accent rail down the left edge — a
    single object with parts."* That is most of what "still not like the mockups" was pointing at.
    It is also the largest density win available, because a card's height is mostly its rows: a
    boxed row measured **45px + a 4px gap = 49px** of stack (its own `Spacing.sm` vertical padding
    plus two 1.25px borders on a 27px line) against a listed row's **38px + a hairline**.
  - ⚠️ **THREE files were drawing three different rows, and the guard only compared two of
    them.** `PadSheet` had the recipe; `HabitsSurface` hand-copied its four literals (it cannot
    use PadSheet — its rows are wrapped in `DraggableTaskRow`); and **`PlanTaskCard`'s day view —
    the app's single most-seen card — drew a third shape nobody had noticed**,
    `rgba(theme.accent, 0.05)` inside `rgba(screenHue, 0.2)`, which was also the last place a
    categorical hue washed a row's whole body after the 2026-08-20 ruling took that wash off the
    card. `lib/__tests__/screenRhythm.test.ts` had a whole describe block comparing string
    literals across the first two and had never heard of the third. **The recipe is `lib/rowList.ts`
    now and the guard asserts the three files IMPORT it** — a shared module is what prose in three
    headers telling each other to stay in step had already failed to be.
  - **The list is built FROM THE ROWS, not from a clip, and that is not a stylistic choice.**
    `PadSheet` can afford one `overflow: 'hidden'` wrapper and uses it; the other two cannot — a
    Habits row lifted by a drag out of a clipping parent is sliced in half mid-gesture, and a
    day-view row carries `FadeInDown`/`FadeOutDown` and would be cut off as it left. So
    `rowListStyle({ isDark, first, last })` hands each row the side edges, gives the first and
    last the outer edges and the corners, and puts a **quieter** hairline on every row in between.
    Equal weights there make the run read as a grid of cells again, which is the failure this
    replaced; a test pins separator < edge.
  - **The 2px rail is a colour element, not a pane wash** — the second half of the 2026-08-20
    sentence (*"White glass with color elements might be better"*), not a reopening of the first.
    `__tests__/glassMaterial.test.ts` still pins the absence of the pane wash and is untouched.
    It is a sibling View, never a `borderLeftWidth`: mixed per-side border WIDTHS on a rounded box
    render inconsistently on Android, the same finding that stopped `glassKey` taking the button
    brief's per-side widths.
  - ⚠️ **"More compact when expanded" was a real defect, and it was a duplicated header.**
    Measured on Home's Today card: the pane painted its own **65px** title bar reading "Today",
    then mounted `<TodoSurface section="today"/>` — whose whole job is to draw
    `<Card id="todoToday">` — so a second `Surface`, a second **52px** header saying the same
    word, the card's own vertical padding and a second horizontal inset appeared inside the
    pane's, along with a fold chevron and an ⤢ that cannot act on a pane at all. The
    card-in-a-card the 2026-08-18 blueprint pass banned, surviving where nothing was looking:
    `Card`'s `embedded` prop drops the Surface and KEEPS the header, which is right for a section
    inside a card and exactly wrong for a pane. `lib/cardPane.ts` is a CONTEXT rather than a prop
    because nothing in `CardExpandHost` renders a `Card` — it mounts a surface that decides
    several components down which card to draw, so a prop would have to be threaded through every
    surface's own props and every one would have to remember to forward it. **`CARD_BODIES` names
    the card each pane shows** (`card`, defaulting to the pane's id); only `homeToday` differs,
    because its body is To-do's Today card by design, and a test pins that as the single exception.
  - ⚠️ **A pane was a context-free overlay, and that is a second thing it got wrong.**
    `CardExpandHost` is mounted in `app/_layout.tsx` as a sibling of `<Stack>` — which is what
    lets it cover the floating nav for free, and also what left `useScreenColor()` **null** for
    everything inside it. So every hue-reading control in an expanded card fell back to
    `theme.accent`: a blue focus ring, a blue key halo and a blue row rail on a full-screen Health
    or Habits card, i.e. exactly the *"never blue on a pink or cyan screen"* complaint round 20's
    glow pass was about, surviving in the one surface that pass did not walk. It provides its own
    card's registry hue now, the same way `components/CenterModalScreen.tsx` already did for the
    other overlay.
  - **Two smaller things in the same pass, both worth their line.** `Card`'s vertical inset is
    **symmetric** (`Spacing.sm` both ends, was 8 top / 16 bottom — neither a rung apart on purpose
    nor anything the mockup draws). And `SectionRail`'s `spacer` View is **deleted**: it added
    `Spacing.xs` on top of the container's own margin, so the header→body gap was 12px while round
    20's own note claimed it was already *"the container's marginBottom alone (8)"*. The View was
    left behind when that pass deleted the hairline it carried. `divider` survives as a prop and
    still means "is a body drawn below this header", which is what keeps *closed is a bare header*
    true by construction.

- **The clean reveal + the narrator — 2026-08-19** (`components/StarterCard.tsx`, and the new
  `lib/narratorQuotes.ts` + `components/NarratorQuote.tsx`; pinned by
  `lib/__tests__/exampleRows.test.ts` §6 and the new `lib/__tests__/narratorQuotes.test.ts`).
  Two briefs that turn out to be one problem: **an empty surface was talking too much and
  saying nothing.** Read them together — the second only works because the first freed the room.
  - **The suggestions drop-down starts SHUT, and its label is one word.** The report was a
    specific broken state: *"when collapsed, it displays instructional text ('Trykk på én for å
    komme i gang:') with nothing underneath it."* Both halves of the fix are needed and neither
    stands alone. An instruction is only true while what it points at is on screen, and the
    2026-08-06 pass had introduced a state where it wasn't — opening-by-default hid that rather
    than fixing it. So `exampleHeaderLabel` is **deleted** (not defaulted) in favour of one
    shared `t.starters.suggestionsLabel` — a NOUN, which reads correctly in both states — and
    the four per-caller strings `starters.{habits,goals,plans,health}.tapToAdd` are gone from
    all three dictionaries. Six callers stopped passing a label; none may pass one again.
    **Nothing explanatory goes inside the revealed body either** (*"Rely entirely on the `+`
    icon inside the matte chips"*): the test asserts the expanded branch contains the caller's
    example rows and chips and no `<Text>` of the component's own.
  - **`Ingen oppgaver` / `Tom liste` are replaced by a narrator, not by a better placeholder.**
    A line naming an absence the user is already looking at is, on a bad day, a verdict on the
    day. `components/NarratorQuote.tsx` says something instead — a short, dry, first-person
    aside, cycled by a refresh glyph beside it (random line on mount, sequential and wrapping
    from there, faded out-swap-in with a `LinearTransition` so the height change doesn't snap).
    Live on the four cards the brief names: To-do's section lists and Recurring, an unlocked
    empty monthly Shopping list, Health's quiet week, Habits' day with nothing due.
    - **⚠️ This lifts VOICE.md's "one line, there is not a second" limit on first person**, which
      had stood since the day log shipped. Read VOICE.md's new top section before adding copy
      anywhere near it — the licence is narrow and its register is the load-bearing half: *the
      narrator admits things, the user is never told what they did.* Rule 23 binds it harder
      than the rest of the app, not less: nothing counts, compares, or can tell how long the
      screen has been empty, and nothing asks for anything.
    - **The forgetting stems are a documented carve-out, as a ratchet.** `glem*`/`forgot`/
      `gleym*` stay banned outright in `lib/i18n.ts`; two narrator lines are *about* forgetting
      and are the anti-shame content itself, so the test allows the stem only in an explicit set
      of exact strings. Entries removable, never addable.
    - **⚠️ It is the app's ONE italic**, a narrow instructed exception the day after the
      2026-08-18 blueprint pass deleted `fontStyle: 'italic'` from all 14 files that had it. The
      reasoning that made the ban right is what makes the exception right — italic was banned as
      a way of marking teaching copy as an aside *beside* real content, and there is no real
      content here; this IS the empty slot. A test asserts the exception is exactly one file
      wide. **And it is a real FACE (`Fonts.italic` = `Nunito_400Regular_Italic`, loaded at the
      font gate), NOT `fontStyle: 'italic'`** — RN does not map that style onto a named custom
      family, so the property beside `Fonts.regular` is synthesised on web and iOS and does
      **nothing on Android**. Every harness this repo can run (web preview, `npm run wraps`,
      every screenshot, `tsc`) would have shown a perfect slant over an upright shipped build.
      Same shape as the widget-palette lesson: a difference no local check can see.
    - **No container, and that is the instruction**: no Surface, no fill, no border, no radius.
      `plans.tsx`'s `sectionEmpty` box went with the strings it held — it was added 2026-07-11
      to give an empty section footing on the bare particle background, which stopped being the
      situation when sections moved inside `SectionCard`.
    - **Three empty states deliberately keep their copy**, so the gaps read as decisions: a
      search that matched nothing (the honest answer is that the filter is too narrow), an empty
      state that is itself a BUTTON (`WeekListCard`'s and Shopping's locked+empty rows — both
      were made tappable on 2026-08-11 *because* the copy pointed at a control that wasn't
      rendered, so replacing the copy takes the only way out with it), and a line that teaches
      what a list will CONTAIN (`HealthIssuesPreviewList`).
    - The lines live in a per-language data table rather than in `lib/i18n.ts`, because they are
      a *list the user cycles through* and a `quote1`/`quote2`/`quote3` family in three
      dictionaries cannot grow without three lockstep edits. `useLang()` (new, in `lib/i18n.ts`)
      is how the component reads the active code; it has exactly one caller and is not a general
      escape hatch. Norwegian is authored, EN and IS follow — **not** the "seed data stays
      Norwegian" convention, because this is the app talking, not content read past.
- **The seam pass — 2026-08-19** (`components/ScreenScaffold.tsx` + `BottomNav.tsx` +
  `TabSlider.tsx`, pinned by `lib/__tests__/chromeRhythm.test.ts` §3/§4). Maintainer: *"Bottom of
  header and top of bottom nav should work the same. Cards behind the edges should show when
  scrolling, and no blank space between"*, then, on where the clip should land: *"delete the
  blank strip and the parts in the corners in header and bottom nav"*, and *flush at rest too*.
  This finishes the clip window rather than reversing it — content is still cut at the glass, so
  "only the backdrop" is intact. Two things changed and they only work together:
  - **No gap at either end.** `headerFloatBottom` and both halves of `contentPad` are 0. The 8px
    was a strip of bare backdrop under the header at rest AND the strip a card was sliced across
    on the way past it — a card read as guillotined in open air instead of as passing under the
    glass, which is what the report is about. **The one-clearance-each rule survives and is why
    the two are still spelled separately**: the margin is where content is CUT, the padding is
    where it RESTS. A future gap comes back on `contentPad` alone, never on the margin.
    - ⚠️ **That future arrived (2026-08-27, round 20) — `contentPad` carries `CHROME_REST_GAP`
      (8) at BOTH ends now, and `headerFloatBottom` is still 0.** Reported as *"the top card is
      still touching the header when scrolled fully up, no breathing room"*. It is the reversal
      this very paragraph anticipated and it took the route the paragraph names: the gap is
      padding, `viewportInset` did not move, so a card is still cut at the glass and the corner
      notches are unchanged. **Both ends or neither** — the round 20 mockup drew 12 above and 28
      below from a bottom padding that overshot its own nav, and one constant at both ends is
      what stops that. Measured after: 9.5px and 11.0px, the difference being `Surface`'s ring.
  - **⚠️ An edge that faces content is SQUARE.** The header's bottom pair (`chromeFacingSquare`,
    now unconditional rather than only when a sticky bar is attached), the nav bar's top pair,
    and an `attachedTop` `TabSlider`'s corners — all 0; the viewport is square on all four to
    meet them. **A rounded chrome edge cannot be met flush by anything**, which is why this was
    reported twice from opposite directions inside one day: cut the content square against it and
    the sliced card's 90° corner stands in the notch the glass curved away from ("upper corners…
    and lower corners of header box"), cut it to a *matching* radius and the two arcs bow apart
    into a lens of bare backdrop ("the parts in the corners"). Deleting the notch is the only
    answer that has neither failure. The chrome's OUTWARD corners — the header's top, the bar's
    bottom — keep `Radius.lg`; nothing faces content there, and squaring them turns two floating
    cards into full-bleed bars.
  - **...and the screens stopped re-adding the strip one level down (same day, maintainer:
    *"Fix"*).** The first cut left every screen's own `content` wrapper on `padding: Spacing.md`,
    so the gap the scaffold had just deleted was still being drawn by 21 files instead of one.
    **The rule is about what the edge MEETS, not which tier the screen is**: a vertical edge that
    lands on the header's or the bar's glass is flush, an edge that lands on the safe area is not
    chrome and keeps its margin. So the tab screens pad horizontally only, the pushed
    sub-screens keep `paddingBottom` (they reserve no nav), and horizontal padding is untouched
    everywhere — the gutters are backdrop by design, and that padding is what insets every card
    from the screen edge. `components/CatalogueTab.tsx`'s `root` moved with them: its `paddingTop`
    existed *to match* that wrapper, so it had to follow it rather than be forgotten beside it.
    Pinned per file by `lib/__tests__/screenRhythm.test.ts`, which also bans the `padding:`
    shorthand there — that shorthand is how the top gap comes back without anyone naming it.
- **A field's halo is cut to the field's own shape — `getFieldGlow` (2026-08-19,
  `constants/theme.ts`; `lib/__tests__/chromeRhythm.test.ts` §5).** User report: *"The glow is
  squared, but the text-boxes inside are rounded. Do not just make them the same shape, link
  them/merge them so it works universally."* A `boxShadow` is cut to the border-box of the view
  it is set on, so a halo is round only if THAT view is round — and `components/AddRow.tsx` and
  `FormControls`' `Input` set it on the input, which carries a radius, while
  `components/PadTypeRow.tsx` hangs it on a wrapper View (a boxShadow on a TextInput renders
  unreliably on Android, and that field needs the wrapper for its absolutely positioned submit
  arrow) that carried none. So every Home card drew a square glow around a rounded well.
  **The fix is the merge, not the fourth copy**: `getFieldGlow(hue, level, radiusScale?)` returns
  `{ borderRadius: FIELD_RADIUS, ...getGlow(…) }`, so a caller cannot take the light without the
  shape it is cast from, wherever it hangs it.
  - ⚠️ **A field also reserves the ROOM its halo needs — `FIELD_GLOW_CLEARANCE` (2026-08-24,
    user report: *"Neon in/around text boxes are visually bugged, again."*).** The shape was
    merged with the light and the light was still being cut in half: a `boxShadow` is clipped by
    the nearest `overflow: hidden` ancestor, and what clips a composer is not the card's
    `Spacing.md` padding (the premise the bloom had been sized against) but the card BODY's fold
    — `components/Card.tsx` draws it with a `Collapsible`, which sits INSIDE that padding. A
    composer is a full-width child of it, so the room its light actually had was **zero**.
    Measured across the app: **31 of 36 haloed fields were clipped**, left and right halves
    sliced off flat at the field's own edges. The only one that looked right was the Today
    card's, which has a padded wrapper of its own — which is why every report of this named
    "the text boxes" generally and no single card in particular.
    Two halves, and neither works alone: the clearance is spent by the component that OWNS the
    field (`PadTypeRow`, `AddRow`, `CatalogueTab`'s search, `MedicineSurface`'s tray wells), so
    it travels with the control instead of depending on what a caller mounts it in; and
    `FIELD_GLOW_RADIUS` is now 3/4 (outer pass 5/7px), sized to fade INSIDE that clearance
    rather than inside a 16px that was never there. `Spacing.sm` is not arbitrary — it is the
    gutter `PadSheet` already insets its rows by, so a composer that reserves it lands in its
    list's own column, which is a second bug fixed by the same number (every PadSheet composer
    had been 8px wider than the rows above it).
    ⚠️ **Yoga trap, and it is how the bottom edge stayed clipped after the sides were fixed**: an
    edge-specific `paddingBottom` beats the `padding` shorthand whatever the key order, so
    `PadTypeRow`'s panel column had to give its own up rather than have the clearance layered
    over it.
    **`npm run halos` (`scripts/measure-halos.mjs`) is the guard**, and it has to be a
    measurement: `tsc` sees valid styles, Jest has no layout, and a screenshot shows a lit box
    whether or not the light is complete — the whole tell is that the glow stops dead instead of
    fading. It walks the five tabs in the web preview, opens every card (a composer inside a
    closed card is not in the DOM — the same silent-skip trap `npm run wraps` has), and compares
    each field's blur radius against the room before its clip. 0 clipped, 12 clean at 430px and 360px.
    `lib/__tests__/chromeRhythm.test.ts` §5 pins the arithmetic and the fact that each of those
    four components still names the constant. All three composers go through it and none of them
  restates `Radius.sm`. `getGlow` itself is untouched and still correct for anything that sets its
  own radius on the same view (the checkbox box, the Switch track) — the rule is about the
  field/halo PAIR, not a ban on the primitive.
  - **`components/IconButton.tsx` and `components/VoiceNoteFAB.tsx` finally got the 2026-08-17
    button treatment**, which had only reached `Button` and the ~18 hand-rolled action pills.
    Both dropped a `darken(fill, 0.22)` housing, a black cast shadow and (IconButton) a
    `LinearGradient` rim ring for `glassKey()` plus an outward `getGlow`. The FAB is the one
    documented exception to "flat and translucent": it floats over a scrolling list, so its
    glass body is painted over an opaque `theme.surface` disc — the same answer the chrome got
    in this pass, for the same reason.
- **⚠️ A card header is two icons plus at most ONE of the caller's own — 2026-08-31**
  (pinned by `lib/__tests__/cardAnatomy.test.ts`). The corrected screens count what shipped:
  *"Headers carried three to five controls — bell, mic, camera, lock, ⋮, expand, chevron — in
  different orders."* Its own answer is exactly two; the maintainer's ruling is **two plus at most
  one card-specific control**, which is what keeps the medicine bell (a live reminder switch, and
  rule 19a's documented exception) and Home's ⋮ where they are.
  - ⚠️ **Home's ⋮ is why the cap is one and not zero.** It is that tab's only way to put a card
    away — `components/ManageCardsSheet.tsx` is the four non-Home tabs' answer and Home is
    deliberately not one of its callers — so deleting it would strand hiding on the one screen
    that has no other route to it.
  - **Two cards were over, and both moved a control into the BODY rather than losing it.** Katalog:
    the camera went to the search row beside the "+" — a lock is a STATE the card is in, a scan is
    an ADD, and it belongs with the other add (which is also the mockup's own note, *"scan lives in
    its body"*). Notater: the mic went into the composer's options panel as a labelled
    `QuickAddOptionRow`, because dictating a note is a way of FILLING the field, so it belongs
    beside the field's other option rather than wedged into it — again the mockup's own words,
    *"voice capture lives in the note composer"*.
  - The guard counts the `controls` prop, since `Card` owns the fold and the ⤢ itself: a
    `controls={<>…</>}` FRAGMENT is how a caller passes more than one, so a fragment is the tell.
    Measured side effect worth knowing — `npm run wraps` went from **18 truncated to 6**: two
    fewer icons in a header is width a title gets back.

- **⚠️ The orb field is at 0.26 in dark, double the brief, and it costs no contrast — 2026-08-31.**
  Maintainer, against the round-20 mockups: the app is flat black where the mockup's frames are
  visibly lit. The ruling was *"light the frame, not the card column"* — the one option that pays
  no identity hue — and the licence for doubling is a MEASUREMENT, not an argument.
  - **The card ground does not move.** Measured on the real render before and after, by finding
    the Notes badge and taking the modal fill of the card under it: **rgb(36,36,36) both times**,
    exactly `surface`. So all five hues keep their ratios and Notes stays at 4.51:1 — a floor it
    has **no** headroom above (4.51 against 4.5). The corrected screens' own washes are 16–30% of
    the accent, so 0.26 is inside what they draw.
  - ⚠️ **LIGHT stays at 0.10.** None of that measurement was taken on it, and it has far less
    headroom before an ambient wash competes with a card.
  - ⚠️ **Three claims about this field were wrong, and the order they fell in is the lesson.**
    The file's prose said the orbs reach the card box at *"2-3% of an already-14% peak"*; a model
    built from `ORB_STOPS` said 42% and predicted a live AA failure; the actual pixels said the
    card fill is `#242424` and every hue passes. **Prose, then model, then pixels — and only the
    pixels were right.** Anything that raises this again needs the pixel measurement repeated.
  - ⚠️ **Why a whole-canvas wash was refused, with the number**: a card is translucent, so a wash
    behind it reaches the text on it. At 5% Notes drops to 4.01:1 and leaves the ladder; at 10%
    Shopping goes too; at the mockup's 16–30% only one to three of the five survive. The lit look
    is affordable *only* in the corners, which is what the geometry already guarantees.

- **⚠️ The orb crossfades animate a VIEW's alpha, never an `<AnimatedG>` — 2026-08-31**
  (`components/ScreenBackground.tsx`; pinned by `lib/__tests__/chromeRhythm.test.ts`). Maintainer,
  for the third time: *"Enabling/disabling visual effects helps a lot, but should not — visual
  effects should be possible without the app lagging."* That is the right complaint, and the two
  passes before this one had the target right and the mechanism wrong.
  - **What `reduceEffects` actually turns off in DARK is one thing, and that is how the cost was
    located.** Measured rather than assumed: an ambient card in dark already mounts no `BlurView`
    and casts no shadow (`flatDarkGround`, 2026-08-29), the header is opaque by design, and the
    web build reports **zero** `backdrop-filter` layers on every tab. So the switch was removing
    essentially one surface — the backdrop SVG — and the report says removing it "helps a lot".
    **A switch whose effect is that lopsided is a measurement, not a preference.**
  - **The mechanism: an animated prop INSIDE an SVG invalidates the whole canvas.** The field was
    four groups in one `<Svg>` with three cross-fading through `useAnimatedProps` on an
    `<AnimatedG>`. react-native-svg redraws on a prop change, so every frame of a fade re-ran all
    thirteen gradient-filled shapes and their shaders, full-screen — and `<G opacity>` is not a
    per-shape alpha, it is an offscreen buffer, i.e. a `saveLayer` per group per draw on Android,
    the classic Canvas cliff. Three animated groups, three of them, every frame. The fade fires on
    **every tab change**, which is exactly the gesture that was reported as laggy, and the whole
    group sits in a parallax layer that is translating at the same time.
  - **The fix keeps the picture exactly and is one canvas per layer**: `OrbCanvas` draws one
    colour's discs into its own `<Svg>`; `OrbLayer` wraps an animating one in an `Animated.View`
    and marks it `renderToHardwareTextureAndroid`. A swipe now costs a transform plus three alpha
    blends of already-rasterised textures and **no shader work at all**. Verified byte-identical:
    `npm run visual` came back 22/22 unchanged in both themes.
  - ⚠️ **Gradient def ids are suffixed per canvas, and that only matters on WEB** — every `<Svg>`
    renders into the one document there, so two canvases sharing an id would have the second win
    for both. It surfaces as "the growth tint is the wrong colour" and native never reproduces it.
  - ⚠️ **NOTHING in this repo can see this change** — the web preview composites a div's opacity
    the same way, so the pixel gate reports `unchanged`, which is both the proof it is safe and
    the reason it needs a source scan. Same family as the widget-palette copy and the
    `flex`-with-`flexBasis:'auto'` collapse: a difference no local harness can reach. The guard
    bans `AnimatedG`, `createAnimatedComponent(G)` and `animatedProps=` in that file outright.
  - **A native radial gradient was considered and refused.** RN 0.85 does support
    `experimental_backgroundImage: radial-gradient(…)`, which would delete react-native-svg from
    the backdrop entirely — but `react-native-web` implements none of it, so the orbs would vanish
    from `npm run preview`, every screenshot and every baseline while still shipping on device.
    That is the permanent blind spot this file has been bitten by twice. Revisit it only with a
    way to see the result.

- **The backdrop is ambient orbs, and it is pinned under everything — 2026-08-17**
  (`components/ScreenBackground.tsx` + `HomeHeroBackground.tsx` + `ParticleBackground.tsx` +
  `app/(tabs)/_layout.tsx`; pinned by `lib/__tests__/chromeRhythm.test.ts` §6). Maintainer: *"The
  current blue line-art background is causing severe visual interference. It is rendering ON TOP
  of the bottom navigation and text… Delete the sharp, chaotic vine/line art."* Two instructions
  that are two separate fixes — undoing either does not undo the other.
  - **`zIndex: -1`, said out loud, on all three backdrop layers AND on the group wrapper.** The
    old contract was "be the first child": true, and not a guarantee. Each of these mounts beside
    siblings that DO declare a z (`ScreenScaffold`'s header/sticky/bottom blocks at 99–100, the
    pager layout's nav overlay at 100), and the moment any sibling declares one Android sorts the
    whole container instead of drawing it in document order. The wrapper needs its own -1 as well,
    because a child's z only orders it among its own siblings — three pinned children inside an
    unpinned parent is still an unpinned parent.
  - **Three corner orbs replace the branch-and-leaf line art**, which is DELETED, not unmounted:
    `BRANCHES`/`LEAVES`/`GROWTH_STROKES`/`GROWTH_LEAVES`/`leafD`/`Cluster` are gone, so nothing
    can be quietly rewired back. Two orbs sit at the corners the brief names (top-right cyan,
    bottom-left violet) and a quieter third at top-left; **bottom-right is deliberately empty**,
    the one placement not taken from the brief — a second glow along the bottom edge would put
    the brightest part of the field exactly where the interference was reported. The hues are
    `IDENTITY_HUES.habits`/`.notes` taken far down toward black and hand-written rather than
    derived, because this is scenery and must not move when a categorical hue is recalibrated.
    The motif system (`constants/motifs.ts`, `components/Motif.tsx`) is untouched — only this
    file's own vocabulary changed.
  - ⚠️ **The blur is a radial falloff and that IS the implementation.** RN has no `filter: blur`
    for a View on native and `expo-blur` blurs what is BEHIND a view, not the view — so the
    brief's literal `blurRadius={90}` has nothing to attach to. A Gaussian blur of a flat disc is
    a radial alpha falloff, so `ORB_STOPS` draws that curve directly; each orb's radius already
    INCLUDES the blur spread, which is why the numbers are double the brief's 300px. Don't
    "upgrade" it to `<FeGaussianBlur>`: react-native-svg's filter support is uneven on Android and
    it would rasterise three full-screen layers on every frame the growth tint animates.
  - ⚠️ **No orb may reach the middle of the canvas, and that is load-bearing OUTSIDE this file.**
    `__tests__/glassMaterial.test.ts` measures every glass token against a `#000000` dark ground;
    that is honest only while nothing lights the pixels a card sits on — which is also why the two
    full-canvas radial glows are still held at opacity 0 rather than merely dimmed. The orbs earn
    their lift by staying in the corners. Moving one inward would leave those composite assertions
    passing while measuring a colour the app no longer draws, i.e. the PR #540 shape, so the
    geometry is a CHECKED property (§6 computes centre-distance vs radius at the top growth tier),
    not a promise in a comment.
  - **Growth is re-expressed, not dropped.** `level` swells the orbs (`ORB_GROWTH_STEP` per tier,
    from a high-water mark, so what grew stays grown — there is no fourth orb at a higher tier,
    since "2 or 3" is the cap and a new circle appearing would read as a new element); `intensity`
    still crossfades a second copy in green over the neutral pair. Neutral is still the floor and
    the user still sees no number. `lib/growth.ts` did not change and its header now says why: the
    arithmetic is about a streak, and how it is DRAWN belongs entirely to the backdrop.
  - **`HomeHeroBackground` came along in DARK.** It was already the right shape (a big soft glow)
    and wrong twice over: `rgb(90,150,255)` at a **0.32** peak — double the brief's ceiling, in a
    bright blue, on the app's default tab — centred at 50%/**34%**, i.e. straight through the card
    box. It was excluded from the true-black reasoning only by living in a different file. Now a
    muted blue at 0.13 anchored off the TOP edge, so what reaches the cards is the tail. LIGHT is
    untouched there; its field is a blue gradient with two broad ellipses already in it.
  - **Light mode generally is the lower-confidence half of this pass.** Its base gradient and both
    of its ellipses are unchanged and the orbs go on at a 0.10 peak in lifted (not darkened) hues,
    since a dark orb on a pale field is a smudge. It was NOT verified in the preview:
    `scripts/screenshot-states.mjs --theme=light` predates dark-becoming-the-default and only
    means "don't force dark", which now lands on dark anyway. Worth a look on a device, and worth
    fixing in that script.
- **⚠️ There is no full-screen ⤢ button anywhere — the TITLE opens a card (2026-08-22)**
  (`components/Card.tsx`; pinned by `lib/__tests__/cardAnatomy.test.ts`). Maintainer: *"Remove
  all full screen buttons, instead user just presses the title."* `SectionRail` has carried
  `onLabelPress` since 2026-08-10 and `Card` has wired every expandable card's title to
  `expand.onExpand` since the registry landed, so the button was a SECOND control for a thing the
  title already did — and the widest item in the cluster. Deleting it is the whole change: the
  measure ref, the animation geometry and `useCardExpand` are untouched, because none of them
  care which control fires.
  - ~~**The trailing cluster is `{controls}` → fold, and the fold is outermost**~~ — ⚠️ **the
    order is `fold → {controls}` → ⤢ as of 2026-08-27 (round 20), with the ⤢ outermost.** This
    line has now been every arrangement it can be: `controls → fold → ⤢` (2026-08-20) →
    `controls → fold` (2026-08-22, the ⤢ deleted app-wide) → `controls → ⤢ → fold` (2026-08-26,
    the ⤢ back one step inside the fold) → this. Round 20's drawn screens put the chevron first
    and the ⤢ in the corner, and the maintainer ruled for the mockup.
      What the latest reversal buys, since the previous order was not arbitrary either: the ⤢ is
    the one control that changes which SCREEN you are looking at, and it now sits in the same
    corner on every card whether or not that card folds — which the old order could not, since a
    non-folding card's ⤢ landed exactly where a folding card's chevron did. It also draws at
    `IconSize.compact` (30, nearest the mockup's 29) rather than `action` (36); the tap target
    is unmoved, because `IconButton` floors it at `max(MIN_TAP_TARGET, size + Spacing.sm)`.
    `lib/__tests__/cardAnatomy.test.ts` still asserts the ABSENCE of anything after the last
    control rather than an ordering alone, so deleting the cluster cannot pass it.
  - **`components/CardExpandButton.tsx` still exists**, for exactly one job: the expanded pane's
    own close control in `components/CardExpandHost.tsx`. The import ban is what keeps a card
    header from reaching for it again.
  - The title carries `labelPressHint` (`<card title> — <t.expandCardLabel>`), because the one
    control left is otherwise a name that does not announce itself as a control.
  - **Alignment came with it** (*"Move other buttons to fit, and make sure they are aligned"*).
    `CardCollapseToggle` took back a `minWidth: IconSize.action` so the chevron's optical centre
    matches the `IconButton`s beside it — flush-right, an 18px glyph sat 9px from the card edge
    where a 36px cap sat 18px, so the trailing control landed differently depending on whether a
    card had caller controls. This does NOT reopen the 2026-08-21 width argument: that pass was
    paying 30px for a 48px box on a header that ALSO carried a 36px ⤢, and deleting the ⤢ gave
    back more than this costs. `Card` also passes `rowMinHeight={MIN_TAP_TARGET}`, so every card
    header is one height whether or not its title is pressable — an asymmetry the ⤢ had been
    hiding by flooring the row from the other side on exactly the expandable cards.
  - ⚠️ **`components/PlanTaskCard.tsx` was the FOURTEENTH card header** and the last one outside
    the registry; its non-embedded shell is `Card` now (`homeToday`). It showed: on Home, "Today"
    was the one card in the stack with no fold chevron, because a hand-rolled header has whatever
    controls its author remembered. Its `embedded` path is unchanged and still a bare `View`.
  - `SectionRail` gained a `countRef` — a MEASUREMENT hook, not anatomy — because
    `HomeShoppingCard`'s tick animation flies a row to the header count, which `Card` draws now.
    It also glosses a `{left, total}` count with `t.pad.summary` for screen readers, which is
    where that wording went when the hand-rolled count pills were deleted.

- **⚠️ One card shape — the card registry (2026-08-21)** (`lib/cardRegistry.ts` + `components/Card.tsx`;
  pinned by `lib/__tests__/cardRegistry.test.ts` and `cardAnatomy.test.ts`). **Read this before
  adding, moving or restyling any card — most of the card notes below it describe how things were
  reached, not how a card is built now.** The maintainer's fourth pass on the same instruction:
  *"Things are placed differently. Not all cards can be collapsed. Not all cards can be in full
  screen. It just feels like a bunch of cards per screen. No order, no logic."* The ruling was to
  fix the EXECUTION — three tabs and card stacks stay.
  - **The cause was the guards, not the cards.** Every rule in `DESIGN_RULES.md` §8 was a source
    scan over an ALLOWLIST — the cards that were already right — so **a new card was compliant by
    default** and the suite stayed green through 13 distinct header-control orders, 7 components
    drawing a card header (9 of them hand-rolled), 3 fold mechanisms, ⤢ on 10 of ~30 cards, and a
    card whose fold id and expand id were different strings. §8 even wrote the escape hatches in:
    rule 27 tracked convergence as *"an allowlist that must shrink"*, and `cardAnatomy.test.ts`
    pinned the WRONG control order on purpose. **The generator was the target, not the instances.**
  - **A caller no longer describes a card, it names one**: `<Card id="todoToday" count={n}>`.
    Screen, position, hue, badge, glyph, title, fold, ⤢ and resting state are DATA in
    `lib/cardRegistry.ts`; `components/Card.tsx` is the only thing that reads them and the only
    thing that draws a card header. **There is no prop for any of it**, which is what makes a
    fourteenth order unspellable rather than discouraged.
  - **`CardId` and `ExpandableCardId` are DERIVED from the registry**, not hand-maintained. So an
    unregistered card is a **tsc error**, and — because `CardExpandHost`'s `CARD_BODIES` is
    `Record<ExpandableCardId, …>` — `expand: 'surface'` with no body is a tsc error for free.
    Declining a fold or a ⤢ is supported and demands a written `foldDeclined`/`expandDeclined`,
    asserted non-empty. `lib/cardDefaults.ts` is **deleted**: `openAtRest` replaces it.
  - **The load-bearing guard is a BAN**: no file outside `components/Card.tsx` may import
    `CardCollapseToggle` or `CardExpandButton`. One assertion, stronger than every list it
    replaces. The single door is `SectionFoldToggle`, exported from `Card.tsx` for the one thing
    the registry cannot key — see the boundary below. There is deliberately no ⤢ equivalent.
  - **The boundary, and it is mechanical rather than a judgement call:** *a CARD is a thing the
    registry names; a SECTION is drawn one-per-row-of-user-data.* A card gets a `Surface`, the
    registry's rail, a persisted fold and a ⤢. A section gets no `Surface`, a `sub` rail, a LOCAL
    fold and **no ⤢** — it rides its parent's. The test is "is this inside a `.map()` over user
    data?". Consequence: Shop's per-list cards are sections, and that tab went from ~12 top-level
    `Surface`s to **4** — "every card has a ⤢" is reached mostly by SHRINKING the set of cards.
  - **One fold axis.** `PadState` lost `'closed'` and is `'preview' | 'open'` — how many ROWS,
    nothing else. It was the second mechanism owning open/closed, and the two disagreed about what
    the word means: a "closed" pad card drew header + empty rule + Suggestions + composer (~400px)
    beside a 70px bare header one tab over. `PadFooterToggle` survives because it can say *"3
    more"*, which a header chevron has nowhere to put; the two can never both show, because
    **closed is a bare header** — by construction (the rail's hairline follows the body, the
    bottom inset matches the top), not by each caller remembering.
  - **The heading ladder is three real `SectionRail` tiers** (decision (a)): `'group'` 24 with
    **no badge**, `'card'` 20 with the badge, `'sub'` 17 with a dot. It had existed as prose in
    `SectionRail`'s own source while only two tiers existed, so every card title rendered at 24 —
    and a badge on a heading over CARDS is what made every drawer read as a card itself.
  - **Order is declared per screen.** To-do: Today → Week → Whenever → Recurring → the app's ONE
    group rail, "Elsewhere" → Goals, Earlier days, Washed away. Shop: Shopping lists → Food +
    Catalogue → Monthly, **no group headers** (declined). Me: Habits, Notes, Health, Medicine,
    Retired — a DEFAULT only, since that tab keeps its drag-reorder.
  - **Deleted or renamed, so nothing is quietly rewired**: `components/CollapsedSection.tsx` is
    gone (its five drawers are cards; the two-tap-target header exception to rule 4 goes with it,
    and Health issues' sheet became a header CONTROL). `ExpandableCard.tsx` is
    `DisclosureRow.tsx` — it is a generic accordion inside cards and sheets, not a card, and two
    things called "card" with two fold mechanisms is how the app came to have three.
    `components/SectionCard.tsx` is a shim over `Card`'s `CardShell` with three callers left, all
    sections; **do not add a prop to it.**
  - **Deliberately out of the registry**: `HomeSharedCard`, `EnergyBalanceCard` and
    `SharedTasksSection` are behind `SHARING_VISIBLE` and do not render at all today. Left
    untouched rather than converted or deleted; they get entries when sharing returns.
  - ⚠️ **Two `scripts/preview.mjs` steps had to follow the app** — the Habits composer does not
    exist until its card is opened, and its `/habits` push became an in-place expansion. Same
    trap as the wrap audit's silently-skipping steps: a step that can't find its target times out
    thirty seconds later, nowhere near the cause.
- **The registry restructure — phase 5 of `DESIGN_COMPARISON/19-IMPLEMENTATION.md`
  (2026-08-26).** Applies the card/section boundary the registry entry above states but had not
  yet been swept across the app: a card the registry names gets a `Surface`, a persisted fold and
  a ⤢; a section drawn one-per-row-of-a-parent's-own-data gets none of those and rides its
  parent's card instead. Five cards became sections inside their parent: `shopMonthly` (into
  `shopLists`), `habitsGoals` (into `habitsList`), `todoGoals` + `todoEarlierDays` (both into
  `todoToday`), `todoWashedAway` (into `todoWhenever`) — the maintainer's own instruction, since
  it applies the Goals principle already settled elsewhere. A section's fold is LOCAL
  (`useState`, unpersisted), same as the Week card's seven weekday sections already were — it is
  not a new mechanism, just a boundary applied more widely.
  - **`todoMonth` is new**: To-do's fifth card, a DATE FILTER between Week and Whenever —
    non-recurring dated tasks in the current calendar month that Week doesn't already show
    (`hasStartDate && recurring==='none'`, month-of `today`, excluded if the date is one of
    Week's seven). **Not monthly recurrence** — AGENTS.md's task-reset entry excludes monthly
    recurrence from `normalizeRecurringTasks` because there is no per-occurrence completion row;
    a date-filtered SECTION has no such problem, since it's the same question `todoWeek` already
    asks, one rung out. Composing into it defaults the new task's date to the last day of the
    current month, so a fresh row is guaranteed to land inside the card that created it.
  - **The first card on each screen rests open** (`openAtRest`), softening 2026-08-21's
    all-closed default — `shopLists`, `todoToday`, `habitsList`, `healthWeek`. This is a SEPARATE
    exception from Home's three named cards (Today/Notes/Shopping), which predate it and are
    unrelated in reasoning (Home's is the maintainer naming three specific surfaces; this is "a
    screen's own first card isn't a bare header on first open"). `lib/__tests__/cardRegistry.test.ts`'s
    global cap ("opens at most three cards at rest") became a per-screen rule — at most one
    `openAtRest` card per non-Home screen, and it must be that screen's lowest `order` — because
    the cap that was right when only Home had an exception stopped being a sentence once every
    screen did.
  - **The "Elsewhere" group rail is gone.** It existed only to sit over `todoGoals`/
    `todoEarlierDays`/`todoWashedAway`, which are sections now — a group rail over a stack of
    SECTIONS inside one card is not a thing this app draws. `t.todoElsewhereTitle` is an inert
    i18n key rather than deleted, on the same "never re-derive a stale claim" caution as
    elsewhere in this file; nothing reads it.
  - **Not done in this pass** (explicitly out of scope, left for whoever picks up phases 7–8):
    `lib/cardRegistry.ts`'s `compose`/`group` fields, the composer-options-per-card table, and
    Manage-cards generalised beyond Home.
- **Shop's Archive — phase 6 of the same handoff (2026-08-26).** `shopping_lists.archived_at`
  (nullable, new) puts a past weekly list away without deleting it — a DIFFERENT axis from
  `isTemplate`, which already was (and still is) "a saved list you can start a NEW one from"
  (the Saved-lists feature). `store/useShoppingListStore.ts`'s `archive(id)`/`unarchive(id)` are
  thin `update()` wrappers; `currentList()` and `advanceRecurringLists()` both exclude an
  archived list, same as they already excluded a template. **Not synced** — `shopping_lists`
  isn't in `lib/liveSync.ts` at all, so this needed no `TABLE_COLUMNS` decision and no
  `syncRows` call. **Not in the AI setup guide** — archiving is presentation/organisation of a
  user's own device, not data a household would want an AI import to move.
  - ⚠️ **The three-state list split (In list / In cart / Bought) the handoff asked for TURNED OUT
    TO ALREADY EXIST**, shipped 2026-08-11, and built on a DIFFERENT predicate than the handoff
    assumed: not `checked`+`collected`, but `status` (`inWeeklyList`/`purchased`) + `checked` —
    see `lib/shoppingGroups.ts`'s `computeListGroups()` header, which already explains why:
    `collected` was never added to `lib/liveSync.ts`'s sync whitelist, so a section keyed on it
    would silently disagree between two paired phones, while `status`/`checked` both sync. The
    2026-08-26 maintainer ruling on `collected` (device-local, don't sync it) CONFIRMS that
    2026-08-11 design rather than changing anything — no code moved. `collected` itself still
    exists and still means "ticked off inside the cart, before checkout" (a fourth, finer state
    that only shows once a list is expanded), and is not part of the three top-level sections.
- **Putting a card AWAY — one "Manage cards" entry per screen (2026-08-30)** (`lib/hiddenCards.ts`
  + `lib/useHiddenCard.ts` + `components/ManageCardsSheet.tsx`, over the new `settings.hidden_cards`
  column; pinned by `lib/__tests__/hiddenCards.test.ts`). Round 19's phase 8 — *Manage cards
  generalised beyond Home* — finally built, and the maintainer settled its one open question first:
  a per-card ⋮ matching Home, or one control per screen? *"One for each screen, not per card."*
  So a screen carries a single header icon (`ScreenScaffold`'s `onManageCardsPress`, the same shape
  as `onLayoutPress`), and no card gains a control — which is also why the registry-governed header
  cluster (`cardAnatomy.test.ts`) is untouched by this.
  - ⚠️ **NO "Retired" shelf, anywhere, and that is what one entry per screen BUYS.** A shelf is
    only needed where the hide affordance is per-card, so something else has to name what is
    gone. The entry point already lists every card, present or not — a shelf would be a second
    place saying the same thing. Don't add one. (Home had one until 2026-09-01, for exactly that
    reason; it went with the ⋮.)
  - **A FOURTH axis, and the five are worth reading together before touching any of them**:
    `lib/cardLayout.ts` is how much DETAIL a row shows; `lib/padState.ts` is HOW MANY rows;
    `lib/collapsedCards.ts` is whether the BODY is drawn; this is whether the card is on the screen
    AT ALL. A collapsed card keeps its header, its count and its chevron, so the way back is on
    screen. A hidden one is not drawn, and the only way back is the sheet that hid it — which is
    exactly why the entry point is permanent header chrome and why **a screen may be emptied**
    (the same reasoning that let Home's old "floor of one card" go).
  - **An ARRAY, not a bag of booleans** — where it deliberately differs from `collapsedCards`.
    That one stores only what the user moved OFF a card's resting state, so `{}` keeps meaning
    "the app as designed". Hiding has no per-card default to diverge from, so the honest shape is
    "the ones you put away". Sanitized on READ against `CARD_KEYS`, so a card dropped from the
    registry cannot leave a sheet row pointing at nothing.
  - **`components/Card.tsx` returns `null` when its id is hidden** — one place, after the pane-body
    early return, so this works for every card in the app without editing any of the four surfaces
    that draw them. A `null` child in a `gap` container is not laid out, so the screen rhythm needs
    nothing.
  - ⚠️ **Home was NOT a caller until 2026-09-01, and the reversal is worth reading with the
    reorder entry below it.** The note read: *"Home is deliberately not a caller — its cards are
    PREVIEWS of other tabs and carry `lib/homeCards.ts`'s forced-restore rule that exists because
    they are previews. Two mechanisms acting on one card is how a card comes back from one and
    stays gone in the other."* That argument was sound and it was an argument for deleting the
    OTHER mechanism, which is what the maintainer ruled. `settings.homeCardOrder`,
    `components/CardMenuSheet.tsx`, `components/HomeCardManager.tsx`, `lib/homeCards.ts` and the
    `homeRetired` registry entry are all gone; the test pins that no file imports or draws any of
    them again.
  - Not in `aiSetupApply`'s `SETTINGS_WHITELIST` — an AI-authored file must not be able to hide the
    app's surfaces, the same carve-out `collapsed_cards` and `design_lab` take, so **no
    `AI_SETUP_SCHEMA_VERSION` bump** — and not in `SyncTable`: which cards YOU keep on YOUR screen
    is not household state. Presentation only, enforced like the other three: a hidden card's rows
    keep their reminders and still count.

- **…and REORDERING one — the fifth axis (2026-09-01)** (`lib/cardOrder.ts` + `lib/useCardOrder.ts`
  + the reorder half of `components/ManageCardsSheet.tsx`, over the new `settings.card_order`
  column; pinned by `lib/__tests__/cardOrder.test.ts`). Maintainer, against the shipped app:
  *"One button per screen for reordering and/or hiding cards instead of the three dots was
  disregarded, and now it's not how we agreed to do it."* The 2026-08-30 pass built the button and
  the hiding and deferred the order; this is the rest, and it converts **Home** onto the same two
  columns in the same pass — so there is one mechanism for every card on every screen.
  - ⚠️ **The deferral's stated reason was right, and doing it meant paying it.** `cardsForScreen()`
    had exactly one consumer (the sheet) and every screen's cards were hardcoded JSX. All five
    screens now build a `Partial<Record<CardKey, ReactNode>>` and render `useOrderedCards(screen)`
    over it. A gated card (Medicine behind `featureMedicine`, every card while `embedded`, three of
    To-do's four in a `section` mount) simply has no entry and is skipped: `orderedCards` returns
    what the REGISTRY has, and only the mount site knows what it can actually draw.
  - ⚠️ **A stored order is a PREFERENCE LIST, not the truth, and that is the load-bearing bit.**
    `orderedCards` returns every card the registry gives a screen — stored ids first, then anything
    the list does not mention, in registry order. So a card added in a LATER build appears, at its
    registry position, instead of vanishing for everyone who has ever reordered that screen. A
    partial list is normal, not damage. Unknown ids and ids filed under the wrong screen are
    dropped on read.
  - **Two ways to move a card, and the arrows are not a convenience.** Drag is `lib/useDragReorder.ts`,
    the app's one reorder gesture. The ↑/↓ buttons are what makes the capability CHECKABLE:
    Playwright cannot activate `activateAfterLongPress(400)` in the web build at all, so a
    drag-only control is one no harness here can reach — and a hold-and-drag is not operable by a
    screen-reader user either. `scripts/preview.mjs` drives the arrows and asserts the new order
    survives a tab round-trip, which is the only proof the column round-trips through SQLite.
    ⚠️ They are **arrows, not chevrons** — a chevron means FOLD everywhere else, and
    `cardAnatomy.test.ts` fails any file but `CardCollapseToggle` that draws one.
  - **Same-object no-op contract on both mutators** (`withCardMoved`, `withCardOrder`), so a move
    at either end or a drag that ends where it started writes nothing — the guard `lib/storeCrud.ts`
    exists for one rung down, and the reason is the same: a no-op that costs nothing visible is not
    missed by a test suite unless it is pinned deliberately.
  - **`settings.homeCardOrder` and `settings.cardLayouts` are INERT now** (never dropped — see
    `store/useSettingsStore.ts`'s "Inert columns"). The first was Home's own order/hide column; the
    second lost its picker when the "how things look" header button was deleted in the same round.
    `layoutDetail`, the global three detail levels in Settings → Personal, is untouched and live.
  - ⚠️ **REORDER of the SCREENS themselves is still not a thing, and neither is a per-screen
    default other than the registry's.** `order:` in `lib/cardRegistry.ts` is still what a user who
    never opens the sheet gets, and the per-screen rules that ride on it (`openAtRest` must be the
    screen's lowest `order`, `cardRegistry.test.ts`) are unaffected: this layers a preference over
    that order, it does not replace it.
  - Not in `aiSetupApply`'s `SETTINGS_WHITELIST` (an AI-authored file must not be able to rearrange
    the app's surfaces — **no `AI_SETUP_SCHEMA_VERSION` bump**) and not in `SyncTable`: the order
    YOU keep YOUR cards in is not household state.

- **⚠️ A sheet's dismiss pill has to announce itself as a button — all ten of them did not
  (2026-08-30, `lib/__tests__/sheetDismiss.test.ts`).** Every bottom sheet's way out was a
  `PressableScale` with a `<Text>` child and no `accessibilityRole`, so react-native-web rendered a
  plain `<div>`: obviously a button on screen, a paragraph to anything reading the tree. Since that
  pill is the ONLY way out of a modal covering the screen, a screen-reader user who opened one had
  no announced control to leave by.
  - **Found by a harness, not by reading.** `scripts/preview.mjs`'s new step reached the Manage
    cards sheet's Done with the same `getByRole('button', …)` it uses everywhere else, and it timed
    out. `tsc` sees valid props, the pixel gate sees nothing (a role draws no pixels), and
    `npm run wraps` has no reason to visit it — so nothing else in this repo could have.
  - ⚠️ **It propagated by COPYING**: `components/LayoutPickerSheet.tsx` was the model the new sheet
    was written from, and it had the same gap. That is the argument for the test being a structural
    scan over the shared `styles.doneBtn` shape rather than a list of components — a new sheet is
    covered the moment it is written, which is the property the ten copies lacked.
  - ⚠️ **`app/shared.tsx`'s `doneBtn` is NOT one of these** — it is a row's completion toggle that
    happens to share the style name, and a blanket sweep labelled it `"button"`, which announces
    neither that it is ticked nor what ticking does. It is `checkbox` + `accessibilityState` now.
    The lesson is the sweep's, not the file's: a style name is not a semantic. `components/HealthIssuesSheet.tsx`
    is the other non-case — it uses the shared `Button`, which owns its own role, and the test skips
    `<Button` rather than making it restate what the component already declares.

- **Folding a card away — the 2026-08-14 collapse pass** (`lib/collapsedCards.ts` +
  `lib/useCollapsedCard.ts` + `components/CardCollapseToggle.tsx`, over the new
  `settings.collapsed_cards` column; pinned by `lib/__tests__/collapsedCards.test.ts`).
  Maintainer: *"Every card should be collapsable"*, remembered across launches. A folded card
  keeps its header, its badge and its count and draws nothing else.
  - ⚠️ **A card RESTS CLOSED as of 2026-08-21** (maintainer: *"All card start in closed state,
    except 'Today' 'Notes' and 'Shopping' in middle screen"*), and the exceptions are stated ONCE
    in **`lib/cardDefaults.ts`** — shared with `lib/padState.ts`, because the three cards excepted
    are drawn by both mechanisms and "Today" is reachable through either depending on the active
    layout. Neither module carries a default of its own any more.
      Both bags now store **only what the user has moved OFF a card's resting state**, so `{}`
    keeps meaning "the app as designed" and a card whose default later moves follows it for
    everyone who never had an opinion. That makes an explicit `false` meaningful for the first
    time. Existing installs were FORCED onto the new defaults (*"We're not live yet, so just
    force"*) by a migration that EMPTIES both columns rather than writing the new values —
    `cardDefaults` stays the only place a resting state is decided.
  - **It is a THIRD axis, not a rival to the two that already exist**, and the names are close
    enough to be worth stating: `lib/cardLayout.ts` is how much DETAIL a row shows (per surface,
    a user setting); `lib/padState.ts` is HOW MANY rows are drawn (closed/preview/open, per
    surface, the footer chevron); this is whether the card's body is drawn AT ALL. The first two
    share the `LayoutSurface` union and the `card_states`/`card_layouts` columns; this one has
    its own `CardId` union and its own column, deliberately — widening `LayoutSurface` so the
    medicine tray could be folded would imply the medicine tray has a layout too.
  - **The rule for which mechanism a card uses**: a card with a pad state uses the pad state
    (Habits' and Notes' Home cards and the To-do timeline, via `PadFooterToggle`); every other
    content card uses `collapsedCards`. Two affordances with two storage backings on one card is
    the thing to avoid — which is why `homeHealth` and `homeMedicine` take a `CardId` (neither has
    a pad state) and Habits/Notes do not.
  - **`CARD_IDS` is hand-maintained, and every entry is a SINGLETON.** The union IS the
    validation — a typo is a compile error rather than a card that silently never remembers —
    and that property stops holding the moment an id is built at runtime, which is why there is
    no per-list or per-day collapse (Shopping's monthly cards, To-do's day groups; folding the
    GROUP is what "collapse the monthly lists" means). **Twelve ids today** (2026-08-21):
    To-do's Today/Whenever/Recurring/Week, the Habits list card, Health's This week, Shop's two
    groups (`shopLists`/`shopMonthly`) and two library cards (`shopDishes`/`shopCatalogue`), and
    Me's `homeHealth` and `homeMedicine`. `healthMedicine` was renamed to `homeMedicine` when that
    card moved screens — normally a rename re-opens the card for everyone who had folded it, and
    it cost nothing here only because the same pass empties the column.
  - **Absent on purpose, so the gaps read as decisions**: `HintCard`/`StarterCard` (one
    glanceable block each, both already have an ×), rows (`TaskCard` expands in place),
    `OpenEpisodeCard` (a two-button prompt with no body, and folding it must not be mistakable
    for answering it), `EnergyMeter` (its label lives inside the meter, so nothing is left when
    it folds), and the two `SHARING_VISIBLE` cards, which don't render at all today.
  - `SectionCard` takes an optional `collapseKey`; the foldable path is a **separate component**
    so a caller without the prop subscribes to no store — otherwise every per-day section on the
    To-do tab would re-render on any collapse anywhere.
  - Presentation only, and enforced the same way the other two are: a folded card's rows keep
    their reminders and still count. Not in `aiSetupApply`'s `SETTINGS_WHITELIST` (an AI file
    must not be able to hide the app's surfaces — **no `AI_SETUP_SCHEMA_VERSION` bump**), and
    not in `SyncTable`.
- **One rhythm — the 2026-08-08 spacing pass** (`SCREEN_GAP` in `constants/theme.ts`, pinned by
  `lib/__tests__/screenRhythm.test.ts`). From a user report on the To-do and Habits tabs:
  *"the spacing between different elements, and the structure — it's not clear how things are
  related, how to use, and the spacing varies."* All of it traced to one cause.
  - **Spacing was a property of the CHILD, and half the children forgot.** Every card declared
    its own `marginTop`/`marginBottom`, so the gap between two cards was whatever the pair
    happened to add up to. Measured down one column on To-do: **8 → 40 → 0 → 0 px** —
    `PlanTaskCard` said `marginBottom: Spacing.sm`, `SectionCard`/`CollapsedSection` said
    `marginTop: Spacing.xl` (Decision 043 rule 2), and `SubScreenLinkButton` said nothing, so
    the only thing separating two link cards was the 8px key-base sliver `Surface` draws under
    a tappable card. Home ran its whole stack at 8 while the list screens ran at 32. Habits had
    the same split *inside* one card: `Spacing.md` above the list, **0** between the list, the
    composer and the Goals row.
  - **The screen owns the gap now.** `gap: SCREEN_GAP` on each screen's scroll-content
    container; no card carries a vertical margin. The test asserts both halves — don't "fix" a
    tight card by giving it a margin, fix the container.
  - **A closed `Collapsible` still books a gap slot** (it stays mounted at zero height), so an
    always-mounted-sometimes-empty child must be grouped or conditionally rendered. To-do's two
    filter rows share one wrapper; Habits' person filter is now gated on `showHabitProfiles`.
    This is the one trap the `gap` approach introduces, and it is invisible on a screen where
    the filter happens to be showing.
  - **With every gap equal, grouping is what carries relatedness** — see `DESIGN_RULES.md`
    rule 3a. The worked example was `SubScreenLinkButton`: it exported one
    badge-and-no-chevron CARD per destination, so To-do ended with three same-sized white
    cards in a row of which the first was a section of the screen and the other two were doors
    out of it. That pass made it a small chevron ROW instead. **Superseded 2026-08-10 — see
    "One card for every sub-screen link" below; that component is deleted.**
  - Two smaller things in the same pass, both visible in the report's screenshots: a collapsed
    `CollapsedSection` had ~24px of blank card under its header rule (its `paddingBottom` is
    open-state-dependent now), and Habits' "No habits yet" line was a full `<Surface>` inside
    the Habits card — a card-in-card at the same rung — and is now the quiet inset line
    `app/(tabs)/plans.tsx` has always used for an empty section.
- **One chrome edge — the 2026-08-10 clipping pass** (`components/ScreenScaffold.tsx`, pinned by
  `lib/__tests__/chromeRhythm.test.ts`). Maintainer: *"Nothing should be visible (cards, text,
  buttons and so on) above the header, or under the bottom nav"*, and fix the strips above and
  below the same way as the bar's corners.
  - **The header and the nav still float; the CONTENT is clipped.** The scroll box is a
    `styles.viewport` with `overflow: 'hidden'`, inset by the chrome (`viewportInset`) — top by
    the header plus any sticky bar, bottom by the nav's full painted footprint. It used to be
    `contentContainerStyle` padding on a full-bleed ScrollView, so content merely STARTED below
    the header and then scrolled behind it, leaking through six separate transparent gaps: the
    8px side margins beside both bars, the header seam, all eight `Radius.lg` corner notches,
    the status-bar strip, and `NAV_PEEK`. **Put the clearance on the wrapper's margin, never
    back on the content's padding** — both at once double-counts it and every screen grows a
    blank band.
  - **The window is the chrome's SHAPE, not just its band (same-day follow-up, user report:
    "edges do not work like previously described, same with header").** The first cut clipped to
    a full-bleed rectangle: content was guillotined by a straight edge spanning the whole screen
    while the header and bar above and below it are side-inset cards with `Radius.lg` corners,
    and content could still sit in the two 8px gutters beside them where no chrome covers it.
    `viewportInset` now carries the chrome's own `headerFloatH` side margins and rounds the
    corners that face a chrome card — the bottom pair only when a bar is actually reserved,
    since on a sub-tier screen that edge is just the safe area. **`viewportBleed` is the inner
    scroll box's mirror-image negative margin and is load-bearing**: the 8px is clipped off
    empty backdrop (every screen's content container already pads by `Spacing.md`), so nothing
    moves. Add the inset without it and every card in the app gets 16px narrower.
  - **`NAV_PEEK` is deleted.** It shaved `Radius.lg` off the bottom reserve so a scrolled card
    peeked into the bar's rounded corners — added 2026-07-26 on the *opposite* request ("let a
    scrolled card show through the corners"). This is a reversal, not drift. Don't reintroduce
    a peek constant; the clip would swallow it anyway.
  - **`topInset` has to agree with itself.** `SafeAreaView` pads a listed edge with the RAW
    `insets.top` while the header block floors it with `StatusBar.currentHeight`; on Android
    those disagree until the first insets dispatch. `'top'` is off `safeAreaEdges` and applied
    by hand now, or the viewport's top edge sits above the header's bottom edge and content
    renders in the difference.
  - Both absolute chrome blocks are `pointerEvents="box-none"` — they are full-width
    zIndex 99/100 views whose margins are transparent, and without it those strips swallowed
    every tap aimed at the content under them.
  - **The header and a sticky tab bar are ONE card.** `headerFloatBottom` goes to 0 when a
    screen passes `stickyBelowHeader`; the header squares its bottom corners
    (`headerAttachedBelow`) and `TabSlider`'s `attachedTop` squares its top ones and drops its
    top border. That 8px seam was transparent, so scrolled content flickered through it.
    `TAB_SLIDER_HEIGHT` is exported from `components/TabSlider.tsx` and is the ONLY source of
    that number — it was hand-copied four times (46, 46, 48, 56) against a real 46, and every
    surplus px becomes leftover space a caller's `justifyContent: 'center'` splits around the
    pill. The segment is 34 (was 38) for the "slightly slimmer" request; that widens
    `DESIGN_RULES.md` open conflict #6 rather than adding a new exception.
  - **The bottom nav's pill has five slots, not four.** Home used to have none: selecting it
    slid the pill to the centre button's x, faded it out and unmounted it, which read as the
    indicator "just disappearing". It now morphs `width`/`height`/`borderRadius` into a circle
    grown beyond the 56px FAB, so an `accentSoft` ring frames Home the way the
    rounded rect frames a side tab. No opacity, no mount/unmount. The side pill is offset by
    `Travel.sm` because it only ever sits under a tab that is itself sunk.
  - **...and the pill has to FIT IN THE BAR (same-day follow-up, user report + screenshots:
    "visual bug where bottom nav blue is").** The bar is a `Surface`, which clips its children
    to its own rounded mask, so a pill bigger than the bar is drawn **sliced**, not
    overflowing — and both slots were: Home's ring was `56 + PILL_GROW_X * 2` = 72 inside a
    72px-tall bar and came out a flattened grey squircle, while a side pill's bottom corner ran
    into the bar's own `Radius.lg` corner arc on the outermost tab. `PILL_INSET` + `clampTop()`
    keep the side pill inside, and it is measured, never `BOTTOM_NAV_HEIGHT` — this bar runs
    through `useScaledStyles`, so the constant is only true at font scale 1.0. Two shadows
    went in the same pass and should not come back: the pill's `getLayeredShadow(…, 'raised')`
    (a hue-less grey blur under a pale `accentSoft` plate reads as a dirty donut, and an
    indicator drawn behind a tab has nothing to be raised off), and `Shadow.fab` on the Home
    button.
  - **The Home ring is sized from the ring outward, and nothing in the bar has a halo
    (2026-08-11, user report + screenshots: "look at the bottom nav home button").** The two
    passes above left three things competing for the 8px of slack a 56px FAB has inside a 72px
    masked box, and the result was a lopsided plate, not a frame: the ring asked for the bar's
    full height, `clampTop` had a legal range of one value and pinned it 1px off the mask, and
    `sunk={active}` sat the button 4px below the ring's centre (8px of ring above it, 3px
    below). Three corrections, and they only work together:
    - **`HOME_RING` (4px) decides the ring's width**, it is centred on the button, and `homeFit`
      caps it last. A ring centred on a button that is centred in the bar is inside the bar by
      construction — no clamp, because a clamp can only shove, and shoving is what moved the
      ring off its button.
    - **The Home FAB does not REST sunk** (it still sinks on press). The one deliberate
      exception to "Pressed = on": the resting 4px was the room the bottom of the ring needed,
      and a sunk cap with no base under it — this FAB deliberately has none — never read as
      depth anyway, only as a button sitting low. The ring is the selection cue now.
    - **The pill's `getGlow` is gone**, after `getLayeredShadow` went the day before. A glow is
      a 15px and a 27px blur; the pill has 4px of clearance to a mask that clips, so the halo
      could never fade out — it was cut off flat top and bottom, which is what made the ring
      read as a squircle-shaped haze. `Shadow.fab` came off the FAB in the inactive state too:
      a 16px black blur around a 56px circle on a white bar is a grey collar, not a float.
    - **Measure the box the pill is positioned in, not the one `Surface` paints.** Surface's
      outer view is `2 × BORDER_WIDTH.card` bigger than its clipping mask, so every gap sum was
      3px optimistic. `BottomNav` measures an `absoluteFill` probe rendered beside the pill —
      guaranteed to share its containing block — and `Surface`'s `onLayout` passthrough was
      deleted with its only caller.
- **Two shapes for a pick-one question, and only two** (`components/TabSlider.tsx` +
  `FormControls`' `SegmentedControl`; the rule is written down in TabSlider's header,
  the tail was converted 2026-08-10). **Screen tier** = TabSlider, an accent-FILLED sliding
  pill, at most one per screen. **Form tier** = SegmentedControl, a raised white sliding pill.
  Tier is carried by the ACTIVE TREATMENT, never by the corner radius. A third control
  (`components/SlideSelector.tsx`) was deleted on 2026-08-09 — don't reintroduce one.
  - **The 2026-08-09 pass consolidated the three named toggles; 2026-08-10 did the tail.**
    Seven hand-rolled exclusive pickers went over: `app/shared.tsx`'s tab bar (the app's LAST
    hand-rolled tab bar) → TabSlider; `app/automations.tsx`'s two When/Then rows;
    `app/health-form.tsx` **and** `app/(tabs)/health.tsx`'s copies of "Still going / It's over"
    (one question that had two appearances depending on which screen you asked it from);
    Settings' language picker and weekly-reset-day row; `app/medicine-form.tsx`'s min-gap
    options; and `TaskCard`'s monthly weekday picker.
  - **The test is EXCLUSIVE vs MEMBERSHIP, not "is it a row of pills".** `DESIGN_RULES.md` 19a
    exempts multi-select — tags, people, weekdays-you-repeat-on, active weeks — and those keep
    their chip rows. `TaskCard` is the worked example: its weekly-repeat row is multi-select and
    still `weekdayChip`, while the monthly "second TUESDAY" picker below it is exclusive and is
    now a SegmentedControl. They shared one style, which is precisely why they read alike.
  - **Three documented refusals — don't "finish the job" on these.** (a)
    `app/onboarding/basics.tsx`'s six pill rows CANNOT convert: that screen previews an
    uncommitted theme from local state, so it can't mount anything that reads the store, and
    SegmentedControl does. (b) A picker whose option count is data-driven and unbounded stays a
    wrapping chip cloud — SegmentedControl splits its track into n equal segments, so eight
    medicines would be eight slivers (`health-form`'s medicine attribution, `medicine-form`'s
    person row). (c) A row of shortcut ACTIONS with no selected state was never a picker
    (`health-form`'s backdate presets).
  - Bonus from the Settings conversion: the weekly-reset-day row carried
    `minWidth: MIN_TAP_TARGET` on seven chips, needing 7 × 48 + 6 × 4 = 360px inside a card
    that never has it — so it wrapped to two lines on every phone. SegmentedControl's equal
    flex segments with no minWidth are the shape the wrap-audit note prescribes.
- **One card for every sub-screen link** (`components/CollapsedSection.tsx`, 2026-08-10).
  Maintainer: *"Goals and Previous days should be like the 'Whenever' card with expandability,
  and pressing the name gives you a pop-up. This is to stay consistent across app."*
  - **Expanding shows a preview; pressing the NAME opens the destination.** Two tap targets on
    one section header, both ≥ `MIN_TAP_TARGET` — a deliberate, instructed exception to
    `DESIGN_RULES.md` rule 4, and a narrow one (the same idea at two depths, not two unrelated
    controls). `SectionRail`'s `onLabelPress` is what makes the naming cluster its own target.
  - **It ended THREE shapes for one job.** `SubScreenLinkCard` (To-do's Goals + Earlier days),
    `SubScreenLinkRow` (Habits' Goals, a bare row inside the Habits card) and a hand-rolled
    two-tile row on Shopping (Food + Catalogue). `components/SubScreenLinkButton.tsx` is
    **deleted** — don't look for it. `CollapsedSection` itself was lifted out of
    `app/(tabs)/plans.tsx`, where it was a local component used only for Whenever; Whenever
    passes no `onTitlePress` and renders exactly as before.
  - **A pop-up where one is cheap, a push where it isn't** (as first written 2026-08-10; Goals'
    half reversed 2026-08-12 — see the next bullet). Earlier days opens
    `components/DayPickerSheet.tsx` (a list of recent days → `/day-log?date=…`) — still a
    pop-up, and still the right call: picking a day and navigating is a pop-up-shaped job.
    Food and Catalogue keep PUSHING: they are whole library screens with their own
    adding/editing/filtering, and a pop-up copy would be a second implementation of each to
    keep in step.
  - **The body of a drawer onto a whole screen is that screen's own component, mounted**
    (2026-08-10, later the same day — this REPLACES the "the shared part is the card and the
    preview" answer above, and the preview body it named). Maintainer, against the first cut:
    *"Shows no extra information or has the 'Add' button … I would rather just the expanded
    state be like the screens."* So Shopping's Food drawer mounts `components/FoodTab.tsx` and
    its Catalogue drawer mounts `components/CatalogueTab.tsx`, each with a new `embedded` prop;
    `components/SubScreenPreviewList.tsx` (first N names + an "and N more" row) is **deleted**,
    and with it its "names only, and no per-row action — two copies of a list drift" rule.
    Mounting the component is a stronger answer to drift than describing it was: it is what
    makes the per-dish "+" ask week-or-monthly in the drawer exactly as it does on `/food`.
    - **`embedded` is presentation only, and must stay that way.** It unwraps the chrome that
      assumes a screen backdrop — the meal sections' `Surface`, Catalogue's two header
      `Surface`s, its notepad container, its grow-to-fill footer, its rows' third stacked
      horizontal inset — and, for Catalogue, swaps the FlatList for a capped `.map()` and drops
      the A–Z rail, neither of which can live inside Shopping's ScrollView. **No behaviour goes
      behind the flag.** A caller mounting a real surface in a drawer owes it two things: no
      scroll of its own, and no `Surface` of its own (a Surface inside the drawer's Surface
      reads as a nested panel).
    - **The push is not redundant** — it is the way to the whole library. Catalogue's 280-odd
      rows need the virtualised list and the scrubber; the drawer shows a capped run and its
      search narrows to the rest.
    - Mount cost is nothing while a drawer is shut: `components/Collapsible.tsx` lazy-mounts.
  - Earlier days' body is still a read-only preview — `RecentDaysList` — because its
    destination is a pop-up, i.e. the same rows in a different container, with nothing extra
    to mount. **Goals is the exception as of 2026-08-12**: its drawer body,
    `components/GoalsEditor.tsx`, is not a preview of anything — there's no popup left to be
    a preview OF. Maintainer: *"This should not be a pop-up. Examples included in card just
    like other cards, and making, editing and deleting in the card, not a pop up."* So
    `components/GoalsSheet.tsx` (the old popup) is deleted, `GoalsEditor` carries the full
    add/browse/delete UI — including the empty-state explanation + starter chips
    `components/StarterCard.tsx` shows elsewhere, rendered inline without StarterCard's own
    Surface wrapper (a Surface inside the drawer's Surface would read as a nested panel, same
    rule Food/Catalogue's `embedded` mode follows) — and its `CollapsedSection` passes no
    `onTitlePress`, so the drawer has one tap target, same as Whenever.
  - **Counts on the rail: a size yes, a score no.** Goals and Earlier days pass none (a tally of
    goals reads as a score; a tally of past days is meaningless). Food and Catalogue do: how
    many dishes or known items a library holds is a size.
  - **This reversed the 2026-08-06 "Goals is a plain row inside the Habits card" decision**,
    which was itself a reaction to a link CARD. What was wrong with that card was that it spent
    a card on a row's worth of information and could only be *followed*; a drawer earns its card
    by showing what is behind it. Read `app/(tabs)/habits.tsx`'s note before moving it back in.
- **The Health tab is built like the Habits tab (2026-08-11)** — `app/(tabs)/health.tsx` +
  `components/HealthIssuesPreviewList.tsx` + `components/HealthIssuesSheet.tsx`, over the new
  `symptoms.tracked` column. Maintainer: *"In Health screen I want the same logic as with Goals
  and habits. Health issues same as Goals, and habits the same as logging incidents. Not
  practically the same, but the same layout, and adjusted where needed."* So the two halves map
  straight across: **one card you register on** (where Habits lists today's habits, this lists
  the issues that have been going on this week, each a `PadRow` with the 7-day severity strip as
  its `Collapsible` drawer and a `PadTypeRow` composer pinned at the foot of the list), and
  **a `CollapsedSection` "Health issues" drawer at the foot** — the same component, the same two
  tap targets, the same preview-list-plus-popup pair as Goals.
  - **Two cards became one, and nothing was dropped.** The separate "Quick log" and "This week"
    cards are gone: Quick log is the composer at the bottom of the list it appends to (the
    placement rule `FoodTab`'s "Add dish" button was fixed to), This week is the rows, and the
    Health-log link moved into the drawer's body where the rest of this screen's ways out live.
    Every field Quick log had survives as a labelled `QuickAddOptionRow` cell — still going/over,
    start time, duration, severity — **plus a tier-3 "More options"** into `/health-form` that
    the old card had no equivalent of. That makes Health the composer that most fully implements
    the three-tier contract; don't "simplify" it back toward `AddRow`.
  - **`symptoms.tracked` is the standing list, and it is NOT the catalog.** `symptoms` is 36
    seeded Norwegian names (`lib/symptomSeed.ts`) that exist to power the typeahead, so a drawer
    onto all of them would be a vocabulary list rather than "the things you keep an eye on". A
    symptom is tracked the moment it is logged (`ensureSymptom` promotes it — every log path
    goes through it) or when it is added by hand in the sheet. Read `tracked`, never
    `symptoms.length`, for anything a user would call "my issues".
  - **Untracking deletes NOTHING**, which is where this deliberately diverges from
    `components/GoalsEditor.tsx` — whose row action genuinely deletes and unlinks. Health
    entries are the rows in this app that most deserve not to be lost to a tidying gesture, so
    `setSymptomTracked(id, false)` touches no `health_logs` row and the history stays readable
    in `/health-log` and on the symptom's own page. The copy says **"Stop tracking"**, never
    "Delete", and the modal button is not `destructive`. Don't copy GoalsEditor's confirm
    wording across; the two only look alike.
    There is also no rename (a symptom's id is derived from its name, so renaming orphans every
    entry filed under the old one) and no hard delete (a DELETE is re-seeded on the next
    `load()` — the trap `useCatalogStore` solved with a tombstone).
  - **A row has a "+" and no "−"**, the one place the habit row's control is not copied whole.
    Un-counting a habit corrects a tally; un-logging a symptom deletes a dated entry with a
    severity and maybe a note on it, which belongs in `app/health-form.tsx` via the row's ⋯.
    The "+" writes at severity 3 with no time, per the tier-1 rule that committing on the line
    alone must always produce a valid row — **don't carry the last entry's severity forward**,
    that guesses at data.
  - **The no-scoreboard rule is load-bearing here specifically.** The card counts entries, and a
    count of migraines is not an achievement in either direction, because the user does not
    control it. So: no streak, no "better than last week", no total, no colour that escalates
    with the count, and — the trap specific to this domain, the mirror image of the one
    `goals.*` avoids — **no congratulation for a quiet week**. The card's sub-header says so out
    loud, which is why it exists.
  - Not in the AI setup guide and **no `AI_SETUP_SCHEMA_VERSION` bump**: health is not an
    importable domain (`lib/aiSetupGuide.ts` refuses health-log data outright), and `symptoms`
    is not in `SyncTable` either.
- **The Shopping declutter pass (2026-08-13)** — `components/HintSheet.tsx` (new) +
  `app/(tabs)/shopping.tsx` + `monthlyListLabel()` in `store/useMonthlyListStore.ts`. From an
  outside MD3-flavoured review; the maintainer ruled on each ask, and the two REFUSALS are the
  load-bearing half of this entry.
  - **The ⓘ body is a bottom sheet on Shopping, and only on Shopping.** Same
    `text`/`example`/`children` contract as `components/HintCard.tsx`, so this is a swap, not a
    second implementation — but that screen's hint is two paragraphs plus the weekly-reset
    weekday row and the monthly-reset date field, i.e. the largest block on the tab, and it
    opened inline between the sticky tabs and the first list card. The ⓘ was already the only
    way to open it (`lib/useFirstVisitHint.ts` stopped auto-opening 2026-07-31); what changed is
    where the answer lands. `lib/useKeyboardLift` does NOT survive the move — a `<Modal>` is
    outside the ScrollView that hook scrolls, so the sheet carries a `KeyboardAvoidingView`
    instead. The other ten HintCard callers are untouched; if a second one outgrows its card,
    move it to HintSheet rather than building a third shape.
  - **An empty list is a plain centred line, not a filled bordered box.** `sectionEmpty`'s fill
    and border WERE this app's real-Input look, so an empty list read as a text field you were
    meant to type into — the same objection that restyled the locked+empty monthly row two days
    earlier ("buttons should look like buttons and text fields like text fields"), and the same
    quiet line Habits and Health already draw. `app/(tabs)/plans.tsx` still has the twin style;
    it was out of scope here, not a deliberate divergence.
  - **The seeded monthly list is localized at RENDER time**, by `monthlyListLabel(list, t.…)`.
    `lib/db.ts`'s seed migration wrote the English literal `'Monthly'` and migrations are an
    append-only log that runs before the language is known, so it cannot be fixed at the write
    end. The guard needs BOTH halves — id `default-monthly` AND the name still being that
    literal — so a list a user deliberately names "Monthly" keeps it, and the seed row stops
    being special the moment it's renamed. Nothing is written. Call it at every site that DRAWS
    a monthly list's name (5 today), or the same list reads two different ways on two screens.
  - **REFUSED: detaching the header from the sticky tab bar, and an MD3 underline indicator.**
    That 8px seam is transparent — the 2026-08-10 chrome pass attached them *because* scrolled
    content flickered through it — and `components/TabSlider.tsx`'s accent-filled pill is the
    screen-tier shape in the two-shapes rule. MD3's 48px tap target is the one thing this app
    takes from MD3; its look is not.
  - **REFUSED: reshaping the bottom nav's active pill.** Measured on the web preview at 430px,
    the pill is centred on its tab within 0.9px (3px of pill above and below the item, 5px
    inside the bar) — there was no asymmetry to fix, and shrinking it behind the icon would
    weaken the cue the 2026-08-12 pass made the *only* selection cue. The investigation did find
    one real defect: `BottomNav`'s `gap` was the raw `Spacing.sm` token while the group's
    rendered `gap` goes through `useScaledStyles`, so under the design lab's `spacingScale` the
    error compounded across slots. It reads the scaled style now.
- **The catalogue header is TWO boxes, and each box IS its control (2026-08-14)** —
  `components/CatalogueTab.tsx` + the new `components/CatalogueAddSheet.tsx`. From a marked-up
  screenshot of `/catalogue`: the search field's dark fill *"looks unnatural, and not like the
  rest of the app"*, the sort segment and the lock *"should be the same box"*, and the header
  controls *"should not be slimmer than the catalogue itself"*. One cause behind all three —
  the header was a stack of `Surface`s each wrapping a SECOND bordered-or-filled control,
  inset from the card that already contained them.
  - **Box 1 is sort + camera + lock; box 2 is the search field with a "+" at its right.** The
    search input's `theme.surfaceMuted` pill is deleted: the Surface's own edge and white fill
    are the field. Nothing else in the app fills a text field with the muted token, which is
    why it read as foreign. `listHeader`'s `marginHorizontal` is 0, so a box is exactly as wide
    as the rows under it — the side shadows now clip at the card's edge, which is invisible,
    where a 32px width difference was not.
  - **The `AddRow` composer became a pop-up** (`CatalogueAddSheet`: name, optional price,
    Discard/Save). Catalogue is the one list where an inline composer never fit — a new row
    does not appear where you typed it, it lands under its own letter, usually off screen — so
    the "add row sits at the TOP here, unlike every other list" exception that file documented
    was already a compromise. `AddRow`'s caller list is one shorter; the tier table above is
    updated with it.
  - This is **not** a licence for a general "unwrap the field from its card" pass. The rule
    everywhere else is still `FormControls`' `Input` inside a card with other content; this
    applies where a box holds exactly one control and would otherwise draw two edges.
- **Dark mode is TRUE BLACK (2026-08-10), it is the DEFAULT (2026-08-16), and its chromatic
  tokens are NEON (2026-08-16)** — `bg` `#000000`, `surface` `#1E1E1E`, `surfaceMuted`
  `#121212`, `text` `#FFFFFF`, `accent` `#1E88FF`. Adopted wholesale from an outside design
  review, on the maintainer's instruction, replacing the 2026-07-18 "Midnight glass" deep navy.
  **The LIGHT palette was deliberately not touched** — the review's light values put the
  control-edge border at 1.18:1, which would erase the border-as-grouping-signal system the
  card reset below is built on.
  - **`darkMode` defaults to `'on'` as of 2026-08-16**, reversing Decision 035, and existing
    installs were moved across by a one-shot `UPDATE settings SET dark_mode = 'on'` migration.
    Brief §1: *"MANDATORY: the main app background must be true black. Remove all weak grey or
    light blue app backgrounds. This is the foundation that makes the glass and glow effects
    visible."* Every glass, edge-highlight and coloured-glow decision in this app is tuned for
    a black ground, and behind a light default the app's real look was one nobody saw.
    **Light mode is NOT removed** — full palette, Settings row, onboarding row — it is now the
    deliberate accessibility path rather than the accidental majority. The migration DOES
    overwrite a user who chose light; that is instructed, and defensible because
    `app/onboarding/basics.tsx` writes an appearance value for everyone, so there is no stored
    signal separating "chose light" from "never thought about it".
  - **`text` is pure `#FFFFFF`** (brief §5), which took the halation ceiling 16 → 17. See rule
    10a — that is the last time that number can move for this reason.
  - **`bad` was retuned `#EF4444` → `#FF3B5C`**, which REPAIRED the one relaxed contrast floor
    dark mode had: `CHROMATIC_FLOOR.dark` is back to 4.5, so dark now has no relaxed chromatic
    floor at all.
  Three more things to know before editing any of it:
  - **`components/ScreenBackground.tsx` is what dark mode actually looks like, not the
    palette.** It paints its own private gradient over `theme.bg` on every non-`plainBackground`
    screen, so its `DARK.base` is three `#000000` stops now and both blue radial glows are at
    opacity 0 (a full-canvas radial lift on pure black is exactly what destroys the OLED
    benefit). Change the token without changing that file and nothing moves on screen. **The
    ambient orbs added 2026-08-17 do not reopen this** — see the bullet below; they are allowed a
    lift precisely because they never reach the middle.
  - **The review's `border.subtle` `#27272A` is `rule`, not `border`.** At 1.12:1 on `surface`
    it is a divider weight; `border` is a separately derived `#787882` that clears WCAG
    1.4.11's 3:1 on every rung.
  - **Five dark assertions in `lib/__tests__/colors.test.ts` were relaxed to admit it** — see
    `DESIGN_RULES.md` rule 10a for the table. Four are arithmetic or structural; the halation
    ceiling (7–12:1 → 7–16:1) is a real accessibility trade that was accepted knowingly, and
    that entry says what to pull back first if a device disagrees.
- **Tactile Glass — the 2026-08-15 material** (`components/Surface.tsx` + `PressableScale.tsx`
  + `constants/colors.ts`/`theme.ts` + `components/PadSheet.tsx` + `lib/domainColor.ts`).
  Maintainer brief: a *"Hardware-Cupertino Hybrid"* — an OLED-black canvas, frosted glass panes,
  a light-catching edge, and buttons that behave like physical hardware keys.
  **This REPLACED the 2026-08-05 "One card design" reset, which this bullet used to describe.**
  Read `DESIGN_RULES_AUDIT.md`'s 2026-08-15 addendum before undoing any of it — the four
  conflicts with shipped decisions were put to the maintainer and ruled on individually.
  - **A card is a frosted pane with ONE light-catching edge.** Translucent fill
    (`theme.surfaceGlass`), a single stroke that runs white at the top-left and `theme.border` at
    the bottom-right (`getGlassEdge`), and a `getLayeredShadow` under it. This reverses the reset's
    *"flat opaque page… no frost, no BlurView, no translucent wash, no beveled rim"* AND its
    flat-rim pass (an edge may simulate a light source again — that is the brief's central image).
    **`DESIGN_COMPARISON/16` §2 required a maintainer conversation and a separate PR for exactly
    this**, and got one. **The specular/gloss ban is NOT reversed** — a translucent fill and a lit
    EDGE are not a shine on the FACE.
  - **The fill is a PAIR, and this is the load-bearing bit.** `surfaceGlass` is what gets painted;
    `surface` is the same colour already COMPOSITED over the backdrop, and is what every contrast
    test measures. They are derived from each other by construction, and
    `__tests__/glassMaterial.test.ts` asserts they still agree — if they drift, every WCAG
    assertion keeps passing while measuring a colour the app no longer draws.
    **Dark's alpha (0.118) composites to exactly the `#1E1E1E` the palette already had**, which is
    why not one dark token moved. It is set by the HALATION CEILING, not taste: the brief asked for
    5–10% white, but at 7% the pane is `#121212` and `text` measures 17.0:1, past rule 10a's 16:1
    bound. Lowering it makes the app less legible, not airier.
  - **Blur only where there is something to blur.** `surfaceContext` is a REAL SWITCH again (its
    first job since 2026-08-05, and the one it was explicitly kept alive for): `overlay`/`nav`
    mount a `BlurView`, `ambient` content cards do not. An ambient card has the BACKDROP behind it,
    which in dark mode is pure black — blurring black returns black, so a BlurView under all ~59
    cards is GPU cost on every scrolling list for no visible difference. Android below API 31
    degrades to a flat translucent overlay, i.e. the ambient treatment, so the fallback is graceful.
  - **`settings.glassSurfaces` is LIVE again** as the reduce-transparency path (it was inert from
    2026-08-05, because everything was already opaque). Off ⇒ opaque composite, no blur anywhere.
    It needed no new copy — the shipped EN/NO strings already describe exactly this.
  - **Colour left the card EDGE and went two places.** The edge is neutral on every screen now.
    `lib/screenColor.ts` is NOT retired by this (it was retired once, in 2026-07-31's A.5, for
    having no consumers): the hue was a 5% `SCREEN_TINT` wash on the pane — the quiet half — and
    the icon BADGE is the loud half. Don't put a hue back on the edge.
    ⚠️ **The wash half is DELETED as of 2026-08-20 — a card is plain white glass, and the badge is
    the only colour move it makes** (maintainer, against three exported builds: *"I do not like
    the yellow card glass look. White glass with color elements might be better."*). The idea was
    sound and the 2026-08-17 lightness ladder is what broke it: 5% of To-do's gold `#FFD700` over
    `#000000` composites to olive across the WHOLE pane, so the screen whose hue is most visible
    in the set was the screen whose cards read as dirtiest — and one alpha shared by five hues
    cannot be dropped far enough for the brightest rung without erasing the other four. What this
    knowingly gives up is a card saying which screen it is on when nothing else on it does; the
    badge, the composer's focus ring, a primary key's halo and the active nav tab all still wear
    the hue. **`Surface`'s `borderColor` prop went with the wash** — feeding it a hue was the
    prop's only job — so Home's preview cards pass their source screen's hue to
    `CardAccentBadge accentOverride` and their count `Badge` instead, which is where a preview
    card's identity has been loud since this pass. **A coloured card EDGE was exported beside the
    white pane and rejected in the same decision**, so it is not the fallback: besides being a
    no, it cannot be a colour in the ramp at all — the ring is a full-area gradient behind a
    translucent mask, so a saturated hue in it washes the pane instead of edging it (measured;
    the first export drew a fully gold card). `__tests__/glassMaterial.test.ts` pins the absence,
    because a 5% layer is invisible to tsc and nearly invisible in a screenshot.
  - **The badge is INVERTED**: a neutral frosted disc with the identity hue as a fully-opaque
    glyph, via `badgeGlyphFor(hue, plate, isDark)`. This inverts `lib/domainColor.ts`'s A.4 rule 1
    ("an identity hue is a FILL, never an icon colour") — legitimately, because that rule's real
    content was *never put a hue where nothing checks its contrast*, and the check is now in the
    code. Necessary rather than cosmetic: on the LIGHT plate every one of the five raw hues
    measures 1.20–3.03:1 (it was gold alone at 1.92:1 under the pre-neon four-hue set, and the
    dark plate's 1.88/2.33/2.69:1 for To-do/Health/Habits with it). Never use
    `domainColor.accent` here directly.
  - **Rows are FLUSH** (`PadSheet`), separated by `Spacing.sm` of whitespace. Restores
    `DESIGN_RULES.md` rule 5 and closes open conflict #8's rule-5 half in the rule's favour —
    the THIRD answer to that question, all three the maintainer's; see
    `DESIGN_COMPARISON/10`'s top box. The gap grew xs → sm because with no border to keep two rows
    apart, the gap IS the separation. **The composer keeps its box** — a rule-18 focus fix; de-boxing
    rows is not precedent for un-boxing the field, exactly as the reverse is not precedent either.
    ⚠️ **`app/(tabs)/habits.tsx` hand-rolls its own row box and does NOT move when PadSheet does** —
    that is how it shipped boxed rows for one build while everything else went flush, caught in a
    screenshot rather than by a test. Grep for both.
  - ~~**Buttons are hardware keys**~~ — **superseded by the matte-glass pass (2026-08-17); see
    that bullet above.** This pass gave `PressableScale` an opt-in `face` (a resting top-edge
    highlight cross-fading to a pressed inner shade) and `glow`, on the same `press` shared value
    as the sink. **`face` is deleted** — it was the "LinearGradient / inner shadows" the later
    ruling forbids — along with the `keyBase` housing and the cast shadow. **`glow` survives and
    is now the only light on a key**, still `primary`/`danger`/`AddFAB` only, per rules 15 and 6.
    `IconButton` still gets neither layer: its pressable is the padded hit target rather than the
    visible circle, so an absoluteFill layer would be the wrong size.
  - **The toggle is a FINISH, not a new shape.** `FormControls`' `Switch` keeps the slider
    (rule 19a, "one shape, everywhere"): accent track + `getGlow` halo when on, quiet `border`
    ring when off, white thumb in both. `ReminderBell` stays rule 19a's one exception.
  - **Section headers are `FontSize.xl` extrabold** (off a hardcoded 20), which is what carries
    the grouping now that rows have no boxes. **The SCREEN title deliberately stayed at 24** —
    above that re-creates the measured 2026-07-24 "HANDLELISTE" overflow.
  - **Light mode's one relaxation is rule 10b**: `bg`↔`surface` ≥1.20 → ≥1.15. Darkening `bg` to
    repair it was measured and REJECTED — it drops six tokens under 4.5:1 at once. The boundary
    moved to the edge, where it is asserted at ≥3:1 on both sides in both modes. A trade, not a loss.
  - **Deliberate exceptions that are NOT drift**: `components/StarterCard.tsx` and
    `components/OpenEpisodeCard.tsx` still pass an explicit neutral `theme.border`. Both predate
    this pass and are documented choices; leave them unless the maintainer rules otherwise.
- **The neon/OLED pass — 2026-08-16** (a second maintainer brief, written against the first:
  *"the current UI is washed out, flat, and uses weak, generic pastel colors"*). It does not
  replace Tactile Glass; it turns four of its dials much harder and adds a categorical colour
  system. The canvas half is in the dark-mode bullet above. The rest:
  - **FIVE neon categoricals, one per section, on a LIGHTNESS LADDER** (`IDENTITY_HUES`).
    The maintainer named the five on 2026-08-16; the VALUES below are the **2026-08-17
    recalibration**, which kept the neon aesthetic and re-picked every hex so the set survives
    greyscale and colour blindness. Brightest first — the order is part of the guarantee:
    To-do `#FFD700` gold (L\* 86.9) · Habits `#05D9E8` cyan (79.3) · Health `#FF8CB2` rose
    (71.7) · Shopping `#0DB34A` emerald (64.0) · **Notes `#B45CFF` violet (56.7) — Notes HAS an
    identity hue** since 2026-08-16, where A.3 had deliberately left it `IDENTITY_NEUTRAL`.
    Home is the only neutral left, and has no `card*` token, so `IDENTITY_NEUTRAL` currently has
    no palette consumer.
    - ⚠️ **The L\* ladder was dropped on 2026-08-16 and RESTORED on 2026-08-17** — see
      `DESIGN_RULES.md` rule 11a (rewritten) and `DESIGN_RULES_AUDIT.md`'s 2026-08-17 addendum
      for both halves of the argument. Dropping it cost more than the trade anticipated: the
      worst pair under deuteranopia simulation was ΔE2000 **11.8** and the smallest lightness
      gap in the set was **2.0**, so a colour-blind reader lost the instant "which section am I
      in" recognition the hues exist for. Now: rungs ~7.6 L\* apart, worst deutan pair 19.7.
    - **The band is derived, not chosen, and it is FULL.** Bottom = L\* 55.4, the lightness at
      which any hue clears WCAG AA 4.5:1 as a glyph on the dark glass card (`surface`, harder
      than `bg`); top = ~87, above which sRGB has no saturated amber left. Five rungs is what
      fits at ~7.6 apart, so **a sixth identity hue does not fit** — that is a conversation
      about the band, not a value to slot in. Notes cannot be a deeper violet for the same
      reason (`#A855F7` measures 4.21:1 and fails AA).
    - **It is still neon**: every value sits on the sRGB gamut boundary at its assigned
      lightness (C\* 43–93), i.e. nothing was desaturated to hit a rung. Health's rose is the
      one that visibly moved — a rose is only deeply saturated below L\* 60, so a mid-rung rose
      is necessarily lighter. It also stopped colliding with `bad` `#FF3B5C` (1.1 L\* → 14.5).
    - **Shopping is `#0DB34A`.** It was `#00FF85`, the LIGHTEST hue in the set, sitting one nav
      tab from Habits' cyan — and deuteranopia renders a mint green and a cyan much the same,
      so the two were separated by a channel some readers don't have. There are now 15 L\*
      between them. (The brief's own suggested `#01FFC3` was rejected before ever shipping, at
      ΔE2000 22.9 against Habits' cyan, under the 25 separation floor.)
    - **Five things are pinned in `lib/__tests__/colors.test.ts`**: the hex per hue, the
      ladder's order and step (≥7 L\*), AA ≥4.5:1 on `surface` AND `bg`, a dichromat-simulation
      floor (inline Viénot/Brettel/Mollon projection — deutan ≥15, protan ≥12), and the older
      pairwise ΔE2000 ≥ 25. None is redundant: the ladder doesn't imply hue separation, and
      ΔE2000 doesn't imply either lightness order or contrast.
    - **The dark `feat*` octet is aligned onto the same five** (it moves whenever they do), so a
      screen's wash and the badge sitting on it stop disagreeing. (The pane wash itself is gone
      as of 2026-08-20 — see the Tactile Glass bullet — but the alignment still matters: the same
      tokens drive the badge, the nav tab and a primary key's halo.) The three non-category
      entries (`featMeal`/`featBudget`/`featScan`) are deliberately NOT on the ladder — `feat*`
      is a per-screen wash and only Home shows several at once, whose cards are four of the five
      categories. **Light's octet is untouched** and still the 2026-08-10 cinematic set — these
      neons measure 1.1–1.5:1 there. The consequence (light mode has a teal Health wash under a
      rose Health badge) is known and accepted.
    - Consequence in `lib/domainColor.ts`: `badgeGradientFor`'s deepening flipped almost
      completely in the neon pass — all but one hue now start already-mixed toward navy, where
      before only Shopping's gold did — and the exception is whichever hue is at the BOTTOM of
      the band, so it moved from Health to **Notes** with the ladder. `badgeGlyphFor` is still a
      genuine **no-op in dark** (all five clear 3:1 raw on the frost plate) and in light now does
      work for all five, so its "at least one raw hue is unsafe" guard stays scoped to light.
  - **The card edge is a top-left lip that fades out** (brief §3) — `getGlassEdge`'s new
    `shadeDark: 0` path returns a THREE-stop ramp ending at `rgba(255,255,255,0)`.
    ⚠️ **Cards in DARK only**, and both halves matter: a card is a container (separated on
    black by its fill plus its shadow) where a field or button identifies a CONTROL and keeps
    its WCAG 1.4.11 boundary; and in light the pane sits on `#E2EAF5` at a 1.17 fill step with
    nothing else to separate it. Implemented as a gradient stop, **not** per-side border
    widths — the ring is a `LinearGradient` precisely because RN can't blend two colours round
    a rounded corner, and a 1px→0px step cuts visibly there.
  - **Every card mounts a `BlurView` now** (brief §2), reversing 2026-08-15's ambient
    exclusion. That exclusion's arithmetic was right (blurring black returns black) and it
    still lost: the backdrop is not uniformly black — edge-anchored branch art, cards
    overlapping while scrolling, and light mode's gradient the whole way across — and a card
    that blurs on a sheet but not in a list is two materials. Cost is bounded by
    `BLUR_AMBIENT` (15) being about half `BLUR_STRONG` (28), and `glassSurfaces` still kills
    all of it in one switch.
    ⚠️ **Narrowed by exactly one context on 2026-08-18** (maintainer, against a screenshot of
    `components/CardMenuSheet.tsx`: *"Cards that overlap other cards should never be
    translucent."*). An **`overlay`** pane — every sheet and modal, ~24 call sites through the
    one `Surface` — is OPAQUE and mounts no blur. What settles each tier is what is BEHIND it,
    not taste: a sheet is the only surface guaranteed to have the app's own cards there, while
    the chrome has only the backdrop (the 2026-08-18 clip window bounds content at the header's
    and the nav's INNER edges) and an ambient card sits in a vertical list that never overlaps
    itself. So this does not re-open the ambient argument above, and `nav` keeps its frost.
    Two things worth knowing: the fill and the blur come off in ONE gate (`overlapsCards`
    clearing `glassOn`) — an opaque fill under a live `BlurView` still smears the card behind
    onto the pane, i.e. the bug in a form that looks half-fixed; and the opaque colour is the
    new `surfaceRaised` token, which is `surfaceGlassStrong` **already composited over the
    backdrop**, the same derived pairing `surface`/`surfaceGlass` have one rung down. So a
    sheet over empty backdrop is unchanged, and `__tests__/glassMaterial.test.ts` asserts the
    composite the same way it asserts `surface`'s. That token is also now the `nav` tier's
    reduce-transparency fallback, which had been landing on `surface` — one rung too dark for
    the frost it was replacing.
  - **`getGlow` alphas 0.34/0.55 → 0.55/0.8.** The old values were tuned against a PALE
    backdrop; on `#000000` what reaches the eye is just `alpha × colour`. The **radii stayed**
    at 15/22 rather than taking the brief's literal 12 — this is a two-pass halo and 12 would
    make the outer bloom a near-duplicate of the inner pass. Implement the states, not the
    numbers, exactly as the 2026-08-12 button pass recorded for `Travel`/elevation.
  - **Where the categorical colour is actually drawn** (brief §7: *"an icon, a badge, or the
    glowing shadow of a button associated with a specific category"*): the badge glyph
    (already, via `badgeGlyphFor`), the pane wash (**deleted 2026-08-20**, see the Tactile Glass
    bullet — a card is white glass and the badge is its one colour move), a **primary Button's
    halo** (`Button.tsx`
    resolves it from `useScreenColor()`; `danger` opts out so a destructive action never
    borrows its screen's colour), and the **active bottom-nav tab** — icon, label and the
    sliding pill, which share `navTabHue()` so a rose icon can't land on a blue plate.
    - ⚠️ **REVERSED 2026-08-17: a primary button's BODY is categorical too.** This read "the FILL
      stays `theme.accent`; only its light is categorical", because one of the five hues admits
      no AA-contrast ink at all (Notes' violet, 4.40:1 with dark ink and 3.55:1 with white) and a
      categorical Save button would have shipped a sub-AA label on at least one screen. That
      constraint died with the opaque fill: the body is a 14% wash now and the label is
      `theme.text` at full contrast on every hue, so nothing is written on a hue to measure. See
      the matte-glass bullet. What still holds is that `danger` opts out of the screen's colour
      entirely — a destructive action must not borrow the hue of the screen it happens to be on.
    - ⚠️ The nav tab's categorical colour is **dark-mode only**, and that is measured: light's
      octet is mid-tones, and a mid-tone label on a plate tinted with itself lands 2.0–3.6:1,
      worse than the 4.19:1 `accent`-on-`accentSoft` already gives. Dark measures 5.99–10.07:1
      across the four hued tabs (was 4.89–10.50 before the 2026-08-17 ladder — the plate is
      derived from the hue, so a hue and its plate keep their ratio as the hue moves).
    - ⚠️ **Every glow-bearing CONTROL now takes that same dark-only split, via one shared
      `useControlHue(theme, isDark)` in `lib/screenColor.ts` (2026-08-27, round 20).** The nav
      was alone in doing this, so the rest of the app went on lighting up blue wherever it
      stood: round 20's brief — *"glow… is always the card's own feature hue, never blue on a
      pink or cyan screen"* — and the three sites it named were `components/IconButton.tsx`
      (which is `ReminderBell`, so the medicine bell bloomed blue in the middle of the ROSE
      Health tab), `components/VoiceNoteFAB.tsx` (the mic, blue on violet Notes) and Home's
      Energy button. All three active channels of an IconButton — deepened body, glyph, halo —
      read the one value, so a key can never be tinted one colour and lit another.
      **The light-mode half is measured and is a real refusal**: a hue as glyph ink on its own
      14% key body runs 3.79–7.77:1 in dark (against `theme.accent`'s 3.82 — four of five gain,
      Notes' violet is a wash with it) and **2.48–4.08:1 in light**, where Notes' violet FAILS
      WCAG 1.4.11's 3:1 non-text floor outright and Health's and Habits' only just clear it.
      `lib/__tests__/screenColor.test.ts` pins the failure too, so nobody finishes the job.
    - ⚠️ **Two controls keep `theme.accent` on every screen, and the gap is a decision**:
      `components/AddFAB.tsx` and `FormControls`' `Switch`. Both are the one shape a categorical
      hue cannot take — a SOLID accent fill with ink on it (`accentInk`; a white thumb) — which
      is the `accentInk` constraint the 2026-08-17 matte-glass pass escaped only by making a
      key's body a WASH. Recolouring the fill ships an unreadable glyph on at least one screen,
      and recolouring the halo alone is worse than either: it lights a key in a colour it is not
      made of. If a track or a FAB ever becomes a wash, they can follow.
    - ⚠️ **`app/(tabs)/index.tsx` passes `screenKey="index"` as of the same pass, and its absence
      was the actual bug behind "Home's energy button is blue".** `SCREEN_TOKEN.index` has read
      `featTask` since the 5→3 merge and `BottomNav`'s `navTabHue` had been drawing Home's own
      tab gold the whole time — but the SCREEN named no key, so `useScreenColor()` was null for
      all of Home and every categorical control on it fell back to the accent. A screen and its
      own tab disagreed about what colour it is. Related: both scaffolds now collapse a
      deliberately-neutral key (`home`, `settings`) to `null` rather than passing that key's grey
      base down — every consumer already reads `?? theme.border`, which is the same value, so
      nothing drawn changes; what it buys is that `null` finally means "no hue" rather than
      "grey", which `useControlHue` turns on (a halo in the neutral border colour is a smudge).
    - ⚠️ The pill plate is `mix(bg, hue, 0.2)`, **not** the `soft` `rgba(hue, 0.16)` wash every
      other surface uses. The first cut used the wash and shipped an unreadable bar — a 16%
      wash of a NEON hue over the nav's light glass put the rose "Health" label on a rose plate
      at roughly 1.5:1. That recipe assumes mid-tone hues; these are not.
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
- **The state-based reset — no overdue backlog** (2026-08-17, `lib/taskReset.ts` +
  `store/useTaskStore.ts`'s `normalizeRecurringTasks`/`notToday`/`washedAwayTasks`/`bringBack`,
  over the new `tasks.last_acted_at` column; pinned by `lib/__tests__/taskReset.test.ts` and
  `__tests__/taskStateReset.test.ts`). Three rules with one thing in common: **a task has two
  states, still to do or done, and there is nowhere for a third one to accumulate.**
  - **Recurring normalization is state, not count.** A recurring daily/weekly task's row is
    rolled forward to today on boot and on every foreground (`app/_layout.tsx`, both call
    sites read `todayStr()` at the transition), and a completion belonging to the day it was
    carrying is cleared in the same patch. Nothing is created and nothing is incremented —
    the pre-existing bug this fixes is the opposite one: `done` was a bare row flag with no
    per-date reset, so a daily task ticked once read "done" **forever**.
    - ⚠️ **Weekly parity is why the roll target is not always literally today.**
      `lib/taskRecurrence.ts` anchors a `weekInterval > 1` task's parity on `task.date` when
      `hasStartDate` is set, so stamping today would move an every-other-week task onto the
      other week. Those roll by WHOLE intervals; everything else lands on today.
    - ⚠️ **Monthly is deliberately excluded**, and the gap is a decision: its occurrences are
      weeks apart and the schema has no per-occurrence completion row, so a day-at-a-time
      roll would make "done" mean "done since yesterday". A monthly reset needs a table
      habits already have (`habit_logs`) and tasks do not.
    - **The known cost**: `lib/dayLog.ts` files a completion under `task.date`, so once a
      recurring task rolls forward its completion leaves the PAST day's log. Accepted — the
      alternative is the forever-done bug above.
  - **"Not today"** is a worded button beside `components/TaskCard.tsx`'s existing "Move to
    Whenever/today" shortcut (same one-tap-persist convention, same `!isRecurring` exclusion —
    a recurring task's `date` is a scheduling boundary, so writing tomorrow into it retimes a
    series instead of skipping a day). It writes **two fields, `date` and `hasStartDate`, and
    nothing else** — no skip counter, no streak break, no "postponed" flag, and no column
    exists for one. The store test asserts the exact column list, because "we didn't add a
    counter" is an absence no behavioural test would otherwise notice.
  - **Washing away is a FILTER, never a move.** A non-recurring task nobody has touched for
    `WASH_AWAY_HOURS` (72) stops being drawn in the active list and appears in the "Washed
    away" `CollapsedSection` at the foot of the To-do tab; bringing it back is a fresh
    `last_acted_at` and nothing else, because washing away wrote nothing in the first place.
    Same derived-not-stored discipline as rotation's turn and a stepped card's current step.
    - **`tasks.last_acted_at` exists because nothing else answers the question.**
      `updated_at` is the sync LWW stamp and moves on any write by any device (including this
      store's own normalization); `created_at` never moves. It is stamped by every USER write
      (`add`, `update` and so `toggle`/`completeDirect`/`notToday`, `restore`, `bringBack`)
      and deliberately NOT by `normalizeRecurringTasks` — get that backwards and the window
      resets on every foreground, so nothing ever washes away and the archive sits empty with
      no error anywhere. Not in `lib/liveSync`'s `TABLE_COLUMNS`, same reasoning as `done_at`.
    - **Four exclusions, each a decision**: recurring (it comes back by itself), done, a
      `'note'` card (parked information, not work), and anything dated today or later (a task
      booked for next Thursday is not being ignored). An undated **Whenever** task DOES wash
      away — that backlog is precisely the lingering pile the rule exists for, and the drawer
      is one tap.
    - **`isWashedAway` fails SAFE**: an unreadable or missing stamp keeps the task visible.
      Hiding a row is the outcome that loses work.
    - Gated on `settings.featureTaskDecay` (**on by default, still a real toggle**, Settings →
      Advanced → Features). Deliberately **not** in `aiSetupApply`'s `SETTINGS_WHITELIST` — an
      AI-authored file must not be able to hide the app's surfaces, the same carve-out
      `collapsed_cards` and `design_lab` take — so **no `AI_SETUP_SCHEMA_VERSION` bump**.
  - **Nothing anywhere counts how long.** No overdue copy (already CI-banned in
    `lib/i18n.ts`), no red, no age on an archived row, no escalation — a washed-away task from
    March renders identically to one from Tuesday, the same promise `lib/episodes.ts` makes
    about a week-old episode. `lib/__tests__/taskReset.test.ts` bans the concept in the CODE
    too (`skipCount`, `overdueDays`, `streak`), because a field like that would pass the copy
    test and still be the thing this feature exists not to have.
  - The screen half is one line in `app/(tabs)/plans.tsx`'s **`matchFilters`** — the predicate
    every section selector already runs through, so an archived task leaves Today, This week,
    Whenever and All at once — plus `DoneSplitList` wrapping its rows in
    `components/AnimatedListItem.tsx`, so a row LEAVING a section slides away instead of
    blinking out. That is what "Not today" needed and every other departure now gets.
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
- **Goals — and where "cutting back" lives** (2026-07-28, now `components/GoalsEditor.tsx` +
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
  and the screen's two entry points are now a `components/CollapsedSection.tsx` drawer
  ("Goals", gated on `featureGoals`) on `app/(tabs)/habits.tsx` and `app/(tabs)/plans.tsx` —
  the same shape as Shopping's Food/Catalogue links, and as Whenever above them.
  **`app/goals.tsx` is deleted (2026-08-12).** Once the drawer's body became the real editor
  (`components/GoalsEditor.tsx`, the 2026-08-12 "not a pop-up" pass), the screen was a second
  implementation of it — same list, same add row, same starter chips, same delete confirm,
  down to a note in each header telling the other to keep the confirm copy in sync. The two
  drawers are the only entry points now; the strength mechanic and the per-item `GoalPicker`
  in `TaskCard`/`habit-form.tsx` are untouched. Three consequences worth knowing:
  - **A note's "Send it to… → Goals" lands on the Habits tab**, in the `goals` prefill SLOT
    (`lib/prefill.ts`) — that tab already consumed a prefill for its habit quick-add, so
    without the slot a goal would silently become a habit named after the note.
    `usePrefill(slot)` hands the text to the addressed consumer only, and nobody else clears
    the param. `CollapsedSection`'s `openSignal` and `AddRow`'s `expandSignal` then open the
    drawer and its add row, so the text is somewhere the user can see it.
  - **`SendToSheet` hides the Goals target while `featureGoals` is off.** Picking a target
    ticks the note off, and the drawer is gone with the flag — the screen used to stay
    reachable regardless, which is what made offering it safe before.
  - **A goal's title is capped at one line now.** That screen was the one place it wasn't.
    Deliberate (the drawer's rows follow the row anatomy like every other list), and the full
    text is still in the row's accessible name. `lib/screenColor.ts` keeps its `goals` hue
    with no caller — a drawer wears its HOST screen's hue, on purpose.
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
- **Settings** (`app/settings.tsx`): three tabs — **General** (profile + language, appearance, **notifications**, layout + starting screen, send feedback), **Personal** (accessibility, shopping cadence, device features), **Advanced** (the Features card incl. Energy's capacities, People/family + paired devices while `SHARING_VISIBLE`, tags, backup/version, reset, debug). Reorganized 2026-07-25 from four tabs and **again on 2026-08-17** — see that file's header for the full before/after of both passes.
  - **The 2026-08-17 pass was a declutter, and its removals are the part to read before "restoring" anything.** Five settings came off the screen: the **photo-format** picker (its only consumer, `PhotoFrame`, has one caller — `app/budget.tsx` — which hard-codes `square` and documents that it ignores the global default, so the control had never changed anything visible); **"Solid cards"** (`opaqueCards`, a second switch over the same idea as Accessibility's `glassSurfaces`, which overrides it); the **local account** (`accountName`/`accountCreated` — a name and a date written by a "Create local account" button and read by NOTHING, so the card is named "Backup & restore" now, for the file it actually manages); **sample data** (`freyrMode*`, demo seeding from before real users); and the **Design Lab's own switch** (`featureDesignLab` — the lab is not a feature a user chooses between, so its link moved inside the Debug mode card). Every column, `Settings` field and AI-setup whitelist entry survives — see `store/useSettingsStore.ts`'s "Inert columns" note, which now records why each one is inert, because the five differ.
  - **Three single-setting containers were flattened** in the same pass, on the rule that a wrapper around one setting has to be obvious about what that setting relates to: the weekly reminder was its own `ExpandableCard` holding one switch beside a second card holding the other five, so Notifications is ONE flat card now; `Tags` was the middle card of a panel whose other two cards are hidden with `SHARING_VISIBLE`, so it is its own card; and Energy's capacity steppers were a separate group from the Energy/Rewards picker that governs them, so they are inside it and drawn only in Energy mode (the VALUES are untouched by hiding them).
  - ⚠️ **`scripts/preview.mjs`, `scripts/measure-wraps.mjs` and `scripts/screenshot-states.mjs` all reach `/design-lab` through Settings** and flip **Debug mode** to do it since that pass, not a design-lab switch.
  - ⚠️ **`npm run wraps` only scans the DEFAULT (General) tab of Settings.** Moving a card onto General therefore makes its wrap findings appear for the first time without anything about the card having changed — that is exactly what happened to the Layout card in this pass (two findings, both pre-existing, body byte-identical). A card on Personal or Advanced is a card this audit does not measure.
- **Feature flags** (2026-07-25, defaults revised same day): three states, not one.
  - **On by default, still a real toggle** (Settings → Advanced → Features): `energySystemEnabled` (Energy system), `featureGoals` (Goals) and `featureMedicine` (Medicine trays, 2026-07-27). Not offered in the onboarding picker — "opt in from nothing" doesn't fit a feature that's already on. Turning `featureMedicine` off must actually CANCEL its four tray reminders, not just hide the card — `app/settings.tsx`'s `applyAndSync` re-syncs them on that key. `energySystemEnabled` is the one flag that has flip-flopped: a toggle → inert/always-on (2026-07-26) → **a real toggle again (2026-07-31)**, gating `EnergyMeter`, `EnergyBalanceCard`, both editors' energy steppers and the habit quick-add's energy row (`HomeHabitsCard` + the Habits tab — a signed `− 0 +` `Stepper` since 2026-08-05, a tap-cycle before that). This line used to say "`PlanTaskCard`'s quick-add chip", which has not existed since 2026-08-01 — energy stayed a Habits-only quick-add setting; a task's energy is set in its editor. It gates SURFACES only — per-task/habit `energyEnabled`/`energyValue` keep their stored values while off, so switching back on restores every number.
  - **Hidden outright, above the flags** (2026-08-05): every sharing-with-other-people surface
    is gated on `SHARING_VISIBLE` in `lib/sharingVisibility.ts`, currently `false` on maintainer
    instruction while the single-user basics are reworked ("I'll get back to it later when the
    basics works for a single user"). It hides the People/family card and the paired-devices
    card in Settings, the `featureSharing` row in `FEATURE_ROWS`, the header share icons, the
    shared sections on Plans/Shopping/Home, the shared-load `EnergyBalanceCard`, the person
    chips in every editor, and Scan's QR-import option. **Nothing was deleted**: no table,
    column, store or setting changed, live sync still runs for an already-paired device, and
    `peopleModeEnabled`/`featureSharing` keep their stored values — so one line brings it all
    back intact. Read that file's header before touching sharing; when it returns it should
    come back AS the `featureSharing` flag, not as a permanent third switch.
  - **Off by default, still opt-in** (Settings → Advanced → Features — **and nowhere else since 2026-07-31, B1-1**): `featureSharing` (Sharing & QR) and `featureAutomations` (Automations). The onboarding feature picker (`app/onboarding/features.tsx`) is **deleted** — don't look for it, and don't add a new flag to it. Onboarding no longer offers ANY feature opt-in: a new install now gets the defaults and nothing to choose, which is the point. `showGrowth` (Quiet growth — the ambient reward; the DB column is still `show_points` from the Bonsai/points system it replaced within a day) is off by default too, and was offered on `app/onboarding/energy.tsx` until B1-2 removed the Quiet growth half of that screen; it is now Settings-only as well.
  - **Permanently on, no longer a toggle at all**: `featureScan` (Scan & receipts) and `featureFood` (Food & recipes) — removed from both Settings and the onboarding picker; the DB columns and Settings-type fields survive (this repo never drops columns) but nothing reads them for gating any more — see `store/useSettingsStore.ts`'s "Inert columns" note.
  - All defaults are set via migrations in `lib/db.ts` (append-only — corrections are new `UPDATE` statements, never edits to an already-merged line). Only gate something ADDITIVE this way — data pruning, widget/overview sync, foreground store reload, catalog/dish/symptom seeding, the automation store's boot load and the monthly reminder re-arm are load-bearing and stay unconditional.
- **The design lab** (2026-08-06; rebuilt into a playground 2026-08-07: `lib/designLab.ts` +
  `lib/{designLabPlace,designLabEdit,designLabExport,useDesignLab}.ts` +
  `app/design-lab/{index,tokens}.tsx` +
  `components/{DesignLabCard,DesignLabBench,PartPalette,PartControls,CardStarterSheet,ColorPickerSheet,Slider}.tsx`
  + `lib/{colorPalette,slider}.ts`): a workbench with **empty screens and empty cards** that
  you build on, plus the app's own colour, geometry, control-shape and row-slot knobs — the
  result exported as a document an agent applies to the real files. It exists because this
  repo's visual history is a list of taste questions argued in prose: the material system
  tuned repeatedly and then deleted ("I've been messing around too much with the visuals"),
  the row check moved left→right, boxed-vs-ruled rows rejected and then re-adopted,
  `HomeGoalsCard` and the Bonsai card each shipped and removed within a day.
  - **It is TWO screens, and `/design-lab` is the playground.** `app/design-lab/index.tsx` is
    where cards get built; `app/design-lab/tokens.tsx` (pushed from its header) is the 34
    palette tokens, the 11 geometry numbers, the 7 control jobs, the 4 row positions and the
    export. They were one screen — a card pinned in a 320px box above four tabs of knobs —
    until the playground needed the whole viewport. Tuning a token is a go-and-come-back
    errand, not something interleaved with dragging. The Settings link is unchanged: a
    directory index still answers to `/design-lab`.
  - **The first cut could not express a blank card, and that was the problem.** It opened one
    of eleven pre-filled cards from a dropdown, and `sanitizeCards` deleted any card that
    sanitized to zero parts. The rule is now split: **a card emptied on purpose is KEPT**, a
    card row with no `parts` ARRAY is still dropped (that was the real point — a hand-edited
    backup must not blank a card by omission). "Add a card" offers **blank first**, then two
    skeletons (`CARD_SKELETONS`), and only then, under its own heading, the eleven real cards.
  - **`CARD_KNOBS` is demoted, not deleted, and `cards` is WRITE-DEAD from v3.** The eleven
    stay because a card that names an `origin` exports as *"the to-do card, but with the tick
    moved"* — a diff against something real, which is the lab's original question. The old
    `cards` map is read/export-only so a v2 bag still loads and still exports; nothing writes
    it. Once the origin-diff has been used in anger, `cards` + `describeCards` can go in a
    change of their own — **`diffParts` is the keeper**, and it is already the single engine
    both containers share.
  - **Six registries now.** `COLOR_KNOBS` / `SHAPE_KNOBS` / `CONTROL_KNOBS` / `SLOT_KNOBS` are
    "one token, one new value"; `CARD_KNOBS` is a list of parts; `CARD_SKELETONS` is the
    starting menu. `PART_GROUP_OF` files all 21 kinds under **Words · Controls · Marks** for
    the shelf — every kind in exactly one group, asserted by test.
  - **Placement is free in the card's own space and snapped in the row.** The seven row slots
    still go through the real `PadRow` via its `slotWrapper`; the body is a **four-column
    grid** (`BODY_COLS`, `PartPlace {row, col, span}`), drawn as one flex row per grid row with
    cells at `flex: span`. **Do not "improve" this into absolute positioning.** The lab's
    output is a document an agent builds from, and `x: 0.37` is not buildable anywhere in this
    codebase, while "row 1, left half" is a flex row with two children — and a coordinate does
    not survive `fontScale`, the user's text-size setting, or the four widths `npm run wraps`
    checks, so what was approved would not be what ships. Side-by-side, the one thing a
    vertical flow genuinely cannot express, works. `col` is an ORDER, not a coordinate:
    `normalizePlacements` re-derives it from the running total of the spans before it, which
    is why nothing does collision detection.
  - **The honesty line, as it now stands: every PART is the app's real component, the
    ARRANGEMENT is the lab's.** The header, backdrop, per-screen hue and bottom nav are real
    too — `BottomNav` is the shipped component driven by a synthetic `{state, navigation}`
    pair, the same shape `app/(tabs)/_layout.tsx`'s `PagerFloatingNav` uses, so no new prop and
    no lookalike. Two parts had quietly broken this and were fixed in the same pass:
    `chip`/`personChip`/`badge` were hand-drawn `View`+`Text` (they use `Badge`/`TagChip`/
    `PersonChip` now) and **`checkbox` drew a `Switch`**, so the checkmark-circle turned into a
    toggle the moment it left a row. The ONE sanctioned stand-in is the shelf chip's icon: a
    real `Slider` shrunk into a 36px chip is a smear, and a smear is a worse answer than a
    symbol.
  - **Every drag has a tap equivalent, and that is not a nicety.** Playwright cannot activate
    `Gesture.Pan().activateAfterLongPress(400)` in the web build **at all** (confirmed against
    the app's own shipped drag), so a drag-only capability is one no automated check in this
    repo can reach. Adding is a shelf tap; moving between row positions is the panel's slot
    pills; moving on the grid is its row/width pills. The arithmetic lives in pure, unit-tested
    functions — `slotAtPoint` (`lib/designLab.ts`), `bodyCellAtPoint`/`placePart`/
    `normalizePlacements`/`layoutBodyParts` (`lib/designLabPlace.ts`) — which is the only
    reason any of it is verifiable. **Drop targets are measured at drag START, not at layout**:
    the card scrolls inside a scrolling screen and a scroll fires no `onLayout`.
  - **`lib/designLabEdit.ts` is every write, as a pure `(bag, …args) => bag`**, and each one
    returns the **same bag reference** on a no-op (unknown id, cap reached, illegal kind/slot).
    That makes "the button did nothing" a testable assertion and keeps the screen free of guard
    clauses. Two subtleties worth keeping: `duplicateCard` mints fresh PART ids (sharing them
    would make the export read the copy as an EDIT of the original), and `addPart` lands every
    kind in the **body**, not at `SLOTS_FOR_KIND[kind][0]` — that list starts at `trailing` for
    a button, so the old default grew a ROW on a blank card and hung the button off the end.
  - **The bag lives in the store and the column write is debounced** (`useLabDraft`). Two
    routes with a `useState` copy each means the one you come back from is stale; and a full
    playground is a six-figure JSON string, so committing per keystroke would `JSON.stringify`
    and write SQLite once per character typed into a label. `setDesignLabDraft` is the
    memory-only setter — **nothing else should call it** — and `flush()` runs on blur, on drop,
    on export and on leaving. Caps exist for the same reason: `MAX_SCREENS` 6 ×
    `MAX_CARDS_PER_SCREEN` 8 × `MAX_PARTS_PER_CARD` 24 ≈ 140 KB. Don't raise one without
    redoing that arithmetic.
  - **The export is three shapes, biggest request first.** `PLAYGROUND` is a **composition** (a
    built card has no shipped version to diff against, so the whole thing IS the instruction; a
    card with an origin gets both halves), then `CARDS` as a **diff**, then the token groups as
    before→after pairs. The `r/c/w` legend sits in the section's own preamble the way the
    `+ − ↕ ~` marks do — an exported file is read cold by someone who has never seen the
    screen. `hasSomethingToExport` and the "nothing was changed" branch must consider the
    playground: a session spent building a screen and touching no token is a real session.
  - **Colour is per-part AND app-wide, and the per-part half is meant to be obvious.** The
    panel under a selected card carries a strip of real swatches inline (`''` = inherit, first),
    with the full `ColorPickerSheet` behind "More…". The token screen still changes a value
    everywhere at once. Both write through the same picker, so a part and a palette token are
    coloured by one control.
  - **It is a question, not a setting.** Off by default behind `featureDesignLab` (Settings →
    Advanced, its own card beside Debug mode — deliberately NOT in `FEATURE_ROWS`, which is the
    list of things a *user* chooses between), never back-filled, resettable in one tap. The
    "use these everywhere" switch (`designLabApply`) stores OFF, and it **ignores `playground`
    entirely** — that switch was only ever about tokens; an arrangement of invented cards
    cannot be applied to real screens. The real output is the exported `.txt`.
  - **Two hook points carry the whole thing, and that is the design.** `useAppTheme()`
    (137 of 140 files) applies the colour overrides — which reaches the per-screen border hues
    and the domain badges for free, since `lib/screenColor.ts` and `lib/domainColor.ts` both
    derive from the palette. `scaleStyles()`/`useScaledStyles()` (63 of 140) got a geometry pass
    alongside its existing font pass. **No component gained a prop and there is no second
    rendering path.** Both are inert — same object references, same early returns — for anyone
    who never opens it.
  - **One owner per property.** A caller-supplied `borderRadius` is scaled by `scaleStyles` and
    must NOT be scaled again by `Surface` (it scales only its own `Radius.md` default), or the
    factor squares. `Surface`, `PadSheet`, `FormControls` and `PadRow` own geometry that no
    StyleSheet carries (edge width, ramp strength, elevation, row shape, check shape) and read
    the override directly; `PadSheet`/`FormControls` also own their radii outright because
    neither runs through `useScaledStyles`.
  - **On a real row the slot knobs can only SUBTRACT.** `PadRow` is handed finished nodes, so it
    can hide a position but cannot build a person chip it was never given; a composition is
    live only on the lab's own cards, which own their sample data. That is not a shortfall — it
    is the division of labour the maintainer asked for ("send it to you to wire up the
    technical part"): the lab decides, the export says what was decided and which file owns it,
    and an agent wires it up for real.
  - **A knob's `usedBy`/`source` is export metadata, not UI copy** — English by design, because
    its reader is an agent. Rendering it on screen put English hints under Norwegian labels and
    the first wrap audit of the screen caught it. Token names (`accent`) and variant ids
    (`segmented`) DO render raw, deliberately: they are the vocabulary the exported document
    uses, and translating them would make the screen and the report disagree.
  - `lib/designLab.ts`, `lib/designLabPlace.ts` and `lib/designLabEdit.ts` are all
    dependency-free like `lib/cardLayout.ts`, and `lib/__tests__/designLab.test.ts` source-scans
    all three for a store, the DB, the notification layer or the sync layer — the first two are
    evaluated in render paths on every screen, and the third is the only thing that writes a
    bag. Everything is sanitized on read; `minTapTarget` has a hard 44px floor so the lab can't
    produce an app you can't tap out of. `design_lab` is **not** in `aiSetupApply`'s
    `SETTINGS_WHITELIST` (an AI-authored file must not be able to restyle the app) and none of
    its columns belong in `SyncTable`.
- **i18n**: `const t = useT()` in any component; `t.someKey`; add new keys to **all three** of the `en`, `no` and `is` objects in `lib/i18n.ts` (tsc enforces it — both non-English dictionaries are typed `typeof en`).
  - **Icelandic (2026-08-15) is not just a third table; it brought two rules the other two don't have.** (1) **Count agreement**: Icelandic takes the SINGULAR for any number ending in 1 except 11 — "21 vara", but "11 vörur" — so a bare `n === 1` is wrong. Every counted noun in `is` goes through `isCount(n, one, many)`, and where the verb or adjective agrees too the helper switches the WHOLE phrase ("vara fór" / "vörur fóru"), never a stem plus a suffix. `lib/widgets/headlessSnapshot.ts` carries its own copy of the helper, deliberately, because that module is i18n-free. (2) **No user text in a case slot**: Icelandic would want an interpolated task title or person name in the accusative, which arbitrary input cannot supply, so `is` either quotes it (`Eyða „${label}“?` — a citation takes the nominative) or routes around the preposition (`${name} → ${listName} ✓`). Don't rewrite those into the shape `en`/`no` use. Both rules are pinned by `lib/__tests__/icelandic.test.ts`.
  - **Seed data stays Norwegian in every language**, Icelandic included — the catalogue (~287 grocery names), the 36 symptom names and the dish seed. That is the pre-existing convention (`lib/catalogSeed.ts`: "only UI follows the user's language"), not an Icelandic shortfall; an English user already reads Norwegian item names.
  - **Alphabetical order follows the language** (`lib/collate.ts`). The five name-sort sites used to hardcode `localeCompare(…, 'no')` so æ/ø/å land after z; Icelandic needs the same for its own letters, and the two locales genuinely disagree — **ð** is a letter after d and **á/é/í/ó/ú/ý** are letters of their own, where Norwegian collation folds each into its base letter and sorts the word by its SECOND letter. English deliberately keeps Norwegian collation, because the list it is reading is Norwegian.
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
`docs/archive/EMULATOR_TESTING_SPIKE.md` / `docs/archive/EMULATOR_TESTING_HANDOFF.md` describe the original plan;
this is the outcome. Runs the real app as Expo Web (`react-native-web`) and drives it
headlessly with Playwright (Chromium pre-installed under `PLAYWRIGHT_BROWSERS_PATH` —
never `playwright install`) so an agent can actually *see* screens and flows without a
device or EAS build.

- **Run it:** `npm run preview` — builds (`expo export --platform web` + wires the
  sql.js fallback), serves `dist/` with COOP/COEP headers, and walks onboarding + all 5
  tabs with Playwright, screenshotting to `preview-shots/` (gitignored). Also exercises **five**
  real write paths — add a task (To-do), add a habit (Habits), add a medicine + log a dose
  (Health), and (2026-08-07) **build a card from blank in the design lab** — the first three
  confirmed to survive a tab round-trip, proving the store→DB path actually works rather than
  just static render, and the fourth checked at BOTH ends (the part's panel opens AND the card
  draws a real slider for it, since the whole point of that feature is that those two agree).
  **The fifth (2026-08-30)** hides a card from the Manage cards sheet, navigates away, returns and
  puts it back: a new settings column is only proven by a write followed by a read on the far side
  of a navigation, which is the one thing `tsc` (a valid FieldMap) and Jest (a mocked DB) both
  cannot tell you. It runs on Health because nothing later in the walk depends on that card, and it
  restores the card before moving on — a failure here must not cascade into a missing-card timeout
  three phases away, which is how this walk's failures usually get expensive.
  The lab step also switches playground screens and back, asserting the card is absent on the
  other screen and present again on its own — **the only automated proof per-screen storage
  works** — and follows the header link to the token knobs. Plus a render pass over the pushed
  sub-screens reachable without data setup (Settings, the medicine editor, the design lab).
  - `npm run preview:build` / `npm run preview:serve` run the two steps standalone.
  - `node scripts/preview.mjs --route=/some/path` for a focused single-screen recheck.
- **⚠️ The preview cannot drive a hold-and-drag gesture AT ALL** (measured 2026-08-07, not
  assumed). Playwright's mouse-down → wait → move → up does not activate
  `react-native-gesture-handler`'s `Gesture.Pan().activateAfterLongPress(400)` in the web
  build. Confirmed by a control test against the app's OWN shipped drag — dragging a row in a
  `DraggableTaskRow` list, code that predates the test and works on device, moves nothing
  either. So a drag that "doesn't work" in the preview is telling you nothing about your code.
  Don't spend a session debugging one. Split the arithmetic out into a pure function and test
  that instead (`slotAtPoint()` in `lib/designLab.ts` is the worked example); the gesture needs
  a real device, like the rest of the native-only surface.
- **What else the preview genuinely CANNOT reach** (learned the hard way 2026-07-28 — check here
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
### Visual regression — `npm run visual` (2026-08-29)
**The first check in this repo that can see a defect COME BACK.** Until it existed the
maintainer's eyes were the only detector of a visual regression: `tsc` sees valid styles, jest
has no layout, and the other three harnesses each answer a narrower question. That is why this
file reads as a list of reversals — the card header cluster order alone has now been all four of
its possible arrangements — and why the same defects kept being re-reported by hand.

It captures through `scripts/screenshot-states.mjs` and pixel-diffs against committed baselines
in `visual-baselines/<theme>/`. **21 screens per theme, light AND dark** (~3.9 MB) — curated, not
all 54, because these are PNGs in git history forever.

- `npm run visual`, `npm run visual -- --theme=dark`, `FORCE_BUILD=1` to rebuild first.
- `npm run visual -- --update` re-blesses. ⚠️ **Blessing is the whole risk** — it is both how an
  intentional redesign lands and how a real regression gets laundered in. Diffs plus `expected`
  and `actual` are written for every finding; re-bless deliberately, in its own commit, having
  looked at them. Never to make a red run go green.
- ⚠️ **Web-render vs web-render, NOT native ground truth.** Clean means "nothing changed that I
  did not intend", never "this looks right on a phone".
- **Determinism is what makes it usable and it took real work.** `components/NarratorQuote.tsx`
  picks its line by a RANDOM index on mount and several surfaces print the current date, so
  `--deterministic` (in the screenshot walk) pins `Math.random` to a seeded mulberry32 and the
  ZERO-ARGUMENT `Date` to a fixed local noon on a Wednesday. Page-level overrides; nothing in the
  app changes. Verified stable: two independent runs on one unchanged build, **44/44 shots
  bit-identical** (2026-08-30; it was 43/44 until the settle below).
  - ⚠️ **`Math.random` is a seeded STREAM, not a constant, and that bites whenever you edit the
    walk.** The narrator's line depends on how many draws happened *earlier*, so inserting one
    step upstream re-rolls every quote downstream of it — a screen the commit never touched,
    differing only in one italic sentence. Look at the diff and confirm it is only the quote
    before blessing; the failure it resembles (a card's content changing) is real. It cannot be
    a constant: `lib/id.ts` is `Date.now().toString(36) + Math.random()…` and `Date.now()` is
    frozen here, so the random half is the only thing keeping two rows in one walk from sharing
    an id. And `Date.now()` must STAY frozen — goal strength and `isWashedAway` compare stored
    timestamps written through the frozen `new Date()`, so a live clock would wash every seeded
    task away before it could be photographed.
  - ⚠️ **A settle is a PREDICATE, never a longer wait — and one screen turned out not to be a
    settle problem at all.** `habits-empty` was the only shot not bit-identical run to run; the
    pixels sat on the TabSlider's own sliding pill and converged with time — **374 px at 1100 ms
    → 73 at 2600 → 0 at 4200** on this machine. Tuning that number fixed it here and
    **reproduced it on the CI runner**, which came back with exactly the 73 px the 2600 ms run
    had produced, because a timeout cannot be right on two machines at once. So `shot()` calls
    `settle(page)`: two viewport screenshots a beat apart compared byte for byte, until they
    match or a 3 s budget runs out. A static screen costs one extra capture; an endlessly
    animating one spends the budget and proceeds, so it is unconditional and cannot hang the
    walk. It is the right fix and it stays — verified 44/44 bit-identical across two runs AND
    byte-identical to the baselines the tuned wait produced.
  - ⚠️ **…and it did not fix that screen, which is the more useful half.** With the predicate,
    CI's `habits-empty` is *stable* at the same 73 px. So it was never a race there: the pill has
    two stable resting positions and the two machines pick different ones. That screen is in
    `MACHINE_DEPENDENT` in `scripts/visual-diff.mjs` now — captured, printed on every run,
    excluded from the comparison — because the only other way to green was raising the budget
    past 73, which is 11 px under what one header icon costs, i.e. re-opening the blind spot this
    gate had just closed. It is not a coverage hole: `habits-populated` shoots the same surface
    and is stable on both machines. **A stably-red screen is worse than an excluded one** — it
    trains whoever reads the output to re-bless on reflex, which is the failure `--update`'s
    warning exists for.
  - **When this gate looks flaky, run the walk in PAIRS and diff the two outputs against each
    other.** A baseline comparison cannot tell "the app changed" from "the harness did not
    settle"; two runs of one build can. That is how the wobble above was found, and how it was
    confirmed fixed.
- **It is proven to FAIL, not just to pass** — a probe changing `SCREEN_GAP` 16→12 turned 13 of
  21 red, and the 8 that stayed green were exactly the forms and single-card screens where a card
  gap does not apply.
- ⚠️ **`--update` refuses to bless a partial set**, and four screens the set wants but the walk
  cannot reach are PRINTED on every run (`WANTED_BUT_UNCAPTURED`) rather than dropped. Move one
  into `BASELINE_SET` when its excursion is repaired; the ratchet only goes one way.
- ⚠️ **pixelmatch's threshold is BLIND to this app's ambient layer — 0.02 plus an absolute
  channel rule (2026-08-31).** Its metric is perceptual and normalised against the maximum
  possible difference, so a change between two very dark colours scores far below the same
  magnitude in the midtones — and this is a true-black OLED design whose whole backdrop lives
  there. The number that settled it: **doubling the backdrop's orb field**, a change over ~40% of
  the screen with corner pixels going rgb(22,31,15) → rgb(44,59,27), was reported at the shipped
  `threshold: 0.1` as **9 differing pixels**. The truth was **162 166**, max channel delta 31.
  The gate called it `unchanged` — the same failure as the 200 px tolerance one rung deeper, and
  the reason "it still looks the same as before" could be true while every check was green.
  A pixel now counts if EITHER pixelmatch at 0.02 says so, OR any channel differs by ≥ 4; the
  second is what catches dark-on-dark, and 4 only has to clear rasteriser jitter because the
  measured run-to-run noise floor is zero.
  ⚠️ **The ≥ 4 rule has a sub-threshold blind spot in LIGHT too, measured 2026-09-01.** A light
  token retune (`surfaceGlass` 0.94 → 0.82, `surface` `#FDFEFF` → `#FAFCFE`) shifted the whole
  backdrop and every card fill of `light/plans-today-populated` by **1 level over 46 329 pixels**
  and the gate reported it `unchanged`, because no channel moved 4 and a 1/255 step is far under
  0.02 perceptually. It surfaced only because `--update` rewrote the file and `git status` showed
  it. **So a re-bless is worth a `git status` read**: a file the gate called unchanged that
  changed on disk is a real difference the gate could not see. It is not noise — two independent
  walks came back bit-identical to each other and to the blessed file. Lowering the 4 is not
  obviously right (it would admit genuine jitter on other machines); knowing the floor exists is.
- ⚠️ **The budget is an absolute 24 px, and the 200 px it replaced was hiding real changes
  (2026-08-30).** `MAX_DIFF_RATIO` was 0.0005 on the stated premise that Chromium's text
  rasterisation is not bit-identical across runs — never measured, and false: **nine untouched
  screens came back at exactly 0.** What the tolerance actually bought was a blind spot its own
  size. The commit that measured it added ONE header icon to twelve screens and every one
  differed by **exactly 84 px** (a thin 22px outline glyph is mostly its own background), so the
  gate reported `unchanged` on twelve screens that had visibly gained a control. An absolute
  count, not a ratio, because stray rasteriser pixels do not scale with the frame. ⚠️ If CI ever
  shows a floor of its own, raise it **with the measurement in hand**.
- ⚠️ **A shot is only as good as the tab it clicks, and one of them had been wrong for eight
  days.** `health-empty` clicked **Home**, carrying a comment that was true during the 5→3 merge
  (Health was a card on Me) and stopped being true on 2026-08-22 when the five tabs came back.
  Nothing failed — the walk kept producing a `health-empty.png`; it was just a second copy of
  `home-empty`, so the committed baseline for the Health tab was a picture of a different screen.
  Caught only because the gate reported 0 changed pixels on a commit that demonstrably added a
  header icon there: **a shot that cannot move is what this rot looks like.** Re-read the walk's
  tab clicks against `components/BottomNav.tsx` whenever the bar changes, exactly as
  `npm run wraps` requires.
- ⚠️ **Shots are `fullPage: false`.** The app scrolls inside a fixed-height ScrollView, so
  "full page" never reached below the fold — it only added ~61px of bare document under the
  932px viewport, which renders as whatever the outermost background is. That strip produced 18
  false findings in one pass, every one differing at exactly y=932.

### Geometry — `npm run geometry` (2026-08-29)
Measures **vertical** placement, which nothing else did: `wraps` is horizontal, `halos` is a
sliced glow, `visual` is change-against-baseline. "The tab slider in Settings is not vertically
centred" was reported by eye twice with no check able to see it.

Targeted, not a generic DOM sweep — the first cut swept generically and reported 25 false
findings, because react-native-web wraps a View in several absolutely-positioned divs and it read
nesting as overlap. It compares the header band (`zIndex 100`) against an attached sticky bar
(`zIndex 99`), and measures a control's gaps against the bar's **visible** band rather than its
declared box.

**It prints its measurements on every run, pass or fail**, which is the point: the Settings
segments sit `3 / 4` — a systematic 1px skew in the same direction on all three, caused by
`HEADER_SEAM_OVERLAP`. That is under the 1px tolerance and is NOT a failure; a verdict alone
would have hidden it.
⚠️ `constants/theme.ts`'s `OpticalCenter` is Android-only and a no-op on web, so a label
mis-centred by Android font padding is invisible here **by construction**. That class still needs
a device.

### The visual gates run in CI (2026-08-29; both themes since 2026-09-01)
`.github/workflows/ci.yml` has a second job that builds the bundle once and runs `visual`,
`geometry`, `wraps` and `halos`, each `if: always()` so one failure does not hide the others,
uploading pixel diffs on failure. ⚠️ **Chromium is resolved by `scripts/chromium-path.mjs`**,
not by the hardcoded `/opt/pw-browsers/chromium-1194/...` seven scripts used to carry — that path
is right only in the remote dev env, and it is what made this job fail on its first run.

⚠️ **`geometry`, `wraps` and `halos` ran LIGHT-MODE ONLY from 2026-08-29 to 2026-08-31 — only
`visual` was checked in both themes.** Dark is the app's DEFAULT appearance and every glass/edge/
glow decision is tuned for it, so a dark-only regression (the 2026-08-29 backdrop/orb doubling is
the worked example — see that bullet above) was invisible to three of the four gates by
construction, even though CI was green. Fixed by giving each script a `--theme=light|dark` flag
(`scripts/force-appearance.mjs`, factored out of `screenshot-states.mjs`'s existing
`forceAppearance` — it sets `dark_mode` on the in-memory sql.js DB from an `addInitScript`, since
there is no in-app route to appearance in this harness) and running each audit twice in CI, once
per theme. **A new geometry/wraps/halos check that only makes sense in one theme is fine** — the
flag exists so a dark-only defect CAN be seen, not so every finding must be theme-symmetric.

### Halo audit — `npm run halos` (2026-08-24)
Answers one question the other checks cannot: **is a field's neon actually being drawn, or is it
being sliced off?** A halo (`getFieldGlow`) is a `boxShadow`, so it is cut to the nearest
`overflow: hidden` ancestor — and a card clips its own body. `scripts/measure-halos.mjs` walks
the five tabs in the web preview, opens every card (a composer inside a closed card is not in the
DOM at all), and for every field-shaped haloed element compares its blur radius against the room
it has before that clip. Exits 1 on any finding, and the failure text says where the fix goes.

- `npm run halos`, `npm run halos -- --width=360`; `FORCE_BUILD=1` rebuilds `dist/` first.
- It found the 2026-08-24 report: **31 of 36 haloed fields clipped**, every composer in the app
  but one. See the `getFieldGlow` bullet above for the mechanism and the two-part fix.
- **A field is recognised by `FIELD_RADIUS` (12px) — and then FOCUSED, because that is when its
  light exists (2026-08-26).** The detector used to be "`FIELD_RADIUS` plus a coloured
  `boxShadow`", which stopped working the day the glow-budget pass made a halo a focus-only
  state: an unfocused field has no shadow to match, the scan fell from 14 fields to 4, and it
  reported a contented `0 clipped` while looking at almost nothing. A new field shape that does
  not go through `getFieldGlow` is still a field this audit does not measure.
- **Three outcomes, not two.** A field with NO halo even when focused is reported separately from
  one whose halo is clipped: the first is a possible regression in the glow budget, the second is
  the bug this audit exists for, and folding them together hides either.
- ⚠️ **Dedupe on the LEFT/RIGHT room only.** A widely-reused composer — the To-do tab's "New
  task" mounts once per card and once per weekday inside Week — has one horizontal clearance
  wherever it sits, because that comes from the component's own padding; its top/bottom room is
  just wherever the page happened to be scrolled. Keying on the full room let that noise mint a
  fresh key for a structurally identical finding, so the count swung 12/14/15 between runs with
  nothing about the app having changed. Left/right is also the only axis any clipping bug this
  audit has found has ever lived on.
- Same caveats as the wrap audit: it drives the real app, so a nav or resting-state change can
  make a step measure nothing rather than fail. The count is **12 distinct fields** at 430px and
  360px when the walk gets all the way round.
- ⚠️ **It is NOT deterministic, and this line used to say it was (corrected 2026-08-27).** The
  claim was *"it is deterministic; a lower number is un-measurement, not a pass"*, which sent a
  session hunting a regression that did not exist. Measured on ONE unchanged build, four
  consecutive runs: **10, 12, 9, 12**. `openCards()` walks with fixed `waitForTimeout`s and a
  per-tab pass budget, so a slow frame drops a card that never opens and its composer is simply
  not seen — the same silent-skip the wrap audit has, on a harness that also re-runs each tab
  several times. **`0 clipped` is the gate; the count is not.** Read the count as a floor on
  coverage, and if it comes in low, RE-RUN before believing it — a real un-measurement (a nav or
  resting-state change) reproduces every time, a slow frame does not. Comparing a suspicious
  count against the same audit on `main` is the way to tell them apart.

### Wrap audit — `npm run wraps` (2026-07-28)
Finds the "why is that on two lines when it nearly fits?" class of bug by measurement
instead of eyeballing. `scripts/measure-wraps.mjs` walks the same preview build and, for
every text node, forces `white-space: nowrap` to compare natural width against the box it
actually got. Reports four separate failure modes:
- **Clipped controls** (added 2026-08-01; the filter tightened 2026-08-21) — a NON-text element (icon button, chip, avatar)
  whose box runs past the horizontal edge of the nearest overflow-clipping ancestor, so part
  of it is physically sliced off. Added after the task editor's voice mic shipped cut in half
  at 360px (#465) and was found *by eye in a screenshot* — none of the three modes below can
  see it, since the mic has no text to wrap or truncate and its row has only two children
  (under the ≥3 that wrapped-rows needs). Two filters keep it honest, and don't remove
  either: anything inside an `<svg>` is skipped (the backdrop motifs are *supposed* to bleed
  past their mask), and a child **as wide as or wider than** its clipper is skipped as a sliding
  track. ⚠️ **That second filter was `>` until 2026-08-21 and should have been `>=`**: it skipped
  the pager's 1080px TRACK but not its PAGES, which are each exactly one window wide — so two of
  the three were "clipped" by whatever mid-settle offset the screenshot caught, and six of eight
  findings on every run named the Shop page's intro text while the audit was looking at another
  tab. Equality is the honest cut, on the principle the mode rests on: a control that had room
  and was shoved out is by definition SMALLER than its clipper (the sliced mic was 28px in a
  257px box). `WRAP_DEBUG=1` prints each finding's clipper and offsets, which is how that was
  diagnosed rather than guessed. What's left is the real shape of the bug: something that would
  fit comfortably, shoved out anyway.
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

⚠️ **The whole run DIED on the 2026-08-22 nav restructure, and three more steps were pointing
at the old geography behind it (fixed 2026-08-23).** `goHome` waited on a "Meg" tab that no
longer exists, so `npm run wraps` exited 1 at the first tab loop and measured nothing. Once that
was fixed: `tabs` still held two entries, so **Habits and Health were not measured at all**; the
habit quick-add, the symptom form and the medicine editor were each reached "via Home", where
none of them lives any more; and every card outside Home's three rests closed, so a locator
aimed inside one waits 30s and the step skips. There is an `openCard(page, title)` helper for
that now, keyed on `CardCollapseToggle`'s `<card title>: <expandListLabel>` accessible name.
**A nav or resting-state change is what breaks this audit**, and it breaks it by un-measuring
screens rather than by failing — read the "screens measured" line, which is 22 screens in both
`no` and `en`.

**Coverage.** The walk measures onboarding, the tour card, all five tabs, Settings, the
**design lab** (2026-08-06 — pushed from Settings → Advanced, and scanned last because both it
and Settings are dead ends; the walk has to throw its off-by-default switch first. **Since the
playground rebuild that is SIX scans**: the playground empty, with a card on it, and with a
part's panel open — three genuinely different surfaces — then the token screen's three tabs.
A tab this walk doesn't switch to is a tab it doesn't measure, and the part panel in
particular is the densest label-plus-pill-cloud thing in the app now that it carries colour
swatches, sizes, weights, positions, lines and widths), the
**Energy config sheet** (2026-08-03 — opened from the strip's tutorial-state button on Home
and closed again before the tab loop, since a bottom sheet's scrim swallows every click
under it), **Shopping's Food and Catalogue drawers** (2026-08-10, one scan each — their
expanded body is the real `FoodTab`/`CatalogueTab` now, so the Catalogue one puts a search
field, a sort segment and name·price·trash rows inside a card that is itself inside the
screen's padding: three stacked horizontal insets, the shape that produced the task editor's
findings), and — since 2026-08-01 — the **task editor**, the **goals sheet**, the **health
form** and the **medicine editor**. Before that pass it had never opened an editor or pushed
sub-screen *at all*, so the app's densest forms were the one place it couldn't see, which is
exactly where the mic bug lived. **`--lang=en` was also broken outright** until the same
pass: it waited on a "Language: English." radio that never exists, because Basics renders in
Norwegian until that very row is tapped. Both are worth knowing before trusting a clean run —
a mode this audit doesn't walk is not a mode it passes. When you add a surface with tight
horizontal pressure, add a step for it.

Three things constrain how steps can be ordered, all verified rather than assumed:
- **The run is FOUR passes.** `settings`, `medicine-form` and — since the 2026-08-20 5→3 tab
  merge — **the To-do screen** are dead ends (pushed screens that render no `BottomNav`), so
  only one of them can end a pass. `health-form` is a push that *keeps* BottomNav, so it
  doesn't need one. ⚠️ **Two of this walk's locators had gone stale and were skipping silently**
  (found 2026-08-20): `health-form` waited on `t.logSymptomTrigger`, which has not been on the
  Health tab since that screen was rebuilt on 2026-08-11, and `goals-drawer` waited on a bare
  "Goals" where the drawer is labelled `t.goals.editLinkPractical` ("Practical goals"). Both
  printed a one-line "step skipped" and the run still reported totals, so the app's second- and
  third-densest forms were simply not being measured. **A step that skips is not a step that
  passes — check the "screens measured" list against the steps, not just the totals.**
  ⚠️ **It happened again on 2026-08-21, from a change nowhere near this script**: every card
  rests CLOSED now (`lib/cardDefaults.ts`), so the To-do walk's `.first()` "New task" composer
  lives inside a folded card and does not exist — and the whole `task-editor` + `goals-drawer`
  leg went back to skipping silently. Both walks open the card they need first. **Any pass that
  changes what a surface draws by default should re-read this list**, because the failure is a
  step that stops running rather than one that fails. The onboarding→tour→Energy-sheet on-ramp is
  shared by both passes via `walkToTabs()`, scanned only on the first (the second re-walks it
  with scanning off, since it's identical and would double every finding).
- **Never `page.goto()` or `page.goBack()` mid-walk**, except the standalone
  `basics-all-rows` route right at the end of the run. Both reload the document, which resets
  the in-memory `sql.js` DB and drops you back into onboarding.
- **`app/scan.tsx` is deliberately not walked.** The web bundle resolves `app/scan.web.tsx`,
  an OCR "not available" placeholder, so measuring it would report on a screen that doesn't
  exist on device. Like the rest of the native-only surface, it needs a real device.

Known-benign findings, don't "fix" them:
- ⚠️ **Anything the `tour-step` scan reports about a card on ANOTHER TAB.** The pager keeps all
  three screens mounted (`lazy: false`), so that scan measures Shop's and To-do's cards as well
  as the one the spotlight is on — at whatever transient width they happen to have while the
  overlay is up. At 360px it reported "Katalog" truncated by 11px while the `Handle` scan, which
  measures that card on its own settled page, reported nothing for it. **Trust the per-screen
  scans (`home`, `Handle`, `Gjøremål`) over `tour-step` for anything that is not the tour's own
  coach card.** Verified at 327/360/430 in Norwegian: no card title truncates on a directly
  measured screen.
- Two **`[y]` findings on `tour-step`** (2026-08-21): the Home tab's content and its last card,
  reported as cut off at the bottom. The tour locks scrolling while the spotlight is up, so
  ordinary below-the-fold content has no scroller to be reachable through and the walk records it
  as clipped. Nothing is wrong with the cards; the run is clean at 2 findings.
- The **goals sheet** reports 1 wrapped control row at every width. That's `starterChips` — a
  `flexWrap` cloud of four sentence-length goal suggestions, which is *supposed* to wrap. The
  detector can't be taught to ignore it without also blinding it to the weekday-chip row, which
  uses `flexWrap` too but has a hard minimum width and IS a bug when it wraps. One documented
  false positive beats a blind spot.
- The **design lab** reports 4 wrapped rows at `--lang=no --width=327` (re-measured after the
  playground rebuild — the count went 3 → 4 and the membership changed again). All four are
  `flexWrap` clouds of the `starterChips` family or the documented three-button case, and none
  is a bug:
  - `design-lab-part-panel` — the four width pills (`En firedel … Hele linja`), 26px short.
  - `design-lab-part-panel` — the colour swatch strip plus its `More…` chip. The swatches
    carry no text, which is why that row prints as `|||||||Flere…` in the report.
  - `design-lab-colour` — Send · Save · Put everything back. The same three-button action row
    as before, **now on the token screen**, still carrying the `flexWrap` + `rowGap` fix the
    task editor got: the labels are words the maintainer needs to read, so the row wraps
    rather than truncating.
  - `design-lab-controls` — the ten raw slot-option pills, unchanged.
  One near-miss is worth knowing rather than fixing: `design-lab-card`'s empty-card line misses
  one line by **8px** at 327 in Norwegian.
- ⚠️ **`quick-add-focused` (the Habits composer's options panel) reports a wrapped control row
  since phase 7 of `DESIGN_COMPARISON/19-IMPLEMENTATION.md`** (`lib/cardRegistry.ts`'s
  `habitsList.compose` table, wired into `components/HabitsSurface.tsx`'s panel): "short by
  562px | 5 items on 3 lines" at `--lang=no --width=360`. **Confirmed new, not pre-existing** —
  on `main` the same panel draws only Energy + `HabitRecurrenceCells`' 1–2 cells (2–3 total);
  phase 7 added a Target `Stepper` and a Remind toggle (plus its dependent Time cell when Remind
  is on), taking it to 5. **And confirmed NOT a layout bug** — a screenshot at 360px
  (`npm run halos`-style manual capture) shows a clean 2-column grid: pair, then one cell alone
  on its own full-width line (`Hver 1. dag`, whose two steppers need the room), then a second
  pair, then "More options". Nothing truncates, overlaps or spills off the card.
  **The "short by Npx" number is structurally meaningless for this component family**, which is
  why it joins the design-lab bullet above rather than getting a code change: the control-row
  detector sums every child's ACTUAL RENDERED width — including children already sitting on
  DIFFERENT wrapped rows — and compares that sum to the width of ONE row (`scripts/measure-wraps.mjs`'s
  `needPx` reducer, next to the "Control rows" section header). That sum only shrinks below the
  row width for a `QuickAddOptionsPanel` with one or two cells; the panel is designed to wrap
  (`components/QuickAddOptionsPanel.tsx`'s header: "cells pair two-per-line"), so any caller
  with three or more cells trips this exact false positive — precisely the shape already
  documented for `design-lab-part-panel`/`design-lab-colour`/`design-lab-controls` above. Adding
  a `wide` prop to a cell to "fix" this would make the reported number WORSE, not better (a
  `wide` cell's rendered width grows to the full row, which the sum then counts in full), for no
  visual gain — the fix that would move the number is exactly the fix that must not be made.
  Don't shorten copy, don't add `wide`, and don't re-litigate this as a regression next time the
  audit runs; if a *sixth* option cell is ever added here, expect the number to grow again for
  the same non-reason.
- The **token screen's three tab labels** may be reported as TRUNCATED by a few px at
  `--width=327`, Norwegian only. `components/TabSlider.tsx` sets `adjustsFontSizeToFit` +
  `minimumFontScale` 0.85, which react-native-web implements neither of — the exact artifact
  this audit's own TRUNCATED warning describes. A few px against a 15% shrink floor is
  comfortable; don't shorten the words for it.

**The Delete·Discard·Save row was fixed in the task editor and nowhere else, and that showed
up as a sliced Save button (2026-08-23).** `npm run wraps --lang=no --width=360` reported the
medicine editor's Discard/Save pair 7px past the pop-up pane's own overflow mask — a CLIPPED
control, the same category as the voice mic. `justifyContent: 'space-between'` shrinks nothing:
Slett (84) + Forkast·Lagre (205) needs 289px in the 267 a 92%-wide `CenterModalScreen` pane
leaves at 360, so the surplus simply hung off the end. `components/TaskCard.tsx` had carried the
fix (`flexWrap` + `rowGap`, `marginLeft: 'auto'` on the right cluster) since 2026-08-01;
`app/medicine-form.tsx` and `app/habit-form.tsx` — which copied the row and whose header even
says "same row as habit-form" — never got it. All three now agree, gap included. ⚠️ The finding
only names an unlabelled `<div>`, so the audit's CLIPPED entries carry the element's own TEXT on
both axes now ("ForkastLagre" is what made it findable); it used to be y-axis only.

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

### Design-review package — `npm run review-bundle` (2026-08-09)
Builds the thing you hand to someone — a person or another AI — who has never seen this
codebase and is being asked to critique its **layout and visuals**. One command, four steps
(`scripts/run-review-bundle.sh`): build the web bundle, screenshot every screen in every
state, collect every component's source, derive the connection map, zip it. Output is
`review-bundle/` + `review-bundle.zip`, both **gitignored** — 14 MB of PNGs per run would sit
in git history forever, and the whole thing regenerates in ~15 minutes.

- `review-bundle/screens/` — 80 shots with `INDEX.md` captioning each one: 56 light
  (`scripts/screenshot-states.mjs`) plus 24 dark (`--theme=dark --only=core`). **Every caption
  names the STATE**, because half the value is the empty ones — this app puts real teaching
  content where a blank list would be, so "Home, empty" is a designed screen, not an absence.
- `review-bundle/source/` — every `components/*.tsx`, every `app/**/*.tsx` and the
  colour/spacing/type/motion token files, full source with headers, chunked into ~220 KB
  Markdown files so any one of them fits in a context window whole.
- `review-bundle/CONNECTIONS.md` — the screen tree, what each screen mounts, a per-component
  table of who imports it and which screens can reach it, the 20 most-shared components
  (highest-leverage to change) and any component nothing imports. **Derived from the real
  `@/` imports**, not from the `Connections:` header prose — so it is a cross-check ON those
  headers, not a copy of them. The `INVENTORY.csv` beside it is the same data, machine-readable.
- `review-bundle/README.md` — the orientation note, including the ground rules a reviewer
  needs *before* suggesting things (one flat border per card, hue from the screen, the row
  anatomy, the three composer tiers, no-guilt copy, EN/NO length). Suggestions that break
  those have usually already been considered and rejected; the useful ones work within them.

`scripts/screenshot-states.mjs` is a different job from `scripts/preview.mjs` — preview proves
write→read paths still work, this one documents what the app looks like — and its phase order
is not cosmetic. **The web DB is in-memory sql.js and there is no in-app back button on web**
(ScreenHeader draws one on iOS only), so reaching any pushed sub-screen costs a `goBack()`,
which reloads the document and wipes every seeded row. Hence: onboarding → empty tabs → sheets
(they close in place) → pushed sub-screens as independent throwaway excursions → seed for real
and shoot the populated surfaces with **no navigation at all** → one last data-bearing push.
`ensureTabs()` is the recovery hatch: after any excursion it re-runs onboarding from scratch
if the bottom nav is gone, so a mis-landed `goBack` costs a minute rather than the run.

Two things there are worth knowing before editing it:
- **Dark mode is set under the app, not through it** (`forceDarkMode()`). Appearance lives in
  Settings, Settings is a pushed dead end, and leaving it reloads the document — which wipes
  the setting along with the DB. So an `addInitScript` intercepts the assignment of
  `window.__unfocusSqlJsDb__` and re-asserts `dark_mode='on'` before every read of the
  settings table, which also survives onboarding writing its own appearance pick over it.
- **Scroll position decides the framing.** The app scrolls inside a fixed-height ScrollView,
  not the document, so `fullPage: true` captures the viewport, not the whole screen. Every
  non-overlay shot wheels back to the top first — and the wheel has to be preceded by a
  `mouse.move()` into the content, because the cursor starts at (0,0) where the wheel is a
  no-op on several screens.

## Known gotchas

- **⚠️ A delete that rewrites rows in ANOTHER table has to STAMP them, not just broadcast them
  (2026-08-23, `__tests__/relatedRowSync.test.ts`).** Three deletes clear a column on rows they
  do not own, with raw SQL rather than the owning store's `update()`: `useTagStore.remove()`
  → `tasks.tag_ids`, `useTaskStore.remove()` → the follower's `follows_task_id`, and
  `usePeopleStore.remove()` → `tasks.assignee_id`. **All three columns are in `lib/liveSync.ts`'s
  `tasks` whitelist and none of the three UPDATEs moved `updated_at`** — the 2026-08-10 shopping
  bug (below) in three more places, found by grepping every raw `UPDATE <synced table>` against
  `TABLE_COLUMNS` rather than by anything failing.
  - **The tag one is the instructive shape: it DID broadcast.** A `broadcastRow` with no
    `touchRow` ships the rewritten row under its OLD stamp, and `incomingWins` rejects it on the
    spot (equal `updated_at`, equal `origin_device_id` → the peer keeps its copy). So the
    deleted tag stayed on the other phone, and that phone's next edit to any field on the task
    carried it home in the full-row snapshot. **A broadcast without a stamp is not "most of the
    fix", it is none of it** — which is why the test asserts the PAIR.
  - `useTaskStore.setFollower()` had been doing it correctly since it was written, one function
    away from `remove()`, which nulled the same column and told nobody. Diff the copies: the odd
    one out is the finding, exactly as the 2026-08-12 `update()`-guard survey found.
  - The fix at each site is the same two lines: read the affected ids BEFORE the tx (the UPDATE
    is what makes the predicate stop matching), then `syncRows('tasks', ids)` after it.
    `store/useShoppingListStore.ts`'s orphan back-fill is the one deliberate non-case — it
    writes `list_id` on load to repair a local row, and `shopping_lists` is not a synced table.

- **⚠️ A `flex: N` shorthand next to `flexBasis: 'auto'` resolves to basis ZERO on device and
  silently deletes the content (2026-08-18, from a user screenshot of a habit's "Hvor ofte?"
  picker rendering as four blank pills).** This is the SECOND time this exact Yoga trap has
  shipped — the first was the 2026-07-16 header title (`HEADER_CLIP_DEBUG.md`) — so it is worth
  knowing by mechanism rather than by symptom.
  - **The mechanism, from Yoga's own source** (`ReactCommon/yoga/yoga/node/Node.cpp`,
    `Node::processFlexBasis`): an `auto` basis does **not** stop there. It falls through to
    `if (style_.flex().isDefined() && style_.flex().unwrap() > 0.0f) return
    config_->useWebDefaults() ? ofAuto() : points(0);` — and React Native leaves
    `useWebDefaults_` **false** (`config/Config.h`). So `flex: 1` + `flexBasis: 'auto'` is basis
    **0**, and a `flexGrow: 0` beside it means the box can never grow back: Yoga clamps it to
    padding + border and the content is squeezed out. In a COLUMN container that basis is the
    HEIGHT. `components/AppModal.tsx`'s `styles.button` had `flex: 1` while its stacked-layout
    companion set `flexBasis: 'auto'`, so **every dialog with 3+ buttons rendered as blank
    pills, exactly `paddingVertical * 2 + borderWidth * 2` tall.**
  - **Two reasons it survived.** A TWO-button dialog takes the row layout and never applies the
    column style, so `confirmDestructive` — the app's most common dialog by far — always looked
    right; only 3+ buttons stack (the recurrence pickers, the destination picker, the new-list
    chooser). And **react-native-web is the mirror image**: RNW emits the CSS `flex` shorthand
    and then the longhands after it, so `flex-basis: auto` wins and the button sizes to content.
    The preview, `npm run wraps` and every screenshot in `review-bundle/` render these dialogs
    perfectly. The comment on that style even asserted "Native was always fine" — written from
    the web symptom alone, and exactly backwards.
  - **Reproduce it headlessly instead of guessing** — `HEADER_CLIP_DEBUG.md`'s method still
    works and is the only thing in this repo that can see this class of bug: `npm i
    yoga-layout@3` in a scratch dir, model the subtree **from a definite-height ancestor down**
    (the collapse does not manifest under an all-auto chain — a toy model will report green),
    and toggle the one style. Validate the harness by re-running that file's header subtree as a
    control first; if the control does not reproduce, the model is too shallow, not the theory
    wrong. Here: 18dp with the `flex: 1`, 42dp without, against the web preview's measured 41dp.
  - **The rule**: state `flexGrow`/`flexShrink`/`flexBasis` explicitly, or state `flex` — never
    both in one composed style. A percentage or numeric basis is safe (it returns before `flex`
    is consulted); `'auto'` is the dangerous one. `lib/__tests__/dialogButtonLayout.test.ts`
    scans `app/`, `components/` and `lib/` for the pair.
- **⚠️ A composer's OWN controls can take its field's focus, and "the user has left" is not the
  same question as "the field blurred" (2026-08-18, from a user report on the habit quick-add:
  *"when I pressed the one that chooses week, and I tried to change interval, it froze. Not
  crashed, but froze"*).** Nothing had frozen. The "Hvor ofte?" picker goes through
  `showAppModal`, which mounts a React Native `<Modal>` — and a Modal takes **window** focus, so
  the composer's `TextInput` blurs the instant the dialog appears. Both quick-add composers read
  that blur as a tap-away, and on an untitled line that meant the composer disposed of itself
  *behind the open dialog*: `components/PadTypeRow.tsx` gated its whole options panel on
  `focused || hasText`, so the panel unmounted; `components/AddRow.tsx` collapses an empty row to
  its "+" bar, so `app/plans.tsx`'s Whenever composer folded away entirely. The user picked
  "Weekly", the dialog closed, and the cells it had just configured — including the interval
  stepper that the pick *brings into existence* — were gone. Every tap in that area then landed
  on nothing, which is reported as a frozen screen, not as a disappearance.
  - **The state was never lost, only its UI** — it lives in `lib/useHabitRecurrenceDraft.ts`, not
    in the panel. That is exactly why it reads as a freeze: nothing looks wrong.
  - **The guard already half-existed.** `PadTypeRow`'s capture-phase `internalPressRef` had been
    answering "did this touch belong to my own controls" since 2026-08-02 — but only to protect
    the *commit*, not the composer's own existence. Both files now branch on it for both, and
    `PadTypeRow`'s gate has a third term (`engaged`). **A new control in an `extras`/`panel` slot
    depends on the slot's wrapper spreading `controlsResponderProps`** — that is the one thing a
    new slot silently misses; `lib/__tests__/composerFocusSteal.test.ts` pins it per slot.
  - **The flag has to be re-armed on focus.** Once a picker has been through, the field is
    blurred, so the next control press sets the flag with no blur to consume it — stale, it eats
    the next genuine tap-away and a typed line silently fails to commit. Both `onFocus`
    handlers clear it.
  - **The general lesson**: a blur says the field lost focus, never *why*. Anything a surface
    tears down on blur (a panel, an expansion, a draft) needs to know whether the focus went to
    one of its own controls first — and `<Modal>`, bottom sheets and a pushed route all count as
    "its own control" when the surface is what opened them. Invisible to `tsc`, and invisible to
    a screenshot; `npm run preview` catches it only by accident (react-native-web blurs on
    mousedown instead of on window focus), which is why the regression test is a source scan.
- **⚠️ A header comment that ASSERTS a safety property is not evidence the property holds — verify it against the actual whitelist/schema/predicate it claims to satisfy (2026-08-10, from a stress-testing pass on PR #540).**
  `store/useShoppingStore.ts`'s header said `doneShopping`/`monthlyReset`/`resetMonthlyList`
  were "deliberately left untouched" by the live-sync stamp because they "don't write
  whitelisted columns anyway". That claim was false and had been for as long as the sync
  whitelist existed: all three set `checked = 0`, and the two resets also set `list_id =
  NULL`, and BOTH columns are in `lib/liveSync.ts`'s `shopping_items` whitelist. Nobody had
  to introduce a bug — the header was wrong the day it was written and nothing ever checked
  it against `TABLE_COLUMNS`. The consequence was silent and cyclical: an unstamped bulk
  write never moves `updated_at`, so a paired phone's untouched copy wins the LWW tiebreak
  outright, and because `buildDelta` ships a FULL-ROW snapshot, one edit to any unrelated
  field on that phone carries the stale value back — the monthly reset reverted itself,
  every month, on every household that had ever paired a device.
  **Why the existing test suite didn't catch it**: the tests for these functions asserted
  the in-memory `set()` transition was correct, which it was — nobody wrote a test asking
  "does this touch a synced column without announcing it", because the header had already
  answered that question (wrongly) and nothing prompted re-asking it. A false safety claim
  in a comment doesn't just fail to help — it actively suppresses the test that would have
  caught the bug, because both the code and the test were written against the same belief.
  **The general lesson**: when a header/comment says a code path "doesn't touch X" or "is
  safe because Y", that is a claim to verify, not a fact to trust — especially for any code
  that bypasses a store's normal write path (raw SQL, a bulk transition, a migration) where
  the normal path's safety net doesn't apply. Cross-check it against the actual list/schema/
  invariant it's claiming to respect (here: grep the columns the SQL sets against
  `TABLE_COLUMNS` in `lib/liveSync.ts`) rather than the prose. This is also why a stress-
  testing pass is worth doing periodically even with a green test suite: the suite proves
  the code matches its own tests, not that either matches reality.
- **⚠️ A shape repeated at 8 of 10 sites is a HABIT, not an invariant — and the two sites
  that skip it look identical to the eight that don't (2026-08-12, found while surveying for
  the de-duplication pass, fixed in phase 3).** Every store's `update(id, patch)` opened by
  looking the id up in its own array and returning if it wasn't there. `useHealthStore` and
  `useMedicineStore` never did, from the day each was written. Nothing pointed at it: the SQL
  is a no-op either way — an `UPDATE … WHERE id = ?` that matches no row changes nothing —
  so there was no wrong value to notice, no failing test, and no visible difference at the
  call site. The cost was everything *around* the write: `set()` got a freshly `.map()`ped
  array, so every subscriber re-rendered for a change that did not happen, and the action's
  tail ran regardless — `scheduleWidgetSync()` for both, plus `syncTrayReminders()` for
  medicines, which cancels and re-arms all four tray notifications through the path
  `lib/medicineNotifications.ts` warns can un-schedule what it just armed. **Two general
  lessons.** (1) When surveying duplicated code, diff the copies against each other before
  sharing them — the *odd one out* is the finding, and it is invisible while you are reading
  any single copy. (2) A guard whose failure mode is "a no-op that costs nothing visible"
  will not be missed by a test suite; it has to be pinned deliberately, which is why
  `__tests__/storeUpdateGuard.test.ts` asserts the collection comes back as the same array
  **reference** and that the mocked side effects did NOT fire. Both now live inside
  `lib/storeCrud.ts`, where they can't be left out.
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
- **⚠️ Metro's cache lives in `/tmp`, is keyed by project root, and `node_modules` is often a
  SYMLINK — so a preview build can silently bundle a stale copy of a file you just edited
  (root-caused 2026-08-04).** Symptom: you change a component, `npx tsc --noEmit` is clean,
  `npm run preview` succeeds with 0 page/console errors — and the screenshot shows the OLD
  behaviour, with no error anywhere to explain it. `dist/` is even newer than your edit, so
  timestamps look fine. This ate a long debugging session; the tell is that it is *selective* —
  other files in the same change bundle correctly, so the app looks half-updated rather than
  obviously stale.
  **How to confirm it in one step, before you debug the component**: put a unique literal in the
  code (`label: 'zzMarker1234'`), rebuild, and `grep -o zzMarker1234 dist/_expo/static/js/web/entry-*.js`.
  Zero hits means the bundle is stale and the component is fine. Do this FIRST — reasoning about
  the DOM while the bundle is stale produces a chain of wrong conclusions.
  **The fix:** `rm -rf /tmp/metro-* /tmp/haste-* .expo dist` and rebuild. `rm -rf node_modules/.cache`
  is NOT enough, and in an agent worktree it is actively misleading — `node_modules` is symlinked
  to the main checkout, so you are clearing a different tree's cache.
  This bites hardest in `.claude/worktrees/<agent>/`, where several checkouts of the same repo
  share one `node_modules` and one `/tmp`.
- **⚠️ Reanimated AUTO-workletizes far more callbacks than the ones you write `'worklet'` on,
  and calling a normal function from one crashes the app on device while looking perfect on web
  (root-caused 2026-08-08, from a user report that the design lab crashed on the first tap of a
  part).** `react-native-worklets`' Babel plugin workletizes, with no directive in the source to
  tell you: every `Gesture.*` builder method (`onBegin`/`onStart`/`onUpdate`/`onEnd`/
  `onFinalize`/`onChange`/`onTouches*`), the Reanimated hooks (`useAnimatedStyle`,
  `useDerivedValue`, `useAnimatedReaction`, `useAnimatedProps`, `useAnimatedScrollHandler`,
  `useFrameCallback`), the **animation COMPLETION callbacks** (`withTiming`/`withSpring`/
  `withDecay`/`withRepeat` — the easiest one to miss, since the surrounding code is plainly on
  the JS thread) and `runOnUI`. Those bodies run on the UI thread; a plain JS function called
  from one throws "tried to synchronously call a non-worklet function on the UI thread" and
  takes the app down. **Hop with `runOnJS(fn)(args)`**, the way `components/DraggableTaskRow.tsx`
  and `components/Slider.tsx` already do; prefer capturing primitives (`part.id`, not `part`).
  Two things make this bite harder than it sounds: **`onFinalize` fires on a plain TAP**, since
  a pan that never activates still finalizes when the finger lifts — so the crash is not
  confined to the drag nobody can test headlessly — and **the web preview cannot see any of
  it**, because worklets run on the JS thread there, so `npm run preview` renders the broken
  screen with zero page and zero console errors. `__tests__/workletSafety.test.ts` is the guard:
  it source-scans every workletized body in `app/`, `components/`, `lib/` and `store/` and fails
  on a bare call that isn't `runOnJS`, a Reanimated worklet-safe API, a `'worklet'`-marked
  function or a local declared in that body. Its `WORKLETIZED_ARGS` table mirrors the plugin's
  own — re-check it when Reanimated is upgraded.
- **`StyleSheet.absoluteFill`** (not `.absoluteFillObject`) for full-screen overlays
- `useT()` depends on `useSettingsStore`, so it re-renders when language changes — this is intentional. Outside components (stores, schedulers) use `getTranslations(lang?)` instead — it reads the current language from the store when no arg is given.
- The scan uses on-device OCR via `@react-native-ml-kit/text-recognition` (`parseReceiptText` in `app/scan.tsx`). Confirmed items are added to the shopping list, logged to `purchase_log`, and upserted into the `store_items` catalog (powers shopping autocomplete).
- `BottomNav` labels read from `t.nav` — add new entries there when adding a tab.
- `completedCount` in `useTaskStore` counts all-time done tasks (intentional — cumulative "small things add up" philosophy)
- `backlogTasks(today)` only returns non-recurring tasks; recurring tasks reappear by date schedule
- **Notifications**: `lib/notifications.ts` only takes already-localised content. Medicine tray reminders live in `lib/medicineNotifications.ts` (one daily reminder per tray, re-synced from `store/useMedicineStore.ts` on every mutation; quiet hours SKIP a tray like habits, never shift it) — and note its "decide first, then cancel only what isn't being rescheduled" rule: a blanket cancel-then-schedule races with `scheduleDailyReminder`'s own internal cancel and can silently un-schedule what it just armed. Per-task reminders live in `lib/taskNotifications.ts` and cover both kinds — one-off tasks fire once (skipped if done/past), weekly-recurring tasks fire on every selected weekday (via `scheduleWeeklyTaskNotifications`); time-box tasks also get an "end" reminder. Habit daily reminders in `lib/habitNotifications.ts`; weekly/monthly reminders in `lib/reminders.ts` (`syncReminders`). (Both scheduler modules were extracted out of their stores some time ago — this line said they still lived in `useTaskStore`/`useHabitStore` until 2026-08-12; the stores now hold only thin adapters.) The quiet-hours split is one shared helper each way: `shouldSkipForQuietHours` for the two that skip (habits, medicine trays), `pushPastQuietHours` for the one that defers (tasks) — and the four quiet-hours settings fields are one `QuietHoursSettings` type the three scheduler settings types extend. `settings.tsx` re-syncs on relevant changes; `_layout.tsx` and onboarding step 6 sync on startup/finish. The persistent "today's overview" notification is the odd one out — it is not scheduled but re-posted in place by `lib/widgets/sync.ts`, on a LOW-importance, badge-less, **`PUBLIC`-lockscreen** channel whose id carries a version suffix (see the 2026-08-15 bullet above before touching either).
- **Retention**: `pruneOldData()` in `lib/db.ts` trims dated history to the last `RETENTION_DAYS` (365) on startup; config tables are left untouched.
- **Materials — MOSTLY HISTORY as of the 2026-08-05 card reset** (see "One card design" above: `Surface` and `Button` no longer mount `GlassFill` at all, and `settings.glassSurfaces` is inert for both). What survives: `getMaterialStyle()` is still called for `mat.innerLine` (a filled button's border) and by the handful of back-compat consumers listed in its own doc, and `getGlow`/`getLayeredShadow` are untouched. The description that follows is kept because those consumers still exist — but **do not build anything new on it**. `getMaterialStyle()` in `constants/theme.ts` computes the glass surface finish from a single base colour — a translucent tinted `backgroundColor` wash plus a calm border, consumed by `components/GlassFill.tsx` (≤2 render layers: an optional `BlurView` frost for overlay/chrome contexts, then the colour wash; ambient content cards get no `BlurView` at all). Rendered via a two-layer view (outer = border + `getLayeredShadow`, inner `overflow:'hidden'` mask = the fill) so shadows aren't clipped. There is no `bubbleMaterial` metal/rock/paper/stone finish system — that never existed in code, only in earlier prose; `settings.glassSurfaces` (reduce-transparency a11y toggle) is the only material-related setting. Purposeful active/focus glow is a separate, sparingly-applied halo — `getGlow(color, level)` — not part of the material itself.
- **Animation, button-press, and haptics**: read `ANIMATION_GUIDELINES.md` (repo root) before writing or editing any of these — it has the real timing/easing/spring values and the `lib/haptics.ts` contract this codebase actually uses. Paste its §8 block at the top of any animation/interaction/haptics prompt.
- **⚠️ The reserve-only native surface is GONE as of 2026-08-15 (v1.6.0) — Decision 040 is
  retired.** On maintainer instruction ("remove all dependencies not wired up to something"),
  eight packages that nothing imported were removed along with their `app.json` plugin entries:
  `expo-local-authentication`, `expo-sensors`, `expo-audio`, `expo-media-library`,
  `expo-quick-actions`, `expo-background-task`, `expo-task-manager` (orphaned with it) and
  `expo-network` (which was not even plugin-registered). Decision 040's bet had already paid
  off for the half of the reserve that got used — `expo-location`, `expo-calendar`,
  `expo-contacts` and `expo-speech-recognition` are all wired now and shipped over OTA without
  a build — but the other half sat unused for months while adding manifest permissions the app
  never exercised (`BODY_SENSORS`, the media-library storage pair, `USE_BIOMETRIC`).
  **What this costs, stated plainly so nobody rediscovers it the hard way**: biometric app-lock
  (the most plausible near-term want, given this app holds health rows) and anything sensor- or
  background-task-shaped now needs the package re-added AND a new native build before its UI
  can ship. That is a real regression in optionality, accepted deliberately. **Do not re-add a
  package "in reserve" without asking** — the rule now is that a native dependency arrives in
  the same change as the feature that uses it. `REBUILD_DECISIONS.md` Decision 040 and
  `REBUILD_PLAN.md` §1 describe the old strategy and are history, not current state.
  - **⚠️ Removing the packages did NOT remove their manifest entries — that was a second,
    separate pass (2026-08-15, launch prep), and it is the reusable lesson here.** A plugin
    entry is what an `expo install` adds; a raw `android.permissions` / `ios.infoPlist` key
    is hand-written and survives the package leaving, invisibly, because nothing typechecks
    an app.json string against an installed dependency. Left behind for a full release:
    `ACTIVITY_RECOGNITION` + `NSMotionUsageDescription` (expo-sensors), `NSFaceIDUsageDescription`
    (expo-local-authentication), `UIBackgroundModes: [fetch, processing]` (expo-background-task),
    `NSPhotoLibraryAddUsageDescription` (expo-media-library) — plus two that never belonged to
    any package: `FOREGROUND_SERVICE` and `USE_FULL_SCREEN_INTENT`, neither of which any code
    or library manifest asks for. **This is a Google Play problem, not just tidiness**: several
    of those are policy-gated permissions whose mere presence forces a Play Console declaration
    form and invites rejection for an app that demonstrably never calls them.
  - **`@bacons/apple-targets` went in the same pass**, for the original rule's reason: it was
    plugin-registered with no `targets/` dir and no `expo-target.config` anywhere, i.e. iOS
    widget scaffolding that has never had a target to build. The App Group entitlement
    (`group.com.freyrnorpixel.unfocus`) is declared directly in `app.json`'s `ios.entitlements`
    and is untouched, so re-adding the package is all that stands between here and an iOS
    widget target. That, and `ios.appleTeamId`, are still unset — see the TestFlight section.
  - **`USE_EXACT_ALARM` was deliberately KEPT and is the one left for the maintainer.** Play
    restricts it to alarm-clock/calendar apps and will ask you to justify it; but expo-notifications
    drives every reminder in this app through AlarmManager, and dropping it risks medicine-tray
    and habit reminders firing late on Android 14+, where `SCHEDULE_EXACT_ALARM` alone is
    denied by default. That is a policy-vs-reliability call, not a cleanup — don't remove it
    to make a doctor warning go away.
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

### ⚠️ Merging to `main` does NOT reach Google Play users (found 2026-08-15, launch prep)
`update.yml` publishes to EAS branch `preview`. The `preview` and `testflight` build
profiles are channelled to `preview`, so a merge reaches testers. **The `production`
profile — the Play Store AAB — is channelled to `production`**, and nothing was
publishing to that channel at all. Every "published" fix was going to the testers'
channel while a Play install sat frozen on its embedded bundle, with no error anywhere
— the same silent shape as the predecessor app's `runtimeVersion` policy incident.
- The missing half is `.github/workflows/promote-production.yml` ("OTA Update
  (Production channel)"), `workflow_dispatch` only. **Deliberately not a push
  trigger**: merging should keep reaching testers instantly, while reaching real
  users stays a decision somebody makes rather than a side effect of a merge.
- **Prefer promoting a GROUP over a fresh publish.** Pass the update group id from
  `eas update:list --branch preview` and the workflow runs `eas update:republish`,
  shipping the exact bytes already tested. A blank group republishes from whatever
  `main` looks like now, which is not necessarily what the testers approved.
- **One-time setup, maintainer-only and NOT yet done** (needs an interactive
  `eas login`): `eas channel:create production --branch production`, verified with
  `eas channel:view production`. Until that link exists the workflow publishes to a
  branch nothing listens on — a silent no-op, so check the channel before trusting
  the first green run.

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
