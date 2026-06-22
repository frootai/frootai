---
description: "Go coding standards — idiomatic Go, return early, error handling, goroutines, and minimal dependency patterns."
applyTo: "**/*.go"
waf:
  - "reliability"
  - "performance-efficiency"
---

# Go — FAI Standards

## Error Handling

Sentinel errors for expected conditions, `%w` wrapping for context, `errors.Is`/`errors.As` for inspection.

```go
var ErrNotFound = errors.New("resource not found")

func FindUser(ctx context.Context, id string) (*User, error) {
    u, err := db.QueryUser(ctx, id)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) { return nil, ErrNotFound }
        return nil, fmt.Errorf("find user %s: %w", id, err)
    }
    return u, nil
}
```

- Return early — never `else` after error check
- Custom errors: implement `Error() string`, extract with `errors.As`
- Never `log.Fatal` in library code; never ignore errors with `_` unless documented

## Context & Interfaces

Every I/O function takes `context.Context` first. Never store in struct. `WithTimeout`/`WithDeadline` on all external calls. Request-scoped values via typed `context.WithValue` keys.

Accept interfaces, return structs. Small interfaces (1-3 methods), defined where consumed. Prefer `io.Reader`/`io.Writer` over custom single-method interfaces. Compose via embedding: `type ReadCloser interface { Reader; Closer }`.

## Struct Embedding

Embedding promotes ALL methods — don't embed if you only need one. Prefer explicit field + delegation to control API surface.

## Goroutines & Channels

- Never launch goroutine without shutdown plan (context, `WaitGroup`, done channel)
- `sync.Mutex` for shared state; channels for coordination — pick one
- Creator closes channel; receivers never close

```go
g, ctx := errgroup.WithContext(ctx)
for _, job := range jobs {
    g.Go(func() error { return process(ctx, job) })
}
return g.Wait()
```

- `select` with `ctx.Done()` in every long-running loop

## Defer & HTTP

```go
f, err := os.Open(path)
if err != nil { return err }
defer f.Close() // AFTER error check; LIFO; avoid in tight loops
```

Middleware: `func(http.Handler) http.Handler`. Go 1.22+ routing: `mux.HandleFunc("GET /users/{id}", h)`. Graceful shutdown: `server.Shutdown(ctx)` on SIGTERM.

```go
func logging(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        next.ServeHTTP(w, r)
        slog.Info("req", "method", r.Method, "path", r.URL.Path, "ms", time.Since(start).Milliseconds())
    })
}
```

## Structured Logging (slog)

```go
slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))
slog.Info("processing", "trace_id", tid, "user_id", uid)
```

Never `fmt.Println`/`log.Println` in production. Key-value pairs, not format strings.

## Table-Driven Tests

```go
tests := []struct{ name, input string; want int64; wantErr bool }{
    {"bytes", "100B", 100, false}, {"invalid", "abc", 0, true},
}
for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
        got, err := ParseSize(tt.input)
        if (err != nil) != tt.wantErr { t.Fatalf("err=%v, wantErr=%v", err, tt.wantErr) }
        if got != tt.want { t.Errorf("got %d, want %d", got, tt.want) }
    })
}
```

`t.Parallel()` for independent subtests. `t.Helper()` in helpers.

## Generics & go:embed

```go
func Map[T, U any](s []T, f func(T) U) []U {
    r := make([]U, len(s)); for i, v := range s { r[i] = f(v) }; return r
}
//go:embed templates/*.html
var templateFS embed.FS
```

`any` over `interface{}`; `constraints.Ordered` over custom unions. Don't use generics when concrete type suffices.

## golangci-lint

```yaml
linters:
  enable: [errcheck, govet, staticcheck, unused, gosec, errorlint, contextcheck, bodyclose]
```

## Anti-Patterns

- ❌ `panic` in library code — return errors
- ❌ Naked goroutines without cancellation
- ❌ `any` params when concrete type works
- ❌ `init()` with side effects — explicit init in `main()`
- ❌ Returning interfaces from packages (leaks coupling)
- ❌ Ignoring `ctx.Done()` in long ops
- ❌ `sync.Mutex` guarding a channel — pick one primitive
- ❌ `time.Sleep` in production — use timers/context
- ❌ Global mutable state — inject via struct fields

## WAF Alignment

| Pillar | Go Implementation |
| --- | --- |
| **Reliability** | `errgroup` lifecycle, `context.WithTimeout`, graceful `Shutdown(ctx)`, circuit breaker middleware |
| **Security** | `gosec` lint, `crypto/rand`, TLS `MinVersion: tls.VersionTLS12`, RBAC middleware |
| **Performance** | `sync.Pool`, buffered channels, `http.Client` pooling, pprof |
| **Cost** | Minimal deps, static binary, `FROM scratch` images, `go.sum` audit |
| **Ops Excellence** | `slog` + OpenTelemetry, `/healthz` + `/readyz`, `golangci-lint` in CI |
| **Responsible AI** | Input validation at boundary, content safety middleware, PII redaction |
