const http = require("http");
const https = require("https");

// FrootAI Distribution Versions — synced with packages
const FROOTAI_MCP_VERSION = "@5.0.1";      // frootai-mcp npm package
const FROOTAI_EXT_VERSION = "v5.0.1";      // VS Code extension

// Azure OpenAI Configuration
const AZURE_OPENAI_ENDPOINT = "https://cs-openai-varcvenlme53e.cognitiveservices.azure.com";
const AZURE_OPENAI_DEPLOYMENT = "gpt-4.1";
const AZURE_OPENAI_API_VERSION = "2024-10-21";

// ═══ SHARED SYSTEM PROMPT — imported from config/agent-fai-prompt.js ═══
let AGENT_FAI_SYSTEM_PROMPT;
try { AGENT_FAI_SYSTEM_PROMPT = require("./agent-fai-prompt").AGENT_FAI_SYSTEM_PROMPT; } catch { AGENT_FAI_SYSTEM_PROMPT = require("../config/agent-fai-prompt").AGENT_FAI_SYSTEM_PROMPT; }
const SYSTEM_PROMPT = AGENT_FAI_SYSTEM_PROMPT;

const PORT = process.env.PORT || 8080;

// ═══ COMPUTE DATA (mirrors MCP tools) ═══
const PLAY_DATA = [
  { id: "01", name: "Enterprise RAG Q&A", services: ["AI Search", "OpenAI (gpt-4o)", "Container App", "Blob Storage"], pattern: "RAG hybrid search chunking semantic reranking retrieval augmented generation document qa question answering knowledge base", cx: "Medium" },
  { id: "02", name: "AI Landing Zone", services: ["VNet + PE", "Key Vault"], pattern: "landing zone infrastructure network security private endpoints rbac governance", cx: "Foundation" },
  { id: "03", name: "Deterministic Agent", services: ["Container App", "OpenAI (gpt-4o)", "Content Safety"], pattern: "deterministic agent zero temperature reliable reproducible guardrails", cx: "Medium" },
  { id: "04", name: "Call Center Voice AI", services: ["Communication Services", "Speech Service", "OpenAI (gpt-4o)", "App Service (B1)"], pattern: "voice call center speech stt tts real time audio phone", cx: "High" },
  { id: "05", name: "IT Ticket Resolution", services: ["OpenAI (gpt-4o-mini)", "App Service (B1)"], pattern: "ticket resolution automation helpdesk workflow", cx: "Medium" },
  { id: "06", name: "Document Intelligence", services: ["Document Intelligence", "OpenAI (gpt-4o)", "Blob Storage"], pattern: "document extraction ocr invoice receipt structured output pdf", cx: "Medium" },
  { id: "07", name: "Multi-Agent Service", services: ["OpenAI (gpt-4o)", "Container App", "Cosmos DB"], pattern: "multi agent collaboration handoff orchestration", cx: "High" },
  { id: "08", name: "Copilot Studio Bot", services: ["AI Search", "OpenAI (gpt-4o-mini)", "Blob Storage"], pattern: "copilot studio low code bot chatbot", cx: "Low" },
  { id: "09", name: "AI Search Portal", services: ["AI Search", "OpenAI (gpt-4o)", "App Service (B1)"], pattern: "search portal semantic hybrid keyword", cx: "Medium" },
  { id: "10", name: "Content Moderation", services: ["Content Safety", "OpenAI (gpt-4o-mini)", "APIM"], pattern: "content moderation safety filtering toxic", cx: "Low" },
  { id: "11", name: "Landing Zone Advanced", services: ["VNet + PE", "Firewall", "Key Vault", "NAT Gateway"], pattern: "advanced network segmentation firewall dns", cx: "High" },
  { id: "12", name: "Model Serving AKS", services: ["AKS (GPU)", "ACR", "OpenAI (gpt-4o)"], pattern: "model serving kubernetes gpu cluster hosting", cx: "High" },
  { id: "13", name: "Fine-Tuning Workflow", services: ["ML Workspace", "OpenAI (gpt-4o)", "Blob Storage"], pattern: "fine tuning lora training dataset mlops", cx: "High" },
  { id: "14", name: "Cost-Optimized AI Gateway", services: ["APIM", "OpenAI (gpt-4o)", "Redis Cache"], pattern: "cost optimization finops gateway caching token metering", cx: "Medium" },
  { id: "15", name: "Multi-Modal DocProc", services: ["Document Intelligence", "OpenAI (gpt-4o)", "Cosmos DB"], pattern: "multi modal document images tables extraction", cx: "Medium" },
  { id: "16", name: "Copilot Teams Extension", services: ["OpenAI (gpt-4o)", "App Service (B1)"], pattern: "teams bot copilot extension adaptive cards", cx: "Medium" },
  { id: "17", name: "AI Observability", services: ["Log Analytics", "App Insights"], pattern: "observability monitoring telemetry kql dashboards", cx: "Medium" },
  { id: "18", name: "Prompt Management", services: ["OpenAI (gpt-4o)", "Cosmos DB", "App Service (B1)"], pattern: "prompt management versioning ab testing", cx: "Medium" },
  { id: "19", name: "Edge AI Phi-4", services: ["IoT Hub", "ACR", "Blob Storage"], pattern: "edge ai phi small language model iot offline", cx: "High" },
  { id: "20", name: "Anomaly Detection", services: ["Event Hub", "Stream Analytics", "OpenAI (gpt-4o)", "Cosmos DB"], pattern: "anomaly detection streaming real time event", cx: "High" },
];

const SVC_PRICING = { "AI Search": [75, 500], "OpenAI (gpt-4o)": [50, 2000], "OpenAI (gpt-4o-mini)": [10, 200], "Container App": [15, 150], "App Service (B1)": [13, 55], "Cosmos DB": [25, 300], "AKS (GPU)": [200, 2000], "ML Workspace": [50, 500], "VNet + PE": [10, 50], "Firewall": [0, 500], "Key Vault": [1, 5], "APIM": [50, 300], "Redis Cache": [15, 100], "Event Hub": [10, 150], "Stream Analytics": [50, 300], "Log Analytics": [10, 100], "App Insights": [5, 50], "Blob Storage": [5, 50], "Communication Services": [20, 500], "Speech Service": [15, 200], "Document Intelligence": [15, 150], "Content Safety": [10, 50], "IoT Hub": [10, 100], "ACR": [5, 50], "NAT Gateway": [0, 30] };

function searchPlays(query) {
  const qt = query.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
  if (!qt.length) return PLAY_DATA.slice(0, 3);
  return PLAY_DATA.map(p => {
    const text = `${p.name} ${p.pattern} ${p.services.join(" ")}`.toLowerCase().split(/\s+/);
    let hits = 0;
    for (const q of qt) { for (const t of text) { if (t.includes(q) || q.includes(t)) { hits++; break; } } }
    return { ...p, score: hits / qt.length };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
}

function estimateCost(playId, scale) {
  const p = PLAY_DATA.find(d => d.id === playId.padStart(2, "0"));
  if (!p) return null;
  const idx = scale === "prod" ? 1 : 0;
  let total = 0;
  const items = p.services.map(s => { const pr = SVC_PRICING[s] || [0, 0]; const c = pr[idx]; total += c; return { service: s, cost: c }; });
  return { play: p, items, total, scale };
}

// ═══ RATE LIMITING (in-memory, sliding window) ═══
const RATE_LIMIT = { windowMs: 60000, maxRequests: 60 };
const rateLimitStore = new Map();

function rateLimitCheck(ip) {
  const now = Date.now();
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, [now]);
    return true;
  }
  const timestamps = rateLimitStore.get(ip).filter(t => now - t < RATE_LIMIT.windowMs);
  timestamps.push(now);
  rateLimitStore.set(ip, timestamps);
  return timestamps.length <= RATE_LIMIT.maxRequests;
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitStore) {
    const valid = timestamps.filter(t => now - t < RATE_LIMIT.windowMs);
    if (valid.length === 0) rateLimitStore.delete(ip);
    else rateLimitStore.set(ip, valid);
  }
}, 300000);

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // ═══ RATE LIMITING (in-memory, per IP) ═══
  const clientIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  if (!rateLimitCheck(clientIP)) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Rate limit exceeded. Max 60 requests per minute." }));
    return;
  }

  // OpenAPI spec
  if (req.method === "GET" && req.url === "/api/openapi.json") {
    try {
      const spec = require("fs").readFileSync(require("path").join(__dirname, "openapi.json"), "utf8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(spec);
    } catch (e) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "OpenAPI spec not found" }));
    }
    return;
  }

  // Health check
  if (req.method === "GET" && (req.url === "/" || req.url === "/api/health")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "frootai-chatbot-api", model: AZURE_OPENAI_DEPLOYMENT, tools: 22, version: "3.1.2" }));
    return;
  }

  // ═══ COMPUTE API ENDPOINTS (MCP tools as REST) ═══

  // Search plays
  if (req.method === "POST" && req.url === "/api/search-plays") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { query } = JSON.parse(body);
        const results = searchPlays(query || "");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ results }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  // Estimate cost
  if (req.method === "POST" && req.url === "/api/estimate-cost") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { play, scale } = JSON.parse(body);
        const result = estimateCost(play || "01", scale || "dev");
        if (!result) { res.writeHead(404); res.end(JSON.stringify({ error: "Play not found" })); return; }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });
    return;
  }

  // Chat endpoint
  if (req.method === "POST" && (req.url === "/api/chat" || req.url === "/chat")) {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { message, history = [] } = JSON.parse(body);
        if (!message) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'message' in request body" }));
          return;
        }

        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          ...history.slice(-10),
          { role: "user", content: message },
        ];

        // Try Managed Identity first (production), fall back to API key (dev)
        let credential;
        let useBearer = false;
        const apiKey = process.env.AZURE_OPENAI_KEY;

        if (process.env.IDENTITY_ENDPOINT) {
          // Running on Azure — use Managed Identity
          try {
            credential = await getManagedIdentityToken();
            useBearer = true;
            console.log("Using Managed Identity token");
          } catch (tokenErr) {
            console.error("MI token failed:", tokenErr.message);
            if (apiKey) { credential = apiKey; } else { throw tokenErr; }
          }
        } else if (apiKey) {
          credential = apiKey;
        } else {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No auth configured. Set AZURE_OPENAI_KEY or enable Managed Identity." }));
          return;
        }

        const reply = await callAzureOpenAI(messages, credential, useBearer);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(reply));
      } catch (err) {
        console.error("Chat error:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to get response", detail: err.message }));
      }
    });
    return;
  }

  // Streaming chat endpoint
  if (req.method === "POST" && (req.url === "/api/chat/stream" || req.url === "/chat/stream")) {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { message, history = [] } = JSON.parse(body);
        if (!message) { res.writeHead(400); res.end("Missing message"); return; }

        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          ...history.slice(-10),
          { role: "user", content: message },
        ];

        let credential;
        let useBearer = false;
        const apiKey = process.env.AZURE_OPENAI_KEY;
        if (process.env.IDENTITY_ENDPOINT) {
          try { credential = await getManagedIdentityToken(); useBearer = true; }
          catch { if (apiKey) credential = apiKey; else throw new Error("No auth"); }
        } else if (apiKey) { credential = apiKey; }
        else { res.writeHead(500); res.end("No auth"); return; }

        // SSE streaming
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
          "Access-Control-Allow-Headers": "Content-Type",
        });

        const reqBody = JSON.stringify({ messages, temperature: 0.4, max_tokens: 1000, top_p: 0.9, stream: true });
        const url = new URL(`/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`, AZURE_OPENAI_ENDPOINT);
        const headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(reqBody) };
        if (useBearer) headers["Authorization"] = `Bearer ${credential}`;
        else headers["api-key"] = credential;

        const apiReq = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: "POST", headers }, (apiRes) => {
          let buffer = "";
          apiRes.on("data", (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.startsWith("data: ") && line !== "data: [DONE]") {
                try {
                  const json = JSON.parse(line.slice(6));
                  const content = json.choices?.[0]?.delta?.content;
                  if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
                } catch { }
              }
              if (line === "data: [DONE]") {
                res.write("data: [DONE]\n\n");
                res.end();
              }
            }
          });
          apiRes.on("end", () => { if (!res.writableEnded) { res.write("data: [DONE]\n\n"); res.end(); } });
        });
        apiReq.on("error", (e) => { res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`); res.end(); });
        apiReq.write(reqBody);
        apiReq.end();
      } catch (err) {
        res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. Use POST /api/chat" }));
});

function callAzureOpenAI(messages, credential, useBearer) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ messages, temperature: 0.4, max_tokens: 1000, top_p: 0.9 });
    const url = new URL(`/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`, AZURE_OPENAI_ENDPOINT);

    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    };

    if (useBearer) {
      headers["Authorization"] = `Bearer ${credential}`;
    } else {
      headers["api-key"] = credential;
    }

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { reject(new Error(parsed.error.message)); return; }
          resolve({ reply: parsed.choices?.[0]?.message?.content || "No response", model: parsed.model, usage: parsed.usage });
        } catch (e) { reject(new Error(`Parse error: ${data.substring(0, 200)}`)); }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

server.listen(PORT, () => {
  console.log(`FrootAI Chatbot API running on port ${PORT}`);
  console.log(`Auth: ${process.env.IDENTITY_ENDPOINT ? 'Managed Identity' : (process.env.AZURE_OPENAI_KEY ? 'API Key' : 'NONE')}`);
  console.log(`Health: GET /api/health`);
  console.log(`Chat: POST /api/chat`);
});

// Get access token from Azure Managed Identity
function getManagedIdentityToken() {
  return new Promise((resolve, reject) => {
    const identityEndpoint = process.env.IDENTITY_ENDPOINT;
    const identityHeader = process.env.IDENTITY_HEADER;

    if (!identityEndpoint || !identityHeader) {
      reject(new Error("Managed Identity not available (no IDENTITY_ENDPOINT)"));
      return;
    }

    const tokenUrl = new URL(identityEndpoint);
    tokenUrl.searchParams.set("resource", "https://cognitiveservices.azure.com/");
    tokenUrl.searchParams.set("api-version", "2019-08-01");

    const options = {
      hostname: tokenUrl.hostname,
      port: tokenUrl.port,
      path: tokenUrl.pathname + tokenUrl.search,
      method: "GET",
      headers: { "X-IDENTITY-HEADER": identityHeader },
    };

    const protocol = tokenUrl.protocol === "https:" ? https : http;
    const req = protocol.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) {
            resolve(parsed.access_token);
          } else {
            reject(new Error(`No access_token in MI response: ${data.substring(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`MI parse error: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

// Deploy test: 2026-03-26 00:18