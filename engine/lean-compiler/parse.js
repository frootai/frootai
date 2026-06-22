/**
 * [Z0.2] Lean Compiler — Stage 1: Parse.
 *
 * Splits a Full markdown primitive into:
 *   - `frontmatter` : the leading `---\n…\n---` block (raw + parsed key/value fields)
 *   - `blocks`      : an ordered block AST of the body (heading / fence / table /
 *                     list / blockquote / paragraph / blank)
 *
 * CONTRACT — round-trip fidelity (non-negotiable):
 *   reassemble(parse(md)) === md.replace(/\r\n/g, "\n")
 * i.e. parsing then re-joining reproduces the source byte-for-byte (after CRLF
 * normalisation). Every downstream stage operates on `blocks`; the emit stage
 * ([Z0.9]) reassembles them — so this invariant is what keeps the compiler safe.
 *
 * Code fences are treated as ONE opaque block (their inner lines are never
 * re-interpreted), so `###` or `|` inside a code sample can't corrupt the AST.
 */

/** Parse the `key: value` lines of a frontmatter block (lenient, single-line). */
function parseFrontmatterFields(raw) {
  const fields = {};
  const inner = raw.replace(/^---\n/, "").replace(/\n---\n?$/, "");
  for (const line of inner.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m && !(m[1] in fields)) {
      fields[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return fields;
}

/**
 * @param {string} md
 * @returns {{ frontmatter: { raw: string, fields: Record<string,string> }, blocks: Array<{type:string, raw:string, depth?:number}> }}
 */
function parse(md) {
  const text = String(md).replace(/\r\n/g, "\n");

  // ── Frontmatter ──────────────────────────────────────────────
  let frontmatter = { raw: "", fields: {} };
  let body = text;
  const fm = text.match(/^(---\n[\s\S]*?\n---\n?)/);
  if (fm) {
    frontmatter = { raw: fm[1], fields: parseFrontmatterFields(fm[1]) };
    body = text.slice(fm[1].length);
  }

  // ── Body blocks ──────────────────────────────────────────────
  const lines = body.split("\n");
  const blocks = [];
  const isStructural = (l) =>
    /^#{1,6}\s/.test(l) ||
    /^\s*(```|~~~)/.test(l) ||
    /^\s*([-*+]|\d+\.)\s/.test(l) ||
    /^\s*>/.test(l);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block — opaque, consumes through the closing fence.
    const fenceM = line.match(/^\s*(```+|~~~+)/);
    if (fenceM) {
      const marker = fenceM[1][0]; // ` or ~
      const start = i;
      i++;
      // A CLOSING fence (per CommonMark) is the same marker with NO info string
      // — only trailing whitespace allowed. So `​```python` is an OPENER, never a
      // close; without the `\s*$` anchor the parser would wrongly close an outer
      // ```markdown block at a nested ```lang opener and reflow real code as prose.
      const closeRe = new RegExp("^\\s*" + (marker === "`" ? "```+" : "~~~+") + "\\s*$");
      while (i < lines.length && !closeRe.test(lines[i])) i++;
      if (i < lines.length) i++; // include the closing fence line
      blocks.push({ type: "fence", raw: lines.slice(start, i).join("\n") });
      continue;
    }

    // Blank run.
    if (line.trim() === "") {
      const start = i;
      while (i < lines.length && lines[i].trim() === "") i++;
      blocks.push({ type: "blank", raw: lines.slice(start, i).join("\n") });
      continue;
    }

    // Heading (single line).
    if (/^#{1,6}\s/.test(line)) {
      blocks.push({ type: "heading", raw: line, depth: line.match(/^#+/)[0].length });
      i++;
      continue;
    }

    // Table — a `|` row immediately followed by a separator row.
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|/.test(lines[i + 1])) {
      const start = i;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") i++;
      blocks.push({ type: "table", raw: lines.slice(start, i).join("\n") });
      continue;
    }

    // List — item lines plus their indented continuation lines.
    if (/^\s*([-*+]|\d+\.)\s/.test(line)) {
      const start = i;
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        (/^\s*([-*+]|\d+\.)\s/.test(lines[i]) || /^\s+\S/.test(lines[i]))
      ) i++;
      blocks.push({ type: "list", raw: lines.slice(start, i).join("\n") });
      continue;
    }

    // Blockquote.
    if (/^\s*>/.test(line)) {
      const start = i;
      while (i < lines.length && /^\s*>/.test(lines[i])) i++;
      blocks.push({ type: "blockquote", raw: lines.slice(start, i).join("\n") });
      continue;
    }

    // Paragraph — prose lines until a blank or structural line.
    const start = i;
    while (i < lines.length && lines[i].trim() !== "" && !isStructural(lines[i])) i++;
    blocks.push({ type: "paragraph", raw: lines.slice(start, i).join("\n") });
  }

  return { frontmatter, blocks };
}

/**
 * Reassemble a parsed primitive back into markdown. Inverse of `parse` — the
 * round-trip invariant is `reassemble(parse(md)) === md.replace(/\r\n/g,"\n")`.
 * @param {{ frontmatter: { raw: string }, blocks: Array<{raw:string}> }} parsed
 * @returns {string}
 */
function reassemble(parsed) {
  return (parsed.frontmatter?.raw || "") + parsed.blocks.map((b) => b.raw).join("\n");
}

export { parse, reassemble, parseFrontmatterFields };
