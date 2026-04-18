import { describe, it, expect } from 'vitest';
import { loadModules, FROOT_MAP } from '../../src/knowledge/index.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');

describe('knowledge — loadModules (from bundled JSON)', () => {
  const knowledgePath = join(rootDir, 'knowledge.json');
  const docsDir = join(rootDir, '..', 'docs'); // fallback dir

  it('loads all modules from knowledge.json bundle', () => {
    const modules = loadModules(knowledgePath, docsDir);
    expect(Object.keys(modules).length).toBeGreaterThanOrEqual(16);
  });

  it('every loaded module has parsed sections', () => {
    const modules = loadModules(knowledgePath, docsDir);
    for (const [id, mod] of Object.entries(modules)) {
      expect(Array.isArray(mod.sections), `${id} sections not array`).toBe(true);
    }
  });

  it('every loaded module has id and title', () => {
    const modules = loadModules(knowledgePath, docsDir);
    for (const [id, mod] of Object.entries(modules)) {
      expect(mod.id, `${id} missing id`).toBeTruthy();
      expect(mod.title, `${id} missing title`).toBeTruthy();
    }
  });

  it('falls back to local files when bundle missing', () => {
    const modules = loadModules('/nonexistent/knowledge.json', docsDir);
    // Even if docs dir doesn't exist, it should return an object keyed by FROOT_MAP ids
    const totalModules = Object.values(FROOT_MAP).reduce(
      (sum, layer) => sum + Object.keys(layer.modules).length, 0
    );
    expect(Object.keys(modules).length).toBe(totalModules);
  });
});

describe('knowledge — FROOT_MAP structure', () => {
  it('has exactly 5 layers', () => {
    expect(Object.keys(FROOT_MAP)).toHaveLength(5);
  });

  it('layers have expected keys', () => {
    const keys = Object.keys(FROOT_MAP);
    expect(keys).toContain('F');
    expect(keys).toContain('R');
    expect(keys).toContain('T');
  });

  it('each layer has name, emoji, metaphor, modules', () => {
    for (const [key, layer] of Object.entries(FROOT_MAP)) {
      expect(layer.name, `${key} name`).toBeTruthy();
      expect(layer.emoji, `${key} emoji`).toBeTruthy();
      expect(layer.metaphor, `${key} metaphor`).toBeTruthy();
      expect(Object.keys(layer.modules).length, `${key} modules`).toBeGreaterThan(0);
    }
  });

  it('F3 module file is the glossary', () => {
    expect(FROOT_MAP.F.modules.F3.title).toContain('Glossary');
  });
});
