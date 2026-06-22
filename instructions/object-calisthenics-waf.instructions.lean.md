---
description: "Object calisthenics standards — 9 rules for clean, maintainable code across OOP languages."
applyTo: "**/*.cs, **/*.ts, **/*.java, **/*.py"
waf:
  - "reliability"
  - "operational-excellence"
---

# Object Calisthenics — FAI Standards

9 strict OOP exercise rules by Jeff Bay (ThoughtWorks Anthology, 2008). Apply them as a training discipline — relax selectively in production after understanding the tradeoff.

## Rule 1 — One Level of Indentation Per Method

Extract nested logic into named methods. Deep nesting hides complexity and resists testing.

```typescript
// ❌ Before — 3 levels deep
function process(orders: Order[]) {
  for (const order of orders) {
    if (order.isValid()) {
      for (const item of order.items) {
        if (item.inStock()) { ship(item); }
      }
    }
  }
}

// ✅ After — flat, each method testable independently
function process(orders: Order[]) {
  orders.filter(o => o.isValid()).forEach(shipAvailableItems);
}
function shipAvailableItems(order: Order) {
  order.items.filter(i => i.inStock()).forEach(ship);
}
```

## Rule 2 — Don't Use the `else` Keyword

Use early returns, guard clauses, polymorphism, or strategy maps. `else` branches grow into untestable chains.

```python
# ❌ Before
def discount(customer):
    if customer.is_premium:
        return 0.2
    else:
        if customer.orders > 10:
            return 0.1
        else:
            return 0.0

# ✅ After — guard clauses
def discount(customer):
    if customer.is_premium:
        return 0.2
    if customer.orders > 10:
        return 0.1
    return 0.0
```

For complex branching, use a strategy map: `DISCOUNTS: dict[str, Callable] = {"premium": ..., "loyal": ...}`.

## Rule 3 — Wrap All Primitives and Strings

Naked primitives (`str`, `number`, `int`) carry no domain meaning and bypass validation. Wrap them.

```typescript
// ❌ Before — email is just a string, no validation anywhere
function sendEmail(to: string, subject: string) { /* ... */ }

// ✅ After — domain types enforce invariants at construction
class EmailAddress {
  constructor(private readonly value: string) {
    if (!value.includes("@")) throw new Error("Invalid email");
  }
  toString() { return this.value; }
}
function sendEmail(to: EmailAddress, subject: Subject) { /* ... */ }
```

```python
# ✅ Python — dataclass or NewType for lightweight wrapping
@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str
    def __post_init__(self):
        if self.amount < 0:
            raise ValueError("Negative money")
```

## Rule 4 — First-Class Collections

Any class with a collection field should contain ONLY that collection — no other fields. The wrapper provides domain-specific query/filter methods instead of leaking raw list operations.

```typescript
// ❌ Before — raw array, business rules scattered across callers
const overdue = invoices.filter(i => i.dueDate < now && !i.paid);

// ✅ After — collection wraps behavior
class Invoices {
  constructor(private readonly items: Invoice[]) {}
  overdue(now: Date): Invoices {
    return new Invoices(this.items.filter(i => i.dueDate < now && !i.paid));
  }
  totalOwed(): Money { return this.items.reduce((sum, i) => sum.add(i.amount), Money.zero()); }
}
```

## Rule 5 — One Dot Per Line (Law of Demeter)

Chaining through object graphs creates hidden coupling. Talk only to immediate collaborators.

```python
# ❌ Before — reaches through 3 objects
city = order.customer.address.city

# ✅ After — each object exposes only what it owns
city = order.shipping_city()  # Order delegates internally
```

Exception: fluent builder APIs and LINQ/stream pipelines are fine — they return `self`/same type.

## Rule 6 — Don't Abbreviate

If a name needs abbreviating, the class is doing too much. Long names signal extraction opportunities.

```typescript
// ❌ mgr, svc, repo, impl, utils, proc, ctx, cfg, cb, req, res
class OrdProcMgr { procOrd(o: Ord) {} }

// ✅ Full names — readable 6 months later
class OrderProcessor { process(order: Order) {} }
```

Allowed abbreviations: `id`, `url`, `html`, `http`, `io`, `db` — universally understood acronyms only.

## Rule 7 — Keep All Entities Small

Classes ≤ 50 lines, methods ≤ 10 lines, packages ≤ 10 files. Forces single-responsibility. When a class grows past 50 lines, split by responsibility — don't just move code into a helper.

## Rule 8 — No Classes with More Than Two Instance Variables

This is the strictest rule. It forces decomposition into tiny, composable objects.

```python
# ❌ Before — 4 fields
class Order:
    def __init__(self, customer, items, shipping, billing): ...

# ✅ After — max 2 fields, compose from smaller types
class Order:
    def __init__(self, customer: Customer, fulfillment: Fulfillment): ...

class Fulfillment:
    def __init__(self, items: OrderItems, delivery: Delivery): ...
```

**Pragmatic relaxation:** In production, strict 2-field limit creates excessive indirection. Relax to 3-5 fields for DTOs, config objects, and framework-required classes. The exercise value is learning to decompose — apply the mindset, not the number.

## Rule 9 — No Getters/Setters/Properties

Don't expose internal state. Tell objects what to do — don't ask for their data and act on it externally.

```typescript
// ❌ Before — caller extracts data and makes decisions
if (account.getBalance() > amount) {
  account.setBalance(account.getBalance() - amount);
}

// ✅ After — object owns its own logic
account.withdraw(amount); // throws InsufficientFunds internally
```

```python
# ❌ Before — anemic model
total = sum(item.price * item.quantity for item in cart.get_items())

# ✅ After — behavior lives with data
total = cart.total()  # Cart computes internally
```

## Which Rules to Relax in Practice

| Rule | Strictness | Production Guidance |
| --- | --- | --- |
| 1 — One indent level | **Keep** | Almost always achievable and beneficial |
| 2 — No else | **Keep** | Guard clauses and early returns are universally better |
| 3 — Wrap primitives | **Selectively** | Wrap domain concepts (Money, Email). Skip for local variables |
| 4 — First-class collections | **Selectively** | Worth it for core domain. Skip for throwaway lists |
| 5 — One dot per line | **Relax** | Allow fluent APIs, builders, stream/LINQ chains |
| 6 — No abbreviations | **Keep** | Zero cost, massive readability gain |
| 7 — Small entities | **Keep** | 50 lines is strict — 100 is a reasonable production limit |
| 8 — Max 2 fields | **Relax** | Use as exercise. Production: 3-5 fields is fine |
| 9 — No getters/setters | **Selectively** | Enforce in domain core. Allow in DTOs/serialization boundaries |

## Testability Impact

These rules directly improve testability:
- **Rules 1-2**: Flat methods → every path reachable in a single test
- **Rule 3**: Value objects → test validation once at construction, trust everywhere
- **Rule 4**: Collection wrappers → test query logic in isolation, no database needed
- **Rule 7**: Small classes → few tests per class, fast feedback
- **Rule 9**: Tell-don't-ask → test behavior outcomes, not internal state

## Anti-Patterns

- ❌ God classes with 10+ fields doing everything — violates rules 7, 8
- ❌ `Utils`/`Helper`/`Manager` suffix classes — extract real domain objects instead
- ❌ Primitive obsession: passing `string` for email, userId, currency everywhere
- ❌ Train wrecks: `order.getCustomer().getAddress().getCity().getZipCode()`
- ❌ Anemic domain models: data bags with getters + external service classes with all logic
- ❌ Deep `if/else/if/else` trees — use polymorphism, strategy, or early returns
- ❌ Abbreviated names requiring team-specific decoder rings

## WAF Alignment

| WAF Pillar | How Object Calisthenics Helps |
| --- | --- |
| **Reliability** | Small methods + no deep nesting → fewer bugs, easier error handling, testable fault paths |
| **Operational Excellence** | No abbreviations + small entities → readable code, faster onboarding, easier incident debugging |
| **Security** | Wrapped primitives → input validation enforced at type construction, not scattered across callers |
| **Performance Efficiency** | First-class collections → encapsulate caching/batching inside the wrapper transparently |
| **Cost Optimization** | Tell-don't-ask → behavioral cohesion reduces code duplication and maintenance burden |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
