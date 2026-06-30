# Color & Theme System Library

Complete reference for UnFocus's color palettes, theming system, and when to use each colour. This guides consistent visual decision-making across all screens.

---

## 🎨 Theme Overview

UnFocus supports **6 colour themes** (5 predefined + custom):

| Theme | Primary Accent | Vibe | Light Mode | Dark Mode |
|-------|-----------------|------|-----------|-----------|
| **Default** | Blue (`#2563EB`) | Clean, calm, focused | Light sky tones | Navy depth |
| **Tech** | Cyan (`#0EA5E9`) | Modern, airy, smart | Bright sky | Deep tech |
| **Gothic** | Purple (`#7C3AED`) | Mysterious, introspective | Soft pastels | True dark |
| **Nature** | Green (`#16A34A`) | Grounded, organic, earthy | Fresh greens | Forest depth |
| **Fluffy** | Pink (`#EC4899`) | Playful, soft, gentle | Pastel pinks | Deep plum |
| **Custom** | User-chosen | User preference | Generated from primary | Generated from primary |

---

## 📋 Core Color Palette (Light Mode)

Every theme provides **18 semantic colours**. Here's the **Default** theme as reference:

```typescript
// From constants/theme.ts - THEMES.default
{
  cream:       '#F2F8FE',      // Page background (softest)
  orange:      '#2563EB',      // Primary accent (blue in default)
  orangeLight: '#BFDBFE',      // Primary tint (used for secondary actions)
  green:       '#10B981',      // Success accent
  greenLight:  '#A7F3D0',      // Success tint (backgrounds)
  brown:       '#1E3A8A',      // Darker variant of primary
  brownLight:  '#60A5FA',      // Lighter variant of primary
  white:       '#FFFFFF',      // Elevated surface (cards, modals)
  offWhite:    '#E8F2FE',      // Raised surface (cards above cream)
  gray:        '#94A3B8',      // Secondary text / icons
  grayLight:   '#DCEEFC',      // Light backgrounds, disabled states
  text:        '#142545',      // Primary text (dark, high contrast)
  textLight:   '#5C7299',      // Secondary text (muted)
  danger:      '#EF4444',      // Error / destructive actions (always red)
  dangerLight: '#FEE2E2',      // Error backgrounds (light red)
  shadow:      'rgba(30,41,59,0.12)',  // Shadows (theme-aware darkness)
  border:      '#CDE6FA',      // Borders, dividers, outlines
  neutral:    '#A3C2E4',      // "Shame-free" elements (empty states, badges)
}
```

---

## 🌓 Dark Mode

Dark mode inverts the depth ladder but maintains semantic meaning:

```typescript
// Light mode depth:     offWhite (sunken) < cream (bg) < white (raised)
// Dark mode depth:      offWhite (sunken) < cream (bg) < white (raised)
// But uses dark hex values to stay in the navy family

// Default dark theme example:
{
  cream:       '#070C18',      // Page background (darkest)
  white:       '#18243E',      // Elevated surface (raised card, still dark)
  offWhite:    '#060914',      // Sunken surface (deepest)
  text:        '#DDE9FB',      // Light text on dark (high contrast)
  textLight:   '#7A9FC6',      // Muted text
  border:      '#2A4264',      // Dark border (inky, subtle)
  shadow:      'rgba(0, 3, 12, 0.6)',  // Darker shadow
}
```

---

## 🎯 When to Use Each Colour

### **Primary Accent (`theme.orange` / `theme.orangeLight`)**
- **Use `theme.orange`** (solid) for:
  - Primary action buttons (`Button` variant="primary")
  - Active states (selected chip, active toggle)
  - Icon buttons in active state
  - Key affordances (AddFAB)
  - Loading spinners / progress indicators
  
- **Use `theme.orangeLight`** (tint) for:
  - Secondary buttons (`Button` variant="secondary")
  - Soft backgrounds for selected/active elements
  - Hint boxes / info cards
  - Disabled button tints
  - Chip backgrounds when selected

### **Success (`theme.green` / `theme.greenLight`)**
- **`theme.green`** – Success messages, confirmation badges, completion indicators
- **`theme.greenLight`** – Success backgrounds, confirmation banner backgrounds
- **Never use for primary actions** — green is reserved for "done" semantics

### **Text (`theme.text` / `theme.textLight`)**
- **`theme.text`** – All body text, labels, headings (primary content)
- **`theme.textLight`** – Secondary text, hints, captions, muted labels
- **Never hardcode text colours** — always use `useAppTheme()` hook

### **Background (`theme.cream` / `theme.white` / `theme.offWhite`)**
- **`theme.cream`** – Page background / ScrollView background
- **`theme.white`** – Elevated cards, modals, input fields (visually raised)
- **`theme.offWhite`** – Subtle backgrounds, empty list placeholders (inset feel)
- **Depth ladder**: offWhite (sunken) < cream (base) < white (raised)

### **Borders & Dividers (`theme.border`)**
- Card borders, TextInput borders, divider lines
- Automatically themed to match the active theme

### **Danger (`theme.danger` / `theme.dangerLight`)**
- **`theme.danger`** – Red buttons, error text, warning icons
- **`theme.dangerLight`** – Error backgrounds, warning banners
- **Always red, never theme-dependent** — danger has universal meaning

### **Neutral (`theme.neutral`)**
- Empty state circles (e.g., uncompleted habit rings)
- Backlog badges (task not yet scheduled)
- Disabled/locked UI elements
- "Shame-free" elements that don't imply good/bad

### **Gray (`theme.gray` / `theme.grayLight`)**
- **`theme.gray`** – Secondary icons, timestamps, disabled text
- **`theme.grayLight`** – Disabled backgrounds, subtle dividers, chip containers

### **Feature Colours** (NOT theme-dependent)
Located in `constants/theme.ts` → `FeatureColors`:
```typescript
task:    '#3A78E4'  // Task bubble icon colour
scan:    '#D97512'  // Receipt scanning / camera
habits:  '#27915F'  // Habit tracking
health:  '#DC3853'  // Health metrics
meals:   '#AF8D1D'  // Meal planning
shop:    '#2096B6'  // Shopping list
shared:  '#8260D2'  // Shared requests
focus:   '#E83A17'  // Focus / pomodoro
capture: '#D6399C'  // Quick capture
```

These **never change with theme** — they're used in the Bubble Menu and task-type indicators.

---

## 💡 Colour Usage Patterns

### Pattern 1: Theme-Aware Button
```tsx
import { useAppTheme } from '@/lib/useAppTheme';

export function MyButton() {
  const theme = useAppTheme();
  
  return (
    <Button 
      label="Save"
      onPress={save}
      variant="primary"  // Uses theme.orange automatically
    />
  );
}
```

### Pattern 2: Theme-Aware Text & Background
```tsx
<View style={{ backgroundColor: theme.cream }}>
  <Text style={{ color: theme.text }}>Primary text</Text>
  <Text style={{ color: theme.textLight }}>Secondary text</Text>
</View>
```

### Pattern 3: Status Badge with Theme
```tsx
<Badge 
  label="Completed"
  variant="success"  // Automatically uses theme.green
/>
```

### Pattern 4: Conditional Danger
```tsx
<Button
  label="Delete"
  variant="danger"  // Always red, never theme-dependent
  onPress={handleDelete}
/>
```

### Pattern 5: Feature Colour with Tinting
To tint a feature colour toward the active theme's accent:
```typescript
import { tintToTheme } from '@/constants/theme';

const taskColour = tintToTheme(FeatureColors.task, theme.orange);
// Result: task colour shifted toward the theme's primary accent
```

---

## 🎨 All Themes at a Glance

### Default (Blue)
- **Light**: `#F2F8FE` cream, `#2563EB` blue primary
- **Dark**: `#070C18` cream, `#5AABFF` blue primary
- **Vibe**: Clean, calm, focused — the default choice

### Tech (Cyan)
- **Light**: `#F0F5FC` cream, `#0EA5E9` cyan primary
- **Dark**: `#080E16` cream, `#3DBEF9` cyan primary
- **Vibe**: Modern, airy, smart — good for productivity focus

### Gothic (Purple)
- **Light**: `#F5F0FF` cream, `#7C3AED` purple primary
- **Dark**: `#0E0818` cream, `#B366F2` purple primary (true dark!)
- **Vibe**: Mysterious, introspective — best with dark mode

### Nature (Green)
- **Light**: `#F2FAF4` cream, `#16A34A` green primary
- **Dark**: `#08140A` cream, `#34D399` green primary
- **Vibe**: Grounded, organic — earthy and natural

### Fluffy (Pink)
- **Light**: `#FFF0F6` cream, `#EC4899` pink primary
- **Dark**: `#1A0612` cream, `#F580BE` pink primary
- **Vibe**: Playful, soft, gentle — fun and approachable

### Custom
- **User-controlled primary & secondary**
- Generated from user-chosen hex values at runtime
- Full colour palette derived automatically (`buildCustomTheme()`)

---

## 🔧 Accessing Colours in Code

### In Components (Recommended)
```typescript
import { useAppTheme } from '@/lib/useAppTheme';

export default function MyComponent() {
  const theme = useAppTheme();
  
  return (
    <View style={{ backgroundColor: theme.cream }}>
      <Text style={{ color: theme.text }}>Hello</Text>
    </View>
  );
}
```

### In Stores & Non-Component Code
```typescript
import { getTranslations } from '@/lib/i18n';

const currentLang = useSettingsStore.getState().language;
const t = getTranslations(currentLang);

// For colors in stores:
const theme = useSettingsStore.getState().theme;
const isDark = useSettingsStore.getState().darkMode;
import { getTheme } from '@/constants/theme';
const colors = getTheme(theme, isDark);
```

### Static / Non-Theme Colours
```typescript
import { FeatureColors } from '@/constants/theme';

const taskColour = FeatureColors.task;  // Always the same
const dangerColour = theme.danger;     // Always red
```

---

## 🎯 Colour Contrast & Accessibility

### WCAG Compliance
All text colours meet **WCAG AA contrast minimum** (4.5:1 for body text):
- `text` on `cream` background ✅
- `textLight` on `white` background ✅
- `white` text on `orange` background ✅

### Dynamic Contrast Helpers

**`contrastOn(hexBg: string)`** – Pick the best text colour for a background:
```typescript
import { contrastOn } from '@/constants/theme';

const bgColour = '#3A78E4';
const textColour = contrastOn(bgColour); // Returns '#FFFFFF' or '#1E293B' depending on contrast
```

**`contrastOnAll(hexBgs: string[])`** – Pick one text colour for multiple backgrounds:
```typescript
const bubbleColours = [FeatureColors.task, FeatureColors.habits, ...];
const labelColour = contrastOnAll(bubbleColours);
// Picks the colour (white or dark) that has the highest minimum contrast across ALL bubbles
```

---

## 🌙 Dark Mode Detection

```typescript
import { useAppTheme } from '@/lib/useAppTheme';

export function MyComponent() {
  const theme = useAppTheme();
  
  // Theme object changes based on user's dark mode setting
  // No need to check isDark explicitly — just use theme colours
  
  return <View style={{ backgroundColor: theme.cream }} />;
}
```

---

## 🎨 Custom Theme Builder

Users can create custom themes in Settings. The builder:
1. Accepts a primary colour (hex)
2. Accepts a secondary colour (hex)
3. Generates full palette automatically:
   - Light mode tints / shades
   - Dark mode inverses
   - All 18 semantic colours

**Built-in function**: `buildCustomTheme(primary: string, secondary: string, isDark: boolean)`

---

## 🚀 Adding a New Global Colour

If a new colour token is needed globally:

1. **Add to `AppColors` interface** (constants/theme.ts):
   ```typescript
   interface AppColors {
     // ... existing colours
     newColour: string;
   }
   ```

2. **Add to ALL theme definitions**:
   ```typescript
   THEMES.default = { ..., newColour: '#...' };
   THEMES.tech = { ..., newColour: '#...' };
   // ... repeat for all 6 themes
   DARK_THEMES.default = { ..., newColour: '#...' };
   // ... repeat for all 6 dark themes
   ```

3. **Add to buildCustomTheme()** for custom themes

4. **Access via `useAppTheme()`**:
   ```typescript
   const theme = useAppTheme();
   const myColour = theme.newColour;
   ```

---

## 🎓 Best Practices

✅ **DO:**
- Use `useAppTheme()` in all components
- Use semantic colour names (`theme.text`, `theme.danger`)
- Use `FeatureColors` for bubble/task accents
- Respect dark mode (use hook, not hardcoded hex)
- Test with all 6 themes + dark mode

❌ **DON'T:**
- Hardcode hex values in components (except FeatureColors)
- Ignore dark mode by using only light hex
- Use arbitrary colour names (`myBlue`, `highlight`)
- Mix theme-dependent and theme-independent colours without reason

---

## 📚 Further Reading

- **BUTTON_LIBRARY.md** – How buttons use theme colours
- **TYPOGRAPHY_LIBRARY.md** – Text colour hierarchy
- **ANIMATION_GUIDELINES.md** – Colour transitions & animations
- **DESIGN_SYSTEM_IMPLEMENTATION.md** – Full system overview
- Source: `constants/theme.ts`

---

**Last updated**: 2026-06-27  
**Themes available**: Default, Tech, Gothic, Nature, Fluffy, Custom  
**Dark mode**: Automatic via user settings
