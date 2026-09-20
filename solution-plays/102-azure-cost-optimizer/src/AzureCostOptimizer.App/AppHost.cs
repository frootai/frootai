using Azure.Core;
using Azure.Identity;
using Azure.Monitor.OpenTelemetry.AspNetCore;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new DecimalStringJsonConverter()));
if (builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"] is { Length: > 0 })
{
    // The Azure Monitor distro configures the providers, so custom sources are registered after it rather than before.
    builder.Services.AddOpenTelemetry().UseAzureMonitor().WithTracing(tracing => tracing.AddSource(AcoTelemetry.SourceName));
}
var hostedProfile = string.Equals(builder.Configuration["ACI_HOSTING_PROFILE"], "hosted_demo", StringComparison.Ordinal);
var dataProfile = builder.Configuration["ACI_DATA_PROFILE"]
    ?? (hostedProfile || !string.IsNullOrWhiteSpace(builder.Configuration["ACI_SUBSCRIPTION_ID"]) ? "live" : "solution_snapshot");
if (dataProfile is not ("live" or "solution_snapshot")) throw new InvalidOperationException("ACI_DATA_PROFILE must be live or solution_snapshot.");
builder.Configuration["ACI_DATA_PROFILE"] = dataProfile;
TokenCredential credential = hostedProfile
    ? new DefaultAzureCredential(new DefaultAzureCredentialOptions { ManagedIdentityClientId = builder.Configuration["AZURE_CLIENT_ID"] })
    : dataProfile == "live"
        ? new SubscriptionAzureCliCredential(builder.Configuration["ACI_SUBSCRIPTION_ID"]
            ?? throw new InvalidOperationException("ACI_SUBSCRIPTION_ID is required for the live profile."))
        : new SnapshotOnlyCredential();
builder.Services.AddSingleton(credential);
builder.Services.AddHttpClient("azure-evidence", client => client.Timeout = TimeSpan.FromSeconds(45));
builder.Services.AddSingleton<AzureEvidenceService>(services => new AzureEvidenceService(
    services.GetRequiredService<IHttpClientFactory>().CreateClient("azure-evidence"),
    services.GetRequiredService<TokenCredential>(),
    services.GetRequiredService<IConfiguration>()));
builder.Services.AddSingleton<AcoAgentService>();
AcoMcpAccess.EnsureAuthorizationIsSafe(builder.Configuration);
if (AcoMcpAccess.IsEnabled(builder.Configuration))
{
    builder.Services.AddMcpServer(options => options.ServerInfo = new() { Name = "azure-cost-optimizer", Version = "1.0.0" })
        .WithHttpTransport()
        .WithTools<AcoMcpTools>();
}
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        hostedProfile && context.Request.Path.StartsWithSegments("/api/v1")
            ? RateLimitPartition.GetFixedWindowLimiter(context.Items["aco-principal"]?.ToString() ?? "anonymous", _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true })
            : RateLimitPartition.GetNoLimiter("local"));
});

var app = builder.Build();
var hosted = hostedProfile;
const string authorizedScope = "solution-scope";

app.Use(async (context, next) =>
{
    if (!hosted && context.Request.Host.Host is not ("127.0.0.1" or "localhost" or "::1"))
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }
    if (!hosted && context.Request.Headers.Origin.FirstOrDefault() is { } origin &&
        (!Uri.TryCreate(origin, UriKind.Absolute, out var originUri) || originUri.Host is not ("127.0.0.1" or "localhost" or "::1")))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return;
    }
    if (hosted && (context.Request.Path.StartsWithSegments("/api/v1") || context.Request.Path.StartsWithSegments("/mcp")))
    {
        var status = HostedDemoAccess.Authorize(context, app.Configuration);
        if (status != StatusCodes.Status200OK)
        {
            await Results.Json(new { message = status == 401 ? "Sign in is required." : status == 503 ? "Hosted authorization is not configured." : "Access to this demo is not authorized." }, statusCode: status).ExecuteAsync(context);
            return;
        }
        context.Response.Headers.CacheControl = "no-store";
    }
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("Referrer-Policy", "no-referrer");
    context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'");
    await next();
});
app.UseDefaultFiles();
app.UseRateLimiter();
// Asset names are content hashed, so they are safe to cache forever. index.html names them, so it must
// revalidate on every load; without this a browser keeps an old page that points at deleted bundles.
var staticFiles = new StaticFileOptions
{
    OnPrepareResponse = context => context.Context.Response.Headers.CacheControl =
        context.File.Name.EndsWith(".html", StringComparison.OrdinalIgnoreCase)
            ? "no-cache, must-revalidate"
            : "public, max-age=31536000, immutable",
};
app.UseStaticFiles(staticFiles);

app.MapGet("/health/live", () => Results.Ok(new { status = "healthy" }));
if (AcoMcpAccess.IsEnabled(app.Configuration)) app.MapMcp("/mcp");
app.MapGet("/health/ready", (AzureEvidenceService evidence) => evidence.Current is null
    ? Results.Json(new { status = "starting" }, statusCode: StatusCodes.Status503ServiceUnavailable)
    : Results.Ok(new { status = "ready" }));
var signInRequired = hosted && string.Equals(builder.Configuration["ACI_AUTH_MODE"], HostedDemoAccess.EasyAuthMode, StringComparison.Ordinal);
app.MapGet("/auth/config", () => Results.Ok(new { hosted, signInRequired, dataProfile, intelligenceProvider = builder.Configuration["ACI_AI_PROVIDER"] ?? "foundry", costSource = builder.Configuration["ACI_COST_SOURCE"] ?? "query", scheduledRefreshMinutes = int.TryParse(builder.Configuration["ACI_REFRESH_INTERVAL_MINUTES"], out var scheduled) && scheduled >= 15 ? Math.Min(scheduled, 1440) : 0 }));
app.MapGet("/api/v1/cache-status", (string? scope, string? period, AzureEvidenceService evidence) =>
    scope != authorizedScope ? ScopeDenied() : Results.Ok(new { status = evidence.GetCacheStatus(period), period = PeriodSelection.Parse(period).Key, retryAt = evidence.GetRetryAt(period), durableCache = evidence.DurableCacheStatus, failureCode = evidence.GetRefreshFailure(period) }));

app.MapGet("/api/v1/summary", (string? scope, string? period, AzureEvidenceService evidence) =>
    scope != authorizedScope ? ScopeDenied() : evidence.GetCached(period) is { } snapshot ? Results.Ok(snapshot.Summary) : SnapshotWarming(period));
app.MapGet("/api/v1/opportunities", (string? scope, string? period, AzureEvidenceService evidence) =>
    scope != authorizedScope ? ScopeDenied() : evidence.GetCached(period) is { } snapshot ? Results.Ok(snapshot.Opportunities) : SnapshotWarming(period));
app.MapGet("/api/v1/advisor", (string? scope, string? period, AzureEvidenceService evidence) =>
    scope != authorizedScope ? ScopeDenied() : evidence.GetCached(period) is { } snapshot ? Results.Ok(snapshot.Advisor) : SnapshotWarming(period));
app.MapGet("/api/v1/data-health", (string? scope, string? period, AzureEvidenceService evidence) =>
    scope != authorizedScope ? ScopeDenied() : evidence.GetCached(period) is { } snapshot ? Results.Ok(snapshot.DataHealth) : SnapshotWarming(period));
app.MapPost("/api/v1/refresh", (string? scope, string? period, AzureEvidenceService evidence, ILogger<Program> logger) =>
{
    if (scope != authorizedScope) return ScopeDenied();
    var selection = PeriodSelection.Parse(period);
    if (evidence.GetRetryAt(selection.Key) is { } retryAt && retryAt > DateTimeOffset.UtcNow) return Results.Ok(new { status = "deferred-throttled", period = selection.Key, retryAt });
    _ = evidence.RefreshAsync(selection.Key, CancellationToken.None).ContinueWith(
        task => logger.LogWarning("Azure evidence refresh failed for period {Period}: {ErrorType}", selection.Key, task.Exception?.GetBaseException().GetType().Name),
        CancellationToken.None,
        TaskContinuationOptions.OnlyOnFaulted,
        TaskScheduler.Default);
    return Results.Accepted(value: new { status = "warming", period = selection.Key, operationId = evidence.GetRefreshOperationId(selection.Key) });
});
app.MapPost("/api/v1/agent/responses", async (AgentRequest request, AzureEvidenceService evidence, AcoAgentService agent, HttpContext context, CancellationToken cancellationToken) =>
{
    if (request.ScopeAlias != authorizedScope) return ScopeDenied();
    var snapshot = evidence.GetCached(request.Period);
    if (snapshot is null) return SnapshotWarming(request.Period);
    return Results.Ok(await agent.AnswerAsync(snapshot, request.Message, request.ConversationId, cancellationToken, context.Items["aco-principal"]?.ToString() ?? "local-os-operator"));
});
app.MapPost("/api/v1/agent/responses/stream", async (AgentRequest request, AzureEvidenceService evidence, AcoAgentService agent, HttpContext context, CancellationToken cancellationToken) =>
{
    context.Response.ContentType = "text/event-stream";
    context.Response.Headers.CacheControl = "no-cache, no-store";
    context.Response.Headers.Append("X-Accel-Buffering", "no");
    var partial = false;
    try
    {
        if (request.ScopeAlias != authorizedScope)
        {
            await context.Response.WriteAsync("event: error\ndata: {\"message\":\"The requested scope is not authorized.\"}\n\n", cancellationToken);
            return;
        }
        var snapshot = evidence.GetCached(request.Period);
        if (snapshot is null)
        {
            await context.Response.WriteAsync("event: error\ndata: {\"message\":\"The selected period is still warming.\"}\n\n", cancellationToken);
            return;
        }
        await foreach (var item in agent.StreamAsync(snapshot, request.Message, request.ConversationId, cancellationToken, context.Items["aco-principal"]?.ToString() ?? "local-os-operator", request.Effort))
        {
            if (item.Type == "section") partial = true;
            // A reset withdraws the abandoned attempt, so no checked section is on screen any more.
            if (item.Type == "reset") partial = false;
            await context.Response.WriteAsync($"event: {item.Type}\ndata: {JsonSerializer.Serialize(item.Data, JsonSerializerOptions.Web)}\n\n", cancellationToken);
            await context.Response.Body.FlushAsync(cancellationToken);
        }
    }
    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
    {
    }
    catch (Exception error)
    {
        var failure = error.GetBaseException();
        var (code, message) = failure switch
        {
            InvalidOperationException when failure.Message.Contains("budget", StringComparison.OrdinalIgnoreCase) => ("agent-budget-exceeded", "ACO reached the analysis limit before completing this answer. The selected evidence is still available."),
            OperationCanceledException => ("model-timeout", "The model did not complete within the response deadline. The selected evidence is still available."),
            InvalidDataException or JsonException => ("response-validation-failed", "ACO stopped because a response section did not pass the evidence checks. Previously checked sections remain visible."),
            Azure.RequestFailedException { Status: 401 or 403 } => ("model-access-denied", "The configured model denied access. Verify the selected identity's model data-plane permissions."),
            System.ClientModel.ClientResultException { Status: 401 or 403 } => ("model-access-denied", "The configured model denied access. Verify the selected identity's model data-plane permissions."),
            Azure.RequestFailedException { Status: 429 } => ("model-throttled", "The model is throttling requests. Use a prepared snapshot answer or retry after the provider cooldown."),
            System.ClientModel.ClientResultException { Status: 429 } => ("model-throttled", "The model is throttling requests. Use a prepared snapshot answer or retry after the provider cooldown."),
            _ => ("model-response-failed", "ACO could not complete this response. The configured model or tool returned an error."),
        };
        // The validation reason is operator diagnostics only; the client message stays generic.
        if (failure is InvalidDataException) app.Logger.LogWarning("ACO response validation rejected the answer: {ValidationIssue}", failure.Message);
        app.Logger.LogWarning("ACO response failed: {ErrorCode} ({ErrorType})", code, failure.GetType().Name);
        await context.Response.WriteAsync($"event: error\ndata: {JsonSerializer.Serialize(new { code, message, partial }, JsonSerializerOptions.Web)}\n\n", cancellationToken);
    }
});
app.MapGet("/api/v1/reports/{reportId}.{format}", (string reportId, string format, string? scope, string? period, AzureEvidenceService evidence) =>
{
    if (scope != authorizedScope) return ScopeDenied();
    var snapshot = evidence.GetCached(period);
    if (snapshot is null) return SnapshotWarming(period);
    if (!string.Equals(reportId, snapshot.Summary.ReportId, StringComparison.Ordinal)) return Results.NotFound();
    return format.ToLowerInvariant() switch
    {
        "json" => Results.Text(snapshot.ToCanonicalJson(), "application/json"),
        "csv" => Results.Text(snapshot.ToCsv(), "text/csv"),
        "focus" => Results.Text(snapshot.ToFocusCsv(), "text/csv"),
        "html" => Results.Text(snapshot.ToHtml(), "text/html"),
        "pdf" => Results.File(snapshot.ToPdf(), "application/pdf", $"azure-cost-optimizer-{snapshot.Summary.PeriodKey}.pdf"),
        "xlsx" => Results.File(snapshot.ToWorkbook(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"azure-cost-optimizer-{snapshot.Summary.PeriodKey}.xlsx"),
        _ => Results.NotFound(),
    };
});

app.MapFallbackToFile("index.html", staticFiles);

if (dataProfile == "live" && !hosted)
{
    await app.Services.GetRequiredService<AzureEvidenceService>().RestoreCachedAsync(app.Lifetime.ApplicationStopping);
}
else if (dataProfile == "live")
{
    // Hosted restore reads the published revision only; it never collects cost data at startup.
    app.Lifetime.ApplicationStarted.Register(() => _ = Task.Run(async () =>
    {
        try
        {
            await app.Services.GetRequiredService<AzureEvidenceService>().RestoreCachedAsync(app.Lifetime.ApplicationStopping);
        }
        catch (Exception error)
        {
            app.Logger.LogWarning("Hosted evidence restore failed: {ErrorType}", error.GetType().Name);
        }
    }));
}

if (dataProfile == "solution_snapshot" || string.Equals(app.Configuration["ACI_AUTO_REFRESH"], "true", StringComparison.OrdinalIgnoreCase))
{
    app.Lifetime.ApplicationStarted.Register(() => _ = Task.Run(async () =>
    {
        try
        {
            await app.Services.GetRequiredService<AzureEvidenceService>().WarmAsync(app.Lifetime.ApplicationStopping);
        }
        catch (Exception error)
        {
            app.Logger.LogWarning("Initial Azure evidence refresh failed: {ErrorType}", error.GetType().Name);
        }
    }));
}

// Cost Management publishes on its own cadence, so a bounded poll keeps the served snapshot close to the portal
// without a user-facing wait. A throttled or failed poll keeps the previous authorized snapshot.
if (dataProfile == "live" && int.TryParse(app.Configuration["ACI_REFRESH_INTERVAL_MINUTES"], out var refreshMinutes) && refreshMinutes >= 15)
{
    var interval = TimeSpan.FromMinutes(Math.Min(refreshMinutes, 1440));
    app.Lifetime.ApplicationStarted.Register(() => _ = Task.Run(async () =>
    {
        using var timer = new PeriodicTimer(interval);
        var stopping = app.Lifetime.ApplicationStopping;
        var evidence = app.Services.GetRequiredService<AzureEvidenceService>();
        var period = PeriodSelection.Parse(null).Key;
        try
        {
            // Let the hosted restore settle first so a reusable snapshot is not replaced by an avoidable collection.
            await Task.Delay(TimeSpan.FromSeconds(20), stopping);
            do
            {
                try
                {
                    var cached = evidence.GetCached(period);
                    if (cached is null || DateTimeOffset.UtcNow - cached.Summary.CollectedAt >= interval) await evidence.RefreshAsync(period, stopping);
                }
                catch (Exception error)
                {
                    app.Logger.LogWarning("Scheduled evidence refresh failed: {ErrorType}", error.GetType().Name);
                }
            }
            while (await timer.WaitForNextTickAsync(stopping));
        }
        catch (OperationCanceledException) { }
    }));
}

app.Run();

static IResult SnapshotWarming(string? period) => Results.Json(
    new { status = "warming", period = PeriodSelection.Parse(period).Key, message = "The selected period is being collected and will then be served from cache." },
    statusCode: StatusCodes.Status503ServiceUnavailable);

static IResult ScopeDenied() => Results.Json(new { message = "The requested scope is not authorized." }, statusCode: StatusCodes.Status403Forbidden);

public sealed record AgentRequest(string Message, string ScopeAlias, string? Period = null, string? ConversationId = null, string? Effort = null);

public sealed class DecimalStringJsonConverter : JsonConverter<decimal>
{
    public override decimal Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.TokenType == JsonTokenType.String
            ? decimal.Parse(reader.GetString()!, System.Globalization.CultureInfo.InvariantCulture)
            : reader.GetDecimal();

    public override void Write(Utf8JsonWriter writer, decimal value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.ToString("0.#############################", System.Globalization.CultureInfo.InvariantCulture));
}

public sealed class SnapshotOnlyCredential : TokenCredential
{
    public override AccessToken GetToken(TokenRequestContext requestContext, CancellationToken cancellationToken) =>
        throw new InvalidOperationException("Azure credentials are unavailable in the solution snapshot profile.");

    public override ValueTask<AccessToken> GetTokenAsync(TokenRequestContext requestContext, CancellationToken cancellationToken) =>
        throw new InvalidOperationException("Azure credentials are unavailable in the solution snapshot profile.");
}

public partial class Program;