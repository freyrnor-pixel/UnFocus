# UI refinement pass — the 2026-08-13 round

> **STATUS: SHIPPED, with one item unresolved (Plan 8b).** This file is the RECORD of that round —
> what was asked, what was decided, and the three things that were deliberately NOT done.
> It is not a to-do list. Read it before reopening any of these decisions; each shipped
> commit's message carries the detail, and the affected file headers carry the rules.
>
> **What shipped** (in landing order — every one is a separate commit on
> `claude/ui-refinements-naming-jpcc3x`):
>
> | Plan | Commit subject |
> |---|---|
> | 0 | catalogue CSV handed over in chat (no code) |
> | 1 | Vertical centering: one optical-alignment rule, and no phantom gap slots |
> | 7 | Examples say so once: "Eksempler:", and the chip on the row goes |
> | 8 | Goals: Personal on Habits, Practical on To-do |
> | 2 | Shopping: "Handlelister", and one card to make the first list |
> | 9 | One shopping-category vocabulary (the app had two) |
> | 3 | Catalogue: a link that reads as a link, a lock over delete, and a sort toggle |
> | 4+6 | The screen explains itself: inline intro cards replace the header ⓘ |
> | 5 | Scan knows what it is scanning: per-card entry points with a target |
>
> **Three things below are now WRONG about the shipped code**, and are left in place only
> so the reasoning is legible. Do not build on them:
>
> 1. **Plan 6 was unnecessary.** It says Shopping's ⓘ sheet is "the ONLY home" for the
>    weekly/monthly reset controls. It is not — Settings → Personal → Shopping has had
>    both since 2026-07-25. That claim came from a comment in `shopping.tsx` that was
>    simply wrong. Only the shortcut link was built.
> 2. **Plan 2's shape was wrong.** It proposed reusing `NewMonthlyListRow`'s
>    collapsed→expanded name field for the weekly trigger. A weekly list is auto-named
>    from its date range and has no text field at all, so the two are twins in styling
>    only.
> 3. **Plan 9 did not exist when this was written.** It was added mid-round after
>    generating the Plan 0 CSV turned up the two-vocabularies bug, and it became a hard
>    prerequisite for Plan 3c.
>
> **One thing was NOT fixed and is still open:** Plan 8b, "Goals missing on To-do's
> Today tab". It could not be reproduced — see that section and the Plan 8 commit for
> the evidence and the one remaining hypothesis.

---

## Context

A round of user-reported UI defects and naming/structure changes across Shopping,
Catalogue, Food, To-do and Goals. They are independent enough to be executed by separate
sessions, so this document is **eight self-contained plans**, each with its own files,
steps, ripple notes and verification. Where two plans touch the same file, the conflict is
called out and an execution order is given at the end.

Two decisions taken with the maintainer during planning:

- The header **ⓘ** button is removed from **all five** tab screens, not just Shopping.
- Shopping's weekly/monthly reset settings get a canonical home in **Settings → Personal**
  *plus* a shortcut row on Shopping.

Repo rules that constrain every plan: `DESIGN_RULES.md` (25 invariants, 3 CI-enforced),
`AGENTS.md` (row anatomy, three composer tiers, one-card-design), `VOICE.md` (copy tone).
All UI text goes through `useT()` with both `en` and `no` entries. Verify with
`npx tsc --noEmit`, then `scripts/test-changed.sh`, then `npm run preview` /
`npm run wraps -- --lang=no --width=360` where visual.

---

## Plan 0 — Catalogue list as a file (do this first, no code change)

**Deliverable:** a CSV of the catalogue handed to the maintainer in chat for review.

`lib/catalogSeed.ts` exports `CATALOG_SEED: SeedItem[]` = **286 rows** of
`{ name, category, price }` (Norwegian names, NOK prices, categories keyed to
`lib/shoppingCategories.ts`).

1. Write a throwaway script that imports `CATALOG_SEED` (or parses the file) and emits
   `name,category,price` sorted by category then name, plus a per-category count summary.
2. Send it with `SendUserFile`.

No app change. Corrections come back as edits to `lib/catalogSeed.ts` — **and that requires
bumping `CATALOG_SEED_VERSION` (`store/useCatalogStore.ts:100`)**, or the re-seed/price
re-sync never runs on existing installs.

**Status: DONE.** `unfocus-catalogue.csv` generated and sent (286 rows, no duplicate name-keys,
no zero prices, min/median/max 8.90 / 34.90 / 169.90 NOK). Generating it surfaced a real data
bug — see **Plan 9**, which is now a prerequisite for Plan 3c.

---

## Plan 1 — Vertical centering: the optical-alignment pass

**Context.** "Food containers text should be vertically centered. Probably many other
similar instances like this" and "The time pill cuts the lower part of the numbers inside."
Three distinct root causes, all in this family.

### 1a. The phantom gap slot under a collapsed section — the Food container bug

`components/Collapsible.tsx:148-152` always renders an `Animated.View` at `height: 0` when
closed (the `reducedMotion` branch at `:144` returns `null` — so the two motion settings
already disagree). As a flex child it books its parent's `gap`.

`components/FoodTab.tsx:839` — `section: { padding: Spacing.md, gap: Spacing.sm }` with two
children: the header row and the `Collapsible`. Collapsed, that is 16 / header / **8** / 16
— the title sits 8px above the card's centre. Exactly the reported symptom.

**Fix (recommended, global):** in `Collapsible`, return `null` when `!open && !mounted`.
Hooks still run, `measured` is a `useSharedValue` that survives, and the close animation
still renders because `mounted` stays true until the timing callback fires. This makes the
animated and reduced-motion branches agree and removes the phantom slot at **all 26 call
sites** — which is the "many other similar instances" the maintainer expects.

`AGENTS.md` documents this trap ("A closed `Collapsible` still books a gap slot") and two
call sites already work around it by hand — `app/(tabs)/plans.tsx:1215` (the wrapped filter
rows) and `app/(tabs)/habits.tsx:881` (gating on `showHabitProfiles`). **Leave both
workarounds in place**; they are harmless once the slot is gone and removing them widens the
diff for no gain.

**Audit after the change**, since it removes real spacing anywhere a closed Collapsible was
load-bearing: screenshot Home, To-do, Habits, Health, Shopping and /food before and after
(`scripts/screenshot-states.mjs`) and diff.

### 1b. `OpticalCenter` is under-adopted

`constants/theme.ts:551` exports the token; only `PadRow.tsx`, `FoodTab.tsx` and
`CatalogueTab.tsx` import it. Nine files still hand-write the same pair
(`PersonChip:125`, `TabSlider:341`, `FormControls:680,686`, `PlanTaskCard:2032`,
`HomeShoppingCard:562`, `ScreenHeader:531`, `HomeNotesCard:455`, `HomeHabitsCard:539`).

1. Replace each hand-written `includeFontPadding: false, textAlignVertical: 'center'` pair
   with `...OpticalCenter`.
2. Add it where a `Text` sits in a box whose height it does not determine. Confirmed
   offenders, highest value first:
   - `components/Badge.tsx:109` `pillText` — every pill in the app.
   - `components/PlanTaskCard.tsx:1912` `timeBoxText` (the task-row time box).
   - `components/StarterExampleRow.tsx:232` `tagText`.
   - `app/(tabs)/shopping.tsx:2555` `tabBadgeText` (18px box, no padding).
   - `components/FoodTab.tsx` — `deleteDishText:891`, `popupBtnText:900`, `popupTitle:898`,
     `sheetTitle/sheetCancel/sheetSave:907-909`, `draftText:916`, `sectionEmpty:852`.
   - `components/NewMonthlyListRow.tsx:157,165,168` — `addBarLabel`, `ghostBtnText`,
     `primaryBtnText`.
3. Add a guard test in `lib/__tests__/designTokens.test.ts`: no source file may contain a
   literal `includeFontPadding: false` outside `constants/theme.ts`. This is invisible to
   `npm run preview` (web has no such property), so a test is the only thing that holds it.

### 1c. The time pill clipping

`components/StarterExampleRow.tsx:209` — `metaMark: { height: MARK /* 22 */,
justifyContent: 'center' }` on a `Badge` whose own chrome is `paddingVertical: 4` ×2 plus
`borderWidth: 1` ×2 = 10px. That leaves **12px** for a 12px font whose natural line box is
~16px (more on Android with `includeFontPadding`). It is the only `<Badge>` in the repo with
a height override; the other eight let the Badge size itself.

**Fix:** `minHeight: MARK` instead of `height: MARK`, and add `...OpticalCenter` to
`Badge.pillText` (1b). `minHeight` is the house pattern — `Badge.chip:115`,
`PartControls.pill:266`, `CollapsedSection`'s `rowMinHeight`.

Affected renders: `app/(tabs)/plans.tsx:1205` and `components/PlanTaskCard.tsx:1573`
(`meta="17:00–17:20"`), `app/(tabs)/health.tsx:607` (`meta="3/5"`).

⚠️ `lib/__tests__/exampleRows.test.ts` pins styles in this file by source regex — read it
before editing `MARK` or `metaMark`.

### 1d. One genuine layout bug, visible on every platform

`components/FoodTab.tsx:921` — `suggestRow` has **no `alignItems`**, so it defaults to
`stretch` and the `FontSize.sm` name and `FontSize.xs` price top-align instead of sharing a
centre line. Add `alignItems: 'center'`. Call site `:808-825`.

Also unify the two divergent `sectionEmpty` styles (`FoodTab.tsx:852` vs
`shopping.tsx:2629`) — same name, different treatment.

**Ripple:** `Badge` and `Collapsible` are app-wide; this plan deliberately fixes the class,
not the instance.

**Verify:** `npx tsc --noEmit`; `scripts/test-changed.sh`; the new designTokens assertion;
`npm run preview` for 1a/1d (1b/1c are Android-only and need a device or careful reasoning);
before/after screenshot diff for 1a.

---

## Plan 2 — Shopping: "Handlelister", and one card for empty-plus-create

### 2a. Rename the weekly tab

`lib/i18n.ts:2771` `weeklyTabLabel: 'Ukelister'` → **`'Handlelister'`**;
`lib/i18n.ts:677` `'Week lists'` → **`'Shopping lists'`**.

Note the collision to watch: the screen title is already `shoppingTitle` = `'Handleliste'`
(`:2756`). Check the result at 360px in `npm run wraps -- --lang=no` — "Handlelister" is
2 characters longer than "Ukelister" in the app's narrowest tab.

`components/TabSlider.tsx:89,173,235` reference "Ukelister" **in comments only**, as the
canary for a past legibility bug. Update the prose so the next session isn't hunting a
string that no longer exists.

**Ripple:** grep `Ukeliste` across `lib/i18n.ts` — `addToWeekListBtn:2926`,
`allocateItemLabel:2936`, `noWeekListsYet:2937` and `hints.shopping.body:2708` all say
"ukeliste". Decide once whether the *concept* is renamed or only the tab. Recommended:
rename the tab and leave body copy alone (the concept is still a week's list); if the
maintainer wants the concept renamed, it is those four keys plus the EN twins.

### 2b. Merge the empty state and the create trigger

Today, an empty weekly tab draws **two** things stacked:
- `app/(tabs)/shopping.tsx:2330-2341` — a `Surface` holding `EmptyState`
  (`t.weekEmptyTitle` "No lists this week yet" + `t.weekEmptyBody`).
- `app/(tabs)/shopping.tsx:2355-2375` — the `newListTrigger` accent pill "Create a new list",
  which opens a `showAppModal` chooser (Start empty / Saved lists / Cancel).

**Target:** when there are no lists, one card that *is* the first list — creating the first
list reads as editing the card already there. When lists exist, the separate
"Create a new list" trigger returns, unchanged.

**Shape:** reuse `components/NewMonthlyListRow.tsx`'s already-built collapsed→expanded
pattern (trigger row → name `Input` + Cancel/Create). Render it **pre-expanded** in the
empty case, inside the existing `weekEmptyCard` Surface, with the explanatory line above the
field instead of an `EmptyState` block. The "Saved lists" branch of the modal becomes a
secondary link under the field so nothing is lost.

`NewMonthlyListRow` is currently monthly-only by copy, not by logic — its only prop is
`onCreate`. Generalise it: accept `label`, `placeholder`, an optional `defaultExpanded`, and
an optional secondary action. Then **use the same component for both tabs**, which also
closes the documented drift the two files warn about (`shopping.tsx:2356-2358` and
`NewMonthlyListRow.tsx:29-34` each say "keep these identical", and they have already drifted
— `Radius.lg` vs `Radius.md`).

While in there: `NewMonthlyListRow`'s `ghostBtn`/`primaryBtn` (`:159-168`) carry no
`MIN_TAP_TARGET` — `paddingVertical: Spacing.sm` on a `FontSize.md` line is under 48.
Fix per `DESIGN_RULES.md` rule 17.

**Ripple:** three empty-state treatments coexist on this one screen — `sectionEmpty`
(centred, borderless, `:2629`), `weekSectionEmptyText` (left-aligned, `:2730`) and
`EmptyState`-in-a-`Surface`. Pick one and apply it; the 2026-08-13 pass already ruled that an
empty list is "a plain centred line, not a filled bordered box".

**Verify:** `npx tsc --noEmit`; `scripts/test-changed.sh`; `npm run preview` with an empty
DB (the preview's sql.js DB starts empty, so the empty weekly tab is the default view);
`npm run wraps -- --lang=no --width=360`.

---

## Plan 3 — Catalogue: "See more" as a link, lock-gated delete, sort toggle

### 3a. "See more" moves right, beside the chevron

`components/CatalogueTab.tsx:575-589` / style `:726-729`. The row is
`justifyContent: 'space-between'` with the text hard left and the chevron hard right, which
makes it read as a list item. Change to `justifyContent: 'flex-end'` so the label sits
immediately left of the chevron. Keep `minHeight: MIN_TAP_TARGET` and the top border.

Fix the a11y label at the same time — it is currently `t.catalogueTabLabel` ("Catalogue")
rather than the visible `t.andMoreItems(rest)`.

**Ripple:** this row is the "and N more" idiom. Check `components/RecentDaysList.tsx` and
any other drawer preview with the same trailing-chevron row; make them match.

### 3b. Delete only when unlocked

**There is no catalogue lock today** — `grep -i lock` in `CatalogueTab.tsx` returns nothing.
Weekly and monthly lists each have one (`useShoppingListStore.toggleLocked`,
`useMonthlyListStore.toggleLocked`), rendered as an `IconButton`
(`lock-closed` / `lock-open-outline`, size 22) beside the list name —
`app/(tabs)/shopping.tsx:1815-1821` is the model to copy.

1. Add a **local, non-persisted** `locked` state to `CatalogueTab` defaulting to locked. A
   new settings column is not warranted for a per-session safety catch, and it must not sync
   (a peer locking your catalogue is nonsense). If the maintainer wants it to persist, that
   is a new `settings` column + migration — ask first.
2. Render the lock `IconButton` in the tab's header slot (`header?` prop, `:158-173`), same
   glyphs and size as the list locks.
3. Gate the row trash button (`:232-239`) and the edit-row trash (`:453-461`) on `!locked`.
4. While locked, tapping a row still opens the inline edit for name/price — only destruction
   is gated.

⚠️ `handleRemove` (`:402-408`) has **no confirmation dialog** at all today — one tap deletes.
With the lock in place that is defensible; without it, it was not. Do **not** add
`confirmDestructive()` on top of the lock unless asked — two gates on one action is worse
than one good one.

### 3c. "Sort by type" / "Sort by name" toggle in search

**Where the sort actually lives:** `store/useCatalogStore.ts:156-167` sorts by
`localeCompare(name, 'no')` in `load()`, and **every mutation re-applies it**
(`recordPurchases:253`, `addItem:273`, `updateItem:297`, `resetItemPrice:327`).
`CatalogueTab` itself only filters (`:272-276`). So the sort **must be a presentation-layer
`useMemo` in the consumer**, not a change to the store's canonical order.

1. Add a `SegmentedControl` (`components/FormControls.tsx:261` — the form-tier pick-one
   shape; `TabSlider` is screen-tier and this screen already has none to spare) with two
   options from new i18n keys `sortByType` / `sortByName`.
2. Place it directly under the search field, always visible (the maintainer said "always",
   not "while searching").
3. `sortByName` = the store's existing order, i.e. pass through. `sortByType` = group by
   `category` using `categoryPresets` order from `lib/shoppingCategories.ts`, name-sorted
   within each group.

⛔ **Blocked on Plan 9.** 205 of the catalogue's 286 items carry a category value the app does
not recognise, so "Sort by type" would file 72% of the catalogue under "Other" and look
broken. Land Plan 9 first, or this feature ships useless.

**Ripple, and one conflict to respect:** the maintainer said "searching in shop screen",
which is broader than Catalogue. The other two search surfaces are
`components/ShoppingFilterBar.tsx` (used by `WeekListCard`, `AddFromMonthlyModal` and
Shopping's Monthly tab) and `WeekListCard`'s per-list search. Adding the toggle there
collides with two existing systems:

- Shopping rows carry a **user drag order** (`lib/useDragReorder.ts`); a sort must never
  commit a new order, only display one.
- The **"In the store" layout already groups by aisle** (`lib/cardLayout.ts`'s
  `groupByAisle`, pinned by test to that layout alone).

**Recommendation:** ship the toggle on Catalogue in this plan (no drag order, no layout
flag). For the weekly/monthly lists, add it to `ShoppingFilterBar` as a **display-only**
sort that is disabled/hidden when `groupByAisle` is active, and say so at the call site.
Confirm with the maintainer before doing the second half.

**Verify:** `npx tsc --noEmit`; `scripts/test-changed.sh`; a new unit test for the
type-sort comparator (pure function, keep it out of the component);
`npm run preview` — the walk already opens Shopping's Catalogue drawer;
`npm run wraps -- --lang=no --width=327` (that drawer is the app's densest three-stacked-inset
surface and already has documented findings — diff against a baseline, don't read the raw count).

---

## Plan 4 — Kill the header ⓘ; instructions become an inline intro card (all 5 screens)

**Context.** "Having the info button in the header section with settings showing when you
press it makes No sense. Instead the instructions should be in the screen with examples like
a introduction part (users can of course close the card)."

**Scope: all five tab screens** — `app/(tabs)/index.tsx:723`, `plans.tsx:1165`,
`habits.tsx:824`, `health.tsx:484`, `shopping.tsx:1771` all pass
`infoActive` / `onInfoToggle`.

### Steps

1. **Delete the header button.** `components/ScreenHeader.tsx:322-337` (`infoButton`) and its
   entry in `siteControls` (`:409-411`); the `infoActive`/`onInfoToggle` props on
   `components/ScreenScaffold.tsx:231-244` and their forwarding at `:684-689`.
2. **Make the hint an inline, dismissible intro card.** `components/HintCard.tsx` already has
   both halves: a self-managed pill path (`:117-141`) and a parent-controlled `noPill` path
   (`:103-115`). Add a **dismiss** affordance (an "X", the same one `StarterCard` uses —
   `t.starters.dismiss`) and render it open-by-default at the top of the content, above the
   `StarterCard`.
3. **Persist the dismissal per screen.** `lib/useFirstVisitHint.ts` already owns
   `settings.seenScreenHints` — today it is written but never read ("write-only by design").
   Reading it is now the feature: dismissed → stays dismissed. Keep the `useFocusEffect`
   marking, drop the collapse-on-blur (`:69-81`), and return a `dismiss()` alongside the
   boolean. A way back is needed — put "Show tips again" in Settings → General, one row that
   clears `seenScreenHints`.
4. **Shopping keeps its bottom sheet, but only for the settings.** `components/HintSheet.tsx`
   exists because Shopping's hint outgrew a card. Once the two reset controls leave (Plan 5),
   what remains is two paragraphs and fits the inline card like every other screen. **Delete
   `HintSheet.tsx`** if nothing else uses it — grep first.

**Ripple:** `HintCard` has **ten** callers (incl. `app/scan.tsx`). Only the five tab screens
pass `noPill` + a parent-controlled `open`; the other five use the self-managed pill and are
out of scope. Do not change them in this pass.

**Copy:** `DESIGN_RULES.md` §7 rules 22–25 and `lib/__tests__/copyTone.test.ts` apply to any
new string. `VOICE.md` before writing anything first-person.

**Verify:** `npx tsc --noEmit`; `scripts/test-changed.sh`; `npm run preview` (the walk
already visits all five tabs — the card is now on screen by default, so expect every tab
screenshot to change); `npm run wraps -- --lang=no --width=360`.

---

## Plan 5 — Scan becomes per-card and scoped

**Context.** "the camera for scanning should be per card, not in the header row. Shopping
list Scan means match against this shopping list, same logic for Monthly, and in catalogue it
means Add/update."

### 5a. Move the button

Remove `onScanPress` from `app/(tabs)/shopping.tsx:1771` and the `scanButton` from
`components/ScreenHeader.tsx:297-307` + `siteControls` (`:409-411`). Shopping is its only
caller, so the prop goes too (`ScreenScaffold.tsx`).

Add a scan action to each card's own action cluster, per the row-anatomy rule — the ⋯/kebab
each weekly and monthly list already has (`shopping.tsx:1080-1101`) is the right home if a
visible camera glyph crowds the header row; a camera `IconButton` beside the list's lock is
the alternative. Prefer the kebab: it is the established one-row-level-action pattern.

Catalogue gets its own scan entry in `CatalogueTab`'s `header?` slot, beside the new lock.

### 5b. Scope the scan — this is the real work

**Today `/scan` receives no target at all.** `app/scan.tsx:117` reads exactly one param,
`autoCapture?: 'camera' | 'library'`. Weekly adds always land as
`status: 'inWeeklyList'` with **no `listId`**; monthly falls back to the first list unless
`monthlyLists.length >= 2`, in which case it shows a chooser (`:467-493`).

1. Add params: `target: 'weekly' | 'monthly' | 'catalogue'` and `listId?: string`.
2. Push them from the three new entry points.
3. **`weekly` / `monthly` = "match against this list".** Seed the target list from `listId`,
   hide the monthly chooser when a `listId` arrived, and change the review step from
   "add these items" to a **match**: an item already on the target list is shown as matched
   (tick it off / update its price), one that is not is shown as an add. This is a real change
   to the confirm step (`addToList`, `:285` onward), not a param rename.
4. **`catalogue` = "add/update".** Skip the shopping-list write entirely; run only the
   `recordPurchases` / catalog-upsert half, which already exists and already
   **only ever raises a stored price** — confirm with the maintainer whether an explicit
   catalogue scan should be allowed to *lower* a price too, since that is the whole point of
   "update".
5. Header copy and the idle screen's tip (`t.scanHintBanner`) must say which mode is running.

**Ripple:** the "Shopping done!" prompt (`shopping.tsx:915-916`) pushes `/scan` with
`autoCapture` after committing the trip via `doneShopping()`. It knows the list — pass
`target: 'weekly'` + that `listId` so the receipt matches the list you just shopped.

⚠️ `app/scan.web.tsx` is an OCR placeholder and `scripts/preview.mjs` deliberately does not
walk Scan — **this plan cannot be verified in the web preview**. It needs a device, or at
minimum unit tests over the new matching logic extracted as a pure function (the pattern
`lib/receipt.ts` and `slotAtPoint()` already follow).

**Verify:** `npx tsc --noEmit`; new unit tests for the match/scope logic;
`scripts/test-changed.sh`; flag clearly in the PR that OCR paths are device-only.

---

## Plan 6 — Reset settings get a real home

**Context.** Falls out of Plan 4. The weekly-reset weekday and monthly-reset date live
**only** inside Shopping's ⓘ sheet (`shopping.tsx:1637-1691`) — nothing in Settings exposes
them. Maintainer chose **both**: canonical home in Settings, shortcut on Shopping.

1. **Settings → Personal** (`app/settings.tsx`) — add both controls to the shopping-cadence
   area. The weekday row must be a `SegmentedControl`, **not** seven chips: the 2026-08-10
   pass found the identical seven-chip row needed 7 × 48 + 6 × 4 = 360px and wrapped on every
   phone. `settings.tsx`'s weekly-reset-day row was converted for exactly this reason —
   follow it.
2. Carry over the monthly-date field's **placeholder-preview behaviour** verbatim
   (`shopping.tsx:550` + `:1670-1686`): starts empty, shows the current value as placeholder,
   commits on any valid 1–31 keystroke, clears on blur. Leaving it blank keeps the old value.
   This is easy to lose in a move and silently destroys the setting.
3. **Shortcut on Shopping** — one labelled row that pushes to Settings. Not a duplicate
   control; two live copies of one setting is the drift this repo keeps paying for.
4. Both keys stay where they are in `lib/i18n.ts` (`weeklyResetDay:476/2617`,
   `monthlyResetDateQuestion:513/2649`).

**Ripple:** `t.dayLabels` (Mon-first, index **is** `weeklyResetDay`) must be reused — a past
bug came from hardcoding `t.dayFull[i].slice(0,3)`, which breaks in Norwegian.

**Verify:** `npx tsc --noEmit`; `scripts/test-changed.sh`; `npm run preview` (Settings is
walked); `npm run wraps -- --lang=no --width=327` on Settings.

---

## Plan 7 — Example-row copy and placement

### 7a. "Se et eksempel:" → "Eksempler:"

`lib/i18n.ts` — `starters.plans.tapToAdd` (`:1888` EN / `:3798` NO) and
`starters.health.tapToAdd` (`:1913` / `:3815`). NO → `'Eksempler:'`, EN → `'Examples:'`.

**Ripple, and a decision to make:** `starters.habits.tapToAdd` (`:1877`) and
`starters.goals.tapToAdd` (`:1945`) both say `'Tap one to start:'` — a *different* sentence
for the same trigger row, on surfaces whose examples are one-tap-addable chips rather than a
single row. Recommendation: leave those two alone (they say something the new wording does
not) and note the split in `StarterCard`'s header so it reads as a decision.

### 7b. Drop the "Eksempel" chip from the example row

`components/StarterExampleRow.tsx:134-138` renders the `tag`. It is an **optional prop** —
remove `tag={t.starters.exampleLabel}` at its three call sites:
`app/(tabs)/plans.tsx:1204`, `components/PlanTaskCard.tsx:1572`, `app/(tabs)/health.tsx:606`.
`components/GoalsEditor.tsx:171-178` already passes none, deliberately.

Then delete the now-unused `tag` prop, the `tag`/`tagText` styles (`:224-233`) and
`t.starters.exampleLabel` (`:1865` / `:3781`), and update the file header's Edit notes —
they explain at length why the chip replaced an uppercase caption line, which is now history.

⚠️ Confirm nothing in `lib/__tests__/exampleRows.test.ts` pins the tag (a grep found none,
but that test pins this file by source regex).

### 7c. No example container on To-do's "This week" and "All"

`app/(tabs)/plans.tsx:1195` — the screen-level `StarterCard` is mounted **outside** every
`tab === …` block, so it draws on all three tabs. Its only tab reference is a negative one:
`!(tab === 'today' && layoutSpec.timeline)`.

Change the gate to `tab === 'today' && (tasks.length === 0 || planStarterAdded) &&
!layoutSpec.timeline`.

Note the interaction: on Today under the **default** timeline layout the screen-level card is
already suppressed, and the example is drawn instead by `components/PlanTaskCard.tsx:1563-1580`
(gated on `onAddExample`, passed only from `plans.tsx:1422`). So "keep it on Today" is already
satisfied there — the new gate only matters for Today under a non-timeline layout.

**Conflict:** 7b and 7c both edit `app/(tabs)/plans.tsx` around lines 1195-1213. Do them in
one pass.

**Verify:** `npx tsc --noEmit`; `scripts/test-changed.sh` (`lib/__tests__/exampleRows.test.ts`
will run); `npm run preview` — the To-do tab with an empty DB shows the card, so switching
tabs is the check.

---

## Plan 8 — Goals: two names, and the missing drawer on Today

### 8a. Rename per screen

**Both drawers currently share one key**, `t.goals.editLink` (`lib/i18n.ts:1352` EN /
`:2995` NO, currently `'Goals'` / `'Mål'`), used at exactly two call sites:
`app/(tabs)/habits.tsx:1087` and `app/(tabs)/plans.tsx:1565`.

1. Add two keys in both language blocks — e.g. `goals.editLinkPersonal` and
   `goals.editLinkPractical`. Proposed NO: **`'Personlige mål'`** / **`'Praktiske mål'`**.
2. Point Habits at the personal one, To-do at the practical one.
3. Keep or retire `goals.editLink` depending on whether anything else reads it (grep found
   nothing else) — and update the doc block at `:1342-1351`, which explains the current bare
   noun and will otherwise contradict the new names.

**Ripple:** `goals.title` (`:1341`/`:2994`) is a separate key for the Goals *sheet/screen*
title. `app/goals.tsx` was deleted 2026-08-12, so check whether `goals.title` still has a
consumer; if not, it goes with this change. Also check `components/SendToSheet.tsx`, which
offers Goals as a send-to target — it should read whichever name matches where the note
actually lands (`lib/prefill.ts`'s `goals` slot lands on the **Habits** tab, i.e. the
*personal* drawer — worth a comment, it is counterintuitive).

### 8b. The drawer missing on Today — reproduce, then fix

Static reading says it should already render: `plans.tsx:1560-1569` sits **after** all three
`{tab === … && (` blocks, at the same depth, inside `<View style={styles.content}>`
(`:1170`–`:1581`), gated only on `featureGoals`. The maintainer confirms it is genuinely not
there on Today.

Hypotheses to test, in order:

1. **Unreachable, not unmounted.** Today's default layout mounts `PlanTaskCard`'s day grid
   with an explicit height (`PlanTaskCard.tsx:1688`:
   `height: expanded ? dayScale.totalHeight : Math.min(totalHeight, COLLAPSED_GRID_HEIGHT)`).
   `ScreenScaffold`'s viewport is `overflow: 'hidden'` with a `viewportBleed` negative margin
   (2026-08-10 chrome pass) — if the scroll content's height is mis-measured against that
   clip, everything below the grid becomes unscrollable rather than absent. **Check this
   first**; it would also explain why it "works" on All and This week, which have no
   fixed-height child.
2. **A focus layout is suppressing it.** `lib/cardLayout.ts`'s "One thing at a time" and
   "Now and next" hide the Whenever section; confirm they do not also gate the block the
   Goals drawer sits in.
3. **Plan 1a interacts.** If a closed `Collapsible` above it is booking phantom height, the
   drawer moves further down. Run Plan 1 first and re-check before doing any work here.

**Verify:** `npm run preview --route=/(tabs)/plans`, scroll to the bottom of Today with and
without tasks; screenshot. If it turns out to be hypothesis 1, the fix is in
`ScreenScaffold`/`PlanTaskCard` height measurement, not in `plans.tsx`, and it will need
`lib/__tests__/chromeRhythm.test.ts` attention.

---

## Plan 9 — One category vocabulary (found while doing Plan 0; not in the original brief)

**Context.** The app has **two competing shopping-category vocabularies**, and the larger
half of the data is filed under the one nothing reads.

| | values | used by |
|---|---|---|
| **A — the real one** | `produce, dairy, meatFish, bakery, pantry, frozen, household, other` (`lib/shoppingCategories.ts:19-28`) | `categoryLabel()`, `categoryPresets()`, `lib/i18n.ts:783/2864` `categoryLabels`, the category chip picker, `ShoppingFilterBar`, **`WeekListCard:591` — the "In the store" aisle headers** |
| **B — the orphan** | `produce, dairy, meat, fish, bread, frozen, canned, dry, snacks, drinks, cleaning, personal` | `lib/catalogSeed.ts` (all 286 rows) and `app/scan.tsx:110` `CATEGORIES` |

Only `produce`, `dairy` and `frozen` exist in both. **205 of 286 seeded items (72%) carry a
value vocabulary A has never heard of**, and `categoryLabel()` ends
`?? t.categoryLabels.other` — so every one of them renders as "Annet"/"Other".

Counts by seed value: `dry` 52 ✗ · `dairy` 36 ✓ · `produce` 34 ✓ · `personal` 24 ✗ ·
`drinks` 22 ✗ · `cleaning` 22 ✗ · `meat` 21 ✗ · `bread` 20 ✗ · `snacks` 18 ✗ ·
`canned` 16 ✗ · `frozen` 11 ✓ · `fish` 10 ✗.

### Three consequences, all live today

1. **"In the store" mode is degraded** — `WeekListCard:591` draws aisle headers from
   `categoryLabel`, so a shop-order list of seeded items is one giant "Annet" aisle. That is
   the whole point of that layout.
2. **The category filter silently under-matches** — `ShoppingFilterBar` offers vocabulary A's
   8 values and compares them against stored vocabulary-B strings, so filtering by a category
   can never return a seeded item.
3. **`app/scan.tsx:741-755` renders the raw key as the label** — `{cat}` with no `useT()`.
   The picker shows lowercase English (`meatFish`, `cleaning`, `personal`) in a
   Norwegian-first app. That breaks the "all UI text through `useT()`" invariant outright.

### Steps

1. **Decide the target vocabulary with the maintainer before writing anything.** Two options,
   and they are not equivalent:
   - **Collapse B into A** (8 values). Smallest change, keeps every existing label and the
     i18n block. Costs granularity — `drinks` and `snacks` both land in `pantry`, `cleaning`
     and `personal` both in `household`.
   - **Grow A to match B** (~13 values). Better aisle fidelity, which is what a store-order
     list actually wants. Costs a new `categoryLabels` entry per value **in both languages**,
     and every existing row stored under an A value needs a migration.

   The CSV's `suggested_app_category` column encodes the collapse-into-A mapping, so it is the
   cheaper path and the one to price first.
2. Rewrite `lib/catalogSeed.ts`'s `category` values to the chosen set — and **bump
   `CATALOG_SEED_VERSION`** (`store/useCatalogStore.ts:100`), or `seedCatalog()`'s
   `INSERT OR IGNORE` + `UPDATE … WHERE price_source = 'seed'` never re-runs and existing
   installs keep the wrong values forever.
3. **Migrate rows already in `store_items`** with an append-only `UPDATE` in `lib/db.ts`'s
   migrations array, mapping old value → new. Seeded rows are re-synced by step 2; rows the
   user created via scan are not, and they are the ones a migration is for.
4. Delete `app/scan.tsx:110`'s `CATEGORIES` and use `categoryPresets(t)` — this fixes the raw
   English labels in the same edit. It is the only remaining reader of vocabulary B.
5. Correct `lib/catalogSeed.ts`'s header, which currently states vocabulary B as authoritative
   ("must match the shopping category keys (produce, dairy, meat, fish, …)") — that line is
   what made the drift look intentional.
6. Add a test asserting every `CATALOG_SEED` row's `category` is in `CATEGORY_VALUES`. This
   could not have drifted for this long with one; `lib/catalogSeed.ts` and
   `lib/shoppingCategories.ts` are both dependency-free, so the test is trivial.

**Ripple:** the shopping-list domain touches `useCatalogStore.recordPurchases` (scan writes),
`enrichItemsWithCategories` in `app/scan.tsx`, and `lib/cardLayout.ts`'s `groupByAisle`.

**Verify:** `npx tsc --noEmit`; the new seed-vocabulary test; `scripts/test-changed.sh`;
`npm run preview` with a seeded catalogue, checking Shopping's Catalogue drawer and a weekly
list under the "In the store" layout — the aisle headers are the visible proof.

---

## Execution order and conflicts

| Order | Plan | Why here |
|---|---|---|
| 1 | **0** — catalogue CSV | No code. Unblocks the maintainer's review immediately. |
| 2 | **1** — vertical centering | Touches `Collapsible`/`Badge` app-wide. Landing it first means every later plan's screenshots are taken against corrected spacing, and it is a prerequisite for diagnosing 8b. |
| 3 | **7** — example copy/placement | Small, self-contained. Shares `StarterExampleRow` with 1c — do 1 first, then 7. |
| 4 | **8** — Goals | 8b depends on 1a being in. |
| 5 | **2** — Handlelister + merged empty card | Shopping structural work starts here. |
| 6 | **4** + **6** — hint card + reset settings | 6 falls out of 4; do them together or 4 leaves the reset settings homeless. |
| 7 | **9** — one category vocabulary | Needs a maintainer decision first (collapse vs grow). Hard prerequisite for 3c, and it fixes an unrelated live bug in "In the store" mode. |
| 8 | **3** — catalogue link/lock/sort | Independent of 4/6 but shares `CatalogueTab`'s header slot with 5a, and 3c is blocked on 9. |
| 9 | **5** — scan per-card + scoped | Largest, needs a device, and depends on 3's header slot, 4's header cleanup and 9's vocabulary (it edits the same `CATEGORIES` list). |

**File conflicts to watch:**
- `components/ScreenHeader.tsx` + `ScreenScaffold.tsx` — Plans 4 and 5 both delete a header
  button. Land 4 first.
- `app/(tabs)/plans.tsx` ~1195-1213 — Plans 7b and 7c. One pass.
- `components/StarterExampleRow.tsx` — Plans 1c and 7b. One pass, or 1 then 7.
- `components/CatalogueTab.tsx` header slot — Plans 3b (lock) and 5a (scan). Coordinate.
- `app/(tabs)/shopping.tsx` — Plans 2, 3, 4, 5, 6 all touch it. It is 2746 lines; expect
  rebases and keep each plan's diff tight.

**Every plan ends the same way** (`CLAUDE.md` standing rule): commit to
`claude/ui-refinements-naming-jpcc3x`, open a PR into `main`, **merge it**. A branch push
publishes nothing — OTA fires only on push to `main`.
