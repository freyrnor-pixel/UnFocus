/**
 * onboardingFlow.test.ts — structural guards on the onboarding route graph.
 *
 * Onboarding is a chain of `router.push` calls across a handful of files, and every failure
 * mode it has is silent: a screen that nothing pushes to is simply never seen, a step missing
 * from the backdrop's STEPS list puts the tree at the wrong position, and a stale route string
 * sends a new user somewhere that no longer exists. None of that is a type error, and none of
 * it shows up unless you walk the whole flow by hand in the right language.
 *
 * **Onboarding is TWO screens as of 2026-08-03** — `basics` (what the app is, plus language)
 * then `privacy` (the local-only promise, and the Start button that finishes setup), with
 * `restore` hanging off privacy as a link rather than sitting in the walked path. It was six:
 * basics → restore → privacy → guided → energy → index. A first-time-user walkthrough found a
 * new user making roughly eighteen decisions before seeing a real screen and still not knowing
 * what the app was for. app/onboarding/{guided,energy,index}.tsx are deleted; see
 * app/onboarding/privacy.tsx's header for what happened to each one's job.
 *
 * The 2026-07-31 consolidation (language.tsx, intro.tsx and first-run.tsx folded into
 * basics.tsx) is what motivated these guards originally, and the same failure shape applies to
 * this cut — which is why the deleted-screens block simply grew three entries.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const ONBOARDING = join(ROOT, 'app', 'onboarding');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Source with block and line comments removed, for the assertions that check a name is ABSENT.
 * Every "this must not come back" scan in this repo has the same blind spot: it cannot tell a
 * call site from the header paragraph explaining why the call site was deleted, so a file that
 * documents its own history fails a rule it actually obeys. Only the absence checks need this
 * — a presence check reads better against the raw source.
 */
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** The screens under app/onboarding/, by route segment ('index' for the group's own route). */
const screenFiles = readdirSync(ONBOARDING)
  .filter((f) => f.endsWith('.tsx') && f !== '_layout.tsx')
  .map((f) => f.replace(/\.tsx$/, ''))
  .sort();

describe('the deleted screens stay deleted', () => {
  // Each of these was replaced, not moved. A file reappearing means a merge resurrected a
  // flow the app no longer routes through.
  it.each([
    'app/onboarding/language.tsx',
    'app/onboarding/intro.tsx',
    'app/first-run.tsx',
    // The 2026-08-03 cut. `guided` was the three-way "how do you want to start?" branch,
    // `energy` the Energy-vs-Rewards explainer, `index` the optional name field.
    'app/onboarding/guided.tsx',
    'app/onboarding/energy.tsx',
    'app/onboarding/index.tsx',
  ])('%s does not exist', (rel) => {
    expect(existsSync(join(ROOT, rel))).toBe(false);
  });

  it('nothing still routes to them', () => {
    const sources = [
      ...readdirSync(ONBOARDING).map((f) => join('app', 'onboarding', f)),
      'app/_layout.tsx',
      'app/settings.tsx',
      'components/TourSpotlight.tsx',
    ];
    for (const rel of sources) {
      const src = read(rel);
      // Strip the JSDoc header: these files legitimately DESCRIBE their own history, and
      // matching prose would push a later session to delete the explanation to get green.
      const code = src.startsWith('/**') ? src.slice(src.indexOf('*/') + 2) : src;
      expect(code).not.toMatch(/["'`]\/onboarding\/language["'`]/);
      expect(code).not.toMatch(/["'`]\/onboarding\/intro["'`]/);
      expect(code).not.toMatch(/["'`]\/first-run["'`]/);
      expect(code).not.toMatch(/["'`]\/onboarding\/guided["'`]/);
      expect(code).not.toMatch(/["'`]\/onboarding\/energy["'`]/);
    }
  });
});

describe('the flow is two screens', () => {
  // The cap is the point, not an accident of what has been built so far. Onboarding has been
  // ~18 screens, then 7, then 6, and every reduction was driven by the same report: it asks
  // too much before it has shown anything. `restore` is a link off privacy, not a step.
  it('has exactly basics, privacy and restore under app/onboarding/', () => {
    expect(screenFiles).toEqual(['basics', 'privacy', 'restore']);
  });

  it('basics goes to privacy, and privacy is where setup completes', () => {
    expect(read('app/onboarding/basics.tsx')).toMatch(/router\.push\('\/onboarding\/privacy'\)/);
    expect(read('app/onboarding/privacy.tsx')).toMatch(/setupComplete:\s*true/);
  });

  it('restore is reached from privacy and returns to it', () => {
    expect(read('app/onboarding/privacy.tsx')).toMatch(/router\.push\('\/onboarding\/restore'\)/);
    // Declining a restore must go BACK, not push privacy again — pushing would stack a
    // second copy of the screen the user came from.
    expect(read('app/onboarding/restore.tsx')).not.toMatch(/router\.push\('\/onboarding\/privacy'\)/);
  });
});

describe('the backdrop knows about every step', () => {
  // **STEPS no longer drives anything visual (2026-08-14).** app/onboarding/_layout.tsx used to
  // slide the `onboarding-triptych` motif by a step's position, then (2026-08-09) render it on
  // basics only; both are gone and every screen now draws the same `ScreenBackground`. What is
  // left is the structural guard: STEPS is the one written-down list of the flow's screens, so
  // pinning it to the files on disk is what catches an orphaned or unlisted onboarding route.
  // The order itself still lives in hard-coded `router.push` literals across the screens — see
  // the pushes asserted above; STEPS is a parallel list, not their source.
  const steps = (() => {
    const m = read('app/onboarding/_layout.tsx').match(/const STEPS = \[([^\]]+)\]/);
    expect(m).not.toBeNull();
    return m![1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  })();

  it('lists exactly the screens that exist, no more and no fewer', () => {
    expect([...steps].sort()).toEqual(screenFiles);
  });

  // Replaces the old "gives every step an explicit backdrop position" and "starts screen one on
  // branches, not on the blank seed panel" pair, both of which asserted properties of the
  // STEP_POSITION map that no longer exists. The invariant worth keeping is the one the
  // maintainer actually reported against: *"Introduction still shifts from one backdrop to
  // another, in no way smoothly."* A per-step backdrop is what made that possible, so the guard
  // is that the layout does not branch on which step it is drawing.
  it('draws the same backdrop on every step', () => {
    // Comments stripped first. The three names below are the ones the file's own header
    // DESCRIBES at length — that history is the most useful thing in it, and a source scan
    // that can't tell an explanation from a call site would force the header to stop naming
    // what it removed.
    const src = codeOnly(read('app/onboarding/_layout.tsx'));
    // Exactly one backdrop element, rendered unconditionally.
    expect(src.match(/<ScreenBackground\s*\/>/g)).toHaveLength(1);
    // No per-step art, and nothing to branch on. `useSegments` is the specific mechanism that
    // made the swap land mid-push: it flips at the START of the slide transition, so the old
    // screen was still visible when its backdrop was replaced.
    expect(src).not.toMatch(/useSegments/);
    expect(src).not.toMatch(/onboarding-triptych/);
    expect(src).not.toMatch(/STEP_POSITION/);
  });

  it('starts at the screen the app actually redirects new users to', () => {
    // app/_layout.tsx's guard is the entry point; if it and STEPS disagree on which screen is
    // first, the tree starts part-grown.
    expect(read('app/_layout.tsx')).toMatch(/router\.replace\('\/onboarding\/basics'\)/);
    expect(steps[0]).toBe('basics');
  });
});

describe('privacy owns the single completion path', () => {
  // The screen that finishes setup has two ways out — Start, and a successful AI export — and
  // the failure shape is the same one guided.tsx carried before it: a second hand-written
  // completion drifts from the first, and one way out stops marking setupComplete, dropping
  // the user into an app that re-runs onboarding next launch. So the guard is structural:
  // ONE write site, and every path calls it.
  const src = read('app/onboarding/privacy.tsx');
  /** Source with the JSDoc header stripped — the header legitimately describes the branches. */
  const code = src.slice(src.indexOf('*/') + 2);

  /** The body of `function <name>(…) { … }`, by brace matching (nesting-safe). */
  function bodyOf(name: string): string {
    const at = code.search(new RegExp(`function ${name}\\s*\\(`));
    expect({ fn: name, found: at >= 0 }).toEqual({ fn: name, found: true });
    const open = code.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < code.length; i += 1) {
      if (code[i] === '{') depth += 1;
      else if (code[i] === '}') {
        depth -= 1;
        if (depth === 0) return code.slice(open + 1, i);
      }
    }
    throw new Error(`unbalanced braces in ${name}`);
  }

  it('completes setup in exactly one place', () => {
    expect([...code.matchAll(/setupComplete:\s*true/g)]).toHaveLength(1);
    expect([...code.matchAll(/router\.replace\('\/'\)/g)]).toHaveLength(1);
  });

  it('that one place is finishSetup(), and it stamps lastMonthlyReset with it', () => {
    const finish = bodyOf('finishSetup');
    expect(finish).toMatch(/setupComplete:\s*true/);
    expect(finish).toMatch(/lastMonthlyReset:\s*todayStr\(\)/);
    expect(finish).toMatch(/syncReminders\(\)/);
    expect(finish).toMatch(/router\.replace\('\/'\)/);
  });

  it('the AI path hands over the file before it finishes', () => {
    const ai = bodyOf('goAiSetup');
    expect(ai).toMatch(/exportAiSetupGuide\(\)[\s\S]*finishSetup\(\)/);
    expect([...ai.matchAll(/finishSetup\(\)/g)]).toHaveLength(1);
  });

  it('a failed download reports it and leaves the user on this screen', () => {
    const ai = bodyOf('goAiSetup');
    // Both failure shapes are handled: sharing unavailable, and a thrown export.
    expect(ai).toMatch(/'unavailable'/);
    expect([...ai.matchAll(/showAppModal\(/g)].length).toBeGreaterThanOrEqual(2);
    const catchBody = ai.slice(ai.indexOf('} catch'));
    expect(catchBody).toMatch(/showAppModal\(/);
    expect(catchBody).not.toMatch(/finishSetup/);
  });

  it('the AI guide is still offered, and still as a secondary link', () => {
    // The maintainer asked for it to stay ("a small thing, but something many might find
    // useful"). What it must NOT go back to being is a peer card competing with the primary
    // action — that framing is what made a first-time user read it as expected of them.
    expect(code).toContain('t.aiSetupBtn');
    expect(code).not.toContain('<Surface');
  });
});

describe('basics asks for one thing on a fresh install', () => {
  const src = read('app/onboarding/basics.tsx');

  it('draws only the language row unless Settings asks for all of them', () => {
    // Fifteen pills across six rows, before the user knew what the app was, was the single
    // biggest "asks before it tells" finding. The other five rows all have a Settings home.
    expect(src).toMatch(/showAllRows \? BASICS_ROWS : \(\['language'\] as const\)/);
    expect(src).toMatch(/rowsParam === 'all'/);
  });

  it('says what the app is before asking anything', () => {
    expect(src).toContain('t.basics.welcomeTitle');
    expect(src).toContain('t.basics.welcomeSub');
  });

  it('Settings re-run still gets the full six rows', () => {
    expect(read('app/settings.tsx')).toMatch(/router\.push\('\/onboarding\/basics\?rows=all'\)/);
  });

  it('still commits every row atomically, including the ones it did not draw', () => {
    // The hidden rows commit at their seeded (= current) values, so settingsPatchFromPicks
    // keeps its round-trip contract and firstRunComplete cannot land without them.
    expect(src).toMatch(/settings\.update\(settingsPatchFromPicks\(final\)\)/);
  });
});
