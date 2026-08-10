# 08 — The 4px left accent stripe, and what it replaces

**Size:** S · **Blocked by:** 06, 07 · **Run right after 07 — they trade off**

Read `00-INDEX.md` first if you haven't.

---

## ✅ OUTCOME — (c), no stripe. **Maintainer ruling, 2026-08-10.** Closed.

**The card keeps ONE border and the badge stays the sole identity carrier.** No code changed.

This re-closes a decision that was only ever half-closed. `DESIGN_RULES_AUDIT.md` item 9 recorded
(c) on 2026-08-04, but that was an **agent** call resting entirely on the interaction table below —
specifically on "07 landed (a), the gradient edge is kept, so a stripe would be a third hue
expression." **That premise expired the next day.** The 2026-08-05 card reset flattened the edge,
then re-ramped it *inside a single screen hue*, and evicted the domain hue from every edge. Nothing
had re-derived item 9 under the new architecture. It is now ruled on directly, by the maintainer,
under the architecture that actually ships.

The reasoning that survives the change of premise:

- The reset's own words are "a card is a flat opaque page with **ONE** border." A stripe is a
  second edge treatment on the one surface that rule is about.
- **The hard blocker is unchanged and is the thing to re-read before reopening this**: a stripe
  alone cannot separate Shopping from Food — both are `#D9A441` in the domain set. The badge's
  per-domain **glyph** is what tells them apart. Any future stripe proposal has to say where the
  glyph lives before it says anything else.
- The horizontal budget is still tight (`npm run wraps`), and 4px comes off every card.

**Proposed again and declined in the same ruling:** a two-tone icon badge (10–15% hue fill +
100% hue glyph). That is the design that shipped on 2026-07-24 and was reverted on 2026-07-26 as
"too colourless" — see `components/CardAccent.tsx`'s edit notes. It also fails on measurement: at a
fixed 12% fill, amber is 2.81:1 in light and sapphire 2.68:1 in dark, both under the 3:1 non-text
floor. A fixed opacity cannot hold across eight hues and two modes, which is what `contrastOn()`
already solves.

**What the ruling did take** from the same proposal: the *palette direction*. The eight `feat*`
screen hues were retuned a step deeper (Tailwind 600/700-family) on 2026-08-10 — see
`constants/colors.ts`. Colour still lives only in the border; there is just more of it to see.

Everything below is the original task file, kept as the record of the argument.

---

## The decision

Every card in the design project is built the same way. From `ui_kits/unfocus_app/HomeScreen.jsx`'s
`CardShell`, and identically in `components/surfaces/HabitCard.jsx`:

```jsx
<div style={{ display:'flex', borderRadius:'var(--r-md)', overflow:'hidden',
              background:'var(--c-surface)', border:'...', boxShadow:'var(--shadow-card)' }}>
  <div style={{ width: 4, alignSelf:'stretch', background: accent }} />   {/* ← the stripe */}
  <div style={{ flex: 1, padding:'var(--sp-md)' }}>{children}</div>
</div>
```

A 4px full-height colour bar down the left edge. **The app has no equivalent.** Its identity
colour move is `components/CardAccent.tsx`:

> A card borrows its identity colour from the four-hue identity set (`lib/domainColor.ts`),
> keyed to its life area, and expresses it as ONE colour move: a gradient icon BADGE. The
> card's own low-alpha edge (Surface's `borderColor`) is the only other place that hue appears.

**A note on history, because it will come up.** `AGENTS.md` says of design-system v6:
"**NOT taken from that spec**: dropping the accent stripe / category-as-a-dot — the gradient
badge, keycap edge and domain ramp stay (maintainer's call, #390/#393/#410)." That records a
rejection of *removing* a stripe. Adding one now is a different question and is not
pre-decided — but the same instinct applies: the maintainer has consistently protected the
gradient badge.

**Pick one:**

- **(a)** Add the 4px stripe, keep the gradient badge
- **(b)** Add the stripe and **drop the gradient badge** — the stripe becomes the one colour move
- **(c)** No stripe — badge stays the sole identity carrier
- **(d)** Stripe only on the Home preview cards, not on full tab screens

*Recommendation: **(b)** if you want the card simpler, **(c)** if you want it unchanged.*

The argument for (b): count the colour moves on a card today under option 07(a) — a gradient
badge, a hue-gradient edge, and (from 09) possibly a coloured count pill. That's three
expressions of the same fact. Add a stripe on top and it's four. A stripe is the most legible
of them — it is tall, it is at a fixed position on every card, and it survives being scanned
peripherally in a way a 32px badge does not.

The argument against (b): the badge carries a **glyph**, and since identity collapsed to four
hues the glyph is what tells two same-hue cards apart. `CardAccent.tsx`: "domains sharing a hue
must keep clearly different silhouettes: shop=cart vs meal=restaurant vs budget=wallet all ride
the Shopping gold". **A stripe alone cannot distinguish Shopping from Food** — both are
`#D9A441`. If you pick (b), the glyph has to survive somewhere, or two gold cards become
indistinguishable. That is a hard blocker, not a nitpick.

Given that, **(a) or (c) are the realistic options**, and (b) only works if you first solve
where the glyph lives. Say which you did in the PR.

---

## Interaction with 07

| 07 outcome | What a stripe does here |
|---|---|
| (a) identity gradient edge kept | Stripe is a **third** hue expression — likely too much. Lean (c). |
| (b) flat neutral hairline | Stripe **restores** the identity signal the edge gave up. Strong case for (a). |
| (c) 1.5px borderStrong | Stripe + a loud blue frame will fight. Lean (c). |

If 07 landed (b), this task is the natural partner and should probably ship.

---

## What to touch

The stripe is a layout change, not a style prop — it needs a flex row wrapper with the bar as
the first child and existing content as the second. Two viable shapes:

1. **In `Surface.tsx`**, as an optional `accentStripe` prop. Every card gets it for free, one
   implementation. Risk: `Surface` is used by far more than cards, and its two-layer structure
   (outer = border + shadow, inner `overflow:'hidden'` mask = fill) is delicate — the stripe
   must live *inside* the mask or it will square off the rounded corners.
2. **In `CardAccent.tsx`**, as a sibling export (`CardAccentStripe`) that cards opt into.
   Narrower blast radius, matches how the badge already ships, but each caller changes.

*Prefer 2* unless you have a reason not to — `CardAccent.tsx` is already the file that owns
"the one colour move", and putting the stripe there keeps the two alternatives side by side.

Callers, from `CardAccent.tsx`'s `Used by →`: `HomeShoppingCard`, `HomeNotesCard`,
`HomeHabitsCard`, `PlanTaskCard`, `WeekListCard`, `MedicineTrayCard`, `SectionRail`,
`SubScreenLinkButton`, `app/(tabs)/health.tsx`, `app/(tabs)/shopping.tsx`.

**Which hue?** Whatever 06 decided. Don't re-litigate it here.

---

## Landmines

- **`overflow: 'hidden'` and the corner mask.** A full-height bar at a rounded card's left edge
  must be clipped by the same mask as the fill, or it will render as a square-cornered tab
  sticking out. `Surface` already has the mask; put the stripe inside it.
- **Surface drops border/background keys from `style`.** Documented in its header and repeated
  in `PadSheet.tsx`. If the stripe "doesn't appear", check this first.
- **The stripe costs 4px of horizontal room** on a screen where `npm run wraps` already found
  chrome stacking badly: "three nested 16px paddings plus an icon gutter left text 306 of 393px".
  4px is small but it is on the wrong side of a known-tight budget.
- **`PadSheet` rules run the full card width.** A stripe changes where "full width" starts.
  Check a ruled card (Home Notes) — the rules must meet the stripe cleanly, not float 4px short
  or run underneath it.

---

## Verify

1. `npx tsc --noEmit`
2. `scripts/test-changed.sh` — `__tests__/glassMaterial.test.ts` if you touched `Surface.tsx`.
3. `npm run preview` — **required**, and look at Home specifically, where four cards stack.
4. `npm run wraps -- --lang=no --width=360` — **required.** You just took 4px off every card's
   content width. This is exactly the "clipped controls" / "near-miss wrapped text" class the
   audit exists for.

## Close out

Update `CardAccent.tsx`'s header — its opening line says the identity colour is expressed as
"ONE colour move: a gradient icon BADGE", which stops being true. Commit, PR into `main`, merge.
