/**
 * [Z11] Build-time measurement — run the LLM-backed Lean+ semantic compressor
 * over real primitives and report the HONEST, exact-o200k savings + gate
 * pass-rate. This is the tool that answers "what % do we actually get?".
 *
 * Reuses Agent FAI's model (Azure OpenAI gpt-4.1). Needs a credential:
 *   $env:AZURE_OPENAI_KEY = "<key>"        # local/build
 * (endpoint + deployment default to the same ones the chatbot uses; override
 * with AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_DEPLOYMENT if needed.)
 *
 * Usage:
 *   node scripts/measure-semantic-llm.mjs                 # 10 agents
 *   node scripts/measure-semantic-llm.mjs --type skills --limit 15
 *
 * It NEVER writes catalog files — measurement only. Every served variant is
 * gate-checked; failures fall back to lossless and count as ~0 semantic saving,
 * so the reported number is what we could HONESTLY ship, never inflated.
 */
import fs from "node:fs";
import path from "node:path";
import { compilePlus } from "../engine/lean-compiler-plus/index.js";
import { createLLMSemanticCompressor, azureOpenAICaller } from "../engine/lean-compiler-plus/semantic-llm.js";
import { countTokensExact } from "../engine/lean-compiler/tokenizer.js";

// Load the credential from a gitignored .env (frootai/.env) if it isn't already
// in the environment — so the key never has to be pasted into chat or a shell.
// One line in frootai/.env:   AZURE_OPENAI_KEY=<the key>
try {
  if (!process.env.AZURE_OPENAI_KEY && fs.existsSync(".env")) {
    for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch { /* no .env — fall through to the clear key-required message */ }

const args = process.argv.slice(2);
const getArg = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const type = getArg("--type", "agents");
const limit = Number(getArg("--limit", "10"));

// Collect source files for the requested type.
function collect(type) {
  if (type === "agents") {
    return fs.readdirSync("agents").filter((f) => f.endsWith(".agent.md")).map((f) => ({ id: f, file: path.join("agents", f) }));
  }
  if (type === "instructions") {
    return fs.readdirSync("instructions").filter((f) => f.endsWith(".instructions.md")).map((f) => ({ id: f, file: path.join("instructions", f) }));
  }
  if (type === "skills") {
    const base = "skills";
    return fs.readdirSync(base).flatMap((d) => {
      const p = path.join(base, d, "SKILL.md");
      return fs.existsSync(p) ? [{ id: d, file: p }] : [];
    });
  }
  throw new Error(`unknown --type ${type} (use agents|skills|instructions)`);
}

let caller;
try {
  caller = azureOpenAICaller({ maxTokens: 8000 });
} catch (e) {
  console.error("\n✗ " + e.message);
  console.error("  Set the credential first, e.g.:  $env:AZURE_OPENAI_KEY = \"<key>\"\n");
  process.exit(2);
}
const compressor = createLLMSemanticCompressor({ callLLM: caller });

const files = collect(type).slice(0, limit);
console.log(`\nLean+ semantic measurement · ${files.length} ${type} · model=gpt-4.1 · exact o200k_base\n`);
console.log("primitive".padEnd(42), "full→served", "saved%", "flavor", "gate");

let totFull = 0, totServed = 0, semCount = 0, passCount = 0;
for (const { id, file } of files) {
  const md = fs.readFileSync(file, "utf8");
  const fullTok = countTokensExact(md);
  let result;
  try {
    result = await compilePlus(md, { semantic: compressor, primitiveType: type.replace(/s$/, "") });
  } catch (e) {
    console.log(id.padEnd(42), "ERR", e.message.slice(0, 40));
    continue;
  }
  const servedTok = countTokensExact(result.lean);
  const pct = fullTok ? (100 * (fullTok - servedTok) / fullTok) : 0;
  totFull += fullTok; totServed += servedTok;
  if (result.stats.servedFlavor === "semantic" && servedTok < fullTok) semCount++;
  if (result.verdict.pass) passCount++;
  console.log(
    id.slice(0, 41).padEnd(42),
    `${fullTok}→${servedTok}`.padEnd(11),
    `${pct.toFixed(1)}%`.padEnd(6),
    result.stats.servedFlavor.padEnd(8),
    result.verdict.pass ? "PASS" : "fallback",
  );
}

const aggPct = totFull ? (100 * (totFull - totServed) / totFull) : 0;
console.log("\n" + "─".repeat(60));
console.log(`AGGREGATE  ${totFull} → ${totServed} tok  =  ${aggPct.toFixed(1)}% saved`);
console.log(`gate cleared (semantic served): ${semCount}/${files.length} · gate pass incl. no-op: ${passCount}/${files.length}`);
console.log("Honest: failures fall back to lossless (~0.5%); the % above is what we could ship.\n");
