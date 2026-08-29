// @ts-check
"use strict";

async function awaitWithAbort(promise, signal, onAbort) {
  const pending = Promise.resolve(promise);
  if (!signal) return pending;
  if (signal.aborted) {
    pending.catch(() => {});
    try { Promise.resolve(onAbort?.()).catch(() => {}); } catch { /* */ }
    throw signal.reason || new Error("aborted");
  }
  let abort;
  const aborted = new Promise((_resolve, reject) => {
    abort = () => {
      try { Promise.resolve(onAbort?.()).catch(() => {}); } catch { /* */ }
      reject(signal.reason || new Error("aborted"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([pending, aborted]);
  } finally {
    signal.removeEventListener("abort", abort);
    pending.catch(() => {});
  }
}

module.exports = { awaitWithAbort };