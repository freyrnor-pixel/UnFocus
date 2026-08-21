#!/usr/bin/env node
/**
 * measure-wraps.mjs — audit for "this only just wrapped" layout bugs.
 *
 * Drives the web preview and reports three failure modes that all look the same on a
 * phone ("why is that on two lines?") but have different causes and different fixes:
 *
 *   1. WRAPPED TEXT   — a paragraph/label on N+1 lines that would fit in N. Reported with
 *                       `needForOne`: how many more px of width would collapse it to one
 *                       line. A small number means the container is the problem, not the
 *                       copy.
 *   2. TRUNCATED TEXT — a single-line element whose text overflows its box (ellipsis or
 *                       clip). Tabs and chips fail this way instead of wrapping.
 *                       ⚠️ CONFIRM THESE ON A DEVICE BEFORE "FIXING" THEM. React Native's
 *                       `adjustsFontSizeToFit` / `minimumFontScale` shrink a label instead
 *                       of clipping it, and react-native-web implements NEITHER — so any
 *                       Text using them is reported here as truncated even though it fits
 *                       fine on iOS/Android. components/BottomNav.tsx's tab label is exactly
 *                       this case ("Handleliste" at minimumFontScale 0.8): the audit flags
 *                       it, the real app shrinks it. Wrapped text and wrapped rows are real
 *                       geometry and DO reproduce faithfully on web.
 *   3. WRAPPED ROWS   — a horizontal control row (the Mon–Sun weekday chips, a tab bar,
 *                       a segmented control) whose children spill onto a second line.
 *                       These can't be fixed by shortening copy — the row has a hard
 *                       minimum width — so they have to be measured, not eyeballed.
 *   4. CLIPPED        — an element whose box runs past the edge of the nearest ancestor that
 *                       clips overflow, so part of it is physically sliced off. Reported per
 *                       AXIS, because the two axes catch different bugs and neither is
 *                       visible to the three modes above:
 *                         [x] a NON-text element (a button, an icon, a chip) shoved out
 *                             sideways. Added 2026-08-01 after the task editor's voice mic
 *                             shipped sliced in half at 360px (#465): the row held a
 *                             TextInput with no `flex: 1`/`minWidth: 0`, so the input kept
 *                             its intrinsic width and pushed the mic through the card's
 *                             mask. The mic has no text to wrap or truncate and its row has
 *                             two children, under the >= 3 WRAPPED ROWS needs.
 *                         [y] anything sliced top/bottom, TEXT INCLUDED (a label in a
 *                             fixed-height mask neither wraps nor truncates, so modes 1 and 2
 *                             both see a perfectly healthy single line). Added 2026-08-05.
 *                       ⚠️ **The [y] axis did NOT catch the bug it was written for, and that
 *                       is worth knowing before trusting a green run.** It went in after every
 *                       `size="sm"` Button shipped with its descenders cut off (a pinned
 *                       `height` + the glass overflow mask). Putting that height back and
 *                       re-running reports 0 exactly as before: in CSS the label overflows the
 *                       mask's PADDING box without crossing its border box, so nothing measures
 *                       as clipped, while Yoga squeezes the same label on device. Same family as
 *                       `adjustsFontSizeToFit` below — real natively, invisible here. That case
 *                       is guarded by a source scan instead (lib/__tests__/designTokens.test.ts,
 *                       "Button sizes with minHeight"). [y] is kept because an element genuinely
 *                       sliced by a mask's border box IS a real bug it can see, and it is silent
 *                       across the app today — but do not read "0 clipped" as "no text is cut off".
 *
 * Coverage note: this walks onboarding, the tour card, all three tabs (Shop/Home/To-do —
 * five until the 2026-08-20 5→3 merge, three again the same day once the SAME-DAY
 * "full-screen card expansion" pass restored To-do's tab slot and moved Health off the bar
 * entirely onto a Home card), Settings, the **Energy config sheet**, and — since 2026-08-01 —
 * the **task editor** (where the mic bug lived), the **Goals drawer** (an in-card editor as of
 * 2026-08-12, was a popup before that), the **health form** and the **medicine editor**.
 * Pushed sub-screens and opened editors/sheets were invisible to this audit before that pass,
 * so a whole class of the app's densest layouts was never measured. When you add a surface
 * with tight horizontal pressure, add a step for it here rather than trusting a screenshot.
 *
 * Ordering is constrained by three facts, all verified rather than assumed — see main():
 *   - the run is FOUR passes, because `settings`, `health-form` and `medicine-form` are all
 *     dead ends (pushed `tier="sub"` screens with no BottomNav, confirmed by reading each file
 *     rather than trusting an older comment — see Pass 2's own note) and only one of them can
 *     end a pass; the To-do screen was a fourth dead end for the few hours between the
 *     2026-08-20 5→3 merge and the same-day "full-screen card expansion" pass that made it a
 *     real tab again (BottomNav present throughout) — it still gets its own pass (Pass 4
 *     below), just no longer because it has to;
 *   - never page.goto()/goBack() mid-walk except for the standalone `basics-all-rows` route
 *     at the very end of a pass — both reload the document, resetting the in-memory sql.js
 *     DB and dropping you back into onboarding;
 *   - app/scan.tsx is never walked, because the web bundle resolves the OCR placeholder
 *     app/scan.web.tsx and measuring it would report on a screen that isn't the real one.
 *
 * Usage:
 *   node scripts/measure-wraps.mjs [--lang=no|en|is] [--width=393] [--json]
 *
 * Widths worth checking: 430 (iPhone Pro Max), 393 (iPhone 15 / Pixel 8), 360 (common
 * small Android). Large-font pressure: the app's `large` font setting is 1.2x, so
 * measuring at width/1.2 (e.g. 327 for a 393pt phone) approximates it without having to
 * drive the Settings UI — see `--width=327`.
 *
 * Chromium is pre-installed under PLAYWRIGHT_BROWSERS_PATH; never `playwright install`.
 * Requires the built bundle + a running server — `npm run wraps` handles both.
 */
import { chromium } from '@playwright/test';

const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH
  || `${process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium-1194/chrome-linux/chrome`;

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : dflt;
};
const LANG = arg('lang', 'no');
const WIDTH = parseInt(arg('width', '393'), 10);
const AS_JSON = process.argv.includes('--json');

// Every string the walk clicks, per language, so adding a language is a table edit.
const L = {
  en: {
    // Norwegian, deliberately: the app is Norwegian-first, so Basics renders in Norwegian
    // until this very row is tapped — the label is "Språk: English." at the moment it is
    // clicked, and only the screens AFTER it are English. `--lang=en` timed out on a
    // "Language: English." that never exists (fixed 2026-08-01; scripts/preview.mjs always
    // had this right). Everything below is post-switch and so is genuinely English.
    langRow: /^Språk: English\./, basicsNext: 'Continue',
    // Onboarding is two screens since 2026-08-03 (basics → privacy), so `newHere`/`guided`/
    // `next`/`go` are gone with the screens they advanced past. `start` finishes setup.
    start: 'Start', tourNext: 'Got it', skipTour: 'Skip the tour',
    // Three tabs — Shop / Home / To-do since the SAME-DAY "full-screen card expansion" pass
    // that reversed the 2026-08-20 5→3 merge this comment used to describe (To-do had briefly
    // been a pushed screen off Home; it is a real tab again, and Health took its old tab slot
    // off the bar entirely, becoming a Home card instead — see the health-form step below).
    // `home` is the middle tab and is listed separately because several steps need to return
    // to it by name.
    tabs: ['Shop', 'To-do'], home: 'Me', settings: 'Settings',
    dismiss: ['Skip', 'Got it', 'Got it →', 'OK'],
    // Task-editor walk: the "All tasks" tab is the only one with an add affordance, and a
    // fresh profile has no tasks, so one has to be created before an editor can be opened.
    newTask: 'New task', probeTask: 'Wrap audit probe',
    // The Whenever card's fold chevron. Every card rests CLOSED since 2026-08-21
    // (lib/cardDefaults.ts), so this walk has to open the card before its composer exists.
    expandWhenever: 'Whenever: Expand list',
    // The Energy config sheet (2026-08-03). On a fresh profile the strip is in its tutorial
    // state, so its StarterCard button is the way in; the ✏️ ("Adjust energy") opens the same
    // sheet once anything has an energy value. Three label+stepper rows plus a hint line each,
    // i.e. exactly the "label competing with a fixed-size control" case this audit exists for.
    energyTutorialAction: "Set the day's energy", energyDone: 'Done',
    // The quick-add's FOCUSED state (2026-08-05). Idle it is one field on one line and there
    // is nothing to measure; focused it unfolds the labelled options panel — a label
    // competing with a fixed-width Stepper, exactly the shape that broke the task editor at
    // 327px — plus a worded "More options" button that has to share a row with the confirm
    // check. None of that existed on any surface this audit walked, so it went unmeasured.
    typeHabit: 'Type habit',
    // Pushed sub-screens / popups. Each is reached by tapping, never page.goto() or
    // goBack() — both reload the document, which resets the in-memory sql.js DB and drops
    // you back into onboarding. BottomNav stays mounted over a pushed screen (verified), so
    // a tab tap is the way back out — except `settings` and `medicine-form`, which render no
    // BottomNav at all and so end whichever pass reaches them (see main()).
    // ⚠️ `t.goals.editLinkPractical`, not a bare "Goals" — the drawer on the To-do screen has
    // been labelled "Practical goals" for a while and this locator had gone stale, so the
    // goals-drawer scan was silently skipping alongside health-form's (both found 2026-08-20).
    editGoals: 'Practical goals',
    // Shopping's Food and Catalogue drawers (2026-08-10). Their expanded body is no longer a
    // names-only preview — it is the real FoodTab / CatalogueTab, so the drawer now holds a
    // search field, an add composer and name·price·trash rows inside a card that is itself
    // inside the screen's padding. Three stacked horizontal insets is the exact shape that
    // produced the task editor's findings, and neither drawer was measured before this.
    // The chevron, not the name: the name pushes the screen.
    // ⚠️ Was `logSymptomTrigger` ("What's bothering you?") until 2026-08-20, which has not been
    // on the Health TAB since that screen was rebuilt on 2026-08-11 — it only survives on the
    // pushed /health-log. So this step had been silently skipping ("health-form step skipped")
    // and the app's second-densest form was going unmeasured. The tab's composer is a type LINE
    // now, and `moreOptions` on it is the tier-3 route into /health-form.
    logSymptom: 'Log something', logSymptomMore: 'More options',
    addMedicine: 'Add a medicine', probeMed: 'Wrap audit med',
    // The design lab (2026-08-06). Off by default, so the walk has to switch it on before the
    // link row exists. Its knob rows are "long label + fixed-width Stepper" thirty times over,
    // plus a colour row that puts a swatch, two nudges and a hex field on ONE line — the
    // densest horizontal case added to the app since the task editor, and the same shape that
    // broke that editor at 327px.
    advancedTab: 'Advanced', debugMode: 'Debug mode', designLab: 'Design lab',
    // The playground (empty, then with a card on it, then with a part's panel open), and the
    // token knobs on their own pushed screen. A tab this walk doesn't switch to is a tab it
    // doesn't measure — the same rule that made this five scans in the first place.
    labAddCard: 'Add a card', labBlankCard: 'A blank card',
    labShelfGroup: 'Controls', labAddSlider: 'Add a slider',
    labTokensLink: 'Colours and shapes',
    labTabColor: 'Colour', labTabShape: 'Shape', labTabControls: 'Controls',
  },
  no: {
    langRow: /^Språk: Norsk\./, basicsNext: 'Fortsett',
    start: 'Start', tourNext: 'Skjønner', skipTour: 'Hopp over omvisningen',
    tabs: ['Handle', 'Gjøremål'], home: 'Meg', settings: 'Innstillinger',
    dismiss: ['Hopp over', 'Skjønner', 'Skjønner →', 'OK'],
    newTask: 'Ny oppgave', probeTask: 'Bredde-test',
    expandWhenever: 'Når som helst: Vis liste',
    energyTutorialAction: 'Sett dagens energi', energyDone: 'Ferdig',
    typeHabit: 'Skriv vane',
    editGoals: 'Praktiske mål',
    logSymptom: 'Logg noe', logSymptomMore: 'Flere valg',
    advancedTab: 'Avansert', debugMode: 'Feilsøkingsmodus', designLab: 'Designlab',
    labAddCard: 'Legg til et kort', labBlankCard: 'Et tomt kort',
    labShelfGroup: 'Kontroller', labAddSlider: 'Legg til en skyvebryter',
    labTokensLink: 'Farger og former',
    labTabColor: 'Farge', labTabShape: 'Form', labTabControls: 'Kontroller',
    addMedicine: 'Legg til medisin', probeMed: 'Bredde-med',
  },
  is: {
    // Same trick as `en`: Basics renders in Norwegian until this row is tapped, so the label
    // to click is the Norwegian screen's Icelandic OPTION ("Språk: Íslenska."). Everything
    // below it is post-switch and genuinely Icelandic.
    langRow: /^Språk: Íslenska\./, basicsNext: 'Áfram',
    start: 'Byrja', tourNext: 'Ég skil', skipTour: 'Sleppa kynningunni',
    tabs: ['Innkaup', 'Verkefni'], home: 'Ég', settings: 'Stillingar',
    dismiss: ['Sleppa', 'Ég skil', 'Ég skil →', 'Í lagi'],
    newTask: 'Nýtt verkefni', probeTask: 'Breiddarpróf',
    expandWhenever: 'Hvenær sem er: Sýna lista',
    energyTutorialAction: 'Stilla orku dagsins', energyDone: 'Búið',
    typeHabit: 'Skrifa venju',
    editGoals: 'Hagnýt markmið',
    logSymptom: 'Skrá eitthvað', logSymptomMore: 'Fleiri valkostir',
    advancedTab: 'Ítarlegt', debugMode: 'Villuleitarhamur', designLab: 'Hönnunarstofa',
    labAddCard: 'Bæta við korti', labBlankCard: 'Tómt kort',
    labShelfGroup: 'Stýringar', labAddSlider: 'Bæta við: sleði',
    labTokensLink: 'Litir og form',
    labTabColor: 'Litur', labTabShape: 'Form', labTabControls: 'Stýringar',
    addMedicine: 'Bæta við lyfi', probeMed: 'Breiddarlyf',
  },
}[LANG];

if (!L) { console.error(`unknown --lang=${LANG} (expected en, no or is)`); process.exit(1); }

async function clickText(page, text) {
  const locator = page.getByText(text, { exact: true });
  await locator.first().waitFor({ state: 'attached', timeout: 10000 });
  for (const c of await locator.all()) {
    if (await c.isVisible()) { await c.click({ timeout: 10000 }); return; }
  }
  throw new Error(`no visible match for "${text}"`);
}

async function dismissModalIfPresent(page) {
  for (let i = 0; i < 3; i++) {
    let did = false;
    for (const label of L.dismiss) {
      const btn = page.getByText(label, { exact: true }).first();
      if (await btn.isVisible({ timeout: 600 }).catch(() => false)) {
        await btn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(250); did = true; break;
      }
    }
    if (!did) return;
  }
}

/**
 * Switch to the Home tab — a no-op if already there.
 *
 * Found the hard way: clicking the Home tab's OWN button while Home is already the active tab
 * reliably hung `locator.click()` at the "waiting for locator" stage (never even reaching
 * Playwright's usual "scrolling into view"/"retrying" sub-steps), even though the exact same
 * element resolved as attached and visible moments before, and clicking that already-resolved
 * element HANDLE directly (bypassing the locator's own re-resolution) succeeded instantly. That
 * points at BottomNav re-rendering the active tab in a way `locator.click()`'s stability wait
 * never settles on, not a genuinely missing element — but the guard here doesn't need the exact
 * mechanism to be right, only to never fire a click on a tab that's already active.
 */
async function goHome(page) {
  const onHome = new URL(page.url()).pathname.replace(/\/index$/, '') === '/';
  if (onHome) return;
  await page.getByRole('button', { name: L.home, exact: true }).first().click({ timeout: 10000 });
  await page.waitForTimeout(700);
}

// Runs in the page.
const SCAN = () => {
  const texts = [];
  const rows = [];
  const clipped = [];
  const visible = (el, cs) => cs.display !== 'none' && cs.visibility !== 'hidden';

  // How far past a clipping ancestor's edge this element sticks out on the given axis, or 0.
  //
  // Only `hidden`/`clip` count, never `auto`/`scroll`: content outside a SCROLLER is
  // reachable by scrolling, which is not a bug — and treating the tab pager (a horizontal
  // scroller holding all five screens, lazy:false) as a clipper would report every
  // off-screen tab on every run.
  //
  // A scroller doesn't just fail to be a clipper, it ENDS THE WALK (2026-08-05). Once an
  // ancestor can scroll on this axis the element is reachable, so no ancestor further out can
  // slice it in the sense this mode means. Walking past one is what made the first cut of the
  // vertical axis useless: every screen's ScrollView is `overflow-y: scroll`, so the search
  // sailed past it to the app root's `overflow: hidden` and reported all normal below-the-fold
  // content — 57 findings, none of them bugs, on a run whose real finding count was 0.
  const clipOverflow = (el, rect, axis) => {
    const horiz = axis === 'x';
    for (let p = el.parentElement; p; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      const ov = horiz ? pcs.overflowX : pcs.overflowY;
      if (ov === 'auto' || ov === 'scroll') return null;
      if (ov !== 'hidden' && ov !== 'clip') continue;
      const pr = p.getBoundingClientRect();
      // Border-box vs the child's rect: a 1px border is not a clipped control.
      const over = horiz
        ? Math.max(rect.right - pr.right, pr.left - rect.left)
        : Math.max(rect.bottom - pr.bottom, pr.top - rect.top);
      return { over, clipper: p, clipperSize: horiz ? pr.width : pr.height };
    }
    return null;
  };

  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (!visible(el, cs)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 4) continue;

    // ── 4. Clipped controls: sliced by an ancestor's overflow mask.
    // Skip anything off-screen: the pager keeps all five tab screens mounted, and its
    // neighbours legitimately sit outside the viewport.
    if (rect.left >= -1 && rect.left < window.innerWidth) {
      // Text leaves are the TRUNCATED category's job — reporting them here too would
      // double-count every ellipsised label. This mode is for the things that have no text
      // to truncate: icon buttons, chips, avatars, controls.
      const isTextLeaf = el.children.length === 0 && (el.textContent || '').trim().length > 0;
      // Decorative art is SUPPOSED to bleed past its mask: the tab backdrop is one
      // 1950px strip slid across five panels, and constants/motifs.ts's shapes are
      // deliberately edge-anchored (AGENTS.md, "the centre box stays clear"). Every <svg>
      // and everything inside one is scenery, not a control.
      const inSvg = el.tagName.toLowerCase() === 'svg' || !!el.closest('svg');
      // <noscript> is Expo's "You need to enable JavaScript to run this app" fallback, baked
      // into the exported HTML shell. It is in the DOM on every screen and is laid out by
      // the browser, so it measures — but it is never visible to anyone actually running the
      // app, so a clip on it is an artifact of walking the document rather than a finding.
      // Reported as a real clipped control until 2026-08-03, which is exactly the kind of
      // false positive that teaches people to ignore this section.
      const inNoscript = el.tagName.toLowerCase() === 'noscript' || !!el.closest('noscript');
      if (!inSvg && !inNoscript) {
        // 2px tolerance absorbs subpixel rounding and rounded-corner masks.
        //
        // `size <= clipperSize` is what separates a BUG from a MECHANISM. The mic was 28px
        // inside a 257px box: it fits with room to spare and was merely shoved out, which is
        // always wrong. A child BIGGER than its clipper is a sliding track — the tab pager
        // (1800px of five screens in a 360px window), onboarding's three-panel triptych, a
        // collapsed Collapsible measuring its content at natural height inside a 0-height
        // clip — where being clipped is the entire design. Without this the report is
        // dominated by carousels and the one real finding is lost in them.
        const record = (axis, c, size) => {
          if (!c || c.over <= 2 || size > c.clipperSize) return;
          // ⚠️ **A page OF a sliding track is the track (2026-08-21), and `>` was one character
          // short.** The rule above skips a child BIGGER than its clipper — the pager's 1080px
          // track inside a 360px window — but not that track's own PAGES, which are each
          // exactly one window wide. Six of eight findings on every run were those: a 360px
          // page inside the 360px app root, reported at 33px, 64px or 326px past the edge
          // depending purely on where the pager happened to be when the screenshot was taken.
          // (Diagnosed rather than guessed — `WRAP_DEBUG=1` prints each finding's clipper and
          // offsets, which is what showed the clipper was the app root and the offsets were
          // mid-settle transforms rather than the clean multiples a laid-out page would give.)
          //
          // Equality is the honest cut, not a modulo: this mode is about **a control that had
          // room and was shoved out anyway** — the sliced mic that motivated it was 28px inside
          // a 257px box. Something exactly as wide as the thing clipping it never had room, so
          // it is a page, a track or a full-bleed layer, and being off to the side is what it
          // IS. Anything genuinely smaller than its clipper is still reported.
          if (size >= c.clipperSize - 2) return;
          clipped.push({
            kind: 'clipped',
            axis,
            tag: el.tagName.toLowerCase(),
            label: (el.getAttribute('aria-label') || el.getAttribute('data-testid') || '').slice(0, 40),
            over: Math.round(c.over),
            size: Math.round(size),
            clipperSize: Math.round(c.clipperSize),
            // The clipper's own text is the most useful way to say WHERE this is.
            near: (c.clipper.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 44),
            text: axis === 'y' ? (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 44) : '',
            _dbg: `elx=${Math.round(rect.left)} clipx=${Math.round(c.clipper.getBoundingClientRect().left)} clipTag=${c.clipper.tagName.toLowerCase()} clipCls=${(c.clipper.className || '').toString().slice(0, 60)} elCls=${(el.className || '').toString().slice(0, 60)}`,
          });
        };
        // Horizontally, text leaves are the TRUNCATED category's job — reporting them here
        // too would double-count every ellipsised label.
        if (!isTextLeaf) record('x', clipOverflow(el, rect, 'x'), rect.width);
        // Vertically, text leaves are included rather than deferred to TRUNCATED — that mode
        // only ever compares widths, so it cannot see a label sliced top-and-bottom. Same
        // three guards as the horizontal axis, and the size filter matters more here since a
        // scroll body is always taller than its viewport. Read the ⚠️ in the file header
        // before treating a clean [y] run as proof that no text is cut off: the fixed-height
        // Button case this axis was written for does not reproduce in CSS at all.
        record('y', clipOverflow(el, rect, 'y'), rect.height);
      }
    }

    // ── 3. Control rows: a flex row whose children sit on more than one baseline.
    if (cs.display === 'flex' && cs.flexDirection === 'row' && el.children.length >= 3) {
      // Only NORMAL-FLOW children count. An absolutely-positioned sibling (BottomNav's
      // sliding pill, a badge, an overlay) sits at its own `top` and would otherwise make
      // a perfectly fine single-line row look like it wrapped — that false positive is why
      // this filter exists; don't drop it.
      const kids = Array.from(el.children)
        .map((k) => ({ k, r: k.getBoundingClientRect(), cs: getComputedStyle(k) }))
        .filter((x) => x.r.width > 0 && x.r.height > 0
          && x.cs.position !== 'absolute' && x.cs.position !== 'fixed');
      if (kids.length >= 3) {
        const tops = new Set(kids.map((x) => Math.round(x.r.top)));
        const gapPx = parseFloat(cs.columnGap || cs.gap) || 0;
        const needPx = kids.reduce((s, x) => s + x.r.width, 0) + gapPx * (kids.length - 1);
        // `short > 0` is the real test: the children genuinely need more width than the row
        // has. Multiple `top`s with short <= 0 means they're stacked for some other reason
        // (align-items, a taller sibling), not because the row ran out of room.
        //
        // The 0.5px floor is sub-pixel rounding, not slack (added 2026-08-02). A row of
        // `flex: 1` children divides the container into fractional widths that sum back to
        // fractionally MORE than it — so a row that provably cannot wrap gets reported as
        // "short by 0px". A genuinely tight row is short by whole pixels (the 7 weekday
        // chips miss by ~9), so nothing real is hidden by this. The `tops` half of the test
        // fires here because a hairline rule and a text label centred in the same row have
        // very different `top` values.
        if (tops.size > 1 && needPx - rect.width > 0.5) {
          const widest = Math.max(...kids.map((x) => x.r.width));
          rows.push({
            kind: 'row-wrapped',
            children: kids.length,
            linesUsed: tops.size,
            avail: Math.round(rect.width),
            needed: Math.round(needPx),
            short: Math.round(needPx - rect.width),
            widestChild: Math.round(widest),
            wrapping: cs.flexWrap,
            sample: kids.slice(0, 8).map((x) => (x.k.textContent || '').trim().slice(0, 12)).join('|'),
          });
        }
      }
    }

    if (el.children.length > 0) continue;
    const txt = (el.textContent || '').trim();
    if (!txt || txt.length < 2) continue;

    // Real line boxes (element height includes padding, which fakes a second line).
    let lines = 0;
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rs = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      lines = new Set(rs.map((r) => Math.round(r.top))).size;
    } catch { continue; }

    const prevWS = el.style.whiteSpace, prevOF = el.style.overflow;
    el.style.whiteSpace = 'nowrap'; el.style.overflow = 'visible';
    const natural = el.scrollWidth;
    el.style.whiteSpace = prevWS; el.style.overflow = prevOF;

    const avail = rect.width;
    if (lines >= 2) {
      texts.push({
        kind: 'wrapped', text: txt.slice(0, 70), lines,
        avail: Math.round(avail), natural: Math.round(natural),
        needForOne: Math.round(natural - avail), fontSize: cs.fontSize,
      });
    } else if (natural > avail + 1) {
      // ── 2. Single line but overflowing: ellipsised or clipped.
      texts.push({
        kind: 'truncated', text: txt.slice(0, 70), lines: 1,
        avail: Math.round(avail), natural: Math.round(natural),
        needForOne: Math.round(natural - avail), fontSize: cs.fontSize,
      });
    }
  }
  return { texts, rows, clipped };
};

const screens = [];
async function scan(page, name) {
  screens.push({ name, ...(await page.evaluate(SCAN)) });
}

/**
 * Load the app fresh, walk onboarding + the tour + the Energy config sheet, and land on
 * the tab bar. Extracted because the audit needs FOUR passes over this same on-ramp (see
 * main()): `settings`, `health-form` and `medicine-form` are all dead ends — pushed screens
 * that render NO BottomNav, verified — so only one of them can end a pass, and getting back
 * out of any means reloading, which resets the in-memory sql.js DB and puts onboarding back in
 * front of you. The To-do screen joined that set on 2026-08-20, when the 5→3 tab merge moved
 * it off the pager, and left it again hours later; it used to be walked mid-pass as a tab.
 *
 * `scanning` is false on every pass after the first: onboarding/tour/energy-sheet are identical
 * each time and would just duplicate every finding.
 */
async function walkToTabs(page, { scanning }) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  // Basics is screen ONE. It drew six rows of pills, three-across at the widest, and was
  // the densest control screen in the app — which is why this audit scanned it before
  // tapping anything. Since 2026-08-03 it draws ONE row (language) plus the welcome copy on
  // a fresh install; the six-row form now lives behind Settings' "Run setup again"
  // (`/onboarding/basics?rows=all`) and is scanned separately below, because it is still
  // the tightest horizontal case in the app and losing sight of it would be a real gap.
  if (scanning) await scan(page, 'onboarding-basics');
  await page.getByRole('radio', { name: L.langRow }).first().click({ timeout: 10000 });
  await page.waitForTimeout(400);
  await clickText(page, L.basicsNext);
  await page.waitForTimeout(400);
  // Privacy is the LAST onboarding screen now: the two-bullet card, the Start button that
  // completes setup, and the two secondary links (restore, AI setup guide).
  if (scanning) await scan(page, 'onboarding-privacy');
  await clickText(page, L.start);
  await page.waitForTimeout(1800);

  // The guided tour opens straight after onboarding. Measure its coach card — it is new copy
  // in a fixed-width box, exactly what this audit is for — then dismiss it, or its scrim
  // swallows every click below and the run dies somewhere unrelated.
  if (await page.getByText(L.tourNext, { exact: true }).first().isVisible().catch(() => false)) {
    if (scanning) await scan(page, 'tour-step');
    await clickText(page, L.skipTour);
    await page.waitForTimeout(900);
  }

  if (scanning) await scan(page, 'home');

  // ── The Energy config sheet ──
  // Opened from the strip's tutorial-state button (a fresh profile has no energy values, so
  // that is what Home draws — components/EnergyMeter.tsx's "Tutorial state"). Three rows of
  // "label + stepper" with an italic hint line under each: the stepper cannot shrink, so the
  // label side is what has to yield, and that is precisely the failure this audit catches.
  // Closed again before the tab loop — a bottom sheet's scrim swallows every click under it.
  // Opening it writes nothing, so the strip is still in its tutorial state afterwards.
  // Best-effort like the task editor: a failure must not lose the findings already collected.
  try {
    await clickText(page, L.energyTutorialAction);
    await page.waitForTimeout(700);
    if (scanning) await scan(page, 'energy-config-sheet');
    await clickText(page, L.energyDone);
    await page.waitForTimeout(600);
  } catch (e) {
    console.error(`  (energy-config-sheet step skipped: ${e.message.split('\n')[0]})`);
  }

  // ── The quick-add, focused ──
  // Click, don't focus(): a programmatic DOM focus doesn't reliably drive react-native-web's
  // onFocus, and the panel + buttons this step exists to measure hang off the component's own
  // focused state. Home's habits card is the .first() match for this label whichever tab is
  // showing (all five are mounted, `lazy: false`), which is why this runs here rather than on
  // the Habits tab. Blurred again afterwards so the unfolded panel can't overlap a later step.
  try {
    const field = page.getByLabel(L.typeHabit, { exact: true }).first();
    await field.scrollIntoViewIfNeeded();
    await field.click({ timeout: 8000 });
    await page.waitForTimeout(600);
    if (scanning) await scan(page, 'quick-add-focused');
    await page.keyboard.press('Escape');
    await page.mouse.click(5, 5);
    await page.waitForTimeout(400);
  } catch (e) {
    console.error(`  (quick-add-focused step skipped: ${e.message.split('\n')[0]})`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 852 } });
  try {
    // ── Pass 1: onboarding, the tabs, health-form, Settings, design lab.
    await walkToTabs(page, { scanning: true });

    for (const tab of L.tabs) {
      await page.getByRole('button', { name: tab, exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(900);
      await dismissModalIfPresent(page);
      await scan(page, tab);
    }
    // Food and Catalogue used to be components/CollapsedSection.tsx fold-away drawers behind a
    // chevron (2026-08-10 → 2026-08-20), which needed their own excursion — a closed drawer's
    // body isn't mounted, so the tab scan above couldn't see it. The SAME-DAY "full-screen card
    // expansion" pass replaced them with always-open components/SectionCard.tsx peers mounting
    // the real FoodTab/CatalogueTab directly (app/(tabs)/shopping.tsx's `foodCatalogueLinks`) —
    // no fold, no chevron, both bodies unconditionally in the DOM. The regular Shop-tab scan
    // above already measures them; a dedicated excursion here would just double-count.
    // Health's symptom form (app/health-form.tsx) moved to its own pass below — see that
    // block's comment for why.

    // Settings is a DEAD END — a pushed screen with no BottomNav — so nothing can follow it
    // in this pass. Anything else that needs the app has to start a new one.
    await goHome(page);
    await page.getByRole('button', { name: L.settings, exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(1200);
    await scan(page, 'settings');

    // ── The design lab ──
    // Pushed FROM settings, and a dead end itself, so it can only go here — after the scan
    // that ends this pass. Off by default, so the switch has to be thrown first; the card
    // title and the revealed link row share the same words, hence `.last()`.
    //
    // **SIX scans** (2026-08-07, was five). The lab is two screens now: a playground you build
    // on and the token knobs pushed off it. The playground is scanned three times — empty,
    // with a card on it, and with a part's panel open — because those are three different
    // surfaces, and the panel in particular is the densest label-plus-pill-cloud thing in the
    // app now that it carries colour swatches, sizes, weights, positions, lines and widths.
    // The knobs screen keeps its three tabs; a tab this walk doesn't switch to is a tab it
    // doesn't measure.
    // Best-effort like the editors: a failure must not lose the findings already collected.
    try {
      await clickText(page, L.advancedTab);
      await page.waitForTimeout(900);
      // The lab is reached through DEBUG MODE since 2026-08-17 — its own `featureDesignLab`
      // switch was removed in the settings-declutter pass, and the link now sits inside the
      // Debug mode card, revealed once debug is on.
      await page.getByRole('switch', { name: L.debugMode, exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(700);
      await page.getByText(L.designLab, { exact: true }).last().click({ timeout: 10000 });
      await page.waitForTimeout(1500);
      await scan(page, 'design-lab-empty');

      // An empty state's copy is its longest copy, so the empty screen is worth its own scan
      // before anything is put on it.
      await clickText(page, L.labAddCard);
      await page.waitForTimeout(800);
      await clickText(page, L.labBlankCard);
      await page.waitForTimeout(1100);
      await scan(page, 'design-lab-card');

      // The part panel, opened by adding a part from the shelf — a tap, since the drag cannot
      // be driven here at all.
      try {
        await page.getByRole('radio', { name: L.labShelfGroup, exact: true }).first().click({ timeout: 8000 });
        await page.waitForTimeout(500);
        await page.getByRole('button', { name: L.labAddSlider, exact: true }).first().click({ timeout: 8000 });
        await page.waitForTimeout(1000);
        await scan(page, 'design-lab-part-panel');
      } catch (e) {
        console.error(`  (design-lab-part-panel step skipped: ${e.message.split('\n')[0]})`);
      }

      // The knobs, on their own screen. A push, so this is where the pass ends.
      await page.getByRole('button', { name: L.labTokensLink, exact: true }).first().click({ timeout: 8000 });
      await page.waitForTimeout(1300);
      await scan(page, 'design-lab-colour');
      for (const [label, name] of [
        [L.labTabShape, 'design-lab-shape'],
        [L.labTabControls, 'design-lab-controls'],
      ]) {
        await clickText(page, label);
        await page.waitForTimeout(900);
        await scan(page, name);
      }
    } catch (e) {
      console.error(`  (design-lab step skipped: ${e.message.split('\n')[0]})`);
    }

    // ── Pass 2: Health's symptom form (app/health-form.tsx) ──
    // Health left the bottom nav entirely in the same pass that restored To-do's tab slot — it
    // is a Home card now (components/HomeHealthCard.tsx, mounting HealthSurface `embedded` with
    // nothing truncated), not a tab, so this is reached via Home rather than a "Me"/"Meg" tab
    // click. (app/scan.tsx is deliberately never walked: the web bundle resolves
    // app/scan.web.tsx, an OCR "not available" placeholder, so measuring it would report on a
    // screen that does not exist on device. It needs a real device, like the rest of the
    // native-only surface.)
    //
    // ⚠️ Its own pass, NOT folded into Pass 1 alongside the tabs — found the hard way.
    // `app/health-form.tsx` is `tier="sub"` (confirmed by reading the file, not assumed from an
    // older comment): a pushed screen with NO BottomNav, exactly like `settings` and
    // `medicine-form`. An earlier version of this step assumed the opposite — "a pushed screen,
    // but one that KEEPS BottomNav" — copied from when Health was still a bottom-nav tab, and
    // that claim was never re-checked against the file itself even before this session's nav
    // restructure (its own "stale comment" note is a few lines below where this one now lives:
    // "this step had been silently skipping" since 2026-08-11 for an unrelated reason, meaning
    // nobody had actually watched it run to completion since). Trying to click back onto the
    // BottomNav from here hung `locator.click()` outright rather than failing cleanly — see
    // `goHome`'s own header for that mechanism — which is what surfaced the false claim.
    try {
      await walkToTabs(page, { scanning: false });
      await goHome(page);
      await dismissModalIfPresent(page);
      // The composer's option rows (and so "More options") only render once the field is
      // focused or has text — the same tier-2 rule every quick-add follows.
      const symptomLine = page.getByLabel(L.logSymptom, { exact: true }).first();
      await symptomLine.scrollIntoViewIfNeeded({ timeout: 5000 });
      await symptomLine.click({ timeout: 10000 });
      await page.waitForTimeout(500);
      await clickText(page, L.logSymptomMore);
      await page.waitForTimeout(1100);
      await scan(page, 'health-form');
    } catch (e) {
      console.error(`  (health-form step skipped: ${e.message.split('\n')[0]})`);
    }

    // ── Pass 3: the medicine editor ──
    // The other dead end (full-screen, no BottomNav), so it gets a pass of its own rather
    // than a goBack() — which would reload the document, reset the sql.js DB and land back
    // in onboarding mid-walk. Onboarding is re-walked without scanning, since its screens
    // are identical to pass 1 and would only duplicate findings.
    try {
      await walkToTabs(page, { scanning: false });
      // Health is a Home card now, not a tab — see the health-form step's comment above.
      // walkToTabs already lands on Home, so `goHome` below is a no-op here in practice — kept
      // for the same reason every other call site uses it: cheap, and correct if that ever
      // changes.
      await goHome(page);
      await dismissModalIfPresent(page);
      // The editor needs a medicine to open, and a fresh profile has none.
      const medBar = page.getByRole('button', { name: L.addMedicine, exact: true }).first();
      await medBar.scrollIntoViewIfNeeded({ timeout: 5000 });
      await medBar.click({ timeout: 10000 });
      await page.waitForTimeout(400);
      const medField = page.getByPlaceholder(L.addMedicine).first();
      await medField.scrollIntoViewIfNeeded({ timeout: 5000 });
      await medField.fill(L.probeMed);
      await medField.press('Enter');
      await page.waitForTimeout(900);
      await clickText(page, L.probeMed);
      await page.waitForTimeout(1100);
      await scan(page, 'medicine-form');
    } catch (e) {
      console.error(`  (medicine-form step skipped: ${e.message.split('\n')[0]})`);
    }

    // ── Pass 4: the To-do tab (task editor + Goals drawer) ──
    // It stopped being a tab on 2026-08-20 (5 → 3), reached instead by tapping the merged
    // card's title on Home — and the SAME-DAY "full-screen card expansion" pass reversed
    // that hours later: To-do is a real tab again (BottomNav present throughout), no longer a
    // pushed `tier="sub"` dead end. It stays its own pass anyway — not folded into the tabs
    // loop above — because the task editor and Goals drawer it opens need a task/goal to
    // exist first, on a profile the tabs loop leaves empty.
    try {
      await walkToTabs(page, { scanning: false });
      await page.getByRole('button', { name: L.tabs[1], exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(900);
      await dismissModalIfPresent(page);

      // The task editor: the densest form in the app, and invisible to this audit until
      // 2026-08-01. It is only reachable by opening a task, and a fresh profile has none, so
      // one is created here first. This is where the sliced voice mic (#465) lived.
      // ⚠️ There is no "All tasks" tab to switch to any more — the To-do tab's TabSlider
      // (Today/This week/All tasks) is gone, replaced by four always-visible cards (Whenever,
      // Today, Week, Recurring; components/TodoSurface.tsx). `.first()` on the "New task"
      // composer takes whichever card's AddRow comes first in the layout — any of them opens
      // the same editor once a task exists, which is all this step needs.
      // ⚠️ **Open the Whenever card first (2026-08-21).** Every card rests closed now, so its
      // `AddRow` composer — the `.first()` "New task" button below — is not drawn at all until
      // the card is unfolded. Without this the whole step timed out and SKIPPED, which is the
      // silent failure mode AGENTS.md warns about: the run still prints totals, and the app's
      // densest form simply stops being measured.
      const whenever = page.getByRole('button', { name: L.expandWhenever, exact: true }).first();
      await whenever.scrollIntoViewIfNeeded({ timeout: 5000 });
      await whenever.click({ timeout: 10000 });
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: L.newTask, exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(400);
      const field = page.getByPlaceholder(L.newTask).first();
      await field.fill(L.probeTask);
      await field.press('Enter');
      await page.waitForTimeout(900);
      // Tapping the row opens the inline editor (components/TaskCard.tsx, variant="full").
      // ⚠️ `.last()`, not `.first()`/`clickText` — found the hard way. Home's own preview card
      // (components/PlanTaskCard.tsx) ALSO renders this undated task once it exists, and all
      // three main tabs are mounted at once (`lazy: false` pager, Shop/Home/To-do in that DOM
      // order) — so two "Wrap audit probe" text nodes exist simultaneously, Home's sitting a
      // full screen-width to the LEFT of the currently-active To-do page. Both report
      // `isVisible() === true` (Playwright's visibility check doesn't know about the pager's
      // off-screen slot), so `clickText`'s own "first visible match" logic picked Home's copy
      // just as often as `.first()` did — every attempt reported the resolved element's box at
      // a several-hundred-px NEGATIVE x, and no amount of scrolling (`scrollIntoViewIfNeeded`,
      // a real mouse wheel) could bring an element on a DIFFERENT pager page into this one's
      // viewport, so the "element is outside of the viewport" retry loop never converged.
      // To-do is mounted LAST among the three tabs, so its own copy is the last match.
      const probeRow = page.getByText(L.probeTask, { exact: true }).last();
      await probeRow.scrollIntoViewIfNeeded({ timeout: 5000 });
      await probeRow.click({ timeout: 10000 });
      await page.waitForTimeout(1000);
      await scan(page, 'task-editor');

      // Goals (measured with the editor still open above it, as it always has been — the
      // drawer sits at the foot of the scroll content, well below it): an in-card drawer as of 2026-08-12, not a popup — components/GoalsEditor.tsx is
      // mounted straight into the drawer body and components/GoalsSheet.tsx is deleted
      // (maintainer: "This should not be a pop-up... making, editing and deleting in the card,
      // not a pop up."). Clicking the label expands it in place.
      // `.last()`, not `.first()`: the task editor left open above carries its own Goal
      // PICKER, whose label is the same word, and that copy sits inside a collapsed section
      // that cannot be scrolled into view — which is what made this step time out and skip
      // silently. The drawer is at the foot of the scroll content, after everything else, so
      // the last match is the right one. Same trick the shopping-drawers step uses.
      const link = page.getByText(L.editGoals, { exact: true }).last();
      await link.scrollIntoViewIfNeeded({ timeout: 5000 });
      await link.click({ timeout: 10000 });
      await page.waitForTimeout(900);
      await scan(page, 'goals-drawer');
    } catch (e) {
      console.error(`  (todo-screen step skipped: ${e.message.split('\n')[0]})`);
    }

    // ── The six-row Basics form ──
    // Onboarding only draws its language row since 2026-08-03, but the full six-row version
    // still exists behind Settings → Personal → Layout → "Run setup again", and it is still
    // the tightest horizontal case in the app: six rows of pills, three across at the widest,
    // and a row of three Norwegian labels is the worst of those. Scanned explicitly so
    // shortening onboarding does not quietly remove the densest screen from this audit's
    // coverage. Best-effort, like the task editor — a failure must not lose the findings
    // already collected.
    try {
      await page.goto(`${BASE_URL}/onboarding/basics?rows=all`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1200);
      await scan(page, 'basics-all-rows');
    } catch (e) {
      console.error(`  (basics-all-rows step skipped: ${e.message.split('\n')[0]})`);
    }
  } finally {
    await browser.close();
  }

  if (AS_JSON) { console.log(JSON.stringify(screens, null, 1)); return; }

  const allTexts = screens.flatMap((s) => s.texts.map((t) => ({ ...t, screen: s.name })));
  const allRows = screens.flatMap((s) => s.rows.map((r) => ({ ...r, screen: s.name })));
  const allClipped = screens.flatMap((s) => (s.clipped || []).map((c) => ({ ...c, screen: s.name })));
  const uniq = (arr, key) => {
    const seen = new Set();
    return arr.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; });
  };

  console.log(`\n=== wrap audit — lang=${LANG} width=${WIDTH}px ===\n`);

  // Listed first, and deliberately: unlike the other three this one has no "confirm on
  // device" caveat and no judgement call. A control sliced by an overflow mask is a bug at
  // every width where it reproduces.
  const clip = uniq(allClipped, (c) => `${c.screen}|${c.axis}|${c.near}|${c.over}`);
  console.log(`CLIPPED controls (sliced by an ancestor's overflow mask): ${clip.length}`);
  for (const c of clip.sort((a, b) => b.over - a.over)) {
    const dim = c.axis === 'y' ? 'h' : 'w';
    const what = c.label || c.text;
    console.log(`  [${c.axis}] ${c.over}px past the edge | ${c.tag} ${dim}=${c.size} inside a ${c.clipperSize}px box `
      + `[${c.screen}]${what ? ` "${what}"` : ''} near ${JSON.stringify(c.near)}`);
    if (process.env.WRAP_DEBUG) console.log(`      ${c._dbg}`);
  }

  const rowsWrapped = uniq(allRows, (r) => r.sample);
  console.log('');
  console.log(`CONTROL ROWS that wrapped (cannot be fixed by shortening copy): ${rowsWrapped.length}`);
  for (const r of rowsWrapped.sort((a, b) => a.short - b.short)) {
    console.log(`  short by ${r.short}px | ${r.children} items on ${r.linesUsed} lines | `
      + `avail=${r.avail} needed=${r.needed} widest=${r.widestChild} [${r.screen}] ${r.sample}`);
  }

  const trunc = uniq(allTexts.filter((t) => t.kind === 'truncated'), (t) => t.text);
  console.log(`\nTRUNCATED single-line text: ${trunc.length}`
    + `\n  (confirm on device — adjustsFontSizeToFit/minimumFontScale are not emulated on web,`
    + `\n   so an auto-shrinking label like BottomNav's shows up here but is fine natively)`);
  for (const t of trunc.sort((a, b) => b.needForOne - a.needForOne)) {
    console.log(`  over by ${t.needForOne}px | avail=${t.avail} ${t.fontSize} [${t.screen}] ${JSON.stringify(t.text)}`);
  }

  const near = uniq(allTexts.filter((t) => t.kind === 'wrapped' && t.lines === 2
    && t.needForOne > 0 && t.needForOne <= 60), (t) => t.text.slice(0, 44));
  console.log(`\nNEAR-MISS wrapped text (would fit on one line with <=60px more): ${near.length}`);
  for (const t of near.sort((a, b) => a.needForOne - b.needForOne)) {
    console.log(`  +${t.needForOne}px | avail=${t.avail} ${t.fontSize} [${t.screen}] ${JSON.stringify(t.text)}`);
  }

  const totalWrapped = allTexts.filter((t) => t.kind === 'wrapped').length;
  console.log(`\nscreens measured: ${screens.map((s) => s.name).join(', ')}`);
  console.log(`totals: ${totalWrapped} wrapped, ${allTexts.filter((t) => t.kind === 'truncated').length} truncated, `
    + `${allRows.length} wrapped rows, ${allClipped.length} clipped\n`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
