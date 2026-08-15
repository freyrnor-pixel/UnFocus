/**
 * EnergyConfigSheet.tsx — where a day's (and week's) energy is actually SET (2026-08-03).
 *
 * The one place the Energy numbers are configured. `components/EnergyMeter.tsx`'s ✏️ opens it;
 * nothing else does.
 *
 * **Why a pop-up and not a stepper on the strip.** For one day (2026-08-03, PR #478) the two
 * capacity steppers sat on the strip's own top line, always visible. The maintainer's review
 * killed that within the day, on two counts and in these words: *"the plus and minus is too
 * flexible, and it is not obvious to a user what is what. Energy per day should be configured
 * in a pop-up, not just whenever."*
 *   1. **Too flexible.** A bare ± on the busiest line of Home invites nudging the number
 *      whenever you glance at it, which turns a described day into a dial. Setting how much a
 *      day holds is a deliberate act; it should cost a tap and land in a place that says so.
 *   2. **Not obvious what is what.** A ± beside a `7 / 10` readout has no way to say which of
 *      the two numbers it moves — capacity or spend — and it had no label of its own. Here
 *      every stepper carries a name AND a line saying what it changes, which a strip line has
 *      no room for at any font scale.
 * So: don't move these steppers back onto the strip. `lib/__tests__/stableLayout.test.ts` pins
 * them here and pins `EnergyMeter` to having no `<Stepper>` of its own.
 *
 * **Three fields, and the third is deliberately fenced off.** "Energy today" and "Energy this
 * week" set the BASE capacity for the period — the day's usual number. "Extra for today" is a
 * separate row in the store (`lib/energy.ts`'s `boostKey`) that exists so a good day's "+3"
 * can never silently redefine the usual number, and it is drawn below a divider with its own
 * temporary chip so it reads as borrowed rather than banked. See `store/useEnergyStore.ts`.
 *
 * **Nothing here confirms, warns or evaluates.** No "are you sure", no "that's low", no
 * suggestion of a right number, and Done is an acknowledgement rather than a save — every
 * stepper writes through on press, exactly as it did inline. Closing by any route (Done,
 * backdrop, back gesture) is the same thing.
 *
 * Connections:
 *   Imports → components/AnimatedBottomSheet, components/Badge (the temporary chip),
 *             components/Button, components/Stepper, components/Surface, constants/theme,
 *             lib/i18n, lib/useAppTheme
 *   Used by → components/EnergyMeter.tsx (mounts it and owns the ✏️ trigger)
 *   Data    → none directly. The four callbacks are store/useEnergyStore.ts's
 *             setDayCapacity / setWeekCapacity / setDayBoost, which persist to
 *             `energy_budgets`.
 *
 * Edit notes:
 *   - The shell geometry (bottom-pinned overlay Surface, 40x4 grab handle) is copied from
 *     components/EnergyPauseSheet.tsx, which took it from components/LayoutPickerSheet.tsx.
 *     The app has ONE bottom-sheet shell; don't let it gain a second that nearly matches.
 *   - `dayBaseCapacity` is the BASE, not what the meter shows: the meter's `13 / 13` on a
 *     boosted day is base + boost, and feeding that total into this stepper would re-bank the
 *     boost as the user's usual capacity on every press. See EnergyMeter's `dayBaseCapacity`.
 *   - The label side of each row yields (`flex: 1` + `minWidth: 0`), never the stepper — a
 *     stepper has no width to give. That is the wrap-audit's documented fix for a label
 *     competing with a fixed-size control (AGENTS.md, `npm run wraps`).
 *   - No KeyboardAvoidingView: three steppers and a button, no text input to lift.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AnimatedBottomSheet from '@/components/AnimatedBottomSheet';
import { Badge } from '@/components/Badge';
import Button from '@/components/Button';
import Stepper from '@/components/Stepper';
import Surface from '@/components/Surface';
import { Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Props = {
  visible: boolean;
  /** Done, a backdrop tap and the back gesture all mean this — nothing is unsaved. */
  onClose: () => void;
  /** Mirrors EnergyMeter's `showDay`/`showWeek` (settings.energyMode) so the sheet offers
   *  exactly the periods the strip is drawing. */
  showDay: boolean;
  showWeek: boolean;
  /** The day's BASE capacity — see the Edit notes before passing the meter's total instead. */
  dayBaseCapacity: number;
  onDayCapacity: (next: number) => void;
  weekCapacity: number;
  onWeekCapacity: (next: number) => void;
  dayBoost: number;
  onDayBoost: (next: number) => void;
};

export default function EnergyConfigSheet({
  visible,
  onClose,
  showDay,
  showWeek,
  dayBaseCapacity,
  onDayCapacity,
  weekCapacity,
  onWeekCapacity,
  dayBoost,
  onDayBoost,
}: Props) {
  const theme = useAppTheme();
  const styles = useScaledStyles(baseStyles);
  const t = useT();

  /**
   * One labelled field: a name (plus an optional chip), the stepper, and a line saying what
   * the stepper changes. That third part is the whole reason this sheet exists — see the
   * header's "not obvious what is what".
   */
  const field = (
    label: string,
    hint: string,
    value: number,
    onChange: (next: number) => void,
    chip?: string
  ) => (
    <View style={styles.field}>
      <View style={styles.fieldTop}>
        {/* The label side yields, never the stepper (Edit notes). */}
        <View style={styles.fieldLabelWrap}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
          {chip ? <Badge label={chip} /> : null}
        </View>
        <Stepper value={value} onChange={onChange} min={0} accessibilityLabel={label} />
      </View>
      <Text style={[styles.fieldHint, { color: theme.textMuted }]}>{hint}</Text>
    </View>
  );

  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <Surface surfaceContext="overlay" style={styles.sheet}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />

        <Text style={[styles.title, { color: theme.text }]}>{t.energyMeter.editTitle}</Text>

        {showDay &&
          field(
            t.energyMeter.todayCapacity,
            t.energyMeter.todayCapacityHint,
            dayBaseCapacity,
            onDayCapacity
          )}
        {showWeek &&
          field(
            t.energyMeter.weekCapacity,
            t.energyMeter.weekCapacityHint,
            weekCapacity,
            onWeekCapacity
          )}

        {/* The extra sits below a rule, with its own chip once it is non-zero: it is not a
            third capacity, it is energy borrowed against one day. The divider is what stops
            it reading as "and here is a bigger number you could be on". */}
        {showDay && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            {field(
              t.energyMeter.boostToday,
              t.energyMeter.boostHint,
              dayBoost,
              onDayBoost,
              dayBoost > 0 ? t.energyMeter.boostChip(dayBoost) : undefined
            )}
          </>
        )}

        {/* An acknowledgement, not a save — every stepper above has already written through.
            Deliberately the only button: there is no Cancel, because there is nothing to
            revert and offering one would imply the numbers were pending. */}
        <Button label={t.energyMeter.done} variant="secondary" onPress={onClose} style={styles.done} />
      </Surface>
    </AnimatedBottomSheet>
  );
}

const baseStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.full, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.md, fontFamily: Fonts.semibold },
  field: { gap: 4 },
  fieldTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // flex + minWidth:0 is the pair that actually lets a label shrink in Yoga — `flex: 1` alone
  // does nothing here (see components/TaskCard.tsx's note on the same fix).
  fieldLabelWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  fieldLabel: { fontSize: FontSize.md, fontFamily: Fonts.semibold, flexShrink: 1 },
  // Caption tier: this explains the control above it
  // and must never compete with it.
  fieldHint: { fontSize: FontSize.xs, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth },
  done: { alignSelf: 'stretch' },
});
