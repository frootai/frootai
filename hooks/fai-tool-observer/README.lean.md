# FAI Tool Observer

> Lightweight `PostToolUse` hook that logs every tool invocation (name, redacted input, truncated output, duration, success) to a JSONL trace file for observability and audit. Never blocks — always returns `{}`.

## How It Works

After any Copilot tool executes, VS Code pipes the tool name, input, output, duration, and success status as JSON on stdin. The observer redacts sensitive keys (passwords, tokens, secrets, connection strings), truncates long input/output, and appends one line of structured JSON to `logs/copilot/tool-trace.jsonl`.

This hook is **observation-only**. It does not modify, gate, or veto tool calls. Pair it with `fai-tool-guardian` (PreToolUse) for full guard + audit coverage.

## Event

| Field | Value |
| --- | --- |
| **Trigger** | `PostToolUse` |
| **Mode** | Always non-blocking (exit 0, `{}` on stdout) |
| **Input** | `{"toolName":"...","toolInput":{...},"toolOutput":"...","durationMs":N,"success":true}` on stdin |
| **Timeout** | 5 seconds |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OBSERVE_LOG_DIR` | `logs/copilot` | Directory for the trace file (created if missing) |
| `OBSERVE_LOG_FILE` | `tool-trace.jsonl` | JSONL trace filename |
| `OBSERVE_REDACT_KEYS` | `password,token,secret,apiKey,authorization,connectionString` | Comma-separated keys to replace with `[REDACTED]` (recursive, case-insensitive) |
| `OBSERVE_MAX_INPUT_BYTES` | `2048` | Max bytes of `toolInput` to record |
| `OBSERVE_MAX_OUTPUT_BYTES` | `2048` | Max bytes of `toolOutput` to record |

## Trace Record Schema

```json
{
  "ts":         "2026-05-03T12:34:56Z",
  "tool":       "run_in_terminal",
  "success":    true,
  "durationMs": 412,
  "input":      "{\"command\":\"npm test\"}",
  "output":     "All 469 tests passed..."
}
```

Failed tool calls record `success: false` with the truncated error in `output`. If the payload cannot be parsed as JSON, the record falls back to `{ts, tool: \"unknown\", raw: true, payload: \"...\"}`.

## Use Cases

- **Cost reconstruction** — replay tool sequences to estimate token spend
- **Audit / compliance** — immutable trail of every Copilot tool action (paired with log shipping)
- **Performance triage** — find slow tool calls (`durationMs` percentiles)
- **Onboarding artifact** — show a new dev exactly what a senior agent did during a session
- **Security forensics** — confirm whether a sensitive secret was visible to a tool (after redaction)

## Pairing

| Pair with | Effect |
| --- | --- |
| `fai-tool-guardian` (PreToolUse) | Guard inputs + observe outcomes — full lifecycle coverage |
| `fai-session-logger` (SessionStart/Stop) | Session-level summaries built on top of per-tool traces |
| `fai-cost-tracker` (Stop) | End-of-session cost rollup using the observed duration data |

## Log Hygiene

- Add `logs/copilot/` to `.gitignore` (the trace can contain redacted-but-still-sensitive context)
- Rotate or ship traces externally (Azure Monitor, Loki, OpenTelemetry) for long retention
- The hook is idempotent and append-only — safe to run on every tool call

## Compatibility

- Bash + jq (preferred) on Linux/macOS — falls back to raw payload if jq is absent
- PowerShell 5.1+ on Windows
- Both write the same JSONL schema — interleave safely
