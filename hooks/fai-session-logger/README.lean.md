# FAI Session Logger

> Structured JSON Lines audit trail of Copilot session activity with log rotation, compression, rate limiting, and error recovery — without ever logging prompt content.

## Architecture

```
sessionStart / sessionEnd / userPromptSubmitted
        │
        ▼
┌──────────────────┐
│  Rate Limiter    │──▶ skip (if too frequent)
└──────┬───────────┘
       ▼
┌──────────────────┐
│  Log Rotation    │──▶ rotate → compress → prune
└──────┬───────────┘
       ▼
┌──────────────────┐
│  Metadata        │──▶ timestamp, branch, user hash, duration
│  Collector       │
└──────┬───────────┘
       ▼
   session.jsonl
```

## Events

| Field | Value |
| --- | --- |
| **Triggers** | `SessionStart`, `Stop`, `UserPromptSubmit` |
| **Log file** | `logs/copilot/session.jsonl` |
| **Format** | JSON Lines (one object per line) |
| **Timeout** | 5 seconds per event |

## Log Entry Format

```json
{
  "timestamp": "2026-04-06T10:30:00Z",
  "event": "sessionEnd",
  "session_id": "abc123",
  "cwd": "/home/dev/project",
  "git_branch": "feature/auth",
  "user_hash": "a1b2c3d4e5f6",
  "duration_sec": 342,
  "level": "info"
}
```

| Field | Description |
| --- | --- |
| `timestamp` | ISO 8601 UTC |
| `event` | `SessionStart`, `Stop`, or `UserPromptSubmit` |
| `session_id` | Copilot session identifier (or PID fallback) |
| `cwd` | Working directory (JSON-escaped) |
| `git_branch` | Current branch name |
| `user_hash` | First 12 chars of SHA-256 of username (anonymized) |
| `duration_sec` | Session length in seconds (on `Stop` only) |
| `level` | Always `info` |

## Configuration

Set via environment variables in `hooks.json`:

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_EVENT` | — | Event type (set automatically by hooks.json) |
| `LOG_DIR` | `logs/copilot` | Directory for log files |
| `LOG_MAX_SIZE_MB` | `10` | Max log file size before rotation |
| `LOG_KEEP_ROTATED` | `5` | Number of rotated files to keep |
| `LOG_COMPRESS` | `true` | Gzip rotated logs to save disk space |
| `LOG_RATE_LIMIT_SEC` | `1` | Min seconds between `UserPromptSubmit` entries |

## Log Rotation

When `session.jsonl` exceeds `LOG_MAX_SIZE_MB`:
1. Existing rotated files shift (`session.jsonl.2.gz` → `.3.gz`)
2. Current log is compressed to `session.jsonl.1.gz`
3. Active log is truncated to start fresh
4. Files beyond `LOG_KEEP_ROTATED` are deleted

## Log Analysis Examples

```bash
# Count sessions today
grep "$(date -u +%Y-%m-%d)" logs/copilot/session.jsonl | grep sessionStart | wc -l

# Average session duration (requires jq)
grep sessionEnd logs/copilot/session.jsonl | jq -s '[.[].duration_sec // 0] | add / length'

# Most active branches
grep sessionStart logs/copilot/session.jsonl | jq -r '.git_branch' | sort | uniq -c | sort -rn
```

## Integration with Azure Monitor

Forward session logs to a Log Analytics workspace:

```bash
# Using Azure CLI to upload JSONL
az monitor log-analytics workspace upload \
  --workspace-name my-workspace \
  --table CopilotSessions_CL \
  --source logs/copilot/session.jsonl
```

## Privacy & Security

This hook **never** logs: prompt content, code snippets, model responses, file contents, or PII. Only structural metadata is recorded. User identity is anonymized via SHA-256 hash truncated to 12 characters.

## WAF Alignment

| Pillar | How This Hook Helps |
| --- | --- |
| **Operational Excellence** | Audit trail for compliance, diagnostics, and session analytics |
| **Security** | Activity monitoring without sensitive data exposure |
| **Responsible AI** | Privacy-by-design — no prompt content captured |
| **Cost Optimization** | Session duration data enables usage pattern analysis |

## Compatible Plays

- Play 01 — Enterprise RAG (session audit for compliance)
- Play 03 — Multi-Agent Orchestration (cross-session tracking)
- Play 17 — AI Landing Zone (governance logging)

## Installation

Copy this folder to `.github/hooks/` or reference from a FAI plugin:

```bash
cp -r hooks/FAI-session-logger .github/hooks/
```
