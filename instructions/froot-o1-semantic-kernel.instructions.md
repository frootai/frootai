---
description: "Semantic Kernel standards — kernel config, plugin design, filter pipeline, memory store integration."
applyTo: "**/*.cs, **/*.py"
waf:
  - "reliability"
  - "operational-excellence"
---

# Semantic Kernel — FAI Standards

## Kernel Builder Configuration

- Build kernels via `Kernel.CreateBuilder()` — register services, plugins, and filters before `.Build()`
- Use `AddAzureOpenAIChatCompletion` with `DefaultAzureCredential` — never raw API keys in production
- Register plugins at build time, not after `.Build()` — kernel is designed to be immutable after construction
- Inject `IConfiguration` for model deployment names, endpoints, and parameters

```csharp
var builder = Kernel.CreateBuilder();
builder.AddAzureOpenAIChatCompletion(
    deploymentName: config["AzureOpenAI:DeploymentName"],
    endpoint: config["AzureOpenAI:Endpoint"],
    credentials: new DefaultAzureCredential());
builder.Plugins.AddFromType<TimePlugin>();
builder.Plugins.AddFromObject(new OrderPlugin(dbContext), "Orders");
builder.Services.AddSingleton<IFunctionInvocationFilter, AuditFilter>();
Kernel kernel = builder.Build();
```

## Plugin Design

- Decorate methods with `[KernelFunction]` and `[Description("...")]` — the description is the AI's only guide for tool selection
- Use `[Description]` on parameters too — vague names like `input` cause misrouting
- Return strongly typed results; SK serializes to JSON for the model automatically
- Group related functions into one plugin class — one class = one tool namespace
- Keep plugin methods pure where possible; inject dependencies via constructor

```csharp
public class WeatherPlugin
{
    [KernelFunction, Description("Gets the current weather for a given city name.")]
    public async Task<WeatherResult> GetWeatherAsync(
        [Description("City name, e.g. 'Seattle'")] string city,
        Kernel kernel, CancellationToken ct = default)
    {
        // kernel is auto-injected; use for nested AI calls if needed
        return await _weatherService.GetCurrentAsync(city, ct);
    }
}
```

## Function Calling Behavior

- `FunctionChoiceBehavior.Auto()` — model decides when/which functions to call (default for assistants)
- `FunctionChoiceBehavior.Required()` — force the model to call at least one function
- `FunctionChoiceBehavior.None()` — disable function calling for this request
- Set on `PromptExecutionSettings.FunctionChoiceBehavior`; do NOT set on the kernel
- Auto function calling loops by default (up to 5 rounds); cap with `MaximumAutoInvokeAttempts`

```csharp
var settings = new AzureOpenAIPromptExecutionSettings
{
    FunctionChoiceBehavior = FunctionChoiceBehavior.Auto(),
    Temperature = 0.0 // deterministic for tool-calling scenarios
};
var result = await kernel.InvokePromptAsync("What's the weather in Seattle?", new(settings));
```

## Chat Completion with History

- Use `IChatCompletionService` directly when you need multi-turn conversation control
- `ChatHistory` is append-only — add system, user, assistant messages in order
- For streaming: `GetStreamingChatMessageContentsAsync` yields `StreamingChatMessageContent` chunks
- Always persist `ChatHistory` externally (Redis, Cosmos DB) for production — it is an in-memory list

```csharp
var chat = kernel.GetRequiredService<IChatCompletionService>();
var history = new ChatHistory("You are a helpful assistant.");
history.AddUserMessage(userInput);
var response = await chat.GetChatMessageContentAsync(history, settings, kernel);
history.AddAssistantMessage(response.Content!);
```

## Filter Pipeline

Three filter types execute in registration order (first registered = outermost):

| Filter Interface | Fires On | Use Case |
|---|---|---|
| `IFunctionInvocationFilter` | Every kernel function call | Logging, auth checks, result transformation |
| `IPromptRenderFilter` | Before prompt sent to model | PII scrubbing, token budget enforcement |
| `IAutoFunctionInvocationFilter` | Auto function-call loop iterations | Circuit breaking, call-count limiting |

```csharp
public class AuditFilter : IFunctionInvocationFilter
{
    public async Task OnFunctionInvocationAsync(FunctionInvocationContext ctx, Func<FunctionInvocationContext, Task> next)
    {
        _logger.LogInformation("Calling {Plugin}.{Function}", ctx.Function.PluginName, ctx.Function.Name);
        await next(ctx); // call the function
        _logger.LogInformation("Result: {Result}", ctx.Result?.ToString()?[..200]);
    }
}
```

- Register filters via `builder.Services.AddSingleton<IFunctionInvocationFilter, AuditFilter>()`
- `IAutoFunctionInvocationFilter` can set `ctx.Terminate = true` to stop the auto-invoke loop
- Filters support DI — inject `ILogger`, telemetry clients, content safety services

## Memory and Embeddings

- Use `ITextEmbeddingGenerationService` + a vector store connector (`AzureAISearch`, `Qdrant`, `Redis`)
- Register via `builder.AddAzureOpenAITextEmbeddingGeneration(deploymentName, endpoint, credential)`
- Prefer `IVectorStore` abstraction for CRUD on vector records — decouples from specific stores
- Define memory records as POCOs with `[VectorStoreRecordKey]`, `[VectorStoreRecordData]`, `[VectorStoreRecordVector]` attributes

## Prompt Templates

- Use Handlebars syntax (`{{#each}}`, `{{> helper}}`) for complex templates — it is the recommended format
- Liquid templates supported via `LiquidPromptTemplateFactory`
- `KernelPromptTemplateFactory` handles SK's native `{{$variable}}` and `{{plugin.function}}` syntax
- Load prompt YAML files via `KernelFunctionYaml.FromPromptYaml(yaml)` — keeps prompts out of code
- Template variables are passed via `KernelArguments`

## Agent Framework

- `ChatCompletionAgent` — wraps any `IChatCompletionService` with instructions, name, and kernel
- `OpenAIAssistantAgent` — backed by OpenAI Assistants API (threads, code interpreter, file search)
- Use `AgentGroupChat` for multi-agent orchestration with `SelectionStrategy` and `TerminationStrategy`
- Agents share the kernel's plugins — register common tools on the kernel, agent-specific tools per agent

```csharp
ChatCompletionAgent agent = new()
{
    Name = "Reviewer",
    Instructions = "Review code for security issues. Be concise.",
    Kernel = kernel,
    Arguments = new(settings)
};
```

## DI Integration

- `Kernel` is designed for ASP.NET Core DI — register as transient or scoped, never singleton (it holds state)
- `builder.Services` exposes `IServiceCollection` — add HttpClient, DbContext, custom services
- Use `AddKernel()` extension in ASP.NET to register kernel + services in the host container
- Inject `Kernel` into controllers/services; use `kernel.Clone()` if you need per-request isolation

## Preferred Patterns

- ✅ `Kernel.CreateBuilder()` → configure → `.Build()` — single initialization path
- ✅ `[Description]` on every `[KernelFunction]` and every parameter — AI needs context
- ✅ `FunctionChoiceBehavior.Auto()` on settings, not global — control per-request
- ✅ Filters for cross-cutting concerns — logging, safety, rate limiting
- ✅ `KernelFunctionYaml.FromPromptYaml` for prompt management — version-controlled, testable
- ✅ `CancellationToken` on all async plugin methods — respect timeouts
- ✅ `kernel.Clone()` for per-request state isolation in web apps

## Anti-Patterns

- ❌ Building kernel per request — expensive; build once, clone if needed
- ❌ Missing `[Description]` on `[KernelFunction]` — model can't discover or select the function
- ❌ Using deprecated `SKFunction` attribute — replaced by `KernelFunction` in v1.0+
- ❌ Using `Planner` classes (Handlebars/Stepwise) in production — deprecated in favor of function calling
- ❌ Storing `ChatHistory` only in memory — lost on restart, unbounded growth
- ❌ Registering `Kernel` as singleton in DI — causes shared state bugs across requests
- ❌ Calling `kernel.InvokeAsync` without `CancellationToken` — no timeout, hangs on model latency
- ❌ Setting `FunctionChoiceBehavior` globally on kernel instead of per-request settings
- ❌ Raw string concatenation for prompts — use template engine for injection safety
- ❌ Ignoring `MaximumAutoInvokeAttempts` — unbounded loops burn tokens and hit rate limits

## WAF Alignment

| Pillar | Semantic Kernel Practice |
|---|---|
| **Security** | `DefaultAzureCredential` for connectors; `IPromptRenderFilter` for PII scrubbing; Content Safety in filters |
| **Reliability** | SK has built-in retry via `HttpClient` policies; `IAutoFunctionInvocationFilter` for circuit breaking; `CancellationToken` on all async |
| **Cost Optimization** | `MaximumAutoInvokeAttempts` caps loop cost; model routing via multiple connectors; token tracking in `IFunctionInvocationFilter` |
| **Operational Excellence** | `IFunctionInvocationFilter` for structured telemetry; prompt YAML for version control; DI for testability |
| **Performance** | Streaming via `GetStreamingChatMessageContentsAsync`; `kernel.Clone()` avoids rebuild; async-first plugin design |
| **Responsible AI** | `IPromptRenderFilter` for content safety enforcement; filter pipeline for guardrails; agent `Instructions` for behavioral constraints |
