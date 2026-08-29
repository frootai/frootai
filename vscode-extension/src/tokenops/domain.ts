export type EvidenceGrade = "observed" | "calculated" | "allocated" | "estimated" | "forecasted" | "unavailable";
export type ProviderId = "openai" | "azure-openai" | "anthropic" | "google" | "github-copilot" | "custom";
export type EncodingName = "o200k_base" | "cl100k_base";
export type ToolScenario = "none" | "likely" | "manual" | "all";

export interface PriceDefinition {
  inputPerMillion: number | null;
  outputPerMillion: number | null;
  currency: "USD";
  source: string | null;
  asOf: string | null;
}

export interface ModelDefinition {
  id: string;
  provider: ProviderId;
  displayName: string;
  encoding: EncodingName | null;
  tokenMethod: "exact-tiktoken" | "provider-estimate";
  contextWindow: number | null;
  price: PriceDefinition;
  notes: string;
}

export interface TokenRange {
  low: number;
  base: number;
  high: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
  tags: string[];
  definitionText: string;
  definitionTokens: TokenRange;
}

export interface ToolProfile {
  name: string;
  executions: number;
  invocations: number;
  invocationRate: number | null;
  calls: TokenRange;
  argumentTokens: TokenRange;
  resultTokens: TokenRange;
  evidenceGrade: EvidenceGrade;
}

export interface ToolSelection {
  name: string;
  reason: string;
  likelihood: number | null;
  likelihoodSource: "historical" | "prompt-similarity" | "manual" | "all";
  calls: TokenRange;
  definitionTokens: TokenRange;
  argumentTokens: TokenRange;
  resultTokens: TokenRange;
}

export interface EstimateInput {
  text: string;
  modelId: string;
  scenario: ToolScenario;
  selectedTools: string[];
  outputTokens: TokenRange;
  mcpConfigurationTokens: TokenRange;
  fallbackInputRate?: number;
  fallbackOutputRate?: number;
}

export interface EstimateBreakdown {
  visiblePrompt: TokenRange;
  framing: TokenRange;
  mcpConfiguration: TokenRange;
  toolDefinitions: TokenRange;
  toolResults: TokenRange;
  toolArguments: TokenRange;
  finalResponse: TokenRange;
  totalInput: TokenRange;
  totalOutput: TokenRange;
  totalTokens: TokenRange;
}

export interface TokenOpsEstimate {
  id: string;
  createdAt: string;
  model: ModelDefinition;
  scenario: ToolScenario;
  selectedTools: ToolSelection[];
  breakdown: EstimateBreakdown;
  costUsd: TokenRange | null;
  tokenMethod: ModelDefinition["tokenMethod"];
  evidenceGrade: "estimated";
  hiddenCopilotContext: null;
  limitations: string[];
}

export interface ToolCallObservation {
  name: string;
  calls: number;
  argumentTokens: number | null;
  resultTokens: number | null;
}

export interface UsageObservation {
  id: string;
  correlationId: string | null;
  observedAt: string;
  provider: ProviderId;
  modelId: string | null;
  repository: string;
  project: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  businessValueUsd: number | null;
  toolTelemetryObserved: boolean;
  toolCalls: ToolCallObservation[];
  source: string;
  evidenceGrade: "observed" | "calculated" | "allocated";
  sourceDigest: string;
}

export interface ReconciliationResult {
  estimateId: string;
  observationId: string;
  inputDelta: number | null;
  outputDelta: number | null;
  costDeltaUsd: number | null;
  predictedTools: string[];
  actualTools: string[];
  correctTools: string[];
  missedTools: string[];
  unusedTools: string[];
  evidenceGrade: "calculated";
}

export interface GithubCopilotDay {
  date: string;
  totalActiveUsers: number;
  totalEngagedUsers: number | null;
  codeCompletionsEngagedUsers: number | null;
  chatEngagedUsers: number | null;
  interactions: number;
  codeGenerations: number;
  codeAcceptances: number;
  surfacedInputTokens: number | null;
  surfacedOutputTokens: number | null;
}

export interface GithubCopilotUsage {
  status: "not-configured" | "ready" | "unavailable" | "forbidden" | "failed";
  organization: string | null;
  days: GithubCopilotDay[];
  asOf: string | null;
  source: string;
  detail: string;
  evidenceGrade: EvidenceGrade;
}

export interface FinOpsSummary {
  month: string;
  actualCostUsd: number;
  budgetUsd: number | null;
  budgetConsumedPercent: number | null;
  forecastCostUsd: number | null;
  varianceUsd: number | null;
  attributedValueUsd: number;
  roi: number | null;
  unpricedObservations: number;
  chargeback: Array<{ key: string; costUsd: number; observations: number }>;
  recommendations: Array<{ id: string; title: string; detail: string; projectedSavingsUsd: number | null; evidenceGrade: EvidenceGrade }>;
  evidenceGrades: EvidenceGrade[];
}

export const zeroRange = (): TokenRange => ({ low: 0, base: 0, high: 0 });
export const scalarRange = (value: number): TokenRange => ({ low: value, base: value, high: value });
export const addRanges = (...ranges: TokenRange[]): TokenRange => ranges.reduce((sum, range) => ({
  low: sum.low + range.low,
  base: sum.base + range.base,
  high: sum.high + range.high,
}), zeroRange());
export const multiplyRanges = (a: TokenRange, b: TokenRange): TokenRange => ({
  low: a.low * b.low,
  base: a.base * b.base,
  high: a.high * b.high,
});
export const normalizeRange = (value: Partial<TokenRange> | number, maximum = 2_000_000): TokenRange => {
  const source = typeof value === "number" ? { low: value, base: value, high: value } : value;
  const clamp = (item: unknown): number => Math.min(maximum, Math.max(0, Math.round(Number(item) || 0)));
  const base = clamp(source.base);
  const low = Math.min(base, clamp(source.low ?? base));
  const high = Math.max(base, clamp(source.high ?? base));
  return { low, base, high };
};
