/**
 * EnergyConfigPanel.tsx — where a day's (and week's) energy is actually SET, inline in Home's
 * Energibudsjett card (2026-09-26; was EnergyConfigSheet.tsx, a bottom sheet, 2026-08-03).
 *
 * The one place the Energy numbers are configured on Home. `components/EnergyMeter.tsx` mounts it
 * inside the card, under its "Juster dagsbudsjett" row, in a `Collapsible` that row (and the ✏️)
 * toggles. Settings keeps its mode + capacity controls for the full picture; this is the in-place
 * way to change today's number without leaving the card.
 *
 * **Why inline now — the third answer, and what it keeps from the first two.** 2026-08-03 put
 * two bare steppers on the strip's top line; the maintainer killed that the same day: *"the plus
 * and minus is too flexible, and it is not obvious to a user what is what. Energy per day should
 * be configured in a pop-up, not just whenever."* This file then became a sheet. On 2026-09-26 the
 * maintainer asked for the opposite direction in so many words — *"energi og månedsbudsjett må
 * kunne redigeres i kortet, ikke via innstillinger"* — so the editor moved back into the card.
 * Both of the original complaints still hold, and this panel still answers them:
 *   1. **Too flexible.** The steppers are NOT always visible. They sit behind one tap on a
 *      labelled row, folded away by default, so setting a day is still a deliberate act and a
 *      glance at the bar never lands on a ±.
 *   2. **Not obvious what is what.** Every stepper still carries a name AND a line saying what it
 *      changes. That is the part the bare-stepper version lacked, and it is kept verbatim.
 * `lib/__tests__/stableLayout.test.ts` pins both: EnergyMeter imports no `Stepper` itself, and the
 * panel is mounted inside a `Collapsible` whose `open` is the card's own toggle state.
 *
 * **Three fields, and the third is deliberately fenced off.** "Energy today" and "Energy this
 * week" set the BASE capacity for the period — the day's usual number. "Extra for today" is a
 * separate row in the store (`lib/energy.ts`'s `boostKey`) that exists so a good day's "+3"
 * can never silently redefine the usual number, and it is drawn below a divider with its own
 * temporary chip so it reads as borrowed rather than banked. See `store/useEnergyStore.ts`.
 *
 * **Nothing here confirms, warns or evaluates.** No "are you sure", no "that's low", no
 * suggestion of a right number, and no Save — every stepper writes through on press. Folding the
 * row shut discards nothing.
 *
 * Connections:
 *   Imports → components/Badge (the temporary chip), components/Stepper, constants/theme,
 *             lib/i18n, lib/useAppTheme
 *   Used by → components/EnergyMeter.tsx (mounts it inside its card and owns the toggle)
 *   Data    → none directly. The three callbacks are store/useEnergyStore.ts's
 *             setDayCapacity / setWeekCapacity / setDayBoost, which persist to
 *             `energy_budgets`.
 *
 * Edit notes:
 *   - `dayBaseCapacity` is the BASE, not what the meter shows: the meter's `13 / 13` on a
 *     boosted day is base + boost, and feeding that total into this stepper would re-bank the
 *     boost as the user's usual capacity on every press. See EnergyMeter's `dayBaseCapacity`.
 *   - The label side of each row yields (`flex: 1` + `minWidth: 0`), never the stepper — a
 *     stepper has no width to give. That is the wrap-audit's documented fix for a label
 *     competing with a fixed-size control (AGENTS.md, `npm run wraps`).
 *   - No title and no Done button: the card's own header names it, and the row that opened it
 *     closes it. A second close control inside the card would be a second way to say the same.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '@/components/Badge';
import Stepper from '@/components/Stepper';
import { Fonts, FontSize, Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';
import { useAppTheme, useScaledStyles } from '@/lib/useAppTheme';

type Props = {
  /** Mirrors EnergyMeter's `showDay`/`showWeek` (settings.energyMode) so the panel offers
   *  exactly the periods the card is drawing. */
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

export default function EnergyConfigPanel({
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
   * the stepper changes — see the header's "not obvious what is what".
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
    <View style={styles.panel}>
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
    </View>
  );
}

const baseStyles = StyleSheet.create({
  panel: { gap: Spacing.md, paddingTop: Spacing.sm },
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
});
