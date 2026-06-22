/**
 * FAI Engine — MCP Bridge
 * Provides the run_play function that can be registered as an MCP tool.
 *
 * This bridges the FAI Engine (CommonJS) with the MCP Server (ESM).
 * The MCP server can import this via dynamic require() or by converting to ESM later.
 *
 * Tool: run_play
 * Input: { playId: "01-enterprise-rag" } or { manifestPath: "path/to/fai-manifest.json" }
 * Output: Engine status + wiring report
 */

import { join, resolve, dirname } from 'path';
import { existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { initEngine, printStatus } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(__dirname, '..'));

/**
 * Find the fai-manifest.json for a play by ID.
 * @param {string} playId - Play identifier (e.g., "01-enterprise-rag" or "01")
 * @returns {string|null} Absolute path to fai-manifest.json
 */
function findManifest(playId) {
  const playsDir = join(ROOT, 'solution-plays');
  if (!existsSync(playsDir)) return null;

  const folders = readdirSync(playsDir).filter(f => {
    return f.startsWith(playId) || f === playId;
  });

  for (const folder of folders) {
    // Check root level first, then spec/ subdirectory
    const rootPath = join(playsDir, folder, 'fai-manifest.json');
    if (existsSync(rootPath)) return rootPath;

    const specPath = join(playsDir, folder, 'spec', 'fai-manifest.json');
    if (existsSync(specPath)) return specPath;
  }

  return null;
}

/**
 * MCP tool handler for run_play.
 * @param {object} params - { playId: string } or { manifestPath: string }
 * @returns {object} Engine result formatted for MCP response
 */
function runPlay(params) {
  let manifestPath;

  if (params.manifestPath) {
    manifestPath = resolve(params.manifestPath);
  } else if (params.playId) {
    manifestPath = findManifest(params.playId);
    if (!manifestPath) {
      return {
        success: false,
        error: `Play "${params.playId}" not found. Available plays are in solution-plays/.`
      };
    }
  } else {
    return {
      success: false,
      error: 'Provide either playId (e.g., "01-enterprise-rag") or manifestPath.'
    };
  }

  const engine = initEngine(manifestPath);

  return {
    success: engine.success,
    play: engine.manifest?.play,
    version: engine.manifest?.version,
    context: engine.context,
    wiring: engine.wiring?.stats,
    guardrails: engine.evaluator?.thresholds,
    errors: engine.errors,
    duration: engine.duration
  };
}

/**
 * MCP tool definition for registration in the MCP server.
 */
const MCP_TOOL_DEFINITION = {
  name: 'run_play',
  description: 'Load and validate a FrootAI solution play using the FAI Engine. Resolves context, wires primitives, and reports wiring status with quality gates.',
  inputSchema: {
    type: 'object',
    properties: {
      playId: {
        type: 'string',
        description: 'Solution play ID (e.g., "01-enterprise-rag", "01"). Searches solution-plays/ for the manifest.'
      },
      manifestPath: {
        type: 'string',
        description: 'Direct path to a fai-manifest.json file. Use this for custom manifest locations.'
      }
    }
  }
};

/* ════════════════════════════════════════════════════════════════════
   [M10.1] attachAreasForRun — Engine ↔ FederationClient bridge
   ────────────────────────────────────────────────────────────────────
   Engine consumer of the M5–M9 federation substrate. Given a resolved
   plan (the M10.2 ContextResolver merge of agent `mcpAttachments` +
   skill `requiresMcp` + play `mcp_scope.attached`), call `fai_attach_mcp`
   for each area via a caller-injected FederationClient, then return a
   merged tool registry the agent loop can index.

   Feature flag: gated behind `FROOTAI_FEDERATION=on` per the M10
   kickoff. Default-off keeps the 30+ existing Plays running unchanged.
   When the flag is off, the function returns a no-op result so callers
   can chain unconditionally without `if (flagOn) { ... }` branches.

   Transport injection (M6.1 doctrine): the FederationClient is opts-
   injected — the engine never hard-requires `frootai-sdk`. Default
   wiring lands at M10.x; until then callers (engine.run + tests)
   supply their own client. ============================================
   ──────────────────────────────────────────────────────────────────── */

/** Environment variable name controlling federation enablement. */
const FEDERATION_FLAG_ENV = 'FROOTAI_FEDERATION';
/** Literal value that enables federation (case-insensitive). */
const FEDERATION_FLAG_ON = 'on';

/**
 * @param {NodeJS.ProcessEnv} [env] Defaults to process.env.
 * @returns {boolean}
 */
function isFederationEnabled(env) {
  const e = env || process.env;
  return String(e[FEDERATION_FLAG_ENV] || '').toLowerCase() === FEDERATION_FLAG_ON;
}

/**
 * @typedef {object} AttachPlanArea
 * @property {string}   name           Area slug (e.g. "azure"). Must match the kernel's area roster.
 * @property {boolean}  [trustOverride] Bypass trust manifest for community-tier areas.
 * @property {string[]} [requiredTools] Bare tool names the plan demands; missing tools fail the area.
 */
/**
 * @typedef {object} AttachPlan
 * @property {AttachPlanArea[]} areas
 */
/**
 * @typedef {object} AttachedTool
 * @property {string}        qualifiedName  e.g. "azure.list_subscriptions".
 * @property {string}        bareName       e.g. "list_subscriptions".
 * @property {string}        area           e.g. "azure".
 * @property {string}        description
 * @property {object}        [inputSchema]
 */
/**
 * @typedef {object} AreaAttachOutcome
 * @property {string}  area
 * @property {boolean} attached
 * @property {AttachedTool[]} tools
 * @property {object}  [handle]
 * @property {string}  [error]
 * @property {string}  [errorCode]   Mirrors FederationError.code taxonomy.
 */
/**
 * @typedef {object} AttachResult
 * @property {boolean} success            True iff every requested area attached.
 * @property {boolean} federationEnabled  Echo of the flag state for caller assertions.
 * @property {string[]} attached          Area names that attached successfully.
 * @property {string[]} failures          Area names that failed to attach.
 * @property {AreaAttachOutcome[]}        outcomes
 * @property {Map<string, AttachedTool>}  toolsByName   Qualified-name keyed; collision-safe.
 * @property {Record<string, AttachedTool[]>} toolsByArea
 */

/**
 * Attach every area in `plan.areas` via the injected FederationClient,
 * then return a merged tool registry the agent loop can index.
 *
 * @param {AttachPlan} plan
 * @param {object}     [opts]
 * @param {object}     [opts.federationClient] M6 FederationClient instance (required when flag on).
 * @param {NodeJS.ProcessEnv} [opts.env]       Defaults to process.env (overridable for tests).
 * @returns {Promise<AttachResult>}
 */
async function attachAreasForRun(plan, opts) {
  const o = opts || {};
  const env = o.env || process.env;

  // Feature flag OFF → no-op result; success=true so caller chains keep working.
  if (!isFederationEnabled(env)) {
    return {
      success: true,
      federationEnabled: false,
      attached: [],
      failures: [],
      outcomes: [],
      toolsByName: new Map(),
      toolsByArea: {},
    };
  }

  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.areas)) {
    throw new TypeError('attachAreasForRun: plan.areas must be an array');
  }
  const federationClient = o.federationClient;
  if (!federationClient || typeof federationClient.attach !== 'function') {
    throw new TypeError(
      'attachAreasForRun: opts.federationClient is required when FROOTAI_FEDERATION=on (inject an M6 FederationClient instance)'
    );
  }

  const outcomes = [];
  const failures = [];
  const attached = [];
  const toolsByName = new Map();
  const toolsByArea = {};

  for (const area of plan.areas) {
    if (!area || typeof area.name !== 'string' || area.name.length === 0) {
      outcomes.push({
        area: '?',
        attached: false,
        tools: [],
        error: 'invalid area entry (name required)',
        errorCode: 'user_error',
      });
      failures.push('?');
      continue;
    }

    try {
      const handle = await federationClient.attach({
        name: area.name,
        ...(area.trustOverride ? { trustOverride: true } : {}),
      });

      // Trust gate refused: surface as a failure WITHOUT throwing —
      // FederationClient.attach returns a handle with `blocked:true`
      // per the M6.3 wire contract.
      if (handle && handle.blocked) {
        outcomes.push({
          area: area.name,
          attached: false,
          tools: [],
          handle,
          error: handle.humanMessage || 'trust_blocked',
          errorCode: 'trust_blocked',
        });
        failures.push(area.name);
        continue;
      }

      const rawTools = (await federationClient.listTools(handle)) || [];
      const tools = rawTools.map((t) => {
        const bare = t.bareName || t.name || '';
        const qual = t.qualifiedName || (bare ? `${area.name}.${bare}` : `${area.name}.${'?'}`);
        return {
          qualifiedName: qual,
          bareName: bare,
          area: area.name,
          description: t.description || '',
          inputSchema: t.inputSchema,
        };
      });

      // Required-tools gate: if the plan demands specific tools, verify
      // they're all present BEFORE counting the area as attached so the
      // agent loop never starts with a known-broken plan.
      if (Array.isArray(area.requiredTools) && area.requiredTools.length > 0) {
        const have = new Set(tools.map((t) => t.bareName));
        const missing = area.requiredTools.filter((rt) => !have.has(rt));
        if (missing.length > 0) {
          outcomes.push({
            area: area.name,
            attached: false,
            tools,
            handle,
            error: `required tools missing on area '${area.name}': ${missing.join(', ')}`,
            errorCode: 'tool_error',
          });
          failures.push(area.name);
          continue;
        }
      }

      attached.push(area.name);
      toolsByArea[area.name] = tools;
      for (const t of tools) {
        // Qualified name is collision-safe; bare-name collisions across
        // areas are M6.7 territory (namespace_collision detection lives
        // in invoke(), not here).
        toolsByName.set(t.qualifiedName, t);
      }
      outcomes.push({ area: area.name, attached: true, tools, handle });
    } catch (err) {
      const errorCode = (err && err.code) || 'transport_error';
      outcomes.push({
        area: area.name,
        attached: false,
        tools: [],
        error: (err && err.message) || String(err),
        errorCode,
      });
      failures.push(area.name);
    }
  }

  return {
    success: failures.length === 0,
    federationEnabled: true,
    attached,
    failures,
    outcomes,
    toolsByName,
    toolsByArea,
  };
}

/* ════════════════════════════════════════════════════════════════════
   [M10.3] assertSkillRequirementsSatisfied — engine pre-flight gate
   ────────────────────────────────────────────────────────────────────
   After M10.1 attached the merged plan, walk each skill's
   `requiresMcp` declaration and verify every required area actually
   landed in `attachResult.attached`. Two distinct failure modes are
   surfaced so the operator immediately knows what to fix:

     'area-attach-failed'  — area WAS in the plan but failed to attach
                             (trust_blocked / transport_error / etc.).
                             The skill's requirement is unmet because
                             the federation substrate refused.
     'area-not-in-plan'    — area was NEVER in the attach plan; the
                             play / agent / skill declarations didn't
                             roll up the area. Typically an authoring
                             error — caught here BEFORE the agent loop
                             so the operator gets a single clear error
                             instead of a tool-not-found at run time.

   Federation-OFF posture: when `attachResult.federationEnabled === false`
   the gate is a no-op (the agent loop continues without federated
   tools; any skill that declared `requiresMcp` is implicitly opting
   into "needs federation"; the engine is expected to either enable
   federation or skip those skills upstream).
   ──────────────────────────────────────────────────────────────────── */

/**
 * Error thrown when one or more skills' `requiresMcp` declarations are
 * not satisfied by the attach result. Carries a structured `.unmet`
 * array so callers (CLI / Studio / engine) can render an actionable
 * UI rather than just a message string.
 */
class SkillRequirementError extends Error {
  /**
   * @param {Array<{skill: string, area: string, reason: 'area-attach-failed'|'area-not-in-plan', detail?: string}>} unmet
   */
  constructor(unmet) {
    const lines = unmet.map((u) => {
      const tail = u.detail ? ` — ${u.detail}` : '';
      return `  • skill '${u.skill}' requires area '${u.area}' (${u.reason})${tail}`;
    });
    super(
      `${unmet.length} skill requirement(s) not satisfied by the attach plan:\n${lines.join('\n')}\n` +
        `Fix by adding the area to the play's mcp_scope.attached OR by resolving the attach failure.`,
    );
    this.name = 'SkillRequirementError';
    this.code = 'skill_requirements_unmet';
    this.unmet = unmet;
  }
}

/**
 * Pre-flight check: verify every skill's `requiresMcp` is satisfied by
 * the attach result. Returns silently on success; throws
 * `SkillRequirementError` listing every unmet requirement on failure.
 *
 * @param {Array<object>} skills          Skills the run plans to invoke.
 * @param {AttachResult}  attachResult    Output of `attachAreasForRun`.
 * @param {object}        [opts]
 * @param {boolean}       [opts.skipOnFederationOff=true]
 *   When attachResult.federationEnabled === false AND this is true,
 *   the gate is a no-op (federation-off is an upstream policy choice;
 *   the gate doesn't second-guess it). Set false to force the check
 *   even with federation off — useful for authoring-time linters.
 * @throws {SkillRequirementError}
 * @returns {{ ok: true, checked: number }}
 */
function assertSkillRequirementsSatisfied(skills, attachResult, opts) {
  const o = opts || {};
  const skipOnFederationOff = o.skipOnFederationOff !== false;

  if (!Array.isArray(skills)) {
    throw new TypeError('assertSkillRequirementsSatisfied: skills must be an array');
  }
  if (!attachResult || typeof attachResult !== 'object') {
    throw new TypeError('assertSkillRequirementsSatisfied: attachResult is required');
  }
  if (attachResult.federationEnabled === false && skipOnFederationOff) {
    return { ok: true, checked: 0 };
  }

  const attached = new Set(attachResult.attached || []);
  // Map area → outcome for fast lookup when classifying failure modes.
  const outcomesByArea = new Map();
  for (const o2 of attachResult.outcomes || []) {
    if (o2 && typeof o2.area === 'string') outcomesByArea.set(o2.area, o2);
  }

  const unmet = [];
  let checked = 0;

  for (const skill of skills) {
    if (!skill || typeof skill !== 'object') continue;
    const required = skill.requiresMcp;
    if (!Array.isArray(required) || required.length === 0) continue;
    const skillId = skill.id || skill.name || '?';
    checked += 1;

    for (const area of required) {
      if (typeof area !== 'string' || area.length === 0) continue;
      if (attached.has(area)) continue; // satisfied

      // Classify the failure mode
      const outcome = outcomesByArea.get(area);
      if (outcome && outcome.attached === false) {
        unmet.push({
          skill: skillId,
          area,
          reason: 'area-attach-failed',
          detail: outcome.error
            ? `${outcome.errorCode || 'error'}: ${outcome.error}`
            : outcome.errorCode || 'unknown failure',
        });
      } else {
        unmet.push({
          skill: skillId,
          area,
          reason: 'area-not-in-plan',
          detail: 'declared in requiresMcp but never reached the attach plan',
        });
      }
    }
  }

  if (unmet.length > 0) throw new SkillRequirementError(unmet);
  return { ok: true, checked };
}

/* ════════════════════════════════════════════════════════════════════
   [M10.4] detachAreasAfterRun — engine post-run cleanup (best-effort)
   ────────────────────────────────────────────────────────────────────
   When `play.mcp_scope.router_config.detach_on_finish === true`, the
   engine calls `fai_detach_mcp` for every successfully-attached area
   after the agent loop finishes. Failures are LOGGED but never thrown
   — post-run is too late to abort the run, and a failed detach leaks
   only kernel-side state (idle handles), not correctness.

   Default is OFF (keep handles warm for repeat invocations); set the
   field to `true` on ad-hoc / one-shot runs (CI, single-tool extracts)
   where holding open handles wastes server-side budget.

   The decision (`shouldDetachOnFinish`) is split from the action
   (`detachAreasAfterRun`) so callers can override via CLI flag /
   env var without re-implementing the read.
   ──────────────────────────────────────────────────────────────────── */

/**
 * Read the `detach_on_finish` flag from a play manifest.
 * Returns the boolean exactly; default false when absent / non-boolean.
 *
 * @param {object} [playManifest]
 * @returns {boolean}
 */
function shouldDetachOnFinish(playManifest) {
  const v = playManifest && playManifest.mcp_scope
    && playManifest.mcp_scope.router_config
    && playManifest.mcp_scope.router_config.detach_on_finish;
  return v === true;
}

/**
 * @typedef {object} DetachOutcome
 * @property {string}  area
 * @property {boolean} detached
 * @property {string}  [error]
 * @property {string}  [errorCode]
 */
/**
 * @typedef {object} DetachResult
 * @property {boolean}          attempted   True iff the function actually called detach (vs skipped).
 * @property {boolean}          skipped     True when federation off / no areas / no client.
 * @property {string}           [reason]    Why skipped (when skipped:true).
 * @property {string[]}         detached    Areas successfully detached.
 * @property {DetachOutcome[]}  outcomes    Per-area result including failures.
 * @property {Array<{area:string, error:string, errorCode:string}>} failures
 */

/**
 * Detach every area in `attachResult.attached` via the injected
 * FederationClient. Best-effort: per-area failures are captured in
 * the result, never thrown. The function returns `{skipped:true}`
 * without calling the client when:
 *   - `attachResult.federationEnabled` is false
 *   - `attachResult.attached` is empty
 *   - `opts.federationClient` is absent (the caller MIGHT legitimately
 *     not have a client — e.g., engine reused the M10.1 result but
 *     opted out of post-run cleanup wiring; we degrade gracefully).
 *
 * @param {AttachResult} attachResult
 * @param {object}       [opts]
 * @param {object}       [opts.federationClient]
 *   M6 client with `.detach(handle)` method. When absent + areas
 *   are attached, returns `{skipped:true, reason:'no-client'}`.
 * @returns {Promise<DetachResult>}
 */
async function detachAreasAfterRun(attachResult, opts) {
  const o = opts || {};
  if (!attachResult || typeof attachResult !== 'object') {
    throw new TypeError('detachAreasAfterRun: attachResult is required');
  }
  if (attachResult.federationEnabled === false) {
    return { attempted: false, skipped: true, reason: 'federation-disabled', detached: [], outcomes: [], failures: [] };
  }
  const attached = Array.isArray(attachResult.attached) ? attachResult.attached : [];
  if (attached.length === 0) {
    return { attempted: false, skipped: true, reason: 'nothing-to-detach', detached: [], outcomes: [], failures: [] };
  }
  const federationClient = o.federationClient;
  if (!federationClient || typeof federationClient.detach !== 'function') {
    // Best-effort: degrade silently rather than throw. Post-run cleanup
    // failing should never crash the engine after the agent loop ran
    // successfully — the operator sees the skip reason in logs.
    return { attempted: false, skipped: true, reason: 'no-client', detached: [], outcomes: [], failures: [] };
  }

  // Build handle lookup from the M10.1 outcomes so we replay the same
  // handle the FederationClient.attach() returned.
  const handleByArea = new Map();
  for (const oc of attachResult.outcomes || []) {
    if (oc && oc.area && oc.handle) handleByArea.set(oc.area, oc.handle);
  }

  const detached = [];
  const failures = [];
  const outcomes = [];

  for (const area of attached) {
    const handle = handleByArea.get(area) || { name: area };
    try {
      await federationClient.detach(handle);
      detached.push(area);
      outcomes.push({ area, detached: true });
    } catch (err) {
      const errorCode = (err && err.code) || 'detach_failed';
      const message = (err && err.message) || String(err);
      failures.push({ area, error: message, errorCode });
      outcomes.push({ area, detached: false, error: message, errorCode });
      // Best-effort logging — never throw out of the function.
      console.warn(
        `[mcp-bridge] detach failed for area '${area}' (${errorCode}): ${message}`,
      );
    }
  }

  return {
    attempted: true,
    skipped: false,
    detached,
    outcomes,
    failures,
  };
}

export {
  runPlay,
  findManifest,
  MCP_TOOL_DEFINITION,
  // [M10.1]
  attachAreasForRun,
  isFederationEnabled,
  FEDERATION_FLAG_ENV,
  FEDERATION_FLAG_ON,
  // [M10.3]
  assertSkillRequirementsSatisfied,
  SkillRequirementError,
  // [M10.4]
  detachAreasAfterRun,
  shouldDetachOnFinish,
};
