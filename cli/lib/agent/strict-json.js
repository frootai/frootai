// @ts-check
"use strict";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function parseStrictJson(text, label = "JSON") {
  if (typeof text !== "string") throw new TypeError(`${label} must be text`);
  let index = 0;
  const fail = (message) => { throw new SyntaxError(`${label} ${message} at offset ${index}`); };
  const whitespace = () => { while (/\s/u.test(text[index] || "") && /[\u0020\u000a\u000d\u0009]/u.test(text[index])) index += 1; };
  const string = () => {
    if (text[index] !== '"') fail("expected string");
    const start = index++;
    let escaped = false;
    while (index < text.length) {
      const character = text[index++];
      if (!escaped && character === '"') {
        try { return JSON.parse(text.slice(start, index)); } catch { fail("contains an invalid string"); }
      }
      if (!escaped && character.charCodeAt(0) < 0x20) fail("contains a control character");
      escaped = !escaped && character === "\\";
    }
    fail("contains an unterminated string");
  };
  const value = (depth = 0) => {
    if (depth > 64) fail("exceeds maximum nesting depth");
    whitespace();
    if (text[index] === '"') return string();
    if (text[index] === "{") {
      index += 1; whitespace();
      const result = {}; const keys = new Set();
      if (text[index] === "}") { index += 1; return result; }
      while (index < text.length) {
        const key = string();
        if (keys.has(key)) fail("contains a duplicate key");
        if (FORBIDDEN_KEYS.has(key)) fail("contains a forbidden key");
        keys.add(key); whitespace();
        if (text[index++] !== ":") fail("expected colon");
        Object.defineProperty(result, key, { value: value(depth + 1), enumerable: true, configurable: true, writable: true }); whitespace();
        if (text[index] === "}") { index += 1; return result; }
        if (text[index++] !== ",") fail("expected comma");
        whitespace();
      }
      fail("contains an unterminated object");
    }
    if (text[index] === "[") {
      index += 1; whitespace(); const result = [];
      if (text[index] === "]") { index += 1; return result; }
      while (index < text.length) {
        result.push(value(depth + 1)); whitespace();
        if (text[index] === "]") { index += 1; return result; }
        if (text[index++] !== ",") fail("expected comma");
      }
      fail("contains an unterminated array");
    }
    for (const [literal, parsed] of [["true", true], ["false", false], ["null", null]]) if (text.startsWith(literal, index)) { index += literal.length; return parsed; }
    const match = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
    if (!match) fail("contains an invalid value");
    index += match[0].length;
    const parsed = Number(match[0]);
    if (!Number.isFinite(parsed)) fail("contains a non-finite number");
    return parsed;
  };
  const parsed = value(); whitespace();
  if (index !== text.length) fail("contains trailing content");
  return parsed;
}

module.exports = { FORBIDDEN_KEYS, parseStrictJson };