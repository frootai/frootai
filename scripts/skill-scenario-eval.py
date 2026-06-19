#!/usr/bin/env python3
"""Scenario-based pattern eval harness for FrootAI code-generating skills.

Microsoft-grade: each skill gets an evaluation/skill-scenarios/<skill>/scenarios.yaml
with, per scenario:
  - prompt              : the user request
  - expected_patterns   : regexes the correct output MUST contain
  - forbidden_patterns  : regexes the output must NOT contain
  - mock_response       : a known-good output (used for offline/CI grading)

The harness grades a candidate output (the mock_response by default, or a real
generation piped via --input) against the patterns and scores 0-100 per skill.
A real-LLM backend can be slotted in later; the mock path keeps it deterministic
and CI-friendly (like Microsoft's `pnpm harness <skill> --mock`).

Usage:
  python scripts/skill-scenario-eval.py list
  python scripts/skill-scenario-eval.py run --skill fai-mcp-python-generator [--input out.txt]
  python scripts/skill-scenario-eval.py run-all [--json reports/scenario-eval.json]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

BASE = Path(__file__).resolve().parent.parent  # frootai/
SCEN_DIR = BASE / "evaluation" / "skill-scenarios"


def load_scenarios(skill_dir: Path) -> dict:
    f = skill_dir / "scenarios.yaml"
    return yaml.safe_load(f.read_text(encoding="utf-8"))


def grade_scenario(scenario: dict, candidate: str) -> dict:
    """A scenario PASSES iff every expected pattern matches and no forbidden one does."""
    findings = []
    ok = True
    for pat in scenario.get("expected_patterns", []):
        matched = re.search(pat, candidate, re.MULTILINE) is not None
        findings.append({"type": "expected", "pattern": pat, "passed": matched})
        if not matched:
            ok = False
    for pat in scenario.get("forbidden_patterns", []):
        hit = re.search(pat, candidate, re.MULTILINE) is not None
        findings.append({"type": "forbidden", "pattern": pat, "passed": not hit})
        if hit:
            ok = False
    return {"name": scenario.get("name", "?"), "passed": ok, "findings": findings}


def eval_skill(skill: str, candidate_override: str | None = None) -> dict:
    skill_dir = SCEN_DIR / skill
    if not (skill_dir / "scenarios.yaml").exists():
        return {"skill": skill, "error": "no scenarios.yaml"}
    data = load_scenarios(skill_dir)
    results = []
    for sc in data.get("scenarios", []):
        candidate = candidate_override if candidate_override is not None else sc.get("mock_response", "")
        results.append(grade_scenario(sc, candidate))
    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    return {
        "skill": skill,
        "passed": passed,
        "total": total,
        "score": round(passed / total * 100) if total else 0,
        "scenarios": results,
    }


def all_skills() -> list[str]:
    if not SCEN_DIR.exists():
        return []
    return sorted(p.name for p in SCEN_DIR.iterdir() if (p / "scenarios.yaml").exists())


def cmd_list(_args):
    skills = all_skills()
    print(f"{len(skills)} skill(s) with scenarios:")
    for s in skills:
        data = load_scenarios(SCEN_DIR / s)
        print(f"  {s}  ({len(data.get('scenarios', []))} scenarios)")
    return 0


def cmd_run(args):
    candidate = None
    if args.input:
        candidate = Path(args.input).read_text(encoding="utf-8")
    res = eval_skill(args.skill, candidate)
    if "error" in res:
        print(f"{args.skill}: {res['error']}", file=sys.stderr)
        return 1
    print(f"Skill: {res['skill']}  score={res['score']}  ({res['passed']}/{res['total']} scenarios)")
    for sc in res["scenarios"]:
        mark = "PASS" if sc["passed"] else "FAIL"
        print(f"  [{mark}] {sc['name']}")
        for f in sc["findings"]:
            if not f["passed"]:
                print(f"        missing {f['type']}: {f['pattern']}")
    return 0 if res["passed"] == res["total"] else 1


def cmd_run_all(args):
    results = [eval_skill(s) for s in all_skills()]
    total_sc = sum(r["total"] for r in results)
    total_pass = sum(r["passed"] for r in results)
    print(f"Scenario eval — {len(results)} skills, {total_pass}/{total_sc} scenarios passed")
    for r in results:
        print(f"  {r['score']:>3}  {r['skill']}  ({r['passed']}/{r['total']})")
    if args.json:
        out = BASE / args.json
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({"skills": results, "total_scenarios": total_sc,
                                   "total_passed": total_pass}, indent=2) + "\n", encoding="utf-8")
        print(f"  report -> {args.json}")
    return 0 if total_pass == total_sc else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list").set_defaults(func=cmd_list)
    p_run = sub.add_parser("run")
    p_run.add_argument("--skill", required=True)
    p_run.add_argument("--input", default=None, help="file with a real generation to grade")
    p_run.set_defaults(func=cmd_run)
    p_all = sub.add_parser("run-all")
    p_all.add_argument("--json", default=None)
    p_all.set_defaults(func=cmd_run_all)
    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
