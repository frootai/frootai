"""FrootAI Evaluation — Quality gates and scoring framework."""

import json
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path


@dataclass
class EvalResult:
    """Result of an evaluation run."""
    metric: str
    score: float
    threshold: float
    passed: bool

    def to_dict(self) -> dict:
        return {"metric": self.metric, "score": self.score, "threshold": self.threshold, "passed": self.passed}


@dataclass
class Evaluator:
    """FrootAI Evaluator — run quality checks against thresholds.
    
    Usage:
        evaluator = Evaluator.from_config("evaluation/eval-config.json")
        results = evaluator.check_thresholds({"groundedness": 4.2, "relevance": 3.8})
    """
    metrics: list[str] = field(default_factory=lambda: ["groundedness", "relevance", "coherence", "fluency"])
    thresholds: dict[str, float] = field(default_factory=lambda: {"groundedness": 4.0, "relevance": 4.0, "coherence": 4.0, "fluency": 4.0})

    @staticmethod
    def from_config(config_path: str) -> "Evaluator":
        """Load evaluator from eval-config.json."""
        path = Path(config_path)
        if path.exists():
            with open(path, "r") as f:
                config = json.load(f)
            return Evaluator(
                metrics=config.get("metrics", ["groundedness", "relevance", "coherence", "fluency"]),
                thresholds=config.get("thresholds", {}),
            )
        return Evaluator()

    def check_thresholds(self, scores: dict[str, float]) -> list[EvalResult]:
        """Check scores against thresholds."""
        results = []
        for metric in self.metrics:
            threshold = self.thresholds.get(metric, 4.0)
            score = scores.get(metric, 0.0)
            results.append(EvalResult(
                metric=metric,
                score=score,
                threshold=threshold,
                passed=score >= threshold,
            ))
        return results

    def all_passed(self, scores: dict[str, float]) -> bool:
        """Check if all metrics pass their thresholds."""
        return all(r.passed for r in self.check_thresholds(scores))

    def results_to_json(self, scores: dict[str, float]) -> str:
        """Export evaluation results as JSON."""
        import json
        results = self.check_thresholds(scores)
        return json.dumps({
            "overall": "PASS" if self.all_passed(scores) else "FAIL",
            "metrics": [r.to_dict() for r in results]
        }, indent=2)

    def summary(self, scores: dict[str, float]) -> str:
        """Get a human-readable summary."""
        results = self.check_thresholds(scores)
        lines = ["FrootAI Evaluation Summary", "=" * 40]
        for r in results:
            status = "✅ PASS" if r.passed else "❌ FAIL"
            lines.append(f"  {r.metric:<20} {r.score:.1f} / {r.threshold:.1f}  {status}")
        passed = sum(1 for r in results if r.passed)
        lines.append(f"\n  {passed}/{len(results)} checks passed")
        return "\n".join(lines)
