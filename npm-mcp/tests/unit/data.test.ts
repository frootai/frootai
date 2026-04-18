import { describe, it, expect } from 'vitest';
import {
  MODEL_CATALOG,
  AZURE_PRICING,
  ARCHITECTURE_PATTERNS,
  EXTERNAL_MCP_SERVERS,
  type ModelInfo,
} from '../../src/data/index.js';

describe('MODEL_CATALOG', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(MODEL_CATALOG)).toBe(true);
    expect(MODEL_CATALOG.length).toBeGreaterThanOrEqual(10);
  });

  it('every model has required fields', () => {
    for (const m of MODEL_CATALOG) {
      expect(m.name).toBeTruthy();
      expect(m.category).toBeTruthy();
      expect(m.context).toBeTruthy();
      expect(m.pricing).toBeTruthy();
      expect(m.speed).toBeTruthy();
      expect(m.quality).toBeTruthy();
      expect(m.bestFor).toBeTruthy();
    }
  });

  it('model names are unique', () => {
    const names = MODEL_CATALOG.map(m => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('includes gpt-4o and gpt-4o-mini', () => {
    const names = MODEL_CATALOG.map(m => m.name);
    expect(names).toContain('gpt-4o');
    expect(names).toContain('gpt-4o-mini');
  });

  it('has all 4 categories represented', () => {
    const categories = new Set(MODEL_CATALOG.map(m => m.category));
    expect(categories.has('gpt')).toBe(true);
    expect(categories.has('embedding')).toBe(true);
    expect(categories.has('image')).toBe(true);
    expect(categories.has('speech')).toBe(true);
  });

  it('pricing strings contain dollar signs', () => {
    for (const m of MODEL_CATALOG) {
      expect(m.pricing).toContain('$');
    }
  });
});

describe('AZURE_PRICING', () => {
  it('is a non-empty object', () => {
    expect(typeof AZURE_PRICING).toBe('object');
    expect(Object.keys(AZURE_PRICING).length).toBeGreaterThan(10);
  });

  it('every entry has dev, prod, and unit', () => {
    for (const [service, pricing] of Object.entries(AZURE_PRICING)) {
      expect(typeof pricing.dev, `${service} dev`).toBe('number');
      expect(typeof pricing.prod, `${service} prod`).toBe('number');
      expect(pricing.unit, `${service} unit`).toBeTruthy();
    }
  });

  it('prod prices are >= dev prices', () => {
    for (const [service, pricing] of Object.entries(AZURE_PRICING)) {
      expect(pricing.prod, `${service}: prod < dev`).toBeGreaterThanOrEqual(pricing.dev);
    }
  });

  it('includes common Azure services', () => {
    const services = Object.keys(AZURE_PRICING);
    expect(services).toContain('AI Search');
    expect(services).toContain('Key Vault');
    expect(services).toContain('Blob Storage');
  });
});

describe('ARCHITECTURE_PATTERNS', () => {
  it('is a non-empty tuple', () => {
    expect(ARCHITECTURE_PATTERNS.length).toBeGreaterThanOrEqual(7);
  });

  it('includes core patterns', () => {
    const patterns = [...ARCHITECTURE_PATTERNS];
    expect(patterns).toContain('rag_pipeline');
    expect(patterns).toContain('agent_hosting');
    expect(patterns).toContain('model_selection');
    expect(patterns).toContain('cost_optimization');
    expect(patterns).toContain('deterministic_ai');
    expect(patterns).toContain('multi_agent');
    expect(patterns).toContain('fine_tuning_decision');
  });

  it('all entries are snake_case strings', () => {
    for (const p of ARCHITECTURE_PATTERNS) {
      expect(p).toMatch(/^[a-z_]+$/);
    }
  });
});

describe('EXTERNAL_MCP_SERVERS', () => {
  it('is a non-empty object', () => {
    expect(Object.keys(EXTERNAL_MCP_SERVERS).length).toBeGreaterThanOrEqual(5);
  });

  it('every entry has name and desc', () => {
    for (const [key, server] of Object.entries(EXTERNAL_MCP_SERVERS)) {
      expect(server.name, `${key} missing name`).toBeTruthy();
      expect(server.desc, `${key} missing desc`).toBeTruthy();
    }
  });

  it('includes github server', () => {
    expect(EXTERNAL_MCP_SERVERS.github).toBeDefined();
    expect(EXTERNAL_MCP_SERVERS.github.name).toContain('github');
  });

  it('includes frootai self-reference', () => {
    expect(EXTERNAL_MCP_SERVERS.azure).toBeDefined();
    expect(EXTERNAL_MCP_SERVERS.azure.name).toBe('frootai-mcp');
  });
});
