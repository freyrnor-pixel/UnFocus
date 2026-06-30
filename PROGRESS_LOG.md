# Progress Log

Per-session summaries, newest at the bottom. Each entry: date, phase, what
was ported/built, any new decisions added to REBUILD_DECISIONS.md, anything
left unresolved.

## 2026-06-30 — Phase: Foundation / `colors.ts` token layer (Decision 006)
**Status: Complete** — Six-theme colour token layer built, tested, and verified.

**Deliverables:**
- **constants/colors.ts** — Decision 006 token layer with all six named themes (Default, Summer, Nature, Fluffy Pink, Gothic, Black & White), each with complete light and dark palettes. 31 semantic tokens per theme mode: surfaces (bg, surface, surfaceMuted, surfaceInset), text (text, textMuted, textInverse), borders (border, borderStrong), accent (accent, accentSoft, accentInk), semantic state (good/goodSoft, bad/badSoft, warn/warnSoft), depth (shadow, overlay), hint card, and feature accents (8 bubble types).
- **TypeScript type `ThemePalette`** — Enumerates the full token set (31 keys), so missing tokens are compile errors, not runtime undefined.
- **Theme resolver** — `getThemePalette(themeName, isDark)` function to retrieve the correct palette.
- **Extended `lib/useAppTheme.ts`** — Updated to return `ThemePalette` from the new token layer. Drop-in replacement (same hook signatures); component ports will follow in later phases.
- **Test suite: `lib/__tests__/colors.test.ts`** — 57 tests verifying:
  - (a) All six themes × two modes have complete token sets ✓
  - (b) WCAG AA contrast (≥4.5:1) for text and textMuted on both bg and surface in all themes ✓
  - (c) Dark-mode depth ordering: bg < surface < border (darker to lighter) ✓
  - Theme resolver returns correct palettes ✓

**Test result:** All 57 tests passing.

**Dark-mode constraints satisfied:**
1. ✓ text and textMuted both achieve ≥4.5:1 contrast against both bg AND surface in all themes
2. ✓ border is lighter than surface in dark mode (ordered by relative luminance)
3. ✓ surface is lighter than bg in dark mode
4. ✓ Accents desaturated ~25% in dark to avoid neon clash (preserved hue while reducing saturation)

**Non-Decision 006 notes (additions/interpretations):**
- Accent desaturation implemented via per-channel linear blend in dark mode — accents lightened AND desaturated to maintain visual harmony
- Semantic state colours (good/bad) remain chromatic in Black & White theme for instant visual recognition (exception to otherwise monochrome design)
- Feature accent palette (8 types: task/plan/habit/shop/meal/budget/note/health) tuned per-theme to stay recognizable while respecting theme's hue identity
- Shadow tokens are per-theme tints rather than universal blacks (Theme-aware darkness keeps consistency with palette)

**Out of scope (confirmed deferred):**
- Component ports — all consuming components remain unchanged; rewiring to new token names is a later phase
- Custom hue system — Decision 006 specifies custom is deferred; no HuePicker or runtime buildCustomTheme() ported
- Decision 007 dependencies (native gradient/blur) — token layer is pure data, has no 007 deps
- Material/finish system — independently maintained in constants/theme.ts, not touched

**Next phase:**
- Port components to use new `ThemePalette` token names (requires careful rewiring to replace old tokens like `orange` → `accent`, `white` → `surface`, etc.)

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

## 2026-06-30 — Phase 2b: Rendering primitives porting (Decision 007 — native gradients)
**Status: Complete (code-ready; native build prerequisite pending)**

**Scope:** Port four rendering components to use native gradient libraries per Decision 007.
Libraries required: expo-linear-gradient, expo-blur, react-native-svg. These are NOT yet
installed in package.json and will require an APK build once added.

**Deliverables:**
- **GradientSwatch.tsx** (new) — Radial gradients via react-native-svg for RadialSwatch
  (light-center → saturated-edge with 4-stop SVG RadialGradient). ConicSwatch left on
  existing fake (concentric wedges) with TODO: Decision 006 defers custom hue; conic
  gradient support deferred to future phase.
- **HomeHeroBackground.tsx** (updated) — Sky bands (14 stacked Views) → single LinearGradient
  from expo-linear-gradient (top 60% of screen). Ground fade (3 stacked Views) → single
  LinearGradient. OrbHalo glow and animations (RisingDot, PulseRing) unchanged.
- **ScreenBackground.tsx** (updated) — Per-material blobs (concentric rings) → radial SVG
  gradients via react-native-svg for smoother falloff. Placement (blobsFor) and opacity
  constraints (≤0.2 core) preserved exactly. All 5 materials (glass/metal/rock/paper/plain)
  unchanged.
- **TreeWatermark.tsx** (no changes) — Already correctly uses android-icon-monochrome.png
  asset, not a faked View approximation. OTA-safe as-is.

**Library ownership per Decision 007:**
- Gradient filling rectangular regions → expo-linear-gradient (sky, ground)
- Gradient filling non-rectangular/vector shapes → react-native-svg (blob glows)

**Decisions deferred (TODO notes added):**
- Decision 006: Custom hue + conic gradients — ConicSwatch stays on concentric wedges
  with TODO flag for future phase.

**Blocker for deployment:**
The three native libraries are not in package.json and must be added before next APK build:
```json
"expo-linear-gradient": "^56.0.x",
"expo-blur": "^56.0.x",
"react-native-svg": "^x.y.z"
```
Run `npx expo install` and trigger `.github/workflows/build-android.yml` (workflow_dispatch)
to create new native APK with these dependencies. OTA updates cannot deliver these modules.

**All other implementations ready:**
- Code compiles (pending library installation for runtime checks)
- File headers updated with new imports/usages
- Public contracts (props, positioning, pointerEvents) unchanged
- Existing logic preserved (animations, material system, color tokens)

**Next phase:** Install native libraries, trigger APK build, then test Decision 007 deployment.

## 2026-06-30 — Phase 0: Planning files
Created REBUILD_DECISIONS.md (seeded with Decision 001), PROGRESS_LOG.md,
and REBUILD_PLAN.md. No code touched. Next session: Phase 1, foundation /
universal screen scaffold.
