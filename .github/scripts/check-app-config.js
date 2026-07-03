#!/usr/bin/env node
// Fails CI if app.json regresses on either historically-broken invariant:
//   1. runtimeVersion must be a plain non-empty string (NOT a { policy: ... } object) —
//      this is exactly the bug that made every OTA update silently rejected on-device
//      in the predecessor app (resolved appVersion != embedded build runtime, no error
//      surfaced anywhere). See AGENTS.md "Runtime version".
//   2. slug must stay "all-the-small-things" — EAS project identity; AGENTS.md invariant.

const fs = require('fs');
const path = require('path');

const APP_JSON_PATH = path.join(__dirname, '..', '..', 'app.json');
const REQUIRED_SLUG = 'all-the-small-things';

let raw;
try {
  raw = fs.readFileSync(APP_JSON_PATH, 'utf8');
} catch (err) {
  console.error(`[check-app-config] FATAL: could not read ${APP_JSON_PATH}: ${err.message}`);
  process.exit(1);
}

let json;
try {
  json = JSON.parse(raw);
} catch (err) {
  console.error(`[check-app-config] FATAL: app.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

const expo = json.expo || {};
const errors = [];

const rv = expo.runtimeVersion;
if (typeof rv !== 'string' || rv.trim() === '') {
  errors.push(
    `expo.runtimeVersion must be a non-empty plain string (e.g. "1.0.0"), got: ${JSON.stringify(rv)}. ` +
    `A { policy: ... } object (e.g. { "policy": "appVersion" }) is exactly what caused a past incident ` +
    `in this app's predecessor: it resolved to a runtime that did not match the installed APK's embedded ` +
    `runtime, so EVERY OTA update was silently rejected on-device with no error anywhere. Do not bump this ` +
    `ahead of an actual EAS build with the matching runtime — see AGENTS.md "Runtime version" section.`
  );
}

if (expo.slug !== REQUIRED_SLUG) {
  errors.push(
    `expo.slug must be exactly "${REQUIRED_SLUG}", got: ${JSON.stringify(expo.slug)}. ` +
    `The EAS project is registered under this slug — changing it breaks builds/updates. ` +
    `See AGENTS.md key-invariants table.`
  );
}

if (errors.length > 0) {
  console.error('[check-app-config] app.json failed validation:\n');
  for (const e of errors) console.error(`  - ${e}\n`);
  process.exit(1);
}

console.log('[check-app-config] OK — runtimeVersion is a plain string, slug is correct.');
