/**
 * FormControls.tsx — shared form primitives: Checkbox, Switch, SegmentedControl, Input.
 *
 * Theme-aware wrappers so screens stop hand-rolling checkboxes/toggles with
 * ad-hoc colours. `Switch` wraps the native RN Switch with themed track/thumb
 * colours instead of the OS default green; the others are fully custom.
 *
 * Connections:
 *   Imports → constants/theme, lib/useAppTheme (useAppTheme, useAccessibility), lib/haptics,
 *             lib/i18n (useT — the boolean variants' Yes/No labels),
 *             lib/useDesignLab (useLabControl, useLabShape — see the design-lab note below),
 *             components/PressableScale, components/OptionalTag, components/AnimatedBottomSheet,
 *             react-native-reanimated
 *   Used by → any screen wanting a themed checkbox/switch/segmented-control/input. Switch
 *             callers include components/PlanTaskCard.tsx (2026-08-04 — the quick-add
 *             "add as task/moment" row, task 15's boolean-is-a-slider rule). SegmentedControl
 *             callers gained components/TaskCard.tsx (×6 — card type, task repeat, day picker,
 *             week interval, monthly mode, ordinal) and components/FoodTab.tsx (difficulty)
 *             on 2026-08-09, when SlideSelector was folded into this one.
 *   Data    → none (purely presentational, controlled components)
 *
 * Edit notes:
 *   - All interactive targets respect the 44px minimum hit area.
 *   - **`optional` on Input (2026-07-30)**: renders components/OptionalTag.tsx's "Opt" badge
 *     next to the label, replacing the old inline "(Note (optional))"-style label text —
 *     see app/health-form.tsx/app/medicine-form.tsx for callers. Only meaningful when `label`
 *     is also set.
 *   - SegmentedControl options/labels must already be localized by the caller.
 *   - **SegmentedControl is the app's ONE form-tier pick-one control (2026-08-09).**
 *     `components/SlideSelector.tsx` was a second one wearing the SCREEN tier's accent fill,
 *     so "how often does this repeat" rendered two different ways depending on whether you
 *     asked a habit (here) or a task (there). It's deleted; the full two-tier rule — form tier
 *     = this raised pill, screen tier = TabSlider's accent pill — lives in TabSlider's header.
 *     Three things came across with its 7 call sites: **generics** (`<T extends string |
 *     number>`, so a caller can pick over numbers), **`compact`** (32px segments for a picker
 *     nested inside another field group) and **`disabled`**. Deliberately NOT ported: its
 *     `radius` prop and its inter-segment gap. Radius no longer encodes tier, and the pill
 *     maths here (`segW = (trackW - SEG_PAD*2)/n`) has no gap term — adding one means
 *     re-deriving it, not adding a style key.
 *   - Input border is the screen hue at the field rung normally, and since 2026-08-16 the same
 *     hue walked to legibility by `badgeGlyphFor` (plus a `getGlow` halo) while focused — it was
 *     a flat `borderStrong` before. `bad` on error still beats both. The FILL is `surface`
 *     unless the caller passes `recessed`, which is opt-in and has a measured reason: see that
 *     prop's doc, and don't make it the default.
 *   - **A `recessed` field's halo stays lit at rest** (2026-08-16 "tactile glow" polish pass),
 *     stepping `soft` → `strong` on focus — same as `components/PadTypeRow.tsx`/`AddRow.tsx`'s
 *     identical wells, which this field's `recessed` prop is meant to match. The non-`recessed`
 *     shape (every ordinary bordered Input, on the screen backdrop rather than inside a card)
 *     keeps its old focus-only glow — a permanent halo there would be decoration with nothing
 *     to justify it, per DESIGN_RULES.md rule 15.
 *     Active segment background is `surface` — a raised surface,
 *     not on-colour text. That raised surface is a single sliding pill (Reanimated
 *     translateX, ~150ms ease-out; snaps under reducedMotion, and snaps on its FIRST
 *     placement — see `SegmentedTrack`'s `hasPositioned`) that moves between segments
 *     rather than a per-segment background hard-swap, and fires a `selection()` haptic on
 *     change (the app's one form-tier pick-one control since 2026-08-09 — see TabSlider's two-tier rule).
 *   - **Bordered track (2026-07-21)**: `segmentWrap` got a `theme.border` outline to match
 *     the "raised keycap" border convention IconButton/chips use elsewhere — it previously
 *     had no border at all, reading as visually flatter/plainer than the rest of the app.
 *   - **Switch off-thumb is a fixed white (2026-07-25)**: was `theme.textInverse`, which is
 *     semantically "text on an accent fill" and equals dark mode's `bg` (#080B12) — the
 *     off-state thumb was disappearing into the dark track/card. Thumb color for "off" is
 *     now theme-invariant white, matching how native switches render regardless of theme.
 *   - **Switch pill frame (2026-08-05, task 16 3/N — DESIGN_COMPARISON/16-solid-pressable-
 *     materials.md; restated 2026-08-15 by Tactile Glass)**: audited all four controls against
 *     that task's "controls get edges" rule. Checkbox, SegmentedControl and Input already had a
 *     themed border from earlier passes; the bare native `RNSwitch` was the one gap, so it's
 *     wrapped in a `switchFrame` pill. Tactile Glass then made that frame REACTIVE — accent +
 *     `getGlow` when on, quiet `theme.border` when off — because an `RNSwitch`'s track and thumb
 *     are drawn by the OS and cannot themselves be made into a keycap, so the frame is the only
 *     surface available to carry a high-contrast on-state. No specular highlight
 *     (`__tests__/glassMaterial.test.ts` still asserts that token is gone).
 *   - **A 2026-08-14 device note asked for the frame to be REMOVED** ("toggle sliders do not
 *     need borders" — the objection being that a ring 2px outside a switch's own rounded track
 *     reads as a control inside a control). It was not actioned: Tactile Glass landed the next
 *     day and the maintainer's ruling on the collision was to keep the newer decision. Recorded
 *     because the two are genuinely in tension and the question will come back — if the frame
 *     ever does go, the on-state has to move onto the `trackColor` first, not simply be dropped.
 *   - **The design lab can reshape two of these controls (2026-08-06, lib/designLab.ts).**
 *     `Switch` dispatches on the `boolean` slot (switch · segmented · checkbox · pill) and
 *     `SegmentedControl` on the `choice` slot (segmented · pills · dropdown · sheet); the
 *     shipped shape is the fallback in both, so the branches are unreachable until the lab
 *     says otherwise. The variants are REAL controls, not mock-ups, and they live in this file
 *     on purpose — a variant kept somewhere else drifts from the thing it is meant to replace.
 *     `SegmentedControl` is now a three-line dispatcher; the shipped implementation moved
 *     down into `SegmentedTrack` and is otherwise unchanged.
 *     Border widths and `minHeight` also read the lab's geometry directly here, because these
 *     four controls draw from a module-level `StyleSheet.create()` that this file deliberately
 *     does NOT run through `useScaledStyles` — doing so would start scaling their label text
 *     with the user's Size setting, which is a real behaviour change nobody asked for.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  Switch as RNSwitch,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { computeBorderTone, FontSize, Fonts, getGlow, getRecessedField, OpticalCenter, Radius, Spacing, rgba, MIN_TAP_TARGET } from '@/constants/theme';
import { badgeGlyphFor } from '@/lib/domainColor';
import { useAccessibility, useAppTheme, useIsDark } from '@/lib/useAppTheme';
import { useScreenColor } from '@/lib/screenColor';
import { useToggleColor } from '@/lib/useToggleColor';
import { Duration, Ease } from '@/constants/motion';
import { selection } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import { useLabControl, useLabShape } from '@/lib/useDesignLab';
import PressableScale from '@/components/PressableScale';
import OptionalTag from '@/components/OptionalTag';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';

// ── Checkbox ─────────────────────────────────────────────────────────────────

type CheckboxProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
};

export function Checkbox({ checked, onChange, label, disabled }: CheckboxProps) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const shape = useLabShape();
  // Box fill + border crossfade as checked flips; the checkmark pops in/out on top.
  const boxStyle = useToggleColor(checked, {
    backgroundColor: [rgba(theme.accent, 0), theme.accent],
    borderColor: [theme.border, theme.accent],
  });
  return (
    <PressableScale
      onPress={() => onChange(!checked)}
      disabled={disabled}
      scaleTo={0.97}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[styles.checkboxRow, { opacity: disabled ? 0.5 : 1, minHeight: shape.minTapTarget }]}
    >
      <Animated.View style={[styles.checkboxBox, { borderRadius: (Radius.sm / 2) * shape.radiusScale }, boxStyle]}>
        {checked ? (
          <Animated.View
            entering={reducedMotion ? undefined : ZoomIn.duration(Duration.micro)}
            exiting={reducedMotion ? undefined : ZoomOut.duration(Duration.micro)}
          >
            <Ionicons name="checkmark" size={16} color={theme.accentInk} />
          </Animated.View>
        ) : null}
      </Animated.View>
      {label ? <Text style={[styles.checkboxLabel, { color: theme.text }]}>{label}</Text> : null}
    </PressableScale>
  );
}

// ── Switch ───────────────────────────────────────────────────────────────────

type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function Switch({ checked, onChange, disabled, accessibilityLabel }: SwitchProps) {
  const theme = useAppTheme();
  const t = useT();
  // Design lab (lib/designLab.ts): which SHAPE answers a yes/no question. Resolves to
  // 'switch' — what the app ships — unless the lab says otherwise, so this dispatch is inert
  // for a normal user. The point of switching it here rather than in a mock is that every
  // boolean row in Settings and every editor changes at once, which is the only way to judge
  // whether a shape actually works.
  const variant = useLabControl('boolean');
  const shape = useLabShape();

  if (variant === 'checkbox') {
    return (
      <View style={[styles.switchRow, { minHeight: shape.minTapTarget }]}>
        <Checkbox checked={checked} onChange={onChange} disabled={disabled} />
      </View>
    );
  }

  if (variant === 'segmented') {
    return (
      <View style={[styles.switchRow, { minHeight: shape.minTapTarget }]}>
        <SegmentedControl
          style={styles.booleanSegments}
          value={checked ? 'yes' : 'no'}
          onChange={(next) => onChange(next === 'yes')}
          options={[
            { value: 'no', label: t.no },
            { value: 'yes', label: t.yes },
          ]}
        />
      </View>
    );
  }

  if (variant === 'pill') {
    return (
      <View style={[styles.switchRow, { minHeight: shape.minTapTarget }]}>
        <PressableScale
          onPress={() => { selection(); onChange(!checked); }}
          disabled={disabled}
          scaleTo={0.97}
          accessibilityRole="switch"
          accessibilityState={{ checked }}
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.booleanPill,
            {
              backgroundColor: checked ? theme.accent : 'transparent',
              borderColor: checked ? theme.accent : theme.border,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        >
          <Text style={[styles.booleanPillLabel, { color: checked ? theme.accentInk : theme.textMuted }]}>
            {checked ? t.yes : t.no}
          </Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={[styles.switchRow, { minHeight: shape.minTapTarget }]}>
      {/* ── The hardware toggle (Tactile Glass, 2026-08-15) ─────────────────────────────────
          The brief asks for "physical hardware toggles with high-contrast, glowing 'On'
          states, leaving no doubt about the setting". That is a FINISH, not a different
          control, so this stays a slider and DESIGN_RULES.md rule 19a is untouched — "a
          boolean is always a slider… never a checkbox, a pill, a chip, a tick, or a
          highlighted row. One shape, everywhere." (Rule 19a is a maintainer ruling from
          DESIGN_COMPARISON/15; components/ReminderBell.tsx remains its ONE documented
          exception and nothing here widens it.)

          The frame does the work, because the thumb and track of an `RNSwitch` are rendered
          by the OS and cannot be made into a keycap. On, it wears the accent and a
          `getGlow` halo; off, it is the same quiet `border` ring every other field has. The
          halo is the one place a glow is allowed outside a primary action — an engaged toggle
          IS the active element in its row, which is what DESIGN_RULES.md rule 15 asks of
          `getGlow`, and it is static rather than breathing, so GlowPulse's
          "never more than one breathing halo at once" is unaffected. */}
      <View
        style={[
          styles.switchFrame,
          {
            borderColor: checked ? theme.accent : theme.border,
            borderWidth: shape.borderFieldWidth * shape.borderScale,
          },
          checked && !disabled ? getGlow(theme.accent, 'soft') : null,
        ]}
      >
        <RNSwitch
          value={checked}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={accessibilityLabel}
          // ON is the full `accent`, not `accentSoft`. The soft token is a near-black navy in
          // dark mode, so the old on-state differed from off mainly by the thumb — "no doubt
          // about the setting" is exactly what it lacked.
          trackColor={{ false: theme.surfaceMuted, true: theme.accent }}
          // Fixed white in BOTH states now, which is the classic slider read: the thumb is
          // constant and the track behind it changes. It was `theme.accent` when on, which on
          // an accent track would be an invisible thumb. The off-state reasoning is unchanged
          // and still applies (2026-07-25 contrast fix): NOT `theme.textInverse`, which flips
          // to near-black in dark mode — it means "text on an accent-coloured fill" — and made
          // the off thumb nearly invisible against the dark track.
          thumbColor="#FFFFFF"
        />
      </View>
    </View>
  );
}

/**
 * `<HardwareToggle>` — the Tactile Glass brief's name for `Switch` (2026-08-15). An alias, for
 * the same reason `Surface` exports `GlassCard` and `Button` exports `TactileButton`: this is
 * already the app's one boolean control, and a parallel component would immediately violate
 * rule 19a's "one shape, everywhere" by existing. Prefer importing `Switch` in app code.
 */
export const HardwareToggle = Switch;

// ── SegmentedControl ─────────────────────────────────────────────────────────

export type SegmentedOption<T extends string | number = string> = { value: T; label: string };

type SegmentedControlProps<T extends string | number = string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  style?: StyleProp<ViewStyle>;
  /** Greys the track out and swallows presses. */
  disabled?: boolean;
  /**
   * Shorter segments and a smaller label, for a picker nested inside another field group —
   * TaskCard's week-interval / monthly-mode / ordinal rows, FoodTab's difficulty. Ported
   * verbatim from the deleted `SlideSelector` (2026-08-09) along with those call sites, so
   * the sub-`MIN_TAP_TARGET` height it produces is not a NEW instance of DESIGN_RULES.md
   * open conflict #6 — it is the same one, relocated.
   */
  compact?: boolean;
};

const SEG_PAD = 4;
/** Compact segment height — the value `SlideSelector` used at these call sites before it was
 *  deleted (2026-08-09). Its track is that plus `SEG_PAD` top and bottom. */
const COMPACT_SEGMENT_HEIGHT = 32;
const COMPACT_TRACK_HEIGHT = COMPACT_SEGMENT_HEIGHT + SEG_PAD * 2;

export function SegmentedControl<T extends string | number = string>({
  options,
  value,
  onChange,
  style,
  disabled,
  compact,
}: SegmentedControlProps<T>) {
  // Design lab: which SHAPE answers a pick-one question. 'segmented' is what the app ships,
  // so the three branches below are unreachable until the lab says otherwise. They are real
  // controls rather than mock-ups because the question being asked ("does a picker read better
  // than a row of segments at 360px in Norwegian?") can only be answered on the real screens.
  const variant = useLabControl('choice');
  const shared = { options, value, onChange, style, disabled, compact };
  if (variant === 'pills') return <PillChoice {...shared} />;
  if (variant === 'dropdown') return <ListChoice {...shared} mode="inline" />;
  if (variant === 'sheet') return <ListChoice {...shared} mode="sheet" />;
  return <SegmentedTrack {...shared} />;
}

/** The shipped shape: a sliding pill over a bordered track. */
function SegmentedTrack<T extends string | number>({
  options,
  value,
  onChange,
  style,
  disabled,
  compact,
}: SegmentedControlProps<T>) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const shape = useLabShape();
  const [track, setTrack] = useState({ w: 0, h: 0 });

  const n = options.length;
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = track.w > 0 ? (track.w - SEG_PAD * 2) / n : 0;
  const pillH = Math.max(0, track.h - SEG_PAD * 2);

  const tx = useSharedValue(0);
  // **The first placement SNAPS; only a later change animates (2026-08-14).** This effect used
  // to run unguarded, and on the first render `track.w` is 0, so `segW` is 0 and the target was
  // `activeIndex * 0` = 0 — the leftmost segment. When `onLayout` then reported a real width the
  // effect re-ran with the true target and `withTiming` slid the pill in from the left. So every
  // segmented control in the app replayed a pick the user made months ago, every single time its
  // screen mounted (maintainer, on device: *"Sliders that look like tabs move each time you go to
  // the screen, they move to the right from the left most position"*). Two guards, and BOTH are
  // needed: bailing while unmeasured stops the pill ever being aimed at 0, and the ref makes the
  // first REAL placement an assignment rather than a curve. This is a straight port of the same
  // fix `components/TabSlider.tsx` took on 2026-08-05 (see its doc block) — that control snapped
  // and this one didn't, which is why the screen-tier tabs looked right and the form-tier ones
  // inside Settings' cards did not. `components/BottomNav.tsx` carries a third copy.
  const hasPositioned = useRef(false);
  useEffect(() => {
    if (segW <= 0) return;
    const to = activeIndex * segW;
    if (reducedMotion || !hasPositioned.current) tx.value = to;
    else tx.value = withTiming(to, { duration: Duration.control, easing: Ease.enter });
    hasPositioned.current = true;
  }, [activeIndex, segW, reducedMotion, tx]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setTrack((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };

  return (
    <View
      style={[
        styles.segmentWrap,
        {
          backgroundColor: theme.surfaceMuted,
          borderColor: theme.border,
          borderWidth: shape.borderFieldWidth * shape.borderScale,
          borderRadius: Radius.sm * shape.radiusScale,
          // A compact track must NOT carry the full tap-target floor, or the shorter segments
          // inside it are centred in a box that never shrank and the row costs the same height.
          // Stated explicitly rather than omitted: `segmentWrap` sets `minHeight` statically,
          // so leaving the key out here leaves the 48px floor in place.
          minHeight: compact ? COMPACT_TRACK_HEIGHT : shape.minTapTarget,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      onLayout={onLayout}
    >
      {/* Sliding raised-surface indicator — rendered first so it paints beneath the labels. */}
      {segW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentPill,
            { width: segW, height: pillH, top: SEG_PAD, left: SEG_PAD, backgroundColor: theme.surface, shadowColor: theme.shadow },
            pillStyle,
          ]}
        />
      )}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <PressableScale
            key={String(opt.value)}
            onPress={() => {
              if (disabled) return;
              if (opt.value !== value) selection();
              onChange(opt.value);
            }}
            disabled={disabled}
            scaleTo={0.97}
            // The SHIPPED variant announced nothing at all — no role, no selected state — while
            // `PillChoice` below (a design-lab variant almost nobody runs) had both. So every
            // segmented control in the app, including Settings' own tabs, was a set of unlabelled
            // taps to a screen reader. Same pair as PillChoice, deliberately.
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            style={[styles.segment, compact && styles.segmentCompact]}
          >
            {/* `numberOfLines={1}` came across with SlideSelector's call sites, and on its own
                it made the 15 PRE-EXISTING callers truncate where they used to wrap onto a
                second line (measured: `npm run wraps --lang=no --width=327` went 4 truncated
                → 9). Shrink-to-fit is the better degradation and is already what
                components/TabSlider.tsx does, so the two controls now handle a long label the
                same way. react-native-web implements neither prop, so the wrap audit still
                REPORTS these — that is the documented web-only artifact, not a real defect. */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[
                compact ? styles.segmentLabelCompact : styles.segmentLabel,
                { color: active ? theme.text : theme.textMuted },
              ]}
            >
              {opt.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * Design-lab variant: every option visible as its own pill, wrapping onto a second line rather
 * than being squeezed. Trades the segmented track's tidy single line for legibility when the
 * labels are long — which in this app means Norwegian.
 */
function PillChoice<T extends string | number>({
  options,
  value,
  onChange,
  style,
  disabled,
  compact,
}: SegmentedControlProps<T>) {
  const theme = useAppTheme();
  const shape = useLabShape();
  return (
    <View style={[styles.pillRow, style, disabled ? { opacity: 0.5 } : null]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <PressableScale
            key={String(opt.value)}
            onPress={() => {
              if (disabled) return;
              if (opt.value !== value) selection();
              onChange(opt.value);
            }}
            disabled={disabled}
            scaleTo={0.97}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            style={[
              styles.choicePill,
              {
                minHeight: compact ? COMPACT_SEGMENT_HEIGHT : shape.minTapTarget,
                backgroundColor: active ? theme.accent : 'transparent',
                borderColor: active ? theme.accent : theme.border,
                borderWidth: shape.borderButtonWidth * shape.borderScale,
              },
            ]}
          >
            <Text
              style={[
                compact ? styles.segmentLabelCompact : styles.segmentLabel,
                { color: active ? theme.accentInk : theme.textMuted },
              ]}
            >
              {opt.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * Design-lab variant: a single row showing the CURRENT value, which opens the full list.
 *
 * `mode` is the only difference between the lab's 'dropdown' and 'sheet' variants — inline
 * expands the list under the trigger, sheet lifts it into a bottom sheet. Both collapse the
 * control to one line at rest, which is the property being evaluated.
 */
function ListChoice<T extends string | number>({
  options,
  value,
  onChange,
  style,
  disabled,
  mode,
}: SegmentedControlProps<T> & { mode: 'inline' | 'sheet' }) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const fieldHue = useScreenColor() ?? theme.border;
  const shape = useLabShape();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  const pick = (next: T) => {
    if (next !== value) selection();
    onChange(next);
    setOpen(false);
  };

  const list = (
    <View style={styles.choiceList}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <PressableScale
            key={String(opt.value)}
            onPress={() => pick(opt.value)}
            scaleTo={0.98}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.choiceListRow, { minHeight: shape.minTapTarget }]}
          >
            <Text style={[styles.choiceListLabel, { color: active ? theme.text : theme.textMuted }]}>
              {opt.label}
            </Text>
            {active ? <Ionicons name="checkmark" size={18} color={theme.accent} /> : null}
          </PressableScale>
        );
      })}
    </View>
  );

  return (
    <View style={style}>
      <PressableScale
        onPress={() => setOpen((v) => !v)}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[
          styles.choiceTrigger,
          {
            minHeight: shape.minTapTarget,
            borderColor: computeBorderTone(fieldHue, isDark, 'field', shape.borderRampStrength),
            borderWidth: shape.borderFieldWidth * shape.borderScale,
            borderRadius: Radius.sm * shape.radiusScale,
            backgroundColor: theme.surface,
          },
        ]}
      >
        <Text style={[styles.choiceListLabel, { color: theme.text }]} numberOfLines={1}>
          {current?.label ?? ''}
        </Text>
        <Ionicons name={open && mode === 'inline' ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textMuted} />
      </PressableScale>

      {mode === 'inline' && open ? list : null}
      {mode === 'sheet' ? (
        <AnimatedBottomSheet visible={open} onClose={() => setOpen(false)}>
          {list}
        </AnimatedBottomSheet>
      ) : null}
    </View>
  );
}

// ── Input ────────────────────────────────────────────────────────────────────

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  /** Renders a small "Opt" tag beside the label — this field isn't required to save. */
  optional?: boolean;
  /**
   * Style for the wrapping `View`, not the field. `style` lands on the `TextInput` itself,
   * which is the wrong element for anything positional: a caller putting this field in a ROW
   * (TaskCard's title + voice mic, its add-step + button) needs `flex: 1` + `minWidth: 0` on
   * the WRAPPER, or the wrapper keeps its intrinsic width and pushes its neighbour out
   * through the card's overflow mask. Added 2026-08-09 with those two call sites.
   */
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Draw this field as a RECESSED WELL — sunk into the pane, no resting stroke — instead of the
   * default bordered box (2026-08-16, brief §8's "Per-Card Inline Inputs").
   *
   * ⚠️ **Opt-in, and it must stay opt-in.** A recess is a relationship to the surface a field is
   * sunk INTO, so it is only legible when the field is inside a card. This component is also
   * mounted straight onto the screen backdrop (every editor: `app/medicine-form.tsx`,
   * `app/health-form.tsx`, …), and there a `rgba(0,0,0,0.35)` wash on a near-black backdrop with
   * no resting stroke makes the field vanish — measured in the web preview, not theorised: the
   * medicine form's Name/Dose/Note rendered as bare text with no boundary at all.
   *
   * So: pass this only from a composer that is contractually inside a Surface. Today that is
   * `components/InlineAddItem.tsx` alone, which passes it so Shopping's composer matches
   * `components/PadTypeRow.tsx` and `components/AddRow.tsx` — the three are meant to be ONE
   * field, and letting one of them keep a border while the other two lost theirs is exactly the
   * divergence AddRow's header warns against.
   */
  recessed?: boolean;
};

/**
 * `forwardRef` so a caller that needs the underlying `TextInput` — `useKeyboardLift`, an
 * imperative `.focus()` — can use THIS field instead of hand-rolling a bordered one beside
 * it. `components/ShoppingFilterBar.tsx` had done exactly that and drifted: its search box
 * kept no border at all through the 2026-08-05 reset, sitting next to its own bordered
 * category button. Nothing passed a ref before 2026-08-08, so this is purely additive.
 */
export const Input = React.forwardRef<TextInput, InputProps>(function Input(
  { label, error, optional, style, containerStyle, recessed, onFocus, onBlur, ...rest },
  ref
) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const fieldHue = useScreenColor() ?? theme.border;
  const shape = useLabShape();
  const [focused, setFocused] = useState(false);
  // ── This field KEEPS its resting border, and that is a scope decision (2026-08-16) ────────
  // Brief §8 asks for recessed, borderless wells — but its own title is *"Per-Card Inline
  // Inputs"* and its first line is *"the user creates items directly inside each category
  // card"*. That scope is load-bearing rather than incidental: a recess is a relationship to
  // the PANE a field is sunk into, and this component is the one field in the app with no such
  // guarantee. `components/PadTypeRow.tsx` and `components/AddRow.tsx` are contractually
  // mounted inside a card (see AddRow's "do NOT wrap it in its own card"); this one is mounted
  // in editors and sheets, where it sits directly on the screen backdrop.
  //
  // It was briefly given the recessed treatment anyway, and the web preview caught what that
  // does: on `app/medicine-form.tsx` the Name/Dose/Note fields sit on the near-black backdrop,
  // so a `rgba(0,0,0,0.35)` wash on near-black is invisible and, with the resting stroke gone,
  // the fields disappeared entirely — bare text floating with no boundary. A field that does
  // not look like a field is the exact complaint the 2026-08-13 Shopping pass fixed in the
  // other direction. So the fill and the resting border stay as they were.
  //
  // What DID come across from §8 is the focus state, which is pure gain and carries no such
  // risk: the ring is the screen's own hue rather than a flat `borderStrong`, walked toward the
  // ground by `badgeGlyphFor` until it clears 3.3:1 on the fill. Outside a screen that provides
  // a hue, `fieldHue` is already `theme.border` and the walk leaves it alone, so a modal's field
  // keeps a neutral ring rather than inventing a colour. Error still WINS over focus, unchanged
  // — a state the user needs to fix must beat a decorative hue (DESIGN_RULES.md rule 18).
  //
  // A caller that IS contractually inside a card can opt into the recessed well via `recessed`
  // — see that prop's doc for why it is opt-in rather than the default.
  const recess = getRecessedField(theme.surface, isDark);
  const fill = recessed ? recess.paint : theme.surface;
  const focusGround = recessed ? recess.composite : theme.surface;
  const borderColor = error
    ? theme.bad
    : focused
      ? badgeGlyphFor(fieldHue, focusGround, isDark)
      : recessed
        ? 'transparent'
        : computeBorderTone(fieldHue, isDark, 'field', shape.borderRampStrength);

  return (
    <View style={containerStyle}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.inputLabel, { color: theme.textMuted }]}>{label}</Text>
          {optional && <OptionalTag />}
        </View>
      ) : null}
      <TextInput
        {...rest}
        ref={ref}
        placeholderTextColor={theme.textMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          // Reinforcement only — see AddRow's note on why a boxShadow on a bare TextInput is
          // acceptable here: `borderColor` above already carries the focus state, so rule 18
          // holds even where Android declines to paint this.
          //
          // **`recessed` fields stay lit at rest, not just on focus (2026-08-16, "tactile glow"
          // polish pass)** — the same change PadTypeRow/AddRow's identical wells got, and for
          // the same reason: a sunken well with no light of its own reads as flat/grey against
          // the dark glass card it's inside. Scoped to `recessed` only — the ordinary bordered
          // Input (every editor: medicine-form, health-form, …) sits on the screen backdrop, not
          // inside a card, and keeps its resting stroke with no permanent glow, unchanged.
          error
            ? null
            : recessed
              ? getGlow(fieldHue, focused ? 'strong' : 'soft')
              : focused
                ? getGlow(fieldHue, 'soft')
                : null,
          {
            color: theme.text,
            borderColor,
            backgroundColor: fill,
            borderWidth: shape.borderFieldWidth * shape.borderScale,
            borderRadius: Radius.sm * shape.radiusScale,
            minHeight: shape.minTapTarget,
          },
          style,
        ]}
      />
      {error ? <Text style={[styles.inputError, { color: theme.bad }]}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TAP_TARGET,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  checkboxLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
  },
  segmentWrap: {
    flexDirection: 'row',
    borderRadius: Radius.sm,
    padding: 4,
    minHeight: MIN_TAP_TARGET,
    borderWidth: 1.5,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.sm - 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Four one-word options ("Full · Simple · Note · Steps") share one track at 327px in
    // Norwegian, so a segment must be allowed to give up its intrinsic width. Without this
    // the row overflows instead of the labels shrinking — the same `flex` + `minWidth: 0`
    // pair TaskCard's title input documents at length.
    minWidth: 0,
    paddingHorizontal: Spacing.xs,
  },
  segmentCompact: {
    minHeight: COMPACT_SEGMENT_HEIGHT,
  },
  // Sliding active indicator (raised surface). Carries the shadow the active segment used to.
  segmentPill: {
    position: 'absolute',
    borderRadius: Radius.sm - 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  switchRow: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
  },
  // Pill ring around the native Switch — alignSelf so it hugs the switch's own size rather
  // than stretching to switchRow's width (switchRow has no width of its own; it inherits
  // whatever its row-layout caller gives it).
  switchFrame: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: Radius.full,
    padding: 2,
  },
  // OpticalCenter: without it, Android adds font-metric padding below the glyph baseline that
  // alignItems:'center' doesn't account for, so the label optically sits low inside the segment
  // (carried over from SlideSelector and TabSlider).
  segmentLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semibold,
    ...OpticalCenter,
  },
  segmentLabelCompact: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
    ...OpticalCenter,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
  },
  input: {
    minHeight: MIN_TAP_TARGET,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
  },
  inputError: {
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  // ── Design-lab control variants (lib/designLab.ts) ──────────────────────────
  // Only reachable while the lab has reassigned a control slot. They are ordinary styles
  // rather than a separate stylesheet so the variants stay inside the component that owns the
  // real one — a variant living somewhere else is a variant that drifts from what it replaces.
  booleanSegments: { minWidth: 132 },
  booleanPill: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
  },
  booleanPillLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semibold,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  choicePill: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
  },
  choiceTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
  },
  choiceList: {
    marginTop: Spacing.xs,
  },
  choiceListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  choiceListLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semibold,
  },
});
