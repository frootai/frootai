// @ts-check
// [X8.12] Runnable companion to cookbook/31-multi-cloud-cost-report.md.
// Offline: drives the fetch→join→report loop against fake areas.
import { runRecipe } from "../_harness.mjs";

runRecipe({
  id: "31-multi-cloud-cost-report",
  title: "Multi-Cloud Cost Report",
  attached: ["azure", "mongodb"],
  steps: ({ areas, emit }) => {
    const live = areas.azure.cost_management({ period: "2026-06" });
    const history = areas.mongodb.aggregate({ collection: "cost_snapshots", periods: 6 });
    emit(`live spend fetched (${live.ok ? "ok" : "—"}); history aggregated (${history.ok ? "ok" : "—"})`);
    const groups = [
      { name: "Azure OpenAI", now: 4100, mean: 2970 },
      { name: "Storage", now: 2030, mean: 2110 },
    ];
    let anomalies = 0;
    for (const g of groups) {
      const delta = (g.now - g.mean) / g.mean;
      const anomaly = delta > 0.25;
      if (anomaly) anomalies++;
      emit(`${g.name}: $${g.now} (${(delta * 100).toFixed(0)}% vs trailing mean)${anomaly ? " ⚠️ anomaly" : ""}`);
    }
    emit(`RESULT: ${anomalies} anomaly(ies) flagged`);
  },
});
