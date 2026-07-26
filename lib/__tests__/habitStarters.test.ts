/**
 * habitStarters.test.ts — guards the empty-state starter habits (lib/habitStarters.ts).
 *
 * The starters split their data across two files on purpose: structure here, titles in
 * lib/i18n.ts keyed by `starters.habits.suggestions.<key>`. That split is exactly what can
 * silently rot — a key renamed on one side, a glyph that isn't pickable — and neither
 * failure is a type error, so these are the checks tsc can't make.
 */
import { HABIT_STARTERS } from '@/lib/habitStarters';
import { getTranslations } from '@/lib/i18n';
import { HABIT_ICON_NAMES } from '@/components/HabitIcon';

describe('HABIT_STARTERS', () => {
  it('offers a small, non-empty set', () => {
    expect(HABIT_STARTERS.length).toBeGreaterThan(0);
    // Deliberately a handful of examples, not a wellness programme — see the file's Edit notes.
    expect(HABIT_STARTERS.length).toBeLessThanOrEqual(6);
  });

  it('uses unique keys', () => {
    const keys = HABIT_STARTERS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses only glyphs HabitIcon renders as icons (not raw emoji text)', () => {
    for (const s of HABIT_STARTERS) {
      expect(HABIT_ICON_NAMES).toContain(s.icon);
    }
  });

  it('has a daily goal of at least 1', () => {
    for (const s of HABIT_STARTERS) {
      expect(s.dailyGoal).toBeGreaterThanOrEqual(1);
    }
  });

  it.each(['en', 'no'] as const)('has a non-empty %s title for every starter', (lang) => {
    const t = getTranslations(lang);
    for (const s of HABIT_STARTERS) {
      expect(t.starters.habits.suggestions[s.key].trim()).not.toBe('');
    }
  });

  it('does not reuse the same title across two languages for every starter', () => {
    // Sanity check that the Norwegian block was actually translated rather than copied.
    const en = getTranslations('en');
    const no = getTranslations('no');
    const identical = HABIT_STARTERS.filter(
      (s) => en.starters.habits.suggestions[s.key] === no.starters.habits.suggestions[s.key]
    );
    expect(identical).toHaveLength(0);
  });
});
