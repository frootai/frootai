import type { PlayData, CostEstimate, ServicePricing } from '../types/index.js';

export interface ModelInfo {
  name: string;
  category: 'gpt' | 'embedding' | 'image' | 'speech';
  context: string;
  pricing: string;
  speed: string;
  quality: string;
  bestFor: string;
}

export interface PricingScenario {
  scenario: 'rag' | 'agent' | 'batch' | 'realtime' | 'custom';
  scale: 'dev' | 'staging' | 'production';
}

const MODEL_CATALOG: ModelInfo[] = [
  { name: 'gpt-4o', category: 'gpt', context: '128K', pricing: '$2.50/1M input, $10/1M output', speed: 'Fast', quality: 'Highest', bestFor: 'Complex reasoning, multi-modal, production agents' },
  { name: 'gpt-4o-mini', category: 'gpt', context: '128K', pricing: '$0.15/1M input, $0.60/1M output', speed: 'Very Fast', quality: 'Good', bestFor: 'High-volume, cost-sensitive, simple tasks' },
  { name: 'gpt-4.1', category: 'gpt', context: '1M', pricing: '$2.00/1M input, $8.00/1M output', speed: 'Fast', quality: 'Highest', bestFor: 'Long-context analysis, coding, complex instructions' },
  { name: 'gpt-4.1-mini', category: 'gpt', context: '1M', pricing: '$0.40/1M input, $1.60/1M output', speed: 'Very Fast', quality: 'Good', bestFor: 'Long-context at lower cost, balanced workloads' },
  { name: 'gpt-4.1-nano', category: 'gpt', context: '1M', pricing: '$0.10/1M input, $0.40/1M output', speed: 'Fastest', quality: 'Basic', bestFor: 'Classification, extraction, high-throughput' },
  { name: 'o3', category: 'gpt', context: '200K', pricing: '$10/1M input, $40/1M output', speed: 'Slower (thinks)', quality: 'Exceptional', bestFor: 'Hard reasoning, math, science, code review' },
  { name: 'o4-mini', category: 'gpt', context: '200K', pricing: '$1.10/1M input, $4.40/1M output', speed: 'Medium', quality: 'Very Good', bestFor: 'Reasoning at scale, STEM, analysis' },
  { name: 'text-embedding-3-large', category: 'embedding', context: '8K', pricing: '$0.13/1M tokens', speed: 'Fast', quality: 'Best', bestFor: 'RAG, semantic search, document similarity' },
  { name: 'text-embedding-3-small', category: 'embedding', context: '8K', pricing: '$0.02/1M tokens', speed: 'Fast', quality: 'Good', bestFor: 'Cost-effective embeddings, basic search' },
  { name: 'dall-e-3', category: 'image', context: 'N/A', pricing: '$0.04-0.12/image', speed: 'Medium', quality: 'High', bestFor: 'Image generation, creative content' },
  { name: 'whisper', category: 'speech', context: 'N/A', pricing: '$0.006/minute', speed: 'Fast', quality: 'High', bestFor: 'Speech-to-text, transcription' },
  { name: 'tts-1-hd', category: 'speech', context: 'N/A', pricing: '$0.03/1K chars', speed: 'Fast', quality: 'High', bestFor: 'Text-to-speech, voice assistants' },
];

const AZURE_PRICING_ESTIMATES: Record<string, Record<string, { monthly: string; breakdown: string }>> = {
  rag: {
    dev: { monthly: '$150-300', breakdown: 'OpenAI: $50, AI Search: $75 (Basic), Container App: $25, Storage: $5' },
    staging: { monthly: '$500-1,200', breakdown: 'OpenAI: $200, AI Search: $250 (Standard), Container App: $100, Storage: $20, App Insights: $30' },
    production: { monthly: '$2,000-8,000', breakdown: 'OpenAI: $1,000-5,000, AI Search: $500 (Standard S2+), Container App: $200, Storage: $50, App Insights: $100, Front Door: $100' },
  },
  agent: {
    dev: { monthly: '$100-250', breakdown: 'OpenAI: $80, Container App: $25, Cosmos DB: $25 (serverless)' },
    staging: { monthly: '$400-1,000', breakdown: 'OpenAI: $300, Container App: $100, Cosmos DB: $100, Service Bus: $25' },
    production: { monthly: '$1,500-6,000', breakdown: 'OpenAI: $1,000-4,000, Container App: $300, Cosmos DB: $300, Service Bus: $50, App Insights: $100' },
  },
  batch: {
    dev: { monthly: '$50-150', breakdown: 'OpenAI (batch API -50%): $30, Storage: $10, Functions: $5' },
    staging: { monthly: '$200-500', breakdown: 'OpenAI (batch): $150, Storage: $30, Functions: $20' },
    production: { monthly: '$500-3,000', breakdown: 'OpenAI (batch -50%): $300-2,000, Storage: $100, Functions: $50, Data Factory: $50' },
  },
  realtime: {
    dev: { monthly: '$200-400', breakdown: 'OpenAI: $100, Communication Services: $50, Speech: $30, Container App: $25' },
    staging: { monthly: '$600-1,500', breakdown: 'OpenAI: $400, Communication Services: $150, Speech: $100, Container App: $100' },
    production: { monthly: '$2,500-10,000', breakdown: 'OpenAI: $1,500-6,000, Communication Services: $500, Speech: $300, Container App: $300, Front Door: $100' },
  },
  custom: {
    dev: { monthly: '$100-300', breakdown: 'Varies by architecture. Use Azure Pricing Calculator for specifics.' },
    staging: { monthly: '$300-1,000', breakdown: 'Varies. Key drivers: model choice, request volume, storage.' },
    production: { monthly: '$1,000-10,000+', breakdown: 'Varies. Optimize with: PTU commitments, batch API, caching, model downsizing.' },
  },
};

const SERVICE_PRICING: Record<string, ServicePricing> = {
  'AI Search': { dev: 75, prod: 500, unit: 'Basic/Standard S1' },
  'OpenAI (gpt-4o)': { dev: 50, prod: 2000, unit: '~100K/1M req/mo' },
  'OpenAI (gpt-4o-mini)': { dev: 10, prod: 200, unit: '~100K/1M req/mo' },
  'Container App': { dev: 15, prod: 150, unit: '1vCPU/4vCPU' },
  'App Service (B1)': { dev: 13, prod: 55, unit: 'B1/S1' },
  'Cosmos DB': { dev: 25, prod: 300, unit: '400/4000 RU/s' },
  'AKS (GPU)': { dev: 200, prod: 2000, unit: 'NC6s/NC12s' },
  'ML Workspace': { dev: 50, prod: 500, unit: 'Compute+storage' },
  'VNet + PE': { dev: 10, prod: 50, unit: 'PE+NSG' },
  'Firewall': { dev: 0, prod: 500, unit: 'Premium' },
  'Key Vault': { dev: 1, prod: 5, unit: 'Standard' },
  'APIM': { dev: 50, prod: 300, unit: 'Dev/Standard' },
  'Redis Cache': { dev: 15, prod: 100, unit: 'C1/C3' },
  'Event Hub': { dev: 10, prod: 150, unit: 'Basic/Standard' },
  'Stream Analytics': { dev: 50, prod: 300, unit: '1/6 SU' },
  'Log Analytics': { dev: 10, prod: 100, unit: '5/50 GB/day' },
  'App Insights': { dev: 5, prod: 50, unit: 'Basic' },
  'Blob Storage': { dev: 5, prod: 50, unit: 'LRS Hot' },
  'Communication Services': { dev: 20, prod: 500, unit: 'Voice+SMS' },
  'Speech Service': { dev: 15, prod: 200, unit: 'S0' },
  'Document Intelligence': { dev: 15, prod: 150, unit: 'S0' },
  'Content Safety': { dev: 10, prod: 50, unit: 'S0' },
  'IoT Hub': { dev: 10, prod: 100, unit: 'S1' },
  'ACR': { dev: 5, prod: 50, unit: 'Basic/Standard' },
  'NAT Gateway': { dev: 0, prod: 30, unit: 'Standard' },
};

/**
 * Get all models, optionally filtered by category.
 * Returns the full model info including pricing, speed, and quality.
 */
export function getModelCatalog(category?: string): ModelInfo[] {
  if (!category || category === 'all') return [...MODEL_CATALOG];
  return MODEL_CATALOG.filter(m => m.category === category);
}

/**
 * Estimate Azure pricing for a scenario at a given scale.
 * Returns monthly cost range and per-service breakdown string.
 */
export function estimateAzurePricing(
  scenario: PricingScenario
): { monthly: string; breakdown: string } {
  const estimates = AZURE_PRICING_ESTIMATES[scenario.scenario] ?? AZURE_PRICING_ESTIMATES.custom;
  return estimates[scenario.scale] ?? estimates.production;
}

/**
 * Compare models side-by-side for a specific use case and priority.
 * Returns the recommended primary/secondary models with reasoning.
 */
export function compareModels(
  useCase: string,
  priority: 'cost' | 'quality' | 'speed' | 'context' = 'quality'
): { recommended: string; comparison: ModelInfo[] } {
  const recommendations: Record<string, { primary: string; secondary: string; reasoning: string }> = {
    cost: { primary: 'gpt-4o-mini', secondary: 'gpt-4.1-nano', reasoning: 'Lowest cost per token while maintaining acceptable quality. Use mini for most tasks, nano for high-throughput classification.' },
    quality: { primary: 'gpt-4o', secondary: 'gpt-4.1', reasoning: 'Highest quality output. Use 4o for multi-modal, 4.1 for long-context. Add o3 for tasks requiring deep reasoning.' },
    speed: { primary: 'gpt-4o-mini', secondary: 'gpt-4.1-nano', reasoning: 'Fastest response times. Mini has best latency-to-quality ratio. Nano for sub-100ms responses.' },
    context: { primary: 'gpt-4.1', secondary: 'gpt-4.1-mini', reasoning: '1M token context window. Process entire codebases, long documents, or complex multi-turn conversations.' },
  };

  const rec = recommendations[priority];
  const primaryModel = MODEL_CATALOG.find(m => m.name === rec.primary);
  const secondaryModel = MODEL_CATALOG.find(m => m.name === rec.secondary);

  const comparison = [primaryModel, secondaryModel].filter((m): m is ModelInfo => m != null);

  return {
    recommended: `${rec.primary} (primary), ${rec.secondary} (alternative). ${rec.reasoning}`,
    comparison,
  };
}

/**
 * Estimate cost for a specific solution play at dev or prod scale.
 * Uses per-service pricing to compute an itemized breakdown.
 * Returns null if the play is not found.
 */
export function estimatePlayCost(
  playId: string,
  scale: 'dev' | 'prod',
  plays: PlayData[]
): CostEstimate | null {
  const num = playId.padStart(2, '0');
  const play = plays.find(p => p.id === num);
  if (!play) return null;

  let total = 0;
  const services: Array<{ name: string; cost: number; unit: string }> = [];

  for (const svc of play.services) {
    const pr = SERVICE_PRICING[svc] ?? { dev: 0, prod: 0, unit: '?' };
    const cost = scale === 'prod' ? pr.prod : pr.dev;
    total += cost;
    services.push({ name: svc, cost, unit: pr.unit });
  }

  return { play, scale, services, total };
}
