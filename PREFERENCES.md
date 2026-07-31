# PREFERENCES.md — personalisation audit + proposal (phase 1)

**Status:** phase 1 reviewed (§D). **The reward half of §D is superseded — see §D0 below.**
**Date:** 2026-07-31 · **Branch:** `claude/personalization-audit-proposal-5dbbiu`

---

## D0. Superseding direction (maintainer, 2026-07-31, later same day)

The Bonsai was **dropped entirely** before any of §D's sapling work was built. What shipped
instead, in this branch:

- **Energy is a real on/off toggle again** — §D #1's "re-gate it" stands, and is done:
  `energySystemEnabled` is un-inerted and gates `EnergyMeter`, `EnergyBalanceCard`, both
  editors' energy steppers and `PlanTaskCard`'s quick-add chip. On by default.
- **No motivation-engine picker.** §D #1's "the user picks an engine during onboarding",
  and the `growth`/`balance` engine split in §5, are **not built**. Energy and the reward
  are two independent toggles, both of which can be on, off, or either. Nothing maps a user
  to an engine, so §D #10's migration is moot — nobody is switched off anything.
- **The reward is ambient, not a card.** No tree, no card, no stages, no health tint, and
  **no number of any kind shown to the user**. Instead `components/ScreenBackground.tsx` —
  the app's own backdrop — grows extra branches around the border as a high-water streak
  climbs, and its whole branch cluster crossfades from the neutral blue toward green with a
  `intensity` that rises on a streak and fades back to neutral. Neutral is the floor: a
  lapsed streak returns the backdrop to exactly the art the app always had.
- **A day counts from habits *or* tasks** — not habits alone, so the streak reflects the
  whole app rather than only the Habits tab.
- **§D #6/#7/#8 (which tree, sapling method, palette) are moot** — there is no tree to draw.
  §D #7's underlying instinct survives, though: the reward is built from `ScreenBackground`'s
  own branch vocabulary, which is exactly "Option B".
- **§D #11 stands** — the high-water mark keeps accruing while the reward is switched off.

`components/BonsaiCard.tsx`, `components/BonsaiTree.tsx`, `lib/bonsai.ts` and its tests are
deleted; the `show_points` / `lifetime_bonsai_points` columns survive (this repo never drops
columns) and now back `settings.showGrowth` / `settings.lifetimeGrowth`. §D #2, #3, #5, #9
and #12 are untouched by this and remain open phase-2 work.

---

## D. Decisions (maintainer review, 2026-07-31)

| # | Question | Decision |
|---|---|---|
| 1 | Energy switchable again? | **Yes** — re-gate it. The user picks an engine during onboarding. |
| 2 | Module scope | **Sub-surfaces and cards only.** Tabs stay fixed; no `BottomNav` work. |
| 3 | Onboarding placement | **Replace** `onboarding/features.tsx`'s picker. `first-run.tsx` untouched at four steps. |
| 4 | Skippable? | **Required — no skip.** "Plain" is presented as an equal third answer, not an opt-out. |
| 5 | Tier B size | **Four**, then three — see #9. Scan and Food do *not* come back. |
| 6 | Which tree | **Both** — backdrop's vector primitives, logo's broadleaf species. |
| 7 | Sapling method | **Option B** — build from `ScreenBackground`'s branch vocabulary. |
| 8 | Palette | **Backdrop geometry + green ink.** Preserves the green↔grey health tint. |
| 9 | Automations | **Delete entirely.** Separate PR, not part of personalisation. |
| 10 | Migration for both-on users | **Map everyone to `balance`.** Bonsai users re-opt-in. |
| 11 | Points while hidden | **Keep accruing.** |
| 12 | Personalise placement | **A card in Settings → Personal.** |

**Net effect on this document:** Tier B drops to **three** modules (Goals, Medicine, Sharing).
Tier A becomes a required onboarding choice. §4's "keep Automations" recommendation is
superseded by #9. §5.5's migration is simplified by #10. §7's four open questions are all
resolved. Sections below have been updated in place; original reasoning is preserved where it
still applies.

### D.1 Consequences that need spec'ing in phase 2

Three follow-on effects, none of which were in the original proposal:

1. **The Explore path must now route through the question.** `app/onboarding/guided.tsx:89`
   currently does `router.replace(firstRunComplete ? '/' : '/first-run')` — it bypasses
   `intro` → `features` entirely. With no skip button, Explore has to pass through the
   motivation step too, or the app's fastest path produces a user who was never asked. This is
   the one place decision #4 has teeth.

2. **Existing users are never asked.** Everyone with `setup_complete = 1` skips onboarding
   forever, so they land on the `balance` default and discover Personalise later. Combined with
   #10, that means **current Bonsai users lose their tree on next launch** until they re-opt-in.
   Points keep accruing throughout (#11), so nothing is destroyed and the tree they come back to
   is fully up to date. This is the accepted cost of #10 — flagging it here so it isn't a
   surprise in testing.

3. **Deleting Automations touches a "load-bearing" note.** `AGENTS.md` lists the automation
   store's boot load among the things that *"stay unconditional"* because gating them would break
   app logic. That note becomes stale on deletion and must be updated in the same PR.

---

## 0. Read this first — three corrections to the brief

Three premises in the brief don't match the repo. Each changes the shape of the work, so
they're up front rather than buried.

### 0.1 There is no BubbleMenu

The brief says *"Off removes the entry from BubbleMenu entirely."* `components/BubbleMenu.tsx`
does not exist and never has in this repo — the radial FAB was dropped before porting
(Decision 008 #5, and `CLAUDE.md` explicitly warns future sessions not to look for it).

Navigation is `components/BottomNav.tsx`: **five fixed tabs** — Shopping, Plans, Home, Habits,
Health — defined by `SITE_ITEMS` in `lib/siteNav.ts`.

This matters more than a naming fix, because **the five tabs are not removable at toggle cost.**
`BottomNav` hardcodes slice indices (`0–1` left group, `2` centre, `3–4` right group), and its
single sliding pill computes `slotX(index)` from three measured tracks (`leftTrack` /
`centreTrack` / `rightTrack`). Dropping a tab means reworking that geometry, and the file's own
header says: *"If SITE_ITEMS' length or item order changes again, update the slice indices below
to match."* A four-tab or three-tab bar is a real redesign, not a flag.

**So: feature modules in this proposal gate sub-surfaces, cards, and entry-point buttons — never
a tab.** That is what the existing flags already do (`featureMedicine` hides a card on Health;
`featureGoals` hides a `SubScreenLinkButton`), and it's the honest scope. If you do want
removable tabs, say so and I'll cost it separately.

### 0.2 The motivation engine is half-built already, and not exclusive

Bonsai shipped **yesterday** (commit `beb9824`, 2026-07-31) as `settings.showPoints` — an
off-by-default opt-in living *alongside* Energy, explicitly framed in `components/BonsaiCard.tsx`'s
header as *"the 'reward, not balance' counterpart to the Energy system."* Both can be on. Both can
be off.

Energy, meanwhile, **cannot currently be turned off at all.** `energySystemEnabled` went inert on
2026-07-26 — pinned to `1` by migration, read by nothing, switch removed from Settings. Maintainer
rationale recorded in `store/useSettingsStore.ts`: *"Energy is always on, just on 0 by default for
simplicity."*

So the exclusive three-way choice you're asking for requires:
- **un-inerting `energySystemEnabled`** (or superseding it — see §5), and
- re-gating three currently-ungated mount sites (`EnergyMeter`, `EnergyBalanceCard`, and the
  energy stepper in the task/habit editors).

That's the single largest piece of phase 2. Flagging it now because "Energy is always on" was a
deliberate decision one week old, and this reverses it.

### 0.3 Onboarding already asks a multi-question feature picker

`app/onboarding/features.tsx` currently asks a **three-row picker**: Sharing & QR, Automations,
Points (Bonsai). The brief wants onboarding to ask **one** question (motivation engine), skippable.

Also relevant: `app/first-run.tsx` (2026-07-30) already runs four one-question steps after
onboarding — motion / text size / appearance / starting screen — and `AGENTS.md` records a hard
invariant: **"Four steps is a hard cap. A fifth thing goes to Settings."**

**Proposal:** the motivation question *replaces* `onboarding/features.tsx`'s picker rather than
becoming a fifth first-run step. Sharing and Automations move to Settings → Personalise only
(they are discoverable-later features by the brief's own rule). First-run stays at four steps and
is untouched. See §6.

---

## 1. Feature inventory

Every user-facing feature, marked **complete** / **partial** / **stub**.

- **complete** — works end to end, has a real entry point, nothing obviously missing.
- **partial** — works, but a named capability inside it is absent or platform-limited.
- **stub** — persisted flag and/or installed module with no working behaviour behind it.

### 1.1 Core surfaces (the five tabs)

| Feature | State | Notes |
|---|---|---|
| **Shopping** — weekly lists, monthly lists, aisles, reorder, quantities, item sheet | complete | Largest screen in the app (`app/(tabs)/shopping.tsx`, 2468 lines). |
| **Household inventory** | complete | `app/inventory-edit.tsx` + monthly-reset review sheet. |
| **Catalogue** (store items, autocomplete source) | complete | `app/catalogue.tsx` + `components/CatalogueTab.tsx`, seeded from `lib/catalogSeed.ts`. |
| **Plans / To-do** — tasks, recurrence, time-boxing, tags, rotation, per-person assignment | complete | `app/(tabs)/plans.tsx`, 1201 lines. Rotation derives turn from date (`lib/taskRotation.ts`). |
| **Home** — preview cards, hold-to-manage ordering, starter explainers | complete | `app/(tabs)/index.tsx` + `components/HomeCardManager.tsx`. |
| **Habits** — recurrence, rest days, starters, Today/Week/Month views | complete | `app/(tabs)/habits.tsx`, 1025 lines. |
| **Health** — symptom logging, severity, per-person, history detail | complete | `app/(tabs)/health.tsx` + `health-log/detail/form`. |
| **Medicine trays** — 4 windows, per-tray reminder, PRN gap/cap, symptom attribution | complete | Shipped 2026-07-27, fully wired incl. notification action button. |

### 1.2 Sub-surfaces (reached by link/button, not tabs)

| Feature | State | Notes |
|---|---|---|
| **Notes** (+ voice capture) | complete | `app/notes.tsx`, `lib/useVoiceCapture.ts` with a real multi-instance guard. |
| **Food / Meals / dishes** | complete | `components/FoodTab.tsx`, `lib/dishSeed.ts` (+20 dishes added today). |
| **Scan — receipt OCR + QR import** | partial | Native complete (ML Kit). `app/scan.web.tsx` is a placeholder — web only. Not a defect, a platform limit. |
| **Budget** (per monthly list, vs tagged receipts) | complete | `app/budget.tsx`, spend pace, store breakdown. |
| **Goals** — strength bands, linking, starters | complete | `app/goals.tsx`. Home card was deliberately removed 2026-07-29. |
| **Sharing & QR** — send/receive tasks + shopping items | complete | `app/share-modal.tsx`, `app/shared.tsx`, `components/SendToSheet.tsx`. |
| **Settings** (3 tabs) | complete | 1776 lines. |
| **AI setup guide** — download `.txt`, upload filled reply | complete | `lib/aiSetupGuide.ts` + `aiSetupApply.ts`, shared validation, confirm-before-apply. |
| **Backup / auto-backup** | complete | `lib/backup.ts`, SAF URI on Android. |
| **Debug notes** (long-press to annotate) | complete | `components/DebugNoteAnchor.tsx`, export via Share sheet. |
| **Freyr-mode** (seed/unseed a starter set) | complete | Personal/dev tool, not a user feature. |
| **First-run personalisation** (4 steps) | complete | `app/first-run.tsx`, one atomic write, 81-combination round-trip test. |

### 1.3 Motivation / progress systems

| Feature | State | Notes |
|---|---|---|
| **Energy** — per-task cost, day/week capacity, custom weekday capacities | complete | But **ungateable** — see §0.2. |
| **Shared load** (per-person Energy pressure) | complete | `lib/personEnergy.ts`, compares pressure not raw totals. |
| **Bonsai / points** — 6 stages, health decay, tree card | complete | Shipped today. Art does **not** match the app's tree — see §7. |

### 1.4 Platform / integration features

| Feature | State | Notes |
|---|---|---|
| **LAN live sync + QR pairing** | partial | `lib/syncService.ts`, `lanTransport.ts`, HMAC pairing all real. **Cannot be verified headlessly** (no device, `lanTransport.web.ts` reports unavailable). Works-on-paper; unproven in this environment. |
| **People / family mode** | complete | `store/usePeopleStore.ts`, synced `people` table, `is_self` deliberately non-syncable. |
| **Android home-screen widgets** | partial | `lib/widgets/` real and wired. **iOS has none** — `@bacons/apple-targets` registered, App Group declared, but no WidgetKit target exists. |
| **Persistent "today's overview" notification** | partial | Android sticky; on iOS it's an ordinary notification (documented behavioural difference). |
| **Calendar sync** | partial | `lib/taskCalendar.ts` mirrors **only one-off, dated, timed** tasks. Recurring tasks are explicitly out of scope. |
| **Contacts on a task** | partial | Real: `components/TaskCard.tsx:1215` picks a contact, stores a name+phone snapshot. But it's an attach-only field — nothing acts on it. |
| **Location on a task** | partial | Real: `TaskCard.tsx:1244` tags a one-shot foreground fix. Geofencing (`location_radius_m`, `geofence_id`, `backgroundLocationEnabled`) is **explicitly out of scope** in `lib/location.ts` — the columns exist, the behaviour doesn't. |
| **Automations (IFTTT rules)** | partial | Builder + store + execution all work, but the vocabulary is **2 triggers × 2 actions**: `task_completed` / `shopping_opened` → `show_message` / `add_shopping_item`. Confirmed at `store/useAutomationStore.ts:36-37` and all 4 `fireTrigger` call sites. |

### 1.5 Stubs — persisted, but nothing behind them

| Feature | State | Evidence |
|---|---|---|
| **Work mode** (hours, work days, enforce, holidays) | stub | 6 inert columns. UI removed 2026-07-25 because *"switches writing settings columns that NOTHING in the app read."* |
| **School mode** | stub | `school_mode_enabled` — "placeholder — no feature logic yet". |
| **Child / parent mode** | stub | `lib/childLock.ts` is real (salted SHA-256 in SecureStore), but `childMode` / `childModePasswordSet` are inert and the Settings UI was removed. A working lock with nothing locked. |
| **Biometric auth** | stub | `expo-local-authentication` in `package.json` + `app.json` plugins. **Zero source references** — verified by grep. Reserve-only (Decision 040). |
| **`expo-sensors`** | stub | Installed, **zero source references**. |
| **Background location / geofencing** | stub | Columns only, see above. |
| **iOS widgets** | stub | Scaffolding only, no target. |
| **`monthlyBudgetNok`** | stub | Superseded by per-list budgets in `useMonthlyListStore`. |
| **`showHints`** | stub | Inert — hints are gated by `seenScreenHints` instead. |
| **`childProfiles`** | stub (migrated) | Superseded by the People registry; retained only so a bad back-fill stays diagnosable. |

---

## 2. The personalisation model

Three tiers, one table, one hook.

### Tier A — Motivation engine (mutually exclusive)

One enum. **The exclusivity is structural, not enforced by logic** — a single-valued column
cannot represent "both", so there is no invalid state to guard and no code path that can drift.

| Value | What renders | What is hidden |
|---|---|---|
| `growth` | Bonsai card on Habits; points awarded and shown | Energy meter, energy steppers, shared-load card |
| `balance` | Energy meter on Home; energy steppers in editors; shared-load card on Plans | Bonsai card |
| `plain` | neither | both |

**Switching is non-destructive, by construction.** Neither engine's progress lives in a field the
switch writes:

- Bonsai progress → `settings.lifetime_bonsai_points`, incremented by `useHabitStore.increment()`.
  Already documented as *"points still accumulate while off, so turning it back on restores the
  tree's full progress untouched."*
- Energy progress → derived, not stored. Consumed energy is computed from completed tasks
  (`lib/energy.ts`); capacities live in `energy_budgets` + `settings.energy*`.

So `plain` → `growth` → `balance` → `growth` returns the exact tree you left. **No wipe, no
reset, no migration on switch.** I'd add a test pinning this — a switch cycle must not touch
`lifetime_bonsai_points` or `energy_budgets`.

One open question for you: **should points keep accruing while `balance` is selected?** Current
behaviour says yes (accrue-while-hidden). I recommend keeping that — it's what makes switching
back feel continuous rather than punishing — but it means the hidden engine is still doing work.

### Tier B — Feature modules (on/off, data preserved)

Scoped to sub-surfaces and cards, per §0.1 (confirmed, decision #2). Every one is **purely
additive** — the repo's existing rule holds: *"gate the surface at its call site — never the data
or the store."* Off hides an entry point. Rows, reminders, and history all stay on disk.

**Three modules: Goals, Medicine, Sharing.** All three exist today as flags, so Tier B is a
re-homing exercise rather than new gating. Scan and Food do not return (#5); Automations is
deleted rather than toggled (#9).

### Tier C — Sensory / intensity

| Preference | Values | Today |
|---|---|---|
| `animationLevel` | `full` / `reduced` / `none` | Exists as a 3-rung ladder over two booleans in `lib/firstRunOptions.ts`. Proposal: promote it to a first-class enum, keep the booleans as derived. |
| `hapticLevel` | `full` / `light` / `off` | **Does not exist.** `lib/haptics.ts` has no gate at all — its header says *"If a 'reduce haptics' setting is ever added, gate here."* One file, one choke point. |
| `notificationLevel` | `full` / `essential` / `off` | **Does not exist as a level.** Five independent toggles exist. Proposal: level is a *ceiling* over them, not a replacement. |

---

## 3. Per-toggle specification

Default · what changes when off · files affected.

### Tier A — `motivationEngine`

**Default: `balance`.** Not `plain`, and not `growth`. Rationale: Energy is what every existing
install has on today, and a default that silently removes a live surface on upgrade would be a
regression for current users. Skipping the onboarding question must land on the status quo.

| When set to… | What changes | Files |
|---|---|---|
| `growth` | Energy meter gone from Home; energy stepper gone from task + habit editors; shared-load card gone from Plans; Bonsai card appears on Habits | `app/(tabs)/index.tsx:667`, `app/(tabs)/plans.tsx:898`, `app/(tabs)/habits.tsx:682`, `components/TaskCard.tsx`, `app/habit-form.tsx`, `components/EnergyMeter.tsx`, `components/EnergyBalanceCard.tsx`, `components/BonsaiCard.tsx` |
| `balance` | As today, plus Bonsai card hidden | same set |
| `plain` | Both hidden. Habits, tasks and Home all still work — every gated element is additive | same set |

**Also affected regardless of value:** `app/settings.tsx` (the Energy capacity card and the
`showPoints` row both move under Personalise), `app/onboarding/features.tsx` (replaced), and
`lib/i18n.ts` (new copy in `en` + `no`).

**Risk to flag:** the energy stepper in `components/TaskCard.tsx` writes `tasks.energy`. Hiding it
means a task created under `growth` has energy `0`. That's already the untouched-task default, so
switching to `balance` later shows a meter with those tasks costing nothing — correct, but worth
saying out loud: **hiding the input does not retro-cost old tasks.**

### Tier B — Feature modules

| Module | Default | What "off" removes | Files affected |
|---|---|---|---|
| `moduleGoals` | **on** | `SubScreenLinkButton` on Habits + Plans; `GoalPicker` in task/habit editors; `GoalGlowDot` on cards. `/goals` route stays reachable by deep link; goal rows and strength history untouched | `app/(tabs)/habits.tsx`, `app/(tabs)/plans.tsx`, `components/TaskCard.tsx`, `app/habit-form.tsx`, `components/GoalGlowDot.tsx`, `components/GoalPicker.tsx` |
| `moduleMedicine` | **on** | Medicine tray card on Health. **Must also cancel the four tray reminders** — hiding the card without cancelling leaves notifications firing for an invisible feature. This is already handled in `app/settings.tsx`'s `applyAndSync`; the same key must be re-wired | `app/(tabs)/health.tsx`, `components/MedicineTrayCard.tsx`, `store/useMedicineStore.ts`, `lib/medicineNotifications.ts`, `app/settings.tsx` |
| `moduleSharing` | **off** | Header share icon, `HomeSharedCard`, shared task/request sections, `SendToSheet`. Received rows stay in `shared_tasks` / `shared_shopping_items` | `components/ScreenHeader.tsx`, `components/HomeSharedCard.tsx`, `components/SharedRequestsSection.tsx`, `components/SharedTasksSection.tsx`, `components/SendToSheet.tsx`, `app/share-modal.tsx`, `app/shared.tsx` |

**Not modules, per review:** `moduleScan` / `moduleFood` were proposed and **declined** (#5) —
`feature_scan` and `feature_food` stay inert and both surfaces stay permanently on, leaving the
2026-07-25 decision intact. `moduleAutomations` is moot: Automations is being deleted (#9, §4.1).

**Deliberately NOT modules:** People/family mode (`peopleModeEnabled` stays its own thing — it
changes data semantics, not just visibility), LAN sync (a device-pairing setting, not a
personalisation), Debug mode, Freyr-mode, backup.

### Tier C — Sensory

| Preference | Default | What each value does | Files affected |
|---|---|---|---|
| `animationLevel` | `full` | `full` → as today. `reduced` → `particlesEnabled` off (ambient drift stops), transitions keep running. `none` → also `reducedMotion` on, which ~30 components already respect | `lib/useAppTheme.ts` (`useAccessibility`), `components/ParticleBackground.tsx`, + the ~30 files already reading `reducedMotion`/`particlesEnabled` — **no new gates needed**, they read the derived booleans |
| `hapticLevel` | `full` | `full` → all four intents fire. `light` → `tap()` and `selection()` only; `success()`/`warning()` suppressed. `off` → every function no-ops | **`lib/haptics.ts` only.** Single choke point — every caller already goes through it, verified by its header's "Used by" list |
| `notificationLevel` | `full` | `full` → per-channel toggles apply as set. `essential` → medicine trays + explicitly-set per-task reminders survive; habit reminders, weekly/monthly reset reminders and the persistent overview go quiet. `off` → nothing scheduled | `lib/reminders.ts`, `lib/taskNotifications.ts`, `lib/habitNotifications.ts`, `lib/medicineNotifications.ts`, `lib/widgets/sync.ts`, `app/settings.tsx`, `app/_layout.tsx` |

**Two things to get right on `animationLevel`:** it must stay **monotonic** — `useAccessibility()`
ORs in the OS reduce-motion flag, so picking `full` can never give a phone more motion than the OS
asked for. That's existing, correct behaviour and must survive the refactor. And `app/first-run.tsx`
already writes this ladder; it must read the same enum after the change, not a parallel one.

**One thing to get right on `notificationLevel`:** `lib/medicineNotifications.ts` has a documented
trap — *"decide first, then cancel only what isn't being rescheduled"* — because a blanket
cancel-then-schedule races with `scheduleDailyReminder`'s own internal cancel and can silently
un-schedule what it just armed. A level change re-syncs **all four** notification subsystems at
once, which is exactly the scenario that rule exists for. This is the highest-risk item in Tier C.

**`hapticLevel` is the cheapest win in the whole proposal** — one file, four functions, no call-site
changes, and an accessibility gap that's currently unaddressed.

---

## 4. Too partial to expose — cut, don't toggle

You asked to be told what shouldn't get a switch. These would each reveal a stub.

| Candidate | Verdict | Why |
|---|---|---|
| **Automations** | 🗑️ **Delete entirely** (decision #9 — see §4.1) | 2 triggers × 2 actions. "Rules that run by themselves" promises a system; the user gets *when a task is completed* or *when shopping is opened* → *show a message* or *add a shopping item*. Live but off-by-default, so it has effectively never been seen. Maintainer's call: remove it rather than give it a toggle. |
| **Location on tasks** | **Cut the toggle** | `locationEnabled` reads like geofencing. It is a one-shot "tag this task with where I am now" and nothing ever reads the tag back. Leave it in Settings → Device features where it already sits as a permission pre-bake. Do **not** promote it to Personalise. |
| **Contacts on tasks** | **Cut the toggle** | Same shape: attaches a name+phone snapshot, nothing acts on it. Same home as above. |
| **Calendar sync** | **Cut the toggle** | Mirrors only one-off timed tasks. A user with recurring tasks turns it on and finds most of their tasks missing. A switch promising "calendar sync" that syncs a subset is worse than no switch. |
| **Child / parent mode** | **Cut** | `lib/childLock.ts` is a genuinely working password store guarding *nothing*. Exposing it ships a lock with no door. |
| **Work mode / School mode** | **Cut** | Pure inert columns. Already correctly removed from Settings; do not resurrect. |
| **Biometric lock** | **Cut** | Module ships in the build, zero code. Would be a switch that does literally nothing. |
| **Widgets** | **Cut the toggle** | Android-only with no iOS equivalent. A cross-platform preference that silently does nothing on half the targets. |
| **LAN live sync** | **Cut from Personalise** | Real, but unverifiable here and conceptually a pairing setting. Stays in Settings → Advanced. |

**Net:** Tier B is **three** modules, not a dozen. The rest of the app's optionality is either
load-bearing (can't be gated), device configuration (belongs in Settings), or a stub (shouldn't
be shown).

### 4.1 Deleting Automations — scope (separate PR)

Decision #9. **This is its own PR, landed before or after the personalisation work but not mixed
into it** — it's a removal, not a personalisation change, and mixing them makes both harder to
review and revert.

What comes out:

| Item | Action |
|---|---|
| `app/automations.tsx` (309 lines) | delete |
| `store/useAutomationStore.ts` (130 lines) | delete |
| Boot load — `app/_layout.tsx:283` + its header note at `:275` | delete |
| `fireTrigger` call sites — `store/useTaskStore.ts:643, 661, 781` | delete calls, keep surrounding logic |
| `fireTrigger` call site — `app/(tabs)/shopping.tsx:452` | delete call, keep the mount effect |
| Settings entry point — `app/settings.tsx:1457` + `FEATURE_ROWS:283` | delete |
| Onboarding picker row — `app/onboarding/features.tsx:68` | moot, file is being replaced anyway |
| i18n — `automations.*`, `nav.automations`, `hints.automations`, `config.features.automations` (both `en` and `no`) | delete |
| i18n — `onboarding` note at `lib/i18n.ts:416` ("Energy, goals, sharing and automations…") | reword |

What stays:

- **The `ifttt_rules` table.** Never dropped — repo rule. It becomes an orphaned table, same
  status as the `glass_blur` column.
- **The `feature_automations` column.** Same reason; it joins the "Inert columns" note in
  `store/useSettingsStore.ts`.
- **`lib/aiSetupGuide.ts` needs no change** — automations were already explicitly out of scope
  for the AI setup guide, so nothing there references them.

One doc fix, easy to miss: `AGENTS.md` currently lists *"the automation store's boot load"* among
the load-bearing things that stay unconditional. That sentence becomes false and must be updated
in the same PR.

---

## 5. Schema + hook

### 5.1 The single-source-of-truth problem

The repo already has a single-row `settings` table with ~80 columns and a `useSettingsStore` that
every screen reads directly. A second table naively added would create *two* sources of truth —
the exact thing the brief forbids.

**Proposal: a key-value `preferences` table, with a one-shot migration of the flag values out of
`settings`, leaving the old columns inert.** The repo has done this exact manoeuvre before —
`childProfiles` → the People registry, an `app_meta`-gated one-shot back-fill, old column retained
so a bad migration stays diagnosable.

**Why key-value rather than the repo's usual wide-row convention:** `lib/db.ts`'s `migrations`
array is append-only and indexed by `PRAGMA user_version` — a merged line can never be edited or
removed, only corrected by appending. With a KV table, **adding a preference needs no migration at
all**: a new key with a TS-side default just works, and a key absent from the table *is* the
default. Given the constraint is OTA-only, that's the property worth having. This is the one place
I'd deviate from the column convention, and it's deliberate.

### 5.2 Schema

```sql
-- lib/db.ts migrations array (append-only — one new line)
CREATE TABLE IF NOT EXISTS preferences (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL DEFAULT ''
);
```

That is the whole schema. Everything else is TypeScript.

- **All values are TEXT.** Booleans serialise as `'1'`/`'0'`, enums as their literal.
- **Defaults live in TS, never in SQL.** A missing row means "use the default", so a fresh install
  writes nothing and an unrecognised key from an edited backup is ignored rather than resolving to
  `undefined`.
- **Every read is validated**, same defence as `sanitizeDetailLevel` / `sanitizeCardStates`: an
  unknown value degrades to the default instead of poisoning a render.
- **Not synced.** `preferences` must never join `syncService`'s `SyncTable` — these are per-device
  choices, and two phones in family mode would fight over them (same rule that keeps `app_meta`
  out of sync).

### 5.3 The registry

```ts
// lib/preferences.ts — pure, dependency-free (no store, no db, no notifications imports)

export type MotivationEngine  = 'growth' | 'balance' | 'plain';
export type AnimationLevel    = 'full' | 'reduced' | 'none';
export type HapticLevel       = 'full' | 'light' | 'off';
export type NotificationLevel = 'full' | 'essential' | 'off';

export type FeatureModule =
  | 'goals' | 'medicine' | 'sharing' | 'automations' | 'scan' | 'food';

export type Preferences = {
  motivationEngine:  MotivationEngine;    // Tier A
  modules:           Record<FeatureModule, boolean>;  // Tier B
  animationLevel:    AnimationLevel;      // Tier C
  hapticLevel:       HapticLevel;
  notificationLevel: NotificationLevel;
};

export const DEFAULT_PREFERENCES: Preferences = {
  motivationEngine: 'balance',
  modules: {
    goals: true, medicine: true, scan: true, food: true,
    sharing: false, automations: false,
  },
  animationLevel: 'full',
  hapticLevel: 'full',
  notificationLevel: 'full',
};

// Derived — the ONLY place the engine→surface mapping is expressed.
export function showsEnergy(p: Preferences): boolean;  // engine === 'balance'
export function showsBonsai(p: Preferences): boolean;  // engine === 'growth'

// Derived — keeps the existing two booleans as the app-wide motion contract,
// so ~30 files that already read them need no change.
export function motionFlags(level: AnimationLevel):
  { reducedMotion: boolean; particlesEnabled: boolean };

export function sanitizePreferences(raw: Record<string, string>): Preferences;
export function serializePreferences(p: Partial<Preferences>): Record<string, string>;
```

`lib/preferences.ts` stays **dependency-free** — no store, no `lib/db`, no `lib/notifications`. Same
discipline `lib/cardLayout.ts` already has, with `lib/__tests__/cardLayout.test.ts` asserting it.
I'd add the equivalent test here.

### 5.4 Hook signature

```ts
// store/usePreferencesStore.ts

/** Whole-object read. Convenient, but re-renders on ANY preference change —
 *  use the selectors below in list rows and anything that renders often. */
export function usePreferences(): Preferences & {
  loaded: boolean;
  load: () => void;
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  patch: (p: Partial<Preferences>) => void;      // ONE atomic write, first-run style
  setModule: (m: FeatureModule, on: boolean) => void;
  reset: () => void;
};

/** Selector reads — preferred at call sites. */
export function usePreference<K extends keyof Preferences>(key: K): Preferences[K];
export function useModule(m: FeatureModule): boolean;
export function useMotivationEngine(): MotivationEngine;

/** Non-React read, for stores/schedulers — mirrors getTranslations()'s role
 *  against useT(). Notification sync and store methods need this. */
export function getPreferences(): Preferences;
```

Three notes on the signature:

1. **The selector form is the point.** `useSettingsStore()` is currently called un-selected all over
   the app, so every settings write re-renders every consumer. Repeating that pattern for
   preferences — read inside `ShoppingRow`, `TaskCard`, every list row — would be a measurable
   regression. `useModule('goals')` returns a boolean and re-renders only when that boolean flips.

2. **`patch()` is atomic on purpose**, mirroring `app/first-run.tsx`'s existing invariant: one write
   holding every selection, so a flow can never half-commit. The onboarding question and the
   Personalise screen both go through it.

3. **`getPreferences()` is not optional.** `lib/reminders.ts`, `lib/medicineNotifications.ts` and
   `store/useHabitStore.ts` need to read `notificationLevel` and `motivationEngine` from outside
   React. Without a non-hook accessor, phase 2 will grow exactly the duplicated flag logic the
   brief prohibits.

### 5.5 Migration (one appended line + one gated back-fill)

```
1. CREATE TABLE preferences (…)                          -- migrations array
2. One-shot, gated on app_meta 'pref:migrated:v1':        -- runs once, ever
     feature_goals    → modules.goals
     feature_medicine → modules.medicine
     feature_sharing  → modules.sharing
     reduced_motion + particles_enabled → animationLevel
     motivationEngine → 'balance' for EVERY existing install   (decision #10)
3. Old columns: left written-but-unread. Added to the "Inert columns" note
   in store/useSettingsStore.ts, per the never-drop rule.
```

**`show_points` is deliberately not read by the migration.** Decision #10 puts every existing
install on `balance`, so the engine needs no back-fill logic at all — it's a constant. That's
simpler than the conditional I originally proposed, and it means no upgrading user loses a surface
they currently have.

The trade, stated plainly: **users who deliberately turned points on lose their tree on next
launch** until they go to Settings → Personalise and pick Growth. Because points keep accruing
regardless (#11), the tree they come back to reflects everything they did in the meantime —
nothing is lost, only hidden. This is the accepted cost; see §D.1 note 2.

`show_points` itself joins the inert-columns list alongside `feature_automations`.

---

## 6. Onboarding + Settings surface

**Onboarding — one question, required (#4).** `app/onboarding/features.tsx` is repurposed from a
three-row picker to a single three-option choice:

> **How do you want the app to keep you going?**
> **Growth** — a small tree that grows as you keep up your habits
> **Balance** — a daily energy budget, so you can see when a day is overfull
> **Plain** — just the lists

**No skip button.** "Plain" is the third answer, presented as an equal choice rather than an
opt-out — so the user always makes an explicit decision, and choosing nothing-extra is still a
decision. Nothing is locked in: all three are changeable in Settings → Personalise at any time,
and the screen should say so.

Sharing drops out of onboarding and lives only in Settings → Personalise — the brief's rule that
everything except the one question is discoverable later. Automations drops out by deletion (§4.1).

**The Explore path has to route through it (§D.1 note 1).** `app/onboarding/guided.tsx:89`
currently does `router.replace(firstRunComplete ? '/' : '/first-run')`, skipping `intro` and
`features` entirely. With no skip button that's a hole: the fastest path through onboarding would
produce a user who was never asked. Explore must pass through the motivation step before
`/first-run`. This is the only structural change decision #4 forces.

`app/first-run.tsx` is **untouched** — still four steps, hard cap intact.

**Settings → Personalise — a card in the Personal tab (#12).** Keeps the 2026-07-25 three-tab
structure intact, and sits naturally beside the existing Layout row, which is conceptually the
same kind of control.

```
Personalise
  Motivation      [ Growth | Balance | Plain ]      ← same control as onboarding
  Features        Goals · Medicine · Sharing
  Movement        [ Full | Reduced | None ]
  Vibration       [ Full | Light | Off ]
  Notifications   [ All | Essential only | None ]
                  › per-channel toggles (existing five, unchanged, under the level)
```

Every control writes through `patch()` and applies immediately, matching Settings' existing
no-buffered-save contract.

---

## 7. The Bonsai visual — how the background tree renders

You asked me to locate the background tree and describe how it's rendered **before** proposing
anything. Here it is, and the answer has a complication.

### 7.1 There are two "trees", and they're different media

**(1) `components/ScreenBackground.tsx` — the app-wide ambient backdrop.**

- **How it renders:** a single inline `react-native-svg` canvas with **hardcoded geometry**. No
  asset file.
- **Geometry:** 13 `<Path>` quadratic-Bézier strokes (`BRANCHES`, `strokeWidth` tapering
  3.2 → 1.8 → 1.4 → 1.1, `strokeLinecap="round"`) + 17 filled `<Circle>` leaves (`LEAVES`,
  r 3.5–5.0), in a `280×607` viewBox, `preserveAspectRatio="xMidYMid slice"`.
- **Palette:** theme-keyed and **blue** — light `branch #6f9aff` / `leaf #a9c4ff` @ 0.5 group
  opacity; dark `#3f74ff` / `#7fa8ff` @ 0.7.
- **Critically: it is not a tree.** There is no trunk. It is three *corner fragments* — top-left,
  top-right, bottom-left — deliberately kept out of centre-screen so nothing sits under the cards.
  Its own header says the branch motif *"stands in for the old centred watercolour-tree image."*
  It **replaced** a tree; it isn't one.

**(2) `components/TreeWatermark.tsx` — the app logo, and the only actual whole tree.**

- **How it renders:** a **raster PNG** — `assets/android-icon-monochrome.png` (81 KB) — drawn via
  `<Image>` with `resizeMode="contain"`, `fadeDuration={0}`, and a caller-supplied `tintColor`.
  Not vector. Not generated.
- **Source characteristics:** it's Android's *monochrome themed icon* — a near-white (248,248,248)
  silhouette on transparency, only ~3% of the canvas opaque. It has **no intrinsic palette**; the
  OS (and now the app) tints it at draw time. Untinted on a light surface it is invisible — that's
  a documented past bug.
- **Where it appears:** `app/onboarding/_layout.tsx` (size 300, opacity 0.06, tinted `theme.text`)
  and `components/SectionDivider.tsx` (size 22, tinted `theme.border`).
- **What it actually depicts** (I rendered it): a **watercolour / ink-wash broadleaf tree** —
  a slender trunk forking into fine branches, a wide asymmetric spreading canopy in loose grey
  brush-strokes, a brushed ground line, inside a soft circular halo. Deciduous, painterly, and
  **not a bonsai**.

**(3) `components/BonsaiTree.tsx` — what shipped today.** Procedural SVG, six hand-placed stages,
brown trunk `#8B5E3C`, terracotta pot `#B5652E`, hard-edged green ellipse canopies, pink blossoms.

### 7.2 The finding

**The Bonsai that shipped today matches neither background.** Different species (potted bonsai vs
spreading broadleaf), different palette (brown/green/terracotta vs blue-grey wash), different
illustration style (crisp vector geometry vs watercolour), different medium (SVG vs PNG).

So your instinct is right — but the fix isn't "make the bonsai match the background tree," because
the background tree is a *raster logo* and the app-wide backdrop is *blue corner branches with no
trunk*. **You have to pick which one is "the tree."**

### 7.3 Three ways to produce the sapling

I have **not** touched any of this. Proposals only.

**Option A — Trace the logo into a shared vector, parameterised by growth.**
Vectorise `android-icon-monochrome.png` once into a `TreeSilhouette` SVG (trunk, 3–4 primary limbs,
canopy masses as soft blobs), then express the six stages as a subset + scale of those paths.
- ✅ Highest fidelity to "same species, younger and smaller". The PNG stays untouched and still ships.
- ❌ Someone must trace it. Watercolour wash → vector loses the brush texture, which *is* the
  illustration style. Risk: the sapling reads as a flat cartoon of the logo.
- ❌ Most work by a wide margin.

**Option B — Build the sapling from `ScreenBackground`'s own branch vocabulary. ← recommended**
The backdrop's `BRANCHES`/`LEAVES` are already vector, already in-repo, already the app's ambient
silhouette language. A sapling is constructed from the *same primitives*: tapering quadratic-Bézier
strokes with the same width ramp and round caps, plus filled circle leaves at the same radii.
Growth = adding strokes and leaves, exactly how the backdrop's three corners differ from each other.
- ✅ **Same silhouette language by construction, not by imitation** — it's literally the same
  drawing system, so it cannot drift stylistically.
- ✅ No new asset, no dependency, no tracing. Fits OTA-only.
- ✅ `lib/bonsai.ts`'s six-stage model, thresholds, health decay and tests all survive untouched —
  the art is already cleanly separated behind a `STAGE_ART` lookup keyed by `BonsaiStageKey`.
  **Swapping the art is a change to one file.**
- ⚠️ **The palette question is yours.** The backdrop is blue. A blue tree is unusual for a growth
  reward, and `health` currently drives a green↔grey tint that carries real meaning. Three ways
  out: (i) keep the backdrop's blue and let *health* modulate saturation rather than hue;
  (ii) use the backdrop's geometry with a green palette — same language, different ink;
  (iii) tint from `theme` like `TreeWatermark` does, so it inherits whatever the surface is.
  **I'd suggest (ii)** — geometry carries "same species" far more than hue does, and green↔grey
  health is worth keeping.

**Option C — Progressively reveal the logo PNG.**
Render the logo and clip it, growing the clip upward with points.
- ✅ Zero new art. Same species / palette / style *by definition*.
- ❌ **It's a reveal, not growth.** A half-clipped adult tree reads as a cut-off tree, not a sapling
  — a full-width canopy with a missing trunk. It also can't express `health`, and the source is
  ~3% opaque at 81 KB, so it will look washed out at card size.
- ❌ **I'd rule this out.** Listing it because it's the tempting shortcut, and it doesn't work.

### 7.4 Decided (#6, #7, #8)

**Build the sapling with `ScreenBackground`'s vector primitives, shaped like the logo's broadleaf
species, inked green.**

Concretely, for phase 2:

- **Primitives** — tapering quadratic-Bézier `<Path>` strokes with `strokeLinecap="round"`, plus
  filled `<Circle>` leaves. Same construction as `ScreenBackground`'s `BRANCHES`/`LEAVES`, so the
  drawing system is shared rather than imitated.
- **Stroke ramp** — reuse the backdrop's own widths (3.2 main → 1.8 → 1.4 → 1.1 sub) and leaf radii
  (3.5–5.0), scaled to the card's viewBox. Matching the ramp is most of what makes two drawings
  read as one hand.
- **Silhouette** — the logo's broadleaf: a slender trunk forking into a *wide, asymmetric,
  spreading* canopy. Explicitly **not** the potted-bonsai shape that shipped — no pot, no
  terracotta, no blossom dots.
- **Ink** — green, with the existing `mix(greyColor, goodColor, health)` tint preserved so a
  neglected tree still greys and a tended one still reads vividly. This is the one deliberate
  departure from the backdrop's blue, and it's what keeps `health` meaningful.
- **Growth** — stages add strokes and leaves, exactly the way the backdrop's three corners already
  differ from each other. A sapling is one trunk stroke + 2 sub-branches + 5–7 leaves; the top
  stage is the full spread.

**Scope of the change: one file.** `components/BonsaiTree.tsx` is rewritten. Everything else
survives untouched — `lib/bonsai.ts`'s six stages, thresholds, health decay and
`daysSinceLastTended`, plus `lib/__tests__/bonsai.test.ts`, because the art already sits behind a
`STAGE_ART` lookup keyed by `BonsaiStageKey`. `components/BonsaiCard.tsx` keeps its props contract
(`stage` / `health` / `goodColor` / `greyColor` / `size`).

**Not touched, per the brief:** `ScreenBackground.tsx`, `TreeWatermark.tsx`, and
`assets/android-icon-monochrome.png`. The backdrop and the logo are read for reference only —
neither is redrawn, restyled, or re-tinted.

---

## 8. Phase 2 — proposed order of work

All twelve questions are resolved (§D). Suggested sequencing, smallest-risk first:

| # | PR | Why here |
|---|---|---|
| 1 | **Delete Automations** (§4.1) | Independent of everything else, and shrinks the surface the rest of the work has to touch. Reverting it later is a clean revert. |
| 2 | **`preferences` table + `lib/preferences.ts` + `usePreferencesStore`** (§5) | Pure infrastructure: schema, registry, hook, migration, tests. Nothing reads it yet, so it can't regress anything. |
| 3 | **Tier C — haptics** (§3) | One file (`lib/haptics.ts`), four functions, no call-site changes. Cheapest real win and an unaddressed accessibility gap. |
| 4 | **Tier C — motion + notifications** | Motion is mostly re-derivation of two existing booleans. Notifications is the riskiest item in Tier C — see the `medicineNotifications` cancel/reschedule trap. |
| 5 | **Tier B — three modules re-homed** | Moves Goals/Medicine/Sharing gates from `useSettingsStore` to `usePreferences`. Behaviour-neutral if done right. |
| 6 | **Tier A — motivation engine** | The big one: re-gating Energy at three mount sites, plus the editors. |
| 7 | **Onboarding question + Explore routing + Personalise card** | Needs Tier A to exist first. Includes the `guided.tsx` routing fix (§D.1 note 1). |
| 8 | **Bonsai sapling art** (§7.4) | Fully independent of 1–7 — could land any time, including first if you want to see it sooner. |

Two things I'd want to pin with tests, since they're the invariants most likely to rot:

- **Engine switching is non-destructive** — a `plain → growth → balance → growth` cycle must not
  touch `lifetime_bonsai_points` or `energy_budgets`.
- **`lib/preferences.ts` stays dependency-free** — no store, no `lib/db`, no `lib/notifications`,
  same assertion `lib/__tests__/cardLayout.test.ts` already makes for `lib/cardLayout.ts`.

---

**Nothing in this document has been implemented.** No source file has been modified — the only
change on this branch is `PREFERENCES.md` itself. Ready for phase 2 on your word.
