/**
 * FrootAI SDK — Programmatic API
 *
 * Usage:
 *   // Full client (recommended)
 *   import { FrootAI } from 'frootai';
 *   const fai = new FrootAI();
 *   fai.search('RAG architecture');
 *   fai.plays.get('01');
 *   fai.evaluation.run({ groundedness: 0.95 });
 *
 *   // Direct imports (convenience)
 *   import { getPlay, searchKnowledge, getAllPlays } from 'frootai';
 *
 * @module frootai
 */

// Full SDK client
export { FrootAI, PlayManager, EvalRunner, ConfigManager } from './src/client.js';

// Convenience re-exports (backward compatible)
import { FrootAI } from './src/client.js';
const _client = new FrootAI();

export function getAllPlays() { return _client.plays.all(); }
export function getPlay(query) { return _client.plays.get(query); }
export function searchKnowledge(query, limit = 10) { return _client.search(query, { limit }); }
export function getGlossary() { return _client.getGlossary(); }
export function lookupTerm(term) { return _client.lookupTerm(term); }
export function getModules() { return _client.listModules(); }
export function getKnowledge() { return _client.knowledge; }
export function estimateCost(playId, scale) { return _client.estimateCost(playId, scale); }

import { createRequire } from 'module';
export const version = createRequire(import.meta.url)('./package.json').version;
