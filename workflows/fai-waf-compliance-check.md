---
name: FAI-waf-compliance-check
description: "Per-PR WAF pillar validation — scans changed files for security anti-patterns, reliability gaps, cost waste, operational issues, performance bottlenecks, and responsible AI violations. Produces per-pillar scores (0-100) and compliance matrix."
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  contents: read
  pull-requests: write
engine: copilot
tools:
  github:
    toolsets: [repos, pull_requests]
  bash: true
safe-outputs:
  add-comment:
    max: 1
timeout-minutes: 15
---

## Step 1: Gather changed files

```bash
ALL_CHANGED=$(git diff --name-only origin/main...HEAD)
SCANNABLE=$(echo "$ALL_CHANGED" | grep -E '\.(py|ts|js|jsx|tsx|bicep|json|yaml|yml|sh)$')
SCAN_COUNT=$(echo "$SCANNABLE" | grep -c '.' || echo 0)
echo "Scannable: $SCAN_COUNT files"
```

If zero scannable files, post "No scannable files — WAF check skipped." and exit.

Filter out files that exist only in the diff (deleted files):

```bash
LIVE_FILES=""
for F in $SCANNABLE; do
  [ -f "$F" ] && LIVE_FILES="$LIVE_FILES $F"
done
SCANNABLE="$LIVE_FILES"
```

## Step 2: Initialize scoring

Each pillar starts at 100 and is reduced by findings.

| Severity | Deduction | Icon |
|----------|-----------|------|
| Critical | -15 | ❌ |
| Warning | -5 | ⚠️ |
| Info | -1 | ℹ️ |

Minimum score per pillar is 0.

## Step 3: Scan — Security pillar

**Critical (❌):** hardcoded secrets, connection strings, missing `@secure()` on Bicep sensitive params, `chmod 777`.

```bash
for FILE in $SCANNABLE; do
  [ ! -f "$FILE" ] && continue
  grep -nP '(sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36})' "$FILE" 2>/dev/null \
    && echo "SEC_CRIT|$FILE|Potential API key"
  grep -n 'DefaultEndpointsProtocol=' "$FILE" 2>/dev/null \
    && echo "SEC_CRIT|$FILE|Connection string in source"
  if [[ "$FILE" == *.bicep ]]; then
    grep -n 'param.*\(password\|secret\|key\)' "$FILE" 2>/dev/null | while read -r LINE; do
      LINENUM=$(echo "$LINE" | cut -d: -f1); PREV=$((LINENUM - 1))
      sed -n "${PREV}p" "$FILE" | grep -q '@secure()' || echo "SEC_CRIT|$FILE:$LINENUM|Missing @secure()"
    done
  fi
  grep -n 'chmod 777' "$FILE" 2>/dev/null && echo "SEC_CRIT|$FILE|Overly permissive chmod"
done
```

**Warning (⚠️):** `eval()`/`exec()` usage, SQL concatenation, missing input validation, API key auth instead of `DefaultAzureCredential`.

```bash
for FILE in $SCANNABLE; do
  [ ! -f "$FILE" ] && continue
  [[ "$FILE" == *.py ]] && grep -n '\beval\b\|\bexec\b' "$FILE" 2>/dev/null \
    && echo "SEC_WARN|$FILE|eval/exec usage"
  grep -nP '(SELECT|INSERT|UPDATE).*\+.*\$' "$FILE" 2>/dev/null \
    && echo "SEC_WARN|$FILE|SQL concatenation"
  grep -n 'AzureKeyCredential\|api_key=' "$FILE" 2>/dev/null | head -1 \
    && ! grep -q 'DefaultAzureCredential' "$FILE" 2>/dev/null \
    && echo "SEC_WARN|$FILE|Prefer managed identity"
done
```

## Step 4: Scan — Reliability pillar

**Critical:** bare `except:`/empty `catch{}`, HTTP calls without timeout.

```bash
for FILE in $SCANNABLE; do
  [ ! -f "$FILE" ] && continue
  [[ "$FILE" == *.py ]] && grep -nP '^\s*except\s*:' "$FILE" 2>/dev/null \
    && echo "REL_CRIT|$FILE|Bare except clause"
  [[ "$FILE" == *.ts || "$FILE" == *.js ]] && grep -nP 'catch\s*\(\s*\)\s*\{?\s*\}' "$FILE" 2>/dev/null \
    && echo "REL_CRIT|$FILE|Empty catch block"
  grep -nP 'requests\.(get|post)|fetch\(|axios\.' "$FILE" 2>/dev/null | head -1 > /dev/null \
    && ! grep -q 'timeout' "$FILE" 2>/dev/null \
    && echo "REL_CRIT|$FILE|HTTP call without timeout"
done
```

**Warning:** missing retry/backoff on Azure SDK calls, no health check endpoint, no circuit breaker, no graceful shutdown handler.

```bash
for FILE in $SCANNABLE; do
  [ ! -f "$FILE" ] && continue
  grep -q 'azure\.' "$FILE" 2>/dev/null \
    && ! grep -qE '(retry|backoff|tenacity|RetryPolicy)' "$FILE" 2>/dev/null \
    && echo "REL_WARN|$FILE|No retry strategy"
  [[ "$FILE" == *.py ]] && grep -q '@app' "$FILE" 2>/dev/null \
    && ! grep -q '/health\|/readyz' "$FILE" 2>/dev/null \
    && echo "REL_WARN|$FILE|No health endpoint"
done
```

## Step 5: Scan — Cost Optimization pillar

**Warning:** missing `max_tokens` on LLM calls, GPT-4o used where mini suffices, missing SKU in Bicep, no cost tags, no token budget enforcement.

```bash
for FILE in $SCANNABLE; do
  [ ! -f "$FILE" ] && continue
  grep -nP '(openai|AzureOpenAI|ChatCompletion)' "$FILE" 2>/dev/null | head -1 > /dev/null \
    && ! grep -q 'max_tokens\|max_completion_tokens' "$FILE" 2>/dev/null \
    && echo "COST_WARN|$FILE|LLM call without max_tokens"
  grep -n 'gpt-4o"' "$FILE" 2>/dev/null | head -1 > /dev/null \
    && grep -qE '(classify|extract|summarize)' "$FILE" 2>/dev/null \
    && echo "COST_WARN|$FILE|gpt-4o for simple task — consider mini"
  [[ "$FILE" == *.bicep ]] && grep -q 'Microsoft\.' "$FILE" 2>/dev/null \
    && ! grep -q 'sku\|tier' "$FILE" 2>/dev/null \
    && echo "COST_WARN|$FILE|No SKU specified"
done
```

## Step 6: Scan — Operational Excellence pillar

**Warning:** bare `print()`/`console.log` without structured logging, missing diagnostic settings on Azure resources, workflows without `timeout-minutes`, undocumented env vars.

```bash
for FILE in $SCANNABLE; do
  [ ! -f "$FILE" ] && continue
  [[ "$FILE" == *.py ]] && grep -nP '^\s*print\(' "$FILE" 2>/dev/null | head -1 > /dev/null \
    && ! grep -q 'logging\|structlog\|loguru' "$FILE" 2>/dev/null \
    && echo "OPS_WARN|$FILE|print() without structured logging"
  [[ "$FILE" == *.ts || "$FILE" == *.js ]] && grep -n 'console\.log' "$FILE" 2>/dev/null | head -1 > /dev/null \
    && ! grep -q 'winston\|pino\|logger' "$FILE" 2>/dev/null \
    && echo "OPS_WARN|$FILE|console.log without logger"
  [[ "$FILE" == *.bicep ]] && grep -q 'Microsoft\.' "$FILE" 2>/dev/null \
    && ! grep -q 'diagnosticSettings' "$FILE" 2>/dev/null \
    && echo "OPS_WARN|$FILE|No diagnostic settings"
  [[ "$FILE" == *.yaml || "$FILE" == *.yml ]] && grep -q 'jobs:' "$FILE" 2>/dev/null \
    && ! grep -q 'timeout-minutes' "$FILE" 2>/dev/null \
    && echo "OPS_WARN|$FILE|No timeout-minutes"
done
```

## Step 7: Scan — Performance Efficiency pillar

**Warning:** sync calls in async codebase, queries without pagination, no caching layer. **Info:** LLM responses not streamed.

```bash
for FILE in $SCANNABLE; do
  [ ! -f "$FILE" ] && continue
  [[ "$FILE" == *.py ]] && grep -nP 'requests\.(get|post)' "$FILE" 2>/dev/null | head -1 > /dev/null \
    && grep -q 'async\|asyncio' "$FILE" 2>/dev/null \
    && echo "PERF_WARN|$FILE|Sync requests in async codebase"
  grep -nP '(find\(\)|select\s*\*|\.list\()' "$FILE" 2>/dev/null | head -1 > /dev/null \
    && ! grep -q 'limit\|offset\|page\|cursor' "$FILE" 2>/dev/null \
    && echo "PERF_WARN|$FILE|Query without pagination"
  grep -q 'ChatCompletion' "$FILE" 2>/dev/null \
    && ! grep -q 'stream.*True\|stream.*true' "$FILE" 2>/dev/null \
    && echo "PERF_INFO|$FILE|LLM not streaming"
done
```

## Step 8: Scan — Responsible AI pillar

**Critical:** missing content safety filter on AI outputs, PII in log statements.

```bash
for FILE in $SCANNABLE; do
  [ ! -f "$FILE" ] && continue
  grep -nP '(ChatCompletion|generate|complete)' "$FILE" 2>/dev/null | head -1 > /dev/null \
    && ! grep -qE '(content.?safety|ContentSafety|moderate|filter)' "$FILE" 2>/dev/null \
    && echo "RAI_CRIT|$FILE|AI output without content safety"
  grep -nP '(log|print|console).*\b(email|ssn|phone|credit.?card)\b' "$FILE" 2>/dev/null \
    && echo "RAI_CRIT|$FILE|Potential PII in logs"
done
```

**Warning:** no system message in LLM conversations, no groundedness check, no human-in-the-loop for critical actions.

```bash
for FILE in $SCANNABLE; do
  [ ! -f "$FILE" ] && continue
  grep -q 'role.*user' "$FILE" 2>/dev/null \
    && ! grep -q 'role.*system\|SystemMessage' "$FILE" 2>/dev/null \
    && echo "RAI_WARN|$FILE|No system message"
  grep -q 'ChatCompletion' "$FILE" 2>/dev/null \
    && ! grep -qE '(groundedness|grounded|citation)' "$FILE" 2>/dev/null \
    && echo "RAI_WARN|$FILE|No groundedness check"
done
```

## Step 9: Calculate pillar scores

```bash
for PILLAR in SEC REL COST OPS PERF RAI; do
  CRIT=$(grep -c "^${PILLAR}_CRIT" /tmp/findings.txt 2>/dev/null || echo 0)
  WARN=$(grep -c "^${PILLAR}_WARN" /tmp/findings.txt 2>/dev/null || echo 0)
  INFO=$(grep -c "^${PILLAR}_INFO" /tmp/findings.txt 2>/dev/null || echo 0)
  SCORE=$((100 - CRIT * 15 - WARN * 5 - INFO * 1))
  [ "$SCORE" -lt 0 ] && SCORE=0
  echo "${PILLAR}_SCORE=$SCORE"
done
```

| Range | Grade | Status |
|-------|-------|--------|
| 90-100 | A | ✅ Excellent |
| 75-89 | B | ✅ Good |
| 60-74 | C | ⚠️ Needs improvement |
| 40-59 | D | ⚠️ Below standard |
| 0-39 | F | ❌ Critical |

## Step 10: Generate compliance comment

```markdown
## 🏛️ WAF Compliance Check — X files scanned

### Pillar Scores
| Pillar | Score | Grade | ❌ | ⚠️ | ℹ️ |
|--------|-------|-------|----|----|----|
| 🔒 Security | 85 | B | 1 | 0 | 0 |
| 🛡️ Reliability | 90 | A | 0 | 2 | 0 |
| 💰 Cost Optimization | 95 | A | 0 | 1 | 1 |
| ⚙️ Operational Excellence | 80 | B | 0 | 4 | 2 |
| ⚡ Performance | 95 | A | 0 | 1 | 1 |
| 🤖 Responsible AI | 70 | C | 2 | 1 | 0 |

**Overall: 86/100 (B)**

### ❌ Critical Findings
| # | Pillar | File | Line | Finding | Fix |
|---|--------|------|------|---------|-----|
| 1 | Security | `src/api.py` | 42 | Hardcoded key | Use Key Vault |
| 2 | Resp. AI | `src/chat.py` | 18 | No safety filter | Add ContentSafety |

### ⚠️ Warnings
| # | Pillar | File | Finding | Suggestion |
|---|--------|------|---------|-----------|
| 1 | Reliability | `client.py` | No retry | Add tenacity |
| 2 | Cost | `main.bicep` | No SKU | Add sku param |

### Compliance: X/6 pillars fully compliant (score ≥90)
_Automated by FAI WAF Compliance Workflow_
```

## Error handling

- `git diff` failure: fall back to `gh pr diff --name-only`
- Deleted files: skip scanning, note deletion
- Binary files excluded by extension filter
- Markdown excluded from code-specific security scans (Steps 3-8)
- Cap findings at 50 per pillar for readability
- Always post comment even with partial scan results
- If a file cannot be read (permissions), skip with ℹ️ note
- If no pillar has findings, post a congratulatory "All clear ✅" comment

## Configuration

Custom compliance rules can be defined per-repository in `.github/waf-config.json`:

```json
{
  "thresholds": {
    "security": 90,
    "reliability": 80,
    "cost-optimization": 70,
    "operational-excellence": 70,
    "performance-efficiency": 70,
    "responsible-ai": 85
  },
  "ignore": {
    "files": ["scripts/dev-only.py"],
    "rules": ["PERF_INFO"]
  }
}
```

If this file exists, use custom thresholds for the pass/fail grade and skip ignored files and rules.