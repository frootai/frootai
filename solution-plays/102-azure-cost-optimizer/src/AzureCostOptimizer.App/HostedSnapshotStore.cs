using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Azure;
using Azure.Core;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Azure.Cosmos;

internal sealed class HostedSnapshotStore
{
    internal const string DocumentType = "aco-snapshot-pointer";
    private const string HostedOsUser = "hosted-managed-identity";
    private const int MaximumEntries = 16;
    private static readonly ConcurrentDictionary<string, BlobServiceClient> BlobClients = new(StringComparer.Ordinal);
    private static readonly ConcurrentDictionary<string, CosmosClient> CosmosClients = new(StringComparer.Ordinal);

    private readonly BlobContainerClient _blobs;
    private readonly Container _documents;
    private readonly string _costSource;
    private readonly string? _expectedCurrency;

    private HostedSnapshotStore(BlobContainerClient blobs, Container documents, string costSource, string? expectedCurrency)
    {
        _blobs = blobs;
        _documents = documents;
        _costSource = costSource;
        _expectedCurrency = expectedCurrency;
    }

    internal static HostedSnapshotStore? TryCreate(IConfiguration configuration, TokenCredential credential, out string status)
    {
        status = "disabled-profile";
        if (!string.Equals(configuration["ACI_DATA_PROFILE"], "live", StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(configuration["ACI_HOSTING_PROFILE"], "hosted_demo", StringComparison.Ordinal)) return null;
        status = "unconfigured-store";
        if (!TryEndpoint(configuration["ACI_BLOB_ENDPOINT"], out var blobEndpoint) ||
            !TryEndpoint(configuration["ACI_COSMOS_ENDPOINT"], out var cosmosEndpoint)) return null;
        var container = configuration["ACI_BLOB_CONTAINER"] ?? "normalized-evidence";
        var database = configuration["ACI_COSMOS_DATABASE"] ?? "aci";
        var documents = configuration["ACI_COSMOS_CONTAINER"] ?? "snapshots";
        if (!IsName(container) || !IsName(database) || !IsName(documents)) return null;
        var costSource = configuration["ACI_COST_SOURCE"] ?? "query";
        if (costSource is not ("query" or "cost-details" or "exports")) return null;
        var currency = configuration["ACI_CURRENCY"];
        if (currency is { Length: > 0 } && !IsCurrency(currency)) return null;
        try
        {
            var blobs = BlobClients
                .GetOrAdd(blobEndpoint.AbsoluteUri, uri => new BlobServiceClient(new Uri(uri, UriKind.Absolute), credential))
                .GetBlobContainerClient(container);
            var cosmos = CosmosClients
                .GetOrAdd(cosmosEndpoint.AbsoluteUri, uri => new CosmosClient(uri, credential, new CosmosClientOptions
                {
                    ApplicationName = "azure-cost-optimizer",
                    ConnectionMode = ConnectionMode.Gateway,
                }))
                .GetContainer(database, documents);
            status = "available";
            return new HostedSnapshotStore(blobs, cosmos, costSource, currency is { Length: > 0 } ? currency : null);
        }
        catch (Exception error) when (IsStoreFailure(error))
        {
            status = "unavailable-store";
            return null;
        }
    }

    internal async Task<string> SaveAsync(EvidenceSnapshot snapshot, SubscriptionIdentity identity, DateTimeOffset authorizedAt, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var envelope = new DurableSnapshotEnvelope(1, DurableSnapshotStore.SourceContractVersion, "live", HostedOsUser, identity, _costSource,
            snapshot.Summary.RequestedPeriod.Start, snapshot.Summary.RequestedPeriod.End.AddDays(1), snapshot.Summary.FinancialBasis,
            snapshot.Summary.TotalCost.Currency, snapshot.Summary.ReportId, authorizedAt, authorizedAt.Add(DurableSnapshotStore.MaximumAge), now, snapshot);
        if (!DurableSnapshotStore.IsValidEnvelope(envelope, identity, _costSource, _expectedCurrency, now)) return "not-saved-invalid";
        var payload = JsonSerializer.SerializeToUtf8Bytes(envelope, DurableSnapshotStore.SnapshotJsonOptions);
        if (payload.Length > DurableSnapshotStore.MaximumSnapshotBytes) return "not-saved-oversize";

        var partition = Partition(identity);
        var blobName = BlobName(partition, snapshot.Summary.PeriodKey, envelope.ReportId);
        var contentHash = Convert.ToHexStringLower(SHA256.HashData(payload));
        var blob = _blobs.GetBlobClient(blobName);
        await blob.UploadAsync(new BinaryData(payload), new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = "application/json" },
            Metadata = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["contentsha256"] = contentHash,
                ["reportid"] = envelope.ReportId,
            },
        }, cancellationToken);

        // The revision pointer is published only after the stored object reads back byte-identical.
        var stored = await blob.DownloadContentAsync(cancellationToken);
        if (!Convert.ToHexStringLower(SHA256.HashData(stored.Value.Content.ToArray())).Equals(contentHash, StringComparison.Ordinal)) return "not-saved-unverified";

        var document = new HostedSnapshotDocument
        {
            id = snapshot.Summary.PeriodKey,
            scopePartition = partition,
            type = DocumentType,
            schemaVersion = 1,
            sourceContractVersion = envelope.SourceContractVersion,
            costSource = envelope.CostSource,
            tenantId = identity.TenantId.ToString("D"),
            subscriptionId = identity.SubscriptionId.ToString("D"),
            principalId = identity.PrincipalId.ToString("D"),
            scopeAlias = snapshot.Summary.ScopeAlias,
            periodKey = snapshot.Summary.PeriodKey,
            periodStart = Text(envelope.PeriodStart),
            periodEndExclusive = Text(envelope.PeriodEndExclusive),
            financialBasis = envelope.FinancialBasis,
            currency = envelope.Currency,
            reportId = envelope.ReportId,
            totalCost = snapshot.Summary.TotalCost.Amount.ToString("0.#############################", System.Globalization.CultureInfo.InvariantCulture),
            collectedAt = Text(snapshot.Summary.CollectedAt),
            authorizedAt = Text(envelope.AuthorizedAt),
            authorizationExpiresAt = Text(envelope.AuthorizationExpiresAt),
            savedAt = Text(envelope.SavedAt),
            blobName = blobName,
            contentSha256 = contentHash,
            contentBytes = payload.Length,
        };
        await _documents.UpsertItemAsync(document, new PartitionKey(partition), cancellationToken: cancellationToken);
        await TrimAsync(partition, cancellationToken);
        return "saved";
    }

    internal async Task<IReadOnlyList<DurableSnapshotEnvelope>> LoadAsync(SubscriptionIdentity identity, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var partition = Partition(identity);
        var candidates = new List<DurableSnapshotEnvelope>();
        foreach (var document in await ReadDocumentsAsync(partition, cancellationToken))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var envelope = await TryReadEnvelopeAsync(document, identity, partition, now, cancellationToken);
            if (envelope is not null) candidates.Add(envelope);
        }
        return candidates.GroupBy(item => item.Snapshot.Summary.PeriodKey, StringComparer.Ordinal)
            .Where(group => group.Select(item => item.Currency).Distinct(StringComparer.Ordinal).Count() == 1)
            .Select(group => group.OrderByDescending(item => item.Snapshot.Summary.CollectedAt).ThenByDescending(item => item.SavedAt).First())
            .ToArray();
    }

    private async Task<DurableSnapshotEnvelope?> TryReadEnvelopeAsync(HostedSnapshotDocument document, SubscriptionIdentity identity, string partition, DateTimeOffset now, CancellationToken cancellationToken)
    {
        try
        {
            if (document.type != DocumentType || document.schemaVersion != 1 || document.scopePartition != partition ||
                document.sourceContractVersion != DurableSnapshotStore.SourceContractVersion || document.costSource != _costSource ||
                document.tenantId != identity.TenantId.ToString("D") || document.subscriptionId != identity.SubscriptionId.ToString("D") ||
                document.principalId != identity.PrincipalId.ToString("D") || document.id != document.periodKey ||
                !IsHash(document.contentSha256) || document.contentBytes is <= 0 or > DurableSnapshotStore.MaximumSnapshotBytes ||
                document.blobName != BlobName(partition, document.periodKey, document.reportId)) return null;

            var blob = _blobs.GetBlobClient(document.blobName);
            var properties = await blob.GetPropertiesAsync(cancellationToken: cancellationToken);
            if (properties.Value.ContentLength != document.contentBytes) return null;
            var content = (await blob.DownloadContentAsync(cancellationToken)).Value.Content.ToArray();
            if (content.Length != document.contentBytes ||
                !Convert.ToHexStringLower(SHA256.HashData(content)).Equals(document.contentSha256, StringComparison.Ordinal)) return null;

            var envelope = JsonSerializer.Deserialize<DurableSnapshotEnvelope>(content, DurableSnapshotStore.SnapshotJsonOptions);
            if (envelope is null || envelope.OsUserId != HostedOsUser || envelope.ReportId != document.reportId ||
                envelope.Currency != document.currency || envelope.Snapshot.Summary.PeriodKey != document.periodKey ||
                !DurableSnapshotStore.IsValidEnvelope(envelope, identity, _costSource, _expectedCurrency, now)) return null;
            return envelope;
        }
        catch (Exception error) when (IsStoreFailure(error))
        {
            return null;
        }
    }

    private async Task<IReadOnlyList<HostedSnapshotDocument>> ReadDocumentsAsync(string partition, CancellationToken cancellationToken)
    {
        var documents = new List<HostedSnapshotDocument>();
        var options = new QueryRequestOptions { PartitionKey = new PartitionKey(partition), MaxItemCount = MaximumEntries };
        using var iterator = _documents.GetItemQueryIterator<HostedSnapshotDocument>(new QueryDefinition("SELECT * FROM c"), requestOptions: options);
        while (iterator.HasMoreResults && documents.Count <= MaximumEntries * 2)
        {
            foreach (var document in await iterator.ReadNextAsync(cancellationToken)) documents.Add(document);
        }
        return documents.OrderByDescending(item => item.savedAt, StringComparer.Ordinal).ToArray();
    }

    private async Task TrimAsync(string partition, CancellationToken cancellationToken)
    {
        var documents = await ReadDocumentsAsync(partition, cancellationToken);
        foreach (var expired in documents.Skip(MaximumEntries))
        {
            try
            {
                await _documents.DeleteItemAsync<HostedSnapshotDocument>(expired.id, new PartitionKey(partition), cancellationToken: cancellationToken);
            }
            catch (CosmosException) { }
        }
    }

    private static string BlobName(string partition, string periodKey, string reportId) => $"{partition}/{periodKey}/{reportId}.json";

    private static string Partition(SubscriptionIdentity identity) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(
        $"AzureCostOptimizer|hosted-snapshot-v1|{identity.TenantId:D}|{identity.SubscriptionId:D}|{identity.PrincipalId:D}|solution-scope")))[..32];

    private static string Text(DateTimeOffset value) => value.ToString("O", System.Globalization.CultureInfo.InvariantCulture);
    private static bool IsHash(string? value) => value is { Length: 64 } && value.All(char.IsAsciiHexDigitLower);
    private static bool IsCurrency(string? value) => value is { Length: 3 } && value.All(character => character is >= 'A' and <= 'Z');
    private static bool IsName(string? value) => value is { Length: > 0 and <= 64 } && value.All(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '_');

    private static bool TryEndpoint(string? value, out Uri endpoint)
    {
        endpoint = null!;
        if (!Uri.TryCreate(value, UriKind.Absolute, out var parsed) || parsed.Scheme != Uri.UriSchemeHttps ||
            parsed.UserInfo.Length != 0 || parsed.Query.Length != 0 || parsed.Fragment.Length != 0) return false;
        endpoint = parsed;
        return true;
    }

    internal static bool IsStoreFailure(Exception error) => error is RequestFailedException or CosmosException or JsonException or
        InvalidDataException or ArgumentException or NotSupportedException or FormatException or IOException or
        System.Net.Http.HttpRequestException || DurableSnapshotStore.IsStorageFailure(error);
}

// Cosmos serializes these property names verbatim; they must match the stored document and query paths.
internal sealed class HostedSnapshotDocument
{
    public string id { get; set; } = "";
    public string scopePartition { get; set; } = "";
    public string type { get; set; } = "";
    public int schemaVersion { get; set; }
    public string sourceContractVersion { get; set; } = "";
    public string costSource { get; set; } = "";
    public string tenantId { get; set; } = "";
    public string subscriptionId { get; set; } = "";
    public string principalId { get; set; } = "";
    public string scopeAlias { get; set; } = "";
    public string periodKey { get; set; } = "";
    public string periodStart { get; set; } = "";
    public string periodEndExclusive { get; set; } = "";
    public string financialBasis { get; set; } = "";
    public string currency { get; set; } = "";
    public string reportId { get; set; } = "";
    public string totalCost { get; set; } = "";
    public string collectedAt { get; set; } = "";
    public string authorizedAt { get; set; } = "";
    public string authorizationExpiresAt { get; set; } = "";
    public string savedAt { get; set; } = "";
    public string blobName { get; set; } = "";
    public string contentSha256 { get; set; } = "";
    public long contentBytes { get; set; }
}
