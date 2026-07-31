/**
 * onboardingFlow.test.ts — structural guards on the onboarding route graph.
 *
 * Onboarding is a chain of `router.push` calls across seven files, and every failure mode it
 * has is silent: a screen that nothing pushes to is simply never seen, a step missing from the
 * backdrop's STEPS list puts the tree at the wrong position, and a stale route string sends a
 * new user somewhere that no longer exists. None of that is a type error, and none of it shows
 * up unless you walk the whole flow by hand in the right language.
 *
 * The 2026-07-31 consolidation is what motivated these: app/onboarding/language.tsx,
 * app/onboarding/intro.tsx and app/first-run.tsx were deleted and their work folded into
 * app/onboarding/basics.tsx, which left several route strings pointing at nothing.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const ONBOARDING = join(ROOT, 'app', 'onboarding');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

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
  ])('%s does not exist', (rel) => {
    expect(existsSync(join(ROOT, rel))).toBe(false);
  });

  it('nothing still routes to them', () => {
    const sources = [
      ...readdirSync(ONBOARDING).map((f) => join('app', 'onboarding', f)),
      'app/_layout.tsx',
      'app/settings.tsx',
    ];
    for (const rel of sources) {
      const src = read(rel);
      // Strip the JSDoc header: these files legitimately DESCRIBE their own history, and
      // matching prose would push a later session to delete the explanation to get green.
      const code = src.startsWith('/**') ? src.slice(src.indexOf('*/') + 2) : src;
      expect(code).not.toMatch(/["'`]\/onboarding\/language["'`]/);
      expect(code).not.toMatch(/["'`]\/onboarding\/intro["'`]/);
      expect(code).not.toMatch(/["'`]\/first-run["'`]/);
    }
  });
});

describe('the backdrop knows about every step', () => {
  // app/onboarding/_layout.tsx slides the triptych by a step's position in STEPS. A screen
  // missing from that list silently falls back to position 0, so the tree jumps backwards to
  // the seed on that screen and forwards again on the next one.
  const steps = (() => {
    const m = read('app/onboarding/_layout.tsx').match(/const STEPS = \[([^\]]+)\]/);
    expect(m).not.toBeNull();
    return m![1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  })();

  it('lists exactly the screens that exist, no more and no fewer', () => {
    expect([...steps].sort()).toEqual(screenFiles);
  });

  it('starts at the screen the app actually redirects new users to', () => {
    // app/_layout.tsx's guard is the entry point; if it and STEPS disagree on which screen is
    // first, the tree starts part-grown.
    expect(read('app/_layout.tsx')).toMatch(/router\.replace\('\/onboarding\/basics'\)/);
    expect(steps[0]).toBe('basics');
  });
});

describe('every screen is reachable, and the chain ends at the app', () => {
  const pushesIn = (segment: string): string[] => {
    const src = read(join('app', 'onboarding', `${segment}.tsx`));
    return [...src.matchAll(/router\.(?:push|replace)\('\/onboarding\/([a-z-]+)'\)/g)].map((m) => m[1]);
  };

  it('every screen except the first is pushed to by another screen', () => {
    const pushed = new Set(screenFiles.flatMap(pushesIn));
    for (const segment of screenFiles) {
      // 'basics' is entered by the guard, and 'index' by a push to '/onboarding' (no segment),
      // so neither appears as a '/onboarding/<segment>' target.
      if (segment === 'basics' || segment === 'index') continue;
      expect({ segment, pushed: pushed.has(segment) }).toEqual({ segment, pushed: true });
    }
  });

  it('both exits from the guided choice land on the tabs, not on a removed step', () => {
    // The Explore path and the name step's finish() both used to route via /first-run.
    for (const rel of ['app/onboarding/guided.tsx', 'app/onboarding/index.tsx']) {
      expect(read(rel)).toMatch(/router\.replace\('\/'\)/);
    }
  });
});
