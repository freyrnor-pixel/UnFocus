/**
 * copyTone.test.ts — DESIGN_RULES.md rule 23 ("No guilt, no urgency, no judgment"),
 * enforced over every user-facing string in lib/i18n.ts, EN and NO alike.
 *
 * This is the one rule in DESIGN_RULES.md with no other home in the repo, and the one
 * closest to the product's actual purpose: an ADHD app that tells you what you failed to
 * do is worse than no app. The established precedents it generalises — a medicine tray is
 * "still due", never "missed" (AGENTS.md); habits have no negative kind and no broken
 * streak; a goal's strength floors at neutral so it can never read as failing.
 *
 * Implemented as a SOURCE scan rather than by importing the dictionaries, for two reasons:
 * `en`/`no` aren't exported, and several keys are functions (`undoTaken: (name) => …`)
 * whose strings live in a body that a runtime walk can't see.
 *
 * The `!` allowlist is a ratchet, like jest.config.js's coverage thresholds: entries may be
 * removed, never added. It exists because open conflict #7 in DESIGN_RULES.md is unresolved
 * — the rule bans "!" outright, but every current use is celebratory ("Nice work!"), which
 * is the opposite of the guilt the rule is aimed at. Until the maintainer rules on it, this
 * freezes the count where it is so tone can't drift while the question is open.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, '..', 'i18n.ts'), 'utf8');

/**
 * Every string literal in the file, with its 1-based line number — single/double quoted and
 * backtick templates. Comment lines are dropped first so the prose in this repo's headers
 * (which discusses the very words being banned) doesn't trip the scan.
 */
function extractStrings(): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  SRC.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith('*') || line.startsWith('//') || line.startsWith('/*')) return;
    for (const m of raw.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
      const text = m[1] ?? m[2] ?? m[3] ?? '';
      if (text.trim()) out.push({ line: i + 1, text });
    }
  });
  return out;
}

const STRINGS = extractStrings();

describe('DESIGN_RULES.md rule 23 — no guilt, urgency or judgment in UI copy', () => {
  test('the scan actually found the dictionaries', () => {
    // Both languages are one file; if this drops sharply, the extractor broke, not the copy.
    expect(STRINGS.length).toBeGreaterThan(1000);
  });

  // Stems, not whole words, so "glemte"/"glemt"/"ikke glem" are all caught by `glem`.
  const BANNED: [RegExp, string][] = [
    [/\byou missed\b/i, 'EN: blames the user for an absence'],
    [/\bmissed\b/i, 'EN: an untaken dose/task is "still due", never "missed"'],
    [/\boverdue\b/i, 'EN: frames lateness as a debt'],
    [/\bforgot\b/i, 'EN: attributes the gap to a personal failing'],
    [/\bdon'?t forget\b/i, 'EN: a nag'],
    [/\bshould have\b/i, 'EN: retrospective judgment'],
    [/\bfalling behind\b|\bbehind schedule\b/i, 'EN: implies a pace the user is failing'],
    [/\btoo late\b/i, 'EN: closes a door'],
    [/\bhurry\b|\burgent\b/i, 'EN: manufactured urgency'],
    [/\byou failed\b|\byou broke\b/i, 'EN: direct judgment'],
    [/\bglem\w*/i, 'NO: "glemte/glemt/ikke glem" — blames or nags'],
    [/\bgikk glipp\b/i, 'NO: "missed out"'],
    [/\bforsinket\b|\bfor sent\b/i, 'NO: frames lateness'],
    [/\bdu burde\b|\bskulle ha\b/i, 'NO: retrospective judgment'],
    [/\bhaster\b|\bskynd deg\b/i, 'NO: manufactured urgency'],
    [/\bmislyktes\b/i, 'NO: "failed"'],
    // Icelandic (2026-08-15). Stems again, so inflections are covered by one entry:
    // "gleymdir/gleymt/gleymdu" all fall to `gleym`, "misstir/misstum af" to `misst.* af`.
    [/\bgleym\w*/i, 'IS: "gleymdir/gleymt/ekki gleyma" — blames or nags'],
    [/\bmisst\w*\s+af\b/i, 'IS: "missed out on"'],
    [/\bof seint\b|\bá eftir áætlun\b/i, 'IS: frames lateness'],
    [/\bþú hefðir átt að\b|\bþú áttir að\b/i, 'IS: retrospective judgment'],
    [/\bflýttu þér\b|\báríðandi\b|\bliggur á\b/i, 'IS: manufactured urgency'],
    [/\bþér mistókst\b|\bþú klúðraðir\b/i, 'IS: direct judgment'],
    [/\bkomin\w* í vanskil\b|\bá gjalddaga\b/i, 'IS: frames lateness as a debt'],
  ];

  test.each(BANNED)('no UI string matches %s — %s', (pattern, _why) => {
    const hits = STRINGS.filter((s) => pattern.test(s.text)).map((s) => `i18n.ts:${s.line}: "${s.text}"`);
    expect(hits).toEqual([]);
  });

  test('no countdown framing ("only N left", "N days remaining")', () => {
    const hits = STRINGS.filter((s) =>
      /\bonly \d+ (left|remaining)\b/i.test(s.text) ||
      /\bbare \d+ igjen\b/i.test(s.text) ||
      /\baðeins \d+ eftir\b/i.test(s.text) ||
      /\bbara \d+ eftir\b/i.test(s.text),
    ).map((s) => `i18n.ts:${s.line}: "${s.text}"`);
    expect(hits).toEqual([]);
  });

  test('exclamation marks stay frozen at the known celebratory set (ratchet — may shrink, never grow)', () => {
    // Every one is a congratulation or a confirmation, i.e. the opposite of what rule 23
    // targets. Removing one from the copy? Remove it here too. Adding a new "!"? Don't —
    // resolve open conflict #7 first.
    //
    // The Icelandic block (2026-08-15) is NOT the ratchet loosening. Each entry is the
    // twin of a string already frozen here, one per EN/NO pair — a third dictionary of the
    // same copy, not a new place the app shouts. If one of these has no counterpart above,
    // that is the bug: delete it rather than adding its pair.
    const ALLOWED = new Set([
      // Confirmations
      'Added!', 'Lagt til!',
      'List received!', 'Liste mottatt!',
      'Paired!', 'Sammenkoblet!',
      // Congratulations
      'Nice work!', 'Bra jobbet!',
      'All done!', 'Alt klart!',
      'Ingen gjøremål i dag! Nyt dagen',
      "You've done ${n} thing${n !== 1 ? 's' : ''} — small things add up!",
      'Du har fullført ${n} ting — småting teller!',
      // Encouragement at the start of something
      'Time to get started!', 'Tid for å komme i gang!',
      "Let's go! 🌿", 'Kom i gang! 🌿',
      'You have ${min} minutes for this. Good luck!',
      'Du har ${min} minutter til dette. Lykke til!',
      // Icelandic twins of the pairs above, in the same order.
      'Bætt við!',
      'Listi móttekinn!',
      'Parað!',
      'Vel gert!',
      'Allt klárt!',
      'Engin verkefni í dag! Njóttu dagsins',
      "Þú hefur klárað ${n} ${isCount(n, 'hlut', 'hluti')} — smáatriðin telja!",
      'Kominn tími til að byrja!',
      'Byrjum! 🌿',
      "Þú hefur ${min} ${isCount(min, 'mínútu', 'mínútur')} í þetta. Gangi þér vel!",
    ]);
    // `!==` / `!=` inside a template literal's ${…} is a JS operator, not punctuation.
    const punctuation = (text: string) => text.replace(/!==?/g, '').includes('!');
    const unexpected = STRINGS
      .filter((s) => punctuation(s.text) && !ALLOWED.has(s.text))
      .map((s) => `i18n.ts:${s.line}: "${s.text}"`);
    expect(unexpected).toEqual([]);
  });
});
