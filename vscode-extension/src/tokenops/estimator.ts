import { createHash, randomUUID } from "node:crypto";
import { getEncoding } from "js-tiktoken";
import type { ModelDefinition, EstimateInput, TokenOpsEstimate, TokenRange, ToolDefinition, ToolProfile, ToolSelection } from "./domain";
import { addRanges, multiplyRanges, normalizeRange, scalarRange, zeroRange } from "./domain";

const encodingCache = new Map<string, ReturnType<typeof getEncoding>>();
const stopWords = new Set(["this", "that", "with", "from", "into", "have", "will", "would", "could", "should", "about", "your", "their", "there", "then", "than", "when", "where", "what", "which", "using", "please"]);

function tokenizeTerms(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, " ").split(/\s+/).filter((word) => word.length >= 3 && !stopWords.has(word)));
}

export function countText(text: string, model: ModelDefinition): TokenRange {
  if (model.encoding) {
    let encoding = encodingCache.get(model.encoding);
    if (!encoding) {
      encoding = getEncoding(model.encoding);
      encodingCache.set(model.encoding, encoding);
    }
    return scalarRange(encoding.encode(text).length);
  }
  const characters = [...text].length;
  // Explicitly a provider-independent range, never labeled exact.
  return normalizeRange({
    low: Math.ceil(characters / 5),
    base: Math.ceil(characters / 4),
    high: Math.ceil(characters / 3),
  });
}

export function disposeTokenizers(): void {
  encodingCache.clear();
}

export function normalizeToolDefinitions(rawTools: readonly unknown[], model: ModelDefinition): ToolDefinition[] {
  return rawTools.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const value = raw as { name?: unknown; description?: unknown; inputSchema?: unknown; tags?: unknown };
    const name = String(value.name || "").trim();
    if (!name) return [];
    const description = String(value.description || "");
    const inputSchema = value.inputSchema ?? {};
    const tags = Array.isArray(value.tags) ? value.tags.map(String) : [];
    const definitionText = JSON.stringify({ name, description, inputSchema });
    return [{ name, description, inputSchema, tags, definitionText, definitionTokens: countText(definitionText, model) }];
  });
}

function similarity(prompt: Set<string>, tool: ToolDefinition): number {
  if (!prompt.size) return 0;
  const terms = tokenizeTerms(`${tool.name.replace(/[_-]/g, " ")} ${tool.description}`);
  let overlap = 0;
  for (const term of prompt) if (terms.has(term)) overlap += 1;
  const name = tool.name.toLowerCase();
  for (const term of prompt) if (name.includes(term)) overlap += 1.5;
  return Math.min(0.9, overlap / Math.max(3, Math.sqrt(prompt.size * Math.max(terms.size, 1))));
}

function defaultCalls(likelihood: number): TokenRange {
  if (likelihood >= 0.65) return { low: 0, base: 1, high: 3 };
  if (likelihood >= 0.35) return { low: 0, base: 1, high: 2 };
  return { low: 0, base: 0, high: 1 };
}

function profileFor(name: string, profiles: readonly ToolProfile[]): ToolProfile | undefined {
  return profiles.find((profile) => profile.name === name);
}

function selection(tool: ToolDefinition, source: ToolSelection["likelihoodSource"], likelihood: number | null, profile?: ToolProfile): ToolSelection {
  return {
    name: tool.name,
    reason: source === "historical" ? "Observed in comparable local executions" : source === "prompt-similarity" ? "Name/description overlaps visible prompt" : source === "manual" ? "Selected by user" : "All registered definitions scenario",
    likelihood,
    likelihoodSource: source,
    calls: profile?.calls || defaultCalls(likelihood ?? (source === "all" ? 1 : 0.5)),
    definitionTokens: tool.definitionTokens,
    argumentTokens: profile?.argumentTokens || { low: 0, base: 120, high: 600 },
    resultTokens: profile?.resultTokens || { low: 0, base: 350, high: 2_000 },
  };
}

export function selectTools(input: EstimateInput, tools: readonly ToolDefinition[], profiles: readonly ToolProfile[]): ToolSelection[] {
  if (input.scenario === "none") return [];
  if (input.scenario === "manual") {
    const selected = new Set(input.selectedTools);
    return tools.filter((tool) => selected.has(tool.name)).map((tool) => selection(tool, "manual", null, profileFor(tool.name, profiles)));
  }
  if (input.scenario === "all") return tools.map((tool) => selection(tool, "all", 1, profileFor(tool.name, profiles)));
  const terms = tokenizeTerms(input.text);
  return tools.map((tool) => {
    const profile = profileFor(tool.name, profiles);
    const semantic = similarity(terms, tool);
    const historical = profile?.invocationRate;
    const likelihood = historical == null ? semantic : Math.min(0.98, historical * 0.7 + semantic * 0.3);
    return { tool, profile, likelihood, source: historical == null ? "prompt-similarity" as const : "historical" as const };
  }).filter((candidate) => candidate.likelihood >= 0.18).sort((a, b) => b.likelihood - a.likelihood).slice(0, 12)
    .map(({ tool, profile, likelihood, source }) => selection(tool, source, likelihood, profile));
}

function sumToolRanges(tools: readonly ToolSelection[], field: "definitionTokens" | "argumentTokens" | "resultTokens"): TokenRange {
  return tools.reduce((total, tool) => addRanges(total, field === "definitionTokens" ? tool[field] : multiplyRanges(tool.calls, tool[field])), zeroRange());
}

function priceRange(inputTokens: TokenRange, outputTokens: TokenRange, model: ModelDefinition, fallbackInputRate?: number, fallbackOutputRate?: number): TokenRange | null {
  const fallbackInput = Number(fallbackInputRate);
  const fallbackOutput = Number(fallbackOutputRate);
  const inputRate = model.price.inputPerMillion ?? (Number.isFinite(fallbackInput) && fallbackInput >= 0 && fallbackInput <= 1_000_000 ? fallbackInput : null);
  const outputRate = model.price.outputPerMillion ?? (Number.isFinite(fallbackOutput) && fallbackOutput >= 0 && fallbackOutput <= 1_000_000 ? fallbackOutput : null);
  if (inputRate == null || outputRate == null) return null;
  return {
    low: inputTokens.low * inputRate / 1_000_000 + outputTokens.low * outputRate / 1_000_000,
    base: inputTokens.base * inputRate / 1_000_000 + outputTokens.base * outputRate / 1_000_000,
    high: inputTokens.high * inputRate / 1_000_000 + outputTokens.high * outputRate / 1_000_000,
  };
}

export function estimateUsage(input: EstimateInput, model: ModelDefinition, tools: readonly ToolDefinition[], profiles: readonly ToolProfile[], now = new Date()): TokenOpsEstimate {
  const visiblePrompt = countText(input.text, model);
  const framing = input.text ? { low: 3, base: 6, high: 15 } : zeroRange();
  const selectedTools = selectTools(input, tools, profiles);
  const toolDefinitions = sumToolRanges(selectedTools, "definitionTokens");
  const toolArguments = sumToolRanges(selectedTools, "argumentTokens");
  const toolResults = sumToolRanges(selectedTools, "resultTokens");
  const finalResponse = normalizeRange(input.outputTokens, 2_000_000);
  const mcpConfiguration = normalizeRange(input.mcpConfigurationTokens, 2_000_000);
  const totalInput = addRanges(visiblePrompt, framing, mcpConfiguration, toolDefinitions, toolResults);
  const totalOutput = addRanges(toolArguments, finalResponse);
  const totalTokens = addRanges(totalInput, totalOutput);
  const costUsd = priceRange(totalInput, totalOutput, model, input.fallbackInputRate, input.fallbackOutputRate);
  return {
    id: `est_${randomUUID()}`,
    createdAt: now.toISOString(),
    model,
    scenario: input.scenario,
    selectedTools,
    breakdown: { visiblePrompt, framing, mcpConfiguration, toolDefinitions, toolResults, toolArguments, finalResponse, totalInput, totalOutput, totalTokens },
    costUsd,
    tokenMethod: model.tokenMethod,
    evidenceGrade: "estimated",
    hiddenCopilotContext: null,
    limitations: [
      "Tool likelihood is a scenario derived from visible metadata and local history, not a claim that Copilot will call a tool.",
      "Tool arguments, results and final response are ranges until an instrumented execution provides observations.",
      "Copilot system prompts, retrieval, reasoning, truncation and private orchestration are unavailable to extensions.",
    ],
  };
}

export function estimateFingerprint(estimate: TokenOpsEstimate): string {
  return createHash("sha256").update(JSON.stringify({ model: estimate.model.id, scenario: estimate.scenario, breakdown: estimate.breakdown, tools: estimate.selectedTools.map((tool) => tool.name) })).digest("hex");
}
