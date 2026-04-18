import { describe, it, expect } from 'vitest';
import { getStaticResources, getModuleResources, getSchemaResources } from '../../src/resources/index.js';

describe('getStaticResources', () => {
  const resources = getStaticResources();

  it('returns at least 3 static resources', () => {
    expect(resources.length).toBeGreaterThanOrEqual(3);
  });

  it('every resource has required fields', () => {
    for (const r of resources) {
      expect(r.name).toBeTruthy();
      expect(r.uri).toBeTruthy();
      expect(r.mimeType).toBeTruthy();
      expect(r.description).toBeTruthy();
      expect(typeof r.generate).toBe('function');
    }
  });

  it('includes overview resource', () => {
    const overview = resources.find(r => r.name === 'fai-overview');
    expect(overview).toBeDefined();
    expect(overview!.uri).toBe('fai://overview');
    expect(overview!.mimeType).toBe('text/plain');
  });

  it('overview generate produces FrootAI text', () => {
    const overview = resources.find(r => r.name === 'fai-overview')!;
    const text = overview.generate();
    expect(text).toContain('FrootAI');
    expect(text).toContain('Foundations');
    expect(text).toContain('frootai.dev');
  });

  it('includes tool catalog resource', () => {
    const catalog = resources.find(r => r.name === 'fai-tool-catalog');
    expect(catalog).toBeDefined();
    expect(catalog!.mimeType).toBe('application/json');
  });

  it('tool catalog generates valid JSON with categories', () => {
    const catalog = resources.find(r => r.name === 'fai-tool-catalog')!;
    const parsed = JSON.parse(catalog.generate());
    expect(parsed.totalTools).toBe(45);
    expect(parsed.categories).toBeDefined();
    expect(parsed.categories.knowledge).toBeDefined();
    expect(parsed.categories.knowledge.count).toBe(6);
  });

  it('includes WAF pillars resource', () => {
    const waf = resources.find(r => r.name === 'fai-waf-pillars');
    expect(waf).toBeDefined();
  });

  it('WAF pillars generates 6 pillars', () => {
    const waf = resources.find(r => r.name === 'fai-waf-pillars')!;
    const parsed = JSON.parse(waf.generate());
    expect(parsed.pillars).toHaveLength(6);
    const pillarNames = parsed.pillars.map((p: any) => p.name);
    expect(pillarNames).toContain('reliability');
    expect(pillarNames).toContain('security');
    expect(pillarNames).toContain('cost-optimization');
    expect(pillarNames).toContain('responsible-ai');
  });

  it('resource URIs use fai:// scheme', () => {
    for (const r of resources) {
      expect(r.uri.startsWith('fai://')).toBe(true);
    }
  });
});

describe('getModuleResources', () => {
  const modules = {
    F1: { id: 'F1', title: 'GenAI Foundations', content: 'Short content here' },
    F2: { id: 'F2', title: 'LLM Landscape', content: 'A'.repeat(20000) },
  };

  it('creates one resource per module', () => {
    const resources = getModuleResources(modules as any);
    expect(resources).toHaveLength(2);
  });

  it('resource names follow fai-module-{id} pattern', () => {
    const resources = getModuleResources(modules as any);
    expect(resources[0].name).toBe('fai-module-f1');
    expect(resources[1].name).toBe('fai-module-f2');
  });

  it('resource URIs follow fai://module/{ID} pattern', () => {
    const resources = getModuleResources(modules as any);
    expect(resources[0].uri).toBe('fai://module/F1');
  });

  it('uses text/markdown mime type', () => {
    const resources = getModuleResources(modules as any);
    expect(resources[0].mimeType).toBe('text/markdown');
  });

  it('truncates content over 15000 chars', () => {
    const resources = getModuleResources(modules as any);
    const longResource = resources.find(r => r.name === 'fai-module-f2')!;
    const content = longResource.generate();
    expect(content.length).toBeLessThanOrEqual(15200);
    expect(content).toContain('[truncated');
  });

  it('does not truncate short content', () => {
    const resources = getModuleResources(modules as any);
    const shortResource = resources.find(r => r.name === 'fai-module-f1')!;
    const content = shortResource.generate();
    expect(content).toBe('Short content here');
    expect(content).not.toContain('[truncated');
  });

  it('returns empty array for empty modules', () => {
    expect(getModuleResources({})).toHaveLength(0);
  });
});

describe('getSchemaResources', () => {
  it('creates one resource per schema name', () => {
    const resources = getSchemaResources('/schemas', ['fai-manifest', 'plugin']);
    expect(resources).toHaveLength(2);
  });

  it('resource names follow fai-schema-{name} pattern', () => {
    const resources = getSchemaResources('/schemas', ['fai-manifest']);
    expect(resources[0].name).toBe('fai-schema-fai-manifest');
  });

  it('resource URIs follow fai://schema/{name} pattern', () => {
    const resources = getSchemaResources('/schemas', ['plugin']);
    expect(resources[0].uri).toBe('fai://schema/plugin');
  });

  it('uses application/json mime type', () => {
    const resources = getSchemaResources('/schemas', ['test']);
    expect(resources[0].mimeType).toBe('application/json');
  });

  it('returns empty array for empty schema names', () => {
    expect(getSchemaResources('/schemas', [])).toHaveLength(0);
  });
});
