/**
 * HomeHealthCard.tsx — the Me tab's Health card.
 *
 * All of the real content lives in components/HealthSurface.tsx (`embedded`), the same component
 * app/health.tsx (the back-compat pushed route) and CardExpandHost's `homeHealth` body mount.
 * This file is now only the mount point.
 *
 * ⚠️ **The card shell is gone as of 2026-08-21.** It used to hand-roll a header — badge, title,
 * a PressableScale around the naming cluster, ⋮, fold, ⤢ — which was one of nine such headers,
 * and the reason the app shipped 13 different trailing-control orders. Hue, badge, glyph, title,
 * the fold and the ⤢ all come from lib/cardRegistry.ts's `homeHealth` entry now, drawn by
 * components/Card.tsx. There is no prop here for any of them, deliberately.
 *
 * Connections:
 *   Imports → components/Card, components/CardMenuSheet (CardMenuButton), components/HealthSurface
 *   Used by → app/(tabs)/index.tsx (Me's card stack, `HOME_CARD_KINDS` — 'health')
 *   Data    → none directly — HealthSurface drives store/useHealthStore
 *
 * Edit notes:
 *   - **The no-scoreboard rule is load-bearing here, same as the standalone screen**: no streak,
 *     no "better than last week", no total, no colour that escalates with a count, and no
 *     congratulation for a quiet week. Nothing in this shell adds a number HealthSurface doesn't
 *     already draw — see that file's own header before adding one.
 *   - **The title press expands**, unlike Habits' or Shopping's, which used to push to a
 *     genuinely deeper screen. There is no deeper Health destination any more: app/health.tsx is
 *     back-compat only, and nothing in the UI pushes to it. That behaviour is `Card`'s now, and
 *     every expandable card has it rather than the ones that remembered.
 */
import React from 'react';
import Card from '@/components/Card';
import { CardMenuButton, CardMenu } from '@/components/CardMenuSheet';
import HealthSurface from '@/components/HealthSurface';
import { useT } from '@/lib/i18n';

type Props = {
  /** Me's per-card menu (components/CardMenuSheet.tsx). Omitted → no "⋮" is drawn. */
  cardMenu?: CardMenu;
};

export default function HomeHealthCard({ cardMenu }: Props) {
  const t = useT();
  return (
    <Card id="homeHealth" controls={cardMenu ? <CardMenuButton cardTitle={t.home.healthCardTitle} {...cardMenu} /> : null}>
      <HealthSurface embedded />
    </Card>
  );
}
