---
description: "Spring Boot standards — constructor injection, profiles, YAML config, and production patterns."
applyTo: "**/*.java, **/application*.yml"
waf:
  - "reliability"
  - "security"
  - "operational-excellence"
---

# Spring Boot — FAI Standards

## Constructor Injection & Configuration

Always use constructor injection. Never `@Autowired` on fields — it hides dependencies and breaks testability.

```java
@Service
public class OrderService {
    private final OrderRepository repo;
    private final PaymentClient payment;

    // Single constructor — @Autowired implicit, no field injection
    public OrderService(OrderRepository repo, PaymentClient payment) {
        this.repo = repo;
        this.payment = payment;
    }
}
```

Bind external configuration with `@ConfigurationProperties` — type-safe, validated at startup:

```java
@ConfigurationProperties(prefix = "app.ai")
@Validated
public record AiProperties(
    @NotBlank String endpoint,
    @NotBlank String deploymentName,
    @Min(1) @Max(4096) int maxTokens,
    @DecimalMin("0.0") @DecimalMax("2.0") double temperature
) {}
// Enable: @EnableConfigurationProperties(AiProperties.class) on @SpringBootApplication
```

## Spring Security

Configure via `SecurityFilterChain` bean — never extend `WebSecurityConfigurerAdapter` (removed in 6.x):

```java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse()))
            .cors(cors -> cors.configurationSource(corsSource()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/v3/api-docs/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .build();
    }
}
```

## Spring Data JPA

Repository pattern with projections for read performance and specifications for dynamic queries:

```java
public interface OrderRepository extends JpaRepository<Order, UUID> {
    @EntityGraph(attributePaths = {"items", "customer"})
    Optional<Order> findWithDetailsById(UUID id);

    // Projection — only select needed columns
    @Query("SELECT o.id as id, o.status as status, o.total as total FROM Order o WHERE o.customer.id = :cid")
    Page<OrderSummary> findSummariesByCustomerId(@Param("cid") UUID cid, Pageable pageable);
}

// Closed projection interface — no entity overhead
public interface OrderSummary {
    UUID getId();
    OrderStatus getStatus();
    BigDecimal getTotal();
}
```

Specifications for composable, type-safe filters:

```java
public class OrderSpecs {
    public static Specification<Order> hasStatus(OrderStatus s) {
        return (root, query, cb) -> cb.equal(root.get("status"), s);
    }
    public static Specification<Order> createdAfter(Instant after) {
        return (root, query, cb) -> cb.greaterThan(root.get("createdAt"), after);
    }
}
// Usage: repo.findAll(hasStatus(PENDING).and(createdAfter(cutoff)), pageable);
```

## Exception Handling (RFC 7807)

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(EntityNotFoundException.class)
    ProblemDetail handleNotFound(EntityNotFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setTitle("Resource Not Found");
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        pd.setTitle("Validation Failed");
        pd.setProperty("errors", ex.getFieldErrors().stream()
            .map(fe -> Map.of("field", fe.getField(), "message", fe.getDefaultMessage())).toList());
        return pd;
    }
}
```

## Validation

Use `@Valid` on controller parameters. Create custom validators for domain rules:

```java
@PostMapping("/orders")
ResponseEntity<Order> create(@Valid @RequestBody CreateOrderRequest req) { ... }

// Custom constraint
@Constraint(validatedBy = FutureDateValidator.class)
@Target(FIELD) @Retention(RUNTIME)
public @interface FutureBusinessDate { String message() default "Must be a future business day"; }
```

## Caching, Async & Profiles

```java
@Cacheable(value = "embeddings", key = "#text.hashCode()", unless = "#result == null")
public float[] getEmbedding(String text) { return aiClient.embed(text); }
// Redis config: spring.cache.type=redis, spring.data.redis.host=${REDIS_HOST}

@Async
public CompletableFuture<AnalysisResult> analyzeAsync(Document doc) {
    return CompletableFuture.completedFuture(analyzer.run(doc));
}
// Requires @EnableAsync + custom executor bean (don't use SimpleAsyncTaskExecutor in prod)
```

Profiles — `application-{profile}.yml` per environment. Activate via `SPRING_PROFILES_ACTIVE`:
- `dev` — H2/embedded, debug logging, relaxed security
- `staging` — production-like, test data, monitoring enabled
- `prod` — PostgreSQL/managed DB, structured JSON logging, full security

## Actuator & Observability

```yaml
management:
  endpoints.web.exposure.include: health,info,metrics,prometheus
  endpoint.health.show-details: when_authorized
  health.diskspace.enabled: true
  metrics.tags.application: ${spring.application.name}
```

Custom health indicator for downstream dependencies:

```java
@Component
public class AiServiceHealth extends AbstractHealthIndicator {
    @Override
    protected void doHealthCheck(Health.Builder builder) {
        if (aiClient.ping()) builder.up().withDetail("model", deploymentName);
        else builder.down().withDetail("error", "AI endpoint unreachable");
    }
}
```

## Testing

```java
@WebMvcTest(OrderController.class)  // Slice test — only web layer
class OrderControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean OrderService service;

    @Test void returns404WhenNotFound() throws Exception {
        given(service.findById(any())).willThrow(new EntityNotFoundException("Order not found"));
        mvc.perform(get("/api/orders/{id}", UUID.randomUUID()))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.title").value("Resource Not Found"));
    }
}

@DataJpaTest  // Slice test — only JPA layer with embedded DB
class OrderRepositoryTest { ... }

@SpringBootTest  // Full integration with Testcontainers
@Testcontainers
class OrderIntegrationTest {
    @Container static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) { r.add("spring.datasource.url", pg::getJdbcUrl); }
}
```

## Docker & Native Image

```dockerfile
FROM eclipse-temurin:21-jre-alpine AS runtime
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
```

GraalVM native: `mvn -Pnative native:compile` — subsecond startup, lower memory. Test with `@NativeHint` for reflection-heavy code.

## OpenAPI

Add `springdoc-openapi-starter-webmvc-ui`. Document via annotations — no separate spec file drift:

```java
@Operation(summary = "Create order", responses = {
    @ApiResponse(responseCode = "201", description = "Created"),
    @ApiResponse(responseCode = "400", description = "Validation error", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
})
```

## Anti-Patterns

- ❌ `@Autowired` on fields — use constructor injection
- ❌ `WebSecurityConfigurerAdapter` — use `SecurityFilterChain` bean
- ❌ `SELECT *` or unbounded `findAll()` — always paginate, use projections
- ❌ Business logic in controllers — keep controllers thin, logic in `@Service`
- ❌ Catching `Exception` generically — catch specific types, let `@RestControllerAdvice` handle
- ❌ `@Transactional` on entire class — scope to methods that need it
- ❌ `Thread.sleep()` in async code — use `@Retryable` or resilience4j
- ❌ Secrets in `application.yml` — use env vars, Key Vault, or Spring Cloud Config
- ❌ Missing `spring.jpa.open-in-view=false` — causes lazy-loading N+1 in controllers

## WAF Alignment

| Pillar | Spring Boot Pattern |
|--------|-------------------|
| **Security** | `SecurityFilterChain` + OAuth2/JWT, CSRF protection, `@PreAuthorize`, secrets in Key Vault, dependency check via `org.owasp:dependency-check-maven` |
| **Reliability** | Actuator health checks, resilience4j circuit breaker + retry, graceful shutdown (`server.shutdown=graceful`), Testcontainers integration tests |
| **Cost Optimization** | JPA projections (avoid full entity loads), `@Cacheable` with Redis TTL, GraalVM native image (lower compute), right-sized connection pools (`HikariCP`) |
| **Operational Excellence** | Profile-based config, structured JSON logging (Logback + ECS), Micrometer metrics to Prometheus, springdoc OpenAPI, `@ControllerAdvice` standardized errors |
| **Performance** | `@Async` + `CompletableFuture`, `@EntityGraph` (avoid N+1), virtual threads (Java 21+), response compression, cache headers |
| **Responsible AI** | Input validation (`@Valid`), Content Safety integration for AI outputs, PII redaction in logs via Logback filters, audit trail with `@EntityListeners` |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
