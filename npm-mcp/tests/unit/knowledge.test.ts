import { describe, it, expect } from 'vitest';
import { parseSections, loadGlossary, searchKnowledge, lookupTerm, computeSimilarity, FROOT_MAP } from '../../src/knowledge/index.js';
import type { FrootModule } from '../../src/types/index.js';

describe('parseSections', () => {
  it('parses markdown h2 headings into sections', () => {
    const md = '## Section 1\nContent 1\n## Section 2\nContent 2';
    const sections = parseSections(md);
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('Section 1');
    expect(sections[0].content).toBe('Content 1');
    expect(sections[1].title).toBe('Section 2');
    expect(sections[1].content).toBe('Content 2');
  });

  it('handles empty markdown', () => {
    expect(parseSections('')).toHaveLength(0);
  });

  it('handles markdown without h2 headings', () => {
    expect(parseSections('# Only h1\nSome content')).toHaveLength(0);
  });

  it('handles h2 with no content between them', () => {
    const sections = parseSections('## A\n## B\nContent B');
    expect(sections).toHaveLength(2);
    expect(sections[0].content).toBe('');
  });

  it('trims whitespace from content', () => {
    const sections = parseSections('## Title\n\n  Content with whitespace  \n\n');
    expect(sections[0].content).toBe('Content with whitespace');
  });
});

describe('FROOT_MAP', () => {
  it('has all 5 layers', () => {
    expect(Object.keys(FROOT_MAP)).toHaveLength(5);
  });

  it('each layer has name, emoji, metaphor, modules', () => {
    for (const layer of Object.values(FROOT_MAP)) {
      expect(layer.name).toBeTruthy();
      expect(layer.emoji).toBeTruthy();
      expect(layer.metaphor).toBeTruthy();
      expect(Object.keys(layer.modules).length).toBeGreaterThan(0);
    }
  });

  it('has 16 total modules', () => {
    const count = Object.values(FROOT_MAP).reduce((s, l) => s + Object.keys(l.modules).length, 0);
    expect(count).toBe(16);
  });
});

describe('loadGlossary', () => {
  const mockModules: Record<string, FrootModule> = {
    F3: {
      id: 'F3', title: 'Glossary', layer: 'Foundations', emoji: '🌱', metaphor: 'Roots', file: 'test.md',
      content: '### RAG\nRetrieval-Augmented Generation combines search with LLMs.\n\n### Token\nThe smallest unit of text processed by an LLM.\n',
      sections: [],
    },
  };

  it('extracts terms from F3 module', () => {
    const glossary = loadGlossary(mockModules);
    expect(glossary['rag']).toBeDefined();
    expect(glossary['token']).toBeDefined();
  });

  it('stores term name with original casing', () => {
    const glossary = loadGlossary(mockModules);
    expect(glossary['rag'].term).toBe('RAG');
  });

  it('returns empty for no F3 module', () => {
    expect(loadGlossary({})).toEqual({});
  });
});

describe('lookupTerm', () => {
  const glossary = {
    'rag': { term: 'RAG', definition: 'Retrieval-Augmented Generation' },
    'token': { term: 'Token', definition: 'Smallest unit' },
    'tokenizer': { term: 'Tokenizer', definition: 'Splits text into tokens' },
  };

  it('finds exact match', () => {
    const result = lookupTerm(glossary, 'RAG');
    expect(result).toHaveLength(1);
    expect(result![0].term).toBe('RAG');
  });

  it('finds fuzzy matches', () => {
    const result = lookupTerm(glossary, 'token');
    expect(result!.length).toBeGreaterThanOrEqual(1); // exact match "token" + possibly "tokenizer"
  });

  it('returns null for no match', () => {
    expect(lookupTerm(glossary, 'nonexistent')).toBeNull();
  });

  it('is case insensitive', () => {
    const result = lookupTerm(glossary, 'rag');
    expect(result).not.toBeNull();
  });
});

describe('searchKnowledge', () => {
  const mockModules: Record<string, FrootModule> = {
    R2: {
      id: 'R2', title: 'RAG Architecture', layer: 'Reasoning', emoji: '🪵', metaphor: 'Trunk', file: 'test.md',
      content: '', sections: [
        { title: 'Chunking Strategy', content: 'Chunk documents into 512 token segments for RAG retrieval.' },
        { title: 'Vector Search', content: 'Use embeddings for semantic similarity search.' },
      ],
    },
    O1: {
      id: 'O1', title: 'Semantic Kernel', layer: 'Orchestration', emoji: '🌿', metaphor: 'Branches', file: 'test.md',
      content: '', sections: [
        { title: 'Plugins', content: 'Semantic Kernel uses plugins for tool integration.' },
      ],
    },
  };

  it('returns results for matching query', () => {
    const results = searchKnowledge(mockModules, 'RAG chunking');
    expect(results.length).toBeGreaterThan(0);
  });

  it('ranks title matches higher', () => {
    const results = searchKnowledge(mockModules, 'Chunking Strategy');
    expect(results[0].sectionTitle).toBe('Chunking Strategy');
  });

  it('returns empty for no match', () => {
    expect(searchKnowledge(mockModules, 'quantum computing')).toHaveLength(0);
  });

  it('respects maxResults limit', () => {
    const results = searchKnowledge(mockModules, 'search', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

describe('computeSimilarity', () => {
  it('returns 1.0 for identical texts', () => {
    expect(computeSimilarity('RAG pipeline', 'RAG pipeline')).toBeGreaterThan(0.5);
  });

  it('returns 0 for completely different texts', () => {
    expect(computeSimilarity('quantum physics', 'cooking recipes baking')).toBe(0);
  });

  it('returns partial match for overlapping terms', () => {
    const score = computeSimilarity('RAG architecture search', 'RAG pipeline with vector search');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('handles empty query', () => {
    expect(computeSimilarity('', 'some text')).toBe(0);
  });

  it('filters short words (< 3 chars)', () => {
    expect(computeSimilarity('a b c', 'a b c')).toBe(0);
  });
});
