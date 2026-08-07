/**
 * designLabExport.ts — turns a design-lab override bag into a file an agent can act on.
 *
 * The lab's real output is not the app looking different on one phone; it is this document.
 * The maintainer tinkers until a screen looks right, exports, and pastes the result into an
 * agent session, which edits the real tokens. That is the whole point of the feature — a
 * decision that used to be described in prose ("the borders are too heavy") arrives as
 * `BORDER_WIDTH.card 1.5 → 2.25, constants/theme.ts:579`.
 *
 * The file has two halves and both are load-bearing:
 *   • a HUMAN half the maintainer reads before sending, so they can see they didn't
 *     accidentally ship a note about the wrong screen; and
 *   • a MACHINE block between fixed markers, so the agent applies exactly what was chosen
 *     rather than re-deriving it from the prose.
 * The marker idiom is deliberately the same as lib/aiSetupGuide.ts's, so the two documents
 * are recognisable as the same kind of thing.
 *
 * Connections:
 *   Imports → expo-file-system/legacy, expo-sharing, react-native (Platform), lib/designLab,
 *             lib/backup (TYPE ONLY — SaveToDeviceResult), constants/colors (TYPE ONLY)
 *   Used by → app/design-lab.tsx, lib/__tests__/designLabExport.test.ts
 *   Data    → none of its own. Reads nothing; the caller passes the bag and the live palette.
 *             Writes one file to the cache/Documents dir on export.
 *
 * Edit notes:
 *   - **The builders are pure and the I/O is not, and they are kept apart on purpose** —
 *     `formatDesignLabReport()` is a string function with no imports of consequence, so the
 *     test can assert the document's exact shape without mocking a filesystem. Only the two
 *     `export*` functions touch expo APIs. Same split as lib/feedbackMail.ts.
 *   - **This is NOT lib/aiSetupGuide.ts's round-trip and must not become it.** That file
 *     accepts an AI-authored reply back INTO the app, which is why it has a whitelist and a
 *     validation pass. This one only ever goes OUT. `parseDesignLabReport()` exists for the
 *     test and for an agent reading the file — deliberately not wired to any import UI, and
 *     `design_lab` is not in aiSetupApply's SETTINGS_WHITELIST. An AI-authored file must not
 *     be able to restyle the app.
 *   - An empty bag produces a short "nothing changed" document rather than a wall of unchanged
 *     rows. A report that lists everything says nothing. **That branch must consider PLAYGROUND
 *     and CARDS as well as the token groups** — a session that only built a screen is a real
 *     session, and keying the check off the token list alone would swallow the whole feature.
 *   - **CARDS is a DIFF, and is shaped differently from the four groups above it on purpose.**
 *     Those are one value moving from A to B; a card is a composition, so what an agent needs
 *     is what was added, taken out, moved or restyled against the card as it ships. The marks
 *     (`+ − ↕ ~`) are explained in the section's own preamble so the file stands alone.
 *   - **PLAYGROUND is a COMPOSITION, and that is a third shape again.** A card built from
 *     blank has no shipped version to be measured against, so the only honest report is the
 *     whole thing — every part, in the band it is drawn in, with its grid cell where it has
 *     one. A card that names an origin gets both halves (`as built`, then `against the card as
 *     it ships`), because those answer two different questions and the maintainer may have
 *     meant either. It is emitted FIRST: a whole screen is a bigger request than a card, which
 *     is a bigger request than a token.
 *   - **The `r/c/w` legend lives in the section's preamble**, the same way the `+ − ↕ ~` marks
 *     do. An exported file is read cold by someone who has never seen this screen; a
 *     coordinate system nobody explains is a coordinate system nobody trusts.
 */
import { Platform } from 'react-native';
import {
  cacheDirectory,
  documentDirectory,
  writeAsStringAsync,
  EncodingType,
  StorageAccessFramework,
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  DESIGN_LAB_VERSION,
  describeCards,
  describeOverrides,
  describePlayground,
  isEmptyOverrides,
  sanitizeLabOverrides,
  type CardChange,
  type CardPartChange,
  type LabOverrides,
  type OverrideChange,
  type PlaygroundScreenDescription,
} from '@/lib/designLab';
import type { SaveToDeviceResult } from '@/lib/backup';
import type { ThemePalette } from '@/constants/colors';

/** Verbatim markers around the machine-readable block. */
export const DESIGN_LAB_BEGIN = '===UNFOCUS-DESIGN-LAB-BEGIN===';
export const DESIGN_LAB_END = '===UNFOCUS-DESIGN-LAB-END===';

const FILENAME = 'unfocus-design-lab';

/** Everything the report needs that isn't in the bag itself. */
export type ReportMeta = {
  /** `YYYY-MM-DD HH:MM` — when the experiment was exported. */
  stamp: string;
  /** `app.json`'s version, so an agent knows which tree the token values came from. */
  appVersion: string;
  /** Which palette was being edited. Light and dark hold separate overrides. */
  isDark: boolean;
  /** The screen the maintainer had in mind, if the lab was opened from one. */
  fromScreen?: string;
};

// ── The human half ───────────────────────────────────────────────────────────

/** Pads `s` to `width` so the before→after columns line up in a monospace-ish reader. */
function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function formatGroup(title: string, rows: OverrideChange[]): string[] {
  if (rows.length === 0) return [];
  const idWidth = Math.max(...rows.map((r) => r.id.length));
  const out: string[] = [title];
  for (const row of rows) {
    out.push(`  ${pad(row.id, idWidth)}  ${row.before} → ${row.after}`);
    out.push(`  ${' '.repeat(idWidth)}  ${row.source}`);
    out.push(`  ${' '.repeat(idWidth)}  used by: ${row.usedBy}`);
  }
  out.push('');
  return out;
}

/**
 * The prefix that says what happened to a part.
 *
 * Symbols rather than words because a card's changes are a LIST and the list is scanned, not
 * read — four aligned glyphs down the left margin is what makes "one thing was added, one
 * moved" legible at a glance. They are spelled out in the section's own preamble, so an agent
 * (or a maintainer) reading the file cold never has to guess.
 */
const CHANGE_MARK: Record<CardPartChange['kind'], string> = {
  added: '+',
  removed: '−',
  moved: '↕',
  restyled: '~',
};

/**
 * The CARDS section: what the maintainer wants each card to be made of.
 *
 * Structurally unlike the four token groups above it and deliberately so — those are
 * before→after pairs on one value, while a card is a composition, so this reports a DIFF: what
 * was added, taken out, moved or restyled, against the card as the app ships it. The provenance
 * lines carry the same job they do everywhere else in this file: name the file to edit.
 */
function formatCards(cards: CardChange[]): string[] {
  if (cards.length === 0) return [];
  const out: string[] = [
    'CARDS',
    '  + added   − taken out   ↕ moved   ~ restyled. Everything else is as it ships.',
    '',
  ];
  for (const card of cards) {
    out.push(`  ${card.id}`);
    out.push(`      ${card.source}`);
    out.push(`      used by: ${card.usedBy}`);
    if (card.changes.length === 0) {
      out.push('      (nothing moved — the note below is the whole request)');
    } else {
      out.push(...formatPartChanges(card.changes, '    '));
    }
    if (card.note.trim()) {
      for (const line of card.note.trim().split('\n')) out.push(`      note: ${line}`);
    }
    out.push('');
  }
  return out;
}

/** The `+ − ↕ ~` rows for one card, aligned. Shared by CARDS and PLAYGROUND's origin half. */
function formatPartChanges(changes: CardPartChange[], indent: string): string[] {
  const kindWidth = Math.max(...changes.map((c) => c.part.kind.length));
  const idWidth = Math.max(...changes.map((c) => c.part.id.length));
  return changes.map((change) =>
    `${indent}${CHANGE_MARK[change.kind]} ${pad(change.part.kind, kindWidth)}  ` +
    `${pad(change.part.id, idWidth)}  ${change.detail}`,
  );
}

/**
 * The PLAYGROUND section: the screens and cards the maintainer built from nothing.
 *
 * A third shape, after the token groups' before→after pairs and CARDS' diff. Nothing here has
 * a shipped counterpart, so every card is stated IN FULL — an agent reading this is building
 * something that does not exist yet, and a diff against nothing is not a buildable
 * instruction. A card that names an origin additionally carries the diff, because the
 * maintainer may have meant "this card" or may have meant "that card, changed".
 */
function formatPlayground(screens: PlaygroundScreenDescription[]): string[] {
  if (screens.length === 0) return [];
  const out: string[] = [
    'PLAYGROUND',
    '  Screens and cards built from nothing. Each card is listed IN FULL — there is no shipped',
    '  version to compare it with. Positions: r = row down the card, c = column (of 4),',
    '  w = how many columns wide. A part with no r/c/w takes a line of its own, full width.',
    '',
  ];

  for (const screen of screens) {
    const name = screen.title.trim() ? `"${screen.title.trim()}"` : '(unnamed)';
    const hue = screen.screen ? `   (drawn with the ${screen.screen} hue)` : '';
    out.push(`  ${screen.id}  ${name}${hue}`);
    if (screen.note.trim()) {
      for (const line of screen.note.trim().split('\n')) out.push(`      note: ${line}`);
    }
    if (screen.cards.length === 0) out.push('      (nothing on it yet — the note above is the whole request)');

    for (const card of screen.cards) {
      const cardName = card.title.trim() ? `"${card.title.trim()}"` : '(unnamed)';
      const from = card.originSource
        ? `(started from: ${card.origin} — ${card.originSource})`
        : `(started ${card.origin})`;
      out.push('');
      out.push(`    ${card.id}  ${cardName}   ${from}`);

      if (card.composition.length === 0) {
        out.push('      (empty — a blank card is the request)');
      } else {
        // `as built` only earns its heading when there is a second half below it to tell apart.
        if (card.diff) out.push('      as built:');
        const bandWidth = Math.max(...card.composition.map((l) => l.band.length));
        const whereWidth = Math.max(...card.composition.map((l) => l.where.length));
        const kindWidth = Math.max(...card.composition.map((l) => l.part.kind.length));
        const idWidth = Math.max(...card.composition.map((l) => l.part.id.length));
        for (const line of card.composition) {
          out.push(
            `        ${pad(line.band, bandWidth)}  ${pad(line.where, whereWidth)}  ` +
            `${pad(line.part.kind, kindWidth)}  ${pad(line.part.id, idWidth)}  ${line.detail}`,
          );
        }
      }

      if (card.diff) {
        out.push('      against the card as it ships:');
        if (card.diff.length === 0) out.push('        (unchanged — it is that card, put on this screen)');
        else out.push(...formatPartChanges(card.diff, '        '));
      }

      if (card.note.trim()) {
        for (const line of card.note.trim().split('\n')) out.push(`      note: ${line}`);
      }
    }
    out.push('');
  }

  return out;
}

/**
 * The whole document — human half, then the machine block.
 *
 * Pure. Everything time- or device-dependent arrives through `meta`, so the test can assert a
 * byte-exact document instead of matching around a clock.
 */
export function formatDesignLabReport(
  overrides: LabOverrides,
  palette: ThemePalette,
  meta: ReportMeta,
): string {
  const changes = describeOverrides(overrides, palette, meta.isDark);
  const cards = describeCards(overrides);
  const screens = describePlayground(overrides);
  const mode = meta.isDark ? 'dark mode' : 'light mode';
  const from = meta.fromScreen ? ` · from: ${meta.fromScreen}` : '';

  const lines: string[] = [
    `UnFocus design lab — ${meta.stamp} · v${meta.appVersion} · ${mode}${from}`,
    '',
  ];

  if (changes.length === 0 && cards.length === 0 && screens.length === 0) {
    lines.push('Nothing was changed in this session.');
    lines.push('');
  } else {
    // Biggest request first: a whole screen, then a card, then the tokens — which when they
    // are present at all are usually in service of whatever is above them.
    lines.push(...formatPlayground(screens));
    lines.push(...formatCards(cards));
    lines.push(...formatGroup('COLOUR', changes.filter((c) => c.group === 'COLOUR')));
    lines.push(...formatGroup('SHAPE', changes.filter((c) => c.group === 'SHAPE')));
    lines.push(...formatGroup('CONTROLS', changes.filter((c) => c.group === 'CONTROLS')));
    lines.push(...formatGroup('SLOTS', changes.filter((c) => c.group === 'SLOTS')));
  }

  if (overrides.note.trim()) {
    lines.push('NOTE (mine)');
    for (const line of overrides.note.trim().split('\n')) lines.push(`  ${line}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('The block below is for an agent. It is the same choices, exactly, so nothing');
  lines.push('has to be read back out of the prose above.');
  lines.push('');
  lines.push(DESIGN_LAB_BEGIN);
  lines.push(JSON.stringify({ v: DESIGN_LAB_VERSION, isDark: meta.isDark, ...overrides }, null, 2));
  lines.push(DESIGN_LAB_END);
  lines.push('');

  return lines.join('\n');
}

// ── Reading one back ─────────────────────────────────────────────────────────

export type ParsedDesignLab =
  | { status: 'ok'; overrides: LabOverrides; isDark: boolean }
  | { status: 'invalid'; reason: 'no-markers' | 'json' };

/**
 * Pull the machine block back out of a report.
 *
 * Sync, pure, and never throws — a malformed file is a return value, not an exception. Used by
 * the test to prove the round-trip, and available to an agent that would rather parse than
 * read. Deliberately not wired to any import UI; see this file's Edit notes.
 */
export function parseDesignLabReport(text: string): ParsedDesignLab {
  const start = text.indexOf(DESIGN_LAB_BEGIN);
  const end = text.indexOf(DESIGN_LAB_END);
  if (start === -1 || end === -1 || end < start) return { status: 'invalid', reason: 'no-markers' };

  const json = text.slice(start + DESIGN_LAB_BEGIN.length, end).trim();
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { status: 'invalid', reason: 'json' };
  }
  const isDark = !!(raw && typeof raw === 'object' && (raw as Record<string, unknown>).isDark);
  return { status: 'ok', overrides: sanitizeLabOverrides(raw), isDark };
}

// ── Export ───────────────────────────────────────────────────────────────────

/** True when there is anything worth exporting — the button dims otherwise. */
export function hasSomethingToExport(overrides: LabOverrides): boolean {
  return !isEmptyOverrides(overrides) || overrides.note.trim().length > 0;
}

/** Writes the report to the cache dir and opens the OS share sheet. */
export async function exportDesignLab(
  overrides: LabOverrides,
  palette: ThemePalette,
  meta: ReportMeta,
): Promise<'shared' | 'unavailable'> {
  const text = formatDesignLabReport(overrides, palette, meta);
  const uri = `${cacheDirectory}${FILENAME}.txt`;
  await writeAsStringAsync(uri, text, { encoding: EncodingType.UTF8 });

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, {
    mimeType: 'text/plain',
    dialogTitle: 'UnFocus design lab',
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
 * Writes the report as a real file to a user-visible location instead of routing through the
 * share sheet — the "local save" counterpart, mirroring exportAiSetupGuideToDevice() exactly.
 */
export async function exportDesignLabToDevice(
  overrides: LabOverrides,
  palette: ThemePalette,
  meta: ReportMeta,
): Promise<SaveToDeviceResult> {
  const text = formatDesignLabReport(overrides, palette, meta);

  if (Platform.OS === 'android') {
    const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) return { status: 'canceled' };
    const fileUri = await StorageAccessFramework.createFileAsync(perm.directoryUri, FILENAME, 'text/plain');
    await StorageAccessFramework.writeAsStringAsync(fileUri, text, { encoding: EncodingType.UTF8 });
    return { status: 'saved', location: safDirectoryLabel(perm.directoryUri) };
  }

  if (Platform.OS === 'ios' && documentDirectory) {
    try {
      const uri = `${documentDirectory}${FILENAME}.txt`;
      await writeAsStringAsync(uri, text, { encoding: EncodingType.UTF8 });
      return { status: 'saved', location: 'Files → On My iPhone/iPad → UnFocus' };
    } catch {
      // Fall through to the share sheet below.
    }
  }

  if (!(await Sharing.isAvailableAsync())) return { status: 'unavailable' };
  const uri = `${cacheDirectory}${FILENAME}.txt`;
  await writeAsStringAsync(uri, text, { encoding: EncodingType.UTF8 });
  await Sharing.shareAsync(uri, {
    mimeType: 'text/plain',
    dialogTitle: 'UnFocus design lab',
    UTI: 'public.plain-text',
  });
  return { status: 'saved', location: 'the location you chose' };
}
