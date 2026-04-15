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
