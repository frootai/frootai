using System.Diagnostics;

// Traces carry the shape of a run, never its financial content: no amounts, evidence IDs, questions or answers.
internal static class AcoTelemetry
{
    internal const string SourceName = "AzureCostOptimizer";

    private static readonly ActivitySource Source = new(SourceName, "1.0.0");

    internal static Activity? StartAgentRun(string scopeAlias, string periodKey, string conversationId)
    {
        var activity = Source.StartActivity("aco.agent.run", ActivityKind.Internal);
        activity?.SetTag("aco.scope_alias", scopeAlias);
        activity?.SetTag("aco.period", periodKey);
        activity?.SetTag("aco.conversation_id", conversationId);
        return activity;
    }

    internal static Activity? StartTool(string name)
    {
        var activity = Source.StartActivity($"aco.tool.{name}", ActivityKind.Internal);
        activity?.SetTag("aco.tool_name", name);
        return activity;
    }

    internal static Activity? StartCollection(string source, string periodKey)
    {
        var activity = Source.StartActivity("aco.evidence.collect", ActivityKind.Client);
        activity?.SetTag("aco.cost_source", source);
        activity?.SetTag("aco.period", periodKey);
        return activity;
    }

    internal static void RecordRunOutcome(Activity? activity, bool validated, int modelCalls, int toolCalls, bool cacheHit)
    {
        if (activity is null) return;
        activity.SetTag("aco.validated", validated);
        activity.SetTag("aco.model_calls", modelCalls);
        activity.SetTag("aco.tool_calls", toolCalls);
        activity.SetTag("aco.semantic_cache_hit", cacheHit);
        activity.SetStatus(validated ? ActivityStatusCode.Ok : ActivityStatusCode.Error);
    }

    internal static void RecordFailure(Activity? activity, Exception error)
    {
        activity?.SetTag("aco.error_type", error.GetType().Name);
        activity?.SetStatus(ActivityStatusCode.Error);
    }
}
