---
name: fai-cloud-design-patterns
description: |
  Apply cloud design patterns for scalability, resilience, and cost control
  with pattern-to-problem mapping. Use when selecting architecture patterns
  for distributed AI systems on Azure.
---

# Cloud Design Patterns

Select and apply cloud patterns for resilience, scalability, and cost.

## When to Use

- Designing distributed AI systems on Azure
- Solving specific reliability or scalability problems
- Reviewing architecture for pattern alignment
- Teaching team members about proven cloud patterns

---

## Pattern Selection Guide

| Problem | Pattern | Implementation |
|---------|---------|---------------|
| Cascading failures | Circuit Breaker | Wrap external calls with failure threshold |
| Transient errors | Retry with Backoff | Exponential backoff + jitter |
| Traffic spikes | Queue-Based Load Leveling | Service Bus/Storage Queue buffer |
| Read scalability | CQRS | Separate read/write models |
| Data consistency | Saga | Compensating transactions |
| Config management | External Configuration | App Configuration + Key Vault |
| Rate limiting | Throttling | APIM policies |
| Cache invalidation | Cache-Aside | Redis with TTL |

## Circuit Breaker

```python
class CircuitBreaker:
    def __init__(self, threshold=5, timeout=30):
        self.threshold = threshold
        self.timeout = timeout
        self.failures = 0
        self.state = "closed"
        self.last_fail = 0

    def call(self, fn, *args):
        if self.state == "open":
            if time.time() - self.last_fail < self.timeout:
                raise Exception("Circuit open")
            self.state = "half-open"
        try:
            result = fn(*args)
            self.failures = 0
            self.state = "closed"
            return result
        except Exception:
            self.failures += 1
            self.last_fail = time.time()
            if self.failures >= self.threshold:
                self.state = "open"
            raise
```

## Retry with Jitter

```python
import random, time

def retry_with_backoff(fn, max_retries=5, base_delay=1.0):
    for attempt in range(max_retries):
        try:
            return fn()
        except Exception:
            if attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
            time.sleep(delay)
```

## Queue-Based Load Leveling

```
[API] --enqueue--> [Service Bus Queue] --dequeue--> [Worker]
  Fast response         Buffer              Process at own pace
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Circuit stays open | Timeout too long | Reduce recovery timeout |
| Retry storms | No jitter | Add random jitter to delay |
| Queue growing unbounded | Consumer too slow | Scale consumers or add DLQ |
| Cache stampede | Many requests on miss | Use cache-aside with lock |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Start simple, add complexity when needed | Avoid over-engineering |
| Automate repetitive tasks | Consistency and speed |
| Document decisions and tradeoffs | Future reference for the team |
| Validate with real data | Don't rely on synthetic tests alone |
| Review with peers | Fresh eyes catch blind spots |
| Iterate based on feedback | First version is never perfect |

## Quality Checklist

- [ ] Requirements clearly defined
- [ ] Implementation follows project conventions
- [ ] Tests cover happy path and error paths
- [ ] Documentation updated
- [ ] Peer reviewed
- [ ] Validated in staging environment

## Related Skills

- `fai-implementation-plan-generator` — Planning and milestones
- `fai-review-and-refactor` — Code review patterns
- `fai-quality-playbook` — Engineering quality standards
