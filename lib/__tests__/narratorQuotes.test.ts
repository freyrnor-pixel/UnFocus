/**
 * narratorQuotes.test.ts — the anti-shame narrator keeps its promises (2026-08-19).
 *
 * Two halves, and they guard different things:
 *
 *   1. **The DATA** (lib/narratorQuotes.ts) is imported and exercised — the cycle wraps, the
 *      three languages stay the same length and order, every category clears the floor. These
 *      are ordinary unit tests of pure functions.
 *   2. **The TONE and the SHAPE** are source-scanned, for the reason lib/__tests__/copyTone.ts
 *      and chromeRhythm give: neither is visible to `tsc`, to a rendered tree, or to a
 *      screenshot. A quote that blames the user renders exactly as well as one that doesn't,
 *      and a card wrapper around it looks tidier in isolation than the bare line the brief
 *      asked for. The failure mode both times is a later pass that reads as an improvement.
 *
 * The tone half is deliberately NOT folded into copyTone.test.ts. That file's contract is "every
 * user-facing string in lib/i18n.ts" and its extractor reads that one file; widening it to
 * follow strings into data modules would make its own "the scan actually found the dictionaries"
 * guard meaningless. This mirrors the same banned list against a second, smaller source instead.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  MIN_QUOTES_PER_CATEGORY,
  NARRATOR_CATEGORIES,
  narratorQuotes,
  quoteAt,
  randomQuoteIndex,
  type NarratorCategory,
} from '@/lib/narratorQuotes';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
/** Source with comments stripped — this repo's headers name the very words being banned. */
const code = (rel: string) =>
  read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const LANGS = ['no', 'en', 'is'] as const;

// ── 1. The data ──────────────────────────────────────────────────────────────

describe('the quote table', () => {
  it.each(NARRATOR_CATEGORIES)('%s carries enough lines to be worth cycling', (category) => {
    for (const lang of LANGS) {
      const lines = narratorQuotes(category, lang);
      expect({ category, lang, count: lines.length })
        .toEqual({ category, lang, count: lines.length });
      expect(lines.length).toBeGreaterThanOrEqual(MIN_QUOTES_PER_CATEGORY);
    }
  });

  it.each(NARRATOR_CATEGORIES)('%s is the same length in all three languages', (category) => {
    // `quoteAt` indexes by POSITION, so a shorter dictionary silently shows a different joke
    // per language — and worse, the cycle wraps at a different point, so two users pressing
    // the same number of times land on unrelated lines.
    const lengths = LANGS.map((lang) => narratorQuotes(category, lang).length);
    expect(new Set(lengths).size).toBe(1);
  });

  it('has no blank or duplicated line inside a category', () => {
    for (const lang of LANGS) {
      for (const category of NARRATOR_CATEGORIES) {
        const lines = narratorQuotes(category, lang);
        for (const line of lines) expect(line.trim().length).toBeGreaterThan(0);
        expect(new Set(lines).size).toBe(lines.length);
      }
    }
  });

  it('cycles forward and wraps rather than running out', () => {
    const lines = narratorQuotes('todo', 'no');
    // The component's counter only ever goes up; this is what turns it into a loop.
    for (let i = 0; i < lines.length * 3; i += 1) {
      expect(quoteAt('todo', 'no', i)).toBe(lines[i % lines.length]);
    }
  });

  it('walks every line before repeating one', () => {
    // The property the cycle button actually promises: press it n-1 times from anywhere and
    // you have seen the whole category. A random pick per press would fail this.
    for (const category of NARRATOR_CATEGORIES) {
      const lines = narratorQuotes(category, 'no');
      const start = 3; // any offset — the walk must not depend on starting at 0
      const seen = new Set(lines.map((_, k) => quoteAt(category, 'no', start + k)));
      expect(seen.size).toBe(lines.length);
    }
  });

  it('survives a hostile index instead of throwing', () => {
    // This renders on an empty screen. A crash there is a far worse outcome than a repeat.
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(typeof quoteAt('todo', 'no', bad)).toBe('string');
    }
    // Negative indices wrap backwards rather than reading off the end of the array.
    expect(quoteAt('todo', 'no', -1)).toBe(narratorQuotes('todo', 'no').slice(-1)[0]);
  });

  it('falls back to `general` rather than to an empty list', () => {
    // A caller can always index the result, which is what lets the component skip a guard.
    const bogus = 'not-a-category' as NarratorCategory;
    expect(narratorQuotes(bogus, 'no')).toEqual(narratorQuotes('general', 'no'));
    expect(narratorQuotes('todo', 'xx' as 'no').length).toBeGreaterThan(0);
  });

  it('starts somewhere inside the category', () => {
    for (let i = 0; i < 50; i += 1) {
      const index = randomQuoteIndex('habits', 'no');
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(narratorQuotes('habits', 'no').length);
    }
  });
});

// ── 2. The tone ──────────────────────────────────────────────────────────────

describe('DESIGN_RULES.md rule 23, applied to the narrator', () => {
  const SRC = code('lib/narratorQuotes.ts');
  const LINES = LANGS.flatMap((lang) =>
    NARRATOR_CATEGORIES.flatMap((category) =>
      narratorQuotes(category, lang).map((text) => ({ lang, category, text })),
    ),
  );

  /**
   * copyTone.test.ts's list, minus the forgetting stems — see below, and see the carve-out note
   * in lib/narratorQuotes.ts's header. Everything else applies here MORE strictly than it does
   * to the dictionaries, not less: this is the surface a user reads on a bad day.
   */
  const BANNED: [RegExp, string][] = [
    [/\bmissed\b|\byou missed\b/i, 'EN: blames the user for an absence'],
    [/\boverdue\b/i, 'EN: frames lateness as a debt'],
    [/\bshould have\b|\byou should\b/i, 'EN: retrospective judgment, or a nag'],
    [/\bfalling behind\b|\bbehind schedule\b/i, 'EN: implies a pace the user is failing'],
    [/\btoo late\b/i, 'EN: closes a door'],
    [/\bhurry\b|\burgent\b/i, 'EN: manufactured urgency'],
    [/\byou failed\b|\byou broke\b/i, 'EN: direct judgment'],
    [/\bgikk glipp\b/i, 'NO: "missed out"'],
    [/\bforsinket\b|\bfor sent\b/i, 'NO: frames lateness'],
    [/\bdu burde\b|\bskulle ha\b/i, 'NO: retrospective judgment'],
    [/\bhaster\b|\bskynd deg\b/i, 'NO: manufactured urgency'],
    [/\bmislyktes\b/i, 'NO: "failed"'],
    [/\bmisst\w*\s+af\b/i, 'IS: "missed out on"'],
    [/\bof seint\b|\bá eftir áætlun\b/i, 'IS: frames lateness'],
    [/\bþú hefðir átt að\b|\bþú áttir að\b/i, 'IS: retrospective judgment'],
    [/\bflýttu þér\b|\báríðandi\b|\bliggur á\b/i, 'IS: manufactured urgency'],
    [/\bþér mistókst\b|\bþú klúðraðir\b/i, 'IS: direct judgment'],
  ];

  test.each(BANNED)('no quote matches %s — %s', (pattern, _why) => {
    expect(LINES.filter((q) => pattern.test(q.text)).map((q) => `${q.lang}/${q.category}: ${q.text}`))
      .toEqual([]);
  });

  test('the forgetting stems appear only where forgetting IS the point', () => {
    // ⚠️ **The one carve-out, and it is a RATCHET — entries may be removed, never added.**
    // `glem*` / `forgot` / `gleym*` are banned outright in lib/i18n.ts because there they can
    // only ever be aimed at the user. Two of this system's required lines are *about*
    // forgetting, and banning the word would ban the idea: the narrator admitting its own
    // medicine is still on the counter, and the point that a task you did but never logged
    // still got done. Both are the anti-shame content itself.
    //
    // The shape that makes them safe, and the thing to check before ever adding a third: the
    // sentence must be about the NARRATOR or about the LOG — never about the user. "I forget
    // mine all the time" is company; "you forgot to log this" is the verdict the whole rule
    // exists to prevent.
    const FORGETTING_IS_THE_POINT = new Set([
      'Not logging something you actually did changes nothing. It still got done.',
      'Å ikke logge noe du faktisk gjorde, endrer ingenting. Det ble jo gjort.',
      'Að skrá ekki eitthvað sem þú gerðir breytir engu. Það var samt gert.',
    ]);
    const stems = /\bglem\w*|\bforgot\w*|\bgleym\w*|\bforget\w*/i;
    const unexpected = LINES
      .filter((q) => stems.test(q.text) && !FORGETTING_IS_THE_POINT.has(q.text))
      .map((q) => `${q.lang}/${q.category}: ${q.text}`);
    expect(unexpected).toEqual([]);
  });

  test('nothing counts, compares or notices how long the screen has been empty', () => {
    // The narrator cannot tell how long you have been looking at this, and must never sound
    // like it can. Same family as lib/dayLog.ts's and lib/episodes.ts's source scans: the
    // promise is kept by there being no arithmetic to keep it with.
    // Time arithmetic only — `.length` is legitimately read by the fallback guard, and a
    // broader scan would ban the module reading its own table.
    expect(SRC).not.toMatch(/\bDate\b|\bnew Date\(|todayStr|dateStr|getTime|Date\.now/);
    // No line names a number, a streak, or a comparison to another stretch of time.
    const scoreboard = /\b\d+ (days?|dager|dagar)\b|\bstreak\b|\bstrek\b|\bstill nothing\b|\bfortsatt (ingenting|tomt)\b/i;
    expect(LINES.filter((q) => scoreboard.test(q.text)).map((q) => q.text)).toEqual([]);
  });

  test('the module reaches nothing — no store, no DB, no notifications', () => {
    // Same discipline as lib/cardLayout.ts and lib/designLab.ts: this is evaluated in a render
    // path on four screens, and a quote table has no business waking any of that up.
    for (const forbidden of [/@\/store\//, /@\/lib\/db/, /@\/lib\/notifications/, /@\/lib\/reminders/, /expo-notifications/]) {
      expect({ forbidden: String(forbidden), hit: forbidden.test(SRC) })
        .toEqual({ forbidden: String(forbidden), hit: false });
    }
  });
});

// ── 3. The shape ─────────────────────────────────────────────────────────────

describe('NarratorQuote — a line on the card, not a card of its own', () => {
  const SRC = code('components/NarratorQuote.tsx');

  it('draws no container of any kind', () => {
    // *"Do NOT wrap the quote in a card, box, background container, or border."* Every channel
    // a container could come back through, checked separately — a later pass re-boxing this is
    // the expected failure, and it would look like a tidy-up in the diff.
    for (const forbidden of [/<Surface/, /backgroundColor/, /borderWidth/, /borderColor/, /borderRadius/]) {
      expect({ forbidden: String(forbidden), hit: forbidden.test(SRC) })
        .toEqual({ forbidden: String(forbidden), hit: false });
    }
  });

  it('is muted and translucent inside the brief\'s band', () => {
    const alpha = Number(SRC.match(/const NARRATOR_OPACITY = ([\d.]+);/)![1]);
    expect(alpha).toBeGreaterThanOrEqual(0.5);
    expect(alpha).toBeLessThanOrEqual(0.6);
    // Applied to the rendered opacity, not just declared — the constant is worthless if the
    // animated style overwrites it, which is exactly what a naive fade would do.
    expect(SRC).toMatch(/opacity: opacity\.value \* NARRATOR_OPACITY/);
  });

  it('gives the cycle button a hit area past the 12px asked for', () => {
    expect(SRC).toMatch(/hitSlop=\{HitSlop\.loose\}/);
  });

  it('swaps the line off the JS thread, not from inside the worklet', () => {
    // A `withTiming` completion callback is auto-workletized with nothing in the source saying
    // so, and calling setState from the UI thread crashes on device while the web preview —
    // where worklets run on the JS thread — renders it perfectly. See AGENTS.md's Reanimated
    // gotcha; __tests__/workletSafety.test.ts is the general guard and this is the specific one.
    expect(SRC).toMatch(/runOnJS\(advance\)\(\)/);
    expect(SRC).not.toMatch(/\(finished\) => \{\s*if \(finished\) setIndex/);
  });

  it('picks its opening line once, not on every render', () => {
    // The lazy initialiser. Called in the argument position it would re-roll whenever the host
    // card re-renders, and the quote would change under the user for unrelated reasons.
    expect(SRC).toMatch(/useState\(\(\) => randomQuoteIndex\(category, lang\)\)/);
  });

  it('respects reduced motion by not animating at all', () => {
    expect(SRC).toMatch(/if \(reducedMotion\)/);
    expect(SRC).toMatch(/layout=\{reducedMotion \? undefined :/);
  });
});

describe('the italic exception is exactly one file wide, and is a real face', () => {
  // The 2026-08-18 blueprint pass deleted `fontStyle: 'italic'` from all 14 files that carried
  // it. This is a narrow, instructed exception the day after — *"muted, translucent italic
  // text… so it looks like a subtle note rather than primary UI"* — and the value of writing it
  // down is that the NEXT session can tell an exception from drift. If a second file wants
  // italic, that is a question for the maintainer, not a precedent already set.
  it('lives only in components/NarratorQuote.tsx', () => {
    expect(code('components/NarratorQuote.tsx')).toMatch(/fontFamily: Fonts\.italic/);
    for (const file of [
      'components/StarterCard.tsx',
      'components/StarterExampleRow.tsx',
      'components/HintCard.tsx',
      'components/PlanTaskCard.tsx',
    ]) {
      const source = code(file);
      expect({ file, italic: /fontStyle: 'italic'|Fonts\.italic/.test(source) })
        .toEqual({ file, italic: false });
    }
  });

  it('uses the loaded face, not the synthesised style', () => {
    // ⚠️ The load-bearing half, and invisible to every harness in this repo. RN does not map
    // `fontStyle` onto a named custom family, so `fontStyle: 'italic'` beside `Fonts.regular`
    // is synthesised on web and iOS and does NOTHING on Android — a perfect slant in the web
    // preview, in `npm run wraps`, and in every screenshot, over an upright shipped build.
    expect(code('components/NarratorQuote.tsx')).not.toMatch(/fontStyle: 'italic'/);
    // …which only works if the face is actually at the font gate. Both halves, or neither.
    expect(code('constants/theme.ts')).toMatch(/italic: 'Nunito_400Regular_Italic'/);
    expect(code('app/_layout.tsx')).toMatch(/Nunito_400Regular_Italic,[\s\S]*useFonts\(\{[\s\S]*Nunito_400Regular_Italic,/);
  });
});

// ── 4. The integration ───────────────────────────────────────────────────────

describe('every empty card speaks, and none of them names its own emptiness', () => {
  for (const [file, category, label] of [
    ['app/plans.tsx', 'todo', 'To-do'],
    ['app/(tabs)/shopping.tsx', 'shopping', 'Shopping'],
    ['app/(tabs)/health.tsx', 'health', 'Health'],
    ['app/habits.tsx', 'habits', 'Habits'],
    // The day card is a To-do surface on two screens at once (Home's preview and the To-do
    // tab's default timeline layout), and it is the empty state most users see first — the
    // tab's Today card goes through this, not through `DoneSplitList`.
    ['components/PlanTaskCard.tsx', 'todo', "the day card"],
    // Home's habits card and the Habits tab lost their "nothing here yet" lines in the same
    // 2026-08-12 pass; they take the restoration together, or Home and the tab drift.
    ['components/HomeHabitsCard.tsx', 'habits', "Home's habits card"],
  ] as const) {
    it(`${label} mounts the narrator in its own category`, () => {
      const source = code(file);
      expect(source).toContain("import NarratorQuote from '@/components/NarratorQuote'");
      expect(source).toContain(`<NarratorQuote category="${category}"`);
    });
  }

  it('leaves no To-do empty-state placeholder behind', () => {
    // The prop and all four strings are deleted, not merely unused — a dead key is how the old
    // copy comes back, since re-wiring one reads as fixing a regression.
    const i18n = read('lib/i18n.ts').replace(/^\s*(\*|\/\/|\/\*).*$/gm, '');
    for (const key of ['noPlansToday', 'tasksDayEmpty', 'tasksSectionWheneverEmpty', 'tasksSectionRecurringEmpty']) {
      expect({ key, present: new RegExp(`\\b${key}:`).test(i18n) }).toEqual({ key, present: false });
    }
    expect(code('app/plans.tsx')).not.toMatch(/emptyText/);
    // …and the box it sat in went with it. See that file's style block.
    expect(code('app/plans.tsx')).not.toMatch(/sectionEmpty:/);
  });
});
