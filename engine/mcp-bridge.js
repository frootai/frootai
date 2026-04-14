/**
 * FAI Engine — MCP Bridge
 * Provides the run_play function that can be registered as an MCP tool.
 *
 * This bridges the FAI Engine (CommonJS) with the MCP Server (ESM).
 * The MCP server can import this via dynamic require() or by converting to ESM later.
 *
 * Tool: run_play
 * Input: { playId: "01-enterprise-rag" } or { manifestPath: "path/to/fai-manifest.json" }
 * Output: Engine status + wiring report
 */

const { join, resolve } = require('path');
const { existsSync, readdirSync } = require('fs');
const { initEngine, printStatus } = require('./index');

const ROOT = resolve(join(__dirname, '..'));

/**
 * Find the fai-manifest.json for a play by ID.
 * @param {string} playId - Play identifier (e.g., "01-enterprise-rag" or "01")
 * @returns {string|null} Absolute path to fai-manifest.json
 */
function findManifest(playId) {
  const playsDir = join(ROOT, 'solution-plays');
  if (!existsSync(playsDir)) return null;

  const folders = readdirSync(playsDir).filter(f => {
    return f.startsWith(playId) || f === playId;
  });

  for (const folder of folders) {
    // Check root level first, then spec/ subdirectory
    const rootPath = join(playsDir, folder, 'fai-manifest.json');
    if (existsSync(rootPath)) return rootPath;

    const specPath = join(playsDir, folder, 'spec', 'fai-manifest.json');
    if (existsSync(specPath)) return specPath;
  }

  return null;
}

/**
 * MCP tool handler for run_play.
 * @param {object} params - { playId: string } or { manifestPath: string }
 * @returns {object} Engine result formatted for MCP response
 */
function runPlay(params) {
  let manifestPath;

  if (params.manifestPath) {
    manifestPath = resolve(params.manifestPath);
  } else if (params.playId) {
    manifestPath = findManifest(params.playId);
    if (!manifestPath) {
      return {
        success: false,
        error: `Play "${params.playId}" not found. Available plays are in solution-plays/.`
      };
    }
  } else {
    return {
      success: false,
      error: 'Provide either playId (e.g., "01-enterprise-rag") or manifestPath.'
    };
  }

  const engine = initEngine(manifestPath);

  return {
    success: engine.success,
    play: engine.manifest?.play,
    version: engine.manifest?.version,
    context: engine.context,
    wiring: engine.wiring?.stats,
    guardrails: engine.evaluator?.thresholds,
    errors: engine.errors,
    duration: engine.duration
  };
}

/**
 * MCP tool definition for registration in the MCP server.
 */
const MCP_TOOL_DEFINITION = {
  name: 'run_play',
  description: 'Load and validate a FrootAI solution play using the FAI Engine. Resolves context, wires primitives, and reports wiring status with quality gates.',
  inputSchema: {
    type: 'object',
    properties: {
      playId: {
        type: 'string',
        description: 'Solution play ID (e.g., "01-enterprise-rag", "01"). Searches solution-plays/ for the manifest.'
      },
      manifestPath: {
        type: 'string',
        description: 'Direct path to a fai-manifest.json file. Use this for custom manifest locations.'
      }
    }
  }
};

module.exports = { runPlay, findManifest, MCP_TOOL_DEFINITION };
