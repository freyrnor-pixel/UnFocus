/**
 * useDesignLab.ts — the hooks that make a design-lab override bag reach a rendered component.
 *
 * Two sources, in priority order, and the order is the whole design:
 *
 *   1. A `DesignLabContext` provider. The lab's specimen bench wraps its samples in one
 *      carrying the DRAFT bag, so a knob moves the specimen the instant it is turned —
 *      including while the app-wide switch is off. This is what makes the lab a preview
 *      rather than a commit.
 *   2. The stored bag, but only when `settings.designLabApply` is on. Off (the default, and
 *      what the lab re-opens at) the whole app renders exactly as shipped.
 *
 * Connections:
 *   Imports → react, lib/designLab, store/useSettingsStore
 *   Used by → lib/useAppTheme.ts (colour + geometry choke points), components/Surface.tsx,
 *             components/FormControls.tsx, components/PadRow.tsx, components/PadSheet.tsx,
 *             components/DesignLabBench.tsx, app/design-lab.tsx
 *   Data    → reads `designLab` / `designLabApply` from the settings store. Writes nothing.
 *
 * Edit notes:
 *   - **Every hook here runs on every render of most of the app.** Keep them cheap and keep
 *     them allocation-free on the common path: `useLabOverrides` returns the shared
 *     `EMPTY_OVERRIDES` object by reference when nothing is applied, so downstream `useMemo`s
 *     keyed on it never invalidate for a normal user. Don't replace that with a fresh `{}`.
 *   - The context deliberately holds the bag itself, not a setter. The bench previews; the
 *     lab screen owns the draft state and writes it.
 *   - `useLabShape()` returns a FULL `ShapeOverrides` (defaults filled), so a consumer never
 *     has to know which knobs were touched. Ask `isDefaultShape()` before doing work.
 */
import { createContext, useContext, useMemo } from 'react';
import {
  EMPTY_OVERRIDES,
  resolveControl,
  resolveShape,
  resolveSlot,
  type ControlSlot,
  type LabOverrides,
  type ShapeOverrides,
  type SlotId,
} from '@/lib/designLab';
import { useSettingsStore } from '@/store/useSettingsStore';

/**
 * Overrides that apply to this subtree regardless of the app-wide switch.
 *
 * `null` (the default) means "no local preview — follow the stored bag and its switch".
 */
export const DesignLabContext = createContext<LabOverrides | null>(null);

/** The override bag in force for this component. See the file header for the two sources. */
export function useLabOverrides(): LabOverrides {
  const preview = useContext(DesignLabContext);
  const stored = useSettingsStore((s) => s.designLab);
  const apply = useSettingsStore((s) => s.designLabApply);
  if (preview) return preview;
  return apply ? stored : EMPTY_OVERRIDES;
}

/** The full resolved geometry, defaults filled in. */
export function useLabShape(): ShapeOverrides {
  const overrides = useLabOverrides();
  return useMemo(() => resolveShape(overrides), [overrides]);
}

/** Which variant a control slot should draw as. */
export function useLabControl(slot: ControlSlot): string {
  const overrides = useLabOverrides();
  return resolveControl(slot, overrides);
}

/** What a row/bench slot position should carry. */
export function useLabSlot(slot: SlotId): string {
  const overrides = useLabOverrides();
  return resolveSlot(slot, overrides);
}
