/**
 * HomeMedicineCard.tsx — the Me tab's Medicine card.
 *
 * A top-level card since 2026-08-21 (CONSISTENCY_AUDIT.md §11, maintainer: *"Yes."*) — it had
 * been a full `Surface` drawn INSIDE HomeHealthCard's `Surface`, the card-in-a-card the
 * blueprint pass banned. The content is components/MedicineSurface.tsx, the same component
 * CardExpandHost's `homeMedicine` body mounts.
 *
 * ⚠️ **The card shell is gone as of 2026-08-21** — see components/HomeHealthCard.tsx's header
 * for why. Hue, badge, glyph (`medkit`, not the domain default heart), title, the fold and the
 * ⤢ are lib/cardRegistry.ts's `homeMedicine` entry, drawn by components/Card.tsx.
 *
 * Connections:
 *   Imports → components/Card, components/CardMenuSheet (CardMenuButton),
 *             components/MedicineReminderBell, components/MedicineSurface
 *   Used by → app/(tabs)/index.tsx (Me's card stack, `HOME_CARD_KINDS` — 'medicine')
 *   Data    → none directly — MedicineSurface drives store/useMedicineStore
 *
 * Edit notes:
 *   - **The reminder bell IS the reminders switch** (components/MedicineReminderBell.tsx), not a
 *     link to a panel that contains one — the documented exception to DESIGN_RULES rule 19a.
 *     It is the card's own control, so it goes in `controls`, ahead of the fold and the ⤢.
 *   - A folded card still arms every tray reminder: the fold is presentation only.
 */
import React from 'react';
import Card from '@/components/Card';
import { CardMenuButton, CardMenu } from '@/components/CardMenuSheet';
import MedicineReminderBell from '@/components/MedicineReminderBell';
import MedicineSurface from '@/components/MedicineSurface';
import { useT } from '@/lib/i18n';

type Props = {
  /** Me's per-card menu (components/CardMenuSheet.tsx). Omitted → no "⋮" is drawn. */
  cardMenu?: CardMenu;
};

export default function HomeMedicineCard({ cardMenu }: Props) {
  const t = useT();
  return (
    <Card
      id="homeMedicine"
      controls={
        <>
          <MedicineReminderBell />
          {cardMenu ? <CardMenuButton cardTitle={t.medicine.title} {...cardMenu} /> : null}
        </>
      }
    >
      <MedicineSurface />
    </Card>
  );
}
