---
description: "Kotlin MCP server development — coroutines, data classes, Ktor, and Gradle patterns."
applyTo: "**/*.kt"
waf:
  - "performance-efficiency"
  - "reliability"
---

# Kotlin MCP Server Development — FAI Standards

> Build MCP servers with `modelcontextprotocol/kotlin-sdk`, coroutines, kotlinx.serialization, and Ktor.

## Server Bootstrap

Use `Server` with `ServerOptions` — register tools, resources, and prompts via DSL builders:

```kotlin
import io.modelcontextprotocol.kotlin.sdk.Server
import io.modelcontextprotocol.kotlin.sdk.ServerOptions
import io.modelcontextprotocol.kotlin.sdk.Implementation
import io.modelcontextprotocol.kotlin.sdk.server.StdioServerTransport

fun main() = runBlocking {
    val server = Server(
        ServerOptions(
            capabilities = ServerCapabilities(tools = ToolCapabilities(), resources = ResourceCapabilities()),
        ),
        Implementation(name = "my-mcp-server", version = "1.0.0"),
    )
    // Register tools, resources, prompts here
    val transport = StdioServerTransport()
    server.connect(transport)
}
```

## Tool Registration

Define tools with `Tool` data class — use `inputSchema` for typed parameters, return `CallToolResult`:

```kotlin
import io.modelcontextprotocol.kotlin.sdk.Tool
import io.modelcontextprotocol.kotlin.sdk.CallToolResult
import io.modelcontextprotocol.kotlin.sdk.TextContent
import kotlinx.serialization.json.*

server.addTool(
    Tool(
        name = "search_documents",
        description = "Search indexed documents by query",
        inputSchema = Tool.Input(
            properties = buildJsonObject {
                putJsonObject("query") { put("type", "string"); put("description", "Search query") }
                putJsonObject("limit") { put("type", "integer"); put("default", 10) }
            },
            required = listOf("query"),
        ),
    ),
) { request ->
    val query = request.arguments["query"]?.jsonPrimitive?.content
        ?: return@addTool CallToolResult(content = listOf(TextContent("Missing query")), isError = true)
    val limit = request.arguments["limit"]?.jsonPrimitive?.intOrNull ?: 10
    val results = searchService.search(query, limit.coerceIn(1, 100))
    CallToolResult(content = listOf(TextContent(Json.encodeToString(results))))
}
```

## Resource Handlers

Expose resources via URI templates — return `ReadResourceResult` with MIME-typed content:

```kotlin
server.addResource(
    Resource(uri = "docs://{docId}", name = "Document", mimeType = "application/json"),
) { request ->
    val docId = request.uri.substringAfterLast("/")
    val doc = repository.findById(docId) ?: throw McpError(ErrorCode.InvalidRequest, "Not found: $docId")
    ReadResourceResult(contents = listOf(TextResourceContents(Json.encodeToString(doc), request.uri, "application/json")))
}
```

## Prompt Templates

Register reusable prompt templates — accept arguments, return `GetPromptResult` with message list:

```kotlin
server.addPrompt(
    Prompt(name = "summarize", description = "Summarize a document", arguments = listOf(
        PromptArgument(name = "content", description = "Text to summarize", required = true),
        PromptArgument(name = "style", description = "Brief or detailed", required = false),
    )),
) { request ->
    val content = request.arguments?.get("content") ?: error("content required")
    val style = request.arguments?.get("style") ?: "brief"
    GetPromptResult(messages = listOf(
        PromptMessage(Role.User, TextContent("Summarize ($style):\n\n$content")),
    ))
}
```

## Coroutines for Async Tool Execution

- All tool handlers are `suspend` functions — use structured concurrency with `coroutineScope`
- Fan out independent operations with `async` + `awaitAll`, never `GlobalScope.launch`
- Set timeouts via `withTimeout` — prevent runaway tool calls from blocking the server
- Use `Dispatchers.IO` for blocking I/O (database, HTTP), `Dispatchers.Default` for CPU

```kotlin
server.addTool(Tool(name = "parallel_search", description = "Search multiple indices", inputSchema = ...)) { request ->
    val results = coroutineScope {
        val indices = listOf("docs", "tickets", "wiki")
        indices.map { idx -> async(Dispatchers.IO) { searchIndex(idx, query) } }.awaitAll()
    }
    CallToolResult(content = listOf(TextContent(Json.encodeToString(results.flatten()))))
}
```

## kotlinx.serialization

- Annotate all data transfer objects with `@Serializable` — never use reflection-based parsers
- Configure `Json { ignoreUnknownKeys = true; encodeDefaults = false }` for forward compatibility
- Use `@SerialName` for wire-format names that differ from Kotlin property names
- Sealed classes + `@SerialName` discriminator for polymorphic tool results

```kotlin
@Serializable
data class SearchResult(
    @SerialName("doc_id") val docId: String,
    val score: Double,
    val snippet: String,
)
```

## Ktor Integration

For HTTP/SSE transport instead of stdio — embed MCP in a Ktor server:

```kotlin
fun Application.mcpModule() {
    val server = Server(ServerOptions(...), Implementation("ktor-mcp", "1.0.0"))
    // register tools...
    routing {
        sse("/mcp") {
            val transport = SseServerTransport("/mcp/message", this)
            server.connect(transport)
        }
    }
}
```

- Use Ktor's `ContentNegotiation` with `kotlinx.serialization` — avoid Jackson duplication
- Structured logging via `io.ktor.server.plugins.calllogging.CallLogging` with correlation IDs
- Health endpoint: `get("/health") { call.respond(mapOf("status" to "ok")) }`

## Input Validation

- Validate ALL `request.arguments` before use — check nullability, type, and range
- Use `coerceIn` for numeric bounds, `Regex` for string patterns
- Return `CallToolResult(isError = true)` with descriptive message — never throw untyped exceptions
- Sanitize string inputs destined for database queries or shell commands

## Error Handling

- Wrap tool bodies in `runCatching` — map failures to `CallToolResult(isError = true)`
- Use `McpError(ErrorCode.InvalidRequest, message)` for protocol-level errors
- Log exceptions with structured fields: `logger.error(e) { "tool=$toolName query=$query" }`
- Never expose stack traces or internal paths in error responses

## Structured Logging

- Use `io.github.oshai.kotlinlogging.KotlinLogging` (kotlin-logging) — SLF4J facade
- JSON format via Logback `LogstashEncoder` — machine-parseable in production
- Include `correlationId`, `toolName`, `durationMs` in every log entry
- Log at INFO for tool invocations, WARN for validation failures, ERROR for exceptions

## Testing

- **Unit tests**: Kotest or JUnit5 — test tool handler logic with mock services via `mockk`
- **Integration tests**: Spin up `Server` + `InMemoryTransport`, send `CallToolRequest`, assert `CallToolResult`
- **Contract tests**: Validate `inputSchema` against sample payloads with `kotlinx.serialization`
- **Coverage**: Kover (JetBrains) ≥ 80% line coverage on tool handlers

```kotlin
@Test
fun `search_documents returns results`() = runTest {
    val server = buildTestServer()   // registers tools with mock SearchService
    val transport = InMemoryTransport()
    server.connect(transport)
    val result = transport.callTool("search_documents", buildJsonObject { put("query", "kotlin") })
    assertFalse(result.isError ?: false)
    val text = (result.content.first() as TextContent).text
    assertTrue(text.contains("kotlin"))
}
```

## GraalVM Native Considerations

- Register all `@Serializable` classes in `reflect-config.json` or use `@RegisterForReflection`
- Avoid `Class.forName` / `ServiceLoader` — use compile-time DI (Koin, manual wiring)
- Test native image in CI: `./gradlew nativeCompile && ./build/native/nativeCompile/server --help`
- Coroutine-based servers work in native but require `--initialize-at-run-time=kotlinx.coroutines`

## Anti-Patterns

- ❌ Using `GlobalScope.launch` — leaks coroutines, breaks structured concurrency
- ❌ Blocking the event loop with `Thread.sleep` or synchronous I/O in `Dispatchers.Default`
- ❌ Returning raw exception `.message` in `CallToolResult` — leaks internals
- ❌ Skipping `inputSchema` validation — trusting client-supplied JSON blindly
- ❌ Using Gson/Jackson when kotlinx.serialization is available — reflection overhead + native issues
- ❌ Registering tools with duplicate names — server silently overwrites, causes routing bugs
- ❌ Hardcoding secrets in `application.conf` — use environment variables or vault integration
- ❌ Missing `Content-Type` on SSE responses — breaks MCP client transport negotiation

## WAF Alignment

| Pillar | Kotlin MCP Implementation |
|--------|--------------------------|
| **Security** | Validate all tool inputs at boundary; sanitize before DB/shell; no secrets in code; TLS for SSE transport |
| **Reliability** | Structured concurrency with `supervisorScope`; `withTimeout` on tool calls; circuit breaker via Resilience4j |
| **Cost Optimization** | Coroutine pools share threads (no thread-per-request); cache tool results with Caffeine TTL; batch DB reads |
| **Operational Excellence** | JSON structured logging with correlation IDs; `/health` endpoint; Gradle build scans in CI |
| **Performance Efficiency** | `Dispatchers.IO` for blocking calls; `Flow` for streaming results; connection pooling via HikariCP |
| **Responsible AI** | Content safety checks before returning LLM-generated tool results; PII redaction in logs |
