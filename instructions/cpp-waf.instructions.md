---
description: "C++ coding standards — modern C++20/23, RAII, smart pointers, and safe concurrency patterns."
applyTo: "**/*.cpp, **/*.h, **/*.hpp"
waf:
  - "security"
  - "performance-efficiency"
  - "reliability"
---

# C++ — FAI Standards

## Ownership & Lifetime

- Every heap allocation must have exactly one owner via `std::unique_ptr` — default choice for ownership
- Use `std::shared_ptr` only when true shared ownership is proven necessary (ref-counted graphs, caches)
- Pass non-owning access as `T&`, `const T&`, or `std::span<T>` — never raw `T*` for owned memory
- Prefer stack allocation and value semantics — heap-allocate only when polymorphism or size demands it
- Use `std::make_unique` / `std::make_shared` — never `new` / `delete` directly

```cpp
// ✅ Preferred: RAII with unique_ptr
auto conn = std::make_unique<DbConnection>(config.connection_string);
conn->execute(query);
// Automatically closed and freed at scope exit

// ❌ Avoided: manual new/delete
DbConnection* conn = new DbConnection(config.connection_string);
conn->execute(query);
delete conn; // Leak if execute() throws
```

## Move Semantics & Value Categories

- Implement move constructors and move-assignment for resource-holding types
- Mark move constructors and move-assignment `noexcept` — enables `std::vector` optimizations
- Use `std::move` only on values you no longer need — never on `const` objects or forwarding references
- Use `std::forward<T>` in templates for perfect forwarding — never `std::move` in that context

```cpp
class Pipeline {
  std::vector<Stage> stages_;
  std::unique_ptr<Executor> executor_;
public:
  Pipeline(Pipeline&& other) noexcept = default;
  Pipeline& operator=(Pipeline&& other) noexcept = default;
  Pipeline(const Pipeline&) = delete; // Expensive — force explicit clone()

  void add_stage(Stage stage) { stages_.push_back(std::move(stage)); }
};
```

## Compile-Time Computation

- Use `constexpr` for any function computable at compile time — lookup tables, hash seeds, config defaults
- Use `consteval` for values that must be compile-time (magic numbers, version strings)
- Prefer `static_assert` over runtime checks for invariants known at compile time
- Use `if constexpr` for branch elimination in templates instead of SFINAE or tag dispatch

```cpp
consteval int api_version() { return 3; }
static_assert(api_version() >= 2, "Minimum API v2 required");

template<typename T>
auto serialize(const T& val) {
  if constexpr (std::is_arithmetic_v<T>) return std::to_string(val);
  else if constexpr (requires { val.to_json(); }) return val.to_json();
  else static_assert(false, "No serializer for this type");
}
```

## Concepts & Constraints

- Define concepts for template interfaces — replaces SFINAE and `enable_if`
- Name concepts as adjectives or noun phrases: `Hashable`, `Serializable`, `RangeOf<int>`
- Constrain `auto` parameters in lambdas and abbreviated function templates

```cpp
template<typename T>
concept Retryable = requires(T op) {
  { op() } -> std::same_as<std::expected<typename T::value_type, std::error_code>>;
  { op.max_retries() } -> std::convertible_to<int>;
};

auto execute_with_retry(Retryable auto&& operation) {
  for (int i = 0; i <= operation.max_retries(); ++i) {
    if (auto result = operation(); result.has_value()) return result;
  }
  return std::unexpected(std::make_error_code(std::errc::timed_out));
}
```

## Error Handling

- Use `std::expected<T, E>` (C++23) for recoverable errors — no exceptions on expected failure paths
- Reserve exceptions for truly exceptional/unrecoverable situations (corrupt state, OOM, logic bugs)
- Use `std::error_code` or domain-specific error enums as the error type in `std::expected`
- Never throw in destructors, move operations, or `noexcept`-marked functions
- Use `[[nodiscard]]` on all functions returning error states to prevent silent discard

```cpp
[[nodiscard]] std::expected<Response, ApiError> call_endpoint(std::string_view url) {
  auto conn = connect(url);
  if (!conn) return std::unexpected(ApiError::connection_failed);
  auto data = conn->read_all();
  if (data.empty()) return std::unexpected(ApiError::empty_response);
  return parse_response(data);
}
```

## Safe Concurrency

- Use `std::jthread` over `std::thread` — automatic join on destruction, cooperative cancellation via `stop_token`
- Protect shared state with `std::mutex` + `std::scoped_lock` — never manual `lock()`/`unlock()`
- Prefer `std::atomic<T>` for simple shared counters/flags — avoid mutex overhead
- Use `std::latch`, `std::barrier`, `std::counting_semaphore` for synchronization over condition variables
- Never hold a lock while calling user-provided callbacks or performing I/O

```cpp
std::atomic<int> processed{0};
std::vector<std::jthread> workers;
for (int i = 0; i < num_threads; ++i) {
  workers.emplace_back([&](std::stop_token st) {
    while (!st.stop_requested()) {
      if (auto task = queue.try_pop()) {
        task->run();
        processed.fetch_add(1, std::memory_order_relaxed);
      }
    }
  });
} // All jthreads auto-join here
```

## Views & Non-Owning References

- Use `std::string_view` for read-only string parameters — never `const std::string&` for non-owning
- Use `std::span<T>` for contiguous buffer parameters — replaces `(T* ptr, size_t len)` pairs
- Never return `string_view` or `span` to a local — lifetime must outlive the view
- Use ranges and views (`std::views::filter`, `std::views::transform`) for lazy pipeline composition

## Coroutines

- Use `co_await` / `co_yield` for async I/O and generator patterns — avoid callback chains
- Define clear `promise_type` contracts — or use library types (`std::generator` in C++23)
- Coroutine frames are heap-allocated — avoid coroutines in tight inner loops

## Anti-Patterns

- ❌ Raw `new`/`delete` — use smart pointers or containers
- ❌ C-style casts `(int)x` — use `static_cast`, `dynamic_cast`, `std::bit_cast`
- ❌ `reinterpret_cast` without documented justification and `static_assert` on sizes
- ❌ `#define` macros for constants or functions — use `constexpr` / `consteval` / templates
- ❌ `using namespace std;` in headers — pollutes every includer's namespace
- ❌ `std::shared_ptr` as default — proves shared ownership or use `unique_ptr`
- ❌ Catching exceptions by value `catch (MyError e)` — always catch by `const&`
- ❌ `std::thread` without joining or detaching — undefined behavior on destruction
- ❌ `volatile` for concurrency — it does not provide atomicity; use `std::atomic`
- ❌ Returning raw pointers from factory functions — return `unique_ptr` for clarity of ownership
- ❌ `std::endl` in hot paths — use `'\n'` to avoid unnecessary flushing
- ❌ Out-parameters via `T*` — return `std::optional<T>`, `std::expected<T,E>`, or structured bindings

## WAF Alignment

| Pillar | C++ Practice |
|--------|-------------|
| **Security** | Bounds-checked access (`std::span`, `.at()`), no raw pointer arithmetic, sanitizer flags (`-fsanitize=address,undefined`) in CI, hardened allocator options |
| **Reliability** | RAII for all resources (files, locks, sockets), `noexcept` move ops, `std::expected` error paths, `std::jthread` auto-join, `static_assert` for compile-time invariants |
| **Performance** | `constexpr`/`consteval` compile-time computation, move semantics to eliminate copies, `std::span`/`string_view` zero-copy views, cache-friendly data layout (SoA over AoS), `std::atomic` relaxed ordering where safe |
| **Cost Optimization** | Minimize heap allocations (SSO, SBO, stack allocators), avoid `shared_ptr` ref-count overhead, use `reserve()` to prevent vector reallocations, profile-guided optimization (`-fprofile-use`) |
| **Operational Excellence** | Compiler warnings as errors (`-Wall -Wextra -Werror`), clang-tidy + clang-format in CI, sanitizers in debug builds, `[[nodiscard]]` on error-returning functions |
| **Responsible AI** | Input validation on all external data boundaries, size limits on buffers to prevent resource exhaustion, deterministic floating-point (`-ffp-contract=off`) for reproducible AI inference |
