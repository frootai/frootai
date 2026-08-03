"""Validate Play 08's offline ownership and ALM contract without simulating outcomes."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


REQUIRED_FIELDS = {"id", "category", "question", "ground_truth"}
REQUIRED_CATEGORIES = {"ownership", "repository_boundary", "alm", "authority", "evidence"}


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as stream:
        return json.load(stream)


def load_cases(path: Path) -> list[dict]:
    cases = []
    with path.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            item = json.loads(line)
            missing = REQUIRED_FIELDS - item.keys()
            if missing:
                raise ValueError(f"{path}:{line_number} missing {sorted(missing)}")
            cases.append(item)
    return cases


def validate_contract(play_root: Path, test_set: Path) -> dict:
    platform = load_json(play_root / "config" / "power-platform.json")
    guardrails = load_json(play_root / "config" / "guardrails.json")
    cases = load_cases(test_set)

    categories = {case["category"] for case in cases}
    errors = []
    if len(cases) < 5:
        errors.append("at least five factual cases are required")
    if not REQUIRED_CATEGORIES.issubset(categories):
        errors.append("ownership, repository, ALM, authority, and evidence cases are required")
    if platform.get("authority", {}).get("platform") != "copilot_studio_power_platform":
        errors.append("Power Platform authority is not explicit")
    if platform.get("alm", {}).get("production_artifact") != "managed_solution":
        errors.append("managed solution promotion is not explicit")
    if platform.get("evidence_boundary", {}).get("production_import_evidenced") is not False:
        errors.append("production import evidence must fail closed")
    if guardrails.get("consequential_actions", {}).get("prompt_authorization_allowed") is not False:
        errors.append("conversation text must not authorize consequential actions")

    return {
        "play": "08-copilot-studio-bot",
        "status": "contract_valid" if not errors else "contract_invalid",
        "promotion_allowed": False,
        "runtime_evaluation_performed": False,
        "case_count": len(cases),
        "categories": sorted(categories),
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--test-set", default="evaluation/test-set.jsonl")
    parser.add_argument("--output")
    args = parser.parse_args()

    play_root = Path(__file__).resolve().parent.parent
    test_set = Path(args.test_set)
    if not test_set.is_absolute():
        test_set = play_root / test_set
    result = validate_contract(play_root, test_set)
    rendered = json.dumps(result, indent=2)
    if args.output:
        output = Path(args.output)
        if not output.is_absolute():
            output = play_root / output
        output.write_text(f"{rendered}\n", encoding="utf-8")
    print(rendered)
    return 0 if not result["errors"] else 1


if __name__ == "__main__":
    raise SystemExit(main())