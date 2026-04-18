// @ts-check
/**
 * YAML Frontmatter Parser for FAI primitives
 * Extracts YAML frontmatter from .md files (--- delimited)
 * Handles: agents, skills, instructions, workflows, cookbook
 */
const fs = require("fs");
const path = require("path");

/**
 * Parse YAML frontmatter from a markdown file.
 * Returns { meta: {}, content: string, lines: number }
 * @param {string} filePath
 * @returns {{ meta: Record<string, any>, content: string, lines: number }}
 */
function parseFrontmatter(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split("\n").length;
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { meta: {}, content: raw, lines };

  const yamlBlock = match[1];
  const content = raw.slice(match[0].length).trim();
  const meta = parseYaml(yamlBlock);
  return { meta, content, lines };
}

/**
 * Lightweight YAML parser — handles the subset used in FAI frontmatter:
 * - scalar values (strings, numbers, booleans)
 * - arrays (both inline [...] and multi-line - item)
 * - nested objects (single level)
 * @param {string} yaml
 * @returns {Record<string, any>}
 */
function parseYaml(yaml) {
  const result = {};
  const lines = yaml.split("\n");
  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Array continuation: "  - value"
    if (/^\s+-\s+/.test(line) && currentKey) {
      const val = trimmed.replace(/^-\s+/, "").replace(/^["']|["']$/g, "");
      if (!currentArray) currentArray = [];
      currentArray.push(val);
      result[currentKey] = currentArray;
      continue;
    }

    // Flush previous array
    if (currentArray) {
      currentArray = null;
    }

    // Key: value pair
    const kvMatch = trimmed.match(/^([a-zA-Z_-]+)\s*:\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      let value = kvMatch[2].trim();

      if (!value) {
        // Value will come as indented array items
        currentArray = [];
        result[currentKey] = currentArray;
        continue;
      }

      // Inline array: ["a", "b", "c"]
      if (value.startsWith("[") && value.endsWith("]")) {
        const inner = value.slice(1, -1);
        result[currentKey] = inner
          ? inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""))
          : [];
        continue;
      }

      // Boolean
      if (value === "true") { result[currentKey] = true; continue; }
      if (value === "false") { result[currentKey] = false; continue; }

      // Number
      if (/^\d+(\.\d+)?$/.test(value)) { result[currentKey] = parseFloat(value); continue; }

      // String (strip quotes)
      result[currentKey] = value.replace(/^["']|["']$/g, "");
    }
  }

  return result;
}

/**
 * Parse a JSON file safely.
 * @param {string} filePath
 * @returns {any}
 */
function parseJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Count lines in a file.
 * @param {string} filePath
 * @returns {number}
 */
function countLines(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").split("\n").length;
  } catch {
    return 0;
  }
}

module.exports = { parseFrontmatter, parseYaml, parseJson, countLines };
