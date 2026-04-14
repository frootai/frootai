import type { FrootModule, SearchResult, GlossaryEntry, Section } from '../types/index.js';
import { readFileSync, existsSync } from 'fs';

export interface KnowledgeBundle {
  version: string;
  built: string;
  layers: Record<string, { name: string; emoji: string; metaphor: string; moduleIds: string[] }>;
  modules: Record<string, FrootModule>;
  ecosystem?: {
    primitives?: Record<string, { count: number; desc: string }>;
  };
}

/**
 * Load and parse knowledge.json into a KnowledgeBundle.
 * Returns the raw bundle with module sections pre-parsed.
 */
export function loadKnowledge(knowledgePath: string): KnowledgeBundle {
  if (!existsSync(knowledgePath)) {
    throw new Error(`Knowledge file not found: ${knowledgePath}`);
  }
  const raw = readFileSync(knowledgePath, 'utf-8');
  const bundle: KnowledgeBundle = JSON.parse(raw);

  // Ensure every module has parsed sections
  for (const [id, mod] of Object.entries(bundle.modules)) {
    if (!mod.sections || mod.sections.length === 0) {
      bundle.modules[id] = { ...mod, sections: parseSections(mod.content) };
    }
  }

  return bundle;
}

/**
 * Parse markdown content into titled sections split on ## headings.
 * Each section contains the heading title and the content below it
 * (up to the next ## heading).
 */
export function parseSections(content: string): Section[] {
  const sections: Section[] = [];
  const lines = content.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)/);
    if (h2Match) {
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
      }
      currentTitle = h2Match[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
  }
  return sections;
}

/**
 * Search across all modules by query terms.
 * Scores each section using exact phrase match, individual word frequency,
 * and title match bonuses. Returns results sorted by score descending.
 */
export function searchModules(
  modules: Record<string, FrootModule>,
  query: string,
  maxResults: number = 5
): SearchResult[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  const scored: SearchResult[] = [];

  for (const mod of Object.values(modules)) {
    for (const section of mod.sections) {
      const text = (section.title + ' ' + section.content).toLowerCase();
      let score = 0;

      // Exact phrase match (highest value)
      if (text.includes(queryLower)) score += 10;

      // Individual word matches — count occurrences
      for (const word of queryWords) {
        const regex = new RegExp(word, 'gi');
        const matches = text.match(regex);
        if (matches) score += matches.length;
      }

      // Title match bonus
      if (section.title.toLowerCase().includes(queryLower)) score += 20;
      for (const word of queryWords) {
        if (section.title.toLowerCase().includes(word)) score += 5;
      }

      if (score > 0) {
        scored.push({
          moduleId: mod.id,
          moduleTitle: mod.title,
          layer: `${mod.emoji} ${mod.layer}`,
          sectionTitle: section.title,
          score,
          preview: section.content.substring(0, 500) + (section.content.length > 500 ? '...' : ''),
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

/**
 * Look up a glossary term from the F3 module content.
 * Supports exact match by lowercase key and fuzzy partial matching.
 * Returns the first matching entry or null.
 */
export function lookupGlossaryTerm(f3Content: string, term: string): GlossaryEntry | null {
  const glossary = parseGlossary(f3Content);
  const key = term.toLowerCase().trim();

  // Direct match
  if (glossary[key]) {
    return glossary[key];
  }

  // Fuzzy match — find terms containing the search string
  const match = Object.entries(glossary)
    .find(([k, v]) => k.includes(key) || v.term.toLowerCase().includes(key));

  return match ? match[1] : null;
}

/**
 * Parse glossary terms from F3 module markdown content.
 * Entries are identified by ### headings with definitions below.
 */
function parseGlossary(content: string): Record<string, GlossaryEntry> {
  const glossary: Record<string, GlossaryEntry> = {};
  const lines = content.split('\n');
  let currentTerm: string | null = null;
  let currentDef: string[] = [];

  for (const line of lines) {
    const termMatch = line.match(/^### (.+)/);
    if (termMatch) {
      if (currentTerm) {
        glossary[currentTerm.toLowerCase()] = {
          term: currentTerm,
          definition: currentDef.join('\n').trim(),
        };
      }
      // Strip trailing emoji tags
      currentTerm = termMatch[1]
        .replace(/\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]+\s*$/u, '')
        .trim();
      currentDef = [];
    } else if (currentTerm) {
      currentDef.push(line);
    }
  }
  if (currentTerm) {
    glossary[currentTerm.toLowerCase()] = {
      term: currentTerm,
      definition: currentDef.join('\n').trim(),
    };
  }

  return glossary;
}

/**
 * Compute text similarity score using keyword overlap.
 * Tokenizes both texts into words (≥3 chars), then checks bidirectional
 * substring inclusion between query words and text words.
 * Returns a value between 0 and 1 (proportion of query words matched).
 */
export function computeSimilarity(text1: string, text2: string): number {
  const qt = text1.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
  const tt = text2.toLowerCase().split(/\s+/);
  if (qt.length === 0) return 0;

  let hits = 0;
  for (const q of qt) {
    for (const t of tt) {
      if (t.includes(q) || q.includes(t)) {
        hits++;
        break;
      }
    }
  }

  return hits / qt.length;
}
