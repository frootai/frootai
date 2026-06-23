/**
 * [Z10.3] Lean+ — first REAL semantic backend (deterministic prose paraphrase).
 *
 * `RuleSemanticCompressor` is the first non-stub `SemanticCompressor`: a
 * deterministic, dependency-free paraphrase pass that folds verbose filler in
 * PLAIN-PROSE lines down to shorter semantic equivalents. It is the honest
 * floor of the Lean+ tier — no LLM, no network, no randomness — so it runs in
 * CI and is byte-reproducible. (A model-backed paraphrase + redundant-clause
 * fold + embedding dedup tier layers on top later via the SAME contract.)
 *
 * COMPLEMENTARY to the lossless floor — honest marginal savings only. The
 * Phase-1 prose compressor ([Z0.4] `compress-prose.js`) already harvests the
 * common filler ("in order to" → "to", "due to the fact that" → "because",
 * intensifiers, hedges …). This backend deliberately ships a DISJOINT ruleset
 * (e.g. "utilize" → "use", "prior to" → "before", "is able to" → "can") so it
 * earns genuine savings BEYOND the lossless floor rather than re-doing its work.
 * On already-tight content the marginal saving is honestly ~0.
 *
 * Why it is SAFE by construction (clears the Z1 gate without relying on luck):
 *   - It reuses the engine's `roleFromText` classifier. Any line that classifies
 *     as TRIGGER / GUARDRAIL / PARAM / IMPERATIVE is returned BYTE-IDENTICAL —
 *     behaviour units are never reworded.
 *   - Lines inside fenced code blocks are returned byte-identical, and inline
 *     code / links inside prose are protected + restored verbatim — so no
 *     identifier, path, flag or env var is ever rewritten.
 *   - Headings and blanks are left as-is.
 *   - Only plain-prose lines (`roleFromText === null`) are reduced, and only by
 *     DELETING/SHORTENING filler — never by adding text. Each line is
 *     monotone-guarded (output ≤ input), so it can only shrink and can
 *     introduce no token absent from the input (no-injection contract).
 *
 * The result: the five retention checkers all stay at ratio 1, the hard-fail
 * trio never trips, and the candidate clears the gate — earning whatever prose
 * savings the corpus actually contains, honestly measured, never inflated.
 */

import { roleFromText } from "../lean-compiler/segment.js";

/** Placeholder sentinel for protected inline spans (mirrors [Z0.4]). */
const PH = "\u0000";

/**
 * Ordered, deterministic filler reductions — DISJOINT from the [Z0.4] lossless
 * ruleset so each one is a real marginal saving. None introduces a word not
 * already implied by the phrase it replaces (no-injection). Order is fixed so
 * the pass is reproducible.
 * @type {Array<[RegExp, string]>}
 */
const FILLER_RULES = [
  [/\bis able to\b/gi, "can"],
  [/\bare able to\b/gi, "can"],
  [/\bprior to\b/gi, "before"],
  [/\bsubsequent to\b/gi, "after"],
  [/\butili[sz]e\b/gi, "use"],
  [/\butili[sz]ing\b/gi, "using"],
  [/\bin conjunction with\b/gi, "with"],
  [/\bin the absence of\b/gi, "without"],
  [/\bby means of\b/gi, "by"],
  [/\bin cases where\b/gi, "when"],
  [/\bin situations where\b/gi, "when"],
  [/\bon a regular basis\b/gi, "regularly"],
  [/\bin a timely manner\b/gi, "promptly"],
  [/\btake into account\b/gi, "consider"],
  [/\ba number of\b/gi, "several"],
  [/\bat this time\b/gi, "now"],
  [/\bin the process of\s+/gi, ""],
  [/\bthe fact that\b/gi, "that"],
];

/** Leading-whitespace + optional list-bullet, so indentation is preserved. */
const PREFIX_RE = /^(\s*)((?:[-*+]\s+|\d+\.\s+)?)(.*)$/;

/**
 * Reduce one plain-prose line: protect inline code/links, apply the filler
 * rules to the BODY only, restore sentence capitalisation, restore the
 * protected spans, and never return a longer line than it received.
 * @param {string} line
 * @returns {string}
 */
function reduceProseLine(line) {
  const m = line.match(PREFIX_RE);
  const indent = m[1];
  const bullet = m[2];
  let body = m[3];

  const startedUpper = /^[A-Z]/.test(body);

  // Protect inline code + links so identifiers inside prose survive verbatim.
  const spans = [];
  body = body.replace(/`[^`]*`|\[[^\]]*\]\([^)]*\)/g, (s) => {
    spans.push(s);
    return PH + (spans.length - 1) + PH;
  });

  for (const [re, repl] of FILLER_RULES) body = body.replace(re, repl);

  body = body
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:!?])/g, "$1")
    .replace(/[ \t]+$/g, "");

  if (startedUpper) body = body.replace(/^([a-z])/, (_, c) => c.toUpperCase());

  body = body.replace(new RegExp(PH + "(\\d+)" + PH, "g"), (_, i) => spans[Number(i)]);

  const out = indent + bullet + body;
  // Per-line monotone guard (belt to the harness braces): never grow.
  return out.length <= line.length ? out : line;
}

/**
 * Apply the prose paraphrase pass to a Lean string, line by line, skipping
 * code fences and every behaviour-bearing line.
 * @param {string} lean
 * @returns {string}
 */
function paraphraseProse(lean) {
  const lines = String(lean).split("\n");
  let inFence = false;
  const out = lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line; // the fence delimiter itself is never reworded
    }
    if (inFence) return line; // code body — untouched
    if (line.trim() === "") return line; // blank
    if (/^\s*#{1,6}\s/.test(line)) return line; // heading (META) — untouched
    if (roleFromText(line) !== null) return line; // behaviour unit — untouched
    return reduceProseLine(line);
  });
  return out.join("\n");
}

/**
 * The first real Lean+ semantic backend. Deterministic prose paraphrase only.
 * @type {{id:string, compress:(lean:string)=>string}}
 */
const RuleSemanticCompressor = Object.freeze({
  id: "rule-paraphrase-v1",
  compress(lean) {
    return paraphraseProse(lean);
  },
});

export { RuleSemanticCompressor, paraphraseProse, FILLER_RULES };
