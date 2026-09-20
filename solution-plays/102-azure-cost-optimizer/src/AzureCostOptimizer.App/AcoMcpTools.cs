using System.ComponentModel;
using ModelContextProtocol.Server;

// The MCP surface is a second transport over the SAME deterministic engine the in-process agent uses.
// It must never collect data, compute totals, or hold its own copy of the evidence.
[McpServerToolType]
internal sealed class AcoMcpTools(AzureEvidenceService evidence)
{
    private const string GuidanceOnlyNote = "Published Microsoft guidance. It is not customer evidence and carries no amounts.";

    [McpServerTool(Name = "get_cost_summary", ReadOnly = true)]
    [Description("Get authoritative actual cost, period, basis, currency, freshness, and evidence IDs for the selected report.")]
    public object GetCostSummary(
        [Description("Authorized scope alias.")] string scopeAlias,
        [Description("Reporting period: mtd, 7d, 30d, or 3m.")] string? period = null)
        => AcoAgentService.GetCostSummary(Snapshot(scopeAlias, period));

    [McpServerTool(Name = "get_cost_breakdown", ReadOnly = true)]
    [Description("Get actual cost by service, resource group, or day from the validated report.")]
    public object GetCostBreakdown(
        [Description("Authorized scope alias.")] string scopeAlias,
        [Description("One of service, resourceGroup, or daily.")] string dimension,
        [Description("Reporting period: mtd, 7d, 30d, or 3m.")] string? period = null,
        [Description("Maximum rows, 1 to 90.")] int limit = 10)
        => AcoAgentService.GetCostBreakdown(Snapshot(scopeAlias, period), dimension, limit);

    [McpServerTool(Name = "get_advisor_findings", ReadOnly = true)]
    [Description("Get real Azure Advisor cost findings and their supported annual savings estimates.")]
    public object GetAdvisorFindings(
        [Description("Authorized scope alias.")] string scopeAlias,
        [Description("Reporting period: mtd, 7d, 30d, or 3m.")] string? period = null,
        [Description("Maximum findings, 1 to 20.")] int limit = 10)
        => AcoAgentService.GetAdvisorFindings(Snapshot(scopeAlias, period), limit);

    [McpServerTool(Name = "get_opportunities", ReadOnly = true)]
    [Description("Get normalized evidence-backed review opportunities. Estimates are never approved or realized savings.")]
    public object GetOpportunities(
        [Description("Authorized scope alias.")] string scopeAlias,
        [Description("Optional category filter.")] string? category = null,
        [Description("Reporting period: mtd, 7d, 30d, or 3m.")] string? period = null,
        [Description("Maximum opportunities, 1 to 20.")] int limit = 10)
        => AcoAgentService.GetOpportunities(Snapshot(scopeAlias, period), category, limit);

    [McpServerTool(Name = "get_data_health", ReadOnly = true)]
    [Description("Get source freshness, completeness, inventory count, cost source status, and evidence IDs.")]
    public object GetDataHealth(
        [Description("Authorized scope alias.")] string scopeAlias,
        [Description("Reporting period: mtd, 7d, 30d, or 3m.")] string? period = null)
        => AcoAgentService.GetDataHealth(Snapshot(scopeAlias, period));

    [McpServerTool(Name = "get_evidence", ReadOnly = true)]
    [Description("Get one minimized evidence record that belongs to the selected report.")]
    public object GetEvidence(
        [Description("Authorized scope alias.")] string scopeAlias,
        [Description("Evidence identifier returned by another tool.")] string evidenceId,
        [Description("Reporting period: mtd, 7d, 30d, or 3m.")] string? period = null)
        => AcoAgentService.GetEvidence(Snapshot(scopeAlias, period), evidenceId);

    [McpServerTool(Name = "create_report", ReadOnly = true)]
    [Description("Create a private deterministic report link in json, csv, html, or focus format. This does not modify Azure.")]
    public object CreateReport(
        [Description("Authorized scope alias.")] string scopeAlias,
        [Description("Formats: json, csv, html, or focus.")] string[] formats,
        [Description("Reporting period: mtd, 7d, 30d, or 3m.")] string? period = null)
        => AcoAgentService.CreateReportLinks(Snapshot(scopeAlias, period), formats);

    [McpServerTool(Name = "get_optimization_guidance", ReadOnly = true)]
    [Description("Get Microsoft Well-Architected cost optimization checklist items and FinOps Framework practices. Guidance text only, never customer amounts.")]
    public object GetOptimizationGuidance(
        [Description("Optional topic such as rightsizing, commitment, storage, or scaling.")] string? topic = null,
        [Description("Optional Azure service name.")] string? service = null,
        [Description("Maximum items per framework, 1 to 12.")] int limit = 6)
        => OptimizationKnowledge.Find(topic, service, limit);

    [McpServerTool(Name = "describe_data_sources", ReadOnly = true)]
    [Description("Describe which Azure data sources back this scope, what each one proves, and its boundaries.")]
    public object DescribeDataSources([Description("Authorized scope alias.")] string scopeAlias)
    {
        AcoMcpAccess.AuthorizeScope(scopeAlias);
        return new
        {
            note = GuidanceOnlyNote,
            sources = new object[]
            {
                new { id = "cost-management-query", role = "Bounded actual-cost summaries by service, resource group and day.", boundary = "Not a durable detailed ledger. Per-tenant QPU quotas apply." },
                new { id = "cost-details", role = "Small on-demand detailed datasets.", boundary = "Generally no more than daily. Generation is never blindly retried." },
                new { id = "cost-exports", role = "Recurring large-scale ingestion from scheduled exports.", boundary = "Minimum schedule is daily, so it is not a near-real-time source." },
                new { id = "advisor", role = "Microsoft-generated cost recommendations.", boundary = "An estimate and a recommendation, never realized savings." },
                new { id = "resource-graph", role = "Resource inventory.", boundary = "Presence does not prove utilization or ownership." },
                new { id = "retail-prices", role = "Public list-price fallback.", boundary = "Not the customer's billed or negotiated rate." },
            },
        };
    }

    private EvidenceSnapshot Snapshot(string scopeAlias, string? period)
    {
        AcoMcpAccess.AuthorizeScope(scopeAlias);
        return evidence.GetCached(period) ?? throw new InvalidOperationException(
            "No validated evidence is cached for this period. An authorized human must refresh it; MCP never triggers collection.");
    }
}
