#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertSolutionPlayQuality } from "./solution-play-quality-gate.mjs";

const EXPECTED_PLAY_COUNT = 101;
const ID_PATTERN = /^(\d{2,3})-(.+)$/;
const HEADING_PATTERN = /^#\s*Play\s+(\d+)\s*(?:—|–|-|:)\s*(.+?)\s*$/u;

function cleanDisplayName(value) {
  return value
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\uFE0F\u200D]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function paragraphFromReadme(lines, headingIndex) {
  const body = lines.slice(headingIndex + 1);
  const quoteStart = body.findIndex((line) => line.trim().startsWith(">"));
  if (quoteStart >= 0) {
    const quote = [];
    for (const line of body.slice(quoteStart)) {
      if (!line.trim().startsWith(">")) break;
      quote.push(line.trim().replace(/^>\s?/, ""));
    }
    if (quote.length) return quote.join(" ").replace(/\s+/g, " ").trim();
  }

  const paragraph = [];
  let started = false;
  for (const line of body) {
    const trimmed = line.trim();
    if (!started && !trimmed) continue;
    if (/^#{1,6}\s|^```|^\|/.test(trimmed)) {
      if (started) break;
      continue;
    }
    if (!trimmed) {
      if (started) break;
      continue;
    }
    started = true;
    paragraph.push(trimmed);
  }
  return paragraph.join(" ").replace(/\s+/g, " ").trim();
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readPlay(repoRoot, directory) {
  const directoryMatch = directory.match(ID_PATTERN);
  if (!directoryMatch) throw new Error(`Invalid play directory: ${directory}`);

  const numericId = Number(directoryMatch[1]);
  const id = String(numericId).padStart(2, "0");
  const playRoot = path.join(repoRoot, "solution-plays", directory);
  const readmePath = path.join(playRoot, "README.md");
  const specPath = path.join(playRoot, "spec", "play-spec.json");
  if (!fs.existsSync(readmePath)) throw new Error(`Missing README: ${readmePath}`);
  if (!fs.existsSync(specPath)) throw new Error(`Missing play spec: ${specPath}`);

  const lines = fs.readFileSync(readmePath, "utf8").split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => HEADING_PATTERN.test(line.trim()));
  if (headingIndex < 0) throw new Error(`Missing canonical Play heading: ${readmePath}`);
  const heading = lines[headingIndex].trim().match(HEADING_PATTERN);
  if (!heading || Number(heading[1]) !== numericId) {
    throw new Error(`README play ID does not match directory ${directory}`);
  }

  const spec = readJson(specPath);
  if (spec.name !== directory) throw new Error(`spec.name does not match directory ${directory}`);
  if (spec.play !== undefined && spec.play !== directory) {
    throw new Error(`spec.play does not match directory ${directory}`);
  }
  if (typeof spec.version !== "string" || !/^\d+\.\d+\.\d+$/.test(spec.version)) {
    throw new Error(`Invalid spec.version for ${directory}`);
  }

  const description = paragraphFromReadme(lines, headingIndex);
  if (!description) throw new Error(`Missing README description for ${directory}`);

  return {
    id,
    numeric_id: numericId,
    slug: directory,
    name: cleanDisplayName(heading[2]),
    description: description.slice(0, 500),
    relative_path: `solution-plays/${directory}`,
    readme_path: `solution-plays/${directory}/README.md`,
    spec_path: `solution-plays/${directory}/spec/play-spec.json`,
    spec_version: spec.version,
    github_url: `https://github.com/frootai/frootai/tree/main/solution-plays/${directory}`,
    detail_url: `https://frootai.dev/solution-plays/${directory}`,
  };
}

export function buildSolutionPlayIndex(repoRoot) {
  const playsRoot = path.join(repoRoot, "solution-plays");
  if (!fs.existsSync(playsRoot)) throw new Error(`Solution plays directory not found: ${playsRoot}`);
  assertSolutionPlayQuality({ repoRoot });

  const directories = fs.readdirSync(playsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && ID_PATTERN.test(entry.name))
    .map((entry) => entry.name);
  const plays = directories.map((directory) => readPlay(repoRoot, directory))
    .sort((left, right) => left.numeric_id - right.numeric_id);

  const ids = plays.map((play) => play.numeric_id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const missingIds = Array.from({ length: EXPECTED_PLAY_COUNT }, (_, index) => index + 1)
    .filter((id) => !ids.includes(id));
  if (plays.length !== EXPECTED_PLAY_COUNT || duplicateIds.length || missingIds.length) {
    throw new Error(`Expected IDs 1-${EXPECTED_PLAY_COUNT}; count=${plays.length}, missing=${missingIds.join(",") || "none"}, duplicates=${duplicateIds.join(",") || "none"}`);
  }

  return {
    schema_version: "1.0.0",
    source: "frootai/solution-plays",
    count: plays.length,
    plays,
  };
}

function parseArgs(argv) {
  const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
  const defaultRoot = path.resolve(scriptRoot, "..");
  const rootArg = argv.find((arg) => arg.startsWith("--repo-root="));
  const outArg = argv.find((arg) => arg.startsWith("--out="));
  const repoRoot = rootArg ? path.resolve(rootArg.slice("--repo-root=".length)) : defaultRoot;
  const outputPath = outArg
    ? path.resolve(outArg.slice("--out=".length))
    : path.join(repoRoot, "orchard", "registry", "solution-play-index.json");
  return { repoRoot, outputPath, check: argv.includes("--check"), stdout: argv.includes("--stdout") };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function normalizeNewlines(value) {
  return value.replace(/\r\n/g, "\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const content = stableJson(buildSolutionPlayIndex(options.repoRoot));
  if (options.stdout) {
    process.stdout.write(content);
    return;
  }
  if (options.check) {
    if (!fs.existsSync(options.outputPath) || normalizeNewlines(fs.readFileSync(options.outputPath, "utf8")) !== content) {
      console.error(`Solution Play index is stale. Run: node scripts/build-solution-play-index.mjs`);
      process.exitCode = 1;
      return;
    }
    console.log(`Solution Play index is current: ${options.outputPath}`);
    return;
  }
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, content, "utf8");
  console.log(`Wrote ${options.outputPath} (${EXPECTED_PLAY_COUNT} plays)`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
