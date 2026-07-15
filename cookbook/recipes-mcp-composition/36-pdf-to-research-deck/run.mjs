// @ts-check
// [X8.12] Runnable companion to cookbook/36-pdf-to-research-deck.md.
// Offline: drives the ingest→ground→enrich→summarize loop against fake areas.
import { runRecipe } from "../_harness.mjs";

runRecipe({
  id: "36-pdf-to-research-deck",
  title: "PDF to Research Deck",
  attached: ["markitdown", "context7", "tavily-ai"],
  steps: ({ areas, emit }) => {
    const md = areas.markitdown.convert_to_markdown({ uri: "source.pdf" });
    emit(`converted source.pdf → markdown (${md.ok ? "ok" : "—"})`);
    const doc = areas.context7.get_library_docs({ library: "vllm", topic: "kv-cache offload" });
    emit(`grounded claim via context7 (${doc.ok ? "ok" : "—"})`);
    const web = areas["tavily-ai"].tavily_search({ q: "webgpu llm runtimes 2026" });
    emit(`enriched with web search (${web.ok ? "2 citations" : "—"})`);
    emit("RESULT: cited research summary emitted (2 themes)");
  },
});
