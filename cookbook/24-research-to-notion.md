# Recipe 24: Research-to-Notion Workflow (Context7 + Tavily + Notion)

> Compose three verified-publisher MCP servers into one research loop: pull
> up-to-date library docs with **Context7**, search the live web with **Tavily**,
> and write the synthesized findings into a **Notion** page — all from a single
> FrootAI play.

## What You'll Build

A solution play whose agent attaches three MCP servers and runs a
**research → synthesize → publish** loop:

1. **Context7** resolves authoritative, version-pinned documentation for the
   libraries in scope (no hallucinated APIs).
2. **Tavily** searches the open web for recent context Context7 doesn't cover
   (release notes, blog posts, benchmarks).
3. **Notion** persists the agent's write-up as a structured page your team can
   read and comment on.

This is the canonical "composition recipe" — no single server does the job;
the value is in the federation.

## Why Compose These Three?

| Server | Trust | Role in the loop |
|--------|-------|------------------|
| `context7` | verified-publisher | Grounded, version-correct library docs |
| `tavily-ai` | verified-publisher | Fresh web context + citations |
| `notion` | verified-publisher | Durable, shareable output surface |

Context7 + Tavily cover *retrieval* (closed-corpus docs + open web); Notion
covers *durable output*. The agent decides which retriever to call per
sub-question and writes one consolidated page at the end.

## Prerequisites

- FrootAI repo cloned, an existing or new play under `frootai/solution-plays/`
- A Context7 API key, a Tavily API key, and a Notion integration token
- The marketplace attach specs for all three (see
  `frootai/orchard/registry/mcp-specs/{context7,tavily-ai,notion}.json`)

## Step 1 — Declare the MCP scope on the play

In the play's `agent.md` frontmatter, attach all three servers so the engine
wires them before the first turn:

```yaml
---
description: "Research assistant that documents findings into Notion"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["context7", "tavily-ai", "notion"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Provide credentials

Each server reads its credential from the environment (never inline in args —
doctrine #6):

```bash
export CONTEXT7_API_KEY="ctx7-..."
export TAVILY_API_KEY="tvly-..."
export NOTION_TOKEN="ntn_..."
```

## Step 3 — The research loop (agent prompt sketch)

```text
For each sub-question:
  1. Call context7.resolve-library-id + context7.get-library-docs for any
     library named in the question.
  2. If the docs are stale or the question is about ecosystem/news, call
     tavily-ai.tavily-search and keep the top 3 citations.
  3. Synthesize a short, cited answer.
Finally:
  - Call notion.create-a-page (or append blocks) with the consolidated
    write-up, one H2 per sub-question, citations as a bullet list.
```

## Step 4 — Validate the attach plan

```bash
cd frootai-core
node scripts/marketplace/validate-spec.smoke.test.js   # specs are well-formed
# Trust: all three are verified-publisher → attach without prompt,
# destructive tools (e.g. notion delete-a-block) still confirm per call.
```

## Step 5 — Run it

Activate the play; the engine merges the `mcp_scope.attached` list, attaches
Context7 + Tavily + Notion, and the agent runs the loop. The output is a Notion
page you can share.

## Notes

- **Trust posture**: all three are verified-publisher — they attach silently,
  but Notion's `delete-a-block` (and any other destructive tool) still prompts
  per call under `allowDestructive: false`.
- **Swap-ins**: replace Tavily with **Firecrawl** for deep crawls, or add
  **Qdrant**/**Pinecone** to cache embeddings of what you retrieved (see
  Recipe 25).
