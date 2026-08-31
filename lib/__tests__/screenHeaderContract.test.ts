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

// The three top-level tabs, in the real `<TopTabs.Screen>` order from app/(tabs)/_layout.tsx.
// Order matters nowhere in these assertions, but keeping it means a reader can check this list
// against the navigator without re-deriving it.
// **It was five until 2026-08-20 (morning).** app/plans.tsx and app/habits.tsx left the pager
// and became pushed sub-screens, so they moved to SUB_SCREENS below. **Health and Plans swapped
// hours later**, in the same-day "full-screen card expansion" pass: Health left the bottom nav
// for a Home card (app/health.tsx is the back-compat pushed route now) and To-do took its tab
// slot (app/(tabs)/plans.tsx) — a screen cannot be in both lists, and the tier assertion is
// what tells them apart.
const TAB_SCREENS = [
  'app/(tabs)/shopping.tsx',
  'app/(tabs)/index.tsx',
  'app/(tabs)/plans.tsx',
] as const;

/**
 * Where each tab's REAL content lives, for assertions that need to read past a thin route
 * wrapper (2026-08-20 extraction). Defaults to the tab screen itself; only plans.tsx needs the
 * override — index.tsx and shopping.tsx were not extracted.
 */
const TAB_CONTENT_SOURCE: Partial<Record<(typeof TAB_SCREENS)[number], string>> = {
  'app/(tabs)/plans.tsx': 'components/TodoSurface.tsx',
};

// Pushed sub-screens that are pure content: reached from a tab by a link/button, and whose
// header is a title (plus the iOS back link ScreenScaffold adds for tier='sub') and nothing
// else. Not the whole sub-screen set — the form/editor screens legitimately carry a
// `headerRight` save/delete action, which is a different contract.
const SUB_SCREENS = [
  // ⚠️ **Nine routes LEFT this list on 2026-08-20** — habits, food, catalogue, notes, budget,
  // health-log, health-detail, day-log, inventory-edit, plus the three editors that were never
  // in it. They are components/CenterModalScreen.tsx panes now, not pushed scaffolds
  // (maintainer: *"Never go to another page, pop-up from the middle of the screen instead."*),
  // so the tier/back-arrow contract this file asserts does not apply to them: a pane has an ×,
  // not a back arrow, and no tier at all. lib/__tests__/screenRhythm.test.ts carries their
  // contract instead. What is left here is the screens that are still genuinely pushed.
  // ⚠️ **app/health.tsx left on 2026-08-22** — it is app/(tabs)/health.tsx, a site-tier pager
  // sibling, so the pushed-screen contract (a back arrow, no site chrome) is the opposite of
  // what it must now satisfy. `app/scan.tsx` is the only genuinely pushed screen left; the list
  // is kept as a list rather than collapsed to a constant because the next screen to be pushed
  // should land in it without anyone rebuilding the block.
  'app/scan.tsx',
] as const;

/** Header chrome a sub-screen must not ask for. `tier` and `onBack` are legitimate. */
// Props a PUSHED screen must not ask for, because ScreenHeader only honours them at site tier
// and a prop the header ignores reads exactly like one it honours.
// **`onLayoutPress`/`onSharePress` left this list on 2026-08-20** and moved to LIST_CONTROL_PROPS
// below: they are controls belonging to a list, not chrome belonging to a tab, and the 5→3 merge
// turned the app's biggest list screen into a pushed one. ScreenHeader renders them in the
// sub-tier right slot now (`subListControls`).
// ⚠️ **`onLayoutPress` is gone entirely as of 2026-09-01** — the maintainer asked for Shopping's
// "how things look" button to go, and the per-surface picker with it. `onSharePress` is the only
// list control left.
const SITE_ONLY_PROPS = ['isHome', 'infoActive', 'onInfoToggle', 'onScanPress'] as const;
const LIST_CONTROL_PROPS = ['onSharePress'] as const;

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

  // ⚠️ **Rewritten 2026-08-20: there is no intro card either.** This asserted that each tab
  // rendered a dismissible `<HintCard noPill onDismiss>` — the thing that replaced the header ⓘ
  // on 2026-08-13. The maintainer removed that too (*"The top text box can be removed"*), with
  // the standing rule that a tip belongs to a card's EMPTY STATE, so components/HintCard.tsx and
  // lib/useFirstVisitHint.ts are deleted. The assertion above (no ⓘ props on the header) still
  // holds and is the half that matters; this one becomes its mirror: no tab may bring the
  // banner back by either route.
  test.each(TAB_SCREENS)('%s renders no intro banner at all', (rel) => {
    // `code()` (comments stripped), not `read()`, for the same reason the ScreenHeader
    // assertion above uses it: these screens carry notes SAYING the banner was deleted and
    // naming both identifiers, and deleting an explanation must never be the cheapest way to
    // green.
    const src = code(TAB_CONTENT_SOURCE[rel] ?? rel);
    expect(src).not.toMatch(/<HintCard/);
    expect(src).not.toMatch(/useFirstVisitHint/);
  });

  // The camera left the header on 2026-08-13. Maintainer: "the camera for scanning should be
  // per card, not in the header row" — a single header icon could not know WHICH list you
  // meant, so a scan could only ever add rows. It is a per-card action now (each weekly and
  // monthly list's ⋮, and the Catalogue's own header), each passing a `target` so "scan" means
  // match-against-this-list or update-the-catalogue. See lib/scanTarget.ts.
  test('no tab passes the camera to its header any more', () => {
    const withScan = TAB_SCREENS.filter((rel) => passes(scaffoldTags(rel)[0], 'onScanPress'));
    expect(withScan).toEqual([]);
  });

  test('every scan entry point names the list it acts on', () => {
    // A `/scan` push with no `target` falls back to 'weekly' with no listId, which is the old
    // add-everything behaviour. The two entry points allowed to do that are the post-trip
    // "Shopping done!" prompt's two rows, which have just committed the trip and legitimately
    // mean "whatever is on the weekly list". Every OTHER push must scope itself.
    const sources = ['app/(tabs)/shopping.tsx', 'components/WeekListCard.tsx', 'components/CatalogueTab.tsx'];
    const unscoped = sources.flatMap((rel) =>
      [...code(rel).matchAll(/pathname: '\/scan'[^}]*\}/g)]
        .map((m) => m[0])
        .filter((push) => !/target:/.test(push) && !/autoCapture:/.test(push))
        .map((push) => `${rel}: ${push}`)
    );
    expect(unscoped).toEqual([]);
  });

  test('Home is the only tab that can show the OTA cloud', () => {
    const withHome = TAB_SCREENS.filter((rel) => passes(scaffoldTags(rel)[0], 'isHome'));
    expect(withHome).toEqual(['app/(tabs)/index.tsx']);
  });

  test('the two list-bearing tabs are the only ones with the extra list controls', () => {
    // DELIBERATE deviation from a flat "ⓘ + gear everywhere", left in place on purpose:
    //   • the share icon is gated on `settings.featureSharing`, which is OFF for a fresh
    //     install — a default header never shows it.
    // Pinned here rather than deleted so the set can't quietly grow to a third screen.
    // ⚠️ **The layout icon is gone (2026-09-01)** and so is the picker it opened — deleted on the
    // maintainer's ruling, with the `inStore` layout that was its only unreachable-from-Settings
    // content. Asserted as an ABSENCE rather than dropped, because a header control that comes
    // back by being re-added to one screen is exactly what this file exists to notice.
    const withLayout = TAB_SCREENS.filter((rel) => passes(scaffoldTags(rel)[0], 'onLayoutPress'));
    const withShare = TAB_SCREENS.filter((rel) => passes(scaffoldTags(rel)[0], 'onSharePress'));
    expect(withLayout).toEqual([]);
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

  test('no sub-screen carries list controls into the sub tier any more', () => {
    // app/plans.tsx was the one exception, and it left this list entirely on 2026-08-20 — it's
    // a tab now (app/(tabs)/plans.tsx), where its layout/share icons are asserted above instead
    // of here. Nothing took its place: app/health.tsx, the sub-screen that joined SUB_SCREENS
    // the same day, carries neither. Pinned so the carve-out cannot quietly come back.
    const withListControls = SUB_SCREENS.filter((rel) =>
      scaffoldTags(rel).some((tag) => LIST_CONTROL_PROPS.some((p) => passes(tag, p)))
    );
    expect(withListControls).toEqual([]);
  });

  test('ScreenHeader actually renders those controls at sub tier', () => {
    // Without this the props above are accepted and dropped on the floor, which is the exact
    // silent-capability-loss the 5→3 merge nearly shipped.
    const header = code('components/ScreenHeader.tsx');
    expect(header).toMatch(/const subListControls = tier === 'sub'/);
    expect(header).toMatch(/subListControls\.map\(/);
  });

  test.each(SUB_SCREENS)('%s adds no headerRight action either', (rel) => {
    // These six are read/browse screens; their editors (habit-form, medicine-form, …) are the
    // ones that legitimately carry a save/delete action, and are deliberately not in this list.
    for (const tag of scaffoldTags(rel)) expect(passes(tag, 'headerRight')).toBe(false);
  });

  test('app/notes.tsx does not drift back to site tier', () => {
    // It was tier='site' from Decision 001, kept it after Decision 036 dropped Notes as a tab,
    // and so carried a Settings gear + its own BottomNav while being reached by a router.push
    // from Home — the violation that motivated this file.
    // ⚠️ **It mounts no ScreenScaffold at all since 2026-08-20** — it is a centre pop-up. That
    // settles the original violation more completely than a tier could: a pane has no tier, no
    // gear and no BottomNav to drift back to. The assertion is now that it stays one.
    expect(scaffoldTags('app/notes.tsx')).toEqual([]);
    expect(read('app/notes.tsx')).toMatch(/<CenterModalScreen/);
  });
});
