/**
 * [ZF.1] Lean Compiler — exact tokenizer (o200k_base).
 *
 * Wraps `gpt-tokenizer`'s o200k_base BPE encoder (the tokenizer GPT-4o / 4.1 /
 * o-series use) behind a synchronous, dependency-resilient surface. This is the
 * single source of truth for "how many tokens is this text" across the engine
 * and the build-time catalog generators — replacing the historical `chars / 4`
 * estimate so every published savings number is provable against a real model
 * tokenizer.
 *
 * Why `createRequire`: `gpt-tokenizer` ships CommonJS, so a synchronous
 * `require()` (via `createRequire`) lets `countTokens()` stay SYNC at every call
 * site — no async init, no top-level await. If the package is somehow absent
 * (e.g. a stripped-down checkout), `isExact()` reports false and callers fall
 * back to the estimate, so the engine never hard-crashes on a missing optional.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** The model tokenizer basis this module encodes against. */
const ENCODING = "o200k_base";

// Treat any literal special-token sequence (e.g. a chat-template `<|im_start|>`
// shown inside a primitive) as ORDINARY TEXT rather than throwing — matches how
// a model API counts user content. Reused frozen object; encode never mutates it.
const ENCODE_OPTS = { disallowedSpecial: new Set() };

let _encode = null;
let _exact = false;
try {
  // eslint-disable-next-line global-require
  const o200k = require("gpt-tokenizer/encoding/o200k_base");
  if (o200k && typeof o200k.encode === "function") {
    _encode = o200k.encode;
    _exact = true;
  }
} catch {
  _exact = false;
}

/** @returns {boolean} true when the exact o200k_base encoder is available. */
function isExact() {
  return _exact;
}

/**
 * Exact o200k_base token count. Throws if the encoder is unavailable — callers
 * that need resilience should gate on `isExact()` (see `tokens.js`).
 * @param {string} text
 * @returns {number}
 */
function countTokensExact(text) {
  if (!text) return 0;
  if (!_exact) throw new Error("o200k_base encoder unavailable");
  return _encode(text, ENCODE_OPTS).length;
}

export { countTokensExact, isExact, ENCODING };
