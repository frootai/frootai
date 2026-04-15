---
name: fai-agent-governance
description: |
  Patterns for adding governance, safety, and trust controls to AI agent systems. Use this skill when:
  - Building agents that call external tools (APIs, databases, file systems)
  - Implementing policy-based access controls for agent tool usage
  - Adding intent classification to detect dangerous prompts
  - Creating audit trails for agent actions and decisions
  - Enforcing rate limits, content filters, or tool restrictions
---

# Agent Governance Patterns

Patterns for adding safety, trust, and policy enforcement to AI agent systems.

## Overview

Governance patterns ensure AI agents operate within defined boundaries — controlling which tools they can call, what content they can process, and maintaining accountability through audit trails.

```
User Request → Intent Classification → Policy Check → Tool Execution → Audit Log
                     ↓                      ↓               ↓
              Threat Detection         Allow/Deny      Trust Update
```

## When to Use

- **Agents with tool access**: Any agent calling external tools, APIs, databases, or shell commands
- **Multi-agent systems**: Agents delegating to other agents need trust boundaries
- **Production deployments**: Compliance, audit, and safety requirements
- **Sensitive operations**: Financial transactions, data access, infrastructure changes

---

## Pattern 1: Governance Policy

Define what an agent is allowed to do as a composable, serializable policy object.

```python
from dataclasses import dataclass, field
from enum import Enum
import re

class PolicyAction(Enum):
    ALLOW = "allow"
    DENY = "deny"
    REVIEW = "review"

@dataclass
class GovernancePolicy:
    """Declarative policy controlling agent behavior."""
    name: str
    allowed_tools: list[str] = field(default_factory=list)
    blocked_tools: list[str] = field(default_factory=list)
    blocked_patterns: list[str] = field(default_factory=list)
    max_calls_per_request: int = 100
    require_approval: list[str] = field(default_factory=list)

    def check_tool(self, tool_name: str) -> PolicyAction:
        if tool_name in self.blocked_tools:
            return PolicyAction.DENY
        if tool_name in self.require_approval:
            return PolicyAction.REVIEW
        if self.allowed_tools and tool_name not in self.allowed_tools:
            return PolicyAction.DENY
        return PolicyAction.ALLOW

    def check_content(self, content: str) -> str | None:
        for pattern in self.blocked_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                return pattern
        return None
```

### Policy as YAML Configuration

Store policies as configuration, not code:

```yaml
# governance-policy.yaml
name: production-agent
allowed_tools:
  - search_documents
  - query_database
  - send_email
blocked_tools:
  - shell_exec
  - delete_record
blocked_patterns:
  - "(?i)(api[_-]?key|secret|password)\\s*[:=]"
  - "(?i)(drop|truncate|delete from)\\s+\\w+"
max_calls_per_request: 25
require_approval:
  - send_email
```

---

## Pattern 2: Tool-Level Governance Decorator

Wrap tool functions with governance enforcement:

```python
import functools, time
from collections import defaultdict

_counters: dict[str, int] = defaultdict(int)

def govern(policy: GovernancePolicy, audit=None):
    """Decorator that enforces governance policy on a tool function."""
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            tool = func.__name__
            action = policy.check_tool(tool)
            if action == PolicyAction.DENY:
                raise PermissionError(f"Policy '{policy.name}' blocks '{tool}'")
            if action == PolicyAction.REVIEW:
                raise PermissionError(f"'{tool}' requires human approval")

            _counters[policy.name] += 1
            if _counters[policy.name] > policy.max_calls_per_request:
                raise PermissionError("Rate limit exceeded")

            for arg in list(args) + list(kwargs.values()):
                if isinstance(arg, str):
                    matched = policy.check_content(arg)
                    if matched:
                        raise PermissionError(f"Blocked pattern: {matched}")

            start = time.monotonic()
            try:
                result = await func(*args, **kwargs)
                if audit is not None:
                    audit.append({"tool": tool, "action": "allowed",
                                  "ms": (time.monotonic()-start)*1000})
                return result
            except Exception as e:
                if audit is not None:
                    audit.append({"tool": tool, "action": "error", "error": str(e)})
                raise
        return wrapper
    return decorator

# Usage
policy = GovernancePolicy(
    name="search-agent",
    allowed_tools=["search", "summarize"],
    blocked_patterns=[r"(?i)password"],
    max_calls_per_request=10
)

@govern(policy)
async def search(query: str) -> str:
    return f"Results for: {query}"
```

---

## Pattern 3: Semantic Intent Classification

Detect dangerous intent before tool execution:

```python
THREAT_SIGNALS = [
    (r"(?i)send\s+(all|every)\s+\w+\s+to\s+", "data_exfiltration", 0.8),
    (r"(?i)(sudo|as\s+root|admin\s+access)", "privilege_escalation", 0.8),
    (r"(?i)(rm\s+-rf|drop\s+database)", "system_destruction", 0.95),
    (r"(?i)ignore\s+(previous|above)\s+(instructions?|rules?)", "prompt_injection", 0.9),
]

def classify_intent(content: str) -> list[dict]:
    signals = []
    for pattern, category, weight in THREAT_SIGNALS:
        if re.search(pattern, content):
            signals.append({"category": category, "confidence": weight})
    return signals

def is_safe(content: str, threshold: float = 0.7) -> bool:
    return not any(s["confidence"] >= threshold for s in classify_intent(content))
```

---

## Pattern 4: Append-Only Audit Trail

```python
import json, time

class AuditTrail:
    def __init__(self):
        self._entries = []

    def log(self, agent_id: str, tool: str, action: str, **details):
        self._entries.append({
            "timestamp": time.time(), "agent_id": agent_id,
            "tool": tool, "action": action, **details
        })

    def denied(self):
        return [e for e in self._entries if e["action"] == "denied"]

    def export_jsonl(self, path: str):
        with open(path, "w") as f:
            for entry in self._entries:
                f.write(json.dumps(entry) + "\n")
```

---

## Governance Levels

| Level | Controls | Use Case |
|-------|----------|----------|
| **Open** | Audit only | Internal dev/testing |
| **Standard** | Tool allowlist + content filters | General production |
| **Strict** | All controls + human approval | Financial, healthcare |
| **Locked** | Allowlist only, full audit | Compliance-critical |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Policy as configuration | Enables change without deploys |
| Most-restrictive-wins | Deny always overrides allow when composing policies |
| Pre-flight intent check | Classify before execution, not after |
| Append-only audit | Immutability enables compliance |
| Fail closed | If governance check errors, deny the action |
