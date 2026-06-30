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
| BubbleMenu open | 250–350ms | spring | See §5 — this app's BubbleMenu is a spinning wheel, not a fan-out; tuned for a fast, bouncy "sprettball" launch (ζ≈0.41), not a calm glide |
| Task complete celebration | 500–700ms | spring | Earned, not random |
| Companion pet reaction | 300–400ms | spring | Bouncy, not mechanical |
| Loading spinner | continuous | linear | Constant speed — never bouncy |
| Screen navigation push | 300ms | ease-out | Standard page transition |

## 2. Easing: The Feel of Movement

Never use linear for interactive UI — it looks mechanical. Use it only for spinners/progress.

- **ease-out** (most common) — fast start, slows to stop. Anything entering the screen or responding to a tap.
- **ease-in** — slow start, fast end. Elements *leaving* the screen. Never for entrances.
- **ease-in-out** — slow/fast/slow. Elements moving across the screen (drag, reorder).
- **spring** — physics-based, slight overshoot. Buttons, cards, BubbleMenu, the pet — anything tactile.
- **linear** — constant speed. Only loading spinners and progress bars.

### Spring presets actually used in this codebase

This app uses react-native-reanimated's `withSpring(value, { damping, stiffness })` as the
primary spring API (lower damping / lower stiffness = more bounce). These three presets are
real values already proven in the app — reuse them instead of inventing new ones:

```ts
// Snappy — button press-release (components/PressableScale.tsx)
withSpring(1, { damping: 18, stiffness: 320 });

// Normal — BubbleMenu open/close (components/BubbleMenu.tsx)
// "Sprettball" (bouncing-ball) feel — fast launch with a visible springy overshoot,
// ζ≈0.41 across the full range. Uses variable stiffness scaled by spring-intensity (debug overlay),
// with damping scaling proportionally so the ratio stays constant.
// At default spring-intensity: openStiffness=350, damping=0.82*√350≈15.3 → ζ≈0.41
const openStiffness = clamp(350 * springScale, 80, 1400);
withSpring(toValue, { damping: 0.82 * Math.sqrt(openStiffness), stiffness: openStiffness });

// Playful/bouncy — pet & drag-and-drop interactions (components/Pet.tsx)
// (legacy Animated API, tension/friction rather than damping/stiffness — see below)
Animated.spring(value, { toValue: 1.5, tension: 280, friction: 4, useNativeDriver: true });
```

`components/Pet.tsx`, `components/TaskItem.tsx`, `components/ExpandableCard.tsx`, and the
habit-card pulse in `app/habits.tsx` still use the legacy `Animated` API with
`useNativeDriver: true` and `tension`/`friction` instead of `damping`/`stiffness` — they're
not wrong, just an older API. **New animation code should default to react-native-reanimated**
(`withSpring`/`withTiming`) unless it's extending one of those existing components, in which
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
| BubbleMenu items | 0.88 | Each item its own spring feel |
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
| `tug()` | `impactAsync(Medium)` | BubbleMenu-specific: wheel hits its rotation boundary |

Timing matters: fire the haptic at the exact moment of the visual event, on `onPressIn` not
`onPressOut`, at the peak of a celebration animation — not before, not after.

### UnFocus mapping — implemented vs. intentionally different

| Interaction | Helper | Status |
|---|---|---|
| Any `PressableScale` button | `tap()` on press-in | ✅ implemented |
| Task/habit complete | `success()` | ✅ implemented (`TaskItem.tsx`, `app/habits.tsx`) |
| BubbleMenu open/close | `tap()` | ✅ implemented |
| BubbleMenu item tap | `tap()` | ✅ implemented as Light, *not* Medium — already hand-tuned alongside the wheel's spring physics; left as-is rather than risk a regression in `BubbleMenu.tsx` (see that file's merge-risk warning) |
| Wheel hits rotation boundary | `tug()` | ✅ implemented |
| Destructive confirm dialogs (automations, habit delete, settings resets, remove child) | `warning()` before the dialog, `heavy()` on confirm | ✅ implemented |
| Companion pet tap | `tap()` | ✅ implemented |
| Focus mode entry | `confirm()` on screen mount | ✅ implemented |
| Shopping add-sheet swipe-to-close | `selection()` once crossing the close threshold, `heavy()` on snap-close | ✅ implemented |
| Error / validation fail | — | ❌ not wired up anywhere yet — no `expo-haptics` Error-style calls exist in the app today |
| Disable-haptics setting | — | ❌ not implemented — `reducedMotion` only gates *visual* motion (see `lib/haptics.ts` header comment); if a "reduce haptics" toggle is ever added it must gate inside `lib/haptics.ts`, not at each call site |

## 5. Micro-Interactions & Dopamine Rewards

Real implementations in this codebase, with where they differ from generic best-practice:

- **Task completion**: `components/TaskItem.tsx` — checkmark scale-pops to 1.35 then springs
  back (`friction: 4`) over ~120ms+spring, paired with `success()` and a `CompletionGlow`
  bloom (180ms fade-in, 760ms fade-out). Total feel is shorter than a generic 500–700ms
  celebration target — intentional, keeps repeated daily completions snappy rather than slow.
- **Habit completion**: same `CompletionGlow` + `success()` on the rising edge of "done today"
  (`app/habits.tsx`), plus an infinite 1300ms scale-pulse (1.0↔1.2) while the day's goal stays
  met. There is **no separate "streak extended" bounce/haptic** — extending a streak and
  finishing today's goal are normally the same user action, so a second celebration would
  double-fire alongside the one above. Don't add one without first checking it can't double-fire.
- **BubbleMenu**: this is a **lottery-wheel rotation**, not a radial fan-out — 3 full + 2
  half-visible bubbles spin into a clamped range and spring-snap to rest (`BubbleMenu.tsx`).
  There's no per-item stagger to add; the whole wheel moves as one physics object. The
  open/close spring (`OPEN_SPRING`) is tuned for a "sprettball" feel — launches fast and
  settles with a visible bounce (variable stiffness via `openStiffness = clamp(350 * springScale, 80, 1400)`
  and `damping = 0.82 * √openStiffness`, maintaining ζ≈0.41 across the full range) rather than
  a calm, lightly-damped pop.
- **Companion pet**: idle bob is a 1400ms-out/1400ms-back loop (2800ms full cycle); tap
  triggers a happy bounce (`tension: 280, friction: 4` → `tension: 80, friction: 6`) plus a
  floating heart and a `tap()` haptic; eating is a 4-bounce squish (~440ms total). Pet never
  renders a negative/sad state — keep it that way (see §6).
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
  - Normal/bouncy (BubbleMenu "sprettball" open/close): variable formula with openStiffness=clamp(350*springScale,80,1400) and damping=0.82*√openStiffness, maintaining ζ≈0.41
  - Playful/alive (pet-like): lower damping, lower stiffness
  - Legacy Animated API (speed/bounciness or tension/friction) only exists in
    components/Pet.tsx, components/TaskItem.tsx, components/ExpandableCard.tsx,
    app/habits.tsx's pulse — match the existing file's API, don't mix both in one component

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
