/**
 * MedicineReminderBell.tsx — the medicine-reminder switch, wherever the medicine card's header is.
 *
 * A three-line wrapper around components/ReminderBell.tsx that owns the one thing the bell needs
 * to be shared: reading and writing `settings.medicineRemindersEnabled` and re-arming the tray
 * reminders after. It exists because the medicine card's header is drawn in TWO places since
 * Medicine became a top-level Me card (2026-08-21) — components/HomeMedicineCard.tsx and
 * components/CardExpandHost.tsx's `homeMedicine` pane — while its body
 * (components/MedicineSurface.tsx) is one component mounted in both.
 *
 * Connections:
 *   Imports → components/ReminderBell, store/useMedicineStore (syncTrayReminders),
 *             store/useSettingsStore, lib/haptics, lib/i18n
 *   Used by → components/HomeMedicineCard.tsx, components/CardExpandHost.tsx
 *   Data    → settings.medicineRemindersEnabled (the only writer outside app/settings.tsx's
 *             NOTIF_SWITCHES), and useMedicineStore.syncTrayReminders()
 *
 * Edit notes:
 *   - **The bell IS the switch, and that is a documented exception to DESIGN_RULES.md rule 19a**
 *     ("a boolean is always a slider"). Read components/ReminderBell.tsx's header before
 *     changing anything about it: the bell used to open the times panel while DRAWING this
 *     value, so pressing it changed nothing about what it displayed — reported as *"Reminder
 *     bell button looks the same in both states"*. Don't extend the exception elsewhere.
 *   - **`syncTrayReminders()` after every write, never before.** Turning reminders off has to
 *     cancel four scheduled notifications; the store owns that, and lib/medicineNotifications.ts
 *     warns that a blanket cancel-then-schedule can un-schedule what it just armed.
 *   - The reminder TIMES panel this used to open lives in MedicineSurface and opens on the same
 *     boolean, so the panel appearing is still the confirmation that the bell landed.
 */
import React from 'react';
import ReminderBell from '@/components/ReminderBell';
import { useMedicineStore } from '@/store/useMedicineStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { tap } from '@/lib/haptics';
import { useT } from '@/lib/i18n';

export default function MedicineReminderBell() {
  const t = useT();
  const enabled = useSettingsStore((s) => s.medicineRemindersEnabled);
  const updateSettings = useSettingsStore((s) => s.update);
  const syncReminders = useMedicineStore((s) => s.syncTrayReminders);

  return (
    <ReminderBell
      enabled={enabled}
      onToggle={() => {
        tap();
        updateSettings({ medicineRemindersEnabled: !enabled });
        syncReminders();
      }}
      label={t.medicine.remindersToggle}
    />
  );
}
