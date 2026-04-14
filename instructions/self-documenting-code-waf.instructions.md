---
description: "Self-documenting code standards — comment WHY not WHAT, meaningful names, and code as documentation."
applyTo: "**"
waf:
  - "operational-excellence"
---

# Self-Documenting Code — FAI Standards

## Meaningful Names

Names are the primary documentation. A reader should understand purpose without scrolling to the definition.

```typescript
// ❌ Cryptic
const d = new Date();
const r = users.filter(u => u.a > 30 && u.s === "active");
function proc(d: any[]) { /* ... */ }

// ✅ Intent-revealing
const accountCreatedAt = new Date();
const activeAdultUsers = users.filter(u => u.age > 30 && u.status === "active");
function processRefundRequests(pendingRefunds: RefundRequest[]) { /* ... */ }
```

```python
# ❌ Abbreviations hide meaning
def calc_ttl_amt(itms):
    return sum(i.p * i.q for i in itms)

# ✅ Full words — no mental decoding
def calculate_total_amount(line_items: list[LineItem]) -> Decimal:
    return sum(item.price * item.quantity for item in line_items)
```

**Rules:** No single-letter variables outside loops/lambdas. No abbreviations (`usr`, `mgr`, `ctx`) unless universally understood (`id`, `url`, `http`). Class names = nouns (`InvoiceProcessor`). Functions = verbs (`validate_payment`, `fetchUserProfile`).

## Boolean Naming

Booleans must read as true/false questions using `is`, `has`, `can`, `should`, or `was` prefixes.

```typescript
// ❌ Ambiguous — is this a noun or adjective?
const enabled = true;
const admin = user.role === "admin";

// ✅ Reads as a question
const isEnabled = true;
const isAdmin = user.role === "admin";
const hasExpired = token.expiresAt < Date.now();
const canRetry = attemptCount < MAX_RETRIES;
const shouldThrottle = requestsPerMinute > RATE_LIMIT;
```

## Named Constants Over Magic Numbers

Every literal with domain meaning must be a named constant.

```python
# ❌ What do these numbers mean?
if len(chunks) > 512:
    chunks = chunks[:512]
if score < 0.7:
    return None

# ✅ Constants document the constraint
MAX_CHUNKS_PER_INDEX = 512
MIN_RELEVANCE_SCORE = 0.7

if len(chunks) > MAX_CHUNKS_PER_INDEX:
    chunks = chunks[:MAX_CHUNKS_PER_INDEX]
if score < MIN_RELEVANCE_SCORE:
    return None
```

## Function Size and Single Responsibility

Functions ≤25 lines. Each function does exactly one thing at one level of abstraction.

```typescript
// ❌ God function — fetches, validates, transforms, saves
async function handleOrder(req: Request) {
  // ... 80 lines doing everything
}

// ✅ Decomposed — each function has one job
async function handleOrder(req: Request): Promise<Response> {
  const order = parseOrderRequest(req);
  validateOrderRules(order);
  const enrichedOrder = await enrichWithInventory(order);
  const confirmation = await saveOrder(enrichedOrder);
  return formatOrderResponse(confirmation);
}
```

## Early Returns and Guard Clauses

Eliminate nesting by handling edge cases first. Return/throw at the top, keep the happy path unindented.

```python
# ❌ Deeply nested
def process_document(doc):
    if doc is not None:
        if doc.status == "ready":
            if len(doc.pages) > 0:
                return extract_text(doc)
    return None

# ✅ Guard clauses — flat and scannable
def process_document(doc: Document | None) -> str | None:
    if doc is None:
        return None
    if doc.status != "ready":
        return None
    if not doc.pages:
        return None
    return extract_text(doc)
```

## Expressive Types Over Primitive Strings

Use discriminated unions (TypeScript) and enums/Literal types (Python) to make illegal states unrepresentable.

```typescript
// ❌ Stringly-typed — any typo compiles fine
function setStatus(status: string) { /* "actve" won't be caught */ }

// ✅ Discriminated union — compiler enforces valid states
type DeploymentStatus =
  | { kind: "pending"; scheduledAt: Date }
  | { kind: "running"; startedAt: Date; progress: number }
  | { kind: "failed"; error: string; failedAt: Date }
  | { kind: "succeeded"; completedAt: Date };

function renderStatus(status: DeploymentStatus): string {
  switch (status.kind) {
    case "pending": return `Scheduled for ${status.scheduledAt}`;
    case "running": return `${status.progress}% complete`;
    case "failed": return `Error: ${status.error}`;
    case "succeeded": return `Done at ${status.completedAt}`;
  }
}
```

```python
from typing import Literal

ModelTier = Literal["gpt-4o", "gpt-4o-mini", "o3-mini"]

def estimate_cost(model: ModelTier, tokens: int) -> float:
    rates: dict[ModelTier, float] = {"gpt-4o": 0.005, "gpt-4o-mini": 0.00015, "o3-mini": 0.0011}
    return rates[model] * (tokens / 1000)
```

## Parameter Objects for 3+ Arguments

When a function takes 3+ parameters, group them into a typed object. Prevents positional bugs and is self-documenting at call sites.

```typescript
// ❌ Positional args — easy to swap query and filter
searchDocuments("contracts", "active", 50, 0, true, "relevance");

// ✅ Named fields — intention is clear
searchDocuments({
  index: "contracts",
  filter: "active",
  topK: 50,
  offset: 0,
  includeVectors: true,
  rankBy: "relevance",
});
```

## When Comments ARE Needed

Comment **why**, never **what**. The code already says what — comments explain intent, constraints, and non-obvious decisions.

```typescript
// ❌ Redundant — repeats the code
// Increment retry count by 1
retryCount += 1;

// ✅ Explains WHY — a decision that isn't obvious from the code
// Azure OpenAI returns 429 with Retry-After header but the value
// is unreliable for batch endpoints. Use exponential backoff instead.
const delay = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
```

Valid comment scenarios: regulatory/compliance reasons, performance trade-offs with benchmarks, workarounds for external bugs (link the issue), algorithm citations (paper/RFC references).

## Extract vs. Inline

Extract a function when: logic is reused, it needs a name to clarify intent, or the parent exceeds 25 lines. Keep it inline when: the operation is trivial and only used once, and the surrounding context already explains it.

## Code as Documentation — Tests as Specs

Tests document behavior better than prose. Name tests as specifications.

```python
# ❌ Vague test name
def test_search():
    assert search("hello") is not None

# ✅ Test name IS the specification
def test_search_returns_top_k_results_ranked_by_relevance():
    results = search(query="quarterly earnings", top_k=5)
    assert len(results) == 5
    assert results[0].score >= results[1].score

def test_search_returns_empty_list_when_no_documents_match():
    results = search(query="xyzzy_nonexistent", top_k=10)
    assert results == []
```

## README-Driven Development

Write the README before writing code. If you can't explain the API, the CLI flags, or the config format in a README, the design is too complex. The README is a usability test for your interface.

## Anti-Patterns

- ❌ Abbreviations: `usrMgr`, `calcTtlAmt`, `svcCfg` — write the full word
- ❌ Hungarian notation: `strName`, `iCount`, `bEnabled` — types are in the type system
- ❌ Generic names: `data`, `result`, `info`, `temp`, `stuff` — name the domain concept
- ❌ Commented-out code — delete it, git remembers
- ❌ TODO without issue number — `// TODO: fix later` is a lie; `// TODO(#342): handle pagination` is a commitment
- ❌ Functions >25 lines — extract or simplify
- ❌ Boolean parameters — `createUser(true, false)` is unreadable; use an options object
- ❌ Negated booleans — `isNotDisabled` requires mental inversion; use `isEnabled`

## WAF Alignment

| Pillar | How Self-Documenting Code Contributes |
|--------|---------------------------------------|
| **Operational Excellence** | Meaningful names reduce onboarding time. Tests-as-specs serve as living documentation. Guard clauses make control flow auditable. README-driven design catches complexity early. |
| **Reliability** | Expressive types make illegal states unrepresentable. Early returns eliminate null-path bugs. Named constants prevent mistyped magic values. Small functions are easier to test exhaustively. |
| **Security** | Typed parameters prevent injection via stringly-typed inputs. Named constants for limits enforce consistent validation. Code clarity enables effective security review. |
| **Cost Optimization** | Clear code reduces review/debug time (largest engineering cost). Parameter objects prevent subtle bugs that cause costly production incidents. |
| **Performance Efficiency** | Small, focused functions enable targeted profiling and optimization. Named constants centralize tuning knobs for caching TTLs, batch sizes, and rate limits. |
