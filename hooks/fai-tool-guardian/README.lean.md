# FAI Tool Guardian

> Intercepts tool calls with allowlist/blocklist enforcement, URL pattern filtering, per-tool rate limiting, an audit trail, and sandbox mode — 7 threat categories covering file destruction, force pushes, database drops, permission abuse, network exfiltration, and infrastructure teardown.

## How It Works

Before any tool executes, VS Code Copilot pipes the tool name and input as JSON on stdin. The guardian runs access list checks, rate limiting, URL filtering, and sandbox enforcement before scanning against 7 threat categories.

## Event

| Field | Value |
| --- | --- |
| **Trigger** | `PreToolUse` |
| **Mode** | `warn` (log + allow) or `block` (log + exit 1) |
| **Input** | `{"toolName":"bash","toolInput":"..."}` on stdin |
| **Timeout** | 10 seconds |

## Tool Permission Matrix

| Security Level | Allowlist | Blocklist | Rate Limit | Sandbox | Threat Scan |
|---------------|-----------|-----------|------------|---------|-------------|
| **Open** (default) | — | — | 30/5min | Off | All 7 categories |
| **Restricted** | Specified | — | 15/5min | Off | All 7 categories |
| **Locked** | Specified | Specified | 10/5min | On | All 7 categories |

## Threat Categories

| # | Category | Example Threats | Severity |
|---|----------|----------------|----------|
| 1 | **Destructive File Ops** | `rm -rf /`, `rm .env`, `rm -rf .git` | Critical |
| 2 | **Destructive Git Ops** | `git push --force main`, `git reset --hard` | Critical/High |
| 3 | **Database Destruction** | `DROP TABLE`, `TRUNCATE`, wildcard `DELETE` | Critical/High |
| 4 | **Permission Abuse** | `chmod 777` | High |
| 5 | **Network Exfiltration** | `curl\|bash`, `curl --data @` | Critical/High |
| 6 | **System Danger** | `sudo`, `npm publish` (no dry-run) | High |
| 7 | **Infrastructure Teardown** | `az group delete`, `terraform destroy`, `az keyvault purge` | Critical |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `GUARD_MODE` | `warn` | `warn` = log + allow, `block` = deny |
| `GUARD_ALLOWLIST` | `""` | Comma-separated allowed tool names (empty = all) |
| `GUARD_BLOCKLIST` | `""` | Comma-separated denied tool names |
| `GUARD_URL_DENY` | `""` | Comma-separated regex patterns for blocked URLs |
| `GUARD_RATE_LIMIT` | `30` | Max tool calls per 5-min window |
| `GUARD_SANDBOX` | `false` | Block writes outside project directory |
| `GUARD_AUDIT` | `true` | Write audit trail to JSONL |
| `GUARD_AUDIT_DIR` | `logs/copilot` | Directory for audit trail |

## Policy Configuration Examples

**Development (permissive):**
```json
{
  "env": {
    "GUARD_MODE": "warn",
    "GUARD_RATE_LIMIT": "60",
    "GUARD_AUDIT": "true"
  }
}
```

**Production (strict):**
```json
{
  "env": {
    "GUARD_MODE": "block",
    "GUARD_ALLOWLIST": "read_file,grep_search,semantic_search",
    "GUARD_BLOCKLIST": "run_in_terminal",
    "GUARD_SANDBOX": "true",
    "GUARD_RATE_LIMIT": "10"
  }
}
```

**URL restriction:**
```json
{
  "env": {
    "GUARD_URL_DENY": "pastebin\\.com,transfer\\.sh,ngrok\\.io"
  }
}
```

## Integration with MCP Servers

The guardian inspects all tool calls, including MCP server invocations. Add MCP-specific tools to the blocklist to restrict agent capabilities:

```json
{
  "env": {
    "GUARD_BLOCKLIST": "mcp_database_execute,mcp_filesystem_write"
  }
}
```

## Audit Trail

Every tool invocation is logged to `logs/copilot/tool-audit.jsonl`:

```json
{"timestamp":"2026-04-06T10:30:00Z","tool":"bash","verdict":"ALLOW"}
{"timestamp":"2026-04-06T10:31:00Z","tool":"bash","verdict":"DENY","category":"DESTRUCTIVE_GIT_OPS"}
```

Query audit data:
```bash
# Most-used tools
jq -r '.tool' logs/copilot/tool-audit.jsonl | sort | uniq -c | sort -rn

# Denied operations
grep '"DENY"' logs/copilot/tool-audit.jsonl | jq '.category' | sort | uniq -c
```

## WAF Alignment

| Pillar | How This Hook Helps |
| --- | --- |
| **Security** | Prevents destructive operations from AI-generated commands |
| **Reliability** | Stops accidental infrastructure teardown |
| **Operational Excellence** | Audit trail + rate limiting enforce safe practices |
| **Cost Optimization** | Rate limiting prevents runaway tool invocations |

## Compatible Plays

- Play 01 — Enterprise RAG (restrict data-plane tools)
- Play 03 — Multi-Agent Orchestration (sandbox untrusted agents)
- Play 17 — AI Landing Zone (policy enforcement)

## Installation

```bash
cp -r hooks/FAI-tool-guardian .github/hooks/
```
