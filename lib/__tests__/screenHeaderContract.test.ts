/**
 * screenHeaderContract.test.ts — every screen's top bar carries the same chrome (addendum B.4).
 *
 * `components/ScreenHeader.tsx` is the one header implementation, but WHICH icons it draws is
 * decided entirely by the props each screen hands `components/ScreenScaffold.tsx`. Nothing
 * forces two tabs to agree: a screen that simply forgets `onInfoToggle` loses its ⓘ, a
 * sub-screen declared `tier="site"` silently grows a Settings gear (and its own BottomNav),
 * and neither is a type error or a visible failure in review. That is exactly what had
 * happened to app/notes.tsx — a site header on a screen that stopped being a tab.
 *
 * ── WHAT THIS TEST DOES AND DOES NOT COVER ────────────────────────────────────────────────
 * It asserts the **prop contract in source**, not rendered output. There is no renderer in
 * this project's devDependencies (no react-test-renderer / @testing-library/react-native, and
 * `testEnvironment: 'node'`), and adding one is out of scope here, so a render assertion would
 * have to be faked. Instead this reads two things and checks they line up:
 *
 *   (a) ScreenHeader's own gating expressions — which prop or piece of state each icon hangs
 *       off (`const scanButton = onScanPress ? …`), and that the gear is unconditional on
 *       site tier while every debug icon is behind `debugModeEnabled`.
 *   (b) The props every screen actually passes to ScreenScaffold, parsed out of the JSX
 *       opening tag.
 *
 * Together those pin "Shopping is the only tab with a camera", "Home is the only tab that can
 * show the cloud", "no sub-screen grows chrome". They do NOT pin: pixel output, icon ORDER in
 * the control group, the left-handed mirroring, the runtime OTA state that decides whether the
 * cloud icon is actually on screen, or anything about a header rendered outside ScreenScaffold.
 * Precedent for reading source in a test: lib/__tests__/designTokens.test.ts and
 * __tests__/onboardingFlow.test.ts.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** Source with its leading JSDoc header stripped — those blocks legitimately DESCRIBE the
 *  history ("used to be tier='site'"), and matching prose would push a later session to
 *  delete the explanation to get the test green. Same guard __tests__/onboardingFlow.test.ts
 *  uses. */
function code(rel: string): string {
  const src = read(rel);
  return src.startsWith('/**') ? src.slice(src.indexOf('*/') + 2) : src;
}

/**
 * Every `<ScreenScaffold …>` opening tag in a file, as raw text. Scans forward from the tag
 * name tracking `{}` depth, so a `>` inside an arrow-function prop (`onPress={() => …}`) can't
 * be mistaken for the end of the tag. Screens like app/scan.tsx and app/budget.tsx mount more
 * than one scaffold, and each has to satisfy the contract on its own.
 */
function scaffoldTags(rel: string): string[] {
  const src = code(rel);
  const tags: string[] = [];
  const marker = '<ScreenScaffold';
  let from = 0;
  for (;;) {
    const start = src.indexOf(marker, from);
    if (start === -1) break;
    let depth = 0;
    let i = start + marker.length;
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
    }
    tags.push(src.slice(start, i + 1));
    from = i + 1;
  }
  return tags;
}

/** Does this opening tag pass the named prop at all? (`prop=` or a bare boolean `prop`.) */
function passes(tag: string, prop: string): boolean {
  return new RegExp(`(^|[\\s{])${prop}(=|[\\s/>])`).test(tag);
}

/** The `tier` literal on a scaffold tag. */
function tierOf(tag: string): string | null {
  const m = tag.match(/\btier=["']([a-z]+)["']/);
  return m ? m[1] : null;
}

// The five top-level tabs, in the real `<TopTabs.Screen>` order from app/(tabs)/_layout.tsx.
// Order matters nowhere in these assertions, but keeping it means a reader can check this list
// against the navigator without re-deriving it.
const TAB_SCREENS = [
  'app/(tabs)/shopping.tsx',
  'app/(tabs)/plans.tsx',
  'app/(tabs)/index.tsx',
  'app/(tabs)/habits.tsx',
  'app/(tabs)/health.tsx',
] as const;

// Pushed sub-screens that are pure content: reached from a tab by a link/button, and whose
// header is a title (plus the iOS back link ScreenScaffold adds for tier='sub') and nothing
// else. Not the whole sub-screen set — the form/editor screens legitimately carry a
// `headerRight` save/delete action, which is a different contract.
const SUB_SCREENS = [
  'app/food.tsx',
  'app/catalogue.tsx',
  'app/notes.tsx',
  'app/budget.tsx',
  'app/scan.tsx',
  'app/health-log.tsx',
] as const;

/** Header chrome a sub-screen must not ask for. `tier` and `onBack` are legitimate. */
const SITE_ONLY_PROPS = ['isHome', 'infoActive', 'onInfoToggle', 'onSharePress', 'onScanPress', 'onLayoutPress'] as const;

// ── (a) ScreenHeader's own gating ────────────────────────────────────────────────────────

describe('ScreenHeader gates each icon off exactly one thing', () => {
  const header = code('components/ScreenHeader.tsx');

  test('the settings gear is unconditional — every site-tier header has one', () => {
    // Declared with no `? :` guard, and included in the site-tier control group. If someone
    // ever makes the gear conditional, "every tab has a gear" stops being true by construction
    // and this whole file's premise needs revisiting.
    expect(header).toMatch(/const gearButton = \(/);
    expect(header).toMatch(/const siteControls = tier === 'site'/);
    expect(header).toMatch(/gearButton\]\.filter\(Boolean\)/);
  });

  test.each([
    ['scanButton', 'onScanPress'],
    ['shareButton', 'onSharePress'],
    ['layoutButton', 'onLayoutPress'],
  ])('%s renders only when the screen passes %s', (button, prop) => {
    expect(header).toMatch(new RegExp(`const ${button} = ${prop} \\? \\(`));
  });

  test('the OTA cloud icon needs BOTH Home and an update actually being ready', () => {
    expect(header).toMatch(/const updateButton = isHome && updateAvailable \? \(/);
    // `updateAvailable` is the live expo-updates state, not a prop a screen can force on.
    expect(header).toMatch(/const updateAvailable = isUpdateAvailable \|\| isUpdatePending/);
  });

  test.each(['bugButton', 'emailButton', 'deleteButton'])(
    '%s renders only while debug mode is on',
    (button) => {
      expect(header).toMatch(new RegExp(`const ${button} = debugModeEnabled \\? \\(`));
    },
  );

  test('sub-tier headers get no control group at all', () => {
    // siteControls is empty off site tier, so ⓘ/gear/camera/cloud/debug can never appear on a
    // sub-screen even if a caller passes their props by mistake.
    expect(header).toMatch(/const siteControls = tier === 'site'\s*\?[\s\S]*?:\s*\[\];/);
  });
});

// ── (b) What each screen asks for ────────────────────────────────────────────────────────

describe('every top-level tab header is title + gear', () => {
  test.each(TAB_SCREENS)('%s is site tier', (rel) => {
    const tags = scaffoldTags(rel);
    expect(tags).toHaveLength(1);
    expect(tierOf(tags[0])).toBe('site');
  });

  // ⓘ REMOVED 2026-08-13. Maintainer: "Having the info button in the header section with
  // settings showing when you press it makes No sense. Instead the instructions should be in
  // the screen with examples like a introduction part (users can of course close the card)."
  // These two assertions replace "%s passes the ⓘ hint toggle" and are its mirror image: the
  // header must NOT offer the prop, and the screen must render the thing that replaced it.
  test.each(TAB_SCREENS)('%s passes no ⓘ props — the header has none to take', (rel) => {
    const tag = scaffoldTags(rel)[0];
    expect(passes(tag, 'onInfoToggle')).toBe(false);
    expect(passes(tag, 'infoActive')).toBe(false);
  });

  test('ScreenHeader has no info button left to wire', () => {
    // `code()` (not `read()`) so ScreenHeader's own header — which explains that the ⓘ was
    // removed, and names both identifiers to say so — can't fail this. Deleting an explanation
    // must never be the cheapest way to green; that is what `code()` exists for.
    const headerSrc = code('components/ScreenHeader.tsx');
    expect(headerSrc).not.toMatch(/const infoButton\s*=/);
    expect(headerSrc).not.toMatch(/onInfoToggle/);
  });

  test.each(TAB_SCREENS)('%s renders a dismissible intro card instead', (rel) => {
    // `noPill` + `onDismiss` together are the intro card; `noPill` alone was the old
    // header-driven body, which had no way to close itself.
    const src = read(rel);
    expect(src).toMatch(/<HintCard[\s\S]{0,400}noPill/);
    expect(src).toMatch(/<HintCard[\s\S]{0,400}onDismiss=\{dismissHint\}/);
  });

  test('Shopping is the only tab with the camera', () => {
    const withScan = TAB_SCREENS.filter((rel) => passes(scaffoldTags(rel)[0], 'onScanPress'));
    expect(withScan).toEqual(['app/(tabs)/shopping.tsx']);
  });

  test('Home is the only tab that can show the OTA cloud', () => {
    const withHome = TAB_SCREENS.filter((rel) => passes(scaffoldTags(rel)[0], 'isHome'));
    expect(withHome).toEqual(['app/(tabs)/index.tsx']);
  });

  test('the two list-bearing tabs are the only ones with the extra list controls', () => {
    // DELIBERATE deviation from a flat "ⓘ + gear everywhere", left in place on purpose:
    //   • the layout icon opens that surface's own LayoutPickerSheet, and the whole point of
    //     it living on the header is that the choice is made while looking at the list it
    //     changes (the global default is in Settings → Personal → Layout);
    //   • the share icon is gated on `settings.featureSharing`, which is OFF for a fresh
    //     install — a default header never shows it.
    // Pinned here rather than deleted so the set can't quietly grow to a third screen.
    const withLayout = TAB_SCREENS.filter((rel) => passes(scaffoldTags(rel)[0], 'onLayoutPress'));
    const withShare = TAB_SCREENS.filter((rel) => passes(scaffoldTags(rel)[0], 'onSharePress'));
    expect(withLayout).toEqual(['app/(tabs)/shopping.tsx', 'app/(tabs)/plans.tsx']);
    expect(withShare).toEqual(['app/(tabs)/shopping.tsx', 'app/(tabs)/plans.tsx']);
  });

  test('no tab hand-rolls a headerRight slot', () => {
    // Site tier ignores headerRight entirely (it's a sub-tier affordance), so passing one is
    // dead code that reads like a shipped affordance.
    for (const rel of TAB_SCREENS) {
      expect(passes(scaffoldTags(rel)[0], 'headerRight')).toBe(false);
    }
  });
});

describe('pushed sub-screens are title only', () => {
  test.each(SUB_SCREENS)('%s mounts only sub-tier scaffolds', (rel) => {
    const tags = scaffoldTags(rel);
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) expect(tierOf(tag)).toBe('sub');
  });

  test.each(SUB_SCREENS)('%s asks for no site-tier chrome', (rel) => {
    for (const tag of scaffoldTags(rel)) {
      const asked = SITE_ONLY_PROPS.filter((p) => passes(tag, p));
      expect(asked).toEqual([]);
    }
  });

  test.each(SUB_SCREENS)('%s adds no headerRight action either', (rel) => {
    // These six are read/browse screens; their editors (habit-form, medicine-form, …) are the
    // ones that legitimately carry a save/delete action, and are deliberately not in this list.
    for (const tag of scaffoldTags(rel)) expect(passes(tag, 'headerRight')).toBe(false);
  });

  test('app/notes.tsx does not drift back to site tier', () => {
    // It was tier='site' from Decision 001, kept it after Decision 036 dropped Notes as a tab,
    // and so carried a Settings gear + its own BottomNav while being reached by a router.push
    // from Home — the violation that motivated this file. See that screen's edit notes.
    expect(tierOf(scaffoldTags('app/notes.tsx')[0])).toBe('sub');
    expect(scaffoldTags('app/notes.tsx')[0]).toMatch(/onBack=/);
  });
});
