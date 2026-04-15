/** FROOT Knowledge Module */
export interface FrootModule {
  id: string;
  title: string;
  layer: string;
  emoji: string;
  metaphor: string;
  file: string;
  content: string;
  sections: Section[];
}

export interface Section {
  title: string;
  content: string;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface SearchResult {
  moduleId: string;
  moduleTitle: string;
  layer: string;
  sectionTitle: string;
  score: number;
  preview: string;
}

/** FROOT layer metadata */
export interface FrootLayer {
  name: string;
  emoji: string;
  metaphor: string;
  modules: Record<string, { file: string; title: string }>;
}

export type FrootMap = Record<string, FrootLayer>;
