/**
 * prefill.test.ts — a note sent somewhere lands in the right field (2026-08-12).
 *
 * lib/prefill.ts carries the text from a note's ⋯ → Send it to… to the add row of whatever
 * surface the user picked. Three of its four targets are a screen each, so the route alone
 * addressed them. Goals stopped being one when app/goals.tsx — a second implementation of
 * components/GoalsEditor.tsx — was retired: its editor is a drawer on the Habits tab, which
 * already consumes a prefill for its own habit composer.
 *
 * That makes the slot the load-bearing part, and its failure mode is silent in a way nothing
 * else in this module is: the wrong consumer taking the text doesn't throw, doesn't look
 * broken, and doesn't lose the words — it files the user's note as a HABIT named after the
 * goal they meant to set. Worse, the taking consumer also CLEARS the param, so the right one
 * never sees it. Neither half shows up in a screenshot.
 *
 * Testing the two pure pieces rather than the hook: this repo has no hook renderer (no
 * @testing-library/react-hooks, no react-test-renderer), which is exactly the situation
 * AGENTS.md's "split the arithmetic out into a pure function and test that" note describes.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PREFILL_PARAM, PREFILL_SLOT_PARAM, prefillIsFor, prefillRoute } from '@/lib/prefill';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('prefillRoute', () => {
  it('sends the three screen-shaped targets to their own tab, unslotted', () => {
    for (const [target, pathname] of [
      ['todo', '/(tabs)/plans'],
      ['shopping', '/(tabs)/shopping'],
      ['habits', '/(tabs)/habits'],
    ] as const) {
      const route = prefillRoute(target, 'milk');
      expect(route.pathname).toBe(pathname);
      expect(route.params[PREFILL_PARAM]).toBe('milk');
      expect(route.params).not.toHaveProperty(PREFILL_SLOT_PARAM);
    }
  });

  it('sends Goals to the Habits tab, in its own slot', () => {
    const route = prefillRoute('goals', 'Less time on my phone');
    expect(route.pathname).toBe('/(tabs)/habits');
    expect(route.params[PREFILL_PARAM]).toBe('Less time on my phone');
    expect(route.params[PREFILL_SLOT_PARAM]).toBe('goals');
  });

  it('puts Goals and Habits on the same route — which is why the slot exists', () => {
    expect(prefillRoute('goals', 'x').pathname).toBe(prefillRoute('habits', 'x').pathname);
  });
});

describe('prefillIsFor', () => {
  it('gives an unslotted prefill to the screen’s own composer', () => {
    expect(prefillIsFor(undefined)).toBe(true);
    expect(prefillIsFor('')).toBe(true);
  });

  it('does NOT give an unslotted prefill to a slotted consumer', () => {
    expect(prefillIsFor(undefined, 'goals')).toBe(false);
    expect(prefillIsFor('', 'goals')).toBe(false);
  });

  it('does NOT give a slotted prefill to the screen’s own composer — the habit-named-after-a-goal case', () => {
    expect(prefillIsFor('goals')).toBe(false);
  });

  it('gives a slotted prefill to the consumer that asked for that slot', () => {
    expect(prefillIsFor('goals', 'goals')).toBe(true);
  });

  it('treats an unknown slot as addressed to nobody', () => {
    // A route param is a string from outside; a build that no longer has the surface a slot
    // names must not fall back to "well, the default composer then".
    expect(prefillIsFor('someRetiredSurface')).toBe(false);
    expect(prefillIsFor('someRetiredSurface', 'goals')).toBe(false);
  });
});

describe('the Habits tab hosts both consumers', () => {
  const habits = read('app/(tabs)/habits.tsx');

  it('asks for the two prefills separately', () => {
    // The habit quick-add takes the unslotted one; the Goals drawer takes the `goals` slot.
    // If this ever collapses back to a single usePrefill() call, a goal becomes a habit.
    expect(habits).toMatch(/usePrefill\(\)/);
    expect(habits).toMatch(/usePrefill\('goals'\)/);
  });

  it('opens the drawer around the field it seeds', () => {
    // Seeding a field two levels inside a closed drawer would put the note somewhere the user
    // cannot see it — the same reason AddRow takes an `expandSignal`.
    expect(habits).toMatch(/openSignal=\{goalPrefill\}/);
    expect(habits).toMatch(/<GoalsEditor[^>]*prefill=\{goalPrefill\}/s);
  });
});

describe('the retired Goals screen', () => {
  it('is not reachable by route any more', () => {
    // app/goals.tsx duplicated components/GoalsEditor.tsx's list, add row, starter chips and
    // delete confirm. Nothing may route to it, and prefillRoute is where that would creep back.
    expect(read('lib/prefill.ts')).not.toMatch(/'\/goals'/);
  });

  it('is not offered as a send-to target while Goals is switched off', () => {
    // Picking a target ticks the note off, so offering a destination that isn't mounted would
    // consume the note into nothing.
    expect(read('components/SendToSheet.tsx')).toMatch(/featureGoals\s*\?/);
  });
});
