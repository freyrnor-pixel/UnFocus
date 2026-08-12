# Handoff — empty-state explainer placement + the To-do example's collapse trigger

Follow-up to **PR #560** ("One shape, one width for every empty-state example", merged
2026-08-12, commit `9e05d1f`). That PR noted two deliberate deviations from its plan; the
maintainer has now ruled on both. This is the work those rulings imply.

**Branch:** `claude/pr-followup-medicine-todo-99dhzl` (exists locally + on origin, currently
0 commits ahead of `main`).

**Standing rule:** finish with a PR into `main` **and merge it yourself**. OTA publishes only
on push to `main`. No i18n keys, no migration, no native surface → **no `runtimeVersion` bump,
no build.**

---

## The two rulings

### Ruling 1 — placement

> "Explanation always sits underneath sub-header." — scoped, on follow-up, to **"Only when the
> card is empty"**: under the header while the surface is empty and the explainer is the main
> thing there; at the foot once the card has real content to lead with.

This **partially reverses the 2026-07-30 decision** ("move tips to places they're not in the
way, interrupting") — but only for the empty state. Say so in the code, don't quietly flip it.

Consequence, already checked against the tree: **all four Home explainers are empty-gated**, so
in practice all four move from foot → head. `EnergyMeter`'s `CardHintNote` is the one that is
*not* empty-gated (it's the permanent hint under a meter that has content) — **it stays at the
foot.** That is the whole point of the emptiness qualifier; verify it before you touch anything.

### Ruling 2 — the To-do example

> "Add a trigger to the day card."

`PlanTaskCard`'s inline example (Home + the To-do timeline layout) gets the same bordered
collapse trigger row that Health, Habits, Goals and the To-do *screen-level* `StarterCard`
already have. Cost accepted by the maintainer: one extra line in the card that was the model.

---

## Task A — give `CardHintNote` a placement

**`components/CardHintNote.tsx`**

Add `placement?: 'head' | 'foot'`, default `'foot'` (so nothing changes for a caller that
doesn't opt in).

- `'foot'` — unchanged: top hairline + `paddingTop: Spacing.xs` + `marginTop: Spacing.md`,
  `noBorder` still suppresses the hairline.
- `'head'` — **no hairline, no `marginTop`, `marginBottom: Spacing.md`.** The hairline exists to
  attach the note to what it *follows*; at the head there is nothing above it but the card's own
  header, which already owns the gap (every caller's header carries `marginBottom: Spacing.lg` —
  `HomeHabitsCard` `titleRowPressable`, `HomeNotesCard` `header`, `HomeShoppingCard` `header`,
  `PlanTaskCard` `headerRowPressable`). `noBorder` becomes a no-op under `'head'`; don't make
  callers pass both.

Rewrite the header block's third Edit note ("Mount it as the LAST child … never above it") to
state the real rule, with the date and the reason:

> **Placement is decided by emptiness (2026-08-12).** While the surface is EMPTY the explainer
> is the main thing in the card, so it sits directly under the header (`placement="head"`).
> Once the card has real content to lead with, the note goes back to the foot — which is why
> `components/EnergyMeter.tsx`, whose hint is permanent rather than empty-gated, is the one
> caller still passing the default. This narrows, and does not delete, the 2026-07-30 "move
> tips out from between the title and the content" decision: that complaint was about teaching
> standing between a title and content *the user already has*.

---

## Task B — move the four empty-state notes to the head

Mechanical, same shape four times: delete the mount at the foot, re-mount it immediately after
the card's header block with `placement="head"`, drop `noBorder`. **Keep each gate exactly as
it is** — the gate is what makes the placement correct.

| File | Delete from | Re-mount after | Gate (unchanged) |
|---|---|---|---|
| `components/HomeHabitsCard.tsx` | ~487 (after `PadFooterToggle`) | the header `</View>` ~395, before `{habits.length === 0 ? (` | `habits.length === 0` |
| `components/HomeNotesCard.tsx` | ~408 | the header `</View>` ~291, before `<PadSheet` | `notes.length === 0` |
| `components/HomeShoppingCard.tsx` | ~521 | the header `</View>` ~405, before `<View style={styles.weekRow}>` | `totalCount === 0` |
| `components/PlanTaskCard.tsx` | 1779 | the `{readOnly && ( … )}` header block, which closes at 1524 — before the type line at 1538 | `showEmpty` |

Two notes on the table:

- **Shopping**: it goes *above* the week pager. The pager is a control, not a sub-header.
- **PlanTaskCard**: the header renders **only when `readOnly`** (the Home preview). On the To-do
  timeline there is no header at all, so the note becomes the card's first child. That is correct
  under the rule — nothing above it to sit under — but it means you cannot put the mount inside
  the `readOnly &&` block. Mount it as a sibling, after it.

Replace each site's "at the FOOT (2026-07-30)" comment rather than leaving it contradicting the
code. Each of those comments states the old reasoning verbatim; a stale one here is exactly the
failure mode `AGENTS.md`'s "a header that ASSERTS a property is not evidence" gotcha describes.

---

## Task C — medicine card: one component, one rule

**`components/MedicineTrayCard.tsx:281`**

```tsx
{medicines.length === 0 && <StarterCard text={t.starters.medicine.text} compact embedded />}
```

**Its placement is already correct** — `statusLine()` returns `null` when nothing is scheduled
(`!hasScheduled` → early `return null`, line ~204), so with no medicines this already sits
directly under the header row. Ruling 1 asks for no move here.

What it *does* need is the component swap PR #560's plan originally called for, now that the
foot objection is gone: replace it with `<CardHintNote text={t.starters.medicine.text}
placement="head" />` so all five empty-state explainers are one component in one position.
`StarterCard compact embedded` with `text` alone already renders bulb + italic line — this is a
near-identical redraw, with two real diffs to expect:

- ink goes `theme.text` → `theme.textMuted` (CardHintNote's colour), and
- `lineHeight` 17 → 16.

Both are CardHintNote's values and both are correct — that component is the app's explainer line.

**Spacing caveat, specific to this file:** `cardContent` has no `gap`; its children each carry
their own `marginTop` (`status` is `marginTop: Spacing.xs`). `placement="head"` supplies only a
`marginBottom`, so the note will sit flush against the header row. Pass a local
`style={styles.hintNote}` with `marginTop: Spacing.xs` and a one-line comment saying why this
card needs it and the four Home cards don't (their headers own a `marginBottom`; this one
doesn't).

Update both ends of the `Connections:` map in the same edit: this file drops `StarterCard` and
gains `CardHintNote`; `StarterCard`'s own header lists `components/MedicineTrayCard.tsx` under
`Used by →` and in its `compact` Edit note ("Its only caller (components/MedicineTrayCard)…") —
`compact` becomes **caller-less**. Leave the prop in place, note it as unused rather than
deleting it, same treatment `dismissKey` already gets in that file.

---

## Task D — the To-do example's collapse trigger

**`components/PlanTaskCard.tsx`, the `showEmpty` block at 1540–1581.**

Today: `<View style={styles.emptyWrap}>` → bare `StarterExampleRow` (gated on `onAddExample`) →
the ghost add-row (gated `readOnly && !onAddTask`).

Wrap the example — **and only the example** — in the shared card:

```tsx
<StarterCard embedded collapsible exampleHeaderLabel={t.starters.plans.tapToAdd}>
```

with the existing `StarterExampleRow` passed as `example`. Pass **no `text`**: the explainer is
now the head-mounted `CardHintNote` from Task B, and saying it twice in one card with two
different lifespans is the exact thing `StarterCard`'s optional-`text` note warns about.

Checks:

- `t.starters.plans.tapToAdd` already exists — `app/(tabs)/plans.tsx:1199` uses it. No new keys.
- **The ghost add-row stays outside** the StarterCard. It is a fallback way in
  (`readOnly && !onAddTask`), not a suggestion, and collapsing the examples must not take away
  the only "add something" affordance on that branch.
- `StarterCard`'s `embedded` wrapper is `gap: Spacing.xs`; `emptyWrap` is also `gap: Spacing.xs`.
  Don't add a third wrapper — the spacing is already right, and
  `exampleRows.test.ts` pins `emptyWrap: { gap: Spacing.xs }`.
- `StarterCard` is a new import here. Update this file's `Connections: Imports →` and add
  `components/PlanTaskCard.tsx` to `StarterCard`'s `Used by →`.

---

## Task E — tests

**`lib/__tests__/exampleRows.test.ts`** will fail as written. Three changes:

1. The `for (const [file, label] of [...])` loop (lines ~139–151) asserts every listed file
   mounts `StarterCard` with `embedded`, and it includes `components/MedicineTrayCard.tsx`.
   That file no longer mounts one → **remove it from the list** and **add
   `components/PlanTaskCard.tsx`**, which now does (Task D).
2. The medicine card's invariant hasn't disappeared, it has changed shape. Replace it with an
   assertion that the card mounts `CardHintNote` at `placement="head"` and mounts no
   `StarterCard` at all.
3. Add a new `describe` for ruling 1, and make it assert the *rule*, not five positions:
   - for each of `PlanTaskCard`, `HomeHabitsCard`, `HomeNotesCard`, `HomeShoppingCard`,
     `MedicineTrayCard`: the `CardHintNote` mount carries `placement="head"` **and** its index
     in the source is *before* the card's body (`<PadSheet` / `styles.weekRow` / the
     `emptyWrap` block) — the same index-comparison idiom the file's existing placement
     `describe` already uses for Health and Habits.
   - **`EnergyMeter` is the counter-case and is the most valuable assertion in the group**:
     its `CardHintNote` mount must carry **no** `placement` (i.e. still `foot`), because its
     hint is not empty-gated. Without this the suite would read "head everywhere" and the next
     session would flatten the rule.
   - assert `CardHintNote` still defaults to `'foot'` when the prop is absent.

Keep the file's source-scanning approach and extend its header comment with ruling 1 — a
placement is invisible to a screenshot, which is the stated reason this file exists.

---

## Verification

1. `npx tsc --noEmit` — first gate.
2. `scripts/test-changed.sh --all` — `--findRelatedTests` finds nothing for these files (the
   tests that cover them are source-scanning, so they don't import them). PR #560's baseline
   was **89 suites / 1654 tests**.
3. `npm run preview` — confirm the explainer is above the composer on Home's four cards and on
   the To-do timeline, and that the day card's example now has a trigger row that collapses.
   **If a change doesn't appear, suspect the Metro cache before the component**: drop a unique
   literal, rebuild, `grep` it in `dist/_expo/static/js/web/entry-*.js`; clear with
   `rm -rf /tmp/metro-* /tmp/haste-* .expo dist`. See the gotcha in `AGENTS.md`.
4. `npm run wraps -- --lang=no --width=360` and `--width=327`, **diffed against a baseline build
   of the pre-change tree** (that is how PR #560 reported it). The trigger row is a new
   full-width label + chevron in a card that is already tight at 327 — `t.starters.plans.tapToAdd`
   in Norwegian is the thing to watch. `"Rydde"` crushed to 11px at 327 is **pre-existing** —
   present in the baseline, not a regression you introduced.

## Docs to update in the same commit

- `AGENTS.md` — the empty-state explainer bullet currently describes the foot placement as the
  rule. Restate it as the emptiness-gated rule, name `EnergyMeter` as the documented exception,
  and record that `PlanTaskCard`'s example is no longer the one surface without a trigger.
- `components/StarterCard.tsx` header — `Used by →` (gains PlanTaskCard, loses MedicineTrayCard)
  and the now-caller-less `compact` note.
- `components/CardHintNote.tsx` header — the placement rule (Task A).
- File headers at every touched call site, both ends of each `Connections:` change.

## Two things NOT in scope

- **Don't move `EnergyMeter`'s hint.** It is the case the maintainer's "only when the card is
  empty" qualifier exists to protect.
- **Don't touch the screen-level `StarterCard`s** on Plans/Health/Habits/Goals. They already
  satisfy both rulings; PR #560 placed them and nothing here changes their shape.
