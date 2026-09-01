#!/usr/bin/env node
/**
 * measure-geometry.mjs — the app's VERTICAL geometry audit
 *
 * WHY THIS EXISTS. The other three harnesses each answer one question and none of them is this
 * one. `wraps` measures HORIZONTAL overflow, `halos` measures whether a field's glow is sliced,
 * `visual` catches a change against a blessed baseline. **Nothing measured whether a thing is
 * where it says it is vertically** — so "the tab slider in Settings is still not vertically
 * centred" was a defect no check in this repo could see, reported by eye, twice.
 *
 * It measures NUMBERS in the live DOM and compares them against the tokens that are supposed to
 * produce them. A source scan cannot do this: every one of these values is correct in the style
 * sheet and wrong on screen, because what a box ends up as depends on its parent, its siblings
 * and whatever is painted over it.
 *
 * Usage:
 *   npm run geometry
 *   npm run geometry -- --width=360
 *   npm run geometry -- --theme=dark
 *   FORCE_BUILD=1 npm run geometry
 *
 * Exits 1 on any finding.
 *
 * The five checks, in the order they run:
 *   1  chrome-overlap        — one band painting over another
 *   1b chrome-inset          — every chrome card on ONE horizontal inset
 *   2  control-not-centred   — a sticky-bar control centred in what is VISIBLE
 *   3  nav-corner-notch      — content can reach the bottom bar's rounded top corners
 *   4  nav-item-not-centred  — a nav item centred in the bar as PAINTED, not as reserved
 *   5  pill-not-centred      — TabSlider's active pill against its own segments
 *
 * Checks 3-5 were added 2026-08-31 and every one of them closed a hole the audit had while
 * claiming to cover chrome geometry: the bottom nav matched no picker at all (`pickHeader` wants
 * `top <= 1`), and the tab pill entered no list (no role, no name, `pointerEvents: none`) so
 * "the tab slider is off-centre" was measured by looking at its neighbours.
 *
 * ⚠️ Same faithfulness caveat as every web-preview harness: react-native-web is honest about
 * LAYOUT (which is what this measures) and dishonest about shadows, font metrics and Reanimated
 * timing. In particular `constants/theme.ts`'s `OpticalCenter` is Android-only and a no-op here,
 * so a label mis-centred by Android font padding is invisible to this audit BY CONSTRUCTION —
 * that class is covered by the source scan in `lib/__tests__/designTokens.test.ts` instead, and
 * the residual still needs a device. What this catches is geometry: overlap, asymmetry, a gap
 * that does not match its token, and a corner nothing can fill.
 */
import { chromium } from '@playwright/test';
import { resolveChromium } from './chromium-path.mjs';
import { forceAppearance, themeFromArgs } from './force-appearance.mjs';

const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const args = process.argv.slice(2);
const WIDTH = Number(args.find((a) => a.startsWith('--width='))?.split('=')[1] || 430);
const CHROMIUM_PATH = resolveChromium();
// ⚠️ Dark is the DEFAULT app appearance, and this audit ran light-only in CI until 2026-09-01 —
// see AGENTS.md's visual-gate section. `--theme=dark` forces it via force-appearance.mjs.
const { theme: THEME, darkModeValue: DARK_MODE_VALUE } = themeFromArgs(args);

/**
 * How far out of true a measurement may be before it is a finding, in CSS px.
 *
 * **0.5 since 2026-08-31**, down from 1.0. The old value was set before this audit could explain
 * any of the sub-pixel noise it was budgeting for; it now can. The one systematic sub-tolerance
 * skew it ever printed was `HEADER_SEAM_OVERLAP`'s deliberate hairline (a uniform -1 on all three
 * Settings segments), and a hairline at dpr 1 is 1px — so a 1.0px budget was exactly wide enough
 * to hide one real, explained, app-wide offset. 0.5 still clears genuine fractional layout
 * (`StyleSheet.hairlineWidth` boxes land on .5 boundaries, not past them).
 *
 * ⚠️ If a runner ever shows noise of its own, raise this **with the measurement in hand** — the
 * same rule the pixel gate's 24px budget was fixed under. Do not raise it to make a red run green.
 */
const TOLERANCE = 0.5;

/** Screens to walk. Each is [label, how to get there] — the tab bar, plus Settings. */
const TABS = ['Shop', 'To-do', 'Home', 'Habits', 'Health'];

const findings = [];
const measured = [];

function finding(screen, check, detail, hint) {
  findings.push({ screen, check, detail, hint });
}

// ---------------------------------------------------------------------------
// in-page measurement
// ---------------------------------------------------------------------------

/**
 * Everything is gathered in ONE evaluate per screen and analysed in node, so the checks are
 * plain data transforms that can be reasoned about without a browser in the loop.
 */
const COLLECT = () => {
  const box = (el) => {
    const b = el.getBoundingClientRect();
    return { top: +b.top.toFixed(2), bottom: +b.bottom.toFixed(2), left: +b.left.toFixed(2), right: +b.right.toFixed(2), h: +b.height.toFixed(2), w: +b.width.toFixed(2) };
  };
  const all = [...document.querySelectorAll('*')];

  // The floating chrome: ScreenScaffold's header block (zIndex 100), an optional
  // stickyBelowHeader block (99) and the bottom block (100). They are the only absolutely
  // positioned, full-width, z-declaring boxes near the top and bottom of the window.
  const chrome = all
    .filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== 'absolute') return false;
      const z = parseInt(cs.zIndex, 10);
      if (!(z === 99 || z === 100)) return false;
      const b = el.getBoundingClientRect();
      // Full-width bands only — this excludes badges and pills that also declare a z.
      return b.width > window.innerWidth * 0.9 && b.height > 16 && b.height < 260;
    })
    .map((el) => {
      // ⚠️ The BAND is full-bleed (`left: 0, right: 0` on ScreenScaffold's header/sticky blocks),
      // so comparing bands tells you nothing about horizontal inset — they are all the same
      // width by construction, which is exactly why the first version of this audit passed over
      // a bar sticking 8pt out past its header. What is actually inset is the painted CARD
      // inside the band, so find that: the widest descendant that paints a background and is
      // narrower than the viewport.
      let painted = null;
      let paintedRadius = null;
      for (const child of el.querySelectorAll('*')) {
        const cs = getComputedStyle(child);
        const bg = cs.backgroundColor;
        if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') continue;
        const cb = child.getBoundingClientRect();
        if (cb.width < window.innerWidth * 0.5 || cb.width > window.innerWidth - 1) continue;
        if (cb.height < 12) continue;
        if (!painted || cb.width > painted.width) {
          painted = cb;
          // The corner the content edge has to meet. Read off the painted card, because the
          // BAND is square and full-bleed — see the note above.
          paintedRadius = {
            topLeft: parseFloat(cs.borderTopLeftRadius) || 0,
            topRight: parseFloat(cs.borderTopRightRadius) || 0,
            bottomLeft: parseFloat(cs.borderBottomLeftRadius) || 0,
            bottomRight: parseFloat(cs.borderBottomRightRadius) || 0,
          };
        }
      }
      return {
        z: parseInt(getComputedStyle(el).zIndex, 10),
        ...box(el),
        paintedLeft: painted ? +painted.left.toFixed(2) : null,
        paintedRight: painted ? +painted.right.toFixed(2) : null,
        paintedTop: painted ? +painted.top.toFixed(2) : null,
        paintedBottom: painted ? +painted.bottom.toFixed(2) : null,
        paintedRadius,
      };
    })
    .sort((a, b) => a.top - b.top);

  // Any control that carries an accessible name and sits inside one of those bands. Used for
  // the centring check: a control in a band the caller sized exactly should sit in its middle.
  const controls = [];
  for (const el of all) {
    const label = el.getAttribute('aria-label');
    const role = el.getAttribute('role');
    // `data-testid` is the third way in, and it is what lets a decorative box be measured at all.
    // components/TabSlider.tsx's active pill has no role, no name and `pointerEvents: none`, so
    // for as long as this list was (name || button) the audit measured where the SEGMENTS sit and
    // never where the pill sits inside them.
    const testid = el.getAttribute('data-testid');
    if (!label && role !== 'button' && !testid) continue;
    const b = el.getBoundingClientRect();
    if (b.height < 8 || b.width < 8) continue;
    controls.push({ label: label || testid || (el.textContent || '').trim().slice(0, 30), role, testid, ...box(el) });
  }

  // The scroll CLIP window — `styles.viewport` in components/ScreenScaffold.tsx, the
  // `overflow: hidden` box that decides how far a card may travel behind the chrome. It is not
  // absolutely positioned and declares no z, so it is not a "band"; it is found by shape: inset
  // from both screen edges (that inset is `viewportInset.marginHorizontal`), and tall.
  let clipEl = null;
  let clipH = 0;
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.overflow !== 'hidden' && cs.overflowY !== 'hidden') continue;
    const b = el.getBoundingClientRect();
    if (b.width > window.innerWidth - 1 || b.width < window.innerWidth * 0.8) continue;
    if (b.height < window.innerHeight * 0.4) continue;
    if (b.height > clipH) { clipEl = el; clipH = b.height; }
  }

  return {
    chrome,
    controls,
    clip: clipEl ? box(clipEl) : null,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
};

// ---------------------------------------------------------------------------
// checks
// ---------------------------------------------------------------------------

/**
 * CHECK 1 — no chrome band may paint over another.
 *
 * ScreenScaffold's header block is zIndex 100 and an attached sticky bar is 99, so wherever
 * their painted boxes overlap the HEADER WINS and that many pixels of the sticky bar are simply
 * not on screen. The bar's own content is still centred in its full declared height, so every
 * overlapped pixel comes off ONE END — which is precisely how a perfectly-specified control
 * ends up looking like it is sitting low.
 *
 * This is the shape of the 2026-08-29 Settings tab-slider report, and it is invisible to every
 * other check: the styles are right, the reserved height is right, and the screenshot shows a
 * bar that is merely a hairline short.
 */
function checkChromeOverlap(screen, bands) {
  const header = pickHeader(bands);
  const sticky = pickSticky(bands);
  if (!header || !sticky) return; // most screens have no sticky bar; nothing to compare.

  const overlap = +(header.bottom - sticky.top).toFixed(2);
  if (overlap > TOLERANCE) {
    finding(
      screen,
      'chrome-overlap',
      `the header (z${header.z}, ends ${header.bottom}) paints ${overlap}px over the sticky bar ` +
        `(z${sticky.z}, starts ${sticky.top})`,
      'The higher band wins, so those pixels come off ONE END of the bar while its content is ' +
        'still centred in the full declared height — which is how a correctly-specified control ' +
        'ends up reading as offset. See HEADER_SEAM_OVERLAP in components/ScreenScaffold.tsx.',
    );
  }
}

/**
 * CHECK 1b — every chrome band shares ONE horizontal inset.
 *
 * ⚠️ **This check exists because the audit's first version did not have it and therefore missed
 * the very defect it was written to find.** "The tab-slider in Settings is not vertically
 * centred" was reported twice; the vertical measured fine (3px above / 4px below on web, 10 and
 * 11 device px on the maintainer's own screenshot — centred to within half a point). What the
 * eye was actually reading was HORIZONTAL: the sticky tab bar was inset 8pt where the header
 * above it and every card below it were inset 16, so a strip the 2026-08-10 rule calls ONE card
 * was drawn at two widths, with the wider piece in the middle of the stack.
 *
 * The lesson worth keeping: a report names the symptom the reporter has words for, not the axis
 * the bug is on. Measure both.
 *
 * Round 20 phase 1's rule is "one horizontal inset for header, cards and nav", so the header's
 * own inset is the reference and everything else is compared to it.
 */
function checkChromeInset(screen, bands) {
  const header = pickHeader(bands);
  const sticky = pickSticky(bands);
  if (!header || !sticky) return;

  // The painted cards, not the full-bleed bands — see COLLECT.
  if (header.paintedLeft == null || sticky.paintedLeft == null) return;
  const dLeft = +(sticky.paintedLeft - header.paintedLeft).toFixed(2);
  const dRight = +(header.paintedRight - sticky.paintedRight).toFixed(2);
  measured.push({ screen, what: 'sticky inset', gapTop: dLeft, gapBottom: dRight, skew: 0, inset: true });
  if (Math.abs(dLeft) > TOLERANCE || Math.abs(dRight) > TOLERANCE) {
    finding(
      screen,
      'chrome-inset',
      `the sticky bar is inset ${sticky.paintedLeft} where the header is ${header.paintedLeft} ` +
        `(left off by ${dLeft}px, right by ${dRight}px)`,
      'Round 20 phase 1: one horizontal inset for header, cards and nav. Name ' +
        'CHROME_FLOAT_INSET at the caller rather than repeating a number — a bar that sticks ' +
        'out past the header reads as misalignment, and gets reported as anything but.',
    );
  }
}

/**
 * CHECK 2 — a control inside a chrome band sits in the middle of what is VISIBLE.
 *
 * Deliberately measured against the visible band (the declared box minus anything painted over
 * it by a higher band), not against the declared box. Measuring against the declared box is what
 * every style sheet already asserts and is exactly why this defect survived: the numbers agree
 * with themselves and disagree with the screen.
 */
function checkControlCentring(screen, bands, controls) {
  const header = pickHeader(bands);
  const sticky = pickSticky(bands);
  if (!sticky) return;

  // The bar's VISIBLE band: its declared box minus whatever the header paints over the top of it.
  const visibleTop = header && header.bottom > sticky.top ? header.bottom : sticky.top;
  const visibleBottom = sticky.bottom;

  // The bar's own controls — the segments. Fully inside it, and materially shorter than it, so
  // there are gaps to compare at all.
  const inside = controls.filter(
    (c) => c.top >= sticky.top - 1 && c.bottom <= sticky.bottom + 1 && c.h < sticky.h - 2 && c.h > 8,
  );
  for (const c of inside) {
    const gapTop = +(c.top - visibleTop).toFixed(2);
    const gapBottom = +(visibleBottom - c.bottom).toFixed(2);
    const skew = +(gapTop - gapBottom).toFixed(2);
    measured.push({ screen, what: c.label, gapTop, gapBottom, skew });
    if (Math.abs(skew) > TOLERANCE) {
      finding(
        screen,
        'control-not-centred',
        `"${c.label}" sits ${Math.abs(skew)}px too ${skew > 0 ? 'low' : 'high'} in the visible ` +
          `sticky bar (${gapTop}px above, ${gapBottom}px below)`,
        'Either the bar is painted over at one end (see chrome-overlap) or the control is ' +
          'centred in a box taller than the one it is drawn in.',
      );
    }
  }
}

/**
 * CHECK 3 — content must be able to reach the bottom bar's rounded top corners.
 *
 * ⚠️ **This check exists because the app shipped the bug it finds, twice, in opposite
 * directions, and no harness here could see either.** The maintainer's standing ruling
 * (2026-08-20, quoted verbatim in components/BottomNav.tsx) is: *"both header card and bottom
 * nav should only have rounded corners. And yes, the corners should show content behind it, no
 * gaps like has been before."*
 *
 * The bar rounds all four corners at `Radius.lg`. The bar is OPAQUE, so a card travelling under
 * it is hidden, not sliced — except in the two top-corner boxes, where the card's own pixels are
 * the only thing that can fill the area the radius vacates. If the scroll clip stops AT the
 * bar's top edge, nothing can enter, and each corner is `r^2(1 - pi/4)` of bare backdrop: about
 * 124px^2 at r=24. That is the reported "corner-bug", and it is the *feature* the ruling asks for
 * when it goes the other way.
 *
 * So the invariant is one comparison: the clip window's bottom edge must reach past the painted
 * bar's top edge by at least the corner radius. Purely geometric, and true of the resting layout
 * — no scrolling required, which is what makes it checkable at all.
 */
function checkNavCornerNotch(screen, bands, clip, viewportH) {
  const nav = pickNav(bands, viewportH);
  if (!nav || !clip) return;
  if (nav.paintedTop == null || !nav.paintedRadius) return;

  const r = Math.max(nav.paintedRadius.topLeft, nav.paintedRadius.topRight);
  if (r <= 0) return; // a square-topped bar has no notch to fill.

  const reach = +(clip.bottom - nav.paintedTop).toFixed(2);
  measured.push({ screen, what: 'nav corner', reach, need: r, corner: true });
  if (reach < r - TOLERANCE) {
    finding(
      screen,
      'nav-corner-notch',
      `content is clipped ${reach}px past the bar's painted top edge, but its corners are ` +
        `${r}px — so roughly ${Math.round(r * r * (1 - Math.PI / 4))}px² in each top corner can ` +
        'only ever be bare backdrop',
      "The bar is opaque, so content under it is hidden rather than sliced — the clip window " +
        'should run the bar\'s full height and let a card fill the notches on the way past. See ' +
        '`viewportInset.marginBottom` in components/ScreenScaffold.tsx, and the 2026-08-20 ruling ' +
        'quoted in components/BottomNav.tsx.',
    );
  }
}

/**
 * CHECK 4 — a nav item sits in the middle of the bar it is PAINTED in.
 *
 * The same shape as CHECK 2 but against the bottom band, which no picker matched before
 * 2026-08-31: `pickHeader` requires `top <= 1`, so a bottom-anchored z-100 band was collected
 * and then compared to nothing at all.
 *
 * Measured against the painted CARD, never the band. The band is
 * `BOTTOM_NAV_HEIGHT + insetsBottom + NAV_FLOAT_GAP` — it deliberately includes the safe area and
 * the float gap — so centring an item in the band is not the question anyone is asking. The card
 * is also the box that can disagree with its own reserved height: `Surface` puts
 * `BORDER_WIDTH.card` on all four sides of its mask, so a 56-tall content box paints 59.
 */
function checkNavCentring(screen, bands, controls, viewportH) {
  const nav = pickNav(bands, viewportH);
  if (!nav || nav.paintedTop == null) return;

  const inside = controls.filter(
    (c) => c.role === 'button' &&
      c.top >= nav.paintedTop - 1 && c.bottom <= nav.paintedBottom + 1 &&
      c.h < (nav.paintedBottom - nav.paintedTop) - 1 && c.h > 8,
  );
  for (const c of inside) {
    const gapTop = +(c.top - nav.paintedTop).toFixed(2);
    const gapBottom = +(nav.paintedBottom - c.bottom).toFixed(2);
    const skew = +(gapTop - gapBottom).toFixed(2);
    measured.push({ screen: `${screen}/nav`, what: c.label, gapTop, gapBottom, skew });
    if (Math.abs(skew) > TOLERANCE) {
      finding(
        screen,
        'nav-item-not-centred',
        `nav item "${c.label}" sits ${Math.abs(skew)}px too ${skew > 0 ? 'low' : 'high'} in the ` +
          `painted bar (${gapTop}px above, ${gapBottom}px below)`,
        "The bar's reserved height and its PAINTED height are two numbers — Surface's mask adds " +
          'BORDER_WIDTH.card on every side. Reserve the painted height in the host wrapper ' +
          '(app/(tabs)/_layout.tsx), not the content height.',
      );
    }
  }
}

/**
 * CHECK 5 — components/TabSlider.tsx's active pill sits in the middle of its track.
 *
 * "The tab slider is not vertically centred" has now been reported three times. The first was
 * horizontal (CHECK 1b). This is the one the words actually describe, and it was unmeasurable
 * until the pill was given a `testID`: it has no role, no accessible name and
 * `pointerEvents: none`, so it never entered `controls`, and CHECK 2 was measuring the SEGMENTS —
 * a pill offset inside a correctly-centred segment row is invisible to that.
 *
 * ⚠️ What this still cannot see, by construction: `OpticalCenter`. Android's `includeFontPadding`
 * has no react-native-web equivalent, so a LABEL riding high inside a correctly-placed pill
 * renders perfectly here. That class is covered by the source scan in
 * `lib/__tests__/designTokens.test.ts` instead, and the residual needs a device.
 */
function checkPillCentring(screen, controls) {
  const pill = controls.find((c) => c.testid === 'tabslider-pill');
  if (!pill) return; // most screens have no slider; nothing to measure.

  // The track is the pill's own offset parent in practice, but we do not have it here — so use
  // the segments beside it, which ARE named. The pill should be centred on the same line they are.
  const segs = controls.filter(
    (c) => c.role === 'button' && c.testid == null &&
      c.top > pill.top - 24 && c.bottom < pill.bottom + 24 && c.h > 8,
  );
  if (!segs.length) return;
  const segTop = Math.min(...segs.map((sg) => sg.top));
  const segBottom = Math.max(...segs.map((sg) => sg.bottom));
  const gapTop = +(pill.top - segTop).toFixed(2);
  const gapBottom = +(segBottom - pill.bottom).toFixed(2);
  const skew = +(gapTop - gapBottom).toFixed(2);
  measured.push({ screen: `${screen}/pill`, what: 'active pill', gapTop, gapBottom, skew });
  if (Math.abs(skew) > TOLERANCE) {
    finding(
      screen,
      'pill-not-centred',
      `the active pill sits ${Math.abs(skew)}px too ${skew > 0 ? 'low' : 'high'} against its ` +
        `segments (${gapTop}px above, ${gapBottom}px below)`,
      'components/TabSlider.tsx measures `trackH` off the inner row and places the pill at ' +
        '`top: TRACK_PAD` with `height: trackH - TRACK_PAD * 2`. If those disagree with the ' +
        'segments, the onLayout target is the wrong box — it must be the row, not the bordered wrap.',
    );
  }
}

/**
 * The bottom-nav band: the full-width z-100 box anchored at the BOTTOM of the window.
 *
 * `pickHeader` requires `top <= 1`, so until this existed the nav was collected into `chrome` and
 * then matched by no picker and measured by no check — the whole bar was a blind spot in an audit
 * whose stated job is where chrome sits.
 */
function pickNav(bands, viewportH) {
  const h = viewportH ?? 932;
  const b = bands.filter((x) => x.z === 100 && x.bottom >= h - 2 && x.top > 1);
  if (!b.length) return null;
  return b.reduce((best, x) => (x.h > best.h ? x : best), b[0]);
}

/**
 * The header band: the topmost full-width z-100 box anchored at the very top of the window.
 *
 * ⚠️ Picked by geometry rather than by taking `bands[0]`, and deduped to the OUTERMOST box at
 * that position. react-native-web wraps a View in several divs and more than one of them can be
 * absolute with a z, so a naive sweep reports a container and its own child as two bands
 * "overlapping" by their full height — which is nesting, not overlap, and was the first thing
 * this audit got wrong.
 */
function pickHeader(bands) {
  const top = bands.filter((b) => b.z === 100 && b.top <= 1);
  if (!top.length) return null;
  return top.reduce((best, b) => (b.bottom > best.bottom ? b : best), top[0]);
}

/** The stickyBelowHeader band: ScreenScaffold gives it zIndex 99 and nothing else uses that. */
function pickSticky(bands) {
  const s = bands.filter((b) => b.z === 99 && b.top > 1);
  if (!s.length) return null;
  return s.reduce((best, b) => (b.h > best.h ? b : best), s[0]);
}

// ---------------------------------------------------------------------------
// walk
// ---------------------------------------------------------------------------

async function clickText(page, text, timeout = 10000) {
  const l = page.getByText(text, { exact: true }).first();
  await l.waitFor({ state: 'attached', timeout });
  await l.click({ timeout });
}

async function runOnboarding(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1300);
  await page.getByRole('radio', { name: /^Språk: English\./ }).first().click({ timeout: 10000 });
  await page.waitForTimeout(700);
  await clickText(page, 'Continue');
  await page.waitForTimeout(900);
  await clickText(page, 'Start');
  await page.waitForTimeout(2200);
  const skip = page.getByText('Skip the tour', { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click({ timeout: 8000 });
    await page.waitForTimeout(800);
  }
}

async function scan(page, screen) {
  await page.waitForTimeout(500);
  const { chrome, controls, clip, viewport } = await page.evaluate(COLLECT);
  if (!chrome.length) {
    // ⚠️ Fail, never skip. A screen that measures NOTHING and says nothing is how the other two
    // audits in this repo rotted — see AGENTS.md on `wraps` un-measuring two whole tabs.
    finding(screen, 'un-measured', 'no chrome bands found — the walk is looking at the wrong thing', 'Fix the walk.');
    return;
  }
  checkChromeOverlap(screen, chrome);
  checkChromeInset(screen, chrome);
  checkControlCentring(screen, chrome, controls);
  checkNavCornerNotch(screen, chrome, clip, viewport.h);
  checkNavCentring(screen, chrome, controls, viewport.h);
  checkPillCentring(screen, controls);
  console.log(
    `  ${screen}: ${chrome.length} chrome band(s), ${controls.length} control(s)` +
      `${clip ? '' : ', ⚠️ no clip window found'}`,
  );
}

const EXPECTED_SCREENS = TABS.length + 1; // the five tabs plus Settings
let screensScanned = 0;

const browser = await chromium.launch({
  executablePath: CHROMIUM_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 932 } });
  await forceAppearance(page, DARK_MODE_VALUE);
  await runOnboarding(page);

  for (const name of TABS) {
    await page.getByRole('button', { name, exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(900);
    await scan(page, name);
    screensScanned += 1;
  }

  // Settings is a pushed dead end (no in-app back on web), so it goes last.
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click({ timeout: 10000 });
  await page.waitForTimeout(1600);
  await scan(page, 'settings');
  screensScanned += 1;
} finally {
  await browser.close();
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

console.log(`\n── geometry (${WIDTH}px, ${THEME}) ──────────────────────────────────`);
console.log(`coverage: ${screensScanned} screens scanned, expected ${EXPECTED_SCREENS}`);

// Print the measurements even when nothing trips the gate. A verdict alone is what let the
// other audits in this repo report confidently about less and less of the app; a number in
// front of the reader is also the only way a sub-tolerance but SYSTEMATIC skew (every segment
// off the same way, in the same direction) is visible at all — which is exactly the shape the
// Settings tab-slider report turned out to have.
if (measured.length) {
  console.log('\nmeasured (gap above / below, + = sits low; inset rows are left/right vs the header):');
  for (const m of measured) {
    if (m.corner) {
      const bad = m.reach < m.need - TOLERANCE;
      console.log(`  [${m.screen}] ${String(m.what).padEnd(12)} reaches ${String(m.reach).padStart(6)} past the bar's top edge, needs ${m.need}${bad ? ' ←' : ''}`);
      continue;
    }
    if (m.inset) {
      const bad = Math.abs(m.gapTop) > TOLERANCE || Math.abs(m.gapBottom) > TOLERANCE;
      console.log(`  [${m.screen}] ${String(m.what).padEnd(12)} ${String(m.gapTop).padStart(6)} / ${String(m.gapBottom).padStart(6)}   (left/right vs header)${bad ? ' ←' : ''}`);
      continue;
    }
    const flag = Math.abs(m.skew) > TOLERANCE ? ' ←' : '';
    console.log(`  [${m.screen}] ${String(m.what).padEnd(12)} ${String(m.gapTop).padStart(6)} / ${String(m.gapBottom).padStart(6)}   skew ${m.skew >= 0 ? '+' : ''}${m.skew}${flag}`);
  }
}

if (findings.length === 0) {
  console.log('\ngeometry: clean ✓');
} else {
  const byCheck = new Map();
  for (const f of findings) {
    if (!byCheck.has(f.check)) byCheck.set(f.check, []);
    byCheck.get(f.check).push(f);
  }
  for (const [check, list] of byCheck) {
    console.log(`\n${check} — ${list.length}`);
    for (const f of list) console.log(`  [${f.screen}] ${f.detail}`);
    console.log(`  ^ ${list[0].hint}`);
  }
}

if (screensScanned < EXPECTED_SCREENS) {
  console.error(`\n⚠️  UN-MEASURED: ${EXPECTED_SCREENS - screensScanned} screen(s) did not run.`);
  process.exit(1);
}
process.exit(findings.length ? 1 : 0);
