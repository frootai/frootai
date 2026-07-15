// @ts-check
// [X8.25] Runnable companion to cookbook/38-competitor-pricing-tracker.md.
// Sample 11th recipe — prototypes the community contribution workflow.
// Offline: drives the crawl→persist→diff→publish loop against fake areas.
import { runRecipe } from "../_harness.mjs";

runRecipe({
  id: "38-competitor-pricing-tracker",
  title: "Competitor Pricing Tracker",
  attached: ["firecrawl", "mongodb", "notion"],
  steps: ({ areas, emit }) => {
    const pages = ["vendor-a.test/pricing", "vendor-b.test/pricing", "vendor-c.test/pricing"];
    for (const url of pages) areas.firecrawl.firecrawl_scrape({ url });
    emit(`crawled ${pages.length} competitor pricing pages`);
    areas.mongodb.insert_many({ collection: "pricing_snapshots", docs: pages.length });
    emit("persisted 3 pricing snapshots to MongoDB");
    const prior = areas.mongodb.find({ collection: "pricing_snapshots", limit: 3 });
    emit(`loaded prior snapshots for diff (${prior.ok ? "3 found" : "—"})`);
    areas.notion.create_page({ title: "Weekly competitor pricing digest" });
    emit("published pricing digest to Notion");
    emit("RESULT: pricing digest published (3 vendors, 1 price change flagged)");
  },
});
