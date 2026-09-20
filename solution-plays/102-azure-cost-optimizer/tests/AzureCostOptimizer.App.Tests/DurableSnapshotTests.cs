using System.Text;
using System.Text.Json;
using System.Security.Cryptography;
using System.Text.Json.Nodes;
using System.Security.AccessControl;
using System.Security.Principal;
using Azure.Identity;
using Azure.Core;
using System.Net;
using Microsoft.Extensions.Configuration;
using Xunit;

public sealed class DurableSnapshotTests
{
    private static readonly DateTimeOffset TestNow = new(2026, 9, 17, 12, 0, 0, TimeSpan.Zero);
    private static readonly Guid Subscription = new("00000000-0000-0000-0000-000000000001");
    private static readonly Guid Tenant = new("00000000-0000-0000-0000-000000000002");
    private static readonly Guid Principal = new("00000000-0000-0000-0000-000000000003");

    [Fact]
    public async Task Explicit_publication_restores_on_restart_with_one_authorization_read_and_zero_collection()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        var clock = new SnapshotTestClock(TestNow);
        var collector = new LocalSnapshotHandler { AllowCollection = true };
        using var initialClient = new HttpClient(collector);
        var initial = new AzureEvidenceService(initialClient, new LocalSnapshotCredential(clock), cache.Configuration, clock);
        var published = await initial.RefreshAsync("mtd", CancellationToken.None);
        Assert.Equal("saved", initial.DurableCacheStatus);
        Assert.NotEmpty(published.Advisor);
        Assert.NotEmpty(published.Opportunities);
        Assert.Equal(3, collector.CollectorRequests);
        Assert.Equal(0, collector.PermissionRequests);

        var authorization = new LocalSnapshotHandler();
        var identity = new LocalSnapshotCredential(clock);
        using var restartedClient = new HttpClient(authorization);
        var restarted = new AzureEvidenceService(restartedClient, identity, cache.Configuration, clock);
        await restarted.RestoreCachedAsync(CancellationToken.None);
        var restored = Assert.IsType<EvidenceSnapshot>(restarted.GetCached("mtd"));

        Assert.Equal("restored", restarted.DurableCacheStatus);
        Assert.Equal(published.Summary.ReportId, restored.Summary.ReportId);
        Assert.Equal(published.Summary.CollectedAt, restored.Summary.CollectedAt);
        Assert.Equal(published.ToCanonicalJson(), restored.ToCanonicalJson());
        Assert.Equal(published.ToCsv(), restored.ToCsv());
        Assert.Equal(published.ToFocusCsv(), restored.ToFocusCsv());
        Assert.Equal(published.ToHtml(), restored.ToHtml());
        Assert.Equal("durable-cache", restored.DataHealth.Cache?.Provenance);
        Assert.Equal("fresh", restored.DataHealth.Cache?.Freshness);
        await restarted.RestoreCachedAsync(CancellationToken.None);
        for (var read = 0; read < 100; read++) Assert.Equal(published.Summary.ReportId, restarted.GetCached("mtd")?.Summary.ReportId);
        Assert.Equal(1, identity.Requests);
        Assert.Equal(1, authorization.PermissionRequests);
        Assert.Equal(0, authorization.CollectorRequests);
    }

    [Fact]
    public async Task Restored_cache_age_is_distinct_from_source_freshness_and_does_not_renew_collection_time()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        Assert.True(await cache.CreateStore().SaveAsync(CreateSnapshot(), Identity, TestNow, TestNow, CancellationToken.None));
        var clock = new SnapshotTestClock(TestNow.AddMinutes(6));
        var handler = new LocalSnapshotHandler();
        using var client = new HttpClient(handler);
        var service = new AzureEvidenceService(client, new LocalSnapshotCredential(clock), cache.Configuration, clock);

        await service.RestoreCachedAsync(CancellationToken.None);

        var restored = Assert.IsType<EvidenceSnapshot>(service.GetCached("mtd"));
        Assert.Equal("stale", restored.DataHealth.Cache?.Freshness);
        Assert.Equal("fresh", restored.DataHealth.Status);
        Assert.Equal("fresh", restored.Summary.Status);
        Assert.Equal(TestNow, restored.Summary.CollectedAt);
        clock.Now = TestNow.AddDays(1);
        Assert.Null(service.GetCached("mtd"));
        Assert.Equal(1, handler.PermissionRequests);
        Assert.Equal(0, handler.CollectorRequests);
    }

    [Theory]
    [InlineData("missing-rights")]
    [InlineData("not-actions")]
    [InlineData("conditional")]
    [InlineData("partial-permissions")]
    [InlineData("invalid-json")]
    [InlineData("forbidden")]
    [InlineData("unauthorized")]
    [InlineData("throttled")]
    [InlineData("unavailable")]
    public async Task Unproven_startup_authorization_never_restores_or_collects(string failure)
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        Assert.True(await cache.CreateStore().SaveAsync(CreateSnapshot(), Identity, TestNow, TestNow, CancellationToken.None));
        var handler = new LocalSnapshotHandler
        {
            PermissionPayload = failure switch
            {
                "missing-rights" => "{\"value\":[{\"actions\":[\"Microsoft.CostManagement/query/read\"],\"notActions\":[]}]}",
                "not-actions" => "{\"value\":[{\"actions\":[\"*\"],\"notActions\":[\"Microsoft.Advisor/*\"]}]}",
                "conditional" => "{\"value\":[{\"actions\":[\"*\"],\"notActions\":[],\"condition\":\"unverified\"}]}",
                "partial-permissions" => "{\"value\":[{\"actions\":[\"*\"],\"notActions\":[]}],\"nextLink\":\"https://example.invalid\"}",
                "invalid-json" => "{",
                _ => LocalSnapshotHandler.ReadPermission,
            },
            PermissionStatus = failure switch
            {
                "forbidden" => HttpStatusCode.Forbidden,
                "unauthorized" => HttpStatusCode.Unauthorized,
                "throttled" => HttpStatusCode.TooManyRequests,
                "unavailable" => HttpStatusCode.ServiceUnavailable,
                _ => HttpStatusCode.OK,
            },
        };
        using var client = new HttpClient(handler);
        var clock = new SnapshotTestClock(TestNow);
        var service = new AzureEvidenceService(client, new LocalSnapshotCredential(clock), cache.Configuration, clock);

        await service.RestoreCachedAsync(CancellationToken.None);

        Assert.Null(service.GetCached("mtd"));
        Assert.NotEqual("restored", service.DurableCacheStatus);
        Assert.Equal(1, handler.PermissionRequests);
        Assert.Equal(0, handler.CollectorRequests);
    }

    [Fact]
    public async Task Identity_denial_purges_already_published_memory_without_recollection()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        var clock = new SnapshotTestClock(TestNow);
        var credential = new LocalSnapshotCredential(clock);
        var handler = new LocalSnapshotHandler { AllowCollection = true };
        using var client = new HttpClient(handler);
        var service = new AzureEvidenceService(client, credential, cache.Configuration, clock);
        await service.RefreshAsync("mtd", CancellationToken.None);
        Assert.NotNull(service.GetCached("mtd"));
        credential.Denied = true;

        await service.RestoreCachedAsync(CancellationToken.None);

        Assert.Null(service.GetCached("mtd"));
        Assert.Equal("authorization-denied", service.DurableCacheStatus);
        Assert.Equal(3, handler.CollectorRequests);
        Assert.Equal(0, handler.PermissionRequests);
    }

    [Theory]
    [InlineData("solution_snapshot", "local")]
    [InlineData("live", "hosted_demo")]
    public async Task Nonlocal_or_snapshot_restore_uses_no_credentials_network_or_cache_directory(string profile, string hosting)
    {
        using var cache = new SnapshotTestDirectory();
        var configuration = cache.Configuration;
        configuration["ACI_DATA_PROFILE"] = profile;
        configuration["ACI_HOSTING_PROFILE"] = hosting;
        using var client = new HttpClient(new ThrowingHttpHandler());
        var service = new AzureEvidenceService(client, new ThrowingCredential(), configuration);

        await service.RestoreCachedAsync(CancellationToken.None);

        Assert.Equal("disabled-profile", service.DurableCacheStatus);
        Assert.False(Directory.Exists(cache.Path));
    }

    [Fact]
    public async Task Empty_local_cache_does_not_acquire_credentials_or_collect()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        using var client = new HttpClient(new ThrowingHttpHandler());
        var service = new AzureEvidenceService(client, new ThrowingCredential(), cache.Configuration);

        await service.RestoreCachedAsync(CancellationToken.None);

        Assert.Equal("empty", service.DurableCacheStatus);
        Assert.False(Directory.Exists(cache.Path));
    }

    [Fact]
    public async Task Partial_refresh_does_not_replace_the_durable_complete_publication()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        var clock = new SnapshotTestClock(TestNow);
        var handler = new LocalSnapshotHandler { AllowCollection = true };
        using var client = new HttpClient(handler);
        var service = new AzureEvidenceService(client, new LocalSnapshotCredential(clock), cache.Configuration, clock);
        var complete = await service.RefreshAsync("mtd", CancellationToken.None);
        var path = Assert.Single(Directory.GetFiles(cache.Path, "*.bin"));
        var previous = await File.ReadAllBytesAsync(path);
        handler.PartialCost = true;
        clock.Now = clock.Now.AddMinutes(1);

        var partial = await service.RefreshAsync("mtd", CancellationToken.None);

        Assert.Equal("partial", partial.DataHealth.Status);
        Assert.Equal("not-saved-partial", service.DurableCacheStatus);
        Assert.Equal(previous, await File.ReadAllBytesAsync(path));
        Assert.Equal(complete.Summary.ReportId, Assert.Single(await cache.CreateStore().LoadAsync(Identity, clock.Now, CancellationToken.None)).ReportId);
    }

    [Fact]
    public async Task Profile_and_scope_changes_cannot_reuse_live_memory()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        var clock = new SnapshotTestClock(TestNow);
        var configuration = cache.Configuration;
        using var client = new HttpClient(new LocalSnapshotHandler { AllowCollection = true });
        var service = new AzureEvidenceService(client, new LocalSnapshotCredential(clock), configuration, clock);
        await service.RefreshAsync("mtd", CancellationToken.None);
        configuration["ACI_SUBSCRIPTION_ID"] = Guid.NewGuid().ToString("D");
        Assert.Null(service.GetCached("mtd"));
        configuration["ACI_SUBSCRIPTION_ID"] = Subscription.ToString("D");
        await service.RefreshAsync("mtd", CancellationToken.None);
        configuration["ACI_DATA_PROFILE"] = "solution_snapshot";

        Assert.Null(service.GetCached("mtd"));
    }

    [Fact]
    public async Task Retention_keeps_sixteen_owned_entries_and_does_not_delete_other_files()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        var store = cache.CreateStore();
        Assert.True(await store.SaveAsync(CreateSnapshot(), Identity, TestNow, TestNow, CancellationToken.None));
        var otherFile = System.IO.Path.Combine(cache.Path, "unrelated.txt");
        await File.WriteAllTextAsync(otherFile, "leave unchanged");
        for (var revision = 1; revision <= 16; revision++)
        {
            var collectedAt = TestNow.AddSeconds(revision);
            Assert.True(await store.SaveAsync(CreateSnapshot(collectedAt), Identity, collectedAt, collectedAt, CancellationToken.None));
        }

        Assert.Equal(16, Directory.GetFiles(cache.Path, "*.bin").Length);
        Assert.Equal("leave unchanged", await File.ReadAllTextAsync(otherFile));
        Assert.Equal(TestNow.AddSeconds(16), Assert.Single(await store.LoadAsync(Identity, TestNow.AddSeconds(17), CancellationToken.None)).Snapshot.Summary.CollectedAt);
    }

    [Fact]
    public async Task Size_limits_refuse_oversize_plaintext_and_ciphertext()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        var store = cache.CreateStore();
        var snapshot = CreateSnapshot();
        var oversized = snapshot with
        {
            Summary = snapshot.Summary with { Services = [new ServiceCostDto(new string('a', DurableSnapshotStore.MaximumSnapshotBytes), 3.3m)] },
        };
        Assert.False(await store.SaveAsync(oversized, Identity, TestNow, TestNow, CancellationToken.None));
        Assert.False(Directory.Exists(cache.Path));
        Assert.True(await store.SaveAsync(snapshot, Identity, TestNow, TestNow, CancellationToken.None));
        var path = Assert.Single(Directory.GetFiles(cache.Path, "*.bin"));
        await using (var stream = new FileStream(path, FileMode.Open, FileAccess.Write, FileShare.None)) stream.SetLength(DurableSnapshotStore.MaximumCiphertextBytes + 1);

        Assert.Empty(await store.LoadAsync(Identity, TestNow, CancellationToken.None));
    }

    [Fact]
    public async Task Files_are_current_user_only_and_serialized_data_contains_no_token_or_raw_payload()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        var clock = new SnapshotTestClock(TestNow);
        using var client = new HttpClient(new LocalSnapshotHandler { AllowCollection = true });
        var service = new AzureEvidenceService(client, new LocalSnapshotCredential(clock), cache.Configuration, clock);
        await service.RefreshAsync("mtd", CancellationToken.None);
        using var current = WindowsIdentity.GetCurrent();
        var directorySecurity = new DirectoryInfo(cache.Path).GetAccessControl();
        Assert.True(directorySecurity.AreAccessRulesProtected);
        Assert.Equal(current.User, directorySecurity.GetOwner(typeof(SecurityIdentifier)));
        foreach (var path in Directory.GetFiles(cache.Path))
        {
            var rules = new FileInfo(path).GetAccessControl().GetAccessRules(true, true, typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>();
            foreach (var rule in rules) Assert.Equal(current.User, rule.IdentityReference);
        }
        var file = Assert.Single(Directory.GetFiles(cache.Path, "*.bin"));
        var plaintext = ProtectedData.Unprotect(await File.ReadAllBytesAsync(file), cache.CreateStore().PartitionEntropy(Identity), DataProtectionScope.CurrentUser);
        try
        {
            var json = Encoding.UTF8.GetString(plaintext);
            Assert.DoesNotContain("synthetic-local-token", json, StringComparison.Ordinal);
            Assert.DoesNotContain("accessToken", json, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("rawPayloads", json, StringComparison.OrdinalIgnoreCase);
        }
        finally { CryptographicOperations.ZeroMemory(plaintext); }
    }

    [Fact]
    public void Workspace_directories_and_unsupported_platforms_cannot_enable_persistence()
    {
        using var cache = new SnapshotTestDirectory();
        var configuration = cache.Configuration;
        configuration["ACI_SNAPSHOT_CACHE_DIRECTORY"] = AppContext.BaseDirectory;

        Assert.Null(DurableSnapshotStore.TryCreate(configuration, out var status));
        Assert.Equal(OperatingSystem.IsWindows() ? "unavailable-directory" : "unavailable-platform", status);
    }

    [Fact]
    public async Task Encrypted_store_survives_a_new_store_instance_and_preserves_financial_identity()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        var store = cache.CreateStore();
        var snapshot = CreateSnapshot();

        Assert.True(await store.SaveAsync(snapshot, Identity, TestNow, TestNow, CancellationToken.None));
        var restored = Assert.Single(await cache.CreateStore().LoadAsync(Identity, TestNow.AddMinutes(1), CancellationToken.None));

        Assert.Equal(snapshot.ToCanonicalJson(), restored.Snapshot.ToCanonicalJson());
        Assert.Equal(snapshot.Summary.ReportId, restored.Snapshot.Summary.ReportId);
        Assert.Equal(snapshot.Summary.CollectedAt, restored.Snapshot.Summary.CollectedAt);
        var ciphertext = await File.ReadAllBytesAsync(Assert.Single(Directory.GetFiles(cache.Path, "*.bin")));
        Assert.DoesNotContain("Compute", Encoding.UTF8.GetString(ciphertext), StringComparison.Ordinal);
        Assert.DoesNotContain(snapshot.Summary.ReportId, Encoding.UTF8.GetString(ciphertext), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("tenant")]
    [InlineData("subscription")]
    [InlineData("principal")]
    public async Task Encrypted_store_never_restores_another_identity(string changed)
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        var store = cache.CreateStore();
        Assert.True(await store.SaveAsync(CreateSnapshot(), Identity, TestNow, TestNow, CancellationToken.None));
        var other = changed switch
        {
            "tenant" => Identity with { TenantId = Guid.NewGuid() },
            "subscription" => Identity with { SubscriptionId = Guid.NewGuid() },
            _ => Identity with { PrincipalId = Guid.NewGuid() },
        };

        Assert.Empty(await cache.CreateStore().LoadAsync(other, TestNow, CancellationToken.None));
    }

    [Theory]
    [InlineData("sourceContractVersion")]
    [InlineData("currency")]
    [InlineData("reportId")]
    [InlineData("profile")]
    [InlineData("osUserId")]
    [InlineData("periodStart")]
    [InlineData("authorizationExpiresAt")]
    [InlineData("savedAt")]
    public async Task Authenticated_but_incompatible_envelopes_are_rejected(string changed)
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        var store = cache.CreateStore();
        Assert.True(await store.SaveAsync(CreateSnapshot(), Identity, TestNow, TestNow, CancellationToken.None));
        var path = Assert.Single(Directory.GetFiles(cache.Path, "*.bin"));
        var plaintext = ProtectedData.Unprotect(await File.ReadAllBytesAsync(path), store.PartitionEntropy(Identity), DataProtectionScope.CurrentUser);
        var envelope = JsonNode.Parse(plaintext)!;
        CryptographicOperations.ZeroMemory(plaintext);
        envelope[changed] = changed switch
        {
            "sourceContractVersion" => "aco-normalized-v1;cost-2025-03-01;advisor-2025-01-01;resource-graph-2022-10-01",
            "periodStart" => TestNow.AddDays(-1).ToString("O"),
            "authorizationExpiresAt" => TestNow.AddHours(25).ToString("O"),
            "savedAt" => TestNow.AddMinutes(1).ToString("O"),
            _ => "incompatible",
        };
        var edited = Encoding.UTF8.GetBytes(envelope.ToJsonString());
        await File.WriteAllBytesAsync(path, ProtectedData.Protect(edited, store.PartitionEntropy(Identity), DataProtectionScope.CurrentUser));
        CryptographicOperations.ZeroMemory(edited);

        Assert.Empty(await cache.CreateStore().LoadAsync(Identity, TestNow, CancellationToken.None));
    }

    [Theory]
    [InlineData("partial")]
    [InlineData("currency")]
    [InlineData("scope")]
    [InlineData("period")]
    [InlineData("version")]
    [InlineData("future")]
    [InlineData("parity")]
    public async Task Invalid_publications_preserve_the_previous_encrypted_entry(string defect)
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        var store = cache.CreateStore();
        var snapshot = CreateSnapshot();
        Assert.True(await store.SaveAsync(snapshot, Identity, TestNow, TestNow, CancellationToken.None));
        var path = Assert.Single(Directory.GetFiles(cache.Path, "*.bin"));
        var previousBytes = await File.ReadAllBytesAsync(path);
        var invalid = defect switch
        {
            "partial" => snapshot with { DataHealth = snapshot.DataHealth with { Status = "partial" } },
            "currency" => snapshot with { Summary = snapshot.Summary with { TotalCost = new MoneyDto(3.3m, "EUR") } },
            "scope" => snapshot with { Summary = snapshot.Summary with { ScopeAlias = "other-scope" } },
            "period" => snapshot with { Summary = snapshot.Summary with { RequestedPeriod = new PeriodDto(TestNow.AddDays(-1), TestNow) } },
            "version" => snapshot with { DataHealth = snapshot.DataHealth with { Sources = snapshot.DataHealth.Sources.Select(source => source with { ApiVersion = "future" }).ToArray() } },
            "future" => CreateSnapshot(TestNow.AddMinutes(1)),
            _ => snapshot with { Summary = snapshot.Summary with { TotalCost = new MoneyDto(10m, "USD") } },
        };

        Assert.False(await store.SaveAsync(invalid, Identity, TestNow, TestNow, CancellationToken.None));
        Assert.Equal(previousBytes, await File.ReadAllBytesAsync(path));
        Assert.Equal(snapshot.Summary.ReportId, Assert.Single(await cache.CreateStore().LoadAsync(Identity, TestNow, CancellationToken.None)).ReportId);
    }

    [Fact]
    public async Task Corrupt_expired_and_wrong_currency_entries_are_not_restored()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        var store = cache.CreateStore();
        Assert.True(await store.SaveAsync(CreateSnapshot(), Identity, TestNow, TestNow, CancellationToken.None));
        Assert.Empty(await store.LoadAsync(Identity, TestNow.AddHours(24), CancellationToken.None));
        var otherCurrency = cache.Configuration;
        otherCurrency["ACI_CURRENCY"] = "EUR";
        var currencyStore = DurableSnapshotStore.TryCreate(otherCurrency, out _)!;
        Assert.Empty(await currencyStore.LoadAsync(Identity, TestNow, CancellationToken.None));
        var path = Assert.Single(Directory.GetFiles(cache.Path, "*.bin"));
        var ciphertext = await File.ReadAllBytesAsync(path);
        ciphertext[ciphertext.Length / 2] ^= 0xff;
        await File.WriteAllBytesAsync(path, ciphertext);

        Assert.Empty(await store.LoadAsync(Identity, TestNow, CancellationToken.None));
    }

    [Fact]
    public async Task Cancelled_save_and_unfinished_temp_file_leave_the_last_good_snapshot_intact()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var cache = new SnapshotTestDirectory();
        var store = cache.CreateStore();
        var snapshot = CreateSnapshot();
        Assert.True(await store.SaveAsync(snapshot, Identity, TestNow, TestNow, CancellationToken.None));
        var temporary = System.IO.Path.Combine(cache.Path, $"aco-snapshot-v1-{Guid.NewGuid():N}.tmp");
        await File.WriteAllBytesAsync(temporary, [1, 2, 3]);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => store.SaveAsync(CreateSnapshot(TestNow.AddMinutes(1)), Identity,
            TestNow.AddMinutes(1), TestNow.AddMinutes(1), cancellation.Token));

        Assert.Equal(snapshot.Summary.ReportId, Assert.Single(await cache.CreateStore().LoadAsync(Identity, TestNow, CancellationToken.None)).ReportId);
    }

    [Theory]
    [InlineData("wwwroot")]
    [InlineData("packages")]
    [InlineData("node_modules")]
    public void Public_and_package_cache_locations_are_refused(string directory)
    {
        using var cache = new SnapshotTestDirectory();
        var configuration = cache.Configuration;
        configuration["ACI_SNAPSHOT_CACHE_DIRECTORY"] = System.IO.Path.Combine(cache.Path, directory, "snapshots");

        Assert.Null(DurableSnapshotStore.TryCreate(configuration, out _));
        Assert.False(Directory.Exists(cache.Path));
    }

    [Fact]
    public void Selected_subscription_token_binds_cli_metadata_and_claims()
    {
        var selected = ParseIdentity(TokenResponse());

        Assert.Equal(new SubscriptionIdentity(Tenant, Subscription, Principal), selected.Identity);
        Assert.Equal(TestNow.AddHours(1), selected.AccessToken.ExpiresOn);
    }

    [Theory]
    [InlineData("subscription")]
    [InlineData("tenant")]
    [InlineData("tid")]
    [InlineData("oid")]
    [InlineData("aud")]
    [InlineData("exp")]
    [InlineData("nbf")]
    [InlineData("alg")]
    [InlineData("jwt")]
    public void Selected_subscription_token_rejects_unbound_or_invalid_identity(string defect)
    {
        var response = TokenResponse(defect);

        var error = Assert.Throws<AuthenticationFailedException>(() => ParseIdentity(response));

        Assert.DoesNotContain("accessToken", error.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain("fixture-signature", error.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void Selected_subscription_token_rejects_configured_tenant_mismatch()
    {
        Assert.Throws<AuthenticationFailedException>(() => SubscriptionAzureCliCredential.ParseTokenResponse(
            TokenResponse(), Subscription.ToString(), Principal.ToString(), "https://management.azure.com/", TestNow));
    }

    [Fact]
    public void Refresh_identity_changes_when_the_resolved_day_changes()
    {
        var clock = new SnapshotTestClock(new DateTimeOffset(2026, 9, 17, 12, 0, 0, TimeSpan.Zero));
        using var client = new HttpClient(new ThrowingHttpHandler());
        var service = new AzureEvidenceService(client, new ThrowingCredential(), new ConfigurationBuilder().Build(), clock);
        var operationId = service.GetRefreshOperationId("mtd");

        clock.Now = clock.Now.AddDays(1);

        Assert.NotEqual(operationId, service.GetRefreshOperationId("mtd"));
    }

    [Theory]
    [InlineData("mtd", 9)]
    [InlineData("3m", 7)]
    public void Month_end_periods_start_in_the_requested_month(string period, int expectedStartMonth)
    {
        var now = new DateTimeOffset(2026, 9, 30, 23, 59, 0, TimeSpan.Zero);

        var (start, endExclusive) = PeriodSelection.Parse(period).Resolve(now);

        Assert.Equal(new DateTimeOffset(2026, expectedStartMonth, 1, 0, 0, 0, TimeSpan.Zero), start);
        Assert.Equal(new DateTimeOffset(2026, 10, 1, 0, 0, 0, TimeSpan.Zero), endExclusive);
    }

    private static SubscriptionIdentity Identity => new(Tenant, Subscription, Principal);

    private static EvidenceSnapshot CreateSnapshot(DateTimeOffset? collectedAt = null)
    {
        var now = collectedAt ?? TestNow;
        var selection = PeriodSelection.MonthToDate;
        var (start, endExclusive) = selection.Resolve(now);
        var requested = ReceiptPeriodDto.From(start, endExclusive.AddDays(-1));
        var tenantAlias = $"tenant-{AzureEvidenceService.Sha256(Tenant.ToString("D"))[..12]}";
        var receipts = new[] { ("cost-management-query", "2025-03-01"), ("advisor", "2025-01-01"), ("resource-graph", "2022-10-01") }
            .Select((source, index) => new SourceReceiptDto("1.0.0", source.Item1, source.Item2, tenantAlias, "solution-scope", requested, requested,
                index == 0 ? "billed" : "not-applicable", index == 0 ? "USD" : null, now, "complete", true, new SourceCountsDto(1, 1, 1, 128, null),
                null, null, AzureEvidenceService.Sha256(source.Item1), [$"ev_{AzureEvidenceService.Sha256(source.Item1)[..20]}"]))
            .ToArray();
        var snapshot = TestSnapshot.Create(now, estimatedAnnualSavings: null);
        return snapshot with
        {
            Summary = snapshot.Summary with
            {
                ReportId = AzureEvidenceService.CreateReportId(Subscription.ToString("D"), selection, start, endExclusive, receipts),
                RequestedPeriod = new PeriodDto(start, endExclusive.AddDays(-1)),
            },
            Advisor = [],
            Opportunities = [],
            DataHealth = new DataHealthDto("fresh", receipts.Select(source => source.ContentSha256).ToArray(), receipts, 0, 2, null, null),
            CostSourceStatus = "query",
        };
    }

    private sealed class SnapshotTestDirectory : IDisposable
    {
        public string Path { get; } = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"aco-durable-tests-{Guid.NewGuid():N}");
        public IConfiguration Configuration => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ACI_DATA_PROFILE"] = "live",
            ["ACI_HOSTING_PROFILE"] = "local",
            ["ACI_SUBSCRIPTION_ID"] = Subscription.ToString("D"),
            ["ACI_TENANT_ID"] = Tenant.ToString("D"),
            ["ACI_SNAPSHOT_CACHE_DIRECTORY"] = Path,
        }).Build();

        public DurableSnapshotStore CreateStore()
        {
            var store = DurableSnapshotStore.TryCreate(Configuration, out var status);
            Assert.Equal("available", status);
            return Assert.IsType<DurableSnapshotStore>(store);
        }

        public void Dispose()
        {
            if (Directory.Exists(Path)) Directory.Delete(Path, recursive: true);
        }
    }

    private static SubscriptionIdentityToken ParseIdentity(string response) => SubscriptionAzureCliCredential.ParseTokenResponse(
        response, Subscription.ToString(), Tenant.ToString(), "https://management.azure.com/", TestNow);

    private static string TokenResponse(string? defect = null)
    {
        var claims = new Dictionary<string, object>
        {
            ["tid"] = defect == "tid" ? Principal : Tenant,
            ["oid"] = defect == "oid" ? Guid.Empty : Principal,
            ["aud"] = defect == "aud" ? "https://example.invalid" : "https://management.azure.com/",
            ["exp"] = (defect == "exp" ? TestNow.AddSeconds(-1) : TestNow.AddHours(1)).ToUnixTimeSeconds(),
            ["nbf"] = (defect == "nbf" ? TestNow.AddMinutes(1) : TestNow.AddMinutes(-1)).ToUnixTimeSeconds(),
        };
        var header = EncodeJwt(new { alg = defect == "alg" ? "none" : "RS256" });
        var token = defect == "jwt" ? "not-a-jwt" : $"{header}.{EncodeJwt(claims)}.fixture-signature";
        return JsonSerializer.Serialize(new
        {
            accessToken = token,
            expires_on = TestNow.AddHours(1).ToUnixTimeSeconds(),
            subscription = defect == "subscription" ? Principal : Subscription,
            tenant = defect == "tenant" ? Principal : Tenant,
        });
    }

    private static string EncodeJwt(object value) => Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value)))
        .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private sealed class LocalSnapshotCredential(SnapshotTestClock clock) : TokenCredential, ISubscriptionIdentityCredential
    {
        public bool Denied { get; set; }
        public int Requests { get; private set; }
        public SubscriptionIdentity SelectedIdentity { get; set; } = Identity;

        public ValueTask<SubscriptionIdentityToken> GetSubscriptionTokenAsync(string? expectedTenantId, CancellationToken cancellationToken)
        {
            Requests++;
            if (Denied) throw new AuthenticationFailedException("Synthetic identity denial.");
            return ValueTask.FromResult(new SubscriptionIdentityToken(new AccessToken("synthetic-local-token", clock.Now.AddHours(1)), SelectedIdentity));
        }

        public override AccessToken GetToken(TokenRequestContext requestContext, CancellationToken cancellationToken) => throw new InvalidOperationException("Use selected-subscription identity.");
        public override ValueTask<AccessToken> GetTokenAsync(TokenRequestContext requestContext, CancellationToken cancellationToken) => throw new InvalidOperationException("Use selected-subscription identity.");
    }

    private sealed class LocalSnapshotHandler : HttpMessageHandler
    {
        internal const string ReadPermission = "{\"value\":[{\"actions\":[\"*/read\"],\"notActions\":[]}]}";
        private readonly HttpMessageInvoker _collector;
        public bool AllowCollection { get; init; }
        public bool PartialCost { get; set; }
        public string PermissionPayload { get; init; } = ReadPermission;
        public HttpStatusCode PermissionStatus { get; init; } = HttpStatusCode.OK;
        public int PermissionRequests { get; private set; }
        public int CollectorRequests { get; private set; }

        public LocalSnapshotHandler()
        {
            var collector = new ScriptedAzureHandler();
            collector.ReleaseCostResponse.TrySetResult();
            _collector = new HttpMessageInvoker(collector);
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.Method == HttpMethod.Get && request.RequestUri?.AbsolutePath == $"/subscriptions/{Subscription:D}/providers/Microsoft.Authorization/permissions")
            {
                PermissionRequests++;
                return Task.FromResult(new HttpResponseMessage(PermissionStatus)
                {
                    RequestMessage = request,
                    Content = new StringContent(PermissionPayload, Encoding.UTF8, "application/json"),
                });
            }
            CollectorRequests++;
            if (!AllowCollection) throw new InvalidOperationException("Restore must not collect Azure evidence.");
            if (request.RequestUri?.AbsolutePath.Contains("Microsoft.Advisor/recommendations", StringComparison.Ordinal) == true)
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    RequestMessage = request,
                    Content = new StringContent("{\"value\":[{\"id\":\"fixture-advisor\",\"properties\":{\"shortDescription\":{\"solution\":\"Review fixture compute costs\"},\"extendedProperties\":{\"annualSavingsAmount\":\"1.2\",\"savingsCurrency\":\"USD\"}}}]}", Encoding.UTF8, "application/json"),
                });
            }
            if (PartialCost && request.RequestUri?.AbsolutePath.Contains("Microsoft.CostManagement/query", StringComparison.Ordinal) == true)
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    RequestMessage = request,
                    Content = new StringContent("{\"properties\":{\"columns\":[{\"name\":\"Cost\"},{\"name\":\"ServiceName\"},{\"name\":\"UsageDate\"},{\"name\":\"Currency\"}],\"rows\":[[3.3,\"Compute\",20260901,\"USD\"],[1,\"Excluded\",20260901,null]]}}", Encoding.UTF8, "application/json"),
                });
            }
            return _collector.SendAsync(request, cancellationToken);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) _collector.Dispose();
            base.Dispose(disposing);
        }
    }

    private sealed class SnapshotTestClock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;
        public override DateTimeOffset GetUtcNow() => Now;
    }
}