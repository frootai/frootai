#!/usr/bin/env node
/**
 * frootai — Alias for frootai-mcp
 *
 * Delegates all invocations to frootai-mcp:
 *   npx frootai info 01        → CLI mode
 *   npx frootai list           → CLI mode
 *   npx frootai scaffold 01    → CLI mode
 *   npx frootai                → MCP server (stdin/stdout)
 */
const { spawn } = require("child_process");
const path = require("path");

// Resolve the frootai-mcp main entry (respects exports field)
const entry = require.resolve("frootai-mcp");

const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
