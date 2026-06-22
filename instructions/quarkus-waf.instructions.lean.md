---
description: "Quarkus standards — Java 21, CDI, reactive, native compilation patterns."
applyTo: "*"
waf:
  - "performance-efficiency"
  - "reliability"
---

# Quarkus — FAI Standards

## CDI Dependency Injection
- Use `@ApplicationScoped` for stateless services, `@RequestScoped` for per-request state
- Constructor injection preferred; `@Inject` on fields only for framework-managed beans
- Produce config-driven beans via `@Produces` methods in a central `AppProducer`

```java
@ApplicationScoped
public class EmbeddingService {
    private final OpenAIClient client;
    @ConfigProperty(name = "ai.embedding.model") String model;
    @ConfigProperty(name = "ai.embedding.dimensions", defaultValue = "1536") int dims;

    @Inject
    public EmbeddingService(OpenAIClient client) {
        this.client = client;
    }

    public Uni<float[]> embed(String text) {
        return client.embed(text, model, dims);
    }
}
```

## RESTEasy Reactive Endpoints
- Return `Uni<T>` or `Multi<T>` — never block the event loop
- Use `@RestPath`, `@RestQuery`, `@RestHeader` over JAX-RS `@PathParam`
- Validate input with Hibernate Validator `@Valid`; return `ProblemDetail` on errors

```java
@Path("/api/documents")
@ApplicationScoped
public class DocumentResource {
    @Inject DocumentService service;

    @POST @Consumes(MediaType.APPLICATION_JSON)
    public Uni<Response> ingest(@Valid IngestRequest req) {
        return service.ingest(req)
            .onItem().transform(id -> Response.created(URI.create("/api/documents/" + id)).build())
            .onFailure().recoverWithItem(err ->
                Response.status(422).entity(ProblemDetail.of(err)).build());
    }

    @GET @Path("/{id}")
    public Uni<DocumentDto> get(@RestPath UUID id) {
        return service.findById(id)
            .onItem().ifNull().failWith(() -> new NotFoundException("Document not found"));
    }
}
```

## Panache Patterns
- Active Record (`PanacheEntity`) for simple CRUD; Repository (`PanacheRepository`) for complex domains
- Use `find("status", Sort.by("createdAt").descending(), Status.ACTIVE)` — never raw JPQL strings with concatenation
- Always paginate: `.page(Page.of(index, size))` — no unbounded `listAll()` in API endpoints

```java
@ApplicationScoped
public class PlayRepository implements PanacheRepository<SolutionPlay> {
    public Uni<List<SolutionPlay>> findByWafPillar(String pillar, int page, int size) {
        return find("wafPillar", Sort.descending("updatedAt"), pillar)
            .page(Page.of(page, size)).list();
    }
}
```

## Native Image Compilation
- Register reflection targets: `@RegisterForReflection` on DTOs, config classes, and JSON-serialized records
- Avoid runtime class loading — no `Class.forName()`, no dynamic proxies outside CDI
- Test native builds in CI: `mvn verify -Pnative -Dquarkus.native.container-build=true`
- Use `@BuildStep` for build-time initialization; move heavy init from runtime to static blocks

```java
@RegisterForReflection
public record IngestRequest(
    @NotBlank String content,
    @Size(max = 50) List<String> tags,
    @NotNull UUID sourceId
) {}
```

## MicroProfile Config
- Layer: `application.properties` → env vars → Kubernetes ConfigMaps — never hardcode
- Prefix AI params: `ai.openai.endpoint`, `ai.search.index`, `ai.safety.threshold`
- Fail fast on missing required config — `@ConfigProperty` without `defaultValue` throws at startup
- Sensitive values via `${VAULT_SECRET}` placeholders resolved by the `quarkus-vault` extension

## Health & Observability
- Liveness at `/q/health/live` (process OK), readiness at `/q/health/ready` (dependencies OK)
- Custom readiness checks for downstream services (DB, AI endpoints, message brokers)

```java
@Readiness @ApplicationScoped
public class AiServiceHealthCheck implements HealthCheck {
    @Inject OpenAIClient client;
    @Override
    public HealthCheckResponse call() {
        try {
            client.ping();
            return HealthCheckResponse.up("ai-service");
        } catch (Exception e) {
            return HealthCheckResponse.down("ai-service");
        }
    }
}
```

## OpenAPI & Documentation
- `quarkus-smallrye-openapi` auto-generates from JAX-RS annotations — no manual spec files
- Annotate with `@Operation(summary=...)`, `@Tag`, `@APIResponse` for accurate schema
- Serve Swagger UI only in dev: `quarkus.swagger-ui.always-include=false`

## Reactive Messaging (Kafka)
- Use `@Incoming` / `@Outgoing` with SmallRye Reactive Messaging — no manual consumer loops
- Acknowledge after processing: `Acknowledgment.Strategy.POST_PROCESSING`
- Dead-letter topic for poison messages — never silently drop

```java
@ApplicationScoped
public class EmbeddingPipeline {
    @Inject EmbeddingService embeddings;

    @Incoming("documents-in") @Outgoing("embeddings-out")
    @Acknowledgment(Acknowledgment.Strategy.POST_PROCESSING)
    public Uni<EmbeddingRecord> process(DocumentEvent event) {
        return embeddings.embed(event.content())
            .onItem().transform(vec -> new EmbeddingRecord(event.id(), vec));
    }
}
```

## Dev Services & Testing
- Dev Services auto-start Kafka, PostgreSQL, Redis via Testcontainers — zero local install
- Continuous testing: `quarkus dev` runs tests on save — keep feedback loop <5s
- Use `@QuarkusTest` for CDI-integrated tests; `@QuarkusIntegrationTest` for native image
- `@InjectMock` replaces beans in tests — never manual reflection hacks

```java
@QuarkusTest class DocumentResourceTest {
    @InjectMock EmbeddingService embeddings;

    @Test void ingestReturns201() {
        when(embeddings.embed(anyString())).thenReturn(Uni.createFrom().item(new float[1536]));
        given().contentType(JSON).body(new IngestRequest("text", List.of(), UUID.randomUUID()))
            .when().post("/api/documents")
            .then().statusCode(201).header("Location", notNullValue());
    }
}
```

## Qute Templating
- Type-safe templates via `@CheckedTemplate` — compile-time validation of expressions
- Keep logic in services, templates for rendering only — no business logic in `.html` files

## Security
- OIDC via `quarkus-oidc` — single `quarkus.oidc.auth-server-url` property configures Keycloak/Entra ID
- `@RolesAllowed("admin")` on endpoints; `@PermissionsAllowed` for fine-grained resource-level checks
- JWT propagation with `quarkus-oidc-token-propagation` for downstream service calls
- Never disable CSRF or CORS in production — explicit allowlists only

## Extension Ecosystem
- Prefer official extensions (`quarkus-*`) over raw libraries — ensures native image compat
- Check native support before adding deps: `quarkus extension list --installable`
- Pin BOM version via `quarkus-bom` — never mix Quarkus versions across extensions

## Anti-Patterns
- ❌ Blocking calls (`Thread.sleep`, synchronous HTTP) inside reactive pipelines
- ❌ `listAll()` without pagination in REST endpoints — OOM on large datasets
- ❌ `Class.forName()` or runtime proxies — breaks native image
- ❌ `@Singleton` instead of `@ApplicationScoped` — skips CDI proxy, breaks interception
- ❌ Raw SQL string concatenation — use Panache typed queries or named parameters
- ❌ Disabling Dev Services in tests — test with real containers, not mocks for infra
- ❌ Catching `Exception` broadly — handle specific failures, let unknown errors propagate
- ❌ Manual JSON serialization — use Jackson/JSON-B auto-binding with `@RegisterForReflection`

## WAF Alignment

| Pillar | Quarkus Practice |
|---|---|
| **Performance** | Reactive pipeline (`Uni`/`Multi`), native image <50ms startup, GraalVM AOT, connection pooling via Agroal |
| **Reliability** | SmallRye Fault Tolerance (`@Retry`, `@CircuitBreaker`, `@Timeout`), health checks, dead-letter queues |
| **Security** | OIDC/JWT with `@RolesAllowed`, Vault secrets, TLS, CORS allowlists, input validation |
| **Cost** | Native image = lower memory (RSS ~30MB vs ~200MB JVM), faster cold starts, right-sized containers |
| **Ops Excellence** | Dev Services (zero-config test infra), continuous testing, OpenAPI auto-gen, structured logging |
| **Responsible AI** | Content Safety integration, PII redaction before logging, audit trail for AI decisions |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
