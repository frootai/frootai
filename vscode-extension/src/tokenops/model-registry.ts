import type { EncodingName, ModelDefinition, ProviderId } from "./domain";

const unpriced = () => ({ inputPerMillion: null, outputPerMillion: null, currency: "USD" as const, source: null, asOf: null });

/**
 * Built-ins describe tokenization capability, not an assertion that a provider model is currently available.
 * Prices are deliberately absent: provider prices change independently of extension releases and must be
 * supplied by an administrator with source/as-of provenance.
 */
export const BUILT_IN_MODELS: readonly ModelDefinition[] = Object.freeze([
  { id: "openai:gpt-5", provider: "openai", displayName: "OpenAI GPT-5 family", encoding: "o200k_base", tokenMethod: "exact-tiktoken", contextWindow: null, price: unpriced(), notes: "Exact visible-text encoding; deployment limits and price are configurable." },
  { id: "openai:gpt-4.1", provider: "openai", displayName: "OpenAI GPT-4.1 family", encoding: "o200k_base", tokenMethod: "exact-tiktoken", contextWindow: null, price: unpriced(), notes: "Exact visible-text encoding; model-specific framing can vary." },
  { id: "openai:gpt-4o", provider: "openai", displayName: "OpenAI GPT-4o family", encoding: "o200k_base", tokenMethod: "exact-tiktoken", contextWindow: null, price: unpriced(), notes: "o200k_base is an encoding shared by multiple model families." },
  { id: "openai:gpt-4", provider: "openai", displayName: "OpenAI GPT-4 / 3.5 family", encoding: "cl100k_base", tokenMethod: "exact-tiktoken", contextWindow: null, price: unpriced(), notes: "Legacy cl100k_base-compatible models." },
  { id: "azure-openai:deployment", provider: "azure-openai", displayName: "Azure OpenAI deployment", encoding: "o200k_base", tokenMethod: "exact-tiktoken", contextWindow: null, price: unpriced(), notes: "Configure deployment-specific encoding, context limit, and Azure price provenance." },
  { id: "anthropic:claude-opus", provider: "anthropic", displayName: "Anthropic Claude Opus family", encoding: null, tokenMethod: "provider-estimate", contextWindow: null, price: unpriced(), notes: "Range estimate only; exact Anthropic tokenizer is not bundled." },
  { id: "anthropic:claude-sonnet", provider: "anthropic", displayName: "Anthropic Claude Sonnet family", encoding: null, tokenMethod: "provider-estimate", contextWindow: null, price: unpriced(), notes: "Range estimate only; reconcile with provider usage." },
  { id: "anthropic:claude-haiku", provider: "anthropic", displayName: "Anthropic Claude Haiku family", encoding: null, tokenMethod: "provider-estimate", contextWindow: null, price: unpriced(), notes: "Range estimate only; reconcile with provider usage." },
  { id: "google:gemini-pro", provider: "google", displayName: "Google Gemini Pro family", encoding: null, tokenMethod: "provider-estimate", contextWindow: null, price: unpriced(), notes: "Range estimate only; exact Google tokenizer is not bundled." },
  { id: "google:gemini-flash", provider: "google", displayName: "Google Gemini Flash family", encoding: null, tokenMethod: "provider-estimate", contextWindow: null, price: unpriced(), notes: "Range estimate only; reconcile with provider usage." },
  { id: "github-copilot:selected", provider: "github-copilot", displayName: "GitHub Copilot selected model", encoding: null, tokenMethod: "provider-estimate", contextWindow: null, price: unpriced(), notes: "Copilot model, hidden prompt and routing are not exposed by supported VS Code APIs." },
  { id: "custom:model", provider: "custom", displayName: "Custom model", encoding: null, tokenMethod: "provider-estimate", contextWindow: null, price: unpriced(), notes: "Configure a provider-authoritative model definition." },
]);

export interface ModelOverride {
  id: string;
  provider?: ProviderId;
  displayName?: string;
  encoding?: EncodingName | null;
  contextWindow?: number | null;
  inputPerMillion?: number | null;
  outputPerMillion?: number | null;
  priceSource?: string | null;
  priceAsOf?: string | null;
  notes?: string;
}

function validRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1_000_000 ? rate : null;
}

function validContextWindow(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const limit = Math.round(Number(value));
  return Number.isFinite(limit) && limit > 0 && limit <= 100_000_000 ? limit : null;
}

function safeProvider(value: unknown): ProviderId {
  const providers: ProviderId[] = ["openai", "azure-openai", "anthropic", "google", "github-copilot", "custom"];
  return providers.includes(value as ProviderId) ? value as ProviderId : "custom";
}

function safeEncoding(value: unknown): EncodingName | null {
  return value === "o200k_base" || value === "cl100k_base" ? value : null;
}

export function buildModelRegistry(rawOverrides: unknown): ModelDefinition[] {
  const registry = new Map(BUILT_IN_MODELS.map((model) => [model.id, structuredClone(model)]));
  if (!Array.isArray(rawOverrides)) return [...registry.values()];
  for (const candidate of rawOverrides) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const override = candidate as Record<string, unknown>;
    const id = String(override.id || "").trim().slice(0, 160);
    if (!id) continue;
    const existing = registry.get(id);
    const encoding = override.encoding === undefined ? existing?.encoding ?? null : safeEncoding(override.encoding);
    const provider = override.provider === undefined ? existing?.provider ?? "custom" : safeProvider(override.provider);
    const source = override.priceSource == null ? existing?.price.source ?? null : String(override.priceSource).trim().slice(0, 500) || null;
    const asOfCandidate = override.priceAsOf == null ? existing?.price.asOf ?? null : String(override.priceAsOf).trim();
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(asOfCandidate || "") ? asOfCandidate : null;
    const inputPerMillion = override.inputPerMillion === undefined ? existing?.price.inputPerMillion ?? null : validRate(override.inputPerMillion);
    const outputPerMillion = override.outputPerMillion === undefined ? existing?.price.outputPerMillion ?? null : validRate(override.outputPerMillion);
    const hasPriceProvenance = Boolean(source && asOf);
    registry.set(id, {
      id,
      provider,
      displayName: String(override.displayName || existing?.displayName || id).trim().slice(0, 160),
      encoding,
      tokenMethod: encoding ? "exact-tiktoken" : "provider-estimate",
      contextWindow: override.contextWindow === undefined ? existing?.contextWindow ?? null : validContextWindow(override.contextWindow),
      price: {
        inputPerMillion: hasPriceProvenance ? inputPerMillion : null,
        outputPerMillion: hasPriceProvenance ? outputPerMillion : null,
        currency: "USD",
        source,
        asOf,
      },
      notes: String(override.notes || existing?.notes || "Administrator-defined model.").trim().slice(0, 500),
    });
  }
  return [...registry.values()];
}

export function findModel(registry: readonly ModelDefinition[], modelId: string): ModelDefinition {
  return registry.find((model) => model.id === modelId) || registry[0] || structuredClone(BUILT_IN_MODELS[0]);
}
