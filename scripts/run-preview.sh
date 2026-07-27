#!/usr/bin/env bash
# run-preview.sh — orchestrates the web preview (build, serve, drive with Playwright)
# without the stdout/lifecycle hang `npm run preview` used to have.
#
# The old inline npm script backgrounded serve-web.mjs with a bare `&`, which
# left it inheriting the invoking shell's stdout fd. serve-web.mjs is an HTTP
# server that runs forever, so that fd never closed — any caller that reads
# output until EOF (a `| tail`/`| tee` pipe, or an agent harness capturing a
# command's output as a file/pipe) blocked forever, even though the actual
# Playwright run had long since finished. It also never killed the server, so
# a second `npm run preview` in the same session hit EADDRINUSE and silently
# served the FIRST run's stale dist/. See AGENTS.md "Known gotchas — hanging
# commands" for the full writeup.
set -e

npm run preview:build

node scripts/serve-web.mjs > /tmp/unfocus-preview-serve.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

sleep 1
node scripts/preview.mjs "$@"
