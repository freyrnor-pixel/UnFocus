# UnFocus Design System Implementation Checklist

**Status**: In Progress  
**Last updated**: 2026-06-25  
**Branch**: `claude/trusting-hopper-lch4ae`

## Overview

This document tracks the implementation of the complete UnFocus Design System from the design handoff bundle (`9c15dee3-UnFocus_Design_Systemhandoff.zip`). The system includes 15 reusable components, 5 color schemes, complete design tokens, and full screen specifications.

---

## Phase 1: Design Tokens & Foundation ✅ COMPLETE

### 1.1 Design Token Infrastructure
- [x] Review and validate `/constants/theme.ts` — already comprehensive
- [x] Verify 5 color schemes (default, tech, gothic, nature, fluffy) with light/dark variants
- [x] Confirm spacing scale (xs=4, sm=8, md=16, lg=24, xl=32, xxl=48)
- [x] Confirm radius values (sm=10, md=18, lg=26, full=999)
- [x] Confirm font sizes (xs=12, sm=14, md=16, lg=18, xl=22, xxl=28, hero=36)
- [x] Confirm font family (Nunito 400–800 weights)
- [x] Confirm shadow/elevation system
- [x] Confirm material finish system (glass, metal, rock, paper, plain)
- [x] Feature colors mapped correctly (task, scan, habits, health, meals, shop, shared, focus, capture)

**Key files**:
- `/constants/theme.ts` — all tokens defined and exported
- `/constants/colors.ts` — (if exists) or integrated into theme.ts

---

## Phase 2: Core Reusable Components

### 2.1 Button Component
- [x] Update `components/Button.tsx` to match design spec
  - [x] Support `label` + `children` (design uses children)
  - [x] Add `iconRight` prop (design specifies both leading + trailing icons)
  - [x] Update size variants: sm=36, md=48, lg=56 (minimum 44px hit target)
  - [x] Update padding: sm=[8,16], md=[12,22], lg=[15,28]
  - [x] Change border radius to `full` (999px) for pill shape
  - [x] Fix secondary variant to use soft tint fill (not border)
  - [x] Verify all color mappings (primary/secondary/danger/ghost)

**Status**: ✅ DONE

### 2.2 IconButton Component
- [x] Update `components/IconButton.tsx` to match design spec
  - [x] Add `tint` prop for background override
  - [x] Add `active` state (primary background + border)
  - [x] Add `label` prop (required, for accessibility)
  - [x] Default size=36, icon size = 50% of button size
  - [x] Update styling: active shows primary background + 1.5px border
  - [x] Hit target stays >=44px

**Status**: ✅ DONE

### 2.3 Badge / Chip / Avatar System
- [ ] Verify `components/Badge.tsx` matches design spec
  - [ ] Badge variants: neutral/success/warning/danger
  - [ ] Chip: selected/unselected toggle with primary highlight
  - [ ] Avatar: initials rendering, circular, size variants (sm/md/lg)
  - [ ] Accessibility attributes for all
  - [ ] Test across all 5 themes + dark mode

**Status**: ⏳ NEEDS VERIFICATION

### 2.4 ProgressBar & Feedback
- [ ] Verify `components/ProgressBar.tsx`
  - [ ] Value (0–1), customizable color/track color, height
  - [ ] Ensure smooth animation if value changes
- [ ] Check if Toast/Skeleton components needed

**Status**: ⏳ NEEDS VERIFICATION

---

## Phase 3: Form Controls

### 3.1 Checkbox, Switch, SegmentedControl, Input
- [ ] Verify `components/FormControls.tsx` — likely already good
  - [ ] Checkbox: proper styling, 44px+ hit target, all states
  - [ ] Switch: on/off, disabled, theme colors
  - [ ] SegmentedControl: multiple options, proper styling
  - [ ] Input: label, error state, clearable, placeholder, accessibility
  - [ ] Test all across light/dark + all 5 themes

**Status**: ⏳ NEEDS VERIFICATION

---

## Phase 4: Surface & Container Components

### 4.1 Card / Surface / HintCard
- [x] Verify `components/Surface.tsx` — material-aware card system
  - [x] Handles glass/metal/rock/paper/plain finishes
  - [x] Properly applies padding, shadows, borders
  - [x] Works across all themes
- [x] Verify `components/HintCard.tsx` — flat hint card with accent bar
  - [x] Left 3px accent bar
  - [x] Proper background (hintBg from theme)
  - [x] Info icon on left
  - [x] Text + optional example caption
- [ ] Verify `components/ExpandableCard.tsx` (if collapsible cards needed)

**Status**: ✅ Surface/HintCard DONE; ExpandableCard ⏳

---

## Phase 5: Feedback & Complex Components

### 5.1 TaskItem
- [ ] Verify `components/TaskItem.tsx`
  - [ ] Left accent stripe (color by done/essential state)
  - [ ] Round checkbox with proper colors
  - [ ] Title styling (muted if done, struck if done, star if essential)
  - [ ] Time and recurring tags
  - [ ] Completion animation + glow
  - [ ] All theme colors applied

**Status**: ⏳ NEEDS VERIFICATION

### 5.2 ProgressBar
- [x] Already verified above

### 5.3 BubbleMenu
- [x] **DEFERRED** per AGENTS.md — do NOT redesign unless explicitly asked

---

## Phase 6: Navigation

### 6.1 BottomNav
- [x] Verify `components/BottomNav.tsx`
  - [x] 5-item structure: 2 left + 1 centre FAB + 2 right
  - [x] Centre button (Home) styled as gradient FAB
  - [x] Active state highlighting with primary color
  - [x] 48px+ tap targets
  - [x] Navigation routing works via goToSite()
- [x] **DO NOT REDESIGN** per AGENTS.md — it's current and functional

**Status**: ✅ VERIFIED (no changes needed)

---

## Phase 7: App Screens

### 7.1 Onboarding Flow
**Files**: `/app/onboarding/{language,privacy,guided,index,step2,step3,step4,step5,step6}.tsx`

- [ ] Verify all screens use:
  - [ ] Consistent typography (headings semibold, body medium)
  - [ ] Spacing tokens (no magic numbers)
  - [ ] Theme-aware colors
  - [ ] Updated Button components (design spec styling)
  - [ ] Progress indicator (dot-based, 0–6 steps)
  - [ ] HintCard on relevant steps
- [ ] Test: Light + dark mode, all 5 color schemes

**Status**: ⏳ NOT YET UPDATED

### 7.2 Home / Plans
**Files**: `/app/index.tsx` (Home), `/app/plans.tsx` (Full day), `/components/DayTimeline.tsx`

- [ ] Home screen:
  - [ ] Greeting styling (semibold, calmer than bold)
  - [ ] Progress bar for task completion
  - [ ] Plans widget (TaskItem rows)
  - [ ] Shopping preview (inline checkboxes)
  - [ ] Energy check-in section
  - [ ] Next task suggestion card
  - [ ] Inbox section (AP-02)
  - [ ] Pet companion (if enabled)
  - [ ] All HintCards present
- [ ] Plans screen: Same task ranking, full day view
- [ ] Theme colors applied throughout

**Status**: ⏳ NOT YET UPDATED

### 7.3 Shopping Screen
**Files**: `/app/shopping.tsx`, `/components/ShoppingRow.tsx`, `/components/AddItemSheet.tsx`

- [ ] Shopping list: Weekly/monthly toggle
- [ ] Shopping rows: Checkbox toggle, name, amount/unit, store, price
- [ ] Add item sheet: Bottom sheet with form
- [ ] Budget view: Price summary
- [ ] All theme colors + design spec styling

**Status**: ⏳ NOT YET UPDATED

### 7.4 Habits & Health
**Files**: `/app/habits.tsx`, `/app/habit-form.tsx`, `/app/health.tsx`, `/components/HabitIcon.tsx`

- [ ] Habits: List with daily check-in circles, streak badges
- [ ] Habit form: Name input, frequency picker, icon picker
- [ ] Health: Soft theme (gentler, lower-contrast)
- [ ] All components use design system colors

**Status**: ⏳ NOT YET UPDATED

### 7.5 Scan / Receipt
**Files**: `/app/scan.tsx`

- [ ] Camera view, OCR parse, item list
- [ ] Button styling (primary for "Save", ghost for "Cancel")
- [ ] Form layout and spacing tokens
- [ ] HintCard at top

**Status**: ⏳ NOT YET UPDATED

### 7.6 Settings
**Files**: `/app/settings.tsx`

- [ ] Theme picker: 5 color schemes + light/dark
- [ ] Material picker: glass/metal/rock/paper/plain
- [ ] Accessibility settings: Reduced motion, font size, left-handed
- [ ] Notifications, Data, About sections
- [ ] All using design system components (Switch, Input, etc.)

**Status**: ⏳ NOT YET UPDATED

---

## Phase 8: Component Refinement & Polish

### 8.1 Missing Presentational Components
- [ ] Divider (if not already using SectionDivider)
- [ ] EmptyState (empty list placeholder) — `/components/EmptyState.tsx`
- [ ] Loader (loading spinner)
- [ ] Toast (transient notifications)

**Status**: ⏳ ASSESS

### 8.2 Accessibility & Dark Mode Testing
- [ ] All interactive elements: 44px+ touch targets
- [ ] Color contrast: WCAG AA (4.5:1 body, 3:1 UI)
- [ ] reducedMotion respected across all animations
- [ ] Test all 5 themes × light/dark (10 combinations)
- [ ] Test custom color theme in both modes

**Status**: ⏳ DEFERRED (manual testing post-implementation)

### 8.3 i18n for New UI Text
- [ ] Review `/lib/i18n.ts`
- [ ] All new component/screen text has keys in both `en` and `no`
- [ ] No hardcoded strings in components
- [ ] Per AGENTS.md: `useT()` in components, `getTranslations()` in stores/schedulers

**Status**: ⏳ ONGOING (add as components are updated)

---

## Phase 9: Final Integration & Documentation

### 9.1 Update CLAUDE.md
- [ ] Document design system completion
- [ ] List all new/updated components
- [ ] Note i18n keys added
- [ ] Note: No data schema changes (UI-only)

**Status**: ⏳ FINAL

### 9.2 Final Validation
- [ ] Read through all app screens
- [ ] No TODOs or FIXMEs left unaddressed
- [ ] All imports correct (@/ paths)
- [ ] No unused imports
- [ ] JSDoc headers accurate

**Status**: ⏳ FINAL

---

## Implementation Notes

### Key Design System Principles
1. **Sentence case** throughout (headlines, buttons, labels) — no ALL CAPS
2. **Shame-free framing**: Use `neutral` (not danger/red) for empty states, unchecked items
3. **Theme consistency**: All colors from `useAppTheme()` — never hardcode hex except in tokens
4. **Spacing rhythm**: Use `Spacing.*` constants — no ad-hoc padding
5. **Rounded fonts**: Nunito family 400–800, giving warmth
6. **Material finish**: Cards can use any of 5 finishes; bubbles/FAB wear the finish from Settings
7. **Minimal animations**: Gentle, quick, springy; respect `reducedMotion`
8. **i18n always**: All UI text through `useT()` (components) or `getTranslations()` (stores)

### Critical Constraints (DO NOT BREAK)
1. Slug in `app.json` MUST stay `all-the-small-things` (EAS project registration)
2. All strings through `useT()` from `lib/i18n.ts` (bilingual EN/NO)
3. Date format always `YYYY-MM-DD`
4. SQLite file name: `unfocus.db`
5. New DB columns: Use `ALTER TABLE` in migrations array, never drop/recreate tables
6. Stores use `lib/dataAccess.ts` (`loadFirst`/`loadAll`/`updateRow` + `FieldMap`)
7. BottomNav must stay functional — no redesign
8. BubbleMenu is deferred — don't touch

### File Organization
```
components/
  ├── Button.tsx ✅
  ├── IconButton.tsx ✅
  ├── Badge.tsx ⏳
  ├── FormControls.tsx (Checkbox, Switch, Input, SegmentedControl) ⏳
  ├── ProgressBar.tsx ⏳
  ├── TaskItem.tsx ⏳
  ├── HintCard.tsx ✅
  ├── Surface.tsx ✅
  ├── BottomNav.tsx ✅
  └── BubbleMenu.tsx 🚫 (deferred)

app/
  ├── onboarding/ (language, privacy, guided, index, step2–6) ⏳
  ├── index.tsx (Home) ⏳
  ├── plans.tsx ⏳
  ├── shopping.tsx ⏳
  ├── habits.tsx ⏳
  ├── health.tsx ⏳
  ├── scan.tsx ⏳
  └── settings.tsx ⏳

constants/
  └── theme.ts ✅ (comprehensive token system)

lib/
  └── i18n.ts ⏳ (add keys as screens update)
```

---

## How to Continue

### Next Steps (Priority Order)
1. **Verify remaining components** (Badge, FormControls, TaskItem, ProgressBar)
2. **Update Onboarding screens** (simple UI, self-contained, no cross-screen state)
3. **Update Home screen** (most-used, central hub)
4. **Update Shopping screen** (important feature, high visibility)
5. **Update remaining screens** (Habits, Health, Scan, Settings, Plans)
6. **Test comprehensively** (all 5 themes, light/dark, accessibility)
7. **Final documentation** (update CLAUDE.md, create screenshot gallery)

### Testing Checklist
- [ ] Light mode: All 5 themes render correctly
- [ ] Dark mode: All 5 themes render correctly (test contrast)
- [ ] Custom color: Generate + test with custom primary/secondary
- [ ] Reduced motion: All animations respect `prefers-reduced-motion: reduce`
- [ ] Accessibility: Test with accessibility inspector (44px+ tap targets, proper ARIA)
- [ ] i18n: Switch between EN/NO, verify all text appears
- [ ] Material finish: Test glass/metal/rock/paper/plain on BottomNav

---

## Design Handoff References

**Bundle**: `/root/.claude/uploads/.../9c15dee3-UnFocus_Design_Systemhandoff.zip`

**Design files extracted to**: `/tmp/claude-0/-home-user-All-the-small-things/.../scratchpad/unfocus-design-system/project/`

**Key design files**:
- `project/README.md` — Design system overview + principles
- `project/tokens/` — CSS token definitions (colors, typography, spacing, elevation, themes)
- `project/components/` — Component JSX prototypes (15 reusable components)
- `project/ui_kits/unfocus_app/` — Full app UI kit with all screens (Onboarding, Home, Shopping, Habits, Health, Scan, Settings)

---

## Progress Summary

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Tokens | ✅ | theme.ts comprehensive; all 5 schemes defined |
| 2. Core components | 🟡 | Button ✅, IconButton ✅; others need verification |
| 3. Forms | ⏳ | FormControls exist; need design spec alignment |
| 4. Surfaces | ✅ | Surface, Card, HintCard all good |
| 5. Feedback | ⏳ | TaskItem, ProgressBar need verification |
| 6. Navigation | ✅ | BottomNav verified; BubbleMenu deferred |
| 7. Screens | ⏳ | 11 screens need updating (onboarding, home, shopping, habits, health, scan, settings, plans, etc.) |
| 8. Polish | ⏳ | Accessibility, dark mode, i18n testing deferred |
| 9. Documentation | ⏳ | Final CLAUDE.md update pending |

**Completion estimate**: ~40–60 hours of focused development work across all remaining phases.

---

Last updated: 2026-06-25 by Claude (Haiku 4.5)
