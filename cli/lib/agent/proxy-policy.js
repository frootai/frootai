// @ts-check
"use strict";

const { AgentFaiClientError } = require("./client-error.js");

function firstEnvironmentValue(environment, upper, lower) {
  if (Object.hasOwn(environment, upper)) return environment[upper];
  return environment[lower];
}

function parseNoProxy(value) {
  if (!value) return [];
  return String(value).split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    if (/[^\x21-\x7e]/u.test(entry) || entry.includes("@") || entry.includes("/")) throw new AgentFaiClientError("integrity_failed");
    if (entry === "*") return { wildcard: true };
    let host = entry; let port = null;
    if (entry.startsWith("[")) {
      const match = entry.match(/^\[([^\]]+)\](?::(\d+))?$/u);
      if (!match) throw new AgentFaiClientError("integrity_failed");
      host = match[1]; port = match[2] || null;
    } else {
      const match = entry.match(/^(.*?)(?::(\d+))?$/u);
      host = match[1]; port = match[2] || null;
    }
    host = host.toLowerCase().replace(/^\./u, "");
    if (!host) throw new AgentFaiClientError("integrity_failed");
    return { host, port };
  });
}

function noProxyMatches(url, entries) {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  return entries.some((entry) => entry.wildcard || ((!entry.port || entry.port === port) && (host === entry.host || host.endsWith(`.${entry.host}`))));
}

function resolveProxy(target, environment = process.env) {
  const noProxy = firstEnvironmentValue(environment, "NO_PROXY", "no_proxy");
  if (noProxyMatches(target, parseNoProxy(noProxy))) return { kind: "direct", proxyUrl: null };
  const raw = firstEnvironmentValue(environment, "HTTPS_PROXY", "https_proxy") || firstEnvironmentValue(environment, "HTTP_PROXY", "http_proxy");
  if (!raw) return { kind: "direct", proxyUrl: null };
  let proxy;
  try { proxy = new URL(raw); } catch { throw new AgentFaiClientError("integrity_failed"); }
  if (!["http:", "https:"].includes(proxy.protocol) || proxy.hash || proxy.search) throw new AgentFaiClientError("integrity_failed");
  return { kind: "proxy", proxyUrl: proxy.toString() };
}

module.exports = { parseNoProxy, noProxyMatches, resolveProxy };