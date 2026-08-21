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
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** Every .tsx under app/ and components/ — the places a link into Settings could be written. */
function listSources(dir = '', acc: string[] = []): string[] {
  for (const base of ['app', 'components']) {
    if (dir === '') { listSources(base, acc); continue; }
  }
  if (dir === '') return acc;
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) listSources(rel, acc);
    else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) acc.push(rel);
  }
  return acc;
}

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

  // ⚠️ **There are currently NO senders (2026-08-20), and this is deliberately still here.**
  // The one link — Shopping's ⓘ → the weekly-reset weekday and monthly-reset date on the
  // Personal tab — went with the ⓘ banner itself when that was deleted app-wide. Settings is
  // one tap away on Shopping's own header gear, and a card whose whole body is a door to
  // another screen was the original complaint about the ⓘ.
  //
  // The reader half above still matters and still passes: the param plumbing in
  // app/settings.tsx is live, and the next screen that wants to point at a setting depends on
  // it. So instead of a hard-coded list of senders (which would now be empty, and would fail
  // the moment someone added a link without editing this file), the check below is
  // sender-AGNOSTIC: it finds every `/settings?…` link anywhere in the app and holds each one
  // to the contract. Zero links passes vacuously; one wrong link fails.
  it('every /settings link that names a section names one settings.tsx handles', () => {
    const declared = settings.match(/type SettingsSection =\s*([^;]+);/);
    expect(declared).not.toBeNull();
    const known = [...declared![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    // 'shopping' is the section the machinery was built for; it stays wired at the reader end
    // even with no sender, so re-adding a link is a one-liner rather than a re-implementation.
    expect(known).toContain('shopping');

    const files = listSources();
    for (const rel of files) {
      const src = codeOnly(read(rel));
      for (const [, query] of src.matchAll(/['\`]\/settings\?([^'\`]*)['\`]/g)) {
        const section = /(?:^|&)section=([^&]+)/.exec(query)?.[1];
        if (!section) continue;
        // A section without a tab lands on General with the card shut — the original bug.
        expect({ rel, query, hasTab: /(?:^|&)tab=/.test(query) }).toEqual({ rel, query, hasTab: true });
        expect({ rel, section, known: known.includes(section) })
          .toEqual({ rel, section, known: true });
      }
    }
  });
});
