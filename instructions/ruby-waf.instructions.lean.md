---
description: "Ruby coding standards — Ruby 3.3+, RuboCop enforcement, Ractor patterns, and Rails conventions."
applyTo: "**/*.rb"
waf:
  - "reliability"
  - "operational-excellence"
---

# Ruby — FAI Standards

## Ruby 3.x Language Features

### Pattern Matching
```ruby
# Use case/in for structured data decomposition
case response
in { status: 200, body: { data: Array => items } }
  process_items(items)
in { status: 429, headers: { "Retry-After" => delay } }
  sleep(delay.to_i)
in { status: (500..) }
  raise ServiceUnavailableError, "upstream returned #{response[:status]}"
end

# Find pattern for collection search
case users
in [*, { role: "admin", active: true } => admin, *]
  notify_admin(admin)
end
```

### Ractors for CPU-Bound Parallelism
```ruby
# Ractors share nothing — ideal for parallel embedding generation
workers = 4.times.map do
  Ractor.new do
    loop do
      chunk = Ractor.receive
      Ractor.yield compute_embedding(chunk)
    end
  end
end
chunks.each_with_index { |c, i| workers[i % workers.size].send(c) }
results = workers.map(&:take)
```

### Fiber Scheduler for IO-Bound Concurrency
```ruby
# Non-blocking IO via Fiber.scheduler — no threads needed
require "async"
Async do |task|
  responses = endpoints.map do |url|
    task.async { Net::HTTP.get(URI(url)) }
  end
  responses.map(&:wait)
end
```

## Frozen Strings and Immutability
- Add `# frozen_string_literal: true` to every `.rb` file — reduces allocations, catches mutation bugs
- Use `Struct` (frozen) or `Data.define` (Ruby 3.2+) for value objects:
```ruby
# Data.define — immutable, pattern-matchable, no boilerplate
Embedding = Data.define(:vector, :model, :dimensions)
embedding = Embedding.new(vector: [0.1, 0.2], model: "ada-002", dimensions: 1536)
```

## Method Visibility and Design
- Default to `private` — expose only the public contract
- `protected` only for same-hierarchy comparisons (`<=>`, `==`)
- Prefer keyword arguments for methods with 2+ params:
```ruby
def search(query:, top_k: 10, min_score: 0.7, rerank: false)
  validate_query!(query)
  results = index.similarity_search(query, limit: top_k)
  results.select { |r| r.score >= min_score }
end
```

## Collections and Lazy Evaluation
```ruby
# Lazy for unbounded/large streams — avoids materializing full array
File.open("embeddings.jsonl")
    .each_line
    .lazy
    .map { |line| JSON.parse(line, symbolize_names: true) }
    .select { |doc| doc[:score] > 0.8 }
    .first(100)

# Enumerable tally, filter_map, each_with_object over inject
word_freq = tokens.tally
valid_ids = records.filter_map { |r| r.id if r.active? }
```

## Exception Hierarchy
- Rescue `StandardError` subclasses — never bare `rescue Exception`
- Define domain errors under a namespace module:
```ruby
module AiService
  class Error < StandardError; end
  class RateLimitError < Error; end          # retry with backoff
  class ContentFilteredError < Error; end    # log + fallback
  class TokenBudgetExceeded < Error; end     # truncate and retry
end

begin
  complete(prompt)
rescue AiService::RateLimitError => e
  sleep([e.retry_after, 60].min)
  retry if (attempts += 1) <= 3
rescue AiService::ContentFilteredError => e
  logger.warn("content_filtered", prompt_hash: Digest::SHA256.hexdigest(prompt))
  FALLBACK_RESPONSE
end
```

## RuboCop Configuration
```yaml
# .rubocop.yml — enforce consistency, disable noise
require:
  - rubocop-performance
  - rubocop-minitest        # or rubocop-rspec
AllCops:
  TargetRubyVersion: 3.3
  NewCops: enable
  SuggestExtensions: false
Metrics/MethodLength:
  Max: 25
Metrics/AbcSize:
  Max: 20
Style/FrozenStringLiteralComment:
  Enabled: true
  EnforcedStyle: always
Style/Documentation:
  Enabled: false            # rely on YARD instead
```

## Type Checking (Sorbet / RBS)
- Use RBS signatures in `sig/` for stdlib and gem types
- Sorbet `typed: strict` for critical business logic; `typed: true` elsewhere
- `tapioca` to generate RBI files for gems automatically
- Run `srb tc` in CI — treat type errors as build failures

## Bundler and Dependencies
- Pin exact versions in `Gemfile.lock` — commit it always
- Group gems: `:development`, `:test`, `:production`
- `bundle audit check --update` in CI — fail on known CVEs
- Prefer `require: false` for gems loaded conditionally

## Testing (Minitest / RSpec)
```ruby
# Minitest — fast, stdlib-included, assertion-based
class EmbeddingServiceTest < Minitest::Test
  def test_returns_vector_with_expected_dimensions
    stub_request(:post, ENDPOINT).to_return(body: fixture("embedding.json"))
    result = EmbeddingService.new(config).embed("hello")
    assert_equal 1536, result.dimensions
    assert_in_delta 0.0, result.vector.sum, 0.1
  end
end
```
- Mock external HTTP with `webmock` or `vcr` — never hit real APIs in tests
- `SimpleCov` with 80%+ line coverage enforced in CI
- `mutant` for mutation testing on critical ranking/scoring logic

## Metaprogramming Guardrails
- Prefer `define_method` over `method_missing` — explicit, discoverable, faster
- When `method_missing` is truly needed, always define `respond_to_missing?`
- Never use `eval`/`class_eval` with untrusted input — prompt injection vector
- Limit `send` to private method dispatch — never with user-supplied method names

## Zeitwerk Autoloading
- Follow file/class naming conventions strictly: `ai_service.rb` → `AiService`
- One class/module per file — Zeitwerk enforces this
- Use `loader.collapse` for flattening deep namespaces, not custom inflections

## Debugging
- Use the `debug` gem (Ruby 3.1+ bundled) — `binding.break` over `binding.pry`
- IRB 1.6+ supports multi-line editing, autocomplete, `show_source`
- `ObjectSpace.count_objects` for memory leak investigation
- `Ractor.shareable?(obj)` to verify thread safety

## Anti-Patterns
- ❌ Bare `rescue => e` without specifying error class — catches too broadly
- ❌ `method_missing` without `respond_to_missing?` — breaks introspection
- ❌ Mutable default arguments: `def foo(list = [])` — shared across calls
- ❌ `eval(user_input)` or `send(params[:method])` — arbitrary code execution
- ❌ Monkey-patching core classes in production — use Refinements instead
- ❌ `require` inside hot loops — use Zeitwerk eager loading
- ❌ `Thread.new` without join/exception handling — silent failures
- ❌ Skipping `frozen_string_literal` pragma — unnecessary allocations

## WAF Alignment

| Pillar | Ruby Practice |
| --- | --- |
| **Reliability** | Custom error hierarchy with retry logic, Fiber scheduler for non-blocking IO, health check via Rack middleware, graceful SIGTERM with `at_exit` hooks |
| **Security** | `frozen_string_literal`, no `eval`/`send` with user input, `bundle audit` in CI, Sorbet strict typing on auth paths, secrets via `credentials.yml.enc` |
| **Cost Optimization** | Lazy enumerables for large datasets, Ractor pooling for CPU work, connection pooling via `connection_pool` gem, memoization with `||=` |
| **Operational Excellence** | RuboCop in CI, Zeitwerk autoloading, structured JSON logging (`semantic_logger`), `debug` gem over `puts` debugging |
| **Performance** | `Ractor` for CPU parallelism, `Fiber.scheduler` for IO concurrency, `frozen_string_literal` reducing GC pressure, `tally`/`filter_map` over manual loops |
| **Responsible AI** | Input validation before LLM calls, content safety checks on outputs, PII scrubbing with custom `StandardError` logging, audit trail via structured logs |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
