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
**Status:** Open. No Decision entry. Phase 4 offered this as a question (draft
copy now vs. defer to Phase 6 vs. user supplies wording); user chose to defer
to Phase 6 (the sharing screens' own build session drafts copy in context of
the real UI, rather than banking a guess now).
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
