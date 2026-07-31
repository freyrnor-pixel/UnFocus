/**
 * aiSetupGuide.ts — the downloadable "AI setup guide" .txt: schema, text builder, parser.
 *
 * The app has no in-app AI or automation-builder, so this bridges that gap: a user
 * downloads a .txt file documenting the app's data model in technical terms, hands it
 * to an external AI (e.g. Claude), describes what they want set up, and gets back a
 * filled-in file. That reply embeds exactly one JSON block (schema documented in the
 * guide's own prose) between fixed BEGIN/END markers; everything else in the file is
 * free text the AI can write however it likes. Uploading the reply back into Settings
 * parses just that block — see lib/aiSetupApply.ts for validating/writing it into the
 * real stores. This file is pure (no store writes, no SQLite) except for the two
 * export functions' file-system/share calls.
 *
 * Connections:
 *   Imports → lib/date (todayStr), lib/backup (SaveToDeviceResult type),
 *             expo-file-system/legacy, expo-sharing, expo-document-picker,
 *             expo-constants, react-native (Platform)
 *   Used by → app/settings.tsx (download + upload/preview), app/onboarding/intro.tsx
 *             (download only), lib/aiSetupApply.ts (consumes AiSetupConfig + the
 *             per-domain draft types), __tests__/aiSetupGuide.test.ts
 *   Data    → none — pure text template + JSON parse; never touches SQLite. The actual
 *             store writes live in lib/aiSetupApply.ts.
 *
 * Edit notes:
 *   - AI_SETUP_SCHEMA_VERSION must bump whenever the guide's schema or documented
 *     content changes — see AGENTS.md's "Add a new setting toggle" / "Add a new
 *     SQLite column" cookbook steps for when to touch this file. A downloaded guide
 *     embeds this version; on import, an older version is a 'stale' warning (proceed
 *     anyway), a newer version is 'invalid' (this build can't safely interpret fields
 *     it doesn't know about).
 *   - **Medicines and doses (2026-07-27) are deliberately OUT of scope** — do not add a
 *     medicine domain here. Medicine names and doses are the most sensitive rows in the
 *     database, and this guide already refuses health-log data for the same reason. The
 *     exclusion is intentionally NOT spelled out in the guide's own text: no `medicines`
 *     key exists in the schema, so an AI can't write one anyway (unknown keys are skipped),
 *     and adding a sentence would be a content change requiring a version bump that would
 *     stale-warn every guide file users have already downloaded. Same reasoning applies to
 *     `health_logs.medicine_id`.
 *   - The guide text is deliberately English-only, even though the rest of the app's
 *     UI is bilingual (en/no) — it's a technical document for an AI to parse, and its
 *     field names/schema are English regardless of app language. Only the buttons/
 *     modals AROUND this feature go through useT() as usual.
 *   - NATIVE modules used here (expo-file-system / expo-sharing / expo-document-picker)
 *     are already installed and already used elsewhere (lib/backup.ts) — these are new
 *     call sites only, not a native-surface change, so no build-gating is needed.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  cacheDirectory,
  documentDirectory,
  writeAsStringAsync,
  readAsStringAsync,
  EncodingType,
  StorageAccessFramework,
} from 'expo-file-system/legacy';
import { todayStr } from '@/lib/date';
import type { SaveToDeviceResult } from '@/lib/backup';

/** Bump whenever the guide's schema or documented content changes — see Edit notes. */
export const AI_SETUP_SCHEMA_VERSION = 3;

/** Verbatim markers the guide instructs the AI to reproduce around its JSON reply. */
export const AI_SETUP_BEGIN = '===UNFOCUS-AI-CONFIG-BEGIN===';
export const AI_SETUP_END = '===UNFOCUS-AI-CONFIG-END===';

// ── Config schema (untrusted-input shapes — validated in lib/aiSetupApply.ts) ──────

export type AiSettingsPatch = {
  language?: 'en' | 'no';
  darkMode?: 'system' | 'on' | 'off';
  fontSize?: 'small' | 'default' | 'large';
  reducedMotion?: boolean;
  particlesEnabled?: boolean;
  glassSurfaces?: boolean;
  leftHanded?: boolean;
  remindersEnabled?: boolean;
  reminderTime?: string;
  taskNotificationsEnabled?: boolean;
  habitNotificationsEnabled?: boolean;
  persistentNotifEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  weeklyResetDay?: number;
  monthlyResetDate?: number;
  energyMode?: 'daily' | 'weekly' | 'custom';
  energyDailyCapacity?: number;
  energyWeeklyCapacity?: number;
  featureGoals?: boolean;
  featureSharing?: boolean;
  featureAutomations?: boolean;
  energySystemEnabled?: boolean;
  showGrowth?: boolean;
  photoAspectRatio?: 'fit' | 'square' | 'classic' | 'widescreen' | 'golden';
  peopleModeEnabled?: boolean;
};

export type AiTaskDraft = {
  title: string;
  date: string;
  taskType?: 'start-at' | 'time-box';
  recurring?: 'none' | 'daily' | 'weekly' | 'monthly';
  recurringDays?: number[];
  monthlyMode?: 'day' | 'ordinal';
  monthOrdinal?: 'first' | 'second' | 'third' | 'fourth' | 'last';
  monthWeekday?: number;
  time?: string;
  finishTime?: string;
  hint?: string;
};

export type AiHabitDraft = {
  title: string;
  kind: 'build' | 'break' | 'neutral';
  recurrence: 'daily' | 'weekly' | 'monthly' | 'one-time' | 'weekly-flexible';
  category: 'physical' | 'mental' | 'health' | 'nutrition' | 'sleep' | 'work' | 'wellbeing' | 'other';
  dailyGoal: number;
  recurrenceDays?: number[];
};

export type AiGoalDraft = { title: string };

export type AiNoteDraft = { header: string; body?: string };

export type AiShoppingListDraft = {
  name?: string;
  startDate?: string;
  endDate?: string;
  isRecurring?: boolean;
  recurrenceIntervalWeeks?: number;
};

export type AiShoppingItemDraft = {
  name: string;
  /** Matched (case-insensitive) against a `shoppingLists` entry's name in the same
   *  config; unresolved or omitted falls back to the "Unallocated" bucket. */
  listName?: string;
  amount?: string;
  unit?: string;
};

/** Household inventory ("Katalog" list on the Shopping tab) — permanent stock, not the autocomplete list below. */
export type AiInventoryItemDraft = {
  name: string;
  amount?: string;
  unit?: string;
  price?: number;
  category?: string;
  targetQuantity?: number;
};

/** The separate auto-managed price/store-learning autocomplete list (the "Catalogue" tab). */
export type AiCatalogueItemDraft = {
  name: string;
  price?: number;
  category?: string;
  store?: string;
};

export type AiMealIngredientDraft = { name: string; amount?: string; unit?: string; priceNok?: number };

export type AiMealDraft = {
  name: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'kveldsmat';
  difficulty?: 'easy' | 'normal';
  ingredients?: AiMealIngredientDraft[];
};

export type AiMonthlyListDraft = { name?: string; budgetNok?: number };

export type AiSetupConfig = {
  version: number;
  settings?: Partial<AiSettingsPatch>;
  tasks?: AiTaskDraft[];
  habits?: AiHabitDraft[];
  goals?: AiGoalDraft[];
  notes?: AiNoteDraft[];
  shoppingLists?: AiShoppingListDraft[];
  shoppingItems?: AiShoppingItemDraft[];
  inventoryItems?: AiInventoryItemDraft[];
  catalogueItems?: AiCatalogueItemDraft[];
  meals?: AiMealDraft[];
  monthlyLists?: AiMonthlyListDraft[];
};

// ── Guide text ──────────────────────────────────────────────────────────────────────

/** Builds the full downloadable guide — see the Edit notes for why it's English-only. */
export function buildAiSetupGuideText(): string {
  const appVersion = Constants.expoConfig?.version ?? '';
  const generatedAt = new Date().toISOString();

  const header = `UNFOCUS — AI SETUP GUIDE (schema v${AI_SETUP_SCHEMA_VERSION})
App version: ${appVersion}
Generated: ${generatedAt}

UnFocus is a local-only ADHD life-management app (tasks, habits, goals, notes,
shopping, meals) with no in-app AI or automation-builder. This file lets an
external AI assistant help you configure it: read the sections below, describe
what you want to an AI, then upload the AI's reply back into the app.`;

  const humanInstructions = `HOW TO USE THIS FILE
1. Give this whole file to an AI assistant (e.g. Claude).
2. Tell it, in your own words, what you want set up — which tasks, habits,
   shopping items, meals, settings, etc.
3. Ask it to reply with an updated version of this file.
4. Download that reply as a .txt file.
5. In UnFocus, open Settings → General → Local account, and use "Upload AI
   setup file". You'll see a preview of what will be created before anything
   is applied — nothing changes until you confirm.`;

  const aiInstructions = `INSTRUCTIONS FOR THE AI ASSISTANT READING THIS FILE
You are helping a human configure the UnFocus app. Read the schema below, ask
the human what they want, then reply with this file's content again, with
exactly ONE JSON block between these exact markers:

${AI_SETUP_BEGIN}
{ ... }
${AI_SETUP_END}

Rules:
- Output exactly one such block. Nothing inside it except valid JSON.
- The JSON's top-level "version" field must be ${AI_SETUP_SCHEMA_VERSION}.
- Unknown top-level keys are ignored by the app; keys inside a known section
  that don't match the documented shape may cause just that one item to be
  skipped, not the whole import.
- Don't invent data the human didn't ask for — omit or leave empty any
  section they didn't mention.
- Automations (IFTTT-style "when X, do Y" rules) and health-log entries are
  NOT supported by this import. If asked, say this app version can't set
  those up this way — the human can still add them manually in the app.
- Dates are "YYYY-MM-DD". Times are 24-hour "HH:MM". Keep text fields
  reasonably short (titles/names under ~150 characters, note bodies under
  ~2000) — anything longer is dropped by the app.
- You may write as much explanation as you like outside the marked block —
  only the one marked block is read by the app.`;

  const schema = `JSON SCHEMA
Every top-level key is optional — include only what the human asked for. Any
field not listed here is not supported for import in this app version.

"settings" (object) — a patch of app preferences. Only these keys are
accepted (anything else is ignored):
  language: "en" | "no"
  darkMode: "system" | "on" | "off"
  fontSize: "small" | "default" | "large"
  reducedMotion, particlesEnabled, glassSurfaces, leftHanded: boolean
  remindersEnabled: boolean
  reminderTime: "HH:MM"
  taskNotificationsEnabled, habitNotificationsEnabled,
  persistentNotifEnabled: boolean
  quietHoursEnabled: boolean
  quietHoursStart, quietHoursEnd: "HH:MM"
  weeklyResetDay: 0-6 (0=Mon)
  monthlyResetDate: 1-31
  energyMode: "daily" | "weekly" | "custom"
  energyDailyCapacity, energyWeeklyCapacity: number >= 0
  featureGoals, featureSharing, featureAutomations: boolean
  energySystemEnabled: boolean (the Energy system's master switch)
  showGrowth: boolean (ambient growth in the app backdrop)
  photoAspectRatio: "fit" | "square" | "classic" | "widescreen" | "golden"
  peopleModeEnabled: boolean
  (Account/device/permission settings are never importable this way — those
  stay a manual, in-app action.)

"tasks" (array) — one-off or recurring to-dos.
  title (required, string), date (required, "YYYY-MM-DD")
  taskType: "start-at" | "time-box" (default "start-at")
  recurring: "none" | "daily" | "weekly" | "monthly" (default "none")
  recurringDays: array of 0-6 (0=Mon), for weekly recurrence
  monthlyMode: "day" | "ordinal"; monthOrdinal: "first".."last"; monthWeekday: 0-6
  time, finishTime: "HH:MM"
  hint: string (a freeform display-only note)
  Example: { "title": "Pay rent", "date": "2026-08-01", "recurring": "monthly" }

"habits" (array) — daily/weekly/monthly habits.
  title (required), kind: "build" | "break" | "neutral" (required)
  recurrence (required): "daily" | "weekly" | "monthly" | "one-time" | "weekly-flexible"
  category (required): "physical" | "mental" | "health" | "nutrition" | "sleep" |
    "work" | "wellbeing" | "other"
  dailyGoal (required, integer >= 1)
  recurrenceDays: array of 0-6 (0=Mon) — REQUIRED, non-empty, when recurrence
    is "weekly" or "weekly-flexible"
  Example: { "title": "Drink water", "kind": "neutral", "recurrence": "daily",
             "category": "health", "dailyGoal": 6 }

"goals" (array) — lightweight goals tasks/habits can link to.
  title (required, string) — that's the entire shape.

"notes" (array) — free-form notes.
  header (required, string), body (optional, string)

"shoppingLists" (array) — named weekly shopping list periods.
  name, startDate, endDate (all optional — default to the current week),
  isRecurring (boolean), recurrenceIntervalWeeks (1-4)

"shoppingItems" (array) — items on a weekly shopping list.
  name (required)
  listName: matches a "shoppingLists" entry's name above (case-insensitive);
    if omitted or unmatched, the item lands in the "Unallocated" bucket.
  amount, unit (optional)

"inventoryItems" (array) — your permanent household stock (the "Katalog" list
  on the Shopping tab — NOT the autocomplete list below).
  name (required); amount, unit, price, category, targetQuantity (optional)

"catalogueItems" (array) — the separate autocomplete/price-learning list (the
  "Catalogue" tab). Normally filled by real purchases; this lets the AI seed
  entries directly.
  name (required); price, category, store (optional)

"meals" (array) — dishes for meal planning.
  name (required)
  mealType (required): "breakfast" | "lunch" | "dinner" | "snack" | "kveldsmat"
  difficulty: "easy" | "normal" (default "normal")
  ingredients: array of { name (required), amount, unit, priceNok }

"monthlyLists" (array) — independently-budgeted monthly lists.
  name (optional), budgetNok (optional, number >= 0)`;

  const example = `WORKED EXAMPLE

${AI_SETUP_BEGIN}
{
  "version": ${AI_SETUP_SCHEMA_VERSION},
  "settings": { "darkMode": "on", "habitNotificationsEnabled": true },
  "tasks": [
    { "title": "Renew car insurance", "date": "${todayStr()}", "taskType": "start-at" }
  ],
  "habits": [
    { "title": "Stretch", "kind": "neutral", "recurrence": "daily",
      "category": "physical", "dailyGoal": 1 }
  ]
}
${AI_SETUP_END}`;

  const footer = `Guide version: ${AI_SETUP_SCHEMA_VERSION}
Reminder: automations (IFTTT-style rules) and health-log entries cannot be
set up through this file yet — add those directly in the app.`;

  return [header, humanInstructions, aiInstructions, schema, example, footer].join('\n\n');
}

// ── Parse ───────────────────────────────────────────────────────────────────────────

export type ParsedAiSetup =
  | { status: 'canceled' }
  | { status: 'invalid'; reason: 'no-markers' | 'json' | 'unknown-version' }
  | { status: 'stale'; data: AiSetupConfig }
  | { status: 'ok'; data: AiSetupConfig };

/** Extracts the JSON text between the markers, tolerating an AI-added markdown code fence. */
function extractConfigJson(text: string): string | null {
  const beginIdx = text.indexOf(AI_SETUP_BEGIN);
  const endIdx = text.indexOf(AI_SETUP_END);
  if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) return null;
  let inner = text.slice(beginIdx + AI_SETUP_BEGIN.length, endIdx).trim();
  const fenceMatch = inner.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/);
  if (fenceMatch) inner = fenceMatch[1].trim();
  return inner;
}

/** Sync, pure. Never throws — bad input resolves to a status, not an exception. */
export function parseAiSetupFile(text: string): ParsedAiSetup {
  const jsonText = extractConfigJson(text);
  if (jsonText == null) return { status: 'invalid', reason: 'no-markers' };

  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return { status: 'invalid', reason: 'json' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { status: 'invalid', reason: 'json' };
  }
  const version = (data as Record<string, unknown>).version;
  if (typeof version !== 'number') return { status: 'invalid', reason: 'json' };
  if (version > AI_SETUP_SCHEMA_VERSION) return { status: 'invalid', reason: 'unknown-version' };

  const config = data as AiSetupConfig;
  if (version < AI_SETUP_SCHEMA_VERSION) return { status: 'stale', data: config };
  return { status: 'ok', data: config };
}

/** Pick a file, read it, and parse it. Never throws. */
export async function pickAndParseAiSetupFile(): Promise<ParsedAiSetup> {
  let uri: string | undefined;
  try {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled) return { status: 'canceled' };
    uri = res.assets?.[0]?.uri;
  } catch {
    return { status: 'invalid', reason: 'json' };
  }
  if (!uri) return { status: 'canceled' };

  let text: string;
  try {
    text = await readAsStringAsync(uri, { encoding: EncodingType.UTF8 });
  } catch {
    return { status: 'invalid', reason: 'json' };
  }
  return parseAiSetupFile(text);
}

// ── Export ──────────────────────────────────────────────────────────────────────────

const GUIDE_FILENAME = 'unfocus-ai-setup-guide';

/** Writes the guide to the cache dir and opens the OS share sheet. */
export async function exportAiSetupGuide(): Promise<'shared' | 'unavailable'> {
  const text = buildAiSetupGuideText();
  const uri = `${cacheDirectory}${GUIDE_FILENAME}.txt`;
  await writeAsStringAsync(uri, text, { encoding: EncodingType.UTF8 });

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, {
    mimeType: 'text/plain',
    dialogTitle: 'UnFocus AI setup guide',
    UTI: 'public.plain-text',
  });
  return 'shared';
}

/** Best-effort human-readable label for a SAF directory URI, e.g. "Download". */
function safDirectoryLabel(dirUri: string): string {
  try {
    const decoded = decodeURIComponent(dirUri);
    const afterTree = decoded.split('/tree/')[1] ?? decoded;
    return afterTree.split(':').pop() || decoded;
  } catch {
    return dirUri;
  }
}

/**
 * Writes the guide as a real file directly to a user-visible location, instead of
 * routing through the OS share sheet — the "local save" counterpart to
 * exportAiSetupGuide(), mirroring lib/backup.ts's exportBackupToDevice() exactly.
 */
export async function exportAiSetupGuideToDevice(): Promise<SaveToDeviceResult> {
  const text = buildAiSetupGuideText();

  if (Platform.OS === 'android') {
    const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) return { status: 'canceled' };
    const fileUri = await StorageAccessFramework.createFileAsync(perm.directoryUri, GUIDE_FILENAME, 'text/plain');
    await StorageAccessFramework.writeAsStringAsync(fileUri, text, { encoding: EncodingType.UTF8 });
    return { status: 'saved', location: safDirectoryLabel(perm.directoryUri) };
  }

  if (Platform.OS === 'ios' && documentDirectory) {
    try {
      const uri = `${documentDirectory}${GUIDE_FILENAME}.txt`;
      await writeAsStringAsync(uri, text, { encoding: EncodingType.UTF8 });
      return { status: 'saved', location: 'Files → On My iPhone/iPad → UnFocus' };
    } catch {
      // Fall through to the share sheet below.
    }
  }

  if (!(await Sharing.isAvailableAsync())) return { status: 'unavailable' };
  const uri = `${cacheDirectory}${GUIDE_FILENAME}.txt`;
  await writeAsStringAsync(uri, text, { encoding: EncodingType.UTF8 });
  await Sharing.shareAsync(uri, {
    mimeType: 'text/plain',
    dialogTitle: 'UnFocus AI setup guide',
    UTI: 'public.plain-text',
  });
  return { status: 'saved', location: 'the location you chose' };
}
