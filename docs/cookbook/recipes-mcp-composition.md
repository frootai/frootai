# Authoring an MCP Composition Recipe

> The canonical template + checklist for Phase X8 **cross-server composition
> recipes** — workflows that attach **2 or more** marketplace MCP servers into a
> single FrootAI play. This guide defines the required section structure every
> recipe under [`frootai/cookbook/`](../../cookbook/) must follow so they render
> consistently on the marketplace detail pages and pass the nightly CI.

A composition recipe is not a single-server how-to. Its value is the
**federation**: no one server does the job, and the recipe shows the kernel
chaining areas (e.g. Markitdown → Context7 → Tavily) into one task. The three
Phase X4 preview recipes — [`24-research-to-notion.md`](../../cookbook/24-research-to-notion.md),
[`25-web-to-vector-rag.md`](../../cookbook/25-web-to-vector-rag.md), and
[`26-vector-memory-bakeoff.md`](../../cookbook/26-vector-memory-bakeoff.md) —
are the reference implementations of this format.

## When is a recipe a "composition"?

- It attaches **≥ 2** marketplace MCP servers via `mcp_scope.attached`.
- Each server plays a **distinct role** in the loop (retrieval, transform,
  durable output, notification, …) — not two interchangeable servers doing the
  same thing (a *bake-off* is the one exception, and it says so).
- The output of one server feeds the input of the next; the agent orchestrates
  the hand-offs.

## Required section structure

Every recipe markdown file MUST contain these sections, in this order. The
nightly `cookbook-composition.yml` CI and the per-row smoke gates assert their
presence.

### 1. Title + composed-servers summary

```markdown
# Recipe NN: <Human Title> (<Server A> + <Server B> + <Server C>)

> One-sentence blockquote naming each server in **bold** and the task they
> jointly accomplish.
```

### 2. Goal

A short **Goal** statement: the single outcome a reader gets by running the
recipe. One paragraph, no fluff. State *why composition* — what no single server
could do alone.

### 3. Areas attached

A trust table listing every attached server, its trust tier, and its role in the
loop:

```markdown
| Server | Trust | Role in the loop |
|--------|-------|------------------|
| `context7`  | verified-publisher | Grounded, version-correct library docs |
| `tavily-ai` | verified-publisher | Fresh web context + citations |
| `notion`    | verified-publisher | Durable, shareable output surface |
```

The slugs MUST match the marketplace spec slugs under
[`frootai/orchard/registry/mcp-specs/`](../../orchard/registry/mcp-specs/). The
trust tier MUST match each spec's manifest tier.

### 4. Steps

Numbered steps that walk from an empty play to a working run. The first step is
always the **`mcp_scope.attached` declaration** (see §7). Each step shows the
exact command or code. Credentials are read from the environment — never inline
in args.

### 5. Sample output

A realistic excerpt of what the agent produces, captured from an actual run and
mirrored byte-for-byte into the per-recipe
`cookbook/recipes-mcp-composition/<recipe>/sample-output.md` (X8.13).

### 6. Cost estimate

A monthly cost estimate assuming **100 invocations/month**, broken down per
upstream server (token cost + any per-call API fees), with the total. This feeds
the recipe's README cost badge (X8.17). Be explicit about which costs are
FrootAI-side (model tokens) vs. third-party (the upstream server's own API).

### 7. The `mcp_scope.attached` snippet

A copy-pasteable play frontmatter block (X8.14) the reader can drop into their
own `agent.md`:

```yaml
---
description: "<one line>"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["serverA", "serverB", "serverC"]
  router_config:
    detach_on_finish: true
---
```

### 8. Security note

An explicit list of every credential + scope each upstream server requires
(X8.18): which env var, what permission level, and the blast radius if leaked.
Call out any server whose trust tier is below `verified-publisher`.

## Per-recipe companion assets

Beyond the markdown, each recipe ships a folder under
`cookbook/recipes-mcp-composition/<recipe>/`:

| File | Row | Purpose |
|------|-----|---------|
| `run.mjs` | X8.12 | A reproducible, end-to-end runnable script (fake upstreams allowed for CI) |
| `sample-output.md` | X8.13 | The committed sample output referenced in §5 |
| `evaluation/mcp-composition-<n>.md` | X8.20 | An eval check asserting the run still produces valid output |

## Authoring checklist

- [ ] Title names every composed server; blockquote summarizes the task.
- [ ] **Goal**, **Areas attached** (trust table), **Steps**, **Sample output**,
      and **Cost estimate** sections are all present and in order.
- [ ] Attaches ≥ 2 servers; every slug matches a marketplace spec.
- [ ] `mcp_scope.attached` snippet is copy-pasteable.
- [ ] Security note lists every credential + scope.
- [ ] Companion `run.mjs` + `sample-output.md` committed and reproducible on a
      fresh CI runner.
- [ ] Registered in [`frootai/cookbook/README.md`](../../cookbook/README.md) and
      in `frootai.dev/public/data/cookbook.json`.
- [ ] Surfaces on each participating spec's detail page via the recipe-links
      builder (X8.16).

## Numbering

Cookbook slots `01`–`27` are taken (`17`/`18` are free gaps). New composition
recipes claim the next free numbers (`28`+). Verify against the directory
listing before claiming a number — do **not** reuse `24`–`27`, which belong to
the Phase X4 preview recipes and the spec-submission walkthrough.
