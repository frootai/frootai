"""Comprehensive E2E tests for FrootAI Python SDK."""
import json
import sys

import pytest

sys.path.insert(0, ".")

from frootai import FrootAI, SolutionPlay, Evaluator, __version__
from frootai.ab_testing import PromptExperiment, PromptVariant
from frootai.evaluation import EvalResult


# ─── Version & Init ───

class TestInit:
    def test_version(self):
        assert __version__ == "5.1.0"

    def test_client_init(self):
        c = FrootAI()
        assert c.module_count == 16
        assert c.layer_count == 5
        assert c.glossary_count > 50


# ─── Knowledge Search ───

class TestKnowledgeSearch:
    def test_bm25_search(self):
        c = FrootAI()
        results = c.search("RAG retrieval augmented generation")
        assert len(results) > 0

    def test_search_empty(self):
        c = FrootAI()
        results = c.search("")
        assert isinstance(results, list)

    def test_search_limit(self):
        c = FrootAI()
        results = c.search("AI", max_results=3)
        assert len(results) <= 3

    def test_get_module(self):
        c = FrootAI()
        m = c.get_module("F1")
        assert m is not None
        assert m["id"] == "F1"
        assert m["content_length"] > 1000

    def test_get_module_not_found(self):
        c = FrootAI()
        m = c.get_module("ZZZZ")
        assert m is None

    def test_list_modules(self):
        c = FrootAI()
        mods = c.list_modules()
        assert len(mods) == 16

    def test_list_layers(self):
        c = FrootAI()
        layers = c.list_layers()
        assert len(layers) == 5

    def test_lookup_term(self):
        c = FrootAI()
        # May or may not find — just no crash
        result = c.lookup_term("transformer")
        assert result is None or isinstance(result, dict)

    def test_search_glossary(self):
        c = FrootAI()
        results = c.search_glossary("model")
        assert isinstance(results, list)

    def test_get_module_section(self):
        c = FrootAI()
        section = c.get_module_section("F1", "Table of Contents")
        # May or may not exist
        assert section is None or len(section) > 0


# ─── Solution Plays ───

class TestSolutionPlays:
    def test_all_plays(self):
        plays = SolutionPlay.all()
        assert len(plays) == 101

    def test_get_play(self):
        p = SolutionPlay.get("01")
        assert p is not None
        assert p.name == "Enterprise RAG Q&A"
        assert p.complexity == "Medium"

    def test_get_play_not_found(self):
        p = SolutionPlay.get("999")
        assert p is None

    def test_play_by_layer(self):
        plays = SolutionPlay.by_layer("R")
        assert len(plays) > 0
        assert all(p.layer == "R" for p in plays)

    def test_play_ready(self):
        plays = SolutionPlay.ready()
        assert len(plays) > 0
        assert all(p.status == "Ready" for p in plays)

    def test_play_search(self):
        plays = SolutionPlay.search("RAG")
        assert len(plays) > 0

    def test_play_repr(self):
        p = SolutionPlay.get("03")
        assert "Deterministic" in repr(p)
        assert "03" in str(p)

    def test_play_to_dict(self):
        p = SolutionPlay.get("01")
        d = p.to_dict()
        assert d["id"] == "01"
        assert "infra" in d

    def test_play_to_json(self):
        p = SolutionPlay.get("01")
        j = p.to_json()
        d = json.loads(j)
        assert d["id"] == "01"


# ─── Evaluation ───

class TestEvaluation:
    def test_check_thresholds_pass(self):
        ev = Evaluator()
        results = ev.check_thresholds({"groundedness": 4.5, "relevance": 4.2, "coherence": 4.5, "fluency": 4.5})
        assert all(r.passed for r in results)

    def test_check_thresholds_fail(self):
        ev = Evaluator()
        results = ev.check_thresholds({"groundedness": 2.0})
        assert not results[0].passed

    def test_all_passed(self):
        ev = Evaluator()
        assert ev.all_passed({"groundedness": 4.5, "relevance": 4.5, "coherence": 4.5, "fluency": 4.5})
        assert not ev.all_passed({"groundedness": 2.0})

    def test_summary(self):
        ev = Evaluator()
        s = ev.summary({"groundedness": 4.5, "relevance": 3.2})
        assert "✅" in s
        assert "❌" in s

    def test_eval_result_to_dict(self):
        r = EvalResult(metric="groundedness", score=4.5, threshold=4.0, passed=True)
        d = r.to_dict()
        assert d["metric"] == "groundedness"
        assert d["passed"] is True

    def test_results_to_json(self):
        ev = Evaluator()
        j = ev.results_to_json({"groundedness": 4.5, "relevance": 4.5, "coherence": 4.5, "fluency": 4.5})
        d = json.loads(j)
        assert d["overall"] == "PASS"


# ─── A/B Testing ───

class TestABTesting:
    def test_experiment(self):
        exp = PromptExperiment(
            name="test",
            variants=[PromptVariant("a", "system a"), PromptVariant("b", "system b")],
            metrics=["quality"],
        )
        results = exp.run(
            ["q1", "q2"],
            model_fn=lambda s, q: f"Response from {s}",
            scorer_fn=lambda q, r: {"quality": 4.0 if "system a" in r else 3.5},
        )
        assert len(results) == 4
        assert exp.pick_winner(results) == "a"


# ─── FAI Protocol ───

class TestFAIProtocol:
    def test_wire_play(self):
        c = FrootAI()
        r = c.wire_play("01")
        assert r["status"] == "wired"
        assert "manifest" not in r or "play" in r

    def test_wire_play_not_found(self):
        c = FrootAI()
        r = c.wire_play("999")
        assert "error" in r

    def test_validate_manifest_valid(self):
        c = FrootAI()
        r = c.validate_manifest({"play": "test", "version": "1.0.0", "context": {"waf": ["security"]}, "primitives": {}})
        assert r["valid"] is True

    def test_validate_manifest_invalid(self):
        c = FrootAI()
        r = c.validate_manifest({})
        assert r["valid"] is False
        assert len(r["errors"]) > 0

    def test_inspect_wiring(self):
        c = FrootAI()
        r = c.inspect_wiring("01")
        assert "wiring" in r
        assert r["wiring"]["agents"] is True

    def test_fai_protocol_info(self):
        c = FrootAI()
        r = c.fai_protocol()
        assert r["name"] == "FAI Protocol"
        assert "schemas" in r

    def test_primitives_catalog(self):
        c = FrootAI()
        r = c.primitives_catalog()
        assert r["total"] > 700
        assert "agents" in r["categories"]


# ─── Scaffold ───

class TestScaffold:
    def test_scaffold_dry_run(self):
        c = FrootAI()
        r = c.scaffold_play("01", dry_run=True)
        assert r["dry_run"] is True
        assert r["file_count"] > 0

    def test_scaffold_full(self):
        c = FrootAI()
        r = c.scaffold_play("01")
        assert "files_created" in r
        assert "next_steps" in r

    def test_list_templates(self):
        c = FrootAI()
        r = c.list_templates()
        assert "templates" in r
        assert len(r["templates"]) == 4


# ─── WAF & Ecosystem ───

class TestWAFEcosystem:
    def test_waf_guidance(self):
        c = FrootAI()
        r = c.get_waf_guidance("security")
        assert r["title"] == "Security"
        assert len(r["principles"]) > 0

    def test_waf_unknown(self):
        c = FrootAI()
        r = c.get_waf_guidance("nonexistent")
        assert "error" in r

    def test_play_compatibility(self):
        c = FrootAI()
        r = c.check_play_compatibility("01", "02")
        assert "compatible" in r
        assert "shared_services" in r

    def test_learning_path(self):
        c = FrootAI()
        r = c.get_learning_path("rag")
        assert r["title"] == "RAG Mastery"
        assert len(r["modules"]) > 0

    def test_learning_path_unknown(self):
        c = FrootAI()
        r = c.get_learning_path("nonexistent")
        assert "available_paths" in r

    def test_cost_estimation(self):
        c = FrootAI()
        r = c.estimate_cost("01-enterprise-rag", "dev")
        assert r["monthly_total"] > 0
