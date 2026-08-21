# UnFocus — Interaction & Component Handoff

Purpose: define how controls in this app **behave and look**, so that new UI is
recognisable to a user who already uses other mobile apps.

**Read `DESIGN_RULES.md` first** — it states what any screen must satisfy and is the only
design doc backed by CI tests (tap targets + motion tokens, palette contrast, copy tone).
Where this file and `DESIGN_RULES.md` disagree, check `DESIGN_RULES_AUDIT.md`, which records
which rules are binding and which are open conflicts with a shipped decision. Then read
`ANIMATION_GUIDELINES.md` (timing, easing, haptics) and `AGENTS.md` (architecture, cookbook
tasks). For cards, surfaces and rows the source of truth is code, not a library doc:
`components/Surface.tsx`, `components/PadRow.tsx` and `components/PadSheet.tsx`.

The rule underneath all of this: **UnFocus should feel like a normal, calm
mobile app.** Novel controls are a tax on working memory. Nothing here should
need to be learned.

---

## 1. The control vocabulary

This is the complete set. If a design seems to need something outside it, stop
and ask.

| Need | Use | Never use |
|---|---|---|
| Complete a task | Round checkbox on the row's **trailing** edge | Square checkbox, swipe-only completion, long-press-to-complete |
| Primary action on a screen | One filled button, bottom of screen or FAB | Two primary buttons competing |
| Secondary action | Text button or outlined button | A second filled button |
| Binary setting | Platform switch (`FormControls.Switch`) | Checkbox, radio pair, segmented control |
| Pick 1 of 2–4 visible options | Segmented control — see "which segmented control" below | Dropdown |
| Pick 1 of 5+ options | Native picker / bottom sheet list with checkmark | Custom wheel, custom dropdown |
| Pick several | List rows with checkboxes | Multi-select chips that look like buttons |
| Destructive action | `showAppModal` or a bottom sheet, with the verb named ("Delete list") | A red button that fires immediately; a native `Alert.alert` |
| Numeric input | `components/Stepper.tsx` (− value +) for small ranges; numeric keypad for open ranges | Slider for anything the user must be precise about |
| Reveal secondary actions | The row's **⋯ button** (`PadRow`'s `onAction`) | Swipe or long-press as the route to an action |

**Checkbox specifics.** Round, not square — round reads as "task" across the
whole task-app category (Things, Todoist, Reminders, TickTick) and square reads
as "form field." That split is real in this codebase: every task/habit/shopping check is
`Radius.full`, and `FormControls.Checkbox` is square because it only ever appears in forms.

The check sits at the **trailing** edge of the row, not the leading edge. A paper checklist
puts its ticks in the right margin, and moving them there is what let the notepad rules run
the full width of a card (`ROW_DIVIDER_INSET` is retired). Applied app-wide 2026-07-30.

Tap target ≥ 44×44 regardless of the drawn size. The **body block** of the row opens detail;
the **check** completes. Those are two separate targets and the row does not do both — see §5
for the dead space between them.

**Which segmented control.** Three exist and they are not interchangeable:
`FormControls.SegmentedControl` (raised pill on a track) is the **form field**;
`components/SlideSelector.tsx` (accent fill) is an **inline option picker inside a card or
form** for one item; `components/TabSlider.tsx` is a **screen-level view switcher**. Picking
by look rather than by tier is how a fourth one gets added — don't.

**Gestures are additive, never the only route.** Long-press is spoken for app-wide: it is the
drag-to-reorder gesture (`lib/useDragReorder.ts`). Swipe-to-delete was deliberately removed
(it existed only on shopping rows, so a user who learned it found it worked nowhere else).
Neither may be the sole way to reach an action.

---

## 2. What "unnatural" looks like — the specific failures to avoid

1. **Custom-drawn switches.** Use the platform switch. A hand-rolled toggle is
   instantly uncanny and usually fails accessibility.
2. **Buttons that don't look tappable.** Every tappable thing gets a visible
   affordance: fill, outline, or underlined/coloured text. No invisible tap
   regions, no "tap the title to edit" without a hint.
3. **Icon-only controls without labels.** Every icon control needs a text
   label or, at minimum, an accessibility label. Ambiguous icons (a lightning
   bolt, a leaf) must never be the only signifier of a destructive or
   irreversible action. `components/IconButton.tsx` enforces this — `label` is a required
   prop, so an unlabelled icon control does not compile.
4. **Gesture-only functionality.** Anything reachable by swipe or long-press
   must also be reachable by a visible control, **or named in the surface's ⓘ hint**.
   Discoverability is not optional for this audience: an ADHD user who never happens to
   press-and-hold does not have the feature at all. Drag-to-reorder is taught this way in
   `hints.{home,shopping,habits,plans,notes}`.
5. **Confirmation dialogs on non-destructive actions.** Completing, uncompleting
   and editing never confirm. Deleting does.
6. **Anything that blocks first use.** A tour or an onboarding step is fine — what is
   forbidden is one that cannot be left. Every step must be individually skippable and the
   whole flow dismissible from any point, and a spotlight must keep the thing it points at
   live and tappable. `lib/tourSteps.ts` + `components/TourSpotlight.tsx` are built to this
   rule; the 8-page slideshow they replaced was not, which is why it is gone.
7. **Progress bars that imply failure.** A partially complete stepped card
   shows 3/7 in the normal accent colour, not red, not amber. `ProgressBar`'s `state` prop
   can go red — no call site passes it, and none should.
8. **Badge counts on everything.** Unread-style red badges create a debt
   feeling. Counts, if shown, are neutral-coloured.
9. **Streak mechanics that punish.** If a streak is shown at all, breaking it
   is silent — no "you lost your 14-day streak" screen. This app goes further and shows **no
   number at all**: the streak is a tint on the background that fades back to exactly the
   neutral art the app always had (`lib/growth.ts`). Neutral is the floor; there is no
   visibly worse state to land in.
10. **Time pressure the user didn't ask for.** No countdown UI on a card unless
    the user created a timed card.

---

## 3. Motion

- Purpose only **on controls and content**: state change, entry/exit, advancing a stepped
  card. No decorative motion on a control, no looping animation in a list, no parallax.
- **Ambient background layers are the one exception, and they carry the reward system.**
  `components/ParticleBackground.tsx` (a sparse drift) and `ScreenBackground`'s slow growth
  tint are deliberately decorative and deliberately looping. They are what lets §2.9 work at
  all — a numberless, non-punitive progress channel has to live somewhere. Conditions: behind
  content, `pointerEvents="none"`, off-switchable (`settings.particlesEnabled`), and gated on
  reduce-motion. Nothing new joins them without the same four.
- Short and non-bouncy. Follow the durations and easing already in
  `ANIMATION_GUIDELINES.md`; do not introduce new ones. Never a bare `duration: 220` —
  `Duration.*` from `constants/motion.ts`, enforced in CI.
- Completion feedback is a single quiet acknowledgement (a check fill and a
  light haptic). No confetti, no fireworks, no sound.
- Everything must respect **Reduce Motion**; when it's on, cross-fade or cut
  instead of translating.

---

## 4. Language on controls

- Buttons name the action: "Add task", "Delete list", "Save". Never "OK",
  "Submit", "Yes".
- Neutral, non-judging copy. No "You failed", "Overdue!", "Don't break the
  chain". Overdue reads as a date, in a muted colour, not red-alert styling. A tray or a task
  is "still due", never "missed" — `lib/__tests__/copyTone.test.ts` fails the PR.
- Norwegian strings must fit the same control widths — Norwegian labels run
  longer than English. Buttons wrap or **scale** (`adjustsFontSizeToFit`); they never
  truncate or clip. `npm run wraps -- --lang=no --width=360` is how you check, and Norwegian
  is the case that fails.

---

## 5. Density, targets, accessibility

- Minimum tap target 44×44 (iOS) / 48×48 dp (Android), via `MIN_TAP_TARGET` /
  `HitSlop.*` / `hitSlopFor(size)` — never a bare `44` or `hitSlop={8}`.
  - Known exception: `PAD_ROW_HEIGHT` is 38, a deliberate 2026-07-30 response to a user
    asking for tighter lines. It is open conflict #6 in `DESIGN_RULES.md`. The controls
    *inside* the row still reach target; the row body does not. Don't "fix" it in passing.
- **Minimum 8 dp between adjacent independent tap targets — and the measurement that matters
  is the touch area, not the drawn box.** Two controls 8px apart carrying 10px and 13px of
  hitSlop have *overlapping* touch areas, and RN hit-tests siblings in reverse order, so the
  later one silently wins. That was live in the trailing cluster (complete next to delete —
  this rule's own example) until 2026-08-01. `RowTrailing` in `constants/theme.ts` holds the
  fix and the arithmetic; `lib/__tests__/designTokens.test.ts` pins it.
  - It also records the trade: two fully compliant 44px targets with 8px between them need
    96px of row, and a 360px Norwegian shopping row hasn't got it. The pair lands at 39–40px
    wide and ≥44 tall — the axis a thumb actually misses on in a scrolling list.
- Body text never below 14 sp. All text must survive the app's font-scale cap without
  clipping — **that cap is 140%, not 200%** (`MAX_FONT_SCALE` in `constants/theme.ts`,
  applied to every `Text`/`TextInput` in `app/_layout.tsx`). A user at 200% system scale gets
  140%. Test at the cap before calling anything done. Raising it toward 200% is a real
  accessibility improvement and a real layout project — it breaks `getHeaderMetrics`' band
  math and the 360px Norwegian layouts — so it is a maintainer call, not a passing fix.
- Never encode meaning in colour alone: state also carries an icon, a label or
  a position.
- Contrast ≥ 4.5:1 for text, ≥ 3:1 for control boundaries, in both themes
  (`constants/colors.ts`'s `contrastRatio`, enforced by `colors.test.ts`).

---

## 6. Reference points

Where behaviour is unspecified here, match these rather than inventing:
Apple Reminders and Things 3 for task-row and checkbox behaviour, Todoist for
list conventions, Tiimo and Structured for calm neurodivergent-oriented visual
language, Finch for non-punitive progress feedback. Follow the
platform HIG (iOS) and Material 3 (Android) for anything still undefined.

---

## 7. Rules for you

- Do not invent a control type. If the vocabulary in §1 doesn't cover a need,
  stop and ask.
- Do not add a component that duplicates an existing one. Search first — and note that the
  three segmented controls above are the standing example of how this happens.
- No new colours, spacing values, radii or type sizes outside existing tokens
  (`constants/colors.ts`, `constants/theme.ts`, `constants/motion.ts` — three files, see
  `DESIGN_SYSTEM_LIBRARY_INDEX.md` for which owns what).
- No third-party UI dependency without asking first.
- When you finish a screen, list which controls you used from §1 and flag
  anything you had to improvise.

---

## Changelog — this file vs. the original handoff (2026-08-01)

The original was written against the app as imagined, not as shipped. Every change below
either follows a decision the code already made deliberately, or records a gap the code has.
Both directions are named so neither gets "fixed" back by accident.

**The doc bent to the app** (shipped decision was better or load-bearing):

| § | Was | Now | Why |
|---|-----|-----|-----|
| 1 | Checkbox on the leading edge | Trailing edge | App-wide 2026-07-30 call; it's what let the notepad rules run full-width. The doc would have driven a revert that silently breaks `PadSheet`'s rules. |
| 1 | Swipe + long-press menu for secondary actions | The ⋯ row button | The app deleted swipe on purpose and long-press is drag-reorder. The doc was prescribing a *weaker* pattern than what shipped, and one that would collide with reorder. |
| 2.6 | "No wizard, no tour" | "Nothing that blocks first use" | The tour keeps its target live and tappable and is skippable per-step and wholesale. The rule's concern is blocking; nothing here blocks. As written it read as an order to delete the feature that replaced the blocking slideshow. |
| 3 | "No decorative motion, no looping animation" | Ambient background layers carved out, with four conditions | As written it outlawed the exact mechanism (`lib/growth.ts` + the backdrop) that lets §2.9's non-punitive progress feedback exist. |
| 1 | One row for "pick 1 of 2–4" | Names which of the three segmented controls | §7 forbids duplicate components while §1 gave one answer for three tiers. |
| 1 | "The tap target extends to the whole card row for completion; the rest of the card opens detail only if the checkbox area is excluded" | Body opens detail, check completes | The original sentence contradicted itself — a row can't both. |
| — | Pointed at `CARD_CONTAINER_LIBRARY.md`; never mentioned `DESIGN_RULES.md` | Points at `DESIGN_RULES.md` first | That library was deleted 2026-08-01; `DESIGN_RULES.md` is the only design doc with CI behind it, so an agent reading only this file was missing all three enforced gates. |

**The app changed to meet the doc:**

- §5 tap-target spacing — the trailing cluster's touch areas overlapped by 13–15px and the
  check swallowed the right edge of the ⋯/×. Fixed via `RowTrailing`; pinned by test. This
  was the one item in the original that described a live defect rather than a preference.
- §2.4 gesture discoverability — drag-to-reorder became app-wide on 2026-08-01 with no
  visible control and no copy anywhere. Now named in five ⓘ hints, both languages.
- §1 destructive actions — the last two native `Alert.alert` confirms (goals) moved to
  `showAppModal`, so every confirm in the app now looks the same and is visible to the
  headless preview.
- §4 truncation — `TabSlider` clipped its label instead of scaling it.

**Recorded as an open gap, not fixed:** §5's 200% font scaling. The app caps at 140%. Raising
it is a layout project (header band math, 360px Norwegian) and a maintainer call.
