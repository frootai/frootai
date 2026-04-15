/**
 * FrootAI MCP Server — Auto-Update Module
 * ────────────────────────────────────────
 * Keeps the bundled knowledge.json fresh by checking GitHub for updates.
 *
 * Behavior:
 *   1. Checks if the local knowledge.json is older than 7 days
 *   2. If stale, fetches the latest from GitHub raw content
 *   3. Falls back to the bundled version if the fetch fails
 *   4. Exports getLatestKnowledge() — always returns the freshest data
 *
 * Usage:
 *   import { getLatestKnowledge } from "./auto-update.js";
 *   const knowledge = await getLatestKnowledge();
 */

import { readFileSync, writeFileSync, statSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Configuration ─────────────────────────────────────────────────
const KNOWLEDGE_PATH = join(__dirname, "knowledge.json");
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/frootai/frootai/main/npm-mcp/knowledge.json";
const FETCH_TIMEOUT_MS = 10000; // 10 second timeout

/**
 * Fetch a URL and return the response body as a string.
 * Uses the built-in https module (no external dependencies).
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: FETCH_TIMEOUT_MS }, (res) => {
      // Follow redirects (GitHub raw sometimes 301s)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        res.resume(); // Drain the response
        return;
      }

      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Fetch timed out after ${FETCH_TIMEOUT_MS}ms`));
    });
    req.on("error", reject);
  });
}

/**
 * Check whether the bundled knowledge.json is stale (older than MAX_AGE_MS).
 */
function isKnowledgeStale() {
  try {
    if (!existsSync(KNOWLEDGE_PATH)) return true;
    const stats = statSync(KNOWLEDGE_PATH);
    const ageMs = Date.now() - stats.mtimeMs;
    return ageMs > MAX_AGE_MS;
  } catch {
    return true; // If we can't stat, treat as stale
  }
}

/**
 * Load the bundled knowledge.json from disk.
 * Returns parsed JSON or null if the file doesn't exist / is invalid.
 */
function loadBundledKnowledge() {
  try {
    const raw = readFileSync(KNOWLEDGE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Get the latest knowledge, fetching from GitHub if the local copy is stale.
 *
 * Strategy:
 *   - If local knowledge.json is < 7 days old → return it immediately
 *   - If stale → try fetching from GitHub
 *   - If fetch succeeds → write to disk, return fresh data
 *   - If fetch fails → return bundled version (never break the server)
 *
 * @returns {Promise<object>} The knowledge bundle (parsed JSON)
 */
export async function getLatestKnowledge() {
  const bundled = loadBundledKnowledge();

  // Fast path: knowledge is fresh enough
  if (!isKnowledgeStale() && bundled) {
    return bundled;
  }

  // Slow path: try to fetch from GitHub
  try {
    console.error("[auto-update] Knowledge is stale — fetching latest from GitHub...");
    const raw = await fetchUrl(GITHUB_RAW_URL);
    const fresh = JSON.parse(raw);

    // Validate the fetched data has expected structure
    if (!fresh.modules || !fresh.layers) {
      throw new Error("Fetched knowledge.json has unexpected structure");
    }

    // Write the fresh knowledge to disk for next time
    writeFileSync(KNOWLEDGE_PATH, JSON.stringify(fresh));
    const moduleCount = Object.keys(fresh.modules).length;
    console.error(`[auto-update] Updated knowledge.json (${moduleCount} modules)`);
    return fresh;
  } catch (err) {
    console.error(`[auto-update] Fetch failed: ${err.message} — using bundled version`);
    // Fall back to whatever we have on disk
    return bundled || { version: "0.0.0", layers: {}, modules: {} };
  }
}
