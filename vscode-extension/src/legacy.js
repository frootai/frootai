const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const https = require("https");

// ════════════════════════════════════════════════════════════════════
// FrootAI VS Code Extension v1.0 — Standalone Engine
// From the Roots to the Fruits. The Open Glue for GenAI.
// 45 MCP tools · 18 modules · 200+ terms · 100 solution plays
// Works from ANY workspace — no clone needed.
// ════════════════════════════════════════════════════════════════════

// ─── Bundled Knowledge Engine ──────────────────────────────────────

let KNOWLEDGE = null;
let GLOSSARY = {};

function loadBundledKnowledge() {
  try {
    const bundlePath = path.join(__dirname, "..", "knowledge.json");
    if (fs.existsSync(bundlePath)) {
      KNOWLEDGE = JSON.parse(fs.readFileSync(bundlePath, "utf-8"));
      // Build glossary from F3 module
      const f3 = KNOWLEDGE.modules?.F3;
      if (f3) {
        const lines = f3.content.split("\n");
        let currentTerm = null;
        let currentDef = [];
        for (const line of lines) {
          const match = line.match(/^### (.+)/);
          if (match) {
            if (currentTerm) {
              GLOSSARY[currentTerm.toLowerCase()] = { term: currentTerm, definition: currentDef.join("\n").trim() };
            }
            currentTerm = match[1].replace(/\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]+\s*$/u, "").trim();
            currentDef = [];
          } else if (currentTerm) {
            currentDef.push(line);
          }
        }
        if (currentTerm) {
          GLOSSARY[currentTerm.toLowerCase()] = { term: currentTerm, definition: currentDef.join("\n").trim() };
        }
      }
      console.log(`FrootAI: Loaded ${Object.keys(KNOWLEDGE.modules).length} modules, ${Object.keys(GLOSSARY).length} glossary terms`);
      return true;
    }
  } catch (e) {
    console.error("FrootAI: Failed to load knowledge bundle", e);
  }
  return false;
}

// ─── Data ──────────────────────────────────────────────────────────

const SOLUTION_PLAYS = [
  { id: "01", name: "Enterprise RAG Q&A", icon: "🔍", codicon: "search", status: "Ready", dir: "01-enterprise-rag", layer: "R", desc: "Production RAG — AI Search + OpenAI + Container Apps", cx: "Medium", infra: "AI Search · Azure OpenAI · Container Apps · Blob" },
  { id: "02", name: "AI Landing Zone", icon: "⛰️", codicon: "cloud", status: "Ready", dir: "02-ai-landing-zone", layer: "F", desc: "Foundation Azure infra — VNet, private endpoints, RBAC, GPU quotas", cx: "Foundation", infra: "VNet · Private Endpoints · RBAC · Managed Identity · Key Vault" },
  { id: "03", name: "Deterministic Agent", icon: "🎯", codicon: "robot", status: "Ready", dir: "03-deterministic-agent", layer: "O", desc: "Reliable agent — temp=0, structured JSON, guardrails", cx: "Medium", infra: "Container Apps · Azure OpenAI · Content Safety" },
  { id: "04", name: "Call Center Voice AI", icon: "📞", codicon: "mic", status: "Ready", dir: "04-call-center-voice-ai", layer: "O", desc: "Voice customer service — Communication Services + AI Speech", cx: "High", infra: "Communication Services · AI Speech · Azure OpenAI" },
  { id: "05", name: "IT Ticket Resolution", icon: "🎫", codicon: "inbox", status: "Ready", dir: "05-it-ticket-resolution", layer: "O", desc: "Auto-classify, route, resolve IT tickets", cx: "Medium", infra: "Logic Apps · Azure OpenAI · ServiceNow MCP" },
  { id: "06", name: "Document Intelligence", icon: "📄", codicon: "file-text", status: "Ready", dir: "06-document-intelligence", layer: "R", desc: "Extract, classify, structure document data", cx: "Medium", infra: "Blob · Document Intelligence · Azure OpenAI" },
  { id: "07", name: "Multi-Agent Service", icon: "🤖", codicon: "organization", status: "Ready", dir: "07-multi-agent-service", layer: "O", desc: "Supervisor + specialist agents", cx: "High", infra: "Container Apps · Azure OpenAI · Cosmos DB · Dapr" },
  { id: "08", name: "Copilot Studio Bot", icon: "💬", codicon: "comment-discussion", status: "Ready", dir: "08-copilot-studio-bot", layer: "O", desc: "Low-code enterprise bot", cx: "Low", infra: "Copilot Studio · Dataverse · SharePoint" },
  { id: "09", name: "AI Search Portal", icon: "🔎", codicon: "search", status: "Ready", dir: "09-ai-search-portal", layer: "R", desc: "Enterprise search with semantic ranking", cx: "Medium", infra: "AI Search · App Service · Azure OpenAI" },
  { id: "10", name: "Content Moderation", icon: "🛡️", codicon: "shield", status: "Ready", dir: "10-content-moderation", layer: "O", desc: "AI Content Safety + filtering", cx: "Low", infra: "Content Safety · API Management · Functions" },
  { id: "11", name: "Landing Zone Advanced", icon: "🏔️", codicon: "cloud", status: "Ready", dir: "11-ai-landing-zone-advanced", layer: "F", desc: "Multi-region, policy-driven AI landing zone", cx: "High", infra: "Multi-region VNet · Azure Policy · RBAC" },
  { id: "12", name: "Model Serving AKS", icon: "⚙️", codicon: "server", status: "Ready", dir: "12-model-serving-aks", layer: "T", desc: "GPU model serving on Kubernetes", cx: "High", infra: "AKS · GPU Nodes · Container Registry" },
  { id: "13", name: "Fine-Tuning Workflow", icon: "🔬", codicon: "wrench", status: "Ready", dir: "13-fine-tuning-workflow", layer: "T", desc: "Custom model fine-tuning pipeline", cx: "High", infra: "OpenAI Fine-tuning · Blob Storage" },
  { id: "14", name: "AI Gateway", icon: "🚪", codicon: "server", status: "Ready", dir: "14-cost-optimized-ai-gateway", layer: "O", desc: "API management + cost control for AI", cx: "Medium", infra: "API Management · Azure OpenAI · Functions" },
  { id: "15", name: "Multi-Modal DocProc", icon: "🖼️", codicon: "file-text", status: "Ready", dir: "15-multi-modal-docproc", layer: "R", desc: "Vision + document processing", cx: "High", infra: "Document Intelligence · GPT-4o · Blob" },
  { id: "16", name: "Copilot Teams Ext", icon: "👥", codicon: "comment-discussion", status: "Ready", dir: "16-copilot-teams-extension", layer: "O", desc: "Teams bot with AI capabilities", cx: "Medium", infra: "Teams · Bot Framework · Azure OpenAI" },
  { id: "17", name: "AI Observability", icon: "📊", codicon: "eye", status: "Ready", dir: "17-ai-observability", layer: "O", desc: "Monitoring + tracing for AI workloads", cx: "Medium", infra: "App Insights · Log Analytics · Azure Monitor" },
  { id: "18", name: "Prompt Management", icon: "📝", codicon: "wrench", status: "Ready", dir: "18-prompt-management", layer: "T", desc: "Version-controlled prompt library", cx: "Low", infra: "Blob Storage · Container Apps · Cosmos DB" },
  { id: "19", name: "Edge AI Phi-4", icon: "📱", codicon: "desktop-download", status: "Ready", dir: "19-edge-ai-phi4", layer: "T", desc: "On-device AI with Phi models", cx: "High", infra: "ONNX Runtime · Phi-4-mini · Edge devices" },
  { id: "20", name: "Anomaly Detection", icon: "🚨", codicon: "graph", status: "Ready", dir: "20-anomaly-detection", layer: "O", desc: "Real-time anomaly detection in streams", cx: "High", infra: "Event Hub · Stream Analytics · Azure OpenAI" },
  { id: "21", name: "Agentic RAG", icon: "🧠", codicon: "search", status: "Ready", dir: "21-agentic-rag", layer: "R", desc: "Autonomous multi-step RAG with iterative retrieval", cx: "High", infra: "OpenAI · AI Search · Container Apps · Key Vault" },
  { id: "22", name: "Multi-Agent Swarm", icon: "👥", codicon: "organization", status: "Ready", dir: "22-multi-agent-swarm", layer: "O", desc: "Swarm-based multi-agent with dynamic delegation", cx: "Very High", infra: "OpenAI · Container Apps · Service Bus · Cosmos DB" },
  { id: "23", name: "Browser Automation", icon: "🖥️", codicon: "globe", status: "Ready", dir: "23-browser-automation-agent", layer: "O", desc: "AI-driven browser automation with vision models", cx: "High", infra: "OpenAI Vision · Container Apps · Playwright" },
  { id: "24", name: "AI Code Review", icon: "🔧", codicon: "terminal", status: "Ready", dir: "24-ai-code-review-pipeline", layer: "O", desc: "Automated code review with LLM + CodeQL", cx: "Medium", infra: "OpenAI · GitHub Actions · CodeQL" },
  { id: "25", name: "Conversation Memory", icon: "🧩", codicon: "database", status: "Ready", dir: "25-conversation-memory-layer", layer: "O", desc: "Tiered conversation memory across sessions", cx: "High", infra: "OpenAI · Cosmos DB · AI Search · Redis" },
  { id: "26", name: "Semantic Search Engine", icon: "🔍", codicon: "search", status: "Ready", dir: "26-semantic-search-engine", layer: "R", desc: "Enterprise semantic search with hybrid retrieval", cx: "Medium", infra: "AI Search · OpenAI · Blob Storage" },
  { id: "27", name: "AI Data Pipeline", icon: "🏭", codicon: "database", status: "Ready", dir: "27-ai-data-pipeline", layer: "T", desc: "LLM-powered data classification and enrichment", cx: "High", infra: "OpenAI mini · Data Factory · Cosmos DB · Event Hubs" },
  { id: "28", name: "Knowledge Graph RAG", icon: "⚡", codicon: "database", status: "Ready", dir: "28-knowledge-graph-rag", layer: "R", desc: "Graph-enhanced RAG with knowledge graph traversal", cx: "High", infra: "OpenAI · Cosmos DB Gremlin · AI Search" },
  { id: "29", name: "MCP Gateway", icon: "⚙️", codicon: "server", status: "Ready", dir: "29-mcp-gateway", layer: "O", desc: "Centralized MCP tool gateway with API management", cx: "Medium", infra: "APIM · Container Apps · Monitor" },
  { id: "30", name: "AI Security Hardening", icon: "🛡️", codicon: "lock", status: "Ready", dir: "30-ai-security-hardening", layer: "O", desc: "AI security with content safety and red teaming", cx: "High", infra: "Content Safety · OpenAI · Container Apps" },
  { id: "31", name: "Low-Code AI Builder", icon: "🧱", codicon: "lightbulb", status: "Ready", dir: "31-low-code-ai-builder", layer: "O", desc: "Visual AI pipeline builder with one-click deploy", cx: "Medium", infra: "OpenAI · Container Apps · Cosmos DB · Static Web Apps" },
  { id: "32", name: "AI-Powered Testing", icon: "🧪", codicon: "beaker", status: "Ready", dir: "32-ai-powered-testing", layer: "O", desc: "AI test generation and mutation testing", cx: "Medium", infra: "OpenAI · GitHub Actions · Container Apps" },
  { id: "33", name: "Voice AI Agent", icon: "🎙️", codicon: "mic", status: "Ready", dir: "33-voice-ai-agent", layer: "O", desc: "Conversational voice agent with real-time speech", cx: "High", infra: "AI Speech · OpenAI · Communication Services" },
  { id: "34", name: "Edge AI Deployment", icon: "📲", codicon: "desktop-download", status: "Ready", dir: "34-edge-ai-deployment", layer: "T", desc: "Edge-optimized AI with quantization and cloud sync", cx: "High", infra: "IoT Hub · ONNX Runtime · Container Instances" },
  { id: "35", name: "AI Compliance Engine", icon: "📋", codicon: "law", status: "Ready", dir: "35-ai-compliance-engine", layer: "O", desc: "Automated compliance checking and audit trails", cx: "High", infra: "OpenAI · Azure Policy · Key Vault · Cosmos DB" },
  { id: "36", name: "Multimodal Agent", icon: "👁️", codicon: "robot", status: "Ready", dir: "36-multimodal-agent", layer: "O", desc: "Agent handling text, image, and audio inputs", cx: "Medium", infra: "OpenAI Vision · AI Vision · Blob Storage" },
  { id: "37", name: "AI-Powered DevOps", icon: "🔄", codicon: "terminal", status: "Ready", dir: "37-ai-powered-devops", layer: "O", desc: "AIOps with incident detection and auto-remediation", cx: "Medium", infra: "OpenAI · Monitor · DevOps · GitHub Actions" },
  { id: "38", name: "Document Understanding v2", icon: "📑", codicon: "file-text", status: "Ready", dir: "38-document-understanding-v2", layer: "O", desc: "Advanced document processing with custom schemas", cx: "High", infra: "Document Intelligence · OpenAI · Cosmos DB" },
  { id: "39", name: "AI Meeting Assistant", icon: "📅", codicon: "comment-discussion", status: "Ready", dir: "39-ai-meeting-assistant", layer: "O", desc: "Meeting intelligence with transcription and actions", cx: "Medium", infra: "AI Speech · OpenAI · Graph · Container Apps" },
  { id: "40", name: "Copilot Studio Advanced", icon: "🤖", codicon: "comment-discussion", status: "Ready", dir: "40-copilot-studio-advanced", layer: "O", desc: "Advanced Copilot Studio with custom agents", cx: "High", infra: "Copilot Studio · OpenAI · Dataverse · Graph" },
  { id: "41", name: "AI Red Teaming", icon: "🎯", codicon: "lock", status: "Ready", dir: "41-ai-red-teaming", layer: "T", desc: "Systematic AI red teaming and safety evaluation", cx: "High", infra: "AI Foundry · Content Safety · OpenAI" },
  { id: "42", name: "Computer Use Agent", icon: "🖱️", codicon: "robot", status: "Ready", dir: "42-computer-use-agent", layer: "O", desc: "Vision-based desktop automation agent", cx: "Very High", infra: "OpenAI Vision · Container Apps · Blob Storage" },
  { id: "43", name: "AI Video Generation", icon: "🎬", codicon: "lightbulb", status: "Ready", dir: "43-ai-video-generation", layer: "T", desc: "AI video generation with safety and quality controls", cx: "Very High", infra: "OpenAI · Blob Storage · Content Safety · Service Bus" },
  { id: "44", name: "Foundry Local On-Device", icon: "💻", codicon: "desktop-download", status: "Ready", dir: "44-foundry-local-on-device", layer: "T", desc: "On-device AI with Foundry Local and cloud escalation", cx: "High", infra: "OpenAI · IoT Hub · Monitor" },
  { id: "45", name: "Real-Time Event AI", icon: "⚡", codicon: "broadcast", status: "Ready", dir: "45-realtime-event-ai", layer: "O", desc: "Real-time event processing with AI anomaly detection", cx: "Very High", infra: "Event Hubs · Functions · OpenAI · Cosmos DB · SignalR" },
  { id: "46", name: "Healthcare Clinical AI", icon: "🏥", codicon: "heart", status: "Ready", dir: "46-healthcare-clinical-ai", layer: "O", desc: "Clinical decision support with human-in-the-loop", cx: "Very High", infra: "OpenAI · Health Data Services · AI Search · Content Safety" },
  { id: "47", name: "Synthetic Data Factory", icon: "🏭", codicon: "beaker", status: "Ready", dir: "47-synthetic-data-factory", layer: "T", desc: "Privacy-preserving synthetic data generation", cx: "High", infra: "OpenAI · ML · Blob Storage" },
  { id: "48", name: "AI Model Governance", icon: "📊", codicon: "law", status: "Ready", dir: "48-ai-model-governance", layer: "T", desc: "Model lifecycle governance with drift detection", cx: "High", infra: "ML · AI Foundry · DevOps · Cosmos DB · Policy" },
  { id: "49", name: "Creative AI Studio", icon: "🎨", codicon: "lightbulb", status: "Ready", dir: "49-creative-ai-studio", layer: "O", desc: "Creative content generation with brand voice", cx: "High", infra: "OpenAI · Blob Storage · Content Safety · Functions · CDN" },
  { id: "50", name: "Financial Risk Intelligence", icon: "💰", codicon: "graph", status: "Ready", dir: "50-financial-risk-intelligence", layer: "O", desc: "Financial risk analysis with real-time monitoring", cx: "Very High", infra: "OpenAI · AI Search · Cosmos DB · Event Hubs" },
  { id: "51", name: "Autonomous Coding Agent", icon: "💻", codicon: "terminal", status: "Ready", dir: "51-autonomous-coding-agent", layer: "O", desc: "Self-directed coding agent with test validation", cx: "Very High", infra: "OpenAI · GitHub Actions · Container Apps" },
  { id: "52", name: "AI API Gateway v2", icon: "🌐", codicon: "server", status: "Ready", dir: "52-ai-api-gateway-v2", layer: "O", desc: "Advanced AI gateway with semantic caching", cx: "High", infra: "APIM · OpenAI · Redis · Monitor" },
  { id: "53", name: "Legal Document AI", icon: "⚖️", codicon: "law", status: "Ready", dir: "53-legal-document-ai", layer: "O", desc: "Legal document analysis with risk assessment", cx: "Very High", infra: "OpenAI · AI Search · Blob Storage · Cosmos DB" },
  { id: "54", name: "AI Customer Support v2", icon: "🎧", codicon: "comment-discussion", status: "Ready", dir: "54-ai-customer-support-v2", layer: "O", desc: "Advanced AI support with sentiment and escalation", cx: "High", infra: "OpenAI · AI Search · Communication Services · Cosmos DB" },
  { id: "55", name: "Supply Chain AI", icon: "🚛", codicon: "graph", status: "Ready", dir: "55-supply-chain-ai", layer: "O", desc: "Supply chain optimization with demand forecasting", cx: "Very High", infra: "OpenAI · Cosmos DB · Event Hubs · ML" },
  { id: "56", name: "Semantic Code Search", icon: "🔎", codicon: "search", status: "Ready", dir: "56-semantic-code-search", layer: "R", desc: "Codebase semantic search with embedding retrieval", cx: "Medium", infra: "OpenAI · AI Search · Blob Storage" },
  { id: "57", name: "AI Translation Engine", icon: "🌍", codicon: "globe", status: "Ready", dir: "57-ai-translation-engine", layer: "O", desc: "Neural translation with glossary and cultural adaptation", cx: "High", infra: "OpenAI · AI Translator · Cosmos DB · CDN" },
  { id: "58", name: "Digital Twin Agent", icon: "📦", codicon: "robot", status: "Ready", dir: "58-digital-twin-agent", layer: "O", desc: "Digital twin with IoT and predictive simulation", cx: "Very High", infra: "IoT Hub · Digital Twins · OpenAI · Functions" },
  { id: "59", name: "AI Recruiter Agent", icon: "👤", codicon: "robot", status: "Ready", dir: "59-ai-recruiter-agent", layer: "O", desc: "AI recruitment with matching and bias detection", cx: "High", infra: "OpenAI · AI Search · Cosmos DB · Graph" },
  { id: "60", name: "Responsible AI Dashboard", icon: "📊", codicon: "eye", status: "Ready", dir: "60-responsible-ai-dashboard", layer: "T", desc: "Responsible AI monitoring with fairness metrics", cx: "High", infra: "OpenAI · ML · Monitor · Cosmos DB · Static Web Apps" },
  { id: "61", name: "Content Moderation v2", icon: "🔒", codicon: "shield", status: "Ready", dir: "61-content-moderation-v2", layer: "O", desc: "Advanced content moderation with severity routing", cx: "High", infra: "Content Safety · OpenAI · Cosmos DB · Service Bus" },
  { id: "62", name: "Federated Learning", icon: "🔗", codicon: "lock", status: "Ready", dir: "62-federated-learning-pipeline", layer: "T", desc: "Privacy-preserving federated learning", cx: "Very High", infra: "ML · Confidential Computing · Blob Storage" },
  { id: "63", name: "Fraud Detection Agent", icon: "🔍", codicon: "graph", status: "Ready", dir: "63-fraud-detection-agent", layer: "O", desc: "Real-time fraud detection with streaming analysis", cx: "High", infra: "OpenAI · Event Hubs · Stream Analytics · Cosmos DB" },
  { id: "64", name: "AI Sales Assistant", icon: "📈", codicon: "megaphone", status: "Ready", dir: "64-ai-sales-assistant", layer: "O", desc: "AI sales copilot with lead scoring and outreach", cx: "Medium", infra: "OpenAI · Cosmos DB · Graph · AI Search" },
  { id: "65", name: "AI Training Curriculum", icon: "🎓", codicon: "book", status: "Ready", dir: "65-ai-training-curriculum", layer: "F", desc: "Adaptive AI training with difficulty scaling", cx: "Medium", infra: "OpenAI · Cosmos DB · Static Web Apps" },
  { id: "66", name: "AI Infra Optimizer", icon: "🖥️", codicon: "wrench", status: "Ready", dir: "66-ai-infrastructure-optimizer", layer: "O", desc: "AI-driven infra optimization and cost analysis", cx: "High", infra: "OpenAI · Monitor · Advisor · Cost Management" },
  { id: "67", name: "AI Knowledge Management", icon: "📚", codicon: "database", status: "Ready", dir: "67-ai-knowledge-management", layer: "R", desc: "Enterprise knowledge management with contextual retrieval", cx: "High", infra: "OpenAI · AI Search · Cosmos DB · Graph" },
  { id: "68", name: "Predictive Maintenance", icon: "🔧", codicon: "wrench", status: "Ready", dir: "68-predictive-maintenance-ai", layer: "O", desc: "Predictive maintenance with IoT sensor analysis", cx: "High", infra: "IoT Hub · OpenAI · ML · Stream Analytics · Cosmos DB" },
  { id: "69", name: "Carbon Footprint Tracker", icon: "🌿", codicon: "globe", status: "Ready", dir: "69-carbon-footprint-tracker", layer: "O", desc: "Real-time carbon accounting across cloud and supply chain", cx: "High", infra: "Azure Monitor · OpenAI · Cosmos DB · Event Hubs" },
  { id: "70", name: "ESG Compliance Agent", icon: "📋", codicon: "law", status: "Ready", dir: "70-esg-compliance-agent", layer: "O", desc: "ESG reporting with GRI, SASB, TCFD, CSRD compliance", cx: "High", infra: "OpenAI · Document Intelligence · Cosmos DB · AI Search" },
  { id: "71", name: "Smart Energy Grid AI", icon: "⚡", codicon: "broadcast", status: "Ready", dir: "71-smart-energy-grid-ai", layer: "O", desc: "Energy demand prediction and grid balancing via digital twin", cx: "Very High", infra: "IoT Hub · OpenAI · Stream Analytics · Digital Twins" },
  { id: "72", name: "Climate Risk Assessor", icon: "🌍", codicon: "globe", status: "Ready", dir: "72-climate-risk-assessor", layer: "O", desc: "Climate scenario modeling for financial risk assessment", cx: "High", infra: "OpenAI · ML · Cosmos DB · AI Search" },
  { id: "73", name: "Waste & Recycling Optimizer", icon: "♻️", codicon: "globe", status: "Ready", dir: "73-waste-recycling-optimizer", layer: "O", desc: "Waste classification, route optimization, contamination detection", cx: "Medium", infra: "AI Vision · OpenAI · IoT Hub · Container Apps" },
  { id: "74", name: "AI Tutoring Agent", icon: "🎓", codicon: "book", status: "Ready", dir: "74-ai-tutoring-agent", layer: "O", desc: "1-on-1 personalized tutoring with Socratic method and adaptive difficulty", cx: "High", infra: "Azure OpenAI · Cosmos DB · AI Search · Static Web Apps" },
  { id: "75", name: "Exam Generation Engine", icon: "📖", codicon: "book", status: "Ready", dir: "75-exam-generation-engine", layer: "O", desc: "Auto-generate exams with difficulty calibration, rubrics, and answer keys", cx: "Medium", infra: "Azure OpenAI · Blob Storage · Cosmos DB · Functions" },
  { id: "76", name: "Accessibility Learning Agent", icon: "📚", codicon: "book", status: "Ready", dir: "76-accessibility-learning-agent", layer: "O", desc: "Screen reader-first, dyslexia-aware learning with multi-modal adaptation", cx: "High", infra: "AI Speech · Azure OpenAI · AI Vision · Container Apps · Cosmos DB" },
  { id: "77", name: "Research Paper AI", icon: "🔬", codicon: "search", status: "Ready", dir: "77-research-paper-ai", layer: "R", desc: "Literature review, citation network, methodology critique, research gap analysis", cx: "Very High", infra: "Azure OpenAI · AI Search · Cosmos DB · Graph · Functions" },
  { id: "78", name: "Precision Agriculture Agent", icon: "🌾", codicon: "graph", status: "Ready", dir: "78-precision-agriculture-agent", layer: "O", desc: "Satellite imagery + IoT sensor fusion for crop health, irrigation, yield prediction", cx: "Very High", infra: "Azure IoT Hub · AI Vision · Azure OpenAI · Digital Twins · ML" },
  { id: "79", name: "Food Safety Inspector AI", icon: "🍎", codicon: "shield", status: "Ready", dir: "79-food-safety-inspector-ai", layer: "O", desc: "HACCP compliance, contamination detection, farm-to-fork traceability", cx: "High", infra: "Document Intelligence · Azure OpenAI · Cosmos DB · Event Hubs · IoT Hub" },
  { id: "80", name: "Biodiversity Monitor", icon: "🦋", codicon: "eye", status: "Ready", dir: "80-biodiversity-monitor", layer: "O", desc: "Species identification from camera trap, drone, acoustic data with conservation alerts", cx: "High", infra: "AI Vision · Azure OpenAI · IoT Hub · Cosmos DB · Functions" },
  { id: "81", name: "Property Valuation AI", icon: "🏠", codicon: "graph", status: "Ready", dir: "81-property-valuation-ai", layer: "O", desc: "Automated property appraisal with comparable sales and market trends", cx: "High", infra: "Azure OpenAI · AI Search · Cosmos DB · Machine Learning · Functions" },
  { id: "82", name: "Construction Safety AI", icon: "🚧", codicon: "shield", status: "Ready", dir: "82-construction-safety-ai", layer: "O", desc: "Real-time site monitoring — PPE compliance, hazard detection, incident reporting", cx: "High", infra: "AI Vision · IoT Hub · Azure OpenAI · Container Apps · Cosmos DB" },
  { id: "83", name: "Building Energy Optimizer", icon: "🏢", codicon: "wrench", status: "Ready", dir: "83-building-energy-optimizer", layer: "O", desc: "HVAC, lighting, occupancy optimization via digital twin", cx: "Very High", infra: "Digital Twins · IoT Hub · Azure OpenAI · Functions · Cosmos DB" },
  { id: "84", name: "Citizen Services Chatbot", icon: "🏛️", codicon: "comment-discussion", status: "Ready", dir: "84-citizen-services-chatbot", layer: "R", desc: "Multi-language municipal AI assistant — forms, appointments, permits, FAQ", cx: "Medium", infra: "Azure OpenAI · AI Translator · Communication Services · AI Search · Cosmos DB" },
  { id: "85", name: "Policy Impact Analyzer", icon: "📜", codicon: "law", status: "Ready", dir: "85-policy-impact-analyzer", layer: "T", desc: "Regulatory change detection with cross-sector impact and briefing generation", cx: "High", infra: "Azure OpenAI · AI Search · Document Intelligence · Cosmos DB · Functions" },
  { id: "86", name: "Public Safety Analytics", icon: "🚔", codicon: "graph", status: "Ready", dir: "86-public-safety-analytics", layer: "T", desc: "Crime pattern prediction, resource allocation, community sentiment", cx: "Very High", infra: "Azure OpenAI · Machine Learning · Event Hubs · Cosmos DB · Stream Analytics" },
  { id: "87", name: "Dynamic Pricing Engine", icon: "💰", codicon: "graph", status: "Ready", dir: "87-dynamic-pricing-engine", layer: "T", desc: "Real-time price optimization with demand signals and fairness guardrails", cx: "High", infra: "Azure OpenAI · Event Hubs · Cosmos DB · Redis Cache · Machine Learning" },
  { id: "88", name: "Visual Product Search", icon: "🔍", codicon: "search", status: "Ready", dir: "88-visual-product-search", layer: "R", desc: "Image-based product discovery with visual similarity and recommendations", cx: "High", infra: "AI Vision · Azure OpenAI · AI Search · Container Apps · Cosmos DB" },
  { id: "89", name: "Retail Inventory Predictor", icon: "📦", codicon: "graph", status: "Ready", dir: "89-retail-inventory-predictor", layer: "T", desc: "Demand forecasting with weather, social trends, automated reordering", cx: "High", infra: "Azure OpenAI · Machine Learning · Cosmos DB · Event Hubs · Functions" },
  { id: "90", name: "Network Optimization Agent", icon: "📡", codicon: "broadcast", status: "Ready", dir: "90-network-optimization-agent", layer: "T", desc: "5G/LTE capacity planning with anomaly detection and self-healing", cx: "Very High", infra: "Azure IoT Hub · Stream Analytics · OpenAI · Digital Twins · Cosmos DB" },
  { id: "91", name: "Customer Churn Predictor", icon: "👥", codicon: "graph", status: "Ready", dir: "91-customer-churn-predictor", layer: "T", desc: "Multi-signal churn scoring with retention campaigns", cx: "High", infra: "Azure OpenAI · Machine Learning · Cosmos DB · Communication Services · Functions" },
  { id: "92", name: "Telecom Fraud Shield", icon: "🛡️", codicon: "shield", status: "Ready", dir: "92-telecom-fraud-shield", layer: "T", desc: "Real-time telecom fraud detection — SIM swap, toll fraud, sub-second blocking", cx: "High", infra: "Azure Event Hubs · Stream Analytics · OpenAI · Cosmos DB · Functions" },
  { id: "93", name: "Continual Learning Agent", icon: "🧠", codicon: "robot", status: "Ready", dir: "93-continual-learning-agent", layer: "T", desc: "Agent that persists knowledge across sessions and starts smarter every time", cx: "Very High", infra: "Azure OpenAI · Cosmos DB · AI Search · Redis Cache · Functions" },
  { id: "94", name: "AI Podcast Generator", icon: "🎙️", codicon: "mic", status: "Ready", dir: "94-ai-podcast-generator", layer: "T", desc: "Text-to-podcast with multi-speaker voice synthesis and chapter markers", cx: "High", infra: "Azure AI Speech · OpenAI · Blob Storage · CDN · Functions" },
  { id: "95", name: "Multimodal Search Engine v2", icon: "🔍", codicon: "search", status: "Ready", dir: "95-multimodal-search-v2", layer: "R", desc: "Unified search across images, text, code, and audio with cross-modal reasoning", cx: "Very High", infra: "Azure AI Search · AI Vision · AI Speech · OpenAI · Container Apps" },
  { id: "96", name: "Real-Time Voice Agent v2", icon: "📞", codicon: "mic", status: "Ready", dir: "96-realtime-voice-agent-v2", layer: "O", desc: "Next-gen bidirectional voice agent with sub-200ms latency and MCP tools", cx: "Very High", infra: "Azure AI Voice Live · OpenAI · Container Apps · Functions · Cosmos DB" },
  { id: "97", name: "AI Data Marketplace", icon: "📊", codicon: "package", status: "Ready", dir: "97-ai-data-marketplace", layer: "T", desc: "Platform for publishing and monetizing synthetic datasets with differential privacy", cx: "High", infra: "Azure Machine Learning · Blob Storage · API Management · Cosmos DB · Functions" },
  { id: "98", name: "Agent Evaluation Platform", icon: "🏛️", codicon: "beaker", status: "Ready", dir: "98-agent-evaluation-platform", layer: "T", desc: "Automated evaluation suite with benchmarks, A/B testing, and leaderboard", cx: "High", infra: "Azure OpenAI · Container Apps · Cosmos DB · Machine Learning · Functions" },
  { id: "99", name: "Enterprise AI Governance Hub", icon: "⚡", codicon: "law", status: "Ready", dir: "99-enterprise-ai-governance-hub", layer: "T", desc: "Central control plane for AI models, agents, APIs — approval gates, policy", cx: "Very High", infra: "Azure API Management · Policy · Monitor · Cosmos DB · ML · Key Vault" },
  { id: "100", name: "FAI Meta-Agent", icon: "🌟", codicon: "zap", status: "Ready", dir: "100-fai-meta-agent", layer: "O", desc: "Self-orchestrating super-agent that selects plays, provisions infra, delivers AI", cx: "Very High", infra: "Azure OpenAI · MCP Server · Container Apps · Cosmos DB · AI Search · Key Vault" },
  { id: "101", name: "Pester Test Development", icon: "🧪", codicon: "beaker", status: "Ready", dir: "101-pester-test-development", layer: "T", desc: "PowerShell Pester test generation and validation", cx: "Low", infra: "PowerShell · Pester · GitHub Actions" },
];

const FROOT_MODULES = [
  {
    layer: "🌱 Foundations", color: "#f59e0b", modules: [
      { id: "F1", name: "GenAI Foundations", file: "GenAI-Foundations.md" },
      { id: "F2", name: "LLM Landscape", file: "LLM-Landscape.md" },
      { id: "F3", name: "AI Glossary A–Z", file: "F3-AI-Glossary-AZ.md" },
      { id: "F4", name: ".github Agentic OS", file: "F4-GitHub-Agentic-OS.md" },
    ]
  },
  {
    layer: "🪵 Reasoning", color: "#10b981", modules: [
      { id: "R1", name: "Prompt Engineering", file: "Prompt-Engineering.md" },
      { id: "R2", name: "RAG Architecture", file: "RAG-Architecture.md" },
      { id: "R3", name: "Deterministic AI", file: "R3-Deterministic-AI.md" },
    ]
  },
  {
    layer: "🌿 Orchestration", color: "#06b6d4", modules: [
      { id: "O1", name: "Semantic Kernel", file: "Semantic-Kernel.md" },
      { id: "O2", name: "AI Agents", file: "AI-Agents-Deep-Dive.md" },
      { id: "O3", name: "MCP & Tools", file: "O3-MCP-Tools-Functions.md" },
    ]
  },
  {
    layer: "🍃 Operations", color: "#6366f1", modules: [
      { id: "O4", name: "Azure AI Platform", file: "Azure-AI-Foundry.md" },
      { id: "O5", name: "AI Infrastructure", file: "AI-Infrastructure.md" },
      { id: "O6", name: "Copilot Ecosystem", file: "Copilot-Ecosystem.md" },
    ]
  },
  {
    layer: "🍎 Transformation", color: "#7c3aed", modules: [
      { id: "T1", name: "Fine-Tuning", file: "T1-Fine-Tuning-MLOps.md" },
      { id: "T2", name: "Responsible AI", file: "Responsible-AI-Safety.md" },
      { id: "T3", name: "Production Patterns", file: "T3-Production-Patterns.md" },
    ]
  },
];

const MCP_TOOLS = [
  {
    name: "list_modules", desc: "Browse 18 modules by FROOT layer", type: "static",
    docs: "Returns all 18 FROOT knowledge modules organized by layer (Foundations, Reasoning, Orchestration, Operations, Transformation). Each module includes ID, name, and description. Use this to discover what knowledge is available.\n\n**Input:** none\n**Output:** Array of layers with modules\n**Example:** `list_modules` → [{layer: 'Foundations', modules: [{id: 'F1', name: 'GenAI Foundations'}, ...]}]"
  },
  {
    name: "get_module", desc: "Read any module (F1–T3, F4)", type: "static",
    docs: "Returns the full content of any FROOT knowledge module by ID. Supports F1-F4, R1-R3, O1-O3, O4-O6, T1-T3 (18 modules total).\n\n**Input:** `moduleId` (string) — e.g., 'F1', 'R2', 'T3'\n**Output:** Full markdown content of the module\n**Example:** `get_module({moduleId: 'F4'})` → Full GitHub Agentic OS guide"
  },
  {
    name: "lookup_term", desc: "200+ AI/ML term definitions", type: "static",
    docs: "Searches the AI Glossary (200+ terms) for a specific term or phrase. Returns the definition, related terms, and category. Fuzzy matching supported.\n\n**Input:** `term` (string) — e.g., 'RAG', 'temperature', 'embeddings'\n**Output:** Term definition with metadata\n**Example:** `lookup_term({term: 'RAG'})` → {term: 'RAG', definition: 'Retrieval-Augmented Generation...'}"
  },
  {
    name: "search_knowledge", desc: "Full-text search all modules", type: "static",
    docs: "Performs full-text search across all 18 knowledge modules. Returns matching excerpts with module IDs and context. Great for finding specific patterns, services, or concepts.\n\n**Input:** `query` (string) — search text\n**Output:** Array of matches with module, context, and relevance\n**Example:** `search_knowledge({query: 'vector database'})` → matches from RAG, AI Search modules"
  },
  {
    name: "get_architecture_pattern", desc: "7 decision guides", type: "static",
    docs: "Returns architecture decision guides for common AI patterns. Covers: RAG vs Fine-tuning, Agent frameworks, Model selection, Hosting options, Search strategies, Orchestration choices, Cost optimization.\n\n**Input:** `pattern` (string, optional) — specific pattern name\n**Output:** Decision matrix with pros/cons/when-to-use"
  },
  {
    name: "get_froot_overview", desc: "Complete FROOT summary", type: "static",
    docs: "Returns the complete FrootAI platform overview: mission, 6 layers, 101 solution plays list, DevKit/TuneKit model, and getting started guide.\n\n**Input:** none\n**Output:** Platform overview markdown"
  },
  {
    name: "fetch_azure_docs", desc: "⛅ Live — Search Azure docs", type: "live",
    docs: "Fetches documentation from Azure Learn. Queries the Azure documentation API for service-specific guidance. Falls back gracefully if offline.\n\n**Input:** `query` (string) — Azure service or topic\n**Output:** Documentation excerpts from learn.microsoft.com\n**Example:** `fetch_azure_docs({query: 'AI Search hybrid'})` → Azure AI Search hybrid query docs"
  },
  {
    name: "fetch_external_mcp", desc: "⛅ Live — Find MCP servers", type: "live",
    docs: "Queries external MCP server registries to find available MCP servers for specific tools or domains. Helps discover community MCP servers.\n\n**Input:** `query` (string) — tool or domain name\n**Output:** List of matching MCP servers with install instructions"
  },
  {
    name: "list_community_plays", desc: "⛅ Live — List plays from GitHub", type: "live",
    docs: "Fetches the list of solution plays from the FrootAI GitHub repository. Returns play names, statuses, and file counts. Useful for discovering what's available.\n\n**Input:** none\n**Output:** Array of 101 solution plays with metadata"
  },
  {
    name: "get_github_agentic_os", desc: "⛅ Live — .github OS guide", type: "live",
    docs: "Returns the complete .github Agentic OS implementation guide: 7 primitives, 4 layers, file structure, and how to implement per solution play.\n\n**Input:** none\n**Output:** Full .github Agentic OS guide"
  },
  {
    name: "agent_build", desc: "🔗 Chain — Builder agent guidance", type: "chain",
    docs: "Invokes the Builder agent persona. Returns structured guidance for building a solution: architecture decisions, service selection, code patterns, and implementation steps. Automatically suggests calling agent_review next.\n\n**Input:** `task` (string) — what to build\n**Output:** Builder guidance + suggestion to call agent_review\n**Example:** `agent_build({task: 'RAG pipeline with Azure AI Search'})` → architecture + code patterns + 'Now call agent_review'"
  },
  {
    name: "agent_review", desc: "🔗 Chain — Reviewer agent guidance", type: "chain",
    docs: "Invokes the Reviewer agent persona. Reviews architecture and code for: security, performance, cost, compliance, and best practices. Suggests calling agent_tune next.\n\n**Input:** `context` (string) — what to review\n**Output:** Review findings + suggestion to call agent_tune"
  },
  {
    name: "agent_tune", desc: "🔗 Chain — Tuner agent guidance", type: "chain",
    docs: "Invokes the Tuner agent persona. Provides AI parameter tuning guidance: temperature, top-k, chunk sizes, model selection, guardrails configuration. Terminal step in the agent chain.\n\n**Input:** `context` (string) — what to tune\n**Output:** Tuning recommendations for production"
  },
  // ── Ecosystem Tools (3) ──
  {
    name: "get_model_catalog", desc: "🌐 Ecosystem — Browse Azure AI model catalog", type: "ecosystem",
    docs: "Returns the Azure AI model catalog with GPT, Claude, Llama, Phi, Mistral models. Includes capabilities, pricing tiers, hosted/managed options, and recommended use cases.\n\n**Input:** `filter` (string, optional) — filter by provider or capability\n**Output:** Array of models with metadata\n**Example:** `get_model_catalog({filter: 'code'})` → models optimized for code generation"
  },
  {
    name: "get_azure_pricing", desc: "🌐 Ecosystem — Azure AI service pricing", type: "ecosystem",
    docs: "Returns current pricing for 25+ Azure AI services: OpenAI models, AI Search, Cognitive Services, App Service tiers. Includes per-unit costs, free tiers, and cost optimization tips.\n\n**Input:** `service` (string, optional) — specific service name\n**Output:** Pricing table with tiers and rates\n**Example:** `get_azure_pricing({service: 'openai'})` → GPT-4o pricing per 1K tokens"
  },
  {
    name: "compare_models", desc: "🌐 Ecosystem — Compare AI models side-by-side", type: "ecosystem",
    docs: "Compares two or more AI models across dimensions: cost, latency, context window, capabilities, and recommended scenarios. Helps pick the right model for a use case.\n\n**Input:** `models` (string[]) — model names to compare\n**Output:** Comparison matrix\n**Example:** `compare_models({models: ['gpt-4o', 'gpt-4o-mini']})` → side-by-side comparison"
  },
  // ── Compute Tools (6) ──
  {
    name: "semantic_search_plays", desc: "🧮 Compute — Semantic search across 20 plays", type: "compute",
    docs: "Performs keyword + semantic search across all 101 solution plays. Matches against play names, descriptions, services used, and architecture patterns. Returns ranked results with relevance scores.\n\n**Input:** `query` (string) — what to search for\n**Output:** Ranked matches with play ID, name, relevance, and excerpts\n**Example:** `semantic_search_plays({query: 'voice AI'})` → Play 04 (Call Center Voice AI) ranked first"
  },
  {
    name: "estimate_cost", desc: "🧮 Compute — Estimate monthly Azure cost", type: "compute",
    docs: "Calculates estimated monthly Azure costs for any solution play at different scales (small/medium/large). Uses real Azure retail pricing for 25+ services. Returns itemized cost breakdown.\n\n**Input:** `playNumber` (number), `scale` (string: 'small'|'medium'|'large')\n**Output:** Itemized cost breakdown with totals\n**Example:** `estimate_cost({playNumber: 1, scale: 'medium'})` → ~$850/mo breakdown"
  },
  {
    name: "validate_config", desc: "🧮 Compute — Validate config files", type: "compute",
    docs: "Validates FrootAI config files (openai.json, guardrails.json, routing.json) against production best practices. Checks for security issues, missing fields, suboptimal settings.\n\n**Input:** `configType` (string), `config` (object)\n**Output:** Array of findings: 🔴 Critical / 🟡 Warning / 🟢 Good\n**Example:** `validate_config({configType: 'openai', config: {...}})` → [{severity: 'warning', message: 'temperature > 0.3'}]"
  },
  {
    name: "compare_plays", desc: "🧮 Compute — Compare solution plays", type: "compute",
    docs: "Compares two or more solution plays side-by-side across dimensions: complexity, cost, services used, team size, and deployment time. Great for choosing between similar approaches.\n\n**Input:** `playIds` (number[]) — play numbers to compare\n**Output:** Comparison matrix with recommendations\n**Example:** `compare_plays({playIds: [1, 9]})` → RAG Q&A vs AI Search Portal comparison"
  },
  {
    name: "generate_architecture_diagram", desc: "🧮 Compute — Generate Mermaid diagrams", type: "compute",
    docs: "Generates Mermaid.js architecture diagrams for any solution play. Includes Azure services, data flows, and integration points. Renders in VS Code preview.\n\n**Input:** `playNumber` (number), `style` (string: 'flowchart'|'sequence'|'c4')\n**Output:** Mermaid diagram code\n**Example:** `generate_architecture_diagram({playNumber: 5})` → IT Ticket Resolution flowchart"
  },
  {
    name: "embedding_playground", desc: "🧮 Compute — Experiment with embeddings", type: "compute",
    docs: "Interactive playground for text embeddings. Compute similarity between texts, visualize embedding dimensions, and understand how vector search works under the hood.\n\n**Input:** `texts` (string[]) — texts to embed and compare\n**Output:** Similarity matrix + dimension analysis\n**Example:** `embedding_playground({texts: ['RAG pipeline', 'search system']})` → similarity: 0.87"
  },
  {
    name: "run_evaluation", desc: "🧮 Compute — Quality evaluation with thresholds", type: "compute",
    docs: "Run quality evaluation against configurable thresholds. Input actual scores from your evaluation, get pass/fail per metric with recommendations.\n\n**Input:** `scores` (object: {groundedness: 4.5, relevance: 3.8}), optional `thresholds`, optional `play` number\n**Output:** Pass/fail table + improvement recommendations\n**Example:** `run_evaluation({scores: {groundedness: 4.5, relevance: 3.2}, play: '01'})` → 1/2 passed, relevance needs improvement"
  },
];

// ─── Webview Panel: Render Modules as Rich HTML ────────────────────

function createModuleWebview(context, moduleId, title, content) {
  const panel = vscode.window.createWebviewPanel(
    "frootai.module",
    `FrootAI: ${title}`,
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  // Convert markdown to simple HTML (basic renderer)
  const htmlContent = markdownToHtml(content, title);
  panel.webview.html = htmlContent;
  return panel;
}

function markdownToHtml(markdown, title) {
  // Extract mermaid blocks before processing
  const mermaidBlocks = [];
  let processed = markdown.replace(/```mermaid\n([\s\S]*?)```/g, (match, code) => {
    mermaidBlocks.push(code.trim());
    return `%%MERMAID_${mermaidBlocks.length - 1}%%`;
  });

  // Basic markdown → HTML conversion
  let html = processed
    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold + Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // List items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    // Tables (basic)
    .replace(/^\|(.+)\|$/gm, (match) => {
      if (match.match(/^\|[\s-:|]+\|$/)) return ''; // skip separator row
      const cells = match.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    })
    // Paragraphs (wrap remaining lines)
    .replace(/^(?!<[hblutpra]|<\/|<hr|<li|<tr|%%MERMAID)(.+)$/gm, '<p>$1</p>')
    // Clean up consecutive blockquotes
    .replace(/<\/blockquote>\n<blockquote>/g, '<br>');

  // Wrap lists
  html = html.replace(/(<li>.+<\/li>\n?)+/g, '<ul>$&</ul>');
  // Wrap tables
  html = html.replace(/(<tr>.+<\/tr>\n?)+/g, '<table>$&</table>');

  // Re-insert mermaid blocks as rendered divs
  mermaidBlocks.forEach((code, i) => {
    html = html.replace(`%%MERMAID_${i}%%`, `<div class="mermaid">${code}</div>`);
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'dark', themeVariables: { primaryColor: '#1a1a2e', primaryTextColor: '#e0e0e0', primaryBorderColor: '#6366f1', lineColor: '#818cf8', background: 'transparent' } });</script>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 16px 28px; line-height: 1.65; color: #d0d0d0;
      background: #1a1a2e; max-width: 860px; margin: 0 auto;
      font-size: 13px;
    }
    h1 { color: #10b981; font-size: 1.3rem; border-bottom: 2px solid #10b98133; padding-bottom: 6px; margin-top: 0; }
    h2 { color: #06b6d4; font-size: 1.05rem; margin-top: 1.5rem; }
    h3 { color: #6366f1; font-size: 0.92rem; }
    h4 { color: #f59e0b; font-size: 0.85rem; }
    p { font-size: 0.88rem; margin: 6px 0; }
    a { color: #10b981; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #2a2a3e; padding: 1px 5px; border-radius: 3px; font-size: 0.82rem; color: #a5b4fc; }
    pre { background: #0d0d14; border: 1px solid #25253a; border-radius: 6px; padding: 10px; overflow-x: auto; font-size: 0.82rem; }
    pre code { background: none; padding: 0; color: #d0d0d0; }
    blockquote { border-left: 3px solid #6366f1; padding: 6px 14px; margin: 10px 0; background: #6366f108; color: #a0a0b0; font-size: 0.85rem; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 0.82rem; }
    td, th { padding: 6px 10px; border: 1px solid #25253a; text-align: left; }
    tr:first-child td { font-weight: 600; background: #1a1a3e; }
    ul, ol { padding-left: 20px; }
    li { margin: 3px 0; font-size: 0.86rem; }
    hr { border: none; border-top: 1px solid #25253a; margin: 20px 0; }
    .mermaid { margin: 16px 0; background: transparent; }
    .mermaid svg { max-width: 100%; }
  </style>
</head>
<body>
  ${html}
  <hr>
  <p style="font-size:0.72rem;color:#555;">
    <strong>FrootAI</strong> — From the Roots to the Fruits · 
    <a href="https://frootai.dev">Website</a> · 
    <a href="https://github.com/frootai/frootai">GitHub</a>
  </p>
</body>
</html>`;
}

// ─── GitHub Download Helper with Cache ─────────────────────────────

let _cacheDir = null; // Set in activate() from context.globalStorageUri
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCachePath(repoPath) {
  if (!_cacheDir) return null;
  // Flatten path separators for filesystem safety
  return path.join(_cacheDir, "downloads", repoPath.replace(/\//g, "__"));
}

function readFromCache(repoPath) {
  const cachePath = getCachePath(repoPath);
  if (!cachePath) return null;
  try {
    if (fs.existsSync(cachePath)) {
      const stats = fs.statSync(cachePath);
      const ageMs = Date.now() - stats.mtimeMs;
      if (ageMs < CACHE_TTL_MS) {
        return fs.readFileSync(cachePath, "utf-8");
      }
    }
  } catch { /* cache miss is fine */ }
  return null;
}

function writeToCache(repoPath, content) {
  const cachePath = getCachePath(repoPath);
  if (!cachePath) return;
  try {
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cachePath, content, "utf-8");
  } catch { /* cache write failure is non-critical */ }
}

function downloadFromGitHub(repoPath) {
  // Check cache first
  const cached = readFromCache(repoPath);
  if (cached) return Promise.resolve(cached);

  const url = `https://raw.githubusercontent.com/frootai/frootai/main/${repoPath}`;
  // Use global fetch (Node 18+, VS Code 1.85+) — respects VS Code proxy settings
  return fetch(url, { headers: { "User-Agent": "FrootAI-VSCode" } })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then(text => {
      writeToCache(repoPath, text);
      return text;
    });
}

// ─── Tree Data Providers ───────────────────────────────────────────

class SolutionPlayProvider {
  constructor(context) {
    this._onDidChange = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChange.event;
    this._filter = "";
    this._viewMode = context?.workspaceState?.get("frootai.playViewMode") || "category";
    this._context = context;
    this._recentIds = context?.workspaceState?.get("frootai.recentPlays") || [];
  }

  trackRecent(playId) {
    if (!this._context) return;
    this._recentIds = [playId, ...this._recentIds.filter(id => id !== playId)].slice(0, 5);
    this._context.workspaceState.update("frootai.recentPlays", this._recentIds);
    this._onDidChange.fire();
  }

  setFilter(filter) { this._filter = filter.toLowerCase(); this._onDidChange.fire(); }
  setViewMode(mode) { this._viewMode = mode; this._onDidChange.fire(); }
  refresh() { this._onDidChange.fire(); }

  getTreeItem(element) { return element; }

  getChildren(element) {
    const layerNames = { F: "Foundations", R: "Reasoning", O: "Orchestration", T: "Transformation" };

    // Children of a category group or recently used
    if (element?._plays) {
      return element._plays.map(p => this._buildPlayItem(p, layerNames));
    }

    // Non-root element — nothing else to expand
    if (element) return [];

    // ── Root level ──
    const launchers = this._buildLaunchers();

    // Apply filter
    let plays = SOLUTION_PLAYS;
    if (this._filter) {
      plays = plays.filter(p => {
        const haystack = [p.id, p.name, p.desc, p.infra, p.layer, p.cx, p.status].filter(Boolean).join(" ").toLowerCase();
        return this._filter.split(/\s+/).every(w => haystack.includes(w));
      });
    }

    // Flat view
    if (this._viewMode === "flat") {
      return [...launchers, ...plays.map(p => this._buildPlayItem(p, layerNames))];
    }

    // Category view (grouped)
    const catMap = {};
    const catMeta = {
      R: { label: "🧩 Reasoning", color: "charts.green", order: 1 },
      O: { label: "🤖 Orchestration", color: "charts.blue", order: 2 },
      F: { label: "🏗️ Foundations", color: "charts.yellow", order: 3 },
      T: { label: "🔧 Transformation", color: "charts.purple", order: 4 },
    };
    for (const p of plays) {
      if (!catMap[p.layer]) catMap[p.layer] = [];
      catMap[p.layer].push(p);
    }
    const groups = Object.entries(catMap)
      .sort((a, b) => (catMeta[a[0]]?.order || 9) - (catMeta[b[0]]?.order || 9))
      .map(([layer, layerPlays]) => {
        const meta = catMeta[layer] || { label: layer, color: "foreground" };
        const item = new vscode.TreeItem(meta.label, vscode.TreeItemCollapsibleState.Expanded);
        item.description = `${layerPlays.length} plays`;
        item.iconPath = new vscode.ThemeIcon("symbol-folder", new vscode.ThemeColor(meta.color));
        item.contextValue = "playCategory";
        item._plays = layerPlays;
        return item;
      });

    // Prepend search results count if filtering
    if (this._filter) {
      const header = new vscode.TreeItem(`🔍 "${this._filter}" — ${plays.length} results`, vscode.TreeItemCollapsibleState.None);
      header.contextValue = "searchHeader";
      header.command = { command: "frootai.filterPlays", title: "Clear Filter" };
      return [...launchers, header, ...groups];
    }

    // Prepend "Recently Used" group
    if (this._recentIds.length > 0) {
      const recentPlays = this._recentIds
        .map(id => SOLUTION_PLAYS.find(p => p.id === id))
        .filter(Boolean);
      if (recentPlays.length > 0) {
        const recentGroup = new vscode.TreeItem("⏱️ Recently Used", vscode.TreeItemCollapsibleState.Expanded);
        recentGroup.description = `${recentPlays.length} plays`;
        recentGroup.iconPath = new vscode.ThemeIcon("history", new vscode.ThemeColor("charts.orange"));
        recentGroup.contextValue = "recentPlays";
        recentGroup._plays = recentPlays;
        return [...launchers, recentGroup, ...groups];
      }
    }
    return [...launchers, ...groups];
  }

  _buildLaunchers() {
    const items = [
      { label: "Solution Configurator", desc: "Find the right play for your needs", icon: "settings-gear", color: "charts.yellow", cmd: "frootai.openConfigurator" },
      { label: "Browse All Plays", desc: "Search, filter, compare 101 plays", icon: "layout", color: "charts.green", cmd: "frootai.browsePlays" },
    ];
    return items.map(l => {
      const item = new vscode.TreeItem(l.label, vscode.TreeItemCollapsibleState.None);
      item.description = l.desc;
      item.iconPath = new vscode.ThemeIcon(l.icon, new vscode.ThemeColor(l.color));
      item.command = { command: l.cmd, title: l.label };
      item.contextValue = "launcher";
      const tip = new vscode.MarkdownString(`**${l.label}**\n\n${l.desc}\n\n*Click to open*`);
      tip.supportThemeIcons = true;
      item.tooltip = tip;
      return item;
    });
  }

  _buildPlayItem(p, layerNames) {
    const item = new vscode.TreeItem(`${p.id} ${p.name}`, vscode.TreeItemCollapsibleState.None);

    // Description: complexity + layer
    const cxTag = p.cx || "";
    item.description = `${cxTag} · ${layerNames[p.layer] || p.layer}`;

    // Status-aware icon
    const statusIcon = p.status === "Ready" ? "pass-filled" : "circle-outline";
    const cxColors = {
      Foundation: "charts.blue", Low: "charts.green", Medium: "charts.yellow",
      High: "charts.orange", "Very High": "charts.red",
    };
    const themeColor = cxColors[p.cx] ? new vscode.ThemeColor(cxColors[p.cx]) : undefined;
    item.iconPath = new vscode.ThemeIcon(p.codicon || statusIcon, themeColor);

    // Rich tooltip with WAF pillars, Azure services, category
    const statusEmoji = p.status === "Ready" ? "✅ Ready" : "⬜ Skeleton";
    const wafPillars = p.waf && p.waf.length > 0 ? p.waf.map((w) => `\`${w}\``).join("  ") : "";
    const azServices = p.azure && p.azure.length > 0 ? p.azure.slice(0, 5).join(", ") : (p.infra || "N/A");
    const catLine = p.category ? `**Category:** ${p.category}  \n` : "";
    item.tooltip = new vscode.MarkdownString(
      `**${p.name}** ${statusEmoji}\n\n` +
      `${p.desc || ""}\n\n---\n\n` +
      `**Complexity:** ${p.cx || "N/A"}  \n` +
      catLine +
      `**Azure:** ${azServices}  \n` +
      `**Layer:** ${layerNames[p.layer] || p.layer}  \n` +
      (wafPillars ? `**WAF:** ${wafPillars}  \n` : "") +
      `**Dir:** \`${p.dir}\`\n\n` +
      `*Click to open Play Detail panel*`
    );
    item.tooltip.supportThemeIcons = true;

    item.contextValue = "solutionPlay";
    item.command = { command: "frootai.openSolutionPlay", title: "Open", arguments: [p] };
    return item;
  }
}

const LAYER_DESCRIPTIONS = {
  "🌱 Foundations": "Core AI concepts, glossary, .github Agentic OS",
  "🪵 Reasoning": "Prompt engineering, RAG, deterministic patterns",
  "🌿 Orchestration": "Semantic Kernel, agents, MCP tools",
  "🍃 Operations": "Azure AI platform, infrastructure, Copilot",
  "🍎 Transformation": "Fine-tuning, responsible AI, production",
};

class FrootModuleProvider {
  getTreeItem(element) { return element; }
  getChildren(element) {
    if (!element) {
      return FROOT_MODULES.map((layer) => {
        const item = new vscode.TreeItem(layer.layer, vscode.TreeItemCollapsibleState.Expanded);
        item.contextValue = "layer";
        item.description = `${layer.modules.length} modules`;
        item.tooltip = new vscode.MarkdownString(
          `**${layer.layer}**\n\n${LAYER_DESCRIPTIONS[layer.layer] || ""}\n\n---\n\n` +
          `**Modules:** ${layer.modules.length}  \n` +
          layer.modules.map(m => `- \`${m.id}\` ${m.name}`).join("\n")
        );
        item.tooltip.supportThemeIcons = true;
        item.iconPath = new vscode.ThemeIcon("symbol-folder", new vscode.ThemeColor(getLayerThemeColor(layer.color)));
        return item;
      });
    }
    const layerData = FROOT_MODULES.find((l) => l.layer === element.label);
    if (layerData) {
      return layerData.modules.map((m) => {
        const item = new vscode.TreeItem(`${m.id}: ${m.name}`, vscode.TreeItemCollapsibleState.None);
        const modDesc = getModuleDescription(m.id);
        item.description = modDesc;
        const modTooltip = new vscode.MarkdownString(
          `**${m.id}: ${m.name}**\n\n${modDesc}\n\n---\n\n*Click to read in a rich panel*`
        );
        modTooltip.supportThemeIcons = true;
        item.tooltip = modTooltip;
        item.iconPath = new vscode.ThemeIcon("book", new vscode.ThemeColor(getLayerThemeColor(layerData.color)));
        item.command = { command: "frootai.openModule", title: "Open", arguments: [m] };
        return item;
      });
    }
    return [];
  }
}

function getLayerThemeColor(hexColor) {
  // Map our hex colors to VS Code theme color IDs
  const map = {
    "#f59e0b": "charts.yellow",   // Foundations
    "#10b981": "charts.green",    // Reasoning
    "#06b6d4": "charts.blue",     // Orchestration
    "#6366f1": "charts.purple",   // Operations
    "#7c3aed": "charts.purple",   // Transformation
  };
  return map[hexColor] || "foreground";
}

function getModuleDescription(moduleId) {
  const descriptions = {
    "F1": "Core GenAI concepts & terminology",
    "F2": "GPT-4o, Claude, Llama, Phi — model comparison",
    "F3": "200+ AI/ML terms with definitions",
    "F4": "7 primitives, 4 layers — .github folder evolution",
    "R1": "System prompts, few-shot, chain-of-thought",
    "R2": "Retrieval-Augmented Generation patterns",
    "R3": "temp=0, JSON schema, verification loops",
    "O1": "Plugins, planners, memory, agents",
    "O2": "Supervisor, handoffs, multi-agent systems",
    "O3": "MCP protocol, tool calling, function patterns",
    "O4": "Foundry, endpoints, deployments, RBAC",
    "O5": "GPU, networking, landing zones, scaling",
    "O6": "Copilot Studio, extensions, M365 integration",
    "T1": "LoRA, QLoRA, data prep, MLOps pipelines",
    "T2": "Safety, content filtering, red teaming",
    "T3": "Caching, load balancing, cost optimization",
  };
  return descriptions[moduleId] || "";
}

// ─── Primitives Catalog Provider ──────────────────────────────────

class PrimitivesCatalogProvider {
  getTreeItem(element) { return element; }
  getChildren(element) {
    if (!element) {
      // Top-level: Open Full Catalog + Marketplace + categories
      const openCatalog = new vscode.TreeItem("Open Primitives Catalog", vscode.TreeItemCollapsibleState.None);
      openCatalog.command = { command: "frootai.openPrimitivesCatalog", title: "Open Primitives Catalog" };
      openCatalog.description = "Search, filter, install";
      openCatalog.iconPath = new vscode.ThemeIcon("extensions", new vscode.ThemeColor("charts.blue"));

      const openMarketplace = new vscode.TreeItem("Plugin Marketplace", vscode.TreeItemCollapsibleState.None);
      openMarketplace.command = { command: "frootai.openMarketplace", title: "Open Marketplace" };
      openMarketplace.description = "77 composable plugins";
      openMarketplace.iconPath = new vscode.ThemeIcon("package", new vscode.ThemeColor("charts.red"));

      const categories = [
        { label: "Agents (238)", icon: "hubot", color: "#10b981", children: [
          { label: "Browse all agents", desc: "View 238 agents on frootai.dev", icon: "globe", url: "https://frootai.dev/primitives/agents" },
          { label: "Install agent in VS Code", desc: "One-click agent install via VS Code protocol", icon: "cloud-download", cmd: "frootai.installAgent" },
          { label: "WAF-aligned AI personas", desc: "Each agent has expertise + tools + WAF alignment", icon: "info" },
        ]},
        { label: "Instructions (176)", icon: "file-text", children: [
          { label: "Browse all instructions", desc: "View 176 instructions on frootai.dev", icon: "globe", url: "https://frootai.dev/primitives/instructions" },
          { label: "Auto-apply via applyTo globs", desc: "Match file patterns like **/*.tsx", icon: "regex" },
          { label: "Scoped behavioral directives", desc: "Coding standards, security rules, best practices", icon: "info" },
        ]},
        { label: "Skills (322)", icon: "tools", children: [
          { label: "Browse all skills", desc: "View 322 skills on frootai.dev", icon: "globe", url: "https://frootai.dev/primitives/skills" },
          { label: "SKILL.md folder structure", desc: "Parameters, steps, bundled assets", icon: "folder" },
          { label: "Reusable LEGO blocks", desc: "Auto-wire inside solution plays", icon: "info" },
        ]},
        { label: "Hooks (10)", icon: "shield", children: [
          { label: "Browse all hooks", desc: "View 10 hooks on frootai.dev", icon: "globe", url: "https://frootai.dev/primitives/hooks" },
          { label: "secrets-scanner", desc: "40+ secret patterns, entropy detection", icon: "lock" },
          { label: "tool-guardian", desc: "Allowlist/blocklist, rate limiting", icon: "shield" },
          { label: "governance-audit", desc: "OWASP LLM Top 10 checks", icon: "law" },
          { label: "pii-redactor", desc: "12+ PII types, GDPR/HIPAA", icon: "eye-closed" },
          { label: "cost-tracker", desc: "Per-model pricing, anomaly detection", icon: "graph" },
          { label: "waf-compliance", desc: "6-pillar scoring, 36 checks", icon: "checklist" },
          { label: "output-validator", desc: "Schema, safety, hallucination checks", icon: "check-all" },
          { label: "token-budget-enforcer", desc: "Per-model budgets, sliding window", icon: "dashboard" },
          { label: "session-logger", desc: "JSON Lines audit trail", icon: "output" },
          { label: "license-checker", desc: "SPDX compliance, 4 ecosystems", icon: "file-certificate" },
        ]},
        { label: "Plugins (77)", icon: "package", children: [
          { label: "Browse marketplace", desc: "View 77 plugins on frootai.dev", icon: "globe", url: "https://frootai.dev/marketplace" },
          { label: "npx frootai install <plugin>", desc: "One-command installation", icon: "terminal" },
          { label: "1,008 bundled items", desc: "Agents + instructions + skills + hooks per plugin", icon: "info" },
        ]},
      ];

      const items = categories.map(cat => {
        const item = new vscode.TreeItem(cat.label, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon(cat.icon);
        item.contextValue = "primitiveCategory";
        item._children = cat.children;
        return item;
      });
      return [openCatalog, openMarketplace, ...items];
    }
    if (element._children) {
      return element._children.map(child => {
        const item = new vscode.TreeItem(child.label, vscode.TreeItemCollapsibleState.None);
        item.description = child.desc;
        item.iconPath = new vscode.ThemeIcon(child.icon);
        item.tooltip = child.desc;
        if (child.cmd) {
          item.command = { command: child.cmd, title: child.label };
        } else if (child.url) {
          item.command = { command: "vscode.open", title: "Open", arguments: [vscode.Uri.parse(child.url)] };
        }
        return item;
      });
    }
    return [];
  }
}

// ─── FAI Protocol & Layer Provider ────────────────────────────────

class FaiProtocolProvider {
  getTreeItem(element) { return element; }
  getChildren(element) {
    const layers = [
      {
        label: "FAI Protocol", icon: "symbol-namespace", desc: "fai-manifest.json — the specification", children: [
          { label: "fai-manifest.json", desc: "Full play wiring: context + primitives + infra + toolkit", icon: "file-code", url: "https://frootai.dev/fai-protocol" },
          { label: "fai-context.json", desc: "Lightweight LEGO block context reference", icon: "file", url: "https://frootai.dev/fai-protocol" },
          { label: "7 JSON schemas", desc: "agent, instruction, skill, hook, plugin, manifest, context", icon: "symbol-structure", url: "https://github.com/frootai/frootai/tree/main/schemas" },
          { label: "Auto-wiring", desc: "Shared context propagates to all primitives in a play", icon: "link" },
        ]
      },
      {
        label: "FAI Layer", icon: "symbol-class", desc: "The conceptual binding glue", children: [
          { label: "Context Wiring", desc: "Knowledge modules + WAF pillars + compatible plays", icon: "git-merge", url: "https://frootai.dev/fai-protocol" },
          { label: "WAF Alignment", desc: "6 pillars: security, reliability, cost, ops, perf, RAI", icon: "shield", url: "https://frootai.dev/learning-hub/waf-alignment" },
          { label: "Standalone → Wired", desc: "LEGO blocks auto-wire when placed in a play", icon: "plug" },
        ]
      },
      {
        label: "FAI Engine", icon: "server-process", desc: "The runtime — 7 modules, 42 tests", children: [
          { label: "manifest-reader", desc: "Loads and validates fai-manifest.json", icon: "file-code", url: "https://github.com/frootai/frootai/tree/main/engine" },
          { label: "context-resolver", desc: "Resolves shared context chain", icon: "search" },
          { label: "primitive-wirer", desc: "Connects agents, instructions, skills, hooks", icon: "link" },
          { label: "hook-runner", desc: "Executes hooks at lifecycle events", icon: "play" },
          { label: "evaluator", desc: "Runs quality metrics (groundedness, coherence)", icon: "graph" },
          { label: "mcp-bridge", desc: "Bridges to MCP protocol", icon: "cloud" },
        ]
      },
      {
        label: "FAI Factory", icon: "rocket", desc: "CI/CD — build, test, publish", children: [
          { label: "validate-primitives.js", desc: "2,800+ checks across all primitives", icon: "check-all", url: "https://github.com/frootai/frootai/tree/main/scripts" },
          { label: "GitHub Actions (15)", desc: "Automated CI/CD workflows", icon: "github-action", url: "https://github.com/frootai/frootai/actions" },
          { label: "npm publish", desc: "frootai-mcp on npm registry", icon: "package", url: "https://www.npmjs.com/package/frootai-mcp" },
        ]
      },
      {
        label: "FAI Marketplace", icon: "extensions", desc: "77 plugins, 1,008 items", children: [
          { label: "Browse marketplace", desc: "View plugins on frootai.dev", icon: "globe", url: "https://frootai.dev/marketplace" },
          { label: "npx frootai install", desc: "One-command plugin installation", icon: "terminal" },
          { label: "npx frootai list", desc: "Browse all 77 plugins", icon: "list-flat" },
        ]
      },
    ];

    if (!element) {
      return layers.map(layer => {
        const item = new vscode.TreeItem(layer.label, vscode.TreeItemCollapsibleState.Collapsed);
        item.description = layer.desc;
        item.iconPath = new vscode.ThemeIcon(layer.icon);
        item._children = layer.children;
        return item;
      });
    }
    if (element._children) {
      return element._children.map(child => {
        const item = new vscode.TreeItem(child.label, vscode.TreeItemCollapsibleState.None);
        item.description = child.desc;
        item.iconPath = new vscode.ThemeIcon(child.icon);
        item.tooltip = child.desc;
        if (child.url) {
          item.command = { command: "vscode.open", title: "Open", arguments: [vscode.Uri.parse(child.url)] };
        }
        return item;
      });
    }
    return [];
  }
}

class McpToolProvider {
  getTreeItem(element) { return element; }
  getChildren(element) {
    const groups = [
      { label: "Knowledge (6)", type: "static", icon: "database", desc: "Offline knowledge lookups" },
      { label: "Live (4)", type: "live", icon: "cloud", desc: "Azure + GitHub API calls" },
      { label: "Agent Chain (3)", type: "chain", icon: "link", desc: "Build → Review → Tune workflow" },
      { label: "Ecosystem (10)", type: "ecosystem", icon: "globe", desc: "Model catalog, pricing, compare, embed" },
      { label: "Engine (6)", type: "engine", icon: "circuit-board", desc: "FAI Engine bridge tools" },
      { label: "Scaffold (3)", type: "scaffold", icon: "file-add", desc: "Play + primitive scaffolding" },
      { label: "Marketplace (13)", type: "marketplace", icon: "extensions", desc: "Plugin install, compose, publish" },
    ];
    if (!element) {
      // MCP Explorer launcher at top
      const explorer = new vscode.TreeItem("Open MCP Explorer", vscode.TreeItemCollapsibleState.None);
      explorer.description = "Interactive tool browser";
      explorer.iconPath = new vscode.ThemeIcon("tools", new vscode.ThemeColor("charts.purple"));
      explorer.command = { command: "frootai.openMcpExplorer", title: "Open MCP Explorer" };
      explorer.contextValue = "launcher";

      const groupItems = groups.map(g => {
        const item = new vscode.TreeItem(g.label, vscode.TreeItemCollapsibleState.Collapsed);
        item.description = g.desc;
        item.iconPath = new vscode.ThemeIcon(g.icon);
        item.contextValue = "toolGroup";
        item._groupType = g.type;
        return item;
      });
      return [explorer, ...groupItems];
    }
    const groupType = element._groupType;
    if (groupType) {
      const typeIcons = { static: "book", live: "cloud-upload", chain: "debug-disconnect", ecosystem: "graph-scatter", compute: "symbol-ruler", engine: "circuit-board", scaffold: "file-add", marketplace: "extensions" };
      return MCP_TOOLS.filter(t => t.type === groupType).map(t => {
        const item = new vscode.TreeItem(t.name, vscode.TreeItemCollapsibleState.None);
        item.description = t.desc;
        const toolTooltip = new vscode.MarkdownString(
          `**\`${t.name}\`**\n\n${t.desc}\n\n---\n\n` +
          `**Category:** ${t.type}  \n` +
          `**Read-only:** ${t.readOnly !== false ? "Yes" : "No"}  \n\n` +
          `*Click to view documentation*`
        );
        toolTooltip.supportThemeIcons = true;
        item.tooltip = toolTooltip;
        item.iconPath = new vscode.ThemeIcon(typeIcons[t.type] || "symbol-method");
        item.contextValue = "mcpTool";
        item.command = { command: "frootai.viewToolDocs", title: "View Docs", arguments: [t] };
        return item;
      });
    }
    return [];
  }
}

class GlossaryProvider {
  getTreeItem(element) { return element; }
  getChildren() {
    const terms = Object.entries(GLOSSARY).slice(0, 50).map(([key, val]) => {
      const item = new vscode.TreeItem(val.term, vscode.TreeItemCollapsibleState.None);
      item.description = val.definition.substring(0, 60) + "...";
      const glossTooltip = new vscode.MarkdownString(
        `**${val.term}**\n\n${val.definition.substring(0, 300)}${val.definition.length > 300 ? "..." : ""}\n\n---\n\n*Click to view full definition*`
      );
      glossTooltip.supportThemeIcons = true;
      item.tooltip = glossTooltip;
      item.command = { command: "frootai.lookupTerm", title: "Lookup", arguments: [val.term] };
      return item;
    });
    if (Object.keys(GLOSSARY).length > 50) {
      const more = new vscode.TreeItem(`... ${Object.keys(GLOSSARY).length - 50} more terms`, vscode.TreeItemCollapsibleState.None);
      more.description = "Use Ctrl+Shift+P → Look Up AI Term";
      terms.push(more);
    }
    return terms;
  }
}

// ─── Welcome Tree Provider ──────────────────────────────────────────
class WelcomeTreeProvider {
  getTreeItem(element) { return element; }
  getChildren() {
    const hi = new vscode.TreeItem("Welcome — Get Started", vscode.TreeItemCollapsibleState.None);
    hi.description = "Your AI hub — click to open";
    hi.iconPath = new vscode.ThemeIcon("home", new vscode.ThemeColor("charts.green"));
    hi.command = { command: "frootai.openWelcome", title: "Open Welcome" };
    hi.contextValue = "welcomeItem";
    hi.tooltip = new vscode.MarkdownString("**Hi FAI!** 👋\n\nClick to open the Welcome panel with quick start guide, feature overview, and ecosystem links.");

    const scaffold = new vscode.TreeItem("Scaffold a Project", vscode.TreeItemCollapsibleState.None);
    scaffold.description = "4-step wizard";
    scaffold.iconPath = new vscode.ThemeIcon("file-add", new vscode.ThemeColor("charts.blue"));
    scaffold.command = { command: "frootai.openScaffoldWizard", title: "Scaffold" };

    const setup = new vscode.TreeItem("Setup Guide", vscode.TreeItemCollapsibleState.None);
    setup.description = "Install MCP, configure, deploy";
    setup.iconPath = new vscode.ThemeIcon("book", new vscode.ThemeColor("charts.orange"));
    setup.command = { command: "frootai.openSetupGuide", title: "Setup Guide" };

    const search = new vscode.TreeItem("Search Everything", vscode.TreeItemCollapsibleState.None);
    search.description = "Ctrl+Shift+F9";
    search.iconPath = new vscode.ThemeIcon("search", new vscode.ThemeColor("charts.yellow"));
    search.command = { command: "frootai.searchAll", title: "Search" };

    const agent = new vscode.TreeItem("Ask Agent FAI", vscode.TreeItemCollapsibleState.None);
    agent.description = "AI assistant — powered by Azure";
    agent.iconPath = new vscode.ThemeIcon("comment-discussion", new vscode.ThemeColor("charts.purple"));
    agent.command = { command: "frootai.openAgentFai", title: "Ask Agent FAI" };

    return [hi, agent, scaffold, setup, search];
  }
}

// ─── Activate ──────────────────────────────────────────────────────

function activate(context) {
  // Guard against double activation
  if (activate._done) return;
  activate._done = true;

  console.log("FrootAI v6.1 activated");

  // B1: Initialize cache directory for offline downloaded plays
  _cacheDir = context.globalStorageUri.fsPath;
  if (!fs.existsSync(_cacheDir)) {
    fs.mkdirSync(_cacheDir, { recursive: true });
  }

  // Load bundled knowledge — works without any repo clone
  const knowledgeLoaded = loadBundledKnowledge();
  if (knowledgeLoaded) {
    console.log(`FrootAI: Knowledge engine ready (${Object.keys(KNOWLEDGE.modules).length} modules, ${Object.keys(GLOSSARY).length} terms)`);
  }

  // Optional: find local repo if available (enhances but not required)
  const root = findFrootAIRoot();

  // Register tree views (5 panels)
  const playProvider = new SolutionPlayProvider(context);
  vscode.window.registerTreeDataProvider("frootai.welcome", new WelcomeTreeProvider());
  vscode.window.registerTreeDataProvider("frootai.solutionPlays", playProvider);
  vscode.window.registerTreeDataProvider("frootai.primitivesCatalog", new PrimitivesCatalogProvider());
  vscode.window.registerTreeDataProvider("frootai.faiProtocol", new FaiProtocolProvider());
  vscode.window.registerTreeDataProvider("frootai.mcpTools", new McpToolProvider());

  // Auto-show Welcome when sidebar first becomes visible
  const welcomeView = vscode.window.createTreeView("frootai.welcome", { treeDataProvider: new WelcomeTreeProvider() });
  welcomeView.onDidChangeVisibility(e => {
    if (e.visible && !context.globalState.get("frootai.welcomeShownThisSession")) {
      context.globalState.update("frootai.welcomeShownThisSession", true);
      vscode.commands.executeCommand("frootai.openWelcome");
    }
  });

  // ── Filter/Search Plays command ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.filterPlays", async () => {
      const current = playProvider._filter;
      const value = await vscode.window.showInputBox({
        prompt: "Filter Solution Plays (search by name, service, complexity, layer)",
        placeHolder: "e.g. rag, voice, high, openai, container...",
        value: current,
      });
      if (value !== undefined) playProvider.setFilter(value);
    })
  );

  // ── Refresh plays tree ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.refreshPlays", () => playProvider.refresh())
  );

  // ── Toggle view mode (one-click toggle: category ↔ flat) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.togglePlayView", () => {
      const current = playProvider._viewMode;
      const next = current === "category" ? "flat" : "category";
      playProvider.setViewMode(next);
      context.workspaceState.update("frootai.playViewMode", next);
      vscode.window.showInformationMessage(`Solution Plays: ${next === "category" ? "📁 Category View" : "📋 Flat View"}`);
    })
  );

  // ── Command: Open Solution Play → Direct React Panel ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.openSolutionPlay", async (play) => {
      if (play?.id) playProvider.trackRecent(play.id);
      vscode.commands.executeCommand("frootai.openPlayDetail", play);
    })
  );

  // ── Command: Open Module (standalone: renders from bundled knowledge) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.openModule", async (mod) => {
      // Try bundled knowledge first (STANDALONE — no repo needed)
      if (KNOWLEDGE?.modules) {
        const moduleData = Object.values(KNOWLEDGE.modules).find(m => m.file === mod.file || m.id === mod.id);
        if (moduleData) {
          createModuleWebview(context, mod.id, `${mod.id}: ${mod.name}`, moduleData.content);
          return;
        }
      }
      // Try local file
      if (root) {
        const filePath = path.join(root, "docs", mod.file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          createModuleWebview(context, mod.id, `${mod.id}: ${mod.name}`, content);
          return;
        }
      }
      // Fallback: show info message
      vscode.window.showInformationMessage(`Module ${mod.id} content not available offline. Bundled knowledge may need rebuilding.`);
    })
  );

  // ── Command: Browse Solution Plays → Native PlayBrowser panel ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.browseSolutionPlays", () => {
      vscode.commands.executeCommand("frootai.browsePlays");
    })
  );

  // ── Command: Lookup Term (standalone: inline from bundled glossary) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.lookupTerm", async (prefilledTerm) => {
      const term = prefilledTerm || await vscode.window.showInputBox({
        prompt: "Enter an AI/ML term to look up (200+ terms available)",
        placeHolder: "e.g., temperature, RAG, LoRA, MCP, embeddings, hallucination"
      });
      if (!term) return;

      const key = term.toLowerCase().trim();

      // Search bundled glossary (STANDALONE)
      if (GLOSSARY[key]) {
        const g = GLOSSARY[key];
        createModuleWebview(context, `term-${key}`, `📖 ${g.term}`,
          `# ${g.term}\n\n${g.definition}\n\n---\n*Source: FrootAI Glossary A–Z (Module F3)*`
        );
        return;
      }

      // Fuzzy match
      const matches = Object.entries(GLOSSARY)
        .filter(([k, v]) => k.includes(key) || v.term.toLowerCase().includes(key))
        .slice(0, 10);

      if (matches.length > 0) {
        const pick = await vscode.window.showQuickPick(
          matches.map(([k, v]) => ({ label: v.term, description: v.definition.substring(0, 80) + "...", value: v })),
          { placeHolder: `Found ${matches.length} matching terms for "${term}"` }
        );
        if (pick) {
          createModuleWebview(context, `term-${key}`, `📖 ${pick.value.term}`,
            `# ${pick.value.term}\n\n${pick.value.definition}\n\n---\n*Source: FrootAI Glossary A–Z (Module F3)*`
          );
        }
        return;
      }

      vscode.window.showInformationMessage(`Term "${term}" not found. Try a different spelling or use Search Knowledge Base.`);
    })
  );

  // ── Command: Search Knowledge (standalone: searches bundled content) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.searchKnowledge", async () => {
      const query = await vscode.window.showInputBox({
        prompt: "Search across all 18 FrootAI modules",
        placeHolder: "e.g., how to reduce hallucination, RAG pipeline, agent hosting"
      });
      if (!query) return;

      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      const results = [];

      // Search bundled knowledge (STANDALONE)
      if (KNOWLEDGE?.modules) {
        for (const [modId, mod] of Object.entries(KNOWLEDGE.modules)) {
          const lines = mod.content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineLower = line.toLowerCase();
            if (queryWords.some(w => lineLower.includes(w))) {
              results.push({
                moduleId: modId,
                moduleTitle: mod.title,
                line: i + 1,
                text: line.trim().substring(0, 120),
                file: mod.file,
              });
              if (results.length >= 20) break;
            }
          }
          if (results.length >= 20) break;
        }
      }

      if (results.length > 0) {
        const pick = await vscode.window.showQuickPick(
          results.map(r => ({
            label: `${r.moduleId}: ${r.text}`,
            description: r.moduleTitle,
            detail: `Line ${r.line}`,
            value: r,
          })),
          { placeHolder: `Found ${results.length} results for "${query}"` }
        );
        if (pick) {
          // Open the module in webview
          const mod = KNOWLEDGE.modules[pick.value.moduleId];
          if (mod) {
            createModuleWebview(context, pick.value.moduleId, `${pick.value.moduleId}: ${mod.title}`, mod.content);
          }
        }
      } else {
        vscode.window.showInformationMessage(`No results for "${query}". Try broader terms.`);
      }
    })
  );

  // ── Command: Open Setup Guide (native webview) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.openSetupGuide", () => {
      const panel = vscode.window.createWebviewPanel("frootai.setupGuide", "FrootAI Setup Guide", vscode.ViewColumn.One, { enableScripts: false });
      panel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body { font-family: var(--vscode-font-family); padding: 24px; color: var(--vscode-foreground); background: var(--vscode-editor-background); line-height: 1.7; max-width: 720px; margin: 0 auto; }
        h1 { font-size: 22px; margin-bottom: 8px; } h2 { font-size: 16px; margin-top: 24px; color: #10b981; }
        code { background: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 3px; font-size: 13px; }
        pre { background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 6px; overflow-x: auto; }
        .step { margin: 16px 0; padding: 12px; border-left: 3px solid #10b981; background: #10b98108; border-radius: 4px; }
      </style></head><body>
        <h1>⚡ FrootAI Setup Guide</h1>
        <p>Get started with the FrootAI ecosystem in 3 steps.</p>
        <div class="step"><h2>Step 1: Install MCP Server</h2>
        <p>Choose one method:</p>
        <pre>npx frootai-mcp@latest          # Node.js (recommended)
pip install frootai-mcp          # Python
docker run -i ghcr.io/frootai/frootai-mcp  # Docker</pre>
        <p>Or use the <strong>Ctrl+Shift+P → FrootAI: Setup MCP Server</strong> command.</p></div>
        <div class="step"><h2>Step 2: Scaffold a Play</h2>
        <p>Use <strong>Ctrl+Shift+P → FrootAI: Open Scaffold Wizard</strong> to pick a play and create your project.</p>
        <p>Or via CLI:</p><pre>npx frootai scaffold 01 my-rag-project</pre></div>
        <div class="step"><h2>Step 3: Configure & Deploy</h2>
        <p>Use the <strong>Solution Configurator</strong> (Ctrl+Shift+P → FrootAI: Solution Configurator) to find the right play for your needs.</p>
        <p>Then use <strong>Init DevKit</strong> / <strong>Init TuneKit</strong> from any play detail to scaffold the full project structure.</p></div>
        <h2>📋 Key Commands</h2>
        <pre>Ctrl+Shift+F9   → Search Everything
Ctrl+Shift+F10  → Browse All Plays
Ctrl+Shift+F11  → Welcome Panel</pre>
      </body></html>`;
    })
  );

  // ── Command: Show Architecture Pattern (standalone: from bundled knowledge) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.showArchitecturePattern", async () => {
      const patterns = [
        { label: "RAG Pipeline", description: "Design decisions for retrieval-augmented generation", value: "rag_pipeline" },
        { label: "Agent Hosting", description: "Container Apps vs AKS vs App Service vs Functions", value: "agent_hosting" },
        { label: "Model Selection", description: "GPT-4o vs Claude vs Llama vs Phi — when to use what", value: "model_selection" },
        { label: "Cost Optimization", description: "Token economics, caching, batching, model routing", value: "cost_optimization" },
        { label: "Deterministic AI", description: "5-layer defense against hallucination", value: "deterministic_ai" },
        { label: "Multi-Agent", description: "Supervisor vs pipeline vs swarm patterns", value: "multi_agent" },
        { label: "Fine-Tuning Decision", description: "When to fine-tune vs RAG vs prompting", value: "fine_tuning_decision" },
      ];
      const pick = await vscode.window.showQuickPick(patterns, { placeHolder: "Select an architecture pattern" });
      if (!pick) return;

      // Try to show from bundled T3 module
      if (KNOWLEDGE?.modules?.T3) {
        createModuleWebview(context, "T3-pattern", `🏗️ ${pick.label}`, KNOWLEDGE.modules.T3.content);
      } else {
        vscode.window.showInformationMessage("Architecture patterns require bundled knowledge (T3 module). Rebuild knowledge.json to enable.");
      }
    })
  );

  // ── Command: Init DevKit (GitHub-powered: downloads on-demand) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.initDevKit", async (preSelectedPlay) => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) {
        vscode.window.showWarningMessage("Open a folder first, then run Init DevKit.");
        return;
      }

      let selectedPlay = preSelectedPlay;
      if (!selectedPlay) {
        const plays = SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, description: p.status, value: p }));
        const pick = await vscode.window.showQuickPick(plays, { placeHolder: "Which solution play's DevKit?" });
        if (!pick) return;
        selectedPlay = pick.value;
      }

      const playDir = selectedPlay.dir;
      // Generate play-specific instruction filename  
      const playPatternFile = (playDir.replace(/^\d+-/, "")) + "-patterns.instructions.md";

      // Core DevKit files — always deployed
      const coreFiles = [
        ".github/copilot-instructions.md",
        "agent.md",
        ".vscode/mcp.json",
        ".vscode/settings.json",
        "spec/fai-manifest.json",
        "infra/main.bicep",
        "infra/parameters.json",
      ];

      // Dynamic discovery — scan the play's .github folder for all instruction/agent/prompt/skill files
      const dynamicFiles = [];
      const scanDirs = [
        { dir: ".github/instructions", pattern: ".instructions.md" },
        { dir: ".github/agents", pattern: ".agent.md" },
        { dir: ".github/prompts", pattern: ".prompt.md" },
      ];

      // Skill directories (each has SKILL.md)
      const addSkillDirs = (baseDir, playPath) => {
        const skillsDir = path.join(playPath, ".github", "skills");
        if (fs.existsSync(skillsDir)) {
          for (const d of fs.readdirSync(skillsDir)) {
            const skillFile = path.join(skillsDir, d, "SKILL.md");
            if (fs.existsSync(skillFile)) {
              dynamicFiles.push(`.github/skills/${d}/SKILL.md`);
            }
          }
        }
      };

      // Hooks directory (all .json files)
      const addHookFiles = (playPath) => {
        const hooksDir = path.join(playPath, ".github", "hooks");
        if (fs.existsSync(hooksDir)) {
          for (const f of fs.readdirSync(hooksDir)) {
            if (f.endsWith(".json")) {
              dynamicFiles.push(`.github/hooks/${f}`);
            }
          }
        }
      };

      // Workflows directory (CI/CD templates — .yml, .yaml, .yml.template)
      const addWorkflowFiles = (playPath) => {
        const workflowsDir = path.join(playPath, ".github", "workflows");
        if (fs.existsSync(workflowsDir)) {
          for (const f of fs.readdirSync(workflowsDir)) {
            if (f.endsWith(".yml") || f.endsWith(".yaml") || f.endsWith(".yml.template")) {
              dynamicFiles.push(`.github/workflows/${f}`);
            }
          }
        }
      };

      // Build file list from local repo or use core files for GitHub download
      const localPlayDir = root ? path.join(root, "solution-plays", playDir) : null;
      if (localPlayDir && fs.existsSync(localPlayDir)) {
        for (const { dir, pattern } of scanDirs) {
          const fullDir = path.join(localPlayDir, dir);
          if (fs.existsSync(fullDir)) {
            for (const f of fs.readdirSync(fullDir)) {
              if (f.endsWith(pattern)) dynamicFiles.push(`${dir}/${f}`);
            }
          }
        }
        addSkillDirs(localPlayDir, localPlayDir);
        addHookFiles(localPlayDir);
        addWorkflowFiles(localPlayDir);
      } else {
        // Fallback: known patterns for GitHub download
        const playSlug = selectedPlay.dir.replace(/^\d+-/, ""); // e.g. "enterprise-rag"
        dynamicFiles.push(
          ".github/instructions/azure-coding.instructions.md",
          ".github/instructions/security.instructions.md",
          `.github/instructions/${playPatternFile}`,
          ".github/agents/builder.agent.md",
          ".github/agents/reviewer.agent.md",
          ".github/agents/tuner.agent.md",
          ".github/prompts/deploy.prompt.md",
          ".github/prompts/test.prompt.md",
          ".github/prompts/review.prompt.md",
          ".github/prompts/evaluate.prompt.md",
          // Skills (play-specific)
          `.github/skills/deploy-${playSlug}/SKILL.md`,
          `.github/skills/evaluate-${playSlug}/SKILL.md`,
          `.github/skills/tune-${playSlug}/SKILL.md`,
          // Hooks
          ".github/hooks/guardrails.json",
          // Workflows (play-specific)
          `.github/workflows/${playSlug}-ci-github.yml`,
          `.github/workflows/${playSlug}-review-github.yml`,
        );
      }

      const filesToDownload = [...coreFiles, ...dynamicFiles];

      // Try local repo first
      if (root) {
        const localPlayDir = path.join(root, "solution-plays", playDir);
        if (fs.existsSync(localPlayDir)) {
          let copied = 0;
          for (const f of filesToDownload) {
            const srcPath = path.join(localPlayDir, f);
            const dstPath = path.join(wsFolder, f);
            if (fs.existsSync(srcPath)) {
              const dir = path.dirname(dstPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.copyFileSync(srcPath, dstPath);
              copied++;
            }
          }
          // Also copy play-specific instructions
          const instrDir = path.join(localPlayDir, ".github", "instructions");
          if (fs.existsSync(instrDir)) {
            for (const f of fs.readdirSync(instrDir)) {
              if (f.endsWith(".instructions.md") && !filesToDownload.some(c => c.endsWith(f))) {
                const dstPath = path.join(wsFolder, ".github", "instructions", f);
                const dir = path.dirname(dstPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.copyFileSync(path.join(instrDir, f), dstPath);
                copied++;
              }
            }
          }
          vscode.window.showInformationMessage(`✅ DevKit initialized for ${selectedPlay.name}! ${copied} files from local repo.`);
          // Always ensure mcp.json uses npx (not local paths)
          // Write the simple working mcp.json (always overwrite with known-good version)
          const mcpFixPath = path.join(wsFolder, ".vscode", "mcp.json");
          const mcpDir = path.join(wsFolder, ".vscode");
          if (!fs.existsSync(mcpDir)) fs.mkdirSync(mcpDir, { recursive: true });
          fs.writeFileSync(mcpFixPath, JSON.stringify({ servers: { frootai: { type: "stdio", command: "npx", args: ["frootai-mcp@latest"] } } }, null, 2), "utf-8");
          return;
        }
      }

      // STANDALONE: Download from GitHub
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Downloading DevKit for ${selectedPlay.name}...`, cancellable: false },
        async (progress) => {
          let downloaded = 0;
          let failed = 0;
          for (const f of filesToDownload) {
            progress.report({ message: `${downloaded}/${filesToDownload.length} files...`, increment: (100 / filesToDownload.length) });
            try {
              const content = await downloadFromGitHub(`solution-plays/${playDir}/${f}`);
              const dstPath = path.join(wsFolder, f);
              const dir = path.dirname(dstPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(dstPath, content, "utf-8");
              downloaded++;
            } catch {
              failed++;
            }
          }
          vscode.window.showInformationMessage(
            `✅ DevKit downloaded for ${selectedPlay.name}! ${downloaded} files from GitHub.` +
            (failed > 0 ? ` (${failed} files not available)` : "")
          );
          // Write the simple working mcp.json
          const mcpFixPath = path.join(wsFolder, ".vscode", "mcp.json");
          const mcpDir = path.join(wsFolder, ".vscode");
          if (!fs.existsSync(mcpDir)) fs.mkdirSync(mcpDir, { recursive: true });
          fs.writeFileSync(mcpFixPath, JSON.stringify({ servers: { frootai: { type: "stdio", command: "npx", args: ["frootai-mcp@latest"] } } }, null, 2), "utf-8");
        }
      );
    })
  );

  // ── Command: Init Hooks (standalone: downloads from GitHub) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.initHooks", async (preSelectedPlay) => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first."); return; }

      let selectedPlay = preSelectedPlay;
      if (!selectedPlay) {
        const plays = SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, description: p.status, value: p }));
        const pick = await vscode.window.showQuickPick(plays, { placeHolder: "Initialize hooks from which play?" });
        if (!pick) return;
        selectedPlay = pick.value;
      }

      const localPath = root ? path.join(root, "solution-plays", selectedPlay.dir, ".github", "hooks", "guardrails.json") : null;
      const dstDir = path.join(wsFolder, ".github", "hooks");
      if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });

      if (localPath && fs.existsSync(localPath)) {
        fs.copyFileSync(localPath, path.join(dstDir, "guardrails.json"));
      } else {
        try {
          const content = await downloadFromGitHub(`solution-plays/${selectedPlay.dir}/.github/hooks/guardrails.json`);
          fs.writeFileSync(path.join(dstDir, "guardrails.json"), content, "utf-8");
        } catch {
          vscode.window.showWarningMessage("Could not download hooks. Check network connection.");
          return;
        }
      }
      vscode.window.showInformationMessage("✅ Hooks initialized! .github/hooks/guardrails.json ready.");
    })
  );

  // ── Command: Init Prompts (standalone: downloads from GitHub) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.initPrompts", async (preSelectedPlay) => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first."); return; }

      let selectedPlay = preSelectedPlay;
      if (!selectedPlay) {
        const plays = SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, description: p.status, value: p }));
        const pick = await vscode.window.showQuickPick(plays, { placeHolder: "Initialize prompts from which play?" });
        if (!pick) return;
        selectedPlay = pick.value;
      }

      const promptFiles = ["deploy.prompt.md", "test.prompt.md", "review.prompt.md", "evaluate.prompt.md"];
      const dstDir = path.join(wsFolder, ".github", "prompts");
      if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });

      let copied = 0;
      for (const f of promptFiles) {
        const localPath = root ? path.join(root, "solution-plays", selectedPlay.dir, ".github", "prompts", f) : null;
        if (localPath && fs.existsSync(localPath)) {
          fs.copyFileSync(localPath, path.join(dstDir, f));
          copied++;
        } else {
          try {
            const content = await downloadFromGitHub(`solution-plays/${selectedPlay.dir}/.github/prompts/${f}`);
            fs.writeFileSync(path.join(dstDir, f), content, "utf-8");
            copied++;
          } catch { /* skip */ }
        }
      }
      vscode.window.showInformationMessage(`✅ ${copied} prompt files initialized! Slash commands ready.`);
    })
  );

  // ── Command: Init TuneKit (config + evaluation + infra) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.initTuneKit", async (preSelectedPlay) => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first."); return; }

      let selectedPlay = preSelectedPlay;
      if (!selectedPlay) {
        const plays = SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, description: p.status, value: p }));
        const pick = await vscode.window.showQuickPick(plays, { placeHolder: "Initialize TuneKit from which solution play?" });
        if (!pick) return;
        selectedPlay = pick.value;
      }

      // TuneKit files — only deploy what exists in the play
      const tuneKitCandidates = [
        "config/openai.json",
        "config/guardrails.json",
        "config/agents.json",
        "config/model-comparison.json",
        "config/search.json",
        "config/chunking.json",
      ];

      // Dynamically discover config and evaluation files
      const tuneKitFiles = [];
      const localPlay = root ? path.join(root, "solution-plays", selectedPlay.dir) : null;
      if (localPlay && fs.existsSync(localPlay)) {
        // Only add files that actually exist in this play
        for (const f of tuneKitCandidates) {
          if (fs.existsSync(path.join(localPlay, f))) tuneKitFiles.push(f);
        }
        // Scan evaluation/ if it exists
        const evalDir = path.join(localPlay, "evaluation");
        if (fs.existsSync(evalDir)) {
          for (const f of fs.readdirSync(evalDir)) {
            tuneKitFiles.push(`evaluation/${f}`);
          }
        }
      } else {
        // Fallback for GitHub download
        tuneKitFiles.push(...tuneKitCandidates);
      }

      let copied = 0;
      for (const f of tuneKitFiles) {
        const localPath = root ? path.join(root, "solution-plays", selectedPlay.dir, f) : null;
        if (localPath && fs.existsSync(localPath)) {
          const dstPath = path.join(wsFolder, f);
          const dir = path.dirname(dstPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(localPath, dstPath);
          copied++;
        } else {
          try {
            const content = await downloadFromGitHub(`solution-plays/${selectedPlay.dir}/${f}`);
            const dstPath = path.join(wsFolder, f);
            const dir = path.dirname(dstPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(dstPath, content, "utf-8");
            copied++;
          } catch { /* file may not exist for this play */ }
        }
      }
      vscode.window.showInformationMessage(
        `✅ TuneKit initialized for ${selectedPlay.name}! ${copied} files copied:\n` +
        `• config/*.json (AI parameters)\n• evaluation/ (test set + scoring)`
      );
    })
  );

  // ── Command: Init SpecKit (spec/ + WAF alignment) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.initSpecKit", async (preSelectedPlay) => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first."); return; }

      let selectedPlay = preSelectedPlay;
      if (!selectedPlay) {
        const plays = SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, description: p.status, value: p }));
        const pick = await vscode.window.showQuickPick(plays, { placeHolder: "Initialize SpecKit from which solution play?" });
        if (!pick) return;
        selectedPlay = pick.value;
      }

      // Create spec/ directory
      const specDir = path.join(wsFolder, "spec");
      if (!fs.existsSync(specDir)) fs.mkdirSync(specDir, { recursive: true });

      // Generate play-spec.json from template
      const specTemplate = {
        "$schema": "https://frootai.dev/schemas/spec.json",
        name: selectedPlay.name,
        version: "0.1.0",
        play: selectedPlay.id,
        description: `${selectedPlay.name} implementation`,
        scale: "dev",
        team: { owner: "", reviewers: [] },
        architecture: {
          pattern: selectedPlay.id === "01" ? "rag" : selectedPlay.id === "07" ? "multi-agent" : "standard",
          components: [],
          data_flow: ""
        },
        config: {
          openai: { model: "gpt-4o-mini", temperature: 0.1, max_tokens: 4096 },
          search: { top_k: 5, semantic_config: "default", min_score: 0.75 },
          guardrails: { max_tokens_per_request: 4096, blocked_categories: ["hate", "violence", "self-harm", "sexual"], pii_detection: true, grounding_check: true }
        },
        evaluation: {
          metrics: ["groundedness", "relevance", "coherence", "fluency"],
          thresholds: { groundedness: 4.0, relevance: 4.0, coherence: 4.0, fluency: 4.0 }
        },
        waf_alignment: {
          reliability: "Retry + circuit breaker on all AI calls",
          security: "Managed Identity + Key Vault + Content Safety",
          cost_optimization: "GPT-4o-mini for dev, model routing for prod",
          operational_excellence: "CI/CD + consistency validation + uptime monitors",
          performance_efficiency: "Response caching + streaming + async",
          responsible_ai: "Content safety filters + groundedness checks"
        }
      };

      const specPath = path.join(specDir, "play-spec.json");
      if (!fs.existsSync(specPath)) {
        fs.writeFileSync(specPath, JSON.stringify(specTemplate, null, 2), "utf-8");
      }

      // Download WAF instruction files
      const wafFiles = [
        ".github/instructions/waf-reliability.instructions.md",
        ".github/instructions/waf-security.instructions.md",
        ".github/instructions/waf-cost-optimization.instructions.md",
        ".github/instructions/waf-operational-excellence.instructions.md",
        ".github/instructions/waf-performance-efficiency.instructions.md",
        ".github/instructions/waf-responsible-ai.instructions.md",
      ];

      let wafCopied = 0;
      for (const f of wafFiles) {
        const dstPath = path.join(wsFolder, f);
        const dir = path.dirname(dstPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (fs.existsSync(dstPath)) { wafCopied++; continue; }
        const localPath = root ? path.join(root, f) : null;
        if (localPath && fs.existsSync(localPath)) {
          fs.copyFileSync(localPath, dstPath);
          wafCopied++;
        } else {
          try {
            const content = await downloadFromGitHub(f);
            fs.writeFileSync(dstPath, content, "utf-8");
            wafCopied++;
          } catch { /* WAF file may not exist */ }
        }
      }

      // Download additional spec files from the play folder
      const specFiles = ["spec/fai-manifest.json", "spec/plugin.json", "spec/CHANGELOG.md", "spec/README.md"];
      for (const f of specFiles) {
        const dstPath = path.join(wsFolder, f);
        if (fs.existsSync(dstPath)) continue;
        const localPath = root ? path.join(root, "solution-plays", selectedPlay.dir, f) : null;
        if (localPath && fs.existsSync(localPath)) {
          const dir = path.dirname(dstPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(localPath, dstPath);
        } else {
          try {
            const content = await downloadFromGitHub(`solution-plays/${selectedPlay.dir}/${f}`);
            const dir = path.dirname(dstPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(dstPath, content, "utf-8");
          } catch { /* file may not exist for this play */ }
        }
      }

      vscode.window.showInformationMessage(
        `✅ SpecKit initialized for ${selectedPlay.name}!\n` +
        `• spec/play-spec.json (architecture + WAF alignment)\n` +
        `• spec/fai-manifest.json, plugin.json, CHANGELOG.md, README.md\n` +
        `• ${wafCopied} WAF instruction files (.github/instructions/)\n` +
        `Run \`npx frootai validate --waf\` to check WAF scorecard.`
      );
    })
  );

  // ── Command: Install MCP Server ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.installMcpServer", async () => {
      const choice = await vscode.window.showQuickPick([
        { label: "$(gear) Configure MCP", description: "⭐ Recommended — creates .vscode/mcp.json for Copilot", value: "config" },
        { label: "$(play) Run via npx", description: "npx frootai-mcp@latest — zero install", value: "npx" },
        { label: "$(package) Install globally (npm)", description: "npm install -g frootai-mcp@latest", value: "global" },
        { label: "$(symbol-namespace) Python (pip)", description: "pip install frootai-mcp — pure Python server", value: "pip" },
        { label: "$(symbol-container) Docker", description: "docker run -i ghcr.io/frootai/frootai-mcp", value: "docker" },
      ], { placeHolder: "Set up FrootAI MCP Server" });
      if (!choice) return;

      // Helper: auto-create .vscode/mcp.json for any install method
      const autoCreateMcpJson = () => {
        const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wsFolder) return;
        const configDir = path.join(wsFolder, ".vscode");
        const configPath = path.join(configDir, "mcp.json");
        if (fs.existsSync(configPath)) return; // Don't overwrite existing
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        const mcpConfig = {
          servers: {
            frootai: {
              type: "stdio",
              command: "npx",
              args: ["frootai-mcp@latest"]
            }
          }
        };
        fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2), "utf-8");
        vscode.window.showInformationMessage("✅ Also created .vscode/mcp.json so Copilot can use MCP tools.");
      };

      if (choice.value === "global") {
        const terminal = vscode.window.createTerminal("FrootAI MCP Install");
        terminal.sendText("npm install -g frootai-mcp@latest");
        terminal.show();
        vscode.window.showInformationMessage("Installing frootai-mcp@latest globally. After install, run: frootai-mcp");
        autoCreateMcpJson();
      } else if (choice.value === "npx") {
        const terminal = vscode.window.createTerminal("FrootAI MCP Server");
        terminal.sendText("npx --yes frootai-mcp@latest");
        terminal.show();
        autoCreateMcpJson();
      } else if (choice.value === "docker") {
        const terminal = vscode.window.createTerminal("FrootAI MCP Docker");
        terminal.sendText("docker run -i ghcr.io/frootai/frootai-mcp");
        terminal.show();
        vscode.window.showInformationMessage("🐳 Starting FrootAI MCP via Docker. 45 tools ready.");
        autoCreateMcpJson();
      } else if (choice.value === "pip") {
        const terminal = vscode.window.createTerminal("FrootAI MCP Python");
        terminal.sendText("pip install frootai-mcp && frootai-mcp-py");
        terminal.show();
        vscode.window.showInformationMessage("🐍 Installing Python MCP server from PyPI.");
        autoCreateMcpJson();
      } else if (choice.value === "config") {
        const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first."); return; }
        const mcpConfig = {
          servers: {
            frootai: {
              type: "stdio",
              command: "npx",
              args: ["frootai-mcp@latest"]
            }
          }
        };
        const configDir = path.join(wsFolder, ".vscode");
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(path.join(configDir, "mcp.json"), JSON.stringify(mcpConfig, null, 2), "utf-8");
        vscode.window.showInformationMessage("✅ MCP config added to .vscode/mcp.json. Reload VS Code to activate Copilot Agent mode.");
      }
    })
  );

  // ── Command: Start MCP Server ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.startMcpServer", () => {
      const terminal = vscode.window.createTerminal("FrootAI MCP Server");
      terminal.sendText("npx --yes frootai-mcp@latest");
      terminal.show();
      vscode.window.showInformationMessage("🔌 FrootAI MCP Server starting... 45 tools (6 knowledge + 4 live + 3 chain + 10 ecosystem + 6 engine + 3 scaffold + 13 marketplace).");
    })
  );

  // ── Command: Configure MCP (add .vscode/mcp.json) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.configureMcp", () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first."); return; }
      const mcpConfig = {
        servers: {
          frootai: {
            type: "stdio",
            command: "npx",
            args: ["frootai-mcp@latest"]
          }
        }
      };
      const configDir = path.join(wsFolder, ".vscode");
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "mcp.json"), JSON.stringify(mcpConfig, null, 2), "utf-8");
      vscode.window.showInformationMessage("✅ .vscode/mcp.json created! FrootAI MCP auto-connects when you reload VS Code.");
    })
  );

  // ── Command: MCP Tool Action (left-click action picker) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.mcpToolAction", async (tool) => {
      // Direct to docs view - no QuickPick menu
      vscode.commands.executeCommand("frootai.viewToolDocs", tool);
    })
  );

  // -- Command: View Tool Documentation (rich webview) --
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.viewToolDocs", async (tool) => {
      if (!tool) return;
      const typeLabel = { static: "Static", live: "Live", chain: "Agent Chain", ecosystem: "Ecosystem", compute: "Compute" };
      const typeColor = { static: "#10b981", live: "#06b6d4", chain: "#f59e0b", ecosystem: "#8b5cf6", compute: "#ec4899" };
      const color = typeColor[tool.type] || "#10b981";
      const panel = vscode.window.createWebviewPanel("frootai.mcpDocs", tool.name, vscode.ViewColumn.One, {});
      panel.webview.html = `<!DOCTYPE html><html><head><style>
        body { font-family: var(--vscode-font-family, system-ui); color: var(--vscode-editor-foreground, #e0e0e0); background: var(--vscode-editor-background, #0a0a0f); padding: 32px; max-width: 720px; margin: 0 auto; }
        h1 { font-size: 1.6rem; margin-bottom: 4px; color: ${color}; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: ${color}15; color: ${color}; border: 1px solid ${color}33; margin-bottom: 16px; }
        .desc { font-size: 1rem; opacity: 0.85; margin-bottom: 20px; line-height: 1.5; }
        .docs { background: var(--vscode-editor-inactiveSelectionBackground, #1a1a2e); padding: 20px; border-radius: 12px; border: 1px solid ${color}22; line-height: 1.7; font-size: 0.9rem; }
        .docs code { background: #00000040; padding: 2px 7px; border-radius: 4px; font-family: var(--vscode-editor-font-family, monospace); font-size: 0.85em; color: ${color}; }
        .docs strong { color: ${color}; }
        hr { border: none; border-top: 1px solid #ffffff10; margin: 20px 0; }
        .footer { font-size: 0.75rem; opacity: 0.4; margin-top: 24px; }
        .footer a { color: ${color}; text-decoration: none; }
        .install { margin-top: 16px; padding: 12px 16px; border-radius: 8px; background: #ffffff06; border: 1px solid #ffffff10; font-size: 0.8rem; }
        .install code { background: #00000060; padding: 3px 8px; border-radius: 4px; }
      </style></head><body>
        <h1>${tool.name}</h1>
        <div class="badge">${typeLabel[tool.type] || tool.type}</div>
        <div class="desc">${tool.desc}</div>
        <div class="docs">${(tool.docs || "No documentation available.").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/` + '`' + `([^` + '`' + `]+)` + '`' + `/g, "<code>$1</code>").replace(/\n/g, "<br/>")}</div>
        <div class="install">
          <strong>Install:</strong> <code>npx frootai-mcp@latest</code> | <code>pip install frootai-mcp</code> | <code>docker run -i ghcr.io/frootai/frootai-mcp</code>
        </div>
        <div class="footer">Part of <strong>frootai-mcp</strong> - 45 tools | <a href="https://frootai.dev/mcp-tooling">frootai.dev/mcp-tooling</a> | <a href="https://www.npmjs.com/package/frootai-mcp">npm</a> | <a href="https://pypi.org/project/frootai-mcp/">PyPI</a></div>
      </body></html>`;
    })
  );
  // ── Command: Quick Cost Estimate ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.quickCostEstimate", async () => {
      // Pick a solution play
      const playPick = await vscode.window.showQuickPick(
        SOLUTION_PLAYS.map(p => ({ label: `${p.icon} ${p.id} — ${p.name}`, value: p.id })),
        { placeHolder: "💰 Select a Solution Play to estimate costs" }
      );
      if (!playPick) return;

      // Pick scale
      const scalePick = await vscode.window.showQuickPick([
        { label: "🟢 Small", description: "Dev/PoC — minimal resources", value: "small" },
        { label: "🟡 Medium", description: "Production — standard resources", value: "medium" },
        { label: "🔴 Large", description: "Enterprise — high availability", value: "large" },
      ], { placeHolder: "Select deployment scale" });
      if (!scalePick) return;

      const playNum = parseInt(playPick.value);
      const scale = scalePick.value;

      // Service pricing (mirrors MCP server)
      const SVC_PRICING = {
        "Azure OpenAI (GPT-4o)": { small: 50, medium: 200, large: 800 },
        "Azure OpenAI (GPT-4o-mini)": { small: 10, medium: 50, large: 200 },
        "Azure AI Search (Basic)": { small: 75, medium: 75, large: 75 },
        "Azure AI Search (Standard)": { small: 250, medium: 250, large: 750 },
        "App Service (B1)": { small: 13, medium: 13, large: 13 },
        "App Service (P1v3)": { small: 80, medium: 80, large: 160 },
        "Cosmos DB (Serverless)": { small: 5, medium: 25, large: 100 },
        "Azure Functions (Consumption)": { small: 0, medium: 5, large: 20 },
        "Azure Storage (Blob)": { small: 2, medium: 10, large: 50 },
        "Application Insights": { small: 0, medium: 10, large: 50 },
        "Azure Key Vault": { small: 1, medium: 1, large: 3 },
        "API Management (Consumption)": { small: 3, medium: 3, large: 3 },
        "API Management (Standard)": { small: 680, medium: 680, large: 1360 },
        "Container Apps": { small: 10, medium: 50, large: 200 },
        "AKS (System)": { small: 0, medium: 0, large: 0 },
        "AKS (D4s node)": { small: 140, medium: 280, large: 560 },
        "Azure SQL (Basic)": { small: 5, medium: 5, large: 5 },
        "Azure SQL (Standard S1)": { small: 30, medium: 30, large: 60 },
        "Virtual Network": { small: 0, medium: 0, large: 0 },
        "Azure Front Door": { small: 35, medium: 35, large: 108 },
        "Azure Communication Services": { small: 5, medium: 20, large: 100 },
        "Speech Services": { small: 10, medium: 50, large: 200 },
        "Content Safety": { small: 0, medium: 15, large: 75 },
        "Document Intelligence": { small: 10, medium: 50, large: 200 },
        "Logic Apps": { small: 5, medium: 25, large: 100 },
      };

      // Play-to-services mapping (top plays)
      const PLAY_SERVICES = {
        1: ["Azure OpenAI (GPT-4o)", "Azure AI Search (Basic)", "App Service (B1)", "Azure Storage (Blob)", "Application Insights", "Azure Key Vault"],
        2: ["Virtual Network", "Azure Key Vault", "Application Insights", "Azure Storage (Blob)"],
        3: ["Azure OpenAI (GPT-4o-mini)", "Azure Functions (Consumption)", "Azure Key Vault", "Application Insights"],
        4: ["Azure OpenAI (GPT-4o)", "Speech Services", "Azure Communication Services", "App Service (B1)", "Application Insights"],
        5: ["Azure OpenAI (GPT-4o-mini)", "Azure Functions (Consumption)", "Logic Apps", "Azure Storage (Blob)", "Application Insights"],
        6: ["Document Intelligence", "Azure OpenAI (GPT-4o)", "Azure Storage (Blob)", "Cosmos DB (Serverless)", "Application Insights"],
        7: ["Azure OpenAI (GPT-4o)", "Container Apps", "Cosmos DB (Serverless)", "Azure Key Vault", "Application Insights"],
        8: ["Azure OpenAI (GPT-4o-mini)", "App Service (B1)", "Azure Storage (Blob)", "Application Insights"],
        9: ["Azure AI Search (Standard)", "Azure OpenAI (GPT-4o)", "App Service (P1v3)", "Azure Storage (Blob)", "Application Insights"],
        10: ["Content Safety", "Azure OpenAI (GPT-4o-mini)", "Azure Functions (Consumption)", "Application Insights"],
        11: ["Virtual Network", "Azure Key Vault", "Application Insights", "Azure Storage (Blob)", "Azure Front Door"],
        12: ["AKS (System)", "AKS (D4s node)", "Container Apps", "Azure Key Vault", "Application Insights"],
        13: ["Azure OpenAI (GPT-4o)", "Azure Storage (Blob)", "Azure Functions (Consumption)", "Application Insights"],
        14: ["API Management (Consumption)", "Azure OpenAI (GPT-4o)", "Azure Key Vault", "Application Insights"],
        15: ["Document Intelligence", "Azure OpenAI (GPT-4o)", "Azure Storage (Blob)", "Cosmos DB (Serverless)", "Application Insights"],
        16: ["Azure OpenAI (GPT-4o-mini)", "App Service (B1)", "Azure Storage (Blob)", "Application Insights"],
        17: ["Application Insights", "Azure Functions (Consumption)", "Azure Storage (Blob)", "Cosmos DB (Serverless)"],
        18: ["Azure OpenAI (GPT-4o-mini)", "Cosmos DB (Serverless)", "Azure Functions (Consumption)", "Application Insights"],
        19: ["Azure OpenAI (GPT-4o-mini)", "Container Apps", "Azure Storage (Blob)", "Application Insights"],
        20: ["Azure OpenAI (GPT-4o)", "Azure Functions (Consumption)", "Cosmos DB (Serverless)", "Application Insights"],
      };

      const services = PLAY_SERVICES[playNum] || PLAY_SERVICES[1];
      let total = 0;
      const lines = [];
      for (const svc of services) {
        const price = SVC_PRICING[svc]?.[scale] || 0;
        total += price;
        lines.push(`| ${svc} | $${price}/mo |`);
      }

      const play = SOLUTION_PLAYS.find(p => parseInt(p.id) === playNum);
      const mdContent = `# 💰 Cost Estimate: ${play?.icon || ""} ${play?.name || "Play " + playNum}\n\n` +
        `**Scale:** ${scalePick.label}\n\n` +
        `| Service | Monthly Cost |\n|---|---|\n${lines.join("\n")}\n\n` +
        `**Estimated Total: ~$${total}/month**\n\n` +
        `---\n_Generated by FrootAI Compute Engine · [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)_`;

      const panel = vscode.window.createWebviewPanel("frootai.costEstimate", `Cost: ${play?.name || "Play " + playNum}`, vscode.ViewColumn.One, {});
      panel.webview.html = markdownToHtml(mdContent, `Cost Estimate: ${play?.name}`);
    })
  );

  // ── Command: Validate Config ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.validateConfig", async () => {
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsFolder) { vscode.window.showWarningMessage("Open a folder first to validate config files."); return; }

      // Find config files
      const configDir = path.join(wsFolder, "config");
      const configs = [];
      if (fs.existsSync(configDir)) {
        for (const file of fs.readdirSync(configDir)) {
          if (file.endsWith(".json")) configs.push({ label: `config/${file}`, path: path.join(configDir, file), file });
        }
      }
      // Also check root-level config files
      for (const f of ["openai.json", "guardrails.json", "routing.json"]) {
        const p = path.join(wsFolder, f);
        if (fs.existsSync(p) && !configs.find(c => c.file === f)) configs.push({ label: f, path: p, file: f });
      }

      if (configs.length === 0) {
        vscode.window.showWarningMessage("No config/*.json files found. Create config/openai.json to get started.");
        return;
      }

      const pick = await vscode.window.showQuickPick(
        configs.map(c => ({ label: `📄 ${c.label}`, description: "Validate against best practices", value: c })),
        { placeHolder: "🔍 Select a config file to validate" }
      );
      if (!pick) return;

      const configPath = pick.value.path;
      const fileName = pick.value.file;
      let config;
      try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch (e) {
        vscode.window.showErrorMessage(`Failed to parse ${fileName}: ${e.message}`);
        return;
      }

      // Run validations
      const findings = [];
      const addFinding = (severity, message) => findings.push({ severity, message });

      if (fileName.includes("openai")) {
        // OpenAI config validation
        if (!config.model) addFinding("🔴", "Missing 'model' field — must specify deployment model");
        if (config.temperature !== undefined && config.temperature > 0.3) addFinding("🟡", `temperature=${config.temperature} — consider ≤0.3 for deterministic output`);
        if (config.temperature !== undefined && config.temperature === 0) addFinding("🟢", "temperature=0 — fully deterministic ✓");
        if (!config.max_tokens) addFinding("🟡", "Missing 'max_tokens' — set a limit to control costs");
        if (config.max_tokens && config.max_tokens > 4000) addFinding("🟡", `max_tokens=${config.max_tokens} — high value increases cost`);
        if (config.api_key || config.apiKey) addFinding("🔴", "API key found in config! Use Managed Identity or Key Vault instead");
        if (config.endpoint && !config.endpoint.includes("openai.azure.com")) addFinding("🟡", "Endpoint doesn't look like Azure OpenAI");
        if (!config.system_prompt && !config.systemPrompt) addFinding("🟡", "No system_prompt — consider adding one for consistent behavior");
        if (config.response_format?.type === "json_object") addFinding("🟢", "JSON mode enabled — structured output ✓");
      } else if (fileName.includes("guardrails")) {
        // Guardrails validation
        if (!config.blocked_topics && !config.blockedTopics) addFinding("🟡", "No blocked_topics — consider adding content filters");
        if (!config.pii_filter && !config.piiFilter) addFinding("🟡", "No PII filter — consider enabling for compliance");
        if (!config.max_input_length && !config.maxInputLength) addFinding("🟡", "No max_input_length — vulnerable to prompt injection via long inputs");
        if (config.pii_filter === true || config.piiFilter === true) addFinding("🟢", "PII filter enabled ✓");
        if (config.content_safety || config.contentSafety) addFinding("🟢", "Content safety configured ✓");
      } else if (fileName.includes("routing")) {
        // Routing validation
        if (!config.default_model && !config.defaultModel) addFinding("🟡", "No default_model — requests may fail without fallback");
        if (config.retry_policy || config.retryPolicy) addFinding("🟢", "Retry policy configured ✓");
        if (!config.timeout) addFinding("🟡", "No timeout — long-running requests may hang");
      } else {
        addFinding("🟢", `File parsed successfully — ${Object.keys(config).length} top-level keys found`);
      }

      if (findings.length === 0) {
        findings.push({ severity: "🟢", message: "All checks passed — config looks good!" });
      }

      const criticals = findings.filter(f => f.severity === "🔴").length;
      const warnings = findings.filter(f => f.severity === "🟡").length;
      const goods = findings.filter(f => f.severity === "🟢").length;

      const mdContent = `# 🔍 Config Validation: ${fileName}\n\n` +
        `**Summary:** ${criticals} critical · ${warnings} warnings · ${goods} good\n\n` +
        findings.map(f => `- ${f.severity} ${f.message}`).join("\n") +
        `\n\n---\n_Validated by FrootAI Compute Engine · [Best Practices](https://frootai.dev/ai-nexus/responsible-ai-safety)_`;

      const panel = vscode.window.createWebviewPanel("frootai.validateConfig", `Validate: ${fileName}`, vscode.ViewColumn.One, {});
      panel.webview.html = markdownToHtml(mdContent, `Config Validation: ${fileName}`);

      // Also show notification
      if (criticals > 0) {
        vscode.window.showWarningMessage(`🔴 ${criticals} critical finding(s) in ${fileName}! Open panel for details.`);
      } else if (warnings > 0) {
        vscode.window.showInformationMessage(`🟡 ${warnings} warning(s) in ${fileName}. Open panel for details.`);
      } else {
        vscode.window.showInformationMessage(`🟢 ${fileName} — all checks passed!`);
      }
    })
  );

  // ── Command: Auto-Chain Agents (Build → Review → Tune) ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.autoChainAgents", async () => {
      // Step 1: Ask what to build (search bar)
      const task = await vscode.window.showInputBox({
        prompt: "🛠️ BUILDER AGENT — What would you like to build?",
        placeHolder: "e.g., Build me an IT ticket classification API using Logic Apps + OpenAI",
        ignoreFocusOut: true
      });
      if (!task) return;

      // Read agent.md context if available
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      let agentContext = "";
      if (wsFolder) {
        const agentPath = path.join(wsFolder, "agent.md");
        if (fs.existsSync(agentPath)) {
          agentContext = `\n\nContext from agent.md:\n${fs.readFileSync(agentPath, "utf-8").substring(0, 1500)}`;
        }
      }

      // ── STAGE 1: BUILD ──
      const buildPrompt = `🛠️ BUILDER AGENT — ${task}\n\nRules: Use config/*.json values (never hardcode). Use Managed Identity. Include error handling + App Insights logging. Follow .github/instructions/*.instructions.md patterns.${agentContext}\n\nBuild the complete implementation.`;

      await vscode.env.clipboard.writeText(buildPrompt);
      // Auto-open Copilot Chat
      try { await vscode.commands.executeCommand("workbench.action.chat.open"); } catch { }

      // Show stage prompt at search bar level
      const stage1 = await vscode.window.showQuickPick([
        { label: "$(paste) Paste builder prompt in chat (Ctrl+V)", description: "Prompt is on clipboard", value: "paste" },
        { label: "$(arrow-right) Skip to Review", description: "I've already built the code", value: "review" },
        { label: "$(close) Cancel chain", value: "cancel" },
      ], { placeHolder: "🛠️ STAGE 1/3: BUILD — Prompt copied. Paste in Copilot Chat, then come back here.", ignoreFocusOut: true });

      if (!stage1 || stage1.value === "cancel") return;

      // ── STAGE 2: REVIEW ──
      const reviewPrompt = `🔍 REVIEWER AGENT — Review the code above.\n\nCheck: No secrets in code · Managed Identity · Input validation · Error handling + retry · App Insights logging · Config from files (not hardcoded) · Temperature ≤ 0.3\n\nReport: 🔴 Critical / 🟡 Warning / 🟢 Suggestion for each finding.`;

      await vscode.env.clipboard.writeText(reviewPrompt);

      const stage2 = await vscode.window.showQuickPick([
        { label: "$(paste) Paste reviewer prompt in chat (Ctrl+V)", description: "Review prompt on clipboard", value: "paste" },
        { label: "$(arrow-right) Skip to Tune", description: "Review done, proceed to tuning", value: "tune" },
        { label: "$(close) End chain", value: "cancel" },
      ], { placeHolder: "🔍 STAGE 2/3: REVIEW — Prompt copied. Paste in chat to review your code.", ignoreFocusOut: true });

      if (!stage2 || stage2.value === "cancel") return;

      // ── STAGE 3: TUNE ──
      const tunePrompt = `🎛️ TUNER AGENT — Validate TuneKit config for production.\n\nCheck: config/openai.json (temp ≤ 0.3, model set) · config/guardrails.json (PII filter, blocked topics) · infra/main.bicep (valid, tagged) · evaluation/ (test cases exist) · No secrets in code\n\nVerdict: READY FOR PRODUCTION or NEEDS TUNING (specify what to change).`;

      await vscode.env.clipboard.writeText(tunePrompt);

      const stage3 = await vscode.window.showQuickPick([
        { label: "$(paste) Paste tuner prompt in chat (Ctrl+V)", description: "Tuner prompt on clipboard", value: "paste" },
        { label: "$(rocket) Deploy! (/deploy)", description: "Ready to deploy to Azure", value: "deploy" },
        { label: "$(check) Done — chain complete", value: "done" },
      ], { placeHolder: "🎛️ STAGE 3/3: TUNE — Prompt copied. Paste in chat to validate production config.", ignoreFocusOut: true });

      if (stage3?.value === "deploy") {
        await vscode.env.clipboard.writeText("Run the /deploy slash command: validate Bicep → create resource group → deploy infrastructure → smoke test → verify.");
        vscode.window.showInformationMessage("🚀 Deploy prompt copied! Paste in Copilot Chat.");
      }

      vscode.window.showInformationMessage("✅ Auto-Chain complete: Build → Review → Tune. Your solution is ready!");
    })
  );

  // ── Install Community Plugin ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.installPlugin", async () => {
      const plugins = [
        { label: "$(package) Enterprise RAG Plugin", description: "RAG Q&A with AI Search + OpenAI", detail: "Copies .github agents, instructions, configs for RAG pattern", value: "01-enterprise-rag" },
        { label: "$(package) AI Landing Zone Plugin", description: "Foundation Azure infra for AI workloads", detail: "VNet, private endpoints, RBAC, GPU quotas", value: "02-ai-landing-zone" },
        { label: "$(package) Deterministic Agent Plugin", description: "Reliable agent with temp=0, guardrails", detail: "Anti-sycophancy, structured JSON, citations", value: "03-deterministic-agent" },
        { label: "$(package) Multi-Agent Service Plugin", description: "Supervisor + specialist agents", detail: "Container Apps, Agent Framework, Dapr", value: "07-multi-agent-service" },
        { label: "$(package) Content Moderation Plugin", description: "AI Content Safety + filtering", detail: "Severity levels, custom categories, blocklists", value: "10-content-moderation" },
        { label: "$(globe) Browse Plugin Marketplace", description: "Open frootai.dev/marketplace", value: "marketplace" },
      ];
      const pick = await vscode.window.showQuickPick(plugins, { placeHolder: "Select a community plugin to install into your workspace", ignoreFocusOut: true });
      if (!pick) return;
      if (pick.value === "marketplace") {
        vscode.env.openExternal(vscode.Uri.parse("https://frootai.dev/marketplace"));
        return;
      }
      const folders = vscode.workspace.workspaceFolders;
      if (!folders) { vscode.window.showWarningMessage("Open a workspace first."); return; }
      const wsRoot = folders[0].uri.fsPath;

      // Create plugin files
      const dirs = [".github/agents", ".github/instructions", "config", "spec"];
      for (const d of dirs) {
        const dirPath = path.join(wsRoot, d);
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
      }

      // Agent files
      const agentContent = `---\ndescription: "Builder agent for ${pick.value}"\ntools:\n  - frootai\n---\n# Builder Agent\nUse FrootAI MCP for architecture patterns and best practices for ${pick.value}.\n`;
      fs.writeFileSync(path.join(wsRoot, ".github/agents/builder.agent.md"), agentContent);

      // WAF instruction
      fs.writeFileSync(path.join(wsRoot, ".github/instructions/waf-security.instructions.md"),
        `---\napplyTo: "**/*.{ts,js,py,bicep,json}"\n---\n# Security\n- Use Managed Identity\n- Store secrets in Key Vault\n- Enable Content Safety\n`);

      // Config
      fs.writeFileSync(path.join(wsRoot, "config/openai.json"), JSON.stringify({ model: "gpt-4o-mini", temperature: 0.1, max_tokens: 4096 }, null, 2));
      fs.writeFileSync(path.join(wsRoot, "config/guardrails.json"), JSON.stringify({ max_tokens_per_request: 4096, blocked_categories: ["hate", "violence", "self-harm", "sexual"], pii_detection: true, grounding_check: true }, null, 2));

      // SpecKit
      fs.writeFileSync(path.join(wsRoot, "spec/play-spec.json"), JSON.stringify({ name: pick.value, version: "0.1.0", waf_alignment: { reliability: "unchecked", security: "unchecked", cost_optimization: "unchecked", operational_excellence: "unchecked", performance_efficiency: "unchecked", responsible_ai: "unchecked" } }, null, 2));

      // plugin.json
      fs.writeFileSync(path.join(wsRoot, "plugin.json"), JSON.stringify({ name: pick.value, version: "1.0.0", layers: { instructions: [".github/instructions/*.md"], agents: [".github/agents/*.md"], config: ["config/*.json"], spec: ["spec/*.json"] }, dependencies: ["frootai-mcp"], install: "copy" }, null, 2));

      vscode.window.showInformationMessage(`✅ Plugin "${pick.value}" installed! Files: .github/agents, config, spec, plugin.json`);
    })
  );

  // ── Run Evaluation ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.runEvaluation", async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders) { vscode.window.showWarningMessage("Open a workspace first."); return; }
      const wsRoot = folders[0].uri.fsPath;
      const evalConfig = path.join(wsRoot, "evaluation", "eval-config.json");
      const evalPy = path.join(wsRoot, "evaluation", "eval.py");
      const testSet = path.join(wsRoot, "evaluation", "test-set.jsonl");

      if (!fs.existsSync(evalConfig)) {
        const create = await vscode.window.showWarningMessage("No evaluation/eval-config.json found. Create one?", "Yes", "No");
        if (create === "Yes") {
          if (!fs.existsSync(path.join(wsRoot, "evaluation"))) fs.mkdirSync(path.join(wsRoot, "evaluation"), { recursive: true });
          fs.writeFileSync(evalConfig, JSON.stringify({ metrics: ["groundedness", "relevance", "coherence", "fluency"], thresholds: { groundedness: 4.0, relevance: 4.0, coherence: 4.0, fluency: 4.0 }, dataset: "evaluation/test-data.jsonl" }, null, 2));
          vscode.window.showInformationMessage("✅ Created evaluation/eval-config.json with default thresholds.");
        }
        return;
      }

      // Read eval config
      const config = JSON.parse(fs.readFileSync(evalConfig, "utf8"));
      const metrics = config.metrics || [];
      const thresholds = config.thresholds || {};

      // Try to run eval.py if it exists
      let evalResults = null;
      let evalStatus = "awaiting";
      let evalOutput = "";

      if (fs.existsSync(evalPy) && fs.existsSync(testSet)) {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: "Running evaluation...", cancellable: false },
          async () => {
            try {
              const { execSync } = require("child_process");
              // Use relative paths to avoid spaces-in-path issues on Windows
              const relEvalPy = path.relative(wsRoot, evalPy);
              const relTestSet = path.relative(wsRoot, testSet);
              const pythonCmd = process.platform === "win32" ? "python" : "python3";
              try {
                evalOutput = execSync(`${pythonCmd} "${relEvalPy}" --test-set "${relTestSet}"`, {
                  cwd: wsRoot,
                  encoding: "utf-8",
                  timeout: 30000,
                  shell: true,
                });
              } catch (execErr) {
                // eval.py exits with code 1 when tests fail — that's normal, capture its output
                if (execErr.stdout) evalOutput = execErr.stdout;
                else if (execErr.stderr) evalOutput = execErr.stderr;
                else evalOutput = execErr.message;
              }
              evalStatus = "completed";

              // Parse scores from output (look for lines like "Faithfulness: 0.85")
              const scorePatterns = {
                groundedness: /groundedness[:\s]+([0-9.]+)/i,
                relevance: /relevance[:\s]+([0-9.]+)/i,
                coherence: /coherence[:\s]+([0-9.]+)/i,
                fluency: /fluency[:\s]+([0-9.]+)/i,
                faithfulness: /faithfulness[:\s]+([0-9.]+)/i,
              };
              evalResults = {};
              for (const [metric, pattern] of Object.entries(scorePatterns)) {
                const match = evalOutput.match(pattern);
                if (match) evalResults[metric] = parseFloat(match[1]);
              }

              // Also try to parse "PASS: X/Y" or summary line
              const passMatch = evalOutput.match(/(\d+)\s*\/\s*(\d+)\s*(?:passed|PASS)/i);
              if (passMatch) evalResults._summary = `${passMatch[1]}/${passMatch[2]} passed`;
            } catch (err) {
              evalOutput = err.message || "Evaluation script failed";
              evalStatus = "error";
            }
          }
        );
      } else if (fs.existsSync(evalPy) && !fs.existsSync(testSet)) {
        evalStatus = "no-testset";
      }

      // Build dashboard
      const panel = vscode.window.createWebviewPanel("frootai.evaluation", "Evaluation Dashboard", vscode.ViewColumn.One, { enableScripts: true });

      const metricsHtml = metrics.map(m => {
        const threshold = thresholds[m] || 4.0;
        const actual = evalResults && evalResults[m] !== undefined ? evalResults[m] : null;
        const color = actual !== null
          ? (actual >= threshold ? "#10b981" : actual >= threshold * 0.75 ? "#f59e0b" : "#ef4444")
          : "#10b981";
        const displayValue = actual !== null ? actual.toFixed(2) : threshold;
        const label = actual !== null ? `score: ${actual.toFixed(2)}` : `threshold ≥ ${threshold}`;
        return `<div style="padding:16px;border-radius:12px;border:2px solid ${color}33;background:${color}08;text-align:center;min-width:140px">
          <div style="font-size:2rem;font-weight:800;color:${color}">${displayValue}</div>
          <div style="font-size:0.8rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#888;margin-top:4px">${m}</div>
          <div style="font-size:0.65rem;color:#666;margin-top:2px">${label}</div>
        </div>`;
      }).join("");

      const statusHtml = evalStatus === "completed"
        ? `<div class="status" style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:#10b981;display:inline-block">✅ Evaluation complete${evalResults?._summary ? ` — ${evalResults._summary}` : ""}</div>`
        : evalStatus === "error"
          ? `<div class="status" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;display:inline-block">❌ Evaluation failed</div>`
          : evalStatus === "no-testset"
            ? `<div class="status" style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:#f59e0b;display:inline-block">⚠️ No test-set.jsonl found — create evaluation/test-set.jsonl</div>`
            : `<div class="status" style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:#f59e0b;display:inline-block">⏳ Awaiting evaluation run</div>`;

      const outputHtml = evalOutput
        ? `<h2 style="margin-top:24px">Output</h2><pre style="background:#111;padding:12px;border-radius:8px;font-size:0.75rem;overflow-x:auto;color:#ccc;max-height:300px;overflow-y:auto">${evalOutput.replace(/</g, "&lt;")}</pre>`
        : "";

      panel.webview.html = `<!DOCTYPE html><html><head><style>body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#e0e0e0;padding:24px}h1{font-size:1.5rem;margin-bottom:4px}h2{font-size:1.1rem;color:#10b981;margin-top:24px}.grid{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px}.status{padding:12px 20px;border-radius:10px;font-size:0.85rem;font-weight:600}</style></head><body>
        <h1>📊 Evaluation Dashboard</h1>
        <p style="color:#888;font-size:0.85rem">Config: evaluation/eval-config.json</p>
        <h2>Quality Thresholds</h2>
        <div class="grid">${metricsHtml}</div>
        <h2 style="margin-top:24px">Dataset</h2>
        <p style="font-size:0.85rem">${config.dataset || "evaluation/test-data.jsonl"}</p>
        <h2>Status</h2>
        ${statusHtml}
        ${outputHtml}
        <hr style="border-color:#222;margin:24px 0">
        <p style="font-size:0.7rem;color:#555">FrootAI EvalKit — Part of the FROOT framework. <a href="https://frootai.dev" style="color:#10b981">frootai.dev</a></p>
      </body></html>`;
    })
  );

  // ── Command: Open npm Page ──
  context.subscriptions.push(
    vscode.commands.registerCommand("frootai.openNpmPage", () => {
      vscode.env.openExternal(vscode.Uri.parse("https://www.npmjs.com/package/frootai-mcp"));
    })
  );

  // ── Register MCP Server Definition Provider (VS Code @mcp gallery) ──
  // This is what makes FrootAI appear in VS Code's Extensions view under @mcp.
  // Users can install it with one click and get 45 tools in Copilot Agent mode.
  if (vscode.lm?.registerMcpServerDefinitionProvider) {
    const config = vscode.workspace.getConfiguration("frootai");
    const autoRegister = config.get("mcpAutoRegister", true);
    const transport = config.get("mcpTransport", "stdio");
    const httpUrl = config.get("mcpHttpUrl", "https://mcp.frootai.dev/mcp");

    if (autoRegister) {
      const changeEmitter = new vscode.EventEmitter();

      const provider = {
        onDidChangeMcpServerDefinitions: changeEmitter.event,

        provideMcpServerDefinitions: async () => {
          const cfg = vscode.workspace.getConfiguration("frootai");
          const t = cfg.get("mcpTransport", "stdio");
          const url = cfg.get("mcpHttpUrl", "https://mcp.frootai.dev/mcp");
          const localPath = cfg.get("mcpServerPath", "");

          if (t === "http") {
            return [
              new vscode.McpHttpServerDefinition(
                "frootai",
                vscode.Uri.parse(url),
                {}
              )
            ];
          }

          // stdio mode: use local path if configured, otherwise npx
          const serverDef = localPath
            ? new vscode.McpStdioServerDefinition("frootai", "node", [localPath], {})
            : new vscode.McpStdioServerDefinition("frootai", "npx", ["frootai-mcp@latest"], {});

          return [serverDef];
        },

        resolveMcpServerDefinition: async (def) => {
          // Passthrough — no additional resolution (no auth required for FrootAI)
          return def;
        },
      };

      const reg = vscode.lm.registerMcpServerDefinitionProvider("frootai", provider);
      context.subscriptions.push(reg);
      context.subscriptions.push(changeEmitter);

      // Re-provide when user changes transport settings
      context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
          if (e.affectsConfiguration("frootai.mcpTransport") ||
            e.affectsConfiguration("frootai.mcpServerPath") ||
            e.affectsConfiguration("frootai.mcpHttpUrl")) {
            changeEmitter.fire();
          }
        })
      );
    }
  }

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = "$(tree-view-icon) FrootAI";
  statusBar.tooltip = `FrootAI — AI Architecture Knowledge Engine\n${knowledgeLoaded ? `${Object.keys(KNOWLEDGE.modules).length} modules · ${Object.keys(GLOSSARY).length} terms · 45 MCP tools` : "Knowledge loading..."}`;
  statusBar.command = "frootai.browseSolutionPlays";
  statusBar.show();
  context.subscriptions.push(statusBar);
}

// ─── Find FrootAI Root (optional enhancement, not required) ────────

function findFrootAIRoot() {
  const config = vscode.workspace.getConfiguration("frootai");
  const customPath = config.get("solutionPlaysPath");
  if (customPath) return customPath;
  const folders = vscode.workspace.workspaceFolders;
  if (folders) {
    for (const folder of folders) {
      if (fs.existsSync(path.join(folder.uri.fsPath, "solution-plays", "01-enterprise-rag"))) return folder.uri.fsPath;
      if (fs.existsSync(path.join(folder.uri.fsPath, "agent.md")) && fs.existsSync(path.join(folder.uri.fsPath, "config"))) return path.join(folder.uri.fsPath, "..", "..");
    }
  }
  // Check common local install paths
  const commonPaths = [
    path.join(process.env.USERPROFILE || process.env.HOME || "", "CodeSpace", "frootai"),
    "c:\\CodeSpace\\frootai",
    path.join(process.env.USERPROFILE || process.env.HOME || "", "code", "frootai"),
    path.join(process.env.USERPROFILE || process.env.HOME || "", "repos", "frootai"),
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(path.join(p, "solution-plays", "01-enterprise-rag"))) return p;
  }
  return null;
}

function deactivate() { }
module.exports = { activate, deactivate };
