---
description: "Java MCP server development — official SDK, reactive streams, Spring Boot integration."
applyTo: "**/*.java"
waf:
  - "reliability"
  - "security"
---

# Java MCP Server Development — FAI Standards

> Build MCP servers in Java using `io.modelcontextprotocol:java-sdk` and Spring AI MCP integration.

## SDK & Dependencies

Use the official Java MCP SDK (`modelcontextprotocol/java-sdk`). For Spring Boot projects, use the Spring AI MCP starter:

```xml
<!-- Core MCP SDK (non-Spring) -->
<dependency>
  <groupId>io.modelcontextprotocol</groupId>
  <artifactId>mcp-server</artifactId>
  <version>0.10.0</version>
</dependency>
<!-- Spring AI MCP Server Starter (stdio transport) -->
<dependency>
  <groupId>org.springframework.ai</groupId>
  <artifactId>spring-ai-starter-mcp-server</artifactId>
</dependency>
```

- Java 17+ required. Spring Boot 3.4+ for Spring AI integration.
- Use `mcp-server` for sync/async core servers, `spring-ai-starter-mcp-server` for Spring-managed lifecycle.

## Tool Registration — Spring AI

Expose tools via `@Tool` annotation on methods and register a `ToolCallbackProvider`:

```java
@Service
public class DocumentTools {
    @Tool(description = "Search documents by semantic query")
    public List<SearchResult> searchDocuments(
            @ToolParam(description = "Natural language query") String query,
            @ToolParam(description = "Max results (1-50)") @Min(1) @Max(50) int limit) {
        return searchService.semanticSearch(query, limit);
    }
}

@Configuration
public class McpToolConfig {
    @Bean
    public ToolCallbackProvider toolCallbackProvider(DocumentTools docTools) {
        return MethodToolCallbackProvider.builder()
                .toolObjects(docTools)
                .build();
    }
}
```

## Tool Registration — Core SDK (No Spring)

Build an `McpServer` directly using `McpServer.sync()` or `McpServer.async()`:

```java
var transport = new StdioServerTransportProvider();
var server = McpServer.sync(transport)
        .serverInfo("my-mcp-server", "1.0.0")
        .capabilities(ServerCapabilities.builder()
                .tools(true).resources(true).prompts(true).build())
        .tool(new McpServerFeatures.SyncToolSpecification(
                new Tool("calculate", "Evaluate a math expression",
                        Tool.JsonSchema.builder()
                                .properties(Map.of("expr", Map.of("type", "string")))
                                .required(List.of("expr")).build()),
                (exchange, args) -> {
                    String expr = (String) args.get("expr");
                    // validate + compute
                    return new CallToolResult(List.of(new TextContent(result)), false);
                }))
        .build();
// server stays alive until stdin closes
```

- Prefer `McpServer.async()` with `Mono<>` returns for I/O-bound tools (DB, HTTP calls).
- `McpServer.sync()` for CPU-bound or simple tools — SDK wraps in bounded-elastic scheduler.

## Resource & Prompt Handlers

```java
// Resource: expose data the client can read
.resource(new McpServerFeatures.SyncResourceSpecification(
        new Resource("config://app/settings", "Application settings", "application/json"),
        (exchange, req) -> new ReadResourceResult(
                List.of(new TextResourceContents(req.uri(), "application/json", loadSettings())))))

// Prompt: reusable prompt templates
.prompt(new McpServerFeatures.SyncPromptSpecification(
        new Prompt("summarize", "Summarize a document",
                List.of(new PromptArgument("text", "Document text", true))),
        (exchange, req) -> new GetPromptResult("Summarize prompt",
                List.of(new PromptMessage(Role.USER,
                        new TextContent("Summarize:\n" + req.arguments().get("text")))))))
```

## Input Validation

Use Jakarta Bean Validation on tool parameter classes. Validate at the boundary before processing:

```java
public record CreateTicketInput(
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 5000) String description,
        @Pattern(regexp = "low|medium|high|critical") String priority) {}

// In tool handler:
var violations = validator.validate(input);
if (!violations.isEmpty()) {
    String msg = violations.stream()
            .map(v -> v.getPropertyPath() + ": " + v.getMessage())
            .collect(Collectors.joining("; "));
    return new CallToolResult(List.of(new TextContent("Validation error: " + msg)), true);
}
```

- Never trust client input — validate types, ranges, and string patterns before use.
- Return `isError=true` in `CallToolResult` for validation failures, not exceptions.

## Logging

MCP stdio transport uses stdin/stdout for protocol messages. **All application logs MUST go to stderr.**

```java
// SLF4J automatically writes to stderr when using spring-boot-starter (Logback default)
private static final Logger log = LoggerFactory.getLogger(DocumentTools.class);
log.info("Search query='{}' limit={} results={}", query, limit, results.size());
```

- Configure Logback: `<appender class="ch.qos.logback.core.ConsoleAppender"><target>System.err</target>`
- Never use `System.out.println` — it corrupts the JSON-RPC stream on stdout.
- Include correlation IDs in MDC for traceability: `MDC.put("requestId", exchange.requestId())`.

## Error Handling

```java
(exchange, args) -> {
    try {
        var result = service.process(args);
        return new CallToolResult(List.of(new TextContent(toJson(result))), false);
    } catch (IllegalArgumentException e) {
        log.warn("Invalid input: {}", e.getMessage());
        return new CallToolResult(List.of(new TextContent("Error: " + e.getMessage())), true);
    } catch (Exception e) {
        log.error("Tool execution failed", e);
        return new CallToolResult(
                List.of(new TextContent("Internal error. Check server logs.")), true);
    }
}
```

- Return `CallToolResult` with `isError=true` — never throw unhandled exceptions from tool handlers.
- For async tools, handle errors in `onErrorResume` to return error results instead of propagating.

## Testing

```java
// Unit test: invoke handler directly
@Test
void searchDocuments_validQuery_returnsResults() {
    var tools = new DocumentTools(mockSearchService);
    when(mockSearchService.semanticSearch("test", 10)).thenReturn(List.of(mockResult));
    var results = tools.searchDocuments("test", 10);
    assertThat(results).hasSize(1);
}

// Spring integration test: verify tool registration
@SpringBootTest
class McpToolIntegrationTest {
    @Autowired ToolCallbackProvider provider;

    @Test
    void allToolsRegistered() {
        var callbacks = provider.getToolCallbacks();
        assertThat(callbacks).extracting("name").contains("searchDocuments");
    }
}
```

- Test tool handlers as plain methods — no MCP transport needed for unit tests.
- Use `MockMvc` only if tools are also exposed as REST endpoints behind a gateway.
- Integration test: verify `ToolCallbackProvider` bean wiring and tool discovery.

## GraalVM Native Image

For `native-image` builds (fast cold start in containers):

- Add `spring-boot-starter-aot` and configure reflection hints for tool parameter records.
- Register `@RegisterReflectionForBinding` on all input/output record types.
- Test native build in CI: `mvn -Pnative spring-boot:build-image` — missing hints cause runtime `ClassNotFoundException`.

## Anti-Patterns

- ❌ Writing to `System.out` — corrupts MCP stdio JSON-RPC protocol stream
- ❌ Throwing exceptions from tool handlers instead of returning `isError=true` results
- ❌ Blocking the event loop in `McpServer.async()` tools — use `Schedulers.boundedElastic()`
- ❌ Missing input validation — lets malformed data reach service layer
- ❌ Hardcoding tool descriptions — keep in resource bundles or constants for i18n
- ❌ Fat tool methods (>50 lines) — extract business logic into service classes
- ❌ Using SSE transport for CLI tools — stdio is simpler and avoids port conflicts

## WAF Alignment

| Pillar | Practice |
|--------|----------|
| **Security** | Validate all tool inputs (Jakarta BV). Sanitize strings before DB/shell use. No secrets in tool responses. |
| **Reliability** | Return error results, never crash. Retry transient failures with backoff. Health probes on `/actuator/health`. |
| **Performance** | Use async server for I/O tools. Stream large results. Cache repeated lookups with Caffeine/Redis. |
| **Cost** | Right-size container (256MB heap for typical MCP server). Log at INFO — DEBUG only when troubleshooting. |
| **Operational Excellence** | Structured JSON logs to stderr. Correlation IDs via MDC. Version tools in `serverInfo`. |
| **Responsible AI** | Validate prompt content before forwarding to LLM. Redact PII from tool inputs/outputs in logs. |
