/**
 * settingsDeepLink.test.ts — a link into Settings has to be READ at the other end.
 *
 * Written after a defect that had shipped for as long as the link had existed:
 * `app/(tabs)/shopping.tsx` pushed `/settings?tab=personal`, and `app/settings.tsx` contained
 * no `useLocalSearchParams` at all, so the param was silently dropped and every caller landed
 * on the General tab. Maintainer, on device: *"Nullstillingsdager in shopping takes you to
 * settings, but not the actual setting you're looking for."*
 *
 * Nothing could have caught it. A query string is a string — tsc has no opinion on it, both
 * halves compiled, the navigation genuinely happened, and the screen that opened was a real
 * screen. It is only wrong if you know which control the user was promised. So the guard is a
 * source scan pairing each SENDER with the READER it depends on.
 *
 * Deliberately source-level rather than a render test: the failure is a missing wire between
 * two files, and mounting either one proves nothing about the other.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** Source with comments stripped — the header below DESCRIBES the params at length. */
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('every /settings link is answered by app/settings.tsx', () => {
  const settings = codeOnly(read('app/settings.tsx'));

  it('reads its route params at all', () => {
    // The whole defect in one assertion: this import did not exist.
    expect(settings).toMatch(/useLocalSearchParams/);
    expect(settings).toMatch(/tab:\s*tabParam/);
    expect(settings).toMatch(/section:\s*sectionParam/);
  });

  it('seeds the tab in the useState initializer, not from an effect', () => {
    // A `useEffect(() => setTab(param))` would mount and lay out the General tab first, then
    // throw it away — and the target card's onLayout, which is what drives the scroll, would
    // have fired against a screen the user never saw.
    expect(settings).toMatch(/useState<SettingsTab>\(\s*\(\)\s*=>/);
  });

  it('validates the tab param against the real tab list rather than casting it', () => {
    expect(settings).toMatch(/SETTINGS_TABS\.includes\(tabParam\)/);
  });

  it('opens the linked-to section and lets the user close it again', () => {
    // Controlled only while the link is live. A `?section=` that stayed latched open would make
    // its card the one card on this screen that cannot be shut.
    expect(settings).toMatch(/open=\{openSection === 'shopping' \? true : undefined\}/);
    expect(settings).toMatch(/onToggle=\{\(\) => setOpenSection\(null\)\}/);
  });

  it('can actually scroll to the section it opened', () => {
    // Opening a card below the fold is only half an answer — the control still isn't on screen.
    expect(settings).toMatch(/ScrollToNodeContext/);
    expect(settings).toMatch(/scrollToNode\?\.\(sectionNode\.current\)/);
  });

  // The senders. One row per link into Settings; add a row when you add a link.
  it.each([
    // Shopping's ⓘ → the weekly-reset weekday and monthly-reset date, which live in the
    // Shopping card on the Personal tab.
    ['app/(tabs)/shopping.tsx', 'personal', 'shopping'],
  ])('%s links to a tab AND a section', (file, tab, section) => {
    const src = codeOnly(read(file));
    const links = [...src.matchAll(/'\/settings\?([^']*)'/g)].map((m) => m[1]);
    expect(links).toContain(`tab=${tab}&section=${section}`);
  });

  it('has a reader for every section any screen links to', () => {
    // The type is the list of what settings.tsx handles; anything a sender asks for that isn't
    // in it lands on the right tab with the card still shut — the original bug, one level down.
    const declared = settings.match(/type SettingsSection =\s*([^;]+);/);
    expect(declared).not.toBeNull();
    const known = [...declared![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(known).toContain('shopping');
  });
});
