# ROW_ENUMERATION.md — S1.1-PRE row-drawing surface enumeration

**What this is.** An enumeration only, run against the precondition that
`PROGRESS_LOG.md` carries the R20.6 entry (`## 2026-09-05 — R20.6: wire
\`onMore\` at all three call sites, close round 20 phase 5`, line 5269) and
that this file did not already exist. Nothing in `components/`, `app/`, or
`lib/` was edited to produce it. No test was added or changed. No device.

**Precedent this follows.** R20.5 shipped as "AddRow gains a tier-3
escalation" with no caller named, and correct code mounted nowhere. R20.6
worked because it named paths. Every row below carries a `file:line`.

---

## Part 1 — Every row-drawing surface

| Component | Location (outer row element) | Imports `lib/rowList.ts`? | Hand-rolled literals (if no, or partial) | Done/delete column | Could `rowList` cover it? |
|---|---|---|---|---|---|
| `components/PadSheet.tsx` | `components/PadSheet.tsx:195` (`<View key={i} style={[styles.line, ...]}>`), boxed by `components/PadSheet.tsx:217` (`styles.list`, `overflow:'hidden'` clip) | **Partial.** Imports the `ROW_LIST_*` constants (`components/PadSheet.tsx:101-102`) but never calls `rowListStyle()`. Per-row corners come from clipping the outer `styles.list` wrapper, not from `rowListStyle`'s per-row corner logic — a deliberate, documented alternative (header, `components/PadSheet.tsx:33-40`), not a drift. | Separator branch hand-written at `components/PadSheet.tsx:204` (`i > 0 ? {borderTopWidth...} : stackGap`) using the imported `separator` constant — colors come from the shared module, the branching logic does not. | INSIDE (the row passed in via `row` prop supplies its own content, including any check/⋯, inside `styles.line`) | as-is for fill/edge/separator color; the corner mechanism itself is a legitimate second implementation of the same shape (see header rationale), not something `rowListStyle()` needs to also cover |
| `components/HabitsSurface.tsx` | `components/HabitsSurface.tsx:301` (`<View style={[styles.habitCard, rowBox]}>`), `rowBox = rowListStyle(...)` at `components/HabitsSurface.tsx:267` | **Yes.** `import { rowListStyle } from '@/lib/rowList'` at `components/HabitsSurface.tsx:105`. Header states it "hand-copied PadSheet's literals until 2026-08-28" (`components/HabitsSurface.tsx:20-21`) — converged since. | none (fully delegated) | INSIDE — the −/+ control and check live in `styles.habitCardContent` (`components/HabitsSurface.tsx:303`), inside `styles.habitCard` | as-is |
| `components/PlanTaskCard.tsx` | `components/PlanTaskCard.tsx:1226` (`<Animated.View key={task.id} style={[styles.flatRow, rowListStyle(...), ...]}>`), call at `components/PlanTaskCard.tsx:1237` | **Yes.** `import { rowListStyle } from '@/lib/rowList'` at `components/PlanTaskCard.tsx:340`. | none (fully delegated) | INSIDE as of 2026-08-28 — comment at `components/PlanTaskCard.tsx:1228-1232` states the surface used to be on the inner View (done/delete OUTSIDE the box) and was moved onto the row itself so the box IS the row | as-is |
| `components/TaskCard.tsx` (rows drawn via `components/TodoSurface.tsx`, mounted `app/plans.tsx`) | `components/TaskCard.tsx:906` (`<View style={[styles.wrap, dimmed && styles.dimmed]}>`); stacked by `components/TodoSurface.tsx:207/209/229/489/1197/1217/1352` (`<View style={styles.cardStack}>{...map(renderAnimated)}</View>`) | **No.** No `rowList` import anywhere in `components/TaskCard.tsx` or `components/TodoSurface.tsx`. | `components/TaskCard.tsx:1852` — `wrap: { gap: Spacing.xs }`, no fill/edge/radius at all on the row itself; the visible "card" per task is `components/SectionCard.tsx`'s `Card` shell wrapping the type, not a row. Stack gap: `components/TodoSurface.tsx:1726` — `cardStack: { gap: Spacing.sm }` — each task is a **separate floating card** with an 8px gap between, which is exactly the failure mode `lib/rowList.ts`'s header opens with ("four tasks read as four cards"). | N/A at the row level — no shared row box exists for done/delete to sit inside or outside of; each `TaskCard` draws its own internal layout independently | **not as-is.** Every task in the To-do tab is its own top-level card, not a row in a list. Covering it would mean removing `cardStack`'s per-item gap and giving `TaskCard` a `first`/`last` position the way `PlanTaskCard`'s day view already has — a materially different change than importing the module |
| `components/ShoppingRow.tsx` (mounted via `components/WeekListCard.tsx`, `app/(tabs)/shopping.tsx` / `app/shopping.tsx`) | **Converged, S1.0 (2026-09-06, `docs/sessions/S1.0_SHOPPINGROW_CONFORMANCE.md`).** `components/ShoppingRow.tsx`'s own `styles.row` now calls `rowListStyle()` (opt-in via new `first`/`last`/`rail` props) — `components/WeekListCard.tsx`'s four row regions (filtered planned, ungrouped+dish-grouped planned, in-cart, purchased) all pass them, `rail` resolving through `getScreenColor(theme, 'shopping').base`, the same value the outer card's own border already used. `WeekListCard.tsx`'s `rowsCard` lost its `borderLeftWidth: 3` (and the `theme.good`/`theme.accent` split across regions) but keeps `borderRadius`/`paddingHorizontal` as a plain padded backdrop the boxed rows sit inside; the per-row `rowDivider` `<View>`s are gone (`rowListStyle()`'s own hairline supersedes them). The reorderable "In list" rows (`renderReorderableRow`, whose actual `<ShoppingRow>` lives in `app/(tabs)/shopping.tsx`) got the same treatment via two new boolean params on that prop. **Not converged:** the Monthly tab's OWN unrelated purchased-by-trip `ShoppingRow`s (`app/(tabs)/shopping.tsx`, ~line 2076/2862) — a different list, outside S1.0's stated scope; `ShoppingRow`'s new props are opt-in, so that call site's pre-S1.0 look is unaffected. `lib/__tests__/shoppingRowConformance.test.ts` guards the CALL (not just the import) at both files. | **Yes**, as of S1.0. `import { rowListStyle } from '@/lib/rowList'` at `components/ShoppingRow.tsx`; `rowListStyle({ isDark, first, last, rail })` is actually called (not just imported — see the new test). | none remaining in `WeekListCard.tsx`'s four in-scope regions; the Monthly-tab call site (excluded, see above) is unchanged | INSIDE (checkbox/remove controls are drawn as part of `styles.row`'s own content) | n/a — converged |
| `components/MonthlyTableRow.tsx` (mounted `app/(tabs)/shopping.tsx` Monthly tab, `app/inventory-edit.tsx`) | `components/MonthlyTableRow.tsx:79` (`<View style={[styles.row, { backgroundColor: theme.surface }]}>`) | **No.** No `rowList` import. | `components/MonthlyTableRow.tsx:142` — `row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm }` — flush rows, no fill/edge/separator/radius at all beyond the inline `theme.surface`. | INSIDE (the restock checkbox is part of the row's own flex layout) | **not as-is.** No box exists to convert — this is a plain table row, closer to `SettingRow`'s shape than to a connected list |
| `components/MedicineSurface.tsx` (mounted `components/HomeMedicineCard.tsx`, `app/(tabs)/me.tsx`, `app/medicine.tsx`) | `components/MedicineSurface.tsx:479` (`<View key={med.id} style={styles.medRow}>`) | **No.** `AddRow` is imported (`components/MedicineSurface.tsx:103`) for the trailing quick-add only — the medicine rows themselves import nothing from `lib/rowList`. | `components/MedicineSurface.tsx:766` — `medRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs }` — no background, border, radius, or separator whatsoever. | INSIDE | **not as-is.** There is no box to swap in a fill/edge/rail for; adding one is new surface, not a conversion |
| `components/NoteRow.tsx` (mounted `components/NotesSurface.tsx`, `app/notes.tsx`) | `components/NoteRow.tsx:88` (`<Surface style={styles.card}>`) wrapping a bare `PadRow` | **No.** `PadRow` (the shared row-content anatomy — icon/title/⋯/check) is used, but `PadRow` itself draws no box (`components/PadRow.tsx` has no background/border in its `StyleSheet.create`, confirmed by grep — only the checkbox shape at line 352). The box around each note is `components/Surface.tsx`, one per note, stacked by `components/NotesSurface.tsx:172` (`section: { gap: Spacing.sm }`). | Each note is its own `Surface` card — the same "separate floating card + gap" pattern as `TaskCard`/`TodoSurface`, not a connected list at all. | INSIDE (check/⋯ are `PadRow` content inside the `Surface`) | **not as-is.** Same shape problem as `TaskCard`: converging means giving `NoteRow` a `first`/`last`-aware box instead of its own `Surface`, not importing a function |
| `components/SettingRow.tsx` (`SettingLinkRow`/`ToggleRow`, mounted `app/settings.tsx`) | `components/SettingRow.tsx:85` (`<View style={[styles.row, style]}>`), separated in the caller by manual hairlines, e.g. `app/settings.tsx:956` (`<View style={[styles.divider, { backgroundColor: theme.border }]} />`) | **No.** No `rowList` import in either file. | Divider color is `theme.border`, not `ROW_LIST_SEP_*` — a different token, hand-placed between rows by the caller rather than derived from row position (`first`/`last`). Each `app/settings.tsx:943`-style `styles.section` is its own box (need not be `rowList`-shaped — see Part 4). | N/A — settings rows have a chevron/switch, not a done/delete pair | **not as-is, and arguably shouldn't be** — settings groups are a different design object (grouped list, iOS/Android settings convention) from a connected task/habit/shopping run; forcing `rowList`'s rail-and-hue vocabulary onto it would be the wrong direction, not a gap |
| `components/HealthIssuesPreviewList.tsx` (mounted inside `app/(tabs)/health.tsx`'s `CollapsedSection`) | Delegates entirely — `<PadSheet state="open">` at `components/HealthIssuesPreviewList.tsx:123`, rows are `PadRow` at `:127` | **Indirectly yes** — inherits `PadSheet`'s partial-import status above. Not itself importing `rowList`, by design (same pattern as `NoteRow` delegating to `PadRow`, except here the box comes along too because `PadSheet` supplies it). | none of its own | Same as `PadSheet` | Same as `PadSheet` — already covered through delegation, not a gap |

**Count: 10 row-drawing surfaces enumerated.** 3 (`PadSheet`, `HabitsSurface`,
`PlanTaskCard`) import the recipe directly; 1 (`HealthIssuesPreviewList`)
inherits it by delegating its whole list to `PadSheet`; **6 do not**
(`TaskCard`/`TodoSurface`, `ShoppingRow`/`WeekListCard`, `MonthlyTableRow`,
`MedicineSurface`, `NoteRow`/`NotesSurface`, `SettingRow`) and each of those 6
hand-rolls a **different** shape from the other five — there is no second
common recipe hiding among them.

**Updated 2026-09-06 (S1.0).** The counts above are the enumeration as
measured, kept as the record. `ShoppingRow`/`WeekListCard` has since
converged (see its row in the table). Live count: **5 covered, 5 not** —
`TaskCard`/`TodoSurface`, `MonthlyTableRow`, `MedicineSurface`,
`NoteRow`/`NotesSurface`, `SettingRow`. Of those, only `MonthlyTableRow`
(S1.2) and `MedicineSurface` (S1.3) are still slated to converge; the other
three are permanently out of scope per `DECISIONS_OPEN.md`'s option C.

---

## Part 2 — Resolve the `HabitsSurface` contradiction

**Both were true, at different times — this is not a live contradiction.**

- `components/HabitsSurface.tsx:20-21` (the file's own header) states: *"this
  surface hand-copied PadSheet's literals until 2026-08-28."* Before that
  date, the planning note describing `HabitsSurface` as hand-rolling its own
  row box outside `PadSheet` was accurate.
- As of 2026-08-28, `components/HabitsSurface.tsx:105` imports
  `rowListStyle` from `lib/rowList.ts`, and `components/HabitsSurface.tsx:267`
  calls it (`const rowBox = rowListStyle({ isDark, first: !!first, last:
  !!last })`), consumed at `components/HabitsSurface.tsx:301`
  (`<View style={[styles.habitCard, rowBox]}>`).
- `lib/__tests__/screenRhythm.test.ts:414-434` currently asserts
  `HabitsSurface` (along with `PadSheet` and `PlanTaskCard`) imports from
  `'@/lib/rowList'`, and that assertion passes today (verified by reading the
  source directly — the file was not run, per scope, but the string match is
  unambiguous at the cited lines).

So: **importing the recipe and hand-drawing a surrounding box are indeed
different things, as the prompt suggests they might be — but in
`HabitsSurface`'s case the planning note is simply stale.** It was correct
before 2026-08-28 and has not been true since. No file needs correcting;
whichever planning note asserted the hand-rolled claim as current state is
the thing that's out of date, and this session was told not to fix either
file.

---

## Part 3 — What the guard actually asserts

**Test:** `lib/__tests__/screenRhythm.test.ts`, describe block `'listed rows —
every file that draws a run of rows shares one recipe'`
(`lib/__tests__/screenRhythm.test.ts:413`), specifically the `it` at
`lib/__tests__/screenRhythm.test.ts:429-434`:

```
it('every file that draws a run of rows takes the recipe from lib/rowList.ts', () => {
  for (const file of [PAD_SHEET, HABITS_SURFACE, PLAN_TASK_CARD]) {
    expect({ file, importsRecipe: read(file).includes("from '@/lib/rowList'") })
      .toEqual({ file, importsRecipe: true });
  }
});
```

- **IMPORT PRESENCE (a source scan), not rendered output.** It reads the raw
  file text (`read()` is `fs.readFileSync`, `lib/__tests__/screenRhythm.test.ts:19`)
  and checks whether the literal substring `"from '@/lib/rowList'"` occurs
  anywhere in it. It does not check that `rowListStyle()` is actually called,
  applied to the row's own outermost element, or that the row renders with
  the resulting fill/edge/rail. `PadSheet.tsx` passes this test on the
  strength of importing the *constants* alone (Part 1) — the test cannot
  distinguish "imports the recipe and calls it" from "imports one exported
  constant from the same file and does its own thing with the corners."
- **Files named exactly:** `components/PadSheet.tsx`, `components/HabitsSurface.tsx`,
  `components/PlanTaskCard.tsx` (the `PAD_SHEET` / `HABITS_SURFACE` /
  `PLAN_TASK_CARD` constants, `lib/__tests__/screenRhythm.test.ts:414-418`).
- **Components from Part 1 this test does NOT cover:**
  - `components/TaskCard.tsx` / `components/TodoSurface.tsx`
  - `components/ShoppingRow.tsx` / `components/WeekListCard.tsx` — still not
    covered by *this* test (S1.0 deliberately did not extend its named triad);
    covered since 2026-09-06 by the separate
    `lib/__tests__/shoppingRowConformance.test.ts`, which checks the call
    shape rather than the import string
  - `components/MonthlyTableRow.tsx`
  - `components/MedicineSurface.tsx`
  - `components/NoteRow.tsx` / `components/NotesSurface.tsx`
  - `components/SettingRow.tsx`
  - `components/HealthIssuesPreviewList.tsx` (uncovered directly, though it
    delegates to a covered file)

That is 7 of the 10 enumerated surfaces (or 6 of 9 if
`HealthIssuesPreviewList` is set aside as "covered by delegation") outside
what `INVARIANTS.md:139` and this test currently claim as the guarded set.

---

## Part 4 — Shape feasibility (`lib/cardRegistry.ts`-style compile-time guard)

**`lib/cardRegistry.ts`'s guarantee doesn't transfer directly, and the reason
is structural, not incidental.**

A card is a single call site: `<Card id="todoToday">` names one registry
entry, `components/Card.tsx` is the only file allowed to draw the fold, and
an unregistered `id` is a `tsc` error because `id` is typed against the
registry's keyed union. The compile-time guarantee comes from there being
**exactly one function that draws the box**, and every caller going through
it by construction — there is nothing to hand-roll a second card body with,
because `Card.tsx` alone owns the render.

A row does not have that shape today, for reasons this enumeration surfaces
directly:

- `rowListStyle()` returns a **style object**, not a component. Nothing stops
  a file from importing it, ignoring the return value, and writing its own
  `<View style={{ backgroundColor: theme.surface }}>` instead — which is
  exactly what the Part 3 guard's blind spot already shows happening in
  spirit (`PadSheet` imports constants and reimplements the branching).
  A type system cannot force a *style object* to be *applied*; it can only
  force one to be *importable*.
- The 7 uncovered surfaces (Part 1) are not one shape with six copies — they
  are six distinct shapes (separate floating cards with gaps, a left-border
  hue box, a fully flush row, a divider-separated grouped list). `Card.tsx`
  works because every card is the same box; a row registry would need to
  either force all of these into one shape first (a design decision, not a
  types decision — `SettingRow`'s grouped-list convention arguably
  *shouldn't* converge, per Part 1) or type multiple row "variants," at which
  point the compile-time check only proves "some registered shape was used,"
  not "the right one was."

**What the type would have to look like, if it's built:** a row-drawing
component would need to stop taking a raw `style` prop and instead take a
required `position: 'first' | 'middle' | 'last' | 'only'` (or the existing
`first`/`last` booleans, made non-optional and structurally required) whose
consumer is a single shared `<RowBox>` wrapper component — analogous to
`Card.tsx` — that is the *only* place `rowListStyle()` is called, the same
way `Card.tsx` is the only importer of the fold. Every current caller
(`PadSheet`, `HabitsSurface`, `PlanTaskCard`, and any of the 7 converged
later) would render through `<RowBox first last>{content}</RowBox>` rather
than spreading `rowListStyle(...)` into their own `View`'s style array. That
converts the guard from "did you import the module" to "did you use the one
component that has no other way to draw a row" — the same trick
`cardRegistry.ts` uses. This is a real refactor of all three currently-passing
files, not just the 7 gaps, and is out of scope here per the task's own
rules.

**Feasibility verdict:** the row shape *can* admit the same treatment, but
only after a `<RowBox>` component is introduced and the 3 currently-compliant
files are migrated onto it — it is not a drop-in type annotation over what
exists today.

---

## Scope note (STOP-gate: size)

Per the STOP gate on scope: converging the 6 genuinely hand-rolled surfaces
(`TaskCard`/`TodoSurface`, `ShoppingRow`/`WeekListCard`, `MonthlyTableRow`,
`MedicineSurface`, `NoteRow`/`NotesSurface`) onto one recipe — while leaving
`SettingRow` alone as a legitimately different design object — is **more
than one session**. Two of the six (`TaskCard`/`TodoSurface` and
`NoteRow`/`NotesSurface`) are a "separate floating cards" pattern that would
need a `first`/`last`-aware box added where none exists; the other three
(`ShoppingRow`, `MonthlyTableRow`, `MedicineSurface`) each hand-roll a
different partial shape. That is at minimum five independent conversions
plus the `<RowBox>` extraction from Part 4 if the compile-time guarantee is
also wanted. Scope was not narrowed to fit — this file records the count
instead, per the task's explicit instruction.

No verification card — nothing renders; this is a source enumeration only.
