#!/usr/bin/env node
// @ts-check
/**
 * FAI Factory — Watch Mode
 * Live development preview: watches primitive directories and auto-reruns
 * harvest → catalog → diff on changes.
 *
 * Usage:
 *   node scripts/factory/watch.js              # Watch all primitives
 *   node scripts/factory/watch.js --channel X  # Also run transform for channel X
 *   npm run factory:watch                      # Via npm script
 *
 * Watches: agents/, skills/, instructions/, hooks/, plugins/, workflows/,
 *          cookbook/, solution-plays/, modules/
 *
 * Debounces rapid changes (500ms) and shows diff output after each rebuild.
 */
const fs = require("fs");
const path = require("path");
const { harvest } = require("./harvest");
const { catalog } = require("./catalog");
const { diff } = require("./diff");
const { transform } = require("./transform");

const REPO_ROOT =
  process.env.FROOTAI_PUBLIC_REPO || path.resolve(__dirname, "../..");

const args = process.argv.slice(2);
const channelArg =
  args.includes("--channel") && args[args.indexOf("--channel") + 1];

const WATCHED_DIRS = [
  "agents",
  "skills",
  "instructions",
  "hooks",
  "plugins",
  "workflows",
  "cookbook",
  "solution-plays",
  "modules",
];

const WATCH_EXTENSIONS = new Set([
  ".md",
  ".json",
  ".yml",
  ".yaml",
  ".sh",
  ".py",
  ".js",
  ".ts",
  ".bicep",
]);

const DEBOUNCE_MS = 500;
let debounceTimer = null;
let rebuilding = false;
let pendingRebuild = false;
let rebuildCount = 0;

function clearLine() {
  process.stdout.write("\r\x1b[K");
}

function timestamp() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

/** Suppress console.log during a function call and return its result. */
function silently(fn) {
  const origLog = console.log;
  const origErr = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

async function rebuild(changedFile) {
  if (rebuilding) {
    pendingRebuild = true;
    return;
  }

  rebuilding = true;
  rebuildCount++;
  const run = rebuildCount;

  console.log("");
  console.log(
    `\x1b[36m[${timestamp()}]\x1b[0m 🔄 Rebuild #${run}${changedFile ? ` — triggered by: ${path.relative(REPO_ROOT, changedFile)}` : ""}`,
  );
  console.log("─".repeat(60));

  const t0 = Date.now();

  try {
    // Harvest (silent — suppress verbose output)
    process.stdout.write("  🌾 Harvesting... ");
    silently(() => harvest());
    // Read harvest output for stats
    const harvestPath = path.join(REPO_ROOT, ".factory", "harvest.json");
    const harvestData = JSON.parse(fs.readFileSync(harvestPath, "utf8"));
    const total =
      (harvestData.agents?.length || 0) +
      (harvestData.skills?.length || 0) +
      (harvestData.instructions?.length || 0) +
      (harvestData.hooks?.length || 0) +
      (harvestData.plugins?.length || 0) +
      (harvestData.workflows?.length || 0) +
      (harvestData.cookbook?.length || 0);
    console.log(`\x1b[32m✓\x1b[0m ${total} primitives`);

    // Catalog
    process.stdout.write("  📦 Cataloging... ");
    silently(() => catalog());
    console.log("\x1b[32m✓\x1b[0m");

    // Diff — read changes.json for results
    process.stdout.write("  🔍 Diffing... ");
    silently(() => diff());
    const changesPath = path.join(REPO_ROOT, ".factory", "changes.json");
    if (fs.existsSync(changesPath)) {
      const changes = JSON.parse(fs.readFileSync(changesPath, "utf8"));
      const totalChanges =
        (changes.added?.length || 0) +
        (changes.removed?.length || 0) +
        (changes.modified?.length || 0);
      if (totalChanges > 0) {
        console.log(
          `\x1b[33m${totalChanges} change(s)\x1b[0m`,
        );
        if (changes.added?.length) {
          const names = changes.added.slice(0, 5).map((c) => c.id || c).join(", ");
          console.log(
            `     \x1b[32m+ ${changes.added.length} added\x1b[0m: ${names}${changes.added.length > 5 ? "..." : ""}`,
          );
        }
        if (changes.removed?.length) {
          const names = changes.removed.slice(0, 5).map((c) => c.id || c).join(", ");
          console.log(
            `     \x1b[31m- ${changes.removed.length} removed\x1b[0m: ${names}${changes.removed.length > 5 ? "..." : ""}`,
          );
        }
        if (changes.modified?.length) {
          const names = changes.modified.slice(0, 5).map((c) => c.id || c).join(", ");
          console.log(
            `     \x1b[33m~ ${changes.modified.length} modified\x1b[0m: ${names}${changes.modified.length > 5 ? "..." : ""}`,
          );
        }
      } else {
        console.log("\x1b[90mno changes\x1b[0m");
      }
    } else {
      console.log("\x1b[90mfirst run\x1b[0m");
    }

    // Optional: transform for specific channel
    if (channelArg) {
      process.stdout.write(`  🔄 Transforming (${channelArg})... `);
      silently(() => transform(channelArg));
      console.log("\x1b[32m✓\x1b[0m");
    }

    const elapsed = Date.now() - t0;
    console.log(
      `  \x1b[32m✅ Done in ${elapsed}ms\x1b[0m`,
    );
  } catch (err) {
    console.log(`  \x1b[31m❌ Error: ${err.message}\x1b[0m`);
  }

  console.log("");
  process.stdout.write(
    `\x1b[90m[watching ${WATCHED_DIRS.length} directories...]\x1b[0m `,
  );

  rebuilding = false;

  if (pendingRebuild) {
    pendingRebuild = false;
    rebuild(null);
  }
}

function shouldWatch(filename) {
  if (!filename) return true;
  const ext = path.extname(filename).toLowerCase();
  return WATCH_EXTENSIONS.has(ext);
}

function startWatching() {
  console.log("🍊 FAI Factory — Watch Mode");
  console.log("══════════════════════════════════════");
  console.log(`  Repo: ${REPO_ROOT}`);
  console.log(`  Watching: ${WATCHED_DIRS.join(", ")}`);
  if (channelArg) console.log(`  Transform channel: ${channelArg}`);
  console.log(`  Debounce: ${DEBOUNCE_MS}ms`);
  console.log("");
  console.log("  Press Ctrl+C to stop.");
  console.log("");

  // Initial build
  rebuild(null);

  // Set up watchers
  const watchers = [];

  for (const dir of WATCHED_DIRS) {
    const dirPath = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`  \x1b[90m⚠ ${dir}/ not found, skipping\x1b[0m`);
      continue;
    }

    try {
      const watcher = fs.watch(
        dirPath,
        { recursive: true },
        (eventType, filename) => {
          if (!shouldWatch(filename)) return;

          // Debounce rapid changes
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            const fullPath = filename
              ? path.join(dirPath, filename)
              : dirPath;
            rebuild(fullPath);
          }, DEBOUNCE_MS);
        },
      );

      watchers.push(watcher);
    } catch (err) {
      console.log(
        `  \x1b[33m⚠ Cannot watch ${dir}/: ${err.message}\x1b[0m`,
      );
    }
  }

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Stopping watchers...");
    for (const w of watchers) {
      try {
        w.close();
      } catch {
        // ignore
      }
    }
    console.log(`  Total rebuilds: ${rebuildCount}`);
    console.log("  Goodbye! 🍊");
    process.exit(0);
  });
}

startWatching();
