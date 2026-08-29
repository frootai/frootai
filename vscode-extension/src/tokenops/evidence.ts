import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { FinOpsSummary, ReconciliationResult, TokenOpsEstimate, TokenRange, ToolCallObservation, ToolProfile, UsageObservation } from "./domain";
import { normalizeRange } from "./domain";

const finiteOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const integerOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};
const safeText = (value: unknown, maximum = 200): string => String(value || "").trim().slice(0, maximum);

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function strictTimestamp(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  if (match[7] === "Z") {
    const canonical = parsed.toISOString();
    if (canonical.slice(0, 19) !== `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`) return null;
  }
  return parsed.toISOString();
}

function normalizeToolCalls(value: unknown): ToolCallObservation[] {
  if (!Array.isArray(value)) return [];
  if (value.length > 200) throw new Error("A receipt cannot contain more than 200 tool-call summaries.");
  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") throw new Error(`Tool-call summary ${index + 1} must be an object.`);
    const raw = candidate as Record<string, unknown>;
    const name = safeText(raw.name || raw.toolName);
    const calls = integerOrNull(raw.calls);
    const argumentTokens = integerOrNull(raw.argumentTokens ?? raw.argument_tokens);
    const resultTokens = integerOrNull(raw.resultTokens ?? raw.result_tokens);
    if (!name) throw new Error(`Tool-call summary ${index + 1} is missing a name.`);
    if (calls == null) throw new Error(`Tool-call summary ${index + 1} requires a nonnegative integer calls value.`);
    if ((raw.argumentTokens ?? raw.argument_tokens) != null && argumentTokens == null) throw new Error(`Tool-call summary ${index + 1} has invalid argument tokens.`);
    if ((raw.resultTokens ?? raw.result_tokens) != null && resultTokens == null) throw new Error(`Tool-call summary ${index + 1} has invalid result tokens.`);
    return {
      name,
      calls,
      argumentTokens,
      resultTokens,
    };
  });
}

/** Accepts neutral FrootAI receipts plus common OpenAI/Anthropic/Google usage field names. */
export function normalizeUsageReceipt(raw: unknown, repository = "unassigned", project = "unassigned"): UsageObservation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Usage receipt must be a JSON object.");
  const value = raw as Record<string, any>;
  const usage = value.usage && typeof value.usage === "object" ? value.usage : value.usageMetadata && typeof value.usageMetadata === "object" ? value.usageMetadata : value;
  const providerRaw = safeText(value.provider || usage.provider || "custom");
  const providers = ["openai", "azure-openai", "anthropic", "google", "github-copilot", "custom"];
  const provider = (providers.includes(providerRaw) ? providerRaw : "custom") as UsageObservation["provider"];
  const observedAtRaw = safeText(value.observedAt || value.observed_at || value.timestamp, 80);
  const observedAt = strictTimestamp(observedAtRaw);
  if (!observedAt) throw new Error("Usage receipt requires a valid ISO observedAt timestamp.");
  const inputCandidate = usage.inputTokens ?? usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokens ?? usage.promptTokenCount;
  const directOutput = usage.outputTokens ?? usage.output_tokens ?? usage.completion_tokens ?? usage.completionTokens;
  const googlePrompt = integerOrNull(usage.promptTokenCount);
  const googleCandidates = integerOrNull(usage.candidatesTokenCount);
  const googleThoughts = integerOrNull(usage.thoughtsTokenCount);
  const googleTotal = integerOrNull(usage.totalTokenCount);
  const outputCandidate = directOutput ?? (googleCandidates != null || googleThoughts != null ? (googleCandidates || 0) + (googleThoughts || 0) : googleTotal != null && googlePrompt != null ? Math.max(0, googleTotal - googlePrompt) : undefined);
  const inputTokens = integerOrNull(inputCandidate);
  const outputTokens = integerOrNull(outputCandidate);
  if (inputCandidate != null && inputTokens == null) throw new Error("Usage receipt has invalid input tokens.");
  if (outputCandidate != null && outputTokens == null) throw new Error("Usage receipt has invalid output tokens.");
  const evidence = safeText(value.evidenceGrade || value.evidence_grade || "observed");
  const evidenceGrade = (evidence === "calculated" || evidence === "allocated" ? evidence : "observed") as UsageObservation["evidenceGrade"];
  const source = safeText(value.source || `${provider} usage receipt`, 500);
  const costUsd = finiteOrNull(value.costUsd ?? value.cost_usd ?? usage.cost);
  const businessValueUsd = finiteOrNull(value.businessValueUsd ?? value.business_value_usd);
  const rawToolCalls = value.toolCalls ?? value.tool_calls;
  const toolTelemetryObserved = Array.isArray(rawToolCalls);
  const toolCalls = normalizeToolCalls(rawToolCalls);
  if (inputTokens == null && outputTokens == null && costUsd == null && toolCalls.length === 0) {
    throw new Error("Receipt has no observable tokens, cost, or tool calls.");
  }
  const normalized = {
    id: safeText(value.id, 160) || `obs_${randomUUID()}`,
    correlationId: safeText(value.correlationId || value.correlation_id, 160) || null,
    observedAt,
    provider,
    modelId: safeText(value.modelId || value.model_id || value.model, 160) || null,
    repository: safeText(value.repository || repository) || "unassigned",
    project: safeText(value.project || project) || "unassigned",
    inputTokens,
    outputTokens,
    costUsd,
    businessValueUsd,
    toolTelemetryObserved,
    toolCalls,
    source,
    evidenceGrade,
  };
  const sourceDigest = digest({ ...normalized, id: undefined });
  const suppliedDigest = safeText(value.sourceDigest || value.source_digest, 128).toLowerCase();
  if (suppliedDigest) {
    if (!/^[a-f0-9]{64}$/.test(suppliedDigest) || !timingSafeEqual(Buffer.from(suppliedDigest), Buffer.from(sourceDigest))) {
      throw new Error("Supplied source digest does not match the normalized evidence record.");
    }
  }
  return { ...normalized, sourceDigest };
}

export function normalizeReceiptCollection(raw: unknown, repository?: string, project?: string): UsageObservation[] {
  const values: unknown[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as any).observations) ? (raw as any).observations : [raw];
  return values.map((value) => normalizeUsageReceipt(value, repository, project));
}

function percentile(values: number[], percentage: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentage * sorted.length) - 1))];
}

function range(values: number[], fallback: TokenRange): TokenRange {
  if (!values.length) return fallback;
  return normalizeRange({ low: percentile(values, 0.1), base: percentile(values, 0.5), high: percentile(values, 0.9) });
}

export function buildToolProfiles(observations: readonly UsageObservation[], repository?: string, modelId?: string): ToolProfile[] {
  const comparable = observations.filter((observation) => observation.toolTelemetryObserved && (!repository || observation.repository === repository) && (!modelId || observation.modelId === modelId));
  const executionCount = comparable.length;
  const names = new Set(comparable.flatMap((observation) => observation.toolCalls.map((call) => call.name)));
  return [...names].map((name) => {
    const matchingExecutions = comparable.filter((observation) => observation.toolCalls.some((call) => call.name === name));
    const calls = matchingExecutions.flatMap((observation) => observation.toolCalls.filter((call) => call.name === name));
    return {
      name,
      executions: executionCount,
      invocations: matchingExecutions.length,
      invocationRate: executionCount ? matchingExecutions.length / executionCount : null,
      calls: range(calls.map((call) => call.calls), { low: 0, base: 1, high: 2 }),
      argumentTokens: range(calls.flatMap((call) => call.argumentTokens == null ? [] : [call.argumentTokens]), { low: 0, base: 120, high: 600 }),
      resultTokens: range(calls.flatMap((call) => call.resultTokens == null ? [] : [call.resultTokens]), { low: 0, base: 350, high: 2_000 }),
      evidenceGrade: "calculated" as const,
    };
  }).sort((a, b) => (b.invocationRate || 0) - (a.invocationRate || 0));
}

export function reconcile(estimate: TokenOpsEstimate, observation: UsageObservation): ReconciliationResult {
  const predictedTools = estimate.selectedTools.map((tool) => tool.name);
  const actualTools = [...new Set(observation.toolCalls.map((tool) => tool.name))];
  return {
    estimateId: estimate.id,
    observationId: observation.id,
    inputDelta: observation.inputTokens == null ? null : observation.inputTokens - estimate.breakdown.totalInput.base,
    outputDelta: observation.outputTokens == null ? null : observation.outputTokens - estimate.breakdown.totalOutput.base,
    costDeltaUsd: observation.costUsd == null || estimate.costUsd == null ? null : observation.costUsd - estimate.costUsd.base,
    predictedTools,
    actualTools,
    correctTools: predictedTools.filter((tool) => actualTools.includes(tool)),
    missedTools: actualTools.filter((tool) => !predictedTools.includes(tool)),
    unusedTools: predictedTools.filter((tool) => !actualTools.includes(tool)),
    evidenceGrade: "calculated",
  };
}

export function summarizeFinOps(observations: readonly UsageObservation[], budgetUsd: number | null, now = new Date()): FinOpsSummary {
  const month = now.toISOString().slice(0, 7);
  const monthObservations = observations.filter((observation) => observation.observedAt.startsWith(month));
  const priced = monthObservations.filter((observation) => observation.costUsd != null);
  const actualCostUsd = priced.reduce((total, observation) => total + (observation.costUsd || 0), 0);
  const attributedValueUsd = monthObservations.reduce((total, observation) => total + (observation.businessValueUsd || 0), 0);
  const elapsedDays = Math.max(1, now.getUTCDate());
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const forecastCostUsd = priced.length ? actualCostUsd / elapsedDays * daysInMonth : null;
  const chargebackMap = new Map<string, { costUsd: number; observations: number }>();
  for (const observation of monthObservations) {
    const key = observation.project || observation.repository || "unassigned";
    const item = chargebackMap.get(key) || { costUsd: 0, observations: 0 };
    item.costUsd += observation.costUsd || 0;
    item.observations += 1;
    chargebackMap.set(key, item);
  }
  const recommendations: FinOpsSummary["recommendations"] = [];
  if (monthObservations.length - priced.length > 0) recommendations.push({ id: "price-coverage", title: "Close pricing evidence gaps", detail: `${monthObservations.length - priced.length} observation(s) cannot participate in cost, budget, or savings calculations. Import provider cost or a sourced rate-card allocation.`, projectedSavingsUsd: null, evidenceGrade: "observed" });
  if (budgetUsd != null && forecastCostUsd != null && forecastCostUsd > budgetUsd) recommendations.push({ id: "budget-overrun", title: "Investigate forecast budget overrun", detail: `Observed run rate projects ${((forecastCostUsd - budgetUsd) / Math.max(budgetUsd, 0.01) * 100).toFixed(1)}% above budget. Review the highest chargeback project and high-volume tool results before changing models.`, projectedSavingsUsd: forecastCostUsd - budgetUsd, evidenceGrade: "forecasted" });
  const largeToolResults = buildToolProfiles(monthObservations).filter((profile) => profile.resultTokens.high >= 2_000);
  if (largeToolResults.length) recommendations.push({ id: "tool-result-volume", title: "Bound high-volume tool results", detail: `${largeToolResults.slice(0, 3).map((profile) => profile.name).join(", ")} have observed or default P90 result ranges at or above 2,000 tokens. Add pagination, field projection, or result summarization and validate savings after execution.`, projectedSavingsUsd: null, evidenceGrade: largeToolResults.some((profile) => profile.invocations > 0) ? "calculated" : "estimated" });
  if (!monthObservations.length) recommendations.push({ id: "collect-evidence", title: "Collect actual usage evidence", detail: "Import provider or instrumented MCP receipts before making cost-optimization decisions. No savings claim is available from estimates alone.", projectedSavingsUsd: null, evidenceGrade: "unavailable" });
  return {
    month,
    actualCostUsd,
    budgetUsd,
    budgetConsumedPercent: budgetUsd != null && budgetUsd > 0 ? actualCostUsd / budgetUsd * 100 : null,
    forecastCostUsd,
    varianceUsd: budgetUsd != null && forecastCostUsd != null ? forecastCostUsd - budgetUsd : null,
    attributedValueUsd,
    roi: actualCostUsd > 0 ? (attributedValueUsd - actualCostUsd) / actualCostUsd : null,
    unpricedObservations: monthObservations.length - priced.length,
    chargeback: [...chargebackMap.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => b.costUsd - a.costUsd),
    recommendations,
    evidenceGrades: ["observed", "calculated", ...(forecastCostUsd == null ? [] : ["forecasted" as const])],
  };
}
