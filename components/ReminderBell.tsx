/**
 * ReminderBell.tsx — the one "are reminders on for this thing?" toggle.
 *
 * A bell that is unmistakably on or off, and that always changes when you press it. Built on
 * components/IconButton.tsx so it inherits the app's existing engaged-control vocabulary rather
 * than inventing a second one: `accentSoft` plate, accent border, accent glyph, and the cap
 * RESTING SUNK while on (IconButton's `sunk={active}`).
 *
 * Connections:
 *   Imports → components/IconButton
 *   Used by → app/habit-form.tsx (a habit's daily reminder),
 *             components/MedicineReminderBell.tsx (the medicine tray reminders — a wrapper,
 *             because that card's header is drawn in two places since 2026-08-21)
 *   Data    → none — the caller owns the boolean and the write.
 *
 * Edit notes:
 *   - **Why this exists (2026-08-10, user report: "Reminder bell button looks the same in both
 *     states")**. There were two bells, drawn identically as a bare `PressableScale` + glyph,
 *     and one of them was lying. `app/habit-form.tsx`'s toggled its own boolean, so it did
 *     change — just faintly, on two channels (glyph + colour) with no plate and no depth.
 *     the medicine card's DIDN'T: its press opened a panel while its icon
 *     rendered `settings.medicineRemindersEnabled`, a different value flipped by a `Switch`
 *     inside that panel — so tapping the bell genuinely changed nothing about the bell. One
 *     component, one behaviour: **the bell is the switch, everywhere.**
 *   - **Four channels of on/off, on purpose** — filled `notifications` vs outlined-and-struck
 *     `notifications-off-outline` (shape), accent vs muted (colour), accentSoft plate vs neutral
 *     (fill), sunk vs raised (depth). DESIGN_RULES.md rule 11 needs two; the report is why this
 *     has four. It has to survive a glance, not just a comparison.
 *   - **This is the documented exception to rule 19a ("a boolean is always a slider").** The
 *     maintainer restyled the habit reminder off a plain `Switch` on 2026-08-06 deliberately;
 *     this consolidates that decision rather than reopening it. A reminder is the one boolean
 *     that has a universally-read glyph. Don't extend the exception to other settings — those
 *     stay `Switch` (components/FormControls.tsx).
 *   - `role="switch"` is what makes a screen reader say on/off rather than "selected"; keep it.
 */
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import IconButton from '@/components/IconButton';

type Props = {
  /** Whether reminders are currently on. */
  enabled: boolean;
  /** Flip it. The caller owns the write — this component holds no state. */
  onToggle: () => void;
  /** What these reminders are for, e.g. "Daily reminder" — read aloud, so name the thing. */
  label: string;
  /** Visual size of the circle. Default 36, IconButton's own. */
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function ReminderBell({ enabled, onToggle, label, size, disabled, style }: Props) {
  return (
    <IconButton
      icon={enabled ? 'notifications' : 'notifications-off-outline'}
      label={label}
      onPress={onToggle}
      active={enabled}
      role="switch"
      size={size}
      disabled={disabled}
      style={style}
    />
  );
}
