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

## 2026-06-30 — Phase: Surface glass redesign around real blur (Decision 008)
**Status: Complete (code-ready; native install + APK build pending — see blocker)**

**Scope:** Ported `components/Surface.tsx` to real blur and enriched
`components/ScreenBackground.tsx` per Decision 008. Nothing else touched.
BubbleMenu NOT ported (Decision 008 (5): dropped, kept as dead reference).

**Deliverables:**
- **Surface.tsx**
  - New prop `surfaceContext?: 'ambient' | 'overlay'` (default `'ambient'`),
    exported type `SurfaceContext`. For glass it selects only the blur
    intensity/tint (ambient 25 / overlay 45) — one shared expo-blur code path;
    what sits *behind* the card is decided by where the caller mounts it, not
    by Surface. No-op for non-glass.
  - Glass fill rebuilt around a real `<BlurView>` (expo-blur) at
    `StyleSheet.absoluteFill` inside the existing overflow:hidden rounded mask,
    plus a thin colour wash (`mat.backgroundColor` @ opacity 0.5) so the surface
    keeps its theme/tint hue. `tint` = dark-mode-aware. Android wires
    `experimentalBlurMethod="dimezisBlurView"` from the start (Decision 008 (2)/(4)).
  - metal/rock/paper/plain: byte-identical behaviour — mask still gets the opaque
    `getMaterialStyle()` fill; the glass branch is the only new path; sheen/shade,
    3-way style split, owned-key dropping, dark-mode sheen suppression, `tint`
    base, and shadow-from-theme-token all preserved. `getMaterialStyle()` itself
    was left untouched (keeps it context-blind; glass tokens reused as-is).
- **ScreenBackground.tsx** — enriched per Decision 008 (3): bigger blobs, a
  slower mid-falloff (added 35%/70% stops; mid raised 0.08 → 0.13/0.06), and a
  third accent blob for glass, so ambient glass has real colour to frost.
  Core opacity kept at 0.2 (exposed-backdrop legibility cap honoured). The
  concentric-ring fake-blur blobs are retained — real blur (under cards) and
  fake blur (exposed backdrop) coexist as Decision 008 (3) requires.

**Decision 008 verification hooks:**
- ambient glass frosts the backdrop; overlay glass frosts live content; the two
  differ only by blur intensity over one code path. ✔ (by construction)
- non-glass renders identically in both contexts (`surfaceContext` unread for
  them). ✔
- all existing `<Surface>` call sites (BottomNav, ScreenHeader) untouched and
  default to ambient. ✔
- ScreenBackground richer, ≤0.2 core opacity preserved. ✔
- No react-native-skia import landed. ✔ (expo-blur only)

**Unresolved / notes:**
- No new decisions made — everything followed Decision 008 as written.
- **Android blur jank (Skia-trigger record):** not measurable in this remote
  env (no device, libraries not installed). The Decision 008 (4) escape hatch
  — expo-blur → `experimentalBlurMethod` → Skia — remains untriggered. Flag for
  the first on-device test of `overlay` glass over scrolling content.
- **Blocker (same as Decision 007):** `expo-blur` (and `react-native-svg`) are
  not yet in package.json / node_modules, so a full `tsc` and runtime check
  can't run here. Install the native libs and trigger a new APK build before
  on-device verification; OTA cannot deliver these native modules.

## 2026-06-30 — Planning: Decision 009 logged (Home preview convergence)
Recorded Decision 009 in REBUILD_DECISIONS.md from the Home-preview-convergence
handoff (planning session resolving Home decisions 1–4). No code written.
Summary of what was decided:
- (1) Energy check-in removed from Home (component/store kept; medium-vs-high
  ambiguity deferred, not resolved).
- (2) Single shared preview card: Notes / Plans / Shopping previews all render
  through `ExpandableCard` (no bespoke per-section cards).
- (3) Plans preview "time now + rest of day" redesign inherits the full Plans
  redesign — executed in the Plans phase (Session B), and the Plans *visual
  direction is still an open design question* to resolve with the user before
  building.
- (4) Focus mode = Home-only, ephemeral view-state (Option C): header toggle left
  of the gear; hides Notes/Shopping previews; filters tasks to essential via the
  existing `importance` field; hides input affordances but keeps done-toggle; not
  persisted.
Work is split: Session A (composite) converges Notes (`InboxSection`) + Shopping
ungrouped rows onto `ExpandableCard` and closes the edit-old-note gap; Session B
(Plans phase) does the full Plans redesign + preview alignment. Decisions 1 and 4
land in the later Home phase. Both sessions carry stop-if-unmet preconditions
(see Decision 009). Nothing here unblocks coding yet — these are recorded
decisions only.

## 2026-07-01 — Planning: Decision 010 logged (HintCard reach) + C1 note
Recorded Decision 010 (OPEN) from a read-only investigation of the OLD app
(All-the-small-things). No code written in UnFocus.
- **E1 → Decision 010 (OPEN):** `HintCard` is imported by exactly TWO old-app
  screens (`scan.tsx`, `notes.tsx`), NOT "most screens" as the inventory claims.
  Open question deferred to the stores+screens phase, per-screen: (a) add HintCard
  to more screens for parity, or (b) correct the inventory prose. Low effort either
  way — don't resolve in a foundation/composite phase.
- **C1 (context, not a UnFocus decision):** note editing is already SHIPPED &
  reachable in the old app (`notes.tsx` routed screen; `useNotesStore` SQLite-backed
  with header+body `update`; NoteRow commit callbacks; reached via Home preview "See
  all" → `/notes`). The 2026-06-21 FEATURE_INVENTORY line is stale. Design intent to
  preserve on port: Notes has NO BottomNav tab by design — don't add one as a "fix."
  (Full C1/E1 investigation detail lives in the old-app PROGRESS_LOG; this is the
  rebuild-side pointer.)

**Source correction (FEATURE_INVENTORY lines proven stale):**
- Notes / "Edit an old note — doesn't exist yet" & "no separate Notes page"
  (dated 2026-06-21) → STALE. Note editing and a routed `/notes` screen are
  shipped and reachable (see C1). Treat the feature as DONE, not a gap. The
  absence of a BottomNav tab is intentional, not a missing piece.

## 2026-07-01 — Planning: Open Backlog logged (OB-1, OB-2, OB-3)

**Status: Complete** — No code written. Recorded three unresolved decision
threads surfaced by the 2026-07-01 decision-log audit into a new "Open
Backlog" section in REBUILD_DECISIONS.md (that file is otherwise a
resolved-only log; this section is explicitly exempt from that rule).

- **OB-1 (Open):** Habit reminders — multiple times per day. Real feature
  addition; needs a decision on data model (time array vs. recurrence rule),
  add/remove UI, and notification scheduling before it can be built.
- **OB-2 (Open, deferred):** Energy check-in medium-vs-high parity. Already
  flagged as deferred by Decision 009; re-surfaced here so it stays visible
  instead of silently dropping off.
- **OB-3 (Open):** Sharing per-location explanation copy. Wording-only; needs
  the share locations enumerated and short explanatory strings drafted.

None of the three block Phase 2 primitives. They're candidate threads for
after primitives land, in no fixed order.

## 2026-07-01 — Phase 2 complete: all nine primitives ported
**Status: Complete.** Button, Badge, IconButton, ProgressBar, PressableScale,
FormControls, EmptyState, ConfirmationBanner were already ported in prior
sessions (all on Decision 006 token names: `accent`/`accentSoft`, `good`/`bad`/
`warn`, `textMuted`, `surface`, etc. — no raw hexes). This session ported the
ninth and last: **HintCard.tsx**.

**HintCard.tsx (new):**
- Direct port of the old app's HintCard — same gating (`showHints` from
  `useSettingsStore`, renders null when off), same `hintBg`/`hintBorder`/
  `hintAccent` tokens (Decision 006 kept these names verbatim), same
  accent-bar + info-icon + text/example layout.
- Only change: `theme.textLight` → `theme.textMuted` (old→new token rename).
  `text`/`example` still passed in pre-localized; component doesn't call `useT()`.
- Not yet mounted anywhere — Decision 010 (OPEN) still governs where it goes
  when screens are ported (old app only had it on scan.tsx + notes.tsx).

**Decision 013 (ConfirmationBanner variants) verified in code:** `variant:
'success'|'danger'|'warn'` prop present, default `'success'`, fills `good`/
`bad`/`warn`, glyph `textInverse` on all three, icons `checkmark-circle`/
`alert-circle`/`warning`. Matches the decision spec exactly.

**Phase 2 status:** all nine primitives from REBUILD_PLAN.md's list now exist
in `components/`. None wired into any screen yet (Phase 6). Next phase per
REBUILD_PLAN.md: Phase 3 composites (AppModal, sheets, cards, ExpandableCard,
etc.).

## 2026-07-01 — Decision 014 logged (ExpandableCard accentColor scope)
Recorded Decision 014 in REBUILD_DECISIONS.md, ratifying a Phase 3a consequence
of Decision 008: `ExpandableCard`'s `accentColor` now tints only the 4px accent
bar (not the card border/sheen, which `Surface` owns post-008). Old source
never tinted the fill either — only border/sheen + the accent bar — so nothing
beyond border/sheen tint was actually lost. `health.tsx` (not yet ported) is
flagged as the one caller that uses `accentColor` for real severity signaling;
its future store+screen phase must confirm the 4px bar reads as severity or add
an explicit `Badge` affordance. Decision 009 preview sessions (Notes/Shopping/
Plans) are contracted to treat `accentColor` as accent-stripe-only. No code
changed this entry.

**Open threads (carried forward, not Phase 3a's scope):**
- **`components/ScreenHeader.tsx` has a known bug**, surfaced during Phase 3a
  but not caused by it. Whichever later session first touches ScreenHeader
  should fix it then, rather than rediscover cold.
- **`lib/date.ts` is missing** — referenced (imported) by code but absent from
  the repo, also surfaced during Phase 3a, not in its scope. Whichever later
  session first imports from `lib/date.ts` should add it then.

## 2026-07-01 — Phase 3a: Foundational composites (AppModal, ExpandableCard, SectionDivider, AddDivider, CompletionGlow)

**Status: Complete.** Ported the five structural/leaf composites scoped to this
session; none of the excluded composites (PlanTaskCard, ShoppingRow,
WeekListCard, InboxSection, DraggableTaskRow, sheets/icons/pickers) were
touched. All five ported to Decision 006 token names — no raw hex (shadowColor
exempt), no off-list tokens.

**Preconditions confirmed before starting:** Decisions 001, 006, 007, 008, 009
all present in REBUILD_DECISIONS.md with real structured entries. PROGRESS_LOG
confirmed Phase 2 (nine primitives) and the Phase 1 Surface/glass (008) port
both logged complete — Surface.tsx exists with `surfaceContext` prop.

**AppModal.tsx:**
- Ported with `showAppModal()` / `<AppModalHost/>` API unchanged.
- Modal card now renders via `<Surface surfaceContext="overlay">` — confirmed
  `overlay` used (modal sits over live content behind the backdrop) and blur
  comes from Surface's BlurView, not a direct expo-blur import in this file.
- Token remap: `theme.white`→`surface` (implicit, via Surface), `theme.text`→
  `text`, `theme.textLight`→`textMuted`, `theme.orange`→`accent` (button fill),
  `theme.danger`→`bad`, button text colours→`accentInk`/`textInverse` per
  Decision 006's fill/text-on-fill pairing. Backdrop switched from an animated
  fixed-alpha black to the `overlay` token's own baked-in alpha, animating the
  View's opacity 0→1 instead of 0→0.5 (equivalent visual result, token-only).
  Card's own shadow/border no longer set from `Shadow.fab` — Surface supplies
  material-based shadow/border from the `shadow` token, superseding the old
  hardcoded black shadow.
- Not yet mounted in `app/_layout.tsx` (screens phase, per Decision 010-style
  "not yet mounted anywhere" precedent from Phase 2's HintCard).

**ExpandableCard.tsx:**
- Public API kept as a superset of old source: `title`/`subtitle`/`badge`/
  `children`/`leadingAction`/`rightAction`/`defaultOpen`/`open`/`onToggle`/
  `accentColor`/`material` all present, same semantics.
- **Controlled and uncontrolled modes both verified in code:** uncontrolled
  (no `open`/`onToggle` passed) uses internal `useState` exactly as before;
  controlled mode (`open`+`onToggle` both passed) has the same
  mount-vs-external-change guard (`mountedRef`) so external toggles animate
  but the initial mount doesn't. This is the pattern PlanTaskCard's controlled
  usage and the 009 previews depend on — preserved byte-for-byte in logic,
  only the rendering shell (mask→Surface) changed.
- **Doc-vs-source conflict, resolved docs-win (per instructions):** old source
  hand-rolled its own two-layer mask (`getMaterialStyle` + manual border/sheen/
  shadow views) instead of delegating to Surface. Decision 008 says Surface
  owns all material/blur rendering now, so this session refactored the card
  face to `<Surface material={material} surfaceContext="ambient">` instead of
  porting the old mask verbatim. One behavioural drop as a result: old code's
  `accentColor` fed `getMaterialStyle(accentColor, finish)` for border/shadow
  tint, but the mask *fill* was hardcoded to `theme.white` regardless — an
  inconsistency in the original (border tinted, fill not). Surface's `tint`
  prop tints the whole material (fill+border together), so there's no way to
  reproduce "tint border only" through Surface. Rather than silently
  reintroducing a hand-rolled mask to preserve that inconsistency, `accentColor`
  now only colours the left accent bar; the card face uses Surface's default
  (untinted) material. Flagging this as the resolved call, not a silent regression.
- `material` prop forwards straight to `<Surface material={material}>` — when
  omitted, Surface itself reads `bubbleMaterial` from settings, so this
  component no longer needs its own `useSettingsStore` read (simplification
  enabled by consuming Surface rather than duplicating its default-resolution
  logic).
- Token remap: `theme.textLight`→`textMuted`, `theme.orangeLight`→`accentSoft`,
  `theme.brown`→`accent` (badge text on `accentSoft` fill), `theme.grayLight`→
  `border` (body top rule).

**SectionDivider.tsx:** direct port, no token changes needed — `theme.border`
already exists under that exact name in the new token layer.

**AddDivider.tsx:** direct port. Token remap: `theme.grayLight` split into two
006 tokens depending on role — divider lines → `border` (matches its "hairline
border" semantic), "+" button circle fill → `surfaceMuted` (subtle secondary
surface), button text → `textMuted`.

**CompletionGlow.tsx:**
- **Native-lib check (per task step 5): NOT needed.** Verified it's a pure
  `Animated.View` opacity/scale bloom — no `react-native-svg` or
  `expo-linear-gradient` import in old source, and none added here. No
  install, no flag required; ported as-is with only the colour token changed
  (`theme.green`→`theme.good`).
- No other logic changes — reduced-motion gating, rising-edge-only trigger,
  and the 300ms/400ms bloom timing all preserved verbatim.

**Verification:** `npx tsc --noEmit` run — none of the five new/changed files
produced errors. Remaining errors in the run are all pre-existing and out of
scope: missing native libs (`expo-blur`, `expo-linear-gradient`,
`react-native-svg` — Decision 007/008's known install blocker, not yet
installed), old-token-name errors in `app/_layout.tsx`, `app/index.tsx`,
`app/_scaffold-demo.tsx`, `BottomNav.tsx`, `ScreenHeader.tsx`,
`ScreenBackground.tsx` (not yet rewired to `ThemePalette` — a later phase per
Decision 006's own "component ports are a later phase" note), a
`ScreenHeader.tsx` stray `Platform` import bug, and a missing `lib/date.ts`
file referenced by `lib/db.ts`. None of these were touched or introduced by
this session.

**Unresolved for next Phase 3 sub-session:**
- The five composites here are not mounted into any screen yet — that's
  Session A/B (Decision 009) and later Phase 3 sub-sessions' job.
- Pre-existing `tsc` errors listed above (old-token screens, missing
  `lib/date.ts`, `ScreenHeader.tsx` Platform import, native libs not
  installed) are still open — none are blockers for this session's scope but
  will need a dedicated cleanup pass before a full green `tsc` run is possible.
