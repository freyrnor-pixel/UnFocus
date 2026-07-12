#!/usr/bin/env bash
#
# test-changed.sh — run only the Jest tests affected by the current changes.
#
# Implements the repo's testing policy (see AGENTS.md "Headless verification"):
# full coverage exists, but we run only what a change could affect. Uses Jest's
# --findRelatedTests so a change to lib/date.ts runs date.test.ts (and any other
# suite that imports date.ts), not the whole tree.
#
# Usage:
#   scripts/test-changed.sh            # tests related to unstaged + staged changes vs HEAD
#   scripts/test-changed.sh --all      # run the entire suite
#   scripts/test-changed.sh <files...> # tests related to the given files
#
# Note: this only covers BEHAVIORAL changes. A pure move/rename/comment/header
# edit has nothing to re-test — run `npx tsc --noEmit` for that instead.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--all" ]]; then
  exec npx jest
fi

if [[ $# -gt 0 ]]; then
  files=("$@")
else
  # Changed source files vs HEAD (staged + unstaged), only .ts/.tsx that still exist.
  mapfile -t files < <(git diff --name-only HEAD -- '*.ts' '*.tsx'; git diff --cached --name-only -- '*.ts' '*.tsx')
fi

# De-dupe and keep only files that currently exist on disk.
existing=()
for f in "${files[@]:-}"; do
  [[ -n "$f" && -f "$f" ]] && existing+=("$f")
done
# Unique
if [[ ${#existing[@]} -gt 0 ]]; then
  mapfile -t existing < <(printf '%s\n' "${existing[@]}" | sort -u)
fi

if [[ ${#existing[@]} -eq 0 ]]; then
  echo "test-changed: no changed .ts/.tsx files — nothing to test."
  exit 0
fi

echo "test-changed: finding tests related to:"
printf '  %s\n' "${existing[@]}"
exec npx jest --findRelatedTests "${existing[@]}" --passWithNoTests
