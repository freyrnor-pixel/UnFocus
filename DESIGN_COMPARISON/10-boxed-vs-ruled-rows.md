# 10 — Boxed rows vs ruled rows

**Size:** L · **Blocked by:** nothing · **⚠️ The biggest fork in this folder**

Read `00-INDEX.md` first if you haven't. **Read this whole file before writing code** — the two
options are opposites, and half-adopting produces the worst of both.

---

## The decision

**Design.** Every row is its own bordered box, floating with a gap between it and the next
(`ui_kits/unfocus_app/HomeScreen.jsx`):

```jsx
const rowBoxStyle = {
  borderRadius: 'var(--r-sm)', border: '1px solid var(--c-border)',
  background: 'var(--c-surface-muted)',
};
// rows are laid out in a column with gap: var(--sp-xs)
```

**App.** Flush, gap-free rows sitting on notepad rules, all on one sheet
(`components/PadSheet.tsx`). Its header records where that came from — a direct user report:

> The shared body of every list-bearing card (2026-07-30, user report: "look like notepads",
> "related cards/things in other screens should look practically the same", "the feel of 1, 2,
> 3, everything inside a card is connected and in orderly fashion feels like it's not there").

And the rules were deliberately un-inset in the same pass:

> Rules span the pad's full writing area. They used to be inset 30px… the check moved to the
> right margin in the same pass, so there is nothing left on the left to inset past, and a rule
> that crosses the whole line is what actually reads as paper.

**PR #483 landed yesterday and its title is the argument**: *"Habits: ruled rows on one sheet,
not cards inside a card."* Boxed rows **are** cards inside a card. Going to (b) reverts a
one-day-old, user-driven decision.

**Pick one:**

- **(a)** Keep ruled — the notepad language stays
- **(b)** Go boxed everywhere, per the design
- **(c)** Boxed on Home preview cards, ruled on full tab screens
- **(d)** Keep ruled, but tighten what actually makes the design look crisper (see below)

*Recommendation: **(a)** or **(d)**.* Not **(c)** — the whole reason `PadSheet`/`PadRow` exist is
the user's own "related cards/things in other screens should look practically the same", and
(c) makes Home and its own tab deliberately different. That is the exact complaint being fixed.

**But this is genuinely your call**, and the design does look crisper in isolation. What it is
actually buying is *separation between rows*, and it buys it with a border + a fill + a gap.
Which brings us to (d).

---

## Option (d) — get the crispness without unwinding the notepad

If the design reads cleaner but you don't want cards-inside-cards, the honest diagnosis is that
`--c-rule` is very faint by design: `#D3DBE6`, **1.396:1 on surface**, and
`constants/colors.ts` flags it as intentional:

> DECORATIVE row divider ONLY — deliberately BELOW the 3:1 control-boundary floor… A ruled line
> that shouts is exactly what the notepad look was meant to stop.

So (d) is a small, reversible experiment: nudge row separation up *without* boxing. Candidates,
cheapest first —

1. Slightly more vertical breathing room per row (`PAD_ROW_HEIGHT` is 38px; the min for the
   type line is 44). ⚠️ 38 is already below `MIN_TAP_TARGET` and compensated with hit-slop —
   don't reduce it, and if you raise it, keep the hit-slop math consistent.
2. A marginally less faint rule. It must stay decorative — **not** a control boundary, and not
   `theme.border`, which is the 3:1+ token for actual boundaries.
3. Nothing else. Resist adding a fill behind alternating rows; that is boxing by another name.

(d) is a `constants/theme.ts` + `PadSheet.tsx` change and nothing else. Ship it, look at it,
revert if it's not better. That is a far cheaper experiment than (b).

---

## If you pick (b) — what it really costs

This is not a styling pass. `PadSheet` and `PadRow` are the shared body of every list-bearing
card in the app, and adoption is **partial and uneven** — measured, not guessed (AUDIT.md §0.4.2e):

**Draws through `PadRow` today:** `HomeNotesCard`, `HomeHabitsCard`, `HomeShoppingCard`,
`PlanTaskCard` (the four Home cards), `app/(tabs)/habits.tsx`'s in-file `HabitCard` (2026-08-01),
`components/NoteRow.tsx` (2026-08-01, via the `titleInput` prop).

**Does not:** `app/(tabs)/shopping.tsx` — `ShoppingRow` and `MonthlyTableRow`, hand-rolled and
"much the largest" remaining conversion. `app/(tabs)/plans.tsx` uses `TaskCard` except in the
timeline layout.

So (b) means touching two row systems plus every caller, and the app would be mid-conversion in
*both* directions at once. There is also a documented trap in `AGENTS.md` worth quoting because
it inverts the obvious instinct:

> **The Home cards are the newer code** — don't "fix" a Home card by converting it to match its
> tab; convert the tab.

**Also affected by (b):** `PadSheet`'s spare lines. They are inert blank ruled lines after the
last row — "they exist so a short list still reads as a page rather than as a card that ran
out." Boxed rows have no equivalent; empty boxes would look broken. Deleting them changes how
every short list terminates. Plan for it rather than discovering it.

---

## Landmines regardless of option

- **The row rule is a hard cap:** `[leading?] title → ONE meta line → ONE right-hand value →
  [⋯ action] → [○ check]`. "If a surface wants to show a fifth thing, it goes on the meta line
  or into the detail sheet — not into a third row line." That cap is what keeps rows readable
  at 360px in Norwegian.
- **`hasMetaLine` must mirror the JSX gate exactly.** `PadRow.tsx` and `TaskCard` both warn: if
  the boolean and the render condition drift, a row with exactly one meta item silently loses
  its line.
- **`rightValue` carries `TabularNums`** so a column of times/prices/counts aligns row to row.
  Pass the value only — never a whole node with its own layout.
- **`done` strikes AND fades the whole row** (`DONE_ROW_OPACITY` 0.55), not just the title —
  the shared finished-row treatment across notes, tasks, shopping items and habits.
- **Rows animate open/shut through `components/Collapsible`** (measured-height clip, no fade),
  "so folding a card reads as 'still there, just folded'". Do **not** swap in an opacity fade —
  Collapsible's header says why.
- **`PadSheet` draws rules as child views inside the card**, never as border styles on a
  Surface's `style`, "Surface silently drops every border/background key you pass it."
- **Drag-to-reorder runs over these rows** (`lib/useDragReorder.ts`). Render from the hook's
  `order`, never from the store array, or nothing moves under the finger. Changing row geometry
  changes drag measurement — re-test the gesture. Note the preview can't test gestures; that
  needs a device.
- **`ShoppingRow` has a `React.memo` comparator.** Add any new layout/glow prop to it or a
  change won't repaint the list.

---

## Verify

1. `npx tsc --noEmit`
2. `scripts/test-changed.sh` — for (b), expect a wide blast radius. Report every suite by name.
3. `npm run preview` — **required for any option.** The driver walks all five tabs and creates a
   task/habit/medicine, so the ruled rows are covered. For (b), also drive the shopping list:
   Shop → "Create a new list" → "Start empty" → expand → add an item. That path is reachable
   (the app has zero `Alert.alert` call sites since 2026-08-01), the default driver just
   doesn't walk it.
4. `npm run wraps -- --lang=no --width=360` — **required.** A box adds border + padding per row,
   eating horizontal room in exactly the place the audit already flags chrome stacking.

## Close out

If (a): record the decision so the design project isn't re-proposed later — a line in
`PadSheet.tsx`'s header noting the 2026-08-04 review and why boxed rows were declined.
If (b) or (d): update every touched header, both ends. Then commit, PR into `main`, merge.

---

## Outcome — (a), and one thing it does NOT cover (2026-08-05)

**(a) was taken and still stands.** List rows are flush and ruled on one `PadSheet`; there is
no per-row border, fill or gap anywhere, and `PadSheet.tsx`'s header carries the note.

One later change looks like it crosses this line and does not: **the composer is boxed.**
`components/PadTypeRow.tsx`'s input — the "Type habit"/"Type note" line — is now a real field
with a border, a muted fill and an accent focus border, matching `FormControls.tsx`'s `Input`.

That is not this decision, for a reason worth keeping straight: what (b) proposed was giving
every row its own box so rows would separate *from each other* — cards inside a card, an idea
about the LIST. The composer box is about ONE control, and it is the control you type into.
Before it, focusing the line rendered a bare blinking caret on blank card — no border, no fill,
no focus state, and the prompt layer unmounted on focus too, so there was nothing on screen
saying "your text goes here" (user report, 2026-08-05: *"Not visible where user is typing,
looks unnatural"*). That is `DESIGN_RULES.md` rule 18, "focus is never invisible", which the
audit had open as UNVERIFIED.

If anything it makes (a) read better rather than worse: with the one writable line clearly a
field, the ruled rows under it are unambiguously *content*, not more chrome. The distinction to
hold onto is **row vs. control** — a ruled sheet of flush rows, with the composer drawn as the
input it actually is. Don't cite the composer box as precedent for boxing rows.
