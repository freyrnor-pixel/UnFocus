# Icon Library

Complete reference for icons, icon usage patterns, sizing, and accessibility in UnFocus. Icons are visual shortcuts that enhance usability.

---

## 🎨 Icon Set

UnFocus uses **Ionicons** — a comprehensive, free icon library with 1000+ icons.

### How to Use Ionicons

```typescript
import { Ionicons } from '@expo/vector-icons';

<Ionicons name="heart" size={24} color={theme.accent} />
```

### Finding Icon Names

Search icon names at **https://ionic.io/ionicons** or **https://icon-sets.iconify.design/ionicons/**

Common pattern: icon names use hyphen-case (`checkmark-circle`, `trash-outline`, etc.)

---

## 📏 Icon Sizes

Sizes are matched to context:

| Size | Use Case | Example |
|------|----------|---------|
| **12** | Captions, tiny indicators | Timestamp icon, badge |
| **14** | Small labels, secondary icons | Form icon, secondary action |
| **16** | Standard icons with text | Label icon, message icon |
| **18** | Standard standalone icon | Card header action, toggle |
| **20** | Medium emphasis | Navigation icons, buttons |
| **22** | Large emphasis | Section headers, focus |
| **24** | Large icons | List item icons, FAB icons |
| **28** | Extra large | Hero icons, prominent actions |
| **32+** | Maximum | Very large emphasis (rare) |

### Auto-Sizing Icons

Icons often size relative to text font size:
```typescript
// Icon is 1.15× the font size
<Ionicons name="heart" size={Math.ceil(FontSize.md * 1.15)} />
// FontSize.md (16) → icon size 18
```

---

## 🎯 Common Icons & Use Cases

### Navigation & Hierarchy
| Icon | Name | Use |
|------|------|-----|
| ☰ | `menu` | Main navigation, hamburger menu |
| ← | `arrow-back` | Back button, previous |
| → | `arrow-forward` | Forward, next |
| ↑ | `chevron-up` | Expand/collapse |
| ↓ | `chevron-down` | Expand/collapse |
| ⊕ | `add-circle` | Add (secondary) |
| + | (text "+" or custom) | Add (primary, AddFAB) |

### Actions
| Icon | Name | Use |
|------|------|-----|
| ✓ | `checkmark` | Success, completion |
| ✓ (circle) | `checkmark-circle` | Confirmed, done |
| ✗ | `close` | Cancel, dismiss, close |
| ⚙ | `cog` | Settings, options |
| ℹ | `information-circle` | Info, details |
| ⚠ | `warning` | Warning, caution |
| 🔔 | `notifications` | Alerts, notifications |
| 🗑️ | `trash` | Delete, remove |

### Content & Data
| Icon | Name | Use |
|------|------|-----|
| 🔍 | `search` | Search, find |
| 🔗 | `link` | Link, connection |
| 📋 | `document-text` | Document, form |
| 📅 | `calendar` | Date, schedule |
| ⏰ | `time` | Time, alarm |
| 📊 | `bar-chart` | Analytics, data |
| 💾 | `save` | Save, export |

### Status & Sentiment
| Icon | Name | Use |
|------|------|-----|
| ♥ | `heart` | Favorite, like, love |
| ♡ | `heart-outline` | Unfavorite, unlike |
| ★ | `star` | Star, important |
| ☆ | `star-outline` | Unstarred |
| 👁️ | `eye` | Visible, show |
| 🚫 | `eye-off` | Hidden, disabled |
| ✓ | `checkmark-done` | Double-check, delivered |

### App-Specific (Feature Accents)
These icons appear next to feature names (domain bubbles, task types). The colour is a
**theme token**, not a literal — it has a light and a dark value, so never paste the hex.
The eight domain hues form a deliberate ramp (indigo → blue → sky → teal → orange → green →
amber → yellow); `featScan` is a per-screen hue with no domain bubble.

| Feature | Icon | Token | Light value |
|---------|------|-------|-------------|
| **Plans** | `calendar` | `theme.featPlan` | `#6E74EE` indigo |
| **Task** | `list` | `theme.featTask` | `#4C8DF0` blue |
| **Habits** | `repeat` | `theme.featHabit` | `#22A7E0` sky |
| **Health** | `heart` | `theme.featHealth` | `#17BEB0` teal (deliberately off red/`bad`) |
| **Meals** | `restaurant` | `theme.featMeal` | `#E88A52` orange |
| **Shopping** | `cart` | `theme.featShop` | `#3DAF6F` green |
| **Budget** | `wallet` | `theme.featBudget` | `#D69420` amber |
| **Notes** | `document-text` | `theme.featNote` | `#E6BC1C` yellow |
| **Scan** | `camera` | `theme.featScan` | `#9B72E3` violet (screen hue only) |

The card-identity equivalents (`theme.cardPlan`, `cardTask`, …) are a separate, lighter
set — see `COLOR_THEME_LIBRARY.md` for the four-hue identity system and its L* constraint.

---

## 🎯 Icon Sizing Patterns

### Pattern 1: Icon with Text Label
Icon and text size are proportional:
```tsx
<View style={{ flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' }}>
  <Ionicons name="heart" size={20} color={theme.accent} />
  <Text style={{ fontSize: FontSize.md }}>Favorite</Text>
</View>
```

### Pattern 2: Icon in Button
Use the button's font size to derive icon size:
```tsx
// In Button component:
<Ionicons 
  name={icon} 
  size={Math.ceil(SIZE_FONT[size] * 1.15)} 
  color={colors.text}
/>
// sm (12px text) → 14px icon
// md (16px text) → 18px icon
// lg (18px text) → 21px icon
```

### Pattern 3: Icon Button
```tsx
<IconButton 
  icon="cog" 
  label="Settings"
  size={36}  // Icon size is 50% of button size = 18px
/>
```

### Pattern 4: Section Header Icon
```tsx
<View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
  <Ionicons name="list" size={24} color={theme.accent} />
  <Text style={{ fontSize: FontSize.xl, fontFamily: Fonts.bold }}>Tasks</Text>
</View>
```

### Pattern 5: Tab Icon (BottomNav)
```tsx
<Ionicons name="list-outline" size={24} color={active ? theme.accent : theme.textMuted} />
```

### Pattern 6: Status Icon
```tsx
<View style={{ flexDirection: 'row', gap: Spacing.xs }}>
  <Ionicons name="checkmark-circle" size={20} color={theme.good} />
  <Text style={{ fontSize: FontSize.md, color: theme.text }}>Completed</Text>
</View>
```

---

## 🔄 Outlined vs Filled Icons

Most Ionicons come in two styles:

| Variant | Name Pattern | Use |
|---------|--------------|-----|
| **Filled** | `heart`, `star`, `checkmark-circle` | Active, selected, emphasis |
| **Outlined** | `heart-outline`, `star-outline`, `checkmark-circle-outline` | Inactive, unselected, lighter |

```tsx
// Outline for inactive state
<Ionicons name="heart-outline" size={24} color={theme.textMuted} />

// Filled for active state
<Ionicons name="heart" size={24} color={theme.accent} />
```

---

## ♿ Accessibility

### Always Label Icons
Icon-only buttons must have an accessibility label:

```tsx
<IconButton
  icon="cog"
  label="Settings"  // Required for accessibility
  onPress={() => router.push('/settings')}
/>
```

### Icon with Text
If icon is paired with text, text is sufficient:
```tsx
<View style={{ flexDirection: 'row', gap: Spacing.xs }}>
  <Ionicons name="heart" size={20} />
  <Text>Favorite</Text>  {/* Provides context */}
</View>
```

### Colour + Icon Redundancy
Don't rely on colour alone:
```tsx
// GOOD: Icon + colour
<Ionicons name="checkmark-circle" size={20} color={theme.good} />

// AVOID: Colour only
<View style={{ 
  width: 20, 
  height: 20, 
  backgroundColor: theme.good,  // Can't tell what this is
}} />
```

---

## 🎨 Icon Colouring

### Standard Colouring
Icons inherit colour from theme:

```typescript
// Primary action icon
<Ionicons name="heart" size={24} color={theme.accent} />

// Secondary/muted icon
<Ionicons name="time" size={18} color={theme.textMuted} />

// Success icon
<Ionicons name="checkmark-circle" size={22} color={theme.good} />

// Danger icon
<Ionicons name="warning" size={22} color={theme.bad} />
```

### Feature-Specific Icons
Feature icons keep their domain hue instead of the accent — they come off the same theme
object as everything else, so they still flip between light and dark:
```typescript
const theme = useAppTheme();

// Task icon (blue in both modes)
<Ionicons name="list" size={24} color={theme.featTask} />

// Habit icon (sky in both modes)
<Ionicons name="repeat" size={24} color={theme.featHabit} />
```

> There is no `FeatureColors` export and no `THEME_ICONS` map in `constants/theme.ts` —
> both were documented here for months and neither has ever existed. Feature hues are
> `ThemePalette` fields (`theme.feat*`) in `constants/colors.ts`.

### Dark Mode
Icons automatically adapt via theme hook—no special handling:
```tsx
const theme = useAppTheme();
<Ionicons name="heart" size={24} color={theme.accent} />
// Light mode: #235EE0
// Dark mode:  #6EA8FF (lifted for contrast on the dark bg)
```

---

## 🚫 Anti-Patterns

### ❌ Don't Use Hardcoded Colours
```tsx
// BAD:
<Ionicons name="heart" size={24} color="#FF0000" />

// GOOD:
<Ionicons name="heart" size={24} color={theme.accent} />
```

### ❌ Don't Forget Accessibility Labels
```tsx
// BAD:
<Pressable onPress={delete}>
  <Ionicons name="trash" size={24} />
</Pressable>

// GOOD:
<IconButton 
  icon="trash" 
  label="Delete"  // Required
  onPress={delete}
/>
```

### ❌ Don't Mix Icon Styles Randomly
```tsx
// BAD: Inconsistent outline/filled usage
<Ionicons name="heart" size={24} />        {/* Filled */}
<Ionicons name="star-outline" size={24} /> {/* Outline */}

// GOOD: Consistent based on state
{isFavorite ? 
  <Ionicons name="heart" size={24} /> :  {/* Filled when active */}
  <Ionicons name="heart-outline" size={24} />  {/* Outline when inactive */}
}
```

### ❌ Don't Oversized Icons
```tsx
// BAD: Icon too large for context
<View style={{ gap: Spacing.xs }}>
  <Ionicons name="heart" size={48} />  {/* Huge icon */}
  <Text style={{ fontSize: 12 }}>Favorite</Text>
</View>

// GOOD: Icon proportional to text
<View style={{ gap: Spacing.xs, flexDirection: 'row' }}>
  <Ionicons name="heart" size={14} />   {/* 14px with 12px text */}
  <Text style={{ fontSize: 12 }}>Favorite</Text>
</View>
```

---

## 🔍 Finding & Testing Icons

### Online Icon Browser
- **Ionicons website**: https://ionic.io/ionicons
- **Iconify**: https://icon-sets.iconify.design/ionicons/

### Copy Icon Name
```
Search "heart" → select variant (outline) → name is `heart-outline`
```

### Quick Test in Code
```tsx
<Ionicons name="heart-outline" size={24} color="black" />
// If it works, the name is correct
```

---

## 📐 Icon Sizing Cheat Sheet

```
Caption text (12px)      → Icon 12-14px
Small text (14px)        → Icon 14-16px
Standard text (16px)     → Icon 18-20px
Large header (18px)      → Icon 20-24px
XL header (22px)         → Icon 24-28px
Hero text (36px)         → Icon 32-40px

Small button (36px)      → Icon 18px
Medium button (48px)     → Icon 20-24px
Large button (56px)      → Icon 24-28px

Tab icon (BottomNav)     → 24px
Header icon (action)     → 18-24px
Section icon             → 24px
Badge/chip icon          → 12-16px
```

---

## 🎯 Best Practices

✅ **DO:**
- Use Ionicons for all icons
- Size icons proportionally to text
- Use theme colours via `useAppTheme()`
- Provide accessibility labels for icon-only buttons
- Use outlined/filled variants for active/inactive states
- Test icons across platforms

❌ **DON'T:**
- Hardcode icon colours — feature hues are tokens too (`theme.featTask`, not a hex)
- Use oversized or undersized icons
- Forget accessibility labels
- Mix icon sources (stick to Ionicons)
- Ignore dark mode (use theme hook)

---

## 🔧 Accessing Icons in Code

```typescript
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/useAppTheme';

export function MyComponent() {
  const theme = useAppTheme();

  return (
    <View style={{ gap: Spacing.xs, flexDirection: 'row' }}>
      {/* Theme-coloured icon */}
      <Ionicons name="heart" size={24} color={theme.accent} />

      {/* Feature-coloured icon */}
      <Ionicons name="list" size={24} color={theme.featTask} />

      {/* Text-coloured icon */}
      <Ionicons name="checkmark" size={24} color={theme.text} />
    </View>
  );
}
```

---

## 📚 Further Reading

- **BUTTON_LIBRARY.md** – Icons in buttons & IconButton
- **COLOR_THEME_LIBRARY.md** – Icon colouring
- **TYPOGRAPHY_LIBRARY.md** – Icon + text sizing
- **`ThemePalette` in `constants/colors.ts`** – the `feat*` domain hues and the rest of the
  token set
- **`components/HabitIcon.tsx` / `InventoryIcon.tsx`** – the app's two icon-picking helpers

---

**Last updated**: 2026-06-27  
**Icon set**: Ionicons v4+  
**Variants**: Filled and outlined for most icons  
**Accessibility**: Always provide labels for icon-only buttons  
**Theming**: Use `useAppTheme()` for colours
