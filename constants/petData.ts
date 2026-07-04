/**
 * petData.ts — shared pet constants for Pet.tsx
 *
 * Centralises PET_EMOJIS, PET_HABITATS, and food-chip helpers so the pet
 * component pulls art + data from a single source of truth. Redesigned per
 * Decision 039 (positive-only companion): the pet has no negative states —
 * `resting` (renamed from the old `sleeping`) is a cozy night state, never a
 * neglect/hunger state.
 *
 * Connections:
 *   Imports → store/useSettingsStore (PetType type only)
 *   Used by → components/Pet.tsx
 *   Data    → none — pure constants/helpers
 *
 * Edit notes:
 *   - Habitat/food colours are fixed decorative hex, not Decision 006 tokens —
 *     same precedent as HomeHeroBackground.tsx's sky/orb palette and
 *     ParticleBackground.tsx's dot/orb colours: illustrative art values, not
 *     app chrome, so the semantic token layer doesn't apply here (Decision 039 §6).
 *   - No message strings live here anymore (Decision 039 §7). Praise / excited /
 *     per-category eating reactions are bilingual and owned by lib/i18n.ts
 *     (`pet.*`), selected in Pet.tsx via useT(). This file stays string-free
 *     except emoji art.
 *   - `reactionCategory()` collapses a shopping category slug onto the smaller
 *     set of reaction buckets that i18n actually carries (fallback → 'other').
 */
import type { PetType } from '@/store/useSettingsStore';

export type PetState = 'idle' | 'happy' | 'eating' | 'excited' | 'resting';
export type FoodChip = { emoji: string; label: string; category: string };

export const PET_EMOJIS: Record<PetType, Record<PetState, string>> = {
  cat:   { idle: '🐱', happy: '😸', eating: '😋', excited: '🙀', resting: '😴' },
  dog:   { idle: '🐶', happy: '🐕', eating: '😋', excited: '🐩', resting: '😴' },
  bird:  { idle: '🐦', happy: '🦜', eating: '😋', excited: '🦚', resting: '😴' },
  fox:   { idle: '🦊', happy: '😻', eating: '😋', excited: '✨', resting: '😴' },
  bunny: { idle: '🐰', happy: '🐇', eating: '😋', excited: '🌸', resting: '😴' },
};

/**
 * One cohesive habitat per pet type. Two-tone sky (back → floor band) plus a
 * small decorative floor emoji, drawn from Views/Text only (no image assets).
 * `accent` is a soft decorative tint used behind the pet; consistent sizing is
 * enforced by the component, not here.
 */
export const PET_HABITATS: Record<
  PetType,
  { sky: string; floorBg: string; accent: string; floor: string; radius: number }
> = {
  cat:   { sky: '#FFF4EE', floorBg: '#FFE4D0', accent: '#FFD9C2', floor: '🛋️', radius: 26 },
  dog:   { sky: '#FFFBF3', floorBg: '#FFE8C2', accent: '#FFEACB', floor: '🦴', radius: 22 },
  bird:  { sky: '#EDFBF6', floorBg: '#C8EDDA', accent: '#D6F2E4', floor: '🪺', radius: 26 },
  fox:   { sky: '#FEF6EC', floorBg: '#FCDCB0', accent: '#FBE6C7', floor: '🍂', radius: 24 },
  bunny: { sky: '#FFF4FA', floorBg: '#F9D4EA', accent: '#FBE0F0', floor: '🌷', radius: 28 },
};

// Keyword patterns tested against the lowercased item name; first match wins.
export const FOOD_KEYWORD_EMOJIS: [RegExp, string][] = [
  [/apple|eple/,              '🍎'],
  [/banana/,                  '🍌'],
  [/carrot|gulrot/,           '🥕'],
  [/milk|melk/,               '🥛'],
  [/cheese|ost/,              '🧀'],
  [/egg/,                     '🥚'],
  [/fish|laks|tuna|torsk/,    '🐟'],
  [/chicken|kylling/,         '🍗'],
  [/bread|brød/,              '🍞'],
  [/butter|smør/,             '🧈'],
  [/tomato|tomat/,            '🍅'],
  [/pasta/,                   '🍝'],
  [/rice|ris/,                '🍚'],
  [/coffee|kaffe/,            '☕'],
  [/chocolate|sjokolade/,     '🍫'],
];

// Category slug → fallback emoji; slugs match CATEGORY_ORDER in app/shopping.tsx.
export const FOOD_CATEGORY_EMOJIS: Record<string, string> = {
  produce:  '🥦',
  dairy:    '🧀',
  meat:     '🥩',
  fish:     '🐟',
  bread:    '🍞',
  frozen:   '🧊',
  canned:   '🥫',
  dry:      '🌾',
  snacks:   '🍿',
  drinks:   '🥤',
  cleaning: '🧹',
  personal: '🧴',
  other:    '🛒',
};

// Reaction buckets that lib/i18n.ts (`pet.reactions`) actually carries. Any
// shopping category slug outside this set collapses to 'other'.
export const REACTION_CATEGORIES = [
  'produce', 'dairy', 'meat', 'fish', 'bread', 'snacks', 'drinks', 'other',
] as const;
export type ReactionCategory = (typeof REACTION_CATEGORIES)[number];

export function reactionCategory(category: string): ReactionCategory {
  return (REACTION_CATEGORIES as readonly string[]).includes(category)
    ? (category as ReactionCategory)
    : 'other';
}

export const DEFAULT_FOOD_ITEMS: FoodChip[] = [
  { emoji: '🍎', label: 'Apple',  category: 'produce' },
  { emoji: '🥕', label: 'Carrot', category: 'produce' },
  { emoji: '🐟', label: 'Fish',   category: 'fish' },
];

export function shoppingItemToFoodChip(item: { name: string; category: string }): FoodChip {
  const lower = item.name.toLowerCase();
  const match = FOOD_KEYWORD_EMOJIS.find(([re]) => re.test(lower));
  const emoji = match ? match[1] : (FOOD_CATEGORY_EMOJIS[item.category] ?? '🛒');
  return { emoji, label: item.name.slice(0, 8), category: item.category };
}
