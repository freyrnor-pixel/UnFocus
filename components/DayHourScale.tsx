/**
 * DayHourScale.tsx — empty-day state for PlanTaskCard: the same fixed-hour calendar grid
 * `DayGridLines` draws for a populated day, just with no task cards on it, inside a short
 * scrollable viewport auto-scrolled to the current hour — so an empty day reads as "a
 * calendar with nothing on it today" rather than a bare filler box (user report,
 * 2026-07-25), and doesn't visually jump to a different grid system the moment the first
 * task lands and PlanTaskCard's own populated grid takes over (2026-07-26 rebuild —
 * Google Calendar's day view was the explicit reference; the previous sparse 4-label
 * ruler and its "hour labels left / now-time right" fix both still didn't read as a real
 * calendar).
 *
 * Connections:
 *   Imports → components/DayGridLines, lib/dayGrid
 *   Used by → components/PlanTaskCard.tsx (showEmpty branch, replacing HomePreviewEmpty there)
 *   Data    → none — pure presentational; `now` (minutes since midnight) passed in by the caller
 *
 * Edit notes:
 *   - Auto-scrolls (no animation, on mount and whenever `now` crosses into a new position)
 *     so the current hour sits near the top of the short viewport instead of defaulting to
 *     00:00 — an empty day should still greet you at "now," not at midnight.
 *   - **Shorter than the populated grid (2026-07-27, user report)**: uses `EMPTY_GRID_HEIGHT`
 *     (~2h) instead of `PlanTaskCard`'s `COLLAPSED_GRID_HEIGHT` (~4h) — an empty day doesn't
 *     need the same window a populated day reserves for tasks, so keeping this one shorter
 *     keeps the Home preview card slimmer when there's nothing scheduled.
 */
import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import DayGridLines from '@/components/DayGridLines';
import { EMPTY_GRID_HEIGHT, minutesToY } from '@/lib/dayGrid';

type Props = {
  /** Minutes since midnight — used to place the live "now" line and the auto-scroll target. */
  now: number;
};

export default function DayHourScale({ now }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const y = Math.max(0, minutesToY(now) - EMPTY_GRID_HEIGHT / 3);
    scrollRef.current?.scrollTo({ y, animated: false });
  }, [now]);

  return (
    <ScrollView ref={scrollRef} style={styles.viewport} showsVerticalScrollIndicator={false}>
      <DayGridLines now={now} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  viewport: { height: EMPTY_GRID_HEIGHT },
});
