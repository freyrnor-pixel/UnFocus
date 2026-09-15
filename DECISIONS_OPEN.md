# Open decisions — things waiting on the maintainer

**What this file is for.** A question only the maintainer can answer, parked where they will
actually see it, instead of in a paragraph of `AGENTS.md`.

**Why it exists.** On 2026-08-29 the report was *"visual condensing of cards seems like it has
not landed."* It had partly landed. What had not landed was the part that needed a ruling — the
mockup's ~12px rhythm against the app's deliberate 4/8/16/24/32/48 spacing scale — and that
ruling was never requested. It was written down instead, in `AGENTS.md`, as:

> ⚠️ **NOT done in that pass**: `SCREEN_GAP` (16) and `Card`'s padding. The mockup's numbers
> translate to ~12 at this width, which is not a rung on the deliberate … scale … That is a
> design-system decision (add a rung, or don't), **not a defect.**

That note is correct and it was invisible. The maintainer re-reported the symptom two days
later, a session was spent proving the code was on `main` and the OTA had published, and the
answer was in a doc nobody had reason to re-read. **A decision recorded in prose is a decision
that will be re-derived, not made.**

## The rules

1. **Deferring work is fine. Deferring it silently is not.** If a pass stops because it needs a
   ruling, the ruling goes here in the same PR that stops.
2. **State the options with their measured costs**, not "we should decide about spacing". The
   maintainer should be able to answer from this file alone.
3. **Name what it blocks**, so the cost of not answering is visible.
4. **Delete the row when it is answered**, and put the answer where the code lives.
5. A row here is **not** a TODO, a nice-to-have, or a bug. Those go in the code or a PR. This is
   only for *"an agent cannot legitimately choose this."*

---

## Open

### The swipe "hump": patch ViewPager2's own touch slop, or accept the feel?

**Asked 2026-09-09**, after the third failed attempt at the same report.

The report has been the same three times: *"Rythmic lag when Swiping between Screens. Never
varies, always the same lag"*, then *"the lag just feels like it's caught on a hump"*, and after
the 1.7.1 build, *"Same lag when Swiping."*

**Three diagnoses, three no-changes.** Each was reasonable, each shipped, none moved it:

| PR | Diagnosis | Result |
|---|---|---|
| #682 | Home's cards re-rendering each other; Android over-drawing | no change (and its `removeClippedSubviews` half caused a separate bug, reverted in #684) |
| #686 | the background parallax's per-frame JS↔native round trip | no change — correctly deleted anyway, it bought 14px of drift for two bridge crossings a frame |
| #687 | `NestedScrollableHost`'s capture threshold (`.5f` → `1f` → `1.4f`) | no change, **and it broke vertical scrolling on Home** — reverted to `1f` in this PR |

**What #687 established, which is the useful part.** `NestedScrollableHost` disallows intercept
on `ACTION_DOWN`, but ViewPager2's inner `RecyclerView` has already seen that DOWN and recorded
its own initial touch point. When the host later releases the gesture, RecyclerView begins
intercepting from *its* ~8dp slop, measured from that same DOWN. So the finger travels
`max(hostSlop, 8dp)` before the page moves no matter what factor the patch writes — which is
exactly why lowering it from `1f` to `1.4f` changed nothing, and why `.5f → 1f` in July probably
changed nothing either. **The dead zone at the start of a swipe is RecyclerView's slop, and the
patch cannot reach it from where it is written.**

**The decision.** The only lever left in JS-reachable territory is a native patch that reduces
that inner RecyclerView's touch slop directly — the standard `ViewPager2` reflection
(`recyclerView` field `mTouchSlop`, halved). That is:

- **a native change**, so it reaches nobody without a new build (no OTA);
- **unverifiable in this repo** — no harness here can see a frame of a swipe (`HARNESS.md`);
- **on the same knob that just broke vertical scrolling**. Halving the pager's slop makes the
  pager win more of the ambiguous diagonal drags, which is the mechanism behind *"unable to
  scroll vertically in home"*, arrived at from the other end.

So the options are (a) ship the reflection patch in the next build and test both swiping AND
vertical scrolling on device, accepting one more round trip if it repeats the 1.7.1 regression;
(b) leave the swipe as it is — it is AOSP's default pager feel, which is what every other
ViewPager2 app has; (c) something else entirely, if the "hump" is not the start-of-swipe dead
zone at all — a fresh, specific description (does the page move under the finger immediately and
then stutter, or does it not move at all until it jumps?) would redirect this.

**Blocks:** nothing shipping. It blocks a fourth guess, which is what the three rows above say
is not worth making — see `CLAUDE.md`'s A3 rule.

---

### ANSWERED 2026-09-15 — option (c). It was not the touch slop.

The fresh description this entry asked for arrived: *"a slight **tug** when swiping between
screens. Same tug every time at the same time."* That is the first branch of the question above —
the page moves under the finger and then catches — so the start-of-swipe dead zone is **not** what
was being reported, and (a) is not the next move.

What it was: `components/ScreenBackground.tsx`'s screen-hue crossfade. Every tab has a distinct
hue, so it fires on every swipe; it writes the new hue into an `OrbLayer`'s `color` **prop**, and
that prop mints the `<RadialGradient>` `<Defs>` of a full-screen `<Svg>` — invalidating the canvas
and, because the layer is `renderToHardwareTextureAndroid`, forcing an offscreen texture
re-raster. `activeRoute` changes only at the swipe boundary (by design —
`app/(tabs)/_layout.tsx`), so all of that landed on one deterministic frame: the first frame of
the settle. Hence "the same tug, every time, at the same time".

Confirmed on device *before* the fix, which is what makes this an answer rather than a fourth
guess: with **"Reduce visual effects" ON** — the switch that unmounts the whole orb block — the
tug is gone.

Fixed by deferring the buffer write and the tween to `InteractionManager.runAfterInteractions`,
so the work lands after the settle rather than on it.

**What stays open:** nothing here. The three earlier diagnoses were each aimed at *per-frame* cost
(over-draw, the parallax bridge, the capture threshold) and this was a *one-frame burst*, which is
why none of them moved it and why the patch's own note is right that lowering the slop could never
have. Option (b) — accept AOSP's dead zone before motion starts — remains the standing answer for
the thing this entry was originally about, and it has not been re-reported.

### The Budget card's Uke/Måned period

**Asked 2026-09-07**, while building v3's Budsjett card (shipped the same day, monthly-only).

v3 says *"Beløp per uke eller måned, brukeren velger. Lønningsdag setter nullstillingen."* The
card ships with everything else that line asks for — the amount, the payday, and the two per-day
figures side by side in the same unit — but **not the period toggle**, because the period is
monthly all the way down the data model, not a display option:

- `settings.monthlyResetDate` is a day-OF-MONTH payday (1–28), which has no weekly equivalent;
- each Monthly list carries one `budgetNok` measured against that cycle;
- `lib/budget.ts`'s `computeSpendPace` derives its period length from payday-to-payday.

**Measured cost.** A weekly option is a new stored field plus a `lib/db.ts` migration, a second
reset boundary in the automatic payday reset, and a `computeSpendPace` that takes a period rather
than assuming a month. It is not a segment.

**Why it is not half-built.** A Uke/Måned segment that redrew the same monthly numbers under a
"Uke" label would be a control that lies — and this repo bans stub surfaces outright
(`lib/cardRegistry.ts`'s `'none'` note, and the deleted `ComingSoonBody`).

| | |
|---|---|
| **A** | Leave it monthly. The card is honest and complete for a monthly household budget. |
| **B** | Build the weekly period properly: new field, migration, both reset boundaries. |

**Blocks:** nothing — the card ships useful either way.


### v3 mockup: is this a visual pass, or an information-architecture change?

**Asked 2026-09-06.** The brief was *"update visual to match v3 here, with v2 Energy"*, with
`UnFocus_Screens_v3.html` and `Corrected_Screens_v2_1.html` attached.

The **card system** in v3 — glass on an accent-washed backdrop, one connected row surface with an
accent rail, a two-control header (chevron then ⤢), peek lines in words instead of a bare `0` —
is essentially what the app already draws. `docs/audit/DESIGN_GAP_2026-09-06.md` reached the same
conclusion against round 19/20 and listed what was left. Three of its open items are exactly the
places v3 still differs, so that part is unambiguous and is being built:

- **gap 6** — Shop's per-week empty state offers two competing actions; v3 wants one line, one button.
- **gap 7** — Shop's fresh-install empty state has no action button and sits above the card rather than as its body.
- **gap 8** — group rows draw `SectionRail`'s icon-badge + ALL-CAPS + hairline; v3 draws a boxed dot + label + count + chevron.
- plus **v2's Energibudsjett card**, which is a different model from the shipped one and is named explicitly in the brief.

**What needs a ruling is that v3 also moves features between tabs, and removes some.** None of
this is a styling choice, and an agent cannot legitimately choose it:

| tab | shipped today | v3 draws | change implied |
|---|---|---|---|
| Hjem | Notater · I dag · **Handleliste** | Notater · I dag · **Vaner** | swap the shopping preview for a habits preview |
| Handle | Handlelister · **Mat** · Katalog | Handlelister · Katalog *(Varer/Retter tabs)* · **Budsjett** | fold Mat into Katalog as a tab; **build a new Budsjett card** |
| Gjøremål | I dag · **Kalender** · Når som helst · **Gjentakende** | Når som helst · I dag · **Planlegger** | **drop Kalender and Gjentakende**; build a new Planlegger |
| Helse | **Denne uken** · Helseplager · Medisin | Helseplager · Medisin | **drop Denne uken** |

v3 also re-models the shopping list itself: one list with three sections a row moves between on
tap (**I lista → I kurven → Kjøpt**), which is not how `WeekListCard` works today.

**Measured cost.** The additive half (Budsjett, Planlegger, Katalog tabs) is new surfaces and new
registry entries — large, but it breaks nothing. The subtractive half is different in kind:
`todoCalendar`, `todoRecurring`, `healthWeek` and `shopDishes` are **shipped cards with user data
behind them** and `fold: 'persisted'` storage keys. Removing a card does not remove its rows, and
a user who has recurring tasks or a week of health logs would lose the only surface that shows
them.

**Options**

| | what gets built | risk |
|---|---|---|
| **A** | Visual only — gaps 6/7/8 + the v2 Energibudsjett card. Tabs and cards stay as they are. | None to data. Screens will not match v3's card *lists*. |
| **B** | A + the additive half: build Budsjett, Planlegger and Katalog's Varer/Retter tabs, keep every existing card. | Larger, but nothing is removed. Some tabs carry more cards than v3 draws. |
| **C** | Full v3 — B, plus dropping Kalender, Gjentakende, Denne uken and Mat, plus the three-section shopping model. | Removes surfaces that are the only way to reach existing user data. Needs a per-card answer on what happens to that data. |

**Blocks:** everything past the visual pass.

> **ANSWERED 2026-09-06 — option C, full v3.** Maintainer, in the same breath: *"Make sure
> backdrop and glass looks like V2, and it seems that Energy has not been fixed based on the
> screenshots."*
>
> Two corrections that ruling carries, both accepted:
> 1. **The v2 Energibudsjett card was never built.** PR #673 only changed the CTA's `variant`
>    from `primary` to `secondary` (removing its halo). The card itself is still the shipped
>    pip-row + "Set the day's energy" starter, not v2's filled/outline flash budget with its
>    brukt / igjen / gitt tilbake legend and I dag / Uke segment. Calling the energy item
>    "done" after #673 was wrong; it is open and in scope here.
> 2. **The backdrop and the glass are in scope too.** v2 draws three radial accent washes per
>    tab behind the stack, which is what gives the card material something to blur — the mockup's
>    own note is *"Glass had nothing to blur… cards sat on flat near-black, so blur produced
>    uniform grey slabs."* That has to match v2, not just the card shapes.
>
> The subtractive half of C still needs a per-card answer on existing user data before anything
> is deleted; that is now its own row below rather than a reason to hold the rest.
>
> **ANSWERED 2026-09-07 — nothing is deleted; the surfaces are ABSORBED.** Maintainer:
> *"Food/Dishes is a tab with Catalogue now in its own card. Calendar, Recurring and this week
> is part of planning card."*
>
> That dissolves the data question rather than answering it, which is the better outcome: no
> card is removed, so no rows are orphaned and no migration is needed. Each surface moves down
> one level in the same boundary move `shopMonthly` already made on 2026-08-26 — *"turned into a
> SECTION drawn inside `shopLists`… it held no user data of its own to justify [being a card]"*.
>
> | shipped card | becomes |
> |---|---|
> | `shopDishes` (Mat / Food) | the **Retter** tab of `shopCatalogue`, beside **Varer** — v3's *"Katalog = ett kort, to faner"* |
> | `todoCalendar` (Kalender) | a section of the new **Planlegger** card |
> | `todoRecurring` (Gjentakende) | a section of the same Planlegger card |
> | To-do's *this week* | a section of the same Planlegger card |
>
> ⚠️ **Each of these keys is a STORAGE KEY** (`fold: 'persisted'` → `settings.collapsedCards`),
> so retiring one re-opens that surface for anyone who had folded it — `lib/cardRegistry.ts`'s
> own edit note, and the reason the four To-do keys were renamed with a `lib/db.ts` migration in
> 2026-08-21. Same treatment applies here.
>
> **Still unanswered:** Helse's *"Denne uken"* (`healthWeek`). v3's Helse draws only Helseplager
> and Medisin, and the ruling above names Calendar, Recurring and "this week" together as
> planning — which reads as To-do's week rather than Health's. `healthWeek` is therefore left
> exactly as it is until asked about; it is the one card in the subtractive list with no stated
> destination, and guessing one would put a week of health logs behind a surface nobody chose.

---

---

### The orphaned "Glass surfaces" setting: retire the field, or give it a new job?

**Asked 2026-09-15**, when #706 removed the card's lit/shaded edge and left the switch with
nothing visible to change. `components/Surface.tsx` cites this entry; it did not exist until now,
which is itself the kind of dangling reference `#699` cleaned up.

The row is already gone from Settings — the maintainer's call, and the right one: a toggle that
changes nothing a user can see is the defect `__tests__/glassMaterial.test.ts` exists to catch,
and `components/AddFAB.tsx` records the last time this same setting went quietly inert app-wide.

What is NOT decided is the field. `settings.glassSurfaces` still exists, still defaults `true`,
still has its DB column, and nothing reads it. Under the never-drop rule (`lib/db.ts`,
`store/useSettingsStore.ts`) the column must stay whatever happens — a retired setting keeps its
column so an old backup stays readable. The open question is only whether the FIELD is:

  (a) left inert and documented as retired — cheapest, and honest as long as the "no dead reads"
      guard stays pointed at it, but it is one more thing a future reader has to be told is dead;
  (b) given a new job — the obvious candidate is the `getGlow()` halos, which currently survive
      BOTH `glassSurfaces` and `reduceEffects` while the Settings copy for the latter claims
      otherwise (`lib/i18n.ts`, "Turns off card shadows…"). That would make the switch real again
      AND fix a live over-promise, at the cost of it meaning something different from its name;
  (c) formally deprecated in the store's type with a `@deprecated` tag, the way `childProfiles`
      already is — no behaviour change, but the next reader is told without having to grep.

**Blocks:** nothing. Every pane is opaque and nothing reads the field, so the app behaves
identically under all three. It blocks only the question of how long a dead field sits there
unlabelled.

---

### ANSWERED 2026-09-15 — (c), the `@deprecated` tag.

Not (a): "left inert and documented" is what it already was, and the documentation lived in this
file rather than at the declaration, which is the wrong place for it — a reader meets the field
in `store/useSettingsStore.ts`, not here.

Not (b): giving it the `getGlow()` halos would make the switch real again, but it would mean
bringing the ROW back with a different meaning than its name, days after the maintainer retired
it. The halos surviving `reduceEffects` while its copy claims otherwise is a real bug and is
still open — it is just not this field's job to fix, and pinning it here would have hidden it.

So (c): `glassSurfaces` and `opaqueCards` both carry `@deprecated INERT since 2026-09-15` at the
declaration, the way `childProfiles` already did, with the three-pass history of how they were
retired and the never-drop rule spelled out. The columns stay. Nothing reads them, and
`glassMaterial.test.ts` fails if anything starts.

#### SUPERSEDED for `glassSurfaces` the same day — it is (b) after all, with its own name back

The frosted-glass brief landed hours later and made the pane a RAMP with a specular rim
(`constants/theme.ts`'s `getGlassPane`), so the switch has something visible to change again —
it paints the pane flat. That is (b), "given a new job", except that the job is the one the
switch already had: **reduce transparency**, restated in terms of the material the app actually
draws. The objection recorded above against (b) was specifically that the `getGlow()` candidate
would have meant *"bringing the ROW back with a different meaning than its name"*; this does not,
which is the whole reason it clears a bar that one did not.

So: the row is back in Settings, the field reads again, and `glassMaterial.test.ts`'s guard is
inverted rather than deleted — it now extracts the four-term `paneOn` predicate and evaluates its
truth table, because a boolean that has gone constant is this file's own recurring defect and a
source-text scan cannot see one.

⚠️ **`opaqueCards` stays retired, inert and `@deprecated`.** It was the card-only half of
`glassSurfaces`, and two overlapping switches over the same property is what made the 2026-08-15
pair confusing enough to need retiring in the first place. The answer above still stands for it.

⚠️ **The `getGlow()` over-promise is still open and still nobody's job.** The halos survive both
switches while `reduceEffects`' copy claims otherwise (`lib/i18n.ts`, "Turns off card shadows…").
Recorded here so reviving `glassSurfaces` does not look like it was fixed.

## Answered

### Does Home's energy card stay a capacity budget, or become a daily Lav/Middels/Høy level?
**Asked:** 2026-09-06 · **Answered:** 2026-09-06 · **Blocked:** the maintainer's Home-screen
device sign-off, and any further "make Home match the round-20 mockup" work.

The maintainer sent a Home screenshot saying it doesn't look like the design they sent.
Enumerated against `DESIGN_COMPARISON/20-corrected-screens.html`'s Home entry (its `fixes:`
array, line ~124), almost everything already matches or was deliberately superseded — except
this one, which is also the most visually prominent thing on the screen.

The mockup's own words: *"**Energy** was a lone glowing pill floating outside any card — now a
slim card with three chips, glow only on the chosen one."*

What actually ships (`components/EnergyMeter.tsx:695-748`): on a fresh install, a `StarterCard`
with a decorative row of 10 empty pips and one large primary button, "Sett dagens energi", which
opens `EnergyConfigSheet`. Once configured it becomes a `current / capacity` pip strip.

**These are two different mental models, not two renderings of one.** The shipped feature is a
numeric energy *budget* you spend against (`store/useEnergyStore.ts`, `lib/energy.ts`, ~10
maintainer revisions 2026-07-20 → 2026-08-17). The mockup draws a daily energy *level*
check-in. No Lav/Middels/Høy control exists anywhere in the repo, at any commit.

Measured record search: `PROGRESS_LOG.md`, `20-IMPLEMENTATION.md`, `DESIGN_RULES_AUDIT.md`,
`DECISIONS_OPEN.md` and `docs/archive/AGENTS_HISTORY.md` contain **no** record of this being
shipped, declined or reversed. Notably `20-IMPLEMENTATION.md` — the doc that turned these
mockups into phases 0-6 and itemises every other fix by name — never mentions Energy at all.
Against that, `DESIGN_RULES_AUDIT.md:340-358` records a *different* Energy-mockup divergence
being explicitly declined in August, so this project does normally write such rejections down.
Read either way, the round-20 silence is ambiguous — hence this row.

| option | cost |
|---|---|
| A. Build the daily Lav/Middels/Høy level picker as drawn | **L.** A new concept alongside the existing budget: new store field, new i18n, new UI, and a ruling on how it interacts with `energyDeltaForDay` and the pips. `EnergyMeter.tsx`'s header carries ~2000 words of accumulated rationale that would need rewriting. Risks two competing energy concepts in one app. |
| B. Keep the budget; record the mockup's energy card as superseded | **XS, docs only.** Nothing visual changes. The screenshot keeps looking as it does. Honest if the budget system is the intended design. |
| C. Keep the budget, fix the actual complaint: put the CTA *inside* a slim card instead of a lone glowing pill | **S.** Addresses the mockup's stated problem ("floating outside any card") without adopting its mechanism. Touches `EnergyMeter.tsx`'s empty state only; the budget model is untouched. |

Not a bug and not a cleanup task — A and B produce materially different apps, and C is a third
thing that resembles the mockup without being it. An agent cannot legitimately choose this.

**Answer: C.** The maintainer kept the capacity/budget model and had the CTA moved inside a slim
card. The mockup's Lav/Middels/Høy level picker is **not** being built — the complaint it was
answering was that the button floated outside any card, and that is what gets fixed. Do not
re-propose the level picker; the budget model is the intended design, and `EnergyMeter.tsx`'s
header rationale stands. Implemented 2026-09-06, `unverified` pending a device pass.

### Does the 💡 hint line show on a card with content, or on an empty one?
**Asked:** 2026-09-06 · **Answered:** 2026-09-06 (same turn) · **Blocked:** wiring the hint on
Home's three cards, which had never been wired at all — the unshipped half of round 20 phase 4.

`components/CardHintLine.tsx` shipped with the rule "draws only on a card that HAS content", and
all four call sites gate on a non-empty length (`TodoSurface.tsx:1349,1464`,
`HabitsSurface.tsx:797`, `HealthSurface.tsx:498`). The round-20 mockup agrees — its Home `I dag`
card draws the hint together with three rows.

**Answer: the opposite — the hint shows when the card is EMPTY.** Maintainer's ruling, in their
words: *"Hint er kun når et kort er tomt."* The reasoning is the ADHD-friendly one and is why it
outranks the mockup here: a hint like *"Del det opp til det blir litt latterlig"* is help for
someone staring at an empty list, not decoration over rows they already have.

⚠️ **This deliberately contradicts `DESIGN_COMPARISON/20-corrected-screens.html`.** A later
maintainer ruling outranks a mockup. Applied consistently app-wide — every call site flipped,
not just Home's — because a hint that means "you have nothing here" on one tab and "here is a
tip about your rows" on another is the inconsistency this project keeps paying for. Do not
"correct" it back toward the mockup.

### Do runs of tasks and notes read as one connected list, or as separate cards?
**Asked:** 2026-09-06 · **Answered:** 2026-09-06 · **Blocked:** Phase 1 S1.1–S1.3, and the scope
of every row-convergence session after it.

Measured 2026-09-06 (`docs/audit/ROW_ENUMERATION.md`): 10 row-drawing surfaces exist. 4 use the
shared recipe `lib/rowList.ts`. 6 don't, and they are six DIFFERENT shapes, not six copies of one.

The Plans day view was deliberately changed on 2026-08-28 because four tasks read as four cards.
The To-do tab still draws exactly that: each task is its own card with an 8px gap
(`TodoSurface.tsx:1726`). Notes does the same (`NotesSurface.tsx:172`). So the app currently
answers this question two different ways.

| option | cost |
|---|---|
| A. Converge tasks + notes to connected rows | Matches the 2026-08-28 ruling. Visible change on two main tabs. `TaskCard` and `NoteRow` each lose their own card shell. Multiple sessions. |
| B. Leave them as cards; narrow the invariant to say connected rows is one pattern among several, not a universal target | Nothing changes visually. The invariant stops overclaiming. The 6 stay uncovered permanently, by decision rather than by neglect. |
| C. Converge only `ShoppingRow`, `MonthlyTableRow`, `MedicineSurface` — the three already trying to be rows — and exclude the card-shaped ones explicitly | Middle. Fixes real drift without restyling two main tabs. |

Not a bug and not a cleanup task — the three options produce three different-looking apps.

**Answer: C.** `ShoppingRow`, `MonthlyTableRow`, and `MedicineSurface` are lists of same-kind
items with no per-item identity worth a card shell — closer in spirit to what `PadSheet` /
`HabitsSurface` / `PlanTaskCard` already converged than to a card. `TaskCard` and `NoteRow` are
different: each is a distinct, individually-actionable item on a tab whose 2026-08-28 ruling
(Plans day view) does not by itself extend to Todo/Notes — pulling those into rows would be a
visible redesign of two main tabs that nobody has asked for and that this decision alone
shouldn't authorize. `SettingRow` stays out on its own terms (grouped-list convention, not a
connected list — `ROW_ENUMERATION.md` Part 1 agrees this one arguably *shouldn't* converge).

Follow-through: `MonthlyTableRow` and `MedicineSurface` currently have no box at all (flush rows,
per `ROW_ENUMERATION.md`), so converging them is new surface, not an import — each is its own
session, sized and scoped the way S1.0 was for `ShoppingRow`. `INVARIANTS.md`'s row-recipe entry
should be narrowed to name these three as the target set, with `TaskCard`/`NoteRow`/`SettingRow`
recorded as deliberately out of scope rather than left looking like an oversight.

**Amendment, 2026-09-06.** `ShoppingRow` is removed from this decision's scope. It is already a
connected row list and is therefore governed by `DESIGN_RULES.md` rule 5 regardless of how A/B/C
resolved — bringing it into conformance is not a convergence choice this decision authorises, it
is conformance to a rule that already binds it. That work is session S1.0 and does not depend on
this answer. The decision's live scope is `MonthlyTableRow` and `MedicineSurface` only (sessions
S1.2 and S1.3).

### Should the pixel gate run in CI, and what would we pay for it?
**Asked:** 2026-08-29 · **Answered:** 2026-08-30 · **It was a bug, not a trade.**

The premise was wrong. This was filed as a cost question — pin the toolchain, bless from CI,
raise the tolerance, or containerise the capture — because all 21 baselines came back "changed"
by a uniform 0.1-1.05% on the runner and that looked like an environment difference nobody could
close cheaply.

It was a **dependency range**. `@playwright/test` sat on `^1.61.1`, so the library had drifted
to a version whose launch defaults render text differently from the one that blessed the
baselines, while this environment's pre-installed Chromium stayed at the 1194 build that
Playwright **1.56** pins. CI installed what the library asked for; local used what the machine
had; neither was wrong and they disagreed.

⚠️ **The browser BINARY was not the variable** — `chromium.executablePath()` resolves to the same
`chromium-1194` on either library version, and launching it reports the same `141.0.7390.37`.
Re-blessing was still needed when the library moved. So the thing to pin is the LIBRARY, and the
hardcoded browser path this repo used to carry in seven scripts actively hid the problem by
making the local run look stable while CI diverged.

Fixed by pinning to `~1.56.0` and deleting the revision from the code entirely (every harness now
lets Playwright resolve the browser it pins). `lib/__tests__/visualGate.test.ts` keeps the range
on `~`, keeps a revision out of the scripts, and asserts CI still runs the gate. None of the four
costed options was paid.

### Card density: the mockup's 12px against a 6-rung spacing scale
**Asked:** 2026-08-29 · **Answered:** 2026-08-29 · **Blocked:** round 20 phase 1, and every
"the app feels less dense than the mockup" report since.

The mockup (`DESIGN_COMPARISON/20-MEASUREMENTS.md` §1) wants a 12px card gap and 12px of
breathing room against the app's `SCREEN_GAP` 16 and `CHROME_REST_GAP` 8. 12 is not a rung on
the `Spacing` scale, so taking it means widening the scale.

| option | cost |
|---|---|
| Add a 12 rung and use it | The scale goes 6 rungs → 7. Closest to the mockup. |
| Tighten within the scale (16 → 8) | Scale stays pure; a bigger trim than asked for, likely too tight. |
| Leave it | The gap between mockup and app stays, and gets re-reported. |

**Answer: add the 12 rung** — *"12px, but also focus on where and how things are placed as well.
Just decreasing pure space is not the entire thing."*

So the follow-through is not only the gap: the same measured table has the bottom nav at 72
against the mockup's 54, the header at 67 against 60, and `Radius.md` at 16 against 20 — and
round 19's phase 8 (Manage cards generalised beyond Home) is still unbuilt, which is the
"where things are placed" half.
