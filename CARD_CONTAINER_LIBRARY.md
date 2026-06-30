# Card & Container Library

Complete reference for card patterns, containers, modals, sheets, and common surface layouts in UnFocus.

---

## 🎴 Card System

Cards are the primary content container. All cards share these principles:
- **Elevated surface** (`theme.white`)
- **Internal padding** (`Layout.cardPadding`: 18px)
- **Rounded corners** (`Radius.md`: 18px)
- **Subtle shadow** (`Shadow.card`)
- **Clear visual boundary** from background (`theme.cream`)

---

## 📋 Standard Card

### Basic Structure
```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: Radius.md,
  padding: Layout.cardPadding,
  ...Shadow.card,
}}>
  <Text style={{ fontSize: FontSize.lg, fontFamily: Fonts.bold }}>
    Card Title
  </Text>
  <Text style={{ 
    fontSize: FontSize.sm, 
    color: theme.textLight,
    marginTop: Spacing.xs,
  }}>
    Card content or description
  </Text>
</View>
```

### With Multiple Elements
```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: Radius.md,
  padding: Layout.cardPadding,
  gap: Layout.cardGap,
  ...Shadow.card,
}}>
  {/* Header */}
  <View>
    <Text style={{ fontSize: FontSize.lg, fontFamily: Fonts.bold }}>Title</Text>
  </View>

  {/* Content */}
  <Text style={{ fontSize: FontSize.md, color: theme.text }}>
    Main content goes here
  </Text>

  {/* Action */}
  <Button label="Action" onPress={() => {}} size="sm" />
</View>
```

---

## 🎨 Card Variants

### Variant 1: Simple Content Card
```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: Radius.md,
  padding: Layout.cardPadding,
  ...Shadow.card,
}}>
  <Text>Just text content, no special styling</Text>
</View>
```

### Variant 2: Card with Icon & Title
```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: Radius.md,
  padding: Layout.cardPadding,
  gap: Layout.cardGap,
  ...Shadow.card,
}}>
  <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
    <Ionicons name="checkmark-circle" size={24} color={theme.green} />
    <Text style={{ fontSize: FontSize.lg, fontFamily: Fonts.bold }}>Completed</Text>
  </View>
  <Text style={{ fontSize: FontSize.sm, color: theme.textLight }}>
    All tasks finished for today
  </Text>
</View>
```

### Variant 3: Card with Status Badge
```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: Radius.md,
  padding: Layout.cardPadding,
  gap: Layout.cardGap,
  ...Shadow.card,
}}>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
    <Text style={{ fontSize: FontSize.lg, fontFamily: Fonts.bold }}>Task Title</Text>
    <Badge label="In Progress" variant="warning" />
  </View>
  <Text style={{ fontSize: FontSize.sm, color: theme.textLight }}>
    Task description
  </Text>
</View>
```

### Variant 4: List Item Card (Clickable)
```tsx
<Pressable
  onPress={() => handlePress()}
  style={{
    backgroundColor: theme.white,
    borderRadius: Radius.md,
    padding: Layout.cardPadding,
    gap: Layout.cardGap,
    ...Shadow.card,
  }}
>
  <Text style={{ fontSize: FontSize.md, fontFamily: Fonts.semibold }}>
    Clickable Item
  </Text>
  <Text style={{ fontSize: FontSize.sm, color: theme.textLight }}>
    Secondary info
  </Text>
</Pressable>
```

---

## 🏗️ Container Patterns

### Pattern 1: Section Container
```tsx
<View style={{ gap: Spacing.md }}>
  <Text style={{ fontSize: FontSize.xl, fontFamily: Fonts.bold, paddingHorizontal: Spacing.md }}>
    Section Title
  </Text>
  
  <View style={{ paddingHorizontal: Spacing.md, gap: Layout.cardGap }}>
    {/* Multiple cards */}
    {items.map(item => (
      <Card key={item.id} item={item} />
    ))}
  </View>
</View>
```

### Pattern 2: Full-Width Card Group
```tsx
<View style={{ gap: Spacing.md }}>
  {items.map(item => (
    <View key={item.id} style={{ marginHorizontal: Spacing.md }}>
      <Card item={item} />
    </View>
  ))}
</View>
```

### Pattern 3: Inset Card (Edges Have Breathing Room)
```tsx
<View style={{ padding: Spacing.md }}>
  <View style={{
    backgroundColor: theme.white,
    borderRadius: Radius.md,
    padding: Layout.cardPadding,
    ...Shadow.card,
  }}>
    {/* Content inset from screen edges */}
  </View>
</View>
```

### Pattern 4: Edge-to-Edge Card (No Horizontal Padding)
```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: 0,  // Straight edges
  padding: Layout.cardPaddingV,  // Vertical padding only
  ...Shadow.card,
}}>
  <Text>Card extends to screen edges</Text>
</View>
```

---

## 🔷 Large Card / Prominent Surface

For emphasized content, use `Radius.lg` and `Shadow.cardHeavy`:

```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: Radius.lg,  // Larger corners
  padding: Layout.cardPadding,
  gap: Layout.cardGap,
  ...Shadow.cardHeavy,  // Stronger shadow
}}>
  <Text style={{ fontSize: FontSize.xxl, fontFamily: Fonts.bold }}>
    Featured Content
  </Text>
  <Text style={{ fontSize: FontSize.md, color: theme.text }}>
    This content is emphasized and elevated
  </Text>
  <Button label="Action" onPress={() => {}} variant="primary" />
</View>
```

---

## 🗂️ Modal Pattern

Modals use the same card styling with enhanced elevation:

```tsx
<View style={{
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0,0,0,0.5)',  // Dim background
}}>
  <View style={{
    backgroundColor: theme.white,
    borderRadius: Radius.lg,
    padding: Layout.cardPadding,
    gap: Layout.cardGap,
    maxWidth: '90%',
    ...Shadow.cardHeavy,  // Heavy shadow for prominence
  }}>
    {/* Modal header */}
    <Text style={{ fontSize: FontSize.lg, fontFamily: Fonts.bold }}>
      Modal Title
    </Text>

    {/* Modal content */}
    <Text style={{ fontSize: FontSize.md }}>
      Modal content goes here
    </Text>

    {/* Modal actions */}
    <View style={{ flexDirection: 'row', gap: Spacing.md }}>
      <Button 
        label="Cancel" 
        onPress={() => closeModal()} 
        variant="secondary"
        style={{ flex: 1 }}
      />
      <Button 
        label="Confirm" 
        onPress={() => handleAction()} 
        variant="primary"
        style={{ flex: 1 }}
      />
    </View>
  </View>
</View>
```

---

## 📄 Bottom Sheet Pattern

Bottom sheets slide from the bottom, often used for quick actions:

```tsx
{/* Bottom sheet container */}
<View style={{
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: theme.white,
  borderTopLeftRadius: Radius.lg,
  borderTopRightRadius: Radius.lg,
  paddingTop: Layout.cardPadding,
  paddingHorizontal: Layout.cardPaddingH,
  paddingBottom: Spacing.lg + Layout.cardPadding,
  ...Shadow.cardHeavy,
}}>
  {/* Header */}
  <View style={{ marginBottom: Layout.cardGap }}>
    <Text style={{ fontSize: FontSize.lg, fontFamily: Fonts.bold }}>
      Sheet Title
    </Text>
  </View>

  {/* Options */}
  <View style={{ gap: Spacing.sm }}>
    <Button label="Option 1" onPress={() => {}} variant="ghost" />
    <Button label="Option 2" onPress={() => {}} variant="ghost" />
    <Button label="Option 3" onPress={() => {}} variant="ghost" />
  </View>
</View>
```

---

## 💡 Content Surface Patterns

### Pattern 1: Card with Divider
```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: Radius.md,
  overflow: 'hidden',
  ...Shadow.card,
}}>
  {/* Section 1 */}
  <View style={{ padding: Layout.cardPadding }}>
    <Text style={{ fontSize: FontSize.md }}>Section 1</Text>
  </View>

  {/* Divider */}
  <View style={{ 
    height: 1, 
    backgroundColor: theme.border,
    marginHorizontal: Layout.cardPaddingH,
  }} />

  {/* Section 2 */}
  <View style={{ padding: Layout.cardPadding }}>
    <Text style={{ fontSize: FontSize.md }}>Section 2</Text>
  </View>
</View>
```

### Pattern 2: Card with Background Tint
```tsx
<View style={{
  backgroundColor: theme.orangeLight,  // Tinted background
  borderRadius: Radius.md,
  padding: Layout.cardPadding,
  gap: Layout.cardGap,
  ...Shadow.card,
}}>
  <Text style={{ fontSize: FontSize.md, fontFamily: Fonts.semibold }}>
    Hint or Info Box
  </Text>
  <Text style={{ fontSize: FontSize.sm, color: theme.brown }}>
    Additional context or guidance
  </Text>
</View>
```

### Pattern 3: Overlay/Alert Card
```tsx
<View style={{
  backgroundColor: theme.dangerLight,  // Error tint
  borderRadius: Radius.md,
  borderLeftWidth: 4,
  borderLeftColor: theme.danger,
  padding: Layout.cardPadding,
  gap: Spacing.sm,
  ...Shadow.card,
}}>
  <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' }}>
    <Ionicons name="warning" size={20} color={theme.danger} />
    <Text style={{ flex: 1, fontSize: FontSize.md, fontFamily: Fonts.bold }}>
      Warning
    </Text>
  </View>
  <Text style={{ fontSize: FontSize.sm, color: theme.text }}>
    This is an important alert or warning message
  </Text>
</View>
```

---

## 🎯 Depth Ladder Example

```
Toast / Modal Overlay
  ↑ Shadow.cardHeavy
  ↓
Prominent Card (Radius.lg)
  ↑ Shadow.card
  ↓
Standard Card (Radius.md)
  ↑ Shadow.card
  ↓
Page Background (theme.cream)
```

---

## 🔧 Reusable Card Component

Common pattern—extract into a component:

```tsx
export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  prominent?: boolean;
  tint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({ 
  children, 
  onPress, 
  prominent = false,
  tint,
  style 
}: CardProps) {
  const theme = useAppTheme();
  
  const Component = onPress ? Pressable : View;

  return (
    <Component
      onPress={onPress}
      style={{
        backgroundColor: tint ?? theme.white,
        borderRadius: prominent ? Radius.lg : Radius.md,
        padding: Layout.cardPadding,
        ...(prominent ? Shadow.cardHeavy : Shadow.card),
        ...style,
      }}
    >
      {children}
    </Component>
  );
}

// Usage:
<Card>
  <Text>Simple card</Text>
</Card>

<Card prominent tint={theme.orangeLight}>
  <Text>Prominent card with tint</Text>
</Card>

<Card onPress={() => navigate()}>
  <Text>Clickable card</Text>
</Card>
```

---

## 🌓 Dark Mode

Cards automatically adapt to dark mode:
```tsx
// Light mode: white background on cream page
// Dark mode: dark white (#18243E) on dark cream (#070C18)

<View style={{
  backgroundColor: theme.white,  // Adapts to dark mode
  ...Shadow.card,                // Shadow adapts to dark mode
}}>
  {/* Content */}
</View>
```

---

## 🎯 Best Practices

✅ **DO:**
- Use `Layout.cardPadding` for consistency
- Use `Radius.md` for standard cards
- Use `Shadow.card` for elevation
- Use `theme.white` for elevated surfaces
- Pair card background with appropriate text colour
- Test cards on dark mode

❌ **DON'T:**
- Hardcode padding (use Layout tokens)
- Use inconsistent shadows on cards
- Forget to pair background with readable text colour
- Stack excessive shadows
- Ignore safe area padding in sheets/modals

---

## 📚 Further Reading

- **SHADOW_ELEVATION_LIBRARY.md** – Shadow patterns
- **SPACING_LAYOUT_LIBRARY.md** – Padding & margins
- **COLOR_THEME_LIBRARY.md** – Background & text colour
- **BUTTON_LIBRARY.md** – Buttons inside cards

---

**Last updated**: 2026-06-27  
**Standard padding**: Layout.cardPadding (18px)  
**Standard radius**: Radius.md (18px)  
**Standard shadow**: Shadow.card  
**Surface colour**: theme.white (adapts to dark mode)
