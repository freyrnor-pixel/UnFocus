#!/usr/bin/env node
// build-web.mjs — `expo export --platform web`, then wires the sql.js fallback
// (see lib/sqlite.web.ts) in: copies its wasm+glue into dist/ and rewrites
// dist/index.html so sql.js finishes loading BEFORE the app bundle's <script>
// tag is even inserted. That ordering is what lets lib/sqlite.web.ts read
// window.__unfocusSqlJsDb__ synchronously at module-eval time.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

console.log('> expo export --platform web');
execFileSync('npx', ['expo', 'export', '--platform', 'web'], { cwd: ROOT, stdio: 'inherit' });

console.log('> copying sql.js runtime into dist/');
const sqlJsDist = path.join(ROOT, 'node_modules', 'sql.js', 'dist');
fs.copyFileSync(path.join(sqlJsDist, 'sql-wasm.js'), path.join(DIST, 'sql-wasm.js'));
fs.copyFileSync(path.join(sqlJsDist, 'sql-wasm.wasm'), path.join(DIST, 'sql-wasm.wasm'));

console.log('> patching dist/index.html to bootstrap sql.js before the app bundle');
const indexPath = path.join(DIST, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const scriptTagRe = /<script src="([^"]+entry-[^"]+\.js)" defer><\/script>/;
const match = html.match(scriptTagRe);
if (!match) {
  throw new Error('build-web: could not find the app entry <script> tag in dist/index.html to defer');
}
const entrySrc = match[1];

const bootstrap = `
    <script src="/sql-wasm.js"></script>
    <script>
      initSqlJs({ locateFile: () => '/sql-wasm.wasm' }).then(function (SQL) {
        window.__unfocusSqlJsDb__ = new SQL.Database();
        var s = document.createElement('script');
        s.src = ${JSON.stringify(entrySrc)};
        document.body.appendChild(s);
      });
    </script>
  `;

html = html.replace(scriptTagRe, bootstrap.trim());
fs.writeFileSync(indexPath, html);

console.log('> done. Serve with: node scripts/serve-web.mjs');
