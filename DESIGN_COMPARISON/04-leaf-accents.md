# 04 — `leaf-icon` and `leaf-sprig` as inline marks

**Size:** S · **Blocked by:** nothing · **Needs preview:** yes, one shot

Read `00-INDEX.md` first if you haven't.

---

## The decision

The design project proposes three uses for the small leaf art
(`guidelines/natural-tree.card.html`, "Practical UI use — leaf iconography"):

> The same leaf shape used across the canopy scales down into small inline icons — a low-key,
> on-brand replacement for a generic bullet/chevron icon, not a new decorative layer.

1. **List item leading icon** — a leaf where a bullet would be
2. **Card corner accent** — `leaf-sprig` in a card's top-right
3. **Icon-only button** — a leaf inside a round icon button

With the rule:

> **Leaf icons are a light touch.** One leaf per row/card/button, sized like any other inline
> icon (18–24px) — never a second illustration competing with the tree itself on the same screen.

**⚠️ Use 1 collides with a fixed bug.** `components/HabitIcon.tsx`'s header:

> `hasChosenHabitIcon()` is the gate every ROW should ask before drawing a leading mark.
> Rendering the neutral default put a second, inert hollow circle next to the row's real
> check — see that function's own comment before reintroducing it anywhere.

A leaf in every row's leading slot is that same shape: a decorative mark sitting next to the
row's real, tappable check. The row anatomy already ends `[⋯ action] [○ check]` on the right;
adding a universal leading glyph on the left re-opens the visual noise that gate was added to
stop.

**Pick one:**

- **(a)** Leaf only on habits that have **no** chosen icon — fills a real gap, no duplicate mark
- **(b)** `leaf-sprig` as a card-corner accent only, never a row bullet
- **(c)** Both (a) and (b)
- **(d)** Leaf as a leading icon on all rows, per the design as written
- **(e)** Skip

*Recommendation: **(b)**, or **(c)** if you want more of it.* (b) uses the art, adds no
per-row cost, and touches nothing the row rule governs. Avoid **(d)** — it is the one option
that argues with a fix already in the tree.

---

## The one technical fact that decides how you build this

The two leaf assets are handled **differently** by the motif pipeline, and it is not obvious
from their names:

| motif id | has `pal`? | means |
|---|---|---|
| `leaf-icon` | **no** | **Tintable.** Single-colour. Takes `color={...}` — pass any theme token. |
| `leaf-sprig` | **yes** | **Illustration.** Carries its own 4-step blue ramp. `color` is ignored. |

Verified against `constants/motifs.ts`. This is genuinely useful:

- **`leaf-icon` can be tinted per domain.** `color={domainColor.accent}` from `lib/domainColor.ts`,
  or a `--c-feat-*` equivalent, works out of the box. That makes it the right choice anywhere the
  mark should agree with its surroundings.
- **`leaf-sprig` cannot.** Its blue is fixed art. Using it on a gold Shopping card or a rose
  Health card will read as a foreign object. Confine it to neutral or blue-family surfaces —
  or use `leaf-icon` at a larger size instead.

If the design's intent is a *recoloured* sprig, that needs a generator change, not a prop.
Out of scope here; note it and move on.

---

## What to touch

**For (b) — card corner accent:**
The design's example is a card with title + subtitle on the left and a 20×40 sprig at the
top-right, `opacity: 0.85`. Candidate surfaces, in order of fit:

- `components/HomeHabitsCard.tsx` — habits are the closest domain match to a leaf
- `components/StarterCard.tsx` — **only if task 01 did not land the seed tree there.** Both is
  a direct violation of "never a second illustration competing with the tree itself on the
  same screen." Check `01-empty-state-seed-tree.md`'s outcome first.

**For (a) — leaf as the habit default icon:**
- `components/HabitIcon.tsx`. `HABIT_ICON_NAMES` already contains `'leaf-outline'` as a
  *pickable* Ionicon — note that is a different thing from the motif. The neutral default is
  `'ellipse-outline'`, chosen deliberately: "a star implies reward, against the app's tone."
  A leaf carries the app's own brand vocabulary and no reward implication, so it is arguably a
  better default than a plain ellipse — but the reason the default isn't *rendered* is the
  duplicate-circle problem, and a leaf shape solves that (it is not a circle next to a circle).
  Read `hasChosenHabitIcon()`'s own comment before changing its behaviour.

**Sizing.** Design says 18–24px. `constants/theme.ts` owns the tap-target tokens — if the leaf
becomes a *button*, the touch area must reach `MIN_TAP_TARGET` even though the art is 18px.
The rule in `tokens/spacing.css`: "When the VISUAL control is deliberately smaller… don't grow
the art — expand the touch area instead." Use `HitSlop.*`, never a bare `hitSlop: 8`.

---

## What not to do

- **Don't edit `constants/motifs.ts`** — generated. Edit the SVG in
  `assets/decorative/illustrations/` and re-run `node scripts/build-motifs.mjs`.
- **Don't put a leaf on every card.** "One leaf per row/card/button" is the design's own cap,
  and this app's version of that rule is stricter still: `guidelines/decorative-motifs.md` says
  "One 'holder' motif per surface. Don't combine halo-ring + canopy-corner + trunk-divider on
  the same card."
- **Don't use it as a decorative bullet inside body copy.** `Motif.tsx` hard-codes
  `pointerEvents="none"`, so it can never be a target — fine for an accent, wrong for anything
  the user might try to tap.

---

## Verify

1. `npx tsc --noEmit`
2. `scripts/test-changed.sh` — only if you changed `HabitIcon`'s gate (that's behavioural).
   A pure corner-accent add is presentational: `tsc` alone.
3. `npm run preview` — one shot, to confirm the sprig isn't fighting the card's own hue.
4. `npm run wraps -- --lang=no --width=360` — **only for option (a)**, since that adds a
   leading element to a row. Not needed for a corner accent, which is absolutely positioned.

## Close out

Update the `Connections:` blocks on both ends of anything you touched, and
`components/Motif.tsx`'s `Used by →` line. Commit, PR into `main`, merge.
