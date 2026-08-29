// @ts-check
/**
 * FAI Orchard CLI — pure fuzzy scoring (port of A3.26 scoreEntry).
 *
 * Same weights, same algorithm — so search results from the CLI MATCH the
 * website search results on the same entry set. Drift-tested via cli-orchard
 * test that asserts identical results for a fixed entry set + query.
 */
"use strict";

/**
 * @param {object} entry  slim accelerator entry
 * @param {string[]} tokens  pre-tokenized lowercase terms
 * @returns {number}
 */
function scoreEntry(entry, tokens) {
  if (!entry || typeof entry !== "object" || !Array.isArray(tokens) || tokens.length === 0) return 0;
  let score = 0;
  const name = String(entry.name || "").toLowerCase();
  const slug = String(entry.slug || "").toLowerCase();
  const tagline = String(entry.tagline || "").toLowerCase();
  const tech = Array.isArray(entry.tech) ? entry.tech.map((t) => String(t).toLowerCase()) : [];
  const categories = Array.isArray(entry.categories) ? entry.categories.map((c) => String(c).toLowerCase()) : [];

  for (const t of tokens) {
    if (!t || t.length < 2) continue;
    if (name.startsWith(t)) score += 10;
    else if (name.includes(t)) score += 5;
    if (tagline.includes(t)) score += 5;
    for (const tt of tech) if (tt.includes(t)) score += 3;
    for (const c of categories) if (c.includes(t)) score += 2;
    if (slug.includes(t)) score += 1;
  }
  return score;
}

/**
 * Tokenize a raw query string into lowercase ≥2-char terms.
 * @param {string} query
 * @returns {string[]}
 */
function tokenizeQuery(query) {
  if (typeof query !== "string") return [];
  return query.toLowerCase().trim().split(/\s+/).filter((t) => t.length >= 2);
}

module.exports = { scoreEntry, tokenizeQuery };
