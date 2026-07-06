# Animation, Button Feel & Haptics — Motion Design Reference for UnFocus

Read this before writing or editing any animation, button-press, or haptic code. Section 8
at the bottom is a ready-to-paste block for animation prompts.

This doc is grounded in this codebase's actual stack — react-native-reanimated for new
work, a legacy `Animated` (native-driver) API still in a few older components, and the
centralized `lib/haptics.ts` wrapper. Where the underlying physical guidance differs from
what's implemented today, that's called out explicitly rather than glossed over.

## 1. The Golden Rules of Motion

Animation should feel like part of the interaction, not a wait. If the user notices it, it's
probably too slow or too showy.

| Duration | Feel |
|---|---|
| Under 80ms | Too fast to perceive — feels broken/glitchy |
| 100–150ms | Micro-interactions: button presses, toggles, icon taps — instant and snappy |
| 200–300ms | Standard transitions: expanding cards, dropdowns, accordions — responsive |
| 300–400ms | Hero transitions: modals, screen navigation, full panels — deliberate |
| 500ms+ | Starts to feel sluggish — only for celebration animations |
| Over 1s | Never, unless it's a loading state with a visible indicator |

Entrances take slightly longer than exits — the user already decided to close it, so exits
should feel faster (e.g. modal in 350ms, same modal out 250ms).

### Duration quick reference

| Interaction | Duration | Easing | Notes |
|---|---|---|---|
| Button press (scale down) | 80–100ms | ease-out | The gold standard |
| Button release (spring back) | 150–200ms | spring | Slightly longer than press |
| Toggle / switch | 100–150ms | ease-out | Fast and satisfying |
| Card expand / collapse | 200–250ms | ease-out | Content reveals smoothly |
| Modal slide up (enter) | 300–350ms | ease-out | Full screen height |
| Modal dismiss (exit) | 200–250ms | ease-in | Exit is always faster than enter |
| Tab switch | 150–200ms | ease-out | Near-instant |
| Task complete celebration | 500–700ms | spring | Earned, not random |
| Companion pet reaction | 300–400ms | spring | Bouncy, not mechanical |
| Loading spinner | continuous | linear | Constant speed — never bouncy |
| Screen navigation push | 300ms | ease-out | Standard page transition |

## 2. Easing: The Feel of Movement

Never use linear for interactive UI — it looks mechanical. Use it only for spinners/progress.

- **ease-out** (most common) — fast start, slows to stop. Anything entering the screen or responding to a tap.
- **ease-in** — slow start, fast end. Elements *leaving* the screen. Never for entrances.
- **ease-in-out** — slow/fast/slow. Elements moving across the screen (drag, reorder).
- **spring** — physics-based, slight overshoot. Buttons, cards, the pet — anything tactile.
- **linear** — constant speed. Only loading spinners and progress bars.

### Spring presets actually used in this codebase

This app uses react-native-reanimated's `withSpring(value, { damping, stiffness })` as the
primary spring API (lower damping / lower stiffness = more bounce). These presets are real
values already proven in the app — reuse them instead of inventing new ones:

```ts
// Snappy — button press-release (components/PressableScale.tsx)
withSpring(1, { damping: 18, stiffness: 320 });

// Playful/bouncy — pet drag-and-drop / celebration hop (components/Pet.tsx)
withSpring(-18, { damping: 5, stiffness: 220 }); // hop up
withSpring(0, { damping: 9, stiffness: 180 });   // settle back down
```

`components/Pet.tsx` was rewritten under Decision 039 to a pure `react-native-reanimated`
implementation (`withSpring`/`withTiming` throughout, no legacy `Animated` calls at all).
`components/ExpandableCard.tsx` and the habit-card pulse in `app/habits.tsx` still use the
legacy `Animated` API with `useNativeDriver: true` and `tension`/`friction` instead of
`damping`/`stiffness` — they're not wrong, just an older API. **New animation code should
default to react-native-reanimated** (`withSpring`/`withTiming`) unless it's extending one of
those existing components, in which
case match the file's existing API rather than mixing both inside one component.

Always set `useNativeDriver: true` (legacy API) — Reanimated's shared values run off the JS
thread by default, so there's no equivalent flag to set there.

## 3. Button Press Feel

The 3-phase lifecycle (press → hold → release) is already implemented as a reusable
primitive: **`components/PressableScale.tsx`**. Use it instead of hand-rolling
`onPressIn`/`onPressOut` + `Animated.spring` on new buttons.

```tsx
<PressableScale scaleTo={0.95} onPress={...}>
  {/* button content */}
</PressableScale>
```

- Press-in: scales to `scaleTo` over 60ms (`withTiming`), fires a light haptic (`haptic` prop, default `true`)
- Press-out: springs back to 1.0 (`withSpring({ damping: 18, stiffness: 320 })`)
- Honors `useAccessibility().reducedMotion` automatically — skips the scale animation when set, haptic still fires

### Scale values by button type — pass as `scaleTo`

| Button type | `scaleTo` | Notes |
|---|---|---|
| Primary action (large) | 0.95 | Most visible press |
| Secondary / ghost button | 0.97 | Subtler |
| Icon button / FAB | 0.90 | More dramatic, punchy |
| List item / card tap | 0.97 | Content shouldn't feel wobbly |
| Companion pet | 0.85 | Squish — it's alive |
| Destructive button (delete) | 0.93 | Weighty, deliberate |

(`PressableScale`'s own default of `0.94` is a reasonable generic fallback when none of the
above fits.)

## 4. Haptic Feedback

**Always go through `lib/haptics.ts` — never import `expo-haptics` directly.** It wraps every
call in try/catch so a missing native module or unsupported platform (web) silently no-ops.

```ts
import { tap, success, selection, warning, confirm, heavy, tug } from '@/lib/haptics';
```

| Helper | Underlying call | Use for |
|---|---|---|
| `tap()` | `impactAsync(Light)` | Default button/icon presses, list selection |
| `confirm()` | `impactAsync(Medium)` | Primary actions, entering a distinct mode (e.g. Focus) |
| `success()` | `notificationAsync(Success)` | Task/habit/shopping completion |
| `warning()` | `notificationAsync(Warning)` | Right before a destructive confirmation dialog |
| `heavy()` | `impactAsync(Heavy)` | The moment a destructive action is actually confirmed, or a drag-and-drop "lands" |
| `selection()` | `selectionAsync()` | Pickers, sliders, crossing a gesture threshold |
| `tug()` | `impactAsync(Medium)` | Reserved for a rotation/boundary-hit gesture; exported but currently unused (its intended consumer, a radial `BubbleMenu`, was dropped before porting — see AGENTS.md) |

Timing matters: fire the haptic at the exact moment of the visual event, on `onPressIn` not
`onPressOut`, at the peak of a celebration animation — not before, not after.

### UnFocus mapping — implemented vs. intentionally different

| Interaction | Helper | Status |
|---|---|---|
| Any `PressableScale` button | `tap()` on press-in | ✅ implemented |
| Task/habit complete | `success()` | ✅ implemented (`PlanTaskCard.tsx`, `app/habits.tsx`) |
| Wheel hits rotation boundary | `tug()` | ✅ implemented |
| Destructive confirm dialogs (automations, habit delete, settings resets, remove child) | `warning()` before the dialog, `heavy()` on confirm | ✅ implemented |
| Companion pet tap | `tap()` | ✅ implemented |
| Focus mode entry | `confirm()` on screen mount | ✅ implemented |
| Shopping add-sheet swipe-to-close | `selection()` once crossing the close threshold, `heavy()` on snap-close | ✅ implemented |
| Error / validation fail | — | ❌ not wired up anywhere yet — no `expo-haptics` Error-style calls exist in the app today |
| Disable-haptics setting | — | ❌ not implemented — `reducedMotion` only gates *visual* motion (see `lib/haptics.ts` header comment); if a "reduce haptics" toggle is ever added it must gate inside `lib/haptics.ts`, not at each call site |

## 5. Micro-Interactions & Dopamine Rewards

Real implementations in this codebase, with where they differ from generic best-practice:

- **Task completion**: `components/PlanTaskCard.tsx` — a done task leaves the pending rail
  and drops into the (collapsed) done zone on the same render, so there's no per-row checkmark
  animation (it would unmount before it could play). The reward is a card-level
  `CompletionGlow` bloom instead — scale 1→1.05 over 300ms ease-out, opacity 1→0.7→0 over
  300ms+400ms ease-out (`withSequence`/`withTiming`, ~700ms total) — paired with `success()`
  fired from `handleToggle`. Mirrors the habit-card glow pattern (`app/habits.tsx`) below.
- **Habit completion**: same `CompletionGlow` + `success()` on the rising edge of "done today"
  (`app/habits.tsx`), plus an infinite 1300ms scale-pulse (1.0↔1.2) while the day's goal stays
  met. There is **no separate "streak extended" bounce/haptic** — extending a streak and
  finishing today's goal are normally the same user action, so a second celebration would
  double-fire alongside the one above. Don't add one without first checking it can't double-fire.
- **Companion pet**: idle breathing is an 1800ms-out/1800ms-back loop (3600ms full cycle,
  slower at rest/faster when excited — see `components/Pet.tsx`'s mood-dependent `breathe`
  loop); tap triggers a `tiltZ` wobble + a floating heart (`withSpring(1.6, { damping: 8,
  stiffness: 80 })`) plus a `tap()` haptic; task/habit completion triggers a hop
  (`withSpring(-18, { damping: 5, stiffness: 220 })` then back down) + glow burst + particles
  + `success()`; eating is a 3-bounce squish (~720ms total). Pet never renders a
  negative/sad state — keep it that way (see §6).
- **Focus mode entry**: fires `confirm()` once on mount (`app/focus.tsx`). There's currently no
  fade-out of "non-relevant" UI on entry — the screen only ever shows one task at a time, so
  there's nothing else on screen to fade.

## 6. What NOT to Do

- Never use linear easing on interactive elements.
- Never animate loading spinners with spring/bounce.
- Never chain more than 2–3 animations in sequence.
- Never add entry animations to screens visited dozens of times per session (tab switches, list taps).
- Never run looping background animations unless the user is actively in a focused mode.
- Never delay a haptic from its visual event.
- Never animate more than 3 elements simultaneously — pick the hero element.
- Never use animation to mask slow loading — use a skeleton screen instead.

### Neurodivergent-specific risks

- No flashing/strobing — seizure risk.
- No large elements moving rapidly across the full screen — visual overwhelm.
- No auto-playing animations without user input — distracting for ADHD.
- Never animate text that needs to be read.
- No more than a few simultaneous moving elements — causes loss of focus.
- Keep celebrations short — the dopamine hit should land, then get out of the way.
- The companion pet must never display a negative state (no sad/angry/punishment) — confirmed already true in `components/Pet.tsx`.

## 7. Reduce Motion: Always Required

`useAccessibility().reducedMotion` (from `lib/useAppTheme.ts`) is the single source of truth
every animated component should read — it's the OR of two independent signals:

1. **Manual in-app toggle** — `reducedMotion` in `store/useSettingsStore.ts`, persisted to
   SQLite, exposed in `app/settings.tsx`'s Accessibility section.
2. **OS-level setting** — a live `AccessibilityInfo.isReduceMotionEnabled()` subscription,
   added directly inside `useAccessibility()`.

The manual toggle never *overrides* the OS setting — it only adds to it, per the "some users
want it in-app without it being system-wide" rationale. Components don't need to do anything
extra; just call the hook:

```ts
const { reducedMotion } = useAccessibility();
const target = reducedMotion ? 1 : withSpring(1, { damping: 18, stiffness: 480 });
```

Haptics are **not** gated by `reducedMotion` — that flag is about visual motion only (see
`lib/haptics.ts` header comment).

## 8. Instructions for Claude Code

Paste this block at the top of any animation/interaction/haptics prompt for this app:

```
When implementing animations, button interactions, or haptics for UnFocus:

TIMING:
  - Button press scale-down: 60-100ms, ease-out (withTiming)
  - Button spring-back: withSpring({ damping: 18-40, stiffness: 200-700 })
  - Card/panel transitions: 200-250ms, ease-out
  - Modal entry: 300-350ms, ease-out
  - Modal exit: 200-250ms, ease-in (exit always faster than enter)
  - Celebration animations: 500-700ms, spring
  - Nothing over 400ms unless it's a celebration

BUTTONS:
  - Use components/PressableScale.tsx, not a hand-rolled Pressable + Animated.spring
  - Pass scaleTo per §3's table (primary 0.95, ghost 0.97, icon/FAB 0.90, list/card 0.97,
    destructive 0.93) — default 0.94 if none fit
  - It already fires a light haptic on press-in and respects reducedMotion — don't duplicate either

SPRINGS (react-native-reanimated, primary pattern in this codebase):
  - Snappy UI: withSpring(v, { damping: 18-40, stiffness: 320-700 })
  - Playful/alive (pet-like, components/Pet.tsx): lower damping, lower stiffness,
    e.g. withSpring(-18, { damping: 5, stiffness: 220 }) for a hop
  - Legacy Animated API (speed/bounciness or tension/friction) only exists in
    components/ExpandableCard.tsx and app/habits.tsx's pulse — match the existing
    file's API, don't mix both in one component

HAPTICS (always via lib/haptics.ts, never raw expo-haptics):
  - Default taps: tap()
  - Primary/confirm actions, entering a distinct mode: confirm()
  - Task/habit/shopping completion: success()
  - Before a destructive confirmation dialog: warning()
  - The moment a destructive action is actually confirmed: heavy()
  - Pickers/sliders/gesture-threshold crossings: selection()
  - Fire at the same moment as the visual peak — never delayed

REDUCE MOTION:
  - Read useAccessibility().reducedMotion from lib/useAppTheme.ts — it's already the union
    of the manual Settings toggle and the OS-level AccessibilityInfo setting
  - When true: skip the animation (snap straight to end value), haptics still fire

NEVER:
  - Linear easing on interactive elements
  - Bouncy/spring on loading spinners (use linear)
  - Auto-playing looping animations without a user trigger
  - Animations on text that needs to be read
  - More than 3 simultaneous animated elements
  - A second celebration haptic/animation that can double-fire with an existing one
    (e.g. don't add a "streak" reward separate from the existing habit-completion glow)
  - Calling expo-haptics directly instead of lib/haptics.ts
```
