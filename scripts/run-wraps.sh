#!/usr/bin/env bash
# run-wraps.sh — build + serve + run the wrap audit, then clean up the server.
#
# Same lifecycle discipline as run-preview.sh: the static server's stdout/stderr go to a
# log file (never the caller's pipe) and a trap kills it on exit — see AGENTS.md
# "Known gotchas" for why a bare `&` here used to hang the whole tool call forever.
#
# Usage: npm run wraps -- [--lang=no|en] [--width=393] [--json]
#        npm run wraps:all     # the widths/languages worth checking, in one pass
set -e

# Reuse an existing dist/ unless SKIP_BUILD is unset and dist is missing/stale.
if [ ! -d dist ] || [ -n "$FORCE_BUILD" ]; then
  npm run preview:build
fi

node scripts/serve-web.mjs > /tmp/unfocus-wraps-serve.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
sleep 1

node scripts/measure-wraps.mjs "$@"
