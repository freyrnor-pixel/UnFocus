# 02 — Port the missing fourth growth stage

**Size:** S (asset transfer + regenerate) · **Blocked by:** nothing · **Blocks:** 03, 05

Read `00-INDEX.md` first if you haven't.

---

## The decision

The design system ships **four** growth stages — seed → sprout → sapling → **full**. The repo
has three. `assets/decorative/illustrations/README.md` records it plainly:

> **`tree-natural-full-*` is missing** — the fourth and largest stage was not transferred.

The design project has both halves of the pair:
`assets/decorative/tree-natural-full-light.svg` and `tree-natural-full-dark.svg`.

The full stage is the one that carries the canopy *and* the halo ring — i.e. it is the stage
that actually looks like the logo. A growth ladder whose top rung is missing tops out at
"partial canopy" and never resolves.

**Pick one:**

- **(a)** Port it in — fetch both SVGs, drop them in `illustrations/`, regenerate
- **(b)** Live with three stages and re-band the thresholds so `sapling` is the ceiling
- **(c)** Skip — decide it in 03 instead, once the binding is chosen

*Recommendation: **(a)**, and do it before 03.* It is a mechanical transfer, and doing it
after 03 means re-tuning whatever thresholds 03 lands on.

---

## What to touch

**Step 1 — fetch the two files.** This is one of the few tasks that genuinely needs the design
project. Exact paths:

```
DesignSync get_file  projectId=ec3299ab-36de-4990-9d47-c1a3e7a0b321
  path=assets/decorative/tree-natural-full-light.svg
  path=assets/decorative/tree-natural-full-dark.svg
```

Write them to `assets/decorative/illustrations/tree-natural-full-{light,dark}.svg`.

**The subdirectory is load-bearing — do not put them in `assets/decorative/` directly.**
`assets/decorative/illustrations/README.md` explains why, and it is not a style preference:

> `scripts/build-motifs.mjs` globs `assets/decorative/*-light.svg` — non-recursively — and
> would otherwise pick these up and fail. It does fail on contact.

**Step 2 — regenerate.** `node scripts/build-motifs.mjs`. It reads `illustrations/` as a
second source dir with `tintable: false`. The generator decides colour handling by counting
distinct colours per file:

- one colour → tintable motif, colour dropped, consumer passes a theme token
- many → an illustration, which gets a `pal` (index-aligned light/dark colour pairs)

The trees carry nine colours (bark fill/stroke, canopy wash, a five-step leaf ramp, a ground
shadow), so `tree-natural-full` will land as an illustration with a `pal`, exactly like its
three siblings. **Never hand-edit `constants/motifs.ts`** — it says so in its own header, and
hand edits are lost on the next run.

**Step 3 — the guards that will bite.** Two generator assertions and one test, all of which
exist for good reasons and none of which should be loosened:

- `a file uses the other theme's colour — check the export` — thrown when the light and dark
  files share a hex from the tintable pair. Legitimate for an illustration (its palette may
  coincide), and the generator already carves out that case; if it fires, the export is wrong,
  not the guard.
- `sits in the tintable folder but uses N colours — move it to illustrations/` — you put the
  file in the wrong directory. See step 1.
- `lib/__tests__/motifs.test.ts` has a `describe('colour is carried one of exactly two ways')`
  block. A new illustration must satisfy it as an illustration. If it fails claiming an
  ellipse role, re-read the README's point 3 — the ground shadow under each tree is an
  unrotated ellipse, and the seed/sprout/sapling files already solved this. Match whatever
  they do rather than inventing a new role.

Geometry must be **identical** between the light and dark file — differing colour is the whole
point, differing geometry is an error the generator catches.

---

## What not to do

- **Don't mount it anywhere.** That is task 03's decision. This task ends with the asset
  available and the pipeline green. Adding a speculative mount here means 03 starts by
  removing it.
- **Don't touch the four tintable motifs** (`empty-branch`, `trunk-divider`, `halo-ring`,
  `onboarding-triptych`, the backdrops). The generator keeps their entries byte-identical to
  what it produced before illustrations existed — a diff there means something regressed.

---

## Verify

1. `node scripts/build-motifs.mjs` — must exit clean.
2. `npx tsc --noEmit` — `MotifId` is a union type; the new id widens it.
3. `scripts/test-changed.sh` — `lib/__tests__/motifs.test.ts` will run. Report it explicitly.
4. **Check the diff on `constants/motifs.ts`**: it should be *additive only*. One new
   `'tree-natural-full'` entry. If any existing entry moved or changed, stop and find out why
   before committing.

No `npm run preview` — nothing renders it yet.

## Close out

Update the table in `assets/decorative/illustrations/README.md` (it lists three stages and
says the fourth is missing — both stop being true). Then commit, PR into `main`, merge.

---

## Outcome — **(a) shipped**, 2026-08-04

The fourth stage is in: `assets/decorative/illustrations/tree-natural-full-{light,dark}.svg`,
554 elements, compiled into `constants/motifs.ts` as `tree-natural-full`.
`lib/__tests__/motifs.test.ts` passes (62 tests), and the `constants/motifs.ts` diff is
additive only — one new entry, no existing motif touched.

**This task's earlier close-out — "cannot be fetched from here; DesignSync requires an
interactive `/design-login`" — was wrong about the conclusion, not about the tool.** The tool
really is unusable from a remote session. But the art was never only in the design project:
the maintainer's uploaded `UnFocus_Design_System_1.mht` carries it as MIME part 51, and parts
52/53/54 of that same file byte-match the repo's existing sapling/sprout/seed art, which is
what identified it. **Check the upload before declaring a design asset unobtainable.**

Only the **light** file was recovered; the dark twin was derived mechanically, not hand-picked:

- All three existing pairs (`seed` 12 elements, `sprout` 49, `sapling` 219) are byte-identical
  in geometry *and* in every `opacity` attribute, and all three agree on the same 1:1,
  9-entry light→dark colour map — verified by zipping each pair element-wise rather than by
  trusting the map already written in the README.
- Every one of the 9 colours in `tree-natural-full-light.svg` is covered by that map, with
  nothing left over. So the dark file is a pure token substitution.
- **The substitution must be ONE pass.** The map is chained — `#1E3A6B → #3B6BC4 → #5C8FD9 →
  #7FA8E8` — so a sequence of string replaces cascades a colour through three steps and
  silently produces wrong art. A single regex pass with a lookup is the only safe shape.
- Post-check: stripping every hex from both files leaves byte-identical skeletons, so the
  geometry provably did not move.

The README's note not to author a substitute stands and was not needed — this is the real
asset, and the "if the maintainer ever transfers the light file, the port is a two-file drop
plus `node scripts/build-motifs.mjs`" prediction held exactly. No generator work; PR #481 had
already taught the pipeline full-colour illustrations.

It is no longer an unmounted asset either — see 03.
