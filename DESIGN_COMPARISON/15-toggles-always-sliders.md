# 15 — Every toggle is a slider: coloured on, grey off

**Size:** M (audit + conversions) · **Blocked by:** nothing

Maintainer note, 2026-08-04: *"Toggle is always the visual button slider with color/grey."*

This is a rule, not a preference — it means an on/off boolean must **never** be expressed as a
checkbox, a pill, a chip, a tick, or a highlighted row. One control, one shape, everywhere.

---

## What already exists

`components/FormControls.tsx` is the shared home for these:

> shared form primitives: Checkbox, Switch, SegmentedControl, Input. Theme-aware wrappers so
> screens stop hand-rolling checkboxes/toggles with ad-hoc colours. `Switch` wraps the native
> RN Switch with themed track/thumb.

So the target component exists — `Switch`, wrapping `RNSwitch` with themed colours. There is
also a documented detail worth not breaking:

> **Switch off-thumb is a fixed white (2026-07-25)**: was `theme.textInverse`, which is…

Read the full note in that file before changing thumb/track colours.

`lib/useToggleColor.ts` supplies the on/off colouring and is already used by `Checkbox`.

---

## The task: audit, then convert

**Step 1 — find every boolean control.** These files import `Switch` today, so they are the
already-correct set (or at least partly): `BottomNav`, `MedicineTrayCard`, `InlineAddItem`,
`MonthlyResetReviewSheet`, `UpdateSheet`, `HomeShoppingCard`, `ListSettingsSheet`,
`FormControls`, `TaskCard`, `app/medicine-form.tsx`, `app/health-form.tsx`, `app/settings.tsx`,
`app/habit-form.tsx`, `app/pair-device.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/plans.tsx`,
`app/(tabs)/index.tsx`, `app/automations.tsx`.

What you are hunting is the **complement**: a boolean rendered some other way. Look for
`Checkbox` used as a setting (rather than as a list item's completion state), and for
hand-rolled pressable pills/chips that carry an on/off state.

**Step 2 — draw the line correctly.** Not every two-state control is a toggle, and converting
the wrong ones would be a regression:

| Control | Slider? | Why |
|---|---|---|
| A setting in `app/settings.tsx` | **Yes** | The canonical case |
| A feature flag row (`FEATURE_ROWS`) | **Yes** | Same |
| "Ongoing" on `app/health-form.tsx` | **Yes** | A boolean about the entry |
| A row's completion check (`PadRow`'s `○`) | **No** | That's a checklist tick, not a setting. It is the app's row anatomy and task 11 owns its colour. |
| `SegmentedControl` / `SlideSelector` / `TabSlider` | **No** | 3+ options, not a boolean |
| A multi-select chip row (tags, weekdays, people) | **No** | Membership, not on/off |
| A rest-day marker on a habit | **Judgement** | It reads as a per-day state on a calendar, not a setting. Probably no. |

**Step 3 — convert what's left**, using `FormControls`' `Switch`. Don't build a second switch.

---

## Landmines

- **Tap targets.** RN's `Switch` renders at a platform-fixed size. If a converted control was
  previously a large pressable row, keep the whole row pressable and let the switch be the
  *indicator* — that's how `app/settings.tsx` already does it. Never a bare `44` or
  `hitSlop: 8`; use `MIN_TAP_TARGET` / `HitSlop.*` from `constants/theme.ts`
  (`lib/__tests__/designTokens.test.ts` gates this in CI).
- **Horizontal room.** A switch is wider than a checkbox. `npm run wraps` already reports
  chrome stacking on settings-style rows — "three nested 16px paddings plus an icon gutter
  left text 306 of 393px". Converting several rows in a screen will eat into label width, and
  Norwegian labels are the long ones.
- **Some booleans have side effects on write.** `app/settings.tsx`'s `applyAndSync` re-syncs
  notifications on specific keys — e.g. turning `featureMedicine` off "must actually CANCEL
  its four tray reminders, not just hide the card". If you move a control, keep it wired to
  the same handler; don't reimplement the write.
- **Accessibility.** A `Switch` announces as a switch with an on/off state. If you replace a
  custom pressable, make sure `accessibilityRole` / `accessibilityLabel` survive — several
  call sites set these explicitly.
- **The colour question belongs to task 06.** "Coloured on, grey off" is the shape; *which*
  colour is 06's decision (`theme.accent` is the safe default and is what `Switch` uses today).
  Don't invent a per-domain switch colour here.

---

## Verify

1. `npx tsc --noEmit`
2. `scripts/test-changed.sh` — this is behavioural (controls that write settings). Report
   every suite by name. If you touched a settings write path, its store test must run.
3. `npm run preview` — **required.** The driver already opens Settings, which is where most of
   these live. Check both themes: an off switch is grey, and grey-on-`#1B2438` in dark mode is
   the case most likely to disappear.
4. `npm run wraps -- --lang=no --width=360` — **required.** You are widening controls in rows
   that already have a tight label budget.

## Close out

Update `FormControls.tsx`'s header `Used by →` with any new callers, and note the rule itself
somewhere durable — `DESIGN_RULES.md` is the right home for "a boolean is always a slider", so
the next session doesn't reintroduce a checkbox-as-setting. Commit, PR into `main`, merge.
