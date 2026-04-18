/**
 * FAI Specialty S-8: FAI Knowledge Graphs — Graph-Enhanced RAG
 * ==============================================================
 * Protocol-level graph integration for entity extraction, relationship mapping,
 * graph traversal, and hybrid search (vector + graph).
 *
 * @module engine/specialties/graphs
 */

const GRAPH_SCHEMA = {
  type: 'object',
  properties: {
    backend: {
      type: 'string',
      enum: ['cosmos-gremlin', 'neo4j', 'neptune', 'tigergraph', 'in-memory'],
      default: 'in-memory'
    },
    entityExtraction: {
      type: 'object',
      properties: {
        model: { type: 'string', default: 'gpt-4o-mini' },
        categories: {
          type: 'array',
          items: { type: 'string' },
          default: ['person', 'organization', 'technology', 'concept', 'location', 'event']
        },
        minConfidence: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
        deduplication: { type: 'boolean', default: true }
      },
      additionalProperties: false
    },
    traversal: {
      type: 'object',
      properties: {
        maxHops: { type: 'integer', minimum: 1, maximum: 10, default: 3 },
        strategy: { type: 'string', enum: ['breadth-first', 'depth-first', 'bidirectional', 'weighted'], default: 'breadth-first' },
        maxResults: { type: 'integer', minimum: 1, default: 50 },
        weightProperty: { type: 'string', default: 'confidence' }
      },
      additionalProperties: false
    },
    hybridSearch: {
      type: 'object',
      properties: {
        vector: {
          type: 'object',
          properties: { weight: { type: 'number', minimum: 0, maximum: 1, default: 0.6 } }
        },
        graph: {
          type: 'object',
          properties: { weight: { type: 'number', minimum: 0, maximum: 1, default: 0.4 } }
        },
        reranking: { type: 'boolean', default: true }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

// ─── Graph Node & Edge ────────────────────────────────

class GraphNode {
  constructor(id, label, category, properties = {}) {
    this.id = id;
    this.label = label;
    this.category = category;
    this.properties = { ...properties, createdAt: Date.now() };
    this.edges = [];
  }

  addProperty(key, value) {
    this.properties[key] = value;
  }

  serialize() {
    return { id: this.id, label: this.label, category: this.category, properties: this.properties, edgeCount: this.edges.length };
  }
}

class GraphEdge {
  constructor(sourceId, targetId, relationship, properties = {}) {
    this.id = `edge_${sourceId}_${relationship}_${targetId}`;
    this.sourceId = sourceId;
    this.targetId = targetId;
    this.relationship = relationship;
    this.properties = { ...properties, confidence: properties.confidence || 1.0, createdAt: Date.now() };
  }

  serialize() {
    return { id: this.id, source: this.sourceId, target: this.targetId, relationship: this.relationship, properties: this.properties };
  }
}

// ─── In-Memory Knowledge Graph ────────────────────────

class KnowledgeGraph {
  constructor(config = {}) {
    this.backend = config.backend || 'in-memory';
    this.categories = config.entityExtraction?.categories || ['person', 'organization', 'technology', 'concept'];
    this.minConfidence = config.entityExtraction?.minConfidence || 0.7;
    this.deduplication = config.entityExtraction?.deduplication !== false;
    this.traversalConfig = config.traversal || {};

    /** @type {Map<string, GraphNode>} */
    this.nodes = new Map();
    /** @type {Map<string, GraphEdge>} */
    this.edges = new Map();
    /** @type {Map<string, Set<string>>} adjacency list */
    this._adjacency = new Map();
  }

  /**
   * Add a node to the graph.
   * @param {string} label
   * @param {string} category
   * @param {object} properties
   * @returns {GraphNode}
   */
  addNode(label, category, properties = {}) {
    const id = this._normalizeId(label);

    // Deduplication
    if (this.deduplication && this.nodes.has(id)) {
      const existing = this.nodes.get(id);
      Object.assign(existing.properties, properties);
      return existing;
    }

    const node = new GraphNode(id, label, category, properties);
    this.nodes.set(id, node);
    if (!this._adjacency.has(id)) this._adjacency.set(id, new Set());
    return node;
  }

  /**
   * Add an edge (relationship) between two nodes.
   * @param {string} sourceLabel
   * @param {string} targetLabel
   * @param {string} relationship
   * @param {object} properties
   * @returns {GraphEdge}
   */
  addEdge(sourceLabel, targetLabel, relationship, properties = {}) {
    const sourceId = this._normalizeId(sourceLabel);
    const targetId = this._normalizeId(targetLabel);

    // Auto-create nodes if they don't exist
    if (!this.nodes.has(sourceId)) this.addNode(sourceLabel, 'unknown');
    if (!this.nodes.has(targetId)) this.addNode(targetLabel, 'unknown');

    const edge = new GraphEdge(sourceId, targetId, relationship, properties);
    this.edges.set(edge.id, edge);

    this._adjacency.get(sourceId).add(targetId);
    if (!this._adjacency.has(targetId)) this._adjacency.set(targetId, new Set());
    this._adjacency.get(targetId).add(sourceId); // bidirectional

    this.nodes.get(sourceId).edges.push(edge.id);
    this.nodes.get(targetId).edges.push(edge.id);

    return edge;
  }

  /**
   * Traverse the graph from a starting node.
   * @param {string} startLabel
   * @param {number} [maxHops]
   * @returns {{ nodes: GraphNode[], edges: GraphEdge[], hops: number }}
   */
  traverse(startLabel, maxHops) {
    const startId = this._normalizeId(startLabel);
    if (!this.nodes.has(startId)) return { nodes: [], edges: [], hops: 0 };

    const hopsLimit = maxHops || this.traversalConfig.maxHops || 3;
    const maxResults = this.traversalConfig.maxResults || 50;
    const strategy = this.traversalConfig.strategy || 'breadth-first';

    if (strategy === 'breadth-first') {
      return this._bfs(startId, hopsLimit, maxResults);
    } else if (strategy === 'depth-first') {
      return this._dfs(startId, hopsLimit, maxResults);
    }
    return this._bfs(startId, hopsLimit, maxResults);
  }

  /**
   * Find shortest path between two nodes.
   * @param {string} fromLabel
   * @param {string} toLabel
   * @returns {{ path: string[], distance: number, found: boolean }}
   */
  shortestPath(fromLabel, toLabel) {
    const fromId = this._normalizeId(fromLabel);
    const toId = this._normalizeId(toLabel);

    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      return { path: [], distance: -1, found: false };
    }

    const visited = new Set();
    const queue = [[fromId]];
    visited.add(fromId);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      if (current === toId) {
        return { path, distance: path.length - 1, found: true };
      }

      const neighbors = this._adjacency.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    return { path: [], distance: -1, found: false };
  }

  /**
   * Get neighbors of a node.
   * @param {string} label
   * @param {string} [relationship] - Filter by relationship type
   * @returns {Array<{ node: GraphNode, edge: GraphEdge, relationship: string }>}
   */
  getNeighbors(label, relationship) {
    const id = this._normalizeId(label);
    if (!this.nodes.has(id)) return [];

    const results = [];
    const node = this.nodes.get(id);

    for (const edgeId of node.edges) {
      const edge = this.edges.get(edgeId);
      if (!edge) continue;
      if (relationship && edge.relationship !== relationship) continue;

      const neighborId = edge.sourceId === id ? edge.targetId : edge.sourceId;
      const neighborNode = this.nodes.get(neighborId);
      if (neighborNode) {
        results.push({ node: neighborNode, edge, relationship: edge.relationship });
      }
    }

    return results;
  }

  /**
   * Search nodes by category and/or label pattern.
   * @param {object} filter - { category?, labelPattern?, property? }
   * @returns {GraphNode[]}
   */
  searchNodes(filter = {}) {
    const results = [];
    for (const node of this.nodes.values()) {
      if (filter.category && node.category !== filter.category) continue;
      if (filter.labelPattern && !node.label.toLowerCase().includes(filter.labelPattern.toLowerCase())) continue;
      if (filter.property) {
        const [key, value] = Object.entries(filter.property)[0];
        if (node.properties[key] !== value) continue;
      }
      results.push(node);
    }
    return results;
  }

  /**
   * Extract entities from text (heuristic — production uses LLM).
   * @param {string} text
   * @returns {Array<{ label: string, category: string, confidence: number }>}
   */
  extractEntities(text) {
    const entities = [];

    // Capitalize words — likely named entities
    const namedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    let match;
    while ((match = namedPattern.exec(text)) !== null) {
      const label = match[0];
      // Skip common words
      if (['The', 'This', 'That', 'When', 'What', 'Where', 'How', 'Why', 'Which'].includes(label)) continue;

      // Categorize heuristically
      let category = 'concept';
      if (/^(Mr|Mrs|Ms|Dr|Prof)\s/.test(label) || label.split(' ').length === 2) category = 'person';
      else if (/Inc|Corp|Ltd|LLC|Foundation|Institute|University/i.test(label)) category = 'organization';
      else if (/Azure|AWS|Google|Python|Java|React|Docker|Kubernetes/i.test(label)) category = 'technology';

      entities.push({ label, category, confidence: 0.6 });
    }

    // Technology terms (mixed case)
    const techPattern = /\b(?:Azure|AWS|GCP|OpenAI|GPT-[0-9o]+|Bicep|Terraform|Docker|Kubernetes|Redis|Cosmos\s*DB)\b/gi;
    while ((match = techPattern.exec(text)) !== null) {
      entities.push({ label: match[0], category: 'technology', confidence: 0.9 });
    }

    // Deduplicate
    const seen = new Set();
    return entities.filter(e => {
      const key = e.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return e.confidence >= this.minConfidence;
    });
  }

  /** @private BFS traversal */
  _bfs(startId, maxHops, maxResults) {
    const visited = new Set([startId]);
    const queue = [{ id: startId, hop: 0 }];
    const resultNodes = [this.nodes.get(startId)];
    const resultEdges = [];
    let maxHop = 0;

    while (queue.length > 0 && resultNodes.length < maxResults) {
      const { id, hop } = queue.shift();
      if (hop >= maxHops) continue;

      const neighbors = this._adjacency.get(id) || new Set();
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);

        const node = this.nodes.get(neighbor);
        if (node) {
          resultNodes.push(node);
          maxHop = Math.max(maxHop, hop + 1);
        }

        // Collect edges between id and neighbor
        for (const edge of this.edges.values()) {
          if ((edge.sourceId === id && edge.targetId === neighbor) ||
              (edge.sourceId === neighbor && edge.targetId === id)) {
            resultEdges.push(edge);
          }
        }

        queue.push({ id: neighbor, hop: hop + 1 });
      }
    }

    return { nodes: resultNodes, edges: resultEdges, hops: maxHop };
  }

  /** @private DFS traversal */
  _dfs(startId, maxHops, maxResults) {
    const visited = new Set();
    const resultNodes = [];
    const resultEdges = [];

    const dfs = (id, hop) => {
      if (visited.has(id) || hop > maxHops || resultNodes.length >= maxResults) return;
      visited.add(id);

      const node = this.nodes.get(id);
      if (node) resultNodes.push(node);

      const neighbors = this._adjacency.get(id) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, hop + 1);
        }
      }
    };

    dfs(startId, 0);
    return { nodes: resultNodes, edges: resultEdges, hops: maxHops };
  }

  _normalizeId(label) {
    return label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  stats() {
    const categories = {};
    for (const node of this.nodes.values()) {
      categories[node.category] = (categories[node.category] || 0) + 1;
    }

    const relationships = {};
    for (const edge of this.edges.values()) {
      relationships[edge.relationship] = (relationships[edge.relationship] || 0) + 1;
    }

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      categories,
      relationships,
      avgEdgesPerNode: this.nodes.size > 0 ? this.edges.size * 2 / this.nodes.size : 0
    };
  }

  serialize() {
    return {
      nodes: [...this.nodes.values()].map(n => n.serialize()),
      edges: [...this.edges.values()].map(e => e.serialize()),
      stats: this.stats()
    };
  }
}

// ─── Hybrid Search (Vector + Graph) ───────────────────

class HybridSearchEngine {
  constructor(graph, config = {}) {
    this.graph = graph;
    this.vectorWeight = config.hybridSearch?.vector?.weight ?? 0.6;
    this.graphWeight = config.hybridSearch?.graph?.weight ?? 0.4;
    this.reranking = config.hybridSearch?.reranking !== false;
  }

  /**
   * Hybrid search combining vector similarity and graph traversal.
   * @param {string} query
   * @param {Array<{ id: string, score: number }>} vectorResults - Pre-computed vector search results
   * @param {number} topK
   * @returns {Array<{ id: string, label: string, score: number, vectorScore: number, graphScore: number }>}
   */
  search(query, vectorResults = [], topK = 10) {
    const scores = new Map();

    // Apply vector scores
    for (const vr of vectorResults) {
      scores.set(vr.id, {
        vectorScore: vr.score,
        graphScore: 0,
        label: vr.label || vr.id
      });
    }

    // Extract entities from query and boost graph-connected nodes
    const entities = this.graph.extractEntities(query);
    for (const entity of entities) {
      const entityId = entity.label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { nodes: connected } = this.graph.traverse(entityId, 2);

      for (const node of connected) {
        if (!scores.has(node.id)) {
          scores.set(node.id, { vectorScore: 0, graphScore: 0, label: node.label });
        }
        scores.get(node.id).graphScore += entity.confidence * 0.5;
      }
    }

    // Combine scores
    const combined = [];
    for (const [id, s] of scores) {
      const finalScore = (s.vectorScore * this.vectorWeight) + (s.graphScore * this.graphWeight);
      combined.push({ id, label: s.label, score: finalScore, vectorScore: s.vectorScore, graphScore: s.graphScore });
    }

    // Sort by combined score
    combined.sort((a, b) => b.score - a.score);
    return combined.slice(0, topK);
  }
}

// ─── Public Factory ───────────────────────────────────

function createGraphSystem(graphConfig = {}) {
  const graph = new KnowledgeGraph(graphConfig);
  const hybrid = new HybridSearchEngine(graph, graphConfig);

  return {
    graph,
    hybrid,
    schema: GRAPH_SCHEMA,

    validate(config) {
      const errors = [];
      if (!config || typeof config !== 'object') return { valid: true, errors };

      const validBackends = ['cosmos-gremlin', 'neo4j', 'neptune', 'tigergraph', 'in-memory'];
      if (config.backend && !validBackends.includes(config.backend)) {
        errors.push(`Invalid graph backend "${config.backend}". Valid: ${validBackends.join(', ')}`);
      }
      if (config.traversal?.maxHops !== undefined && (config.traversal.maxHops < 1 || config.traversal.maxHops > 10)) {
        errors.push(`traversal.maxHops must be 1-10, got: ${config.traversal.maxHops}`);
      }
      if (config.hybridSearch) {
        const vw = config.hybridSearch.vector?.weight ?? 0.6;
        const gw = config.hybridSearch.graph?.weight ?? 0.4;
        if (Math.abs(vw + gw - 1.0) > 0.01) {
          errors.push(`Hybrid search weights must sum to 1.0. vector=${vw} + graph=${gw} = ${vw + gw}`);
        }
      }

      return { valid: errors.length === 0, errors };
    }
  };
}

export { createGraphSystem, KnowledgeGraph, HybridSearchEngine, GraphNode, GraphEdge, GRAPH_SCHEMA };
