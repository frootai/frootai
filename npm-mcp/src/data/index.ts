/**
 * Static data constants — typed, importable, testable.
 * Extracted from the monolith so they can be tested and swapped independently.
 */

import type { PlayData, Complexity } from '../types/index.js';

// ── Model Catalog ──────────────────────────────────────────────────

export interface ModelInfo {
  name: string;
  category: 'gpt' | 'embedding' | 'image' | 'speech';
  context: string;
  pricing: string;
  speed: string;
  quality: string;
  bestFor: string;
}

export const MODEL_CATALOG: ModelInfo[] = [
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

// ── Azure Service Pricing ──────────────────────────────────────────

export interface ServicePricing {
  dev: number;
  prod: number;
  unit: string;
}

export const AZURE_PRICING: Record<string, ServicePricing> = {
  'OpenAI (gpt-4o)': { dev: 30, prod: 300, unit: '/mo (est. tokens)' },
  'OpenAI (gpt-4o-mini)': { dev: 5, prod: 50, unit: '/mo (est. tokens)' },
  'AI Search': { dev: 0, prod: 250, unit: '/mo (S1)' },
  'Container App': { dev: 0, prod: 50, unit: '/mo (consumption)' },
  'App Service (B1)': { dev: 13, prod: 55, unit: '/mo (B1/S1)' },
  'Blob Storage': { dev: 1, prod: 20, unit: '/mo (LRS)' },
  'Cosmos DB': { dev: 0, prod: 25, unit: '/mo (serverless)' },
  'Key Vault': { dev: 0, prod: 5, unit: '/mo' },
  'VNet + PE': { dev: 8, prod: 50, unit: '/mo (PE + hours)' },
  'Firewall': { dev: 0, prod: 900, unit: '/mo (Standard)' },
  'NAT Gateway': { dev: 0, prod: 45, unit: '/mo + data' },
  'Redis Cache': { dev: 0, prod: 55, unit: '/mo (C1)' },
  'Communication Services': { dev: 0, prod: 30, unit: '/mo (PSTN + usage)' },
  'Speech Service': { dev: 0, prod: 25, unit: '/mo (S0)' },
  'Content Safety': { dev: 0, prod: 15, unit: '/mo (S0)' },
  'Document Intelligence': { dev: 0, prod: 50, unit: '/mo (S0)' },
  'AKS (GPU)': { dev: 200, prod: 1200, unit: '/mo (NC-series)' },
  'ACR': { dev: 5, prod: 50, unit: '/mo (Basic/Standard)' },
  'ML Workspace': { dev: 0, prod: 50, unit: '/mo (compute)' },
  'APIM': { dev: 0, prod: 350, unit: '/mo (Standard v2)' },
  'Log Analytics': { dev: 0, prod: 50, unit: '/mo (5GB/day)' },
  'App Insights': { dev: 0, prod: 25, unit: '/mo (5GB/mo)' },
  'IoT Hub': { dev: 0, prod: 25, unit: '/mo (S1)' },
  'Event Hub': { dev: 11, prod: 90, unit: '/mo (Standard)' },
  'Stream Analytics': { dev: 0, prod: 80, unit: '/mo (1 SU)' },
  'Static Web Apps': { dev: 0, prod: 9, unit: '/mo (Standard)' },
  'Playwright': { dev: 0, prod: 0, unit: 'OSS (self-hosted)' },
  'Service Bus': { dev: 0, prod: 10, unit: '/mo (Standard)' },
};

// ── Architecture Patterns ──────────────────────────────────────────

export const ARCHITECTURE_PATTERNS = [
  'rag_pipeline', 'agent_hosting', 'model_selection',
  'cost_optimization', 'deterministic_ai', 'multi_agent', 'fine_tuning_decision',
] as const;

export type ArchitecturePattern = typeof ARCHITECTURE_PATTERNS[number];

// ── External MCP Servers Registry ──────────────────────────────────

export const EXTERNAL_MCP_SERVERS: Record<string, { name: string; desc: string }> = {
  github: { name: '@modelcontextprotocol/server-github', desc: 'GitHub repos, issues, PRs' },
  filesystem: { name: '@modelcontextprotocol/server-filesystem', desc: 'Local file system access' },
  postgres: { name: '@modelcontextprotocol/server-postgres', desc: 'PostgreSQL database queries' },
  slack: { name: '@modelcontextprotocol/server-slack', desc: 'Slack channels and messages' },
  memory: { name: '@modelcontextprotocol/server-memory', desc: 'Persistent memory for agents' },
  puppeteer: { name: '@modelcontextprotocol/server-puppeteer', desc: 'Browser automation' },
  azure: { name: 'frootai-mcp', desc: 'AI architecture knowledge for Azure (this server!)' },
  brave: { name: '@modelcontextprotocol/server-brave-search', desc: 'Web search via Brave' },
};
