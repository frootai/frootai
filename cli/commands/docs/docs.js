// @ts-check
/**
 * [H8.29] docs.js — CLI reference docs generator.
 *
 * Contract (verbatim from masterplan §3 row [H8.29]):
 *   Docs: full reference at `docs/cli/orchard/<subcommand>.md` for each
 *   of 12 subcommands; auto-generated from cli framework + hand-edited
 *   examples
 *
 * Top-level group `docs/` parallels `e2e/` (H8.28) per H8.x
 * group-per-domain doctrine. Library lives at
 * `cli/commands/docs/docs.js` so the bin-reconciliation sub-phase can
 * wire it into the docs-site build (frootai.dev) WITHOUT changing the
 * existing 2790 H8.x tests. This file ships the registry + renderer +
 * a `runWithDeps(args, ctx, deps)` + `run(args, ctx)` demo runner that
 * round-trips the 12 docs entries.
 *
 * **"Auto-generated from cli framework + hand-edited examples"**
 * interpretation: each subcommand is described by a frozen DocsEntry
 * record (`{slug, group, title, description, synopsis, options,
 * examples, exitCodes, seeAlso}`) baked into this library. The
 * renderer emits canonical markdown with frontmatter consumable by the
 * frootai.dev docs site (Nextra). "Auto-generated" = the markdown
 * comes from `renderDocsEntry(entry)` on every run; "hand-edited
 * examples" = the `examples` field is human-curated in the registry
 * (NOT scraped from --help). When a handler gains a new flag, the
 * docs maintainer adds an `options[]` entry here + the renderer
 * automatically refreshes the docs.
 *
 * **12 SUBCOMMANDS** (= the masterplan row's "12"):
 *   discover, fetch, extract, retrieve, scaffold, compose-infra,
 *   customize, install, commit, re-harvest, list-pending-reviews
 *   (= the 11 H8.2-H8.12 orchard stage handlers), plus
 *   install-tui (H8.25 — interactive picker for install)
 *   = 12 entries.
 *
 * **Output target**: `docs/cli/orchard/<slug>.md` for each entry.
 * The frontmatter shape is canonical Nextra:
 *   ---
 *   title: <title>
 *   description: <one-line description>
 *   sidebar_label: <slug>
 *   ---
 *
 * Followed by sections: Synopsis (fenced bash), Description,
 * Options (markdown table), Examples (per-example title + fenced
 * command + expected-output if provided), Exit Codes (markdown table),
 * See Also (bullet list of cross-links).
 *
 * **Subcommand argv grammar** — `frootai docs <subcommand>`:
 *   list                       list all 12 doc entries
 *   show <slug>                print one entry's rendered markdown
 *   generate [--out <dir>]     write all 12 .md files under <dir>
 *                                (default: `docs/cli/orchard/`)
 *   --json                     emit JSON shape on stdout (vs markdown)
 *   --dry-run                  generate: don't write; print paths
 *                                that WOULD be written
 *   --help, -h                 print help + exit OK
 *
 * **Exit codes**:
 *   0    OK              — listing / show / generate succeeded
 *   64   USAGE           — bad flags / unknown subcommand / unknown slug
 *   66   NOINPUT         — generate target dir creation failed
 *   70   SOFTWARE        — unexpected internal error
 *   74   IOERR           — write failure
 *
 * **Non-goals for THIS ship**:
 *   - Wiring into the actual frootai.dev docs site build (a separate
 *     site-build ship will call `runWithDeps(["generate","--out",
 *     "<site-docs-path>"])` from the site's package.json prebuild
 *     hook; we ship only the library + CI smoke target)
 *   - Hand-editing the examples to anything more than placeholder
 *     reality (a docs maintainer pass will refine each example's
 *     `expected_output` from real captured runs; the schema + the
 *     12 entries are crystallized this ship)
 *   - i18n of doc copy (always English; site supports translation
 *     overlays separately)
 *
 * License: CC0-1.0.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  NOINPUT: 66,
  SOFTWARE: 70,
  IOERR: 74,
});

const SUBCOMMANDS = Object.freeze(["list", "show", "generate"]);

const VALUE_FLAGS = new Set(["--out"]);
const BOOL_FLAGS = new Set(["--json", "--dry-run", "--help", "-h"]);

const DEFAULT_OUT_DIR = "docs/cli/orchard";

class DocsError extends Error {
  /** @param {string} code @param {string} message @param {{exitCode?: number, cause?: Error}} [opts] */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "DocsError";
    this.code = code;
    this.exitCode = Number.isInteger(opts.exitCode) ? /** @type {number} */ (opts.exitCode) : EXIT.SOFTWARE;
    if (opts.cause) this.cause = opts.cause;
  }
}

// ─────────────────────────────────────────────────────────────────
//  Registry: 12 docs entries (one per orchard subcommand).
//  Schema: { slug, group, title, description, synopsis, options[],
//            examples[], exitCodes[], seeAlso[] }
//  All entries are frozen (Object.freeze deep-applied at end).
// ─────────────────────────────────────────────────────────────────

const COMMON_GLOBAL_OPTIONS = Object.freeze([
  { flag: "--json", description: "Emit machine-readable JSON to stdout (vs human text)" },
  { flag: "--help, -h", description: "Print subcommand help and exit OK" },
]);

const COMMON_EXIT_CODES = Object.freeze([
  { code: 0, name: "OK", description: "Subcommand completed successfully" },
  { code: 64, name: "USAGE", description: "Bad flags / unknown subcommand / invalid arguments" },
  { code: 65, name: "DATA_ERR", description: "Validation failed (schema gate, scaffold confidence, H7 gate)" },
  { code: 66, name: "NOINPUT", description: "Required input file missing or malformed" },
  { code: 69, name: "UNAVAILABLE", description: "Upstream unavailable (GitHub rate limit, infra gate)" },
  { code: 70, name: "SOFTWARE", description: "Unexpected internal error" },
  { code: 74, name: "IOERR", description: "Write failure (cache, output directory)" },
  { code: 75, name: "TEMPFAIL", description: "Transient — retry later (LLM call, embedding)" },
  { code: 77, name: "NOPERM", description: "403 / Forbidden — token lacks required scope" },
]);

/** @type {Array<{slug: string, group: string, title: string, description: string, synopsis: string, options: Array<{flag: string, description: string, default?: string}>, examples: Array<{title: string, command: string, expected_output?: string}>, exitCodes: Array<{code: number, name: string, description: string}>, seeAlso: string[]}>} */
const RAW_DOCS_ENTRIES = [
  {
    slug: "discover",
    group: "orchard",
    title: "frootai orchard discover",
    description: "Resolve a GitHub URL or owner/repo slug to a DiscoverRecord (owner + repo + default branch SHA). Honors the local cache.",
    synopsis: "frootai orchard discover <url-or-slug> [--no-cache] [--json] [--persist-dir <p>]",
    options: [
      { flag: "<url-or-slug>", description: "GitHub repo URL or `owner/repo` shorthand (REQUIRED)" },
      { flag: "--no-cache", description: "Bypass the on-disk DiscoverRecord cache" },
      { flag: "--persist-dir <p>", description: "Override the cache directory", default: "~/.frootai/cache/discover" },
      ...COMMON_GLOBAL_OPTIONS,
    ],
    examples: [
      { title: "Discover a known repo", command: "frootai orchard discover Azure-Samples/azure-search-openai-demo" },
      { title: "Force re-resolve (skip cache)", command: "frootai orchard discover microsoft/ai-agents-for-beginners --no-cache" },
      { title: "Machine-readable", command: "frootai orchard discover Azure/GPT-RAG --json", expected_output: "{\"ok\":true,\"owner\":\"Azure\",\"repo\":\"GPT-RAG\",\"sha\":\"...\"}" },
    ],
    exitCodes: COMMON_EXIT_CODES,
    seeAlso: ["fetch", "install"],
  },
  {
    slug: "fetch",
    group: "orchard",
    title: "frootai orchard fetch",
    description: "Snapshot the files of a discovered repo into a local FetchRecord. Skips already-cached fresh records unless --force.",
    synopsis: "frootai orchard fetch <url-or-slug> [--force] [--json] [--workdir-root <p>]",
    options: [
      { flag: "<url-or-slug>", description: "GitHub repo URL or `owner/repo` shorthand (REQUIRED)" },
      { flag: "--force", description: "Re-fetch even if the cached FetchRecord is fresh" },
      { flag: "--workdir-root <p>", description: "Override the temp clone workdir root", default: "~/.frootai/workdir" },
      ...COMMON_GLOBAL_OPTIONS,
    ],
    examples: [
      { title: "Fetch into the default workdir", command: "frootai orchard fetch Azure-Samples/azure-search-openai-demo" },
      { title: "Force re-fetch", command: "frootai orchard fetch Azure/GPT-RAG --force" },
    ],
    exitCodes: COMMON_EXIT_CODES,
    seeAlso: ["discover", "extract"],
  },
  {
    slug: "extract",
    group: "orchard",
    title: "frootai orchard extract",
    description: "Derive RepoFacts (cloud, domain, frameworks, IaC type) from a FetchRecord. Pure schema-gated extraction.",
    synopsis: "frootai orchard extract <url-or-slug> [--json]",
    options: [
      { flag: "<url-or-slug>", description: "GitHub repo URL or `owner/repo` shorthand (REQUIRED)" },
      ...COMMON_GLOBAL_OPTIONS,
    ],
    examples: [
      { title: "Extract facts from a fetched repo", command: "frootai orchard extract Azure-Samples/azure-search-openai-demo" },
      { title: "Pipe to jq", command: "frootai orchard extract Azure/GPT-RAG --json | jq .primary_cloud" },
    ],
    exitCodes: COMMON_EXIT_CODES,
    seeAlso: ["fetch", "retrieve", "scaffold"],
  },
  {
    slug: "retrieve",
    group: "orchard",
    title: "frootai orchard retrieve",
    description: "Retrieve top-K nearest exemplar plays from the corpus to ground the LLM scaffolder. Uses embeddings + cosine similarity.",
    synopsis: "frootai orchard retrieve <url-or-slug> [--top-k <n>] [--mock] [--json]",
    options: [
      { flag: "<url-or-slug>", description: "GitHub repo URL or `owner/repo` shorthand (REQUIRED)" },
      { flag: "--top-k <n>", description: "Number of nearest plays to retrieve", default: "5" },
      { flag: "--mock", description: "Use deterministic mock embeddings (no LLM call)" },
      ...COMMON_GLOBAL_OPTIONS,
    ],
    examples: [
      { title: "Retrieve top-5 exemplars", command: "frootai orchard retrieve Azure-Samples/azure-search-openai-demo" },
      { title: "Retrieve top-3 with mock embeddings", command: "frootai orchard retrieve Azure/GPT-RAG --top-k 3 --mock" },
    ],
    exitCodes: COMMON_EXIT_CODES,
    seeAlso: ["extract", "scaffold"],
  },
  {
    slug: "scaffold",
    group: "orchard",
    title: "frootai orchard scaffold",
    description: "Generate 25 LLM-grounded play files (README, dotnet/python/node snippets, validators) using H4 retrievals.",
    synopsis: "frootai orchard scaffold <url-or-slug> [--mock] [--model <name>] [--out <dir>] [--json]",
    options: [
      { flag: "<url-or-slug>", description: "GitHub repo URL or `owner/repo` shorthand (REQUIRED)" },
      { flag: "--mock", description: "Use deterministic mock LLM (no API call)" },
      { flag: "--model <name>", description: "Override the scaffold LLM", default: "gpt-4o-mini" },
      { flag: "--out <dir>", description: "Output directory for the 25 files", default: "tmp/scaffold/<slug>/" },
      ...COMMON_GLOBAL_OPTIONS,
    ],
    examples: [
      { title: "Scaffold a play (real LLM)", command: "frootai orchard scaffold Azure-Samples/azure-search-openai-demo" },
      { title: "Scaffold with mock LLM", command: "frootai orchard scaffold Azure/GPT-RAG --mock --out ./my-play/" },
    ],
    exitCodes: COMMON_EXIT_CODES,
    seeAlso: ["retrieve", "compose-infra", "install"],
  },
  {
    slug: "compose-infra",
    group: "orchard",
    title: "frootai orchard compose-infra",
    description: "Deterministically emit infrastructure-as-code files (Bicep, Terraform, AVM modules) per the scaffold's RepoFacts.",
    synopsis: "frootai orchard compose-infra <url-or-slug> [--customize <yaml>] [--json]",
    options: [
      { flag: "<url-or-slug>", description: "GitHub repo URL or `owner/repo` shorthand (REQUIRED)" },
      { flag: "--customize <yaml>", description: "Apply an org policy overlay (YAML or JSON)" },
      ...COMMON_GLOBAL_OPTIONS,
    ],
    examples: [
      { title: "Emit infra with defaults", command: "frootai orchard compose-infra Azure-Samples/azure-search-openai-demo" },
      { title: "Apply an org policy overlay", command: "frootai orchard compose-infra Azure/GPT-RAG --customize ./org-policy.yaml" },
    ],
    exitCodes: COMMON_EXIT_CODES,
    seeAlso: ["scaffold", "customize", "install"],
  },
  {
    slug: "customize",
    group: "orchard",
    title: "frootai orchard customize",
    description: "Parse + validate an org-policy overlay file (YAML or JSON). Apply to a composed infra set to preview the merged result.",
    synopsis: "frootai orchard customize <policy-file> [--apply <slug>] [--json]",
    options: [
      { flag: "<policy-file>", description: "Path to the org policy YAML/JSON (REQUIRED)" },
      { flag: "--apply <slug>", description: "Apply the policy to an already-composed play and emit the merged result" },
      ...COMMON_GLOBAL_OPTIONS,
    ],
    examples: [
      { title: "Validate a policy file", command: "frootai orchard customize ./org-policy.yaml" },
      { title: "Preview merged result", command: "frootai orchard customize ./org-policy.yaml --apply azure-search-openai-demo" },
    ],
    exitCodes: COMMON_EXIT_CODES,
    seeAlso: ["compose-infra", "install"],
  },
  {
    slug: "install",
    group: "orchard",
    title: "frootai orchard install",
    description: "End-to-end: discover → fetch → extract → retrieve → scaffold → compose-infra → validate → unpack into out dir. THE command developers actually type.",
    synopsis: "frootai orchard install --as-play <url-or-slug> [--customize <yaml>] [--out <dir>] [--no-cache] [--force] [--no-retrieve] [--mock] [--top-k <n>] [--model <name>] [--skip-validate] [--json]",
    options: [
      { flag: "--as-play <url-or-slug>", description: "GitHub URL or known slug (REQUIRED)" },
      { flag: "--customize <yaml>", description: "Org policy file applied at compose-infra" },
      { flag: "--out <dir>", description: "Output directory", default: "tmp/plays/<slug>/" },
      { flag: "--no-cache", description: "Bypass discover cache READ" },
      { flag: "--force", description: "Re-fetch even if cached FetchRecord is fresh" },
      { flag: "--no-retrieve", description: "Skip H4 exemplar retrieval (scaffold without grounding)" },
      { flag: "--mock", description: "Use deterministic mock LLM + mock embeddings" },
      { flag: "--top-k <n>", description: "Number of nearest plays to retrieve", default: "5" },
      { flag: "--model <name>", description: "Override scaffold LLM", default: "gpt-4o-mini" },
      { flag: "--skip-validate", description: "Skip the H7 validator gate (ships the play anyway)" },
      ...COMMON_GLOBAL_OPTIONS,
    ],
    examples: [
      { title: "Install a free-list repo (full pipeline)", command: "frootai orchard install --as-play Azure-Samples/azure-search-openai-demo" },
      { title: "Install with org policy + custom out dir", command: "frootai orchard install --as-play Azure/GPT-RAG --customize ./org-policy.yaml --out ./plays/gpt-rag" },
      { title: "Fast iteration (mock LLM, no retrieval)", command: "frootai orchard install --as-play Azure-Samples/azure-search-openai-demo --mock --no-retrieve" },
    ],
    exitCodes: COMMON_EXIT_CODES,
    seeAlso: ["install-tui", "scaffold", "compose-infra"],
  },
  {
    slug: "commit",
    group: "orchard",
    title: "frootai orchard commit",
    description: "Commit a generated play directory to git: create branch, stage files, commit with conventional message, optionally push.",
    synopsis: "frootai orchard commit <play-dir> [--branch <name>] [--push] [--remote <name>] [--json]",
    options: [
      { flag: "<play-dir>", description: "Path to the play directory to commit (REQUIRED)" },
      { flag: "--branch <name>", description: "Branch name to create/use", default: "orchard/<slug>" },
      { flag: "--push", description: "Push the branch to the remote after commit" },
      { flag: "--remote <name>", description: "Remote name to push to", default: "origin" },
      ...COMMON_GLOBAL_OPTIONS,
    ],
    examples: [
      { title: "Commit locally only", command: "frootai orchard commit ./plays/gpt-rag" },
      { title: "Commit + push to origin", command: "frootai orchard commit ./plays/gpt-rag --push" },
    ],
    exitCodes: COMMON_EXIT_CODES,
    seeAlso: ["install", "re-harvest"],
  },
  {
    slug: "re-harvest",
    group: "orchard",
    title: "frootai orchard re-harvest",
    description: "Re-run a previously-installed play against the upstream's latest SHA. Diffs the regenerated files against the committed version and surfaces drift.",
    synopsis: "frootai orchard re-harvest <play-dir> [--no-cache] [--diff-only] [--json]",
    options: [
      { flag: "<play-dir>", description: "Path to the play directory previously installed (REQUIRED)" },
      { flag: "--no-cache", description: "Bypass discover cache" },
      { flag: "--diff-only", description: "Print the drift report only; don't write any files" },
      ...COMMON_GLOBAL_OPTIONS,
    ],
    examples: [
      { title: "Re-harvest a play", command: "frootai orchard re-harvest ./plays/gpt-rag" },
      { title: "Just show the drift", command: "frootai orchard re-harvest ./plays/gpt-rag --diff-only" },
    ],
    exitCodes: COMMON_EXIT_CODES,
    seeAlso: ["install", "commit"],
  },
  {
    slug: "list-pending-reviews",
    group: "orchard",
    title: "frootai orchard list-pending-reviews",
    description: "List plays whose source repo has new upstream commits since the last re-harvest. Helps maintainers prioritize review work.",
    synopsis: "frootai orchard list-pending-reviews [--root <dir>] [--threshold <n>] [--json]",
    options: [
      { flag: "--root <dir>", description: "Root directory containing one subdir per play", default: "./plays" },
      { flag: "--threshold <n>", description: "Min commits behind upstream to flag (default 1)", default: "1" },
      ...COMMON_GLOBAL_OPTIONS,
    ],
    examples: [
      { title: "List all pending review work", command: "frootai orchard list-pending-reviews" },
      { title: "Only plays > 10 commits behind", command: "frootai orchard list-pending-reviews --threshold 10" },
    ],
    exitCodes: COMMON_EXIT_CODES,
    seeAlso: ["re-harvest"],
  },
  {
    slug: "install-tui",
    group: "orchard",
    title: "frootai orchard install-tui",
    description: "Interactive picker for `install` when no URL is provided. Browse the harvest free-list, pick a repo, confirm the output directory.",
    synopsis: "frootai orchard install-tui [--page-size <n>] [--workdir-root <p>] [--json]",
    options: [
      { flag: "--page-size <n>", description: "Page size for the list", default: "10" },
      { flag: "--workdir-root <p>", description: "Parent dir for the default --out suggestion", default: "tmp/plays" },
      ...COMMON_GLOBAL_OPTIONS,
    ],
    examples: [
      { title: "Browse the free list interactively", command: "frootai orchard install-tui" },
      { title: "Use a larger page size", command: "frootai orchard install-tui --page-size 25" },
      { title: "Get the picker's choice as JSON (e.g. for scripts)", command: "frootai orchard install-tui --json" },
    ],
    exitCodes: COMMON_EXIT_CODES,
    seeAlso: ["install"],
  },
];

const DOCS_ENTRIES = Object.freeze(RAW_DOCS_ENTRIES.map(deepFreezeEntry));

const ENTRY_SLUGS = Object.freeze(DOCS_ENTRIES.map((e) => e.slug));

if (DOCS_ENTRIES.length !== 12) {
  throw new Error(`[H8.29] internal: expected exactly 12 docs entries, got ${DOCS_ENTRIES.length}`);
}

/** @param {*} e */
function deepFreezeEntry(e) {
  return Object.freeze({
    slug: e.slug,
    group: e.group,
    title: e.title,
    description: e.description,
    synopsis: e.synopsis,
    options: Object.freeze(e.options.map((o) => Object.freeze(Object.assign({}, o)))),
    examples: Object.freeze(e.examples.map((ex) => Object.freeze(Object.assign({}, ex)))),
    exitCodes: Object.freeze(e.exitCodes.map((c) => Object.freeze(Object.assign({}, c)))),
    seeAlso: Object.freeze(e.seeAlso.slice()),
  });
}

/**
 * Parse argv for `frootai docs <subcommand>`.
 *
 * @param {string[]} argv
 * @returns {{subcommand: string|null, slug: string|null, out: string, json: boolean, dryRun: boolean, help: boolean}}
 */
function parseDocsArgs(argv) {
  if (!Array.isArray(argv)) throw new TypeError("parseDocsArgs: argv must be an array");
  const out = {
    subcommand: /** @type {string|null} */ (null),
    slug: /** @type {string|null} */ (null),
    out: DEFAULT_OUT_DIR,
    json: false,
    dryRun: false,
    help: false,
  };
  /** @type {string[]} */ const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (typeof a !== "string") throw new DocsError("usage", `argv[${i}] must be a string`, { exitCode: EXIT.USAGE });
    if (a === "--help" || a === "-h") { out.help = true; continue; }
    if (a === "--json") { out.json = true; continue; }
    if (a === "--dry-run") { out.dryRun = true; continue; }
    const eq = a.indexOf("=");
    if (a.startsWith("--") && eq > 0) {
      const flag = a.slice(0, eq);
      const value = a.slice(eq + 1);
      if (!VALUE_FLAGS.has(flag)) throw new DocsError("usage", `unknown flag: ${flag}`, { exitCode: EXIT.USAGE });
      applyValueFlag(out, flag, value);
      continue;
    }
    if (VALUE_FLAGS.has(a)) {
      const v = argv[++i];
      if (typeof v !== "string") throw new DocsError("usage", `${a} requires a value`, { exitCode: EXIT.USAGE });
      applyValueFlag(out, a, v);
      continue;
    }
    if (a.startsWith("-")) throw new DocsError("usage", `unknown flag: ${a}`, { exitCode: EXIT.USAGE });
    positional.push(a);
  }
  if (positional.length === 0) return out;
  const sub = positional[0];
  if (!SUBCOMMANDS.includes(sub)) throw new DocsError("usage", `unknown subcommand: ${sub} (valid: ${SUBCOMMANDS.join("|")})`, { exitCode: EXIT.USAGE });
  out.subcommand = sub;
  if (sub === "list" || sub === "generate") {
    if (positional.length > 1) throw new DocsError("usage", `${sub} accepts no positional args`, { exitCode: EXIT.USAGE });
  } else if (sub === "show") {
    if (positional.length < 2) throw new DocsError("usage", `show requires a subcommand slug`, { exitCode: EXIT.USAGE });
    if (positional.length > 2) throw new DocsError("usage", `show accepts exactly one positional arg`, { exitCode: EXIT.USAGE });
    if (!ENTRY_SLUGS.includes(positional[1])) {
      throw new DocsError("usage", `unknown slug: ${positional[1]} (run 'frootai docs list')`, { exitCode: EXIT.USAGE });
    }
    out.slug = positional[1];
  }
  return out;
}

/** @param {*} out @param {string} flag @param {string} value */
function applyValueFlag(out, flag, value) {
  if (flag === "--out") {
    if (!value) throw new DocsError("usage", `--out requires a non-empty value`, { exitCode: EXIT.USAGE });
    out.out = value;
  }
}

function buildHelp() {
  return [
    "Usage: frootai docs <subcommand> [OPTIONS]",
    "",
    "Generate CLI reference docs for the 12 orchard subcommands.",
    "",
    "Subcommands:",
    "  list                  list all 12 doc entries (slug + title)",
    "  show <slug>           print one entry's rendered markdown",
    "  generate              write all 12 .md files under --out",
    "",
    "Options:",
    "  --out <dir>           output directory (default: docs/cli/orchard)",
    "  --dry-run             generate: print paths without writing",
    "  --json                emit JSON instead of markdown (list / show)",
    "  --help, -h            print this help",
    "",
    "License: CC0-1.0.",
  ].join("\n");
}

/**
 * Look up a docs entry by slug. Pure. Returns null on miss.
 *
 * @param {string} slug
 * @returns {(typeof DOCS_ENTRIES)[number]|null}
 */
function findDocsEntry(slug) {
  return DOCS_ENTRIES.find((e) => e.slug === slug) || null;
}

/**
 * Compute the on-disk path for an entry under a given out dir. Pure.
 * Always uses POSIX-style joins for portability across the docs site.
 *
 * @param {{slug: string}} entry
 * @param {string} outDir
 * @returns {string}
 */
function buildDocsPath(entry, outDir) {
  if (!entry || typeof entry.slug !== "string") {
    throw new DocsError("usage", `buildDocsPath: bad entry`, { exitCode: EXIT.USAGE });
  }
  const dir = outDir || DEFAULT_OUT_DIR;
  return path.posix.join(dir, `${entry.slug}.md`);
}

/**
 * Escape a string for safe inclusion in YAML frontmatter as a double-
 * quoted scalar. Pure.
 *
 * @param {string} s
 * @returns {string}
 */
function yamlEscape(s) {
  if (typeof s !== "string") return "";
  return s.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

/**
 * Render one DocsEntry to canonical markdown. Pure. Frontmatter is
 * Nextra-compatible.
 *
 * @param {(typeof DOCS_ENTRIES)[number]} entry
 * @returns {string}
 */
function renderDocsEntry(entry) {
  if (!entry || typeof entry.slug !== "string") {
    throw new DocsError("usage", `renderDocsEntry: bad entry`, { exitCode: EXIT.USAGE });
  }
  /** @type {string[]} */ const lines = [];
  // Frontmatter
  lines.push("---");
  lines.push(`title: "${yamlEscape(entry.title)}"`);
  lines.push(`description: "${yamlEscape(entry.description)}"`);
  lines.push(`sidebar_label: "${yamlEscape(entry.slug)}"`);
  lines.push("---");
  lines.push("");
  // H1
  lines.push(`# ${entry.title}`);
  lines.push("");
  lines.push(entry.description);
  lines.push("");
  // Synopsis
  lines.push("## Synopsis");
  lines.push("");
  lines.push("```bash");
  lines.push(entry.synopsis);
  lines.push("```");
  lines.push("");
  // Options
  if (Array.isArray(entry.options) && entry.options.length > 0) {
    lines.push("## Options");
    lines.push("");
    lines.push("| Flag | Default | Description |");
    lines.push("|------|---------|-------------|");
    for (const o of entry.options) {
      const def = o.default ? `\`${o.default}\`` : "—";
      lines.push(`| \`${o.flag}\` | ${def} | ${escapeMdCell(o.description)} |`);
    }
    lines.push("");
  }
  // Examples
  if (Array.isArray(entry.examples) && entry.examples.length > 0) {
    lines.push("## Examples");
    lines.push("");
    for (const ex of entry.examples) {
      lines.push(`### ${ex.title}`);
      lines.push("");
      lines.push("```bash");
      lines.push(ex.command);
      lines.push("```");
      if (ex.expected_output) {
        lines.push("");
        lines.push("Output:");
        lines.push("");
        lines.push("```");
        lines.push(ex.expected_output);
        lines.push("```");
      }
      lines.push("");
    }
  }
  // Exit codes
  if (Array.isArray(entry.exitCodes) && entry.exitCodes.length > 0) {
    lines.push("## Exit Codes");
    lines.push("");
    lines.push("| Code | Name | Description |");
    lines.push("|------|------|-------------|");
    for (const c of entry.exitCodes) {
      lines.push(`| ${c.code} | \`${c.name}\` | ${escapeMdCell(c.description)} |`);
    }
    lines.push("");
  }
  // See Also
  if (Array.isArray(entry.seeAlso) && entry.seeAlso.length > 0) {
    lines.push("## See Also");
    lines.push("");
    for (const link of entry.seeAlso) {
      lines.push(`- [\`frootai orchard ${link}\`](./${link}.md)`);
    }
    lines.push("");
  }
  // Footer
  lines.push("---");
  lines.push("");
  lines.push("_Auto-generated by `frootai docs generate` — DO NOT EDIT BY HAND. To change this page, edit the `DOCS_ENTRIES` registry in `cli/commands/docs/docs.js`._");
  lines.push("");
  return lines.join("\n");
}

/**
 * Escape pipe + newline chars in a markdown-table cell. Pure.
 *
 * @param {string} s
 * @returns {string}
 */
function escapeMdCell(s) {
  if (typeof s !== "string") return "";
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/**
 * Build the full set of `{path, content}` records for `generate`.
 * Pure. Callers may then write each `(path, content)` via deps.
 *
 * @param {string} [outDir]
 * @returns {Array<{path: string, content: string, slug: string}>}
 */
function buildGenerationPlan(outDir) {
  const dir = outDir || DEFAULT_OUT_DIR;
  return DOCS_ENTRIES.map((e) => ({
    slug: e.slug,
    path: buildDocsPath(e, dir),
    content: renderDocsEntry(e),
  }));
}

/**
 * Execute a generation plan against injectable filesystem deps. Pure
 * (modulo the injected side effects). Returns a per-file result.
 *
 * @param {ReturnType<typeof buildGenerationPlan>} plan
 * @param {object} deps
 * @param {(p: string) => void} deps.mkdirp — recursively create dir
 * @param {(p: string, body: string) => void} deps.writeFile
 * @returns {Array<{slug: string, path: string, status: "written"|"error", error?: string, bytes: number}>}
 */
function executeGenerationPlan(plan, deps) {
  if (!Array.isArray(plan)) {
    throw new DocsError("usage", `executeGenerationPlan: plan must be an array`, { exitCode: EXIT.USAGE });
  }
  const d = deps || /** @type {*} */ ({});
  if (typeof d.mkdirp !== "function" || typeof d.writeFile !== "function") {
    throw new DocsError("usage", `executeGenerationPlan: deps.mkdirp + deps.writeFile required`, { exitCode: EXIT.USAGE });
  }
  /** @type {Array<*>} */ const results = [];
  for (const entry of plan) {
    try {
      const dir = path.posix.dirname(entry.path);
      d.mkdirp(dir);
      d.writeFile(entry.path, entry.content);
      results.push({ slug: entry.slug, path: entry.path, status: "written", bytes: Buffer.byteLength(entry.content, "utf8") });
    } catch (err) {
      results.push({ slug: entry.slug, path: entry.path, status: "error", error: err && err.message ? err.message : String(err), bytes: 0 });
    }
  }
  return results;
}

/**
 * Render a human-readable `list` summary. Pure.
 *
 * @returns {string}
 */
function renderList() {
  return DOCS_ENTRIES.map((e) => `${e.slug.padEnd(24, " ")} ${e.title}`).join("\n");
}

/**
 * Build the JSON payload for `list --json` / `generate --json`. Pure.
 *
 * @returns {Array<{slug: string, title: string, description: string, group: string}>}
 */
function buildListJson() {
  return DOCS_ENTRIES.map((e) => ({
    slug: e.slug,
    group: e.group,
    title: e.title,
    description: e.description,
  }));
}

/**
 * Render the post-generate summary in human form. Pure.
 *
 * @param {ReturnType<typeof executeGenerationPlan>} results
 * @returns {string}
 */
function renderGenerateSummary(results) {
  /** @type {string[]} */ const lines = [];
  let written = 0, errored = 0, bytes = 0;
  for (const r of results) {
    if (r.status === "written") {
      lines.push(`WROTE ${r.path}  (${r.bytes} bytes)`);
      written++;
      bytes += r.bytes;
    } else {
      lines.push(`ERROR ${r.path}  ${r.error}`);
      errored++;
    }
  }
  lines.push("");
  lines.push(`Total: ${results.length}  Written: ${written}  Errored: ${errored}  Bytes: ${bytes}`);
  return lines.join("\n");
}

/**
 * Two-surface demo runner.
 *
 * @param {string[]} argv
 * @param {object} [ctx]
 * @param {object} [deps]
 * @param {(s: string) => void} [deps.write]
 * @param {(s: string) => void} [deps.writeLn]
 * @param {(p: string) => void} [deps.mkdirp]
 * @param {(p: string, body: string) => void} [deps.writeFile]
 * @returns {Promise<number>}
 */
async function runWithDeps(argv, ctx, deps) {
  const d = deps || {};
  const writeErr = typeof d.write === "function" ? d.write : (s) => { process.stderr.write(s); };
  const writeLn = typeof d.writeLn === "function" ? d.writeLn : (s) => { process.stdout.write(String(s) + "\n"); };
  const mkdirp = typeof d.mkdirp === "function" ? d.mkdirp : ((/** @type {string} */ p) => fs.mkdirSync(p, { recursive: true }));
  const writeFile = typeof d.writeFile === "function" ? d.writeFile : ((/** @type {string} */ p, /** @type {string} */ body) => fs.writeFileSync(p, body, "utf8"));

  let parsed;
  try { parsed = parseDocsArgs(argv); }
  catch (err) {
    writeErr(`error: ${err && err.message ? err.message : String(err)}\n`);
    writeErr(buildHelp() + "\n");
    return EXIT.USAGE;
  }
  if (parsed.help) { writeLn(buildHelp()); return EXIT.OK; }
  if (parsed.subcommand === null) {
    writeErr("error: missing subcommand\n");
    writeErr(buildHelp() + "\n");
    return EXIT.USAGE;
  }
  if (parsed.subcommand === "list") {
    if (parsed.json) writeLn(JSON.stringify(buildListJson()));
    else writeLn(renderList());
    return EXIT.OK;
  }
  if (parsed.subcommand === "show") {
    const entry = findDocsEntry(/** @type {string} */ (parsed.slug));
    if (!entry) {
      writeErr(`error: unknown slug: ${parsed.slug}\n`);
      return EXIT.USAGE;
    }
    if (parsed.json) writeLn(JSON.stringify(entry));
    else writeLn(renderDocsEntry(entry));
    return EXIT.OK;
  }
  // generate
  const plan = buildGenerationPlan(parsed.out);
  if (parsed.dryRun) {
    for (const p of plan) writeLn(`WOULD-WRITE ${p.path}  (${Buffer.byteLength(p.content, "utf8")} bytes)`);
    if (parsed.json) {
      writeLn(JSON.stringify(plan.map((p) => ({ slug: p.slug, path: p.path, bytes: Buffer.byteLength(p.content, "utf8") }))));
    }
    return EXIT.OK;
  }
  let results;
  try { results = executeGenerationPlan(plan, { mkdirp, writeFile }); }
  catch (err) {
    writeErr(`error: ${err && err.message ? err.message : String(err)}\n`);
    return err && typeof err.exitCode === "number" ? err.exitCode : EXIT.SOFTWARE;
  }
  if (parsed.json) writeLn(JSON.stringify(results));
  else writeLn(renderGenerateSummary(results));
  const anyErr = results.some((r) => r.status === "error");
  return anyErr ? EXIT.IOERR : EXIT.OK;
}

function run(argv, ctx) { return runWithDeps(argv, ctx, {}); }

module.exports = {
  EXIT,
  SUBCOMMANDS,
  VALUE_FLAGS,
  BOOL_FLAGS,
  DEFAULT_OUT_DIR,
  DOCS_ENTRIES,
  ENTRY_SLUGS,
  COMMON_GLOBAL_OPTIONS,
  COMMON_EXIT_CODES,
  DocsError,
  parseDocsArgs,
  buildHelp,
  findDocsEntry,
  buildDocsPath,
  yamlEscape,
  escapeMdCell,
  renderDocsEntry,
  buildGenerationPlan,
  executeGenerationPlan,
  renderList,
  buildListJson,
  renderGenerateSummary,
  runWithDeps,
  run,
};
