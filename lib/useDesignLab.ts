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
 *             components/Stepper.tsx (the `number` job, 2026-08-07 — the knob's first
 *             consumer), components/DesignLabBench.tsx, app/design-lab/index.tsx,
 *             app/design-lab/tokens.tsx
 *   Data    → reads `designLab` / `designLabApply` from the settings store. `useLabDraft` is
 *             the one writer, and it is only used by the two lab screens.
 *
 * Edit notes:
 *   - **Every hook here runs on every render of most of the app.** Keep them cheap and keep
 *     them allocation-free on the common path: `useLabOverrides` returns the shared
 *     `EMPTY_OVERRIDES` object by reference when nothing is applied, so downstream `useMemo`s
 *     keyed on it never invalidate for a normal user. Don't replace that with a fresh `{}`.
 *   - The context deliberately holds the bag itself, not a setter. The bench previews; the
 *     lab screens own the writing, through `useLabDraft`.
 *   - **`designLabApply` deliberately ignores `playground`.** That switch was only ever about
 *     tokens — colours, geometry, control shapes, row positions. An arrangement of invented
 *     cards on invented screens cannot be "applied" to the real app, so nothing below reads
 *     `overrides.playground` and nothing should start.
 *   - `useLabShape()` returns a FULL `ShapeOverrides` (defaults filled), so a consumer never
 *     has to know which knobs were touched. Ask `isDefaultShape()` before doing work.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
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

/** How long a change sits in memory before it reaches the column. */
const FLUSH_MS = 400;

export type LabDraft = {
  /** The live bag. Read straight off the store, so the two lab screens never disagree. */
  draft: LabOverrides;
  /** Apply a change now, persist it shortly. */
  commit: (next: LabOverrides) => void;
  /** Persist immediately — on blur, on drop, on leaving the screen. */
  flush: () => void;
};

/**
 * The design lab's own read/write handle on the bag. **Only the lab screens use this.**
 *
 * Two things it is doing, both of which used to be done differently and worse:
 *
 *   - **The bag lives in the store, not in a screen's `useState`.** The lab is two routes now
 *     (build, and the token knobs), and a local copy per screen means the one you push and
 *     come back from is stale. Reading the store keeps them the same value by construction.
 *     `useSettingsStore.update` keeps memory state even when the DB write throws, so this is
 *     no less robust than the local copy it replaces.
 *   - **The write is debounced; the change is not.** `commit` updates memory immediately, so
 *     the preview moves on the same frame, and schedules the column write behind it. A full
 *     playground is a six-figure JSON string — without this, typing a label would
 *     `JSON.stringify` and write SQLite once per character. Anything that ends an interaction
 *     (a blur, a drop, leaving the screen) should call `flush`, and unmounting does it for you.
 */
export function useLabDraft(): LabDraft {
  const draft = useSettingsStore((s) => s.designLab);
  const setDraft = useSettingsStore((s) => s.setDesignLabDraft);
  const update = useSettingsStore((s) => s.update);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The gesture and timer callbacks below can be held from an earlier render, so what they
  // persist has to come off a ref — a closure would write whatever the bag was when the
  // handler was made. Same rule lib/useDragReorder.ts documents.
  const pending = useRef<LabOverrides | null>(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      update({ designLab: pending.current });
      pending.current = null;
    }
  }, [update]);

  const commit = useCallback((next: LabOverrides) => {
    setDraft(next);
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (pending.current) {
        update({ designLab: pending.current });
        pending.current = null;
      }
    }, FLUSH_MS);
  }, [setDraft, update]);

  // Leaving the screen with a change still in the air must not lose it — this is the one
  // place the debounce could turn into data loss, so it is the one effect here.
  useEffect(() => flush, [flush]);

  return { draft, commit, flush };
}
