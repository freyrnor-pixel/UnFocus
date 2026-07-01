# Design System Library Index

**Quick reference:** Use this table to find which library covers your design question. Read the library directly—don't read this index.

---

## 8 Design Libraries @ `constants/theme.ts`

| Library | Covers | When to use |
|---------|--------|-----------|
| **BUTTON_LIBRARY.md** | Buttons, FAB, IconButton, form controls (Checkbox, Switch, Input, SegmentedControl), Badge, Chip, Avatar | Adding buttons, designing interactions, building forms |
| **COLOR_THEME_LIBRARY.md** | 6 colour themes, light/dark palettes, semantic colours, feature colours, WCAG compliance | Choosing colours, theming UI, ensuring accessibility |
| **TYPOGRAPHY_LIBRARY.md** | Nunito font (regular–extrabold), 7-level text hierarchy (12–36px), readability, text colour hierarchy | Styling text, creating headings, ensuring readability |
| **SPACING_LAYOUT_LIBRARY.md** | Spacing scale (xs 4 → xxl 48), radius scale (sm 10 → full 999), layout patterns, breathing room | Spacing components, building layouts, grid systems |
| **SHADOW_ELEVATION_LIBRARY.md** | 3 shadow levels (card, cardHeavy, fab), depth hierarchy, iOS/Android implementation | Adding shadows, creating depth, layering surfaces |
| **ICON_LIBRARY.md** | Ionicons reference (1000+ icons), sizing guide, feature-specific icons, accessibility, dark mode colouring | Choosing icons, sizing, ensuring accessibility |
| **CARD_CONTAINER_LIBRARY.md** | Card structure, card variants, container patterns, modals, bottom sheets, depth layering | Creating cards, building modals, designing containers |
| **FORM_PATTERNS_LIBRARY.md** | Form structure & spacing, field patterns (text, checkbox, toggle, radio, date/time), validation patterns, error handling | Building forms, validating input, designing form flow |

---

## Decision Tree

- **"What button should I use?"** → BUTTON_LIBRARY.md
- **"What colour should this be?"** → COLOR_THEME_LIBRARY.md
- **"How much space between these?"** → SPACING_LAYOUT_LIBRARY.md
- **"Is this text big enough?"** → TYPOGRAPHY_LIBRARY.md
- **"Which icon goes here?"** → ICON_LIBRARY.md
- **"How do I build a modal?"** → CARD_CONTAINER_LIBRARY.md
- **"How do I build a form?"** → FORM_PATTERNS_LIBRARY.md
- **"Why does this card look flat?"** → SHADOW_ELEVATION_LIBRARY.md

---

## Key Principle

**Single source of truth**: Each visual aspect documented once in `constants/theme.ts`. Change that one place → all screens inherit the update. Never hardcode hex, sizes, or spacing — always use tokens (`Spacing.md`, `FontSize.lg`, `theme.orange`, etc.).

---

**Related docs**: ANIMATION_GUIDELINES.md, AGENTS.md, DESIGN_SYSTEM_IMPLEMENTATION.md
