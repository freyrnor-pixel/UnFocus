/**
 * editMode.ts — a screen's edit mode, as a context (2026-10-12, Handle first).
 *
 * Maintainer, on the Handle tab: *"Shopping ser fortsatt rotete ut … f.eks. redigeringsmodus som
 * henter inn flere elementer, slik at vanlig bruk er ryddigere."* The everyday view of a screen
 * shows what you use while shopping — the items and one way to add. Everything you reach for once
 * a month (renaming, the ⋮ menus, budget fields, "from monthly"/"from a dish", new lists, deletes)
 * is drawn only while the screen's ✏️ is on.
 *
 * The screen owns the boolean (it resets when you leave the tab); components deep in the tree
 * read it here rather than having it threaded through every props list.
 *
 * Connections:
 *   Imports → react
 *   Used by → app/(tabs)/shopping.tsx (provides it, and draws the ✏️ via ScreenScaffold's
 *             `editMode`), components/WeekListCard.tsx, components/CatalogueTab.tsx
 *   Data    → none — not persisted, deliberately: edit mode is a visit, not a setting.
 */
import { createContext, useContext } from 'react';

export const EditModeContext = createContext(false);

/** True while the enclosing screen is in edit mode. False outside any provider. */
export function useEditMode(): boolean {
  return useContext(EditModeContext);
}
