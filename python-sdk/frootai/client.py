"""FrootAI Client — Main entry point for the SDK.

Offline-first: queries bundled knowledge base (16 modules, 5 FROOT layers).
101 solution plays, 830+ FAI primitives (201 agents, 176 instructions, 282 skills, 10 hooks),
77 plugins, 16 cookbook recipes, 12 workflows, 45 MCP tools.
No network required for search, modules, glossary, or cost estimation.
"""

import json
import math
import re
from pathlib import Path
from typing import Optional

_KNOWLEDGE_PATH = Path(__file__).parent / "knowledge.json"

# Azure AI cost estimates (monthly USD) — sourced from Azure pricing calculator
_COST_DATA = {
    "openai-gpt4o": {"dev": 150, "prod": 2500},
    "openai-gpt4o-mini": {"dev": 30, "prod": 500},
    "ai-search-basic": {"dev": 75, "prod": 300},
    "ai-search-standard": {"dev": 250, "prod": 750},
    "container-apps": {"dev": 20, "prod": 200},
    "app-service-b1": {"dev": 13, "prod": 55},
    "app-service-p1v3": {"dev": 55, "prod": 220},
    "cosmos-db": {"dev": 25, "prod": 400},
    "log-analytics": {"dev": 10, "prod": 150},
    "content-safety": {"dev": 15, "prod": 100},
    "document-intelligence": {"dev": 50, "prod": 500},
    "communication-services": {"dev": 10, "prod": 200},
    "aks-gpu": {"dev": 800, "prod": 3200},
    "vnet-private-endpoints": {"dev": 8, "prod": 40},
    "key-vault": {"dev": 3, "prod": 10},
}

_PLAY_COSTS = {
    "01-enterprise-rag": ["openai-gpt4o", "ai-search-standard", "container-apps", "log-analytics"],
    "02-ai-landing-zone": ["vnet-private-endpoints", "key-vault", "log-analytics"],
    "03-deterministic-agent": ["openai-gpt4o", "container-apps", "content-safety", "log-analytics"],
    "04-call-center-voice": ["openai-gpt4o", "communication-services", "container-apps"],
    "05-it-ticket-resolution": ["openai-gpt4o-mini", "container-apps", "log-analytics"],
    "06-document-intelligence": ["document-intelligence", "openai-gpt4o", "container-apps"],
    "07-multi-agent": ["openai-gpt4o", "container-apps", "cosmos-db", "log-analytics"],
    "09-ai-search-portal": ["ai-search-standard", "app-service-p1v3", "log-analytics"],
    "12-model-serving-aks": ["aks-gpu", "log-analytics", "key-vault"],
    "14-ai-gateway": ["openai-gpt4o", "container-apps", "log-analytics"],
}


class FrootAI:
    """FrootAI SDK client — offline-first access to AI architecture knowledge.

    101 solution plays, 830+ FAI primitives, 77 plugins, 45 MCP tools.

    Usage:
        client = FrootAI()
        results = client.search("RAG architecture")
        module = client.get_module("R2")
        cost = client.estimate_cost("01-enterprise-rag", scale="prod")
    """

    def __init__(self, knowledge_path: Optional[str] = None):
        path = Path(knowledge_path) if knowledge_path else _KNOWLEDGE_PATH
        with open(path, "r", encoding="utf-8") as f:
            self._data = json.load(f)
        self._modules = self._data.get("modules", {})
        self._layers = self._data.get("layers", {})
        self._glossary = self._build_glossary()
        self._search_index = None

    def _build_glossary(self) -> dict[str, dict]:
        glossary = {}
        pattern = re.compile(r"\*\*([A-Z][A-Za-z0-9 /\-()]+)\*\*\s*[-:—]\s*(.+?)(?:\n|$)")
        for mod_id, mod in self._modules.items():
            for match in pattern.finditer(mod.get("content", "")):
                term = match.group(1).strip()
                definition = match.group(2).strip()
                if len(term) < 60 and len(definition) > 10:
                    glossary[term.lower()] = {
                        "term": term,
                        "definition": definition,
                        "source_module": mod_id,
                        "source_title": mod.get("title", ""),
                    }
        return glossary

    @property
    def module_count(self) -> int:
        return len(self._modules)

    @property
    def layer_count(self) -> int:
        return len(self._layers)

    @property
    def glossary_count(self) -> int:
        return len(self._glossary)

    def _load_search_index(self) -> dict:
        """Load the BM25 search index from search-index.json."""
        if self._search_index is not None:
            return self._search_index
        index_path = Path(__file__).parent / "search-index.json"
        if index_path.exists():
            with open(index_path, "r", encoding="utf-8") as f:
                self._search_index = json.load(f)
        else:
            self._search_index = {}
        return self._search_index

    def _bm25_search(self, query: str, top_k: int = 10) -> list[dict]:
        """BM25 ranking over the pre-built search index."""
        index = self._load_search_index()
        if not index or "docs" not in index:
            return []
        docs = index["docs"]
        idf = index.get("idf", {})
        params = index.get("params", {"k1": 1.5, "b": 0.75, "avgDocLen": 274})
        k1, b, avg_dl = params["k1"], params["b"], params["avgDocLen"]

        terms = re.findall(r"\w+", query.lower())
        if not terms:
            return []

        scored = []
        for doc in docs:
            score = 0.0
            doc_len = doc.get("len", avg_dl)
            tf_map = doc.get("tf", {})
            for term in terms:
                tf = tf_map.get(term, 0)
                if tf == 0:
                    continue
                term_idf = idf.get(term, 0)
                numerator = tf * (k1 + 1)
                denominator = tf + k1 * (1 - b + b * (doc_len / avg_dl))
                score += term_idf * (numerator / denominator)
            if score > 0:
                scored.append((score, doc))
        scored.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, doc in scored[:top_k]:
            results.append({
                "id": doc.get("id", ""),
                "title": doc.get("title", ""),
                "score": round(score, 4),
                "meta": doc.get("meta", {}),
            })
        return results

    def search(self, query: str, max_results: int = 5) -> list[dict]:
        """Search across all modules using BM25 ranking. Falls back to keyword search."""
        # Try BM25 first
        bm25_results = self._bm25_search(query, top_k=max_results)
        if bm25_results:
            return bm25_results
        # Fallback to existing substring search
        query_lower = query.lower()
        results = []
        for mod_id, mod in self._modules.items():
            content = mod.get("content", "")
            if query_lower in content.lower():
                paragraphs = content.split("\n\n")
                excerpts = []
                for p in paragraphs:
                    if query_lower in p.lower() and len(p.strip()) > 20:
                        clean = p.strip()[:300]
                        excerpts.append(clean)
                        if len(excerpts) >= 2:
                            break
                results.append({
                    "module_id": mod_id,
                    "title": mod.get("title", ""),
                    "layer": mod.get("layer", ""),
                    "relevance": content.lower().count(query_lower),
                    "excerpts": excerpts,
                })
        results.sort(key=lambda r: r["relevance"], reverse=True)
        return results[:max_results]

    def get_module(self, module_id: str) -> Optional[dict]:
        """Get a module by ID (e.g. 'F1', 'R2', 'T3')."""
        mod = self._modules.get(module_id)
        if not mod:
            return None
        return {
            "id": mod.get("id", module_id),
            "title": mod.get("title", ""),
            "layer": mod.get("layer", ""),
            "emoji": mod.get("emoji", ""),
            "metaphor": mod.get("metaphor", ""),
            "content_length": len(mod.get("content", "")),
            "content": mod.get("content", ""),
        }

    def list_modules(self) -> list[dict]:
        """List all modules (without content)."""
        return [
            {
                "id": mod_id,
                "title": mod.get("title", ""),
                "layer": mod.get("layer", ""),
                "emoji": mod.get("emoji", ""),
                "metaphor": mod.get("metaphor", ""),
                "content_length": len(mod.get("content", "")),
            }
            for mod_id, mod in self._modules.items()
        ]

    def list_layers(self) -> list[dict]:
        """List all FROOT layers."""
        return [
            {
                "key": key,
                "name": layer.get("name", ""),
                "emoji": layer.get("emoji", ""),
                "metaphor": layer.get("metaphor", ""),
                "modules": layer.get("moduleIds", []),
            }
            for key, layer in self._layers.items()
        ]

    def lookup_term(self, term: str) -> Optional[dict]:
        """Look up a glossary term."""
        return self._glossary.get(term.lower())

    def search_glossary(self, query: str, max_results: int = 10) -> list[dict]:
        """Search glossary terms by keyword."""
        query_lower = query.lower()
        results = []
        for key, entry in self._glossary.items():
            if query_lower in key or query_lower in entry["definition"].lower():
                results.append(entry)
                if len(results) >= max_results:
                    break
        return results

    def estimate_cost(self, play_id: str, scale: str = "dev") -> dict:
        """Estimate monthly Azure costs for a solution play."""
        services = _PLAY_COSTS.get(play_id, [])
        if not services:
            return {"play": play_id, "scale": scale, "error": f"No cost data for play '{play_id}'"}
        breakdown = {}
        total = 0
        for svc in services:
            cost = _COST_DATA.get(svc, {}).get(scale, 0)
            breakdown[svc] = cost
            total += cost
        return {
            "play": play_id,
            "scale": scale,
            "currency": "USD",
            "monthly_total": total,
            "breakdown": breakdown,
        }

    def primitives_catalog(self) -> dict:
        """Get the FAI primitives catalog — all 830+ LEGO blocks."""
        return {
            "total": 780,
            "categories": {
                "agents": {"count": 201, "path": "agents/", "ext": ".agent.md", "install": "vscode://github.copilot-chat/createAgent?url=<raw_url>"},
                "instructions": {"count": 176, "path": "instructions/", "ext": ".instructions.md", "install": "Copy to .github/instructions/"},
                "skills": {"count": 282, "path": "skills/", "ext": "/SKILL.md", "install": "Copy skill folder to .github/skills/"},
                "hooks": {"count": 10, "path": "hooks/", "ext": "/hooks.json", "install": "Copy hook folder to .github/hooks/"},
                "plugins": {"count": 77, "path": "plugins/", "ext": "/plugin.json", "install": "npx frootai install <plugin-name>"},
                "workflows": {"count": 12, "path": "workflows/", "ext": ".md", "install": "Copy to .github/workflows/"},
                "cookbook": {"count": 16, "path": "cookbook/", "ext": ".md"},
            },
            "waf_pillars": ["reliability", "security", "cost-optimization", "operational-excellence", "performance-efficiency", "responsible-ai"],
            "fai_protocol": {
                "manifest": "fai-manifest.json — full play wiring",
                "context": "fai-context.json — lightweight LEGO block context",
                "schemas": 7,
                "engine_modules": 7,
                "auto_wiring": "Standalone primitives auto-wire when placed inside a solution play via fai-manifest.json",
            },
            "website": "https://frootai.dev/primitives",
            "github": "https://github.com/FrootAI/frootai",
        }

    def fai_protocol(self) -> dict:
        """Get FAI Protocol info — the binding glue."""
        return {
            "name": "FAI Protocol",
            "spec_file": "fai-manifest.json",
            "description": "The missing binding glue — context-wiring between agents, instructions, skills, hooks, workflows, plugins, tools, prompts, and guardrails.",
            "evolution": ["FAI Protocol (spec)", "FAI Layer (concept)", "FAI Engine (runtime)", "FAI Factory (CI/CD)", "FAI Packages (distribution)", "FAI Marketplace (discovery)"],
            "key_concepts": {
                "context_wiring": "Knowledge modules + WAF pillars + compatible plays propagate to all primitives",
                "auto_wiring": "Place a primitive in a play → shared context applies automatically",
                "standalone_mode": "Any primitive works alone as a LEGO block",
                "wired_mode": "Inside a play, primitives share context via fai-manifest.json",
            },
            "schemas": ["agent.schema.json", "instruction.schema.json", "skill.schema.json", "hook.schema.json", "plugin.schema.json", "fai-manifest.schema.json", "fai-context.schema.json"],
        }

    # --- FAI Protocol methods (S8) ---

    def wire_play(self, play_id: str) -> dict:
        """Generate a fai-manifest.json for a solution play."""
        from frootai.plays import SolutionPlay
        play = SolutionPlay.get(play_id)
        if not play:
            return {"error": f"Play '{play_id}' not found"}
        return {
            "play": f"{play.id}-{play.name.lower().replace(' ', '-')}",
            "version": "1.0.0",
            "context": {
                "knowledge": ["config/knowledge.json"],
                "waf": ["reliability", "security", "cost-optimization", "operational-excellence", "performance-efficiency", "responsible-ai"]
            },
            "primitives": {
                "agents": [".github/agents/builder.agent.md", ".github/agents/reviewer.agent.md", ".github/agents/tuner.agent.md"],
                "instructions": [".github/copilot-instructions.md"],
                "skills": [], "hooks": [], "workflows": []
            },
            "infrastructure": {"services": play.infra, "complexity": play.complexity},
            "guardrails": {"groundedness": 0.8, "relevance": 0.8, "coherence": 0.85, "fluency": 0.9, "safety": 0.95},
            "tuning": {"parameters": play.tuning},
            "status": "wired"
        }

    def validate_manifest(self, manifest: dict) -> dict:
        """Validate a fai-manifest.json structure."""
        errors, warnings = [], []
        for f in ["play", "version", "context", "primitives"]:
            if f not in manifest:
                errors.append(f"Missing required field: {f}")
        if "context" in manifest:
            if "waf" not in manifest["context"]:
                warnings.append("No WAF pillars defined")
            if "knowledge" not in manifest["context"]:
                warnings.append("No knowledge sources defined")
        if "guardrails" in manifest:
            for k, v in manifest["guardrails"].items():
                if not (0 <= v <= 1):
                    errors.append(f"Guardrail '{k}' must be 0-1, got {v}")
        return {"valid": len(errors) == 0, "errors": errors, "warnings": warnings}

    def inspect_wiring(self, play_id: str) -> dict:
        """Inspect what primitives are wired to a play."""
        from frootai.plays import SolutionPlay
        play = SolutionPlay.get(play_id)
        if not play:
            return {"error": f"Play '{play_id}' not found"}
        return {
            "play": f"{play.id} — {play.name}",
            "wiring": {"agents": True, "instructions": True, "skills": len(play.infra) > 3, "hooks": play.complexity in ("High", "Very High"), "workflows": True},
            "infrastructure": play.infra,
            "complexity": play.complexity,
            "tuning": play.tuning
        }

    # --- Scaffold methods (S9) ---

    def scaffold_play(self, play_id: str, project_name: str = "", dry_run: bool = False) -> dict:
        """Scaffold a new solution play with DevKit structure."""
        from frootai.plays import SolutionPlay
        play = SolutionPlay.get(play_id)
        if not play:
            return {"error": f"Play '{play_id}' not found"}
        name = project_name or play.name.lower().replace(" ", "-")
        files = [
            f"{name}/agent.md", f"{name}/.github/copilot-instructions.md",
            f"{name}/.github/agents/builder.agent.md", f"{name}/.github/agents/reviewer.agent.md",
            f"{name}/.github/agents/tuner.agent.md", f"{name}/.github/prompts/review.prompt.md",
            f"{name}/.vscode/mcp.json", f"{name}/.vscode/settings.json",
            f"{name}/config/openai.json", f"{name}/config/guardrails.json",
            f"{name}/spec/fai-manifest.json", f"{name}/spec/README.md",
        ]
        if any(s.lower() in " ".join(play.infra).lower() for s in ["azure", "container", "cosmos", "key vault"]):
            files.extend([f"{name}/infra/main.bicep", f"{name}/infra/parameters.bicepparam"])
        if dry_run:
            return {"play": play.name, "project": name, "files": files, "dry_run": True, "file_count": len(files)}
        return {"play": play.name, "project": name, "files_created": files, "file_count": len(files),
                "next_steps": [f"cd {name}", "code . (Copilot auto-discovers agents)", "@builder in Copilot Chat"]}

    def list_templates(self) -> dict:
        """List available scaffold templates by complexity."""
        return {
            "templates": {
                "starter": {"plays": ["08", "10", "18"], "description": "Low complexity, quick start"},
                "standard": {"plays": ["01", "05", "06", "09", "14", "17", "24", "26"], "description": "Medium complexity, production-ready"},
                "advanced": {"plays": ["03", "07", "21", "22", "23", "25", "28"], "description": "High complexity, multi-service"},
                "enterprise": {"plays": ["02", "11", "46", "99", "100"], "description": "Very High complexity, landing zones & governance"}
            },
            "total_plays": 101
        }

    # --- WAF guidance (S11) ---

    def get_waf_guidance(self, pillar: str) -> dict:
        """Get Well-Architected Framework guidance for a specific pillar."""
        pillars = {
            "reliability": {"title": "Reliability", "principles": ["Retry with exponential backoff", "Circuit breaker for downstream services", "Health checks on /health endpoint", "Graceful degradation with cached fallbacks", "Idempotent operations for all writes"]},
            "security": {"title": "Security", "principles": ["Managed Identity for service auth", "Key Vault for secrets", "Private endpoints in production", "Content safety filters on AI endpoints", "RBAC with least-privilege"]},
            "cost-optimization": {"title": "Cost Optimization", "principles": ["GPT-4o-mini for simple tasks, GPT-4o for complex", "Token budgets per request", "Cache frequent AI responses", "Auto-shutdown for dev/test", "Consumption-based pricing"]},
            "operational-excellence": {"title": "Operational Excellence", "principles": ["CI/CD pipelines for all deployments", "Structured logging with correlation IDs", "Application Insights for APM", "Infrastructure as Code (Bicep)", "Conventional commits"]},
            "performance-efficiency": {"title": "Performance Efficiency", "principles": ["Streaming responses for chat", "Response caching with 5-min TTL", "Async/await for all I/O", "Hybrid search (keyword + vector)", "CDN for static assets"]},
            "responsible-ai": {"title": "Responsible AI", "principles": ["Content Safety on all AI responses", "Groundedness checks (score >= 4.0)", "AI-generated content disclaimers", "Human-in-the-loop for critical decisions", "Regular red-team exercises"]}
        }
        p = pillar.lower().replace(" ", "-").replace("_", "-")
        for key, val in pillars.items():
            if p in key or key in p:
                return val
        return {"error": f"Unknown pillar '{pillar}'", "available": list(pillars.keys())}

    def check_play_compatibility(self, play1_id: str, play2_id: str) -> dict:
        """Check if two plays can compose together."""
        from frootai.plays import SolutionPlay
        p1, p2 = SolutionPlay.get(play1_id), SolutionPlay.get(play2_id)
        if not p1 or not p2:
            return {"error": "One or both plays not found"}
        s1, s2 = set(p1.infra), set(p2.infra)
        shared = s1 & s2
        return {
            "play1": f"{p1.id} — {p1.name}", "play2": f"{p2.id} — {p2.name}",
            "compatible": len(shared) > 0 or p1.complexity != "Very High",
            "shared_services": list(shared),
            "combined_complexity": "Very High" if "Very High" in (p1.complexity, p2.complexity) else "High"
        }

    def get_learning_path(self, topic: str) -> dict:
        """Get a curated learning path for an AI topic."""
        paths = {
            "rag": {"title": "RAG Mastery", "modules": ["F1", "F2", "R2"], "plays": ["01", "21", "28"]},
            "agents": {"title": "Agent Development", "modules": ["O1", "O2"], "plays": ["03", "07", "22"]},
            "security": {"title": "AI Security", "modules": ["T2"], "plays": ["02", "30", "41"]},
            "mlops": {"title": "MLOps Pipeline", "modules": ["T1", "T3"], "plays": ["13", "17", "48"]},
            "cost": {"title": "Cost Optimization", "modules": ["O4"], "plays": ["14", "52"]},
        }
        t = topic.lower()
        for key, val in paths.items():
            if t in key or key in t:
                return val
        return {"available_paths": list(paths.keys())}

    def get_module_section(self, module_id: str, heading: str) -> Optional[str]:
        """Extract a specific section from a module by heading."""
        mod = self._modules.get(module_id)
        if not mod:
            return None
        content = mod.get("content", "")
        pattern = re.compile(
            rf"^(#{1,3})\s+.*{re.escape(heading)}.*$",
            re.MULTILINE | re.IGNORECASE,
        )
        match = pattern.search(content)
        if not match:
            return None
        level = len(match.group(1))
        start = match.start()
        next_heading = re.compile(rf"^#{{{1},{level}}}\s+", re.MULTILINE)
        rest = content[match.end():]
        next_match = next_heading.search(rest)
        end = match.end() + next_match.start() if next_match else len(content)
        return content[start:end].strip()
