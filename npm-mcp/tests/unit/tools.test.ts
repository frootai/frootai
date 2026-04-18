/**
 * Tests for tools/ modules — knowledge, ecosystem, engine, scaffold, marketplace
 */
import { describe, it, expect } from 'vitest';

// ── tools/knowledge.ts ──────────────────────────────────────────────
import {
  parseSections,
  searchModules,
  lookupGlossaryTerm,
  computeSimilarity,
} from '../../src/tools/knowledge.js';
import type { FrootModule } from '../../src/types/index.js';

describe('tools/knowledge — parseSections', () => {
  it('splits markdown by ## headings', () => {
    const sections = parseSections('## Intro\nHello\n## Details\nWorld');
    expect(sections).toHaveLength(2);
    expect(sections[0]).toEqual({ title: 'Intro', content: 'Hello' });
    expect(sections[1]).toEqual({ title: 'Details', content: 'World' });
  });

  it('returns empty array for text without headings', () => {
    expect(parseSections('no headings here')).toHaveLength(0);
  });

  it('handles consecutive headings with no body', () => {
    const sections = parseSections('## A\n## B\nonly B');
    expect(sections).toHaveLength(2);
    expect(sections[0].content).toBe('');
    expect(sections[1].content).toBe('only B');
  });
});

describe('tools/knowledge — searchModules', () => {
  const modules: Record<string, FrootModule> = {
    R2: {
      id: 'R2', title: 'RAG Architecture', layer: 'Reasoning',
      emoji: '🪵', metaphor: 'Trunk', file: 'test.md', content: '',
      sections: [
        { title: 'Chunking', content: 'Chunk documents into segments for RAG retrieval.' },
        { title: 'Hybrid Search', content: 'Combine keyword and vector search for best results.' },
      ],
    },
  };

  it('scores sections by query relevance', () => {
    const results = searchModules(modules, 'RAG chunking');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].sectionTitle).toBe('Chunking');
  });

  it('returns empty for unmatched queries', () => {
    expect(searchModules(modules, 'quantum physics')).toHaveLength(0);
  });

  it('respects maxResults', () => {
    expect(searchModules(modules, 'search', 1)).toHaveLength(1);
  });

  it('includes preview text in results', () => {
    const results = searchModules(modules, 'Hybrid Search');
    expect(results[0].preview).toContain('Combine keyword');
  });

  it('applies title match bonus', () => {
    const results = searchModules(modules, 'Hybrid Search');
    expect(results[0].score).toBeGreaterThan(10); // exact phrase + title bonus
  });
});

describe('tools/knowledge — lookupGlossaryTerm', () => {
  const f3Content = '### RAG\nRetrieval-Augmented Generation\n\n### Token\nSmallest unit\n\n### Tokenizer\nSplits text into tokens\n';

  it('finds exact term', () => {
    const entry = lookupGlossaryTerm(f3Content, 'RAG');
    expect(entry).not.toBeNull();
    expect(entry!.term).toBe('RAG');
  });

  it('case-insensitive lookup', () => {
    expect(lookupGlossaryTerm(f3Content, 'rag')).not.toBeNull();
  });

  it('fuzzy match on partial key', () => {
    const entry = lookupGlossaryTerm(f3Content, 'token');
    expect(entry).not.toBeNull();
  });

  it('returns null for unknown term', () => {
    expect(lookupGlossaryTerm(f3Content, 'nonexistent')).toBeNull();
  });

  it('handles empty content', () => {
    expect(lookupGlossaryTerm('', 'anything')).toBeNull();
  });
});

describe('tools/knowledge — computeSimilarity', () => {
  it('returns high score for identical texts', () => {
    expect(computeSimilarity('azure openai search', 'azure openai search')).toBe(1);
  });

  it('returns 0 for completely disjoint texts', () => {
    expect(computeSimilarity('quantum physics dark matter', 'cooking baking recipes')).toBe(0);
  });

  it('partial overlap yields fractional score', () => {
    const score = computeSimilarity('RAG architecture search', 'RAG pipeline with vector search');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns 0 for empty first string', () => {
    expect(computeSimilarity('', 'some text')).toBe(0);
  });
});

// ── tools/ecosystem.ts ──────────────────────────────────────────────
import {
  getModelCatalog,
  estimateAzurePricing,
  compareModels,
  estimatePlayCost,
} from '../../src/tools/ecosystem.js';

describe('tools/ecosystem — getModelCatalog', () => {
  it('returns all models when no category filter', () => {
    const all = getModelCatalog();
    expect(all.length).toBeGreaterThanOrEqual(10);
  });

  it('returns all models with "all" category', () => {
    expect(getModelCatalog('all').length).toBe(getModelCatalog().length);
  });

  it('filters by gpt category', () => {
    const gpts = getModelCatalog('gpt');
    expect(gpts.every(m => m.category === 'gpt')).toBe(true);
    expect(gpts.length).toBeGreaterThan(0);
  });

  it('filters by embedding category', () => {
    const emb = getModelCatalog('embedding');
    expect(emb.every(m => m.category === 'embedding')).toBe(true);
  });

  it('returns empty for unknown category', () => {
    expect(getModelCatalog('nonexistent')).toHaveLength(0);
  });

  it('returns new array each call (no mutation leaks)', () => {
    const a = getModelCatalog();
    const b = getModelCatalog();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('tools/ecosystem — estimateAzurePricing', () => {
  it('returns pricing for rag/dev', () => {
    const p = estimateAzurePricing({ scenario: 'rag', scale: 'dev' });
    expect(p.monthly).toBeDefined();
    expect(p.breakdown).toBeDefined();
  });

  it('returns pricing for agent/production', () => {
    const p = estimateAzurePricing({ scenario: 'agent', scale: 'production' });
    expect(p.monthly).toContain('$');
  });

  it('falls back to custom for unknown scenario', () => {
    const p = estimateAzurePricing({ scenario: 'unknown' as any, scale: 'dev' });
    expect(p).toBeDefined();
  });

  it('falls back to production for unknown scale', () => {
    const p = estimateAzurePricing({ scenario: 'rag', scale: 'unknown' as any });
    expect(p).toBeDefined();
  });
});

describe('tools/ecosystem — compareModels', () => {
  it('returns recommendation for cost priority', () => {
    const result = compareModels('chatbot', 'cost');
    expect(result.recommended).toContain('gpt-4o-mini');
    expect(result.comparison.length).toBeGreaterThan(0);
  });

  it('returns recommendation for quality priority', () => {
    const result = compareModels('complex reasoning', 'quality');
    expect(result.recommended).toContain('gpt-4o');
  });

  it('returns recommendation for speed priority', () => {
    const result = compareModels('classification', 'speed');
    expect(result.recommended).toBeDefined();
  });

  it('returns recommendation for context priority', () => {
    const result = compareModels('long document', 'context');
    expect(result.recommended).toContain('gpt-4.1');
  });

  it('defaults to quality when no priority given', () => {
    const result = compareModels('general');
    expect(result.recommended).toContain('gpt-4o');
  });

  it('comparison array contains valid ModelInfo objects', () => {
    const result = compareModels('test', 'cost');
    for (const m of result.comparison) {
      expect(m.name).toBeTruthy();
      expect(m.category).toBeTruthy();
      expect(m.pricing).toBeTruthy();
    }
  });
});

describe('tools/ecosystem — estimatePlayCost', () => {
  const plays = [
    { id: '01', name: 'Enterprise RAG', services: ['AI Search', 'OpenAI (gpt-4o)', 'Container App'], complexity: 'moderate' as const, status: 'available' as const, category: 'rag' },
  ];

  it('returns cost estimate for valid play', () => {
    const est = estimatePlayCost('01', 'dev', plays as any);
    expect(est).not.toBeNull();
    expect(est!.total).toBeGreaterThan(0);
    expect(est!.services.length).toBe(3);
  });

  it('pads single-digit play IDs', () => {
    const est = estimatePlayCost('1', 'dev', plays as any);
    expect(est).not.toBeNull();
  });

  it('returns null for unknown play', () => {
    expect(estimatePlayCost('99', 'dev', plays as any)).toBeNull();
  });

  it('returns higher total for prod scale', () => {
    const dev = estimatePlayCost('01', 'dev', plays as any);
    const prod = estimatePlayCost('01', 'prod', plays as any);
    expect(prod!.total).toBeGreaterThanOrEqual(dev!.total);
  });

  it('includes service names and units', () => {
    const est = estimatePlayCost('01', 'dev', plays as any);
    for (const svc of est!.services) {
      expect(svc.name).toBeTruthy();
      expect(typeof svc.cost).toBe('number');
    }
  });
});

// ── tools/engine.ts ─────────────────────────────────────────────────
import { wirePlay, inspectWiring, evaluateQuality, validateManifest } from '../../src/tools/engine.js';

describe('tools/engine — wirePlay', () => {
  it('returns error when engine is unavailable', () => {
    const result = wirePlay({ available: false } as any, '01');
    expect(result.success).toBe(false);
    expect(result.errors![0]).toContain('not available');
  });

  it('delegates to engine.runPlay when available', () => {
    const mockEngine = {
      available: true,
      runPlay: ({ playId }: any) => ({ success: true, errors: [], duration: 42 }),
    };
    const result = wirePlay(mockEngine as any, '01');
    expect(result.success).toBe(true);
    expect(result.duration).toBe(42);
  });
});

describe('tools/engine — inspectWiring', () => {
  it('returns engine-not-available when engine is off', () => {
    const result = inspectWiring({ available: false } as any, '01');
    expect(result.health).toBe('Engine not available');
    expect(result.wiring).toBeNull();
  });

  it('returns play-not-found when manifest missing', () => {
    const engine = {
      available: true,
      findManifest: () => null,
      initEngine: () => ({}),
    };
    const result = inspectWiring(engine as any, '99');
    expect(result.health).toContain('not found');
  });

  it('returns healthy wiring when all primitives resolve', () => {
    const engine = {
      available: true,
      findManifest: () => '/path/to/manifest.json',
      initEngine: () => ({
        manifest: { play: '01-enterprise-rag' },
        wiring: { stats: { agents: 3, instructions: 2, skills: 5, hooks: 1, workflows: 1 }, primitives: {} },
        context: {},
        evaluator: { thresholds: {} },
        errors: [],
      }),
    };
    const result = inspectWiring(engine as any, '01');
    expect(result.health).toContain('✅');
    expect(result.health).toContain('12 primitives');
  });

  it('reports issues when errors exist', () => {
    const engine = {
      available: true,
      findManifest: () => '/path/manifest.json',
      initEngine: () => ({
        manifest: { play: '01' },
        wiring: { stats: {}, primitives: {} },
        errors: ['missing agent'],
      }),
    };
    const result = inspectWiring(engine as any, '01');
    expect(result.health).toContain('⚠️');
  });
});

describe('tools/engine — evaluateQuality', () => {
  it('passes when all scores meet default thresholds', () => {
    const result = evaluateQuality({
      groundedness: 4.5, relevance: 4.2, coherence: 4.1, fluency: 4.8, safety: 5.0,
    });
    expect(result.pass).toBe(true);
    expect(result.summary).toContain('5/5');
  });

  it('fails when any score is below threshold', () => {
    const result = evaluateQuality({ groundedness: 3.0, relevance: 4.5 });
    expect(result.pass).toBe(false);
    expect(result.results.find(r => r.metric === 'groundedness')!.pass).toBe(false);
  });

  it('uses custom thresholds when provided', () => {
    const result = evaluateQuality({ groundedness: 3.5 }, { groundedness: 3.0 });
    expect(result.pass).toBe(true);
  });

  it('assigns correct actions based on deficit size', () => {
    const result = evaluateQuality({
      score_ok: 4.5,       // pass → ok
      score_warn: 3.8,     // deficit 0.2 → warn
      score_retry: 3.2,    // deficit 0.8 → retry
      score_alert: 2.8,    // deficit 1.2 → alert
      score_block: 2.0,    // deficit 2.0 → block
    });
    const byMetric = Object.fromEntries(result.results.map(r => [r.metric, r.action]));
    expect(byMetric.score_ok).toBe('ok');
    expect(byMetric.score_warn).toBe('warn');
    expect(byMetric.score_retry).toBe('retry');
    expect(byMetric.score_alert).toBe('alert');
    expect(byMetric.score_block).toBe('block');
  });

  it('handles empty scores gracefully', () => {
    const result = evaluateQuality({});
    expect(result.pass).toBe(true);
    expect(result.results).toHaveLength(0);
  });
});

describe('tools/engine — validateManifest', () => {
  it('returns error when engine is unavailable', () => {
    const result = validateManifest({ available: false } as any, '01');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not available');
  });

  it('returns error when play not found', () => {
    const engine = {
      available: true,
      findManifest: () => null,
      loadManifest: () => ({}),
      resolvePaths: () => ({ missing: [] }),
    };
    const result = validateManifest(engine as any, '99');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not found');
  });

  it('returns errors when manifest fails to load', () => {
    const engine = {
      available: true,
      findManifest: () => '/path/manifest.json',
      loadManifest: () => ({ manifest: null, playDir: '/path', errors: ['parse error'] }),
      resolvePaths: () => ({ missing: [] }),
    };
    const result = validateManifest(engine as any, '01');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('parse error');
  });

  it('returns warnings for missing optional fields', () => {
    const engine = {
      available: true,
      findManifest: () => '/path/manifest.json',
      loadManifest: () => ({
        manifest: { play: '01', context: {}, primitives: {} },
        playDir: '/path',
        errors: [],
      }),
      resolvePaths: () => ({ missing: [] }),
    };
    const result = validateManifest(engine as any, '01');
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('knowledge'))).toBe(true);
    expect(result.warnings.some(w => w.includes('WAF'))).toBe(true);
  });

  it('reports missing files from resolvePaths', () => {
    const engine = {
      available: true,
      findManifest: () => '/path/manifest.json',
      loadManifest: () => ({
        manifest: { play: '01', context: { knowledge: ['F1'], waf: ['security'] }, primitives: { agents: ['a.md'], guardrails: {} } },
        playDir: '/path',
        errors: [],
      }),
      resolvePaths: () => ({ missing: ['agents/missing.agent.md'] }),
    };
    const result = validateManifest(engine as any, '01');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Missing file'))).toBe(true);
  });
});

// ── tools/scaffold.ts ───────────────────────────────────────────────
import { generatePlayStructure, generatePrimitive, smartScaffold } from '../../src/tools/scaffold.js';

describe('tools/scaffold — generatePlayStructure', () => {
  it('generates all required files for a play', () => {
    const files = generatePlayStructure({ name: 'Test Play' });
    expect(files.size).toBeGreaterThanOrEqual(15);
    expect(files.has('agent.md')).toBe(true);
    expect(files.has('.github/copilot-instructions.md')).toBe(true);
    expect(files.has('config/openai.json')).toBe(true);
    expect(files.has('config/guardrails.json')).toBe(true);
  });

  it('generates builder/reviewer/tuner agents', () => {
    const files = generatePlayStructure({ name: 'My AI App' });
    expect(files.has('.github/agents/builder.agent.md')).toBe(true);
    expect(files.has('.github/agents/reviewer.agent.md')).toBe(true);
    expect(files.has('.github/agents/tuner.agent.md')).toBe(true);
  });

  it('generates prompt files', () => {
    const files = generatePlayStructure({ name: 'X' });
    expect(files.has('.github/prompts/deploy.prompt.md')).toBe(true);
    expect(files.has('.github/prompts/test.prompt.md')).toBe(true);
  });

  it('generates skills directories', () => {
    const files = generatePlayStructure({ name: 'Y' });
    const skillKeys = [...files.keys()].filter(k => k.includes('skills/'));
    expect(skillKeys.length).toBeGreaterThanOrEqual(3);
  });

  it('includes infra by default', () => {
    const files = generatePlayStructure({ name: 'Z' });
    expect(files.has('infra/main.bicep')).toBe(true);
    expect(files.has('infra/parameters.json')).toBe(true);
  });

  it('omits infra when generateInfra=false', () => {
    const files = generatePlayStructure({ name: 'No Infra', generateInfra: false });
    expect(files.has('infra/main.bicep')).toBe(false);
  });

  it('uses provided model in config', () => {
    const files = generatePlayStructure({ name: 'Custom', model: 'gpt-4.1' });
    const config = JSON.parse(files.get('config/openai.json')!);
    expect(config.model).toBe('gpt-4.1');
  });

  it('uses provided temperature in config', () => {
    const files = generatePlayStructure({ name: 'Temp', temperature: 0.7 });
    const config = JSON.parse(files.get('config/openai.json')!);
    expect(config.temperature).toBe(0.7);
  });

  it('uses provided WAF pillars', () => {
    const files = generatePlayStructure({ name: 'WAF', wafPillars: ['security'] });
    const agent = files.get('agent.md')!;
    expect(agent).toContain('security');
  });

  it('converts name to kebab-case for slug', () => {
    const files = generatePlayStructure({ name: 'My Custom AI Play' });
    const manifest = [...files.keys()].find(k => k.includes('fai-manifest'));
    if (manifest) {
      const content = JSON.parse(files.get(manifest)!);
      expect(content.play).toContain('my-custom-ai-play');
    }
  });

  it('includes evaluation files', () => {
    const files = generatePlayStructure({ name: 'Eval Play' });
    expect(files.has('evaluation/eval.py')).toBe(true);
    expect(files.has('evaluation/test-set.jsonl')).toBe(true);
  });
});

// ── tools/scaffold — generatePrimitive ──────────────────────────────
describe('tools/scaffold — generatePrimitive', () => {
  it('generates an agent with fai- prefix', () => {
    const result = generatePrimitive('agent', 'rag-architect');
    expect(result.path).toContain('agents/fai-rag-architect.agent.md');
    expect(result.content).toContain('description:');
    expect(result.content).toContain('tools:');
  });

  it('does not double-prefix fai-', () => {
    const result = generatePrimitive('agent', 'fai-my-agent');
    expect(result.path).toBe('agents/fai-my-agent.agent.md');
  });

  it('generates an instruction file', () => {
    const result = generatePrimitive('instruction', 'python-patterns');
    expect(result.path).toBe('instructions/python-patterns.instructions.md');
    expect(result.content).toContain('applyTo:');
  });

  it('generates a skill with SKILL.md', () => {
    const result = generatePrimitive('skill', 'deploy-helper');
    expect(result.path).toContain('skills/fai-deploy-helper/SKILL.md');
    expect(result.content).toContain('name: "fai-deploy-helper"');
  });

  it('applies custom description', () => {
    const result = generatePrimitive('agent', 'test', { description: 'Custom desc' });
    expect(result.content).toContain('Custom desc');
  });

  it('applies WAF and plays options', () => {
    const result = generatePrimitive('agent', 'test', { waf: ['security'], plays: ['01'] });
    expect(result.content).toContain('"security"');
    expect(result.content).toContain('"01"');
  });

  it('converts name with spaces to kebab-case', () => {
    const result = generatePrimitive('agent', 'My Cool Agent');
    expect(result.path).toContain('fai-my-cool-agent');
  });
});

// ── tools/scaffold — smartScaffold ─────────────────────────────────
describe('tools/scaffold — smartScaffold', () => {
  const plays = [
    { id: '01', name: 'Enterprise RAG', pattern: 'retrieval augmented generation search' },
    { id: '04', name: 'Call Center Voice AI', pattern: 'voice speech telephony' },
    { id: '07', name: 'Multi-Agent Service', pattern: 'multi agent collaboration' },
  ];

  it('returns matching plays sorted by score', () => {
    const results = smartScaffold('RAG search pipeline', plays);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('01');
  });

  it('returns empty for no match', () => {
    const results = smartScaffold('quantum physics xyz', plays);
    expect(results).toHaveLength(0);
  });

  it('returns scores between 0 and 1', () => {
    const results = smartScaffold('voice agent', plays);
    for (const r of results) {
      expect(r.score).toBeGreaterThan(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });
});

// ── tools/marketplace.ts ────────────────────────────────────────────
import {
  searchPlugins,
  browsePlugins,
  countItems,
  getMarketplaceStats,
  validatePlugin,
  checkCompatibility,
  loadMarketplace,
} from '../../src/tools/marketplace.js';
import type { MarketplaceData, PluginEntry } from '../../src/tools/marketplace.js';

const sampleMarketplace: MarketplaceData = {
  plugins: [
    { name: 'enterprise-rag', description: 'RAG pipeline plugin', keywords: ['rag', 'search'], plays: ['01'], items: { agents: 3, skills: 2 } },
    { name: 'security-hardening', description: 'OWASP security checks', keywords: ['security', 'owasp'], plays: ['all'], items: { agents: 1 } },
    { name: 'python-waf', description: 'Python WAF alignment', keywords: ['python', 'language'], items: { instructions: 2 } },
    { name: 'kubernetes-gpu', description: 'GPU node pool setup', keywords: ['kubernetes', 'infrastructure'], items: { skills: 4 } },
  ],
  stats: { totalPlugins: 4, totalItems: 12 },
};

describe('tools/marketplace — searchPlugins', () => {
  it('finds plugins by keyword', () => {
    const results = searchPlugins(sampleMarketplace, 'rag');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('enterprise-rag');
  });

  it('ranks name matches higher than description', () => {
    const results = searchPlugins(sampleMarketplace, 'security');
    expect(results[0].name).toBe('security-hardening');
  });

  it('returns empty for no match', () => {
    expect(searchPlugins(sampleMarketplace, 'quantum')).toHaveLength(0);
  });

  it('respects limit parameter', () => {
    const results = searchPlugins(sampleMarketplace, 'a', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

describe('tools/marketplace — browsePlugins', () => {
  it('returns paginated results', () => {
    const result = browsePlugins(sampleMarketplace, { page: 1, perPage: 2 });
    expect(result.plugins).toHaveLength(2);
    expect(result.total).toBe(4);
    expect(result.pages).toBe(2);
    expect(result.page).toBe(1);
  });

  it('returns second page', () => {
    const result = browsePlugins(sampleMarketplace, { page: 2, perPage: 2 });
    expect(result.plugins).toHaveLength(2);
  });

  it('filters by category', () => {
    const result = browsePlugins(sampleMarketplace, { category: 'security' });
    expect(result.plugins.every(p => p.name.includes('security') || (p.keywords ?? []).some(k => k.includes('security')))).toBe(true);
  });

  it('returns all when category is "all"', () => {
    const result = browsePlugins(sampleMarketplace, { category: 'all' });
    expect(result.total).toBe(4);
  });

  it('uses defaults when no options given', () => {
    const result = browsePlugins(sampleMarketplace);
    expect(result.page).toBe(1);
    expect(result.plugins.length).toBeLessThanOrEqual(20);
  });
});

describe('tools/marketplace — countItems', () => {
  it('sums numeric values', () => {
    expect(countItems({ agents: 3, skills: 2, hooks: 1 })).toBe(6);
  });

  it('returns 0 for undefined', () => {
    expect(countItems(undefined)).toBe(0);
  });

  it('returns 0 for empty object', () => {
    expect(countItems({})).toBe(0);
  });

  it('ignores non-numeric values', () => {
    expect(countItems({ agents: 3, label: 'test' } as any)).toBe(3);
  });
});

describe('tools/marketplace — getMarketplaceStats', () => {
  it('returns total plugin count', () => {
    const stats = getMarketplaceStats(sampleMarketplace);
    expect(stats.total).toBe(4);
  });

  it('returns category breakdown from keywords', () => {
    const stats = getMarketplaceStats(sampleMarketplace);
    expect(stats.categories).toBeDefined();
    expect(typeof stats.categories).toBe('object');
  });

  it('returns top plugins sorted by item count', () => {
    const stats = getMarketplaceStats(sampleMarketplace);
    expect(stats.topPlugins.length).toBeGreaterThan(0);
    expect(stats.topPlugins.length).toBeLessThanOrEqual(10);
  });

  it('handles empty marketplace', () => {
    const stats = getMarketplaceStats({ plugins: [] });
    expect(stats.total).toBe(0);
    expect(stats.topPlugins).toHaveLength(0);
  });
});

describe('tools/marketplace — validatePlugin', () => {
  it('returns error for non-existent path', () => {
    const result = validatePlugin('/nonexistent/path/plugin.json');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not found');
  });
});

describe('tools/marketplace — checkCompatibility', () => {
  it('warns when plugin is not designed for the target play', () => {
    const plugin: PluginEntry = { name: 'test-plugin', plays: ['01', '02'] };
    const result = checkCompatibility(plugin, '99', '/nonexistent');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('not 99');
  });

  it('reports compatible when plugin has no play restrictions', () => {
    const plugin: PluginEntry = { name: 'universal-plugin' };
    const result = checkCompatibility(plugin, '01', '/nonexistent');
    expect(result.compatible).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it('reports compatible when play matches', () => {
    const plugin: PluginEntry = { name: 'rag-plugin', plays: ['01'] };
    const result = checkCompatibility(plugin, '01', '/nonexistent');
    expect(result.compatible).toBe(true);
  });
});

describe('tools/marketplace — loadMarketplace', () => {
  it('returns empty marketplace for non-existent path', () => {
    const result = loadMarketplace('/nonexistent/repo');
    expect(result.plugins).toHaveLength(0);
  });
});

