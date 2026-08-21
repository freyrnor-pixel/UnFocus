# Handoff — button press animations, full-app sweep

**Purpose:** give the next Claude Code session (on the `UnFocus` repo, branch
`claude/button-press-animations-k42idp`) everything needed to execute this task without
re-deriving the research already done. Read `ANIMATION_GUIDELINES.md` first (this repo's
timing/easing/spring/haptics reference — §3 "Button Press Feel" and §9 the paste-in block are
directly relevant). This doc only covers the delta specific to this task.

**Companion file:** `BUTTON_PRESS_ANIMATIONS_CHECKLIST.md` — the literal per-file TODO list.
**Always update the checklist in the same commit as the code it tracks**, so progress survives
a `/clear` and a fresh session can resume by reading the checklist instead of re-auditing the
repo. If you're a fresh session picking this up: read the checklist first, find the first
unchecked item, start there.

**Not started yet as of this doc's writing** — no code has been changed. This is a plan
handoff, not a partial-progress handoff (that distinction lives in the checklist file instead).

---

## The ask

Add press animations to buttons across the app — "if it would be natural to have in another
app, go for it" (user's own framing — this is a full sweep, not a token gesture). Movement
and/or color changes, calm and quick, not overdone — matching this app's existing "calm but
quick" motion philosophy (`ANIMATION_GUIDELINES.md` §1).

## What's already there — don't reinvent this

`components/PressableScale.tsx` is the existing, proven press-feel primitive: scales down on
press-in (`withTiming`, 60ms), springs back on release (`withSpring({damping:18,
stiffness:320})`), fires a light `tap()` haptic (`lib/haptics.ts`) on press-in, and honors
`useAccessibility().reducedMotion` (skips the scale, haptic still fires). It's already used
correctly in `components/Button.tsx`, `components/IconButton.tsx`, `components/Badge.tsx`
(`Chip`), `components/BottomNav.tsx`, `components/FormControls.tsx`, and a handful of sheet
components — **use these as reference implementations**, don't hand-roll new press logic.

`ANIMATION_GUIDELINES.md` §3 already defines the `scaleTo` taxonomy this whole task follows:

| Button type | `scaleTo` | Examples |
|---|---|---|
| Primary action / CTA | 0.95 | "Set budget", "Take photo", form save buttons |
| Secondary / ghost / chip | 0.97 | weekday chips, category chips, cancel links |
| Icon button / FAB / stepper | 0.90 | gear icon, qty +/-, trash icon, AddFAB, VoiceNoteFAB |
| List item / card tap / toggle circle | 0.97 | row taps, done-circles, disclosure headers |
| Destructive (delete/remove/reset) | 0.93 | remove-item ✕, reset-monthly, delete-task row |
| Tab / nav item | 0.97 | segmented tabs, sub-tab selectors (matches BottomNav) |

## What's missing — the actual gap

Two independent Explore-agent audits of `app/` and `components/` (full repo, excluding
`node_modules`) converged on the same finding: **zero `TouchableOpacity`/`TouchableHighlight`
anywhere** (codebase is 100% `Pressable`-based already), but only ~15 files use
`PressableScale` — roughly **230 individual tap targets across ~45 files** are bare
`Pressable` with **no press-in feedback at all**: no scale, no haptic, nothing. That includes
very high-traffic surface: `ScreenHeader`'s gear/back/focus icons (rendered on nearly every
screen), `AddFAB` (the "+" used on ~8 screens), every checkbox/delete/chip in `TaskCard`,
`ShoppingRow`, `PlanTaskCard`, `WeekListCard`, and the bulk of `settings.tsx`, `scan.tsx`,
`health.tsx`, and the other form/screen files.

The full raw-`Pressable` inventory (grouped, with line numbers as of the audit) is reproduced
in `BUTTON_PRESS_ANIMATIONS_CHECKLIST.md` — that file is the actual working list.

---

## Part 1 — Extend `PressableScale.tsx` with a synced opacity dip (do this first)

The user asked for movement **and/or color changes**. Rather than adding per-button color
logic to 45 files, add one small change to the shared primitive so every consumer — existing
and newly converted — gets a subtle brightness dip synchronized to the existing press-scale,
for free.

Current file (`components/PressableScale.tsx`):

```tsx
import React from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAccessibility } from '@/lib/useAppTheme';
import { tap as hapticTap } from '@/lib/haptics';

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  scaleTo?: number;
  children?: React.ReactNode;
};

export default function PressableScale({
  style,
  haptic = true,
  scaleTo = 0.94,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const { reducedMotion } = useAccessibility();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animStyle]}
      onPressIn={(e) => {
        if (haptic) hapticTap();
        if (!reducedMotion) scale.value = withTiming(scaleTo, { duration: 60 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reducedMotion) scale.value = withSpring(1, { damping: 18, stiffness: 320 });
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
```

Required changes:

1. Import `interpolate` and `Extrapolation` from `react-native-reanimated` (already at v4.3.1
   in `package.json` — both available).
2. Destructure `disabled` explicitly out of props (it's already part of `PressableProps`,
   currently silently absorbed into `...rest`).
3. In `animStyle`, derive opacity **from the existing `scale` shared value** — don't add a new
   shared value, this keeps the color change perfectly synced to the same press/release timing
   with zero new tuning:
   ```tsx
   const animStyle = useAnimatedStyle(() => ({
     transform: [{ scale: scale.value }],
     opacity: disabled
       ? undefined
       : interpolate(scale.value, [scaleTo, 1], [0.85, 1], Extrapolation.CLAMP),
   }));
   ```
4. Pass `disabled` through to `AnimatedPressable` as before (it already flows via `...rest`,
   just confirm it's not accidentally dropped by destructuring it out).

**Why `opacity: undefined` and not `opacity: 1` when disabled — read this before changing it:**
`Button.tsx` and `IconButton.tsx` already set their own static `opacity: disabled ? 0.45 : 1`
in the `style` array they pass into `PressableScale`. RN's style-array flattening skips
`undefined`-valued keys (does not override earlier array entries), so `opacity: undefined`
here correctly leaves that static disabled-dim untouched. If you instead hardcode `opacity: 1`
for the disabled case, you will silently break every disabled button's dimmed appearance —
**verify this specifically** (see Verification section) before considering Part 1 done.

Under `reducedMotion`, `scale.value` never leaves `1` (the existing `if (!reducedMotion)`
guards already prevent it from animating), so `interpolate(1, [scaleTo,1], [0.85,1])` = `1` —
no opacity dip fires under reduced motion, automatically, no extra branching needed.

Update the file's header JSDoc comment to mention the new opacity dip (one line is enough —
match the existing header's terse style).

## Part 2 — Backfill missing `scaleTo` on already-converted call sites

Low-priority polish, bundle into whichever commit touches these files anyway. These use
`PressableScale` today but rely on its generic `0.94` default instead of an explicit,
taxonomy-correct value: `components/InboxSection.tsx`, `components/UpdateSheet.tsx`,
`components/AddItemSheet.tsx` (the already-converted call sites within it, not the backdrop),
`components/ListSettingsSheet.tsx`, `components/SharedRequestsSection.tsx`,
`components/ShoppingQuickAddSheet.tsx`, `components/WeekListCard.tsx`'s `doneShoppingBtn`.
Classify each by the table above and add the explicit prop.

## Part 3 — Convert raw `Pressable` to `PressableScale`, file by file

Mechanical per call site: swap the import and JSX tag from `Pressable` to `PressableScale`,
**keep every existing prop unchanged** (`onPress`, `hitSlop`, `accessibilityLabel`,
`accessibilityState`, `style`, `disabled`, etc.), and add `scaleTo` per the taxonomy table.
`PressableScale`'s prop type is `PressableProps & {...}`, a strict superset, so this is a
drop-in swap with zero prop-shape changes required at call sites.

**Exclusions — leave these as raw `Pressable`, do not convert:**
- Modal/sheet backdrop dismiss-taps — `AnimatedBottomSheet.tsx`'s backdrop, `AppModal.tsx`'s
  backdrop, sheet backdrops inside `AddItemSheet.tsx` / `ShoppingQuickAddSheet.tsx` /
  `app/(tabs)/scan.tsx` / `components/FoodTab.tsx` popups, `ConfirmationBanner.tsx`'s
  tap-to-dismiss. These aren't buttons — a scale-bounce on an invisible full-screen backdrop
  reads as a bug, not polish.
- `components/TimeBoxInput.tsx`'s row-tap (focuses a `TextInput`, it's not an action button).
- `components/DebugOverlay.tsx` — dev-only tooling, not shipped user experience, skip entirely.

**Work through the checklist file in the order it's laid out** (shared wrappers first — they
propagate to dozens of screens per file changed — then card/row components, then per-screen
files). Check off each file in `BUTTON_PRESS_ANIMATIONS_CHECKLIST.md` as you land it, in the
same commit.

For every touched file, update its header's `Connections → Imports` line to add
`components/PressableScale` if not already listed (per `AGENTS.md`'s "update headers as you
go" rule) — do this in the same edit, not a separate sweep.

---

## Verification

Run per batch (don't wait until the whole sweep is done to typecheck):

1. `npx tsc --noEmit` — cheap, catches accidental prop-shape mistakes immediately. Should stay
   green after every batch.
2. After Part 1 specifically: manually trace (or run the web preview and inspect) a disabled
   `Button` (e.g. a form's save button while a required field is empty) to confirm it still
   renders at reduced opacity — this is the one place a mistake in Part 1 silently regresses
   something already working.
3. Once a full phase (per the checklist's grouping) is done: `scripts/test-changed.sh` — this
   is UI-wiring, so the pure-logic Jest suite likely has little to say, but run it anyway.
4. `npm run preview` (Expo Web + Playwright, see `AGENTS.md` "Web preview for agent testing")
   — drive a few representative flows: add a task via the draft card, toggle a task/habit
   done-circle, tap through BottomNav tabs, open Settings. Confirms wiring didn't break
   anything and the SQLite write path still works. **Caveat**: the web preview can't show real
   scale-bounce timing/haptics (that needs a device) — this step verifies "doesn't crash,
   disabled state isn't broken," not final feel/pixel sign-off.

## Publishing (per this repo's CLAUDE.md standing rule — read that file if unfamiliar)

This is a pure JS/UI change, no native surface touched. Commit on
`claude/button-press-animations-k42idp`, push, open a PR into `main`, and **merge it
yourself** — the repo's `CLAUDE.md`/`AGENTS.md` grant standing authorization for this exact
flow ("ALWAYS open a PR and merge it to main... never hand the merge back to the user"). Do
not stop at "pushed the branch." A task is not finished until the PR is merged to `main` (that
push is what triggers the OTA update workflow).

You do not have to land the entire ~45-file sweep in one PR/session — landing it in a few
batches (e.g. one PR per phase in the checklist) is fine and probably safer given the size;
just make sure each PR you do open gets merged before moving to the next phase, and the
checklist stays in sync with what's actually merged to `main`, not just committed locally.
