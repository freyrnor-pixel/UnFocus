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
 *     rows. A report that lists everything says nothing.
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
  describeOverrides,
  isEmptyOverrides,
  sanitizeLabOverrides,
  type LabOverrides,
  type OverrideChange,
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
  const mode = meta.isDark ? 'dark mode' : 'light mode';
  const from = meta.fromScreen ? ` · from: ${meta.fromScreen}` : '';

  const lines: string[] = [
    `UnFocus design lab — ${meta.stamp} · v${meta.appVersion} · ${mode}${from}`,
    '',
  ];

  if (changes.length === 0) {
    lines.push('Nothing was changed in this session.');
    lines.push('');
  } else {
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
