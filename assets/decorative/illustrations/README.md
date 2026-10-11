# Illustrations — full-colour art, NOT tintable motifs

Only `leaf-icon-{light,dark}.svg` is left here (2026-10-11): it is what `components/HabitLeading.tsx`
draws. The tree growth stages, the leaf sprig and the other ornaments were deleted once nothing
drew them — git history has them.

This folder stays separate from `assets/decorative/` because files here carry their own colours
(a `pal` in `constants/motifs.ts`), while the parent folder's motifs are colourless and tinted by
the consumer. `scripts/build-motifs.mjs` reads both and refuses a multi-colour file in the
tintable folder.
