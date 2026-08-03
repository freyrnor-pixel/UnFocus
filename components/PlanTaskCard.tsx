/**
 * PlanTaskCard.tsx — one day's tasks, drawn either as a ruled list or as a calendar grid.
 *
 * This is the single shared "time now + rest of day" surface (Decisions 009 / 009a /
 * 009b). The To-do tab renders it interactively; the Home preview renders the
 * SAME component with `readOnly` (Decision 009a — "the preview IS the day-view,
 * rendered read-only"). There is intentionally no Home-specific variant.
 *
 * **Two layouts, one component (2026-07-30)**: `spec.timeline` (lib/cardLayout) picks the
 * clock-time calendar grid described below; anything else draws a ruled pad list
 * (components/PadSheet + PadRow) with the time as each row's one right-hand value. The two
 * surfaces DEFAULT differently on purpose, which is why `homeTodo` is its own LayoutSurface:
 * the To-do tab opens on the timeline (a 24h grid needs a whole screen to be readable), Home's
 * card on the list (so it matches its three sibling cards). Each offers the other in its
 * layout picker. Rows the active layout doesn't draw are still live rows — they keep their
 * reminders and still count in the header summary.
 *
 * **Card size** is the shared three-state cycle (lib/padState): closed → preview → open, via
 * components/PadFooterToggle. `expanded` below is just `state === 'open'`, so every "is the
 * whole day showing" check that predates this still reads correctly — including the
 * `HOME_PREVIEW_CARD_MIN_HEIGHT` floor, which applies while NOT open (closed and preview both)
 * so the four Home cards read as one size at rest, and never while open, so a full day can grow
 * as tall as it needs.
 *
 * **Elastic-hour grid (2026-07-26 rebuild, compressed 2026-07-27)**: the vertical (default)
 * rail positions every timed task by real clock time (`lib/dayGrid.ts` +
 * `components/DayGridLines.tsx`), the way Google Calendar's day view works — but on an
 * ELASTIC axis rather than a uniform 24h one. `buildDayScale()` keeps full hour spacing
 * around anything real (each task's span padded by `DENSE_PAD_MIN`, plus a window around
 * `now`) and folds every empty stretch between them into a single short dashed band whose
 * height is a log curve of the real gap. So the tasks themselves stand out, and "how long
 * in between" still reads at a glance, without a mostly-blank 1248px day (2026-07-27 user
 * report: "timeline should be more compressed"). The scale is built once here and passed to
 * both `DayGridLines` and `layoutGridEntries`, so lines and cards can never disagree. The
 * resting viewport is `min(scale.totalHeight, COLLAPSED_GRID_HEIGHT)` auto-scrolled to now;
 * the expand toggle grows it to the full axis — and only appears when the axis genuinely
 * doesn't fit, since a compressed day usually does. Untimed ("Anytime") tasks have no clock
 * position, so they stay a plain flat list above the grid, capped at `COLLAPSED_COUNT` and
 * expanded by the same toggle. The "Done today" zone is a separate dimmed, collapsed flat
 * list below the grid (Decision 009a); done tasks don't render on the grid. **It is replaced
 * by the day log when that is on** — see below.
 *
 * **The day log (2026-08-02) — the now-line becomes the BOUNDARY.** When the caller passes
 * `dayLog` (lib/dayLog.ts, gated on `settings.featureDayLog`), this card is split in two by
 * the current minute, and the two halves get deliberately OPPOSITE treatment:
 *   - *Behind now*: a flush, spacing-free list of what already happened — completed tasks,
 *     doses taken, health entries, captured moments. Fixed row height, no duration, no gap,
 *     no time axis, no section heading, and no count anywhere.
 *   - *Ahead of now*: the elastic grid below, with `buildDayScale({ startMinutes: now })` so
 *     the axis spans [now → end of day] rather than the full 24h.
 * A gap ahead of you is room; the identical gap behind you is an accusation — that collapse
 * at the now-line is the entire feature, so don't "tidy" the log by giving it spacing, an
 * hour rule, or a "3 of 9" header. It also REPLACES the "Done today" zone while active
 * (both would draw the same completed task twice); that zone still renders with the flag
 * off, and is still the only home for a completed task with no `done_at`.
 * The horizontal rail is untouched by all of this, same call the grid rebuild made.
 *
 * The pre-elastic model was a "fixed-hour" grid (every hour the same height, whole 24h axis),
 * which itself replaced an earlier "proportional" rail (connector size ∝ the real gap,
 * clamped) — the compression here is the proportional idea done on the calendar model rather
 * than instead of it.
 *
 * Two rail orientations (toggle: settings.accessibility "Horizontal plans timeline"):
 * `horizontal=false` (default) is the fixed-hour grid described above. `horizontal=true`
 * is untouched by the 2026-07-26 rebuild — it keeps the older left-to-right proportional
 * rail (time boxes connected by a horizontal line, clamped gap sizing) since a horizontal
 * fixed-hour axis wasn't part of what was asked for and the accessibility setting is a
 * secondary, opt-in mode. `renderColumn`/`renderHSpacer`/`hNowMarker`/`hGapMarker` and the
 * `PX_PER_MIN`/`MIN_GAP`/`MAX_GAP`/`railTailMinutes` tuning are horizontal-only now.
 *
 * Connections:
 *   Imports → components/PadSheet + components/PadRow + components/PadTypeRow +
 *             lib/cardType (isCompletable / steppedProgress — the per-ITEM card types.
 *             This surface carries the MINIMUM the types require of it: a 'note' draws no
 *             checkbox anywhere and counts for nothing in the summary/progress bar, and a
 *             'stepped' row shows its progress as its one right-hand value. The full
 *             four-type rendering and the type picker live in components/TaskCard.tsx.
 *             Note "type" here is unrelated to PadTypeRow below, which is about TYPING),
 *             components/PadFooterToggle (the ruled-list layout, the type line and the
 *             three-size footer — the type line is ONE node AND, since 2026-08-03, ONE mount
 *             point, hoisted above the body branch so it holds the same position in all four
 *             states this card has; see the comment at that mount), lib/cardLayout (LayoutSpec, type
 *             only), lib/padState (PadState, padVisibleRows),
 *             components/Surface, components/PressableScale, components/ProgressBar,
 *             components/DayGridLines (hour lines + compressed-gap bands + now-line),
 *             components/StarterExampleRow (the empty day's suggested-add row),
 *             lib/dayLog (DayEntry + formatEntryTime — TYPES AND FORMATTING ONLY; the
 *             entries themselves arrive as the `dayLog` prop, because this card cannot
 *             derive its own date and app/day-log.tsx renders a different day through it),
 *             lib/dayGrid (buildDayScale — the elastic axis — plus layoutGridEntries,
 *             the overlap-aware column layout; see its file header),
 *             components/AddRow (inline "add a task" quick-create, gated on the optional
 *             onAddTask callback — Home preview passes it) + components/TimeBoxInput
 *             (quick-add's inline time field), components/Collapsible + components/AnimatedChevron
 *             (done-zone reveal + chevron), react-native-reanimated (FadeInDown/FadeOutDown/
 *             LinearTransition for the anytime list + done-zone + footer, which share one
 *             `containerLayout` LinearTransition so the whole card reflows together),
 *             constants/theme, constants/motion, lib/haptics, lib/i18n,
 *             lib/useNowMinutes (the 60s "now" tick behind the grid's now-line — shared
 *             with components/MedicineTrayCard.tsx since 2026-07-27),
 *             lib/useEnergyPause (2026-08-02 — which card "I'll decide" pinned, and the
 *             un-pin action behind its badge; see the edit note below for why this one hook
 *             is read here instead of being threaded in as a prop),
 *             lib/useAppTheme (incl. useAccessibility), lib/domainColor, components/CardAccent
 *             (CardAccentBadge — the read-only Home header), components/GlowPulse
 *             (breathing "happening now" halo), store/useTaskStore (Task type only)
 *   Used by → app/(tabs)/index.tsx (Home — read-only day-view preview per Decision 009a) and
 *             app/(tabs)/plans.tsx (the To-do tab, interactively, whenever the active layout
 *             is the timeline — `spec.timeline`). Both read settings.planTimelineHorizontal
 *             and pass it down as the `horizontal` prop; this component stays
 *             store-free/presentational.
 *             **The "Home is now the sole caller" note this line carried until 2026-08-03 was
 *             stale** — true when /plans was rebuilt into a tabbed inline-list (2026-07-08),
 *             untrue since the timeline layout landed (2026-07-30), which mounts this card
 *             again at plans.tsx's `spec.timeline` branch. Two callers, one component; a
 *             change here shows up on both surfaces, which is exactly what made the type
 *             line's two mount points a cross-surface inconsistency rather than a local one.
 *   Data    → presentational; tasks + callbacks + orientation are passed in. Live "now" line
 *             re-renders on a 60s interval (useNowMinutes). ONE exception to "reads no
 *             stores" since 2026-08-02: `useEnergyPause()` (see the pin edit note below).
 *
 * Edit notes:
 *   - **Overlap-safe grid cards (2026-07-26, user report: "not clean, make sure things don't
 *     overlap" — Outlook/Google Calendar as reference)**: `renderGridEntry` used to position
 *     every timed card at full slot width regardless of other tasks, so two overlapping tasks
 *     (or a short task's `MIN_TASK_HEIGHT` floor bleeding into whatever started next) visually
 *     stacked on top of each other. `timedLayout` (`layoutGridEntries`, lib/dayGrid.ts) now
 *     computes a column + height clamp per entry; a new `gridCardColumn` wrapper (nested inside
 *     the existing `gridCardWrap` slot) applies that as percentage left/width, with a hairline
 *     `gridCardColumnGapped` inset only when genuinely side-by-side, so the common
 *     no-overlap case renders pixel-identical to before.
 *   - **Collapse/expand toggle fixed (2026-07-26, user report: "lacks capability to expand and
 *     show the whole day")**: `isVisible`/`showToggle` used to short-circuit on `readOnly` —
 *     every pending task was ALWAYS visible (readOnly is always true, Home being the sole
 *     caller) and the "Show more" footer button NEVER rendered. Both now ignore `readOnly`.
 *     Superseded in spirit by the grid rebuild right after it (expand now grows the grid's
 *     viewport to the full day rather than revealing more rows of a flow-list), but the
 *     underlying bug — a toggle that could never appear — was real and is fixed either way.
 *   - **Collapsed sizing (2026-07-13, padding restored 2026-07-15)**: `cardCollapsed`
 *     (minHeight: `HOME_PREVIEW_CARD_MIN_HEIGHT`, constants/theme.ts) is a compact shared
 *     *resting* floor applied only while `!expanded`, so this card reads the same size as
 *     HomeNotesCard/HomeShoppingCard on a light day — it's a floor, not a cap; the grid's own
 *     `COLLAPSED_GRID_HEIGHT` (lib/dayGrid.ts) does the real height budgeting for the timed
 *     portion now.
 *   - **Empty state (2026-07-24 text removed → 2026-07-25 blank row → hour ruler → 2026-07-26
 *     real grid → 2026-07-27 explainer + suggestion → 2026-07-30 the teaching moved to the
 *     foot)**: an empty day (`showEmpty`) renders one real suggested-add row
 *     (`StarterExampleRow`, its "+" wired through `onAddExample`) where the content would be,
 *     and the explainer (`t.starters.plans.text`) as a `components/CardHintNote` at the very
 *     bottom of the card. Until 2026-07-30 the explainer LED the block and an uppercase
 *     "Example tasks" caption sat under it — three lines of teaching between the title and the
 *     first thing you could act on. The caption's job (a suggestion styled to look like a real
 *     row reads as an actual task) is done by the row's own `tag` chip now; see
 *     StarterExampleRow's header.
 *     That whole block replaced an empty hour grid, which filled the space
 *     without teaching anything — the user asked for "example text by default when the card is
 *     empty, and a row with suggested adds, designed the same as the other rows".
 *     `components/DayHourScale` existed only for that empty-grid branch and was deleted with
 *     it. A dashed "add a plan" ghost row that deep-links to /plans still shows as a FALLBACK
 *     when no inline add is wired (`readOnly && !onAddTask`). The distinct "all done" state
 *     keeps its own `t.dayViewAllDone` line — it's a reward, not an empty card.
 *   - **Delete + restore (2026-07-27, user report: "no apparent way to delete and recover
 *     deleted tasks")**: `onDeleteTask` adds a trash to every row (flat rows put it under the
 *     done-toggle in `doneCol`; grid cards put it beside the toggle in the `gridActions` corner
 *     stack, which is why `gridCardInner`'s right padding is conditional). No confirm dialog —
 *     deliberately, because `deletedTasks` + `onRestoreTask` render a "Recently deleted" drawer
 *     shaped exactly like the done zone, so the undo is right there. Gated on the callbacks,
 *     not on `readOnly`, same rule as the done-toggle and `onAddTask`.
 *   - **Decision 014 (revised 2026-07-14)**: the card face is a `<Surface>` with a
 *     domain-colored border (`borderColor={getDomainColor(theme,'plan').accent}`) on a plain
 *     `theme.surface` fill, so the section reads as belonging to Plans without washing the
 *     whole card in a tint (2026-07-13's whole-card blend read as muddy — see domainColor.ts).
 *     Still don't set Surface's fill/sheen directly — pass `borderColor`/`tint` and let the
 *     material compute the finish (Surface owns border/sheen/blur since Decision 008).
 *   - **Decision 020 follower surfacing (surfacing-only, NOT notifying)**: when a
 *     predecessor is done, its pending follower is highlighted AND — per Session 1's
 *     resolution of open sub-question (b), "pull the follower into today's view" (which
 *     supersedes Decision 020's own "highlight in place" leaning) — a cross-date follower
 *     is pulled into this day-view. Pass `allTasks` (the full store list) so cross-date
 *     followers can be found; without it, only same-list followers surface.
 *   - **The "I'll decide" pin (2026-08-02, lib/useEnergyPause.ts)**: when the day is over
 *     budget the user can settle on ONE card; it gets a pin badge and everything else on this
 *     card drops to `DONE_ROW_OPACITY`. Four things worth knowing before editing it:
 *       1. **The badge is the un-pin button.** There is no row menu to add one to — the ⋯ here
 *          is hard-wired to delete and long-press is drag-reorder — so the badge is a labelled,
 *          visible, one-tap control on its own (INTERACTION_HANDOFF §2.4).
 *       2. **Dimming is opacity and nothing else.** A dimmed row keeps its height, its check,
 *          its ⋯, its reminders and its place in the header count, and is still one tap from
 *          its editor. Same contract as a lib/cardLayout.ts layout: de-emphasise, never remove.
 *       3. **Only the ruled LIST reorders.** `listTasks` lifts the pinned row to the head; the
 *          timeline leaves every card exactly where its clock puts it and adds only the badge.
 *       4. **A pin whose row isn't drawn here doesn't apply** (`pinnedId` re-checks `dayTasks`).
 *          Nothing clears a pin when its task is finished, and a pin with no on-screen badge
 *          would dim the card with no way back.
 *     The horizontal accessibility rail (`renderColumn`) is deliberately untouched: its 92px
 *     columns have no leading slot, and dimming it without a badge would leave the state
 *     carried by opacity alone.
 *   - **Decision 019 hint**: a task's `hint` renders under its title (display-only) while
 *     the task is "up" (current or next), so the reminder shows exactly when it's useful.
 *   - `readOnly` (Home preview) disables row tap-through only — structure, grid,
 *     collapse/expand, and done zone are identical (Decision 009a). The done-toggle is
 *     independently gated on whether `onToggleTask` is passed (not on `readOnly`), so the
 *     Home preview's checkbox stays interactive while row tap-through into the editor
 *     stays disabled. `onAddTask` follows the same "gate on callback, not readOnly" rule —
 *     pass it to render the trailing inline AddRow so a task can be created from the
 *     read-only Home preview without navigating to /plans (2026-07-24).
 *   - **Quick-add essential settings (2026-07-24, energy chip removed 2026-08-01)**: the type
 *     line's `extras` carry two compact inline controls beyond the title — a `TimeBoxInput`
 *     (start time, optional) and a repeat chip that cycles none→daily→weekly→monthly (defaults
 *     `recurringDays` to today's weekday the first time it lands on weekly, mirroring
 *     TaskCard's own toggleRepeat). Both reset to their defaults after each commit. `onAddTask`'s
 *     second argument carries whichever the user touched; the caller (Home) owns turning that
 *     into a full `TaskInput` the same way it already does for the title-only case. Energy
 *     moved to being a Habits-only quick-add setting (HomeHabitsCard) rather than duplicated
 *     here — a task's energy value is still fully editable, just via "…"/the full editor now.
 *   - **`onAddTaskAndEdit` / "…" (2026-08-01)**: same draft as `onAddTask`, but the caller also
 *     navigates to the just-created task's full editor (TaskCard, via `plans.tsx`'s
 *     `expandTaskId` — built for a note's "Add to plans" flow, previously uncalled) instead of
 *     just collapsing the row. Same saved row either way, so further edits there aren't a
 *     second copy. Gated on its own presence, independent of `onAddTask`.
 *   - **Anytime badge (2026-07-15)**: untimed rows carry a small "Anytime" text pill in
 *     `titleRow` — they have no clock position (no grid row/dot to mark them anymore since
 *     the 2026-07-26 rebuild dropped the old dashed rail marker along with the flow-list
 *     rail), so the pill is now the only "this is untimed" cue.
 *   - **Completion feedback (2026-07-11, visual-audit)**: no card-level glow/bloom on
 *     completion — user feedback called the whole-card colour flash "too much"; the
 *     checkbox fill + strikethrough (plus the success() haptic in handleToggle) IS the
 *     feedback. The habit-card glow (app/(tabs)/health.tsx) is untouched — this was
 *     Home/Plans-specific.
 *   - **"Selects" the happening-now task (2026-07-26, user report)**: the grid card whose
 *     [start,end) contains `now` gets a stronger tint, a thicker border, and a slight
 *     `transform: scale` bump on top of the existing breathing `GlowPulse` halo — so the one
 *     task the live now-line touches reads as clearly larger/selected, not just differently
 *     tinted. This is unconditional now (no longer suppresses a separate "now" indicator —
 *     the grid's own now-line, drawn by `DayGridLines`, always shows regardless of whether a
 *     task is happening, exactly like Google Calendar's red line does).
 *   - `styles.dot` is the checkmark-circle toggle — a small `PressableScale` rendered as a
 *     sibling (never nested inside) the tappable content, positioned as a trailing column in
 *     flat rows (anytime list, done zone) or pinned to a grid card's top-right corner.
 *   - **Touch target (2026-07-11)**: the done-toggle `dot` is visually 16x16 but
 *     `hitSlop={HitSlop.loose}` brings the tappable area to ~48dp, meeting Android's minimum
 *     touch-target size.
 *   - **Purposeful Depth System (2026-07-14)**: passes Surface's `elevated` when
 *     `expanded` — the card the user has actively opened to see the full day becomes
 *     the deepest surface (focus-pop).
 *   - **Collapse feel (2026-07-15)**: the anytime list's rows exit with `FadeOutDown` (not a
 *     plain in-place `FadeOut`) — this app's motion goal for a neurodivergent audience is that
 *     things read as *retreating to somewhere*, never blinking out of existence. The anytime
 *     list, done-zone, and footer all share `containerLayout` (see Connections) so the whole
 *     card reflows as one card rather than several pieces animating on their own clocks. Grid
 *     cards (absolute-positioned by time) don't participate in this — their position is a
 *     direct function of `now`/task time, not list order, so there's no "reflow" for them to
 *     animate.
 *   - **Done-zone frame + calmer toggle (2026-07-16)**: `styles.doneZone` carries a real
 *     border + `theme.surfaceMuted` background so the "Done today" header and its collapsed
 *     rows read as one card — a step subtler than the outer `Surface` so it doesn't stack two
 *     heavy card looks. Its (and the footer show-more toggle's) `PressableScale` passes
 *     `releaseSpring={Spring.calm}` (constants/motion) — a near-critically-damped spring
 *     instead of the default bouncy release, since these are repeatedly-tapped toggles.
 *   - The header's old live-clock chip is gone — the grid's own now-line (via `DayGridLines`)
 *     is the live clock now, since this component IS the calendar.
 *   - **Historical trap, now avoided rather than worked around (2026-07-24 → 2026-07-30)**: the
 *     header badge and the header wash used to be absolutely positioned siblings of
 *     `cardContent`, because React Native's native behaviour is that an absolutely-positioned
 *     child DOES inherit its parent's padding as part of its origin, while react-native-web
 *     (this repo's headless preview tooling) does NOT — it compiles straight to CSS, where the
 *     absolute containing block is the padding *edge*. Testing that offset against the web
 *     preview alone was actively misleading. Both are gone: the badge is an ordinary flex child
 *     (see `headerTopRow`'s style note), and the wash was deleted outright on 2026-07-31
 *     (addendum A.4 rule 3). Don't reintroduce an absolutely-positioned header element here.
 *   - **(2026-07-31, addendum A.4) The identity hue is a FILL only** — the badge, and the card's
 *     own low-alpha `borderColor` edge. Never a text or icon colour on this card; the quick-add
 *     chips and the section header's chevron read `theme.text`/`theme.textMuted` and show their
 *     on/off state through their border + soft fill, which is the channel that survives both
 *     greyscale and the four-hue collapse.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Surface from '@/components/Surface';
import PressableScale from '@/components/PressableScale';
import ProgressBar from '@/components/ProgressBar';
import DayGridLines from '@/components/DayGridLines';
import PadSheet from '@/components/PadSheet';
import PadRow from '@/components/PadRow';
import PadTypeRow from '@/components/PadTypeRow';
import PadFooterToggle from '@/components/PadFooterToggle';
import CardHintNote from '@/components/CardHintNote';
import Collapsible from '@/components/Collapsible';
import AnimatedChevron from '@/components/AnimatedChevron';
import TimeBoxInput from '@/components/TimeBoxInput';
import { Task, Recurring } from '@/store/useTaskStore';
import { DONE_ROW_OPACITY, FontSize, Fonts, HOME_PREVIEW_CARD_MIN_HEIGHT, PAD_GUTTER, Radius, RowTrailing, Spacing, TabularNums, rgba, HitSlop } from '@/constants/theme';
import type { LayoutSpec } from '@/lib/cardLayout';
import { isCompletable, visibleStepNumber } from '@/lib/cardType';
import { PadState, padVisibleRows } from '@/lib/padState';
import { Duration, Ease, Spring } from '@/constants/motion';
import { useAppTheme, useScaledStyles, useAccessibility } from '@/lib/useAppTheme';
import { success, tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { getDomainColor } from '@/lib/domainColor';
import { dayOfWeekMon0 } from '@/lib/date';
import { useNowMinutes } from '@/lib/useNowMinutes';
import { useEnergyPause } from '@/lib/useEnergyPause';
import { CardAccentBadge } from '@/components/CardAccent';
import GlowPulse from '@/components/GlowPulse';
import StarterExampleRow from '@/components/StarterExampleRow';
import { COLLAPSED_GRID_HEIGHT, GUTTER_WIDTH, GridEntryLayout, buildDayScale, layoutGridEntries } from '@/lib/dayGrid';
import { DayEntry, formatEntryTime } from '@/lib/dayLog';
import type { DeviceCalendarEvent } from '@/lib/deviceCalendar';

type Props = {
  /** Tasks scheduled for the viewed date (already filtered by the caller). */
  tasks: Task[];
  /** Full store list — lets cross-date followers surface into this view (Decision 020). Defaults to `tasks`. */
  allTasks?: Task[];
  /** Home preview: disables row tap-through only (Decision 009a). Done-toggle is
   *  independently gated on whether `onToggleTask` is passed — pass it to keep the
   *  checkbox interactive even when `readOnly` is set. */
  readOnly?: boolean;
  onPressTask?: (task: Task) => void;
  onToggleTask?: (task: Task) => void;
  /** Inline quick-add: when passed, an AddRow renders at the bottom of the card and calls this
   *  with the typed title (plus whichever of the extras row's essential settings the user set)
   *  to create an undated task dated today. Gated on the callback's presence, NOT on `readOnly`
   *  — so the read-only Home preview can still add a task (same "gate on callback, not
   *  readOnly" pattern as the done-toggle). */
  onAddTask?: (
    title: string,
    extra: { time?: string; recurring: Recurring; recurringDays: number[] }
  ) => void;
  /** "…" quick-add action (2026-08-01): commits the same draft as onAddTask, then the caller
   *  navigates to the just-created task's full editor (TaskCard, via expandTaskId) pre-filled
   *  — same saved row, so further edits there aren't a second copy. Gated on its own presence,
   *  same "gate on the callback" rule as onAddTask/onDeleteTask/onToggleTask. */
  onAddTaskAndEdit?: (
    title: string,
    extra: { time?: string; recurring: Recurring; recurringDays: number[] }
  ) => void;
  /** Read-only preview: shows a "See everything →" link in the section header. */
  onSeeMore?: () => void;
  /** When passed, every row gets a trash action. Gated on the callback, not on `readOnly`
   *  (same rule as the done-toggle) so the Home preview can delete without a trip to /plans. */
  onDeleteTask?: (task: Task) => void;
  /** Restorable tombstones (store/useTaskStore's `deletedTasks`) — renders the "Recently
   *  deleted" zone under the done zone. Pass together with `onRestoreTask`. */
  deletedTasks?: Task[];
  onRestoreTask?: (task: Task) => void;
  /** Empty-state suggestion: creates the example task shown while the day has nothing on it. */
  onAddExample?: () => void;
  /**
   * The day log (2026-08-02) — what has ALREADY happened on this day, oldest first, from
   * lib/dayLog.ts. Passing it turns the now-line into the boundary this card is split by:
   * these rows render flush and spacing-free above it, and the grid below it starts at
   * `now` instead of midnight.
   *
   * Gated on the prop's presence, the same "gate on what you pass, not on readOnly" rule
   * every other capability here follows. The caller passes it only when
   * `settings.featureDayLog` is on, which is why this component needs no flag of its own —
   * and why it stays free of the store read that would otherwise be needed (it cannot
   * derive its own date; app/day-log.tsx renders a different day through the same prop).
   *
   * Deliberately NOT completable and NOT reorderable: these already happened, and the list
   * is ordered by the clock, so there is nothing to tick and no honest way to drag.
   */
  dayLog?: DayEntry[];
  /** Tap a log row to open the record it came from. Entries with no `sourceId` (a moment
   *  IS its own record) are never pressable regardless. */
  onPressEntry?: (entry: DayEntry) => void;
  /** The ⋯ on a captured moment — the ONLY log entry that can be removed. Derived entries
   *  have no delete: you cannot un-happen a dose or a completed task from a record of it. */
  onRemoveMoment?: (id: string) => void;
  /**
   * Capture a day-log moment from the pad's type-line — the SAME field that adds a task,
   * with a chip in its extras row switching which of the two a submit commits.
   *
   * Deliberately not a second input and not a modal: the app's capture path is the pad
   * type-line (the standalone quick-capture inbox was removed 2026-07-27; `inbox_items` is
   * a dead table). One field, one submit, and the store stamps the time itself — the
   * signature takes a string and nothing else, which is the guardrail against this
   * quietly becoming a form.
   */
  onCaptureMoment?: (text: string) => void;
  /**
   * Device-calendar events for this day (lib/deviceCalendar.ts), read-only.
   *
   * They are **structure, not achievement**: they draw on the grid ahead of the now-line,
   * and they never enter the day log behind it — a meeting existing in your calendar is
   * not something you did. Never completable (no check is drawn), never editable, and
   * nothing here writes back to the device calendar.
   */
  calendarEvents?: DeviceCalendarEvent[];
  /** Test/preview override for the live clock (minutes since midnight). */
  now?: number;
  /** Rail orientation — settings.planTimelineHorizontal. Default false (fixed-hour grid). */
  horizontal?: boolean;
  /**
   * How this surface draws its rows (lib/cardLayout). `spec.timeline` picks the clock-time
   * calendar grid; anything else draws a ruled pad list. The To-do tab defaults to the
   * timeline, Home's card to the list — see lib/cardLayout's LayoutSurface note.
   */
  spec: LayoutSpec;
  /**
   * Card size (lib/padState): closed → preview → open. Omit to keep it as local state (the
   * default), pass together with `onPadStateChange` to persist it per surface.
   */
  padState?: PadState;
  onPadStateChange?: (next: PadState) => void;
};

// Horizontal-only proportional rail tuning (2026-07-26: the vertical/default rail moved to
// the fixed-hour grid, lib/dayGrid.ts — these only tune the opt-in horizontal accessibility
// mode now). Connector size between two timed tasks = the real gap in minutes × PX_PER_MIN,
// clamped legible.
const PX_PER_MIN = 0.45;
const MIN_GAP = 10;
const MAX_GAP = 56;
const DEFAULT_BOX_MIN = 30; // start-at tasks get a nominal span so "happening now" works

const DONE_COL_WIDTH = 40;
// Grid task-card floor (lib/dayGrid.ts's HOUR_HEIGHT=52 means a 30min default span is only
// ~26px — too short for a title + padding to sit comfortably) so short/undurationed tasks
// stay legible and tappable.
const MIN_TASK_HEIGHT = 40;
// Hairline gap between two grid cards that would otherwise touch (same-lane clamp, or
// side-by-side columns) — enough to read as separate cards without wasting grid space.
const GRID_CARD_GAP = 2;

// Horizontal rail column sizing.
const H_COLUMN_WIDTH = 92;
const H_RAIL_HEIGHT = 30;
const H_CONTENT_HEIGHT = 40;

function toMinutes(time: string): number | null {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToLabel(mins: number): string {
  const h = Math.floor((((mins % 1440) + 1440) % 1440) / 60);
  const m = ((mins % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

type TimedEntry = { task: Task; start: number; end: number };

/**
 * One thing on the grid — either an app task or a device-calendar event. Exactly one of
 * `task`/`event` is set. They share a list so a single `layoutGridEntries` pass can put an
 * overlapping meeting and task side by side instead of stacking them.
 */
type GridItem = { start: number; end: number; task?: Task; event?: DeviceCalendarEvent };

type RailItemOpts = {
  timed?: TimedEntry;
  isHappeningNow?: boolean;
  isPast?: boolean;
  /** Flat rows (anytime list, done zone) fade/slide in + reflow when the "Show more/less"
   *  toggle mounts/unmounts them; done-zone rows omit this (their reveal is owned by the
   *  Collapsible wrapper). */
  animateIn?: boolean;
};

function timedEntryOf(task: Task): TimedEntry {
  const start = toMinutes(task.time!) ?? 0;
  const end = task.taskType === 'time-box' ? start + (task.durationMinutes ?? DEFAULT_BOX_MIN) : start + DEFAULT_BOX_MIN;
  return { task, start, end };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Horizontal-only (Decision 009b) — proportional tail = 10% of the visible span, floored at 15 min. */
function railTailMinutes(spanMinutes: number): number {
  return Math.max(spanMinutes * 0.1, 15);
}

// Anytime-list cap, and (horizontal-only) current+next+3 after. Distinct from
// PAD_PREVIEW_ROWS, which caps the ruled-list layout's rows — this one governs the
// timeline's own flat "Anytime" strip above the grid.
const COLLAPSED_COUNT = 5;

/**
 * Which glyph a day-log row leads with, per source (lib/dayLog.ts's DayEntryKind).
 *
 * The icon is the ONLY thing distinguishing the kinds — every row otherwise renders
 * identically, because the log answers "what happened", not "what kind of thing happened".
 * That is also why it is an icon rather than a colour: DESIGN_RULES rule 11, never colour
 * alone, and the row must survive greyscale.
 */
const DAY_LOG_ICONS: Record<DayEntry['kind'], keyof typeof Ionicons.glyphMap> = {
  task: 'checkmark-circle-outline',
  habit: 'repeat',
  medicine: 'medkit-outline',
  health: 'pulse-outline',
  moment: 'ellipse-outline',
  calendar: 'calendar-outline',
};

export default function PlanTaskCard({
  tasks,
  allTasks,
  readOnly = false,
  onPressTask,
  onToggleTask,
  onAddTask,
  onAddTaskAndEdit,
  onSeeMore,
  onDeleteTask,
  deletedTasks,
  onRestoreTask,
  onAddExample,
  dayLog,
  onPressEntry,
  onRemoveMoment,
  onCaptureMoment,
  calendarEvents,
  now: nowOverride,
  horizontal = false,
  spec,
  padState,
  onPadStateChange,
}: Props) {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const { reducedMotion } = useAccessibility();
  const styles = useScaledStyles(baseStyles);
  const domainColor = getDomainColor(theme, 'plan');
  const liveNow = useNowMinutes();
  const now = nowOverride ?? liveNow;
  // Energy's "I'll decide" (2026-08-02). Read here rather than passed in as a prop: both
  // callers (Home and the To-do tab's timeline layout) would otherwise have to derive and
  // thread the same answer, and the hook is already the one place it is derived. It returns a
  // frozen inert object with a null `pinnedTaskId` in Rewards mode, so nothing below fires
  // there. See the header's Data note — this is the component's ONE store read.
  const energyPause = useEnergyPause();

  // Gate row entrance animations to genuine post-mount reveals (the "Show more" toggle),
  // so the initially-visible collapsed rows don't all fade in on every navigation to Home.
  const hasMounted = useRef(false);
  useEffect(() => {
    hasMounted.current = true;
  }, []);

  // Card size. `expanded` (the old boolean) is now just the top of the three-state cycle, so
  // every "is the whole day showing" check below keeps working unchanged.
  const [localPadState, setLocalPadState] = useState<PadState>('preview');
  const state = padState ?? localPadState;
  const setState = onPadStateChange ?? setLocalPadState;
  const expanded = state === 'open';
  const [doneOpen, setDoneOpen] = useState(false);
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [addDraft, setAddDraft] = useState('');
  const [addTime, setAddTime] = useState('');
  const [addRecurring, setAddRecurring] = useState<Recurring>('none');
  const [addRecurringDays, setAddRecurringDays] = useState<number[]>([]);
  /** Which of the two things the shared type-line commits. Task is the default and stays
   *  the default — nothing about the existing add path changes until this is pressed. */
  const [captureAsMoment, setCaptureAsMoment] = useState(false);

  const gridScrollRef = useRef<ScrollView>(null);

  function cycleRecurring() {
    tap();
    setAddRecurring((current) => {
      if (current === 'none') return 'daily';
      if (current === 'daily') {
        setAddRecurringDays((days) => (days.length ? days : [dayOfWeekMon0(new Date())]));
        return 'weekly';
      }
      if (current === 'weekly') return 'monthly';
      return 'none';
    });
  }

  function recurringLabel(mode: Recurring): string {
    if (mode === 'daily') return t.taskRecurDay;
    if (mode === 'weekly') return t.taskRecurWeek;
    if (mode === 'monthly') return t.taskRecurMonth;
    return t.off;
  }

  function draftExtra() {
    return {
      time: addTime || undefined,
      recurring: addRecurring,
      recurringDays: addRecurring === 'weekly' ? addRecurringDays : [],
    };
  }

  function resetDraft() {
    setAddDraft('');
    setAddTime('');
    setAddRecurring('none');
    setAddRecurringDays([]);
  }

  /**
   * Capture the draft as a day-log moment instead of a task.
   *
   * Free by design (the feature's invariant 5): one field, one submit, no category, no
   * required field, no confirmation dialog and no edit flow on creation. The store stamps
   * the day and time itself, because a moment IS its timestamp — nothing is passed here
   * but the words. `resetDraft` clears and PadTypeRow keeps focus, so a second line costs
   * nothing.
   *
   * The mode deliberately STAYS on after a submit: someone capturing one thing that just
   * happened is usually about to capture the next one.
   */
  function commitMoment() {
    const text = addDraft.trim();
    if (!text || !onCaptureMoment) return;
    onCaptureMoment(text);
    resetDraft();
  }

  function commitAdd() {
    const title = addDraft.trim();
    if (!title || !onAddTask) return;
    onAddTask(title, draftExtra());
    resetDraft();
  }

  // "…" — commits the same draft as the checkmark, then the caller (Home/plans.tsx) opens the
  // just-created task's full editor pre-filled. Same saved row either way.
  function commitAddAndEdit() {
    const title = addDraft.trim();
    if (!title || !onAddTaskAndEdit) return;
    onAddTaskAndEdit(title, draftExtra());
    resetDraft();
  }

  // Decision 020 — surfaced followers: for each DONE task, its pending follower is
  // highlighted and (sub-question b) pulled into this view even if it lives on another
  // date. The pointer lives on the follower row (follower.followsTaskId === done.id).
  const { dayTasks, surfacedIds } = useMemo(() => {
    const source = allTasks ?? tasks;
    const surfaced = new Set<string>();
    const extra: Task[] = [];
    const present = new Set(tasks.map((task) => task.id));
    for (const done of source) {
      if (!done.done) continue;
      const follower = source.find((f) => f.followsTaskId === done.id && !f.done);
      if (!follower) continue;
      surfaced.add(follower.id);
      if (!present.has(follower.id)) {
        extra.push(follower);
        present.add(follower.id);
      }
    }
    return { dayTasks: [...tasks, ...extra], surfacedIds: surfaced };
  }, [tasks, allTasks]);

  /** Presence of the `dayLog` prop is the gate — see its own doc on the Props type. */
  const dayLogActive = !!dayLog;

  const anytimePending = useMemo(() => dayTasks.filter((task) => !task.time && !task.done), [dayTasks]);
  const timedPending = useMemo(
    () => dayTasks.filter((task) => !!task.time && !task.done).map(timedEntryOf).sort((a, b) => a.start - b.start),
    [dayTasks]
  );
  // Vertical/default rail only — the elastic axis (lib/dayGrid.ts's buildDayScale): full
  // hour spacing around the tasks themselves, empty stretches folded into one short labelled
  // band each. Built once here and shared with DayGridLines so the lines and the cards drawn
  // over them can't disagree. `now` is included so the live line always has real context
  // around it instead of landing inside a compressed band.
  // With the day log on, the grid draws only what is still AHEAD. An entry whose window has
  // fully passed has no honest position on an axis that starts at `now` — several of them
  // would all clamp to the top edge and stack on each other. They are still DUE (nothing
  // here calls them missed — same framing as an untaken medicine tray), so they move to the
  // flat list above the grid and sit alongside the untimed ones.
  const gridEntries = useMemo(
    () => (dayLogActive ? timedPending.filter((e) => e.end > now) : timedPending),
    [timedPending, dayLogActive, now]
  );
  const stillDueTasks = useMemo(
    () => (dayLogActive ? timedPending.filter((e) => e.end <= now).map((e) => e.task) : []),
    [timedPending, dayLogActive, now]
  );
  /**
   * Everything the grid draws, tasks and device-calendar events together, in one list.
   *
   * They MUST share a single `layoutGridEntries` pass: that's what puts a meeting and a
   * task that overlap in time into side-by-side columns instead of stacking one on the
   * other. Two separate passes would each think it had the width to itself.
   *
   * Calendar events are still structure, not achievement — they draw here, ahead of the
   * now-line, and never enter the day log behind it. See lib/deviceCalendar.ts.
   */
  const gridItems = useMemo<GridItem[]>(() => {
    const items: GridItem[] = gridEntries.map((e) => ({ start: e.start, end: e.end, task: e.task }));
    for (const event of calendarEvents ?? []) {
      // Same "still ahead" filter the tasks got — a meeting that's over belongs to the day
      // behind you, and the log deliberately doesn't claim it as something you did.
      if (dayLogActive && event.endMinutes <= now) continue;
      // A zero/negative-length event would collapse to nothing on the axis; give it the
      // same nominal span a start-at task gets so its title stays legible.
      const end = Math.max(event.endMinutes, event.startMinutes + DEFAULT_BOX_MIN);
      items.push({ start: event.startMinutes, end, event });
    }
    // layoutGridEntries REQUIRES start-ascending input.
    return items.sort((a, b) => a.start - b.start);
  }, [gridEntries, calendarEvents, dayLogActive, now]);

  const dayScale = useMemo(
    () =>
      buildDayScale(gridItems.map((e) => ({ start: e.start, end: e.end })), {
        now,
        ...(dayLogActive ? { startMinutes: now } : {}),
      }),
    [gridItems, now, dayLogActive]
  );
  // Side-by-side columns for genuinely overlapping tasks, plus a height clamp so the
  // MIN_TASK_HEIGHT floor can't visually run into whatever starts next (see lib/dayGrid.ts's
  // file header for why both are needed), all measured on the elastic axis above.
  const timedLayout = useMemo(
    () => layoutGridEntries(gridItems, { minHeightPx: MIN_TASK_HEIGHT, gapPx: GRID_CARD_GAP, y: dayScale.y }),
    [gridItems, dayScale]
  );
  // Everything on the day that can actually be finished (2026-08-01, card types): a 'note'
  // card has no completion state, so it is listed like any other row but counts for nothing
  // — not in the summary, not in the progress bar's denominator, not in the done zone. A day
  // holding one task and three notes reads "1 left of 1" and reaches a full bar, rather than
  // being permanently stuck at a quarter done.
  const countableTasks = useMemo(() => dayTasks.filter((task) => isCompletable(task.cardType)), [dayTasks]);
  const doneTasks = useMemo(() => countableTasks.filter((task) => task.done), [countableTasks]);

  const pendingCount = countableTasks.length - doneTasks.length;

  // The pinned card, but only while this surface is actually DRAWING it as a pending row.
  // Nothing clears a pin when its task is finished or leaves the day, and a pin whose badge is
  // nowhere on screen would dim the whole card with no visible way back — so the pin simply
  // stops applying here instead. Presentation only, and it self-heals: the row coming back
  // brings its badge back with it.
  const pinnedId = useMemo(() => {
    const id = energyPause.pinnedTaskId;
    if (!id) return null;
    return dayTasks.some((task) => task.id === id && !task.done) ? id : null;
  }, [energyPause.pinnedTaskId, dayTasks]);

  const isPinned = (task: Task) => task.id === pinnedId;
  /** Every OTHER row while one is pinned. Opacity only — see `rowDimmed`'s style note. */
  const isDimmedByPin = (task: Task) => !!pinnedId && task.id !== pinnedId;

  // The ruled-list layout's rows: timed tasks in clock order first, then Anytime. Deliberately
  // NOT the grid's `timedLayout` — that carries pixel geometry a flat list has no use for.
  //
  // The pinned row lifts to the HEAD of this list. That is safe here and only here: a flat
  // list has no axis to lie about. The timeline below deliberately does NOT reorder — a 09:00
  // task drawn above a 14:00 one on a clock is false, which is the same reason Today isn't
  // drag-reorderable (AGENTS.md's drag rule). There the pin is the badge alone.
  const listTasks = useMemo(() => {
    const rows = [...timedPending.map((e) => e.task), ...anytimePending];
    if (!pinnedId) return rows;
    const at = rows.findIndex((task) => task.id === pinnedId);
    if (at <= 0) return rows;
    return [rows[at], ...rows.slice(0, at), ...rows.slice(at + 1)];
  }, [timedPending, anytimePending, pinnedId]);

  // Auto-scrolls the grid's collapsed viewport to the current hour — on mount, whenever the
  // card collapses back down, and whenever the grid's own task count changes (e.g. a task is
  // added/removed, which is also when the ScrollView node underneath `gridScrollRef` first
  // mounts, since the grid isn't rendered at all until `timedPending.length > 0`). Deliberately
  // NOT re-run on every `now` tick (every 60s) alone — that would yank a manual scroll away
  // from wherever the user was looking.
  useEffect(() => {
    if (expanded) return;
    const y = Math.max(0, dayScale.y(now) - COLLAPSED_GRID_HEIGHT / 3);
    gridScrollRef.current?.scrollTo({ y, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, timedPending.length]);

  // Current = the timed task happening right now; otherwise the next one leads.
  const currentTimedIndex = timedPending.findIndex((e) => now >= e.start && now < e.end);
  const nextTimedIndex = currentTimedIndex >= 0 ? currentTimedIndex : timedPending.findIndex((e) => e.start > now);

  // Horizontal-only (Decision 009b tail): visible-span for the proportional tail —
  // axis-start (first timed start) → last unfinished end.
  const spanMinutes = timedPending.length > 0
    ? Math.max(1, timedPending[timedPending.length - 1].end - timedPending[0].start)
    : 0;
  const tailPx = timedPending.length > 0 ? clamp(railTailMinutes(spanMinutes) * PX_PER_MIN, 10, MAX_GAP) : 0;

  // Horizontal-only collapse window: the current/in-progress task always leads, then next + 2
  // after (Decision 009a). The vertical grid always renders every timed task (its viewport
  // height/scroll, not task filtering, is what "collapsed" means there — see showToggle).
  const timedStart = nextTimedIndex >= 0 ? nextTimedIndex : 0;
  const collapsedVisibleH = useMemo(() => {
    const ids = [
      ...anytimePending.map((task) => task.id),
      ...timedPending.slice(timedStart).map((e) => e.task.id),
    ].slice(0, COLLAPSED_COUNT);
    return new Set(ids);
  }, [anytimePending, timedPending, timedStart]);

  function isVisibleH(id: string): boolean {
    return expanded || collapsedVisibleH.has(id);
  }

  // Vertical: the anytime list caps independently of the grid (which always shows every
  // timed task) — same "current + next + a few more" spirit, just not mixed with timed IDs.
  // `stillDueTasks` joins them when the day log is on: those rows came OFF the grid because
  // their clock window has passed, and this flat strip below the now-line is where a thing
  // that is still due but no longer has a future slot honestly belongs.
  //
  // `!horizontal` matters. The horizontal rail is deliberately untouched by the day log
  // (same call the 2026-07-26 grid rebuild made — it's a secondary, opt-in accessibility
  // mode), and it renders `timedPending` in full via `hTimedItems`. Adding the still-due
  // rows here too would draw each of them twice on that rail.
  const flatPending =
    dayLogActive && !horizontal ? [...stillDueTasks, ...anytimePending] : anytimePending;
  const visibleAnytime = horizontal
    ? flatPending.filter((task) => isVisibleH(task.id))
    : expanded
      ? flatPending
      : flatPending.slice(0, COLLAPSED_COUNT);

  // `showToggle` is gone (2026-07-30): the footer is components/PadFooterToggle.tsx now, and it
  // cycles three card sizes rather than answering one "does the day fit?" question. It hides
  // itself when there is nothing to reveal (`total === 0`), which covers the case this used to —
  // a toggle that expands to the height it already had.

  // The single task considered "up" (current or next) — the one whose hint is worth
  // showing right now (Decision 019).
  const upNextId = currentTimedIndex >= 0
    ? timedPending[currentTimedIndex].task.id
    : nextTimedIndex >= 0
      ? timedPending[nextTimedIndex].task.id
      : anytimePending[0]?.id;

  function handleToggle(task: Task) {
    if (!onToggleTask) return;
    if (!task.done) success();
    onToggleTask(task);
  }

  function handlePress(task: Task) {
    if (readOnly || !onPressTask) return;
    onPressTask(task);
  }

  /** A stepped row's right-hand value: which step it is on, or that they're all done. Same
   *  wording components/TaskCard.tsx uses, so one item reads the same on both surfaces. */
  function steppedLabel(steps: Task['steps']): string {
    const n = visibleStepNumber(steps);
    return n === null ? t.cardTypes.allDone : t.cardTypes.progress(n, steps.length);
  }

  function doneToggle(task: Task, isHappeningNow?: boolean) {
    // A 'note' card has no completion state, so it draws no checkbox — here as well as in
    // components/TaskCard.tsx. The control must be absent rather than present-and-inert.
    if (!isCompletable(task.cardType)) return null;
    return (
      <PressableScale
        disabled={!onToggleTask}
        hitSlop={HitSlop.loose}
        onPress={() => handleToggle(task)}
        accessibilityRole="checkbox"
        // Named after its row (2026-08-02). It was an anonymous "checkbox" to a screen
        // reader — in a day full of them, that says nothing about which task it ticks.
        // Matches components/PadRow.tsx's `toggleLabel`, which defaults to the title for
        // exactly this reason, so the two layouts of this card now announce identically.
        accessibilityLabel={task.title}
        accessibilityState={{ checked: task.done }}
        scaleTo={0.97}
      >
        <View
          style={[
            styles.dot,
            // Idle checkbox ring uses textMuted so the unchecked dot reads clearly (the
            // border token is too faint for a tap target); happening-now/done fill = accent.
            { borderColor: isHappeningNow ? theme.accent : theme.textMuted },
            (isHappeningNow || task.done) && { backgroundColor: theme.accent, borderColor: theme.accent },
          ]}
        >
          {task.done && <Ionicons name="checkmark" size={10} color={theme.accentInk} />}
        </View>
      </PressableScale>
    );
  }

  /** Trash action for one row — rendered only when the caller wired `onDeleteTask`. The
   *  delete is undoable (store/useTaskStore's tombstone + the restore zone below), so it
   *  intentionally does NOT put a confirmation dialog in the way of a one-tap tidy-up. */
  function deleteButton(task: Task) {
    if (!onDeleteTask) return null;
    return (
      <PressableScale
        hitSlop={12}
        onPress={() => {
          tap();
          onDeleteTask(task);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t.dayViewDeleteTask} ${task.title}`}
        scaleTo={0.9}
      >
        <Ionicons name="trash-outline" size={15} color={theme.textMuted} />
      </PressableScale>
    );
  }

  /**
   * The "I'll decide" pin badge — and the un-pin button, since there is nothing else on these
   * rows to hang one off (the ⋯ is hard-wired to delete, long-press is drag-reorder). Drawn in
   * the row's LEADING slot on every rendering this card has, which is the same slot
   * components/TaskCard.tsx and components/PadRow.tsx use, so one task carries the same mark
   * wherever it shows up. Carries the pin glyph as well as the accent — the state never rests
   * on colour alone.
   *
   * Touch area: `RowTrailing.actionSlop` is clipped on the right, the side it shares with the
   * row body, and the badge is the EARLIER sibling — RN resolves an overlap to the later one,
   * so the overhang loses to the body rather than the badge stealing a tap. Its own drawn box
   * is always its own.
   */
  function pinBadge(task: Task) {
    if (!isPinned(task)) return null;
    return (
      <PressableScale
        hitSlop={RowTrailing.actionSlop}
        onPress={() => {
          tap();
          energyPause.unpin();
        }}
        accessibilityRole="button"
        accessibilityLabel={t.energyPause.pinnedLabel}
        style={[styles.pinBadge, { borderColor: theme.accent, backgroundColor: rgba(theme.accent, 0.12) }]}
        scaleTo={0.9}
      >
        <Ionicons name="pin" size={13} color={theme.accent} />
      </PressableScale>
    );
  }

  // Horizontal-only — the vertical grid draws its own time boxes as part of each grid card.
  function timeMarker(task: Task, timed: TimedEntry | undefined, dimmed: boolean, isHappeningNow: boolean | undefined, surfaced: boolean) {
    if (!timed) return <View style={[styles.anytimeDot, { borderColor: theme.border }]} />;
    return (
      <View
        style={[
          styles.timeBox,
          { borderColor: isHappeningNow ? theme.accent : theme.border },
          isHappeningNow && { backgroundColor: rgba(theme.accent, 0.14) },
          surfaced && !task.done && { borderColor: theme.accent, borderWidth: 2.5 },
          task.done && { opacity: 0.55 },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.timeBoxText, TabularNums, { color: isHappeningNow ? theme.accent : dimmed ? theme.textMuted : theme.text }]}
        >
          {task.time}
        </Text>
      </View>
    );
  }

  /** The shared title-row + hint content, used by both flat rows (anytime/done) and grid
   *  cards — only the outer wrapper (flow row vs. absolute-positioned card) differs. */
  function taskCardContent(task: Task, opts: { timed?: TimedEntry; dimmed: boolean; showHint: boolean; surfaced: boolean; showAnytimeBadge: boolean }) {
    const { timed, dimmed, showHint, surfaced, showAnytimeBadge } = opts;
    return (
      <>
        <View style={styles.titleRow}>
          {timed && (
            <Text style={[styles.flatTimeText, TabularNums, { color: theme.textMuted }]}>{task.time}</Text>
          )}
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: dimmed ? theme.textMuted : theme.text },
              task.done && { textDecorationLine: 'line-through' },
            ]}
          >
            {task.title}
          </Text>
          {timed && task.taskType === 'time-box' && (
            <Text style={[styles.durationText, TabularNums, { color: theme.textMuted }]}>–{minutesToLabel(timed.end)}</Text>
          )}
          {showAnytimeBadge ? (
            <View style={[styles.followerBadge, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, borderWidth: 1 }]}>
              <Text style={[styles.followerBadgeText, { color: theme.textMuted }]}>{t.dayViewAnytimeBadge}</Text>
            </View>
          ) : null}
          {surfaced && !task.done ? (
            <View style={[styles.followerBadge, { backgroundColor: domainColor.soft }]}>
              {/* A.4 rule 1: hue on the plate, plain ink on the word. */}
              <Text style={[styles.followerBadgeText, { color: theme.text }]}>{t.dayViewFollowerBadge}</Text>
            </View>
          ) : null}
        </View>
        {showHint ? (
          <View style={styles.hintRow}>
            <Ionicons name="bulb-outline" size={12} color={theme.textMuted} />
            <Text style={[styles.hintText, { color: theme.textMuted }]} numberOfLines={2}>
              {task.hint}
            </Text>
          </View>
        ) : null}
      </>
    );
  }

  /** Flat (non-grid) row — the anytime list and the "Done today" zone, both orientations.
   *  No rail/gutter marker any more (2026-07-26 rebuild dropped it with the old flow rail) —
   *  an inline time reading (if timed) plus the "Anytime" pill are the only position cues. */
  /**
   * The day log — everything that already happened, above the now-line.
   *
   * Deliberately the OPPOSITE treatment to the grid below it: fixed row height, flush,
   * nothing proportional, no duration, no gap, no time axis. A gap ahead of you is room;
   * the same gap behind you is an accusation, and the collapse at the now-line is the
   * whole feature. Do not add spacing, a rule per hour, or a "3 of 9" header here.
   *
   * There is no section heading on purpose — labelling it `Completed` / `Gjennomført`
   * turns a record into a scorecard.
   */
  function renderDayLog() {
    if (!dayLog || dayLog.length === 0) return null;
    return (
      <View style={styles.dayLogList}>
        {dayLog.map((entry) => (
          <PadRow
            key={entry.id}
            title={entry.label}
            accent={domainColor.accent}
            leading={
              <Ionicons
                name={DAY_LOG_ICONS[entry.kind]}
                size={14}
                color={theme.textMuted}
                // Rule 11 — never colour alone. The icon is the kind cue and it survives
                // greyscale; nothing here is told apart by hue.
              />
            }
            rightValue={formatEntryTime(entry.atMinutes)}
            // No `onToggle` anywhere in this list: these already happened, so there is
            // nothing to tick. PadRow draws no check when it has nothing to call.
            onPress={entry.sourceId && onPressEntry ? () => onPressEntry(entry) : undefined}
            // Only a captured moment can be removed — you cannot un-happen a dose or a
            // completed task from a record of it.
            onAction={
              entry.kind === 'moment' && onRemoveMoment
                ? () => { tap(); onRemoveMoment(entry.id.replace(/^moment:/, '')); }
                : undefined
            }
            actionLabel={t.dayLog.deleteMoment}
          />
        ))}
      </View>
    );
  }

  /**
   * The now-line as a divider, drawn only when the day log is on.
   *
   * Static by design: it re-evaluates on the shared 60s tick and on focus, and it never
   * animates, ticks or counts. Nothing should move in peripheral vision on this surface.
   */
  function renderNowDivider() {
    if (!dayLogActive) return null;
    return (
      <View style={styles.nowDivider}>
        <View style={[styles.nowRule, { backgroundColor: theme.border }]} />
        <Text style={[styles.nowLabel, { color: theme.textMuted }]}>{t.dayLog.now}</Text>
        <View style={[styles.nowRule, { backgroundColor: theme.border }]} />
      </View>
    );
  }

  function renderFlatRow(task: Task, opts: RailItemOpts) {
    const { timed, isPast, animateIn } = opts;
    const dimmed = !!(task.done || isPast);
    const surfaced = surfacedIds.has(task.id);
    const isUp = task.id === upNextId;
    const showHint = isUp && !!task.hint && !task.done;
    const anim = animateIn && !reducedMotion && hasMounted.current;

    return (
      <Animated.View
        key={task.id}
        style={[styles.flatRow, isDimmedByPin(task) && styles.rowDimmed]}
        entering={anim ? FadeInDown.duration(Duration.listIn).easing(Ease.enter) : undefined}
        exiting={anim ? FadeOutDown.duration(Duration.cardOut).easing(Ease.exit) : undefined}
        layout={anim ? LinearTransition.duration(Duration.listMove).easing(Ease.move) : undefined}
      >
        {pinBadge(task)}
        <PressableScale style={styles.flatContent} onPress={() => handlePress(task)} disabled={readOnly || !onPressTask} scaleTo={0.97}>
          <View
            style={[
              styles.rowCard,
              { backgroundColor: rgba(theme.accent, 0.05) },
              { borderColor: rgba(domainColor.accent, 0.2) },
            ]}
          >
            {taskCardContent(task, { timed, dimmed, showHint, surfaced, showAnytimeBadge: !timed && !task.done })}
          </View>
        </PressableScale>
        <View style={styles.doneCol}>
          {doneToggle(task, false)}
          {deleteButton(task)}
        </View>
      </Animated.View>
    );
  }

  /** Grid card — a timed pending task, absolutely positioned on the fixed-hour grid by its
   *  real start/end time (lib/dayGrid.ts). Vertical/default orientation only. `layout` carries
   *  the overlap-aware column + height clamp from `layoutGridEntries` so genuinely-overlapping
   *  tasks render side-by-side (Google Calendar style) instead of stacking on top of each other. */
  /**
   * A device-calendar event on the grid.
   *
   * Visibly a different KIND of thing from a task, and that difference is the point: no
   * check (it isn't yours to finish), no trash, no press-through to an editor, a dashed
   * border and muted ink. It marks out the shape of the day — "how much runway before the
   * next fixed thing" — and claims nothing about what you achieved.
   *
   * Rule 11 — the distinction is carried by the border STYLE and an icon, not by colour,
   * so it survives greyscale.
   */
  function renderCalendarEntry(event: DeviceCalendarEvent, layout: GridEntryLayout) {
    const { top, height, leftPct, widthPct } = layout;
    const sideBySide = widthPct < 100;
    return (
      <View
        key={`cal:${event.id}`}
        style={[styles.gridCardWrap, { top, height, left: GUTTER_WIDTH + Spacing.xs, right: Spacing.xs }]}
      >
        <View
          style={[
            styles.gridCardColumn,
            { left: `${leftPct}%`, width: `${widthPct}%` },
            sideBySide && styles.gridCardColumnGapped,
          ]}
        >
          <View
            style={[
              styles.rowCard,
              styles.gridCardInner,
              styles.calendarCard,
              { borderColor: theme.border, backgroundColor: theme.surfaceMuted },
            ]}
          >
            <View style={styles.titleRow}>
              <Ionicons name="calendar-outline" size={12} color={theme.textMuted} />
              <Text style={[styles.durationText, TabularNums, { color: theme.textMuted }]}>
                {minutesToLabel(event.startMinutes)}
              </Text>
              <Text numberOfLines={1} style={[styles.title, { color: theme.textMuted }]}>
                {event.title}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  function renderGridEntry(entry: TimedEntry, layout: GridEntryLayout) {
    const { task, start, end } = entry;
    const isHappeningNow = now >= start && now < end;
    const isPast = !isHappeningNow && now >= end;
    const surfaced = surfacedIds.has(task.id);
    const isUp = task.id === upNextId;
    const showHint = isUp && !!task.hint;
    const { top, height, leftPct, widthPct } = layout;
    const sideBySide = widthPct < 100;

    return (
      <View
        key={task.id}
        style={[
          styles.gridCardWrap,
          { top, height, left: GUTTER_WIDTH + Spacing.xs, right: Spacing.xs },
          isDimmedByPin(task) && styles.rowDimmed,
        ]}
      >
        {/* The pinned card keeps its slot on the clock — `top`/`height` above are untouched by
            the pin. Only the badge is added, laid out as a leading sibling (the column turns
            into a row for it); `gridActions` is absolutely positioned, so it doesn't move. */}
        <View
          style={[
            styles.gridCardColumn,
            { left: `${leftPct}%`, width: `${widthPct}%` },
            sideBySide && styles.gridCardColumnGapped,
            isPinned(task) && styles.gridCardColumnPinned,
          ]}
        >
          {pinBadge(task)}
          <PressableScale style={styles.gridCardPressable} onPress={() => handlePress(task)} disabled={readOnly || !onPressTask} scaleTo={0.97}>
            <View
              style={[
                styles.rowCard,
                styles.gridCardInner,
                // Room for the corner action stack — one toggle, or a trash + toggle pair.
                { paddingRight: onDeleteTask ? 48 : 28 },
                // Ordinary cards: a soft accent wash instead of drab grey (debug-note 2026-07-21)
                // — still clearly set apart from plain-surface cards, but warmer. The
                // happening-now card keeps the stronger tint + glow so hierarchy is preserved.
                { backgroundColor: isHappeningNow ? rgba(theme.accent, 0.1) : rgba(theme.accent, 0.05) },
                { borderColor: rgba(domainColor.accent, isHappeningNow ? 0.5 : 0.2) },
                // "Selects" the happening-now task (2026-07-26, user report) — see file header.
                isHappeningNow && { borderWidth: 2, transform: [{ scale: 1.03 }] },
              ]}
            >
              <GlowPulse active={isHappeningNow} color={domainColor.accent} mode="breathe" radius={Radius.sm} />
              {taskCardContent(task, { dimmed: isPast, showHint, surfaced, showAnytimeBadge: false })}
            </View>
          </PressableScale>
          <View style={styles.gridActions}>
            {deleteButton(task)}
            {doneToggle(task, isHappeningNow)}
          </View>
        </View>
      </View>
    );
  }

  function renderColumn(task: Task, opts: RailItemOpts) {
    const { timed, isHappeningNow, isPast } = opts;
    const dimmed = !!(task.done || isPast);
    const surfaced = surfacedIds.has(task.id);

    return (
      <PressableScale
        key={task.id}
        style={styles.hColumn}
        onPress={() => handlePress(task)}
        disabled={readOnly || !onPressTask}
        scaleTo={0.97}
      >
        <View style={styles.hRailRow}>{timeMarker(task, timed, dimmed, isHappeningNow, surfaced)}</View>
        <View style={styles.hContent}>
          <Text
            numberOfLines={2}
            style={[
              styles.hTitle,
              { color: dimmed ? theme.textMuted : theme.text },
              task.done && { textDecorationLine: 'line-through' },
            ]}
          >
            {task.title}
          </Text>
        </View>
        <View style={styles.hDoneRow}>{doneToggle(task, isHappeningNow)}</View>
      </PressableScale>
    );
  }

  function renderHSpacer(key: string, sizePx: number, content?: React.ReactNode) {
    return (
      <View key={key} style={[styles.hConnectorWrap, { minWidth: sizePx }]}>
        <View style={[styles.hConnector, { width: sizePx, backgroundColor: theme.border }]} />
        {content ? <View style={styles.hSpacerContent}>{content}</View> : null}
      </View>
    );
  }

  const hNowMarker = (
    <View style={styles.hNowMarker}>
      <View style={[styles.hNowLine, { backgroundColor: theme.accent }]} />
      <Text numberOfLines={1} style={[styles.hNowLabel, { color: theme.accent }]}>
        {t.timelineNow}
      </Text>
    </View>
  );

  // Horizontal-only gap state (Decision 009a): no task happening now, but one is coming.
  // The vertical grid doesn't need this — empty grid space between the now-line and the
  // next card already communicates it.
  const hasGap = currentTimedIndex < 0 && nextTimedIndex >= 0 && timedPending[nextTimedIndex].start > now;
  const hGapMarker = hasGap ? (
    <View style={styles.hGapMarker}>
      <View style={[styles.hGapDot, { borderColor: theme.border }]} />
      <Text style={[styles.hGapText, { color: theme.textMuted }]} numberOfLines={2}>
        {t.dayViewGapUntil(minutesToLabel(timedPending[nextTimedIndex].start))}
      </Text>
    </View>
  ) : null;

  // Horizontal-only item building (unchanged proportional layout — see file header).
  const visibleAnytimeH = anytimePending.filter((task) => isVisibleH(task.id));
  const visibleTimedH = timedPending.filter((e) => isVisibleH(e.task.id));

  const hAnytimeItems: React.ReactNode[] = [];
  visibleAnytimeH.forEach((task, idx) => {
    const hasNext = idx < visibleAnytimeH.length - 1 || timedPending.length > 0;
    hAnytimeItems.push(renderColumn(task, { animateIn: true }));
    if (hasNext) hAnytimeItems.push(renderHSpacer(`gap-any-${task.id}`, MIN_GAP));
  });

  const hTimedItems: React.ReactNode[] = [];
  visibleTimedH.forEach((entry, idx) => {
    const isHappeningNow = now >= entry.start && now < entry.end;
    const isPast = !isHappeningNow && now >= entry.end;
    const isLast = idx === visibleTimedH.length - 1;
    const nextEntry = visibleTimedH[idx + 1];
    const gapMin = nextEntry ? nextEntry.start - entry.end : 0;
    const connectorPx = nextEntry ? clamp(gapMin * PX_PER_MIN, MIN_GAP, MAX_GAP) : tailPx;
    hTimedItems.push(renderColumn(entry.task, { timed: entry, isHappeningNow, isPast, animateIn: true }));
    if (nextEntry || (isLast && tailPx > 0)) {
      const nowInThisGap = !!nextEntry && now >= entry.end && now < nextEntry.start;
      const marker = nowInThisGap ? hNowMarker : undefined;
      hTimedItems.push(renderHSpacer(`gap-${entry.task.id}`, connectorPx, marker));
    }
  });

  // `dayTasks.length` (not the countable count) so a day holding only 'note' cards shows
  // those notes rather than the "nothing here yet" starter — there IS something here.
  // A day with a captured moment, a dose or a health entry on it is NOT an empty day, even
  // with no tasks — showing the "nothing here yet" starter over a log that has things in it
  // would be the card contradicting itself.
  const showEmpty =
    dayTasks.length === 0 && pendingCount === 0 && doneTasks.length === 0 && (dayLog?.length ?? 0) === 0;
  // Likewise "all done" has to cover the log-only day: nothing pending, and something
  // behind the now-line to show for it.
  const allDone = pendingCount === 0 && (doneTasks.length > 0 || (dayLog?.length ?? 0) > 0);

  // Shared with the anytime list/doneZone/footer so the whole card reflows in sync — otherwise
  // these siblings snap instantly while rows are still fading, which used to make the done-zone
  // appear to get "covered" by an exiting row.
  const containerLayout = reducedMotion ? undefined : LinearTransition.duration(Duration.listMove).easing(Ease.move);

  /**
   * The pad's type line, built once and used by BOTH layouts (see its two mount points below)
   * so the ruled list and the timeline can never end up with two differently-worded adds.
   *
   * Its extras are the two settings that actually matter for a task captured in passing
   * (2026-07-24, carried over from the AddRow this replaced; energy chip removed 2026-08-01 —
   * Energy stayed a Habits-only quick-add setting): a start time and a repeat cycle. Everything
   * else, including energy, is edited later in the task's own form — reachable inline via "…".
   */
  const typeRow = onAddTask ? (
    <PadTypeRow
      prompt={captureAsMoment ? t.dayLog.capturePrompt : t.pad.type.task}
      value={addDraft}
      onChangeText={setAddDraft}
      onSubmit={captureAsMoment ? commitMoment : commitAdd}
      accent={domainColor.accent}
      // A moment has no editor to continue into — it IS the record. Only a task offers "…".
      onMore={!captureAsMoment && onAddTaskAndEdit ? commitAddAndEdit : undefined}
      extras={
        <>
          {/* Capture target (2026-08-02). The SAME field commits either a task or a day-log
              moment — one field, one submit, no modal, no category, no confirmation
              (the feature's "manual capture must be free" rule). The default stays task, so
              nothing about the existing add path changes until this is pressed.
              A moment's time and recurrence are meaningless — it already happened, once —
              so those two controls come off the row in moment mode rather than sitting
              there inert. That also keeps this row at one control instead of three, which
              is what stops it wrapping at small widths (npm run wraps, 327px). */}
          {onCaptureMoment ? (
            <PressableScale
              style={[
                styles.quickChip,
                { borderColor: captureAsMoment ? domainColor.accent : theme.border },
                captureAsMoment && { backgroundColor: domainColor.soft },
              ]}
              onPress={() => { tap(); setCaptureAsMoment((v) => !v); }}
              hitSlop={HitSlop.base}
              scaleTo={0.9}
              accessibilityRole="button"
              accessibilityState={{ selected: captureAsMoment }}
              accessibilityLabel={t.dayLog.capturePrompt}
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={captureAsMoment ? theme.accent : theme.textMuted}
              />
            </PressableScale>
          ) : null}
          {captureAsMoment ? null : <TimeBoxInput value={addTime} onChange={setAddTime} />}
          {captureAsMoment ? null : <PressableScale
            style={[
              styles.quickChip,
              { borderColor: addRecurring !== 'none' ? domainColor.accent : theme.border },
              addRecurring !== 'none' && { backgroundColor: domainColor.soft },
            ]}
            onPress={cycleRecurring}
            hitSlop={HitSlop.base}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel={`${t.taskRecurringToggle}: ${recurringLabel(addRecurring)}`}
          >
            {/* A.4 rule 1: "on" is carried by the chip's accent border + soft fill (a fill
                channel). The glyph is the action colour and the letter is plain ink. */}
            <Ionicons
              name="repeat"
              size={14}
              color={addRecurring !== 'none' ? theme.accent : theme.textMuted}
            />
            {addRecurring !== 'none' && (
              <Text style={[styles.quickChipText, { color: theme.text }]}>
                {recurringLabel(addRecurring).charAt(0)}
              </Text>
            )}
          </PressableScale>}
        </>
      }
    />
  ) : null;

  return (
    <Surface
      surfaceContext="ambient"
      borderColor={domainColor.accent}
      elevated={expanded}
      style={[styles.card, !expanded && styles.cardCollapsed]}
    >
      <View style={styles.cardContent}>

        {/* Section header — only in read-only (Home preview) mode. The badge is a normal flex
            child now, so the whole card sits on ONE left edge. */}
        {readOnly && (
          <PressableScale onPress={() => router.push('/plans')} style={styles.headerRowPressable} scaleTo={0.98}>
            <View style={styles.headerTopRow}>
              <CardAccentBadge domain="plan" size={32} />
              <View style={styles.headerText}>
                <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
                  {t.home.todaysPlans}
                </Text>
                {/* Rule 9 — both the summary and the bar below are ALWAYS mounted, and only
                    their content changes. They used to be gated on `countableTasks.length > 0`,
                    so writing the very first task of the day made a subtitle and a progress bar
                    appear out of nothing and pushed the whole card down (2026-08-03 UX review:
                    one keystroke changed seven things about this card). An empty day reserves
                    the same space with an empty string and a zero bar. */}
                <Text style={[styles.summary, { color: theme.textMuted }]}>
                  {countableTasks.length > 0 ? t.pad.summary(pendingCount, countableTasks.length) : ' '}
                </Text>
              </View>
            </View>
            <ProgressBar
              value={countableTasks.length > 0 ? doneTasks.length / countableTasks.length : 0}
              color={domainColor.accent}
              height={4}
              style={styles.progressBar}
            />
          </PressableScale>
        )}

        {/* The type line, in ONE fixed place for every state this card can be in (2026-08-03).
            It used to have two mount points: PadSheet's `typeRow` (the pad's first line, i.e.
            the TOP of the card) whenever the ruled list was drawn, and a standalone PadSheet
            AFTER the body for the three cases that don't draw a pad — the timeline layout, an
            empty day and an all-done day. So writing the first task of the day moved the field
            you had just typed into from the bottom of the card to the top, and the same card
            put its input in different places on Home and on the To-do tab. That is rules 8 and
            9 both, and it was the single clearest instance of the "I press here, then it moves
            and I have to press the other side" report this pass came from.
            Top rather than bottom because it keeps PadSheet's notepad metaphor intact (the type
            line IS the first rule) and leaves the field where the thumb left it as the list
            grows downward — the other six PadSheet callers are unaffected. */}
        {onAddTask ? <PadSheet state="closed" typeRow={typeRow} /> : null}

        {showEmpty ? (
          <View style={styles.emptyWrap}>
            {/* One concrete suggestion, in the card, where the content would be (2026-07-27,
                user report). This replaced an empty hour ruler that filled the space without
                saying anything — the suggestion row IS a real row, and its "+" writes a real
                task. The explainer that used to lead this block is now a one-line
                CardHintNote at the FOOT of the card (2026-07-30) — see that mount below, and
                its component header for why teaching moved out from between the title and the
                content. The "EXAMPLE TASKS" caption line went with it: the marker is the
                row's own `tag` chip now. */}
            {onAddExample ? (
              <StarterExampleRow
                icon="ellipse-outline"
                title={t.starters.plans.exampleTitle}
                tag={t.starters.exampleLabel}
                meta="17:00–17:20"
                accent={domainColor.accent}
                onAdd={onAddExample}
                addLabel={t.starters.addExample}
              />
            ) : null}
            {/* Ghost "add" row (debug-note 2026-07-21) — an empty day should still offer a
                place to add something. Deep-links to the Plans tab; only shown as a FALLBACK
                when no inline add is wired (`onAddTask` absent). When onAddTask IS passed
                (Home preview, 2026-07-24) the trailing AddRow handles inline creation, so this
                redundant deep-link ghost is suppressed. */}
            {readOnly && !onAddTask && (
              <PressableScale
                onPress={() => router.push('/plans')}
                style={[styles.emptyAddRow, { borderColor: theme.border }]}
                scaleTo={0.97}
                accessibilityRole="button"
                accessibilityLabel={t.timelineEmptyAdd}
              >
                <Ionicons name="add" size={16} color={theme.accent} />
                <Text style={[styles.emptyAddText, { color: theme.textMuted }]}>{t.timelineEmptyAdd}</Text>
              </PressableScale>
            )}
          </View>
        ) : allDone ? (
          /* Everything on the day is finished.
             With the day log on, this is the LEAST empty a day ever is — it is the exact
             moment the record is worth having, so the log renders here too. Before that it
             short-circuited to a single "all done" line and threw away the evidence, which
             inverted the whole point of the feature. The line itself stays: it's a reward,
             not an empty state (see the empty-state note in this file's header). */
          <>
            {renderDayLog()}
            {renderNowDivider()}
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>{t.dayViewAllDone}</Text>
          </>
        ) : !spec.timeline ? (
          /* Ruled pad list (2026-07-30) — the default on Home, where a card is too short for a
             calendar grid to be readable. Timed tasks first in clock order, then Anytime; the
             time is the row's ONE right-hand value, in tabular figures so a column of them
             lines up. The timeline is still one tap away in this card's layout picker. */
          <PadSheet state={state}>
            {/* The log reads INSIDE the pad rather than above it — a separate surface for
                "what happened" would read as a second card about the same day, which is
                exactly the "on top of" shape this feature must not have. */}
            {renderDayLog()}
            {renderNowDivider()}
            {padVisibleRows(listTasks, state).map((task) => (
              <PadRow
                key={task.id}
                title={task.title}
                accent={domainColor.accent}
                done={task.done}
                // The pin goes in PadRow's `leading` slot — "an icon or a quantity, never a
                // second check" — and every other row drops to secondary weight. Nothing is
                // hidden: a dimmed row keeps its check, its ⋯, its reminders and its place.
                leading={pinBadge(task)}
                style={isDimmedByPin(task) ? styles.rowDimmed : undefined}
                // A stepped card spends the row's ONE right-hand value on how far along it
                // is; every other type keeps the time there. Same choice TaskCard makes.
                rightValue={
                  task.cardType === 'stepped' && task.steps.length > 0
                    ? steppedLabel(task.steps)
                    : task.time || undefined
                }
                meta={
                  task.time ? undefined : (
                    <Text style={[styles.followerBadgeText, { color: theme.textMuted }]}>
                      {t.dayViewAnytimeBadge}
                    </Text>
                  )
                }
                onPress={readOnly || !onPressTask ? undefined : () => onPressTask(task)}
                onAction={onDeleteTask ? () => { tap(); onDeleteTask(task); } : undefined}
                actionLabel={`${t.dayViewDeleteTask} ${task.title}`}
                // Undefined for a note — PadRow draws no check when it has nothing to call.
                onToggle={onToggleTask && isCompletable(task.cardType) ? () => handleToggle(task) : undefined}
                toggleLabel={task.title}
              />
            ))}
          </PadSheet>
        ) : horizontal ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRail}>
            {hGapMarker}
            {hAnytimeItems}
            {hTimedItems}
          </ScrollView>
        ) : (
          <>
            {renderDayLog()}
            {renderNowDivider()}
            {visibleAnytime.length > 0 && (
              <Animated.View style={styles.anytimeList} layout={containerLayout}>
                {visibleAnytime.map((task) => renderFlatRow(task, { animateIn: true }))}
              </Animated.View>
            )}
            {/* Nothing fixed left today — a neutral statement of fact where the grid would
                be, not an invitation and not an encouragement. Only when the log is on;
                without it an empty grid is just an empty grid.
                `visibleAnytime.length === 0` is load-bearing (2026-08-03, rule 25): `gridItems`
                is only the TIMED tasks, so a day holding nothing but untimed ones printed
                "Nothing fixed left today." directly beneath the list of things that were, in
                fact, left today. "Fixed" was carrying the whole meaning and no reader parses it
                that way — on screen it just read as the card contradicting itself. When there
                are untimed tasks ahead, the list above already says what is left and this line
                has nothing to add. */}
            {dayLogActive && gridItems.length === 0 && visibleAnytime.length === 0 && !showEmpty ? (
              <Text style={[styles.nothingAhead, { color: theme.textMuted }]}>{t.dayLog.nothingAhead}</Text>
            ) : null}
            {gridItems.length > 0 && (
              <View
                style={[
                  styles.gridViewport,
                  { height: expanded ? dayScale.totalHeight : Math.min(dayScale.totalHeight, COLLAPSED_GRID_HEIGHT) },
                ]}
              >
                <ScrollView ref={gridScrollRef} scrollEnabled={!expanded} showsVerticalScrollIndicator={false}>
                  <View style={styles.gridInner}>
                    {/* With the log on, the now-line is already drawn ABOVE this grid as the
                        boundary divider, and the axis starts at `now` — so the grid's own
                        line would sit redundantly on its top edge. One line, one meaning. */}
                    <DayGridLines scale={dayScale} now={dayLogActive ? undefined : now} />
                    {gridItems.map((item, i) =>
                      item.task
                        ? renderGridEntry({ task: item.task, start: item.start, end: item.end }, timedLayout[i])
                        : renderCalendarEntry(item.event!, timedLayout[i])
                    )}
                  </View>
                </ScrollView>
              </View>
            )}
          </>
        )}

        {/* (The type line used to have its second mount point here — see the single hoisted
            mount above the body branch.) */}

        {/* Done zone — dimmed, collapsed by default (Decision 009a). Always the flat-row
            layout, even in horizontal mode — this is a secondary dropdown list, not the
            primary glance surface.
            **Replaced by the day log when that is on (2026-08-02).** Keeping both would
            render the same completed task twice and split "what happened today" across two
            places, which is the thing the log exists to fix. The zone is not deleted: it is
            still the whole story when `settings.featureDayLog` is off, and it remains the
            only home for a completed task with no `done_at` (one finished before that
            column existed, or ticked by a paired device — see lib/liveSync's note). */}
        {!dayLogActive && doneTasks.length > 0 ? (
          <Animated.View style={[styles.doneZone, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} layout={containerLayout}>
            <PressableScale style={styles.doneHeader} onPress={() => { tap(); setDoneOpen((v) => !v); }} scaleTo={0.97} releaseSpring={Spring.calm}>
              <Text style={[styles.doneHeaderText, { color: theme.textMuted }]}>{t.dayViewDoneZone(doneTasks.length)}</Text>
              <AnimatedChevron open={doneOpen} size={14} color={theme.textMuted} />
            </PressableScale>
            <Collapsible open={doneOpen}>
              <View style={styles.doneRows}>
                {doneTasks.map((task) =>
                  renderFlatRow(task, {
                    timed: task.time ? timedEntryOf(task) : undefined,
                    isPast: true,
                  })
                )}
              </View>
            </Collapsible>
          </Animated.View>
        ) : null}

        {/* Recently deleted — the undo half of the trash action above (2026-07-27, user
            report: "no apparent way to delete and recover deleted tasks"). Same collapsed
            dimmed-zone shape as "Done today", so it reads as another fold-away drawer rather
            than a new concept; rows carry a restore arrow instead of a checkbox. Only mounts
            when the caller passes both the tombstones and a restore handler. */}
        {onRestoreTask && deletedTasks && deletedTasks.length > 0 ? (
          <Animated.View style={[styles.doneZone, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} layout={containerLayout}>
            <PressableScale style={styles.doneHeader} onPress={() => { tap(); setDeletedOpen((v) => !v); }} scaleTo={0.97} releaseSpring={Spring.calm}>
              <Text style={[styles.doneHeaderText, { color: theme.textMuted }]}>{t.dayViewDeletedZone(deletedTasks.length)}</Text>
              <AnimatedChevron open={deletedOpen} size={14} color={theme.textMuted} />
            </PressableScale>
            <Collapsible open={deletedOpen}>
              <View style={styles.doneRows}>
                {deletedTasks.map((task) => (
                  <View key={task.id} style={styles.flatRow}>
                    <View
                      style={[
                        styles.rowCard,
                        styles.deletedRowCard,
                        { backgroundColor: rgba(theme.accent, 0.03), borderColor: theme.border },
                      ]}
                    >
                      <Text numberOfLines={1} style={[styles.title, { color: theme.textMuted }]}>
                        {task.title}
                      </Text>
                    </View>
                    <View style={styles.doneCol}>
                      <PressableScale
                        hitSlop={12}
                        onPress={() => { tap(); onRestoreTask(task); }}
                        accessibilityRole="button"
                        accessibilityLabel={`${t.dayViewRestore} ${task.title}`}
                        scaleTo={0.9}
                      >
                        <Ionicons name="arrow-undo-outline" size={16} color={theme.accent} />
                      </PressableScale>
                    </View>
                  </View>
                ))}
              </View>
            </Collapsible>
          </Animated.View>
        ) : null}

        {/* One chevron for all three card sizes (2026-07-30). In the timeline layout the rows
            aren't a flat list, so `total` is the pending count — which is what the label is
            about either way ("3 more" to see). */}
        <PadFooterToggle
          state={state}
          onChange={setState}
          total={spec.timeline ? pendingCount : listTasks.length}
        />

        {/* The empty-day explainer, at the FOOT of the card (2026-07-30) — it used to lead the
            empty state, between the title and the first thing you can actually do. Only while
            the day is genuinely empty: once there are tasks, the ⓘ hint is where this lives. */}
        {showEmpty ? <CardHintNote text={t.starters.plans.text} noBorder /> : null}

      </View>
    </Surface>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderRadius: Radius.md, marginBottom: Spacing.sm },
  // Minimum height while NOT fully open — i.e. for both the closed and preview states, never
  // for open (maintainer's call, 2026-07-30). `expanded` is `state === 'open'`, so this is the
  // same gate the pre-pad card used, against the new three-state value. The two spare ruled
  // lines still do the work of making a light card read as a page; the floor makes the four
  // cards read as one size at rest.
  cardCollapsed: { minHeight: HOME_PREVIEW_CARD_MIN_HEIGHT },
  // ONE horizontal inset for the whole card (PAD_GUTTER). The old paddingLeft:52 title inset
  // that dodged an absolutely-pinned badge is gone with the badge.
  cardContent: { paddingHorizontal: PAD_GUTTER, paddingTop: PAD_GUTTER, paddingBottom: PAD_GUTTER, position: 'relative' },
  // Quick-add extras (2026-07-24) — compact repeat/energy toggle chips beside TimeBoxInput.
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 30,
    height: 30,
    paddingHorizontal: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  quickChipText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  emptyText: { fontSize: FontSize.sm, fontStyle: 'italic', textAlign: 'center', paddingVertical: Spacing.sm },
  // Just the suggestion row + the ghost add row now — the bulb/italic explainer and the
  // "EXAMPLE TASKS" caption that used to lead this block became a foot-of-card CardHintNote
  // and the row's own `tag` chip respectively (2026-07-30).
  emptyWrap: { gap: Spacing.sm },
  emptyAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyAddText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },

  // Anytime list — a plain flat list above the grid (untimed tasks have no clock position).
  anytimeList: { gap: Spacing.xs, marginBottom: Spacing.sm },
  // The day log. NO `gap` and no per-row spacing on purpose — behind the now-line the day
  // is flush, and PadRow's own fixed height is the only vertical rhythm it gets. Adding a
  // gap here would reintroduce exactly the emptiness the collapse exists to remove.
  dayLogList: {},
  // A device-calendar event. Dashed = "not yours to finish" — a border STYLE rather than a
  // hue, so the distinction survives greyscale (DESIGN_RULES rule 11).
  calendarCard: { borderStyle: 'dashed', paddingRight: Spacing.sm },
  // The now-line, as a rule with its own word — the boundary the card is split by. Static:
  // it must never animate or tick (nothing moves in peripheral vision on this surface).
  nowDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  nowRule: { flex: 1, height: StyleSheet.hairlineWidth },
  nowLabel: { fontSize: FontSize.xs, fontFamily: Fonts.medium },
  // "Nothing fixed left today." A statement of fact where the grid would be.
  nothingAhead: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.md,
    textAlign: 'center',
  },
  // Flat row: [content][doneCol] — used by the anytime list and the "Done today" zone.
  flatRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: Spacing.xs },
  flatContent: { flex: 1 },
  // Secondary weight while another row is pinned. Opacity ONLY — the row keeps its height, its
  // controls, its reminders and its counts; the same shared amount a finished row uses.
  rowDimmed: { opacity: DONE_ROW_OPACITY },
  // The "I'll decide" pin badge / un-pin button. Sized to RowTrailing.actionSize so it matches
  // the ⋯ button rows already draw; marginRight pads the gap to the row body past the slop it
  // spreads that way (see pinBadge()'s note).
  pinBadge: {
    width: RowTrailing.actionSize,
    height: RowTrailing.actionSize,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginRight: Spacing.xs,
  },
  flatTimeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  timeBox: {
    minWidth: 44,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBoxText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  anytimeDot: { width: 10, height: 10, borderRadius: Radius.full, borderWidth: 2, borderStyle: 'dashed' },
  dot: { width: 16, height: 16, borderRadius: Radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  // Decision (visual-audit 2026-07-11): a subtle card behind each row's title/hint so
  // tasks read as distinct items rather than text floating on the background. borderWidth
  // added 2026-07-26 (calendar-style pass) — see the inline borderColor overrides.
  rowCard: { borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  // Restore-zone row: no checkbox/hint/badges, just the title — flex:1 so it fills the row
  // the way `flatContent` does for a live task.
  deletedRowCard: { flex: 1 },
  // Holds the done-toggle and (when wired) the trash action, stacked so a long title still
  // gets the full row width.
  doneCol: { width: DONE_COL_WIDTH, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.semibold, flexShrink: 1 },
  durationText: { fontSize: FontSize.xs },
  followerBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 1 },
  followerBadgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, marginTop: 2 },
  hintText: { fontSize: FontSize.xs, flexShrink: 1, fontStyle: 'italic' },

  // Fixed-hour grid viewport (2026-07-26 rebuild — see file header). Height is set inline
  // (collapsed vs. expanded); rounded + clipped so the grid's hour lines don't bleed past
  // the card's own corner radius.
  gridViewport: { borderRadius: Radius.sm, overflow: 'hidden' },
  // No explicit height — DayGridLines (the only non-absolute child) sets its own height to
  // the full 24h grid, and that's exactly what this wrapper's auto height should be too;
  // absolutely-positioned grid cards (siblings) don't contribute to that auto height.
  gridInner: { position: 'relative', width: '100%' },
  // overflow:'hidden' (2026-07-30, user report: "info-text overlapping") — lib/dayGrid.ts's
  // layoutGridEntries CLAMPS a card's height so it can't visually run into whatever starts
  // next, but a clamp only works if content is actually clipped to it. Without this, a card
  // whose natural content (title + the "up next" hint line, or just two tasks scheduled
  // close together) is taller than its clamped height still painted past its own box and
  // over the neighboring card.
  gridCardWrap: { position: 'absolute', overflow: 'hidden' },
  // Column sub-wrapper (overlap layout, lib/dayGrid.ts) — left/width are set inline as
  // percentages of gridCardWrap's own width so RN resolves them relative to the slot,
  // not the whole card. A small horizontal inset only when genuinely side-by-side with
  // another task, so the common single-column case is pixel-identical to before.
  gridCardColumn: { position: 'absolute', top: 0, bottom: 0 },
  gridCardColumnGapped: { paddingHorizontal: 1.5 },
  // Only while pinned: the column becomes a row so the badge can lead it, exactly as it does on
  // a flat row. The card's clock position (`top`/`height` on gridCardWrap) is untouched.
  gridCardColumnPinned: { flexDirection: 'row', alignItems: 'center' },
  gridCardPressable: { flex: 1 },
  // Tighter vertical padding than the shared `rowCard` (short time-slots), and room on the
  // right for the corner done-toggle overlay.
  gridCardInner: { flex: 1, paddingVertical: 4 },
  // Corner action stack — trash (when wired) then the done-toggle, laid out in a row so a
  // short card doesn't have to be tall enough to stack them.
  gridActions: { position: 'absolute', top: 4, right: 4, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },

  // Horizontal rail: a row of [hColumn][hConnectorWrap][hColumn]... — time box + line on
  // top, title in the middle, checkmark-circle toggle in a fixed-height row underneath,
  // so it lines up across every column regardless of title length.
  hRail: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.xs, paddingRight: Spacing.md },
  hColumn: { width: H_COLUMN_WIDTH, alignItems: 'center' },
  hRailRow: { height: H_RAIL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  hContent: { height: H_CONTENT_HEIGHT, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 2 },
  hTitle: { fontSize: FontSize.sm, fontFamily: Fonts.medium, textAlign: 'center' },
  hDoneRow: { paddingTop: Spacing.xs },
  hConnectorWrap: { height: H_RAIL_HEIGHT, justifyContent: 'center' },
  hConnector: { height: 2 },
  // Now-marker overlay for a horizontal connector — absolute so it doesn't force the
  // connector wider than its proportional width.
  hSpacerContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  hNowMarker: { width: 44, height: H_RAIL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  hNowLine: { width: 1.5, height: '100%', opacity: 0.6 },
  hNowLabel: { fontSize: FontSize.xs, fontFamily: Fonts.bold, position: 'absolute', top: -2 },
  hGapMarker: { width: 72, alignItems: 'center', paddingTop: 2 },
  hGapDot: { width: 8, height: 8, borderRadius: Radius.full, borderWidth: 2, borderStyle: 'dashed', marginBottom: 4 },
  hGapText: { fontSize: FontSize.xs, fontStyle: 'italic', textAlign: 'center' },

  // Frames the done header + its collapsed rows as one card (2026-07-16) — previously a
  // transparent top border (no real frame). This card already sits inside the outer Surface,
  // so it uses `theme.surfaceMuted` (a step subtler than the card's own surface) rather than
  // a second elevated Surface, to avoid stacking two heavy card looks.
  // `overflow:'hidden'` + a real `paddingBottom` fix the expand/collapse spill (2026-07-27,
  // user report: "expanding and closing has a visual bug with text overlapping the borders").
  // Two causes, one per property. (1) The Collapsible reveal is a height CLIP, so mid-animation
  // it cuts through a row — and the clip used to be this zone's last child, i.e. its cut edge
  // sat exactly ON the bottom border, so the half-revealed text read as printed over the frame.
  // The paddingBottom keeps a permanent inset between the clip's edge and the border.
  // (2) This zone also animates its own frame via `layout` (LinearTransition) while the clip
  // animates independently, so for a few frames the frame is smaller than its content —
  // overflow:'hidden' guarantees nothing paints past the rounded edge at any frame.
  doneZone: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
    overflow: 'hidden',
  },
  // paddingBottom trimmed to xs since doneZone now carries the other half (see above) — the
  // total gap under the last row is unchanged.
  doneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  doneHeaderText: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  // Only rendered while the done zone is open (inside Collapsible's children), so this
  // padding never shows up as phantom height while collapsed.
  doneRows: { paddingBottom: Spacing.xs },
  footerBtn: { alignItems: 'center', paddingTop: Spacing.sm },
  footerBtnText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },
  // marginBottom Spacing.lg (was .md, was .sm before that) — the badge/title row still reads
  // as "close to the wash divider" at this size; the room bought back goes to the content
  // below it instead, matching HomeNotesCard/HomeHabitsCard/HomeShoppingCard's own header gap
  // (2026-07-30, user report: content read as crowding the colored badge).
  headerRowPressable: { marginBottom: Spacing.lg },
  // The badge is an ordinary flex child again (2026-07-30). It used to be absolutely
  // positioned, with this row's paddingLeft:52 dodging it and the progress bar's matching
  // marginLeft dodging it a second time — three coupled numbers, and a documented
  // native-vs-react-native-web disagreement about whether an absolute child inherits its
  // parent's padding. In flex flow there is nothing to dodge and nothing to disagree about.
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 32 },
  headerText: { flex: 1, minWidth: 0 },
  // Tabular figures so the four Home cards' counts line up down the screen.
  summary: { fontSize: FontSize.xs, fontFamily: Fonts.semibold, ...TabularNums },
  progressBar: { marginTop: Spacing.xs },
  // includeFontPadding:false + textAlignVertical:'center' so the title optically centers against
  // the round CardAccentBadge on Android (same font-padding fix as TabSlider/ScreenHeader).
  // Sentence case (2026-07-28 design review): all-caps belongs on ≤13px labels, not 20px card titles.
  headerTitle: { fontSize: 20, lineHeight: 25, fontFamily: Fonts.bold, includeFontPadding: false, textAlignVertical: 'center' },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontFamily: Fonts.bold },
});
