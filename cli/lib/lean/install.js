// @ts-check
/**
 * [Z8.1] `frootai install <id> --lean` — fetch a primitive's committed,
 * fidelity-verified Lean (`.lean.md`) variant and write it to disk.
 *
 * Source of truth: the committed `.lean.md` files in the FrootAI repo, served
 * over GitHub raw — the SAME canonical source the website catalog and the MCP
 * `fai_lean` tool use. A Lean variant exists in the repo ONLY if it cleared the
 * FAI fidelity gate (guardrails, parameters, and code blocks preserved exactly)
 * AND saved tokens, so a fetched body is fidelity-verified by construction. The
 * CLI does not recompute — or fabricate — a per-call score.
 *
 * Honesty: `install` is otherwise guidance-only in v6 (the v5 installer was
 * removed), but the Lean variant is a concrete artifact, so `--lean` does a
 * real fetch-and-write. The fetcher is injectable so the resolver and writer
 * are unit-testable without a network.
 */
"use strict";

const fsP = require("node:fs/promises");
const path = require("node:path");

/** GitHub raw base for the committed primitives (matches the website catalog). */
const LEAN_RAW_BASE = "https://raw.githubusercontent.com/FrootAI/frootai/main";

/**
 * Resolve a primitive `id` to its committed `.lean.md` repo path.
 * - An explicit path ending in `.lean.md` is used verbatim (any primitive type).
 * - A bare id maps to `skills/<id>/SKILL.lean.md` (the [Z2] baseline).
 * @param {string} id
 * @returns {string}
 */
function resolveLeanPath(id) {
  const trimmed = String(id || "").trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) throw new Error("a primitive id (or .lean.md path) is required");
  if (trimmed.endsWith(".lean.md")) return trimmed;
  return `skills/${trimmed}/SKILL.lean.md`;
}

/**
 * @typedef {{ ok: boolean, status: number, text: string }} FetchTextResult
 * @typedef {(url: string) => Promise<FetchTextResult>} FetchText
 */

/** @type {FetchText} */
const defaultFetchText = async (url) => {
  const res = await fetch(url);
  const text = res.ok ? await res.text() : "";
  return { ok: res.ok, status: res.status, text };
};

/**
 * Fetch a primitive's Lean variant and write it locally.
 * @param {{ id: string, destDir?: string, fetchText?: FetchText, flat?: boolean }} opts
 */
async function installLean(opts) {
  const { id, destDir = process.cwd(), fetchText = defaultFetchText, flat = false } = opts || {};
  const leanPath = resolveLeanPath(id);
  const url = `${LEAN_RAW_BASE}/${leanPath}`;
  const res = await fetchText(url);
  if (!res || !res.ok) {
    return {
      ok: false,
      status: res ? res.status : 0,
      leanPath,
      url,
      error: `Lean variant not found (HTTP ${res ? res.status : "no response"})`,
    };
  }
  const body = res.text;
  // `flat` writes just the basename into destDir; otherwise mirror the repo path.
  const rel = flat ? path.basename(leanPath) : leanPath;
  const dest = path.join(destDir, rel);
  await fsP.mkdir(path.dirname(dest), { recursive: true });
  await fsP.writeFile(dest, body, "utf8");
  return {
    ok: true,
    status: res.status,
    leanPath,
    url,
    dest,
    bytes: Buffer.byteLength(body, "utf8"),
  };
}

module.exports = { LEAN_RAW_BASE, resolveLeanPath, installLean, defaultFetchText };
