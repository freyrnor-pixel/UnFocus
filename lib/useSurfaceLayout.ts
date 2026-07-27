/**
 * useSurfaceLayout.ts — the resolved card layout for one surface, as a hook.
 *
 * Thin bridge between the settings store and lib/cardLayout.ts's pure resolution. It lives
 * in its own file rather than inside cardLayout.ts so that module can stay completely
 * dependency-free (and provably so — lib/__tests__/cardLayout.test.ts asserts it imports
 * nothing at all, which is what keeps a display preference from ever reaching the
 * notification or store layers).
 *
 * Connections:
 *   Imports → lib/cardLayout (resolveLayoutSpec), store/useSettingsStore
 *   Used by → app/(tabs)/shopping.tsx, app/(tabs)/plans.tsx
 *   Data    → reads settings.cardLayouts + settings.layoutDetail. Reads only; the picker
 *             (components/LayoutPickerSheet.tsx) owns the writes.
 *
 * Edit notes:
 *   - The returned spec is a module-level singleton from LAYOUT_SPECS, so its identity is
 *     stable for a given layout. That's what lets components/ShoppingRow.tsx's React.memo
 *     comparator check `prev.spec === next.spec` by reference — don't "helpfully" spread it
 *     into a fresh object here or every row will re-render on every parent render.
 */
import { resolveLayoutSpec, type LayoutSpec, type LayoutSurface } from '@/lib/cardLayout';
import { useSettingsStore } from '@/store/useSettingsStore';

export function useSurfaceLayout(surface: LayoutSurface): LayoutSpec {
  const cardLayouts = useSettingsStore((s) => s.cardLayouts);
  const layoutDetail = useSettingsStore((s) => s.layoutDetail);
  return resolveLayoutSpec(surface, cardLayouts, layoutDetail);
}
