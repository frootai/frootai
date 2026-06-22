/**
 * [Z0.6] Lean Compiler — Stage 3c: TABLE / LIST compressor.
 *
 * Structure-preserving whitespace + duplicate compression for the two
 * remaining COMPRESSIBLE block shapes that PROSE rewriting must not touch:
 *
 *   TABLE  — markdown pipe tables. Aligned padding (`| foo      | bar |`) is
 *            collapsed to single-space cells (`| foo | bar |`); the separator
 *            row's dash runs are minimised (`|--------|` → `| --- |`) while
 *            keeping alignment colons; byte-identical body rows are deduped
 *            (first kept, order preserved). Cell CONTENT is never altered —
 *            only the surrounding padding.
 *   LIST   — bullet / ordered lists. Internal multi-space runs collapse to a
 *            single space, trailing whitespace is trimmed, and adjacent
 *            byte-identical items are deduped. Leading indentation (nesting)
 *            is preserved exactly so list structure survives.
 *
 * Safety by construction (same contract as the other Stage-3 compressors):
 *   - inline code (`…`) and links are protected so pipes/spaces inside them
 *     are never mis-split or collapsed;
 *   - only blocks classified PROSE reach here — a table/list carrying a
 *     behaviour signal (IMPERATIVE/TRIGGER/PARAM/GUARDRAIL) is preserved
 *     verbatim by segmentation and never compressed;
 *   - both functions are MONOTONE (output length ≤ input) and idempotent.
 */

const PH = "\u0000"; // placeholder sentinel for protected spans

/**
 * Split a markdown table row into trimmed cells, honouring `\|` escapes and
 * pipes inside `` `code` `` spans. Outer (leading/trailing) pipe artefacts are
 * dropped; genuinely-empty interior cells are kept.
 * @param {string} body - the row text WITHOUT its leading indentation
 * @returns {string[]} trimmed cell contents
 */
function splitRow(body) {
  const cells = [];
  let cur = "";
  let inCode = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\" && i + 1 < body.length) {
      cur += ch + body[i + 1];
      i++;
      continue;
    }
    if (ch === "`") {
      inCode = !inCode;
      cur += ch;
      continue;
    }
    if (ch === "|" && !inCode) {
      cells.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  // Drop the empty edge cells produced by a leading / trailing outer pipe.
  if (cells.length > 1 && cells[0].trim() === "") cells.shift();
  if (cells.length > 1 && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.map((c) => c.trim());
}

/** True if every cell is a table separator token (e.g. `:---`, `---`, `--:`). */
function isSeparatorCells(cells) {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/** Minimise a separator cell to 3 dashes while keeping alignment colons. */
function minSeparator(cell) {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  return (left ? ":" : "") + "---" + (right ? ":" : "");
}

/**
 * Compress a markdown TABLE block.
 * @param {string} raw
 * @returns {string}
 */
function compressTable(raw) {
  if (!raw) return raw;
  const lines = raw.split("\n");
  const out = [];
  const seenBody = new Set();
  let sawSeparator = false;

  for (const line of lines) {
    const indent = line.match(/^(\s*)/)[0];
    const body = line.slice(indent.length);
    // A non-pipe line inside a table block (rare): pass through untouched.
    if (!body.includes("|")) {
      out.push(line);
      continue;
    }
    const cells = splitRow(body);

    if (isSeparatorCells(cells)) {
      sawSeparator = true;
      out.push(indent + "| " + cells.map(minSeparator).join(" | ") + " |");
      continue;
    }

    const rebuilt = indent + "| " + cells.join(" | ") + " |";

    // Dedupe byte-identical BODY rows only (never header/separator).
    if (sawSeparator) {
      if (seenBody.has(rebuilt)) continue;
      seenBody.add(rebuilt);
    }
    out.push(rebuilt);
  }

  const result = out.join("\n");
  return result.length <= raw.length ? result : raw;
}

/**
 * Compress a markdown LIST block.
 * @param {string} raw
 * @returns {string}
 */
function compressList(raw) {
  if (!raw) return raw;
  const lines = raw.split("\n");
  const out = [];
  let prev = null;

  for (const line of lines) {
    const indent = line.match(/^(\s*)/)[0];
    let rest = line.slice(indent.length);

    // Protect inline code + links, collapse interior space runs, restore.
    const spans = [];
    rest = rest.replace(/`[^`]*`|\[[^\]]*\]\([^)]*\)/g, (m) => {
      spans.push(m);
      return PH + (spans.length - 1) + PH;
    });
    rest = rest.replace(/[ \t]{2,}/g, " ");
    rest = rest.replace(new RegExp(PH + "(\\d+)" + PH, "g"), (_, i) => spans[Number(i)]);

    const normalized = (indent + rest).replace(/[ \t]+$/, "");

    // Dedupe adjacent byte-identical non-blank items.
    if (normalized === prev && normalized.trim() !== "") continue;
    out.push(normalized);
    prev = normalized;
  }

  const result = out.join("\n");
  return result.length <= raw.length ? result : raw;
}

export { compressTable, compressList, splitRow };
