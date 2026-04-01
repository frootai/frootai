const https = require("https");

// Azure OpenAI Configuration (from your Foundry resource)
const AZURE_OPENAI_ENDPOINT = "https://cs-openai-varcvenlme53e.cognitiveservices.azure.com";
const AZURE_OPENAI_DEPLOYMENT = "gpt-4.1";
const AZURE_OPENAI_API_VERSION = "2024-10-21";

// FrootAI grounding context — this makes the chatbot smart about FrootAI
const SYSTEM_PROMPT = `You are **Agent FAI** — the FrootAI AI Assistant and expert on AI architecture, Azure AI services, and the FrootAI ecosystem.

FrootAI is the FAI Engine — an intelligent way of packaging skills, knowledge, and the essential components of the GenAI ecosystem, all synced, not standalone. The FAI Factory builds the knowledge. FAI Packages deliver it. The FAI Toolkit (DevKit, TuneKit, SpecKit) equips every agent, instruction, skill, prompt, hook, workflow, plugin, tool, and guardrail to work as one unified engine under a single context. Like WiFi connects devices, FrootAI UniFAIs your entire Agentic AI Ecosystem.

Your knowledge is grounded in the FrootAI ecosystem:
- Solution Plays (DevKit + TuneKit + SpecKit) covering RAG, agents, landing zones, voice AI, etc.
- MCP tools (static + live + agent chain + AI ecosystem + compute)
- FROOT knowledge modules (Foundations, Reasoning, Orchestration, Operations, Transformation)
- AI/ML glossary terms
- VS Code Extension with commands and standalone engine

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
- Edge AI → Play 19 (Phi-4)
- Anomaly detection → Play 20

Always provide:
- Play number and name
- Link: /user-guide?play=XX for setup guide
- How to get started: Install VS Code Extension → Init DevKit → Init TuneKit

Navigation links:
- Solution Plays: /solution-plays
- Solution Configurator: /configurator
- Setup Guide: /setup-guide
- MCP Tools: /mcp-tooling
- VS Code Extension: /vscode-extension
- Developer Hub: /dev-hub
- Feature Spec: /feature-spec
- Partners: /partners
- Marketplace: /marketplace

Be concise, helpful, and always guide users to specific pages and actions.
Do NOT make up information. If unsure, point to the documentation.`;

module.exports = async function (context, req) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    context.res = {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
    return;
  }

  const { message, history = [] } = req.body || {};

  if (!message) {
    context.res = { status: 400, body: { error: "Missing 'message' in request body" } };
    return;
  }

  // Build messages array with system prompt + history + new message
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-10), // Keep last 10 turns for context
    { role: "user", content: message },
  ];

  try {
    // Get access token via Managed Identity (DefaultAzureCredential equivalent)
    // For local dev, uses AZURE_OPENAI_KEY env var
    const apiKey = process.env.AZURE_OPENAI_KEY;

    if (!apiKey) {
      // Try Managed Identity token
      const tokenResponse = await getAccessToken();
      if (tokenResponse) {
        const response = await callAzureOpenAI(messages, tokenResponse, true);
        context.res = {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: response,
        };
        return;
      }

      context.res = {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: { error: "No AZURE_OPENAI_KEY set and Managed Identity token failed. Set the env var or enable MI." },
      };
      return;
    }

    const response = await callAzureOpenAI(messages, apiKey, false);
    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: response,
    };
  } catch (err) {
    context.log.error("Chat API error:", err.message);
    context.res = {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: { error: "Failed to get response from Azure OpenAI", detail: err.message },
    };
  }
};

function callAzureOpenAI(messages, credential, isToken) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      messages,
      temperature: 0.3,
      max_tokens: 1000,
      top_p: 0.9,
    });

    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    };

    if (isToken) {
      headers["Authorization"] = `Bearer ${credential}`;
    } else {
      headers["api-key"] = credential;
    }

    const url = new URL(
      `/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`,
      AZURE_OPENAI_ENDPOINT
    );

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
          if (parsed.error) {
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
            return;
          }
          const reply = parsed.choices?.[0]?.message?.content || "I could not generate a response.";
          resolve({
            reply,
            model: parsed.model,
            usage: parsed.usage,
          });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function getAccessToken() {
  return new Promise((resolve) => {
    // Azure Managed Identity endpoint
    const tokenUrl = process.env.IDENTITY_ENDPOINT;
    const tokenHeader = process.env.IDENTITY_HEADER;

    if (!tokenUrl || !tokenHeader) {
      resolve(null);
      return;
    }

    const url = new URL(tokenUrl);
    url.searchParams.set("resource", "https://cognitiveservices.azure.com/");
    url.searchParams.set("api-version", "2019-08-01");

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      headers: { "X-IDENTITY-HEADER": tokenHeader },
    };

    https.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.access_token || null);
        } catch {
          resolve(null);
        }
      });
    }).on("error", () => resolve(null));
  });
}
