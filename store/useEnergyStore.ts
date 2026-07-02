/**
 * useEnergyStore.ts — Decision 015 stub: typed interface only, no store logic.
 *
 * Declares the minimal `levels`/`setToday()` contract Phase 3d's EnergyCheckIn
 * needs so it can typecheck ahead of Phase 5's real energy store. Never call
 * in a mounted app — throws to make accidental real usage fail loudly instead
 * of silently no-op'ing.
 *
 * Connections:
 *   Imports → —
 *   Used by → components/EnergyCheckIn.tsx
 *   Data    → none — placeholder for Phase 5's real SQLite-backed store (energy_logs table)
 *
 * Edit notes:
 *   - Phase 5 must implement this store to satisfy EnergyLevel/levels/setToday
 *     exactly as declared here (Decision 015), plus `load()`/`todayLevel()` per
 *     the old app's useEnergyStore.ts — EnergyCheckIn itself only reads the raw
 *     `levels` map (not todayLevel()) so its tile highlight re-renders reactively.
 *   - Decision 009 unmounts EnergyCheckIn from Home; this stub exists so the
 *     component ports and typechecks even though nothing mounts it yet.
 */
export type EnergyLevel = 'low' | 'medium' | 'high';

type EnergyStoreState = {
  levels: Record<string, EnergyLevel>;
  setToday: (level: EnergyLevel) => void;
};

export function useEnergyStore<T>(selector: (s: EnergyStoreState) => T): T {
  return selector({
    levels: {},
    setToday: () => {
      throw new Error('useEnergyStore is a Phase 5 stub (Decision 015) — not implemented yet');
    },
  });
}
