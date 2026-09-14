#!/usr/bin/env bash
# Runs the real-Yoga layout audit.
#
# Unlike every other harness in this repo it needs NO web build and NO server: `yoga-layout` is
# the engine compiled to WASM, so this is a plain node process. That is the whole reason it can
# run on every push where `visual`/`geometry` need a Chromium and a static server.
set -uo pipefail
cd "$(dirname "$0")/.."
node scripts/measure-yoga.mjs "$@"
