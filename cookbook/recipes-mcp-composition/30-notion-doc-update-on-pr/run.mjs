// @ts-check
// [X8.12] Runnable companion to cookbook/30-notion-doc-update-on-pr.md.
// Offline: drives the detect→mirror→reconcile loop against fake areas.
import { runRecipe } from "../_harness.mjs";

runRecipe({
  id: "30-notion-doc-update-on-pr",
  title: "Notion Doc Update on PR",
  attached: ["github", "notion", "stripe"],
  steps: ({ areas, emit }) => {
    const pr = areas.github.read_pull_request({ number: 318 });
    const changed = [
      { path: "docs/pricing.md", pricing: true },
      { path: "docs/faq.md", pricing: false },
    ];
    emit(`PR #${pr.ok ? 318 : "?"} merged: ${changed.length} changed docs`);
    for (const doc of changed) {
      areas.notion.update_page({ path: doc.path });
      emit(`mirrored ${doc.path} → Notion`);
      if (doc.pricing) {
        areas.stripe.create_product({ name: "Pro", priceUsd: 39 });
        emit(`stripe reconciled: Pro price → $39 (test mode)`);
      }
    }
  },
});
