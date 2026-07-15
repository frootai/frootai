// @ts-check
// [X8.12] Runnable companion to cookbook/29-azure-resource-audit.md.
// Offline: drives the enumerate→ground→audit loop against fake areas.
import { runRecipe } from "../_harness.mjs";

runRecipe({
  id: "29-azure-resource-audit",
  title: "Azure Resource Audit",
  attached: ["azure", "ms-learn"],
  steps: ({ areas, emit }) => {
    const resources = [
      { name: "kv-acme-prod", type: "Key Vault", config: { purgeProtection: true } },
      { name: "st-acme-logs", type: "Storage", config: { publicBlob: true } },
      { name: "app-acme-api", type: "App Service", config: { httpsOnly: true } },
    ];
    areas.azure.list_resources({ scope: "sub:acme-prod" });
    let gaps = 0;
    for (const r of resources) {
      const doc = areas["ms-learn"].microsoft_docs_search({ q: `${r.type} best practices` });
      const pass = r.type === "Storage" ? !r.config.publicBlob : true;
      if (!pass) gaps++;
      emit(`${r.name} (${r.type}): ${pass ? "pass" : "gap"} [doc ${doc.ok ? "fetched" : "—"}]`);
    }
    emit(`RESULT: ${gaps} gap(s) across ${resources.length} resources`);
  },
});
