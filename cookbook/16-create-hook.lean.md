# Recipe 16: Create a Custom Hook

> Build a security hook with `hooks.json` config and a bash/node script triggered at session lifecycle events.

## What Are Hooks?

Hooks are automated checks that run at specific Copilot session points:

| Event | When It Fires | Use Case |
|-------|---------------|----------|
| `sessionStart` | Session begins | Load context, check config |
| `sessionEnd` | Session ends | Scan for leaked secrets |
| `userPromptSubmitted` | User sends a message | Governance audit, PII detection |
| `preToolUse` | Before tool execution | Block dangerous commands |

## Hook Folder Structure

```
hooks/
  frootai-my-hook/
    hooks.json        # Required — event config
    my-hook.sh        # Required — the script to run
    README.md         # Recommended — documentation
```

## Steps

### 1. Create the hook folder

```bash
HOOK_NAME="frootai-my-hook"
mkdir -p hooks/${HOOK_NAME}
```

### 2. Create hooks.json

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "type": "command",
        "bash": "./hooks/frootai-my-hook/my-hook.sh",
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

**Configuration fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `version` | ✅ | Always `1` |
| `hooks.<event>` | ✅ | Array of commands for this event |
| `type` | ✅ | Always `"command"` |
| `bash` | ✅ | Path to the script |
| `cwd` | ✅ | Working directory (usually `"."`) |
| `env` | Optional | Environment variables passed to script |
| `timeoutSec` | ✅ | Max seconds before kill (5-60) |

### 3. Write the hook script

```bash
#!/usr/bin/env bash
# hooks/frootai-my-hook/my-hook.sh
# Triggered on: preToolUse
# Input: Tool call JSON on stdin
# Output: Exit 0 = allow, Exit 1 = block

set -euo pipefail

MODE="${HOOK_MODE:-warn}"
FINDINGS=0

# Read tool call from stdin
TOOL_INPUT=$(cat)
TOOL_NAME=$(echo "$TOOL_INPUT" | grep -o '"toolName":"[^"]*"' | cut -d'"' -f4)
TOOL_ARGS=$(echo "$TOOL_INPUT" | grep -o '"toolInput":"[^"]*"' | cut -d'"' -f4)

# Example: Block specific patterns
BLOCKED_PATTERNS=(
  "rm -rf /"
  "DROP DATABASE"
  "format C:"
  ":(){ :|:& };:"    # Fork bomb
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$TOOL_ARGS" | grep -qi "$pattern"; then
    echo "🚨 BLOCKED: Dangerous pattern detected: $pattern"
    echo "   Tool: $TOOL_NAME"
    echo "   Mode: $MODE"
    FINDINGS=$((FINDINGS + 1))
  fi
done

if [ "$FINDINGS" -gt 0 ]; then
  if [ "$MODE" = "block" ]; then
    echo "❌ Hook blocked $FINDINGS dangerous operation(s)"
    exit 1
  else
    echo "⚠️  Hook found $FINDINGS warning(s) (warn mode — not blocking)"
    exit 0
  fi
fi

echo "✅ Hook passed — no issues found"
exit 0
```

Make it executable:
```bash
chmod +x hooks/${HOOK_NAME}/my-hook.sh
```

### 4. Create README.md

```markdown
# frootai-my-hook

> [One-line description of what this hook does]

## Event
- **Trigger:** `preToolUse`
- **Mode:** `warn` (default) or `block`
- **Timeout:** 10 seconds

## What It Checks
1. [Check 1]
2. [Check 2]
3. [Check 3]

## Configuration

Set `HOOK_MODE` in `hooks.json`:
- `warn` — log findings, allow action to proceed
- `block` — log findings, exit 1 to prevent action

## Testing

\`\`\`bash
# Test with safe input
echo '{"toolName":"bash","toolInput":"ls -la"}' | bash hooks/frootai-my-hook/my-hook.sh

# Test with dangerous input (should block/warn)
echo '{"toolName":"bash","toolInput":"rm -rf /"}' | bash hooks/frootai-my-hook/my-hook.sh
\`\`\`
```

### 5. Wire into a manifest

Add the hook to `fai-manifest.json`:

```json
{
  "primitives": {
    "hooks": [
      "../../hooks/frootai-my-hook/"
    ]
  }
}
```

### 6. Wire into a plugin

Add it to `plugin.json`:

```json
{
  "hooks": ["../../hooks/frootai-my-hook/"]
}
```

### 7. Validate

```bash
# Validate hook structure
npm run validate:primitives

# Test the script
echo '{"toolName":"test","toolInput":"hello"}' | bash hooks/${HOOK_NAME}/my-hook.sh
```

## Available Events Reference

### sessionStart
- Fires once when a Copilot session begins
- Use for: loading config, checking prerequisites, setting up context
- Input: empty stdin
- Timeout: 5 seconds recommended

### sessionEnd
- Fires once when a session ends
- Use for: scanning output, secrets detection, audit logging
- Input: session metadata on stdin
- Timeout: 30 seconds (may need to scan many files)

### userPromptSubmitted
- Fires every time the user sends a message
- Use for: PII detection, governance, prompt injection detection
- Input: user prompt on stdin
- Timeout: 10 seconds

### preToolUse
- Fires before any tool is executed
- Use for: blocking dangerous commands, tool allowlisting
- Input: `{"toolName": "...", "toolInput": "..."}` on stdin
- Timeout: 10 seconds
- Exit 1 = block the tool call

## Existing FrootAI Hooks

| Hook | Event | Purpose |
|------|-------|---------|
| `frootai-secrets-scanner` | sessionEnd | 25+ credential patterns |
| `frootai-tool-guardian` | preToolUse | Block destructive commands |
| `frootai-governance-audit` | userPromptSubmitted | Data governance |
| `frootai-license-checker` | sessionStart | OSS license compliance |
| `frootai-waf-compliance` | sessionEnd | WAF pillar validation |
| `frootai-session-logger` | sessionStart + End | Audit trail |
| `frootai-cost-tracker` | preToolUse | Token/cost monitoring |
| `frootai-pii-redactor` | userPromptSubmitted | PII removal |
| `frootai-token-budget-enforcer` | preToolUse | Token limit enforcement |
| `frootai-output-validator` | sessionEnd | Output quality checking |

## Best Practices

1. **Always set a timeout** — hooks shouldn't hang the session
2. **Support both warn and block modes** — let users choose
3. **Read from stdin** — that's how tool call data arrives
4. **Exit 0 for pass, exit 1 for block** — standard convention
5. **Log clearly** — use emoji prefixes (🚨 ⚠️ ✅) for quick scanning
6. **Keep scripts fast** — 10 seconds max for preToolUse hooks
7. **Test with edge cases** — empty input, malformed JSON, unicode
