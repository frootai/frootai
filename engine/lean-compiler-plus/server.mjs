import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compilePlus, RuleSemanticCompressor } from "./index.js";
import { azureOpenAICaller, createLLMSemanticCompressor } from "./semantic-llm.js";

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 8788;
export const MAX_BODY_BYTES = 256 * 1024;
export const MAX_INPUT_BYTES = 200 * 1024;

const MODES = new Set(["lossless", "rules", "semantic"]);
const PRIMITIVE_TYPES = new Set(["skill", "agent", "instruction", "hook", "unknown"]);

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendJson(response, status, body, extraHeaders = {}) {
  const json = JSON.stringify(body, null, 2) + "\n";
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...extraHeaders,
  });
  response.end(json);
}

async function readJson(request) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "content-type must be application/json");
  }

  const declaredLength = Number(request.headers["content-length"] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new ApiError(413, "request_too_large", `request body exceeds ${MAX_BODY_BYTES} bytes`);
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new ApiError(413, "request_too_large", `request body exceeds ${MAX_BODY_BYTES} bytes`);
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "invalid_json", "request body must be valid JSON");
  }
}

function validateCompileInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "invalid_request", "request body must be a JSON object");
  }

  const { text, mode = "lossless", primitiveType = "unknown" } = body;
  if (typeof text !== "string" || text.length === 0) {
    throw new ApiError(400, "invalid_text", "text must be a non-empty string");
  }
  if (Buffer.byteLength(text, "utf8") > MAX_INPUT_BYTES) {
    throw new ApiError(413, "input_too_large", `text exceeds ${MAX_INPUT_BYTES} UTF-8 bytes`);
  }
  if (!MODES.has(mode)) {
    throw new ApiError(400, "invalid_mode", "mode must be lossless, rules, or semantic");
  }
  if (!PRIMITIVE_TYPES.has(primitiveType)) {
    throw new ApiError(400, "invalid_primitive_type", "primitiveType must be skill, agent, instruction, hook, or unknown");
  }

  return { text, mode, primitiveType };
}

function semanticEnabled(options) {
  return options.enableSemantic === true || process.env.LEAN_API_ENABLE_SEMANTIC === "1";
}

async function compileRequest(input, options) {
  if (input.mode === "lossless") {
    return compilePlus(input.text, { primitiveType: input.primitiveType });
  }

  if (input.mode === "rules") {
    return compilePlus(input.text, {
      primitiveType: input.primitiveType,
      semantic: RuleSemanticCompressor,
    });
  }

  if (!semanticEnabled(options)) {
    throw new ApiError(
      403,
      "semantic_mode_disabled",
      "semantic mode is experimental; set LEAN_API_ENABLE_SEMANTIC=1 to enable it",
    );
  }

  let callLLM = options.callLLM;
  if (!callLLM) {
    try {
      callLLM = azureOpenAICaller(options.azure);
    } catch (error) {
      throw new ApiError(503, "semantic_backend_unavailable", error.message);
    }
  }

  return compilePlus(input.text, {
    primitiveType: input.primitiveType,
    semantic: createLLMSemanticCompressor({ callLLM, id: options.semanticBackendId }),
  });
}

async function handleRequest(request, response, options) {
  const url = new URL(request.url || "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/healthz") {
    sendJson(response, 200, {
      service: "frootai-lean-api",
      ok: true,
      modes: ["lossless", "rules", "semantic"],
      semanticEnabled: semanticEnabled(options),
      limits: { bodyBytes: MAX_BODY_BYTES, inputBytes: MAX_INPUT_BYTES },
    });
    return;
  }

  if (url.pathname !== "/v1/lean/compile") {
    sendJson(response, 404, { error: { code: "not_found", message: "route not found" } });
    return;
  }

  if (request.method !== "POST") {
    sendJson(
      response,
      405,
      { error: { code: "method_not_allowed", message: "use POST /v1/lean/compile" } },
      { allow: "POST" },
    );
    return;
  }

  const body = await readJson(request);
  const input = validateCompileInput(body);
  const result = await compileRequest(input, options);
  const semanticWarning = input.mode === "semantic"
    ? "Experimental: the gate verifies lexical and structural retention; it is not proof of general semantic equivalence."
    : null;

  sendJson(response, 200, {
    apiVersion: "1.0",
    requestedMode: input.mode,
    servedFlavor: result.stats.servedFlavor,
    lean: result.lean,
    receipt: {
      ...result.stats,
      fidelity: result.verdict,
      verificationScope: "guardrails, parameters, code, triggers, and imperative lexical retention",
      warning: semanticWarning,
    },
  });
}

export function createLeanApiServer(options = {}) {
  const server = createServer((request, response) => {
    handleRequest(request, response, options).catch((error) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      if (error instanceof ApiError) {
        sendJson(response, error.status, { error: { code: error.code, message: error.message } });
        return;
      }
      sendJson(response, 500, {
        error: { code: "compile_failed", message: "Lean compilation failed" },
      });
    });
  });
  server.requestTimeout = 100_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

function optionValue(name, fallback) {
  const exact = process.argv.indexOf(name);
  if (exact >= 0) return process.argv[exact + 1] ?? fallback;
  const prefixed = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : fallback;
}

function startFromCli() {
  const host = optionValue("--host", process.env.LEAN_API_HOST || DEFAULT_HOST);
  const port = Number(optionValue("--port", process.env.PORT || DEFAULT_PORT));
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("--port must be an integer from 0 to 65535");
  }

  const server = createLeanApiServer();
  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`FrootAI Lean API listening on http://${host}:${actualPort}`);
    console.log(`POST http://${host}:${actualPort}/v1/lean/compile`);
  });

  const close = () => server.close(() => process.exit(0));
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirect) startFromCli();