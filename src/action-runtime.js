// [M7.23] Action dist build entry point
// This file is the ncc compilation target — it bundles the action's
// Node.js runtime into a single file at dist/index.js for GitHub
// Actions composite step consumption (faster cold-start, no npx needed
// for the action wrapper itself).
//
// The actual CLI invocation (npx frootai-mcp@version) still happens at
// runtime via shell steps in action.yml. This entry point handles only
// the lightweight orchestration logic that could be extracted from the
// composite shell steps into a Node.js action in the future.
//
// For now, this serves as the ncc target that packages any shared
// utilities (JSONL parsing, output extraction) used by post-run steps.

const fs = require('fs');
const path = require('path');

/**
 * Parse federation_attach_completed events from a JSONL log file.
 * @param {string} logPath - Path to the JSONL log file
 * @returns {{ areas: string[], toolsCount: number }}
 */
function parseFederationLog(logPath) {
  const areas = [];
  let toolsCount = 0;

  if (!fs.existsSync(logPath)) {
    return { areas, toolsCount };
  }

  const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.event === 'federation_attach_completed') {
        if (event.area && !areas.includes(event.area)) {
          areas.push(event.area);
        }
        toolsCount += event.tool_count || 0;
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  return { areas, toolsCount };
}

/**
 * Validate that a trust file exists at the given workspace-relative path.
 * @param {string} workspaceRoot
 * @param {string} trustFilePath
 * @returns {boolean}
 */
function validateTrustFile(workspaceRoot, trustFilePath) {
  if (!trustFilePath) return false;
  const resolved = path.resolve(workspaceRoot, trustFilePath);
  return fs.existsSync(resolved);
}

module.exports = { parseFederationLog, validateTrustFile };

// When run directly (via ncc-compiled dist/index.js), export is enough.
// The composite action still uses shell steps; this module is available
// for future migration to a pure JS action (runs.using: node22 + main).
if (require.main === module) {
  console.log('FrootAI Action v6 runtime loaded (dist build)');
}
