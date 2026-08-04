# Color & Theme System Library

Reference for UnFocus's actual colour tokens and when to use each one. Rewritten
2026-08-01 (STALE_CODE_AUDIT.md) — the previous version described a pre-rebuild
theme system (6 named colour themes, `theme.cream`/`theme.orange`/`theme.white`
tokens, a user-facing custom-theme builder) that was replaced at the Decision 006
colour rebuild and no longer exists anywhere in the code. Source of truth is
`constants/colors.ts` (tokens) + `constants/theme.ts` (helpers) — if this file and
those ever disagree again, trust the code.

---

## Theme Overview

UnFocus has **one theme** (`ThemeName = 'default'`), with a light palette ("Soft
daylight") and a dark palette ("Midnight glass", 2026-07-18 visual refresh).
There is no Tech/Gothic/Nature/Fluffy theme and no user-facing custom-theme
builder — `darkMode` (off/on/system) is the only palette choice a user makes.

---

## Core Palette

Every token below is required on both `light` and `dark` — TypeScript errors if
either is missing a field (`constants/colors.ts`'s `ThemePalette` interface).
Token names are semantic, not colour-based, on purpose: a token never has to be
renamed because a colour changed.

| Group | Tokens | Use for |
|---|---|---|
| Surfaces | `bg`, `surface`, `surfaceMuted`, `surfaceInset` | Page background → card → sunken/secondary → deepest inset well |
| Rule (decorative only) | `rule` | Full-width notepad row dividers ONLY (`PadSheet`/`PadRow`) — **never** a control boundary. Deliberately below the 3:1 contrast floor; `border` is what marks a tappable edge |
| Text | `text`, `textMuted`, `textInverse` | Primary body/headings, secondary/muted, text on a coloured (accent/good/bad) background |
| Borders | `border`, `borderStrong` | Card/input/chip/focus-ring boundaries; `borderStrong` for emphasis |
| Accent | `accent`, `accentSoft`, `accentInk` | Primary actions/active states; tinted backgrounds; text/icon colour ON an accent fill (re-derived via `contrastOn`, not stored per palette) |
| Semantic state | `good`/`goodSoft`, `bad`/`badSoft`, `warn`/`warnSoft` | Success, error/destructive, warning — chromatic + matching soft background |
| Depth | `shadow`, `overlay` | Shadow tint (theme-aware), modal/sheet backdrop rgba |
| Hint card | `hintBg`, `hintBorder`, `hintAccent` | The `HintCard` explainer surface only |
| Feature octet (screen hues) | `featTask`, `featPlan`, `featHabit`, `featShop`, `featMeal`, `featBudget`, `featNote`, `featHealth`, `featScan` | Per-screen accent hue (`lib/screenColor.ts`) — walks a deliberate arc, see that token block's comment in `constants/colors.ts` for the full ordering rationale |
| Card identity hues | `cardTask`, `cardPlan`, `cardHabit`, `cardHealth`, `cardMeal`, `cardShop`, `cardBudget`, `cardNote`, `cardScan` | Card badge + header wash + domain edge (`lib/domainColor.ts`) — nine token **names**, but only **four distinct values** behind them since 2026-07-31 (see below) |
| Priority ramp (reserved) | `priorityHigh(Soft)`, `priorityMedium(Soft)`, `priorityLow(Soft)` | Not read by any live feature yet |
| Category palette (reserved) | `categoryWork(Soft)`, `categoryHealth(Soft)`, `categoryHome(Soft)`, `categoryPersonal(Soft)`, `categoryShared(Soft)` | Not read by any live feature yet |

There is no `cream`, `orange`, `orangeLight`, `brown`, `brownLight`, `white`,
`offWhite`, `gray`, `grayLight`, `danger`, `dangerLight`, or `neutral` token —
those were the pre-rebuild names. The nearest current equivalents are `bg`
(was `cream`), `surface` (was `white`), `accent`/`accentSoft` (was
`orange`/`orangeLight`), `bad`/`badSoft` (was `danger`/`dangerLight`),
`textMuted` (was `textLight` / `gray`).

---

## Card identity hues — four values, not nine (2026-07-31, addendum A.3)

The nine `card*` token names above all still exist (so nothing has to be
renamed), but they now alias just **four** distinct hues, one per thing a
person actually thinks of as a separate part of their life:

| Hue | Value | Badge ink | Owns |
|---|---|---|---|
| To-do | `#3F52B5` | white | tasks, plans, goals |
| Habits | `#218432` | white | habits |
| Health | `#A84A60` | white | health entries, medicines, episodes |
| Shopping | `#D9A441` | **dark** | shopping, food, catalogue, budget, scan |

Home and Notes get **no** identity hue — `IDENTITY_NEUTRAL` (`#6B7280`), a
near-grey slate.

**⚠️ Load-bearing constraint — read before touching any of these four values:**
they separate by **L\*** (lightness: 38.6 / 48.3 / 44.3 / 70.7), not by hue.
That's what makes them distinguishable in greyscale, in a black-and-white
screenshot, and for every form of colour blindness. Never "harmonise" them to
equal lightness — that reads tidier in a swatch strip and destroys the one
channel that survives colour blindness. Shopping's dark ink (vs. the other
three's white) is the price of that L* spread, not an inconsistency to "fix".
See `constants/colors.ts`'s `IDENTITY_HUES` comment for the full reasoning,
including the honest caveat that Habits and Health sit only 4.0 L\* apart and
separate by hue/chroma instead (ΔE2000 63.1). Habits was `#1F7A2E` (L\* 44.8,
0.5 from Health) until 2026-08-04, when it was lightened to `#218432` along the
same hue angle — the one value in this table that has ever moved.

---

## Contrast & accessibility

`lib/__tests__/colors.test.ts` sweeps the **whole palette**, both modes, for
WCAG AA (≥4.5:1 text, ≥3:1 control boundaries) — this is enforced in CI, not
just a guideline. Two helpers pick text colour dynamically rather than
hardcoding it:

```typescript
import { contrastOn } from '@/constants/theme';

// Best of near-black or white against one background:
const textColor = contrastOn('#3A78E4'); // '#FFFFFF' or '#1E293B'
```

```typescript
import { contrastRatio } from '@/constants/colors';

// Raw WCAG ratio between two hex colours (≥4.5 is AA for body text):
const ratio = contrastRatio('#142545', '#F2F8FE');
```

`accentInk` (text/icon colour on an accent fill) is **not** stored per palette
— `lib/useAppTheme.ts` re-derives it via `contrastOn` on every read, so it can
never drift out of sync with `accent` itself.

---

## Accessing colours in code

### In components (always)
```tsx
import { useAppTheme } from '@/lib/useAppTheme';

export default function MyComponent() {
  const theme = useAppTheme();
  return (
    <View style={{ backgroundColor: theme.bg }}>
      <Text style={{ color: theme.text }}>Hello</Text>
    </View>
  );
}
```
`useAppTheme()` resolves `darkMode` (off/on/system) + the system colour scheme
into the live `ThemePalette` and re-renders on change — never hardcode a hex
value in a component.

### In stores / non-component code
```typescript
import { getThemePalette } from '@/constants/colors';

const isDark = /* resolve from useSettingsStore.getState() + system scheme */;
const theme = getThemePalette('default', isDark);
```

### Feature/card hues (theme-independent)
```typescript
import { IDENTITY_HUES } from '@/constants/colors';

const habitsHue = IDENTITY_HUES.habits.hue; // '#218432', same in light and dark
```

---

## Surface finish (glass material)

The "glass" card finish is **frost + wash + a purposeful `getGlow` halo**
(AGENTS.md's "Materials" note) — not a multi-material system. There is no
metal/rock/paper/plain finish picker; `settings.glassSurfaces` (a
reduce-transparency accessibility toggle) is the only material-related
setting that exists.

```typescript
import { getMaterialStyle, getGlow } from '@/constants/theme';

const cardStyle = getMaterialStyle(theme.surface, 'card', isDark ? 'dark' : 'light');
const focusHalo = getGlow(theme.accent, 'soft'); // or 'strong'
```
`getMaterialStyle` computes the translucent tinted wash + calm border from a
single base colour, consumed by `components/GlassFill.tsx` (frost `BlurView`
only in overlay/chrome contexts — ambient content cards get no blur layer).

---

## Best practices

**Do:**
- Use `useAppTheme()` in every component; never hardcode hex outside `constants/`.
- Use semantic names (`theme.text`, `theme.bad`), not colour names.
- Use the feature octet (`feat*`) / identity hues (`card*`, `IDENTITY_HUES`) for
  per-screen or per-card-type accents — never invent a new hardcoded hue.
- Run `lib/__tests__/colors.test.ts` after touching any token — it's the
  CI-enforced contrast gate.

**Don't:**
- Hardcode hex in a component (the feature/identity hues are the one sanctioned
  exception, and only via their named exports).
- Reference `theme.cream`/`theme.orange`/`theme.white`/etc. — dead pre-rebuild
  names, not real tokens.
- "Harmonise" the four identity hues to equal lightness — see the load-bearing
  constraint above.
- Add a user-facing custom-theme picker without checking with the maintainer
  first — the whole custom-theme system was removed at Decision 006, and this
  file used to be the only place still describing it as live.

---

## Further reading

- **BUTTON_LIBRARY.md** — how buttons use theme colours
- **TYPOGRAPHY_LIBRARY.md** — text colour hierarchy
- **ANIMATION_GUIDELINES.md** — colour transitions, `getGlow` pulses
- **AGENTS.md** — "Materials (frost + wash + glow)" note
- Source: `constants/colors.ts` (tokens), `constants/theme.ts` (helpers),
  `lib/useAppTheme.ts` (the hook), `lib/domainColor.ts` / `lib/screenColor.ts`
  (identity hues / feature octet consumers)

---

**Last updated**: 2026-08-01
**Themes available**: One (`default`), light + dark
**Dark mode**: `settings.darkMode` (off / on / system) via `useAppTheme()`
