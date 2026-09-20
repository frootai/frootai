using System.Text.Json;
using System.Text.Json.Serialization;

// Published Microsoft guidance (WAF cost checklist + FinOps Framework) that the agent can cite alongside customer evidence.
internal static class OptimizationKnowledge
{
    private const int MaximumResults = 12;
    private static readonly Lazy<KnowledgeFile> File = new(Load, LazyThreadSafetyMode.ExecutionAndPublication);

    // Reports need the guidance as typed values rather than the tool's anonymous payload.
    internal static (IReadOnlyList<WafItem> WellArchitected, IReadOnlyList<FinOpsItem> FinOps, IReadOnlyList<KnowledgeSource> Sources) ForReport(IEnumerable<string> services)
    {
        var knowledge = File.Value;
        var names = services.Select(Normalize).Where(item => item.Length > 0).ToArray();
        var waf = knowledge.Waf
            .OrderByDescending(item => names.Any(name => item.Services?.Any(service => name.Contains(Normalize(service), StringComparison.Ordinal)) == true) ? 1 : 0)
            .ThenBy(item => item.Code, StringComparer.Ordinal)
            .ToArray();
        return (waf, knowledge.Finops, knowledge.Sources);
    }

    internal static object Find(string? topic, string? service, int limit)
    {
        var knowledge = File.Value;
        var bounded = Math.Clamp(limit, 1, MaximumResults);
        var topicText = Normalize(topic);
        var serviceText = Normalize(service);

        // A narrow topic must never return an empty framework. Relevance reorders the list; it does not remove the guidance.
        var waf = Rank(knowledge.Waf, item => Score(topicText, serviceText, item.Topics, item.Services, item.Title, item.Recommendation), item => item.Code, bounded)
            .Select(item => new { code = item.Code, title = item.Title, recommendation = item.Recommendation })
            .ToArray();

        var finops = Rank(knowledge.Finops, item => Score(topicText, serviceText, item.Topics, [], item.Title, item.Practice), item => item.Id, bounded)
            .Select(item => new { phase = item.Phase, title = item.Title, practice = item.Practice })
            .ToArray();

        // No identifier-shaped fields are returned: guidance is not citable evidence and must never reach an evidenceIds array.
        return new
        {
            guidanceOnly = true,
            note = "Published Microsoft guidance. It contains no customer cost amounts, no savings estimate, and no evidence IDs. Never cite it as evidence.",
            wellArchitected = waf,
            finOps = finops,
            sources = knowledge.Sources.Select(item => new { title = item.Title, url = item.Url }),
        };
    }

    private static IEnumerable<TItem> Rank<TItem>(IReadOnlyList<TItem> items, Func<TItem, int> score, Func<TItem, string> tieBreak, int limit) =>
        items.OrderByDescending(score).ThenBy(tieBreak, StringComparer.Ordinal).Take(limit);

    private static int Score(string topic, string service, IReadOnlyList<string>? topics, IReadOnlyList<string>? services, string title, string body)
    {
        var score = 0;
        if (service.Length > 0 && services is not null && services.Any(item => Normalize(item).Contains(service, StringComparison.Ordinal) || service.Contains(Normalize(item), StringComparison.Ordinal))) score += 5;
        if (topic.Length > 0 && topics is not null && topics.Any(item => Normalize(item).Contains(topic, StringComparison.Ordinal) || topic.Contains(Normalize(item), StringComparison.Ordinal))) score += 4;
        if (topic.Length > 2 && Normalize(title).Contains(topic, StringComparison.Ordinal)) score += 2;
        if (topic.Length > 2 && Normalize(body).Contains(topic, StringComparison.Ordinal)) score += 1;
        return score;
    }

    private static string Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? "" : value.Trim().ToLowerInvariant();

    private static KnowledgeFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "optimization-knowledge.v1.json");
        if (!System.IO.File.Exists(path)) return KnowledgeFile.Empty;
        try
        {
            var knowledge = JsonSerializer.Deserialize<KnowledgeFile>(System.IO.File.ReadAllBytes(path), new JsonSerializerOptions(JsonSerializerOptions.Web) { MaxDepth = 12 });
            return knowledge is { Waf.Count: > 0 } ? knowledge : KnowledgeFile.Empty;
        }
        catch (Exception error) when (error is JsonException or IOException or UnauthorizedAccessException)
        {
            return KnowledgeFile.Empty;
        }
    }

    internal sealed record KnowledgeFile(
        [property: JsonPropertyName("knowledgeId")] string KnowledgeId,
        [property: JsonPropertyName("sources")] IReadOnlyList<KnowledgeSource> Sources,
        [property: JsonPropertyName("waf")] IReadOnlyList<WafItem> Waf,
        [property: JsonPropertyName("finops")] IReadOnlyList<FinOpsItem> Finops)
    {
        internal static KnowledgeFile Empty { get; } = new("aco-optimization-knowledge-unavailable", [], [], []);
    }

    internal sealed record KnowledgeSource(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("title")] string Title,
        [property: JsonPropertyName("url")] string Url);

    internal sealed record WafItem(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("code")] string Code,
        [property: JsonPropertyName("title")] string Title,
        [property: JsonPropertyName("recommendation")] string Recommendation,
        [property: JsonPropertyName("topics")] IReadOnlyList<string>? Topics,
        [property: JsonPropertyName("services")] IReadOnlyList<string>? Services);

    internal sealed record FinOpsItem(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("phase")] string Phase,
        [property: JsonPropertyName("title")] string Title,
        [property: JsonPropertyName("practice")] string Practice,
        [property: JsonPropertyName("topics")] IReadOnlyList<string>? Topics);
}
