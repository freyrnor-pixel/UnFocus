# Future plan: full Material Design 3 adoption (NOT current policy)

> ## ⛔ SUPERSEDED 2026-08-15 — the app took an explicitly non-MD3 direction
>
> The maintainer specified **Tactile Glass**, an iOS/Cupertino + hardware hybrid, and it shipped:
> frosted translucent panes, a light-catching edge, Cupertino type, hardware-key press states.
> See AGENTS.md's "Tactile Glass" bullet and `DESIGN_RULES_AUDIT.md`'s 2026-08-15 addendum.
>
> That answers this file's open question in the negative, and note **it went the opposite way on
> the two biggest collisions this document identified**: §2 said tonal elevation and translucent
> surfaces were "flatly rejected, twice, on the record" — translucency is now the material, but
> as GLASS (a frosted pane over a true-black canvas), never as MD3 tonal elevation (a surface
> that lightens toward primary as it rises). And the screen-identity hue system survived; it
> moved off the card edge into the pane tint and the badge rather than being replaced by MD3
> colour roles.
>
> `MIN_TAP_TARGET` at 48 remains the one thing taken from MD3, exactly as before. Everything
> below is kept as a record of an idea that was considered and not adopted — **do not implement
> it**; a request to "make this MD3" now contradicts a shipped, dated design system rather than
> merely an absence of one.

**Status: proposed, not started, not ruled on by the maintainer.** This file exists so a
future session doesn't discover this idea by re-deriving it from scratch, and — more
importantly — doesn't start implementing it without first reading how much of it conflicts
with decisions this codebase has already made deliberately. Read `DESIGN_RULES.md`,
`DESIGN_RULES_AUDIT.md` and AGENTS.md's design-decision history (the "One card design"
reset, "Two shapes for a pick-one question", the button-press-state passes) before touching
any file in service of this plan. Nothing here is binding today.

## The proposal, as given

> Act as an expert UX/UI designer and React Native developer. All UI components, layouts,
> and styling in this application must strictly adhere to Google's Material Design 3 (MD3)
> guidelines.

1. **MD3 color system** — semantic tokens (`brand.primary`, `surface.default`,
   `surface.card`/`surface.elevated`, `text.primary`/`text.secondary`, `onPrimary`), never
   hardcoded hex in component styles.
2. **Tonal elevation** — dark-mode surfaces lighten (tint toward primary) as they rise;
   light-mode uses soft diffused shadows plus subtle surface shifts; no hard 1px separator
   borders.
3. **Component anatomy** — standardized corner radii (cards/sheets 16–24, buttons/chips
   fully-rounded or 20, inputs 8–12); whitespace over nested borders/divider lines; 8px
   spacing multiples.
4. **Button/input hierarchy** — Filled = primary CTA only, Tonal/Outlined = secondary, Text
   = tertiary; MD3 Filled/Outlined text fields (filled = soft fill + bottom indicator line,
   not a full box border).
5. **Typography scale** — strict Display/Headline/Title/Body/Label scale, no inline
   `fontSize`/`fontWeight`.

## Answering the tooling question the prompt asked

**No MD3 UI library is installed.** `package.json` has no `react-native-paper` (or any MD3
component kit) — the only Material-adjacent dependency is
`@react-navigation/material-top-tabs`, which is just the tab navigator, not a design system.
Every component in this app (`Surface`, `Button`, `IconButton`, `PadRow`, `FormControls`,
`TabSlider`, etc.) is hand-built from plain `View`/`Text` against this repo's own three
token files (`constants/colors.ts`, `constants/theme.ts`, `constants/motion.ts`) — see
`DESIGN_SYSTEM_LIBRARY_INDEX.md`. Adopting MD3 wholesale would mean either (a) pulling in
`react-native-paper` and re-platforming every screen onto its components, or (b) re-deriving
MD3's token/elevation/shape rules by hand inside the existing three files. Neither is a small
change — (a) is a rewrite of the component layer described below in "One card design" and
"Two shapes for a pick-one question"; (b) still collides with the same rejected decisions.

## Why this is not a small "apply the theme" task — known conflicts with shipped decisions

This app already took **one specific thing** from MD3 and stopped deliberately:
`MIN_TAP_TARGET` moved from the WCAG 44px floor to MD3's 48px on 2026-08-08. AGENTS.md says
explicitly, twice, in different places: *"the one thing taken from MD3 — its **look** is
deliberately not adopted"*. That line is the maintainer's actual ruling on this exact
question, made six days before this plan was written. A full-MD3 pass would reverse it.
Specific collisions, in the same order as the proposal above:

1. **Color system** — this app already has a semantic/tonal palette (`ThemePalette` in
   `constants/colors.ts`, resolved via `useAppTheme()`), but it is *not* MD3's palette or
   naming. Cards are colored by **screen identity** (`lib/screenColor.ts` — To-do blue,
   Habits sky, Health teal, Shopping green, Notes yellow, Food orange, Scan violet, Goals
   indigo, Home/Settings neutral), not by an MD3 primary/secondary/tertiary role system. An
   MD3 semantic-token rename would either flatten that per-screen hue system or have to be
   grafted awkwardly onto it.
2. **Tonal elevation** — flatly rejected, twice, on the record. The 2026-08-05 "One card
   design" reset removed all translucency, blur, frosted fill and beveled/lit rims: *"A card
   is a flat opaque page with ONE border… No frost, no BlurView, no translucent wash, no
   face-lift scrim, no beveled rim, no inner line."* Dark mode (2026-08-10) went to **true
   black** (`bg #000000`) specifically *because* a tonal/lightened-on-elevation dark surface
   was reviewed and rejected in favor of OLED-true black with a single border for depth.
   Re-introducing tint-on-elevation would undo both passes.
3. **Shape/whitespace** — partial overlap, partial conflict. The app already uses 8px-multiple
   spacing (`Spacing` in `constants/theme.ts`, `SCREEN_GAP`) and already grades border
   *weight* by rung (card → field → button, `BORDER_WIDTH`/`RAMP`). But "whitespace over
   lines" was explicitly **overruled** in the same 2026-08-05 pass — this app's rows are
   bordered boxes on purpose (`PadSheet.tsx`), because the maintainer decided borders are the
   grouping signal here, not blank space. MD3's literal radius values (16/24 cards, 100/20
   buttons, 8/12 inputs) would also need reconciling against the app's own `Radius` scale.
4. **Button/input hierarchy** — this app already has Filled(primary/danger)/flat(secondary,
   as of 2026-08-12)/Ghost(tertiary), which resembles MD3's tiering in spirit but was
   independently derived through several dated passes ("A button has THREE states"), with its
   own press-darken and sink-not-shrink mechanics tied to `Travel`/`Duration` tokens, not
   MD3's ripple. Inputs are the app's own bordered/filled field (`FormControls` `Input`,
   2026-08-05), not MD3's indicator-line filled variant.
5. **Typography** — the app already enforces a fixed scale (`TYPOGRAPHY_LIBRARY.md`, 7 levels
   12–36px, Nunito) rather than arbitrary inline sizes, so this bullet is the closest match —
   but it is not MD3's Display/Headline/Title/Body/Label naming or MD3's type ramp, and
   renaming/rescaling it is still a real migration touching every screen.

## If a future session is asked to act on this

- Don't infer that "note as a future plan" means "start converting screens." This file is
  the note; nothing has been decided or implemented under it.
- Before writing code: get an explicit maintainer ruling on the specific conflicts above,
  the same way `DESIGN_RULES_AUDIT.md` tracks open conflicts between `DESIGN_RULES.md` and
  shipped reality. A blanket "adopt MD3" instruction is not, by itself, a ruling on
  "reintroduce tonal elevation after it was removed twice" or "replace the screen-identity
  border-hue system with MD3 color roles."
- If/when this is greenlit, treat it as a scoped migration (token layer → shape/radius →
  elevation → component-by-component), not a single PR — the same way the 2026-08-05 card
  reset and the 2026-08-10 press-state pass were each their own dated, tested change.
