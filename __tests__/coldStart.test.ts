/**
 * coldStart.test.ts — structural guards on what the app does BEFORE it is on screen.
 *
 * Cold start is the one path every user takes every time, and each of the regressions below
 * was invisible in a screenshot: they're about how long the user waits and how many screens
 * they wait through, not about what any single frame looks like. app/_layout.tsx can't be
 * imported in Jest (it pulls expo-splash-screen, expo-updates and the whole store layer), so
 * these are read as source contracts — the same approach lib/__tests__/cardLayout.test.ts
 * uses to keep layouts from reaching the store layer.
 *
 * The watermark block is here for a related reason: the mark is drawn from Android's
 * *monochrome themed icon*, a near-white silhouette the OS is expected to tint. Drawn
 * untinted it is invisible on a light surface at any opacity — a bug you cannot see by
 * looking at the light theme, because there is simply nothing there to look at.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Source with the file's leading JSDoc header stripped. These files document their own
 * history, so the header legitimately NAMES the things the code must no longer do ("this
 * used to mount WelcomeReveal", "Tier B, deferred via runAfterInteractions"). Matching
 * against the header would make the prose fail the test and, worse, would push a later
 * session to delete the explanation to get green.
 */
const readCode = (rel: string) => {
  const src = read(rel);
  const headerEnd = src.startsWith('/**') ? src.indexOf('*/') + 2 : 0;
  return src.slice(headerEnd);
};

describe('launch is one screen, not two', () => {
  // The native splash already shows the brand. A JS-rendered brand screen after it is a
  // duplicate the user sits through on every single launch — reported by the maintainer as
  // "two screens before I land in home". WelcomeReveal ran a fixed ~1.5s timeline showing
  // the same tree the splash had just shown.
  it('has no WelcomeReveal component', () => {
    expect(existsSync(join(ROOT, 'components/WelcomeReveal.tsx'))).toBe(false);
  });

  it('the root layout does not mount a brand-reveal overlay', () => {
    const layout = readCode('app/_layout.tsx');
    expect(layout).not.toMatch(/import\s+WelcomeReveal/);
    expect(layout).not.toMatch(/<WelcomeReveal/);
    expect(layout).not.toMatch(/showWelcome/);
  });

  it('drops the reveal-only i18n keys from both languages', () => {
    const i18n = read('lib/i18n.ts');
    expect(i18n).not.toMatch(/welcomeHeading/);
    expect(i18n).not.toMatch(/welcomeTagline/);
  });
});

describe('the launch gate only waits on what first paint needs', () => {
  const layout = read('app/_layout.tsx');

  // Fonts and hydrated settings are real prerequisites: the first frame draws text, and the
  // onboarding-vs-home decision needs settings. A decoded PNG is not — it used to hold the
  // splash for up to 1.5s (its own timeout floor) so a decorative watermark wouldn't fade in.
  it('gates rendering on fonts and settings only', () => {
    const gate = layout.match(/const appReady = ([^;]+);/);
    expect(gate).not.toBeNull();
    const expr = gate![1];
    expect(expr).toMatch(/fontsLoaded/);
    expect(expr).toMatch(/loaded/);
    expect(expr).not.toMatch(/assets/i);
  });

  it('still warms the bundled images, just without blocking on them', () => {
    expect(layout).toMatch(/Asset\.loadAsync/);
    // The old shape: a settle flag + a timeout floor feeding the gate above.
    expect(layout).not.toMatch(/assetsReady/);
    expect(layout).not.toMatch(/assetTimeout/);
  });

  // A new user's destination isn't known until the onboarding redirect lands. The Stack's
  // initial route is the tabs, so revealing on `appReady` alone would flash a frame of Home
  // at someone who has never opened the app. WelcomeReveal used to mask that window.
  it('holds the splash until the destination route is settled', () => {
    expect(layout).toMatch(/routeSettled/);
    const reveal = layout.match(/const canReveal = ([^;]+);/);
    expect(reveal).not.toBeNull();
    expect(reveal![1]).toMatch(/routeSettled/);
    expect(layout).toMatch(/SplashScreen\.hideAsync/);
  });

  // A splash that never hides is an app that never opens, and this ships OTA to installs we
  // can't debug or roll back individually. Whatever conditions gate the reveal, a timer must
  // be able to override them — the failure mode of revealing too early is cosmetic, the
  // failure mode of never revealing is a dead app.
  it('reveals on a timer even if the gates never clear', () => {
    const reveal = layout.match(/const canReveal = ([^;]+);/)![1];
    expect(reveal).toMatch(/failsafeElapsed/);
    expect(layout).toMatch(/setTimeout\(\(\) => setFailsafeElapsed\(true\), SPLASH_FAILSAFE_MS\)/);
    const ms = read('app/_layout.tsx').match(/SPLASH_FAILSAFE_MS = (\d+)/);
    expect(ms).not.toBeNull();
    expect(Number(ms![1])).toBeGreaterThan(0);
    expect(Number(ms![1])).toBeLessThanOrEqual(5000);
  });
});

describe('boot work that first paint does not read is deferred', () => {
  const layout = readCode('app/_layout.tsx');
  const tierB = layout.indexOf('runAfterInteractions');

  it('defers the InteractionManager block at all', () => {
    expect(tierB).toBeGreaterThan(-1);
  });

  // Both are pure background work: nothing painted draws a tombstone, and scheduling a
  // monthly reminder is a native call the foreground handler re-runs anyway. Keeping them in
  // the synchronous boot tick made every cold start wait on them.
  it.each(['loadDeleted()', 'syncMonthlyTaskNotifications()'])(
    'runs %s in Tier B, not the blocking boot tick',
    (call) => {
      const first = layout.indexOf(call);
      expect(first).toBeGreaterThan(-1);
      expect(first).toBeGreaterThan(tierB);
    },
  );

  // The stores backing the first screens must stay synchronous — deferring these would trade
  // a faster splash-hide for content visibly popping in after it.
  it.each(['useTaskStore.getState().load()', 'useNotesStore.getState().load()'])(
    'keeps %s in the synchronous boot tick',
    (call) => {
      expect(layout.indexOf(call)).toBeLessThan(tierB);
    },
  );
});

describe('the tree watermark is always tinted', () => {
  // assets/android-icon-monochrome.png is ~white on transparency. Untinted it disappears into
  // any light surface no matter what opacity it is given, which is why raising SectionDivider's
  // mark from 0.14 to 0.3 (2026-07-27) didn't fix the divider reading as two disconnected
  // hairlines — opacity was never the variable.
  const CALLERS = ['components/SectionDivider.tsx', 'app/onboarding/_layout.tsx'];

  it.each(CALLERS)('%s passes a tintColor to every TreeWatermark it renders', (rel) => {
    const tags = read(rel).match(/<TreeWatermark[\s\S]*?\/>/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) expect(tag).toMatch(/tintColor=/);
  });

  it('finds no untinted call site anywhere else', () => {
    // If a new caller appears, it belongs in CALLERS above — with a tintColor.
    const found = ['components', 'app']
      .flatMap((dir) => walk(join(ROOT, dir)))
      .filter((abs) => !abs.endsWith('TreeWatermark.tsx'))
      .filter((abs) => readFileSync(abs, 'utf8').includes('<TreeWatermark'))
      .map((abs) => abs.slice(ROOT.length + 1));
    expect(found.sort()).toEqual([...CALLERS].sort());
  });
});

/** Every .tsx under `dir`, recursively. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}
