/**
 * InventoryIcon.tsx — placeholder glyph for "this belongs to / returns to the standing inventory (Katalog)".
 *
 * A single swap point for the inventory motif so every call site doesn't need
 * to be hunted down individually once a custom icon replaces the Ionicons stand-in.
 *
 * Connections:
 *   Imports → @expo/vector-icons
 *   Used by → components/ShoppingRow.tsx
 *   Data    → none
 *
 * Edit notes:
 *   - Cardboard-box glyph (MaterialCommunityIcons "package-variant-closed") — swap
 *     the name here when a custom icon is ready, not at each call site.
 *   - Pulled forward from its REBUILD_PLAN.md 3e slot ("Icons, pickers, misc leaves")
 *     during Session A2·1 (2026-07-02) — ShoppingRow's R2 remove branch (Decision 011)
 *     can't preserve the catalog-vs-ad-hoc icon distinction without it, and unlike
 *     DraggableTaskRow this is a trivial, single-consumer, zero-design-risk leaf with
 *     no coupling to anything not yet built. Not a precedent for pulling the rest of
 *     3e forward — the other 3e items don't block anything in Phase 3c/3d.
 */
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
  size?: number;
  color: string;
};

export default function InventoryIcon({ size = 18, color }: Props) {
  return <MaterialCommunityIcons name="package-variant-closed" size={size} color={color} />;
}
