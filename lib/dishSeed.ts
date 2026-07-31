/**
 * dishSeed.ts — static list of dishes used to seed the meal library.
 *
 * Exports DISH_SEED, a set of Norwegian home-cooking dishes (classics, fish,
 * common international family dinners, and pre-packed/convenience meals)
 * each tagged with a meal type, a difficulty, and a full ingredient list.
 * useMealStore inserts these into the `dishes`/`ingredients` tables on every
 * load() (seedDishes), so the Food tab has real content out of the box.
 *
 * The "Matprat/Rema-inspired" block (2026-07-31) adds wok, fish, vegetarian,
 * soup, lunch-box and breakfast dishes modeled on real recipe names and
 * ingredient composition found via search of matprat.no and rema.no
 * (Norway's largest recipe site and a major grocery chain) — direct page
 * fetches of those domains are blocked by this environment's egress policy,
 * so ingredient amounts/prices here are this app's own estimates in the
 * existing seed style, not scraped/verbatim quantities from either site.
 *
 * Connections:
 *   Imports → store/useMealStore (MealType, Difficulty — type-only)
 *   Used by → store/useMealStore.ts
 *   Data    → seeds the `dishes` and `ingredients` SQLite tables (via useMealStore)
 *
 * Edit notes:
 *   - Dish and ingredient names are intentionally Norwegian and NOT translated
 *     — only UI chrome follows the user's language (same convention as
 *     lib/catalogSeed.ts and lib/symptomSeed.ts).
 *   - `priceNok` per ingredient is a rough estimate, not a live price.
 *   - Renaming a seed dish or ingredient orphans the old `dish_<name>` /
 *     `<dishId>_<name>` row (stable ids, INSERT OR IGNORE) — add a new entry
 *     instead of renaming one that's already shipped.
 */
import type { MealType, Difficulty } from '@/store/useMealStore';

export type SeedIngredient = { name: string; amount: string; unit: string; priceNok: number };
export type SeedDish = { name: string; mealType: MealType; difficulty: Difficulty; ingredients: SeedIngredient[] };

export const DISH_SEED: SeedDish[] = [
  // ── Breakfast ──
  {
    name: 'Havregrøt med brunost', mealType: 'breakfast', difficulty: 'easy',
    ingredients: [
      { name: 'Havregryn', amount: '1', unit: 'dl', priceNok: 5 },
      { name: 'Melk', amount: '3', unit: 'dl', priceNok: 8 },
      { name: 'Brunost', amount: '30', unit: 'g', priceNok: 12 },
    ],
  },
  {
    name: 'Brødskive med brunost', mealType: 'breakfast', difficulty: 'easy',
    ingredients: [
      { name: 'Brød', amount: '2', unit: 'skiver', priceNok: 6 },
      { name: 'Brunost', amount: '30', unit: 'g', priceNok: 12 },
      { name: 'Smør', amount: '10', unit: 'g', priceNok: 3 },
    ],
  },
  {
    name: 'Eggerøre', mealType: 'breakfast', difficulty: 'normal',
    ingredients: [
      { name: 'Egg', amount: '3', unit: 'stk', priceNok: 12 },
      { name: 'Melk', amount: '1', unit: 'ss', priceNok: 1 },
      { name: 'Smør', amount: '10', unit: 'g', priceNok: 3 },
      { name: 'Salt og pepper', amount: '1', unit: 'klype', priceNok: 0 },
    ],
  },
  {
    name: 'Skyr med bær og müsli', mealType: 'breakfast', difficulty: 'easy',
    ingredients: [
      { name: 'Skyr naturell', amount: '2', unit: 'dl', priceNok: 15 },
      { name: 'Blåbær', amount: '1', unit: 'dl', priceNok: 20 },
      { name: 'Müsli', amount: '0.5', unit: 'dl', priceNok: 6 },
      { name: 'Honning', amount: '1', unit: 'ts', priceNok: 2 },
    ],
  },
  {
    name: 'Vafler', mealType: 'breakfast', difficulty: 'normal',
    ingredients: [
      { name: 'Hvetemel', amount: '3', unit: 'dl', priceNok: 6 },
      { name: 'Egg', amount: '2', unit: 'stk', priceNok: 8 },
      { name: 'Melk', amount: '5', unit: 'dl', priceNok: 13 },
      { name: 'Smør', amount: '100', unit: 'g', priceNok: 20 },
      { name: 'Sukker', amount: '1', unit: 'ss', priceNok: 1 },
    ],
  },

  // ── Lunch ──
  {
    name: 'Makrell i tomat på brødskive', mealType: 'lunch', difficulty: 'easy',
    ingredients: [
      { name: 'Brød', amount: '2', unit: 'skiver', priceNok: 6 },
      { name: 'Makrell i tomat', amount: '1', unit: 'boks', priceNok: 25 },
      { name: 'Smør', amount: '10', unit: 'g', priceNok: 3 },
    ],
  },
  {
    name: 'Leverpostei med agurk', mealType: 'lunch', difficulty: 'easy',
    ingredients: [
      { name: 'Brød', amount: '2', unit: 'skiver', priceNok: 6 },
      { name: 'Leverpostei', amount: '100', unit: 'g', priceNok: 15 },
      { name: 'Agurk', amount: '4', unit: 'skiver', priceNok: 5 },
    ],
  },
  {
    name: 'Kyllingsalat', mealType: 'lunch', difficulty: 'normal',
    ingredients: [
      { name: 'Kyllingfilet', amount: '150', unit: 'g', priceNok: 30 },
      { name: 'Salatmiks', amount: '2', unit: 'dl', priceNok: 12 },
      { name: 'Mais', amount: '0.5', unit: 'dl', priceNok: 5 },
      { name: 'Majones', amount: '2', unit: 'ss', priceNok: 4 },
      { name: 'Karripulver', amount: '1', unit: 'ts', priceNok: 1 },
    ],
  },
  {
    name: 'Fiskesuppe', mealType: 'lunch', difficulty: 'normal',
    ingredients: [
      { name: 'Fiskekaker', amount: '200', unit: 'g', priceNok: 35 },
      { name: 'Fiskekraft', amount: '5', unit: 'dl', priceNok: 15 },
      { name: 'Fløte', amount: '1', unit: 'dl', priceNok: 10 },
      { name: 'Gulrot', amount: '1', unit: 'stk', priceNok: 3 },
      { name: 'Poteter', amount: '2', unit: 'stk', priceNok: 4 },
    ],
  },
  {
    name: 'Rundstykker med skinke og ost', mealType: 'lunch', difficulty: 'easy',
    ingredients: [
      { name: 'Rundstykker', amount: '2', unit: 'stk', priceNok: 10 },
      { name: 'Kokt skinke', amount: '60', unit: 'g', priceNok: 18 },
      { name: 'Gulost', amount: '40', unit: 'g', priceNok: 8 },
    ],
  },
  {
    name: 'Sursild på knekkebrød', mealType: 'lunch', difficulty: 'easy',
    ingredients: [
      { name: 'Sursild', amount: '1', unit: 'boks', priceNok: 30 },
      { name: 'Knekkebrød', amount: '4', unit: 'stk', priceNok: 6 },
      { name: 'Rødløk', amount: '0.5', unit: 'stk', priceNok: 3 },
      { name: 'Rømme', amount: '2', unit: 'ss', priceNok: 4 },
    ],
  },

  // ── Dinner: Norwegian classics ──
  {
    name: 'Fiskeboller i hvit saus', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Fiskeboller', amount: '1', unit: 'boks', priceNok: 30 },
      { name: 'Hvit saus', amount: '3', unit: 'dl', priceNok: 12 },
      { name: 'Poteter', amount: '4', unit: 'stk', priceNok: 8 },
      { name: 'Gulrøtter', amount: '2', unit: 'stk', priceNok: 6 },
    ],
  },
  {
    name: 'Kjøttkaker med brun saus', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Kjøttkaker', amount: '500', unit: 'g', priceNok: 70 },
      { name: 'Brun saus', amount: '3', unit: 'dl', priceNok: 12 },
      { name: 'Poteter', amount: '5', unit: 'stk', priceNok: 10 },
      { name: 'Tyttebær', amount: '1', unit: 'dl', priceNok: 15 },
    ],
  },
  {
    name: 'Pølse i lompe', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Grillpølser', amount: '4', unit: 'stk', priceNok: 40 },
      { name: 'Lomper', amount: '4', unit: 'stk', priceNok: 20 },
      { name: 'Ketchup', amount: '1', unit: 'ss', priceNok: 2 },
      { name: 'Sennep', amount: '1', unit: 'ss', priceNok: 2 },
      { name: 'Stekt løk', amount: '1', unit: 'dl', priceNok: 5 },
    ],
  },
  {
    name: 'Laks i ovn med poteter', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Laksefilet', amount: '400', unit: 'g', priceNok: 90 },
      { name: 'Poteter', amount: '5', unit: 'stk', priceNok: 10 },
      { name: 'Sitron', amount: '1', unit: 'stk', priceNok: 5 },
      { name: 'Dill', amount: '1', unit: 'ss', priceNok: 3 },
      { name: 'Smør', amount: '20', unit: 'g', priceNok: 5 },
    ],
  },
  {
    name: 'Kyllinggryte', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Kyllingfilet', amount: '400', unit: 'g', priceNok: 80 },
      { name: 'Kokosmelk', amount: '1', unit: 'boks', priceNok: 20 },
      { name: 'Karripasta', amount: '2', unit: 'ss', priceNok: 8 },
      { name: 'Ris', amount: '3', unit: 'dl', priceNok: 10 },
      { name: 'Paprika', amount: '1', unit: 'stk', priceNok: 12 },
    ],
  },
  {
    name: 'Taco fredag', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Kjøttdeig', amount: '400', unit: 'g', priceNok: 60 },
      { name: 'Taco-krydder', amount: '1', unit: 'pk', priceNok: 15 },
      { name: 'Tortillalefser', amount: '8', unit: 'stk', priceNok: 35 },
      { name: 'Tacosaus', amount: '1', unit: 'boks', priceNok: 20 },
      { name: 'Ost', amount: '150', unit: 'g', priceNok: 25 },
      { name: 'Salat og tomat', amount: '1', unit: 'porsjon', priceNok: 15 },
    ],
  },
  {
    name: 'Spaghetti bolognese', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Kjøttdeig', amount: '400', unit: 'g', priceNok: 60 },
      { name: 'Spaghetti', amount: '400', unit: 'g', priceNok: 20 },
      { name: 'Hermetiske tomater', amount: '2', unit: 'bokser', priceNok: 20 },
      { name: 'Løk', amount: '1', unit: 'stk', priceNok: 3 },
      { name: 'Hvitløk', amount: '2', unit: 'fedd', priceNok: 2 },
    ],
  },
  {
    name: 'Pinnekjøtt med kålrabistappe', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Pinnekjøtt', amount: '800', unit: 'g', priceNok: 250 },
      { name: 'Kålrot', amount: '1', unit: 'stk', priceNok: 15 },
      { name: 'Poteter', amount: '3', unit: 'stk', priceNok: 6 },
      { name: 'Smør', amount: '50', unit: 'g', priceNok: 10 },
    ],
  },
  {
    name: 'Fårikål', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Lammekjøtt', amount: '800', unit: 'g', priceNok: 180 },
      { name: 'Hvitkål', amount: '1', unit: 'stk', priceNok: 25 },
      { name: 'Pepperkorn', amount: '1', unit: 'ts', priceNok: 2 },
      { name: 'Poteter', amount: '5', unit: 'stk', priceNok: 10 },
    ],
  },
  {
    name: 'Lapskaus', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Oksekjøtt', amount: '300', unit: 'g', priceNok: 70 },
      { name: 'Poteter', amount: '4', unit: 'stk', priceNok: 8 },
      { name: 'Gulrøtter', amount: '3', unit: 'stk', priceNok: 9 },
      { name: 'Kålrot', amount: '1', unit: 'stk', priceNok: 15 },
      { name: 'Løk', amount: '1', unit: 'stk', priceNok: 3 },
    ],
  },
  {
    name: 'Grillet kylling med potetsalat', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Kyllinglår', amount: '4', unit: 'stk', priceNok: 60 },
      { name: 'Poteter', amount: '5', unit: 'stk', priceNok: 10 },
      { name: 'Majones', amount: '2', unit: 'ss', priceNok: 4 },
      { name: 'Sennep', amount: '1', unit: 'ts', priceNok: 1 },
    ],
  },
  {
    name: 'Ovnsbakt torsk', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Torskefilet', amount: '400', unit: 'g', priceNok: 90 },
      { name: 'Poteter', amount: '4', unit: 'stk', priceNok: 8 },
      { name: 'Gulrøtter', amount: '2', unit: 'stk', priceNok: 6 },
      { name: 'Smør', amount: '30', unit: 'g', priceNok: 6 },
      { name: 'Sitron', amount: '1', unit: 'stk', priceNok: 5 },
    ],
  },

  // ── Dinner: fish ──
  {
    name: 'Fiskegrateng', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Fiskefilet', amount: '400', unit: 'g', priceNok: 80 },
      { name: 'Hvit saus', amount: '4', unit: 'dl', priceNok: 16 },
      { name: 'Ris', amount: '2', unit: 'dl', priceNok: 7 },
      { name: 'Ost', amount: '100', unit: 'g', priceNok: 20 },
      { name: 'Dill', amount: '1', unit: 'ss', priceNok: 3 },
    ],
  },
  {
    name: 'Fish and chips', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Fiskefilet', amount: '400', unit: 'g', priceNok: 80 },
      { name: 'Poteter', amount: '6', unit: 'stk', priceNok: 12 },
      { name: 'Rasp', amount: '1', unit: 'dl', priceNok: 8 },
      { name: 'Egg', amount: '1', unit: 'stk', priceNok: 4 },
      { name: 'Olje til frityr', amount: '5', unit: 'dl', priceNok: 15 },
    ],
  },
  {
    name: 'Ørret i ovn', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Ørretfilet', amount: '400', unit: 'g', priceNok: 100 },
      { name: 'Sitron', amount: '1', unit: 'stk', priceNok: 5 },
      { name: 'Smør', amount: '30', unit: 'g', priceNok: 6 },
      { name: 'Dill', amount: '1', unit: 'ss', priceNok: 3 },
    ],
  },
  {
    name: 'Fiskepudding med ertestuing', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Fiskepudding', amount: '1', unit: 'pk', priceNok: 40 },
      { name: 'Erter', amount: '300', unit: 'g', priceNok: 20 },
      { name: 'Hvit saus', amount: '2', unit: 'dl', priceNok: 8 },
    ],
  },
  {
    name: 'Reker med majones og loff', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Reker', amount: '500', unit: 'g', priceNok: 130 },
      { name: 'Loff', amount: '4', unit: 'skiver', priceNok: 6 },
      { name: 'Majones', amount: '2', unit: 'ss', priceNok: 4 },
      { name: 'Sitron', amount: '1', unit: 'stk', priceNok: 5 },
    ],
  },

  // ── Dinner: international family dinners ──
  {
    name: 'Mexicansk gryte med hvitløksbrød', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Kjøttdeig', amount: '400', unit: 'g', priceNok: 60 },
      { name: 'Mais', amount: '1', unit: 'boks', priceNok: 12 },
      { name: 'Kidneybønner', amount: '1', unit: 'boks', priceNok: 12 },
      { name: 'Hermetiske tomater', amount: '1', unit: 'boks', priceNok: 10 },
      { name: 'Taco-krydder', amount: '1', unit: 'pk', priceNok: 15 },
      { name: 'Hvitløksbrød', amount: '1', unit: 'stk', priceNok: 30 },
    ],
  },
  {
    name: 'Cottage pie', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Kjøttdeig', amount: '400', unit: 'g', priceNok: 60 },
      { name: 'Potetmos', amount: '600', unit: 'g', priceNok: 20 },
      { name: 'Gulrøtter', amount: '1', unit: 'stk', priceNok: 3 },
      { name: 'Løk', amount: '1', unit: 'stk', priceNok: 3 },
      { name: 'Buljong', amount: '2', unit: 'dl', priceNok: 5 },
    ],
  },
  {
    name: "Shepherd's pie", mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Lammekjøttdeig', amount: '400', unit: 'g', priceNok: 90 },
      { name: 'Potetmos', amount: '600', unit: 'g', priceNok: 20 },
      { name: 'Gulrøtter', amount: '1', unit: 'stk', priceNok: 3 },
      { name: 'Erter', amount: '1', unit: 'dl', priceNok: 5 },
      { name: 'Løk', amount: '1', unit: 'stk', priceNok: 3 },
    ],
  },
  {
    name: 'Lasagne', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Lasagneplater', amount: '12', unit: 'stk', priceNok: 25 },
      { name: 'Kjøttdeig', amount: '400', unit: 'g', priceNok: 60 },
      { name: 'Hvit saus', amount: '5', unit: 'dl', priceNok: 20 },
      { name: 'Tomatsaus', amount: '400', unit: 'g', priceNok: 15 },
      { name: 'Ost', amount: '200', unit: 'g', priceNok: 40 },
    ],
  },
  {
    name: 'Pizza (hjemmelaget)', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Pizzabunn', amount: '1', unit: 'stk', priceNok: 20 },
      { name: 'Tomatsaus', amount: '2', unit: 'dl', priceNok: 8 },
      { name: 'Ost', amount: '200', unit: 'g', priceNok: 40 },
      { name: 'Skinke', amount: '100', unit: 'g', priceNok: 25 },
      { name: 'Sopp', amount: '100', unit: 'g', priceNok: 15 },
    ],
  },
  {
    name: 'Hamburger', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Hamburgerbrød', amount: '4', unit: 'stk', priceNok: 20 },
      { name: 'Kjøttdeig', amount: '400', unit: 'g', priceNok: 60 },
      { name: 'Ost', amount: '4', unit: 'skiver', priceNok: 16 },
      { name: 'Salat og tomat', amount: '1', unit: 'porsjon', priceNok: 15 },
      { name: 'Ketchup', amount: '1', unit: 'ss', priceNok: 2 },
    ],
  },

  // ── Dinner: pre-packed / convenience (all easy) ──
  {
    name: 'Frossenpizza', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Frossenpizza', amount: '1', unit: 'stk', priceNok: 60 },
    ],
  },
  {
    name: 'Ferdig lasagne (butikkjøpt)', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Ferdig lasagne', amount: '1', unit: 'pk', priceNok: 70 },
      { name: 'Ferdig salat', amount: '1', unit: 'pose', priceNok: 20 },
    ],
  },
  {
    name: 'Fiskepinner med potetmos', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Fiskepinner', amount: '12', unit: 'stk', priceNok: 40 },
      { name: 'Potetmospulver', amount: '1', unit: 'pk', priceNok: 15 },
      { name: 'Melk', amount: '3', unit: 'dl', priceNok: 8 },
      { name: 'Erter', amount: '200', unit: 'g', priceNok: 15 },
    ],
  },
  {
    name: 'Posesuppe med baguette', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Posesuppe', amount: '1', unit: 'pk', priceNok: 20 },
      { name: 'Baguette', amount: '1', unit: 'stk', priceNok: 25 },
    ],
  },

  // ── Snack ──
  {
    name: 'Knekkebrød med ost', mealType: 'snack', difficulty: 'easy',
    ingredients: [
      { name: 'Knekkebrød', amount: '2', unit: 'stk', priceNok: 4 },
      { name: 'Ost', amount: '40', unit: 'g', priceNok: 8 },
    ],
  },
  {
    name: 'Fruktsalat', mealType: 'snack', difficulty: 'easy',
    ingredients: [
      { name: 'Eple', amount: '1', unit: 'stk', priceNok: 6 },
      { name: 'Banan', amount: '1', unit: 'stk', priceNok: 4 },
      { name: 'Appelsin', amount: '1', unit: 'stk', priceNok: 6 },
    ],
  },
  {
    name: 'Yoghurt med granola', mealType: 'snack', difficulty: 'easy',
    ingredients: [
      { name: 'Naturell yoghurt', amount: '2', unit: 'dl', priceNok: 10 },
      { name: 'Granola', amount: '0.5', unit: 'dl', priceNok: 6 },
      { name: 'Honning', amount: '1', unit: 'ts', priceNok: 2 },
    ],
  },
  {
    name: 'Hjemmelagde energibars', mealType: 'snack', difficulty: 'normal',
    ingredients: [
      { name: 'Havregryn', amount: '2', unit: 'dl', priceNok: 6 },
      { name: 'Peanøttsmør', amount: '2', unit: 'ss', priceNok: 8 },
      { name: 'Honning', amount: '2', unit: 'ss', priceNok: 4 },
      { name: 'Dadler', amount: '6', unit: 'stk', priceNok: 15 },
    ],
  },

  // ── Kveldsmat ──
  {
    name: 'Risengrynsgrøt', mealType: 'kveldsmat', difficulty: 'easy',
    ingredients: [
      { name: 'Ris', amount: '2', unit: 'dl', priceNok: 6 },
      { name: 'Melk', amount: '1', unit: 'l', priceNok: 20 },
      { name: 'Sukker', amount: '1', unit: 'ss', priceNok: 1 },
      { name: 'Kanel', amount: '1', unit: 'ts', priceNok: 1 },
    ],
  },
  {
    name: 'Havregrøt med syltetøy', mealType: 'kveldsmat', difficulty: 'easy',
    ingredients: [
      { name: 'Havregryn', amount: '1', unit: 'dl', priceNok: 5 },
      { name: 'Melk', amount: '3', unit: 'dl', priceNok: 8 },
      { name: 'Jordbærsyltetøy', amount: '1', unit: 'ss', priceNok: 3 },
    ],
  },
  {
    name: 'Brødskive med geitost', mealType: 'kveldsmat', difficulty: 'easy',
    ingredients: [
      { name: 'Brød', amount: '2', unit: 'skiver', priceNok: 6 },
      { name: 'Geitost', amount: '30', unit: 'g', priceNok: 12 },
    ],
  },
  {
    name: 'Toast med skinke og ost', mealType: 'kveldsmat', difficulty: 'normal',
    ingredients: [
      { name: 'Loff', amount: '2', unit: 'skiver', priceNok: 5 },
      { name: 'Skinke', amount: '40', unit: 'g', priceNok: 12 },
      { name: 'Ost', amount: '40', unit: 'g', priceNok: 8 },
      { name: 'Smør', amount: '10', unit: 'g', priceNok: 3 },
    ],
  },

  // ── Matprat/Rema-inspired: breakfast ──
  {
    name: 'Hjemmelaget frokostblanding', mealType: 'breakfast', difficulty: 'easy',
    ingredients: [
      { name: 'Havregryn', amount: '4', unit: 'dl', priceNok: 15 },
      { name: 'Solsikkefrø', amount: '0.5', unit: 'dl', priceNok: 6 },
      { name: 'Mandler', amount: '0.5', unit: 'dl', priceNok: 12 },
      { name: 'Tørket frukt', amount: '1', unit: 'dl', priceNok: 15 },
    ],
  },
  {
    name: 'Sunne pannekaker med havregryn', mealType: 'breakfast', difficulty: 'normal',
    ingredients: [
      { name: 'Havregryn', amount: '2', unit: 'dl', priceNok: 10 },
      { name: 'Egg', amount: '3', unit: 'stk', priceNok: 12 },
      { name: 'Cottage cheese', amount: '2', unit: 'dl', priceNok: 20 },
      { name: 'Banan', amount: '1', unit: 'stk', priceNok: 4 },
    ],
  },

  // ── Matprat/Rema-inspired: lunch ──
  {
    name: 'Blomkålsuppe', mealType: 'lunch', difficulty: 'easy',
    ingredients: [
      { name: 'Blomkål', amount: '1', unit: 'stk', priceNok: 30 },
      { name: 'Løk', amount: '1', unit: 'stk', priceNok: 3 },
      { name: 'Buljong', amount: '6', unit: 'dl', priceNok: 15 },
      { name: 'Melk', amount: '2', unit: 'dl', priceNok: 6 },
    ],
  },
  {
    name: 'Grønnsakssuppe', mealType: 'lunch', difficulty: 'easy',
    ingredients: [
      { name: 'Poteter', amount: '3', unit: 'stk', priceNok: 6 },
      { name: 'Løk', amount: '1', unit: 'stk', priceNok: 3 },
      { name: 'Gulrøtter', amount: '2', unit: 'stk', priceNok: 6 },
      { name: 'Kålrot', amount: '0.5', unit: 'stk', priceNok: 8 },
      { name: 'Hodekål', amount: '0.25', unit: 'stk', priceNok: 8 },
      { name: 'Buljong', amount: '8', unit: 'dl', priceNok: 15 },
    ],
  },
  {
    name: 'Matpakkepita', mealType: 'lunch', difficulty: 'easy',
    ingredients: [
      { name: 'Pitabrød', amount: '2', unit: 'stk', priceNok: 15 },
      { name: 'Pesto', amount: '2', unit: 'ss', priceNok: 8 },
      { name: 'Mozzarella', amount: '100', unit: 'g', priceNok: 20 },
      { name: 'Skinke', amount: '60', unit: 'g', priceNok: 18 },
    ],
  },
  {
    name: 'Ost- og skinkeomelett', mealType: 'lunch', difficulty: 'easy',
    ingredients: [
      { name: 'Egg', amount: '3', unit: 'stk', priceNok: 12 },
      { name: 'Skinke', amount: '60', unit: 'g', priceNok: 18 },
      { name: 'Ost', amount: '50', unit: 'g', priceNok: 10 },
      { name: 'Melk', amount: '1', unit: 'ss', priceNok: 1 },
    ],
  },
  {
    name: 'Wrap med salami og kremost', mealType: 'lunch', difficulty: 'easy',
    ingredients: [
      { name: 'Tortillalefse', amount: '2', unit: 'stk', priceNok: 10 },
      { name: 'Salami', amount: '60', unit: 'g', priceNok: 15 },
      { name: 'Kremost', amount: '3', unit: 'ss', priceNok: 8 },
      { name: 'Salatblad', amount: '2', unit: 'stk', priceNok: 3 },
    ],
  },

  // ── Matprat/Rema-inspired: dinner, fish ──
  {
    name: 'Ovnsbakt laks med spinat og blomkål', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Laksefilet', amount: '400', unit: 'g', priceNok: 90 },
      { name: 'Fersk spinat', amount: '150', unit: 'g', priceNok: 25 },
      { name: 'Blomkål', amount: '0.5', unit: 'stk', priceNok: 15 },
      { name: 'Hvitløk', amount: '2', unit: 'fedd', priceNok: 2 },
      { name: 'Chili', amount: '1', unit: 'stk', priceNok: 5 },
      { name: 'Lime', amount: '1', unit: 'stk', priceNok: 6 },
    ],
  },
  {
    name: 'Laksewok', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Laksefilet', amount: '400', unit: 'g', priceNok: 90 },
      { name: 'Blandede grønnsaker', amount: '400', unit: 'g', priceNok: 30 },
      { name: 'Soyasaus', amount: '2', unit: 'ss', priceNok: 4 },
      { name: 'Lime', amount: '1', unit: 'stk', priceNok: 6 },
      { name: 'Ingefær', amount: '1', unit: 'ss', priceNok: 3 },
      { name: 'Ris', amount: '3', unit: 'dl', priceNok: 10 },
    ],
  },
  {
    name: 'Alt-i-ett-form med laks og grønnsaker', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Laksefilet', amount: '400', unit: 'g', priceNok: 90 },
      { name: 'Poteter', amount: '4', unit: 'stk', priceNok: 8 },
      { name: 'Squash', amount: '1', unit: 'stk', priceNok: 10 },
      { name: 'Fløte', amount: '2', unit: 'dl', priceNok: 18 },
      { name: 'Hvitløk', amount: '2', unit: 'fedd', priceNok: 2 },
      { name: 'Persille', amount: '1', unit: 'ss', priceNok: 2 },
    ],
  },

  // ── Matprat/Rema-inspired: dinner, chicken & wok ──
  {
    name: 'Kyllingwok med brokkoli', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Kyllingfilet', amount: '400', unit: 'g', priceNok: 80 },
      { name: 'Brokkoli', amount: '1', unit: 'stk', priceNok: 25 },
      { name: 'Sopp', amount: '150', unit: 'g', priceNok: 20 },
      { name: 'Vårløk', amount: '3', unit: 'stk', priceNok: 10 },
      { name: 'Østerssaus', amount: '1', unit: 'ss', priceNok: 6 },
      { name: 'Soyasaus', amount: '2', unit: 'ss', priceNok: 4 },
      { name: 'Ingefær', amount: '1', unit: 'ss', priceNok: 3 },
      { name: 'Hvitløk', amount: '2', unit: 'fedd', priceNok: 2 },
      { name: 'Ris', amount: '3', unit: 'dl', priceNok: 10 },
    ],
  },
  {
    name: 'Wok med kylling og nudler', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Kyllingfilet', amount: '400', unit: 'g', priceNok: 80 },
      { name: 'Nudler', amount: '250', unit: 'g', priceNok: 25 },
      { name: 'Paprika', amount: '1', unit: 'stk', priceNok: 12 },
      { name: 'Rødløk', amount: '1', unit: 'stk', priceNok: 5 },
      { name: 'Squash', amount: '1', unit: 'stk', priceNok: 10 },
      { name: 'Babymais', amount: '1', unit: 'boks', priceNok: 15 },
      { name: 'Soyasaus', amount: '3', unit: 'ss', priceNok: 6 },
      { name: 'Ingefær', amount: '1', unit: 'ss', priceNok: 3 },
      { name: 'Chiliflak', amount: '1', unit: 'ts', priceNok: 1 },
    ],
  },
  {
    name: 'Kyllinggryte med kikerter, tomat og spinat', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Kyllingfilet', amount: '400', unit: 'g', priceNok: 80 },
      { name: 'Kikerter', amount: '1', unit: 'boks', priceNok: 12 },
      { name: 'Hermetiske tomater', amount: '1', unit: 'boks', priceNok: 10 },
      { name: 'Fersk spinat', amount: '100', unit: 'g', priceNok: 18 },
      { name: 'Løk', amount: '1', unit: 'stk', priceNok: 3 },
      { name: 'Hvitløk', amount: '2', unit: 'fedd', priceNok: 2 },
    ],
  },
  {
    name: 'Kyllingkjøttkaker', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Kyllingdeig', amount: '500', unit: 'g', priceNok: 75 },
      { name: 'Potetmel', amount: '1', unit: 'ss', priceNok: 2 },
      { name: 'Muskat', amount: '1', unit: 'ts', priceNok: 1 },
      { name: 'Melk', amount: '1', unit: 'dl', priceNok: 3 },
      { name: 'Poteter', amount: '4', unit: 'stk', priceNok: 8 },
      { name: 'Brun saus', amount: '3', unit: 'dl', priceNok: 12 },
    ],
  },

  // ── Matprat/Rema-inspired: dinner, vegetarian & pasta ──
  {
    name: 'Chili sin carne', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Løk', amount: '1', unit: 'stk', priceNok: 3 },
      { name: 'Gulrot', amount: '2', unit: 'stk', priceNok: 6 },
      { name: 'Rød paprika', amount: '1', unit: 'stk', priceNok: 12 },
      { name: 'Hvitløk', amount: '2', unit: 'fedd', priceNok: 2 },
      { name: 'Hermetiske tomater', amount: '2', unit: 'bokser', priceNok: 20 },
      { name: 'Tomatpuré', amount: '1', unit: 'ss', priceNok: 3 },
      { name: 'Røde bønner', amount: '1', unit: 'boks', priceNok: 12 },
      { name: 'Kikerter', amount: '1', unit: 'boks', priceNok: 12 },
      { name: 'Spisskummen', amount: '1', unit: 'ts', priceNok: 1 },
    ],
  },
  {
    name: 'Vegetarisk thaigryte', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Rød currypasta', amount: '2', unit: 'ss', priceNok: 10 },
      { name: 'Kokosmelk', amount: '1', unit: 'boks', priceNok: 20 },
      { name: 'Linser', amount: '2', unit: 'dl', priceNok: 12 },
      { name: 'Kikerter', amount: '1', unit: 'boks', priceNok: 12 },
      { name: 'Butternut squash', amount: '300', unit: 'g', priceNok: 25 },
      { name: 'Lime', amount: '1', unit: 'stk', priceNok: 5 },
      { name: 'Ris', amount: '3', unit: 'dl', priceNok: 10 },
    ],
  },
  {
    name: 'Åpen vegetarlasagne', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Aubergine', amount: '1', unit: 'stk', priceNok: 20 },
      { name: 'Grønn squash', amount: '1', unit: 'stk', priceNok: 10 },
      { name: 'Rød paprika', amount: '1', unit: 'stk', priceNok: 12 },
      { name: 'Gul paprika', amount: '1', unit: 'stk', priceNok: 12 },
      { name: 'Hermetiske tomater', amount: '2', unit: 'bokser', priceNok: 20 },
      { name: 'Lasagneplater', amount: '6', unit: 'stk', priceNok: 15 },
      { name: 'Ost', amount: '150', unit: 'g', priceNok: 30 },
      { name: 'Timian', amount: '1', unit: 'ts', priceNok: 2 },
    ],
  },
  {
    name: 'One pot pasta med kjøttdeig', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Kjøttdeig', amount: '400', unit: 'g', priceNok: 60 },
      { name: 'Spaghetti', amount: '400', unit: 'g', priceNok: 20 },
      { name: 'Løk', amount: '1', unit: 'stk', priceNok: 3 },
      { name: 'Hvitløk', amount: '1', unit: 'fedd', priceNok: 1 },
      { name: 'Hermetiske tomater', amount: '1', unit: 'boks', priceNok: 10 },
      { name: 'Cherrytomater', amount: '250', unit: 'g', priceNok: 25 },
      { name: 'Fersk spinat', amount: '100', unit: 'g', priceNok: 18 },
      { name: 'Parmesan', amount: '50', unit: 'g', priceNok: 15 },
    ],
  },

  // ── Matprat/Rema-inspired: dinner, quick & family ──
  {
    name: 'Rask middagsgryte med kjøttdeig', mealType: 'dinner', difficulty: 'easy',
    ingredients: [
      { name: 'Kjøttdeig', amount: '400', unit: 'g', priceNok: 60 },
      { name: 'Poteter', amount: '4', unit: 'stk', priceNok: 8 },
      { name: 'Gulrøtter', amount: '2', unit: 'stk', priceNok: 6 },
      { name: 'Løk', amount: '1', unit: 'stk', priceNok: 3 },
      { name: 'Buljong', amount: '5', unit: 'dl', priceNok: 10 },
    ],
  },
  {
    name: 'Burrito med kjøttdeig', mealType: 'dinner', difficulty: 'normal',
    ingredients: [
      { name: 'Kjøttdeig', amount: '400', unit: 'g', priceNok: 60 },
      { name: 'Løk', amount: '1', unit: 'stk', priceNok: 3 },
      { name: 'Taco-krydder', amount: '1', unit: 'pk', priceNok: 15 },
      { name: 'Salsa', amount: '1', unit: 'boks', priceNok: 20 },
      { name: 'Tortillalefser', amount: '6', unit: 'stk', priceNok: 30 },
      { name: 'Ost', amount: '150', unit: 'g', priceNok: 30 },
      { name: 'Svarte bønner', amount: '1', unit: 'boks', priceNok: 12 },
      { name: 'Cherrytomater', amount: '150', unit: 'g', priceNok: 15 },
    ],
  },
];
