// @ts-check
/**
 * A4.14-A4.16 — Play recipe loader.
 *
 * A "recipe" is the set of files a Play contributes to a target accelerator
 * when installed via `frootai orchard install <slug> --upgrade-to-play <play-id>`.
 *
 * Recipe shape (matches the in-repo Plays at frootai/solution-plays/<id>-<slug>/.github):
 *   - copilot-instructions.md                 (A4.14)
 *   - agents/*.agent.md                       (A4.15)
 *   - skills/<skill-name>/SKILL.md            (A4.16)
 *   - prompts/*.prompt.md                     (A4.16)
 *   - instructions/*.instructions.md          (A4.16)
 *   - evals/* + evaluation/*                  (A4.16 — optional, dropped if present)
 *   - hooks/*.json                            (A4.16 — optional)
 *
 * Provider doctrine:
 *   - The CLI ships an injectable `PlayRecipeProvider` interface
 *     ({ loadRecipe(playId): Promise<Recipe>, listAvailable(): Promise<PlayId[]> }).
 *   - Default impl: LocalDirRecipeProvider reads from FROOTAI_PLAYS_DIR env var
 *     OR resolves to a `plays/` directory packaged with the npm tarball
 *     (defaults to <cli-root>/../plays).
 *   - Future v2: CDN provider downloads a tarball from frootai.dev/api/plays/<id>.
 *     Same interface — drop-in replacement, no engine changes.
 *
 * Security:
 *   - Filenames inside the recipe MUST be relative + no `..` segments.
 *     Any absolute path or `..` traversal → rejected with `unsafe_path`.
 *   - Total recipe size capped at 4 MiB (Plays should not be huge).
 *   - File count capped at 256 (sanity).
 */
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const { OrchardCliError } = require("../orchard/cli-error");

const RECIPE_VERSION = 1;
const RECIPE_MAX_BYTES = 4 * 1024 * 1024;
const RECIPE_MAX_FILES = 256;
const FILE_MAX_BYTES = 256 * 1024;       // 256 KiB per file
const PLAYS_DIR_ENV = "FROOTAI_PLAYS_DIR";

/** The set of top-level subdirs we copy into the target's `.github/`. */
const RECIPE_DIRS = Object.freeze(["agents", "skills", "prompts", "instructions", "hooks", "workflows", "evals", "evaluation"]);

/** Files at the Play root we copy into the target's `.github/`. */
const RECIPE_ROOT_FILES = Object.freeze(["copilot-instructions.md"]);

/** Pure: reject path-traversal + absolute paths. */
function isSafeRelPath(rel) {
  if (!rel || typeof rel !== "string") return false;
  if (rel.length === 0 || rel.length > 1024) return false;
  if (path.isAbsolute(rel)) return false;
  if (/[\0]/.test(rel)) return false;
  // Reject ANY `..` segment in the RAW path (don't rely on normalization, since
  // path.normalize("a/../b") returns "b" which then looks safe but the input WAS unsafe).
  const rawSegments = rel.split(/[\\/]+/);
  for (const seg of rawSegments) {
    if (seg === "..") return false;
  }
  // Also reject UNC + Windows drive letters (defense in depth).
  if (/^[A-Za-z]:/.test(rel)) return false;
  if (rel.startsWith("\\\\") || rel.startsWith("//")) return false;
  return true;
}

/** Pure: validate parsed play id. Plays have 2-digit prefix `01`-`99`. */
function isValidPlayId(playId) {
  if (typeof playId !== "string") return false;
  return /^[0-9]{2}$/.test(playId);
}

/** Pure: validate a recipe object's shape. */
function validateRecipe(recipe) {
  if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) {
    throw new OrchardCliError("invalid_recipe", "recipe must be an object", {});
  }
  if (recipe.v !== RECIPE_VERSION) {
    throw new OrchardCliError("invalid_recipe", `recipe.v must be ${RECIPE_VERSION}, got ${JSON.stringify(recipe.v)}`, { received: recipe.v });
  }
  if (!isValidPlayId(recipe.play_id)) {
    throw new OrchardCliError("invalid_recipe", `recipe.play_id must match /^[0-9]{2}$/`, { received: recipe.play_id });
  }
  if (typeof recipe.play_slug !== "string" || recipe.play_slug.length === 0) {
    throw new OrchardCliError("invalid_recipe", "recipe.play_slug required", {});
  }
  if (!Array.isArray(recipe.files)) {
    throw new OrchardCliError("invalid_recipe", "recipe.files must be an array", {});
  }
  if (recipe.files.length > RECIPE_MAX_FILES) {
    throw new OrchardCliError("invalid_recipe",
      `recipe.files.length=${recipe.files.length} > cap ${RECIPE_MAX_FILES}`,
      { count: recipe.files.length });
  }
  let totalBytes = 0;
  const seen = new Set();
  for (const file of recipe.files) {
    if (!file || typeof file !== "object") {
      throw new OrchardCliError("invalid_recipe", "each recipe.files[] entry must be an object", {});
    }
    if (!isSafeRelPath(file.rel)) {
      throw new OrchardCliError("unsafe_path", `recipe contains unsafe path: ${JSON.stringify(file.rel)}`, { rel: file.rel });
    }
    if (typeof file.content !== "string") {
      throw new OrchardCliError("invalid_recipe", `file ${file.rel} content must be string`, { rel: file.rel });
    }
    const bytes = Buffer.byteLength(file.content, "utf8");
    if (bytes > FILE_MAX_BYTES) {
      throw new OrchardCliError("invalid_recipe",
        `file ${file.rel} (${bytes} bytes) exceeds per-file cap ${FILE_MAX_BYTES}`,
        { rel: file.rel, bytes });
    }
    totalBytes += bytes;
    if (totalBytes > RECIPE_MAX_BYTES) {
      throw new OrchardCliError("invalid_recipe",
        `recipe total ${totalBytes} bytes exceeds cap ${RECIPE_MAX_BYTES}`,
        { totalBytes });
    }
    if (seen.has(file.rel)) {
      throw new OrchardCliError("invalid_recipe", `recipe has duplicate file: ${file.rel}`, { rel: file.rel });
    }
    seen.add(file.rel);
  }
  return true;
}

/** Pure: group files in a recipe by surface (agents, skills, ...) for pretty output. */
function summarizeRecipe(recipe) {
  if (!recipe || !Array.isArray(recipe.files)) return { total: 0, by_surface: {} };
  const by_surface = Object.create(null);
  for (const f of recipe.files) {
    const seg = f.rel.split("/")[0] || "(root)";
    by_surface[seg] = (by_surface[seg] || 0) + 1;
  }
  return {
    total: recipe.files.length,
    total_bytes: recipe.files.reduce((sum, f) => sum + Buffer.byteLength(f.content, "utf8"), 0),
    by_surface,
  };
}

/** Find the local plays root directory. */
function resolveLocalPlaysRoot(explicit) {
  if (explicit && typeof explicit === "string" && explicit.length > 0) return explicit;
  if (process.env[PLAYS_DIR_ENV]) return process.env[PLAYS_DIR_ENV];
  // Default: <cli-root>/../plays — npm tarball will package plays/ alongside cli/.
  // Dev: walk up looking for frootai/solution-plays/ to source from the monorepo.
  // We try a few candidates and use the first that exists.
  const candidates = [
    path.resolve(__dirname, "..", "..", "..", "plays"),                          // frootai-core/plays (packaged)
    path.resolve(__dirname, "..", "..", "..", "..", "frootai", "solution-plays"), // monorepo dev
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0]; // fallthrough — caller will get a clean ENOENT
}

async function _walkRecipeDir(dirAbs, relBase, files, opts) {
  let entries;
  try { entries = await fsP.readdir(dirAbs, { withFileTypes: true }); }
  catch (err) {
    if (err && /** @type {any} */(err).code === "ENOENT") return;
    throw err;
  }
  for (const e of entries) {
    const childAbs = path.join(dirAbs, e.name);
    const childRel = relBase ? `${relBase}/${e.name}` : e.name;
    if (e.isDirectory()) {
      await _walkRecipeDir(childAbs, childRel, files, opts);
    } else if (e.isFile()) {
      const stat = await fsP.stat(childAbs);
      if (stat.size > FILE_MAX_BYTES) {
        throw new OrchardCliError("invalid_recipe",
          `Play file ${childRel} (${stat.size} bytes) exceeds per-file cap ${FILE_MAX_BYTES}`,
          { rel: childRel, bytes: stat.size });
      }
      const content = await fsP.readFile(childAbs, "utf8");
      files.push({ rel: childRel, content });
    }
  }
}

/**
 * Build a LocalDirRecipeProvider pinned to a plays root directory.
 *
 * @param {object} [opts]
 * @param {string} [opts.playsRoot]  override plays directory (defaults via resolveLocalPlaysRoot)
 */
function buildLocalDirRecipeProvider(opts) {
  const o = opts || {};
  const root = resolveLocalPlaysRoot(o.playsRoot);

  return {
    name: "local-dir",
    root,

    async listAvailable() {
      let entries;
      try { entries = await fsP.readdir(root, { withFileTypes: true }); }
      catch (err) {
        if (err && /** @type {any} */(err).code === "ENOENT") return [];
        throw new OrchardCliError("io_error", `failed to list plays at ${root}: ${err instanceof Error ? err.message : String(err)}`, { root });
      }
      const available = [];
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const m = e.name.match(/^([0-9]{2})-(.+)$/);
        if (m) available.push({ play_id: m[1], play_slug: m[2], dir_name: e.name });
      }
      return available;
    },

    async loadRecipe(playId) {
      if (!isValidPlayId(playId)) {
        throw new OrchardCliError("invalid_input", `play id must be 2 digits: ${JSON.stringify(playId)}`, { received: playId });
      }
      const available = await this.listAvailable();
      const entry = available.find((a) => a.play_id === playId);
      if (!entry) {
        throw new OrchardCliError("play_not_found",
          `Play ${playId} not found in ${root}. Available: ${available.map((a) => a.play_id).join(", ") || "(none)"}.`,
          { play_id: playId, root, available_ids: available.map((a) => a.play_id) });
      }
      const playDir = path.join(root, entry.dir_name);
      const githubDir = path.join(playDir, ".github");
      if (!fs.existsSync(githubDir)) {
        throw new OrchardCliError("play_not_found",
          `Play ${playId} directory exists at ${playDir} but has no .github/ subdirectory.`,
          { play_id: playId, dir: playDir });
      }
      const files = [];
      // Root-level files (copilot-instructions.md, etc.).
      for (const name of RECIPE_ROOT_FILES) {
        const abs = path.join(githubDir, name);
        if (fs.existsSync(abs)) {
          const stat = await fsP.stat(abs);
          if (stat.size > FILE_MAX_BYTES) {
            throw new OrchardCliError("invalid_recipe",
              `Play ${playId} file ${name} (${stat.size} bytes) exceeds per-file cap ${FILE_MAX_BYTES}`,
              { rel: name, bytes: stat.size });
          }
          files.push({ rel: name, content: await fsP.readFile(abs, "utf8") });
        }
      }
      // Recipe subdirs (agents/, skills/, prompts/, ...).
      for (const sub of RECIPE_DIRS) {
        const subAbs = path.join(githubDir, sub);
        if (fs.existsSync(subAbs)) {
          await _walkRecipeDir(subAbs, sub, files, { playId });
        }
      }
      // Stable sort for deterministic output.
      files.sort((a, b) => a.rel.localeCompare(b.rel));

      const recipe = {
        v: RECIPE_VERSION,
        play_id: playId,
        play_slug: entry.play_slug,
        source: "local-dir",
        source_path: playDir,
        loaded_at: new Date().toISOString(),
        files,
      };
      validateRecipe(recipe);
      return recipe;
    },
  };
}

/** Build an in-memory provider for tests. */
function buildMemoryRecipeProvider(recipes) {
  const map = new Map();
  for (const r of recipes || []) {
    if (r && r.play_id) map.set(r.play_id, r);
  }
  return {
    name: "memory",
    root: ":memory:",
    async listAvailable() {
      return [...map.values()].map((r) => ({ play_id: r.play_id, play_slug: r.play_slug, dir_name: `${r.play_id}-${r.play_slug}` }));
    },
    async loadRecipe(playId) {
      const r = map.get(playId);
      if (!r) {
        throw new OrchardCliError("play_not_found",
          `Play ${playId} not found in memory provider.`,
          { play_id: playId, available_ids: [...map.keys()] });
      }
      validateRecipe(r);
      return r;
    },
  };
}

module.exports = {
  RECIPE_VERSION,
  RECIPE_MAX_BYTES,
  RECIPE_MAX_FILES,
  FILE_MAX_BYTES,
  PLAYS_DIR_ENV,
  RECIPE_DIRS,
  RECIPE_ROOT_FILES,
  isSafeRelPath,
  isValidPlayId,
  validateRecipe,
  summarizeRecipe,
  resolveLocalPlaysRoot,
  buildLocalDirRecipeProvider,
  buildMemoryRecipeProvider,
};
