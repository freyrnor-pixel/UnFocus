# 07 — The card edge: gradient identity hue vs flat hairline

**Size:** S · **Blocked by:** 06 · **Scoped to CARDS — see 16 for everything else**

Read `00-INDEX.md` first if you haven't, and check 06's recorded decision before starting.

> **Scope split.** Maintainer note 2026-08-04: *"Buttons, icons, cards and many other things
> still lack a border."* This file owns **cards only**. Buttons, icon buttons, chips, the FAB
> and the "hard, solid, pressable" material direction are `16-solid-pressable-materials.md`.
> Read 16's §2 before starting either — it explains why "solid" is *not* a licence to raise the
> matte finish back toward gloss, which `__tests__/glassMaterial.test.ts` blocks.

---

## The decision

**What the app draws.** `components/Surface.tsx` computes the card edge from a priority chain:
an explicit `borderColor` (an identity-coded card) → `tint` → `theme.border`. The Home cards
pass their identity hue: `components/HomeNotesCard.tsx` does `borderColor={domainColor.accent}`.
The edge is drawn as a **`LinearGradient` fill clipped by `borderRadius`** — lighter at the
top, darker at the bottom, in the edge hue — not a plain 1px border. Surface's header explains
why: a gradient fill clipped by radius renders correctly on every platform, where a
three-colour View border does not.

**What the design draws.** Flat, single-colour, no gradient. But the design **contradicts
itself** across two files:

- `ui_kits/unfocus_app/HomeScreen.jsx` → `border: '1.5px solid var(--c-border-strong)'`
  (`#2B5FD9` — a saturated blue) on every card
- `components/surfaces/HabitCard.jsx` → `border: '1px solid var(--c-border)'`
  (`#7284A2` — a neutral slate)

So "what the design does" is not a single answer, and you have to choose rather than port.

**Pick one:**

- **(a)** Keep the identity-hue gradient edge as-is
- **(b)** Flat **1px `theme.border`** on every card — one neutral hairline, identity moves
  entirely to the badge/stripe
- **(c)** Flat **1.5px `borderStrong`** on every card
- **(d)** Keep the gradient, but drop it to a single flat identity hue (no light→dark ramp)

*Recommendation: **(b)** if "cleaner borders" is the goal.* One consistent hairline is what
reads as tidy; four hue-shifted gradients at four different lightnesses is what reads as busy.
**Avoid (c)** — `#2B5FD9` at 1.5px is a loud blue frame around every card on the screen, and
`borderStrong` in this palette is meant for emphasis, not for the default state of everything.

⚠️ **(b) has a cost you must price in.** Identity hue currently appears in exactly two places
— the gradient badge and the card edge. Removing it from the edge leaves the badge as the sole
carrier. If 08 does **not** add a stripe, (b) means each card has one small round badge and is
otherwise identical to its neighbours. Decide 07 and 08 together, or run 08 immediately after.

---

## What to touch

`components/Surface.tsx` is the single choke point — all card edges resolve through it. Read
its header before editing; the relevant machinery:

- `edgeHue = borderColor ?? tint ?? theme.border` — the priority chain
- `EDGE_WIDTH` and the gradient-vs-border comment block around lines 168–172 and 291–330
- The two-layer structure: outer view = border + `getLayeredShadow`, inner `overflow:'hidden'`
  mask = the fill. **Keep that split** — it exists so shadows aren't clipped.

The cleanest shape for (b) is to stop the Home cards passing `borderColor`, rather than to
special-case inside Surface. Callers to check: `HomeNotesCard`, `HomeHabitsCard`,
`HomeShoppingCard`, `PlanTaskCard`, `WeekListCard`, `MedicineTrayCard` — the same set listed in
`components/CardAccent.tsx`'s `Used by →`.

---

## Landmines

- **Surface silently drops border/background keys passed via `style`.** Its own header says so,
  and `components/PadSheet.tsx` repeats the warning: it draws rules as child views *inside* the
  card, "never as border styles on a Surface's `style` — Surface silently drops every
  border/background key you pass it". If your change appears to do nothing, this is why.
- **`--c-rule` is not a border.** `#D3DBE6`, 1.396:1 on surface, "deliberately BELOW the 3:1
  control-boundary floor… Never use for an input outline, card edge, chip border or focus ring."
  It is the notepad row divider only. Don't reach for it to make the edge softer.
- **`theme.border` (`#7284A2`) is contrast-tuned**: 3.128:1 on bg, 3.792:1 on surface, clearing
  WCAG 1.4.11. It is the correct token for a control boundary. `colors.test.ts` gates it.
- **The matte finish is settled — don't reopen it.** From `AGENTS.md`'s row-rule section:
  "there is no specular highlight any more (removed — it read as gloss;
  `__tests__/glassMaterial.test.ts` asserts the token is GONE, not merely dimmed). The face lift
  is 10% white gone by 42% plus a 4% bottom shade; the rim is a flat white .22 that stops at
  12%. Don't raise these back — that is exactly the 'too glossy, too rounded towards the user'
  state the maintainer rejected." A border change must not become a material change.
- **Radius is 16 (`Radius.md`), not 18.** Nudged on 2026-07-18 for a calmer corner. The design's
  token file agrees. Don't reintroduce 18.

---

## Verify

1. `npx tsc --noEmit`
2. `scripts/test-changed.sh` — `__tests__/glassMaterial.test.ts` guards the material; if you
   touched `Surface.tsx` it should run. Report it by name.
3. `npm run preview` — **required.** This is a pure-appearance change; the only real test is
   looking at it. Check **both themes** — `border` and `borderStrong` sit at different
   lightnesses per mode, and a hairline that reads crisp on white can vanish on `#1B2438`.
4. Look at a screen with several cards stacked (Home) rather than one card alone. The
   difference between (a) and (b) only shows up in aggregate.

## Close out

Update `Surface.tsx`'s header if the edge-colour chain changed, and every caller whose
`borderColor` prop you removed. Commit, PR into `main`, merge.
