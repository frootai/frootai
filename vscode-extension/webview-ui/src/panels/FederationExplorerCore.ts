export const ALL_TIERS = ["T1", "T2", "T3"] as const;
export type Tier = typeof ALL_TIERS[number];
export type Tab = "attached" | "catalog";

export interface MarketplaceEntry {
  slug: string;
  name?: string;
  owner?: string;
  desc?: string;
  trust?: string;
  installs?: number;
}

export interface AttachedAreaEntry {
  name: string;
  trust?: string;
  toolCount?: number;
  idleMinutes?: number;
  attachedAt?: string;
}

export function filterMarketplaceEntries(input: { entries?: MarketplaceEntry[]; query?: string; tiers?: Tier[] }): MarketplaceEntry[] {
  const query = (input.query ?? "").trim().toLowerCase();
  const tiers = input.tiers?.length ? new Set(input.tiers) : null;
  const seen = new Set<string>();
  return (input.entries ?? [])
    .filter((entry) => {
      if (!entry?.slug || seen.has(entry.slug)) return false;
      seen.add(entry.slug);
      if (tiers && !tiers.has(resolveTier(entry.trust))) return false;
      return !query || [entry.slug, entry.name, entry.owner, entry.desc]
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((left, right) => {
      const installDifference = (right.installs ?? 0) - (left.installs ?? 0);
      return installDifference || (left.name ?? left.slug).localeCompare(right.name ?? right.slug);
    });
}

export function buildServerCard(entry: MarketplaceEntry) {
  const installs = typeof entry.installs === "number" && entry.installs >= 0 ? entry.installs : 0;
  return {
    slug: entry.slug,
    name: entry.name || entry.slug,
    owner: entry.owner || "",
    desc: entry.desc || "",
    trust: entry.trust || "unknown",
    tier: resolveTier(entry.trust),
    installsRaw: installs,
    installsDisplay: Math.floor(installs).toLocaleString("en-US"),
    url: `https://frootai.dev/ecosystem/mcp/marketplace/${encodeURIComponent(entry.slug)}`,
  };
}

export function buildAttachedRow(area: AttachedAreaEntry) {
  const idleMinutes = typeof area.idleMinutes === "number" && area.idleMinutes >= 0 ? area.idleMinutes : null;
  return {
    name: area.name || "",
    trust: area.trust || "unknown",
    toolCount: typeof area.toolCount === "number" && area.toolCount >= 0 ? area.toolCount : 0,
    idleDisplay: formatIdleTimer(idleMinutes),
    idleMinutes,
  };
}

export function validateInboundMessage(message: unknown):
  | { valid: true; kind: string; payload?: Record<string, unknown> }
  | { valid: false; reason: string } {
  if (!message || typeof message !== "object") return { valid: false, reason: "not an object" };
  const value = message as Record<string, unknown>;
  switch (value.type) {
    case "setActiveTab":
      return isTab(value.tab) ? { valid: true, kind: "setActiveTab", payload: { tab: value.tab } } : { valid: false, reason: "invalid tab" };
    case "focusSearch":
      return { valid: true, kind: "focusSearch" };
    case "update": {
      if (value.marketplace !== undefined && !Array.isArray(value.marketplace)) return { valid: false, reason: "marketplace not array" };
      if (value.attached !== undefined && !Array.isArray(value.attached)) return { valid: false, reason: "attached not array" };
      return { valid: true, kind: "update", payload: { ...(value.marketplace !== undefined ? { marketplace: value.marketplace } : {}), ...(value.attached !== undefined ? { attached: value.attached } : {}) } };
    }
    case "restoreState":
      return {
        valid: true,
        kind: "restoreState",
        payload: {
          ...(typeof value.search === "string" ? { search: value.search } : {}),
          ...(isTab(value.tab) ? { tab: value.tab } : {}),
          ...(Array.isArray(value.tiers) ? { tiers: value.tiers.filter(isTier) } : {}),
        },
      };
    default:
      return { valid: false, reason: "unknown inbound type" };
  }
}

function resolveTier(trust?: string): Tier {
  if (trust?.toLowerCase() === "first-party-ms") return "T1";
  if (trust?.toLowerCase() === "verified-publisher") return "T2";
  return "T3";
}

function formatIdleTimer(value: number | null): string {
  if (value === null) return "—";
  const minutes = Math.floor(value);
  if (minutes === 0) return "just now";
  if (minutes < 60) return `idle ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours < 24) return remaining ? `idle ${hours}h${remaining}m` : `idle ${hours}h`;
  return `idle ${Math.floor(hours / 24)}d`;
}

function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (ALL_TIERS as readonly string[]).includes(value);
}

function isTab(value: unknown): value is Tab {
  return value === "attached" || value === "catalog";
}
