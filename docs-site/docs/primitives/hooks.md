---
sidebar_position: 4
title: Hooks
description: Event-driven guardrails triggered by Copilot session lifecycle events — automated checks for secrets scanning, PII detection, and tool safety.
---

# Hooks

Hooks are **automated checks** that run at specific points during a Copilot session. They provide guardrails — scanning for secrets, blocking dangerous commands, detecting PII, and enforcing governance policies.

## Available Events

| Event | When It Fires | Recommended Use |
|-------|--------------|-----------------|
| `SessionStart` | Session begins | Load context, check config, verify prerequisites |
| `UserPromptSubmit` | User sends a message | PII detection, governance audit |
| `PreToolUse` | Before tool execution | Block dangerous commands ⚠️ |
| `PostToolUse` | After tool execution | Validate tool output |
| `PreCompact` | Before context compaction | Save critical context |
| `SubagentStart` | Sub-agent spawns | Track agent delegation |
| `SubagentStop` | Sub-agent completes | Validate sub-agent output |
| `Stop` | Session ends | Scan for leaked secrets, audit logging |

:::warning Never Use PreToolUse in Production
`PreToolUse` hooks spawn a process for **every tool call**, adding ~5 seconds of delay each time. Use `SessionStart` for upfront validation instead. Only use `PreToolUse` during development or security audits where the delay is acceptable.
:::

## Folder Structure

Every hook lives in its own folder under `hooks/`:

```
hooks/
  fai-secrets-scanner/
    hooks.json        # Required — event configuration
    scan-secrets.sh   # Required — the script to execute
    README.md         # Recommended — documentation
```

## hooks.json Configuration

```json title="hooks/fai-secrets-scanner/hooks.json"
{
  "version": 1,
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "bash": "./hooks/fai-secrets-scanner/scan-secrets.sh",
        "cwd": ".",
        "env": {
          "HOOK_MODE": "warn"
        },
        "timeoutSec": 10
      }
    ]
  }
}
```

### Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `version` | ✅ | Always `1` |
| `hooks.<event>` | ✅ | Array of commands for this event |
| `type` | ✅ | Always `"command"` |
| `bash` | ✅ | Path to the script |
| `cwd` | ✅ | Working directory (usually `"."`) |
| `env` | No | Environment variables passed to script |
| `timeoutSec` | ✅ | Max seconds before kill (5–60) |

## Writing Hook Scripts

Hook scripts receive input on stdin and communicate results via exit codes:

- **Exit 0** — check passed, allow action to proceed
- **Exit 1** — check failed, block the action

```bash title="hooks/fai-secrets-scanner/scan-secrets.sh"
#!/usr/bin/env bash
set -euo pipefail

MODE="${HOOK_MODE:-warn}"
FINDINGS=0

# Scan for common secret patterns
PATTERNS=(
  "AKIA[0-9A-Z]{16}"          # AWS access key
  "sk-[a-zA-Z0-9]{48}"        # OpenAI API key
  "ghp_[a-zA-Z0-9]{36}"       # GitHub PAT
  "password\s*=\s*['\"][^'\"]+['\"]"  # Hardcoded passwords
)

for pattern in "${PATTERNS[@]}"; do
  if grep -rqE "$pattern" --include="*.py" --include="*.js" --include="*.ts" .; then
    echo "🚨 Secret pattern detected: $pattern"
    FINDINGS=$((FINDINGS + 1))
  fi
done

if [ "$FINDINGS" -gt 0 ]; then
  if [ "$MODE" = "block" ]; then
    echo "❌ Blocked: $FINDINGS secret(s) found"
    exit 1
  fi
  echo "⚠️  Warning: $FINDINGS potential secret(s) found"
fi

echo "✅ Secrets scan passed"
exit 0
```

## Existing FrootAI Hooks

| Hook | Event | Purpose |
|------|-------|---------|
| `fai-secrets-scanner` | Stop | 25+ credential patterns |
| `fai-tool-guardian` | PreToolUse | Block destructive commands |
| `fai-governance-audit` | UserPromptSubmit | Data governance |
| `fai-license-checker` | SessionStart | OSS license compliance |
| `fai-waf-compliance` | Stop | WAF pillar validation |
| `fai-session-logger` | SessionStart + Stop | Audit trail |
| `fai-cost-tracker` | PreToolUse | Token/cost monitoring |
| `fai-pii-redactor` | UserPromptSubmit | PII removal |
| `fai-token-budget-enforcer` | PreToolUse | Token limit enforcement |
| `fai-output-validator` | Stop | Output quality checking |

:::tip Recommended: SessionStart
`SessionStart` is the safest and fastest event. Use it for prerequisite checks, configuration loading, and initial security scans. It fires only once per session with no performance penalty.
:::

## Wiring Hooks into Plays

Reference hooks in `fai-manifest.json`:

```json
{
  "primitives": {
    "hooks": [
      "../../hooks/fai-secrets-scanner/",
      "../../hooks/fai-tool-guardian/"
    ]
  }
}
```

Or in a plugin's `plugin.json`:

```json
{
  "hooks": ["../../hooks/fai-secrets-scanner/"]
}
```

## Best Practices

1. **Always set a timeout** — hooks should never hang the session (10s max for PreToolUse)
2. **Support both warn and block modes** — let users choose via `HOOK_MODE` env var
3. **Read from stdin** — that's how tool call data arrives for PreToolUse hooks
4. **Exit 0 for pass, exit 1 for block** — standard convention
5. **Log clearly** — use emoji prefixes (🚨 ⚠️ ✅) for quick scanning
6. **Prefer SessionStart** — run expensive checks once, not per tool call
7. **Test with edge cases** — empty input, malformed JSON, unicode

## See Also

- [Create a Hook Guide](/docs/guides/create-hook) — step-by-step tutorial
- [Plugins](/docs/primitives/plugins) — bundle hooks into distributable packages
- [Security WAF](/docs/concepts/well-architected) — security pillar guidelines
