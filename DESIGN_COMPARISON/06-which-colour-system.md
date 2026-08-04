# 06 — Which colour system colours a card

**Size:** S (the decision is the work) · **Blocked by:** nothing · **Blocks: 07, 08, 09, 11**

Read `00-INDEX.md` first if you haven't. **Do this before any of 07–11** — all four consume
whatever hue this task settles on, and reversing it later means touching them all again.

---

## The decision

The app has **two** live colour systems. The design project's screens use the other one.

**`--c-feat-*` / `lib/screenColor.ts` — 9 screen hues.** Ordered by routine sequence, not as a
rainbow. From `tokens/colors.css`:

> read plan → task → habit → health → meal → shop → budget → note and the hue walks a
> deliberate arc (cool morning block, warm midday, settling to money-amber and a golden note
> accent). Health sits on teal, deliberately OFF red.

`plan #6E74EE · task #4C8DF0 · habit #22A7E0 · health #17BEB0 · meal #E88A52 · shop #3DAF6F ·
budget #D69420 · note #E6BC1C · scan #9B72E3`

**`--c-card-*` / `lib/domainColor.ts` — 9 names, 4 values.** Collapsed on 2026-07-31:

> NINE NAMES, FOUR VALUES since 2026-07-31 (addendum A.3): nine identities was more than
> anyone learns. The retired names are kept as aliases so consumers keep compiling.

`todo/goals #3F52B5 · habits #1F7A2E · health #A84A60 · shopping+food #D9A441 · notes neutral #6B7280`

with a constraint that is easy to break by accident:

> ⚠️ These four separate by **L\***, NOT by hue, and are MODE-INVARIANT (the dark block
> repeats them unchanged). Never equalise their lightness and never lighten them per mode —
> the L\* spread is precisely the thing that has to hold.

**The divergence:** the design's `HomeScreen.jsx` colours each card from `--c-feat-*` — Notes
yellow, Plans indigo, Shopping green, Habits sky. The app colours cards from `--c-card-*`, so
Notes is neutral grey and Shopping/Food share one gold. That is most of why the design reads as
"better coloured": every card is visibly its own thing.

Since identity collapsed to four hues, the **glyph** is what distinguishes same-hue cards —
`components/CardAccent.tsx` notes that domains sharing a hue must keep clearly different
silhouettes (shop=cart vs meal=restaurant vs budget=wallet all ride the Shopping gold).

**Pick one:**

- **(a)** Keep 4-hue card identity everywhere — fewest things to learn, honours the July call
- **(b)** Move cards onto the 9 `feat-*` hues — closest to the design, re-expands what was
  just deliberately shrunk
- **(c)** Hybrid: `feat-*` for screen chrome (header, tab, stripe, backdrop tint), `card-*` for
  the card body and badge
- **(d)** Keep (a), and instead fix the one case that actually hurts: Notes' neutral grey

*Recommendation: **(c)**.* You get the design's visible variety where it is decorative and
non-identifying, without reopening "nine identities was more than anyone learns" — the reason
for the collapse was **learnability of identity**, and screen chrome isn't identity.

**Consider (d) as a cheaper first move.** `--c-card-note: #6B7280` is commented "NEUTRAL —
Notes gets no identity hue", while `--c-feat-note: #E6BC1C` is a warm gold that exists and is
unused on that card. Notes is the one Home card with no colour at all, which is likely a real
part of "the design colours better". One token, one card.

---

## ⚠️ Named complaint — start here

Maintainer note, 2026-08-04: *"The current color scheme is not pleasing, like the one for
recurring and habits."*

That is a specific, actionable steer and it should drive this task ahead of the abstract
(a)/(b)/(c) choice. Two concrete hues to look at:

**Habits — `--c-card-habit: #1F7A2E`.** A dark forest green. It is the outlier in the identity
set: `#3F52B5` (todo) and `#A84A60` (health) and `#D9A441` (shopping) all sit in a similar
mid-lightness band, and `#1F7A2E` is noticeably darker and more saturated than any of them. On
a white surface it reads heavy. Note the constraint before changing it — the four hues
"separate by **L\***, NOT by hue", and that spread is deliberate — so you cannot simply lighten
it to taste without checking it still separates from the other three. `--c-feat-habit` is
`#22A7E0` (sky), a completely different and much lighter treatment; if the card hue moved
toward it, that is effectively option (b)/(c) for this one domain.

**Recurring.** Find its hue at the call site first — it is a section on `app/(tabs)/plans.tsx`,
not a token with "recurring" in its name, so identify what it actually resolves to before
judging it. For reference the design project's `TasksScreen.jsx` gives Recurring `--c-accent`
and Whenever `--c-good`, i.e. it uses the *semantic* tokens for section identity rather than a
domain hue. That may itself be the problem in the app — using `good` (green) for a section
label puts a success colour on something that isn't a success state.

**Deliverable for this part:** identify both hues precisely, screenshot them
(`npm run preview`), and propose replacements *with their contrast ratios*. Do not change a
palette token without running `lib/__tests__/colors.test.ts` — it asserts exact ratios and the
tokens are mutually constrained (see Landmines below). A hue that "looks nicer" and drops
below 4.5:1 as small text is not a fix.

---

## What this task actually delivers

**Not a big refactor.** Deliver:

1. **A decision, written down.** Add it to `DESIGN_RULES_AUDIT.md` (which exists to record
   which divergences are deliberate) or as an addendum note in `constants/colors.ts` next to
   the card-identity block. The next session must be able to find the answer without re-deriving
   it — that is the whole point of running this before 07–11.
2. **The token plumbing**, if (c) or (d): make the chosen hue reachable at the call sites 07–11
   will use. `lib/domainColor.ts` and `lib/screenColor.ts` already exist; this may be zero code.
3. **At most one visible change** — (d)'s Notes hue, if picked. Everything else is 07–11's job.

Resist doing 07's border work here. Separate PRs keep the revert cheap if the hue reads wrong.

---

## Landmines

- **`colors.test.ts` asserts exact contrast ratios** and is CI-gated. The four chromatic tokens
  moved together in the 2026-07-31 ladder pass and are mutually constrained: `surface` is pinned
  at `#FFFFFF` (its ceiling), so bg↔surface ≥ 1.20:1 is only reachable by darkening `bg`, which
  drags every chromatic token's contrast against it down. **Do not "restore" an older, brighter
  hex** — several of these are load-bearing on each other.
- **The semantic trio (`good`/`bad`/`warn`) is used as small text**, so all three clear 4.5:1
  against `bg`. Not decorative fills — don't borrow one as a card hue.
- **`--c-rule` is decorative only** (1.396:1 on surface, deliberately below the 3:1 control
  floor). "Never use for an input outline, card edge, chip border or focus ring." Relevant to 07.
- **The card hues are mode-invariant.** If you touch them, the dark block must stay identical to
  light. Repeat: never lighten them per mode.
- **A.4 rule 1** (cited in `components/HomeNotesCard.tsx`): the identity hue stays on the plate
  and rim — a *fill* — and the glyph does not take it. Keep that when adding hue anywhere.

---

## Verify

1. `npx tsc --noEmit`
2. `scripts/test-changed.sh` — **`lib/__tests__/colors.test.ts` must run and pass** if any
   token changed. Report the ratios it checked, not just "passed".
3. `npm run preview` only if a visible hue changed (option (d)). Otherwise skip — this is
   mostly a documentation task.

## Close out

Whatever you choose, **write it where 07–11 will look**: a line in `constants/colors.ts` next
to the card-identity block naming the decision and its date. Commit, PR into `main`, merge.
