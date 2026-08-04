# Illustrations — full-colour art, NOT tintable motifs

Imported from the "UnFocus Design System" Claude Design project (2026-08-04).

**Only `tree-natural-seed` is mounted** (components/StarterCard.tsx's empty-state watermark,
2026-08-04). The rest is source art parked here pending a decision on how it should ship —
and for the trees, that decision has now been taken and is "not as a stage binding" (see the
bottom of this file). Read this before wiring one up.

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
| `tree-natural-{seed,sprout,sapling}-{light,dark}.svg` | 300×340 | 3 of the 4 growth stages; `seed` is **mounted** (components/StarterCard.tsx) as of 2026-08-04 |
| `leaf-icon-{light,dark}.svg` | 24×24 | single leaf, for inline UI use |
| `leaf-sprig-{light,dark}.svg` | 32×64 | small stem of leaves |

**`tree-natural-full-*` is missing** — the fourth and largest stage was not transferred, and
as of 2026-08-04 it **cannot be fetched from here**. `DesignSync` requires an interactive
`/design-login`, which a Claude Code remote session has no terminal for; the tool returns an
authorization error rather than the file. The asset has also never existed in this repo's
history (`git log --all --diff-filter=A` over this directory shows only the seed/sprout/sapling
pairs, added in #480), so there is nothing to recover locally either.

**This is not blocking anything, and that is the point.** The two tasks that wanted it —
a stage tree bound to habit streaks, and an illustrated hero backdrop — were both declined on
their own merits (see the non-adoption note at the bottom of this file, and
`components/ScreenBackground.tsx`'s header). With no consumer, the ceiling of the ladder is
`sapling` and nothing tops out early. Do **not** author a substitute: inventing a fourth stage
would put non-design-system geometry into `constants/motifs.ts` under the design system's name,
and a wrong tree is worse than a missing one. If the maintainer ever transfers the light file,
the dark twin can be derived from the substitution map below and the port is a two-file drop
plus `node scripts/build-motifs.mjs` — the pipeline already declares `illustrations/` as a
second, `tintable: false` source dir and needs no generator work.

The light→dark relationship is a pure hex substitution over identical geometry (verified
byte-exact on the seed and sprout pairs), so a dark variant can always be regenerated from
its light twin rather than transferred separately. The map, leaf ramp shifting one step
lighter in dark mode:

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

**Deliberately NOT adopted** (maintainer's call, 2026-08-04): the card also proposed binding
canopy fullness to Energy `current / capacity`, growing a tree over a focus session, and
advancing stage on habit streaks. That contradicts `lib/growth.ts` — growth here is
numberless, backdrop-only, and must never read as a reward firing off a tap. The art was
taken; the bindings were not. Don't reintroduce them from the guideline card.
