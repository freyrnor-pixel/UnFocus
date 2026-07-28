/**
 * goalStarters.test.ts — guards the empty-state starter goals (lib/goalStarters.ts).
 *
 * Same split as the habit starters: structure in the lib file, titles in lib/i18n.ts keyed by
 * `starters.goals.suggestions.<key>`. A key renamed on one side is not a type error, so it
 * gets checked here.
 *
 * The last test is the load-bearing one. Habits in this app are positive-only — no negative
 * habit kind, no "log a slip", no broken-streak state — and the maintainer's decision is that
 * something you want to do LESS of is expressed as a Goal instead. That only stays true if a
 * cutting-back example is actually offered where a new user will see it, so the starter set
 * has to keep carrying one.
 */
import { GOAL_STARTERS } from '@/lib/goalStarters';
import { getTranslations } from '@/lib/i18n';

describe('GOAL_STARTERS', () => {
  it('offers a small, non-empty set', () => {
    expect(GOAL_STARTERS.length).toBeGreaterThan(0);
    // Broad and few. A long list of narrow goals turns Goals into a wellness programme.
    expect(GOAL_STARTERS.length).toBeLessThanOrEqual(6);
  });

  it('uses unique keys', () => {
    const keys = GOAL_STARTERS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(['en', 'no'] as const)('has a non-empty %s title for every starter', (lang) => {
    const t = getTranslations(lang);
    for (const s of GOAL_STARTERS) {
      expect(t.starters.goals.suggestions[s.key].trim()).not.toBe('');
    }
  });

  it('translates every title rather than copying the English', () => {
    const en = getTranslations('en');
    const no = getTranslations('no');
    const identical = GOAL_STARTERS.filter(
      (s) => en.starters.goals.suggestions[s.key] === no.starters.goals.suggestions[s.key]
    );
    expect(identical).toHaveLength(0);
  });

  it('still offers a "less of" goal — the only place cutting back is taught', () => {
    expect(GOAL_STARTERS.some((s) => s.key === 'cutBack')).toBe(true);
    // And it's phrased as what you're aiming at, not as a failure to avoid. The shame-free
    // rule is the whole reason cutting back lives in Goals rather than in a negative habit.
    for (const lang of ['en', 'no'] as const) {
      const title = getTranslations(lang).starters.goals.suggestions.cutBack.toLowerCase();
      for (const forbidden of ['stop', 'quit', 'never', 'bad', 'slutt', 'aldri', 'dårlig']) {
        expect(title).not.toContain(forbidden);
      }
    }
  });
});
