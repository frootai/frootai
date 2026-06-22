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
  getProfile,
  extractFrontmatter,
  assertProfilePreserved,
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
  assert.equal(getProfile("instruction"), null);
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
