/**
 * FAI Engine — Manifest Reader
 * Reads and validates fai-manifest.json files against the FAI Protocol schema.
 *
 * The manifest is the heart of the FAI Protocol: a single JSON file that declares
 * how primitives wire together for a solution play.
 */

const { readFileSync, existsSync } = require('fs');
const { join, resolve, dirname, basename } = require('path');

const WAF_PILLARS = [
  'security', 'reliability', 'cost-optimization',
  'operational-excellence', 'performance-efficiency', 'responsible-ai'
];

/**
 * Load and validate a fai-manifest.json file.
 * @param {string} manifestPath - Absolute or relative path to fai-manifest.json
 * @returns {{ manifest: object, playDir: string, errors: string[] }}
 */
function loadManifest(manifestPath) {
  const absPath = resolve(manifestPath);
  const errors = [];

  if (!existsSync(absPath)) {
    return { manifest: null, playDir: null, errors: [`Manifest not found: ${absPath}`] };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(absPath, 'utf8'));
  } catch (err) {
    return { manifest: null, playDir: null, errors: [`Invalid JSON: ${err.message}`] };
  }

  // playDir is the play root — if manifest is in spec/, go up one level
  let playDir = dirname(absPath);
  if (basename(playDir) === 'spec') {
    playDir = dirname(playDir);
  }

  // Validate required fields
  if (!manifest.play || !/^[0-9]{2}-[a-z0-9-]+$/.test(manifest.play)) {
    errors.push(`play must match "NN-kebab-case" (got "${manifest.play}")`);
  }

  if (!manifest.version || !/^[0-9]+\.[0-9]+\.[0-9]+/.test(manifest.version)) {
    errors.push(`version must be semver (got "${manifest.version}")`);
  }

  // Context validation
  if (!manifest.context) {
    errors.push('missing context object');
  } else {
    if (!manifest.context.knowledge || !Array.isArray(manifest.context.knowledge) || manifest.context.knowledge.length === 0) {
      errors.push('context.knowledge must have at least one module');
    }
    if (!manifest.context.waf || !Array.isArray(manifest.context.waf) || manifest.context.waf.length === 0) {
      errors.push('context.waf must have at least one pillar');
    } else {
      const invalid = manifest.context.waf.filter(w => !WAF_PILLARS.includes(w));
      if (invalid.length > 0) errors.push(`invalid WAF pillars: ${invalid.join(', ')}`);
    }
  }

  // Primitives validation
  if (!manifest.primitives) {
    errors.push('missing primitives object');
  } else if (manifest.primitives.guardrails) {
    const g = manifest.primitives.guardrails;
    if (g.groundedness !== undefined && (g.groundedness < 0 || g.groundedness > 1)) {
      errors.push(`guardrails.groundedness must be 0-1 (got ${g.groundedness})`);
    }
    if (g.coherence !== undefined && (g.coherence < 0 || g.coherence > 1)) {
      errors.push(`guardrails.coherence must be 0-1 (got ${g.coherence})`);
    }
    if (g.safety !== undefined && g.safety !== 0) {
      errors.push(`guardrails.safety must be 0 for production (got ${g.safety})`);
    }
  }

  return { manifest, playDir, errors };
}

/**
 * Resolve all file paths in a manifest relative to the play directory.
 * @param {object} manifest - Parsed fai-manifest.json
 * @param {string} playDir - Absolute path to the play directory
 * @returns {{ resolved: object, missing: string[] }}
 */
function resolvePaths(manifest, playDir) {
  const missing = [];
  const resolved = {
    agents: [],
    instructions: [],
    skills: [],
    hooks: [],
    workflows: [],
    infrastructure: {}
  };

  const resolveList = (list, category) => {
    if (!Array.isArray(list)) return [];
    return list.map(relPath => {
      const abs = resolve(playDir, relPath);
      if (!existsSync(abs)) {
        missing.push(`${category}: ${relPath} (resolved: ${abs})`);
      }
      return { relative: relPath, absolute: abs, exists: existsSync(abs) };
    });
  };

  if (manifest.primitives) {
    resolved.agents = resolveList(manifest.primitives.agents, 'agents');
    resolved.instructions = resolveList(manifest.primitives.instructions, 'instructions');
    resolved.skills = resolveList(manifest.primitives.skills, 'skills');
    resolved.hooks = resolveList(manifest.primitives.hooks, 'hooks');
    resolved.workflows = resolveList(manifest.primitives.workflows, 'workflows');
  }

  if (manifest.infrastructure) {
    for (const [key, relPath] of Object.entries(manifest.infrastructure)) {
      if (relPath) {
        const abs = resolve(playDir, relPath);
        resolved.infrastructure[key] = { relative: relPath, absolute: abs, exists: existsSync(abs) };
        if (!existsSync(abs)) missing.push(`infrastructure.${key}: ${relPath}`);
      }
    }
  }

  return { resolved, missing };
}

module.exports = { loadManifest, resolvePaths };
