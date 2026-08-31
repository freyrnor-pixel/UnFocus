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

  it('sends Goals to its own pop-up, still in its own slot', () => {
    // ⚠️ **Was `/(tabs)/habits` until 2026-09-01**, because the Goals editor was a folded section
    // inside that tab's card. That section is deleted — goal editing is reached from the goal
    // picker's own "Edit goals" row — so the old route would have dropped the note's text while
    // still ticking the note off, which is the exact failure `SendToSheet` hides this target for
    // when the feature is switched off.
    const route = prefillRoute('goals', 'Less time on my phone');
    expect(route.pathname).toBe('/goals-editor');
    expect(route.params[PREFILL_PARAM]).toBe('Less time on my phone');
    expect(route.params[PREFILL_SLOT_PARAM]).toBe('goals');
  });

  it('keeps the slot even though Goals now has a route to itself', () => {
    // The slot no longer separates Goals from a co-located habit composer — nothing else lives
    // on `/goals-editor`. It stays because `usePrefill(slot)` is what makes a prefill ADDRESSED
    // rather than ambient: an unslotted prefill is given to a screen's own composer, so dropping
    // the slot here would hand a goal's text to whatever composer that route grows next.
    expect(prefillRoute('goals', 'x').pathname).not.toBe(prefillRoute('habits', 'x').pathname);
    expect(prefillRoute('goals', 'x').params[PREFILL_SLOT_PARAM]).toBe('goals');
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

describe('the two prefill consumers are on two routes now', () => {
  // ⚠️ **Was "the Habits tab hosts both consumers" until 2026-09-01.** The Goals editor was a
  // folded section inside the Habits card, so that one screen took the unslotted prefill for its
  // habit quick-add AND the `goals` slot for the editor — and the slot existed precisely to keep
  // them apart. The section is deleted (goal editing is reached from the goal picker's own "Edit
  // goals" row), so Goals has a route to itself and the two consumers are one file apart.
  const habits = read('components/HabitsSurface.tsx');
  const goalsPopup = read('app/goals-editor.tsx');

  it('leaves the Habits tab with only its own habit composer', () => {
    // The unslotted prefill is the habit quick-add's. If a `usePrefill('goals')` ever reappears
    // here, the editor is being mounted in two places again — which is what this whole pass
    // removed.
    expect(habits).toMatch(/usePrefill\(\)/);
    expect(habits).not.toMatch(/usePrefill\('goals'\)/);
  });

  it('seeds the editor from the pop-up that now owns it', () => {
    // What has to be true is unchanged from when this lived on Habits: the text reaches the
    // editor, and `AddRow`'s own `expandSignal` puts it on screen inside it. Only the host moved.
    expect(goalsPopup).toMatch(/usePrefill\('goals'\)/);
    expect(goalsPopup).toMatch(/<GoalsEditor[^>]*prefill=\{prefill\}/s);
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
