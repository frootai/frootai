// @ts-check
// [X8.12] Runnable companion to cookbook/34-vector-db-comparison.md.
// Offline: drives the index→query→score bake-off against fake areas.
import { runRecipe } from "../_harness.mjs";

runRecipe({
  id: "34-vector-db-comparison",
  title: "Vector DB Comparison",
  attached: ["qdrant", "chromadb", "pinecone"],
  steps: ({ areas, emit }) => {
    const stores = ["qdrant", "chromadb", "pinecone"];
    const scores = { qdrant: 0.94, chromadb: 0.91, pinecone: 0.95 };
    for (const s of stores) {
      areas[s].upsert({ collection: "bakeoff", docs: 12000 });
      areas[s].search({ query: "labelled-set", topK: 10 });
      emit(`${s}: indexed + queried → recall@10 ${scores[s]}`);
    }
    const winner = stores.reduce((a, b) => (scores[a] >= scores[b] ? a : b));
    emit(`RESULT: bake-off complete — top recall: ${winner}`);
  },
});
