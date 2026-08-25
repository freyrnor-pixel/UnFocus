# 19 — The card surface reset (2026-08-25)

**Status: mockup published, awaiting a device test. Nothing in `app/`, `components/`,
`lib/`, `store/` or `constants/` has been touched.**

Live prototype: `19-card-surface-reset.html` (open it directly, or the published artifact).

---

## The report

Maintainer, against the shipped app: *"Todays look is messy, clouded, and looks like 10 steps
back in design."* Two target mockups supplied — `Glass_Card_System.html` and
`Card_Editor_System.html` — plus, on the plan: *"It is meant for the visual per screen, per
card, and most importantly a useable GUI. What I have managed to instruct you to is bad. Show
me a mockup per screen I can test before we implement."*

## The diagnosis

**The mockups were not proposing new structure.** `lib/cardRegistry.ts` + `components/Card.tsx`
(2026-08-21) already deliver *Glass Card System*'s thesis — one component draws every card, one
control cluster, a persisted fold, expand-in-place. The regression is in **surface**, and it
measures:

| Symptom | Cause |
|---|---|
| Cards read as haze | Dark `bg` `#000000` ↔ `surface` `#1E1E1E` = **1.26:1** (light, 1.17:1). The fill does nothing, and `getGlassEdge`'s dark-card branch deliberately fades the edge to transparent on the bottom-right — so a card has no boundary on two of its four sides. |
| "Clouded" | The mockups' own budget — *"Text, borders, backgrounds: no glow"* — is violated on all three: 3 full-screen orbs (backgrounds), a light-catching gradient edge on every card (borders), and a **resting** `getFieldGlow` halo on every composer, including the collapsed `+` bar (`components/AddRow.tsx:312`). Up to nine lit wells on a five-card screen, while the content carries none. |
| Cards have no identity | 2026-08-20 deleted the 5% pane wash (gold → olive). Right diagnosis; the fix chosen was zero rather than per-hue alpha. |
| "No order, no logic", again | 2026-08-15 made rows flush. Correct *while the card was an opaque pane*; on a 1.26:1 card, flush rows have nothing to sit against. |

## Decisions taken

1. **Card surface: neutral, with real fill.** No hue on the pane — the badge stays the one
   colour move, so **the 2026-08-20 ruling stands**. What changes is the fill step
   (`#1E1E1E` → `#2C2C2C`, 1.26:1 → 1.50:1) and the edge, which runs all four sides again.
   Side effect worth having: white text goes 16.7:1 → 14.0:1, *further inside* rule 10a's
   halation ceiling rather than past it.
2. **The ⤢ returns**, between the caller's controls and the fold. ⚠️ **Reverses 2026-08-22**
   ("Remove all full screen buttons, instead user just presses the title"). See the measured
   cost below.
3. **Rows are boxed again.** ⚠️ **Reverses 2026-08-15** and re-opens `DESIGN_RULES.md` open
   conflict #8. Third answer to that question; all three the maintainer's.
4. **Full scope** — surface, glow budget, composer depths, card groups, Manage cards.

## What building it turned up

**(a) The ⤢ costs title width, and the bill is measurable.** Swept five screens × three widths
× two languages, with the buttons already trimmed to the app's own draw-36 / touch-48
(`hitSlopFor`):

| | Truncating combinations |
|---|---|
| ⤢ in the header | **6 of 30** |
| ⤢ off, title opens | **1 of 30** |

All of it at **360px**; 393 and 430 are clean either way. The pattern is exact: **any card
carrying its own control** — Catalogue's lock, Medicine's bell — plus the ⤢ plus the fold.
Three buttons is one too many at that width. Worst case is Norwegian To-do at 360: four of
seven titles cut. The prototype has a toggle to compare the two live, and reports the count
on screen.

A third option exists and was not taken unilaterally: keep the ⤢ and drop the *fold chevron*
on cards that carry a control.

**(b) Closed cards all look the same.** With the 2026-08-21 "all cards rest closed" ruling,
To-do renders as seven near-identical bars — which is the "no order, no logic" complaint in
its purest form. **The surface fix does not touch this.** It is a resting-state question, and
the honest answers are fewer cards per screen, or letting the first card on each screen rest
open. A separate decision.

## Taken from the mockups

Border on all four sides · a real drop shadow · the chevron rotating to point where it will go ·
group tabs in full screen (Growth spans Habits *and* Health) · the Manage cards sheet · three
composer depths declared by the card, not chosen by the user.

## Refused, and why

- **30px controls** → 48. `MIN_TAP_TARGET` is not negotiable.
- **`.qa-hint`** ("Enter saves and keeps typing · More for all fields") → a manual, and
  2026-08-17 deleted the manuals.
- **The dashed `.empty` box** → `components/NarratorQuote.tsx` stays. Dashed wells went in the
  2026-08-18 blueprint pass — which is also why the prototype's resting composer is a recessed
  well with no stroke, not a dashed outline.
- **The mockups' frame glow** (three feature radials at 26–34%) → brighter than our orbs, and it
  re-opens the OLED/halation argument. Orbs held at 12–13%.

## Notes on the prototype itself

- Tokens are lifted verbatim from `constants/colors.ts` and `constants/theme.ts`; the card
  stacks are `lib/cardRegistry.ts`'s. The type is Nunito, the app's real face.
- **Show what's lit** dims everything that is not a light source, so the glow budget can be
  counted rather than argued about. Home has three.
- The fill slider is live — the `#2C2C2C` above is a starting point, not a verdict. Its ceiling
  is `rule` `#3A3A42`: push the surface up to meet it and the row dividers vanish.
- Norwegian is included because it is the tighter wrap test, per `npm run wraps`.
- On a phone the frame drops away and the app runs against the real viewport at 1:1.

## Next

Implementation is planned but not started. Files it will touch: `constants/colors.ts` (the
`surface`/`surfaceGlass` pair, re-derived together), `constants/theme.ts` (`getGlassEdge`'s
`shadeDark: 0` branch), `components/AddRow.tsx` + `PadTypeRow.tsx` (resting halo),
`components/ScreenBackground.tsx` (orb alphas), `components/PadSheet.tsx` + `PadRow.tsx`
(boxed rows), `components/Card.tsx` + `lib/__tests__/cardAnatomy.test.ts` (the ⤢, which that
test currently asserts the *absence* of), and `lib/cardRegistry.ts` (`compose` and `group`).
A new `lib/__tests__/glowBudget.test.ts` is what stops the glow creeping back.

---

# Round 2 — the restructure (2026-08-25, same day)

Maintainer, after testing round 1: *"Looks great. But Monthly goes under shopping list, and there
has to be a way to make more shopping lists, save them for later use (Archiving) and an easy way
to make New shopping lists and adding dishes and items from Catalogue, as well as the sectioning
we started with (In list, in cart, bought). Goals for Habits should be a part of habit card, and
Goals for to-do a part of 'Today'. To-do must be simpler."*

## Shop — one container card

`Shopping lists` is the container. Every list is a **section** inside it, **Monthly among them,
under the weekly one** — not a peer card. That follows `lib/cardRegistry.ts`'s own boundary: a
card is a thing the registry names; a section is drawn one-per-row of user data, so it gets no
`Surface`, no persisted fold id and no full-screen arrow — it rides its parent's.

Each list splits **In list → In cart → Bought**, and a row moves along by tapping it.

> ⚠️ **This needs no migration.** The three states already exist: `lib/db.ts:387` documents
> `checked` = *"moved to cart"* and `collected` = the cart tick, added together in the same pass.
> So `checked=0` / `checked=1,collected=0` / `checked=1,collected=1` **is** In list / In cart /
> Bought. The sectioning is a rendering of state the app already stores.

`+ New shopping list` and `Archive` sit at the foot of the list stack — the bottom-of-list
placement rule (a trigger belongs where the thing it creates will land). New list offers
*Start from*: empty, this week's, or any archived list, which is what makes archiving mean
"save for later use" rather than "hide".

**Food and Catalogue stay peer cards**, because they are libraries you add *from*, not lists.
Each row carries a `+` that asks which list — the same shape `FoodTab`'s per-dish button
already has.

## Goals fold into their parents

Habits' goals into the Habits card; To-do's into *Today*. `habitsGoals` and `todoGoals` stop
being registry cards and become sections.

## To-do is five cards

Today · This week · **This month** · Whenever · Recurring.

> **"This month" is a date filter, not monthly recurrence.** AGENTS.md excludes monthly
> *recurrence* from `normalizeRecurringTasks` because there is no per-occurrence completion row.
> A month-shaped section has no such problem — it is the same question This week already asks,
> one rung out.

## Two things I decided that you did not ask for

Both flagged in the prototype so they are easy to overrule:

1. **Earlier days and Washed away fold in too**, by the same principle you gave for Goals:
   Earlier days into *Today*, Washed away into *Whenever* — which is where it belongs anyway,
   since the Whenever backlog is exactly what washes away.
2. **The first card on each screen rests open.** This is the answer I proposed to "seven
   identical bars", now testable. It softens the 2026-08-21 all-closed ruling.

## What a new row gets, per card

The three-tier contract already in AGENTS.md, made visible: **the line** (a name — committing
there alone must always produce a valid row), **the options**, **More options** into the editor.

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

**Options can depend on each other**, and Recurring demonstrates it: the weekday row exists only
once Repeat says Weekly. That is deliberately the control that froze the shipped app — a picker
opening in a `Modal` took window focus, the field blurred, and the composer tore itself down
behind the open dialog. Anything built here must keep `internalPressRef`'s guard.

**No blind tap-cycles**: a stepper for a number, a picker for a choice.

## The measurement moved

Re-swept after the restructure — still 6 of 30 combinations truncate a card title with the ⤢ on,
1 of 30 with it off. But one case is new and worse:

> ⚠️ **"Denne måneden" truncates at 393px**, not just 360 — the only card title in the app that
> fails at a mainstream width. The card you asked for has the longest Norwegian title in the set.
> Worth having; this is its bill.

## Still open

- Whether Earlier days / Washed away should really live inside other cards (my call, not yours).
- Whether the first-card-open default sticks, against the 2026-08-21 ruling.
- Whether "This month" keeps its Norwegian name, or takes a shorter one to clear 393.
