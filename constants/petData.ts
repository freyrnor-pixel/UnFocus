/**
 * petData.ts — shared companion constants for Pet.tsx / Creature.tsx (Decision 039)
 *
 * The home-screen companion is no longer an emoji glyph — it is a code-drawn
 * creature (components/Creature.tsx) that lives in a soft "glow habitat". This
 * file centralises the exact design palette: per-type fur, the light/dark
 * habitat colours (sky/floor/glow), the shared creature part colours, and the
 * feeding-tray treat colours. Also holds the 5-mood PetState type.
 *
 * Connections:
 *   Imports → store/useSettingsStore (PetType type only)
 *   Used by → components/Pet.tsx, components/Creature.tsx
 *   Data    → none — pure constants
 *
 * Edit notes:
 *   - Palette values are exact decorative hex from the Decision 039 handoff, NOT
 *     Decision 006 semantic tokens — same precedent as HomeHeroBackground.tsx's
 *     sky/orb palette and ScreenBackground.tsx's blobs (illustrative art values,
 *     not app chrome). "Fitting the theme" here means the light-vs-dark habitat
 *     table is selected by the app's dark-mode state (useIsDark), not that these
 *     hues come from the colour-theme tokens. Fur is unchanged across light/dark.
 *   - Fur per type is the design default; a user who picks a swatch in onboarding
 *     step6 / settings overrides it via `petColor` (see Pet.tsx). DEFAULT_PET_COLOR
 *     is the legacy stored default that maps back to "use the per-type fur".
 */
import type { PetType } from '@/store/useSettingsStore';

/** The 5 moods — each reshapes the face rather than swapping the character. */
export type PetState = 'idle' | 'happy' | 'eating' | 'excited' | 'resting';

/** Habitat "glow-world" colours for one lighting mode. */
export type HabitatColors = { sky: string; floor: string; glow: string };

export type PetPalette = {
  /** Fur hex — same in light and dark. */
  fur: string;
  light: HabitatColors;
  dark: HabitatColors;
};

/** Per-type fur + light/dark habitat palette (exact Decision 039 hex). */
export const PET_PALETTES: Record<PetType, PetPalette> = {
  cat: {
    fur: '#E7943F',
    light: { sky: '#FFF6E6', floor: '#D4845A', glow: '#FFCB7A' },
    dark:  { sky: '#231408', floor: '#5C2E10', glow: '#8A4A1C' },
  },
  dog: {
    fur: '#E0A85C',
    light: { sky: '#EBF7FF', floor: '#5EBA54', glow: '#9AD8FF' },
    dark:  { sky: '#06101C', floor: '#1A4A18', glow: '#0A2838' },
  },
  bird: {
    fur: '#4FB4DC',
    light: { sky: '#E8FAF5', floor: '#34A874', glow: '#7AE8CC' },
    dark:  { sky: '#051510', floor: '#0C3C28', glow: '#08281E' },
  },
  fox: {
    fur: '#E86A32',
    light: { sky: '#FFF2DC', floor: '#B05018', glow: '#FFB030' },
    dark:  { sky: '#1E0E04', floor: '#4E2008', glow: '#7A3410' },
  },
  bunny: {
    fur: '#EBD0DE',
    light: { sky: '#FEF0FA', floor: '#C04A98', glow: '#F0A0D8' },
    dark:  { sky: '#1C0618', floor: '#520A40', glow: '#360A28' },
  },
};

/** Glow peak opacity — raised in dark mode to hold luminance against the deep sky. */
export const GLOW_OPACITY = { light: 0.45, dark: 0.65 } as const;

/** Shared creature part colours (see the handoff "Design Tokens" summary). */
export const CREATURE_COLORS = {
  eye: '#33241A',
  nose: '#6B4A3A',
  beak: '#F2A83A',
  cheek: '#FF7896',        // radial blush base; opacity applied per-mood
  cheekOpacity: 0.55,
  cheekHappyOpacity: 0.7,
  mouth: '#7A3F4A',
  spark: '#FDB022',
  innerEar: '#FFD9E6',     // blended with fur for the pink ear lining
} as const;

/** The three feeding treats — soft colored circles. */
export const TREAT_COLORS = ['#E8524A', '#F2953A', '#C98A5A'] as const;

/**
 * Legacy stored default for `petColor`. When the user's petColor still equals
 * this, the creature falls back to its per-type design fur instead.
 */
export const DEFAULT_PET_COLOR = '#A78BFA';

/** Resolve the fur to draw: the user's chosen swatch, else the per-type design fur. */
export function furFor(type: PetType, petColor: string): string {
  const pal = PET_PALETTES[type] ?? PET_PALETTES.cat;
  return petColor && petColor !== DEFAULT_PET_COLOR ? petColor : pal.fur;
}
