# UnFocus Button & Interactive Components Library

A complete reference guide for all reusable button and interactive components in UnFocus. Use this when creating new sites, adding features, or maintaining consistent UI patterns.

---

## 📋 Quick Reference Table

| Component | Type | File | Use Case |
|-----------|------|------|----------|
| **Button** | Action Button | `components/Button.tsx` | Primary actions, varied sizes & variants |
| **AddFAB** | Floating Action | `components/AddFAB.tsx` | "Add new entity" (orange +) floating button |
| **IconButton** | Icon-only Button | `components/IconButton.tsx` | Header actions, toggles, icon controls |
| **SaveButton** | Inline Button | `components/SaveButton.tsx` | Inline save trigger (animates in when dirty) |
| **Checkbox** | Form Control | `components/FormControls.tsx` | Binary on/off selection |
| **Switch** | Form Control | `components/FormControls.tsx` | Toggle switch (native with theme) |
| **SegmentedControl** | Form Control | `components/FormControls.tsx` | Multiple option selector (tab-like) |
| **Input** | Form Control | `components/FormControls.tsx` | Text/number input with label & error |
| **Badge** | Status Pill | `components/Badge.tsx` | Non-interactive status labels |
| **Chip** | Filter Pill | `components/Badge.tsx` | Selectable/toggleable filter option |
| **Avatar** | Initials Circle | `components/Badge.tsx` | User/member initials display |
| **SwatchPicker** | Selector | `components/SwatchPicker.tsx` | Circular option picker (theme/material) |
| **ConfirmationBanner** | Toast/Overlay | `components/ConfirmationBanner.tsx` | Auto-dismissing confirmation message |

---

## 🎨 Detailed Component Guide

### 1. Button Component
**File:** `components/Button.tsx`  
**Purpose:** Soft, rounded action button with multiple variants and sizes.

#### Props
```typescript
{
  label: string;                    // Button text (sentence case, required)
  onPress: () => void;              // Callback when pressed
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';  // default: 'primary'
  size?: 'sm' | 'md' | 'lg';        // default: 'md' (44-48px height)
  icon?: Ionicons.glyphMap key;     // Leading icon
  iconRight?: Ionicons.glyphMap key; // Trailing icon
  disabled?: boolean;               // Disabled state (opacity 0.45)
  loading?: boolean;                // Loading spinner (disables button)
  style?: StyleProp<ViewStyle>;     // Custom styles
}
```

#### Variants & Sizes

**Variants:**
- **primary** (default) – Orange fill, white text. Use for primary actions.
- **secondary** – Light orange tint fill, brown text. Use for secondary actions.
- **danger** – Red fill, white text. Use for destructive actions (delete, clear).
- **ghost** – Transparent, orange text. Use for lightweight/tertiary actions.

**Sizes:**
- **sm** – 36px height, small font, tight padding. For secondary/tertiary uses.
- **md** – 48px height, regular font. Standard choice (exceeds 44px minimum).
- **lg** – 56px height, large font, generous padding. For prominent primary actions.

#### Touch Target
- **sm**: 36px (inset slightly; minimum 44px achieved via parent layout).
- **md, lg**: 44–56px (both exceed 44px minimum).

#### Examples
```tsx
// Primary action
<Button label="Save" onPress={handleSave} variant="primary" size="md" />

// With icon
<Button
  label="Delete"
  onPress={handleDelete}
  variant="danger"
  size="md"
  icon="trash"
/>

// Trailing icon
<Button
  label="Next"
  onPress={next}
  variant="primary"
  iconRight="chevron-forward"
/>

// Loading state
<Button label="Saving..." onPress={() => {}} loading variant="primary" />

// Ghost (tertiary)
<Button label="Learn more" onPress={openDocs} variant="ghost" />
```

---

### 2. AddFAB (Floating Action Button)
**File:** `components/AddFAB.tsx`  
**Purpose:** Shared orange "+" button for "add new" actions across all sites. Consistent shape and colour everywhere.

#### Props
```typescript
{
  onPress: () => void;              // Required callback
  size?: 'lg' | 'sm';               // default: 'lg'
  bottom?: number;                  // Only for 'lg'; custom Y position
  style?: StyleProp<ViewStyle>;     // Custom styles
}
```

#### Sizes
- **lg** – 56px floating button, bottom-right above BottomNav. Use for screen-level "add new".
- **sm** – 32px inline button for use inside rows/headers. Use for section-level "add new".

#### Exported Constants
```typescript
FAB_LG_SIZE = 56;        // For layout calculations
FAB_DEFAULT_BOTTOM = Spacing.xl + BOTTOM_NAV_HEIGHT;
```

#### Usage Notes
- **Always orange** (`theme.orange`); no variants.
- Use `bottom` prop to adjust floating position if screen has extra sticky footer.
- See `app/shopping.tsx` for example of stacking with extra footer content.

#### Examples
```tsx
// Screen-level floating "add new" task
<AddFAB onPress={() => router.push('/task-form')} />

// With custom bottom spacing
<AddFAB onPress={handleAdd} bottom={Spacing.xl + BOTTOM_NAV_HEIGHT + 80} />

// Inline small button in a header
<AddFAB onPress={handleAdd} size="sm" />

// Override position entirely
<AddFAB onPress={handleAdd} style={{ position: 'absolute', right: 16, top: 100 }} />
```

---

### 3. IconButton Component
**File:** `components/IconButton.tsx`  
**Purpose:** Circular icon-only button for compact controls (header actions, toggles, etc.).

#### Props
```typescript
{
  icon: Ionicons.glyphMap key;      // Icon name (required)
  label: string;                    // Accessibility label (required)
  onPress: () => void;              // Callback (required)
  size?: number;                    // Button size (default: 36). Icon = 50% of size.
  tint?: string;                    // Background override (default: theme.offWhite)
  color?: string;                   // Icon colour override
  active?: boolean;                 // Active state (orange bg + border)
  disabled?: boolean;               // Disabled state
  style?: StyleProp<ViewStyle>;     // Custom styles
}
```

#### Touch Target
- Hit target always ≥44px (auto-expanded via Pressable wrapper).
- Visual button size is controlled by `size` prop.

#### Active State
When `active={true}`:
- Background: `theme.orangeLight`
- Border: 1.5px `theme.orange`
- Icon colour: `theme.orange`
- Accessible as `selected: true`

#### Examples
```tsx
// Header action (settings, info)
<IconButton icon="cog" label="Settings" onPress={() => router.push('/settings')} />

// Active toggle
<IconButton
  icon="heart"
  label="Favourite"
  onPress={toggleFavourite}
  active={isFavourite}
/>

// Custom colour
<IconButton
  icon="trash"
  label="Delete"
  onPress={handleDelete}
  color={theme.danger}
  tint={theme.dangerLight}
/>

// Small custom button
<IconButton icon="close" label="Close" onPress={close} size={28} />
```

---

### 4. SaveButton Component
**File:** `components/SaveButton.tsx`  
**Purpose:** Inline, animated save button that appears when input is dirty.

#### Props
```typescript
{
  visible: boolean;                 // Show/hide button (controls animation)
  onPress: () => void;              // Save callback (required)
  label?: string;                   // Button text (default: 'Lagre')
  theme?: AppColors;                // Theme override for background
}
```

#### Animation
- **Duration**: 150ms
- **In**: opacity 0→1, scale 0.92→1
- **Out**: opacity 1→0, scale 1→0.92
- **Easing**: Linear (ease)

#### Styling
- Height: 34px (small)
- BorderRadius: 8px
- Background: `theme.orange` (or override via `theme` prop)
- Text: white, 500 weight, 13px font
- HitSlop: 6px (generous touch area)

#### Usage Pattern
```tsx
const [value, setValue] = useState('');
const [dirty, setDirty] = useState(false);

const handleSave = () => {
  // Save to store/db
  setDirty(false);
};

return (
  <View style={styles.inputRow}>
    <TextInput
      value={value}
      onChangeText={(v) => {
        setValue(v);
        setDirty(true);
      }}
    />
    <SaveButton visible={dirty} onPress={handleSave} />
  </View>
);
```

#### Used In
- `app/settings.tsx` – name input, monthly date, budget, reminder time
- Any screen with inline editable text fields

---

### 5. Checkbox Component
**File:** `components/FormControls.tsx`  
**Purpose:** Themed checkbox with optional label.

#### Props
```typescript
{
  checked: boolean;                 // Controlled state (required)
  onChange: (next: boolean) => void; // Update callback (required)
  label?: string;                   // Optional text label
  disabled?: boolean;               // Disabled state
}
```

#### Appearance
- Checked: Orange (`theme.orange`) filled, white checkmark
- Unchecked: Transparent, bordered (`theme.border`)
- Label: Gray text (`theme.text`)
- Size: 24×24px box
- Touch target: ≥44px (flex row)

#### Example
```tsx
const [agreed, setAgreed] = useState(false);

<Checkbox
  checked={agreed}
  onChange={setAgreed}
  label="I agree to the terms"
/>
```

---

### 6. Switch Component
**File:** `components/FormControls.tsx`  
**Purpose:** Native OS switch with themed track and thumb.

#### Props
```typescript
{
  checked: boolean;                 // Controlled state (required)
  onChange: (next: boolean) => void; // Update callback (required)
  disabled?: boolean;               // Disabled state
}
```

#### Theming
- **Off track**: `theme.grayLight`
- **On track**: `theme.orangeLight`
- **Off thumb**: white
- **On thumb**: `theme.orange`

#### Example
```tsx
const [notificationsEnabled, setNotificationsEnabled] = useState(true);

<Switch checked={notificationsEnabled} onChange={setNotificationsEnabled} />
```

---

### 7. SegmentedControl Component
**File:** `components/FormControls.tsx`  
**Purpose:** Tab-like control for selecting one option from multiple.

#### Props
```typescript
{
  options: { value: string; label: string }[]; // Required
  value: string;                    // Current selection (required)
  onChange: (next: string) => void; // Update callback (required)
  style?: StyleProp<ViewStyle>;     // Custom styles
}
```

#### Appearance
- Container: Gray background (`theme.grayLight`), rounded corners
- Inactive segment: Transparent text
- Active segment: White background, shadow, darker text
- Touch target: ≥44px

#### Notes
- **Label localization**: Options must already be localized by caller (use `useT()`).
- **Design**: Segments flex equally; container padding 4px around segments.

#### Example
```tsx
const t = useT();
const [workMode, setWorkMode] = useState('pomodoro');

<SegmentedControl
  options={[
    { value: 'pomodoro', label: t.nav.pomodoro },
    { value: 'free', label: t.nav.freeForm },
  ]}
  value={workMode}
  onChange={setWorkMode}
/>
```

---

### 8. Input Component
**File:** `components/FormControls.tsx`  
**Purpose:** Text input with optional label and error message.

#### Props
```typescript
{
  label?: string;                   // Optional label above input
  error?: string;                   // Optional error message below input
  ...TextInputProps                 // All standard RN TextInput props
}
```

#### Appearance
- **Input**: 44px height min, rounded corners (`theme.border` or danger-red border if error)
- **Label**: Gray text above, small font
- **Error**: Red text below input (if `error` prop provided)
- **Placeholder**: Gray text (`theme.textLight`)

#### Example
```tsx
const [name, setName] = useState('');
const [error, setError] = useState('');

<Input
  label="Your name"
  value={name}
  onChangeText={setName}
  placeholder="Enter name"
  error={error ? 'Name is required' : undefined}
/>
```

---

### 9. Badge Component
**File:** `components/Badge.tsx`  
**Purpose:** Non-interactive status pill (label only, no action).

#### Props
```typescript
{
  label: string;                    // Text (required)
  variant?: 'neutral' | 'success' | 'warning' | 'danger';  // default: 'neutral'
  style?: StyleProp<ViewStyle>;     // Custom styles
}
```

#### Variants
- **neutral** – Gray background, gray text
- **success** – Green background, green text
- **warning** – Orange background, orange text
- **danger** – Red background, red text

#### Example
```tsx
<Badge label="In Progress" variant="warning" />
<Badge label="Completed" variant="success" />
<Badge label="Overdue" variant="danger" />
```

---

### 10. Chip Component
**File:** `components/Badge.tsx`  
**Purpose:** Selectable/toggleable filter pill (interactive badge).

#### Props
```typescript
{
  label: string;                    // Text (required)
  selected?: boolean;               // Active state (default: false)
  onPress: () => void;              // Toggle callback (required)
  style?: StyleProp<ViewStyle>;     // Custom styles
}
```

#### Appearance
- **Unselected**: Light background (`theme.offWhite`), bordered, dark text
- **Selected**: Orange background (`theme.orange`), white text
- **Touch target**: ≥32px height

#### Example
```tsx
const [filter, setFilter] = useState('all');

<View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
  <Chip
    label="All"
    selected={filter === 'all'}
    onPress={() => setFilter('all')}
  />
  <Chip
    label="Done"
    selected={filter === 'done'}
    onPress={() => setFilter('done')}
  />
  <Chip
    label="Pending"
    selected={filter === 'pending'}
    onPress={() => setFilter('pending')}
  />
</View>
```

---

### 11. Avatar Component
**File:** `components/Badge.tsx`  
**Purpose:** Circular initials display (non-interactive).

#### Props
```typescript
{
  name: string;                     // Full name (e.g. "John Smith")
  size?: number;                    // Diameter (default: 36)
  color?: string;                   // Background colour (default: theme.orange)
}
```

#### Logic
- Extracts first 2 initials from name (split on whitespace, uppercase).
- Circular, filled with optional background colour.
- White text at 40% of size font.

#### Example
```tsx
<Avatar name="Sarah Johnson" size={44} />
<Avatar name="John Doe" color={theme.green} />
```

---

### 12. SwatchPicker Component
**File:** `components/SwatchPicker.tsx`  
**Purpose:** Generic circular option picker (used for theme colours and bubble materials).

#### Props
```typescript
{
  items: { key: string; label: string }[]; // Options (required)
  value: string;                    // Currently selected key (required)
  onChange: (key: string) => void;  // Update callback (required)
  renderSwatch: (key: string, active: boolean) => React.ReactNode; // Render fn (required)
  size?: number;                    // Swatch diameter (default: 54)
}
```

#### Active State
- Orange border (3px)
- Scale: 1.07 (slight zoom)
- Heavy shadow
- Label text bold

#### Inactive State
- Gray border (2px)
- Normal scale
- Regular shadow
- Label text regular

#### Example: Theme Picker
```tsx
const THEMES = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

<SwatchPicker
  items={THEMES}
  value={theme}
  onChange={setTheme}
  renderSwatch={(key, active) => (
    <View
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: key === 'light' ? '#fff' : '#000',
        borderRadius: 999,
      }}
    />
  )}
/>
```

#### Used In
- `app/onboarding/step5.tsx` – colour theme picker
- `app/settings.tsx` – theme & material pickers

---

### 13. ConfirmationBanner Component
**File:** `components/ConfirmationBanner.tsx`  
**Purpose:** Auto-dismissing confirmation toast (positive feedback for actions).

#### Props
```typescript
{
  message: string | null;           // Confirmation text; null hides banner
  onDismiss: () => void;            // Called when dismissed or timed out
  duration?: number;                // Auto-dismiss delay in ms (default: 2200)
}
```

#### Appearance
- Green background (`theme.green`), white text
- Checkmark icon on left
- Top-aligned (below safe area)
- Rounded corners, shadow
- Fades in/out (220ms) unless reduced-motion enabled

#### Dismissal
- Auto-dismisses after `duration` ms
- Or immediately when tapped
- Parent controls message via state (pass `null` to hide)

#### Usage Pattern
```tsx
const [confirmation, setConfirmation] = useState<string | null>(null);

const handleSave = async () => {
  // ... save logic
  setConfirmation('Task saved ✓');
  // Auto-clears after 2.2s via onDismiss → setConfirmation(null)
};

return (
  <>
    {/* Screen content */}
    <ConfirmationBanner
      message={confirmation}
      onDismiss={() => setConfirmation(null)}
      duration={2200}
    />
  </>
);
```

#### Used In
- `app/task-form.tsx` – save confirmations
- `app/meals.tsx` – add confirmations
- `app/shopping.tsx` – add/purchase confirmations

---

## 🎯 Design Patterns & Best Practices

### 1. **Choosing Button Variant**
```
Primary action (save, submit, confirm)      → Button variant="primary" size="md"
Secondary action (cancel, back)             → Button variant="secondary" size="md"
Destructive action (delete, clear)          → Button variant="danger" size="md"
Lightweight/tertiary action                 → Button variant="ghost" size="sm"
Icon-only (header, settings, close)         → IconButton
"Add new" (any screen, any site)            → AddFAB
```

### 2. **Touch Targets**
All interactive components respect the **44px minimum** touch target:
- Direct (Button lg/md, AddFAB lg, Checkbox, SegmentedControl, Switch, Chip): built-in height ≥44px
- Indirect (IconButton, Badge, Avatar): hit-slop or Pressable wrapper ensures ≥44px

### 3. **Icons & Labels**
- **Icons**: Use Ionicons (`@expo/vector-icons`). Icon names: `check`, `checkmark`, `trash`, `cog`, `heart`, `close`, etc.
- **Accessibility**: Always include `label` prop for icon-only buttons (IconButton, AddFAB).
- **Text labels**: Sentence case ("Save settings", not "SAVE SETTINGS").

### 4. **Theming**
All components use:
- `theme.orange` – primary accent
- `theme.orangeLight` – secondary tint
- `theme.danger` – destructive
- `theme.green` – success/confirmation
- `theme.white`, `theme.text`, `theme.textLight` – text
- Access via `useAppTheme()` hook

### 5. **Loading & Disabled States**
- **Loading**: Button only. Shows spinner, disables interaction. Use brief labels ("Saving..." or keep original).
- **Disabled**: All components. Opacity 0.45, no interaction. Always provide clear UI reason (e.g. form invalid).

### 6. **Animations**
- **SaveButton**: 150ms ease (in/out).
- **ConfirmationBanner**: 220ms timing (in), 200ms timing (out).
- **SwatchPicker**: Instant scale + shadow change on selection.
- All honour `reducedMotion` setting.

---

## 🔧 Adding a New Site / Feature

### Checklist: "I'm building a new screen/site. Which button do I use?"

1. **Primary action?** → Use `Button` variant="primary" size="md"
2. **Add new entity?** → Use `AddFAB` (size="lg" for screen-level, size="sm" for row-level)
3. **Header/settings action?** → Use `IconButton`
4. **Need filtering?** → Use `Chip` (multiple, selectable)
5. **Binary choice (yes/no)?** → Use `Checkbox` or `Switch`
6. **Multiple mutually exclusive options?** → Use `SegmentedControl`
7. **Status display (no action)?** → Use `Badge`
8. **User/member initials?** → Use `Avatar`
9. **Inline save on edit?** → Use `SaveButton` (if input can be dirty)
10. **Picking colour or material?** → Use `SwatchPicker`
11. **Auto-dismiss success message?** → Use `ConfirmationBanner`

### Template: New Screen with Buttons

```tsx
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Button from '@/components/Button';
import IconButton from '@/components/IconButton';
import AddFAB from '@/components/AddFAB';
import { useAppTheme } from '@/lib/useAppTheme';

export default function NewScreen() {
  const theme = useAppTheme();
  const [items, setItems] = useState<Item[]>([]);

  const handleAdd = () => {
    // Open sheet or navigate to form
  };

  const handleEdit = (id: string) => {
    // Navigate to edit form
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Feature</Text>
        <IconButton
          icon="cog"
          label="Settings"
          onPress={() => {}}
        />
      </View>

      <ScrollView style={styles.content}>
        {/* List items */}
      </ScrollView>

      {/* Floating "add new" button */}
      <AddFAB onPress={handleAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  content: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold' },
});
```

---

## 🔄 Updating Buttons (Design Changes)

### Single Source of Truth
Each button is self-contained; a design change in one component file automatically propagates everywhere:

| File | Change Scope |
|------|--------------|
| `Button.tsx` | All primary/secondary/danger/ghost buttons, all sizes |
| `AddFAB.tsx` | All "add" buttons (floating + inline) |
| `IconButton.tsx` | All icon-only buttons, active states |
| `SaveButton.tsx` | All inline save animations |
| `FormControls.tsx` | All checkboxes, switches, segmented controls, inputs |
| `Badge.tsx` | All badges, chips, avatars |
| `SwatchPicker.tsx` | All circular swatch pickers |
| `ConfirmationBanner.tsx` | All confirmation toasts |

### To Change Button Appearance Globally
1. **Edit the component file** (e.g. `components/Button.tsx`)
2. **Update size, colour, padding, radius, font** in the StyleSheet or Props
3. **Commit with clear message** (e.g. "Button: increase md size from 48 to 52px")
4. **No need to update call sites** — they inherit the change automatically

### Example: Change Primary Button Colour
```tsx
// In Button.tsx, update variant colours:
const variantColors = {
  primary: { bg: theme.blue, text: '#ffffff' }, // Changed from theme.orange
  secondary: { bg: theme.blueTint, text: theme.brown },
  // ...
};
```
All 50+ screens using `<Button variant="primary" />` now show blue instead of orange — no edits needed.

---

## 📚 File Structure Summary

```
components/
  ├── Button.tsx                  (main action button: primary, secondary, danger, ghost)
  ├── AddFAB.tsx                  (orange "add" button: lg floating, sm inline)
  ├── IconButton.tsx              (circular icon-only: header actions, toggles)
  ├── SaveButton.tsx              (inline save: animated, dirty state)
  ├── FormControls.tsx            (checkbox, switch, segmented control, input)
  ├── Badge.tsx                   (badge, chip, avatar: status pills & filters)
  ├── SwatchPicker.tsx            (circular swatch picker: themes, materials)
  ├── ConfirmationBanner.tsx      (auto-dismiss success toast)
  └── PressableScale.tsx          (shared press feedback wrapper for all buttons)

lib/
  └── useAppTheme.ts              (provides theme colours for all components)

constants/
  └── theme.ts                    (color tokens, sizing, fonts, shadows)
```

---

## ✅ Quality Checklist

When adding buttons to a new feature:

- [ ] Button variant matches action importance (primary/secondary/danger/ghost)
- [ ] Button size respects 44px minimum touch target
- [ ] Icon-only buttons have `label` prop for accessibility
- [ ] Text is localized via `useT()` (never hardcoded)
- [ ] Colours come from `useAppTheme()` (never hardcoded hex)
- [ ] Disabled state clearly communicated (opacity, disabled prop)
- [ ] Loading state shows spinner, not text change (Button only)
- [ ] "Add" buttons use `AddFAB`, not custom
- [ ] Toggle/checkbox/switch use `FormControls`, not custom
- [ ] Status display uses `Badge`, not custom Text
- [ ] Confirmation uses `ConfirmationBanner`, not custom toast
- [ ] No duplicate button logic across screens

---

## 🚀 Quick Copy-Paste Examples

### Save & Cancel Buttons
```tsx
<View style={{ flexDirection: 'row', gap: 12 }}>
  <Button label="Cancel" onPress={cancel} variant="secondary" style={{ flex: 1 }} />
  <Button label="Save" onPress={save} variant="primary" style={{ flex: 1 }} />
</View>
```

### Add & Delete Actions
```tsx
<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
  <Text>Item</Text>
  <IconButton icon="trash" label="Delete" onPress={delete} />
</View>
<AddFAB onPress={handleAdd} />
```

### Filter Pills
```tsx
<ScrollView horizontal>
  <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
  <Chip label="Done" selected={filter === 'done'} onPress={() => setFilter('done')} />
  <Chip label="Pending" selected={filter === 'pending'} onPress={() => setFilter('pending')} />
</ScrollView>
```

### Status with Action
```tsx
<View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
  <Badge label="In Progress" variant="warning" />
  <Button label="Mark Done" onPress={markDone} size="sm" variant="secondary" />
</View>
```

---

## 📖 Further Reading

- **Animations**: See `ANIMATION_GUIDELINES.md` (repo root) for timing/easing/haptics contract
- **Theme tokens**: See `constants/theme.ts` for colour, size, radius, shadow definitions
- **i18n**: See `lib/i18n.ts` for adding new UI strings (English + Norwegian)
- **Accessibility**: All components use native `accessibilityRole`, `accessibilityState`, `accessibilityLabel`

---

**Last updated**: 2026-06-27  
**Maintained by**: Claude Code  
**Relevant links**: AGENTS.md (architecture), ANIMATION_GUIDELINES.md (motion), lib/i18n.ts (localization)
