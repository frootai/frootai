import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getServerInfo, type ServerConfig } from '../../src/server.js';

describe('server — getServerInfo', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('returns server info with defaults', () => {
    delete process.env.FAI_TOOLSET;
    const info = getServerInfo();
    expect(info.name).toBe('frootai');
    expect(info.version).toBeTruthy();
    expect(info.transport).toBe('stdio');
    expect(info.toolCount).toBe(45); // 'all' toolset
  });

  it('respects custom name and transport', () => {
    const info = getServerInfo({ name: 'custom-mcp', transport: 'http' });
    expect(info.name).toBe('custom-mcp');
    expect(info.transport).toBe('http');
  });

  it('counts tools for slim toolset', () => {
    const info = getServerInfo({ toolset: 'slim' });
    // slim = knowledge(6) + ecosystem(10) + agents(3) = 19
    expect(info.toolCount).toBe(19);
  });

  it('counts tools for custom toolset', () => {
    const info = getServerInfo({ toolset: 'knowledge,agents' });
    // knowledge(6) + agents(3) = 9
    expect(info.toolCount).toBe(9);
  });

  it('reads version from package.json', () => {
    const info = getServerInfo();
    expect(info.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns knowledgePath and searchIndexPath', () => {
    const info = getServerInfo();
    expect(info.knowledgePath).toContain('knowledge.json');
    expect(info.searchIndexPath).toContain('search-index.json');
  });

  it('uses FAI_TOOLSET env var when no config', () => {
    process.env.FAI_TOOLSET = 'knowledge';
    const info = getServerInfo();
    expect(info.toolCount).toBe(6);
  });

  it('ignores invalid toolset groups', () => {
    const info = getServerInfo({ toolset: 'knowledge,invalid,agents' });
    expect(info.toolCount).toBe(9); // only knowledge + agents
  });
});
