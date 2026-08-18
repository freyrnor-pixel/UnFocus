/**
 * useDragReorder.ts — the app's ONE long-press-drag reorder mechanic, in one place.
 *
 * Hold a row for ~400ms, drag it, drop it: the list reflows under the finger and the new
 * order is committed once, on drop. That gesture already existed on Home's preview cards and
 * on the shopping list; this hook is it, extracted so the remaining surfaces get the same
 * thing rather than a fourth hand-rolled copy (2026-08-01, "drag to reorder should be
 * universal"). It pairs with components/DraggableTaskRow.tsx, which owns the gesture itself —
 * this owns the bookkeeping around it: measure everything at drag-start, ask lib/reorder for
 * the live order, animate the reflow, commit on drop.
 *
 * A surface adopts it in three lines:
 *
 *     const drag = useDragReorder(rows.map((r) => r.id), reorderRows);
 *     drag.order.map((id) => <DraggableTaskRow key={id} isOpen={false} {...drag.rowProps(id)}>…)
 *
 * …rendering in `drag.order`, not in the store's order, so the preview is what moves.
 *
 * Connections:
 *   Imports → lib/reorder (reorderByDrag), lib/useAppTheme (useAccessibility — reduced motion)
 *   Used by → components/HomeCardManager.tsx (Home's preview cards), app/notes.tsx,
 *             app/habits.tsx, app/plans.tsx (the undated "Whenever" list only —
 *             see that screen for why a time-ordered list is deliberately not draggable)
 *   Data    → none — the caller persists the committed order (a store's `reorder*(orderedIds)`)
 *
 * Edit notes:
 *   - **Commit once, on drop.** `onCommit` fires from `onDragEnd` and only when the order
 *     actually changed. Writing on every move would put a SQLite write behind every pixel of
 *     finger travel (and, for a synced table, a broadcast per pixel with it).
 *   - **`order` is the render order while a drag is live, and the caller's order otherwise.**
 *     An id that leaves `ids` mid-drag (a row ticked off by a peer, say) simply stops being
 *     rendered; the drag's own snapshot is discarded on drop, so nothing can resurrect it.
 *   - Positions are measured ONCE at drag-start, in window space, and lib/reorder counts how
 *     many OTHER rows the finger has passed — see that file for why re-measuring or reading
 *     the live order mid-drag makes rows oscillate at a swap boundary.
 *   - `measureInWindow` is asynchronous; its callbacks land in the same frame batch, which is
 *     long before the ~400ms hold that starts a drag has produced any movement. Reading the
 *     snapshot in `onDragMove` is therefore safe (the same assumption app/(tabs)/shopping.tsx
 *     documents).
 *   - LayoutAnimation is skipped under reduced motion, and relies on the Android global enable
 *     components/HintCard.tsx sets at module scope — every screen using this also renders a
 *     HintCard, so it is already on by mount. Don't add a second enable call here.
 */
import { useRef, useState } from 'react';
import { LayoutAnimation } from 'react-native';
import { reorderByDrag } from '@/lib/reorder';
import { useAccessibility } from '@/lib/useAppTheme';

/** What one row hands to components/DraggableTaskRow.tsx. Spread it: `{...drag.rowProps(id)}`. */
export type DragRowProps = {
  registerNode: (node: unknown) => void;
  onDragStart: () => void;
  onDragMove: (centerY: number) => void;
  onDragEnd: () => void;
};

export type DragReorder = {
  /** Render in THIS order — it is the live preview while a drag is running. */
  order: string[];
  /** The id currently being dragged, or null. For a lifted/dimmed treatment, if a surface wants one. */
  draggingId: string | null;
  rowProps: (id: string) => DragRowProps;
};

type DragState = { id: string; order: string[] };

type Measurable = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };

/**
 * @param ids     The rows, in their committed order.
 * @param onCommit Called once on drop with the full new order, only when it changed.
 */
export function useDragReorder(ids: string[], onCommit: (orderedIds: string[]) => void): DragReorder {
  const { reducedMotion } = useAccessibility();

  const [drag, setDrag] = useState<DragState | null>(null);
  // Handlers run from gesture callbacks, so they read the latest values off refs rather than
  // closing over a stale render's.
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const idsRef = useRef<string[]>(ids);
  idsRef.current = ids;

  const nodes = useRef<Map<string, Measurable>>(new Map());
  const snapshot = useRef<Record<string, { y: number; height: number }>>({});

  function registerNode(id: string, node: unknown) {
    if (node) nodes.current.set(id, node as Measurable);
    else nodes.current.delete(id);
  }

  function handleDragStart(id: string) {
    snapshot.current = {};
    for (const other of idsRef.current) {
      nodes.current.get(other)?.measureInWindow?.((_x, y, _w, h) => {
        snapshot.current[other] = { y, height: h };
      });
    }
    setDrag({ id, order: idsRef.current });
  }

  function handleDragMove(id: string, centerY: number) {
    setDrag((prev) => {
      if (!prev || prev.id !== id) return prev;
      if (!Object.keys(snapshot.current).length) return prev;
      const next = reorderByDrag(centerY, prev.order, id, snapshot.current);
      if (!next.some((other, i) => other !== prev.order[i])) return prev;
      if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      return { ...prev, order: next };
    });
  }

  function handleDragEnd(id: string) {
    const prev = dragRef.current;
    if (prev && prev.id === id) {
      const committed = idsRef.current;
      const changed = prev.order.some((other, i) => other !== committed[i]);
      if (changed) onCommit(prev.order);
    }
    setDrag(null);
  }

  return {
    order: drag?.order ?? ids,
    draggingId: drag?.id ?? null,
    rowProps: (id: string) => ({
      registerNode: (node: unknown) => registerNode(id, node),
      onDragStart: () => handleDragStart(id),
      onDragMove: (centerY: number) => handleDragMove(id, centerY),
      onDragEnd: () => handleDragEnd(id),
    }),
  };
}
