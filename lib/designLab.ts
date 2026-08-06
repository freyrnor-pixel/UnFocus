/**
 * designLab.ts — the design lab registry: every knob the maintainer can turn, and what it moves.
 *
 * The app's visual decisions have historically been made by describing a look in prose,
 * waiting for an agent to guess at it, and then looking at the result an OTA later. This
 * module is the data half of the surface that closes that loop: a declared set of knobs over
 * the colour palette, the geometry tokens, the control kinds and the row anatomy, plus the
 * override bag those knobs write into. `app/design-lab.tsx` renders it, `lib/designLabExport.ts`
 * turns a bag into a report an agent can act on.
 *
 * **The overrides are a question, not an answer.** Nothing here is a permanent user setting —
 * it is a scratchpad that can be left in any state, reset in one tap, and is off by default
 * behind `settings.featureDesignLab`. Its real output is the exported text file.
 *
 * **Not to be confused with lib/cardLayout.ts**, which is also a per-surface presentation
 * setting. That one is a finished feature a real user chooses between; this one is a
 * workbench for deciding what the app should look like in the first place.
 *
 * Connections:
 *   Imports → constants/theme (the geometry defaults these knobs start from — pure constants,
 *             no store/DB/notification reachability), constants/colors (TYPE ONLY)
 *   Used by → lib/designLabExport.ts, lib/useAppTheme.ts, app/design-lab.tsx,
 *             components/DesignLabBench.tsx, store/useSettingsStore.ts (sanitize on read),
 *             components/Surface.tsx, components/FormControls.tsx, components/PadRow.tsx,
 *             lib/__tests__/designLab.test.ts
 *   Data    → none. Pure functions over values the caller already has; reads no store,
 *             writes nothing, schedules nothing.
 *
 * Edit notes:
 *   - **This module must stay side-effect free**, for the same reason lib/cardLayout.ts does:
 *     it is read inside render paths (useAppTheme, useScaledStyles, Surface) on every screen.
 *     It must never import a store, lib/db, lib/notifications or lib/reminders.
 *     `lib/__tests__/designLab.test.ts` asserts the import graph stays clean.
 *   - **Everything is sanitized on read, never trusted.** `sanitizeLabOverrides()` is the only
 *     way a stored bag enters the app. An unknown key, a malformed hex, a NaN or an
 *     out-of-range number is dropped rather than propagated — a hand-edited backup must not be
 *     able to blank a screen or make the app untappable.
 *   - **Numeric knobs clamp, they don't validate-and-reject.** A clamp keeps the lab usable
 *     while it is being dragged; a rejection would make a slider feel broken at its ends.
 *     `MIN_TAP_TARGET_FLOOR` is the one hard floor and exists so the lab can't produce an
 *     app the maintainer cannot tap their way out of.
 *   - Adding a knob: add it to the matching `*_KNOBS` array with its provenance string, and
 *     (for a shape knob) to `ShapeOverrides` + `DEFAULT_SHAPE`. The screen and the export both
 *     enumerate from here, so nothing else needs to change. Provenance is not decoration — it
 *     is what the exported report tells the agent to go and edit.
 */
import { BORDER_WIDTH, MIN_TAP_TARGET, PAD_ROW_HEIGHT } from '@/constants/theme';
import type { ThemePalette } from '@/constants/colors';

/** Bump when the shape of a stored bag changes incompatibly. Written into the export block. */
export const DESIGN_LAB_VERSION = 1;

/** The lowest `minTapTarget` the lab will accept — WCAG's floor, and the app's own token. */
export const MIN_TAP_TARGET_FLOOR = 44;

// ── Colour knobs ─────────────────────────────────────────────────────────────

/** The palette groups, in the order the lab draws them (mirrors constants/colors.ts's own). */
export type ColorGroup =
  | 'surfaces'
  | 'text'
  | 'borders'
  | 'accent'
  | 'semantic'
  | 'hint'
  | 'screens'
  | 'identity';

/** A palette token the lab exposes, with where it lives and what it visibly moves. */
export type ColorKnob = {
  /** The `ThemePalette` key. Also the id used in storage and in the export. */
  id: keyof ThemePalette;
  group: ColorGroup;
  /** Where the real value lives — what the agent edits when acting on the report. */
  source: string;
  /** What visibly changes. Written into the report's "used by" line. */
  usedBy: string;
};

/**
 * Every palette token worth turning a knob on.
 *
 * Deliberately NOT the whole `ThemePalette`: the priority ramp and the category palette are
 * declared but unwired (no live feature reads them — see constants/colors.ts), so putting them
 * here would let the maintainer spend time tuning colours that change nothing on screen. Add
 * them the day something draws them.
 *
 * `accentInk` is also absent on purpose — `withAccentInk()` re-derives it from `accent` by
 * contrast on every build, so an override would be silently discarded one line later.
 */
export const COLOR_KNOBS: readonly ColorKnob[] = [
  // Surfaces
  { id: 'bg', group: 'surfaces', source: 'constants/colors.ts bg', usedBy: 'page background behind every card' },
  { id: 'surface', group: 'surfaces', source: 'constants/colors.ts surface', usedBy: 'the card face itself (white in light, navy in dark)' },
  { id: 'surfaceMuted', group: 'surfaces', source: 'constants/colors.ts surfaceMuted', usedBy: 'sunken rows in Settings, pressed card state' },
  { id: 'surfaceInset', group: 'surfaces', source: 'constants/colors.ts surfaceInset', usedBy: 'inset wells (the deepest surface)' },
  { id: 'rule', group: 'surfaces', source: 'constants/colors.ts rule', usedBy: 'decorative notepad hairlines only — never a control edge' },
  // Text
  { id: 'text', group: 'text', source: 'constants/colors.ts text', usedBy: 'every title and body line' },
  { id: 'textMuted', group: 'text', source: 'constants/colors.ts textMuted', usedBy: 'meta lines, hints, secondary values' },
  { id: 'textInverse', group: 'text', source: 'constants/colors.ts textInverse', usedBy: 'text on a coloured fill' },
  // Borders
  { id: 'border', group: 'borders', source: 'constants/colors.ts border', usedBy: 'neutral card/field edges (Home and Settings wear this)' },
  { id: 'borderStrong', group: 'borders', source: 'constants/colors.ts borderStrong', usedBy: 'a focused input outline' },
  // Accent
  { id: 'accent', group: 'accent', source: 'constants/colors.ts accent', usedBy: 'primary buttons, active tab pill, links, focus ring' },
  { id: 'accentSoft', group: 'accent', source: 'constants/colors.ts accentSoft', usedBy: 'accent-tinted row washes and chips' },
  // Semantic
  { id: 'good', group: 'semantic', source: 'constants/colors.ts good', usedBy: 'success text, met habits' },
  { id: 'goodSoft', group: 'semantic', source: 'constants/colors.ts goodSoft', usedBy: 'success backgrounds' },
  { id: 'bad', group: 'semantic', source: 'constants/colors.ts bad', usedBy: 'destructive actions, error text' },
  { id: 'badSoft', group: 'semantic', source: 'constants/colors.ts badSoft', usedBy: 'error backgrounds' },
  { id: 'warn', group: 'semantic', source: 'constants/colors.ts warn', usedBy: 'warning text' },
  { id: 'warnSoft', group: 'semantic', source: 'constants/colors.ts warnSoft', usedBy: 'warning backgrounds' },
  // Hint card
  { id: 'hintBg', group: 'hint', source: 'constants/colors.ts hintBg', usedBy: 'the ⓘ HintCard fill' },
  { id: 'hintBorder', group: 'hint', source: 'constants/colors.ts hintBorder', usedBy: 'the ⓘ HintCard edge' },
  { id: 'hintAccent', group: 'hint', source: 'constants/colors.ts hintAccent', usedBy: 'the ⓘ HintCard accent bar' },
  // Per-screen hues (lib/screenColor.ts maps a screen to one of these)
  { id: 'featPlan', group: 'screens', source: 'constants/colors.ts featPlan', usedBy: 'To-do screen border hue (blue)' },
  { id: 'featHabit', group: 'screens', source: 'constants/colors.ts featHabit', usedBy: 'Habits screen border hue (sky)' },
  { id: 'featHealth', group: 'screens', source: 'constants/colors.ts featHealth', usedBy: 'Health screen border hue (teal)' },
  { id: 'featShop', group: 'screens', source: 'constants/colors.ts featShop', usedBy: 'Shopping screen border hue (green)' },
  { id: 'featNote', group: 'screens', source: 'constants/colors.ts featNote', usedBy: 'Notes screen border hue (yellow)' },
  { id: 'featMeal', group: 'screens', source: 'constants/colors.ts featMeal', usedBy: 'Food screen border hue (orange)' },
  { id: 'featScan', group: 'screens', source: 'constants/colors.ts featScan', usedBy: 'Scan screen border hue (violet)' },
  { id: 'featTask', group: 'screens', source: 'constants/colors.ts featTask', usedBy: 'Goals screen border hue (indigo)' },
  { id: 'featBudget', group: 'screens', source: 'constants/colors.ts featBudget', usedBy: 'budget surfaces' },
  // Card identity hues (lib/domainColor.ts — the gradient badge and its ink)
  { id: 'cardPlan', group: 'identity', source: 'constants/colors.ts cardPlan', usedBy: 'to-do card badge gradient' },
  { id: 'cardHabit', group: 'identity', source: 'constants/colors.ts cardHabit', usedBy: 'habit card badge gradient' },
  { id: 'cardHealth', group: 'identity', source: 'constants/colors.ts cardHealth', usedBy: 'health card badge gradient' },
  { id: 'cardShop', group: 'identity', source: 'constants/colors.ts cardShop', usedBy: 'shopping card badge gradient' },
] as const;

// ── Shape knobs ──────────────────────────────────────────────────────────────

/**
 * The geometry overrides. Three of them are SCALES applied to whatever a component already
 * asked for (so one number moves every radius/pad/edge in the app at once), and the rest are
 * absolute values replacing a specific token.
 *
 * Scales exist because the alternative — a knob per `Spacing.*` and `Radius.*` rung — would be
 * two dozen sliders answering a question ("is this too round / too tight?") that is really one.
 */
export type ShapeOverrides = {
  /** Multiplies every `borderRadius*` a component sets. */
  radiusScale: number;
  /** Multiplies every padding/margin/gap a component sets. */
  spacingScale: number;
  /** Multiplies every `borderWidth*` a component sets, and the three rungs below. */
  borderScale: number;
  /** Absolute width of a CARD edge (`BORDER_WIDTH.card`). */
  borderCardWidth: number;
  /** Absolute width of a FIELD edge (`BORDER_WIDTH.field`). */
  borderFieldWidth: number;
  /** Absolute width of a BUTTON edge (`BORDER_WIDTH.button`). */
  borderButtonWidth: number;
  /** How strongly a border's deep→light gradient reads. 0 = flat, 1 = as shipped. */
  borderRampStrength: number;
  /** Absolute `PAD_ROW_HEIGHT` — one line of a pad. */
  rowHeight: number;
  /** Absolute `MIN_TAP_TARGET`. Floored at 44; see MIN_TAP_TARGET_FLOOR. */
  minTapTarget: number;
  /** Multiplies every `fontSize`/`lineHeight`, on top of the user's own text-size setting. */
  fontScale: number;
  /** Card shadow depth: 0 none → 3 floating. */
  cardElevation: number;
};

export const DEFAULT_SHAPE: ShapeOverrides = {
  radiusScale: 1,
  spacingScale: 1,
  borderScale: 1,
  borderCardWidth: BORDER_WIDTH.card,
  borderFieldWidth: BORDER_WIDTH.field,
  borderButtonWidth: BORDER_WIDTH.button,
  borderRampStrength: 1,
  rowHeight: PAD_ROW_HEIGHT,
  minTapTarget: MIN_TAP_TARGET,
  fontScale: 1,
  cardElevation: 2,
};

/** A numeric knob's declared range, step and provenance. */
export type ShapeKnob = {
  id: keyof ShapeOverrides;
  min: number;
  max: number;
  step: number;
  source: string;
  usedBy: string;
};

export const SHAPE_KNOBS: readonly ShapeKnob[] = [
  { id: 'radiusScale', min: 0, max: 3, step: 0.05, source: 'Radius.* (constants/theme.ts)', usedBy: 'every rounded corner in the app' },
  { id: 'spacingScale', min: 0.4, max: 2.5, step: 0.05, source: 'Spacing.* (constants/theme.ts)', usedBy: 'every padding, margin and gap' },
  { id: 'borderScale', min: 0, max: 4, step: 0.05, source: 'BORDER_WIDTH.* (constants/theme.ts)', usedBy: 'the thickness of every edge' },
  { id: 'borderCardWidth', min: 0, max: 6, step: 0.25, source: 'BORDER_WIDTH.card (constants/theme.ts)', usedBy: 'the outline of a card' },
  { id: 'borderFieldWidth', min: 0, max: 6, step: 0.25, source: 'BORDER_WIDTH.field (constants/theme.ts)', usedBy: 'the outline of an input and of a boxed row' },
  { id: 'borderButtonWidth', min: 0, max: 6, step: 0.25, source: 'BORDER_WIDTH.button (constants/theme.ts)', usedBy: 'the outline of a button' },
  { id: 'borderRampStrength', min: 0, max: 2, step: 0.05, source: 'computeBorderRamp (constants/theme.ts)', usedBy: 'how much an edge fades deep→light down its own length' },
  { id: 'rowHeight', min: 28, max: 88, step: 1, source: 'PAD_ROW_HEIGHT (constants/theme.ts)', usedBy: 'one line of a list' },
  { id: 'minTapTarget', min: MIN_TAP_TARGET_FLOOR, max: 88, step: 1, source: 'MIN_TAP_TARGET (constants/theme.ts)', usedBy: 'the smallest a tappable control may be' },
  { id: 'fontScale', min: 0.7, max: 1.6, step: 0.02, source: 'getFontSize (constants/theme.ts)', usedBy: 'every piece of text, on top of the Size setting' },
  { id: 'cardElevation', min: 0, max: 3, step: 1, source: 'getElevation (constants/theme.ts)', usedBy: 'how far a card lifts off the page' },
] as const;

// ── Control knobs ────────────────────────────────────────────────────────────

/**
 * A control SLOT is a job ("pick one of a few things"); a VARIANT is a shape that does the job.
 * The lab lets a slot be reassigned so the maintainer can see the same real screen drawn with
 * a segmented control where a switch is today, rather than imagining it.
 */
export type ControlSlot = 'boolean' | 'choice' | 'number' | 'time' | 'rowShape' | 'check' | 'button';

export type ControlKnob = {
  id: ControlSlot;
  variants: readonly string[];
  fallback: string;
  source: string;
  usedBy: string;
};

export const CONTROL_KNOBS: readonly ControlKnob[] = [
  {
    id: 'boolean', variants: ['switch', 'segmented', 'checkbox', 'pill'], fallback: 'switch',
    source: 'components/FormControls.tsx Switch',
    usedBy: 'every on/off row in Settings and every editor',
  },
  {
    id: 'choice', variants: ['segmented', 'pills', 'sheet', 'dropdown'], fallback: 'segmented',
    source: 'components/FormControls.tsx SegmentedControl',
    usedBy: 'appearance, text size, layout and every pick-one row',
  },
  {
    id: 'number', variants: ['stepper', 'slider', 'segments', 'text'], fallback: 'stepper',
    source: 'components/Stepper.tsx',
    usedBy: 'energy, quantity, daily goal, capacity',
  },
  {
    id: 'time', variants: ['boxes', 'text', 'chips', 'stepper15'], fallback: 'boxes',
    source: 'components/TimeBoxInput.tsx',
    usedBy: 'reminder times, medicine trays, task start/finish',
  },
  {
    id: 'rowShape', variants: ['boxed', 'ruled', 'flush'], fallback: 'boxed',
    source: 'components/PadSheet.tsx',
    usedBy: 'how one row is separated from the next',
  },
  {
    id: 'check', variants: ['circle', 'square', 'tick', 'none'], fallback: 'circle',
    source: 'components/PadRow.tsx',
    usedBy: "a row's completion control",
  },
  {
    id: 'button', variants: ['filled', 'ghost', 'outline', 'key'], fallback: 'key',
    source: 'components/Button.tsx',
    usedBy: 'the primary action on every screen',
  },
] as const;

// ── Slot knobs ───────────────────────────────────────────────────────────────

/**
 * The row anatomy from components/PadRow.tsx, exposed as assignable positions:
 *
 *     [leading?]  title            [right value] [⋯ action] [○ check]
 *                 ⟨one meta line⟩
 *
 * Plus three free bench slots, which are the "empty fields I can assign options to" — a
 * position with nothing in it yet, where any control kind can be dropped to see how it sits.
 */
export type SlotId =
  | 'row.leading'
  | 'row.meta'
  | 'row.right'
  | 'row.action'
  | 'bench.a'
  | 'bench.b'
  | 'bench.c';

export type SlotKnob = {
  id: SlotId;
  options: readonly string[];
  fallback: string;
  source: string;
  usedBy: string;
};

/** What a row position can carry. `none` is always available and always means "draw nothing". */
const ROW_CONTENT = ['none', 'badge', 'personChip', 'goalDot', 'tags', 'time', 'count', 'price', 'energy', 'repeat'] as const;

/** What an empty bench slot can be filled with — one of each control kind the app owns. */
const BENCH_CONTENT = ['none', 'button', 'toggle', 'tabs', 'pills', 'stepper', 'slider', 'time', 'textbox', 'chips', 'checkbox'] as const;

export const SLOT_KNOBS: readonly SlotKnob[] = [
  { id: 'row.leading', options: ROW_CONTENT, fallback: 'none', source: 'components/PadRow.tsx leading', usedBy: "the space before a row's title" },
  { id: 'row.meta', options: ROW_CONTENT, fallback: 'tags', source: 'components/PadRow.tsx meta line', usedBy: "the one line under a row's title" },
  { id: 'row.right', options: ROW_CONTENT, fallback: 'time', source: 'components/PadRow.tsx rightValue', usedBy: "a row's single right-hand value" },
  { id: 'row.action', options: ['none', 'more', 'delete', 'send'], fallback: 'more', source: 'components/PadRow.tsx action', usedBy: "a row's one action button" },
  { id: 'bench.a', options: BENCH_CONTENT, fallback: 'none', source: '(empty slot)', usedBy: 'nothing yet — an empty field to try a control in' },
  { id: 'bench.b', options: BENCH_CONTENT, fallback: 'none', source: '(empty slot)', usedBy: 'nothing yet — an empty field to try a control in' },
  { id: 'bench.c', options: BENCH_CONTENT, fallback: 'none', source: '(empty slot)', usedBy: 'nothing yet — an empty field to try a control in' },
] as const;

// ── The override bag ─────────────────────────────────────────────────────────

/** Per-mode colour overrides. Light and dark are edited separately — one palette each. */
export type ColorOverrides = Partial<Record<keyof ThemePalette, string>>;

export type LabOverrides = {
  colors: { light: ColorOverrides; dark: ColorOverrides };
  shape: Partial<ShapeOverrides>;
  controls: Partial<Record<ControlSlot, string>>;
  slots: Partial<Record<SlotId, string>>;
  /** The maintainer's own words about what they were trying to fix. Carried into the export. */
  note: string;
};

export const EMPTY_OVERRIDES: LabOverrides = {
  colors: { light: {}, dark: {} },
  shape: {},
  controls: {},
  slots: {},
  note: '',
};

// ── Sanitizing ───────────────────────────────────────────────────────────────

const COLOR_IDS = new Set<string>(COLOR_KNOBS.map((k) => k.id as string));
const SHAPE_BY_ID = new Map(SHAPE_KNOBS.map((k) => [k.id as string, k]));
const CONTROL_BY_ID = new Map(CONTROL_KNOBS.map((k) => [k.id as string, k]));
const SLOT_BY_ID = new Map(SLOT_KNOBS.map((k) => [k.id as string, k]));

/** `#rgb` and `#rrggbb`, the two forms the palette and a hand-typed value both use. */
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** True for a string this app is willing to hand to `backgroundColor`. */
export function isValidHex(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

/** `#abc` → `#aabbcc`, lowercased. Anything already long is just normalised. */
export function normalizeHex(value: string): string {
  const h = value.trim().toLowerCase();
  if (h.length === 4) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  return h;
}

/** Clamp `n` into a knob's declared range, snapped to nothing — the step is a UI affordance. */
export function clampShape(id: keyof ShapeOverrides, n: number): number {
  const knob = SHAPE_BY_ID.get(id as string);
  if (!knob) return n;
  if (!Number.isFinite(n)) return DEFAULT_SHAPE[id];
  return Math.min(knob.max, Math.max(knob.min, n));
}

function sanitizeColorMap(raw: unknown): ColorOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ColorOverrides = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!COLOR_IDS.has(key)) continue;
    if (!isValidHex(value)) continue;
    out[key as keyof ThemePalette] = normalizeHex(value);
  }
  return out;
}

/**
 * The only way a stored bag enters the app.
 *
 * Every unknown key, malformed hex, non-finite number and unknown variant id is DROPPED, not
 * defaulted-in-place and not thrown on — the result is always a usable bag, possibly an empty
 * one. That is the same contract `sanitizeCardLayouts` has, and it matters more here: this bag
 * can change the colour of text on its own background.
 */
export function sanitizeLabOverrides(raw: unknown): LabOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY_OVERRIDES;
  const r = raw as Record<string, unknown>;
  const colorsRaw = (r.colors && typeof r.colors === 'object' ? r.colors : {}) as Record<string, unknown>;

  const shape: Partial<ShapeOverrides> = {};
  if (r.shape && typeof r.shape === 'object' && !Array.isArray(r.shape)) {
    for (const [key, value] of Object.entries(r.shape as Record<string, unknown>)) {
      if (!SHAPE_BY_ID.has(key)) continue;
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      shape[key as keyof ShapeOverrides] = clampShape(key as keyof ShapeOverrides, value);
    }
  }

  const controls: Partial<Record<ControlSlot, string>> = {};
  if (r.controls && typeof r.controls === 'object' && !Array.isArray(r.controls)) {
    for (const [key, value] of Object.entries(r.controls as Record<string, unknown>)) {
      const knob = CONTROL_BY_ID.get(key);
      if (!knob || typeof value !== 'string' || !knob.variants.includes(value)) continue;
      controls[key as ControlSlot] = value;
    }
  }

  const slots: Partial<Record<SlotId, string>> = {};
  if (r.slots && typeof r.slots === 'object' && !Array.isArray(r.slots)) {
    for (const [key, value] of Object.entries(r.slots as Record<string, unknown>)) {
      const knob = SLOT_BY_ID.get(key);
      if (!knob || typeof value !== 'string' || !knob.options.includes(value)) continue;
      slots[key as SlotId] = value;
    }
  }

  return {
    colors: {
      light: sanitizeColorMap(colorsRaw.light),
      dark: sanitizeColorMap(colorsRaw.dark),
    },
    shape,
    controls,
    slots,
    note: typeof r.note === 'string' ? r.note.slice(0, 2000) : '',
  };
}

// ── Resolving ────────────────────────────────────────────────────────────────

/** True when nothing has been changed — the fast path every render check uses. */
export function isEmptyOverrides(o: LabOverrides): boolean {
  return (
    Object.keys(o.colors.light).length === 0 &&
    Object.keys(o.colors.dark).length === 0 &&
    Object.keys(o.shape).length === 0 &&
    Object.keys(o.controls).length === 0 &&
    Object.keys(o.slots).length === 0
  );
}

/** The palette with this mode's colour overrides laid on top. Returns `palette` unchanged when there are none, so consumers keep referential stability. */
export function applyColorOverrides(palette: ThemePalette, o: LabOverrides, isDark: boolean): ThemePalette {
  const patch = isDark ? o.colors.dark : o.colors.light;
  if (Object.keys(patch).length === 0) return palette;
  return { ...palette, ...patch };
}

/** Full geometry, defaults filled in. */
export function resolveShape(o: LabOverrides): ShapeOverrides {
  return { ...DEFAULT_SHAPE, ...o.shape };
}

/** True when the geometry is exactly as shipped — lets `scaleStyles` skip its whole pass. */
export function isDefaultShape(shape: ShapeOverrides): boolean {
  return (Object.keys(DEFAULT_SHAPE) as (keyof ShapeOverrides)[]).every((k) => shape[k] === DEFAULT_SHAPE[k]);
}

/** The variant a control slot resolves to, falling back to what the app ships with. */
export function resolveControl(slot: ControlSlot, o: LabOverrides): string {
  return o.controls[slot] ?? CONTROL_BY_ID.get(slot)?.fallback ?? 'switch';
}

/** What a slot position resolves to, falling back to what the app ships with. */
export function resolveSlot(slot: SlotId, o: LabOverrides): string {
  return o.slots[slot] ?? SLOT_BY_ID.get(slot)?.fallback ?? 'none';
}

// ── Describing (the export's data half) ──────────────────────────────────────

/** One changed knob, flattened for the report. `before`/`after` are already display strings. */
export type OverrideChange = {
  group: 'COLOUR' | 'SHAPE' | 'CONTROLS' | 'SLOTS';
  id: string;
  before: string;
  after: string;
  source: string;
  usedBy: string;
};

/**
 * Every knob that differs from what the app ships, as flat rows.
 *
 * Colour needs the live palette passed in because "before" is the real current value, which
 * depends on the mode being edited — the report is worthless if it says a token changed but
 * not what it changed FROM.
 */
export function describeOverrides(o: LabOverrides, palette: ThemePalette, isDark: boolean): OverrideChange[] {
  const out: OverrideChange[] = [];

  const patch = isDark ? o.colors.dark : o.colors.light;
  for (const knob of COLOR_KNOBS) {
    const after = patch[knob.id];
    if (!after) continue;
    const before = String(palette[knob.id] ?? '');
    if (before.toLowerCase() === after.toLowerCase()) continue;
    out.push({ group: 'COLOUR', id: knob.id as string, before, after, source: knob.source, usedBy: knob.usedBy });
  }

  for (const knob of SHAPE_KNOBS) {
    const after = o.shape[knob.id];
    if (after === undefined) continue;
    const before = DEFAULT_SHAPE[knob.id];
    if (after === before) continue;
    out.push({ group: 'SHAPE', id: knob.id as string, before: String(before), after: String(after), source: knob.source, usedBy: knob.usedBy });
  }

  for (const knob of CONTROL_KNOBS) {
    const after = o.controls[knob.id];
    if (!after || after === knob.fallback) continue;
    out.push({ group: 'CONTROLS', id: knob.id as string, before: knob.fallback, after, source: knob.source, usedBy: knob.usedBy });
  }

  for (const knob of SLOT_KNOBS) {
    const after = o.slots[knob.id];
    if (!after || after === knob.fallback) continue;
    out.push({ group: 'SLOTS', id: knob.id as string, before: knob.fallback, after, source: knob.source, usedBy: knob.usedBy });
  }

  return out;
}
