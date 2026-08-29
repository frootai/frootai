# FrootAI website → VS Code visual reference

Captured from `https://www.frootai.dev` on 2026-08-28 at 1440 × 1000. The PNGs in `website-2026-08-28/` are design references, not runtime dependencies and not embedded web pages.

## Shared website language

- warm paper/grid canvas with thin neutral borders;
- black, high-weight product typography and compact monospace eyebrows;
- emerald primary actions with cyan, amber, violet, and pink stage accents;
- square cards and controls rather than floating rounded glass cards;
- dense status/evidence rows and explicit handoffs;
- five delivery stages: Discover, Define, Develop, Govern, Verify & improve.

## Route mapping

| Website reference | VS Code surface | Native action |
|---|---|---|
| `home.png` | `ProductSystemHome` | Product system, stages, handoffs, directory |
| `agent-fai.png` | `AgentFai` | Streaming assistant and native panel links |
| `solution-accelerator.png` | Home external handoff | Solution Accelerator catalog |
| `configurator.png` | `Configurator` | Outcome-to-Play recommendation |
| `solution-plays.png` | `PlayBrowser` / `PlayDetail` | Search, inspect, scaffold |
| `primitives.png` | `PrimitivesCatalog` | Agents, skills, instructions, hooks, plugins |
| `mcp.png` | `McpExplorer` / `FederationExplorer` | Tool discovery and federation |
| `orchard.png` | Home external handoff | Governed source conversion |
| `engine.png` | `ProtocolExplainer` | Engine and protocol internals |
| `lab.png` | Home external handoff | Evaluation research |
| `lean.png` | Home external handoff | Fidelity-aware compaction |
| `vscode.png` | Entire extension | Native product distribution |

## Implementation rule

The extension shares the website’s hierarchy, vocabulary, spacing, borders, and stage colors while retaining VS Code theme variables, keyboard focus, high contrast, reduced motion, and extension-host-owned privileged actions. Website pages are never iframed into the workbench.
