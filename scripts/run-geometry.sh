#!/usr/bin/env bash
# Builds the web preview (unless dist/ is already there), serves it, runs the geometry audit and
# ALWAYS kills the server — an orphaned static server keeps the caller's stdout fd open and
# hangs the whole shell (see AGENTS.md's "Background HTTP servers" gotcha).
set -uo pipefail
cd "$(dirname "$0")/.."
if [ -n "${FORCE_BUILD:-}" ] || [ ! -d dist ]; then npm run preview:build; fi
node scripts/serve-web.mjs > /tmp/unfocus-geometry-serve.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT
sleep 2
node scripts/measure-geometry.mjs "$@"
