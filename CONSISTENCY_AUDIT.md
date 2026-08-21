# UI consistency audit — 2026-08-21

**Scope:** the 16 recurring visual defects reported by the maintainer on 2026-08-21.
**Method:** three parallel source audits across `app/`, `components/`, `lib/`, `constants/`,
plus the 115 test files and the 41 markdown docs. Every claim below carries a `file:line`.
**Result: all 16 confirmed.** Nothing on the list was a misreading of the shipped app.

> **This file is the record.** It exists so the next session reads the evidence instead of
> re-deriving it — which is how several of these defects came back after a pass that had
> already fixed them. Every section says where its fix landed.
>
> **Second pass, same day.** The three maintainer decisions the first pass was blocked on were
> answered, and everything deferred has been done or explicitly declined — see the Disposition
> table at the foot, which is the fastest way in. Three findings were DECLINED rather than
> deferred, and each says so in its own section: a declined item that reads as an open one is
> the shape the next session "fixes" back to the thing that was wrong.
>
> ⚠️ **What none of this can tell you.** Every guard here is a source scan, because nothing in
> this repo renders (see the closing section). They can prove a file uses the right component
> and never that the result looks right. The second pass verified what it could in
> `npm run preview` and `npm run wraps` — both clean — but `app/scan.tsx` is invisible to both
> (the web bundle resolves `scan.web.tsx`, an OCR placeholder), so its three changes are
> structural and unseen. Final sign-off is still a device.

---

## The part that matters: why these keep coming back

The defect list is the symptom. Three mechanical causes explain the recurrence, and none of
them is a matter of taste or of anyone being careless.

### Cause 1 — every guard is a hand-maintained list, so new code is compliant by default

This repo has **115 test files**, ~40 of them source scans written specifically to stop visual
drift. They work. But almost every one of them opens with a hard-coded list of files to check.

`lib/__tests__/screenRhythm.test.ts` is the clearest case. It asserts `gap: SCREEN_GAP` over
**6 named screens** (`:31-44`) and padding rules over **10 named screens** (`:110-124`).
`app/catalogue.tsx`, `app/scan.web.tsx`, `app/design-lab/index.tsx` and `app/design-lab/tokens.tsx`
appear in **none** of those lists. `app/catalogue.tsx` is doubly padded at 32px — exactly the
defect the test exists to prevent — and the test is green.

The two design-lab screens are invisible for a second reason: `styleBody()` (`:71-84`) only
matches a style literally named `content`. Both call theirs `page`.

So the tests pin **what was fixed last time**, not the rule. A new file arrives outside every
list, and passes.

> The file already contains the fix. `screenRhythm.test.ts:231-250` has a working `walk()`
> tree-crawler — used for exactly one assertion, about a deleted component. Nothing else in the
> file uses it.

### Cause 2 — the rulebook governs tokens, not components

`DESIGN_RULES.md` has 25 numbered rules. They cover spacing values, contrast ratios, tap-target
sizes, motion durations, copy tone. They are genuinely good, and 15 of them are CI-enforced.

**Eight of the sixteen complaints have no rule at all.** Nothing in the rulebook says which
component draws a card header, which draws a text field, which draws a collapse control, how a
card decides its own granularity, or where a repeated icon sits. So each new surface hand-rolls
one — correctly by its own lights, and differently from its neighbour.

This is why the app has one `FIELD_RADIUS` and nine field shapes. The token was never the
problem.

### Cause 3 — 41 markdown docs, several stale by their own admission

`DESIGN_RULES.md:27-30` says it out loud: *"Several of the older `*_LIBRARY.md` files have
drifted the same way… trust `constants/` over any prose, including this file."* A session that
reads `docs/archive/SPACING_LAYOUT_LIBRARY.md` and a session that reads `DESIGN_RULES.md` get different
answers. Eight rules are additionally marked "open conflict — not binding", so even the current
rulebook is partly advisory.

---

## Findings

### 1. Text-boxes must all look the same

**Reported:** *"All text-boxes must look the same, only differ in color. Options that appear are card-specific."*

**What ships:** at least **9 distinct radius/fill/border combinations and 4 different font sizes**
across text-entry surfaces.

The shared helpers exist and are good: `getRecessedField` (`constants/theme.ts:1121`),
`FIELD_RADIUS` (`:1133`, commented *"the one number, for every field in the app"*), `getFieldGlow`
(`:1164`), `BORDER_WIDTH.field` (`:718`). **Exactly three files import them** — `PadTypeRow.tsx`,
`FormControls.tsx`, `AddRow.tsx`.

Even those three disagree with each other:

| Site | font | glow attached to |
|---|---|---|
| `PadTypeRow.tsx:572-587` | `FontSize.md` (17) | wrapper View |
| `AddRow.tsx:521-535` | **`FontSize.sm` (15)** | the input |
| `FormControls.tsx:839-846` | `FontSize.md` (17) | the input |

Two composers on the same card render their text at 15px and 17px.

Sixteen further sites hand-roll a field from scratch. A sample:

- `CatalogueTab.tsx:625-634` — fills with `theme.surfaceInset`, a token **no other field uses**,
  and draws no glow. Its own comment (`:857`) claims it "matches the rest of the app". It imports
  `FormControls`' `Input` at `:167` and uses it 8 lines away at `:536`.
- `NoteRow.tsx:96-148` — **three different field shapes in one card**: a bare line (no fill, no
  border, no radius), a `borderTopWidth: 1` rule, and the row's own title input.
- `shopping.tsx:1801-1813` — an **underline** field (`borderBottomWidth: 1`) for the same job
  `WeekListCard.tsx:486-499` draws as a **box**.
- `TagPickerRow.tsx:117-125` — the app's only **stadium-shaped** text field.
- `scan.tsx:595-604` and `:869-878` — **the same style constant renders differently at its two
  mount sites** (`theme.surfaceMuted` vs `theme.surface` + `borderWidth: 1.5`).
- `budget.tsx:340` — a byte-identical copy of scan's recipe, duplicated rather than shared.

**Why:** no rule says a text field must come from a shared component, and no test looks for a
bare `<TextInput`.

**Fixed in this pass:** `AddRow` font size aligned to its two siblings; `ShoppingFilterBar` given
`recessed` (it is mounted inside cards); `CatalogueTab`'s search field switched to the `Input` it
already imports; dead overridden styles removed from `FormControls`.

**Prevented by:** `lib/__tests__/fieldAnatomy.test.ts` — every `<TextInput` must come from one of
the four sanctioned composers, or sit in an allowlist with a written reason.

**✅ Done in the second pass (2026-08-21).** budget, automations, UpdateSheet, HomeNotesCard's
extra-info row and scan's three real fields are `FormControls`' `Input`, each conversion also
deleting a hand-drawn label `Text`. `scan`'s `sheetInput` — the constant that rendered two ways at
its two mount sites and was copied byte-for-byte into `budget.tsx` — is deleted. Four sites stay
bare and are marked KEEP with reasons in the guard: two row titles, the typable chip, and the two
list renames, which now share `constants/theme.ts`'s `TITLE_FIELD` (the box won over the
underline). The BACKLOG block in `fieldAnatomy.test.ts` is empty.

---

### 2. Collapsed cards must all look the same

**Reported:** *"Now some of them have different text size, some have icon while others not, some have a line and some don't."*

**What ships: 14 distinct collapsed-header variants.** The maintainer's three observations map
one-to-one onto measurable divergences:

**Text size** — five different title treatments: `FontSize.xl` (24) extrabold in `SectionRail.tsx:203`;
`Type.subheading` (17 semibold) in `MedicineTrayCard.tsx:560` and `HealthSurface.tsx:555`;
`FontSize.lg` (20) in `TodoSurface.tsx:1101` and `FoodTab.tsx:842`; `FontSize.md` (17) in
`HabitsSurface.tsx:1025` and `ExpandableCard.tsx:184`; and a **hardcoded `fontSize: 20,
lineHeight: 25`** repeated verbatim in `HomeSharedCard.tsx:140`, `HomeHabitsCard.tsx:593`,
`HomeHealthCard.tsx:88` and `PlanTaskCard.tsx:2063`.

**Icon** — `SectionRail` draws a 24px `CardAccentBadge`; `MedicineTrayCard.tsx:256` and
`HealthSurface.tsx:481` draw a **32px** one; `ExpandableCard.tsx:129` draws a **4px vertical
stripe** instead; `FoodTab.tsx:451` draws a **private 32px circle** that is not `CardAccentBadge`
at all; `TodoSurface`, `HabitsSurface` and `shopping.tsx:1788` draw **nothing**.

**The line** — `SectionRail.tsx:161` draws a hue hairline under the header. It is the **only one
of the fourteen that does**, apart from `ExpandableCard.tsx:126`, which draws its rule on **top**
of the card instead.

Chevrons compound it: sizes **13, 14, 16, 18**, plus `WeekListCard.tsx:533` using a plated
`IconButton size={30}` where every other card uses a bare glyph. `CardCollapseToggle` — the shared
component for exactly this — is bypassed by **nine** call sites.

**Why:** `SectionCard`/`SectionRail` is the canonical header, but it is only reachable by cards
that are `SectionCard`s. Every other collapsible builds its own, and nothing says it may not.

**Fixed in this pass:** the five hardcoded `20/25` titles moved onto `Type.heading`, whose values
are identical (20 × 1.25) — a substitution with no visual change, and a test pins that the token
still holds those numbers so it cannot quietly become one.

**Prevented by:** `lib/__tests__/cardAnatomy.test.ts` — a card header uses `SectionRail`; its
title comes from a token; its fold control is `CardCollapseToggle`.

**✅ Done in the second pass (2026-08-21), and the diagnosis moved.** The component was not the
problem: `AnimatedChevron` had a REQUIRED `size` and a REQUIRED `color`, so thirteen call sites each
answered the question alone. Both default now to `CardCollapseToggle`'s values and every override is
gone. The seven files listed as owing a conversion keep their chevrons — each is a whole-row
pressable, which is the correct idiom for a header with nothing else to tap; the two idioms and the
rule for choosing between them are written down in `CardCollapseToggle`'s header. `WeekListCard` was
the one real conversion. Separately, the heading LADDER is now three rungs (group 24 / card 20 /
in-card section 17) and To-do's Week and Today headers are `SectionRail`s rather than 20px rows
beside three 24px siblings.

---

### 3. All cards start closed, except Today / Notes / Shopping on the middle screen

**Reported:** *"All card start in closed state, except 'Today' 'Notes' and 'Shopping' in middle screen."*

**What ships: the default is open, deliberately.** `lib/collapsedCards.ts:97-98` — *"Absent →
open, which is what makes `{}` mean 'everything as it was'"* — and `:49-51`, *"a bad entry can
only ever leave a card OPEN. Failing toward visible is the point."* The column default is `{}`
(`lib/db.ts:1282`).

Worse than a wrong default: there are **five independent collapse mechanisms with three different
defaults.**

| Mechanism | Storage | Default |
|---|---|---|
| `collapsedCards` (7 ids) | persisted | **open** |
| `padState` (Home cards) | persisted | **`'preview'`** — `lib/padState.ts:47`, explicitly *"not closed"* |
| `CollapsedSection` | local | **closed** |
| local `useState` sets (weekdays, weekly lists) | local | closed |
| `ExpandableCard` | local | `defaultOpen` prop |

So "start closed" is not one setting to flip. Note also that `plansToday` — one of the three cards
named as an exception — **is not mounted in the default layout at all**: `lib/db.ts:1009` seeds
`card_layouts = '{"plans":"timeline"}'`, so To-do's Today renders `PlanTaskCard`, and the
`plansToday` id is only reachable in three non-default layouts.

**✅ Done in the second pass (2026-08-21).** Maintainer: *"We're not live yet, so just force."*
`lib/cardDefaults.ts` names the three exceptions once, as ids, and both `collapsedCards` and
`padState` read their own slice — neither carries a default of its own any more. Both bags store
only what the user has moved OFF a card's resting state, which makes an explicit `false` meaningful
for the first time, and a `lib/db.ts` migration empties both columns rather than writing the new
values, so `cardDefaults` stays the only place a resting state is decided. "Shopping" resolves to
the Shop tab's **Shopping lists** group, which gained a fold in the same pass.

---

### 4. The middle screen is the main one, always

**Reported:** *"Middle screen is to be the Main one where app always starts when opening it fresh."*

**What ships:** the middle tab is `plans` (To-do) — `app/(tabs)/_layout.tsx:508-510` renders
`shopping → plans → index`. But the app opens on **`index`, the right-hand tab**:
`store/useSettingsStore.ts:593` defaults `startScreen` to `'home'`, and
`lib/firstRunOptions.ts:147-151` maps `'home' → 'index'`.

Two further problems:

- **It is user-configurable** (`START_SCREEN_CHOICES`, `firstRunOptions.ts:134`), which
  contradicts "always".
- **The picker is hidden at first run.** `app/onboarding/basics.tsx:144-146` renders only the
  language row on a fresh install. So a setting the user has never seen governs where their app
  opens.
- `unstable_settings.initialRouteName` is hard-pinned to `'index'` (`_layout.tsx:331`) while the
  navigator's `initialRouteName` is dynamic — so back-navigation lands on Home even for a user
  who picked something else.

**Fixed in this pass:** the app now always opens on the centre (To-do) tab. `START_TAB_ROUTE`
(`lib/siteNav.ts`) is the single answer for both the navigator's `initialRouteName` and the
deep-link back target, which were separately-written values that disagreed. The picker is removed
from Settings and from onboarding; `START_SCREEN_CHOICES`/`_ROUTES`/`_PATHS` are deleted; the tour
hands off to the same tab when it ends. `start_screen` survives as an inert column — this repo
never drops columns — and a test asserts no surface reads it, because wiring a new control to it
would typecheck perfectly and quietly re-create a picker the user is never shown.
Two guards replace the old "every choice names a real tab" check: the target must be the **middle**
`<TopTabs.Screen>` declaration, derived from the navigator itself, so re-ordering the tabs without
re-deciding the start screen fails rather than ships.

---

### 5. Explanations and tips only in cards, only when empty

**Reported:** *"Explenations/tips only appear in cards, and only when they're empty."*

**Mostly already true, and that is worth saying.** `components/HintCard.tsx` is genuinely deleted,
and five of the six surviving `hints.*` keys are correctly mounted as a `StarterCard` `text` prop,
gated on emptiness.

**Four real violations:**

1. **`app/scan.tsx:647-661`** — a permanent tip banner: a `Surface` with an accent bar, an
   information glyph and `t.scanHintBanner`, rendered unconditionally. Its own comment (`:650`)
   admits it is *"an info banner in the same family as components/HintCard.tsx"* — i.e. the
   deleted tier, re-implemented locally after the deletion.
2. **`app/scan.tsx:852`** — `t.manualEntryHint` as a bare `Text` with **no card at all**. The
   style comment (`:923`) states this plainly: *"No card, no edge, no glyph."*
3. **`app/scan.tsx:571`** — `t.qrScanInstructions`, likewise a bare `Text` outside any card.
4. **`components/SavedListsSection.tsx:76`** — `subtitle={t.savedListsSectionHint}` =
   *"Drag into a week below, or tap to choose one"*. The component returns `null` when empty
   (`:63`), so **this tip appears only when the surface is NOT empty** — exactly inverted.

Also worth knowing: `components/HabitsSurface.tsx:736` uses a permanent explanatory sentence
(*"Simple check-ins — no streaks, no scores"*) **as the card's header row**, so it shows whether
the list is empty or full.

**✅ Done in the second pass (2026-08-21).** scan's banner keeps its sentence and loses the accent
bar and the info glyph — the two ingredients that made it the deleted `HintCard` tier — and needs no
emptiness gate, because that screen IS the empty state of scanning. Manual entry's instruction moved
inside the card holding the field it describes. The QR viewfinder's line is KEPT and documented as an
exception: there are no cards on a live camera feed. `SavedListsSection`'s subtitle is deleted, key
and all — re-gating it on emptiness would have been worse, since it explains a gesture on ROWS and
would then have appeared exactly when there were none.

---

### 6. Same spacing between header and first card on every screen

**Reported:** *"Same spacing between header and first card in each screen."*

**What ships: two app-wide baselines, and one screen that matches neither.**

`ScreenScaffold` produces a **0px** resting gap by construction (`:490`, `:534`, `:540`, `:796`) —
content begins exactly at the header card's bottom edge. `CenterModalScreen` produces **16px**
(`:200`, `padding: Spacing.md`). Twelve routes moved to the pane shell on 2026-08-20, and
`screenRhythm.test.ts:169-181` **enforces the split** rather than reconciling it.

Then the outliers:

- **Home is the only scaffold screen that is not flush.** `app/(tabs)/index.tsx:370` —
  `energyStrip: { marginTop: Spacing.xs }` = 4px. And it is conditional on `energySystemEnabled`
  (`:294`), so the same screen is 4px or 0px depending on a setting.
- **`app/catalogue.tsx` is doubly padded**: `CatalogueTab.root` adds `Spacing.md` inside the
  pane's own `Spacing.md` → **32px**. `screenRhythm.test.ts` contains a contradiction here — line
  `:178` forbids padding on a pane's content while `:199` *requires* `CatalogueTab.root` to add it.
- **`app/settings.tsx:1966`** carries `groupHeader: { marginTop: Spacing.sm }` neutralised by
  **eight hand-written inline `marginTop: 0`** overrides. A ninth group that forgets the override
  silently gains 8px.

**Fixed in this pass:** Home's 4px removed. `CatalogueTab.root` drops its `paddingHorizontal` —
**both** of its non-embedded hosts already inset by the same amount, so the 32px was never
wanted; the `screenRhythm` assertion that *required* it (written the day before /catalogue became
a pane) is inverted to ban it. The residual bottom double at the foot of the /catalogue pane —
16 from the pane plus 16 from `root`, which the expanded-card host genuinely needs — is left,
rather than giving one screen a bespoke prop. Settings' dead `groupHeader` margin and its eight
inline overrides are gone; **the new first-child guard found that one**, not the audit.

**Prevented by:** `screenRhythm.test.ts` now (a) walks `app/` and fails on any scaffold or pane
caller no list classifies — closing the hole structurally instead of by remembering — and (b)
checks the first child of each content stack for a top margin, the exact blind spot Home's 4px
lived in. Both landed in this pass, and (b) immediately found Settings' dead `groupHeader`
margin, which the audit had only flagged as *latent*.

---

### 7. Content centered inside buttons

**Reported:** *"Elements within for example buttons (like text or icons) must be centered in the middle, except for the box/circle itself which is located where it is meant to be."*

This one is described precisely, and the code matches the description exactly.

**`components/CardCollapseToggle.tsx:82-87`:**
```
btn: { minWidth: MIN_TAP_TARGET, minHeight: MIN_TAP_TARGET,
       alignItems: 'flex-end', justifyContent: 'center' }
```
The 48px box is right where it should be; the chevron is jammed against its right edge.
`components/CollapsedSection.tsx:291-296` is a byte-identical copy — the original this was
generalised from, so the defect is duplicated rather than shared.

**Five Texts sit in a height-pinned box without `OpticalCenter`**, the repo's own fix
(`constants/theme.ts:550-564`) for Android's asymmetric font padding — so the glyph rides high:

| Site | Box |
|---|---|
| `Stepper.tsx:143` | 28px circle, `−` / `+` |
| `AddFAB.tsx:182` | the FAB — the app's most prominent circular button |
| `HealthSurface.tsx:570` | 28px severity chip |
| `MonthlyResetReviewSheet.tsx:269` | 28px stepper |
| `DatePickerCalendar.tsx:237` | 34px circle — **every date cell in the app** |

`Badge.tsx:105` and `PersonChip.tsx:132` *do* spread it, for exactly this reason. The treatment is
inconsistent, not absent.

**Two hand-fudged offsets:** `ShoppingChip.tsx:151` `tick: { marginRight: -2 }` — a negative margin
faking optical position inside a row that already has a `gap` — and `:154`
`qtyWrap: { justifyContent: 'flex-start' }`, the only inner container on that chip opting out of
centering.

**Fixed in this pass:** all of the above — **plus nine more the new guard found**, once
`OpticalCenter` became *required* rather than merely the hand-written pair being banned. Among
them all three hand-rolled `Stepper` copies, and on one of those the fix was on the `−` and not
on the `+`. And a **third** copy of the off-centre chevron, in `StarterCard`'s corner ✕
(`:534`) — a 48px box correctly pinned to the card's corner with the glyph shoved into it,
which is the reported shape exactly.

**Prevented by:** extending `designTokens.test.ts`. It already bans hand-written
`includeFontPadding` (`:280-285`); the guard becomes two-directional by *requiring* `OpticalCenter`
where a Text sits in a fixed-height box, and by banning `alignItems: 'flex-end'` on a
`MIN_TAP_TARGET` box. That one-directional guard is precisely why these five survived: nobody
wrote the banned string, they just omitted the token.

---

### 8. Recurring buttons in the same place per card

**Reported:** *"Recurring/common buttons or elements like expand button or full screen button must be placed in the same place per card."*

**The rule already exists and is stated in five files** — caller's controls → fold chevron → ⤢
last. `SectionCard.tsx:230-236` writes it out at length.

**And `SectionCard` itself does the opposite.** `:241-245`:
```
right={<><CardCollapseToggle … />{right}</>}
```
The chevron is rendered **before** the caller's controls, not after. With a two-control `right`
(the Catalogue card's camera + lock), the chevron lands to their left.

Four further call sites break it:

- **To-do "Today"** (`TodoSurface.tsx:803-812`) — its ⤢ sits in a bare row **on the screen
  backdrop, above the card's Surface**. It is in the corner of nothing. This is the exact defect
  the Week card's own comment (`:889-893`) records as having been fixed for Week.
- **Shopping → Food** (`shopping.tsx:1701`) — ⤢ with no chevron.
- **Monthly list cards** (`shopping.tsx:1788`) — lock on the **left**, no chevron, no ⤢.
- **Weekly list cards** (`WeekListCard.tsx:533`) — the fold chevron is a plated `IconButton` sitting
  in the **⤢ slot** (right-most). Different component, different look, and the outermost position
  means the opposite thing here from every other card.

Compounding it: the chevron is an unplated glyph and the ⤢ is a glass key cap, so where they do sit
adjacent (`TodoSurface.tsx:908-911`) they read as two different classes of control.

`PadFooterToggle.tsx:21-28` documents its own half of this: the Home cards' fold control is at the
card's **bottom**-right, described in the file as *"mirroring the full-screen button's corner"* —
on the opposite edge.

**✅ Done.** `SectionCard`'s order was in fact already correct (fold, then the caller's slot); what
remained were the individual cards. `WeekListCard`'s plated-`IconButton` fold left the ⤢ slot,
Shopping's Food and Catalogue gained folds, and To-do's Today header — the ⤢ *"in the corner of
nothing"* — is drawn inside whichever card the active layout renders.

**Prevented by:** `cardAnatomy.test.ts` asserting ⤢ is last in the right cluster.

---

### 9. Text and buttons never outside a card

**Reported:** *"Text and buttons must never be outside a card."*

Confirmed, and the offenders are the same sites as 5 and 8: `scan.tsx`'s three bare instruction
Texts (§5), To-do Today's floating ⤢ (§8), and Shopping's week-section headers
(`shopping.tsx:2190-2195`) — a bare `Text` label + date range on the backdrop, a **third** header
idiom on that screen.

Tracked with §5 and §8 rather than separately.

---

### 10. All cards must collapse and expand

**Reported:** *"All cards must be able to collapse and expand."*

**About twelve cards have no collapse control:** all three Home cards (`HomeHabitsCard`,
`HomeNotesCard`, `HomeHealthCard` — none imports `CardCollapseToggle`), both Shopping Food and
Catalogue cards, every Monthly list card, the Unallocated card, the four weekly week-sections,
`SharedTasksSection`, `SharedRequestsSection`.

**Two findings inside that are worse than a missing control:**

- **Health's "This week" fold is dead when embedded.** `HealthSurface.tsx:474-476` — the
  `embedded` branch renders the body with no chevron and no `Collapsible`. `weekCollapsed` is
  computed at `:223` and referenced only in the non-embedded branch. So a user who folds that card
  on the Health screen finds the setting **silently ignored on Home**.
- **`shopLists` is a declared-but-unreachable stub.** `expandableCards.ts:40` declares the id;
  `CardExpandHost.tsx:181` maps it to `ComingSoonBody`. `expandableCards.test.ts:67` passes because
  it only checks the two lists match each other — never that a button exists.

Also: `PadFooterToggle.tsx:29` renders nothing when `total === 0`, so an **empty** Home card has no
size control at all.

**✅ Done in the second pass (2026-08-21).** Five new ids — the two Shop groups, the two library
cards, and `homeHealth`, which was the one Me card with neither a fold nor a pad state. The
per-list cards inside a group deliberately get none: that is `collapsedCards`' singleton rule, and
folding the group puts all of them away at once. Health's dead embedded fold is fixed — both
branches share one header now, and only the `Surface` differs.
  **`shopLists`' EXPAND id is DELETED rather than given a surface**, on the rule `homeTodo` and
`homeShopping` already went by. It is declined, not deferred — see the Disposition note. The guard
that let it hide is fixed too: `expandableCards.test.ts` only ever checked the two lists agreed with
EACH OTHER, and now also fails on a placeholder body and on an id with no `useCardExpand` caller.

---

### 11. Each thing is its own card — Medicine and Health

**Reported:** *"Each thing is its own card, like medicine and Health (which they currently are not)."*

**Confirmed: `MedicineTrayCard` is a full `Surface` rendered inside `HomeHealthCard`'s `Surface`.**

`MedicineTrayCard.tsx:246` is `<Surface style={styles.card}>` — a self-contained card with its own
badge, title, reminder bell and fold chevron. `HealthSurface.tsx:511` mounts it **unconditionally
with respect to `embedded`**. `HomeHealthCard.tsx:59` is itself a `Surface`, and `:75` mounts
`<HealthSurface embedded />`.

`HealthSurface.tsx:29-33` claims `embedded` *"drops the outer card's own Surface"*. It drops **one
of four** — only the week card. Medicine, the Health Issues drawer and `OpenEpisodeCard` all keep
theirs.

This is a card-in-a-card, which the 2026-08-18 blueprint pass banned outright and which
`SectionCard.tsx:123-125` quotes as *"the thing the blueprint pass banned"*. `TodoSurface`'s Week
card shows the correct pattern (`SectionCard embedded` → `Shell = embedded ? View : Surface`);
Health does not follow it.

**✅ Done in the second pass (2026-08-21).** Maintainer: *"Yes."* `MedicineTrayCard.tsx` became
`MedicineSurface.tsx` (content only, no `embedded` prop — both callers are panes) with
`HomeMedicineCard.tsx` as the shell, the split `HabitsSurface`/`TodoSurface` already use. The
reminder bell had to be shared rather than duplicated, since the header is drawn in two places —
hence `MedicineReminderBell.tsx`. The half that actually reaches anybody is the append in
`sanitizeHomeCardOrder`: every stored order in existence predates the kind.

---

### 12. Look-alike icons in the same place

**Reported:** *"Similar icons and/or buttons that look alike but are not the same should be placed the same place to keep visual flow."*

**The worst case is the lock, and it is worse than a position problem.**

| Site | Position | `active` means |
|---|---|---|
| `CatalogueTab.tsx:321-327` | card header **right** | `active={!locked}` — lit when **un**locked |
| `shopping.tsx:1793-1799` | card header **left**, beside the name | `active={locked}` — lit when locked |
| `WeekListCard.tsx:478-484` | card header **left**, beside the name | `active={list.locked}` — lit when locked |

Three locks on one screen, in two different positions, and **the highlight means the opposite thing
on one of them**. Whatever the intended semantics, one of these is a bug.

Other look-alike pairs: the **camera** appears in a card header right cluster (`CatalogueTab.tsx:315`)
and as a screen-header slot (`ScreenHeader.tsx:315`) that `ScreenHeader.tsx:43` notes **no screen
passes any more** — a dead code path. The **kebab** is second-to-last on Home cards (18px, bare
pressable), **last** on Monthly cards, and third-of-four on Weekly cards (30px, plated
`IconButton`). The **layout icon** sits at header position 5 on To-do and Shop and is **absent on
Home**, whose three cards are all list-bearing surfaces with layout sets defined.

**Fixed in this pass:** the lock's inverted `active` semantics — all three now mean "locked".

**✅ Partly done in the second pass (2026-08-21).** The kebab and `HomeNotesCard`'s mic — two
hand-rolled 28px circles in header clusters beside 36px controls — are on `IconSize.action`.
**The lock's SIDE is unchanged and is the one thing here still open**: `CatalogueTab` draws it in
the header right, `shopping.tsx` and `WeekListCard` beside the name on the left. Its SEMANTICS were
fixed in the first pass (all three light when locked), which is the half that was actually
misleading; the position is a layout question about three different card shapes, not a defect
anyone can misread.

---

### 13. Sub-headers to show what is what

**Reported:** *"Use of sub-headers to show user what is what, and to seperate different things. Like Shopping list is its own thing, dishes and Catalogue is inventory, Monthly list is the basis for shopping list."*

**The Shop tab has three different header idioms and no grouping for half its content.**

Render order (`app/(tabs)/shopping.tsx`):

| Group | Header |
|---|---|
| Monthly lists (`:1757`) | a bare `SectionRail` — "Monthly list" |
| Weekly lists (`:2082`) | a bare `SectionRail` — "Shopping lists" |
| …its week sections (`:2190`) | **a plain `Text` row** — a third idiom |
| Dishes + Catalogue (`:1698-1734`) | **none at all** |

Against the three relations the maintainer named:

- **"Shopping list is its own thing"** — it is labelled, but the group is called "Shopping lists"
  while the **screen itself** is titled "Shopping list" (`i18n.ts:706` vs `:721`). Near-identical
  names at two different levels.
- **"Dishes and Catalogue are inventory"** — no such grouping exists. They render as two unlabelled
  peer cards at the foot of the screen.
- **"Monthly list is the basis for the shopping list"** — nothing expresses this. Monthly is a
  sibling group, not a parent, and the file admits the ordering is accidental (`:1750-1755`):
  *"that's leftover source order from when this was extracted, not a deliberate call… Swapping the
  order is a follow-up."* The only real link, `AddFromMonthlyModal`, is reachable from inside a
  weekly card and never surfaced in the page structure.

**✅ Done in the second pass (2026-08-21).** The maintainer answered with an order and neither
grouping: *"Shopping lists, food and Catalogue, Monthly."* So the render order is now Shopping lists
→ Food → Catalogue → Monthly, there is deliberately no "Inventory" header, and nothing presents
Monthly as a parent of the shopping list. The three groups are consts composed in one line of the
return, which is what made reordering ~700 lines of drag/merge JSX possible at all.
  The third header idiom went with it: the four week sections were a bare `<Text>` pair, and
`SectionRail` gained a `tier` (`'group'` 24 over a stack of cards, `'sub'` 17 over a stack of rows)
rather than the call site gaining a component.

---

### 14. Some buttons are too small — the lock and the camera

**Reported:** *"Some buttons are too small, like the lock and camera."*

**Confirmed, and the comparison the eye is making is on-screen.**
`CatalogueTab.tsx:319` and `:326` are both `IconButton size={22}`. They sit in the Catalogue card's
header **immediately beside `CardExpandButton`, which uses `IconButton`'s default 36**
(`CardExpandButton.tsx:31` passes no size). So the lock and camera render at **61% of the diameter
and 61% of the glyph size of the ⤢ eight pixels to their right.**

The touch target is fine — `IconButton.tsx:99` floors the hit area at `MIN_TAP_TARGET` regardless
of `size`. It is purely visual, which is why no test caught it.

**Six different icon-button diameters ship:** 16 (`GoalPicker.tsx:142` — an 8px glyph), 18, 22, 26,
30, 36. `WeekListCard`'s header draws **three of them in one row** (22 / 18 / 30).

Below-48 visual controls outside `IconButton`: `CardMenuSheet.tsx:270` kebab at 28,
`HomeNotesCard.tsx:464` mic at 28, and `PadFooterToggle.tsx:101` — **no `minHeight` and no
`hitSlop`**, so ≈28px tall with nothing compensating. That is the collapse control on all four Home
cards, and it is the one genuine tap-target violation here.

Note `hitSlopFor()` (`constants/theme.ts:338`) exists to size exactly these and has **zero call
sites**.

**Fixed in this pass:** camera and lock raised to 36 to match the ⤢ beside them; the two other
22px locks likewise.

**✅ Done in the second pass (2026-08-21).** `IconSize` is three values for three jobs — `action`
(a card-header or toolbar control, and `IconButton`'s default), `compact` (one of several in a dense
cluster), `inline` (inside a row or beside a field). Every call site is on it, and
`designTokens.test.ts` fails on a numeric literal, on a fourth rung, and on the default drifting.
`PadFooterToggle` has a `MIN_TAP_TARGET` floor and a `HitSlop` — it had neither, which made it the
one genuine tap-target violation on the list. The original note follows:

**(Original)** collapsing six diameters down to a small set, and giving `PadFooterToggle` a real
target.

---

### 15. Dishes colour is weak and pale

**Reported:** *"Dishes color coding is weak/pale."*

**Two separate causes, and the first is bigger than the complaint.**

**Dishes has no identity hue.** `constants/colors.ts:645-649` (light) and `:853-857` (dark):
```
cardMeal:   IDENTITY_HUES.shopping.hue,
cardShop:   IDENTITY_HUES.shopping.hue,
cardBudget: IDENTITY_HUES.shopping.hue,
cardScan:   IDENTITY_HUES.shopping.hue,
```
Four domains aliased onto one emerald, in both modes. `lib/domainColor.ts:36-38` states the
consequence outright: *"several domains deliberately share a value… which is why the badge GLYPH
became load-bearing."*

**Every card on the Shop tab is emerald** — Dishes, Catalogue, the Monthly rail, the Weekly rail,
every `WeekListCard`. Colour carries **zero** navigational information on that screen.

**An orange for food exists and Dishes is the one place it is never used.** `constants/colors.ts:836`
defines `featMeal: '#FF7A1A'` with the comment *"Part of the shopping world, but its own screen, so
it can't just take Shopping's green"*. Only `app/food.tsx:39` ever passes it. The justification at
`:822-825` — that Food has no Home card, so sharing Shopping's rung *"costs nothing that is ever on
screen together"* — **was true when written and is false now**: Dishes and Catalogue became sibling
cards on the same scroll on 2026-08-20.

**Where meal colour does appear, it is genuinely pale.** `FoodTab.tsx:186-192` holds a private
5-colour set that is not `IDENTITY_HUES`, not `feat*`, not `card*`. Its dark values — `#D49B70`,
`#79B2AE`, `#C8917F`, `#B27AE2`, `#8E88DF` — are desaturated pastels against a palette whose
identity hues run C\* 43-93. And they are diluted further at the only place they are drawn as a
plate: `FoodTab.tsx:451` renders it at **`rgba(color, 0.16)`** — 16% alpha on an already-pale hue,
with the glyph and title both in `theme.text`. That 16% wash is the whole of what reaches the eye.

**Fixed in this pass:** the Dishes card now wears the orange `featMeal` it already owns, so it stops
being the fifth emerald card on an all-emerald screen.

**✅ Done in the second pass (2026-08-21), and neither turned out to be a taste call.** The 16%
plate was the shape `CardAccent`'s own header records as DECLINED in 2026-08-10 — a hue fill at a
fixed opacity under a neutral glyph — so FoodTab mounts `CardAccentBadge` now and has no private
badge left. The values sit on a lightness ladder because saturating them alone was MEASURED and made
the set worse: at full chroma the amber and the red collapsed under deuteranopia to a worst pair of
ΔE2000 **4.0**. The shipped rung order maximises the worst dichromat pair across both deficiencies
in both modes — **16.8** — and the test now parses the real values out of `FoodTab.tsx` instead of
the stale hand-typed copy it had been measuring.

---

### 16. Colour coding must be visual navigation

**Reported:** *"Color coding must be based on visual navigation (to link/seperate objects, to show what is important and not and so on to lessen cognitive load)."*

This is the principle behind 15, and the audit supports it. The palette work is genuinely strong —
`IDENTITY_HUES` sits on a lightness ladder verified against deuteranopia and protanopia simulation
(`lib/__tests__/colors.test.ts`), which is more rigour than most apps ever apply.

**The failure is not in the palette; it is in the wiring.** Five well-separated hues exist, and the
Shop tab uses one of them for everything on it. The card edge stopped carrying hue in the 2026-08-05
reset, and the pane wash was deleted on 2026-08-20, so the badge is the only channel left — and on
Shop all five badges resolve to the same green.

Worth stating for whoever picks up the deferred work: the constraint is real. `constants/colors.ts:286`
records that **a sixth identity hue does not fit** — the usable band is ~30 L\* wide, bounded below
by the AA floor and above by sRGB having no saturated amber left, and five rungs ~7.6 apart is its
capacity. So "give Dishes its own hue" has to mean reusing `featMeal` (which is what this pass
does), not minting a sixth rung.

---

## Disposition

| # | Complaint | First pass (2026-08-21) | Second pass (2026-08-21) |
|---|---|---|---|
| 1 | Text-boxes alike | 4 sites + guard | ✅ done — backlog empty, 4 documented KEEPs |
| 2 | Collapsed cards alike | titles onto a token + guard | ✅ done — one glyph, one heading ladder |
| 3 | Cards start closed | — | ✅ done — forced, exceptions in one module |
| 4 | Middle screen is main | ✅ done | — |
| 5 | Tips in cards, when empty | — | ✅ done — scan re-homed, inverted tip deleted |
| 6 | Header→card spacing | ✅ done + guard | — |
| 7 | Content centered | ✅ done (14 sites) + guard | — |
| 8 | Expand button placement | guard | ✅ done — Today's ⤢ is in a card now |
| 9 | Nothing outside a card | — | ✅ done — with #5 and #8 |
| 10 | All cards collapse/expand | — | ✅ done — `shopLists` expand id declined, not stubbed |
| 11 | Medicine its own card | — | ✅ done — a fourth Me-tab card |
| 12 | Look-alike icons | lock semantics fixed | ✅ done — kebab and mic onto `IconSize` |
| 13 | Sub-headers | — | ✅ done — order settled, one rail at two tiers |
| 14 | Lock/camera too small | ✅ done | ✅ done — 6 diameters → 3; `PadFooterToggle` |
| 15 | Dishes pale | card hue fixed | ✅ done — ladder + the shared badge |
| 16 | Colour = navigation | via #15 | — |

**All sixteen are addressed.** The three decisions that blocked the largest items were answered
by the maintainer on 2026-08-21 — force the new collapse defaults ("we're not live yet"), yes to
Medicine as a fourth Me card, and "Shopping lists, food and Catalogue, Monthly" for the Shop tab's
order (which is also a NO to an "Inventory" header and to Monthly moving above the lists).

Three findings were **declined rather than deferred**, and each says so where it lives, because a
declined item that reads as an open one gets "fixed" by the next session:

- **The `shopLists` EXPAND id is deleted**, not given a surface. Shopping's lists are the Shop
  tab's primary content, so a full-screen copy of them is a second rendering of the screen you are
  already on. What the group needed was a way to be put AWAY, which it now has.
- **Seven of the "hand-rolled fold chevron" files keep their chevrons.** Each wraps its whole
  naming row in a pressable, which is the right shape for a header with nothing else to tap and
  gives a much bigger target than a 48px box. What diverged was the glyph's size and colour, and
  that is fixed at the source.
- **Four hand-rolled fields stay bare** — two row titles, a chip you can type in, and the two list
  renames. Each would be made worse by being boxed like a form field; the renames share a recipe
  instead so they cannot diverge again.

---

## What the guards can and cannot do

The new checks are source scans, because **no test in this repo renders anything** —
`@testing-library/react-native` is not a dependency, and `components/` and `app/` are excluded from
coverage entirely (`jest.config.js`).

So a guard can prove a file *uses the right component*. It can never prove the result *looks right*.
That ceiling is worth knowing before trusting a green CI run: it will stop a fourteenth header
variant from being born, and it will not tell anyone whether the thirteen that exist look good.

Final visual sign-off is still a device.
