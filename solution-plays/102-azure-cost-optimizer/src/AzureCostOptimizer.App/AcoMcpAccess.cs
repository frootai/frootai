// The MCP endpoint serves real cost evidence, so it is off unless explicitly enabled and it never accepts a foreign scope.
internal static class AcoMcpAccess
{
    internal const string AuthorizedScope = "solution-scope";

    internal static bool IsEnabled(IConfiguration configuration) =>
        string.Equals(configuration["ACI_MCP_ENABLED"], "true", StringComparison.OrdinalIgnoreCase);

    // MCP clients are not browsers, so the anonymous mode's origin checks do not constrain them.
    // Publishing cost tools without sign-in therefore requires a separate, deliberate acknowledgement.
    internal static void EnsureAuthorizationIsSafe(IConfiguration configuration)
    {
        if (!IsEnabled(configuration)) return;
        var hosted = string.Equals(configuration["ACI_HOSTING_PROFILE"], "hosted_demo", StringComparison.Ordinal);
        var anonymous = !string.Equals(configuration["ACI_AUTH_MODE"], HostedDemoAccess.EasyAuthMode, StringComparison.Ordinal);
        var acknowledged = string.Equals(configuration["ACI_MCP_ALLOW_ANONYMOUS"], "true", StringComparison.OrdinalIgnoreCase);
        if (hosted && anonymous && !acknowledged)
        {
            throw new InvalidOperationException(
                "ACI_MCP_ENABLED publishes read-only cost tools over the network. Hosted deployments must use ACI_AUTH_MODE=container-apps-easy-auth, " +
                "or set ACI_MCP_ALLOW_ANONYMOUS=true to accept that anyone with the URL can read this subscription's cost evidence.");
        }
    }

    internal static void AuthorizeScope(string scopeAlias)
    {
        if (!string.Equals(scopeAlias, AuthorizedScope, StringComparison.Ordinal))
        {
            throw new UnauthorizedAccessException("The requested scope is not authorized for this endpoint.");
        }
    }
}
