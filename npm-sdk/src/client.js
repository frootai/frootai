/**
 * FrootAI Client — Main SDK entry point
 *
 * Offline-first: queries bundled knowledge base (16 modules, 5 FROOT layers).
 * 100 solution plays, 830+ FAI primitives, 77 plugins, 45 MCP tools.
 *
 * Usage:
 *   import { FrootAI } from 'frootai';
 *   const fai = new FrootAI();
 *   const results = fai.search('RAG architecture');
 *   const play = fai.plays.get('01');
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const KNOWLEDGE = require('frootai-mcp/knowledge.json');
let SEARCH_INDEX = null;

function loadSearchIndex() {
  if (SEARCH_INDEX) return SEARCH_INDEX;
  try { SEARCH_INDEX = require('frootai-mcp/search-index.json'); } catch { SEARCH_INDEX = {}; }
  return SEARCH_INDEX;
}

// ─── Cost Data ───
const COST_DATA = {
  'openai-gpt4o': { dev: 150, prod: 2500 },
  'openai-gpt4o-mini': { dev: 30, prod: 500 },
  'ai-search-basic': { dev: 75, prod: 300 },
  'ai-search-standard': { dev: 250, prod: 750 },
  'container-apps': { dev: 20, prod: 200 },
  'app-service-b1': { dev: 13, prod: 55 },
  'app-service-p1v3': { dev: 55, prod: 220 },
  'cosmos-db': { dev: 25, prod: 400 },
  'log-analytics': { dev: 10, prod: 150 },
  'content-safety': { dev: 15, prod: 100 },
  'document-intelligence': { dev: 50, prod: 500 },
  'communication-services': { dev: 10, prod: 200 },
  'aks-gpu': { dev: 800, prod: 3200 },
  'vnet-private-endpoints': { dev: 8, prod: 40 },
  'key-vault': { dev: 3, prod: 10 },
};

const PLAY_COSTS = {
  '01-enterprise-rag': ['openai-gpt4o', 'ai-search-standard', 'container-apps', 'log-analytics'],
  '02-ai-landing-zone': ['vnet-private-endpoints', 'key-vault', 'log-analytics'],
  '03-deterministic-agent': ['openai-gpt4o', 'container-apps', 'content-safety', 'log-analytics'],
  '04-call-center-voice-ai': ['openai-gpt4o', 'communication-services', 'container-apps'],
  '05-it-ticket-resolution': ['openai-gpt4o-mini', 'container-apps', 'log-analytics'],
  '06-document-intelligence': ['document-intelligence', 'openai-gpt4o', 'container-apps'],
  '07-multi-agent-service': ['openai-gpt4o', 'container-apps', 'cosmos-db', 'log-analytics'],
  '09-ai-search-portal': ['ai-search-standard', 'app-service-p1v3', 'log-analytics'],
  '12-model-serving-aks': ['aks-gpu', 'log-analytics', 'key-vault'],
  '14-cost-optimized-ai-gateway': ['openai-gpt4o', 'container-apps', 'log-analytics'],
};

// ─── Play Index ───
const ALL_PLAYS = [
  '01-enterprise-rag','02-ai-landing-zone','03-deterministic-agent',
  '04-call-center-voice-ai','05-it-ticket-resolution','06-document-intelligence',
  '07-multi-agent-service','08-copilot-studio-bot','09-ai-search-portal',
  '10-content-moderation','11-ai-landing-zone-advanced','12-model-serving-aks',
  '13-fine-tuning-workflow','14-cost-optimized-ai-gateway','15-multi-modal-docproc',
  '16-copilot-teams-extension','17-ai-observability','18-prompt-management',
  '19-edge-ai-phi4','20-anomaly-detection','21-agentic-rag',
  '22-multi-agent-swarm','23-browser-automation-agent','24-ai-code-review',
  '25-ai-onboarding-assistant','26-enterprise-search','27-ai-customer-support',
  '28-knowledge-graph-rag','29-mcp-gateway','30-ai-security-hardening',
  '31-ai-data-pipeline','32-ai-test-generation','33-ai-image-analysis',
  '34-ai-translation','35-ai-compliance','36-conversational-bi',
  '37-ai-devops','38-ai-recommendation','39-ai-sentiment-analysis',
  '40-copilot-extension','41-ai-red-teaming','42-ai-summarization',
  '43-ai-email-assistant','44-ai-meeting-assistant','45-ai-form-processing',
  '46-ai-inventory-optimization','47-ai-fraud-detection','48-ai-content-generation',
  '49-ai-supply-chain','50-ai-hr-assistant','51-ai-research-assistant',
  '52-ai-finops-advisor','53-ai-legal-review','54-ai-healthcare-triage',
  '55-ai-education-tutor','56-ai-accessibility','57-ai-localization',
  '58-ai-sales-copilot','59-ai-marketing-copilot','60-responsible-ai-dashboard',
  '61-ai-content-safety','62-ai-anomaly-root-cause','63-ai-capacity-planning',
  '64-ai-incident-response','65-ai-config-management','66-ai-api-gateway',
  '67-ai-knowledge-management','68-predictive-maintenance-ai','69-carbon-footprint-tracker',
  '70-ai-governance-hub','71-digital-twin-ai','72-ai-quality-assurance',
  '73-ai-contract-analyzer','74-ai-risk-assessment','75-ai-portfolio-optimizer',
  '76-ai-claims-processing','77-ai-underwriting','78-ai-regulatory-reporting',
  '79-ai-customer-360','80-ai-product-recommendation','81-ai-dynamic-pricing',
  '82-ai-warehouse-optimization','83-ai-route-optimization','84-ai-demand-forecasting',
  '85-ai-document-comparison','86-ai-contract-generation','87-ai-patent-analysis',
  '88-ai-competitive-intelligence','89-ai-market-research','90-ai-brand-monitoring',
  '91-ai-social-listening','92-ai-influencer-matching','93-ai-ad-optimization',
  '94-ai-campaign-analytics','95-ai-churn-prediction','96-ai-lifetime-value',
  '97-ai-credit-scoring','98-ai-anti-money-laundering','99-ai-identity-verification',
  '100-ai-voice-biometrics',
];

function resolvePlay(input) {
  if (!input) return null;
  const exact = ALL_PLAYS.find(p => p === input);
  if (exact) return exact;
  const num = String(input).replace(/^play-?/i, '').replace(/^0*(\d+)/, (_, d) => d);
  const padded = num.padStart(2, '0');
  const match = ALL_PLAYS.find(p => p.startsWith(padded + '-'));
  if (match) return match;
  const slug = String(input).toLowerCase().replace(/\s+/g, '-');
  return ALL_PLAYS.find(p => p.includes(slug)) || null;
}

function parsePlayName(name) {
  return {
    num: name.replace(/-.*/, ''),
    name,
    title: name.replace(/^\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
  };
}

/**
 * FrootAI SDK Client
 */
export class FrootAI {
  constructor() {
    this._knowledge = KNOWLEDGE;
    this._modules = KNOWLEDGE.modules || {};
    this._layers = KNOWLEDGE.layers || {};
    this.plays = new PlayManager();
    this.evaluation = new EvalRunner();
    this.config = new ConfigManager();
  }

  /** Search across all knowledge modules using BM25 ranking */
  search(query, { limit = 10 } = {}) {
    const index = loadSearchIndex();
    if (!index || !index.docs) return this._fallbackSearch(query, limit);

    const { idf = {}, docs, params = {} } = index;
    const { k1 = 1.5, b = 0.75, avgDocLen = 274 } = params;
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const results = [];

    for (const doc of Object.values(docs)) {
      let score = 0;
      const tf = doc.tf || {};
      const docLen = doc.len || avgDocLen;
      for (const term of terms) {
        const termTf = tf[term] || 0;
        const termIdf = idf[term] || 0;
        if (termTf > 0 && termIdf > 0) {
          score += termIdf * ((termTf * (k1 + 1)) / (termTf + k1 * (1 - b + b * docLen / avgDocLen)));
        }
      }
      if (score > 0) {
        results.push({ id: doc.id, title: doc.title, score: Math.round(score * 100) / 100, type: doc.type || 'doc' });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  _fallbackSearch(query, limit) {
    const q = query.toLowerCase();
    const results = [];
    for (const [id, mod] of Object.entries(this._modules)) {
      const text = `${mod.title || ''} ${mod.content || ''}`.toLowerCase();
      if (text.includes(q)) {
        results.push({ id, title: mod.title || id, score: 1, type: 'module' });
      }
    }
    return results.slice(0, limit);
  }

  /** Get a knowledge module by ID (F1, R2, T3, etc.) */
  getModule(moduleId) {
    const mod = this._modules[moduleId];
    if (!mod) return null;
    return {
      id: mod.id || moduleId,
      title: mod.title || '',
      layer: mod.layer || '',
      emoji: mod.emoji || '',
      contentLength: (mod.content || '').length,
      content: mod.content || '',
    };
  }

  /** List all knowledge modules (without content) */
  listModules() {
    return Object.entries(this._modules).map(([id, mod]) => ({
      id, title: mod.title || '', layer: mod.layer || '',
      emoji: mod.emoji || '', contentLength: (mod.content || '').length,
    }));
  }

  /** List all FROOT layers */
  listLayers() {
    return Object.entries(this._layers).map(([key, layer]) => ({
      key, name: layer.name || '', emoji: layer.emoji || '',
      modules: layer.moduleIds || [],
    }));
  }

  /** Look up a glossary term */
  lookupTerm(term) {
    const glossary = this.getGlossary();
    const key = Object.keys(glossary).find(k => k.toLowerCase() === term.toLowerCase());
    return key ? glossary[key] : null;
  }

  /** Build glossary from module content */
  getGlossary() {
    if (this._glossary) return this._glossary;
    this._glossary = {};
    const pattern = /\*\*([A-Z][A-Za-z0-9 /\-()]+)\*\*\s*[-:—]\s*(.+?)(?:\n|$)/g;
    for (const [modId, mod] of Object.entries(this._modules)) {
      let match;
      while ((match = pattern.exec(mod.content || '')) !== null) {
        const term = match[1].trim();
        const def = match[2].trim();
        if (term.length < 60 && def.length > 10) {
          this._glossary[term.toLowerCase()] = { term, definition: def, sourceModule: modId };
        }
      }
    }
    return this._glossary;
  }

  /** Estimate monthly Azure cost for a play */
  estimateCost(playId, scale = 'dev') {
    const resolved = resolvePlay(playId);
    const services = PLAY_COSTS[resolved] || [];
    if (!services.length) return { play: playId, scale, error: `No cost data for '${playId}'` };
    const breakdown = {};
    let total = 0;
    for (const svc of services) {
      const cost = (COST_DATA[svc] || {})[scale] || 0;
      breakdown[svc] = cost;
      total += cost;
    }
    return { play: resolved, scale, currency: 'USD', monthlyTotal: total, breakdown };
  }

  /** Get FAI primitives catalog */
  primitivesCatalog() {
    return {
      total: 831,
      categories: {
        agents: { count: 238, path: 'agents/', ext: '.agent.md' },
        instructions: { count: 176, path: 'instructions/', ext: '.instructions.md' },
        skills: { count: 322, path: 'skills/', ext: '/SKILL.md' },
        hooks: { count: 10, path: 'hooks/', ext: '/hooks.json' },
        plugins: { count: 77, path: 'plugins/', ext: '/plugin.json' },
        workflows: { count: 12, path: 'workflows/', ext: '.md' },
        cookbook: { count: 16, path: 'cookbook/', ext: '.md' },
      },
      wafPillars: ['reliability', 'security', 'cost-optimization', 'operational-excellence', 'performance-efficiency', 'responsible-ai'],
    };
  }

  /** Get FAI Protocol info */
  faiProtocol() {
    return {
      name: 'FAI Protocol',
      specFile: 'fai-manifest.json',
      description: 'The missing binding glue — context-wiring between agents, instructions, skills, hooks, workflows, plugins, tools, prompts, and guardrails.',
      schemas: ['agent.schema.json', 'instruction.schema.json', 'skill.schema.json', 'hook.schema.json', 'plugin.schema.json', 'fai-manifest.schema.json', 'fai-context.schema.json'],
    };
  }

  /** Raw knowledge data */
  get knowledge() { return this._knowledge; }
}


/**
 * Play Manager — CRUD operations for solution plays
 */
class PlayManager {
  /** Get all 100 plays */
  all() {
    return ALL_PLAYS.map(parsePlayName);
  }

  /** Get a specific play by number or name */
  get(query) {
    const resolved = resolvePlay(query);
    return resolved ? parsePlayName(resolved) : null;
  }

  /** Search plays by keyword */
  search(query) {
    const q = query.toLowerCase();
    return ALL_PLAYS
      .filter(p => p.toLowerCase().includes(q))
      .map(parsePlayName);
  }

  /** Get play count */
  get count() { return ALL_PLAYS.length; }
}


/**
 * Evaluation Runner — quality scoring against thresholds
 */
class EvalRunner {
  /**
   * Evaluate scores against thresholds
   * @param {object} scores - { groundedness: 0.95, relevance: 0.88, ... }
   * @param {object} [thresholds] - custom thresholds (defaults: 0.8 for all)
   */
  run(scores, thresholds = {}) {
    const defaults = { groundedness: 0.8, relevance: 0.8, coherence: 0.85, fluency: 0.9, safety: 0.95 };
    const t = { ...defaults, ...thresholds };
    const results = {};
    let allPassed = true;

    for (const [metric, score] of Object.entries(scores)) {
      const threshold = t[metric] || 0.8;
      const passed = score >= threshold;
      if (!passed) allPassed = false;
      results[metric] = { score, threshold, passed, delta: Math.round((score - threshold) * 100) / 100 };
    }

    return { passed: allPassed, results, timestamp: new Date().toISOString() };
  }

  /** Default guardrail thresholds */
  get defaults() {
    return { groundedness: 0.8, relevance: 0.8, coherence: 0.85, fluency: 0.9, safety: 0.95 };
  }
}


/**
 * Config Manager — TuneKit config operations
 */
class ConfigManager {
  /**
   * Validate a config object against best practices
   * @param {string} type - 'openai' | 'guardrails' | 'search'
   * @param {object} config - the config object to validate
   */
  validate(type, config) {
    const issues = [];

    if (type === 'openai') {
      if (!config.model) issues.push('Missing model field');
      if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2))
        issues.push('temperature must be 0-2');
      if (config.max_tokens !== undefined && config.max_tokens > 128000)
        issues.push('max_tokens exceeds 128000 limit');
    }

    if (type === 'guardrails') {
      for (const field of ['groundedness', 'relevance', 'coherence', 'safety']) {
        if (config[field] !== undefined && (config[field] < 0 || config[field] > 1))
          issues.push(`${field} must be 0-1`);
      }
    }

    if (type === 'search') {
      if (config.top_k !== undefined && (config.top_k < 1 || config.top_k > 50))
        issues.push('top_k must be 1-50');
    }

    return { valid: issues.length === 0, issues };
  }
}

export { PlayManager, EvalRunner, ConfigManager };
