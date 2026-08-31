/**
 * MedicineCard.tsx — the Health tab's Medicine card.
 *
 * A top-level card since 2026-08-21 (CONSISTENCY_AUDIT.md §11, maintainer: *"Yes."*) — it had
 * been a full `Surface` drawn INSIDE the Health card's `Surface`, the card-in-a-card the
 * blueprint pass banned. The content is components/MedicineSurface.tsx, the same component
 * CardExpandHost's `healthMedicine` body mounts.
 *
 * ⚠️ **It moved from the Me tab to the Health tab on 2026-08-22** (it was `HomeMedicineCard`),
 * when the bottom nav went back to five tabs and Health became a screen again — a tray of pills
 * is health, and the tab it sat on no longer exists in that form. It is still a PEER card, drawn
 * beside Health's own content by components/HealthSurface.tsx, never inside its Surface: moving
 * screens is not a reason to rebuild the card-in-a-card §11 measured.
 *
 * ⚠️ **The card shell is not drawn here** — hue, badge, glyph (`medkit`, not the domain default
 * heart), title and the fold are lib/cardRegistry.ts's `healthMedicine` entry, drawn by
 * components/Card.tsx. Pressing the title is what opens it full screen; there is no ⤢ anywhere
 * in the app as of 2026-08-22.
 *
 * Connections:
 *   Imports → components/Card,
 *             components/MedicineReminderBell, components/MedicineSurface
 *   Used by → components/HealthSurface.tsx
 *   Data    → none directly — MedicineSurface drives store/useMedicineStore
 *
 * Edit notes:
 *   - **The reminder bell IS the reminders switch** (components/MedicineReminderBell.tsx), not a
 *     link to a panel that contains one — the documented exception to DESIGN_RULES rule 19a.
 *     It is the card's own control, so it goes in `controls`, ahead of the fold.
 *   - **`settings.featureMedicine` gates the MOUNT SITE, not this file.** HealthSurface decides
 *     whether to render it; a flag that hides a surface has to hide it wherever it is mounted,
 *     and a card that checks its own flag is one every future host has to remember not to.
 *   - A folded card still arms every tray reminder: the fold is presentation only.
 */
import React from 'react';
import Card from '@/components/Card';
import MedicineReminderBell from '@/components/MedicineReminderBell';
import MedicineSurface from '@/components/MedicineSurface';
import { useT } from '@/lib/i18n';
import { useMedicineStore } from '@/store/useMedicineStore';

export default function MedicineCard() {
  const t = useT();
  // The peek counts medicines on a TRAY (morning/midday/evening/night), not every medicine the
  // person has: an as-needed medicine belongs to no tray and nothing ever nudges you to take
  // one, so counting it as "daily" would state a schedule that deliberately does not exist.
  const dailyCount = useMedicineStore((s) => s.medicines.filter((m) => m.trays.length > 0).length);
  return (
    <Card
      id="healthMedicine"
      peek={t.peek.healthMedicine(dailyCount)}
      controls={<MedicineReminderBell />}
    >
      <MedicineSurface />
    </Card>
  );
}
