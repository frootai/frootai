// @ts-check
/**
 * FAI Orchard CLI — typed error class with `.code` + `.context`.
 * Matches the per-module error pattern from frootai-core/scripts/orchard/lib/.
 */
"use strict";

class OrchardCliError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {object} [context]
   */
  constructor(code, message, context) {
    super(message);
    this.name = "OrchardCliError";
    this.code = code;
    this.context = context || {};
  }
}

module.exports = { OrchardCliError };
