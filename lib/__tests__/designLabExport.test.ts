/**
 * designLabExport.test.ts — the document the design lab actually produces.
 *
 * The lab's output IS the feature: an agent reads this file and edits real tokens from it. So
 * the properties worth pinning are about the document, not about the I/O — that the machine
 * block round-trips exactly, that the human half names the source file an agent has to open,
 * and that an untouched session produces a short "nothing changed" note rather than a wall of
 * unchanged rows (a report that lists everything says nothing).
 *
 * The `export*` functions are deliberately NOT exercised: they are thin wrappers over
 * expo-file-system/expo-sharing copied from lib/aiSetupGuide.ts, and the builders they call are
 * pure, which is the whole reason the two halves are kept apart.
 */
import {
  DESIGN_LAB_BEGIN,
  DESIGN_LAB_END,
  formatDesignLabReport,
  hasSomethingToExport,
  parseDesignLabReport,
  type ReportMeta,
} from '@/lib/designLabExport';
import { EMPTY_OVERRIDES, type LabOverrides } from '@/lib/designLab';
import { getThemePalette } from '@/constants/colors';

const palette = getThemePalette('default', false);
const meta: ReportMeta = { stamp: '2026-08-06', appVersion: '1.1.0', isDark: false };

/**
 * Everything above the machine block — the part a human reads.
 *
 * Several properties below are true of THIS half and deliberately not of the whole file: the
 * JSON block carries the entire bag (both modes, every key) because an agent applying it needs
 * the whole thing, while the prose reports only the mode being edited and only what changed.
 */
const humanHalf = (text: string) => text.slice(0, text.indexOf(DESIGN_LAB_BEGIN));

const bag: LabOverrides = {
  colors: { light: { accent: '#2e7d5b', featHabit: '#6bbf8a' }, dark: {} },
  shape: { radiusScale: 1.35, borderCardWidth: 2 },
  controls: { boolean: 'segmented' },
  slots: { 'row.right': 'energy' },
  cards: {},
  note: 'The habit rows still feel busier than the notes rows.',
};

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/cache/',
  documentDirectory: '/documents/',
  writeAsStringAsync: jest.fn(),
  EncodingType: { UTF8: 'utf8' },
  StorageAccessFramework: {},
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

describe('hasSomethingToExport', () => {
  it('is false for an untouched bag and true once a note alone is written', () => {
    expect(hasSomethingToExport(EMPTY_OVERRIDES)).toBe(false);
    expect(hasSomethingToExport({ ...EMPTY_OVERRIDES, note: 'the edges' })).toBe(true);
    expect(hasSomethingToExport({ ...EMPTY_OVERRIDES, note: '   ' })).toBe(false);
  });
});

describe('formatDesignLabReport', () => {
  const text = formatDesignLabReport(bag, palette, meta);

  it('heads the document with when, which build and which mode', () => {
    expect(text.split('\n')[0]).toBe('UnFocus design lab — 2026-08-06 · v1.1.0 · light mode');
  });

  it('names the screen the lab was opened from, when there was one', () => {
    const withScreen = formatDesignLabReport(bag, palette, { ...meta, fromScreen: 'Habits' });
    expect(withScreen.split('\n')[0]).toContain('· from: Habits');
  });

  it('shows the real before → after for each changed token', () => {
    expect(text).toContain(`${palette.accent} → #2e7d5b`);
    expect(text).toContain('1 → 1.35');
    expect(text).toContain('1.5 → 2');
    expect(text).toContain('switch → segmented');
    expect(text).toContain('time → energy');
  });

  it('tells an agent which file to open, and what breaks if they change it', () => {
    expect(text).toContain('constants/colors.ts accent');
    expect(text).toContain('used by: primary buttons, active tab pill, links, focus ring');
  });

  it('groups the changes under their own headings, and omits headings with nothing under them', () => {
    for (const heading of ['COLOUR', 'SHAPE', 'CONTROLS', 'SLOTS']) {
      expect(text).toContain(heading);
    }
    const colourOnly = humanHalf(formatDesignLabReport(
      { ...EMPTY_OVERRIDES, colors: { light: { accent: '#000000' }, dark: {} } },
      palette,
      meta,
    ));
    expect(colourOnly).toContain('COLOUR');
    expect(colourOnly).not.toContain('SHAPE');
    expect(colourOnly).not.toContain('SLOTS');
  });

  it("carries the maintainer's own words through verbatim", () => {
    expect(text).toContain('NOTE (mine)');
    expect(text).toContain('The habit rows still feel busier than the notes rows.');
  });

  it('says so plainly when nothing was changed, instead of listing every unchanged token', () => {
    const empty = humanHalf(formatDesignLabReport(EMPTY_OVERRIDES, palette, meta));
    expect(empty).toContain('Nothing was changed in this session.');
    expect(empty).not.toContain('COLOUR');
    expect(empty.split('\n').length).toBeLessThan(12);
  });

  it('only reports the mode being edited', () => {
    const both: LabOverrides = {
      ...EMPTY_OVERRIDES,
      colors: { light: { accent: '#111111' }, dark: { accent: '#eeeeee' } },
    };
    expect(humanHalf(formatDesignLabReport(both, palette, meta))).toContain('#111111');
    expect(humanHalf(formatDesignLabReport(both, palette, meta))).not.toContain('#eeeeee');
    // ...but the machine block keeps both, because an agent applying this edits both palettes.
    expect(formatDesignLabReport(both, palette, meta)).toContain('#eeeeee');
  });
});

describe('the machine block', () => {
  it('round-trips the exact bag that produced it', () => {
    const parsed = parseDesignLabReport(formatDesignLabReport(bag, palette, meta));
    expect(parsed.status).toBe('ok');
    if (parsed.status !== 'ok') return;
    expect(parsed.overrides).toEqual(bag);
    expect(parsed.isDark).toBe(false);
  });

  it('records which mode the values belong to', () => {
    const parsed = parseDesignLabReport(formatDesignLabReport(bag, palette, { ...meta, isDark: true }));
    expect(parsed.status === 'ok' && parsed.isDark).toBe(true);
  });

  it('sanitizes on the way back in, so a hand-edited block cannot smuggle junk through', () => {
    const forged = [
      DESIGN_LAB_BEGIN,
      JSON.stringify({ v: 1, colors: { light: { accent: 'javascript:alert(1)', bg: '#fff' } }, shape: { minTapTarget: 2 } }),
      DESIGN_LAB_END,
    ].join('\n');
    const parsed = parseDesignLabReport(forged);
    expect(parsed.status).toBe('ok');
    if (parsed.status !== 'ok') return;
    expect(parsed.overrides.colors.light.accent).toBeUndefined();
    expect(parsed.overrides.colors.light.bg).toBe('#ffffff');
    expect(parsed.overrides.shape.minTapTarget).toBe(44);
  });

  it('returns a reason instead of throwing on a file it cannot read', () => {
    expect(parseDesignLabReport('just some prose')).toEqual({ status: 'invalid', reason: 'no-markers' });
    expect(parseDesignLabReport(`${DESIGN_LAB_BEGIN}\n{not json\n${DESIGN_LAB_END}`)).toEqual({
      status: 'invalid',
      reason: 'json',
    });
    expect(parseDesignLabReport(`${DESIGN_LAB_END}\nx\n${DESIGN_LAB_BEGIN}`)).toEqual({
      status: 'invalid',
      reason: 'no-markers',
    });
  });
});
