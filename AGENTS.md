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
| Stores read/write rows via `lib/dataAccess.ts` (`loadFirst`/`loadAll`/`updateRow` + `FieldMap`) | Used by **all 21** stores — there is no outlier (this line said "13 of 14" until 2026-08-12; both halves were stale). `useSettingsStore` is the odd shape rather than the exception: one row, so `loadFirst` + partial `updateRow` and no `insertRow`/`add`/`remove`. Don't hand-roll row mapping in a new store |
| **Any screen or visual change is checked against `DESIGN_RULES.md`** | 25 numbered invariants (spacing, placement & order, colour, hierarchy, tap targets, motion, copy tone). Three of them are enforced in CI: tap targets/motion tokens (`lib/__tests__/designTokens.test.ts`), palette contrast (`colors.test.ts`), copy tone (`copyTone.test.ts`). **Eight rules have open conflicts with shipped decisions and are NOT binding yet** — read the audit before "fixing" one: `DESIGN_RULES_AUDIT.md`. Tap targets go through `MIN_TAP_TARGET`/`HitSlop`, motion through `Duration.*` — never a bare `48`/`44`/`hitSlop: 8`/`duration: 220`. **`MIN_TAP_TARGET` is 48 as of 2026-08-08** (Material Design 3, up from WCAG's 44 — the one thing taken from MD3; its *look* is deliberately not adopted). `lib/designLab.ts`'s `MIN_TAP_TARGET_FLOOR` stays 44 on purpose — the accessibility floor the lab may tune down to, not the app's default |
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
- **Empty-state explainers** (`components/StarterCard.tsx`, 2026-07-26; extended 2026-07-27): a second, more visible teaching layer than the ⓘ hint — a short explanation plus one concrete example row, rendered inline where content would be while a surface is empty, and gone once the user has their own (emptiness is the gate, so it also returns if they delete everything). **The gate is a plain `length === 0` on only one of the callers** (`components/GoalsEditor.tsx`; it was `app/goals.tsx` until that screen was retired 2026-08-12) — don't copy that shape blindly (measured 2026-07-31, AUDIT.md): Habits counts the *person-filtered* `profileHabits`, Shopping needs `lists.length === 0 && items.length === 0` (a migration seeds one empty monthly list, so a monthly count is never 0 and would suppress the card for every new user), and Health and Plans both OR in a just-added flag (`healthStarterAdded` / `planStarterAdded`) so pressing the example's "+" doesn't unmount the card in the same tick that the write lands — Plans additionally suppresses it on the timeline layout, where `PlanTaskCard` already draws its own inline explainer. Live on Habits (plus four one-tap starter habits from `lib/habitStarters.ts`), Plans, Shopping and Health, and — since 2026-07-27 — on the **Home preview cards** too: the day-view card (`components/PlanTaskCard.tsx`) and the shopping card (`components/HomeShoppingCard.tsx`) each render their own explainer + suggested-add row *inside* the card, never as a nested Surface (a Surface inside a Surface reads as a nested panel) — since 2026-08-12 that means `StarterCard`'s `embedded` prop rather than hand-rolling the block; see the placement paragraph at the end of this bullet. Copy lives under `starters.*` in `lib/i18n.ts`; each one's core message is also in the matching `hints.*.example`, which is where it stays reachable after the card disappears. The StarterCard shell is styled with a **neutral** `theme.border` Surface, deliberately NOT the accent-barred HintCard look — on a first visit both are on screen at once and twins would read as a duplicate — while `components/StarterExampleRow.tsx` (the suggestion itself) is drawn as a **provisional sketch** — dashed neutral border, no fill, muted italic title, accent only on its "+" and its "Example" chip. **That reversed on 2026-08-10** ("Examples are not visible examples, they look like a part of the card or an active task, not as a temporary thing"); until then it deliberately DID copy the surrounding list's real row styling (accent wash + accent edge) on the opposite 2026-07-27 report, and succeeded so completely that a one-word chip was the only thing left telling the two apart. It keeps the row's GEOMETRY — an example has to be the same shape as the thing it's an example of — and changes only the finish. Read that file's Edit notes before restoring any of it. **The Energy strip is the half-exception**: its explainer is a permanent one-line hint under the meter (`t.energyMeter.hint`), *not* a disappearing StarterCard — as a separate card between Energy and the to-do card it read as belonging to the to-do card, and an explanation that self-destructs isn't there when you come back to the number months later. **But since 2026-08-03 it ALSO has a StarterCard tutorial** (`starters.energy`), and the two coexist deliberately: the tutorial *replaces the meter itself* while nothing carries an energy value and no capacity has been set (a full ten-pip bar with nothing able to spend it is the "reads as a score" problem at its worst, on the first screen a new user sees), with nothing above it to be confused with, and the permanent hint comes back attached to the meter the moment there's a number worth naming. Its gate is a third shape again — `!hasEnergyItems && !hasSetCapacity`, AND all three source stores `loaded`, because an unloaded store looks exactly like an empty one and the wrong answer flashes teaching copy at a long-time user. See `components/EnergyMeter.tsx`'s "Tutorial state" note.
  **Placement is decided by EMPTINESS, and there is one component for the line (2026-08-12).**
  Maintainer: *"Explanation always sits underneath sub-header"*, scoped on follow-up to *"only
  when the card is empty"*. So the explainer line — `components/CardHintNote.tsx`, the shared
  bulb + italic sentence — takes a `placement` prop: `'head'` (directly under the card's header,
  no hairline, no `marginTop`) while the surface is empty and the explanation is the main thing
  in the card, `'foot'` (the default, with its attaching hairline) once the card has real
  content to lead with. **This narrows, and does not delete, the 2026-07-30 "move tips out from
  between the title and the content" decision** — that complaint was about teaching standing
  between a title and content *the user already has*. All five empty-gated explainers are
  therefore at the head (`PlanTaskCard`, the three Home cards, and `MedicineTrayCard`, whose
  `compact embedded` StarterCard became a `CardHintNote` in the same pass, leaving `compact`
  caller-less); **`EnergyMeter`'s hint is the documented exception and stays at the foot**,
  because it is permanent rather than empty-gated — a hint under a meter that has a number in
  it. `lib/__tests__/exampleRows.test.ts` asserts the rule *and* that counter-case, since a
  placement is invisible to a screenshot. In the same pass `PlanTaskCard`'s example gained the
  shared `StarterCard collapsible` trigger row (`embedded`, and deliberately **no `text`** — its
  explainer is the head-mounted note, and one card saying the same sentence twice with two
  different lifespans is what StarterCard's optional-`text` note warns against), so the card
  that was the model for the others is no longer the one surface whose example can't be folded
  away. Its ghost add-row stays OUTSIDE that wrapper: on the `readOnly && !onAddTask` branch it
  is the only way in, and a collapse must never take away the last "add something" affordance.
- **Medicine trays** (2026-07-27, `components/MedicineTrayCard.tsx` + `app/medicine-form.tsx` + `store/useMedicineStore.ts` + `lib/medicineSchedule.ts` + `lib/medicineNotifications.ts`): the Health tab's first card. Medicine is organised into four **trays** — morning/midday/evening/night — deliberately NOT exact per-medicine clock times: a tray is a *window*, so a dose taken at 11:40 is still a morning dose and an untaken one reads "still due", never "missed" (the same no-shame framing as habits' rest days; keep any new copy on that side of it). One reminder per tray, shared by its medicines, with a **Taken** action button that logs the whole tray from the notification shade (`'medicine-reminder'` category, next to the existing `'task-reminder'` one). As-needed (PRN) medicines belong to no tray and are guarded by a minimum gap + optional daily cap instead (`asNeededState`) — nothing ever nudges you to take one. Per-person via People/family mode (`child_name`, same convention as tasks/habits). `health_logs.medicine_id` optionally attributes a symptom entry to a medicine ("this ADHD med gives me stomach issues"), picked in `app/health-form.tsx`'s "Possibly from" row and surfaced on that medicine's own page. Gated on `settings.featureMedicine` (on by default, still a real toggle). **Deliberately NOT in the AI setup guide** — medicine names/doses are the most sensitive rows in the DB, and the guide already refuses health-log data. Stock/refill tracking is a known follow-up, not built.
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
    already draw the same bordered, focus-showing field — `AddRow` and `InlineAddItem` both got
    it in the 2026-08-05/06 passes, `InlineAddItem` by using `FormControls`' `Input` outright —
    so "converge the field" is **done**; don't re-propose it. What still differs is the TIERING:
    | Composer | Tier 1 | Tier 2 | Tier 3 | Used by |
    |---|---|---|---|---|
    | `PadTypeRow` | always-open line | `panel` + `extras` | `onMore` ✓ | the 4 Home cards, Habits tab, To-do timeline |
    | `AddRow` | collapsed `+` pill → line | `panel` + `extras` | **none** | Plans, Health, health-log, Goals, GoalsEditor, Food, Catalogue, Medicine |
    | `InlineAddItem` | collapsed `+` bar → **whole panel** | **not separated** — name, catalog autocomplete, price, category, qty and Temporary all at once | n/a | Shopping, inventory |
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
  - **A button has THREE states, and only the top two variants pop out (2026-08-12).** From a
    brief asking for "flat, popped out, pressed in". Almost all of it was already shipped — the
    resting elevation (`depth="raised"` + the `keyBase` housing), the sink, and the shadow
    collapsing to nothing at the bottom of the travel — so this pass added the one missing
    ingredient and reassigned who wears which state:
    - **The face darkens while held**, by `PRESS_DARKEN` (0.1) in `components/Button.tsx`, via
      PressableScale's new `pressFill={{ rest, pressed }}`. It is interpolated off the **same
      `press` shared value as the sink**, so the colour and the travel are one gesture that
      cannot disagree, and reduce-motion needs no branch (that value is assigned instantly).
      The amount is deliberately *between* the cap and its `keyBase` (`darken(fill, 0.22)`):
      the face moves toward the shade of the base it is landing on, never past it, or the
      pressed cap reads as a hole rather than a key. **This is not the opacity dip the
      2026-08-10 pass rejected** — a dim reads as disabled; a darker fill reads as a surface
      that has moved away from the light. A caller passing `pressFill` must not also set
      `backgroundColor` in `style`; PressableScale owns it, same contract as `depth`.
    - **`secondary` is FLAT now** — no `keyBase`, no cast shadow, flush with the card. A
      soft-tint fill that is elevated competes with the one action a screen is asking for.
      It keeps its full `travel` and its darken, so flat is not inert. Side effect worth
      knowing: it lost the wrapper's `paddingBottom: travel`, so a secondary button is 3–5px
      shorter in layout than it was. `primary`/`danger` keep the whole raised kit unchanged.
    - **The app's tokens won over the brief's literals.** The brief specified
      `shadowOffset {0,4}` / opacity 0.15 / radius 4 and a flat `translateY: 2`; the shipped
      values stay `getElevation('raised')` and `Travel.*`, because both are shared with
      `Surface`, `IconButton`, `AddFAB` and `BottomNav` and `Travel` is deliberately per-size.
      Implement the *states*, not the numbers, or a Button stops being the same material as
      an IconButton beside it.
    - `ghost` was left alone: no fill to darken, no base to sink onto, so it keeps its
      documented `press="scale"` opt-out. Don't "finish the job" on it.
    Pinned by `lib/__tests__/chromeRhythm.test.ts` §4 — a press state is invisible in a
    screenshot, and the web preview runs worklets on the JS thread, so it cannot see one either.
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
      assumes a screen backdrop — the meal sections' `Surface`, Catalogue's search/add
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
- **Dark mode is TRUE BLACK (2026-08-10)** — `bg` `#000000`, `surface` `#1E1E1E`,
  `surfaceMuted` `#121212`, `text` `#F3F4F6`, `accent` `#3B82F6`. Adopted wholesale from an
  outside design review, on the maintainer's instruction, replacing the 2026-07-18 "Midnight
  glass" deep navy. **The LIGHT palette was deliberately not touched** — the review's light
  values put the control-edge border at 1.18:1, which would erase the border-as-grouping-signal
  system the card reset below is built on. Three things to know before editing any of it:
  - **`components/ScreenBackground.tsx` is what dark mode actually looks like, not the
    palette.** It paints its own private gradient over `theme.bg` on every non-`plainBackground`
    screen, so its `DARK.base` is three `#000000` stops now and both blue radial glows are at
    opacity 0 (a radial lift on pure black is exactly what destroys the OLED benefit). Change
    the token without changing that file and nothing moves on screen.
  - **The review's `border.subtle` `#27272A` is `rule`, not `border`.** At 1.12:1 on `surface`
    it is a divider weight; `border` is a separately derived `#787882` that clears WCAG
    1.4.11's 3:1 on every rung.
  - **Five dark assertions in `lib/__tests__/colors.test.ts` were relaxed to admit it** — see
    `DESIGN_RULES.md` rule 10a for the table. Four are arithmetic or structural; the halation
    ceiling (7–12:1 → 7–16:1) is a real accessibility trade that was accepted knowingly, and
    that entry says what to pull back first if a device disagrees.
- **One card design — the 2026-08-05 reset** (`components/Surface.tsx` + `lib/screenColor.ts` +
  `computeBorderRamp`/`computeBorderTone`/`BORDER_WIDTH` in `constants/theme.ts`). The
  maintainer's brief was "I've been messing around too much with the visuals. One simple design
  for all cards." Ten numbered points; this is what they became. **Read this before proposing
  any card/border/material change — most of what the older bullets above describe is gone.**
  - **A card is a flat opaque page with ONE border.** White (`#FFFFFF`) in light mode, the flat
    navy `theme.surface` in dark. No frost, no `BlurView`, no translucent wash, no face-lift
    scrim, no beveled rim, no inner line. `components/GlassFill.tsx` is no longer mounted by
    `Surface` OR by `Button` — both took the solid path in the same pass. `settings.glassSurfaces`
    (the reduce-transparency toggle) is now **inert for Surface and Button**: everything is
    opaque unconditionally, which is what that toggle was asking for. Column and setting stay.
  - **Colour lives ONLY in the border, and the border's hue comes from the SCREEN.**
    `lib/screenColor.ts` is **revived** (it was retired 2026-07-31 in addendum A.5 — read its
    header before "re-retiring" it). Mapping: To-do blue · Habits sky · Health teal · Shopping
    green · Notes yellow · Food orange · Scan violet · Goals indigo · **Home and Settings
    neutral grey**. A domain sub-screen wears its parent's hue, so pushing into it doesn't
    change colour. Pinned by `lib/__tests__/screenColor.test.ts`.
  - **Home is the index of the other screens.** It has no hue of its own; each preview card
    passes `borderColor={getScreenColor(theme, '<source screen>').base}`, so Home's habits card
    is sky and its notes card is yellow. That explicit `borderColor` override is the ONLY
    legitimate use of the prop — a card on its own screen passes nothing and inherits.
  - **The hue is graded by weight: card → field → button**, deeper/thicker to lighter/thinner
    (`BORDER_WIDTH` + the `RAMP` table). This is what stops a card full of bordered rows
    reading as a grid, and `lib/__tests__/borderRamp.test.ts` pins the ordering in both
    thickness and strength. Each individual border ALSO ramps deep→light down its own edge
    ("green to light green"). **That gradient is not a revert of the 2026-08-05 flat-rim pass**
    — that pass removed a *lighting* ramp (white lip → dark bottom); this one stays inside the
    screen's own hue with no white and no black in it. Both functions still exist; read
    `computeBorderRamp`'s doc before touching either.
  - **`lib/domainColor.ts` is NOT dead and is not a rival any more.** The two colour systems
    were split by CHANNEL: the screen hue owns every EDGE, the domain hue owns the gradient
    BADGE and its ink. That is what resolved the collision that killed screenColor in A.5.
    Don't derive a card edge from `getDomainColor` — several call sites did, and each one put a
    differently-coloured card on a single-colour screen (the To-do tab's maroon "Recurring"
    card next to its blue "Whenever" one was the visible symptom).
    **The badge takes the screen hue wherever the card isn't domain-coded** —
    `CardAccentBadge`'s `accentOverride`, added 2026-08-06 for the Home preview cards,
    `WeekListCard` and `MedicineTrayCard`. `components/CollapsedSection.tsx` was the missed call
    site (2026-08-10, user report "wrong coloring"): every sub-screen drawer already passes the
    SCREEN's hue as `SectionRail`'s `hue`, so the rail disagreed with its own badge — the Goals
    drawer on Habits drew a `#218432` green flag inside a `#22A7E0` sky card above a sky-tinted
    divider, while the identical Goals drawer on To-do drew it indigo, i.e. one destination with
    two colours depending on where you opened it. `SectionRail` takes a `badgeHue` flag for
    this; `domain` still chooses the GLYPH. Leave it off where a badge genuinely marks a domain
    (a section of mixed-domain rows).
  - **Rows are bordered boxes; there are no ruled lines and no spare lines.**
    `components/PadSheet.tsx` draws one box per row at the FIELD rung with a `Spacing.xs` gap
    (flush would double two 1.25px borders into a line heavier than the card's own, inverting
    the hierarchy). This **reverses `DESIGN_COMPARISON/10-boxed-vs-ruled-rows.md`** — that
    rejection was about boxed rows inside a *glass* card ("cards inside a card"), and the glass
    is gone. It also resolves the rule-5 half of `DESIGN_RULES.md` open conflict #8, and
    **overrules rule 5 itself** ("whitespace over lines") — borders are the grouping signal now,
    by explicit instruction. Dividers are still out: separate with boundaries, not with lines
    between things.
  - **Quick-add options are a dense grid, all visible while typing.**
    `components/QuickAddOptionsPanel.tsx` wraps; `QuickAddOptionRow` is a bordered CELL (label
    over value) that pairs two-per-line and `flexGrow`s so an odd last cell fills its line
    instead of leaving a hole. Pass `wide` for a live control or a long value. **Adjacency is
    the caller's job** — flexbox pairs in the order it's given, so reorder children at the call
    site; there is deliberately no grouping API.
  - **Button fills and states are untouched.** Point 7 of the brief was "button states stay as
    designed now", and the maintainer separately confirmed primary keeps its accent fill so a
    screen still has one obvious action. Only translucency went. A filled variant's border
    derives from its own fill (`mat.innerLine`); `ghost`, having no fill, wears the screen hue
    at the BUTTON rung.
  - **The backdrop got quieter, not removed** — `ScreenBackground`'s `branchOpacity` 0.5→0.28
    light / 0.7→0.42 dark. Point 10 was "decorate with less opaque leaves and branches in edges,
    not to disturb, only to decorate". Cards themselves stay clean; nothing is drawn on a card.
  - **Deliberate exceptions that are NOT drift**: `components/StarterCard.tsx` and
    `components/OpenEpisodeCard.tsx` still pass an explicit neutral `theme.border` on a hued
    screen. Both are documented choices that predate this pass (StarterCard must not twin with
    HintCard; an open episode is deliberately the one flat, neutral card on the Health tab).
    Leave them unless the maintainer rules otherwise.
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
- **Settings** (`app/settings.tsx`): three tabs — **General** (profile, appearance, accessibility, account/backup, version, reset), **Personal** (notifications, shopping cadence, layout, device features), **Advanced** (the Features card, People/family, paired devices, Freyr-mode, debug). Reorganized 2026-07-25 from four tabs; see that file's header for the full before/after.
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
  tabs with Playwright, screenshotting to `preview-shots/` (gitignored). Also exercises four
  real write paths — add a task (To-do), add a habit (Habits), add a medicine + log a dose
  (Health), and (2026-08-07) **build a card from blank in the design lab** — the first three
  confirmed to survive a tab round-trip, proving the store→DB path actually works rather than
  just static render, and the fourth checked at BOTH ends (the part's panel opens AND the card
  draws a real slider for it, since the whole point of that feature is that those two agree).
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
field, an add composer and name·price·trash rows inside a card that is itself inside the
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
- **The run is TWO passes.** `settings` and `medicine-form` are dead ends — pushed screens
  that render no `BottomNav` — so only one of them can end a pass. `health-form` is a push
  that *keeps* BottomNav, so it doesn't need one. The onboarding→tour→Energy-sheet on-ramp is
  shared by both passes via `walkToTabs()`, scanned only on the first (the second re-walks it
  with scanning off, since it's identical and would double every finding).
- **Never `page.goto()` or `page.goBack()` mid-walk**, except the standalone
  `basics-all-rows` route right at the end of the run. Both reload the document, which resets
  the in-memory `sql.js` DB and drops you back into onboarding.
- **`app/scan.tsx` is deliberately not walked.** The web bundle resolves `app/scan.web.tsx`,
  an OCR "not available" placeholder, so measuring it would report on a screen that doesn't
  exist on device. Like the rest of the native-only surface, it needs a real device.

Known-benign findings, don't "fix" them:
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
- The **token screen's three tab labels** may be reported as TRUNCATED by a few px at
  `--width=327`, Norwegian only. `components/TabSlider.tsx` sets `adjustsFontSizeToFit` +
  `minimumFontScale` 0.85, which react-native-web implements neither of — the exact artifact
  this audit's own TRUNCATED warning describes. A few px against a 15% shrink floor is
  comfortable; don't shorten the words for it.

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
- **Notifications**: `lib/notifications.ts` only takes already-localised content. Medicine tray reminders live in `lib/medicineNotifications.ts` (one daily reminder per tray, re-synced from `store/useMedicineStore.ts` on every mutation; quiet hours SKIP a tray like habits, never shift it) — and note its "decide first, then cancel only what isn't being rescheduled" rule: a blanket cancel-then-schedule races with `scheduleDailyReminder`'s own internal cancel and can silently un-schedule what it just armed. Per-task reminders live in `lib/taskNotifications.ts` and cover both kinds — one-off tasks fire once (skipped if done/past), weekly-recurring tasks fire on every selected weekday (via `scheduleWeeklyTaskNotifications`); time-box tasks also get an "end" reminder. Habit daily reminders in `lib/habitNotifications.ts`; weekly/monthly reminders in `lib/reminders.ts` (`syncReminders`). (Both scheduler modules were extracted out of their stores some time ago — this line said they still lived in `useTaskStore`/`useHabitStore` until 2026-08-12; the stores now hold only thin adapters.) The quiet-hours split is one shared helper each way: `shouldSkipForQuietHours` for the two that skip (habits, medicine trays), `pushPastQuietHours` for the one that defers (tasks) — and the four quiet-hours settings fields are one `QuietHoursSettings` type the three scheduler settings types extend. `settings.tsx` re-syncs on relevant changes; `_layout.tsx` and onboarding step 6 sync on startup/finish.
- **Retention**: `pruneOldData()` in `lib/db.ts` trims dated history to the last `RETENTION_DAYS` (365) on startup; config tables are left untouched.
- **Materials — MOSTLY HISTORY as of the 2026-08-05 card reset** (see "One card design" above: `Surface` and `Button` no longer mount `GlassFill` at all, and `settings.glassSurfaces` is inert for both). What survives: `getMaterialStyle()` is still called for `mat.innerLine` (a filled button's border) and by the handful of back-compat consumers listed in its own doc, and `getGlow`/`getLayeredShadow` are untouched. The description that follows is kept because those consumers still exist — but **do not build anything new on it**. `getMaterialStyle()` in `constants/theme.ts` computes the glass surface finish from a single base colour — a translucent tinted `backgroundColor` wash plus a calm border, consumed by `components/GlassFill.tsx` (≤2 render layers: an optional `BlurView` frost for overlay/chrome contexts, then the colour wash; ambient content cards get no `BlurView` at all). Rendered via a two-layer view (outer = border + `getLayeredShadow`, inner `overflow:'hidden'` mask = the fill) so shadows aren't clipped. There is no `bubbleMaterial` metal/rock/paper/stone finish system — that never existed in code, only in earlier prose; `settings.glassSurfaces` (reduce-transparency a11y toggle) is the only material-related setting. Purposeful active/focus glow is a separate, sparingly-applied halo — `getGlow(color, level)` — not part of the material itself.
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
