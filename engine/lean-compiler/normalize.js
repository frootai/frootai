/**
 * [Z0.8] Lean Compiler — Stage 4: Normalize.
 *
 * Document-level tidy that runs AFTER per-block compression ([Z0.4]-[Z0.6]) and
 * BEFORE the behaviour-preserve guard / emit. This is where the inter-block
 * whitespace — by far the most common slack in real primitives — is reclaimed:
 *
 *   - BLANK runs  → collapse any multi-blank-line gap to a single blank line
 *                   (N blank lines render identically to 1 in markdown).
 *   - HEADINGS    → trim trailing whitespace + ATX closing `#`s, collapse inner
 *                   double-spaces (`##   Title  ##` → `## Title`).
 *   - LINKS       → collapse redundant `[url](url)` to the shorter `<url>`
 *                   autolink when the visible text equals the href.
 *
 * Safety by construction:
 *   - behaviour-bearing blocks (IMPERATIVE/TRIGGER/PARAM/GUARDRAIL, i.e.
 *     `preserved: true`) are NEVER touched — the [Z0.7] guard runs right after
 *     and would hard-fail otherwise;
 *   - link shortening protects inline code and only fires when the label and
 *     href are byte-identical, so no destination ever changes;
 *   - every transform is monotone (output length ≤ input) and idempotent.
 */

const PH = "\u0000"; // placeholder sentinel for protected spans

/** `##   Title  ###` → `## Title` (trailing ATX `#`s must be space-preceded). */
function normalizeHeading(raw) {
  const m = raw.match(/^(\s*)(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/);
  if (!m) return raw;
  const [, indent, hashes, text] = m;
  const cleaned = text.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/, "");
  const result = indent + hashes + " " + cleaned;
  return result.length <= raw.length ? result : raw;
}

/** Collapse `[url](url)` (label === href) to the shorter `<url>` autolink. */
function shortenLinks(text) {
  if (!text) return text;
  const spans = [];
  let t = text.replace(/`[^`]*`/g, (m) => {
    spans.push(m);
    return PH + (spans.length - 1) + PH;
  });
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) =>
    label === href ? `<${href}>` : m,
  );
  t = t.replace(new RegExp(PH + "(\\d+)" + PH, "g"), (_, i) => spans[Number(i)]);
  return t.length <= text.length ? t : text;
}

/**
 * Stage 4 — normalize whitespace / headings / links across the block AST.
 * @param {Array<{type:string, raw:string, role?:string, preserved?:boolean}>} blocks
 * @returns {Array} the normalized blocks (new objects; inputs untouched)
 */
function normalize(blocks) {
  return blocks.map((b) => {
    if (b.type === "blank") return { ...b, raw: "" }; // collapse multi-blank → single
    if (b.type === "heading") return { ...b, raw: normalizeHeading(b.raw) };
    if (b.preserved) return b; // behaviour-bearing — leave verbatim for the guard
    return { ...b, raw: shortenLinks(b.raw) };
  });
}

export { normalize, normalizeHeading, shortenLinks };
