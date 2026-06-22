/**
 * [Z0.5] Lean Compiler — Stage 3b: EXAMPLE / code compressor.
 *
 * Compresses fenced code blocks SAFELY. Code is behaviour-bearing, so we never
 * alter semantics:
 *   - leading indentation is preserved verbatim (Python/YAML stay valid);
 *   - no non-blank line is removed, reordered, or rewritten;
 *   - only safe whitespace is reclaimed — collapse blank-line runs to a single
 *     blank, trim trailing whitespace, drop blank lines hugging the fences.
 *
 * It also folds EXACT-duplicate examples: the first occurrence is kept, later
 * byte-identical blocks become a one-line reference ("keep signature + 1
 * example, fold duplicates").
 */

/**
 * Compress a single fenced code block (whitespace-only, semantics-preserving).
 * @param {string} raw - the full fence incl. opening/closing markers.
 * @returns {string}
 */
function compressExample(raw) {
  const lines = raw.split("\n");
  if (lines.length < 3) return raw; // open + ≥1 content + close, else nothing to do

  const open = lines[0];
  const close = lines[lines.length - 1];
  const content = lines.slice(1, -1).map((l) => l.replace(/[ \t]+$/g, "")); // trim trailing ws

  // Collapse runs of blank lines to a single blank.
  const out = [];
  let prevBlank = false;
  for (const l of content) {
    const blank = l.trim() === "";
    if (blank && prevBlank) continue;
    out.push(l);
    prevBlank = blank;
  }
  // Drop blank lines hugging the fences.
  while (out.length && out[0].trim() === "") out.shift();
  while (out.length && out[out.length - 1].trim() === "") out.pop();

  const result = [open, ...out, close].join("\n");
  return result.length <= raw.length ? result : raw;
}

/**
 * Fold exact-duplicate EXAMPLE blocks. Run AFTER `compressExample`, so the
 * comparison is on the already-compressed content.
 * @param {Array<{type:string, raw:string, role:string}>} blocks
 * @returns {Array}
 */
function foldDuplicateExamples(blocks) {
  const seen = new Set();
  return blocks.map((b) => {
    if (b.role !== "EXAMPLE") return b;
    if (seen.has(b.raw)) {
      const lang = (b.raw.match(/^(```+|~~~+)(\w*)/) || [, "```", ""])[2];
      const ref = "```" + lang + "\n// (identical to the example above)\n```";
      return ref.length < b.raw.length ? { ...b, raw: ref } : b;
    }
    seen.add(b.raw);
    return b;
  });
}

export { compressExample, foldDuplicateExamples };
