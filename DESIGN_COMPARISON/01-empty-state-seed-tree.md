# 01 — Seed tree instead of the bare branch in empty states

**Size:** XS (one component, one prop) · **Blocked by:** nothing · **Needs preview:** yes, one shot

Read `00-INDEX.md` first if you haven't — it carries the shared rules and the verification ladder.

---

## The decision

The design project's `guidelines/natural-tree.card.html` says, of the empty state:

> Old empty-state `empty-branch` is swapped for the seed-stage tree — same "not started yet"
> meaning, on-brand illustration instead of a bare line.

and states the governing rule:

> **Floor at seed, never bare.** The tree has no "dead" or leafless-in-decline state —
> shame-free framing extends to the mark itself. Growth only reads forward.

That reasoning lands squarely on this app's tone: a bare, leafless branch as the mark for
"you have nothing here yet" is the one place the art currently reads as absence rather than
potential. The seed stage says the same thing without the deadness.

**Pick one:**

- **(a)** Swap everywhere `StarterCard` renders — Habits, Plans, Shopping, Health, Goals
- **(b)** Habits only, leave the bare branch elsewhere
- **(c)** Keep the bare branch, close this as declined

*Recommendation: **(a)**.* It's the cheapest visible win in the whole folder — one component,
one motif id — and a per-surface split would mean two different "nothing here yet" marks in
an app whose whole point is that surfaces look alike.

---

## What to touch

`components/StarterCard.tsx` — line 97:

```tsx
<Motif id="empty-branch" color={theme.border} fit="meet" style={styles.branch} />
```

That is the only mount of `empty-branch` in the codebase. Changing this one line changes
every empty-state explainer in the app.

**The catch, and it's the whole task:** `tree-natural-seed` is an **illustration**, not a
tintable motif. `constants/motifs.ts` gives it a `pal` (its own baked light/dark palette);
`empty-branch` has none and takes its colour from the `color` prop. `Motif.tsx` documents
this on the `color` prop:

> Ignored by an illustration (one with its own `pal`), whose colours are its own artwork;
> pass anything, or nothing, for those.

So `color={theme.border}` becomes dead weight on the new id — drop it rather than leave a
prop that silently does nothing. Everything else about the mount (`fit="meet"`,
`pointerEvents` is hard-coded inside Motif) carries over unchanged.

**Sizing.** `empty-branch` and `tree-natural-seed` have different aspect ratios (the seed is
300×340). `styles.branch` was tuned for the branch's proportions — check the watermark
doesn't crop or float. `fit="meet"` keeps it whole, so the failure mode is dead space, not
clipping.

**Opacity.** `StarterCard` draws this as a background watermark under live content. The
illustration's palette is authored at full strength, unlike the tintable motifs whose opacity
budget (fills 0.1–0.3) is baked in. You will almost certainly need `opacity={...}` on the
Motif — it's a whole-motif multiplier, clamped to [0,1]. Judge it from the screenshot; the
text on top must stay comfortably readable.

---

## What not to do

- **Don't edit `constants/motifs.ts`.** It is generated. If the SVG needs changing, edit
  `assets/decorative/illustrations/tree-natural-seed-*.svg` and re-run
  `node scripts/build-motifs.mjs`.
- **Don't add a second mark.** `StarterCard`'s header notes it is deliberately styled with a
  neutral `theme.border` Surface and *not* the accent-barred HintCard look, because on a first
  visit both are on screen at once and twins read as a duplicate. A full-colour illustration
  is a bigger visual event than the line art it replaces — if it starts competing with the
  HintCard above it, the answer is lower opacity, not a redesign of the card.

---

## Verify

1. `npx tsc --noEmit`
2. `scripts/test-changed.sh` — `lib/__tests__/motifs.test.ts` may touch this; report what ran.
3. `npm run preview` — this one genuinely needs eyes. A fresh profile lands on Habits/Plans
   with the StarterCard visible, so the default walk already covers it. Check the shot at both
   themes if you can; the illustration's dark palette is a separate authored file, not a
   filter, so light looking right is no evidence dark does.

## Close out

Update `StarterCard.tsx`'s header (`Imports →` still says "the `empty-branch` watermark") and
`components/Motif.tsx`'s `Used by →` line in the same edit. If you're the first task to run,
also fix Motif's stale EnergyMeter claim — see `00-INDEX.md`'s last section.

Then: commit, PR into `main`, merge it yourself.
