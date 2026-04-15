#!/usr/bin/env node
/**
 * FrootAI MCP — BM25 Search Index Builder
 * ─────────────────────────────────────────
 * Builds an offline BM25 search index from:
 *   • knowledge.json (18 modules, key sections)
 *   • solution-plays/ (100 plays — spec, README, manifest metadata)
 *
 * Output: search-index.json (~300-500KB)
 *
 * BM25 is the industry-standard probabilistic ranking function used by
 * Elasticsearch, Solr, and Lucene. It's dramatically better than keyword
 * overlap/Jaccard similarity because it accounts for:
 *   • Term frequency saturation (stops over-rewarding repeated terms)
 *   • Inverse document frequency (rare terms weighted higher)
 *   • Document length normalization (longer docs don't win unfairly)
 *
 * Run: node build-search-index.js
 * Outputs: search-index.json
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── BM25 Parameters ──────────────────────────────────────────────
const K1 = 1.5;    // term frequency saturation
const B  = 0.75;   // length normalization

// ─── Tokenizer ────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","and","are","as","at","be","been","being","but","by","do","does",
  "done","each","for","from","have","has","had","he","her","him","his",
  "how","i","if","in","is","it","its","me","my","no","not","of","on","or",
  "our","out","so","that","the","their","them","then","there","they","this",
  "to","up","us","was","we","were","what","when","which","who","will","with",
  "would","you","your","use","using","used","can","also","one","more","like",
  "get","set","new","via","per","vs","may","all","any","etc"
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t))
    .map(t => t.replace(/^-+|-+$/g, "")); // strip leading/trailing hyphens
}

function termFrequencies(tokens) {
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  return freq;
}

// ─── Document Builder ─────────────────────────────────────────────

function buildDoc(id, title, text, meta = {}) {
  const tokens = tokenize(title + " " + title + " " + text); // title 2x weight
  const tf = termFrequencies(tokens);
  return { id, title, tokens: tokens.length, tf, meta };
}

// ─── Load Sources ─────────────────────────────────────────────────

function loadKnowledgeDocs() {
  const kPath = join(__dirname, "knowledge.json");
  if (!existsSync(kPath)) {
    console.warn("knowledge.json not found — skipping module indexing");
    return [];
  }
  const k = JSON.parse(readFileSync(kPath, "utf-8"));
  const docs = [];

  for (const [modId, mod] of Object.entries(k.modules || {})) {
    // Split module into H2 sections (each section is a doc)
    const sections = mod.content.split(/^## /m).filter(Boolean);
    
    if (sections.length <= 2) {
      // Small module — index as single doc
      docs.push(buildDoc(
        `module:${modId}`,
        `${modId}: ${mod.title}`,
        mod.content.substring(0, 8000),
        { type: "module", modId, title: mod.title }
      ));
    } else {
      // Large module — split into sections for more precise retrieval
      sections.forEach((sec, i) => {
        const lines = sec.split("\n");
        const heading = lines[0].trim();
        const body = lines.slice(1).join("\n").trim().substring(0, 3000);
        if (body.length < 50) return; // skip near-empty sections
        docs.push(buildDoc(
          `module:${modId}:${i}`,
          `${modId}: ${mod.title} — ${heading}`,
          body,
          { type: "module_section", modId, title: mod.title, section: heading }
        ));
      });
    }
  }

  // Also index glossary terms as individual docs
  const f3 = k.modules?.F3?.content || "";
  const termMatches = [...f3.matchAll(/^### (.+)\n([\s\S]*?)(?=^### |\Z)/gm)];
  for (const [, term, body] of termMatches.slice(0, 200)) {
    const cleanTerm = term.replace(/\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]+\s*$/u, "").trim();
    if (cleanTerm && body.trim()) {
      docs.push(buildDoc(
        `term:${cleanTerm.toLowerCase().replace(/\s+/g, "_")}`,
        `Glossary: ${cleanTerm}`,
        body.trim().substring(0, 500),
        { type: "term", term: cleanTerm }
      ));
    }
  }

  return docs;
}

function loadPlayDocs() {
  const playsDir = join(__dirname, "..", "solution-plays");
  if (!existsSync(playsDir)) {
    console.warn("solution-plays/ not found — skipping play indexing");
    return [];
  }

  const docs = [];
  const playDirs = readdirSync(playsDir).filter(d => /^\d+/.test(d)).sort();

  for (const dir of playDirs) {
    const playPath = join(playsDir, dir);
    const playId = dir.split("-")[0];
    const playName = dir.split("-").slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

    // Gather text from multiple sources (order = priority)
    const textParts = [];

    // 1. spec/play-spec.json — most structured metadata
    const specPath = join(playPath, "spec", "play-spec.json");
    if (existsSync(specPath)) {
      try {
        const spec = JSON.parse(readFileSync(specPath, "utf-8"));
        textParts.push(
          spec.name || "",
          spec.description || "",
          (spec.services || []).join(" "),
          (spec.tags || []).join(" "),
          (spec.keywords || []).join(" "),
          JSON.stringify(spec.architecture || "")
        );
      } catch {}
    }

    // 2. fai-manifest.json — context knowledge + primitives
    const manifestPath = join(playPath, "fai-manifest.json");
    if (existsSync(manifestPath)) {
      try {
        const m = JSON.parse(readFileSync(manifestPath, "utf-8"));
        textParts.push(
          (m.context?.knowledge || []).join(" "),
          (m.context?.waf || []).join(" "),
          JSON.stringify(m.guardrails || ""),
          m.description || ""
        );
      } catch {}
    }

    // 3. copilot-instructions.md — domain knowledge
    const instrPath = join(playPath, ".github", "copilot-instructions.md");
    if (existsSync(instrPath)) {
      textParts.push(readFileSync(instrPath, "utf-8").substring(0, 2000));
    }

    // 4. agent.md — root agent description
    const agentPath = join(playPath, "agent.md");
    if (existsSync(agentPath)) {
      textParts.push(readFileSync(agentPath, "utf-8").substring(0, 1000));
    }

    // 5. README.md — user-facing description
    for (const readmeName of ["README.md", "readme.md"]) {
      const rPath = join(playPath, readmeName);
      if (existsSync(rPath)) {
        textParts.push(readFileSync(rPath, "utf-8").substring(0, 2000));
        break;
      }
    }

    // Play name + ID always included (2x weight)
    const fullText = `${playName} ${playName} ${dir} ` + textParts.filter(Boolean).join(" ");

    docs.push(buildDoc(
      `play:${playId}`,
      `Play ${playId}: ${playName}`,
      fullText,
      { type: "play", playId, dir, name: playName }
    ));
  }

  return docs;
}

// ─── Build BM25 Index ─────────────────────────────────────────────

function buildBM25Index(docs) {
  const N = docs.length;
  const avgDocLen = docs.reduce((s, d) => s + d.tokens, 0) / N;

  // Compute IDF for every term across all docs
  // df[term] = number of docs containing the term
  const df = {};
  for (const doc of docs) {
    for (const term of Object.keys(doc.tf)) {
      df[term] = (df[term] || 0) + 1;
    }
  }

  // IDF(t) = ln((N - df(t) + 0.5) / (df(t) + 0.5) + 1)  [Robertson IDF]
  const idf = {};
  for (const [term, freq] of Object.entries(df)) {
    idf[term] = Math.log(1 + (N - freq + 0.5) / (freq + 0.5));
  }

  // Prune terms with very low IDF (appear in >60% of docs — not informative)
  // and round IDF to 4 decimal places to reduce JSON size
  const MIN_IDF = 0.3;
  const prunedIdf = {};
  for (const [term, score] of Object.entries(idf)) {
    if (score >= MIN_IDF) {
      prunedIdf[term] = Math.round(score * 10000) / 10000;
    }
  }

  // Per-doc: keep only top-150 terms by TF (after IDF pruning) — reduces index size
  const TOP_TERMS_PER_DOC = 150;
  const indexedDocs = docs.map(d => {
    // Keep only terms that are in pruned IDF
    const filteredEntries = Object.entries(d.tf)
      .filter(([term]) => prunedIdf[term] !== undefined)
      .sort(([,a], [,b]) => b - a) // sort by frequency desc
      .slice(0, TOP_TERMS_PER_DOC);

    const prunedTf = Object.fromEntries(filteredEntries);
    return {
      id: d.id,
      title: d.title,
      len: d.tokens,
      tf: prunedTf,
      meta: d.meta,
    };
  });

  return {
    version: 2,
    built: new Date().toISOString(),
    params: { k1: K1, b: B, avgDocLen: Math.round(avgDocLen * 100) / 100 },
    stats: {
      docs: N,
      terms: Object.keys(prunedIdf).length,
      termsDropped: Object.keys(idf).length - Object.keys(prunedIdf).length,
    },
    idf: prunedIdf,
    docs: indexedDocs,
  };
}

// ─── Main ─────────────────────────────────────────────────────────

console.log("🔍 Building BM25 search index...");

const knowledgeDocs = loadKnowledgeDocs();
console.log(`  📚 Knowledge docs: ${knowledgeDocs.length}`);

const playDocs = loadPlayDocs();
console.log(`  🎮 Solution play docs: ${playDocs.length}`);

const allDocs = [...playDocs, ...knowledgeDocs];
console.log(`  📄 Total documents: ${allDocs.length}`);

const index = buildBM25Index(allDocs);
console.log(`  🔑 Unique terms: ${index.stats.terms}`);
console.log(`  📏 Avg doc length: ${index.params.avgDocLen} tokens`);

const outputPath = join(__dirname, "search-index.json");
writeFileSync(outputPath, JSON.stringify(index), "utf-8");

const sizeKB = Math.round(Buffer.byteLength(JSON.stringify(index)) / 1024);
console.log(`\n✅ search-index.json written (${sizeKB} KB)`);
console.log(`   ${index.stats.docs} docs × ${index.stats.terms} terms`);
console.log(`   BM25 params: k1=${K1}, b=${B}`);
