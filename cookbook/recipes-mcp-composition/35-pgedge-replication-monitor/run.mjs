// @ts-check
// [X8.12] Runnable companion to cookbook/35-pgedge-replication-monitor.md.
// Offline: drives the measure→correlate→report loop against fake areas.
import { runRecipe } from "../_harness.mjs";

runRecipe({
  id: "35-pgedge-replication-monitor",
  title: "pgEdge Replication Monitor",
  attached: ["pgedge", "elastic"],
  steps: ({ areas, emit }) => {
    const state = areas.pgedge.query_database({ sql: "SELECT * FROM pg_stat_replication" });
    emit(`pgedge: replication state read (${state.ok ? "3 nodes" : "—"})`);
    const nodes = [
      { node: "n1", lagS: 0 },
      { node: "n2", lagS: 0.4 },
      { node: "n3", lagS: 42 },
    ];
    let flagged = 0;
    for (const n of nodes) {
      const lagging = n.lagS > 5;
      if (lagging) {
        areas.elastic.search({ q: `node:${n.node} "apply conflict"` });
        flagged++;
      }
      emit(`${n.node}: lag ${n.lagS}s ${lagging ? "⚠️ lagging (log-correlated)" : "ok"}`);
    }
    emit(`RESULT: ${flagged} node(s) flagged`);
  },
});
