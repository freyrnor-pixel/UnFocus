/**
 * petData.ts — shared pet constants for Pet.tsx
 *
 * Centralises PET_EMOJIS, PET_HABITATS, and food-chip helpers so both
 * components pull from a single source of truth.
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
 *     app chrome, so the semantic token layer doesn't apply here.
 */
import type { PetType } from '@/store/useSettingsStore';

export type PetState = 'idle' | 'happy' | 'eating' | 'excited' | 'sleeping';
export type FoodChip = { emoji: string; label: string; category: string };

export const PET_EMOJIS: Record<PetType, Record<PetState, string>> = {
  cat:   { idle: '🐱', happy: '😸', eating: '😋', excited: '🙀', sleeping: '😴' },
  dog:   { idle: '🐶', happy: '🐕', eating: '🦴', excited: '🐩', sleeping: '🐾' },
  bird:  { idle: '🐦', happy: '🦜', eating: '🌰', excited: '🦚', sleeping: '🐣' },
  fox:   { idle: '🦊', happy: '🦊', eating: '🍖', excited: '🐾', sleeping: '🍂' },
  bunny: { idle: '🐰', happy: '🐇', eating: '🥕', excited: '🌸', sleeping: '💤' },
};

export const PET_HABITATS: Record<PetType, { bg: string; radius: number; floor: string; floorBg: string }> = {
  cat:   { bg: '#FFF4EE', radius: 32, floor: '🛋️', floorBg: '#FFE4D0' },
  dog:   { bg: '#FFFBF5', radius: 10, floor: '🏡', floorBg: '#FFE8C2' },
  bird:  { bg: '#EDFBF2', radius: 18, floor: '🪺', floorBg: '#C8EDCF' },
  fox:   { bg: '#FEF8F0', radius: 22, floor: '🍂', floorBg: '#FCDCB0' },
  bunny: { bg: '#FFF4FA', radius: 36, floor: '🌸', floorBg: '#F9D4EA' },
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

export const FOOD_CATEGORY_REACTIONS: Record<string, string[]> = {
  produce:  ['So fresh! 🌿', 'Healthy! 🥗'],
  dairy:    ['Creamy! 🧀',   'Yum! 🥛'],
  meat:     ['Protein! 💪',  'So meaty!'],
  fish:     ['Protein! 💪',  'Fishy! 🐟'],
  bread:    ['So warm! 🍞',  'Toasty! 🥐'],
  frozen:   ['Cool! ❄️',     'Refreshing!'],
  canned:   ['Nom nom! 🥫',  'Yummy!'],
  dry:      ['Crunchy! 🌾',  'Nom nom!'],
  snacks:   ['Treat time! 🍿', 'So good!'],
  drinks:   ['Slurp! 🥤',   'Refreshing!'],
  other:    ['Nom nom! 😋',  'Yummy! ✨'],
};

export const DEFAULT_FOOD_ITEMS: FoodChip[] = [
  { emoji: '🍎', label: 'Apple',  category: 'produce' },
  { emoji: '🥕', label: 'Carrot', category: 'produce' },
  { emoji: '🐟', label: 'Fish',   category: 'fish' },
];

export function shoppingItemToFoodChip(item: { name: string; category: string }): FoodChip {
  const lower = item.name.toLowerCase();
  const match = FOOD_KEYWORD_EMOJIS.find(([re]) => re.test(lower));
  const emoji = match ? match[1] : (FOOD_CATEGORY_EMOJIS[item.category] ?? '🛒');
  return { emoji, label: item.name.slice(0, 6), category: item.category };
}

export function reactionForCategory(category: string): string {
  const pool = FOOD_CATEGORY_REACTIONS[category] ?? FOOD_CATEGORY_REACTIONS.other;
  return pool[Math.floor(Math.random() * pool.length)];
}
