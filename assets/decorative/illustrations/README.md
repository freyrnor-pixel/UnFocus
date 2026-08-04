# Illustrations — full-colour art, NOT tintable motifs

Imported from the "UnFocus Design System" Claude Design project (2026-08-04).

**All four growth stages and both leaf marks are mounted** as of 2026-08-04 — see "Where each
file renders" below. The trees ship as **ambient scenery, not as a stage binding**; that
distinction is the whole design and the bottom of this file says why. Read it before wiring
one up.

## Why they are in a subdirectory

`scripts/build-motifs.mjs` globs `assets/decorative/*-light.svg` — non-recursively — and
would otherwise pick these up and fail. It does fail on contact: `leaf-sprig-dark.svg`
contains `#3B82F6`, which the generator's cross-contamination guard reads as "a file uses
the other theme's colour". This directory keeps them out of that glob.

## Why they can't go through the motif pipeline as-is

`constants/motifs.ts` is deliberately **colourless** — geometry plus a light and a dark
opacity, no hex, so the consumer passes a theme token and a backdrop can be recoloured per
tab from `lib/screenColor.ts`. That rests on three assumptions these files all break:

1. **One colour per file.** The trees carry nine: bark fill/stroke, a soft canopy wash, a
   five-step leaf ramp, and a ground shadow. The leaf motifs carry a separate four-step
   Tailwind-blue ramp. Representing them means baking a palette into `motifs.ts` — i.e.
   putting raw hex in the constants file the generator exists to keep hex out of.
2. **`<path>` means a stroked line.** The parser assigns every path `role: 'stroke'` and
   reads `stroke-width`, discarding `fill`. Every leaf here is a *filled* path with no
   stroke, so it would render as a 1px hairline. Needs a new filled-path element type.
3. **Every `<ellipse>` is a canopy daub.** `lib/__tests__/motifs.test.ts` asserts that both
   ways round. The ground shadow under each tree is an unrotated ellipse — truthfully
   labelling it (`ground`) fails that test; labelling it `canopy` makes the role map lie.

The closer existing precedent for full-colour illustration is `assets/bg-light.png` /
`bg-dark.png` — the watercolour tree hero — which ships as a flat image, not as geometry.

## What is here

| file | size | notes |
|---|---|---|
| `tree-natural-{seed,sprout,sapling,full}-{light,dark}.svg` | 300×340 | all 4 growth stages (12 / 49 / 219 / 554 elements) |
| `leaf-icon-{light,dark}.svg` | 24×24 | single leaf, for inline UI use — **tintable** |
| `leaf-sprig-{light,dark}.svg` | 32×64 | small stem of leaves — carries a fixed blue `pal`, **cannot be tinted** |

## Where each file renders

| motif | mounted at |
|---|---|
| `tree-natural-seed` | `components/StarterCard.tsx`'s watermark — the default `stage`, and the floor |
| `tree-natural-sprout` | the same card, from `app/(tabs)/habits.tsx` (the app's largest empty state) |
| `tree-natural-sapling` | the same card, from `components/EnergyMeter.tsx`'s tutorial state |
| `tree-natural-full` | `app/(tabs)/habits.tsx` — ambient, standing on the backdrop at the foot of the column |
| `leaf-icon` | `components/HomeHabitsCard.tsx`'s corner accent; `components/HabitLeading.tsx`'s row-leading mark |
| `leaf-sprig` | nowhere — its fixed blue reads as a foreign object on the green Habits surface |

Every tree mount goes through **`components/StageTree.tsx`**, which owns the stage→motif map,
the idle sway and the reduced-motion freeze. Don't call `Motif` with a `tree-natural-*` id
directly; you would be re-implementing that and losing the sway.

### `tree-natural-full` — recovered 2026-08-04

This file previously recorded the fourth stage as missing and **unfetchable** (`DesignSync`
needs an interactive `/design-login`, which a remote session has no terminal for). The tool
limitation was real; the conclusion was not. The art was in the maintainer's uploaded
`UnFocus_Design_System_1.mht` all along, as MIME part 51 — identified because parts 52/53/54 of
the same upload byte-match this directory's existing sapling/sprout/seed art. **Check the
upload before declaring a design asset unobtainable.**

Only the light variant was recovered; the dark twin was derived mechanically with the map
below, and the derivation was re-verified from the files rather than taken from this README:
all three pre-existing pairs are byte-identical in geometry *and* every `opacity`, all three
agree on the same 1:1 map, and every colour in `tree-natural-full-light.svg` is covered by it
with nothing left over. **Substitute in ONE pass** — the map is chained (`#1E3A6B → #3B6BC4 →
#5C8FD9 → #7FA8E8`), so sequential string replaces cascade a colour through three steps and
produce wrong art silently. Stripping every hex from both files afterwards left byte-identical
skeletons, which is the proof the geometry did not move.

The standing advice not to **author** a substitute stands: inventing a stage would put
non-design-system geometry into `constants/motifs.ts` under the design system's name, and a
wrong tree is worse than a missing one. Recovering one from the upload is a different thing.

The light→dark relationship is a pure hex substitution over identical geometry (verified
element-wise on all three original pairs, and on `full` after generation), so a dark variant
can always be regenerated from its light twin rather than transferred separately. The map,
leaf ramp shifting one step lighter in dark mode:

| role | light | dark |
|---|---|---|
| bark fill / leaf vein | `#2B2116` | `#5A4632` |
| bark texture stroke | `#6B5A44` | `#8A7355` |
| canopy wash | `#9DBCE8` | `#5A82C9` |
| leaf ramp 1 … 5 | `#1E3A6B` `#2F5FA8` `#3B6BC4` `#5C8FD9` `#7FA8E8` | `#3B6BC4` `#4C7BD6` `#5C8FD9` `#7FA8E8` `#9BC0F0` |
| ground shadow | `#20180F` | `#0A1020` |

## Design constraints that come with this art

From the design project's "Natural tree & focus guidance" card — these are the art's own
rules, and they were accepted; the *bindings* it proposed were not:

- **Floor at seed, never bare.** No dead or leafless-in-decline state.
- **Stage, not a slider.** Snap to the four stages; only animate between them.
- **One tree per screen**, and one leaf icon per row — never both competing.
- **Recolour, don't redraw** — swap the ramp, keep the geometry.
- Idle sway ±1.1° over ~6s; stage transitions 600–900ms; freeze under reduced motion.

All five are honoured by `components/StageTree.tsx`, which is the only thing that mounts a
tree — read its header before adding a mount.

**Deliberately NOT adopted, and this survived a re-litigation** (2026-08-04, design comparison
task 03): the card also proposed binding canopy fullness to Energy `current / capacity`,
growing a tree over a focus session, and advancing stage on habit streaks. That contradicts
`lib/growth.ts` — growth here is numberless, backdrop-only, and must never read as a reward
firing off a tap.

**Note carefully that this is not one of the "the design system wins over a repo decision"
reversals**, and don't reopen it on that basis. The design project's *own readme* declines
these three by name — *"the art was accepted; the bindings were not"* — so both sides agree
and there is nothing for a tie-break to decide. What both sides allow is the guideline card's
fourth candidate, **"Ambient (decorative) — no data bound. Plain backdrop use, sway only, no
fill logic"**, and that is exactly what shipped: `stage` is a call-site layout choice, and
`StageTree` deliberately has no data prop and cannot reach a store.

**"Recolour, don't redraw" is currently not possible**, and that is a known gap rather than an
oversight: these are illustrations with a baked `pal`, and `components/Motif.tsx` ignores the
`color` prop for those. Per-domain tree colour would need a generator change, not a prop.
