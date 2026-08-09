#!/usr/bin/env node
/**
 * screenshot-states.mjs — captures every screen of the app in its different states for an
 * outside design review, and writes a captioned index alongside the images.
 *
 * This is a wider walk than `scripts/preview.mjs`, and a different job: preview.mjs proves
 * write→read paths still work, this one documents what the app LOOKS like. It deliberately
 * shoots each surface EMPTY first (the state a new user actually meets) and then again with
 * data, plus the sheets, editors and pushed sub-screens.
 *
 * Output: `review-bundle/screens/NN-name.png` + `index.json` + `INDEX.md`.
 *
 * Usage:
 *   node scripts/screenshot-states.mjs [outDir] [--theme=light|dark] [--only=core]
 *
 * THE ONE CONSTRAINT THAT SHAPES THE WHOLE WALK: on web the DB is in-memory sql.js, and
 * `page.goto()`/`page.goBack()` reload the document and WIPE it back to a fresh install.
 * There is no in-app back button on web (ScreenHeader draws one on iOS only), so every
 * pushed sub-screen costs a goBack and therefore costs the data. Hence the phases:
 *
 *   1. onboarding + guided tour
 *   2. the five tabs, empty
 *   3. sheets and overlays (they close in place — data survives, but there isn't any yet)
 *   4. pushed sub-screens, each an independent excursion that seeds whatever it needs,
 *      shoots, goes back, and lets the wipe happen
 *   5. seed for real, shoot every populated surface — NO navigation away in this phase
 *   6. the one data-bearing push that can afford to be last
 *
 * Other web-preview constraints (see AGENTS.md): `lazy: false` on the tab pager means all
 * five tab screens are mounted at once, so a bare `.first()` on a shared label can resolve
 * to an off-screen copy; and hold-and-drag cannot be driven at all here, so no shot needs one.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:8787';
const args = process.argv.slice(2);
const outDir = args[0] && !args[0].startsWith('--') ? args[0] : 'review-bundle/screens';
const THEME = args.find((a) => a.startsWith('--theme='))?.split('=')[1] || 'light';
const ONLY = args.find((a) => a.startsWith('--only='))?.split('=')[1] || 'all';
const FULL = ONLY === 'all';

fs.mkdirSync(outDir, { recursive: true });

const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH
  || `${process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'}/chromium-1194/chrome-linux/chrome`;

const prefix = THEME === 'dark' ? 'dark-' : '';
const captions = [];
const problems = [];
let shotIndex = 0;

async function shot(page, name, meta = {}) {
  // A full-page screenshot here captures the VIEWPORT, not the whole scroll content: the app
  // scrolls inside a fixed-height ScrollView, not the document. So framing depends on wherever
  // the last interaction left the scroll — put every screen shot back at its top first. Sheets
  // and modals are excluded: the wheel would land on the sheet's own scroller instead.
  const isOverlay = /^(SHEET|MODAL|LAYOUT)/.test(meta.state || '');
  if (meta.top !== false && !isOverlay) {
    // The cursor starts at (0,0), which is outside the scroller on several screens and makes
    // the wheel a no-op — park it over the middle of the content first.
    await page.mouse.move(215, 500);
    await page.mouse.wheel(0, -6000);
    await page.waitForTimeout(400);
  }
  shotIndex += 1;
  const file = `${prefix}${String(shotIndex).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  captions.push({ file, theme: THEME, ...meta, name });
  console.log(`  ${file} — ${meta.title || name}`);
}

// ---------------------------------------------------------------------------
// driving helpers
// ---------------------------------------------------------------------------

async function clickText(page, text, opts = {}) {
  const locator = page.getByText(text, { exact: opts.exact ?? true });
  await locator.first().waitFor({ state: 'attached', timeout: opts.timeout ?? 10000 });
  for (const candidate of await locator.all()) {
    if (await candidate.isVisible()) {
      await candidate.click({ timeout: opts.timeout ?? 10000 });
      return true;
    }
  }
  throw new Error(`clickText: no visible match for "${text}"`);
}

async function tryText(page, text, timeout = 2500) {
  try {
    await clickText(page, text, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function tryButton(page, name, timeout = 4000) {
  const btn = page.getByRole('button', { name, exact: true }).first();
  if (!(await btn.isVisible({ timeout }).catch(() => false))) return false;
  await btn.click({ timeout: 8000 }).catch(() => false);
  await page.waitForTimeout(700);
  return true;
}

/** Close whatever sheet/modal is on screen. Everything below is a "just get out" affordance. */
async function closeOverlays(page) {
  for (let i = 0; i < 4; i++) {
    let closed = false;
    for (const label of ['Done', 'Close', 'Skip', 'Got it', 'Got it →', 'OK', 'Cancel']) {
      const btn = page.getByText(label, { exact: true }).first();
      if (await btn.isVisible({ timeout: 400 }).catch(() => false)) {
        await btn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
        closed = true;
        break;
      }
    }
    if (!closed) return;
  }
}

async function dismissTour(page) {
  const skip = page.getByText('Skip the tour', { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click({ timeout: 8000 });
    await page.waitForTimeout(700);
  }
}

async function tab(page, name) {
  await closeOverlays(page);
  await page.getByRole('button', { name, exact: true }).first().click({ timeout: 10000 });
  await page.waitForTimeout(900);
  await closeOverlays(page);
}

/** Onboarding. `allRows` uses the Settings re-run route, which is where the appearance row lives. */
async function runOnboarding(page, { allRows = false, capture = false } = {}) {
  await page.goto(allRows ? `${BASE_URL}/onboarding/basics?rows=all` : BASE_URL, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(1300);
  if (capture) {
    await shot(page, 'onboarding-basics-norwegian', {
      title: 'Onboarding — Basics, before a language is picked',
      screen: 'app/onboarding/basics.tsx',
      state: 'FRESH INSTALL, screen one of two. Norwegian-first: the app opens in Norwegian, and every row previews live — picking English re-renders the screen you are standing on.',
    });
  }
  await page.getByRole('radio', { name: /^Språk: English\./ }).first().click({ timeout: 10000 });
  await page.waitForTimeout(700);
  if (capture) {
    await shot(page, 'onboarding-basics-english', {
      title: 'Onboarding — Basics, switched to English',
      screen: 'app/onboarding/basics.tsx',
      state: 'A fresh install draws only this one row. The other five (appearance, text size, movement, menu side, starting screen) are behind "Run setup again" in Settings — screen one was asking for fifteen decisions before the user knew what the app was.',
    });
  }
  if (allRows) {
    if (THEME === 'dark') {
      const darkPill = page.getByRole('radio', { name: /Dark\./ }).first();
      if (await darkPill.isVisible({ timeout: 4000 }).catch(() => false)) {
        await darkPill.click({ timeout: 8000 });
        await page.waitForTimeout(800);
      } else {
        problems.push('Could not find the Dark appearance pill — dark shots may be light');
      }
    }
    if (capture) {
      await shot(page, 'onboarding-basics-all-rows', {
        title: 'Onboarding — Basics with all six rows',
        screen: 'app/onboarding/basics.tsx',
        state: 'The Settings re-run (`?rows=all`): language, appearance, text size, movement, menu side, starting screen. One screen is the hard cap — a seventh setting goes to Settings. Every value already has a working default, so this screen only ever ADJUSTS; skipping it is a no-op.',
      });
    }
  }
  await clickText(page, 'Continue');
  await page.waitForTimeout(900);
  if (capture) {
    await shot(page, 'onboarding-privacy', {
      title: 'Onboarding — Privacy (the last screen)',
      screen: 'app/onboarding/privacy.tsx',
      state: 'Onboarding is TWO screens. It was ~18, then 7, then 6. Restoring a backup is a link below the primary button rather than a screen of its own — a returning user\'s question, asked of the person who needs it instead of everyone.',
    });
  }
  await clickText(page, 'Start');
  await page.waitForTimeout(2200);
}

async function walkTour(page, { capture = false } = {}) {
  for (let i = 0; i < 8; i++) {
    if (await page.getByText('Start using the app', { exact: true }).first().isVisible().catch(() => false)) {
      if (capture) {
        await shot(page, 'tour-finale', {
          title: 'Guided tour — closing card',
          screen: 'components/TourSpotlight.tsx',
          state: 'The end of the tour, and where the downloadable "AI setup guide" lives — the app has no in-app AI builder, so a user hands that file to an external AI and uploads the filled-in reply back into Settings.',
        });
      }
      await clickText(page, 'Start using the app');
      break;
    }
    if (!(await page.getByText('Got it', { exact: true }).first().isVisible().catch(() => false))) break;
    if (capture) {
      await shot(page, `tour-step-${i + 1}`, {
        title: `Guided tour — step ${i + 1}`,
        screen: 'components/TourSpotlight.tsx + components/TourTarget.tsx',
        state: 'One spotlight step per tab, on the real app rather than a slideshow. Everything but one card is dimmed; that card stays live and tappable through the hole. Every step is skippable on its own, and progress is a SET of ids — a skipped step and a finished one are indistinguishable, so reordering can never strand anyone.',
      });
    }
    await clickText(page, 'Got it');
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(1300);
}

/**
 * Return from a pushed sub-screen. The document reload wipes the DB, so the app may land back
 * in onboarding or replay the tour — put it back on its feet either way.
 */
async function back(page) {
  await page.goBack().catch(() => {});
  await page.waitForTimeout(1200);
  await ensureTabs(page);
}

/**
 * Guarantee the app is sitting on the tab pager with the bottom nav visible. A goBack can
 * land anywhere — mid-onboarding on a wiped DB, or one screen too far back if the excursion
 * pushed twice — and the next phase has no way to recover on its own. Reload from scratch as
 * the last resort; the DB is already gone either way.
 */
async function ensureTabs(page) {
  await dismissTour(page);
  await closeOverlays(page);
  if (await page.getByRole('button', { name: 'Home', exact: true }).first().isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }
  if (await page.getByText('Continue', { exact: true }).first().isVisible({ timeout: 1500 }).catch(() => false)) {
    await tryText(page, 'Continue', 4000);
    await page.waitForTimeout(800);
    await tryText(page, 'Start', 4000);
    await page.waitForTimeout(1800);
    await walkTour(page, { capture: false });
    await dismissTour(page);
    if (await page.getByRole('button', { name: 'Home', exact: true }).first().isVisible({ timeout: 3000 }).catch(() => false)) {
      return;
    }
  }
  console.log('  (lost the tab bar — reloading and re-running onboarding)');
  await runOnboarding(page, {});
  await walkTour(page, { capture: false });
  await dismissTour(page);
}

/** An excursion: push somewhere, shoot it, come back, and absorb the DB wipe. */
async function excursion(page, label, fn) {
  try {
    await fn();
  } catch (e) {
    problems.push(`${label}: ${e.message.split('\n')[0]}`);
    console.log(`  (skipped ${label}: ${e.message.split('\n')[0]})`);
  }
  await back(page).catch(() => {});
}

// ---------------------------------------------------------------------------
// seeding helpers (used both by throwaway excursions and by the real data phase)
// ---------------------------------------------------------------------------

/**
 * The five tab screens are all mounted at once (`lazy: false`) and the pager moves pages by
 * transform, so an input on an off-screen tab still reports `isVisible()` — a bare `.first()`
 * on a shared label like "Type task" happily resolves to a card on a different tab and then
 * fails with "element is outside of the viewport". Ask for the one whose box is actually in
 * the window.
 */
async function onScreenField(page, label) {
  for (const el of await page.getByLabel(label, { exact: true }).all()) {
    if (!(await el.isVisible().catch(() => false))) continue;
    const box = await el.boundingBox().catch(() => null);
    if (box && box.x > -20 && box.x < 430) return el;
  }
  return null;
}

async function typeInto(page, label, text) {
  const field = await onScreenField(page, label);
  if (!field) {
    problems.push(`No on-screen field labelled "${label}" — could not type "${text}"`);
    return false;
  }
  await field.scrollIntoViewIfNeeded().catch(() => {});
  await field.click({ timeout: 8000 });
  await field.fill(text);
  await field.press('Enter');
  await page.waitForTimeout(700);
  return true;
}

const seedTask = (page, title) => typeInto(page, 'Type task', title);
const seedHabit = (page, title) => typeInto(page, 'Type habit', title);

async function seedMedicine(page, name) {
  if (!(await tryButton(page, 'Add a medicine'))) return false;
  const input = page.getByPlaceholder('Add a medicine').first();
  await input.fill(name);
  await input.press('Enter');
  await page.waitForTimeout(900);
  return true;
}

/**
 * Put the app in dark mode. There is no UI route to it in this harness: appearance lives in
 * Settings (or in onboarding's `?rows=all` re-run), Settings is a pushed dead end with no
 * in-app back on web, and the only way out — a history navigation — reloads the document and
 * wipes the in-memory DB, taking the setting with it. So set it under the app instead.
 *
 * `window.__unfocusSqlJsDb__` is created by the index.html bootstrap before the app bundle is
 * even inserted (see scripts/build-web.mjs), so an init script can intercept the assignment
 * and wrap the handle. `lib/sqlite.web.ts` reads through `prepare()`, so re-asserting the
 * value before every read of the settings table also survives onboarding writing its own
 * appearance pick back over it.
 */
async function forceDarkMode(page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__unfocusSqlJsDb__', {
      configurable: true,
      set(db) {
        const prepare = db.prepare.bind(db);
        const run = db.run.bind(db);
        db.prepare = (sql, ...rest) => {
          if (typeof sql === 'string' && /\bfrom\s+settings\b/i.test(sql)) {
            try {
              run("UPDATE settings SET dark_mode = 'on'");
            } catch {
              /* table not created yet — the next read will catch it */
            }
          }
          return prepare(sql, ...rest);
        };
        Object.defineProperty(window, '__unfocusSqlJsDb__', {
          value: db,
          writable: true,
          configurable: true,
        });
      },
    });
  });
}

// ---------------------------------------------------------------------------

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));

  if (THEME === 'dark') await forceDarkMode(page);

  try {
    // ---- 1. onboarding + tour -------------------------------------------
    console.log('> onboarding + tour');
    await runOnboarding(page, { capture: FULL });
    await walkTour(page, { capture: FULL });

    // ---- 2. the five tabs, empty ----------------------------------------
    console.log('> tabs, empty');
    await shot(page, 'home-empty', {
      title: 'Home — first run, nothing added yet',
      screen: 'app/(tabs)/index.tsx',
      state: 'EMPTY. Home is the INDEX of the other screens and owns no data: each preview card wears the border hue of the tab it comes from (habits sky, notes yellow, shopping green), and Home itself is neutral grey. The Energy strip is replaced by its tutorial card while nothing carries an energy value — a full ten-pip bar with nothing able to spend it reads as a score.',
      components: 'EnergyMeter, PlanTaskCard, HomeHabitsCard, HomeNotesCard, HomeShoppingCard, StarterCard, StarterExampleRow',
    });

    for (const [btn, file, title, screen, state, components] of [
      ['Shop', 'shopping-empty', 'Shopping — empty', 'app/(tabs)/shopping.tsx',
        'EMPTY. Green screen hue. Week lists / Monthly list / Whenever, with Food, Catalogue and Scan as buttons rather than tabs. A migration seeds one empty monthly list, which is why this surface\'s empty-state gate has to count items too, not just lists.',
        'WeekListCard, ShoppingRow, InlineAddItem, StarterCard, ShoppingFilterBar, NewMonthlyListRow'],
      ['To-do', 'plans-empty', 'To-do — empty', 'app/(tabs)/plans.tsx',
        'EMPTY. Blue screen hue. Today is the default tab and is drawn as the elastic timeline — real durations, visible gaps, gaps reading as room — split by a live now-line. The explainer draws inside the card rather than as a card above it (a Surface inside a Surface reads as a nested panel).',
        'PlanTaskCard, TaskCard, SectionCard, AddRow, TabSlider, SubScreenLinkRow, DayGridLines'],
      ['Habits', 'habits-empty', 'Habits — empty', 'app/(tabs)/habits.tsx',
        'EMPTY. Sky screen hue. Offers four one-tap starter habits instead of an empty list. There is no negative habit, no slip log and no broken streak anywhere in the app.',
        'PadRow, PadTypeRow, StarterCard, StageTree, HabitIcon, SubScreenLinkCard'],
      ['Health', 'health-empty', 'Health — empty', 'app/(tabs)/health.tsx',
        'EMPTY. Teal screen hue. Medicine trays (morning / midday / evening / night — windows, not clock times) sit above the symptom log.',
        'MedicineTrayCard, OpenEpisodeCard, AddRow, StarterCard, StarterExampleRow'],
    ]) {
      await tab(page, btn);
      await shot(page, file, { title, screen, state, components });
    }

    // ---- 3. sheets and overlays (close in place) -------------------------
    if (FULL) {
      console.log('> sheets and overlays');
      await tab(page, 'Home');
      if (await tryButton(page, "Set the day's energy")) {
        await shot(page, 'energy-config-sheet', {
          title: 'The Energy config sheet',
          screen: 'components/EnergyConfigSheet.tsx',
          state: 'SHEET. Energy is the app\'s one number. Its explainer under the meter is PERMANENT rather than a card that self-destructs — an explanation that disappears is not there when you come back to the number months later.',
          components: 'EnergyConfigSheet, Stepper, Slider',
        });
        await closeOverlays(page);
      }
      if (await tryButton(page, "Card settings for Today's to-do")) {
        await shot(page, 'home-card-menu-sheet', {
          title: 'A Home card\'s ⋯ settings sheet',
          screen: 'components/CardMenuSheet.tsx',
          state: 'SHEET. Home\'s cards can be reordered (hold and drag) and configured per card. Home dropped a fifth card (Goals) one day after shipping it — "Home had too many lists" — so what is NOT here is deliberate.',
          components: 'CardMenuSheet, HomeCardManager',
        });
        await closeOverlays(page);
      }

      await tab(page, 'To-do');
      if (await tryButton(page, 'Goals')) {
        await shot(page, 'goals-sheet', {
          title: 'The Goals sheet (from To-do and from Habits)',
          screen: 'components/GoalsSheet.tsx',
          state: 'SHEET, EMPTY, with starter suggestions. A goal\'s strength rises on progress and cools back toward neutral but NEVER below — there is no state in which a goal is failing. Something you want to do LESS of ("Less time on my phone") is a goal whose linked tasks are the replacement behaviour; that is why habits have no negative kind.',
          components: 'GoalsSheet, GoalGlowDot, AddRow',
        });
        await closeOverlays(page);
      }
      if (await tryButton(page, 'How lists look')) {
        await shot(page, 'layout-picker', {
          title: 'The layout picker (per surface, from that surface\'s own header)',
          screen: 'components/LayoutPickerSheet.tsx',
          state: 'SHEET. Three shared detail levels (Just the basics / Normal / Show everything) plus surface-specific shapes. Layouts are named after the SITUATION you would want them in — "In the store", never "Compact". They are presentation ONLY: a row a layout does not draw is still live, still counted in headers, still reminding, one tap away.',
          components: 'LayoutPickerSheet, TabSlider',
        });
        if (await tryText(page, 'One thing at a time', 3000)) {
          await page.waitForTimeout(900);
          await shot(page, 'plans-layout-one-thing', {
            title: 'To-do — the "One thing at a time" layout',
            screen: 'lib/cardLayout.ts',
            state: 'LAYOUT. A Next-up hero, a short Then list, then the day\'s done count. Also hides the Whenever section. The mock\'s row of count chips was deliberately not built — it duplicated the tab bar a few pixels above it, so the counts live in the tab slider\'s own accessory slot.',
          });
        }
        if (await tryText(page, 'Just the basics', 3000)) {
          await page.waitForTimeout(900);
          await shot(page, 'plans-layout-basics', {
            title: 'To-do — the "Just the basics" layout',
            screen: 'lib/cardLayout.ts',
            state: 'LAYOUT, sparsest. Whatever the PREVIOUS view was hiding glows briefly after a switch — the glow marks VISIBILITY, not novelty, so a glowing row is usually something the user has had for months.',
            components: 'NewSinceGlow',
          });
        }
        await closeOverlays(page);
      }

      await tab(page, 'Health');
      if (await tryButton(page, 'Reminder times')) {
        await shot(page, 'medicine-reminder-times', {
          title: 'Medicine tray reminder times',
          screen: 'app/(tabs)/health.tsx + lib/medicineNotifications.ts',
          state: 'SHEET. ONE reminder per tray, shared by every medicine in it, with a "Taken" action that logs the whole tray from the notification shade. Quiet hours SKIP a tray rather than shifting it.',
        });
        await closeOverlays(page);
      }
    }

    // ---- 4. pushed sub-screens (each excursion ends in a DB wipe) --------
    if (FULL) {
      console.log('> pushed sub-screens');

      await excursion(page, 'food', async () => {
        await tab(page, 'Shop');
        await tryButton(page, 'Food');
        await page.waitForTimeout(900);
        await shot(page, 'food', {
          title: 'Food & meals (a button on Shopping, not a tab)',
          screen: 'app/food.tsx',
          state: 'EMPTY. Orange screen hue. The per-meal "add a dish" trigger sits at the BOTTOM of the list it appends to — it used to be a small "+" wedged into the section header beside the collapse chevron, close enough that the two read as one crowded control.',
          components: 'FoodTab, AddDishSheet, AddRow',
        });
      });

      await excursion(page, 'catalogue', async () => {
        await tab(page, 'Shop');
        await tryButton(page, 'Catalogue');
        await page.waitForTimeout(900);
        await shot(page, 'catalogue', {
          title: 'Catalogue (a button on Shopping)',
          screen: 'app/catalogue.tsx',
          state: 'SEEDED — the one surface with content on a fresh install. It is the shopping catalogue that powers autocomplete, and receipts scanned by OCR upsert into it.',
          components: 'CatalogueTab, InlineAddItem',
        });
      });

      await excursion(page, 'notes-empty', async () => {
        await tab(page, 'Home');
        await clickText(page, 'Notes');
        await page.waitForTimeout(1000);
        await shot(page, 'notes-empty', {
          title: 'Notes (reached from Home\'s Notes card)',
          screen: 'app/notes.tsx',
          state: 'EMPTY. Yellow screen hue. This empty state is the ONE first-person line in the whole app, and it is deliberate — see VOICE.md. Rows here are edited IN PLACE, which is the one thing the Home notes card does not do.',
          components: 'NoteRow, PadRow, AddFAB, VoiceNoteFAB',
        });
      });

      await excursion(page, 'day-log', async () => {
        await tab(page, 'To-do');
        await tryButton(page, 'Earlier days');
        await page.waitForTimeout(1000);
        await shot(page, 'day-log-screen', {
          title: 'Earlier days (the day log, one day at a time)',
          screen: 'app/day-log.tsx',
          state: 'EMPTY. One day at a time, deliberately with NO week view and no aggregation — two days compared is a scoreboard. No count, total, percentage or progress bar appears anywhere in this feature, and a test source-scans the module to keep it that way.',
          components: 'PlanTaskCard, DateChipRow',
        });
      });

      await excursion(page, 'health-form', async () => {
        await tab(page, 'Health');
        await tryButton(page, "What's bothering you?");
        await page.waitForTimeout(1000);
        await shot(page, 'health-form', {
          title: 'Log a symptom',
          screen: 'app/health-form.tsx',
          state: 'FORM, empty. A symptom entry can be a point in time or an ONGOING episode. An episode is a STATE, not a stretch of time: there is no live elapsed counter anywhere, duration is computed on read and rounded into plain language ("About 4 hours", never "3h 47m"), and nothing auto-closes, escalates or notifies at any horizon.',
          components: 'FormControls, DatePickerCalendar, EpisodeCloseSheet',
        });
      });

      await excursion(page, 'health-log', async () => {
        await tab(page, 'Health');
        await tryButton(page, 'Health log');
        await page.waitForTimeout(1000);
        await shot(page, 'health-log', {
          title: 'Health log (history)',
          screen: 'app/health-log.tsx',
          state: 'EMPTY. Health data is the most sensitive in the app: it never syncs between devices, and it is deliberately excluded from the AI setup guide entirely.',
        });
      });

      await excursion(page, 'medicine-form', async () => {
        await tab(page, 'Health');
        if (await seedMedicine(page, 'Vitamin D')) {
          await tryButton(page, 'Vitamin D');
          await page.waitForTimeout(1000);
          await shot(page, 'medicine-form', {
            title: 'The medicine editor',
            screen: 'app/medicine-form.tsx',
            state: 'FORM. Reached by tapping the medicine\'s NAME (its circle logs a dose instead). As-needed medicines belong to no tray and are guarded by a minimum gap plus an optional daily cap — nothing ever nudges you to take one.',
            components: 'FormControls, Stepper, TimeBoxInput',
          });
        }
      });

      await excursion(page, 'settings', async () => {
        await tab(page, 'Home');
        await tryButton(page, 'Settings');
        await page.waitForTimeout(1400);
        await shot(page, 'settings-general', {
          title: 'Settings — General',
          screen: 'app/settings.tsx',
          state: 'Neutral grey: Home and Settings are the only two screens with no hue of their own. Three tabs — General (profile, appearance, accessibility, backup, version, reset), Personal, Advanced — reorganised down from four.',
          components: 'TabSlider, FormControls, Surface, SectionCard',
        });
        if (await tryText(page, 'Personal', 4000)) {
          await page.waitForTimeout(900);
          await shot(page, 'settings-personal', {
            title: 'Settings — Personal',
            screen: 'app/settings.tsx',
            state: 'Notifications, shopping cadence, the global layout default, device features. "Run setup again" here re-enters onboarding\'s Basics screen with all six rows, seeded from current settings, so pressing straight through writes them back unchanged.',
          });
        }
        if (await tryText(page, 'Advanced', 4000)) {
          await page.waitForTimeout(900);
          await shot(page, 'settings-advanced', {
            title: 'Settings — Advanced',
            screen: 'app/settings.tsx',
            state: 'Feature flags in three states: on-by-default-but-real (Energy, Goals, Medicine, Day log), off-by-default opt-in (Automations), and hidden outright — every sharing-with-other-people surface is currently behind one constant while the single-user basics are reworked. Nothing was deleted to hide them.',
          });
        }
      });

      await excursion(page, 'design-lab', async () => {
        await tab(page, 'Home');
        await tryButton(page, 'Settings');
        await page.waitForTimeout(1400);
        await tryText(page, 'Advanced', 4000);
        await page.waitForTimeout(900);
        const labSwitch = page.getByRole('switch', { name: 'Design lab', exact: true }).first();
        if (!(await labSwitch.isVisible({ timeout: 4000 }).catch(() => false))) return;
        await labSwitch.click({ timeout: 8000 });
        await page.waitForTimeout(900);
        await page.getByText('Design lab', { exact: true }).last().click({ timeout: 8000 });
        await page.waitForTimeout(1800);
        await shot(page, 'design-lab-playground', {
          title: 'Design lab — the playground',
          screen: 'app/design-lab/index.tsx',
          state: 'OFF BY DEFAULT, and the most relevant screen in this bundle for a reviewer: it is a workbench of empty screens and empty cards you build on, and the result exports as a document an agent applies to the real files. Every PART on it is the app\'s real component; only the ARRANGEMENT is the lab\'s.',
          components: 'DesignLabCard, DesignLabBench, PartPalette, PartControls, CardStarterSheet',
        });
        if (await tryText(page, 'Add a card', 4000)) {
          await page.waitForTimeout(900);
          await shot(page, 'design-lab-add-card', {
            title: 'Design lab — the add-a-card sheet',
            screen: 'components/CardStarterSheet.tsx',
            state: 'SHEET. Blank first, then two skeletons, then the eleven real app cards under their own heading — a card that names an origin exports as "the to-do card, but with the tick moved", i.e. a diff against something real.',
          });
          await tryText(page, 'A blank card', 4000);
          await page.waitForTimeout(1200);
          await shot(page, 'design-lab-blank-card', {
            title: 'Design lab — a blank card on the bench',
            screen: 'app/design-lab/index.tsx',
            state: 'Placement is free in the card\'s own four-column body grid and snapped in the row (the seven row slots go through the real PadRow). Every drag has a tap equivalent, deliberately — a drag-only control is one no automated check in this repo can reach.',
          });
        }
        if (await tryButton(page, 'Colours and shapes')) {
          await page.waitForTimeout(1400);
          await shot(page, 'design-lab-tokens', {
            title: 'Design lab — the token knobs',
            screen: 'app/design-lab/tokens.tsx',
            state: '34 palette tokens, 11 geometry numbers, 7 control jobs, 4 row positions, and the export. Two hook points carry the whole thing — useAppTheme() for colour and scaleStyles() for geometry — so no component gained a prop and there is no second rendering path.',
            components: 'ColorPickerSheet, Slider, TabSlider',
          });
          // Two pushes deep (settings → lab → tokens); the excursion's own back() only
          // unwinds one, and ensureTabs() catches whatever this lands on.
          await page.goBack().catch(() => {});
          await page.waitForTimeout(900);
        }
      });
    }

    // ---- 5. seed for real, shoot the populated states --------------------
    console.log('> seeding + populated states');
    await tab(page, 'To-do');

    const typeLine = (await onScreenField(page, 'Type task')) || page.getByLabel('Type task', { exact: true }).first();
    await typeLine.scrollIntoViewIfNeeded().catch(() => {});
    await typeLine.click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await shot(page, 'quick-add-focused-empty', {
      title: 'The quick-add composer, focused and empty',
      screen: 'components/PadTypeRow.tsx',
      state: 'THE COMPOSER — three tiers, and this is the shape used on every surface. Tier 1 is the line: a name alone must always produce a valid row, or capture costs more than one gesture. Tier 2 is the labelled options panel, visible only while typing. Tier 3 is everything else behind the worded "More options", which is live in every state including an empty line. No blind tap-cycles: a stepper for a number, a picker for a choice.',
      components: 'PadTypeRow, QuickAddOptionsPanel, QuickAddOptionRow, Stepper',
    });

    for (const t of ['Ring the dentist', 'Water the plants', 'Pick up a parcel']) await seedTask(page, t);
    await shot(page, 'plans-today-populated', {
      title: 'To-do — Today, with tasks',
      screen: 'app/(tabs)/plans.tsx',
      state: 'POPULATED. The elastic timeline ahead of the now-line. Device-calendar events (read-only) draw here too, as structure rather than achievement, sharing one layout pass with tasks so an overlapping meeting and task go side by side rather than stacking.',
      components: 'PlanTaskCard, PadRow, DayGridLines',
    });

    const check = page.getByRole('checkbox', { name: 'Ring the dentist', exact: true }).first();
    if (await check.count()) {
      await check.click({ timeout: 10000 });
      await page.waitForTimeout(1000);
      await shot(page, 'day-log-after-tick', {
        title: 'To-do — a ticked task crosses the now-line into the day log',
        screen: 'lib/dayLog.ts, drawn by components/PlanTaskCard.tsx',
        state: 'THE DAY LOG — the feature\'s whole idea in one screenshot. Ahead of now, the day is elastic with visible gaps; behind now, the SAME day collapses into a flush, spacing-free list of what actually happened. A gap ahead of you is room; the identical gap behind you is an accusation. It is a record, not a productivity surface: no count, no total, no percentage, no verdict on a quiet day, and no notification ever.',
      });
    } else {
      problems.push('No checkbox for the seeded task — day-log state not captured');
    }

    const line2 = (await onScreenField(page, 'Type task')) || page.getByLabel('Type task', { exact: true }).first();
    await line2.scrollIntoViewIfNeeded().catch(() => {});
    await line2.click({ timeout: 8000 });
    await line2.fill('Sat in the sun for a bit');
    await page.waitForTimeout(500);
    const captureToggle = page.getByRole('switch', { name: 'What just happened?', exact: true }).first();
    if (await captureToggle.isVisible().catch(() => false)) {
      await captureToggle.click({ timeout: 8000 });
      await page.waitForTimeout(500);
      await shot(page, 'quick-add-moment-mode', {
        title: 'The same field, switched to capturing a moment',
        screen: 'components/PadTypeRow.tsx',
        state: 'One field, one submit: a switch in the composer changes whether Enter commits a task or a day-log moment. There is deliberately no second input anywhere — the standalone quick-capture inbox was removed and its table is dead.',
      });
      await page.getByLabel('What just happened?', { exact: true }).first().press('Enter');
      await page.waitForTimeout(900);
      await shot(page, 'day-log-with-moment', {
        title: 'The day log with a captured moment in it',
        screen: 'lib/dayLog.ts',
        state: 'Sources are tasks, habits, medicine doses, health entries and manual moments. Shopping and notes are deliberately out. A completion from before the app started timestamping has no honest time and is simply absent — absence beats invention.',
      });
    }

    if (await tryText(page, 'All tasks', 4000)) {
      await page.waitForTimeout(800);
      await shot(page, 'plans-all-tasks', {
        title: 'To-do — All tasks',
        screen: 'app/(tabs)/plans.tsx',
        state: 'POPULATED, grouped by kind. The undated "Whenever" backlog is one of the few lists with a manual drag order — Today and This week are ordered by the clock, and dragging a 09:00 task under a 14:00 one would either lie about the order or silently retime the task.',
        components: 'TaskCard, SectionCard, AddRow, DraggableTaskRow, CollapsedSection',
      });

      const taskRow = page.getByText('Water the plants', { exact: true }).first();
      if (await taskRow.isVisible().catch(() => false)) {
        await taskRow.click({ timeout: 8000 });
        await page.waitForTimeout(1000);
        await shot(page, 'task-editor', {
          title: 'The task editor (expands in place — not a pushed screen)',
          screen: 'components/TaskCard.tsx',
          state: 'TIER 3, the densest form in the app. Date, time-box, repeat, reminder, energy, tags, goal, steps, and the four per-item card types (standard / simple / note / stepped) picked from a labelled row of visible words, never icons. Switching type is lossless and reversible — nothing is ever cleared.',
          components: 'TaskCard, TimeBoxInput, GoalPicker, TagPickerRow, DateChipRow, Stepper, VoiceNoteFAB',
        });
        await taskRow.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(600);
      }
      await tryText(page, 'Today', 4000);
      await page.waitForTimeout(600);
    }

    console.log('> habits');
    await tab(page, 'Habits');
    await seedHabit(page, 'Drink water');
    await seedHabit(page, 'Ten minutes outside');
    await shot(page, 'habits-populated', {
      title: 'Habits — with habits, none registered yet',
      screen: 'app/(tabs)/habits.tsx',
      state: 'POPULATED. Every habit registers through a −/+ pair rather than a check circle. A habit enters the day log on the FIRST log of the day, not on "met" — 5 of 7 glasses of water still leaves a trace, which is exactly the kind of day the log exists for.',
      components: 'PadRow, HabitIcon, HabitLeading, Stepper, StageTree',
    });

    const plus = page.getByRole('button', { name: 'Increase quantity Drink water', exact: true }).first();
    if (await plus.count()) {
      await plus.click({ timeout: 8000 });
      await page.waitForTimeout(900);
      await shot(page, 'habits-registered', {
        title: 'Habits — one registered today',
        screen: 'app/(tabs)/habits.tsx',
        state: 'A rest day and a count still at 0 are simply excluded — there is no failed state to render. Reward for a streak is ambient and shows no number anywhere: the screen backdrop tints from blue toward green and grows extra branches from a high-water mark, so branches never un-grow and a lapsed streak returns the art to exactly what it always was.',
        components: 'ScreenBackground, Motif',
      });
    }

    console.log('> health');
    await tab(page, 'Health');
    if (await seedMedicine(page, 'Vitamin D')) {
      await shot(page, 'health-medicine-tray', {
        title: 'Health — a medicine in its tray',
        screen: 'components/MedicineTrayCard.tsx',
        state: 'POPULATED. A tray is a WINDOW, not a clock time: a dose taken at 11:40 is still a morning dose, and an untaken one reads "still due" — never "missed". Same no-shame framing as habits\' rest days; CI fails a PR that introduces "missed"/"overdue"/"behind" copy.',
      });
      const dose = page.getByRole('checkbox', { name: 'Mark Vitamin D as taken', exact: true }).first();
      if (await dose.count()) {
        await dose.click({ timeout: 8000 });
        await page.waitForTimeout(800);
        await shot(page, 'health-dose-logged', {
          title: 'Health — a dose logged',
          screen: 'components/MedicineTrayCard.tsx',
          state: 'The dose is a separate table from the medicine row. A symptom entry can optionally be attributed to a medicine ("this one gives me stomach issues") — and that relief/attribution data is DISPLAYED and never interpreted: no correlation, no ranking, no "this usually helps".',
        });
      }
    }

    console.log('> shopping');
    await tab(page, 'Shop');
    if (await tryButton(page, 'Create a new list')) {
      await shot(page, 'shopping-new-list-modal', {
        title: 'Shopping — creating a list',
        screen: 'components/AppModal.tsx',
        state: 'MODAL. The app has ZERO native `Alert.alert` call sites left — every dialog is this in-app modal, which is also why the whole surface is reachable in this web preview at all.',
      });
      await tryText(page, 'Start empty', 4000);
      await page.waitForTimeout(1400);
      // A new list arrives collapsed; its items (and the add affordance) are behind the chevron.
      if (!(await tryButton(page, 'Expand list'))) await tryText(page, 'Shopping list', 3000);
      await page.waitForTimeout(900);
      await shot(page, 'shopping-list-expanded-empty', {
        title: 'Shopping — a new, empty week list',
        screen: 'components/WeekListCard.tsx',
        state: 'EMPTY LIST. A list can be locked, reordered by drag, filled from the monthly list or from a saved dish. The monthly list is a different shape again (a table), and a monthly reset NULLs every purchase — which is why shopping is deliberately kept out of the day log.',
        components: 'WeekListCard, InlineAddItem, AddFromMonthlyModal, ListSettingsSheet',
      });

      if (await tryButton(page, 'Search for items…')) {
        await shot(page, 'shopping-inline-add-item', {
          title: 'The shopping composer (InlineAddItem)',
          screen: 'components/InlineAddItem.tsx',
          state: 'THE ONE COMPOSER THAT DOES NOT TIER. Name, catalogue autocomplete, price, category and quantity all open at once, which is why it is the only add-flow in the app that feels like a form. Its tier 2 is genuinely richer than the others (a catalogue lookup is the point of this surface), so folding it in is a real design question rather than a tidy-up — a good thing for a reviewer to have an opinion about.',
          components: 'InlineAddItem, FormControls, Stepper',
        });
        const itemField = page.getByPlaceholder('Item').first();
        for (const item of ['Melk', 'Brød', 'Epler']) {
          if (!(await itemField.isVisible().catch(() => false))) {
            if (!(await tryButton(page, 'Search for items…'))) break;
          }
          await page.getByPlaceholder('Item').first().fill(item);
          await page.getByPlaceholder('Item').first().press('Enter');
          await page.waitForTimeout(800);
        }
      }
    }
    await shot(page, 'shopping-populated', {
      title: 'Shopping — with a list and items',
      screen: 'app/(tabs)/shopping.tsx',
      state: 'POPULATED. The ONE surface still hand-rolling its rows instead of drawing through the shared PadRow — the last conversion left, and the largest. Quantity READS in the row\'s leading cluster and is EDITED in a sheet opened by tapping the row body.',
      components: 'ShoppingRow, WeekListCard, InlineAddItem, MonthlyTableRow, SavedListsSection',
    });

    // The row-body tap opens the item sheet — the only editor for a weekly item's quantity,
    // unit, price and category.
    if (await tryText(page, 'Melk', 3000)) {
      await shot(page, 'shopping-item-sheet', {
        title: 'The shopping item sheet',
        screen: 'components/ShoppingItemSheet.tsx',
        state: 'SHEET. Quantity READS in the row and is EDITED here: the row\'s old +/− buttons were removed on purpose, because a value you can change in the row invites changing it by accident while shopping.',
      });
      await closeOverlays(page);
    }

    if (await tryText(page, 'Monthly list', 3000)) {
      await page.waitForTimeout(900);
      await shot(page, 'shopping-monthly', {
        title: 'Shopping — the Monthly list',
        screen: 'app/(tabs)/shopping.tsx',
        state: 'A TABLE, not a list of rows — the one place in the app that draws a table. A migration seeds one empty monthly list on every install, which is why an empty-state gate here has to count items rather than lists.',
        components: 'MonthlyTableRow, MonthlyResetReviewSheet, MonthlyResetSummaryModal',
      });
      await tryText(page, 'Week lists', 3000);
      await page.waitForTimeout(700);
    }

    console.log('> home, populated');
    await tab(page, 'Home');
    await shot(page, 'home-populated', {
      title: 'Home — with everything seeded',
      screen: 'app/(tabs)/index.tsx',
      state: 'POPULATED. Every card here previews another tab and carries that tab\'s border hue — the one legitimate use of an explicit borderColor override in the whole app. Card order is user-draggable. Note the same day-view card as the To-do tab: that is why the day log needed no Home card of its own.',
      components: 'PlanTaskCard, HomeHabitsCard, HomeNotesCard, HomeShoppingCard, EnergyMeter, HomeCardManager',
    });

    if (await typeInto(page, 'Type note', 'Ask about the bike lock')) {
      const noteCheck = page.getByRole('checkbox', { name: 'Ask about the bike lock', exact: true }).first();
      if (await noteCheck.count()) {
        await noteCheck.click({ timeout: 8000 });
        await page.waitForTimeout(800);
      }
      await shot(page, 'home-note-ticked-in-place', {
        title: 'Home — a note ticked today stays in place',
        screen: 'components/HomeNotesCard.tsx',
        state: 'Struck through where it is, rather than vanishing into a checked zone until tomorrow. The row anatomy is fixed app-wide: [leading?] title → ONE meta line → ONE right-hand value → [⋯ action] → [○ check], with the check on the RIGHT like the ticks in the margin of a paper checklist.',
        components: 'HomeNotesCard, PadRow',
      });
    }

    // ---- 6. the last push (nothing follows, so the wipe costs nothing) ---
    if (FULL) {
      console.log('> notes, populated (last)');
      try {
        await clickText(page, 'Notes');
        await page.waitForTimeout(1200);
        await shot(page, 'notes-populated', {
          title: 'Notes — with a note, edited in place',
          screen: 'app/notes.tsx',
          state: 'POPULATED. Each row\'s title is a live text field (PadRow\'s titleInput) — this screen exists to edit them. Notes are ordered `checked, sort_order`, the one list whose reorder renumbers per section.',
          components: 'NoteRow, PadRow, SendToSheet',
        });
        const action = page.getByRole('button', { name: 'Send it to…', exact: true }).first();
        if (await action.count()) {
          await action.scrollIntoViewIfNeeded();
          await action.click({ timeout: 8000 });
          await page.waitForTimeout(900);
          await shot(page, 'notes-send-to-sheet', {
            title: 'The ⋯ row-action sheet',
            screen: 'components/SendToSheet.tsx',
            state: 'SHEET. ONE row-level action button, sitting just inside the check, replacing the assorted trailing trash / send / put-back buttons each surface used to grow its own version of.',
          });
        }
      } catch (e) {
        problems.push(`notes-populated: ${e.message.split('\n')[0]}`);
      }
    }

    console.log(`\n> ${captions.length} screenshots, ${problems.length} problems`);
    problems.forEach((p) => console.log('  ', p));
  } finally {
    await browser.close();
  }

  writeIndex();
}

// ---------------------------------------------------------------------------

function writeIndex() {
  const indexPath = path.join(outDir, 'index.json');
  const existing = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
  const merged = [...existing.filter((c) => c.theme !== THEME), ...captions];
  fs.writeFileSync(indexPath, JSON.stringify(merged, null, 2));

  const L = [];
  L.push('# Screens and states');
  L.push('');
  L.push(
    'Captured from the real app running as a web build at 430×932, full-page so nothing below ' +
      'the fold is lost. react-native-web is faithful for layout, spacing, hierarchy and copy, ' +
      'but is NOT pixel-identical to native: shadows/elevation, some font metrics and animation ' +
      'timing differ, and a few native-only surfaces (receipt OCR, home-screen widgets, every ' +
      'gesture) cannot be shown at all. Judge composition and hierarchy from these; do not judge ' +
      'shadow softness.'
  );
  L.push('');
  L.push(
    '**Each caption says which STATE the shot is in.** The empty ones matter as much as the ' +
      'full ones — a fresh install is what every user meets first, and this app puts real ' +
      'teaching content there rather than a blank list.'
  );
  L.push('');
  for (const theme of ['light', 'dark']) {
    const rows = merged.filter((c) => c.theme === theme);
    if (!rows.length) continue;
    L.push(`## ${theme === 'light' ? 'Light mode' : 'Dark mode'}`);
    L.push('');
    for (const c of rows) {
      L.push(`### ${c.title || c.name}`);
      L.push('');
      L.push(`![${c.title || c.name}](${c.file})`);
      L.push('');
      const meta = [];
      if (c.screen) meta.push(`**Drawn by:** \`${c.screen}\``);
      if (c.components) meta.push(`**Components:** ${c.components}`);
      if (meta.length) {
        L.push(meta.join('  \n'));
        L.push('');
      }
      if (c.state) {
        L.push(c.state);
        L.push('');
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'INDEX.md'), L.join('\n'));
  console.log(`> wrote ${path.join(outDir, 'INDEX.md')} (${merged.length} shots)`);
}

main().catch((err) => {
  console.error(err);
  writeIndex();
  process.exitCode = 1;
});
