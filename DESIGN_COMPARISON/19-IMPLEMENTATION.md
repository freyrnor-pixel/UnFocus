# 19 — Implementation handoff

**Read this before writing any code.** It is the plan for turning
`DESIGN_COMPARISON/19-card-surface-reset.html` into the real app. That prototype is the
approved design; where this doc and the prototype disagree, **the prototype wins** — it is what
the maintainer looked at and said yes to.

Nothing in `app/`, `components/`, `lib/`, `store/` or `constants/` has been touched yet. All of
it is JS/UI, so **it ships over OTA**: no `runtimeVersion` bump, no EAS build.

## Read first, in this order

1. `DESIGN_COMPARISON/19-card-surface-reset.html` — open it in a browser. It is operable:
   five tabs, real folds, full-screen panes, three composer depths, Manage cards, light/dark,
   360/393/430, EN/NO. **`Open every composer`** shows the options every card gives a new row;
   **`Show what's lit`** dims everything that is not a light source.
2. `DESIGN_COMPARISON/19-card-surface-reset.md` — the two decision rounds, including the two
   **reversals of shipped rulings** and what they cost.
3. `AGENTS.md`, the entries "One card shape — the card registry" and "Folding a card away".
4. `DESIGN_RULES.md` §8, plus `DESIGN_RULES_AUDIT.md` for which rules are **not** binding.

## Ground rules that do not bend

- **A caller never describes a card, it names one.** `<Card id="todoToday">`. Everything visual
  is data in `lib/cardRegistry.ts`. Do not add a prop to `Card` or to `SectionCard`.
- **`MIN_TAP_TARGET` is 48.** Header buttons draw at `IconSize.action` (36) and reach 48 through
  `hitSlopFor` — never a literal 48-wide box. See phase 4 for why this is measured, not stylistic.
- **A card is registry-named; a section is drawn one-per-row of user data.** A section gets no
  `Surface`, no persisted fold id and no ⤢ — it rides its parent's. That boundary is what most of
  phase 5 is applying.
- **No guilt copy**, no first person outside `NarratorQuote`, no italics outside it either.
- Every file you touch gets its `Connections:` / Edit-notes header updated **in the same edit**.

---

## Phase 1 — the card surface

*The change that fixes "clouded". Smallest diff, largest effect. Do it first and look at it.*

**`constants/colors.ts`** — dark `surface` `#1E1E1E` → `#2C2C2C` (line ~697).

⚠️ **`surface` and `surfaceGlass` are a derived PAIR and must move together.** `surfaceGlass` is
what gets painted; `surface` is that colour already composited over the backdrop, and is what
every contrast test measures. Dark's ground is pure `#000000`, so the composite is just
`alpha × 255`:

```
#2C2C2C = 44  →  alpha = 44/255 = 0.1725
surfaceGlass: 'rgba(255,255,255,0.1725)'
```

Light is the same idea over a non-black ground — re-derive it rather than guessing, and keep
light's step smaller: dark is the default and the binding case.

**`constants/theme.ts` line 898** — `card: { lit: 0.95, litDark: 0.16, shade: 1, shadeDark: 0 }`.
Drop `shadeDark: 0` so a dark card's edge carries the shade stop on all four sides. That `0` is
the asymmetric top-left-only lip; it is half of why a card had no boundary.

**Tests that will fail, and must be UPDATED rather than deleted:**

- `lib/__tests__/colors.test.ts` — every dark assertion measuring `surface`.
- `__tests__/glassMaterial.test.ts` — the `surface` ⇄ `surfaceGlass` composite assertion. **This
  is the important one.** It exists precisely so the pair cannot drift; if it drifts, every WCAG
  assertion keeps passing while measuring a colour the app no longer draws. Re-derive both sides.

**Two things that get better, not worse** — say so in the commit so nobody "fixes" them back:

- `bg` ⇄ `surface` goes 1.26:1 → 1.50:1.
- White text on `surface` goes 16.7:1 → **14.0:1**, i.e. *further inside* rule 10a's halation
  ceiling. Raising the surface is the first change in months that helps that number.

**The ceiling is `rule` `#3A3A42`.** Push `surface` up to meet it and the row dividers vanish.
That is where the ladder runs out; the prototype's slider stops there for that reason.

---

## Phase 2 — the glow budget

*The other half of "clouded". The rule: **text, borders and backgrounds never glow.***

Lit: the badge glyph · an active check · a filled bar or ring · the primary key · a field **while
focused**. Nothing else.

- **`components/AddRow.tsx:312`** — the COLLAPSED `+` bar wears `getFieldGlow(fill,'soft')`.
  Remove it. This is the single loudest thing in the app: on a five-card screen it was up to nine
  lit wells while the tasks themselves carried none.
- **`components/AddRow.tsx:351`** — `getFieldGlow(fill, focused ? 'strong' : 'soft')` → halo only
  when `focused`.
- **`components/PadTypeRow.tsx`** — same resting halo, same fix.
- **`components/CatalogueTab.tsx:758`** — the search field's resting halo.
- **`components/ScreenBackground.tsx`** — orb alphas down to 12–13%.

⚠️ **Do NOT delete `FIELD_GLOW_CLEARANCE`** (`constants/theme.ts`, 2026-08-24). A *focused* field
still needs the room to fade into, and `npm run halos` is what measures it. Removing the resting
halo does not remove the need for clearance — deleting the constant re-opens the bug that pass
fixed, and `lib/__tests__/chromeRhythm.test.ts` §5 pins the arithmetic.

**New: `lib/__tests__/glowBudget.test.ts`.** A source scan over every `getGlow`/`getFieldGlow`
call site against an explicit allowlist. Without it this creeps straight back — that is the whole
history of this file. Model it on `cardAnatomy.test.ts`'s import ban: assert **where the light may
be built**, not which components currently happen to be right. An allowlist of the already-correct
files is what let thirteen header orders accumulate.

---

## Phase 3 — boxed rows

⚠️ **Reverses the 2026-08-15 flush-rows pass and re-opens `DESIGN_RULES.md` open conflict #8.**
Third answer to that question; all three the maintainer's. Rewrite rule 5 and the conflict entry
rather than leaving them contradicting the code.

- `components/PadSheet.tsx` / `components/PadRow.tsx` — a filled, bordered row at `Radius.sm`.
- The prototype's recipe: one step away from the card in whichever direction has room —
  dark `rgba(255,255,255,.055)` fill + `rgba(255,255,255,.10)` edge; light
  `rgba(27,36,50,.045)` + `rgba(27,36,50,.10)`. A white wash is invisible on a near-white card,
  which is why light recesses and dark lifts.
- ⚠️ **`app/(tabs)/habits.tsx` hand-rolls its own row box and does not move when `PadSheet` does.**
  AGENTS.md flags this explicitly — it shipped boxed rows for a whole build while everything else
  went flush, and it was caught in a screenshot, not by a test. **Grep for both.**
- `lib/__tests__/screenRhythm.test.ts` may assert row gaps.

---

## Phase 4 — the ⤢ returns

⚠️ **Reverses 2026-08-22** ("Remove all full screen buttons, instead user just presses the
title"), on the maintainer's explicit instruction.

**`components/Card.tsx`** — the trailing cluster becomes `{controls}` → ⤢ → fold, **fold still
outermost**.

**Good news: `components/Card.tsx` is already exempt from the import ban**
(`lib/__tests__/cardAnatomy.test.ts:134`), so importing `CardExpandButton` there needs no test
change.

**One test must be rewritten:** `cardAnatomy.test.ts:282`, *"no card header anywhere mounts a
CardExpandButton"*. Narrow it to "exactly one, in `components/Card.tsx`" — keep it as a **ban with
one named exception**, not an allowlist.

**Two that keep passing, and should:**

- The fold-is-last assertion (`:278`) slices from `CardCollapseToggle`, so putting the ⤢ *before*
  the fold leaves it green. Do not move the fold.
- The `labelPressHint` a11y test (`:296`). **Keep the title pressable too.** Two ways in is fine
  and it keeps the accessible name honest.

⚠️ **The measured cost, which the maintainer has seen and accepted:** across five screens × three
widths × two languages, **6 of 30 combinations truncate a card title with the ⤢, 1 of 30 without.**
Nearly all at 360px, and the pattern is exact: *any card carrying its own control* (Catalogue's
lock, Medicine's bell) plus the ⤢ plus the fold. Three buttons is one too many at that width.

So: **`IconSize.action` (36) visual, `hitSlopFor` to 48.** A literal 48-wide box costs another
24px and truncates more. Re-run `npm run wraps -- --lang=no --width=360` after this phase and
expect findings — they are known, not new.

---

## Phase 5 — the registry restructure

**`lib/cardRegistry.ts`.**

| Screen | Cards after |
|---|---|
| Shop | `shopLists` · `shopDishes` · `shopCatalogue` |
| To-do | `todoToday` · `todoWeek` · **`todoMonth`** (new) · `todoWhenever` · `todoRecurring` |
| Home | unchanged |
| Habits | `habitsList` |
| Health | unchanged |

**Stop being cards, become sections inside a parent:** `shopMonthly` (a list inside `shopLists`),
`habitsGoals` (inside `habitsList`), `todoGoals` + `todoEarlierDays` (inside `todoToday`),
`todoWashedAway` (inside `todoWhenever`).

⚠️ **`todoMonth` is a DATE FILTER, not monthly recurrence.** AGENTS.md excludes monthly recurrence
from `normalizeRecurringTasks` because there is no per-occurrence completion row. A month-shaped
*section* has no such problem — it is the question `todoWeek` already asks, one rung out. Do not
wire it to `taskRecurrence`.

**Removing a registry key is safe and tsc-guided.** `CardId` and `ExpandableCardId` are *derived*
(`lib/collapsedCards.ts:83`, `lib/expandableCards.ts`), so every consumer becomes a compile error.

**No migration needed for the stored folds.** `sanitizeCollapsedCards`
(`lib/collapsedCards.ts:138`) drops unknown ids *and* drops values equal to the default, so a bag
holding `todoGoals` simply loses it on the next read.

Also touch: `components/CardExpandHost.tsx`'s `CARD_BODIES` (must stay exhaustive over
`ExpandableCardId` — that is what makes a missing body a tsc error),
`lib/__tests__/expandableCards.test.ts`, `components/TodoSurface.tsx`,
`components/HabitsSurface.tsx`, `app/(tabs)/shopping.tsx`.

---

## Phase 6 — Shop: lists, three states, archive

### The three-state split needs NO migration

**This is the find worth having.** `lib/db.ts:385-387` already documents both columns, added in
one pass:

```
checked   = "moved to cart"
collected = the cart tick
```

So:

| Section | Predicate |
|---|---|
| **In list** | `checked = 0` |
| **In cart** | `checked = 1 AND collected = 0` |
| **Bought** | `checked = 1 AND collected = 1` |

The sectioning is a **rendering of state the app already stores**. Nobody had ever drawn it.

### ⚠️ …but `collected` does not sync, and that is a real bug waiting

`lib/liveSync.ts:84` — `TABLE_COLUMNS.shopping_items` is
`['name','amount','unit','list_type','checked','store','price','created_at','list_id']`.
**`collected` is absent.** A shared shopping trip is exactly the case where two phones must agree
on what is already in the trolley, so this needs a decision:

- **Add `collected` to the whitelist** (recommended), *and* make every write stamp `updated_at`
  and `syncRows`. AGENTS.md's 2026-08-10 lesson is precisely this: an unstamped write to a
  whitelisted column loses the LWW tiebreak and the stale value comes home in the next full-row
  snapshot. A `broadcastRow` without a `touchRow` is **none** of the fix, not most of it.
- Or decide cart state is deliberately device-local, and write that down.

### New list / Archive

`shopping_lists` (`lib/db.ts:415`) already has **`is_template`** and `sort_order`. Check whether
`is_template` already means "a saved list you can start a new one from" before adding anything —
the archive may need one column (`archived_at`) or none.

⚠️ Shopping lists and items **are** an importable AI-setup domain. If you add a column and it is
safe to accept from an untrusted file, add it to `lib/aiSetupGuide.ts` + `lib/aiSetupApply.ts`
**and bump `AI_SETUP_SCHEMA_VERSION` in the same edit.** If it is not importable, just don't add
it to the draft type.

**Placement rules already established, follow them:** `+ New shopping list` and `Archive` go at
the *foot* of the list stack (a trigger belongs where the thing it creates will land, per the
2026-08-06 `FoodTab` fix). Food and Catalogue stay peer cards — they are libraries you add
*from* — and each row's `+` opens the which-list popup `FoodTab` already has.

---

## Phase 7 — composer options per card

`lib/cardRegistry.ts` gains `compose: { depth, opts }`. The prototype's table:

| Card | Options |
|---|---|
| Today | Time · Effort · Goal |
| This week | Day · Time · Goal |
| This month | Date · Goal |
| Whenever | Effort · Goal |
| Recurring | Repeat · On · Time |
| Shopping list | Qty · Category |
| Catalogue | Price · Category |
| Habits | How often · Target · Remind |
| Goals | By when · Measured in |
| Medicine | Dose · Trays |

This is the three-tier contract AGENTS.md already describes, made data: **the line** (a name —
committing there alone must always produce a valid row), **the options**, **More options**.

⚠️ **The dependent option is the dangerous one.** On Recurring the weekday row exists only once
Repeat says Weekly — and that is *exactly* the control that froze the shipped app. A picker
opening in a `<Modal>` takes window focus, the field blurs, and a composer that tears itself down
on blur disposes of itself **behind the open dialog**. Nothing looks broken, so it reads as a
freeze.

The guard exists: `internalPressRef` + `controlsResponderProps`, pinned per slot by
`lib/__tests__/composerFocusSteal.test.ts`. **Any new options slot must spread
`controlsResponderProps`** — that is the one thing a new slot silently misses. And the flag must
be re-armed in `onFocus`, or after one picker it eats the next genuine tap-away.

**No blind tap-cycles**: a stepper for a number, a picker for a choice.

---

## Phase 8 — groups and Manage cards

`lib/cardRegistry.ts` gains `group`. Growth spans **two screens** (Habits' card and two of
Health's), which is the point of the feature — the lookup must search every screen, not the
current one.

⚠️ **New rule, from a bug found in the prototype: no group may contain two cards with the same
title.** `time` held both `todoToday` and `homeToday`, both titled "Today", so expanding Home's
Today drew the strip as *Today · This week · Today*. Home's cards are **previews** of other tabs
and carry no group. **Add a test for this** — it is invisible until someone opens that one pane.

Manage cards generalises `components/HomeCardManager.tsx` from Home to any screen.

---

## Verification

1. `npx tsc --noEmit` — first gate, and phase 5's derived unions mean it finds the work for you.
2. `scripts/test-changed.sh` — expect `colors.test.ts`, `glassMaterial.test.ts`,
   `cardAnatomy.test.ts`, `expandableCards.test.ts` and `screenRhythm.test.ts` to need
   **updating**, not merely to pass.
3. `npm run halos` — must stay 0 clipped.
4. `npm run wraps -- --lang=no --width=360` — findings expected after phase 4; read the
   "screens measured" line, because this audit fails by *un-measuring* screens, not by erroring.
   A restructure of To-do and Shop will break its walk steps.
5. `npm run preview` — proves the write paths still work.
6. `npm run review-bundle` — before/after screenshots.
7. PR into `main` and **merge it** (standing rule; OTA fires only on push to `main`).

## Do NOT

- Do not delete `FIELD_GLOW_CLEARANCE` (phase 2).
- Do not put `collapsed_cards` or `design_lab` in the AI settings whitelist.
- Do not bump `runtimeVersion` — this is all JS.
- Do not re-add the 5% identity-hue pane wash. It was exported and rejected (2026-08-20); a card
  is white glass and the badge is its one colour move.
- Do not give a card header a literal 48px button box (phase 4).
- Do not "fix" a tight card with a margin — the screen's `SCREEN_GAP` owns vertical gaps.
- Do not touch `NarratorQuote`'s italic; it is the app's one instructed exception.

## Still the maintainer's call

Four things were decided *by me* in building the prototype and are flagged in it as such. Ask
before treating any as settled:

1. **Earlier days → Today, Washed away → Whenever.** Applies the maintainer's own Goals principle,
   but was not requested.
2. **The first card on each screen rests open.** Softens the 2026-08-21 all-closed ruling; it is
   the proposed answer to "seven identical bars".
3. **"Denne måneden" truncates at 393px** — the only card title in the app that fails at a
   mainstream width. A shorter Norwegian name would clear it.
4. **Whether the ⤢ survives its measured cost** (6 of 30 vs 1 of 30). The prototype has a toggle
   to compare both with the count live on screen.
