"""FrootAI CLI — Python edition. Offline-first, queries bundled knowledge."""

import argparse
import sys
from frootai import __version__
from frootai.client import FrootAI
from frootai.plays import SolutionPlay


def cmd_plays(args):
    """List solution plays."""
    if args.layer:
        plays = SolutionPlay.by_layer(args.layer.upper())
    elif args.ready:
        plays = SolutionPlay.ready()
    else:
        plays = SolutionPlay.all()
    print(f"\n  FrootAI Solution Plays ({len(plays)} shown)\n")
    for p in plays:
        status = "READY" if p.status == "Ready" else "SKEL "
        print(f"  [{status}] {p.id} {p.name} ({p.complexity}) — {p.layer}")
    print()


def cmd_search(args):
    """Search knowledge base."""
    client = FrootAI()
    results = client.search(args.query, max_results=args.limit)
    if not results:
        print(f"\n  No results for '{args.query}'\n")
        return
    print(f"\n  Search: '{args.query}' — {len(results)} results\n")
    for r in results:
        print(f"  [{r['module_id']}] {r['title']} (layer: {r['layer']}, hits: {r['relevance']})")
        for excerpt in r["excerpts"][:1]:
            print(f"    {excerpt[:120]}...")
        print()


def cmd_modules(args):
    """List all modules."""
    client = FrootAI()
    modules = client.list_modules()
    print(f"\n  FrootAI Knowledge Modules ({len(modules)} total)\n")
    for m in modules:
        size_kb = m["content_length"] // 1024
        print(f"  {m['emoji']} {m['id']} {m['title']} ({m['layer']}, {size_kb}KB)")
    print()


def cmd_glossary(args):
    """Search glossary terms."""
    client = FrootAI()
    if args.term:
        result = client.lookup_term(args.term)
        if result:
            print(f"\n  {result['term']}")
            print(f"  {result['definition']}")
            print(f"  Source: {result['source_module']} — {result['source_title']}\n")
        else:
            results = client.search_glossary(args.term, max_results=5)
            if results:
                print(f"\n  No exact match. Similar terms:\n")
                for r in results:
                    print(f"  {r['term']}: {r['definition'][:80]}...")
            else:
                print(f"\n  Term '{args.term}' not found.\n")
    else:
        print(f"\n  Glossary: {client.glossary_count} terms")
        print("  Use: frootai glossary <term>\n")


def cmd_cost(args):
    """Estimate costs for a play."""
    client = FrootAI()
    result = client.estimate_cost(args.play, args.scale)
    if "error" in result:
        print(f"\n  {result['error']}")
        print("  Available plays: " + ", ".join(
            f"{p.id}-{p.name.lower().replace(' ', '-')}" for p in SolutionPlay.ready()[:10]
        ))
        print()
        return
    print(f"\n  Cost Estimate: Play {result['play']} ({result['scale']} scale)")
    print(f"  Monthly Total: ${result['monthly_total']:,} {result['currency']}\n")
    for svc, cost in result["breakdown"].items():
        print(f"    {svc:<30} ${cost:>6,}")
    print()


def cmd_scaffold(args):
    """Scaffold a solution play."""
    client = FrootAI()
    result = client.scaffold_play(args.play, project_name=args.name or "", dry_run=args.dry_run)
    if "error" in result:
        print(f"\n  {result['error']}\n")
        return
    label = "Preview" if args.dry_run else "Scaffolded"
    print(f"\n  {label}: {result['play']} ({result['file_count']} files)\n")
    key = "files" if args.dry_run else "files_created"
    for f in result[key]:
        print(f"    {f}")
    if not args.dry_run and "next_steps" in result:
        print("\n  Next steps:")
        for s in result["next_steps"]:
            print(f"    {s}")
    print()


def cmd_wire(args):
    """Wire a solution play (generate fai-manifest.json)."""
    import json as _json
    client = FrootAI()
    result = client.wire_play(args.play)
    if "error" in result:
        print(f"\n  {result['error']}\n")
        return
    print(f"\n  Wired: {result['play']}")
    print(f"  Manifest:\n{_json.dumps(result, indent=2)}\n")


def cmd_validate(args):
    """Validate a fai-manifest.json."""
    import json as _json
    try:
        with open(args.file, "r") as f:
            manifest = _json.load(f)
    except (FileNotFoundError, _json.JSONDecodeError) as e:
        print(f"\n  Error: {e}\n")
        return
    client = FrootAI()
    result = client.validate_manifest(manifest)
    status = "✅ VALID" if result["valid"] else "❌ INVALID"
    print(f"\n  {status}")
    for e in result["errors"]:
        print(f"    ❌ {e}")
    for w in result["warnings"]:
        print(f"    ⚠️  {w}")
    print()


def cmd_evaluate(args):
    """Run evaluation check."""
    from frootai.evaluation import Evaluator
    ev = Evaluator()
    scores = {}
    for pair in args.scores:
        k, v = pair.split("=")
        scores[k.strip()] = float(v.strip())
    print(f"\n{ev.summary(scores)}")


def cmd_waf(args):
    """Get WAF guidance."""
    client = FrootAI()
    result = client.get_waf_guidance(args.pillar)
    if "error" in result:
        print(f"\n  {result['error']}")
        print(f"  Available: {', '.join(result['available'])}\n")
        return
    print(f"\n  {result['title']} — WAF Guidance\n")
    for p in result["principles"]:
        print(f"    • {p}")
    print()


def cmd_primitives(args):
    """Show primitives catalog."""
    client = FrootAI()
    cat = client.primitives_catalog()
    print(f"\n  FAI Primitives Catalog ({cat['total']} total)\n")
    for name, info in cat["categories"].items():
        print(f"    {name:<15} {info['count']:>4}  {info['path']}")
    print()


def cmd_learning(args):
    """Get learning path."""
    client = FrootAI()
    result = client.get_learning_path(args.topic)
    if "available_paths" in result:
        print(f"\n  Available paths: {', '.join(result['available_paths'])}\n")
        return
    print(f"\n  Learning Path: {result['title']}\n")
    print(f"    Modules: {', '.join(result['modules'])}")
    print(f"    Plays:   {', '.join(result['plays'])}\n")


def main():
    """Entry point for `frootai` Python CLI."""
    parser = argparse.ArgumentParser(
        prog="frootai",
        description="FrootAI — The open glue for AI architecture",
        epilog="Website: https://frootai.dev",
    )
    parser.add_argument("-v", "--version", action="version", version=f"frootai {__version__}")
    sub = parser.add_subparsers(dest="command")

    # plays
    p_plays = sub.add_parser("plays", help="List solution plays")
    p_plays.add_argument("--layer", help="Filter by FROOT layer (F, R, O_ORCH, O_OPS, T)")
    p_plays.add_argument("--ready", action="store_true", help="Show only production-ready plays")

    # search
    p_search = sub.add_parser("search", help="Search knowledge base")
    p_search.add_argument("query", help="Search query")
    p_search.add_argument("--limit", type=int, default=5, help="Max results (default: 5)")

    # modules
    sub.add_parser("modules", help="List all knowledge modules")

    # glossary
    p_glossary = sub.add_parser("glossary", help="Look up a glossary term")
    p_glossary.add_argument("term", nargs="?", help="Term to look up")

    # cost
    p_cost = sub.add_parser("cost", help="Estimate Azure costs for a play")
    p_cost.add_argument("play", help="Play ID (e.g. 01-enterprise-rag)")
    p_cost.add_argument("--scale", default="dev", choices=["dev", "prod"], help="Scale tier")

    # scaffold
    p_scaffold = sub.add_parser("scaffold", help="Scaffold a solution play")
    p_scaffold.add_argument("play", help="Play ID (e.g. 01)")
    p_scaffold.add_argument("--name", help="Project name")
    p_scaffold.add_argument("--dry-run", action="store_true", help="Preview without creating files")

    # wire
    p_wire = sub.add_parser("wire", help="Wire a play (generate fai-manifest.json)")
    p_wire.add_argument("play", help="Play ID (e.g. 01)")

    # validate
    p_validate = sub.add_parser("validate", help="Validate a fai-manifest.json")
    p_validate.add_argument("file", help="Path to fai-manifest.json")

    # evaluate
    p_eval = sub.add_parser("evaluate", help="Run evaluation (e.g. evaluate groundedness=4.5 relevance=3.8)")
    p_eval.add_argument("scores", nargs="+", help="metric=score pairs")

    # waf
    p_waf = sub.add_parser("waf", help="WAF pillar guidance")
    p_waf.add_argument("pillar", help="Pillar name (reliability, security, cost-optimization, etc.)")

    # primitives
    sub.add_parser("primitives", help="Show FAI primitives catalog")

    # learning-path
    p_learn = sub.add_parser("learning-path", help="Get learning path for a topic")
    p_learn.add_argument("topic", help="Topic (rag, agents, security, mlops, cost)")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    commands = {
        "plays": cmd_plays,
        "search": cmd_search,
        "modules": cmd_modules,
        "glossary": cmd_glossary,
        "cost": cmd_cost,
        "scaffold": cmd_scaffold,
        "wire": cmd_wire,
        "validate": cmd_validate,
        "evaluate": cmd_evaluate,
        "waf": cmd_waf,
        "primitives": cmd_primitives,
        "learning-path": cmd_learning,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
