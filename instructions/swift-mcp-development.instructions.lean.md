---
description: "Swift MCP server development — actors, Codable, async/await patterns."
applyTo: "**/*.swift"
waf:
  - "performance-efficiency"
  - "reliability"
---

# Swift MCP Server Development — FAI Standards

## Swift Package Manager Setup

```swift
// Package.swift
let package = Package(
    name: "MyMCPServer",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(url: "https://github.com/modelcontextprotocol/swift-sdk.git", from: "0.7.0")
    ],
    targets: [
        .executableTarget(name: "MyMCPServer", dependencies: [
            .product(name: "MCP", package: "swift-sdk")
        ]),
        .testTarget(name: "MyMCPServerTests", dependencies: ["MyMCPServer"])
    ]
)
```

## Server Actor & Stdio Transport

```swift
import MCP
import Foundation

@main
struct MyMCPServer {
    static func main() async throws {
        let server = Server(
            name: "my-mcp-server",
            version: "1.0.0",
            capabilities: .init(tools: .init(), resources: .init(), prompts: .init())
        )
        registerTools(on: server)
        registerResources(on: server)
        registerPrompts(on: server)

        let transport = StdioTransport()
        try await server.start(transport: transport)
        // Block until transport closes (graceful shutdown via SIGINT/SIGTERM)
        await server.waitUntilCompleted()
    }
}
```

## Tool Registration with Tool Protocol

```swift
import MCP

func registerTools(on server: Server) {
    server.withMethodHandler(ListTools.self) { _ in
        .init(tools: [
            Tool(name: "search_docs", description: "Search documentation by query",
                 inputSchema: .object([
                     "query": .string(description: "Search query"),
                     "limit": .integer(description: "Max results (1-50)")
                 ], required: ["query"]))
        ])
    }

    server.withMethodHandler(CallTool.self) { request in
        guard let args = request.params.arguments else {
            throw MCPError.invalidParams("Missing arguments")
        }
        switch request.params.name {
        case "search_docs":
            return try await handleSearchDocs(args)
        default:
            throw MCPError.methodNotFound("Unknown tool: \(request.params.name)")
        }
    }
}
```

## Async Handler with Input Validation & Codable

```swift
struct SearchQuery: Codable {
    let query: String
    let limit: Int?
}

struct SearchResult: Codable {
    let title: String
    let snippet: String
    let score: Double
}

func handleSearchDocs(_ args: [String: JSONValue]) async throws -> CallTool.Result {
    // Decode with Codable — type-safe deserialization
    let data = try JSONSerialization.data(withJSONObject: args.jsonObject)
    let input = try JSONDecoder().decode(SearchQuery.self, from: data)

    // Validate at system boundary
    guard !input.query.trimmingCharacters(in: .whitespaces).isEmpty else {
        throw MCPError.invalidParams("query must not be empty")
    }
    let safeLimit = min(max(input.limit ?? 10, 1), 50)

    let results = try await searchIndex(query: input.query, limit: safeLimit)
    let encoded = try JSONEncoder().encode(results)
    return .init(content: [.text(String(data: encoded, encoding: .utf8)!)])
}
```

## Resource Handlers

```swift
func registerResources(on server: Server) {
    server.withMethodHandler(ListResources.self) { _ in
        .init(resources: [
            Resource(uri: "config://settings", name: "Server Settings",
                     mimeType: "application/json")
        ])
    }

    server.withMethodHandler(ReadResource.self) { request in
        switch request.params.uri {
        case "config://settings":
            let settings = try loadSettings()
            let json = try JSONEncoder().encode(settings)
            return .init(contents: [
                .text(TextResourceContents(uri: request.params.uri,
                      text: String(data: json, encoding: .utf8)!,
                      mimeType: "application/json"))
            ])
        default:
            throw MCPError.invalidParams("Unknown resource: \(request.params.uri)")
        }
    }
}
```

## Prompt Templates

```swift
func registerPrompts(on server: Server) {
    server.withMethodHandler(ListPrompts.self) { _ in
        .init(prompts: [
            Prompt(name: "summarize", description: "Summarize a document",
                   arguments: [.init(name: "content", description: "Text to summarize", required: true)])
        ])
    }

    server.withMethodHandler(GetPrompt.self) { request in
        let content = request.params.arguments?["content"] ?? ""
        return .init(messages: [
            .init(role: .user, content: .text("Summarize concisely:\n\n\(content)"))
        ])
    }
}
```

## Structured Logging (os.Logger → stderr)

```swift
import os

private let logger = Logger(subsystem: "com.myorg.mcpserver", category: "tools")

func searchIndex(query: String, limit: Int) async throws -> [SearchResult] {
    logger.info("search_docs called",
                metadata: ["query": "\(query, privacy: .public)", "limit": "\(limit)"])
    let start = ContinuousClock.now
    defer {
        let elapsed = ContinuousClock.now - start
        logger.info("search_docs completed in \(elapsed)")
    }
    // Never log PII, secrets, or full user prompts
    // os.Logger writes to stderr — does not interfere with stdio transport on stdout
    return try await performSearch(query, limit: limit)
}
```

## Error Handling — MCPError + Result

```swift
enum ServerError: Error, LocalizedError {
    case indexUnavailable(String)
    case timeout(seconds: Int)

    var errorDescription: String? {
        switch self {
        case .indexUnavailable(let name): return "Index '\(name)' is unavailable"
        case .timeout(let s): return "Operation timed out after \(s)s"
        }
    }
}

// Convert domain errors → MCPError at the boundary
func safeTool(_ block: @Sendable () async throws -> CallTool.Result) async -> CallTool.Result {
    do {
        return try await block()
    } catch let error as MCPError {
        return .init(content: [.text(error.localizedDescription)], isError: true)
    } catch {
        logger.error("Unhandled: \(error.localizedDescription)")
        return .init(content: [.text("Internal server error")], isError: true)
    }
}
```

## Graceful Shutdown (Signal Handling)

```swift
import Foundation

func installSignalHandlers(server: Server) {
    let source = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
    signal(SIGINT, SIG_IGN)  // Let DispatchSource handle it
    source.setEventHandler {
        logger.info("SIGINT received — shutting down")
        Task { await server.shutdown() }
    }
    source.resume()
}
```

## Testing with XCTest

```swift
import XCTest
@testable import MyMCPServer

final class SearchToolTests: XCTestCase {
    func testValidQuery() async throws {
        let args: [String: JSONValue] = ["query": .string("swift concurrency"), "limit": .integer(5)]
        let result = try await handleSearchDocs(args)
        XCTAssertFalse(result.isError ?? false)
        XCTAssertFalse(result.content.isEmpty)
    }

    func testEmptyQueryRejects() async {
        let args: [String: JSONValue] = ["query": .string("   ")]
        do {
            _ = try await handleSearchDocs(args)
            XCTFail("Expected invalidParams error")
        } catch let error as MCPError {
            XCTAssertTrue(error.localizedDescription.contains("must not be empty"))
        }
    }

    func testLimitClamping() async throws {
        let args: [String: JSONValue] = ["query": .string("test"), "limit": .integer(999)]
        let result = try await handleSearchDocs(args)
        // Verify limit was clamped to 50 — no unbounded queries
        XCTAssertFalse(result.isError ?? false)
    }
}
```

## Anti-Patterns

- ❌ `print()` for logging — pollutes stdout stdio transport; use `os.Logger` (stderr)
- ❌ Blocking `DispatchSemaphore.wait()` inside async contexts — causes deadlocks
- ❌ `try!` / `fatalError` in handlers — crashes server on bad input; return `MCPError`
- ❌ Unstructured `[String: Any]` for tool args — use `Codable` structs for type safety
- ❌ Skipping input validation — clamp ranges, check emptiness, reject oversized payloads
- ❌ Logging secrets or PII even at `.debug` level
- ❌ `@Sendable` violations — all closures crossing actor boundaries must be `Sendable`

## WAF Alignment

| Pillar | Swift MCP Practices |
|--------|-------------------|
| **Performance** | `async/await` throughout, `TaskGroup` for parallel ops, `actor` isolation avoids locks, streaming via `AsyncSequence` |
| **Reliability** | `MCPError` for typed failures, `defer` for cleanup, `DispatchSource` signal handling, structured concurrency cancellation |
| **Security** | `Codable` input validation at boundary, `os.Logger` with `.private` for PII, no secrets in logs, `Sendable` enforcement |
| **Cost** | Lightweight stdio transport (no HTTP overhead), lazy resource loading, `TaskGroup` batch ops reduce round trips |
| **Ops Excellence** | `os.Logger` subsystem/category taxonomy, `ContinuousClock` latency tracking, XCTest + `swift test` in CI |
| **Responsible AI** | Validate/sanitize all tool inputs before LLM forwarding, content length limits, structured error responses |
