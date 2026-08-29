// @ts-check
"use strict";

const SPOOFING_CONTROLS = /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb\u{e0100}-\u{e01ef}]/gu;
const SAFE_URL_INPUT = /^[\x21-\x7e]+$/u;
const EMOJI = /\p{Emoji}/u;
const EMOJI_MODIFIER = /\p{Emoji_Modifier}/u;
const EMOJI_PRESENTATION = /\p{Emoji_Presentation}/u;
const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const MARK = /\p{Mark}/u;
const REGIONAL_INDICATOR = /\p{Regional_Indicator}/u;

function isVariationSelector(codePoint) {
  return (codePoint >= 0xfe00 && codePoint <= 0xfe0f) || (codePoint >= 0xe0100 && codePoint <= 0xe01ef);
}

function extendsEmojiContext(character) {
  const codePoint = character.codePointAt(0);
  return MARK.test(character) || EMOJI_MODIFIER.test(character) || isVariationSelector(codePoint);
}

class TerminalSanitizer {
  constructor(options = {}) {
    const maximumSequenceLength = options.maximumSequenceLength ?? 4096;
    if (!Number.isSafeInteger(maximumSequenceLength) || maximumSequenceLength < 16 || maximumSequenceLength > 65536) throw new TypeError("maximumSequenceLength must be an integer from 16 through 65536");
    this.maximumSequenceLength = maximumSequenceLength;
    this.state = "text";
    this.sequenceLength = 0;
    this.pendingCr = false;
    this.pendingZwj = false;
    this.emojiContext = false;
  }

  write(value) {
    let output = "";
    const source = String(value ?? "");
    const resetEmojiContext = () => { this.pendingZwj = false; this.emojiContext = false; };
    const emit = (character) => {
      if (this.pendingZwj) {
        if (EXTENDED_PICTOGRAPHIC.test(character)) {
          output += `\u200d${character}`;
          this.pendingZwj = false;
          this.emojiContext = true;
          return;
        }
        resetEmojiContext();
      }
      if (character === "\u200d") {
        if (this.emojiContext) this.pendingZwj = true;
        return;
      }
      const sanitized = character.replace(SPOOFING_CONTROLS, "");
      output += sanitized;
      if (!sanitized) return;
      if (EXTENDED_PICTOGRAPHIC.test(character)) this.emojiContext = true;
      else if (!this.emojiContext || !extendsEmojiContext(character)) this.emojiContext = false;
    };
    const resetSequence = () => { this.state = "text"; this.sequenceLength = 0; resetEmojiContext(); };
    for (const character of source) {
      const codePoint = character.codePointAt(0);
      if (this.pendingCr) {
        emit("\n"); this.pendingCr = false;
        if (character === "\n") continue;
      }
      if (this.state === "text") {
        if (character === "\r") { this.pendingCr = true; continue; }
        if (character === "\n" || character === "\t") { emit(character); continue; }
        if (character === "\u001b") { resetEmojiContext(); this.state = "escape"; this.sequenceLength = 1; continue; }
        if (codePoint === 0x9b) { resetEmojiContext(); this.state = "csi"; this.sequenceLength = 1; continue; }
        if (codePoint === 0x9d) { resetEmojiContext(); this.state = "osc"; this.sequenceLength = 1; continue; }
        if ([0x90, 0x98, 0x9e, 0x9f].includes(codePoint)) { resetEmojiContext(); this.state = "string"; this.sequenceLength = 1; continue; }
        if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f)) { resetEmojiContext(); continue; }
        emit(character); continue;
      }
      this.sequenceLength += 1;
      if (this.sequenceLength > this.maximumSequenceLength) { resetSequence(); continue; }
      if (this.state === "escape") {
        if (character === "[") this.state = "csi";
        else if (character === "]") this.state = "osc";
        else if (["P", "X", "^", "_"].includes(character)) this.state = "string";
        else resetSequence();
        continue;
      }
      if (this.state === "csi") {
        if (codePoint >= 0x40 && codePoint <= 0x7e) resetSequence();
        continue;
      }
      if (this.state === "osc") {
        if (character === "\u0007" || character === "\u009c") resetSequence();
        else if (character === "\u001b") this.state = "osc-escape";
        continue;
      }
      if (this.state === "string") {
        if (character === "\u009c") resetSequence();
        else if (character === "\u001b") this.state = "string-escape";
        continue;
      }
      if (this.state === "osc-escape" || this.state === "string-escape") {
        if (character === "\\") resetSequence();
        else if (character !== "\u001b") this.state = this.state === "osc-escape" ? "osc" : "string";
      }
    }
    return output;
  }

  finalize() {
    let output = "";
    if (this.pendingCr) output = "\n";
    this.pendingCr = false; this.state = "text"; this.sequenceLength = 0;
    this.pendingZwj = false; this.emojiContext = false;
    return output;
  }
}

function sanitizeHuman(value) {
  const sanitizer = new TerminalSanitizer();
  return sanitizer.write(value) + sanitizer.finalize();
}

function canonicalHttps(value) {
  try {
    if (typeof value !== "string" || !SAFE_URL_INPUT.test(value) || SPOOFING_CONTROLS.test(value)) return null;
    SPOOFING_CONTROLS.lastIndex = 0;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href.replace(/</gu, "%3C").replace(/>/gu, "%3E");
  } catch { return null; }
}

function orderedUnique(items, key, compare) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const identity = key(item);
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(item);
  }
  return compare ? result.sort(compare) : result;
}

function graphemes(value) {
  if (typeof Intl.Segmenter === "function") return [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value)].map((entry) => entry.segment);
  const result = [];
  let joinNext = false;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    const last = result.at(-1);
    if (last === undefined) { result.push(character); joinNext = character === "\u200d"; continue; }
    if (joinNext) { result[result.length - 1] += character; joinNext = false; continue; }
    if (character === "\u200d") { result[result.length - 1] += character; joinNext = true; continue; }
    if (MARK.test(character) || EMOJI_MODIFIER.test(character) || isVariationSelector(codePoint)) { result[result.length - 1] += character; continue; }
    if (REGIONAL_INDICATOR.test(character) && [...last].length === 1 && REGIONAL_INDICATOR.test(last)) { result[result.length - 1] += character; continue; }
    result.push(character);
  }
  return result;
}

function codePointWidth(codePoint) {
  if (codePoint === 0 || codePoint < 0x20 || (codePoint >= 0x7f && codePoint < 0xa0)) return 0;
  if (codePoint === 0x200d || isVariationSelector(codePoint)) return 0;
  const character = String.fromCodePoint(codePoint);
  if (MARK.test(character) || EMOJI_MODIFIER.test(character)) return 0;
  if (EMOJI_PRESENTATION.test(character)) return 2;
  if (codePoint >= 0x1100 && (codePoint <= 0x115f || codePoint === 0x2329 || codePoint === 0x232a
    || (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f)
    || (codePoint >= 0xac00 && codePoint <= 0xd7a3) || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    || (codePoint >= 0xfe10 && codePoint <= 0xfe19) || (codePoint >= 0xfe30 && codePoint <= 0xfe6f)
    || (codePoint >= 0xff00 && codePoint <= 0xff60) || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
    || (codePoint >= 0x20000 && codePoint <= 0x3fffd))) return 2;
  return 1;
}

function graphemeDisplayWidth(segment, column = 0) {
  if (segment === "\t") return 8 - (column % 8);
  if (/^[#*0-9]\ufe0f?\u20e3$/u.test(segment)) return 2;
  const characters = [...segment];
  if (characters.length === 2 && characters.every((character) => REGIONAL_INDICATOR.test(character))) return 2;
  let width = 0;
  let extendedPictographicCount = 0;
  let emojiPresentation = false;
  let emojiVariation = false;
  for (const character of characters) {
    const codePoint = character.codePointAt(0);
    if (EXTENDED_PICTOGRAPHIC.test(character)) extendedPictographicCount += 1;
    emojiPresentation ||= EMOJI_PRESENTATION.test(character);
    emojiVariation ||= codePoint === 0xfe0f;
    width = Math.max(width, codePointWidth(codePoint));
  }
  if ((segment.includes("\u200d") && extendedPictographicCount >= 2) || emojiPresentation || (emojiVariation && characters.some((character) => EMOJI.test(character)))) return 2;
  return width;
}

function displayWidth(value) {
  let column = 0;
  for (const unit of graphemes(sanitizeHuman(value))) column += graphemeDisplayWidth(unit, column);
  return column;
}

function wrapLine(value, columns) {
  const width = Math.max(20, Math.min(240, Number.isFinite(columns) ? Math.trunc(columns) : 80));
  const lines = [];
  for (const logicalLine of sanitizeHuman(value).split("\n")) {
    const units = graphemes(logicalLine);
    if (units.length === 0) { lines.push(""); continue; }
    let line = ""; let cells = 0;
    for (const unit of units) {
      const cellsForUnit = graphemeDisplayWidth(unit, cells);
      if (line && cells + cellsForUnit > width) { lines.push(line); line = ""; cells = 0; }
      line += unit; cells += graphemeDisplayWidth(unit, cells);
      if (cellsForUnit > width) { lines.push(line); line = ""; cells = 0; }
    }
    if (line || units.length > 0) lines.push(line);
  }
  return lines;
}

function terminalStatus(result) {
  const type = result?.state?.terminal?.type;
  if (type === "turn.completed") return "completed";
  if (type === "turn.cancelled") return "cancelled";
  if (type === "turn.failed") return "failed";
  return "incomplete";
}

module.exports = { TerminalSanitizer, canonicalHttps, displayWidth, graphemeDisplayWidth, graphemes, orderedUnique, sanitizeHuman, terminalStatus, wrapLine };