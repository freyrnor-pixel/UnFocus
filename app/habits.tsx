/**
 * habits.tsx — Habits (today's list only, 2026-08-06), its own bottom-nav tab.
 *
 * An optional child-profile selector and per-habit cards (progress, expandable week strip
 * + rest-day toggle, quick-add). **The Today/Week/Month browsing tabs are gone** — see the
 * dated edit note below; a habit is set up once with a recurrence + optional reminder, and
 * the maintainer's call was that browsing it by day/week/month is what a to-do is for.
 *
 * **Split out of app/(tabs)/health.tsx (2026-07-23, UX audit finding E1)**: Habits used
 * to be embedded inside the Health tab — but Health's tab name/icon promised symptom
 * tracking, and a whole separate habit-building system living inside it was a
 * name-vs-content mismatch a user had to learn by accident. This file is that embedded
 * section, unchanged in behavior, promoted back to its own bottom-nav tab (replacing
 * Scan — see lib/siteNav.ts's Edit notes for the full E1/E2 rationale). Health keeps
 * only its symptom-tracking content.
 *
 * ⚠️ **The CONTENT of this screen lives in components/HabitsSurface.tsx as of 2026-08-20.**
 * This file is a thin ScreenScaffold wrapper around it, the same shape app/(tabs)/plans.tsx has
 * around TodoSurface and app/health.tsx has around HealthSurface. Everything below this line is
 * the screen's own history and still describes what that surface draws — read it there, and
 * read that file's header for what the extraction itself changed (nothing visible: the split is
 * a move, and `embedded` only unwraps the screen-edge padding and the foot tree).
 * The reason for the split is that the Me tab's Habits card was the last card in the app with
 * no full-screen ⤢ button, because its registered expansion body was a placeholder.
 *
 * Connections:
 *   Imports → components/NarratorQuote (2026-08-19 — what a day with no habits due says),
 *             components/ScreenScaffold, components/StarterCard
 *             (and components/StarterSuggestionChip, 2026-08-12 — the shared empty-state
 *             suggestion chip that replaced this screen's hand-rolled `starterChip`)
 *             (2026-08-06 v3 — back on this screen, now carrying its own `collapsible`
 *             drop-down for the suggested-habits chips; see the v3 Edit note below),
 *             components/Surface,
 *             components/PadRow (2026-08-01 — the shared row shell each habit's header line is
 *             drawn through; see HabitCard's own PadRow mount for what that changed and for why
 *             PadSheet was NOT adopted with it), components/PadTypeRow (the always-open
 *             "Type habit" line at the foot of the
 *             Today list — replaced an AddRow that was wrapped in its own Surface, which is
 *             exactly what AddRow's header tells callers not to do), components/QuickAddOptionsPanel
 *             + components/QuickAddOptionRow (2026-08-04 — the type line's Energy row, closing
 *             the parity gap with HomeHabitsCard's own quick-add, which already had it),
 *             components/Stepper + lib/energy (energyFieldsFromStepper — that row's signed
 *             − 0 + control since 2026-08-05, replacing a tap-cycle; the type line also gained
 *             the "More options" button Home's copy already had, same date, same reason),
 *             components/HabitRecurrenceCells + lib/useHabitRecurrenceDraft (2026-08-11 —
 *             the "every N days/weeks" repeat picker + its conditional cells, rendered inside
 *             the same panel as the energy cell above; the state half (the hook) and the
 *             render half (the component) are split out because HomeHabitsCard.tsx mounts an
 *             IDENTICAL panel and the two are pinned against each other by
 *             lib/__tests__/energyModes.test.ts — see that hook's header),
 *             components/AnimatedListItem (habit
 *             add/remove fade), components/DraggableTaskRow (the long-press-drag gesture),
 *             components/GlowPulse (done-state static halo),
 *             components/HabitIcon (starter chips only — every ROW's leading mark goes through
 *             components/HabitLeading, 2026-08-04, which draws the brand leaf when a habit has
 *             no chosen icon), components/StageTree (2026-08-04 — the ambient `full`-stage
 *             corner watermark at the foot of the list; no longer shares a "one tree per
 *             screen" rule with anything since 2026-08-06 v2 — see below),
 *             components/PressableScale (the suggested-habits collapse/expand control lives in
 *             components/StarterCard now, not here),
 *             components/CollapsedSection + components/GoalsEditor (the "Goals" drawer —
 *             the same shape To-do draws; this link has been a card, then a hand-rolled row,
 *             then a shared `SubScreenLinkRow`, a drawer-onto-a-popup as of 2026-08-10, and
 *             is a drawer with the editor mounted straight in its body as of 2026-08-12 —
 *             components/GoalsSheet.tsx, the popup it used to open, is deleted; see the note
 *             below — also where a habit's linked goal shows its living-glow dot as of
 *             2026-08-06, not on this screen's own rows any more), components/DebugNoteAnchor,
 *             components/GhostRow (2026-08-01,
 *             the "just deleted this habit — restore?" row, see below),
 *             constants/theme, constants/motion (Duration, the registration flash), lib/date,
 *             lib/useNowMinutes (the tick that keeps `today` from going stale across
 *             midnight — see its call site; it is what the writes are dated by),
 *             lib/haptics, lib/habitStarters, lib/i18n,
 *             lib/useAppTheme, lib/useDragReorder (drag-to-reorder),
 *             lib/useGhostTimeout (2026-08-01, the ghost row's timing),
 *             lib/prefill (usePrefill — a note sent here seeds the quick-add), lib/domainColor,
 *             lib/habitRecurrence, store/useHabitStore, store/useSettingsStore
 *   - The person filter row + habit-form "For" chips are gated on settings.peopleModeEnabled
 *     (People/family mode). Profile add/remove lives in app/settings.tsx, not here.
 *   Used by → Expo Router route "/habits" — a PUSHED sub-screen since 2026-08-20 (5 tabs → 3),
 *             reached from "I dag" via components/HomeHabitsCard.tsx's header and its
 *             "see all" row. It has no BottomNav seat any more; the day's due habits are
 *             drawn on "I dag" itself and this screen is where a habit is set up and browsed.
 *   Data    → useHabitStore (habits + habit_logs) via increment/decrement/markRestDay/add;
 *             colour theme + language + child profiles + featureGoals from useSettingsStore
 *
 * Edit notes:
 *   - **Habits screen redesign (2026-08-06)**, five changes in one pass, all confirmed with
 *     the maintainer before landing:
 *     1. **Today/Week/Month tab-slider removed.** A habit is configured once (recurrence +
 *        optional reminder time) and Notifications take care of reminding — browsing it by
 *        day/week/month was judged to be what a to-do is for, not a habit. `WeekView`/
 *        `MonthView` and the segmented selector that switched between them are deleted; only the
 *        Today list remains. The per-HABIT expandable week-strip drawer (tap a row → 7-day
 *        dots + rest-day toggle) is UNCHANGED — that is a different, smaller thing (one
 *        habit's own recent history, not cross-habit browsing) and wasn't part of this ask.
 *        `settings.habitViewTab` is now an inert column (never dropped — see
 *        store/useSettingsStore.ts's "Inert columns" note).
 *     2. **Card sub-header**: `t.habits.cardSubtitle` at the top of the Habits Surface — it had
 *        no label or description of any kind since the 2026-07-30 pass removed its duplicate
 *        "Habits" title.
 *     3. **Always −/+ to register, never a check** — see the row-rule comment inside
 *        `HabitCard` for the full reasoning, and its new `flash` state for the momentary
 *        colour confirmation on each tap ("so they know it's been registered").
 *     4. **The goal's living-glow dot left this screen** and shows only on the goal card
 *        itself (components/GoalsEditor.tsx) — "the reward light indicator should be on the
 *        Goals, not the habits".
 *     5. ~~StarterCard is dismissible~~ **superseded 2026-08-06 v2 — see below.** The first
 *        pass put components/StarterCard.tsx here with a permanent `dismissKey="habits"` "X".
 *        That's gone from this screen; read the v2 note for what replaced it.
 *   - **Habits screen redesign v2 (2026-08-06, user feedback on the first pass)** — four more
 *     fixes, none of them new asks, all corrections of a first pass that didn't fully land:
 *     1. **Sub-header now actually reads as one.** It was small, muted, medium-weight text —
 *        visually identical to any other line of body copy. Now bold + full-contrast
 *        (`theme.text`) with its own breathing room.
 *     2. **(Superseded 2026-08-10.)** "Edit Goals" was moved INSIDE this card as a plain row,
 *        because components/SubScreenLinkButton drew its own `<Surface>` and so read as a
 *        second small card below the Habits card wherever its JSX sat — the fix had to be the
 *        SHAPE, not the position. It is a `<CollapsedSection>` drawer at screen level now; see
 *        the "Edit Goals" note below for why that is not a return to the thing this rejected.
 *     3. **The idle "Type habit" line no longer shows a ghost check ring** (`noGhostCheck` on
 *        PadTypeRow) — every habit row ends in a −/+ pair, never a check, so the ring used to
 *        preview a control that could never appear. The field widens into the freed space for
 *        free (`flex: 1`).
 *     4. **components/StarterCard.tsx is GONE from this screen, replaced by two separate,
 *        purpose-built pieces**: a plain "tips" line (`t.starters.habits.text`) directly under
 *        the sub-header, permanent and un-boxed; and a separate "suggested habits" card that
 *        COLLAPSES to a small pill on tap (`examplesCollapsed` state, `toggleExamples()`,
 *        LayoutAnimation — same pattern components/HintCard.tsx's own pill uses) rather than
 *        being permanently dismissed. It disappears ENTIRELY only once `allStartersAdded` is
 *        true — every one of the shown starter suggestions already exists as a habit,
 *        independent of `profileHabits.length` or the collapse state. `dismissKey`/
 *        `dismissedStarters` stay in use elsewhere (Goals) for the "hide for good" case; this
 *        screen no longer uses either. **Superseded 2026-08-06 v3 — see below.**
 *   - **Habits screen redesign v3 (2026-08-06)**: the v2 pass's hand-rolled pill/card toggle
 *     is GONE — components/StarterCard.tsx is BACK on this screen, now carrying the
 *     collapsible behavior itself (its new `collapsible`/`exampleHeaderLabel` props), so
 *     Habits, Goals, Plans and Health all share one identical collapse mechanism instead of
 *     five near-copies (the "cleaner suggestion that works for all cards" the maintainer
 *     asked for after seeing the v2 pass). `examplesCollapsed`/`toggleExamples()` and the
 *     hand-rolled `examplesCard`/`examplesPill` styles are deleted from this file along with
 *     the now-unused `LayoutAnimation`/`useAccessibility` imports — see StarterCard's own
 *     `collapsible` edit note for what replaced them. Two things carry over unchanged: the
 *     plain "tips" line stays exactly as v2 left it (permanent, un-boxed, under the
 *     sub-header — passed to StarterCard as nothing, since `text` is optional now and this
 *     screen already renders its own copy elsewhere, see StarterCard's Edit notes on why);
 *     and `!allStartersAdded` still gates whether the card mounts at all — StarterCard's
 *     `collapsible` only owns the collapse SHAPE while it's mounted, never that gate.
 *   - Decision 001 tier='site' scaffold (BottomNav + header chrome).
 *   - **Inline "ghost" undo row (2026-08-01)**: deleting a habit (there's no delete affordance
 *     on this screen — only app/habit-form.tsx's Delete button) is now a soft-delete
 *     (useHabitStore's `lastDeleted`), and the Today list renders a GhostRow with a restore
 *     action for a few seconds after, or until you leave this tab (lib/useGhostTimeout.ts),
 *     whichever is first. It's appended after the Today list's own empty/populated branch so it still
 *     shows even when deleting was the habit that made the list empty. habit-form.tsx's old
 *     confirm-before-delete dialog is gone with it — same "undo, not confirm" call already
 *     made for tasks.
 *   - **Edit Goals row (2026-07-29, moved + renamed + popup 2026-07-31; INLINED 2026-08-06)**:
 *     sits BELOW the Habits card, at the foot of the screen — after the habit list and
 *     quick-add, so it never outranks the day's habits. **It is a `<CollapsedSection>` drawer
 *     as of 2026-08-10** (components/CollapsedSection.tsx), the app's one shape for "a surface
 *     this screen leads to", shared with To-do's Goals + Earlier days and Shopping's Food +
 *     Catalogue. Expanding previews the goals; pressing the name opens the popup.
 *     **Why this is not a return to the card that was rejected.** The history: a
 *     `SubScreenLinkButton` card (2026-08-06) → a plain row inside the Habits card, because a
 *     bordered `<Surface>` whose whole content was one link read as a second small card
 *     floating below this one → the shared `SubScreenLinkRow` (2026-08-08) → this. What was
 *     wrong with the card was that it spent a card on a row's worth of information and could
 *     only ever be *followed*; a drawer shows what is behind it, which is what earns the card.
 *     A row inside the Habits card would now make this screen the odd one out.
 *     Gated on `featureGoals` — one of Goals' two entry points (the other is To-do), and as
 *     of 2026-08-12 one of only two, full stop: **app/goals.tsx is deleted**. That screen was
 *     a second implementation of this drawer's body — the same list, add row, starter chips
 *     and delete confirm as components/GoalsEditor.tsx, with its own copy of the confirm copy
 *     both headers used to tell each other to keep in sync. The `/goals` route is gone with
 *     it, so a note's "Send it to… → Goals" lands HERE now, in the `goals` prefill slot (see
 *     the `usePrefill` calls below and lib/prefill.ts). One thing was genuinely lost, not
 *     moved: that screen showed a goal's title uncapped, and a PadRow caps it at one line.
 *     That is the 2026-08-12 "read just like other cards" ruling applied consistently, not an
 *     oversight — the full title is still in the row's accessible name.
 *   - **No streaks (2026-07-20)**: the habit card shows an Energy badge (habit.energyValue,
 *     from the optional Energy system, lib/energy.ts) instead of a streak counter — only
 *     for habits with `energyEnabled`. Rest day no longer needs to "protect" anything (it
 *     never drove Energy) — see lib/energy.ts's habitMetOn for the exemption.
 *   - **Simplified (2026-07-30, user report: "this is generally too messy, simplify")**: three
 *     changes, no features removed. (1) The wrapping `SectionCard` became a plain `Surface`:
 *     its header label was the string "Habits" — this screen's own title, verbatim, a second
 *     time — and it made every habit card a Surface inside a Surface inside a Surface.
 *     (2) The add row's own Surface wrapper is gone (see PadTypeRow above). (3) `HabitCard`'s
 *     header followed the row rule: it used to pack up to NINE elements onto one line, and the
 *     goal dot / weekly progress / done state / energy badge moved onto ONE meta line under
 *     the title, with today's count as the single right-hand value. `hasMetaLine` must mirror
 *     that line's JSX gates exactly. **The done state left that line again on 2026-08-01**:
 *     once the row itself strikes through and fades (the PadRow conversion), a "Done today"
 *     word was a third copy of one fact — so the meta line held three things, not four, and
 *     `hasMetaLine` dropped `isDone` with it. **The goal dot left the meta line too, on
 *     2026-08-06** — see the redesign note above; `hasMetaLine` is down to two terms now
 *     (weekly progress, energy).
 *   - **Drag to reorder (2026-08-01)**: hold a habit card ~400ms and drag it, the same
 *     gesture Home's preview cards and the shopping list have always had, now shared through
 *     lib/useDragReorder.ts. Two things to know before touching it. The Today list is
 *     filtered by person AND by "is it due today", so the ids committed on drop are a SUBSET
 *     of the habits table — useHabitStore.reorder() slots them back among the rows the user
 *     couldn't see instead of renumbering the visible ones 0…n-1, so a habit that isn't due
 *     today keeps whichever habits it sat between. And the list must render from
 *     `habitDrag.order` (`draggedHabits`), never from `visibleHabits` directly, or nothing
 *     moves under the finger. (Week/Month views, which weren't draggable, are gone entirely
 *     as of 2026-08-06 — see the redesign note above.)
 *   - **Add-habit affordance (2026-07-13 rows pass)**: an inline `AddRow` at the bottom of
 *     the Today habit list is the add-habit trigger — a title-only quick-create with sensible
 *     defaults (icon/goal/recurrence via `commitHabit` → useHabitStore.add), matching Plans'
 *     AddRow → addTask flow; tap a habit card's settings-gear icon (2026-07-21, replaced
 *     long-press) to edit the rest in /habit-form. This
 *     replaced the old header "+" AddFAB (which navigated straight to the form).
 */import React from 'react';
import { useRouter } from 'expo-router';
import CenterModalScreen from '@/components/CenterModalScreen';
import HabitsSurface from '@/components/HabitsSurface';
import { useT } from '@/lib/i18n';

export default function HabitsScreen() {
  const router = useRouter();
  const t = useT();
  return (
    <CenterModalScreen
      title={t.habitsTitle}
      screenKey="habits"
      onClose={() => router.back()}
    >
      {/* No padding wrapper: components/CenterModalScreen.tsx pads its own body, and the
          card-stack gap belongs to HabitsSurface itself (see its `content` style). */}
      <HabitsSurface />
    </CenterModalScreen>
  );
}

