using System.Text.Json;

internal static class HostedDemoAccess
{
    internal const string EasyAuthMode = "container-apps-easy-auth";
    internal const string AnonymousMode = "public-anonymous-demo";

    internal static int Authorize(HttpContext context, IConfiguration configuration)
    {
        var mode = configuration["ACI_AUTH_MODE"];
        if (mode is not (EasyAuthMode or AnonymousMode) ||
            !Guid.TryParse(configuration["ACI_TENANT_ID"], out var tenant) || tenant == Guid.Empty ||
            !Uri.TryCreate(configuration["ACI_PUBLIC_ORIGIN"], UriKind.Absolute, out var publicOrigin) ||
            publicOrigin.Scheme != "https" || publicOrigin.AbsolutePath != "/" || publicOrigin.Query.Length != 0)
            return StatusCodes.Status503ServiceUnavailable;

        if (context.Request.Headers.Origin.FirstOrDefault() is { } origin &&
            !string.Equals(origin.TrimEnd('/'), publicOrigin.GetLeftPart(UriPartial.Authority), StringComparison.OrdinalIgnoreCase))
            return StatusCodes.Status403Forbidden;
        if (HttpMethods.IsPost(context.Request.Method) && context.Request.Headers["Sec-Fetch-Site"].FirstOrDefault() == "cross-site")
            return StatusCodes.Status403Forbidden;

        // Anonymous mode is an explicit operator decision: read-only evidence stays public until the mode is changed back.
        if (mode == AnonymousMode)
        {
            context.Items["aco-principal"] = "public-demo";
            return StatusCodes.Status200OK;
        }

        var encoded = context.Request.Headers["X-MS-CLIENT-PRINCIPAL"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(encoded)) return StatusCodes.Status401Unauthorized;
        if (encoded.Length > 32768 || context.Request.Headers["X-MS-CLIENT-PRINCIPAL"].Count != 1) return StatusCodes.Status403Forbidden;
        try
        {
            using var document = JsonDocument.Parse(Convert.FromBase64String(encoded), new JsonDocumentOptions { MaxDepth = 8 });
            var principal = document.RootElement;
            if (principal.GetProperty("auth_typ").GetString() != "aad") return StatusCodes.Status403Forbidden;
            var claims = principal.GetProperty("claims").EnumerateArray().ToArray();
            if (claims.Length > 128) return StatusCodes.Status403Forbidden;
            string? Claim(params string[] names) => claims.FirstOrDefault(claim => names.Contains(claim.GetProperty("typ").GetString(), StringComparer.Ordinal)) is var match && match.ValueKind == JsonValueKind.Object
                ? match.GetProperty("val").GetString() : null;
            if (!Guid.TryParse(Claim("tid", "http://schemas.microsoft.com/identity/claims/tenantid"), out var actualTenant) || actualTenant != tenant ||
                !Guid.TryParse(Claim("oid", "http://schemas.microsoft.com/identity/claims/objectidentifier"), out var objectId) || objectId == Guid.Empty)
                return StatusCodes.Status403Forbidden;
            var users = ParseIds(configuration["ACI_ALLOWED_OBJECT_IDS"]);
            var operators = ParseIds(configuration["ACI_OPERATOR_OBJECT_IDS"]);
            if (!users.Contains(objectId) && !operators.Contains(objectId)) return StatusCodes.Status403Forbidden;
            if (context.Request.Path.StartsWithSegments("/api/v1/refresh") && !operators.Contains(objectId)) return StatusCodes.Status403Forbidden;
            context.Items["aco-principal"] = objectId.ToString("D");
            return StatusCodes.Status200OK;
        }
        catch (Exception error) when (error is JsonException or FormatException or InvalidOperationException or KeyNotFoundException)
        {
            return StatusCodes.Status403Forbidden;
        }
    }

    private static HashSet<Guid> ParseIds(string? value) => (value ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Where(item => Guid.TryParse(item, out var parsed) && parsed != Guid.Empty).Select(Guid.Parse).ToHashSet();
}