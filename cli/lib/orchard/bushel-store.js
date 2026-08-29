// @ts-check
/**
 * FAI Orchard CLI — file-backed bushel store at ~/.frootai/bushels.json.
 *
 * CLI parallel of A3.27 localStorage bushels. Same versioned shape so a future
 * Pro auth handler can sync between localStorage + file with zero translation.
 *
 * Storage shape (versioned):
 *   { v: 1, ids: string[] }
 *
 * Pure helpers (readBushelFile / writeBushelFile / addBushelId / removeBushelId)
 * are split from IO so tests can pass fake fs implementations.
 */
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { OrchardCliError } = require("./cli-error");

const DEFAULT_BUSHEL_PATH = path.join(os.homedir(), ".frootai", "bushels.json");
const BUSHEL_STORAGE_VERSION = 1;
const BUSHEL_FILE_MAX_BYTES = 1 * 1024 * 1024; // 1 MiB — way more than realistic

/** Pure — parse raw text into a validated store. Never throws (returns empty on garbage). */
function parseBushelStore(raw) {
  if (raw === null || raw === undefined || raw === "") return { v: BUSHEL_STORAGE_VERSION, ids: [] };
  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { v: BUSHEL_STORAGE_VERSION, ids: [] };
    }
    if (parsed.v !== BUSHEL_STORAGE_VERSION || !Array.isArray(parsed.ids)) {
      return { v: BUSHEL_STORAGE_VERSION, ids: [] };
    }
    const ids = parsed.ids.filter((s) => typeof s === "string" && s.length > 0);
    return { v: BUSHEL_STORAGE_VERSION, ids: [...new Set(ids)] };
  } catch {
    return { v: BUSHEL_STORAGE_VERSION, ids: [] };
  }
}

/** Pure — immutable add. Returns a NEW store. */
function addBushelId(store, id) {
  if (!id || typeof id !== "string") return store;
  if (store.ids.includes(id)) return store;
  return { v: BUSHEL_STORAGE_VERSION, ids: [...store.ids, id] };
}

/** Pure — immutable remove. Returns a NEW store. */
function removeBushelId(store, id) {
  if (!id || typeof id !== "string") return store;
  if (!store.ids.includes(id)) return store;
  return { v: BUSHEL_STORAGE_VERSION, ids: store.ids.filter((x) => x !== id) };
}

/** Read the file at `bushelPath` (or default) + parse. Missing file → empty store. */
async function readBushelFile(opts) {
  const o = opts || {};
  const bushelPath = o.bushelPath || DEFAULT_BUSHEL_PATH;
  let raw;
  try {
    const stat = await fsP.stat(bushelPath);
    if (stat.size > BUSHEL_FILE_MAX_BYTES) {
      throw new OrchardCliError("file_too_large", `bushel file ${bushelPath} > cap ${BUSHEL_FILE_MAX_BYTES}`, { path: bushelPath, size: stat.size });
    }
    raw = await fsP.readFile(bushelPath, "utf8");
  } catch (err) {
    if (err && /** @type {any} */(err).code === "ENOENT") return { v: BUSHEL_STORAGE_VERSION, ids: [] };
    if (err instanceof OrchardCliError) throw err;
    throw new OrchardCliError("io_error", `failed to read bushel file: ${err instanceof Error ? err.message : String(err)}`, { path: bushelPath });
  }
  return parseBushelStore(raw);
}

/** Write store atomically (temp + rename) to `bushelPath` (or default). */
async function writeBushelFile(store, opts) {
  if (!store || typeof store !== "object" || !Array.isArray(store.ids)) {
    throw new OrchardCliError("invalid_input", "writeBushelFile requires valid store {v, ids}");
  }
  const o = opts || {};
  const bushelPath = o.bushelPath || DEFAULT_BUSHEL_PATH;
  const tempPath = `${bushelPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const json = JSON.stringify({ v: BUSHEL_STORAGE_VERSION, ids: [...new Set(store.ids)] }, null, 2) + "\n";
  if (Buffer.byteLength(json, "utf8") > BUSHEL_FILE_MAX_BYTES) {
    throw new OrchardCliError("file_too_large", `would-be bushel file exceeds cap ${BUSHEL_FILE_MAX_BYTES}`, { path: bushelPath, would_be_bytes: Buffer.byteLength(json, "utf8") });
  }
  try {
    await fsP.mkdir(path.dirname(bushelPath), { recursive: true });
    await fsP.writeFile(tempPath, json, "utf8");
    await fsP.rename(tempPath, bushelPath);
  } catch (err) {
    try { await fsP.unlink(tempPath); } catch { /* */ }
    throw new OrchardCliError("io_error", `failed to write bushel file: ${err instanceof Error ? err.message : String(err)}`, { path: bushelPath });
  }
  return { path: bushelPath, bytes: Buffer.byteLength(json, "utf8") };
}

module.exports = {
  DEFAULT_BUSHEL_PATH,
  BUSHEL_STORAGE_VERSION,
  BUSHEL_FILE_MAX_BYTES,
  parseBushelStore,
  addBushelId,
  removeBushelId,
  readBushelFile,
  writeBushelFile,
};
