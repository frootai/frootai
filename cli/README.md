# FrootAI CLI

> **The FAI Protocol toolkit for AI primitive management.** Drives the FAI Factory pipeline, scaffolds primitives, ships releases across all distribution channels.

## ⚠️ Command surface changed in v5.4.2

Starting with `frootai@5.4.2`, the package ships the **FAI Factory CLI** for monorepo authors of FrootAI primitives and solution plays. The v5.4.0 user-facing commands (`info`, `install`, `deploy`, `doctor`, `login`, `search`, `cost`, `list`, `protocol`, `init`, `update`, `status`) have moved to other channels:

| v5.4.0 command (removed) | New home |
|---|---|
| `npx frootai info <play>` | Browse [frootai.dev/solution-plays](https://frootai.dev/solution-plays) or use the MCP server: `npx frootai-mcp` |
| `npx frootai install <play>` | `git clone` from [github.com/frootai](https://github.com/frootai) or use the VS Code extension `frootai-vscode` |
| `npx frootai deploy` | Use `azd up` from your play's `infra/` folder directly |
| `npx frootai search <q>` | Use the MCP server: `npx frootai-mcp` (search is exposed as an MCP tool) |
| `npx frootai doctor` | Use the VS Code extension's health check, or `npx frootai-mcp --health` |
| `npx frootai scaffold <play>` (install play) | Renamed: `npx frootai scaffold <primitive-type>` (scaffolds a single primitive from template) |

If you need the v5.4.0 user CLI, pin to `frootai@5.4.0`. It will not receive further updates.

[![npm version](https://img.shields.io/npm/v/frootai.svg)](https://www.npmjs.com/package/frootai)
[![npm downloads](https://img.shields.io/npm/dm/frootai.svg)](https://www.npmjs.com/package/frootai)
[![Node.js](https://img.shields.io/node/v/frootai.svg)](https://nodejs.org)
[![License](https://img.shields.io/npm/l/frootai.svg)](https://github.com/frootai/frootai/blob/main/LICENSE)

## What is `frootai`?

`frootai` is the **command-line front door** to the FrootAI ecosystem — Orchard, MCP federation, Lean, the FAI Protocol, FAI Engine, FAI Factory, and the seven distribution channels (npm MCP, npm CLI, VS Code, Python MCP, Python SDK, Docker, Foundry agent).

Run `frootai products` anywhere to see which product surfaces are CLI-native, bridged through another command or MCP, or intentionally web-first. Use `frootai products --json` in automation.

Run `frootai capabilities` to inspect the executable backend itself. Unlike the product map, capability evidence is derived by loading the packaged dispatchers, reading their exported command registries and callable contracts, and reporting their package-relative source paths. Use `frootai capabilities --json` in release gates.

Agent FAI routing is available as `fai agent`, the equivalent `frootai agent`, and the direct `agent-fai` alias. AFCLI-T015 adds a packed, zero-runtime-dependency protocol client with generated T009 operation metadata and exact vendored T010 validators. AFCLI-T016 adds packed pure reducer and renderer libraries exported as `frootai/agent/event-reducer` and `frootai/agent/renderers`. AFCLI-T018 adds observe-only one-shot execution through `ask <prompt>` and `run --prompt <text>|--stdin`, with deterministic formats, deadlines, signal cancellation, and exits. AFCLI-T019 adds observe-only interactive line mode, bounded steering, answer/architecture/plan/review intents, first-signal turn cancellation, second-signal termination, content-free local session metadata, resume, session list/show, and server-authorized immutable export artifact requests. Repository context, tools, MCP, offline mode, operate mode, writes, direct artifact downloads, jobs, and external mutation remain unavailable.

Interactive line mode starts with `fai agent` or resumes with `fai agent resume <session-id>`. Use `/help` for the local command list. `/compact` clears only the latest local display projection; it does not change remote session context. Session and export output omits principal identity and download URLs. A requested export remains subject to server authorization and returns artifact identity/digest evidence only.

Explicit offline mode uses `fai agent --offline` for the deterministic capability report or `fai agent ask <query> --offline` for packaged Solution Play discovery. It imports no online host, performs no authentication, update, telemetry, MCP, pricing, model, or Agent FAI request, and never activates after a live failure unless the user invokes it explicitly. Output is labeled `profile: offline`, reports the packaged knowledge digest/source date/age/freshness and zero network attempts, and lists live model judgment, cloud state, pricing, readiness, and remote validation as unavailable. The packaged UAF status is truthfully Degraded with Designed readiness and zero Supported capabilities.

The reducer validates every event incrementally, enforces generated T006 stream semantics, and reproduces the T008 semantic state without retaining model content in state. T016 accepts only `startMode: "complete"`: the first event must be sequence 1 and include the complete session/turn lifecycle. A T015 host must replay from sequence 0 when attaching a renderer; suffix resume is not supported until a separately versioned checkpoint contract exists. Presentation content is capped at 2 MiB. Accepted events are capped at 100000, delivered events including duplicates at 200000, aggregate canonical event bytes at 16 MiB, individual events at 1 MiB, and each presentation collection at 1000 unique entries. Options may lower these limits but cannot raise them.

Render formats are `text`, `markdown`, `json`, `jsonl`, and append-only `tty`. `createRenderer(format, options)` owns its reducer: `renderEvent`, `renderEvents`, `finalize()`, and pure `renderResult(result)` always return frozen `{ stdout, stderr }` fragments. External finalized results cannot be mixed with internally reduced events. Structured formats never use color; TTY color requires an injected TTY capability, color enabled, and no `NO_COLOR` key. TTY model content is projected to stdout while status, progress, references, tools, warnings, and limitations use stderr. Human output is sanitized across chunks; JSONL preserves canonical event values as escaped JSON. The library does not host commands, open a network connection, or write to process streams.

The protocol client accepts only exact canonical HTTPS endpoints. Every public operation gets one absolute deadline (30 seconds by default) created before compatibility negotiation and shared by compatibility waiting, the protected request, retries, response reads, and every SSE reconnect. Compatibility is single-flight, but each caller keeps its own deadline and cancellation; a shorter caller never cancels negotiation for other callers. Ordinary retries are opt-in and capped at two. SSE reconnects are capped at two, clean EOF before a terminal event is reconnectable, and exhaustion returns `transport_failed`.

Stream execution identity is separate from per-connection HTTP correlation. Each HTTP response `X-Request-Id` must match that connection's generated request ID, while every event must retain the explicit execution request ID. Call turns as `streamTurnEvents(sessionId, turnId, { identity: { requestId } })`; call jobs as `streamJobEvents(jobId, { identity: { sessionId, turnId, requestId } })`. Reconnects send `Last-Event-ID` as the exact last accepted sequence and reject event identity drift. JSON responses are capped at 2 MiB. SSE streams are capped at 8 MiB, individual events at 1 MiB, and accepted events at 100000. Idempotency bindings use SHA-256 digests in a refresh-on-replay LRU capped at 1024 entries (configurable downward).

The production headless host pins `https://frootai.dev` and never reads an endpoint override from the environment. When an applicable proxy is configured, the embedding runtime must supply a compatible `proxyDispatcherFactory`; the zero-dependency CLI fails closed rather than silently bypassing a proxy because Node's built-in fetch exposes no portable proxy-agent constructor. The client rejects redirects, insecure endpoints, endpoint credentials/query strings, and TLS-disable behavior.

Proxy environment precedence is uppercase before lowercase: `HTTPS_PROXY`, `https_proxy`, then `HTTP_PROXY`, `http_proxy`; `NO_PROXY` takes precedence over `no_proxy`. Matching supports wildcard, exact host, domain suffix, optional port, IPv4, and bracketed IPv6 entries.

It does three jobs:

1. **Factory** — runs the build/validate/transform pipeline that turns the [101 solution plays](https://frootai.dev/solution-plays) and [863+ AI primitives](https://frootai.dev/primitives) (agents, skills, instructions, hooks, plugins) into a single canonical catalog (`.factory/fai-catalog.json`) and channel-specific bundles (`website-data/`, `marketplace/`, etc.).
2. **Scaffold** — creates new primitives from templates (agents, skills, instructions, hooks) with correct frontmatter, schema-valid metadata, and folder layout.
3. **Ship** — runs the gated release pipeline for one channel or all of them, with version-tag enforcement, registry pre-flight checks, and dry-run previews.

It is intended to be run **inside the `frootai-core` monorepo** (or any sibling repo that shares the `.factory/` and `solution-plays/` layout). It auto-detects the repo root by walking up from the current directory.

## Install

```bash
# Per-project (recommended)
npm install --save-dev frootai

# Global
npm install -g frootai

# Run without install
npx frootai factory status
```

The package installs **two binaries** — both invoke the same script:

| Binary | Use |
|--------|-----|
| `frootai` | Full name |
| `fai`     | Short alias |

## Requirements

- Node.js **18+** (uses `node:` built-ins and `child_process.spawn`)
- A working `frootai-core` checkout in `process.cwd()` or any ancestor

## Quick start

```bash
# 1. Health check — versions of every channel + catalog summary
fai version

# 2. Run the full factory pipeline (harvest → catalog → diff → transform → validate)
fai factory

# 3. Show the catalog dashboard
fai factory status

# 4. Live development — watch primitives and rebuild on change
fai factory watch
```

## Commands

### Factory (`frootai factory …`)

| Command | What it does |
|---------|--------------|
| `factory` | Full pipeline: harvest → catalog → diff → transform → validate |
| `factory status` | Print catalog summary + per-channel health table |
| `factory watch` | Watch primitives folder; rebuild catalog on every change |
| `factory ship <channel>` | Factory-gated release (validates before publishing) |
| `factory validate` | Run quality gates against the current catalog |
| `factory harvest` | Scan all primitive folders into `.factory/harvest.json` |
| `factory catalog` | Build `.factory/fai-catalog.json` from the harvest |
| `factory diff` | Compare current catalog to `.factory/fai-catalog.prev.json` |
| `factory transform` | Run all channel adapters (npm-mcp, vscode-extension, etc.) |

### Development

| Command | What it does |
|---------|--------------|
| `scaffold agent` | New agent (`.agent.md` with frontmatter) |
| `scaffold skill` | New skill (`<name>/SKILL.md` folder) |
| `scaffold instruction` | New instruction (`.instructions.md`) |
| `scaffold hook` | New hook (`<name>/hooks.json` + script) |
| `primitives` | List all primitives by type |
| `primitives --type agents` | Filter by type (`agents` \| `skills` \| `instructions` \| `hooks`) |
| `validate` | Run cross-repo consistency validation |
| `conformance [dir]` | **NEW** — Run [FAI Protocol L0 conformance](./conformance/README.md) (5 checks, ~0.12s, zero deps). Self-contained — works outside the monorepo. Flags: `--json`, `--quiet`, `--no-recursive`. Exit 0/1/2. |
| `lean <path.md>` | Compile Markdown to its lossless Lean form and report byte savings. |
| `install <id> --lean` | Install a fidelity-verified Lean primitive from the canonical source. |

### Product discovery

| Command | What it does |
|---------|--------------|
| `products` | Map every FrootAI product to its native CLI, CLI bridge, or web/MCP entry point. |
| `products --json` | Emit the same coverage catalog as stable machine-readable JSON. |
| `capabilities` | Inspect packaged command engines and their executable source evidence. |
| `capabilities --json` | Emit versioned backend capability evidence for automation. |

### Operator engines

| Command | What it does |
|---------|--------------|
| `engine --help` | Inspect the tested Harvest pipeline without replacing the Orchard catalog namespace. |
| `config get|set|list|path` | Manage privacy-safe local CLI configuration. |
| `docs list|show|generate` | Inspect or generate reference docs for Harvest engine commands. |
| `e2e list|show|run` | Inspect or run the 12 hermetic CLI scenarios. |
| `errors codes|demo|upload` | Inspect stable error semantics and support envelopes. |
| `update [--apply --yes]` | Check or update the published `frootai` npm package. |

### Orchard

| Command | What it does |
|---------|--------------|
| `orchard list` | Browse cross-cloud accelerators with variety, ripeness, and category filters. |
| `orchard search <query>` | Fuzzy-search accelerator names, taglines, technology, and categories. |
| `orchard show <slug>` | Inspect a full manifest, pollinations, and provenance. |
| `orchard install <slug>` | Plan and scaffold an accelerator install. |
| `orchard diff <slug> --play <id>` | Preview the free accelerator to paid Solution Play difference. |
| `orchard bushel add|remove|list` | Manage locally saved accelerators. |

### Release

| Command | What it does |
|---------|--------------|
| `ship <channel> [bump]` | Ship to one channel (`mcp` \| `ext` \| `sdk` \| `pymcp` \| `cli` \| `all`) |
| `release <channel>` | Alias for `ship` |
| `release --dry-run` | Preview release without publishing |

**Bump types:** `patch` (default), `minor`, `major`.

> **Versioning rule:** Local version must equal **last-published version + 1 patch**. The CLI enforces this against the live npm/PyPI/VSX registries before a `ship`. See `.internal/improvements/MASTER-IMPROVEMENT-PLAN.md` §2 in `frootai-core` for the full doctrine.

### Info

| Command | What it does |
|---------|--------------|
| `version` | Show CLI + channel versions + catalog summary |
| `help` | Show the built-in help screen |

## MCP federation (`frootai mcp …`)

The `mcp` subcommand group drives the FrootAI federation kernel from a shell.
See `frootai mcp --help` for the full subcommand list (8 commands: `list`,
`discover`, `attach`, `detach`, `trust`, `test`, `invoke`, `publish`).

### Shell completion

`frootai mcp` ships a generator for shell completion scripts. Bash lands at
M4.18; PowerShell at M4.19; Zsh at M4.20.

**Bash:**

```bash
# Current shell only (try before installing):
eval "$(frootai mcp --completion bash)"

# Persistent (per-user — append to your bashrc):
frootai mcp --completion bash >> ~/.bashrc
source ~/.bashrc

# Persistent (system-wide — requires sudo):
frootai mcp --completion bash | sudo tee /etc/bash_completion.d/frootai-mcp
```

After install, typing `frootai mcp <TAB>` completes the 8 subcommand names;
`frootai mcp trust <TAB>` completes `list / set / unset`; `frootai mcp trust
set <publisher> <TAB>` completes the four trust tier enum values; flag
completion is wired per subcommand (e.g. `frootai mcp discover --<TAB>`
offers `--json --no-color --tier --limit --refresh`).

**PowerShell** (PowerShell 7+ on any OS, Windows PowerShell 5.1 with PSReadLine):

```powershell
# Current session only (try before installing):
frootai mcp --completion powershell | Out-String | Invoke-Expression

# Persistent (per-user — append to your $PROFILE):
frootai mcp --completion powershell >> $PROFILE

# Locate your $PROFILE path:
$PROFILE | Select-Object -ExpandProperty FullName

# If $PROFILE doesn't exist yet, create the parent directory first:
New-Item -ItemType File -Path $PROFILE -Force

# Reload the profile in the current session:
. $PROFILE
```

The PowerShell completer registers against both `frootai` and `fai` via
`Register-ArgumentCompleter -Native`, so `<TAB>` works at the same
positions documented for bash above.

**Zsh:**

```zsh
# Current shell only (try before installing):
eval "$(frootai mcp --completion zsh)"

# Persistent (per-user — drop the script into your fpath):
mkdir -p ~/.config/zsh/completions
frootai mcp --completion zsh > ~/.config/zsh/completions/_frootai

# Then ensure ~/.zshrc loads completions from that directory:
# (paste these lines if they're not already there, then `source ~/.zshrc`)
#
#   fpath=(~/.config/zsh/completions $fpath)
#   autoload -Uz compinit && compinit
```

The zsh script is annotated with `#compdef frootai fai` so the completion
system picks it up automatically for both aliases. After `compinit` reloads,
`frootai mcp <TAB>` and `fai mcp <TAB>` complete at the same positions
documented for bash and PowerShell above.

## Environment variables

| Variable | Effect |
|----------|--------|
| `FROOTAI_PUBLIC_REPO` | Auto-set by the CLI to the resolved repo root; downstream scripts read it |
| `NPM_TOKEN` | Required by `factory ship mcp` and `factory ship cli` for `npm publish` |
| `PYPI_TOKEN` | Required by `factory ship pymcp` and `factory ship sdk` for `twine upload` |
| `VSCE_PAT` | Required by `factory ship ext` for `vsce publish` |
| `FROOTAI_DRY_RUN` | When `1`, every `ship` command performs `--dry-run` only |
| `FROOTAI_AUDIT_LOG` | Override the owner-only hash-chained operation audit path |
| `FROOTAI_APPROVE_EXTERNAL` | CI-only external mutation approval; requires `CI=true` |
| `FROOTAI_APPROVE_FORCE` | Additional CI-only approval for forced external mutation |

## Enterprise controls

- External mutation is fail-closed and requires explicit approval.
- `--force` requires a separate approval.
- Child release scripts require a recent, operation-bound, one-time audited token.
- `frootai audit verify` validates the local tamper-evident operation chain.
- `node cli/scripts/enterprise-gate.js` tests the exact packed artifact and emits release evidence.
- Packed command startup and aggregate execution budgets fail the release gate on regression.
- Tag pushes test and retain the exact tarball; explicit tag-bound workflow dispatch publishes it with the scoped npm automation token and verifies registry integrity.

See [SECURITY.md](./SECURITY.md) for the threat model and
[ENTERPRISE-OPERATIONS.md](./ENTERPRISE-OPERATIONS.md) for mandatory hosted
controls, release procedure, SLOs, rollback, and disaster recovery.

## How it finds the repo

`bin.js` walks upward from `process.cwd()` (max 10 levels) looking for **either**:

1. A `package.json` whose `name` is `frootai` and `private` is `true`, **or**
2. A folder containing `scripts/factory/index.js`.

If neither match, the current directory is used as the repo root.

## Channels managed by the CLI

| Channel ID | Folder | Registry / Surface | Publish workflow |
|------------|--------|--------------------|------------------|
| `mcp` | `npm-mcp/` | [`frootai-mcp` on npm](https://www.npmjs.com/package/frootai-mcp) | `.github/workflows/npm-publish.yml` |
| `cli` | `cli/` (this package) | [`frootai` on npm](https://www.npmjs.com/package/frootai) | `.github/workflows/npm-publish.yml` |
| `ext` | `vscode-extension/` | [`frootai.frootai-vscode` on VSX](https://marketplace.visualstudio.com/items?itemName=frootai.frootai-vscode) | `.github/workflows/vsce-publish.yml` |
| `pymcp` | `python-mcp/` | [`frootai-mcp` on PyPI](https://pypi.org/project/frootai-mcp/) | `.github/workflows/pypi-publish.yml` |
| `sdk` | `python-sdk/` | [`frootai` on PyPI](https://pypi.org/project/frootai/) | `.github/workflows/pypi-publish.yml` |
| `docker` | `npm-mcp/` (built into image) | `frootai/mcp` on Docker Hub | `.github/workflows/docker-publish.yml` |
| `foundry` | `foundry-agent/` | Azure AI Foundry endpoint | manual deploy |

## Examples

```bash
# Bootstrap a new agent
fai scaffold agent

# See what changed since the last catalog
fai factory diff

# Dry-run a full release across every channel
FROOTAI_DRY_RUN=1 fai ship all

# Ship just the VS Code extension with a patch bump
fai ship ext patch

# List every skill
fai primitives --type skills
```

## Troubleshooting

- **`Script not found: scripts/factory/index.js`** — you're not inside a `frootai-core` checkout. `cd` into one or set `FROOTAI_PUBLIC_REPO=<path>`.
- **`Version X.Y.Z already published`** — the CLI guards against re-publishing a version that already exists in the registry. Bump the version in the channel's `package.json` / `pyproject.toml` and try again.
- **`fatal: refusing to merge unrelated histories`** during `factory ship` — the workflow expects a clean linear tag history; rebase before retrying.

## Links

- 🌍 Website: <https://frootai.dev>
- 📚 Setup guide: <https://frootai.dev/setup-guide>
- 🎯 Solution plays: <https://frootai.dev/solution-plays>
- 🧬 FAI Protocol: <https://frootai.dev/protocol>
- 📦 Source: <https://github.com/frootai/frootai>
- 🐛 Issues: <https://github.com/frootai/frootai/issues>

## License

MIT — © 2026 FrootAI. See [LICENSE](https://github.com/frootai/frootai/blob/main/LICENSE).
