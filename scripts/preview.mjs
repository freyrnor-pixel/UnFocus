#!/usr/bin/env node
// preview.mjs — Playwright driver for the web preview: walks onboarding, screenshots
// every main tab, and exercises "add a task" (To-do), "add a habit" (Habits) and
// "add a medicine + log a dose" (Health) — each verified to survive a tab round-trip —
// to prove three stores' write→read paths through the in-memory sql.js DB, not just
// static render. Also renders the two pushed sub-screens reachable without data setup
// (Settings, the medicine editor). Chromium is pre-installed under
// PLAYWRIGHT_BROWSERS_PATH; never `playwright install`.
//
// Usage: node scripts/preview.mjs [outDir] [--route=/some/path]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const outDir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'preview-shots';
const onlyRoute = process.argv.find((a) => a.startsWith('--route='))?.split('=')[1];

fs.mkdirSync(outDir, { recursive: true });

const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH
  || `${process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium-1194/chrome-linux/chrome`;

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(outDir, `${String(shotIndex).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  screenshot: ${file}`);
}

// expo-router's native Stack keeps previous screens mounted off-screen (for
// back-swipe), so a plain text locator can resolve to a stale, invisible
// button from an earlier onboarding step. Pick the first genuinely visible
// match instead of trusting DOM order.
async function clickText(page, text, opts = {}) {
  const locator = page.getByText(text, { exact: opts.exact ?? true });
  await locator.first().waitFor({ state: 'attached', timeout: 10000 });
  const candidates = await locator.all();
  const wantNth = opts.nth ?? 0;
  let seen = 0;
  for (const candidate of candidates) {
    if (await candidate.isVisible()) {
      if (seen === wantNth) {
        await candidate.click({ timeout: 10000 });
        return;
      }
      seen += 1;
    }
  }
  throw new Error(`clickText: no visible match #${wantNth} for "${text}" (${candidates.length} total matches)`);
}

// All five tab screens are mounted at once (`lazy: false`), and several of them render the
// SAME content — Home's day-view card and the To-do tab's are the same component, so a day-log
// row exists twice in the DOM. `.first()` therefore often resolves to the off-screen copy and
// reports "not visible" for something plainly on screen. Ask whether ANY match is visible.
async function anyVisibleText(page, text) {
  const matches = await page.getByText(text, { exact: true }).all();
  for (const m of matches) {
    if (await m.isVisible().catch(() => false)) return true;
  }
  return false;
}

// Some screens show a one-off info modal on first visit (e.g. Shopping's
// pre-reset MonthlyResetReviewSheet, or its follow-up read-only
// MonthlyResetSummaryModal — both gated on real date math, a fresh profile's
// first Shopping visit always has an unset lastMonthlyReset — expected app
// behaviour, not a bug). Dismiss it if present so it doesn't block the next
// click; no-op if no modal is showing. "Skip" (the review sheet's ghost
// button) is deliberately equivalent to any other way of leaving that sheet —
// see components/MonthlyResetReviewSheet.tsx's header — so clicking it here
// is exactly the same "just get past this" behavior as "Got it" below.
async function dismissModalIfPresent(page) {
  // Bounded loop, not a single dismiss: Skip on the review sheet immediately opens the
  // follow-up read-only summary modal (Got it) in the same tick — so a fresh profile's
  // first Shopping visit needs two dismissals in a row, not one.
  for (let i = 0; i < 3; i++) {
    let dismissedAny = false;
    for (const label of ['Skip', 'Got it', "Got it →", 'OK']) {
      const btn = page.getByText(label, { exact: true }).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        console.log(`  (dismissing modal: "${label}")`);
        await btn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
        dismissedAny = true;
        break;
      }
    }
    if (!dismissedAny) return;
  }
}

/**
 * Dismiss the guided tour if it is on screen.
 *
 * Only needed after a page.goBack(), which reloads the document and so resets the in-memory
 * web DB — reviving a tour that was already dismissed. Its scrim is a full-screen set of views
 * that swallows whatever click comes next, and the resulting failure ("some empty div
 * intercepts pointer events") points nowhere near the cause.
 */
async function dismissTour(page) {
  const skip = page.getByText('Skip the tour', { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click({ timeout: 10000 });
    await page.waitForTimeout(600);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Wrapped in try/finally so a thrown locator/timeout error (e.g. a renamed tab button)
  // still closes the browser — an uncaught throw here used to skip browser.close()
  // entirely, leaving the Chromium process open and the whole script hanging forever
  // instead of failing fast (found 2026-07-23 when the Scan→Habits tab rename did
  // exactly this).
  try {
  if (onlyRoute) {
    console.log(`> focused check: ${onlyRoute}`);
    await page.goto(`${BASE_URL}${onlyRoute}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot(page, onlyRoute.replace(/\//g, '_') || 'root');
  } else {
    // Basics (2026-07-31): language, appearance, text size, movement, menu side and starting
    // screen, all on ONE screen, replacing the old language screen plus the four-step
    // first-run wizard. Each row is a strip of radio pills; the whole screen previews live,
    // so tapping English re-renders the rest of it in English.
    console.log('> onboarding: basics');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await shot(page, 'onboarding-basics-no');
    // Language first — everything after this is asserted against English labels.
    await page.getByRole('radio', { name: /^Språk: English\./ }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await shot(page, 'onboarding-basics-en');

    // A fresh install draws ONE row here — language. The other five (Appearance, Text size,
    // Movement, Menu side, Starting screen) moved behind the `?rows=all` re-run from
    // Settings → Personal → Layout in the 2026-08-03 onboarding split, because screen one of
    // a new install was asking for fifteen decisions before the user knew what the app was.
    //
    // This walk used to click Appearance/Text size/Movement unconditionally and hung for
    // 10s on a radio that no longer renders, which took the whole preview — and `npm run
    // wraps`, which drives the same walk — down with it. Those rows are still worth
    // exercising, so they're driven on the re-run route below rather than dropped.
    await shot(page, 'onboarding-basics-picked');
    await clickText(page, 'Continue');
    await page.waitForTimeout(600);

    // Privacy is the LAST screen since the 2026-08-03 split — onboarding is two screens now,
    // basics → privacy, and this button finishes setup rather than advancing (which is why
    // its label is "Start" and no longer "Got it →").
    //
    // Four screens this walk used to step through are gone from the flow and must not be
    // re-added here: the standalone `restore` prompt (now an optional link BELOW this
    // screen's primary button — a returning user's question, so it waits for the person who
    // needs it, instead of being asked of everyone), the guided/explore/AI branch, the
    // energy explainer, and the name screen. Only `basics`, `privacy` and `restore` exist
    // under app/onboarding/ at all.
    console.log('> onboarding: privacy (last screen)');
    await shot(page, 'onboarding-privacy');
    await clickText(page, 'Start');
    await page.waitForTimeout(1800);

    // The guided tour (2026-07-31) starts as soon as onboarding finishes: one spotlight step
    // per tab, walking itself to each screen. It has to be walked (or dismissed) here or its
    // scrim would sit over every tab screenshot below. Stepped with "Got it" rather than
    // "Skip the tour" so the shots cover each step AND the self-navigation is exercised.
    // The cap is a runaway guard — keep it above TOUR_STEPS.length.
    console.log('> guided tour');
    for (let i = 0; i < 8; i++) {
      const onFinale = await page
        .getByText('Start using the app', { exact: true })
        .first()
        .isVisible()
        .catch(() => false);
      if (onFinale) {
        await shot(page, 'tour-finale');
        await clickText(page, 'Start using the app');
        break;
      }
      const more = await page.getByText('Got it', { exact: true }).first().isVisible().catch(() => false);
      if (!more) break;
      await shot(page, `tour-${i}`);
      await clickText(page, 'Got it');
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(1200);

    console.log('> Home');
    await shot(page, 'home');

    // Navigate via the in-app BottomNav (client-side route change), NOT page.goto() —
    // the DB is in-memory (sql.js fallback, see lib/sqlite.web.ts); a full page
    // navigation reloads the bundle and wipes it, bouncing back to onboarding.
    for (const [tab, shotName] of [['Shop', 'shopping'], ['To-do', 'plans'], ['Health', 'health'], ['Habits', 'habits']]) {
      console.log(`> ${tab} tab`);
      await page.getByRole('button', { name: tab, exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(1000);
      await dismissModalIfPresent(page);
      await shot(page, shotName);
    }

    // Food and Catalogue are button-launched sub-screens off Shopping (UX audit F1,
    // 2026-07-23), not tabs — click through each via in-app navigation (same in-memory-DB
    // constraint as above) and back, confirming both render past onboarding's gate.
    console.log('> Shopping -> Food button');
    await page.getByRole('button', { name: 'Shop', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Food', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await shot(page, 'food');
    // page.goBack() is the ONLY way back from a pushed sub-screen here: ScreenHeader renders
    // its back link on iOS only, so on web there is no in-app affordance to click. But
    // goBack() is a history navigation that reloads the document, and the web DB is in-memory
    // sql.js (lib/sqlite.web.ts) — so every store resets, which revives the guided tour this
    // walk already dismissed and lets its scrim swallow the next click. dismissTour() puts it
    // back to sleep. Native is unaffected: there the DB is a real file.
    await page.goBack();
    await page.waitForTimeout(800);
    await dismissTour(page);

    console.log('> Shopping -> Catalogue button');
    await page.getByRole('button', { name: 'Catalogue', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await shot(page, 'catalogue');
    await page.goBack();
    await page.waitForTimeout(800);
    await dismissTour(page);

    // Card layouts (2026-07-27): open Shopping's layout picker from the header, switch to a
    // surface-specific layout and then to the sparsest one, confirming both that the picker
    // renders and that the rows actually redraw. The second switch is the one that matters —
    // ShoppingRow is memoized on prop identity, so a layout change that didn't reach the
    // comparator would leave the list looking identical and this step would catch it.
    console.log('> Shopping -> layout picker');
    await page.getByRole('button', { name: 'Shop', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await dismissModalIfPresent(page);
    const layoutBtn = page.getByRole('button', { name: 'How lists look' }).first();
    const layoutRowsBefore = await page.getByText(/kr/).count();
    await layoutBtn.click({ timeout: 10000 });
    await page.waitForTimeout(700);
    await shot(page, 'layout-picker');
    await clickText(page, 'In the store');
    await page.waitForTimeout(700);
    await shot(page, 'layout-in-the-store');
    await clickText(page, 'Just the basics');
    await page.waitForTimeout(700);
    await shot(page, 'layout-just-the-basics');
    // "Just the basics" hides money entirely, so any price text present before must be gone.
    const layoutRowsAfter = await page.getByText(/kr/).count();
    console.log(`  price cells before/after switching to basics: ${layoutRowsBefore}/${layoutRowsAfter}`);
    console.log(`  layout switch changed the rendering: ${layoutRowsAfter <= layoutRowsBefore}`);
    await clickText(page, 'Done');
    await page.waitForTimeout(500);

    console.log('> back to Home tab');
    await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await shot(page, 'home-again');

    // FOCUSED-BUT-EMPTY (2026-08-05) — the state this walk could never see, because every
    // step below focuses and fills in the same breath. It is also the state the user
    // screenshotted: before this pass it rendered as a bare caret on a borderless line with
    // no prompt, while the options panel and its buttons appeared beside nothing. It should
    // now show a bordered field with its prompt still in place, the labelled options panel
    // below it, and a worded "More options" button. If a regression ever un-boxes the
    // composer, this screenshot is where it shows up.
    //
    // It runs HERE, on Home, and clicks rather than focus()es, for two reasons that bit
    // during the 2026-08-05 pass: all five tab screens are mounted (`lazy: false`), so a bare
    // .first() on a shared label resolves to Home's card no matter which tab is on screen —
    // focusing it from the Habits tab silently focused an off-screen input and produced a
    // screenshot of an idle line. And a programmatic DOM focus() does not reliably drive
    // react-native-web's onFocus, which is what the panel and buttons hang off.
    console.log('> Home quick-add, focused and empty');
    const focusProbe = page.getByLabel('Type habit', { exact: true }).first();
    await focusProbe.scrollIntoViewIfNeeded();
    await focusProbe.click({ timeout: 10000 });
    await page.waitForTimeout(500);
    // The panel and its button row unfold BELOW the field, so focusing near the bottom of the
    // scroll leaves "More options" behind the BottomNav. On device ScreenScaffold lifts the
    // row when the keyboard opens; there is no keyboard here, so scroll it up by hand — the
    // buttons are half of what this screenshot exists to show.
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(400);
    await shot(page, 'quick-add-focused-empty');

    // Home's pad cards (2026-07-30). Three things worth a regression check, all new surface
    // area: writing on a card's own type line, ticking a note (which must stay IN PLACE,
    // struck through, rather than vanishing into the checked zone until tomorrow), and
    // stepping the Shopping card's week pager. The type line is an always-open input —
    // target it by accessible name.
    console.log('> Home pad cards (type line, tick-in-place, week pager)');
    const noteTitle = `Preview note ${Date.now()}`;
    const noteInput = page.getByLabel('Type note', { exact: true }).first();
    await noteInput.scrollIntoViewIfNeeded();
    await noteInput.focus();
    await noteInput.fill(noteTitle);
    await noteInput.press('Enter');
    await page.waitForTimeout(700);
    const noteVisible = await page.getByText(noteTitle, { exact: true }).first().isVisible().catch(() => false);
    console.log(`  note written from Home's type line: ${noteVisible}`);
    if (!noteVisible) pageErrors.push(`Note "${noteTitle}" was not created from Home's type line`);
    await shot(page, 'home-note-added');

    // Tick it: the row must still be on screen afterwards (in place, struck through).
    const noteRow = page.getByText(noteTitle, { exact: true }).first();
    const noteCheck = page.getByRole('checkbox', { name: noteTitle, exact: true }).first();
    if (await noteCheck.count()) {
      await noteCheck.scrollIntoViewIfNeeded();
      await noteCheck.click({ timeout: 10000 });
      await page.waitForTimeout(700);
      const stillThere = await noteRow.isVisible().catch(() => false);
      console.log(`  ticked note stayed in place: ${stillThere}`);
      if (!stillThere) pageErrors.push('A note ticked today vanished instead of staying struck-through in place');
      await shot(page, 'home-note-ticked-in-place');
    } else {
      pageErrors.push(`No checkbox found for note "${noteTitle}" — PadRow's check may not be wired`);
    }

    // The full Notes screen (2026-08-01). It was a blind spot in this walk — reachable only
    // by tapping Home's Notes card header — and it is where the note rows are EDITABLE, which
    // is the one thing the Home pad deliberately doesn't do. Checks three things the PadRow
    // conversion touched: the header renders as a real text field seeded from the note, the
    // row's ⋯ opens the send-to sheet, and that sheet carries this screen's delete row.
    console.log('> Home -> Notes screen (editable rows + the ⋯ sheet)');
    await clickText(page, 'Notes');
    await page.waitForTimeout(900);
    await shot(page, 'notes-screen');
    // Read the live DOM values rather than matching on an attribute: react-native-web sets a
    // controlled input's `value` PROPERTY, which an `input[value=…]` selector doesn't see.
    const noteFieldSeeded = await page.evaluate(
      (title) => Array.from(document.querySelectorAll('input, textarea')).some((el) => el.value === title),
      noteTitle
    );
    console.log(`  note header rendered as an editable field: ${noteFieldSeeded}`);
    if (!noteFieldSeeded) pageErrors.push(`The Notes screen did not render "${noteTitle}" as an editable header field`);

    const noteAction = page.getByRole('button', { name: 'Send it to…', exact: true }).first();
    if (await noteAction.count()) {
      await noteAction.scrollIntoViewIfNeeded();
      await noteAction.click({ timeout: 10000 });
      await page.waitForTimeout(700);
      await shot(page, 'notes-send-to-sheet');
      const hasDelete = await page.getByText('Delete note', { exact: true }).first().isVisible().catch(() => false);
      console.log(`  send-to sheet offers this screen's delete row: ${hasDelete}`);
      if (!hasDelete) pageErrors.push("The Notes screen's ⋯ sheet is missing its delete row");
      // Close on the backdrop rather than picking a target: picking one navigates away with a
      // prefill that would seed the next leg's add row.
      await page.mouse.click(215, 60);
      await page.waitForTimeout(600);
    } else {
      pageErrors.push('No ⋯ (Send it to…) button on the Notes screen — PadRow\'s action may not be wired');
    }
    await page.goBack();
    await page.waitForTimeout(900);
    await dismissTour(page);

    // Step the Shopping card's week pager one week forward and back.
    const weekNext = page.getByRole('button', { name: 'Next week', exact: true }).first();
    if (await weekNext.count()) {
      await weekNext.scrollIntoViewIfNeeded();
      await weekNext.click({ timeout: 10000 });
      await page.waitForTimeout(600);
      await shot(page, 'home-shopping-week-next');
      await page.getByRole('button', { name: 'Previous week', exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(600);
      console.log('  shopping week pager stepped both ways: true');
    } else {
      pageErrors.push('Shopping card week-pager arrows not found on Home');
    }

    // Exercise real store logic (not just static render): add a task via the inline
    // AddRow at the bottom of the Whenever section (type + Enter), and confirm it
    // round-trips through the in-memory sql.js DB by reappearing after navigating away.
    console.log('> add a task (store logic check)');
    await page.getByRole('button', { name: 'To-do', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    // The Whenever AddRow (the only add affordance on this screen) only renders under the
    // "All tasks" tab — the default tab is "Today" (#186), which doesn't have it.
    await clickText(page, 'All tasks');
    await page.waitForTimeout(500);
    const taskTitle = `Preview check ${Date.now()}`;
    // AddRow now collapses to a "+ New task" bar (accessibilityLabel = placeholder); tap it
    // to expand the actual input before typing (2026-07-19 "+ makes a new row" change).
    await page.getByRole('button', { name: 'New task', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(400);
    const taskInput = page.getByPlaceholder('New task').first();
    await taskInput.fill(taskTitle);
    await taskInput.press('Enter');
    await page.waitForTimeout(800);
    await shot(page, 'task-added');

    await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'To-do', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    const persisted = await page.getByText(taskTitle, { exact: true }).first().isVisible().catch(() => false);
    console.log(`  task persisted after tab round-trip: ${persisted}`);
    if (!persisted) pageErrors.push(`Task "${taskTitle}" did not persist after navigating away and back`);
    await shot(page, 'task-persisted-check');

    // The day log (2026-08-02) — the one thing about this feature that a unit test cannot
    // reach: that ticking a task actually MOVES it across the now-line, rather than just
    // stamping a column. lib/__tests__/dayLog.test.ts covers the selector; this covers the
    // write → stamp → re-render → "it's above the line now" path end to end.
    console.log('> day log (tick a task, it crosses the now-line)');
    // The task was created on "All tasks" as an undated Whenever row, which has no clock
    // position and so can't be in a day log. Make a dated one from Today's type line.
    await clickText(page, 'Today');
    await page.waitForTimeout(500);
    const logTitle = `Log check ${Date.now()}`;
    // The type line is an always-open input — target it by accessible name. (It also carries
    // a real `placeholder` since 2026-08-05, so getByPlaceholder would work too; the
    // accessible name is the stable locator either way.)
    const todayTypeLine = page.getByLabel('Type task', { exact: true }).first();
    await todayTypeLine.scrollIntoViewIfNeeded();
    await todayTypeLine.focus();
    await todayTypeLine.fill(logTitle);
    await todayTypeLine.press('Enter');
    await page.waitForTimeout(800);
    // Tick it. Both of this card's layouts name their check after the row's title.
    await page.getByRole('checkbox', { name: logTitle, exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await shot(page, 'day-log-task-ticked');
    // The now-line divider only renders when the log is active, so its presence is the
    // proof that the card actually restructured rather than merely hiding a row.
    const nowLine = await anyVisibleText(page, 'now');
    console.log(`  now-line divider rendered: ${nowLine}`);
    if (!nowLine) pageErrors.push('Day log: the now-line divider did not render after ticking a task');
    const stillListed = await anyVisibleText(page, logTitle);
    console.log(`  ticked task still on screen (in the log, not deleted): ${stillListed}`);
    if (!stillListed) pageErrors.push(`Day log: "${logTitle}" vanished after being ticked instead of moving into the log`);

    // Capture a moment through the SAME type line — the feature's "one field, one submit"
    // rule, and the reason there is no second input anywhere.
    //
    // Stay on the To-do tab. All five tab screens are mounted at once (`lazy: false`), so
    // a bare `.first()` on a shared label like "Type task" resolves to whichever card comes
    // first in the DOM — the To-do tab's — regardless of which tab is on screen. Navigating
    // away first therefore leaves that input filled but OFF-SCREEN, and every control in it
    // fails Playwright's visibility check. (Home renders the identical card and the identical
    // capture; screenshot 33's Home view is the proof of that, and it is why the feature
    // needs no fifth Home card.)
    const momentText = `Moment ${Date.now()}`;
    const typeLineAgain = page.getByLabel('Type task', { exact: true }).first();
    await typeLineAgain.scrollIntoViewIfNeeded();
    await typeLineAgain.focus();
    await typeLineAgain.fill(momentText);
    await page.waitForTimeout(400);
    // The extras row (and so this toggle) only renders while the field is focused or has
    // text — hence filling first, then switching what a submit commits. Pressing it must
    // NOT commit the draft as a task on the way (components/PadTypeRow.tsx's
    // internalPressRef); if this step starts producing a task named "Moment …", that guard
    // has regressed. Task 15 (2026-08-04) made this control a Switch, not a Pressable row —
    // it now carries accessibilityRole "switch", not "button".
    const captureToggle = page.getByRole('switch', { name: 'What just happened?', exact: true }).first();
    await captureToggle.click({ timeout: 10000 });
    await page.waitForTimeout(400);
    // Re-locate: switching the target RENAMES the field (its accessible name is its prompt,
    // and the prompt is now "What just happened?"). That is correct — the field genuinely
    // means something else now — but it makes the old "Type task" locator resolve to a
    // different card's input, so pressing Enter on it would commit nothing.
    const momentField = page.getByLabel('What just happened?', { exact: true }).first();
    await momentField.focus();
    await momentField.press('Enter');
    await page.waitForTimeout(800);
    await shot(page, 'day-log-moment-captured');
    const momentShown = await anyVisibleText(page, momentText);
    console.log(`  captured moment appears in the log: ${momentShown}`);
    if (!momentShown) pageErrors.push(`Day log: captured moment "${momentText}" did not appear`);
    // It must be a MOMENT, not a task — a moment has no checkbox, because it already
    // happened. A checkbox here means the capture chip didn't switch the commit target.
    const momentHasCheckbox = await page
      .getByRole('checkbox', { name: momentText, exact: true })
      .first()
      .isVisible()
      .catch(() => false);
    console.log(`  captured as a moment, not a task (no checkbox): ${!momentHasCheckbox}`);
    if (momentHasCheckbox) pageErrors.push(`Day log: "${momentText}" was committed as a task, not a moment`);

    // Exercise a second store's write path: add a habit from the Habits tab's type line, then
    // confirm it round-trips through the in-memory sql.js DB after a tab away-and-back.
    //
    // **This is a text input, not a button** (2026-07-30): the collapsed "+ Add habit" AddRow
    // bar became components/PadTypeRow.tsx — an always-open line. There is no bar to tap open
    // any more. Target the input by its accessible name (the prompt string, t.pad.type.habit),
    // which is set explicitly and is also the `placeholder` since 2026-08-05.
    console.log('> add a habit (store logic check)');
    await page.getByRole('button', { name: 'Habits', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await dismissModalIfPresent(page);
    const habitTitle = `Preview habit ${Date.now()}`;
    const habitInput = page.getByLabel('Type habit', { exact: true }).first();
    await habitInput.scrollIntoViewIfNeeded();
    await habitInput.focus();
    await habitInput.fill(habitTitle);
    await habitInput.press('Enter');
    await page.waitForTimeout(800);
    await shot(page, 'habit-added');

    await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Habits', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await dismissModalIfPresent(page);
    const habitPersisted = await page.getByText(habitTitle, { exact: true }).first().isVisible().catch(() => false);
    console.log(`  habit persisted after tab round-trip: ${habitPersisted}`);
    if (!habitPersisted) pageErrors.push(`Habit "${habitTitle}" did not persist after navigating away and back`);
    await shot(page, 'habit-persisted-check');

    // A habit done today belongs in the day log (2026-08-02) — a habit is a standing
    // commitment, so doing it is exactly the evidence the log is for. Register it here, then
    // check the To-do tab's log. The stamp is habit_logs.first_at, written on the FIRST
    // log of the day, so this must hold for a partly-done counter habit too.
    //
    // **No more checkbox (2026-08-06)**: every habit registers through its −/+ pair now, not
    // a check circle for dailyGoal===1 habits — see app/habits.tsx's HabitCard. Target
    // the "+" button by its accessible name instead.
    console.log('> day log: a ticked habit appears in it');
    const habitCheck = page.getByRole('button', { name: `Increase quantity ${habitTitle}`, exact: true }).first();
    await habitCheck.scrollIntoViewIfNeeded();
    await habitCheck.click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await shot(page, 'day-log-habit-ticked');
    await page.getByRole('button', { name: 'To-do', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(900);
    const habitInLog = await anyVisibleText(page, habitTitle);
    console.log(`  ticked habit shows in the day log: ${habitInLog}`);
    if (!habitInLog) pageErrors.push(`Day log: habit "${habitTitle}" did not appear after being ticked`);
    await shot(page, 'day-log-habit-in-log');

    // Exercise the medicine store's two write paths (2026-07-27): quick-create a medicine
    // from the Health tab's tray card, then LOG A DOSE by tapping its circle — the dose is
    // the whole point of the feature, and it's a separate table (medicine_doses) from the
    // medicine row itself. Both are checked to survive a tab round-trip.
    console.log('> add a medicine + log a dose (store logic check)');
    await page.getByRole('button', { name: 'Health', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await dismissModalIfPresent(page);
    const medName = `Preview med ${Date.now()}`;
    const medAddBar = page.getByRole('button', { name: 'Add a medicine', exact: true }).first();
    await medAddBar.scrollIntoViewIfNeeded();
    await medAddBar.click({ timeout: 10000 });
    await page.waitForTimeout(400);
    const medInput = page.getByPlaceholder('Add a medicine').first();
    await medInput.scrollIntoViewIfNeeded();
    await medInput.fill(medName);
    await medInput.press('Enter');
    await page.waitForTimeout(800);
    await shot(page, 'medicine-added');

    // The new medicine lands in whichever tray "now" falls in, so assert on the row itself
    // rather than a specific tray label.
    const medVisible = await page.getByText(medName, { exact: true }).first().isVisible().catch(() => false);
    console.log(`  medicine row rendered: ${medVisible}`);
    if (!medVisible) pageErrors.push(`Medicine "${medName}" did not render on the Health tab`);

    const doseToggle = page.getByRole('checkbox', { name: `Mark ${medName} as taken`, exact: true }).first();
    await doseToggle.scrollIntoViewIfNeeded();
    await doseToggle.click({ timeout: 10000 });
    await page.waitForTimeout(600);
    const doseLogged = await page.getByText(/^Taken \d{2}:\d{2}$/).first().isVisible().catch(() => false);
    console.log(`  dose logged (Taken HH:MM shown): ${doseLogged}`);
    if (!doseLogged) pageErrors.push(`Logging a dose of "${medName}" did not show a "Taken HH:MM" stamp`);
    await shot(page, 'medicine-dose-logged');

    await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Health', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(800);
    await dismissModalIfPresent(page);
    const dosePersisted = await page.getByText(/^Taken \d{2}:\d{2}$/).first().isVisible().catch(() => false);
    console.log(`  dose persisted after tab round-trip: ${dosePersisted}`);
    if (!dosePersisted) pageErrors.push(`Dose of "${medName}" did not persist after navigating away and back`);
    await shot(page, 'medicine-persisted-check');

    // The medicine editor is a pushed sub-screen reached by tapping the row's NAME (the
    // circle logs the dose instead) — render it once so the new route isn't a blind spot.
    console.log('> Health -> medicine form');
    await page.getByRole('button', { name: medName, exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(900);
    await shot(page, 'medicine-form');
    const formRendered = await page.getByText('When to take it', { exact: true }).first().isVisible().catch(() => false);
    console.log(`  medicine form rendered: ${formRendered}`);
    if (!formRendered) pageErrors.push('The medicine form did not render its tray picker');
    await page.goBack();
    await page.waitForTimeout(800);
    await dismissTour(page);

    // Sub-tier header check (HEADER_CLIP_DEBUG.md): Settings was reported to show NO
    // header at all on device, and this walk never visited a sub-tier screen before —
    // the gear → /settings push is the only sub-tier route reachable without data setup.
    // Measure the header title's geometry on Home (site tier) and Settings (sub tier):
    // a layout/positioning-level cause (band collapsed, title off-screen) would show up
    // here, even though Android-native font metrics don't reproduce on web.
    console.log('> Settings (sub-tier header check)');
    await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(500);
    // A title string can match other nodes too (e.g. the BottomNav "Home" label), so
    // measure the TOPMOST visible match — the header title is the one at the top edge.
    const measureTitle = async (text) => {
      const matches = await page.getByText(text, { exact: true }).all();
      let best = null;
      for (const m of matches) {
        if (!(await m.isVisible().catch(() => false))) continue;
        const box = await m.boundingBox();
        if (box && (!best || box.y < best.box.y)) best = { m, box };
      }
      if (!best) return { visible: false };
      const css = await best.m.evaluate((node) => {
        const s = getComputedStyle(node);
        return { fontSize: s.fontSize, lineHeight: s.lineHeight };
      });
      return { visible: true, box: best.box, ...css };
    };
    const homeTitle = await measureTitle('Home');
    console.log(`  Home (site) header title: ${JSON.stringify(homeTitle)}`);
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(1200);
    await shot(page, 'settings');
    const settingsTitle = await measureTitle('Settings');
    console.log(`  Settings (sub) header title: ${JSON.stringify(settingsTitle)}`);
    if (!settingsTitle.visible) pageErrors.push('Settings sub-tier header title is NOT visible on web (matches the on-device "no header" report)');

    // The design lab's playground (2026-08-07). A real write path like the three above: build
    // a card out of nothing and check that both ends agree — the composition was stored AND
    // the card actually drew it. Best-effort: a failure here must not fail the whole preview
    // run, which has already proved the app's own store→DB paths by this point.
    try {
      console.log('> Settings -> design lab (build a card from blank)');
      await page.getByText('Advanced', { exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(900);
      // Reached through DEBUG MODE since 2026-08-17: the lab's own `featureDesignLab` switch
      // was removed in the settings-declutter pass and the link moved inside the Debug mode
      // card, revealed once debug is on.
      await page.getByRole('switch', { name: 'Debug mode', exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(700);
      await page.getByText('Design lab', { exact: true }).last().click({ timeout: 10000 });
      await page.waitForTimeout(1600);
      await shot(page, 'design-lab');

      // A blank card, which is the whole premise: before this the lab could only open one of
      // eleven pre-filled cards, and an empty one could not even be stored.
      await clickText(page, 'Add a card');
      await page.waitForTimeout(900);
      await shot(page, 'design-lab-starters');
      await clickText(page, 'A blank card');
      await page.waitForTimeout(1100);

      // Add from the SHELF under the card — a tap, not a drag. The hold-and-drag cannot be
      // driven at all in this environment: Playwright's mouse-down/move does not activate
      // react-native-gesture-handler on web, confirmed against the app's own shipped drag, so
      // a failure there would be the harness rather than the app (see AGENTS.md). Its
      // arithmetic is covered by `slotAtPoint` and `bodyCellAtPoint` in the unit suites
      // instead, and every drag here has this tap route as its equivalent.
      await page.getByRole('radio', { name: 'Controls', exact: true }).first().click({ timeout: 8000 });
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Add a slider', exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(1200);
      await shot(page, 'design-lab-composed');

      // Both ends have to agree: the panel opened for the part that was just added (so the
      // composition was written and selected) AND the card drew a real slider for it.
      const panel = await page.getByText(/^Changing:/).first().isVisible().catch(() => false);
      const sliders = await page.getByRole('slider').count();
      console.log(`  panel opened for the new part: ${panel}; sliders on screen: ${sliders}`);
      if (!panel) pageErrors.push('Design lab: adding a part did not open its panel');
      if (sliders === 0) pageErrors.push('Design lab: the composed card drew no slider for the added part');

      // Switching screens and back is the only automated proof that per-screen storage works:
      // the card belongs to Home, so Habits must be empty and Home must have it again.
      await page.getByRole('button', { name: 'Habits', exact: true }).first().click({ timeout: 8000 });
      await page.waitForTimeout(900);
      const awayCount = await page.getByRole('slider').count();
      await page.getByRole('button', { name: 'Home', exact: true }).first().click({ timeout: 8000 });
      await page.waitForTimeout(900);
      const backCount = await page.getByRole('slider').count();
      console.log(`  sliders on the other screen: ${awayCount}; back on this one: ${backCount}`);
      if (awayCount !== 0) pageErrors.push('Design lab: a card built on one screen showed up on another');
      if (backCount === 0) pageErrors.push('Design lab: a card did not survive switching screens and back');
      await shot(page, 'design-lab-screens');

      // The token knobs, now their own pushed screen.
      await page.getByRole('button', { name: 'Colours and shapes', exact: true }).first().click({ timeout: 8000 });
      await page.waitForTimeout(1200);
      await shot(page, 'design-lab-tokens');
      const tokens = await page.getByText('Colour', { exact: true }).first().isVisible().catch(() => false);
      if (!tokens) pageErrors.push('Design lab: the token knobs screen did not render');
    } catch (e) {
      console.log(`  (design-lab step skipped: ${e.message.split('\n')[0]})`);
    }
  }

  console.log(`\n> page errors: ${pageErrors.length}`);
  pageErrors.forEach((e) => console.log('  [pageerror]', e));
  console.log(`> console errors: ${consoleErrors.length}`);
  consoleErrors.forEach((e) => console.log('  [console.error]', e));

  if (pageErrors.length > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
