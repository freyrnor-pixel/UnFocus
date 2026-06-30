# Shadow & Elevation Library

Complete reference for shadow definitions, depth perception, and elevation levels in UnFocus. Shadows create visual hierarchy and guide user attention.

---

## 🌑 Shadow System

All shadows from `constants/theme.ts` → `Shadow`:

```typescript
Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,  // Android
  },
  cardHeavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 5,  // Android
  },
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 12,  // Android
  },
  // ... more (run constants/theme.ts to see all)
}
```

---

## 📊 Elevation Levels

UnFocus uses **3 main shadow levels**:

### Level 1: Card (Subtle)
**Use for**: Standard cards, light elevation  
```typescript
Shadow.card = {
  shadowOffset: { height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
}
```

**Effect**: Barely noticeable lift, suitable for content cards, list items

**Example:**
```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: Radius.md,
  padding: Layout.cardPadding,
  ...Shadow.card,  // Subtle shadow
}}>
  {/* Card content */}
</View>
```

### Level 2: Card Heavy (Prominent)
**Use for**: Emphasized cards, modals, focused surfaces  
```typescript
Shadow.cardHeavy = {
  shadowOffset: { height: 4 },
  shadowOpacity: 0.13,
  shadowRadius: 12,
  elevation: 5,
}
```

**Effect**: Clear, visible lift, creates strong separation

**Example:**
```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: Radius.lg,
  padding: Layout.cardPadding,
  ...Shadow.cardHeavy,  // Prominent shadow
}}>
  {/* Modal or emphasized content */}
</View>
```

### Level 3: FAB (Maximum)
**Use for**: Floating action buttons, attention-grabbing elements  
```typescript
Shadow.fab = {
  shadowOffset: { height: 6 },
  shadowOpacity: 0.22,
  shadowRadius: 16,
  elevation: 12,
}
```

**Effect**: Strong, dramatic lift, draws user attention

**Example:**
```tsx
<Pressable style={{
  width: 56,
  height: 56,
  borderRadius: Radius.full,
  backgroundColor: theme.orange,
  ...Shadow.fab,  // Dramatic shadow
}}>
  {/* FAB content */}
</Pressable>
```

---

## 🎯 When to Use Each Shadow

### Shadow.card
- List items
- Standard content cards
- Light emphasis
- Subtle layering

```tsx
{tasks.map(task => (
  <View key={task.id} style={{ ...Shadow.card }}>
    {/* Task item */}
  </View>
))}
```

### Shadow.cardHeavy
- Modal backgrounds
- Large content cards
- Emphasized sections
- Focused elements

```tsx
{isExpanded && (
  <View style={{ ...Shadow.cardHeavy }}>
    {/* Expanded section */}
  </View>
)}
```

### Shadow.fab
- Floating action buttons (AddFAB)
- Toast/banner notifications
- Overlays needing strong attention
- Floating controls

```tsx
<AddFAB onPress={handleAdd} />  {/* AddFAB uses Shadow.fab internally */}
```

---

## 🌓 Dark Mode Shadows

Shadows automatically adjust for dark mode via `theme.shadow`:

**Light mode**: `rgba(30,41,59,0.12)` — subtle grey shadow  
**Dark mode**: `rgba(0, 3, 12, 0.6)` — stronger dark shadow

The shadow's `shadowColor` stays `'#000'` in both modes, but the theme context makes it appear correct.

**No code change needed** — just use the shadow tokens and dark mode adaptation is automatic.

---

## 🔧 Elevation vs Shadow

React Native treats shadows differently on iOS vs Android:

- **iOS**: Uses `shadowOffset`, `shadowOpacity`, `shadowRadius`
- **Android**: Uses `elevation` (integer 0-24)

All shadow definitions include both:
```typescript
Shadow.card = {
  shadowColor: '#000',              // iOS
  shadowOffset: { width: 0, height: 2 },  // iOS
  shadowOpacity: 0.08,              // iOS
  shadowRadius: 8,                  // iOS
  elevation: 3,                     // Android
}
```

The tokens handle both platforms automatically.

---

## 🚫 Anti-Patterns

### ❌ Don't Mix Shadows
Don't use Shadow.fab on a list item—it's too strong:
```tsx
// BAD:
<View style={{ ...Shadow.fab }}>
  {/* Regular list item — too prominent */}
</View>

// GOOD:
<View style={{ ...Shadow.card }}>
  {/* List item with appropriate subtlety */}
</View>
```

### ❌ Don't Add Custom Shadows
Don't hardcode shadow values:
```tsx
// BAD:
<View style={{
  shadowColor: '#333',
  shadowOffset: { height: 3 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
  elevation: 4,
}}>
  {/* Inconsistent shadow */}
</View>

// GOOD:
<View style={{ ...Shadow.card }}>
  {/* Consistent, token-based shadow */}
</View>
```

### ❌ Don't Ignore Android
Always include `elevation` in shadow tokens (not just iOS `shadowOffset`):
```tsx
// BAD (iOS-only):
<View style={{
  shadowOffset: { height: 2 },  // Only works on iOS
  shadowOpacity: 0.1,
}}>
  {/* Android doesn't get shadow */}
</View>

// GOOD (platform-aware):
<View style={{ ...Shadow.card }}>  // Includes elevation
  {/* iOS and Android both get shadows */}
</View>
```

---

## 📐 Shadow Anatomy

Each shadow token contains:

| Property | Example | Purpose |
|----------|---------|---------|
| `shadowColor` | `'#000'` | Shadow hue (always black) |
| `shadowOffset` | `{ width: 0, height: 2 }` | Shadow direction (iOS) |
| `shadowOpacity` | `0.08` | Shadow strength / transparency (iOS) |
| `shadowRadius` | `8` | Shadow blur amount (iOS) |
| `elevation` | `3` | Shadow depth level (Android) |

### shadowOffset
- `width: 0` — shadow directly below (not offset left/right)
- `height: 2` — shadow 2pt below the element

### shadowOpacity
- Higher value = stronger shadow
- `0.08` (card) vs `0.22` (FAB)

### shadowRadius
- Blur amount in points
- Higher = softer, more diffuse shadow

### elevation
- Android elevation system (0-24)
- Roughly corresponds to shadow strength
- `3` for card, `12` for FAB

---

## 🎨 Visual Depth Hierarchy

```
FAB / Toast (elevation 12, opacity 0.22)
  ↑
  · Creates strong visual separation
  ↓
Modal / Heavy Card (elevation 5, opacity 0.13)
  ↑
  · Clear layering
  ↓
Standard Card (elevation 3, opacity 0.08)
  ↑
  · Subtle lift, content organization
  ↓
Page Background (no shadow)
```

---

## 💡 Common Patterns

### Pattern 1: Card with Subtle Shadow
```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: Radius.md,
  padding: Layout.cardPadding,
  ...Shadow.card,
}}>
  <Text>Card content</Text>
</View>
```

### Pattern 2: Modal with Heavy Shadow
```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: Radius.lg,
  padding: Layout.cardPadding,
  ...Shadow.cardHeavy,
}}>
  <Text style={{ fontSize: FontSize.lg, fontFamily: Fonts.bold }}>Modal Title</Text>
</View>
```

### Pattern 3: Floating Button
```tsx
<Pressable style={{
  width: 56,
  height: 56,
  borderRadius: Radius.full,
  backgroundColor: theme.orange,
  ...Shadow.fab,
}}>
  <Text>+</Text>
</Pressable>
```

### Pattern 4: Layered Cards (Z-Depth)
```tsx
<View>
  {/* Background card */}
  <View style={{ ...Shadow.card }}>
    <Text>Base layer</Text>
  </View>

  {/* Foreground card (more prominent) */}
  <View style={{ ...Shadow.cardHeavy, marginTop: -10 }}>
    <Text>Top layer</Text>
  </View>
</View>
```

---

## 🔍 Debugging Shadows

### iOS
- Use Xcode's Accessibility Inspector to inspect shadow properties
- Shadows visible in simulator immediately

### Android
- Shadows visible based on `elevation` value
- Use Android emulator or device for accurate testing
- Check if `elevation` is being set

### Cross-Platform Testing
Always test both platforms:
- iOS simulator
- Android emulator
- Physical devices if possible

---

## 🎯 Best Practices

✅ **DO:**
- Use the three shadow levels (card, cardHeavy, fab)
- Include both iOS (`shadowOffset`, etc.) and Android (`elevation`)
- Use tokens instead of hardcoding values
- Test on both platforms
- Respect visual hierarchy with shadow strength

❌ **DON'T:**
- Create custom shadow values
- Ignore Android elevation
- Use FAB shadow on regular cards
- Stack excessive shadows
- Forget to test cross-platform

---

## 🔧 Accessing Shadows in Code

```typescript
import { Shadow } from '@/constants/theme';

export function MyCard() {
  return (
    <View style={{
      backgroundColor: theme.white,
      borderRadius: Radius.md,
      padding: Layout.cardPadding,
      ...Shadow.card,  // Spread the shadow token
    }}>
      {/* Card content */}
    </View>
  );
}
```

---

## 📚 Further Reading

- **BUTTON_LIBRARY.md** – AddFAB uses Shadow.fab
- **CARD_CONTAINER_LIBRARY.md** – Card shadow patterns
- **COLOR_THEME_LIBRARY.md** – Shadow colours theme-aware
- Source: `constants/theme.ts` (Shadow definitions)

---

**Last updated**: 2026-06-27  
**Shadow levels**: card (3), cardHeavy (5), fab (12)  
**Cross-platform**: iOS (shadowOffset/Opacity/Radius) + Android (elevation)  
**Theme-aware**: shadows adapt to light/dark mode automatically
