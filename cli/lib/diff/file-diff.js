// @ts-check
/**
 * A4.19 — Pure unified-diff algorithm.
 *
 * Pure line-based diff between two strings. Outputs a hunk list compatible with
 * the unified-diff format (`@@ -aStart,aLen +bStart,bLen @@` + ` ` / `-` / `+`).
 *
 * Algorithm: classic LCS via dynamic programming, then walk to emit hunks.
 *   - O(n*m) time + space. Fine for files capped at 256 KiB (A4.16 recipe cap).
 *   - For larger inputs we'd want Myers' O(ND), but Play recipe files are small.
 *
 * Determinism: same input → same hunks every time (no random tie-breaking).
 *
 * The output is a structured tree (not raw text) — render.js handles ANSI + colors.
 *
 * Zero dependencies. All pure functions.
 */
"use strict";

const { OrchardCliError } = require("../orchard/cli-error");

const DEFAULT_CONTEXT_LINES = 3;
const MAX_DIFF_LINES = 50_000; // sanity cap — anything bigger is "this file is too different to bother"

/** Pure: split text into lines, preserving trailing-newline semantics. */
function splitLines(text) {
  if (text === null || text === undefined) return [];
  const s = String(text);
  if (s.length === 0) return [];
  // Split on \n keeping the line content (without the \n). If the file ends with \n,
  // there will be a trailing empty string — drop it. The "missing final newline"
  // is a special diff marker we don't surface in v1.
  const lines = s.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/**
 * Pure: compute the LCS length table between two arrays.
 * Returns a (a.length+1) × (b.length+1) DP grid where dp[i][j] = LCS length
 * of a[0..i) and b[0..j).
 */
function lcsTable(a, b) {
  const n = a.length;
  const m = b.length;
  // Use flat typed array if either dimension is large (saves memory + GC).
  const useFlat = n > 200 || m > 200;
  /** @type {any} */
  let dp;
  if (useFlat) {
    dp = new Uint32Array((n + 1) * (m + 1));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const idx = i * (m + 1) + j;
        if (a[i] === b[j]) {
          dp[idx + (m + 1) + 1] = dp[idx] + 1;
        } else {
          const up = dp[(i + 1) * (m + 1) + j];
          const left = dp[i * (m + 1) + (j + 1)];
          dp[(i + 1) * (m + 1) + (j + 1)] = up >= left ? up : left;
        }
      }
    }
    return { dp, flat: true, width: m + 1 };
  }
  dp = [];
  for (let i = 0; i <= n; i++) {
    const row = new Array(m + 1).fill(0);
    dp.push(row);
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (a[i] === b[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i][j + 1], dp[i + 1][j]);
      }
    }
  }
  return { dp, flat: false };
}

function _dpGet(table, i, j) {
  if (table.flat) return table.dp[i * table.width + j];
  return table.dp[i][j];
}

/**
 * Pure: backtrack LCS table to produce edit ops:
 *   - { op: "equal",  a: text, b: text }
 *   - { op: "delete", a: text }
 *   - { op: "insert", b: text }
 *
 * Walks from (a.length, b.length) → (0, 0), then reverses.
 */
function computeEditScript(a, b) {
  const table = lcsTable(a, b);
  const ops = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ op: "equal", a: a[i - 1], b: b[j - 1] });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || _dpGet(table, i, j - 1) >= _dpGet(table, i - 1, j))) {
      ops.push({ op: "insert", b: b[j - 1] });
      j -= 1;
    } else if (i > 0) {
      ops.push({ op: "delete", a: a[i - 1] });
      i -= 1;
    } else {
      // Defensive: shouldn't reach here.
      break;
    }
    if (ops.length > MAX_DIFF_LINES) {
      throw new OrchardCliError("diff_too_large",
        `diff exceeded ${MAX_DIFF_LINES} edit ops — file too different to diff meaningfully`,
        { ops: ops.length });
    }
  }
  ops.reverse();
  return ops;
}

/**
 * Pure: group edit ops into hunks of unified-diff with `context` lines of
 * surrounding context. Returns array of hunks: { aStart, aLen, bStart, bLen, lines }.
 *
 * `lines` is the sequence of in-hunk lines, each being:
 *   { tag: " " | "-" | "+", text }
 *
 * The hunk header coordinates are 1-indexed line numbers (matches standard
 * unified-diff convention).
 */
function buildHunks(ops, opts) {
  const o = opts || {};
  const context = typeof o.context === "number" && o.context >= 0 ? o.context : DEFAULT_CONTEXT_LINES;

  const hunks = [];
  // Walk ops with a running index into a + b for line numbers.
  let aIdx = 0; // 0-based
  let bIdx = 0;

  // Precompute per-op (aIdx, bIdx) at op start (for hunk header bookkeeping).
  const annotated = [];
  for (const op of ops) {
    const entry = { ...op, aIdx, bIdx };
    annotated.push(entry);
    if (op.op === "equal") { aIdx += 1; bIdx += 1; }
    else if (op.op === "delete") { aIdx += 1; }
    else if (op.op === "insert") { bIdx += 1; }
  }

  // Find change clusters and expand by `context`.
  const N = annotated.length;
  let i = 0;
  while (i < N) {
    // Skip leading equal ops until we find a change.
    while (i < N && annotated[i].op === "equal") i += 1;
    if (i >= N) break;

    // Hunk starts. Walk back up to `context` equal ops for leading context.
    let hunkStart = i;
    let leadingContext = 0;
    while (hunkStart > 0 && annotated[hunkStart - 1].op === "equal" && leadingContext < context) {
      hunkStart -= 1;
      leadingContext += 1;
    }

    // Walk forward to find end of change cluster, including up to `context` trailing equals.
    let j = i;
    let trailingEquals = 0;
    let lastChange = j;
    while (j < N) {
      if (annotated[j].op !== "equal") {
        lastChange = j;
        trailingEquals = 0;
      } else {
        trailingEquals += 1;
        // If we've accumulated 2*context equals AND there's another change, that's
        // the boundary between this hunk and the next hunk.
        if (trailingEquals > 2 * context) break;
      }
      j += 1;
    }
    // Hunk end = min(lastChange + context + 1, N).
    const hunkEnd = Math.min(lastChange + context + 1, N);

    // Build hunk lines.
    const hunkOps = annotated.slice(hunkStart, hunkEnd);
    const aStart0 = hunkOps[0].aIdx;
    const bStart0 = hunkOps[0].bIdx;
    let aLen = 0, bLen = 0;
    const lines = [];
    for (const op of hunkOps) {
      if (op.op === "equal") {
        lines.push({ tag: " ", text: op.a });
        aLen += 1; bLen += 1;
      } else if (op.op === "delete") {
        lines.push({ tag: "-", text: op.a });
        aLen += 1;
      } else if (op.op === "insert") {
        lines.push({ tag: "+", text: op.b });
        bLen += 1;
      }
    }

    // 1-indexed in unified diff. Empty file → 0; non-empty → 1+aStart0.
    const aStart = aLen > 0 ? aStart0 + 1 : 0;
    const bStart = bLen > 0 ? bStart0 + 1 : 0;
    hunks.push({ aStart, aLen, bStart, bLen, lines });

    i = hunkEnd;
  }
  return hunks;
}

/**
 * High-level: diff two string blobs. Returns hunks + summary counts.
 *
 * @param {string} aText
 * @param {string} bText
 * @param {object} [opts]
 * @param {number} [opts.context]   lines of context (default 3)
 * @returns {{
 *   hunks: Array<object>,
 *   added: number,
 *   removed: number,
 *   unchanged: number,
 *   identical: boolean,
 * }}
 */
function diffStrings(aText, bText, opts) {
  if (aText === bText) {
    return { hunks: [], added: 0, removed: 0, unchanged: splitLines(aText).length, identical: true };
  }
  const a = splitLines(aText);
  const b = splitLines(bText);
  const ops = computeEditScript(a, b);
  let added = 0, removed = 0, unchanged = 0;
  for (const op of ops) {
    if (op.op === "insert") added += 1;
    else if (op.op === "delete") removed += 1;
    else unchanged += 1;
  }
  const hunks = buildHunks(ops, opts);
  return { hunks, added, removed, unchanged, identical: false };
}

/**
 * Render a hunk list to plain unified-diff text (NO color). Pure.
 * Each hunk is preceded by its `@@` header.
 */
function renderHunksPlain(hunks) {
  if (!Array.isArray(hunks)) return "";
  const out = [];
  for (const h of hunks) {
    out.push(`@@ -${h.aStart},${h.aLen} +${h.bStart},${h.bLen} @@`);
    for (const line of h.lines) {
      out.push(`${line.tag}${line.text}`);
    }
  }
  return out.join("\n");
}

module.exports = {
  DEFAULT_CONTEXT_LINES,
  MAX_DIFF_LINES,
  splitLines,
  lcsTable,
  computeEditScript,
  buildHunks,
  diffStrings,
  renderHunksPlain,
};
