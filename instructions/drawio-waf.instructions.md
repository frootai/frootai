---
description: "Draw.io diagram standards — consistent styling, layers, export formats, and architecture diagram patterns."
applyTo: "**/*.drawio, **/*.drawio.svg"
waf:
  - "operational-excellence"
---

# Draw.io Diagrams — FAI Standards

## File Format & Version Control

- Use `.drawio.svg` for diagrams checked into git — renders inline on GitHub and supports diff
- Use `.drawio` (XML) only for complex multi-page diagrams where SVG embedding is impractical
- Add `<!-- version: 1.2 | author: team | date: 2026-04-13 -->` comment in diagram metadata
- Never commit exported PNG/PDF — generate from CI or on demand
- Keep diagram XML compressed (`compressed="true"` attribute on `<mxfile>`)

## Color Palette

Use consistent hex colors across all architecture diagrams:

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Azure service | Azure Blue | `#0078D4` | All Azure resource shapes |
| Compute | Teal | `#008272` | VMs, AKS, Container Apps, Functions |
| Data / Storage | Dark Blue | `#002050` | Cosmos DB, SQL, Storage, Redis |
| AI / Cognitive | Purple | `#7719AA` | OpenAI, AI Search, Doc Intel |
| Networking | Gray | `#505050` | VNets, NSGs, Load Balancers, APIM |
| Security boundary | Red dashed | `#D13438` | Trust boundaries, private endpoints |
| User / External | Green | `#107C10` | End users, external systems, SaaS |
| Highlight / Focus | Orange | `#FF8C00` | Call-outs, current-state markers |

Background: `#FFFFFF` (light) or `#1B1A19` (dark theme). Never use bright background colors.

## Typography

- **Title**: 16pt, bold, `#333333`
- **Shape label**: 11pt, regular, `#333333`
- **Annotation / note**: 9pt, italic, `#666666`
- **Legend text**: 10pt, regular
- Font family: `Segoe UI` (Windows) or `Helvetica` (Mac/Linux)
- Never mix font sizes arbitrarily — use only the four tiers above

## Shape & Connection Standards

- Connection routing: **Orthogonal** (`edgeStyle=orthogonalEdgeStyle`) — never freeform curves
- Line width: `2` for primary flows, `1` for secondary, `strokeDasharray` for optional paths
- Arrow style: solid filled for data flow, open triangle for dependency/reference
- Rounded corners on containers (`rounded=1;arcSize=10`)
- Fixed shape sizes per type: services `120x80`, icons `48x48`, containers `min 200x150`
- Snap to grid (`gridSize=10`) — never disable grid alignment

```xml
<!-- Standard orthogonal edge -->
<mxCell edge="1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeWidth=2;
  strokeColor=#0078D4;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" />

<!-- Security boundary container -->
<mxCell style="rounded=1;arcSize=10;dashed=1;dashPattern=8 4;
  strokeColor=#D13438;strokeWidth=2;fillColor=none;fontSize=11;" />
```

## Layer Organization

Every architecture diagram must use these layers (bottom to top):

1. **Background** — grid, title block, legend, document metadata
2. **Infrastructure** — VNets, subnets, regions, availability zones, private endpoints
3. **Platform Services** — Azure PaaS (App Service, Container Apps, Functions, APIM)
4. **Data** — databases, storage accounts, caches, message queues
5. **Application** — custom code, APIs, microservices, agent orchestration
6. **AI / Model** — OpenAI deployments, AI Search indexes, embeddings, vector stores
7. **Users / External** — end users, external APIs, SaaS integrations

Lock lower layers when editing upper layers. Name layers descriptively — never "Layer 1".

## Page Naming

- Page 1: `Overview` — high-level system context (C4 Level 1)
- Page 2: `Container` — service decomposition (C4 Level 2)
- Page 3: `Data Flow` — request lifecycle with numbered steps
- Page 4: `Networking` — VNets, subnets, private endpoints, NSGs
- Page 5+: domain-specific detail pages as needed

Prefix page names with sequence numbers: `01-Overview`, `02-Container`, `03-Data-Flow`.

## Azure Icon Library

- Use official Microsoft Azure icon set: **Azure Architecture Icons** (search "azure" in draw.io shape library)
- Enable library: Edit → Libraries → Azure / Azure 2
- Prefer 48×48 px service icons placed inside labeled containers
- Never use generic rectangles for Azure services when official icons exist
- Group related services in a dashed container labeled with the resource group name

## C4 Model Conventions

- **Level 1 (Context)**: system as single box, external actors around it, max 6-8 elements
- **Level 2 (Container)**: internal services, databases, queues — show tech stack in subtitle
- **Level 3 (Component)**: only for complex services needing internal breakdown
- Use C4 shape library or consistent rectangle styling with `<<stereotype>>` labels
- Every element needs: name (bold), technology (italic), and one-line description

```
┌─────────────────────────────┐
│  <<Container>>              │
│  API Gateway                │
│  [Azure APIM]               │
│  Routes and rate-limits     │
│  all inbound API traffic    │
└─────────────────────────────┘
```

## Metadata & Labels

- Every diagram must have a **title block** (top-left): diagram name, version, last updated, author
- Every data flow arrow must have a **label**: protocol, data type, or step number
- Add a **legend** (bottom-right) explaining colors, line styles, and shape meanings
- Tag shapes with `tooltip` metadata for interactive SVG hover text
- Number request flow steps sequentially: `①`, `②`, `③` — placed on or near arrows

## Export Formats

| Format | Use Case | Settings |
|--------|----------|----------|
| SVG | Documentation, README, wiki | Transparent bg, include diagram data, border=10 |
| PNG | Slide decks, presentations | White bg, 2x scale, border=20 |
| PDF | Print-ready architecture docs | Page-fit, include all pages |
| `.drawio.svg` | Git-tracked source of truth | Editable + renderable in one file |

Never export at 1x scale for presentations — always 2x or 3x for clarity.

## Preferred Patterns

- ✅ One concept per page — split complex systems across multiple pages
- ✅ Numbered data flow steps on arrows (e.g., `① POST /chat` → `② Embed query`)
- ✅ Grouped Azure resources inside resource group containers
- ✅ Legend on every page explaining colors and line styles
- ✅ Consistent left-to-right or top-to-bottom flow direction per page
- ✅ Security boundaries drawn as red dashed containers around trust zones
- ✅ Template page (`00-Template`) with pre-set styles, colors, and legend

## Anti-Patterns

- ❌ **>15 elements per page** — decompose into sub-diagrams or C4 levels
- ❌ **Inconsistent colors** — mixing arbitrary hex values instead of the standard palette
- ❌ **No legend** — readers cannot decode line styles or color meanings
- ❌ **Freeform connections** — use orthogonal routing, never hand-drawn curves
- ❌ **Unlabeled arrows** — every connection must state what flows through it
- ❌ **Generic rectangles for Azure services** — use official Azure icons
- ❌ **Mixing flow directions** — pick LTR or TTB per page, not both
- ❌ **Invisible layers left on** — hidden elements that confuse exports
- ❌ **Committed PNGs as source** — always commit `.drawio` or `.drawio.svg`
- ❌ **Giant single-page diagram** — if you need to zoom to read labels, split it

## WAF Alignment

| WAF Pillar | Diagram Standard |
|------------|-----------------|
| **Operational Excellence** | Version-controlled `.drawio.svg`, CI-exported artifacts, template pages, consistent naming |
| **Security** | Red-dashed trust boundaries, private endpoint callouts, identity flow arrows labeled |
| **Reliability** | Redundancy shown (multi-region, failover arrows), health probe indicators |
| **Cost Optimization** | SKU annotations on shapes, PTU vs PAYG labels, right-sizing notes in tooltips |
| **Performance Efficiency** | Latency annotations on arrows (ms), caching layers highlighted, async flow markers |
| **Responsible AI** | Content Safety integration shown, human-in-the-loop decision points marked |
