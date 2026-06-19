#!/usr/bin/env bash
# [M7.11] Integration test: trigger the FrootAI action via `act` (local
# GitHub Actions runner) with each federation input combination and assert
# outputs are populated.
#
# Prerequisites:
#   - `act` installed (https://github.com/nektos/act)
#   - Docker running (act uses container images for runner environments)
#
# Usage:
#   cd frootai/
#   bash tests/action-integration.sh
#
# Exit codes:
#   0 — all input combinations passed
#   1 — one or more combinations failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FAILURES=0

# Colours (disable if not a TTY)
if [ -t 1 ]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; RESET='\033[0m'
else
  GREEN=''; RED=''; RESET=''
fi

log_pass() { echo -e "${GREEN}PASS${RESET} $1"; }
log_fail() { echo -e "${RED}FAIL${RESET} $1"; FAILURES=$((FAILURES + 1)); }

# Verify act is available
if ! command -v act &> /dev/null; then
  echo "ERROR: 'act' is not installed. Install from https://github.com/nektos/act"
  exit 1
fi

# ------------------------------------------------------------------
# Test matrix: each entry is "DESCRIPTION|WORKFLOW_FILE|EXTRA_ACT_ARGS"
# ------------------------------------------------------------------
declare -a TESTS=(
  "federation-on+azure|example-federation.yml|"
  "federation-on+multi-mcp|example-multi-mcp.yml|"
  "federation-off-fallback|example-federation.yml|--input mcp-federation=off"
  "no-attach-default|example-federation.yml|--input mcp-attach="
)

# ------------------------------------------------------------------
# Runner
# ------------------------------------------------------------------
run_test() {
  local description="$1"
  local workflow="$2"
  local extra_args="$3"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "TEST: $description"
  echo "  workflow: .github/workflows/$workflow"
  echo "  extra:    ${extra_args:-<none>}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local log_file
  log_file="$(mktemp)"

  # Run act in dry-run mode first to validate YAML parse
  if ! act -n -W ".github/workflows/$workflow" \
       --defaultbranch main \
       -P ubuntu-latest=catthehacker/ubuntu:act-latest \
       $extra_args \
       -C "$REPO_ROOT" > "$log_file" 2>&1; then
    log_fail "$description — YAML parse / dry-run failed"
    cat "$log_file"
    rm -f "$log_file"
    return
  fi

  # Run the actual workflow
  if ! act -W ".github/workflows/$workflow" \
       --defaultbranch main \
       -P ubuntu-latest=catthehacker/ubuntu:act-latest \
       $extra_args \
       -C "$REPO_ROOT" > "$log_file" 2>&1; then
    # federation-off and no-attach cases may legitimately pass with
    # status=pass but tools-count=0; a non-zero exit from act means
    # something deeper failed (missing action, syntax error, etc.)
    if [[ "$description" == *"federation-off"* ]] || [[ "$description" == *"no-attach"* ]]; then
      # These are expected to succeed but with empty federation outputs
      log_fail "$description — act exited non-zero unexpectedly"
      tail -30 "$log_file"
      rm -f "$log_file"
      return
    fi
    log_fail "$description — act exited non-zero"
    tail -30 "$log_file"
    rm -f "$log_file"
    return
  fi

  # Assert outputs were populated (look for the GITHUB_OUTPUT writes in log)
  local has_status has_mcp_attached has_mcp_tools
  has_status=$(grep -c "status=" "$log_file" || true)
  has_mcp_attached=$(grep -c "mcp-attached=" "$log_file" || true)
  has_mcp_tools=$(grep -c "mcp-tools-count=" "$log_file" || true)

  if [ "$has_status" -lt 1 ]; then
    log_fail "$description — 'status' output not found in log"
    rm -f "$log_file"
    return
  fi

  if [ "$has_mcp_attached" -lt 1 ]; then
    log_fail "$description — 'mcp-attached' output not found in log"
    rm -f "$log_file"
    return
  fi

  if [ "$has_mcp_tools" -lt 1 ]; then
    log_fail "$description — 'mcp-tools-count' output not found in log"
    rm -f "$log_file"
    return
  fi

  # For federation-on tests with an attach input, verify mcp-attached is non-empty array
  if [[ "$description" != *"federation-off"* ]] && [[ "$description" != *"no-attach"* ]]; then
    local attached_value
    attached_value=$(grep "mcp-attached=" "$log_file" | tail -1 | sed 's/.*mcp-attached=//')
    if [ "$attached_value" = "[]" ] || [ -z "$attached_value" ]; then
      log_fail "$description — mcp-attached is empty but federation+attach was expected"
      rm -f "$log_file"
      return
    fi
  fi

  log_pass "$description"
  rm -f "$log_file"
}

# ------------------------------------------------------------------
# Execute all tests
# ------------------------------------------------------------------
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  [M7.11] FrootAI Action Integration Tests (via act)    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Repository: $REPO_ROOT"
echo "Tests:      ${#TESTS[@]}"

for entry in "${TESTS[@]}"; do
  IFS='|' read -r desc wf args <<< "$entry"
  run_test "$desc" "$wf" "$args"
done

# ------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}ALL ${#TESTS[@]} TESTS PASSED${RESET}"
  exit 0
else
  echo -e "${RED}$FAILURES / ${#TESTS[@]} TESTS FAILED${RESET}"
  exit 1
fi
