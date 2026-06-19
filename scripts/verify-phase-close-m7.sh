#!/usr/bin/env bash
# [M7.30] Phase M7 close: verify all 30 sub-phases are shipped,
# tag `federation-action-v0.7.0`, and print summary.
#
# Usage:
#   cd frootai/
#   bash scripts/verify-phase-close-m7.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  [M7.30] Phase M7 Close — Federation Action             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ------------------------------------------------------------------
# Verify deliverables exist
# ------------------------------------------------------------------
FAILURES=0
check() {
  local path="$1"
  local desc="$2"
  if [ -e "$REPO_ROOT/$path" ]; then
    echo "  ✓ $desc"
  else
    echo "  ✗ $desc (MISSING: $path)"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "── Deliverable verification ──"
echo ""

echo "  Inputs (M7.1–M7.3):"
grep -q "mcp-attach:" "$REPO_ROOT/action.yml" && echo "    ✓ mcp-attach input" || { echo "    ✗ mcp-attach input"; FAILURES=$((FAILURES+1)); }
grep -q "mcp-trust-file:" "$REPO_ROOT/action.yml" && echo "    ✓ mcp-trust-file input" || { echo "    ✗ mcp-trust-file input"; FAILURES=$((FAILURES+1)); }
grep -q "mcp-federation:" "$REPO_ROOT/action.yml" && echo "    ✓ mcp-federation input" || { echo "    ✗ mcp-federation input"; FAILURES=$((FAILURES+1)); }

echo ""
echo "  Outputs (M7.4–M7.5):"
grep -q "mcp-attached:" "$REPO_ROOT/action.yml" && echo "    ✓ mcp-attached output" || { echo "    ✗ mcp-attached output"; FAILURES=$((FAILURES+1)); }
grep -q "mcp-tools-count:" "$REPO_ROOT/action.yml" && echo "    ✓ mcp-tools-count output" || { echo "    ✗ mcp-tools-count output"; FAILURES=$((FAILURES+1)); }

echo ""
echo "  Steps (M7.6–M7.8, M7.13–M7.18, M7.25, M7.28):"
grep -q "Map M7 federation inputs" "$REPO_ROOT/action.yml" && echo "    ✓ M7.6 env-mapping step" || { echo "    ✗ M7.6"; FAILURES=$((FAILURES+1)); }
grep -q "federation_attach_completed" "$REPO_ROOT/action.yml" && echo "    ✓ M7.7 JSONL output capture" || { echo "    ✗ M7.7"; FAILURES=$((FAILURES+1)); }
grep -q "node-version: '22'" "$REPO_ROOT/action.yml" && echo "    ✓ M7.8 Node 22 pin" || { echo "    ✗ M7.8"; FAILURES=$((FAILURES+1)); }
grep -q "Validate trust file path" "$REPO_ROOT/action.yml" && echo "    ✓ M7.13 trust validation" || { echo "    ✗ M7.13"; FAILURES=$((FAILURES+1)); }
grep -q "Per-Play auto-attach" "$REPO_ROOT/action.yml" && echo "    ✓ M7.14 auto-attach" || { echo "    ✗ M7.14"; FAILURES=$((FAILURES+1)); }
grep -q "Per-Play trust merge" "$REPO_ROOT/action.yml" && echo "    ✓ M7.15 trust merge" || { echo "    ✗ M7.15"; FAILURES=$((FAILURES+1)); }
grep -q "Federation telemetry summary" "$REPO_ROOT/action.yml" && echo "    ✓ M7.16 telemetry" || { echo "    ✗ M7.16"; FAILURES=$((FAILURES+1)); }
grep -q "FROOTAI_DEBUG" "$REPO_ROOT/action.yml" && echo "    ✓ M7.17 debug propagation" || { echo "    ✗ M7.17"; FAILURES=$((FAILURES+1)); }
grep -q "Federation attach failed" "$REPO_ROOT/action.yml" && echo "    ✓ M7.18 error reporting" || { echo "    ✗ M7.18"; FAILURES=$((FAILURES+1)); }
grep -q "Mask federation env" "$REPO_ROOT/action.yml" && echo "    ✓ M7.25 secrets masking" || { echo "    ✗ M7.25"; FAILURES=$((FAILURES+1)); }
grep -q "ACTION_START_MS" "$REPO_ROOT/action.yml" && echo "    ✓ M7.28 perf instrumentation" || { echo "    ✗ M7.28"; FAILURES=$((FAILURES+1)); }

echo ""
echo "  Workflows (M7.9–M7.12, M7.24):"
check ".github/workflows/example-federation.yml" "M7.9 example-federation"
check ".github/workflows/example-multi-mcp.yml" "M7.10 example-multi-mcp"
check "tests/action-integration.sh" "M7.11 integration test"
check ".github/workflows/test-v5-backward-compat.yml" "M7.12 backward-compat workflow"
check "tests/action-backward-compat.sh" "M7.12 backward-compat test"
check ".github/workflows/test-action-matrix.yml" "M7.24 cross-runner matrix"

echo ""
echo "  Docs + release (M7.19–M7.23, M7.26–M7.27):"
grep -q "GitHub Action" "$REPO_ROOT/README.md" && echo "    ✓ M7.19/M7.20 README action section" || { echo "    ✗ M7.19/M7.20"; FAILURES=$((FAILURES+1)); }
grep -q "federation" "$REPO_ROOT/action.yml" | head -1 > /dev/null && echo "    ✓ M7.21 marketplace description" || { echo "    ✗ M7.21"; FAILURES=$((FAILURES+1)); }
check "scripts/release-v6.sh" "M7.22 release script"
check "src/action-runtime.js" "M7.23 ncc entry point"
check ".github/workflows/build-dist.yml" "M7.23 dist build workflow"
check "solution-plays/29-mcp-gateway/examples/azure-track.yml" "M7.26 azure fixture"
check "solution-plays/29-mcp-gateway/examples/playwright-track.yml" "M7.26 playwright fixture"
check "solution-plays/29-mcp-gateway/examples/github-track.yml" "M7.26 github fixture"
check "UPGRADING.md" "M7.27 migration doc"
check "solution-plays/29-mcp-gateway/spec/mcp-scope.json" "M7.14 play scope manifest"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAILURES" -eq 0 ]; then
  echo "ALL M7 DELIVERABLES VERIFIED ✓"
  echo ""
  echo "Ready to tag. Run:"
  echo "  git tag -a federation-action-v0.7.0 -m 'Phase M7 close: GitHub Action federation surface (M7.1–M7.30)'"
  echo "  git push origin federation-action-v0.7.0"
else
  echo "$FAILURES DELIVERABLE(S) MISSING — resolve before tagging"
  exit 1
fi
