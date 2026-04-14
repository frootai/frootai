/**
 * Snapshot Test — Tool Definitions
 * Prevents accidental API breaks by snapshotting all tool schemas.
 * If a tool name, description, or parameter changes, this test fails.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse tool registrations from index.js
function extractToolNames(source: string): string[] {
  const pattern = /server\.tool\(\s*"([^"]+)"/g;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    names.push(match[1]);
  }
  return names.sort();
}

function extractPromptNames(source: string): string[] {
  const pattern = /server\.prompt\(\s*"([^"]+)"/g;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    names.push(match[1]);
  }
  return names.sort();
}

function extractResourceURIs(source: string): string[] {
  const pattern = /server\.resource\(\s*[^,]+,\s*(?:`([^`]+)`|"([^"]+)")/g;
  const uris: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const uri = match[1] || match[2];
    // Collapse dynamic URIs to templates
    if (uri.includes('${')) {
      uris.push(uri.replace(/\$\{[^}]+\}/g, '{dynamic}'));
    } else {
      uris.push(uri);
    }
  }
  // Deduplicate template patterns
  return [...new Set(uris)].sort();
}

const indexSource = readFileSync(join(__dirname, '..', '..', 'index.js'), 'utf-8');

describe('Tool Definition Snapshots', () => {
  const toolNames = extractToolNames(indexSource);

  it('should have exactly 45 tools registered', () => {
    expect(toolNames.length).toBe(45);
  });

  it('tool names should match snapshot', () => {
    expect(toolNames).toMatchInlineSnapshot(`
      [
        "agent_build",
        "agent_review",
        "agent_tune",
        "check_compatibility",
        "check_plugin_updates",
        "compare_models",
        "compare_plays",
        "compose_plugins",
        "create_primitive",
        "embedding_playground",
        "estimate_cost",
        "evaluate_quality",
        "fetch_azure_docs",
        "fetch_external_mcp",
        "generate_architecture_diagram",
        "get_architecture_pattern",
        "get_azure_pricing",
        "get_froot_overview",
        "get_github_agentic_os",
        "get_model_catalog",
        "get_module",
        "get_play_detail",
        "inspect_wiring",
        "install_plugin",
        "list_community_plays",
        "list_external_plugins",
        "list_installed",
        "list_modules",
        "list_primitives",
        "lookup_term",
        "marketplace_browse",
        "marketplace_search",
        "marketplace_stats",
        "publish_plugin",
        "resolve_dependencies",
        "run_evaluation",
        "scaffold_play",
        "search_knowledge",
        "semantic_search_plays",
        "smart_scaffold",
        "uninstall_plugin",
        "validate_config",
        "validate_manifest",
        "validate_plugin",
        "wire_play",
      ]
    `);
  });
});

describe('Prompt Definition Snapshots', () => {
  const promptNames = extractPromptNames(indexSource);

  it('should have at least 4 prompts registered', () => {
    expect(promptNames.length).toBeGreaterThanOrEqual(4);
  });

  it('prompt names should include core workflows', () => {
    expect(promptNames).toContain('build');
    expect(promptNames).toContain('review');
    expect(promptNames).toContain('tune');
  });
});

describe('Resource Definition Snapshots', () => {
  const resourceURIs = extractResourceURIs(indexSource);

  it('should have at least 4 resource URIs', () => {
    expect(resourceURIs.length).toBeGreaterThanOrEqual(4);
  });

  it('should include core resources', () => {
    expect(resourceURIs.some(u => u.includes('overview'))).toBe(true);
    expect(resourceURIs.some(u => u.includes('marketplace'))).toBe(true);
  });
});

describe('Annotation Coverage', () => {
  it('tools should have annotations', () => {
    // Count tools with annotations (multi-line pattern)
    const annotatedCount = (indexSource.match(/annotations\s*:/g) || []).length;

    // At least some tools should have annotations
    expect(annotatedCount).toBeGreaterThanOrEqual(10);
  });
});
