#!/usr/bin/env python3
"""Generate sidecar agents/openai.yaml UI metadata for every FrootAI skill.

Additive + idempotent: reads each SKILL.md frontmatter, derives display_name,
short_description, and default_prompt, and writes agents/openai.yaml alongside
the skill. Never edits or deletes SKILL.md. Never overwrites an existing
agents/openai.yaml unless --force is passed.

Cross-client portable: emits the standard `interface:` block (VS Code, Codex,
Cursor all read agents/openai.yaml).

Usage:
    python scripts/generate-skill-ui-metadata.py [--force] [--dry-run] [roots...]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Acronyms that should stay upper-cased in display names (enterprise polish).
ACRONYMS = {
    "ai", "api", "rag", "sql", "nosql", "ml", "mcp", "rbac", "aks", "ci", "cd",
    "ui", "ux", "pr", "gdpr", "pii", "owasp", "llm", "sdk", "cli", "avm", "etl",
    "ru", "iac", "vm", "db", "json", "yaml", "html", "css", "ssl", "tls", "jwt",
    "kql", "adr", "prd", "gtm", "pm", "qa", "id", "url", "uri", "io", "os",
    "aspnet", "phi4", "fai", "vnet", "dns", "http", "https", "grpc", "tcp",
}
# Tokens with non-trivial casing (not simple upper-case).
CASE_MAP = {
    "openai": "OpenAI",
    "powerbi": "PowerBI",
    "graphql": "GraphQL",
    "postgresql": "PostgreSQL",
    "mysql": "MySQL",
    "nextjs": "Next.js",
    "fastapi": "FastAPI",
    "github": "GitHub",
    "gitflow": "GitFlow",
    "openapi": "OpenAPI",
}
# Words to drop from the front of a display name (the FrootAI prefix family).
LEADING_NOISE = {"fai", "deploy", "evaluate", "tune"}

ROOTS_DEFAULT = [
    "skills",
    "solution-plays",
]


def parse_frontmatter(text: str) -> dict[str, str]:
    """Extract name + description from a SKILL.md frontmatter block.

    Tolerates files that open with `---` but omit the closing fence: in that
    case the frontmatter is taken to end at the first blank line or the first
    Markdown heading. SKILL.md files are never modified.
    """
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end != -1:
        block = text[3:end]
    else:
        # No closing fence — read key: value lines until a blank line/heading.
        collected_lines: list[str] = []
        started = False
        for raw in text[3:].splitlines():
            if raw.strip() == "":
                if started:
                    break
                continue  # skip leading blank line(s) after the opening fence
            if raw.lstrip().startswith("#"):
                break
            started = True
            collected_lines.append(raw)
        block = "\n".join(collected_lines)

    fields: dict[str, str] = {}
    lines = block.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^(\w[\w-]*):\s*(.*)$", line)
        if not m:
            i += 1
            continue
        key, val = m.group(1), m.group(2).strip()
        if val in ("|", ">", "|-", ">-", "|+", ">+"):
            # Block scalar — gather indented continuation lines.
            collected: list[str] = []
            i += 1
            while i < len(lines) and (lines[i].startswith((" ", "\t")) or lines[i] == ""):
                collected.append(lines[i].strip())
                i += 1
            fields[key] = " ".join(s for s in collected if s).strip()
            continue
        fields[key] = val.strip().strip("'\"")
        i += 1
    return fields


def first_sentence(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    # Split on the first sentence terminator followed by a space/end.
    m = re.search(r"(.+?[.!?])(\s|$)", text)
    sentence = m.group(1).strip() if m else text
    return sentence


def title_case(name: str) -> str:
    # Drop a single leading noise token (fai / deploy / evaluate / tune),
    # plus a leading numeric play index like "01".
    parts = re.split(r"[-_]", name)
    while parts and (parts[0].lower() in LEADING_NOISE or parts[0].isdigit()):
        # Keep deploy/evaluate/tune verbs only if nothing else remains.
        if parts[0].lower() in {"deploy", "evaluate", "tune"} and len(parts) == 1:
            break
        parts.pop(0)
    words = []
    for p in parts:
        if not p:
            continue
        if p.lower() in CASE_MAP:
            words.append(CASE_MAP[p.lower()])
        elif p.lower() in ACRONYMS:
            words.append(p.upper())
        elif p.isdigit():
            words.append(p)
        else:
            words.append(p[:1].upper() + p[1:])
    return " ".join(words) if words else name


def shorten(text: str, limit: int = 80) -> str:
    text = first_sentence(text)
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    if " " in cut:
        cut = cut[: cut.rfind(" ")]
    return cut.rstrip(" ,;:.—-") + "\u2026"


def yaml_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace('"', '\\"')


def build_metadata(name: str, description: str) -> dict[str, str]:
    display = title_case(name)
    short = shorten(description, 80)
    prompt = first_sentence(description)
    # Make the default prompt a one-click, demoable instruction.
    prompt = re.sub(r"\s+", " ", prompt).strip().rstrip(" .—-")
    if len(prompt) > 160:
        prompt = shorten(description, 160).rstrip("\u2026").rstrip(" —-")
    return {
        "display_name": display,
        "short_description": short,
        "default_prompt": prompt,
    }


def render_yaml(meta: dict[str, str], source_name: str) -> str:
    return (
        "# Generated by scripts/generate-skill-ui-metadata.py — UI metadata for skill chips.\n"
        f"# Derived from SKILL.md frontmatter (name: {source_name}). Safe to delete or edit.\n"
        "interface:\n"
        f'  display_name: "{yaml_escape(meta["display_name"])}"\n'
        f'  short_description: "{yaml_escape(meta["short_description"])}"\n'
        f'  default_prompt: "{yaml_escape(meta["default_prompt"])}"\n'
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("roots", nargs="*", default=ROOTS_DEFAULT)
    ap.add_argument("--force", action="store_true", help="overwrite existing agents/openai.yaml")
    ap.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    args = ap.parse_args()

    base = Path(__file__).resolve().parent.parent  # frootai/
    roots = args.roots or ROOTS_DEFAULT

    created = skipped = overwritten = errors = 0
    for root in roots:
        for skill_md in sorted((base / root).rglob("SKILL.md")):
            try:
                text = skill_md.read_text(encoding="utf-8-sig")
            except Exception as e:  # noqa: BLE001
                print(f"ERROR read {skill_md}: {e}", file=sys.stderr)
                errors += 1
                continue
            fm = parse_frontmatter(text)
            name = fm.get("name")
            desc = fm.get("description")
            if not name or not desc:
                print(f"SKIP  no name/description: {skill_md.relative_to(base)}")
                skipped += 1
                continue

            out = skill_md.parent / "agents" / "openai.yaml"
            exists = out.exists()
            if exists and not args.force:
                skipped += 1
                continue

            meta = build_metadata(name, desc)
            content = render_yaml(meta, name)
            if args.dry_run:
                print(f"DRY   {out.relative_to(base)} -> {meta['display_name']}")
            else:
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_text(content, encoding="utf-8")
            if exists:
                overwritten += 1
            else:
                created += 1

    print(
        f"\nDone. created={created} overwritten={overwritten} "
        f"skipped(existing/invalid)={skipped} errors={errors}"
    )
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
