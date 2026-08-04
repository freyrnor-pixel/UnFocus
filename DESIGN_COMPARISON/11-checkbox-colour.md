# 11 — Domain-hued check rings

**Size:** XS · **Blocked by:** 06 (which hue), 10 (row geometry may have moved)

Read `00-INDEX.md` first if you haven't.

---

## The decision

In the design project every check ring takes its surface's hue, not a neutral:

- `HomeScreen.jsx` `NoteRow` → `border: '2px solid var(--c-feat-note)'` (gold)
- `HomeScreen.jsx` `ShopRow` → `border: '2px solid var(--c-feat-shop)'` (green), and when
  checked the ring **fills** with the same hue and shows a white `checkmark`
- `TasksScreen.jsx` `TaskRow` → `border: '2px solid var(--c-feat-plan)'` (indigo)
- `HabitCard.jsx`'s 7-day pips → three states: `done` = filled accent, `scheduled` =
  `--c-border-strong`, otherwise `--c-border`

All at 22px with a 2px ring. The app's checks are neutral.

**Pick one:**

- **(a)** Hue the ring per domain, empty and filled
- **(b)** Keep neutral
- **(c)** Neutral when empty, domain hue only when **ticked**
- **(d)** (a), but only on the Home preview cards

*Recommendation: **(c)**.* You get the colour at the moment it means something — the tick — and
you avoid ten coloured empty rings competing with the row text for attention on a full list.
It also sidesteps the contrast problem below, since an empty ring stays on the contrast-tuned
neutral token.

---

## The constraint that makes (a) risky

`--c-border` (`#7284A2`) is contrast-tuned: **3.128:1 on bg, 3.792:1 on surface**, which is what
clears WCAG 1.4.11 for a control boundary. A checkbox ring **is** a control boundary — this is
exactly the case that rule covers.

The domain hues are **not** tuned for that job. `--c-card-shop` / `--c-card-meal` is `#D9A441`,
a light gold; as a 2px ring on `#FFFFFF` surface it will not clear 3:1. `--c-feat-note` is
`#E6BC1C`, lighter still.

So option (a) is not a free swap — for the lighter hues you would need either a darker variant
or a fallback, and inventing one risks the mutually-constrained ladder that `colors.test.ts`
guards. Option (c) has no such problem: a **filled** ring with an ink glyph is judged on the
glyph's contrast against the fill, not the ring against the background, and
`lib/domainColor.ts` already declares an ink for exactly this.

Also relevant, from `components/HomeNotesCard.tsx` (rule A.4 #1): the identity hue stays on the
plate and rim — a **fill** — while the glyph does not take it. A filled hue ring with a neutral
or declared-ink checkmark is consistent with that; a hue-coloured *glyph* is not.

---

## What to touch

Wherever the check is drawn. Post-2026-07-30 the check is the **last** element in the row:

> `[leading?] title → ONE meta line → ONE right-hand value → [⋯ action] → [○ check]`
> The check is on the RIGHT… On a paper checklist the ticks live in the right margin.

Primary: `components/PadRow.tsx` — the shared row shell. Changing it there covers the four Home
cards, `app/(tabs)/habits.tsx`'s `HabitCard`, and `components/NoteRow.tsx` in one edit.

Not covered by `PadRow`, so handle separately or explicitly leave: `app/(tabs)/shopping.tsx`'s
`ShoppingRow`/`MonthlyTableRow`, and `plans.tsx`'s `TaskCard` outside the timeline layout. If
you only do `PadRow`, **say so in the PR** — a half-hued app is worse than a neutral one.

**Which hue?** Whatever 06 decided. If 06 landed the hybrid, cards keep `card-*` — so the ring
takes `domainColor.accent`, not a `feat-*` hue.

⚠️ **If 10 landed option (b)** (boxed rows), the row's internals moved and this may need
rebasing. Check 10's outcome before starting.

---

## Landmines

- **Don't grow the ring to hit the tap target.** `tokens/spacing.css`: "When the VISUAL control
  is deliberately smaller… don't grow the art — expand the touch area instead." Use `HitSlop.*`
  from `constants/theme.ts`. A bare `hitSlop: 8` or a bare `44` fails
  `lib/__tests__/designTokens.test.ts` in CI.
- **One meta line, one right-hand value.** The check is not a place to add a second signal.
- **`done` fades the whole row** at `DONE_ROW_OPACITY` (0.55). A hue that looked right at full
  strength will be 55% of itself the moment it's ticked — which is the state option (c) is
  entirely about. Judge the colour in the *faded* state, not the fresh one.
- **`ShoppingRow` has a `React.memo` comparator** — any new prop must be added to it or the
  list won't repaint.
- **The ghost-check ring on the type line.** `PadTypeRow.tsx` draws a single faint ghost check.
  It was moved there in 2026-07-31 because "several identical ghost circles in a row read as
  noise". If you hue the real checks, check the ghost still reads as *not* a real one.

---

## Verify

1. `npx tsc --noEmit`
2. `scripts/test-changed.sh` — `designTokens.test.ts` and `colors.test.ts` are the ones that
   matter here; report them by name.
3. `npm run preview` — **required**, both themes. Check a list with several rows, ticked and
   unticked together, so you can see whether the rings shout in aggregate.
4. No `npm run wraps` needed — the ring's size isn't changing.

## Close out

Update `PadRow.tsx`'s header if the check's colour contract changed. Commit, PR into `main`, merge.
