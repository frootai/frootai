/**
 * [Z4.1] Tests — agent compiler profile + frontmatter-preservation contract.
 *
 * Proves the AGENT profile declares the load-bearing keys (tools/model/waf),
 * that a real `.agent.md` compiled through the pipeline keeps its frontmatter
 * byte-for-byte, and that the assertion FAILS the moment a Lean drops a tool or
 * mutates the frontmatter block.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_PROFILE,
  INSTRUCTION_PROFILE,
  HOOK_PROFILE,
  getProfile,
  extractFrontmatter,
  assertProfilePreserved,
  hookEvents,
  assertHookManifestPreserved,
} from "./profiles.js";
import { compile } from "./index.js";

const AGENT_MD = `---
description: "A2A protocol specialist for agent interop."
name: "FAI A2A Expert"
tools:
  - "codebase"
  - "terminal"
model: ["gpt-4o", "gpt-4o-mini"]
waf:
  - "reliability"
  - "security"
plays:
  - "07-multi-agent-service"
---

# FAI A2A Expert

Agent-to-Agent protocol specialist. This paragraph is ordinary prose that the
compressor is free to shorten, because it carries no structural fields and no
behaviour-bearing guardrails — just descriptive narration about the agent.

## Core Expertise

- **A2A protocol**: JSON-RPC 2.0 over HTTP, AgentCard discovery
- **Task lifecycle**: pending → working → completed
`;

test("[Z4.1] AGENT_PROFILE declares the load-bearing keys + source extension", () => {
  assert.equal(AGENT_PROFILE.type, "agent");
  assert.equal(AGENT_PROFILE.sourceExt, ".agent.md");
  for (const key of ["tools", "model", "waf"]) {
    assert.ok(AGENT_PROFILE.preservedFrontmatterKeys.includes(key), `expected ${key} preserved`);
  }
});

test("[Z4.1] getProfile resolves the agent profile and is null for unknown types", () => {
  assert.equal(getProfile("agent"), AGENT_PROFILE);
  assert.equal(getProfile("nope"), null);
});

test("[Z4.1] extractFrontmatter returns the block, or '' when absent", () => {
  assert.ok(extractFrontmatter(AGENT_MD).startsWith("---\n"));
  assert.ok(extractFrontmatter(AGENT_MD).includes("model: [\"gpt-4o\", \"gpt-4o-mini\"]"));
  assert.equal(extractFrontmatter("# no frontmatter here\n"), "");
});

test("[Z4.1] a real compile() preserves the agent frontmatter byte-for-byte", () => {
  const { lean } = compile(AGENT_MD, { type: "agent" });
  const result = assertProfilePreserved(AGENT_PROFILE, AGENT_MD, lean);
  assert.equal(result.ok, true, `expected preserved, got ${result.reason}`);
  assert.equal(result.frontmatterPreserved, true);
  assert.deepEqual(result.missingKeys, []);
  // The full frontmatter block (tools/model/waf included) is identical.
  assert.equal(extractFrontmatter(lean), extractFrontmatter(AGENT_MD));
});

test("[Z4.1] assertion FAILS when a Lean drops a preserved key (tools)", () => {
  const droppedTools = AGENT_MD.replace(/tools:\n  - "codebase"\n  - "terminal"\n/, "");
  const result = assertProfilePreserved(AGENT_PROFILE, AGENT_MD, droppedTools);
  assert.equal(result.ok, false);
  assert.equal(result.frontmatterPreserved, false);
  assert.ok(result.missingKeys.includes("tools"));
});

test("[Z4.1] assertion FAILS when the frontmatter block is mutated", () => {
  const mutated = AGENT_MD.replace('model: ["gpt-4o", "gpt-4o-mini"]', 'model: ["gpt-3.5"]');
  const result = assertProfilePreserved(AGENT_PROFILE, AGENT_MD, mutated);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "frontmatter-block-mutated");
});

// ── [Z4.2] instruction profile ──────────────────────────────────────────────

const INSTRUCTION_MD = `---
description: "Accessibility standards — WCAG 2.2 AA compliance."
applyTo: "**/*.tsx, **/*.html, **/*.vue"
waf:
  - "responsible-ai"
  - "reliability"
---

# Accessibility

Use semantic HTML and ARIA roles. This paragraph is ordinary prose describing
the rules, free for the compressor to shorten since it carries no frontmatter
and no behaviour-bearing guardrail — just narration.

## Rules

- Provide alt text for images
- Ensure 4.5:1 contrast for body text
`;

test("[Z4.2] INSTRUCTION_PROFILE declares applyTo + source extension", () => {
  assert.equal(INSTRUCTION_PROFILE.type, "instruction");
  assert.equal(INSTRUCTION_PROFILE.sourceExt, ".instructions.md");
  assert.ok(INSTRUCTION_PROFILE.preservedFrontmatterKeys.includes("applyTo"));
});

test("[Z4.2] getProfile resolves the instruction profile", () => {
  assert.equal(getProfile("instruction"), INSTRUCTION_PROFILE);
});

test("[Z4.2] a real compile() preserves the instruction applyTo glob byte-for-byte", () => {
  const { lean } = compile(INSTRUCTION_MD, { type: "instruction" });
  const result = assertProfilePreserved(INSTRUCTION_PROFILE, INSTRUCTION_MD, lean);
  assert.equal(result.ok, true, `expected preserved, got ${result.reason}`);
  assert.equal(extractFrontmatter(lean), extractFrontmatter(INSTRUCTION_MD));
  assert.ok(extractFrontmatter(lean).includes('applyTo: "**/*.tsx, **/*.html, **/*.vue"'));
});

test("[Z4.2] assertion FAILS when a Lean drops applyTo", () => {
  const dropped = INSTRUCTION_MD.replace(/applyTo: ".*"\n/, "");
  const result = assertProfilePreserved(INSTRUCTION_PROFILE, INSTRUCTION_MD, dropped);
  assert.equal(result.ok, false);
  assert.ok(result.missingKeys.includes("applyTo"));
});

// ── [Z4.3] hook profile ──────────────────────────────────────────────────────

const HOOK_MANIFEST = `{
  "version": 1,
  "hooks": {
    "Stop": [
      { "type": "command", "command": "bash hooks/fai-cost-tracker/track-cost.sh", "timeout": 10, "env": { "COST_MODE": "log" } }
    ]
  }
}`;

test("[Z4.3] HOOK_PROFILE declares the README source + hooks.json manifest", () => {
  assert.equal(HOOK_PROFILE.type, "hook");
  assert.equal(HOOK_PROFILE.sourceExt, "README.md");
  assert.equal(HOOK_PROFILE.manifestFile, "hooks.json");
  // README hook docs have no frontmatter — nothing to preserve there.
  assert.deepEqual(HOOK_PROFILE.preservedFrontmatterKeys, []);
});

test("[Z4.3] getProfile resolves the hook profile", () => {
  assert.equal(getProfile("hook"), HOOK_PROFILE);
});

test("[Z4.3] hookEvents extracts the event names; tolerant of bad JSON", () => {
  assert.deepEqual(hookEvents(HOOK_MANIFEST), ["Stop"]);
  assert.deepEqual(hookEvents("not json"), []);
});

test("[Z4.3] manifest preserved when identical (events + config survive)", () => {
  const result = assertHookManifestPreserved(HOOK_MANIFEST, HOOK_MANIFEST);
  assert.equal(result.ok, true);
  assert.deepEqual(result.events, ["Stop"]);
  assert.deepEqual(result.missingEvents, []);
});

test("[Z4.3] assertion FAILS when an event is dropped", () => {
  const result = assertHookManifestPreserved(HOOK_MANIFEST, `{ "version": 1, "hooks": {} }`);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "event-dropped");
  assert.ok(result.missingEvents.includes("Stop"));
});

test("[Z4.3] assertion FAILS when the event config is mutated", () => {
  const mutated = HOOK_MANIFEST.replace('"timeout": 10', '"timeout": 99');
  const result = assertHookManifestPreserved(HOOK_MANIFEST, mutated);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "config-mutated");
});
