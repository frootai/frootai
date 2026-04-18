import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');

describe('MCP Server Integration', () => {
  describe('Knowledge Bundle', () => {
    it('knowledge.json exists and is valid JSON', () => {
      const kPath = join(rootDir, 'knowledge.json');
      expect(existsSync(kPath)).toBe(true);
      const k = JSON.parse(readFileSync(kPath, 'utf-8'));
      expect(k.modules).toBeDefined();
      expect(Object.keys(k.modules).length).toBeGreaterThanOrEqual(16);
    });

    it('every module has title and content', () => {
      const k = JSON.parse(readFileSync(join(rootDir, 'knowledge.json'), 'utf-8'));
      for (const [id, mod] of Object.entries(k.modules) as [string, any][]) {
        expect(mod.title, `Module ${id} missing title`).toBeTruthy();
        expect(mod.content?.length, `Module ${id} has empty content`).toBeGreaterThan(100);
      }
    });

    it('knowledge.json has version and built fields', () => {
      const k = JSON.parse(readFileSync(join(rootDir, 'knowledge.json'), 'utf-8'));
      expect(k.version).toBeTruthy();
      expect(k.built).toBeTruthy();
    });

    it('knowledge.json has layers defined', () => {
      const k = JSON.parse(readFileSync(join(rootDir, 'knowledge.json'), 'utf-8'));
      expect(k.layers).toBeDefined();
      expect(Object.keys(k.layers).length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Search Index', () => {
    it('search-index.json exists and has valid structure', () => {
      const siPath = join(rootDir, 'search-index.json');
      if (existsSync(siPath)) {
        const si = JSON.parse(readFileSync(siPath, 'utf-8'));
        expect(si.stats).toBeDefined();
        expect(si.params).toBeDefined();
        expect(si.idf).toBeDefined();
        expect(si.docs).toBeDefined();
        expect(si.docs.length).toBeGreaterThan(0);
        expect(si.params.k1).toBeGreaterThan(0);
        expect(si.params.b).toBeGreaterThanOrEqual(0);
        expect(si.params.b).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Package Metadata', () => {
    it('package.json has correct name and bin entry', () => {
      const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
      expect(pkg.bin).toBeDefined();
      expect(pkg.name).toBe('frootai-mcp');
      expect(pkg.bin['frootai-mcp']).toBeDefined();
    });

    it('package.json declares ESM type', () => {
      const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
      expect(pkg.type).toBe('module');
    });

    it('index.js exists as entry point', () => {
      expect(existsSync(join(rootDir, 'index.js'))).toBe(true);
    });
  });

  describe('Endpoints Configuration', () => {
    it('endpoints.js exports ENDPOINTS object', async () => {
      const { ENDPOINTS } = await import('../../endpoints.js');
      expect(ENDPOINTS).toBeDefined();
      expect(ENDPOINTS.GITHUB_API).toBeDefined();
      expect(ENDPOINTS.FROOTAI_WEBSITE).toBeDefined();
    });

    it('ENDPOINTS contains expected keys', async () => {
      const { ENDPOINTS } = await import('../../endpoints.js');
      expect(ENDPOINTS.GITHUB_RAW).toBeDefined();
      expect(ENDPOINTS.MICROSOFT_LEARN_API).toBeDefined();
      expect(ENDPOINTS.MCP_REGISTRY).toBeDefined();
    });

    it('endpoint URLs are valid strings', async () => {
      const { ENDPOINTS } = await import('../../endpoints.js');
      for (const [key, url] of Object.entries(ENDPOINTS)) {
        expect(typeof url).toBe('string');
        expect((url as string).startsWith('http')).toBe(true);
      }
    });
  });

  describe('Auto-Update Module', () => {
    it('auto-update.js exports getLatestKnowledge', async () => {
      const mod = await import('../../auto-update.js');
      expect(mod.getLatestKnowledge).toBeDefined();
      expect(typeof mod.getLatestKnowledge).toBe('function');
    });
  });

  describe('TypeScript Compilation', () => {
    it('dist/ directory exists with compiled output', () => {
      expect(existsSync(join(rootDir, 'dist'))).toBe(true);
    });

    it('dist/server.js exists', () => {
      expect(existsSync(join(rootDir, 'dist', 'server.js'))).toBe(true);
    });
  });
});
