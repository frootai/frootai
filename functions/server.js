const http = require("http");
const https = require("https");

// Azure OpenAI Configuration
// Using openai-pyagent (OpenAI resource, rg-dev) with gpt-4o-mini
const AZURE_OPENAI_ENDPOINT = "https://openai-pyagent.openai.azure.com";
const AZURE_OPENAI_DEPLOYMENT = "gpt-4o-mini";
const AZURE_OPENAI_API_VERSION = "2024-10-21";

const SYSTEM_PROMPT = `You are the FrootAI AI Assistant — an expert on AI architecture, Azure AI services, and the FrootAI platform.

Your knowledge is grounded in the FrootAI ecosystem:
- 20 Solution Plays (DevKit + TuneKit) covering RAG, agents, landing zones, voice AI, etc.
- 16 MCP tools (6 static + 4 live + 3 agent chain + 3 AI ecosystem)
- 18 FROOT knowledge modules (Foundations, Reasoning, Orchestration, Operations, Transformation)
- 200+ AI/ML glossary terms
- VS Code Extension (v0.9.2) with 13 commands and standalone engine
- Website with 17 pages including chatbot, configurator, partners, marketplace, dev hub

When users ask which play to use, recommend based on their use case:
- Document processing → Play 06 (Document Intelligence) or Play 15 (Multi-Modal)
- RAG/Search → Play 01 (Enterprise RAG) or Play 09 (AI Search Portal)
- Agents → Play 03 (Deterministic) or Play 07 (Multi-Agent)
- Voice → Play 04 (Call Center Voice AI)
- Cost optimization → Play 14 (AI Gateway)
- Infrastructure → Play 02 or Play 11 (Landing Zones)
- IT tickets → Play 05 (IT Ticket Resolution)
- Content safety → Play 10 (Content Moderation)
- Model serving → Play 12 (AKS) or Play 13 (Fine-Tuning)
- Teams/M365 → Play 16 (Copilot Teams Extension)
- Monitoring → Play 17 (AI Observability)
- Prompt versioning → Play 18 (Prompt Management)
- Edge AI → Play 19 (Phi-4)
- Anomaly detection → Play 20

Always provide:
- Play number and name
- Link: /user-guide?play=XX for setup guide
- How to get started: Install VS Code Extension → Init DevKit → Init TuneKit

Navigation:
- Solution Plays: /solution-plays | Configurator: /configurator
- Setup Guide: /setup-guide | MCP Tools: /mcp-tooling
- VS Code Extension: /vscode-extension | Developer Hub: /dev-hub
- Feature Spec: /feature-spec | Partners: /partners | Marketplace: /marketplace
- Open Source Community: /enterprise | Adoption: /adoption

Be concise, helpful, and always guide users to specific pages and actions.
Do NOT make up information. If unsure, point to the documentation.`;

const PORT = process.env.PORT || 8080;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.method === "GET" && (req.url === "/" || req.url === "/api/health")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "frootai-chatbot-api", model: AZURE_OPENAI_DEPLOYMENT }));
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

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. Use POST /api/chat" }));
});

function callAzureOpenAI(messages, credential, useBearer) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ messages, temperature: 0.3, max_tokens: 1000, top_p: 0.9 });
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
