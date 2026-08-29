// @ts-check
/**
 * A4.8 — `frootai orchard bushel <add|remove|list> [<id>]`
 *
 * CLI equivalent of A3.27 localStorage bushels. File-backed at ~/.frootai/bushels.json.
 * Versioned shape so Phase A4.10-A4.12 Pro sync can translate to/from localStorage shape.
 *
 * Subcommand resolution:
 *   bushel             → list (default)
 *   bushel list        → list
 *   bushel add <id>    → add
 *   bushel remove <id> → remove
 *   bushel rm <id>     → remove (alias)
 *   bushel clear       → empty the store (requires --force)
 */
"use strict";

const path = require("node:path");
const { fetchIndexBundle } = require("../cdn");
const {
  readBushelFile, writeBushelFile, addBushelId, removeBushelId,
} = require("../bushel-store");
const { status, color, renderTable } = require("../output");
const { OrchardCliError } = require("../cli-error");

const SUBCOMMANDS = Object.freeze(["list", "add", "remove", "rm", "clear"]);

async function execBushel(args, deps) {
  const d = deps || {};
  const log = d.log || ((s) => process.stdout.write(s + "\n"));

  const sub = (args._ && args._[0]) || "list";
  if (!SUBCOMMANDS.includes(sub)) {
    throw new OrchardCliError("invalid_input",
      `bushel subcommand "${sub}" not recognized. Use one of: ${SUBCOMMANDS.join(", ")}`,
      { received: sub, accepted: [...SUBCOMMANDS] });
  }

  const readImpl = d.readBushel || readBushelFile;
  const writeImpl = d.writeBushel || writeBushelFile;
  const fetchIndex = d.fetchIndex || fetchIndexBundle;
  const bushelPath = args["bushel-path"];

  let store = await readImpl({ bushelPath });

  if (sub === "add") {
    const id = args._[1];
    if (!id) {
      throw new OrchardCliError("invalid_input", "bushel add requires <id>", {
        hint: "frootai orchard bushel add azure-samples__azure-search-openai-demo",
      });
    }
    if (store.ids.includes(id)) {
      const msg = status("info", `Already in your bushel: ${color("cyan", id)}`);
      log(msg);
      return { exitCode: 0, output: msg, store };
    }
    const nextStore = addBushelId(store, id);
    const writeResult = await writeImpl(nextStore, { bushelPath });
    const msg = status("ok", `Added to bushel: ${color("cyan", id)} ${color("dim", "(" + nextStore.ids.length + " total · " + writeResult.path + ")")}`);
    log(msg);
    return { exitCode: 0, output: msg, store: nextStore };
  }

  if (sub === "remove" || sub === "rm") {
    const id = args._[1];
    if (!id) {
      throw new OrchardCliError("invalid_input", `bushel ${sub} requires <id>`, {
        hint: "frootai orchard bushel remove azure-samples__azure-search-openai-demo",
      });
    }
    if (!store.ids.includes(id)) {
      const msg = status("info", `Not in your bushel: ${color("cyan", id)}`);
      log(msg);
      return { exitCode: 0, output: msg, store };
    }
    const nextStore = removeBushelId(store, id);
    const writeResult = await writeImpl(nextStore, { bushelPath });
    const msg = status("ok", `Removed from bushel: ${color("cyan", id)} ${color("dim", "(" + nextStore.ids.length + " remaining · " + writeResult.path + ")")}`);
    log(msg);
    return { exitCode: 0, output: msg, store: nextStore };
  }

  if (sub === "clear") {
    if (!args.force) {
      throw new OrchardCliError("invalid_input",
        "bushel clear requires --force (this wipes ALL saved IDs)",
        { hint: "frootai orchard bushel clear --force" });
    }
    const before = store.ids.length;
    const writeResult = await writeImpl({ v: store.v, ids: [] }, { bushelPath });
    const msg = status("ok", `Cleared bushel: ${color("yellow", String(before))} entries removed ${color("dim", "(" + writeResult.path + ")")}`);
    log(msg);
    return { exitCode: 0, output: msg, store: { v: store.v, ids: [] } };
  }

  // sub === "list"
  if (store.ids.length === 0) {
    const msg = status("info", "Your bushel is empty. Add accelerators with `frootai orchard bushel add <id>`.");
    log(msg);
    return { exitCode: 0, output: msg, store };
  }

  if (args.json) {
    const out = JSON.stringify(store, null, 2);
    log(out);
    return { exitCode: 0, output: out, store };
  }

  // Resolve IDs against current index for richer display (skips on network failure).
  let resolved = null;
  if (!args.offline) {
    try { resolved = await fetchIndex(); }
    catch { resolved = null; }
  }
  const entriesById = new Map();
  if (resolved && Array.isArray(resolved.entries)) {
    for (const e of resolved.entries) entriesById.set(e.id, e);
  }

  const rows = store.ids.map((id) => {
    const e = entriesById.get(id);
    return {
      id,
      name: e ? e.name : color("dim", "(unresolved — not in current index)"),
      variety: e ? e.variety : color("dim", "?"),
      ripeness: e && e.ripeness ? e.ripeness : color("dim", "?"),
    };
  });

  const lines = [];
  lines.push(status("ok", `${store.ids.length} accelerator${store.ids.length === 1 ? "" : "s"} in your bushel`));
  lines.push("");
  lines.push(renderTable(rows, [
    { key: "variety", label: "VARIETY", width: 8 },
    { key: "name", label: "NAME", width: 42 },
    { key: "ripeness", label: "RIPENESS", width: 10 },
    { key: "id", label: "ID", width: 40 },
  ]));
  lines.push("");
  lines.push(color("dim", `  Local-only. Cross-device sync coming with Pro auth (A4.10-A4.12).`));

  const out = lines.join("\n");
  log(out);
  return { exitCode: 0, output: out, store };
}

module.exports = { execBushel, SUBCOMMANDS };
