using System.Globalization;
using System.Runtime.Versioning;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

internal sealed class DurableSnapshotStore(string directory, SecurityIdentifier user, string? expectedCurrency, string costSource)
{
    internal const string SourceContractVersion = "aco-normalized-v3;cost-2025-03-01;advisor-2025-01-01;resource-graph-2022-10-01";
    internal const int MaximumSnapshotBytes = 8 * 1024 * 1024;
    internal const int MaximumCiphertextBytes = 10 * 1024 * 1024;
    internal static readonly TimeSpan MaximumAge = TimeSpan.FromHours(24);
    private const string FilePrefix = "aco-snapshot-v1-";
    private const int MaximumEntries = 16;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerOptions.Web)
    {
        MaxDepth = 32,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        RespectNullableAnnotations = true,
        RespectRequiredConstructorParameters = true,
        Converters = { new SnapshotMoneyConverter() },
    };

    internal static DurableSnapshotStore? TryCreate(IConfiguration configuration, out string status)
    {
        status = "disabled-profile";
        if (!string.Equals(configuration["ACI_DATA_PROFILE"], "live", StringComparison.OrdinalIgnoreCase) ||
            configuration["ACI_HOSTING_PROFILE"] is { Length: > 0 } hosting && !string.Equals(hosting, "local", StringComparison.OrdinalIgnoreCase)) return null;
        status = "unavailable-platform";
        if (!OperatingSystem.IsWindows()) return null;
        try
        {
            using var windowsIdentity = WindowsIdentity.GetCurrent();
            var user = windowsIdentity.User ?? throw new UnauthorizedAccessException();
            var path = configuration["ACI_SNAPSHOT_CACHE_DIRECTORY"] ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AzureCostOptimizer", "snapshots");
            var directory = ValidatePath(path);
            if (Directory.Exists(directory)) ValidateDirectoryAccess(directory, user);
            var currency = configuration["ACI_CURRENCY"];
            if (currency is not null && !IsCurrency(currency)) throw new InvalidDataException();
            var source = configuration["ACI_COST_SOURCE"] ?? "query";
            if (source is not ("query" or "cost-details" or "exports")) throw new InvalidDataException();
            status = "available";
            return new DurableSnapshotStore(directory, user, currency, source);
        }
        catch (Exception error) when (IsStorageFailure(error))
        {
            status = "unavailable-directory";
            return null;
        }
    }

    internal bool HasEntries() => Directory.Exists(directory) && OwnedFiles(".bin").Any();

    internal async Task<bool> SaveAsync(EvidenceSnapshot snapshot, SubscriptionIdentity identity, DateTimeOffset authorizedAt, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (!OperatingSystem.IsWindows()) return false;
        cancellationToken.ThrowIfCancellationRequested();
        var envelope = new DurableSnapshotEnvelope(1, SourceContractVersion, "live", user.Value, identity, costSource,
            snapshot.Summary.RequestedPeriod.Start, snapshot.Summary.RequestedPeriod.End.AddDays(1), snapshot.Summary.FinancialBasis,
            snapshot.Summary.TotalCost.Currency, snapshot.Summary.ReportId, authorizedAt, authorizedAt.Add(MaximumAge), now, snapshot);
        if (!IsValid(envelope, identity, now)) return false;
        var plaintext = JsonSerializer.SerializeToUtf8Bytes(envelope, JsonOptions);
        byte[] ciphertext;
        try
        {
            if (plaintext.Length > MaximumSnapshotBytes) return false;
            ciphertext = ProtectedData.Protect(plaintext, PartitionEntropy(identity), DataProtectionScope.CurrentUser);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
        }
        if (ciphertext.Length > MaximumCiphertextBytes) return false;

        EnsureDirectory();
        using var cacheLock = OpenLock();
        var destination = Path.Combine(directory, FileName(envelope));
        var temporary = Path.Combine(directory, $"{FilePrefix}{Guid.NewGuid():N}.tmp");
        var existed = File.Exists(destination);
        try
        {
            await using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 65536, FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await stream.WriteAsync(ciphertext, cancellationToken);
                await stream.FlushAsync(cancellationToken);
                stream.Flush(flushToDisk: true);
            }
            cancellationToken.ThrowIfCancellationRequested();
            ValidateDirectoryAccess(directory, user);
            File.Move(temporary, destination, overwrite: true);
            var entries = OwnedFiles(".bin").Select(path => new FileInfo(path))
                .OrderByDescending(file => string.Equals(file.FullName, destination, StringComparison.OrdinalIgnoreCase))
                .ThenByDescending(file => file.LastWriteTimeUtc).ToArray();
            foreach (var entry in entries.Skip(MaximumEntries))
            {
                if (entry.FullName == destination) continue;
                TryDelete(entry.FullName);
            }
            if (OwnedFiles(".bin").Count() > MaximumEntries)
            {
                if (!existed) TryDelete(destination);
                return false;
            }
            foreach (var orphan in OwnedFiles(".tmp").Where(path => File.GetLastWriteTimeUtc(path) < now.UtcDateTime.AddHours(-1))) TryDelete(orphan);
            return true;
        }
        finally
        {
            TryDelete(temporary);
        }
    }

    internal async Task<IReadOnlyList<DurableSnapshotEnvelope>> LoadAsync(SubscriptionIdentity identity, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (!OperatingSystem.IsWindows() || !Directory.Exists(directory)) return [];
        ValidateDirectoryAccess(directory, user);
        using var cacheLock = OpenLock();
        var prefix = $"{FilePrefix}{Convert.ToHexStringLower(PartitionEntropy(identity))}-";
        var candidates = new List<DurableSnapshotEnvelope>();
        foreach (var path in OwnedFiles(".bin").Where(path => Path.GetFileName(path).StartsWith(prefix, StringComparison.Ordinal)))
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                ValidateFileAccess(path, user);
                await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.None, 65536, FileOptions.Asynchronous | FileOptions.SequentialScan);
                if (stream.Length is <= 0 or > MaximumCiphertextBytes) continue;
                var ciphertext = new byte[(int)stream.Length];
                await stream.ReadExactlyAsync(ciphertext, cancellationToken);
                var plaintext = ProtectedData.Unprotect(ciphertext, PartitionEntropy(identity), DataProtectionScope.CurrentUser);
                try
                {
                    if (plaintext.Length > MaximumSnapshotBytes) continue;
                    var envelope = JsonSerializer.Deserialize<DurableSnapshotEnvelope>(plaintext, JsonOptions);
                    if (envelope is not null && IsValid(envelope, identity, now) && Path.GetFileName(path) == FileName(envelope)) candidates.Add(envelope);
                }
                finally
                {
                    CryptographicOperations.ZeroMemory(plaintext);
                }
            }
            catch (Exception error) when (IsStorageFailure(error)) { }
        }
        return candidates.GroupBy(item => item.Snapshot.Summary.PeriodKey, StringComparer.Ordinal)
            .Where(group => group.Select(item => item.Currency).Distinct(StringComparer.Ordinal).Count() == 1)
            .Select(group => group.OrderByDescending(item => item.Snapshot.Summary.CollectedAt).ThenByDescending(item => item.SavedAt).First())
            .ToArray();
    }

    [SupportedOSPlatform("windows")]
    internal byte[] PartitionEntropy(SubscriptionIdentity identity) => SHA256.HashData(Encoding.UTF8.GetBytes(
        $"AzureCostOptimizer|snapshot-v1|{user.Value}|{identity.TenantId:D}|{identity.SubscriptionId:D}|{identity.PrincipalId:D}"));

    [SupportedOSPlatform("windows")]
    private string FileName(DurableSnapshotEnvelope envelope)
    {
        var key = JsonSerializer.Serialize(new
        {
            envelope.OsUserId, envelope.Identity, envelope.SourceContractVersion, envelope.CostSource,
            envelope.Snapshot.Summary.ScopeAlias, envelope.Snapshot.Summary.PeriodKey, envelope.PeriodStart, envelope.PeriodEndExclusive,
            envelope.FinancialBasis, envelope.Currency, envelope.ReportId,
        }, JsonOptions);
        return $"{FilePrefix}{Convert.ToHexStringLower(PartitionEntropy(envelope.Identity))}-{AzureEvidenceService.Sha256(key)}.bin";
    }

    [SupportedOSPlatform("windows")]
    private bool IsValid(DurableSnapshotEnvelope envelope, SubscriptionIdentity identity, DateTimeOffset now) =>
        envelope.OsUserId == user.Value && IsValidEnvelope(envelope, identity, costSource, expectedCurrency, now);

    internal static JsonSerializerOptions SnapshotJsonOptions => JsonOptions;

    internal static bool IsValidEnvelope(DurableSnapshotEnvelope envelope, SubscriptionIdentity identity, string costSource, string? expectedCurrency, DateTimeOffset now)
    {
        try
        {
            if (identity.TenantId == Guid.Empty || identity.SubscriptionId == Guid.Empty || identity.PrincipalId == Guid.Empty ||
                envelope.Identity != identity || envelope.FormatVersion != 1 || envelope.Profile != "live" ||
                envelope.SourceContractVersion != SourceContractVersion || envelope.CostSource != costSource || envelope.FinancialBasis != "billed" ||
                !IsCurrency(envelope.Currency) || (expectedCurrency is not null && expectedCurrency != envelope.Currency) ||
                envelope.SavedAt > now || envelope.AuthorizedAt > envelope.SavedAt || envelope.AuthorizationExpiresAt <= now ||
                envelope.AuthorizationExpiresAt <= envelope.AuthorizedAt || envelope.AuthorizationExpiresAt - envelope.AuthorizedAt > MaximumAge) return false;
            var snapshot = envelope.Snapshot;
            var summary = snapshot.Summary;
            var health = snapshot.DataHealth;
            var selection = PeriodSelection.Parse(summary.PeriodKey);
            var (start, endExclusive) = selection.Resolve(now);
            var requested = ReceiptPeriodDto.From(start, endExclusive.AddDays(-1));
            if (summary.ScopeAlias != "solution-scope" || summary.PeriodLabel != selection.Label || summary.FinancialBasis != envelope.FinancialBasis ||
                summary.RequestedPeriod.Start != start || summary.RequestedPeriod.End != endExclusive.AddDays(-1) ||
                envelope.PeriodStart != start || envelope.PeriodEndExclusive != endExclusive || summary.TotalCost.Currency != envelope.Currency ||
                summary.ReportId != envelope.ReportId || summary.CollectedAt > now || now - summary.CollectedAt >= MaximumAge ||
                envelope.AuthorizedAt < summary.CollectedAt || envelope.SavedAt < summary.CollectedAt || summary.Status != "fresh" || health.Status != "fresh" ||
                health.ExcludedRows != 0 || health.ResourceCount < 0 || health.FailedSource is not null || health.RetryAt is not null || health.Cache is not null ||
                summary.Services.Count == 0 || summary.Daily.Count == 0 || summary.Services.Any(item => string.IsNullOrWhiteSpace(item.Name)) ||
                summary.Services.Select(item => item.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count() != summary.Services.Count ||
                summary.Services.Sum(item => item.Amount) != summary.TotalCost.Amount || summary.Daily.Sum(item => item.Amount) != summary.TotalCost.Amount ||
                summary.Daily.Select(item => item.Date).Distinct(StringComparer.Ordinal).Count() != summary.Daily.Count) return false;
            foreach (var daily in summary.Daily)
            {
                if (!DateOnly.TryParseExact(daily.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ||
                    date < DateOnly.FromDateTime(start.UtcDateTime) || date > DateOnly.FromDateTime(summary.CollectedAt.UtcDateTime) ||
                    date >= DateOnly.FromDateTime(endExclusive.UtcDateTime)) return false;
            }
            var sources = health.Sources;
            var costSourceName = costSource switch
            {
                "query" => "cost-management-query",
                "exports" => "cost-exports",
                _ => "cost-details",
            };
            var costApiVersion = costSource == "exports" ? "2023-11-01" : "2025-03-01";
            if (sources.Count != 3 || sources[0].Source != costSourceName || sources[1].Source != "advisor" || sources[2].Source != "resource-graph" ||
                sources[0].ApiVersion != costApiVersion || sources[1].ApiVersion != "2025-01-01" || sources[2].ApiVersion != "2022-10-01" ||
                sources[0].Currency != envelope.Currency || sources[0].FinancialBasis != "billed" ||
                !health.SourceReceiptHashes.SequenceEqual(sources.Select(source => source.ContentSha256), StringComparer.Ordinal)) return false;
            var tenantAlias = $"tenant-{AzureEvidenceService.Sha256(identity.TenantId.ToString("D"))[..12]}";
            foreach (var source in sources)
            {
                if (source.SchemaVersion != "1.0.0" || source.TenantAlias != tenantAlias || source.ScopeAlias != summary.ScopeAlias ||
                    source.RequestedPeriod != requested || source.ActualPeriod != requested || source.CollectedAt != summary.CollectedAt ||
                    source.Status != "complete" || !source.Complete || source.SafeIssueCode is not null || source.RetryAt is not null ||
                    source.Counts.Requests < 1 || source.Counts.Pages is < 1 or > 10 || source.Counts.Rows < 0 || source.Counts.Bytes <= 0 ||
                    source.Counts.QueryProcessingUnits < 0 || !IsHash(source.ContentSha256) || source.EvidenceIds.Count == 0 ||
                    source.EvidenceIds[0] != $"ev_{source.ContentSha256[..20]}" || source.EvidenceIds.Any(item => !IsEvidenceId(item))) return false;
            }
            if (sources.Skip(1).Any(source => source.Currency is not null || source.FinancialBasis != "not-applicable")) return false;
            var evidenceIds = sources.SelectMany(source => source.EvidenceIds).ToHashSet(StringComparer.Ordinal);
            if (snapshot.Advisor.Any(item => !evidenceIds.Contains(item.EvidenceId) || string.IsNullOrWhiteSpace(item.FindingId) ||
                    string.IsNullOrWhiteSpace(item.Title) || (item.EstimatedAnnualSavings is not null && !IsCurrency(item.SavingsCurrency))) ||
                snapshot.Opportunities.Any(item => item.ScopeAlias != summary.ScopeAlias || item.FinancialBasis != "billed" || item.Currency != envelope.Currency ||
                    !item.Complete || item.Confidence is < 0 or > 1 || item.EvidenceIds.Count == 0 || item.EvidenceIds.Any(evidence => !evidenceIds.Contains(evidence)) ||
                    !IsValidMoney(item.ObservedCost) || !IsValidMoney(item.EstimatedOpportunity) || !IsValidMoney(item.ApprovedTarget) || !IsValidMoney(item.RealizedSavings))) return false;
            var savings = snapshot.Advisor.Where(item => item.EstimatedAnnualSavings is not null && item.SavingsCurrency == envelope.Currency)
                .Select(item => item.EstimatedAnnualSavings!.Value).ToArray();
            if (summary.TotalEstimatedAnnualSavings != (savings.Length == 0 ? (decimal?)null : savings.Sum())) return false;
            return summary.ReportId == AzureEvidenceService.CreateReportId(identity.SubscriptionId.ToString("D"), selection, start, endExclusive, sources);
        }
        catch (Exception error) when (error is ArgumentException or InvalidOperationException or NullReferenceException or OverflowException) { return false; }
    }

    private static bool IsCurrency(string? value) => value is { Length: 3 } && value.All(character => character is >= 'A' and <= 'Z');
    private static bool IsValidMoney(MoneyOrUnknownDto? value) => value is not null && (value.Amount is null
        ? value.Currency is null && !string.IsNullOrWhiteSpace(value.UnknownReason)
        : value.UnknownReason is null && IsCurrency(value.Currency) &&
            decimal.TryParse(value.Amount, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var amount) &&
            value.Amount == amount.ToString("0.#############################", CultureInfo.InvariantCulture));
    private static bool IsHash(string? value) => value is { Length: 64 } && value.All(character => char.IsAsciiHexDigitLower(character));
    private static bool IsEvidenceId(string? value) => value is { Length: 23 } && value.StartsWith("ev_", StringComparison.Ordinal) && value[3..].All(char.IsAsciiHexDigitLower);

    private IEnumerable<string> OwnedFiles(string extension)
    {
        var expression = extension == ".bin" ? @"\Aaco-snapshot-v1-[0-9a-f]{64}-[0-9a-f]{64}\.bin\z" : @"\Aaco-snapshot-v1-[0-9a-f]{32}\.tmp\z";
        var files = Directory.EnumerateFiles(directory, $"{FilePrefix}*{extension}", SearchOption.TopDirectoryOnly)
            .Where(path => Regex.IsMatch(Path.GetFileName(path), expression, RegexOptions.CultureInvariant)).Take(257).ToArray();
        if (files.Length > 256) throw new InvalidDataException("The local snapshot directory exceeded its entry limit.");
        return files;
    }

    [SupportedOSPlatform("windows")]
    private static string ValidatePath(string path)
    {
        if (!Path.IsPathFullyQualified(path) || path.StartsWith(@"\\", StringComparison.Ordinal) || path.IndexOf(':', 2) >= 0) throw new InvalidDataException();
        var fullPath = Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
        if (fullPath == Path.GetPathRoot(fullPath) || new DriveInfo(Path.GetPathRoot(fullPath)!).DriveType != DriveType.Fixed) throw new InvalidDataException();
        var applicationRoot = Path.TrimEndingDirectorySeparator(Path.GetFullPath(AppContext.BaseDirectory));
        if (fullPath.Equals(applicationRoot, StringComparison.OrdinalIgnoreCase) || fullPath.StartsWith(applicationRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException();
        for (var current = new DirectoryInfo(fullPath); current is not null; current = current.Parent)
        {
            if (current.Name.Equals("wwwroot", StringComparison.OrdinalIgnoreCase) || current.Name.Equals("packages", StringComparison.OrdinalIgnoreCase) ||
                current.Name.Equals("node_modules", StringComparison.OrdinalIgnoreCase) || current.Name.Equals(".nuget", StringComparison.OrdinalIgnoreCase) ||
                current.Name.Equals(".git", StringComparison.OrdinalIgnoreCase) || Directory.Exists(Path.Combine(current.FullName, ".git")) ||
                File.Exists(Path.Combine(current.FullName, ".git")) || Directory.Exists(Path.Combine(current.FullName, ".github")) ||
                File.Exists(Path.Combine(current.FullName, "src", "AzureCostOptimizer.App", "AzureCostOptimizer.App.csproj"))) throw new InvalidDataException();
            if (current.Exists && (current.Attributes & FileAttributes.ReparsePoint) != 0) throw new InvalidDataException();
        }
        return fullPath;
    }

    [SupportedOSPlatform("windows")]
    private void EnsureDirectory()
    {
        ValidatePath(directory);
        if (!Directory.Exists(directory))
        {
            var security = new DirectorySecurity();
            security.SetOwner(user);
            security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);
            security.AddAccessRule(new FileSystemAccessRule(user, FileSystemRights.FullControl,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
            new DirectoryInfo(directory).Create(security);
        }
        ValidateDirectoryAccess(directory, user);
    }

    [SupportedOSPlatform("windows")]
    private FileStream OpenLock()
    {
        var path = Path.Combine(directory, ".aco-snapshot-v1.lock");
        if (File.Exists(path)) ValidateFileAccess(path, user);
        return new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
    }

    [SupportedOSPlatform("windows")]
    private static void ValidateDirectoryAccess(string path, SecurityIdentifier user)
    {
        ValidatePath(path);
        var security = new DirectoryInfo(path).GetAccessControl(AccessControlSections.Owner | AccessControlSections.Access);
        if (!security.AreAccessRulesProtected) throw new UnauthorizedAccessException();
        ValidateAccess(security, user);
    }

    [SupportedOSPlatform("windows")]
    private static void ValidateFileAccess(string path, SecurityIdentifier user)
    {
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0) throw new UnauthorizedAccessException();
        ValidateAccess(new FileInfo(path).GetAccessControl(AccessControlSections.Owner | AccessControlSections.Access), user);
    }

    [SupportedOSPlatform("windows")]
    private static void ValidateAccess(FileSystemSecurity security, SecurityIdentifier user)
    {
        if (!user.Equals(security.GetOwner(typeof(SecurityIdentifier)))) throw new UnauthorizedAccessException();
        var rules = security.GetAccessRules(includeExplicit: true, includeInherited: true, typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>().ToArray();
        if (rules.Length == 0 || rules.Any(rule => !user.Equals(rule.IdentityReference) || rule.AccessControlType != AccessControlType.Allow) ||
            !rules.Any(rule => (rule.FileSystemRights & FileSystemRights.FullControl) == FileSystemRights.FullControl)) throw new UnauthorizedAccessException();
    }

    [SupportedOSPlatform("windows")]
    private void TryDelete(string path)
    {
        try
        {
            if (!File.Exists(path)) return;
            ValidateFileAccess(path, user);
            File.Delete(path);
        }
        catch (Exception error) when (IsStorageFailure(error)) { }
    }

    private sealed class SnapshotMoneyConverter : JsonConverter<MoneyOrUnknownDto>
    {
        public override MoneyOrUnknownDto Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            using var document = JsonDocument.ParseValue(ref reader);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) throw new JsonException("Snapshot monetary evidence is invalid.");
            var value = new MoneyOrUnknownDto(ReadString(root, "amount"), ReadString(root, "currency"), ReadString(root, "unknownReason"));
            if (!IsValidMoney(value) || root.EnumerateObject().Count() != (value.Amount is null ? 1 : 2))
                throw new JsonException("Snapshot monetary evidence is incomplete.");
            return value;
        }

        public override void Write(Utf8JsonWriter writer, MoneyOrUnknownDto value, JsonSerializerOptions options)
        {
            if (!IsValidMoney(value)) throw new JsonException("Snapshot monetary evidence is incomplete.");
            writer.WriteStartObject();
            if (value.Amount is not null)
            {
                writer.WriteString("amount", value.Amount);
                writer.WriteString("currency", value.Currency);
            }
            else writer.WriteString("unknownReason", value.UnknownReason);
            writer.WriteEndObject();
        }

        private static string? ReadString(JsonElement root, string property)
        {
            if (!root.TryGetProperty(property, out var value)) return null;
            return value.ValueKind == JsonValueKind.String ? value.GetString() : throw new JsonException("Snapshot monetary evidence is invalid.");
        }
    }

    internal static bool IsStorageFailure(Exception error) => error is IOException or InvalidDataException or UnauthorizedAccessException or CryptographicException or
        JsonException or ArgumentException or NotSupportedException or System.Security.SecurityException;
}

internal sealed record DurableSnapshotEnvelope(int FormatVersion, string SourceContractVersion, string Profile, string OsUserId,
    SubscriptionIdentity Identity, string CostSource, DateTimeOffset PeriodStart, DateTimeOffset PeriodEndExclusive, string FinancialBasis,
    string Currency, string ReportId, DateTimeOffset AuthorizedAt, DateTimeOffset AuthorizationExpiresAt, DateTimeOffset SavedAt, EvidenceSnapshot Snapshot);