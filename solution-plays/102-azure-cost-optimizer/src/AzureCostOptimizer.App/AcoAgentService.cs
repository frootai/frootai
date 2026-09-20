using System.Collections.Concurrent;
using System.ClientModel;
using System.ClientModel.Primitives;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Threading.Channels;
using Azure.AI.OpenAI;
using Azure.AI.Projects;
using Azure.Core;
using Microsoft.Agents.AI;
using Microsoft.Agents.AI.Foundry;
using Microsoft.Extensions.AI;

public sealed partial class AcoAgentService(IConfiguration configuration, TokenCredential credential)
{
    private const int MaximumConversations = 100;
    // One tool runs per model call, so the model-call budget bounds how many evidence tools an answer can use:
    // five tools plus a final tool-free answer. Measured: raising this to eight did not add safety. The model
    // spent the extra calls on further tools and produced sections that failed the grounding checks, so six is
    // the value that answered every demo question without a validation failure.
    private const int MaximumModelCalls = 6;
    private const int MaximumToolCalls = 6;
    // Reasoning models spend this budget on hidden reasoning as well as the answer, so it must comfortably exceed the validated-character cap.
    private const int MaximumOutputTokens = 32_768;
    private const int MaximumValidatedCharacters = 16_384;
    internal const string ComposeStageName = "compose_response";
    // Fast trades breadth for latency: summary, one breakdown, then the answer. Anything unrecognised
    // falls back to the full sweep so a malformed value never quietly degrades an answer.
    private const int FastModelCalls = 3;
    internal static int ModelCallsFor(string? effort) => string.Equals(effort, "fast", StringComparison.OrdinalIgnoreCase) ? FastModelCalls : MaximumModelCalls;
    internal static int ToolCallsFor(string? effort) => string.Equals(effort, "fast", StringComparison.OrdinalIgnoreCase) ? FastModelCalls : MaximumToolCalls;
    private static readonly TimeSpan ConversationLifetime = TimeSpan.FromMinutes(30);
    private static readonly ChatResponseFormat GroundedResponseFormat = ChatResponseFormat.ForJsonSchema(CreateGroundedResponseSchema(), "aco_response");
    private static readonly (string Id, string Title)[] ResponseSections = [("answer", "Answer"), ("evidence", "Evidence"), ("dataHealth", "Data health"), ("risks", "Risks"), ("nextAction", "Next action")];
    private readonly string? _instructions = LoadInstructions();
    private readonly ConcurrentDictionary<string, ConversationState> _conversations = new(StringComparer.Ordinal);
    private readonly SemanticAnswerCache? _semanticCache = SemanticAnswerCache.TryCreate(configuration, credential);
    private readonly ContentSafetyGuard? _contentSafety = ContentSafetyGuard.TryCreate(configuration, credential);

    public AcoAgentService(IConfiguration configuration, TokenCredential credential, IWebHostEnvironment environment)
        : this(configuration, credential)
    {
        ArgumentNullException.ThrowIfNull(environment);
    }

    public async IAsyncEnumerable<AgentStreamEvent> StreamAsync(
        EvidenceSnapshot snapshot,
        string question,
        string? requestedConversationId,
        [EnumeratorCancellation] CancellationToken cancellationToken,
        string principalId = "local-os-operator",
        string? effort = null)
    {
        if (string.IsNullOrWhiteSpace(question) || question.Length > 2000)
        {
            yield return new AgentStreamEvent("error", new { message = "Question must contain between 1 and 2,000 characters." });
            yield break;
        }
        if (IsWriteRequest(question))
        {
            var refusalConversationId = NormalizeConversationId(requestedConversationId);
            yield return new AgentStreamEvent("meta", new AgentMeta(refusalConversationId, "AI-generated", snapshot.Summary.PeriodKey, snapshot.Summary.ReportId));
            yield return new AgentStreamEvent("delta", new AgentTextDelta(CreateDeterministicRefusal(snapshot, "I cannot perform or approve Azure changes.", "No mutation was attempted.")));
            yield return new AgentStreamEvent("done", new { conversationId = refusalConversationId });
            yield break;
        }
        if (PromptInjectionRegex().IsMatch(question) || SensitiveContentRegex().IsMatch(question) ||
            (_contentSafety is not null && await _contentSafety.FindViolationAsync(question, cancellationToken) is not null))
        {
            var refusalConversationId = NormalizeConversationId(requestedConversationId);
            yield return new AgentStreamEvent("meta", new AgentMeta(refusalConversationId, "AI-generated", snapshot.Summary.PeriodKey, snapshot.Summary.ReportId));
            yield return new AgentStreamEvent("delta", new AgentTextDelta(CreateDeterministicRefusal(snapshot, "I cannot follow instructions that request hidden configuration, credentials, or bypass the evidence contract.", "The request was stopped by the deterministic content-safety boundary.")));
            yield return new AgentStreamEvent("done", new { conversationId = refusalConversationId });
            yield break;
        }
        if (!IsEvidenceUsableForModel(snapshot, DateTimeOffset.UtcNow, out var evidenceIssue))
        {
            var refusalConversationId = NormalizeConversationId(requestedConversationId);
            yield return new AgentStreamEvent("meta", new AgentMeta(refusalConversationId, "AI-generated", snapshot.Summary.PeriodKey, snapshot.Summary.ReportId));
            yield return new AgentStreamEvent("delta", new AgentTextDelta(CreateDeterministicRefusal(snapshot, "I cannot use the model for this request because the selected evidence is stale or incomplete.", evidenceIssue)));
            yield return new AgentStreamEvent("done", new { conversationId = refusalConversationId });
            yield break;
        }

        var hosted = string.Equals(configuration["ACI_HOSTING_PROFILE"], "hosted_demo", StringComparison.Ordinal);
        var dataProfile = configuration["ACI_DATA_PROFILE"] ?? (hosted ? "live" : "solution_snapshot");
        if (!string.Equals(dataProfile, "live", StringComparison.Ordinal))
        {
            yield return new AgentStreamEvent("error", new { message = "AI is disabled in the solution snapshot profile. Deterministic cost views and reports remain available." });
            yield break;
        }

        var provider = (configuration["ACI_AI_PROVIDER"] ?? "foundry").Trim().ToLowerInvariant();
        if (provider == "none")
        {
            yield return new AgentStreamEvent("error", new { message = "AI is disabled in cost-only mode. Deterministic cost views and reports remain available." });
            yield break;
        }
        if (provider is not ("foundry" or "azure-openai"))
        {
            yield return new AgentStreamEvent("error", new { message = "ACI_AI_PROVIDER must be foundry, azure-openai, or none." });
            yield break;
        }
        if (string.IsNullOrWhiteSpace(_instructions))
        {
            yield return new AgentStreamEvent("error", new { message = "The bundled ACO system prompt is missing, empty, or unreadable. AI is unavailable; deterministic cost views and reports remain available." });
            yield break;
        }

        var endpoint = configuration[provider == "foundry" ? "AZURE_AI_PROJECT_ENDPOINT" : "AZURE_OPENAI_ENDPOINT"];
        var model = configuration[provider == "foundry" ? "AZURE_AI_MODEL_DEPLOYMENT_NAME" : "AZURE_OPENAI_DEPLOYMENT_NAME"];
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var endpointUri) || endpointUri.Scheme != Uri.UriSchemeHttps ||
            endpointUri.UserInfo.Length != 0 || endpointUri.Query.Length != 0 || endpointUri.Fragment.Length != 0 ||
            (provider == "foundry"
                ? !Regex.IsMatch(endpointUri.AbsolutePath, "^/api/projects/[A-Za-z0-9._-]+/?$")
                : endpointUri.AbsolutePath != "/") ||
            string.IsNullOrWhiteSpace(model) || !Regex.IsMatch(model, "^[A-Za-z0-9._-]{1,64}$"))
        {
            yield return new AgentStreamEvent("error", new { message = "The selected AI provider requires a valid HTTPS endpoint and model deployment name. Foundry requires a project endpoint; Azure OpenAI requires the resource root endpoint." });
            yield break;
        }

        var authMode = provider == "azure-openai"
            ? (configuration["AZURE_OPENAI_AUTH_MODE"] ?? "identity").Trim().ToLowerInvariant()
            : "identity";
        if (authMode is not ("identity" or "api-key"))
        {
            yield return new AgentStreamEvent("error", new { message = "AZURE_OPENAI_AUTH_MODE must be identity or api-key." });
            yield break;
        }
        var apiKey = authMode == "api-key" ? configuration["AZURE_OPENAI_API_KEY"] : null;
        if (authMode == "api-key" && string.IsNullOrWhiteSpace(apiKey))
        {
            yield return new AgentStreamEvent("error", new { message = "Azure OpenAI API-key authentication requires AZURE_OPENAI_API_KEY in the process environment." });
            yield break;
        }

        CleanupConversations();
        var conversationId = NormalizeConversationId(requestedConversationId);
        var state = _conversations.GetOrAdd(conversationId, _ => new ConversationState(snapshot.Summary.ScopeAlias, snapshot.Summary.ReportId, principalId));
        if (state.ScopeAlias != snapshot.Summary.ScopeAlias || state.ReportId != snapshot.Summary.ReportId || state.PrincipalId != principalId)
        {
            yield return new AgentStreamEvent("error", new { message = "The conversation does not belong to the selected scope and report." });
            yield break;
        }
        await state.Gate.WaitAsync(cancellationToken);
        try
        {
            state.LastAccess = DateTimeOffset.UtcNow;
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            // A full multi-dimension review measured 57s, and one retry can follow it, so the cutoff
            // covers two attempts rather than cancelling a recovery that was about to succeed.
            deadline.CancelAfter(TimeSpan.FromSeconds(150));
            var runToken = deadline.Token;
            var events = Channel.CreateBounded<AgentStreamEvent>(new BoundedChannelOptions(32) { SingleReader = true, SingleWriter = false });
            var budget = new AgentRunBudget(ModelCallsFor(effort), ToolCallsFor(effort), item =>
            {
                if (!events.Writer.TryWrite(item)) throw new InvalidOperationException("The bounded activity stream is unavailable.");
            });
            var tools = CreateTools(snapshot, budget);
            var options = new ChatClientAgentOptions
            {
                Name = "ACO",
                Description = "Grounded Azure cost intelligence assistant",
                ChatOptions = new ChatOptions
                {
                    ModelId = model,
                    Instructions = _instructions,
                    Tools = tools,
                    MaxOutputTokens = MaximumOutputTokens,
                    AllowMultipleToolCalls = false,
                    ResponseFormat = GroundedResponseFormat,
                },
            };
            ChatClientAgent agent;
            if (provider == "foundry")
            {
                agent = new AIProjectClient(endpointUri, credential).AsAIAgent(
                    options,
                    clientFactory: client => new BudgetChatClient(client, budget));
            }
            else
            {
                var clientOptions = new AzureOpenAIClientOptions { RetryPolicy = new ClientRetryPolicy(0) };
                var client = authMode == "api-key"
                    ? new AzureOpenAIClient(endpointUri, new ApiKeyCredential(apiKey!), clientOptions)
                    : new AzureOpenAIClient(endpointUri, credential, clientOptions);
                agent = new ChatClientAgent(new BudgetChatClient(client.GetChatClient(model).AsIChatClient(), budget), options);
            }
            state.Session ??= await agent.CreateSessionAsync(runToken);

            yield return new AgentStreamEvent("meta", new AgentMeta(conversationId, "AI-generated", snapshot.Summary.PeriodKey, snapshot.Summary.ReportId));

            var prompt = $"Selected scope alias: {snapshot.Summary.ScopeAlias}. Selected report: {snapshot.Summary.ReportId}. Selected period: {snapshot.Summary.PeriodLabel}. User question: {question}";
            var producer = ProduceResponseAsync(agent, state.Session, snapshot, prompt, question, conversationId, principalId, budget, events.Writer, _semanticCache, state.ShownVisuals, runToken);
            try
            {
                await foreach (var item in events.Reader.ReadAllAsync(runToken)) yield return item;
            }
            finally
            {
                await deadline.CancelAsync();
                await producer;
            }
        }
        finally
        {
            state.Gate.Release();
        }
    }

    private static async Task ProduceResponseAsync(ChatClientAgent agent, AgentSession session, EvidenceSnapshot snapshot, string prompt, string question,
        string conversationId, string principalId, AgentRunBudget budget, ChannelWriter<AgentStreamEvent> writer, SemanticAnswerCache? semanticCache, HashSet<string> shownVisuals, CancellationToken cancellationToken)
    {
        using var run = AcoTelemetry.StartAgentRun(snapshot.Summary.ScopeAlias, snapshot.Summary.PeriodKey, conversationId);
        try
        {
            var semanticScope = SemanticScope(snapshot, principalId);
            var lookup = semanticCache is null ? (Output: null, BestScore: 0d, Embedded: false) : await semanticCache.FindAsync(semanticScope, question, cancellationToken);
            var cacheState = semanticCache is null ? "disabled" : lookup.Embedded ? "enabled" : "embedding-unavailable";
            if (lookup.Output is { } cached && TryReadCachedEntry(cached, out var cachedOutput, out var cachedInspected) && TryReplayCachedResponse(snapshot, cachedOutput, out var cachedSections))
            {
                foreach (var section in cachedSections) await writer.WriteAsync(new AgentStreamEvent("section", section), cancellationToken);
                foreach (var artifact in SelectVisuals(snapshot, question, cachedInspected, shownVisuals)) await writer.WriteAsync(new AgentStreamEvent("artifact", artifact), cancellationToken);
                await writer.WriteAsync(new AgentStreamEvent("done", new { conversationId, validated = true, sections = cachedSections.Count, modelCalls = 0, toolCalls = 0, semanticCache = cacheState, semanticCacheHit = true, semanticScore = Math.Round(lookup.BestScore, 3) }), cancellationToken);
                AcoTelemetry.RecordRunOutcome(run, validated: true, modelCalls: 0, toolCalls: 0, cacheHit: true);
                writer.TryComplete();
                return;
            }
            // Grounding failures are occasional and not reproducible, so one clean second attempt is made
            // before the user is told. The client discards the first attempt on `reset`, so nothing unvalidated is shown.
            var attemptSession = session;
            for (var attempt = 1; ; attempt++)
            {
                try
                {
                    await RunAttemptAsync(agent, attemptSession, snapshot, prompt, question, conversationId, semanticScope, budget, writer, semanticCache, shownVisuals, cacheState, lookup.BestScore, run, cancellationToken);
                    return;
                }
                catch (InvalidDataException) when (attempt == 1 && !cancellationToken.IsCancellationRequested)
                {
                    await writer.WriteAsync(new AgentStreamEvent("reset", new { conversationId, reason = "retrying" }), cancellationToken);
                    budget.ResetForRetry();
                    // The failed turn stays out of the retry, so the second attempt is not shaped by the first.
                    attemptSession = await agent.CreateSessionAsync(cancellationToken);
                }
            }
        }
        catch (Exception error)
        {
            AcoTelemetry.RecordFailure(run, error);
            writer.TryComplete(error);
        }
    }

    private static async Task RunAttemptAsync(ChatClientAgent agent, AgentSession session, EvidenceSnapshot snapshot, string prompt, string question,
        string conversationId, string semanticScope, AgentRunBudget budget, ChannelWriter<AgentStreamEvent> writer, SemanticAnswerCache? semanticCache, HashSet<string> shownVisuals,
        string cacheState, double bestScore, System.Diagnostics.Activity? run, CancellationToken cancellationToken)
    {
            var output = new StringBuilder();
            var published = new List<AgentResponseSection>();
            // The tool-free composing call is a real phase of the run, so it is reported like one:
            // it starts when composed output is first observable and only completes once validation passes.
            var composeCallId = $"tool_{Guid.NewGuid():N}";
            var composeAnnounced = false;
            await foreach (var update in agent.RunStreamingAsync(prompt, session, cancellationToken: cancellationToken))
            {
                if (string.IsNullOrEmpty(update.Text)) continue;
                if (output.Length + update.Text.Length > MaximumValidatedCharacters) throw new InvalidDataException("The response exceeded its size limit.");
                output.Append(update.Text);
                if (!composeAnnounced)
                {
                    composeAnnounced = true;
                    await writer.WriteAsync(new AgentStreamEvent("tool", new { callId = composeCallId, name = ComposeStageName, state = "running" }), cancellationToken);
                }
                // Incremental parsing only drives progressive display. A partially received structure is not a failure;
                // the final parse after the stream completes is the authoritative gate.
                IReadOnlyList<AgentResponseSection> sections;
                try { sections = ReadValidatedSections(snapshot, output.ToString()); }
                catch (JsonException) { continue; }
                foreach (var section in sections.Skip(published.Count))
                {
                    await writer.WriteAsync(new AgentStreamEvent("section", section), cancellationToken);
                    published.Add(section);
                }
            }
            var completed = output.ToString();
            try
            {
                ReadValidatedSections(snapshot, completed, final: true);
            }
            catch (JsonException error)
            {
                // Distinguish a model that stopped mid-structure from malformed content, without logging the cost figures themselves.
                throw new InvalidDataException($"The structured response did not parse. Characters: {completed.Length}. Complete sections: {published.Count}. Ends with closing brace: {completed.TrimEnd().EndsWith('}')}.", error);
            }
            if (!TryRenderGroundedResponse(snapshot, completed, out _, out var issue)) throw new InvalidDataException(issue);
            if (composeAnnounced) await writer.WriteAsync(new AgentStreamEvent("tool", new { callId = composeCallId, name = ComposeStageName, state = "completed" }), cancellationToken);
            foreach (var artifact in SelectVisuals(snapshot, question, budget.Inspected, shownVisuals)) await writer.WriteAsync(new AgentStreamEvent("artifact", artifact), cancellationToken);
            await writer.WriteAsync(new AgentStreamEvent("done", new { conversationId, validated = true, sections = published.Count, modelCalls = budget.ModelCalls, toolCalls = budget.ToolCalls, semanticCache = cacheState, semanticCacheHit = false, semanticScore = Math.Round(bestScore, 3) }), cancellationToken);
            if (semanticCache is not null) await semanticCache.StoreAsync(semanticScope, question, WriteCachedEntry(completed, budget.Inspected), cancellationToken);
            AcoTelemetry.RecordRunOutcome(run, validated: true, budget.ModelCalls, budget.ToolCalls, cacheHit: false);
            writer.TryComplete();
    }

    public async Task<AgentAnswerDto> AnswerAsync(EvidenceSnapshot snapshot, string question, string? conversationId, CancellationToken cancellationToken, string principalId = "local-os-operator")
    {
        var content = new StringBuilder();
        var activated = false;
        await foreach (var item in StreamAsync(snapshot, question, conversationId, cancellationToken, principalId))
        {
            if (item.Type == "delta" && item.Data is AgentTextDelta delta) content.Append(delta.Text);
            if (item.Type == "section" && item.Data is AgentResponseSection section)
            {
                if (content.Length == 0) content.Append("AI-generated");
                content.Append($"\n\n## {section.Title}\n\n{section.Markdown}\nEvidence: {string.Join(" ", section.EvidenceIds.Select(id => $"`{id}`"))}");
            }
            if (item.Type == "done") activated = JsonSerializer.SerializeToElement(item.Data, JsonSerializerOptions.Web).TryGetProperty("validated", out var valid) && valid.GetBoolean();
        }
        return new AgentAnswerDto(activated ? "AI-generated" : "AI unavailable", content.ToString(), activated);
    }

    private static string? LoadInstructions()
    {
        try
        {
            return File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "aco-system-prompt.md"));
        }
        catch (IOException)
        {
            return null;
        }
        catch (UnauthorizedAccessException)
        {
            return null;
        }
    }

    private static IList<AITool> CreateTools(EvidenceSnapshot snapshot, AgentRunBudget budget) =>
    [
        AIFunctionFactory.Create(
            (string scopeAlias, string reportId) => budget.RunTool("get_cost_summary", () =>
            {
                ValidateToolAccess(snapshot, budget, scopeAlias, reportId);
                return GetCostSummary(snapshot);
            }),
            "get_cost_summary",
            "Get authoritative actual cost, period, basis, currency, freshness, and evidence IDs for the selected report."),
        AIFunctionFactory.Create(
            (string scopeAlias, string reportId, string dimension, int limit = 10) => budget.RunTool("get_cost_breakdown", () =>
            {
                ValidateToolAccess(snapshot, budget, scopeAlias, reportId);
                foreach (var hint in dimension.ToLowerInvariant() switch
                {
                    "daily" => (string[])["daily"],
                    "resourcegroup" => ["resourceGroup"],
                    "all" => ["service", "resourceGroup", "daily"],
                    _ => ["service"],
                }) budget.NoteInspected(hint);
                return GetCostBreakdown(snapshot, dimension, limit);
            }),
            "get_cost_breakdown",
            "Get actual cost by service, resource group, or day. Dimension must be service, resourceGroup, daily, or all; use all to get every dimension in one call. Limit must be between 1 and 90."),
        AIFunctionFactory.Create(
            (string scopeAlias, string reportId, int limit = 10) => budget.RunTool("get_advisor_findings", () =>
            {
                ValidateToolAccess(snapshot, budget, scopeAlias, reportId);
                budget.NoteInspected("advisor");
                return GetAdvisorFindings(snapshot, limit);
            }),
            "get_advisor_findings",
            "Get real Azure Advisor cost findings and supported annual savings estimates."),
        AIFunctionFactory.Create(
            (string scopeAlias, string reportId, string? category = null, int limit = 10) => budget.RunTool("get_opportunities", () =>
            {
                ValidateToolAccess(snapshot, budget, scopeAlias, reportId);
                return GetOpportunities(snapshot, category, limit);
            }),
            "get_opportunities",
            "Get normalized evidence-backed review opportunities without treating estimates as approved or realized savings."),
        AIFunctionFactory.Create(
            (string scopeAlias, string reportId) => budget.RunTool("get_data_health", () =>
            {
                ValidateToolAccess(snapshot, budget, scopeAlias, reportId);
                return GetDataHealth(snapshot);
            }),
            "get_data_health",
            "Get source freshness, completeness, inventory count, cost source status, and evidence IDs."),
        AIFunctionFactory.Create(
            (string scopeAlias, string reportId, string evidenceId) => budget.RunTool("get_evidence", () =>
            {
                ValidateToolAccess(snapshot, budget, scopeAlias, reportId);
                return GetEvidence(snapshot, evidenceId);
            }),
            "get_evidence",
            "Get one minimized evidence record that belongs to the selected report."),
        AIFunctionFactory.Create(
            (string scopeAlias, string revisionId, string[] formats) => budget.RunTool("create_report", () =>
            {
                ValidateRevisionAccess(snapshot, budget, scopeAlias, revisionId);
                return CreateReportLinks(snapshot, formats);
            }),
            "create_report",
            "Create a private deterministic report link in json, csv, html, focus, or pdf format. This does not modify Azure."),
        AIFunctionFactory.Create(
            (string? topic = null, string? service = null, int limit = 6) => budget.RunTool("get_optimization_guidance", () =>
            {
                budget.UseTool();
                budget.NoteInspected("guidance");
                return OptimizationKnowledge.Find(topic, service, limit);
            }),
            "get_optimization_guidance",
            "Get Microsoft Well-Architected Framework cost optimization checklist items and FinOps Framework practices that match a topic or Azure service. This is published guidance, not customer cost evidence, and carries no savings amounts."),
    ];

    internal static object GetCostSummary(EvidenceSnapshot snapshot)
    {
        var costReceipt = snapshot.DataHealth.Sources.First();
        return new
        {
            snapshot.Summary.PeriodLabel,
            requestedPeriod = snapshot.Summary.RequestedPeriod,
            actualPeriod = costReceipt.ActualPeriod,
            snapshot.Summary.FinancialBasis,
            snapshot.Summary.TotalCost,
            currency = snapshot.Summary.TotalCost.Currency,
            snapshot.Summary.CollectedAt,
            snapshot.Summary.Status,
            complete = snapshot.DataHealth.Sources.All(source => source.Complete),
            evidenceIds = GetEvidenceIds(snapshot),
        };
    }

    internal static object GetAdvisorFindings(EvidenceSnapshot snapshot, int limit)
    {
        var findings = snapshot.Advisor.Take(Math.Clamp(limit, 1, 20)).Select(item => new
        {
            item.Title,
            item.EvidenceId,
            item.EstimatedAnnualSavings,
            item.SavingsCurrency,
        }).ToArray();
        return new
        {
            items = findings,
            complete = snapshot.DataHealth.Sources.All(source => source.Complete),
            evidenceIds = findings.Select(item => item.EvidenceId),
        };
    }

    internal static object GetOpportunities(EvidenceSnapshot snapshot, string? category, int limit)
    {
        var items = snapshot.Opportunities
            .Where(item => category is null || string.Equals(item.Category, category, StringComparison.OrdinalIgnoreCase))
            .Take(Math.Clamp(limit, 1, 20))
            .ToArray();
        return new
        {
            items,
            complete = snapshot.DataHealth.Sources.All(source => source.Complete),
            evidenceIds = items.SelectMany(item => item.EvidenceIds).Distinct(StringComparer.Ordinal),
        };
    }

    internal static object GetDataHealth(EvidenceSnapshot snapshot) => new
    {
        snapshot.DataHealth.Status,
        snapshot.DataHealth.ExcludedRows,
        snapshot.DataHealth.ResourceCount,
        snapshot.DataHealth.Sources,
        snapshot.DataHealth.FailedSource,
        snapshot.DataHealth.RetryAt,
        snapshot.CostSourceStatus,
        requestedPeriod = snapshot.Summary.RequestedPeriod,
        complete = snapshot.DataHealth.Sources.All(source => source.Complete),
        evidenceIds = GetEvidenceIds(snapshot),
    };

    private static void ValidateToolAccess(EvidenceSnapshot snapshot, AgentRunBudget budget, string scopeAlias, string reportId)
    {
        budget.UseTool();
        if (!string.Equals(scopeAlias, snapshot.Summary.ScopeAlias, StringComparison.Ordinal) ||
            !string.Equals(reportId, snapshot.Summary.ReportId, StringComparison.Ordinal))
        {
            throw new UnauthorizedAccessException("The requested scope or report is not authorized for this conversation.");
        }
    }

    // The last day of a month-to-date window is the day the evidence was collected, so it holds only
    // part of that day's cost. Reported as a fact because the dip it creates is not a real decline.
    internal static bool HasPartialFinalDay(EvidenceSnapshot snapshot)
    {
        var last = snapshot.Summary.Daily.OrderBy(item => item.Date).LastOrDefault();
        return last is not null
            && DateOnly.TryParse(last.Date, System.Globalization.CultureInfo.InvariantCulture, out var day)
            && day == DateOnly.FromDateTime(snapshot.Summary.CollectedAt.UtcDateTime);
    }

    internal static object GetCostBreakdown(EvidenceSnapshot snapshot, string dimension, int limit)
    {
        var boundedLimit = Math.Clamp(limit, 1, 90);
        var common = new
        {
            snapshot.Summary.TotalCost.Currency,
            snapshot.Summary.FinancialBasis,
            complete = snapshot.DataHealth.Status == "fresh",
            evidenceIds = GetEvidenceIds(snapshot),
        };
        if (string.Equals(dimension, "service", StringComparison.OrdinalIgnoreCase))
        {
            return new
            {
                items = snapshot.Summary.Services.OrderByDescending(item => item.Amount).Take(Math.Min(boundedLimit, 20)),
                common.Currency,
                common.FinancialBasis,
                common.complete,
                common.evidenceIds,
            };
        }
        if (string.Equals(dimension, "resourceGroup", StringComparison.OrdinalIgnoreCase))
        {
            // Resource-group totals exist only when the collector grouped by that dimension; older cached evidence has none.
            var groups = snapshot.Summary.ResourceGroups ?? [];
            return new
            {
                items = groups.OrderByDescending(item => item.Amount).Take(Math.Min(boundedLimit, 20)),
                common.Currency,
                common.FinancialBasis,
                complete = common.complete && groups.Count > 0,
                common.evidenceIds,
            };
        }
        if (string.Equals(dimension, "daily", StringComparison.OrdinalIgnoreCase))
        {
            return new
            {
                items = snapshot.Summary.Daily.OrderBy(item => item.Date).TakeLast(boundedLimit),
                common.Currency,
                common.FinancialBasis,
                common.complete,
                finalDayPartial = HasPartialFinalDay(snapshot),
                common.evidenceIds,
            };
        }
        if (string.Equals(dimension, "all", StringComparison.OrdinalIgnoreCase))
        {
            // One call covers every cost dimension so a broad question does not have to spend three model calls on it.
            var groups = snapshot.Summary.ResourceGroups ?? [];
            return new
            {
                services = snapshot.Summary.Services.OrderByDescending(item => item.Amount).Take(Math.Min(boundedLimit, 20)),
                resourceGroups = groups.OrderByDescending(item => item.Amount).Take(Math.Min(boundedLimit, 20)),
                daily = snapshot.Summary.Daily.OrderBy(item => item.Date).TakeLast(boundedLimit),
                common.Currency,
                common.FinancialBasis,
                common.complete,
                resourceGroupsComplete = common.complete && groups.Count > 0,
                finalDayPartial = HasPartialFinalDay(snapshot),
                common.evidenceIds,
            };
        }
        throw new ArgumentException("Dimension must be service, resourceGroup, daily, or all.");
    }

    private static void ValidateRevisionAccess(EvidenceSnapshot snapshot, AgentRunBudget budget, string scopeAlias, string revisionId)
    {
        budget.UseTool();
        var expectedRevision = $"rev_{snapshot.Summary.ReportId[4..]}";
        if (!string.Equals(scopeAlias, snapshot.Summary.ScopeAlias, StringComparison.Ordinal) || !string.Equals(revisionId, expectedRevision, StringComparison.Ordinal))
        {
            throw new UnauthorizedAccessException("The requested scope or revision is not authorized for this conversation.");
        }
    }

    internal static object GetEvidence(EvidenceSnapshot snapshot, string evidenceId)
    {
        var advisor = snapshot.Advisor.FirstOrDefault(item => string.Equals(item.EvidenceId, evidenceId, StringComparison.Ordinal));
        if (advisor is not null)
        {
            var advisorReceipt = snapshot.DataHealth.Sources.First(item => item.EvidenceIds.Contains(evidenceId, StringComparer.Ordinal));
            return new
            {
                advisor.EvidenceId,
                source = "Azure Advisor",
                claimType = "cost-recommendation",
                value = new { advisor.Title, advisor.EstimatedAnnualSavings, advisor.SavingsCurrency },
                advisorReceipt.ContentSha256,
            };
        }
        var receipt = snapshot.DataHealth.Sources.FirstOrDefault(item => item.EvidenceIds.Contains(evidenceId, StringComparer.Ordinal));
        if (receipt is not null)
        {
            return new
            {
                evidenceId,
                source = receipt.Source,
                claimType = "validated-snapshot",
                value = new { receipt.ApiVersion, receipt.RequestedPeriod, receipt.ActualPeriod, receipt.CollectedAt, receipt.Complete, receipt.RecordCount, receipt.Status },
                receipt.ContentSha256,
            };
        }
        throw new KeyNotFoundException("Evidence is not present in the selected report.");
    }

    internal static object CreateReportLinks(EvidenceSnapshot snapshot, IEnumerable<string> formats)
    {
        var supported = formats.Select(format => format.ToLowerInvariant()).Distinct(StringComparer.Ordinal).Where(format => format is "json" or "csv" or "html" or "focus" or "pdf" or "xlsx").ToArray();
        return new
        {
            reportId = snapshot.Summary.ReportId,
            formats = supported.Select(format => new { format, url = $"/api/v1/reports/{snapshot.Summary.ReportId}.{format}?scope={snapshot.Summary.ScopeAlias}&period={snapshot.Summary.PeriodKey}" }),
            ownerBound = true,
            evidenceIds = GetEvidenceIds(snapshot),
        };
    }

    private const char CachedEntrySeparator = '\u001f';

    // The cached entry keeps the inspected-evidence hints so a replay renders the same visuals as the original answer.
    internal static string WriteCachedEntry(string output, IReadOnlyCollection<string> inspected) =>
        string.Join(",", inspected.Order(StringComparer.Ordinal)) + CachedEntrySeparator + output;

    internal static bool TryReadCachedEntry(string entry, out string output, out IReadOnlyCollection<string> inspected)
    {
        var separator = entry.IndexOf(CachedEntrySeparator, StringComparison.Ordinal);
        if (separator < 0)
        {
            output = entry;
            inspected = [];
            return entry.Length > 0;
        }
        output = entry[(separator + 1)..];
        inspected = entry[..separator].Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return output.Length > 0;
    }

    internal static string VisualSignature(object artifact)
    {
        var element = JsonSerializer.SerializeToElement(artifact, JsonSerializerOptions.Web);
        var kind = element.TryGetProperty("kind", out var kindValue) ? kindValue.GetString() : "unknown";
        var title = element.TryGetProperty("title", out var titleValue) ? titleValue.GetString() : "";
        return $"{kind}|{title}";
    }

    // A repeated visual adds nothing to a follow-up, so each signature is emitted once per conversation unless the user asks again.
    internal static IEnumerable<object> SelectVisuals(EvidenceSnapshot snapshot, string question, IReadOnlyCollection<string>? inspected, HashSet<string>? shown)
    {
        var explicitRequest = ChartIntentRegex().IsMatch(question) || TableIntentRegex().IsMatch(question) || DiagramIntentRegex().IsMatch(question)
            || FullReviewRegex().IsMatch(question) || AdvisorIntentRegex().IsMatch(question) || DecisionPathRegex().IsMatch(question)
            || OwnershipRegex().IsMatch(question) || ReviewCardsRegex().IsMatch(question) || WafIntentRegex().IsMatch(question)
            || FinOpsIntentRegex().IsMatch(question) || AgilePlanRegex().IsMatch(question);
        foreach (var artifact in CreateArtifacts(snapshot, question, inspected))
        {
            var signature = VisualSignature(artifact);
            if (shown is not null && !explicitRequest && !shown.Add(signature)) continue;
            shown?.Add(signature);
            yield return artifact;
        }
    }

    internal static IEnumerable<object> CreateArtifacts(EvidenceSnapshot snapshot, string question, IReadOnlyCollection<string>? inspected = null)
    {
        var cost = snapshot.DataHealth.Sources.First();
        var evidenceIds = cost.EvidenceIds;
        var period = cost.ActualPeriod;
        var reportId = snapshot.Summary.ReportId;
        var currency = snapshot.Summary.TotalCost.Currency;
        var basis = snapshot.Summary.FinancialBasis;
        var periodLabel = snapshot.Summary.PeriodLabel;
        var sawDaily = inspected?.Contains("daily") == true;
        var sawService = inspected?.Contains("service") == true;
        var sawResourceGroup = inspected?.Contains("resourceGroup") == true;
        var sawAdvisor = inspected?.Contains("advisor") == true;
        var wantsTable = TableIntentRegex().IsMatch(question);
        var wantsChart = ChartIntentRegex().IsMatch(question);
        var groups = snapshot.Summary.ResourceGroups ?? [];

        // The model calls nearly every tool on nearly every question, so what it happened to read is a
        // poor signal of what the reader wanted. Visuals are selected from the QUESTION instead: ask for
        // one thing and one thing is drawn. Reading cost evidence stays a precondition so an off-topic
        // answer still draws nothing.
        var readCost = sawService || sawResourceGroup || sawDaily;
        var fullReview = FullReviewRegex().IsMatch(question);
        var askedService = fullReview || ServiceDimensionRegex().IsMatch(question);
        var askedResourceGroup = fullReview || ResourceGroupDimensionRegex().IsMatch(question);
        var askedDaily = fullReview || TrendIntentRegex().IsMatch(question);
        var askedAdvisor = fullReview || AdvisorIntentRegex().IsMatch(question);
        var askedDecision = fullReview || DecisionPathRegex().IsMatch(question);
        var askedOwnership = fullReview || OwnershipRegex().IsMatch(question);
        var askedCards = fullReview || ReviewCardsRegex().IsMatch(question);
        var askedWaf = fullReview || WafIntentRegex().IsMatch(question);
        var askedFinOps = fullReview || FinOpsIntentRegex().IsMatch(question);
        var askedAgile = fullReview || AgilePlanRegex().IsMatch(question);
        // The snapshot already holds every dimension, so a cost question can be illustrated whether or not
        // the model chose to spend a tool round on the breakdown. Without this, asking only for a total
        // draws nothing the moment the model answers it from the summary alone.
        var costQuestion = CostIntentRegex().IsMatch(question) || askedService || askedResourceGroup || askedDaily;
        readCost = readCost || costQuestion;
        // A cost question with no dimension named always draws the service split, which answers "where is
        // the money going". It must not depend on which dimension the model happened to read, or the same
        // question would draw a different chart on different runs.
        // A question that already named a different artifact is not a bare cost question, so it is left alone.
        if (readCost && !askedService && !askedResourceGroup && !askedDaily
            && !askedAdvisor && !askedDecision && !askedOwnership && !askedCards
            && !askedWaf && !askedFinOps && !askedAgile
            && (CostIntentRegex().IsMatch(question) || wantsChart || wantsTable))
        {
            askedService = true;
        }

        // Each dimension the reader asked for earns its own visual.
        var dimensions = new List<(string Key, string Title, string Axis, string ChartType, (string Label, string Value)[] Points)>();
        var servicePoints = snapshot.Summary.Services.OrderByDescending(item => item.Amount).Select(item => (item.Name, CanonicalAmount(item.Amount))).ToArray();
        var groupPoints = groups.OrderByDescending(item => item.Amount).Select(item => (item.Name, CanonicalAmount(item.Amount))).ToArray();
        var dailyPoints = snapshot.Summary.Daily.Select(item => (item.Date, CanonicalAmount(item.Amount))).ToArray();
        var advisorTable = wantsTable && askedAdvisor;
        if (!readCost)
        {
            // With no cost evidence read there is nothing to illustrate, so only an explicit request draws.
            if (askedDaily && (wantsChart || wantsTable)) dimensions.Add(("daily", "Daily cost", "Date (UTC)", "line", dailyPoints));
            else if ((wantsChart || wantsTable) && !advisorTable) dimensions.Add(("service", "Service cost", "Service", "bar", servicePoints));
        }
        else
        {
            if (askedDaily) dimensions.Add(("daily", "Daily cost", "Date (UTC)", "line", dailyPoints));
            if (askedService) dimensions.Add(("service", "Service cost", "Service", "bar", servicePoints));
            if (askedResourceGroup && groupPoints.Length > 0) dimensions.Add(("resourceGroup", "Resource group cost", "Resource group", "bar", groupPoints));
        }

        foreach (var dimension in dimensions)
        {
            if (dimension.Points.Length == 0) continue;
            if (wantsTable && !advisorTable)
            {
                yield return new
                {
                    kind = "table",
                    title = $"{dimension.Title} values - {periodLabel}",
                    columns = new[] { new { key = "label", label = dimension.Axis, type = "text" }, new { key = "amount", label = $"{basis} cost ({currency})", type = "money" } },
                    rows = dimension.Points.Select(point => new Dictionary<string, string> { ["label"] = point.Label, ["amount"] = point.Value }),
                    currency,
                    reportId, period, evidenceIds,
                };
            }
            var partialDay = dimension.Key == "daily" && HasPartialFinalDay(snapshot);
            yield return new
            {
                kind = "chart",
                title = $"{dimension.Title} - {periodLabel}",
                chartType = dimension.ChartType,
                note = partialDay ? $"The final point ({dimension.Points[^1].Label}) is the day this evidence was collected, so it holds only part of that day. The drop at the end is incomplete data, not a fall in spend." : null,
                currency,
                series = dimension.Key == "daily" ? dimension.Points.Select(point => new { label = point.Label, value = point.Value }) : dimension.Points.Take(8).Select(point => new { label = point.Label, value = point.Value }),
                reportId, period, evidenceIds,
            };
        }

        if (DiagramIntentRegex().IsMatch(question))
        {
            yield return new
            {
                kind = "diagram",
                title = $"Cost allocation map - {periodLabel}",
                root = "Selected Azure subscription",
                nodes = snapshot.Summary.Services.OrderByDescending(item => item.Amount).Take(5).Select(item => new
                {
                    id = AzureEvidenceService.Sha256(item.Name)[..12],
                    label = item.Name,
                    amount = CanonicalAmount(item.Amount),
                    currency,
                }),
                reportId, period, evidenceIds,
            };
        }

        // Order matters to a reader: the spend picture first, then the findings against it, then the
        // work that follows. Advisor evidence therefore lands after the cost charts, not before them.
        if (askedAdvisor && (readCost || sawAdvisor || wantsTable) && snapshot.Advisor.Count > 0)
        {
            var findings = snapshot.Advisor.Take(50).ToArray();
            yield return new
            {
                kind = "table",
                title = $"Advisor review candidates{(snapshot.Advisor.Count > findings.Length ? " (first 50)" : "")} - {periodLabel}",
                columns = new[]
                {
                    new { key = "title", label = "Advisor finding", type = "text" },
                    new { key = "annualSavings", label = "Estimated annual savings", type = "number" },
                    new { key = "currency", label = "Currency", type = "text" },
                    new { key = "status", label = "Review state", type = "text" },
                },
                rows = findings.Select(item => new Dictionary<string, string?>
                {
                    ["title"] = item.Title,
                    ["target"] = item.ResourceAlias ?? "Target not supplied by Azure",
                    ["annualSavings"] = item.EstimatedAnnualSavings is { } savings ? CanonicalAmount(savings) : null,
                    ["currency"] = item.SavingsCurrency,
                    ["status"] = "Needs human review",
                    ["evidenceId"] = item.EvidenceId,
                }),
                reportId,
                period,
                evidenceIds = findings.Select(item => item.EvidenceId).Distinct(StringComparer.Ordinal),
            };
        }

        // Published guidance is rendered as its own table so it is readable rather than buried in prose.
        // It carries no evidence IDs by contract, so it is flagged as guidance and never badged as evidence.
        if (askedWaf || askedFinOps)
        {
            var knowledge = OptimizationKnowledge.ForReport(snapshot.Summary.Services.Select(item => item.Name).Take(5));
            if (askedWaf && knowledge.WellArchitected.Count > 0)
            {
                yield return new
                {
                    kind = "table",
                    guidance = true,
                    title = $"Well-Architected cost checklist - {periodLabel}",
                    note = "Published Microsoft guidance. It carries no customer amounts and is a review checklist, not measured savings.",
                    columns = new[]
                    {
                        new { key = "code", label = "Code", type = "text" },
                        new { key = "asks", label = "What it asks", type = "text" },
                        new { key = "check", label = "What to check here", type = "text" },
                    },
                    rows = knowledge.WellArchitected.Take(24).Select(item => new Dictionary<string, string?>
                    {
                        ["code"] = item.Code,
                        ["asks"] = item.Title,
                        ["check"] = item.Recommendation,
                    }),
                    reportId,
                    period,
                    evidenceIds = Array.Empty<string>(),
                };
            }
            if (askedFinOps && knowledge.FinOps.Count > 0)
            {
                yield return new
                {
                    kind = "table",
                    guidance = true,
                    title = $"FinOps Framework practices - {periodLabel}",
                    note = "Published guidance applied in order: inform, then optimize, then operate. It carries no customer amounts.",
                    columns = new[]
                    {
                        new { key = "phase", label = "Phase", type = "text" },
                        new { key = "practice", label = "Practice", type = "text" },
                        new { key = "meaning", label = "What it means here", type = "text" },
                    },
                    rows = knowledge.FinOps.Take(24).Select(item => new Dictionary<string, string?>
                    {
                        ["phase"] = item.Phase,
                        ["practice"] = item.Title,
                        ["meaning"] = item.Practice,
                    }),
                    reportId,
                    period,
                    evidenceIds = Array.Empty<string>(),
                };
            }
        }

        // The decision path and the ownership split are separate asks, so each appears only when the
        // question called for it.
        if (askedDecision) yield return CreateDecisionFlow(snapshot, evidenceIds, reportId, period);
        if (askedOwnership) yield return CreateOwnershipMatrix(snapshot, evidenceIds, reportId, period);
        if (askedAgile) yield return CreateAgilePlan(snapshot, evidenceIds, reportId, period);

        // The cards are the closing call to action, so they are emitted last and the client keeps them
        // below every section of the written answer.
        if (askedCards && (readCost || sawAdvisor))
        {
            yield return CreateActionCards(snapshot, evidenceIds, reportId, period);
        }
    }

    // The review expressed as backlog items so it can be scheduled rather than admired. Every row is derived
    // from this snapshot, and every measure is a billed or observed outcome so an estimate cannot close an item.
    private static object CreateAgilePlan(EvidenceSnapshot snapshot, IReadOnlyList<string> evidenceIds, string reportId, ReceiptPeriodDto? period)
    {
        var currency = snapshot.Summary.TotalCost.Currency;
        var money = (decimal value) => $"{DisplayAmount(value)} {currency}";
        var rows = new List<Dictionary<string, string?>>();

        void Add(string feature, string story, string vehicle, string measure, string accountable) => rows.Add(new Dictionary<string, string?>
        {
            ["feature"] = feature,
            ["story"] = story,
            ["vehicle"] = vehicle,
            ["measure"] = measure,
            ["accountable"] = accountable,
        });

        Add("Baseline the spend",
            $"As a FinOps practitioner I want the billed total of {money(snapshot.Summary.TotalCost.Amount)} and its source receipts recorded so that later change is measured against something agreed.",
            "Cost review ritual",
            $"Baseline recorded against report {snapshot.Summary.ReportId}",
            "FinOps practitioner");

        foreach (var service in snapshot.Summary.Services.OrderByDescending(item => item.Amount).Take(3))
        {
            Add($"Attribute {service.Name}",
                $"As the owner of {service.Name} I want its {money(service.Amount)} attributed to a workload so that necessary spend is separated from waste.",
                "Workload backlog item",
                "100% of this service cost mapped to a workload or raised as unattributed",
                "Application owner");
        }

        if (snapshot.Summary.ResourceGroups is { Count: > 0 } groups)
        {
            var top = groups.OrderByDescending(item => item.Amount).First();
            Add("Name an owner",
                $"As finance I want a named owner for {top.Name} at {money(top.Amount)} so that the spend is accountable to a person, not a team inbox.",
                "Tagging or CMDB change",
                "Owner tag present on the resource group",
                "Platform engineering");
        }

        if (snapshot.Advisor.Count > 0)
        {
            Add("Triage Advisor findings",
                $"As a workload owner I want the {snapshot.Advisor.Count} Advisor finding(s) triaged into accept, reject or needs-evidence so that only supportable actions enter the sprint.",
                "Refinement session",
                "Every finding carries a decision and a reason; overlaps merged so estimates are not double counted",
                "Workload owner");
            if (snapshot.Advisor.Any(item => item.Title is { } title && CommitmentFindingRegex().IsMatch(title)))
            {
                Add("Test commitments",
                    "As finance I want commitment-style findings tested against a stable usage baseline so that we do not lock in spend we cannot use.",
                    "Finance decision record",
                    "Commitment accepted with the utilization window that supports it, or deferred with a revisit date",
                    "Finance and FinOps");
            }
        }

        if (snapshot.Summary.Daily.Count > 0)
        {
            Add("Watch the trend",
                "As a platform engineer I want a recurring check on daily spend so that a step change is caught in days rather than at invoice time.",
                "Scheduled review",
                "Review cadence agreed; the partial collection day excluded from every comparison",
                "Platform engineering");
        }

        Add("Prove the outcome",
            "As leadership I want each accepted action tracked to a billed outcome so that reported savings are realized rather than estimated.",
            "Benefit tracking record",
            "Realized saving reported from billed cost after the change, separate from the original estimate",
            "FinOps practitioner");

        return new
        {
            kind = "table",
            title = $"Agile plan - {snapshot.Summary.PeriodLabel}",
            note = "Derived from this report. Roles, not named people. An item closes on a billed or observed outcome, never on an estimate.",
            columns = new[]
            {
                new { key = "feature", label = "Feature", type = "text" },
                new { key = "story", label = "User story", type = "text" },
                new { key = "vehicle", label = "Delivery vehicle", type = "text" },
                new { key = "measure", label = "KPI / done when", type = "text" },
                new { key = "accountable", label = "Accountable", type = "text" },
            },
            rows,
            reportId,
            period,
            evidenceIds,
        };
    }

    // Cards are follow-up questions, never operations. They synthesize the report's evidence, decision path,
    // ownership, delivery plan and published guidance into one closing execution register.
    private static object CreateActionCards(EvidenceSnapshot snapshot, IReadOnlyList<string> evidenceIds, string reportId, ReceiptPeriodDto? period)
    {
        var currency = snapshot.Summary.TotalCost.Currency;
        var costEvidence = evidenceIds.FirstOrDefault();
        var guidance = OptimizationKnowledge.ForReport(snapshot.Summary.Services.Select(item => item.Name).Take(5));
        var waf = guidance.WellArchitected.FirstOrDefault();
        var inform = guidance.FinOps.FirstOrDefault(item => item.Phase.Equals("inform", StringComparison.OrdinalIgnoreCase));
        var operate = guidance.FinOps.FirstOrDefault(item => item.Phase.Equals("operate", StringComparison.OrdinalIgnoreCase));
        var items = new List<object>();
        if (snapshot.Summary.Services.OrderByDescending(item => item.Amount).FirstOrDefault() is { } service)
        {
            items.Add(new
            {
                title = $"Baseline and explain {service.Name}",
                detail = $"Decision step 1: start with the largest observed service at {currency} {DisplayAmount(service.Amount)}. RACI: workload engineer responsible, application owner accountable. Agile done-when: every cost component is attributed to a workload or named owner.{(inform is null ? "" : $" FinOps Inform: {inform.Title}.")}",
                badge = "Decision · FinOps Inform",
                evidenceId = costEvidence,
                prompts = new[]
                {
                    new { label = "Build the baseline", question = $"Explain the observed {currency} {DisplayAmount(service.Amount)} cost for {service.Name} and define the evidence-backed baseline without changing Azure." },
                    new { label = "Assign the review", question = $"Create a human-reviewed RACI brief for investigating {service.Name}, including the evidence required to close the baseline task." },
                },
            });
        }
        if (snapshot.Summary.ResourceGroups?.OrderByDescending(item => item.Amount).FirstOrDefault() is { } group)
        {
            items.Add(new
            {
                title = $"Name the owner for {group.Name}",
                detail = $"RACI and Agile: the leading resource group carries {currency} {DisplayAmount(group.Amount)}, but its name does not prove ownership. Responsible: resource group owner. Accountable: workload owner. Done-when: the named owner is recorded in the tag or CMDB of record.",
                badge = "RACI · Agile",
                evidenceId = costEvidence,
                prompts = new[]
                {
                    new { label = "Resolve ownership", question = $"Who should review {group.Name}, which roles are responsible and accountable, and what evidence is needed to assign a real owner?" },
                    new { label = "Define done-when", question = $"Describe a concise, human-reviewed owner-assignment story for {group.Name}, including its measurable done-when evidence. Return only the proposed story." },
                },
            });
        }
        if (snapshot.Advisor.OrderByDescending(item => item.EstimatedAnnualSavings ?? 0m).FirstOrDefault() is { } finding)
        {
            var target = finding.ResourceAlias ?? "subscription scope";
            var estimate = finding.EstimatedAnnualSavings is { } value && finding.SavingsCurrency is { } savingsCurrency
                ? $"{savingsCurrency} {DisplayAmount(value)} estimated annually"
                : "No annual estimate supplied";
            items.Add(new
            {
                title = $"Validate the leading Advisor candidate",
                detail = $"{finding.Title} for {target}. {estimate}. Decision path: validate the estimate before accepting it.{(waf is null ? "" : $" WAF {waf.Code}: {waf.Title}.")}",
                badge = "Advisor · WAF",
                evidenceId = finding.EvidenceId,
                prompts = new[]
                {
                    new { label = "Validate estimate", question = $"Explain the Azure Advisor finding \"{finding.Title}\" for {target}. What evidence supports it and what would I need to confirm before acting?" },
                    new { label = "Check the risks", question = $"What are the risks and tradeoffs of acting on \"{finding.Title}\"? Cover resilience, performance and commitment lock-in." },
                },
            });
        }

        items.Add(new
        {
            title = "Collect utilization before deciding",
            detail = "Decision gate: do not right-size or commit until representative utilization and ownership evidence is adequate. RACI: platform engineering responsible, workload owner accountable; consult FinOps before approval.",
            badge = "Decision gate · Metrics",
            evidenceId = costEvidence,
            prompts = new[]
            {
                new { label = "Define the evidence", question = "What utilization, coverage and ownership evidence is required before this cost decision can proceed?" },
                new { label = "Set the decision gate", question = "Create a human-reviewed decision gate for rightsizing or commitment approval, including reliability and performance checks." },
            },
        });

        if (waf is not null)
        {
            items.Add(new
            {
                title = $"Work the {waf.Code} Well-Architected check",
                detail = $"{waf.Title}. {waf.Recommendation} Treat this as published guidance to review, not measured savings.",
                badge = "Well-Architected",
                evidenceId = (string?)null,
                prompts = new[]
                {
                    new { label = "Apply the check", question = $"Apply Well-Architected cost check {waf.Code} to this report as a human-reviewed checklist. Separate observed evidence from guidance." },
                    new { label = "Check tradeoffs", question = $"What reliability, security and performance tradeoffs should be reviewed while applying {waf.Code}?" },
                },
            });
        }

        if (snapshot.Summary.Daily.Count > 1 || operate is not null)
        {
            items.Add(new
            {
                title = "Operate the backlog and prove the outcome",
                detail = $"{(operate is null ? "FinOps Operate" : $"FinOps Operate - {operate.Title}")}: track accepted work to billed outcomes, separate realized savings from estimates, and exclude the partial final day from comparisons. Agile done-when: a billed result and review cadence are recorded.",
                badge = "FinOps Operate · Agile KPI",
                evidenceId = costEvidence,
                prompts = new[]
                {
                    new { label = "Build the backlog", question = "Turn the accepted review items into a prioritized Agile backlog with roles, dependencies and billed done-when measures." },
                    new { label = "Define the cadence", question = "Recommend a human-reviewed FinOps operating cadence that tracks estimated, approved and realized savings separately without changing Azure." },
                },
            });
        }

        var actionEvidenceIds = evidenceIds.Concat(snapshot.Advisor.Select(item => item.EvidenceId)).Distinct(StringComparer.Ordinal).ToArray();
        return new
        {
            kind = "actions",
            title = $"Action items - {snapshot.Summary.PeriodLabel}",
            note = "Synthesized from observed cost, Advisor, the decision path, RACI, Agile delivery, Well-Architected and FinOps guidance. Each button asks ACO a read-only follow-up. Nothing here changes Azure.",
            items,
            reportId, period, evidenceIds = actionEvidenceIds,
        };
    }

    private static object CreateDecisionFlow(EvidenceSnapshot snapshot, IReadOnlyList<string> evidenceIds, string reportId, ReceiptPeriodDto? period)
    {
        var top = snapshot.Summary.Services.OrderByDescending(item => item.Amount).FirstOrDefault();
        var currency = snapshot.Summary.TotalCost.Currency;
        var leading = top is null ? "the largest service" : $"{top.Name} ({currency} {DisplayAmount(top.Amount)})";
        var advisorCount = snapshot.Advisor.Count;
        var commitments = snapshot.Advisor.Count(item => CommitmentFindingRegex().IsMatch(item.Title ?? string.Empty));
        return new
        {
            kind = "flow",
            title = $"Decision path - {snapshot.Summary.PeriodLabel}",
            caption = "Deterministic decision path built from this report. Each decision is a human judgement, not an automated action.",
            nodes = new object[]
            {
                new { id = "start", type = "start", label = "Start with the largest cost", detail = $"Leading service: {leading}." },
                new { id = "d1", type = "decision", label = "Is there an Advisor finding for it?", detail = $"{advisorCount} finding(s) in this report.", yes = "a1", no = "a2" },
                new { id = "a1", type = "action", label = "Validate the estimate", detail = "Advisor savings are estimates. Confirm utilization and ownership before accepting.", next = "d2" },
                new { id = "a2", type = "action", label = "Review scaling and rates", detail = "Well-Architected CO:12 scaling costs and CO:05 provider rates.", next = "d2" },
                new { id = "d2", type = "decision", label = "Is utilization evidence adequate?", detail = "Rightsizing needs enough days and metric coverage to be safe.", yes = "d3", no = "a3" },
                new { id = "a3", type = "action", label = "Collect utilization first", detail = "Gather Azure Monitor metrics over a representative period, then revisit.", next = "end" },
                new { id = "d3", type = "decision", label = "Is the baseline stable?", detail = commitments > 0 ? $"{commitments} commitment-style finding(s) present." : "No commitment-style findings in this report.", yes = "a4", no = "a5" },
                new { id = "a4", type = "action", label = "Evaluate a commitment", detail = "Reservations or savings plans only after stable use is established (CO:05).", next = "end" },
                new { id = "a5", type = "action", label = "Optimize usage first", detail = "Remove idle and unused components and tune scaling (CO:07, CO:12).", next = "end" },
                new { id = "end", type = "end", label = "Assign, schedule, track", detail = "Name an owner, set a review date, and record the billed outcome (FinOps Operate)." },
            },
            reportId, period, evidenceIds,
        };
    }

    private static object CreateOwnershipMatrix(EvidenceSnapshot snapshot, IReadOnlyList<string> evidenceIds, string reportId, ReceiptPeriodDto? period)
    {
        var services = snapshot.Summary.Services.OrderByDescending(item => item.Amount).Take(3).ToArray();
        var currency = snapshot.Summary.TotalCost.Currency;
        var rows = new List<Dictionary<string, string?>>();
        foreach (var service in services)
        {
            rows.Add(new Dictionary<string, string?>
            {
                ["workstream"] = $"Review {service.Name} ({currency} {DisplayAmount(service.Amount)})",
                ["responsible"] = "Workload engineer for that service",
                ["accountable"] = "Application or product owner",
                ["consulted"] = "Platform and FinOps practitioner",
                ["informed"] = "Finance and engineering leadership",
            });
        }
        if (snapshot.Advisor.Count > 0)
        {
            rows.Add(new Dictionary<string, string?>
            {
                ["workstream"] = $"Triage {snapshot.Advisor.Count} Advisor finding(s)",
                ["responsible"] = "FinOps practitioner",
                ["accountable"] = "Workload owner",
                ["consulted"] = "Service engineers named on each resource",
                ["informed"] = "Finance",
            });
        }
        rows.Add(new Dictionary<string, string?>
        {
            ["workstream"] = "Confirm the billed outcome after each change",
            ["responsible"] = "FinOps practitioner",
            ["accountable"] = "Cost owner for the scope",
            ["consulted"] = "Workload engineers",
            ["informed"] = "Finance and leadership",
        });
        return new
        {
            kind = "table",
            title = $"Ownership (RACI) - {snapshot.Summary.PeriodLabel}",
            note = "Roles, not named people. This report carries no owner assignments, so assign real names before tracking these as work items.",
            columns = new[]
            {
                new { key = "workstream", label = "Workstream", type = "text" },
                new { key = "responsible", label = "Responsible", type = "text" },
                new { key = "accountable", label = "Accountable", type = "text" },
                new { key = "consulted", label = "Consulted", type = "text" },
                new { key = "informed", label = "Informed", type = "text" },
            },
            rows,
            reportId, period, evidenceIds,
        };
    }

    // A cached answer is replayed through the same validation path, so evidence that has moved on is rejected rather than reused.
    internal static bool TryReplayCachedResponse(EvidenceSnapshot snapshot, string output, out IReadOnlyList<AgentResponseSection> sections)
    {
        try
        {
            sections = ReadValidatedSections(snapshot, output, final: true);
            return sections.Count == ResponseSections.Length && TryRenderGroundedResponse(snapshot, output, out _, out _);
        }
        catch (Exception error) when (error is InvalidDataException or JsonException)
        {
            sections = [];
            return false;
        }
    }

    internal static string SemanticScope(EvidenceSnapshot snapshot, string principalId) =>
        string.Join('|', principalId, snapshot.Summary.ScopeAlias, snapshot.Summary.ReportId, snapshot.Summary.PeriodKey,
            snapshot.Summary.CollectedAt.ToString("O", System.Globalization.CultureInfo.InvariantCulture),
            string.Join(',', snapshot.DataHealth.SourceReceiptHashes));

    private static string CanonicalAmount(decimal value) => value.ToString("0.#############################", System.Globalization.CultureInfo.InvariantCulture);
    // Labels are prose. Full stored precision stays in the charts, evidence and reports.
    private static string DisplayAmount(decimal value) => value.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture);

    private static string NormalizeConversationId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return $"conv_{Guid.NewGuid():N}";
        if (!ConversationIdRegex().IsMatch(value)) throw new ArgumentException("Conversation ID is invalid.");
        return value;
    }

    // A write request is a mutation verb whose OBJECT is an Azure thing. Checking the verb and the target
    // independently is not enough: "create a flow chart" in a question that also mentions resource groups
    // is a rendering request, not a mutation.
    internal static bool IsWriteRequest(string question)
    {
        foreach (Match match in WriteCommandRegex().Matches(question))
        {
            if (IsAzureObject(match.Groups["object"].Value)) return true;
        }
        foreach (Match match in PassiveWriteRegex().Matches(question))
        {
            if (IsAzureObject(match.Groups["object"].Value)) return true;
        }
        return false;

        static bool IsAzureObject(string span) => WriteTargetRegex().IsMatch(span) && !PresentationNounRegex().IsMatch(span);
    }

    internal static bool IsEvidenceUsableForModel(EvidenceSnapshot snapshot, DateTimeOffset now, out string issue)
    {
        // A throttled receipt records a failed collection attempt, not incomplete evidence, so it is disclosed without blocking the model.
        var collected = snapshot.DataHealth.Sources.Where(source => !string.Equals(source.Status, "throttled", StringComparison.Ordinal)).ToArray();
        if (!string.Equals(snapshot.DataHealth.Status, "fresh", StringComparison.Ordinal) || collected.Length == 0 || collected.Any(source => !source.Complete))
        {
            issue = "The selected report is not complete and fresh.";
            return false;
        }
        if (snapshot.Summary.CollectedAt > now.AddMinutes(5) || now - snapshot.Summary.CollectedAt > TimeSpan.FromHours(24))
        {
            issue = "The selected report is outside the 24-hour model evidence window.";
            return false;
        }
        issue = "None.";
        return true;
    }

    internal static JsonElement CreateGroundedResponseSchema()
    {
        var block = new
        {
            type = "object",
            properties = new { text = new { type = "string" }, evidenceIds = new { type = "array", items = new { type = "string" } } },
            required = new[] { "text", "evidenceIds" },
            additionalProperties = false,
        };
        return JsonSerializer.SerializeToElement(new
        {
            type = "object",
            properties = new { answer = block, evidence = block, dataHealth = block, risks = block, nextAction = block },
            required = new[] { "answer", "evidence", "dataHealth", "risks", "nextAction" },
            additionalProperties = false,
        });
    }

    internal static bool TryRenderGroundedResponse(EvidenceSnapshot snapshot, string output, out string response, out string issue)
    {
        response = "";
        issue = "The model did not return a complete structured answer.";
        if (string.IsNullOrWhiteSpace(output) || output.Length > MaximumValidatedCharacters) return false;
        GroundedModelResponse? result;
        try { result = JsonSerializer.Deserialize<GroundedModelResponse>(output, JsonSerializerOptions.Web); }
        catch (JsonException) { return false; }
        if (result is null) return false;
        var sections = new (string Heading, GroundedResponseBlock? Block)[]
        {
            ("Answer", result.Answer), ("Evidence", result.Evidence), ("Data health", result.DataHealth),
            ("Risks", result.Risks), ("Next action", result.NextAction),
        };
        var rendered = new StringBuilder("AI-generated");
        foreach (var (heading, block) in sections)
        {
            if (!TryRenderSection(snapshot, heading, block, out var markdown, out issue)) return false;
            rendered.Append($"\n\n{markdown}");
        }
        response = rendered.ToString();
        return TryValidateResponse(snapshot, response, out issue);
    }

    private static bool TryRenderSection(EvidenceSnapshot snapshot, string heading, GroundedResponseBlock? block, out string markdown, out string issue)
    {
        markdown = "";
        issue = "The model did not return a complete evidence block.";
        if (block is null || string.IsNullOrWhiteSpace(block.Text) || block.EvidenceIds is null) return false;
        var authorized = GetEvidenceIds(snapshot).ToHashSet(StringComparer.Ordinal);
        if (block.EvidenceIds.Any(evidenceId => !authorized.Contains(evidenceId)) || EvidenceIdRegex().Matches(block.Text).Any(match => !authorized.Contains(match.Value)))
        {
            issue = "The model cited evidence that is not in the selected report.";
            return false;
        }
        if (ContainsUncitedNumber(block.Text) && block.EvidenceIds.Length == 0)
        {
            issue = "A numeric claim did not cite evidence in its structured block.";
            return false;
        }
        if (SensitiveContentRegex().IsMatch(block.Text) || PromptInjectionRegex().IsMatch(block.Text) || Regex.IsMatch(block.Text, @"(?m)^\s*#"))
        {
            issue = "The evidence block failed content or presentation checks.";
            return false;
        }
        var safeText = AzureGuidRegex().Replace(block.Text, "[redacted Azure identifier]");
        var citations = string.Join(" ", block.EvidenceIds.Distinct(StringComparer.Ordinal).Select(evidenceId => $"`{evidenceId}`"));
        var rendered = new StringBuilder($"## {heading}");
        foreach (var paragraph in safeText.Replace("\r\n", "\n", StringComparison.Ordinal).Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            rendered.Append($"\n\n{paragraph}");
            // A citation line directly under a table row would be parsed as another row, so block content gets a blank line.
            if (citations.Length > 0) rendered.Append(Regex.IsMatch(paragraph, @"(?m)^\s*[|>-]") ? $"\n\nEvidence: {citations}" : $"\nEvidence: {citations}");
        }
        markdown = rendered.ToString();
        issue = "None.";
        return true;
    }

    internal static IReadOnlyList<AgentResponseSection> ReadValidatedSections(EvidenceSnapshot snapshot, string output, bool final = false)
    {
        if (output.Length > MaximumValidatedCharacters) throw new InvalidDataException("The response exceeded its size limit.");
        var reader = new Utf8JsonReader(Encoding.UTF8.GetBytes(output), final, new JsonReaderState(new JsonReaderOptions { MaxDepth = 8 }));
        var blocks = new Dictionary<string, AgentResponseSection>(StringComparer.Ordinal);
        if (!reader.Read()) return [];
        if (reader.TokenType != JsonTokenType.StartObject) throw new InvalidDataException("A structured response is required.");
        while (reader.Read() && reader.TokenType != JsonTokenType.EndObject)
        {
            if (reader.TokenType != JsonTokenType.PropertyName) throw new InvalidDataException("Unexpected response content.");
            var id = reader.GetString()!;
            var definition = ResponseSections.FirstOrDefault(section => section.Id == id);
            if (definition.Id is null || blocks.ContainsKey(id)) throw new InvalidDataException("Unexpected or duplicate response section.");
            if (!reader.Read() || !JsonDocument.TryParseValue(ref reader, out var document)) break;
            using (document)
            {
                if (document.RootElement.ValueKind != JsonValueKind.Object || document.RootElement.EnumerateObject().Count() != 2) throw new InvalidDataException("Invalid evidence block.");
                var block = document.RootElement.Deserialize<GroundedResponseBlock>(JsonSerializerOptions.Web);
                if (!TryRenderSection(snapshot, definition.Title, block, out var markdown, out var issue)) throw new InvalidDataException(issue);
                blocks.Add(id, new AgentResponseSection(id, definition.Title, AzureGuidRegex().Replace(block!.Text, "[redacted Azure identifier]"), block.EvidenceIds));
            }
        }
        var completed = new List<AgentResponseSection>();
        foreach (var section in ResponseSections)
        {
            if (!blocks.TryGetValue(section.Id, out var block)) break;
            completed.Add(block);
        }
        if (final && (completed.Count != ResponseSections.Length || reader.TokenType != JsonTokenType.EndObject || reader.Read())) throw new InvalidDataException("The structured response is incomplete.");
        return completed;
    }

    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    internal sealed record GroundedResponseBlock([property: JsonRequired] string Text, [property: JsonRequired] string[] EvidenceIds);

    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    internal sealed record GroundedModelResponse(
        [property: JsonRequired] GroundedResponseBlock Answer,
        [property: JsonRequired] GroundedResponseBlock Evidence,
        [property: JsonRequired] GroundedResponseBlock DataHealth,
        [property: JsonRequired] GroundedResponseBlock Risks,
        [property: JsonRequired] GroundedResponseBlock NextAction);

    internal static bool TryValidateResponse(EvidenceSnapshot snapshot, string response, out string issue)
    {
        if (string.IsNullOrWhiteSpace(response) || response.Length > MaximumValidatedCharacters || !response.TrimStart().StartsWith("AI-generated", StringComparison.Ordinal))
        {
            issue = "The model output was empty, oversized, or missing its transparency label.";
            return false;
        }
        var headings = new[] { "## Answer", "## Evidence", "## Data health", "## Risks", "## Next action" };
        var previousIndex = -1;
        foreach (var heading in headings)
        {
            var index = response.IndexOf(heading, StringComparison.Ordinal);
            if (index <= previousIndex || response.IndexOf(heading, index + heading.Length, StringComparison.Ordinal) >= 0)
            {
                issue = $"The model output omitted, duplicated, or misplaced the required {heading[3..]} section.";
                return false;
            }
            previousIndex = index;
        }

        var authorizedEvidence = snapshot.DataHealth.Sources.SelectMany(source => source.EvidenceIds)
            .Concat(snapshot.Advisor.Select(item => item.EvidenceId))
            .ToHashSet(StringComparer.Ordinal);
        foreach (Match match in EvidenceIdRegex().Matches(response))
        {
            if (!authorizedEvidence.Contains(match.Value))
            {
                issue = "The model cited evidence that is not in the selected report.";
                return false;
            }
        }
        // A Markdown table must be closed by a blank line, so its citation line lands in the next split block.
        // Re-attach any citation-only block to the content it cites before checking that numbers are cited.
        var blocks = new List<string>();
        foreach (var block in EvidenceBlockBoundaryRegex().Split(response).Where(item => !string.IsNullOrWhiteSpace(item)))
        {
            if (blocks.Count > 0 && block.TrimStart().StartsWith("Evidence:", StringComparison.Ordinal)) blocks[^1] = $"{blocks[^1]}\n{block}";
            else blocks.Add(block);
        }
        foreach (var block in blocks)
        {
            if (ContainsUncitedNumber(block) && !EvidenceIdRegex().IsMatch(block))
            {
                issue = "A numeric claim did not cite evidence in the same Markdown paragraph or table.";
                return false;
            }
        }
        if (SensitiveContentRegex().IsMatch(response) || PromptInjectionRegex().IsMatch(response))
        {
            issue = "The model output triggered the deterministic content-safety boundary.";
            return false;
        }
        issue = "None.";
        return true;
    }

    private static string CreateDeterministicRefusal(EvidenceSnapshot snapshot, string answer, string risk)
    {
        var evidenceId = GetEvidenceIds(snapshot).First();
        return $"AI-generated\n\n## Answer\n{answer}\n\n## Evidence\nThe selected report remains available through deterministic APIs and reports. Evidence `{evidenceId}`.\n\n## Data health\n{snapshot.DataHealth.Status}.\n\n## Risks\n{risk}\n\n## Next action\nRefresh or review the deterministic report with an authorized human.";
    }

    private static IReadOnlyList<string> GetEvidenceIds(EvidenceSnapshot snapshot) => snapshot.DataHealth.Sources
        .SelectMany(source => source.EvidenceIds)
        .Concat(snapshot.Advisor.Select(item => item.EvidenceId))
        .Distinct(StringComparer.Ordinal)
        .ToArray();

    private static IEnumerable<string> Chunk(string value, int size)
    {
        for (var offset = 0; offset < value.Length; offset += size)
        {
            yield return value.Substring(offset, Math.Min(size, value.Length - offset));
        }
    }

    private void CleanupConversations()
    {
        var cutoff = DateTimeOffset.UtcNow - ConversationLifetime;
        foreach (var item in _conversations.Where(item => item.Value.LastAccess < cutoff)) _conversations.TryRemove(item.Key, out _);
        while (_conversations.Count >= MaximumConversations)
        {
            var oldest = _conversations.OrderBy(item => item.Value.LastAccess).FirstOrDefault();
            if (oldest.Key is null || !_conversations.TryRemove(oldest.Key, out _)) break;
        }
    }

    private sealed class ConversationState(string scopeAlias, string reportId, string principalId)
    {
        public string PrincipalId { get; } = principalId;
        public string ScopeAlias { get; } = scopeAlias;
        public string ReportId { get; } = reportId;
        public SemaphoreSlim Gate { get; } = new(1, 1);
        public AgentSession? Session { get; set; }
        // A visual is worth showing once per conversation; repeating it on every follow-up is noise.
        public HashSet<string> ShownVisuals { get; } = new(StringComparer.Ordinal);
        public DateTimeOffset LastAccess { get; set; } = DateTimeOffset.UtcNow;
    }

    internal sealed class AgentRunBudget(int maximumModelCalls, int maximumToolCalls, Action<AgentStreamEvent>? publish = null)
    {
        private int _modelCalls;
        private int _toolCalls;
        private readonly ConcurrentDictionary<string, byte> _inspected = new(StringComparer.Ordinal);

        public int ModelCalls => Volatile.Read(ref _modelCalls);
        public int ToolCalls => Volatile.Read(ref _toolCalls);

        // A visual is offered only for evidence the model actually inspected.
        public void NoteInspected(string hint) => _inspected.TryAdd(hint, 0);
        public IReadOnlyCollection<string> Inspected => _inspected.Keys.ToArray();

        public void UseModel()
        {
            if (Interlocked.Increment(ref _modelCalls) > maximumModelCalls) throw new InvalidOperationException("The model call budget was exceeded.");
        }

        // A retry is a second attempt at the same turn, so it starts from a clean budget and no inspected evidence.
        public void ResetForRetry()
        {
            Volatile.Write(ref _modelCalls, 0);
            Volatile.Write(ref _toolCalls, 0);
            _inspected.Clear();
        }

        public ChatOptions? ConfigureModelCall(ChatOptions? options)
        {
            UseModel();
            if (ModelCalls < maximumModelCalls && ToolCalls < maximumToolCalls) return options;
            var finalOptions = options?.Clone() ?? new ChatOptions();
            finalOptions.ToolMode = ChatToolMode.None;
            finalOptions.Tools = null;
            return finalOptions;
        }

        public void UseTool()
        {
            if (Interlocked.Increment(ref _toolCalls) > maximumToolCalls) throw new InvalidOperationException("The tool call budget was exceeded.");
        }

        public Result RunTool<Result>(string name, Func<Result> operation)
        {
            var callId = $"tool_{Guid.NewGuid():N}";
            using var activity = AcoTelemetry.StartTool(name);
            publish?.Invoke(new AgentStreamEvent("tool", new { callId, name, state = "running" }));
            try
            {
                var result = operation();
                publish?.Invoke(new AgentStreamEvent("tool", new { callId, name, state = "completed" }));
                return result;
            }
            catch
            {
                publish?.Invoke(new AgentStreamEvent("tool", new { callId, name, state = "failed" }));
                throw;
            }
        }
    }

    private sealed class BudgetChatClient(IChatClient innerClient, AgentRunBudget budget) : DelegatingChatClient(innerClient)
    {
        public override Task<ChatResponse> GetResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
        {
            return base.GetResponseAsync(messages, budget.ConfigureModelCall(options), cancellationToken);
        }

        public override IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default)
        {
            return base.GetStreamingResponseAsync(messages, budget.ConfigureModelCall(options), cancellationToken);
        }
    }

    [GeneratedRegex(@"(?i)\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b")]
    private static partial Regex AzureGuidRegex();

    [GeneratedRegex(@"^conv_[a-f0-9]{32}$")]
    private static partial Regex ConversationIdRegex();

    // Plurals matter: a reader asks for "diagrams" and "graphs" far more often than the singular.
    [GeneratedRegex(@"(?i)\b(charts?|graphs?|plots?|bars?|png|visuali[sz]\w*)\b")]
    private static partial Regex ChartIntentRegex();

    [GeneratedRegex(@"(?i)\b(tables?|tabular|spreadsheets?)\b")]
    private static partial Regex TableIntentRegex();

    [GeneratedRegex(@"(?i)(\b(advisor|recommendations?|savings?|reservations?|commitments?)\b)|(\breserved instance\b)|(\bopportunit\w*)|(\bsave\b[^.?!]{0,18}\b(cost|costs|money|spend)\b)|(\breduce\b[^.?!]{0,22}\b(cost|costs|spend|bill)\b)|(\boptimi[sz]\w*\b[^.?!]{0,18}\b(cost|costs|spend)\b)")]
    private static partial Regex AdvisorIntentRegex();

    [GeneratedRegex(@"(?i)\b(trend|daily|day by day|over time|timeline|per day)\b")]
    private static partial Regex TrendIntentRegex();

    [GeneratedRegex(@"(?i)(\b(by|per|across|each|top)\s+(azure\s+)?services?\b)|(\bservices?\s+(cost|spend|breakdown|split)\b)|(\bcost\s+by\s+services?\b)|(\b(highest|largest|biggest|most expensive|top)\b[^.?!]{0,28}\bservices?\b)|(\bwhich\s+services?\b)")]
    private static partial Regex ServiceDimensionRegex();

    [GeneratedRegex(@"(?i)\bresource[\s-]?groups?\b")]
    private static partial Regex ResourceGroupDimensionRegex();

    // A question that asks for everything still gets everything; anything narrower gets only what it named.
    [GeneratedRegex(@"(?i)(\bfull\b[^.?!]{0,20}\breview\b)|(\bcomplete\b[^.?!]{0,20}\breview\b)|(\bfull (cost|spend) (picture|overview|breakdown)\b)|(\beverything\b)|(\bend.to.end review\b)")]
    private static partial Regex FullReviewRegex();

    [GeneratedRegex(@"(?i)(\bdecision\b)|(\bnext (step|action)s?\b)|(\baction plan\b)|(\bwhat should i do\b)|(\bwhere (do|should) i start\b)|(\bprioriti[sz]\w*)|(\broad ?map\b)|(\bfirst\b[^.?!]{0,16}\b(fix|act|do|tackle)\b)")]
    private static partial Regex DecisionPathRegex();

    [GeneratedRegex(@"(?i)(\bwho\b[^.?!]{0,16}\b(owns?|own|responsible|accountable)\b)|(\bownership\b)|(\bowners?\b)|(\braci\b)|(\baccountab\w*)|(\bresponsib\w*)|(\bassign\w*)")]
    private static partial Regex OwnershipRegex();

    // Asking how to save is asking what to act on, so it earns the cards as well as an explicit request.
    [GeneratedRegex(@"(?i)(\breview candidates?\b)|(\baction items?\b)|(\baction cards?\b)|(\badaptive cards?\b)|(\bactionable\b)|(\bwhat can i act on\b)|(\bthings? to act\b)|(\bsave\b[^.?!]{0,18}\b(cost|costs|money|spend)\b)|(\breduce\b[^.?!]{0,22}\b(cost|costs|spend|bill)\b)")]
    private static partial Regex ReviewCardsRegex();

    [GeneratedRegex(@"(?i)\b(cost|costs|spend|spending|spent|bill|billed|billing|charge|charges|usage|budget)\b")]
    private static partial Regex CostIntentRegex();

    [GeneratedRegex(@"(?i)(\bwell.?architected\b)|(\bwaf\b)|(\bchecklist\b)|(\bCO:\d{2}\b)")]
    private static partial Regex WafIntentRegex();

    [GeneratedRegex(@"(?i)(\bfin\s?ops\b)|(\bfinops\b)")]
    private static partial Regex FinOpsIntentRegex();

    [GeneratedRegex(@"(?i)(\bagile\b)|(\bbacklog\b)|(\buser stor\w*)|(\bepics?\b)|(\bsprints?\b)|(\bdelivery plan\b)|(\bwork items?\b)|(\bbreak (it|this|them) down\b)")]
    private static partial Regex AgilePlanRegex();

    [GeneratedRegex(@"(?i)\b(diagrams?|maps?|architecture|relationships?|flow charts?|flowcharts?)\b")]
    private static partial Regex DiagramIntentRegex();

    [GeneratedRegex(@"(?i)\b(reserved instance|reservation|savings plan|commitment)\b")]
    private static partial Regex CommitmentFindingRegex();

    // A mutation verb only counts when it opens a clause or follows a request phrase, so it reads as an
    // instruction to act. The captured object is what decides whether the target is Azure or a rendering.
    [GeneratedRegex(@"(?i)(?:^|[.!?;\n]\s*|\b(?:please|kindly|now|then|also|and)\s+|\b(?:can|could|would|will|should)\s+you\s+(?:please\s+)?|\bi\s+(?:want|need)\s+you\s+to\s+|\bgo\s+ahead\s+and\s+|\blet\s?'?s\s+|\bhelp\s+me\s+)(?:create|delete|remove|destroy|resize|scale|stop|restart|shut\s?down|purchase|buy|reserve|assign|grant|revoke|remediate|deploy|modify|change|update|set|execute|enable|disable|terminate|decommission)\b(?<object>[^.!?;\n]{0,60})")]
    private static partial Regex WriteCommandRegex();

    // Passive phrasing puts the target before the verb, so the object is the text that precedes it.
    [GeneratedRegex(@"(?i)(?<object>[^.!?;\n]{0,60})\b(?:be|get)\s+(?:created|deleted|removed|destroyed|resized|scaled|stopped|restarted|purchased|reserved|assigned|granted|revoked|remediated|deployed|modified|changed|updated|enabled|disabled|terminated|decommissioned)\b")]
    private static partial Regex PassiveWriteRegex();

    [GeneratedRegex(@"(?i)\b(resource group|resource|vm|virtual machine|database|subscription|reservation|savings plan|role|policy|lock|instance|cluster|app|account|storage|tier|sku|configuration|rg-[a-z0-9-]+)\b")]
    private static partial Regex WriteTargetRegex();

    // Asking for something to be drawn or written in the answer is a rendering request, never a mutation.
    [GeneratedRegex(@"(?i)\b(flow\s?chart|chart|table|diagram|graph|report|matrix|raci|summary|list|breakdown|view|visual|picture|dashboard|section|answer|column|row|markdown)\b")]
    private static partial Regex PresentationNounRegex();

    [GeneratedRegex(@"(?i)\b(ignore|bypass|override|reveal|print|show)\b.{0,60}\b(previous instructions|system prompt|hidden prompt|guardrail|safety policy)\b")]
    private static partial Regex PromptInjectionRegex();

    [GeneratedRegex(@"(?i)\b(api[- ]?key|access token|bearer token|client secret|password|credential)\b")]
    private static partial Regex SensitiveContentRegex();

    [GeneratedRegex(@"\bev_[a-f0-9]{16,64}\b")]
    private static partial Regex EvidenceIdRegex();

    [GeneratedRegex(@"(?<![A-Za-z0-9_])[-+]?\d+(?:[,.]\d+)*(?![A-Za-z0-9_])")]
    private static partial Regex NumericClaimRegex();

    // Durations, calendar dates, ordinals and published framework identifiers describe context, not a monetary claim, so they must not require a citation.
    [GeneratedRegex(@"(?i)\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b|\b\d+\s*-?\s*(?:day|days|week|weeks|month|months|hour|hours|minute|minutes|year|years)\b|\b(?:last|past|previous|next|top|first)\s+\d+\b|\bCO:\s?\d{2}\b|\bFOCUS\s?\d+(?:\.\d+)?\b")]
    private static partial Regex NonFinancialNumberRegex();

    internal static bool ContainsUncitedNumber(string text) => NumericClaimRegex().IsMatch(NonFinancialNumberRegex().Replace(text, " "));

    [GeneratedRegex(@"\r?\n[\t ]*\r?\n|\r?\n(?=##[\t ])")]
    private static partial Regex EvidenceBlockBoundaryRegex();

}

public sealed record AgentStreamEvent(string Type, object Data);
public sealed record AgentResponseSection(string Id, string Title, string Markdown, IReadOnlyList<string> EvidenceIds);
public sealed record AgentMeta(string ConversationId, string Label, string Period, string ReportId);
public sealed record AgentTextDelta(string Text);
public sealed record AgentAnswerDto(string Label, string Content, bool FoundryActivated);