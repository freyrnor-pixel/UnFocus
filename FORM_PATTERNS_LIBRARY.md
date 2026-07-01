# Form Patterns Library

Complete reference for form layouts, input patterns, and form states in UnFocus.

---

## 📝 Form Structure

Standard form layout follows this rhythm:

```tsx
<ScrollView style={{ padding: Spacing.md }}>
  {/* Title */}
  <Text style={{ fontSize: FontSize.xxl, fontFamily: Fonts.bold, marginBottom: Spacing.lg }}>
    Form Title
  </Text>

  {/* Form fields with consistent gap */}
  <View style={{ gap: Spacing.md }}>
    {/* Field 1 */}
    <FormField />
    
    {/* Field 2 */}
    <FormField />
    
    {/* Field 3 */}
    <FormField />
  </View>

  {/* Actions at bottom */}
  <View style={{ gap: Spacing.md, marginTop: Spacing.xl }}>
    <Button label="Save" onPress={save} variant="primary" size="md" />
    <Button label="Cancel" onPress={cancel} variant="secondary" size="md" />
  </View>

  {/* Bottom spacing for safe area */}
  <View style={{ height: Spacing.lg }} />
</ScrollView>
```

### Key Spacing Rules
- **Between fields**: `Spacing.md` (16px)
- **Title to fields**: `Spacing.lg` (24px)
- **Fields to actions**: `Spacing.xl` (32px)
- **Between actions**: `Spacing.md` (16px)

---

## 🎯 Form Field Pattern

### Basic Text Input Field
```tsx
<View>
  <Input
    label="Your Name"
    placeholder="Enter your full name"
    value={name}
    onChangeText={setName}
    error={nameError ? "Name is required" : undefined}
  />
</View>
```

### With Helper Text
```tsx
<View style={{ gap: Spacing.xs }}>
  <Input
    label="Email Address"
    placeholder="user@example.com"
    value={email}
    onChangeText={setEmail}
    error={emailError}
  />
  <Text style={{ fontSize: FontSize.xs, color: theme.textLight }}>
    We'll never share your email
  </Text>
</View>
```

### Optional Label Indicator
```tsx
<View>
  <View style={{ flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.xs }}>
    <Text style={{ fontSize: FontSize.sm, fontFamily: Fonts.semibold, color: theme.text }}>
      Username
    </Text>
    <Text style={{ fontSize: FontSize.xs, color: theme.textLight }}>
      (optional)
    </Text>
  </View>
  <Input
    placeholder="Choose a username"
    value={username}
    onChangeText={setUsername}
  />
</View>
```

---

## ☑️ Checkbox Pattern

### Single Checkbox with Label
```tsx
<Checkbox
  checked={agreed}
  onChange={setAgreed}
  label="I agree to the terms and conditions"
/>
```

### Multiple Checkboxes (Group)
```tsx
<View style={{ gap: Spacing.sm }}>
  <Text style={{ fontSize: FontSize.md, fontFamily: Fonts.semibold }}>
    Notification Preferences
  </Text>
  
  <Checkbox
    checked={emailNotifications}
    onChange={setEmailNotifications}
    label="Email notifications"
  />
  
  <Checkbox
    checked={pushNotifications}
    onChange={setPushNotifications}
    label="Push notifications"
  />
  
  <Checkbox
    checked={smsNotifications}
    onChange={setSmsNotifications}
    label="SMS notifications"
  />
</View>
```

---

## 🔘 Radio Button Pattern (SegmentedControl)

### Option Selection
```tsx
<View style={{ gap: Spacing.md }}>
  <Text style={{ fontSize: FontSize.md, fontFamily: Fonts.semibold }}>
    Work Mode
  </Text>
  
  <SegmentedControl
    options={[
      { value: 'pomodoro', label: 'Pomodoro' },
      { value: 'freeform', label: 'Free Form' },
    ]}
    value={workMode}
    onChange={setWorkMode}
  />
</View>
```

---

## 🔀 Toggle Switch Pattern

### Single Toggle
```tsx
<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
  <Text style={{ fontSize: FontSize.md }}>Enable Notifications</Text>
  <Switch
    checked={notificationsEnabled}
    onChange={setNotificationsEnabled}
  />
</View>
```

### Multiple Toggles (Settings List)
```tsx
<View style={{ gap: Spacing.md, paddingVertical: Spacing.lg }}>
  {/* Toggle 1 */}
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
    <View>
      <Text style={{ fontSize: FontSize.md, fontFamily: Fonts.semibold }}>
        Dark Mode
      </Text>
      <Text style={{ fontSize: FontSize.sm, color: theme.textLight }}>
        Use dark theme
      </Text>
    </View>
    <Switch
      checked={darkMode}
      onChange={setDarkMode}
    />
  </View>

  {/* Toggle 2 */}
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
    <View>
      <Text style={{ fontSize: FontSize.md, fontFamily: Fonts.semibold }}>
        Notifications
      </Text>
      <Text style={{ fontSize: FontSize.sm, color: theme.textLight }}>
        Receive alerts
      </Text>
    </View>
    <Switch
      checked={notificationsEnabled}
      onChange={setNotificationsEnabled}
    />
  </View>
</View>
```

---

## 🎨 Filter / Multi-Select Pattern

### Chip Filter Group
```tsx
<View style={{ gap: Spacing.md }}>
  <Text style={{ fontSize: FontSize.md, fontFamily: Fonts.semibold }}>
    Filter by Status
  </Text>
  
  <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
    <Chip
      label="All"
      selected={status === 'all'}
      onPress={() => setStatus('all')}
    />
    <Chip
      label="Active"
      selected={status === 'active'}
      onPress={() => setStatus('active')}
    />
    <Chip
      label="Completed"
      selected={status === 'completed'}
      onPress={() => setStatus('completed')}
    />
    <Chip
      label="Archived"
      selected={status === 'archived'}
      onPress={() => setStatus('archived')}
    />
  </View>
</View>
```

---

## 📅 Date/Time Picker Pattern

### Date Input
```tsx
<View>
  <Input
    label="Start Date"
    placeholder="YYYY-MM-DD"
    value={date}
    onChangeText={setDate}
    error={dateError}
  />
  <Text style={{ fontSize: FontSize.xs, color: theme.textLight, marginTop: Spacing.xs }}>
    Format: YYYY-MM-DD
  </Text>
</View>
```

### Time Input with Save Button
```tsx
<View style={{ gap: Spacing.md }}>
  <Text style={{ fontSize: FontSize.md, fontFamily: Fonts.semibold }}>
    Reminder Time
  </Text>
  
  <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
    <Input
      placeholder="09:00"
      value={time}
      onChangeText={setTime}
      style={{ flex: 1 }}
    />
    <SaveButton
      visible={timeChanged}
      onPress={saveTime}
      label="Save"
    />
  </View>
</View>
```

---

## 🎯 Form Layout Patterns

### Pattern 1: Vertical Form (Standard)
```tsx
<View style={{ gap: Spacing.md }}>
  <Input label="First Name" value={firstName} onChangeText={setFirstName} />
  <Input label="Last Name" value={lastName} onChangeText={setLastName} />
  <Input label="Email" value={email} onChangeText={setEmail} />
  <Checkbox label="Subscribe to updates" checked={subscribed} onChange={setSubscribed} />
  <Button label="Continue" onPress={submit} />
</View>
```

### Pattern 2: Form with Sections
```tsx
<ScrollView style={{ padding: Spacing.md, gap: Spacing.lg }}>
  {/* Personal Info Section */}
  <View>
    <Text style={{ fontSize: FontSize.lg, fontFamily: Fonts.bold, marginBottom: Spacing.md }}>
      Personal Information
    </Text>
    <View style={{ gap: Spacing.md }}>
      <Input label="Name" value={name} onChangeText={setName} />
      <Input label="Email" value={email} onChangeText={setEmail} />
    </View>
  </View>

  {/* Preferences Section */}
  <View>
    <Text style={{ fontSize: FontSize.lg, fontFamily: Fonts.bold, marginBottom: Spacing.md }}>
      Preferences
    </Text>
    <View style={{ gap: Spacing.md }}>
      <Checkbox label="Opt-in to emails" checked={email} onChange={setEmail} />
      <SegmentedControl
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        value={theme}
        onChange={setTheme}
      />
    </View>
  </View>

  {/* Actions */}
  <View style={{ gap: Spacing.md, marginTop: Spacing.lg }}>
    <Button label="Save" onPress={save} variant="primary" />
    <Button label="Cancel" onPress={cancel} variant="secondary" />
  </View>
</ScrollView>
```

### Pattern 3: Form in Card
```tsx
<View style={{
  backgroundColor: theme.white,
  borderRadius: Radius.md,
  padding: Layout.cardPadding,
  gap: Layout.cardGap,
  ...Shadow.card,
}}>
  <Text style={{ fontSize: FontSize.lg, fontFamily: Fonts.bold }}>
    Quick Edit
  </Text>
  
  <Input
    label="Title"
    value={title}
    onChangeText={setTitle}
  />
  
  <Input
    label="Notes"
    value={notes}
    onChangeText={setNotes}
    multiline
  />
  
  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
    <Button label="Save" onPress={save} variant="primary" style={{ flex: 1 }} />
    <Button label="Cancel" onPress={cancel} variant="secondary" style={{ flex: 1 }} />
  </View>
</View>
```

---

## ⚠️ Error Handling Pattern

### Field-Level Error
```tsx
<View>
  <Input
    label="Username"
    value={username}
    onChangeText={setUsername}
    error={usernameError}  // Shows red border + error text
  />
</View>
```

### Form-Level Error (Banner)
```tsx
{formError && (
  <View style={{
    backgroundColor: theme.dangerLight,
    borderRadius: Radius.md,
    padding: Layout.cardPadding,
    borderLeftWidth: 4,
    borderLeftColor: theme.danger,
    marginBottom: Spacing.md,
  }}>
    <Text style={{ fontSize: FontSize.md, color: theme.danger, fontFamily: Fonts.bold }}>
      Error
    </Text>
    <Text style={{ fontSize: FontSize.sm, color: theme.text, marginTop: Spacing.xs }}>
      {formError}
    </Text>
  </View>
)}
```

---

## 💾 Save/Submit Pattern

### Submit Button with Loading
```tsx
<Button
  label={isLoading ? "Saving..." : "Save"}
  onPress={handleSave}
  variant="primary"
  loading={isLoading}
  disabled={!isValid}
/>
```

### Inline Save (Dirty Detection)
```tsx
<View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
  <Input
    label="Name"
    value={name}
    onChangeText={(v) => {
      setName(v);
      setNameDirty(true);
    }}
    style={{ flex: 1 }}
  />
  <SaveButton
    visible={nameDirty}
    onPress={saveName}
    label="Save"
  />
</View>
```

---

## 🎯 Validation Pattern

### Real-Time Validation
```tsx
const [email, setEmail] = useState('');
const [emailError, setEmailError] = useState('');

const handleEmailChange = (value: string) => {
  setEmail(value);
  
  // Real-time validation
  if (!value) {
    setEmailError('Email is required');
  } else if (!isValidEmail(value)) {
    setEmailError('Invalid email format');
  } else {
    setEmailError('');
  }
};

return (
  <Input
    label="Email"
    value={email}
    onChangeText={handleEmailChange}
    error={emailError}
  />
);
```

### Submit Validation
```tsx
const handleSubmit = () => {
  // Validate all fields
  const errors = validateForm({ name, email, password });
  
  if (Object.keys(errors).length > 0) {
    setFormErrors(errors);
    return;
  }
  
  // Submit valid form
  submit();
};
```

---

## 🌓 Dark Mode

Forms automatically adapt:
```tsx
// Light mode: white input on cream background
// Dark mode: dark white input on dark cream background

<Input
  label="Your name"
  value={name}
  onChangeText={setName}
  // No special dark mode handling needed — Input handles it
/>
```

---

## 🔧 Reusable Form Section Component

```tsx
export interface FormSectionProps {
  title: string;
  children: React.ReactNode;
}

export function FormSection({ title, children }: FormSectionProps) {
  return (
    <View>
      <Text style={{ 
        fontSize: FontSize.lg, 
        fontFamily: Fonts.bold, 
        marginBottom: Spacing.md,
      }}>
        {title}
      </Text>
      <View style={{ gap: Spacing.md }}>
        {children}
      </View>
    </View>
  );
}

// Usage:
<FormSection title="Personal Info">
  <Input label="Name" value={name} onChangeText={setName} />
  <Input label="Email" value={email} onChangeText={setEmail} />
</FormSection>
```

---

## 🎯 Best Practices

✅ **DO:**
- Use consistent spacing (`Spacing.md` between fields)
- Group related fields in sections
- Show validation errors clearly
- Disable submit button if form is invalid or loading
- Use semantic field types (email, password, etc.)
- Test form on both light and dark modes

❌ **DON'T:**
- Hardcode spacing (use Spacing tokens)
- Leave validation errors ambiguous
- Allow submit while loading
- Mix form field styles
- Forget error message text colour (use theme.danger)

---

## 📚 Further Reading

- **BUTTON_LIBRARY.md** – Button patterns in forms
- **SPACING_LAYOUT_LIBRARY.md** – Form spacing
- **COLOR_THEME_LIBRARY.md** – Error colours, field borders
- **CARD_CONTAINER_LIBRARY.md** – Form containers

---

**Last updated**: 2026-06-27  
**Field spacing**: Spacing.md (16px)  
**Section spacing**: Spacing.lg (24px)  
**Action spacing**: Spacing.xl (32px)  
**Form validation**: Real-time or on-submit
