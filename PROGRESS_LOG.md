# Progress Log

Per-session summaries, newest at the bottom. Each entry: date, phase, what
was ported/built, any new decisions added to REBUILD_DECISIONS.md, anything
left unresolved.

## 2026-06-30 — Phase 1: Foundation & Universal Screen Scaffold
Ported Decision 001 implementation to UnFocus:

**Foundation files ported:**
- constants/colors.ts, constants/theme.ts
- lib/useAppTheme.ts, lib/i18n.ts, lib/haptics.ts, lib/siteNav.ts, lib/dataAccess.ts, lib/db.ts
- store/useSettingsStore.ts
- components/Surface.tsx, components/PressableScale.tsx
- Background layers: ScreenBackground.tsx, HomeHeroBackground.tsx, ParticleBackground.tsx, TreeWatermark.tsx
- assets/bg-light.png, assets/bg-dark.png, assets/android-icon-monochrome.png

**Components upgraded (Decision 001):**
- ScreenHeader.tsx: tier-aware rendering (site vs sub), wrapped in translucent Surface,
  Settings (gear) left + Focus-mode (eye-outline) right for tier='site',
  back link (iOS only) left for tier='sub'
- BottomNav.tsx: wrapped in translucent Surface, no logic changes

**New components:**
- ScreenScaffold.tsx: universal layout wrapper composing all layers (background → particles →
  content → top block + optional bottom block), tier-aware chrome rendering
- app/_scaffold-demo.tsx: temporary demo screen proving scaffold works (site and sub tiers)

**App bootstrap:**
- app/_layout.tsx: minimal setup (fonts, router stack)
- app/index.tsx: Phase 1 placeholder with link to demo

**Flags for user confirmation/resolution:**
- Focus-mode icon: chose 'eye-outline' (confirm or suggest alternative)
- Focus-mode onPress: placeholder no-op, flagged for phase 2 (toggle state needed)
- app/_scaffold-demo.tsx: marked for deletion after visual review in next session

No new decisions added to REBUILD_DECISIONS.md. All work implements Decision 001 as specified.
Next phase: port remaining primitives (Button, Badge, IconButton, ProgressBar, etc.).

## 2026-06-30 — Planning files ported to UnFocus
Ported all planning and design system documentation from All-the-small-things
to UnFocus rebuild repo:
- REBUILD_DECISIONS.md, REBUILD_PLAN.md (project roadmap)
- AGENTS.md, CLAUDE.md (workflow and hygiene guidelines)
- ANIMATION_GUIDELINES.md (animation/haptics standards)
- Design system libraries: BUTTON, CARD_CONTAINER, COLOR_THEME, FORM_PATTERNS,
  ICON, SHADOW_ELEVATION, SPACING_LAYOUT, TYPOGRAPHY, DESIGN_SYSTEM_IMPLEMENTATION,
  DESIGN_SYSTEM_LIBRARY_INDEX
- FEATURE_INVENTORY.docx (product spec with edit notes)

This establishes the spec and architecture for the rebuilt UnFocus app.
No app code yet; next phase will port foundation components (Decision 001).

## 2026-06-30 — Phase 0: Planning files
Created REBUILD_DECISIONS.md (seeded with Decision 001), PROGRESS_LOG.md,
and REBUILD_PLAN.md. No code touched. Next session: Phase 1, foundation /
universal screen scaffold.
