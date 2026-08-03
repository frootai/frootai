---
mode: "agent"
agent: "tuner"
description: "Evaluate Play 08 contracts and measured platform behavior"
tools: ["terminal", "file", "read", "search"]
---

# Evaluate Play 08

Run `python evaluation/eval.py --test-set evaluation/test-set.jsonl` to validate
the offline ownership contract. This command does not evaluate a running bot.

For an authorized test environment, define versioned topic, action, fallback,
escalation, safety, and approval cases. Record observed results without floors,
simulated values, or promotion claims. Human review remains required.