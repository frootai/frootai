import { readFileSync, existsSync } from 'fs';
import { join, basename, resolve } from 'path';

export interface PluginEntry {
  name: string;
  description?: string;
  version?: string;
  category?: string;
  plays?: string[];
  keywords?: string[];
  items?: Record<string, any>;
  author?: string | { name: string };
  license?: string;
  source?: string;
}

export interface MarketplaceData {
  plugins: PluginEntry[];
  stats?: { totalPlugins?: number; totalItems: number };
}

/**
 * Load marketplace.json from repo root.
 * Returns empty marketplace if file doesn't exist or is malformed.
 */
export function loadMarketplace(repoRoot: string): MarketplaceData {
  const marketplacePath = join(repoRoot, 'marketplace.json');
  try {
    const raw = readFileSync(marketplacePath, 'utf-8');
    return JSON.parse(raw) as MarketplaceData;
  } catch {
    return { plugins: [], stats: { totalItems: 0 } };
  }
}

/**
 * Search plugins by semantic keyword matching.
 * Scores each plugin by exact phrase match, individual word overlap,
 * name boost, and keyword boost. Returns top results sorted by score.
 */
export function searchPlugins(
  marketplace: MarketplaceData,
  query: string,
  limit: number = 5
): PluginEntry[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length >= 3);

  const scored = marketplace.plugins
    .map(plugin => {
      let score = 0;
      const text = `${plugin.name} ${plugin.description ?? ''} ${(plugin.keywords ?? []).join(' ')}`.toLowerCase();

      // Exact phrase match
      if (text.includes(queryLower)) score += 20;

      // Individual word matches
      for (const w of queryWords) {
        if (text.includes(w)) score += 3;
        if (plugin.name.includes(w)) score += 5;
        if ((plugin.keywords ?? []).some(k => k.includes(w))) score += 4;
      }

      return { plugin, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ plugin }) => plugin);
}

/**
 * Browse plugins with pagination and optional category filter.
 * Categories are matched by keyword presence in plugin name/keywords.
 */
export function browsePlugins(
  marketplace: MarketplaceData,
  options: { page?: number; perPage?: number; category?: string } = {}
): { plugins: PluginEntry[]; total: number; page: number; pages: number } {
  const { page = 1, perPage = 20, category } = options;

  let plugins = [...marketplace.plugins];

  if (category && category !== 'all') {
    const catKeywords: Record<string, string[]> = {
      'solution-play': ['enterprise-rag', 'ai-landing-zone', 'deterministic', 'call-center', 'document-intelligence', 'multi-agent', 'copilot', 'content-moderation', 'fine-tuning', 'cost-optimized'],
      'language': ['python', 'typescript', 'csharp', 'go', 'java', 'rust', 'kotlin', 'ruby', 'swift', 'php'],
      'infrastructure': ['azure', 'kubernetes', 'docker', 'terraform', 'landing-zone', 'bicep', 'containers'],
      'security': ['security', 'owasp', 'content-safety', 'compliance', 'governance', 'hardening'],
      'testing': ['testing', 'evaluation', 'quality', 'code-quality'],
      'observability': ['observability', 'monitoring', 'logging', 'metrics'],
      'integration': ['servicenow', 'salesforce', 'sap', 'jira', 'slack', 'teams', 'oracle'],
      'mcp-development': ['mcp-development'],
    };

    const kws = catKeywords[category] ?? [];
    plugins = plugins.filter(p =>
      kws.some(kw =>
        p.name.includes(kw) || (p.keywords ?? []).some(k => k.includes(kw))
      )
    );
  }

  const total = plugins.length;
  const pages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const pagePlugins = plugins.slice(start, start + perPage);

  return { plugins: pagePlugins, total, page, pages };
}

/**
 * Check compatibility of a plugin with a play.
 * Validates play alignment, counts items, and checks for file conflicts
 * in the target project's .github/ directory.
 */
export function checkCompatibility(
  plugin: PluginEntry,
  playId: string,
  projectRoot: string
): { compatible: boolean; conflicts: string[]; warnings: string[] } {
  const conflicts: string[] = [];
  const warnings: string[] = [];

  // Play compatibility
  if (plugin.plays?.length) {
    const match = plugin.plays.some(p => p.includes(playId));
    if (!match) {
      warnings.push(`Plugin designed for plays: ${plugin.plays.join(', ')} (not ${playId})`);
    }
  }

  // Check for file conflicts in target .github/
  const targetGithub = join(projectRoot, '.github');
  if (existsSync(targetGithub)) {
    // Load the actual plugin.json to find file refs
    const pluginDir = findPluginDir(plugin.name, projectRoot);
    if (pluginDir) {
      const pjPath = join(pluginDir, 'plugin.json');
      if (existsSync(pjPath)) {
        try {
          const pj = JSON.parse(readFileSync(pjPath, 'utf-8'));
          for (const type of ['agents', 'instructions', 'skills', 'hooks']) {
            for (const ref of (pj[type] ?? [])) {
              const dest = join(targetGithub, type, basename(ref));
              if (existsSync(dest)) {
                conflicts.push(`${type}/${basename(ref)} already exists`);
              }
            }
          }
        } catch { /* ignore parse errors */ }
      }
    }
  }

  const compatible = conflicts.length === 0 && warnings.length === 0;
  return { compatible, conflicts, warnings };
}

/**
 * Try to find a plugin's directory in plugins/ or community-plugins/.
 */
function findPluginDir(pluginName: string, repoRoot: string): string | null {
  for (const sub of ['plugins', 'community-plugins']) {
    const dir = join(repoRoot, sub, pluginName);
    if (existsSync(join(dir, 'plugin.json'))) return dir;
  }
  return null;
}

/**
 * Validate plugin.json schema — checks required fields, name/folder match,
 * semver version, and file reference existence.
 */
export function validatePlugin(
  pluginPath: string
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(pluginPath)) {
    return { valid: false, errors: [`plugin.json not found at: ${pluginPath}`], warnings: [] };
  }

  let pj: any;
  try {
    pj = JSON.parse(readFileSync(pluginPath, 'utf-8'));
  } catch (e) {
    return { valid: false, errors: [`Invalid JSON: ${e}`], warnings: [] };
  }

  const pluginDir = join(pluginPath, '..');

  // Required fields
  for (const field of ['name', 'description', 'version', 'author', 'license']) {
    if (!pj[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Name matches folder
  const folderName = basename(pluginDir);
  if (pj.name && pj.name !== folderName) {
    errors.push(`name "${pj.name}" does not match folder "${folderName}"`);
  }

  // Version is semver
  if (pj.version && !/^[0-9]+\.[0-9]+\.[0-9]+/.test(pj.version)) {
    errors.push(`Invalid version: ${pj.version} (must be semver)`);
  }

  // Check file references
  let refCount = 0;
  let missingCount = 0;
  for (const type of ['agents', 'instructions', 'skills', 'hooks']) {
    for (const ref of (pj[type] ?? [])) {
      refCount++;
      if (!existsSync(resolve(pluginDir, ref))) {
        missingCount++;
        errors.push(`${type}: ${ref} not found`);
      }
    }
  }

  // README check
  if (!existsSync(join(pluginDir, 'README.md'))) {
    warnings.push('README.md missing');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Count items across a plugin's primitive record.
 * Sums all numeric values in the items object.
 */
export function countItems(items: Record<string, any> | undefined): number {
  if (!items || typeof items !== 'object') return 0;
  return Object.values(items).reduce(
    (sum: number, n) => sum + (typeof n === 'number' ? n : 0),
    0
  );
}

/**
 * Get marketplace statistics: total plugins, items by category,
 * and top plugins by item count.
 */
export function getMarketplaceStats(
  marketplace: MarketplaceData
): { total: number; categories: Record<string, number>; topPlugins: PluginEntry[] } {
  const plugins = marketplace.plugins;

  // Category breakdown from keywords
  const categories: Record<string, number> = {};
  for (const p of plugins) {
    for (const kw of (p.keywords ?? []).slice(0, 3)) {
      categories[kw] = (categories[kw] ?? 0) + 1;
    }
  }

  // Top plugins by item count
  const topPlugins = [...plugins]
    .sort((a, b) => countItems(b.items) - countItems(a.items))
    .slice(0, 10);

  return { total: plugins.length, categories, topPlugins };
}
