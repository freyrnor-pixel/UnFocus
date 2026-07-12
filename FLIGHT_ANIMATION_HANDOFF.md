# Handoff — cross-section "travel" animation (Phase 1: Shopping only)

**Purpose:** give the next Claude Code session everything needed to implement a real
"item flies from A to B" animation for Shopping's list→cart toggle, without re-deriving
the research already done this session. Read `ANIMATION_GUIDELINES.md` first (timing/
easing/spring values + the reduce-motion contract) — this doc only covers the
flight-specific delta.

**Not done yet — this is a scope handoff, no flight code has been written.** The visual-audit
pass that preceded this (PR #135, merged to `main`) deliberately left the section-to-section
transition as independent fade-out/fade-in; this doc is the plan for replacing that with an
actual measured flight.

**Scope discipline: Phase 1 (Shopping list→cart) only.** Don't also build Tasks'
pending→done or habit completion in the same pass — see "Explicitly out of scope" below.
Land Phase 1, verify it, stop.

---

## The ask

When a `ShoppingRow` toggles from unchecked ("In list") to checked ("In cart"), it currently
unmounts from one section and mounts in the other — `FadeOut`/`FadeInDown`/`LinearTransition`
already make that look intentional (not a pop), but it's not literally "the same object
moving." The user wants an actual flight: a clone of the row visibly travels from its old
position to its new one.

## Existing precedent to reuse (don't reinvent this)

`app/(tabs)/shopping.tsx`'s drag-to-merge code already solves "measure two rects in a shared
window coordinate space and compare them" — same primitive this needs:

- `handleDragStart` (~line 584) — measures every sibling row via `node.measureInWindow(...)`
  into `dragSnapshotRef.current`, and every dish-group card via `dishRectsRef.current`, all in
  **window space** (the one coordinate frame where rows in different parents are comparable —
  see the file's own header note above `handleDragStart`, ~line 90).
- `handleRegisterRowNode` / `handleRegisterDishNode` (~lines 572, 578) — the registration
  pattern components use to hand their native node up to the screen for measuring.
- Read the file's docstring block starting "Decision 011 R1 reorder + Decision 022
  drag-to-merge" (top of file, ~line 84 onward) for the full rationale — window-space
  measurement, why it's taken once at drag-start and not re-measured mid-gesture, etc.

The flight primitive is the same shape: measure source rect in window space → measure (or
approximate) a destination rect → animate a floating clone between them.

## Recommended approach (FLIP-style, no new dependency)

1. **On toggle** (`ShoppingRow.tsx`'s check-circle `Pressable`, `onPress={onToggle}` at
   line 301): before/at the moment `onToggle` fires, measure the row's own container via
   `measureInWindow` (the row would need a ref — currently `styles.row`'s `Animated.View`,
   ~line 287, has no ref to measure from; that's the first code change).
2. **Render a floating clone** — a lightweight pill (item name + checkmark only, not a full
   `ShoppingRow` — cheaper and avoids duplicating swipe/stepper logic) in a screen-level
   overlay component, positioned at the measured source rect.
3. **Destination target**: don't chase the exact final row slot — land on the "In cart"
   section header's rect instead (`WeekListCard.tsx`'s `sectionHeaderRow` for the "In cart"
   section, ~line 512 `{/* ── IN CART section ── */}`). Landing at the section reads as
   "it went there"; exact-slot precision isn't worth the complexity given rows reflow anyway.
4. **Animate** the clone's position with `withTiming` (Reanimated — already the codebase's
   primary animation API, see `ANIMATION_GUIDELINES.md` §2 for easing/duration: this is a
   "card/panel transition," so 200–300ms ease-out per that table), cross-fading it out as the
   real destination row fades in (already happening via existing `FadeInDown`/`LinearTransition`
   in `ShoppingRow.tsx` — sequence against those, don't fight them).
5. **`reducedMotion`** (from `useAccessibility()`, `lib/useAppTheme.ts`) — skip the flight
   entirely, keep exactly today's fade-only behavior. Every other animated component in this
   codebase gates on this the same way (`ShoppingRow.tsx`'s own `reducedMotion` checks are the
   closest in-file example).

## Files this touches (Phase 1)

- **New**: `components/FlightOverlay.tsx` (or similar name) — the reusable floating-clone +
  animation primitive. Keep it generic (source rect, destination rect, content, duration) so
  it isn't Shopping-specific, since a later phase (see below) reuses it for Tasks.
- `components/ShoppingRow.tsx` — add a ref to the row container; kick off the flight
  (via a callback prop, e.g. `onFlightStart`) at the same moment `onToggle` fires.
- `components/WeekListCard.tsx` — mount `FlightOverlay`; provide the "In cart" section
  header's rect as the destination anchor (measure it once mounted, same
  `measureInWindow` idiom).
- `components/HomeShoppingCard.tsx` — same treatment so Home's shopping preview matches full
  Shopping (this file already mirrors `WeekListCard`'s list/cart split — see its own header's
  "Edit notes").
- `ANIMATION_GUIDELINES.md` — add a short new section documenting the pattern (duration,
  destination-anchor convention, reduced-motion gate) so it doesn't drift and Phase 2 doesn't
  have to re-derive it.

## Real risks — don't hand-wave these away

- **Rapid/multiple toggles** (checking several items quickly): each flight needs independent
  tracking (e.g. keyed by item id), not a single shared animated value — otherwise the second
  toggle cancels/glitches the first.
- **Scroll mid-flight**: window-space coordinates go stale if the user scrolls while a clone
  is in flight. Simplest safe handling: if the ScrollView reports movement during a flight,
  cancel it (snap the clone straight to fade-out) rather than trying to re-measure live.
- **Lower-end Android perf**: this is strictly more work per toggle than the current fade
  (an extra measured overlay element). No on-device profiling is possible in this remote
  environment — flag it to the maintainer as something to feel out on a real device before
  calling Phase 1 done, not just in the web preview.

## Explicitly out of scope for this pass

- **Tasks' pending→done** (`PlanTaskCard.tsx`): `handleToggle` (~line 284) is the toggle
  entry point; the destination would be the collapsed "Done today" zone header (`doneZone`
  style, ~line 697) rather than a specific row, since that zone is closed by default. Same
  `FlightOverlay` primitive, different call site — a follow-up phase, not this one.
- **Habit completion** (`app/(tabs)/health.tsx`) — only worth doing if the maintainer wants
  every checkbox-toggle surface in the app to match; not asked for.
- Don't touch `components/CompletionGlow.tsx` — it's a separate, still-live pattern (habit
  completion's card-level bloom) that this work doesn't replace or interact with.

## How to verify Phase 1 is actually done

1. `npx tsc --noEmit` clean.
2. `scripts/test-changed.sh` — no existing shopping/store tests should break (there's no
   flight-specific test to add; this is presentational).
3. `npm run preview` (Expo Web + Playwright) — check a list→cart toggle in the Shopping tab
   visually; confirm the "Fidelity caveat" in `AGENTS.md` still applies (web preview proves
   the flow/logic works, not final native visual sign-off).
4. Manually toggle reduced-motion (Settings → Accessibility) and confirm the flight is
   skipped but the toggle itself still works.
5. Rapid-toggle 3+ items in a row in the web preview and confirm nothing glitches or leaves a
   stuck clone on screen.
