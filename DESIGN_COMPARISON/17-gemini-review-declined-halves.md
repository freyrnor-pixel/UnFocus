# 17 — The outside review's two declined proposals, and why

**Size:** none (record only) · **Status:** ruled on 2026-08-10 · **Not a task — do not implement**

This file exists so the same two proposals don't get re-argued from scratch. An outside design
review (Gemini) was asked to critique the app's visuals and returned five rules. Three were
acted on; **two were declined by the maintainer**, and both are the kind of proposal that looks
obviously right to anyone reading the app cold — which is exactly why they will come back.

The review was given screenshots and no history. It was advising against a version of the app
that predates the 2026-07-30 row pass and the 2026-08-05 card reset, so neither declined item
is a mistake on its part; it simply could not know what it was reversing.

---

## 1. "Make the checkbox the leading element" — DECLINED

**Proposed:** a strict `leading action (checkbox) → content → trailing action` row anatomy,
citing Material Design's established pattern so the user doesn't have to scan to find the
interactive element.

**Why declined:** the app deliberately moved every check to the RIGHT margin on 2026-07-30, on
the maintainer's own instruction, and applied it app-wide — `PadRow`, `TaskCard`, `ShoppingRow`
and the four Home cards all agree. The reasoning was that a paper checklist puts its ticks in
the right margin. Moving them there is also what let the notepad rules run the full line
instead of being inset past a check column (`ROW_DIVIDER_INSET`, deleted in the same pass), and
`DESIGN_COMPARISON/12-check-position-confirm.md` is the confirmation of that call.

**What survives from the proposal, and it is the substantive part:** the demand for ONE strict
left-to-right anatomy app-wide. That is already implemented — `components/PadRow.tsx` is
`[leading?] → title/meta → right value → ⋯ action → check` and nothing deviates from the
ORDER. Only the check's side differs from the review's version.

**The real remaining gap is not this.** `app/(tabs)/shopping.tsx` (`ShoppingRow` /
`MonthlyTableRow`) and `app/(tabs)/plans.tsx`'s `TaskCard` still don't route through `PadRow` at
all — they hand-roll a compatible anatomy. That conversion is tracked in AGENTS.md's row rule
and is the thing worth doing; flipping the check is not.

---

## 2. "Remove borders from structural layout containers" — DECLINED

**Proposed:** reserve the solid accent fill for the single primary action, use outlined buttons
for secondary actions, and **strip borders entirely from structural containers** (the Monthly
block was named), on the grounds that when everything has a border nothing stands out and
whitespace should frame content instead.

**Why the border half was declined:** it reverses the 2026-08-05 card-design reset, which was
the maintainer's own brief, in as many words — *"Borders around cards, buttons, text-boxes,
options and so on for separating them."* That reset **overruled `DESIGN_RULES.md` rule 5**
("whitespace over lines"), which is the rule the review is independently re-deriving. Borders
are the app's grouping signal now; `lib/screenColor.ts`'s revival, `computeBorderRamp`'s
card → field → button weight ladder, `PadSheet`'s boxed rows and `lib/__tests__/borderRamp.test.ts`
all exist downstream of that decision. Stripping container edges would not be a tweak.

Note the reset kept the half of rule 5 that matters: **dividers are gone.** The app separates
with *boundaries*, never with *lines between things*. The review read the borders as clutter
because it could not see that they replaced something noisier.

**The CTA half WAS acted on**, on 2026-08-10 — see the four add triggers now going through
`components/Button`'s ghost/secondary variants, and `app/share-modal.tsx`'s stacked double
fill. The fix there is weight, not edges, which is the same conclusion the 2026-08-09 Shopping
pass reached independently.

---

## What was acted on, for completeness

- **Dark palette** → adopted, and it is the largest change in the set. See
  `COLOR_THEME_LIBRARY.md`'s "Dark mode is TRUE BLACK" section and `DESIGN_RULES.md` rule 10a.
  The review's LIGHT values were declined on measurement: its border is 1.18:1 and its
  `bg`↔card 1.05:1, which would have erased the very border system item 2 above protects.
- **One segmented control** → the three toggles it named were already consolidated
  (2026-08-09). Seven remaining hand-rolled exclusive pickers were converted; multi-select
  chip rows and `app/onboarding/basics.tsx` stay, for reasons recorded at those call sites.
- **Clean data entry / micro-copy** → already shipped 2026-08-09, before the review was read:
  "Card" + "Just for this one." became "Card style", all 14 `FieldDivider`s were deleted, and
  every composer field became bordered, filled and focus-showing.
