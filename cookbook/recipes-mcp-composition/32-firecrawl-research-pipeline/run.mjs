// @ts-check
// [X8.12] Runnable companion to cookbook/32-firecrawl-research-pipeline.md.
// Offline: drives the crawl→broaden→ground→synthesize loop against fake areas.
import { runRecipe } from "../_harness.mjs";

runRecipe({
  id: "32-firecrawl-research-pipeline",
  title: "Firecrawl Research Pipeline",
  attached: ["firecrawl", "tavily-ai", "context7"],
  steps: ({ areas, emit }) => {
    const seeds = ["vendor-a.test/benchmarks", "vendor-b.test/latency"];
    for (const url of seeds) areas.firecrawl.firecrawl_scrape({ url });
    emit(`crawled ${seeds.length} seed sites`);
    const search = areas["tavily-ai"].tavily_search({ q: "edge vector db pricing 2026" });
    emit(`web search (${search.ok ? "3 citations" : "—"})`);
    const docId = areas.context7.get_library_docs({ library: "qdrant" });
    emit(`grounded client API claim via context7 (${docId.ok ? "ok" : "—"})`);
    emit("RESULT: research brief synthesized (2 themes, 6 sources)");
  },
});
