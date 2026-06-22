---
description: "Ruby MCP server development — mcp gem, block DSL, Rails integration."
applyTo: "**/*.rb"
waf:
  - "reliability"
---

# Ruby MCP Server Development — FAI Standards

## Bundler Setup

```ruby
# Gemfile
source "https://rubygems.org"

gem "mcp-ruby", "~> 0.3"
gem "json", "~> 2.7"

group :development, :test do
  gem "rspec", "~> 3.13"
  gem "rspec-mocks", "~> 3.13"
end
```

Run `bundle install`. Pin `mcp-ruby` to a minor range to avoid breaking changes.

## Server Class Setup

```ruby
require "mcp"

server = MCP::Server.new(name: "fai-ruby-server", version: "1.0.0")
```

The server handles JSON-RPC 2.0 over stdio. Never write to `$stdout` directly — the transport owns it. All diagnostics go to `$stderr`.

## Tool Registration

```ruby
server.register_tool(
  name: "search_documents",
  description: "Semantic search over indexed documents",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      top_k: { type: "integer", description: "Results to return", default: 5 }
    },
    required: ["query"]
  }
) do |args|
  results = DocumentIndex.search(args["query"], limit: args.fetch("top_k", 5))
  {
    content: results.map { |r| { type: "text", text: "#{r.title}: #{r.snippet}" } }
  }
end
```

Always validate required fields before processing. Use `fetch` with defaults for optional params:

```ruby
) do |args|
  raise MCP::McpError.new("query is required") unless args["query"]&.strip&.length&.positive?
  limit = args.fetch("top_k", 5).clamp(1, 50)
  # ...
end
```

## Resource Handlers

```ruby
server.register_resource(
  uri: "docs://api/openapi.yaml",
  name: "API Specification",
  description: "OpenAPI spec for the service",
  mime_type: "application/yaml"
) do
  { content: File.read("openapi.yaml") }
end
```

Use URI schemes that reflect the domain (`docs://`, `config://`). Return `mime_type` so clients render correctly.

## Prompt Templates

```ruby
server.register_prompt(
  name: "code_review",
  description: "Review Ruby code for style and security issues",
  arguments: [
    { name: "code", description: "Ruby source to review", required: true },
    { name: "severity", description: "Min severity: info|warn|error", required: false }
  ]
) do |args|
  severity = args.fetch("severity", "warn")
  {
    messages: [
      { role: "system", content: "You are a Ruby security reviewer. Report issues at #{severity} level or above." },
      { role: "user", content: "Review this code:\n```ruby\n#{args['code']}\n```" }
    ]
  }
end
```

## Tool Response Formatting

Text and image content types:

```ruby
# Text response
{ content: [{ type: "text", text: "Operation completed: 42 records processed" }] }

# Image response (base64-encoded)
{ content: [{ type: "image", data: Base64.strict_encode64(png_bytes), mimeType: "image/png" }] }

# Mixed response
{ content: [
  { type: "text", text: "Chart generated from 1,200 data points:" },
  { type: "image", data: chart_b64, mimeType: "image/png" }
]}
```

## Error Handling

```ruby
) do |args|
  begin
    result = ExternalApi.call(args["endpoint"])
    { content: [{ type: "text", text: result.to_json }] }
  rescue ExternalApi::RateLimitError => e
    raise MCP::McpError.new("Rate limited — retry after #{e.retry_after}s")
  rescue ExternalApi::AuthError
    raise MCP::McpError.new("Authentication failed — check API credentials")
  rescue StandardError => e
    $stderr.puts "[ERROR] Unhandled: #{e.class}: #{e.message}"
    raise MCP::McpError.new("Internal error processing request")
  end
end
```

Never leak stack traces or credentials through `McpError` messages. Log details to `$stderr`, return sanitized messages to the client.

## Stdio Transport and JSON-RPC

```ruby
# Start the server on stdio (blocking)
server.run(transport: :stdio)
```

The transport reads JSON-RPC 2.0 from `$stdin` and writes responses to `$stdout`. Each message is newline-delimited. Do not mix `puts`/`print` calls — they corrupt the protocol stream.

## Logging

```ruby
$stderr.puts "[#{Time.now.iso8601}] [INFO] Server started: #{server.name} v#{server.version}"
$stderr.puts "[#{Time.now.iso8601}] [DEBUG] Tool called: search_documents, query=#{args['query']}"
```

Production: set log level via `ENV["LOG_LEVEL"]`. Never log full input payloads — they may contain PII.

## Graceful Shutdown

```ruby
Signal.trap("INT")  { $stderr.puts "SIGINT received, shutting down...";  exit 0 }
Signal.trap("TERM") { $stderr.puts "SIGTERM received, shutting down..."; exit 0 }

server.run(transport: :stdio)
```

Trap signals before `server.run`. Clean up database connections or temp files in an `at_exit` block if needed.

## Testing with RSpec

```ruby
RSpec.describe "search_documents tool" do
  let(:server) { MCP::Server.new(name: "test", version: "0.0.1") }
  let(:stdin)  { StringIO.new }
  let(:stdout) { StringIO.new }

  before do
    server.register_tool(name: "search_documents", description: "Search", input_schema: {
      type: "object", properties: { query: { type: "string" } }, required: ["query"]
    }) { |args| { content: [{ type: "text", text: "found: #{args['query']}" }] } }
  end

  it "returns results for valid query" do
    request = { jsonrpc: "2.0", id: 1, method: "tools/call",
                params: { name: "search_documents", arguments: { query: "ruby" } } }.to_json
    stdin.write(request + "\n")
    stdin.rewind

    $stdin = stdin; $stdout = stdout
    # Drive one request through the server or invoke tool handler directly
    result = server.handle_request(JSON.parse(request))
    expect(result[:content].first[:text]).to include("ruby")
  ensure
    $stdin = STDIN; $stdout = STDOUT
  end

  it "raises McpError for missing query" do
    expect {
      server.handle_request({ "method" => "tools/call",
        "params" => { "name" => "search_documents", "arguments" => {} } })
    }.to raise_error(MCP::McpError)
  end
end
```

## Anti-Patterns

- **`puts` in tool handlers** — corrupts JSON-RPC stdio stream; use `$stderr.puts`
- **Unvalidated `args` access** — always check required keys and clamp numeric ranges
- **Rescuing `Exception`** — catches `SignalException`/`SystemExit`; rescue `StandardError` instead
- **Synchronous HTTP in tools without timeout** — use `Net::HTTP.open` with `read_timeout` / `open_timeout`
- **Hardcoded secrets in tool blocks** — read from `ENV` or credential stores, never inline
- **Skipping `bundle exec`** — always run via `bundle exec ruby server.rb` to lock gem versions

## WAF Alignment

| Pillar | Practice |
|--------|----------|
| Reliability | `Signal.trap` for graceful shutdown; rescue `StandardError` not `Exception`; retry with backoff on transient HTTP errors |
| Security | Sanitize `McpError` messages; read secrets from `ENV`; validate/clamp all input; never log PII |
| Cost Optimization | Cache expensive lookups in instance variables; set `top_k` ceilings to bound token usage |
| Operational Excellence | Structured `$stderr` logging with ISO timestamps; `bundle exec` for reproducible deps; CI with `bundle exec rspec` |
| Performance Efficiency | Stream large responses; use connection pooling for HTTP backends; avoid blocking the event loop with long computations |
| Responsible AI | Log tool invocations for audit trail; enforce input length limits; return grounded citations in search results |