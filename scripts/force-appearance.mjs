// force-appearance.mjs — put the web preview in light or dark mode from outside the app.
//
// Extracted from scripts/screenshot-states.mjs (2026-09-01), where it was the only caller.
// It is needed by every headless harness that must check BOTH themes, not just screenshots:
// `measure-geometry.mjs`, `measure-wraps.mjs` and `measure-halos.mjs` all ran light-mode-only
// in CI until this pass — dark is the DEFAULT appearance and every glass/edge/glow decision in
// this app is tuned for it, so a light-only gate guards the mode fewer people actually see, and
// a dark-only regression (e.g. the 2026-08-29 backdrop change) had three of four gates blind
// to it by construction. See AGENTS.md's visual-gate section for the history.
//
// There is no UI route to appearance in this harness: it lives in Settings, Settings is a
// pushed dead end with no in-app back on web, and the only way out (a history navigation)
// reloads the document and wipes the in-memory sql.js DB, taking the setting with it. So this
// sets it UNDER the app instead: `window.__unfocusSqlJsDb__` is created by the index.html
// bootstrap before the app bundle is even inserted (see scripts/build-web.mjs), so an init
// script can intercept the assignment and wrap the handle. `lib/sqlite.web.ts` reads through
// `prepare()`, so re-asserting the value before every read of the settings table also survives
// onboarding writing its own appearance pick back over it.
//
// Call this BEFORE the first `page.goto()` — `addInitScript` only applies to documents loaded
// after it is registered.
export async function forceAppearance(page, mode) {
  await page.addInitScript((wanted) => {
    Object.defineProperty(window, '__unfocusSqlJsDb__', {
      configurable: true,
      set(db) {
        const prepare = db.prepare.bind(db);
        const run = db.run.bind(db);
        db.prepare = (sql, ...rest) => {
          if (typeof sql === 'string' && /\bfrom\s+settings\b/i.test(sql)) {
            try {
              run(`UPDATE settings SET dark_mode = '${wanted}'`);
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
  }, mode);
}

/** Read a `--theme=light|dark` CLI flag, defaulting to light, and the `'on'/'off'` value forceAppearance wants. */
export function themeFromArgs(argv = process.argv) {
  const theme = argv.find((a) => a.startsWith('--theme='))?.split('=')[1] || 'light';
  return { theme, darkModeValue: theme === 'dark' ? 'on' : 'off' };
}
