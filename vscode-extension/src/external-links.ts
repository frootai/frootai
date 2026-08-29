const FROOTAI_HOSTS = new Set(["frootai.dev", "www.frootai.dev"]);
const APPROVED_EXTERNAL_HOSTS = new Set([
  ...FROOTAI_HOSTS,
  "github.com",
  "www.github.com",
  "learn.microsoft.com",
  "azure.microsoft.com",
  "www.npmjs.com",
  "npmjs.com",
  "pypi.org",
  "aka.ms",
]);

export function isCanonicalFrootAiHost(hostname: string): boolean {
  return FROOTAI_HOSTS.has(hostname.toLowerCase());
}

export function approvedExternalUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error("Blocked malformed external URL."); }
  if (url.protocol !== "https:") throw new Error(`Blocked external URL scheme: ${url.protocol}`);
  const host = url.hostname.toLowerCase();
  if (!APPROVED_EXTERNAL_HOSTS.has(host) || url.username || url.password) throw new Error(`Blocked unapproved external host: ${host || "unknown"}.`);
  return url;
}
