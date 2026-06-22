---
description: "Blazor standards — Server/WebAssembly/United components, state, performance, security"
applyTo: "**/*.razor, **/*.cs"
waf:
  - "security"
  - "reliability"
  - "performance-efficiency"
---

# Blazor — FAI Standards

## Render Modes (.NET 8+)

- Auto render mode: SSR first, then WebAssembly interactive
- Server for data-heavy (no download, fast start)
- WebAssembly for offline-capable
- Static SSR for content pages
- Per-component render mode selection

## Component Design

- Small focused components (<200 lines per .razor)
- CascadingValue for cross-cutting concerns
- EventCallback<T> for parent-child — avoid cascading state
- @key on list items for efficient diffing
- IDisposable for subscriptions/timers

## State Management

- Scoped services for per-circuit state (Server)
- Local/session storage for persistent (WebAssembly)
- Fluxor pattern for complex shared state
- URL-based state for bookmarkable views
- NEVER static state in Server mode (cross-user leaks)

## Authentication

```csharp
// Microsoft.Identity.Web + MSAL
builder.Services.AddMicrosoftIdentityWebAppAuthentication(builder.Configuration);
// Components: <AuthorizeView>, <CascadingAuthenticationState>
```

- AuthenticationStateProvider for auth context
- [Authorize] on pages/components
- Token caching for external APIs

## Performance

- `<Virtualize>` for large lists (thousands of items)
- Lazy loading assemblies for WebAssembly
- AOT compilation (2-3x faster, larger download)
- ShouldRender() override to prevent unnecessary re-renders
- Streaming rendering for progressive UI

## AI Integration

- Chat component with SignalR streaming
- Markdig for markdown rendering
- Token-by-token streaming display
- Clipboard copy for code blocks

## Anti-Patterns

- ❌ Large components >200 lines
- ❌ Static state in Server mode (shared across users!)
- ❌ Sync JS interop in render path
- ❌ Not disposing event handlers
- ❌ Overusing CascadingValue

## WAF Alignment

### Security
- [Authorize], MSAL, anti-forgery, CSP headers

### Reliability
- Circuit reconnection (Server), offline (WASM), error boundaries

### Performance
- Virtualization, lazy loading, AOT, streaming SSR
