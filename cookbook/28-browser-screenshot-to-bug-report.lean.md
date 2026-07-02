# Recipe 28: Browser Screenshot to Bug Report (Playwright + Markitdown + GitHub)

> Compose three MCP servers into one triage pipeline: capture a misbehaving
> page's state with **Playwright** (screenshot + DOM snapshot + console errors),
> distill it into a clean Markdown summary with **Markitdown**, and file a
> structured issue with **GitHub** — turning a flaky repro into a ready-to-triage
> bug report from one FrootAI play.

## What You'll Build

A solution play whose agent attaches three MCP servers and runs a
**capture → summarize → file** pipeline:

1. **Playwright** drives a real browser to the failing URL, captures a
   screenshot, the accessibility/DOM snapshot, and any console errors.
2. **Markitdown** converts the captured HTML/snapshot into clean Markdown so the
   agent can summarize the failure without parsing raw markup.
3. **GitHub** opens an issue with the summary, the reproduction steps, and the
   captured evidence linked.

This is a canonical composition recipe — no single server does the job; the
value is in the federation.

## Goal

Turn a **browser repro into a filed bug report** in one play run: the agent
visits the failing page, captures its visual + structural state, summarizes what
went wrong, and opens a GitHub issue ready for triage. No single server can do
this — Playwright can't file issues, Markitdown can't drive a browser, GitHub
can't see the rendered page.

## Areas attached

| Server | Trust | Role in the loop |
|--------|-------|------------------|
| `playwright` | first-party-ms | Drive the browser; capture screenshot + DOM + console |
| `markitdown` | first-party-ms | Convert the captured HTML/snapshot → Markdown summary |
| `github` | first-party-ms | Open the issue with the summary + evidence |

Playwright handles *capture* (page → artifacts), Markitdown handles *summarize*
(markup → readable text), GitHub handles *file* (text → tracked issue). The
agent decides what to capture, distills it, and files once.

The slugs match the marketplace specs under
[`frootai/orchard/registry/mcp-specs/{playwright,markitdown,github}.json`](../orchard/registry/mcp-specs/).

## Prerequisites

- FrootAI repo cloned; an existing or new play under `frootai/solution-plays/`.
- A GitHub token with `issues:write` on the target repo. Playwright and
  Markitdown run locally and need no credential.

## Step 1 — Declare the MCP scope on the play

In the play's `agent.md` frontmatter, attach all three servers so the engine
wires them before the first turn:

```yaml
---
description: "Capture a browser failure and open a triage-ready GitHub issue"
tools: ["terminal", "file", "search"]
mcp_scope:
  attached: ["playwright", "markitdown", "github"]
  router_config:
    detach_on_finish: true
---
```

## Step 2 — Provide credentials

Each server reads its credential from the environment (never inline in args —
doctrine #6). Playwright and Markitdown need none:

```bash
export GITHUB_TOKEN="ghp_..."   # issues:write on the target repo
```

## Step 3 — The triage loop (agent prompt sketch)

```text
1. Call playwright.navigate to the failing URL; reproduce the trigger.
2. Capture: playwright.screenshot + the DOM/accessibility snapshot +
   any console errors.
3. Call markitdown.convert_to_markdown on the captured HTML/snapshot →
   a readable Markdown excerpt of the relevant region.
4. Summarize: what was expected, what happened, the console errors, the
   reproduction steps.
Finally:
  - Call github.create-issue with a titled summary, repro steps, the console
    error block, and a link to the screenshot.
```

## Step 4 — Validate the attach plan

```bash
cd frootai-core
node scripts/marketplace/validate-spec.smoke.test.js   # specs are well-formed
# Trust: all three are first-party-ms → attach without prompt; github's
# create-issue is a write, still confirmed per call under allowDestructive.
```

## Step 5 — Run it

Activate the play; the engine merges the `mcp_scope.attached` list, attaches
Playwright + Markitdown + GitHub, and the agent runs the pipeline. The output is
a filed GitHub issue you can link your team to.

## Sample output

```markdown
# Issue opened: #482 — "Checkout button unresponsive on /cart (Safari)"

**Expected:** Clicking "Checkout" navigates to /payment.
**Actual:** Button click is a no-op; no navigation.

**Console errors**
- TypeError: cart.total is undefined (cart.js:114)

**Repro steps**
1. Add any item to the cart
2. Open /cart
3. Click "Checkout"

Screenshot + DOM snapshot attached. Captured at 2026-06-28T10:14Z.
```

> The full sample is committed at
> [`recipes-mcp-composition/28-browser-screenshot-to-bug-report/sample-output.md`](./recipes-mcp-composition/28-browser-screenshot-to-bug-report/sample-output.md)
> (added in [X8.13]).

## Cost estimate

Assuming **100 invocations/month**, one page capture + one issue per run:

| Cost source | Per run | × 100/mo |
|-------------|---------|----------|
| Playwright (local browser) | $0.00 | $0.00 |
| Markitdown (local convert) | $0.00 | $0.00 |
| GitHub create-issue (~2 calls) | $0.00 (token quota) | $0.00 |
| Model tokens (capture analysis + summary, ~6k in / 1k out) | ~$0.03 | ~$3.00 |
| **Total** | **~$0.03** | **~$3.00 / mo** |

FrootAI-side cost is model tokens only; all three servers run against local
processes or token-metered APIs with no marginal per-run charge at this volume.

## The `mcp_scope.attached` snippet

Copy this into your own play's `agent.md` frontmatter:

```yaml
mcp_scope:
  attached: ["playwright", "markitdown", "github"]
  router_config:
    detach_on_finish: true
```

## Open in Studio

Launch this recipe in the [FrootAI Studio builder](https://studio.frootai.dev/builder?recipe=28-browser-screenshot-to-bug-report&areas=playwright,markitdown,github&prompt=Visit%20the%20failing%20page%2C%20capture%20a%20screenshot%2C%20DOM%20snapshot%2C%20and%20console%20errors%2C%20summarize%20what%20went%20wrong%2C%20and%20open%20a%20triage-ready%20GitHub%20issue.) — the deep link
pre-fills the agent prompt and surfaces the recipe's `mcp_scope` areas
(`playwright`, `markitdown`, `github`) so you start from the recipe instead of a blank canvas:

[**▶ Open in Studio**](https://studio.frootai.dev/builder?recipe=28-browser-screenshot-to-bug-report&areas=playwright,markitdown,github&prompt=Visit%20the%20failing%20page%2C%20capture%20a%20screenshot%2C%20DOM%20snapshot%2C%20and%20console%20errors%2C%20summarize%20what%20went%20wrong%2C%20and%20open%20a%20triage-ready%20GitHub%20issue.)

## Security note

| Server | Credential | Scope | Blast radius if leaked |
|--------|-----------|-------|------------------------|
| `playwright` | none | local browser automation | drives a browser on the runner only |
| `markitdown` | none | local file/URI read | reads only the captured artifact |
| `github` | `GITHUB_TOKEN` | `issues:write` | can open/edit issues on the scoped repo |

All three are `first-party-ms`. Scope the GitHub token to **`issues:write` on a
single repo** — it never needs code or admin access. Keep it in the environment,
never in the play manifest or args. Playwright navigates to whatever URL you give
it — only point it at pages you control or are authorized to test.

## Notes

- **Auth'd pages**: have Playwright reuse a stored session/state file to capture
  behind a login, rather than embedding credentials in the prompt.
- **Swap-ins**: replace GitHub with **Notion** (see
  [Recipe 24](./24-research-to-notion.md)) to file the report into a doc instead
  of an issue tracker.
