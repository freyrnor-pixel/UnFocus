# Spacing & Layout Library

Complete reference for spacing scales, layout tokens, and common layout patterns. Ensures consistent rhythm and breathing room across all screens.

---

## 📐 Spacing Scale

All spacing from `constants/theme.ts` → `Spacing`:

```typescript
Spacing = {
  xs:  4,     // Micro spacing (tight, gaps between related elements)
  sm:  8,     // Small spacing (label-to-input, icon-to-text)
  md:  16,    // Medium spacing (standard padding, section gaps)
  lg:  24,    // Large spacing (between major sections)
  xl:  32,    // Extra large (large gaps, FAB positioning)
  xxl: 48,    // Extra extra large (rare, very large gaps)
}
```

### Visual Scale
```
xs   sm   md   lg   xl   xxl
4    8    16   24   32   48
|    |    |    |    |    |
·    ··   ····  ····· ······ ·······
```

---

## 🎯 When to Use Each Spacing

### Spacing.xs (4px)
- Micro gaps between tightly related elements
- Space between icon and text in a single affordance
- Padding on small elements
- Borderless dividers

**Example:**
```tsx
<View style={{ flexDirection: 'row', gap: Spacing.xs }}>
  <Ionicons name="heart" size={20} />
  <Text>Favorite</Text>
</View>
```

### Spacing.sm (8px)
- Space between label and input
- Padding inside small buttons
- Gap between form fields in tight contexts
- Horizontal padding in small pills/badges

**Example:**
```tsx
<View>
  <Text style={{ marginBottom: Spacing.sm }}>Name</Text>
  <Input placeholder="Enter name" />
</View>
```

### Spacing.md (16px)
- Standard section padding
- Gap between major content blocks
- Typical button padding (horizontal)
- Space between list items in close contexts

**Example:**
```tsx
<ScrollView style={{ padding: Spacing.md }}>
  {/* Content */}
</ScrollView>
```

### Spacing.lg (24px)
- Large gaps between major sections
- Screen edge margins
- Space between distinct feature areas
- Spacing in large layouts

**Example:**
```tsx
<View>
  <TaskSection />
  <View style={{ height: Spacing.lg }} />
  <HabitSection />
</View>
```

### Spacing.xl (32px)
- Extra-large section gaps (between major screens/areas)
- FAB positioning (`bottom: Spacing.xl + BOTTOM_NAV_HEIGHT`)
- Large vertical spacing for hierarchy
- Padding in expansive layouts

**Example:**
```tsx
<AddFAB onPress={add} bottom={Spacing.xl + BOTTOM_NAV_HEIGHT} />
```

### Spacing.xxl (48px)
- Rare, used for very large gaps
- Maximum screen padding in some contexts
- Breathing room in minimal layouts

---

## 🏗️ Layout Tokens

From `constants/theme.ts` → `Layout`:

```typescript
Layout = {
  cardPadding:  18,   // Standard card internal padding
  cardPaddingV: 18,   // Vertical padding in cards
  cardPaddingH: 16,   // Horizontal padding in cards
  cardGap:      14,   // Gap between elements inside cards
  maxVisible:   5,    // Items visible in a full list before scroll
}
```

### Layout.cardPadding / cardPaddingV / cardPaddingH (18 & 16)
Used for card, modal, and sheet internal padding:

```tsx
<View style={{ padding: Layout.cardPadding }}>
  {/* Card content with breathing room */}
</View>

// Or with different V/H:
<View style={{ 
  paddingVertical: Layout.cardPaddingV,
  paddingHorizontal: Layout.cardPaddingH,
}}>
  {/* Card content */}
</View>
```

### Layout.cardGap (14)
Gap between elements *inside* a card:

```tsx
<View style={{ gap: Layout.cardGap }}>
  <Text>Title</Text>
  <Text>Subtitle</Text>
  <Button label="Action" onPress={() => {}} />
</View>
```

### Layout.maxVisible (5)
How many items fit in a list before needing scroll. Used for:
- Planning scroll height
- Understanding list affordance
- Deciding when a list needs scroll vs. fits on screen

---

## 📏 Corner Radius Scale

From `constants/theme.ts` → `Radius`:

```typescript
Radius = {
  sm:   10,   // Small buttons, chips, modals
  md:   18,   // Cards, input fields, standard surfaces
  lg:   26,   // Large cards, large modals
  full: 999,  // Fully rounded pills (buttons, FABs)
}
```

### Radius.sm (10px)
- Small buttons, secondary elements
- Segmented control segments
- Chips, badges, small pills

```tsx
<View style={{ borderRadius: Radius.sm }}>
  <Chip label="Option" />
</View>
```

### Radius.md (18px)
- Standard cards
- Input fields
- Modals, sheets
- Most surfaces

```tsx
<View style={{ 
  borderRadius: Radius.md,
  backgroundColor: theme.white,
  padding: Layout.cardPadding,
}}>
  {/* Card content */}
</View>
```

### Radius.lg (26px)
- Large, prominent cards
- Large modals
- Emphasis surfaces

```tsx
<View style={{ 
  borderRadius: Radius.lg,
  backgroundColor: theme.white,
}}>
  {/* Large card */}
</View>
```

### Radius.full (999px)
- Fully rounded pills (no corners)
- Buttons, FABs, avatars, badges

```tsx
<Button label="Click me" style={{ borderRadius: Radius.full }} />
<AddFAB onPress={() => {}} />
<Avatar name="John Doe" />
```

---

## 🎨 Common Layout Patterns

### Pattern 1: Full-Screen Page with Padding
```tsx
<View style={{ flex: 1, backgroundColor: theme.cream }}>
  <ScrollView 
    style={{ padding: Spacing.md }}
    contentContainerStyle={{ gap: Layout.cardGap }}
  >
    {/* Content */}
  </ScrollView>
</View>
```

### Pattern 2: Stacked Sections
```tsx
<ScrollView>
  <View style={{ gap: Spacing.lg }}>
    <Section1 />
    <Section2 />
    <Section3 />
  </View>
</ScrollView>
```

### Pattern 3: Card with Internal Layout
```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: Radius.md,
  padding: Layout.cardPadding,
  gap: Layout.cardGap,
}}>
  <Text style={{ fontFamily: Fonts.bold }}>Card Title</Text>
  <Text>Card content with standard spacing</Text>
  <Button label="Action" onPress={() => {}} size="sm" />
</View>
```

### Pattern 4: Two-Column Layout
```tsx
<View style={{ flexDirection: 'row', gap: Spacing.md }}>
  <View style={{ flex: 1 }}>
    {/* Left column */}
  </View>
  <View style={{ flex: 1 }}>
    {/* Right column */}
  </View>
</View>
```

### Pattern 5: Icon + Text Row
```tsx
<View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
  <Ionicons name="checkmark" size={20} color={theme.green} />
  <Text>Completed</Text>
</View>
```

### Pattern 6: List with Spacing
```tsx
<View style={{ gap: Spacing.md }}>
  {items.map((item) => (
    <ListItem key={item.id} item={item} />
  ))}
</View>
```

### Pattern 7: Bottom Padding (Above FAB/BottomNav)
```tsx
<ScrollView>
  <View style={{ gap: Layout.cardGap, paddingBottom: Spacing.xxl + 56 }}>
    {/* Content with room for floating FAB */}
  </View>
</ScrollView>
<AddFAB onPress={handleAdd} />
```

### Pattern 8: Flex Row with Distribute
```tsx
<View style={{ 
  flexDirection: 'row', 
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: Spacing.md,
}}>
  <Text>Label</Text>
  <IconButton icon="gear" label="Settings" onPress={() => {}} />
</View>
```

---

## 🎯 Spacing Rules

### Rule 1: Use Tokens, Never Hardcode
✅ `marginBottom: Spacing.md`  
❌ `marginBottom: 16`

### Rule 2: Consistent Screen Padding
All scrollable screens:
```tsx
<ScrollView style={{ padding: Spacing.md }}>
  {/* Content is inset from screen edges */}
</ScrollView>
```

### Rule 3: Card Breathing Room
Cards always have internal breathing room:
```tsx
<View style={{ 
  padding: Layout.cardPadding,  // 18px all sides
  borderRadius: Radius.md,
}}>
  {/* Content inside is breathes naturally */}
</View>
```

### Rule 4: Section Separation
Major sections separated by `Spacing.lg`:
```tsx
<View style={{ gap: Spacing.lg }}>
  <SectionA />
  <SectionB />  {/* 24px gap */}
  <SectionC />
</View>
```

### Rule 5: FAB Clearance
Floating FABs account for BottomNav:
```tsx
<AddFAB bottom={Spacing.xl + BOTTOM_NAV_HEIGHT} />
// = 32 + 80 = 112px from bottom
```

---

## 📐 Depth Ladder (Z-Index-like)

While RN doesn't have z-index on all platforms, layering principle:

```
FAB / Modal overlay     (top)
Toast / Banner          
BottomNav / Header      
Cards                   
Page Background         (bottom)
```

Position FABs above scrollable content; toasts above everything.

---

## 🌀 Padding vs Margin

### Use Padding For:
- Internal breathing room inside containers
- Card/modal content inset
- Button internal spacing

```tsx
<View style={{ padding: Spacing.md }}>
  {/* Content breathes inside */}
</View>
```

### Use Margin For:
- Space *between* distinct elements
- Separating siblings
- Adjusting relative position

```tsx
<View style={{ marginBottom: Spacing.lg }}>
  {/* Creates gap to next element */}
</View>
```

---

## 🔧 Accessing Spacing in Code

```typescript
import { Spacing, Layout, Radius } from '@/constants/theme';

export function MyComponent() {
  return (
    <View style={{
      padding: Spacing.md,           // 16px padding
      gap: Spacing.sm,               // 8px gaps
      borderRadius: Radius.md,       // 18px corners
      marginBottom: Spacing.lg,      // 24px separation
    }}>
      {/* Content */}
    </View>
  );
}
```

---

## 🎯 Quick Reference Cheat Sheet

```
Use Spacing.xs (4)     for: icon-to-text gaps, micro elements
Use Spacing.sm (8)     for: label-to-input, small padding
Use Spacing.md (16)    for: screen padding, standard gaps
Use Spacing.lg (24)    for: section separation
Use Spacing.xl (32)    for: large gaps, FAB positioning
Use Spacing.xxl (48)   for: rare, very large gaps

Use Radius.sm (10)     for: small/secondary elements
Use Radius.md (18)     for: cards, inputs, modals
Use Radius.lg (26)     for: large cards, prominence
Use Radius.full (999)  for: buttons, FABs, avatars

Use Layout.cardPadding (18)  for: card internal spacing
Use Layout.cardGap (14)      for: gaps inside cards
Use Layout.maxVisible (5)    for: scroll affordance
```

---

## 📚 Further Reading

- **BUTTON_LIBRARY.md** – Button sizes & touch targets
- **COLOR_THEME_LIBRARY.md** – Visual separation with colour
- **CARD_CONTAINER_LIBRARY.md** – Card layout patterns
- Source: `constants/theme.ts` (Spacing, Layout, Radius)

---

**Last updated**: 2026-06-27  
**Spacing scale**: xs (4), sm (8), md (16), lg (24), xl (32), xxl (48)  
**Radius scale**: sm (10), md (18), lg (26), full (999)  
**Consistent rhythm**: Use tokens, never hardcode
