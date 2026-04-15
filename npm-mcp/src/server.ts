/**
 * FrootAI MCP Server — TypeScript Entry Point
 * ─────────────────────────────────────────────
 * This module is the typed public API of the FrootAI MCP server.
 * It exports:
 *   - createServer()   — factory that builds a configured McpServer
 *   - ServerConfig     — configuration interface
 *   - All typed helpers from sub-modules
 *
 * The full 45-tool server runtime is in index.js (ESM).
 * This module provides the typed layer for library consumers and type-safe imports.
 *
 * Usage as library:
 *   import { createServer, type ServerConfig } from 'frootai-mcp';
 *
 * Usage as CLI (compiled):
 *   node dist/server.js
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Re-export all typed helpers so consumers get full type safety
export * from './knowledge/index.js';
export {
  loadKnowledge,
  type KnowledgeBundle,
} from './tools/knowledge.js';
export * from './tools/ecosystem.js';
export * from './prompts/index.js';
export * from './resources/index.js';
export * from './types/index.js';

export interface ServerConfig {
  /** Server display name */
  name?: string;
  /** Server version (auto-detected from package.json if omitted) */
  version?: string;
  /** Comma-separated toolset groups, or 'slim' for minimal set */
  toolset?: string;
  /** Transport mode */
  transport?: 'stdio' | 'http';
  /** HTTP port when transport = 'http' */
  httpPort?: number;
  /** Path to knowledge.json bundle (auto-detected if omitted) */
  knowledgePath?: string;
  /** Path to search-index.json BM25 index (auto-detected if omitted) */
  searchIndexPath?: string;
}

/** Resolve a config path with fallback to __dirname */
function resolvePath(provided: string | undefined, filename: string): string {
  if (provided && existsSync(provided)) return provided;
  const candidate = join(__dirname, '..', filename);
  if (existsSync(candidate)) return candidate;
  // dist/ context — go up one more level
  const candidate2 = join(__dirname, '..', '..', filename);
  if (existsSync(candidate2)) return candidate2;
  return candidate;
}

/** Read version from package.json */
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    return pkg.version ?? '5.0.1';
  } catch {
    return '5.0.1';
  }
}

export interface ServerInfo {
  name: string;
  version: string;
  toolCount: number;
  hasEngine: boolean;
  knowledgePath: string;
  searchIndexPath: string;
  transport: 'stdio' | 'http';
}

/**
 * Validate the server environment and return metadata.
 * Does NOT start the server — use this for health checks and info.
 */
export function getServerInfo(config: ServerConfig = {}): ServerInfo {
  const knowledgePath = resolvePath(config.knowledgePath, 'knowledge.json');
  const searchIndexPath = resolvePath(config.searchIndexPath, 'search-index.json');
  const enginePath = join(__dirname, '..', '..', 'engine', 'mcp-bridge.js');
  const hasEngine = existsSync(enginePath);

  const toolsetStr = config.toolset ?? process.env.FAI_TOOLSET ?? 'all';
  const ALL_TOOLSETS = ['knowledge', 'live', 'agents', 'ecosystem', 'engine', 'scaffold', 'marketplace'];
  const SLIM_TOOLSET = ['knowledge', 'ecosystem', 'agents'];
  const TOOL_COUNTS: Record<string, number> = {
    knowledge: 6, live: 4, agents: 3, ecosystem: 10, engine: 6, scaffold: 3, marketplace: 13,
  };

  let enabledGroups: string[];
  if (toolsetStr === 'slim') {
    enabledGroups = SLIM_TOOLSET;
  } else if (toolsetStr === 'all') {
    enabledGroups = ALL_TOOLSETS;
  } else {
    enabledGroups = toolsetStr.split(',').map(s => s.trim()).filter(s => ALL_TOOLSETS.includes(s));
  }

  const toolCount = enabledGroups.reduce((sum, g) => sum + (TOOL_COUNTS[g] ?? 0), 0);

  return {
    name: config.name ?? 'frootai',
    version: config.version ?? readVersion(),
    toolCount,
    hasEngine,
    knowledgePath,
    searchIndexPath,
    transport: config.transport ?? 'stdio',
  };
}

/**
 * Start the FrootAI MCP server.
 *
 * This function dynamically imports the runtime index.js and starts it.
 * Allows typed code to start the server without losing the runtime's
 * full tool registration logic.
 */
export async function startServer(config: ServerConfig = {}): Promise<void> {
  // Apply config to env before importing the runtime
  if (config.toolset) process.env.FAI_TOOLSET = config.toolset;
  if (config.transport) process.env.FAI_TRANSPORT = config.transport;
  if (config.httpPort) process.env.FAI_HTTP_PORT = String(config.httpPort);
  if (config.knowledgePath) process.env.FAI_KNOWLEDGE_PATH = config.knowledgePath;

  // Dynamic import of the runtime (avoids circular dependency with index.js)
  const runtimePath = join(__dirname, '..', 'index.js');
  if (!existsSync(runtimePath)) {
    throw new Error(`FrootAI MCP runtime not found at ${runtimePath}. Run from repo or install frootai-mcp.`);
  }

  // The runtime starts automatically on import (top-level await)
  await import(runtimePath);
}

// ─── CLI entry when run directly ──────────────────────────────────────────────
// When `node dist/server.js` or `npx frootai-mcp` routes here, start the server.
const isMain = process.argv[1]?.endsWith('server.js') ||
               process.argv[1]?.endsWith('server.ts');

if (isMain) {
  const transport = (process.argv[2] as 'stdio' | 'http') ?? 'stdio';
  startServer({ transport }).catch((err: Error) => {
    console.error('[frootai] Failed to start:', err.message);
    process.exit(1);
  });
}
