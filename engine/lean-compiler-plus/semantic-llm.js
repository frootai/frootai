/**
 * [Z11] Lean+ — LLM-backed semantic SemanticCompressor.
 *
 * The first MODEL-backed `SemanticCompressor` (implements the same contract as
 * `StubSemanticCompressor` / `RuleSemanticCompressor` in this folder). It hands
 * the lossless-floor Lean text to an LLM with a strict compression prompt, then
 * returns the candidate. The caller (`compilePlus`) runs the SAME Z1 fidelity
 * gate over the candidate and FALLS BACK to lossless if it doesn't clear the
 * gate — so an aggressive (lossy) compression can never be served. This module
 * never relaxes the gate; it only proposes a candidate.
 *
 * Design choices that keep the gate pass-rate high:
 *   - The system prompt forbids touching code blocks, parameter names/values,
 *     defaults, enums, file paths, flags, and MUST/NEVER/ALWAYS/REQUIRED
 *     guardrail sentences — exactly the units the fidelity checkers count.
 *   - The model is asked to compress ONLY explanatory prose.
 *   - The output is sanitised: a wrapping ```fence``` is stripped, and if the
 *     model returns something longer than the input (or empty/garbage), we
 *     return the input unchanged so `compilePlus` serves lossless.
 *
 * The LLM call itself is INJECTED (`callLLM(messages) => Promise<string>`), so
 * the same compressor works against Azure OpenAI directly (build-time, with a
 * key), a Cloudflare Worker proxy, or a mock in tests — no network in CI.
 *
 * Reproducibility: `azureOpenAICaller` pins deterministic sampling controls
 * where the deployment supports them. Hosted model revisions can still change
 * output, so the deterministic fidelity gate remains the safety boundary.
 */

/**
 * The strict compression contract handed to the model. Kept verbatim here so it
 * is testable and version-controlled (the prompt IS the safety boundary).
 */
export const COMPRESSION_SYSTEM_PROMPT = [
  "You are a deterministic prompt COMPRESSOR for AI agent/skill markdown.",
  "Goal: rewrite the document to use as FEW tokens as possible WITHOUT changing what it instructs the model to do.",
  "",
  "PRESERVE EXACTLY, byte-for-byte (copy them unchanged):",
  "- every fenced code block and its contents",
  "- every inline `code` span, file path, CLI flag, URL, and identifier",
  "- every parameter name and value, default, threshold, enum, and number",
  "- every guardrail sentence — anything with MUST / MUST NOT / NEVER / ALWAYS / REQUIRED / DO NOT",
  "- YAML/JSON front-matter and any key:value configuration lines",
  "- section headings (you may keep them; do not invent new ones)",
  "",
  "COMPRESS ONLY explanatory prose: remove redundancy and filler, merge short",
  "sentences, cut hedging and restated context. Do NOT paraphrase instructions,",
  "do NOT summarise away steps, do NOT drop any requirement.",
  "",
  "OUTPUT: return ONLY the compressed markdown. No preamble, no commentary, no",
  "code fence around the whole document, no explanation of what you changed.",
].join("\n");

/** Strip a single wrapping ```fence``` the model sometimes adds around the whole doc. */
function unwrapWholeDocFence(text) {
  const t = text.trim();
  const m = t.match(/^```[a-zA-Z0-9]*\n([\s\S]*?)\n```$/);
  return m ? m[1] : t;
}

/**
 * Build an LLM-backed SemanticCompressor.
 *
 * @param {Object} opts
 * @param {(messages: {role:string,content:string}[]) => Promise<string>} opts.callLLM
 *        Sends chat messages, resolves the assistant's text content.
 * @param {string} [opts.id="llm-azure-gpt-4.1"] stable backend identifier.
 * @returns {{ id: string, compress: (lean: string, ctx: object) => Promise<string> }}
 */
export function createLLMSemanticCompressor({ callLLM, id = "llm-azure-gpt-4.1" } = {}) {
  if (typeof callLLM !== "function") {
    throw new TypeError("createLLMSemanticCompressor: callLLM must be a function");
  }
  return {
    id,
    async compress(lean, _ctx) {
      if (typeof lean !== "string" || lean.length === 0) return lean;
      let out;
      try {
        out = await callLLM([
          { role: "system", content: COMPRESSION_SYSTEM_PROMPT },
          { role: "user", content: lean },
        ]);
      } catch {
        // Any backend failure → return the input so compilePlus serves lossless.
        return lean;
      }
      if (typeof out !== "string") return lean;
      const candidate = unwrapWholeDocFence(out);
      // Never serve a candidate that grew or collapsed to near-nothing — those are
      // model misfires; let the gate/fallback in compilePlus serve lossless.
      if (!candidate || candidate.length > lean.length || candidate.length < lean.length * 0.25) {
        return lean;
      }
      return candidate;
    },
  };
}

/**
 * Azure OpenAI caller. Reads config from the passed object or, when omitted,
 * from env. Uses an
 * `api-key` header (local/build with a key) — pass `useBearer:true` + a token
 * for Managed Identity. GPT-4.x receives temperature 0 + a fixed seed;
 * reasoning-model deployments receive reasoning_effort instead because they
 * reject non-default temperature values. Hosted model replay remains best-effort
 * because providers may revise model weights; the fidelity gate is the safety
 * boundary, not byte-identical model output.
 *
 * @param {Object} [cfg]
 * @returns {(messages: {role:string,content:string}[]) => Promise<string>}
 */
export function azureOpenAICaller(cfg = {}) {
  const endpoint = cfg.endpoint || process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = cfg.deployment || process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1";
  const apiVersion = cfg.apiVersion || process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";
  const apiKey = cfg.apiKey || process.env.AZURE_OPENAI_KEY;
  const bearerToken = cfg.bearerToken || process.env.AZURE_OPENAI_BEARER;
  const maxTokens = cfg.maxTokens ?? 4096;
  const reasoningEffort = cfg.reasoningEffort || process.env.AZURE_OPENAI_REASONING_EFFORT || "minimal";
  const seed = cfg.seed ?? 0;
  if (!endpoint) {
    throw new Error("azureOpenAICaller: no AZURE_OPENAI_ENDPOINT configured");
  }
  if (!apiKey && !bearerToken) {
    throw new Error("azureOpenAICaller: no AZURE_OPENAI_KEY or AZURE_OPENAI_BEARER (Azure AD token) configured");
  }
  // Lazy import so the module loads in CI without node:https when using a mock.
  return async (messages) => {
    const https = await import("node:https");
    const body = JSON.stringify(buildAzureRequestBody(messages, {
      deployment,
      maxTokens,
      reasoningEffort,
      seed,
    }));
    const url = new URL(`/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`, endpoint);
    const headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) };
    if (bearerToken) headers["Authorization"] = `Bearer ${bearerToken}`;
    else headers["api-key"] = apiKey;
    return await new Promise((resolve, reject) => {
      const req = https.request(
        { hostname: url.hostname, path: url.pathname + url.search, method: "POST", headers, timeout: 90000 },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) return reject(new Error(parsed.error.message));
              resolve(parsed.choices?.[0]?.message?.content ?? "");
            } catch {
              reject(new Error(`azure parse error: ${data.slice(0, 200)}`));
            }
          });
        },
      );
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("azure timeout")));
      req.write(body);
      req.end();
    });
  };
}

/** Build a deployment-compatible Azure Chat Completions request body. */
export function buildAzureRequestBody(messages, { deployment, maxTokens, reasoningEffort, seed }) {
  const reasoningModel = /(?:^|[-_.])(gpt-5|o[1-9])(?:$|[-_.])/i.test(deployment);
  const body = { messages, max_completion_tokens: maxTokens };
  if (reasoningModel) body.reasoning_effort = reasoningEffort;
  else {
    body.temperature = 0;
    body.seed = seed;
  }
  return body;
}
