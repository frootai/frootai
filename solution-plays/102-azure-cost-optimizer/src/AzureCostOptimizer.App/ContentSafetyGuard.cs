using Azure;
using Azure.AI.ContentSafety;
using Azure.Core;

// An optional second gate in front of the deterministic checks. It is off unless an endpoint is configured,
// and it fails open by design: a content-safety outage must not take the read-only cost agent down.
internal sealed class ContentSafetyGuard
{
    private readonly ContentSafetyClient _client;
    private readonly int _blockAtSeverity;

    private ContentSafetyGuard(ContentSafetyClient client, int blockAtSeverity)
    {
        _client = client;
        _blockAtSeverity = blockAtSeverity;
    }

    internal static ContentSafetyGuard? TryCreate(IConfiguration configuration, TokenCredential credential)
    {
        if (configuration["ACI_CONTENT_SAFETY_ENDPOINT"] is not { Length: > 0 } endpoint) return null;
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return null;
        var severity = int.TryParse(configuration["ACI_CONTENT_SAFETY_SEVERITY"], out var configured) ? Math.Clamp(configured, 2, 6) : 4;
        return new ContentSafetyGuard(new ContentSafetyClient(uri, credential), severity);
    }

    internal async Task<string?> FindViolationAsync(string text, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        try
        {
            var bounded = text.Length > 8_000 ? text[..8_000] : text;
            var result = await _client.AnalyzeTextAsync(new AnalyzeTextOptions(bounded), cancellationToken);
            var flagged = result.Value.CategoriesAnalysis.FirstOrDefault(item => (item.Severity ?? 0) >= _blockAtSeverity);
            return flagged is null ? null : flagged.Category.ToString();
        }
        catch (Exception error) when (error is RequestFailedException or OperationCanceledException or InvalidOperationException)
        {
            // The deterministic content and injection checks still apply, so an unavailable service is not a safety gap.
            return null;
        }
    }
}
