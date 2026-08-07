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
import {
  DESIGN_LAB_VERSION,
  EMPTY_OVERRIDES,
  EMPTY_PLAYGROUND,
  cardKnob,
  resolveCardSpec,
  type LabOverrides,
} from '@/lib/designLab';
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
  playground: EMPTY_PLAYGROUND,
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

// ── The CARDS section (2026-08-07) ───────────────────────────────────────────

/** The habits card with a slider added, its meta badge removed and its count moved. */
function cardBag(note = 'the count should be draggable'): LabOverrides {
  const spec = resolveCardSpec('habit', EMPTY_OVERRIDES);
  const parts = spec.parts
    .filter((p) => p.id !== 'energy')
    .map((p) => (p.id === 'count' ? { ...p, slot: 'meta' as const } : p));
  parts.push({
    id: 'slider-1', kind: 'slider', slot: 'body',
    label: 'How much', color: 'accent', size: 'md', weight: 'regular',
  });
  return { ...EMPTY_OVERRIDES, cards: { habit: { parts, note } } };
}

describe('the CARDS section', () => {
  const text = humanHalf(formatDesignLabReport(cardBag(), palette, meta));

  it('names the card and the file that owns it', () => {
    expect(text).toContain('CARDS');
    expect(text).toContain('habit');
    expect(text).toContain(cardKnob('habit')!.source);
    expect(text).toContain(`used by: ${cardKnob('habit')!.usedBy}`);
  });

  // The marks are the whole reason a card's changes are scannable rather than readable, so
  // the file has to say what they mean without the reader knowing this codebase.
  it('spells out what its own marks mean', () => {
    expect(text).toContain('+ added');
    expect(text).toContain('− taken out');
    expect(text).toContain('↕ moved');
    expect(text).toContain('~ restyled');
  });

  it('marks each part with what happened to it, and says what differs', () => {
    expect(text).toMatch(/\+ slider\s+slider-1\s+body/);
    expect(text).toMatch(/− badge\s+energy/);
    expect(text).toMatch(/↕ count\s+count\s+right → meta/);
  });

  it('carries the card’s own note beside its rows', () => {
    expect(text).toContain('note: the count should be draggable');
  });

  it('reports a card whose only change is its note, rather than dropping it', () => {
    const spec = resolveCardSpec('todo', EMPTY_OVERRIDES);
    const only = { ...EMPTY_OVERRIDES, cards: { todo: { ...spec, note: 'too busy' } } };
    const out = humanHalf(formatDesignLabReport(only, palette, meta));
    expect(out).toContain('CARDS');
    expect(out).toContain('nothing moved');
    expect(out).toContain('note: too busy');
  });

  it('omits the heading entirely when no card was touched', () => {
    expect(humanHalf(formatDesignLabReport(bag, palette, meta))).not.toContain('CARDS');
  });

  // A card composition alone is a real session. Before cards existed the "nothing changed"
  // branch keyed off the token list only, which would have swallowed this whole feature.
  it('does not report "nothing changed" for a session that only edited a card', () => {
    const out = formatDesignLabReport(cardBag(''), palette, meta);
    expect(out).not.toContain('Nothing was changed');
    expect(hasSomethingToExport(cardBag(''))).toBe(true);
  });

  it('puts cards above the token groups — the composition is the bigger request', () => {
    const both = { ...cardBag(), ...bag, cards: cardBag().cards };
    const out = humanHalf(formatDesignLabReport(both, palette, meta));
    expect(out.indexOf('CARDS')).toBeLessThan(out.indexOf('COLOUR'));
  });

  it('round-trips the composition through the machine block', () => {
    const source = cardBag();
    const parsed = parseDesignLabReport(formatDesignLabReport(source, palette, meta));
    expect(parsed.status).toBe('ok');
    if (parsed.status === 'ok') expect(parsed.overrides.cards).toEqual(source.cards);
  });

  it('stamps the block at the current version, so a reader can date the file', () => {
    const out = formatDesignLabReport(cardBag(), palette, meta);
    const json = out.slice(out.indexOf(DESIGN_LAB_BEGIN) + DESIGN_LAB_BEGIN.length, out.indexOf(DESIGN_LAB_END));
    expect(JSON.parse(json).v).toBe(DESIGN_LAB_VERSION);
    expect(DESIGN_LAB_VERSION).toBe(3);
  });
});

// ── The PLAYGROUND section (2026-08-07, v3) ──────────────────────────────────

/** One built screen: a blank card with parts on the body grid, and a real card put on it. */
function builtBag(opts: { withOrigin?: boolean; screenNote?: string } = {}): LabOverrides {
  const cards: LabOverrides['playground']['screens'][number]['cards'] = [
    {
      id: 'card-1',
      origin: 'blank',
      title: 'Today',
      note: 'the slider should be the thing you reach for',
      parts: [
        { id: 'title-1', kind: 'text', slot: 'title', label: 'What now', color: '', size: 'md', weight: 'semibold' },
        { id: 'slider-1', kind: 'slider', slot: 'body', label: 'How much', color: 'accent', size: 'md', weight: 'regular', place: { row: 0, col: 0, span: 4 } },
        { id: 'button-1', kind: 'button', slot: 'body', label: 'Do it', color: '', size: 'sm', weight: 'regular', place: { row: 1, col: 0, span: 2 } },
      ],
    },
  ];
  if (opts.withOrigin) {
    const todo = cardKnob('todo')!;
    cards.push({
      id: 'card-2',
      origin: 'todo',
      title: '',
      note: '',
      parts: todo.defaultParts.map((p) => (p.id === 'check' ? { ...p, slot: 'leading' as const } : { ...p })),
    });
  }
  return {
    ...EMPTY_OVERRIDES,
    playground: {
      screens: [{ id: 'screen-1', screen: 'habits', title: 'Morning', note: opts.screenNote ?? '', cards }],
      note: '',
    },
  };
}

describe('the PLAYGROUND section', () => {
  it('omits the heading entirely when nothing has been built', () => {
    expect(humanHalf(formatDesignLabReport(bag, palette, meta))).not.toContain('PLAYGROUND');
  });

  it('names the screen, its hue and each card', () => {
    const out = humanHalf(formatDesignLabReport(builtBag(), palette, meta));
    expect(out).toContain('PLAYGROUND');
    expect(out).toContain('screen-1  "Morning"');
    expect(out).toContain('habits hue');
    expect(out).toContain('card-1  "Today"');
  });

  // An exported file is read cold by someone who has never seen the screen it came from. A
  // coordinate system nobody explains is a coordinate system nobody trusts.
  it('explains its own r/c/w marks, so the file stands alone', () => {
    const out = humanHalf(formatDesignLabReport(builtBag(), palette, meta));
    expect(out).toContain('r = row down the card');
    expect(out).toContain('column (of 4)');
    expect(out).toContain('how many columns wide');
  });

  it('states where each placed part sits, and says nothing extra about a flowing one', () => {
    const out = humanHalf(formatDesignLabReport(builtBag(), palette, meta));
    expect(out).toMatch(/body\s+r0 c0 w4\s+slider\s+slider-1\s+"How much", accent, md, regular/);
    expect(out).toMatch(/body\s+r1 c0 w2\s+button\s+button-1\s+"Do it", sm, regular/);
    expect(out).toMatch(/row\s+text\s+title-1\s+"What now", md, semibold/);
  });

  // A card built from blank has nothing to be measured against, so a diff would be a report
  // about nothing. The whole composition IS the instruction.
  it('lists a blank-origin card in full and gives it no diff', () => {
    const out = humanHalf(formatDesignLabReport(builtBag(), palette, meta));
    expect(out).toContain('(started blank)');
    expect(out).not.toContain('against the card as it ships');
  });

  // The lab's original question has to survive the rebuild: "the to-do card, but with the tick
  // moved" is still a thing the maintainer asks, and it is now asked from inside a screen.
  it('gives an origin card both halves, and names the file that owns it', () => {
    const out = humanHalf(formatDesignLabReport(builtBag({ withOrigin: true }), palette, meta));
    expect(out).toContain('started from: todo — components/TaskCard.tsx');
    expect(out).toContain('as built:');
    expect(out).toContain('against the card as it ships:');
    expect(out).toContain('↕ checkbox');
    expect(out).toContain('check → leading');
  });

  it('carries the screen’s and the card’s own words verbatim', () => {
    const out = humanHalf(formatDesignLabReport(builtBag({ screenNote: 'this is what I open first' }), palette, meta));
    expect(out).toContain('note: this is what I open first');
    expect(out).toContain('note: the slider should be the thing you reach for');
  });

  it('says so when a screen has nothing on it but carries a note', () => {
    const empty: LabOverrides = {
      ...EMPTY_OVERRIDES,
      playground: { screens: [{ id: 'screen-1', screen: 'plans', title: '', note: 'nothing belongs here', cards: [] }], note: '' },
    };
    const out = humanHalf(formatDesignLabReport(empty, palette, meta));
    expect(out).toContain('nothing on it yet');
    expect(out).toContain('note: nothing belongs here');
  });

  it('says so for a card deliberately left blank', () => {
    const blank: LabOverrides = {
      ...EMPTY_OVERRIDES,
      playground: { screens: [{ id: 'screen-1', screen: 'plans', title: '', note: '', cards: [{ id: 'card-1', origin: 'blank', title: '', note: 'just the shape', parts: [] }] }], note: '' },
    };
    expect(humanHalf(formatDesignLabReport(blank, palette, meta))).toContain('a blank card is the request');
  });

  // Biggest request first. A whole screen outranks a card, which outranks a token nudge —
  // when they appear together the tokens are usually in service of what is above them.
  it('sits above CARDS and above the token groups', () => {
    const both: LabOverrides = { ...cardBag(), playground: builtBag().playground, colors: { light: { accent: '#2e7d5b' }, dark: {} } };
    const out = humanHalf(formatDesignLabReport(both, palette, meta));
    expect(out.indexOf('PLAYGROUND')).toBeLessThan(out.indexOf('CARDS'));
    expect(out.indexOf('CARDS')).toBeLessThan(out.indexOf('COLOUR'));
  });

  // The failure formatCards' own edit notes warn about, one level up: a session spent
  // building a screen and touching no token at all is a real session, and swallowing it
  // would swallow the whole feature.
  it('does not say "nothing was changed" for a session that only built a screen', () => {
    const out = formatDesignLabReport(builtBag(), palette, meta);
    expect(out).not.toContain('Nothing was changed');
    expect(hasSomethingToExport(builtBag())).toBe(true);
  });

  it('round-trips the whole playground through the machine block', () => {
    const built = builtBag({ withOrigin: true, screenNote: 'this is what I open first' });
    const out = formatDesignLabReport(built, palette, meta);
    const parsed = parseDesignLabReport(out);
    expect(parsed.status).toBe('ok');
    if (parsed.status !== 'ok') return;
    expect(parsed.overrides.playground).toEqual(built.playground);
  });
});
