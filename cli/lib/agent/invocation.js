// @ts-check
"use strict";

const path = require("node:path");
const registry = require("./command-registry.generated.js");

function normalizeInvocation(invokedAs, argv) {
  if (typeof invokedAs !== "string" || !Array.isArray(argv) || !argv.every((arg) => typeof arg === "string")) {
    throw new TypeError("normalizeInvocation requires an invocation name and string argv array");
  }
  if (path.basename(invokedAs) !== invokedAs || !["frootai", "fai", registry.directBin].includes(invokedAs)) {
    throw new Error(`Unsupported Agent FAI invocation: ${invokedAs}`);
  }
  if (invokedAs === registry.directBin) return { route: registry.internalRoute, args: [...argv] };
  if (argv[0] !== registry.internalRoute) return { route: null, args: [...argv] };
  return { route: registry.internalRoute, args: argv.slice(1) };
}

module.exports = { normalizeInvocation };