/**
 * symptomSeed.ts — static list of common symptoms used to seed the symptom catalog.
 *
 * Exports SYMPTOM_SEED, a set of everyday health symptoms each tagged with a
 * category key. useHealthStore inserts these into the `symptoms` table on first
 * run (seedSymptoms) to power the health-log typeahead and keep entries linked to
 * a stable symptom id, so trend review groups by symptom rather than free text.
 *
 * Connections:
 *   Imports → —
 *   Used by → store/useHealthStore.ts
 *   Data    → seeds the `symptoms` SQLite table (via useHealthStore)
 *
 * Edit notes:
 *   - `category` values must match SYMPTOM_CATEGORIES keys below (also used for the
 *     i18n labels `symptomCategories.<key>` in lib/i18n.ts).
 *   - Symptom names are intentionally Norwegian and NOT translated — only UI chrome
 *     follows the user's language (same convention as lib/catalogSeed.ts).
 *   - Renaming a seed entry orphans old `sym_<name>` rows (INSERT OR IGNORE keys off
 *     the stable name-derived id) — add a new one instead of renaming.
 */
export type SymptomCategory =
  | 'physical' | 'mental' | 'sleep' | 'digestive' | 'nutrition' | 'other';

export const SYMPTOM_CATEGORIES: SymptomCategory[] = [
  'physical', 'mental', 'sleep', 'digestive', 'nutrition', 'other',
];

export type SeedSymptom = { name: string; category: SymptomCategory };

export const SYMPTOM_SEED: SeedSymptom[] = [
  // Fysisk
  { name: 'Hodepine', category: 'physical' },
  { name: 'Migrene', category: 'physical' },
  { name: 'Muskelsmerter', category: 'physical' },
  { name: 'Leddsmerter', category: 'physical' },
  { name: 'Ryggsmerter', category: 'physical' },
  { name: 'Nakkesmerter', category: 'physical' },
  { name: 'Svimmelhet', category: 'physical' },
  { name: 'Feber', category: 'physical' },
  { name: 'Sår hals', category: 'physical' },
  { name: 'Hoste', category: 'physical' },
  { name: 'Tett nese', category: 'physical' },
  { name: 'Allergi', category: 'physical' },
  { name: 'Utslett', category: 'physical' },
  { name: 'Menstruasjonssmerter', category: 'physical' },

  // Psykisk
  { name: 'Angst', category: 'mental' },
  { name: 'Nedstemthet', category: 'mental' },
  { name: 'Stress', category: 'mental' },
  { name: 'Irritabilitet', category: 'mental' },
  { name: 'Konsentrasjonsvansker', category: 'mental' },
  { name: 'Hjernetåke', category: 'mental' },
  { name: 'Rastløshet', category: 'mental' },
  { name: 'Overveldelse', category: 'mental' },

  // Søvn
  { name: 'Søvnløshet', category: 'sleep' },
  { name: 'Trøtthet', category: 'sleep' },
  { name: 'Utmattelse', category: 'sleep' },
  { name: 'Urolig søvn', category: 'sleep' },

  // Fordøyelse
  { name: 'Kvalme', category: 'digestive' },
  { name: 'Magesmerter', category: 'digestive' },
  { name: 'Oppblåsthet', category: 'digestive' },
  { name: 'Halsbrann', category: 'digestive' },
  { name: 'Diaré', category: 'digestive' },
  { name: 'Forstoppelse', category: 'digestive' },

  // Ernæring
  { name: 'Lavt blodsukker', category: 'nutrition' },
  { name: 'Dehydrering', category: 'nutrition' },
  { name: 'Sug etter mat', category: 'nutrition' },
  { name: 'Manglende appetitt', category: 'nutrition' },
];
