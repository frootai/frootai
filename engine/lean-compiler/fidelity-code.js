/**
 * [Z1.5] Fidelity Gate — Code-signature byte-identity checker.
 *
 * Fifth and last retention class (see [Z1.1] for the gate's rationale). Code is
 * pure behaviour: a single changed character can flip a command, a flag, or a
 * security default. So unlike the prose-bearing classes, code is checked for
 * BYTE-IDENTITY, not mere presence.
 *
 * "Byte-identity" is defined against what the [Z0.5] EXAMPLE compressor is
 * ALLOWED to do — reclaim whitespace only (trim trailing spaces, collapse blank
 * runs, drop blanks hugging the fences) and fold an EXACT-duplicate block to a
 * one-line reference. Non-blank code lines are never reworded, reordered, or
 * removed. We therefore reduce each fenced block to its CODE SIGNATURE — the
 * non-blank lines, trailing-trimmed, in order — and require every DISTINCT
 * signature in Full to appear, byte-for-byte, among Lean's signatures. A
 * compressor that mutates even one code line changes the signature and fails.
 *
 * Duplicate handling: signatures are a Set, so Full's two identical blocks
 * dedupe to one wanted signature; Lean keeping the first copy (and folding the
 * second to a reference comment) still satisfies it.
 */

/**
 * Split text into fenced code blocks, returning each block's CONTENT lines
 * (between the opening and closing fence, exclusive). Handles ``` and ~~~
 * fences of length ≥3, with optional indentation and language tag.
 * @param {string} text
 * @returns {string[][]} one array of content lines per fence
 */
function extractFences(text) {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const fences = [];
  let i = 0;
  while (i < lines.length) {
    const open = lines[i].match(/^(\s*)(`{3,}|~{3,})/);
    if (open) {
      const marker = open[2][0];
      const len = open[2].length;
      let j = i + 1;
      while (j < lines.length) {
        const close = lines[j].match(/^\s*(`{3,}|~{3,})\s*$/);
        if (close && close[1][0] === marker && close[1].length >= len) break;
        j += 1;
      }
      fences.push(lines.slice(i + 1, j));
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return fences;
}

/**
 * Reduce a fence's content lines to its code signature: trailing-trim each
 * line, drop blank lines, join with "\n". Whitespace (never behaviour) is
 * normalized away; every non-blank code byte is kept.
 * @param {string[]} content
 * @returns {string}
 */
function codeSignature(content) {
  return content
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .filter((l) => l.trim() !== "")
    .join("\n");
}

/**
 * Extract the DISTINCT code signatures from a document.
 * @param {string} text
 * @returns {Set<string>}
 */
function extractCodeSignatures(text) {
  const sigs = new Set();
  for (const content of extractFences(text)) {
    const sig = codeSignature(content);
    if (sig) sigs.add(sig);
  }
  return sigs;
}

/**
 * Check that every distinct code block in Full survives byte-identically in Lean.
 *
 * @param {string} full  the Full (readable) source
 * @param {string} lean  the Lean (compressed) candidate
 * @returns {{kind:"code", total:number, retained:number, missing:string[], ratio:number}}
 */
function checkCodeIdentity(full, lean) {
  const wanted = extractCodeSignatures(full);
  const present = extractCodeSignatures(lean);
  const missing = [];
  let retained = 0;

  for (const sig of wanted) {
    if (present.has(sig)) retained += 1;
    else missing.push(sig);
  }

  const total = wanted.size;
  return {
    kind: "code",
    total,
    retained,
    missing,
    ratio: total === 0 ? 1 : retained / total,
  };
}

export { checkCodeIdentity, extractCodeSignatures, extractFences, codeSignature };
