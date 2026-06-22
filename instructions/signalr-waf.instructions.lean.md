---
description: "SignalR real-time standards — hub design, groups, streaming, connection management, Azure SignalR Service."
applyTo: "**/*.cs, **/*.ts"
waf:
  - "performance-efficiency"
  - "reliability"
---

# SignalR — FAI Standards

## Hub Design

- Use strongly-typed hubs — define an `IClient` interface, inherit `Hub<IClient>` instead of raw `Hub`
- Keep hubs thin — delegate business logic to injected services, hubs are transport endpoints
- Use `IHubContext<THub, TClient>` for sending messages from background services, controllers, or hosted services

```csharp
public interface IChatClient
{
    Task ReceiveMessage(string user, string content, DateTimeOffset timestamp);
    Task UserJoined(string user);
}

public class ChatHub : Hub<IChatClient>
{
    private readonly IChatService _chat;
    public ChatHub(IChatService chat) => _chat = chat;

    public async Task SendMessage(string content)
    {
        var sanitized = _chat.Sanitize(content);
        await Clients.Group("room-1").ReceiveMessage(
            Context.UserIdentifier!, sanitized, DateTimeOffset.UtcNow);
    }
}

// Background service sending via IHubContext
public class NotificationService(IHubContext<ChatHub, IChatClient> hub)
{
    public Task NotifyAll(string msg) =>
        hub.Clients.All.ReceiveMessage("system", msg, DateTimeOffset.UtcNow);
}
```

## Connection Management

- Track connections in `OnConnectedAsync` / `OnDisconnectedAsync` — add to groups, update presence
- Use `Context.UserIdentifier` (set from `ClaimTypes.NameIdentifier`) for user-targeted messages
- Add users to groups based on claims or query params — never trust client-sent group names

```csharp
public override async Task OnConnectedAsync()
{
    var tenant = Context.User!.FindFirstValue("tenant_id")!;
    await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant-{tenant}");
    await Clients.Group($"tenant-{tenant}").UserJoined(Context.UserIdentifier!);
    await base.OnConnectedAsync();
}

public override async Task OnDisconnectedAsync(Exception? ex)
{
    // Groups auto-remove on disconnect — handle custom cleanup here
    await base.OnDisconnectedAsync(ex);
}
```

## Authentication

- JWT bearer for SPAs and mobile — pass token via `accessTokenFactory` on the client
- Cookie auth for server-rendered apps — SignalR uses the existing cookie automatically
- Map `NameIdentifier` claim so `Context.UserIdentifier` resolves correctly

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });
```

## Azure SignalR Service

- **Default mode**: app server maintains hub logic, Azure handles connections and fan-out
- **Serverless mode**: no hub server — trigger from Azure Functions bindings, use REST API to send
- Set connection string from Key Vault, never hardcode: `AddAzureSignalR(config["Azure:SignalR:ConnectionString"])`
- Use Managed Identity: `AddAzureSignalR().WithUrl(...).WithCredential(new DefaultAzureCredential())`

## Scaling

- Azure SignalR Service acts as backplane — no sticky sessions needed when using it
- Without Azure SignalR: enable sticky sessions (`ARRAffinity`) + Redis backplane via `AddStackExchangeRedis`
- Never rely on in-memory state across instances — use distributed cache or database

## Message Patterns

```csharp
// Broadcast to all
await Clients.All.ReceiveMessage(user, msg, now);
// Target specific user (by ClaimTypes.NameIdentifier)
await Clients.User(userId).ReceiveMessage(user, msg, now);
// Group send
await Clients.Group("room-42").ReceiveMessage(user, msg, now);
// Exclude caller
await Clients.OthersInGroup("room-42").ReceiveMessage(user, msg, now);
```

## Streaming

```csharp
// Server-to-client streaming
public async IAsyncEnumerable<int> StreamCounter(
    int count, int delay, [EnumeratorCancellation] CancellationToken ct)
{
    for (var i = 0; i < count && !ct.IsCancellationRequested; i++)
    {
        yield return i;
        await Task.Delay(delay, ct);
    }
}
```

## Client SDK (TypeScript)

```typescript
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";

const connection = new HubConnectionBuilder()
  .withUrl("/hubs/chat", { accessTokenFactory: () => getToken() })
  .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
  .withHubProtocol(new MessagePackHubProtocol()) // binary perf boost
  .configureLogging(LogLevel.Warning)
  .build();

connection.on("ReceiveMessage", (user: string, content: string) => {
  appendMessage(user, content);
});

connection.onreconnecting((err) => showBanner("Reconnecting..."));
connection.onreconnected((id) => hideBanner());
connection.onclose((err) => showBanner("Disconnected. Refresh to retry."));

await connection.start();
// Client-to-server streaming
const subject = new Subject<string>();
await connection.send("UploadStream", subject);
subject.next("chunk-1");
subject.complete();
```

## MessagePack Protocol

- Add `Microsoft.AspNetCore.SignalR.Protocols.MessagePack` server-side, call `.AddMessagePackProtocol()`
- Client: `@microsoft/signalr-protocol-msgpack` + `withHubProtocol(new MessagePackHubProtocol())`
- 30-50% smaller payloads vs JSON — measurable on high-throughput hubs

## Error Handling

- Throw `HubException` for client-visible errors — other exceptions are masked by default
- Log all hub exceptions via `ILogger` — include `ConnectionId` and `UserIdentifier` for correlation
- Never expose stack traces — `HubException("Payment failed")` not `HubException(ex.ToString())`

## Testing Hubs

- Unit test hub methods by mocking `IHubCallerClients<T>`, `HubCallerContext`, and `IGroupManager`
- Integration test with `WebApplicationFactory` + `HubConnection` against the real pipeline
- Assert group membership and message delivery via mock callbacks

## Anti-Patterns

- ❌ Storing per-connection state in hub instance fields (hubs are transient — new instance per call)
- ❌ Using raw `Hub` instead of `Hub<T>` — loses compile-time safety on client method names
- ❌ Blocking hub methods with `.Result` or `.Wait()` — deadlocks under load
- ❌ Sending the `access_token` in custom headers (WebSockets don't support custom headers — use query string)
- ❌ Trusting client-sent group names without server-side authorization
- ❌ Skipping `withAutomaticReconnect` — users silently lose connection on network blips
- ❌ Using SignalR for large file transfer — use blob storage + notify via SignalR instead
- ❌ Not disposing `HubConnection` on client — leaks WebSocket handles

## WAF Alignment

| Pillar | SignalR Practices |
|---|---|
| **Reliability** | `withAutomaticReconnect` with escalating delays; `OnDisconnectedAsync` cleanup; Azure SignalR 99.95% SLA; Redis backplane for multi-instance |
| **Security** | JWT via query string on `/hubs` path only; authorize hubs with `[Authorize]`; validate group membership server-side; TLS-only transport |
| **Performance** | MessagePack protocol; streaming for large payloads; Azure SignalR offloads connection management; avoid broadcast storms with groups |
| **Cost** | Azure SignalR Free tier (20 concurrent, 20K msgs/day) for dev; Standard with unit auto-scale; serverless mode for sporadic traffic |
| **Operations** | Structured logging with ConnectionId; Azure Monitor integration; health checks via `/health`; connection count metrics |

### Operational Excellence
- Structured JSON logging with Application Insights + correlation IDs
- Custom metrics: latency p50/p95/p99, token usage, quality scores
- Automated Bicep deployment via GitHub Actions (staging → prod)
- Feature flags for gradual rollout, incident runbooks
