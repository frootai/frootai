---
description: "gRPC standards — protobuf design, streaming, error codes, health checking."
applyTo: "**/*.proto, **/*.cs, **/*.go"
waf:
  - "performance-efficiency"
  - "reliability"
---

# gRPC — FAI Standards

## Proto3 Design

- Start field numbers at 1. Reserve 1-15 for frequently-set fields (1-byte varint).
- Never reuse deleted field numbers. Mark them `reserved`:

```protobuf
message Order {
  reserved 4, 8 to 10;
  reserved "legacy_status";
  string id = 1;
  string customer_id = 2;
  repeated LineItem items = 3;
  google.protobuf.Timestamp created_at = 5;
}
```

- Use `oneof` for mutually exclusive fields. Never set more than one programmatically:

```protobuf
message PaymentMethod {
  oneof method {
    CreditCard card = 1;
    BankTransfer bank = 2;
    Wallet wallet = 3;
  }
}
```

- Wrap scalars in messages for optional semantics: `google.protobuf.StringValue`.
- Enums must have `_UNSPECIFIED = 0` as first value. Never use 0 for real business meaning.

## Service Design Patterns

Match RPC type to data flow. Do not force unary when streaming fits:

```protobuf
service OrderService {
  rpc CreateOrder(CreateOrderRequest) returns (CreateOrderResponse);             // unary
  rpc WatchOrderStatus(WatchRequest) returns (stream OrderStatusEvent);          // server-streaming
  rpc UploadLineItems(stream LineItem) returns (UploadSummary);                  // client-streaming
  rpc NegotiatePrice(stream PriceProposal) returns (stream PriceCounter);        // bidirectional
}
```

- Keep request/response messages named `{Method}Request` / `{Method}Response`.
- Never return bare scalars. Always wrap in a message for future extensibility.

## Error Handling

Return `google.rpc.Status` with rich error details. Never embed errors in response messages:

```python
from grpc_status import rpc_status
from google.rpc import status_pb2, error_details_pb2
from google.protobuf import any_pb2

detail = any_pb2.Any()
detail.Pack(error_details_pb2.BadRequest(
    field_violations=[error_details_pb2.BadRequest.FieldViolation(
        field="customer_id", description="must be non-empty UUID"
    )]
))
status = status_pb2.Status(
    code=code_pb2.INVALID_ARGUMENT,
    message="validation failed",
    details=[detail],
)
context.abort_with_status(rpc_status.to_status(status))
```

Map domain errors to canonical codes: `NOT_FOUND`, `ALREADY_EXISTS`, `PERMISSION_DENIED`, `RESOURCE_EXHAUSTED`, `FAILED_PRECONDITION`. Never use `UNKNOWN` or `INTERNAL` for expected errors.

## Interceptors / Middleware

Chain interceptors for cross-cutting concerns. Do not scatter auth/logging across handlers:

```python
# Python server interceptor
class AuthInterceptor(grpc.ServerInterceptor):
    def intercept_service(self, continuation, handler_call_details):
        metadata = dict(handler_call_details.invocation_metadata)
        token = metadata.get("authorization", "")
        if not self._validate(token):
            return grpc.unary_unary_rpc_method_handler(
                lambda req, ctx: ctx.abort(grpc.StatusCode.UNAUTHENTICATED, "invalid token")
            )
        return continuation(handler_call_details)

server = grpc.server(futures.ThreadPoolExecutor(max_workers=10),
                     interceptors=[AuthInterceptor(), LoggingInterceptor()])
```

```go
// Go unary interceptor
func UnaryLogger(ctx context.Context, req any, info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler) (any, error) {
    start := time.Now()
    resp, err := handler(ctx, req)
    slog.Info("rpc", "method", info.FullMethod, "dur", time.Since(start), "code", status.Code(err))
    return resp, err
}
```

## Deadline Propagation

Always set deadlines on client calls. Servers must check and propagate:

```go
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()
resp, err := client.CreateOrder(ctx, req)
if status.Code(err) == codes.DeadlineExceeded {
    // handle timeout
}
```

Never set infinite deadlines. Default to 30s for unary, 5m for streaming. Check `ctx.Err()` in long loops.

## Health Checking

Implement `grpc.health.v1.Health` on every service. This is required for Kubernetes gRPC probes and load balancer health:

```python
from grpc_health.v1 import health, health_pb2_grpc
health_servicer = health.HealthServicer()
health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
health_servicer.set("OrderService", health_pb2.HealthCheckResponse.SERVING)
```

Enable server reflection in non-production for debugging:

```python
from grpc_reflection.v1alpha import reflection
SERVICE_NAMES = (order_pb2.DESCRIPTOR.services_by_name["OrderService"].full_name,
                 reflection.SERVICE_NAME, health.SERVICE_NAME)
reflection.enable_server_reflection(SERVICE_NAMES, server)
```

## Load Balancing

- Use client-side `round_robin` for simple deployments:
  `grpc.insecure_channel("dns:///orders.svc:50051", options=[("grpc.lb_policy_name", "round_robin")])`
- Use xDS for traffic splitting, canary, and fault injection in service mesh.
- Never point clients at a single pod IP. Use DNS or service discovery.

## TLS / mTLS

- Always terminate TLS. Use mTLS for service-to-service:

```go
creds, _ := credentials.NewServerTLSFromFile("server.crt", "server.key")
srv := grpc.NewServer(grpc.Creds(creds))
```

- Store certs in Key Vault or cert-manager. Never embed PEM in source.
- Rotate certificates on schedule (90-day max lifetime).

## Proto Evolution & Compatibility

- Never change field numbers or types of existing fields.
- Add new fields with new numbers. Old clients ignore unknown fields (forward-compatible).
- Use `reserved` for removed fields to prevent accidental reuse.
- Run `buf breaking --against .git#branch=main` on every PR to catch breaking changes.
- Run `buf lint` to enforce style: `PACKAGE_VERSION_SUFFIX`, `ENUM_ZERO_VALUE_SUFFIX`, `SERVICE_SUFFIX`.

## Testing with grpcurl

```bash
# list services via reflection
grpcurl -plaintext localhost:50051 list

# describe a service
grpcurl -plaintext localhost:50051 describe order.v1.OrderService

# call unary RPC
grpcurl -plaintext -d '{"customer_id":"abc-123"}' localhost:50051 order.v1.OrderService/CreateOrder
```

Write integration tests that spin up an in-process server, call via channel, and assert on responses + status codes. Mock downstream dependencies at the gRPC layer, not HTTP.

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| Bare scalar returns (`returns (string)`) | Wrap in `{Method}Response` message |
| Reusing deleted field numbers | `reserved` the number and name |
| No deadline on client calls | `WithTimeout` / `deadline` on every call |
| `UNKNOWN` for business errors | Map to canonical code (`NOT_FOUND`, etc.) |
| Reflection enabled in production | Gate behind env flag or disable |
| HTTP JSON gateway without `google.api.http` annotations | Add `option (google.api.http)` for REST transcoding |
| Polling instead of server-streaming | Use server-stream for push-based updates |

## WAF Alignment

| Pillar | Practice |
|---|---|
| Performance Efficiency | Client-side LB, connection pooling, streaming for bulk data, proto binary encoding |
| Reliability | Deadlines, retries with backoff, health checks, circuit breaking via xDS |
| Security | mTLS, token validation in interceptor, no reflection in prod |
| Cost Optimization | Reuse channels, compress large payloads (`grpc.default_compression_algorithm`) |
| Operational Excellence | Structured logging in interceptors, `buf lint` in CI, proto registry |
