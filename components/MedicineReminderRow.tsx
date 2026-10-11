/**
 * MedicineReminderRow.tsx — the medicine-reminder switch, as a labelled row in the card's body.
 *
 * **Was MedicineReminderBell.tsx, a bell in the card HEADER, until 2026-10-11 (V2 card rule).**
 * The approved V2 rule is that every card header carries exactly two controls — fold ⌄ and full
 * screen ⤢ — in the same place on every card, so nothing card-specific may live up there. A
 * reminder switch is also exactly what DESIGN_RULES.md rule 19a wants ("a boolean is always a
 * slider"): the bell was a documented exception to that rule, and moving it into the body ends
 * the exception rather than relocating it.
 *
 * Drawn at the top of components/MedicineSurface.tsx, so the card and its full-screen pane get
 * it from the same mount — no second copy in components/CardExpandHost.tsx any more.
 *
 * Connections:
 *   Imports → components/SettingRow (ToggleRow), store/useMedicineStore (syncTrayReminders),
 *             store/useSettingsStore, lib/haptics, lib/i18n
 *   Used by → components/MedicineSurface.tsx
 *   Data    → settings.medicineRemindersEnabled (the only writer outside app/settings.tsx's
 *             NOTIF_SWITCHES), and useMedicineStore.syncTrayReminders()
 *
 * Edit notes:
 *   - **`syncTrayReminders()` after every write, never before.** Turning reminders off has to
 *     cancel four scheduled notifications; the store owns that, and lib/medicineNotifications.ts
 *     warns that a blanket cancel-then-schedule can un-schedule what it just armed.
 *   - The reminder TIMES panel in MedicineSurface opens on the same boolean, so the panel
 *     appearing is still the confirmation that the switch landed. Don't give the panel a switch
 *     of its own.
 */
import React from 'react';
import { ToggleRow } from '@/components/SettingRow';
import { useMedicineStore } from '@/store/useMedicineStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';

export default function MedicineReminderRow() {
  const t = useT();
  const enabled = useSettingsStore((s) => s.medicineRemindersEnabled);
  const updateSettings = useSettingsStore((s) => s.update);
  const syncReminders = useMedicineStore((s) => s.syncTrayReminders);

  return (
    <ToggleRow
      label={t.medicine.remindersToggle}
      checked={enabled}
      onChange={(next) => {
        tap();
        updateSettings({ medicineRemindersEnabled: next });
        syncReminders();
      }}
    />
  );
}
