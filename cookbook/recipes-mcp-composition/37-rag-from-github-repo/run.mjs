// @ts-check
// [X8.12] Runnable companion to cookbook/37-rag-from-github-repo.md.
// Offline: drives the fetch→normalize→index pipeline against fake areas.
import { runRecipe } from "../_harness.mjs";

runRecipe({
  id: "37-rag-from-github-repo",
  title: "RAG from a GitHub Repo",
  attached: ["github", "markitdown", "azure"],
  steps: ({ areas, emit }) => {
    const files = areas.github.list_files({ repo: "acme/widgets", ref: "main" });
    emit(`github: enumerated repo files (${files.ok ? "142" : "—"})`);
    const nonMd = ["spec.pdf", "design.docx", "notes.ipynb"];
    for (const f of nonMd) areas.markitdown.convert_to_markdown({ path: f });
    emit(`markitdown: normalized ${nonMd.length} non-markdown docs`);
    const idx = areas.azure.ai_search_upsert({ index: "widgets-rag", chunks: 1204 });
    emit(`azure ai search: upserted chunks (${idx.ok ? "1204" : "—"})`);
    emit("RESULT: index 'widgets-rag' ready for retrieval");
  },
});
