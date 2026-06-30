# FrootAI — What Ships This Week

> A living **Now / Next / Later** board for the FrootAI ecosystem — public, honest, and updated as work lands.
> Looking for the formal API stability promise instead? See [STABILITY.md](./STABILITY.md) (semver contract).

_Last updated: 2026-06-30_

---

## ▶️ Now — shipping this week

| Item | Surface | Status |
|---|---|---|
| Live eval scorecard auto-generated in the README (637/637 spec conformance, read from `reports/`) | `README.md` · `scripts/gen-eval-scorecard.mjs` | ✅ Shipped |
| README refreshed — vendor-neutral positioning + MCP-compatible / evals-passing / plays badges | `README.md` | ✅ Shipped |
| MCP server `frootai-mcp` v5.2.0 · CLI `frootai` v5.4.0 live on npm; `frootai` v5.0.1 on PyPI | npm · PyPI | ✅ Live |

## ⏭️ Next — on deck

| Item | Surface | Notes |
|---|---|---|
| 60-second demo hero (prompt → vendor-neutral play → live MCP URL + scorecard) | `frootai.dev` | Staged on a preview route; homepage rollout pending the canonical-site decision |
| Web performance pass (Lighthouse scores + core web vitals) | `frootai.dev` | In progress; audit tooling being re-pointed at the SSR deployment |

## 🌱 Later — planned

| Item | Surface | Notes |
|---|---|---|
| Per-play model/vendor compatibility metadata (which models each play is verified on) | `solution-plays/*/config` | Foundation for the vendor-neutral marketplace story |
| Marketplace cards: per-play vendor badges + eval-score chips | `frootai.dev` marketplace | Gated on the compatibility metadata above |

---

_This board reflects real, in-flight work — not aspirations. Items move **Later → Next → Now → shipped** as they progress. No vapor: if it's on the board, it's genuinely happening._
