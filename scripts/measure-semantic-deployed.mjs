/**
 * [Z11] DIRECTIONAL catalog measurement via the DEPLOYED Agent FAI endpoint
 * (gpt-4.1, no local key needed). Conservative floor: that endpoint caps output
 * at 1000 tokens and carries the agent system prompt, so large primitives get
 * truncated → fail the gate → fall back to lossless (counted as ~0 here). The
 * production path (azureOpenAICaller, no cap) does better. Honest, never inflated.
 *
 * Usage: node scripts/measure-semantic-deployed.mjs --type agents --limit 8
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { compilePlus } from "../engine/lean-compiler-plus/index.js";
import { createLLMSemanticCompressor } from "../engine/lean-compiler-plus/semantic-llm.js";
import { countTokensExact } from "../engine/lean-compiler/tokenizer.js";

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const type = getArg("--type", "agents");
const limit = Number(getArg("--limit", "8"));
const ENDPOINT = "https://frootai-chatbot-api.azurewebsites.net/api/chat";

function deployedCall(messages) {
  const sys = messages.find((m) => m.role === "system")?.content || "";
  const usr = messages.find((m) => m.role === "user")?.content || "";
  const message = sys + "\n\n---\n\n" + usr;
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ message, history: [] });
    const u = new URL(ENDPOINT);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }, timeout: 70000 },
      (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => { try { resolve(JSON.parse(d).reply || ""); } catch { reject(new Error(d.slice(0, 150))); } }); },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.write(body);
    req.end();
  });
}

function collect(type) {
  if (type === "agents") return fs.readdirSync("agents").filter((f) => f.endsWith(".agent.md")).map((f) => ({ id: f.replace(".agent.md", ""), file: path.join("agents", f) }));
  if (type === "instructions") return fs.readdirSync("instructions").filter((f) => f.endsWith(".instructions.md")).map((f) => ({ id: f.replace(".instructions.md", ""), file: path.join("instructions", f) }));
  if (type === "skills") return fs.readdirSync("skills").flatMap((d) => { const p = path.join("skills", d, "SKILL.md"); return fs.existsSync(p) ? [{ id: d, file: p }] : []; });
  throw new Error(`unknown --type ${type}`);
}

const compressor = createLLMSemanticCompressor({ callLLM: deployedCall, id: "deployed-gpt-4.1" });
const files = collect(type).slice(0, limit);
console.log(`\nDIRECTIONAL (deployed endpoint, capped) · ${files.length} ${type} · gpt-4.1 · exact o200k\n`);
console.log("primitive".padEnd(38), "full→served", "saved%", "result");

let totFull = 0, totServed = 0, sem = 0;
for (const { id, file } of files) {
  const md = fs.readFileSync(file, "utf8");
  const fullTok = countTokensExact(md);
  let r;
  try { r = await compilePlus(md, { semantic: compressor, primitiveType: type.replace(/s$/, "") }); }
  catch (e) { console.log(id.slice(0, 37).padEnd(38), "ERR", e.message.slice(0, 30)); continue; }
  const servedTok = countTokensExact(r.lean);
  const pct = fullTok ? (100 * (fullTok - servedTok) / fullTok) : 0;
  const semantic = r.stats.servedFlavor === "semantic" && servedTok < fullTok;
  if (semantic) sem++;
  totFull += fullTok; totServed += servedTok;
  console.log(id.slice(0, 37).padEnd(38), `${fullTok}→${servedTok}`.padEnd(11), `${pct.toFixed(1)}%`.padEnd(6), semantic ? "semantic ✓" : "lossless (gate fallback)");
}
console.log("\n" + "─".repeat(58));
console.log(`AGGREGATE  ${totFull} → ${totServed} = ${totFull ? (100 * (totFull - totServed) / totFull).toFixed(1) : 0}% saved · semantic served ${sem}/${files.length}`);
console.log("(Conservative — the deployed endpoint truncates large files. Production run with the key does better.)\n");
