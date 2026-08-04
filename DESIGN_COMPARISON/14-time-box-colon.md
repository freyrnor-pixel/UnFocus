# 14 — Time boxes: `:` instead of the vertical lines

**Size:** XS–S · **Blocked by:** nothing · **⚠️ Confirm the target before writing code**

Maintainer note, 2026-08-04: *"Time boxes should have `:` instead of the vertical lines."*

---

## Start by confirming what you're fixing

I could not resolve "the vertical lines" from source alone, and **guessing is how the last
pass went wrong.** There is no literal `|` character anywhere in the app's time rendering —
I grepped for `'|'`, `"|"`, `│`, `┃` across `components/`, `app/` and `lib/`; the only hits are
TypeScript union types in `lib/db.ts` and `app/habit-form.tsx`.

So it is something that *reads* as a vertical line on screen. **Take a screenshot first**:

```
npm run preview
```

then look at `preview-shots/` for the To-do tab (default layout is the day timeline). If that
isn't enough, `node scripts/preview.mjs --route=/plans` for a focused shot.

### The three candidates, with exact locations

**1. `PlanTaskCard.tsx:1794` — the `timeBox` style.** A bordered box holding the task's time:

```tsx
timeBox: {
  minWidth: 44, paddingHorizontal: 6, paddingVertical: 3,
  borderRadius: Radius.sm, borderWidth: 2,
  alignItems: 'center', justifyContent: 'center',
},
```

It renders `{task.time}` raw, and `task.time` is already stored `HH:MM` — so the colon should
already be present. **But `minWidth: 44` with `paddingHorizontal: 6` and `FontSize.xs` bold is
tight**, and `numberOfLines={1}` is set. If the text is being squeezed, the two `1`-ish digits
plus a narrow colon can visually collapse into what looks like a divider. This is my best
guess. Note `lib/__tests__/designTokens.test.ts:202` explicitly allow-lists this file for a
bare `44` ("timeBox minWidth + hNowMarker width — display boxes"), so the 44 is deliberate and
is *not* a tap target you may shrink.

**2. `components/DayGridLines.tsx` — the hour gutter.** It draws "hour lines with `HH:00`
labels in a left gutter, compressed 'nothing here' bands… and a live 'now' line." If the hour
labels are rendering without their colon, or if a gutter rule sits where the colon should be,
this is the file. **Read its header before touching it** — the scale is a prop and must never
be recomputed locally (that's a documented trap: two independently-built scales drift and the
lines stop matching the cards).

**3. A time-box *range* (start + end).** `components/TaskCard.tsx:154` references
"`lib/taskNotifications.ts`'s end-of-timebox reminder". If a range renders as `09:00 10:00`
with a bar between rather than `09:00–10:00`, that bar is your vertical line. Search
`TaskCard.tsx` for the duration/end display.

**Confirm which one, say so in the PR, then fix only that one.**

---

## Constraints on the fix

- **`TabularNums` must stay.** Both `timeBoxText` and `flatTimeText` carry it
  (`constants/theme.ts`), so a column of times lines up row to row. Any rewrite keeps it.
- **`HH:MM` is the app's stored format** and `lib/date.ts` owns the helpers
  (`parseTimeToMinutes`, `addDurationToTime`). Don't hand-roll time formatting in a component —
  if a formatter is needed, it belongs in `lib/date.ts` with a test.
- **Don't shrink `minWidth: 44`.** It's allow-listed in the CI token test as a display box; if
  the box is too tight, reduce the font or raise the width, don't drop below.
- If the fix is "the label needs more room", check it at the `large` text scale (1.2×) too —
  `npm run wraps -- --lang=no --width=327` is the proxy for that.

---

## Verify

1. `npx tsc --noEmit`
2. `scripts/test-changed.sh` — if you touched `lib/date.ts` or `lib/dayGrid.ts`, their tests
   must run. Report by name.
3. `npm run preview` — **required, before and after.** This task is defined by what's on
   screen; a before/after pair is the deliverable's evidence.
4. `npm run wraps -- --lang=no --width=360` if the box's width or content changed.

## Close out

Commit, PR into `main`, merge. Put the before/after observation in the PR body — the next
person reading this file should not have to re-derive which of the three it was.
