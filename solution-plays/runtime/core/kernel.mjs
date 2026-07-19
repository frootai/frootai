import crypto from 'node:crypto';
import { canonicalSha256 } from './canonical.mjs';

export class ScenarioKernel {
  constructor({ scenarios, profile = 'offline', clock = () => new Date('2026-01-01T00:00:00.000Z') }) {
    this.scenarios = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
    this.profile = profile;
    this.clock = clock;
    this.runs = new Map();
  }

  catalog() {
    return [...this.scenarios.values()].map(({ id, version, description, inputSchema, outputSchema }) => ({
      id, version, description, inputSchema, outputSchema,
    }));
  }

  ready() {
    const checks = [...this.scenarios.values()].map((scenario) => ({ name: scenario.id, status: 'ready' }));
    return { status: checks.every((item) => item.status === 'ready') ? 'ready' : 'unready', profile: this.profile, checks };
  }

  async execute(scenarioId, input, { correlationId = 'offline-correlation' } = {}) {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw Object.assign(new Error(`Unknown scenario: ${scenarioId}`), { code: 'scenario_not_found', status: 404 });
    const validation = scenario.validate(input);
    if (!validation.ok) throw Object.assign(new Error(validation.error), { code: 'invalid_input', status: 400 });
    const startedAt = this.clock().toISOString();
    const runId = crypto.createHash('sha256').update(`${scenarioId}:${canonicalSha256(input)}`).digest('hex').slice(0, 24);
    const events = [{ type: 'run.started', at: startedAt, scenario: scenarioId }];
    try {
      const output = await scenario.execute(input, { runId, correlationId, profile: this.profile, emit: (event) => events.push(event) });
      const result = {
        runId, scenario: scenarioId, version: scenario.version, status: 'succeeded', startedAt,
        completedAt: this.clock().toISOString(), output, canonicalOutputHash: canonicalSha256(output), events,
      };
      this.runs.set(runId, result);
      return result;
    } catch (error) {
      const result = {
        runId, scenario: scenarioId, version: scenario.version, status: 'failed', startedAt,
        completedAt: this.clock().toISOString(), error: { code: error.code || 'scenario_failed', message: error.message }, events,
      };
      this.runs.set(runId, result);
      throw Object.assign(error, { run: result });
    }
  }

  getRun(runId) {
    return this.runs.get(runId) || null;
  }
}
