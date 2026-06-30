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
