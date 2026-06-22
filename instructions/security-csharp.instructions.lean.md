---
description: "C# security standards — parameterized queries, output encoding, anti-forgery tokens, secure headers."
applyTo: "**/*.cs"
waf:
  - "security"
---

# C# Security Patterns — FAI Standards

## Authentication

```csharp
// Azure service auth — always DefaultAzureCredential, never connection strings
var credential = new DefaultAzureCredential();
var client = new SecretClient(new Uri(vaultUri), credential);

// JWT Bearer in ASP.NET Core
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));
```

## Authorization

```csharp
// Policy-based — define once, enforce everywhere
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", p => p.RequireRole("Admin"))
    .AddPolicy("PremiumTier", p => p.RequireClaim("subscription", "premium"))
    .AddPolicy("DocumentOwner", p =>
        p.Requirements.Add(new ResourceOwnerRequirement()));

// Resource-based handler
public class ResourceOwnerHandler : AuthorizationHandler<ResourceOwnerRequirement, Document>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, ResourceOwnerRequirement req, Document doc)
    {
        if (doc.OwnerId == context.User.FindFirstValue(ClaimTypes.NameIdentifier))
            context.Succeed(req);
        return Task.CompletedTask;
    }
}

// Controller usage — never authorize in business logic
[Authorize(Policy = "AdminOnly")]
[HttpDelete("{id}")]
public async Task<IActionResult> Delete(int id) => Ok(await _service.DeleteAsync(id));
```

## Input Validation

```csharp
// FluentValidation — complex rules
public class CreateOrderValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Quantity).InclusiveBetween(1, 1000);
        RuleFor(x => x.ProductId).Must(id => Guid.TryParse(id, out _));
    }
}
builder.Services.AddValidatorsFromAssemblyContaining<CreateOrderValidator>();

// DataAnnotations — simple DTOs
public record SearchRequest(
    [Required, StringLength(200, MinimumLength = 1)] string Query,
    [Range(1, 100)] int PageSize = 20);
```

## SQL Injection Prevention

```csharp
// EF Core — parameterized by default, safe
var results = await db.Users.Where(u => u.Email == email).ToListAsync();

// Raw SQL — ALWAYS parameterize, never interpolate user input
var users = await db.Users
    .FromSqlInterpolated($"SELECT * FROM Users WHERE TenantId = {tenantId}")
    .ToListAsync();

// Dapper — named parameters
var order = await conn.QuerySingleAsync<Order>(
    "SELECT * FROM Orders WHERE Id = @Id AND UserId = @UserId",
    new { Id = orderId, UserId = userId });
```

## XSS Prevention & Security Headers

```csharp
// Razor auto-encodes by default — never use Html.Raw with user input
// CSP + security headers middleware
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    ctx.Response.Headers.Append("X-Frame-Options", "DENY");
    ctx.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    ctx.Response.Headers.Append("Permissions-Policy", "camera=(), microphone=()");
    ctx.Response.Headers.Append("Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
    await next();
});
```

## CORS

```csharp
// Explicit origin allowlist — never use AllowAnyOrigin in production
builder.Services.AddCors(o => o.AddPolicy("Strict", p =>
    p.WithOrigins("https://app.contoso.com", "https://admin.contoso.com")
     .WithMethods("GET", "POST", "PUT", "DELETE")
     .WithHeaders("Authorization", "Content-Type")
     .SetPreflightMaxAge(TimeSpan.FromMinutes(10))));
app.UseCors("Strict");
```

## Secrets Management

```csharp
// IConfiguration + Key Vault — secrets never in appsettings or source
builder.Configuration.AddAzureKeyVault(
    new Uri($"https://{builder.Configuration["KeyVaultName"]}.vault.azure.net/"),
    new DefaultAzureCredential());

// Access via DI — never IConfiguration directly in controllers
builder.Services.Configure<OpenAIOptions>(builder.Configuration.GetSection("OpenAI"));
```

## HTTPS & CSRF

```csharp
// Force HTTPS + HSTS
builder.Services.AddHttpsRedirection(o => o.HttpsPort = 443);
builder.Services.AddHsts(o => { o.MaxAge = TimeSpan.FromDays(365); o.IncludeSubDomains = true; });
app.UseHsts();
app.UseHttpsRedirection();

// Anti-forgery — auto-validates on POST/PUT/DELETE in Razor Pages
builder.Services.AddAntiforgery(o => o.HeaderName = "X-XSRF-TOKEN");
app.UseAntiforgery();
```

## Rate Limiting

```csharp
// System.Threading.RateLimiting — built-in .NET 8+
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddFixedWindowLimiter("api", opt =>
    {
        opt.PermitLimit = 60;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 0;
    });
    o.AddTokenBucketLimiter("ai", opt =>
    {
        opt.TokenLimit = 20;
        opt.ReplenishmentPeriod = TimeSpan.FromSeconds(10);
        opt.TokensPerPeriod = 5;
    });
});
app.UseRateLimiter();
```

## Cryptography

```csharp
// Data Protection API — key rotation handled automatically
builder.Services.AddDataProtection()
    .PersistKeysToAzureBlobStorage(blobUri)
    .ProtectKeysWithAzureKeyVault(keyId, new DefaultAzureCredential());

// Password hashing — BCrypt, never SHA/MD5
var hash = BCrypt.Net.BCrypt.EnhancedHashPassword(password, 12);
bool valid = BCrypt.Net.BCrypt.EnhancedVerify(input, hash);
```

## Dependency Scanning

```bash
# CI pipeline — fail build on known vulnerabilities
dotnet list package --vulnerable --include-transitive
dotnet list package --deprecated
# .NET 8+ audit command
dotnet audit
```

## Anti-Patterns

- ❌ `string.Format` or `$""` for SQL — always parameterize
- ❌ `Html.Raw(userInput)` — use Razor auto-encoding
- ❌ `AllowAnyOrigin()` in CORS — explicit allowlist only
- ❌ Secrets in `appsettings.json` or env vars checked into source
- ❌ `[AllowAnonymous]` on endpoints without documented justification
- ❌ `SHA256.HashData` for passwords — use BCrypt/Argon2
- ❌ Disabling HTTPS redirection or model validation filters
- ❌ `app.UseDeveloperExceptionPage()` in production — leaks stack traces

## WAF Alignment

| Pillar | C# Security Practices |
| --- | --- |
| **Security** | DefaultAzureCredential, Key Vault secrets, anti-forgery, CSP headers, parameterized queries |
| **Reliability** | Rate limiting prevents overload, input validation rejects bad data early |
| **Cost** | Token bucket limiter controls AI API spend, cached auth tokens reduce Key Vault calls |
| **Operations** | `dotnet audit` in CI, structured security logging, HSTS preload |
| **Performance** | Response caching with security-safe headers, connection pooling via DI |
| **Responsible AI** | Content Safety API on LLM outputs, PII redaction before logging |
