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
 * **Five registries, and the fifth is a different shape from the other four.** `COLOR_KNOBS`,
 * `SHAPE_KNOBS`, `CONTROL_KNOBS` and `SLOT_KNOBS` are all "one token, one new value" — they
 * answer "is the accent too dark", "are the corners too round". `CARD_KNOBS` (2026-08-07)
 * answers the question those cannot, which is the one the maintainer actually keeps asking:
 * *I want this card to look like this.* A card is a LIST of parts that can be added to, taken
 * from, moved and restyled, so it is stored as a composition rather than as a value, and the
 * report describes it as a diff rather than as a before→after pair.
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
 *   - **`CARD_KNOBS.defaultParts` must stay faithful to the real components.** It is doing two
 *     jobs at once: it is what the bench OPENS at (so the maintainer sees their card, not an
 *     empty box) and it is what `describeCards` measures against (so the report can say
 *     "added a slider", not merely "here is a list of parts"). A card that gains or loses a
 *     part in the real app has to gain or lose it here too, or the very next export lies.
 *   - **A part's `id` is stable and load-bearing.** It is the only thing that tells `moved`
 *     apart from `removed` + `added`. Renaming one in `defaultParts` silently turns every
 *     stored composition's edit to that part into a delete-and-recreate in the report.
 *   - The kind→slot table (`SLOTS_FOR_KIND`) is the ONLY compatibility rule, and it is
 *     deliberately not per card: there is no card that couldn't sensibly gain a button, but
 *     there is no card where a slider fits on the one-line meta row either.
 */
import { BORDER_WIDTH, MIN_TAP_TARGET, PAD_ROW_HEIGHT } from '@/constants/theme';
import type { ThemePalette } from '@/constants/colors';

/**
 * Bump when the shape of a stored bag changes incompatibly. Written into the export block.
 *
 * 2 (2026-08-07) added `cards`. A v1 bag stays valid and loads unchanged — the field is simply
 * absent and sanitizes to `{}` — so this is a widening, not a break. It is still a bump because
 * an agent reading the exported JSON has to know whether a missing `cards` means "no card was
 * touched" or "this file predates cards".
 */
export const DESIGN_LAB_VERSION = 2;

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
 * These are APP-WIDE: they describe the shared row every list draws through, not one card.
 * Per-card composition is `CARD_KNOBS` and lives on the Card tab.
 *
 * **`bench.a`/`bench.b`/`bench.c` were retired on 2026-08-07.** They were three empty
 * positions any control kind could be dropped into — a stand-in for "let me add something",
 * built because there was no way to add a part to anything. The card editor does that
 * properly now, on a real card rather than in a nameless slot, so keeping them would leave
 * two ways to answer the same question and one of them attached to nothing. A stored bag
 * naming them is simply dropped by the sanitizer, which is what it already does with any
 * unknown key.
 */
export type SlotId =
  | 'row.leading'
  | 'row.meta'
  | 'row.right'
  | 'row.action';

export type SlotKnob = {
  id: SlotId;
  options: readonly string[];
  fallback: string;
  source: string;
  usedBy: string;
};

/** What a row position can carry. `none` is always available and always means "draw nothing". */
const ROW_CONTENT = ['none', 'badge', 'personChip', 'goalDot', 'tags', 'time', 'count', 'price', 'energy', 'repeat'] as const;

export const SLOT_KNOBS: readonly SlotKnob[] = [
  { id: 'row.leading', options: ROW_CONTENT, fallback: 'none', source: 'components/PadRow.tsx leading', usedBy: "the space before a row's title" },
  { id: 'row.meta', options: ROW_CONTENT, fallback: 'tags', source: 'components/PadRow.tsx meta line', usedBy: "the one line under a row's title" },
  { id: 'row.right', options: ROW_CONTENT, fallback: 'time', source: 'components/PadRow.tsx rightValue', usedBy: "a row's single right-hand value" },
  { id: 'row.action', options: ['none', 'more', 'delete', 'send'], fallback: 'more', source: 'components/PadRow.tsx action', usedBy: "a row's one action button" },
] as const;

// ── Card knobs: the parts a card is made of ──────────────────────────────────

/**
 * The cards the lab can open and edit.
 *
 * Deliberately the cards a person points at ("the Habits card"), not the components they are
 * built from — the maintainer's question is about a thing on a screen, and answering it in
 * terms of `PadRow` would already be an implementation answer to a design question.
 */
export type CardId =
  | 'generic'
  | 'todo'
  | 'habit'
  | 'shopping'
  | 'medicine'
  | 'note'
  | 'dish'
  | 'homeToDo'
  | 'homeHabits'
  | 'homeShopping'
  | 'homeNotes';

/**
 * Where a part sits. The middle eight mirror components/PadRow.tsx's real anatomy —
 *
 *     [leading?]  title            [right value] [⋯ action] [○ check]
 *                 ⟨one meta line⟩
 *
 * — with `trailing` being PadRow's own "replace the check with my control" slot. `header` is
 * the card's own heading above its rows, and `body`/`footer` are the rest of the card, which
 * is where anything that isn't part of a row goes.
 */
export type PartSlot =
  | 'header'
  | 'leading'
  | 'title'
  | 'meta'
  | 'right'
  | 'action'
  | 'check'
  | 'trailing'
  | 'body'
  | 'footer';

/** Draw order. The lab sorts a card's parts by this, so a reorder within a slot is the only
 *  thing the maintainer's own ordering decides. */
export const PART_SLOT_ORDER: readonly PartSlot[] = [
  'header', 'leading', 'title', 'meta', 'right', 'action', 'check', 'trailing', 'body', 'footer',
];

/** What a part IS. One of these three families, and the families decide where it may sit. */
export type PartKind =
  // Text-ish — something to read.
  | 'text' | 'value' | 'count' | 'price' | 'time'
  // Controls — something to use.
  | 'button' | 'slider' | 'toggle' | 'checkbox' | 'stepper' | 'segmented' | 'chips'
  | 'field' | 'timeField'
  // Ornament — something that marks or measures.
  | 'icon' | 'badge' | 'chip' | 'personChip' | 'dot' | 'progress' | 'divider';

export const PART_KINDS: readonly PartKind[] = [
  'text', 'value', 'count', 'price', 'time',
  'button', 'slider', 'toggle', 'checkbox', 'stepper', 'segmented', 'chips', 'field', 'timeField',
  'icon', 'badge', 'chip', 'personChip', 'dot', 'progress', 'divider',
];

/**
 * Which slots each kind may occupy.
 *
 * **This is the only compatibility rule, and it is per KIND, not per card.** An earlier cut of
 * this model gave every card its own allow-list of kinds, which turned out to encode nothing
 * real — there is no card that couldn't sensibly gain a button. What IS real is that a slider
 * cannot go on a one-line meta row and a divider cannot be a right-hand value, and that holds
 * on every card at once.
 */
export const SLOTS_FOR_KIND: Record<PartKind, readonly PartSlot[]> = {
  // Text reads anywhere text can go. `right` is a string column (PadRow's `rightValue`), so
  // only these kinds may take it.
  text: ['header', 'leading', 'title', 'meta', 'right', 'body', 'footer'],
  value: ['leading', 'meta', 'right', 'body', 'footer'],
  count: ['leading', 'meta', 'right', 'body', 'footer'],
  price: ['leading', 'meta', 'right', 'body', 'footer'],
  time: ['leading', 'meta', 'right', 'body', 'footer'],
  // A control needs room, so it takes the trailing cluster or the card's own space — never
  // the title line or the single meta line.
  button: ['trailing', 'body', 'footer'],
  slider: ['body', 'footer'],
  toggle: ['trailing', 'body', 'footer'],
  checkbox: ['leading', 'check', 'trailing', 'body', 'footer'],
  stepper: ['trailing', 'body', 'footer'],
  segmented: ['body', 'footer'],
  chips: ['meta', 'body', 'footer'],
  field: ['title', 'body', 'footer'],
  timeField: ['right', 'body', 'footer'],
  // Ornament fits almost anywhere, being small.
  icon: ['leading', 'meta', 'action', 'trailing', 'body', 'footer'],
  badge: ['leading', 'meta', 'trailing', 'body', 'footer'],
  chip: ['meta', 'body', 'footer'],
  personChip: ['leading', 'meta', 'body', 'footer'],
  dot: ['leading', 'meta', 'body', 'footer'],
  progress: ['body', 'footer'],
  divider: ['body', 'footer'],
};

export const PART_SIZES = ['xs', 'sm', 'md', 'lg'] as const;
export type PartSize = (typeof PART_SIZES)[number];

export const PART_WEIGHTS = ['regular', 'semibold', 'bold'] as const;
export type PartWeight = (typeof PART_WEIGHTS)[number];

export type CardPart = {
  /** Unique within its card, and STABLE — it is what tells "moved" apart from "removed+added". */
  id: string;
  kind: PartKind;
  slot: PartSlot;
  /** The maintainer's own words. `''` means "use the bench's sample text for this kind". */
  label: string;
  /** A `ThemePalette` token id, a hex, or `''` for "whatever it inherits". */
  color: string;
  size: PartSize;
  weight: PartWeight;
};

/** One card's whole composition. Seeded from the registry the first time it is touched. */
export type CardSpec = {
  /**
   * The card AS THE MAINTAINER WANTS IT — authoritative, not a diff.
   *
   * A diff-plus-removals shape was the alternative and is worse: the maintainer drags ONE
   * list, so one list is what should be stored, and the export computes the difference against
   * the registry instead (`describeCards`). A card missing from `cards` has never been opened.
   */
  parts: CardPart[];
  /** What they were after on this specific card. Carried into the report beside its rows. */
  note: string;
};

/** Nothing here may grow without bound — a stored bag is JSON in one settings column. */
export const MAX_PARTS_PER_CARD = 24;
export const MAX_PART_LABEL = 60;
export const MAX_CARD_NOTE = 500;

export type CardKnob = {
  id: CardId;
  /** The real file(s) that own this card — what the report tells an agent to go and edit. */
  source: string;
  /** What the maintainer would recognise it as. Written into the report's "used by" line. */
  usedBy: string;
  /** A lib/domainColor `Domain`, for the specimen's badge hue. A plain string so this module
   *  keeps importing nothing but constants/theme. */
  domain: string;
  /** A lib/screenColor `ScreenKey`, for the specimen's border hue. Same reasoning. */
  screen: string;
  /** The card as it is SHIPPED — what the bench opens at, and what the export diffs against. */
  defaultParts: readonly CardPart[];
};

/** Shorthand for the registry below; every default part is unlabelled and uncoloured. */
function part(id: string, kind: PartKind, slot: PartSlot, size: PartSize = 'sm', weight: PartWeight = 'regular'): CardPart {
  return { id, kind, slot, label: '', color: '', size, weight };
}

/**
 * Every card the lab can open, described by the parts it actually draws today.
 *
 * These lists are hand-written from the real components, and being faithful is the whole job:
 * they are what the bench opens at (so it shows the maintainer's card, not an empty box) AND
 * what `describeCards` measures a change against (so the report can say "added", not just
 * "here is a list"). If a card gains or loses a part in the real app, this is the second place
 * to change.
 */
export const CARD_KNOBS: readonly CardKnob[] = [
  {
    id: 'generic',
    source: 'components/{Surface,PadSheet,PadRow}.tsx',
    usedBy: 'the shared list card every surface is built from',
    domain: 'task', screen: 'plans',
    defaultParts: [
      part('header', 'text', 'header', 'md', 'semibold'),
      part('title', 'text', 'title', 'md', 'semibold'),
      part('meta', 'text', 'meta', 'xs'),
      part('right', 'time', 'right', 'sm'),
      part('action', 'icon', 'action'),
      part('check', 'checkbox', 'check'),
    ],
  },
  {
    id: 'todo',
    source: 'components/TaskCard.tsx, components/PlanTaskCard.tsx',
    usedBy: 'every task on the To-do tab and in the day timeline',
    domain: 'plan', screen: 'plans',
    defaultParts: [
      part('title', 'text', 'title', 'md', 'semibold'),
      part('person', 'personChip', 'meta'),
      part('tags', 'text', 'meta', 'xs'),
      part('goalDot', 'dot', 'meta'),
      part('time', 'time', 'right', 'sm'),
      part('action', 'icon', 'action'),
      part('check', 'checkbox', 'check'),
    ],
  },
  {
    id: 'habit',
    source: 'app/(tabs)/habits.tsx HabitCard',
    usedBy: 'every row on the Habits tab',
    domain: 'habit', screen: 'habits',
    defaultParts: [
      part('icon', 'icon', 'leading'),
      part('title', 'text', 'title', 'md', 'semibold'),
      part('energy', 'badge', 'meta'),
      part('count', 'count', 'right', 'sm'),
      part('action', 'icon', 'action'),
      // The −/+ pair, which replaces the check outright: a habit with a goal above 1 can't be
      // answered by one tap.
      part('adjust', 'stepper', 'trailing'),
    ],
  },
  {
    id: 'shopping',
    source: 'components/ShoppingRow.tsx, components/MonthlyTableRow.tsx',
    usedBy: 'every row of the weekly and monthly shopping lists',
    domain: 'shop', screen: 'shopping',
    defaultParts: [
      // Shopping is the one row still not converted to PadRow, so its check genuinely still
      // LEADS. Recorded as it is, not as the row rule says it should be.
      part('check', 'checkbox', 'leading'),
      part('quantity', 'value', 'leading', 'sm', 'semibold'),
      part('title', 'text', 'title', 'md', 'semibold'),
      part('stock', 'text', 'meta', 'xs'),
      part('price', 'price', 'right', 'sm'),
      part('remove', 'icon', 'action'),
    ],
  },
  {
    id: 'medicine',
    source: 'components/MedicineTrayCard.tsx',
    usedBy: "the Health tab's medicine trays and their dose rows",
    domain: 'health', screen: 'health',
    defaultParts: [
      part('status', 'text', 'header', 'sm', 'semibold'),
      // Tapping the circle logs the dose; tapping the name opens the editor.
      part('dose', 'checkbox', 'leading'),
      part('title', 'text', 'title', 'md', 'semibold'),
      part('amount', 'value', 'right', 'sm'),
      part('add', 'field', 'footer'),
    ],
  },
  {
    id: 'note',
    source: 'components/NoteRow.tsx',
    usedBy: 'every note on the Notes screen',
    domain: 'note', screen: 'notes',
    defaultParts: [
      // The title IS a field here — the row edits itself in place, which is what that screen
      // is for (PadRow's `titleInput`).
      part('title', 'field', 'title', 'md', 'semibold'),
      part('action', 'icon', 'action'),
      part('check', 'checkbox', 'check'),
      part('body', 'field', 'body', 'sm'),
    ],
  },
  {
    id: 'dish',
    source: 'components/FoodTab.tsx',
    usedBy: 'every dish in the Food screen',
    domain: 'meal', screen: 'food',
    defaultParts: [
      part('title', 'text', 'title', 'md', 'semibold'),
      part('difficulty', 'text', 'meta', 'xs'),
      part('add', 'icon', 'action'),
    ],
  },
  {
    id: 'homeToDo',
    source: 'components/PlanTaskCard.tsx (read-only on Home)',
    usedBy: "Home's day-view card",
    domain: 'plan', screen: 'index',
    defaultParts: [
      part('header', 'text', 'header', 'md', 'semibold'),
      part('title', 'text', 'title', 'md', 'semibold'),
      part('time', 'time', 'right', 'sm'),
      part('check', 'checkbox', 'check'),
      part('add', 'field', 'footer'),
    ],
  },
  {
    id: 'homeHabits',
    source: 'components/HomeHabitsCard.tsx',
    usedBy: "Home's habits card",
    domain: 'habit', screen: 'index',
    defaultParts: [
      part('header', 'text', 'header', 'md', 'semibold'),
      part('icon', 'icon', 'leading'),
      part('title', 'text', 'title', 'md', 'semibold'),
      part('count', 'count', 'right', 'sm'),
      part('adjust', 'stepper', 'trailing'),
      part('add', 'field', 'footer'),
    ],
  },
  {
    id: 'homeShopping',
    source: 'components/HomeShoppingCard.tsx',
    usedBy: "Home's shopping card",
    domain: 'shop', screen: 'index',
    defaultParts: [
      part('header', 'text', 'header', 'md', 'semibold'),
      part('quantity', 'value', 'leading', 'sm', 'semibold'),
      part('title', 'text', 'title', 'md', 'semibold'),
      part('price', 'price', 'right', 'sm'),
      part('check', 'checkbox', 'check'),
      part('add', 'field', 'footer'),
    ],
  },
  {
    id: 'homeNotes',
    source: 'components/HomeNotesCard.tsx',
    usedBy: "Home's notes card",
    domain: 'note', screen: 'index',
    defaultParts: [
      part('header', 'text', 'header', 'md', 'semibold'),
      part('title', 'text', 'title', 'md', 'semibold'),
      part('action', 'icon', 'action'),
      part('check', 'checkbox', 'check'),
      part('add', 'field', 'footer'),
    ],
  },
] as const;

// ── The override bag ─────────────────────────────────────────────────────────

/** Per-mode colour overrides. Light and dark are edited separately — one palette each. */
export type ColorOverrides = Partial<Record<keyof ThemePalette, string>>;

export type LabOverrides = {
  colors: { light: ColorOverrides; dark: ColorOverrides };
  shape: Partial<ShapeOverrides>;
  controls: Partial<Record<ControlSlot, string>>;
  slots: Partial<Record<SlotId, string>>;
  /** Per-card compositions. A card absent from here has never been opened. */
  cards: Partial<Record<CardId, CardSpec>>;
  /** The maintainer's own words about what they were trying to fix. Carried into the export. */
  note: string;
};

export const EMPTY_OVERRIDES: LabOverrides = {
  colors: { light: {}, dark: {} },
  shape: {},
  controls: {},
  slots: {},
  cards: {},
  note: '',
};

// ── Sanitizing ───────────────────────────────────────────────────────────────

const COLOR_IDS = new Set<string>(COLOR_KNOBS.map((k) => k.id as string));
const SHAPE_BY_ID = new Map(SHAPE_KNOBS.map((k) => [k.id as string, k]));
const CONTROL_BY_ID = new Map(CONTROL_KNOBS.map((k) => [k.id as string, k]));
const SLOT_BY_ID = new Map(SLOT_KNOBS.map((k) => [k.id as string, k]));
const CARD_BY_ID = new Map(CARD_KNOBS.map((k) => [k.id as string, k]));
const PART_KIND_SET = new Set<string>(PART_KINDS);

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
    cards: sanitizeCards(r.cards),
    note: typeof r.note === 'string' ? r.note.slice(0, 2000) : '',
  };
}

/** True for a colour a part may carry: a palette token id, or a hex the app can paint. */
function isPartColor(value: unknown): value is string {
  return typeof value === 'string' && (COLOR_IDS.has(value) || isValidHex(value));
}

/**
 * One part, or `null` if it is unusable.
 *
 * Illegal here means the pair, not just the pieces: a `slider` in the `right` column would
 * render nothing and then sit in the exported document as an instruction nobody can carry out.
 */
function sanitizePart(raw: unknown, usedIds: Set<string>): CardPart | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const id = typeof p.id === 'string' ? p.id.trim().slice(0, MAX_PART_LABEL) : '';
  if (!id || usedIds.has(id)) return null;
  const kind = typeof p.kind === 'string' && PART_KIND_SET.has(p.kind) ? (p.kind as PartKind) : null;
  if (!kind) return null;
  const slot = typeof p.slot === 'string' ? (p.slot as PartSlot) : null;
  if (!slot || !SLOTS_FOR_KIND[kind].includes(slot)) return null;
  usedIds.add(id);
  return {
    id,
    kind,
    slot,
    label: typeof p.label === 'string' ? p.label.slice(0, MAX_PART_LABEL) : '',
    color: isPartColor(p.color) ? (COLOR_IDS.has(p.color) ? p.color : normalizeHex(p.color)) : '',
    size: PART_SIZES.includes(p.size as PartSize) ? (p.size as PartSize) : 'sm',
    weight: PART_WEIGHTS.includes(p.weight as PartWeight) ? (p.weight as PartWeight) : 'regular',
  };
}

/**
 * The stored per-card compositions, with everything unrecognisable dropped.
 *
 * A card that survives sanitizing with NO parts is dropped whole rather than kept as an empty
 * composition: an empty card is indistinguishable from "delete every part", and silently
 * proposing a blank card is the one thing this feature must not do by accident. Emptying a
 * card on purpose is still possible — it just resolves back to the shipped one, which is also
 * the honest reading of "I removed everything".
 */
export function sanitizeCards(raw: unknown): Partial<Record<CardId, CardSpec>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Partial<Record<CardId, CardSpec>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!CARD_BY_ID.has(key)) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const spec = value as Record<string, unknown>;
    const rawParts = Array.isArray(spec.parts) ? spec.parts : [];
    const usedIds = new Set<string>();
    const parts: CardPart[] = [];
    for (const rawPart of rawParts) {
      if (parts.length >= MAX_PARTS_PER_CARD) break;
      const part = sanitizePart(rawPart, usedIds);
      if (part) parts.push(part);
    }
    if (parts.length === 0) continue;
    out[key as CardId] = {
      parts,
      note: typeof spec.note === 'string' ? spec.note.slice(0, MAX_CARD_NOTE) : '',
    };
  }
  return out;
}

// ── Resolving ────────────────────────────────────────────────────────────────

/** True when nothing has been changed — the fast path every render check uses. */
export function isEmptyOverrides(o: LabOverrides): boolean {
  return (
    Object.keys(o.colors.light).length === 0 &&
    Object.keys(o.colors.dark).length === 0 &&
    Object.keys(o.shape).length === 0 &&
    Object.keys(o.controls).length === 0 &&
    Object.keys(o.slots).length === 0 &&
    Object.keys(o.cards).length === 0
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

/** The registry entry for a card, or `undefined` for an id that isn't one. */
export function cardKnob(id: CardId): CardKnob | undefined {
  return CARD_BY_ID.get(id as string);
}

/**
 * A card's composition: the maintainer's if they have opened it, the shipped one otherwise.
 *
 * Always returns a fresh `parts` array so a caller can splice it without reaching back into
 * the registry — the defaults are `readonly` for exactly that reason, but a shared array is
 * still a footgun one `.push` away.
 */
export function resolveCardSpec(id: CardId, o: LabOverrides): CardSpec {
  const stored = o.cards[id];
  if (stored) return { parts: stored.parts.map((p) => ({ ...p })), note: stored.note };
  const knob = CARD_BY_ID.get(id as string);
  return { parts: (knob?.defaultParts ?? []).map((p) => ({ ...p })), note: '' };
}

/** A measured position on screen, in whatever coordinate space the caller measured in. */
export type SlotBox = { x: number; y: number; width: number; height: number };

/**
 * Which slot a finger at (x, y) is over, for a part of this kind — or `null`.
 *
 * Split out of the card editor so the half of drag-and-drop that CAN be checked headlessly is
 * checked: the gesture itself needs a device (the web preview cannot drive
 * react-native-gesture-handler's hold-then-move at all — verified against the app's own
 * shipped drag, not assumed), but "given these boxes and this finger, where does it land" is
 * arithmetic.
 *
 * Two rules, and both matter:
 *   - **Illegal slots are not candidates at all.** A drop that quietly lands on the nearest
 *     legal position instead is how you get a card you didn't ask for; `SLOTS_FOR_KIND` says
 *     where a kind may go, and a finger anywhere else answers `null`.
 *   - **The SMALLEST containing box wins.** Positions nest — the title and the meta line sit
 *     inside the row's body — so a point inside two boxes belongs to the more specific one.
 */
export function slotAtPoint(
  kind: PartKind,
  boxes: Partial<Record<PartSlot, SlotBox>>,
  x: number,
  y: number,
): PartSlot | null {
  let best: PartSlot | null = null;
  let bestArea = Infinity;
  for (const slot of SLOTS_FOR_KIND[kind] ?? []) {
    const b = boxes[slot];
    if (!b || b.width <= 0 || b.height <= 0) continue;
    if (x < b.x || x > b.x + b.width || y < b.y || y > b.y + b.height) continue;
    const area = b.width * b.height;
    if (area < bestArea) { best = slot; bestArea = area; }
  }
  return best;
}

/** A card's parts in draw order — slot order first, then the maintainer's own order within it. */
export function orderedParts(spec: CardSpec): CardPart[] {
  return spec.parts
    .map((part, index) => ({ part, index }))
    .sort((a, b) => {
      const bySlot = PART_SLOT_ORDER.indexOf(a.part.slot) - PART_SLOT_ORDER.indexOf(b.part.slot);
      return bySlot !== 0 ? bySlot : a.index - b.index;
    })
    .map((entry) => entry.part);
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

// ── Describing the cards ─────────────────────────────────────────────────────

/** What happened to one part of one card. */
export type CardPartChange = {
  /**
   * `added` — a part the shipped card doesn't have.
   * `removed` — a shipped part the maintainer took out.
   * `moved` — the same part, in a different slot.
   * `restyled` — the same part in the same slot, with different words, colour, size or weight.
   */
  kind: 'added' | 'removed' | 'moved' | 'restyled';
  part: CardPart;
  /** The shipped part this is a change TO. Absent for `added`. */
  before?: CardPart;
  /** Human-readable "what actually differs", already assembled for the report. */
  detail: string;
};

/** One card the maintainer touched, with its provenance and everything that moved. */
export type CardChange = {
  id: CardId;
  source: string;
  usedBy: string;
  note: string;
  changes: CardPartChange[];
};

/** The style fields worth reporting, as `name: before → after` fragments. */
function styleDelta(before: CardPart, after: CardPart): string[] {
  const out: string[] = [];
  if (before.label !== after.label) out.push(`text ${quoted(before.label)} → ${quoted(after.label)}`);
  if (before.color !== after.color) out.push(`colour ${before.color || 'inherited'} → ${after.color || 'inherited'}`);
  if (before.size !== after.size) out.push(`size ${before.size} → ${after.size}`);
  if (before.weight !== after.weight) out.push(`weight ${before.weight} → ${after.weight}`);
  return out;
}

function quoted(text: string): string {
  return text ? `"${text}"` : '(the sample)';
}

/** A part's own description, for the `added` and `removed` rows that have nothing to diff. */
function describePart(part: CardPart): string {
  const bits: string[] = [part.slot];
  if (part.label) bits.push(quoted(part.label));
  if (part.color) bits.push(part.color);
  bits.push(part.size, part.weight);
  return bits.join(', ');
}

/**
 * Every card that differs from what the app ships, and how.
 *
 * A card the maintainer opened and left alone produces NOTHING — the same rule
 * `describeOverrides` follows for a knob set back to its own default. A report that lists
 * every card says nothing about which one the maintainer cares about.
 */
export function describeCards(o: LabOverrides): CardChange[] {
  const out: CardChange[] = [];

  for (const knob of CARD_KNOBS) {
    const stored = o.cards[knob.id];
    if (!stored) continue;

    const shipped = new Map(knob.defaultParts.map((p) => [p.id, p]));
    const changes: CardPartChange[] = [];

    for (const part of orderedParts(stored)) {
      const before = shipped.get(part.id);
      if (!before) {
        changes.push({ kind: 'added', part, detail: describePart(part) });
        continue;
      }
      if (before.slot !== part.slot) {
        const style = styleDelta(before, part);
        changes.push({
          kind: 'moved',
          part,
          before,
          detail: [`${before.slot} → ${part.slot}`, ...style].join(', '),
        });
        continue;
      }
      const style = styleDelta(before, part);
      if (style.length) changes.push({ kind: 'restyled', part, before, detail: style.join(', ') });
    }

    const kept = new Set(stored.parts.map((p) => p.id));
    for (const part of knob.defaultParts) {
      if (!kept.has(part.id)) changes.push({ kind: 'removed', part, detail: describePart(part) });
    }

    if (changes.length === 0 && !stored.note.trim()) continue;
    out.push({
      id: knob.id,
      source: knob.source,
      usedBy: knob.usedBy,
      note: stored.note,
      changes,
    });
  }

  return out;
}
