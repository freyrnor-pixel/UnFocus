# Rebuild Decisions

Append-only log of resolved product/design decisions. Each entry resolves an
ambiguity that would otherwise get re-decided silently in a coding session.

Rules:
- Never edit a past decision in place. If a decision changes, add a new
  numbered entry that supersedes the old one and mark the old one as
  "Superseded by Decision NNN".
- The spec is FEATURE_INVENTORY.docx plus the user's dated edit notes inside
  it. When old code and edit notes conflict, the edit notes win.
- If you (Claude Code) hit something genuinely undecided while porting, stop
  and ask the user rather than guessing. Then add the answer here.

Numbering conventions:
- **026 and the bare number 028 are burned — never reuse them.** Both were claimed by
  parallel `claude/*` commits that wrote no ledger heading; reusing them re-creates the
  same-number-two-meanings collisions this log keeps having to repair.
- **Before appending a new decision, grep this file for the candidate number.** Parallel
  sessions must reserve numbers through the planning thread, not race for them on a branch.
- When a collision is repaired, **the entry cited in code file headers keeps the bare number;
  the other gets a letter suffix** (e.g. 029b, 030b) so no header-edit cascade is triggered.
- Highest bare number in use: **035** (2026-07-04). 031/032 = onboarding-reminders /
  SiteSwipeView; 033/034/035 = screen transitions / header title / dark-mode default.

---

## Decision 006 — Colour token layer (colors.ts)

**Status:** Resolved. Backfilled entry — this decision was made and treated as
binding earlier but existed only as PROGRESS_LOG narrative until now (Gap G1,
Orientation 2026-07-01). No change to the decision itself; this records it.

**Decision:** All colour in the app is addressed through a semantic token layer in
`constants/colors.ts`: 31 semantic tokens, resolved across 6 themes (Default/blue,
Summer, Nature, Fluffy Pink, Gothic, Black & White), each with light and dark
variants. Tokens are verified WCAG AA. Components reference tokens by name only —
never raw hex, never a token not present in `colors.ts`.

**Token names are the source of record in `colors.ts`, not in this entry.** Where any
doc, source file, or session prompt names a token, it must match `colors.ts` exactly.
Old pre-006 source files reference retired names (`theme.textLight`, `theme.orange`,
`theme.green`, `theme.danger`, etc.) and must be remapped at port time to their 006
equivalents; the canonical remap table lives in the relevant session prompt.

**Open verification — RESOLVED:** the entry originally flagged `textInverse` vs
`accentInk` as needing confirmation (both referenced for text-on-coloured-fill; the
remap table only lists `accentInk`). Checked directly against `constants/colors.ts`:
both tokens exist and are distinct — `textInverse` (text on coloured backgrounds
generally) and `accentInk` (text/icon colour specifically on accent-coloured fills).
`textInverse` is not an invented token; no correction needed. Token count of 31 is
confirmed against the file's own header comment (4 surfaces + 3 text + 2 borders + 3
accent + 6 semantic state + 2 depth + 3 hint + 8 feature accents = 31).

**Scope:** foundational. Every component, primitive, composite, and screen depends on
this. No component may ship a raw hex value or an off-list token name.

**Supersedes:** all pre-006 `theme.*` colour names in old source files.

---

## Decision 007 — Rendering primitive libraries

**Status:** Resolved. Backfilled entry — source of record for native rendering-library
ownership; previously lived only as PROGRESS_LOG Phase 2b narrative (Gap G2,
Orientation 2026-07-01). No change to the decision itself; this records it.

**Decision:** The app's non-plain rendering is built on three libraries, and only
these three:
- `expo-linear-gradient` — rectangular gradient backgrounds and overlays.
- `react-native-svg` — non-rectangular shapes and vector paths.
- `expo-blur` — real blur for the glass material (glass usage governed by Decision 008).

Skia is ruled out as a general renderer, retained only as the named Android-jank
escape hatch defined in Decision 008 (expo-blur → `experimentalBlurMethod=
"dimezisBlurView"` → Skia only on measured Android jank).

**Install discipline:** these libraries are installed only when the phase that first
needs them runs. A phase that does not use gradient/blur/svg must not add, import, or
install any of them. If a session believes one is needed out of sequence, it stops and
flags rather than installing. (Phase 2 remaining primitives explicitly need none of
the three.)

**Component tiering:** components are split into 007-unblocked (no gradient/blur/svg)
and 008-blocked (require glass/blur) porting tiers. The nine Phase 2 primitives are all
007-unblocked.

**Scope:** foundational for all visual components. Dependency of Decision 008 (glass
redesign around real blur).

**Supersedes:** the "dependency-free on purpose / OTA-safe" notes in original component
source, which were premised on a constraint (no dev build) that has since been lifted.

---

## Decision 001 — Universal screen scaffold

**Status:** Decided 2026-06-30. Supersedes the implicit "Home is special"
pattern in the old code.

**Scaffold (every screen, back to front):**

1. **Background** — unchanged from the old repo. Home renders
   `HomeHeroBackground` (sky gradient + orb halo + tree watermark). Every
   other screen renders `ScreenBackground` (material-aware blobs). The L1
   layer is *not* unified; each screen keeps the background it had.
2. **Particle overlay** — `ParticleBackground` runs on every screen, not
   just Home as it does today. Still gated by `settings.particlesEnabled`
   and `useAccessibility().reducedMotion` — those flags already exist, do
   not re-derive them. Performance cost of mounting per-navigation is
   accepted.
3. **Foreground content** — screen-specific UI. No change.
4. **Top block + bottom block** — fixed structural containers, rendered as
   translucent surfaces picking up the user's bubble material (glass /
   metal / rock / paper / plain) from `useSettingsStore.bubbleMaterial`.
   Reuse the material handling in `Surface.tsx`; do not re-implement.
5. **Chrome inside the blocks** — varies by screen tier:

   - **Top-level screens** (the 5 BottomNav sites: Shopping, Plans, Home,
     Notes, Scan): top block has Settings (gear) in the left corner, page
     title centered, Focus-mode toggle in the right corner. Bottom block
     holds BottomNav. No back link — navigation between sites is BottomNav
     + `SiteSwipeView` swipe.
   - **Sub-screens** (forms, modals, editors — task-form, habit-form,
     share-modal, inventory-edit, etc.): top block has a back link in the
     left corner, **iOS only** (`Platform.OS === 'ios'`); on Android the
     slot stays empty and system back is the contract. Page title centered.
     Right corner is a screen-specific action slot (the current
     `ScreenHeader.right` prop role). No Settings, no Focus. **No bottom
     block** — sub-screens end at the screen content.

**Removed:** `BubbleMenu` is deleted, not just disabled. The "flagged for
redesign" note in FEATURE_INVENTORY.docx is resolved as "remove." The
component file does not come over to the new repo. Primary navigation is
`BottomNav` only.

**Implications for existing components:**

- `ScreenHeader.tsx` becomes the top block, upgraded from a borderless row
  to a translucent material surface. Its `bordered` prop is retired —
  material translucency replaces that affordance.
- `BottomNav.tsx` becomes the bottom block, wrapped in (or upgraded to) a
  translucent material surface. `BOTTOM_NAV_HEIGHT` stays exported.
- A new `ScreenScaffold` wrapper composes L1 + L2 + children + L4/L5.
  **Every ported screen mounts via `ScreenScaffold`; no screen renders
  `ScreenBackground` / `HomeHeroBackground` / `ParticleBackground` /
  `ScreenHeader` / `BottomNav` directly anymore.** `ScreenScaffold` takes
  a `tier: 'site' | 'sub'` prop to decide whether to render the bottom
  block and which chrome to put in the top block.

**Typography deferred:** the title in the top block, labels in the bottom
block, etc. may end up using different fonts/sizes per placement. That's a
later decision. For now use sensible defaults from the existing theme
tokens; do not commit to a typography system.

---

## Decision 008 — Glass redesigned around real blur (materials-system change)

**Status:** Resolved
**Depends on:** 007 (adopted expo-blur, expo-linear-gradient, react-native-svg; deferred glass-uses-blur HOW to 008)
**Blocks:** Surface.tsx port
**Date:** 2026-06-30

### Context
007 installed and verified expo-blur as the only real-blur primitive but deferred how the
glass material consumes it, to keep 007 about library adoption rather than a materials rewrite.
008 owns the glass/metal/rock/paper/plain finish system now that real blur is available.

### Decisions

1. **Glass is redesigned around a real `<BlurView>`, with a two-context split.**
   Glass is the only material whose identity is "you see through it," so the blur *is* its
   redesign. A glass Surface now frosts real pixels behind it, replacing the opacity-stacked
   fake (flat fill + sheen layers). Two contexts, selected by a new Surface prop
   (`surfaceContext: 'ambient' | 'overlay'`, default `'ambient'`):
   - `ambient` (default): glass frosts the **ScreenBackground backdrop**. Every existing
     `<Surface>` call site keeps working untouched — this is the default.
   - `overlay`: glass frosts **live scrolling content** behind it (sticky headers, bottom
     sheets, modals, nav bar). Opt-in; only a handful of (mostly later-phase) surfaces pass it.
   Surface implements both paths over one shared expo-blur code path; consumers only declare intent.

2. **Non-glass materials are unchanged and context-blind.**
   metal / rock / paper / plain render identically whether `ambient` or `overlay` — `overlay`
   is a **no-op** for them. They keep today's getMaterialStyle() opaque fill + sheen/shade
   treatment. This is the rule that bounds 008: "four materials unchanged + glass is
   context-aware," not "five materials × two contexts."
   - *"Smoked-chrome" (translucent/frosted metal) is explicitly NOT in 008.* If ever wanted it
     is a NEW material / deliberate metal redesign with its own contrast+legibility work — a
     future decision, flagged here so it is never smuggled in under a glass-redesign banner.

3. **ScreenBackground enrichment is IN SCOPE for 008.**
   Choosing the ambient path means ambient glass needs colour/structure behind it or the frost
   reads as muddy flat cream. ScreenBackground is therefore tuned richer/more saturated as part
   of 008 (not deferred). Note: the existing concentric-ring fake-blur blobs are NOT deleted —
   ambient glass only blurs the area under a card; exposed backdrop still needs its own
   softening. Real blur (under cards) and fake blur (exposed backdrop) coexist.

4. **react-native-skia is ruled OUT of 008** — consistent with 007's general Skia ruling.
   expo-blur covers both contexts (ambient over backdrop, overlay over scrolling content are
   both standard expo-blur use). Neither path needs Skia's unique capabilities (pixel sampling,
   custom shaders, runtime gradients, content-colour extraction).
   - **Pre-approved Skia escape hatch (named trigger):** IF `overlay` glass over scrolling
     content shows unacceptable jank on **Android** that expo-blur's
     `experimentalBlurMethod="dimezisBlurView"` cannot resolve, THEN Skia for the overlay glass
     fill is pre-approved without re-litigating 007/008. Decision order is fixed:
     expo-blur → `experimentalBlurMethod` → Skia, in that sequence, last resort only.
     Rationale: adding Skia later is a clean additive swap of the overlay fill (ambient path
     untouched); removing it later is painful. Reversibility is lopsided, so default to not
     adopting until measured need.

5. **BubbleMenu is DROPPED — 007 #4 (the bubble gradient/sizing mandate) is moot.**
   BottomNav won navigation; the spinning-wheel bubble menu is out of the product (already
   disabled — mount commented out in app/index.tsx). The FEATURE_INVENTORY mandates
   ("gradient colouring instead of today's look," "all bubbles the same size, big enough for
   the longest word") are therefore moot and require no resolution.
   - **Consequence for 008:** BubbleMenu is removed from the 008-blocked tier. 008 owns exactly
     **one** component — Surface.tsx — plus the ScreenBackground enrichment in (3). BubbleMenu
     is NOT ported (kept as dead reference in-repo until a separate cleanup removes it).
   - **Out-of-scope ripple (flagged, not absorbed):** dropping BubbleMenu touches the
     FEATURE_INVENTORY bubble-menu section, WHEEL_ITEMS routes, and any Shared-section wiring
     that assumed the wheel. This is a separate cleanup decision, NOT part of 008.

### Verification hooks (for the porting session)
- Surface: `ambient` glass blurs the backdrop; `overlay` glass blurs live content; non-glass
  identical across both contexts; all existing `<Surface>` call sites still render (default ambient).
- ScreenBackground: richer backdrop; ambient glass reads as frosted, not muddy; body text on
  exposed backdrop still legible (the ≤~0.2 core-opacity constraint).
- Confirm no Skia import landed.

---

## Decision 009 — Home preview convergence (composite + Plans phases)

**Status:** Decided 2026-06-30 (planning session resolving Home screen decisions 1–4).
No code written yet. Originally one session; **split** into Session A (composite:
Notes + Shopping previews) and Session B (Plans, tied to the full Plans redesign) so
the Plans-preview redesign stays attached to the full Plans redesign rather than being
half-done early.

**Phase placement:** Decisions 1 and 4 below are **Home-phase** work (Home is
near-last). Decisions 2 and 3 are **composite/Plans-phase** work. Ordering per
REBUILD_PLAN.md: record decisions → Session A (composite) → Session B (Plans, after its
own design decision is made) → Home phase (assembles 1+4 and the converged previews).

### Decisions

1. **Energy check-in — removed from Home.**
   `EnergyCheckIn` component and `useEnergyStore` stay in the repo but are unmounted from
   Home. The flagged "no difference between medium and high" ambiguity is *deferred, not
   resolved* — the feature simply isn't surfaced for now.

2. **Shared preview card — one card type across Notes / Plans / Shopping.**
   All three Home previews render through the single `ExpandableCard` primitive: preview
   content, mark-done via `rightAction`, inline add/remove in the body, and a "See more →"
   affordance routing to the full page. No bespoke per-section cards.
   - **Notes preview** = `InboxSection.tsx` (today on `Surface`, reads `useInboxStore`,
     renders nothing when empty; already routes to `/capture?id=` to edit a row).
   - **Plans preview** = `PlanTaskCard.tsx` — *already wraps `ExpandableCard`* in
     controlled mode; this is the reference implementation for the shared-card pattern.
   - **Shopping preview** = `WeekListCard.tsx` / `ShoppingRow` family. Already uses
     `ExpandableCard` for "From meals" dish groups; ungrouped rows use raw accent-bordered
     `View` cards and must be standardized onto `ExpandableCard`.

3. **Plans preview redesign — inherits the full Plans redesign.**
   The flagged "time now + rest of day" redesign applies to BOTH the full Plans screen and
   its Home preview, via the shared card pattern. **Executed in the Plans phase (Session B),
   not the composite phase.** The specific Plans visual direction is **still an open design
   question** — the edit note asks for "a better/easier way to view 'time now + rest of
   day'" but does not say what it looks like. Session B must NOT invent it silently; resolve
   it into an explicit decision with the user first (the way Focus mode was resolved here),
   and record the resolved direction here before building.

4. **Focus mode — Home-only view-state (Option C).**
   - Toggle in the upper-right header, immediately left of the Settings gear; same button
     toggles on/off.
   - ON: Notes and Shopping previews hidden; only the task/Plans surface remains, filtered
     to essential/remaining tasks (reads existing `importance` field — no store change).
   - No input affordances while focused — FAB and add/edit hidden. Done-toggle stays live
     (completing a task is "doing the thing," not input).
   - Completing the last visible task shows a gentle done-state, not an empty screen.
   - OFF by default; ephemeral — every app launch and navigation-away resets to unfocused.
     Not persisted.
   - Forward note (not built now): same one-at-a-time pattern is a candidate for a future
     "Tasks" screen. Intent only, no code.

### Session scoping (from the handoff)

- **Session A — composite phase:** converge **Notes (`InboxSection`)** and **Shopping
  ungrouped rows** onto `ExpandableCard` (decision 2). Plans deliberately excluded.
  - InboxSection: refactor `Surface` → `ExpandableCard`; add inline **edit of an existing
    note** in the card body (surface the existing `/capture?id=` route as an edit
    affordance — don't invent a new store path), closing the flagged "edit an old note"
    gap. Preserve one-tap →Task promotion with existing defaults, Discard, and
    render-nothing-when-empty.
  - Shopping preview: standardize ungrouped weekly rows from raw accent-bordered `View`
    cards onto `ExpandableCard` with `ShoppingRow` as body content; preserve tick-to-buy.
    Do NOT touch the full shopping screen's monthly to-buy → in-cart → bought logic.
  - **Precondition (stop if unmet):** `ExpandableCard`, `Surface`, `ShoppingRow`,
    `useInboxStore` / shopping stores must be ported and logged done in PROGRESS_LOG.md.
    If any is missing, stop and report — do not port it in Session A.
  - Out of scope: Plans preview, Home screen assembly, Focus mode, Energy check-in, store
    changes. Flag — don't fix — anything outside these two components.
  - Reference docs only: CARD_CONTAINER_LIBRARY.md, ANIMATION_GUIDELINES.md,
    SPACING_LAYOUT_LIBRARY.md.

- **Session B — Plans phase:** full Plans "time now + rest of day" redesign + preview
  convergence (decisions 2+3), run as part of / immediately alongside the Plans screen
  phase, NOT before it. Resolve the visual direction with the user first (see decision 3).
  - **Precondition (stop if unmet):** `ExpandableCard`, `PlanTaskCard`, `DraggableTaskRow`,
    `DayTimeline`, and the task store ported and logged done.
  - Out of scope: Notes/Shopping previews (Session A), Focus mode, Home assembly.

---

## Decision 010 — HintCard reach: parity vs. inventory-prose correction

**Status:** Resolved (was Open)
**Date:** 2026-07-01
**Context:** Read-only investigation confirmed the old app renders HintCard on
only 2 screens (scan, notes), not "most screens" as FEATURE_INVENTORY.docx
prose implies. The open question was whether to expand for parity or correct
the prose.

**Decision:** HintCard reach is decided per-screen at port time, not by a
global count. It is not a fixed-count feature and not a global setting. The
inventory's "most screens" phrasing is wrong framing, not a target to hit —
each screen's port decides whether HintCard belongs there on its own merits.
The 2-screen reality of the old app is the starting reference, not a ceiling.

**Consequence:** No HintCard reach work happens as its own task. It is folded
into each screen's Phase 5/6 port decision. HintCard stays intentionally flat
(existing locked exception).

### Finding (confirmed against old code)
`HintCard` is imported by exactly **two** screens — `app/scan.tsx` and
`app/notes.tsx` — NOT "most screens." (Other grep hits are the component's own
definition, i18n `hints.*` strings, and comments — not imports.)

---

## Decision 011 — A2: Shopping list overhaul

**Status:** Resolved (2026-07-01)
**Source:** FEATURE_INVENTORY.docx, 2026-06-21 notes — "Shopping list needs a big
overhaul. Looks crowded and hard to read because of the layout. I need input to
make decisions on the redesign."
**Supersedes old code where they conflict:** yes — target is the redesign below,
not current ShoppingRow.tsx / shopping screen behaviour.

Grounding note: on the actual shopping screen (app/shopping.tsx) the top-of-screen
competition is hint → shared-requests → per-list summary/progress → item
sub-sections (From meals / Shopping list / In cart, inside WeekListCard) →
bought-history → reset. (InboxSection is a home-screen component, not shopping —
the inventory's "incoming shares at top" note conflates the two; the redesign
targets the shopping screen's own shared-requests section.)

---

### A2-1 — Screen section order & hierarchy
**Choice:** Sticky compact header + scrolling body.
- A fixed slim header holds the summary + progress + reset-access (via an overflow
  menu — see A2-4). Header stays visible while the body scrolls.
- Everything else scrolls under it: shared-requests → items → bought-history.
- Hint renders inline once, at the first scroll position (not pinned).
**Why:** Keeps the summary/budget always visible while scrolling, which matches the
budgeting focus; de-crowds the top by moving hint/shared/history into the scroll.
**Trade-off accepted:** the sticky header costs some permanent vertical space.

### A2-2 — Row layout & density (ShoppingRow)
**Choice:** Two-line row, price kept visible.
- Line 1: leading check · name · price-total (right-aligned).
- Line 2 (smaller/dimmed): qty+unit · qty stepper (−/badge/+) · in-stock label.
- Remove moves to swipe-left (off the visible row).
- Reorder moves to a drag handle / drag gesture — the inline move-chevrons are
  retired (see Ripple R1).
- Cart 'undo' stays as a single trailing icon on 'cart' variant.
**Why:** Relieves the six-zones-on-one-line crowding while keeping money (line total)
glanceable, since budget is a first-class feature.
**Trade-off accepted:** swipe-to-remove is less discoverable than a visible ×;
line 2 is slightly busier than a meta-only second line.
**Applies to:** weekly ShoppingRow only (see A2-3).

### A2-3 — Weekly vs. monthly parity
**Choice:** Keep them deliberately different.
- Weekly stays the friendly checklist (redesigned ShoppingRow per A2-2).
- Monthly stays the spreadsheet/table (MonthlyTableRow), untouched by A2-2.
**Why:** The two serve different jobs — quick weekly ticking vs. monthly
planning/pricing with column-aligned scan. Lowest risk; no ripple into
MonthlyTableRow.
**Trade-off accepted:** two visual languages to maintain; may revisit unification
later if it reads as inconsistent (explicitly deferred, not decided against).

### A2-4 — Bought-history & reset placement
**Choice:** Remapped for the A2-1 = B layout (original "behind the segment" option
was C-only and not buildable here).
- Bought-history: collapsed "Bought this week (n) ▸" at the bottom of the scrolling
  body, expands in place.
- Reset: lives in the sticky header's overflow menu (keeps the destructive action
  out of accidental reach, and the header already owns reset-access under A2-1 = B).
**Why:** Fits the sticky-header + scrolling-body layout without inventing a second
pane; keeps reset deliberate rather than a tappable button in the flow.

### A2-5 — Add-sheet surface (AddItemSheet)
**Choice:** Out of scope for A2.
**Why:** Not flagged as crowded in the inventory; the add flow (name/price/qty/
temporary, centered modal) works and isn't part of the readability problem.

---

### Ripples flagged (not silently absorbed)
- **R1 — Reorder mechanism change.** A2-2 retires ShoppingRow's inline
  move-chevrons. The weekly call site (WeekListCard → app/shopping.tsx) currently
  passes reorder(id,'up'|'down') from useShoppingStore per-row. The redesign
  replaces this with a drag-based reorder. Scope: whichever session does A2-2 must
  wire drag reorder to the same store action (or an equivalent) and drop the
  chevron props.
  **Resolved 2026-07-02 (S1 planning, user call):** A prior Session A2·1
  attempt (PROGRESS_LOG 2026-07-01) STOPPED here — `DraggableTaskRow.tsx`
  exists only in the sibling All-the-small-things (old) repo, not yet ported
  into this one, and it is scoped to Phase 3d, which had not run. Rather than
  invent a separate drag mechanism or silently keep the chevrons (both
  forbidden), the user chose to **reorder the queue: run Phase 3d (ports
  `DraggableTaskRow` plus `DayTimeline`, `DatePickerCalendar`, `AddFAB`,
  `AddSourceChooser`, `EnergyCheckIn`) before Session A2·1.** This also
  satisfies Decision 009 Session B's precondition (`DraggableTaskRow` ported),
  so the single port unblocks both consumers. Session A2·1 wires its drag
  reorder to the now-ported `DraggableTaskRow` gesture pattern (adapted for a
  shopping row rather than a `PlanTaskCard` — same gesture primitive, new
  call site); it does not invent a new drag-and-drop implementation.
- **R2 — Remove affordance change.** A2-2 moves remove to swipe-left. The
  fromCatalog rows currently show a red InventoryIcon (put-back-to-catalog) vs. a
  plain × (delete) as their remove button. The swipe action must preserve this
  branch: catalog rows swipe to "put back to catalog"
  (useShoppingStore.putBackToInventory), ad-hoc/purchased rows swipe to delete.
  Same store actions, new gesture surface.
- **R3 — CHECKED_OPACITY reuse.** ShoppingRow exports CHECKED_OPACITY (0.55), reused
  by the "Shopping done" disabled state in app/shopping.tsx. The row redesign must
  keep exporting it (or the screen re-layout must re-home the constant) so the
  shared dim value doesn't fork.

### Design-system dependencies to VERIFY (not in project knowledge)
- Sticky-header material/elevation, swipe-action styling, and drag-handle affordance
  should be checked against the relevant *_LIBRARY.md docs at port time (materials/
  finishes + interaction patterns). Marked for verification — do not assume.

### Blocks / unblocks
- **Unblocks** the flagged-components / shopping composite phase, which was hard-
  blocked on this decision.
- **New sequencing dependency (2026-07-02):** Session A2·1 is now gated on
  Phase 3d's `DraggableTaskRow` port landing first (see R1 resolution above).
  Not a new open question — a scheduling dependency only.

### Packaging — split into two Claude Code sessions
- **Session A2·1 — ShoppingRow redesign** (A2-2 + ripples R1, R2, R3). Self-
  contained component work: two-line layout, swipe-remove with catalog/ad-hoc
  branch, drag reorder, CHECKED_OPACITY preserved. **Gated:** run only after
  Phase 3d (`DraggableTaskRow` et al.) is logged done in PROGRESS_LOG.md.
- **Session A2·2 — Shopping screen re-layout** (A2-1 + A2-4). Sticky compact
  header, scrolling body order, hint inline, shared-requests, collapsed history,
  reset-in-overflow.
- Order: **Phase 3d → A2·1 (row) → A2·2 (screen)**, so the drag primitive
  exists before the row needs it, and the screen re-layout composes the
  finished row.

### Sub-decision
- **See Decision 011a** — dish/ingredient checkbox nesting (whether a dish group
  gets its own checkbox two-way bound to its ingredient rows). Split out of A2's
  dish grouping; OPEN, blocked on a read-only Steps investigation.

---

## Decision 011a — Shopping list dish/ingredient checkbox nesting

**Status:** Resolved
**Date:** 2026-07-02
**Parent:** Decision 011 (A2 shopping list overhaul). Sub-decision spun off from
A2's dish grouping; does not supersede 011.
**Source:** Follow-on from Decision 011's "From meals" dish grouping —
lib/shoppingGroups.ts buckets ShoppingItems by dishName and WeekListCard renders
each dish group as an uncontrolled ExpandableCard. Open question: does a dish
group get its own checkbox bound to its ingredient rows' checked state.

### Investigation (I1–I4, read-only) — resolution tree outcome
PROGRESS_LOG.md's 2026-07-02 S0 entry confirms the "no reusable pattern"
branch: task Steps (`useTaskStore.ts` / `PlanTaskCard.tsx`, old repo) are an
independent, immediate-persist checklist with no roll-up/roll-down binding to
the parent task's `done` state, and no other dish/ingredient-style checkbox
nesting exists anywhere else in the old repo. There was no existing two-way
pattern to adopt — the three sub-questions below were decided fresh (user
call, since the record had no derivable answer for any of them).

### Decision
1. **Dish-level checkbox exists — full two-way bind.** A dish group gets a
   checkbox. Roll-up: when every ingredient in the dish is checked, the dish
   shows checked. Roll-down: tapping the dish checkbox checks or unchecks
   every ingredient in it in one action.
2. **State model — derived, not stored.** The dish's checked appearance is
   computed live from its ingredients' checked states on every read; there is
   no persisted `checked` column on the dish grouping itself. Tapping the
   dish checkbox does not write a dish-level flag — it fans out a bulk
   write to the underlying `ShoppingItem` rows (check all if not all are
   currently checked; uncheck all if all are currently checked), and the
   dish's own displayed state simply re-derives from the result on next read.
3. **Un-check semantics — folded into roll-down.** Because state is derived,
   there is no separate "un-check the dish while leaving ingredients alone"
   case to specify: unchecking the dish IS the roll-down write to all
   ingredients (see #1/#2). No dangling parent-only flag can exist.

### R4 — formal ripple record (derived-vs-stored dish checkbox)
`lib/shoppingGroups.ts` (or wherever the "From meals" grouping is read at
render time) must expose, per dish group, a computed `allChecked` (or
equivalent) derived from its `ShoppingItem[]`, plus a bulk-toggle action that
writes `checked` to every ingredient in that group via the existing
`useShoppingStore` per-item update path (no new store field). WeekListCard's
dish-group `ExpandableCard` header renders this derived value as its
checkbox and wires the bulk-toggle to its `rightAction`/tap handler. Scope:
whichever session builds/finishes WeekListCard's dish-group rendering (3c
remainder, since "From meals" dish groups are already `ExpandableCard` per
the 3c audit) owns wiring this — it is not a separate session.

### R5 — formal ripple record (WeekListCard as Level-1 container)
Referenced in the 2026-07-02 011a-logging entry as "referenced but not
defined." This is the full-screen container-role question for WeekListCard
that Decision 017 already resolved in full (per-list container retained
minus the full summary block, compact inline progress line for non-focused
lists, ungrouped rows converged onto ExpandableCard). R5 is formally closed
by reference to Decision 017 — no separate ripple work remains under this
number.

### Blocks / unblocks
- **Unblocks** the dish-group checkbox wiring inside WeekListCard's 3c port
  (previously blocked pending this decision).
- **No new blocks.** R4's wiring is scoped to the existing WeekListCard/3c
  session, not a new one.

### Numbering note
Filed as 011a (sub-decision of 011), consistent with the log's "012 is not 011"
discipline. The Steps-investigation handoff references "011a" and "R4"; this
entry is what "011a" points at, and R4/R5 are now formally defined above
rather than left dangling.

---

## Decision 001a — Focus-mode icon confirmed (Phase 1 flag closed)

**Status:** Resolved
**Date:** 2026-07-01
**Context:** Phase 1 shipped ScreenHeader/scaffold with the Home focus-mode
trigger using 'eye-outline' as a placeholder icon, onPress stubbed, both
pending confirmation.

**Decision:** 'eye-outline' is confirmed as the focus-mode icon. No change.
The Phase 1 open flag is closed. The onPress wiring (focus mode = Home-only,
ephemeral, hides Notes/Shopping + filters tasks, per Decision 009) is an
execution task for the Home screen phase, not a design open question.

**Supersedes:** Phase 1 "placeholder pending confirmation" note.

---

## Decision 009a — Plans preview = day-view, read-only (Session B unblocked)

**Status:** Resolved
**Date:** 2026-07-01
**Context:** Decision 009 converged Home previews on ExpandableCard and
deferred the Plans preview redesign to its own thread (Session B), flagged as
the real blocker. The open question was how much of the locked day-view lives
inside the Home preview card.

**Decision:** The Home Plans preview IS the day-view, rendered read-only. Not a
reduced sibling, not a Home-specific variant — the same component, same
structure, same rail. The only difference is Home renders it non-interactive.

This resolves the preview design questions by elimination:
- Collapsed state: current/in-progress + next + 2 after (4 rows), same as
  day-view. Current in-progress task always leads.
- Time rail: full proportional rail (Option C from day-view), same as day-view.
  The rail is the preview's identity, not a simplified marker.
- No current task (between tasks / pre-start): gap state — "Nothing until
  HH:MM" + the next task.
- Done zone: dimmed, collapsed by default, same as day-view. No divergence.

**Principle:** One component, one behavior. The value of "preview = day-view"
is that behavior is never forked between Home and the full Plans screen. Any
Home-specific variant was explicitly rejected to preserve this.

**Remaining TBD (does not block Session B start):** Rail axis-end tail — the
fixed padding added after the last unfinished task's end time. Needs a default
value. Everything else is decided.

---

## Decision 009b — Rail axis-end tail default

**Status:** Resolved
**Date:** 2026-07-01
**Context:** 009a left the rail axis-end tail as the one open number — the
padding added after the last unfinished task's end time so the final task
isn't jammed against the rail's bottom edge.

**Decision:** Proportional tail — 10% of the visible day's span. Scales with
how packed the day is: a dense day gets a proportionally small tail, a sparse
day gets more breathing room. No fixed-minute constant.

**Implementation note for Session B:** "Visible day's span" = from the rail
axis-start to the last unfinished task's end time. Tail = 10% of that span,
added below. Watch the degenerate case: a near-empty day (one task, short
span) yields a tiny absolute tail — if that reads badly on-device, a small
minimum floor (e.g. clamp to ≥15 min) is a reasonable execution-time
adjustment, but start with pure 10% and only add the floor if measured layout
needs it.

---

## Decision 012 — Note editing is shipped (stale inventory note corrected)

**Status:** Resolved
**Date:** 2026-07-01
**Context:** FEATURE_INVENTORY.docx (dated 2026-06-21) states note editing
doesn't exist / there is no Notes page. NoteRow.tsx references app/notes.tsx,
useNotesStore, and full edit callbacks. Read-only investigation of the old app
confirmed: the /notes route ships and is reachable, note editing is SQLite-
backed (update() for header + body), commit callbacks are wired.

**Decision:** Note editing exists and works in the old app. Port it as a
working, shipped feature — not as a gap to fill. The 2026-06-21 inventory note
is stale and does not override the code here.

**Note on the edit-notes-win principle:** The standing rule is that dated edit
notes beat old code when they conflict. This is the deliberate inverse: the
code wins because independent investigation confirmed the feature ships and is
reachable, and the edit note is a stale omission rather than an intentional
removal decision. Recording the inversion explicitly so it isn't mistaken for
the rule breaking down.

**Note on numbering:** filed as Decision 012 (not 011) — Decision 011 already
exists in this log (A2: Shopping list overhaul); this entry does not
supersede it.

---

## Open Backlog — unresolved decision threads (logged 2026-07-01)

**Not decisions.** This section is exempt from the append-only-resolved rule
above; it exists to track genuine open threads surfaced by the 2026-07-01
decision-log audit so they don't quietly become "forgotten" instead of
"deferred." When one of these is resolved, add a proper numbered Decision
entry above and remove (or mark resolved-see-Decision-NNN) its entry here.

None of these block Phase 2 primitives. Listed in no fixed order.

### OB-1 — Habit reminders: multiple per day
**Status:** Resolved — see Decision 016. Investigation showed this is a
C1-pattern case (the feature already ships end to end in the old app, not a
real addition); Decision 016 ratifies the shipped design and closes the
remaining gaps (legacy field drop, recipe persistence, quiet-hours parity).
Consuming work is scheduled for Phases 5/6 per REBUILD_PLAN.md, not yet started.

### OB-2 — Energy check-in: medium vs. high parity
**Status:** Resolved — see Decision 018. Phase 4 re-verified the underlying
claim against the old app's code (confirmed accurate, not stale) and offered
it as a question; the user's answer removed the feature outright rather than
fixing the medium/high distinction — General/Essential (the existing
`importance` field) plus Focus mode replace it entirely.

### OB-3 — Sharing: per-location explanation copy
**Source:** FEATURE_INVENTORY.docx edit note — asks for a short explanation of
"what it actually does" at each share location. Wording TBD.
**Status:** Resolved — see Decision 023. Phase 6 built the sharing screens and
surfaced the real share locations; the pre-seeded bilingual `shareExplain*` copy
was approved and wired into `share-modal.tsx`.
**Nature:** Copy/wording decision (not behaviour). Needs the actual short
explanatory string for each place sharing is offered — deferred until
`share-modal.tsx`/`shared.tsx` (Phase 6) are actually built.

## Decision 013 — ConfirmationBanner gains danger/warn variants

**Status:** Resolved.

**Context:** The old `ConfirmationBanner.tsx` is success-only — a tappable,
auto-dismissing banner with no `variant` prop (fill hardcoded to `theme.green`,
glyph `theme.white`, icon `checkmark-circle`). Phase 2 is about to port it. The
user wants danger and warn variants added at port time — a deliberate scope
expansion beyond the source, recorded here so the port builds against a real spec.

**Decision:** ConfirmationBanner ports with a `variant: 'success' | 'danger' | 'warn'`
prop (default `'success'`). All three keep existing behaviour (tappable, auto-dismiss
via `duration`, `message`/`onDismiss` API); variant changes only fill, glyph colour,
and icon. Fills use the strong semantic token, glyph `textInverse` on all three:

- **success** — fill `good`, glyph `textInverse`, icon `checkmark-circle`.
- **danger** — fill `bad`, glyph `textInverse`, icon `alert-circle`.
- **warn** — fill `warn`, glyph `textInverse`, icon `warning`.

`shadowColor` stays a shadow treatment (not tokenised). Public API stays a superset
of the old one — optional `variant` with a `'success'` default means existing callers
don't churn.

**Scope:** ConfirmationBanner primitive only. No caller migration this phase.

**Supersedes:** the success-only shape of the old `ConfirmationBanner.tsx`.

---

## Decision 014 — ExpandableCard accentColor tint scope after Surface delegation

**Status:** Resolved (ratifies a consequence of Decision 008)
**Date:** 2026-07-01
**Depends on:** 008 (glass around real blur), 009 (Home previews route through ExpandableCard)

### Context
Phase 3a ported `ExpandableCard` to delegate its card face to
`<Surface surfaceContext="ambient">` instead of hand-rolling the two-layer
material mask. Claude Code logged a "behavioral drop": `accentColor` now
tints only the 4px accent bar, no longer the card border/sheen. This decision
records the tint contract explicitly so the three Decision 009 preview
sessions (Notes, Shopping, Plans) consume a known behavior rather than
inheriting an unrecorded one.

### What the old source actually did with accentColor
- Fed it into `getMaterialStyle(accentColor ?? theme.orange, finish)`, which
  tinted the border and sheen — not the fill. The fill was always
  `theme.white`.
- Rendered a dedicated 4px accent bar (`styles.accent`).
- So the old capabilities were: (a) border/sheen tint, (b) accent bar. There
  was never fill tinting to lose — the Phase 3a summary's "fill tinting was
  inconsistent" overstates it.

### Decision
`accentColor` tints the 4px accent bar only. Border/sheen tinting is not
restored.

### Rationale
The border/sheen tint was already surrendered by Decision 008, not by this
port: once the card face delegates to `Surface`, `Surface` owns
border/sheen/blur and by design does not accept a caller's arbitrary border
tint. Accent-bar-only is the honest structural consequence of 008, not a new
design reduction. Category/accent signaling reads adequately from a 4px bar
for all current previews.

### Downstream to-do (non-blocking)
`health.tsx` is the one caller that uses `accentColor` for genuine
information (per-log severity), and it's a not-yet-ported screen. When
Health's store+screen phase runs, that session must confirm a 4px accent bar
still reads as severity, or add an explicit severity affordance (e.g. a
`Badge`). Flagged here so it isn't rediscovered cold.

### Contract for Decision 009 preview sessions
Notes / Shopping / Plans previews may pass `accentColor` for a thin accent
stripe only. Do not expect it to tint the card border, sheen, or fill. If a
preview needs stronger category color, use an explicit affordance (`Badge`,
icon tint), not `accentColor`.

## Decision 015 — Phase 3b sheets port against store interfaces, not implementations

**Status:** Resolved
**Date:** 2026-07-01
**Depends on:** phase order (Phase 3 composites precede Phase 5 stores+screens)

### Context
Three Phase 3b sheets consume Phase-5 store hooks that don't exist yet
(`useTaskStore`, `useShoppingStore`, `useShoppingListStore`, `useCatalogStore`,
`useMealStore`). Two more import store types only (`ShoppingItem`,
`ShoppingList`). Pulling the stores forward would move Phase 5 work into
Phase 3 and hollow out Phase 5's "port each store alongside its smallest
screen" validation.

### Decision
Declare the minimal store API surface the sheets consume as thin typed
interfaces now (a stub module per store that satisfies the type checker).
Port the 3b sheets against those interfaces. Phase 5 implements each real
store to its declared contract and does its port-alongside-screen validation
as designed. No store logic moves into Phase 3.

Contract surface the 3b sheets actually require (from old source, verified):
- `useTaskStore` — `add(task: TaskInput): void`. `TaskInput` fields: `title`,
  `date`, `time?`, `taskType`, `durationMinutes?`, `done`, `recurring`,
  `recurringDays`, `importance`, `sortOrder`.
- `useShoppingStore` — `add(item: ShoppingItemInput): void`; exports type
  `ShoppingItem` (consumed by UpdateSheet).
- `useShoppingListStore` — `currentList(dateStr: string): { id: string } |
  undefined`; exports type `ShoppingList` (consumed by ListSettingsSheet).
- `useCatalogStore` — `suggest(name: string): string[]`.
- `useMealStore` — `dishes: Dish[]` (`Dish`: `id`, `name`, `ingredients`).

### Rationale
The sheets are mostly presentational — UpdateSheet and ListSettingsSheet
mutate only via callbacks (no hook); AddItemSheet/AddDishSheet are read-only
consumers. Only QuickAddSheet and ShoppingQuickAddSheet dispatch writes. The
write surface is two `add()` calls with known payloads. Declaring that
surface is cheap and precise; implementing the stores now is not.

### Phase 5 obligation (recorded so it isn't lost)
When each store is implemented in Phase 5, it must satisfy the interface
declared here. If Phase 5 finds the contract wrong, that's a real signal —
fix the contract and re-typecheck the consuming sheet, don't silently
diverge. The stub modules are placeholders: they must throw or be replaced at
runtime, never ship as real behavior.

## Decision 015a — useCatalogStore.suggest() contract correction (extends Decision 015)

**Status:** Resolved
**Date:** 2026-07-01

### Context
While porting AddItemSheet and AddDishSheet against Decision 015's declared
`useCatalogStore` interface, both old-source call sites turned out to call
`suggest(name, limit)` (two args) and consume the result as objects with
`.id`, `.name`, `.price` (rendered directly in a suggestions dropdown,
including a price display) — not the `suggest(name: string): string[]`
signature Decision 015 declared.

### Decision
Correct the stub contract to match verified old-source usage:
`suggest(name: string, limit?: number): { id: string; name: string; price: number }[]`.
Both consuming sheets (AddItemSheet, AddDishSheet) are ported against this
corrected signature. No other part of Decision 015's contract changes.

### Rationale
Per this session's own instructions, a sheet calling a store method beyond
the declared contract must not be papered over — the contract was
under-specified for this one method, not wrong in spirit. Recording the
correction here rather than inventing/renaming call sites to fit the
original stub keeps the stub honest as a Phase 5 obligation.

---

## Decision 016 — Habit reminders: multiple per day (ratify shipped design + close gaps)

**Status:** Resolved.
**Date:** 2026-07-01
**Resolves:** OB-1 (Open Backlog). Mark OB-1 as `resolved — see Decision 016`.
**Depends on:** 006 (colour tokens). Touches habit-form (later form phase),
`useHabitStore` + `lib/habitNotifications` + `lib/notifications` (later
store+screen phase), and the settings notifications tab (later settings phase).
No code written by this entry.

**Note on numbering:** drafted upstream as "Decision 015" — this log already
uses 015 for the Phase 3b store-interfaces decision, so this entry is filed as
016 instead. Content is otherwise unchanged from the source document.

### Context

OB-1 was logged as a feature *addition* ("old app supports one fixed reminder
time; request is N per day"). Investigation of the actual sources proves this is
a **C1-pattern case**: the multiple-reminders-per-day feature already ships in
the old app, end to end.

- **Data model:** `Habit.notificationTimes: string[]` (SQLite column
  `notification_times`, JSON, migration present in `lib/db.ts`). Legacy
  `notificationTime` (`notification_time`) is kept mirrored to
  `notificationTimes[0]` for back-compat.
- **UI:** `app/habit-form.tsx` has a three-mode reminder picker — *Once*
  (single time), *Several times* (N reminders evenly spaced across a start–end
  window, stepper 2–12), *Every…* (interval chips 30/60/90/120/180/240 min
  across a window) — with a live preview line. `computeReminderTimes()`
  resolves all three modes to a flat `HH:MM` list.
- **Scheduling:** `lib/habitNotifications.ts` schedules one daily trigger per
  time (`habit-<id>-<i>`, capped at `MAX_HABIT_REMINDERS = 24`) and cancels the
  legacy `habit-<id>` key before rescheduling.
- **i18n:** all mode/count/interval/preview strings exist in `lib/i18n.ts`.

**The 2026-06-21 FEATURE_INVENTORY line ("Today only ONE fixed time is
possible") is STALE.** This is the second proven-stale note from that same
dated pass (the first was note-editing, Decision 012). See the source
correction below.

Same inversion note as Decision 012 applies: the standing rule is
edit-notes-win, but here the code wins because independent investigation
confirmed the feature ships and is reachable, and the edit note is a stale
omission rather than an intentional decision. Recorded so it is not mistaken
for the rule breaking down.

### Decision

Port the shipped multiple-reminders-per-day design, ratifying it as the target
and closing the specific open sub-decisions investigation surfaced.

**Q1 — Overall stance: PORT AS-IS (option A).**
Keep the three modes (Once / Several times / Every…), the start–end window
pickers, the stepper/interval chips, and the live preview line. It is a
complete, working design; do not simplify to a raw add/remove time list and do
not open a redesign thread.

**Q2 — Legacy `notificationTime` field: DROP FROM LIVE SCHEMA (option C).**
`notificationTimes` (`notification_times`) is the sole source of truth in the
new schema. Do **not** carry `notification_time` as a live mirrored column in
UnFocus.
- Underlying question this resolves: **direct import of old-app data into
  UnFocus is NOT assumed in scope.** No decision anywhere commits to importing
  the old SQLite DB.
- Import path preserved on paper: **if** old-app import tooling is ever built,
  it must map old `notification_time` → new `notification_times` (wrap the
  single value in a one-element array when `notification_times` is empty). This
  mapping requirement is recorded here so the clean schema does not silently
  foreclose a future import.
- Consequence for the form/store port: drop the back-compat mirroring writes
  (`notificationTime` kept equal to `notificationTimes[0]`). The store's
  `rowToHabit` fallback that reads `notification_time` when `notification_times`
  is empty is import-layer concern only and does not belong in the live read
  path.

**Q3 — Reminder mode round-trip on edit: PERSIST THE RECIPE (option B),
stored as 3B-ii.**
The old form is lossy: a habit saved via "Every 2 h" reopens in "Several times"
mode (times preserved exactly, editing mode lost). Fix by persisting the
editing recipe so a habit reopens in the mode that created it.

- **Storage shape: 3B-ii — store recipe AND the resolved list.** The resolved
  `notification_times` list stays authoritative for scheduling (matches the
  shipped scheduling path, smallest diff, no recompute-on-load risk). The
  recipe columns are **editing metadata only**; if recipe and list ever
  disagree, the **list wins**.
- **New nullable columns** (only meaningful when `notification_times` has >1
  entry): `reminder_mode TEXT`, `reminder_count INTEGER`,
  `reminder_interval_min INTEGER`, `reminder_start TEXT`, `reminder_end TEXT`.
  Added via the migrations array in `lib/db.ts` (never recreate tables).
- **Rejected alternative, recorded for reversibility — 3B-i:** store recipe
  only and recompute `notificationTimes` on load. Single source of truth, no
  drift, but changes the scheduling path (list stops being persisted as such)
  and is a bigger diff from shipped code. Not chosen; revisit only if the
  redundant list proves to cause real drift bugs.

**Q4 — Quiet hours vs. habit reminders: DEFER PAST QUIET HOURS (option B),
skip-inside-window.**
Confirmed old-app asymmetry: task reminders defer past quiet hours; habit
reminders ignore quiet hours entirely. With N reminders/day (e.g. every 2 h,
08:00–22:00) evening pings colliding with a quiet window become likely, so the
asymmetry is closed.

- Habit reminder occurrences that fall **inside** the quiet window are
  **skipped** for that day — NOT shifted. Rationale: shifting multiple
  occurrences to the window's end would pile several near-identical reminders
  onto one moment; skipping is the calmer behaviour and fits the app's
  no-pressure framing.
- The task-side deferral (`deferPastQuietHours` in `lib/taskNotifications.ts`,
  which *shifts*) is deliberately NOT reused verbatim — habits skip, tasks
  shift. Both consult the same pure `isWithinQuietHours` math in
  `lib/notifications.ts`.
- **Copy update required:** the settings quiet-hours hint currently reads
  "*Task* reminders wait until quiet hours end…". Update it to cover habits too
  and to reflect skip-not-wait for habits. Exact wording is a settings-phase
  copy task; flagged, not drafted here.
- Implementation note for the future store/notifications phase:
  `syncHabitReminder` must take the quiet-hours settings (enabled/start/end),
  same way `taskNotifications` already receives a `TaskNotifSettings` subset,
  and drop occurrences where `isWithinQuietHours` is true.

**Q5 — Ratify shipped defaults: ALL AS-IS (option A).**
- Cap of 24 scheduled reminders per habit (`MAX_HABIT_REMINDERS`).
- Count mode range 2–12.
- Interval floor 15 min; offered options 30/60/90/120/180/240 min.
- Inverted window (end ≤ start) collapses to a single reminder at start.
- All reminders for a habit share the same title/body.
- Notification toggle OFF ⇒ `notification_times` saved empty (`[]`).

### Scope

Spec/decision only. Consumed later by three separate phases, each on its own
session, none unblocked by this entry alone. Per REBUILD_PLAN.md, these fall
under **Phase 6** ("self-contained forms" includes `habit-form.tsx`) and
**Phase 5** ("stores + paired screens") — both phases have not started as of
this entry; do not pull this work forward out of sequence without an explicit
scope call recorded here first.
1. **Form phase** — `habit-form.tsx`: port the three-mode picker + preview;
   drop the `notificationTime` mirror write (Q2-C); persist recipe columns
   (Q3 / 3B-ii).
2. **Store + notifications phase** — `useHabitStore` / `lib/habitNotifications`
   / `lib/db` migration: add the five recipe columns; make `syncHabitReminder`
   quiet-hours-aware with skip-inside-window (Q4-B); remove live-path reliance
   on `notification_time`. Note: `lib/notifications.ts` and
   `lib/taskNotifications.ts` do not exist in this repo yet either as of this
   entry — this phase also depends on their prior porting.
3. **Settings phase** — quiet-hours hint copy update (Q4).

### Adjacent finding (not resolved here, flagged for the settings phase)

The old settings screen merges task + habit notifications into a single "Plan
notifications" toggle (`applyAndSync({ taskNotificationsEnabled: v,
habitNotificationsEnabled: v })`; no separate habit toggle;
`taskNotificationsEnabled` read as the display value for both). Whether UnFocus
keeps that merge or splits habit notifications back out is a **settings-screen
content decision** for the settings phase — recorded so it is not lost, not
decided here.

### Source correction (FEATURE_INVENTORY line proven stale)

- Habit reminders / "Add the option for several reminders a day… Today only ONE
  fixed time is possible" (dated 2026-06-21) → **STALE.** Multiple reminders
  per day (Once / Several times / Every…) ship and are reachable in the old
  app. Treat the feature as DONE and port it; the request is already satisfied.
- **Pattern watch:** two 2026-06-21 notes now proven stale (note-editing →
  Decision 012; habit reminders → this entry). Remaining unverified claims from
  that same dated inventory pass should be treated as *possibly* predating a
  late implementation burst — verify against code before treating any of them
  as a gap.

**Supersedes:** the OB-1 "real feature addition" framing. OB-1 is closed.

## Decision 017 — WeekListCard's full-screen role (post-A2-1 / post-009 #2)

**Status:** Resolved
**Date:** 2026-07-01
**Depends on:** 009 (#2 preview convergence), 011 (A2-1 sticky header, A2-2 row
redesign)
**Source:** Phase 3c gated-card audit (2026-07-01) — WeekListCard was ⚠ on
"entangled with 009 #2 + 011" but neither decision specified its remaining
container role on the FULL shopping screen. Left cold, Code would silently
re-decide (double-converge, or fork the full-screen card from the Home
preview).

**Note on numbering:** drafted upstream as "Decision 016" — this log already
uses 016 for the habit-reminders decision (filed earlier the same day), so
this entry is filed as 017 instead. Content is otherwise unchanged from the
source document.

### Context
On the full shopping screen, WeekListCard per list owned: (1) a per-list
summary/progress header, (2) "From meals" dish groups (already ExpandableCard),
(3) ungrouped weekly rows (raw accent-bordered View cards), (4) "In cart".
Decision 011 A2-1 lifted (1) into a screen-level sticky header. Decision 009 #2
converged (3) onto ExpandableCard but scoped that to the Home preview ONLY,
explicitly forbidding touching the full screen. That left the full-screen
WeekListCard half-specified.

### Decision
1. **Container role (Q1):** WeekListCard stays as a per-list container on the
   full screen, keeping its own list-level chrome — title, lock, delete
   (trash), bookmark/SavedLists entry, and the container shell — MINUS the full
   summary/progress block (that lives in the sticky header per A2-1). It is not
   dissolved; the screen does not render sections directly.

2. **Row convergence (Q2):** The full-screen ungrouped weekly rows ALSO
   converge onto ExpandableCard, matching the Home preview (009 #2). One
   row-container language everywhere — the full screen and the Home preview no
   longer fork. This extends 009 #2's convergence to the full screen; 009 #2's
   "do NOT touch the full shopping screen" scope limit was a Session-A scoping
   boundary, not a decision that the full screen should stay unconverged. That
   boundary is now lifted for the row-container question specifically (and only
   that), and this extension is recorded here rather than by editing 009.

3. **Multi-list summary (Q3 + Q4):** The full screen shows several Week list
   Containers at once. The sticky header (A2-1) summarizes the **focused/current
   list only** — NOT an aggregate across all lists. Each **non-focused** list
   shows a **compact inline progress line in its own card header** (Q4-A). The
   compact inline line and the sticky header's summary are the SAME data at two
   densities — the sticky bar is the focused list's inline line, promoted and
   expanded. One progress calculation, two presentations; no fork.

### Bounded amendment to Decision 011 A2-1 (flagged, not silently absorbed)
A2-1 lifted the per-list summary/progress OUT of WeekListCard into the sticky
header and did not anticipate the multi-list case. Q4-A reintroduces a COMPACT
progress readout into each card header (non-focused lists). This is not a
reversal of A2-1 — A2-1 removed the FULL summary block; this adds back a
compact line — but it splits progress presentation across the sticky header
(focused, full) and the card header (non-focused, compact). Recorded as a
bounded amendment so the A2·2 screen-layout session builds the sticky header as
**focused-list-only, not aggregate**, and the row-redesign / screen-layout
sessions know the card header now carries a compact progress line.

### Consequences for Phase 3c / the shopping sessions
- WeekListCard is now UNBLOCKED for its 3c port, targeting: per-list container
  with list-level chrome, no full summary block, compact inline progress line in
  its header (non-focused state), dish groups + ungrouped rows both on
  ExpandableCard.
- Session A2·2 (shopping screen re-layout): sticky header summarizes the focused
  list only; tapping a list focuses it (promotes its compact line into the
  sticky bar). "Focused/current list" selection mechanism is a screen-layout
  detail for A2·2 — not re-decided here — but it MUST drive which list the
  sticky header reflects.
- No change to Monthly (MonthlyTableRow), "From meals" dish groups (already
  ExpandableCard), or the monthly to-buy → in-cart → bought logic.

### Blocks / unblocks
- **Unblocks:** WeekListCard's 3c port (was the one genuinely-unresolved gated
  card).
- **No new blocks.** The focused-list selection mechanism is an A2·2 in-session
  layout detail, not a separate planning blocker.

---

## Decision 018 — Energy check-in removed; General/Essential are the only task modes, gated by Focus mode

**Status:** Resolved (user call, answering Phase 4's Question 1)
**Date:** 2026-07-02
**Resolves:** OB-2 (Open Backlog — energy medium/high parity). Mark OB-2 as
`resolved — see Decision 018`.
**Supersedes:** Decision 009 (1)'s "`EnergyCheckIn` component and `useEnergyStore`
stay in the repo but are unmounted from Home" — that clause is superseded below;
the rest of Decision 009 (##2–4, the ExpandableCard convergence and Focus mode
spec) is untouched.

### Context
Phase 4 compiled OB-2 as an open question rather than deciding it: today only
`energy === 'low'` does anything (narrows tasks to `importance === 'essential'`
in the old app's `lib/taskSuggestion.ts`/`app/plans.tsx`); medium and high are
identical no-ops. Verified accurate against the old app's actual code (not a
stale inventory note) before asking. Offered as Question 1: give medium a real
tier, collapse to two levels, or leave as-is.

### Decision
The user chose a fourth option not offered: **remove the Energy check-in
feature entirely**, rather than fixing or collapsing its three levels. Task
"intensity" going forward is exactly the two-value model the codebase already
has (`Task.importance`: `'regular' | 'essential'`, `tasks.importance` SQLite
column) — no new field, no data migration. The old app's separate
low/medium/high battery picker is not ported at all.

**Terminology:** the two importance values are user-facing "modes" —
**General** (today's `'regular'`) and **Essential**. Focus mode (Decision 009
(4), already fully specified — Home-only, ephemeral, header toggle left of the
gear) is the *sole* mechanism that switches between them: OFF shows General
(everything); ON filters to Essential only. No separate energy-driven filter
path exists or is ported — Focus mode fully replaces what the old app's
low-energy check-in used to do.

### Consequence for code (executed same session as this entry)
- `components/EnergyCheckIn.tsx` and `store/useEnergyStore.ts` — **deleted**,
  not just left unmounted. They were Phase 3d Decision-015 stub ports with
  exactly one consumer relationship (the component read the stub store); no
  other file imported either.
- `lib/i18n.ts` — removed the now-orphaned `en.energy`/`no.energy` string
  blocks (check-in prompt, low/medium/high labels, low-energy hint). Renamed
  `importanceRegular` ("Regular"/"Vanlig") → **"General"/"Generelt"** to match
  the mode terminology above — reuses the exact word already established by
  the (currently unused, old-two-section-stack-only) `generalSectionLabel`
  key, so "General" isn't a novel term in this codebase. `importanceLabel`
  ("Importance"/"Viktighet") renamed to **"Mode"/"Modus"** to match. Neither
  renamed key has a real consumer yet (task-form.tsx is Phase 6) — zero
  behavioral risk.
- `lib/db.ts` — the `energy_logs` table (`CREATE TABLE IF NOT EXISTS`) and its
  retention-pruning line are **left in place, unused** — per this codebase's
  standing "never drop/recreate tables" invariant (AGENTS.md), dead schema is
  the safe default over surgically removing a table, even for a feature that
  never shipped to a real device from this rebuild. Removed the stale
  `store/useEnergyStore.ts` entry from the file's own `Used by →` header list
  (that store never actually imported `db.ts` — it was an in-memory Decision
  015 stub — so this is a header correction, not a functional change).
- `components/DayTimeline.tsx`'s `task.importance === 'essential'` star-marker
  rendering is unrelated to this decision and is unchanged — that's the
  "important tasks marked" visual cue (FEATURE_INVENTORY's Today's-plans
  section), not an energy-driven filter.

### Rationale
The user's answer resolves the ambiguity by elimination rather than by picking
one of the offered options — cheaper than adding a third meaningful tier, and
it removes a feature (a once-a-day mood check-in) that Decision 009 had
already benched from Home with no re-mount planned. Reusing the
already-two-value `importance` field means no new store, no new DB column, no
new migration — the smallest possible diff that satisfies "General and
Essential modes, gated by Focus mode."

### Blocks / unblocks
- **Closes OB-2.** No further Energy-related work anywhere in the plan.
- **No new blocks.** Focus mode's own build-out remains exactly what Decision
  009 (4) already specified (Home phase work, not yet started) — this entry
  doesn't add new scope to it, only confirms it's now the only intensity
  toggle in the app.

## Decision 019 — Task "next-time hint" note field

**Status:** Decided.
**Date:** 2026-07-02
**Phase placement:** Phase 5 (stores) + Phase 6 (screens). No code written by
this entry.

### Context

Same user request that produced Decision 018 (connect-tasks/link feature): a
place to capture "this makes it easier / simpler next time" (e.g. "put the
thing in a specific spot"). User confirmed this is conceptually the same
mechanism as the connect-tasks idea, but it resolves to its own small field,
not the link — so it is recorded here separately per the ripple principle
rather than welded onto 018.

### Decision

- Add a freeform optional `hint` (working name — final name TBD at build) string
  field on `Task`, surfaced on the task card / in the task's detail when the
  task comes up. No behavior beyond display.
- New nullable column on `tasks`: `hint TEXT DEFAULT ''`.
- All visible strings via `useT()`; renders through the existing card — no new
  component.

### Notes

- Independent of Decision 018 — ships on its own, does not require the link.
  Could be sequenced earlier within Phase 5/6 as the cheaper of the two.
- Small; net-new scope. Not a checklist item on FEATURE_INVENTORY.docx — this
  entry is the system of record for it.

### Blocks / unblocks

- **No blocks.** Independent of the connect-tasks link (below) and of the
  still-stub `useTaskStore` (Decision 015) — this is a field to add when
  Phase 5 implements the real task store, not before.
- **Note on this entry's own internal references (added by Decision 020,
  not an edit to this entry):** the "Decision 018" this entry cross-references
  above ("Same user request that produced Decision 018 (connect-tasks/link
  feature)"; "Independent of Decision 018") is the connect-tasks/"then" link
  feature, which is recorded below as **Decision 020**, not 018 — it collided
  twice on the way to a stable number (drafted as 018, then briefly 019) while
  this entry was concurrently merged under 019. Read this entry's "018"
  references as "020." Left as originally written per the append-only rule
  (past entries are never edited in place); this note lives on the
  superseding entry instead.

---

## Decision 020 — Task "then" link (one-to-one follower, surfacing-only)

**Status:** Decided
**Date:** 2026-07-02
**Note on numbering:** this entry collided twice while in flight. Drafted and
originally filed as "Decision 018" in this same planning session; on rebase,
`main` had independently filed a different Decision 018 (Energy check-in
removal), so it was renumbered to 019 — same precedent as Decision 017's
renumbering. Before that renumbered version could be pushed, `main` again
independently merged a different Decision 019 (the "next-time hint" note
field, above — from the same user conversation as this feature, and which
still refers to this entry internally as "Decision 018," predating both
renumberings). Filed here, finally, as Decision 020. Content is otherwise
unchanged from the original entry.
**Phase placement:** Phase 5 (stores) + Phase 6 (screens). NOT composite-phase
work. Recorded now for traceability; deferred to build. This is net-new
architecture, not the resolution of an existing inventory ambiguity.

**Origin:** User feature request — an intuitive way to connect tasks done in
sequence (e.g. a morning routine). Explored A (steps), B (routine container),
C (soft link); user chose C. Design constraint stated by user: setup cost per
task must be near-zero, and the link must feel part of the checklist without
being "too much to think about per task."

### Resolved shape
1. **Cardinality: one-to-one.** A task has at most one optional follower
   ("then → this task"). One predecessor → one follower. Not many-followers.
   This makes it a single nullable column, not a join table.
2. **Behavior: surfacing-only, NOT notifying.** Completing a task
   surfaces/highlights its follower (floats to top / visually flagged in the
   day view). It does **NOT** schedule a separate notification for the
   follower. This is the deliberate move that keeps setup to one inline
   action and sidesteps all notification-timing design.
3. **Direction: one-directional.** The link points predecessor → follower
   only.
4. **Setup: inline.** Set from within the task being edited (a single
   "then → pick a task" affordance), not a separate linking screen.
5. **Independence preserved.** Both linked tasks remain fully independent
   Tasks — own date, time, importance, recurrence, and their own existing
   per-task notification. The link adds nothing to and removes nothing from
   either task's own scheduling.

### Schema (verified against lib/db.ts — no existing task-to-task reference
exists)
- New nullable column on `tasks`: `follows_task_id TEXT DEFAULT NULL`
  (or `then_task_id` — name TBD at build, not a decision-level question).
- **Deletion:** `ON DELETE SET NULL` semantics — if the predecessor is
  deleted, the follower loses its incoming link cleanly (no orphan).
  Precedent: `task_steps` uses `ON DELETE CASCADE`; `plans.tsx` self-heals
  orphaned `task_drafts` on mount. Follower link uses SET NULL rather than
  CASCADE because deleting A must NOT delete B (B is an independent task).

### Open sub-questions for the build session (do NOT let a coding session
decide silently)
- **Recurrence interaction:** if both tasks recur weekly, does the link
  persist across recurrence instances? (Leaning: link is on the task
  definition, so yes, but confirm at build — flag, don't assume.)
- **Cross-date links:** predecessor and follower on different dates — does
  surfacing pull the follower into today's view, or only highlight it on its
  own date? (Leaning: highlight in place, no date-move, to avoid silently
  rescheduling. Confirm at build.)
- **Cycle guard:** one-to-one prevents wide fan-out but A→B→A is still
  possible; the setup UI must prevent selecting a task that already points
  (transitively) back.

### Out-of-scope ripple (flagged, NOT absorbed into 020)
- **Per-follower notifications** ("extra notifications for that stuff could
  be useful if implemented properly" — user). This is a DIFFERENT want and is
  explicitly NOT built into the link. If a followed task needs its own
  reminder, that is the task's own existing notification. Any behavioral
  "notify the follower when predecessor completes" is a separate future
  decision, not part of 020.

### Blocks / unblocks
- **Unblocks:** nothing yet buildable this session — recorded for
  traceability ahead of Phase 5/6 work on this feature.
- **No new blocks** on in-flight phases; this is net-new, additive schema.
- **Independent of Decision 019** (the "next-time hint" note field) — related
  origin, separate mechanism, no dependency either direction.

---

## Decision 021 — Re-adding an already-listed shopping item (increment parity + feedback)

**Status:** Resolved
**Date:** 2026-07-02
**Note on numbering:** drafted and originally filed as "Decision 018" in this
planning session, per the same numbering precedent as 017/020 above — 018,
019, and 020 were each independently claimed by other parallel sessions
before this one landed, so it is filed here as 021. Content is otherwise
unchanged from the original entry.
**Phase:** Phase 5 (store behavior) + Phase 6 presentational touch (ShoppingRow highlight).
Recorded now, executed when the shopping-store session runs — held out of any
Phase 3/4 Code session.
**Source:** Planning-chat product question ("adding to week both from itself and
from monthly — three states: already there / newly added / amount increase").

### Reference-repo inconsistency being resolved
In the old repo (`All-the-small-things`, working code), the two re-add paths
disagree:
- `add()` on a matching weekly row **increments** amount
  (`existing.amount + item.amount`), keyed on status+listId+name+dishName.
- `addToWeeklyFromCatalog()` **overwrites** amount
  (`amount: String(Math.max(1, quantity))`) and only matches `status='catalog'`
  rows — so an item already at `status='inWeeklyList'` isn't even found by this
  path (its catalog row no longer exists).
Per the "edit notes / target win over old code" rule, the target unifies on
increment; the overwrite behavior is a bug not to be ported.

### Decision
1. **Re-add increments (both paths).** Re-adding an item that already exists in
   the target week list adds to that row's existing amount rather than
   overwriting it. `addToWeeklyFromCatalog` (or its UnFocus successor) is
   brought in line with `add()`'s increment semantics for the case where a
   matching `inWeeklyList` row already exists.
2. **Feedback is ephemeral, no schema change.** When a re-add bumps an existing
   row, the affected ShoppingRow shows a brief highlight ("just added" / "amount
   increased") that fades out. No persisted per-row status column, no new
   ShoppingItem field. The three conceptual states (already-there / newly-added /
   amount-increased) are a transient presentational treatment, not stored data.
3. **Scope of the highlight.** The "already there → increment" highlight applies
   only to the same-item-re-added case (matching status+listId+name+dishName).
   It does NOT apply to the cross-dish standalone case — that case's decision
   is **not yet filed in this repo** (see numbering note below); treat the
   cross-dish case as open until that entry lands.

**Numbering/cross-reference note:** the source planning conversation for this
decision referred to the cross-dish standalone case as "Decision 019," but by
the time this entry was filed, 019 had already been independently claimed
here by the unrelated task "next-time hint" note field (same collision
pattern as 017/020 above). The cross-dish decision itself was never committed
to this repo under any number — do not assume it is 019, 020, or any entry
above. A future session must file it fresh and this entry's item 3 should be
updated to point at the real number once it exists.

### Consequence / ripple
- The eventual shopping-store Code session must NOT port
  `addToWeeklyFromCatalog`'s overwrite line verbatim. Flag in that session's prompt.
- ShoppingRow gains a transient highlight state (local component state or a
  short-lived prop pulse); no store or schema involvement.

### Blocks / unblocks
- **Unblocks:** nothing yet buildable this session — `useShoppingStore.ts` is
  still the Phase 5 `notImplemented` stub (Decision 015); this decision is
  recorded for traceability ahead of that build.
- **No new blocks** on in-flight phases.
- **Depends on the not-yet-filed cross-dish standalone-case decision** for the
  scope carve-out in item 3 above — flag for a future planning session, not a
  Code session.

  **Pointer update (added by Decision 022, not an edit to this entry):** the
  cross-dish standalone-case decision referenced above now exists — see
  **Decision 022** below. Per the append-only rule, this note lives on the
  superseding entry rather than editing item 3 in place.

---

## Decision 022 — Drag-to-merge a standalone item into a dish group

**Status:** Resolved
**Date:** 2026-07-02
**Phase placement:** Phase 5 (store action) + reuses the existing Phase 4 drag
mechanism (Decision 011 R1: `DraggableTaskRow` + screen-owned hit-testing). No
code written by this entry.
**Origin:** Same planning conversation as Decision 021 (re-add increment
parity); this is the cross-dish standalone-item case that entry's item 3
explicitly carved out of scope and left unfiled (see Decision 021's "Blocks /
unblocks" and its numbering note — the source conversation called this case
"Decision 019," but 019 was independently claimed by an unrelated entry before
this one could land, so it is filed fresh here as 022).

### Context
Adding "garlic" as a standalone item when garlic already exists inside a dish
group does **not** auto-merge on add: standalone garlic (`dishName: undefined`)
and dish garlic (`dishName: 'X'`) are different `groupByDish` keys, so they
correctly land as separate rows. This matches `add()`'s existing dedup
behavior (Decision 018/021 pattern) — confirmed not a bug, no change to `add()`.

Instead, the user can **drag** the standalone row onto the dish's matching row
to combine them.

### Decision
1. **Merge trigger:** only a same-name drop merges. Dropping a row onto
   another row with a different name falls back to normal reorder behavior
   (no merge, no rejection — existing `reorder()` semantics apply unchanged).
2. **Result shape:** on a same-name drop, the two rows merge into one, which
   **joins the dish** — keeps the dish's `dishName`, stays inside the "From
   meals" `ExpandableCard` group, and shows the summed amount. The standalone
   row is removed.
3. **Confirmation:** none — the merge applies **immediately** on drop, with
   an ephemeral undo affordance (toast/snackbar), not a confirm dialog. Same
   presentational spirit as Decision 021's transient highlight: no schema
   change, no persisted "pending merge" state.
4. **New store action required.** `useShoppingStore` has no merge action —
   `reorder()` only swaps adjacent `orderIndex` values, it does not combine
   rows. A new action (working name TBD at build, e.g. `mergeItems`) must sum
   the two rows' amounts, adopt the dish row's `dishName`/group membership,
   and delete the standalone row. This slots into the **existing** drag
   mechanism (`DraggableTaskRow` + screen-owned hit-testing, Decision 011 R1)
   as a drop-target outcome — it must not introduce a parallel gesture.

### Notes / consequences to flag at build (do NOT let a coding session
rediscover these)
- Once merged, the ex-standalone item is **indistinguishable** from an
  original dish ingredient — grouping is derived purely from `dishName`, there
  is no provenance flag. It therefore rides along with the dish for: Decision
  011a roll-down uncheck, dish removal, and monthly reset. This is the
  accepted consequence of "joins the dish" (item 2 above), not a bug to fix
  later.
- After the merge sets `dishName`, a future re-add of dish-garlic
  auto-consolidates with the merged row via `add()`'s existing
  dishName-keyed dedup — consistent with Decision 018/021, no separate row
  re-forms.

### Blocks / unblocks
- **Resolves** the scope carve-out flagged in Decision 021, item 3 /
  "Blocks / unblocks" (the "not-yet-filed cross-dish standalone-case
  decision").
- **Unblocks:** nothing yet buildable this session — `useShoppingStore.ts` is
  still the Phase 5 `notImplemented` stub (Decision 015); recorded for
  traceability ahead of that build, alongside Decision 021.
- **Depends on** the Phase 4 drag mechanism (Decision 011 R1) already existing
  in UnFocus — confirmed present, no new gesture infrastructure needed.
- **No new blocks** on in-flight phases.

---

## Numbering reconciliation (2026-07-02)

**Status:** Not a decision — a lookup note only. Consolidates the
numbering-collision and cross-reference notes already scattered across
Decisions 019, 020, 021, and 022 into one place. Append-only: no past entry
above is edited by this note.

**Canonical map, Decisions 016–022** (verified against this log):
- **016** — Habit reminders: multiple per day (ratifies shipped design,
  closes OB-1).
- **017** — WeekListCard's full-screen container role.
- **018** — Energy check-in removed; General/Essential are the only task
  modes, gated by Focus mode (closes OB-2).
- **019** — Task "next-time hint" note field.
- **020** — Task "then" link (one-to-one follower, surfacing-only). Drafted
  in flight as "018," then briefly "019," before landing at 020 — see its
  own numbering note.
- **021** — Re-adding an already-listed shopping item (increment parity +
  ephemeral feedback). Drafted in flight as "018" — see its own numbering
  note.
- **022** — Drag-to-merge a standalone item into a dish group. Resolves the
  cross-dish standalone-item case that Decision 021, item 3 explicitly
  carved out of scope.

**Decision 019's internal "Decision 018" references mean Decision 020.**
Decision 019's body (written concurrently with Decision 020's in-flight
renumbering) twice references "Decision 018 (connect-tasks/link feature)."
That number was never permanently claimed by the connect-tasks/link feature
in this log — it settled at Decision 020 after two collisions. Read every
"Decision 018" in Decision 019's body as "Decision 020." (Decision 019
already carries its own note to this effect; restated here for a single
lookup point.)

**The cross-dish standalone shopping-item case is filed — it is Decision
022, not unfiled.** Decision 021, item 3 explicitly carved this case out of
scope and, at the time it was written, could not point to a real entry for
it (the source planning conversation called it "Decision 019," a number
already claimed here by the unrelated task-hint-field decision). That gap is
closed: Decision 022 is the cross-dish case, filed and Resolved. Decision
021 already carries its own pointer update to this effect; this entry
restates it as part of the consolidated 016–022 map so it doesn't need to be
re-derived from three separate cross-reference notes.

## Decision 023 — Sharing: per-location explanation copy (OB-3 resolved)

**Status:** Resolved.
**Date:** 2026-07-03
**Context:** OB-3 (open backlog) asked for a short "what does sharing actually do"
explanation at each share location, deferred to the Phase 6 sharing-screens build
so copy could be drafted against the real UI.

**Share locations enumerated (the built UI):**
1. Shopping screen → `/share-modal?kind=s` — shares unchecked shopping items.
2. Plans + Home screens → `/share-modal?kind=t` — shares future undone tasks.
3. Post-share QR screen shows `shareInstructions`; `/shared` is the sent/received history.

**Decision:** Render a per-kind explanation line under the selection-card title in
`share-modal.tsx`, followed by a "one-time copy for now" caveat. The copy uses the
pre-existing bilingual i18n keys already seeded in `lib/i18n.ts`
(`shareExplainShopping` / `shareExplainTasks` / `shareExplainLaterBuild`, both EN + NO)
— they say what the user approved (pick items → QR → other person scans to copy into
their own UnFocus) and additionally flag that live phone-to-phone sync is a later build.
No new keys were added; the placement (in-modal, per kind) is the recommended option the
user approved. `sharedRequestExplain*` keys remain available for the incoming-share
surface (`SharedRequestsSection`) if that wants the same treatment later.

## Decision 024 — Functional colour families for habits / health / meals (no-token-equivalent palettes)

**Status:** Resolved
**Date:** 2026-07-03
**Depends on:** 006 (colour token layer), 014 (ExpandableCard accentColor → 4px bar only)
**Resolves:** the Decision 014 downstream to-do (health severity affordance) plus the two
sibling functional-colour gaps (habit build/break, meal-type tiles) surfaced when porting
the Phase 6 mid-complexity screens. All three legacy screens relied on `constants/theme.ts`
functional colours (`green`/`neutral`/`MealColors`) and raw-hex ramps that Decision 006's
token layer (`constants/colors.ts`) has no equivalent for. Three separate user calls:

### Q1 — Habit build/break colours: TOKEN MAP (option A).
- build → `good` (green), break → `featTask` (blue), in-progress (ratio>0<1) → `accent`,
  zero-progress/empty → `border`, rest-day solid dot → `textMuted`.
- Never red for break (preserved). Done-card soft fill: build → `goodSoft`, break →
  `surfaceMuted` (no `featTask`-soft token exists; the blue border/icon still carry the
  break identity). Fully Decision-006-compliant — no raw hex.

### Q2 — Health severity 1–5 ramp: KEEP THE FIXED PURPLE→BLUE RAMP (option A).
- `SEVERITY_COLORS = ['#C9D4F0','#A9B8E8','#8C9AE0','#7C82D6','#6E6BC8']` is retained as a
  **documented raw-hex functional data-viz exception** to Decision 006 (like a chart palette).
  It is deliberately theme-independent and NOT red/green (no alarm connotation) — no token
  ramp exists, and a semantic good/warn/bad collapse was rejected as reintroducing alarm.
- Paired inks are also fixed (`SEV_INK_DARK='#2A2A3A'` for severities 1–2, `SEV_INK_LIGHT=
  '#FFFFFF'` for 3–5) because the fill is theme-blind, so its text must be too.
- **Decision 014 affordance question — resolved by inspection, not a design call:** the old
  `health.tsx` never used `accentColor` for severity. It renders severity as a labelled,
  colour-filled `leadingAction` badge on each log's ExpandableCard (ExpandableCard's own
  header even documents `leadingAction` as "e.g. a severity badge"). That badge IS the
  explicit severity affordance, so the 4px-accent-bar reduction from Decision 014 never bit
  this screen. No `Badge` needed to be added; the labelled leading badge is kept as-is.

### Q3 — Meal-type tile colours: SINGLE `featMeal` ACCENT (option A).
- All five meal types (breakfast/lunch/dinner/snack/kveldsmat) use the single `featMeal`
  token; the per-type icon + label already distinguish them. The legacy 5-hue `MealColors`
  map is dropped. The "Surprise me" button uses the primary `accent` to stay visually
  distinct from the featMeal tiles. Fully Decision-006-compliant.

**Scope:** the three Phase 6 screens only (`app/habits.tsx`, `app/health.tsx`, `app/meals.tsx`).
`constants/theme.ts`'s legacy `green`/`neutral`/`MealColors`/`AppColors` stay in-repo (dead
for these screens) per the never-delete precedent; they are simply no longer referenced by
the ported screens.

**Supersedes:** the raw-hex `BREAK_BLUE`/`BREAK_BLUE_LIGHT` (habits) and `MealColors`
(meals) usages in the old sources. The health severity ramp is the one deliberate raw-hex
carry-over, documented above.

## Decision 025 — Budget over-budget bar & scan QR camera chrome (no-token-equivalent colour calls)

**Status: Resolved (user-confirmed, both recommended options).** Two functional-colour
calls in the Phase 6 `budget.tsx`/`scan.tsx` port had no clean Decision 006 token; same
class as Decision 024. Surfaced and confirmed with the user before building.

### Q1 — budget.tsx over-budget progress bar: MAP TO THE `warn` TOKEN.
The old bar used `FeatureColors.scan` (#D97512 burnt amber) under the documented "no-shame"
rule (never `bad`/red). Decision 006 has no burnt-amber token. Resolved: over-budget →
`warn`/`warnSoft` (#EAB308 amber-yellow) — on-palette, semantically "gentle caution", honours
the no-shame rule; on-track stays `good` (green). No raw-hex exception needed here (unlike
Decision 024 Q2's health ramp).

### Q2 — scan.tsx QR-scanner modal: FIXED DARK CAMERA CHROME.
The QR modal is a live camera viewfinder; Decision 006's light-first tokens don't fit it, and
`textInverse` flips dark in dark themes (invisible on black). Resolved: theme-independent fixed
chrome — `'#000'` background + fixed white (`#FFFFFF`) title/frame + translucent-white hint,
same spirit as the `shadowColor` literal exemption. The colored Cancel link stays on `accent`
(a coloured link reads fine on black across themes). Local constants `QR_BG`/`QR_FG`/`QR_HINT`
in `scan.tsx` document the exemption.

**Scope:** `app/budget.tsx` (over-budget bar) and `app/scan.tsx` (QR modal chrome) only.
Everything else in both screens maps cleanly to Decision 006 tokens (orange→accent,
green→good/greenLight→goodSoft, white→surface/accentInk, offWhite/grayLight→surfaceMuted/border,
textLight→textMuted, gray→textMuted).

## Decision 026 — (unused number — intentionally skipped)

**Status:** N/A — no such decision exists.
**Reason:** The ledger jumps 025 → 027; no work was ever recorded as Decision 026. This
placeholder exists so future sessions grepping `Decision 026` find an answer instead of assuming
a lost entry. Do **not** reuse 026; record new decisions at the next free number at the end of the file.

## Decision 027 — Expanded-permission native build: scope, module selection & distribution

**Status: Resolved (Session G, 2026-07-03).**
**Depends on:** the native build prerequisites in `REBUILD_PLAN.md` §1–§3.

### Purpose
One native build that installs every native module and declares every permission the
near-roadmap needs, so no planned feature forces a *later* rebuild. Guardrail: each
permission maps to a **named** planned feature — not speculative surface.

### Q1 — Permission set: PRUNE to the mapped features (user call).
The pre-027 `app.json` (from the earlier "add missing native plugins" config sweep) had
drifted broad. Under 027's "no speculative surface" test the set is narrowed to six areas,
each tied to a real feature:
- **Camera** — receipt scan (`app/scan.tsx`, OCR) → `expo-camera`.
- **Notifications** — task/habit/weekly/persistent reminders → `expo-notifications`
  (+ `expo-background-task`/`expo-task-manager` for scheduling/background refresh).
- **Photo library / media read** — receipt upload-from-gallery → `expo-image-picker`
  + `expo-media-library`.
- **Microphone** — voice notes → `expo-audio` (audio-capture module; see Q2).
- **Widgets** — shopping/notes/tasks home & lock-screen widgets → config-plugin
  scaffolding now (see Q3).
- **Rich / lock-screen notification presentation** — Notification Service Extension
  scaffolding now (see Q3).

**Pruned** (module + permission + usage string all removed): `expo-location`
(location reminders), `expo-calendar` (calendar sync), `expo-contacts` (share-to-contacts),
`expo-sensors` (step counting). None are on the near-roadmap; re-adding any is a fresh
native build. `FOREGROUND_SERVICE_LOCATION` and `UIBackgroundModes: location` went with
`expo-location`; generic `FOREGROUND_SERVICE` is kept for persistent notifications.

### Q2 — Microphone module: `expo-audio`, and prune `expo-speech-recognition` (Session G call).
Decision 027's microphone feature is *voice notes* = audio capture. `expo-audio` is the
current Expo-recommended capture module (the `expo-av` audio APIs are deprecated), so it is
selected and retained. `expo-speech-recognition` (speech-to-text) is a **distinct** capability
not enumerated in 027 and not on the near-roadmap; under Q1's prune directive it is removed
(module + `NSSpeechRecognitionUsageDescription`). Flagged here rather than silently kept:
if on-device transcription of voice notes is wanted later, re-add it — that is a new build.

### Q3 — Widgets & rich notifications: ship config-plugin scaffolding now (user call).
No first-party Expo widget module exists. Selected, and packages added now:
- **Android widgets** → `react-native-android-widget` (AppWidget/Glance config plugin).
- **iOS widgets + Notification Service Extension** → `@bacons/apple-targets` (WidgetKit
  target + NSE target).
- **App Group** `group.com.freyrnorpixel.unfocus` declared in `ios.entitlements` so the app
  and its widgets/extension can share data.
Scope boundary (stated to prevent overclaim): this build **installs modules + declares
entitlements only**. It does NOT implement widget layouts, voice-note recording, or rich
notification content — each is a later phase with its own design decisions (contents,
refresh cadence, tap targets). Android big-picture styling and `lockscreenVisibility` are
JS-side (OTA-able), no native change.

### Q4 — Distribution: EAS internal/preview only (option A, user-resolved).
Build with the full permission/module set now, distribute via **EAS internal/preview**.
User tests before any store submission. Promote to store only once each permissioned feature
has at least minimal working code — avoids store-review queries about permissions with no
visible feature. `eas.json` already encodes this (`preview` → `distribution: internal`;
`production` → `store`, used only later).

### Version / runtime handling (flagged, not done here)
This is a native change, so per AGENTS.md a new APK/AAB is required and `runtimeVersion`
must eventually match `version`. `runtimeVersion` is **left at `1.0.0`** in this commit on
purpose: bumping it before the APK actually ships would silently strand current 1.0.0
installs on the `preview` OTA channel. Bump `runtimeVersion` → `1.1.0` (to match `version`)
**at build time**, when the APK is produced.

### Package-resolution caveat
Version pins for `@bacons/apple-targets` and `react-native-android-widget` are best-effort;
they were not `npm install`-resolved in the remote session. Confirm SDK 56 / RN 0.85
compatible versions with `npx expo install` before the first prebuild.

## Decision 029b — Merged task+habit notification toggle (ratify existing code)

**Status:** Resolved
**Date:** 2026-07-03
**Numbering note (2026-07-04 repair):** retitled from "Decision 029" to **029b**. Two
independent entries both claimed 029; the code-referenced entry (catalog-lock persistence,
cited in `app/shopping.tsx`) keeps the bare number 029, and this merged-toggle ratification
takes the `b` suffix. Code/prompt references to "Decision 029" that mean the notification
toggle (`app/settings.tsx`) are updated to 029b. The bare number 028 was separately burned by
three parallel `claude/*` commits with no ledger heading (Norwegian-date `f9d69c9`, share-modal
`44ecd22`, an early toggle draft) — that history now lives in Decision 028's own numbering note.
See the numbering-conventions note near the top of this ledger.
**Phase placement:** Phase 6 settings screen (app/settings.tsx). Ratifies behavior already present in the settings.tsx stub; no new code path introduced.
**Origin:** Decision 016's flagged "Adjacent finding" (keep task+habit notifications merged into one toggle, or split them?) — left open through the habit-notification and Home-screen phases. The merge exists implicitly in the settings.tsx stub (one Switch writing taskNotificationsEnabled AND habitNotificationsEnabled together) but was never recorded as a resolved decision. This entry closes that gap per the "no implicit-in-code decisions" rule.

### Decision
KEEP MERGED. A single "Plan notifications" toggle drives both `taskNotificationsEnabled` and `habitNotificationsEnabled` together. No separate habit toggle. `taskNotificationsEnabled` is the display/read value for the control.

### Rationale
Matches the old app's single-toggle model; task and habit reminders are one user-facing concept ("remind me about my plan"). Splitting would add a control users didn't have before and isn't requested by any FEATURE_INVENTORY edit note.

### Consequence / ripple
- settings.tsx writes both flags from one `onValueChange`; `applyAndSync()` re-syncs both task and habit notifications on that change.
- The quiet-hours hint copy (Decision 016 Q4) is a separate settings-copy item, resolved there, not here.

### Blocks / unblocks
- **Unblocks:** Session C (settings screen build) — the merged-vs-split question is now closed and can be applied, not re-decided.
- No new blocks.

---

## Decision 020a — Addendum to Decision 020: sub-questions (a)/(b)/(c) resolved; (b) inverts the recorded leaning

**Status:** Resolved (supersedes the three open sub-questions in Decision 020)
**Date:** 2026-07-03
**Phase:** Recorded in Phase 5 (task-store build) and Phase 6 (day-view build); logged here to correct Decision 020's stale leaning text per the append-only rule (020 itself is never edited in place).

The three sub-questions left open under Decision 020 ("Open sub-questions for the build session") were answered during the Phase 5 `useTaskStore` build and are now also built into `PlanTaskCard.tsx`. Recording them here so a cold read of Decision 020 doesn't act on its superseded leaning.

**(a) Recurrence persistence — RESOLVED: link persists across recurrence instances, no extra code.**
`follows_task_id` lives on the task-definition row, the same single row a recurring task reuses for every generated occurrence (this schema never materializes per-occurrence rows). The link persists by construction. Matches Decision 020's own leaning.

**(b) Cross-date surfacing — RESOLVED: "pull the follower into today's view." THIS INVERTS Decision 020's recorded leaning ("highlight in place, no date-move").**
This is a deliberate, user-chosen inversion, logged as such. When a predecessor is done, a pending follower on a different date is pulled into the current day-view (not merely highlighted on its own date). `PlanTaskCard.tsx` takes the full store list (`allTasks`) so cross-date followers resolve. No notification, no rescheduling of the follower's own date/time — it is a view-surfacing behavior only. Build toward this, not the 020 leaning.

**(c) Cycle guard — RESOLVED: walk the chain live, exclude looping candidates from the picker.**
Implemented as `useTaskStore.followerCycleChain(id)` (walks `followsTaskId` backward from `id`, self included). `task-form.tsx`'s follower picker excludes every id in that chain, so an A→B→…→A cycle can never be selected — prevented at pick time, not caught on save.

**Build status:** all three are already implemented (`useTaskStore.ts`, `task-form.tsx`, `components/PlanTaskCard.tsx`, logged 2026-07-02). This entry is documentation reconciliation only — no code change.

### Blocks / unblocks
- **Unblocks:** cold reads of Decision 020 — its three open sub-questions are now closed and must not be re-decided from the stale leaning text.
- No new blocks.

---

## Decision 030b — Cross-section drag-to-merge hit-testing model + dish-join semantics

**Status:** Resolved
**Date:** 2026-07-03
**Numbering note (2026-07-04 repair):** retitled from "Decision 030" to **030b**. 030 was
claimed by two entries; the code-referenced one (Hints per-need, cited in `components/HintCard.tsx`
and `components/WeekListCard.tsx` headers) keeps the bare number 030, and this hit-testing entry
takes the `b` suffix. No code header cites "Decision 030" for hit-testing (the drag surface cites
Decision 022), so no source edits are needed. See the numbering-conventions note near the top.
**Phase:** Phase 6 (shopping-row drag redesign — the A2·1 surface that was STOPPED
2026-07-01) + wires Decision 022's `mergeItems`.
**Origin:** The STOP-and-ask gate on the drag-merge session. Decision 022 filed the
drag-to-merge product behavior but deferred the hit-testing *design commitment* (how a
drop target is detected across sections, merge-vs-reorder disambiguation, valid-target
affordance) to the build session. Those questions were surfaced as numbered options and
answered by the planning layer; recorded here so a later session doesn't re-decide them.

### Context / the real problem
The Decision 011 R1 drag surface only measured the ungrouped-unchecked "Shopping list"
section, and did so in a *parent-relative* coordinate space. Dish-group ingredient rows
render inside separate `ExpandableCard`s under a different parent, so their coordinates
were never comparable to the dragged row's — dish rows were not drop targets at all. That
gap is exactly why A2·1 stopped.

### Decisions (answers to the three surfaced questions)
1. **Hit-testing model — window coordinates, dish-GROUP granularity.** All drop targets
   are measured with `measureInWindow` at drag-start into one shared window space (the only
   frame where the ungrouped section and the dish cards are comparable). The dragged row
   measures itself (inside `DraggableTaskRow`, which now reports live *window* centerY);
   the screen measures sibling reorder rows + each dish-group *card* (not each ingredient
   row). A drop is tested against dish-group bands, not individual ingredient rows — coarser
   but robust, and it needs no per-ingredient measurement plumbing.
2. **No same-name match on a dish drop → JOIN the dish instance (NOT snap-back, NOT
   reorder).** This *extends* Decision 022 item 1 (which said different-name → reorder
   fallback — that fallback applies only to the in-section row-on-row case). The planning
   layer decided that dropping a standalone item onto a dish group always makes it part of
   **that instance** of the dish: if a same-name ingredient already exists there, merge
   (`mergeItems` — sum amounts, adopt `dishName`, drop the standalone row); otherwise the
   item simply adopts the dish's `dishName` (`update`) and rides along with that instance.
   **It never edits the dish's base recipe** — adding/removing a dish's canonical
   ingredients is done elsewhere in shopping, not live via drag. Consequence: same as
   Decision 022's "joins the dish" note — once joined, the item is indistinguishable from an
   original dish ingredient (no provenance flag) and rides along for 011a roll-down, dish
   removal, and monthly reset.
3. **Valid-target affordance — highlight the target dish group during drag.** While the
   dragged row is over a dish group, that group's card tints (`theme.goodSoft` + `good`
   border) so the user sees the drop will land there before releasing. Ephemeral, no schema
   (same spirit as Decision 021's transient highlight).

### Deferred (flagged, not silently dropped)
- **Decision 022 item 3's ephemeral *undo* affordance (toast/snackbar with undo)** is NOT
  built. `ConfirmationBanner` is message-only (no action button); a real undo would need
  capturing pre-merge state + a restore path + extending the shared banner. For now a
  transient `ConfirmationBanner` *confirms* the merge/join (`mergedIntoDish` / `movedToDish`).
  The undo button remains a Phase-6 presentational follow-up — consistent with Decision 021's
  highlight also being deferred.

### Blocks / unblocks
- **Resolves** the A2·1 STOP gate (2026-07-01) and the "drag-to-merge UI wiring NOT done"
  flag from the Phase-5 shopping-store entry (2026-07-02).
- **Reuses**, does not fork, the Decision 011 R1 drag mechanism (`DraggableTaskRow` +
  screen-owned hit-testing) — the coordinate model moved from parent-relative to window,
  which also makes the existing reorder hit-test more correct as a side effect.
- No new schema (`mergeItems`/`update` already exist); no new blocks.

## Decision 028 — Padlock scope: lock gates add/remove/edit only; reorder, checkbox, and qty stepper always stay live

**Status:** Resolved
**Date:** 2026-07-03
**Depends on:** 011 (padlock-gated Containers), 011a (dish-group bulk check), 021 (stepper increment semantics)
**Numbering note (2026-07-04 repair):** this padlock-scope entry is the canonical **028**
(cited in `components/ShoppingRow.tsx` and `components/WeekListCard.tsx` headers). The number was
independently claimed on `main` by three parallel `claude/*` commits that wrote no ledger entry —
the Norwegian-date-display change (`f9d69c9`), a share-modal date-routing change (`44ecd22`), and
an early draft of the task+habit toggle (now Decision 029b). The Norwegian-date work is **code-only,
no ledger number**: its `lib/date.ts` / `app/share-modal.tsx` headers and its `PROGRESS_LOG.md`
heading are updated to say so, and no longer cite "Decision 028." The prior standalone void-marker
heading for 028 is removed in favour of this note.

### Context
WeekListCards and the Monthly catalog are padlock-gated (Decision 011). The lock's intent
is to prevent *accidental structural changes to the list* — not to freeze the list against
use during a shopping trip. The as-built `ShoppingRow` gated three things on `locked`:
remove, move-up/move-down, AND the qty stepper (all dimmed to 0.45 / 0.55). Reviewed against
the user's stated intent — "the lock is just for not being able to remove or add items; still
able to move between and press checkbox" — two of those three are wrong.

### Decision
The padlock gates **exactly three** actions, and no others:
1. **Add** a new item (AddDivider / inline "+").
2. **Remove** an item (swipe-left commit + the "×" / InventoryIcon remove affordance).
3. **Edit** item fields via UpdateSheet (rename / price / target qty / temporary flag).

Everything that acts on an item *already on the list* stays fully interactive regardless of
lock state:
- Checkbox / collect / undo. *(already correct)*
- **Within-list reorder** (move-up/move-down / drag). **← inverted from as-built.**
- **Qty stepper (−/+).** **← inverted from as-built.**

### Rationale for the stepper (the "most intuitive" call)
The stepper is bounded 1–99 and cannot create or delete a row (deletion is the dedicated
"×"; the stepper floors at 1). Adjusting a quantity is therefore neither an add nor a
remove — it is the same category as ticking the checkbox: acting on an item already present.
A lock that blocked quantity changes would surprise a user who locked the list only to guard
against deletion (e.g. couldn't bump milk 1→2). Stepper stays live.

### Explicit inversions recorded (code / edit-notes lose to this decision)
- `components/ShoppingRow.tsx` edit note *"`locked` dims and disables remove/move-up/
  move-down at opacity 0.45"* → **`locked` dims/disables the remove affordance ONLY.**
  Reorder controls and the stepper ignore `locked` entirely.
- `components/WeekListCard.tsx` edit note *"dims remove/move/stepper"* → **"dims remove only."**
- `app/shopping.tsx` edit note *"locked already disables the stepper inside ShoppingRow
  itself, so no extra gating is needed here"* → **premise retired; the stepper is never
  lock-gated.**

### Consequence for the drag session
The Phase 6 shopping-row drag work (Decision 011 R1) must NOT pass a lock-derived `disabled`
into the `DraggableTaskRow` wrapper. Reorder persistence runs irrespective of `list.locked`.

### As-built note (this session)
`components/ShoppingRow.tsx` only ever gated the swipe-remove gesture (`.enabled(!locked)`)
and the stepper (`showStepper` read `!locked`); the inline move-chevrons had already been
retired (Ripple R1), so there was no reorder control on the row to un-gate. The fix removed
`!locked` from `showStepper`; the swipe-remove gate is kept. `app/shopping.tsx` already
passed no lock-derived `disabled` to `DraggableTaskRow`, so no change was needed there.

---

## Decision 029 — Catalog lock persists across in-session navigation; re-locks only on fresh app launch

**Status:** Resolved
**Date:** 2026-07-03
**Depends on:** 011, 028
**Numbering note (2026-07-04 repair):** canonical **029** — code-referenced in `app/shopping.tsx`.
The merged task+habit notification toggle that also claimed 029 was re-suffixed to Decision 029b.

### Context
As-built, the Monthly catalog's lock is `catalogLocked` — non-persisted local component
state — so it resets to locked on *every* screen focus. A user who unlocks the catalog,
navigates to Home, and returns finds it re-locked, forcing repeated unlocks within a single
editing pass.

### Decision
The catalog lock resets to locked **only on a fresh app launch (cold start)**, not on
in-session screen focus. Unlock state survives navigating away and back within the same app
session.

### Implementation note (mechanism is the coding session's call; behavior is the contract)
Lock state must outlive the shopping screen's mount but NOT the process — e.g. module-level
or store state rather than `useState`, and specifically **not** a SQLite/persistence column
(persisting to the DB would wrongly survive app restarts, which contradicts "re-lock on
launch"). Observable contract: **survives navigation, resets on cold start.**

### As-built note (this session)
Implemented via a module-level `catalogLockedSession` flag in `app/shopping.tsx`: the
`catalogLocked` state seeds from it and a wrapping setter mirrors every change back to it.
A fresh module evaluation on cold start re-seeds it to `true`. No DB column added.

### Not changed
Week-list locks remain per-row persistent in `shopping_lists.locked` — a durable per-list
property, distinct from the catalog's session-scoped convenience lock. This decision is
catalog-only.

---

## Decision 030 — Hints: placement is per-need, not blanket; intuitiveness is the primary target

**Status:** Resolved
**Date:** 2026-07-03
**Numbering note (2026-07-04 repair):** canonical **030** — code-referenced in `components/HintCard.tsx`
and `components/WeekListCard.tsx`. The cross-section drag-to-merge hit-testing entry that also claimed
030 was re-suffixed to Decision 030b.
**Closes:** the open thread under Decision 010 (HintCard reach).
**Supersedes:** the "every scrollable screen should have a HintCard" guidance (was slated for
`SCREEN_UPDATE_TEMPLATE.md`, which does not exist in this repo — see as-built note).

### Context
Decision 010 was left open on how far `HintCard` should reach. User direction: hints go only
where genuinely needed, and the real goal is a UI that is intuitive without them.

### Decision
`HintCard` is **not** mounted blanket-per-screen. It is added only where a screen has a
genuinely non-obvious interaction that cannot reasonably be made self-evident by the UI
itself. The primary design target is intuitiveness; a needed hint is also a signal to first
check whether the underlying interaction can be simplified. The `showHints` global toggle
behavior is unchanged (hints, where present, still hide when off).

### Closes Decision 010
HintCard reach is "by demonstrated need," not a fixed screen list.

### Screens to re-evaluate against this rule during their Phase 6 build
Candidates where a current/planned mount may not meet the "genuinely needed" bar: **shopping**
(mount removed — see below), **scan**, **notes** (the old app's two other hint sites). Each
keeps its hint only if the flow can't be made self-evident.

### Shopping hint — specific call
The shopping screen's non-obvious bits (the mark-then-confirm catalog→weekly flow) are
intended to be taught by the weekly empty-state copy *"Nothing on the list yet / Mark items
in the catalog to add them here."* Under this decision the standalone `HintCard` on shopping
is **removed**; the flow relies on the empty-state copy. If a gap remains, that is evidence
the flow needs simplifying, not a hint re-added.

### As-built note (this session)
- Removed the `HintCard` mount + import from `app/shopping.tsx`; updated its header and
  `HintCard.tsx`'s `Used by →` (now "no current mounts"). The `t.hints.shopping` i18n keys
  are left in place (harmless, no longer referenced).
- **Flagged, not fixed:** `SCREEN_UPDATE_TEMPLATE.md` does not exist in this repo, so its
  blanket instruction could not be softened — this decision is the superseding record instead.
- **Empty-state wired (this session):** the `weeklyEmptyTitle` / `weeklyEmptySubtitle` strings
  this decision relies on to teach the flow were defined in `lib/i18n.ts` but not rendered
  anywhere. `components/WeekListCard.tsx` now renders them whenever a list has no items
  (`listProgress().total === 0`), so the catalog→weekly mark-then-confirm teaching is visible
  on screen — exactly the empty-state (not a re-added HintCard) this decision calls for.

---

## Decision 031 — Onboarding finish() schedules reminders (close the step6 gap)

**Status:** Resolved
**Date:** 2026-07-03
**Resolves:** the step6.finish() FLAG from the 2026-07-03 onboarding verification —
finish() set `setupComplete` + requested OS permission but never scheduled anything,
even though the scheduling modules now exist. User call: **fix** (schedule), not
ratify permission-only.

**Context:** `step4` turns `remindersEnabled` + `taskNotificationsEnabled` ON and
`step6` requests OS notification permission. When onboarding was first ported the
scheduling modules didn't exist, so finish() correctly omitted them. They exist now:
`lib/reminders.ts` (`syncReminders`), `lib/taskNotifications.ts`, and
`useTaskStore.syncAllTaskNotifications()` — ported by the later notifications session.
finish() calling only `requestPermissions()` was therefore a **silent behavioral gap**:
a user completing onboarding got no scheduled weekly/monthly reminders or per-task
notifications until some later re-sync.

**Decision:** `step6.finish()` schedules on completion, mirroring the old app exactly:
```
requestPermissions().finally(() => {
  syncReminders();
  useTaskStore.getState().syncAllTaskNotifications();
});
```
Permission is requested first; scheduling runs once it resolves (granted or not — the
schedulers no-op safely without permission, and the reminders become active if the
user later grants it). `router.replace('/')` still fires immediately; scheduling is
fire-and-forget.

**Also:** step6's stale header note ("Neither exists in this repo yet … left out") is
corrected to describe the wired behaviour.

**Not in scope (flagged, separate):** `app/_layout.tsx` startup does not call
`syncReminders()` / `syncAllTaskNotifications()` either — so reminders are re-armed at
onboarding finish and after settings changes (settings.tsx already calls them), but not
on every cold start. Whether cold-start needs its own re-sync (e.g. after an OS reboot
clears scheduled notifications) is a separate `_layout` bootstrap decision, not opened
here.

---

## Decision 032 — SiteSwipeView wired via ScreenScaffold (close the deferral)

**Status:** Resolved
**Date:** 2026-07-03
**Resolves:** the long-standing "SiteSwipeView deferral, unrecorded" flag (raised by the
onboarding port and re-confirmed by the 2026-07-03 verification). User call: **fix** —
wire swipe-between-sites navigation.

**Context:** `components/SiteSwipeView.tsx` (horizontal swipe → neighbouring nav site)
was ported but mounted nowhere. The onboarding session deferred it as a cross-cutting
change and recommended per-screen wraps across the 5 nav sites, excluding scan's camera
overlay. All 5 nav sites (home/shopping/plans/health/scan) already route through
`components/ScreenScaffold` at `tier="site"`.

**Decision:** Wire it at **ScreenScaffold**, not per-screen. For `tier === 'site'`, the
scaffold wraps its L3 scroll content in `<SiteSwipeView>`. One wire point covers all
five sites; the pan gesture yields to vertical scrolling via SiteSwipeView's existing
`activeOffsetX`/`failOffsetY` thresholds (unchanged, still shared with ShoppingRow's
swipe-to-remove).

**Camera-overlay contract honoured structurally, not by opt-out:** SiteSwipeView must
not wrap full-screen camera overlays. scan's camera (`'scanning'` mode) is a bare
`SafeAreaView` rendered *outside* ScreenScaffold, so it is already excluded — scan's
scrollable idle/result/manual modes swipe safely and need no opt-out. A `swipeNav?:
boolean` prop (default true) is added to ScreenScaffold as a documented escape hatch for
any *future* site screen that renders a full-screen camera/QR/media overlay inside the
scaffold body; no current screen sets it.

**Scope:** `components/ScreenScaffold.tsx` (wrap + prop), header updates in
`ScreenScaffold`/`SiteSwipeView`. No change to SiteSwipeView's gesture logic, siteNav,
or the individual screens. OTA-safe (react-native-gesture-handler already a dependency).

---

> **Numbering note for Decisions 033–035 (2026-07-04):** the build-feedback handoff drafted
> these three as "031/032/033," but 031 and 032 were already taken on this branch
> (onboarding-reminders / SiteSwipeView, above). Per the numbering-conventions rule, the
> already-claimed numbers stand and these new entries take the next free bare numbers —
> **033 = screen transitions, 034 = header title, 035 = dark-mode default.** Anywhere the
> handoff prose says 031/032/033 for these three, read 033/034/035.

## Decision 033 — Screen transitions: platform-native stack animations

**Status:** Resolved (user call, 2026-07-04)
**Context:** The rebuilt app navigates with no native-feeling transition between screens
(build-feedback item 2). No prior decision covered navigation animation; expo-router's
Stack was left at whatever the scaffold defaulted to.

### Decision
Use **platform-default native stack transitions** via expo-router `<Stack>` `screenOptions`
in `app/_layout.tsx`: standard Android slide/fade and iOS horizontal push — `animation:
'default'` with the `react-native-screens` native stack. No custom per-tier animation design.
Sheets/modals that already mount with `presentation: 'modal'` + `slide_from_bottom` are
unaffected.

### Constraints
- OS-level reduce-motion is honoured by the native stack automatically; the in-app
  `reducedMotion` setting does NOT gate stack transitions (it governs in-app Reanimated
  animations only, per ANIMATION_GUIDELINES §7).
- `SiteSwipeView` (site-to-site swipe, Decision 032) is separate — this covers push/pop only.

### As-built note (2026-07-04)
Added `animation: 'default'` to the `<Stack screenOptions>` in `app/_layout.tsx`. The
per-screen modal overrides (`capture`, `task-form`, `habit-form`, `share-modal`) keep their
explicit `slide_from_bottom` and are unchanged.

---

## Decision 034 — Header title upper-left (amends Decision 001 chrome layout)

**Status:** Resolved (user call, 2026-07-04)
**Amends:** Decision 001, which specified "page title centered" in the top block. The build
was faithful to 001; the record changes, not the build's compliance history.

### Decision
The screen title is **left-aligned in the top block** on both tiers:
- **Site tier:** title upper-left; Settings (gear) and the Focus toggle both move to the
  **right** corner (order: Focus, then gear outermost).
- **Sub tier:** back link (iOS-only, per 001) leftmost, title immediately right of it,
  left-aligned; the screen-specific right-action slot is unchanged. On Android (no back link)
  the title sits flush upper-left.

### Handedness reconciliation (user call, 2026-07-04)
Decision 034 as drafted said nothing about handedness, but the header gear is
**handedness-aware** (the `leftHanded` setting, wired in `ScreenHeader.tsx`). Reconciliation:
**mirror the whole site-tier layout by handedness.** Right-handed (default) is exactly the
decision above — title upper-left, controls upper-right. Left-handed mirrors it — controls
upper-**left** (kept reachable), title upper-**right**. This preserves the handedness feature
rather than neutering it; the only deviation from the literal "title upper-left" is that a
left-handed user sees the title upper-right, which is the intended trade for reachability.
Sub-tier is not mirrored (the iOS back link stays leftmost by platform convention).

### Ripple
`components/ScreenHeader.tsx` layout only. Decision 001's remaining chrome contract
(translucent material blocks, tier rules, BottomNav) is untouched.

---

## Decision 035 — Dark mode defaults to OFF (light); 'system' is opt-in

**Status:** Resolved (user call, 2026-07-04)
**Context:** As-built default `darkMode: 'system'` was never a recorded decision. On devices
with system dark mode, first launch opened dark (build-feedback item 6).

### Decision
The **fresh-install default is `darkMode: 'off'`** (light). `'system'` and `'on'` remain
selectable in Settings (existing three-way segmented control, unchanged).

### Migration rule
Only the default changes. An existing install with a **stored** darkMode value keeps it — do
not overwrite user-set values; the new default applies solely when no value exists in the
settings row.

### As-built note (2026-07-04)
Changed `defaultSettings.darkMode` in `store/useSettingsStore.ts` from `'system'` to `'off'`.
The `load()` mapping already reads a stored value with an `'off'` fallback (`readStr(row,
'dark_mode', 'off')`), so stored user choices are preserved — the new default applies only to
a fresh install with no settings row yet.
