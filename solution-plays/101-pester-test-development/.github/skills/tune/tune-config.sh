#!/bin/bash
# Validate and tune configuration files for Pester Test Development
# Usage: ./tune-config.sh [--strict]

set -euo pipefail

STRICT=${1:-""}
PLAY="101-pester-test-development"
ERRORS=0

echo "═══ Tuning Pester Test Development Configuration ═══"

# Step 1: Validate JSON syntax
echo "→ Step 1: JSON Syntax Validation"
for f in config/*.json; do
  if ! python3 -c "import json; json.load(open('$f'))"; then
    echo "  ✗ INVALID: $f"
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✓ Valid: $f"
  fi
done

# Step 2: Check OpenAI config
echo "→ Step 2: OpenAI Config Check"
TEMP=$(python3 -c "import json; c=json.load(open('config/openai.json')); print(c.get('temperature', 'MISSING'))")
if [ "$TEMP" = "MISSING" ] || (( $(echo "$TEMP > 0.5" | bc -l) )); then
  echo "  ✗ WARNING: temperature=$TEMP (should be ≤0.3 for production)"
  [ "$STRICT" = "--strict" ] && ERRORS=$((ERRORS + 1))
else
  echo "  ✓ temperature=$TEMP"
fi

MAX_TOKENS=$(python3 -c "import json; c=json.load(open('config/openai.json')); print(c.get('max_tokens', 'MISSING'))")
if [ "$MAX_TOKENS" = "MISSING" ]; then
  echo "  ✗ ERROR: max_tokens not set (required for cost control)"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ max_tokens=$MAX_TOKENS"
fi

# Step 3: Check guardrails
echo "→ Step 3: Guardrails Check"
SAFETY=$(python3 -c "import json; c=json.load(open('config/guardrails.json')); print(c.get('content_safety',{}).get('enabled', False))")
if [ "$SAFETY" != "True" ]; then
  echo "  ✗ ERROR: content_safety not enabled"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ Content safety enabled"
fi

PII=$(python3 -c "import json; c=json.load(open('config/guardrails.json')); print(c.get('pii_detection',{}).get('enabled', False))")
if [ "$PII" != "True" ]; then
  echo "  ✗ ERROR: PII detection not enabled"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ PII detection enabled"
fi

# Step 4: Check Bicep
echo "→ Step 4: Bicep Validation"
if ! az bicep build --file infra/main.bicep 2>/dev/null; then
  echo "  ✗ ERROR: Bicep compilation failed"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ Bicep compiles"
fi

# Summary
echo ""
if [ $ERRORS -eq 0 ]; then
  echo "═══ ✓ Pester Test Development — ALL CHECKS PASSED ═══"
  exit 0
else
  echo "═══ ✗ Pester Test Development — $ERRORS ERRORS FOUND ═══"
  exit 1
fi
