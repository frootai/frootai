using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Collections.Concurrent;
using Azure.Core;
using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using CsvHelper;
using CsvHelper.Configuration;

public sealed class AzureEvidenceService(HttpClient httpClient, TokenCredential credential, IConfiguration configuration, TimeProvider? timeProvider = null)
{
    private static readonly string[] ManagementScopes = ["https://management.azure.com/.default"];
    private readonly TimeProvider _clock = timeProvider ?? TimeProvider.System;
    private readonly SemaphoreSlim _refreshLock = new(1, 1);
    private readonly ConcurrentDictionary<string, EvidenceSnapshot> _snapshots = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, Lazy<Task<EvidenceSnapshot>>> _inflightRefreshes = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, string> _refreshFailures = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, DateTimeOffset> _retryCircuits = new(StringComparer.OrdinalIgnoreCase);
    private CommonEvidence? _commonEvidence;
    private SubscriptionIdentity? _liveIdentity;
    private LiveCacheAuthorization? _authorization;
    private bool _restoreAttempted;
    private bool IsSnapshotProfile => !string.Equals(configuration["ACI_DATA_PROFILE"], "live", StringComparison.OrdinalIgnoreCase);
    private bool ExtendedCollectionEnabled => string.Equals(configuration["ACI_EXTENDED_COLLECTION_ENABLED"], "true", StringComparison.OrdinalIgnoreCase);

    public EvidenceSnapshot? Current => GetCached(PeriodSelection.MonthToDate.Key);
    public string DurableCacheStatus { get; private set; } = "not-restored";

    public EvidenceSnapshot? GetCached(string? period)
    {
        var selection = PeriodSelection.Parse(period);
        if (!_snapshots.TryGetValue(selection.Key, out var snapshot)) return null;
        var sample = snapshot.CostSourceStatus == "snapshot" || snapshot.DataHealth.Sources.Any(source => source.Source == "focus-snapshot");
        if (IsSnapshotProfile != sample)
        {
            _snapshots.TryRemove(new KeyValuePair<string, EvidenceSnapshot>(selection.Key, snapshot));
            return null;
        }
        if (IsSnapshotProfile) return snapshot;
        var now = _clock.GetUtcNow();
        var (start, endExclusive) = selection.Resolve(now);
        if (_liveIdentity is { } identity && (!IdentityMatchesConfiguration(identity) || _authorization is not { } authorization ||
            authorization.Identity != identity || authorization.ExpiresAt <= now))
        {
            ClearLiveCache();
            return null;
        }
        if (snapshot.Summary.CollectedAt > now || now - snapshot.Summary.CollectedAt >= DurableSnapshotStore.MaximumAge ||
            snapshot.Summary.RequestedPeriod.Start != start || snapshot.Summary.RequestedPeriod.End != endExclusive.AddDays(-1) ||
            (configuration["ACI_CURRENCY"] is { } currency && currency != snapshot.Summary.TotalCost.Currency) ||
            (snapshot.DataHealth.Cache is { } cached && cached.ExpiresAt <= now))
        {
            _snapshots.TryRemove(new KeyValuePair<string, EvidenceSnapshot>(selection.Key, snapshot));
            return null;
        }
        if (snapshot.DataHealth.Cache is { } cache)
        {
            var freshness = now - snapshot.Summary.CollectedAt < TimeSpan.FromMinutes(5) ? "fresh" : "stale";
            if (cache.Freshness != freshness) return snapshot with { DataHealth = snapshot.DataHealth with { Cache = cache with { Freshness = freshness } } };
        }
        return snapshot;
    }

    public async Task RestoreCachedAsync(CancellationToken cancellationToken)
    {
        if (IsSnapshotProfile)
        {
            DurableCacheStatus = "disabled-profile";
            return;
        }
        await _refreshLock.WaitAsync(cancellationToken);
        try
        {
            if (_restoreAttempted) return;
            _restoreAttempted = true;
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            deadline.CancelAfter(TimeSpan.FromSeconds(15));
            var now = _clock.GetUtcNow();
            SubscriptionIdentity identity;
            IReadOnlyList<DurableSnapshotEnvelope> entries;
            var hostedStore = HostedSnapshotStore.TryCreate(configuration, credential, out var hostedStatus);
            if (hostedStore is not null)
            {
                DurableCacheStatus = hostedStatus;
                if (ResolveHostedIdentity() is not { } hostedIdentity)
                {
                    ClearLiveCache();
                    DurableCacheStatus = "unavailable-identity";
                    return;
                }
                identity = hostedIdentity;
                var hostedToken = await credential.GetTokenAsync(new TokenRequestContext(ManagementScopes), deadline.Token);
                if (!await VerifyReadAuthorizationAsync(identity, hostedToken.Token, deadline.Token)) throw new UnauthorizedAccessException();
                entries = await hostedStore.LoadAsync(identity, now, deadline.Token);
            }
            else
            {
                var store = DurableSnapshotStore.TryCreate(configuration, out var status);
                DurableCacheStatus = status;
                if (store is null) return;
                if (!store.HasEntries())
                {
                    DurableCacheStatus = "empty";
                    return;
                }
                if (credential is not ISubscriptionIdentityCredential)
                {
                    ClearLiveCache();
                    DurableCacheStatus = "unavailable-identity";
                    return;
                }
                var selected = await GetSelectedIdentityAsync(deadline.Token);
                if (!await VerifyReadAuthorizationAsync(selected.Identity, selected.AccessToken.Token, deadline.Token)) throw new UnauthorizedAccessException();
                identity = selected.Identity;
                entries = await store.LoadAsync(identity, now, deadline.Token);
            }
            if (!IdentityMatchesConfiguration(identity)) throw new UnauthorizedAccessException();
            ClearLiveCache();
            _liveIdentity = identity;
            _authorization = new LiveCacheAuthorization(identity, now.Add(DurableSnapshotStore.MaximumAge));
            foreach (var entry in entries)
            {
                var expiresAt = entry.Snapshot.Summary.CollectedAt.Add(DurableSnapshotStore.MaximumAge);
                if (entry.AuthorizationExpiresAt < expiresAt) expiresAt = entry.AuthorizationExpiresAt;
                if (entry.PeriodEndExclusive < expiresAt) expiresAt = entry.PeriodEndExclusive;
                var restored = entry.Snapshot with
                {
                    DataHealth = entry.Snapshot.DataHealth with
                    {
                        Cache = new SnapshotCacheDto("durable-cache",
                            now - entry.Snapshot.Summary.CollectedAt < TimeSpan.FromMinutes(5) ? "fresh" : "stale", now, expiresAt),
                    },
                };
                _snapshots[restored.Summary.PeriodKey] = restored;
            }
            DurableCacheStatus = entries.Count == 0 ? "empty-or-rejected" : "restored";
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            ClearLiveCache();
            DurableCacheStatus = "restore-cancelled";
            throw;
        }
        catch (Exception error) when (error is AuthenticationFailedException or UnauthorizedAccessException)
        {
            ClearLiveCache();
            DurableCacheStatus = "authorization-denied";
        }
        catch (Exception error) when (DurableSnapshotStore.IsStorageFailure(error) || HostedSnapshotStore.IsStoreFailure(error) || error is HttpRequestException or OperationCanceledException or
            InvalidOperationException or KeyNotFoundException or System.ComponentModel.Win32Exception)
        {
            ClearLiveCache();
            DurableCacheStatus = "restore-unavailable";
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    private async ValueTask<SubscriptionIdentityToken> GetSelectedIdentityAsync(CancellationToken cancellationToken)
    {
        var selected = await ((ISubscriptionIdentityCredential)credential).GetSubscriptionTokenAsync(configuration["ACI_TENANT_ID"], cancellationToken);
        if (!IdentityMatchesConfiguration(selected.Identity) || string.IsNullOrWhiteSpace(selected.AccessToken.Token) || selected.AccessToken.ExpiresOn <= _clock.GetUtcNow())
            throw new UnauthorizedAccessException("The selected Azure identity is not valid for the configured scope.");
        return selected;
    }

    private bool IdentityMatchesConfiguration(SubscriptionIdentity identity) => identity.TenantId != Guid.Empty && identity.PrincipalId != Guid.Empty &&
        Guid.TryParse(configuration["ACI_SUBSCRIPTION_ID"], out var subscription) && subscription != Guid.Empty && identity.SubscriptionId == subscription &&
        (string.IsNullOrWhiteSpace(configuration["ACI_TENANT_ID"]) || Guid.TryParse(configuration["ACI_TENANT_ID"], out var tenant) && identity.TenantId == tenant);

    // Hosted collection runs as the deployed managed identity, which has no Azure CLI subscription context.
    private SubscriptionIdentity? ResolveHostedIdentity() =>
        Guid.TryParse(configuration["ACI_TENANT_ID"], out var tenant) && tenant != Guid.Empty &&
        Guid.TryParse(configuration["ACI_SUBSCRIPTION_ID"], out var subscription) && subscription != Guid.Empty &&
        Guid.TryParse(configuration["ACI_COLLECTOR_PRINCIPAL_ID"], out var principal) && principal != Guid.Empty
            ? new SubscriptionIdentity(tenant, subscription, principal)
            : null;

    private async Task<bool> VerifyReadAuthorizationAsync(SubscriptionIdentity identity, string accessToken, CancellationToken cancellationToken)
    {
        var uri = new Uri($"https://management.azure.com/subscriptions/{identity.SubscriptionId:D}/providers/Microsoft.Authorization/permissions?api-version=2015-07-01");
        using var response = await SendAsync(HttpMethod.Get, uri.AbsoluteUri, accessToken, null, cancellationToken);
        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden) throw new UnauthorizedAccessException();
        response.EnsureSuccessStatusCode();
        if (response.RequestMessage?.RequestUri != uri || response.Content.Headers.ContentLength > 65536) return false;
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        var buffer = new byte[65537];
        var length = await stream.ReadAtLeastAsync(buffer, buffer.Length, throwOnEndOfStream: false, cancellationToken);
        if (length > 65536) return false;
        using var document = JsonDocument.Parse(buffer.AsMemory(0, length), new JsonDocumentOptions { MaxDepth = 16 });
        var root = document.RootElement;
        if (root.TryGetProperty("nextLink", out var nextLink) && nextLink.ValueKind != JsonValueKind.Null &&
            (nextLink.ValueKind != JsonValueKind.String || !string.IsNullOrEmpty(nextLink.GetString()))) return false;
        var permissions = root.GetProperty("value").EnumerateArray().ToArray();
        if (permissions.Length is 0 or > 128) return false;
        var required = new[]
        {
            configuration["ACI_COST_SOURCE"] switch
            {
                "cost-details" => "Microsoft.CostManagement/generateCostDetailsReport/action",
                "exports" => "Microsoft.CostManagement/exports/read",
                _ => "Microsoft.CostManagement/query/read",
            },
            "Microsoft.Advisor/recommendations/read",
            "Microsoft.ResourceGraph/resources/read",
            "Microsoft.Resources/subscriptions/resources/read",
        };
        return required.All(operation => permissions.Any(permission =>
            (!permission.TryGetProperty("condition", out var condition) || condition.ValueKind == JsonValueKind.Null ||
                condition.ValueKind == JsonValueKind.String && string.IsNullOrEmpty(condition.GetString())) &&
            MatchesPermission(permission.GetProperty("actions"), operation) && !MatchesPermission(permission.GetProperty("notActions"), operation)));
    }

    private static bool MatchesPermission(JsonElement patterns, string operation)
    {
        if (patterns.ValueKind != JsonValueKind.Array || patterns.GetArrayLength() > 128) throw new InvalidDataException();
        return patterns.EnumerateArray().Any(item =>
        {
            var pattern = item.GetString();
            if (string.IsNullOrEmpty(pattern) || pattern.Length > 512 || pattern.Any(character => !char.IsAsciiLetterOrDigit(character) && character is not ('.' or '/' or '*' or '-')))
                throw new InvalidDataException();
            return System.IO.Enumeration.FileSystemName.MatchesSimpleExpression(pattern, operation, ignoreCase: true);
        });
    }

    private void ClearLiveCache()
    {
        _snapshots.Clear();
        _commonEvidence = null;
        _liveIdentity = null;
        _authorization = null;
        _retryCircuits.Clear();
        _refreshFailures.Clear();
    }

    private async Task PersistPublishedAsync(EvidenceSnapshot snapshot, SubscriptionIdentity? identity, CancellationToken cancellationToken)
    {
        if (identity is null)
        {
            DurableCacheStatus = "unavailable-identity";
            return;
        }
        if (snapshot.DataHealth.Status != "fresh" || snapshot.DataHealth.Sources.Any(source => !source.Complete))
        {
            DurableCacheStatus = "not-saved-partial";
            return;
        }
        try
        {
            var hostedStore = HostedSnapshotStore.TryCreate(configuration, credential, out var hostedStatus);
            if (hostedStore is not null)
            {
                DurableCacheStatus = hostedStatus;
                DurableCacheStatus = await hostedStore.SaveAsync(snapshot, identity, snapshot.Summary.CollectedAt, _clock.GetUtcNow(), cancellationToken);
                return;
            }
            var store = DurableSnapshotStore.TryCreate(configuration, out var status);
            DurableCacheStatus = status;
            if (store is null) return;
            DurableCacheStatus = await store.SaveAsync(snapshot, identity, snapshot.Summary.CollectedAt, _clock.GetUtcNow(), cancellationToken)
                ? "saved" : "not-saved-invalid";
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { DurableCacheStatus = "save-cancelled"; }
        catch (Exception error) when (DurableSnapshotStore.IsStorageFailure(error) || HostedSnapshotStore.IsStoreFailure(error)) { DurableCacheStatus = "save-unavailable"; }
    }

    private sealed record LiveCacheAuthorization(SubscriptionIdentity Identity, DateTimeOffset ExpiresAt);

    public async Task WarmAsync(CancellationToken cancellationToken)
    {
        await RefreshAsync(PeriodSelection.MonthToDate.Key, cancellationToken);
    }

    public string GetCacheStatus(string? period)
    {
        var periodKey = PeriodSelection.Parse(period).Key;
        var refreshKey = GetRefreshKey(periodKey);
        if (_inflightRefreshes.ContainsKey(refreshKey)) return "refreshing";
        if (GetCached(periodKey) is not null) return "ready";
        if (_retryCircuits.ContainsKey(refreshKey)) return "deferred-throttled";
        return _refreshFailures.ContainsKey(refreshKey) ? "failed" : "warming";
    }

    public string GetRefreshOperationId(string? period) => $"op_{Sha256(GetRefreshKey(PeriodSelection.Parse(period).Key))[..24]}";
    public string? GetRefreshFailure(string? period) => _refreshFailures.GetValueOrDefault(GetRefreshKey(PeriodSelection.Parse(period).Key));
    public DateTimeOffset? GetRetryAt(string? period) => _retryCircuits.TryGetValue(GetRefreshKey(PeriodSelection.Parse(period).Key), out var retryAt) ? retryAt : null;

    public async Task<EvidenceSnapshot> RefreshAsync(string? period, CancellationToken cancellationToken)
    {
        var periodKey = PeriodSelection.Parse(period).Key;
        var refreshKey = GetRefreshKey(periodKey);
        if (_retryCircuits.TryGetValue(refreshKey, out var retryAt) && retryAt > _clock.GetUtcNow())
        {
            if (GetCached(periodKey) is { } deferred) return deferred;
            throw new InvalidOperationException($"Cost Management refresh is deferred until {retryAt:O}.");
        }
        _retryCircuits.TryRemove(refreshKey, out _);
        _refreshFailures.TryRemove(refreshKey, out _);
        var refresh = _inflightRefreshes.GetOrAdd(
            refreshKey,
            _ => new Lazy<Task<EvidenceSnapshot>>(
                () => RunRefreshAsync(periodKey, refreshKey),
                LazyThreadSafetyMode.ExecutionAndPublication));
        var task = refresh.Value;
        try
        {
            return await task.WaitAsync(cancellationToken);
        }
        finally
        {
            _ = task.ContinueWith(
                _ => _inflightRefreshes.TryRemove(new KeyValuePair<string, Lazy<Task<EvidenceSnapshot>>>(refreshKey, refresh)),
                CancellationToken.None,
                TaskContinuationOptions.ExecuteSynchronously,
                TaskScheduler.Default);
        }
    }

    private async Task<EvidenceSnapshot> RunRefreshAsync(string period, string refreshKey)
    {
        var timeoutSeconds = int.TryParse(configuration["ACI_MANUAL_REFRESH_TIMEOUT_SECONDS"], CultureInfo.InvariantCulture, out var configuredTimeout)
            ? Math.Clamp(configuredTimeout, 1, 120)
            : 120;
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));
        try
        {
            return await RefreshCoreAsync(period, true, deadline.Token);
        }
        catch (Exception error)
        {
            _refreshFailures[refreshKey] = error.GetBaseException() switch
            {
                AuthenticationFailedException or UnauthorizedAccessException => "source-access-denied",
                OperationCanceledException or TimeoutException => "collection-deadline",
                SourceThrottledException => "source-throttled",
                HttpRequestException http => $"source-http-{(http.StatusCode is { } status ? ((int)status).ToString(CultureInfo.InvariantCulture) : "unavailable")}",
                JsonException or InvalidDataException => "source-data-invalid",
                _ => "collection-failed",
            };
            throw;
        }
    }

    private string GetRefreshKey(string period)
    {
        var (start, endExclusive) = PeriodSelection.Parse(period).Resolve(_clock.GetUtcNow());
        return string.Join('|', configuration["ACI_TENANT_ID"], configuration["ACI_SUBSCRIPTION_ID"], "local-os-operator", "solution-scope", period,
            start.ToString("O", CultureInfo.InvariantCulture), endExclusive.ToString("O", CultureInfo.InvariantCulture), "billed", DurableSnapshotStore.SourceContractVersion, configuration["ACI_COST_SOURCE"] ?? "query");
    }

    private async Task<EvidenceSnapshot> RefreshCoreAsync(string period, bool refreshCommonEvidence, CancellationToken cancellationToken)
    {
        await _refreshLock.WaitAsync(cancellationToken);
        try
        {
            var selection = PeriodSelection.Parse(period);
            if (!refreshCommonEvidence && GetCached(selection.Key) is { } cached) return cached;
            if (IsSnapshotProfile)
            {
                var snapshot = LoadSolutionSnapshot(selection);
                _snapshots[selection.Key] = snapshot;
                return snapshot;
            }
            var subscriptionId = configuration["ACI_SUBSCRIPTION_ID"]
                ?? throw new InvalidOperationException("ACI_SUBSCRIPTION_ID is required.");
            SubscriptionIdentity? collectionIdentity = null;
            AccessToken token;
            try
            {
                if (credential is ISubscriptionIdentityCredential)
                {
                    var selected = await GetSelectedIdentityAsync(cancellationToken);
                    collectionIdentity = selected.Identity;
                    if (_liveIdentity != collectionIdentity) ClearLiveCache();
                    _liveIdentity = collectionIdentity;
                    subscriptionId = collectionIdentity.SubscriptionId.ToString("D");
                    token = selected.AccessToken;
                }
                else
                {
                    token = await credential.GetTokenAsync(new TokenRequestContext(ManagementScopes), cancellationToken);
                    collectionIdentity = ResolveHostedIdentity();
                }
            }
            catch
            {
                ClearLiveCache();
                DurableCacheStatus = "authorization-denied";
                throw;
            }
            var (periodStart, periodEndExclusive) = selection.Resolve(_clock.GetUtcNow());

            try
            {
                var cost = await GetCostsAsync(subscriptionId, selection, periodStart, periodEndExclusive, token.Token, cancellationToken);
                if (refreshCommonEvidence || _commonEvidence is null)
                {
                    _commonEvidence = new CommonEvidence(
                        await GetAdvisorAsync(subscriptionId, token.Token, cancellationToken),
                        await GetResourceCountAsync(subscriptionId, token.Token, cancellationToken));
                }
                var advisor = _commonEvidence.Advisor.Items;
                var resourceCount = _commonEvidence.ResourceGraph.ResourceCount;
                var collectedAt = _clock.GetUtcNow();
                var costSourceName = cost.Status.StartsWith("cost-exports", StringComparison.Ordinal) ? "cost-exports"
                    : cost.Status.StartsWith("cost-details", StringComparison.Ordinal) ? "cost-details"
                    : "cost-management-query";
                var costApiVersion = costSourceName == "cost-exports" ? "2023-11-01" : "2025-03-01";
                var receipts = new[]
                {
                    CreateReceipt(costSourceName, costApiVersion, selection, periodStart, periodEndExclusive.AddDays(-1), collectedAt, cost.Complete, cost.Currency, "billed", cost.Artifact, null, collectionIdentity),
                    CreateReceipt("advisor", "2025-01-01", selection, periodStart, periodEndExclusive.AddDays(-1), collectedAt, _commonEvidence.Advisor.Complete, null, "not-applicable", _commonEvidence.Advisor.Artifact, advisor.Select(item => item.EvidenceId), collectionIdentity),
                    CreateReceipt("resource-graph", "2022-10-01", selection, periodStart, periodEndExclusive.AddDays(-1), collectedAt, true, null, "not-applicable", _commonEvidence.ResourceGraph.Artifact, null, collectionIdentity),
                };
                var reportId = CreateReportId(subscriptionId, selection, periodStart, periodEndExclusive, receipts);
                var supportedEstimates = advisor
                    .Where(item => item.EstimatedAnnualSavings is not null && string.Equals(item.SavingsCurrency, cost.Currency, StringComparison.OrdinalIgnoreCase))
                    .Select(item => item.EstimatedAnnualSavings!.Value)
                    .ToArray();
                decimal? estimatedOpportunity = supportedEstimates.Length == 0 ? null : supportedEstimates.Sum();
                var opportunities = advisor.Select(item => CreateAdvisorOpportunity(
                    item,
                    "solution-scope",
                    cost.Currency,
                    "billed",
                    cost.Complete && _commonEvidence.Advisor.Complete,
                    [item.EvidenceId, receipts[0].EvidenceId, receipts[2].EvidenceId])).ToArray();
                var status = cost.Complete && _commonEvidence.Advisor.Complete ? "fresh" : "partial";

                var snapshot = new EvidenceSnapshot(
                    new SummaryDto(reportId, "solution-scope", selection.Key, selection.Label, new PeriodDto(periodStart, periodEndExclusive.AddDays(-1)), "billed", new MoneyDto(cost.Total, cost.Currency), estimatedOpportunity, collectedAt, status, cost.Services, cost.Daily, cost.ResourceGroups ?? []),
                    opportunities,
                    advisor.Select(item => new AdvisorFindingDto(item.FindingId, item.Title, item.ResourceAlias, item.EvidenceId, item.EstimatedAnnualSavings, item.SavingsCurrency)).ToArray(),
                    new DataHealthDto(status, receipts.Select(item => item.ContentSha256).ToArray(), receipts, cost.ExcludedRows, resourceCount, null, null),
                    cost.Status);
                if (collectionIdentity is not null)
                {
                    if (!IdentityMatchesConfiguration(collectionIdentity)) throw new UnauthorizedAccessException();
                    _liveIdentity = collectionIdentity;
                    _authorization = new LiveCacheAuthorization(collectionIdentity, collectedAt.Add(DurableSnapshotStore.MaximumAge));
                }
                _snapshots[selection.Key] = snapshot;
                await PersistPublishedAsync(snapshot, collectionIdentity, cancellationToken);
                return snapshot;
            }
            catch (Exception error) when (error is UnauthorizedAccessException || error is HttpRequestException { StatusCode: HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized })
            {
                ClearLiveCache();
                DurableCacheStatus = "authorization-denied";
                throw new UnauthorizedAccessException("The selected Azure identity no longer has access to this evidence scope.");
            }
            catch (SourceThrottledException throttled) when (GetCached(selection.Key) is { } previous)
            {
                _retryCircuits[GetRefreshKey(selection.Key)] = throttled.RetryAt;
                var collectedAt = _clock.GetUtcNow();
                var throttledReceipt = CreateReceipt(
                    "cost-management-query",
                    "2025-03-01",
                    selection,
                    periodStart,
                    periodEndExclusive.AddDays(-1),
                    collectedAt,
                    false,
                    previous.Summary.TotalCost.Currency,
                    previous.Summary.FinancialBasis,
                    throttled.Artifact,
                    null,
                    collectionIdentity) with
                {
                    Status = "throttled",
                    SafeIssueCode = "cost-management-429",
                    RetryAt = throttled.RetryAt,
                };
                // A throttled attempt collected nothing, so the previously validated evidence is unchanged and keeps its own status.
                // The failed attempt stays visible as a receipt with its retry time; repeated polls replace it instead of accumulating.
                var receipts = previous.DataHealth.Sources
                    .Where(item => !string.Equals(item.Status, "throttled", StringComparison.Ordinal))
                    .Append(throttledReceipt)
                    .ToArray();
                var deferred = previous with
                {
                    DataHealth = previous.DataHealth with
                    {
                        SourceReceiptHashes = receipts.Select(item => item.ContentSha256).Distinct(StringComparer.Ordinal).ToArray(),
                        Sources = receipts,
                        FailedSource = "cost-management-query",
                        RetryAt = throttled.RetryAt,
                    },
                    CostSourceStatus = "deferred-throttled",
                };
                _snapshots[selection.Key] = deferred;
                return deferred;
            }
            catch (SourceThrottledException throttled)
            {
                _retryCircuits[GetRefreshKey(selection.Key)] = throttled.RetryAt;
                throw;
            }
            catch when (GetCached(selection.Key) is { } previous)
            {
                var degraded = previous with
                {
                    Summary = previous.Summary with { Status = "degraded" },
                    DataHealth = previous.DataHealth with { Status = "degraded" },
                    CostSourceStatus = "degraded-cached",
                };
                _snapshots[selection.Key] = degraded;
                return degraded;
            }
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    private static EvidenceSnapshot LoadSolutionSnapshot(PeriodSelection selection)
    {
        var fixturePath = Path.Combine(AppContext.BaseDirectory, "Data", "solution-snapshot.v1.json");
        var fixtureJson = File.ReadAllText(fixturePath);
        var fixture = JsonSerializer.Deserialize<SolutionSnapshotFixture>(fixtureJson, JsonSerializerOptions.Web)
            ?? throw new InvalidDataException("The solution snapshot fixture is empty.");
        if (fixture.SchemaVersion != "1.0.0" || fixture.Profile != "solution_snapshot" || fixture.ScopeAlias != "solution-scope" || fixture.FinancialBasis != "billed")
        {
            throw new InvalidDataException("The solution snapshot envelope is not supported.");
        }
        var payloadJson = JsonSerializer.Serialize(fixture.Payload, JsonSerializerOptions.Web);
        var payloadHash = Sha256(payloadJson);
        if (!CryptographicOperations.FixedTimeEquals(Convert.FromHexString(payloadHash), Convert.FromHexString(fixture.ContentSha256)))
        {
            throw new InvalidDataException("The solution snapshot content hash is invalid.");
        }
        if (fixture.Payload.Services.Length == 0 || fixture.Payload.Daily.Length == 0 || fixture.Currency.Length != 3)
        {
            throw new InvalidDataException("The solution snapshot does not contain a complete financial fixture.");
        }
        var serviceTotal = fixture.Payload.Services.Sum(item => item.Amount);
        var dailyTotal = fixture.Payload.Daily.Sum(item => item.Amount);
        if (serviceTotal != dailyTotal)
        {
            throw new InvalidDataException("The solution snapshot totals do not reconcile.");
        }

        var (requestedStart, requestedEndExclusive) = selection.Resolve(DateTimeOffset.UtcNow);
        var requestedPeriod = new PeriodDto(requestedStart, requestedEndExclusive.AddDays(-1));
        var receiptEvidenceId = $"ev_{payloadHash[..20]}";
        var evidenceIds = new[] { receiptEvidenceId }
            .Concat(fixture.Payload.Advisor.Select(item => item.EvidenceId))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        var receipt = new SourceReceiptDto(
            "1.0.0",
            "focus-snapshot",
            "focus-1.2-sanitized",
            fixture.TenantAlias,
            fixture.ScopeAlias,
            ReceiptPeriodDto.From(requestedPeriod.Start, requestedPeriod.End),
            ReceiptPeriodDto.From(fixture.Payload.ActualPeriod.Start, fixture.Payload.ActualPeriod.End),
            fixture.FinancialBasis,
            fixture.Currency,
            fixture.PublishedAt,
            "complete",
            true,
            new SourceCountsDto(0, 1, fixture.Payload.Services.Length + fixture.Payload.Daily.Length + fixture.Payload.Advisor.Length, Encoding.UTF8.GetByteCount(payloadJson), null),
            null,
            null,
            payloadHash,
            evidenceIds);
        var reportHash = Sha256(JsonSerializer.Serialize(new { fixture.ContentSha256, selection.Key, requestedPeriod }, JsonSerializerOptions.Web));
        var reportId = $"rpt_{reportHash}";
        var supportedEstimates = fixture.Payload.Advisor
            .Where(item => item.EstimatedAnnualSavings is not null && string.Equals(item.SavingsCurrency, fixture.Currency, StringComparison.OrdinalIgnoreCase))
            .Select(item => item.EstimatedAnnualSavings!.Value)
            .ToArray();
        decimal? estimatedOpportunity = supportedEstimates.Length == 0 ? null : supportedEstimates.Sum();
        var opportunities = fixture.Payload.Advisor.Select(item => CreateAdvisorOpportunity(
            new AdvisorRecord(item.FindingId, item.Title, item.ResourceAlias, item.EvidenceId, item.EstimatedAnnualSavings, item.SavingsCurrency),
            fixture.ScopeAlias,
            fixture.Currency,
            fixture.FinancialBasis,
            true,
            [item.EvidenceId, receipt.EvidenceId])).ToArray();
        return new EvidenceSnapshot(
            new SummaryDto(reportId, fixture.ScopeAlias, selection.Key, selection.Label, requestedPeriod, fixture.FinancialBasis, new MoneyDto(serviceTotal, fixture.Currency), estimatedOpportunity, fixture.PublishedAt, "fresh", fixture.Payload.Services, fixture.Payload.Daily),
            opportunities,
            fixture.Payload.Advisor,
            new DataHealthDto("fresh", [receipt.ContentSha256], [receipt], 0, fixture.Payload.ResourceCount, null, null),
            "snapshot");
    }

    private static OpportunityDto CreateAdvisorOpportunity(AdvisorRecord item, string scopeAlias, string currency, string financialBasis, bool complete, IReadOnlyList<string> evidenceIds) => new(
        "1.0.0",
        $"opp_{Sha256(item.FindingId)[..20]}",
        "aco-advisor-normalize-v1",
        scopeAlias,
        item.ResourceAlias,
        "advisor",
        item.Title,
        financialBasis,
        currency,
        MoneyOrUnknownDto.Unknown("Advisor does not provide observed resource cost."),
        item.EstimatedAnnualSavings is decimal saving && item.SavingsCurrency is not null
            ? MoneyOrUnknownDto.Known(saving, item.SavingsCurrency)
            : MoneyOrUnknownDto.Unknown("Advisor did not provide a supported savings estimate and currency."),
        MoneyOrUnknownDto.Unknown("No human-approved target is recorded."),
        MoneyOrUnknownDto.Unknown("No post-change realization evidence is recorded."),
        complete ? 1m : 0m,
        complete,
        evidenceIds.Distinct(StringComparer.Ordinal).ToArray(),
        ["reliability", "security", "performance-efficiency"],
        null,
        "needs-review",
        "Assign an owner and review the Advisor finding, cost evidence, and cross-pillar risks before approving any action.");

    private SourceReceiptDto CreateReceipt(string source, string apiVersion, PeriodSelection selection, DateTimeOffset requestedStart, DateTimeOffset requestedEnd, DateTimeOffset collectedAt, bool complete, string? currency, string financialBasis, SourceArtifact artifact, IEnumerable<string>? itemEvidenceIds, SubscriptionIdentity? identity = null)
    {
        var receiptEvidenceId = $"ev_{artifact.ContentSha256[..20]}";
        var evidenceIds = new[] { receiptEvidenceId }
            .Concat(itemEvidenceIds ?? [])
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        var tenantAlias = $"tenant-{Sha256(identity?.TenantId.ToString("D") ?? configuration["ACI_TENANT_ID"] ?? "local-cli-tenant")[..12]}";
        return new SourceReceiptDto(
            "1.0.0",
            source,
            apiVersion,
            tenantAlias,
            "solution-scope",
            ReceiptPeriodDto.From(requestedStart, requestedEnd),
            ReceiptPeriodDto.From(requestedStart, requestedEnd),
            financialBasis,
            currency,
            collectedAt,
            complete ? "complete" : "partial",
            complete,
                new SourceCountsDto(artifact.Requests, artifact.Pages, artifact.Rows, artifact.Bytes, artifact.QueryProcessingUnits),
            complete ? null : "partial-source-data",
            null,
                artifact.ContentSha256,
            evidenceIds);
    }

    private async Task<CostResult> GetCostsAsync(string subscriptionId, PeriodSelection selection, DateTimeOffset start, DateTimeOffset endExclusive, string token, CancellationToken cancellationToken)
    {
        var source = configuration["ACI_COST_SOURCE"] ?? "query";
        if (source == "exports") return await GetExportCostsAsync(start, endExclusive, cancellationToken);
        if (source == "cost-details") return await GetCostDetailsAsync(subscriptionId, start, endExclusive, token, cancellationToken);
        if (source != "query") throw new InvalidOperationException("ACI_COST_SOURCE must be query or cost-details.");
        var body = new JsonObject
        {
            ["type"] = "ActualCost",
            ["timeframe"] = selection.Key == PeriodSelection.MonthToDate.Key ? "MonthToDate" : "Custom",
            ["dataset"] = new JsonObject
            {
                ["granularity"] = "Daily",
                ["aggregation"] = new JsonObject { ["totalCost"] = new JsonObject { ["name"] = "Cost", ["function"] = "Sum" } },
                ["grouping"] = new JsonArray(
                    new JsonObject { ["type"] = "Dimension", ["name"] = "ServiceName" },
                    new JsonObject { ["type"] = "Dimension", ["name"] = "ResourceGroupName" }),
            },
        };
        if (selection.Key != PeriodSelection.MonthToDate.Key)
        {
            body["timePeriod"] = new JsonObject { ["from"] = start.ToString("O"), ["to"] = endExclusive.AddTicks(-1).ToString("O") };
        }
        var requestUri = $"https://management.azure.com/subscriptions/{Uri.EscapeDataString(subscriptionId)}/providers/Microsoft.CostManagement/query?api-version=2025-03-01";
        var serviceTotals = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var resourceGroupTotals = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var dailyTotals = new SortedDictionary<DateOnly, decimal>();
        var currencies = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var payloads = new List<byte[]>();
        var requestCount = 0;
        var successfulPages = 0;
        var rowCount = 0;
        var excludedRows = 0;
        var queryProcessingUnits = 0;
        var complete = true;
        for (var page = 0; page < 10; page++)
        {
            var queryResponse = await SendCostQueryWithRetryAsync(requestUri, token, body, cancellationToken);
            requestCount += queryResponse.Requests;
            payloads.AddRange(queryResponse.ThrottledPayloads);
            queryProcessingUnits = checked(queryProcessingUnits + queryResponse.QueryProcessingUnits);
            using var response = queryResponse.Response;
            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                if (page == 0)
                {
                    var retryAt = queryResponse.RetryAt ?? DateTimeOffset.UtcNow.AddSeconds(GetRetryAfter(response, 5));
                    var throttleArtifact = CreateArtifact(queryResponse.ThrottledPayloads, requestCount, 0, 0, queryProcessingUnits, true);
                    if (!ExtendedCollectionEnabled) throw new SourceThrottledException(retryAt, throttleArtifact);
                    try
                    {
                        var details = await GetCostDetailsAsync(subscriptionId, start, endExclusive, token, cancellationToken);
                        return details with { Artifact = CombineArtifacts([throttleArtifact, details.Artifact]) };
                    }
                    catch (SourceThrottledException detailsThrottle)
                    {
                        throw new SourceThrottledException(
                            detailsThrottle.RetryAt > retryAt ? detailsThrottle.RetryAt : retryAt,
                            CombineArtifacts([throttleArtifact, detailsThrottle.Artifact]),
                            detailsThrottle);
                    }
                }
                complete = false;
                break;
            }
            response.EnsureSuccessStatusCode();
            var payload = await ReadBoundedPayloadAsync(response.Content, 4 * 1024 * 1024, cancellationToken);
            payloads.Add(payload);
            successfulPages++;
            using var document = JsonDocument.Parse(payload);
            var properties = document.RootElement.GetProperty("properties");
            var columns = properties.GetProperty("columns").EnumerateArray().Select(item => item.GetProperty("name").GetString() ?? "").ToArray();
            var costIndex = Array.FindIndex(columns, item => string.Equals(item, "Cost", StringComparison.OrdinalIgnoreCase));
            var serviceIndex = Array.FindIndex(columns, item => string.Equals(item, "ServiceName", StringComparison.OrdinalIgnoreCase));
            var resourceGroupIndex = Array.FindIndex(columns, item => string.Equals(item, "ResourceGroupName", StringComparison.OrdinalIgnoreCase));
            var dateIndex = Array.FindIndex(columns, item => string.Equals(item, "UsageDate", StringComparison.OrdinalIgnoreCase));
            var currencyIndex = Array.FindIndex(columns, item => string.Equals(item, "Currency", StringComparison.OrdinalIgnoreCase));
            if (costIndex < 0 || serviceIndex < 0 || currencyIndex < 0) throw new InvalidDataException("Cost Management response omitted required columns.");
            var maximumIndex = new[] { costIndex, serviceIndex, currencyIndex, dateIndex, resourceGroupIndex }.Max();
            foreach (var row in properties.GetProperty("rows").EnumerateArray())
            {
                rowCount++;
                var values = row.EnumerateArray().ToArray();
                if (values.Length <= maximumIndex)
                {
                    excludedRows++;
                    complete = false;
                    continue;
                }
                var currency = values[currencyIndex].GetString();
                if (string.IsNullOrWhiteSpace(currency))
                {
                    excludedRows++;
                    complete = false;
                    continue;
                }
                decimal amount;
                try { amount = ParseDecimal(values[costIndex]); }
                catch (FormatException)
                {
                    excludedRows++;
                    complete = false;
                    continue;
                }
                if (dateIndex < 0 || !TryParseUsageDate(values[dateIndex], out var date) || !IsWithinRequestedPeriod(date, start, endExclusive))
                {
                    excludedRows++;
                    complete = false;
                    continue;
                }
                currencies.Add(currency);
                var service = values[serviceIndex].GetString() ?? "Unallocated";
                serviceTotals[service] = serviceTotals.GetValueOrDefault(service) + amount;
                dailyTotals[date] = dailyTotals.GetValueOrDefault(date) + amount;
                if (resourceGroupIndex >= 0)
                {
                    // Subscription-scoped charges such as Defender plans and purchases carry no resource group.
                    var group = values[resourceGroupIndex].ValueKind == JsonValueKind.String ? values[resourceGroupIndex].GetString() : null;
                    var groupName = string.IsNullOrWhiteSpace(group) ? "Subscription-scoped (no resource group)" : group;
                    resourceGroupTotals[groupName] = resourceGroupTotals.GetValueOrDefault(groupName) + amount;
                }
            }
            var nextLink = properties.TryGetProperty("nextLink", out var next) && next.ValueKind == JsonValueKind.String ? next.GetString() : null;
            if (string.IsNullOrWhiteSpace(nextLink)) break;
            if (page == 9)
            {
                complete = false;
                break;
            }
            if (!Uri.TryCreate(nextLink, UriKind.Absolute, out var nextUri) || nextUri.Scheme != Uri.UriSchemeHttps || !string.Equals(nextUri.Host, "management.azure.com", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException("Cost Management returned an invalid continuation link.");
            }
            requestUri = nextUri.AbsoluteUri;
        }
        var billingCurrency = ResolveSingleCurrency(currencies);
        var services = serviceTotals.Select(item => new ServiceCostDto(item.Key, item.Value)).OrderByDescending(item => item.Amount).ToArray();
        var resourceGroups = resourceGroupTotals.Select(item => new ServiceCostDto(item.Key, item.Value)).OrderByDescending(item => item.Amount).ToArray();
        var daily = dailyTotals.Select(item => new DailyCostDto(item.Key.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), item.Value)).ToArray();
        var artifact = CreateArtifact(payloads, requestCount, successfulPages, rowCount, queryProcessingUnits);
        return new CostResult(services.Sum(item => item.Amount), billingCurrency, services, daily, complete, excludedRows, complete ? "authorized" : "authorized-partial", artifact, resourceGroups);
    }

    private async Task<QueryResponse> SendCostQueryWithRetryAsync(string uri, string token, JsonNode body, CancellationToken cancellationToken)
    {
        var requests = 1;
        var response = await SendAsync(HttpMethod.Post, uri, token, body, cancellationToken);
        var throttledPayloads = new List<byte[]>();
        var queryProcessingUnits = 0;
        DateTimeOffset? retryAt = null;
        for (var retry = 0; response.StatusCode == HttpStatusCode.TooManyRequests && retry < (ExtendedCollectionEnabled ? 1 : 0); retry++)
        {
            var retryAfter = GetRetryAfter(response, 5);
            throttledPayloads.Add(await ReadBoundedPayloadAsync(response.Content, 1024 * 1024, cancellationToken));
            queryProcessingUnits = checked(queryProcessingUnits + GetQueryProcessingUnits(response));
            var candidateRetryAt = DateTimeOffset.UtcNow.AddSeconds(retryAfter);
            retryAt = retryAt is null || candidateRetryAt > retryAt ? candidateRetryAt : retryAt;
            response.Dispose();
            await Task.Delay(TimeSpan.FromSeconds(retryAfter), cancellationToken);
            response = await SendAsync(HttpMethod.Post, uri, token, body, cancellationToken);
            requests++;
        }
        if (response.StatusCode == HttpStatusCode.TooManyRequests)
        {
            var retryAfter = GetRetryAfter(response, 5);
            throttledPayloads.Add(await ReadBoundedPayloadAsync(response.Content, 1024 * 1024, cancellationToken));
            queryProcessingUnits = checked(queryProcessingUnits + GetQueryProcessingUnits(response));
            var candidateRetryAt = DateTimeOffset.UtcNow.AddSeconds(retryAfter);
            retryAt = retryAt is null || candidateRetryAt > retryAt ? candidateRetryAt : retryAt;
        }
        return new QueryResponse(response, requests, throttledPayloads, queryProcessingUnits, retryAt);
    }

    private async Task<CostResult> GetCostDetailsAsync(string subscriptionId, DateTimeOffset start, DateTimeOffset endExclusive, string token, CancellationToken cancellationToken)
    {
        var segments = new List<CostResult>();
        var segmentStart = start;
        while (segmentStart < endExclusive)
        {
            var nextMonth = new DateTimeOffset(new DateTime(segmentStart.Year, segmentStart.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1));
            var segmentEnd = nextMonth < endExclusive ? nextMonth : endExclusive;
            segments.Add(await GetCostDetailsSegmentAsync(subscriptionId, segmentStart, segmentEnd, token, cancellationToken));
            segmentStart = segmentEnd;
        }
        if (segments.Count == 0) throw new InvalidDataException("Cost Details period contained no report segments.");
        var currency = ResolveSingleCurrency(segments.Select(item => item.Currency));
        var serviceTotals = segments.SelectMany(item => item.Services)
            .GroupBy(item => item.Name, StringComparer.OrdinalIgnoreCase)
            .Select(group => new ServiceCostDto(group.Key, group.Sum(item => item.Amount)))
            .OrderByDescending(item => item.Amount)
            .ToArray();
        var dailyTotals = segments.SelectMany(item => item.Daily)
            .GroupBy(item => item.Date, StringComparer.Ordinal)
            .Select(group => new DailyCostDto(group.Key, group.Sum(item => item.Amount)))
            .OrderBy(item => item.Date, StringComparer.Ordinal)
            .ToArray();
        var complete = segments.All(item => item.Complete);
        var artifact = CombineArtifacts(segments.Select(item => item.Artifact));
        return new CostResult(serviceTotals.Sum(item => item.Amount), currency, serviceTotals, dailyTotals, complete, segments.Sum(item => item.ExcludedRows), complete ? "cost-details" : "cost-details-partial", artifact);
    }

    private async Task<CostResult> GetCostDetailsSegmentAsync(string subscriptionId, DateTimeOffset start, DateTimeOffset endExclusive, string token, CancellationToken cancellationToken)
    {
        var body = CreateCostDetailsRequest(start, endExclusive);
        var uri = $"https://management.azure.com/subscriptions/{Uri.EscapeDataString(subscriptionId)}/providers/Microsoft.CostManagement/generateCostDetailsReport?api-version=2025-03-01";
        var requestCount = 1;
        using var createResponse = await SendAsync(HttpMethod.Post, uri, token, body, cancellationToken);
        if (createResponse.StatusCode == HttpStatusCode.TooManyRequests)
        {
            var retryAt = DateTimeOffset.UtcNow.AddSeconds(GetRetryAfter(createResponse, 5));
            var payload = await ReadBoundedPayloadAsync(createResponse.Content, 1024 * 1024, cancellationToken);
            throw new SourceThrottledException(retryAt, CreateArtifact([payload], requestCount, 0, 0, GetQueryProcessingUnits(createResponse), true));
        }
        if (createResponse.StatusCode != HttpStatusCode.Accepted || createResponse.Headers.Location is null)
        {
            createResponse.EnsureSuccessStatusCode();
            throw new InvalidDataException("Cost Details did not return an operation location.");
        }

        var pollUri = createResponse.Headers.Location.IsAbsoluteUri
            ? createResponse.Headers.Location
            : new Uri(new Uri("https://management.azure.com"), createResponse.Headers.Location);
        var deadline = DateTimeOffset.UtcNow.AddMinutes(5);
        var retryAfter = GetRetryAfter(createResponse, 5);
        JsonDocument? completed = null;
        while (DateTimeOffset.UtcNow < deadline)
        {
            await Task.Delay(TimeSpan.FromSeconds(retryAfter), cancellationToken);
            using var pollResponse = await SendAsync(HttpMethod.Get, pollUri.AbsoluteUri, token, null, cancellationToken);
            requestCount++;
            if (pollResponse.StatusCode == HttpStatusCode.Accepted)
            {
                retryAfter = GetRetryAfter(pollResponse, 5);
                continue;
            }
            pollResponse.EnsureSuccessStatusCode();
            completed = JsonDocument.Parse(await ReadBoundedPayloadAsync(pollResponse.Content, 4 * 1024 * 1024, cancellationToken));
            break;
        }
        if (completed is null) throw new TimeoutException("Cost Details report generation exceeded five minutes.");
        using (completed)
        {
            var root = completed.RootElement;
            if (!root.TryGetProperty("status", out var status) || !string.Equals(status.GetString(), "Completed", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException("Cost Details report did not complete.");
            }
            var blobs = root.GetProperty("manifest").GetProperty("blobs");
            var totals = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
            var dailyTotals = new SortedDictionary<DateOnly, decimal>();
            var currencies = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var payloads = new List<byte[]>();
            var rowCount = 0;
            var excludedRows = 0;
            var completeResult = blobs.GetArrayLength() <= 5;
            foreach (var blob in blobs.EnumerateArray().Take(5))
            {
                var link = blob.GetProperty("blobLink").GetString();
                if (!Uri.TryCreate(link, UriKind.Absolute, out var blobUri) || blobUri.Scheme != Uri.UriSchemeHttps)
                {
                    throw new InvalidDataException("Cost Details returned an invalid download link.");
                }
                using var download = await httpClient.GetAsync(blobUri, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                requestCount++;
                download.EnsureSuccessStatusCode();
                var payload = await ReadBoundedPayloadAsync(download.Content, 16 * 1024 * 1024, cancellationToken);
                payloads.Add(payload);
                var parsed = await ParseCostCsvAsync(payload, start, endExclusive, totals, dailyTotals, currencies, cancellationToken);
                rowCount += parsed.Rows;
                excludedRows += parsed.Malformed + parsed.OutOfWindow;
                if (parsed.Malformed > 0 || parsed.OutOfWindow > 0) completeResult = false;
            }
            var currency = ResolveSingleCurrency(currencies);
            var services = totals.Select(item => new ServiceCostDto(item.Key, item.Value)).OrderByDescending(item => item.Amount).ToArray();
            var daily = dailyTotals.Select(item => new DailyCostDto(item.Key.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), item.Value)).ToArray();
            var artifact = CreateArtifact(payloads, requestCount, payloads.Count, rowCount, retainPayloads: true);
            return new CostResult(services.Sum(item => item.Amount), currency, services, daily, completeResult, excludedRows, completeResult ? "cost-details" : "cost-details-partial", artifact);
        }
    }

    internal static JsonObject CreateCostDetailsRequest(DateTimeOffset start, DateTimeOffset endExclusive)
    {
        if (start.Offset != TimeSpan.Zero || endExclusive.Offset != TimeSpan.Zero || start.TimeOfDay != TimeSpan.Zero ||
            endExclusive.TimeOfDay != TimeSpan.Zero || endExclusive <= start) throw new ArgumentException("A nonempty UTC day range is required.");
        return new JsonObject
        {
            ["metric"] = "ActualCost",
            ["timePeriod"] = new JsonObject { ["start"] = start.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), ["end"] = endExclusive.AddDays(-1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) },
        };
    }

    private static async Task<(int Rows, int Malformed, int OutOfWindow)> ParseCostCsvAsync(byte[] payload, DateTimeOffset start, DateTimeOffset endExclusive,
        Dictionary<string, decimal> totals, SortedDictionary<DateOnly, decimal> dailyTotals, HashSet<string> currencies, CancellationToken cancellationToken,
        Dictionary<string, decimal>? resourceGroupTotals = null)
    {
        await using var stream = new MemoryStream(payload, writable: false);
        using var reader = new StreamReader(stream);
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            PrepareHeaderForMatch = args => args.Header.ToLowerInvariant(),
            MissingFieldFound = null,
            BadDataFound = null,
            ExceptionMessagesContainRawData = false,
        });
        var rows = 0;
        var malformed = 0;
        var outOfWindow = 0;
        if (!await csv.ReadAsync()) return (rows, malformed, outOfWindow);
        csv.ReadHeader();
        while (await csv.ReadAsync())
        {
            cancellationToken.ThrowIfCancellationRequested();
            rows++;
            var service = csv.TryGetField("ServiceName", out string? serviceName) && !string.IsNullOrWhiteSpace(serviceName)
                ? serviceName
                : csv.GetField("MeterCategory") ?? "Unallocated";
            var amountText = csv.GetField("CostInBillingCurrency") ?? throw new InvalidDataException("The cost file omitted CostInBillingCurrency.");
            var rowCurrency = csv.GetField("BillingCurrency");
            if (!decimal.TryParse(amountText, NumberStyles.Number, CultureInfo.InvariantCulture, out var amount) || string.IsNullOrWhiteSpace(rowCurrency))
            {
                malformed++;
                continue;
            }
            var dateText = GetFirstField(csv, "ChargePeriodStart", "UsageDate", "Date");
            if (!DateOnly.TryParse(dateText, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                malformed++;
                continue;
            }
            if (!IsWithinRequestedPeriod(date, start, endExclusive))
            {
                outOfWindow++;
                continue;
            }
            currencies.Add(rowCurrency);
            totals[service] = totals.GetValueOrDefault(service) + amount;
            dailyTotals[date] = dailyTotals.GetValueOrDefault(date) + amount;
            if (resourceGroupTotals is not null)
            {
                // Subscription-scoped charges such as Defender plans and purchases carry no resource group.
                var group = GetFirstField(csv, "ResourceGroupName", "ResourceGroup", "resourceGroupName");
                var groupName = string.IsNullOrWhiteSpace(group) ? "Subscription-scoped (no resource group)" : group;
                resourceGroupTotals[groupName] = resourceGroupTotals.GetValueOrDefault(groupName) + amount;
            }
        }
        return (rows, malformed, outOfWindow);
    }

    // Scheduled exports are already written to storage, so this source reads the published file instead of calling the throttled Query API.
    private async Task<CostResult> GetExportCostsAsync(DateTimeOffset start, DateTimeOffset endExclusive, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(configuration["ACI_BLOB_ENDPOINT"], UriKind.Absolute, out var endpoint) || endpoint.Scheme != Uri.UriSchemeHttps)
            throw new InvalidDataException("ACI_BLOB_ENDPOINT is required by the exports cost source.");
        var container = new BlobServiceClient(endpoint, credential)
            .GetBlobContainerClient(configuration["ACI_EXPORT_CONTAINER"] ?? "cost-exports");
        var prefix = configuration["ACI_EXPORT_PREFIX"] ?? "aco";

        var folders = new List<string>();
        for (var month = new DateTime(start.UtcDateTime.Year, start.UtcDateTime.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            month < endExclusive.UtcDateTime && folders.Count < 4; month = month.AddMonths(1))
        {
            folders.Add($"/{month.ToString("yyyyMM", CultureInfo.InvariantCulture)}01-");
        }
        var newest = new Dictionary<string, BlobItem>(StringComparer.Ordinal);
        await foreach (var blob in container.GetBlobsAsync(BlobTraits.None, BlobStates.None, prefix, cancellationToken))
        {
            if (!blob.Name.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)) continue;
            if (folders.FirstOrDefault(item => blob.Name.Contains(item, StringComparison.Ordinal)) is not { } folder) continue;
            if (!newest.TryGetValue(folder, out var current) || blob.Properties.LastModified > current.Properties.LastModified) newest[folder] = blob;
        }
        if (newest.Count == 0) throw new InvalidDataException("No cost export file was found for the requested period.");

        var totals = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var resourceGroupTotals = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var dailyTotals = new SortedDictionary<DateOnly, decimal>();
        var currencies = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var payloads = new List<byte[]>();
        var rowCount = 0;
        var malformedRows = 0;
        foreach (var blob in newest.Values.OrderBy(item => item.Name, StringComparer.Ordinal))
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (blob.Properties.ContentLength > 16 * 1024 * 1024) throw new InvalidDataException("A cost export file exceeded the configured size limit.");
            var payload = (await container.GetBlobClient(blob.Name).DownloadContentAsync(cancellationToken)).Value.Content.ToArray();
            payloads.Add(payload);
            var parsed = await ParseCostCsvAsync(payload, start, endExclusive, totals, dailyTotals, currencies, cancellationToken, resourceGroupTotals);
            rowCount += parsed.Rows;
            malformedRows += parsed.Malformed;
        }
        // An export covers whole billing months, so rows outside the requested window are expected rather than missing evidence.
        var complete = malformedRows == 0 && newest.Count == folders.Count;
        var currency = ResolveSingleCurrency(currencies);
        var services = totals.Select(item => new ServiceCostDto(item.Key, item.Value)).OrderByDescending(item => item.Amount).ToArray();
        var resourceGroups = resourceGroupTotals.Select(item => new ServiceCostDto(item.Key, item.Value)).OrderByDescending(item => item.Amount).ToArray();
        var daily = dailyTotals.Select(item => new DailyCostDto(item.Key.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), item.Value)).ToArray();
        var artifact = CreateArtifact(payloads, newest.Count, newest.Count, rowCount);
        return new CostResult(services.Sum(item => item.Amount), currency, services, daily, complete, malformedRows,
            complete ? "cost-exports" : "cost-exports-partial", artifact, resourceGroups);
    }

    internal static bool IsWithinRequestedPeriod(DateOnly date, DateTimeOffset start, DateTimeOffset endExclusive) =>
        date >= DateOnly.FromDateTime(start.UtcDateTime) && date < DateOnly.FromDateTime(endExclusive.UtcDateTime);

    internal static int GetRetryAfter(HttpResponseMessage response, int fallbackSeconds)
    {
        var delays = new List<int> { fallbackSeconds };
        if (response.Headers.RetryAfter?.Delta is TimeSpan delta) delays.Add((int)Math.Ceiling(delta.TotalSeconds));
        if (response.Headers.RetryAfter?.Date is DateTimeOffset date) delays.Add((int)Math.Ceiling((date - DateTimeOffset.UtcNow).TotalSeconds));
        foreach (var name in new[]
        {
            "x-ms-ratelimit-microsoft.costmanagement-qpu-retry-after",
            "x-ms-ratelimit-microsoft.costmanagement-entity-retry-after",
            "x-ms-ratelimit-microsoft.costmanagement-tenant-retry-after",
            "x-ms-ratelimit-microsoft.costmanagement-clienttype-retry-after",
        })
        {
            if (response.Headers.TryGetValues(name, out var values))
            {
                delays.AddRange(values.Select(value => int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var seconds) ? seconds : 0));
            }
        }
        return Math.Clamp(delays.Max(), 1, 300);
    }

    internal static int GetQueryProcessingUnits(HttpResponseMessage response) =>
        response.Headers.TryGetValues("x-ms-ratelimit-microsoft.costmanagement-qpu-consumed", out var values)
            ? values.Sum(value => int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var units) ? units : 0)
            : 0;

    internal static string ResolveSingleCurrency(IEnumerable<string> currencies)
    {
        var distinct = currencies.Where(item => !string.IsNullOrWhiteSpace(item)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (distinct.Length > 1) throw new InvalidDataException("Source data returned multiple billing currencies.");
        return distinct.SingleOrDefault() ?? "XXX";
    }

    private async Task<AdvisorResult> GetAdvisorAsync(string subscriptionId, string token, CancellationToken cancellationToken)
    {
        var requestUri = $"https://management.azure.com/subscriptions/{Uri.EscapeDataString(subscriptionId)}/providers/Microsoft.Advisor/recommendations?$filter=Category%20eq%20'Cost'&api-version=2025-01-01";
        var records = new Dictionary<string, AdvisorRecord>(StringComparer.OrdinalIgnoreCase);
        var payloads = new List<byte[]>();
        var requestCount = 0;
        var rowCount = 0;
        var complete = true;
        for (var page = 0; page < 10; page++)
        {
            using var response = await SendAsync(HttpMethod.Get, requestUri, token, null, cancellationToken);
            requestCount++;
            response.EnsureSuccessStatusCode();
            var payload = await ReadBoundedPayloadAsync(response.Content, 4 * 1024 * 1024, cancellationToken);
            payloads.Add(payload);
            using var document = JsonDocument.Parse(payload);
            foreach (var item in document.RootElement.GetProperty("value").EnumerateArray())
            {
                rowCount++;
                var properties = item.GetProperty("properties");
                var id = item.GetProperty("id").GetString() ?? throw new InvalidDataException("Advisor recommendation omitted its stable identity.");
                var title = TryGetString(properties, "shortDescription", "solution") ?? TryGetString(properties, "shortDescription", "problem") ?? "Review Azure Advisor cost recommendation";
                var resourceId = TryGetString(properties, "resourceMetadata", "resourceId");
                var alias = resourceId?.Contains("/providers/", StringComparison.OrdinalIgnoreCase) == true ? $"resource-{Sha256(resourceId)[..10]}" : null;
                var annualSavings = TryGetDecimal(properties, "extendedProperties", "annualSavingsAmount");
                var savingsCurrency = TryGetString(properties, "extendedProperties", "savingsCurrency") ?? TryGetString(properties, "extendedProperties", "currency");
                if (annualSavings is not null && string.IsNullOrWhiteSpace(savingsCurrency)) annualSavings = null;
                var hash = Sha256(id);
                records.TryAdd(id, new AdvisorRecord(hash[..16], title, alias, $"ev_{hash[..20]}", annualSavings, savingsCurrency));
            }
            var nextLink = document.RootElement.TryGetProperty("nextLink", out var next) && next.ValueKind == JsonValueKind.String ? next.GetString() : null;
            if (string.IsNullOrWhiteSpace(nextLink)) break;
            if (page == 9)
            {
                complete = false;
                break;
            }
            if (!Uri.TryCreate(nextLink, UriKind.Absolute, out var nextUri) || nextUri.Scheme != Uri.UriSchemeHttps || !string.Equals(nextUri.Host, "management.azure.com", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException("Advisor returned an invalid continuation link.");
            }
            requestUri = nextUri.AbsoluteUri;
        }
        return new AdvisorResult(records.Values.ToArray(), complete, CreateArtifact(payloads, requestCount, payloads.Count, rowCount));
    }

    private async Task<ResourceGraphResult> GetResourceCountAsync(string subscriptionId, string token, CancellationToken cancellationToken)
    {
        var body = new JsonObject
        {
            ["subscriptions"] = new JsonArray(subscriptionId),
            ["query"] = "Resources | summarize resourceCount=count()",
        };
        using var response = await SendAsync(HttpMethod.Post, "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01", token, body, cancellationToken);
        response.EnsureSuccessStatusCode();
        var payload = await ReadBoundedPayloadAsync(response.Content, 4 * 1024 * 1024, cancellationToken);
        using var document = JsonDocument.Parse(payload);
        var data = document.RootElement.GetProperty("data");
        var resourceCount = data.GetArrayLength() == 0 ? 0 : data[0].GetProperty("resourceCount").GetInt32();
        return new ResourceGraphResult(resourceCount, CreateArtifact([payload], 1, 1, data.GetArrayLength()));
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string uri, string token, JsonNode? body, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, uri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        // Cost Management throttles per tenant and per client type; identify this client rather than sharing a generic bucket.
        request.Headers.UserAgent.ParseAdd("azure-cost-optimizer/1.0");
        request.Headers.TryAddWithoutValidation("x-ms-command-name", "AzureCostOptimizer.Evidence.Refresh");
        if (body is not null) request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
        return await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
    }

    private static async Task<byte[]> ReadBoundedPayloadAsync(HttpContent content, int maximumBytes, CancellationToken cancellationToken)
    {
        if (content.Headers.ContentLength > maximumBytes) throw new InvalidDataException("Provider response exceeded the configured size limit.");
        var payload = await content.ReadAsByteArrayAsync(cancellationToken);
        if (payload.Length > maximumBytes) throw new InvalidDataException("Provider response exceeded the configured size limit.");
        return payload;
    }

    private static SourceArtifact CreateArtifact(IEnumerable<byte[]> payloads, int requests, int pages, int rows, int queryProcessingUnits = 0, bool retainPayloads = false)
    {
        var items = payloads.ToArray();
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var bytes = 0;
        foreach (var payload in items)
        {
            hash.AppendData(payload);
            bytes = checked(bytes + payload.Length);
        }
        return new SourceArtifact(Convert.ToHexStringLower(hash.GetHashAndReset()), requests, pages, rows, bytes, queryProcessingUnits, retainPayloads ? items : null);
    }

    private static SourceArtifact CombineArtifacts(IEnumerable<SourceArtifact> artifacts)
    {
        var items = artifacts.ToArray();
        var payloads = items.SelectMany(item => item.RawPayloads ?? throw new InvalidOperationException("Raw provider payloads are required for artifact composition."));
        return CreateArtifact(payloads, items.Sum(item => item.Requests), items.Sum(item => item.Pages), items.Sum(item => item.Rows), items.Sum(item => item.QueryProcessingUnits), true);
    }

    private static decimal ParseDecimal(JsonElement value) => value.ValueKind == JsonValueKind.Number
        ? value.GetDecimal()
        : decimal.Parse(value.GetString() ?? "0", NumberStyles.Number, CultureInfo.InvariantCulture);

    private static bool TryParseUsageDate(JsonElement value, out DateOnly date)
    {
        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var compactDate))
        {
            return DateOnly.TryParseExact(compactDate.ToString(CultureInfo.InvariantCulture), "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
        }
        return DateOnly.TryParse(value.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    }

    private static string? GetFirstField(CsvReader csv, params string[] names)
    {
        foreach (var name in names)
        {
            if (csv.TryGetField(name, out string? value) && !string.IsNullOrWhiteSpace(value)) return value;
        }
        return null;
    }

    private static string? TryGetString(JsonElement root, string parent, string child) =>
        root.TryGetProperty(parent, out var parentValue) && parentValue.ValueKind == JsonValueKind.Object && parentValue.TryGetProperty(child, out var value)
            ? value.GetString()
            : null;

    private static decimal? TryGetDecimal(JsonElement root, string parent, string child)
    {
        var raw = TryGetString(root, parent, child);
        return decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out var value) ? value : null;
    }

    internal static string CreateReportId(string subscriptionId, PeriodSelection selection, DateTimeOffset periodStart, DateTimeOffset periodEndExclusive, IReadOnlyList<SourceReceiptDto> receipts) =>
        $"rpt_{Sha256(JsonSerializer.Serialize(new { subscriptionAlias = Sha256(subscriptionId)[..16], selection.Key, periodStart, periodEndExclusive, receipts }))}";

    internal static string Sha256(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}

public sealed record SourceArtifact(string ContentSha256, int Requests, int Pages, int Rows, int Bytes, int QueryProcessingUnits, IReadOnlyList<byte[]>? RawPayloads);
public sealed record QueryResponse(HttpResponseMessage Response, int Requests, IReadOnlyList<byte[]> ThrottledPayloads, int QueryProcessingUnits, DateTimeOffset? RetryAt);
internal sealed class SourceThrottledException(DateTimeOffset retryAt, SourceArtifact artifact, Exception? innerException = null)
    : Exception("Cost Management is throttled.", innerException)
{
    public DateTimeOffset RetryAt { get; } = retryAt;
    public SourceArtifact Artifact { get; } = artifact;
}
public sealed record CostResult(decimal Total, string Currency, IReadOnlyList<ServiceCostDto> Services, IReadOnlyList<DailyCostDto> Daily, bool Complete, int ExcludedRows, string Status, SourceArtifact Artifact, IReadOnlyList<ServiceCostDto>? ResourceGroups = null);
public sealed record AdvisorRecord(string FindingId, string Title, string? ResourceAlias, string EvidenceId, decimal? EstimatedAnnualSavings, string? SavingsCurrency);
public sealed record AdvisorResult(IReadOnlyList<AdvisorRecord> Items, bool Complete, SourceArtifact Artifact);
public sealed record ResourceGraphResult(int ResourceCount, SourceArtifact Artifact);
public sealed record CommonEvidence(AdvisorResult Advisor, ResourceGraphResult ResourceGraph);
public sealed record SolutionSnapshotFixture(string SchemaVersion, string Profile, string TenantAlias, string ScopeAlias, string FinancialBasis, string Currency, DateTimeOffset PublishedAt, string ContentSha256, SolutionSnapshotPayload Payload);
public sealed record SolutionSnapshotPayload(ServiceCostDto[] Services, DailyCostDto[] Daily, AdvisorFindingDto[] Advisor, int ResourceCount, PeriodDto ActualPeriod);
public sealed record PeriodDto(DateTimeOffset Start, DateTimeOffset End);
public sealed record ReceiptPeriodDto(string Start, string End)
{
    public static ReceiptPeriodDto From(DateTimeOffset start, DateTimeOffset end) => new(
        start.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        end.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
}
public sealed record MoneyDto(decimal Amount, string Currency);
public sealed record ServiceCostDto(string Name, decimal Amount);
public sealed record DailyCostDto(string Date, decimal Amount);
public sealed record SummaryDto(string ReportId, string ScopeAlias, string PeriodKey, string PeriodLabel, PeriodDto RequestedPeriod, string FinancialBasis, MoneyDto TotalCost, decimal? TotalEstimatedAnnualSavings, DateTimeOffset CollectedAt, string Status, IReadOnlyList<ServiceCostDto> Services, IReadOnlyList<DailyCostDto> Daily, IReadOnlyList<ServiceCostDto>? ResourceGroups = null);
public sealed record MoneyOrUnknownDto(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Amount,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Currency,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? UnknownReason)
{
    public static MoneyOrUnknownDto Known(decimal amount, string currency) => new(amount.ToString("0.#############################", CultureInfo.InvariantCulture), currency, null);
    public static MoneyOrUnknownDto Unknown(string reason) => new(null, null, reason);
}
public sealed record OpportunityDto(
    string SchemaVersion,
    string OpportunityId,
    string RuleId,
    string ScopeAlias,
    string? ResourceAlias,
    string Category,
    string Title,
    string FinancialBasis,
    string? Currency,
    MoneyOrUnknownDto ObservedCost,
    MoneyOrUnknownDto EstimatedOpportunity,
    MoneyOrUnknownDto ApprovedTarget,
    MoneyOrUnknownDto RealizedSavings,
    decimal Confidence,
    bool Complete,
    IReadOnlyList<string> EvidenceIds,
    IReadOnlyList<string> Risks,
    string? Owner,
    string ReviewStatus,
    string NextAction);
public sealed record AdvisorFindingDto(string FindingId, string Title, string? ResourceAlias, string EvidenceId, decimal? EstimatedAnnualSavings, string? SavingsCurrency);
public sealed record SourceCountsDto(int Requests, int Pages, int Rows, int Bytes, int? QueryProcessingUnits);
public sealed record SourceReceiptDto(
    string SchemaVersion,
    string Source,
    string ApiVersion,
    string TenantAlias,
    string ScopeAlias,
    ReceiptPeriodDto RequestedPeriod,
    ReceiptPeriodDto ActualPeriod,
    string FinancialBasis,
    string? Currency,
    DateTimeOffset CollectedAt,
    string Status,
    bool Complete,
    SourceCountsDto Counts,
    string? SafeIssueCode,
    DateTimeOffset? RetryAt,
    string ContentSha256,
    IReadOnlyList<string> EvidenceIds)
{
    [JsonIgnore]
    public string EvidenceId => EvidenceIds[0];

    [JsonIgnore]
    public int RecordCount => Counts.Rows;
}
public sealed record DataHealthDto(string Status, IReadOnlyList<string> SourceReceiptHashes, IReadOnlyList<SourceReceiptDto> Sources, int ExcludedRows, int ResourceCount, string? FailedSource, DateTimeOffset? RetryAt)
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public SnapshotCacheDto? Cache { get; init; }
}
public sealed record SnapshotCacheDto(string Provenance, string Freshness, DateTimeOffset RestoredAt, DateTimeOffset ExpiresAt);
public sealed record EvidenceSnapshot(SummaryDto Summary, IReadOnlyList<OpportunityDto> Opportunities, IReadOnlyList<AdvisorFindingDto> Advisor, DataHealthDto DataHealth, string CostSourceStatus)
{
    private string PrimaryEvidenceId => DataHealth.Sources.SelectMany(source => source.EvidenceIds).First();
    private ReceiptPeriodDto ActualCostPeriod => DataHealth.Sources.First().ActualPeriod;

    public string ToCanonicalJson() => JsonSerializer.Serialize(new
    {
        schemaVersion = "1.0.0",
        Summary.ReportId,
        tenantAlias = DataHealth.Sources.First().TenantAlias,
        Summary.ScopeAlias,
        requestedPeriod = new { start = Summary.RequestedPeriod.Start.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), end = Summary.RequestedPeriod.End.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) },
        actualPeriod = new { start = DataHealth.Sources.First().ActualPeriod.Start, end = DataHealth.Sources.First().ActualPeriod.End },
        Summary.FinancialBasis,
        currency = Summary.TotalCost.Currency,
        Summary.CollectedAt,
        complete = string.Equals(DataHealth.Status, "fresh", StringComparison.Ordinal) && DataHealth.Sources.All(source => source.Complete),
        totalCost = CanonicalDecimal(Summary.TotalCost.Amount),
        totalEstimatedOpportunity = Summary.TotalEstimatedAnnualSavings is decimal annualSavings ? CanonicalDecimal(annualSavings) : null,
        services = Summary.Services.Select(item => new { item.Name, amount = CanonicalDecimal(item.Amount) }),
        opportunities = Opportunities,
        advisorFindings = Advisor.Select(item => new
        {
            item.FindingId,
            item.Title,
            item.ResourceAlias,
            item.EvidenceId,
            estimatedAnnualSavings = item.EstimatedAnnualSavings is decimal amount ? CanonicalDecimal(amount) : null,
            item.SavingsCurrency,
        }),
        dataHealth = new
        {
            DataHealth.Status,
            sourceReceiptHashes = DataHealth.Sources.Select(source => source.ContentSha256).Distinct(StringComparer.Ordinal),
            DataHealth.ExcludedRows,
        },
        evidenceLedger = DataHealth.Sources.SelectMany(source => source.EvidenceIds.Select(evidenceId => new
        {
            evidenceId,
            source.Source,
            claimType = source.Source == "advisor" ? "recommendation" : source.Source == "resource-graph" ? "inventory" : "cost",
            source.ContentSha256,
        })),
        limitations = GetReportLimitations(),
    }, JsonSerializerOptions.Web);

    private IReadOnlyList<string> GetReportLimitations()
    {
        var limitations = new List<string>
        {
            "Cost data is delayed and current-period values can change.",
            "Advisor values are estimates, not approvals or realized savings.",
        };
        if (!string.Equals(DataHealth.Status, "fresh", StringComparison.Ordinal)) limitations.Add($"Data health is {DataHealth.Status}.");
        if (DataHealth.ExcludedRows > 0) limitations.Add($"{DataHealth.ExcludedRows} source rows were excluded.");
        return limitations;
    }

    public string ToCsv()
    {
        var builder = new StringBuilder("reportId,recordType,name,amount,currency,basis,periodStart,periodEnd,evidenceId\n");
        builder.AppendLine($"{Csv(Summary.ReportId)},summary,totalCost,{CanonicalDecimal(Summary.TotalCost.Amount)},{Csv(Summary.TotalCost.Currency)},{Summary.FinancialBasis},{ActualCostPeriod.Start},{ActualCostPeriod.End},{Csv(PrimaryEvidenceId)}");
        if (Summary.TotalEstimatedAnnualSavings is decimal annualSavings)
        {
            builder.AppendLine($"{Csv(Summary.ReportId)},summary,advisorAnnualPotential,{CanonicalDecimal(annualSavings)},{Csv(Summary.TotalCost.Currency)},annual,{ActualCostPeriod.Start},{ActualCostPeriod.End},{Csv(PrimaryEvidenceId)}");
        }
        foreach (var service in Summary.Services)
        {
            builder.AppendLine($"{Csv(Summary.ReportId)},service,{Csv(service.Name)},{CanonicalDecimal(service.Amount)},{Csv(Summary.TotalCost.Currency)},{Summary.FinancialBasis},{ActualCostPeriod.Start},{ActualCostPeriod.End},{Csv(PrimaryEvidenceId)}");
        }
        return builder.ToString();
    }

    public string ToFocusCsv()
    {
        var builder = new StringBuilder("ReportId,EvidenceId,BillingPeriodStart,BillingPeriodEnd,BilledCost,BillingCurrency,ServiceName,ChargeCategory\n");
        foreach (var service in Summary.Services)
        {
            builder.AppendLine($"{Csv(Summary.ReportId)},{Csv(PrimaryEvidenceId)},{ActualCostPeriod.Start},{ActualCostPeriod.End},{CanonicalDecimal(service.Amount)},{Csv(Summary.TotalCost.Currency)},{Csv(service.Name)},Usage");
        }
        return builder.ToString();
    }

    public string ToHtml()
    {
        var rows = string.Join("", Summary.Services.Select(service => $"<tr><td>{WebUtility.HtmlEncode(service.Name)}</td><td>{CanonicalDecimal(service.Amount)}</td><td>{WebUtility.HtmlEncode(Summary.TotalCost.Currency)}</td></tr>"));
        var annualSavings = Summary.TotalEstimatedAnnualSavings is decimal value
            ? $"{CanonicalDecimal(value)} {WebUtility.HtmlEncode(Summary.TotalCost.Currency)}"
            : "Not available";
        return $"<!doctype html><html><head><meta charset=\"utf-8\"><title>Azure Cost Optimizer</title></head><body><h1>Azure Cost Optimizer</h1><dl><dt>Report</dt><dd>{WebUtility.HtmlEncode(Summary.ReportId)}</dd><dt>Evidence</dt><dd>{WebUtility.HtmlEncode(PrimaryEvidenceId)}</dd><dt>Period</dt><dd>{WebUtility.HtmlEncode(ActualCostPeriod.Start)} to {WebUtility.HtmlEncode(ActualCostPeriod.End)}</dd><dt>Basis</dt><dd>{WebUtility.HtmlEncode(Summary.FinancialBasis)}</dd><dt>Total cost</dt><dd>{CanonicalDecimal(Summary.TotalCost.Amount)} {WebUtility.HtmlEncode(Summary.TotalCost.Currency)}</dd><dt>Advisor annual potential</dt><dd>{annualSavings}</dd></dl><table><thead><tr><th>Service</th><th>Amount</th><th>Currency</th></tr></thead><tbody>{rows}</tbody></table></body></html>";
    }

    // One sheet per section of the report, so each audience can open the tab that belongs to them. Money is
    // written as a number rather than a formatted string so totals can be recalculated in the workbook.
    public byte[] ToWorkbook()
    {
        var currency = Summary.TotalCost.Currency;
        var money = (decimal value) => $"{CanonicalDecimal(decimal.Round(value, 2, MidpointRounding.ToEven))} {currency}";
        var round = (decimal value) => decimal.Round(value, 2, MidpointRounding.ToEven);
        var total = Summary.TotalCost.Amount;
        var share = (decimal amount) => total > 0 ? $"{decimal.Round(amount / total * 100, 1, MidpointRounding.ToEven).ToString(CultureInfo.InvariantCulture)}%" : "n/a";
        var guidance = OptimizationKnowledge.ForReport(Summary.Services.Select(item => item.Name).Take(5));
        var book = XlsxWorkbook.Begin();

        book.Sheet("Cover")
            .Title("Azure Cost Optimizer report")
            .Note("Based on the Azure Cost Intelligence stack")
            .Blank()
            .Fact("Scope", Summary.ScopeAlias)
            .Fact("Report", Summary.ReportId)
            .Fact("Period requested", $"{Summary.RequestedPeriod.Start} to {Summary.RequestedPeriod.End}")
            .Fact("Period observed", $"{ActualCostPeriod.Start} to {ActualCostPeriod.End}")
            .Fact("Financial basis", Summary.FinancialBasis)
            .Fact("Currency", currency)
            .Fact("Observed cost", money(Summary.TotalCost.Amount))
            .Fact("Advisor annual potential", Summary.TotalEstimatedAnnualSavings is decimal annual ? money(annual) : "Not available")
            .Fact("Services observed", Summary.Services.Count.ToString(CultureInfo.InvariantCulture))
            .Fact("Resource groups observed", (Summary.ResourceGroups?.Count ?? 0).ToString(CultureInfo.InvariantCulture))
            .Fact("Resources in inventory", DataHealth.ResourceCount.ToString(CultureInfo.InvariantCulture))
            .Fact("Collected", Summary.CollectedAt.ToString("u", CultureInfo.InvariantCulture))
            .Fact("Data health", $"{DataHealth.Status} · {CostSourceStatus}")
            .Fact("Primary evidence", PrimaryEvidenceId)
            .Blank()
            .Note("Read-only report. Advisor amounts are Microsoft estimates of annual potential, not approved targets and not realized savings. Overlapping recommendations are not additive. Review every action with an authorized human before making a change.")
            .Blank()
            .Headers("Sheet", "What it holds")
            .Row("Cost breakdown", "Billed cost by service, by resource group and by day, with a proportional bar for shape.")
            .Row("Advisor", "Azure Advisor cost recommendations and their estimated annual potential.")
            .Row("Action register", "Normalized review opportunities with state, ownership, next action and source evidence.")
            .Row("FinOps practices", "FinOps Framework practices for the inform, optimize and operate phases.")
            .Row("WAF checklist", "Well-Architected cost optimization checklist codes and what each one asks.")
            .Row("Decision map", "The deterministic next-best-action path built from this evidence.")
            .Row("RACI", "Role split per workstream. Roles, not named people.")
            .Row("Delivery plan", "The same review expressed as backlog items with owners and completion measures.");

        book.Sheet("Cost breakdown")
            .Title("Cost breakdown")
            .MoneyFact($"Total billed cost ({currency})", round(Summary.TotalCost.Amount))
            .Note($"Billed cost for {ActualCostPeriod.Start} to {ActualCostPeriod.End} in {currency}. The bar column is proportional to the largest row and is a reading aid, not evidence.")
            .Blank()
            .Headers("Service", "Shape", "Share", $"Cost ({currency})");
        var services = Summary.Services.OrderByDescending(item => item.Amount).ToArray();
        var peakService = services.Length == 0 ? 0m : services.Max(item => item.Amount);
        var serviceFirstRow = book.NextRow;
        foreach (var service in services)
        {
            book.MoneyRow([service.Name, Bar(service.Amount, peakService), share(service.Amount), string.Empty], [null, null, null, round(service.Amount)]);
        }
        // Charts are anchored to the right of their own rows so the figures and the picture read together.
        if (services.Length > 0)
        {
            book.Chart($"Cost by service ({currency})", serviceFirstRow, book.NextRow - 1, 0, 3)
                .PieChart($"Largest service mix ({currency})", serviceFirstRow, Math.Min(serviceFirstRow + 7, book.NextRow - 1), 0, 3, 13);
        }

        if (Summary.ResourceGroups is { Count: > 0 } groups)
        {
            var ordered = groups.OrderByDescending(item => item.Amount).ToArray();
            var peakGroup = ordered.Max(item => item.Amount);
            book.Blank().Headers("Resource group", "Shape", "Share", $"Cost ({currency})");
            var groupFirstRow = book.NextRow;
            foreach (var group in ordered)
            {
                book.MoneyRow([group.Name, Bar(group.Amount, peakGroup), share(group.Amount), string.Empty], [null, null, null, round(group.Amount)]);
            }
            book.Chart($"Cost by resource group ({currency})", groupFirstRow, book.NextRow - 1, 0, 3)
                .PieChart($"Largest resource group mix ({currency})", groupFirstRow, Math.Min(groupFirstRow + 7, book.NextRow - 1), 0, 3, 13);
        }

        if (Summary.Daily.Count > 0)
        {
            var peakDay = Summary.Daily.Max(item => item.Amount);
            book.Blank().Headers("Date (UTC)", "Shape", string.Empty, $"Cost ({currency})");
            var dailyFirstRow = book.NextRow;
            foreach (var day in Summary.Daily)
            {
                book.MoneyRow([day.Date, Bar(day.Amount, peakDay), string.Empty, string.Empty], [null, null, null, round(day.Amount)]);
            }
            book.Chart($"Daily cost ({currency})", dailyFirstRow, book.NextRow - 1, 0, 3);
            book.Note("The most recent day may still be accruing, so it should not be read as a fall in spend.");
        }

        book.Sheet("Advisor")
            .Title("Azure Advisor cost recommendations")
            .Note("Microsoft estimates of annual potential. They are not approved targets and not realized savings, and separate findings may overlap.")
            .Blank();
        if (Advisor.Count == 0)
        {
            book.Note("Azure Advisor returned no cost recommendations for this scope. Zero findings is a valid result, not missing evidence.");
        }
        else
        {
            book.Headers("Recommendation", "Target", "Annual estimate", "Currency", "Review state", "Evidence");
            foreach (var finding in Advisor.OrderByDescending(item => item.EstimatedAnnualSavings ?? 0m))
            {
                book.MoneyRow(
                    [finding.Title, finding.ResourceAlias ?? "subscription scope", string.Empty, finding.SavingsCurrency ?? "not supplied", "Needs human review", finding.EvidenceId],
                    [null, null, finding.EstimatedAnnualSavings is decimal value ? round(value) : null, null, null, null]);
            }
        }

        book.Sheet("Action register")
            .Title("Review opportunity register")
            .Note("Deterministic opportunities derived from this report. Unassigned means the evidence carries no named owner; assign one before scheduling work.")
            .Blank()
            .Headers("Opportunity", "Category", "Review state", "Owner", "Next action", "Evidence");
        foreach (var item in Opportunities)
        {
            book.Row(item.Title, item.Category, item.ReviewStatus, item.Owner ?? "Unassigned", item.NextAction, string.Join(", ", item.EvidenceIds));
        }

        book.Sheet("FinOps practices")
            .Title("FinOps Framework practices")
            .Note("Published guidance. It carries no customer amounts and is not evidence. Apply in order: inform, then optimize, then operate.")
            .Blank()
            .Headers("Phase", "Practice", "What it means here");
        foreach (var item in guidance.FinOps) book.Row(item.Phase, item.Title, item.Practice);

        book.Sheet("WAF checklist")
            .Title("Well-Architected cost optimization checklist")
            .Note("Published Microsoft guidance. Codes are review prompts for this estate, not measured savings.")
            .Blank()
            .Headers("Code", "What it asks", "What to check");
        foreach (var item in guidance.WellArchitected) book.Row(item.Code, item.Title, item.Recommendation);

        book.Sheet("Decision map")
            .Title("Next best action: decision map")
            .Note("A deterministic path built from this report. Every decision is a human judgement and nothing here is executed automatically.")
            .Blank()
            .Headers("Step", "Type", "Decision or action", "Detail", "Branches");
        var step = 0;
        foreach (var (kind, label, detail, branches) in BuildDecisionPath(money))
        {
            step += 1;
            book.Row(step.ToString(CultureInfo.InvariantCulture), kind, label, detail, branches);
        }

        book.Sheet("RACI")
            .Title("Ownership (RACI)")
            .Note("Roles, not named people. Assign real names before tracking these as work items.")
            .Blank()
            .Headers("Workstream", "Responsible", "Accountable", "Consulted", "Informed");
        foreach (var row in BuildOwnershipMatrix(money)) book.Row([.. row]);

        book.Sheet("Delivery plan")
            .Title("Delivery plan: how to start")
            .Note("The review as backlog items. Estimates are not commitments; an item closes on a billed or observed outcome, never on an estimate.")
            .Blank()
            .Headers("Feature", "User story", "Owner role", "Done when");
        foreach (var row in BuildDeliveryPlan(money)) book.Row([.. row]);

        return book.End();
    }

    // A proportional block run, so a reader sees the shape of the data without a chart part in the package.
    private static string Bar(decimal amount, decimal peak)
    {
        if (peak <= 0 || amount <= 0) return string.Empty;
        var blocks = (int)decimal.Round(amount / peak * 24, 0, MidpointRounding.AwayFromZero);
        return new string('\u2588', Math.Clamp(blocks, 1, 24));
    }

    public byte[] ToPdf()
    {
        var currency = Summary.TotalCost.Currency;
        var money = (decimal value) => $"{CanonicalDecimal(decimal.Round(value, 2, MidpointRounding.ToEven))} {currency}";
        var report = PdfReport.Begin("Azure Cost Optimizer report", $"{Summary.PeriodLabel} · {ActualCostPeriod.Start} to {ActualCostPeriod.End}");

        report.Cover(
            "Azure Cost Optimizer",
            "Based on the Azure Cost Intelligence stack",
            "Evidence-backed cost review for the selected Azure scope. Every figure in this report resolves to a collected source receipt; published Microsoft guidance is included as a checklist and carries no amounts.",
            [
                ("Scope", Summary.ScopeAlias),
                ("Reporting period", $"{ActualCostPeriod.Start} to {ActualCostPeriod.End}"),
                ("Observed cost", $"{money(Summary.TotalCost.Amount)} ({Summary.FinancialBasis})"),
                ("Advisor annual potential", Summary.TotalEstimatedAnnualSavings is decimal cover ? money(cover) : "Not available"),
                ("Report", Summary.ReportId),
                ("Collected", Summary.CollectedAt.ToString("u", CultureInfo.InvariantCulture)),
            ],
            "Read-only report. Azure Advisor amounts are Microsoft estimates of annual potential, not approved targets and not realized savings. Overlapping recommendations are not additive. Review every action with an authorized human before making a change.");

        report.Section("Report summary").Facts(
        [
            ("Scope", Summary.ScopeAlias),
            ("Report", Summary.ReportId),
            ("Period requested", $"{Summary.RequestedPeriod.Start} to {Summary.RequestedPeriod.End}"),
            ("Period observed", $"{ActualCostPeriod.Start} to {ActualCostPeriod.End}"),
            ("Financial basis", Summary.FinancialBasis),
            ("Total observed cost", money(Summary.TotalCost.Amount)),
            ("Advisor annual potential", Summary.TotalEstimatedAnnualSavings is decimal annual ? money(annual) : "Not available"),
            ("Services observed", Summary.Services.Count.ToString(CultureInfo.InvariantCulture)),
            ("Resource groups observed", (Summary.ResourceGroups?.Count ?? 0).ToString(CultureInfo.InvariantCulture)),
            ("Resources in inventory", DataHealth.ResourceCount.ToString(CultureInfo.InvariantCulture)),
            ("Collected", Summary.CollectedAt.ToString("u", CultureInfo.InvariantCulture)),
            ("Data health", $"{DataHealth.Status} · {CostSourceStatus}"),
            ("Primary evidence", PrimaryEvidenceId),
        ]);

        var total = Summary.TotalCost.Amount;
        var share = (decimal amount) => total > 0 ? $"{decimal.Round(amount / total * 100, 1, MidpointRounding.ToEven).ToString(CultureInfo.InvariantCulture)}%" : "n/a";
        var plot = (decimal value) => $"{CanonicalDecimal(decimal.Round(value, 2, MidpointRounding.ToEven))}";
        var services = Summary.Services.OrderByDescending(item => item.Amount).ToArray();

        report.Section("Cost by service");
        report.Paragraph("Observed billed cost for the period. Bar length is proportional to the largest service.");
        report.BarChart([.. services.Take(10).Select(item => (item.Name, item.Amount))], plot);
        report.Table(
            ["Service", "Share", $"Cost ({currency})"], [300, 80, 123],
            [.. services.Select(item => (IReadOnlyList<string>)[item.Name, share(item.Amount), money(item.Amount)])]);

        if (services.Length > 1)
        {
            report.Section("Share of spend");
            report.Paragraph("Proportion of observed cost by service. Credits and refunds are excluded from this view because a share cannot represent a negative amount.");
            report.DonutChart([.. services.Take(8).Select(item => (item.Name, item.Amount))], plot);
        }

        if (Summary.ResourceGroups is { Count: > 0 } groups)
        {
            var ordered = groups.OrderByDescending(item => item.Amount).ToArray();
            report.Section("Cost by resource group");
            report.Paragraph("Resource groups indicate which team or workload carries the spend.");
            report.BarChart([.. ordered.Take(10).Select(item => (item.Name, item.Amount))], plot);
            report.Table(
                ["Resource group", "Share", $"Cost ({currency})"], [300, 80, 123],
                [.. ordered.Select(item => (IReadOnlyList<string>)[item.Name, share(item.Amount), money(item.Amount)])]);
        }

        if (Summary.Daily.Count > 0)
        {
            report.Section("Daily cost trend");
            report.Paragraph("Daily observed cost across the period. A daily total alone does not establish the cause of a change, and the most recent day may still be accruing.");
            report.LineChart([.. Summary.Daily.Select(item => (item.Date, item.Amount))], plot);
            report.Table(
                ["Date (UTC)", $"Cost ({currency})"], [380, 123],
                [.. Summary.Daily.Select(item => (IReadOnlyList<string>)[item.Date, money(item.Amount)])]);
        }

        report.Section("Azure Advisor cost recommendations");
        if (Advisor.Count == 0)
        {
            report.Paragraph("Azure Advisor returned no cost recommendations for this scope. Zero findings is a valid result, not missing evidence.");
        }
        else
        {
            report.Paragraph("Advisor amounts are Microsoft estimates of annual potential. They are not approved targets and not realized savings, and separate findings may overlap.");
            var ranked = Advisor
                .OrderByDescending(item => item.EstimatedAnnualSavings ?? 0m)
                .Select(item => (IReadOnlyList<string>)
                [
                    item.Title,
                    item.ResourceAlias ?? "subscription scope",
                    item.EstimatedAnnualSavings is decimal value && item.SavingsCurrency is { } savingsCurrency
                        ? $"{CanonicalDecimal(decimal.Round(value, 2, MidpointRounding.ToEven))} {savingsCurrency}"
                        : "not supplied",
                ])
                .ToArray();
            report.Table(["Recommendation", "Target", "Annual estimate"], [250, 120, 133], ranked);
            var estimates = Advisor.Where(item => item.EstimatedAnnualSavings is > 0).OrderByDescending(item => item.EstimatedAnnualSavings).Take(8).ToArray();
            if (estimates.Length > 1)
            {
                report.Paragraph("Estimated annual potential by recommendation, largest first.");
                report.BarChart([.. estimates.Select(item => (item.Title, item.EstimatedAnnualSavings!.Value))], plot);
            }
        }

        report.Section("Review opportunities");
        if (Opportunities.Count == 0)
        {
            report.Paragraph("No normalized opportunities were eligible for this report.");
        }
        else
        {
            report.Paragraph("Normalized review items from the evidence. Assign a named owner before scheduling work; the state shown here is not approval.");
            report.Table(
                ["Opportunity", "Category", "State", "Next action"], [155, 72, 76, 200],
                [.. Opportunities.Select(item => (IReadOnlyList<string>)[item.Title, item.Category, item.ReviewStatus, item.NextAction])]);
        }

        var guidance = OptimizationKnowledge.ForReport(Summary.Services.Select(item => item.Name).Take(5));
        report.Section("Well-Architected cost optimization checklist");
        report.Paragraph("Published Microsoft guidance. It carries no amounts and is a review checklist for this estate, not measured savings.");
        report.Table(
            ["Code", "What it asks", "What to check"], [52, 170, 281],
            [.. guidance.WellArchitected.Select(item => (IReadOnlyList<string>)[item.Code, item.Title, item.Recommendation])]);

        report.Section("FinOps Framework practices");
        report.Paragraph("Apply these in order: inform, then optimize, then operate.");
        report.Table(
            ["Phase", "Practice", "What it means here"], [70, 150, 283],
            [.. guidance.FinOps.Select(item => (IReadOnlyList<string>)[item.Phase, item.Title, item.Practice])]);

        report.Section("Decision path");
        report.Paragraph("A deterministic path built from this report. Every decision is a human judgement, and nothing here is executed automatically.");
        report.Flow(BuildDecisionPath(money));

        report.Section("Ownership (RACI)");
        report.Paragraph("Roles, not named people. This report carries no owner assignments, so assign real names before tracking these as work items.");
        report.Table(
            ["Workstream", "Responsible", "Accountable", "Consulted", "Informed"], [143, 93, 93, 93, 81],
            BuildOwnershipMatrix(money));

        report.Section("Delivery plan: how to start", 380);
        report.Paragraph("The review broken into backlog items so it can be scheduled like any other work. Each item states the trigger evidence, the owning role, and the measure that closes it. Estimates are not commitments; an item closes on a billed outcome, not on an estimate.");
        report.Table(
            ["Feature", "User story", "Owner role", "Done when"], [110, 190, 90, 113],
            BuildDeliveryPlan(money));

        report.Section("Evidence and limitations", 300);
        report.Table(
            ["Source", "Rows", "Complete"], [300, 80, 123],
            [.. DataHealth.Sources.Select(item => (IReadOnlyList<string>)[item.Source, item.Counts.Rows.ToString(CultureInfo.InvariantCulture), item.Complete ? "yes" : "no"])]);
        var limitations = GetReportLimitations();
        if (limitations.Count > 0) report.Bullets(limitations);
        report.Bullets(guidance.Sources.Select(item => $"{item.Title}: {item.Url}"));

        return report.End();
    }

    private static readonly System.Text.RegularExpressions.Regex CommitmentTitle = new(@"(?i)\b(reserved instance|reservation|savings plan|commitment)\b", System.Text.RegularExpressions.RegexOptions.Compiled);

    // The same evidence expressed as backlog items. Every row is derived, never invented, and the "done when"
    // column is always a billed or observed outcome so an estimate can never close an item.
    private IReadOnlyList<IReadOnlyList<string>> BuildDeliveryPlan(Func<decimal, string> money)
    {
        var rows = new List<IReadOnlyList<string>>();
        var services = Summary.Services.OrderByDescending(item => item.Amount).ToArray();

        rows.Add([
            "Establish the baseline",
            "As a FinOps practitioner I want the current billed total and its source receipts recorded so that later change can be measured against something agreed.",
            "FinOps practitioner",
            $"Baseline of {money(Summary.TotalCost.Amount)} for {ActualCostPeriod.Start} to {ActualCostPeriod.End} is recorded with report {Summary.ReportId}.",
        ]);

        foreach (var service in services.Take(3))
        {
            rows.Add([
                $"Review {service.Name}",
                $"As the owner of {service.Name} I want its {money(service.Amount)} of billed cost explained by workload so that I can tell necessary spend from waste.",
                "Workload engineer",
                "Each cost component is attributed to a workload, or raised as unattributed and given an owner.",
            ]);
        }

        if (Summary.ResourceGroups is { Count: > 0 } groups)
        {
            var top = groups.OrderByDescending(item => item.Amount).First();
            rows.Add([
                "Confirm accountability",
                $"As finance I want a named owner for {top.Name} at {money(top.Amount)} so that the spend has someone accountable for it.",
                "Resource group owner",
                "An owner is named against the resource group and recorded in the tag or CMDB of record.",
            ]);
        }

        if (Advisor.Count > 0)
        {
            var commitments = Advisor.Count(item => item.Title is { } title && CommitmentTitle.IsMatch(title));
            rows.Add([
                "Triage Advisor findings",
                $"As a workload owner I want the {Advisor.Count} Advisor finding(s) triaged into accept, reject or needs-evidence so that only supportable actions reach the backlog.",
                "Workload owner",
                "Every finding carries a decision and a reason; overlapping findings are merged so estimates are not double counted.",
            ]);
            if (commitments > 0)
            {
                rows.Add([
                    "Assess commitments",
                    $"As finance I want the {commitments} commitment-style finding(s) tested against a stable usage baseline so that we do not lock in spend we cannot use.",
                    "Finance and FinOps",
                    "A commitment decision is recorded with the utilization window that supports it, or deferred with a revisit date.",
                ]);
            }
        }

        if (Summary.Daily.Count > 0)
        {
            rows.Add([
                "Watch the trend",
                "As a platform engineer I want a recurring check on daily spend so that a step change is noticed in days rather than at invoice time.",
                "Platform engineering",
                "A review cadence exists and the most recent partial day is excluded from any comparison.",
            ]);
        }

        rows.Add([
            "Close the loop",
            "As leadership I want each accepted action tracked to a billed outcome so that reported savings are realized rather than estimated.",
            "FinOps practitioner",
            "Realized savings are reported from billed cost after the change, separately from the original estimate.",
        ]);

        return rows;
    }

    private IReadOnlyList<(string Kind, string Label, string Detail, string Branches)> BuildDecisionPath(Func<decimal, string> money)
    {
        var top = Summary.Services.OrderByDescending(item => item.Amount).FirstOrDefault();
        var leading = top is null ? "the largest service" : $"{top.Name} at {money(top.Amount)}";
        var commitments = Advisor.Count(item => item.Title is { } title && CommitmentTitle.IsMatch(title));
        return
        [
            ("start", "Start with the largest cost", $"Leading service: {leading}.", ""),
            ("decision", "Is there an Advisor finding for it?", $"{Advisor.Count} finding(s) in this report.", "Yes: validate the estimate. No: review scaling and rates."),
            ("action", "Validate the estimate", "Advisor savings are estimates. Confirm utilization and ownership before accepting one.", ""),
            ("action", "Review scaling and rates", "Well-Architected CO:12 scaling costs and CO:05 provider rates.", ""),
            ("decision", "Is utilization evidence adequate?", "Rightsizing needs enough days and metric coverage to be safe.", "Yes: assess the baseline. No: collect utilization first."),
            ("action", "Collect utilization first", "Gather Azure Monitor metrics over a representative period, then revisit.", ""),
            ("decision", "Is the baseline stable?", commitments > 0 ? $"{commitments} commitment-style finding(s) present." : "No commitment-style findings in this report.", "Yes: evaluate a commitment. No: optimize usage first."),
            ("action", "Evaluate a commitment", "Reservations or savings plans only after stable use is established (CO:05).", ""),
            ("action", "Optimize usage first", "Remove idle and unused components and tune scaling (CO:07, CO:12).", ""),
            ("end", "Assign, schedule, track", "Name an owner, set a review date, and record the billed outcome (FinOps Operate).", ""),
        ];
    }

    private IReadOnlyList<IReadOnlyList<string>> BuildOwnershipMatrix(Func<decimal, string> money)
    {
        var rows = new List<IReadOnlyList<string>>();
        foreach (var service in Summary.Services.OrderByDescending(item => item.Amount).Take(3))
        {
            rows.Add([$"Review {service.Name} ({money(service.Amount)})", "Workload engineer", "Application owner", "Platform and FinOps", "Finance and leadership"]);
        }
        if (Summary.ResourceGroups is { Count: > 0 } groups)
        {
            var top = groups.OrderByDescending(item => item.Amount).First();
            rows.Add([$"Confirm ownership of {top.Name}", "Resource group owner", "Workload owner", "Platform engineering", "Finance"]);
        }
        if (Advisor.Count > 0)
        {
            rows.Add([$"Triage {Advisor.Count} Advisor finding(s)", "FinOps practitioner", "Workload owner", "Service engineers", "Finance"]);
        }
        rows.Add(["Confirm the billed outcome after each change", "FinOps practitioner", "Cost owner for the scope", "Workload engineers", "Finance and leadership"]);
        return rows;
    }

    private static string CanonicalDecimal(decimal value) => value.ToString("0.#############################", CultureInfo.InvariantCulture);

    private static string Csv(string value)
    {
        var safe = value.Length > 0 && value[0] is '=' or '+' or '-' or '@' ? $"'{value}" : value;
        return $"\"{safe.Replace("\"", "\"\"")}\"";
    }
}

public sealed record PeriodSelection(string Key, string Label)
{
    public static readonly PeriodSelection MonthToDate = new("mtd", "This month");

    public static PeriodSelection Parse(string? value) => value?.ToLowerInvariant() switch
    {
        null or "" or "mtd" => MonthToDate,
        "7d" => new("7d", "Last 7 days"),
        "30d" => new("30d", "Last 30 days"),
        "3m" => new("3m", "Last 3 months"),
        _ => throw new ArgumentException("Period must be one of: mtd, 7d, 30d, 3m."),
    };

    public (DateTimeOffset Start, DateTimeOffset EndExclusive) Resolve(DateTimeOffset now)
    {
        var currentMonth = new DateTime(now.UtcDateTime.Year, now.UtcDateTime.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var endExclusive = now.UtcDateTime.Date.AddDays(1);
        var start = Key switch
        {
            "mtd" => currentMonth,
            "7d" => endExclusive.AddDays(-7),
            "30d" => endExclusive.AddDays(-30),
            "3m" => currentMonth.AddMonths(-2),
            _ => throw new InvalidOperationException("Unsupported period."),
        };
        return (new DateTimeOffset(start), new DateTimeOffset(endExclusive));
    }
}