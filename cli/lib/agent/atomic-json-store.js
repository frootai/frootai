// @ts-check
"use strict";

const fs = require("node:fs");
const fsP = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { parseStrictJson } = require("./strict-json.js");

const LOCK_OWNER_SCHEMA_VERSION = "agent-fai-lock-owner.v1";
const DEFAULT_MAXIMUM_RELEASE_TOMBSTONES = 1024;
const MAXIMUM_RELEASE_TOMBSTONES_LIMIT = 4096;

class LocalStoreError extends Error {
  constructor(code) {
    super(code);
    this.name = "LocalStoreError";
    this.code = code;
  }
}

function isMissing(error) {
  return Boolean(error && error.code === "ENOENT");
}

function validateAbsolutePath(filePath) {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath) || path.resolve(filePath) !== filePath) {
    throw new LocalStoreError("invalid_path");
  }
}

function sameFile(left, right) {
  if (!left || !right) return false;
  if (!Number.isFinite(left.dev) || !Number.isFinite(right.dev)) return false;
  if (!Number.isFinite(left.ino) || !Number.isFinite(right.ino)) return false;
  if (left.dev === 0 || right.dev === 0 || left.ino === 0 || right.ino === 0) return false;
  return left.dev === right.dev && left.ino === right.ino;
}

function sameReadObservation(left, right) {
  if (!left || !right) return false;
  if (sameFile(left, right)) return true;
  return left.size === right.size
    && left.mtimeMs === right.mtimeMs;
}

function createIo(injected) {
  if (!injected) return fsP;
  return { ...injected };
}

function assertGenuineLstat(io) {
  if (typeof io.lstat !== "function") throw new LocalStoreError("lstat_required");
}

async function lstatSafe(targetPath, io) {
  assertGenuineLstat(io);
  try {
    const stat = await io.lstat(targetPath);
    if (typeof stat.isSymbolicLink === "function" && stat.isSymbolicLink()) {
      throw new LocalStoreError("symlink_rejected");
    }
    return stat;
  } catch (error) {
    if (isMissing(error)) return null;
    if (error instanceof LocalStoreError) throw error;
    throw new LocalStoreError("stat_failed");
  }
}

async function assertSafeParent(targetPath, io) {
  validateAbsolutePath(targetPath);
  const parsed = path.parse(targetPath);
  const segments = path.relative(parsed.root, path.dirname(targetPath)).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const stat = await lstatSafe(current, io);
    if (stat && typeof stat.isDirectory === "function" && !stat.isDirectory()) {
      throw new LocalStoreError("unsafe_parent");
    }
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function createFileLock(lockPath, options = {}) {
  validateAbsolutePath(lockPath);
  const io = createIo(options.io);
  const timeoutMs = options.timeoutMs === undefined ? 5_000 : options.timeoutMs;
  const retryMs = options.retryMs === undefined ? 25 : options.retryMs;
  const maximumReleaseTombstones = options.maximumReleaseTombstones === undefined
    ? DEFAULT_MAXIMUM_RELEASE_TOMBSTONES
    : options.maximumReleaseTombstones;
  if (!Number.isSafeInteger(maximumReleaseTombstones)
    || maximumReleaseTombstones < 1
    || maximumReleaseTombstones > MAXIMUM_RELEASE_TOMBSTONES_LIMIT) {
    throw new LocalStoreError("invalid_release_tombstone_limit");
  }
  const releaseNamePattern = new RegExp(`^${escapeRegExp(path.basename(lockPath))}\\.release-[0-9a-f]{32}-[0-9a-f]{32}$`, "u");
  function releaseFailed(phase, code) {
    if (typeof options.onDiagnostic === "function") options.onDiagnostic({ phase, code });
    return new LocalStoreError("lock_release_failed");
  }
  function assertReleaseCapabilities() {
    const releaseIo = options.io || fsP;
    if (["rename", "readdir", "readFile"].some((method) => typeof releaseIo[method] !== "function")) {
      throw releaseFailed("release-capability", "release_io_unavailable");
    }
  }
  async function countReleaseTombstones() {
    const parent = path.dirname(lockPath);
    let entries;
    try {
      entries = await io.readdir(parent);
    } catch (error) {
      if (isMissing(error)) return 0;
      throw new LocalStoreError("lock_failed");
    }
    let count = 0;
    for (const entry of entries) {
      if (typeof entry !== "string" || !releaseNamePattern.test(entry)) continue;
      const observed = await lstatSafe(path.join(parent, entry), io);
      if (observed) count += 1;
    }
    return count;
  }
  async function removeOwnedLock(owner, metadataName, expectedMetadata, acquiredDirectoryStat, acquiredMarkerStat, releasePath) {
    const fixedMetadataPath = path.join(lockPath, metadataName);
    let preRenameDirectoryStat = null;
    let preRenameMarkerStat = null;
    try {
      preRenameDirectoryStat = await lstatSafe(lockPath, io);
      preRenameMarkerStat = await lstatSafe(fixedMetadataPath, io);
      await io.rename(lockPath, releasePath);
    } catch (error) {
      throw releaseFailed("release-rename", error && typeof error.code === "string" ? error.code : "rename_failed");
    }

    const releaseMetadataPath = path.join(releasePath, metadataName);
    let releaseDirectoryStat;
    let releaseMarkerStat;
    async function verifyMovedLock() {
      let entries;
      let raw;
      let metadata;
      try {
        entries = await io.readdir(releasePath);
        releaseDirectoryStat = await lstatSafe(releasePath, io);
        releaseMarkerStat = await lstatSafe(releaseMetadataPath, io);
        raw = await io.readFile(releaseMetadataPath, "utf8");
        metadata = parseStrictJson(raw, "lock metadata");
      } catch (error) {
        throw releaseFailed("release-verify", error && typeof error.code === "string" ? error.code : "invalid_metadata");
      }
      const exactEntry = entries.length === 1 && entries[0] === metadataName;
      const directoryIdentity = sameFile(acquiredDirectoryStat, preRenameDirectoryStat)
        && sameFile(preRenameDirectoryStat, releaseDirectoryStat);
      const markerIdentity = sameFile(acquiredMarkerStat, preRenameMarkerStat)
        && sameFile(preRenameMarkerStat, releaseMarkerStat);
      const directoryType = releaseDirectoryStat && typeof releaseDirectoryStat.isDirectory === "function" && releaseDirectoryStat.isDirectory();
      const markerType = releaseMarkerStat && typeof releaseMarkerStat.isFile === "function" && releaseMarkerStat.isFile();
      const exactMetadata = metadata && Object.keys(metadata).length === 2
        && metadata.schemaVersion === LOCK_OWNER_SCHEMA_VERSION
        && metadata.owner === owner;
      if (!exactEntry || !directoryIdentity || !markerIdentity || !directoryType || !markerType || raw !== expectedMetadata || !exactMetadata) {
        throw releaseFailed("release-verify", "owner_mismatch");
      }
    }

    await verifyMovedLock();
    await verifyMovedLock();
  }

  async function runExclusive(operation) {
    assertGenuineLstat(io);
    assertReleaseCapabilities();
    if (await countReleaseTombstones() >= maximumReleaseTombstones) {
      throw new LocalStoreError("lock_cleanup_required");
    }
    const owner = crypto.randomBytes(16).toString("hex");
    const metadataName = `owner-${owner}.json`;
    const metadataPath = path.join(lockPath, metadataName);
    const releasePath = `${lockPath}.release-${owner}-${crypto.randomBytes(16).toString("hex")}`;
    const metadata = JSON.stringify({ schemaVersion: LOCK_OWNER_SCHEMA_VERSION, owner }) + "\n";
    const deadline = Date.now() + timeoutMs;
    let acquiredDirectoryStat;
    let acquiredMarkerStat;
    await assertSafeParent(lockPath, io);
    await io.mkdir(path.dirname(lockPath), { recursive: true, mode: 0o700 });
    await assertSafeParent(lockPath, io);
    for (;;) {
      let createdDirectory = false;
      try {
        if (await countReleaseTombstones() >= maximumReleaseTombstones) {
          throw new LocalStoreError("lock_cleanup_required");
        }
        await io.mkdir(lockPath, { mode: 0o700 });
        createdDirectory = true;
        await io.writeFile(metadataPath, metadata, { encoding: "utf8", mode: 0o600, flag: "wx" });
        acquiredDirectoryStat = await lstatSafe(lockPath, io);
        acquiredMarkerStat = await lstatSafe(metadataPath, io);
        if (await countReleaseTombstones() >= maximumReleaseTombstones) {
          await removeOwnedLock(owner, metadataName, metadata, acquiredDirectoryStat, acquiredMarkerStat, releasePath);
          throw new LocalStoreError("lock_cleanup_required");
        }
        break;
      } catch (error) {
        if (error instanceof LocalStoreError) throw error;
        if (!error || error.code !== "EEXIST") {
          throw new LocalStoreError("lock_failed");
        }
        if (createdDirectory) throw new LocalStoreError("lock_failed");
        if (typeof options.onDiagnostic === "function") options.onDiagnostic({ phase: "acquire", code: "operator_cleanup_required" });
        if (Date.now() >= deadline) throw new LocalStoreError("lock_timeout");
        await wait(Math.min(retryMs, Math.max(1, deadline - Date.now())));
      }
    }
    try {
      return await operation();
    } finally {
      await removeOwnedLock(owner, metadataName, metadata, acquiredDirectoryStat, acquiredMarkerStat, releasePath);
    }
  }

  return Object.freeze({ path: lockPath, runExclusive });
}

function createAtomicJsonFile(filePath, options = {}) {
  validateAbsolutePath(filePath);
  const io = createIo(options.io);
  const maximumBytes = options.maximumBytes;
  const mode = options.mode || 0o600;
  const onLooseMode = typeof options.onLooseMode === "function"
    ? options.onLooseMode
    : () => process.stderr.write("warning: local state file permissions are broader than expected\n");
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) throw new LocalStoreError("invalid_size_limit");
  const lock = options.lock || createFileLock(`${filePath}.lock`, { ...options.lockOptions, io });

  async function inspect() {
    await assertSafeParent(filePath, io);
    const stat = await lstatSafe(filePath, io);
    if (stat && stat.size > maximumBytes) throw new LocalStoreError("file_too_large");
    if (stat && process.platform !== "win32" && typeof stat.mode === "number" && (stat.mode & 0o077) !== 0) onLooseMode();
    return stat;
  }

  async function readUnlocked() {
    const before = await inspect();
    if (!before) return null;
    let raw;
    if (typeof io.open === "function") {
      let handle;
      try {
        const noFollow = fs.constants.O_NOFOLLOW || 0;
        try { handle = await io.open(filePath, fs.constants.O_RDONLY | noFollow); }
        catch (error) {
          if (!noFollow || !error || !["EINVAL", "ENOTSUP", "EOPNOTSUPP"].includes(error.code)) throw error;
          const guarded = await inspect();
          if (!guarded) return null;
          handle = await io.open(filePath, fs.constants.O_RDONLY);
        }
        const opened = await handle.stat();
        if (!sameReadObservation(before, opened)) throw new LocalStoreError("path_changed");
        if (opened.size > maximumBytes) throw new LocalStoreError("file_too_large");
        raw = await handle.readFile({ encoding: "utf8" });
        const after = await lstatSafe(filePath, io);
        if (!after || !sameReadObservation(opened, after)) throw new LocalStoreError("path_changed");
      } catch (error) {
        if (error instanceof LocalStoreError) throw error;
        throw new LocalStoreError("read_failed");
      } finally {
        if (handle) await handle.close().catch(() => {});
      }
    } else {
      try {
        raw = await io.readFile(filePath, "utf8");
        const after = await inspect();
        if (!after || !sameReadObservation(before, after)) throw new LocalStoreError("path_changed");
      } catch (error) {
        if (error instanceof LocalStoreError) throw error;
        throw new LocalStoreError("read_failed");
      }
    }
    if (Buffer.byteLength(raw, "utf8") > maximumBytes) throw new LocalStoreError("file_too_large");
    try { return parseStrictJson(raw, "local state"); }
    catch { throw new LocalStoreError("invalid_json"); }
  }

  async function syncParent(parent) {
    if (process.platform === "win32" || typeof io.open !== "function") return;
    let handle;
    try {
      handle = await io.open(parent, fs.constants.O_RDONLY);
      await handle.sync();
    } catch {
      throw new LocalStoreError("directory_sync_failed");
    } finally {
      if (handle) await handle.close().catch(() => {});
    }
  }

  async function writeUnlocked(value) {
    await inspect();
    const raw = JSON.stringify(value) + "\n";
    if (Buffer.byteLength(raw, "utf8") > maximumBytes) throw new LocalStoreError("file_too_large");
    const parent = path.dirname(filePath);
    const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(8).toString("hex")}`;
    let handle;
    try {
      await io.mkdir(parent, { recursive: true, mode: 0o700 });
      await assertSafeParent(filePath, io);
      if (typeof io.open === "function") {
        handle = await io.open(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, mode);
        await handle.writeFile(raw, { encoding: "utf8" });
        await handle.sync();
        await handle.close();
        handle = null;
      } else {
        await io.writeFile(temporary, raw, { encoding: "utf8", mode, flag: "wx" });
      }
      await lstatSafe(temporary, io);
      await inspect();
      await io.rename(temporary, filePath);
      if (process.platform !== "win32" && typeof io.chmod === "function") await io.chmod(filePath, mode);
      const writtenStat = await lstatSafe(filePath, io);
      if (!writtenStat) throw new LocalStoreError("write_failed");
      await syncParent(parent);
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      try { await io.unlink(temporary); } catch { /* best effort */ }
      throw error instanceof LocalStoreError ? error : new LocalStoreError("write_failed");
    }
  }

  async function clearUnlocked(clearOptions = {}) {
    if (clearOptions.expectedMutation !== undefined) throw new LocalStoreError("mutation_rollback_unsupported");
    const stat = await inspect();
    if (!stat) return false;
    try {
      await io.unlink(filePath);
      await syncParent(path.dirname(filePath));
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      if (error instanceof LocalStoreError) throw error;
      throw new LocalStoreError("delete_failed");
    }
  }

  async function read() {
    assertGenuineLstat(io);
    return readUnlocked();
  }

  async function write(value) {
    assertGenuineLstat(io);
    await lock.runExclusive(() => writeUnlocked(value));
    return value;
  }

  async function clear() {
    assertGenuineLstat(io);
    return lock.runExclusive(clearUnlocked);
  }

  async function transaction(mutator) {
    assertGenuineLstat(io);
    if (typeof mutator !== "function") throw new LocalStoreError("invalid_transaction");
    return lock.runExclusive(async () => {
      const current = await readUnlocked();
      return mutator(Object.freeze({ current, write: writeUnlocked, clear: clearUnlocked }));
    });
  }

  return Object.freeze({ path: filePath, read, write, clear, transaction, lock });
}

module.exports = { LocalStoreError, createFileLock, createAtomicJsonFile };