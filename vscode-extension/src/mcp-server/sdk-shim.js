// @ts-check
/**
 * A8.7 — VSCode MCP server: SDK-shape shim wrapping the in-process Orchard
 *         CLI dispatcher.
 *
 * The npm-mcp-orchard `createServer({sdkClient})` factory expects an SDK
 * client with this interface:
 *
 *   - sdkClient.list({variety?, where?, limit?})  → async iterable of fruits
 *   - sdkClient.search(query, {where?, limit?})   → async iterable of fruits
 *   - sdkClient.show(id)                          → fruit object (throws fruit_not_found)
 *   - sdkClient.whoami()                          → {signed_in, anonymous, tier}
 *
 * Our VSCode orchard-client (A5.19) exposes a CLI-dispatch surface that
 * returns `{ok, exitCode, output, parsed}` — different shape. This shim
 * is the bridge. We keep it pure JS (no `require("vscode")`) so the
 * `mcp-server/` module is fully testable in plain Node.
 *
 * Doctrine:
 *   - NEVER throws on shim failures — surfaces as fruit_not_found / empty
 *     iterators so the protocol layer wraps cleanly. The exception is the
 *     `show` not-found path which MUST throw with `err.code = "fruit_not_found"`
 *     to match the SDK contract the orchard.show tool relies on.
 *   - whoami() NEVER touches the network. Reads the same `~/.frootai/.token`
 *     file the CLI writes (A5.22 shared-auth contract) so a `frootai login`
 *     in terminal transparently authorizes the embedded MCP server.
 *   - All file-IO paths default to ~/.frootai/* matching A4.9-A4.12 CLI
 *     conventions; overridable via opts for tests.
 */
"use strict";

const { buildOrchardClient } = require("../orchard-client");
const { readAuthSnapshot } = require("../orchard-client/shared-auth");

/**
 * Build an SDK-shaped shim that the npm-mcp-orchard `createServer` can use.
 *
 * @param {object} [opts]
 * @param {object} [opts.cliClient]       — pre-built orchard-client (for tests)
 * @param {Function} [opts.readAuth]      — pre-built shared-auth reader (for tests)
 * @param {string}   [opts.frootaiDir]    — override ~/.frootai
 * @returns {object} SDK-shaped client
 */
function buildSdkShim(opts) {
  const o = opts || {};
  const cliClient = o.cliClient || buildOrchardClient(o);
  const authReader = typeof o.readAuth === "function" ? o.readAuth : readAuthSnapshot;

  /**
   * Pure: normalize the various CLI --json output shapes to a flat array
   * of fruits. The CLI's list/search subcommands output an array directly
   * (per A4.1-A4.2) but some legacy paths wrap it in {results: [...]}.
   */
  function _extractFruits(parsed) {
    if (!parsed) return [];
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.results)) return parsed.results;
    if (Array.isArray(parsed.fruits)) return parsed.fruits;
    if (Array.isArray(parsed.items)) return parsed.items;
    return [];
  }

  /**
   * Pure: merge the CLI's show() response shape `{fruit, pollinations}` into
   * the flat fruit shape the MCP tools expect (with pollinations[] embedded).
   * Some paths return the fruit directly without the wrapper.
   */
  function _normalizeShowResponse(parsed) {
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.fruit && typeof parsed.fruit === "object") {
      const merged = { ...parsed.fruit };
      if (Array.isArray(parsed.pollinations) && !Array.isArray(merged.pollinations)) {
        merged.pollinations = parsed.pollinations;
      }
      return merged;
    }
    return parsed;
  }

  return {
    /** @returns {AsyncIterable<object>} */
    list: async function* (listOpts) {
      const lo = listOpts || {};
      const flags = {};
      if (lo.where) flags.where = lo.where;
      if (typeof lo.limit === "number") flags.limit = lo.limit;
      const r = await cliClient.list(lo.variety, flags);
      for (const fruit of _extractFruits(r && r.parsed)) yield fruit;
    },

    /** @returns {AsyncIterable<object>} */
    search: async function* (query, searchOpts) {
      const so = searchOpts || {};
      const flags = {};
      if (so.where) flags.where = so.where;
      if (typeof so.limit === "number") flags.limit = so.limit;
      const r = await cliClient.search(query, flags);
      for (const fruit of _extractFruits(r && r.parsed)) yield fruit;
    },

    /** @returns {Promise<object>} */
    show: async function (id) {
      const r = await cliClient.show(id, {});
      if (!r || !r.ok || !r.parsed) {
        const err = new Error(`fruit not found: ${id}`);
        // @ts-ignore — attaching `code` to match the SDK error contract
        err.code = "fruit_not_found";
        throw err;
      }
      const normalized = _normalizeShowResponse(r.parsed);
      if (!normalized || !normalized.id) {
        const err = new Error(`fruit not found: ${id}`);
        // @ts-ignore
        err.code = "fruit_not_found";
        throw err;
      }
      return normalized;
    },

    /** @returns {Promise<{signed_in: boolean, anonymous: boolean, tier: string, sso_provider?: string|null, home_region?: string|null, org_id?: string|null, subject?: string|null}>} */
    whoami: async function () {
      let snap;
      try {
        snap = authReader({ frootaiDir: o.frootaiDir });
        // Support both sync + async readers (A5.22 readAuthSnapshot returns a Promise).
        if (snap && typeof snap.then === "function") snap = await snap;
      } catch {
        return { anonymous: true, signed_in: false, tier: "free" };
      }
      if (!snap || typeof snap !== "object") {
        return { anonymous: true, signed_in: false, tier: "free" };
      }
      // Expired tokens count as "not signed in" for entitlement-gate purposes
      const signedIn = snap.signed_in === true && snap.expired !== true;
      return {
        signed_in: signedIn,
        anonymous: snap.anonymous === true || !signedIn,
        subject: snap.subject || null,
        tier: snap.tier || "free",
        // A8.28 — enterprise-tier surface (passthrough from shared-auth snapshot).
        org_id: snap.org_id || null,
        sso_provider: snap.sso_provider || null,
        home_region: snap.home_region || null,
      };
    },
  };
}

module.exports = {
  buildSdkShim,
};
