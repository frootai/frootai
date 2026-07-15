// @ts-check
// [X8.12] Runnable companion to cookbook/33-elastic-log-analysis.md.
// Offline: drives the query→ground→remediate loop against fake areas.
import { runRecipe } from "../_harness.mjs";

runRecipe({
  id: "33-elastic-log-analysis",
  title: "Elastic Log Analysis",
  attached: ["elastic", "context7", "ms-learn"],
  steps: ({ areas, emit }) => {
    const hits = areas.elastic.search({ q: 'status:504 AND path:"/checkout"' });
    emit(`elastic: ${hits.ok ? "1240 hits" : "—"} for 504 spike`);
    const doc = areas.context7.get_library_docs({ library: "azure/cosmos", topic: "requestTimeout" });
    emit(`grounded root cause via context7 (${doc.ok ? "ok" : "—"})`);
    const fix = areas["ms-learn"].microsoft_docs_search({ q: "cosmos sdk retry timeout tuning" });
    emit(`remediation guidance via ms-learn (${fix.ok ? "ok" : "—"})`);
    emit("RESULT: root-cause + remediation report emitted");
  },
});
