// @ts-check
"use strict";

const TERMINAL_EVENTS = new Set(["turn.completed", "turn.failed", "turn.cancelled"]);
const PRODUCTIVE_EVENTS = new Set(["model.delta", "retrieval.source", "tool.progress", "tool.completed", "artifact.created", "evidence.created"]);
const AUTHORITY_RANK = Object.freeze({ observe: 0, propose: 1, "local-write": 2, "external-mutation": 3 });
const ACTION_CONTRACTS = Object.freeze({
  "ACT-001": { contract: "APR-ACT-001-NONE-V1", risk: "read", authority: "observe", bindings: [], profile: false },
  "ACT-002": { contract: "APR-ACT-002-TRUSTED-ROOT-V1", risk: "read-sensitive", authority: "observe", bindings: ["trusted-root", "bounded-scope"], profile: false },
  "ACT-003": { contract: "APR-ACT-003-CONTEXT-EGRESS-V1", risk: "data-egress", authority: "propose", bindings: ["principal", "organization", "purpose", "destination", "manifest-digest", "turn", "expiry", "one-operation"], profile: false },
  "ACT-004": { contract: "APR-ACT-004-MCP-READ-V1", risk: "read-sensitive", authority: "observe", bindings: ["principal", "organization", "destination", "tenant-scope", "session", "consent-digest", "turn", "tool", "input", "risk", "policy-version", "expiry", "one-operation"], profile: false },
  "ACT-005": { contract: "APR-ACT-005-LOCAL-PATCH-V1", risk: "local-write", authority: "local-write", bindings: ["principal", "action", "patch", "input", "cwd", "expiry", "one-operation"], profile: false },
  "ACT-006": { contract: "APR-ACT-006-LOCAL-COMMAND-V1", risk: "local-write", authority: "local-write", bindings: ["principal", "action", "executable", "argv", "cwd", "environment", "input", "expiry", "one-operation"], profile: false },
  "ACT-007": { contract: "APR-ACT-007-REMOTE-MUTATION-V1", risk: "external-mutation", authority: "external-mutation", bindings: ["principal", "action", "input", "profile", "expiry", "one-operation"], profile: true },
  "ACT-008": { contract: "APR-ACT-008-DEPLOY-V1", risk: "external-mutation", authority: "external-mutation", bindings: ["principal", "action", "input", "artifact", "profile", "expiry", "one-operation"], profile: true },
  "ACT-009": { contract: "APR-ACT-009-PUBLISH-V1", risk: "external-mutation", authority: "external-mutation", bindings: ["principal", "action", "input", "artifact", "channel", "profile", "expiry", "one-operation"], profile: true },
  "ACT-010": { contract: "APR-ACT-010-PROMOTE-V1", risk: "external-mutation", authority: "external-mutation", bindings: ["principal", "action", "input", "stage", "profile", "evidence-set", "expiry", "one-operation"], profile: true },
  "ACT-011": { contract: "APR-ACT-011-CLEANUP-V1", risk: "external-mutation", authority: "external-mutation", bindings: ["principal", "action", "input", "resource-set", "profile", "expiry", "one-operation"], profile: true },
  "ACT-012": { contract: "APR-ACT-012-DELETE-V1", risk: "destructive", authority: "external-mutation", bindings: ["principal", "action", "input", "resource-or-data-set", "legal-state", "profile", "expiry", "one-operation"], profile: true },
  "ACT-013": { contract: "APR-ACT-013-EXPORT-V1", risk: "data-egress", authority: "external-mutation", bindings: ["principal", "action", "input", "profile", "scope", "purpose", "destination", "expiry", "one-operation"], profile: true },
  "ACT-014": { contract: "APR-ACT-014-GOVERNANCE-V1", risk: "external-mutation", authority: "external-mutation", bindings: ["principal", "action", "input", "policy-diff", "scope", "profile", "expiry", "one-operation"], profile: true },
});
const APPROVAL_ACTIONS = new Set(Object.entries(ACTION_CONTRACTS).filter(([, value]) => value.bindings.length > 0).map(([actionId]) => actionId));
const EFFECT_ACTIONS = new Set(Object.entries(ACTION_CONTRACTS).filter(([, value]) => value.bindings.includes("one-operation")).map(([actionId]) => actionId));
const TOOL_ACTIONS = Object.freeze({
  "workspace.read": "ACT-001", "workspace.read-sensitive": "ACT-002", "context.transmit": "ACT-003", "mcp.read": "ACT-004",
  "workspace.write": "ACT-005", "local.command": "ACT-006", "remote.mutate": "ACT-007", "deployment.deploy": "ACT-008",
  "artifact.publish": "ACT-009", "readiness.promote": "ACT-010", "resource.cleanup": "ACT-011", "resource.delete": "ACT-012",
  "data.export": "ACT-013", "governance.change": "ACT-014",
});

function canonicalJson(value) {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError("invalid Unicode scalar string");
        index += 1;
      } else if (code >= 0xdc00 && code <= 0xdfff) throw new TypeError("invalid Unicode scalar string");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite canonical number");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${canonicalJson(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  throw new TypeError("unsupported canonical value");
}

function sameBindings(left, right) {
  return canonicalJson([...left].sort()) === canonicalJson([...right].sort());
}

function validateEventSemantics(event) {
  const errors = [];
  const action = ACTION_CONTRACTS[event.data.actionId];
  if (["tool.proposed", "approval.required", "approval.granted"].includes(event.type)) {
    if (!action || action.risk !== event.data.risk) errors.push("event-action-risk");
    if (TOOL_ACTIONS[event.data.toolName] !== event.data.actionId) errors.push("event-tool-action");
    if (action && (action.profile ? event.data.profileRef === null : event.data.profileRef !== null)) errors.push("event-action-profile");
    if (event.data.actionId === "ACT-004" ? (event.data.prerequisiteApprovalId == null || event.data.consentDigest == null) : (event.data.prerequisiteApprovalId != null || event.data.consentDigest != null)) errors.push("event-action-prerequisite");
  }
  if (["approval.required", "approval.granted"].includes(event.type)) {
    if (!APPROVAL_ACTIONS.has(event.data.actionId)) errors.push("event-nonapproval-action");
    if (!action || event.data.approvalContract !== action.contract) errors.push("event-approval-contract");
    if (!action || !sameBindings(event.data.bindings, action.bindings)) errors.push("event-approval-bindings");
    const egressBindings = event.data.actionId === "ACT-003" ? ["organization", "purpose", "destination"] : ["purpose", "destination"];
    if (event.data.risk === "data-egress" && (!event.data.egress || !egressBindings.every((binding) => event.data.bindings.includes(binding)))) errors.push("event-approval-egress-bindings");
    if (event.data.risk !== "data-egress" && event.data.egress !== null) errors.push("event-unexpected-egress-binding");
  }
  return errors;
}

function validateEventStream(events, { final = false } = {}) {
  const errors = [];
  let terminalSeen = false;
  let previousSequence = 0;
  let previousTime = -Infinity;
  const proposals = new Map();
  const decisions = new Map();
  const requirements = new Map();
  const grants = new Map();
  const approvalIds = new Set();
  const consumedApprovalIds = new Set();
  const completedAuthorizations = new Map();
  const startedTools = new Set();
  const finishedTools = new Set();
  let acceptedTurn = null;
  let modelActive = false;
  let modelStarted = false;
  let modelFinishReason = null;
  let retrievalActive = false;
  let retrievalSourceCount = 0;
  let cancellationObserved = false;
  let lifecycleFailureErrorId = null;
  let sessionLifecycleSeen = false;
  let turnActivitySeen = false;
  const first = events[0];
  for (const event of events) {
    errors.push(...validateEventSemantics(event));
    if (!first || event.sessionId !== first.sessionId || event.turnId !== first.turnId || event.requestId !== first.requestId) errors.push("stream-identity-mismatch");
    if (event.sequence !== previousSequence + 1) errors.push("stream-sequence-gap");
    if (Date.parse(event.occurredAt) < previousTime) errors.push("stream-time-regression");
    if (terminalSeen) errors.push("stream-post-terminal-event");
    const toolCallId = event.data.toolCallId;
    if (["session.started", "session.resumed"].includes(event.type)) {
      if (sessionLifecycleSeen) errors.push("stream-duplicate-session-lifecycle");
      if (turnActivitySeen) errors.push("stream-session-lifecycle-order");
      sessionLifecycleSeen = true;
    } else turnActivitySeen = true;
    if (cancellationObserved && (PRODUCTIVE_EVENTS.has(event.type) || (event.type === "model.completed" && event.data.finishReason !== "cancelled") || event.type === "retrieval.completed")) errors.push("stream-productive-event-after-cancellation");
    if (lifecycleFailureErrorId && (PRODUCTIVE_EVENTS.has(event.type) || event.type === "model.completed" || event.type === "retrieval.completed")) errors.push("stream-productive-event-after-failure");
    if (!acceptedTurn && !["session.started", "session.resumed", "turn.accepted"].includes(event.type)) errors.push("stream-work-before-turn-accepted");
    if (event.type === "turn.accepted") {
      if (acceptedTurn) errors.push("stream-duplicate-turn-accepted");
      acceptedTurn = event.data;
    }
    if (["context.accepted", "context.rejected", "context.compacted"].includes(event.type) && (!acceptedTurn || event.data.manifestDigest !== acceptedTurn.manifestDigest)) errors.push("stream-context-manifest-mismatch");
    if (event.type === "tool.proposed") {
      if (proposals.has(toolCallId)) errors.push("stream-duplicate-tool-proposal");
      const action = ACTION_CONTRACTS[event.data.actionId];
      if (!acceptedTurn || !action || AUTHORITY_RANK[action.authority] > AUTHORITY_RANK[acceptedTurn.authority]) errors.push("stream-proposal-exceeds-turn-authority");
      proposals.set(toolCallId, event.data);
    }
    if (event.type === "policy.decided") {
      if (!proposals.has(toolCallId)) errors.push("stream-policy-without-proposal");
      if (decisions.has(toolCallId)) errors.push("stream-duplicate-policy-decision");
      if (!acceptedTurn || event.data.policyVersion !== acceptedTurn.policyVersion) errors.push("stream-policy-turn-mismatch");
      decisions.set(toolCallId, event.data);
    }
    if (event.type === "approval.required") {
      const decision = decisions.get(toolCallId);
      const proposal = proposals.get(toolCallId);
      if (!decision || decision.decision !== "require-approval") errors.push("stream-approval-without-policy");
      if (!proposal || ["toolName", "actionId", "profileRef", "prerequisiteApprovalId", "consentDigest", "risk", "inputDigest"].some((field) => proposal[field] !== event.data[field])) errors.push("stream-requirement-proposal-mismatch");
      if (!acceptedTurn || acceptedTurn.principalDigest !== event.data.principalDigest || acceptedTurn.manifestDigest !== event.data.manifestDigest || acceptedTurn.policyVersion !== event.data.policyVersion) errors.push("stream-requirement-turn-mismatch");
      if (Date.parse(event.data.expiresAt) <= Date.parse(event.occurredAt)) errors.push("stream-approval-expired-at-request");
      if (requirements.has(toolCallId)) errors.push("stream-duplicate-approval-requirement");
      requirements.set(toolCallId, event.data);
    }
    if (event.type === "approval.granted") {
      const requirement = requirements.get(toolCallId);
      const proposal = proposals.get(toolCallId);
      const decision = decisions.get(toolCallId);
      if (!requirement) errors.push("stream-grant-without-requirement");
      if (requirement && requirement.approvalContract !== event.data.approvalContract) errors.push("stream-grant-contract-mismatch");
      if (requirement && !sameBindings(requirement.bindings, event.data.bindings)) errors.push("stream-grant-bindings-mismatch");
      if (requirement && (["toolName", "actionId", "profileRef", "prerequisiteApprovalId", "consentDigest", "risk", "bindingValuesDigest", "principalDigest", "manifestDigest", "inputDigest", "policyVersion"].some((field) => requirement[field] !== event.data[field]) || canonicalJson(requirement.egress) !== canonicalJson(event.data.egress))) errors.push("stream-grant-requirement-mismatch");
      if (proposal && proposal.inputDigest !== event.data.inputDigest) errors.push("stream-grant-input-mismatch");
      if (proposal && ["toolName", "actionId", "profileRef", "prerequisiteApprovalId", "consentDigest", "risk", "inputDigest"].some((field) => proposal[field] !== event.data[field])) errors.push("stream-grant-proposal-mismatch");
      if (decision && decision.policyVersion !== event.data.policyVersion) errors.push("stream-grant-policy-mismatch");
      if (!acceptedTurn || acceptedTurn.principalDigest !== event.data.principalDigest) errors.push("stream-grant-principal-mismatch");
      if (!acceptedTurn || acceptedTurn.manifestDigest !== event.data.manifestDigest) errors.push("stream-grant-manifest-mismatch");
      if (acceptedTurn && acceptedTurn.policyVersion !== event.data.policyVersion) errors.push("stream-grant-turn-policy-mismatch");
      if (Date.parse(event.data.expiresAt) <= Date.parse(event.occurredAt) || (requirement && Date.parse(event.data.expiresAt) > Date.parse(requirement.expiresAt))) errors.push("stream-grant-expiry");
      if (grants.has(toolCallId)) errors.push("stream-duplicate-approval-grant");
      if (approvalIds.has(event.data.approvalId)) errors.push("stream-duplicate-approval-id");
      approvalIds.add(event.data.approvalId);
      grants.set(toolCallId, event.data);
    }
    if (event.type === "tool.started") {
      const proposal = proposals.get(toolCallId);
      const decision = decisions.get(toolCallId);
      const grant = grants.get(toolCallId);
      if (cancellationObserved) errors.push("stream-tool-start-after-cancellation");
      if (lifecycleFailureErrorId) errors.push("stream-tool-start-after-failure");
      if (!proposal) errors.push("stream-start-without-proposal");
      if (!decision || decision.decision === "deny") errors.push("stream-start-without-policy-allow");
      if (decision?.decision === "require-approval" && !grant) errors.push("stream-start-without-approval");
      if (proposal && APPROVAL_ACTIONS.has(proposal.actionId) && (!grant || decision?.decision !== "require-approval")) errors.push("stream-start-without-approval");
      if (proposal?.actionId === "ACT-004") {
        const prerequisite = completedAuthorizations.get(proposal.prerequisiteApprovalId);
        if (!prerequisite || prerequisite.actionId !== "ACT-003" || prerequisite.consentDigest !== proposal.consentDigest) errors.push("stream-act004-without-consumed-act003");
      }
      if (grant && Date.parse(event.occurredAt) >= Date.parse(grant.expiresAt)) errors.push("stream-start-after-approval-expiry");
      if (grant && consumedApprovalIds.has(grant.approvalId)) errors.push("stream-approval-id-reused");
      if (grant) consumedApprovalIds.add(grant.approvalId);
      if (startedTools.has(toolCallId)) errors.push("stream-approval-reused");
      startedTools.add(toolCallId);
    }
    if (["tool.progress", "tool.completed", "tool.failed"].includes(event.type) && !startedTools.has(toolCallId)) errors.push("stream-tool-event-without-start");
    if (["tool.progress", "tool.completed", "tool.failed"].includes(event.type) && finishedTools.has(toolCallId)) errors.push("stream-tool-event-after-terminal");
    if (["tool.completed", "tool.failed"].includes(event.type)) {
      if (finishedTools.has(toolCallId)) errors.push("stream-duplicate-tool-terminal");
      finishedTools.add(toolCallId);
      const proposal = proposals.get(toolCallId);
      if (event.type === "tool.completed" && proposal && EFFECT_ACTIONS.has(proposal.actionId) && event.data.effectId === null) errors.push("stream-missing-effect-id");
      if (event.type === "tool.completed" && proposal && !EFFECT_ACTIONS.has(proposal.actionId) && event.data.effectId !== null) errors.push("stream-unexpected-effect-id");
      const grant = grants.get(toolCallId);
      if (event.type === "tool.completed" && proposal && grant && proposal.actionId === "ACT-003") completedAuthorizations.set(grant.approvalId, { actionId: proposal.actionId, consentDigest: grant.bindingValuesDigest });
      if (event.type === "tool.failed" && !cancellationObserved) {
        if (lifecycleFailureErrorId && lifecycleFailureErrorId !== event.data.errorId) errors.push("stream-conflicting-lifecycle-error");
        lifecycleFailureErrorId ||= event.data.errorId;
      }
    }
    if (event.type === "model.started") {
      if (modelActive) errors.push("stream-model-already-active");
      if (cancellationObserved) errors.push("stream-model-restart-after-cancellation");
      if (lifecycleFailureErrorId) errors.push("stream-model-restart-after-failure");
      modelActive = true; modelStarted = true; modelFinishReason = null;
    }
    if (event.type === "model.delta" && !modelActive) errors.push("stream-model-delta-without-start");
    if (event.type === "model.completed") {
      if (!modelActive) errors.push("stream-model-completed-without-start");
      modelActive = false; modelFinishReason = event.data.finishReason;
      if (event.data.finishReason === "cancelled") cancellationObserved = true;
    }
    if (event.type === "model.failed") {
      if (!modelActive) errors.push("stream-model-failed-without-start");
      modelActive = false; modelFinishReason = "failed";
      if (lifecycleFailureErrorId && lifecycleFailureErrorId !== event.data.errorId) errors.push("stream-conflicting-lifecycle-error");
      lifecycleFailureErrorId ||= event.data.errorId;
    }
    if (event.type === "retrieval.started") {
      if (retrievalActive) errors.push("stream-retrieval-already-active");
      if (cancellationObserved) errors.push("stream-retrieval-restart-after-cancellation");
      if (lifecycleFailureErrorId) errors.push("stream-retrieval-restart-after-failure");
      retrievalActive = true; retrievalSourceCount = 0;
    }
    if (event.type === "retrieval.source") {
      if (!retrievalActive) errors.push("stream-retrieval-source-without-start");
      else retrievalSourceCount += 1;
    }
    if (event.type === "retrieval.completed") {
      if (!retrievalActive) errors.push("stream-retrieval-completed-without-start");
      else if (event.data.sourceCount !== retrievalSourceCount) errors.push("stream-retrieval-source-count");
      retrievalActive = false;
    }
    if (["retrieval.failed", "retrieval.cancelled"].includes(event.type)) {
      if (!retrievalActive) errors.push(`stream-${event.type.replace(".", "-")}-without-start`);
      else if (event.data.sourceCount !== retrievalSourceCount) errors.push("stream-retrieval-source-count");
      retrievalActive = false;
      if (event.type === "retrieval.cancelled") cancellationObserved = true;
      if (event.type === "retrieval.failed") {
        if (lifecycleFailureErrorId && lifecycleFailureErrorId !== event.data.errorId) errors.push("stream-conflicting-lifecycle-error");
        lifecycleFailureErrorId ||= event.data.errorId;
      }
    }
    if (TERMINAL_EVENTS.has(event.type)) {
      if ([...startedTools].some((id) => !finishedTools.has(id))) errors.push("stream-active-tool-at-turn-terminal");
      if (modelActive) errors.push("stream-active-model-at-turn-terminal");
      if (retrievalActive) errors.push("stream-active-retrieval-at-turn-terminal");
      if (cancellationObserved && event.type !== "turn.cancelled") errors.push("stream-cancelled-lifecycle-terminal-mismatch");
      if (lifecycleFailureErrorId && event.type !== "turn.failed") errors.push("stream-failed-lifecycle-terminal-mismatch");
      if (event.type === "turn.failed" && lifecycleFailureErrorId && event.data.errorId !== lifecycleFailureErrorId) errors.push("stream-turn-error-mismatch");
      if (event.type === "turn.cancelled") {
        const matches = (event.data.modelDisposition === "not-started" && !modelStarted)
          || (event.data.modelDisposition === "completed-before-cancellation" && modelStarted && modelFinishReason !== null && modelFinishReason !== "cancelled")
          || (event.data.modelDisposition === "cancelled" && modelStarted && modelFinishReason === "cancelled");
        if (!matches) errors.push("stream-cancelled-model-disposition");
      }
      terminalSeen = true;
    }
    previousSequence = event.sequence;
    previousTime = Date.parse(event.occurredAt);
  }
  if (final && !acceptedTurn) errors.push("stream-missing-turn-accepted");
  if (final && !terminalSeen) errors.push("stream-missing-terminal-event");
  return [...new Set(errors)];
}

function createEventStreamTracker() {
  let terminalSeen = false;
  let previousSequence = 0;
  let previousTime = -Infinity;
  let identity = null;
  const proposals = new Map();
  const decisions = new Map();
  const requirements = new Map();
  const grants = new Map();
  const approvalIds = new Set();
  const consumedApprovalIds = new Set();
  const completedAuthorizations = new Map();
  const startedTools = new Set();
  const finishedTools = new Set();
  let activeToolCount = 0;
  let acceptedTurn = null;
  let modelActive = false;
  let modelStarted = false;
  let modelFinishReason = null;
  let retrievalActive = false;
  let retrievalSourceCount = 0;
  let cancellationObserved = false;
  let lifecycleFailureErrorId = null;
  let sessionLifecycleSeen = false;
  let turnActivitySeen = false;
  let acceptedCount = 0;

  function validateNext(event) {
    const errors = validateEventSemantics(event);
    const data = event.data;
    const toolCallId = data.toolCallId;
    const eventTime = Date.parse(event.occurredAt);
    if (acceptedCount === 0 && event.sequence !== 1) errors.push("complete-stream-required");
    else if (acceptedCount > 0 && event.sequence !== previousSequence + 1) errors.push("stream-sequence-gap");
    if (identity && (event.sessionId !== identity.sessionId || event.turnId !== identity.turnId || event.requestId !== identity.requestId)) errors.push("stream-identity-mismatch");
    if (eventTime < previousTime) errors.push("stream-time-regression");
    if (terminalSeen) errors.push("stream-post-terminal-event");
    if (["session.started", "session.resumed"].includes(event.type)) {
      if (sessionLifecycleSeen) errors.push("stream-duplicate-session-lifecycle");
      if (turnActivitySeen) errors.push("stream-session-lifecycle-order");
    }
    if (cancellationObserved && (PRODUCTIVE_EVENTS.has(event.type) || (event.type === "model.completed" && data.finishReason !== "cancelled") || event.type === "retrieval.completed")) errors.push("stream-productive-event-after-cancellation");
    if (lifecycleFailureErrorId && (PRODUCTIVE_EVENTS.has(event.type) || event.type === "model.completed" || event.type === "retrieval.completed")) errors.push("stream-productive-event-after-failure");
    if (!acceptedTurn && !["session.started", "session.resumed", "turn.accepted"].includes(event.type)) errors.push("stream-work-before-turn-accepted");
    if (event.type === "turn.accepted" && acceptedTurn) errors.push("stream-duplicate-turn-accepted");
    if (["context.accepted", "context.rejected", "context.compacted"].includes(event.type) && (!acceptedTurn || data.manifestDigest !== acceptedTurn.manifestDigest)) errors.push("stream-context-manifest-mismatch");
    if (event.type === "tool.proposed") {
      if (proposals.has(toolCallId)) errors.push("stream-duplicate-tool-proposal");
      const action = ACTION_CONTRACTS[data.actionId];
      if (!acceptedTurn || !action || AUTHORITY_RANK[action.authority] > AUTHORITY_RANK[acceptedTurn.authority]) errors.push("stream-proposal-exceeds-turn-authority");
    }
    if (event.type === "policy.decided") {
      if (!proposals.has(toolCallId)) errors.push("stream-policy-without-proposal");
      if (decisions.has(toolCallId)) errors.push("stream-duplicate-policy-decision");
      if (!acceptedTurn || data.policyVersion !== acceptedTurn.policyVersion) errors.push("stream-policy-turn-mismatch");
    }
    if (event.type === "approval.required") {
      const decision = decisions.get(toolCallId);
      const proposal = proposals.get(toolCallId);
      if (!decision || decision.decision !== "require-approval") errors.push("stream-approval-without-policy");
      if (!proposal || ["toolName", "actionId", "profileRef", "prerequisiteApprovalId", "consentDigest", "risk", "inputDigest"].some((field) => proposal[field] !== data[field])) errors.push("stream-requirement-proposal-mismatch");
      if (!acceptedTurn || acceptedTurn.principalDigest !== data.principalDigest || acceptedTurn.manifestDigest !== data.manifestDigest || acceptedTurn.policyVersion !== data.policyVersion) errors.push("stream-requirement-turn-mismatch");
      if (Date.parse(data.expiresAt) <= eventTime) errors.push("stream-approval-expired-at-request");
      if (requirements.has(toolCallId)) errors.push("stream-duplicate-approval-requirement");
    }
    if (event.type === "approval.granted") {
      const requirement = requirements.get(toolCallId);
      const proposal = proposals.get(toolCallId);
      const decision = decisions.get(toolCallId);
      if (!requirement) errors.push("stream-grant-without-requirement");
      if (requirement && requirement.approvalContract !== data.approvalContract) errors.push("stream-grant-contract-mismatch");
      if (requirement && !sameBindings(requirement.bindings, data.bindings)) errors.push("stream-grant-bindings-mismatch");
      if (requirement && (["toolName", "actionId", "profileRef", "prerequisiteApprovalId", "consentDigest", "risk", "bindingValuesDigest", "principalDigest", "manifestDigest", "inputDigest", "policyVersion"].some((field) => requirement[field] !== data[field]) || canonicalJson(requirement.egress) !== canonicalJson(data.egress))) errors.push("stream-grant-requirement-mismatch");
      if (proposal && proposal.inputDigest !== data.inputDigest) errors.push("stream-grant-input-mismatch");
      if (proposal && ["toolName", "actionId", "profileRef", "prerequisiteApprovalId", "consentDigest", "risk", "inputDigest"].some((field) => proposal[field] !== data[field])) errors.push("stream-grant-proposal-mismatch");
      if (decision && decision.policyVersion !== data.policyVersion) errors.push("stream-grant-policy-mismatch");
      if (!acceptedTurn || acceptedTurn.principalDigest !== data.principalDigest) errors.push("stream-grant-principal-mismatch");
      if (!acceptedTurn || acceptedTurn.manifestDigest !== data.manifestDigest) errors.push("stream-grant-manifest-mismatch");
      if (acceptedTurn && acceptedTurn.policyVersion !== data.policyVersion) errors.push("stream-grant-turn-policy-mismatch");
      if (Date.parse(data.expiresAt) <= eventTime || (requirement && Date.parse(data.expiresAt) > Date.parse(requirement.expiresAt))) errors.push("stream-grant-expiry");
      if (grants.has(toolCallId)) errors.push("stream-duplicate-approval-grant");
      if (approvalIds.has(data.approvalId)) errors.push("stream-duplicate-approval-id");
    }
    if (event.type === "tool.started") {
      const proposal = proposals.get(toolCallId);
      const decision = decisions.get(toolCallId);
      const grant = grants.get(toolCallId);
      if (cancellationObserved) errors.push("stream-tool-start-after-cancellation");
      if (lifecycleFailureErrorId) errors.push("stream-tool-start-after-failure");
      if (!proposal) errors.push("stream-start-without-proposal");
      if (!decision || decision.decision === "deny") errors.push("stream-start-without-policy-allow");
      if (decision?.decision === "require-approval" && !grant) errors.push("stream-start-without-approval");
      if (proposal && APPROVAL_ACTIONS.has(proposal.actionId) && (!grant || decision?.decision !== "require-approval")) errors.push("stream-start-without-approval");
      if (proposal?.actionId === "ACT-004") {
        const prerequisite = completedAuthorizations.get(proposal.prerequisiteApprovalId);
        if (!prerequisite || prerequisite.actionId !== "ACT-003" || prerequisite.consentDigest !== proposal.consentDigest) errors.push("stream-act004-without-consumed-act003");
      }
      if (grant && eventTime >= Date.parse(grant.expiresAt)) errors.push("stream-start-after-approval-expiry");
      if (grant && consumedApprovalIds.has(grant.approvalId)) errors.push("stream-approval-id-reused");
      if (startedTools.has(toolCallId)) errors.push("stream-approval-reused");
    }
    if (["tool.progress", "tool.completed", "tool.failed"].includes(event.type) && !startedTools.has(toolCallId)) errors.push("stream-tool-event-without-start");
    if (["tool.progress", "tool.completed", "tool.failed"].includes(event.type) && finishedTools.has(toolCallId)) errors.push("stream-tool-event-after-terminal");
    if (["tool.completed", "tool.failed"].includes(event.type)) {
      if (finishedTools.has(toolCallId)) errors.push("stream-duplicate-tool-terminal");
      const proposal = proposals.get(toolCallId);
      if (event.type === "tool.completed" && proposal && EFFECT_ACTIONS.has(proposal.actionId) && data.effectId === null) errors.push("stream-missing-effect-id");
      if (event.type === "tool.completed" && proposal && !EFFECT_ACTIONS.has(proposal.actionId) && data.effectId !== null) errors.push("stream-unexpected-effect-id");
      if (event.type === "tool.failed" && !cancellationObserved && lifecycleFailureErrorId && lifecycleFailureErrorId !== data.errorId) errors.push("stream-conflicting-lifecycle-error");
    }
    if (event.type === "model.started") {
      if (modelActive) errors.push("stream-model-already-active");
      if (cancellationObserved) errors.push("stream-model-restart-after-cancellation");
      if (lifecycleFailureErrorId) errors.push("stream-model-restart-after-failure");
    }
    if (event.type === "model.delta" && !modelActive) errors.push("stream-model-delta-without-start");
    if (event.type === "model.completed" && !modelActive) errors.push("stream-model-completed-without-start");
    if (event.type === "model.failed") {
      if (!modelActive) errors.push("stream-model-failed-without-start");
      if (lifecycleFailureErrorId && lifecycleFailureErrorId !== data.errorId) errors.push("stream-conflicting-lifecycle-error");
    }
    if (event.type === "retrieval.started") {
      if (retrievalActive) errors.push("stream-retrieval-already-active");
      if (cancellationObserved) errors.push("stream-retrieval-restart-after-cancellation");
      if (lifecycleFailureErrorId) errors.push("stream-retrieval-restart-after-failure");
    }
    if (event.type === "retrieval.source" && !retrievalActive) errors.push("stream-retrieval-source-without-start");
    if (event.type === "retrieval.completed") {
      if (!retrievalActive) errors.push("stream-retrieval-completed-without-start");
      else if (data.sourceCount !== retrievalSourceCount) errors.push("stream-retrieval-source-count");
    }
    if (["retrieval.failed", "retrieval.cancelled"].includes(event.type)) {
      if (!retrievalActive) errors.push(`stream-${event.type.replace(".", "-")}-without-start`);
      else if (data.sourceCount !== retrievalSourceCount) errors.push("stream-retrieval-source-count");
      if (event.type === "retrieval.failed" && lifecycleFailureErrorId && lifecycleFailureErrorId !== data.errorId) errors.push("stream-conflicting-lifecycle-error");
    }
    if (TERMINAL_EVENTS.has(event.type)) {
      if (activeToolCount > 0) errors.push("stream-active-tool-at-turn-terminal");
      if (modelActive) errors.push("stream-active-model-at-turn-terminal");
      if (retrievalActive) errors.push("stream-active-retrieval-at-turn-terminal");
      if (cancellationObserved && event.type !== "turn.cancelled") errors.push("stream-cancelled-lifecycle-terminal-mismatch");
      if (lifecycleFailureErrorId && event.type !== "turn.failed") errors.push("stream-failed-lifecycle-terminal-mismatch");
      if (event.type === "turn.failed" && lifecycleFailureErrorId && data.errorId !== lifecycleFailureErrorId) errors.push("stream-turn-error-mismatch");
      if (event.type === "turn.cancelled") {
        const matches = (data.modelDisposition === "not-started" && !modelStarted)
          || (data.modelDisposition === "completed-before-cancellation" && modelStarted && modelFinishReason !== null && modelFinishReason !== "cancelled")
          || (data.modelDisposition === "cancelled" && modelStarted && modelFinishReason === "cancelled");
        if (!matches) errors.push("stream-cancelled-model-disposition");
      }
    }
    const uniqueErrors = [...new Set(errors)];
    if (uniqueErrors.length > 0) return uniqueErrors;

    identity ||= { sessionId: event.sessionId, turnId: event.turnId, requestId: event.requestId };
    if (["session.started", "session.resumed"].includes(event.type)) sessionLifecycleSeen = true;
    else turnActivitySeen = true;
    if (event.type === "turn.accepted") acceptedTurn = data;
    if (event.type === "tool.proposed") proposals.set(toolCallId, data);
    if (event.type === "policy.decided") decisions.set(toolCallId, data);
    if (event.type === "approval.required") requirements.set(toolCallId, data);
    if (event.type === "approval.granted") { approvalIds.add(data.approvalId); grants.set(toolCallId, data); }
    if (event.type === "tool.started") {
      const grant = grants.get(toolCallId);
      if (grant) consumedApprovalIds.add(grant.approvalId);
      startedTools.add(toolCallId); activeToolCount += 1;
    }
    if (["tool.completed", "tool.failed"].includes(event.type)) {
      finishedTools.add(toolCallId); activeToolCount -= 1;
      const proposal = proposals.get(toolCallId); const grant = grants.get(toolCallId);
      if (event.type === "tool.completed" && proposal && grant && proposal.actionId === "ACT-003") completedAuthorizations.set(grant.approvalId, { actionId: proposal.actionId, consentDigest: grant.bindingValuesDigest });
      if (event.type === "tool.failed" && !cancellationObserved) lifecycleFailureErrorId ||= data.errorId;
    }
    if (event.type === "model.started") { modelActive = true; modelStarted = true; modelFinishReason = null; }
    if (event.type === "model.completed") { modelActive = false; modelFinishReason = data.finishReason; if (data.finishReason === "cancelled") cancellationObserved = true; }
    if (event.type === "model.failed") { modelActive = false; modelFinishReason = "failed"; lifecycleFailureErrorId ||= data.errorId; }
    if (event.type === "retrieval.started") { retrievalActive = true; retrievalSourceCount = 0; }
    if (event.type === "retrieval.source") retrievalSourceCount += 1;
    if (["retrieval.completed", "retrieval.failed", "retrieval.cancelled"].includes(event.type)) retrievalActive = false;
    if (event.type === "retrieval.cancelled") cancellationObserved = true;
    if (event.type === "retrieval.failed") lifecycleFailureErrorId ||= data.errorId;
    if (TERMINAL_EVENTS.has(event.type)) terminalSeen = true;
    previousSequence = event.sequence; previousTime = eventTime; acceptedCount += 1;
    return [];
  }

  function finalErrors() {
    const errors = [];
    if (!acceptedTurn) errors.push("stream-missing-turn-accepted");
    if (!terminalSeen) errors.push("stream-missing-terminal-event");
    return errors;
  }

  return Object.freeze({ validateNext, finalErrors });
}

module.exports = { ACTION_CONTRACTS, TERMINAL_EVENTS, canonicalJson, createEventStreamTracker, validateEventSemantics, validateEventStream };