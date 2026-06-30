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
