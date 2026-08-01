# UnFocus Button & Interactive Components Library

A complete reference guide for all reusable button and interactive components in UnFocus. Use this when creating new sites, adding features, or maintaining consistent UI patterns.

---

## 📋 Quick Reference Table

> **2026-07 design-consistency pass**: the ONE "add a row" affordance is now
> `components/AddRow.tsx` — an inline empty row + confirm button, attached to the
> list it feeds. `AddFAB` is reserved for genuine nav-to-a-full-form triggers embedded
> in a header (e.g. Health's habit-add, next to the "Vaner" label) — floating
> screen-corner FABs and dashed "new" cards were removed in favour of AddRow or, when
> the flow needs multiple fields before it can save, a bordered trigger pill (see
> Shopping's `monthlyTrigger`/`addTrigger`/`newListTrigger`, or automations.tsx/
> health-log.tsx/inventory-edit.tsx's `addTrigger`). Don't reach for a floating AddFAB
> on a new screen — see the updated checklist below.

| Component | Type | File | Use Case |
|-----------|------|------|----------|
| **Button** | Action Button | `components/Button.tsx` | Primary actions, varied sizes & variants |
| **AddRow** | Inline Add Row | `components/AddRow.tsx` | The one "add a row" shape — empty input row + confirm, attached to its list |
| **AddFAB** | Floating Action | `components/AddFAB.tsx` | Nav-to-full-form trigger embedded in a header (e.g. Health's habit-add) — NOT for screen-corner floating "add" anymore |
| **IconButton** | Icon-only Button | `components/IconButton.tsx` | Header actions, toggles, icon controls |
| **Checkbox** | Form Control | `components/FormControls.tsx` | Binary on/off selection |
| **Switch** | Form Control | `components/FormControls.tsx` | Toggle switch (native with theme) |
| **SegmentedControl** | Form Control | `components/FormControls.tsx` | Multiple option selector (tab-like) |
| **Input** | Form Control | `components/FormControls.tsx` | Text/number input with label & error |
| **Badge** | Status Pill | `components/Badge.tsx` | Non-interactive status labels |
| **Chip** | Filter Pill | `components/Badge.tsx` | Selectable/toggleable filter option |
| **ConfirmationBanner** | Toast/Overlay | `components/ConfirmationBanner.tsx` | Auto-dismissing confirmation message |

> **Person identity is not a button.** For "who is this for/from", use
> `components/PersonChip.tsx` with `lib/personColor.ts` — not a generic initials avatar.
> An `Avatar` export was documented here for months and has never existed in this repo.

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
  emphasis?: boolean;               // Reserve-only breathing GlowPulse halo; primary only,
                                    // max ONE per screen (ignored on other variants/disabled)
  style?: StyleProp<ViewStyle>;     // Custom styles — note this lands on the WRAPPER on the
                                    // keycap path, so it sizes the whole key, not just the cap
}
```

#### Variants & Sizes

**Variants:**
- **primary** (default) – `theme.accent` fill, `theme.accentInk` text. Use for primary actions.
- **secondary** – `theme.accentSoft` tint fill. Use for secondary actions.
- **danger** – `theme.bad`. Use for destructive actions (delete, clear). **Always flat** —
  never glass, regardless of `settings.glassSurfaces` (a destructive action shouldn't be the
  shiniest thing on screen).
- **ghost** – Transparent, accent text. Use for lightweight/tertiary actions. The one variant
  with no cap to sink, so it keeps the historical scale-bounce instead of the keycap travel.

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
**Purpose:** Shared accent "+" button for "add new" actions across all screens. Consistent shape and colour everywhere.

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
- **Always `theme.accent`**; no variants. This is the one shared shape.
- The `'lg'` size carries `getGlow(theme.accent, 'strong')` — the app's one "always on"
  purposeful glow. The `'sm'` inline variant does not.
- Use `bottom` prop to adjust floating position if screen has extra sticky footer.
- See `app/(tabs)/shopping.tsx` for example of stacking with extra footer content.

#### Examples
```tsx
// Screen-level floating "add new" task
<AddFAB onPress={handleAdd} />

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
  tint?: string;                    // Background override (default: theme.surfaceMuted)
  color?: string;                   // Icon colour override
  active?: boolean;                 // Active state (accent bg + border, and stays sunk)
  disabled?: boolean;               // Disabled state
  style?: StyleProp<ViewStyle>;     // Custom styles
}
```

#### Touch Target
- Hit target always ≥44px (auto-expanded via Pressable wrapper).
- Visual button size is controlled by `size` prop.

#### Active State
When `active={true}`:
- Background: `theme.accentSoft` (animated from `tint ?? theme.surfaceMuted`)
- Border: `theme.accent` (from `theme.border`)
- Icon colour: `theme.accent`
- Sits **sunk** — the stays-pressed "on" state, not a shrink (see `PressableScale`'s `sunk`)
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
  color={theme.bad}
  tint={theme.badSoft}
/>

// Small custom button
<IconButton icon="close" label="Close" onPress={close} size={28} />
```

---

### 4. SaveButton Component — REMOVED (2026-07-27)
**Status:** `components/SaveButton.tsx` and its sibling `StickySaveBar.tsx` were deleted. Both
were ported ahead of their intended screen (`app/settings.tsx`), which then shipped using a
different pattern, so neither was ever imported by anything.

If an inline dirty-state save is wanted again, build it on `components/Button.tsx` +
`PressableScale` rather than restoring the old file. The old prop shape and styling notes
that used to fill this section were deleted 2026-08-01 — they described a component nothing
ever rendered, in token names (`theme.orange`) that no longer exist, under a "Used In" list
naming screens that never imported it.

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
- Checked: `theme.accent` filled + `theme.accent` border, `theme.accentInk` checkmark
- Unchecked: Transparent, bordered (`theme.border`)
- Label: `theme.text`
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
- **Off track**: `theme.surfaceMuted`
- **On track**: `theme.accentSoft`
- **Off thumb**: a fixed `'#FFFFFF'` — deliberately NOT `theme.textInverse`, which flips to
  near-black in dark mode and made the off-thumb vanish into the track (2026-07-25)
- **On thumb**: `theme.accent`

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
- Container: `theme.surfaceMuted` background with a `theme.border` outline (2026-07-21),
  rounded corners
- Inactive segment: `theme.textMuted` label, no fill
- Active segment: `theme.surface` pill, `theme.shadow`-tinted shadow, `theme.text` label
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
- **Input**: 44px height min, `theme.surface` fill, rounded corners. Border is
  `theme.border` at rest → `theme.borderStrong` on focus → `theme.bad` if `error`
- **Label**: `theme.textMuted` above, small font
- **Error**: `theme.bad` text below input (if `error` prop provided)
- **Placeholder**: `theme.textMuted`

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
Each is a `*Soft` fill with its matching chromatic ink:
- **neutral** – `theme.surfaceMuted` background, `theme.textMuted` text
- **success** – `theme.goodSoft` background, `theme.good` text
- **warning** – `theme.warnSoft` background, `theme.warn` text
- **danger** – `theme.badSoft` background, `theme.bad` text

#### Example
```tsx
<Badge label="In Progress" variant="warning" />
<Badge label="Completed" variant="success" />
<Badge label="Still due" variant="danger" />   {/* never "Overdue"/"Missed" — DESIGN_RULES rule 23 */}
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
- **Unselected**: `theme.surfaceMuted` background, `theme.border` edge, `theme.text` label
- **Selected**: `theme.accent` background + `theme.accent` edge, `theme.accentInk` label
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

### 11. ConfirmationBanner Component
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
- Fill by variant: `theme.good` (success, default) / `theme.warn` / `theme.bad`,
  with `theme.textInverse` text and icon
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
- `app/(tabs)/shopping.tsx` – add/purchase confirmations
- `app/food.tsx` – add confirmations
- (Task editing has no form screen — `app/task-form.tsx` was retired 2026-07-23; the one
  task editor is `components/TaskCard.tsx`'s inline expansion)

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
- Indirect (IconButton, Chip): hit-slop or Pressable wrapper ensures ≥44px. Use
  `MIN_TAP_TARGET`/`HitSlop`/`hitSlopFor()` from `constants/theme.ts` — never a bare `44`
  or `hitSlop: 8` (`lib/__tests__/designTokens.test.ts` fails the PR)

### 3. **Icons & Labels**
- **Icons**: Use Ionicons (`@expo/vector-icons`). Icon names: `check`, `checkmark`, `trash`, `cog`, `heart`, `close`, etc.
- **Accessibility**: Always include `label` prop for icon-only buttons (IconButton, AddFAB).
- **Text labels**: Sentence case ("Save settings", not "SAVE SETTINGS").

### 4. **Theming**
All components use:
- `theme.accent` – primary action / active state
- `theme.accentSoft` – accent tint for backgrounds; `theme.accentInk` – text/icons on accent
- `theme.bad` / `theme.badSoft` – destructive
- `theme.good` / `theme.goodSoft` – success/confirmation; `theme.warn` / `theme.warnSoft`
- `theme.text`, `theme.textMuted`, `theme.textInverse` – text
- `theme.surface`, `theme.surfaceMuted`, `theme.border`, `theme.borderStrong` – surfaces/edges
- Access via `useAppTheme()` hook. Full token table: `COLOR_THEME_LIBRARY.md`

### 5. **Loading & Disabled States**
- **Loading**: Button only. Shows spinner, disables interaction. Use brief labels ("Saving..." or keep original).
- **Disabled**: All components. Opacity 0.45, no interaction. Always provide clear UI reason (e.g. form invalid).

### 6. **Animations**
- **ConfirmationBanner**: 220ms timing (in), 200ms timing (out).
- **Press is a sink, not a shrink** — `PressableScale`'s `travel` drops the cap onto its
  base; `sunk` is the stays-pressed "on" state. See `ANIMATION_GUIDELINES.md` for the real
  timing/easing values, and use `Duration.*` from `constants/motion.ts`, never a bare number.
- All honour `reducedMotion` setting.

---

## 🔧 Adding a New Site / Feature

### Checklist: "I'm building a new screen/site. Which button do I use?"

1. **Primary action?** → Use `Button` variant="primary" size="md"
2. **Add new entity into a list?** → Use `AddRow` (single field) or a bordered trigger pill
   (multi-field flow that needs its own sheet/form — matches Shopping's `monthlyTrigger`).
   Attach it directly above/below the list it feeds — never a floating screen-corner FAB.
3. **Header/settings action?** → Use `IconButton` (or `AddFAB size="sm"` specifically for a
   header-embedded "add" trigger that navigates to a full form, e.g. Health's habit-add)
4. **Need filtering?** → Use `Chip` (multiple, selectable)
5. **Binary choice (yes/no)?** → Use `Checkbox` or `Switch`
6. **Multiple mutually exclusive options?** → Use `SegmentedControl`
7. **Status display (no action)?** → Use `Badge`
8. **Showing who a row is for/from?** → Use `PersonChip` (+ `lib/personColor.ts`)
9. **Inline save on edit?** → Build it on `Button` (SaveButton was removed 2026-07-27)
10. **Auto-dismiss success message?** → Use `ConfirmationBanner`

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
| `FormControls.tsx` | All checkboxes, switches, segmented controls, inputs |
| `Badge.tsx` | All badges and chips |
| `PersonChip.tsx` | All person/assignee identity chips |
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
  primary: { bg: theme.accent, text: theme.accentInk },
  secondary: { bg: theme.accentSoft, text: theme.text },
  // ...
};
```
Change `accent` once in `constants/colors.ts` (both the light and dark `ThemePalette`) and
every screen using `<Button variant="primary" />` follows — no per-screen edits. Re-run
`lib/__tests__/colors.test.ts`, which asserts the palette's contrast ratios.

---

## 📚 File Structure Summary

```
components/
  ├── Button.tsx                  (main action button: primary, secondary, danger, ghost)
  ├── AddFAB.tsx                  (accent "add" button: lg floating, sm inline)
  ├── IconButton.tsx              (circular icon-only: header actions, toggles)
  ├── FormControls.tsx            (checkbox, switch, segmented control, input)
  ├── Badge.tsx                   (badge, chip: status pills & filters)
  ├── PersonChip.tsx              (person/assignee identity chip)
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
