---
description: "OOP design patterns — interface segregation, composition over inheritance, and SOLID principles."
applyTo: "**/*.cs, **/*.ts, **/*.java, **/*.py"
waf:
  - "reliability"
  - "operational-excellence"
---

# Design Patterns — FAI Standards

## SOLID Principles — Actionable Rules

### Single Responsibility (SRP)
- One class = one reason to change. If a class name needs "And" or "Manager", split it
- Services own business logic OR orchestration, never both
- Extract cross-cutting concerns (logging, auth, caching) into decorators or middleware

### Open/Closed (OCP)
- Extend behavior via new implementations, not `if/else` chains on type strings
- Use strategy maps (`Record<string, Strategy>`) instead of switch statements on discriminator fields
- Plugin points: accept interfaces at boundaries so new behavior ships without touching existing code

### Liskov Substitution (LSP)
- Subtypes must honor the base contract — no `throw new Error("not supported")` in overrides
- If a subclass ignores or breaks a parent method, it is not a valid subtype — use composition instead

### Interface Segregation (ISP)
- No interface with >5 methods — split by consumer need
- Clients must not depend on methods they don't call. Prefer `Readable`, `Writable` over a single `Stream`

### Dependency Inversion (DIP)
- High-level modules depend on abstractions, not concrete implementations
- Inject dependencies through constructor parameters, never via `new` inside business logic
- Configuration and infrastructure concerns live at the composition root

## Composition Over Inheritance

- Prefer object composition (`has-a`) over class inheritance (`is-a`) in all new code
- Max inheritance depth: 2 levels. Beyond that, extract shared behavior into composable mixins or delegates
- Never inherit to reuse — inherit only to express a true "is-a" relationship

```typescript
// ✅ Composition — behaviors are pluggable
interface RetryPolicy { execute<T>(fn: () => Promise<T>): Promise<T>; }
interface Logger { log(msg: string, ctx?: Record<string, unknown>): void; }

class OrderService {
  constructor(private repo: OrderRepository, private retry: RetryPolicy, private logger: Logger) {}
  async place(order: Order): Promise<string> {
    return this.retry.execute(async () => {
      const id = await this.repo.save(order);
      this.logger.log("order_placed", { orderId: id });
      return id;
    });
  }
}
```

```typescript
// ❌ Inheritance — rigid coupling, unclear responsibilities
class OrderService extends BaseRetryService {
  // inherits retry, logging, config, metrics — can't swap any independently
  async place(order: Order): Promise<string> { /* ... */ }
}
```

## Dependency Injection

- Register all dependencies at the composition root (app entry point)
- Use constructor injection exclusively — no property injection, no service locator
- Scoped lifetimes: singletons for stateless services, transient for stateful or per-request

```typescript
// ✅ Composition root wires everything — business code stays clean
const repo = new PostgresOrderRepository(pool);
const retry = new ExponentialRetry({ base: 1000, max: 30000, retries: 3 });
const logger = new StructuredLogger("OrderService");
const service = new OrderService(repo, retry, logger);
```

## Strategy Pattern

- Use when behavior varies by type, role, or configuration — never a growing switch/if-else
- Strategies implement a shared interface and are selected via a registry map

```typescript
interface Summarizer { summarize(text: string): Promise<string>; }

const summarizers: Record<string, Summarizer> = {
  extractive: new ExtractiveSummarizer(),
  abstractive: new LlmSummarizer(client),
};

function getSummarizer(mode: string): Summarizer {
  const s = summarizers[mode];
  if (!s) throw new Error(`Unknown summarizer: ${mode}`);
  return s;
}
```

## Observer / Event-Driven

- Use events to decouple side effects (notifications, auditing, cache invalidation) from core logic
- Emitters own the event contract (typed event payloads). Listeners are registered at startup
- Never put business-critical logic in event listeners — listeners handle secondary effects only

## Builder Pattern

- Use builders when constructing objects with >4 optional parameters or complex validation
- Builder methods return `this` for chaining. `build()` validates invariants and returns the immutable object
- Never expose partially constructed objects — invalid state must throw at build time

## Repository Pattern

- Repositories encapsulate data access behind a collection-like interface (`find`, `save`, `delete`)
- Business logic calls the repository interface — never raw SQL, ORM queries, or SDK calls in services
- One repository per aggregate root. No repositories for value objects or child entities

## Middleware / Chain of Responsibility

- Use for cross-cutting pipelines: auth → validation → rate-limit → handler → logging
- Each middleware calls `next()` or short-circuits. Order is defined at the composition root
- Middleware must not hold request-scoped state between invocations

## Factory Pattern

- Use factories when object creation requires conditional logic or environment-specific deps
- Factory methods return the interface type, never the concrete class
- Consolidate `new` calls — if the same conditional creation appears twice, extract a factory

## Anti-Corruption Layer (ACL)

- Wrap external/legacy APIs behind an adapter that speaks your domain language
- Translate external DTOs into domain models at the boundary — never leak external schemas inward
- ACL changes when the external system changes, domain models stay stable

## Event Sourcing Basics

- Store state transitions as immutable events, derive current state by replaying the event stream
- Events are facts — past tense naming (`OrderPlaced`, `ItemShipped`), append-only, never mutated
- Use only when audit trail, temporal queries, or undo/replay are genuine requirements — not by default

## Anti-Patterns — Never Do These

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **God Class** | One class with 500+ lines handling everything | Split by responsibility — one class, one job |
| **Anemic Domain Model** | Models are data bags; all logic in external services | Move behavior into the entity that owns the data |
| **Service Locator** | `Container.resolve<T>()` called inside business code | Constructor injection — dependencies are explicit |
| **Deep Inheritance** (>2 levels) | Fragile base class problem, unclear method resolution | Flatten to composition with delegate objects |
| **Primitive Obsession** | `string` for email, `number` for money | Value objects: `Email`, `Money`, `OrderId` |
| **Temporal Coupling** | Methods must be called in secret order or state breaks | Builder or state machine — enforce order structurally |
| **Feature Envy** | Method uses 5 fields from another class, 0 from its own | Move the method to the class whose data it uses |

## WAF Alignment

| WAF Pillar | Design Pattern Contribution |
|---|---|
| **Reliability** | Strategy + retry policies, circuit breaker as middleware, repository isolation from data-layer failures |
| **Operational Excellence** | DI makes components testable and swappable, observer decouples side effects, middleware standardizes pipelines |
| **Security** | ACL prevents external schema leaks, factory centralizes credential handling, ISP limits attack surface per interface |
| **Cost Optimization** | Strategy enables model routing (cheap model for simple tasks), composition allows swapping cache layers without rewrite |
| **Performance** | Chain of responsibility enables short-circuit (skip expensive steps), event sourcing enables async projections |
| **Responsible AI** | Observer emits audit events for transparency, builder enforces guardrail config at construction time |
