# Checklist — button press animations sweep

**Read `BUTTON_PRESS_ANIMATIONS_HANDOFF.md` first** for full context, the exact code change
for Part 1, the `scaleTo` taxonomy, and exclusion rules. This file is only the tracking list.

**Protocol for every session working this list:**
1. Find the first unchecked `[ ]` item below.
2. Do that item (and reasonably as many following items in the same phase as fit in the
   session — no need to stop after one file).
3. Check off `[x]` everything you land, **in the same commit** as the code change.
4. If you open a PR and merge to `main`, note the PR number next to the phase heading.
5. If you stop mid-phase, leave a one-line note under the phase (`<!-- stopped: ... -->`) so
   the next session doesn't have to re-derive where you got to.

Do not re-run the full-repo audit that produced this list — it's already done. If a listed
file turns out to already be converted or a listed line no longer matches, just fix the
checklist entry and move on; don't re-audit the whole repo again.

---

## Part 1 — `PressableScale.tsx` core change (do this before anything in Part 3)

- [x] `components/PressableScale.tsx` — add the synced opacity dip (exact diff in the handoff
      doc, Part 1). Verify a disabled `Button` still dims correctly afterward.

## Part 2 — Backfill explicit `scaleTo` on already-converted call sites (low priority, bundle
opportunistically with other work in the same file)

- [x] `components/InboxSection.tsx` — 3 row-action buttons, currently default `0.94`
- [x] `components/UpdateSheet.tsx` — stepper +/-, ghost cancel, primary save, delete-confirm
- [x] `components/AddItemSheet.tsx` — qty stepper +/-, ghost cancel, primary add
- [x] `components/ListSettingsSheet.tsx` — week-chip selector, "done" button
- [x] `components/SharedRequestsSection.tsx` — accept/dismiss row actions
- [x] `components/ShoppingQuickAddSheet.tsx` — primary "save" button
- [x] `components/WeekListCard.tsx` — `doneShoppingBtn` primary CTA

## Part 3, Phase 1 — Shared wrapper components (highest leverage — convert first)

- [x] `components/AddFAB.tsx:68` — the "+" FAB used on ~8 screens. `scaleTo=0.90` (icon/FAB).
- [x] `components/SaveButton.tsx:81` — inline dirty-state save button. Add press-scale on top
      of its existing entrance/exit animation (don't touch that part). `scaleTo=0.95` (primary).
- [x] `components/ScreenHeader.tsx:85,95,111,176` — gear icon, info toggle, focus toggle, back
      link. Rendered on nearly every screen. `scaleTo=0.90` for the icon buttons; back link is
      text-only, treat as secondary/ghost `0.97`.
- [x] `components/StickySaveBar.tsx:105,108` — "Undo" (secondary `0.97`) and "Save" (primary
      `0.95`) buttons.
- [x] `components/ExpandableCard.tsx:161,164,177` — header disclosure toggle (list/card `0.97`)
      + leading/trailing action slots (match their own semantics, likely `0.97` or `0.90`).
- [x] `components/MonthlyTableRow.tsx:72,92,96,116,124` — checkbox circle (`0.97`), qty
      steppers (`0.90`), remove button (`0.93` destructive), row-tap wrapper (`0.97`).
- [x] `components/DatePickerCalendar.tsx:104,116,128,170` — month prev/next nav (`0.90`),
      "today" jump (`0.97`), day cells (`0.97`).
- [x] `components/VoiceNoteFAB.tsx:114` — record FAB. `scaleTo=0.90`.
- [x] `components/AddDivider.tsx:31` — inline "+ add" divider button. `scaleTo=0.97`.
- [x] `components/ConfirmationBanner.tsx:113` — inline "Undo" action only (`:106` tap-to-dismiss
      stays raw `Pressable` — exclusion, see handoff doc). `scaleTo=0.97`.
- [x] `components/SlideSelector.tsx:49` — segmented-option pressable (twin of `FormControls`'
      `SegmentedControl`, which already uses `PressableScale`). `scaleTo=0.97`.

<!-- Note: components/AnimatedBottomSheet.tsx's only Pressable (line ~90) is the backdrop —
     excluded per the handoff doc, nothing to convert there. -->

## Part 3, Phase 2 — Card/row components (main-tab, high-frequency taps)

- [x] `components/TaskCard.tsx:252,259,273,290,310,320,374,395,439,509,580` — discard/save-edit,
      done-toggle circle, title tap, chevron, step check-circles (x2), step remove, weekday
      chips (x2), delete-task row. Mixed types per the table — done-circles/`0.97`,
      icon/chevron `0.90`, delete row `0.93`, chips `0.97`.
- [x] `components/PlanTaskCard.tsx:297,353,402,542,589,607` — done-toggle circle, content tap,
      card tap, header nav link, disclosure, expand/collapse footer.
- [x] `components/ShoppingRow.tsx:322,377,392,416` — check-circle (`0.97`), qty stepper x2
      (`0.90`), remove (`0.93` destructive).
- [x] `components/WeekListCard.tsx:270,288,305,375,383,396,421,447,483,514,524` — list-name
      tap, lock toggle, progress row, inline-add stepper x2, inline-add confirm, catalog
      suggestion row, "from monthly" trigger, monthly-item row, confirm/cancel monthly-adds.
- [x] `components/NoteRow.tsx:77,98,104,111` — done check-circle (`0.97`), delete (`0.93`),
      two quick-action chips (`0.97`).
- [x] `components/HomeNotesCard.tsx:72,95,128,141,158` — title row, note check-circle, footer
      expand/collapse, done-zone header, checked-note check-circle.
- [x] `components/HomeShoppingCard.tsx:158,228,263` — title row, preview check-circle, footer
      expand/collapse.
- [x] `components/HomeSharedCard.tsx:70,81,104` — "see all" link, shared-item preview row (x2).
- [ ] `components/CatalogueTab.tsx:94,125,166,169,179,184` — add-new disclosure, save-new-item,
      commit-edit, delete-while-editing, item row tap, delete-item.
- [ ] `components/FoodTab.tsx` — non-backdrop elements only (`:370,405` popup backdrops and
      `:377,413` popup close are the only ones to double check against the exclusion list —
      popup *close* buttons are real buttons, convert those; the backdrop taps themselves are
      excluded): `:257,280,287,310,340,350,381,388,419,439,477,485`.
- [ ] `components/SavedListsModal.tsx:77,87` — saved-template row, "save current as template".
- [ ] `components/MonthlyResetSummaryModal.tsx:112` — "close" button. `scaleTo=0.95` (primary).

## Part 3, Phase 3 — Per-screen files

- [ ] `app/task-form.tsx:209,235,332,386,445,478,486,494` — save icon, weekday/duration/day
      chips, "then" task picker row, reorder up/down, remove step.
- [ ] `app/shared.tsx:86,194,228,208,242` — tab selector, done-toggle circles x2, remove x2.
- [ ] `app/health-form.tsx:82,228,248,262` — weekday chip, save icon, symptom suggestion row,
      "add new symptom" row. (Severity picker at this file's other Pressable is already
      converted — leave as-is.)
- [ ] `app/settings.tsx` — largest concentration (~20 sites): `:340` sub-tab item, `:405`
      language chip, `:540,566,570,577,592` account/backup links, `:603,607,611`
      reset-monthly/reset-tasks/reset-onboarding (destructive, `0.93`), `:650` check-updates,
      `:711` day-chip, `:764,777,783` child-mode ghost buttons, `:831` day-chip (child-mode),
      `:1001` Automations nav row.
- [ ] `app/health-log.tsx:103` — symptom summary row → detail. `scaleTo=0.97`.
- [ ] `app/health-detail.tsx:102` — log-entry row → edit form. `scaleTo=0.97`.
- [ ] `app/habit-form.tsx:225,265,322,329,346,393,415,443,475,482` — save icon, profile chip,
      reminder-count stepper x2, reminder-time chip, "show more" disclosure, icon-picker
      swatch, category chip, daily-goal stepper x2.
- [ ] `app/pair-device.tsx:197,219,237,246` — "remove device" (destructive), wizard cancel x2,
      QR-screen cancel.
- [ ] `app/budget.tsx:114,124,143,167,226,230` — month prev/next nav, "edit budget" link, "set
      budget" primary, sheet cancel, sheet save. (`:221` sheet backdrop — excluded.)
- [ ] `app/share-modal.tsx:155,170,208` — select/deselect-all toggle, shareable-item row,
      "done" primary.
- [ ] `app/onboarding/language.tsx:70` — language option row. `scaleTo=0.97`.
- [ ] `app/onboarding/step3.tsx:60` — reminder-day chip. `scaleTo=0.97`.
- [ ] `app/(tabs)/scan.tsx` — heaviest screen after settings (~20 sites): `:385,399` store
      chips, `:426` QR cancel, `:474,477` sheet cancel/add, `:504` budget pill nav, `:517`
      "take photo" primary, `:528,534` picker grid cards, `:542` "scan QR", `:585` item-row
      toggle, `:601` category chip, `:615,619` add/cancel confirm, `:640` category option row,
      `:699,709` manual-entry confirm/cancel. (`:450,633` backdrops — excluded.)
- [ ] `app/(tabs)/health.tsx:292,322,329,350,492,500,689,736,764,791,796,806,814,842` — habit
      card, adjust +/- x2, rest-day toggle, month nav x2, ailment row, view-log row, profile
      chip, confirm-add-child, two "add child" buttons, sub-tab, "no habits yet" add-row.
- [ ] `app/(tabs)/shopping.tsx:745,807,901,952,981,964,984,1075,1152,1155` — Weekly/Monthly
      tab, reset-monthly icon (destructive), purchased-section header, allocate-to-weekly x2,
      remove-item x2 (destructive), "new weekly list" card, reset-confirm No/Yes
      (Yes is destructive).
- [ ] `app/(tabs)/plans.tsx:216,287` — Today/This-week tab, "new task" draft card.
- [ ] `app/automations.tsx:85,114,133,168,171` — delete-rule (destructive), trigger/action
      chips x2, form cancel, form save.

---

## Explicitly excluded — do not convert (tracked here so nobody "fixes" these by mistake)

- Modal/sheet backdrop dismiss-taps: `AnimatedBottomSheet.tsx` backdrop, `AppModal.tsx`
  backdrop, backdrops in `AddItemSheet.tsx`, `ShoppingQuickAddSheet.tsx`,
  `app/(tabs)/scan.tsx` (`:450,633`), `app/budget.tsx` (`:221`), `FoodTab.tsx` popup backdrops.
- `ConfirmationBanner.tsx:106` — tap-to-dismiss on the banner itself (its `:113` Undo button
  IS converted, see Phase 1).
- `components/TimeBoxInput.tsx:83` — focuses a `TextInput`, not an action button.
- `components/DebugOverlay.tsx` — dev-only tooling, not shipped UX, skip entirely.

## Already done before this task started (reference implementations, don't re-touch)

`components/Button.tsx`, `components/IconButton.tsx`, `components/Badge.tsx` (`Chip`),
`components/BottomNav.tsx`, `components/FormControls.tsx`, `components/HintCard.tsx`,
`components/AppModal.tsx` (dialog buttons).
