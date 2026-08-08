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
 *             "add as task/moment" row, task 15's boolean-is-a-slider rule)
 *   Data    → none (purely presentational, controlled components)
 *
 * Edit notes:
 *   - All interactive targets respect the 44px minimum hit area.
 *   - **`optional` on Input (2026-07-30)**: renders components/OptionalTag.tsx's "Opt" badge
 *     next to the label, replacing the old inline "(Note (optional))"-style label text —
 *     see app/health-form.tsx/app/medicine-form.tsx for callers. Only meaningful when `label`
 *     is also set.
 *   - SegmentedControl options/labels must already be localized by the caller.
 *   - Input border is `border` normally, `borderStrong` while focused (or `bad` on error,
 *     regardless of focus); active segment background is `surface` — a raised surface,
 *     not on-colour text. That raised surface is a single sliding pill (Reanimated
 *     translateX, ~150ms ease-out; snaps under reducedMotion) that moves between segments
 *     rather than a per-segment background hard-swap, and fires a `selection()` haptic on
 *     change (same motion contract as components/SlideSelector.tsx).
 *   - **Bordered track (2026-07-21)**: `segmentWrap` got a `theme.border` outline to match
 *     the "raised keycap" border convention IconButton/chips use elsewhere — it previously
 *     had no border at all, reading as visually flatter/plainer than the rest of the app.
 *   - **Switch off-thumb is a fixed white (2026-07-25)**: was `theme.textInverse`, which is
 *     semantically "text on an accent fill" and equals dark mode's `bg` (#080B12) — the
 *     off-state thumb was disappearing into the dark track/card. Thumb color for "off" is
 *     now theme-invariant white, matching how native switches render regardless of theme.
 *   - **Switch pill frame (2026-08-05, task 16 3/N — DESIGN_COMPARISON/16-solid-pressable-
 *     materials.md)**: audited all four controls against that task's "controls get edges"
 *     rule. Checkbox, SegmentedControl and Input already had a themed border from earlier
 *     passes; the bare native `RNSwitch` was the one gap, so it's now wrapped in a static
 *     `theme.border` pill (`switchFrame`) — same non-reactive-border convention as
 *     `segmentWrap`, since the track/thumb colors already carry on/off state. No specular
 *     highlight added (`__tests__/glassMaterial.test.ts` still asserts that token is gone).
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
import React, { useEffect, useState } from 'react';
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
import { computeBorderTone, FontSize, Fonts, Radius, Spacing, rgba, MIN_TAP_TARGET } from '@/constants/theme';
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
      {/* Themed frame (task 16, 3/N) — the bare native switch was the one FormControls
          control with no edge at all; matches segmentWrap's static theme.border ring rather
          than reacting to checked, since the track colors below already carry on/off state. */}
      <View style={[styles.switchFrame, { borderColor: theme.border, borderWidth: shape.borderFieldWidth * shape.borderScale }]}>
        <RNSwitch
          value={checked}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={accessibilityLabel}
          trackColor={{ false: theme.surfaceMuted, true: theme.accentSoft }}
          // Off-thumb is a fixed white, not theme.textInverse — that token flips to near-black
          // in dark mode (it means "text on an accent-colored fill"), which made the off-state
          // thumb nearly invisible against the dark track (2026-07-25 contrast fix).
          thumbColor={checked ? theme.accent : '#FFFFFF'}
        />
      </View>
    </View>
  );
}

// ── SegmentedControl ─────────────────────────────────────────────────────────

type SegmentedOption = { value: string; label: string };

type SegmentedControlProps = {
  options: SegmentedOption[];
  value: string;
  onChange: (next: string) => void;
  style?: StyleProp<ViewStyle>;
};

const SEG_PAD = 4;

export function SegmentedControl({ options, value, onChange, style }: SegmentedControlProps) {
  // Design lab: which SHAPE answers a pick-one question. 'segmented' is what the app ships,
  // so the three branches below are unreachable until the lab says otherwise. They are real
  // controls rather than mock-ups because the question being asked ("does a picker read better
  // than a row of segments at 360px in Norwegian?") can only be answered on the real screens.
  const variant = useLabControl('choice');
  if (variant === 'pills') return <PillChoice options={options} value={value} onChange={onChange} style={style} />;
  if (variant === 'dropdown') return <ListChoice options={options} value={value} onChange={onChange} style={style} mode="inline" />;
  if (variant === 'sheet') return <ListChoice options={options} value={value} onChange={onChange} style={style} mode="sheet" />;
  return <SegmentedTrack options={options} value={value} onChange={onChange} style={style} />;
}

/** The shipped shape: a sliding pill over a bordered track. */
function SegmentedTrack({ options, value, onChange, style }: SegmentedControlProps) {
  const theme = useAppTheme();
  const { reducedMotion } = useAccessibility();
  const shape = useLabShape();
  const [track, setTrack] = useState({ w: 0, h: 0 });

  const n = options.length;
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = track.w > 0 ? (track.w - SEG_PAD * 2) / n : 0;
  const pillH = Math.max(0, track.h - SEG_PAD * 2);

  const tx = useSharedValue(0);
  useEffect(() => {
    const to = activeIndex * segW;
    tx.value = reducedMotion ? to : withTiming(to, { duration: Duration.control, easing: Ease.enter });
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
          minHeight: shape.minTapTarget,
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
            key={opt.value}
            onPress={() => {
              if (opt.value !== value) selection();
              onChange(opt.value);
            }}
            scaleTo={0.97}
            // The SHIPPED variant announced nothing at all — no role, no selected state — while
            // `PillChoice` below (a design-lab variant almost nobody runs) had both. So every
            // segmented control in the app, including Settings' own tabs, was a set of unlabelled
            // taps to a screen reader. Same pair as PillChoice, deliberately.
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={styles.segment}
          >
            <Text style={[styles.segmentLabel, { color: active ? theme.text : theme.textMuted }]}>
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
function PillChoice({ options, value, onChange, style }: SegmentedControlProps) {
  const theme = useAppTheme();
  const shape = useLabShape();
  return (
    <View style={[styles.pillRow, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <PressableScale
            key={opt.value}
            onPress={() => {
              if (opt.value !== value) selection();
              onChange(opt.value);
            }}
            scaleTo={0.97}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[
              styles.choicePill,
              {
                minHeight: shape.minTapTarget,
                backgroundColor: active ? theme.accent : 'transparent',
                borderColor: active ? theme.accent : theme.border,
                borderWidth: shape.borderButtonWidth * shape.borderScale,
              },
            ]}
          >
            <Text style={[styles.segmentLabel, { color: active ? theme.accentInk : theme.textMuted }]}>
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
function ListChoice({
  options,
  value,
  onChange,
  style,
  mode,
}: SegmentedControlProps & { mode: 'inline' | 'sheet' }) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const fieldHue = useScreenColor() ?? theme.border;
  const shape = useLabShape();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  const pick = (next: string) => {
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
            key={opt.value}
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
};

/**
 * `forwardRef` so a caller that needs the underlying `TextInput` — `useKeyboardLift`, an
 * imperative `.focus()` — can use THIS field instead of hand-rolling a bordered one beside
 * it. `components/ShoppingFilterBar.tsx` had done exactly that and drifted: its search box
 * kept no border at all through the 2026-08-05 reset, sitting next to its own bordered
 * category button. Nothing passed a ref before 2026-08-08, so this is purely additive.
 */
export const Input = React.forwardRef<TextInput, InputProps>(function Input(
  { label, error, optional, style, onFocus, onBlur, ...rest },
  ref
) {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const fieldHue = useScreenColor() ?? theme.border;
  const shape = useLabShape();
  const [focused, setFocused] = useState(false);
  // Resting border is the screen's own hue at the FIELD rung (card design reset, 2026-08-05),
  // so an editor's fields belong to the screen that pushed them. Error and focus still WIN over
  // it — a state the user needs to see must beat the decorative hue, DESIGN_RULES.md rule 18.
  const borderColor = error
    ? theme.bad
    : focused
      ? theme.borderStrong
      : computeBorderTone(fieldHue, isDark, 'field', shape.borderRampStrength);

  return (
    <View>
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
          {
            color: theme.text,
            borderColor,
            backgroundColor: theme.surface,
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
  segmentLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semibold,
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
