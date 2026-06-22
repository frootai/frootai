---
description: "Java coding standards — constructor injection, immutable objects, streams API, JUnit 5, and Spring Boot patterns."
applyTo: "**/*.java"
waf:
  - "reliability"
  - "security"
  - "operational-excellence"
---

# Java — FAI Standards

## Records & Sealed Types

Use `record` for DTOs, API responses, and value objects — no Lombok needed:

```java
public record CreateOrderRequest(
    @NotBlank String customerId,
    @NotEmpty List<LineItem> items,
    @Positive BigDecimal total
) {}

public sealed interface PaymentResult
    permits PaymentResult.Success, PaymentResult.Declined, PaymentResult.Error {
    record Success(String transactionId, Instant timestamp) implements PaymentResult {}
    record Declined(String reason) implements PaymentResult {}
    record Error(String code, String message) implements PaymentResult {}
}
```

## Pattern Matching

Prefer pattern matching over `instanceof` chains and visitor patterns:

```java
// switch expressions with sealed types — exhaustive, no default needed
return switch (result) {
    case PaymentResult.Success s -> ResponseEntity.ok(s);
    case PaymentResult.Declined d -> ResponseEntity.unprocessableEntity().body(d);
    case PaymentResult.Error e -> ResponseEntity.internalServerError().body(e);
};

// guarded patterns
if (obj instanceof String s && s.length() > 10) {
    process(s.substring(0, 10));
}
```

## Optional Usage

Return `Optional` from methods that may not produce a value. Never use as field types or parameters:

```java
// ✅ Return type
public Optional<Customer> findByEmail(String email) {
    return repository.findByEmail(email);
}

// ✅ Chain with map/flatMap — avoid .get()
var name = findByEmail(email)
    .map(Customer::displayName)
    .orElse("Unknown");

// ❌ NEVER as field or parameter
// private Optional<String> nickname;           — use @Nullable
// public void process(Optional<Filter> filter) — use @Nullable or overload
```

## Stream API

```java
// Prefer toList() (Java 16+) over Collectors.toList()
var activeNames = users.stream()
    .filter(User::isActive)
    .map(User::name)
    .sorted()
    .toList();  // unmodifiable list

// Use flatMap for nested collections
var allTags = documents.stream()
    .flatMap(doc -> doc.tags().stream())
    .distinct()
    .toList();

// Collectors for grouping/partitioning
var byDepartment = employees.stream()
    .collect(Collectors.groupingBy(Employee::department, Collectors.counting()));
```

Avoid: side-effects in `peek()`, streams over 3 operations without intermediate variables, parallel streams unless benchmarked.

## Virtual Threads (Project Loom)

Use virtual threads for I/O-bound concurrency. Never pool them:

```java
// Spring Boot 3.2+ — enable in application.yml
// spring.threads.virtual.enabled: true

// Manual usage for fan-out
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    var futures = urls.stream()
        .map(url -> executor.submit(() -> httpClient.send(buildRequest(url), ofString())))
        .toList();
    var results = futures.stream().map(Future::resultNow).toList();
}
```

Never use `synchronized` blocks inside virtual thread tasks — use `ReentrantLock`. Never pool virtual threads in a fixed-size pool.

## Text Blocks & var

```java
// Text blocks for SQL, JSON, prompts
var query = """
    SELECT c.id, c.name, c.email
    FROM customers c
    WHERE c.status = :status
      AND c.created_at > :since
    ORDER BY c.created_at DESC
    """;

// var for local variables when RHS type is obvious
var client = HttpClient.newHttpClient();
var response = client.send(request, HttpResponse.BodyHandlers.ofString());
var mapper = new ObjectMapper();
```

## Resource Management & Error Handling

```java
// try-with-resources — always for AutoCloseable
try (var conn = dataSource.getConnection();
     var stmt = conn.prepareStatement(query)) {
    stmt.setString(1, customerId);
    return mapResults(stmt.executeQuery());
}

// CompletableFuture for async orchestration
CompletableFuture.supplyAsync(() -> fetchProfile(userId))
    .thenCombine(
        CompletableFuture.supplyAsync(() -> fetchOrders(userId)),
        (profile, orders) -> new CustomerView(profile, orders)
    )
    .exceptionally(ex -> {
        log.error("Failed to build customer view", ex);
        return CustomerView.empty();
    });
```

## Spring Boot 3 Conventions

```java
// Constructor injection — no @Autowired, no field injection
@Service
public class OrderService {
    private final OrderRepository repository;
    private final PaymentGateway gateway;
    private final OrderProperties props;

    OrderService(OrderRepository repository, PaymentGateway gateway, OrderProperties props) {
        this.repository = repository;
        this.gateway = gateway;
        this.props = props;
    }
}

// @ConfigurationProperties over @Value — type-safe, validated
@ConfigurationProperties(prefix = "app.ai")
@Validated
public record AiProperties(
    @NotBlank String endpoint,
    @NotBlank String deploymentName,
    @DecimalMin("0.0") @DecimalMax("2.0") double temperature,
    @Positive int maxTokens
) {}
```

## Jackson & Serialization

```java
// Records work with Jackson out of the box
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record ApiResponse<T>(
    T data,
    @JsonInclude(JsonInclude.Include.NON_NULL) String error,
    Instant timestamp
) {}

// Enum with @JsonValue
public enum Status {
    ACTIVE("active"), INACTIVE("inactive");
    private final String value;
    Status(String value) { this.value = value; }
    @JsonValue public String getValue() { return value; }
}
```

## Testing — JUnit 5 + AssertJ

```java
@Test
void shouldDeclineExpiredCard() {
    var request = new PaymentRequest("4111111111111111", YearMonth.of(2020, 1), new BigDecimal("50.00"));
    var result = paymentService.process(request);

    assertThat(result)
        .isInstanceOf(PaymentResult.Declined.class)
        .extracting("reason")
        .isEqualTo("Card expired");
}

@ParameterizedTest
@CsvSource({"0, false", "17, false", "18, true", "65, true"})
void shouldValidateAge(int age, boolean expected) {
    assertThat(Policy.isEligible(age)).isEqualTo(expected);
}

// @SpringBootTest only for integration tests — unit tests need no Spring context
```

## Structured Logging — SLF4J

```java
// Structured key-value pairs — never string concatenation
log.info("Order processed", kv("orderId", order.id()), kv("amount", order.total()), kv("durationMs", elapsed));
log.error("Payment failed", kv("customerId", customerId), kv("errorCode", e.code()), e);

// MDC for correlation
MDC.put("correlationId", correlationId);
MDC.put("userId", userId);
try { process(request); }
finally { MDC.clear(); }
```

## Anti-Patterns

- ❌ Lombok `@Data` on JPA entities — use records for DTOs, write JPA entities explicitly
- ❌ Field injection (`@Autowired private Foo foo`) — invisible dependencies, untestable
- ❌ `Optional.get()` without `isPresent()` — use `orElseThrow()`, `map()`, `orElse()`
- ❌ Raw types (`List` instead of `List<String>`) — always parameterize generics
- ❌ Catching `Exception` or `Throwable` — catch specific types, rethrow unknown
- ❌ `new Thread()` for concurrency — use virtual threads or `ExecutorService`
- ❌ Mutable DTOs with setters — use records or builder pattern (immutable)
- ❌ `System.out.println` in production — use SLF4J with structured logging
- ❌ `@SpringBootTest` for unit tests — only for integration, use plain JUnit + mocks

## WAF Alignment

| Pillar | Java Practice |
|--------|--------------|
| **Reliability** | Virtual threads for non-blocking I/O, `CompletableFuture` error recovery, try-with-resources for leak prevention, health actuator at `/actuator/health` |
| **Security** | `@ConfigurationProperties` for secrets (never hardcoded), `@Validated` on all input DTOs, parameterized queries only, `DefaultAzureCredential` via Azure SDK |
| **Cost** | Stream `toList()` avoids extra copies, virtual threads eliminate thread pool sizing, `@Cacheable` with TTL for repeated queries |
| **Ops Excellence** | SLF4J + MDC correlation, `@ParameterizedTest` for edge cases, Actuator metrics + Micrometer, constructor injection for clear dependency graphs |
| **Performance** | Virtual threads scale to 1M+ concurrent tasks, `HttpClient` with HTTP/2, Stream lazy evaluation, text blocks eliminate runtime concatenation |
| **Responsible AI** | Input validation via Bean Validation, structured logging with PII redaction, Content Safety integration before user-facing output |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
