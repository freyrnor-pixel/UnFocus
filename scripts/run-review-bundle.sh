#!/usr/bin/env bash
# run-review-bundle.sh — build the whole "hand this to a reviewer" package in one command.
#
#   1. build the web bundle (same one `npm run preview` uses)
#   2. serve it, walk it with Playwright, screenshot every screen and state (light + dark)
#   3. collect every component / screen / design-token file into chunked Markdown, and
#      derive the connection map from the real imports
#   4. zip the lot
#
# Output: review-bundle/ and review-bundle.zip (both gitignored — this is a generated
# artifact, like dist/ and preview-shots/).
#
# The server is backgrounded with its stdout redirected to a log and killed on exit. Do NOT
# "simplify" that to `cmd &`: a long-lived process inheriting this shell's stdout keeps the
# pipe open forever and hangs any caller that reads output until EOF. See AGENTS.md's
# "Background HTTP servers" gotcha, which was root-caused from exactly this shape.
set -e

SKIP_BUILD="${SKIP_BUILD:-0}"

if [ "$SKIP_BUILD" != "1" ]; then
  npm run preview:build
fi

node scripts/serve-web.mjs > /tmp/unfocus-review-serve.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

sleep 1

echo "> screenshots (light)"
node scripts/screenshot-states.mjs

echo "> screenshots (dark)"
node scripts/screenshot-states.mjs --theme=dark --only=core

echo "> collecting sources + connection map"
node scripts/collect-review-bundle.mjs

echo "> zipping"
rm -f review-bundle.zip
zip -qr review-bundle.zip review-bundle
echo "> done: review-bundle.zip ($(du -h review-bundle.zip | cut -f1))"
