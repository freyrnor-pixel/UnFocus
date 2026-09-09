#!/usr/bin/env bash
# run-jitter.sh — builds the web preview, serves it, and watches a resting screen for
# something that will not settle. Same shape (and the same server-lifecycle care) as
# run-visual.sh; see scripts/measure-jitter.mjs for what it can and cannot see.
set -uo pipefail
cd "$(dirname "$0")/.."
if [ -n "${FORCE_BUILD:-}" ] || [ ! -d dist ]; then npm run preview:build; fi
node scripts/serve-web.mjs > /tmp/unfocus-jitter-serve.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT
sleep 2
node scripts/measure-jitter.mjs "$@"
