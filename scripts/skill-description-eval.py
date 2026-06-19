#!/usr/bin/env python3
"""Skill description eval harness for FrootAI.

Two modes, both offline + deterministic (no API cost), so they run in CI:

  lint  — score every skill's `description` against the agentskills.io triggering
          rubric (imperative "use when" cue, context/pushiness, specificity,
          action-verb lead, length, no template artifacts). Ranks the weakest
          descriptions — the optimization targets.

  eval  — given a labeled query set (should_trigger true/false), compute a
          deterministic lexical trigger-rate proxy per skill and report
          accuracy. A real-LLM backend can be slotted in later behind --backend.

Never edits SKILL.md. Reads frontmatter only.

Usage:
  python scripts/skill-description-eval.py lint [--threshold 60] [--bottom 30] [--json out.json]
  python scripts/skill-description-eval.py eval --queries queries.json --skill <name>
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent  # frootai/
ROOTS = ["skills", "solution-plays"]

# Action verbs a strong description tends to lead with.
ACTION_VERBS = {
    "generate", "create", "configure", "deploy", "design", "build", "implement",
    "set", "scaffold", "provision", "wire", "analyze", "optimize", "review",
    "run", "add", "integrate", "conduct", "select", "orchestrate", "diagnose",
    "query", "back", "audit", "enforce", "evaluate", "tune", "migrate", "write",
}
# Explicit triggering cues the agentskills.io guide recommends.
TRIGGER_CUES = [
    "use this skill when", "use when", "use this skill", "use for",
    "when the user", "when you", "invoke when", "trigger when", "apply when",
]
CONTEXT_CUES = ["when ", "even if", "including", "such as", "for example", "whether"]
TEMPLATE_ARTIFACT = re.compile(r"procedure for name:|^name:\s|for name:\s", re.IGNORECASE)


def parse_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end != -1:
        block = text[3:end]
    else:
        lines, started = [], False
        for raw in text[3:].splitlines():
            if raw.strip() == "":
                if started:
                    break
                continue
            if raw.lstrip().startswith("#"):
                break
            started = True
            lines.append(raw)
        block = "\n".join(lines)

    fields: dict[str, str] = {}
    lines = block.splitlines()
    i = 0
    while i < len(lines):
        m = re.match(r"^(\w[\w-]*):\s*(.*)$", lines[i])
        if not m:
            i += 1
            continue
        key, val = m.group(1), m.group(2).strip()
        if val in ("|", ">", "|-", ">-", "|+", ">+"):
            collected, i = [], i + 1
            while i < len(lines) and (lines[i].startswith((" ", "\t")) or lines[i] == ""):
                collected.append(lines[i].strip())
                i += 1
            fields[key] = " ".join(s for s in collected if s).strip()
            continue
        fields[key] = val.strip().strip("'\"")
        i += 1
    return fields


def iter_skills():
    for root in ROOTS:
        for skill_md in sorted((BASE / root).rglob("SKILL.md")):
            try:
                text = skill_md.read_text(encoding="utf-8-sig")
            except Exception:
                continue
            fm = parse_frontmatter(text)
            name, desc = fm.get("name"), fm.get("description")
            if name and desc:
                yield name, " ".join(desc.split()), skill_md


def sensei_tier(desc: str) -> str:
    """Microsoft 'Sensei' description-quality tier (adapted to description-level
    signals): Low → Medium → Medium-High → High based on USE FOR / DO NOT USE
    FOR / Triggers structure."""
    low = desc.lower()
    use_for = "use for:" in low
    not_for = "do not use for:" in low
    triggers = "triggers:" in low
    has_cue = use_for or "use this skill when" in low or "use when" in low
    if use_for and not_for and triggers:
        return "High"
    if use_for and not_for:
        return "Medium-High"
    if len(desc) > 150 and has_cue:
        return "Medium"
    return "Low"


def score_description(name: str, desc: str) -> tuple[int, list[str]]:
    """Return (0-100 score, list of reasons for lost points)."""
    score, reasons = 0, []
    low = desc.lower()

    # 1. Explicit triggering cue (25) — the biggest lever per optimizing-descriptions.
    if any(cue in low for cue in TRIGGER_CUES):
        score += 25
    else:
        reasons.append("no explicit trigger cue ('Use this skill when…')")

    # 2. Context / pushiness (20) — lists when it applies.
    if sum(cue in low for cue in CONTEXT_CUES) >= 1:
        score += 20
    else:
        reasons.append("no context/'when' phrasing (not 'pushy')")

    # 3. Action-verb lead (15).
    first = re.split(r"[\s,]", desc.strip(), maxsplit=1)[0].lower().rstrip(".")
    if first in ACTION_VERBS:
        score += 15
    else:
        reasons.append(f"doesn't lead with an action verb ('{first}')")

    # 4. Length band (20): 60–1024 ideal; <60 weak; >1024 invalid.
    n = len(desc)
    if n > 1024:
        reasons.append(f"over 1024-char spec limit ({n})")
    elif n < 60:
        score += 8
        reasons.append(f"too short ({n} chars) — under-specified")
    else:
        score += 20

    # 5. Specificity (10): enough distinct meaningful words.
    words = {w for w in re.findall(r"[a-z][a-z0-9\-]{2,}", low)}
    if len(words) >= 8:
        score += 10
    else:
        reasons.append(f"low specificity ({len(words)} distinct words)")

    # 6. No template artifact (10).
    if TEMPLATE_ARTIFACT.search(desc) or name.lower() in low:
        reasons.append("contains template artifact / repeats skill name")
    else:
        score += 10

    return score, reasons


def cmd_lint(args):
    rows = []
    tiers = {"Low": 0, "Medium": 0, "Medium-High": 0, "High": 0}
    for name, desc, path in iter_skills():
        score, reasons = score_description(name, desc)
        tier = sensei_tier(desc)
        tiers[tier] += 1
        rows.append({"name": name, "score": score, "tier": tier, "reasons": reasons,
                     "description": desc, "path": str(path.relative_to(BASE))})
    rows.sort(key=lambda r: r["score"])
    total = len(rows)
    below = [r for r in rows if r["score"] < args.threshold]
    mean = round(sum(r["score"] for r in rows) / total, 1) if total else 0

    print(f"Scored {total} skill descriptions. Mean score: {mean}/100.")
    print(f"Below threshold ({args.threshold}): {len(below)} ({round(len(below)/total*100)}%)")
    print(f"Sensei tiers: High={tiers['High']} Medium-High={tiers['Medium-High']} "
          f"Medium={tiers['Medium']} Low={tiers['Low']}\n")
    print(f"--- Weakest {min(args.bottom, total)} descriptions (optimization targets) ---")
    for r in rows[: args.bottom]:
        print(f"  [{r['score']:>3}] ({r['tier']}) {r['name']}")
        print(f"        why: {'; '.join(r['reasons'])}")

    if args.json:
        out = BASE / args.json
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({"mean": mean, "total": total,
                                   "below_threshold": len(below), "sensei_tiers": tiers,
                                   "skills": rows},
                                  indent=2) + "\n", encoding="utf-8")
        print(f"\nFull report written to {out.relative_to(BASE)}")
    return 0


def trigger_proxy(name: str, desc: str, query: str) -> float:
    """Deterministic lexical trigger proxy: Jaccard-ish overlap of query terms
    with the skill's name+description vocabulary. Stand-in for an LLM judge."""
    def terms(s: str) -> set[str]:
        return {w for w in re.findall(r"[a-z][a-z0-9\-]{2,}", s.lower())}
    skill_terms = terms(name.replace("-", " ")) | terms(desc)
    q = terms(query)
    if not q:
        return 0.0
    return len(q & skill_terms) / len(q)


def cmd_eval(args):
    queries = json.loads((BASE / args.queries).read_text(encoding="utf-8"))
    target = None
    for name, desc, _ in iter_skills():
        if name == args.skill:
            target = (name, desc)
            break
    if not target:
        print(f"Skill '{args.skill}' not found", file=sys.stderr)
        return 1
    name, desc = target
    tp = fp = tn = fn = 0
    for q in queries:
        rate = trigger_proxy(name, desc, q["query"])
        fired = rate >= args.threshold
        if q["should_trigger"] and fired:
            tp += 1
        elif q["should_trigger"] and not fired:
            fn += 1
        elif not q["should_trigger"] and fired:
            fp += 1
        else:
            tn += 1
    total = tp + fp + tn + fn
    acc = round((tp + tn) / total, 2) if total else 0
    print(f"Skill: {name} | backend: lexical-proxy | threshold {args.threshold}")
    print(f"  queries={total}  TP={tp} FP={fp} TN={tn} FN={fn}  accuracy={acc}")
    print("  (Slot a real-LLM backend behind --backend to replace the lexical proxy.)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p_lint = sub.add_parser("lint", help="score all skill descriptions")
    p_lint.add_argument("--threshold", type=int, default=60)
    p_lint.add_argument("--bottom", type=int, default=30)
    p_lint.add_argument("--json", default=None)
    p_lint.set_defaults(func=cmd_lint)
    p_eval = sub.add_parser("eval", help="trigger-rate eval for one skill")
    p_eval.add_argument("--queries", required=True)
    p_eval.add_argument("--skill", required=True)
    p_eval.add_argument("--threshold", type=float, default=0.25)
    p_eval.set_defaults(func=cmd_eval)
    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
