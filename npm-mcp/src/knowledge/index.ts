import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { FrootModule, Section, FrootMap, GlossaryEntry, SearchResult } from '../types/index.js';

export const FROOT_MAP: FrootMap = {
  F: {
    name: 'Foundations', emoji: '🌱', metaphor: 'The Roots',
    modules: {
      F1: { file: 'GenAI-Foundations.md', title: 'GenAI Foundations' },
      F2: { file: 'LLM-Landscape.md', title: 'LLM Landscape & Model Selection' },
      F3: { file: 'F3-AI-Glossary-AZ.md', title: 'AI Glossary A–Z' },
      F4: { file: 'F4-GitHub-Agentic-OS.md', title: '.github Agentic OS — 7 Primitives' },
    },
  },
  R: {
    name: 'Reasoning', emoji: '🪵', metaphor: 'The Trunk',
    modules: {
      R1: { file: 'Prompt-Engineering.md', title: 'Prompt Engineering & Grounding' },
      R2: { file: 'RAG-Architecture.md', title: 'RAG Architecture & Retrieval' },
      R3: { file: 'R3-Deterministic-AI.md', title: 'Making AI Deterministic & Reliable' },
    },
  },
  O_ORCH: {
    name: 'Orchestration', emoji: '🌿', metaphor: 'The Branches',
    modules: {
      O1: { file: 'Semantic-Kernel.md', title: 'Semantic Kernel & Orchestration' },
      O2: { file: 'AI-Agents-Deep-Dive.md', title: 'AI Agents & Microsoft Agent Framework' },
      O3: { file: 'O3-MCP-Tools-Functions.md', title: 'MCP, Tools & Function Calling' },
    },
  },
  O_OPS: {
    name: 'Operations', emoji: '🏗️', metaphor: 'The Canopy',
    modules: {
      O4: { file: 'Azure-AI-Foundry.md', title: 'Azure AI Platform & Landing Zones' },
      O5: { file: 'AI-Infrastructure.md', title: 'AI Infrastructure & Hosting' },
      O6: { file: 'Copilot-Ecosystem.md', title: 'Copilot Ecosystem & Low-Code AI' },
    },
  },
  T: {
    name: 'Transformation', emoji: '🍎', metaphor: 'The Fruit',
    modules: {
      T1: { file: 'T1-Fine-Tuning-MLOps.md', title: 'Fine-Tuning & Model Customization' },
      T2: { file: 'Responsible-AI-Safety.md', title: 'Responsible AI & Safety' },
      T3: { file: 'T3-Production-Patterns.md', title: 'Production Architecture Patterns' },
    },
  },
};

/** Parse markdown into sections by ## headings */
export function parseSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const lines = markdown.split('\n');
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

/** Load modules — tries bundled JSON first, falls back to local files */
export function loadModules(bundlePath: string, docsDir: string): Record<string, FrootModule> {
  if (existsSync(bundlePath)) {
    const bundle = JSON.parse(readFileSync(bundlePath, 'utf-8'));
    const modules: Record<string, FrootModule> = {};
    for (const [modId, mod] of Object.entries(bundle.modules) as [string, any][]) {
      modules[modId] = { ...mod, sections: parseSections(mod.content) };
    }
    return modules;
  }

  const modules: Record<string, FrootModule> = {};
  for (const [layerKey, layer] of Object.entries(FROOT_MAP)) {
    for (const [modId, mod] of Object.entries(layer.modules)) {
      const filePath = join(docsDir, mod.file);
      const content = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
      modules[modId] = {
        id: modId, title: mod.title, layer: layer.name,
        emoji: layer.emoji, metaphor: layer.metaphor, file: mod.file,
        content, sections: parseSections(content),
      };
    }
  }
  return modules;
}

/** Extract glossary terms from F3 module */
export function loadGlossary(modules: Record<string, FrootModule>): Record<string, GlossaryEntry> {
  const glossary: Record<string, GlossaryEntry> = {};
  const f3 = modules.F3;
  if (!f3) return glossary;

  const lines = f3.content.split('\n');
  let currentTerm: string | null = null;
  let currentDef: string[] = [];

  for (const line of lines) {
    const termMatch = line.match(/^### (.+)/);
    if (termMatch) {
      if (currentTerm) {
        glossary[currentTerm.toLowerCase()] = { term: currentTerm, definition: currentDef.join('\n').trim() };
      }
      currentTerm = termMatch[1].replace(/\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]+\s*$/u, '').trim();
      currentDef = [];
    } else if (currentTerm) {
      currentDef.push(line);
    }
  }
  if (currentTerm) {
    glossary[currentTerm.toLowerCase()] = { term: currentTerm, definition: currentDef.join('\n').trim() };
  }
  return glossary;
}

/** Full-text search across all modules */
export function searchKnowledge(modules: Record<string, FrootModule>, query: string, maxResults = 5): SearchResult[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  const scored: SearchResult[] = [];
  for (const mod of Object.values(modules)) {
    for (const section of mod.sections) {
      const text = (section.title + ' ' + section.content).toLowerCase();
      let score = 0;
      if (text.includes(queryLower)) score += 10;
      for (const word of queryWords) {
        const matches = text.match(new RegExp(word, 'gi'));
        if (matches) score += matches.length;
      }
      if (section.title.toLowerCase().includes(queryLower)) score += 20;
      for (const word of queryWords) {
        if (section.title.toLowerCase().includes(word)) score += 5;
      }
      if (score > 0) {
        scored.push({
          moduleId: mod.id, moduleTitle: mod.title,
          layer: `${mod.emoji} ${mod.layer}`, sectionTitle: section.title,
          score, preview: section.content.substring(0, 500) + (section.content.length > 500 ? '...' : ''),
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

/** Lookup a glossary term — direct match → fuzzy match */
export function lookupTerm(glossary: Record<string, GlossaryEntry>, term: string): GlossaryEntry[] | null {
  const key = term.toLowerCase().trim();
  if (glossary[key]) return [glossary[key]];
  const matches = Object.entries(glossary)
    .filter(([k, v]) => k.includes(key) || v.term.toLowerCase().includes(key))
    .slice(0, 5)
    .map(([, v]) => v);
  return matches.length > 0 ? matches : null;
}

/** Compute keyword similarity between query and text */
export function computeSimilarity(query: string, text: string): number {
  const qt = query.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
  const tt = text.toLowerCase().split(/\s+/);
  if (qt.length === 0) return 0;
  let hits = 0;
  for (const q of qt) {
    for (const t of tt) {
      if (t.includes(q) || q.includes(t)) { hits++; break; }
    }
  }
  return hits / qt.length;
}
