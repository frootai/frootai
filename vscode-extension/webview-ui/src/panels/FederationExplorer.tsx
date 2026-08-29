/**
 * M5.12 — Federation Explorer webview panel.
 *
 * Layout per the row literal:
 *   top    — search box + tier filter (T1 / T2 / T3 buttons)
 *   middle — server cards (trust badge + install count + Attach button)
 *   bottom — Attached pane (idle timer + Detach buttons)
 *
 * Pure data-shape helpers live in `../../src/webviews/federation-explorer-core.js`
 * so the unit gate can drive them without a React renderer. This file
 * is the React glue + minimal styled markup. The host (federation.ts
 * `buildDefaultExplorerOpener`) wires the postMessage bridge per the
 * locked M5.12 protocol; M5.13 layers workspaceState persistence on top.
 *
 * Bidirectional postMessage protocol (M5.12 locked):
 *   webview → host:
 *     { type: "attach",     slug }
 *     { type: "detach",     name }
 *     { type: "viewOnWeb",  slug }
 *     { type: "refresh" }
 *     { type: "stateChange", search?, tab?, tiers? }
 *   host → webview:
 *     { type: "setActiveTab", tab }
 *     { type: "focusSearch" }
 *     { type: "update", marketplace?, attached? }
 *     { type: "restoreState", search?, tab?, tiers? }
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as core from "./FederationExplorerCore";

type Tier = "T1" | "T2" | "T3";
type Tab = "attached" | "catalog";

type MarketplaceEntry = {
  slug: string;
  name?: string;
  owner?: string;
  desc?: string;
  trust?: string;
  installs?: number;
};

type AttachedAreaEntry = {
  name: string;
  trust?: string;
  toolCount?: number;
  idleMinutes?: number;
  attachedAt?: string;
};

type ServerCard = ReturnType<typeof buildCardSafe>;
function buildCardSafe(e: MarketplaceEntry) {
  return core.buildServerCard(e) as {
    slug: string;
    name: string;
    owner: string;
    desc: string;
    trust: string;
    tier: Tier;
    installsRaw: number;
    installsDisplay: string;
    url: string;
  };
}

type AttachedRow = ReturnType<typeof buildAttachedSafe>;
function buildAttachedSafe(a: AttachedAreaEntry) {
  return core.buildAttachedRow(a) as {
    name: string;
    trust: string;
    toolCount: number;
    idleDisplay: string;
    idleMinutes: number | null;
  };
}

// Acquire the host postMessage channel. Defined by the VS Code webview
// host; we cache it because `acquireVsCodeApi()` may only be called once.
declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  setState(state: unknown): void;
  getState<T = unknown>(): T | undefined;
};

let _vscode: ReturnType<typeof acquireVsCodeApi> | null = null;
function vscodeApi() {
  if (_vscode) return _vscode;
  try { _vscode = acquireVsCodeApi(); return _vscode; } catch { return null; }
}

function send(msg: unknown) {
  const api = vscodeApi();
  if (api) api.postMessage(msg);
}

export interface FederationExplorerProps {
  initialMarketplace?: MarketplaceEntry[];
  initialAttached?: AttachedAreaEntry[];
  initialTab?: Tab;
}

export default function FederationExplorer(props: FederationExplorerProps) {
  const [marketplace, setMarketplace] = useState<MarketplaceEntry[]>(props.initialMarketplace || []);
  const [attached, setAttached] = useState<AttachedAreaEntry[]>(props.initialAttached || []);
  const [search, setSearch] = useState<string>("");
  const [tiers, setTiers] = useState<Tier[]>(["T1", "T2", "T3"]);
  const [tab, setTab] = useState<Tab>(props.initialTab || "catalog");

  const searchRef = useRef<HTMLInputElement | null>(null);

  // Listen for host → webview messages.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const result = core.validateInboundMessage(event.data) as
        | { valid: true; kind: string; payload?: { tab?: Tab; marketplace?: MarketplaceEntry[]; attached?: AttachedAreaEntry[]; search?: string; tiers?: Tier[] } }
        | { valid: false; reason: string };
      if (!result.valid) return;
      const payload = (result as { payload?: Record<string, unknown> }).payload || {};
      switch (result.kind) {
        case "setActiveTab":
          if (payload.tab) setTab(payload.tab as Tab);
          return;
        case "focusSearch":
          setTab("catalog");
          // Defer focus to the next frame so React has rendered the input.
          requestAnimationFrame(() => {
            if (searchRef.current) searchRef.current.focus();
          });
          return;
        case "update":
          if (Array.isArray(payload.marketplace)) setMarketplace(payload.marketplace as MarketplaceEntry[]);
          if (Array.isArray(payload.attached)) setAttached(payload.attached as AttachedAreaEntry[]);
          return;
        case "restoreState":
          if (typeof payload.search === "string") setSearch(payload.search);
          if (payload.tab) setTab(payload.tab as Tab);
          if (Array.isArray(payload.tiers)) setTiers(payload.tiers as Tier[]);
          return;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Notify host of state changes (M5.13 will persist these in workspaceState).
  useEffect(() => {
    send({ type: "stateChange", search, tab, tiers });
  }, [search, tab, tiers]);

  const filtered = useMemo<ServerCard[]>(
    () =>
      (core.filterMarketplaceEntries({ entries: marketplace, query: search, tiers }) as MarketplaceEntry[])
        .map(buildCardSafe),
    [marketplace, search, tiers],
  );

  const attachedRows = useMemo<AttachedRow[]>(
    () => attached.map(buildAttachedSafe),
    [attached],
  );

  function toggleTier(t: Tier) {
    setTiers((cur) => {
      if (cur.includes(t)) {
        const next = cur.filter((x) => x !== t);
        return next.length === 0 ? cur : next; // never empty (avoid showing nothing)
      }
      return [...cur, t].sort();
    });
  }

  return (
    <div className="federation-explorer" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div role="tablist" style={{ display: "flex", gap: "0.5rem" }}>
          {(["catalog", "attached"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              style={{ fontWeight: tab === t ? 700 : 400, padding: "0.25rem 0.75rem" }}
            >
              {t === "catalog" ? "Catalog" : `Attached (${attachedRows.length})`}
            </button>
          ))}
          <button onClick={() => send({ type: "refresh" })} style={{ marginLeft: "auto" }}>
            Refresh
          </button>
        </div>
        {tab === "catalog" && (
          <>
            <input
              ref={searchRef}
              type="search"
              placeholder="Search marketplace (name / owner / description)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "0.5rem", width: "100%" }}
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {core.ALL_TIERS.map((t) => (
                <button
                  key={t}
                  aria-pressed={tiers.includes(t)}
                  onClick={() => toggleTier(t)}
                  style={{ opacity: tiers.includes(t) ? 1 : 0.5 }}
                >
                  {t}
                </button>
              ))}
            </div>
          </>
        )}
      </header>

      {tab === "catalog" && (
        <main style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filtered.length === 0 && (
            <p>No marketplace entries match the current filter.</p>
          )}
          {filtered.map((card) => (
            <div
              key={card.slug}
              className="federation-card"
              style={{ border: "1px solid var(--vscode-panel-border)", padding: "0.75rem", borderRadius: 4 }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                <strong>{card.name}</strong>
                <span style={{ fontSize: "0.85em", opacity: 0.7 }}>[{card.trust}]</span>
                <span style={{ fontSize: "0.85em", opacity: 0.7 }}>{card.tier}</span>
                <span style={{ marginLeft: "auto", fontSize: "0.85em" }}>
                  {card.installsRaw > 0 ? `${card.installsDisplay} installs` : ""}
                </span>
              </div>
              {card.owner && <div style={{ fontSize: "0.85em", opacity: 0.7 }}>by {card.owner}</div>}
              {card.desc && <p style={{ margin: "0.25rem 0" }}>{card.desc}</p>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button onClick={() => send({ type: "attach", slug: card.slug })}>Attach</button>
                <button onClick={() => send({ type: "viewOnWeb", slug: card.slug })}>View on web</button>
              </div>
            </div>
          ))}
        </main>
      )}

      {tab === "attached" && (
        <section className="federation-attached" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {attachedRows.length === 0 && (
            <p>No federated areas attached. Switch to the Catalog tab to attach one.</p>
          )}
          {attachedRows.map((row) => (
            <div
              key={row.name}
              className="federation-attached-row"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", border: "1px solid var(--vscode-panel-border)", padding: "0.5rem", borderRadius: 4 }}
            >
              <strong>{row.name}</strong>
              <span style={{ fontSize: "0.85em", opacity: 0.7 }}>[{row.trust}]</span>
              <span style={{ fontSize: "0.85em" }}>{row.toolCount} tools</span>
              <span style={{ fontSize: "0.85em", opacity: 0.7, marginLeft: "auto" }}>{row.idleDisplay}</span>
              <button onClick={() => send({ type: "detach", name: row.name })}>Detach</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
