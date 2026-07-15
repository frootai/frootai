// @ts-check
/**
 * Offline harness for the [X8.12] per-recipe runnable scripts.
 *
 * Composition recipes attach 2+ real MCP servers and need live credentials to
 * run for real. To stay reproducible on a fresh CI runner with NO network and
 * NO secrets, each `run.mjs` drives its recipe's step graph against FAKE areas
 * produced here — the same injectable-fake pattern the marketplace reference
 * modules use. The fakes return deterministic canned data so every run prints a
 * stable transcript ending in `RESULT: OK`.
 *
 * A `run.mjs` is the executable companion to its cookbook markdown; it does NOT
 * make real tool calls. Swap the fakes for the live areas (and provide the
 * credentials in the recipe's Security note) to run it against real servers.
 */
"use strict";

/**
 * A fake MCP area: any tool call returns a deterministic descriptor object and
 * records the call. Lets a recipe's loop run end-to-end with no network.
 * @param {string} slug
 * @param {{calls: Array<{slug:string,tool:string,args:unknown}>}} sink
 */
export function fakeArea(slug, sink) {
  return new Proxy(
    {},
    {
      get: (_t, tool) => (args) => {
        const call = { slug, tool: String(tool), args: args ?? null };
        sink.calls.push(call);
        return { ok: true, ...call };
      },
    },
  );
}

/**
 * Attach a set of fake areas keyed by slug.
 * @param {string[]} slugs
 * @param {{calls: Array<{slug:string,tool:string,args:unknown}>}} sink
 */
export function attach(slugs, sink) {
  return Object.fromEntries(slugs.map((s) => [s, fakeArea(s, sink)]));
}

/**
 * Run a recipe's step graph against fake areas + print a deterministic
 * transcript. Throws nothing on success; prints `RESULT: OK` last.
 *
 * @param {{
 *   id: string,
 *   title: string,
 *   attached: string[],
 *   steps: (ctx: { areas: Record<string, any>, emit: (line: string) => void }) => void,
 * }} recipe
 */
export function runRecipe(recipe) {
  const sink = { calls: [] };
  const areas = attach(recipe.attached, sink);
  const lines = [];
  const emit = (line) => lines.push(line);

  recipe.steps({ areas, emit });

  // Every attached area must have been exercised at least once — proves the
  // recipe actually composes all of its declared servers.
  const used = new Set(sink.calls.map((c) => c.slug));
  const unused = recipe.attached.filter((s) => !used.has(s));
  if (unused.length) {
    process.stdout.write(`RESULT: FAIL — unused areas: ${unused.join(", ")}\n`);
    process.exit(1);
  }

  const out = [
    `# ${recipe.title} (${recipe.id})`,
    `attached: ${recipe.attached.join(", ")}`,
    `tool calls: ${sink.calls.length}`,
    ...lines,
    "RESULT: OK",
  ].join("\n");
  process.stdout.write(out + "\n");
}
