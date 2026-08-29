/**
 * BM25 Search Engine — ported from FAI MCP Server (npm-mcp/index.js)
 * Probabilistic ranking function for full-text search.
 *
 * BM25 (Best Matching 25) parameters:
 *   k1 (1.2-2.0): Term saturation. Higher = longer docs get more credit.
 *   b  (0.75):    Length normalization. 0 = no normalization, 1 = full.
 * Score = Σ IDF(t) × (tf × (k1+1)) / (tf + k1 × (1 - b + b × dl/avgdl))
 */

import * as fs from "fs";

/** A single document in the BM25 index */
export interface BM25Doc {
  id?: string;
  title: string;
  len: number;
  tf: Record<string, number>;
  meta: Record<string, string>;
}

/** Pre-built BM25 search index (from search-index.json) */
export interface BM25Index {
  stats: { docs: number; terms: number; avgDocLen: number };
  params: { k1: number; b: number; avgDocLen: number };
  idf: Record<string, number>;
  docs: BM25Doc[];
}

/** BM25 search result */
export interface BM25Result {
  docIndex: number;
  score: number;
  normalizedScore: number;
}

// Common English stop words filtered from search queries.
// Source: Standard IR stop word list + common function words (matches npm-mcp).
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "up", "out", "as", "is", "was", "are", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "need", "that", "this",
  "these", "those", "it", "its", "not", "also", "but", "if", "then", "when",
  "where", "who", "which", "how", "what", "all", "both", "each", "few", "more",
  "most", "other", "some", "such", "than", "too", "very", "just", "about",
  "above", "after", "before", "between", "into", "through", "during",
  "including", "until", "against", "among", "throughout", "within", "without",
  "over", "under", "again", "so", "yet", "only", "even", "back", "still",
]);

/** Tokenize query text for BM25 matching (matches npm-mcp tokenizer) */
export function tokenizeQuery(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t));
}

/**
 * Score a single document against query tokens using BM25.
 * Returns 0..∞ (unnormalized). Higher = more relevant.
 */
export function bm25Score(queryTokens: string[], doc: BM25Doc, index: BM25Index): number {
  const { idf, params } = index;
  const { k1, b, avgDocLen } = params;
  let score = 0;
  const docLen = doc.len;
  for (const term of queryTokens) {
    if (!idf[term] || !doc.tf[term]) continue;
    const tf = doc.tf[term];
    const tfScore = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)));
    score += idf[term] * tfScore;
  }
  return score;
}

/** Load and parse BM25 index from a JSON file path */
export function loadBM25Index(jsonPath: string): BM25Index | null {
  try {
    if (!fs.existsSync(jsonPath)) return null;
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    if (!data?.docs || !data?.idf || !data?.params) return null;
    return data as BM25Index;
  } catch {
    return null;
  }
}

/** Search the BM25 index and return top-K results with normalized scores */
export function searchPlays(
  query: string,
  index: BM25Index,
  topK: number = 5,
): BM25Result[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const scored = index.docs
    .map((doc, i) => ({ docIndex: i, score: bm25Score(tokens, doc, index) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const maxScore = scored[0]?.score || 1;
  return scored.map(s => ({
    ...s,
    normalizedScore: s.score / maxScore,
  }));
}
