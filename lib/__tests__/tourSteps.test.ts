/**
 * tourSteps.test.ts — the guided tour's two structural promises, plus the wiring a diff can't show.
 *
 * The tour is the thing a brand-new user meets first, and its failure modes are all quiet:
 * a step whose target id doesn't match any <TourTarget> points at nothing and is skipped, a
 * step missing its copy renders blank, and a progress model keyed by index instead of id would
 * silently re-show or strand steps whenever the list changed.
 *
 * The two promises, which the rest of the app's design rests on too:
 *   - **Every step is skippable**, individually and as a whole, and a skipped step is
 *     indistinguishable from a finished one afterwards. There is no "you left this unfinished"
 *     state anywhere in this app (see habits' no-broken-streak rule, goals flooring at neutral,
 *     medicine trays reading "still due" rather than "missed").
 *   - **Progress is a SET of ids, not a cursor.** Reordering or removing a step must not strand
 *     anyone mid-tour.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  TOUR_DISMISSED,
  TOUR_STEPS,
  formatProgress,
  isTourComplete,
  nextStep,
  parseProgress,
  stepPosition,
} from '@/lib/tourSteps';

const ROOT = join(__dirname, '..', '..');
const allIds = TOUR_STEPS.map((s) => s.id);

describe('the step list is coherent', () => {
  test('ids and target ids are unique', () => {
    expect(new Set(allIds).size).toBe(TOUR_STEPS.length);
    expect(new Set(TOUR_STEPS.map((s) => s.targetId)).size).toBe(TOUR_STEPS.length);
  });

  test('no step id collides with the dismissed sentinel', () => {
    // A step literally called "dismissed" would end the tour the moment it was completed.
    expect(allIds).not.toContain(TOUR_DISMISSED);
  });

  test('every route is a real tab', () => {
    // These are the three pager routes in app/(tabs)/ — health→plans, same-day "full-screen
    // card expansion" pass. A typo here sends the tour to a screen that never mounts the
    // target, so the step waits forever — and a PUSHED route would be worse than a typo,
    // since it mounts and then traps.
    const tabPaths = ['/', '/shopping', '/plans'];
    for (const s of TOUR_STEPS) expect(tabPaths).toContain(s.route);
  });

  test('stepPosition is 1-based and 0 for an unknown id', () => {
    expect(stepPosition(TOUR_STEPS[0].id)).toBe(1);
    expect(stepPosition(TOUR_STEPS[TOUR_STEPS.length - 1].id)).toBe(TOUR_STEPS.length);
    expect(stepPosition('nope')).toBe(0);
  });
});

describe('progress is a set of ids, not a cursor', () => {
  test('round-trips through the stored string', () => {
    const done = new Set(['plans', 'home']);
    expect(parseProgress(formatProgress(done))).toEqual(done);
  });

  test('formatting is stable, so an unchanged set writes an identical string', () => {
    expect(formatProgress(new Set(['b', 'a']))).toBe(formatProgress(new Set(['a', 'b'])));
  });

  test('an empty or absent value means nothing done', () => {
    for (const raw of ['', null, undefined, '  ', ',,']) {
      expect(parseProgress(raw).size).toBe(0);
    }
  });

  test('an id from a build that no longer has that step is kept, not dropped', () => {
    // Removing a step shouldn't erase the record that it was completed — it may come back.
    const done = parseProgress('home,some-old-step');
    expect(done.has('some-old-step')).toBe(true);
  });
});

describe('the tour always advances, and can always be left', () => {
  test('walking it start to finish visits every step exactly once, in order', () => {
    const done = new Set<string>();
    const seen: string[] = [];
    for (let guard = 0; guard < 50; guard++) {
      const s = nextStep(done);
      if (!s) break;
      seen.push(s.id);
      done.add(s.id);
    }
    expect(seen).toEqual(allIds);
    expect(nextStep(done)).toBeNull();
    expect(isTourComplete(done)).toBe(true);
  });

  test('skipping any single step still finishes the rest', () => {
    for (const skipped of allIds) {
      const done = new Set([skipped]);
      const seen: string[] = [];
      for (let guard = 0; guard < 50; guard++) {
        const s = nextStep(done);
        if (!s) break;
        seen.push(s.id);
        done.add(s.id);
      }
      // The skipped step is never revisited, and everything else still gets its turn.
      expect(seen).not.toContain(skipped);
      expect(new Set([...seen, skipped])).toEqual(new Set(allIds));
      expect(isTourComplete(done)).toBe(true);
    }
  });

  test('dismissing ends it from any point, with no step left pending', () => {
    for (const partial of [[], [allIds[0]], allIds.slice(0, 3)]) {
      const done = new Set([...partial, TOUR_DISMISSED]);
      expect(nextStep(done)).toBeNull();
      expect(isTourComplete(done)).toBe(true);
    }
  });
});

describe('every step is actually wired up', () => {
  const screens = readdirSync(join(ROOT, 'app', '(tabs)'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => readFileSync(join(ROOT, 'app', '(tabs)', f), 'utf8'))
    .join('\n');

  test('each targetId has a matching <TourTarget> on a tab screen', () => {
    // A step whose target never renders points at nothing and is silently skipped at runtime —
    // no crash, no warning, just a step the user never sees.
    for (const s of TOUR_STEPS) {
      expect({ id: s.id, wired: screens.includes(`<TourTarget id="${s.targetId}"`) }).toEqual({
        id: s.id,
        wired: true,
      });
    }
  });

  /**
   * ⚠️ **A target has to wrap ONE named element, never a fragment (2026-09-09).**
   *
   * The test above passed for weeks while the Shopping step pointed at nothing: its
   * `<TourTarget id="tour.shopping.list">` wrapped a `<>` fragment whose every child was
   * conditional, and two separate deletions (the first-run banner, then the last hint card)
   * emptied it out until it measured 0×0 on a fresh install. components/TourTarget.tsx refuses
   * to register a zero-size rect, so the step had no target, and the tour stopped dead on step 2
   * of 3 — reported as *"Onboarding only shows 1 of 3"* and *"Starts fresh at Shopping"*.
   *   A fragment is the shape that lets that happen silently, because it has no size of its own
   * and nothing about deleting a child of it looks like deleting a tour target. Wrapping a named
   * element instead means the target is exactly as present as the thing it is pointing at.
   */
  test('no target wraps a bare fragment', () => {
    const offenders = [...screens.matchAll(/<TourTarget id="([^"]+)"[^>]*>\s*(<>|\{)/g)].map(
      (m) => m[1],
    );
    expect(offenders).toEqual([]);
  });

  test('each step has copy in EVERY language', () => {
    // `no: typeof en` / `is: typeof en` catch a missing key at compile time, but not a step id
    // with no entry at all — t.tour.steps is indexed dynamically by step id.
    // Bump LANGS when a dictionary is added to lib/i18n.ts (en + no + is as of 2026-08-15).
    const LANGS = 3;
    const i18n = readFileSync(join(ROOT, 'lib', 'i18n.ts'), 'utf8');
    for (const id of allIds) {
      const occurrences = i18n.split(`      ${id}: {`).length - 1;
      expect({ id, langs: occurrences }).toEqual({ id, langs: LANGS });
    }
  });
});
