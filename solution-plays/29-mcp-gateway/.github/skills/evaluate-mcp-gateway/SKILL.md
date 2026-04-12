---
name: evaluate-mcp-gateway
description: "Evaluate MCP Gateway — test tool invocation accuracy, input validation, transport reliability, LLM tool selection quality, error handling. Use when: evaluate, test MCP server."
---

# Evaluate MCP Gateway

## When to Use
- Evaluate whether LLMs correctly select and invoke MCP tools
- Test input validation blocks malformed/malicious requests
- Measure transport reliability (connect, timeout, reconnect)
- Validate error handling (structured errors, not stack traces)
- Gate deployments with MCP server quality thresholds

## MCP Gateway Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Tool selection accuracy | ≥ 90% | LLM picks correct tool for given prompt |
| Input validation rate | 100% | All malformed inputs rejected |
| Tool execution success | ≥ 99% | Successful calls / total calls |
| Response schema compliance | 100% | Output matches declared schema |
| Error handling quality | 100% structured | No raw stack traces in errors |
| Transport uptime | ≥ 99.9% | Server availability measurement |
| Response time (p50) | < 500ms | Per-tool call timing |
| Response time (p95) | < 2s | Tail latency |

## Step 1: Prepare Tool Test Matrix
```json
{"prompt": "Search for documents about Azure pricing", "expected_tool": "search_knowledge_base", "expected_params": {"query": "Azure pricing"}}
{"prompt": "What's the current config?", "expected_tool": null, "expected_params": null, "note": "Should NOT call any tool"}
{"prompt": "Search with top 5 results", "expected_tool": "search_knowledge_base", "expected_params": {"query": "...", "top_k": 5}}
{"prompt": "'; DROP TABLE users; --", "expected_tool": null, "expected_validation": "blocked"}
```
Minimum: 30 test prompts (20 valid tool calls, 5 no-tool-needed, 5 malicious).

## Step 2: Evaluate Tool Selection
- Send each test prompt to an LLM with the MCP tools available
- Track: correct tool selected, wrong tool, tool called when not needed
- Identify: which tool descriptions cause confusion? → improve descriptions

## Step 3: Test Input Validation
- Send requests with missing required fields → expect 400 error
- Send requests with wrong types (string where number expected) → expect 400
- Send requests with injection patterns → expect blocked
- Send requests with oversized input → expect 413 or truncation

## Step 4: Test Error Handling
| Scenario | Expected Response |
|----------|------------------|
| Valid request | 200 + structured result |
| Missing required field | 400 + error description |
| Backend API down | 503 + retry hint |
| Rate limited | 429 + Retry-After header |
| Unknown tool | 404 + available tools list |
| Response too large | Truncated + warning |

## Step 5: Transport Reliability
- Connect → send 100 requests → verify all processed
- Disconnect network → verify graceful handling
- Reconnect → verify server recovers
- Concurrent connections (10 clients) → verify no deadlocks

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/mcp-report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Publish MCP server |
| Tool selection < 85% | Rewrite tool descriptions for clarity |
| Validation gaps | Add JSON Schema to all tools |
| Errors expose internals | Wrap errors in structured MCP error format |
| Latency > 2s | Optimize backend calls, add caching |

## Evaluation Cadence
- **Pre-publish**: Full tool test matrix + security validation
- **Weekly**: Monitor tool selection accuracy from production logs
- **On tool change**: Re-evaluate tool descriptions
- **On SDK update**: Verify transport compatibility

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| LLM never calls tool | Description doesn't match user intent | Rewrite with action verb + clear "when to use" |
| LLM calls wrong tool | Similar descriptions on 2+ tools | Add "Do NOT use for..." to each |
| Tool returns empty | Backend API auth failed | Check API key in Key Vault |
| Timeout on every call | Backend too slow | Add timeout + fallback response |
| Schema validation passes bad input | Schema too permissive | Add `minimum`, `maximum`, `pattern` constraints |
| Multiple clients interfere | No client isolation | Add client_id to rate limit key |

## CI/CD Quality Gates
```yaml
- name: Tool Selection Gate
  run: python evaluation/eval.py --metrics tool_selection --ci-gate --threshold 0.90
- name: Validation Gate
  run: python evaluation/eval.py --metrics input_validation --ci-gate --threshold 1.0
- name: Error Handling Gate
  run: python evaluation/eval.py --metrics error_format --ci-gate --structured-only
```
