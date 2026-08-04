# 05 — The screen backdrop: leaf style vs abstract line

**Size:** M · **Blocked by:** 02 · **⚠️ Re-treads rejected ground — read the history first**

Read `00-INDEX.md` first if you haven't.

---

## The decision

The design project ships three per-screen-type backdrops:

> - `screen-bg-calm-{light,dark}.svg` (390×844) — minimal halo + thin branch, for
>   settings/detail/profile.
> - `screen-bg-grow-{light,dark}.svg` — fuller branch + canopy nodes, for home/hub screens.
> - `screen-bg-list-{light,dark}.svg` — vertical trunk along the right edge, for scrollable
>   lists — the branch runs alongside vertical scroll.

with an **edge continuity rule**: every screen-bg file crosses the left edge at y=660 and the
right edge at y=600, "what makes adjacent screens look like one continuous line rather than
three unrelated backgrounds."

And the natural-tree card proposes the illustrated tree as a straight swap:

> Plain backdrop use — sway only, no fill logic. This is the direct drop-in replacement for
> today's `screen-bg-grow`/`holder-blob` on hero surfaces.

**The app has already tried and rejected the per-screen version.** `components/ScreenBackground.tsx`:

> **Reverted 2026-07-31** back to this corner-branch design after a same-day detour through a
> `constants/motifs.ts`-driven continuous five-panel tree strip (`screen-bg-strip`/`screen-bg-calm`,
> PR #449) — that version didn't read as a settled backdrop while swiping (the strip motion
> fought the pager's own swipe feel) and is out.

`app/(tabs)/_layout.tsx`'s `panelPosition` plumbing was reverted with it. `screen-bg-strip` is
still in `constants/motifs.ts` and still tested, but **nothing mounts it**.

**Pick one:**

- **(a)** Leave the backdrop alone — this was tried, it failed for a real reason
- **(b)** Keep it static and single-field, but redraw the corner branches in the illustrated
  leaf style instead of the abstract line style
- **(c)** Retry per-tab backdrops with the continuity rule properly applied

*Recommendation: **(a)** or **(b)**. Not **(c)**.* The 2026-07-31 revert was not about the art
being wrong — it was about motion: a backdrop that slides with the pager fights the swipe. The
continuity rule doesn't address that, so (c) re-runs a known failure with a nicer picture.

---

## If you pick (b) — the only genuinely new option

The current backdrop is **not a motif**. It is one hand-authored `react-native-svg` canvas
inside `ScreenBackground.tsx`: a linear gradient base, two radial glows, and tapered
branch-and-leaf line paths in a 280×607 viewBox, `preserveAspectRatio="xMidYMid slice"`.
Option (b) means replacing those branch paths with leaf-style geometry — not swapping a motif id.

**Three things in that file are load-bearing and must survive the change:**

1. **The corners stay clear of centre.** "The branches are kept in the corners on purpose so
   nothing sits centre-screen where cards/content live." The motif system's version of the same
   rule is a tested invariant — `lib/__tests__/motifs.test.ts` pins a protected centre box
   (x 84–306, y 236–612 per panel) and asserts nothing paints inside it. If you author new
   geometry, respect it; `constants/motifs.ts`'s header says to keep growth strokes out of
   x 60–220, y 170–440.

2. **This file is also the reward surface.** `GROWTH_STROKES` adds branches around the border
   as `level` rises, from a **high-water mark** — "branches that grew stay grown — nothing here
   can un-grow." And the whole cluster crossfades toward green as `intensity` rises, with
   neutral as the floor: "a lapsed streak returns the app to exactly the backdrop it always
   had, never to a worse-looking one." Redrawing the branches means redrawing the growth
   strokes to match, or the reward branches will be in a different visual language from the
   base art.

3. **The tint is a two-copy opacity crossfade, not an animated colour.** The cluster is drawn
   twice — neutral underneath, green on top at `intensity` — "because opacity is the one SVG
   prop that is reliably animatable through Reanimated on both native and the web." Don't
   "simplify" that into an animated `fill`; it will silently stop animating on one platform.

Also: a `level` change is deliberately **un-animated** ("it's derived from a streak that turns
over between sessions, so nobody is watching"). Only the tint animates, at `Duration.ambient`
(2400ms). Keep that split.

---

## If you pick (a)

Close it as a documented decision, not silence. Add a line to `ScreenBackground.tsx`'s header
noting that the design system's `screen-bg-grow`/`screen-bg-list` set was reviewed on
2026-08-04 and declined for the same reason PR #449 was reverted — so the next session doesn't
rediscover the design project and re-propose it. That is the entire deliverable.

Consider also deleting the dead `screen-bg-strip` entry, or explicitly noting it as retained
source art. Right now it is generated, tested, and mounted nowhere, which reads as an
oversight rather than a decision.

---

## What not to do

- **Don't re-add `panelPosition` to `app/(tabs)/_layout.tsx`.** That plumbing was deliberately
  reverted.
- **Don't put the backdrop behind the pager *and* a hero tree on Home.** "One tree per screen"
  — coordinate with `03-where-the-tree-appears.md`, whose option (b) claims the same layer.
- **Don't raise the opacity budget.** Fills 0.1–0.3, strokes 0.4–0.85. `Motif.tsx`: "Multiplying
  above 1 breaks it — the prop is clamped for that reason."

---

## Verify

1. `npx tsc --noEmit`
2. `scripts/test-changed.sh` — `lib/__tests__/motifs.test.ts` if any motif data changed.
3. `npm run preview` — required for (b), and check **both themes**: branch palette and glow
   strength are per-theme, so light looking right proves nothing about dark.
4. Check it while *swiping* between tabs, not just as a static shot. The 2026-07-31 revert
   happened because a still frame looked fine and the motion didn't.

## Close out

Commit, PR into `main`, merge.
