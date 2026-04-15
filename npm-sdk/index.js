/**
 * FrootAI SDK — Programmatic API
 *
 * Import FrootAI data and utilities in your Node.js projects:
 *
 *   import { getPlay, searchKnowledge, getAllPlays } from 'frootai';
 *
 * @module frootai
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const KNOWLEDGE = require('frootai-mcp/knowledge.json');

// ─── Play index (100 plays) ───
const ALL_PLAYS = [
  '01-enterprise-rag', '02-ai-landing-zone', '03-deterministic-agent',
  '04-call-center-voice-ai', '05-it-ticket-resolution', '06-document-intelligence',
  '07-multi-agent-service', '08-copilot-studio-bot', '09-ai-search-portal',
  '10-content-moderation', '11-ai-landing-zone-advanced', '12-model-serving-aks',
  '13-fine-tuning-workflow', '14-cost-optimized-ai-gateway', '15-multi-modal-docproc',
  '16-copilot-teams-extension', '17-ai-observability', '18-prompt-management',
  '19-edge-ai-phi4', '20-anomaly-detection', '21-agentic-rag',
  '22-multi-agent-swarm', '23-browser-automation-agent', '24-ai-code-review',
  '25-ai-onboarding-assistant', '26-enterprise-search', '27-ai-customer-support',
  '28-knowledge-graph-rag', '29-mcp-gateway', '30-ai-security-hardening',
  '31-ai-data-pipeline', '32-ai-test-generation', '33-ai-image-analysis',
  '34-ai-translation', '35-ai-compliance', '36-conversational-bi',
  '37-ai-devops', '38-ai-recommendation', '39-ai-sentiment-analysis',
  '40-copilot-extension', '41-ai-red-teaming', '42-ai-summarization',
  '43-ai-email-assistant', '44-ai-meeting-assistant', '45-ai-form-processing',
  '46-ai-inventory-optimization', '47-ai-fraud-detection', '48-ai-content-generation',
  '49-ai-supply-chain', '50-ai-hr-assistant', '51-ai-research-assistant',
  '52-ai-finops-advisor', '53-ai-legal-review', '54-ai-healthcare-triage',
  '55-ai-education-tutor', '56-ai-accessibility', '57-ai-localization',
  '58-ai-sales-copilot', '59-ai-marketing-copilot', '60-responsible-ai-dashboard',
  '61-ai-content-safety', '62-ai-anomaly-root-cause', '63-ai-capacity-planning',
  '64-ai-incident-response', '65-ai-config-management', '66-ai-api-gateway',
  '67-ai-knowledge-management', '68-predictive-maintenance-ai', '69-carbon-footprint-tracker',
  '70-ai-governance-hub', '71-digital-twin-ai', '72-ai-quality-assurance',
  '73-ai-contract-analyzer', '74-ai-risk-assessment', '75-ai-portfolio-optimizer',
  '76-ai-claims-processing', '77-ai-underwriting', '78-ai-regulatory-reporting',
  '79-ai-customer-360', '80-ai-product-recommendation', '81-ai-dynamic-pricing',
  '82-ai-warehouse-optimization', '83-ai-route-optimization', '84-ai-demand-forecasting',
  '85-ai-document-comparison', '86-ai-contract-generation', '87-ai-patent-analysis',
  '88-ai-competitive-intelligence', '89-ai-market-research', '90-ai-brand-monitoring',
  '91-ai-social-listening', '92-ai-influencer-matching', '93-ai-ad-optimization',
  '94-ai-campaign-analytics', '95-ai-churn-prediction', '96-ai-lifetime-value',
  '97-ai-credit-scoring', '98-ai-anti-money-laundering', '99-ai-identity-verification',
  '100-ai-voice-biometrics',
];

/**
 * Get all solution plays
 * @returns {Array<{num: string, name: string, title: string}>}
 */
export function getAllPlays() {
  return ALL_PLAYS.map(name => {
    const num = name.replace(/-.*/, '');
    const title = name.replace(/^\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return { num, name, title };
  });
}

/**
 * Get a specific play by number or name
 * @param {string} query - Play number (01), name (enterprise-rag), or full ID (01-enterprise-rag)
 * @returns {object|null}
 */
export function getPlay(query) {
  const q = String(query).toLowerCase().replace(/^0+/, '');
  const plays = getAllPlays();
  return plays.find(p =>
    p.num.replace(/^0+/, '') === q ||
    p.num === String(query) ||
    p.name.includes(q) ||
    p.name === query
  ) || null;
}

/**
 * Search the FrootAI knowledge base
 * @param {string} query - Search query
 * @param {number} [limit=10] - Max results
 * @returns {Array<{title: string, content: string, score: number, type: string}>}
 */
export function searchKnowledge(query, limit = 10) {
  const terms = query.toLowerCase().split(/\s+/);
  const results = [];

  for (const [id, mod] of Object.entries(KNOWLEDGE.modules || {})) {
    const text = `${mod.title || ''} ${mod.content || ''}`.toLowerCase();
    const score = terms.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0) / terms.length;
    if (score > 0) results.push({ title: mod.title || id, content: (mod.content || '').slice(0, 200), score, type: 'module' });
  }

  for (const play of getAllPlays()) {
    const text = `${play.name} ${play.title}`.toLowerCase();
    const score = terms.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0) / terms.length;
    if (score > 0) results.push({ title: play.title, content: play.name, score, type: 'play' });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Get the FrootAI glossary
 * @returns {object} Map of term → definition
 */
export function getGlossary() {
  return KNOWLEDGE.glossary || {};
}

/**
 * Look up a term in the glossary
 * @param {string} term
 * @returns {string|null}
 */
export function lookupTerm(term) {
  const glossary = getGlossary();
  const key = Object.keys(glossary).find(k => k.toLowerCase() === term.toLowerCase());
  return key ? glossary[key] : null;
}

/**
 * Get all modules organized by layer
 * @returns {object}
 */
export function getModules() {
  return KNOWLEDGE.modules || {};
}

/**
 * Get the raw knowledge data
 * @returns {object}
 */
export function getKnowledge() {
  return KNOWLEDGE;
}

export const version = createRequire(import.meta.url)('./package.json').version;
