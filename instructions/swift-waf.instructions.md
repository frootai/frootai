---
description: "Swift coding standards — actors for concurrency, Codable, async/await, SwiftUI, and value types over reference types."
applyTo: "**/*.swift"
waf:
  - "performance-efficiency"
  - "reliability"
---

# Swift — FAI Standards

## Swift 5.9+ Language Features

Use parameter packs for variadic generics instead of overloads:

```swift
func evaluate<each T: Encodable>(_ value: repeat each T) -> [Data] {
    var results: [Data] = []
    repeat results.append(try! JSONEncoder().encode(each value))
    return results
}
```

Use `consuming` and `borrowing` ownership modifiers to control copies:

```swift
struct LargePayload {
    var buffer: [UInt8]
    
    consuming func finalize() -> Data {
        Data(buffer) // ownership transferred, no copy
    }
    
    borrowing func checksum() -> UInt32 {
        buffer.reduce(0) { $0 &+ UInt32($1) }
    }
}
```

Use attached macros for boilerplate elimination (e.g., `@Observable`, custom macros via `swift-syntax`).

## Protocol-Oriented Programming

Prefer protocols with default extensions over class inheritance:

```swift
protocol RetryableRequest {
    associatedtype Response: Decodable
    var maxRetries: Int { get }
    func execute() async throws -> Response
}

extension RetryableRequest {
    var maxRetries: Int { 3 }
    
    func executeWithRetry() async throws -> Response {
        for attempt in 1...maxRetries {
            do { return try await execute() }
            catch where attempt < maxRetries { continue }
        }
        return try await execute()
    }
}
```

## Value Types vs Reference Types

- Default to `struct` — copy semantics prevent shared mutable state bugs.
- Use `class` only for identity semantics, inheritance requirements, or Objective-C interop.
- Use copy-on-write for large value types via internal reference storage.

## Async/Await and Structured Concurrency

Use `TaskGroup` for parallel fan-out with bounded concurrency:

```swift
func fetchAll(ids: [String]) async throws -> [Item] {
    try await withThrowingTaskGroup(of: Item.self) { group in
        for id in ids {
            group.addTask { try await api.fetch(id) }
        }
        return try await group.reduce(into: []) { $0.append($1) }
    }
}
```

Never use `Task.detached` unless you explicitly need to escape the actor context. Prefer structured `async let` for small fixed concurrency:

```swift
async let profile = fetchProfile(userId)
async let orders = fetchOrders(userId)
let (p, o) = try await (profile, orders)
```

## Sendable and Actor Isolation

Mark types crossing concurrency boundaries as `Sendable`. Use actors for mutable shared state:

```swift
actor RateLimiter: Sendable {
    private var tokens: Int
    
    init(maxTokens: Int) { self.tokens = maxTokens }
    
    func acquire() -> Bool {
        guard tokens > 0 else { return false }
        tokens -= 1
        return true
    }
}
```

Enable strict concurrency checking: `swiftSettings: [.enableExperimentalFeature("StrictConcurrency")]`.

## SwiftUI State Management

Use `@Observable` (Observation framework) instead of `ObservableObject`:

```swift
@Observable
final class AppState {
    var items: [Item] = []
    var isLoading = false
    var errorMessage: String?
}

struct ContentView: View {
    @State private var state = AppState()
    @Environment(\.networkService) private var network
    
    var body: some View {
        List(state.items) { item in ItemRow(item: item) }
            .overlay { if state.isLoading { ProgressView() } }
            .task { await loadItems() }
    }
}
```

Inject dependencies through `@Environment` custom keys, not singletons.

## Codable and JSON

Leverage synthesized conformance. Customize only when API keys differ:

```swift
struct APIResponse: Codable, Sendable {
    let requestId: String
    let createdAt: Date
    
    enum CodingKeys: String, CodingKey {
        case requestId = "request_id"
        case createdAt = "created_at"
    }
}

let decoder = JSONDecoder()
decoder.dateDecodingStrategy = .iso8601
```

## Error Handling

Use typed throws (Swift 6) when error types are known. Use `Result` for callback-based APIs:

```swift
enum ServiceError: Error, LocalizedError {
    case notFound(id: String)
    case rateLimited(retryAfter: TimeInterval)
    
    var errorDescription: String? {
        switch self {
        case .notFound(let id): "Resource \(id) not found"
        case .rateLimited(let s): "Rate limited, retry after \(s)s"
        }
    }
}

func load() async throws(ServiceError) -> Item { ... }
```

## Swift Package Manager

Structure packages with clear target boundaries:

```swift
// Package.swift
let package = Package(
    name: "MyService",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [.library(name: "MyService", targets: ["MyService"])],
    dependencies: [
        .package(url: "https://github.com/apple/swift-log.git", from: "1.5.0"),
    ],
    targets: [
        .target(name: "MyService", dependencies: [.product(name: "Logging", package: "swift-log")]),
        .testTarget(name: "MyServiceTests", dependencies: ["MyService"]),
    ]
)
```

## Testing

Use Swift Testing framework (`import Testing`) for new code:

```swift
import Testing
@testable import MyService

@Suite("RateLimiter")
struct RateLimiterTests {
    @Test("acquires tokens until depleted")
    func tokenDepletion() async {
        let limiter = RateLimiter(maxTokens: 2)
        #expect(await limiter.acquire() == true)
        #expect(await limiter.acquire() == true)
        #expect(await limiter.acquire() == false)
    }
    
    @Test("handles concurrent access", arguments: [10, 50, 100])
    func concurrentAccess(count: Int) async { ... }
}
```

Use XCTest for existing suites and UI testing. Prefer `#expect` over `XCTAssert`.

## Access Control, Linting, Documentation

- Default is `internal` — expose `public` only for module API surfaces.
- Use `package` access for multi-target packages sharing internals.
- Enforce SwiftLint with `.swiftlint.yml`; key rules: `force_cast`, `force_unwrapping`, `cyclomatic_complexity`.
- Document public API with `///` and DocC syntax:

```swift
/// Fetches items matching the query.
/// - Parameter query: Search term (minimum 2 characters).
/// - Returns: Matching items sorted by relevance.
/// - Throws: ``ServiceError/rateLimited`` when quota exceeded.
func search(query: String) async throws -> [Item] { ... }
```

## Anti-Patterns

- **Force unwrapping (`!`)** — use `guard let` or nil-coalescing. Reserve `!` for `@IBOutlet` only.
- **Massive view controllers / views** — extract into composable child views and view models.
- **Retain cycles** — use `[weak self]` in closures capturing `self` on reference types.
- **Unstructured `Task { }` everywhere** — prefer `.task` modifier in SwiftUI, `TaskGroup` in services.
- **Stringly-typed APIs** — use enums with associated values instead of raw strings.
- **Blocking the main actor** — offload CPU work with `Task.detached` or custom executors.

## WAF Alignment

| Pillar | Practice |
|--------|----------|
| Performance Efficiency | Value types reduce heap allocations; `TaskGroup` parallelizes I/O; `consuming` avoids copies |
| Reliability | Typed throws enforce exhaustive error handling; structured concurrency prevents leaked tasks |
| Security | `Sendable` eliminates data races; actor isolation protects mutable state; avoid force unwraps |
| Cost Optimization | Lazy sequences defer computation; `async let` avoids redundant fetches |
| Operational Excellence | SwiftLint CI gates; DocC generates API docs; Swift Package Manager reproducible builds |
| Responsible AI | Validate and sanitize all user inputs before LLM calls; log prompt/response pairs for audit |
