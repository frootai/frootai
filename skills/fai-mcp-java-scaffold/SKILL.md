---
name: fai-mcp-java-scaffold
description: |
  Scaffold Java MCP servers with Spring Boot integration, typed tool beans,
  and structured error handling. Use when building MCP servers in Java
  for enterprise AI agent tool access.
---

# Java MCP Server Scaffold

Build MCP servers in Java with Spring Boot and typed tool definitions.

## When to Use

- Building MCP servers for enterprise Java environments
- Integrating with existing Spring Boot applications
- Exposing Java services as AI agent tools

---

## Maven Dependencies

```xml
<dependency>
    <groupId>io.modelcontextprotocol</groupId>
    <artifactId>mcp-spring-boot-starter</artifactId>
    <version>0.9.0</version>
</dependency>
```

## Tool Definition

```java
import io.modelcontextprotocol.annotation.McpTool;
import io.modelcontextprotocol.annotation.McpParam;
import org.springframework.stereotype.Component;

@Component
public class SearchTools {

    @McpTool(name = "search_documents",
             description = "Search knowledge base documents by query")
    public String searchDocuments(
            @McpParam(name = "query", required = true,
                      description = "Search query text") String query,
            @McpParam(name = "top_k",
                      description = "Number of results") Integer topK) {
        if (topK == null) topK = 5;
        var results = searchService.search(query, topK);
        return objectMapper.writeValueAsString(results);
    }
}
```

## Application Config

```yaml
# application.yml
mcp:
  server:
    name: my-mcp-server
    version: 1.0.0
    transport: stdio
```

## Spring Boot Main

```java
@SpringBootApplication
public class McpServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(McpServerApplication.class, args);
    }
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tool not registered | Missing @Component | Add @Component to tool class |
| Serialization error | Complex return type | Return String (serialize manually) |
| Slow startup | Full Spring context | Use Spring Boot 3.x with AOT |
| Classpath conflict | Dependency version mismatch | Check BOM alignment |

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
