---
name: fai-mcp-kotlin-scaffold
description: |
  Scaffold Kotlin MCP servers with coroutines, typed tool definitions,
  and Ktor or Spring integration. Use when building MCP servers in Kotlin
  with idiomatic async patterns.
---

# Kotlin MCP Server Scaffold

Build MCP servers in Kotlin with coroutines and typed tool definitions.

## When to Use

- Building MCP servers with Kotlin coroutines
- Leveraging Kotlin's type safety for tool contracts
- Integrating with Ktor or Spring Boot

---

## Project Setup (Gradle)

```kotlin
// build.gradle.kts
dependencies {
    implementation("io.modelcontextprotocol:mcp-kotlin:0.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
}
```

## Tool Definition

```kotlin
import io.modelcontextprotocol.kotlin.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class SearchResult(val id: String, val title: String, val score: Double)

val searchTool = Tool(
    name = "search_documents",
    description = "Search knowledge base documents by query",
    parameters = listOf(
        Parameter("query", ParameterType.STRING, required = true,
                  description = "Search query text"),
        Parameter("top_k", ParameterType.NUMBER,
                  description = "Number of results to return"),
    )
)

suspend fun handleSearch(args: Map<String, Any?>): String {
    val query = args["query"] as String
    val topK = (args["top_k"] as? Number)?.toInt() ?: 5
    val results = searchService.search(query, topK)
    return Json.encodeToString(results)
}
```

## Server Setup

```kotlin
fun main() = runBlocking {
    val server = McpServer("my-mcp-server", "1.0.0")
    server.addTool(searchTool, ::handleSearch)
    server.serveStdio()
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Coroutine scope leak | Missing structured concurrency | Use coroutineScope or supervisorScope |
| Serialization error | Missing @Serializable | Add annotation to data classes |
| Gradle resolution fail | Wrong Kotlin version | Align kotlin-stdlib with plugin version |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Type all tool parameters | Agent understands expected inputs |
| Write descriptive tool docstrings | Agent matches tasks to tools |
| Validate inputs before processing | Prevent injection and crashes |
| Return structured JSON strings | Consistent parsing by consumers |
| Add error messages in results | Agent can report failures to user |
| Test tools independently | Verify behavior before server integration |

## MCP Transport Options

| Transport | Use Case | Config |
|-----------|----------|--------|
| stdio | VS Code Copilot, Claude Desktop | Default — no setup needed |
| SSE | Web clients, remote access | Add HTTP server endpoint |
| WebSocket | Real-time bidirectional | For streaming-heavy tools |

## Related Skills

- `fai-mcp-python-generator` — Python MCP with FastMCP
- `fai-mcp-typescript-generator` — TypeScript MCP with SDK
- `fai-mcp-csharp-scaffold` — C# MCP with ModelContextProtocol
