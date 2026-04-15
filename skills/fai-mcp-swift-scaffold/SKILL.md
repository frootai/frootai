---
name: fai-mcp-swift-scaffold
description: |
  Scaffold Swift MCP servers with structured concurrency, Codable tool
  definitions, and Swift Package Manager. Use when building MCP servers
  for Apple platforms or Swift-based services.
---

# Swift MCP Server Scaffold

Build MCP servers in Swift with structured concurrency and Codable types.

## When to Use

- Building MCP tools for macOS/iOS applications
- Exposing Swift service logic as AI agent tools
- Creating cross-platform MCP servers with SwiftPM

---

## Package.swift

```swift
// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "my-mcp-server",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(url: "https://github.com/anthropics/mcp-swift-sdk", from: "0.5.0"),
    ],
    targets: [
        .executableTarget(name: "McpServer", dependencies: [
            .product(name: "MCP", package: "mcp-swift-sdk"),
        ]),
    ]
)
```

## Tool Definition

```swift
import MCP

struct SearchArgs: Codable {
    let query: String
    let limit: Int?
}

struct SearchResult: Codable {
    let id: String
    let title: String
    let score: Double
}

let searchTool = Tool(
    name: "search_documents",
    description: "Search knowledge base documents by query",
    inputSchema: .object([
        "query": .string(description: "Search query"),
        "limit": .integer(description: "Max results"),
    ], required: ["query"])
) { (args: SearchArgs) async throws -> String in
    let results = try await searchService.search(args.query, limit: args.limit ?? 5)
    return try JSONEncoder().encode(results).utf8String
}
```

## Server Entry

```swift
@main
struct McpServerApp {
    static func main() async throws {
        let server = MCPServer(name: "my-mcp-server", version: "1.0.0")
        server.addTool(searchTool)
        try await server.serveStdio()
    }
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Build fails | Swift version mismatch | Require Swift 5.10+ in Package.swift |
| Codable decode error | Optional field missing | Use `let limit: Int?` with default |
| Async not available | Wrong platform target | Set .macOS(.v14) minimum |
| JSON encoding fails | Non-Codable type | Conform all types to Codable |

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
