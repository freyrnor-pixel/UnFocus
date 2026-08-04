# 03 — Where the illustrated tree actually binds

**Size:** M · **Blocked by:** 02 (needs the `full` stage) · **Needs preview:** yes

Read `00-INDEX.md` first if you haven't. This is the biggest of the five art tasks and the
one that answers "none of it was used".

---

## The decision

The design project offers four candidate bindings for the growth-staged tree
(`guidelines/natural-tree.card.html`), and one hard constraint:

> **One tree per screen.** If a screen already shows an ambient tree backdrop, don't also bind
> a second guidance tree to it — pick one role.

The four candidates, quoted:

| Binding | Design's description |
|---|---|
| **Habit consistency** | "Stage advances with sustained streak history, not any single day. A missed day pauses growth — it never regresses the stage, so there's nothing to 'lose'." |
| **Energy budget** | "Canopy fullness tracks `current / capacity`. Spending energy never shrinks the tree below its stage floor — costing is not framed as loss." |
| **Focus session** | "A single sitting animates seed→full over the session length." |
| **Ambient (decorative)** | "Plain backdrop use — sway only, no fill logic." |

**Pick one or more:**

- **(a)** Habits — a small stage tree per habit row, driven by streak
- **(b)** Home — full tree as a dimmed ambient backdrop behind the day card
- **(c)** Energy — canopy fullness instead of, or beside, the pips
- **(d)** All three (different screens, so the one-per-screen rule still holds)
- **(e)** None — close the art tasks after 01/04

*Recommendation: **(a)** first, alone.* It needs no new data (the streak already exists), it is
per-row so it can't dominate a screen, and it is the one binding whose semantics the app has
already committed to elsewhere. **Skip the focus-session binding entirely** — this app has no
focus-session feature, and inventing one is far outside a design-comparison pass.

---

## Why (a) is the safe one, in this codebase specifically

The "never regresses, nothing to lose" framing is not new here — it is the same shape the app
has already landed three times, and reusing it costs no new design argument:

- `lib/growth.ts` — the backdrop reward grows from a **high-water mark**, so branches never
  un-grow; neutral is the floor, "a lapsed streak returns the backdrop to exactly the art the
  app always had — never to a visibly worse one."
- `lib/goalStrength.ts` — goal strength floors at 0, "so there is no state in which a goal is
  failing."
- Habits are positive-only by an explicit decision: no negative kind, no slip logging, **no
  broken streak**.

A stage tree that pauses instead of regressing is the same rule a fourth time. A stage tree
that *shrinks* on a missed day would contradict all three — don't build that, whichever
option is chosen.

---

## What to touch, per option

### (a) Habits
- `app/(tabs)/habits.tsx` — the in-file `HabitCard`. It was converted to `PadRow` on
  2026-08-01, so the row anatomy is fixed:
  `[leading?] title → ONE meta line → ONE right-hand value → [⋯] → [○ check]`.
  **The tree does not get a new slot.** It goes in the `leading` position or as a card-corner
  watermark; a third row line is out — that cap is what keeps the row readable at 360px in
  Norwegian.
- `components/HomeHabitsCard.tsx` if the Home preview should match. Decide deliberately: the
  Home cards are the *newer* code, so if the two disagree, convert the tab, not the card.
- The streak → stage mapping is new logic and wants a home. Put it in a small pure helper
  (`lib/treeStage.ts` or similar) — dependency-free, plain numbers in, a stage id out, the
  same discipline as `lib/growth.ts` and `lib/cardLayout.ts`. **Add a test with it**; that is
  the standing rule in `TESTING.md` for any new pure helper.
- Watch the leading slot. `components/HabitIcon.tsx` has a gate, `hasChosenHabitIcon()`, and
  its header warns: rendering the neutral default "put a second, inert hollow circle next to
  the row's real check." A tree in the leading slot competes with the habit's own icon — you
  must decide which wins, and the answer is probably "the tree is a corner watermark, the icon
  keeps the leading slot."

### (b) Home ambient backdrop
- `app/(tabs)/index.tsx` and/or `components/HomeHeroBackground.tsx`.
- **Read `05-screen-backdrop.md` before starting** — that task governs the same visual layer
  and the "one tree per screen" rule means these two cannot both land naively. Doing (b) here
  probably means closing 05 as superseded.
- `components/ScreenBackground.tsx` already draws a corner-branch field behind the whole pager
  *and* carries the growth reward. A full tree behind the day card would be the second tree on
  that screen. This is the option most likely to look crowded.

### (c) Energy
- `components/EnergyMeter.tsx`. **Read its header before touching it** — it is long, and it is
  long because this component has been redesigned three times in two weeks (#479 most
  recently). Two constraints it states outright: the meter is not a card ("Don't re-wrap this
  in `Surface`/`GlassFill`"), and the whole 2026-07-31 rework existed because ten saturated
  pips and "10 / 10" read as a **score**, which is the one thing Energy must not be.
- A canopy that fills as capacity is spent risks re-creating exactly that read. If you take
  this option, the tree should express *remaining room*, not *achievement*.

---

## Cross-cutting rules from the design project

Apply these whichever option is picked:

- **Stage, not a slider.** "Snap to the 4 discrete stages for legibility; only animate the
  transition between them… don't invent in-between geometries."
- **Floor at seed, never bare.**
- **Recolour, don't redraw.** "Swap the 5-tone blue ramp for a `--c-feat-*` token when tagging
  a life area; keep the same branch/leaf geometry." ⚠️ Note this is currently *not possible* —
  the trees are illustrations with a baked `pal`, and `Motif.tsx` ignores the `color` prop for
  those. Recolouring means a generator change, not a prop. **Don't attempt it in this task**;
  if the design demands per-domain tree colour, that is its own follow-up.
- **Motion budget.** "Idle sway ±1.1°, ~6s ease-in-out loop; stage-to-stage growth transitions
  run 600–900ms, easing like the rest of the system (never bouncy)." Use `Duration.*` and
  `Ease.*` from `constants/motion.ts` — a bare `duration: 220` fails
  `lib/__tests__/designTokens.test.ts` in CI. Honour reduced motion via `useAccessibility()`;
  the app already ORs in the OS flag.

---

## Verify

1. `npx tsc --noEmit`
2. `scripts/test-changed.sh` — plus the new helper's own test if you added one.
3. `npm run preview` — required. The driver already creates a habit on the Habits tab, so
   option (a) is covered by the default walk; check `preview-shots/`.
4. `npm run wraps -- --lang=no --width=360` — required for option (a). You are adding an
   element to a row that already carries a title, a meta line, a value, a ⋯ and a check.
   Norwegian at 360px is where that breaks. If it wraps, the fix is usually `flex: 1` **plus
   `minWidth: 0`** on the title side — `flex: 1` alone does nothing there; `components/TaskCard.tsx`
   documents why.

## Close out

Update the headers of every file you touched, both ends of each `Connections:` block. Commit,
PR into `main`, merge.

---

## Outcome — **the ambient option shipped**, 2026-08-04

**This task was previously closed as "declined on `lib/growth.ts`'s authority". That close-out
is superseded: the maintainer's tie-break for this session is that the design system wins over
a decision recorded in the repo's docs.** But that reversal does *not* reach the three bindings
this file spends most of its length weighing, and it is worth being precise about why, so the
next session doesn't reopen them thinking a rule got relaxed:

> The design project's **own readme** declines canopy-fullness-from-Energy,
> grow-a-tree-over-a-focus-session and stage-advances-on-a-habit-streak — *"the art was
> accepted; the bindings were not."*

Both sides say no, so there is nothing for a tie-break to decide. What both sides *allow* is the
guidance card's fourth candidate — **"Ambient (decorative) — no data bound. Plain backdrop use,
sway only, no fill logic."** That is what shipped.

### What landed

- **`components/StageTree.tsx`** — the four stages behind one component, with the design's idle
  sway (±1.1°, ~6s ease-in-out via the new `Duration.sway`, pivoting at the trunk's base) and
  reduced motion freezing it flat at 0°. It has **no data prop and cannot reach a store**; that
  is deliberate and its header says so.
- **`components/StarterCard.tsx`** gains `stage`, defaulting to `'seed'` — the floor. Raising it
  is a *layout* call (this card is big enough for a fuller drawing), never a reading of user data.
- **`app/(tabs)/habits.tsx`** — `stage="sprout"` on its StarterCard (the app's largest empty
  state), and `tree-natural-full` standing on the open backdrop at the foot of the column.
- **`components/EnergyMeter.tsx`** — `stage="sapling"` on the tutorial card that replaces the
  whole meter. Deliberately NOT `current / capacity`, which is one of the three declined bindings
  and would land squarely on the "ten pips read as a score" problem that rework existed to fix.

All four stages now render somewhere. **One tree per screen holds**: Habits' foot tree is gated
on the exact complement of its StarterCard's own gate, and Home's other cards draw inline
explainers rather than StarterCards, so the Energy tutorial is the only tree there.

### Two things worth not re-learning

- **"Behind the header" doesn't exist on this screen.** The foot tree was first mounted as an
  absolutely-positioned watermark at the top-right of `styles.content`. Every card on the Habits
  tab is full-width and opaque, so it was almost entirely covered — the preview showed a sliver
  past the card's edge and nothing else. Below the list, where the backdrop is genuinely open, it
  reads as the scenery it is meant to be. Confirmed by screenshot, not by reasoning.
- **A fixed-height row won't clip a taller child** in React Native. The foot tree's row carries
  the tree's own height (150), not the bottom spacer's (96), or the canopy spills over BottomNav.

The "recolour, don't redraw" rule is still *not possible* — the trees are illustrations with a
baked `pal` and `Motif.tsx` ignores `color` for those. Unchanged by this task; still its own
follow-up if per-domain tree colour is ever wanted.
