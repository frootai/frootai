using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Azure.Core;
using Azure.Identity;

public sealed class SubscriptionAzureCliCredential(string subscriptionId) : TokenCredential, ISubscriptionIdentityCredential
{
    public override AccessToken GetToken(TokenRequestContext requestContext, CancellationToken cancellationToken) =>
        GetTokenAsync(requestContext, cancellationToken).AsTask().GetAwaiter().GetResult();

    public override async ValueTask<AccessToken> GetTokenAsync(TokenRequestContext requestContext, CancellationToken cancellationToken)
    {
        var resource = GetResource(requestContext);
        var output = await RequestTokenResponseAsync(resource, cancellationToken);
        return ParseTokenResponse(output, subscriptionId, null, resource, DateTimeOffset.UtcNow).AccessToken;
    }

    async ValueTask<SubscriptionIdentityToken> ISubscriptionIdentityCredential.GetSubscriptionTokenAsync(string? expectedTenantId, CancellationToken cancellationToken)
    {
        const string resource = "https://management.azure.com/";
        var output = await RequestTokenResponseAsync(resource, cancellationToken);
        return ParseTokenResponse(output, subscriptionId, expectedTenantId, resource, DateTimeOffset.UtcNow);
    }

    private static string GetResource(TokenRequestContext requestContext)
    {
        var scope = requestContext.Scopes.FirstOrDefault()
            ?? throw new AuthenticationFailedException("Azure token scope is required.");
        var resource = scope.EndsWith("/.default", StringComparison.Ordinal) ? scope[..^"/.default".Length] : scope;
        if (!Uri.TryCreate(resource, UriKind.Absolute, out var resourceUri) || resourceUri.Scheme != Uri.UriSchemeHttps ||
            !Regex.IsMatch(resourceUri.AbsoluteUri, @"\A[a-zA-Z0-9:/._-]+\z", RegexOptions.CultureInvariant))
        {
            throw new AuthenticationFailedException("Azure token resource must be a supported HTTPS URI.");
        }
        return resourceUri.AbsoluteUri;
    }

    private async Task<string> RequestTokenResponseAsync(string resource, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(subscriptionId, out var selectedSubscription) || selectedSubscription == Guid.Empty)
        {
            throw new AuthenticationFailedException("Azure subscription ID must be a nonempty GUID.");
        }
        var arguments = new[] { "account", "get-access-token", "--subscription", selectedSubscription.ToString("D"), "--resource", resource, "--output", "json", "--only-show-errors" };
        var startInfo = new ProcessStartInfo
        {
            FileName = OperatingSystem.IsWindows() ? "cmd.exe" : "az",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        if (OperatingSystem.IsWindows())
        {
            startInfo.ArgumentList.Add("/d");
            startInfo.ArgumentList.Add("/s");
            startInfo.ArgumentList.Add("/c");
            startInfo.ArgumentList.Add($"az.cmd {string.Join(' ', arguments)}");
        }
        else
        {
            foreach (var argument in arguments) startInfo.ArgumentList.Add(argument);
        }

        using var process = Process.Start(startInfo)
            ?? throw new AuthenticationFailedException("Azure CLI could not be started.");
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(10));
        try
        {
            var outputTask = ReadCliOutputAsync(process.StandardOutput, deadline.Token);
            var errorTask = ReadCliOutputAsync(process.StandardError, deadline.Token);
            await Task.WhenAll(outputTask, errorTask, process.WaitForExitAsync(deadline.Token));
            if (process.ExitCode != 0)
            {
                throw new AuthenticationFailedException($"Azure CLI token request failed with exit code {process.ExitCode}.");
            }
            return await outputTask;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new AuthenticationFailedException("Azure CLI token request exceeded the local authorization deadline.");
        }
        finally
        {
            if (!process.HasExited)
            {
                try { process.Kill(entireProcessTree: true); }
                catch (InvalidOperationException) { }
                catch (System.ComponentModel.Win32Exception) { }
            }
        }
    }

    private static async Task<string> ReadCliOutputAsync(StreamReader reader, CancellationToken cancellationToken)
    {
        var buffer = new char[4096];
        var output = new StringBuilder();
        int count;
        while ((count = await reader.ReadAsync(buffer.AsMemory(), cancellationToken)) != 0)
        {
            if (output.Length + count > 65536) throw new AuthenticationFailedException("Azure CLI token response exceeded the local size limit.");
            output.Append(buffer, 0, count);
        }
        return output.ToString();
    }

    internal static SubscriptionIdentityToken ParseTokenResponse(string response, string selectedSubscriptionId, string? expectedTenantId, string resource, DateTimeOffset now)
    {
        try
        {
            if (response.Length > 65536) throw new AuthenticationFailedException("Azure CLI token response exceeded the local size limit.");
            using var document = JsonDocument.Parse(response);
            var root = document.RootElement;
            var selectedSubscription = ReadGuid(selectedSubscriptionId);
            var subscription = ReadGuid(root.GetProperty("subscription").GetString());
            var tenant = ReadGuid(root.GetProperty("tenant").GetString());
            if (subscription != selectedSubscription ||
                (!string.IsNullOrWhiteSpace(expectedTenantId) && tenant != ReadGuid(expectedTenantId)))
            {
                throw new AuthenticationFailedException("Azure CLI identity does not match the configured subscription and tenant.");
            }
            var token = root.GetProperty("accessToken").GetString() ?? "";
            var parts = token.Split('.');
            if (parts.Length != 3 || parts.Any(string.IsNullOrWhiteSpace) || token.Length > 32768)
            {
                throw new AuthenticationFailedException("Azure CLI returned an unsupported identity token.");
            }
            using var header = JsonDocument.Parse(DecodeJwtPart(parts[0]));
            if (header.RootElement.GetProperty("alg").GetString() is not ("RS256" or "RS384" or "RS512" or "PS256" or "ES256"))
            {
                throw new AuthenticationFailedException("Azure CLI returned an unsupported identity token.");
            }
            using var claims = JsonDocument.Parse(DecodeJwtPart(parts[1]));
            var payload = claims.RootElement;
            var tokenTenant = ReadGuid(payload.GetProperty("tid").GetString());
            var principal = ReadGuid(payload.GetProperty("oid").GetString());
            var audience = payload.GetProperty("aud").GetString()?.TrimEnd('/');
            var expectedAudience = resource.TrimEnd('/');
            var armAudience = expectedAudience == "https://management.azure.com" && audience == "https://management.core.windows.net";
            if (tokenTenant != tenant || (!armAudience && !string.Equals(audience, expectedAudience, StringComparison.OrdinalIgnoreCase)))
            {
                throw new AuthenticationFailedException("Azure CLI token claims do not match the selected identity and resource.");
            }
            var expiresOn = root.TryGetProperty("expires_on", out var unixExpiry)
                ? DateTimeOffset.FromUnixTimeSeconds(unixExpiry.GetInt64())
                : DateTimeOffset.Parse(root.GetProperty("expiresOn").GetString()!, CultureInfo.InvariantCulture);
            var claimExpiry = DateTimeOffset.FromUnixTimeSeconds(payload.GetProperty("exp").GetInt64());
            if (claimExpiry < expiresOn) expiresOn = claimExpiry;
            if (expiresOn <= now || (payload.TryGetProperty("nbf", out var notBefore) && DateTimeOffset.FromUnixTimeSeconds(notBefore.GetInt64()) > now))
            {
                throw new AuthenticationFailedException("Azure CLI identity token is not currently valid.");
            }
            return new SubscriptionIdentityToken(new AccessToken(token, expiresOn), new SubscriptionIdentity(tenant, subscription, principal));
        }
        catch (Exception error) when (error is JsonException or FormatException or KeyNotFoundException or InvalidOperationException or ArgumentException or OverflowException)
        {
            throw new AuthenticationFailedException("Azure CLI returned an unreadable identity response.");
        }
    }

    private static byte[] DecodeJwtPart(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(padded.PadRight((padded.Length + 3) / 4 * 4, '='));
    }

    private static Guid ReadGuid(string? value) => Guid.TryParse(value, out var identity) && identity != Guid.Empty
        ? identity
        : throw new AuthenticationFailedException("Azure CLI returned an incomplete identity.");
}

internal interface ISubscriptionIdentityCredential
{
    ValueTask<SubscriptionIdentityToken> GetSubscriptionTokenAsync(string? expectedTenantId, CancellationToken cancellationToken);
}

internal sealed record SubscriptionIdentity(Guid TenantId, Guid SubscriptionId, Guid PrincipalId);

internal sealed class SubscriptionIdentityToken(AccessToken accessToken, SubscriptionIdentity identity)
{
    public AccessToken AccessToken { get; } = accessToken;
    public SubscriptionIdentity Identity { get; } = identity;
}