/**
 * FAI Specialty S-5: FAI Planning — Task Decomposition & Execution
 * ================================================================
 * Declarative planning strategy contracts. Instead of coding task decomposition
 * into each agent, declare planning strategy in the manifest.
 *
 * @module engine/specialties/planning
 */

const PLANNING_SCHEMA = {
  type: 'object',
  properties: {
    strategy: {
      type: 'string',
      enum: ['react', 'plan-execute', 'tree-of-thought', 'supervisor-decompose', 'map-reduce', 'sequential'],
      default: 'plan-execute',
      description: 'Planning strategy for task decomposition.'
    },
    maxSteps: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
    parallelism: { type: 'integer', minimum: 1, maximum: 50, default: 3, description: 'Max concurrent sub-tasks.' },
    loopPrevention: {
      type: 'object',
      properties: {
        maxIterations: { type: 'integer', minimum: 1, default: 5 },
        costCap: { type: 'number', minimum: 0, description: 'Abort if plan exceeds this cost (USD).' },
        tokenCap: { type: 'integer', minimum: 0, description: 'Abort if total tokens exceed this.' },
        duplicateDetection: { type: 'boolean', default: true }
      },
      additionalProperties: false
    },
    decomposition: {
      type: 'object',
      properties: {
        model: { type: 'string', default: 'gpt-4o', description: 'Model for task decomposition.' },
        validator: { type: 'string', default: 'gpt-4o-mini', description: 'Model for plan validation.' },
        outputSchema: { type: 'object', description: 'JSON Schema for decomposed task output.' }
      },
      additionalProperties: false
    },
    fallback: {
      type: 'object',
      properties: {
        strategy: { type: 'string', enum: ['abort', 'simplify', 'human-escalate'], default: 'abort' },
        maxRetries: { type: 'integer', minimum: 0, default: 2 }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

// ─── Task Graph ───────────────────────────────────────

class TaskNode {
  constructor(id, title, description, agentId) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.agentId = agentId || null;
    this.status = 'pending';    // pending|running|completed|failed|skipped
    this.dependencies = [];     // TaskNode IDs
    this.result = null;
    this.error = null;
    this.startTime = null;
    this.endTime = null;
    this.cost = 0;
    this.tokens = 0;
    this.retries = 0;
  }

  isReady(completedIds) {
    return this.status === 'pending' && this.dependencies.every(d => completedIds.has(d));
  }

  complete(result, cost = 0, tokens = 0) {
    this.status = 'completed';
    this.result = result;
    this.endTime = Date.now();
    this.cost = cost;
    this.tokens = tokens;
  }

  fail(error) {
    this.status = 'failed';
    this.error = error;
    this.endTime = Date.now();
  }

  serialize() {
    return {
      id: this.id,
      title: this.title,
      agentId: this.agentId,
      status: this.status,
      dependencies: this.dependencies,
      durationMs: this.endTime ? this.endTime - this.startTime : null,
      cost: this.cost,
      tokens: this.tokens,
      error: this.error
    };
  }
}

class TaskGraph {
  constructor() {
    /** @type {Map<string, TaskNode>} */
    this.nodes = new Map();
    this._executionOrder = [];
  }

  addTask(id, title, description, agentId, dependencies = []) {
    const node = new TaskNode(id, title, description, agentId);
    node.dependencies = dependencies;
    this.nodes.set(id, node);
    return node;
  }

  getReadyTasks() {
    const completedIds = new Set();
    for (const [id, node] of this.nodes) {
      if (node.status === 'completed') completedIds.add(id);
    }
    return [...this.nodes.values()].filter(n => n.isReady(completedIds));
  }

  isComplete() {
    return [...this.nodes.values()].every(n => n.status === 'completed' || n.status === 'skipped');
  }

  hasFailed() {
    return [...this.nodes.values()].some(n => n.status === 'failed');
  }

  detectCycles() {
    const visited = new Set();
    const recStack = new Set();

    const dfs = (nodeId) => {
      visited.add(nodeId);
      recStack.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          if (!visited.has(dep)) {
            if (dfs(dep)) return true;
          } else if (recStack.has(dep)) return true;
        }
      }
      recStack.delete(nodeId);
      return false;
    };

    for (const id of this.nodes.keys()) {
      if (!visited.has(id) && dfs(id)) return true;
    }
    return false;
  }

  stats() {
    let completed = 0, failed = 0, pending = 0, running = 0, totalCost = 0, totalTokens = 0;
    for (const node of this.nodes.values()) {
      if (node.status === 'completed') { completed++; totalCost += node.cost; totalTokens += node.tokens; }
      else if (node.status === 'failed') failed++;
      else if (node.status === 'running') running++;
      else pending++;
    }
    return { total: this.nodes.size, completed, failed, pending, running, totalCost, totalTokens };
  }

  serialize() {
    return {
      tasks: [...this.nodes.values()].map(n => n.serialize()),
      stats: this.stats(),
      hasCycles: this.detectCycles()
    };
  }
}

// ─── Planning Engine ──────────────────────────────────

class PlanningEngine {
  constructor(config = {}) {
    this.strategy = config.strategy || 'plan-execute';
    this.maxSteps = config.maxSteps || 20;
    this.parallelism = config.parallelism || 3;
    this.loopPrevention = config.loopPrevention || {};
    this.decomposition = config.decomposition || {};
    this.fallback = config.fallback || {};

    this._costAccumulator = 0;
    this._tokenAccumulator = 0;
    this._iterationCounts = new Map();
    this._executedSteps = [];
  }

  /**
   * Create a task graph from a goal description.
   * The actual decomposition prompt is returned for the LLM to process.
   * @param {string} goal
   * @param {object} context - Available tools, agents, constraints
   * @returns {{ graph: TaskGraph, decompositionPrompt: string }}
   */
  decompose(goal, context = {}) {
    const graph = new TaskGraph();

    // Generate the decomposition prompt based on strategy
    const prompt = this._buildDecompositionPrompt(goal, context);

    return { graph, decompositionPrompt: prompt };
  }

  /**
   * Populate a task graph from structured decomposition output.
   * @param {TaskGraph} graph
   * @param {Array<{ id: string, title: string, description: string, agentId?: string, dependencies?: string[] }>} tasks
   * @returns {{ success: boolean, errors: string[] }}
   */
  populateGraph(graph, tasks) {
    const errors = [];

    if (tasks.length > this.maxSteps) {
      errors.push(`Plan has ${tasks.length} steps, exceeding maxSteps (${this.maxSteps})`);
    }

    for (const task of tasks.slice(0, this.maxSteps)) {
      graph.addTask(task.id, task.title, task.description, task.agentId, task.dependencies || []);
    }

    if (graph.detectCycles()) {
      errors.push('Task graph contains cycles — cannot execute');
    }

    return { success: errors.length === 0, errors };
  }

  /**
   * Get the next batch of tasks to execute (respecting parallelism).
   * @param {TaskGraph} graph
   * @returns {{ tasks: TaskNode[], canContinue: boolean, reason?: string }}
   */
  getNextBatch(graph) {
    // Check loop prevention
    const loopCheck = this._checkLoopPrevention(graph);
    if (!loopCheck.canContinue) {
      return { tasks: [], canContinue: false, reason: loopCheck.reason };
    }

    const ready = graph.getReadyTasks();
    const batch = ready.slice(0, this.parallelism);

    // Mark as running
    for (const task of batch) {
      task.status = 'running';
      task.startTime = Date.now();
    }

    return { tasks: batch, canContinue: true };
  }

  /**
   * Record task completion and update accumulators.
   * @param {TaskGraph} graph
   * @param {string} taskId
   * @param {any} result
   * @param {number} cost
   * @param {number} tokens
   */
  completeTask(graph, taskId, result, cost = 0, tokens = 0) {
    const node = graph.nodes.get(taskId);
    if (!node) return;

    node.complete(result, cost, tokens);
    this._costAccumulator += cost;
    this._tokenAccumulator += tokens;
    this._executedSteps.push({ taskId, timestamp: Date.now() });
  }

  /**
   * Record task failure and handle retry/fallback.
   * @param {TaskGraph} graph
   * @param {string} taskId
   * @param {string} error
   * @returns {{ action: string, reason: string }}
   */
  failTask(graph, taskId, error) {
    const node = graph.nodes.get(taskId);
    if (!node) return { action: 'skip', reason: 'task not found' };

    node.retries++;
    const maxRetries = this.fallback.maxRetries || 2;

    if (node.retries <= maxRetries) {
      node.status = 'pending';
      node.error = null;
      return { action: 'retry', reason: `Retry ${node.retries}/${maxRetries}` };
    }

    node.fail(error);

    switch (this.fallback.strategy || 'abort') {
      case 'simplify':
        return { action: 'simplify', reason: 'Max retries reached — simplify task' };
      case 'human-escalate':
        return { action: 'human-escalate', reason: 'Max retries reached — escalating to human' };
      default:
        return { action: 'abort', reason: `Max retries (${maxRetries}) reached — aborting plan` };
    }
  }

  /** @private */
  _checkLoopPrevention(graph) {
    const maxIter = this.loopPrevention.maxIterations || 5;
    const costCap = this.loopPrevention.costCap;
    const tokenCap = this.loopPrevention.tokenCap;

    if (this._executedSteps.length > this.maxSteps * maxIter) {
      return { canContinue: false, reason: `Iteration limit reached (${this._executedSteps.length} steps)` };
    }
    if (costCap !== undefined && this._costAccumulator > costCap) {
      return { canContinue: false, reason: `Cost cap exceeded ($${this._costAccumulator.toFixed(4)} > $${costCap})` };
    }
    if (tokenCap !== undefined && this._tokenAccumulator > tokenCap) {
      return { canContinue: false, reason: `Token cap exceeded (${this._tokenAccumulator} > ${tokenCap})` };
    }

    // Duplicate detection
    if (this.loopPrevention.duplicateDetection !== false) {
      const recentSteps = this._executedSteps.slice(-10).map(s => s.taskId);
      const seen = new Map();
      for (const step of recentSteps) {
        seen.set(step, (seen.get(step) || 0) + 1);
        if (seen.get(step) >= 3) {
          return { canContinue: false, reason: `Loop detected: task "${step}" executed ${seen.get(step)} times in last 10 steps` };
        }
      }
    }

    return { canContinue: true };
  }

  /** @private */
  _buildDecompositionPrompt(goal, context) {
    const strategy = this.strategy;
    const availableAgents = context.agents ? context.agents.map(a => a.id).join(', ') : 'builder, reviewer, tuner';

    switch (strategy) {
      case 'plan-execute':
        return `Decompose the following goal into a sequential plan of ${this.maxSteps} or fewer steps.
For each step provide: id, title, description, agentId (from: ${availableAgents}), dependencies (list of prerequisite step IDs).
Output as JSON array.

Goal: ${goal}`;

      case 'supervisor-decompose':
        return `As a supervisor agent, decompose this goal into independent sub-tasks that can be assigned to specialized agents.
Available agents: ${availableAgents}
Max parallel tasks: ${this.parallelism}
Max total steps: ${this.maxSteps}

Goal: ${goal}

Output as JSON array of tasks with: id, title, description, agentId, dependencies.`;

      case 'map-reduce':
        return `Apply map-reduce decomposition to this goal:
1. MAP: Break into independent, parallel sub-problems
2. Each sub-problem produces a partial result
3. REDUCE: Combine partial results into final answer

Goal: ${goal}

Output as JSON with: map_tasks (array of {id, title, description}), reduce_task ({id, title, description, dependencies}).`;

      default:
        return `Decompose this goal into steps (strategy: ${strategy}). Goal: ${goal}`;
    }
  }
}

// ─── Public Factory ───────────────────────────────────

function createPlanningEngine(planningConfig = {}) {
  const engine = new PlanningEngine(planningConfig);

  return {
    engine,
    schema: PLANNING_SCHEMA,

    createGraph() {
      return new TaskGraph();
    },

    validate(config) {
      const errors = [];
      if (!config || typeof config !== 'object') return { valid: true, errors };

      const validStrategies = ['react', 'plan-execute', 'tree-of-thought', 'supervisor-decompose', 'map-reduce', 'sequential'];
      if (config.strategy && !validStrategies.includes(config.strategy)) {
        errors.push(`Invalid planning strategy "${config.strategy}". Valid: ${validStrategies.join(', ')}`);
      }
      if (config.maxSteps !== undefined && (config.maxSteps < 1 || config.maxSteps > 200)) {
        errors.push(`maxSteps must be 1-200, got: ${config.maxSteps}`);
      }
      if (config.parallelism !== undefined && (config.parallelism < 1 || config.parallelism > 50)) {
        errors.push(`parallelism must be 1-50, got: ${config.parallelism}`);
      }

      return { valid: errors.length === 0, errors };
    }
  };
}

export { createPlanningEngine, PlanningEngine, TaskGraph, TaskNode, PLANNING_SCHEMA };
