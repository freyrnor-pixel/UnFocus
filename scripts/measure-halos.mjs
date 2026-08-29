#!/usr/bin/env node
// measure-halos.mjs — is any field's neon actually being DRAWN, or is it sliced off?
//
// A field's halo (`getFieldGlow`, constants/theme.ts) is a `boxShadow`, so it is cut to the
// nearest ancestor with `overflow: hidden` — and a card clips its own body (components/Card.tsx
// folds it through a `Collapsible`). A composer mounted as a full-width child of that body
// therefore has ZERO room for its light: the halo's left and right halves are chopped off flat
// at the field's own edges, which reads as a hard neon rim rather than a glow.
//
// ⚠️ **A field only glows while FOCUSED, since DESIGN_COMPARISON/19 phase 2 (2026-08-26,
// "text, borders and backgrounds never glow").** Before that pass every composer field
// (`PadTypeRow`, `AddRow`, `CatalogueTab`'s search) glowed AT REST — `getFieldGlow` ran
// unconditionally — so a plain DOM scan found every field with no interaction needed, which is
// how this script's first version worked. That premise is gone: `focused ? getFieldGlow(...) :
// null` (or `{ borderRadius: FIELD_RADIUS }`) is now the shape at every one of those call sites,
// so an UNFOCUSED field carries no `boxShadow` at all and a plain scan silently stops seeing it —
// the audit's own documented failure mode (it fails by un-measuring screens, not by erroring).
// The one exception is `components/FormControls.tsx`'s `recessed` Input (`InlineAddItem`,
// `MedicineSurface`'s tray wells, `FoodTab`, `ShoppingFilterBar`, and `CatalogueTab`'s own
// `recessed` call sites), which is a documented BACKLOG item in `lib/__tests__/glowBudget.test.ts`
// — it still glows `soft` at rest and `strong` on focus, so it alone survives a rest-only scan.
//
// So the walk now FOCUSES every field-shaped candidate before measuring it, and reports THREE
// outcomes rather than two:
//   - CLIPPED  — the halo exists (at rest or on focus) and is cut short by an ancestor's clip.
//   - ok       — the halo exists and has room to fade.
//   - NO HALO  — the field never grew a `boxShadow` at all, focused or not. That is not
//                automatically a bug (a plain editor `Input` on the screen backdrop, or a
//                deliberately un-glowed control, is fine) but it IS worth a human's eyes if the
//                field is one that's supposed to glow on focus — see the printed note.
//
// This is what shipped, on every composer in the app but one, and it is invisible to every
// other check in this repo: `tsc` sees valid styles, the Jest suite has no layout, and a
// screenshot shows a lit box either way — the whole tell is that the light stops dead instead
// of fading. Three maintainer reports about "the text boxes" were this. Hence a measurement:
// walk the real app in the web preview, FOCUS every field-shaped element, and compare the blur
// radius against the room it has before the clip.
//
//   npm run halos              # 430px, English
//   npm run halos -- --width=360
//
// Exits 1 if anything is clipped, so it can gate a change the way `npm run wraps` reports do.
// A NO HALO finding does NOT fail the run on its own — it is reported for a human to judge,
// since "this field never glows" is sometimes correct (an editor field before it's ever
// focused, or `components/WeekListCard.tsx`'s tap-to-rename title, which never calls
// `getFieldGlow` at all and so is never a candidate in the first place — see FIND_CANDIDATES).
//
// Needs the preview bundle: `npm run preview:build` (or FORCE_BUILD=1) and a server on 8787 —
// scripts/run-halos.sh wires both up, the same way run-preview.sh does.
import { chromium } from '@playwright/test';
import { resolveChromium } from './chromium-path.mjs';

const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const CHROMIUM_PATH = resolveChromium();
const width = Number(process.argv.find((a) => a.startsWith('--width='))?.split('=')[1] || 430);

async function clickText(page, text) {
  const loc = page.getByText(text, { exact: true });
  await loc.first().waitFor({ state: 'attached', timeout: 10000 });
  for (const c of await loc.all()) if (await c.isVisible()) { await c.click({ timeout: 10000 }); return; }
  throw new Error(`no visible "${text}"`);
}

// Every card rests closed (lib/cardRegistry.ts) except each screen's own first card
// (`openAtRest`) — a composer inside a still-closed card is not in the DOM at all, so the walk
// must open the rest by hand. Same trap the wrap audit hit on 2026-08-21; the failure is silent
// in both. Re-checked on this branch: the accessible name is still `<card>: <expandListLabel>`
// (`components/CardCollapseToggle.tsx`), so the `/: (Expand|Open)/i` match still holds even
// though which cards start open has changed.
//
// ⚠️ **Scoped to what is actually ON SCREEN, and that scoping is load-bearing here.** All five
// tabs are mounted at once (`lazy: false`) and the pager positions the inactive four with a
// `transform`, which does not hide them from `getByRole` — Playwright's own `isVisible()` passed
// for toggles that were off in a page nobody could see. A plain `.first()` therefore doesn't
// necessarily open THIS tab's cards at all: once this tab's own toggles run out (all say
// "Collapse", not "Expand"), `.first()` moves on to the next matching toggle anywhere in the
// DOM — an inactive tab's still-closed card — and clicking it can trip that field's own
// keyboard-avoidance `scrollIntoView` (see components/AddRow.tsx's header), which pages the
// PAGER itself to the tab that field lives on. Caught by screenshot: `openCards()` on the Shop
// tab silently ended on the To-do tab, BottomNav still showing Shop highlighted underneath it.
// A real hit-test (same technique as FIND_CANDIDATES below) is what tells "this tab's own,
// still-closed card" from "some other tab's card that merely LOOKS reachable from here".
// Returns how many toggles it actually clicked, which is the STRUCTURAL half of the outer
// loop's stop condition — see its call site. A card the walk just opened can take a beat to
// mount its composer (a nested `Collapsible`, a fresh `AddRow`/`PadTypeRow` layout pass), so the
// candidate scan run immediately after this can legitimately come back empty even though real
// work just happened. Only "opened nothing, found nothing, scrolled nowhere" is a genuine dead
// end; "opened something, found nothing (yet)" is not.
async function openCards(page) {
  let opened = 0;
  for (let i = 0; i < 14; i++) {
    const found = await page.evaluate(() => {
      for (const el of document.querySelectorAll('[role="button"]')) {
        const label = el.getAttribute('aria-label') || '';
        if (!/: (Expand|Open)/i.test(label)) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) continue;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) continue;
        el.setAttribute('data-halo-toggle', '1');
        return true;
      }
      return false;
    });
    if (!found) return opened;
    await page.locator('[data-halo-toggle="1"]').first().click({ timeout: 5000 }).catch(() => {});
    await page.evaluate(() => document.querySelector('[data-halo-toggle="1"]')?.removeAttribute('data-halo-toggle'));
    opened += 1;
    await page.waitForTimeout(250);
  }
  return opened;
}

// Runs in the page, at REST (before any field has been focused). Finds every field-shaped
// CANDIDATE to click — real `<input>`/`<textarea>` elements (already-mounted fields: PadTypeRow,
// CatalogueTab's search, FormControls' Input in every mode) and `[role="button"]` elements whose
// own resting radius is FIELD_RADIUS (AddRow's collapsed "+" bar, which has no `<input>` at all
// until it's expanded — clicking it both expands AND autofocuses, see that file's header).
//
// A `[role="button"]` that already contains a live input is skipped — that is an already-mounted
// field, and the input itself is the candidate, not its housing.
//
// Deliberately does NOT filter inputs by radius: `components/WeekListCard.tsx`'s tap-to-rename
// `TITLE_FIELD` also carries FIELD_RADIUS but never calls `getFieldGlow`, so it would only ever
// be a false "NO HALO" — but it renders as plain `<Text>` until tapped, so it is never an
// `<input>` in the DOM at rest and never becomes a candidate here in the first place.
// Marks each candidate with a \`data-halo-idx\` attribute rather than handing back raw
// coordinates — the actual click goes through a real Playwright locator (scroll-into-view +
// actionability checks included), not a bare \`page.mouse.click(x, y)\`. A raw coordinate click
// was tried first and silently missed a still-settling composer (a card's expand animation can
// leave a rect stale for a beat after \`openCards()\`'s fixed wait); the locator click doesn't.
// \`data-halo-scanned\` persists across calls (set the moment a candidate is FOUND, not once it's
// clicked) so a later pass — after the page has been scrolled to reach a composer below the
// first screenful — doesn't rediscover the same element and reprocess it a second time.
// \`data-halo-idx\` has to be unique for the whole page lifetime, not just within one call — a
// counter that restarted at 0 on every pass produced a second element carrying the same idx as
// an already-processed one from an earlier pass, so the locator click below matched whichever
// of the two DOM order put first (sometimes the stale one), and reused that idx's own click just
// silently landed on the wrong composer.
const FIND_CANDIDATES = `(() => {
  const out = [];
  const seenPos = new Set();
  window.__haloIdx = window.__haloIdx || 0;
  for (const el of document.querySelectorAll('input, textarea, [role="button"]')) {
    if (el.dataset.haloScanned) continue;
    const isField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
    if (!isField) {
      const cs = getComputedStyle(el);
      if (Math.round(parseFloat(cs.borderTopLeftRadius)) !== 12) continue;
      if (el.querySelector('input,textarea')) continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 16) continue;
    if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) continue;
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    // All five screens are mounted at once (\`lazy: false\`) and the pager moves pages by
    // TRANSFORM, which does not change an off-screen page's own layout coordinates — an
    // inactive tab's field can still land inside the viewport's bounding box on paper. A real
    // hit-test is the only thing that tells "on screen" from "in the DOM, off to the side":
    // whatever is actually topmost at this point must be this element or one of its own
    // descendants/ancestors, or the click would land on the WRONG tab's content.
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) continue;
    const posKey = cx + ',' + cy;
    if (seenPos.has(posKey)) continue;
    seenPos.add(posKey);
    const label = (isField && (el.placeholder || el.value))
      || el.getAttribute('aria-label')
      || (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 28)
      || '(unlabelled field)';
    const idx = window.__haloIdx++;
    el.setAttribute('data-halo-idx', String(idx));
    el.dataset.haloScanned = '1';
    out.push({ label, idx, x: cx, y: cy });
  }
  return out;
})()`;

// FIELD_RADIUS (12) is what marks a field: it is the one radius every field in the app is cut
// to, halo included (see getFieldGlow), so it separates a field's light from a card's own drop
// shadow without needing a class name. Only elements CARRYING a boxShadow right now match — so
// this only sees a field mid-focus (or a `recessed` FormControls Input, which glows at rest too;
// see the file header for why that one alone survives an unfocused scan).
const SCAN = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.boxShadow === 'none' || !/rgba?\\(/.test(cs.boxShadow)) continue;
    if (Math.round(parseFloat(cs.borderTopLeftRadius)) !== 12) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 20 || r.bottom < 0 || r.top > window.innerHeight) continue;
    const blurs = [...cs.boxShadow.matchAll(/(-?[\\d.]+)px (-?[\\d.]+)px ([\\d.]+)px/g)].map((m) => parseFloat(m[3]));
    const need = Math.round(Math.max(0, ...blurs));
    let n = el.parentElement, clip = null;
    while (n) { const c = getComputedStyle(n); if (c.overflow !== 'visible') { clip = n.getBoundingClientRect(); break; } n = n.parentElement; }
    if (!clip) continue;
    const input = el.querySelector('input,textarea') || (el.tagName === 'INPUT' ? el : null);
    const label = (input && (input.placeholder || input.value))
      || (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 28) || '(unlabelled field)';
    out.push({ label, need, cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), room: {
      left: Math.round(r.left - clip.left), right: Math.round(clip.right - r.right),
      top: Math.round(r.top - clip.top), bottom: Math.round(clip.bottom - r.bottom) } });
  }
  return out;
})()`;

// A composer below the first screenful (Shop's Food/Catalogue, Health's medicine tray on a run
// with a long narrator quote pushing everything else down — `components/NarratorQuote.tsx`
// picks a random line per mount, so which fields fit above the fold is genuinely not fixed run
// to run) needs the page scrolled to be reached at all. `page.mouse.wheel()` was tried first and
// is a NO-OP against this app's ScrollView in the headless preview (confirmed: a wheel event at
// a point squarely over scrollable content changed nothing on screen) — the harness sees no
// `wheel`-to-scroll wiring on the DOM node react-native-web renders, so this drives the actual
// overflow-y element's `scrollTop` directly instead. Picks the LARGEST visible one, which is
// reliably the active tab's own content — an inactive tab's scroll container sits off-screen
// horizontally and is excluded by the same left/right bounds check FIND_CANDIDATES uses.
async function scrollActiveTab(page, delta) {
  return page.evaluate((d) => {
    let best = null, bestArea = 0;
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') continue;
      if (el.scrollHeight <= el.clientHeight + 10) continue;
      const r = el.getBoundingClientRect();
      if (r.right <= 0 || r.left >= window.innerWidth) continue;
      const area = r.width * r.height;
      if (area > bestArea) { bestArea = area; best = el; }
    }
    if (!best) return false;
    const before = best.scrollTop;
    best.scrollTop = Math.min(best.scrollTop + d, best.scrollHeight - best.clientHeight);
    return best.scrollTop !== before;
  }, delta);
}

const browser = await chromium.launch({
  executablePath: CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width, height: 932 } });
let clipped = 0, clean = 0, noHalo = 0;
try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.getByRole('radio', { name: /^Språk: English\./ }).first().click({ timeout: 10000 });
  await page.waitForTimeout(400);
  await clickText(page, 'Continue');
  await page.waitForTimeout(600);
  await clickText(page, 'Start');
  await page.waitForTimeout(1800);
  const skip = page.getByText('Skip the tour', { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(800); }

  // All five screens are mounted at once (`lazy: false`), so a field can be reported from a tab
  // it does not live on. Dedupe on what was measured rather than on where it was found.
  //
  // ⚠️ **Waiting for the screen's OWN title text is not a settle-marker — it is a no-op**, and
  // this cost a full debugging pass to find. `BottomNav`'s own tab LABEL ("Habits", "Health", …)
  // is on screen at all times, active tab or not, so `page.getByText('Habits')` is satisfied by
  // the nav bar itself before the pager has moved at all — it is not, as it looks, waiting for
  // anything. The tell was a Medicine composer and its four tray wells being reported under
  // "Habits": the walk never actually reached the Health page for that click, it was still
  // sitting on whatever page came before while the label matched instantly. The real signal is
  // `BottomNav`'s `accessibilityState={{ selected: active }}`, which react-native-web renders as
  // `aria-selected` — wait for the CLICKED tab's own button to carry it, not for text that was
  // always going to be there regardless.

  // Click one candidate, measure whatever lit up nearest it, report and dedupe. Returns whether
  // a match was found at all (used only for logging, not for control flow).
  async function processCandidate(tab, c, seen) {
    // A real Playwright locator click (scroll-into-view + actionability checks), keyed to the
    // marker FIND_CANDIDATES left on this exact element — not a bare coordinate click, which
    // missed a composer whose rect was still settling after openCards()'s fixed wait. An
    // element belonging to an inactive pager page fails this (off-screen, so "not actionable")
    // and is skipped rather than mis-clicking whatever real content sits at that coordinate.
    const clicked = await page.locator(`[data-halo-idx="${c.idx}"]`).first()
      .click({ timeout: 3000 }).then(() => true).catch(() => false);
    if (!clicked) return;
    await page.waitForTimeout(350);
    const glowing = await page.evaluate(SCAN);
    // The field that lit up (if any) is whichever glowing element sits nearest the point we
    // just clicked — a wrapper View growing around an input, or the input itself, both center
    // on roughly the same spot; an AddRow expanding taller keeps the same left edge and top.
    let match = null, bestDist = Infinity;
    for (const f of glowing) {
      const d = Math.hypot(f.cx - c.x, f.cy - c.y);
      if (d < bestDist && d < 140) { bestDist = d; match = f; }
    }
    // Dedupe on LEFT/RIGHT room only, not the full room object. A repeated composer (the To-do
    // tab's "New task" AddRow mounts once per Week/Month/Whenever/Recurring card AND once per
    // weekday inside Week — up to ~10 physically distinct elements sharing one label) keeps the
    // same horizontal clearance wherever it sits, since that comes from the component's own
    // padding, not from scroll position — but its TOP/BOTTOM room is whatever the page happened
    // to be scrolled to at the moment this one instance got clicked, which varies run to run and
    // instance to instance for reasons that have nothing to do with clipping (a scrolling column
    // has near-unlimited room above/below; only the horizontal edges are ever actually tight).
    // Keying on the full room object let scroll-position noise mint a "new" dedupe key for what
    // was structurally the same finding, so the reported count for a widely-reused composer
    // swung between runs (12/14/15 measured 2026-08-27) with nothing about the app having
    // changed. Left/right is also the axis every clipping bug this audit has actually found
    // (`getFieldGlow`'s halo, `FIELD_GLOW_CLEARANCE`) lives on — see the file header.
    const key = `${tab}|${c.label}|${match ? `${match.room.left},${match.room.right}` : 'none'}`;
    if (!seen.has(key)) {
      seen.add(key);
      if (!match) {
        noHalo += 1;
        console.log(`  NO HALO  "${c.label}" (${tab}) — never grew a boxShadow, focused or not`);
      } else {
        const short = Object.entries(match.room).filter(([, v]) => v < match.need);
        if (short.length) {
          clipped += 1;
          console.log(`  CLIPPED  "${c.label}" halo=${match.need}px, room ${short.map(([s, v]) => `${s}=${v}`).join(' ')}`);
        } else {
          clean += 1;
          console.log(`  ok       "${c.label}" halo=${match.need}px`);
        }
      }
    }
    await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
    await page.waitForTimeout(300);
  }

  // Which tab is actually on screen, checked EXACTLY rather than inferred from rendered
  // content. Two text-based approaches were tried first and both were false green lights, worth
  // recording so they aren't retried: `BottomNav` (the "five equal slots" pass, 2026-08-18)
  // tells its active tab apart with an icon variant and a colour, not any ARIA state — there is
  // no `aria-selected`/`aria-current` to wait on, and the colour itself can't disambiguate every
  // pair (Home's own active hue is `featTask` — the SAME gold as To-do's, since Home's content
  // is task-led — so a colour check would have called Home "correct" while actually sitting on
  // To-do). And the screen's own title text is a false green light for a different reason: all
  // five tabs are mounted at once (`lazy: false`), so "Shopping list" already EXISTS in the DOM
  // (just off-screen) even while looking at a different tab, and Playwright's `visible` state
  // doesn't account for a transform pushing an element outside the viewport — only real CSS
  // visibility/display/size. Waiting on it was satisfied instantly regardless of which tab was
  // actually on screen, which is how a Medicine composer and its tray wells got reported under
  // "Habits" for a full debugging pass before this was found.
  //
  // The actual mechanism is a single `translateX` on one wide flex row holding all five
  // screens — `tx = -index * viewportWidth`, confirmed by reading it directly while stepping
  // through every tab. That is the one signal that cannot be fooled by shared colours or
  // still-mounted-but-off-screen text, so it is what `isOnTab` reads.
  const TAB_ORDER = ['Shop', 'To-do', 'Home', 'Habits', 'Health'];
  async function pagerIndex() {
    return page.evaluate((count) => {
      for (const el of document.querySelectorAll('div')) {
        const r = el.getBoundingClientRect();
        if (Math.abs(r.width - window.innerWidth * count) > 5) continue;
        const m = getComputedStyle(el).transform.match(/matrix\(([^)]+)\)/);
        if (!m) continue;
        return Math.round(-Number(m[1].split(',')[4]) / window.innerWidth);
      }
      return null;
    }, TAB_ORDER.length);
  }
  async function isOnTab(tab) {
    return (await pagerIndex()) === TAB_ORDER.indexOf(tab);
  }

  // Click the tab and wait until `isOnTab` agrees, polling rather than trusting a fixed delay.
  // ⚠️ **Re-verifying before every pass below matters just as much as this.** Even after settling
  // correctly here, a LATER pass on the same tab could still find the pager had moved on with no
  // click of ours in between — the one shared ingredient in every pass is `scrollActiveTab`'s
  // `el.scrollTop` write, so the working theory is that a transition not fully settled by the
  // time a pass starts leaves both the departing and arriving tab's containers briefly on
  // screen at once, `scrollActiveTab`'s "largest visible" pick lands on the wrong one, and
  // mutating ITS `scrollTop` mid-transition is what nudges the pager the rest of the way to the
  // next tab. Unconfirmed beyond "everything downstream of the first `scrollActiveTab` call can
  // drift" — re-verifying before every pass is the fix that doesn't depend on knowing the exact
  // mechanism.
  async function settleOnTab(tab) {
    await page.getByRole('button', { name: new RegExp(`^${tab}$`) }).first().click({ timeout: 10000 }).catch(() => {});
    for (let i = 0; i < 20; i++) {
      if (await isOnTab(tab)) return;
      await page.waitForTimeout(300);
    }
  }

  const seen = new Set();
  // ⚠️ **TWO laps of the tab order, kept deliberately after the reason for it was reverted
  // (2026-08-28).** It was added when `app/(tabs)/_layout.tsx` briefly ran `lazy: true`: a tab
  // was then MOUNTING on the visit that scanned it, and this audit silently fell from its usual
  // 10-12 fields to **4** while still printing a contented "0 clipped" — a pass by
  // un-measurement. One lap 4, two laps 11, on one unchanged build.
  //   That flag is back to `lazy: false`, so a single lap would pass today. The second lap
  // stays because it costs one extra walk and removes a whole class of silent under-measurement
  // that this repo has now hit three times — the wrap audit's stale locators (2026-08-20), its
  // resting-state break (2026-08-21), and this. Nothing is double-counted: `seen` is global.
  //   Worth knowing if you ever debug this: a longer sleep on the first visit was tried and did
  // NOT fix it. Toggles and inputs are present within 500ms (probed per tab: To-do 6 toggles,
  // Health 2, Habits 1); what a first visit lacked was a settled card stack for `openCards` to
  // walk. **The rule that outlived the flag: after a change to NAV or to what a screen mounts,
  // read this script's field COUNT, not just its "0 clipped" verdict.**
  for (const tab of [...TAB_ORDER, ...TAB_ORDER]) {
    await settleOnTab(tab);
    await page.waitForTimeout(500);

    // openCards() can reveal a NESTED toggle it couldn't reach in its own single 14-click budget
    // (opening a card can reveal a further, still-closed section inside it) — a second pass
    // after the first catches that. A composer below the first screenful (Shop's Food/Catalogue,
    // or Health's medicine tray on a run with a long narrator quote — see `scrollActiveTab`'s
    // note) needs a scroll between passes to be reached at all.
    //
    // ⚠️ **The stop condition is STRUCTURAL (toggles opened / candidates found / scroll progress),
    // not just "did this one candidate scan come back empty" — that distinction is load-bearing
    // and was the cause of a real flake (found 2026-08-27).** The To-do tab's Week card nests
    // SEVEN independently-foldable weekday sections (each with its own "New task" composer) below
    // Month/Whenever/Recurring, so fully opening it at a narrow width takes several open+scroll
    // cycles. `openCards()` clicking a toggle and `FIND_CANDIDATES` seeing its composer are two
    // separate render passes — a card can take a beat to mount a freshly-revealed `Collapsible`'s
    // body, so the candidate scan run immediately after `openCards()` can legitimately come back
    // empty in the SAME pass real structural progress just happened in. Counting that as one of
    // the two "empty" passes needed to stop the walk was cutting it off mid-expansion at 360px on
    // a slow run and not at 430px on a fast one — same script, same app, a coin flip on timing.
    // `opened` (how many toggles `openCards()` itself clicked) is the fix: it is not subject to
    // the same lag, since it is asking "did I just do something" rather than "did something I did
    // two renders ago finish appearing yet".
    let emptyPasses = 0;
    for (let pass = 0; pass < 10 && emptyPasses < 2; pass++) {
      // Re-verify EVERY pass, not just once per tab — see settleOnTab's note.
      if (!(await isOnTab(tab))) await settleOnTab(tab);
      if (process.env.HALO_DEBUG) console.error(`[debug] ${tab} pass ${pass}: on correct tab = ${await isOnTab(tab)}`);
      const opened = await openCards(page);
      await page.waitForTimeout(400);
      const candidates = await page.evaluate(FIND_CANDIDATES);
      if (process.env.HALO_DEBUG) {
        console.error(`[debug] ${tab} pass ${pass}: opened ${opened} toggles, ${candidates.length} new candidates`, candidates.map((c) => c.label));
      }
      for (const c of candidates) await processCandidate(tab, c, seen);
      const scrolled = await scrollActiveTab(page, 700);
      await page.waitForTimeout(400);
      // If scrolling just moved us off our own tab (the working theory above), the NEXT pass's
      // re-verify catches it — this only has to stop the walk, not diagnose it.
      emptyPasses = (opened === 0 && candidates.length === 0 && !scrolled) ? emptyPasses + 1 : 0;
    }
  }
} finally {
  await browser.close();
}
console.log(`\n${clipped} clipped, ${clean} clean, ${noHalo} no-halo (at ${width}px)`);
if (clipped) {
  console.log('\nA clipped halo means the field has less room than its own light needs. Give the');
  console.log('component that owns the field `FIELD_GLOW_CLEARANCE` of padding (constants/theme.ts),');
  console.log('the way components/PadTypeRow.tsx and components/AddRow.tsx do — do not shrink the glow');
  console.log('at one call site, and do not "fix" it by moving the shadow onto a different view.');
}
if (noHalo) {
  console.log('\nA NO HALO finding is not automatically a bug — an editor field on the screen backdrop');
  console.log('(medicine-form, health-form, …) is fine with no light at all. It IS worth a look if the');
  console.log('field is a card composer (PadTypeRow/AddRow/CatalogueTab search): check that its focus');
  console.log('state actually sets the `focused` flag `getFieldGlow` is gated on.');
}
// ⚠️ **Coverage is a GATE, not a number to eyeball (2026-08-29).**
//
// This file's own header already warns to "read the field COUNT, not just the 0 clipped
// verdict" — because when lazy tab mounting landed, the scan fell from 12–14 fields to 4 and
// went on printing a contented "0 clipped", which is a pass by un-measurement. A warning in a
// comment did not stop that happening; a threshold does.
//
// It is a FLOOR, not an equality, and deliberately so: AGENTS.md records this walk as
// genuinely non-deterministic (10 / 12 / 9 / 12 across four runs on one unchanged build — a
// slow frame drops a card that never opens). So the floor sits under the observed spread and
// catches a structural collapse, which is what actually goes wrong, rather than flapping on
// timing. Raise it if the walk is made deterministic; do not lower it to clear a red run.
const MIN_FIELDS = 8;
const seen = clipped + clean + noHalo;
console.log(`coverage: ${seen} fields scanned, expected at least ${MIN_FIELDS}`);
if (seen < MIN_FIELDS) {
  console.error(
    `\n⚠️  UN-MEASURED: only ${seen} field(s) scanned.\n` +
      `   This is not a pass. A card that never opened, a renamed locator or a resting-state\n` +
      `   change can take whole screens out of this walk while it still reports "0 clipped".\n` +
      `   Re-run once (this walk is timing-sensitive); if it stays low, the walk is broken.`,
  );
  process.exit(1);
}
process.exit(clipped ? 1 : 0);
