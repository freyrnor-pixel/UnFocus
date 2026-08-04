# 12 — Check position and trailing icons: confirm the design is stale

**Size:** XS · **Expected outcome: a documentation line and no code.**

Read `00-INDEX.md` first if you haven't. This file exists so the divergence is recorded as
*decided* rather than quietly forgotten — a later session that opens the design project will
otherwise find this and re-propose it.

---

## The divergence

`ui_kits/unfocus_app/TasksScreen.jsx`'s `TaskRow` draws:

```jsx
<div style={{ display:'flex', alignItems:'center', gap:'var(--sp-sm)', ... }}>
  <button aria-label="toggle" style={{ width:22, height:22, borderRadius:'50%', ... }} />  {/* LEFT */}
  <div style={{ flex:1, minWidth:0 }}> title / time </div>
  {showActions ? (
    <div style={{ display:'flex', gap:8 }}>
      <ion-icon name="share-outline" />
      <ion-icon name="trash-outline" />          {/* two trailing action icons */}
    </div>
  ) : null}
</div>
```

Check on the **left**, two separate trailing action icons on the right.

**The app moved away from both on 2026-07-30**, and it was your call, applied app-wide.
`components/PadRow.tsx`:

> **The check is on the RIGHT** as of this pass (maintainer's call, applied app-wide…). It used
> to lead every row. On a paper checklist the ticks live in the right margin, and moving them
> there is also what let the notepad rules run the whole line instead of being inset past a
> check column (`ShoppingRow`'s retired `ROW_DIVIDER_INSET`).
>
> The ⋯ action sits immediately inside the check: one row-level "do something with this"
> button, replacing the assorted per-surface trailing trash/send/put-back buttons.

So the design's version is the app's *pre-2026-07-30* state, on both counts. It is not a
proposal — it is a recreation that predates the change.

---

## The decision

- **(a)** Confirm the app's version. Record it. No code. **← expected**
- **(b)** Revert to the design's left-check layout

If **(b)**: understand that it also un-does full-width notepad rules. The rules run the whole
line *because* there is no leading check column to inset past; `ROW_DIVIDER_INSET` was deleted
in the same pass. Restoring a left check means either re-introducing the inset or living with
rules that run under the checkboxes. Say which in the PR.

---

## What (a) actually delivers

Not silence — a written note, so this stops costing a session's attention:

1. Add a line to `DESIGN_RULES_AUDIT.md` (the file that exists to record which divergences from
   a spec are deliberate) stating that the design project's `TasksScreen`/`TaskRow` predates the
   2026-07-30 row-rule pass, and that its left-check + dual-trailing-icons layout is **not** to
   be ported.
2. Optionally, if you have push access to the design project, fix it at source — but that is a
   separate decision about who owns that project, and **not** part of this task. Don't
   `DesignSync write_files` on a whim; it needs a `finalize_plan` and the maintainer's intent.

That's the whole task. `npx tsc --noEmit` for form, then commit, PR into `main`, merge.

---

## Related, same class — worth noting in the same commit

While you are writing that audit line, two other parts of the design project are also
recreations of superseded states. Recording all three together costs nothing extra:

- **`EnergyMeter.jsx` puts a flash glyph inside every pip.** `components/EnergyMeter.tsx`
  explicitly says "don't reinstate the flash-icon". Covered fully in
  `13-energy-pips-confirm.md` — cross-reference rather than duplicating.
- **`HomeScreen.jsx`'s `DayRail`** draws a simple sorted list with a fixed 56px time column and
  a 20px minimum connector. The app's day view is `lib/dayGrid.ts`'s **elastic** axis with a
  live now-line, log-curve gap compression, and a deliberate split: ahead of now is the elastic
  timeline with real durations and visible gaps; behind now the day collapses flush. From
  `AGENTS.md`: "A gap ahead of you is room; the identical gap behind you is an accusation." The
  design's rail has no now-line and no collapse — it is much simpler *and* much less capable.
  Do not port it.

None of these three should be treated as design direction. They are snapshots of an older app.
