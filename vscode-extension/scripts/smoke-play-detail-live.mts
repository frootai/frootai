import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { downloadPlayKit, fetchArchitecture, fetchPlayKitPlan, type PlayKit } from "../src/play-detail/workflow";

const playDir = process.argv[2] || "01-enterprise-rag";
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "frootai-play-detail-live-"));
try {
  const architecture = await fetchArchitecture(playDir);
  const kits: Record<string, { planFiles: number; copied: number; skipped: number; firstFiles: string[] }> = {};
  for (const kit of ["devkit", "tunekit", "speckit"] satisfies PlayKit[]) {
    const plan = await fetchPlayKitPlan(playDir, kit);
    const result = await downloadPlayKit({ targetRoot: path.join(tempRoot, kit), plan });
    if (!plan.length || result.copied.length !== plan.length || result.skipped.length) {
      throw new Error(`Live ${kit} plan did not download every planned file into its clean destination.`);
    }
    kits[kit] = { planFiles: plan.length, copied: result.copied.length, skipped: result.skipped.length, firstFiles: result.copied.slice(0, 10) };
  }
  if (!architecture.markdown.trim()) throw new Error("Architecture markdown is empty.");
  console.log(JSON.stringify({ playDir, architectureBytes: Buffer.byteLength(architecture.markdown), kits }, null, 2));
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
