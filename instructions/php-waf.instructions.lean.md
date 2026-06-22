---
description: "PHP coding standards — typed properties, attributes, PSR-12, Composer, and modern PHP 8.3+ patterns."
applyTo: "**/*.php"
waf:
  - "security"
  - "reliability"
---

# PHP — FAI Standards

## Strict Mode & Type Safety

- Every file starts with `declare(strict_types=1);` — no exceptions
- Type declarations on all parameters, return types, and properties — including `void`, `never`, `null`
- Use union types (`string|int`), intersection types (`Countable&Iterator`), and `mixed` only when truly polymorphic
- Nullable via `?Type` syntax, never `Type|null` — prefer null objects or `Option` pattern over nullable returns
- Use `readonly` properties and `readonly class` for immutable data — default to immutable

```php
<?php declare(strict_types=1);

readonly class InvoiceLineItem
{
    public function __construct(
        public string $sku,
        public int $quantity,
        public float $unitPrice,
        public ?string $discountCode = null,
    ) {}

    public function total(): float
    {
        return $this->quantity * $this->unitPrice;
    }
}
```

## PHP 8.2+ Features

- **Enums** over class constants for finite sets — back with `string` or `int` for serialization
- **Named arguments** for functions with 3+ params or boolean flags — `search(query: $q, limit: 10)`
- **Match expression** over switch — exhaustive, returns a value, strict comparison
- **Constructor promotion** for DTOs, value objects, and service classes
- **Fibers** for cooperative multitasking — prefer `amphp/amp` or `revolt/event-loop` over raw Fiber
- **First-class callables** via `strlen(...)` syntax — pass to `array_map`, `array_filter`
- **`#[Override]`** attribute on every overridden method (PHP 8.3)

```php
enum InvoiceStatus: string
{
    case Draft = 'draft';
    case Sent = 'sent';
    case Paid = 'paid';
    case Overdue = 'overdue';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Draft => $next === self::Sent,
            self::Sent => in_array($next, [self::Paid, self::Overdue], true),
            self::Paid, self::Overdue => false,
        };
    }
}
```

## PSR Standards

- **PSR-4** autoloading — namespace matches directory structure, one class per file
- **PSR-12** coding style — enforced via `php-cs-fixer` with `@PSR12` + `@PHP82Migration` rulesets
- **PSR-7** HTTP messages — use `nyholm/psr7` (lightweight) or `guzzlehttp/psr7`
- **PSR-15** middleware — implement `MiddlewareInterface` for cross-cutting concerns (auth, logging, CORS)
- **PSR-3** logging — `psr/log` interface, bind to Monolog with JSON formatter
- **PSR-11** container — constructor injection via autowiring, never call `$container->get()` in application code

## Composer & Dependencies

- `composer.lock` committed — reproducible installs via `composer install --no-dev` in production
- `"minimum-stability": "stable"` — never `dev` in production projects
- Pin major versions: `"^8.2"` for `php`, `"^3.0"` for packages — avoid `*` or `>=`
- `"platform": {"php": "8.2.0"}` in `composer.json` to match deploy target
- Run `composer audit` in CI — fail on known vulnerabilities
- `"autoload": {"psr-4": {"App\\": "src/"}}` — single top-level namespace per project

## Code Quality & Static Analysis

- **PHPStan level 9** with `phpstan-strict-rules` and `phpstan-deprecation-rules`
- **Rector** for automated upgrades — `LevelSetList::UP_TO_PHP_83` + dead code removal
- **PHP-CS-Fixer** config committed (`.php-cs-fixer.dist.php`) — run in CI, never manual formatting
- Functions ≤ 40 lines, classes ≤ 300 lines — extract when exceeding
- Use `array_map()`, `array_filter()`, `array_reduce()` over `foreach` for transformations
- Early return pattern — guard clauses at top, happy path unindented

```php
/** @param list<Order> $orders */
function completedTotal(array $orders): float
{
    return array_sum(
        array_map(
            static fn (Order $o): float => $o->total(),
            array_filter($orders, static fn (Order $o): bool => $o->status === OrderStatus::Completed),
        )
    );
}
```

## Error Handling & Exception Hierarchy

- Custom exception hierarchy: `DomainException` → specific exceptions (e.g., `InsufficientFundsException`)
- Never catch `\Exception` or `\Throwable` broadly — catch specific, rethrow with context
- Use `throw` expressions in match arms and null coalescing: `$val ?? throw new MissingValueException()`
- Log exceptions with structured context via PSR-3 — `$logger->error('Payment failed', ['orderId' => $id, 'exception' => $e])`
- API responses: RFC 7807 Problem Details (`application/problem+json`)

## Dependency Injection

- Constructor promotion for all service dependencies — no setters, no property injection
- Interfaces for infrastructure boundaries (repositories, HTTP clients, mailers)
- Final classes by default — extend only when designing for it
- `#[Autowire]` attributes for tagged service injection (Symfony) or contextual binding (Laravel)

```php
final readonly class ProcessPaymentHandler
{
    public function __construct(
        private PaymentGatewayInterface $gateway,
        private OrderRepositoryInterface $orders,
        private LoggerInterface $logger,
    ) {}

    public function __invoke(ProcessPayment $command): void
    {
        $order = $this->orders->findOrFail($command->orderId);
        $result = $this->gateway->charge($order->total(), $command->paymentMethod);

        match ($result->status) {
            PaymentStatus::Success => $this->orders->markPaid($order, $result->transactionId),
            PaymentStatus::Declined => throw new PaymentDeclinedException($order->id, $result->reason),
            PaymentStatus::Pending => $this->logger->info('Payment pending', ['orderId' => $order->id->toString()]),
        };
    }
}
```

## Null Safety

- Use nullsafe operator `?->` for chained access — `$user?->address()?->city()`
- Prefer null object pattern for optional collaborators over nullable types
- `??` for defaults — `$config['timeout'] ?? 30`
- Never use `isset()` / `empty()` on typed properties — they're always initialized

## Testing

- **Pest** for expressive syntax, **PHPUnit 11+** as engine — `pest-plugin-type-coverage` for 100% type coverage
- Architecture tests: `arch()->expect('App\Domain')->toUseStrictTypes()->not->toUse(['DB', 'Cache'])`
- Mutation testing with **Infection** — MSI ≥ 80% on domain layer
- Use `Mockery::mock(Interface::class)` — mock interfaces, never concrete classes
- Factories with `fakerphp/faker` — no fixtures, no seeds in unit tests
- Run PHPStan + PHP-CS-Fixer + Pest in CI pipeline — any failure blocks merge

## Anti-Patterns

- ❌ Missing `declare(strict_types=1)` — silent type coercion causes subtle bugs
- ❌ Using `mixed` or `array` without `@param` PHPDoc shapes — defeats static analysis
- ❌ `new` keyword in application code — use DI container, never `new Service()` inline
- ❌ Static methods for stateful operations — untestable, hidden dependencies
- ❌ `catch (\Exception $e) {}` — swallowing errors silently
- ❌ Using `extract()`, `compact()`, `eval()`, `$$var` — security and readability hazards
- ❌ Raw SQL without parameterized queries — SQLi vector
- ❌ `public` properties on mutable objects — use `readonly` or getter methods
- ❌ Returning associative arrays from public APIs — use typed DTOs or value objects
- ❌ `@suppress` / `@phpstan-ignore` without linked issue — technical debt accumulates

## WAF Alignment

| Pillar | PHP Practice |
|---|---|
| **Security** | `declare(strict_types=1)`, parameterized queries (PDO/Doctrine), `composer audit`, CSRF tokens, `htmlspecialchars()` output escaping, `sodium_*` for crypto, secrets via env vars / vault |
| **Reliability** | Exception hierarchy with context, retry via `symfony/http-client` RetryableHttpClient, health endpoint, circuit breaker (Ganesha), graceful `pcntl_signal` shutdown |
| **Cost** | OPcache + JIT enabled, lazy collections (`yield`), connection pooling (Swoole/FrankenPHP), right-sized container limits, Composer `--no-dev --classmap-authoritative` |
| **Ops** | Structured JSON logging (Monolog), PHPStan level 9 in CI, Rector auto-upgrades, GitHub Actions matrix (PHP 8.2/8.3/8.4), `php-cs-fixer` enforced |
| **Performance** | Preloading (`opcache.preload`), `readonly` classes (no cloning overhead), `array_*` functions over loops, FrankenPHP worker mode, async with AMPHP/Fibers |
| **Responsible AI** | Input sanitization before LLM prompts, output escaping, PII filtering in logs, Content Safety integration for user-facing AI |
