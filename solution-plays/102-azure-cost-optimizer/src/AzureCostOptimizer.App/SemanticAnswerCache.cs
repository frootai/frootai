using System.ClientModel;
using System.Collections.Concurrent;
using Azure.AI.OpenAI;
using Azure.Core;
using OpenAI.Embeddings;

// Semantic cache: a differently worded question about the same evidence revision reuses the validated answer without a model run.
internal sealed class SemanticAnswerCache
{
    private const int Capacity = 64;
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);
    private static readonly ConcurrentDictionary<string, EmbeddingClient> Clients = new(StringComparer.Ordinal);

    private readonly EmbeddingClient _client;
    private readonly double _threshold;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly LinkedList<CachedAnswer> _entries = new();

    private SemanticAnswerCache(EmbeddingClient client, double threshold)
    {
        _client = client;
        _threshold = threshold;
    }

    internal static SemanticAnswerCache? TryCreate(IConfiguration configuration, TokenCredential credential)
    {
        var endpoint = configuration["ACI_EMBEDDING_ENDPOINT"];
        var deployment = configuration["ACI_EMBEDDING_DEPLOYMENT"] ?? "text-embedding-3-small";
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return null;
        if (deployment.Length is 0 or > 64) return null;
        var threshold = double.TryParse(configuration["ACI_SEMANTIC_CACHE_THRESHOLD"], System.Globalization.NumberStyles.Float,
            System.Globalization.CultureInfo.InvariantCulture, out var configured) ? Math.Clamp(configured, 0.5, 0.999) : 0.88;
        try
        {
            var client = Clients.GetOrAdd($"{uri.AbsoluteUri}|{deployment}",
                _ => new AzureOpenAIClient(uri, credential).GetEmbeddingClient(deployment));
            return new SemanticAnswerCache(client, threshold);
        }
        catch (Exception error) when (error is ArgumentException or NotSupportedException or FormatException)
        {
            return null;
        }
    }

    internal async Task<(string? Output, double BestScore, bool Embedded)> FindAsync(string scope, string question, CancellationToken cancellationToken)
    {
        var vector = await EmbedAsync(question, cancellationToken);
        if (vector is null) return (null, 0, false);
        var now = DateTimeOffset.UtcNow;
        await _gate.WaitAsync(cancellationToken);
        try
        {
            Prune(now);
            CachedAnswer? best = null;
            var bestScore = 0d;
            foreach (var entry in _entries)
            {
                if (!string.Equals(entry.Scope, scope, StringComparison.Ordinal)) continue;
                var score = Similarity(entry.Vector, vector);
                if (score > bestScore)
                {
                    bestScore = score;
                    best = entry;
                }
            }
            return (bestScore >= _threshold ? best?.Output : null, bestScore, true);
        }
        finally
        {
            _gate.Release();
        }
    }

    internal async Task StoreAsync(string scope, string question, string output, CancellationToken cancellationToken)
    {
        var vector = await EmbedAsync(question, cancellationToken);
        if (vector is null) return;
        var entry = new CachedAnswer(scope, vector, output, DateTimeOffset.UtcNow.Add(Lifetime));
        await _gate.WaitAsync(cancellationToken);
        try
        {
            Prune(DateTimeOffset.UtcNow);
            _entries.AddFirst(entry);
            while (_entries.Count > Capacity) _entries.RemoveLast();
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<float[]?> EmbedAsync(string question, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(question) || question.Length > 2_000) return null;
        try
        {
            var response = await _client.GenerateEmbeddingAsync(question, cancellationToken: cancellationToken);
            var vector = response.Value.ToFloats().ToArray();
            return vector.Length == 0 ? null : vector;
        }
        catch (Exception error) when (error is ClientResultException or InvalidOperationException or NotSupportedException or TimeoutException or HttpRequestException)
        {
            return null;
        }
    }

    private void Prune(DateTimeOffset now)
    {
        for (var node = _entries.First; node is not null;)
        {
            var next = node.Next;
            if (node.Value.ExpiresAt <= now) _entries.Remove(node);
            node = next;
        }
    }

    private static double Similarity(float[] left, float[] right)
    {
        if (left.Length != right.Length) return 0;
        double dot = 0, leftScale = 0, rightScale = 0;
        for (var index = 0; index < left.Length; index++)
        {
            dot += left[index] * (double)right[index];
            leftScale += left[index] * (double)left[index];
            rightScale += right[index] * (double)right[index];
        }
        var scale = Math.Sqrt(leftScale) * Math.Sqrt(rightScale);
        return scale == 0 ? 0 : dot / scale;
    }

    private sealed record CachedAnswer(string Scope, float[] Vector, string Output, DateTimeOffset ExpiresAt);
}
