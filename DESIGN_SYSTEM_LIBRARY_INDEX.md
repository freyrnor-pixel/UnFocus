# Design System Library Index

**Quick reference:** Use this table to find which library covers your design question. Read the library directly—don't read this index.

> **Read `DESIGN_RULES.md` first.** The 6 libraries below describe *what the system
> contains*; `DESIGN_RULES.md` states *what any screen must satisfy* (spacing, placement,
> contrast, hierarchy, tap targets, motion, copy tone) and is the only design doc backed by
> CI tests. Where a library and `DESIGN_RULES.md` disagree, check `DESIGN_RULES_AUDIT.md` —
> some of these libraries have drifted from `constants/` and the audit says which.

---

## The rulebook

| Doc | Covers | When to use |
|---------|--------|-----------|
| **DESIGN_RULES.md** | 25 numbered invariants across spacing, placement & order, colour, hierarchy, tap targets, motion and copy tone — plus the open conflicts between those rules and shipped decisions | **Before building or changing any screen.** Its self-check list is the ship gate |
| **DESIGN_RULES_AUDIT.md** | The app measured rule-by-rule: what passes, what was fixed, what conflicts and is awaiting a maintainer ruling | Working out whether a rule is binding yet, or why a violation is still there on purpose |
| **INTERACTION_HANDOFF.md** | The control *vocabulary* — which control answers which need, what "unnatural" looks like, and the gesture/target/copy rules that keep a screen feeling like a normal mobile app | Choosing a control, or checking one you're about to invent. Its changelog records which of its rules bent to a shipped decision and which the app changed to meet |

---

## 6 Design Libraries

The tokens live in **three** files, not one — `constants/theme.ts` does *not* re-export
`constants/colors.ts`, so reaching for a colour in `theme.ts` finds nothing:

| File | Holds |
|---|---|
| `constants/colors.ts` | Every **colour**: the `ThemePalette` type, the light/dark palettes, `getThemePalette`, `contrastRatio`, `IDENTITY_HUES`. Everything you reach through `theme.*` comes from here |
| `constants/theme.ts` | Every **dimension and finish**: `Spacing`, `Radius`, `FontSize`, `Fonts`, `Type`, `MIN_TAP_TARGET`/`HitSlop`, `AspectRatio`, the `PAD_*` row metrics, plus the colour *functions* (`getMaterialStyle`, `getGlow`, `getElevation`, `getLayeredShadow`, `contrastOn`, `lighten`/`darken`/`mix`/`rgba`) — which take a colour and return a style, but define no palette of their own |
| `constants/motion.ts` | Every **timing**: `Duration`, `Ease`, `Spring`, `Travel`. Never a bare `duration: 220` — `lib/__tests__/designTokens.test.ts` fails the PR |

Components never import a palette directly: `useAppTheme()` (`lib/useAppTheme.ts`) resolves
light/dark and hands back the `ThemePalette` as `theme`. Outside a component, call
`getThemePalette()` — the same rule as `useT()` vs `getTranslations()`.

| Library | Covers | When to use |
|---------|--------|-----------|
| **BUTTON_LIBRARY.md** | Buttons, FAB, IconButton, form controls (Checkbox, Switch, Input, SegmentedControl), Badge, Chip | Adding buttons, designing interactions, building forms |
| **COLOR_THEME_LIBRARY.md** | The single `default` theme's light/dark `ThemePalette`, the four-hue card identity system, `contrastOn`/`contrastRatio`, the `getMaterialStyle`/`getGlow` surface finish | Choosing colours, theming UI, ensuring accessibility |
| **TYPOGRAPHY_LIBRARY.md** | Nunito font (regular–extrabold), 7-level text hierarchy (12–36px), readability, text colour hierarchy | Styling text, creating headings, ensuring readability |
| **SPACING_LAYOUT_LIBRARY.md** | Spacing scale (xs 4 → xxl 48), radius scale (sm 12 → full 999), layout patterns, breathing room | Spacing components, building layouts, grid systems |
| **ICON_LIBRARY.md** | Ionicons reference (1000+ icons), sizing guide, feature-specific icons, accessibility, dark mode colouring | Choosing icons, sizing, ensuring accessibility |
| **FORM_PATTERNS_LIBRARY.md** | Form structure & spacing, field patterns (text, checkbox, toggle, radio, date/time), validation patterns, error handling | Building forms, validating input, designing form flow |

**Cards, surfaces, modals, sheets and shadows have no library doc — that is deliberate.**
`CARD_CONTAINER_LIBRARY.md` and `SHADOW_ELEVATION_LIBRARY.md` were deleted 2026-08-01
(STALE_CODE_AUDIT.md §5.8): both taught hand-rolling a card out of `backgroundColor` +
`...Shadow.card` + a raw `Radius`, which is the anti-pattern now — real cards go through
`<Surface>`, which owns the material, the beveled edge and the layered shadow together.
The source of truth is, in order: `components/Surface.tsx`'s docstring (when to use
`surfaceContext="ambient"` vs `"overlay"`), `constants/theme.ts` (`getElevation`,
`getLayeredShadow`, `getMaterialStyle`, `getGlow`), and AGENTS.md's "Materials" note.
For rows inside a surface, see `components/PadRow.tsx`/`PadSheet.tsx` and AGENTS.md's
"row rule"; for modals and sheets, `components/AppModal.tsx` and
`components/AnimatedBottomSheet.tsx`.

---

## Decision Tree

- **"Is this screen allowed to look like this?"** → DESIGN_RULES.md
- **"Why is this rule violated on purpose?"** → DESIGN_RULES_AUDIT.md
- **"What button should I use?"** → BUTTON_LIBRARY.md
- **"What colour should this be?"** → COLOR_THEME_LIBRARY.md
- **"How much space between these?"** → SPACING_LAYOUT_LIBRARY.md
- **"Is this text big enough?"** → TYPOGRAPHY_LIBRARY.md
- **"Which icon goes here?"** → ICON_LIBRARY.md
- **"How do I build a form?"** → FORM_PATTERNS_LIBRARY.md
- **"How do I build a card, modal or sheet?"** → `components/Surface.tsx` /
  `AppModal.tsx` / `AnimatedBottomSheet.tsx` docstrings (no library doc — see above)
- **"Why does this card look flat?"** → `constants/theme.ts` (`getElevation`,
  `getLayeredShadow`) + `components/Surface.tsx` (no library doc — see above)

---

## Key Principle

**Single source of truth**: each visual aspect is defined once, in whichever of the three
`constants/` files above owns it. Change that one place → all screens inherit the update.
Never hardcode a hex, size, spacing or duration — always use tokens (`theme.accent` from
`colors.ts`, `Spacing.md`/`FontSize.lg` from `theme.ts`, `Duration.control` from `motion.ts`).

---

**Related docs**: DESIGN_RULES.md, DESIGN_RULES_AUDIT.md, ANIMATION_GUIDELINES.md, AGENTS.md

**The card material is Tactile Glass (2026-08-15)** — `components/Surface.tsx` owns it, with
`getGlassEdge`/`getGlassFill`/`getBadgeFrost`/`getTopHighlight`/`getInnerShade` in
`constants/theme.ts` and the `surfaceGlass`/`surfaceGlassStrong` pair in `constants/colors.ts`.
Read that component's header before changing a card, a border or a press state: it reverses the
2026-08-05 flat-card reset, and the reversal was ruled on conflict-by-conflict
(`DESIGN_RULES_AUDIT.md`, 2026-08-15 addendum). The deliberate gap noted above still holds —
cards/surfaces/modals have no library doc of their own, because `<Surface>` IS the doc.

**Proposed, not shipped**: `MD3_FUTURE_PLAN.md` — a full Material Design 3 adoption plan.
Read it before acting on any request to "make this MD3" — it lists which parts collide with
decisions already made here (tonal elevation, translucent surfaces, MD3 color roles) and
which parts the app already independently arrived at (48px tap targets, 8px spacing,
bordered fields). Not binding; no maintainer ruling yet.

> `DESIGN_SYSTEM_IMPLEMENTATION.md` — the frozen 2026-06-25 checklist this note used to flag
> as superseded-but-still-present — was deleted 2026-08-01 (STALE_CODE_AUDIT.md). It referenced
> a "5 colour schemes" system and a `components/TaskItem.tsx` that no longer exist; nothing in
> it was live.
