#!/bin/bash
# Tune Config — Validate TuneKit configuration files
# Skill: tune

set -euo pipefail

CONFIG_DIR="../../config"
ERRORS=0

echo "🎛️  Validating TuneKit configuration files..."
echo ""

# Check openai.json
if [ -f "$CONFIG_DIR/openai.json" ]; then
  TEMP=$(jq -r '.temperature // 1.0' "$CONFIG_DIR/openai.json")
  if (( $(echo "$TEMP > 0.3" | bc -l) )); then
    echo "⚠️  openai.json: temperature=$TEMP (should be ≤ 0.3 for RAG)"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ openai.json: temperature=$TEMP"
  fi
else
  echo "❌ openai.json: NOT FOUND"
  ERRORS=$((ERRORS + 1))
fi

# Check search.json
if [ -f "$CONFIG_DIR/search.json" ]; then
  TOP_K=$(jq -r '.top_k // 0' "$CONFIG_DIR/search.json")
  if [ "$TOP_K" -eq 0 ]; then
    echo "⚠️  search.json: top_k not set"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ search.json: top_k=$TOP_K"
  fi
else
  echo "❌ search.json: NOT FOUND"
  ERRORS=$((ERRORS + 1))
fi

# Check guardrails.json
if [ -f "$CONFIG_DIR/guardrails.json" ]; then
  TOPICS=$(jq -r '.blocked_topics | length' "$CONFIG_DIR/guardrails.json")
  if [ "$TOPICS" -eq 0 ]; then
    echo "⚠️  guardrails.json: blocked_topics is empty"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ guardrails.json: $TOPICS blocked topics defined"
  fi
else
  echo "❌ guardrails.json: NOT FOUND"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "🔴 $ERRORS issue(s) found. Review configs before deploying."
  exit 1
else
  echo "🟢 All configs validated. Ready for production."
fi
