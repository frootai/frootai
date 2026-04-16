import Badge from "../components/Badge";
import WafPills from "../components/WafPills";
import { vscode } from "../vscode";
import type { SolutionPlay } from "../types";
import { FileText, LayoutList, Shield, Zap, BookOpen, Puzzle, Layers, Link2, Package, Wrench, BarChart3, ChevronRight, ChevronLeft, ExternalLink, DollarSign, Cpu, Settings } from "lucide-react";

const LAYER_NAMES: Record<string, string> = { F: "Foundations", R: "Reasoning", O: "Orchestration", T: "Transformation" };
const CX_COLORS: Record<string, string> = { Foundation: "#0ea5e9", Low: "#10b981", Medium: "#f59e0b", High: "#ef4444", "Very High": "#7c3aed" };

const Icon = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 6, opacity: 0.7 }}>{children}</span>
);

const PLAY_GUIDES: Record<string, string> = {
  "01": "Build a production RAG pipeline using Azure AI Search for hybrid retrieval (keyword + vector + semantic reranking) and Azure OpenAI GPT-4o for grounded answer generation with citations. Container Apps hosts the API with auto-scaling. Real-world: Financial services knowledge bases, healthcare support portals, legal document search systems.",
  "02": "Provision a secure AI-ready landing zone with hub-spoke VNet topology, private endpoints for all PaaS services, Managed Identity, RBAC, and Key Vault integration. Supports GPU quota management across regions. Real-world: Enterprise AI platform foundations, regulated industry cloud adoption, multi-team AI centers of excellence.",
  "03": "Deploy a deterministic AI agent using temperature=0, fixed seeds, structured JSON output schemas, and content safety guardrails on Azure Container Apps with Azure OpenAI. Ensures reproducible, auditable responses. Real-world: Compliance document generation, medical report drafting, financial statement analysis.",
  "04": "Build a real-time voice AI pipeline using Azure Communication Services for telephony, AI Speech for STT/TTS, and Azure OpenAI for conversational logic with streaming responses. Real-world: Call center automation, insurance claims intake, banking customer service hotlines.",
  "05": "Automate IT ticket classification, routing, and resolution using Azure OpenAI for intent detection and Logic Apps for workflow orchestration with ServiceNow MCP integration. Real-world: Enterprise IT helpdesks, MSP ticket triage, internal support portals.",
  "06": "Extract, classify, and structure data from documents using Azure Document Intelligence for OCR and Azure OpenAI for semantic enrichment, with Blob Storage for ingestion. Real-world: Invoice processing, contract extraction, insurance claims document handling.",
  "07": "Orchestrate a supervisor agent that delegates to specialist sub-agents using Azure Container Apps, Cosmos DB for state, and Dapr for messaging. Azure OpenAI powers each agent. Real-world: Complex customer service workflows, research analysis pipelines, multi-domain enterprise assistants.",
  "08": "Build a low-code enterprise chatbot using Microsoft Copilot Studio with Dataverse knowledge sources and SharePoint integration for rapid deployment without custom code. Real-world: Employee FAQ bots, HR policy assistants, internal IT support chatbots.",
  "09": "Create an enterprise search portal with Azure AI Search semantic ranking, hybrid retrieval, and Azure OpenAI for answer synthesis hosted on App Service. Real-world: Corporate intranet search, product documentation portals, research library discovery.",
  "10": "Implement AI content moderation using Azure Content Safety for multi-category severity scoring, API Management for rate limiting, and Functions for processing with configurable blocklists. Real-world: Social media platforms, user-generated content sites, community forums.",
  "11": "Deploy a multi-region, policy-driven AI landing zone with Azure Policy enforcement, advanced RBAC, cross-region VNet peering, and centralized governance for enterprise AI workloads. Real-world: Global enterprise AI platforms, regulated multi-region deployments, government cloud adoption.",
  "12": "Serve open-source or custom ML models on AKS with GPU node pools, Container Registry for image management, and KEDA for autoscaling based on inference queue depth. Real-world: Custom LLM hosting, computer vision inference APIs, real-time recommendation engines.",
  "13": "Build a fine-tuning pipeline using Azure OpenAI fine-tuning APIs with Blob Storage for JSONL datasets, automated evaluation, and model versioning for domain adaptation. Real-world: Domain-specific chatbots, custom classification models, brand-voice content generation.",
  "14": "Deploy an AI API gateway using Azure API Management with token budget enforcement, rate limiting, model routing, and cost tracking for Azure OpenAI endpoints. Real-world: Multi-team AI platform governance, SaaS AI billing, enterprise LLM cost control.",
  "15": "Process documents using GPT-4o Vision for multi-modal analysis combined with Azure Document Intelligence for structured extraction and Blob Storage for document management. Real-world: Medical record processing, architectural plan analysis, handwritten form digitization.",
  "16": "Build a Microsoft Teams bot extension using Bot Framework with Azure OpenAI for conversational AI, adaptive cards for rich UX, and Entra ID for secure authentication. Real-world: Teams-based IT support, project management assistants, sales enablement bots.",
  "17": "Implement AI observability using Application Insights for distributed tracing, Log Analytics for KQL queries, and Azure Monitor for custom AI metrics and alerting dashboards. Real-world: AI SLA monitoring, LLM latency dashboards, token usage tracking.",
  "18": "Build a version-controlled prompt library using Blob Storage for prompt templates, Cosmos DB for metadata, and Container Apps for the management API with A/B testing support. Real-world: Prompt engineering teams, multi-model prompt optimization, enterprise prompt governance.",
  "19": "Deploy AI models on edge devices using ONNX Runtime with Phi-4-mini, supporting quantization and offline inference with cloud sync for periodic model updates. Real-world: Retail point-of-sale AI, field service assistants, disconnected environment intelligence.",
  "20": "Build real-time anomaly detection using Event Hubs for stream ingestion, Stream Analytics for windowed processing, and Azure OpenAI for contextual anomaly explanation. Real-world: IoT sensor monitoring, financial transaction surveillance, infrastructure health alerting.",
  "21": "Implement agentic RAG with autonomous multi-step retrieval using Azure OpenAI, AI Search, and Container Apps. The agent iteratively refines queries and synthesizes across sources with Key Vault for secrets. Real-world: Complex research assistants, multi-document legal analysis, technical support escalation.",
  "22": "Orchestrate a swarm of specialized agents with dynamic delegation using Azure OpenAI, Service Bus for messaging, Cosmos DB for shared state, and Container Apps for hosting. Real-world: Distributed research teams, complex project planning, multi-domain analysis workflows.",
  "23": "Build AI-driven browser automation using OpenAI Vision for page understanding, Playwright for browser control, and Container Apps for orchestration with domain allowlists. Real-world: Web scraping automation, UI testing pipelines, competitive intelligence gathering.",
  "24": "Automate code review using Azure OpenAI for semantic analysis combined with CodeQL for static analysis, integrated into GitHub Actions CI/CD pipelines with severity thresholds. Real-world: Pull request quality gates, security vulnerability detection, coding standards enforcement.",
  "25": "Implement tiered conversation memory using Cosmos DB for long-term storage, Redis for session cache, and AI Search for semantic recall across conversation history with Azure OpenAI. Real-world: Customer support continuity, personal AI assistants, therapy chatbot sessions.",
  "26": "Build enterprise semantic search with hybrid retrieval (BM25 + vector + semantic reranker) using Azure AI Search, OpenAI embeddings, and Blob Storage for document ingestion. Real-world: Knowledge base search, product catalog discovery, documentation portals.",
  "27": "Create an LLM-powered data pipeline using Azure OpenAI mini for classification, Data Factory for orchestration, Cosmos DB for enriched output, and Event Hubs for streaming ingestion. Real-world: Log classification, customer feedback analysis, content tagging at scale.",
  "28": "Enhance RAG with knowledge graph traversal using Cosmos DB Gremlin API for entity relationships, AI Search for vector retrieval, and Azure OpenAI for graph-aware synthesis. Real-world: Biomedical research, organizational knowledge mapping, supply chain relationship analysis.",
  "29": "Deploy a centralized MCP tool gateway using Azure API Management for routing, Container Apps for MCP server hosting, and Monitor for tool usage analytics and rate limiting. Real-world: Enterprise tool federation, multi-agent tool sharing, API-first AI platforms.",
  "30": "Harden AI applications with Azure Content Safety for input/output filtering, prompt injection defense, red team testing, and comprehensive security monitoring on Container Apps. Real-world: Public-facing AI chatbots, regulated industry AI, consumer-facing AI products.",
  "31": "Build a visual AI pipeline builder with drag-and-drop using Static Web Apps for the frontend, Container Apps for execution, Azure OpenAI for generation, and Cosmos DB for pipeline definitions. Real-world: Citizen developer AI tools, no-code AI automation, business analyst workflows.",
  "32": "Generate AI-powered tests using Azure OpenAI for test case creation, mutation testing for quality validation, integrated with GitHub Actions for CI/CD automation on Container Apps. Real-world: Test coverage improvement, regression test generation, API contract testing.",
  "33": "Build a conversational voice agent using AI Speech for real-time STT/TTS, Azure OpenAI for dialogue management, and Communication Services for telephony integration. Real-world: Virtual receptionists, appointment booking systems, interactive voice survey platforms.",
  "34": "Deploy AI models to edge devices with ONNX quantization, IoT Hub for device management, and Container Instances for cloud-edge sync and periodic model updates. Real-world: Manufacturing quality inspection, autonomous vehicle perception, remote sensor intelligence.",
  "35": "Automate compliance checking using Azure OpenAI for policy interpretation, Azure Policy for enforcement, Key Vault for secrets, and Cosmos DB for immutable audit trails. Real-world: SOC 2 compliance automation, HIPAA audit reporting, financial regulatory filings.",
  "36": "Build a multimodal agent handling text, image, and audio inputs using OpenAI Vision and AI Vision APIs, with Blob Storage for media management and intelligent routing. Real-world: Insurance claims with photo evidence, accessibility tools, multi-format content analysis.",
  "37": "Implement AIOps using Azure OpenAI for incident analysis, Monitor for telemetry collection, and GitHub Actions for auto-remediation playbooks with DevOps integration. Real-world: Cloud infrastructure management, SRE automation, incident response acceleration.",
  "38": "Process complex documents using Document Intelligence with custom extraction schemas, Azure OpenAI for semantic understanding, and Cosmos DB for structured output storage. Real-world: Tax form processing, scientific paper extraction, regulatory filing analysis.",
  "39": "Build an AI meeting assistant using AI Speech for transcription, Azure OpenAI for summarization and action item extraction, and Graph API for calendar integration on Container Apps. Real-world: Board meeting intelligence, sales call analysis, project standup automation.",
  "40": "Extend Copilot Studio with custom AI agents using Azure OpenAI, Dataverse for data, and Graph API for M365 integration with advanced multi-turn conversation flows. Real-world: Executive dashboard assistants, CRM-integrated sales bots, advanced HR workflow automation.",
  "41": "Build systematic AI red teaming using AI Foundry for attack generation, Content Safety for defense testing, and Azure OpenAI for adversarial prompt evaluation and reporting. Real-world: AI safety validation, pre-launch security testing, regulatory compliance verification.",
  "42": "Deploy a vision-based desktop automation agent using OpenAI Vision for screen understanding, Container Apps for orchestration, and Blob Storage for screenshot management. Real-world: Legacy system automation, RPA augmentation, cross-application workflow automation.",
  "43": "Generate AI videos with safety controls using Azure OpenAI for script generation, Blob Storage for media assets, Content Safety for filtering, and Service Bus for job queuing. Real-world: Marketing content creation, training video generation, social media content automation.",
  "44": "Run AI models locally with Foundry Local for on-device inference and cloud escalation for complex queries via Azure OpenAI, with IoT Hub for device fleet management. Real-world: Privacy-sensitive AI, offline-capable assistants, latency-critical edge applications.",
  "45": "Process real-time events with AI anomaly detection using Event Hubs for ingestion, Functions for processing, Azure OpenAI for analysis, Cosmos DB for state, and SignalR for live dashboards. Real-world: Financial trading surveillance, IoT alarm systems, real-time fraud detection.",
  "46": "Build clinical decision support with human-in-the-loop validation using Azure OpenAI, Health Data Services for FHIR, AI Search for medical literature, and Content Safety for clinical guardrails. Real-world: Clinical trial matching, diagnostic assistance, treatment recommendation systems.",
  "47": "Generate privacy-preserving synthetic data using Azure OpenAI for generation, Machine Learning for statistical validation, and Blob Storage for dataset management with differential privacy. Real-world: ML training data augmentation, privacy-compliant testing, research data sharing.",
  "48": "Implement model lifecycle governance with drift detection using ML for model registry, AI Foundry for evaluation, DevOps for CI/CD, Cosmos DB for audit, and Azure Policy for enforcement. Real-world: Regulated AI model management, ML model versioning, production model monitoring.",
  "49": "Build a creative AI studio for brand-consistent content generation using Azure OpenAI, Blob Storage for assets, Content Safety for moderation, Functions for processing, and CDN for delivery. Real-world: Marketing content factories, social media content creation, brand asset generation.",
  "50": "Analyze financial risk in real-time using Azure OpenAI for analysis, AI Search for regulatory data, Cosmos DB for risk profiles, and Event Hubs for market data streaming. Real-world: Portfolio risk monitoring, regulatory compliance dashboards, credit risk assessment.",
  "51": "Deploy an autonomous coding agent that writes code, runs tests, and iterates using Azure OpenAI for generation, GitHub Actions for CI validation, and Container Apps for orchestration. Real-world: Automated bug fixing, feature scaffolding, code migration automation.",
  "52": "Build an advanced AI gateway with semantic caching using APIM for routing, Redis for similarity-based cache, Azure OpenAI for inference, and Monitor for cost analytics. Real-world: High-volume AI API platforms, cost-optimized LLM serving, multi-tenant AI infrastructure.",
  "53": "Analyze legal documents with risk assessment using Azure OpenAI for clause analysis, AI Search for precedent lookup, Blob Storage for documents, and Cosmos DB for case tracking. Real-world: Contract review automation, regulatory risk assessment, legal due diligence.",
  "54": "Build advanced AI customer support with sentiment analysis using Azure OpenAI, AI Search for knowledge, Communication Services for omnichannel, and Cosmos DB for interaction history. Real-world: Omnichannel support platforms, customer satisfaction optimization, escalation management.",
  "55": "Optimize supply chains with demand forecasting using Azure OpenAI for analysis, Cosmos DB for supply data, Event Hubs for real-time signals, and ML for prediction models. Real-world: Retail demand planning, manufacturing supply optimization, logistics route planning.",
  "56": "Build semantic code search using OpenAI embeddings with AI Search for vector retrieval, Blob Storage for repository indexing, and configurable chunk size and relevance thresholds. Real-world: Large codebase navigation, code reuse discovery, developer productivity tools.",
  "57": "Deploy a neural translation engine with Azure OpenAI for translation, AI Translator for language detection, Cosmos DB for glossary management, and CDN for cached translations. Real-world: Enterprise localization, real-time chat translation, documentation internationalization.",
  "58": "Build a digital twin with predictive simulation using IoT Hub for sensor data, Digital Twins for modeling, Azure OpenAI for analysis, and Functions for automated responses. Real-world: Factory floor optimization, building management systems, infrastructure monitoring.",
  "59": "Create an AI recruiter agent with bias-aware matching using Azure OpenAI for analysis, AI Search for candidate retrieval, Cosmos DB for profiles, and Graph for org context. Real-world: Talent acquisition automation, skills-based hiring, diversity-focused recruitment.",
  "60": "Build a responsible AI dashboard with fairness metrics using Azure OpenAI, ML for bias detection, Monitor for metric collection, Cosmos DB for audit, and Static Web Apps for visualization. Real-world: AI ethics monitoring, model fairness auditing, regulatory AI transparency reporting.",
  "61": "Implement advanced content moderation with severity-based routing using Content Safety for analysis, Azure OpenAI for context, Cosmos DB for logs, and Service Bus for queue management. Real-world: Large-scale platform moderation, age-appropriate content filtering, community safety systems.",
  "62": "Build privacy-preserving federated learning using ML for model coordination, Confidential Computing for secure aggregation, and Blob Storage for encrypted model distribution. Real-world: Healthcare multi-site ML, financial consortium models, privacy-regulated collaborative AI.",
  "63": "Detect fraud in real-time using Azure OpenAI for pattern analysis, Event Hubs for transaction streaming, Stream Analytics for velocity checks, and Cosmos DB for risk profiles. Real-world: Payment fraud prevention, account takeover detection, insurance fraud investigation.",
  "64": "Build an AI sales assistant with lead scoring using Azure OpenAI for personalization, Cosmos DB for CRM data, Graph for org insights, and AI Search for product knowledge. Real-world: B2B sales enablement, lead qualification automation, sales email personalization.",
  "65": "Create adaptive AI training curriculum with difficulty scaling using Azure OpenAI for content generation, Cosmos DB for learner profiles, and Static Web Apps for the learning portal. Real-world: Corporate training platforms, coding bootcamps, professional certification prep.",
  "66": "Optimize cloud infrastructure costs using Azure OpenAI for analysis, Monitor for utilization data, Advisor for recommendations, and Cost Management for budget tracking and alerting. Real-world: Cloud FinOps automation, infrastructure right-sizing, spending anomaly detection.",
  "67": "Build enterprise knowledge management with contextual retrieval using Azure OpenAI, AI Search for semantic indexing, Cosmos DB for knowledge graphs, and Graph for organizational context. Real-world: Corporate wikis, institutional knowledge preservation, expert discovery systems.",
  "68": "Implement predictive maintenance using IoT Hub for sensor ingestion, Azure OpenAI for failure analysis, ML for remaining useful life prediction, and Stream Analytics for real-time alerting. Real-world: Manufacturing equipment monitoring, fleet maintenance, utility infrastructure management.",
  "69": "Track carbon footprint in real-time using Azure Monitor for cloud emissions, Azure OpenAI for analysis, Cosmos DB for carbon accounting, and Event Hubs for supply chain signals. Real-world: Corporate sustainability reporting, cloud carbon accounting, supply chain emissions tracking.",
  "70": "Automate ESG compliance reporting with GRI/SASB/TCFD/CSRD frameworks using Azure OpenAI for analysis, Document Intelligence for report extraction, Cosmos DB for data, and AI Search for regulatory lookup. Real-world: Corporate ESG disclosures, sustainability auditing, investor reporting.",
  "71": "Build smart energy grid management using IoT Hub for sensor data, Digital Twins for grid simulation, Azure OpenAI for demand prediction, and Stream Analytics for real-time balancing. Real-world: Utility grid optimization, renewable energy integration, battery storage scheduling.",
  "72": "Model climate risk scenarios for financial assessment using Azure OpenAI for analysis, ML for scenario modeling, Cosmos DB for portfolio data, and AI Search for climate research. Real-world: Climate stress testing for banks, insurance risk modeling, investment portfolio climate analysis.",
  "73": "Optimize waste management with AI Vision for material classification, Azure OpenAI for route optimization, IoT Hub for bin sensors, and Container Apps for fleet coordination. Real-world: Municipal recycling programs, commercial waste management, circular economy platforms.",
  "74": "Build a personalized AI tutor using Socratic method with Azure OpenAI for adaptive dialogue, Cosmos DB for learner progress, AI Search for curriculum content, and Static Web Apps for the portal. Real-world: K-12 supplemental education, language learning, STEM tutoring platforms.",
  "75": "Auto-generate exams with difficulty calibration using Azure OpenAI for question generation, Blob Storage for question banks, Cosmos DB for rubrics, and Functions for automated scoring. Real-world: University exam creation, professional certification testing, corporate assessment generation.",
  "76": "Build accessible learning experiences with AI Speech for screen reader support, Azure OpenAI for content adaptation, AI Vision for image descriptions, and Container Apps for delivery. Real-world: Inclusive education platforms, disability accommodation tools, multi-modal learning systems.",
  "77": "Analyze research papers with citation network mapping using Azure OpenAI for methodology critique, AI Search for literature discovery, Cosmos DB for citation graphs, and Graph for relationships. Real-world: Academic research assistants, systematic literature reviews, research gap identification.",
  "78": "Deploy precision agriculture using IoT Hub for sensor fusion, AI Vision for satellite imagery analysis, Azure OpenAI for recommendations, and Digital Twins for farm modeling. Real-world: Crop health monitoring, irrigation optimization, yield prediction for farming operations.",
  "79": "Implement food safety inspection using Document Intelligence for HACCP compliance, Azure OpenAI for risk scoring, Cosmos DB for traceability records, and Event Hubs for temperature alerts. Real-world: Food manufacturing compliance, restaurant inspection automation, supply chain traceability.",
  "80": "Monitor biodiversity using AI Vision for species identification from camera traps, Azure OpenAI for conservation alerts, IoT Hub for sensor networks, and Cosmos DB for population tracking. Real-world: Wildlife conservation programs, environmental impact assessment, national park monitoring.",
  "81": "Automate property valuation using Azure OpenAI for market analysis, AI Search for comparable sales, Cosmos DB for property data, ML for trend modeling, and Functions for report generation. Real-world: Real estate appraisals, mortgage underwriting, property tax assessment.",
  "82": "Monitor construction site safety using AI Vision for PPE compliance detection, IoT Hub for environmental sensors, Azure OpenAI for hazard analysis, and Container Apps for alert management. Real-world: Construction safety compliance, mining site monitoring, industrial workplace safety.",
  "83": "Optimize building energy using Digital Twins for HVAC simulation, IoT Hub for occupancy sensing, Azure OpenAI for schedule optimization, and Functions for automated control adjustments. Real-world: Commercial building management, smart campus energy, green building certification.",
  "84": "Build a multi-language citizen services chatbot using Azure OpenAI for conversation, AI Translator for language support, Communication Services for channels, and AI Search for service catalogs. Real-world: Municipal government portals, public service kiosks, immigration assistance systems.",
  "85": "Analyze policy impact with regulatory change detection using Azure OpenAI for cross-sector analysis, AI Search for legislative data, Document Intelligence for policy extraction, and Cosmos DB for stakeholder mapping. Real-world: Government policy offices, regulatory consulting, public affairs analysis.",
  "86": "Build public safety analytics using Azure OpenAI for pattern analysis, ML for crime prediction, Event Hubs for real-time incident data, Cosmos DB for records, and Stream Analytics for sentiment monitoring. Real-world: Law enforcement resource allocation, emergency response optimization, community safety dashboards.",
  "87": "Deploy dynamic pricing using Azure OpenAI for demand analysis, Event Hubs for real-time market signals, Cosmos DB for pricing rules, Redis for caching, and ML for elasticity modeling. Real-world: E-commerce pricing, ride-sharing surge pricing, hotel revenue management.",
  "88": "Build visual product search using AI Vision for image understanding, Azure OpenAI for style recommendations, AI Search for catalog matching, and Container Apps for the search API. Real-world: Fashion e-commerce, furniture visual search, industrial parts lookup.",
  "89": "Predict retail inventory demand using Azure OpenAI for trend analysis, ML for forecasting models, Cosmos DB for inventory data, Event Hubs for sales signals, and Functions for automated reordering. Real-world: Retail supply chain, grocery inventory management, seasonal demand planning.",
  "90": "Optimize telecom networks using IoT Hub for 5G/LTE telemetry, Stream Analytics for traffic analysis, Azure OpenAI for capacity planning, Digital Twins for simulation, and Cosmos DB for state. Real-world: 5G network planning, LTE capacity management, self-healing network operations.",
  "91": "Predict customer churn using Azure OpenAI for behavioral analysis, ML for risk scoring, Cosmos DB for customer profiles, Communication Services for retention campaigns, and Functions for automation. Real-world: Telecom subscriber retention, SaaS churn prevention, subscription service optimization.",
  "92": "Detect telecom fraud in real-time using Event Hubs for call data streaming, Stream Analytics for pattern detection, Azure OpenAI for fraud analysis, Cosmos DB for risk profiles, and Functions for blocking. Real-world: SIM swap prevention, toll fraud blocking, revenue share fraud detection.",
  "93": "Build a continual learning agent that persists knowledge across sessions using Azure OpenAI, Cosmos DB for memory, AI Search for semantic recall, Redis for session state, and Functions for reflection triggers. Real-world: Personal AI assistants, adaptive tutoring systems, evolving enterprise chatbots.",
  "94": "Generate AI podcasts with multi-speaker synthesis using AI Speech for voice generation, Azure OpenAI for script creation, Blob Storage for audio assets, CDN for distribution, and Functions for processing. Real-world: Automated news podcasts, educational audio content, corporate communications.",
  "95": "Build unified multimodal search across images, text, code, and audio using AI Search for indexing, AI Vision and AI Speech for encoding, Azure OpenAI for cross-modal synthesis, and Container Apps for the API. Real-world: Digital asset management, media library search, enterprise content discovery.",
  "96": "Deploy a next-gen voice agent with sub-200ms latency using Azure AI Voice Live for real-time speech, Azure OpenAI for dialogue, Container Apps for hosting, and Functions for MCP tool integration. Real-world: Virtual assistants, real-time language interpreters, accessibility voice interfaces.",
  "97": "Build an AI data marketplace for publishing and monetizing datasets using ML for quality validation, Blob Storage for hosting, API Management for monetization, Cosmos DB for catalog, and Functions for privacy enforcement. Real-world: Data exchange platforms, research data sharing, synthetic data marketplaces.",
  "98": "Create an agent evaluation platform with automated benchmarks using Azure OpenAI for test generation, Container Apps for execution, Cosmos DB for results, ML for leaderboards, and Functions for scheduling. Real-world: AI model comparison, agent quality assurance, LLM benchmark platforms.",
  "99": "Build an enterprise AI governance hub using API Management for model access control, Azure Policy for enforcement, Monitor for compliance tracking, Cosmos DB for audit logs, and Key Vault for secrets. Real-world: Enterprise AI oversight, regulatory AI compliance, multi-team AI governance.",
  "100": "Deploy the FAI Meta-Agent — a self-orchestrating super-agent that selects plays, provisions infrastructure, and delivers production AI using Azure OpenAI, MCP Server, Container Apps, Cosmos DB, AI Search, and Key Vault. Real-world: Automated AI solution delivery, self-service AI platforms, AI factory automation.",
  "101": "Scaffold a standardized solution play using the golden template with DevKit, TuneKit, SpecKit, and Infra kits. Provides canonical file structure, agent triads, and FAI Protocol wiring powered by PowerShell Pester and GitHub Actions. Real-world: New play bootstrapping, team onboarding templates, standardized AI project initialization.",
};

interface Props { play?: SolutionPlay; }

export default function PlayDetail({ play }: Props) {
  const p: SolutionPlay = play ?? { id: "01", name: "Enterprise RAG Q&A", dir: "01-enterprise-rag", layer: "R", desc: "Production RAG pipeline", cx: "Medium", infra: "AI Search · Azure OpenAI" };
  const layerName = LAYER_NAMES[p.layer] ?? p.layer;
  const cx = p.cx ?? "Medium";
  const cxColor = CX_COLORS[cx] ?? "#6b7280";
  const logoUri = (window as any).panelData?.logoUri;
  const cmd = (command: string) => vscode.postMessage({ command, playId: p.id, playDir: p.dir });
  const openUrl = (url: string) => vscode.postMessage({ command: "openUrl", url });
  const goBack = () => vscode.postMessage({ command: "navigate", panel: "playBrowser" });

  return (
    <div className="container">
      {/* Back to All Plays */}
      <div style={{ marginBottom: 8 }}>
        <button onClick={goBack} style={{ background: "none", border: "none", color: "var(--vscode-textLink-foreground, #3794ff)", cursor: "pointer", fontSize: 12, fontFamily: "inherit", padding: "4px 0", display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronLeft size={14} /> All Solution Plays
        </button>
      </div>

      {/* FrootAI branding */}
      <div style={{ textAlign: "center", padding: "16px 16px 8px" }}>
        {logoUri && <img src={logoUri} alt="FrootAI" style={{ width: 48, height: 48, marginBottom: 8 }} />}
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>
          <span style={{ color: "var(--vscode-foreground)" }}>Froot</span><span style={{ color: "#10b981" }}>AI</span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>From the Roots to the Fruits — The Open Glue for GenAI</div>
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>We unify agents, instructions, skills, hooks, and guardrails into connected solution plays</div>
      </div>

      {/* Hero */}
      <div className="hero">
        <h1>Play {p.id} — {p.name}</h1>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
          <Badge label={cx} color={cxColor} />
          <Badge label={layerName} color="#6b7280" />
        </div>
      </div>

      {/* Description — rich 3-4 lines */}
      <div className="section">
        <div className="section-title"><Icon><FileText size={16} /></Icon> What This Play Does</div>
        <p style={{ fontSize: 13, lineHeight: 1.8, opacity: 0.9 }}>{PLAY_GUIDES[p.id] || p.desc || "A pre-architected AI solution ready to scaffold and deploy on Azure."}</p>
        {p.infra && (
          <div style={{ marginTop: 10 }}>
            <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 600, display: "block", marginBottom: 6 }}>Azure Services</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {p.infra.split("·").map((s: string) => (
                <span key={s.trim()} style={{ padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 500, background: "var(--vscode-badge-background, #333)", color: "var(--vscode-badge-foreground, #ccc)" }}>{s.trim()}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Play Details — compact card with pipes */}
      <div className="section">
        <div className="section-title"><Icon><LayoutList size={16} /></Icon> Play Details</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 14px", borderRadius: 8, background: "var(--vscode-editor-inactiveSelectionBackground, #2a2d2e)", border: "1px solid var(--vscode-widget-border, #454545)" }}>
          <Chip label="Play" value={p.id} /><Pipe />
          <Chip label="Directory" value={p.dir} mono /><Pipe />
          <Chip label="Layer" value={layerName} /><Pipe />
          <Chip label="Complexity" value={cx} color={cxColor} /><Pipe />
          <Chip label="Status" value={p.status ?? "Ready"} color="#10b981" dot />
        </div>
      </div>

      {/* FAI Pillars */}
      <div className="section">
        <div className="section-title"><Icon><Shield size={16} /></Icon> FAI Pillars</div>
        <WafPills />
      </div>

      {/* Architecture Pattern */}
      {p.pattern && (
        <div className="section">
          <div className="section-title"><Icon><Cpu size={16} /></Icon> Architecture Pattern</div>
          <div className="card" style={{ padding: 14, borderLeft: "3px solid #6366f1" }}>
            <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>{p.pattern}</p>
          </div>
        </div>
      )}

      {/* DevKit */}
      {p.devkit && p.devkit.length > 0 ? (
        <div className="section">
          <div className="section-title"><Icon><Package size={16} /></Icon> DevKit — What Gets Scaffolded</div>
          <div className="card" style={{ padding: 14 }}>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 2 }}>
              {p.devkit.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>
      ) : (
        <div className="section">
          <div className="section-title"><Icon><Puzzle size={16} /></Icon> What's Inside Play {p.id}</div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 12, lineHeight: 1.6 }}>
              <code>agents/</code><span style={{ opacity: 0.8 }}>AI personas — @builder builds, @reviewer audits, @tuner optimizes</span>
              <code>instructions/</code><span style={{ opacity: 0.8 }}>Coding standards auto-applied to matching files via glob patterns</span>
              <code>skills/</code><span style={{ opacity: 0.8 }}>Reusable LEGO blocks for specific tasks (deploy, evaluate, scaffold)</span>
              <code>hooks/</code><span style={{ opacity: 0.8 }}>Policy gates — secrets scanning, PII redaction, cost limits, safety</span>
              <code>prompts/</code><span style={{ opacity: 0.8 }}>Slash commands — /deploy, /test, /review, /evaluate</span>
              <code>workflows/</code><span style={{ opacity: 0.8 }}>CI/CD GitHub Actions for automated testing and deployment</span>
              <code>copilot-instructions.md</code><span style={{ opacity: 0.8 }}>The knowledge hub — Copilot reads this for domain context</span>
              <code>fai-manifest.json</code><span style={{ opacity: 0.8 }}>The wiring spec — connects all primitives with shared context</span>
            </div>
          </div>
        </div>
      )}

      {/* TuneKit */}
      {p.tunekit && p.tunekit.length > 0 && (
        <div className="section">
          <div className="section-title"><Icon><Settings size={16} /></Icon> TuneKit — Configuration</div>
          <div className="card" style={{ padding: 14 }}>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 2 }}>
              {p.tunekit.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Tuning Parameters */}
      {p.tuningParams && p.tuningParams.length > 0 && (
        <div className="section">
          <div className="section-title"><Icon><Wrench size={16} /></Icon> Tuning Parameters</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {p.tuningParams.map((param, i) => (
              <span key={i} style={{ padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500, background: "var(--vscode-badge-background, #333)", color: "var(--vscode-badge-foreground, #ccc)" }}>
                {param}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Estimated Cost */}
      {p.costDev && (
        <div className="section">
          <div className="section-title"><Icon><DollarSign size={16} /></Icon> Estimated Monthly Cost</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="card" style={{ padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.5, fontWeight: 600, marginBottom: 6 }}>Dev / Test</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#10b981" }}>{p.costDev}</div>
            </div>
            <div className="card" style={{ padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.5, fontWeight: 600, marginBottom: 6 }}>Production</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>{p.costProd}</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Start Guide */}
      <div className="section">
        <div className="section-title"><Icon><BookOpen size={16} /></Icon> Quick Start Guide</div>
        <div className="card" style={{ padding: 16 }}>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 2.2 }}>
            <li><strong>Init DevKit</strong> — scaffolds the project with agents, config, infra, and fai-manifest.json</li>
            <li><strong>Open Copilot Chat</strong> — auto-reads agent.md and copilot-instructions.md (the hub)</li>
            <li>Use agents: <code>@agent</code> (auto-chains), <code>@builder</code> (build), <code>@reviewer</code> (audit), <code>@tuner</code> (optimize)</li>
            <li><strong>Run Evaluation</strong> — validate quality metrics (all must score ≥ 4.0)</li>
            <li>Use <strong>/deploy</strong> in Copilot Chat for guided Azure deployment via Bicep IaC</li>
          </ol>
        </div>
      </div>

      {/* Quick Actions — Categorized */}
      <div className="section">
        <div className="section-title"><Icon><Zap size={16} /></Icon> Quick Actions <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 400 }}>(click to execute)</span></div>

        <div style={{ marginBottom: 12, background: "rgba(59,130,246,0.05)", borderLeft: "3px solid #3b82f6", borderRadius: "0 6px 6px 0", padding: "10px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.5, marginBottom: 6 }}><Icon><Package size={12} /></Icon> Full Packages</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <ActionItem label="Initialize DevKit" desc="Complete package — .github Agentic OS (agents, instructions, skills, hooks, prompts, MCP), copilot-instructions.md, fai-manifest.json, and infra/main.bicep." onClick={() => cmd("initDevKit")} />
            <ActionItem label="Initialize TuneKit" desc="AI parameters — config/openai.json, guardrails.json, search.json, chunking.json, evaluation/eval.py, test-set.jsonl." onClick={() => cmd("initTuneKit")} />
            <ActionItem label="Initialize SpecKit" desc="Architecture spec — play-spec.json with alignment scores and evaluation thresholds." onClick={() => cmd("initSpecKit")} />
          </div>
        </div>

        <div style={{ marginBottom: 12, background: "rgba(107,114,128,0.05)", borderLeft: "3px solid #6b7280", borderRadius: "0 6px 6px 0", padding: "10px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.5, marginBottom: 6 }}><Icon><Wrench size={12} /></Icon> Standalone</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <ActionItem label="Initialize Hooks" desc="Download guardrails.json only — policy gates for secrets, PII, cost, safety." onClick={() => cmd("initHooks")} />
            <ActionItem label="Initialize Prompts" desc="Download 4 slash commands only — /deploy, /test, /review, /evaluate." onClick={() => cmd("initPrompts")} />
            <ActionItem label="Install as Plugin" desc="Pre-built bundle — creates agents, instructions, config, plugin.json in workspace." onClick={() => cmd("installPlugin")} />
          </div>
        </div>

        <div style={{ background: "rgba(16,185,129,0.05)", borderLeft: "3px solid #10b981", borderRadius: "0 6px 6px 0", padding: "10px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.5, marginBottom: 6 }}><Icon><BarChart3 size={12} /></Icon> Analyze & Evaluate</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <ActionItem label="Estimate Cost" desc={`Itemized monthly Azure cost breakdown for ${p.name} across dev, production, and enterprise tiers.`} onClick={() => cmd("cost")} />
            <ActionItem label="Run Evaluation" desc="Steps: 1) Init TuneKit to get eval.py + test-set.jsonl. 2) Edit test-set.jsonl with your Q&A pairs. 3) Run: python evaluation/eval.py. 4) Scores appear in dashboard (groundedness, relevance, coherence, fluency, safety — all must ≥ 4.0)." onClick={() => cmd("runEvaluation")} />
            <ActionItem label="Architecture Diagram" desc={`View the architecture diagram for ${p.name} — service roles, data flow, security.`} onClick={() => cmd("diagram")} />
          </div>
        </div>
      </div>

      {/* FAI Protocol */}
      <div className="section">
        <div className="section-title"><Icon><Layers size={16} /></Icon> FAI Protocol — How Wiring Works</div>
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 13, lineHeight: 1.8, margin: 0 }}>
            When you <strong>Init DevKit</strong>, a <code style={{ padding: "1px 6px", borderRadius: 3, margin: "0 3px", background: "var(--vscode-textCodeBlock-background, #2a2d2e)" }}>fai-manifest.json</code> is auto-generated. This manifest connects your agents, instructions, skills, hooks, and guardrails — so they all share the same context.
          </p>
          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Each primitive works standalone. Inside a play, fai-manifest.json auto-wires them together.</p>
        </div>
      </div>

      {/* Resources */}
      <div className="section">
        <div className="section-title"><Icon><Link2 size={16} /></Icon> Resources</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <LinkItem label="Full Play Documentation" url={`https://frootai.dev/solution-plays/${p.dir}`} onClick={openUrl} color="#3b82f6" />
          <LinkItem label="Step-by-Step User Guide" url={`https://frootai.dev/user-guide?play=${p.id}`} onClick={openUrl} color="#10b981" />
          <LinkItem label="View Source on GitHub" url={`https://github.com/frootai/frootai/tree/main/solution-plays/${p.dir}`} onClick={openUrl} color="#f97316" />
          <LinkItem label="FrootAI Website" url="https://frootai.dev" onClick={openUrl} color="#10b981" />
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, mono, color, dot }: { label: string; value: string; mono?: boolean; color?: string; dot?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {label && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.5, fontWeight: 600 }}>{label}:</span>}
      <span style={{ fontSize: 12, fontWeight: 500, fontFamily: mono ? "monospace" : "inherit", color: color || "inherit" }}>
        {dot && <span style={{ marginRight: 3 }}>●</span>}{value}
      </span>
    </div>
  );
}

function Pipe() { return <span style={{ opacity: 0.2, fontSize: 14, margin: "0 2px" }}>|</span>; }

function ActionItem({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: "flex", gap: 12, padding: "10px 14px", borderRadius: 6, cursor: "pointer", border: "1px solid var(--vscode-widget-border, #454545)", background: "var(--vscode-editor-inactiveSelectionBackground, #2a2d2e)", transition: "border-color 0.15s" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--vscode-focusBorder, #007fd4)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--vscode-widget-border, #454545)"; }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 3, lineHeight: 1.5 }}>{desc}</div>
      </div>
      <span style={{ alignSelf: "center" }}><ChevronRight size={14} opacity={0.3} /></span>
    </div>
  );
}

function LinkItem({ label, url, onClick, color }: { label: string; url: string; onClick: (url: string) => void; color?: string }) {
  return (
    <div onClick={() => onClick(url)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 4, cursor: "pointer", fontSize: 13, transition: "background 0.1s" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--vscode-list-hoverBackground, #2a2d2e)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      <ExternalLink size={12} color={color} /><span>{label}</span>
      <span style={{ opacity: 0.4, marginLeft: "auto", fontSize: 11 }}>↗</span>
    </div>
  );
}
