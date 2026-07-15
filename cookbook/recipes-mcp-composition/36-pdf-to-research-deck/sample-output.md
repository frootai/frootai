# Sample output — PDF to Research Deck

> Captured from `node run.mjs` (offline harness — fake areas, no network or
> secrets). Reproducible on a fresh CI runner. See
> [the recipe](../../36-pdf-to-research-deck.md) for the illustrative live-run
> output (the cited research summary).

```text
# PDF to Research Deck (36-pdf-to-research-deck)
attached: markitdown, context7, tavily-ai
tool calls: 3
converted source.pdf → markdown (ok)
grounded claim via context7 (ok)
enriched with web search (2 citations)
RESULT: cited research summary emitted (2 themes)
RESULT: OK
```
