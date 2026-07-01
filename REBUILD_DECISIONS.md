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
  chevron props. **Open question for the coding session:** confirm a drag-reorder
  primitive exists / is acceptable (DraggableTaskRow.tsx exists in the repo and may
  be the pattern to reuse) — VERIFY before building; do not silently keep chevrons.
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
- **No new blocks** introduced. R1's drag-reorder verification is a within-session
  check, not a separate planning blocker.

### Packaging — split into two Claude Code sessions
- **Session A2·1 — ShoppingRow redesign** (A2-2 + ripples R1, R2, R3). Self-
  contained component work: two-line layout, swipe-remove with catalog/ad-hoc
  branch, drag reorder, CHECKED_OPACITY preserved.
- **Session A2·2 — Shopping screen re-layout** (A2-1 + A2-4). Sticky compact
  header, scrolling body order, hint inline, shared-requests, collapsed history,
  reset-in-overflow.
- Order: A2·1 (row) before A2·2 (screen), so the screen re-layout composes the
  finished row.

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
**Source:** FEATURE_INVENTORY.docx edit note — "Add the option for several
reminders a day... Today only ONE fixed time is possible."
**Status:** Open. Explicit feature request, no Decision entry.
**Nature:** Real feature addition (old app supports one fixed reminder time
per habit; request is N reminders/day). Needs a decision thread covering data
model (array of times vs. recurrence rule), UI for adding/removing times, and
notification scheduling implications before it can be ported/built.

### OB-2 — Energy check-in: medium vs. high parity
**Source:** FEATURE_INVENTORY.docx edit note — old app has "no difference
between medium and high" energy levels.
**Status:** Open, DEFERRED (not resolved). Decision 009 removed the Energy
check-in from Home but explicitly deferred this ambiguity rather than fixing
it. Correctly tracked as deferred, flagged here so "deferred" doesn't quietly
become "forgotten."
**Nature:** Behaviour decision — either medium and high should drive different
task filtering/surfacing, or they should collapse to fewer levels. Needs a
call on what the levels actually DO before Energy resurfaces anywhere.

### OB-3 — Sharing: per-location explanation copy
**Source:** FEATURE_INVENTORY.docx edit note — asks for a short explanation of
"what it actually does" at each share location. Wording TBD.
**Status:** Open. No Decision entry.
**Nature:** Copy/wording decision (not behaviour). Needs the actual short
explanatory string for each place sharing is offered. Cheap to close once the
share locations are enumerated.

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
