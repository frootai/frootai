/**
 * FAI Engine — Context Resolver
 * Resolves FROOT knowledge module references into actual content.
 *
 * The FAI Layer's shared context is built from knowledge modules referenced
 * in fai-manifest.json. This resolver loads the actual markdown content
 * and constructs the context object that all primitives share.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, '..');
const DOCS_DIR = join(ROOT, 'docs');
const KNOWLEDGE_BUNDLE = join(ROOT, 'npm-mcp', 'knowledge.json');

/** Map FROOT module IDs to filenames */
const MODULE_MAP = {
  'F1-GenAI-Foundations':       'GenAI-Foundations.md',
  'F2-LLM-Landscape':          'LLM-Landscape.md',
  'F3-AI-Glossary':            'F3-AI-Glossary-AZ.md',
  'F4-GitHub-Agentic-OS':      'F4-GitHub-Agentic-OS.md',
  'R1-Prompt-Engineering':     'Prompt-Engineering.md',
  'R2-RAG-Architecture':       'RAG-Architecture.md',
  'R3-Deterministic-AI':       'R3-Deterministic-AI.md',
  'O1-Semantic-Kernel':        'Semantic-Kernel.md',
  'O2-AI-Agents':              'AI-Agents-Deep-Dive.md',
  'O3-MCP-Tools-Functions':    'O3-MCP-Tools-Functions.md',
  'O4-Azure-AI-Foundry':       'Azure-AI-Foundry.md',
  'O5-AI-Infrastructure':      'AI-Infrastructure.md',
  'O6-Copilot-Ecosystem':      'Copilot-Ecosystem.md',
  'T1-Fine-Tuning-MLOps':     'T1-Fine-Tuning-MLOps.md',
  'T2-Responsible-AI':         'Responsible-AI-Safety.md',
  'T3-Production-Patterns':    'T3-Production-Patterns.md'
};

/** WAF instruction files */
const WAF_MAP = {
  'security':                  'waf-security.instructions.md',
  'reliability':               'waf-reliability.instructions.md',
  'cost-optimization':         'waf-cost-optimization.instructions.md',
  'operational-excellence':    'waf-operational-excellence.instructions.md',
  'performance-efficiency':    'waf-performance-efficiency.instructions.md',
  'responsible-ai':            'waf-responsible-ai.instructions.md'
};

/**
 * Resolve knowledge module references into content.
 * @param {string[]} moduleIds - FROOT module IDs from manifest.context.knowledge
 * @returns {{ modules: object[], missing: string[] }}
 */
function resolveKnowledge(moduleIds) {
  const modules = [];
  const missing = [];

  // Try bundled knowledge first (faster, pre-processed)
  let bundled = null;
  if (existsSync(KNOWLEDGE_BUNDLE)) {
    try {
      bundled = JSON.parse(readFileSync(KNOWLEDGE_BUNDLE, 'utf8'));
    } catch { /* fallback to direct file read */ }
  }

  for (const id of moduleIds) {
    const filename = MODULE_MAP[id];
    if (!filename) {
      // Try fuzzy match (e.g., "R2-RAG-Architecture" matches "RAG-Architecture")
      const fuzzyKey = Object.keys(MODULE_MAP).find(k => k.includes(id) || id.includes(k.split('-').slice(1).join('-')));
      if (fuzzyKey) {
        const path = join(DOCS_DIR, MODULE_MAP[fuzzyKey]);
        if (existsSync(path)) {
          modules.push({
            id: fuzzyKey,
            filename: MODULE_MAP[fuzzyKey],
            content: readFileSync(path, 'utf8'),
            source: 'docs'
          });
          continue;
        }
      }
      missing.push(id);
      continue;
    }

    // Try bundled first
    if (bundled && bundled.modules && typeof bundled.modules === 'object') {
      // knowledge.json uses object keyed by module ID (e.g., bundled.modules.F1)
      const moduleKey = id.split('-')[0]; // "R2-RAG-Architecture" → "R2"
      const bundledModule = bundled.modules[moduleKey] || bundled.modules[id];
      if (bundledModule) {
        modules.push({ id, filename, content: bundledModule.content || bundledModule.summary || JSON.stringify(bundledModule), source: 'bundle' });
        continue;
      }
    }

    // Fallback to direct file read
    const path = join(DOCS_DIR, filename);
    if (existsSync(path)) {
      modules.push({ id, filename, content: readFileSync(path, 'utf8'), source: 'docs' });
    } else {
      missing.push(id);
    }
  }

  return { modules, missing };
}

/**
 * Resolve WAF pillar instructions into content.
 * @param {string[]} pillars - WAF pillar names from manifest.context.waf
 * @returns {{ wafInstructions: object[], missing: string[] }}
 */
function resolveWAF(pillars) {
  const wafInstructions = [];
  const missing = [];
  const instructionsDir = join(ROOT, '.github', 'instructions');

  for (const pillar of pillars) {
    const filename = WAF_MAP[pillar];
    if (!filename) { missing.push(pillar); continue; }

    const path = join(instructionsDir, filename);
    if (existsSync(path)) {
      wafInstructions.push({ pillar, filename, content: readFileSync(path, 'utf8') });
    } else {
      missing.push(pillar);
    }
  }

  return { wafInstructions, missing };
}

/**
 * Build the full shared context from a manifest's context section.
 * @param {object} contextConfig - manifest.context (knowledge, waf, scope)
 * @returns {{ knowledge: object[], waf: object[], scope: string, errors: string[] }}
 */
function buildContext(contextConfig) {
  const errors = [];

  const { modules, missing: missingModules } = resolveKnowledge(contextConfig.knowledge || []);
  if (missingModules.length > 0) {
    errors.push(`Missing knowledge modules: ${missingModules.join(', ')}`);
  }

  const { wafInstructions, missing: missingWaf } = resolveWAF(contextConfig.waf || []);
  if (missingWaf.length > 0) {
    errors.push(`Missing WAF instructions: ${missingWaf.join(', ')}`);
  }

  return {
    knowledge: modules,
    waf: wafInstructions,
    scope: contextConfig.scope || 'default',
    errors
  };
}

export { resolveKnowledge, resolveWAF, buildContext, MODULE_MAP, WAF_MAP };

/* ════════════════════════════════════════════════════════════════════
   [M10.2] resolveAttachPlan — merge MCP declarations across artifacts
   ────────────────────────────────────────────────────────────────────
   Reads each artifact's federation declaration and produces a merged
   plan the engine bridge (M10.1 `attachAreasForRun`) can consume:

     play.mcp_scope.attached[]                       → required
     play.mcp_scope.router_config.trust_overrides    → trustOverrides
     agent.mcpAttachments.required[]                 → required
     agent.mcpAttachments.optional[]                 → optional
     agent.mcpAttachments.trustOverrides{}           → trustOverrides
     skill.requiresMcp[]                             → required

   Dedup rule: an area in BOTH `required` and `optional` collapses to
   `required` (the stronger guarantee wins). All areas are returned
   alphabetically sorted so callers can compare plans byte-equivalent.

   Schema today:
     - play.mcp_scope     — schemas/fai-manifest-mcp-scope-v1.schema.json
     - agent.mcpAttachments + skill.requiresMcp — informally documented
       by the M10.16 instruction file (lands later in M10); the resolver
       tolerates absent / null fields silently so M10.2 ships before any
       artifact has populated its declarations (M10.17+ rows).
   ──────────────────────────────────────────────────────────────────── */

/** Canonical trust tiers (mirror of mcp-scope schema). */
const TRUST_TIERS = new Set(['first-party-ms', 'verified-publisher', 'community', 'untrusted']);

function _normaliseAreaList(value, dest) {
  if (!Array.isArray(value)) return;
  for (const a of value) {
    if (typeof a === 'string' && a.length > 0) dest.add(a);
  }
}

function _mergeTrustOverrides(value, dest) {
  if (!value || typeof value !== 'object') return;
  for (const [area, tier] of Object.entries(value)) {
    if (typeof area !== 'string' || area.length === 0) continue;
    if (typeof tier !== 'string' || !TRUST_TIERS.has(tier)) continue;
    dest[area] = tier;
  }
}

/**
 * @typedef {object} ResolvedAttachPlan
 * @property {string[]}                       requiredAreas    Alphabetically sorted.
 * @property {string[]}                       optionalAreas    Sorted; never overlaps required.
 * @property {Record<string, string>}         trustOverrides   area → trust-tier.
 * @property {object}                         sources          Debug breakdown: which artifact contributed what.
 */

/**
 * @param {object} input
 * @param {object} [input.playManifest] Full play manifest (may have `mcp_scope`).
 * @param {Array<object>} [input.agents]   Each entry may have `mcpAttachments`.
 * @param {Array<object>} [input.skills]   Each entry may have `requiresMcp`.
 * @returns {ResolvedAttachPlan}
 */
function resolveAttachPlan(input) {
  const o = input || {};
  const playManifest = o.playManifest || null;
  const agents = Array.isArray(o.agents) ? o.agents : [];
  const skills = Array.isArray(o.skills) ? o.skills : [];

  const required = new Set();
  const optional = new Set();
  const trustOverrides = {};
  const sources = { play: [], agents: {}, skills: {} };

  // 1. Play
  const scope = playManifest && playManifest.mcp_scope;
  if (scope) {
    if (Array.isArray(scope.attached)) {
      for (const a of scope.attached) {
        if (typeof a === 'string' && a.length > 0) {
          required.add(a);
          sources.play.push(a);
        }
      }
    }
    if (scope.router_config && typeof scope.router_config === 'object') {
      _mergeTrustOverrides(scope.router_config.trust_overrides, trustOverrides);
    }
  }

  // 2. Agents
  for (const agent of agents) {
    if (!agent || typeof agent !== 'object') continue;
    const ma = agent.mcpAttachments;
    if (!ma || typeof ma !== 'object') continue;
    const agentId = agent.id || agent.name || '?';
    const contrib = { required: [], optional: [] };

    // Shape A: { required: string[], optional: string[], trustOverrides: {} }
    if (Array.isArray(ma.required)) {
      for (const a of ma.required) {
        if (typeof a === 'string' && a.length > 0) {
          required.add(a);
          contrib.required.push(a);
        }
      }
    }
    if (Array.isArray(ma.optional)) {
      for (const a of ma.optional) {
        if (typeof a === 'string' && a.length > 0) {
          optional.add(a);
          contrib.optional.push(a);
        }
      }
    }
    _mergeTrustOverrides(ma.trustOverrides, trustOverrides);

    // Shape B fallback: bare string[] = all optional (backward-compatible).
    if (Array.isArray(ma) && contrib.required.length === 0 && contrib.optional.length === 0) {
      for (const a of ma) {
        if (typeof a === 'string' && a.length > 0) {
          optional.add(a);
          contrib.optional.push(a);
        }
      }
    }

    sources.agents[agentId] = contrib;
  }

  // 3. Skills (`requiresMcp` is by definition required)
  for (const skill of skills) {
    if (!skill || typeof skill !== 'object') continue;
    const rm = skill.requiresMcp;
    if (!Array.isArray(rm)) continue;
    const skillId = skill.id || skill.name || '?';
    const contrib = [];
    for (const a of rm) {
      if (typeof a === 'string' && a.length > 0) {
        required.add(a);
        contrib.push(a);
      }
    }
    if (contrib.length > 0) sources.skills[skillId] = contrib;
  }

  // Dedup: required wins over optional.
  for (const a of required) optional.delete(a);

  return {
    requiredAreas: [...required].sort(),
    optionalAreas: [...optional].sort(),
    trustOverrides,
    sources,
  };
}

/**
 * Convert a merged plan into the M10.1 `attachAreasForRun({areas})` input.
 *
 * @param {ResolvedAttachPlan} merged
 * @param {object} [opts]
 * @param {boolean} [opts.includeOptional=false]
 * @returns {{ areas: Array<{name: string, trustOverride?: boolean}> }}
 */
function toAttachPlan(merged, opts) {
  const o = opts || {};
  const includeOptional = !!o.includeOptional;
  if (!merged || typeof merged !== 'object') return { areas: [] };
  const areas = [];
  const seen = new Set();
  const trustOverrides = merged.trustOverrides || {};

  for (const name of merged.requiredAreas || []) {
    if (seen.has(name)) continue;
    seen.add(name);
    const e = { name };
    if (trustOverrides[name]) e.trustOverride = true;
    areas.push(e);
  }
  if (includeOptional) {
    for (const name of merged.optionalAreas || []) {
      if (seen.has(name)) continue;
      seen.add(name);
      const e = { name };
      if (trustOverrides[name]) e.trustOverride = true;
      areas.push(e);
    }
  }
  return { areas };
}

export { resolveAttachPlan, toAttachPlan, TRUST_TIERS };
