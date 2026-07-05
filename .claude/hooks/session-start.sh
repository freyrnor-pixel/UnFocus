#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Parse source from stdin — node_modules persists across resume/clear/compact
# within the same container, so only install on first startup.
HOOK_INPUT=$(cat)
SOURCE=$(echo "$HOOK_INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('source','startup'))" 2>/dev/null || echo "startup")

if [ "$SOURCE" != "startup" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
echo "[session-start] Installing npm dependencies..."
npm install --legacy-peer-deps
echo "[session-start] Done."
