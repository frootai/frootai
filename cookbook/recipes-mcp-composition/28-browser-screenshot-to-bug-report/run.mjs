// @ts-check
// [X8.12] Runnable companion to cookbook/28-browser-screenshot-to-bug-report.md.
// Offline: drives the capture→summarize→file loop against fake areas.
import { runRecipe } from "../_harness.mjs";

runRecipe({
  id: "28-browser-screenshot-to-bug-report",
  title: "Browser Screenshot to Bug Report",
  attached: ["playwright", "markitdown", "github"],
  steps: ({ areas, emit }) => {
    const url = "https://example.test/cart";
    areas.playwright.navigate({ url });
    const shot = areas.playwright.screenshot({ url });
    const snapshot = areas.playwright.snapshot({ url });
    emit(`captured ${url}: screenshot + DOM snapshot + console`);
    const summary = areas.markitdown.convert_to_markdown({ html: snapshot.args });
    emit(`summarized failure via markitdown (${typeof summary})`);
    const issue = areas.github.create_issue({
      title: "Checkout button unresponsive on /cart",
      body: "Expected navigation; got no-op. Console: TypeError cart.total undefined.",
    });
    emit(`opened issue: ${issue.ok ? "#482" : "ERR"}`);
  },
});
