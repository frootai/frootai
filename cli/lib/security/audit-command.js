// @ts-check
"use strict";

const { readRecords, resolveAuditPath, verifyAuditLog } = require("./audit-log");

function runAuditCommand(argv, io = {}) {
  const out = io.out || ((text) => process.stdout.write(`${text}\n`));
  const err = io.err || ((text) => process.stderr.write(`${text}\n`));
  const auditPath = io.auditPath || resolveAuditPath(io.env, io.homedir);
  const subcommand = argv[0] || "verify";
  const json = argv.includes("--json");
  if (subcommand === "path") {
    out(json ? JSON.stringify({ path: auditPath }) : auditPath);
    return 0;
  }
  if (subcommand === "verify") {
    const result = verifyAuditLog(auditPath);
    out(json ? JSON.stringify(result, null, 2) : `${result.ok ? "PASS" : "FAIL"} audit chain · ${result.records} records · ${auditPath}${result.error ? ` · ${result.error}` : ""}`);
    return result.ok ? 0 : 65;
  }
  if (subcommand === "tail") {
    const countToken = argv.find((value, index) => index > 0 && /^\d+$/.test(value));
    const count = Math.min(Number(countToken || 20), 200);
    try {
      const records = readRecords(auditPath).slice(-count);
      out(json ? JSON.stringify(records, null, 2) : records.map((record) => JSON.stringify(record)).join("\n"));
      return 0;
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      return 65;
    }
  }
  err(`unknown audit command: ${subcommand}; use verify, path, or tail`);
  return 64;
}

module.exports = { runAuditCommand };