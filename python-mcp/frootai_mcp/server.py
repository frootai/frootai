"""FrootAI MCP Server — FastMCP Python Implementation v5.1.0

45 tools · 4 resources · 6 prompts · BM25 search · 100 solution plays
FAI Protocol engine · Scaffold · Marketplace · full MCP protocol

Compatible with Claude Desktop, VS Code Copilot, Cursor, Windsurf, any MCP client.
"""
import json
import logging
import math
import re
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

_logger = logging.getLogger("frootai-mcp")
_logger.setLevel(logging.INFO)

PLAYS = [
    {"id":"01","name":"Enterprise RAG Q&A","desc":"Production RAG — AI Search + OpenAI + Container Apps","cx":"Medium","infra":"AI Search · Azure OpenAI · Container Apps · Blob","tune":"temperature · top-k · chunk size · reranking"},
    {"id":"02","name":"AI Landing Zone","desc":"Foundation Azure infra — VNet, private endpoints, RBAC, GPU quotas","cx":"Foundation","infra":"VNet · Private Endpoints · RBAC · Managed Identity · Key Vault","tune":"Network config · SKUs · GPU quota · region"},
    {"id":"03","name":"Deterministic Agent","desc":"Reliable agent — temp=0, structured JSON, guardrails","cx":"Medium","infra":"Container Apps · Azure OpenAI · Content Safety","tune":"temperature=0 · JSON schema · seed · citations"},
    {"id":"04","name":"Call Center Voice AI","desc":"Voice customer service — Communication Services + AI Speech","cx":"High","infra":"Communication Services · AI Speech · Azure OpenAI","tune":"Speech config · grounding prompts"},
    {"id":"05","name":"IT Ticket Resolution","desc":"Auto-classify, route, resolve IT tickets","cx":"Medium","infra":"Logic Apps · Azure OpenAI · ServiceNow MCP","tune":"Classification prompts · routing rules"},
    {"id":"06","name":"Document Intelligence","desc":"Extract, classify, structure document data","cx":"Medium","infra":"Blob · Document Intelligence · Azure OpenAI","tune":"Extraction prompts · confidence thresholds"},
    {"id":"07","name":"Multi-Agent Service","desc":"Supervisor + specialist agents","cx":"High","infra":"Container Apps · Azure OpenAI · Cosmos DB · Dapr","tune":"Supervisor routing · handoff rules"},
    {"id":"08","name":"Copilot Studio Bot","desc":"Low-code enterprise bot","cx":"Low","infra":"Copilot Studio · Dataverse · SharePoint","tune":"Topic design · knowledge sources"},
    {"id":"09","name":"AI Search Portal","desc":"Enterprise search with semantic ranking","cx":"Medium","infra":"AI Search · App Service · Azure OpenAI","tune":"Hybrid weights · scoring profiles"},
    {"id":"10","name":"Content Moderation","desc":"AI Content Safety + filtering","cx":"Low","infra":"Content Safety · API Management · Functions","tune":"Severity levels · blocklists"},
    {"id":"11","name":"Landing Zone Advanced","desc":"Multi-region, policy-driven AI landing zone","cx":"High","infra":"Multi-region VNet · Azure Policy · RBAC","tune":"Governance · advanced RBAC"},
    {"id":"12","name":"Model Serving AKS","desc":"GPU model serving on Kubernetes","cx":"High","infra":"AKS · GPU Nodes · Container Registry","tune":"Model config · autoscaling"},
    {"id":"13","name":"Fine-Tuning Workflow","desc":"Custom model fine-tuning pipeline","cx":"High","infra":"OpenAI Fine-tuning · Blob Storage","tune":"Dataset prep · hyperparameters"},
    {"id":"14","name":"AI Gateway","desc":"API management + cost control for AI","cx":"Medium","infra":"API Management · Azure OpenAI · Functions","tune":"Rate limits · token budgets"},
    {"id":"15","name":"Multi-Modal DocProc","desc":"Vision + document processing","cx":"High","infra":"Document Intelligence · GPT-4o · Blob","tune":"Extraction config · confidence"},
    {"id":"16","name":"Copilot Teams Extension","desc":"Teams bot with AI capabilities","cx":"Medium","infra":"Teams · Bot Framework · Azure OpenAI","tune":"Adaptive cards · auth config"},
    {"id":"17","name":"AI Observability","desc":"Monitoring + tracing for AI workloads","cx":"Medium","infra":"App Insights · Log Analytics · Azure Monitor","tune":"Custom metrics · alert rules"},
    {"id":"18","name":"Prompt Management","desc":"Version-controlled prompt library","cx":"Low","infra":"Blob Storage · Container Apps · Cosmos DB","tune":"Prompt templates · A/B config"},
    {"id":"19","name":"Edge AI Phi-4","desc":"On-device AI with Phi models","cx":"High","infra":"ONNX Runtime · Phi-4-mini · Edge devices","tune":"Quantization · edge config"},
    {"id":"20","name":"Anomaly Detection","desc":"Real-time anomaly detection in streams","cx":"High","infra":"Event Hub · Stream Analytics · Azure OpenAI","tune":"Threshold config · detection windows"},
    {"id":"21","name":"Agentic RAG","desc":"Autonomous multi-step RAG with iterative retrieval","cx":"High","infra":"OpenAI · AI Search · Container Apps · Key Vault","tune":"retrieval strategy · source ranking · iteration depth"},
    {"id":"22","name":"Multi-Agent Swarm","desc":"Swarm-based multi-agent with dynamic delegation","cx":"Very High","infra":"OpenAI · Container Apps · Service Bus · Cosmos DB","tune":"team topology · delegation rules · max turns"},
    {"id":"23","name":"Browser Automation","desc":"AI-driven browser automation with vision models","cx":"High","infra":"OpenAI Vision · Container Apps · Playwright","tune":"domain allowlist · vision prompts · action timeout"},
    {"id":"24","name":"AI Code Review","desc":"Automated code review with LLM + CodeQL","cx":"Medium","infra":"OpenAI · GitHub Actions · CodeQL","tune":"severity thresholds · review depth · OWASP rules"},
    {"id":"25","name":"Conversation Memory","desc":"Tiered conversation memory across sessions","cx":"High","infra":"OpenAI · Cosmos DB · AI Search · Redis","tune":"memory tier TTLs · recall strategy · embedding config"},
    {"id":"26","name":"Semantic Search Engine","desc":"Enterprise semantic search with hybrid retrieval","cx":"Medium","infra":"AI Search · OpenAI · Blob Storage","tune":"hybrid weights · reranker · personalization"},
    {"id":"27","name":"AI Data Pipeline","desc":"LLM-powered data classification and enrichment","cx":"High","infra":"OpenAI mini · Data Factory · Cosmos DB · Event Hubs","tune":"classification prompts · PII rules · batch size"},
    {"id":"28","name":"Knowledge Graph RAG","desc":"Graph-enhanced RAG with knowledge graph traversal","cx":"High","infra":"OpenAI · Cosmos DB Gremlin · AI Search","tune":"graph depth · entity types · fusion ratio"},
    {"id":"29","name":"MCP Gateway","desc":"Centralized MCP tool gateway with API management","cx":"Medium","infra":"APIM · Container Apps · Monitor","tune":"rate limits · auth policies · tool registry"},
    {"id":"30","name":"AI Security Hardening","desc":"AI security with content safety and red teaming","cx":"High","infra":"Content Safety · OpenAI · Container Apps","tune":"severity thresholds · blocklists · red team scenarios"},
    {"id":"31","name":"Low-Code AI Builder","desc":"Visual AI pipeline builder with one-click deploy","cx":"Medium","infra":"OpenAI · Container Apps · Cosmos DB · Static Web Apps","tune":"pipeline templates · deployment targets"},
    {"id":"32","name":"AI-Powered Testing","desc":"AI test generation and mutation testing","cx":"Medium","infra":"OpenAI · GitHub Actions · Container Apps","tune":"coverage targets · mutation rules · framework configs"},
    {"id":"33","name":"Voice AI Agent","desc":"Conversational voice agent with real-time speech","cx":"High","infra":"AI Speech · OpenAI · Communication Services","tune":"voice models · intent thresholds · fallback chains"},
    {"id":"34","name":"Edge AI Deployment","desc":"Edge-optimized AI with quantization and cloud sync","cx":"High","infra":"IoT Hub · ONNX Runtime · Container Instances","tune":"quantization level · sync schedule · memory budget"},
    {"id":"35","name":"AI Compliance Engine","desc":"Automated compliance checking and audit trails","cx":"High","infra":"OpenAI · Azure Policy · Key Vault · Cosmos DB","tune":"compliance frameworks · audit schedules · risk thresholds"},
    {"id":"36","name":"Multimodal Agent","desc":"Agent handling text, image, and audio inputs","cx":"Medium","infra":"OpenAI Vision · AI Vision · Blob Storage","tune":"vision prompts · image resolution · routing"},
    {"id":"37","name":"AI-Powered DevOps","desc":"AIOps with incident detection and auto-remediation","cx":"Medium","infra":"OpenAI · Monitor · DevOps · GitHub Actions","tune":"severity rules · runbook config · scaling thresholds"},
    {"id":"38","name":"Document Understanding v2","desc":"Advanced document processing with custom schemas","cx":"High","infra":"Document Intelligence · OpenAI · Cosmos DB","tune":"extraction schemas · confidence thresholds · entity types"},
    {"id":"39","name":"AI Meeting Assistant","desc":"Meeting intelligence with transcription and actions","cx":"Medium","infra":"AI Speech · OpenAI · Graph · Container Apps","tune":"transcription config · action item rules · scheduling"},
    {"id":"40","name":"Copilot Studio Advanced","desc":"Advanced Copilot Studio with custom agents","cx":"High","infra":"Copilot Studio · OpenAI · Dataverse · Graph","tune":"agent config · permissions · scoping · multi-turn rules"},
    {"id":"41","name":"AI Red Teaming","desc":"Systematic AI red teaming and safety evaluation","cx":"High","infra":"AI Foundry · Content Safety · OpenAI","tune":"attack diversity · severity thresholds · jailbreak detection"},
    {"id":"42","name":"Computer Use Agent","desc":"Vision-based desktop automation agent","cx":"Very High","infra":"OpenAI Vision · Container Apps · Blob Storage","tune":"vision confidence · action retry · screenshot resolution"},
    {"id":"43","name":"AI Video Generation","desc":"AI video generation with safety and quality controls","cx":"Very High","infra":"OpenAI · Blob Storage · Content Safety · Service Bus","tune":"video quality · frame rate · content safety"},
    {"id":"44","name":"Foundry Local On-Device","desc":"On-device AI with Foundry Local and cloud escalation","cx":"High","infra":"OpenAI · IoT Hub · Monitor","tune":"local model threshold · cloud escalation · sync interval"},
    {"id":"45","name":"Real-Time Event AI","desc":"Real-time event processing with AI anomaly detection","cx":"Very High","infra":"Event Hubs · Functions · OpenAI · Cosmos DB · SignalR","tune":"latency SLA · window size · anomaly threshold"},
    {"id":"46","name":"Healthcare Clinical AI","desc":"Clinical decision support with human-in-the-loop","cx":"Very High","infra":"OpenAI · Health Data Services · AI Search · Content Safety","tune":"clinical confidence · PII redaction · human approval"},
    {"id":"47","name":"Synthetic Data Factory","desc":"Privacy-preserving synthetic data generation","cx":"High","infra":"OpenAI · ML · Blob Storage","tune":"privacy epsilon · statistical fidelity · bias threshold"},
    {"id":"48","name":"AI Model Governance","desc":"Model lifecycle governance with drift detection","cx":"High","infra":"ML · AI Foundry · DevOps · Cosmos DB · Policy","tune":"approval gates · drift detection · evaluation frequency"},
    {"id":"49","name":"Creative AI Studio","desc":"Creative content generation with brand voice","cx":"High","infra":"OpenAI · Blob Storage · Content Safety · Functions · CDN","tune":"brand voice · content safety · output quality"},
    {"id":"50","name":"Financial Risk Intelligence","desc":"Financial risk analysis with real-time monitoring","cx":"Very High","infra":"OpenAI · AI Search · Cosmos DB · Event Hubs","tune":"risk confidence · regulatory compliance · fraud sensitivity"},
    {"id":"51","name":"Autonomous Coding Agent","desc":"Self-directed coding agent with test validation","cx":"Very High","infra":"OpenAI · GitHub Actions · Container Apps","tune":"code gen temp · max iterations · test coverage"},
    {"id":"52","name":"AI API Gateway v2","desc":"Advanced AI gateway with semantic caching","cx":"High","infra":"APIM · OpenAI · Redis · Monitor","tune":"cache similarity · routing score · token budget"},
    {"id":"53","name":"Legal Document AI","desc":"Legal document analysis with risk assessment","cx":"Very High","infra":"OpenAI · AI Search · Blob Storage · Cosmos DB","tune":"clause confidence · risk threshold · privilege sensitivity"},
    {"id":"54","name":"AI Customer Support v2","desc":"Advanced AI support with sentiment and escalation","cx":"High","infra":"OpenAI · AI Search · Communication Services · Cosmos DB","tune":"sentiment threshold · auto-resolution · escalation priority"},
    {"id":"55","name":"Supply Chain AI","desc":"Supply chain optimization with demand forecasting","cx":"Very High","infra":"OpenAI · Cosmos DB · Event Hubs · ML","tune":"forecast horizon · safety stock · supplier risk"},
    {"id":"56","name":"Semantic Code Search","desc":"Codebase semantic search with embedding retrieval","cx":"Medium","infra":"OpenAI · AI Search · Blob Storage","tune":"chunk size · relevance threshold · refresh interval"},
    {"id":"57","name":"AI Translation Engine","desc":"Neural translation with glossary and cultural adaptation","cx":"High","infra":"OpenAI · AI Translator · Cosmos DB · CDN","tune":"quality threshold · glossary priority · cultural adaptation"},
    {"id":"58","name":"Digital Twin Agent","desc":"Digital twin with IoT and predictive simulation","cx":"Very High","infra":"IoT Hub · Digital Twins · OpenAI · Functions","tune":"anomaly sensitivity · prediction horizon · simulation fidelity"},
    {"id":"59","name":"AI Recruiter Agent","desc":"AI recruitment with matching and bias detection","cx":"High","infra":"OpenAI · AI Search · Cosmos DB · Graph","tune":"match threshold · bias sensitivity · skills weight"},
    {"id":"60","name":"Responsible AI Dashboard","desc":"Responsible AI monitoring with fairness metrics","cx":"High","infra":"OpenAI · ML · Monitor · Cosmos DB · Static Web Apps","tune":"fairness threshold · bias granularity · report frequency"},
    {"id":"61","name":"Content Moderation v2","desc":"Advanced content moderation with severity routing","cx":"High","infra":"Content Safety · OpenAI · Cosmos DB · Service Bus","tune":"safety threshold · severity routing · category weights"},
    {"id":"62","name":"Federated Learning Pipeline","desc":"Privacy-preserving federated learning","cx":"Very High","infra":"ML · Confidential Computing · Blob Storage","tune":"privacy epsilon · aggregation rounds · convergence threshold"},
    {"id":"63","name":"Fraud Detection Agent","desc":"Real-time fraud detection with streaming analysis","cx":"High","infra":"OpenAI · Event Hubs · Stream Analytics · Cosmos DB","tune":"risk score · velocity window · anomaly sensitivity"},
    {"id":"64","name":"AI Sales Assistant","desc":"AI sales copilot with lead scoring and outreach","cx":"Medium","infra":"OpenAI · Cosmos DB · Graph · AI Search","tune":"lead score · persona temp · email tone · forecast confidence"},
    {"id":"65","name":"AI Training Curriculum","desc":"Adaptive AI training with difficulty scaling","cx":"Medium","infra":"OpenAI · Cosmos DB · Static Web Apps","tune":"difficulty scaling · assessment threshold · feedback detail"},
    {"id":"66","name":"AI Infrastructure Optimizer","desc":"AI-driven infra optimization and cost analysis","cx":"High","infra":"OpenAI · Monitor · Advisor · Cost Management","tune":"savings threshold · utilization floor · scaling aggressiveness"},
    {"id":"67","name":"AI Knowledge Management","desc":"Enterprise knowledge management with contextual retrieval","cx":"High","infra":"OpenAI · AI Search · Cosmos DB · Graph","tune":"freshness decay · chunk overlap · expert threshold"},
    {"id":"68","name":"Predictive Maintenance AI","desc":"Predictive maintenance with IoT sensor analysis","cx":"High","infra":"IoT Hub · OpenAI · ML · Stream Analytics · Cosmos DB","tune":"failure probability · sensor window · RUL confidence"},
    {"id":"69","name":"Carbon Footprint Tracker","desc":"Real-time carbon accounting across cloud and supply chain","cx":"High","infra":"Azure Monitor · OpenAI · Cosmos DB · Event Hubs","tune":"emission factors · scope boundaries · reporting framework"},
    {"id":"70","name":"ESG Compliance Agent","desc":"ESG reporting with GRI, SASB, TCFD, CSRD compliance","cx":"High","infra":"OpenAI · Document Intelligence · Cosmos DB · AI Search","tune":"regulatory frameworks · materiality matrix · disclosure rules"},
    {"id":"71","name":"Smart Energy Grid AI","desc":"Energy demand prediction and grid balancing via digital twin","cx":"Very High","infra":"IoT Hub · OpenAI · Stream Analytics · Digital Twins","tune":"demand horizon · renewable mix · battery schedule"},
    {"id":"72","name":"Climate Risk Assessor","desc":"Climate scenario modeling for financial risk assessment","cx":"High","infra":"OpenAI · ML · Cosmos DB · AI Search","tune":"climate scenarios · time horizons · risk tolerance"},
    {"id":"73","name":"Waste & Recycling Optimizer","desc":"Waste classification, route optimization, contamination detection","cx":"Medium","infra":"AI Vision · OpenAI · IoT Hub · Container Apps","tune":"material categories · classification confidence · vehicle capacity"},{"id":"74","name":"AI Tutoring Agent","desc":"1-on-1 personalized tutoring with Socratic method and adaptive difficulty","cx":"High","infra":"Azure OpenAI · Cosmos DB · AI Search · Static Web Apps","tune":"difficulty scaling · knowledge gaps · progress tracking"},{"id":"75","name":"Exam Generation Engine","desc":"Auto-generate exams with difficulty calibration, rubrics, and answer keys","cx":"Medium","infra":"Azure OpenAI · Blob Storage · Cosmos DB · Functions","tune":"difficulty level · question variation · rubric detail"},{"id":"76","name":"Accessibility Learning Agent","desc":"Screen reader-first, dyslexia-aware learning with multi-modal adaptation","cx":"High","infra":"AI Speech · Azure OpenAI · AI Vision · Container Apps · Cosmos DB","tune":"accessibility profiles · content adaptation · speech rate"},{"id":"77","name":"Research Paper AI","desc":"Literature review, citation network, methodology critique, research gap analysis","cx":"Very High","infra":"Azure OpenAI · AI Search · Cosmos DB · Graph · Functions","tune":"citation depth · methodology rules · gap sensitivity"},{"id":"78","name":"Precision Agriculture Agent","desc":"Satellite imagery + IoT sensor fusion for crop health, irrigation, fertilization, yield prediction","cx":"Very High","infra":"Azure IoT Hub · AI Vision · Azure OpenAI · Digital Twins · ML","tune":"sensor sampling · imagery frequency · irrigation thresholds"},{"id":"79","name":"Food Safety Inspector AI","desc":"HACCP compliance, contamination detection, farm-to-fork traceability, pathogen risk scoring","cx":"High","infra":"Document Intelligence · Azure OpenAI · Cosmos DB · Event Hubs · IoT Hub","tune":"temperature alerts · pathogen models · audit retention"},{"id":"80","name":"Biodiversity Monitor","desc":"Species identification from camera trap, drone, acoustic data with conservation alerts","cx":"High","infra":"AI Vision · Azure OpenAI · IoT Hub · Cosmos DB · Functions","tune":"species confidence · camera schedule · acoustic frequency"},
    {"id":"81","name":"Property Valuation AI","desc":"Automated property appraisal with comparable sales, market trends, neighborhood scoring, satellite imagery","cx":"High","infra":"Azure OpenAI · AI Search · Cosmos DB · Machine Learning · Functions","tune":"comparable radius · market trend window · neighborhood scores"},{"id":"82","name":"Construction Safety AI","desc":"Real-time site monitoring — PPE compliance, hazard detection, unauthorized zone alerts, incident reporting","cx":"High","infra":"AI Vision · IoT Hub · Azure OpenAI · Container Apps · Cosmos DB","tune":"PPE confidence · hazard zones · alert escalation"},{"id":"83","name":"Building Energy Optimizer","desc":"HVAC, lighting, occupancy optimization via digital twin — 20-40% energy reduction","cx":"Very High","infra":"Digital Twins · IoT Hub · Azure OpenAI · Functions · Cosmos DB","tune":"HVAC schedule · occupancy model · comfort vs efficiency"},
    {"id":"84","name":"Citizen Services Chatbot","desc":"Multi-language municipal AI assistant — form filling, appointments, permits, FAQ, escalation","cx":"Medium","infra":"Azure OpenAI · AI Translator · Communication Services · AI Search · Cosmos DB","tune":"supported languages · escalation threshold · service catalog scope"},
    {"id":"85","name":"Policy Impact Analyzer","desc":"Regulatory change detection with cross-sector impact, stakeholder mapping, briefing generation","cx":"High","infra":"Azure OpenAI · AI Search · Document Intelligence · Cosmos DB · Functions","tune":"regulatory feeds · impact depth · stakeholder categories"},
    {"id":"86","name":"Public Safety Analytics","desc":"Crime pattern prediction, resource allocation, community sentiment, incident dashboard","cx":"Very High","infra":"Azure OpenAI · Machine Learning · Event Hubs · Cosmos DB · Stream Analytics","tune":"prediction window · allocation zones · sentiment feeds"},
    {"id":"87","name":"Dynamic Pricing Engine","desc":"Real-time price optimization with demand signals, competitor pricing, and fairness guardrails","cx":"High","infra":"Azure OpenAI · Event Hubs · Cosmos DB · Redis Cache · Machine Learning","tune":"price elasticity · competitor frequency · fairness guardrails"},
    {"id":"88","name":"Visual Product Search","desc":"Image-based product discovery with visual similarity, style recommendations, virtual try-on","cx":"High","infra":"AI Vision · Azure OpenAI · AI Search · Container Apps · Cosmos DB","tune":"similarity threshold · catalog refresh · try-on quality"},
    {"id":"89","name":"Retail Inventory Predictor","desc":"Demand forecasting with weather, social trends, economic indicators, automated reordering","cx":"High","infra":"Azure OpenAI · Machine Learning · Cosmos DB · Event Hubs · Functions","tune":"forecast horizon · safety stock · reorder formula"},
    {"id":"90","name":"Network Optimization Agent","desc":"5G/LTE network capacity planning with anomaly detection, self-healing, traffic prediction, and digital twin simulation","cx":"Very High","infra":"Azure IoT Hub · Stream Analytics · OpenAI · Digital Twins · Cosmos DB","tune":"traffic prediction horizon · anomaly sensitivity · self-healing triggers"},
    {"id":"91","name":"Customer Churn Predictor","desc":"Multi-signal churn scoring with usage patterns, billing, support, network quality, and retention campaigns","cx":"High","infra":"Azure OpenAI · Machine Learning · Cosmos DB · Communication Services · Functions","tune":"churn risk threshold · retention budget · signal decay weights"},
    {"id":"92","name":"Telecom Fraud Shield","desc":"Real-time telecom fraud detection for SIM swap, revenue share fraud, Wangiri, toll fraud with sub-second blocking","cx":"High","infra":"Azure Event Hubs · Stream Analytics · OpenAI · Cosmos DB · Functions","tune":"SIM swap detection window · fraud score threshold · velocity limits"},
    {"id":"93","name":"Continual Learning Agent","desc":"Agent that persists knowledge across sessions, reflects on failures, and starts smarter every time","cx":"Very High","infra":"Azure OpenAI · Cosmos DB · AI Search · Redis Cache · Functions","tune":"Memory retention policy · reflection triggers · distillation frequency"},
    {"id":"94","name":"AI Podcast Generator","desc":"Text-to-podcast with multi-speaker voice synthesis, music transitions, chapter markers, and content safety","cx":"High","infra":"Azure AI Speech · OpenAI · Blob Storage · CDN · Functions","tune":"Voice persona · speaking rate · music transition style"},
    {"id":"95","name":"Multimodal Search Engine v2","desc":"Unified search across images, text, code, and audio with cross-modal reasoning and GPT-4o synthesis","cx":"Very High","infra":"Azure AI Search · AI Vision · AI Speech · OpenAI · Container Apps","tune":"Cross-modal fusion weights · index config · result diversity"},
    {"id":"96","name":"Real-Time Voice Agent v2","desc":"Next-gen bidirectional voice agent with sub-200ms latency, MCP tools, avatar rendering, and transcription","cx":"Very High","infra":"Azure AI Voice Live · OpenAI · Container Apps · Functions · Cosmos DB","tune":"VAD mode · latency target · function calling timeout"},
    {"id":"97","name":"AI Data Marketplace","desc":"Platform for publishing, discovering, and monetizing synthetic and anonymized datasets with differential privacy","cx":"High","infra":"Azure Machine Learning · Blob Storage · API Management · Cosmos DB · Functions","tune":"Privacy epsilon budget · pricing model · data quality thresholds"},
    {"id":"98","name":"Agent Evaluation Platform","desc":"Automated evaluation suite with benchmarks, A/B testing, human scoring, and leaderboard ranking","cx":"High","infra":"Azure OpenAI · Container Apps · Cosmos DB · Machine Learning · Functions","tune":"Benchmark suite · regression threshold · A/B traffic split"},
    {"id":"99","name":"Enterprise AI Governance Hub","desc":"Central control plane for AI models, agents, APIs — approval gates, policy, compliance tracking","cx":"Very High","infra":"Azure API Management · Policy · Monitor · Cosmos DB · ML · Key Vault","tune":"Approval thresholds · policy rules · compliance frameworks"},
    {"id":"100","name":"FAI Meta-Agent","desc":"The crown jewel — self-orchestrating super-agent that selects plays, provisions infra, and delivers production AI","cx":"Very High","infra":"Azure OpenAI · MCP Server · Container Apps · Cosmos DB · AI Search · Key Vault","tune":"Play selection strategy · chain depth · budget per orchestration"},
]

COST_DATA = {
    "dev": {"azure-openai": 15, "ai-search": 50, "container-apps": 30, "key-vault": 1, "blob-storage": 2, "app-insights": 5},
    "prod": {"azure-openai": 150, "ai-search": 250, "container-apps": 200, "key-vault": 3, "blob-storage": 20, "app-insights": 30},
}

# ─── Server Instance ───
mcp = FastMCP(
    "frootai",
    instructions="FrootAI — AI architecture knowledge engine. 45 tools across 8 categories: Knowledge (6), Plays (5), Agent Chain (3), Azure/Live (4), Ecosystem (5), FAI Engine (5), Marketplace (4), Scaffold (5). Plus extra tools (8), 4 resources, and 6 prompts. 100 solution plays, 860+ primitives, BM25 search, FAI Protocol.",
)

# ─── Data Loading ───
_DATA_DIR = Path(__file__).parent
_knowledge = None
_glossary_cache = None
_search_index = None


def _load_knowledge():
    global _knowledge
    if _knowledge is None:
        p = _DATA_DIR / "knowledge.json"
        if not p.exists():
            raise FileNotFoundError(f"knowledge.json not found at {p}")
        with open(p, "r", encoding="utf-8") as f:
            _knowledge = json.load(f)
    return _knowledge


def _get_modules():
    return _load_knowledge().get("modules", {})


def _get_layers():
    return _load_knowledge().get("layers", {})


def _build_glossary():
    global _glossary_cache
    if _glossary_cache is not None:
        return _glossary_cache
    g = {}
    for m in _get_modules().values():
        for match in re.finditer(r'\*\*([^*]{2,60})\*\*\s*[—:–]\s*([^\n]{10,})', m.get("content", "")):
            g[match.group(1).strip().lower()] = {"term": match.group(1).strip(), "definition": match.group(2).strip()}
    _glossary_cache = g
    return g


def _load_search_index():
    global _search_index
    if _search_index is not None:
        return _search_index
    p = _DATA_DIR / "search-index.json"
    if p.exists():
        with open(p, "r", encoding="utf-8") as f:
            _search_index = json.load(f)
    else:
        _search_index = {"docs": [], "idf": {}, "params": {"k1": 1.5, "b": 0.75, "avgDocLen": 274}}
    return _search_index


# ─── BM25 Search Engine ───
def _bm25_search(query: str, top_k: int = 10) -> list[dict]:
    """BM25 search over pre-built index. Robertson IDF, k1=1.5, b=0.75.

    Index format: docs[]{id, title, len, tf:{term:freq}, meta}, idf:{term:score}, params:{k1,b,avgDocLen}
    """
    idx = _load_search_index()
    docs = idx.get("docs", [])
    idf_table = idx.get("idf", {})
    params = idx.get("params", {})
    if not docs or not idf_table:
        return _fallback_search(query)

    k1 = params.get("k1", 1.5)
    b = params.get("b", 0.75)
    avg_dl = params.get("avgDocLen", 274)
    query_terms = [t.lower() for t in re.split(r'\W+', query) if len(t) > 1]

    scores: dict[int, float] = {}
    for i, doc in enumerate(docs):
        tf_map = doc.get("tf", {})
        dl = doc.get("len", 100)
        doc_score = 0.0
        for qt in query_terms:
            tf = tf_map.get(qt, 0)
            if tf == 0:
                continue
            idf = idf_table.get(qt, 0)
            if idf == 0:
                continue
            tf_norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avg_dl))
            doc_score += idf * tf_norm
        if doc_score > 0:
            scores[i] = doc_score

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
    results = []
    for doc_idx, score in ranked:
        doc = docs[doc_idx]
        meta = doc.get("meta", {})
        results.append({
            "title": doc.get("title", ""),
            "source": doc.get("id", ""),
            "type": meta.get("type", ""),
            "score": round(score, 3),
        })
    return results


def _fallback_search(query: str) -> list[dict]:
    """Fallback keyword search when BM25 index not available."""
    q = query.lower().strip()
    results = []
    for k, m in _get_modules().items():
        c = m.get("content", "")
        cl = c.lower()
        if q in cl:
            idx = cl.index(q)
            s, e = max(0, idx - 200), min(len(c), idx + len(q) + 300)
            results.append({"module": k, "title": m["title"], "excerpt": f"...{c[s:e].strip()}...", "hits": cl.count(q)})
    results.sort(key=lambda x: x["hits"], reverse=True)
    return results[:10]


# ═══════════════════════════════════════════════════════════════════════════════
# Category 1: Knowledge Tools (6)
# ═══════════════════════════════════════════════════════════════════════════════

@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def list_modules() -> str:
    """List all FROOT knowledge modules organized by layer."""
    modules = _get_modules()
    layers = _get_layers()
    mods = [{"id": k, "title": v["title"], "layer": v.get("layer", ""), "emoji": v.get("emoji", ""), "chars": len(v.get("content", ""))} for k, v in modules.items()]
    return json.dumps({
        "count": len(mods),
        "modules": mods,
        "layers": {k: (v.get("name", k) if isinstance(v, dict) else v) for k, v in layers.items()},
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def get_module(module_id: str) -> str:
    """Get a specific FROOT knowledge module by ID (F1, F2, F3, R1, R2, R3, O1-O6, T1-T3)."""
    modules = _get_modules()
    mid = module_id.upper().strip()
    if mid in modules:
        m = modules[mid]
        return json.dumps({"id": m["id"], "title": m["title"], "layer": m.get("layer", ""), "content": m["content"][:8000], "total_chars": len(m["content"])}, indent=2)
    q = module_id.lower()
    for k, m in modules.items():
        if q in m.get("title", "").lower() or q in k.lower():
            return json.dumps({"id": m["id"], "title": m["title"], "layer": m.get("layer", ""), "content": m["content"][:8000], "total_chars": len(m["content"])}, indent=2)
    return json.dumps({"error": f"Module '{mid}' not found", "available": [{"id": k, "title": v["title"]} for k, v in modules.items()]}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def search_knowledge(query: str, max_results: int = 10) -> str:
    """BM25 full-text search across all FROOT knowledge modules."""
    if not query.strip():
        return json.dumps({"error": "Query required"})
    results = _bm25_search(query, top_k=max_results)
    _logger.info("search_knowledge query=%s results=%d", query, len(results))
    return json.dumps({"query": query, "results": results, "total": len(results), "engine": "BM25"}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def lookup_term(term: str) -> str:
    """Look up an AI/ML term from the 200+ term glossary extracted from FROOT modules."""
    t = term.lower().strip()
    g = _build_glossary()
    if t in g:
        return json.dumps(g[t], indent=2)
    matches = [v for k, v in g.items() if t in k or k in t]
    if matches:
        return json.dumps({"matches": matches[:5]}, indent=2)
    for k, m in _get_modules().items():
        c = m.get("content", "")
        if t in c.lower():
            idx = c.lower().index(t)
            return json.dumps({"term": t, "found_in": m["title"], "context": c[max(0, idx - 100):min(len(c), idx + 300)].strip()}, indent=2)
    return json.dumps({"error": f"Term '{t}' not found"}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def get_froot_overview() -> str:
    """FrootAI platform overview with framework stats and capabilities."""
    modules = _get_modules()
    return json.dumps({
        "name": "FrootAI",
        "version": "5.1.0",
        "tagline": "From the Roots to the Fruits. It's simply Frootful.",
        "framework": "FROOT = Foundations · Reasoning · Orchestration · Operations · Transformation",
        "stats": {"tools": 45, "modules": len(modules), "plays": 100, "terms": len(_build_glossary()), "primitives": "860+"},
        "channels": ["npm", "pip", "VS Code", "Docker", "CLI"],
        "website": "https://frootai.dev",
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def get_architecture_pattern(scenario: str) -> str:
    """Get architecture guidance for a scenario: rag_pipeline, agent_hosting, model_selection, cost_optimization, etc."""
    sc = scenario.lower()
    ps = [{"play": f"{p['id']}—{p['name']}", "desc": p["desc"], "infra": p["infra"]} for p in PLAYS if any(w in (p["desc"] + p["name"]).lower() for w in sc.split() if len(w) > 2)]
    modules = _get_modules()
    km = [{"module": k, "title": m["title"]} for k, m in modules.items() if sc.split()[0] in m.get("content", "").lower()] if sc.split() else []
    return json.dumps({"scenario": sc, "matching_plays": ps[:5], "relevant_modules": km[:3]}, indent=2)


# ═══════════════════════════════════════════════════════════════════════════════
# Category 2: Solution Play Tools (5)
# ═══════════════════════════════════════════════════════════════════════════════

@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def list_solution_plays(filter: str = "") -> str:
    """List all 100 solution plays, optionally filtered by keyword."""
    if filter:
        q = filter.lower()
        filtered = [p for p in PLAYS if q in (p["name"] + p["desc"] + p["infra"]).lower()]
        return json.dumps({"count": len(filtered), "filter": filter, "plays": filtered}, indent=2)
    return json.dumps({"count": len(PLAYS), "plays": PLAYS}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def get_play_detail(play_id: str) -> str:
    """Get detailed info for a specific solution play by ID or name."""
    pid = play_id.strip()
    for p in PLAYS:
        if p["id"] == pid.zfill(2) or pid.lower() in p["name"].lower():
            return json.dumps(p, indent=2)
    return json.dumps({"error": f"Play '{pid}' not found"}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def semantic_search_plays(query: str, top_k: int = 5) -> str:
    """BM25-powered search across solution plays by description."""
    results = _bm25_search(query, top_k=top_k)
    if results:
        return json.dumps({"query": query, "matches": results, "engine": "BM25"}, indent=2)
    # Fallback to keyword matching on PLAYS
    q = query.lower()
    scored = []
    for p in PLAYS:
        s = sum(1 for w in q.split() if len(w) > 2 and w in (p["name"] + p["desc"] + p["infra"]).lower())
        if s > 0:
            scored.append({**p, "score": s})
    scored.sort(key=lambda x: x["score"], reverse=True)
    return json.dumps({"query": q, "matches": scored[:top_k], "engine": "keyword-fallback"}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def compare_plays(play1: str, play2: str) -> str:
    """Compare two solution plays side by side."""
    p1id = play1.strip().zfill(2)
    p2id = play2.strip().zfill(2)
    d1 = next((x for x in PLAYS if x["id"] == p1id), PLAYS[0])
    d2 = next((x for x in PLAYS if x["id"] == p2id), PLAYS[1])
    return json.dumps({
        "play1": {"id": d1["id"], "name": d1["name"], "complexity": d1["cx"], "infra": d1["infra"]},
        "play2": {"id": d2["id"], "name": d2["name"], "complexity": d2["cx"], "infra": d2["infra"]},
        "differences": {
            "complexity": f"{d1['cx']} vs {d2['cx']}",
            "infra_overlap": [s for s in d1["infra"].split(" · ") if s in d2["infra"]],
        },
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def generate_architecture_diagram(play: str) -> str:
    """Generate a Mermaid.js architecture diagram for a solution play."""
    pid = play.strip().zfill(2)
    p = next((x for x in PLAYS if x["id"] == pid), PLAYS[0])
    services = [s.strip() for s in p["infra"].split("·")]
    nodes = "\n".join(f"    {s.replace(' ', '_')}[{s}]" for s in services)
    links = "\n".join(f"    {services[i].replace(' ', '_')} --> {services[i + 1].replace(' ', '_')}" for i in range(len(services) - 1))
    mermaid = f"graph LR\n{nodes}\n{links}"
    return json.dumps({"play": p["name"], "diagram_type": "mermaid", "mermaid": mermaid, "tip": "Paste into any Mermaid renderer to visualize."}, indent=2)


# ═══════════════════════════════════════════════════════════════════════════════
# Category 3: Agent Chain Tools (3)
# ═══════════════════════════════════════════════════════════════════════════════

@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def agent_build(scenario: str) -> str:
    """Builder agent — get build guidance for an AI solution. Finds the best play and provides implementation steps."""
    q = scenario.lower()
    scored = []
    for p in PLAYS:
        s = sum(1 for w in q.split() if len(w) > 2 and w in (p["name"] + p["desc"] + p["infra"]).lower())
        if s > 0:
            scored.append({**p, "score": s})
    scored.sort(key=lambda x: x["score"], reverse=True)
    bp = scored[0] if scored else PLAYS[0]
    return json.dumps({
        "scenario": scenario,
        "recommended": f"{bp['id']}—{bp['name']}",
        "steps": [
            "1. npx frootai scaffold <play>",
            "2. code . (MCP auto-connects)",
            "3. @builder in Copilot Chat",
            "4. npx frootai validate --waf",
        ],
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def agent_review(config: str) -> str:
    """Reviewer agent — review AI config/code for safety, grounding, guardrails, and evaluation readiness."""
    c = config.lower()
    checks = {
        "instructions": "instruction" in c or "you are" in c,
        "guardrails": any(w in c for w in ["guardrail", "safety", "block"]),
        "grounding": any(w in c for w in ["ground", "cite", "source"]),
        "evaluation": any(w in c for w in ["eval", "test", "threshold"]),
    }
    return json.dumps({"checks": checks, "passed": f"{sum(checks.values())}/{len(checks)}"}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def agent_tune(config: str = "") -> str:
    """Tuner agent — get tuning recommendations for production readiness."""
    return json.dumps({
        "recommendations": [
            "temperature=0.1 for production",
            "grounding_check=true",
            "Set max_tokens budget",
            "blocked_categories for safety",
            "semantic reranker with top_k=5",
            "Run evaluation before shipping",
        ],
    }, indent=2)


# ═══════════════════════════════════════════════════════════════════════════════
# Category 4: Azure / Live Tools (4)
# ═══════════════════════════════════════════════════════════════════════════════

@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
async def get_model_catalog(category: str = "all") -> str:
    """AI model catalog with pricing tiers and recommended use cases."""
    models = [
        {"name": "GPT-4o", "best_for": "Complex reasoning, multimodal", "cost": "$$$$", "context": "128K"},
        {"name": "GPT-4o-mini", "best_for": "Fast + cheap, high volume", "cost": "$$", "context": "128K"},
        {"name": "GPT-4.1", "best_for": "Coding, instruction following", "cost": "$$$", "context": "1M"},
        {"name": "o3-mini", "best_for": "Deep reasoning, math, code", "cost": "$$$", "context": "200K"},
        {"name": "Phi-4", "best_for": "Edge/on-device, low latency", "cost": "$", "context": "16K"},
        {"name": "text-embedding-3-large", "best_for": "Embeddings, semantic search", "cost": "$", "context": "8K"},
    ]
    if category != "all":
        cat = category.lower()
        models = [m for m in models if cat in m["name"].lower() or cat in m["best_for"].lower()]
    return json.dumps({"models": models}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
async def get_azure_pricing(service: str) -> str:
    """Azure AI service pricing information."""
    s = service.lower()
    pricing = {
        "openai": {"gpt-4o-mini": "$0.15/1M in, $0.60/1M out", "gpt-4o": "$2.50/1M in, $10/1M out"},
        "ai-search": {"basic": "$69/mo", "standard": "$249/mo", "free": "$0"},
        "container-apps": {"consumption": "$0.000024/vCPU-sec"},
        "key-vault": {"standard": "$0.03/10K operations"},
        "cosmos-db": {"serverless": "$0.25/RU", "provisioned": "400 RU/s free"},
    }
    for k, v in pricing.items():
        if k in s or s in k:
            return json.dumps({"service": k, "pricing": v}, indent=2)
    return json.dumps({"services": list(pricing.keys()), "tip": "Specify a service name"}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
async def compare_models(task: str) -> str:
    """Side-by-side model comparison for a specific task."""
    return json.dumps({
        "task": task,
        "comparison": [
            {"model": "GPT-4o", "quality": 9.5, "speed": 7, "cost": 3, "best_for": "Complex reasoning"},
            {"model": "GPT-4o-mini", "quality": 8, "speed": 9, "cost": 8, "best_for": "High volume"},
            {"model": "Phi-4", "quality": 7, "speed": 10, "cost": 10, "best_for": "Edge/local"},
        ],
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "openWorldHint": True})
async def estimate_cost(play: str, scale: str = "dev") -> str:
    """Estimate monthly Azure costs for a solution play at dev or prod scale."""
    costs = COST_DATA.get(scale, COST_DATA["dev"])
    return json.dumps({
        "play": play,
        "scale": scale,
        "monthly_usd": costs,
        "total": sum(costs.values()),
        "note": "Estimates based on Azure retail pricing.",
    }, indent=2)


# ═══════════════════════════════════════════════════════════════════════════════
# Category 5: Ecosystem Tools (5)
# ═══════════════════════════════════════════════════════════════════════════════

@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def get_github_agentic_os(primitive: str = "overview") -> str:
    """Get guidance on .github Agentic OS — the 7 primitives across 4 layers."""
    return json.dumps({
        "name": ".github Agentic OS",
        "primitive": primitive,
        "files": 19,
        "layers": {
            "1": "Instructions (always-on context)",
            "2": "Agents & Skills (specialized roles)",
            "3": "Hooks & Workflows (automation)",
            "4": "Plugin Packaging (distribution)",
        },
        "init": "npx frootai init",
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def list_community_plays() -> str:
    """List community plugins and marketplace entries."""
    return json.dumps({
        "plays": [
            {"name": "servicenow-ai-agent", "desc": "ServiceNow ITSM AI agent"},
            {"name": "salesforce-ai-copilot", "desc": "Salesforce CRM AI copilot"},
            {"name": "sap-ai-gateway", "desc": "SAP S/4HANA AI gateway"},
        ],
        "marketplace": "https://frootai.dev/marketplace",
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def fetch_azure_docs(topic: str) -> str:
    """Get Azure documentation links and summaries for a topic."""
    return json.dumps({
        "topic": topic,
        "url": f"https://learn.microsoft.com/azure/?q={topic.replace(' ', '+')}",
        "tip": "Use search_knowledge for curated FrootAI content.",
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def fetch_external_mcp(query: str) -> str:
    """Find external MCP servers from public registries."""
    return json.dumps({
        "query": query,
        "registries": ["https://mcp.so", "https://glama.ai/mcp/servers"],
        "tip": "FrootAI itself is an MCP server: npx frootai-mcp or pip install frootai-mcp",
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": True, "destructiveHint": False})
async def get_play_spec(play_id: str) -> str:
    """Get SpecKit for a play — WAF alignment, pattern, infra, and compliance info."""
    pid = play_id.strip().zfill(2)
    p = next((x for x in PLAYS if x["id"] == pid), PLAYS[0])
    return json.dumps({
        "play": p["name"],
        "spec": {
            "pattern": p["desc"],
            "complexity": p["cx"],
            "infra": p["infra"],
            "waf": {
                "reliability": "retry + health checks + circuit breaker",
                "security": "managed identity + private endpoints + RBAC",
                "cost": "right-sized SKUs + token budgets",
                "operations": "CI/CD + diagnostics + structured logging",
                "performance": "caching + streaming + async",
                "responsible_ai": "content safety + groundedness + guardrails",
            },
        },
    }, indent=2)


# ═══════════════════════════════════════════════════════════════════════════════
# Category 6: FAI Engine Tools (5)
# ═══════════════════════════════════════════════════════════════════════════════

@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": False})
async def wire_play(play_id: str, output_dir: str = ".") -> str:
    """Wire a solution play — generates fai-manifest.json with context, primitives, and guardrails."""
    pid = play_id.strip().zfill(2)
    play = next((p for p in PLAYS if p["id"] == pid), None)
    if not play:
        return json.dumps({"error": f"Play '{play_id}' not found"})

    manifest = {
        "play": f"{pid}-{play['name'].lower().replace(' ', '-')}",
        "version": "1.0.0",
        "context": {
            "knowledge": ["../../config/knowledge.json"],
            "waf": ["reliability", "security", "cost-optimization", "operational-excellence", "performance-efficiency", "responsible-ai"],
        },
        "primitives": {
            "agents": ["./.github/agents/builder.agent.md", "./.github/agents/reviewer.agent.md", "./.github/agents/tuner.agent.md"],
            "instructions": ["./.github/copilot-instructions.md"],
            "skills": [],
            "hooks": [],
            "workflows": [],
        },
        "infrastructure": {
            "services": [s.strip() for s in play["infra"].split("·")],
            "complexity": play["cx"],
        },
        "guardrails": {
            "groundedness": 0.8,
            "relevance": 0.8,
            "coherence": 0.85,
            "fluency": 0.9,
            "safety": 0.95,
        },
        "tuning": {
            "parameters": [t.strip() for t in play["tune"].split("·")],
        },
    }

    _logger.info("wire_play play=%s status=wired", play_id)
    return json.dumps({"play": play["name"], "manifest": manifest, "output": f"{output_dir}/fai-manifest.json", "status": "wired"}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def inspect_wiring(play_id: str) -> str:
    """Inspect wiring status of a play — checks what primitives are connected."""
    pid = play_id.strip().zfill(2)
    play = next((p for p in PLAYS if p["id"] == pid), None)
    if not play:
        return json.dumps({"error": f"Play '{play_id}' not found"})

    services = [s.strip() for s in play["infra"].split("·")]
    return json.dumps({
        "play": f"{pid} — {play['name']}",
        "wiring": {
            "agents": {"builder": True, "reviewer": True, "tuner": True},
            "instructions": True,
            "skills": len(services) > 3,
            "hooks": play["cx"] in ("High", "Very High"),
            "workflows": True,
        },
        "infrastructure": services,
        "complexity": play["cx"],
        "tunable_parameters": [t.strip() for t in play["tune"].split("·")],
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def validate_manifest(manifest_json: str) -> str:
    """Validate a fai-manifest.json against the FAI Protocol schema."""
    try:
        m = json.loads(manifest_json) if isinstance(manifest_json, str) else manifest_json
    except json.JSONDecodeError as e:
        return json.dumps({"valid": False, "errors": [f"Invalid JSON: {e}"]})

    errors: list[str] = []
    warnings: list[str] = []
    required = ["play", "version", "context", "primitives"]
    for f in required:
        if f not in m:
            errors.append(f"Missing required field: {f}")

    if "context" in m:
        ctx = m["context"]
        if "waf" not in ctx:
            warnings.append("No WAF pillars defined in context")
        if "knowledge" not in ctx:
            warnings.append("No knowledge sources defined")

    if "guardrails" in m:
        gr = m["guardrails"]
        for k, v in gr.items():
            if not (0 <= v <= 1):
                errors.append(f"Guardrail '{k}' must be 0-1, got {v}")

    if "version" in m:
        if not re.match(r'^\d+\.\d+\.\d+', m["version"]):
            warnings.append(f"Version '{m['version']}' is not semver")

    return json.dumps({"valid": len(errors) == 0, "errors": errors, "warnings": warnings, "fields_checked": len(required) + 2}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def validate_config(config: str) -> str:
    """Validate AI configuration (temperature, safety, token limits, etc.). Pass config as JSON string."""
    try:
        cfg = json.loads(config) if isinstance(config, str) else config
    except json.JSONDecodeError as e:
        return json.dumps({"valid": False, "errors": [f"Invalid JSON: {e}"]})

    issues: list[str] = []
    warns: list[str] = []
    t = cfg.get("temperature")
    if t is not None and t > 0.5:
        warns.append(f"temperature={t} — lower for production")
    if not cfg.get("max_tokens"):
        warns.append("No max_tokens limit set")
    if not cfg.get("blocked_categories") and not cfg.get("content_safety"):
        warns.append("No content safety configured")
    return json.dumps({"valid": len(issues) == 0, "issues": issues, "warnings": warns}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def evaluate_quality(scores: str, thresholds: str = "") -> str:
    """Evaluate AI quality against thresholds. Scores/thresholds as JSON: {"groundedness": 4.5, "relevance": 3.8}"""
    try:
        s = json.loads(scores) if isinstance(scores, str) else scores
    except json.JSONDecodeError:
        return json.dumps({"error": "Invalid scores JSON"})

    default_t = {"groundedness": 4.0, "relevance": 4.0, "coherence": 4.0, "fluency": 4.0, "safety": 4.0}
    try:
        t = json.loads(thresholds) if thresholds else default_t
    except json.JSONDecodeError:
        t = default_t

    results = {}
    all_pass = True
    for metric, score in s.items():
        threshold = t.get(metric, 4.0)
        passed = score >= threshold
        if not passed:
            all_pass = False
        results[metric] = {"score": score, "threshold": threshold, "pass": passed}

    return json.dumps({"overall": "PASS" if all_pass else "FAIL", "metrics": results}, indent=2)


# ═══════════════════════════════════════════════════════════════════════════════
# Category 7: Marketplace & Distribution Tools (4)
# ═══════════════════════════════════════════════════════════════════════════════

@mcp.tool(annotations={"readOnlyHint": True})
async def list_marketplace(type_filter: str = "all", limit: int = 20) -> str:
    """List FAI primitives in the marketplace — agents, instructions, skills, hooks, plugins."""
    primitives = {
        "agents": {"count": 201, "examples": ["fai-rag-architect", "fai-security-reviewer", "fai-cost-optimizer", "fai-landing-zone", "fai-architect"]},
        "instructions": {"count": 176, "examples": ["python-waf", "security-baseline", "reliability-patterns", "cost-guardrails"]},
        "skills": {"count": 282, "examples": ["fai-play-initializer", "fai-bicep-generator", "fai-evaluation-runner"]},
        "hooks": {"count": 10, "examples": ["fai-secrets-scanner", "fai-waf-validator", "fai-cost-guard"]},
        "plugins": {"count": 77, "examples": ["enterprise-rag", "ai-gateway", "content-moderation"]},
    }

    if type_filter != "all" and type_filter in primitives:
        return json.dumps({"type": type_filter, **primitives[type_filter]}, indent=2)

    total = sum(v["count"] for v in primitives.values())
    return json.dumps({"total_primitives": total, "categories": primitives, "marketplace_url": "https://frootai.dev/marketplace"}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def get_primitive_detail(name: str, type: str = "agents") -> str:
    """Get detail for a specific FAI primitive by name and type."""
    catalog: dict[str, dict[str, Any]] = {
        "agents": {
            "fai-rag-architect": {"description": "RAG pipeline design — chunking, indexing, retrieval, reranking", "plays": ["01", "21", "28"], "waf": ["reliability", "performance-efficiency"]},
            "fai-security-reviewer": {"description": "OWASP LLM Top 10, prompt injection defense", "plays": ["all"], "waf": ["security"]},
            "fai-cost-optimizer": {"description": "FinOps — model routing, caching, right-sizing", "plays": ["14", "52"], "waf": ["cost-optimization"]},
            "fai-architect": {"description": "Solution architecture — Azure services, patterns, WAF", "plays": ["all"], "waf": ["all"]},
            "fai-landing-zone": {"description": "Hub-spoke networking, private endpoints, governance", "plays": ["02", "11"], "waf": ["security", "reliability"]},
        },
        "skills": {
            "fai-play-initializer": {"description": "Scaffold and initialize solution plays", "plays": ["all"]},
            "fai-bicep-generator": {"description": "Generate Bicep IaC for Azure resources", "plays": ["02", "11"]},
            "fai-evaluation-runner": {"description": "Run AI quality evaluation pipeline", "plays": ["all"]},
        },
    }
    cat = catalog.get(type, {})
    detail = cat.get(name)
    if detail:
        return json.dumps({"name": name, "type": type, **detail}, indent=2)
    return json.dumps({"error": f"Primitive '{name}' not found in {type}", "available": list(cat.keys())}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def search_marketplace(query: str) -> str:
    """Search the FAI marketplace for primitives matching a query."""
    q = query.lower()
    all_primitives = [
        {"name": "fai-rag-architect", "type": "agent", "desc": "RAG pipeline design"},
        {"name": "fai-security-reviewer", "type": "agent", "desc": "Security review"},
        {"name": "fai-cost-optimizer", "type": "agent", "desc": "Cost optimization"},
        {"name": "fai-architect", "type": "agent", "desc": "Solution architecture"},
        {"name": "fai-landing-zone", "type": "agent", "desc": "Landing zone design"},
        {"name": "fai-autogen-expert", "type": "agent", "desc": "AutoGen multi-agent"},
        {"name": "fai-play-initializer", "type": "skill", "desc": "Play scaffolding"},
        {"name": "fai-bicep-generator", "type": "skill", "desc": "Bicep IaC generation"},
        {"name": "fai-evaluation-runner", "type": "skill", "desc": "Quality evaluation"},
        {"name": "fai-secrets-scanner", "type": "hook", "desc": "Secrets detection"},
        {"name": "fai-waf-validator", "type": "hook", "desc": "WAF compliance check"},
        {"name": "enterprise-rag", "type": "plugin", "desc": "Enterprise RAG plugin"},
        {"name": "ai-gateway", "type": "plugin", "desc": "AI Gateway plugin"},
        {"name": "python-waf", "type": "instruction", "desc": "Python WAF patterns"},
        {"name": "security-baseline", "type": "instruction", "desc": "Security baseline"},
    ]
    matches = [p for p in all_primitives if q in p["name"] or q in p["desc"].lower() or q in p["type"]]
    return json.dumps({"query": query, "matches": matches, "total": len(matches), "marketplace_url": "https://frootai.dev/marketplace"}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def embedding_playground(text1: str, text2: str) -> str:
    """Compare two texts for semantic similarity using keyword-based approximation (educational)."""
    w1 = set(text1.lower().split())
    w2 = set(text2.lower().split())
    overlap = w1 & w2
    union = w1 | w2
    sim = len(overlap) / max(len(union), 1)
    return json.dumps({
        "text1_words": len(w1),
        "text2_words": len(w2),
        "overlap": list(overlap)[:10],
        "jaccard_similarity": round(sim, 3),
        "note": "Keyword-based approximation. Real embeddings use text-embedding-3-large with 3072 dimensions.",
    }, indent=2)


# ═══════════════════════════════════════════════════════════════════════════════
# Category 8: Scaffold Tools (5)
# ═══════════════════════════════════════════════════════════════════════════════

@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": False})
async def scaffold_play(play_id: str, project_name: str = "", dry_run: bool = False) -> str:
    """Scaffold a new solution play with DevKit, TuneKit, SpecKit, and Infra folders."""
    pid = play_id.strip().zfill(2)
    play = next((p for p in PLAYS if p["id"] == pid), None)
    if not play:
        return json.dumps({"error": f"Play '{play_id}' not found"})

    name = project_name or play["name"].lower().replace(" ", "-")

    files = [
        f"{name}/agent.md",
        f"{name}/.github/copilot-instructions.md",
        f"{name}/.github/agents/builder.agent.md",
        f"{name}/.github/agents/reviewer.agent.md",
        f"{name}/.github/agents/tuner.agent.md",
        f"{name}/.github/prompts/review.prompt.md",
        f"{name}/.github/prompts/deploy.prompt.md",
        f"{name}/.vscode/mcp.json",
        f"{name}/.vscode/settings.json",
        f"{name}/config/openai.json",
        f"{name}/config/guardrails.json",
        f"{name}/spec/fai-manifest.json",
        f"{name}/spec/README.md",
    ]

    has_infra = any(s in play["infra"].lower() for s in ["azure", "container", "cosmos", "key vault", "vnet"])
    if has_infra:
        files.extend([f"{name}/infra/main.bicep", f"{name}/infra/parameters.bicepparam"])

    _logger.info("scaffold_play play=%s files=%d dry_run=%s", play_id, len(files), dry_run)

    if dry_run:
        return json.dumps({"play": play["name"], "project": name, "files": files, "dry_run": True, "file_count": len(files)}, indent=2)

    return json.dumps({
        "play": play["name"],
        "project": name,
        "files_created": files,
        "file_count": len(files),
        "next_steps": [
            f"cd {name}",
            "code . (Copilot auto-discovers agents)",
            "@builder in Copilot Chat to start building",
            "npx frootai validate --waf",
        ],
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": False})
async def smart_scaffold(description: str) -> str:
    """AI-powered scaffold — describe what you want to build, get the best play scaffolded."""
    results = _bm25_search(description, top_k=3)
    if not results:
        q = description.lower()
        scored = []
        for p in PLAYS:
            s = sum(1 for w in q.split() if len(w) > 2 and w in (p["name"] + p["desc"] + p["infra"]).lower())
            if s > 0:
                scored.append({**p, "score": s})
        scored.sort(key=lambda x: x["score"], reverse=True)
        best = scored[0] if scored else PLAYS[0]
        return json.dumps({
            "description": description,
            "recommended_play": f"{best['id']} — {best['name']}",
            "confidence": min(best.get("score", 1) / 5, 1.0),
            "scaffold_command": f"Use scaffold_play with play_id='{best['id']}'",
        }, indent=2)

    top = results[0]
    best_play = PLAYS[0]
    for p in PLAYS:
        if p["name"].lower() in top.get("title", "").lower() or p["id"] in top.get("source", ""):
            best_play = p
            break

    return json.dumps({
        "description": description,
        "recommended_play": f"{best_play['id']} — {best_play['name']}",
        "confidence": round(min(top.get("score", 1) / 10, 1.0), 2),
        "alternatives": [r["title"] for r in results[1:3]],
        "scaffold_command": f"Use scaffold_play with play_id='{best_play['id']}'",
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def list_templates() -> str:
    """List available scaffold templates by complexity tier."""
    templates = {
        "starter": {"plays": ["08", "10", "18"], "description": "Low complexity, quick start"},
        "standard": {"plays": ["01", "05", "06", "09", "14", "17", "24", "26"], "description": "Medium complexity, production-ready"},
        "advanced": {"plays": ["03", "07", "21", "22", "23", "25", "28"], "description": "High complexity, multi-service"},
        "enterprise": {"plays": ["02", "11", "46", "99", "100"], "description": "Very High complexity, landing zones & governance"},
    }
    return json.dumps({"templates": templates, "total_plays": 100}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def preview_scaffold(play_id: str) -> str:
    """Dry-run preview of what scaffold_play would create."""
    return await scaffold_play(play_id=play_id, dry_run=True)


@mcp.tool(annotations={"readOnlyHint": True})
async def scaffold_status(project_dir: str = ".") -> str:
    """Check completeness of a scaffolded project."""
    expected = [
        "agent.md",
        ".github/copilot-instructions.md",
        ".github/agents/builder.agent.md",
        "config/openai.json",
        "config/guardrails.json",
        "spec/fai-manifest.json",
    ]
    return json.dumps({
        "project_dir": project_dir,
        "expected_files": expected,
        "note": "Run in your project directory to check scaffold completeness",
    }, indent=2)


# ═══════════════════════════════════════════════════════════════════════════════
# Extra Tools (8)
# ═══════════════════════════════════════════════════════════════════════════════

@mcp.tool(annotations={"readOnlyHint": True})
async def run_evaluation(scores: str, play: str = "", thresholds: str = "") -> str:
    """Run evaluation with scores, optional play context, and custom thresholds."""
    return await evaluate_quality(scores=scores, thresholds=thresholds)


@mcp.tool(annotations={"readOnlyHint": True})
async def get_bicep_best_practices() -> str:
    """Bicep IaC best practices for Azure AI deployments."""
    return json.dumps({
        "practices": [
            "Use Azure Verified Modules (AVM) for standard resources",
            "Parameter files per environment (dev/staging/prod)",
            "Use @secure() for secrets, reference Key Vault",
            "Enable diagnostics on every resource",
            "Use managed identity, never connection strings",
            "Tag resources: environment, cost-center, owner",
            "Use private endpoints for PaaS services in production",
        ],
        "reference": "https://learn.microsoft.com/azure/azure-resource-manager/bicep/best-practices",
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def list_primitives(type: str = "agents", limit: int = 20) -> str:
    """List FAI primitives by type: agents, instructions, skills, hooks, plugins, workflows, cookbook."""
    return await list_marketplace(type_filter=type, limit=limit)


@mcp.tool(annotations={"readOnlyHint": True})
async def get_waf_guidance(pillar: str) -> str:
    """Get Well-Architected Framework guidance for a specific pillar."""
    pillars = {
        "reliability": {"title": "Reliability", "principles": ["Retry with exponential backoff", "Circuit breaker for downstream services", "Health checks on /health endpoint", "Graceful degradation with cached fallbacks", "Idempotent operations for all writes"]},
        "security": {"title": "Security", "principles": ["Managed Identity for service auth", "Key Vault for secrets", "Private endpoints in production", "Content safety filters on AI endpoints", "RBAC with least-privilege"]},
        "cost-optimization": {"title": "Cost Optimization", "principles": ["GPT-4o-mini for simple tasks, GPT-4o for complex", "Token budgets per request", "Cache frequent AI responses", "Auto-shutdown for dev/test", "Consumption-based pricing for variable loads"]},
        "operational-excellence": {"title": "Operational Excellence", "principles": ["CI/CD pipelines for all deployments", "Structured logging with correlation IDs", "Application Insights for APM", "Infrastructure as Code (Bicep)", "Conventional commits"]},
        "performance-efficiency": {"title": "Performance Efficiency", "principles": ["Streaming responses for chat", "Response caching with 5-min TTL", "Async/await for all I/O", "Hybrid search (keyword + vector)", "CDN for static assets"]},
        "responsible-ai": {"title": "Responsible AI", "principles": ["Content Safety on all AI responses", "Groundedness checks (score ≥ 4.0)", "AI-generated content disclaimers", "Human-in-the-loop for critical decisions", "Regular red-team exercises"]},
    }
    p = pillar.lower().replace(" ", "-").replace("_", "-")
    for key, val in pillars.items():
        if p in key or key in p:
            return json.dumps(val, indent=2)
    return json.dumps({"error": f"Unknown pillar '{pillar}'", "available": list(pillars.keys())}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def check_play_compatibility(play1: str, play2: str) -> str:
    """Check if two plays can compose together based on shared infrastructure."""
    p1 = next((p for p in PLAYS if p["id"] == play1.strip().zfill(2)), None)
    p2 = next((p for p in PLAYS if p["id"] == play2.strip().zfill(2)), None)
    if not p1 or not p2:
        return json.dumps({"error": "One or both plays not found"})

    s1 = set(s.strip() for s in p1["infra"].split("·"))
    s2 = set(s.strip() for s in p2["infra"].split("·"))
    shared = s1 & s2

    compatible = len(shared) > 0 or p1["cx"] != "Very High"
    return json.dumps({
        "play1": f"{p1['id']} — {p1['name']}",
        "play2": f"{p2['id']} — {p2['name']}",
        "compatible": compatible,
        "shared_services": list(shared),
        "combined_complexity": "Very High" if p1["cx"] == "Very High" or p2["cx"] == "Very High" else "High",
        "recommendation": "These plays share infrastructure and can be composed" if compatible else "Consider running these as separate deployments",
    }, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def get_learning_path(topic: str) -> str:
    """Get a structured learning path for an AI topic."""
    paths = {
        "rag": {"modules": ["F1", "F2", "R2"], "plays": ["01", "21", "28"], "title": "RAG Mastery"},
        "agents": {"modules": ["O1", "O2"], "plays": ["03", "07", "22"], "title": "Agent Development"},
        "security": {"modules": ["T2"], "plays": ["02", "30", "41"], "title": "AI Security"},
        "mlops": {"modules": ["T1", "T3"], "plays": ["13", "17", "48"], "title": "MLOps Pipeline"},
        "cost": {"modules": ["O4"], "plays": ["14", "52"], "title": "Cost Optimization"},
    }
    t = topic.lower()
    for key, val in paths.items():
        if t in key or key in t:
            return json.dumps(val, indent=2)
    return json.dumps({"available_paths": list(paths.keys()), "tip": "Use search_knowledge for broader topics"}, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def export_play_config(play_id: str, format: str = "json") -> str:
    """Export a play's complete configuration as JSON."""
    pid = play_id.strip().zfill(2)
    play = next((p for p in PLAYS if p["id"] == pid), None)
    if not play:
        return json.dumps({"error": f"Play '{play_id}' not found"})

    config = {
        "play": play,
        "openai_config": {
            "model": "gpt-4o",
            "temperature": 0.1 if "deterministic" in play["name"].lower() else 0.3,
            "max_tokens": 4096,
            "top_p": 0.95,
        },
        "guardrails": {
            "groundedness": 0.8,
            "relevance": 0.8,
            "safety": 0.95,
            "blocked_categories": ["hate", "violence", "self-harm", "sexual"],
        },
        "waf": ["reliability", "security", "cost-optimization", "operational-excellence", "performance-efficiency", "responsible-ai"],
    }
    return json.dumps(config, indent=2)


@mcp.tool(annotations={"readOnlyHint": True})
async def get_version_info() -> str:
    """Get server version, capabilities, and stats."""
    return json.dumps({
        "name": "frootai-mcp",
        "version": "5.1.0",
        "runtime": "python-fastmcp",
        "capabilities": {
            "tools": 45,
            "resources": 4,
            "prompts": 6,
            "search": "BM25 (Robertson IDF, k1=1.5, b=0.75)",
            "plays": 100,
            "primitives": "860+",
            "modules": len(_get_modules()),
        },
        "channels": ["pip install frootai-mcp", "npx frootai-mcp", "Docker", "VS Code Extension"],
        "website": "https://frootai.dev",
    }, indent=2)


# ═══════════════════════════════════════════════════════════════════════════════
# Resources (4)
# ═══════════════════════════════════════════════════════════════════════════════

@mcp.resource("fai://modules/{module_id}")
async def module_resource(module_id: str) -> str:
    """Get a FROOT module by ID without using a tool call."""
    modules = _get_modules()
    mid = module_id.upper().strip()
    if mid in modules:
        m = modules[mid]
        return json.dumps({"id": m["id"], "title": m["title"], "layer": m.get("layer", ""), "content": m["content"][:8000]})
    return json.dumps({"error": f"Module '{mid}' not found"})


@mcp.resource("fai://plays/{play_id}")
async def play_resource(play_id: str) -> str:
    """Get a solution play by ID without using a tool call."""
    pid = play_id.strip().zfill(2)
    play = next((p for p in PLAYS if p["id"] == pid), None)
    if play:
        return json.dumps(play)
    return json.dumps({"error": f"Play '{play_id}' not found"})


@mcp.resource("fai://glossary/{term}")
async def glossary_resource(term: str) -> str:
    """Look up a glossary term without using a tool call."""
    g = _build_glossary()
    t = term.lower().strip()
    if t in g:
        return json.dumps(g[t])
    matches = [v for k, v in g.items() if t in k or k in t]
    return json.dumps({"matches": matches[:5]} if matches else {"error": f"Term '{t}' not found"})


@mcp.resource("fai://overview")
async def overview_resource() -> str:
    """FrootAI platform overview."""
    return json.dumps({
        "name": "FrootAI",
        "version": "5.1.0",
        "tagline": "From the Roots to the Fruits. It's simply Frootful.",
        "framework": "FROOT = Foundations · Reasoning · Orchestration · Operations · Transformation",
        "stats": {"tools": 45, "modules": len(_get_modules()), "plays": 100, "primitives": "860+"},
        "website": "https://frootai.dev",
    })


# ═══════════════════════════════════════════════════════════════════════════════
# Prompts (6)
# ═══════════════════════════════════════════════════════════════════════════════

@mcp.prompt()
async def design_architecture(scenario: str, scale: str = "production") -> str:
    """Guided prompt for designing an AI architecture. Asks about requirements, then recommends plays."""
    return f"""You are an AI architecture advisor using FrootAI's 100 solution plays.

The user wants to build: {scenario}
Scale: {scale}

Steps:
1. First, call `semantic_search_plays` with the scenario to find matching plays
2. Then call `get_play_detail` on the top match
3. Call `estimate_cost` for the recommended play at {scale} scale
4. Call `get_waf_guidance` for the most relevant WAF pillar
5. Present a complete architecture recommendation with:
   - Recommended play and why
   - Azure services needed
   - Monthly cost estimate
   - Key tuning parameters
   - WAF alignment checklist"""


@mcp.prompt()
async def review_config(config_json: str) -> str:
    """Structured review prompt for AI configuration. Checks safety, performance, cost."""
    return f"""You are reviewing an AI configuration for production readiness.

Configuration to review:
```json
{config_json}
```

Check these areas using FrootAI tools:
1. Call `validate_config` with the config
2. Call `agent_review` for security review
3. Call `agent_tune` for optimization recommendations
4. Summarize findings as: PASS ✅ / WARN ⚠️ / FAIL ❌ per category:
   - Temperature & parameters
   - Content safety & guardrails
   - Token budget & cost controls
   - Grounding & citations
   - Production readiness"""


@mcp.prompt()
async def pick_solution_play(description: str) -> str:
    """Conversational play selection — describe what you want, get the best play."""
    return f"""Help the user pick the best FrootAI solution play.

They want to build: {description}

Steps:
1. Call `semantic_search_plays` with their description
2. For the top 3 matches, call `get_play_detail` on each
3. Call `compare_plays` on the top 2
4. Present a comparison table showing:
   - Play name and ID
   - Complexity level
   - Azure services required
   - Estimated monthly cost (dev & prod)
   - Tuning parameters
5. Recommend the best fit with justification"""


@mcp.prompt()
async def estimate_costs(services: str, scale: str = "dev") -> str:
    """Cost estimation prompt for Azure AI services."""
    return f"""Estimate Azure AI costs for the user.

Services requested: {services}
Scale: {scale}

Steps:
1. Call `get_azure_pricing` for each service mentioned
2. Call `estimate_cost` if a specific play is referenced
3. Call `compare_models` if model selection is involved
4. Present itemized monthly cost breakdown
5. Suggest cost optimization tips from WAF cost-optimization pillar"""


@mcp.prompt()
async def scaffold_project(project_type: str) -> str:
    """Scaffold a new AI project with the right play and structure."""
    return f"""Help the user scaffold a new AI project.

Project type: {project_type}

Steps:
1. Call `smart_scaffold` with the project description
2. Call `preview_scaffold` with the recommended play ID
3. Ask user to confirm, then call `scaffold_play` with dry_run=false
4. Call `wire_play` to generate the fai-manifest.json
5. Show the complete project structure and next steps"""


@mcp.prompt()
async def learn_fai_protocol() -> str:
    """Educational prompt about the FAI Protocol and primitives ecosystem."""
    return """Teach the user about the FAI Protocol — the open glue for AI primitives.

Steps:
1. Call `get_froot_overview` for platform context
2. Call `get_github_agentic_os` for the 7 primitives
3. Call `list_marketplace` for primitive counts
4. Explain:
   - What is the FAI Protocol? (fai-manifest.json = wiring spec)
   - What are the 7 primitive types? (agents, instructions, skills, hooks, workflows, plugins, prompts)
   - How does wiring work? (standalone primitives auto-connect inside plays)
   - What makes FAI different? (WAF alignment, shared context, play compatibility)
5. Show a sample fai-manifest.json structure"""


# ═══════════════════════════════════════════════════════════════════════════════
# Entry Point
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()

