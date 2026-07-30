# Design System Library Index

**Quick reference:** Use this table to find which library covers your design question. Read the library directly—don't read this index.

> **Read `DESIGN_RULES.md` first.** The 8 libraries below describe *what the system
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

- **"Is this screen allowed to look like this?"** → DESIGN_RULES.md
- **"Why is this rule violated on purpose?"** → DESIGN_RULES_AUDIT.md
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

**Related docs**: DESIGN_RULES.md, DESIGN_RULES_AUDIT.md, ANIMATION_GUIDELINES.md, AGENTS.md

> `DESIGN_SYSTEM_IMPLEMENTATION.md` is a frozen 2026-06-25 checklist from an earlier,
> now-superseded design pass (references a "5 colour schemes" system and a
> `components/TaskItem.tsx` that no longer exist) — not a live reference. See the
> session summary for details; flagged for the maintainer to confirm deletion.
