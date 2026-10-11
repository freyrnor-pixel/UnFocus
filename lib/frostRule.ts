/**
 * frostRule.ts — the pure "does this pane frost?" decision, split out of lib/frost.ts so a jest
 * test can evaluate it without loading Reanimated (lib/frost.ts creates a shared value at import).
 *
 * Connections:
 *   Imports → none
 *   Used by → lib/frost.ts (re-export), components/Surface.tsx via lib/frost,
 *             lib/__tests__/frost.test.ts
 *   Data    → none
 */
/**
 * Whether a Surface draws its frosted slice. Pure, so its truth table is asserted directly
 * (lib/__tests__/frost.test.ts) — CLAUDE.md's rule for a boolean that gates rendering: a source
 * regex can confirm the code exists, never that it ever yields `true`.
 */
export function shouldFrost(i: {
  enabled: boolean;
  hasTint: boolean;
  staticPressed: boolean;
  reduceEffects: boolean;
  glassSurfaces: boolean;
  context: 'ambient' | 'nav' | 'overlay';
  frosted: boolean;
  paintingHidden: boolean;
}): boolean {
  if (!i.enabled || i.hasTint || i.staticPressed || i.reduceEffects || !i.glassSurfaces || i.paintingHidden) {
    return false;
  }
  return i.context === 'ambient' || i.context === 'nav' || (i.context === 'overlay' && i.frosted);
}
