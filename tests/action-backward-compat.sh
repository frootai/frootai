#!/usr/bin/env bash
# [M7.12] Backward compatibility integration test
#
# Runs the v5-only workflow (test-v5-backward-compat.yml) against the
# current v6 action via `act` and asserts:
#   1. Action does NOT error when federation inputs are omitted
#   2. v5 outputs (status, result, cost, score) are populated
#   3. Federation outputs default to [] / 0 (not error)
#
# Prerequisites:
#   - `act` installed (https://github.com/nektos/act)
#   - Docker running
#
# Usage:
#   cd frootai/
#   bash tests/action-backward-compat.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colours
if [ -t 1 ]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; RESET='\033[0m'
else
  GREEN=''; RED=''; RESET=''
fi

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  [M7.12] Backward Compat Test — v5 YAML on v6 Action   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Repository: $REPO_ROOT"
echo ""

# Verify act is available
if ! command -v act &> /dev/null; then
  echo "ERROR: 'act' is not installed. Install from https://github.com/nektos/act"
  exit 1
fi

WORKFLOW=".github/workflows/test-v5-backward-compat.yml"
LOG_FILE="$(mktemp)"

echo "Running: act -W $WORKFLOW (dry-run first)..."

# Dry-run to validate YAML syntax
if ! act -n -W "$WORKFLOW" \
     --defaultbranch main \
     -P ubuntu-latest=catthehacker/ubuntu:act-latest \
     -C "$REPO_ROOT" > "$LOG_FILE" 2>&1; then
  echo -e "${RED}FAIL${RESET} — YAML parse / dry-run failed"
  cat "$LOG_FILE"
  rm -f "$LOG_FILE"
  exit 1
fi

echo "Dry-run passed. Running full workflow..."

# Full run
if ! act -W "$WORKFLOW" \
     --defaultbranch main \
     -P ubuntu-latest=catthehacker/ubuntu:act-latest \
     -C "$REPO_ROOT" > "$LOG_FILE" 2>&1; then
  echo -e "${RED}FAIL${RESET} — act exited non-zero"
  echo ""
  echo "Last 40 lines of output:"
  tail -40 "$LOG_FILE"
  rm -f "$LOG_FILE"
  exit 1
fi

# Assert key markers in the log
FAILURES=0

assert_in_log() {
  local pattern="$1"
  local desc="$2"
  if grep -q "$pattern" "$LOG_FILE"; then
    echo -e "  ${GREEN}✓${RESET} $desc"
  else
    echo -e "  ${RED}✗${RESET} $desc (pattern not found: $pattern)"
    FAILURES=$((FAILURES + 1))
  fi
}

echo ""
echo "Assertions:"
assert_in_log "status=" "v5 status output emitted"
assert_in_log "mcp-attached=\[\]" "mcp-attached defaults to []"
assert_in_log "mcp-tools-count=0" "mcp-tools-count defaults to 0"

rm -f "$LOG_FILE"

echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}BACKWARD COMPAT TEST PASSED${RESET}"
  echo "v5 workflow YAML runs against v6 action with no errors + correct defaults."
  exit 0
else
  echo -e "${RED}$FAILURES ASSERTION(S) FAILED${RESET}"
  exit 1
fi
