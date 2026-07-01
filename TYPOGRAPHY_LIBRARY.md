# Typography Library

Complete reference for text styles, fonts, sizes, weights, and hierarchy in UnFocus. Ensures consistent, accessible, and beautiful typography across all screens.

---

## 🔤 Font Family

UnFocus uses **Nunito** — a geometric, rounded sans-serif family:

| Weight | Name | Token | Use Case |
|--------|------|-------|----------|
| 400 | Regular | `Fonts.regular` | Body text, default |
| 500 | Medium | `Fonts.medium` | Slightly emphasized text |
| 600 | SemiBold | `Fonts.semibold` | Labels, secondary headings |
| 700 | Bold | `Fonts.bold` | Primary headings, buttons, emphasis |
| 800 | ExtraBold | `Fonts.extrabold` | Hero text, prominent headings |

**Loaded in**: `app/_layout.tsx` via expo-font  
**Default**: `Fonts.regular` set as global Text default

---

## 📏 Font Sizes

All sizes from `constants/theme.ts` → `FontSize`:

```typescript
FontSize = {
  xs:   12,      // Captions, timestamps, hints (smallest)
  sm:   14,      // Secondary text, labels
  md:   16,      // Body text (standard, minimum for readability)
  lg:   18,      // Larger body, section headers
  xl:   22,      // Prominent headers
  xxl:  28,      // Screen titles
  hero: 36,      // Hero text, very large headings
}
```

### Accessibility Rule
- **Body text is never below 16px** (`FontSize.md` minimum)
- **Secondary/caption text is never below 14px** (`FontSize.sm` minimum)

---

## 📊 Text Hierarchy

### Level 1: Hero Text (36px, ExtraBold)
**Use**: Screen hero, onboarding title, major section intro  
```tsx
<Text style={{ fontSize: FontSize.hero, fontFamily: Fonts.extrabold }}>
  Welcome back!
</Text>
```

### Level 2: Screen Title (28px, Bold)
**Use**: Screen headers, section title with background  
```tsx
<Text style={{ fontSize: FontSize.xxl, fontFamily: Fonts.bold }}>
  My Habits
</Text>
```

### Level 3: Section Header (22px, Bold)
**Use**: Major content group headers  
```tsx
<Text style={{ fontSize: FontSize.xl, fontFamily: Fonts.bold }}>
  Today's Tasks
</Text>
```

### Level 4: Subheader (18px, SemiBold)
**Use**: Smaller section groups, card titles  
```tsx
<Text style={{ fontSize: FontSize.lg, fontFamily: Fonts.semibold }}>
  Morning Routine
</Text>
```

### Level 5: Body Text (16px, Regular)
**Use**: Primary content, list items, descriptions  
```tsx
<Text style={{ fontSize: FontSize.md, fontFamily: Fonts.regular }}>
  This is your main content. Keep it readable and clear.
</Text>
```

### Level 6: Secondary Text (14px, Regular)
**Use**: Labels, metadata, hints, secondary info  
```tsx
<Text style={{ fontSize: FontSize.sm, fontFamily: Fonts.regular, color: theme.textLight }}>
  Last updated 2 hours ago
</Text>
```

### Level 7: Caption / Hint (12px, Regular)
**Use**: Timestamps, tiny labels, inline hints  
```tsx
<Text style={{ fontSize: FontSize.xs, color: theme.textLight }}>
  Jan 15, 2026
</Text>
```

---

## 🎯 When to Use Each Font Weight

### Regular (400)
- Body paragraphs
- List item labels
- Default button text (optional—buttons often use bold)
- Descriptions

### Medium (500)
- Slightly emphasized labels
- Secondary button text (occasional)
- Input labels (with semibold variants)

### SemiBold (600)
- Form labels
- Secondary headings
- Chip/badge labels
- Card titles
- Buttons (common choice for standard buttons)

### Bold (700)
- Primary headings
- Button labels (standard for calls-to-action)
- Emphasis within body text
- Screen titles
- Important labels

### ExtraBold (800)
- Hero text
- Very prominent headings
- Onboarding titles
- Large display text

---

## 🎨 Text Styles with Colours

### Primary Text
```typescript
{
  color: theme.text,              // High contrast, readable
  fontSize: FontSize.md,          // 16px minimum
  fontFamily: Fonts.regular,      // Default
}
```

### Secondary Text (Muted, Hints)
```typescript
{
  color: theme.textLight,         // Lighter, less prominent
  fontSize: FontSize.sm,          // 14px min for secondary
  fontFamily: Fonts.regular,      // Often with medium/semibold
}
```

### Strong Emphasis
```typescript
{
  color: theme.text,              // Same as primary
  fontSize: FontSize.md,
  fontFamily: Fonts.bold,         // Weight is the emphasis
}
```

### Label (Form, Button)
```typescript
{
  color: theme.text,
  fontSize: FontSize.md,
  fontFamily: Fonts.semibold,     // Labels often semibold
}
```

### Captions & Timestamps
```typescript
{
  color: theme.textLight,         // Muted
  fontSize: FontSize.xs,          // 12px
  fontFamily: Fonts.regular,
}
```

### Error / Danger
```typescript
{
  color: theme.danger,            // Red
  fontSize: FontSize.md,          // Same size as context
  fontFamily: Fonts.regular,      // Or bold if emphasis needed
}
```

---

## 📱 Responsive Font Scaling

UnFocus supports user-controlled font size preference: `small`, `default`, `large`.

### Using Scaled Fonts
```typescript
import { useScaledStyles } from '@/lib/useAppTheme';

const baseStyles = StyleSheet.create({
  heading: { fontSize: 22 },
  body: { fontSize: 16 },
});

export function MyScreen() {
  const styles = useScaledStyles(baseStyles);
  return <Text style={styles.body}>Text scales with user preference</Text>;
}
```

### How It Works
```typescript
// Scaling factors:
const fontScaleMap = { small: 0.875, default: 1, large: 1.2 };

// So if user chooses "large":
// FontSize.md (16px) → 16 * 1.2 = 19.2px
// FontSize.hero (36px) → 36 * 1.2 = 43.2px
```

---

## 🔤 Line Height & Spacing

### Line Height (Implicit)
React Native defaults to tight line height. For multi-line text, consider:
```tsx
<Text
  style={{
    fontSize: FontSize.md,
    lineHeight: FontSize.md * 1.5,  // 24px line height for 16px text
  }}
>
  Multi-line body text with generous spacing for readability.
</Text>
```

### Letter Spacing
Rarely used, but available:
```tsx
<Text style={{ letterSpacing: 0.5 }}>
  Subtle spacing for labels
</Text>
```

---

## 📝 Common Text Patterns

### Screen Title with Header
```tsx
<View style={{ backgroundColor: theme.cream, padding: Spacing.md }}>
  <Text style={{ fontSize: FontSize.xxl, fontFamily: Fonts.bold, color: theme.text }}>
    My Habits
  </Text>
</View>
```

### List Item with Primary + Secondary
```tsx
<View>
  <Text style={{ fontSize: FontSize.md, fontFamily: Fonts.regular, color: theme.text }}>
    Morning Walk
  </Text>
  <Text style={{ fontSize: FontSize.sm, fontFamily: Fonts.regular, color: theme.textLight }}>
    7 days this week
  </Text>
</View>
```

### Button Label
```tsx
<Text style={{ 
  fontSize: FontSize.md, 
  fontFamily: Fonts.bold,  // Bold for buttons
  color: '#FFFFFF',        // Contrasted with background
}}>
  Save
</Text>
```

### Form Label
```tsx
<Text style={{ 
  fontSize: FontSize.sm, 
  fontFamily: Fonts.semibold,
  color: theme.textLight,
  marginBottom: Spacing.xs,
}}>
  Your Name
</Text>
```

### Caption / Timestamp
```tsx
<Text style={{ 
  fontSize: FontSize.xs, 
  fontFamily: Fonts.regular,
  color: theme.textLight,
}}>
  Jan 15, 7:30 AM
</Text>
```

### Empty State Message
```tsx
<Text style={{ 
  fontSize: FontSize.lg, 
  fontFamily: Fonts.semibold,
  color: theme.textLight,
  textAlign: 'center',
}}>
  No tasks yet. Add one to get started!
</Text>
```

### Error Message
```tsx
<Text style={{ 
  fontSize: FontSize.sm, 
  fontFamily: Fonts.regular,
  color: theme.danger,
  marginTop: Spacing.xs,
}}>
  This field is required
</Text>
```

---

## ✨ Text Effects

### Strikethrough (Completed Task)
```tsx
<Text style={{ textDecorationLine: 'line-through', color: theme.textLight }}>
  Completed item
</Text>
```

### Underline (Link)
```tsx
<Text style={{ textDecorationLine: 'underline', color: theme.orange }}>
  Tap to open
</Text>
```

### Opacity (Disabled)
```tsx
<Text style={{ opacity: 0.5, color: theme.text }}>
  Disabled text
</Text>
```

---

## 🌓 Dark Mode Text

Text colours automatically adjust via `useAppTheme()`:
- Light mode: `#142545` (dark text on light background)
- Dark mode: `#DDE9FB` (light text on dark background)

No special handling needed—just use `theme.text` and it adapts.

---

## 🎯 Best Practices

✅ **DO:**
- Use semantic font sizes (`FontSize.md`, not `16`)
- Use semantic weights (`Fonts.bold`, not `fontWeight: '700'`)
- Use semantic colours (`theme.text`, not hardcoded hex)
- Respect the 16px minimum for body text
- Scale responsive text for accessibility
- Use line height for multi-line text clarity

❌ **DON'T:**
- Hardcode font sizes (12, 18, 24) — use tokens
- Hardcode font families (except in special cases)
- Use body text smaller than 16px
- Ignore dark mode text colours
- Mix font sources (only Nunito)

---

## 📊 Text Hierarchy Cheat Sheet

```
Hero (36px, ExtraBold)
  ↓
Screen Title (28px, Bold)
  ↓
Section Header (22px, Bold)
  ↓
Subheader (18px, SemiBold)
  ↓
Body Text (16px, Regular) ← Standard
  ↓
Secondary (14px, Regular) ← Muted
  ↓
Caption (12px, Regular) ← Hints/Timestamps
```

---

## 🔧 Accessing Typography in Code

### In Components
```typescript
import { FontSize, Fonts } from '@/constants/theme';
import { useAppTheme } from '@/lib/useAppTheme';

export function MyComponent() {
  const theme = useAppTheme();
  
  return (
    <Text style={{ 
      fontSize: FontSize.md,
      fontFamily: Fonts.bold,
      color: theme.text,
    }}>
      My Text
    </Text>
  );
}
```

### Responsive Scaling
```typescript
import { useScaledStyles } from '@/lib/useAppTheme';

const baseStyles = StyleSheet.create({
  title: { fontSize: FontSize.xxl },
  body: { fontSize: FontSize.md },
});

export function MyScreen() {
  const styles = useScaledStyles(baseStyles);
  return <Text style={styles.body}>Scales with user preference</Text>;
}
```

---

## 📚 Further Reading

- **COLOR_THEME_LIBRARY.md** – Text colour palette
- **SPACING_LAYOUT_LIBRARY.md** – Spacing around text
- **BUTTON_LIBRARY.md** – Button text styling
- Source: `constants/theme.ts` (FontSize, Fonts)

---

**Last updated**: 2026-06-27  
**Font**: Nunito (rounded, geometric)  
**Min body**: 16px  
**Min secondary**: 14px  
**User-scalable**: small (0.875×), default (1×), large (1.2×)
